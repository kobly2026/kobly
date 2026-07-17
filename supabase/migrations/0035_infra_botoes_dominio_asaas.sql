-- 0035 — Infra: botões WhatsApp, domínio Resend por org, Asaas e telefone de teste.
-- 1) whatsapp_messages.botoes jsonb — botões interativos (URL/CALL/REPLY) do Z-API
-- 2) domains: colunas Resend (id_resend, from_email, status) + backfill id_sendgrid→id_resend
-- 3) organizations.asaas_customer_id — vínculo gateway Asaas
-- 4) profiles.whatsapp_teste — número de celular focado em testes

-- ===========================================================================
-- 1) Botões interativos WhatsApp
-- ===========================================================================
alter table public.whatsapp_messages
  add column if not exists botoes jsonb not null default '[]'::jsonb;

comment on column public.whatsapp_messages.botoes is
  'Array de botões Z-API: [{id,type,label,url?,phone?}] type=URL|CALL|REPLY. URL pode usar {{cta_link}}.';

-- ===========================================================================
-- 2) Domínios de envio (Resend) por organização
-- ===========================================================================
alter table public.domains
  add column if not exists id_resend text,
  add column if not exists from_email text,
  add column if not exists status text not null default 'pending';

comment on column public.domains.id_resend is 'ID do domínio na API Resend (substitui id_sendgrid).';
comment on column public.domains.from_email is 'Remetente padrão ex.: contato@seudominio.com';
comment on column public.domains.status is 'pending | verified | failed (espelha Resend).';

-- Migra legado SendGrid id se ainda houver valor e id_resend vazio
update public.domains
   set id_resend = id_sendgrid
 where id_resend is null and id_sendgrid is not null;

update public.domains
   set status = case when validado then 'verified' else 'pending' end
 where status = 'pending' and validado = true;

-- ===========================================================================
-- 3) Asaas (gateway de pagamento)
-- ===========================================================================
alter table public.organizations
  add column if not exists asaas_customer_id text;

comment on column public.organizations.asaas_customer_id is
  'ID do cliente no Asaas (sandbox ou produção). Usado em cobranças de plano.';

-- ===========================================================================
-- 4) Telefone de teste WhatsApp no perfil
-- ===========================================================================
alter table public.profiles
  add column if not exists whatsapp_teste text;

comment on column public.profiles.whatsapp_teste is
  'Número de celular focado em testes de WhatsApp (E.164 sem +).';
