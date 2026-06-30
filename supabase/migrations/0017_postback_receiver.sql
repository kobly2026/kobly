-- 0017_postback_receiver.sql
-- Kobly — Tabela postback_tokens para autenticação da URL universal de postback.
-- Cada organização pode ter múltiplos tokens (para diferentes plataformas).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- TABELA: postback_tokens
-- ---------------------------------------------------------------------------
create table public.postback_tokens (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  token           text not null unique default ('pbk_' || encode(gen_random_bytes(24), 'hex')),
  nome            text,
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table  public.postback_tokens is 'Tokens de autenticação para a URL universal de postback.';
comment on column public.postback_tokens.token is 'Token único no formato pbk_<hex>. Usado como query param na URL de postback.';

-- ---------------------------------------------------------------------------
-- INDEX
-- ---------------------------------------------------------------------------
create index idx_postback_tokens_org    on public.postback_tokens(organization_id);
create index idx_postback_tokens_token  on public.postback_tokens(token) where ativo = true;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.postback_tokens enable row level security;

-- Org members can read their own tokens
create policy postback_tokens_select on public.postback_tokens
  for select to authenticated
  using (public.has_org_access(organization_id));

-- Only admins can insert tokens
create policy postback_tokens_insert on public.postback_tokens
  for insert to authenticated
  with check (
    public.has_org_access(organization_id)
    and public.current_role_geral() = 'Administrador'
  );

-- Only admins can update tokens
create policy postback_tokens_update on public.postback_tokens
  for update to authenticated
  using (public.has_org_access(organization_id))
  with check (public.has_org_access(organization_id));

-- Only admins can delete tokens
create policy postback_tokens_delete on public.postback_tokens
  for delete to authenticated
  using (
    public.has_org_access(organization_id)
    and public.current_role_geral() = 'Administrador'
  );

-- ---------------------------------------------------------------------------
-- RPC: create_postback_token
-- SECURITY DEFINER — bypassa RLS para criar token via edge function ou app.
-- ---------------------------------------------------------------------------
create or replace function public.create_postback_token(
  p_org_id uuid,
  p_nome text default null
)
returns public.postback_tokens
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token public.postback_tokens;
begin
  insert into public.postback_tokens (organization_id, nome)
  values (p_org_id, p_nome)
  returning * into v_token;

  return v_token;
end;
$$;

comment on function public.create_postback_token(uuid, text) is
  'Cria um novo token de postback para a organização. SECURITY DEFINER.';

-- ---------------------------------------------------------------------------
-- RPC: validate_postback_token
-- Retorna organization_id se o token é válido e ativo.
-- Usado pelo postback-receiver Edge Function.
-- ---------------------------------------------------------------------------
create or replace function public.validate_postback_token(
  p_token text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select organization_id into v_org_id
  from public.postback_tokens
  where token = p_token and ativo = true;

  return v_org_id;
end;
$$;

comment on function public.validate_postback_token(text) is
  'Valida token de postback e retorna organization_id. SECURITY DEFINER.';

-- ---------------------------------------------------------------------------
-- SEED: Token padrão para organizações existentes
-- ---------------------------------------------------------------------------
insert into public.postback_tokens (organization_id, nome)
select id, 'Token principal'
from public.organizations
on conflict do nothing;
