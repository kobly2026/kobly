import React, { useState } from 'react';
import { KoblyApi } from '@/api/mockApi.js';
import { KoblyAI } from '@/api/ai.js';
import { KoblyMockDB } from '@/api/mockData.js';
import { Badge, Button, DataTable, Icon, IconButton, Input, Select, TemplateCard } from '@/ds';
import { PageIntro, useAsync } from '@/lib/hooks.jsx';
import { AISuggestion, ErrorState } from '@/lib/ui.jsx';
import { KoblyFlowBuilder } from '@/routes/FlowBuilder.jsx';
import { useKobly } from '@/store/store.jsx';

// Kobly — Campanhas. Lista de campanhas + galeria "Nova campanha" + orquestra o
// Construtor de fluxo. KoblyCampaigns

// Checklist de ativação — some sozinho quando todos os passos estiverem feitos.
function OnboardingChecklist({ steps }) {
  if (steps.every((s) => s.done)) return null;
  return (
    <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)' }}>Coloque sua primeira campanha no ar</div>
      {steps.map((s) => (
        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name={s.done ? 'check-circle-2' : 'circle'} size={16} style={{ color: s.done ? 'var(--status-success-fg)' : 'var(--text-subtle)', flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 'var(--text-sm)', color: s.done ? 'var(--text-muted)' : 'var(--text-body)', textDecoration: s.done ? 'line-through' : 'none' }}>{s.label}</span>
          {!s.done && s.action && <Button size="sm" variant="ghost" onClick={s.action}>{s.actionLabel}</Button>}
        </div>
      ))}
    </div>
  );
}

