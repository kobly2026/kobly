import React, { useState, useMemo } from 'react';
import { KoblyApi } from '@/api/mockApi.js';
import { KoblyMockDB } from '@/api/mockData.js';
import { Badge, DataTable, Icon, IconButton, Input, Select } from '@/ds';
import { Field, useAsync } from '@/lib/hooks.jsx';
import { Drawer, SkeletonRow } from '@/lib/ui.jsx';
import { useKobly } from '@/store/store.jsx';

// Kobly — Leads (CRM). 4 cards de status de e-mail no topo + tabela paginada com
// busca + drawer de detalhe (InfoLeads). KoblyLeads
const PAGE = 8;

const STATUS_CARDS = [
  { key: 'processados', label: 'E-mails processados', icon: 'inbox', tone: 'info' },
  { key: 'enviados', label: 'E-mails enviados', icon: 'send', tone: 'success' },
  { key: 'rejeitados', label: 'E-mails rejeitados', icon: 'circle-x', tone: 'danger' },
  { key: 'adiados', label: 'Na fila de envio', icon: 'clock', tone: 'warning' },
];

function StatusCard({ c, value }) {
  return (
    <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <span style={{ display: 'inline-flex', width: 40, height: 40, flex: 'none', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-md)', background: `var(--status-${c.tone}-bg)`, color: `var(--status-${c.tone}-fg)` }}>
        <Icon name={c.icon} size={19} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)', lineHeight: 1.1 }}>{KoblyApi.br(value)}</div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{c.label}</div>
      </div>
    </div>
  );
}

// Cada tipo de item da timeline tem ícone + cor próprios.
function timelineVisual(item, DB) {
  if (item.kind === 'evento') {
    return { icon: 'zap', tone: DB.eventTone[item.tipoEvento] || 'info' };
  }
  if (item.kind === 'email') {
    return { icon: 'mail', tone: item.enviado ? 'success' : 'warning' };
  }
  return { icon: 'tag', tone: 'info' }; // tag
}

