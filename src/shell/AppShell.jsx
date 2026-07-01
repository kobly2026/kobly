// Kobly — application shell v2. Simplificado: NavRail + Topbar + rota ativa.
// Removidos: AIAssistant, Onboarding, TweaksPanel, telas não-core.
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

// Route id -> screen component (FlowBuilder / EmailEditor are sub-screens of Campanhas).
const SCREENS = {
  painel: KoblyDashboard,
  pipeline: KoblyPipeline,
  campanhas: KoblyCampaigns,
  leads: KoblyLeads,
  integracoes: KoblyIntegrations,
  perfil: KoblyProfile,
};

export function Shell() {
  const store = useKobly();
  const DB = KoblyMockDB;

  const role = store.roleDef;
  const view = store.view;
  // Ensure the current route is allowed for the role; otherwise fall back to home.
  const allowed = role.nav.includes(view) ? view : role.home;
  const navItems = role.nav.map((id) => DB.NAV[id]);
  const Screen = SCREENS[allowed];
  const title = DB.routeTitle[allowed] || '';
  const eyebrow = `${store.role} · ${store.session.contextLabel}`;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--surface-app)' }}>
      <NavRail
        items={navItems}
        active={allowed}
        onNavigate={store.navigate}
        markSrc="/assets/kobly-mark.svg"
        workspaceName={store.session.contextLabel}
        workspaceMeta={store.session.plano ? `Plano ${store.session.plano}` : store.roleDef.label}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <KoblyTopbar eyebrow={eyebrow} title={title} />
        <main style={{ flex: 1, overflowY: 'auto', padding: 'var(--content-pad)' }}>
          <Reveal key={allowed + store.role} y={6} style={{ maxWidth: 'var(--content-max)', margin: '0 auto' }}>
            {Screen ? <Screen /> : null}
          </Reveal>
        </main>
      </div>
      {store.toast && (
        <Toast key={store.toast.key} tone={store.toast.tone} onClose={store.dismissToast}>
          {store.toast.msg}
        </Toast>
      )}
    </div>
  );
}

export default Shell;
