import React, { useState, useRef } from 'react';
import { KoblyApi } from '@/api/mockApi.js';
import { KoblyAI } from '@/api/ai.js';
import { KoblyMockDB } from '@/api/mockData.js';
import { Badge, Button, Card, Icon, IconButton, Input, Select } from '@/ds';
import { useAsync } from '@/lib/hooks.jsx';
import { AISuggestion } from '@/lib/ui.jsx';
import { KoblyEmailEditor } from '@/routes/EmailEditor.jsx';
import { useKobly } from '@/store/store.jsx';

// Kobly — Construtor de fluxo (drag-drop). Paleta de cards (@TipoCardFluxo) → arrasta para
// o fluxo, reordena, edita etapa no inspetor, define tags-meta, ativa o fluxo.
// Layout com variações (tweak: builderVariant = vertical | horizontal | compact).
// KoblyFlowBuilder

const CARD_TYPES = ['Gatilho', 'Adicionar Tag', 'Remover Tag', 'Envio de e-mail', 'Envio de WhatsApp', 'Acionar Fluxo'];

// Tom/ícone do card com fallback local p/ tipos ainda não mapeados no mockData (ex.: WhatsApp).
const cardToneOf = (tipo) => KoblyMockDB.cardTone[tipo] || (tipo === 'Envio de WhatsApp' ? 'success' : 'neutral');
const cardIconOf = (tipo) => KoblyMockDB.cardIcon[tipo] || (tipo === 'Envio de WhatsApp' ? 'message-circle' : 'circle');

function fmtDelay(min) {
  if (!min) return 'imediato';
  if (min < 60) return `${min} min`;
  if (min < 1440) return `${(min / 60).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`;
  return `${(min / 1440).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} dia(s)`;
}
function defaultConfig(tipo, opts) {
  const o = opts || { webhooks: [], emails: [] };
  switch (tipo) {
    case 'Gatilho': return { tipoEvento: 'Abandono de carrinho', webhookId: (o.webhooks || [])[0] ? o.webhooks[0].id : null };
    case 'Adicionar Tag':
    case 'Remover Tag': return { tags: [] };
    case 'Envio de e-mail': return { emailId: (o.emails || [])[0] ? o.emails[0].id : null };
    case 'Envio de WhatsApp': return { whatsappMessageId: (o.whatsappMessages || [])[0] ? o.whatsappMessages[0].id : null };
    case 'Acionar Fluxo': return { fluxoAlvo: '' };
    default: return {};
  }
}
function newStep(tipo, opts) {
  return { id: 'st_' + Date.now() + '_' + Math.floor(Math.random() * 999), tipo, nome: tipo, atraso: tipo === 'Gatilho' ? 0 : 30, config: defaultConfig(tipo, opts) };
}

// ----- Paleta -----
// Arraste o card para o fluxo OU clique para adicionar ao final (fallback robusto).
function Palette({ onDragStart, onAdd }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', fontWeight: 'var(--fw-semibold)', padding: '0 2px 4px' }}>Cards do fluxo · arraste ou clique</div>
      {CARD_TYPES.map((tipo) => (
        <button key={tipo} type="button" draggable onDragStart={(e) => onDragStart(e, 'new:' + tipo)} onClick={() => onAdd(tipo)}
          title={`Adicionar "${tipo}" ao fluxo`}
          className="kbly-palette-card"
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', width: '100%', textAlign: 'start', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', cursor: 'grab', fontFamily: 'var(--font-sans)', transition: 'border-color var(--dur-fast), transform var(--dur-fast)' }}>
          <span style={{ display: 'inline-flex', width: 30, height: 30, flex: 'none', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', background: `var(--status-${cardToneOf(tipo)}-bg)`, color: `var(--status-${cardToneOf(tipo)}-fg)` }}>
            <Icon name={cardIconOf(tipo)} size={16} />
          </span>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{tipo}</span>
          <Icon name="plus" size={15} style={{ color: 'var(--text-subtle)', marginInlineStart: 'auto', flex: 'none' }} />
        </button>
      ))}
    </div>
  );
}

