import { useState } from 'react';
import { KoblyApi } from '@/api/mockApi.js';
import { KoblyAI } from '@/api/ai.js';
import { Card, Icon, MetricCard, Select } from '@/ds';
import { PageIntro, useAsync } from '@/lib/hooks.jsx';
import { AISuggestion, ErrorState, SkeletonDashboard } from '@/lib/ui.jsx';
import { LeadFunnel } from '@/routes/Funnel.jsx';
import { useKobly } from '@/store/store.jsx';

// Kobly — Dashboard completo. KPIs reais + insight de IA + funil + atividade + top campanhas.

const pctFmt = (n) => (n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
const intFmt = (n) => Number(n || 0).toLocaleString('pt-BR');

// bg/fg de uma bolha de ícone a partir de um tom semântico (mesmo mapa do DS).
const toneColors = (tone) =>
  tone === 'accent'
    ? { bg: 'var(--accent-soft)', fg: 'var(--accent)' }
    : { bg: `var(--status-${tone}-bg)`, fg: `var(--status-${tone}-fg)` };

// Ícone + tom por família de evento de checkout (mais específico → mais genérico).
function eventVisual(tipo) {
  const t = (tipo || '').toLowerCase();
  if (t.includes('abandono')) return { icon: 'shopping-cart', tone: 'warning' };
  if (t.includes('pix')) return { icon: 'qr-code', tone: 'info' };
  if (t.includes('boleto')) return { icon: 'receipt', tone: 'info' };
  if (t.includes('cancel') || t.includes('recusad') || t.includes('chargeback') || t.includes('reembols') || t.includes('estorn'))
    return { icon: 'x-circle', tone: 'danger' };
  if (t.includes('compra') || t.includes('aprovad') || t.includes('venda')) return { icon: 'shopping-bag', tone: 'success' };
  return { icon: 'zap', tone: 'accent' };
}

function KoblyDashboard() {
  const store = useKobly();
  const isGestor = store.role === 'Gestor';
  const empresaId = store.session.empresaId;
  const clients = useAsync(() => (isGestor ? KoblyApi.listClients() : Promise.resolve([])), [store.role]);
  const [contaId, setContaId] = useState('');
  const targetOrg = isGestor ? (contaId || undefined) : (empresaId || undefined);
  const a = useAsync(() => KoblyApi.getDashboard(targetOrg), [store.role, targetOrg]);

  const d = a.data || { kpis: {}, funnel: {}, recent: [], topCampaigns: [] };
  const k = d.kpis || {};
  const loading = a.status === 'loading';
  // Maior recuperação do ranking → escala das mini-barras de proporção.
  const maxRec = Math.max(1, ...(d.topCampaigns || []).map((c) => Number(c.recuperadas) || 0));

  if (a.status === 'error') return <ErrorState message={a.error} onRetry={a.reload} />;

  return (
    <div style={{ position: 'relative', isolation: 'isolate', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Momento de design: brasa quente atrás da faixa de KPIs (carvão quente). */}
      <div
        aria-hidden="true"
        style={{ position: 'absolute', top: 0, insetInline: 0, height: 320, background: 'var(--grad-hero)', pointerEvents: 'none', zIndex: -1 }}
      />

      <PageIntro>
        Visão geral da sua recuperação de vendas — métricas reais, funil e as campanhas que mais convertem.
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

      {loading ? (
        <SkeletonDashboard />
      ) : (
        <>
          {/* KPIs reais — "Vendas recuperadas" é o número herói (destaque + brilho quente). */}
          <div className="kbly-grid-kpi" style={{ gap: 16 }}>
            <MetricCard
              variant="hero"
              icon="circle-check"
              label="Vendas recuperadas"
              value={intFmt(k.recuperados)}
              style={{ gridColumn: 'span 2' }}
            />
            <MetricCard icon="users-round" iconTone="info" label="Leads" value={intFmt(k.leads)} />
            <MetricCard icon="send" iconTone="accent" label="E-mails enviados" value={intFmt(k.enviados)} />
            <MetricCard icon="mail-open" iconTone="warning" label="Taxa de abertura" value={pctFmt(k.abertura || 0)} />
            <MetricCard icon="mouse-pointer-click" iconTone="info" label="CTR" value={pctFmt(k.ctr || 0)} />
            <MetricCard icon="megaphone" iconTone="accent" label="Campanhas ativas" value={intFmt(k.ativas)} />
          </div>

          {/* IA em destaque (AI-first) */}
          <AISuggestion title="Insight da IA" load={() => KoblyAI.suggestForDashboard('painel')} />

          {/* Funil + colunas */}
          <div className="kbly-grid-main" style={{ gap: 18 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)' }}>Funil de recuperação</div>
              <LeadFunnel data={d.funnel} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <Card title="Campanhas que mais recuperam" icon="trophy" pad={false}>
                {(d.topCampaigns || []).length === 0 ? (
                  <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Nenhuma campanha ainda.</div>
                ) : (
                  <div>
                    {d.topCampaigns.map((c, i) => {
                      const rec = Number(c.recuperadas) || 0;
                      const barPct = Math.max(4, (rec / maxRec) * 100);
                      const leader = i === 0;
                      return (
                        <div
                          key={c.id}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 12,
                            padding: '13px 20px',
                            borderBottom: i === d.topCampaigns.length - 1 ? 'none' : '1px solid var(--border-subtle)',
                          }}
                        >
                          <span
                            style={{
                              display: 'inline-flex',
                              flex: 'none',
                              width: 24,
                              height: 24,
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: 'var(--radius-sm)',
                              background: leader ? 'var(--accent-soft)' : 'var(--surface-sunken)',
                              color: leader ? 'var(--accent)' : 'var(--text-muted)',
                              fontSize: 'var(--text-xs)',
                              fontWeight: 'var(--fw-bold)',
                              marginTop: 1,
                            }}
                          >
                            {i + 1}º
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</span>
                              <span className="kbly-num" style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--fw-bold)', color: rec ? 'var(--status-success-fg)' : 'var(--text-muted)', flex: 'none' }}>
                                {intFmt(rec)}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginTop: 1 }}>
                              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{intFmt(c.enviados)} enviados · {pctFmt(c.taxaAbertura || 0)} abertura</span>
                              <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', flex: 'none' }}>recuperadas</span>
                            </div>
                            {/* mini-barra proporcional ao líder do ranking */}
                            <div style={{ height: 4, borderRadius: 'var(--radius-pill)', background: 'var(--surface-sunken)', overflow: 'hidden', marginTop: 8 }}>
                              <div style={{ height: '100%', width: `${barPct}%`, background: 'var(--grad-accent)', borderRadius: 'var(--radius-pill)', transition: 'width var(--dur-med, .4s) ease' }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              <Card title="Atividade recente" icon="activity" pad={false}>
                {(d.recent || []).length === 0 ? (
                  <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Nenhum evento recebido ainda.</div>
                ) : (
                  <div>
                    {d.recent.map((ev, i) => {
                      const v = eventVisual(ev.tipo_evento);
                      const c = toneColors(v.tone);
                      return (
                        <div
                          key={ev.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '11px 20px',
                            borderBottom: i === d.recent.length - 1 ? 'none' : '1px solid var(--border-subtle)',
                          }}
                        >
                          <span style={{ display: 'inline-flex', flex: 'none', width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', background: c.bg, color: c.fg }}>
                            <Icon name={v.icon} size={16} />
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.tipo_evento}</div>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.email}</div>
                          </div>
                          {ev.valor_produto != null ? (
                            <span className="kbly-num" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', flex: 'none' }}>{KoblyApi.money(ev.valor_produto)}</span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export { KoblyDashboard };
