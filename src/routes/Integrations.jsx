import { useState, useEffect, useRef } from 'react';
import { KoblyApi } from '@/api/mockApi.js';
import { KoblyMockDB } from '@/api/mockData.js';
import { Badge, Button, Card, Icon, IconButton, Input, Select } from '@/ds';
import { PageIntro, useAsync } from '@/lib/hooks.jsx';
import { Segmented, Modal } from '@/lib/ui.jsx';
import { renderEmail } from '@/lib/emailTemplate.js';
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

// ── Hotmart: aceito nativamente (sem tradução), mapeamento informativo ──
const HOTMART_EVENTS = [
  { event: 'PURCHASE_APPROVED / PURCHASE_COMPLETE', trigger: 'Compra Aprovada' },
  { event: 'PURCHASE_CANCELED / PURCHASE_EXPIRED', trigger: 'Compra cancelada' },
  { event: 'PURCHASE_REFUNDED', trigger: 'Compra Reembolsada' },
  { event: 'PURCHASE_CHARGEBACK', trigger: 'Chargeback' },
  { event: 'PURCHASE_BILLET_PRINTED', trigger: 'Boleto Gerado' },
  { event: 'PURCHASE_OUT_OF_SHOPPING_CART', trigger: 'Abandono de carrinho (nome a confirmar no 1º teste)' },
  { event: 'SUBSCRIPTION_CANCELLATION', trigger: 'Cancelamento de Assinatura' },
];

