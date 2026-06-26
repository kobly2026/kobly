import { useState } from 'react';
import { KoblyApi } from '@/api/mockApi.js';
import { KoblyMockDB } from '@/api/mockData.js';
import { Badge, Button, Card, Icon, IconButton, Input, Select } from '@/ds';
import { PageIntro, useAsync } from '@/lib/hooks.jsx';
import { Segmented, Modal } from '@/lib/ui.jsx';
import { useKobly } from '@/store/store.jsx';

// Kobly — Integrações. Domínios (SendGrid DKIM/DMARC/CNAME), Webhooks (secret), Tags, API.
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

function DomainsTab({ data, reload }) {
  const store = useKobly();
  const [modal, setModal] = useState(false);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  async function verify(d) {
    await KoblyApi.verifyDmarc(d.id);
    store.notify('success', `Domínio ${d.url} verificado`);
    reload();
  }
  async function create() {
    if (!url.trim()) return;
    setBusy(true);
    try {
      await KoblyApi.createDomain(url);
      store.notify('success', 'Domínio cadastrado. Adicione os registros DNS e verifique.');
      setModal(false); setUrl(''); reload();
    } catch (e) {
      store.notify('danger', 'Não foi possível cadastrar o domínio.');
    } finally { setBusy(false); }
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {data.dominios.map((d) => (
        <Card key={d.id} title={d.url} subtitle={`SendGrid · ${d.idSendGrid}`}
          action={d.validado ? <Badge tone="success" dot>Validado</Badge> : <Button size="sm" variant="primary" iconLeft="shield-check" onClick={() => verify(d)}>Verificar DMARC</Button>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {d.registros.map((r, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 1.3fr 92px', gap: 10, alignItems: 'center' }}>
                <Badge tone="neutral" size="sm">{r.tipo}</Badge>
                <CopyField value={r.host} label="Host" />
                <CopyField value={r.valor} label="Valor" />
                <Badge tone={r.status === 'verificado' ? 'success' : 'warning'} dot>{r.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      ))}
      <Button variant="secondary" iconLeft="plus" onClick={() => setModal(true)}>Cadastrar novo domínio</Button>
      <Modal open={modal} onClose={() => setModal(false)} title="Cadastrar domínio de envio"
        subtitle="Geramos os registros DNS (DKIM/DMARC/CNAME) para você autenticar no seu provedor."
        footer={<>
          <Button variant="ghost" onClick={() => setModal(false)}>Cancelar</Button>
          <Button variant="primary" iconLeft="plus" disabled={busy || !url.trim()} onClick={create}>{busy ? 'Cadastrando…' : 'Cadastrar'}</Button>
        </>}>
        <Input label="Domínio" placeholder="ex.: envios.minhaloja.com.br" value={url} onChange={(e) => setUrl(e.target.value)} />
      </Modal>
    </div>
  );
}

// Plataformas de checkout suportadas (espelha o registry de adaptadores do webhook-receiver).
// `signs`: a plataforma assina o postback (HMAC) → pedimos a chave. `ready`: já tem adaptador.
// `semEventos`: eventos que a plataforma NÃO emite — orientação visual (não gateia a ingestão).
const CHECKOUT_PROVIDERS = [
  { value: 'nexopayt', label: 'NexoPayt', signs: true, ready: true, semEventos: ['Depósito Solicitado'] },
  { value: 'hotmart', label: 'Hotmart (em breve)', signs: true, ready: false, semEventos: [] },
  { value: 'kiwify', label: 'Kiwify (em breve)', signs: true, ready: false, semEventos: [] },
  { value: 'perfectpay', label: 'Perfect Pay (em breve)', signs: true, ready: false, semEventos: [] },
  { value: 'kactus', label: 'Kactus (em breve)', signs: true, ready: false, semEventos: [] },
  { value: 'generic', label: 'Genérico (campos no corpo)', signs: false, ready: true, semEventos: [] },
];
const providerLabel = (v) => (CHECKOUT_PROVIDERS.find((p) => p.value === v) || {}).label || v;

function WebhooksTab({ data, reload }) {
  const store = useKobly();
  const DB = KoblyMockDB;
  const [reveal, setReveal] = useState({});
  const [modal, setModal] = useState(false);
  const [provider, setProvider] = useState('nexopayt');
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [signingSecret, setSigningSecret] = useState('');
  const [eventos, setEventos] = useState([]);
  const [busy, setBusy] = useState(false);
  const prov = CHECKOUT_PROVIDERS.find((p) => p.value === provider) || CHECKOUT_PROVIDERS[0];
  const semEv = prov.semEventos || [];
  const toggleEv = (e) => { if (semEv.includes(e)) return; setEventos((arr) => (arr.includes(e) ? arr.filter((x) => x !== e) : [...arr, e])); };
  function changeProvider(v) {
    setProvider(v);
    const bloq = (CHECKOUT_PROVIDERS.find((p) => p.value === v) || {}).semEventos || [];
    setEventos((arr) => arr.filter((e) => !bloq.includes(e))); // poda eventos indisponíveis na nova plataforma
  }
  async function create() {
    if (!nome.trim()) return;
    setBusy(true);
    try {
      await KoblyApi.createWebhook({ nome, descricao, eventos, provider, signingSecret: prov.signs ? signingSecret : '' });
      store.notify('success', 'Webhook criado. Cole a URL de postback no painel da plataforma.');
      setModal(false); setNome(''); setDescricao(''); setSigningSecret(''); setEventos([]); setProvider('nexopayt'); reload();
    } catch (e) {
      store.notify('danger', 'Não foi possível criar o webhook.');
    } finally { setBusy(false); }
  }
  const labelCss = { fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', fontWeight: 'var(--fw-semibold)', marginBottom: 6 };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {data.webhooks.map((w) => (
        <Card key={w.id} title={w.nome} subtitle={w.descricao}
          action={<Badge tone={w.desabilitado ? 'neutral' : (w.testado ? 'success' : 'warning')} dot>{w.desabilitado ? 'Desabilitado' : (w.testado ? 'Testado' : 'Não testado')}</Badge>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {w.provider && w.provider !== 'generic' && (
              <div><Badge tone="info">{providerLabel(w.provider)}</Badge></div>
            )}
            <div>
              <div style={labelCss}>URL de postback</div>
              <CopyField value={w.url} label="URL de postback" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end' }}>
              <div>
                <div style={labelCss}>Secret</div>
                <CopyField value={reveal[w.id] ? w.secret : '•'.repeat(w.secret.length)} label="Secret" />
              </div>
              <Button size="sm" variant="ghost" iconLeft={reveal[w.id] ? 'eye-off' : 'eye'} onClick={() => setReveal((s) => ({ ...s, [w.id]: !s[w.id] }))}>{reveal[w.id] ? 'Ocultar' : 'Revelar'}</Button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {w.eventos.map((e) => <Badge key={e} tone="info">{e}</Badge>)}
            </div>
          </div>
        </Card>
      ))}
      <Button variant="secondary" iconLeft="plus" onClick={() => setModal(true)}>Cadastrar webhook</Button>
      <Modal open={modal} onClose={() => setModal(false)} title="Cadastrar webhook" width={520}
        subtitle="Escolha a plataforma; geramos a URL de postback e o secret. Cole a URL no painel da plataforma."
        footer={<>
          <Button variant="ghost" onClick={() => setModal(false)}>Cancelar</Button>
          <Button variant="primary" iconLeft="plus" disabled={busy || !nome.trim()} onClick={create}>{busy ? 'Criando…' : 'Criar webhook'}</Button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Select label="Plataforma de checkout" value={provider} onChange={(e) => changeProvider(e.target.value)}
            options={CHECKOUT_PROVIDERS.map((p) => ({ value: p.value, label: p.label }))} />
          {!prov.ready && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '8px 10px' }}>
              Adaptador da {prov.label.replace(' (em breve)', '')} ainda não disponível — por enquanto o evento entra como genérico (campos no corpo).
            </div>
          )}
          <Input label="Nome" placeholder="Ex.: NexoPayt — checkout" value={nome} onChange={(e) => setNome(e.target.value)} />
          <Input label="Descrição" placeholder="Opcional" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          {prov.signs && (
            <Input label="Chave de assinatura (signing secret)" placeholder="Chave que a plataforma usa para assinar o postback" value={signingSecret} onChange={(e) => setSigningSecret(e.target.value)} />
          )}
          <div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--text-body)', marginBottom: 8 }}>
              Eventos {semEv.length > 0 && <span style={{ color: 'var(--text-muted)', fontWeight: 'var(--fw-regular)' }}>· alguns indisponíveis nesta plataforma</span>}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {DB.optionSets.TipoEvento.map((e) => {
                const on = eventos.includes(e);
                const off = semEv.includes(e);
                return (
                  <button key={e} type="button" disabled={off} onClick={() => toggleEv(e)} title={off ? 'Indisponível nesta plataforma' : undefined} style={{
                    cursor: off ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                    border: `1px solid ${on ? 'var(--accent)' : 'var(--border-subtle)'}`,
                    background: on ? 'var(--accent-soft)' : 'var(--surface-sunken)',
                    color: off ? 'var(--text-subtle)' : (on ? 'var(--accent)' : 'var(--text-muted)'),
                    opacity: off ? 0.45 : 1, textDecoration: off ? 'line-through' : 'none',
                    borderRadius: 'var(--radius-pill)', padding: '5px 11px', fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-semibold)', fontFamily: 'var(--font-sans)',
                  }}>{e}</button>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function TagsTab({ data, onCreate }) {
  const store = useKobly();
  const DB = KoblyMockDB;
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState('Abandono de carrinho');
  async function create() {
    if (!nome.trim()) return;
    const t = await KoblyApi.createTag({ nome, descricao: '', tipoEvento: tipo });
    onCreate(t); setNome('');
    store.notify('success', `Tag "${t.nome}" criada`);
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

function ApiTab({ data }) {
  return (
    <Card title="Chave de API" subtitle="Use para integrar a Workflow API do Kobly">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <CopyField value={data.apiKey} label="Chave de API" />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
          <Icon name="info" size={15} style={{ color: 'var(--accent)' }} />
          Métodos suportados: {KoblyMockDB.optionSets.MetodoHTTPS.join(', ')}.
        </div>
      </div>
    </Card>
  );
}

function KoblyIntegrations() {
  const store = useKobly();
  const a = useAsync(() => KoblyApi.getIntegrations(store.session.empresaId || 'emp_1'), [store.role]);
  const [tab, setTab] = useState('dominios');
  if (a.status === 'loading') return <div style={{ color: 'var(--text-muted)' }}>Carregando integrações…</div>;

  const tabs = [
    { value: 'dominios', label: 'Domínios' },
    { value: 'webhooks', label: 'Webhooks' },
    { value: 'tags', label: 'Tags' },
    { value: 'api', label: 'API' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageIntro action={<Segmented value={tab} onChange={setTab} options={tabs} />}>
        Configure domínios de envio (SendGrid), webhooks de checkout, tags por evento e a chave de API.
      </PageIntro>
      {tab === 'dominios' && <DomainsTab data={a.data} reload={a.reload} />}
      {tab === 'webhooks' && <WebhooksTab data={a.data} reload={a.reload} />}
      {tab === 'tags' && <TagsTab data={a.data} onCreate={(t) => a.setData((d) => ({ ...d, tags: [...d.tags, t] }))} />}
      {tab === 'api' && <ApiTab data={a.data} />}
    </div>
  );
}
export { KoblyIntegrations };
