-- 0038_sms_tables.sql
-- Kobly — SMS (Twilio) como canal do motor. Espelha 0021 (WhatsApp):
--   sms_messages  ← whatsapp_messages
--   flow_steps.sms_message_id ← whatsapp_message_id
--   email_events.channel ganha 'sms'
--   campaign_stats.sms_enviados ← whatsapp_enviados (separado de emails_enviados)
-- Requer 0037 (enum 'Envio de SMS') aplicado antes — o card usa o valor do enum.
-- ALTER/INDEX idempotentes (if not exists).
-- ---------------------------------------------------------------------------

-- sms_messages (templates de SMS por org) ------------------------------------
create table if not exists public.sms_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  titulo text,
  corpo_texto text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at automático (padrão 0006)
drop trigger if exists set_updated_at on public.sms_messages;
create trigger set_updated_at before update on public.sms_messages
  for each row execute function public.tg_set_updated_at();

-- flow_steps: referência à mensagem do card (espelha whatsapp_message_id, 0021) -
alter table public.flow_steps
  add column if not exists sms_message_id uuid references public.sms_messages(id) on delete set null;

-- email_events: relaxar o domínio do canal para incluir 'sms' -----------------
-- (o check é nomeado em 0021; troca-se por um que aceite os três canais).
alter table public.email_events drop constraint if exists email_events_channel_check;
alter table public.email_events
  add constraint email_events_channel_check check (channel in ('email', 'whatsapp', 'sms'));

comment on column public.email_events.channel is 'Canal do evento: email (padrão) | whatsapp | sms.';

-- campaign_stats: contador de SMS separado (mesma razão do whatsapp_enviados) --
alter table public.campaign_stats
  add column if not exists sms_enviados int not null default 0;

comment on column public.campaign_stats.sms_enviados is 'SMS enviados na campanha; separado de emails_enviados (denominador de taxa_abertura/ctr).';

-- RLS (espelha whatsapp_messages_all, 0021) ----------------------------------
alter table public.sms_messages enable row level security;

drop policy if exists sms_messages_all on public.sms_messages;
create policy sms_messages_all on public.sms_messages for all to authenticated
using (public.has_org_access(organization_id))
with check (public.has_org_access(organization_id));

-- Índices em colunas FK / RLS (padrão 0008) ----------------------------------
create index if not exists idx_sms_messages_organization_id on public.sms_messages (organization_id);
create index if not exists idx_sms_messages_created_by on public.sms_messages (created_by);
create index if not exists idx_flow_steps_sms_message_id on public.flow_steps (sms_message_id);
