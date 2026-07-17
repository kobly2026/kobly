import React, { useRef, useState } from 'react';
import { KoblyAI } from '@/api/ai.js';
import { KoblyApi } from '@/api/mockApi.js';
import { Button, Icon, IconButton, Input, Spinner } from '@/ds';
import { Segmented } from '@/lib/ui.jsx';
import { useBreakpoint } from '@/lib/responsive.jsx';
import { useKobly } from '@/store/store.jsx';

// Kobly — Editor de e-mail com geração de HTML por IA (legado: n8n /generate_html),
// preview, e envio de teste. Modal. KoblyEmailEditor

// Bloqueia cliques em links do preview (href="#" ou qualquer <a>) para não
// redirecionar a SPA (ex.: dashboard). O sandbox do iframe já impede top-nav;
// o handler é defesa extra + UX de "clique inativo".
function attachPreviewGuards(iframe) {
  if (!iframe) return;
  try {
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    const block = (ev) => {
      const a = ev.target && ev.target.closest ? ev.target.closest('a') : null;
      if (a) {
        ev.preventDefault();
        ev.stopPropagation();
      }
    };
    doc.addEventListener('click', block, true);
    // Neutraliza href="#" que em alguns browsers ainda afetam o history.
    doc.querySelectorAll('a[href="#"], a[href=""], a:not([href])').forEach((a) => {
      a.setAttribute('href', 'javascript:void(0)');
      a.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); }, true);
    });
  } catch (_) { /* cross-origin — não deve acontecer com srcDoc */ }
}

