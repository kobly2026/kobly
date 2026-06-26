import React, { useState } from 'react';
import { KoblyApi } from '@/api/mockApi.js';
import { KoblyAI } from '@/api/ai.js';
import { KoblyMockDB } from '@/api/mockData.js';
import { Badge, Button, Card, Checklist, DataTable, Icon, StatusLine } from '@/ds';
import { Chart, KoblyChartColors, Sparkline } from '@/lib/charts.jsx';
import { useAsync } from '@/lib/hooks.jsx';
import { useKoblyTweak } from '@/lib/tweaks.jsx';
import { AISuggestion, Drawer, EmptyState, Segmented, SkeletonDashboard } from '@/lib/ui.jsx';
import { useKobly } from '@/store/store.jsx';

// Kobly — Dashboard interativo. Barra de período, KPIs com sparkline clicáveis
// (abrem drill-down com gráfico), tendência principal, breakdown por evento,
// funil de entrega, feed ao vivo e visão consolidada (Gestor). KoblyDashboard
const C = KoblyChartColors;

const RANGE_OPTS = [
  { value: 'hoje', label: 'Hoje' }, { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' }, { value: '90d', label: '90 dias' },
];

// ---- Barra de período + ações ---------------------------------------------
function ControlBar({ range, onRange, onReload }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <Segmented value={range} onChange={onRange} options={RANGE_OPTS} label="Período" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginInlineStart: 'auto', color: 'var(--status-success-fg)', fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-semibold)' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--status-success-fg)', boxShadow: '0 0 0 3px var(--status-success-bg)' }} />
        Ao vivo
      </div>
      <Button variant="ghost" size="sm" iconLeft="refresh-cw" onClick={onReload}>Atualizar</Button>
    </div>
  );
}

// ---- KPI clicável com sparkline -------------------------------------------
function KpiTile({ m, onOpen }) {
  const deltaUp = m.deltaTone === 'up';
  return (
    <button
      onClick={() => onOpen(m)}
      className="kbly-kpi"
      style={{
        textAlign: 'start', cursor: 'pointer', fontFamily: 'var(--font-sans)',
        background: 'var(--surface-card)', border: `1px solid ${m.accent ? 'var(--accent)' : 'var(--border-subtle)'}`,
        borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: '16px 18px 8px',
        display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0,
        transition: 'border-color var(--dur-fast), transform var(--dur-fast)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ display: 'inline-flex', width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', background: m.accent ? 'var(--accent)' : 'var(--accent-soft)', color: m.accent ? 'var(--text-on-accent)' : 'var(--accent)', flex: 'none' }}>
          <Icon name={m.icon} size={16} />
        </span>
        <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 'var(--fw-semibold)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', lineHeight: 1.2 }}>{m.label}</span>
        <Icon name="arrow-up-right" size={14} style={{ color: 'var(--text-subtle)', marginInlineStart: 'auto', flex: 'none', alignSelf: 'flex-start' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)', letterSpacing: 'var(--ls-tight)' }}>{m.value}</span>
        {m.delta && <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-semibold)', color: deltaUp ? 'var(--status-success-fg)' : 'var(--text-muted)' }}>{m.delta}</span>}
      </div>
      <div style={{ margin: '0 -6px' }}>
        <Sparkline data={m.spark || []} color={m.accent ? C.accent : (m.deltaTone === 'up' ? C.green : C.accent400)} height={34} />
      </div>
    </button>
  );
}

