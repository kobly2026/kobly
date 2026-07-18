-- 0046_org_branding_rls.sql
-- Auditoria E2E (Segurança M2): org_branding foi criada fora das migrations, então
-- a garantia "RLS em toda tabela" (0007) não a cobria. Sem RLS, leitura/escrita
-- cross-tenant de branding (logo, cor, link_loja/checkout) via PostgREST.
-- Habilita RLS + policies escopadas por org. Idempotente.
-- ---------------------------------------------------------------------------

alter table public.org_branding enable row level security;

drop policy if exists org_branding_select on public.org_branding;
create policy org_branding_select on public.org_branding
  for select using (public.has_org_access(organization_id));

drop policy if exists org_branding_insert on public.org_branding;
create policy org_branding_insert on public.org_branding
  for insert with check (public.has_org_access(organization_id));

drop policy if exists org_branding_update on public.org_branding;
create policy org_branding_update on public.org_branding
  for update using (public.has_org_access(organization_id))
  with check (public.has_org_access(organization_id));

drop policy if exists org_branding_delete on public.org_branding;
create policy org_branding_delete on public.org_branding
  for delete using (public.is_admin() or public.is_gestor());
