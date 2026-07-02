import { useState } from 'react';
import { KoblyApi } from '@/api/mockApi.js';
import { KoblyMockDB, SEGMENTOS } from '@/api/mockData.js';
import { Avatar, Badge, Button, DataTable, IconButton, Input, Select } from '@/ds';
import { PageIntro, useAsync } from '@/lib/hooks.jsx';
import { Modal, ErrorState } from '@/lib/ui.jsx';
import { useKobly } from '@/store/store.jsx';

// Kobly — Clientes (Gestor/Admin). Lista e gerencia contas de cliente (Empresa).
// Criar conta = RPC create_managed_org (vincula a agência como membro). KoblyClients

function AccountModal({ account, onClose, onSubmit }) {
  const editing = !!account;
  const [nome, setNome] = useState(account ? account.nome : '');
  const [segmento, setSegmento] = useState(account ? (account.segmento || 'Outro') : 'Suplementos');
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!nome.trim()) return;
    setBusy(true);
    await onSubmit({ nome, segmento });
    setBusy(false);
  }
  return (
    <Modal open onClose={onClose} title={editing ? 'Editar conta' : 'Cadastrar nova conta'}
      subtitle={editing ? 'Atualize os dados básicos da conta.' : 'A conta é criada sob a sua agência (você vira gestor dela).'}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" iconLeft={editing ? 'check' : 'plus'} disabled={busy || !nome.trim()} onClick={submit}>{busy ? 'Salvando…' : (editing ? 'Salvar' : 'Criar conta')}</Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input label="Nome da empresa" placeholder="Ex.: Loja do João" value={nome} onChange={(e) => setNome(e.target.value)} />
        <Select label="Segmento" value={segmento} onChange={(e) => setSegmento(e.target.value)} options={SEGMENTOS} />
      </div>
    </Modal>
  );
}

function KoblyClients() {
  const store = useKobly();
  const a = useAsync(() => KoblyApi.listClients(), [store.role]);
  const [modal, setModal] = useState(false);   // novo
  const [editing, setEditing] = useState(null); // conta em edição
  const DB = KoblyMockDB;

  async function create({ nome, segmento }) {
    const { error } = await KoblyApi.createOrganization({ nome, segmento });
    if (error) { store.notify('danger', 'Não foi possível criar a conta.'); return; }
    store.notify('success', `Conta "${nome}" criada`);
    setModal(false);
    a.reload();
  }
  async function saveEdit({ nome, segmento }) {
    const { error } = await KoblyApi.updateOrganization(editing.id, { nome, segmento });
    if (error) { store.notify('danger', 'Não foi possível salvar a conta.'); return; }
    store.notify('success', 'Conta atualizada');
    setEditing(null);
    a.reload();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageIntro action={<Button variant="primary" iconLeft="plus" onClick={() => setModal(true)}>Cadastrar nova conta</Button>}>
        Contas de cliente que você gerencia como agência. Cada conta isola leads, campanhas e domínios de envio.
      </PageIntro>
      <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        {a.status === 'error'
          ? <ErrorState message={a.error} onRetry={a.reload} compact />
          : a.status === 'loading'
          ? <div style={{ padding: 28, color: 'var(--text-muted)' }}>Carregando…</div>
          : (
            <DataTable
              rowKey="id"
              empty="Nenhuma conta ainda. Cadastre a primeira."
              columns={[
                { key: 'nome', header: 'Conta', render: (r) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <Avatar name={r.nome} tone="teal" size="sm" />
                    <div>
                      <div style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)' }}>{r.nome}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{r.fundadorEmail || '—'}</div>
                    </div>
                  </div>
                ) },
                { key: 'segmento', header: 'Segmento' },
                { key: 'plano', header: 'Plano', render: (r) => <Badge tone="neutral">{r.plano}</Badge> },
                { key: 'leads', header: 'Leads', align: 'end', render: (r) => KoblyApi.br(r.leads) },
                { key: 'campanhasAtivas', header: 'Ativas', align: 'end' },
                { key: 'criticidade', header: 'Criticidade', render: (r) => <Badge tone={DB.optionSets.StatusCriticidade[r.criticidade] || 'neutral'} dot>{r.criticidade}</Badge> },
                { key: 'acao', header: '', align: 'end', width: 60, render: (r) => (
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    <IconButton icon="pencil" size="sm" aria-label="Editar" onClick={() => setEditing(r)} />
                  </div>
                ) },
              ]}
              rows={a.data || []}
            />
          )}
      </div>
      {modal && <AccountModal onClose={() => setModal(false)} onSubmit={create} />}
      {editing && <AccountModal account={editing} onClose={() => setEditing(null)} onSubmit={saveEdit} />}
    </div>
  );
}

export { KoblyClients };
