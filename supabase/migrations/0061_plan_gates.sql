-- 0061_plan_gates.sql
-- Kobly — capacidades de plano: o que a página de vendas promete passa a valer.
--
-- POR QUÊ: antes desta migration a ÚNICA regra de assinatura aplicada era a
-- franquia de mensagens (limite_execucoes). Todo o resto que a página vende era
-- decorativo — `limite_campanhas` estava gravado e exibido em Clientes mas nunca
-- era consultado, e não existia nenhum gate por plano. Na prática um Starter
-- disparava SMS, usava disparo em massa, ligava domínio próprio e criava
-- campanhas sem teto. O Pro custa 2x o Starter vendendo justamente SMS + massa +
-- domínio próprio, e os três estavam abertos.
--
-- ONDE A REGRA MORA: o front escreve DIRETO no PostgREST (supabase.from(...)
-- .insert), então limite conferido em JS é cosmético — um curl no REST passa por
-- cima. Contagem é trigger; capacidade booleana é `public.org_pode()`, chamada
-- tanto por trigger quanto pelas edge functions (que rodam com service_role e
-- não passam por RLS).
--
-- SOFT-CAP (decisão de produto): a FAQ da página afirma "suas automações não
-- param no meio de uma recuperação". O código fazia o oposto —
-- `bulk_reserve_usage` tinha um `where numero_execucoes + n <= limite` e devolvia
-- false no teto, e o process-steps adiava o passo. Agora nunca nega: o que passa
-- da franquia é contado como EXCEDENTE do período, para faturar.
--
-- ISENÇÃO: `organizations.limites_isentos` isenta dos gates NOVOS (capacidades e
-- contagens) — cliente que já usava um recurso não o perde. Deliberadamente NÃO
-- isenta da medição de excedente: soft-cap é afrouxamento de um limite que já
-- existia e já bloqueava, ninguém perde acesso; se isentasse, org antiga ganharia
-- mensagem ilimitada de graça e em silêncio.
-- ---------------------------------------------------------------------------

-- ---- 1. Capacidades por plano ---------------------------------------------
alter table public.plans
  add column if not exists sms_habilitado           boolean not null default false,
  add column if not exists disparo_massa_habilitado boolean not null default false,
  add column if not exists dominio_proprio_habilitado boolean not null default false,
  add column if not exists limite_integracoes       int,      -- null = ilimitado
  add column if not exists limite_numeros_whatsapp  int,      -- null = ilimitado
  add column if not exists prioridade_fila          smallint not null default 0,
  add column if not exists preco_excedente          numeric;  -- null = mede sem precificar

comment on column public.plans.limite_integracoes is
  'Máximo de postback_tokens (integrações de checkout) da org. NULL = ilimitado.';
comment on column public.plans.limite_numeros_whatsapp is
  'Declarado pela página de vendas (1/2/4). AINDA NÃO APLICÁVEL: a conexão de WhatsApp é uma instância Z-API única global no Vault (zapi_instance_id), não há entidade de número por org para contar. Fica registrado para quando o modelo existir.';
comment on column public.plans.prioridade_fila is
  'Maior = drenado primeiro pelos workers. Scale = 1 ("Prioridade na fila de envio"). Ainda não lido pelo process-steps/process-bulk.';
comment on column public.plans.preco_excedente is
  'Preço por mensagem acima da franquia (soft-cap). NULL = excedente é medido e arquivado, mas não precificado — a página de vendas não publica esse preço.';

-- ---- 2. Seed conforme a página de vendas ----------------------------------
-- Preços/campanhas/mensagens já conferiam e não são tocados aqui.
update public.plans set
  sms_habilitado = false, disparo_massa_habilitado = false, dominio_proprio_habilitado = false,
  limite_integracoes = 3, limite_numeros_whatsapp = 1, prioridade_fila = 0
where legacy_id = 'pl_1';  -- Starter

update public.plans set
  sms_habilitado = true, disparo_massa_habilitado = true, dominio_proprio_habilitado = true,
  limite_integracoes = 10, limite_numeros_whatsapp = 2, prioridade_fila = 0
where legacy_id = 'pl_2';  -- Pro

update public.plans set
  sms_habilitado = true, disparo_massa_habilitado = true, dominio_proprio_habilitado = true,
  limite_integracoes = null, limite_numeros_whatsapp = 4, prioridade_fila = 1
where legacy_id = 'pl_3';  -- Scale

-- ---- 3. Isenção (grandfathering) ------------------------------------------
alter table public.organizations
  add column if not exists limites_isentos boolean not null default false;

