-- 0047_bulk_dedup_refund.sql
-- Auditoria E2E (Disparo em massa):
--  A1 — a dedup era SELECT-depois-INSERT (não atômica): dois requests concorrentes
--       criavam 2 cabeçalhos → cada lead recebia 2 mensagens + cota cobrada 2×.
--       Fix: índice ÚNICO PARCIAL sobre (dedup_key) enquanto o disparo está ativo
--       — dois disparos idênticos simultâneos deixam de ser possíveis (o 2º INSERT
--       falha com 23505 e o edge devolve o disparo existente).
--  A2 — a reserva de uso (estimativa da audiência) nunca era estornada em falha,
--       cancelamento, pulados ou falhados → o saldo do plano drenava de forma
--       inflada e irreversível. Fix: registra uso_reservado no cabeçalho e liquida
--       para o total REALMENTE ENVIADO quando o disparo chega a estado terminal
--       (concluido/cancelado), estornando a diferença (idempotente).
-- ---------------------------------------------------------------------------

alter table public.bulk_sends
  add column if not exists dedup_key     text,
  add column if not exists uso_reservado int not null default 0,
  add column if not exists uso_estornado int not null default 0;

-- dedup_key determinístico: org + canal + template + filtro (jsonb::text é canônico).
create or replace function public.tg_bulk_sends_dedup_key()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.dedup_key := md5(
    new.organization_id::text || '|' || coalesce(new.canal::text, '') || '|' ||
    coalesce(new.email_id::text, '') || coalesce(new.whatsapp_message_id::text, '') ||
    coalesce(new.sms_message_id::text, '') || '|' ||
    coalesce(new.filtro::text, '{}')
  );
  return new;
end;
$$;

drop trigger if exists trg_bulk_sends_dedup_key on public.bulk_sends;
create trigger trg_bulk_sends_dedup_key
  before insert on public.bulk_sends
  for each row execute function public.tg_bulk_sends_dedup_key();

-- Backfill dos cabeçalhos existentes (para o índice não falhar com dedup_key nulo).
update public.bulk_sends set dedup_key = md5(
  organization_id::text || '|' || coalesce(canal::text, '') || '|' ||
  coalesce(email_id::text, '') || coalesce(whatsapp_message_id::text, '') ||
  coalesce(sms_message_id::text, '') || '|' || coalesce(filtro::text, '{}')
) where dedup_key is null;

-- ÚNICO PARCIAL: no máximo 1 disparo ATIVO por dedup_key. Ao concluir/cancelar/falhar,
-- o índice deixa de cobrir a linha → um novo disparo idêntico é permitido depois.
create unique index if not exists uq_bulk_sends_active_dedup
  on public.bulk_sends (dedup_key)
  where status in ('enfileirando', 'enviando');

-- Estorno pontual de uso (service_role only). Piso em 0.
create or replace function public.bulk_release_usage(p_org uuid, p_n int)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.usage_counters
     set numero_execucoes = greatest(0, numero_execucoes - greatest(0, coalesce(p_n, 0))),
         updated_at = now()
   where organization_id = p_org;
end;
$$;
revoke all on function public.bulk_release_usage(uuid, int) from public, anon, authenticated;
grant execute on function public.bulk_release_usage(uuid, int) to service_role;

-- Liquidação idempotente: estorna (uso_reservado - enviados) ainda não estornado.
-- Chamada quando o disparo fica terminal (process-bulk ao concluir; bulk-send ao cancelar).
create or replace function public.bulk_settle_usage(p_bulk uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_org    uuid;
  v_res    int;
  v_env    int;
  v_est    int;
  v_target int;
  v_delta  int;
begin
  select organization_id, uso_reservado, enviados, uso_estornado
    into v_org, v_res, v_env, v_est
    from public.bulk_sends where id = p_bulk;
  if v_org is null then return; end if;

  v_target := greatest(0, coalesce(v_res, 0) - coalesce(v_env, 0));
  v_delta  := v_target - coalesce(v_est, 0);
  if v_delta > 0 then
    update public.usage_counters
       set numero_execucoes = greatest(0, numero_execucoes - v_delta),
           updated_at = now()
     where organization_id = v_org;
    update public.bulk_sends set uso_estornado = v_target where id = p_bulk;
  end if;
end;
$$;
revoke all on function public.bulk_settle_usage(uuid) from public, anon, authenticated;
grant execute on function public.bulk_settle_usage(uuid) to service_role;
