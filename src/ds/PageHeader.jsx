// Kobly Design System — PageHeader.
// Standard top-of-route block: optional breadcrumb, an intro line, right-aligned
// actions, and an optional tabs slot beneath. Designed to replace lib/hooks'
// PageIntro({children, action}) — it accepts `action` (singular) as an alias for
// `actions`, so existing calls keep working during the migration.
import { Icon } from './Icon.jsx';

export function PageHeader({
  children,
  actions,
  action, // alias — PageIntro compatibility
  breadcrumb,
  tabs,
  style = {},
  ...rest
}) {
  const resolvedActions = actions ?? action ?? null;
  const hasIntro = children != null;
  const hasTop = hasIntro || resolvedActions;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 22, ...style }} {...rest}>
      {Array.isArray(breadcrumb) && breadcrumb.length > 0 && (
        <nav
          aria-label="Trilha"
          style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, fontSize: 'var(--text-2xs)', letterSpacing: 'var(--ls-eyebrow)', textTransform: 'uppercase', fontWeight: 'var(--fw-semibold)', color: 'var(--text-subtle)' }}
        >
          {breadcrumb.map((item, i) => {
            const last = i === breadcrumb.length - 1;
            const clickable = !last && typeof item.onClick === 'function';
            return (
              <span key={`${item.label}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {clickable ? (
                  <button
                    type="button"
                    onClick={item.onClick}
                    className="kbly-crumb"
                    style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', color: 'inherit' }}
                  >
                    {item.label}
                  </button>
                ) : (
                  <span aria-current={last ? 'page' : undefined} style={{ color: last ? 'var(--text-body)' : 'inherit' }}>
                    {item.label}
                  </span>
                )}
                {!last && <Icon name="chevron-right" size={12} style={{ color: 'var(--text-subtle)', opacity: 0.7 }} />}
              </span>
            );
          })}
        </nav>
      )}

      {hasTop && (
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          {hasIntro ? (
            <p style={{ margin: 0, fontSize: 'var(--text-md)', color: 'var(--text-muted)', maxWidth: 560, lineHeight: 'var(--lh-normal)' }}>
              {children}
            </p>
          ) : (
            <span />
          )}
          {resolvedActions && (
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, flex: 'none' }}>
              {resolvedActions}
            </div>
          )}
        </div>
      )}

      {tabs}
    </div>
  );
}

export default PageHeader;
