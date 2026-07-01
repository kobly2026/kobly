import { useMemo, useState } from 'react';
import { KoblyApi } from '@/api/mockApi.js';
import { KoblyMockDB } from '@/api/mockData.js';
import { Badge, Icon, Select } from '@/ds';
import { PageIntro, useAsync } from '@/lib/hooks.jsx';
import { Segmented } from '@/lib/ui.jsx';
import { LeadDrawer } from '@/routes/Leads.jsx';
import { useKobly } from '@/store/store.jsx';

// Kobly — Pipeline de recuperação (kanban / lista). Cada lead cai numa coluna conforme
// o estágio REAL da jornada (novo → e-mail enviado → abriu → clicou → recuperado),
// derivado das métricas reais do lead. Clicar num card abre a jornada completa.

const STAGES = [
  { key: 'novo', label: 'Novo', icon: 'sparkles', tone: 'info' },
  { key: 'enviado', label: 'E-mail enviado', icon: 'send', tone: 'accent' },
  { key: 'abriu', label: 'Abriu', icon: 'mail-open', tone: 'warning' },
  { key: 'clicou', label: 'Clicou', icon: 'mouse-pointer-click', tone: 'info' },
  { key: 'recuperado', label: 'Recuperado', icon: 'circle-check', tone: 'success' },
];

function stageOf(lead) {
  const m = lead.metricas || {};
  if (lead.ultimoEvento === 'Compra Aprovada') return 'recuperado';
  if ((m.cliques || 0) > 0) return 'clicou';
  if ((m.aberturas || 0) > 0) return 'abriu';
  if ((m.enviados || 0) > 0) return 'enviado';
  return 'novo';
}

const toneFg = (t) => (t === 'accent' ? 'var(--accent)' : `var(--status-${t}-fg)`);
const toneBg = (t) => (t === 'accent' ? 'var(--accent-soft)' : `var(--status-${t}-bg)`);

function LeadCard({ lead, onClick }) {
  const nome = [lead.nome, lead.sobrenome].filter(Boolean).join(' ') || lead.email;
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'start', cursor: 'pointer', fontFamily: 'var(--font-sans)',
        background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
        boxShadow: 'var(--shadow-sm)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4,
      }}
    >
      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</span>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.email}</span>
      {lead.produto && (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)' }}>
          {lead.produto}{lead.valorCompra ? ` · ${KoblyApi.money(lead.valorCompra)}` : ''}
        </span>
      )}
    </button>
  );
}

function KoblyPipeline() {
  const store = useKobly();
  const isGestor = store.role === 'Gestor';
  const a = useAsync(() => KoblyApi.listLeads(), [store.role]);
  const clients = useAsync(() => (isGestor ? KoblyApi.listClients() : Promise.resolve([])), [store.role]);
  const [view, setView] = useState('kanban');
  const [contaId, setContaId] = useState('');
  const [sel, setSel] = useState(null);

  const rows = (a.data && a.data.rows) || [];
  const tags = (a.data && a.data.tags) || [];
  const scoped = useMemo(
    () => (isGestor && contaId ? rows.filter((l) => l.empresaId === contaId) : rows),
    [rows, isGestor, contaId],
  );

  const byStage = useMemo(() => {
    const g = Object.fromEntries(STAGES.map((s) => [s.key, []]));
    scoped.forEach((l) => { (g[stageOf(l)] = g[stageOf(l)] || []).push(l); });
    return g;
  }, [scoped]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <PageIntro action={<Segmented value={view} onChange={setView} options={[{ value: 'kanban', label: 'Kanban' }, { value: 'lista', label: 'Lista' }]} />}>
        Pipeline de recuperação — cada lead se move de coluna conforme avança na jornada (evento → e-mail → abriu → clicou → recuperado).
      </PageIntro>

      {isGestor && (
        <Select
          value={contaId}
          onChange={(e) => setContaId(e.target.value)}
          options={[{ value: '', label: 'Todas as contas' }, ...((clients.data || []).map((c) => ({ value: c.id, label: c.nome })))]}
          style={{ maxWidth: 320 }}
        />
      )}

      {a.status === 'loading' ? (
        <div style={{ color: 'var(--text-muted)', padding: 28 }}>Carregando pipeline…</div>
      ) : scoped.length === 0 ? (
        <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          <Icon name="kanban" size={26} style={{ opacity: 0.6 }} />
          <div style={{ marginTop: 10, fontSize: 'var(--text-sm)' }}>Nenhum lead no pipeline ainda. Eles entram aqui quando um evento de checkout chega.</div>
        </div>
      ) : view === 'kanban' ? (
        <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8, alignItems: 'flex-start' }}>
          {STAGES.map((s) => (
            <div key={s.key} style={{ flex: '0 0 250px', width: 250, background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'inline-flex', width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', background: toneBg(s.tone), color: toneFg(s.tone), flex: 'none' }}>
                  <Icon name={s.icon} size={13} />
                </span>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)', flex: 1 }}>{s.label}</span>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-bold)', color: 'var(--text-muted)', background: 'var(--surface-card)', borderRadius: 'var(--radius-pill)', padding: '1px 8px' }}>{byStage[s.key].length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 24 }}>
                {byStage[s.key].length === 0
                  ? <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', padding: '6px 2px' }}>—</div>
                  : byStage[s.key].map((l) => <LeadCard key={l.id} lead={l} onClick={() => setSel(l)} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {STAGES.map((s) => (
            <div key={s.key}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ display: 'inline-flex', width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', background: toneBg(s.tone), color: toneFg(s.tone) }}>
                  <Icon name={s.icon} size={13} />
                </span>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)' }}>{s.label}</span>
                <Badge tone="neutral">{byStage[s.key].length}</Badge>
              </div>
              {byStage[s.key].length === 0 ? (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', padding: '2px 2px 8px' }}>Nenhum lead nesta etapa.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                  {byStage[s.key].map((l) => <LeadCard key={l.id} lead={l} onClick={() => setSel(l)} />)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {sel && <LeadDrawer lead={sel} onClose={() => setSel(null)} tags={tags} />}
    </div>
  );
}

export { KoblyPipeline };