comment on column public.organizations.limites_isentos is
  'true = isenta dos gates de capacidade e das contagens (campanhas, integrações). NÃO isenta da medição de excedente de mensagens. Usada para não retirar recurso de quem já usava.';

-- Toda org que já existe no momento da migration entra isenta.
update public.organizations set limites_isentos = true;

-- ---- 4. Histórico de período (soft-cap não pode perder o excedente) -------
-- reset_usage_cycles() apenas ZERAVA numero_execucoes. Com soft-cap isso apagaria
-- o excedente a faturar no vira-mês, então o período passa a ser arquivado antes.
create table if not exists public.usage_period_history (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  plano_id            uuid references public.plans(id),
  periodo_inicio      date,
  periodo_fim         date not null,
  numero_execucoes    int  not null default 0,
  execucoes_excedente int  not null default 0,
  limite_execucoes    int,
  preco_excedente     numeric,
  created_at          timestamptz not null default now()
);

create index if not exists usage_period_history_org_idx
  on public.usage_period_history (organization_id, periodo_fim desc);

alter table public.usage_period_history enable row level security;

-- Usa o MESMO helper das outras policies do schema (ver usage_counters_select) em
-- vez de resolver a org à mão — o helper já cobre Gestor/Admin, que enxergam mais
-- de uma org. Escrita é só do reset (SECURITY DEFINER), logo sem policy de insert.
drop policy if exists usage_period_history_select on public.usage_period_history;
create policy usage_period_history_select on public.usage_period_history
  for select using (public.has_org_access(organization_id));

alter table public.usage_counters
  add column if not exists execucoes_excedente int not null default 0;

comment on column public.usage_counters.execucoes_excedente is
  'Mensagens do período corrente acima da franquia (soft-cap). Arquivado em usage_period_history e zerado no vira-mês.';

-- ---- 5. bulk_reserve_usage → soft-cap ------------------------------------
-- Mantém a assinatura e o retorno boolean para não quebrar os callers
-- (process-steps, process-bulk, bulk-send), mas agora SEMPRE devolve true:
-- nenhum envio é negado por franquia. Quem trata `false` segue compilando e
-- simplesmente nunca mais entra nesse caminho.
create or replace function public.bulk_reserve_usage(p_org uuid, p_n integer)
returns boolean
language plpgsql security definer set search_path to ''
as $$
declare
  v_limite int;
  v_n      int := greatest(0, coalesce(p_n, 0));
  v_antes  int;
  v_depois int;
  v_exc    int;
begin
  if p_org is null then
    return true;
  end if;

  select p.limite_execucoes into v_limite
    from public.organizations o
    left join public.plans p on p.id = o.plano_id
   where o.id = p_org;

  insert into public.usage_counters (organization_id, numero_execucoes, periodo_inicio)
    values (p_org, 0, current_date)
    on conflict (organization_id) do nothing;

  update public.usage_counters
     set numero_execucoes = numero_execucoes + v_n,
         updated_at = now()
   where organization_id = p_org
  returning numero_execucoes - v_n, numero_execucoes into v_antes, v_depois;

  -- Parcela DESTA chamada que passou do teto. O greatest(v_antes, v_limite)
  -- evita contar duas vezes o que já estava acima em chamadas anteriores.
  if v_limite is not null and v_limite > 0 then
    v_exc := greatest(0, v_depois - greatest(v_antes, v_limite));
    if v_exc > 0 then
      update public.usage_counters
         set execucoes_excedente = execucoes_excedente + v_exc
       where organization_id = p_org;
    end if;
  end if;

  return true;  -- soft-cap: automação nunca para por franquia
end;
$$;

comment on function public.bulk_reserve_usage(uuid, integer) is
  'Contabiliza p_n mensagens da org. SOFT-CAP: sempre retorna true; o que passa de plans.limite_execucoes acumula em usage_counters.execucoes_excedente para faturar. Retorno boolean mantido por compatibilidade com os callers.';

-- ---- 6. reset_usage_cycles → arquiva antes de zerar ----------------------
create or replace function public.reset_usage_cycles()
returns integer
language plpgsql security definer set search_path to ''
as $$
declare
  v_rows int;
