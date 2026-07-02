import { useState, useEffect, useRef } from 'react';
import { KoblyMockDB } from '@/api/mockData.js';
import { Badge, Button, Icon, Input, Select } from '@/ds';
import { PageIntro } from '@/lib/hooks.jsx';
import { EmptyState, Modal, Segmented } from '@/lib/ui.jsx';
import { useKobly } from '@/store/store.jsx';
import { useSupport } from '@/shell/SupportProvider.jsx';

// Kobly — Chamados. Console do atendente (Suporte/Admin: fila cross-tenant, filtros,
// atribuição, resolver) e histórico do cliente (seus chamados + novo chamado).
// Dados/Realtime vêm do SupportProvider — fonte única com o SupportWidget. KoblyTickets

const STATUS_OPTS = [
  { value: 'Em andamento', label: 'Em andamento' },
  { value: 'Resolvida', label: 'Resolvidas' },
  { value: 'todas', label: 'Todas' },
];

function NewTicketModal({ open, prefill, onClose, onCreate }) {
  const [form, setForm] = useState({ assunto: '', tipo: 'Dúvidas', prioridade: 'Média', mensagem: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setForm({ assunto: (prefill && prefill.assunto) || '', tipo: (prefill && prefill.tipo) || 'Dúvidas', prioridade: 'Média', mensagem: '' });
  }, [open]);
  async function submit() {
    if (busy || !form.assunto.trim()) return;
    setBusy(true);
    await onCreate(form);
    setBusy(false);
  }
  return (
    <Modal open={open} onClose={onClose} title="Novo chamado" width={520}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
        <Button variant="primary" iconLeft="send" disabled={busy || !form.assunto.trim()} onClick={submit}>{busy ? 'Abrindo…' : 'Abrir chamado'}</Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input label="Assunto" placeholder="Resumo do problema" maxLength={140} value={form.assunto} onChange={(e) => setForm({ ...form, assunto: e.target.value })} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Select label="Tipo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}
            options={KoblyMockDB.optionSets.TipoChamado.map((t) => ({ value: t, label: t }))} />
          <Select label="Prioridade" value={form.prioridade} onChange={(e) => setForm({ ...form, prioridade: e.target.value })}
            options={['Baixa', 'Média', 'Alta'].map((p) => ({ value: p, label: p }))} />
        </div>
        <Input label="Mensagem (opcional)" placeholder="Descreva o que está acontecendo" maxLength={4000} value={form.mensagem} onChange={(e) => setForm({ ...form, mensagem: e.target.value })} />
      </div>
    </Modal>
  );
}

