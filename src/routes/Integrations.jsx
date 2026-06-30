import { useState, useEffect } from 'react';
import { KoblyApi } from '@/api/mockApi.js';
import { KoblyMockDB } from '@/api/mockData.js';
import { Badge, Button, Card, Icon, IconButton, Input, Select } from '@/ds';
import { PageIntro, useAsync } from '@/lib/hooks.jsx';
import { Segmented, Modal } from '@/lib/ui.jsx';
import { useKobly } from '@/store/store.jsx';

// Kobly — Integrações simplificada. Postback URL + Templates de email + Tags.
// KoblyIntegrations

function CopyField({ value, label }) {
  const store = useKobly();
  function copy() {
    try { navigator.clipboard.writeText(value); } catch (e) {}
    store.notify('success', `${label || 'Valor'} copiado`);
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '6px 6px 6px 12px' }}>
      <code style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</code>
      <IconButton icon="copy" size="sm" aria-label="Copiar" onClick={copy} />
    </div>
  );
}

// ── Eventos suportados (mapeamento event → tipo_evento) ──
const SUPPORTED_EVENTS = [
  { event: 'cart_abandoned', label: 'Carrinho abandonado', description: 'Quando o lead abandona o carrinho de compras' },
  { event: 'payment_approved', label: 'Compra aprovada', description: 'Pagamento confirmado com sucesso' },
  { event: 'payment_refused', label: 'Compra recusada', description: 'Pagamento recusado pelo processador' },
  { event: 'payment_refunded', label: 'Compra reembolsada', description: 'Valor devolvido ao lead' },
  { event: 'payment_chargeback', label: 'Chargeback', description: 'Estorno solicitado pelo comprador' },
  { event: 'payment_canceled', label: 'Compra cancelada', description: 'Pedido cancelado' },
  { event: 'subscription_canceled', label: 'Cancelamento de assinatura', description: 'Assinatura cancelada' },
  { event: 'pix_generated', label: 'Pix gerado', description: 'Código Pix criado para pagamento' },
  { event: 'boleto_generated', label: 'Boleto gerado', description: 'Boleto emitido para pagamento' },
  { event: 'deposit_requested', label: 'Depósito solicitado', description: 'Solicitação de depósito bancário' },
];

const EXAMPLE_PAYLOAD = `{
  "event": "cart_abandoned",
  "email": "lead@email.com",
  "name": "Nome do Lead",
  "product": "Produto Exemplo",
  "value": 197.00,
  "payment_method": "pix",
  "external_id": "tx_123456"
}`;

