-- 0026 — Chat de suporte (IA + humano com escalação).
-- Adiciona à infra de chamados (0005/0007): origem do chamado (manual|ia), marcadores
-- de leitura por lado (unread), limite de tamanho de mensagem, RPC de criação de
-- conversa (com transcrição do chat IA como autor='sistema') e tabela de rate limit
-- da edge function ai-chat.

-- (a) Colunas novas em support_conversations.
--     As UPDATE policies existentes (cliente na própria conversa; suporte/admin em
--     todas) já cobrem os *_last_read_at — nenhuma policy nova é necessária.
alter table public.support_conversations
  add column if not exists origem text not null default 'manual' check (origem in ('manual','ia')),
  add column if not exists cliente_last_read_at timestamptz,
  add column if not exists support_last_read_at timestamptz;

-- (b) Tamanho máximo de mensagem (defesa em profundidade; a UI limita a 4000).
alter table public.support_messages
  drop constraint if exists support_messages_len;
alter table public.support_messages
  add constraint support_messages_len check (char_length(coalesce(mensagem, '')) <= 8000);

-- (c) RPC: cria conversa + transcrição do chat IA (autor='sistema') + 1ª mensagem
--     do cliente. SECURITY DEFINER porque a policy de INSERT em support_messages
--     coage profile_id = current_profile_id() E proíbe Cliente de postar
--     autor <> 'cliente' — a transcrição precisa entrar como 'sistema'.
create or replace function public.create_support_conversation(
  p_assunto text,
  p_tipo public.tipo_chamado default 'Dúvidas',
  p_prioridade public.prioridade_chamado default 'Média',
  p_origem text default 'manual',
  p_mensagem text default null,
  p_transcript jsonb default '[]'   -- [{"from":"user"|"ai","text":string}]
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_conv_id uuid;
  v_item jsonb;
  v_count int := 0;
begin
  select * into v_profile from public.profiles where auth_id = auth.uid();
  if v_profile.id is null then raise exception 'no_profile'; end if;
  if v_profile.organization_id is null then raise exception 'no_org'; end if;

  insert into public.support_conversations
    (organization_id, cliente_id, assunto, tipo_chamado, prioridade_chamado, status_chamado, origem, cliente_last_read_at)
  values
    (v_profile.organization_id, v_profile.id,
     left(coalesce(nullif(btrim(p_assunto), ''), 'Novo chamado'), 140),
     p_tipo, p_prioridade, 'Em andamento',
     case when p_origem in ('manual','ia') then p_origem else 'manual' end,
     now())
  returning id into v_conv_id;

  -- Transcrição do chat com a IA (teto: 40 itens × 4000 chars).
  for v_item in select * from jsonb_array_elements(coalesce(p_transcript, '[]'::jsonb)) loop
    exit when v_count >= 40;
    insert into public.support_messages (conversation_id, autor, profile_id, nome, mensagem)
    values (v_conv_id, 'sistema', v_profile.id,
            case when v_item->>'from' = 'user'
                 then coalesce(v_profile.nome, 'Cliente') || ' (chat IA)'
                 else 'Assistente IA' end,
            left(coalesce(v_item->>'text', ''), 4000));
    v_count := v_count + 1;
  end loop;

  -- Primeira mensagem do cliente (opcional).
  if nullif(btrim(coalesce(p_mensagem, '')), '') is not null then
    insert into public.support_messages (conversation_id, autor, profile_id, nome, mensagem)
    values (v_conv_id, 'cliente', v_profile.id, v_profile.nome, left(p_mensagem, 8000));
  end if;

  return v_conv_id;
end;
$$;

revoke all on function public.create_support_conversation(text, public.tipo_chamado, public.prioridade_chamado, text, text, jsonb) from public;
revoke all on function public.create_support_conversation(text, public.tipo_chamado, public.prioridade_chamado, text, text, jsonb) from anon;
grant execute on function public.create_support_conversation(text, public.tipo_chamado, public.prioridade_chamado, text, text, jsonb) to authenticated;

-- (d) Rate limit da IA — escrita/leitura só via service role (RLS on, sem policies).
create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  auth_id uuid not null,
  task text,
  created_at timestamptz not null default now()
);
alter table public.ai_usage enable row level security;
create index if not exists idx_ai_usage_auth_created on public.ai_usage (auth_id, created_at desc);
