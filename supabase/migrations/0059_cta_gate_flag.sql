-- 0059_cta_gate_flag.sql
-- Chave de desligamento do gate de CTA sem link (ver process-steps).
-- Default "false": o código sobe inerte e o comportamento não muda até alguém
-- ligar. Motivo: o gate só faz sentido depois que o postback voltar a trazer o
-- link de checkout; ligado antes, ele pula em massa os passos de recuperação de
-- Pix. Sem esta chave, a única reversão de um falso positivo seria um deploy.
-- Ligar com:  select vault.update_secret((select id from vault.secrets where name='cta_gate_enabled'), 'true');
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'cta_gate_enabled') then
    perform vault.create_secret('false', 'cta_gate_enabled', 'Liga o gate que impede envio de passo de recuperacao sem link utilizavel no CTA');
  end if;
end $$;
