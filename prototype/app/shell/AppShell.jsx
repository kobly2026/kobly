// Kobly — shell da aplicação. NavRail filtrado por papel (RBAC) + topbar + troca de rota
// com transição de entrada + outlet do toast. window.KoblyApp
(function () {
  const { NavRail } = window.KoblyDesignSystem_29b7f4;

  const SCREEN = {
    dashboard: 'KoblyDashboard', campanhas: 'KoblyCampaigns', leads: 'KoblyLeads',
    clientes: 'KoblyClients', integracoes: 'KoblyIntegrations', relatorios: 'KoblyReports',
    planos: 'KoblyPlans', chamados: 'KoblyTickets', suporte: 'KoblyHelp',
    seguranca: 'KoblySecurity', perfil: 'KoblyProfile',
  };

  function Shell() {
    const store = window.useKobly();
    const DB = window.KoblyMockDB;
    const Topbar = window.KoblyTopbar;
    const { Toast, Reveal } = window;

    const role = store.roleDef;
    const view = store.view;
    // Garante que a rota atual é permitida ao papel; senão cai na home.
    const allowed = role.nav.includes(view) ? view : role.home;
    const navItems = role.nav.map((id) => DB.NAV[id]);
    const Screen = window[SCREEN[allowed]];
    const title = DB.routeTitle[allowed] || '';
    const eyebrow = `${store.role} · ${store.session.contextLabel}`;

    return (
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--surface-app)' }}>
        <NavRail
          items={navItems}
          active={allowed}
          onNavigate={store.navigate}
          markSrc="assets/kobly-mark.svg"
          workspaceName={store.session.contextLabel}
          workspaceMeta={store.session.plano ? `Plano ${store.session.plano}` : store.roleDef.label}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Topbar eyebrow={eyebrow} title={title} />
          <main style={{ flex: 1, overflowY: 'auto', padding: 'var(--content-pad)' }}>
            <Reveal key={allowed + store.role} y={6} style={{ maxWidth: 'var(--content-max)', margin: '0 auto' }}>
              {Screen ? React.createElement(Screen) : null}
            </Reveal>
          </main>
        </div>
        {store.toast && (
          <Toast key={store.toast.key} tone={store.toast.tone} onClose={store.dismissToast}>
            {store.toast.msg}
          </Toast>
        )}
        {window.KoblyTweaksPanel && React.createElement(window.KoblyTweaksPanel)}
        {window.KoblyAIAssistant && React.createElement(window.KoblyAIAssistant)}
        {window.KoblyOnboarding && React.createElement(window.KoblyOnboarding)}
      </div>
    );
  }

  function App() {
    return React.createElement(window.KoblyStoreProvider, null, React.createElement(Shell));
  }
  window.KoblyApp = App;
})();
