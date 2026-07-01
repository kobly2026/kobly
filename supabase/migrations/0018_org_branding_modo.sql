-- Kobly — tema do e-mail por conta (claro/escuro).
-- Coluna aditiva em org_branding: define o fundo dos e-mails enviados aos leads.
-- 'dark' (padrão, identidade Kobly) | 'light'.

alter table public.org_branding
  add column if not exists modo text not null default 'dark'
  check (modo in ('dark', 'light'));

comment on column public.org_branding.modo is 'Tema dos e-mails da conta: dark (padrão) | light.';
