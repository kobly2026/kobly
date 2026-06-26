-- 0005_events_automation_support.sql
-- Kobly — eventos, motor de automação (fila) e suporte.
-- webhook_events, email_events, scheduled_steps,
-- support_conversations, support_messages, error_logs, faq.
-- ---------------------------------------------------------------------------

-- webhook_events (WebhookDados; append-only; idempotência via unique) ------
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  webhook_id uuid references public.webhooks(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  provider text,
  tipo_evento public.tipo_evento,
  id_webhook text,                            -- idempotência
  email extensions.citext,
  nome_comprador text,
  sobrenome_comprador text,
  telefone text,
  endereco_comprador text,
  produto text,
  valor_produto numeric(10,2),
  metodo_pagamento text,
  pix_gerado boolean not null default false,
  payload jsonb,
  created_at timestamptz not null default now(),
  -- Idempotência de ingestão. NULLS NOT DISTINCT (PG15+) garante que
  -- (NULL, 'x') colida com (NULL, 'x'): após excluir um webhook (webhook_id
  -- vira NULL via on delete set null) a dedup por id_webhook continua valendo.
  -- Sem isso, NULLs seriam tratados como distintos e duplicariam eventos.
  unique nulls not distinct (webhook_id, id_webhook)
);

-- email_events (eventos SendGrid; append-only) -----------------------------
create table public.email_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  lead_metric_id uuid references public.lead_metrics(id) on delete set null,
  event text,
  email extensions.citext,
  sg_event_id text,        -- dedup via índice unique parcial abaixo (NULLs não colidem)
  sg_message_id text,
  status text,
  reason text,
  response text,
  url text,
  ip inet,
  user_agent text,
  "timestamp" timestamptz,
  created_at timestamptz not null default now()
);

-- scheduled_steps (FILA do motor de automação) ----------------------------
create table public.scheduled_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  step_id uuid references public.flow_steps(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  webhook_event_id uuid references public.webhook_events(id) on delete set null,
  status_agendamento public.status_agendamento not null default 'Iniciado',
  run_at timestamptz not null default now(),
  id_agendamento text,
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- support_conversations (ConversaChat) -------------------------------------
create table public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  cliente_id uuid references public.profiles(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  assunto text,
  tipo_chamado public.tipo_chamado,
  prioridade_chamado public.prioridade_chamado not null default 'Média',
  status_chamado public.status_chamado not null default 'Em andamento',
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- support_messages (MensagemChat; append-only) -----------------------------
create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  autor public.autor_mensagem not null,
  profile_id uuid references public.profiles(id) on delete set null,
  nome text,
  mensagem text,
  arquivos jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- error_logs (append-only; admin only) -------------------------------------
create table public.error_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  tipo_erro text,
  contexto jsonb,
  created_at timestamptz not null default now()
);

-- faq (conteúdo global) ----------------------------------------------------
create table public.faq (
  id uuid primary key default gen_random_uuid(),
  pergunta text not null,
  resposta text not null,
  ordem int not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
