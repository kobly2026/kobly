-- 0065_gates_coerencia.sql
-- Kobly — dois ajustes de coerencia nos gates de plano, descobertos ao executar
-- o plano 2026-07-30-planos-cobranca-real.
--
-- (a) MENSAGEM DO LIMITE DE INTEGRACOES. A tela tem duas remocoes: Revogar
--     (soft, ativo=false, a linha fica) e Excluir (hard, delete). O trigger conta
--     linhas sem filtrar por ativo, entao SO Excluir libera vaga. A mensagem dizia
--     "Remova uma", que nao distingue as duas — quem revogava seguia bloqueado
--     achando que tinha resolvido.
--     Decisao: manter a semantica (revogar = pausar, vaga reservada para reativacao)
--     e apontar a acao certa. Contar so ativos foi rejeitado: activatePostbackToken
--     permitiria revogar -> criar -> reativar e passar do limite, exigindo estender
--     o trigger para UPDATE.
--
-- (b) bulk_reserve_usage IGNORAVA limites_isentos — o unico dos quatro pontos de
--     regra que nao olhava a isencao. Com preco_excedente preenchido (0063), conta
--     isenta de teste arquivaria excedente FATURAVEL em usage_period_history no
--     vira-mes. numero_execucoes continua contando (telemetria); so o excedente
--     cobravel para de acumular para quem e isento.
--
-- Nenhuma assinatura muda. Rollback: reaplicar os corpos de 0061.
-- ---------------------------------------------------------------------------

-- (a) so a linha da mensagem muda em relacao a 0061
create or replace function public.enforce_limite_integracoes()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
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
    raise exception 'limite_integracoes_atingido: o plano permite % integracao(oes) de checkout. Exclua uma (revogar não libera a vaga) ou faça upgrade.', v_limite
      using errcode = 'check_violation';
  end if;

  return new;
end;
$function$;

-- (b) passa a respeitar limites_isentos no acumulo de excedente
create or replace function public.bulk_reserve_usage(p_org uuid, p_n integer)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_limite int;
  v_isento boolean;
  v_n      int := greatest(0, coalesce(p_n, 0));
  v_antes  int;
  v_depois int;
  v_exc    int;
begin
  if p_org is null then
    return true;
  end if;

  select o.limites_isentos, p.limite_execucoes into v_isento, v_limite
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

  -- SOFT-CAP inalterado: nunca nega. O que muda e que org isenta nao acumula
  -- excedente faturavel.
  if not coalesce(v_isento, false) and v_limite is not null and v_limite > 0 then
    v_exc := greatest(0, v_depois - greatest(v_antes, v_limite));
    if v_exc > 0 then
      update public.usage_counters
         set execucoes_excedente = execucoes_excedente + v_exc
       where organization_id = p_org;
    end if;
  end if;

  return true;
end;
$function$;
