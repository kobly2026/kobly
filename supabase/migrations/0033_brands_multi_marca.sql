-- 0033_brands_multi_marca.sql
-- MARCA-1: múltiplas marcas/produtos por conta. Cada marca tem sua identidade
-- (logo, cor, tema, link de checkout) e pode ser vinculada a campanhas específicas.
-- Estratégia ADITIVA e RETROCOMPATÍVEL:
--   - brands (1:N) espelha org_branding; o seed copia os dados existentes.
--   - campaigns.brand_id (nullable): NULL = usa a marca padrão da org (1º brand).
--   - getBranding(orgId) no front continua funcionando (lê o 1º brand da org).
-- ---------------------------------------------------------------------------

create table public.brands (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  nome            text,
  logo_url        text,
  cor             text not null default '#ff6800',
  modo            text not null default 'dark',
  link_loja       text,
  ordem           integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.brands is 'MARCA-1: marcas/produtos por organização (1:N).';

create index idx_brands_organization_id on public.brands(organization_id);

alter table public.brands enable row level security;

create policy brands_select on public.brands
  for select to authenticated
  using (public.has_org_access(organization_id));

create policy brands_insert on public.brands
  for insert to authenticated
  with check (
    public.has_org_access(organization_id)
    and public.current_role_geral() in ('Administrador','Gestor')
  );

create policy brands_update on public.brands
  for update to authenticated
  using (public.has_org_access(organization_id))
  with check (public.has_org_access(organization_id));

create policy brands_delete on public.brands
  for delete to authenticated
  using (
    public.has_org_access(organization_id)
    and public.current_role_geral() in ('Administrador','Gestor')
  );

alter table public.campaigns
  add column if not exists brand_id uuid references public.brands(id) on delete set null;

create index if not exists idx_campaigns_brand_id
  on public.campaigns(brand_id) where brand_id is not null;

comment on column public.campaigns.brand_id is
  'MARCA-1: marca/produto específico desta campanha. NULL = marca padrão da org.';

-- SEED: migra org_branding existente + garante 1 brand por org.
insert into public.brands (organization_id, nome, logo_url, cor, modo, link_loja, ordem)
select ob.organization_id, ob.nome, ob.logo_url, ob.cor, ob.modo, ob.link_loja, 0
from public.org_branding ob
where not exists (select 1 from public.brands b where b.organization_id = ob.organization_id);

insert into public.brands (organization_id, nome, ordem)
select o.id, o.nome, 0
from public.organizations o
where not exists (select 1 from public.brands b where b.organization_id = o.id);
