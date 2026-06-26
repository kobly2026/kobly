-- 0004_campaigns_flows_stats.sql
-- Kobly — campanhas, fluxos, etapas, estatísticas e IA.
-- campaigns, campaign_flows, flow_meta_tags, flow_steps, step_*_tags,
-- campaign_stats, dashboard_stats, ai_suggestions.
-- Também fecha a FK pendente lead_metrics.etapa_email_origem_id -> flow_steps.
-- ---------------------------------------------------------------------------

-- campaigns ----------------------------------------------------------------
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  nome text not null,
  status_campanha public.status_campanha not null default 'Rascunho',
  usa_template boolean not null default false,
  template_id uuid references public.templates(id) on delete set null,
  criador_id uuid references public.profiles(id) on delete set null,
  legacy_id text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- campaign_flows (1:1 com campaign) ----------------------------------------
create table public.campaign_flows (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid unique references public.campaigns(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- flow_meta_tags (tags-meta que encerram o fluxo) --------------------------
create table public.flow_meta_tags (
  flow_id uuid not null references public.campaign_flows(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (flow_id, tag_id)
);

-- flow_steps (cards do fluxo) ----------------------------------------------
create table public.flow_steps (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.campaign_flows(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  tipo_card public.tipo_card_fluxo not null,
  nome text,
  posicao int not null default 0,
  atraso int not null default 0,             -- minutos
  email_id uuid references public.emails(id) on delete set null,
  tipo_evento public.tipo_evento,            -- Gatilho
  webhook_id uuid references public.webhooks(id) on delete set null,  -- Gatilho
  fluxo_alvo_id uuid references public.campaign_flows(id) on delete set null, -- Acionar Fluxo
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Fecha a FK pendente de 0003: lead_metrics.etapa_email_origem_id -> flow_steps
alter table public.lead_metrics
  add constraint lead_metrics_etapa_email_origem_id_fkey
  foreign key (etapa_email_origem_id) references public.flow_steps(id) on delete set null;

-- step_trigger_tags (Gatilho) ----------------------------------------------
create table public.step_trigger_tags (
  step_id uuid not null references public.flow_steps(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (step_id, tag_id)
);

-- step_add_tags (Adicionar Tag) --------------------------------------------
create table public.step_add_tags (
  step_id uuid not null references public.flow_steps(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (step_id, tag_id)
);

-- step_remove_tags (Remover Tag) -------------------------------------------
create table public.step_remove_tags (
  step_id uuid not null references public.flow_steps(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (step_id, tag_id)
);

-- campaign_stats (1:1 com campaign) ----------------------------------------
create table public.campaign_stats (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid unique references public.campaigns(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  taxa_abertura numeric(6,4) not null default 0,
  ctr numeric(6,4) not null default 0,
  emails_enviados int not null default 0,
  vendas_recuperadas int not null default 0,
  valor_criticidade numeric(6,4) not null default 0,
  status_criticidade public.status_criticidade not null default 'Não Iniciado',
  gerando_sugestao boolean not null default false,
  ultimo_calculo timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- dashboard_stats (consolidado por org/profile) ----------------------------
create table public.dashboard_stats (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  total_contas_gerenciadas int not null default 0,
  total_campanhas_ativas int not null default 0,
  taxa_abertura_todas numeric(6,4) not null default 0,
  ctr_todas numeric(6,4) not null default 0,
  vendas_recuperadas_todas int not null default 0,
  gerando_sugestao boolean not null default false,
  ultimo_calculo timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ai_suggestions (escopo campanha|dashboard) -------------------------------
create table public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  escopo text,                               -- campanha | dashboard
  campaign_stats_id uuid references public.campaign_stats(id) on delete cascade,
  dashboard_stats_id uuid references public.dashboard_stats(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  sugestao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
