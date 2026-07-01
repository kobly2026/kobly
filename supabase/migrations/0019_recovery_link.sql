-- Kobly — link de recuperação no botão do e-mail.
-- O botão dos e-mails usa o token {{cta_link}}, trocado no envio (process-steps) por:
--   leads.link_recuperacao  (link do carrinho/checkout que o postback trouxe) >
--   org_branding.link_loja  (URL de fallback da loja, configurada na aba Marca) > '#'.
-- webhook_events.checkout_url guarda o link daquele evento (auditoria/timeline).

alter table public.webhook_events add column if not exists checkout_url text;
alter table public.leads         add column if not exists link_recuperacao text;
alter table public.org_branding  add column if not exists link_loja text;

comment on column public.webhook_events.checkout_url  is 'Link de recuperação/checkout extraído do payload deste evento.';
comment on column public.leads.link_recuperacao       is 'Último link de recuperação/checkout do lead (destino do botão do e-mail).';
comment on column public.org_branding.link_loja       is 'URL de fallback da loja/checkout para o botão dos e-mails.';
