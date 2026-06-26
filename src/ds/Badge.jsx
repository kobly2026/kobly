// Kobly Design System — Badge.
// Status pill. Pass `tone` directly, or `status` to auto-map a Kobly domain state
// via STATUS_TONE. `dot` adds a leading status dot.

const TONES = {
  success: { fg: 'var(--status-success-fg)', bg: 'var(--status-success-bg)' },
  warning: { fg: 'var(--status-warning-fg)', bg: 'var(--status-warning-bg)' },
  danger: { fg: 'var(--status-danger-fg)', bg: 'var(--status-danger-bg)' },
  info: { fg: 'var(--status-info-fg)', bg: 'var(--status-info-bg)' },
  neutral: { fg: 'var(--status-neutral-fg)', bg: 'var(--status-neutral-bg)' },
};

/** Maps Kobly domain states → tone, so badges stay consistent across the app. */
export const STATUS_TONE = {
  active: 'success',
  purchase_approved: 'success',
  completed: 'success',
  paused: 'warning',
  pix_generated: 'warning',
  processing: 'warning',
  queued: 'warning',
  dead_letter: 'danger',
  blocked: 'danger',
  error: 'danger',
  cart_abandoned: 'danger',
  sandbox: 'info',
  draft: 'neutral',
  archived: 'neutral',
  cancelled: 'neutral',
};

const SIZES = {
  sm: { padding: '2px 8px', fontSize: '11px' },
  md: { padding: '3px 10px', fontSize: 'var(--text-xs)' },
};

export function Badge({ children, tone, status, dot = false, size = 'md', style = {}, ...rest }) {
  const resolvedTone = tone || STATUS_TONE[status] || 'neutral';
  const t = TONES[resolvedTone] || TONES.neutral;
  const s = SIZES[size] || SIZES.md;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: 'var(--font-sans)',
        fontWeight: 'var(--fw-semibold)',
        fontSize: s.fontSize,
        lineHeight: 1.5,
        padding: s.padding,
        borderRadius: 'var(--radius-pill)',
        color: t.fg,
        background: t.bg,
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...rest}
    >
      {dot && (
        <span
          style={{ width: 6, height: 6, borderRadius: '50%', background: t.fg, flex: 'none' }}
        />
      )}
      {children}
    </span>
  );
}

export default Badge;
