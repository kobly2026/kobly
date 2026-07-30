-- 0048_email_suppressions.sql
-- Lista de supressão de e-mail (conformidade + proteção da reputação do domínio
-- compartilhado). Um endereço suprimido não recebe mais envios da org (ou global,
-- para hard bounce). Preenchida por: endpoint unsubscribe (reason='unsubscribe'),
-- webhook Resend (reason='bounce' global / 'complaint' por org).
-- ---------------------------------------------------------------------------
create table if not exists public.email_suppressions (
  id              uuid primary key default gen_random_uuid(),
  email           text not null,
  organization_id uuid references public.organizations(id) on delete cascade,
  reason          text not null check (reason in ('unsubscribe','bounce','complaint')),
  source          text not null default 'link' check (source in ('link','header','webhook')),
  created_at      timestamptz not null default now()
);

-- NULLS NOT DISTINCT (PG15): trata organization_id NULL (global) como valor único,
-- então hard bounces globais também deduplicam. Requer Postgres 15+.
create unique index if not exists email_suppressions_uq
  on public.email_suppressions (email, organization_id) nulls not distinct;

create index if not exists email_suppressions_email_idx
  on public.email_suppressions (email);

alter table public.email_suppressions enable row level security;

-- Escrita só service_role (edge functions). Leitura pela org dona (para futura UI).
drop policy if exists email_suppressions_read on public.email_suppressions;
create policy email_suppressions_read on public.email_suppressions
  for select using (
    organization_id is not null
    and public.has_org_access(organization_id)
  );
