// Kobly Design System — Card.
// Dark content panel — 1px subtle border, 8px radius, soft shadow.
// Header (optional): `eyebrow` (uppercase micro-label), `icon` (accent bubble),
// `title`, `subtitle`, `action`. `footer` renders a bordered slot at the bottom.
// `interactive` opts into the hover-lift affordance (.kbly-lift). `pad` toggles
// the inner body padding.
import { Icon } from './Icon.jsx';

export function Card({
  children,
  title,
  subtitle,
  eyebrow,
  icon = null,
  action,
  footer,
  interactive = false,
  pad = true,
  className = '',
  style = {},
  bodyStyle = {},
  ...rest
}) {
  const hasHeader = title || action || icon || eyebrow;
  const cls = `${interactive ? 'kbly-lift' : ''}${className ? ` ${className}` : ''}`.trim();

  return (
    <section
      className={cls || undefined}
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden',
        ...style,
      }}
      {...rest}
    >
      {hasHeader && (
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            {icon && (
              <span
                style={{
                  display: 'inline-flex',
                  width: 32,
                  height: 32,
                  flex: 'none',
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
            <div style={{ minWidth: 0 }}>
              {eyebrow && (
                <div
                  style={{
                    fontSize: 'var(--text-2xs)',
                    letterSpacing: 'var(--ls-eyebrow)',
                    textTransform: 'uppercase',
                    fontWeight: 'var(--fw-semibold)',
                    color: 'var(--text-subtle)',
                    marginBottom: 3,
                  }}
                >
                  {eyebrow}
                </div>
              )}
              {title && (
                <div
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 'var(--text-lg)',
                    fontWeight: 'var(--fw-semibold)',
                    color: 'var(--text-strong)',
                    lineHeight: 'var(--lh-snug)',
                  }}
                >
                  {title}
                </div>
              )}
              {subtitle && (
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: 2 }}>
                  {subtitle}
                </div>
              )}
            </div>
          </div>
          {action}
        </header>
      )}
      <div style={{ padding: pad ? '20px' : 0, ...bodyStyle }}>{children}</div>
      {footer && (
        <footer style={{ padding: '14px 20px', borderTop: '1px solid var(--border-subtle)' }}>
          {footer}
        </footer>
      )}
    </section>
  );
}

export default Card;
