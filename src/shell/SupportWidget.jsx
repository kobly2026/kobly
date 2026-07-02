import React, { useState, useEffect, useRef } from 'react';
import { KoblyAI } from '@/api/ai.js';
import { KoblyMockDB } from '@/api/mockData.js';
import { Button, Icon, Input, Select } from '@/ds';
import { Drawer } from '@/lib/ui.jsx';
import { useKobly } from '@/store/store.jsx';
import { useSupport } from '@/shell/SupportProvider.jsx';

// Kobly — Widget de suporte flutuante (evolução do antigo AIAssistant).
// 3 modos: 'ia' (chat com o agente de suporte DeepSeek), 'escalar' (form que cria o
// chamado com a transcrição anexada) e 'humano' (thread realtime da conversa ativa).
// Staff (answerTickets) usa só o modo IA — o console deles é a tela Chamados.

const SUGGESTIONS = {
  painel: ['Por que minhas vendas recuperadas caíram?', 'Qual campanha tem melhor CTR?', 'Como funciona a criticidade?'],
  campanhas: ['Que cadência usar para abandono de carrinho?', 'Como aumentar a taxa de abertura?', 'Como funciona a Condição comprou/não comprou?'],
  leads: ['Por que um lead parou de receber mensagens?', 'Como funcionam as tags-meta?'],
  integracoes: ['Como conectar o checkout da Hotmart?', 'Meu postback não chega — o que verificar?', 'Como testar o WhatsApp?'],
  relatorios: ['Como interpretar as métricas de entrega?'],
  planos: ['O que acontece se eu estourar o limite de execuções?'],
  chamados: ['Como acompanho a resposta do meu chamado?'],
  default: ['Como criar minha primeira campanha?', 'Como conectar meu checkout?', 'O que é criticidade de campanha?'],
};

// Markdown mínimo → HTML (negrito, itálico, código, quebras) para respostas da IA.
// Escapa HTML antes de formatar (conteúdo vem do DeepSeek, semi-confiável).
function mdToHtml(src) {
  return String(src == null ? '' : src)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

function Bubble({ from, children }) {
  const me = from === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: me ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: '86%', padding: '10px 13px', borderRadius: 12,
        fontSize: 'var(--text-sm)', lineHeight: 1.5,
        background: me ? 'var(--accent)' : 'var(--surface-sunken)',
        color: me ? 'var(--text-on-accent)' : 'var(--text-body)',
        border: me ? 'none' : '1px solid var(--border-subtle)',
        borderBottomRightRadius: me ? 4 : 12, borderBottomLeftRadius: me ? 12 : 4,
      }}>{children}</div>
    </div>
  );
}

// Bloco neutro central para mensagens autor='sistema' (transcrição do chat IA).
function SystemBlock({ children }) {
  return (
    <div style={{
      alignSelf: 'center', maxWidth: '92%', padding: '8px 12px',
      borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-default)',
      background: 'transparent', color: 'var(--text-muted)',
      fontSize: 'var(--text-xs)', lineHeight: 1.5, textAlign: 'center',
    }}>{children}</div>
  );
}

