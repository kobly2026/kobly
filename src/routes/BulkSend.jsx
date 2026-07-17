import { useState, useEffect, useMemo, useRef } from 'react';
import { KoblyApi } from '@/api/mockApi.js';
import { KoblyMockDB } from '@/api/mockData.js';
import { Badge, Banner, Button, Card, Icon, Input, Select } from '@/ds';
import { PageIntro, useAsync } from '@/lib/hooks.jsx';
import { ErrorState, SkeletonCards } from '@/lib/ui.jsx';
import { useKobly } from '@/store/store.jsx';

// Kobly — Disparo em massa (email / WhatsApp / SMS) para listas de leads.
// Seleciona canal + audiência (todos / por tag / por evento) + template, mostra a
// prévia da audiência e dispara via edge `bulk-send` (worker process-bulk envia).

const CANAIS = [
  { value: 'email', label: 'E-mail', icon: 'mail' },
  { value: 'whatsapp', label: 'WhatsApp', icon: 'message-circle' },
  { value: 'sms', label: 'SMS', icon: 'smartphone' },
];
const TARGETS = [
  { value: 'all', label: 'Todos os leads' },
  { value: 'tag', label: 'Por tag' },
  { value: 'evento', label: 'Por último evento' },
];
const STATUS_TONE = { rascunho: 'neutral', enfileirando: 'info', enviando: 'accent', concluido: 'success', falhou: 'danger', cancelado: 'warning' };
const TERMINAL = ['concluido', 'cancelado', 'falhou'];

