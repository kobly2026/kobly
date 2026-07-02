// Kobly Design System — MetricCard.
// Dashboard KPI tile. `layout` = 'column' (default: label + icon on top, big value
// below) or 'row' (icon bubble left, value + label right — absorbs the Leads
// StatusCard). `variant` = 'default' or 'hero' (oversized value on a warm-glow
// surface — the dashboard's signature tile). `spark` (number[]) draws a Sparkline
// footer. Delta shows a trend arrow tinted by `deltaTone`. Values use tabular
// figures (.kbly-num) so digits don't dance on live updates.
import { Icon } from './Icon.jsx';
import { Sparkline } from '@/lib/charts.jsx';

const DELTA = {
  up: { color: 'var(--status-success-fg)', icon: 'trending-up' },
  down: { color: 'var(--status-danger-fg)', icon: 'trending-down' },
  neutral: { color: 'var(--text-muted)', icon: null },
};

// Icon-bubble tints — default is accent; `iconTone` maps to the status ramps so a
// row tile can carry semantic color (processed / sent / rejected / queued).
const ICON_TONES = {
  accent: { bg: 'var(--accent-soft)', fg: 'var(--accent)' },
  success: { bg: 'var(--status-success-bg)', fg: 'var(--status-success-fg)' },
  warning: { bg: 'var(--status-warning-bg)', fg: 'var(--status-warning-fg)' },
  danger: { bg: 'var(--status-danger-bg)', fg: 'var(--status-danger-fg)' },
  info: { bg: 'var(--status-info-bg)', fg: 'var(--status-info-fg)' },
  neutral: { bg: 'var(--status-neutral-bg)', fg: 'var(--status-neutral-fg)' },
};

function Eyebrow({ children }) {
  return (
    <span
      style={{
        fontSize: 'var(--text-2xs)',
        letterSpacing: 'var(--ls-eyebrow)',
        textTransform: 'uppercase',
        fontWeight: 'var(--fw-semibold)',
        color: 'var(--text-subtle)',
      }}
    >
      {children}
    </span>
  );
}

function Delta({ delta, tone }) {
  if (!delta) return null;
  const d = DELTA[tone] || DELTA.neutral;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: d.color }}>
      {d.icon && <Icon name={d.icon} size={15} />}
      {delta}
    </span>
  );
}

function IconBubble({ icon, tone, dim }) {
  const t = ICON_TONES[tone] || ICON_TONES.accent;
  return (
    <span
      style={{
        display: 'inline-flex',
        width: dim,
        height: dim,
        flex: 'none',
        borderRadius: 'var(--radius-sm)',
        background: t.bg,
        color: t.fg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={icon} size={dim >= 40 ? 19 : 17} />
    </span>
  );
}

export function MetricCard({
  label,
  value,
  icon = null,
  iconTone = 'accent',
  delta = null,
  deltaTone = 'neutral',
  accent = false,
  layout = 'column',
  variant = 'default',
  spark = null,
  style = {},
  ...rest
}) {
  const hero = variant === 'hero';
  const isRow = layout === 'row';
  const hasSpark = Array.isArray(spark) && spark.length > 1;

  const shell = {
    background: 'var(--surface-card)',
    border: `1px solid ${hero ? 'var(--border-accent)' : 'var(--border-subtle)'}`,
    borderRadius: 'var(--radius-md)',
    boxShadow: hero ? 'var(--glow-accent-soft)' : 'var(--shadow-sm)',
    padding: '18px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    position: 'relative',
    overflow: 'hidden',
    ...style,
  };

  const valueEl = (
    <span
      className="kbly-num"
      style={{
        fontSize: hero ? 'var(--text-4xl)' : isRow ? 'var(--text-2xl)' : 'var(--text-3xl)',
        fontWeight: hero ? 'var(--fw-extra)' : 'var(--fw-bold)',
        color: 'var(--text-strong)',
        letterSpacing: 'var(--ls-tight)',
        lineHeight: 1.05,
      }}
    >
      {value}
    </span>
  );

  return (
    <div style={shell} {...rest}>
      {/* Hero: brilho quente por cima do card (não intercepta cliques). */}
      {hero && <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'var(--grad-hero)', pointerEvents: 'none' }} />}
      {accent && !hero && (
        <span style={{ position: 'absolute', insetInlineStart: 0, top: 0, bottom: 0, width: 3, background: 'var(--accent)' }} />
      )}

      {isRow ? (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14 }}>
          {icon && <IconBubble icon={icon} tone={iconTone} dim={40} />}
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              {valueEl}
              <Delta delta={delta} tone={deltaTone} />
            </div>
            <Eyebrow>{label}</Eyebrow>
          </div>
        </div>
      ) : (
        <>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <Eyebrow>{label}</Eyebrow>
            {icon && <IconBubble icon={icon} tone={hero ? 'accent' : iconTone} dim={32} />}
          </div>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'baseline', gap: 8 }}>
            {valueEl}
            <Delta delta={delta} tone={deltaTone} />
          </div>
        </>
      )}

      {hasSpark && (
        <div style={{ position: 'relative', marginTop: 2 }}>
          <Sparkline data={spark} color={hero ? '#ff8128' : undefined} height={38} />
        </div>
      )}
    </div>
  );
}

export default MetricCard;
