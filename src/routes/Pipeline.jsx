import { useCallback, useEffect, useState } from 'react';
import { KoblyApi } from '@/api/mockApi.js';
import { Badge, Button, Icon, Select } from '@/ds';
import { PageIntro, useAsync } from '@/lib/hooks.jsx';
import { useBreakpoint } from '@/lib/responsive.jsx';
import { EmptyState, ErrorState, Segmented, SkeletonCards } from '@/lib/ui.jsx';
import { LeadDrawer } from '@/routes/Leads.jsx';
import { useKobly } from '@/store/store.jsx';

// Kobly — Pipeline de recuperação (kanban / lista), SERVER-DRIVEN para escalar:
// o estágio de cada lead é derivado NO BANCO (RPC leads_page/pipeline_counts da 0029),
// cada coluna pagina de 25 em 25 ("Carregar mais") e os headers mostram o total real
// e o valor somado da coluna — nada de carregar a base inteira no navegador.

const PAGE = 25;

const STAGES = [
  { key: 'novo', label: 'Novo', icon: 'sparkles', tone: 'info' },
  { key: 'enviado', label: 'E-mail enviado', icon: 'send', tone: 'accent' },
  { key: 'abriu', label: 'Abriu', icon: 'mail-open', tone: 'warning' },
  { key: 'clicou', label: 'Clicou', icon: 'mouse-pointer-click', tone: 'info' },
  { key: 'recuperado', label: 'Recuperado', icon: 'circle-check', tone: 'success' },
];

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
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lead.produto}{lead.valorCompra ? ` · ${KoblyApi.money(lead.valorCompra)}` : ''}
        </span>
      )}
      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', marginTop: 2 }}>
        {lead.telefone ? <span style={{ fontFamily: 'var(--font-mono)' }}>{lead.telefone}</span> : <span />}
        <span className="kbly-num">{lead.criadoEm}</span>
      </span>
    </button>
  );
}

// Estado por coluna: { rows, offset, loading, error } — paginado de forma independente.
const emptyCols = () => Object.fromEntries(STAGES.map((s) => [s.key, { rows: [], offset: 0, loading: true, error: null }]));