function NewCampaign({ templates, onPick, onGenerate, onCancel }) {
  const [sel, setSel] = useState(null);
  const [nome, setNome] = useState('');
  const [nomeTouched, setNomeTouched] = useState(false);
  const [objetivo, setObjetivo] = useState('');
  const [generating, setGenerating] = useState(false);
  // Canais da cadência gerada pela IA — o usuário escolhe se quer e-mail, WhatsApp ou os dois.
  const [canalEmail, setCanalEmail] = useState(true);
  const [canalWhats, setCanalWhats] = useState(false);

  // Selecionar um modelo pré-preenche o nome (se o usuário ainda não digitou o seu).
  function pickTemplate(t) {
    setSel(t.id);
    if (!nomeTouched) setNome(t.blank ? '' : t.nome);
  }
  async function generate() {
    if (!objetivo.trim() || (!canalEmail && !canalWhats)) return;
    setGenerating(true);
    const canais = [...(canalEmail ? ['email'] : []), ...(canalWhats ? ['whatsapp'] : [])];
    try { await onGenerate(objetivo.trim(), canais); } finally { setGenerating(false); }
  }

  const selTpl = templates.find((t) => t.id === sel);
  const finalNome = nome.trim() || (selTpl && !selTpl.blank ? selTpl.nome : 'Nova campanha');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Button variant="ghost" size="sm" iconLeft="arrow-left" onClick={onCancel}>Campanhas</Button>
        <Icon name="chevron-right" size={15} style={{ color: 'var(--text-subtle)' }} />
        <span style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)' }}>Nova campanha</span>
      </div>

      {/* Gerar com IA (AI-first) */}
      <div style={{ background: 'var(--surface-card)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="sparkles" size={17} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)' }}>Gerar campanha com IA</span>
        </div>
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Descreva o objetivo em uma frase. A IA escolhe o gatilho, a cadência e escreve os textos — você revisa e ativa.</p>
        <textarea
          value={objetivo}
          onChange={(e) => setObjetivo(e.target.value)}
          placeholder="Ex.: recuperar quem gerou boleto e não pagou em 2 dias, com um lembrete e uma oferta"
          rows={2}
          style={{ width: '100%', resize: 'vertical', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--text-body)', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', boxSizing: 'border-box' }}
        />
        {/* Canais da cadência — o usuário decide se a campanha envia e-mail, WhatsApp ou os dois */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)', fontWeight: 'var(--fw-medium)' }}>Canais:</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 'var(--text-sm)', color: 'var(--text-body)', cursor: 'pointer' }}>
            <input type="checkbox" checked={canalEmail} onChange={(e) => setCanalEmail(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
            <Icon name="mail" size={14} style={{ color: 'var(--text-muted)' }} /> E-mail
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 'var(--text-sm)', color: 'var(--text-body)', cursor: 'pointer' }}>
            <input type="checkbox" checked={canalWhats} onChange={(e) => setCanalWhats(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
            <Icon name="message-circle" size={14} style={{ color: 'var(--text-muted)' }} /> WhatsApp
          </label>
          {!canalEmail && !canalWhats && (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--status-warning-fg)' }}>Escolha pelo menos um canal.</span>
          )}
        </div>
        <div>
          <Button variant="primary" iconLeft="sparkles" disabled={generating || !objetivo.trim() || (!canalEmail && !canalWhats)} onClick={generate}>
            {generating ? 'Gerando campanha…' : 'Gerar campanha com IA'}
          </Button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)' }}>ou crie manualmente</span>
        <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
      </div>

      {/* Nome da campanha */}
      <div style={{ maxWidth: 460 }}>
        <Input
          label="Nome da campanha"
          placeholder="Ex.: Recuperação de carrinho — Black Friday"
          value={nome}
          onChange={(e) => { setNome(e.target.value); setNomeTouched(true); }}
        />
      </div>

      {/* Modelo */}
      <div>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--text-body)', marginBottom: 10 }}>Modelo</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
          {templates.map((t) => (
            <TemplateCard key={t.id} icon={t.icone} title={t.nome} description={t.descricao} selected={sel === t.id} onClick={() => pickTemplate(t)} />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
        {sel && <span style={{ marginInlineEnd: 'auto', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Será criada como <strong style={{ color: 'var(--text-strong)' }}>{finalNome}</strong></span>}
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" iconLeft="arrow-right" disabled={!sel} onClick={() => onPick(selTpl, finalNome)}>Criar e abrir fluxo</Button>
      </div>
    </div>
  );
}

function KoblyCampaigns() {
  const store = useKobly();
  const DB = KoblyMockDB;
  const variant = 'vertical'; // layout único do builder (o painel de tweaks foi removido)
  const isGestor = store.role === 'Gestor';
  const empresaId = store.session.empresaId;
  const a = useAsync(() => KoblyApi.listCampaigns(empresaId), [store.role]);
  const clients = useAsync(() => (isGestor ? KoblyApi.listClients() : Promise.resolve([])), [store.role]);
  const [mode, setMode] = useState('list'); // list | new | builder
  const [active, setActive] = useState(null);
  const [contaId, setContaId] = useState(null); // conta em foco (Gestor)
  const canEdit = store.can.editCampaign;
  const targetOrgId = isGestor ? contaId : empresaId;
  const campaigns = isGestor
    ? (a.data ? a.data.campaigns.filter((c) => c.empresaId === contaId) : [])
    : (a.data ? a.data.campaigns : []);
  const events = useAsync(() => (targetOrgId ? KoblyApi.getRecentEvents(1, targetOrgId) : Promise.resolve([])), [targetOrgId]);
  const hasIntegration = (events.data || []).length > 0;
  const hasCampaign = campaigns.length > 0;
  const hasActive = campaigns.some((c) => c.status === 'Ativa');
  const onboardingSteps = [
    { label: 'Conectar sua integração de checkout', done: hasIntegration, action: () => store.navigate('integracoes'), actionLabel: 'Ir para Integrações' },
    { label: 'Criar sua primeira campanha', done: hasCampaign, action: () => setMode('new'), actionLabel: 'Criar campanha' },
    { label: 'Ativar uma campanha', done: hasActive, action: null, actionLabel: null },
  ];

  async function openBuilder(id) {
    const c = await KoblyApi.getCampaign(id);
    setActive(c); setMode('builder');
  }
  async function create(tpl, nome) {
    const c = await KoblyApi.createCampaign(tpl, targetOrgId, nome);
    store.notify('success', `Campanha "${c.nome}" criada`);
    setActive(c); setMode('builder');
    a.reload();
  }
  async function generateAI(objetivo, canais) {
    const plan = await KoblyAI.planCampaign(objetivo, canais);
    const c = await KoblyApi.createCampaignFromPlan(plan, targetOrgId);
    if (!c) { store.notify('danger', 'Não foi possível gerar a campanha'); return; }
    store.notify('success', `Campanha "${c.nome}" gerada pela IA`);
    setActive(c); setMode('builder');
    a.reload();
  }
  async function setStatus(c, status) {
    await KoblyApi.setCampaignStatus(c.id, status);
    a.setData((d) => ({ ...d, campaigns: d.campaigns.map((x) => (x.id === c.id ? { ...x, status } : x)) }));
    store.notify('info', `"${c.nome}" → ${status}`);
  }

  if (mode === 'builder' && active) {
    return React.createElement(KoblyFlowBuilder, { campaign: active, variant, onBack: () => { setMode('list'); setActive(null); a.reload(); } });
  }
  if (mode === 'new') {
    return <NewCampaign templates={a.data ? a.data.templates : []} onPick={create} onGenerate={generateAI} onCancel={() => setMode('list')} />;
  }

  if (a.status === 'error') return <ErrorState message={a.error} onRetry={a.reload} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageIntro action={canEdit && targetOrgId ? <Button variant="primary" iconLeft="plus" onClick={() => setMode('new')}>Nova campanha</Button> : null}>
        Campanhas de recuperação por e-mail. Abra uma campanha para editar o fluxo de automação (gatilhos, tags e envios).
      </PageIntro>
      {isGestor && (
        <Select
          label="Conta"
          value={contaId || ''}
          onChange={(e) => setContaId(e.target.value || null)}
          options={[{ value: '', label: 'Selecione uma conta de cliente' }, ...((clients.data || []).map((c) => ({ value: c.id, label: c.nome })))]}
          style={{ maxWidth: 320 }}
        />
      )}
      {targetOrgId && <OnboardingChecklist steps={onboardingSteps} />}
      <AISuggestion title="Sugestão da IA — campanhas" load={() => KoblyAI.suggestForDashboard(store.view)} />
      <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        {a.status === 'loading'
          ? <div style={{ padding: 28, color: 'var(--text-muted)' }}>Carregando campanhas…</div>
          : (
            <DataTable
              rowKey="id"
              empty={
                isGestor && !contaId
                  ? 'Selecione uma conta de cliente para ver as campanhas.'
                  : !hasIntegration
                    ? <span>Antes de criar campanhas, conecte seu checkout em <a onClick={() => store.navigate('integracoes')} style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}>Integrações</a>. Depois volte aqui pra criar sua primeira campanha.</span>
                    : 'Nenhuma campanha ainda — clique em "Nova campanha" acima.'
              }
              columns={[
                { key: 'nome', header: 'Campanha', render: (r) => (
                  <button onClick={() => openBuilder(r.id)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'start', fontFamily: 'var(--font-sans)' }}>
                    <span style={{ display: 'block', fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)' }}>{r.nome}</span>
                    <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{r.fluxo ? r.fluxo.length : 0} etapas · criada {r.criadoEm}</span>
                  </button>
                ) },
                { key: 'status', header: 'Status', render: (r) => <Badge tone={DB.optionSets.StatusCampanha[r.status] || 'neutral'} dot>{r.status}</Badge> },
                { key: 'abertura', header: 'Abertura', align: 'end', render: (r) => KoblyApi.pct(r.stats.taxaAbertura) },
                { key: 'vendas', header: 'Recuperadas', align: 'end', render: (r) => <span style={{ color: r.stats.vendasRecuperadas ? 'var(--status-success-fg)' : 'var(--text-muted)', fontWeight: 'var(--fw-semibold)' }}>{KoblyApi.br(r.stats.vendasRecuperadas)}</span> },
                { key: 'crit', header: 'Criticidade', render: (r) => <Badge tone={DB.optionSets.StatusCriticidade[r.stats.criticidade] || 'neutral'} dot>{r.stats.criticidade}</Badge> },
                { key: 'acao', header: '', align: 'end', width: 120, render: (r) => canEdit ? (
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    <IconButton icon={r.status === 'Ativa' ? 'pause' : 'play'} size="sm" aria-label="Alternar status" onClick={() => setStatus(r, r.status === 'Ativa' ? 'Pausada' : 'Ativa')} />
                    <IconButton icon="pencil" size="sm" aria-label="Editar fluxo" onClick={() => openBuilder(r.id)} />
                  </div>
                ) : <IconButton icon="eye" size="sm" aria-label="Ver fluxo" onClick={() => openBuilder(r.id)} /> },
              ]}
              rows={campaigns}
            />
          )}
      </div>
    </div>
  );
}
export { KoblyCampaigns };
