-- 0055 — Estorno de cota para scheduled_steps (worker de automação).
-- process-steps reserva 1 unidade (bulk_reserve_usage) ANTES de tentar enviar, mas até
-- aqui não havia contrapartida de estorno para essa fila — bulk_settle_usage existe, só
-- que é keyed por p_bulk (bulk_sends) e não se aplica a scheduled_steps. Resultado: um
-- e-mail/WhatsApp/SMS que termina em falha DEFINITIVA (4xx fatal ou esgotou
-- MAX_ATTEMPTS) fica com a cota consumida e zero entrega.
-- Esta função é o estorno SIMÉTRICO de bulk_reserve_usage: decrementa numero_execucoes
-- de forma segura, nunca abaixo de zero (greatest(0, ...)). Mesmo padrão de
-- security definer + search_path fixo + grant restrito a service_role de 0042.
create or replace function public.scheduled_step_release_usage(p_org uuid, p_n int default 1)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_org is null then
    return;
  end if;

  update public.usage_counters
     set numero_execucoes = greatest(0, numero_execucoes - greatest(0, coalesce(p_n, 0))),
         updated_at = now()
   where organization_id = p_org;
end;
$$;

revoke all on function public.scheduled_step_release_usage(uuid, int) from public, anon, authenticated;
grant execute on function public.scheduled_step_release_usage(uuid, int) to service_role;
