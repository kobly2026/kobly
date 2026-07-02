import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KoblyApi } from '@/api/mockApi.js';
import { KoblyMockDB } from '@/api/mockData.js';
import { Avatar, Badge, Button, Icon, Input, Select } from '@/ds';
import { PageIntro, useAsync } from '@/lib/hooks.jsx';
import { useBreakpoint } from '@/lib/responsive.jsx';
import { EmptyState, ErrorState, Segmented, SkeletonCards } from '@/lib/ui.jsx';
import { LeadDrawer } from '@/routes/Leads.jsx';
import { useKobly } from '@/store/store.jsx';

// Kobly — Pipeline de recuperação (kanban / lista), server-driven para escalar:
// estágio derivado NO BANCO (RPCs da 0029), colunas paginadas de 25 em 25, busca
// server-side. Camada de negócio na tela: resumo (valor em aberto / recuperado /
// conversão), proporção por coluna e cards densos (valor, último evento, tags,
// métricas de e-mail e tempo de casa).

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

// Tempo relativo curto para "está aqui há X" (a data exata vive no drawer).
function relDays(iso) {
  if (!iso) return '';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  if (d <= 0) return 'hoje';
  if (d === 1) return 'há 1 dia';
  if (d < 30) return `há ${d} dias`;
  const m = Math.floor(d / 30);
  return `há ${m} ${m === 1 ? 'mês' : 'meses'}`;
}

// Card denso: avatar + nome + valor em destaque, produto, último evento com tom,
// tags, mini-métricas de e-mail (só as > 0) e tempo desde a entrada.
function LeadCard({ lead, tagNames, onClick }) {
  const DB = KoblyMockDB;
  const nome = [lead.nome, lead.sobrenome].filter(Boolean).join(' ') || lead.email;
  const evTone = DB.eventTone[lead.ultimoEvento] || 'neutral';
  const m = lead.metricas || {};
  const tags = (lead.tags || []).map((tid) => tagNames[tid]).filter(Boolean);
  return (
    <button
      onClick={onClick}
      className="kbly-lift"
      style={{
        width: '100%', textAlign: 'start', cursor: 'pointer', fontFamily: 'var(--font-sans)',
        background: 'var(--surface-card)', border: '1px solid var(--border-subtle)',
        borderInlineStart: `3px solid var(--status-${evTone === 'accent' ? 'info' : evTone}-fg)`,
        borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-sm)',
        padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Avatar name={nome} size="sm" />
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</span>
          <span style={{ display: 'block', fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.email}</span>
        </span>
        {lead.valorCompra > 0 && (
          <span className="kbly-num" style={{ flex: 'none', fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)' }}>
            {KoblyApi.money(lead.valorCompra)}
          </span>
        )}
      </span>

      {lead.produto && (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.produto}</span>
      )}

      {tags.length > 0 && (
        <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {tags.slice(0, 2).map((t) => <Badge key={t} tone="info" size="sm">{t}</Badge>)}
          {tags.length > 2 && <Badge tone="neutral" size="sm">+{tags.length - 2}</Badge>}
        </span>
      )}

      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTop: '1px solid var(--border-subtle)', paddingTop: 7 }}>
        <Badge tone={evTone} size="sm" dot>{lead.ultimoEvento || '—'}</Badge>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', flex: 'none' }}>
          {m.enviados > 0 && <span className="kbly-num" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Icon name="send" size={11} />{m.enviados}</span>}
          {m.aberturas > 0 && <span className="kbly-num" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Icon name="eye" size={11} />{m.aberturas}</span>}
          {m.cliques > 0 && <span className="kbly-num" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Icon name="mouse-pointer-click" size={11} />{m.cliques}</span>}
          <span>{relDays(lead.createdAt)}</span>
        </span>
      </span>
    </button>
  );
}