// ---- Drill-down de KPI -----------------------------------------------------
function KpiDrill({ metric, drill, range, onClose }) {
  if (!metric) return null;
  const d = drill[metric.key];
  const fmt = (v) => d && d.unit === 'pct' ? v + '%' : KoblyApi.br(v);
  return (
    <Drawer open={!!metric} onClose={onClose} title={metric.label} subtitle={`Detalhe do período · ${RANGE_OPTS.find((r) => r.value === range).label}`} width={520}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
        <span style={{ fontSize: '34px', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)', letterSpacing: 'var(--ls-tight)' }}>{metric.value}</span>
        {metric.delta && <Badge tone={metric.deltaTone === 'up' ? 'success' : 'neutral'} dot>{metric.delta} vs. período anterior</Badge>}
      </div>
      {d && (
        <div style={{ marginTop: 8 }}>
          <Chart
            type="area" height={260}
            series={[{ name: d.title, data: d.series }]}
            options={{
              colors: [d.color.startsWith('var') ? C.accent : d.color],
              stroke: { curve: 'smooth', width: 2.5 },
              fill: { type: 'gradient', gradient: { opacityFrom: 0.3, opacityTo: 0.02 } },
              xaxis: { categories: d.labels, labels: { rotate: 0, hideOverlappingLabels: true, style: { fontSize: '11px' } }, axisBorder: { color: C.grid }, axisTicks: { color: C.grid } },
              yaxis: { labels: { formatter: fmt, style: { fontSize: '11px' } } },
              tooltip: { y: { formatter: fmt } },
              markers: { size: 0, hover: { size: 5 } },
            }}
          />
        </div>
      )}
      <div style={{ marginTop: 18, background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 16 }}>
        <StatusLine tone="info" icon="sparkles">Tendência {metric.deltaTone === 'up' ? 'de alta' : 'estável'} no período. Clique em outro KPI para comparar.</StatusLine>
      </div>
    </Drawer>
  );
}

// ---- Tendência principal (enviados x recuperadas) -------------------------
function TrendCard({ trend }) {
  return (
    <Card title="Tendência de recuperação" subtitle="E-mails enviados x vendas recuperadas">
      <Chart
        type="area" height={300}
        series={[
          { name: 'E-mails enviados', data: trend.enviados },
          { name: 'Vendas recuperadas', data: trend.recuperadas },
        ]}
        options={{
          colors: [C.accent, C.green],
          stroke: { curve: 'smooth', width: [2.5, 2.5] },
          fill: { type: 'gradient', gradient: { opacityFrom: 0.28, opacityTo: 0.02 } },
          xaxis: { categories: trend.labels, labels: { rotate: 0, hideOverlappingLabels: true, style: { fontSize: '11px' } }, axisBorder: { color: C.grid }, axisTicks: { color: C.grid }, tickAmount: 8 },
          yaxis: { labels: { formatter: (v) => KoblyApi.br(Math.round(v)), style: { fontSize: '11px' } } },
          legend: { position: 'top', horizontalAlign: 'left', offsetY: -4 },
          tooltip: { y: { formatter: (v) => KoblyApi.br(v) } },
          markers: { size: 0, hover: { size: 5 } },
        }}
      />
    </Card>
  );
}

// ---- Breakdown por evento (donut) -----------------------------------------
function BreakdownCard({ breakdown }) {
  const palette = [C.accent, C.green, C.amber, C.red, C.accent400, '#a8a8a8'];
  return (
    <Card title="Disparos por gatilho" subtitle="Distribuição no período">
      <Chart
        type="donut" height={300}
        series={breakdown.map((b) => b.valor)}
        options={{
          labels: breakdown.map((b) => b.nome),
          colors: palette,
          stroke: { colors: ['var(--surface-card)'], width: 2 },
          legend: { position: 'bottom', fontSize: '12px' },
          plotOptions: { pie: { donut: { size: '64%', labels: { show: true, total: { show: true, label: 'Total', color: C.textMuted, formatter: (w) => KoblyApi.br(w.globals.seriesTotals.reduce((a, b) => a + b, 0)) }, value: { color: C.textStrong, fontWeight: 700, formatter: (v) => KoblyApi.br(v) } } } } },
          tooltip: { y: { formatter: (v) => KoblyApi.br(v) } },
        }}
      />
    </Card>
  );
}

// ---- Funil de entrega ------------------------------------------------------
function FunnelCard({ funnel }) {
  const max = funnel[0].valor || 1;
  return (
    <Card title="Funil de entrega" subtitle="Do evento à venda recuperada">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {funnel.map((f, i) => {
          const pct = Math.round((f.valor / max) * 100);
          const conv = i === 0 ? 100 : Math.round((f.valor / funnel[i - 1].valor) * 100);
          return (
            <div key={f.etapa} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 140, flex: 'none', fontSize: 'var(--text-sm)', color: 'var(--text-body)' }}>{f.etapa}</span>
              <div style={{ flex: 1, height: 24, borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', overflow: 'hidden', position: 'relative' }}>
                <div style={{ width: pct + '%', height: '100%', background: i === funnel.length - 1 ? 'var(--status-success-fg)' : 'var(--accent)', opacity: 0.85, borderRadius: 'var(--radius-sm)', transition: 'width 420ms var(--ease-out)' }} />
              </div>
              <span style={{ width: 78, flex: 'none', textAlign: 'end', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--text-strong)' }}>{KoblyApi.br(f.valor)}</span>
              <span style={{ width: 46, flex: 'none', textAlign: 'end', fontSize: 'var(--text-xs)', color: i === 0 ? 'var(--text-subtle)' : (conv >= 60 ? 'var(--status-success-fg)' : 'var(--text-muted)') }}>{i === 0 ? '—' : conv + '%'}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ---- Feed de eventos ao vivo ----------------------------------------------
function EventRow({ ev }) {
  const DB = KoblyMockDB;
  const tone = DB.eventTone[ev.tipoEvento] || 'neutral';
  return (
    <div className="kbly-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ display: 'inline-flex', width: 32, height: 32, flex: 'none', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', background: `var(--status-${tone}-bg)`, color: `var(--status-${tone}-fg)` }}>
        <Icon name="zap" size={15} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-strong)', fontWeight: 'var(--fw-medium)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.email}</div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)' }}>{ev.provider} · {ev.campanha}</div>
      </div>
      <Badge tone={tone} dot>{ev.tipoEvento}</Badge>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', width: 62, textAlign: 'end', fontFamily: 'var(--font-mono)', flex: 'none' }}>{ev.when}</span>
    </div>
  );
}

function KoblyDashboard() {
  const store = useKobly();
  const showOnboarding = useKoblyTweak('showOnboarding', true);
  const [range, setRange] = useState('30d');
  const [drill, setDrill] = useState(null);
  const a = useAsync(() => KoblyApi.getDashboard(store.role, store.session.empresaId, range), [store.role, store.session.empresaId, range]);

  if (a.status === 'loading') return React.createElement(SkeletonDashboard);
  if (a.status === 'error') {
    return <EmptyState icon="circle-alert" tone="danger" title="Falha ao carregar o painel" message={a.error} action={<Button variant="secondary" size="sm" iconLeft="refresh-cw" onClick={a.reload}>Tentar novamente</Button>} />;
  }
  const d = a.data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ControlBar range={range} onRange={setRange} onReload={a.reload} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 14 }}>
        {d.metrics.map((m) => <KpiTile key={m.key} m={m} onOpen={setDrill} />)}
      </div>

      <AISuggestion title="Sugestão da IA — visão geral" load={() => KoblyAI.suggestForDashboard(store.view)} />

      {d.consolidated ? (
        <React.Fragment>
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, alignItems: 'start' }}>
            <TrendCard trend={d.trend} />
            <BreakdownCard breakdown={d.breakdown} />
          </div>
          <Card title="Contas gerenciadas" subtitle="Desempenho por conta de cliente" pad={false}>
            {React.createElement(KoblyAccountsTable, { rows: d.accounts })}
          </Card>
        </React.Fragment>
      ) : (
        <React.Fragment>
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, alignItems: 'start' }}>
            <TrendCard trend={d.trend} />
            <BreakdownCard breakdown={d.breakdown} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: showOnboarding ? '1.6fr 1fr' : '1fr', gap: 16, alignItems: 'start' }}>
            <Card title="Eventos recentes" subtitle="Webhooks de checkout aceitos" action={<Badge tone="success" dot>ao vivo</Badge>}>
              {d.events.length === 0
                ? <EmptyState compact icon="inbox" title="Nenhum evento ainda" message="Simule um webhook para iniciar a cadência." />
                : <div>{d.events.map((ev) => <EventRow key={ev.id} ev={ev} />)}</div>}
            </Card>
            {showOnboarding && <Checklist items={d.onboarding} />}
          </div>
          <FunnelCard funnel={d.funnel} />
        </React.Fragment>
      )}

      <KpiDrill metric={drill} drill={d.metricDrill} range={range} onClose={() => setDrill(null)} />
    </div>
  );
}

// Tabela de contas (reusada no Gestor)
function KoblyAccountsTable({ rows }) {
  const DB = KoblyMockDB;
  return (
    <DataTable
      rowKey="id"
      columns={[
        { key: 'nome', header: 'Conta', render: (r) => <span style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)' }}>{r.nome}</span> },
        { key: 'segmento', header: 'Segmento' },
        { key: 'plano', header: 'Plano', render: (r) => <Badge tone="neutral">{r.plano}</Badge> },
        { key: 'leads', header: 'Leads', align: 'end', render: (r) => KoblyApi.br(r.leads) },
        { key: 'campanhasAtivas', header: 'Ativas', align: 'end' },
        { key: 'criticidade', header: 'Criticidade', render: (r) => <Badge tone={DB.optionSets.StatusCriticidade[r.criticidade]} dot>{r.criticidade}</Badge> },
      ]}
      rows={rows}
    />
  );
}

export { KoblyDashboard, KoblyAccountsTable };
