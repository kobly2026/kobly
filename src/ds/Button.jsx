// Kobly Design System — Button.
// Primary action button. Variants: primary (orange), secondary, ghost, danger.
// Sizes: sm | md | lg. Sentence-case labels (pt-BR), never ALL CAPS.
import { Icon } from './Icon.jsx';

const SIZES = {
  sm: { padding: '6px 12px', fontSize: 'var(--text-sm)', height: 32, gap: 6, icon: 15 },
  md: { padding: '9px 16px', fontSize: 'var(--text-md)', height: 40, gap: 8, icon: 17 },
  lg: { padding: '12px 22px', fontSize: 'var(--text-lg)', height: 48, gap: 9, icon: 19 },
};

const VARIANTS = {
  primary: { background: 'var(--primary-bg)', color: 'var(--primary-fg)', border: '1px solid var(--primary-bg)' },
  secondary: { background: 'var(--surface-card)', color: 'var(--text-strong)', border: '1px solid var(--border-default)' },
  ghost: { background: 'transparent', color: 'var(--text-body)', border: '1px solid transparent' },
  danger: { background: 'var(--red-500)', color: '#fff', border: '1px solid var(--red-500)' },
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  iconLeft = null,
  iconRight = null,
  fullWidth = false,
  type = 'button',
  onClick,
  style = {},
  ...rest
}) {
  const s = SIZES[size] || SIZES.md;
  const v = VARIANTS[variant] || VARIANTS.primary;

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`kbly-btn kbly-btn--${variant}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s.gap,
        fontFamily: 'var(--font-sans)',
        fontWeight: 'var(--fw-semibold)',
        fontSize: s.fontSize,
        lineHeight: 1,
        padding: s.padding,
        minHeight: s.height,
        width: fullWidth ? '100%' : 'auto',
        borderRadius: 'var(--radius-md)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition:
          'background var(--dur-fast) var(--ease-standard), border-color var(--dur-fast), box-shadow var(--dur-fast)',
        whiteSpace: 'nowrap',
        ...v,
        ...style,
      }}
      {...rest}
    >
      {iconLeft && <Icon name={iconLeft} size={s.icon} />}
      {children}
      {iconRight && <Icon name={iconRight} size={s.icon} />}
    </button>
  );
}

export default Button;
