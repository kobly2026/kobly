-- 0031_campaign_postback_token.sql
-- WEB-1: vínculo de campanha → webhook/postback nomeado.
-- Permite que cada campanha seja disparada APENAS por um token específico
-- (ex.: "Hotmart - Produto A"), mantendo retrocompatibilidade total:
-- campanhas sem vínculo (NULL) continuam disparando para qualquer token da org.
-- ---------------------------------------------------------------------------

alter table public.campaigns
  add column if not exists postback_token_id uuid
    references public.postback_tokens(id) on delete set null;

create index if not exists idx_campaigns_postback_token
  on public.campaigns(postback_token_id)
  where postback_token_id is not null;

comment on column public.campaigns.postback_token_id is
  'WEB-1: token de postback específico que dispara esta campanha. NULL = qualquer token da org (padrão retrocompatível).';
