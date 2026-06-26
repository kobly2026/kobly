-- 0016_webhook_providers.sql
-- Ciclo 1 — ingestão de checkout multi-plataforma.
-- Adiciona em `webhooks`:
--   • provider       — qual plataforma de checkout (generic|nexopayt|hotmart|kiwify|perfectpay|kactus).
--                      É TEXTO validado pelo registry de adaptadores na edge function `webhook-receiver`;
--                      NÃO é enum de propósito (pra não exigir migration a cada nova plataforma).
--   • signing_secret — chave usada para verificar a assinatura (HMAC) do postback da plataforma,
--                      quando ela assina. NULL = sem verificação de assinatura (ex.: caminho generic legado).
-- Aditivo e idempotente; webhooks existentes ficam provider='generic' (caminho legado preservado).
alter table public.webhooks
  add column if not exists provider text not null default 'generic',
  add column if not exists signing_secret text;

comment on column public.webhooks.provider is
  'Plataforma de checkout do webhook (generic|nexopayt|hotmart|kiwify|perfectpay|kactus). Validado pelo registry de adaptadores em webhook-receiver; não é enum.';
comment on column public.webhooks.signing_secret is
  'Chave para verificar a assinatura (HMAC) do postback da plataforma, quando assinado. NULL = sem verificação.';
