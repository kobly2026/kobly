// Kobly Design System — MetricCard.
// Dashboard KPI tile — big value, label, optional delta and Lucide icon.
// Used for "Eventos aceitos", "Jobs na fila", "Dispatches enviados", "Budget restante".
import { Icon } from './Icon.jsx';

const DELTA_COLORS = {
  up: 'var(--status-success-fg)',
  down: 'var(--status-danger-fg)',
  neutral: 'var(--text-muted)',
};

export function MetricCard({
  label,
  value,
  icon = null,
  delta = null,
  deltaTone = 'neutral',
  accent = false,
  style = {},
  ...rest
}) {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-sm)',
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
      {...rest}
    >
      {accent && (
        <span
          style={{
            position: 'absolute',
            insetInlineStart: 0,
            top: 0,
            bottom: 0,
            width: 3,
            background: 'var(--accent)',
          }}
        />
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-muted)',
            fontWeight: 'var(--fw-medium)',
          }}
        >
          {label}
        </span>
        {icon && (
          <span
            style={{
              display: 'inline-flex',
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={icon} size={17} />
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span
          style={{
            fontSize: 'var(--text-3xl)',
            fontWeight: 'var(--fw-bold)',
            color: 'var(--text-strong)',
            letterSpacing: 'var(--ls-tight)',
            lineHeight: 1,
          }}
        >
          {value}
        </span>
        {delta && (
          <span
            style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--fw-semibold)',
              color: DELTA_COLORS[deltaTone] || DELTA_COLORS.neutral,
            }}
          >
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}

export default MetricCard;