begin
  insert into public.usage_period_history (
    organization_id, plano_id, periodo_inicio, periodo_fim,
    numero_execucoes, execucoes_excedente, limite_execucoes, preco_excedente
  )
  select uc.organization_id, o.plano_id, uc.periodo_inicio, current_date,
         uc.numero_execucoes, uc.execucoes_excedente, p.limite_execucoes, p.preco_excedente
    from public.usage_counters uc
    join public.organizations o on o.id = uc.organization_id
    left join public.plans p on p.id = o.plano_id
   where uc.periodo_inicio is null
      or uc.periodo_inicio <= (current_date - interval '1 month');

  update public.usage_counters
     set numero_execucoes    = 0,
         execucoes_excedente = 0,
         periodo_inicio      = current_date,
         updated_at          = now()
   where periodo_inicio is null
      or periodo_inicio <= (current_date - interval '1 month');
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

comment on function public.reset_usage_cycles() is
  'Fecha o ciclo mensal: ARQUIVA o período em usage_period_history (o excedente a faturar seria perdido) e zera os contadores.';

-- ---- 7. Capacidade booleana ----------------------------------------------
create or replace function public.org_pode(p_org uuid, p_recurso text)
returns boolean
language sql stable security definer set search_path to ''
as $$
  select case
    when o.limites_isentos then true
    when p_recurso = 'sms'             then coalesce(p.sms_habilitado, false)
    when p_recurso = 'disparo_massa'   then coalesce(p.disparo_massa_habilitado, false)
    when p_recurso = 'dominio_proprio' then coalesce(p.dominio_proprio_habilitado, false)
    else false                          -- recurso desconhecido nega (fail-closed)
  end
  from public.organizations o
  left join public.plans p on p.id = o.plano_id
  where o.id = p_org;
$$;

comment on function public.org_pode(uuid, text) is
  'Capacidade de plano da org: sms | disparo_massa | dominio_proprio. Recurso desconhecido devolve false (fail-closed). Respeita organizations.limites_isentos.';

grant execute on function public.org_pode(uuid, text) to authenticated, service_role;

-- ---- 8. Contagem: campanhas ATIVAS ---------------------------------------
-- A página diz "campanhas de recuperação ATIVAS", então o teto é sobre
-- status_campanha = 'Ativa' — não sobre o total. Por isso o trigger precisa
-- rodar no INSERT e também no UPDATE que ATIVA uma campanha (pausar/arquivar
-- sempre pode, senão o cliente ficaria preso no teto sem como sair).
create or replace function public.enforce_limite_campanhas()
returns trigger
language plpgsql security definer set search_path to ''
as $$
declare
  v_limite int;
  v_isento boolean;
  v_ativas int;
begin
  if new.status_campanha <> 'Ativa' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status_campanha = 'Ativa' then
    return new;  -- já estava ativa, não é nova ocupação de slot
  end if;

  select o.limites_isentos, p.limite_campanhas into v_isento, v_limite
    from public.organizations o
    left join public.plans p on p.id = o.plano_id
   where o.id = new.organization_id;

  if coalesce(v_isento, false) or v_limite is null or v_limite <= 0 then
    return new;
  end if;

  select count(*) into v_ativas
    from public.campaigns c
   where c.organization_id = new.organization_id
     and c.status_campanha = 'Ativa'
     and c.id <> new.id;

  if v_ativas >= v_limite then
    raise exception 'limite_campanhas_atingido: o plano permite % campanha(s) ativa(s). Pause uma campanha ou faça upgrade.', v_limite
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_limite_campanhas on public.campaigns;
create trigger trg_limite_campanhas
  before insert or update of status_campanha on public.campaigns
  for each row execute function public.enforce_limite_campanhas();

-- ---- 9. Contagem: integrações de checkout (postback_tokens) --------------
create or replace function public.enforce_limite_integracoes()
returns trigger
language plpgsql security definer set search_path to ''
as $$
declare
  v_limite int;
  v_isento boolean;
  v_qtd    int;
begin
  select o.limites_isentos, p.limite_integracoes into v_isento, v_limite
    from public.organizations o
    left join public.plans p on p.id = o.plano_id
   where o.id = new.organization_id;

  if coalesce(v_isento, false) or v_limite is null or v_limite <= 0 then
    return new;
  end if;

  select count(*) into v_qtd
    from public.postback_tokens t
   where t.organization_id = new.organization_id
     and t.id <> new.id;

  if v_qtd >= v_limite then
    raise exception 'limite_integracoes_atingido: o plano permite % integracao(oes) de checkout. Remova uma ou faça upgrade.', v_limite
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_limite_integracoes on public.postback_tokens;
create trigger trg_limite_integracoes
  before insert on public.postback_tokens
  for each row execute function public.enforce_limite_integracoes();