// Resumo do board — os números que um dono de operação quer ver primeiro.
function SummaryStrip({ counts }) {
  const total = Object.values(counts).reduce((s, c) => s + c.total, 0);
  const recTotal = (counts.recuperado || {}).total || 0;
  const recValor = (counts.recuperado || {}).valor || 0;
  const abertoValor = STAGES.filter((s) => s.key !== 'recuperado')
    .reduce((s, st) => s + ((counts[st.key] || {}).valor || 0), 0);
  const conversao = total ? recTotal / total : 0;
  const items = [
    { icon: 'users-round', tone: 'info', label: 'Leads no pipeline', value: KoblyApi.br(total) },
    { icon: 'wallet', tone: 'warning', label: 'Valor em recuperação', value: KoblyApi.money(abertoValor) },
    { icon: 'circle-check', tone: 'success', label: 'Recuperado', value: `${KoblyApi.money(recValor)} · ${KoblyApi.br(recTotal)}` },
    { icon: 'trending-up', tone: 'accent', label: 'Conversão do pipeline', value: KoblyApi.pct(conversao) },
  ];
  return (
    <div className="kbly-grid-kpi" style={{ gap: 12 }}>
      {items.map((it) => (
        <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: '12px 14px' }}>
          <span style={{ display: 'inline-flex', width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', background: toneBg(it.tone), color: toneFg(it.tone), flex: 'none' }}>
            <Icon name={it.icon} size={15} />
          </span>
          <span style={{ minWidth: 0 }}>
            <span className="kbly-num" style={{ display: 'block', fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)', whiteSpace: 'nowrap' }}>{it.value}</span>
            <span style={{ display: 'block', fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 'var(--ls-eyebrow)' }}>{it.label}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

// Estado por coluna: { rows, loading, error } — paginação independente.
const emptyCols = () => Object.fromEntries(STAGES.map((s) => [s.key, { rows: [], loading: true, error: null }]));

function KoblyPipeline() {
  const store = useKobly();
  const isGestor = store.role === 'Gestor';
  const clients = useAsync(() => (isGestor ? KoblyApi.listClients() : Promise.resolve([])), [store.role]);
  const tagsA = useAsync(() => KoblyApi.getTags(), []);
  const [view, setView] = useState('kanban');
  const [contaId, setContaId] = useState('');
  const [q, setQ] = useState('');
  const [qDeb, setQDeb] = useState('');
  const [sel, setSel] = useState(null);
  const [counts, setCounts] = useState(null); // { stage: { total, valor } }
  const [cols, setCols] = useState(emptyCols);
  const [fatal, setFatal] = useState(null);
  const { isMobile } = useBreakpoint();

  useEffect(() => {
    const t = setTimeout(() => setQDeb(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const orgScope = isGestor ? (contaId || null) : (store.session.empresaId || null);
  const tagNames = useMemo(() => Object.fromEntries((tagsA.data || []).map((t) => [t.id, t.nome])), [tagsA.data]);

  const loadStage = useCallback(async (stage, offset) => {
    setCols((c) => ({ ...c, [stage]: { ...c[stage], loading: true, error: null } }));
    try {
      const { rows } = await KoblyApi.getLeadsPage({ empresaId: orgScope, stage, search: qDeb, limit: PAGE, offset });
      setCols((c) => ({
        ...c,
        [stage]: { rows: offset === 0 ? rows : [...c[stage].rows, ...rows], loading: false, error: null },
      }));
    } catch (e) {
      setCols((c) => ({ ...c, [stage]: { ...c[stage], loading: false, error: e.message } }));
    }
  }, [orgScope, qDeb]);

  const loadAll = useCallback(async () => {
    setFatal(null);
    setCols(emptyCols());
    try {
      // Com busca ativa, as contagens do header passam a refletir o filtro
      // (derivadas das páginas não dá — usamos o total_count do RPC por estágio).
      const [cts] = await Promise.all([
        qDeb
          ? Promise.all(STAGES.map(async (s) => {
              const { total } = await KoblyApi.getLeadsPage({ empresaId: orgScope, stage: s.key, search: qDeb, limit: 1, offset: 0 });
              return [s.key, { total, valor: 0 }];
            })).then(Object.fromEntries)
          : KoblyApi.getPipelineCounts(orgScope),
        ...STAGES.map((s) => loadStage(s.key, 0)),
      ]);
      setCounts(cts);
    } catch (e) {
      setFatal(e.message);
    }
  }, [orgScope, qDeb, loadStage]);

  useEffect(() => { loadAll(); }, [loadAll]);

  if (fatal) return <ErrorState message={fatal} onRetry={loadAll} />;

  const totalLeads = counts ? Object.values(counts).reduce((s, c) => s + c.total, 0) : null;
  const maxStage = counts ? Math.max(1, ...Object.values(counts).map((c) => c.total)) : 1;
  const loadingAll = counts === null;

  const columnHeader = (s) => {
    const ct = (counts && counts[s.key]) || { total: 0, valor: 0 };
    const share = totalLeads ? ct.total / totalLeads : 0;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-flex', width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', background: toneBg(s.tone), color: toneFg(s.tone), flex: 'none' }}>
            <Icon name={s.icon} size={14} />
          </span>
          <span style={{ flex: 1, fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)' }}>{s.label}</span>
          <span className="kbly-num" style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)' }}>{KoblyApi.br(ct.total)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span className="kbly-num" style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>
            {ct.valor > 0 ? KoblyApi.money(ct.valor) : '—'}
          </span>
          <span className="kbly-num" style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>{totalLeads ? KoblyApi.pct(share) : ''}</span>
        </div>
        {/* proporção da coluna vs. a maior — leitura instantânea da distribuição */}
        <div style={{ height: 3, borderRadius: 'var(--radius-pill)', background: 'var(--surface-raised)', overflow: 'hidden' }}>
          <div style={{ width: `${Math.round((ct.total / maxStage) * 100)}%`, height: '100%', background: toneFg(s.tone), borderRadius: 'var(--radius-pill)', transition: 'width var(--dur-med) var(--ease-out)' }} />
        </div>
      </div>
    );
  };

  const columnBody = (s, { scroll = true } = {}) => {
    const col = cols[s.key];
    const ct = (counts && counts[s.key]) || { total: 0 };
    const remaining = Math.max(0, ct.total - col.rows.length);
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 8, minHeight: 40, flex: 1,
        ...(scroll ? { overflowY: 'auto', paddingRight: 2 } : {}),
      }}>
        {col.error && <ErrorState compact message={col.error} onRetry={() => loadStage(s.key, col.rows.length)} />}
        {!col.error && col.rows.length === 0 && !col.loading && (
          <div style={{ border: '1px dashed var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '22px 10px', textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <Icon name={s.icon} size={16} style={{ opacity: 0.5 }} />
            Sem leads aqui
          </div>
        )}
        {col.rows.map((l) => <LeadCard key={l.id} lead={l} tagNames={tagNames} onClick={() => setSel(l)} />)}
        {col.loading && <SkeletonCards count={2} height={96} />}
        {!col.loading && remaining > 0 && (
          <Button variant="ghost" size="sm" iconLeft="chevrons-down" onClick={() => loadStage(s.key, col.rows.length)} style={{ justifyContent: 'center' }}>
            Carregar mais ({KoblyApi.br(remaining)})
          </Button>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageIntro action={<Segmented value={view} onChange={setView} options={[{ value: 'kanban', label: 'Kanban' }, { value: 'lista', label: 'Lista' }]} />}>
        Pipeline de recuperação — cada lead avança de coluna conforme a jornada real (evento → e-mail → abriu → clicou → recuperado).
      </PageIntro>

      <div className="kbly-toolbar" style={{ gap: 10 }}>
        <div style={{ flex: '1 1 260px', maxWidth: 380, minWidth: 0 }}>
          <Input icon="search" placeholder="Buscar no pipeline (nome, e-mail, produto)…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {isGestor && (
          <Select
            value={contaId}
            onChange={(e) => setContaId(e.target.value)}
            options={[{ value: '', label: 'Todas as contas' }, ...((clients.data || []).map((c) => ({ value: c.id, label: c.nome })))]}
            style={{ minWidth: 200 }}
          />
        )}
        {q && (
          <button onClick={() => setQ('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', padding: '8px 4px' }}>
            Limpar busca
          </button>
        )}
      </div>

      {loadingAll ? (
        <SkeletonCards count={5} height={220} />
      ) : totalLeads === 0 ? (
        <EmptyState
          icon="kanban"
          title={qDeb ? 'Nada encontrado no pipeline' : 'Nenhum lead no pipeline ainda'}
          message={qDeb ? 'Ajuste a busca — nomes, e-mails e produtos contam.' : 'Eles entram aqui quando um evento de checkout chega.'}
        />
      ) : (
        <>
          {!qDeb && <SummaryStrip counts={counts} />}

          {view === 'kanban' ? (
            <div style={{ display: 'flex', gap: 14, overflowX: 'auto', scrollSnapType: isMobile ? 'x mandatory' : undefined, paddingBottom: 8, alignItems: 'stretch' }}>
              {STAGES.map((s) => (
                <div key={s.key} style={{
                  flex: isMobile ? '0 0 240px' : '1 0 260px', minWidth: 240, scrollSnapAlign: 'start',
                  background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)',
                  borderTop: `2px solid ${toneFg(s.tone)}`, borderRadius: 'var(--radius-md)', padding: 12,
                  display: 'flex', flexDirection: 'column', gap: 10,
                  maxHeight: 'calc(100dvh - var(--topbar-height) - 320px)', minHeight: 320,
                }}>
                  {columnHeader(s)}
                  {columnBody(s)}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {STAGES.map((s) => {
                const col = cols[s.key];
                const ct = (counts && counts[s.key]) || { total: 0, valor: 0 };
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
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                        {col.rows.map((l) => <LeadCard key={l.id} lead={l} tagNames={tagNames} onClick={() => setSel(l)} />)}
                      </div>
                    )}
                    {col.loading && <SkeletonCards count={3} height={96} />}
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
        </>
      )}

      {sel && <LeadDrawer lead={sel} onClose={() => setSel(null)} tags={tagsA.data || []} />}
    </div>
  );
}

export { KoblyPipeline };
