// Kobly Design System — NavRail.
// The navy sidebar: brand header, primary nav, workspace footer. Width follows the
// --sidebar-width token (72px on tablet via the spacing.css media query). `collapsed`
// hides the wordmark + item labels (Tooltips take over) and reduces the footer to
// a centered avatar. `items`: [{ id, icon, label, badge? }]. `active` = current id.
import { NavButton } from './NavButton.jsx';
import { Avatar } from './Avatar.jsx';

export function NavRail({
  items = [],
  active,
  onNavigate,
  brand = 'KOBLY',
  markSrc = null,
  logoSrc = null,
  workspaceName = 'Agência Demo',
  workspaceMeta = 'Plano starter',
  collapsed = false,
  style = {},
  ...rest
}) {
  return (
    <nav
      style={{
        width: 'var(--sidebar-width)',
        flex: 'none',
        minHeight: '100%',
        background: 'var(--surface-nav)',
        display: 'flex',
        flexDirection: 'column',
        borderInlineEnd: '1px solid var(--border-nav)',
        ...style,
      }}
      {...rest}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 11,
          padding: collapsed ? '20px 0 18px' : '20px 18px 18px',
        }}
      >
        {/* Expandido usa o lockup (icone + wordmark KOBLY, letreiro oficial); colapsado
            cai no mark quadrado. Sem borderRadius aqui: o SVG traz o rx proprio
            (21.92/116.59 = 18.8%), e um raio CSS maior comeria o canto laranja. */}
        {!collapsed && logoSrc ? (
          <img src={logoSrc} alt={brand} style={{ display: 'block', height: 30, width: 'auto' }} />
        ) : markSrc ? (
          <img src={markSrc} alt={brand} width="34" height="34" style={{ display: 'block' }} />
        ) : (
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: 'var(--accent)',
              color: 'var(--text-on-accent)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'var(--fw-extra)',
              fontSize: 18,
            }}
          >
            K
          </span>
        )}
        {/* Wordmark em texto so' quando NAO ha lockup: o lockup ja traz o letreiro,
            e repetir renderizaria "KOBLY KOBLY". */}
        {!collapsed && !logoSrc && (
          <span style={{ color: '#fff', fontSize: 'var(--text-xl)', fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-tight)' }}>
            {brand}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: collapsed ? '6px 10px' : '6px 12px', flex: 1 }}>
        {items.map((it) => (
          <NavButton
            key={it.id}
            icon={it.icon}
            label={it.label}
            badge={it.badge || 0}
            active={active === it.id}
            collapsed={collapsed}
            onClick={() => onNavigate && onNavigate(it.id)}
          />
        ))}
      </div>

      {collapsed ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0', margin: 10, borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.05)' }}>
          <Avatar name={workspaceName} tone="teal" size="sm" />
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 16px',
            margin: 12,
            borderRadius: 'var(--radius-md)',
            background: 'rgba(255,255,255,0.05)',
          }}
        >
          <Avatar name={workspaceName} tone="teal" size="sm" />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                color: '#fff',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--fw-semibold)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {workspaceName}
            </div>
            <div style={{ color: 'var(--text-on-dark-muted)', fontSize: 'var(--text-xs)' }}>{workspaceMeta}</div>
          </div>
        </div>
      )}
    </nav>
  );
}

export default NavRail;
