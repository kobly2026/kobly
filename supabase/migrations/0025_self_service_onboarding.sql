-- 0025 — Onboarding self-service: usuário novo (signup) cria a própria organização.
-- Antes: handle_new_user criava o profile Cliente SEM organization_id e nada criava a
-- org → o app ficava vazio e as criações retornavam null. Agora o fluxo é:
-- signup → confirma e-mail → tela de onboarding chama create_own_org(nome, segmento).

-- ===========================================================================
-- 1) tg_profiles_guard — permite o PRIMEIRO vínculo de org quando a org foi
--    fundada pelo próprio usuário (via create_own_org); depois congela.
--    Sem esta exceção, o UPDATE do RPC seria anulado pelo congelamento
--    (o guard avalia is_admin() com o JWT do chamador, mesmo dentro de
--    função SECURITY DEFINER).
-- ===========================================================================
create or replace function public.tg_profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    new.tipo_user_geral := old.tipo_user_geral;
    new.status_user     := old.status_user;
    -- organization_id: congelado, EXCETO o primeiro vínculo a uma org fundada
    -- pelo próprio profile (create_own_org). Um usuário comum nunca consegue
    -- se vincular a org de terceiros nem trocar de org depois.
    if not (old.organization_id is null
            and new.organization_id is not null
            and exists (select 1 from public.organizations o
                         where o.id = new.organization_id
                           and o.user_fundador_id = old.id)) then
      new.organization_id := old.organization_id;
    end if;
    new.gestor_responsavel_id := old.gestor_responsavel_id;
    -- auth_id: permite a reconciliação por e-mail (handle_new_user faz
    -- INSERT..ON CONFLICT DO UPDATE setando auth_id num profile ainda não
    -- vinculado, old.auth_id IS NULL). Uma vez vinculado, congela.
    if old.auth_id is not null then
      new.auth_id := old.auth_id;
    end if;
  end if;
  return new;
end;
$$;

-- ===========================================================================
-- 2) create_own_org — RPC de onboarding (idempotente).
--    Cliente sem org cria a própria organização (plano Starter) e se vincula.
--    Se já tem org, devolve a existente (safe para re-submits).
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

  insert into public.organizations (nome, segmento, plano_id, user_fundador_id, created_by)
    values (btrim(p_nome), nullif(btrim(p_segmento), ''),
            (select id from public.plans where nome = 'Starter' and deleted = false limit 1),
            me.id, me.id)
    returning * into org;

  update public.profiles
     set organization_id = org.id, perfil_completo = true
   where id = me.id;

  insert into public.usage_counters (organization_id, profile_id, plano_id, periodo_inicio)
    values (org.id, me.id, org.plano_id, current_date)
    on conflict (organization_id) do nothing;

  return org;
end;
$$;

revoke all on function public.create_own_org(text, text) from public;
revoke all on function public.create_own_org(text, text) from anon;
grant execute on function public.create_own_org(text, text) to authenticated;
