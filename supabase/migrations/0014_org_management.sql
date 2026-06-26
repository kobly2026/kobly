-- 0014_org_management.sql
-- Kobly — destrava a gestão de contas (Clientes): Gestor/agência pode CRIAR contas de
-- cliente; membros podem EDITAR dados básicos da org (nome/segmento), mas NÃO billing.
-- ---------------------------------------------------------------------------

-- Insert de org: admin OU gestor (agência cria contas de cliente).
drop policy organizations_insert on public.organizations;
create policy organizations_insert on public.organizations for insert to authenticated
  with check (public.is_admin() or public.is_gestor());

-- Update de org: membros/admin (antes era admin-only). Guard abaixo protege billing.
drop policy organizations_update on public.organizations;
create policy organizations_update on public.organizations for update to authenticated
  using (public.has_org_access(id)) with check (public.has_org_access(id));

-- Guard anti-billing: não-admin não altera plano/criticidade/contadores/fundador.
create or replace function public.tg_organizations_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    new.plano_id := old.plano_id;
    new.criticidade := old.criticidade;
    new.leads_count := old.leads_count;
    new.campanhas_ativas_count := old.campanhas_ativas_count;
    new.user_fundador_id := old.user_fundador_id;
  end if;
  return new;
end;
$$;
create trigger organizations_guard before update on public.organizations
  for each row execute function public.tg_organizations_guard();

-- RPC: cria org gerida + vincula o gestor chamador como membro (multi-step privilegiado,
-- evita o ciclo de RLS no insert de membership). Plano inicial = Starter.
create or replace function public.create_managed_org(p_nome text, p_segmento text)
returns public.organizations language plpgsql security definer set search_path = ''
as $$
declare me uuid; my_role public.tipo_user_geral; org public.organizations;
begin
  me := public.current_profile_id();
  my_role := public.current_role_geral();
  if me is null or my_role not in ('Gestor','Administrador') then
    raise exception 'forbidden: apenas Gestor/Administrador podem criar contas';
  end if;
  insert into public.organizations (nome, segmento, plano_id, created_by)
    values (p_nome, p_segmento,
            (select id from public.plans where nome = 'Starter' and deleted = false limit 1), me)
    returning * into org;
  insert into public.organization_memberships (organization_id, profile_id, role, created_by)
    values (org.id, me, 'Gestor', me);
  return org;
end;
$$;
revoke all on function public.create_managed_org(text, text) from public;
revoke all on function public.create_managed_org(text, text) from anon;
grant execute on function public.create_managed_org(text, text) to authenticated;