function KoblyEmailEditor({ email, onClose, onSave }) {
  const store = useKobly();
  const [titulo, setTitulo] = useState(email ? email.titulo : 'Novo e-mail');
  const [assunto, setAssunto] = useState(email ? email.assunto : '');
  const [remetente, setRemetente] = useState(email ? (email.remetente || '') : '');
  const [html, setHtml] = useState(email ? (email.corpoHtml || '') : '');
  const [tab, setTab] = useState('preview'); // preview | code
  const [aiBusy, setAiBusy] = useState(false);
  const [brief, setBrief] = useState('');
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [testTo, setTestTo] = useState(store.session.email || '');
  // CTA: botão com link no corpo do e-mail
  const [ctaLabel, setCtaLabel] = useState('Concluir compra');
  const [ctaHref, setCtaHref] = useState('{{cta_link}}');
  // ≤860px o editor empilha o formulário sobre o preview (modal fica estreito).
  const stacked = useBreakpoint().isNarrow;
  const iframeRef = useRef(null);
  const fileRef = useRef(null);

  // Importa um template de arquivo (.html ou .zip do Canva). O parser+sanitizador
  // (jszip/dompurify) é carregado sob demanda para não pesar o bundle principal.
  async function handleImportFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // permite reimportar o mesmo arquivo
    if (!file) return;
    setImporting(true);
    try {
      const { importEmailFile } = await import('@/lib/emailImport.js');
      const { html: imported, warnings } = await importEmailFile(file);
      setHtml(imported);
      setTab('preview');
      store.notify('success', 'Template importado');
      (warnings || []).forEach((w) => store.notify('warning', w));
    } catch (err) {
      store.notify('danger', err?.message || 'Não foi possível importar o arquivo.');
    } finally {
      setImporting(false);
    }
  }

  function insertCtaButton() {
    const label = (ctaLabel || 'Concluir compra').trim();
    const href = (ctaHref || '{{cta_link}}').trim() || '{{cta_link}}';
    // Bloco de botão e-mail-safe (table + inline styles), compatível com clientes de e-mail.
    const block = `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 4px;"><tr><td align="left">
  <a href="${href.replace(/"/g, '&quot;')}" style="display:inline-block;background:#ff6800;color:#1a1a1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:14px 30px;border-radius:11px;">${label.replace(/</g, '&lt;')}</a>
</td></tr></table>`;
    setHtml((h) => (h || '') + block);
    setTab('preview');
    store.notify('success', 'Botão CTA inserido no HTML');
  }

  async function sendTest() {
    const to = (testTo || '').trim();
    if (!to) { store.notify('danger', 'Informe um e-mail de destino'); return; }
    setSending(true);
    store.notify('info', `Enviando teste para ${to}…`);
    const { error } = await KoblyApi.sendTestEmail({
      to,
      subject: assunto || titulo,
      html: html || '<p>(sem conteúdo)</p>',
      fromName: remetente || undefined,
    });
    setSending(false);
    if (!error) { store.notify('success', `E-mail de teste enviado para ${to}`); return; }
    // Erro típico do Resend sem domínio verificado (só entrega pro dono da conta).
    const domainIssue = /own email address|verify a domain|not verified|testing emails|domain/i.test(String(error));
    store.notify('danger', domainIssue
      ? 'Sem domínio verificado no Resend, o teste só chega em kobly@dizeops.com. Verifique um domínio (resend.com/domains) para enviar a qualquer endereço.'
      : `Falha ao enviar: ${error}`);
  }

  async function generate() {
    setAiBusy(true);
    try {
      const out = await KoblyAI.generateEmailHtml({ brief: brief || assunto || titulo, cta: 'Concluir compra', brand: { name: remetente || 'Sua Loja' } });
      setHtml(out.html);
      if (out.assunto) setAssunto(out.assunto);
      setTab('preview');
      store.notify('success', 'E-mail gerado pela IA (DeepSeek)');
    } catch (e) {
      store.notify('danger', 'Não consegui gerar o e-mail agora. Tente de novo.');
    } finally {
      setAiBusy(false);
    }
  }

  // UX-1: avisa ao fechar o editor se há alterações não salvas (cancelar perde o que
  // foi digitado). Comparação direta contra o e-mail original.
  function tryClose() {
    const changed = titulo !== (email ? email.titulo : 'Novo e-mail')
      || assunto !== (email ? email.assunto : '')
      || remetente !== (email ? (email.remetente || '') : '')
      || html !== (email ? (email.corpoHtml || '') : '');
    if (changed && !window.confirm('Você tem alterações não salvas neste e-mail. Fechar e descartar?')) return;
    onClose();
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      const payload = { ...(email || {}), titulo, assunto, remetente, corpoHtml: html };
      if (onSave) {
        const result = await onSave(payload);
        // onSave pode retornar { error } ou false para sinalizar falha
        if (result && result.error) {
          store.notify('danger', result.error || 'Não foi possível salvar o e-mail');
          return;
        }
        if (result === false) return;
      }
      store.notify('success', 'E-mail salvo');
      onClose();
    } catch (e) {
      store.notify('danger', e?.message || 'Não foi possível salvar o e-mail');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={tryClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
      <div style={{ position: 'relative', width: 940, maxWidth: '96vw', height: '86vh', background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-pop)', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'kbly-toast-in var(--dur-med) var(--ease-out) both' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'inline-flex', width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', background: 'var(--accent-soft)', color: 'var(--accent)' }}><Icon name="mail" size={17} /></span>
            <span style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)' }}>Editor de e-mail</span>
          </div>
          <IconButton icon="x" aria-label="Fechar" onClick={tryClose} />
        </header>

        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: stacked ? 'minmax(0, 1fr)' : '340px minmax(0, 1fr)', gridTemplateRows: stacked ? 'auto minmax(220px, 1fr)' : undefined }}>
          {/* Form + IA */}
          <div style={{ [stacked ? 'borderBottom' : 'borderInlineEnd']: '1px solid var(--border-subtle)', padding: 20, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
            <Input label="Título interno" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            <Input label="Assunto" placeholder="Ex.: Você esqueceu algo no carrinho" value={assunto} onChange={(e) => setAssunto(e.target.value)} />
            <Input label="Remetente" placeholder="Ex.: Loja do João" value={remetente} onChange={(e) => setRemetente(e.target.value)} hint="Nome que aparece na caixa de entrada do destinatário" />
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="mouse-pointer-click" size={16} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)' }}>Botão CTA</span>
              </div>
              <Input label="Texto do botão" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Ex.: Concluir compra" />
              <Input label="Link de redirecionamento" value={ctaHref} onChange={(e) => setCtaHref(e.target.value)} placeholder="{{cta_link}} ou https://..." hint="{{cta_link}} é trocado pelo link do lead no envio" />
              <Button variant="secondary" iconLeft="plus" fullWidth onClick={insertCtaButton}>Inserir botão no e-mail</Button>
            </div>
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="upload" size={16} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)' }}>Importar template</span>
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Envie um <b>.html</b> ou um <b>.zip</b> (ex.: export do Canva). Imagens do ZIP são embutidas e o HTML é sanitizado.</div>
              <input ref={fileRef} type="file" accept=".zip,.html,.htm,text/html,application/zip" onChange={handleImportFile} style={{ display: 'none' }} />
              <Button variant="secondary" iconLeft="upload" fullWidth disabled={importing} onClick={() => fileRef.current && fileRef.current.click()}>{importing ? 'Importando…' : 'Importar .zip / .html'}</Button>
            </div>
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="sparkles" size={16} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)' }}>Gerar com IA</span>
              </div>
              <textarea value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Descreva o e-mail (ex.: lembrete de carrinho com cupom de 10%)…" rows={3}
                className="kbly-input"
                style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--text-strong)', background: 'var(--surface-sunken)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 10, outline: 'none' }} />
              <Button variant="primary" iconLeft="wand-2" fullWidth onClick={generate} disabled={aiBusy}>{aiBusy ? 'Gerando HTML…' : 'Gerar HTML'}</Button>
            </div>
          </div>

          {/* Preview / code */}
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
              {Segmented && React.createElement(Segmented, { value: tab, onChange: setTab, options: [{ value: 'preview', label: 'Preview' }, { value: 'code', label: 'HTML' }] })}
              <input
                type="email"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="e-mail de teste"
                style={{ marginInlineStart: 'auto', width: 200, boxSizing: 'border-box', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--text-strong)', background: 'var(--surface-sunken)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '7px 10px', outline: 'none' }}
              />
              <Button variant="secondary" size="sm" iconLeft="send" disabled={sending} onClick={sendTest}>{sending ? 'Enviando…' : 'Enviar teste'}</Button>
            </div>
            <div style={{ position: 'relative', flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden', background: tab === 'preview' ? '#e9e9ec' : 'var(--surface-sunken)' }}>
              {aiBusy && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'color-mix(in srgb, var(--surface-card) 82%, transparent)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)', color: 'var(--text-strong)' }}>
                  <Spinner size={28} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)' }}>Gerando e-mail…</span>
                </div>
              )}
              {tab === 'preview'
                ? (html
                  ? (
                    <iframe
                      ref={iframeRef}
                      title="Prévia do e-mail"
                      srcDoc={html}
                      sandbox="allow-same-origin"
                      onLoad={(e) => attachPreviewGuards(e.currentTarget)}
                      style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                    />
                  )
                  : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: 14, textAlign: 'center', padding: 24 }}>Gere ou escreva o HTML para visualizar.</div>)
                : <textarea value={html} onChange={(e) => setHtml(e.target.value)} spellCheck={false}
                    style={{ width: '100%', height: '100%', minHeight: 360, resize: 'none', border: 'none', outline: 'none', background: 'transparent', color: 'var(--text-body)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', lineHeight: 1.6, padding: 16, boxSizing: 'border-box' }} />}
            </div>
          </div>
        </div>

        <footer style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, padding: '14px 20px', borderTop: '1px solid var(--border-subtle)' }}>
          <Button variant="ghost" onClick={tryClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" iconLeft="check" loading={saving} disabled={saving} onClick={handleSave}>{saving ? 'Salvando…' : 'Salvar e-mail'}</Button>
        </footer>
      </div>
    </div>
  );
}
export { KoblyEmailEditor };
