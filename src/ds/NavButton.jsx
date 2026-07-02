// Kobly Design System — NavButton.
// Single nav item in the navy rail. Active = translucent orange wash + light text
// + left bar. `collapsed` centers the icon, hides the label (a Tooltip surfaces it),
// and shrinks the unread badge to a corner dot.
import { Icon } from './Icon.jsx';
import { Tooltip } from './Tooltip.jsx';

export function NavButton({ icon, label, badge = 0, active = false, collapsed = false, onClick, style = {}, ...rest }) {
  const btn = (
    <button
      type="button"
      onClick={onClick}
      className="kbly-nav-btn"
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? label : undefined}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: collapsed ? 0 : 12,
        width: '100%',
        textAlign: 'start',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-md)',
        fontWeight: active ? 'var(--fw-semibold)' : 'var(--fw-medium)',
        color: active ? '#fff' : 'var(--text-on-dark-muted)',
        background: active ? 'var(--surface-nav-active)' : 'transparent',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        padding: collapsed ? '11px 0' : '10px 12px',
        cursor: 'pointer',
        transition: 'background var(--dur-fast), color var(--dur-fast)',
        ...style,
      }}
      {...rest}
    >
      {active && (
        <span
          style={{
            position: 'absolute',
            insetInlineStart: 0,
            top: 8,
            bottom: 8,
            width: 3,
            borderRadius: 'var(--radius-pill)',
            background: 'var(--accent)',
          }}
        />
      )}
      <Icon name={icon} size={18} style={{ color: active ? 'var(--accent)' : 'currentColor', flex: 'none' }} />
      {!collapsed && (
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      )}

      {badge > 0 && collapsed && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 7,
            insetInlineEnd: 12,
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'var(--accent)',
            boxShadow: '0 0 0 2px var(--surface-nav)',
          }}
        />
      )}
      {badge > 0 && !collapsed && (
        <span
          aria-label={`${badge} não lida${badge === 1 ? '' : 's'}`}
          style={{
            flex: 'none',
            minWidth: 20,
            padding: '1px 6px',
            borderRadius: 'var(--radius-pill)',
            background: 'var(--accent)',
            color: 'var(--text-on-accent)',
            fontSize: 'var(--text-2xs)',
            fontWeight: 'var(--fw-bold)',
            textAlign: 'center',
            lineHeight: 1.6,
          }}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );

  return collapsed ? (
    <Tooltip tip={label} style={{ width: '100%' }}>
      {btn}
    </Tooltip>
  ) : (
    btn
  );
}

export default NavButton;
