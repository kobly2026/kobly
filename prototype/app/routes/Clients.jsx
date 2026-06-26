// Kobly — Clientes (Gestor). Lista/gerencia contas de cliente (Empresa + fundador + plano).
// window.KoblyClients
(function () {
  const DS = window.KoblyDesignSystem_29b7f4;
  const { DataTable, Badge, Button, Avatar, IconButton, Icon, Input, Select } = DS;
  const { useState } = React;

  function NewAccountModal({ onClose, onCreate }) {
    const [nome, setNome] = useState('');
    const [segmento, setSegmento] = useState('Suplementos');
    const [fundador, setFundador] = useState('');
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
        <div style={{ position: 'relative', width: 460, maxWidth: '92vw', background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-pop)', padding: 24, animation: 'kbly-toast-in var(--dur-med) var(--ease-out) both' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <h3 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)' }}>Cadastrar nova conta</h3>
            <IconButton icon="x" aria-label="Fechar" onClick={onClose} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input label="Nome da empresa" placeholder="Ex.: Loja do João" value={nome} onChange={(e) => setNome(e.target.value)} />
            <Select label="Segmento" value={segmento} onChange={(e) => setSegmento(e.target.value)} options={['Suplementos', 'Infoproduto', 'Beleza', 'Moda', 'Serviços', 'Outro']} />
            <Input label="E-mail do fundador" placeholder="nome@empresa.com" value={fundador} onChange={(e) => setFundador(e.target.value)} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" iconLeft="plus" disabled={!nome.trim()} onClick={() => onCreate({ nome, segmento, fundador })}>Criar conta</Button>
          </div>
        </div>
      </div>
    );
  }

  function KoblyClients() {
    const store = window.useKobly();
    const { useAsync, PageIntro, EmptyState } = window;
    const a = useAsync(() => window.KoblyApi.listClients(), []);
    const [modal, setModal] = useState(false);
    const DB = window.KoblyMockDB;

    function create(data) {
      a.setData((rows) => [{
        id: 'emp_' + Date.now(), nome: data.nome, segmento: data.segmento, plano: 'Starter',
        leads: 0, campanhasAtivas: 0, criticidade: 'Não Iniciado', fundador: data.fundador.split('@')[0] || '—', fundadorEmail: data.fundador,
      }, ...(rows || [])]);
      setModal(false);
      store.notify('success', `Conta "${data.nome}" criada`);
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <PageIntro action={<Button variant="primary" iconLeft="plus" onClick={() => setModal(true)}>Cadastrar nova conta</Button>}>
          Contas de cliente que você gerencia como agência. Cada conta isola leads, campanhas e domínios de envio.
        </PageIntro>
        <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          {a.status === 'loading'
            ? <div style={{ padding: 28, color: 'var(--text-muted)' }}>Carregando…</div>
            : (
              <DataTable
                rowKey="id"
                columns={[
                  { key: 'nome', header: 'Conta', render: (r) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                      <Avatar name={r.nome} tone="teal" size="sm" />
                      <div>
                        <div style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)' }}>{r.nome}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{r.fundadorEmail}</div>
                      </div>
                    </div>
                  ) },
                  { key: 'segmento', header: 'Segmento' },
                  { key: 'plano', header: 'Plano', render: (r) => <Badge tone="neutral">{r.plano}</Badge> },
                  { key: 'leads', header: 'Leads', align: 'end', render: (r) => window.KoblyApi.br(r.leads) },
                  { key: 'campanhasAtivas', header: 'Ativas', align: 'end' },
                  { key: 'criticidade', header: 'Criticidade', render: (r) => <Badge tone={DB.optionSets.StatusCriticidade[r.criticidade] || 'neutral'} dot>{r.criticidade}</Badge> },
                  { key: 'acao', header: '', align: 'end', width: 90, render: () => (
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <IconButton icon="pencil" size="sm" aria-label="Editar" onClick={() => store.notify('info', 'Edição de conta (demo)')} />
                      <IconButton icon="log-in" size="sm" aria-label="Acessar conta" onClick={() => store.notify('info', 'Acessando a conta (demo)')} />
                    </div>
                  ) },
                ]}
                rows={a.data || []}
              />
            )}
        </div>
        {modal && <NewAccountModal onClose={() => setModal(false)} onCreate={create} />}
      </div>
    );
  }

  window.KoblyClients = KoblyClients;
})();
