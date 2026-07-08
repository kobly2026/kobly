-- 0032_invite_client_onboarding.sql
-- MARCA-2: fecha o fluxo "Gestor cria conta para cliente".
-- 1) handle_new_user lê organization_id do metadata do auth user → quando um
--    cliente é CONVIDADO por e-mail (invite-client), seu profile já nasce
--    vinculado à org correta (sem precisar de onboarding manual).
-- 2) create_managed_org aceita p_plano_id opcional (default Starter) para o
--    gestor escolher o plano inicial do cliente no cadastro.
-- ---------------------------------------------------------------------------

-- 1) handle_new_user — lê organization_id e tipo_user_geral do metadata
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_tipo   public.tipo_user_geral;
begin
  v_org_id := nullif(new.raw_user_meta_data->>'organization_id', '')::uuid;
  v_tipo   := coalesce(nullif(new.raw_user_meta_data->>'tipo_user_geral', '')::public.tipo_user_geral, 'Cliente');

  insert into public.profiles (nome, email, auth_id, tipo_user_geral, status_user, organization_id)
  values (
    coalesce(nullif(new.raw_user_meta_data->>'nome', ''), new.email),
    new.email::extensions.citext,
    new.id,
    v_tipo,
    'Ativo',
    v_org_id
  )
  on conflict (email) do update
     set auth_id         = excluded.auth_id,
         ultimo_login    = now(),
         organization_id = coalesce(public.profiles.organization_id, excluded.organization_id)
   where public.profiles.auth_id is null
      or public.profiles.auth_id = excluded.auth_id;

  return new;
end;
$$;

-- 2) create_managed_org — aceita p_plano_id opcional
drop function if exists public.create_managed_org(text, text);
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
  v_plano uuid;
begin
  me      := public.current_profile_id();
  my_role := public.current_role_geral();
  if me is null or my_role not in ('Gestor','Administrador') then
    raise exception 'forbidden: apenas Gestor/Administrador podem criar contas';
  end if;

  v_plano := p_plano_id;
  if v_plano is null then
    select id into v_plano from public.plans where nome = 'Starter' and deleted = false limit 1;
  end if;

  insert into public.organizations (nome, segmento, plano_id, created_by)
    values (p_nome, p_segmento, v_plano, me)
    returning * into org;

  insert into public.organization_memberships (organization_id, profile_id, role, created_by)
    values (org.id, me, 'Gestor', me);

  return org;
end;
$$;

revoke all on function public.create_managed_org(text, text, uuid) from public;
revoke all on function public.create_managed_org(text, text, uuid) from anon;
grant execute on function public.create_managed_org(text, text, uuid) to authenticated;
