// Kobly Design System — Tabs.
// In-page tab navigation (tablist). Muted labels resolve to strong text when
// active; the animated underline lives in .kbly-tab (components.css). Options:
// [{ value, label, icon? }]. Controlled via `value` + `onChange`.
import { Icon } from './Icon.jsx';

export function Tabs({ value, onChange, options = [], style = {}, ...rest }) {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 4,
        borderBottom: '1px solid var(--border-subtle)',
        overflowX: 'auto',
        ...style,
      }}
      {...rest}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange && onChange(opt.value)}
            className="kbly-tab"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--fw-semibold)',
              padding: '10px 12px',
              whiteSpace: 'nowrap',
              color: active ? 'var(--text-strong)' : 'var(--text-muted)',
              transition: 'color var(--dur-fast)',
            }}
          >
            {opt.icon && <Icon name={opt.icon} size={16} style={{ color: active ? 'var(--accent)' : 'currentColor' }} />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