// ── Aba 1: Postback URL ──
function PostbackTab({ data }) {
  const store = useKobly();
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentEvents, setRecentEvents] = useState([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadToken();
    loadRecentEvents();
  }, []);

  async function loadToken() {
    setLoading(true);
    const t = await KoblyApi.getOrCreatePostbackToken();
    setToken(t);
    setLoading(false);
  }

  async function loadRecentEvents() {
    const events = await KoblyApi.getRecentEvents(10);
    setRecentEvents(events);
  }

  async function createNewToken() {
    setCreating(true);
    const t = await KoblyApi.createPostbackToken('Token ' + new Date().toLocaleDateString('pt-BR'));
    if (t) {
      setToken(t);
      store.notify('success', 'Novo token criado');
    }
    setCreating(false);
  }

  const baseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hvkuymprmfrjrgpqaxbw.supabase.co';
  const postbackUrl = token ? `${baseUrl}/functions/v1/postback-receiver?token=${token.token}` : '';

  const labelCss = { fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', fontWeight: 'var(--fw-semibold)', marginBottom: 6 };

  if (loading) return <div style={{ color: 'var(--text-muted)' }}>Carregando...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* URL de Postback */}
      <Card title="URL de Postback" subtitle="Cole esta URL no painel da sua plataforma de checkout">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={labelCss}>Sua URL de postback</div>
            <CopyField value={postbackUrl || 'Carregando...'} label="URL de postback" />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            <Icon name="info" size={15} style={{ color: 'var(--accent)' }} />
            Esta URL aceita POST com JSON. Qualquer plataforma pode usar.
          </div>
          <Button variant="secondary" iconLeft="plus" onClick={createNewToken} disabled={creating}>
            {creating ? 'Criando...' : 'Gerar novo token'}
          </Button>
        </div>
      </Card>

      {/* Eventos suportados */}
      <Card title="Eventos suportados" subtitle="Envie estes eventos no campo 'event' do payload">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SUPPORTED_EVENTS.map((ev) => (
            <div key={ev.event} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <code style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--accent)', minWidth: 180 }}>{ev.event}</code>
              <div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)' }}>{ev.label}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{ev.description}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Exemplo de payload */}
      <Card title="Exemplo de payload" subtitle="Copie e adapte para sua plataforma">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <pre style={{
            background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)', padding: 12, margin: 0,
            fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-body)',
            overflow: 'auto', whiteSpace: 'pre-wrap',
          }}>
            {EXAMPLE_PAYLOAD}
          </pre>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            Campos opcionais: <code>name</code>, <code>product</code>, <code>value</code>, <code>payment_method</code>, <code>external_id</code>
          </div>
        </div>
      </Card>

      {/* Últimos eventos */}
      {recentEvents.length > 0 && (
        <Card title="Últimos eventos recebidos" subtitle={`${recentEvents.length} eventos recentes`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {recentEvents.map((ev) => (
              <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <Badge tone={KoblyMockDB.eventTone[ev.tipo_evento] || 'neutral'} dot>{ev.tipo_evento}</Badge>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-strong)' }}>{ev.email}</div>
                  {ev.produto && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{ev.produto}{ev.valor_produto ? ` — R$ ${ev.valor_produto}` : ''}</div>}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{ev.provider || 'postback'}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Aba 2: Templates de Email ──
function EmailTemplatesTab({ data }) {
  const store = useKobly();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ titulo: '', assunto: '', remetente: '' });

  function openNew() {
    setEditing(null);
    setForm({ titulo: '', assunto: '', remetente: '' });
    setModal(true);
  }

  function openEdit(email) {
    setEditing(email);
    setForm({ titulo: email.titulo, assunto: email.assunto, remetente: email.remetente });
    setModal(true);
  }

  async function save() {
    if (!form.titulo.trim() || !form.assunto.trim()) return;
    if (editing) {
      await KoblyApi.updateEmail(editing.id, form);
      store.notify('success', 'E-mail atualizado');
    }
    setModal(false);
    reload();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {data.emails.map((e) => (
        <Card key={e.id} title={e.titulo} subtitle={e.assunto}
          action={<Button size="sm" variant="ghost" iconLeft="pencil" onClick={() => openEdit(e)}>Editar</Button>}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Icon name="mail" size={16} style={{ color: 'var(--accent)' }} />
            <div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-strong)' }}>{e.assunto}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Remetente: {e.remetente}</div>
            </div>
          </div>
        </Card>
      ))}
      <Button variant="secondary" iconLeft="plus" onClick={openNew}>Novo template de e-mail</Button>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar e-mail' : 'Novo e-mail'} width={520}
        footer={<>
          <Button variant="ghost" onClick={() => setModal(false)}>Cancelar</Button>
          <Button variant="primary" disabled={!form.titulo.trim() || !form.assunto.trim()} onClick={save}>Salvar</Button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Título (intern)" placeholder="Ex.: Carrinho — lembrete" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          <Input label="Assunto do e-mail" placeholder="Ex.: Você esqueceu algo no carrinho" value={form.assunto} onChange={(e) => setForm({ ...form, assunto: e.target.value })} />
          <Input label="Nome do remetente" placeholder="Ex.: Loja do João" value={form.remetente} onChange={(e) => setForm({ ...form, remetente: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}

// ── Aba 3: Tags ──
function TagsTab({ data, reload }) {
  const store = useKobly();
  const DB = KoblyMockDB;
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState('Abandono de carrinho');
  async function create() {
    if (!nome.trim()) return;
    const t = await KoblyApi.createTag({ nome, descricao: '', tipoEvento: tipo });
    store.notify('success', `Tag "${t.nome}" criada`);
    setNome('');
    reload();
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, alignItems: 'start' }}>
      <Card title="Tags da conta" subtitle="Disparadas por tipo de evento do checkout" pad={false}>
        <div style={{ padding: 8 }}>
          {data.tags.map((t) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)' }}>{t.nome}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{t.descricao || '—'}</div>
              </div>
              <Badge tone={DB.eventTone[t.tipoEvento] || 'neutral'} dot>{t.tipoEvento}</Badge>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Nova tag">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Nome da tag" placeholder="Ex.: Cliente VIP" value={nome} onChange={(e) => setNome(e.target.value)} />
          <Select label="Tipo de evento" value={tipo} onChange={(e) => setTipo(e.target.value)} options={DB.optionSets.TipoEvento} />
          <Button variant="primary" iconLeft="plus" disabled={!nome.trim()} onClick={create}>Criar tag</Button>
        </div>
      </Card>
    </div>
  );
}

// ── Componente principal ──
function KoblyIntegrations() {
  const store = useKobly();
  const a = useAsync(() => KoblyApi.getIntegrations(store.session.empresaId || 'emp_1'), [store.role]);
  const [tab, setTab] = useState('postback');
  if (a.status === 'loading') return <div style={{ color: 'var(--text-muted)' }}>Carregando integrações...</div>;

  const tabs = [
    { value: 'postback', label: 'Postback URL' },
    { value: 'emails', label: 'Templates de e-mail' },
    { value: 'tags', label: 'Tags' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageIntro action={<Segmented value={tab} onChange={setTab} options={tabs} />}>
        Configure a URL de postback, templates de e-mail e tags por evento.
      </PageIntro>
      {tab === 'postback' && <PostbackTab data={a.data} />}
      {tab === 'emails' && <EmailTemplatesTab data={a.data} reload={a.reload} />}
      {tab === 'tags' && <TagsTab data={a.data} reload={a.reload} />}
    </div>
  );
}
export { KoblyIntegrations };
