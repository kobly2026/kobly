import { useState } from 'react';
import { Button, Icon, Input } from '@/ds';
import { useBreakpoint } from '@/lib/responsive.jsx';
import { useKobly } from '@/store/store.jsx';

// Kobly — Editor de mensagem de SMS (canal Twilio). Espelha o WhatsAppEditor,
// sem botões (SMS é texto puro). Suporta {{cta_link}} e {{nome}}, com estimativa
// de segmentos (acentos PT-BR usam UCS-2 = 70/67 chars por segmento).

// Estimativa de segmentos igual à da edge function send-sms.
function segInfo(text) {
  const len = [...(text || '')].length;
  const unicode = /[^\x20-\x7E]/.test(text || ''); // fora do ASCII → UCS-2
  const single = unicode ? 70 : 160;
  const multi = unicode ? 67 : 153;
  const segments = len === 0 ? 0 : (len <= single ? 1 : Math.ceil(len / multi));
  return { len, unicode, segments };
}

function KoblySmsEditor({ message, onClose, onSave }) {
  const store = useKobly();
  const [titulo, setTitulo] = useState(message ? message.titulo : 'Nova mensagem');
  const [texto, setTexto] = useState(message ? (message.corpoTexto || '') : '');
  const [saving, setSaving] = useState(false);
  const stacked = useBreakpoint().isNarrow;

  const { len, unicode, segments } = segInfo(texto);
  const previewText = (texto || '')
    .replace(/\{\{cta_link\}\}/gi, '[seu link aqui]')
    .replace(/\{\{nome\}\}/gi, '[nome]');

  function tryClose() {
    const changed = titulo !== (message ? message.titulo : 'Nova mensagem')
      || texto !== (message ? (message.corpoTexto || '') : '');
    if (changed && !window.confirm('Você tem alterações não salvas nesta mensagem. Fechar e descartar?')) return;
    onClose();
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      const payload = { ...(message || {}), titulo, corpoTexto: texto };
      if (onSave) {
        const result = await onSave(payload);
        if (result && result.error) { store.notify('danger', result.error); return; }
        if (result === false) return;
      }
      store.notify('success', 'Mensagem salva');
      onClose();
    } catch (e) {
      store.notify('danger', e?.message || 'Falha ao salvar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={tryClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
      <div style={{ position: 'relative', width: 760, maxWidth: '96vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <span style={{ display: 'inline-flex', width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', background: 'var(--status-warning-bg)', color: 'var(--status-warning-fg)' }}>
            <Icon name="smartphone" size={18} />
          </span>
          <div>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)' }}>Editor de SMS</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Texto puro · Twilio</div>
          </div>
        </header>

        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: stacked ? 'column' : 'row', minHeight: 0 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, padding: 20, borderRight: stacked ? 'none' : '1px solid var(--border-subtle)', borderBottom: stacked ? '1px solid var(--border-subtle)' : 'none', overflowY: 'auto' }}>
            <Input label="Título interno" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: SMS — lembrete de carrinho" />
            <div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--text-body)', marginBottom: 6 }}>Mensagem</div>
              <textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escreva o SMS. Use {{cta_link}} e {{nome}} — resolvidos no envio." rows={6}
                style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--text-strong)', background: 'var(--surface-sunken)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: 12, outline: 'none', resize: 'vertical', lineHeight: 1.5 }} />
              <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <code style={{ fontSize: 'var(--text-xs)', color: 'var(--accent)', cursor: 'pointer', padding: '2px 6px', background: 'var(--accent-soft)', borderRadius: 'var(--radius-xs)' }} onClick={() => setTexto((t) => `${t}{{cta_link}}`)}>inserir {'{{cta_link}}'}</code>
                <code style={{ fontSize: 'var(--text-xs)', color: 'var(--accent)', cursor: 'pointer', padding: '2px 6px', background: 'var(--accent-soft)', borderRadius: 'var(--radius-xs)' }} onClick={() => setTexto((t) => `${t}{{nome}}`)}>inserir {'{{nome}}'}</code>
              </div>
              <div style={{ marginTop: 8, fontSize: 'var(--text-xs)', color: segments > 1 ? 'var(--status-warning-fg)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="info" size={13} />
                {len} caractere(s) · {segments} segmento(s){unicode ? ' · acentos/emoji reduzem para 70/67 por segmento' : ''}. Cada segmento é cobrado à parte.
              </div>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--surface-sunken)', position: 'relative' }}>
            <div style={{ flex: 1, overflow: 'auto', padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 8 }}>
              <div style={{ maxWidth: '85%', alignSelf: 'flex-start', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-strong)', padding: '10px 12px', borderRadius: '4px 14px 14px 14px', fontSize: 14, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'var(--font-sans)' }}>
                {previewText || <span style={{ color: 'var(--text-muted)' }}>A mensagem aparecerá aqui…</span>}
              </div>
            </div>
          </div>
        </div>

        <footer style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, padding: '14px 20px', borderTop: '1px solid var(--border-subtle)' }}>
          <Button variant="ghost" onClick={tryClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" iconLeft="check" loading={saving} disabled={saving} onClick={handleSave}>{saving ? 'Salvando…' : 'Salvar mensagem'}</Button>
        </footer>
      </div>
    </div>
  );
}
export { KoblySmsEditor };
