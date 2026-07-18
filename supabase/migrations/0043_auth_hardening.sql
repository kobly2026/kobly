-- 0043_auth_hardening.sql
-- CRÍTICO (auditoria E2E — dimensão Auth): fecha a auto-promoção de privilégio
-- via signup e habilita o vínculo de cliente convidado pelo servidor.
--
-- Problema 1 (C1): handle_new_user lia tipo_user_geral / organization_id de
--   raw_user_meta_data, que é CONTROLADO PELO CLIENTE em auth.signUp({data}).
--   Qualquer um com a publishable key podia se auto-provisionar como
--   Administrador ou se fixar na org de terceiros. Correção: ler esses campos
--   SOMENTE de raw_app_meta_data (que só o service_role/admin API define).
--   Self-signup passa a nascer sempre como 'Cliente' sem org.
--
-- Problema 2: o guard tg_profiles_guard congela org/role até para o service_role
--   (auth.uid() nulo → não é admin → congelava), impedindo o invite-client de
--   vincular o profile do cliente convidado. Correção: liberar a escrita quando
--   auth.uid() é nulo (contexto de servidor confiável — service_role já bypassa
--   RLS de qualquer forma). Usuários autenticados não-admin continuam congelados.
-- ---------------------------------------------------------------------------

-- 1) handle_new_user — privilégio SÓ de app_metadata (admin-only); nome do
--    user_metadata (não é privilégio). Default seguro: Cliente, sem org.
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
  -- app_metadata NÃO é gravável pelo cliente no signUp — só pela Admin API
  -- (service_role). É a única fonte confiável para papel/org no cadastro.
  v_org_id := nullif(new.raw_app_meta_data->>'organization_id', '')::uuid;
  v_tipo   := coalesce(nullif(new.raw_app_meta_data->>'tipo_user_geral', '')::public.tipo_user_geral, 'Cliente');

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

-- 2) tg_profiles_guard — mantém o congelamento anti-escalonamento para usuários
--    autenticados não-admin (o vetor real), mas libera contexto de servidor
--    confiável (auth.uid() nulo = service_role/admin API), preservando a
--    exceção do primeiro vínculo via create_own_org (fundador).
create or replace function public.tg_profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- auth.uid() nulo → chamada de servidor confiável (service_role). Não congela.
  if auth.uid() is not null and not public.is_admin() then
    new.tipo_user_geral := old.tipo_user_geral;
    new.status_user     := old.status_user;
    -- organization_id: congelado, EXCETO o primeiro vínculo a uma org fundada
    -- pelo próprio profile (create_own_org).
    if not (old.organization_id is null
            and new.organization_id is not null
            and exists (select 1 from public.organizations o
                         where o.id = new.organization_id
                           and o.user_fundador_id = old.id)) then
      new.organization_id := old.organization_id;
    end if;
    new.gestor_responsavel_id := old.gestor_responsavel_id;
    if old.auth_id is not null then
      new.auth_id := old.auth_id;
    end if;
  end if;
  return new;
end;
$$;
