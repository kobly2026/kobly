import { useState, useEffect } from 'react';
import { KoblyApi } from '@/api/mockApi.js';
import { KoblyMockDB } from '@/api/mockData.js';
import { Avatar, Badge, Button, Card, Icon, Input } from '@/ds';
import { PageIntro, useAsync } from '@/lib/hooks.jsx';
import { ErrorState } from '@/lib/ui.jsx';
import { useKobly } from '@/store/store.jsx';

// Kobly — Perfil + meu plano. Editar dados do usuário e ver plano. KoblyProfile

function KoblyProfile() {
  const store = useKobly();
  const DB = KoblyMockDB;
  const a = useAsync(() => KoblyApi.getProfile(store.role), [store.role]);
  const [form, setForm] = useState(null);
  useEffect(() => { if (a.data) setForm({ nome: a.data.user.nome, email: a.data.user.email, celular: a.data.user.celular, local: a.data.user.local }); }, [a.data]);

  if (a.status === 'error') return <ErrorState message={a.error} onRetry={a.reload} />;
  if (a.status === 'loading' || !form) return <div style={{ color: 'var(--text-muted)' }}>Carregando perfil…</div>;
  const { user, empresa, plano } = a.data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageIntro>Seus dados de conta e o plano vinculado.</PageIntro>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, alignItems: 'start' }}>
        <Card title="Dados do perfil" action={<Badge tone={DB.optionSets.StatusUser[user.status]} dot>{user.status}</Badge>}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <Avatar name={user.nome} size="lg" tone="teal" />
            <div>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)' }}>{user.nome}</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{user.tipo}{empresa ? ` · ${empresa.nome}` : ''}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Input label="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            <Input label="E-mail" value={form.email} disabled hint="O e-mail de login é gerenciado pela autenticação." />
            <Input label="Celular" value={form.celular} onChange={(e) => setForm({ ...form, celular: e.target.value })} />
            <Input label="Localização" value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
            <Button variant="primary" iconLeft="check" onClick={async () => { const { error } = await KoblyApi.updateProfile(form); store.notify(error ? 'danger' : 'success', error ? 'Não foi possível salvar.' : 'Perfil atualizado'); }}>Salvar alterações</Button>
          </div>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {plano ? (
            <Card title="Meu plano">
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)' }}>{plano.nome}</span>
                <span style={{ fontSize: 'var(--text-md)', color: 'var(--text-muted)' }}>{KoblyApi.money(plano.valorMensal)}/mês</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 'var(--text-sm)', color: 'var(--text-body)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="megaphone" size={15} style={{ color: 'var(--accent)' }} />{KoblyApi.br(plano.limiteCampanhas)} campanhas</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="zap" size={15} style={{ color: 'var(--accent)' }} />{KoblyApi.br(plano.limiteExecucoes)} execuções/mês</span>
              </div>
              <Button variant="secondary" fullWidth iconLeft="credit-card" style={{ marginTop: 16 }} onClick={() => store.navigate('planos')}>Ver planos & cobrança</Button>
            </Card>
          ) : (
            <Card title="Conta interna">
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 'var(--lh-normal)' }}>Usuários internos ({user.tipo}) não possuem plano de assinatura vinculado.</p>
            </Card>
          )}
          <Card title="Segurança">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Button variant="ghost" iconLeft="key-round" fullWidth onClick={async () => { const { error } = await store.resetPassword(store.session.email); store.notify(error ? 'danger' : 'info', error ? 'Não foi possível enviar o e-mail.' : 'E-mail de redefinição enviado para ' + store.session.email); }}>Redefinir senha</Button>
              <Button variant="ghost" iconLeft="log-out" fullWidth onClick={() => store.signOut()}>Sair da conta</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
export { KoblyProfile };
