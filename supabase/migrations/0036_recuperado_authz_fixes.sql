-- 0036 — Correções do code review (superpowers):
-- 1) Pipeline/Leads "recuperado" alinhado à regra: Compra Aprovada + e-mail de
--    automação (channel email|null, status enviado) ANTES da 1ª compra.
--    Não usa lead_metrics.enviados (inclui WhatsApp e e-mails pós-compra).
-- 2) RPC atômica increment_vendas_recuperadas (postback-receiver).

-- ===========================================================================
-- 1) leads_page + pipeline_counts
-- ===========================================================================
create or replace function public.leads_page(
  p_org uuid default null,
  p_stage text default null,
  p_search text default null,
  p_evento text default null,
  p_limit int default 25,
  p_offset int default 0
) returns table(
  id uuid, organization_id uuid, nome text, sobrenome text, email text,
  telefone text, produto text, valor_compra numeric, metodo_pagamento text,
  ultimo_evento text, created_at timestamptz,
  enviados bigint, aberturas bigint, cliques bigint,
  stage text, tag_ids uuid[], total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with base as (
    select l.id, l.organization_id, l.nome, l.sobrenome, l.email, l.telefone,
           l.produto, l.valor_compra, l.metodo_pagamento::text as metodo_pagamento,
           l.ultimo_evento::text as ultimo_evento, l.created_at,
           coalesce(m.env, 0) as env, coalesce(m.ab, 0) as ab, coalesce(m.cl, 0) as cl,
           -- 1ª compra aprovada do lead (timestamp) — e-mail recuperador precisa ser anterior
           (
             select min(we.created_at)
             from webhook_events we
             where we.lead_id = l.id
               and we.tipo_evento = 'Compra Aprovada'
           ) as first_purchase_at
    from leads l
    left join lateral (
      select sum(lm.enviados) as env, sum(lm.aberturas) as ab, sum(lm.cliques) as cl
      from lead_metrics lm where lm.lead_id = l.id
    ) m on true
    where (p_org is null or l.organization_id = p_org)
      and (p_evento is null or p_evento = '' or l.ultimo_evento::text = p_evento)
      and (p_search is null or p_search = '' or
           (coalesce(l.nome,'') || ' ' || coalesce(l.sobrenome,'') || ' ' ||
            coalesce(l.email,'') || ' ' || coalesce(l.produto,'')) ilike '%' || p_search || '%')
  ), staged as (
    select b.*, case
      -- Recuperado = comprou E recebeu e-mail de automação ANTES da 1ª compra
      when b.ultimo_evento = 'Compra Aprovada'
           and b.first_purchase_at is not null
           and exists (
             select 1 from email_events ee
             where ee.organization_id = b.organization_id
               and ee.email = b.email
               and ee.status = 'enviado'
               and (ee.channel is null or ee.channel = 'email')
               and ee.timestamp < b.first_purchase_at
           )
        then 'recuperado'
      when b.cl > 0 then 'clicou'
      when b.ab > 0 then 'abriu'
      when b.env > 0 then 'enviado'
      else 'novo' end as st
    from base b
  )
  select s.id, s.organization_id, s.nome, s.sobrenome, s.email, s.telefone, s.produto,
         s.valor_compra, s.metodo_pagamento, s.ultimo_evento, s.created_at,
         s.env, s.ab, s.cl, s.st,
         coalesce((select array_agg(lt.tag_id) from lead_tags lt where lt.lead_id = s.id), '{}'::uuid[]),
         count(*) over() as total_count
  from staged s
  where (p_stage is null or p_stage = '' or s.st = p_stage)
  order by s.created_at desc
  limit greatest(1, least(coalesce(p_limit, 25), 100))
  offset greatest(0, coalesce(p_offset, 0));
$$;

create or replace function public.pipeline_counts(p_org uuid default null)
returns table(stage text, total bigint, valor numeric)
language sql
stable
security invoker
set search_path = public
as $$
  with base as (
    select l.id, l.organization_id, l.email, l.valor_compra,
           l.ultimo_evento::text as ultimo_evento,
           coalesce(m.env, 0) as env, coalesce(m.ab, 0) as ab, coalesce(m.cl, 0) as cl,
           (
             select min(we.created_at)
             from webhook_events we
             where we.lead_id = l.id and we.tipo_evento = 'Compra Aprovada'
           ) as first_purchase_at
    from leads l
    left join lateral (
      select sum(lm.enviados) as env, sum(lm.aberturas) as ab, sum(lm.cliques) as cl
      from lead_metrics lm where lm.lead_id = l.id
    ) m on true
    where (p_org is null or l.organization_id = p_org)
  ), staged as (
    select case
      when ultimo_evento = 'Compra Aprovada'
           and first_purchase_at is not null
           and exists (
             select 1 from email_events ee
             where ee.organization_id = base.organization_id
               and ee.email = base.email
               and ee.status = 'enviado'
               and (ee.channel is null or ee.channel = 'email')
               and ee.timestamp < base.first_purchase_at
           )
        then 'recuperado'
      when cl > 0 then 'clicou'
      when ab > 0 then 'abriu'
      when env > 0 then 'enviado'
      else 'novo' end as st,
      valor_compra
    from base
  )
  select st as stage, count(*)::bigint as total, coalesce(sum(valor_compra), 0) as valor
  from staged
  group by st;
$$;

-- ===========================================================================
-- 2) Incremento atômico de vendas recuperadas
-- ===========================================================================
create or replace function public.increment_vendas_recuperadas(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.campaign_stats
     set vendas_recuperadas = coalesce(vendas_recuperadas, 0) + 1,
         ultimo_calculo = now()
   where campaign_id = p_campaign_id;
  if not found then
    insert into public.campaign_stats (campaign_id, organization_id, vendas_recuperadas, ultimo_calculo)
    select c.id, c.organization_id, 1, now()
      from public.campaigns c
     where c.id = p_campaign_id
    on conflict (campaign_id) do update
      set vendas_recuperadas = coalesce(public.campaign_stats.vendas_recuperadas, 0) + 1,
          ultimo_calculo = now();
  end if;
end;
$$;

revoke all on function public.increment_vendas_recuperadas(uuid) from public, anon;
-- Só service_role (edge functions) chama; authenticated não precisa.
grant execute on function public.increment_vendas_recuperadas(uuid) to service_role;
