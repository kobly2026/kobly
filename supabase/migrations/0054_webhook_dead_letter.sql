-- 0054_webhook_dead_letter.sql
-- Investigação forense (auditoria E2E, 4 lentes + 3 céticos) provou que o
-- postback-receiver descarta postbacks em silêncio: sempre responde HTTP 200
-- (correto — plataformas de checkout desabilitam webhooks que respondem 4xx/5xx),
-- mas quando o payload não é reconhecido/mapeável OU o insert em webhook_events
-- falha, o evento simplesmente desaparece — sem log, sem rastro. public.error_logs
-- está zerada desde sempre, então não havia visibilidade alguma. Esta tabela é o
-- "dead-letter queue": guarda o payload cru + o motivo do descarte, para que o
-- time consiga investigar sem depender do provedor reenviar o webhook.
-- Escrita: só service_role (a edge function usa a service role key — não há
-- policy de insert aqui, de propósito). Leitura: quem tem acesso à org.
-- ---------------------------------------------------------------------------
create table if not exists public.webhook_dead_letter (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid references public.organizations(id) on delete cascade,
  postback_token_id  uuid,
  provider           text,
  reason             text not null,   -- ex.: 'unknown_event_or_missing_email', 'insert_failed'
  detail             text,            -- mensagem de erro, quando houver
  raw_payload        jsonb not null,
  created_at         timestamptz not null default now()
);

create index if not exists webhook_dead_letter_org_created_idx
  on public.webhook_dead_letter (organization_id, created_at desc);

alter table public.webhook_dead_letter enable row level security;

-- Leitura: apenas quem tem acesso à org dona do evento. Sem policy de insert/update/delete
-- (a service role ignora RLS; usuários autenticados nunca devem gravar aqui diretamente).
drop policy if exists webhook_dead_letter_read on public.webhook_dead_letter;
create policy webhook_dead_letter_read on public.webhook_dead_letter
  for select using (
    organization_id is not null
    and public.has_org_access(organization_id)
  );
