// Kobly Design System — IconButton.
// Square icon-only button. Variants match Button. Always pass aria-label.
import { Icon } from './Icon.jsx';

const SIZES = { sm: 30, md: 36, lg: 42 };
const ICON_SIZES = { sm: 15, md: 17, lg: 19 };

const VARIANTS = {
  ghost: { background: 'transparent', color: 'var(--text-muted)', border: '1px solid transparent' },
  secondary: { background: 'var(--surface-card)', color: 'var(--text-body)', border: '1px solid var(--border-default)' },
  primary: { background: 'var(--primary-bg)', color: 'var(--primary-fg)', border: '1px solid var(--primary-bg)' },
  danger: { background: 'transparent', color: 'var(--red-500)', border: '1px solid transparent' },
};

export function IconButton({
  icon,
  variant = 'ghost',
  size = 'md',
  disabled = false,
  onClick,
  'aria-label': ariaLabel,
  style = {},
  ...rest
}) {
  const dim = SIZES[size] || SIZES.md;
  const v = VARIANTS[variant] || VARIANTS.ghost;

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={`kbly-iconbtn kbly-iconbtn--${variant}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: dim,
        height: dim,
        borderRadius: 'var(--radius-md)',
        padding: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background var(--dur-fast) var(--ease-standard), color var(--dur-fast)',
        ...v,
        ...style,
      }}
      {...rest}
    >
      <Icon name={icon} size={ICON_SIZES[size] || 17} />
    </button>
  );
}

export default IconButton;
