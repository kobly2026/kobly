-- Kobly — tema do e-mail por conta (claro/escuro).
-- Coluna aditiva em org_branding: define o fundo dos e-mails enviados aos leads.
-- 'dark' (padrão, identidade Kobly) | 'light'.

-- Auditoria E2E (Modelo de dados ALTO): org_branding foi criada fora do controle
-- de migrations (a cadeia 0001→0042 quebrava aqui num banco limpo). Recria de
-- forma idempotente ANTES do ALTER, tornando a cadeia reproduzível do zero.
-- Colunas-base (pré-modo/link_loja); modo é adicionado logo abaixo e link_loja em 0019.
create table if not exists public.org_branding (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  nome text,
  logo_url text,
  cor text,
  updated_at timestamptz not null default now()
);

alter table public.org_branding
  add column if not exists modo text not null default 'dark'
  check (modo in ('dark', 'light'));

comment on column public.org_branding.modo is 'Tema dos e-mails da conta: dark (padrão) | light.';
