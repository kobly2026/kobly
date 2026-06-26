-- 0006_functions_triggers.sql
-- Kobly — funções helper (SECURITY DEFINER), updated_at, classify_criticidade,
-- handle_new_user e realtime.
-- Todas as funções com `set search_path = ''` e referências totalmente qualificadas
-- (public.x, auth.uid(), extensions.x). Helpers SECURITY DEFINER bypassam RLS para
-- evitar recursão nas policies.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- HELPERS DE IDENTIDADE / RBAC (SECURITY DEFINER, STABLE)
-- ===========================================================================

-- profile id do usuário autenticado atual
create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.profiles p where p.auth_id = auth.uid();
$$;

-- papel geral do usuário atual
create or replace function public.current_role_geral()
returns public.tipo_user_geral
language sql
stable
security definer
set search_path = ''
as $$
  select p.tipo_user_geral from public.profiles p where p.auth_id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_role_geral() = 'Administrador', false);
$$;

create or replace function public.is_support()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_role_geral() = 'Suporte', false);
$$;

create or replace function public.is_gestor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_role_geral() = 'Gestor', false);
$$;

-- conjunto de organization_ids acessíveis ao usuário atual:
-- a própria org do profile UNIÃO as orgs onde ele é membro.
create or replace function public.my_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.organization_id
    from public.profiles p
   where p.auth_id = auth.uid()
     and p.organization_id is not null
  union
  select m.organization_id
    from public.organization_memberships m
   where m.profile_id = public.current_profile_id();
$$;

-- acesso a uma org específica (admin vê tudo)
create or replace function public.has_org_access(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or (org is not null and org in (select public.my_org_ids()));
$$;

-- Concede execução aos usuários autenticados
grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.current_role_geral() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_support() to authenticated;
grant execute on function public.is_gestor() to authenticated;
grant execute on function public.my_org_ids() to authenticated;
grant execute on function public.has_org_access(uuid) to authenticated;

-- ===========================================================================
-- updated_at automático
-- ===========================================================================
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Triggers BEFORE UPDATE em toda tabela que possui updated_at
create trigger set_updated_at before update on public.plans
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on public.organizations
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on public.profiles
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on public.organization_memberships
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on public.usage_counters
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on public.transactions
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on public.active_sessions
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on public.tags
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on public.leads
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on public.lead_metrics
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on public.templates
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on public.domains
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on public.domain_dns_records
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on public.emails
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on public.webhooks
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on public.campaigns
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on public.campaign_flows
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on public.flow_steps
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on public.campaign_stats
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on public.dashboard_stats
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on public.ai_suggestions
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on public.scheduled_steps
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on public.support_conversations
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on public.faq
  for each row execute function public.tg_set_updated_at();

-- ===========================================================================
-- classify_criticidade — faixas do doc 03
-- ===========================================================================
create or replace function public.classify_criticidade(valor numeric, enviados int)
returns public.status_criticidade
language plpgsql
immutable
set search_path = ''
as $$
begin
  if enviados is null or enviados = 0 or valor is null then
    return 'Não Iniciado';
  elsif valor <= 0.15 then
    return 'Crítico';
  elsif valor <= 0.25 then
    return 'Mediano';
  elsif valor <= 0.4 then
    return 'Bom';
  else
    return 'Excelente';
  end if;
end;
$$;

-- Trigger que classifica criticidade em campaign_stats
create or replace function public.tg_classify_campaign_stats()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.status_criticidade = public.classify_criticidade(new.valor_criticidade, new.emails_enviados);
  return new;
end;
$$;

create trigger classify_criticidade before insert or update on public.campaign_stats
  for each row execute function public.tg_classify_campaign_stats();

-- ===========================================================================
-- tg_profiles_guard — impede auto-promoção / escalonamento de privilégio
-- ===========================================================================
-- A policy RLS de UPDATE em profiles permite o dono editar a própria linha,
-- mas RLS não restringe COLUNAS. Sem este guard, um Cliente poderia dar
-- UPDATE em si mesmo setando tipo_user_geral='Administrador' (ou status_user,
-- organization_id, gestor_responsavel_id, auth_id) e escalar para acesso
-- cross-tenant via is_admin()/has_org_access(). O guard congela essas colunas
-- sensíveis para quem não é admin. SECURITY DEFINER + search_path vazio.
create or replace function public.tg_profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    new.tipo_user_geral       := old.tipo_user_geral;
    new.status_user           := old.status_user;
    new.organization_id       := old.organization_id;
    new.gestor_responsavel_id := old.gestor_responsavel_id;
    -- auth_id: permite a reconciliação por e-mail (handle_new_user faz
    -- INSERT..ON CONFLICT DO UPDATE setando auth_id num profile ainda não
    -- vinculado, old.auth_id IS NULL). Uma vez vinculado, congela para impedir
    -- re-apontamento por usuário comum.
    if old.auth_id is not null then
      new.auth_id := old.auth_id;
    end if;
  end if;
  return new;
end;
$$;

-- BEFORE UPDATE: roda antes do set_updated_at (ambos só mutam NEW; ordem ok).
create trigger profiles_guard before update on public.profiles
  for each row execute function public.tg_profiles_guard();

-- ===========================================================================
-- handle_new_user — reconciliação por e-mail no primeiro login
-- ===========================================================================
-- Robustez de concorrência: usa UPSERT por email (citext, unique) para evitar
-- unique_violation em retry do GoTrue / sinais quase-simultâneos. A cláusula
-- WHERE no DO UPDATE evita sequestro de profile já vinculado a outro auth_id
-- (só vincula quando auth_id ainda é nulo ou já é o mesmo).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (nome, email, auth_id, tipo_user_geral, status_user)
  values (
    coalesce(nullif(new.raw_user_meta_data->>'nome', ''), new.email),
    new.email::extensions.citext,
    new.id,
    'Cliente',
    'Ativo'
  )
  on conflict (email) do update
     set auth_id = excluded.auth_id,
         ultimo_login = now()
   where public.profiles.auth_id is null
      or public.profiles.auth_id = excluded.auth_id;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===========================================================================
-- REALTIME — chat de suporte em tempo real
-- ===========================================================================
-- Cada tabela é adicionada em seu próprio bloco, com guarda via
-- pg_publication_tables, para que um estado PARCIAL (uma tabela já presente,
-- a outra não) não aborte a adição da segunda. Verdadeiramente idempotente.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'support_conversations'
     ) then
    alter publication supabase_realtime add table public.support_conversations;
  end if;
end;
$$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'support_messages'
     ) then
    alter publication supabase_realtime add table public.support_messages;
  end if;
end;
$$;
