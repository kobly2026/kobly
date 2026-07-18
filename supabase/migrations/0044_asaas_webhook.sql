-- 0044_asaas_webhook.sql
-- CRÍTICO (auditoria E2E — dimensão Billing): fecha o ciclo comercial.
-- Antes: o Asaas gerava a cobrança/PIX mas NENHUM webhook confirmava o pagamento
-- → organizations.plano_id nunca era ativado e nada era gravado em transactions.
-- Agora: a edge function `asaas-webhook` recebe PAYMENT_CONFIRMED/RECEIVED e
-- ativa o plano. Esta migration dá o schema de assinatura + libera a escrita
-- de billing pelo servidor confiável.
-- ---------------------------------------------------------------------------

-- 1) Colunas de assinatura/estado de pagamento na organização.
alter table public.organizations
  add column if not exists asaas_subscription_id text,
  add column if not exists plano_status   text,          -- 'ativo' | 'inadimplente' | null
  add column if not exists plano_ativado_em timestamptz,
  add column if not exists plano_expira_em  timestamptz;

comment on column public.organizations.plano_status is
  'Estado do plano derivado do Asaas: ativo (pagamento confirmado) | inadimplente (overdue) | null (sem cobrança).';

-- 2) tg_organizations_guard — congela billing para usuário autenticado não-admin
--    (o vetor real), mas LIBERA o contexto de servidor confiável (auth.uid()
--    nulo = service_role usado pela asaas-webhook). Passa a cobrir as novas
--    colunas de assinatura.
create or replace function public.tg_organizations_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.plano_id                := old.plano_id;
    new.criticidade             := old.criticidade;
    new.leads_count             := old.leads_count;
    new.campanhas_ativas_count  := old.campanhas_ativas_count;
    new.user_fundador_id        := old.user_fundador_id;
    new.asaas_subscription_id   := old.asaas_subscription_id;
    new.plano_status            := old.plano_status;
    new.plano_ativado_em        := old.plano_ativado_em;
    new.plano_expira_em         := old.plano_expira_em;
  end if;
  return new;
end;
$$;

-- 3) Ativação de plano — SECURITY DEFINER, service_role only. Idempotente por
--    id_transacao (asaas payment id). Ativa o plano, grava a transação e RESETA
--    o ciclo de uso (numero_execucoes=0, novo periodo_inicio) — o reset de ciclo
--    que faltava (auditoria Billing ALTO 1).
create or replace function public.asaas_activate_plan(
  p_org        uuid,
  p_plano      uuid,
  p_payment_id text,
  p_value      numeric,
  p_subscription text default null,
  p_expira     timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Ativa o plano na org.
  update public.organizations
     set plano_id              = coalesce(p_plano, plano_id),
         asaas_subscription_id = coalesce(p_subscription, asaas_subscription_id),
         plano_status          = 'ativo',
         plano_ativado_em      = now(),
         plano_expira_em       = p_expira,
         updated_at            = now()
   where id = p_org;

  -- Grava a transação (idempotente por id_transacao).
  if p_payment_id is not null
     and not exists (select 1 from public.transactions where id_transacao = p_payment_id) then
    insert into public.transactions
      (organization_id, plano_id, valor_pago, forma_pagamento, status_pagamento, id_transacao, data)
    values
      (p_org, p_plano, p_value, 'Asaas', 'Pago', p_payment_id, current_date);
  end if;

  -- Reset do ciclo de uso ao ativar/renovar (evita o teto vitalício).
  update public.usage_counters
     set plano_id        = coalesce(p_plano, plano_id),
         numero_execucoes = 0,
         periodo_inicio   = current_date
   where organization_id = p_org;
  if not found then
    insert into public.usage_counters (organization_id, plano_id, numero_execucoes, numero_campanhas, periodo_inicio)
    values (p_org, p_plano, 0, 0, current_date);
  end if;
end;
$$;

revoke all on function public.asaas_activate_plan(uuid, uuid, text, numeric, text, timestamptz) from public, anon, authenticated;
grant execute on function public.asaas_activate_plan(uuid, uuid, text, numeric, text, timestamptz) to service_role;

-- 4) Marca inadimplência (PAYMENT_OVERDUE). service_role only.
create or replace function public.asaas_mark_overdue(p_org uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.organizations
     set plano_status = 'inadimplente', updated_at = now()
   where id = p_org;
end;
$$;
revoke all on function public.asaas_mark_overdue(uuid) from public, anon, authenticated;
grant execute on function public.asaas_mark_overdue(uuid) to service_role;
