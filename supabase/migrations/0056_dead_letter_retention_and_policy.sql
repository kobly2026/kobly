-- 0056_dead_letter_retention_and_policy.sql
-- Achados dos revisores (Tarefa 3e) sobre webhook_dead_letter (0054):
-- (1) RETENÇÃO: a tabela cresce sem teto (payload cru por evento não mapeado/insert
--     falho). Expurgo diário via pg_cron (mesmo padrão de 0045_usage_reset_cron:
--     função SQL + cron.schedule), retendo 60 dias.
-- (2) POLICY: webhook_dead_letter_read foi criada em 0054 SEM cláusula `to` —
--     `for select using (...)` vale para o role PUBLIC (inclui `anon`), diferente
--     de webhook_events/email_events, que usam `to authenticated`. Recria como
--     `for select to authenticated`.
-- ---------------------------------------------------------------------------

-- (1) Expurgo com retenção de 60 dias.
create or replace function public.purge_webhook_dead_letter()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows int;
begin
  delete from public.webhook_dead_letter
   where created_at < (now() - interval '60 days');
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

revoke all on function public.purge_webhook_dead_letter() from public, anon, authenticated;
grant execute on function public.purge_webhook_dead_letter() to service_role;

-- Cron diário às 03:30 UTC (idempotente por nome; 30min depois do
-- kobly-reset-usage-cycles das 03:00 para não competir por I/O).
select cron.schedule(
  'kobly-purge-webhook-dead-letter',
  '30 3 * * *',
  $$ select public.purge_webhook_dead_letter(); $$
);

-- (2) Corrige a policy de leitura: TO authenticated (era PUBLIC/anon por omissão do `to`).
drop policy if exists webhook_dead_letter_read on public.webhook_dead_letter;
create policy webhook_dead_letter_read on public.webhook_dead_letter
  for select to authenticated
  using (
    organization_id is not null
    and public.has_org_access(organization_id)
  );
