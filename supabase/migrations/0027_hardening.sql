-- 0027 — Hardening pré-lançamento (endereça os WARNs reais dos security advisors).
--
-- Contexto de cada revoke:
-- - create_postback_token: chamado pelo FRONTEND autenticado (Integrações) →
--   authenticated mantém EXECUTE; anon não tem por que chamar.
-- - validate_postback_token: chamado APENAS pelo postback-receiver (edge function,
--   service role) → nem anon nem authenticated precisam.
-- - tg_profiles_guard / tg_organizations_guard / handle_new_user: são trigger
--   functions — executam pelo dono da tabela via trigger; expostas como RPC eram
--   só ruído/attack surface.
--
-- WARNs conscientes que NÃO são tratados aqui:
-- - pg_net em public: mover a extensão pode quebrar referências de funções/cron —
--   fica para uma janela de manutenção dedicada.
-- - leaked password protection: configuração do Auth (dashboard), não SQL —
--   item do checklist de go-live.
-- - helpers is_admin/is_support/is_gestor/my_org_ids/has_org_access/current_*:
--   EXECUTE por authenticated é intencional (usados em RLS e pelo app).
-- - ai_usage com RLS sem policy: intencional — só o service role escreve/lê.

revoke execute on function public.create_postback_token(uuid, text) from anon;

revoke execute on function public.validate_postback_token(text) from anon;
revoke execute on function public.validate_postback_token(text) from authenticated;

revoke all on function public.tg_profiles_guard() from public;
revoke all on function public.tg_profiles_guard() from anon;
revoke all on function public.tg_profiles_guard() from authenticated;

revoke all on function public.tg_organizations_guard() from public;
revoke all on function public.tg_organizations_guard() from anon;
revoke all on function public.tg_organizations_guard() from authenticated;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;
