// Kobly Design System — NavButton.
// Single nav item in the navy rail. Active = translucent orange wash + light text + left bar.
import { Icon } from './Icon.jsx';

export function NavButton({ icon, label, active = false, onClick, style = {}, ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="kbly-nav-btn"
      aria-current={active ? 'page' : undefined}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        textAlign: 'start',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-md)',
        fontWeight: active ? 'var(--fw-semibold)' : 'var(--fw-medium)',
        color: active ? '#fff' : 'var(--text-on-dark-muted)',
        background: active ? 'var(--surface-nav-active)' : 'transparent',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        padding: '10px 12px',
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
      <Icon name={icon} size={18} style={{ color: active ? 'var(--accent)' : 'currentColor' }} />
      <span>{label}</span>
    </button>
  );
}

export default NavButton;
