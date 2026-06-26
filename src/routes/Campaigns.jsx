import React, { useState } from 'react';
import { KoblyApi } from '@/api/mockApi.js';
import { KoblyMockDB } from '@/api/mockData.js';
import { Badge, Button, DataTable, Icon, IconButton, TemplateCard } from '@/ds';
import { PageIntro, useAsync } from '@/lib/hooks.jsx';
import { useKoblyTweak } from '@/lib/tweaks.jsx';
import { KoblyFlowBuilder } from '@/routes/FlowBuilder.jsx';
import { useKobly } from '@/store/store.jsx';

// Kobly — Campanhas. Lista de campanhas + galeria "Nova campanha" + orquestra o
// Construtor de fluxo. KoblyCampaigns

function NewCampaign({ templates, onPick, onCancel }) {
  const [sel, setSel] = useState(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Button variant="ghost" size="sm" iconLeft="arrow-left" onClick={onCancel}>Campanhas</Button>
        <Icon name="chevron-right" size={15} style={{ color: 'var(--text-subtle)' }} />
        <span style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)' }}>Nova campanha</span>
      </div>
      <p style={{ margin: 0, fontSize: 'var(--text-md)', color: 'var(--text-muted)' }}>Escolha um modelo para começar. Você poderá ajustar todo o fluxo em seguida.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {templates.map((t) => (
          <TemplateCard key={t.id} icon={t.icone} title={t.nome} description={t.descricao} selected={sel === t.id} onClick={() => setSel(t.id)} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" iconLeft="arrow-right" disabled={!sel} onClick={() => onPick(templates.find((t) => t.id === sel))}>Criar e abrir fluxo</Button>
      </div>
    </div>
  );
}

function KoblyCampaigns() {
  const store = useKobly();
  const DB = KoblyMockDB;
  const variant = useKoblyTweak('builderVariant', 'vertical');
  const empresaId = store.session.empresaId || 'emp_1';
  const a = useAsync(() => KoblyApi.listCampaigns(empresaId), [store.role]);
  const [mode, setMode] = useState('list'); // list | new | builder
  const [active, setActive] = useState(null);
  const canEdit = store.can.editCampaign;

  async function openBuilder(id) {
    const c = await KoblyApi.getCampaign(id);
    setActive(c); setMode('builder');
  }
  async function create(tpl) {
    const c = await KoblyApi.createCampaign(tpl, empresaId);
    store.notify('success', 'Campanha criada');
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
    return <NewCampaign templates={a.data ? a.data.templates : []} onPick={create} onCancel={() => setMode('list')} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageIntro action={canEdit ? <Button variant="primary" iconLeft="plus" onClick={() => setMode('new')}>Nova campanha</Button> : null}>
        Campanhas de recuperação por e-mail. Abra uma campanha para editar o fluxo de automação (gatilhos, tags e envios).
      </PageIntro>
      <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        {a.status === 'loading'
          ? <div style={{ padding: 28, color: 'var(--text-muted)' }}>Carregando campanhas…</div>
          : (
            <DataTable
              rowKey="id"
              empty="Nenhuma campanha ainda."
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
              rows={a.data ? a.data.campaigns : []}
            />
          )}
      </div>
    </div>
  );
}
export { KoblyCampaigns };