function KoblyTickets() {
  const store = useKobly();
  const support = useSupport();
  const DB = KoblyMockDB;
  const isSupport = !!store.can.answerTickets;
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState('');
  const [modal, setModal] = useState(false);
  const [prefill, setPrefill] = useState(null);
  const [fStatus, setFStatus] = useState('Em andamento');
  const [fPrio, setFPrio] = useState('');
  const [fMine, setFMine] = useState(false);
  const scrollRef = useRef(null);

  // Prefill vindo de outra tela (ex.: Plans → "Falar com o comercial").
  useEffect(() => {
    if (store.ticketPrefill) {
      setPrefill(store.ticketPrefill);
      store.setTicketPrefill(null);
      setModal(true);
    }
  }, []);

  const all = (support && support.convs) || [];
  const filtered = all
    .filter((c) => (isSupport ? (fStatus === 'todas' || c.status === fStatus) : true))
    .filter((c) => (isSupport && fPrio ? c.prioridade === fPrio : true))
    .filter((c) => (isSupport && fMine ? c.assignedTo === store.session.userId : true))
    .sort((a, b) => new Date(b.updatedAtIso || 0) - new Date(a.updatedAtIso || 0));

  const active = filtered.find((c) => c.id === activeId) || filtered[0] || null;

  // Abriu/trocou o thread com não-lidas → marca como lida (idem quando chega msg com foco).
  useEffect(() => {
    if (active && support && (support.unreadByConv[active.id] || 0) > 0 && document.hasFocus()) {
      support.markRead(active.id);
    }
  }, [active && active.id, active && active.mensagens.length]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [active && active.mensagens.length, active && active.id]);

  async function send() {
    if (!draft.trim() || !active || !support) return;
    const text = draft.trim();
    setDraft('');
    const ok = await support.send(active.id, text);
    if (!ok) store.notify('danger', 'Não foi possível enviar a mensagem.');
  }
  async function resolve() {
    if (!active || !support) return;
    await support.resolve(active.id);
    store.notify('success', 'Chamado marcado como resolvido');
  }
  async function assignToMe() {
    if (!active || !support) return;
    const ok = await support.assign(active.id, store.session.userId);
    store.notify(ok ? 'success' : 'danger', ok ? 'Chamado atribuído a você' : 'Não foi possível atribuir.');
  }
  async function createTicket(form) {
    const r = await support.createConversation({
      assunto: form.assunto, tipo: form.tipo, prioridade: form.prioridade,
      origem: 'manual', mensagem: form.mensagem || null, transcript: [],
    });
    if (r.error) { store.notify('danger', 'Não foi possível abrir o chamado.'); return; }
    store.notify('success', 'Chamado aberto!');
    setModal(false);
    setActiveId(r.id);
  }

  if (!support || !support.loaded) return <div style={{ color: 'var(--text-muted)' }}>Carregando chamados…</div>;

  const newTicketBtn = !isSupport && (
    <Button variant="primary" iconLeft="plus" onClick={() => { setPrefill(null); setModal(true); }}>Novo chamado</Button>
  );

  if (!all.length) {
    return (
      <>
        <EmptyState
          icon="messages-square" title="Nenhum chamado"
          message={isSupport ? 'Quando os clientes abrirem chamados, eles aparecem aqui em tempo real.' : 'Precisa de ajuda? Fale com a IA no botão Suporte ou abra um chamado direto.'}
          action={newTicketBtn || null}
        />
        <NewTicketModal open={modal} prefill={prefill} onClose={() => setModal(false)} onCreate={createTicket} />
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: 'calc(100dvh - var(--topbar-height) - var(--content-pad) * 2)' }}>
      <PageIntro action={isSupport ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Segmented value={fStatus} onChange={setFStatus} options={STATUS_OPTS} />
          <Select value={fPrio} onChange={(e) => setFPrio(e.target.value)} options={[{ value: '', label: 'Prioridade' }, ...['Alta', 'Média', 'Baixa'].map((p) => ({ value: p, label: p }))]} style={{ width: 130 }} />
          <Button size="sm" variant={fMine ? 'secondary' : 'ghost'} iconLeft="user-round" onClick={() => setFMine((v) => !v)}>Meus</Button>
        </div>
      ) : newTicketBtn}>
        {isSupport ? 'Fila de chamados dos clientes — em tempo real. Atribua, responda e resolva.' : 'Seus chamados de suporte. Converse com a equipe Koblay.'}
      </PageIntro>

      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
        {/* Lista */}
        <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)' }}>
            Conversas · {filtered.length}
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.length === 0 && <div style={{ padding: 20, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Nada com esses filtros.</div>}
            {filtered.map((c) => {
              const on = active && c.id === active.id;
              const unread = (support.unreadByConv[c.id] || 0) > 0;
              return (
                <button key={c.id} onClick={() => setActiveId(c.id)} style={{
                  display: 'block', width: '100%', textAlign: 'start', cursor: 'pointer', border: 'none',
                  borderBottom: '1px solid var(--border-subtle)', borderInlineStart: `3px solid ${on ? 'var(--accent)' : 'transparent'}`,
                  background: on ? 'var(--surface-sunken)' : 'transparent', padding: '13px 15px', fontFamily: 'var(--font-sans)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      {unread && <span aria-label="não lida" style={{ width: 8, height: 8, flex: 'none', borderRadius: '50%', background: 'var(--accent)' }} />}
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: unread ? 'var(--fw-bold)' : 'var(--fw-semibold)', color: 'var(--text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.assunto}</span>
                    </span>
                    <Badge tone={DB.optionSets.PrioridadeChamado[c.prioridade]} size="sm">{c.prioridade}</Badge>
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{isSupport ? c.empresa : c.tipo}</span>
                      {c.origem === 'ia' && <Badge tone="info" size="sm">via IA</Badge>}
                    </span>
                    <span style={{ flex: 'none' }}>{c.atualizadoEm}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chat */}
        <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {!active ? (
            <EmptyState icon="message-square-dashed" title="Selecione uma conversa" message="Escolha um chamado na lista ao lado — ou ajuste os filtros." compact />
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{active.assunto}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {active.clienteNome} · {active.empresa} · {active.tipo}
                    {isSupport && (active.assignedToNome ? ` · Atendente: ${active.assignedToNome}` : ' · Sem atendente')}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}>
                  <Badge tone={DB.optionSets.StatusChamado[active.status]} dot>{active.status}</Badge>
                  {isSupport && !active.assignedTo && active.status !== 'Resolvida' && (
                    <Button variant="ghost" size="sm" iconLeft="user-round-plus" onClick={assignToMe}>Atribuir a mim</Button>
                  )}
                  {isSupport && active.status !== 'Resolvida' && <Button variant="secondary" size="sm" iconLeft="check" onClick={resolve}>Resolver</Button>}
                </div>
              </div>
              <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {active.mensagens.map((m) => {
                  if (m.autor === 'sistema') {
                    return (
                      <div key={m.id} style={{
                        alignSelf: 'center', maxWidth: '86%', padding: '8px 12px',
                        borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-default)',
                        color: 'var(--text-muted)', fontSize: 'var(--text-xs)', lineHeight: 1.5, textAlign: 'center',
                      }}>
                        <strong>{m.nome}:</strong> {m.texto}
                      </div>
                    );
                  }
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
              {active.status !== 'Resolvida' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, borderTop: '1px solid var(--border-subtle)' }}>
                  <input
                    value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
                    placeholder="Escreva uma mensagem…" className="kbly-input" maxLength={4000}
                    style={{ flex: 1, fontFamily: 'var(--font-sans)', fontSize: 'var(--text-md)', color: 'var(--text-strong)', background: 'var(--surface-sunken)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '10px 14px', minHeight: 42, outline: 'none' }}
                  />
                  <Button variant="primary" iconLeft="send" onClick={send} disabled={!draft.trim()}>Enviar</Button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderTop: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                  <Icon name="check-circle-2" size={15} style={{ color: 'var(--status-success-fg)' }} />
                  Chamado resolvido
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <NewTicketModal open={modal} prefill={prefill} onClose={() => setModal(false)} onCreate={createTicket} />
    </div>
  );
}
export { KoblyTickets };
