// Kobly Design System — Banner.
// Inline alert / notice. Sits in the content flow (not a toast). Tinted status
// surface, tone-colored icon + title, body in neutral body text, optional action
// on the right. Icon defaults per tone but can be overridden.
import { Icon } from './Icon.jsx';

const TONES = {
  info:    { icon: 'info',           fg: 'var(--status-info-fg)',    bg: 'var(--status-info-bg)' },
  success: { icon: 'check-circle-2', fg: 'var(--status-success-fg)', bg: 'var(--status-success-bg)' },
  warning: { icon: 'alert-triangle', fg: 'var(--status-warning-fg)', bg: 'var(--status-warning-bg)' },
  danger:  { icon: 'octagon-alert',  fg: 'var(--status-danger-fg)',  bg: 'var(--status-danger-bg)' },
};

export function Banner({ tone = 'info', icon, title, action, children, style = {}, ...rest }) {
  const t = TONES[tone] || TONES.info;
  const iconName = icon || t.icon;

  return (
    <div
      role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 'var(--radius-md)',
        background: t.bg,
        // Borda derivada da própria cor do tom (mistura leve com o card): lê sem
        // pesar. color-mix mantém uma única fonte de verdade por tom.
        border: `1px solid color-mix(in srgb, ${t.fg} 32%, transparent)`,
        ...style,
      }}
      {...rest}
    >
      <span style={{ color: t.fg, flex: 'none', display: 'inline-flex', marginTop: 1 }}>
        <Icon name={iconName} size={18} />
      </span>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: title && children ? 3 : 0 }}>
        {title && (
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: t.fg, lineHeight: 'var(--lh-snug)' }}>
            {title}
          </div>
        )}
        {children && (
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)', lineHeight: 'var(--lh-normal)' }}>
            {children}
          </div>
        )}
      </div>
      {action && <div style={{ flex: 'none', alignSelf: 'center' }}>{action}</div>}
    </div>
  );
}

export default Banner;
