-- 0042 — Reserva de uso ATÔMICA para o disparo em massa (corrige furo de limite de plano).
-- Antes: bulk-send checava usage_counters e incrementava em passos separados (read-modify-write),
-- tolerando linha ausente na checagem mas pulando o incremento se a linha não existisse
-- (managed orgs nunca acumulavam → limite furável) + TOCTOU/lost-update em chamadas concorrentes.
-- Agora: uma função faz upsert da linha + incremento condicional atômico (trava a linha).
create or replace function public.bulk_reserve_usage(p_org uuid, p_n int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plano  uuid;
  v_limite int;
begin
  select plano_id into v_plano from public.organizations where id = p_org;
  select limite_execucoes into v_limite from public.plans where id = v_plano;

  -- Garante a linha do contador (managed orgs podem não ter — só onboarding self-service cria).
  insert into public.usage_counters (organization_id, numero_execucoes, periodo_inicio)
    values (p_org, 0, current_date)
    on conflict (organization_id) do nothing;

  -- Incremento ATÔMICO respeitando o limite. O UPDATE trava a linha → chamadas concorrentes
  -- serializam (sem TOCTOU/lost-update). Sem plano/limite (null ou <=0) = sem teto.
  update public.usage_counters
     set numero_execucoes = numero_execucoes + greatest(0, coalesce(p_n, 0)),
         updated_at = now()
   where organization_id = p_org
     and (v_limite is null or v_limite <= 0
          or numero_execucoes + greatest(0, coalesce(p_n, 0)) <= v_limite);

  return found; -- true = reservado (dentro do limite); false = estouraria o plano
end;
$$;

revoke all on function public.bulk_reserve_usage(uuid, int) from public, anon, authenticated;
grant execute on function public.bulk_reserve_usage(uuid, int) to service_role;
