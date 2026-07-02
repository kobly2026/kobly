import { useState } from 'react';
import { KoblyApi } from '@/api/mockApi.js';
import { KoblyMockDB } from '@/api/mockData.js';
import { Avatar, Badge, Button, DataTable } from '@/ds';
import { PageIntro, useAsync } from '@/lib/hooks.jsx';
import { Segmented, ErrorState } from '@/lib/ui.jsx';
import { useKobly } from '@/store/store.jsx';

// Kobly — Segurança (painel Admin). Usuários (ativar/desabilitar), sessões ativas,
// histórico de acesso, webhooks globais. KoblySecurity

function KoblySecurity() {
  const store = useKobly();
  const DB = KoblyMockDB;
  const a = useAsync(() => KoblyApi.getSecurity(), []);
  const [tab, setTab] = useState('users');
  if (a.status === 'error') return <ErrorState message={a.error} onRetry={a.reload} />;
  if (a.status === 'loading') return <div style={{ color: 'var(--text-muted)' }}>Carregando painel…</div>;
  const d = a.data;

  async function toggleUser(u) {
    const next = u.status === 'Ativo' ? 'Desabilitado' : 'Ativo';
    await KoblyApi.setUserStatus(u.id, next);
    a.setData((cur) => ({ ...cur, users: cur.users.map((x) => (x.id === u.id ? { ...x, status: next } : x)) }));
    store.notify(next === 'Ativo' ? 'success' : 'warning', `${u.nome} ${next === 'Ativo' ? 'ativado' : 'desabilitado'}`);
  }
  async function endSession(s) {
    await KoblyApi.endSession(s.id);
    a.setData((cur) => ({ ...cur, sessoes: cur.sessoes.filter((x) => x.id !== s.id) }));
    store.notify('info', `Sessão de ${s.nome} encerrada`);
  }

  const tabs = [
    { value: 'users', label: 'Usuários' },
    { value: 'sessions', label: 'Sessões ativas' },
    { value: 'history', label: 'Histórico de acesso' },
    { value: 'webhooks', label: 'Webhooks' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageIntro action={<Segmented value={tab} onChange={setTab} options={tabs} />}>
        Controle administrativo da plataforma: usuários, sessões, auditoria de acesso e webhooks.
      </PageIntro>
      <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        {tab === 'users' && (
          <DataTable rowKey="id" columns={[
            { key: 'nome', header: 'Usuário', render: (r) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar name={r.nome} size="sm" />
                <div><div style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)' }}>{r.nome}</div><div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{r.email}</div></div>
              </div>
            ) },
            { key: 'tipo', header: 'Papel', render: (r) => <Badge tone="neutral">{r.tipo}</Badge> },
            { key: 'empresa', header: 'Conta' },
            { key: 'status', header: 'Status', render: (r) => <Badge tone={DB.optionSets.StatusUser[r.status]} dot>{r.status}</Badge> },
            { key: 'ultimoLogin', header: 'Último login', render: (r) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>{r.ultimoLogin}</span> },
            { key: 'acao', header: '', align: 'end', width: 130, render: (r) => (
              <Button size="sm" variant={r.status === 'Ativo' ? 'ghost' : 'secondary'} iconLeft={r.status === 'Ativo' ? 'user-x' : 'user-check'} onClick={() => toggleUser(r)}>
                {r.status === 'Ativo' ? 'Desabilitar' : 'Ativar'}
              </Button>
            ) },
          ]} rows={d.users} />
        )}
        {tab === 'sessions' && (
          <DataTable rowKey="id" empty="Nenhuma sessão registrada ainda — o rastreamento de sessões chega em breve." columns={[
            { key: 'nome', header: 'Usuário', render: (r) => <span style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)' }}>{r.nome}</span> },
            { key: 'dispositivo', header: 'Dispositivo' },
            { key: 'ip', header: 'IP', render: (r) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>{r.ip}</span> },
            { key: 'when', header: 'Atividade' },
            { key: 'acao', header: '', align: 'end', width: 130, render: (r) => <Button size="sm" variant="ghost" iconLeft="log-out" onClick={() => endSession(r)}>Encerrar</Button> },
          ]} rows={d.sessoes} />
        )}
        {tab === 'history' && (
          <DataTable rowKey="id" empty="Nenhum registro de acesso ainda — a auditoria de logins chega em breve." columns={[
            { key: 'nome', header: 'Usuário', render: (r) => <span style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)' }}>{r.nome}</span> },
            { key: 'tipoLog', header: 'Evento', render: (r) => <Badge tone={r.tipoLog === 'Login falho' ? 'danger' : 'success'} dot>{r.tipoLog}</Badge> },
            { key: 'ip', header: 'IP', render: (r) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>{r.ip}</span> },
            { key: 'local', header: 'Local' },
            { key: 'when', header: 'Quando', align: 'end', render: (r) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>{r.when}</span> },
          ]} rows={d.historico} />
        )}
        {tab === 'webhooks' && (
          <DataTable rowKey="id" columns={[
            { key: 'nome', header: 'Webhook', render: (r) => <span style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)' }}>{r.nome}</span> },
            { key: 'url', header: 'URL', render: (r) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{r.url}</span> },
            { key: 'testado', header: 'Testado', render: (r) => <Badge tone={r.testado ? 'success' : 'warning'} dot>{r.testado ? 'Sim' : 'Não'}</Badge> },
            { key: 'desabilitado', header: 'Estado', render: (r) => <Badge tone={r.desabilitado ? 'neutral' : 'success'} dot>{r.desabilitado ? 'Desabilitado' : 'Ativo'}</Badge> },
          ]} rows={d.webhooks} />
        )}
      </div>
    </div>
  );
}
export { KoblySecurity };