// ----- Card de etapa no fluxo -----
function StepCard({ step, index, selected, onSelect, onDelete, onDragStart, compact, opts = {} }) {
  const tone = cardToneOf(step.tipo);
  const summary = (() => {
    const c = step.config || {};
    if (step.tipo === 'Gatilho') return c.tipoEvento;
    if (step.tipo === 'Adicionar Tag' || step.tipo === 'Remover Tag') return `${(c.tags || []).length} tag(s)`;
    if (step.tipo === 'Envio de e-mail') return ((opts.emails || []).find((e) => e.id === c.emailId) || {}).titulo || 'e-mail';
    if (step.tipo === 'Envio de WhatsApp') return ((opts.whatsappMessages || []).find((m) => m.id === c.whatsappMessageId) || {}).titulo || 'mensagem WhatsApp';
    if (step.tipo === 'Acionar Fluxo') return ((opts.campaigns || []).find((x) => x.id === c.fluxoAlvo) || {}).nome || 'selecionar fluxo';
    return '';
  })();
  return (
    <div draggable onDragStart={(e) => onDragStart(e, step.id)} onClick={() => onSelect(step.id)}
      className="kbly-step"
      style={{
        position: 'relative', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
        padding: compact ? '10px 12px' : '14px 16px', width: compact ? '100%' : 280,
        background: 'var(--surface-card)', borderRadius: 'var(--radius-md)',
        border: `1px solid ${selected ? 'var(--accent)' : 'var(--border-subtle)'}`,
        boxShadow: selected ? '0 0 0 3px var(--accent-soft)' : 'var(--shadow-xs)',
        transition: 'border-color var(--dur-fast), box-shadow var(--dur-fast)',
      }}>
      <span style={{ display: 'inline-flex', width: 34, height: 34, flex: 'none', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', background: `var(--status-${tone}-bg)`, color: `var(--status-${tone}-fg)` }}>
        <Icon name={cardIconOf(step.tipo)} size={17} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)', whiteSpace: 'nowrap' }}>{step.tipo}</span>
          {step.tipo !== 'Gatilho' && step.atraso > 0 && <Badge tone="neutral" size="sm" style={{ flex: 'none' }}>⏱ {fmtDelay(step.atraso)}</Badge>}
        </div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{summary}</div>
      </div>
      {step.tipo !== 'Gatilho' && <IconButton icon="trash-2" size="sm" aria-label="Excluir etapa" onClick={(e) => { e.stopPropagation(); onDelete(step.id); }} />}
    </div>
  );
}

// ----- Slot de inserção (drop zone) -----
function DropSlot({ index, over, onOver, onDrop, horizontal }) {
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); onOver(index); }}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDrop(index); }}
      style={horizontal
        ? { width: over ? 30 : 14, alignSelf: 'stretch', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'width var(--dur-fast)' }
        : { height: over ? 30 : 14, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'height var(--dur-fast)' }}>
      <div style={{
        background: over ? 'var(--accent)' : 'transparent',
        borderRadius: 'var(--radius-pill)',
        ...(horizontal ? { width: over ? 4 : 2, height: '60%' } : { height: over ? 4 : 2, width: over ? '100%' : 40 }),
        transition: 'all var(--dur-fast)',
      }} />
    </div>
  );
}

