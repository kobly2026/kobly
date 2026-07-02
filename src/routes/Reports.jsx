import React, { useState } from 'react';
import { KoblyApi } from '@/api/mockApi.js';
import { KoblyMockDB } from '@/api/mockData.js';
import { Badge, Card, DataTable, StatusLine } from '@/ds';
import { Chart, KoblyChartColors } from '@/lib/charts.jsx';
import { useAsync } from '@/lib/hooks.jsx';
import { Segmented, SkeletonCards, ErrorState, EmptyState } from '@/lib/ui.jsx';

// Kobly — Relatórios globais (Gestor/Admin). 3 gráficos consolidados + métricas de
// entrega + insights da IA + tabela por conta. KoblyReports
const C = KoblyChartColors;

const RANGE_OPTS = [{ value: '30d', label: '30 dias' }, { value: '90d', label: '90 dias' }];

function axisX(labels) {
  return { categories: labels, labels: { rotate: 0, hideOverlappingLabels: true, style: { fontSize: '11px' } }, axisBorder: { color: C.grid }, axisTicks: { color: C.grid }, tickAmount: 8 };
}

function DeliveryCard({ entrega }) {
  const items = [
    { label: 'Taxa de abertura', value: entrega.abertura, tone: 'success' },
    { label: 'Taxa de cliques', value: entrega.cliques, tone: 'info' },
    { label: 'Bounce', value: entrega.bounce, tone: 'danger' },
  ];
  return (
    <Card title="Métricas de entrega" subtitle="Médias do período">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {items.map((it) => (
          <div key={it.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)' }}>{it.label}</span>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)' }}>{KoblyApi.pct(it.value)}</span>
            </div>
            <div style={{ height: 8, borderRadius: 'var(--radius-pill)', background: 'var(--surface-sunken)', overflow: 'hidden' }}>
              <div style={{ width: Math.min(100, it.value * 100) + '%', height: '100%', background: `var(--status-${it.tone}-fg)`, borderRadius: 'var(--radius-pill)' }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function InsightsCard({ insights }) {
  return (
    <Card title="Destaques do período" subtitle="Derivados dos dados reais" action={<Badge tone="info" dot>Automático</Badge>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {insights.map((it, i) => <StatusLine key={i} tone={it.tone} icon={it.icon}>{it.text}</StatusLine>)}
      </div>
    </Card>
  );
}

function KoblyReports() {
  const DB = KoblyMockDB;
  const [range, setRange] = React.useState('90d');
  const a = useAsync(() => KoblyApi.getReports(range), [range]);

  if (a.status === 'error') return <ErrorState message={a.error} onRetry={a.reload} />;
  if (a.status === 'loading') return <SkeletonCards count={4} height={280} />;
  const d = a.data;
  const rows = d.porConta;
  const maxEnviados = Math.max(...rows.map((r) => r.enviados), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <p style={{ margin: 0, fontSize: 'var(--text-md)', color: 'var(--text-muted)', maxWidth: 560 }}>Relatório consolidado de desempenho — base para decisões de agência e plataforma.</p>
        <Segmented value={range} onChange={setRange} options={RANGE_OPTS} label="Período" />
      </div>

      <div className="kbly-grid-main" style={{ gap: 16 }}>
        <Card title="Disparos por canal" subtitle="E-mail · WhatsApp — envios reais do período">
          <Chart
            type="area" height={300}
            series={[
              { name: 'E-mail', data: d.disparosPorCanal.email },
              { name: 'WhatsApp', data: d.disparosPorCanal.whatsapp },
            ]}
            options={{
              colors: [C.accent, C.green],
              stroke: { curve: 'smooth', width: 2 },
              fill: { type: 'gradient', gradient: { opacityFrom: 0.25, opacityTo: 0.02 } },
              xaxis: axisX(d.disparosPorCanal.labels),
              yaxis: { labels: { formatter: (v) => KoblyApi.br(Math.round(v)), style: { fontSize: '11px' } } },
              legend: { position: 'top', horizontalAlign: 'left', offsetY: -4 },
              tooltip: { y: { formatter: (v) => KoblyApi.br(v) } },
              markers: { size: 0, hover: { size: 5 } },
            }}
          />
        </Card>
        <Card title="Recuperadas por conta" subtitle="Vendas recuperadas no período">
          {d.recuperadasPorConta.length ? (
            <Chart
              type="donut" height={300}
              series={d.recuperadasPorConta.map((c) => c.valor)}
              options={{
                labels: d.recuperadasPorConta.map((c) => c.nome),
                colors: [C.accent, C.green, C.amber, '#7aa7ff', '#c58bff', '#5fd4c8'],
                stroke: { colors: ['var(--surface-card)'], width: 2 },
                legend: { position: 'bottom', fontSize: '12px' },
                plotOptions: { pie: { donut: { size: '64%', labels: { show: true, total: { show: true, label: 'Recuperadas', color: C.textMuted, formatter: (w) => KoblyApi.br(w.globals.seriesTotals.reduce((a, b) => a + b, 0)) }, value: { color: C.textStrong, fontWeight: 700, formatter: (v) => KoblyApi.br(v) } } } } },
                tooltip: { y: { formatter: (v) => KoblyApi.br(v) } },
              }}
            />
          ) : (
            <EmptyState compact icon="chart-pie" title="Sem recuperações no período" message="Quando as campanhas recuperarem vendas, a distribuição por conta aparece aqui." />
          )}
        </Card>
      </div>

      <div className="kbly-grid-main" style={{ gap: 16 }}>
        <Card title="Campanhas criadas" subtitle="Volume por período">
          <Chart
            type="bar" height={260}
            series={[{ name: 'Campanhas', data: d.campanhasCriadas.series }]}
            options={{
              colors: [C.accent],
              plotOptions: { bar: { borderRadius: 3, columnWidth: '55%' } },
              xaxis: axisX(d.campanhasCriadas.labels),
              yaxis: { min: 0, forceNiceScale: true, tickAmount: 4, labels: { formatter: (v) => KoblyApi.br(Math.round(v)), style: { fontSize: '11px' } } },
              tooltip: { y: { formatter: (v) => KoblyApi.br(v) } },
            }}
          />
        </Card>
        <DeliveryCard entrega={d.entrega} />
      </div>

      <InsightsCard insights={d.insights} />

      <Card title="Desempenho por conta" pad={false}>
        <DataTable
          rowKey="id"
          columns={[
            { key: 'conta', header: 'Conta', render: (r) => <span style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)' }}>{r.conta}</span> },
            { key: 'plano', header: 'Plano', render: (r) => <Badge tone="neutral">{r.plano}</Badge> },
            { key: 'campanhas', header: 'Camp.', align: 'end' },
            { key: 'enviados', header: 'E-mails enviados', align: 'end', render: (r) => KoblyApi.br(r.enviados) },
            { key: 'taxaAbertura', header: 'Abertura', align: 'end', render: (r) => KoblyApi.pct(r.taxaAbertura) },
            { key: 'vendas', header: 'Recuperadas', align: 'end', render: (r) => <span style={{ color: 'var(--status-success-fg)', fontWeight: 'var(--fw-semibold)' }}>{KoblyApi.br(r.vendas)}</span> },
            { key: 'criticidade', header: 'Criticidade', render: (r) => <Badge tone={DB.optionSets.StatusCriticidade[r.criticidade] || 'neutral'} dot>{r.criticidade}</Badge> },
          ]}
          rows={rows}
        />
      </Card>
    </div>
  );
}
export { KoblyReports };
