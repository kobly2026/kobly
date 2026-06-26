// Kobly — Integrações. Domínios (SendGrid DKIM/DMARC/CNAME), Webhooks (secret), Tags, API.
// window.KoblyIntegrations
(function () {
  const DS = window.KoblyDesignSystem_29b7f4;
  const { Card, Badge, Button, IconButton, Icon, Input, Select } = DS;
  const { useState } = React;

  function CopyField({ value, label }) {
    const store = window.useKobly();
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
    const store = window.useKobly();
    async function verify(d) {
      await window.KoblyApi.verifyDmarc(d.id);
      store.notify('success', `Domínio ${d.url} verificado`);
      reload();
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
        <Button variant="secondary" iconLeft="plus" onClick={() => store.notify('info', 'Cadastrar domínio (demo)')}>Cadastrar novo domínio</Button>
      </div>
    );
  }

  function WebhooksTab({ data }) {
    const store = window.useKobly();
    const [reveal, setReveal] = useState({});
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {data.webhooks.map((w) => (
          <Card key={w.id} title={w.nome} subtitle={w.descricao}
            action={<Badge tone={w.desabilitado ? 'neutral' : (w.testado ? 'success' : 'warning')} dot>{w.desabilitado ? 'Desabilitado' : (w.testado ? 'Testado' : 'Não testado')}</Badge>}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', fontWeight: 'var(--fw-semibold)', marginBottom: 6 }}>URL do webhook</div>
                <CopyField value={w.url} label="URL" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end' }}>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', fontWeight: 'var(--fw-semibold)', marginBottom: 6 }}>Secret</div>
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
        <Button variant="secondary" iconLeft="plus" onClick={() => store.notify('info', 'Cadastrar webhook (demo)')}>Cadastrar webhook</Button>
      </div>
    );
  }

  function TagsTab({ data, onCreate }) {
    const store = window.useKobly();
    const DB = window.KoblyMockDB;
    const [nome, setNome] = useState('');
    const [tipo, setTipo] = useState('Abandono de carrinho');
    async function create() {
      if (!nome.trim()) return;
      const t = await window.KoblyApi.createTag({ nome, descricao: '', tipoEvento: tipo });
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
            Métodos suportados: {window.KoblyMockDB.optionSets.MetodoHTTPS.join(', ')}.
          </div>
        </div>
      </Card>
    );
  }

  function KoblyIntegrations() {
    const store = window.useKobly();
    const { useAsync, PageIntro, Segmented } = window;
    const a = useAsync(() => window.KoblyApi.getIntegrations(store.session.empresaId || 'emp_1'), [store.role]);
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
        {tab === 'webhooks' && <WebhooksTab data={a.data} />}
        {tab === 'tags' && <TagsTab data={a.data} onCreate={(t) => a.setData((d) => ({ ...d, tags: [...d.tags, t] }))} />}
        {tab === 'api' && <ApiTab data={a.data} />}
      </div>
    );
  }
  window.KoblyIntegrations = KoblyIntegrations;
})();
