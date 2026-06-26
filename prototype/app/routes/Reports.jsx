// Kobly — Relatórios globais (Gestor/Admin). 3 gráficos consolidados + métricas de
// entrega + insights da IA + tabela por conta. window.KoblyReports
(function () {
  const DS = window.KoblyDesignSystem_29b7f4;
  const { Card, Badge, DataTable, Icon, StatusLine } = DS;
  const C = window.KoblyChartColors;

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
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)' }}>{window.KoblyApi.pct(it.value)}</span>
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
      <Card title="Melhores perfis de uso" subtitle="Recomendações da IA" action={<Badge tone="info" dot>IA</Badge>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {insights.map((it, i) => <StatusLine key={i} tone={it.tone} icon={it.icon}>{it.text}</StatusLine>)}
        </div>
      </Card>
    );
  }

  function KoblyReports() {
    const { useAsync, Segmented } = window;
    const DB = window.KoblyMockDB;
    const { Chart } = window;
    const [range, setRange] = React.useState('90d');
    const a = useAsync(() => window.KoblyApi.getReports(range), [range]);

    if (a.status === 'loading') return <div style={{ color: 'var(--text-muted)', padding: 8 }}>Carregando relatórios…</div>;
    const d = a.data;
    const rows = d.porConta;
    const maxEnviados = Math.max(...rows.map((r) => r.enviados), 1);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <p style={{ margin: 0, fontSize: 'var(--text-md)', color: 'var(--text-muted)', maxWidth: 560 }}>Relatório consolidado de desempenho — base para decisões de agência e plataforma.</p>
          <Segmented value={range} onChange={setRange} options={RANGE_OPTS} label="Período" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, alignItems: 'start' }}>
          <Card title="Disparos por canal" subtitle="E-mail · WhatsApp · SMS">
            <Chart
              type="area" height={300}
              series={[
                { name: 'E-mail', data: d.disparosPorCanal.email },
                { name: 'WhatsApp', data: d.disparosPorCanal.whatsapp },
                { name: 'SMS', data: d.disparosPorCanal.sms },
              ]}
              options={{
                colors: [C.accent, C.green, C.amber],
                stroke: { curve: 'smooth', width: 2 },
                fill: { type: 'gradient', gradient: { opacityFrom: 0.25, opacityTo: 0.02 } },
                xaxis: axisX(d.disparosPorCanal.labels),
                yaxis: { labels: { formatter: (v) => window.KoblyApi.br(Math.round(v)), style: { fontSize: '11px' } } },
                legend: { position: 'top', horizontalAlign: 'left', offsetY: -4 },
                tooltip: { y: { formatter: (v) => window.KoblyApi.br(v) } },
                markers: { size: 0, hover: { size: 5 } },
              }}
            />
          </Card>
          <Card title="Conversões por canal" subtitle="Vendas recuperadas no período">
            <Chart
              type="donut" height={300}
              series={d.conversoesPorCanal.map((c) => c.valor)}
              options={{
                labels: d.conversoesPorCanal.map((c) => c.canal),
                colors: [C.accent, C.green, C.amber],
                stroke: { colors: ['var(--surface-card)'], width: 2 },
                legend: { position: 'bottom', fontSize: '12px' },
                plotOptions: { pie: { donut: { size: '64%', labels: { show: true, total: { show: true, label: 'Recuperadas', color: C.textMuted, formatter: (w) => window.KoblyApi.br(w.globals.seriesTotals.reduce((a, b) => a + b, 0)) }, value: { color: C.textStrong, fontWeight: 700, formatter: (v) => window.KoblyApi.br(v) } } } } },
                tooltip: { y: { formatter: (v) => window.KoblyApi.br(v) } },
              }}
            />
          </Card>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, alignItems: 'start' }}>
          <Card title="Campanhas criadas" subtitle="Volume por período">
            <Chart
              type="bar" height={260}
              series={[{ name: 'Campanhas', data: d.campanhasCriadas.series }]}
              options={{
                colors: [C.accent],
                plotOptions: { bar: { borderRadius: 3, columnWidth: '55%' } },
                xaxis: axisX(d.campanhasCriadas.labels),
                yaxis: { min: 0, forceNiceScale: true, tickAmount: 4, labels: { formatter: (v) => window.KoblyApi.br(Math.round(v)), style: { fontSize: '11px' } } },
                tooltip: { y: { formatter: (v) => window.KoblyApi.br(v) } },
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
              { key: 'enviados', header: 'E-mails enviados', align: 'end', render: (r) => window.KoblyApi.br(r.enviados) },
              { key: 'taxaAbertura', header: 'Abertura', align: 'end', render: (r) => window.KoblyApi.pct(r.taxaAbertura) },
              { key: 'vendas', header: 'Recuperadas', align: 'end', render: (r) => <span style={{ color: 'var(--status-success-fg)', fontWeight: 'var(--fw-semibold)' }}>{window.KoblyApi.br(r.vendas)}</span> },
              { key: 'criticidade', header: 'Criticidade', render: (r) => <Badge tone={DB.optionSets.StatusCriticidade[r.criticidade] || 'neutral'} dot>{r.criticidade}</Badge> },
            ]}
            rows={rows}
          />
        </Card>
      </div>
    );
  }
  window.KoblyReports = KoblyReports;
})();
