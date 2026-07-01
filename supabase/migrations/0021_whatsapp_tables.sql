-- 0021_whatsapp_tables.sql
-- Kobly — WhatsApp (Z-API) como canal completo do motor.
-- whatsapp_messages espelha emails (0003); flow_steps.whatsapp_message_id espelha
-- email_id (0004); email_events.channel diferencia o canal ('email' | 'whatsapp'),
-- reusando a tabela de auditoria/métricas existente (menor superfície que criar
-- uma tabela nova de eventos).
-- ALTER/INDEX idempotentes (if not exists), padrão 0016/0018/0019.
-- ---------------------------------------------------------------------------

-- whatsapp_messages (MensagensWhatsAppUsuário) ------------------------------
create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  titulo text,
  corpo_texto text,
  media_url text,
  legacy_id text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at automático (padrão 0006)
create trigger set_updated_at before update on public.whatsapp_messages
  for each row execute function public.tg_set_updated_at();

-- flow_steps: referência à mensagem do card (espelha email_id, 0004) ---------
alter table public.flow_steps
  add column if not exists whatsapp_message_id uuid references public.whatsapp_messages(id) on delete set null;

-- email_events: canal do evento ----------------------------------------------
alter table public.email_events
  add column if not exists channel text not null default 'email';

-- Domínio fechado: consumido por SQL de métricas e dashboard — valor fora de
-- 'email'/'whatsapp' quebraria as agregações silenciosamente.
alter table public.email_events
  add constraint email_events_channel_check check (channel in ('email', 'whatsapp'));

comment on column public.email_events.channel is 'Canal do evento: email (padrão) | whatsapp.';

-- campaign_stats: contador de WhatsApp separado ------------------------------
-- NÃO reaproveitar emails_enviados: ele é o denominador de taxa_abertura/ctr
-- (métricas exclusivas de e-mail) e seria poluído por envios de WhatsApp.
alter table public.campaign_stats
  add column if not exists whatsapp_enviados int not null default 0;

comment on column public.campaign_stats.whatsapp_enviados is 'Mensagens WhatsApp enviadas na campanha; separado de emails_enviados (denominador de taxa_abertura/ctr).';

-- RLS (espelha emails_all, 0007) ---------------------------------------------
alter table public.whatsapp_messages enable row level security;

create policy whatsapp_messages_all on public.whatsapp_messages for all to authenticated
using (public.has_org_access(organization_id))
with check (public.has_org_access(organization_id));

-- Índices em colunas FK / RLS (padrão 0008) ----------------------------------
create index if not exists idx_whatsapp_messages_organization_id on public.whatsapp_messages (organization_id);
create index if not exists idx_whatsapp_messages_created_by on public.whatsapp_messages (created_by);
create index if not exists idx_flow_steps_whatsapp_message_id on public.flow_steps (whatsapp_message_id);

-- Lookup dos webhooks públicos (zapi-webhook e resend-webhook buscam por
-- igualdade em sg_message_id a cada callback; parcial, NULLs fora do índice)
create index if not exists idx_email_events_sg_message_id
  on public.email_events (sg_message_id)
  where sg_message_id is not null;

-- dedup Z-API: callbacks de status repetidos para a mesma mensagem colidem aqui;
-- a progressão enviado → entregue → lido continua permitida (status distintos).
-- O zapi-webhook ignora o erro de insert, então a dedup é transparente.
create unique index if not exists uq_email_events_wa_status
  on public.email_events (sg_message_id, status)
  where channel = 'whatsapp' and event = 'status' and sg_message_id is not null;
