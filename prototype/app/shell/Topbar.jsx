// Kobly — Topbar. Eyebrow + título da rota + slot de ações + SELETOR DE PAPEL (RBAC) + avatar.
// O seletor de papel troca nav/páginas/permissões ao vivo. window.KoblyTopbar
(function () {
  const { Avatar, Icon } = window.KoblyDesignSystem_29b7f4;
  const { useState, useRef, useEffect } = React;

  const ROLE_ICON = { Gestor: 'briefcase', Cliente: 'store', Suporte: 'headset', Administrador: 'shield' };

  function RoleSwitcher() {
    const store = window.useKobly();
    const DB = window.KoblyMockDB;
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
      function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
      document.addEventListener('mousedown', onDoc);
      return () => document.removeEventListener('mousedown', onDoc);
    }, []);
    const roleKeys = Object.keys(DB.roles);
    return (
      <div ref={ref} style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="kbly-roleswitch"
          style={{
            display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer',
            background: 'var(--surface-sunken)', border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)', padding: '6px 10px 6px 12px', fontFamily: 'var(--font-sans)',
            color: 'var(--text-strong)', transition: 'border-color var(--dur-fast)',
          }}
        >
          <span style={{ display: 'inline-flex', width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            <Icon name={ROLE_ICON[store.role]} size={14} />
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.1 }}>
            <span style={{ fontSize: '10px', letterSpacing: 'var(--ls-eyebrow)', textTransform: 'uppercase', color: 'var(--text-subtle)', fontWeight: 'var(--fw-semibold)' }}>Papel</span>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)' }}>{store.role}</span>
          </span>
          <Icon name="chevrons-up-down" size={15} style={{ color: 'var(--text-subtle)' }} />
        </button>
        {open && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', insetInlineEnd: 0, zIndex: 50, width: 268,
            background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)', padding: 6, animation: 'kbly-toast-in var(--dur-fast) var(--ease-out) both',
          }}>
            <div style={{ padding: '7px 10px 5px', fontSize: '10px', letterSpacing: 'var(--ls-eyebrow)', textTransform: 'uppercase', color: 'var(--text-subtle)', fontWeight: 'var(--fw-semibold)' }}>Trocar papel (RBAC)</div>
            {roleKeys.map((rk) => {
              const def = DB.roles[rk];
              const active = rk === store.role;
              return (
                <button
                  key={rk}
                  onClick={() => { store.setRole(rk); setOpen(false); }}
                  className="kbly-roleopt"
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', textAlign: 'start',
                    padding: '9px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', border: 'none',
                    background: active ? 'var(--accent-soft)' : 'transparent', fontFamily: 'var(--font-sans)',
                    transition: 'background var(--dur-fast)',
                  }}
                >
                  <span style={{ display: 'inline-flex', width: 28, height: 28, flex: 'none', alignItems: 'center', justifyContent: 'center', borderRadius: 7, background: active ? 'var(--accent)' : 'var(--surface-raised)', color: active ? 'var(--text-on-accent)' : 'var(--text-muted)' }}>
                    <Icon name={ROLE_ICON[rk]} size={15} />
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: active ? 'var(--accent)' : 'var(--text-strong)' }}>{def.label}</span>
                    <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 1, lineHeight: 1.35 }}>{def.descricao}</span>
                  </span>
                  {active && <Icon name="check" size={15} style={{ color: 'var(--accent)', marginInlineStart: 'auto', flex: 'none' }} />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function Topbar({ eyebrow, title, actions }) {
    const { Reveal } = window;
    const store = window.useKobly();
    return (
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        height: 'var(--topbar-height)', padding: '0 var(--content-pad)',
        borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-nav)', flex: 'none',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 'var(--text-2xs)', letterSpacing: 'var(--ls-eyebrow)', textTransform: 'uppercase', color: 'var(--text-subtle)', fontWeight: 'var(--fw-semibold)', whiteSpace: 'nowrap' }}>{eyebrow}</div>
          <Reveal key={title} y={4} style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)', letterSpacing: 'var(--ls-tight)', marginTop: 2 }}>{title}</Reveal>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 'none' }}>
          {actions}
          {actions && <span style={{ width: 1, height: 30, background: 'var(--border-subtle)' }}></span>}
          <RoleSwitcher />
          <Avatar name={store.session.name} />
        </div>
      </header>
    );
  }

  window.KoblyTopbar = Topbar;
})();
