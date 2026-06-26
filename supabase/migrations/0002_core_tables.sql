-- 0002_core_tables.sql
-- Kobly — núcleo / auth / billing.
-- plans, organizations, profiles, organization_memberships, usage_counters,
-- transactions, access_logs, active_sessions.
-- Auth DESACOPLADO: profiles.id é uuid próprio; profiles.auth_id referencia auth.users.
-- Resolve o ciclo organizations <-> profiles <-> plans com ALTER TABLE ADD CONSTRAINT no fim.
-- ---------------------------------------------------------------------------

-- plans (sem dependências) -------------------------------------------------
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  status public.status_planos not null default 'Ativo',
  valor_mensal numeric(10,2),
  valor_anual numeric(10,2),
  limite_campanhas int,
  limite_execucoes int,
  deleted boolean not null default false,
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- organizations (FK para profiles via ALTER; plano_id já pode referenciar plans) -----
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  segmento text,
  user_fundador_id uuid,                       -- FK -> profiles(id) adicionada via ALTER (ciclo)
  plano_id uuid references public.plans(id) on delete set null,
  criticidade public.status_criticidade not null default 'Não Iniciado',
  leads_count int not null default 0,
  campanhas_ativas_count int not null default 0,
  legacy_id text,
  created_by uuid,                             -- FK -> profiles(id) adicionada via ALTER (ciclo)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- profiles (referencia organizations e a si mesma) -------------------------
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid unique references auth.users(id) on delete set null,
  nome text not null,
  email extensions.citext unique not null,
  tipo_user_geral public.tipo_user_geral not null default 'Cliente',
  status_user public.status_user not null default 'Pendente',
  celular text,
  local text,
  ip_conexao inet,
  ultimo_login timestamptz,
  imagem_perfil text,
  perfil_completo boolean not null default false,
  organization_id uuid references public.organizations(id) on delete set null,
  gestor_responsavel_id uuid references public.profiles(id) on delete set null,
  curadoria text[] not null default '{}',
  legacy_id text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Resolução do ciclo de FK organizations <-> profiles ----------------------
alter table public.organizations
  add constraint organizations_user_fundador_id_fkey
  foreign key (user_fundador_id) references public.profiles(id) on delete set null;

alter table public.organizations
  add constraint organizations_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

-- organization_memberships (Gestor gerencia N orgs) ------------------------
create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.tipo_user_geral not null default 'Gestor',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, profile_id)
);

-- usage_counters (consumo do plano por org) --------------------------------
create table public.usage_counters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid unique references public.organizations(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  plano_id uuid references public.plans(id) on delete set null,
  numero_campanhas int not null default 0,
  numero_execucoes int not null default 0,
  periodo_inicio date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- transactions (cobrança) --------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  plano_id uuid references public.plans(id) on delete set null,
  valor_pago numeric(10,2),
  forma_pagamento text,
  status_pagamento public.status_pagamento not null default 'Pendente',
  id_transacao text,
  data date,
  legacy_id text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- access_logs (append-only; sem updated_at) --------------------------------
create table public.access_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  nome text,
  ip_conexao inet,
  local text,
  tipo_log text,
  created_at timestamptz not null default now()
);

-- active_sessions ----------------------------------------------------------
create table public.active_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  dispositivo text,
  ip_conexao inet,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