function KoblyPipeline() {
  const store = useKobly();
  const isGestor = store.role === 'Gestor';
  const clients = useAsync(() => (isGestor ? KoblyApi.listClients() : Promise.resolve([])), [store.role]);
  const tagsA = useAsync(() => KoblyApi.getTags(), []);
  const [view, setView] = useState('kanban');
  const [contaId, setContaId] = useState('');
  const [sel, setSel] = useState(null);
  const [counts, setCounts] = useState(null); // { stage: { total, valor } }
  const [cols, setCols] = useState(emptyCols);
  const [fatal, setFatal] = useState(null);
  const { isMobile } = useBreakpoint();

  const orgScope = isGestor ? (contaId || null) : (store.session.empresaId || null);

  const loadStage = useCallback(async (stage, offset) => {
    setCols((c) => ({ ...c, [stage]: { ...c[stage], loading: true, error: null } }));
    try {
      const { rows } = await KoblyApi.getLeadsPage({ empresaId: orgScope, stage, limit: PAGE, offset });
      setCols((c) => ({
        ...c,
        [stage]: { rows: offset === 0 ? rows : [...c[stage].rows, ...rows], offset: offset + rows.length, loading: false, error: null },
      }));
    } catch (e) {
      setCols((c) => ({ ...c, [stage]: { ...c[stage], loading: false, error: e.message } }));
    }
  }, [orgScope]);

  const loadAll = useCallback(async () => {
    setFatal(null);
    setCols(emptyCols());
    setCounts(null);
    try {
      const [cts] = await Promise.all([
        KoblyApi.getPipelineCounts(orgScope),
        ...STAGES.map((s) => loadStage(s.key, 0)),
      ]);
      setCounts(cts);
    } catch (e) {
      setFatal(e.message);
    }
  }, [orgScope, loadStage]);

  useEffect(() => { loadAll(); }, [loadAll]);

  if (fatal) return <ErrorState message={fatal} onRetry={loadAll} />;

  const totalLeads = counts ? Object.values(counts).reduce((s, c) => s + c.total, 0) : null;
  const loadingAll = counts === null;

  const columnHeader = (s) => {
    const ct = (counts && counts[s.key]) || { total: 0, valor: 0 };
    return (
      <div style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--surface-sunken)', display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 4 }}>
        <span style={{ display: 'inline-flex', width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', background: toneBg(s.tone), color: toneFg(s.tone), flex: 'none' }}>
          <Icon name={s.icon} size={13} />
        </span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)' }}>{s.label}</span>
          {ct.valor > 0 && <span className="kbly-num" style={{ display: 'block', fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>{KoblyApi.money(ct.valor)}</span>}
        </span>
        <Badge tone="neutral" size="sm">{KoblyApi.br(ct.total)}</Badge>
      </div>
    );
  };

  const columnBody = (s) => {
    const col = cols[s.key];
    const ct = (counts && counts[s.key]) || { total: 0 };
    const remaining = Math.max(0, ct.total - col.rows.length);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 24 }}>
        {col.error && <ErrorState compact message={col.error} onRetry={() => loadStage(s.key, col.rows.length)} />}
        {!col.error && col.rows.length === 0 && !col.loading && (
          <div style={{ border: '1px dashed var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '18px 10px', textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--text-subtle)' }}>
            Sem leads aqui
          </div>
        )}
        {col.rows.map((l) => <LeadCard key={l.id} lead={l} onClick={() => setSel(l)} />)}
        {col.loading && <SkeletonCards count={2} height={64} />}
        {!col.loading && remaining > 0 && (
          <Button variant="ghost" size="sm" iconLeft="chevrons-down" onClick={() => loadStage(s.key, col.rows.length)} style={{ justifyContent: 'center' }}>
            Carregar mais ({KoblyApi.br(remaining)})
          </Button>
        )}
      </div>
    );
  };

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

      {loadingAll ? (
        <SkeletonCards count={5} height={180} />
      ) : totalLeads === 0 ? (
        <EmptyState
          icon="kanban"
          title="Nenhum lead no pipeline ainda"
          message="Eles entram aqui quando um evento de checkout chega."
        />
      ) : view === 'kanban' ? (
        <div style={{ display: 'flex', gap: 14, overflowX: 'auto', scrollSnapType: isMobile ? 'x mandatory' : undefined, paddingBottom: 8, alignItems: 'flex-start' }}>
          {STAGES.map((s) => (
            <div key={s.key} style={{ flex: isMobile ? '0 0 220px' : '0 0 250px', width: isMobile ? 220 : 250, minWidth: 220, scrollSnapAlign: 'start', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderTop: `2px solid ${toneFg(s.tone)}`, borderRadius: 'var(--radius-md)', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {columnHeader(s)}
              {columnBody(s)}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {STAGES.map((s) => {
            const col = cols[s.key];
            const ct = (counts && counts[s.key]) || { total: 0 };
            const remaining = Math.max(0, ct.total - col.rows.length);
            return (
              <div key={s.key}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ display: 'inline-flex', width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', background: toneBg(s.tone), color: toneFg(s.tone) }}>
                    <Icon name={s.icon} size={13} />
                  </span>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)' }}>{s.label}</span>
                  <Badge tone="neutral">{KoblyApi.br(ct.total)}</Badge>
                  {ct.valor > 0 && <span className="kbly-num" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)' }}>{KoblyApi.money(ct.valor)}</span>}
                </div>
                {col.rows.length === 0 && !col.loading ? (
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', padding: '2px 2px 8px' }}>Nenhum lead nesta etapa.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                    {col.rows.map((l) => <LeadCard key={l.id} lead={l} onClick={() => setSel(l)} />)}
                  </div>
                )}
                {!col.loading && remaining > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <Button variant="ghost" size="sm" iconLeft="chevrons-down" onClick={() => loadStage(s.key, col.rows.length)}>
                      Carregar mais ({KoblyApi.br(remaining)})
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {sel && <LeadDrawer lead={sel} onClose={() => setSel(null)} tags={tagsA.data || []} />}
    </div>
  );
}

export { KoblyPipeline };
