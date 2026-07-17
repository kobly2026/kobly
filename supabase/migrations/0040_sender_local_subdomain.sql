-- 0040 — Remetente por subdomínio da plataforma (zero-DNS por cliente).
-- Cada organização ganha um local-part estável (organizations.sender_local) para
-- compor o From `<sender_local>@<resend_sending_domain>` (ex.: loja-do-joao-ab12cd@envio.koblay.io).
-- A plataforma verifica `envio.koblay.io` no Resend UMA vez (secret resend_sending_domain);
-- a partir daí todo endereço @envio.koblay.io é válido — nenhum DNS do lado do cliente.
-- Prioridade de remetente (no worker): domínio próprio verificado > subdomínio da
-- plataforma (este) > fallback resend_from.

-- Slugify PT-BR: minúsculas, sem acento, só [a-z0-9-].
create or replace function public.kobly_slugify(txt text)
returns text
language sql
immutable
set search_path = public
as $$
  with base as (
    select lower(translate(coalesce(txt, ''),
      'áàâãäéèêëíìîïóòôõöúùûüçñ',
      'aaaaaeeeeiiiiooooouuuucn')) as s
  )
  select coalesce(nullif(
    regexp_replace(regexp_replace(s, '[^a-z0-9]+', '-', 'g'), '(^-+|-+$)', '', 'g')
  , ''), 'org')
  from base;
$$;

-- Local-part estável e único por org: slug do nome (máx 30) + sufixo do id (6 hex).
alter table public.organizations add column if not exists sender_local text;

update public.organizations
   set sender_local = left(public.kobly_slugify(nome), 30) || '-' || left(replace(id::text, '-', ''), 6)
 where sender_local is null;

comment on column public.organizations.sender_local is
  'Local-part do remetente no subdomínio da plataforma: <sender_local>@<resend_sending_domain>. Gerado do nome + id.';

-- Novas orgs recebem o sender_local automaticamente (id/default já aplicados no BEFORE INSERT).
create or replace function public.tg_org_sender_local()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.sender_local is null then
    new.sender_local := left(public.kobly_slugify(new.nome), 30) || '-' || left(replace(new.id::text, '-', ''), 6);
  end if;
  return new;
end;
$$;

drop trigger if exists set_sender_local on public.organizations;
create trigger set_sender_local before insert on public.organizations
  for each row execute function public.tg_org_sender_local();
