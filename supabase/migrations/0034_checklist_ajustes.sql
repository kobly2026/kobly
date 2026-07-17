-- 0034 — Checklist de ajustes (bugs + regra de negócio + planos).
-- 1) postback_tokens: membros da org podem gerir (criar/editar/excluir) — antes só Admin
--    via RLS, o que fazia o botão "Excluir webhook" parecer sem ação para Cliente/Gestor.
-- 2) leads_page / pipeline_counts: "recuperado" só se Compra Aprovada E lead já recebeu
--    e-mail de automação (lead_metrics.enviados > 0).
-- 3) create_own_org / create_managed_org: NÃO ativam plano inicial automaticamente
--    (plano_id fica NULL até liberação manual/admin ou escolha explícita do gestor).

-- ===========================================================================
-- 1) RLS postback_tokens — org members (não só Administrador)
-- ===========================================================================
drop policy if exists postback_tokens_insert on public.postback_tokens;
create policy postback_tokens_insert on public.postback_tokens
  for insert to authenticated
  with check (public.has_org_access(organization_id));

drop policy if exists postback_tokens_update on public.postback_tokens;
create policy postback_tokens_update on public.postback_tokens
  for update to authenticated
  using (public.has_org_access(organization_id))
  with check (public.has_org_access(organization_id));

drop policy if exists postback_tokens_delete on public.postback_tokens;
create policy postback_tokens_delete on public.postback_tokens
  for delete to authenticated
  using (public.has_org_access(organization_id));

-- ===========================================================================
-- 2) Pipeline / leads: recuperado exige e-mail enviado antes (env > 0)
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
      -- Recuperado = comprou E recebeu e-mail de automação (env > 0)
      when b.ultimo_evento = 'Compra Aprovada' and b.env > 0 then 'recuperado'
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
      when ultimo_evento = 'Compra Aprovada' and env > 0 then 'recuperado'
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
-- 3) Contas novas SEM plano automático
-- ===========================================================================
create or replace function public.create_own_org(p_nome text, p_segmento text default null)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  me  public.profiles%rowtype;
  org public.organizations%rowtype;
begin
  select * into me from public.profiles where auth_id = auth.uid();
  if me.id is null then
    raise exception 'forbidden: sem perfil';
  end if;
  if me.organization_id is not null then
    select * into org from public.organizations where id = me.organization_id;
    return org;
  end if;
  if coalesce(btrim(p_nome), '') = '' then
    raise exception 'invalid: nome obrigatório';
  end if;

  -- plano_id NULL: conta nasce sem plano até liberação manual (admin/billing).
  insert into public.organizations (nome, segmento, plano_id, user_fundador_id, created_by)
    values (btrim(p_nome), nullif(btrim(p_segmento), ''), null, me.id, me.id)
    returning * into org;

  update public.profiles
     set organization_id = org.id, perfil_completo = true
   where id = me.id;

  insert into public.usage_counters (organization_id, profile_id, plano_id, periodo_inicio)
    values (org.id, me.id, null, current_date)
    on conflict (organization_id) do nothing;

  return org;
end;
$$;

create or replace function public.create_managed_org(
  p_nome text,
  p_segmento text,
  p_plano_id uuid default null
)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  me      uuid;
  my_role public.tipo_user_geral;
  org     public.organizations;
begin
  me      := public.current_profile_id();
  my_role := public.current_role_geral();
  if me is null or my_role not in ('Gestor','Administrador') then
    raise exception 'forbidden: apenas Gestor/Administrador podem criar contas';
  end if;

  -- Só atribui plano se o gestor escolheu explicitamente (p_plano_id).
  -- Sem escolha → NULL (sem ativação automática do Starter).
  insert into public.organizations (nome, segmento, plano_id, created_by)
    values (p_nome, p_segmento, p_plano_id, me)
    returning * into org;

  insert into public.organization_memberships (organization_id, profile_id, role, created_by)
    values (org.id, me, 'Gestor', me);

  return org;
end;
$$;
