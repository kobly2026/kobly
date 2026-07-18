-- 0045_usage_reset_cron.sql
-- Auditoria E2E (Billing ALTO 1): o contador de uso "por mês" nunca resetava —
-- numero_execucoes só incrementava e periodo_inicio era gravado uma vez, virando
-- um TETO VITALÍCIO. Aqui: função de rollover mensal + pg_cron diário.
-- (asaas_activate_plan também reseta ao confirmar pagamento — este cron cobre o
--  ciclo recorrente independente de evento de pagamento.)
-- ---------------------------------------------------------------------------

create or replace function public.reset_usage_cycles()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows int;
begin
  -- Rola o período de quem completou 1 mês: zera execuções e reinicia o ciclo.
  update public.usage_counters
     set numero_execucoes = 0,
         periodo_inicio   = current_date,
         updated_at       = now()
   where periodo_inicio is null
      or periodo_inicio <= (current_date - interval '1 month');
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

revoke all on function public.reset_usage_cycles() from public, anon, authenticated;
grant execute on function public.reset_usage_cycles() to service_role;

-- Cron diário às 03:00 UTC (idempotente por nome). Roda direto no banco (SQL puro).
select cron.schedule(
  'kobly-reset-usage-cycles',
  '0 3 * * *',
  $$ select public.reset_usage_cycles(); $$
);