function SupportWidget() {
  const store = useKobly();
  const support = useSupport();
  const isStaff = !!(store.can && store.can.answerTickets);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('ia'); // ia | escalar | humano
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [lastFailed, setLastFailed] = useState(false);
  const [activeConvId, setActiveConvId] = useState(null);
  const [escForm, setEscForm] = useState({ assunto: '', tipo: 'Dúvidas', mensagem: '' });
  const [escBusy, setEscBusy] = useState(false);
  const scrollRef = useRef(null);
  const anchoredRef = useRef(false);

  const conv = activeConvId && support ? support.convs.find((c) => c.id === activeConvId) : null;
  const unreadTotal = support ? support.unreadTotal : 0;

  // Reancoragem: Cliente/Gestor com chamado Em andamento volta direto ao chat humano.
  useEffect(() => {
    if (isStaff || anchoredRef.current || !support || !support.loaded) return;
    anchoredRef.current = true;
    const openConv = support.convs.find((c) => c.status === 'Em andamento');
    if (openConv) { setActiveConvId(openConv.id); setMode('humano'); }
  }, [support && support.loaded, isStaff]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, typing, conv && conv.mensagens.length, mode, open]);

  // Thread humano aberto + drawer aberto + aba com foco → marca como lida.
  useEffect(() => {
    if (open && mode === 'humano' && conv && support && (support.unreadByConv[conv.id] || 0) > 0 && document.hasFocus()) {
      support.markRead(conv.id);
    }
  }, [open, mode, conv && conv.mensagens.length]);

  const sugg = SUGGESTIONS[store.view] || SUGGESTIONS.default;

  async function ask(text) {
    if (!text.trim() || typing) return;
    const next = [...msgs, { from: 'user', text }];
    setMsgs(next);
    setInput('');
    setTyping(true);
    const reply = await KoblyAI.answerSupport(next, store.view);
    setTyping(false);
    setLastFailed(!!reply.failed);
    setMsgs((m) => [...m, { from: 'ai', text: reply.text }]);
  }

  function startEscalation() {
    const firstUserMsg = (msgs.find((m) => m.from === 'user') || {}).text || '';
    setEscForm({ assunto: firstUserMsg.slice(0, 80), tipo: 'Dúvidas', mensagem: '' });
    setMode('escalar');
  }

  async function submitEscalation(e) {
    e.preventDefault();
    if (escBusy || !support) return;
    setEscBusy(true);
    const r = await support.createConversation({
      assunto: escForm.assunto || 'Novo chamado',
      tipo: escForm.tipo,
      origem: msgs.length ? 'ia' : 'manual',
      mensagem: escForm.mensagem || null,
      transcript: msgs,
    });
    setEscBusy(false);
    if (r.error) { store.notify('danger', 'Não foi possível abrir o chamado agora.'); return; }
    store.notify('success', 'Chamado aberto! Nossa equipe responde por aqui.');
    setActiveConvId(r.id);
    setMode('humano');
  }

  async function sendHuman(e) {
    e.preventDefault();
    if (!input.trim() || !conv || !support) return;
    const text = input.trim();
    setInput('');
    const ok = await support.send(conv.id, text);
    if (!ok) store.notify('danger', 'Não foi possível enviar. Tente de novo.');
  }

  function newAIChat() {
    setMsgs([]);
    setLastFailed(false);
    setActiveConvId(null);
    setMode('ia');
  }

  const subtitle = mode === 'humano'
    ? (conv ? `Chamado · ${conv.status}` : 'Chamado')
    : `Assistente IA · ${KoblyMockDB.routeTitle[store.view] || 'Koblay'}`;

  return (
    <React.Fragment>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir suporte"
          className="kbly-fab"
          style={{
            position: 'fixed', right: 24, bottom: 24, zIndex: 55,
            display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer',
            background: 'var(--accent)', color: 'var(--text-on-accent)', border: 'none',
            borderRadius: 'var(--radius-pill)', padding: '12px 18px', fontFamily: 'var(--font-sans)',
            fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-sm)', boxShadow: 'var(--shadow-lg)',
            transition: 'transform var(--dur-fast), background var(--dur-fast)',
          }}
        >
          <Icon name="messages-square" size={18} />
          Suporte
          {unreadTotal > 0 && (
            <span style={{
              minWidth: 20, padding: '1px 6px', borderRadius: 'var(--radius-pill)',
              background: '#fff', color: 'var(--accent)', fontSize: 'var(--text-2xs)',
              fontWeight: 'var(--fw-bold)', textAlign: 'center', lineHeight: 1.6,
            }}>{unreadTotal > 99 ? '99+' : unreadTotal}</span>
          )}
        </button>
      )}

      <Drawer
        open={open} onClose={() => setOpen(false)} width={420}
        title="Suporte Koblay"
        subtitle={subtitle}
        footer={
          mode === 'ia' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {!isStaff && (
                <Button
                  variant={lastFailed ? 'primary' : 'ghost'}
                  iconLeft="headset"
                  onClick={startEscalation}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Falar com atendente
                </Button>
              )}
              <form onSubmit={(e) => { e.preventDefault(); ask(input); }} style={{ display: 'flex', gap: 8 }}>
                <input
                  value={input} onChange={(e) => setInput(e.target.value)} placeholder="Pergunte algo sobre o Koblay…"
                  maxLength={4000}
                  style={{ flex: 1, background: 'var(--surface-sunken)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', color: 'var(--text-strong)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', padding: '10px 12px', outline: 'none' }}
                />
                <Button type="submit" variant="primary" iconLeft="send" disabled={!input.trim() || typing} aria-label="Enviar" />
              </form>
            </div>
          ) : mode === 'humano' && conv && conv.status !== 'Resolvida' ? (
            <form onSubmit={sendHuman} style={{ display: 'flex', gap: 8 }}>
              <input
                value={input} onChange={(e) => setInput(e.target.value)} placeholder="Escreva sua mensagem…"
                maxLength={4000}
                style={{ flex: 1, background: 'var(--surface-sunken)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', color: 'var(--text-strong)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', padding: '10px 12px', outline: 'none' }}
              />
              <Button type="submit" variant="primary" iconLeft="send" disabled={!input.trim()} aria-label="Enviar" />
            </form>
          ) : null
        }
      >
        {/* ── Modo IA ── */}
        {mode === 'ia' && (
          <div ref={scrollRef} style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
            {msgs.length === 0 && (
              <React.Fragment>
                <Bubble from="ai">Olá! Sou o assistente da Koblay. Tiro dúvidas do produto, analiso suas campanhas e, se precisar, te passo para um atendente humano. Como posso ajudar?</Bubble>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 'var(--text-2xs)', letterSpacing: 'var(--ls-eyebrow)', textTransform: 'uppercase', color: 'var(--text-subtle)', fontWeight: 'var(--fw-semibold)' }}>Sugestões</span>
                  {sugg.map((s) => (
                    <button key={s} onClick={() => ask(s)} className="kbly-suggchip" style={{
                      textAlign: 'start', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
                      color: 'var(--text-body)', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)', padding: '10px 12px', transition: 'border-color var(--dur-fast), color var(--dur-fast)',
                    }}>{s}</button>
                  ))}
                </div>
              </React.Fragment>
            )}
            {msgs.map((m, i) => (
              <Bubble key={i} from={m.from}>
                {m.from === 'ai' ? <span dangerouslySetInnerHTML={{ __html: mdToHtml(m.text) }} /> : m.text}
              </Bubble>
            ))}
            {typing && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                <Icon name="sparkles" size={15} style={{ color: 'var(--accent)' }} />
                <span className="kbly-typing">Analisando…</span>
              </div>
            )}
          </div>
        )}

        {/* ── Modo escalação ── */}
        {mode === 'escalar' && (
          <form onSubmit={submitEscalation} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 'var(--lh-normal)' }}>
              Vamos abrir um chamado para a equipe. {msgs.length > 0 ? 'A conversa com a IA vai junto, então ninguém precisa repetir nada.' : ''}
            </div>
            <Input label="Assunto" placeholder="Resumo do problema" value={escForm.assunto} maxLength={140}
              onChange={(e) => setEscForm({ ...escForm, assunto: e.target.value })} />
            <Select label="Tipo" value={escForm.tipo} onChange={(e) => setEscForm({ ...escForm, tipo: e.target.value })}
              options={KoblyMockDB.optionSets.TipoChamado.map((t) => ({ value: t, label: t }))} />
            <Input label="Mensagem (opcional)" placeholder="Descreva em uma frase" value={escForm.mensagem} maxLength={4000}
              onChange={(e) => setEscForm({ ...escForm, mensagem: e.target.value })} />
            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="ghost" type="button" onClick={() => setMode('ia')} disabled={escBusy}>Voltar</Button>
              <Button variant="primary" type="submit" iconLeft="headset" disabled={escBusy || !escForm.assunto.trim()} style={{ flex: 1, justifyContent: 'center' }}>
                {escBusy ? 'Abrindo chamado…' : 'Abrir chamado'}
              </Button>
            </div>
          </form>
        )}

        {/* ── Modo humano ── */}
        {mode === 'humano' && (
          <div ref={scrollRef} style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
            {!conv && (
              <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Carregando chamado…</div>
            )}
            {conv && (
              <React.Fragment>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.assunto}</span>
                  <button
                    type="button"
                    onClick={() => { setOpen(false); store.navigate('chamados'); }}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--accent)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-semibold)', flex: 'none' }}
                  >
                    Ver em Chamados
                  </button>
                </div>
                {conv.mensagens.map((m) => (
                  m.autor === 'sistema'
                    ? <SystemBlock key={m.id}><strong>{m.nome}:</strong> {m.texto}</SystemBlock>
                    : (
                      <Bubble key={m.id} from={m.autor === 'cliente' ? (isStaff ? 'other' : 'user') : (isStaff ? 'user' : 'other')}>
                        <span style={{ display: 'block', fontSize: 'var(--text-2xs)', opacity: 0.75, marginBottom: 2 }}>{m.nome} · {m.when}</span>
                        {m.texto}
                      </Bubble>
                    )
                ))}
                {conv.status === 'Resolvida' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', padding: '12px 0' }}>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Este chamado foi resolvido. 🎉</span>
                    <Button variant="secondary" iconLeft="sparkles" onClick={newAIChat}>Nova conversa com a IA</Button>
                  </div>
                )}
              </React.Fragment>
            )}
          </div>
        )}
      </Drawer>
    </React.Fragment>
  );
}

export { SupportWidget };
