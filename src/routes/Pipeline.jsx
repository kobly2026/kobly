import { useMemo, useState } from 'react';
import { KoblyApi } from '@/api/mockApi.js';
import { KoblyMockDB } from '@/api/mockData.js';
import { Badge, Icon, Select } from '@/ds';
import { PageIntro, useAsync } from '@/lib/hooks.jsx';
import { useBreakpoint } from '@/lib/responsive.jsx';
import { EmptyState, ErrorState, Segmented, SkeletonCards } from '@/lib/ui.jsx';
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
      className="kbly-lift"
      style={{
        width: '100%', textAlign: 'start', cursor: 'grab', fontFamily: 'var(--font-sans)',
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
  const { isMobile } = useBreakpoint();

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

  if (a.status === 'error') return <ErrorState message={a.error} onRetry={a.reload} />;

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
        <SkeletonCards count={5} height={180} />
      ) : scoped.length === 0 ? (
        <EmptyState
          icon="kanban"
          title="Nenhum lead no pipeline ainda"
          message="Eles entram aqui quando um evento de checkout chega."
        />
      ) : view === 'kanban' ? (
        <div style={{ display: 'flex', gap: 14, overflowX: 'auto', scrollSnapType: isMobile ? 'x mandatory' : undefined, paddingBottom: 8, alignItems: 'flex-start' }}>
          {STAGES.map((s) => (
            <div key={s.key} style={{ flex: isMobile ? '0 0 220px' : '0 0 250px', width: isMobile ? 220 : 250, minWidth: 220, scrollSnapAlign: 'start', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderTop: `2px solid ${toneFg(s.tone)}`, borderRadius: 'var(--radius-md)', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--surface-sunken)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'inline-flex', width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', background: toneBg(s.tone), color: toneFg(s.tone), flex: 'none' }}>
                  <Icon name={s.icon} size={13} />
                </span>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)', flex: 1 }}>{s.label}</span>
                <Badge tone="neutral" size="sm">{byStage[s.key].length}</Badge>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 24 }}>
                {byStage[s.key].length === 0
                  ? (
                    <div style={{ border: '1px dashed var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '18px 10px', textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--text-subtle)' }}>
                      Sem leads aqui
                    </div>
                  )
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
