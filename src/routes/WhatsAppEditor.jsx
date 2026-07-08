import React, { useState } from 'react';
import { KoblyAI } from '@/api/ai.js';
import { Button, Icon, Input, Spinner } from '@/ds';
import { useBreakpoint } from '@/lib/responsive.jsx';
import { useKobly } from '@/store/store.jsx';

// Kobly — Editor de mensagem de WhatsApp com geração por IA contextual (TPL-1/TPL-2).
// Modal espelhando o EmailEditor: textarea + IA (DeepSeek via ai-chat task=whatsapp) +
// preview em estilo "bolha" do WhatsApp. O objetivo (tipo_evento da campanha) é passado
// à IA para que a mensagem reflita o contexto (carrinho abandonado, pós-compra, etc.).
// KoblyWhatsAppEditor

const OBJETIVO_HINTS = {
  'Abandono de carrinho': 'Recupere o cliente que abandonou o carrinho - ofereca o link de volta ao checkout.',
  'Pix Gerado': 'Lembre o cliente que o Pix foi gerado e esta aguardando pagamento.',
  'Boleto Gerado': 'Lembre o cliente que o boleto foi gerado e o prazo de vencimento.',
  'Compra Aprovada': 'Confirme a compra e entregue o acesso a area de membros / produto.',
  'Compra Recusada': 'Avise que o pagamento foi recusado e convide a tentar novamente.',
  'Compra Reembolsada': 'Confirme o reembolso processado.',
  'Compra cancelada': 'Confirme o cancelamento do pedido.',
  'Chargeback': 'Informe sobre o chargeback registrado.',
  'Cancelamento de Assinatura': 'Tente reter o cliente que cancelou a assinatura.',
  'Deposito Solicitado': 'Confirme a solicitacao de deposito bancario.',
};

function KoblyWhatsAppEditor({ message, objetivo, onClose, onSave }) {
  const store = useKobly();
  const [titulo, setTitulo] = useState(message ? message.titulo : 'Nova mensagem');
  const [texto, setTexto] = useState(message ? (message.corpoTexto || '') : '');
  const [aiBusy, setAiBusy] = useState(false);
  const [brief, setBrief] = useState('');
  const stacked = useBreakpoint().isNarrow;

  const objetivoLabel = objetivo || 'recuperacao de vendas';
  const hint = OBJETIVO_HINTS[objetivo] || 'Escreva uma mensagem de WhatsApp para o seu cliente.';

  async function generate() {
    setAiBusy(true);
    try {
      const out = await KoblyAI.generateWhatsappText({ brief: brief || hint, objetivo: objetivo || null });
      setTexto(out.texto);
      if (out.titulo) setTitulo(out.titulo);
      store.notify('success', 'Mensagem gerada pela IA (DeepSeek)');
    } catch (e) {
      store.notify('danger', 'Nao consegui gerar a mensagem agora. Tente de novo.');
    } finally { setAiBusy(false); }
  }

  function tryClose() {
    const changed = titulo !== (message ? message.titulo : 'Nova mensagem')
      || texto !== (message ? (message.corpoTexto || '') : '');
    if (changed && !window.confirm('Voce tem alteracoes nao salvas nesta mensagem. Fechar e descartar?')) return;
    onClose();
  }

  const previewText = (texto || '').replace(/\{\{cta_link\}\}/gi, '[seu link aqui]');

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={tryClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
      <div style={{ position: 'relative', width: 760, maxWidth: '96vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <span style={{ display: 'inline-flex', width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', background: 'var(--status-success-bg)', color: 'var(--status-success-fg)' }}>
            <Icon name="message-circle" size={18} />
          </span>
          <div>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)' }}>Editor de WhatsApp</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Objetivo: {objetivoLabel}</div>
          </div>
        </header>
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: stacked ? 'column' : 'row', minHeight: 0 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, padding: 20, borderRight: stacked ? 'none' : '1px solid var(--border-subtle)', borderBottom: stacked ? '1px solid var(--border-subtle)' : 'none' }}>
            <Input label="Titulo interno" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Carrinho - lembrete 1" />
            <div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--text-body)', marginBottom: 6 }}>Mensagem</div>
              <textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escreva a mensagem. Use {{cta_link}} onde o link deve aparecer." rows={8} style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--text-strong)', background: 'var(--surface-sunken)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: 12, outline: 'none', resize: 'vertical', lineHeight: 1.5 }} />
              <div style={{ marginTop: 6 }}>
                <code style={{ fontSize: 'var(--text-xs)', color: 'var(--accent)', cursor: 'pointer', padding: '2px 6px', background: 'var(--accent-soft)', borderRadius: 'var(--radius-xs)' }} onClick={() => setTexto((t) => `${t}{{cta_link}}`)}>inserir {'{{cta_link}}'}</code>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                <Icon name="wand-2" size={14} style={{ color: 'var(--accent)' }} />
                Gerar com IA - contexto: {objetivoLabel}
              </div>
              <input value={brief} onChange={(e) => setBrief(e.target.value)} placeholder={`Briefing opcional (ex.: ${hint})`} style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--text-strong)', background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', outline: 'none' }} />
              <Button variant="primary" iconLeft="wand-2" fullWidth onClick={generate} disabled={aiBusy}>{aiBusy ? 'Gerando...' : 'Gerar mensagem'}</Button>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: '#0b141a' }}>
            {aiBusy && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'rgba(11,20,26,0.85)', color: '#e9edef' }}>
                <Spinner size={28} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)' }}>Gerando mensagem...</span>
              </div>
            )}
            <div style={{ flex: 1, overflow: 'auto', padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <div style={{ maxWidth: '85%', background: '#202c33', color: '#e9edef', padding: '10px 12px', borderRadius: '0 8px 8px 8px', fontSize: 14, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'var(--font-sans)' }}>
                {previewText || <span style={{ color: '#8696a0' }}>A mensagem aparecera aqui...</span>}
                <div style={{ fontSize: 11, color: '#8696a0', textAlign: 'right', marginTop: 4 }}>agora</div>
              </div>
            </div>
          </div>
        </div>
        <footer style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, padding: '14px 20px', borderTop: '1px solid var(--border-subtle)' }}>
          <Button variant="ghost" onClick={tryClose}>Cancelar</Button>
          <Button variant="primary" iconLeft="check" onClick={() => { onSave && onSave({ ...(message || {}), titulo, corpoTexto: texto }); store.notify('success', 'Mensagem salva'); onClose(); }}>Salvar mensagem</Button>
        </footer>
      </div>
    </div>
  );
}
export { KoblyWhatsAppEditor };
