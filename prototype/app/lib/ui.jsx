// Kobly — UI primitives the design system doesn't ship: loading skeletons, drawn
// empty states, an animated toast, and a small segmented control.
// Built strictly on Kobly tokens. Exposes them on window.
(function () {
  const DS = window.KoblyDesignSystem_29b7f4;
  const { Icon, Button } = DS;

  // ---- Skeleton block (shimmer) ---------------------------------------------
  function Skeleton({ w = '100%', h = 14, r = 'var(--radius-sm)', style = {} }) {
    return (
      <div
        aria-hidden="true"
        style={{
          width: w, height: h, borderRadius: r, flex: 'none',
          background: 'linear-gradient(90deg, var(--ink-800) 25%, var(--ink-700) 37%, var(--ink-800) 63%)',
          backgroundSize: '200% 100%', animation: 'kbly-shimmer 1.4s ease-in-out infinite',
          ...style,
        }}
      />
    );
  }

  function SkeletonMetric() {
    return (
      <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Skeleton w={90} h={12} />
          <Skeleton w={32} h={32} r="var(--radius-sm)" />
        </div>
        <Skeleton w="55%" h={26} />
      </div>
    );
  }

  function SkeletonRow() {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
        <Skeleton w={34} h={34} r="var(--radius-sm)" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
          <Skeleton w="40%" h={12} />
          <Skeleton w="60%" h={10} />
        </div>
        <Skeleton w={86} h={20} r="var(--radius-pill)" />
      </div>
    );
  }

  // Full dashboard loading shape — mirrors the populated layout.
  function SkeletonDashboard() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 16 }}>
          {Array.from({ length: 5 }).map((_, i) => <SkeletonMetric key={i} />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, alignItems: 'start' }}>
          <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
              <Skeleton w={150} h={15} />
            </div>
            <div style={{ padding: '4px 20px 16px' }}>
              {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
            </div>
          </div>
          <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Skeleton w={130} h={15} />
            <Skeleton w="100%" h={6} r="var(--radius-pill)" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Skeleton w={20} h={20} r="50%" />
                <Skeleton w="65%" h={12} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---- Drawn empty state -----------------------------------------------------
  function EmptyState({ icon = 'inbox', title, message, action, tone = 'accent', compact = false }) {
    const ring = tone === 'danger' ? 'var(--status-danger-bg)' : 'var(--accent-soft)';
    const fg = tone === 'danger' ? 'var(--status-danger-fg)' : 'var(--accent)';
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', gap: 14, padding: compact ? '36px 24px' : '56px 32px',
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 56, height: 56, borderRadius: 'var(--radius-lg)', background: ring, color: fg,
        }}>
          <Icon name={icon} size={26} />
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 360 }}>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)' }}>{title}</div>
          {message && <div style={{ fontSize: 'var(--text-md)', color: 'var(--text-muted)', lineHeight: 'var(--lh-normal)' }}>{message}</div>}
        </div>
        {action}
      </div>
    );
  }

  // ---- Toast (animated, auto-dismissed by the store) -------------------------
  function Toast({ tone = 'success', children, onClose }) {
    const { StatusLine, IconButton } = DS;
    return (
      <div style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 60, animation: 'kbly-toast-in var(--dur-med) var(--ease-out) both' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, paddingRight: 6,
          background: 'var(--surface-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
        }}>
          <StatusLine tone={tone} style={{ background: 'transparent', paddingRight: 4 }}>{children}</StatusLine>
          <IconButton icon="x" size="sm" aria-label="Fechar" onClick={onClose} />
        </div>
      </div>
    );
  }

  // ---- Segmented control (state demo switcher) -------------------------------
  function Segmented({ value, onChange, options, label }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {label && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', fontWeight: 'var(--fw-semibold)', textTransform: 'uppercase', letterSpacing: 'var(--ls-eyebrow)' }}>{label}</span>}
        <div role="tablist" style={{ display: 'inline-flex', gap: 2, padding: 3, background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                role="tab"
                aria-selected={active}
                onClick={() => onChange(opt.value)}
                className="kbly-seg"
                style={{
                  border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)',
                  padding: '5px 12px', borderRadius: 'var(--radius-sm)',
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                  background: active ? 'var(--accent-soft)' : 'transparent',
                  transition: 'background var(--dur-fast), color var(--dur-fast)',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ---- Drawer lateral (drill-down, detalhe de lead, etc.) --------------------
  function Drawer({ open, onClose, title, subtitle, width = 460, children, footer }) {
    const { IconButton } = DS;
    if (!open) return null;
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', justifyContent: 'flex-end' }}>
        <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', animation: 'kbly-fade var(--dur-fast) ease both' }} />
        <aside style={{ position: 'relative', width, maxWidth: '94vw', height: '100%', background: 'var(--surface-card)', borderInlineStart: '1px solid var(--border-default)', boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', animation: 'kbly-slide-in var(--dur-med) var(--ease-out) both' }}>
          <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '18px 22px', borderBottom: '1px solid var(--border-subtle)', flex: 'none' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)', lineHeight: 1.2 }}>{title}</div>
              {subtitle && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>}
            </div>
            <IconButton icon="x" aria-label="Fechar" onClick={onClose} />
          </header>
          <div style={{ flex: 1, overflowY: 'auto', padding: 22 }}>{children}</div>
          {footer && <footer style={{ flex: 'none', padding: '14px 22px', borderTop: '1px solid var(--border-subtle)' }}>{footer}</footer>}
        </aside>
      </div>
    );
  }

  Object.assign(window, { Skeleton, SkeletonRow, SkeletonMetric, SkeletonDashboard, EmptyState, Toast, Segmented, Drawer });
})();
