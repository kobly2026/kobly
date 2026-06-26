// Kobly Design System — Checklist.
// Onboarding "Primeiros passos" checklist with a progress bar.
// `items`: [{ label, done }]. Computes progress from the done count.
import { Icon } from './Icon.jsx';

export function Checklist({ title = 'Primeiros passos', items = [], style = {}, ...rest }) {
  const total = items.length;
  const done = items.filter((i) => i.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-sm)',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        ...style,
      }}
      {...rest}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 'var(--fw-semibold)',
            color: 'var(--text-strong)',
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--fw-semibold)',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {done}/{total}
        </span>
      </div>

      <div
        style={{
          height: 6,
          borderRadius: 'var(--radius-pill)',
          background: 'var(--surface-sunken)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: 'var(--accent)',
            borderRadius: 'var(--radius-pill)',
            transition: 'width var(--dur-med) var(--ease-out)',
          }}
        />
      </div>

      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {items.map((it, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 20,
                height: 20,
                flex: 'none',
                borderRadius: '50%',
                border: it.done ? 'none' : '1.5px solid var(--border-default)',
                background: it.done ? 'var(--green-500)' : 'transparent',
                color: 'var(--ink-900)',
              }}
            >
              {it.done && <Icon name="check" size={13} />}
            </span>
            <span
              style={{
                fontSize: 'var(--text-md)',
                color: it.done ? 'var(--text-muted)' : 'var(--text-body)',
                textDecoration: it.done ? 'line-through' : 'none',
              }}
            >
              {it.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Checklist;
