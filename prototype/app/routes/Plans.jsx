// Kobly — Planos & cobrança. Plano atual + uso vs. limites, planos disponíveis,
// histórico de transações. Admin pode criar plano. window.KoblyPlans
(function () {
  const DS = window.KoblyDesignSystem_29b7f4;
  const { Card, Badge, Button, DataTable, Icon, Input, IconButton } = DS;
  const { useState } = React;

  function UsageBar({ label, used, limit }) {
    const pct = Math.min(100, Math.round((used / limit) * 100));
    const tone = pct >= 90 ? 'danger' : pct >= 70 ? 'warning' : 'accent';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
          <span style={{ color: 'var(--text-muted)' }}>{label}</span>
          <span style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-mono)', fontWeight: 'var(--fw-semibold)' }}>{window.KoblyApi.br(used)} / {window.KoblyApi.br(limit)}</span>
        </div>
        <div style={{ height: 8, borderRadius: 'var(--radius-pill)', background: 'var(--surface-sunken)', overflow: 'hidden' }}>
          <div style={{ width: pct + '%', height: '100%', background: tone === 'accent' ? 'var(--accent)' : `var(--status-${tone}-fg)`, borderRadius: 'var(--radius-pill)' }} />
        </div>
      </div>
    );
  }

  function PlanCard({ p, current, onChoose }) {
    const DB = window.KoblyMockDB;
    return (
      <div style={{
        background: 'var(--surface-card)', border: `1px solid ${current ? 'var(--accent)' : 'var(--border-subtle)'}`,
        boxShadow: current ? '0 0 0 3px var(--accent-soft)' : 'var(--shadow-sm)', borderRadius: 'var(--radius-md)', padding: 22,
        display: 'flex', flexDirection: 'column', gap: 14, opacity: p.status === 'Inativo' ? 0.55 : 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)' }}>{p.nome}</span>
          {current ? <Badge tone="success" dot>Plano atual</Badge> : <Badge tone={DB.optionSets.StatusPlanos[p.status]}>{p.status}</Badge>}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)' }}>{window.KoblyApi.money(p.valorMensal)}</span>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>/mês</span>
        </div>
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 'var(--lh-snug)', minHeight: 36 }}>{p.descricao}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 'var(--text-sm)', color: 'var(--text-body)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="megaphone" size={15} style={{ color: 'var(--accent)' }} />{window.KoblyApi.br(p.limiteCampanhas)} campanhas</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="zap" size={15} style={{ color: 'var(--accent)' }} />{window.KoblyApi.br(p.limiteExecucoes)} execuções/mês</span>
        </div>
        {!current && p.status === 'Ativo' && <Button variant="secondary" fullWidth onClick={() => onChoose(p)}>Mudar para {p.nome}</Button>}
      </div>
    );
  }

  function KoblyPlans() {
    const store = window.useKobly();
    const { useAsync, PageIntro } = window;
    const DB = window.KoblyMockDB;
    const a = useAsync(() => window.KoblyApi.getPlans(store.session.empresaId || 'emp_1'), [store.role]);
    if (a.status === 'loading') return <div style={{ color: 'var(--text-muted)' }}>Carregando planos…</div>;
    const d = a.data;
    const canCreate = store.can.createPlan;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <PageIntro action={canCreate ? <Button variant="primary" iconLeft="plus" onClick={() => store.notify('info', 'Criar plano (demo)')}>Criar novo plano</Button> : null}>
          {canCreate ? 'Gestão de planos da plataforma e histórico de cobrança das contas.' : 'Seu plano atual, consumo do período e histórico de cobrança.'}
        </PageIntro>

        {!canCreate && (
          <Card title={`Plano ${d.atual.nome}`} subtitle="Consumo do período atual" action={<Button variant="primary" size="sm" iconLeft="arrow-up-circle" onClick={() => store.notify('success', 'Solicitação de upgrade enviada')}>Fazer upgrade</Button>}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <UsageBar label="Campanhas" used={d.uso.campanhas} limit={d.uso.limiteCampanhas} />
              <UsageBar label="Execuções (eventos processados)" used={d.uso.execucoes} limit={d.uso.limiteExecucoes} />
            </div>
          </Card>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {d.planos.filter((p) => !p.deleted).map((p) => (
            <PlanCard key={p.id} p={p} current={p.id === d.atual.id && !canCreate} onChoose={(pl) => store.notify('success', `Plano alterado para ${pl.nome}`)} />
          ))}
        </div>

        <Card title="Histórico de cobrança" pad={false}>
          <DataTable
            rowKey="id"
            columns={[
              { key: 'data', header: 'Data', render: (r) => <span style={{ fontFamily: 'var(--font-mono)' }}>{r.data}</span> },
              { key: 'usuario', header: 'Cliente' },
              { key: 'plano', header: 'Plano', render: (r) => <Badge tone="neutral">{r.plano}</Badge> },
              { key: 'formaPagamento', header: 'Forma' },
              { key: 'valorPago', header: 'Valor', align: 'end', render: (r) => window.KoblyApi.money(r.valorPago) },
              { key: 'status', header: 'Status', render: (r) => <Badge tone={DB.optionSets.StatusPagamento[r.status] || 'neutral'} dot>{r.status}</Badge> },
            ]}
            rows={canCreate ? d.transacoes : d.transacoes.filter((t) => t.usuario === store.session.name)}
          />
        </Card>
      </div>
    );
  }
  window.KoblyPlans = KoblyPlans;
})();
