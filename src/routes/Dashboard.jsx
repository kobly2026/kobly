import { useState } from 'react';
import { KoblyApi } from '@/api/mockApi.js';
import { KoblyAI } from '@/api/ai.js';
import { KoblyMockDB } from '@/api/mockData.js';
import { Badge, Icon, Select } from '@/ds';
import { PageIntro, useAsync } from '@/lib/hooks.jsx';
import { AISuggestion, ErrorState } from '@/lib/ui.jsx';
import { LeadFunnel } from '@/routes/Funnel.jsx';
import { useKobly } from '@/store/store.jsx';

// Kobly — Dashboard completo. KPIs reais + insight de IA + funil + atividade + top campanhas.

const pctFmt = (n) => (n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
const intFmt = (n) => Number(n || 0).toLocaleString('pt-BR');

function Kpi({ icon, label, value, tone = 'info' }) {
  const fg = tone === 'accent' ? 'var(--accent)' : `var(--status-${tone}-fg)`;
  const bg = tone === 'accent' ? 'var(--accent-soft)' : `var(--status-${tone}-bg)`;
  return (
    <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      <span style={{ display: 'inline-flex', width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', background: bg, color: fg }}>
        <Icon name={icon} size={17} />
      </span>
      <div>
        <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)', lineHeight: 1.05 }}>{value}</div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

function Panel({ title, children, pad = 18 }) {
  return (
    <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)' }}>{title}</span>
      </div>
      <div style={{ padding: pad }}>{children}</div>
    </div>
  );
}

function KoblyDashboard() {
  const store = useKobly();
  const isGestor = store.role === 'Gestor';
  const empresaId = store.session.empresaId;
  const clients = useAsync(() => (isGestor ? KoblyApi.listClients() : Promise.resolve([])), [store.role]);
  const [contaId, setContaId] = useState('');
  const targetOrg = isGestor ? (contaId || undefined) : (empresaId || undefined);
  const a = useAsync(() => KoblyApi.getDashboard(targetOrg), [store.role, targetOrg]);
  const DB = KoblyMockDB;

  const d = a.data || { kpis: {}, funnel: {}, recent: [], topCampaigns: [] };
  const k = d.kpis || {};

  if (a.status === 'error') return <ErrorState message={a.error} onRetry={a.reload} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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

      {/* KPIs reais */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
        <Kpi icon="users-round" label="Leads" tone="info" value={intFmt(k.leads)} />
        <Kpi icon="send" label="E-mails enviados" tone="accent" value={intFmt(k.enviados)} />
        <Kpi icon="mail-open" label="Taxa de abertura" tone="warning" value={pctFmt(k.abertura || 0)} />
        <Kpi icon="mouse-pointer-click" label="CTR" tone="info" value={pctFmt(k.ctr || 0)} />
        <Kpi icon="circle-check" label="Vendas recuperadas" tone="success" value={intFmt(k.recuperados)} />
        <Kpi icon="megaphone" label="Campanhas ativas" tone="info" value={intFmt(k.ativas)} />
      </div>

      {/* IA em destaque (AI-first) */}
      <AISuggestion title="Insight da IA" load={() => KoblyAI.suggestForDashboard('painel')} />

      {/* Funil + colunas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)' }}>Funil de recuperação</div>
          {a.status === 'loading' ? <div style={{ color: 'var(--text-muted)', padding: 20 }}>Carregando…</div> : <LeadFunnel data={d.funnel} />}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Panel title="Campanhas que mais recuperam" pad={0}>
            {(d.topCampaigns || []).length === 0 ? (
              <div style={{ padding: 18, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Nenhuma campanha ainda.</div>
            ) : (
              <div>
                {d.topCampaigns.map((c) => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{intFmt(c.enviados)} enviados · {pctFmt(c.taxaAbertura || 0)} abertura</div>
                    </div>
                    <div style={{ textAlign: 'end', flex: 'none' }}>
                      <div style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--fw-bold)', color: c.recuperadas ? 'var(--status-success-fg)' : 'var(--text-muted)' }}>{intFmt(c.recuperadas)}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)' }}>recuperadas</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Atividade recente" pad={0}>
            {(d.recent || []).length === 0 ? (
              <div style={{ padding: 18, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Nenhum evento recebido ainda.</div>
            ) : (
              <div>
                {d.recent.map((ev) => (
                  <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <Badge tone={DB.eventTone[ev.tipo_evento] || 'neutral'} dot>{ev.tipo_evento}</Badge>
                    <div style={{ flex: 1, minWidth: 0, fontSize: 'var(--text-sm)', color: 'var(--text-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.email}</div>
                    {ev.valor_produto ? <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', flex: 'none' }}>{KoblyApi.money(ev.valor_produto)}</span> : null}
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

export { KoblyDashboard };