function KoblyBulkSend() {
  const store = useKobly();
  const orgId = store.session.empresaId;
  const optsA = useAsync(() => KoblyApi.getFlowOptions(), [store.role]);
  const opts = optsA.data || { emails: [], whatsappMessages: [], smsMessages: [], tags: [] };
  const histA = useAsync(() => KoblyApi.listBulkSends(orgId), [orgId]);

  const [canal, setCanal] = useState('email');
  const [targetMode, setTargetMode] = useState('all');
  const [tagIds, setTagIds] = useState([]);
  const [evento, setEvento] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [ratePorMin, setRatePorMin] = useState(60);
  const [est, setEst] = useState({ loading: false, total: null, error: null });
  const [creating, setCreating] = useState(false);
  const [running, setRunning] = useState(null); // { id, status, total, enviados, falhados, pulados }

  const templates = canal === 'email' ? (opts.emails || []) : canal === 'whatsapp' ? (opts.whatsappMessages || []) : (opts.smsMessages || []);

  // Reseta o template ao trocar de canal (templates são por canal).
  useEffect(() => { setTemplateId(''); }, [canal]);

  const filter = useMemo(() => {
    if (targetMode === 'tag' && tagIds.length) return { tag_ids: tagIds };
    if (targetMode === 'evento' && evento) return { evento };
    return {};
  }, [targetMode, tagIds, evento]);
  const filterKey = JSON.stringify(filter);

  // Prévia da audiência (debounce): recalcula ao mudar canal/filtro.
  useEffect(() => {
    if (!orgId) return;
    let cancel = false;
    setEst((e) => ({ ...e, loading: true, error: null }));
    const t = setTimeout(async () => {
      const r = await KoblyApi.estimateBulkAudience({ canal, filter, organizationId: orgId });
      if (cancel) return;
      if (r.error) setEst({ loading: false, total: null, error: r.error });
      else setEst({ loading: false, total: r.total, error: null });
    }, 500);
    return () => { cancel = true; clearTimeout(t); };
  }, [canal, filterKey, orgId]);

  // Polling do progresso enquanto o disparo não terminou.
  const pollRef = useRef(null);
  useEffect(() => {
    if (!running || TERMINAL.includes(running.status)) return;
    pollRef.current = setInterval(async () => {
      const s = await KoblyApi.bulkSendStatus(running.id);
      if (s && s.status) {
        setRunning((r) => ({ ...r, ...s }));
        if (TERMINAL.includes(s.status)) { clearInterval(pollRef.current); histA.reload(); }
      }
    }, 4000);
    return () => clearInterval(pollRef.current);
  }, [running?.id, running?.status]);

  function toggleTag(id) {
    setTagIds((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));
  }

  async function dispatch() {
    if (!templateId) { store.notify('warning', 'Selecione um template para o disparo.'); return; }
    if (est.total != null && est.total <= 0) { store.notify('warning', 'Nenhum lead corresponde ao filtro selecionado.'); return; }
    if (!window.confirm(`Confirmar disparo de ${canal.toUpperCase()} para ${est.total ?? '—'} lead(s)? Esta ação não pode ser desfeita.`)) return;
    setCreating(true);
    const r = await KoblyApi.createBulkSend({ canal, templateId, filter, ratePorMin: Number(ratePorMin) || 60, organizationId: orgId });
    setCreating(false);
    if (r.error) { store.notify('danger', r.error); return; }
    store.notify('success', `Disparo criado — ${r.total} destinatário(s) na fila.`);
    setRunning({ id: r.bulkSendId, status: 'enviando', total: r.total, enviados: 0, falhados: 0, pulados: 0 });
    histA.reload();
  }

  if (!orgId) return <Banner tone="warning" title="Selecione uma conta">O disparo em massa precisa de uma organização ativa.</Banner>;
  if (optsA.status === 'error') return <ErrorState message={optsA.error} onRetry={optsA.reload} />;
  if (optsA.status === 'loading') return <SkeletonCards count={2} height={220} />;

  const noTemplates = templates.length === 0;
  const pct = running && running.total ? Math.min(100, Math.round(((running.enviados + running.falhados + running.pulados) / running.total) * 100)) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageIntro>Envie um e-mail, WhatsApp ou SMS em massa para uma lista de leads da sua conta.</PageIntro>

      {running && (
        <Card icon="send" title="Disparo em andamento" subtitle={`Status: ${running.status}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ height: 10, borderRadius: 'var(--radius-pill)', background: 'var(--surface-sunken)', overflow: 'hidden' }}>
              <div style={{ width: pct + '%', height: '100%', background: 'var(--accent)', borderRadius: 'var(--radius-pill)', transition: 'width var(--dur-med)' }} />
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 'var(--text-sm)', color: 'var(--text-body)' }}>
              <span><b className="kbly-num">{running.enviados || 0}</b> enviados</span>
              <span><b className="kbly-num">{running.falhados || 0}</b> falhas</span>
              <span><b className="kbly-num">{running.pulados || 0}</b> pulados</span>
              <span style={{ marginInlineStart: 'auto' }}>total <b className="kbly-num">{running.total || 0}</b></span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Badge tone={STATUS_TONE[running.status] || 'neutral'} dot>{running.status}</Badge>
              {!TERMINAL.includes(running.status) && (
                <Button size="sm" variant="ghost" onClick={() => setRunning(null)}>Ocultar painel</Button>
              )}
              {TERMINAL.includes(running.status) && (
                <Button size="sm" variant="secondary" onClick={() => setRunning(null)}>Novo disparo</Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {!running && (
        <Card icon="send" title="Novo disparo">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Canal */}
            <div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--text-body)', marginBottom: 8 }}>Canal</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {CANAIS.map((c) => {
                  const on = canal === c.value;
                  return (
                    <button key={c.value} onClick={() => setCanal(c.value)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 'var(--radius-md)', border: `1px solid ${on ? 'var(--accent)' : 'var(--border-subtle)'}`, background: on ? 'var(--accent-soft)' : 'var(--surface-sunken)', color: on ? 'var(--accent)' : 'var(--text-body)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)' }}>
                      <Icon name={c.icon} size={15} /> {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Audiência */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Select label="Audiência" value={targetMode} onChange={(e) => setTargetMode(e.target.value)} options={TARGETS} />
              {targetMode === 'evento' && (
                <Select label="Último evento" value={evento} onChange={(e) => setEvento(e.target.value)} options={[{ value: '', label: 'Selecionar…' }, ...KoblyMockDB.optionSets.TipoEvento]} />
              )}
            </div>
            {targetMode === 'tag' && (
              <div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--text-body)', marginBottom: 8 }}>Tags (qualquer uma)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(opts.tags || []).map((t) => {
                    const on = tagIds.includes(t.id);
                    return <button key={t.id} onClick={() => toggleTag(t.id)} style={{ cursor: 'pointer', border: `1px solid ${on ? 'var(--accent)' : 'var(--border-subtle)'}`, background: on ? 'var(--accent-soft)' : 'var(--surface-sunken)', color: on ? 'var(--accent)' : 'var(--text-muted)', borderRadius: 'var(--radius-pill)', padding: '4px 10px', fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-semibold)', fontFamily: 'var(--font-sans)' }}>{t.nome}</button>;
                  })}
                  {(opts.tags || []).length === 0 && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Nenhuma tag cadastrada.</span>}
                </div>
              </div>
            )}

            {/* Prévia da audiência */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)', color: 'var(--text-body)', padding: '10px 12px', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
              <Icon name="users-round" size={16} style={{ color: 'var(--accent)' }} />
              {est.loading ? 'Calculando audiência…'
                : est.error ? <span style={{ color: 'var(--status-danger-fg)' }}>{est.error}</span>
                : <span><b className="kbly-num">{est.total ?? 0}</b> lead(s) com {canal === 'email' ? 'e-mail' : 'telefone'} válido receberão este disparo.</span>}
            </div>

            {/* Template */}
            {noTemplates ? (
              <Banner tone="info" title="Nenhum template neste canal">Crie um template em Integrações antes de disparar.</Banner>
            ) : (
              <Select label="Template a enviar" value={templateId} onChange={(e) => setTemplateId(e.target.value)}
                options={[{ value: '', label: 'Selecionar…' }, ...templates.map((t) => ({ value: t.id, label: t.titulo || 'Sem título' }))]} />
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'end' }}>
              <Input label="Ritmo (mensagens/min)" type="number" value={ratePorMin} onChange={(e) => setRatePorMin(Math.max(1, parseInt(e.target.value || '60', 10)))} hint="Escalona os envios para respeitar limites do provedor." />
              <Button variant="primary" iconLeft="send" disabled={creating || noTemplates || !templateId} onClick={dispatch}>
                {creating ? 'Criando disparo…' : 'Disparar agora'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Histórico */}
      <Card icon="history" title="Disparos recentes" pad={false}>
        {(histA.data || []).length === 0 ? (
          <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Nenhum disparo ainda.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {(histA.data || []).map((b) => (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: '1px solid var(--border-subtle)' }}>
                <Icon name={b.canal === 'email' ? 'mail' : b.canal === 'SMS' ? 'smartphone' : 'message-circle'} size={16} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-strong)', textTransform: 'capitalize' }}>{b.canal}</span>
                <Badge tone={STATUS_TONE[b.status] || 'neutral'} dot>{b.status}</Badge>
                <span style={{ marginInlineStart: 'auto', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }} className="kbly-num">
                  {b.enviados}/{b.total} enviados{b.falhados ? ` · ${b.falhados} falhas` : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
export { KoblyBulkSend };
