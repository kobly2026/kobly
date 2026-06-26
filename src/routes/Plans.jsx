import { useState } from 'react';
import { KoblyApi } from '@/api/mockApi.js';
import { KoblyMockDB } from '@/api/mockData.js';
import { Badge, Button, Card, DataTable, Icon, Input } from '@/ds';
import { PageIntro, useAsync } from '@/lib/hooks.jsx';
import { Modal } from '@/lib/ui.jsx';
import { useKobly } from '@/store/store.jsx';

// Kobly — Planos & cobrança. Plano atual + uso vs. limites, planos disponíveis,
// histórico de transações. Admin pode criar plano. KoblyPlans

function UsageBar({ label, used, limit }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const tone = pct >= 90 ? 'danger' : pct >= 70 ? 'warning' : 'accent';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
        <span style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-mono)', fontWeight: 'var(--fw-semibold)' }}>{KoblyApi.br(used)} / {KoblyApi.br(limit)}</span>
      </div>
      <div style={{ height: 8, borderRadius: 'var(--radius-pill)', background: 'var(--surface-sunken)', overflow: 'hidden' }}>
        <div style={{ width: pct + '%', height: '100%', background: tone === 'accent' ? 'var(--accent)' : `var(--status-${tone}-fg)`, borderRadius: 'var(--radius-pill)' }} />
      </div>
    </div>
  );
}

function PlanCard({ p, current, onChoose }) {
  const DB = KoblyMockDB;
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
        <span style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)' }}>{KoblyApi.money(p.valorMensal)}</span>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>/mês</span>
      </div>
      <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 'var(--lh-snug)', minHeight: 36 }}>{p.descricao}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 'var(--text-sm)', color: 'var(--text-body)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="megaphone" size={15} style={{ color: 'var(--accent)' }} />{KoblyApi.br(p.limiteCampanhas)} campanhas</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="zap" size={15} style={{ color: 'var(--accent)' }} />{KoblyApi.br(p.limiteExecucoes)} execuções/mês</span>
      </div>
      {!current && p.status === 'Ativo' && <Button variant="secondary" fullWidth onClick={() => onChoose(p)}>Mudar para {p.nome}</Button>}
    </div>
  );
}

function KoblyPlans() {
  const store = useKobly();
  const DB = KoblyMockDB;
  const a = useAsync(() => KoblyApi.getPlans(store.session.empresaId || 'emp_1'), [store.role]);
  const [modal, setModal] = useState(false);
  const [pf, setPf] = useState({ nome: '', descricao: '', valorMensal: '', valorAnual: '', limiteCampanhas: '', limiteExecucoes: '' });
  const [busy, setBusy] = useState(false);
  const setField = (k) => (e) => setPf((f) => ({ ...f, [k]: e.target.value }));
  async function createPlan() {
    if (!pf.nome.trim()) return;
    setBusy(true);
    try {
      await KoblyApi.createPlan({
        nome: pf.nome, descricao: pf.descricao,
        valorMensal: Number(pf.valorMensal) || 0, valorAnual: Number(pf.valorAnual) || 0,
        limiteCampanhas: parseInt(pf.limiteCampanhas, 10) || 0, limiteExecucoes: parseInt(pf.limiteExecucoes, 10) || 0,
      });
      store.notify('success', `Plano "${pf.nome}" criado`);
      setModal(false); setPf({ nome: '', descricao: '', valorMensal: '', valorAnual: '', limiteCampanhas: '', limiteExecucoes: '' });
      a.reload();
    } catch (e) {
      store.notify('danger', 'Não foi possível criar o plano.');
    } finally { setBusy(false); }
  }
  if (a.status === 'loading') return <div style={{ color: 'var(--text-muted)' }}>Carregando planos…</div>;
  const d = a.data;
  const canCreate = store.can.createPlan;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageIntro action={canCreate ? <Button variant="primary" iconLeft="plus" onClick={() => setModal(true)}>Criar novo plano</Button> : null}>
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
            { key: 'valorPago', header: 'Valor', align: 'end', render: (r) => KoblyApi.money(r.valorPago) },
            { key: 'status', header: 'Status', render: (r) => <Badge tone={DB.optionSets.StatusPagamento[r.status] || 'neutral'} dot>{r.status}</Badge> },
          ]}
          rows={canCreate ? d.transacoes : d.transacoes.filter((t) => t.usuario === store.session.name)}
        />
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="Criar novo plano" width={520}
        footer={<>
          <Button variant="ghost" onClick={() => setModal(false)}>Cancelar</Button>
          <Button variant="primary" iconLeft="plus" disabled={busy || !pf.nome.trim()} onClick={createPlan}>{busy ? 'Criando…' : 'Criar plano'}</Button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Nome do plano" placeholder="Ex.: Business" value={pf.nome} onChange={setField('nome')} />
          <Input label="Descrição" placeholder="Para quem é este plano" value={pf.descricao} onChange={setField('descricao')} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Input label="Valor mensal (R$)" type="number" placeholder="297" value={pf.valorMensal} onChange={setField('valorMensal')} />
            <Input label="Valor anual (R$)" type="number" placeholder="2970" value={pf.valorAnual} onChange={setField('valorAnual')} />
            <Input label="Limite de campanhas" type="number" placeholder="20" value={pf.limiteCampanhas} onChange={setField('limiteCampanhas')} />
            <Input label="Limite de execuções/mês" type="number" placeholder="50000" value={pf.limiteExecucoes} onChange={setField('limiteExecucoes')} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
export { KoblyPlans };