// ----- Inspetor da etapa -----
function Inspector({ step, onChange, onEditEmail, opts = {} }) {
  const DB = KoblyMockDB;
  if (!step) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 10, height: '100%', color: 'var(--text-muted)', padding: 24 }}>
        <span style={{ display: 'inline-flex', width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-lg)', background: 'var(--surface-sunken)' }}><Icon name="mouse-pointer-2" size={22} /></span>
        <div style={{ fontSize: 'var(--text-sm)' }}>Selecione uma etapa para editar, ou arraste um card da paleta para o fluxo.</div>
      </div>
    );
  }
  const c = step.config || {};
  const set = (patch) => onChange({ ...step, ...patch });
  const setCfg = (patch) => onChange({ ...step, config: { ...c, ...patch } });
  function toggleTag(id) {
    const has = (c.tags || []).includes(id);
    setCfg({ tags: has ? c.tags.filter((t) => t !== id) : [...(c.tags || []), id] });
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ display: 'inline-flex', width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', background: `var(--status-${cardToneOf(step.tipo)}-bg)`, color: `var(--status-${cardToneOf(step.tipo)}-fg)` }}><Icon name={cardIconOf(step.tipo)} size={16} /></span>
        <span style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)' }}>{step.tipo}</span>
      </div>
      <Input label="Nome da etapa" value={step.nome} onChange={(e) => set({ nome: e.target.value })} />

      {step.tipo === 'Gatilho' && (
        <React.Fragment>
          <Select label="Tipo de evento" value={c.tipoEvento || ''} onChange={(e) => setCfg({ tipoEvento: e.target.value })} options={DB.optionSets.TipoEvento} />
          <Select label="Webhook de origem" value={c.webhookId || ''} onChange={(e) => setCfg({ webhookId: e.target.value })} options={(opts.webhooks || []).map((w) => ({ value: w.id, label: w.nome }))} />
        </React.Fragment>
      )}
      {(step.tipo === 'Adicionar Tag' || step.tipo === 'Remover Tag') && (
        <div>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--text-body)', marginBottom: 8 }}>Tags</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(opts.tags || []).map((t) => {
              const on = (c.tags || []).includes(t.id);
              return (
                <button key={t.id} onClick={() => toggleTag(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: `1px solid ${on ? 'var(--accent)' : 'var(--border-subtle)'}`, background: on ? 'var(--accent-soft)' : 'var(--surface-sunken)', cursor: 'pointer', textAlign: 'start', fontFamily: 'var(--font-sans)' }}>
                  <span style={{ display: 'inline-flex', width: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 5, border: on ? 'none' : '1.5px solid var(--border-default)', background: on ? 'var(--accent)' : 'transparent', color: 'var(--text-on-accent)' }}>{on && <Icon name="check" size={12} />}</span>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-strong)' }}>{t.nome}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {step.tipo === 'Envio de e-mail' && (
        <React.Fragment>
          <Select label="E-mail" value={c.emailId || ''} onChange={(e) => setCfg({ emailId: e.target.value })} options={[{ value: '', label: 'Selecionar…' }, ...(opts.emails || []).map((em) => ({ value: em.id, label: em.titulo }))]} />
          <Button variant="secondary" size="sm" iconLeft="pencil" onClick={() => onEditEmail(c.emailId)}>Editar e-mail</Button>
        </React.Fragment>
      )}
      {step.tipo === 'Envio de WhatsApp' && (
        <React.Fragment>
          <Select label="Mensagem WhatsApp" value={c.whatsappMessageId || ''} onChange={(e) => setCfg({ whatsappMessageId: e.target.value })} options={[{ value: '', label: 'Selecionar…' }, ...(opts.whatsappMessages || []).map((m) => ({ value: m.id, label: m.titulo }))]} />
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Crie e edite mensagens em Integrações → aba WhatsApp.</div>
        </React.Fragment>
      )}
      {step.tipo === 'Acionar Fluxo' && (
        <Select label="Fluxo a acionar" value={c.fluxoAlvo || ''} onChange={(e) => setCfg({ fluxoAlvo: e.target.value })} options={[{ value: '', label: 'Selecionar…' }, ...(opts.campaigns || []).map((x) => ({ value: x.id, label: x.nome }))]} />
      )}

      {step.tipo !== 'Gatilho' && (
        <Input label="Atraso (minutos)" type="number" value={step.atraso} onChange={(e) => set({ atraso: Math.max(0, parseInt(e.target.value || '0', 10)) })} hint={`Aguarda ${fmtDelay(step.atraso)} após a etapa anterior.`} />
      )}
    </div>
  );
}

