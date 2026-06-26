-- 0003_crm_and_email.sql
-- Kobly — CRM e infraestrutura de e-mail.
-- tags, leads, lead_tags, lead_metrics, templates, domains, domain_dns_records,
-- emails, webhooks, webhook_event_types.
-- NOTA: lead_metrics referencia flow_steps, criada em 0004. A FK
-- etapa_email_origem_id é adicionada em 0004 via ALTER (flow_steps ainda não existe aqui).
-- ---------------------------------------------------------------------------

-- tags (TagsUsuário) -------------------------------------------------------
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  nome text not null,
  descricao text,
  tipo_evento public.tipo_evento,
  legacy_id text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- leads (CRM) --------------------------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  nome text,
  sobrenome text,
  email extensions.citext,
  telefone text,
  endereco text,
  produto text,
  valor_compra numeric(10,2),
  metodo_pagamento text,
  pix_gerado boolean not null default false,
  ultimo_evento public.tipo_evento,
  legacy_id text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- lead_tags (junction) -----------------------------------------------------
create table public.lead_tags (
  lead_id uuid not null references public.leads(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (lead_id, tag_id)
);

-- lead_metrics (etapa_email_origem_id -> flow_steps adicionada em 0004) ----
create table public.lead_metrics (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  etapa_email_origem_id uuid,                  -- FK -> flow_steps(id) adicionada em 0004
  codigo_sendgrid text,
  enviados int not null default 0,
  aberturas int not null default 0,
  cliques int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- templates (globais têm organization_id null) ----------------------------
create table public.templates (
  id uuid primary key default gen_random_uuid(),
  tipo_template public.tipo_template not null,
  nome text not null,
  descricao text,
  icone text,
  blank boolean not null default false,
  gatilho public.tipo_evento,
  is_global boolean not null default true,
  organization_id uuid references public.organizations(id) on delete cascade,
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- domains (autenticação SendGrid) ------------------------------------------
create table public.domains (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  url text not null,
  validado boolean not null default false,
  id_sendgrid text,
  legacy_id text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- domain_dns_records (CNAME/TXT) -------------------------------------------
create table public.domain_dns_records (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid not null references public.domains(id) on delete cascade,
  tipo text not null,                          -- CNAME | TXT
  host text not null,
  valor text,
  status public.dns_record_status not null default 'pendente',
  record_role text,                            -- mail_cname | dkim1 | dkim2 | dmarc
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- emails (EmailsUsuário) ---------------------------------------------------
create table public.emails (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  titulo text,
  assunto text,
  corpo_html text,
  remetente text,
  dominio_id uuid references public.domains(id) on delete set null,
  legacy_id text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- webhooks (config de entrada e-commerce) ----------------------------------
create table public.webhooks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  nome text,
  descricao text,
  url text,
  secret text,
  payload text,
  testado boolean not null default false,
  desabilitado boolean not null default false,
  legacy_id text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- webhook_event_types (junction) -------------------------------------------
create table public.webhook_event_types (
  webhook_id uuid not null references public.webhooks(id) on delete cascade,
  tipo_evento public.tipo_evento not null,
  created_at timestamptz not null default now(),
  primary key (webhook_id, tipo_evento)
);
