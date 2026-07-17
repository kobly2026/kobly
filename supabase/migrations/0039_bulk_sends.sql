-- 0039_bulk_sends.sql
-- Kobly — Disparo em massa (email / WhatsApp / SMS) para listas de leads.
-- Modelo próprio (bulk_sends + bulk_send_recipients) drenado por um worker
-- dedicado (process-bulk), SEPARADO de scheduled_steps/process-steps:
--  - scheduled_steps exige flow_step→campaign_flow→campaign (um disparo não é
--    campanha); sintetizar isso poluiria CRM e campaign_stats.
--  - o cron de recuperação (process-steps) é sensível a latência; um blast de 50k
--    não pode disputar seu orçamento de 100 linhas/min.
-- Confiabilidade herda o modelo de process-steps (status + attempts + backoff).
-- Requer 0038 (sms_messages) aplicado antes (FK sms_message_id).
-- ---------------------------------------------------------------------------

-- Cabeçalho do disparo --------------------------------------------------------
create table if not exists public.bulk_sends (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  canal public.tipo_envio not null,                    -- 'email' | 'Whatsapp' | 'SMS'
  email_id uuid references public.emails(id) on delete set null,
  whatsapp_message_id uuid references public.whatsapp_messages(id) on delete set null,
  sms_message_id uuid references public.sms_messages(id) on delete set null,
  filtro jsonb not null default '{}'::jsonb,           -- {tag_ids?, evento?}
  status text not null default 'rascunho',             -- rascunho|enfileirando|enviando|concluido|falhou|cancelado
  total int not null default 0,
  enviados int not null default 0,
  falhados int not null default 0,
  pulados int not null default 0,
  rate_por_min int not null default 60,                -- pacing (respeita limites do provedor)
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.bulk_sends;
create trigger set_updated_at before update on public.bulk_sends
  for each row execute function public.tg_set_updated_at();

-- Destinatários (fila por lead) -----------------------------------------------
create table if not exists public.bulk_send_recipients (
  id uuid primary key default gen_random_uuid(),
  bulk_send_id uuid not null references public.bulk_sends(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  destino text,                                        -- snapshot: e-mail ou telefone
  status text not null default 'pendente',             -- pendente|processando|enviado|falhou|pulado
  attempts int not null default 0,
  last_error text,
  sg_message_id text,
  run_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (bulk_send_id, lead_id)                        -- idempotência: 1 linha por lead
);

-- RLS (espelha o padrão has_org_access) ---------------------------------------
alter table public.bulk_sends enable row level security;
alter table public.bulk_send_recipients enable row level security;

drop policy if exists bulk_sends_all on public.bulk_sends;
create policy bulk_sends_all on public.bulk_sends for all to authenticated
using (public.has_org_access(organization_id))
with check (public.has_org_access(organization_id));

drop policy if exists bulk_send_recipients_all on public.bulk_send_recipients;
create policy bulk_send_recipients_all on public.bulk_send_recipients for all to authenticated
using (public.has_org_access(organization_id))
with check (public.has_org_access(organization_id));

-- Índices ---------------------------------------------------------------------
create index if not exists idx_bulk_sends_org_status on public.bulk_sends (organization_id, status);
create index if not exists idx_bulk_send_recipients_bulk on public.bulk_send_recipients (bulk_send_id, status);
create index if not exists idx_bulk_send_recipients_due on public.bulk_send_recipients (status, run_at) where status = 'pendente';
create index if not exists idx_bulk_send_recipients_org on public.bulk_send_recipients (organization_id);

-- ===========================================================================
-- Audiência: contagem e enfileiramento (fan-out server-side a partir do filtro).
-- Filtro suportado: { tag_ids: uuid[]?, evento: text? }. Sem filtros → todos os
-- leads da org com destino válido para o canal (email não-nulo / telefone não-nulo).
-- ===========================================================================
create or replace function public.bulk_count_audience(p_org uuid, p_canal public.tipo_envio, p_filter jsonb)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
    from public.leads l
   where l.organization_id = p_org
     and (
       case when p_canal = 'email' then l.email is not null and l.email::text <> ''
            else l.telefone is not null and l.telefone <> '' end
     )
     and (
       not (p_filter ? 'tag_ids') or jsonb_typeof(p_filter->'tag_ids') <> 'array'
       or exists (
         select 1 from public.lead_tags lt
          where lt.lead_id = l.id
            and lt.tag_id = any (array(select (x)::uuid from jsonb_array_elements_text(p_filter->'tag_ids') x))
       )
     )
     and (nullif(p_filter->>'evento','') is null or l.ultimo_evento::text = (p_filter->>'evento'));
$$;

-- Só service_role (edge `bulk-send`, que já valida acesso à org) chama — p_org é
-- arbitrário, então NÃO exponha a authenticated (evita contar leads de outra org).
revoke all on function public.bulk_count_audience(uuid, public.tipo_envio, jsonb) from public, anon, authenticated;
grant execute on function public.bulk_count_audience(uuid, public.tipo_envio, jsonb) to service_role;

create or replace function public.bulk_enqueue_recipients(p_bulk_send_id uuid, p_filter jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org   uuid;
  v_canal public.tipo_envio;
  v_rate  int;
  v_count int;
begin
  select organization_id, canal, greatest(1, coalesce(rate_por_min, 60))
    into v_org, v_canal, v_rate
    from public.bulk_sends where id = p_bulk_send_id;
  if v_org is null then raise exception 'bulk_send não encontrado'; end if;

  insert into public.bulk_send_recipients (bulk_send_id, organization_id, lead_id, destino, run_at)
  select p_bulk_send_id, v_org, l.id,
         case when v_canal = 'email' then l.email::text else l.telefone end,
         -- escalona o envio p/ respeitar rate_por_min: v_rate por minuto.
         now() + (floor((row_number() over (order by l.created_at desc) - 1) / v_rate))::int * interval '1 minute'
    from public.leads l
   where l.organization_id = v_org
     and (
       case when v_canal = 'email' then l.email is not null and l.email::text <> ''
            else l.telefone is not null and l.telefone <> '' end
     )
     and (
       not (p_filter ? 'tag_ids') or jsonb_typeof(p_filter->'tag_ids') <> 'array'
       or exists (
         select 1 from public.lead_tags lt
          where lt.lead_id = l.id
            and lt.tag_id = any (array(select (x)::uuid from jsonb_array_elements_text(p_filter->'tag_ids') x))
       )
     )
     and (nullif(p_filter->>'evento','') is null or l.ultimo_evento::text = (p_filter->>'evento'))
  on conflict (bulk_send_id, lead_id) do nothing;

  get diagnostics v_count = row_count;
  update public.bulk_sends set total = v_count, updated_at = now() where id = p_bulk_send_id;
  return v_count;
end;
$$;

-- Só o edge control (service_role, que já faz assertOrgAccess) enfileira. Inclui
-- 'authenticated' no revoke: o Supabase concede EXECUTE a authenticated por padrão,
-- e esta função SECURITY DEFINER não valida o acesso do caller à org.
revoke all on function public.bulk_enqueue_recipients(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.bulk_enqueue_recipients(uuid, jsonb) to service_role;

-- ===========================================================================
-- Cron: drena process-bulk a cada minuto (mesmo padrão de 0015).
-- ===========================================================================
select cron.schedule(
  'kobly-process-bulk',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://hvkuymprmfrjrgpqaxbw.supabase.co/functions/v1/process-bulk',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3V5bXBybWZyanJncHFheGJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NDg0MjgsImV4cCI6MjA5ODAyNDQyOH0.4JR1XTwfXv0x8QAgLd9y6K6nHJem0v_qi0QGUvxs1J4'
    ),
    body := '{}'::jsonb
  );
  $$
);
