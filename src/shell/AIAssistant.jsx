import React, { useState, useEffect, useRef } from 'react';
import { KoblyAI } from '@/api/ai.js';
import { KoblyMockDB } from '@/api/mockData.js';
import { Button, Icon } from '@/ds';
import { Drawer } from '@/lib/ui.jsx';
import { useKobly } from '@/store/store.jsx';

// Kobly — Assistente IA flutuante global ("Sugestões da IA"). FAB inferior direito +
// drawer com sugestões contextuais por rota + chat mock (offline). KoblyAIAssistant

// Sugestões iniciais por rota (texto pronto, sem rede).
const SUGGESTIONS = {
  dashboard: ['Por que minhas vendas recuperadas caíram?', 'Qual campanha tem melhor CTR?', 'Resumir o desempenho dos últimos 30 dias'],
  campanhas: ['Que cadência usar para abandono de carrinho?', 'Como aumentar a taxa de abertura?', 'Sugerir assunto para e-mail de Pix'],
  leads: ['Quais leads têm maior intenção de compra?', 'Como segmentar leads por valor?'],
  integracoes: ['Meu domínio não verifica — o que fazer?', 'Como conectar o checkout da Hotmart?'],
  relatorios: ['Qual canal converte melhor?', 'Onde estou perdendo conversão no funil?'],
  clientes: ['Qual conta precisa de atenção agora?'],
  chamados: ['Resumir este chamado', 'Sugerir uma resposta ao cliente'],
  default: ['Como criar minha primeira campanha?', 'O que é criticidade de campanha?'],
};

const ANSWERS = [
  'Analisei seus dados: a queda vem do fluxo de carrinho, com atraso longo na 1ª etapa. Reduza para 30 min e teste um assunto mais curto.',
  'A campanha "Pix gerado — lembrete" lidera em CTR (27%). Vale replicar a estrutura dela para os outros gatilhos.',
  'Nos últimos 30 dias: abertura média subiu 3,1% e você recuperou mais vendas que no período anterior. Mantenha o ritmo e monitore a fadiga da lista.',
  'Recomendo autenticar o domínio (DKIM/DMARC) antes de escalar os disparos — isso melhora entregabilidade e reduz spam.',
  'Para abandono de carrinho, uma cadência de 3 toques (30 min, 24 h, 48 h) com cupom no 2º e-mail costuma converter melhor.',
];

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

function AIAssistant() {
  const store = useKobly();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef(null);

  const sugg = SUGGESTIONS[store.view] || SUGGESTIONS.default;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, typing]);

  async function ask(text) {
    if (!text.trim() || typing) return;
    const next = [...msgs, { from: 'user', text }];
    setMsgs(next);
    setInput('');
    setTyping(true);
    const reply = await KoblyAI.answerAssistant(next, store.view); // multi-turn: envia o histórico
    setTyping(false);
    setMsgs((m) => [...m, { from: 'ai', text: reply }]);
  }

  return (
    <React.Fragment>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir assistente IA"
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
          <Icon name="sparkles" size={18} />
          Sugestões da IA
        </button>
      )}
      <Drawer
        open={open} onClose={() => setOpen(false)} width={420}
        title="Assistente Kobly"
        subtitle={`Contexto: ${store.roleDef.label} · ${KoblyMockDB.routeTitle[store.view] || ''}`}
        footer={
          <form onSubmit={(e) => { e.preventDefault(); ask(input); }} style={{ display: 'flex', gap: 8 }}>
            <input
              value={input} onChange={(e) => setInput(e.target.value)} placeholder="Pergunte algo sobre seus dados…"
              style={{ flex: 1, background: 'var(--surface-sunken)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', color: 'var(--text-strong)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', padding: '10px 12px', outline: 'none' }}
            />
            <Button type="submit" variant="primary" iconLeft="send" disabled={!input.trim() || typing} aria-label="Enviar" />
          </form>
        }
      >
        <div ref={scrollRef} style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
          {msgs.length === 0 && (
            <React.Fragment>
              <Bubble from="ai">Olá! Sou o assistente da Kobly. Posso analisar suas campanhas, sugerir melhorias e explicar as métricas. Por onde começamos?</Bubble>
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
          {msgs.map((m, i) => <Bubble key={i} from={m.from}>{m.text}</Bubble>)}
          {typing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
              <Icon name="sparkles" size={15} style={{ color: 'var(--accent)' }} />
              <span className="kbly-typing">Analisando…</span>
            </div>
          )}
        </div>
      </Drawer>
    </React.Fragment>
  );
}

export const KoblyAIAssistant = AIAssistant;
