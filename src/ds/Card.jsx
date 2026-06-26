// Kobly Design System — Card.
// Dark content panel — 1px subtle border, 8px radius, soft shadow.
// Optional `title`/`subtitle`/`action` header. `pad` toggles inner body padding.

export function Card({
  children,
  title,
  subtitle,
  action,
  pad = true,
  style = {},
  bodyStyle = {},
  ...rest
}) {
  const hasHeader = title || action;

  return (
    <section
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
          <div>
            {title && (
              <div
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-lg)',
                  fontWeight: 'var(--fw-semibold)',
                  color: 'var(--text-strong)',
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
          {action}
        </header>
      )}
      <div style={{ padding: pad ? '20px' : 0, ...bodyStyle }}>{children}</div>
    </section>
  );
}

export default Card;
