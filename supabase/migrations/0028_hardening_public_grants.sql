-- 0028 — Complemento da 0027: em Postgres, EXECUTE em função é concedido a PUBLIC
-- por default, e anon/authenticated HERDAM de PUBLIC — revogar só de anon (0027)
-- não fecha o buraco. Aqui: revoke de PUBLIC e re-grant apenas do necessário.

-- create_postback_token: o frontend autenticado chama (Integrações → gerar token).
revoke all on function public.create_postback_token(uuid, text) from public;
grant execute on function public.create_postback_token(uuid, text) to authenticated;

-- validate_postback_token: só o postback-receiver (service role) chama.
revoke all on function public.validate_postback_token(text) from public;
