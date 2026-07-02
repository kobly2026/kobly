import { useMemo, useState } from 'react';
import { KoblyApi } from '@/api/mockApi.js';
import { Icon, Select } from '@/ds';
import { PageIntro, useAsync } from '@/lib/hooks.jsx';
import { ErrorState } from '@/lib/ui.jsx';
import { useKobly } from '@/store/store.jsx';

// Kobly — Funil de recuperação. Visão visual das etapas com DADO REAL do banco:
// Evento recebido → E-mail enviado → Aberto → Clicado → Recuperado (venda).
// Cada etapa mostra o total real, o % em relação ao topo e a conversão da etapa anterior.

const STAGES = [
  { key: 'eventos', label: 'Eventos recebidos', icon: 'zap', tone: 'info', help: 'Eventos de checkout que chegaram (abandono, pix, compra…)' },
  { key: 'enviados', label: 'E-mails enviados', icon: 'send', tone: 'accent', help: 'E-mails de recuperação efetivamente disparados' },
  { key: 'abertos', label: 'Abertos', icon: 'mail-open', tone: 'warning', help: 'Leads únicos que abriram um e-mail' },
  { key: 'clicados', label: 'Clicados', icon: 'mouse-pointer-click', tone: 'info', help: 'Leads únicos que clicaram em um link' },
  { key: 'recuperados', label: 'Vendas recuperadas', icon: 'circle-check', tone: 'success', help: 'Compras aprovadas de leads que receberam e-mail' },
];

const pct = (n) => (n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
const toneVar = (t) => (t === 'accent' ? 'var(--accent)' : `var(--status-${t}-fg)`);
const toneBg = (t) => (t === 'accent' ? 'var(--accent-soft)' : `var(--status-${t}-bg)`);

function FunnelBar({ stage, value, topo, prev, isFirst }) {
  const widthPct = topo > 0 ? Math.max(3, (value / topo) * 100) : 3;
  const doTopo = topo > 0 ? value / topo : 0;
  const conv = prev != null && prev > 0 ? value / prev : null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ display: 'inline-flex', width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', background: toneBg(stage.tone), color: toneVar(stage.tone), flex: 'none' }}>
            <Icon name={stage.icon} size={16} />
          </span>
          <div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)' }}>{stage.label}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)' }}>{stage.help}</div>
          </div>
        </div>
        <div style={{ textAlign: 'end', flex: 'none' }}>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)', lineHeight: 1.1 }}>{value.toLocaleString('pt-BR')}</div>
          {!isFirst && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              {pct(doTopo)} do topo{conv != null ? ` · ${pct(conv)} da etapa anterior` : ''}
            </div>
          )}
        </div>
      </div>
      {/* barra proporcional ao topo */}
      <div style={{ height: 10, borderRadius: 'var(--radius-pill)', background: 'var(--surface-sunken)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${widthPct}%`, background: toneVar(stage.tone), borderRadius: 'var(--radius-pill)', transition: 'width var(--dur-med, .4s) ease' }} />
      </div>
    </div>
  );
}

// Card de funil reutilizável (usado na tela Funil e no Dashboard).
function LeadFunnel({ data }) {
  const d = data || { eventos: 0, enviados: 0, abertos: 0, clicados: 0, recuperados: 0 };
  const topo = d.eventos || 0;
  const cards = [
    { k: 'eventos', v: d.eventos }, { k: 'enviados', v: d.enviados }, { k: 'abertos', v: d.abertos },
    { k: 'clicados', v: d.clicados }, { k: 'recuperados', v: d.recuperados },
  ];
  return (
    <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: 22, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {STAGES.map((stage, i) => (
        <FunnelBar key={stage.key} stage={stage} value={cards[i].v} topo={topo} prev={i === 0 ? null : cards[i - 1].v} isFirst={i === 0} />
      ))}
    </div>
  );
}

function KoblyFunnel() {
  const store = useKobly();
  const isGestor = store.role === 'Gestor';
  const empresaId = store.session.empresaId;
  const clients = useAsync(() => (isGestor ? KoblyApi.listClients() : Promise.resolve([])), [store.role]);
  const [contaId, setContaId] = useState('');
  const targetOrg = isGestor ? (contaId || undefined) : (empresaId || undefined);
  const a = useAsync(() => KoblyApi.getFunnel(targetOrg), [store.role, targetOrg]);
  const d = a.data || { eventos: 0, enviados: 0, abertos: 0, clicados: 0, recuperados: 0 };
  const topo = d.eventos || 0;
  const vazio = !a.loading && a.status !== 'loading' && topo === 0 && d.enviados === 0;

  const cards = useMemo(() => ([
    { k: 'eventos', v: d.eventos }, { k: 'enviados', v: d.enviados }, { k: 'abertos', v: d.abertos },
    { k: 'clicados', v: d.clicados }, { k: 'recuperados', v: d.recuperados },
  ]), [d]);

  // taxa de conversão total (recuperados / eventos)
  const convTotal = topo > 0 ? d.recuperados / topo : 0;

  if (a.status === 'error') return <ErrorState message={a.error} onRetry={a.reload} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageIntro>
        Funil de recuperação — cada etapa mostra o número real de leads que avançaram, do evento de checkout até a venda recuperada.
      </PageIntro>

      {isGestor && (
        <Select
          label="Conta"
          value={contaId}
          onChange={(e) => setContaId(e.target.value)}
          options={[{ value: '', label: 'Todas as contas' }, ...((clients.data || []).map((c) => ({ value: c.id, label: c.nome })))]}
          style={{ maxWidth: 320 }}
        />
      )}

      {a.status === 'loading' ? (
        <div style={{ color: 'var(--text-muted)', padding: 28 }}>Carregando funil…</div>
      ) : vazio ? (
        <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          <Icon name="filter" size={26} style={{ opacity: 0.6 }} />
          <div style={{ marginTop: 10, fontSize: 'var(--text-sm)' }}>Nenhum dado no funil ainda. Assim que chegarem eventos de checkout e os e-mails forem disparados, as etapas se preenchem aqui.</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Conversão total (recuperados ÷ eventos):</span>
            <span style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--status-success-fg)' }}>{pct(convTotal)}</span>
          </div>
          <LeadFunnel data={d} />
        </>
      )}
    </div>
  );
}

export { KoblyFunnel, LeadFunnel };
