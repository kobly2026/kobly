-- 0050_org_reply_to.sql
-- Endereço de Reply-To por organização (opcional). Quando setado, os envios de
-- e-mail incluem reply_to = este endereço, para que respostas cheguem ao cliente
-- em vez do domínio da plataforma. Vazio → sem Reply-To.
-- ---------------------------------------------------------------------------
alter table public.organizations
  add column if not exists reply_to_email text;
