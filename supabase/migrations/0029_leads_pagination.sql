-- 0029 — Paginação server-side de leads (escala do Pipeline/Leads).
-- Antes, Pipeline/Leads hidratavam TODOS os leads no navegador (e o PostgREST corta
-- silenciosamente em 1000 linhas — com volume real, além de lento, faltaria lead).
-- Estas funções são SECURITY INVOKER: a RLS do usuário chama junto, então o
-- escopo multi-tenant continua valendo dentro delas.

-- Índices de apoio (agregação de métricas por lead + paginação por org/data)
create index if not exists idx_lead_metrics_lead on public.lead_metrics(lead_id);
create index if not exists idx_leads_org_created on public.leads(organization_id, created_at desc);
create index if not exists idx_lead_tags_lead on public.lead_tags(lead_id);

-- ---------------------------------------------------------------------------
-- leads_page — página de leads com estágio derivado NO BANCO, filtros e total.
-- Estágio (mesmas regras da UI): recuperado (ultimo_evento = Compra Aprovada)
-- > clicou > abriu > enviado (lead_metrics somadas) > novo.
-- ---------------------------------------------------------------------------
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
           coalesce(m.env, 0) as env, coalesce(m.ab, 0) as ab, coalesce(m.cl, 0) as cl
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
      when b.ultimo_evento = 'Compra Aprovada' then 'recuperado'
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

-- ---------------------------------------------------------------------------
-- pipeline_counts — total e valor por estágio (headers das colunas do kanban).
-- ---------------------------------------------------------------------------
create or replace function public.pipeline_counts(p_org uuid default null)
returns table(stage text, total bigint, valor numeric)
language sql
stable
security invoker
set search_path = public
as $$
  with base as (
    select l.valor_compra, l.ultimo_evento::text as ultimo_evento,
           coalesce(m.env, 0) as env, coalesce(m.ab, 0) as ab, coalesce(m.cl, 0) as cl
    from leads l
    left join lateral (
      select sum(lm.enviados) as env, sum(lm.aberturas) as ab, sum(lm.cliques) as cl
      from lead_metrics lm where lm.lead_id = l.id
    ) m on true
    where (p_org is null or l.organization_id = p_org)
  ), staged as (
    select case
      when ultimo_evento = 'Compra Aprovada' then 'recuperado'
      when cl > 0 then 'clicou'
      when ab > 0 then 'abriu'
      when env > 0 then 'enviado'
      else 'novo' end as st,
      valor_compra
    from base
  )
  select st, count(*)::bigint, coalesce(sum(valor_compra), 0)::numeric
  from staged group by st;
$$;

-- ---------------------------------------------------------------------------
-- leads_count_by_org — contagem viva por organização (Dashboard/contexto da IA;
-- substitui o organizations.leads_count congelado e o db.leads.length truncado).
-- ---------------------------------------------------------------------------
create or replace function public.leads_count_by_org()
returns table(organization_id uuid, total bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select l.organization_id, count(*)::bigint from leads l group by l.organization_id;
$$;

revoke all on function public.leads_page(uuid, text, text, text, int, int) from public;
revoke all on function public.leads_page(uuid, text, text, text, int, int) from anon;
grant execute on function public.leads_page(uuid, text, text, text, int, int) to authenticated;

revoke all on function public.pipeline_counts(uuid) from public;
revoke all on function public.pipeline_counts(uuid) from anon;
grant execute on function public.pipeline_counts(uuid) to authenticated;

revoke all on function public.leads_count_by_org() from public;
revoke all on function public.leads_count_by_org() from anon;
grant execute on function public.leads_count_by_org() to authenticated;
