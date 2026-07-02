// Kobly — application shell: NavRail + Topbar + rota ativa (com ErrorBoundary por rota),
// SupportProvider (conversas + Realtime) e SupportWidget (FAB de suporte IA/humano).
import React from 'react';
import { NavRail } from '@/ds';
import { Toast } from '@/lib/ui.jsx';
import { Reveal } from '@/lib/motion.jsx';
import { useKobly } from '@/store/store.jsx';
import { KoblyMockDB } from '@/api/mockData.js';
import { KoblyTopbar } from '@/shell/Topbar.jsx';
import { KoblyDashboard } from '@/routes/Dashboard.jsx';
import { KoblyPipeline } from '@/routes/Pipeline.jsx';
import { KoblyCampaigns } from '@/routes/Campaigns.jsx';
import { KoblyLeads } from '@/routes/Leads.jsx';
import { KoblyIntegrations } from '@/routes/Integrations.jsx';
import { KoblyProfile } from '@/routes/Profile.jsx';
import { KoblyClients } from '@/routes/Clients.jsx';
import { KoblyReports } from '@/routes/Reports.jsx';
import { KoblyPlans } from '@/routes/Plans.jsx';
import { KoblySecurity } from '@/routes/Security.jsx';
import { KoblyTickets } from '@/routes/Tickets.jsx';
import { KoblyHelp } from '@/routes/Help.jsx';
import { ErrorBoundary } from '@/shell/ErrorBoundary.jsx';
import { SupportProvider, useSupport } from '@/shell/SupportProvider.jsx';
import { SupportWidget } from '@/shell/SupportWidget.jsx';

// Route id -> screen component (FlowBuilder / EmailEditor are sub-screens of Campanhas).
const SCREENS = {
  painel: KoblyDashboard,
  clientes: KoblyClients,
  pipeline: KoblyPipeline,
  campanhas: KoblyCampaigns,
  leads: KoblyLeads,
  integracoes: KoblyIntegrations,
  relatorios: KoblyReports,
  planos: KoblyPlans,
  seguranca: KoblySecurity,
  chamados: KoblyTickets,
  ajuda: KoblyHelp,
  perfil: KoblyProfile,
};

function ShellInner() {
  const store = useKobly();
  const support = useSupport();
  const DB = KoblyMockDB;

  const role = store.roleDef;
  const view = store.view;
  // Ensure the current route is allowed for the role; otherwise fall back to home.
  const allowed = role.nav.includes(view) ? view : role.home;
  // Badge de não-lidas no item "Chamados" (fonte: SupportProvider/Realtime).
  const navItems = role.nav.map((id) => (
    id === 'chamados' && support && support.unreadTotal > 0
      ? { ...DB.NAV[id], badge: support.unreadTotal }
      : DB.NAV[id]
  ));
  const Screen = SCREENS[allowed];
  const title = DB.routeTitle[allowed] || '';
  const eyebrow = `${store.role} · ${store.session.contextLabel}`;

  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: 'var(--surface-app)' }}>
      <NavRail
        items={navItems}
        active={allowed}
        onNavigate={store.navigate}
        markSrc="/assets/koblay-mark.svg"
        workspaceName={store.session.contextLabel}
        workspaceMeta={store.session.plano ? `Plano ${store.session.plano}` : store.roleDef.label}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <KoblyTopbar eyebrow={eyebrow} title={title} />
        <main style={{ flex: 1, overflowY: 'auto', padding: 'var(--content-pad)' }}>
          <Reveal key={allowed + store.role} y={6} style={{ maxWidth: 'var(--content-max)', margin: '0 auto' }}>
            {/* Boundary por rota: crash de tela não derruba nav/topbar; o key reseta ao navegar. */}
            <ErrorBoundary key={allowed} variant="screen" onHome={() => store.navigate(role.home)}>
              {Screen ? <Screen /> : null}
            </ErrorBoundary>
          </Reveal>
        </main>
      </div>
      <SupportWidget />
      {store.toast && (
        <Toast key={store.toast.key} tone={store.toast.tone} onClose={store.dismissToast}>
          {store.toast.msg}
        </Toast>
      )}
    </div>
  );
}

export function Shell() {
  return (
    <SupportProvider>
      <ShellInner />
    </SupportProvider>
  );
}

export default Shell;
