-- 0041 — Correções da revisão adversarial (segurança + robustez).
-- 1) RLS: bulk_sends e bulk_send_recipients estavam 'for all to authenticated'. Só o
--    service_role (edge control + RPC + worker) escreve. A UI só LÊ o cabeçalho (bulk_sends).
--    → bulk_sends: SELECT p/ authenticated (has_org_access); bulk_send_recipients: só service_role.
-- 2) kobly_slugify: lower() ANTES de translate() (acento MAIÚSCULO era descartado p/ '-').
-- 3) sender_local: unicidade real (índice único) + trigger tira hífen final da truncagem,
--    usa mais entropia do id e faz loop anti-colisão (nunca falha o insert).

-- ===========================================================================
-- 1) RLS bulk_sends / bulk_send_recipients
-- ===========================================================================
drop policy if exists bulk_sends_all on public.bulk_sends;
create policy bulk_sends_select on public.bulk_sends for select to authenticated
  using (public.has_org_access(organization_id));
-- create/cancel do disparo passam pelo edge `bulk-send` (service_role, bypassa RLS).

drop policy if exists bulk_send_recipients_all on public.bulk_send_recipients;
-- Sem policy p/ authenticated: só service_role (RPC de enqueue + worker process-bulk).
-- A UI acompanha o progresso pelo cabeçalho (bulk_sends), nunca pela tabela de destinatários.
-- Fecha também a injeção cross-tenant (authenticated não insere destinatários).

-- ===========================================================================
-- 2) kobly_slugify — lower() antes de translate()
-- ===========================================================================
create or replace function public.kobly_slugify(txt text)
returns text
language sql
immutable
set search_path = public
as $$
  with base as (
    select translate(lower(coalesce(txt, '')),
      'áàâãäéèêëíìîïóòôõöúùûüçñ',
      'aaaaaeeeeiiiiooooouuuucn') as s
  )
  select coalesce(nullif(
    regexp_replace(regexp_replace(s, '[^a-z0-9]+', '-', 'g'), '(^-+|-+$)', '', 'g')
  , ''), 'org')
  from base;
$$;

-- ===========================================================================
-- 3) sender_local — unicidade + trigger anti-colisão
-- ===========================================================================
create unique index if not exists uq_organizations_sender_local
  on public.organizations (sender_local) where sender_local is not null;

create or replace function public.tg_org_sender_local()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_base text;
  v_try  text;
  v_n    int := 0;
begin
  if new.sender_local is null then
    -- slug (máx 24) sem hífen no fim (truncagem podia reintroduzir) + 8 hex do id.
    v_base := regexp_replace(left(public.kobly_slugify(new.nome), 24), '-+$', '');
    v_try  := v_base || '-' || left(replace(new.id::text, '-', ''), 8);
    -- Loop anti-colisão: garante unicidade sem nunca falhar o insert.
    while exists (select 1 from public.organizations where sender_local = v_try) loop
      v_n   := v_n + 1;
      v_try := v_base || '-' || left(replace(new.id::text, '-', ''), 8) || v_n::text;
    end loop;
    new.sender_local := v_try;
  end if;
  return new;
end;
$$;