// Tempo relativo curto ("agora", "há 12s", "há 3min") pra sessão de teste ao vivo.
function timeAgo(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.round(diffMs / 1000));
  if (s < 5) return 'agora';
  if (s < 60) return `há ${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m}min`;
  return `há ${Math.round(m / 60)}h`;
}

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
function PostbackTab({ data, empresaId }) {
  const store = useKobly();
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentEvents, setRecentEvents] = useState([]);
  const [creating, setCreating] = useState(false);
  const [listening, setListening] = useState(false);
  const [newIds, setNewIds] = useState(() => new Set());
  const [, forceTick] = useState(0); // só pra re-renderizar os "há Xs" durante a sessão
  const pollRef = useRef(null);
  const recentEventsRef = useRef([]);
  recentEventsRef.current = recentEvents;

  // Disparo de evento de teste (contra a própria URL de postback)
  const [testEvent, setTestEvent] = useState('payment_approved');
  const [testEmail, setTestEmail] = useState('');
  const [testName, setTestName] = useState('');
  const [testProduct, setTestProduct] = useState('');
  const [testValue, setTestValue] = useState('');
  const [firing, setFiring] = useState(false);

  // Filtros da lista de eventos
  const [evSearch, setEvSearch] = useState('');
  const [evType, setEvType] = useState('');
  const [evProvider, setEvProvider] = useState('');

  useEffect(() => {
    loadToken();
    loadRecentEvents();
    setListening(false); // trocou de conta → sessão anterior não vale mais
  }, [empresaId]);

  useEffect(() => {
    if (!listening) { clearInterval(pollRef.current); return undefined; }
    pollRef.current = setInterval(async () => {
      const fresh = await KoblyApi.getRecentEvents(100, empresaId);
      const prevIds = new Set(recentEventsRef.current.map((e) => e.id));
      const arrived = fresh.filter((e) => !prevIds.has(e.id));
      setRecentEvents(fresh);
      if (arrived.length) {
        setNewIds((s) => new Set([...s, ...arrived.map((e) => e.id)]));
        arrived.forEach((e) => {
          store.notify('success', `Novo evento: ${e.tipo_evento}`);
          setTimeout(() => setNewIds((s) => { const n = new Set(s); n.delete(e.id); return n; }), 4000);
        });
      }
      forceTick((n) => n + 1);
    }, 3000);
    return () => clearInterval(pollRef.current);
  }, [listening, empresaId]);

  async function loadToken() {
    setLoading(true);
    const t = await KoblyApi.getOrCreatePostbackToken(empresaId);
    setToken(t);
    setLoading(false);
  }

  async function loadRecentEvents() {
    const events = await KoblyApi.getRecentEvents(100, empresaId);
    setRecentEvents(events);
  }

  async function createNewToken() {
    setCreating(true);
    const t = await KoblyApi.createPostbackToken('Token ' + new Date().toLocaleDateString('pt-BR'), empresaId);
    if (t) {
      setToken(t);
      store.notify('success', 'Novo token criado');
    }
    setCreating(false);
  }

  const baseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hvkuymprmfrjrgpqaxbw.supabase.co';
  const postbackUrl = token ? `${baseUrl}/functions/v1/postback-receiver?token=${token.token}` : '';

  // Dispara um evento de teste contra a própria URL de postback (dado que VOCÊ escolhe,
  // diferente do botão de teste da Hotmart que manda payload enlatado deles).
  async function fireTestEvent() {
    if (!testEmail.trim() || !postbackUrl) return;
    setFiring(true);
    try {
      const payload = { event: testEvent, email: testEmail.trim() };
      if (testName.trim()) payload.name = testName.trim();
      if (testProduct.trim()) payload.product = testProduct.trim();
      if (testValue !== '' && !Number.isNaN(Number(testValue))) payload.value = Number(testValue);
      const res = await fetch(postbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok && !json.ignored) {
        store.notify('success', `Evento disparado: ${json.tipo_evento}${json.enqueued ? ` · ${json.enqueued} etapa(s) na fila` : ''}`);
        setListening(true); // liga a sessão ao vivo pra você ver o evento chegar
        const fresh = await KoblyApi.getRecentEvents(20, empresaId);
        setRecentEvents(fresh);
      } else {
        store.notify('danger', json.detail || json.reason || 'Falha ao disparar o evento de teste');
      }
    } catch (e) {
      store.notify('danger', 'Erro de rede ao disparar o evento');
    }
    setFiring(false);
  }

  const labelCss = { fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', fontWeight: 'var(--fw-semibold)', marginBottom: 6 };

  if (loading) return <div style={{ color: 'var(--text-muted)' }}>Carregando...</div>;

  const hasEvents = recentEvents.length > 0;

  // Filtros client-side sobre os eventos já carregados
  const providersPresent = Array.from(new Set(recentEvents.map((e) => e.provider || 'postback')));
  const typesPresent = Array.from(new Set(recentEvents.map((e) => e.tipo_evento).filter(Boolean)));
  const filteredEvents = recentEvents.filter((e) => {
    if (evType && e.tipo_evento !== evType) return false;
    if (evProvider && (e.provider || 'postback') !== evProvider) return false;
    if (evSearch.trim()) {
      const q = evSearch.toLowerCase();
      if (!`${e.email || ''} ${e.produto || ''}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

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

      {/* Próximo passo — o que fazer depois de colar a URL na plataforma */}
      {hasEvents ? (
        <Card title="Recebendo eventos ✓" subtitle="Sua integração está ativa. Próximo passo: crie a campanha que vai reagir a esses eventos.">
          <Button variant="primary" iconLeft="arrow-right" onClick={() => store.navigate('campanhas')}>Ir para Campanhas</Button>
        </Card>
      ) : (
        <Card title="Aguardando o primeiro evento" subtitle="Cole a URL acima no painel de checkout (ex.: Hotmart → Webhook) e dispare um evento de teste — assim que chegar, ele aparece aqui embaixo.">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            <Icon name="loader" size={15} style={{ color: 'var(--accent)' }} />
            Nenhum evento recebido ainda nesta conta.
          </div>
        </Card>
      )}

      {/* Disparar evento de teste (dado que VOCÊ escolhe) */}
      <Card title="Disparar evento de teste" subtitle="Dispare um evento com seus próprios dados contra a URL acima — diferente do teste da Hotmart, que manda dados de exemplo fixos.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Select
            label="Tipo de evento"
            value={testEvent}
            onChange={(e) => setTestEvent(e.target.value)}
            options={SUPPORTED_EVENTS.map((ev) => ({ value: ev.event, label: ev.label }))}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="E-mail do lead" placeholder="voce@email.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
            <Input label="Nome (opcional)" placeholder="Nome do lead" value={testName} onChange={(e) => setTestName(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Produto (opcional)" placeholder="Nome do produto" value={testProduct} onChange={(e) => setTestProduct(e.target.value)} />
            <Input label="Valor (opcional)" placeholder="197.00" value={testValue} onChange={(e) => setTestValue(e.target.value)} />
          </div>
          <Button variant="primary" iconLeft="zap" disabled={firing || !testEmail.trim()} onClick={fireTestEvent}>
            {firing ? 'Disparando...' : 'Disparar evento de teste'}
          </Button>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            O evento cai na sua conta como se viesse do checkout — vira lead, dispara campanhas ativas com o gatilho correspondente e aparece na sessão ao vivo abaixo.
          </div>
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

      {/* Hotmart nativo */}
      <Card title="Hotmart" subtitle="Cole a mesma URL acima em Ferramentas → Webhook (versão 2.0.0) — o payload nativo da Hotmart é aceito sem adaptação">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {HOTMART_EVENTS.map((ev) => (
            <div key={ev.event} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <code style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--accent)', minWidth: 260 }}>{ev.event}</code>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-strong)' }}>→ {ev.trigger}</div>
            </div>
          ))}
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            Marque todos os eventos ao cadastrar o Webhook na Hotmart. Eventos fora dessa lista (protesto, atraso, clube) são recebidos e ignorados sem erro — não derrubam o webhook.
          </div>
        </div>
      </Card>

      {/* Exemplo de payload */}
      <Card title="Exemplo de payload (outras plataformas)" subtitle="Copie e adapte para sua plataforma">
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

      {/* Sessão de teste ao vivo / últimos eventos */}
      {(recentEvents.length > 0 || listening) && (
        <Card
          title={listening ? 'Sessão de teste ao vivo' : 'Últimos eventos recebidos'}
          subtitle={listening ? 'Atualiza sozinho a cada 3s — dispare eventos na sua plataforma e acompanhe aqui.' : `${recentEvents.length} eventos recentes`}
          action={
            <Button
              size="sm"
              variant={listening ? 'ghost' : 'secondary'}
              iconLeft={listening ? 'square' : 'play'}
              onClick={() => setListening((v) => !v)}
            >
              {listening ? 'Parar sessão' : 'Iniciar sessão de teste'}
            </Button>
          }
        >
          {listening && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-xs)', color: 'var(--status-success-fg)', marginBottom: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor', display: 'inline-block', animation: 'kbly-pulse 1.4s ease-in-out infinite' }} />
              Ouvindo eventos em tempo real…
            </div>
          )}
          {recentEvents.length === 0 ? (
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', padding: '8px 0' }}>Nenhum evento ainda nesta sessão. Dispare um teste na sua plataforma de checkout.</div>
          ) : (
            <>
              {/* Filtros */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                <div style={{ flex: '1 1 200px', minWidth: 160 }}>
                  <Input icon="search" placeholder="Buscar por e-mail ou produto…" value={evSearch} onChange={(e) => setEvSearch(e.target.value)} />
                </div>
                <Select
                  value={evType}
                  onChange={(e) => setEvType(e.target.value)}
                  options={[{ value: '', label: 'Todos os eventos' }, ...typesPresent.map((t) => ({ value: t, label: t }))]}
                  style={{ minWidth: 170 }}
                />
                {providersPresent.length > 1 && (
                  <Select
                    value={evProvider}
                    onChange={(e) => setEvProvider(e.target.value)}
                    options={[{ value: '', label: 'Todas as origens' }, ...providersPresent.map((p) => ({ value: p, label: p }))]}
                    style={{ minWidth: 150 }}
                  />
                )}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', marginBottom: 6 }}>
                {filteredEvents.length} de {recentEvents.length} evento(s)
              </div>
              {filteredEvents.length === 0 ? (
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', padding: '8px 0' }}>Nenhum evento corresponde aos filtros.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {filteredEvents.map((ev) => (
                    <div
                      key={ev.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderBottom: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)', background: newIds.has(ev.id) ? 'var(--status-success-bg, rgba(61,220,132,0.08))' : 'transparent',
                        transition: 'background 1.2s ease-out',
                      }}
                    >
                      <Badge tone={KoblyMockDB.eventTone[ev.tipo_evento] || 'neutral'} dot>{ev.tipo_evento}</Badge>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.email}</div>
                        {ev.produto && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{ev.produto}{ev.valor_produto ? ` — R$ ${ev.valor_produto}` : ''}</div>}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textAlign: 'right', flex: 'none' }}>
                        <div>{ev.provider || 'postback'}</div>
                        <div>{timeAgo(ev.created_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
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
// ── Aba: Marca (white-label) ──
function BrandTab({ empresaId }) {
  const store = useKobly();
  const [nome, setNome] = useState('');
  const [cor, setCor] = useState('#ff6800');
  const [logoUrl, setLogoUrl] = useState('');
  const [modo, setModo] = useState('dark'); // tema do e-mail: dark | light
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    KoblyApi.getBranding(empresaId).then((b) => {
      if (!alive || !b) { setLoading(false); return; }
      setNome(b.nome || '');
      setCor(b.cor || '#ff6800');
      setLogoUrl(b.logo_url || '');
      setModo(b.modo === 'light' ? 'light' : 'dark');
      setLoading(false);
    });
    return () => { alive = false; };
  }, [empresaId]);

  async function onFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploading(true);
    const r = await KoblyApi.uploadLogo(file, empresaId);
    setUploading(false);
    if (r && r.url) { setLogoUrl(r.url); store.notify('success', 'Logo enviado'); }
    else store.notify('danger', 'Falha ao enviar o logo');
  }
  async function save() {
    setSaving(true);
    const { error } = await KoblyApi.saveBranding(empresaId, { nome, cor, logoUrl, modo });
    setSaving(false);
    store.notify(error ? 'danger' : 'success', error ? 'Não foi possível salvar' : 'Marca salva — aplicada aos e-mails');
  }

  // Preview ao vivo de um e-mail com a marca aplicada
  const previewHtml = renderEmail({
    brand: { name: nome || 'Sua Loja', logoUrl, color: cor, mode: modo },
    preheader: 'Prévia da sua marca',
    blocks: [
      { type: 'hero', eyebrow: 'Recuperação', title: 'Você esqueceu algo no carrinho', text: 'Finalize sua compra e garanta seu pedido.' },
      { type: 'button', label: 'Voltar ao carrinho', href: '#' },
      { type: 'coupon', code: 'VOLTA10', note: '10% de desconto por tempo limitado' },
    ],
  });

  if (loading) return <div style={{ color: 'var(--text-muted)' }}>Carregando marca...</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.1fr)', gap: 18, alignItems: 'start' }}>
      <Card title="Marca da conta" subtitle="Seu logo e cor aparecem nos e-mails enviados aos leads.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', fontWeight: 'var(--fw-semibold)', marginBottom: 8 }}>Logo</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flex: 'none' }}>
                {logoUrl ? <img src={logoUrl} alt="logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <Icon name="image" size={20} style={{ color: 'var(--text-subtle)' }} />}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
                <Button variant="secondary" size="sm" iconLeft="upload" disabled={uploading} onClick={() => fileRef.current && fileRef.current.click()}>{uploading ? 'Enviando...' : 'Enviar logo'}</Button>
                {logoUrl && <button onClick={() => setLogoUrl('')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 'var(--text-xs)', cursor: 'pointer', textAlign: 'start', padding: 0 }}>Remover logo</button>}
              </div>
            </div>
          </div>
          <Input label="Nome da marca" placeholder="Ex.: Loja do João" value={nome} onChange={(e) => setNome(e.target.value)} />
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', fontWeight: 'var(--fw-semibold)', marginBottom: 8 }}>Cor da marca</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="color" value={cor} onChange={(e) => setCor(e.target.value)} style={{ width: 44, height: 34, border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', background: 'none', cursor: 'pointer', padding: 2 }} />
              <Input value={cor} onChange={(e) => setCor(e.target.value)} style={{ maxWidth: 130 }} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', fontWeight: 'var(--fw-semibold)', marginBottom: 8 }}>Tema do e-mail</div>
            <Segmented value={modo} onChange={setModo} options={[{ value: 'dark', label: 'Escuro' }, { value: 'light', label: 'Claro' }]} />
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 6 }}>Define o fundo dos e-mails enviados aos leads.</div>
          </div>
          <Button variant="primary" iconLeft="check" disabled={saving} onClick={save}>{saving ? 'Salvando...' : 'Salvar marca'}</Button>
        </div>
      </Card>

      <Card title="Prévia do e-mail" subtitle="Como seus e-mails ficam com esta marca.">
        <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
          <iframe title="preview" srcDoc={previewHtml} style={{ width: '100%', height: 520, border: 'none', display: 'block', background: modo === 'light' ? '#f4f4f5' : '#000' }} />
        </div>
      </Card>
    </div>
  );
}

function KoblyIntegrations() {
  const store = useKobly();
  const isGestor = store.role === 'Gestor';
  const a = useAsync(() => KoblyApi.getIntegrations(), [store.role]);
  const clients = useAsync(() => (isGestor ? KoblyApi.listClients() : Promise.resolve([])), [store.role]);
  const [tab, setTab] = useState('postback');
  const [contaId, setContaId] = useState(null); // conta em foco (Gestor)
  const empresaId = isGestor ? contaId : store.session.empresaId;
  if (a.status === 'loading') return <div style={{ color: 'var(--text-muted)' }}>Carregando integrações...</div>;

  const tabs = [
    { value: 'postback', label: 'Postback URL' },
    { value: 'marca', label: 'Marca' },
    { value: 'emails', label: 'Templates de e-mail' },
    { value: 'tags', label: 'Tags' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageIntro action={<Segmented value={tab} onChange={setTab} options={tabs} />}>
        Configure a URL de postback, templates de e-mail e tags por evento.
      </PageIntro>
      {isGestor && (
        <Select
          label="Conta"
          value={contaId || ''}
          onChange={(e) => setContaId(e.target.value || null)}
          options={[{ value: '', label: 'Selecione uma conta de cliente' }, ...((clients.data || []).map((c) => ({ value: c.id, label: c.nome })))]}
          style={{ maxWidth: 320 }}
        />
      )}
      {isGestor && !contaId
        ? <div style={{ color: 'var(--text-muted)', padding: 28 }}>Selecione uma conta de cliente para ver as integrações.</div>
        : (<>
            {tab === 'postback' && <PostbackTab data={a.data} empresaId={empresaId} />}
            {tab === 'marca' && <BrandTab empresaId={empresaId} />}
            {tab === 'emails' && <EmailTemplatesTab data={a.data} reload={a.reload} />}
            {tab === 'tags' && <TagsTab data={a.data} reload={a.reload} />}
          </>)}
    </div>
  );
}
export { KoblyIntegrations };
