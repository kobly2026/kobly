import { useState, useEffect, useRef } from 'react';
import { KoblyApi } from '@/api/mockApi.js';
import { KoblyMockDB } from '@/api/mockData.js';
import { Badge, Button, IconButton } from '@/ds';
import { PageIntro, useAsync } from '@/lib/hooks.jsx';
import { EmptyState } from '@/lib/ui.jsx';
import { useKobly } from '@/store/store.jsx';

// Kobly — Chamados (ConversaChat + MensagemChat). Lista de conversas + chat.
// Suporte responde; Cliente vê os próprios. KoblyTickets

function KoblyTickets() {
  const store = useKobly();
  const DB = KoblyMockDB;
  const isSupport = store.can.answerTickets;
  const a = useAsync(() => KoblyApi.listConversations(store.role, store.session.empresaId), [store.role]);
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef(null);

  const convs = a.data || [];
  const active = convs.find((c) => c.id === activeId) || convs[0];
  useEffect(() => { if (convs.length && !activeId) setActiveId(convs[0].id); }, [convs.length]);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [active && active.mensagens.length]);

  async function send() {
    if (!draft.trim() || !active) return;
    const autor = isSupport ? 'suporte' : 'cliente';
    const nome = isSupport ? 'Marina (Suporte)' : store.session.name;
    const updated = await KoblyApi.sendMessage(active.id, draft.trim(), autor, nome);
    setDraft('');
    a.setData((rows) => rows.map((c) => (c.id === updated.id ? updated : c)));
  }
  async function resolve() {
    if (!active) return;
    await KoblyApi.resolveConversation(active.id);
    a.setData((rows) => rows.map((c) => (c.id === active.id ? { ...c, status: 'Resolvida' } : c)));
    store.notify('success', 'Chamado marcado como resolvido');
  }

  if (a.status === 'loading') return <div style={{ color: 'var(--text-muted)' }}>Carregando chamados…</div>;
  if (!convs.length) return <EmptyState icon="messages-square" title="Nenhum chamado" message="Você ainda não tem chamados de suporte." />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: 'calc(100vh - var(--topbar-height) - var(--content-pad) * 2)' }}>
      <PageIntro>{isSupport ? 'Fila de chamados dos clientes. Responda e resolva conversas de suporte.' : 'Seus chamados de suporte. Converse com a equipe Kobly.'}</PageIntro>
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
        {/* Lista */}
        <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)' }}>Conversas · {convs.length}</div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {convs.map((c) => {
              const on = active && c.id === active.id;
              return (
                <button key={c.id} onClick={() => setActiveId(c.id)} style={{
                  display: 'block', width: '100%', textAlign: 'start', cursor: 'pointer', border: 'none',
                  borderBottom: '1px solid var(--border-subtle)', borderInlineStart: `3px solid ${on ? 'var(--accent)' : 'transparent'}`,
                  background: on ? 'var(--surface-sunken)' : 'transparent', padding: '13px 15px', fontFamily: 'var(--font-sans)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.assunto}</span>
                    <Badge tone={DB.optionSets.PrioridadeChamado[c.prioridade]} size="sm">{c.prioridade}</Badge>
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{isSupport ? c.empresa : c.tipo}</span>
                    <span>{c.atualizadoEm}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chat */}
        <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)' }}>{active.assunto}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{active.clienteNome} · {active.empresa} · {active.tipo}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Badge tone={DB.optionSets.StatusChamado[active.status]} dot>{active.status}</Badge>
              {isSupport && active.status !== 'Resolvida' && <Button variant="secondary" size="sm" iconLeft="check" onClick={resolve}>Resolver</Button>}
            </div>
          </div>
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {active.mensagens.map((m) => {
              const mine = (isSupport && m.autor === 'suporte') || (!isSupport && m.autor === 'cliente');
              return (
                <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start', gap: 3 }}>
                  <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>{m.nome} · {m.when}</div>
                  <div style={{
                    maxWidth: '72%', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', lineHeight: 'var(--lh-snug)',
                    background: mine ? 'var(--accent)' : 'var(--surface-sunken)', color: mine ? 'var(--text-on-accent)' : 'var(--text-body)',
                  }}>{m.texto}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, borderTop: '1px solid var(--border-subtle)' }}>
            <IconButton icon="paperclip" aria-label="Anexar arquivo" onClick={() => store.notify('info', 'Anexo (demo)')} />
            <input
              value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
              placeholder="Escreva uma mensagem…" className="kbly-input"
              style={{ flex: 1, fontFamily: 'var(--font-sans)', fontSize: 'var(--text-md)', color: 'var(--text-strong)', background: 'var(--surface-sunken)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '10px 14px', minHeight: 42, outline: 'none' }}
            />
            <Button variant="primary" iconLeft="send" onClick={send} disabled={!draft.trim()}>Enviar</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
export { KoblyTickets };