function KoblyFlowBuilder({ campaign, onBack, variant = 'vertical' }) {
  const store = useKobly();
  const DB = KoblyMockDB;
  const optsA = useAsync(() => KoblyApi.getFlowOptions(), [store.role]);
  const opts = optsA.data || { webhooks: [], emails: [], whatsappMessages: [], tags: [], campaigns: [] };
  const [steps, setSteps] = useState(campaign.fluxo || []);
  const [tagsMeta, setTagsMeta] = useState(campaign.tagsMeta || []);
  const [selId, setSelId] = useState(steps[0] ? steps[0].id : null);
  const [over, setOver] = useState(-1);
  const [status, setStatus] = useState(campaign.status);
  const [emailModal, setEmailModal] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [nome, setNome] = useState(campaign.nome);
  const [editingName, setEditingName] = useState(false);
  const [nomeDraft, setNomeDraft] = useState(campaign.nome);
  const dragRef = useRef(null);
  const horizontal = variant === 'horizontal';
  const compact = variant === 'compact';

  const selStep = steps.find((s) => s.id === selId) || null;
  const markDirty = () => setDirty(true);

  function onDragStart(e, payload) {
    dragRef.current = payload;
    e.dataTransfer.effectAllowed = 'move';
    // alguns navegadores (Firefox) exigem setData p/ o drag iniciar
    try { e.dataTransfer.setData('text/plain', payload); } catch (_) { /* noop */ }
  }
  // Clique na paleta adiciona o card ao FINAL do fluxo (fallback sem DnD).
  function addStep(tipo) {
    const s = newStep(tipo, opts);
    setSteps((arr) => [...arr, s]);
    setSelId(s.id); markDirty();
  }
  function onDrop(targetIndex) {
    const payload = dragRef.current; dragRef.current = null; setOver(-1);
    if (!payload) return;
    if (payload.startsWith('new:')) {
      const tipo = payload.slice(4);
      const s = newStep(tipo, opts);
      setSteps((arr) => { const next = arr.slice(); next.splice(targetIndex, 0, s); return next; });
      setSelId(s.id); markDirty();
    } else {
      const from = steps.findIndex((s) => s.id === payload);
      if (from === -1) return;
      setSteps((arr) => {
        const next = arr.slice();
        const [moved] = next.splice(from, 1);
        const insertAt = from < targetIndex ? targetIndex - 1 : targetIndex;
        next.splice(insertAt, 0, moved);
        return next;
      });
      markDirty();
    }
  }
  function updateStep(updated) { setSteps((arr) => arr.map((s) => (s.id === updated.id ? updated : s))); markDirty(); }
  function deleteStep(id) { setSteps((arr) => arr.filter((s) => s.id !== id)); if (selId === id) setSelId(null); markDirty(); }
  function toggleMeta(id) { setTagsMeta((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id])); markDirty(); }

  async function save() {
    // Validação pré-save: cards de envio precisam ter mensagem/e-mail selecionado.
    const incompleto = steps.find((s) => {
      const c = s.config || {};
      if (s.tipo === 'Envio de WhatsApp' && !c.whatsappMessageId) return true;
      if (s.tipo === 'Envio de e-mail' && !c.emailId) return true;
      return false;
    });
    if (incompleto) {
      const oque = incompleto.tipo === 'Envio de WhatsApp' ? 'uma mensagem de WhatsApp' : 'um e-mail';
      store.notify('warning', `O card "${incompleto.nome || incompleto.tipo}" está incompleto: selecione ${oque} antes de salvar.`);
      return;
    }
    const ok = await KoblyApi.saveFlow(campaign.id, steps, tagsMeta);
    if (!ok) {
      store.notify('danger', 'Não foi possível salvar o fluxo. Tente novamente.');
      return; // mantém o estado "não salvo" (dirty)
    }
    setDirty(false);
    store.notify('success', 'Fluxo salvo');
  }
  async function toggleActive() {
    const next = status === 'Ativa' ? 'Pausada' : 'Ativa';
    await KoblyApi.setCampaignStatus(campaign.id, next);
    setStatus(next);
    store.notify(next === 'Ativa' ? 'success' : 'warning', `Campanha ${next === 'Ativa' ? 'ativada' : 'pausada'}`);
  }
  async function saveName() {
    const clean = (nomeDraft || '').trim();
    setEditingName(false);
    if (!clean || clean === nome) { setNomeDraft(nome); return; }
    setNome(clean);
    campaign.nome = clean; // mantém o objeto em memória coerente (usado pela IA/breadcrumb)
    const ok = await KoblyApi.renameCampaign(campaign.id, clean);
    store.notify(ok ? 'success' : 'danger', ok ? 'Nome atualizado' : 'Não foi possível renomear');
  }

  // Renderiza fluxo com slots de inserção entre etapas
  const flowNodes = [];
  steps.forEach((s, i) => {
    flowNodes.push(<DropSlot key={'slot-' + i} index={i} over={over === i} onOver={setOver} onDrop={onDrop} horizontal={horizontal} />);
    flowNodes.push(
      <div key={s.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: horizontal ? 0 : 0 }}>
        <StepCard step={s} index={i} selected={selId === s.id} onSelect={setSelId} onDelete={deleteStep} onDragStart={onDragStart} compact={compact} opts={opts} />
      </div>
    );
  });
  flowNodes.push(<DropSlot key={'slot-end'} index={steps.length} over={over === steps.length} onOver={setOver} onDrop={onDrop} horizontal={horizontal} />);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Barra do construtor */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Button variant="ghost" size="sm" iconLeft="arrow-left" onClick={onBack}>Campanhas</Button>
        <Icon name="chevron-right" size={15} style={{ color: 'var(--text-subtle)' }} />
        {editingName ? (
          <input
            autoFocus
            value={nomeDraft}
            onChange={(e) => setNomeDraft(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setNomeDraft(nome); setEditingName(false); } }}
            style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)', background: 'var(--surface-sunken)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm)', padding: '2px 8px', fontFamily: 'var(--font-sans)', minWidth: 220 }}
          />
        ) : (
          <button
            onClick={() => { setNomeDraft(nome); setEditingName(true); }}
            title="Renomear campanha"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: '2px 4px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
          >
            <span style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)' }}>{nome}</span>
            <Icon name="pencil" size={14} style={{ color: 'var(--text-subtle)' }} />
          </button>
        )}
        <Badge tone={DB.optionSets.StatusCampanha[status] || 'neutral'} dot>{status}</Badge>
        <div style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {dirty && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Alterações não salvas</span>}
          <Button variant="secondary" size="sm" iconLeft={status === 'Ativa' ? 'pause' : 'play'} onClick={toggleActive}>{status === 'Ativa' ? 'Pausar' : 'Ativar'}</Button>
          <Button variant="primary" size="sm" iconLeft="check" onClick={save} disabled={!dirty}>Salvar fluxo</Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 320px', gap: 16, alignItems: 'start' }}>
        {/* Paleta */}
        <Palette onDragStart={onDragStart} onAdd={addStep} />

        {/* Canvas — drop em qualquer lugar adiciona ao final; os slots inserem no meio. */}
        <div
          onDragOver={(e) => { e.preventDefault(); }}
          onDrop={(e) => { e.preventDefault(); onDrop(steps.length); }}
          style={{ background: 'var(--surface-sunken)', border: '1px dashed var(--border-default)', borderRadius: 'var(--radius-md)', padding: horizontal ? '24px 16px' : '16px 24px', minHeight: 360, overflowX: horizontal ? 'auto' : 'visible' }}>
          {steps.length === 0 ? (
            <div style={{ height: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
              <Icon name="git-branch" size={28} />
              <div style={{ fontSize: 'var(--text-sm)' }}>Arraste um card da paleta para cá — ou clique nele — para começar o fluxo.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: horizontal ? 'row' : 'column', alignItems: 'center', flexWrap: horizontal ? 'nowrap' : 'nowrap' }}>
              {flowNodes}
            </div>
          )}
        </div>

        {/* Inspetor + meta */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <AISuggestion key={campaign.id} title="Sugestão da IA — esta campanha" load={() => KoblyAI.suggestForCampaign({ nome: campaign.nome, criticidade: campaign.stats && campaign.stats.criticidade })} />
          <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: 18, minHeight: 200 }}>
            <Inspector step={selStep} onChange={updateStep} opts={opts} onEditEmail={(id) => setEmailModal((opts.emails || []).find((e) => e.id === id) || null)} />
          </div>
          <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Icon name="flag" size={16} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)' }}>Tags-meta (encerrar lead)</span>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 'var(--lh-snug)' }}>Quando o lead recebe um evento com alguma destas tags, o fluxo é encerrado para ele.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(opts.tags || []).map((t) => {
                const on = tagsMeta.includes(t.id);
                return <button key={t.id} onClick={() => toggleMeta(t.id)} style={{ cursor: 'pointer', whiteSpace: 'nowrap', border: `1px solid ${on ? 'var(--accent)' : 'var(--border-subtle)'}`, background: on ? 'var(--accent-soft)' : 'var(--surface-sunken)', color: on ? 'var(--accent)' : 'var(--text-muted)', borderRadius: 'var(--radius-pill)', padding: '4px 10px', fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-semibold)', fontFamily: 'var(--font-sans)' }}>{t.nome}</button>;
              })}
            </div>
          </div>
        </div>
      </div>

      {emailModal !== null && React.createElement(KoblyEmailEditor, {
        email: emailModal,
        onClose: () => setEmailModal(null),
        onSave: (p) => { if (p && p.id) { KoblyApi.updateEmail(p.id, p); optsA.reload(); } },
      })}
    </div>
  );
}
export { KoblyFlowBuilder };