function LeadTimeline({ leadId }) {
  const t = useAsync(() => KoblyApi.getLeadTimeline(leadId), [leadId]);
  const DB = KoblyMockDB;
  const items = t.data || [];

  if (t.status === 'loading') return <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', padding: '4px 0' }}>Carregando jornada…</div>;
  if (!items.length) return <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', padding: '4px 0' }}>Nenhuma atividade registrada ainda para este lead.</div>;

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {items.map((it, i) => {
        const v = timelineVisual(it, DB);
        const last = i === items.length - 1;
        return (
          <div key={it.id} style={{ display: 'flex', gap: 12, position: 'relative' }}>
            {/* trilho + marcador */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none', width: 30 }}>
              <span style={{ display: 'inline-flex', width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: `var(--status-${v.tone}-bg)`, color: `var(--status-${v.tone}-fg)`, flex: 'none', zIndex: 1 }}>
                <Icon name={v.icon} size={15} />
              </span>
              {!last && <span style={{ flex: 1, width: 2, background: 'var(--border-subtle)', minHeight: 14 }} />}
            </div>
            {/* conteúdo */}
            <div style={{ flex: 1, paddingBottom: last ? 0 : 16, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                <span style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)', fontSize: 'var(--text-sm)' }}>{it.titulo}</span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)', flex: 'none' }}>{it.quando}</span>
              </div>
              {it.sub && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>{it.sub}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LeadDrawer({ lead, onClose, tags = [] }) {
  const DB = KoblyMockDB;
  if (!lead) return null;
  const tagNames = (lead.tags || []).map((tid) => (tags.find((t) => t.id === tid) || {}).nome).filter(Boolean);
  const sectionLabel = { fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', fontWeight: 'var(--fw-semibold)', marginBottom: 8 };
  return (
    <Drawer open={!!lead} onClose={onClose} title={[lead.nome, lead.sobrenome].filter(Boolean).join(' ')} subtitle={lead.email} width={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Telefone" mono>{lead.telefone}</Field>
          <Field label="Método">{lead.metodoPagamento}</Field>
          <Field label="Produto">{lead.produto}</Field>
          <Field label="Valor">{KoblyApi.money(lead.valorCompra)}</Field>
          <Field label="Último evento"><Badge tone={DB.eventTone[lead.ultimoEvento] || 'neutral'} dot>{lead.ultimoEvento}</Badge></Field>
          <Field label="Criado em" mono>{lead.criadoEm}</Field>
        </div>
        <div>
          <div style={sectionLabel}>Tags</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {tagNames.length ? tagNames.map((t) => <Badge key={t} tone="info">{t}</Badge>) : <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Sem tags</span>}
          </div>
        </div>
        <div style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 16, display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
          {[['Enviados', lead.metricas.enviados], ['Aberturas', lead.metricas.aberturas], ['Cliques', lead.metricas.cliques]].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)' }}>{v}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{k}</div>
            </div>
          ))}
        </div>
        <div>
          <div style={sectionLabel}>Jornada do lead</div>
          <LeadTimeline leadId={lead.id} />
        </div>
      </div>
    </Drawer>
  );
}

function KoblyLeads() {
  const store = useKobly();
  const isGestor = store.role === 'Gestor';
  const a = useAsync(() => KoblyApi.listLeads(), [store.role]);
  const clients = useAsync(() => (isGestor ? KoblyApi.listClients() : Promise.resolve([])), [store.role]);
  const [q, setQ] = useState('');
  const [evt, setEvt] = useState('');       // filtro por último evento
  const [contaId, setContaId] = useState(''); // conta em foco (Gestor); '' = todas
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState(null);
  const DB = KoblyMockDB;

  const rows = (a.data && a.data.rows) || [];
  const status = (a.data && a.data.status) || {};
  const contaNome = useMemo(() => Object.fromEntries((clients.data || []).map((c) => [c.id, c.nome])), [clients.data]);
  const eventosPresentes = useMemo(() => Array.from(new Set(rows.map((l) => l.ultimoEvento).filter(Boolean))), [rows]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((l) => {
      if (isGestor && contaId && l.empresaId !== contaId) return false;
      if (evt && l.ultimoEvento !== evt) return false;
      if (t && !`${l.nome} ${l.sobrenome || ''} ${l.email} ${l.produto || ''}`.toLowerCase().includes(t)) return false;
      return true;
    });
  }, [rows, q, evt, contaId, isGestor]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const cur = Math.min(page, pages);
  const slice = filtered.slice((cur - 1) * PAGE, cur * PAGE);
  const hasFilters = !!(q.trim() || evt || (isGestor && contaId));

  const inputW = { minWidth: 0 };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {STATUS_CARDS.map((c) => <StatusCard key={c.key} c={c} value={status[c.key] || 0} />)}
      </div>

      <p style={{ margin: 0, fontSize: 'var(--text-md)', color: 'var(--text-muted)', maxWidth: 620 }}>Leads gerados pelos webhooks de checkout. Clique em um lead para ver a jornada completa — evento, e-mails enviados e tags.</p>

      {/* Barra de filtros */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 260px', ...inputW }}>
          <Input icon="search" placeholder="Buscar por nome, e-mail, produto…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
        {isGestor && (
          <Select
            value={contaId}
            onChange={(e) => { setContaId(e.target.value); setPage(1); }}
            options={[{ value: '', label: 'Todas as contas' }, ...((clients.data || []).map((c) => ({ value: c.id, label: c.nome })))]}
            style={{ minWidth: 190 }}
          />
        )}
        <Select
          value={evt}
          onChange={(e) => { setEvt(e.target.value); setPage(1); }}
          options={[{ value: '', label: 'Todos os eventos' }, ...eventosPresentes.map((x) => ({ value: x, label: x }))]}
          style={{ minWidth: 180 }}
        />
        {hasFilters && (
          <button onClick={() => { setQ(''); setEvt(''); setContaId(''); setPage(1); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', padding: '8px 4px' }}>
            Limpar filtros
          </button>
        )}
      </div>

      <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        {a.status === 'loading'
          ? <div style={{ padding: 20 }}>{Array.from({ length: 6 }).map((_, i) => React.createElement(SkeletonRow || 'div', { key: i }))}</div>
          : (
            <DataTable
              rowKey="id"
              empty={hasFilters ? 'Nenhum lead corresponde aos filtros.' : 'Nenhum lead ainda. Eles aparecem aqui quando um evento de checkout chega.'}
              columns={[
                { key: 'nome', header: 'Lead', render: (r) => (
                  <button onClick={() => setSel(r)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'start', fontFamily: 'var(--font-sans)' }}>
                    <span style={{ display: 'block', fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)' }}>{[r.nome, r.sobrenome].filter(Boolean).join(' ')}</span>
                    <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{r.email}{isGestor && !contaId && contaNome[r.empresaId] ? ` · ${contaNome[r.empresaId]}` : ''}</span>
                  </button>
                ) },
                { key: 'produto', header: 'Produto' },
                { key: 'valorCompra', header: 'Valor', align: 'end', render: (r) => KoblyApi.money(r.valorCompra) },
                { key: 'metricas', header: 'Métricas', render: (r) => (
                  <span style={{ display: 'inline-flex', gap: 14, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="eye" size={14} />{r.metricas.aberturas}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="mouse-pointer-click" size={14} />{r.metricas.cliques}</span>
                  </span>
                ) },
                { key: 'ultimoEvento', header: 'Último evento', render: (r) => <Badge tone={DB.eventTone[r.ultimoEvento] || 'neutral'} dot>{r.ultimoEvento}</Badge> },
                { key: 'acao', header: '', align: 'end', width: 48, render: (r) => <IconButton icon="chevron-right" size="sm" aria-label="Ver lead" onClick={() => setSel(r)} /> },
              ]}
              rows={slice}
            />
          )}
      </div>

      {filtered.length > PAGE && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Página {cur} de {pages} · {filtered.length} leads</span>
          <IconButton icon="chevron-left" variant="secondary" size="sm" aria-label="Anterior" disabled={cur <= 1} onClick={() => setPage(cur - 1)} />
          <IconButton icon="chevron-right" variant="secondary" size="sm" aria-label="Próxima" disabled={cur >= pages} onClick={() => setPage(cur + 1)} />
        </div>
      )}
      {sel && <LeadDrawer lead={sel} onClose={() => setSel(null)} tags={(a.data && a.data.tags) || []} />}
    </div>
  );
}

export { KoblyLeads, LeadDrawer };
