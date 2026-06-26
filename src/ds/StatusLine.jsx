// Kobly Design System — StatusLine.
// Inline status message line — success / error / warning / info / loading.
import { Icon } from './Icon.jsx';

const TONES = {
  success: { fg: 'var(--status-success-fg)', bg: 'var(--status-success-bg)', icon: 'circle-check' },
  error: { fg: 'var(--status-danger-fg)', bg: 'var(--status-danger-bg)', icon: 'circle-alert' },
  warning: { fg: 'var(--status-warning-fg)', bg: 'var(--status-warning-bg)', icon: 'triangle-alert' },
  info: { fg: 'var(--status-info-fg)', bg: 'var(--status-info-bg)', icon: 'info' },
  loading: { fg: 'var(--text-muted)', bg: 'var(--surface-sunken)', icon: 'loader' },
};

export function StatusLine({ children, tone = 'info', icon, style = {}, ...rest }) {
  const t = TONES[tone] || TONES.info;

  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-sm)',
        fontWeight: 'var(--fw-medium)',
        color: t.fg,
        background: t.bg,
        padding: '9px 13px',
        borderRadius: 'var(--radius-md)',
        ...style,
      }}
      {...rest}
    >
      <Icon name={icon || t.icon} size={16} />
      <span>{children}</span>
    </div>
  );
}

export default StatusLine;
