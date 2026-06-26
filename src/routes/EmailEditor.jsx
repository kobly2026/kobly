import React, { useState } from 'react';
import { KoblyAI } from '@/api/ai.js';
import { KoblyApi } from '@/api/mockApi.js';
import { Button, Icon, IconButton, Input } from '@/ds';
import { Segmented } from '@/lib/ui.jsx';
import { useKobly } from '@/store/store.jsx';

// Kobly — Editor de e-mail com geração de HTML por IA (legado: n8n /generate_html),
// preview, e envio de teste. Modal. KoblyEmailEditor

function KoblyEmailEditor({ email, onClose, onSave }) {
  const store = useKobly();
  const [titulo, setTitulo] = useState(email ? email.titulo : 'Novo e-mail');
  const [assunto, setAssunto] = useState(email ? email.assunto : '');
  const [remetente, setRemetente] = useState(email ? email.remetente : 'Loja do João');
  const [html, setHtml] = useState(email ? email.corpoHtml : '');
  const [tab, setTab] = useState('preview'); // preview | code
  const [aiBusy, setAiBusy] = useState(false);
  const [brief, setBrief] = useState('');
  const [sending, setSending] = useState(false);

  async function generate() {
    setAiBusy(true);
    const out = await KoblyAI.generateEmailHtml({ titulo: brief || assunto || titulo, cta: 'Concluir compra', brand: { name: remetente || 'Sua Loja' } });
    setHtml(out);
    setAiBusy(false);
    setTab('preview');
    store.notify('success', 'HTML gerado pela IA');
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
      <div style={{ position: 'relative', width: 940, maxWidth: '96vw', height: '86vh', background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-pop)', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'kbly-toast-in var(--dur-med) var(--ease-out) both' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'inline-flex', width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', background: 'var(--accent-soft)', color: 'var(--accent)' }}><Icon name="mail" size={17} /></span>
            <span style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)' }}>Editor de e-mail</span>
          </div>
          <IconButton icon="x" aria-label="Fechar" onClick={onClose} />
        </header>

        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '340px 1fr' }}>
          {/* Form + IA */}
          <div style={{ borderInlineEnd: '1px solid var(--border-subtle)', padding: 20, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
            <Input label="Título interno" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            <Input label="Assunto" placeholder="Ex.: Você esqueceu algo no carrinho" value={assunto} onChange={(e) => setAssunto(e.target.value)} />
            <Input label="Remetente" value={remetente} onChange={(e) => setRemetente(e.target.value)} />
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="sparkles" size={16} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)' }}>Gerar com IA</span>
              </div>
              <textarea value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Descreva o e-mail (ex.: lembrete de carrinho com cupom de 10%)…" rows={3}
                className="kbly-input"
                style={{ width: '100%', resize: 'vertical', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--text-strong)', background: 'var(--surface-sunken)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 10, outline: 'none' }} />
              <Button variant="primary" iconLeft="wand-2" fullWidth onClick={generate} disabled={aiBusy}>{aiBusy ? 'Gerando HTML…' : 'Gerar HTML'}</Button>
            </div>
          </div>

          {/* Preview / code */}
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
              {Segmented && React.createElement(Segmented, { value: tab, onChange: setTab, options: [{ value: 'preview', label: 'Preview' }, { value: 'code', label: 'HTML' }] })}
              <Button variant="ghost" size="sm" iconLeft="send" style={{ marginInlineStart: 'auto' }} disabled={sending} onClick={async () => {
                const to = store.session.email;
                setSending(true);
                store.notify('info', `Enviando teste para ${to}…`);
                const { error } = await KoblyApi.sendTestEmail({ to, subject: assunto || titulo, html: html || '<p>(sem conteúdo)</p>' });
                setSending(false);
                store.notify(error ? 'danger' : 'success', error ? `Falha: ${error}` : `E-mail de teste enviado para ${to}`);
              }}>{sending ? 'Enviando…' : 'Enviar teste'}</Button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: tab === 'preview' ? '#e9e9ec' : 'var(--surface-sunken)' }}>
              {tab === 'preview'
                ? (html
                  ? <div style={{ padding: 24 }} dangerouslySetInnerHTML={{ __html: html }} />
                  : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: 14 }}>Gere ou escreva o HTML para visualizar.</div>)
                : <textarea value={html} onChange={(e) => setHtml(e.target.value)} spellCheck={false}
                    style={{ width: '100%', height: '100%', minHeight: 360, resize: 'none', border: 'none', outline: 'none', background: 'transparent', color: 'var(--text-body)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', lineHeight: 1.6, padding: 16 }} />}
            </div>
          </div>
        </div>

        <footer style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, padding: '14px 20px', borderTop: '1px solid var(--border-subtle)' }}>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" iconLeft="check" onClick={() => { onSave && onSave({ ...(email || {}), titulo, assunto, remetente, corpoHtml: html }); store.notify('success', 'E-mail salvo'); onClose(); }}>Salvar e-mail</Button>
        </footer>
      </div>
    </div>
  );
}
export { KoblyEmailEditor };
