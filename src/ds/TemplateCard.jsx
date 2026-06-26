// Kobly Design System — TemplateCard.
// Campaign-template chooser tile (the "Nova campanha" grid). Icon, title, description.
// `disabled` dims it (no write permission). `selected` shows the orange active ring.
import { Icon } from './Icon.jsx';

export function TemplateCard({
  icon = 'sparkles',
  title,
  description,
  selected = false,
  disabled = false,
  onClick,
  style = {},
  ...rest
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className="kbly-template"
      style={{
        textAlign: 'start',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        width: '100%',
        background: 'var(--surface-card)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        border: `1px solid ${selected ? 'var(--accent)' : 'var(--border-subtle)'}`,
        boxShadow: selected ? '0 0 0 3px var(--accent-soft)' : 'var(--shadow-xs)',
        borderRadius: 'var(--radius-md)',
        padding: 16,
        opacity: disabled ? 0.55 : 1,
        transition:
          'border-color var(--dur-fast), box-shadow var(--dur-fast), transform var(--dur-fast)',
        ...style,
      }}
      {...rest}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 38,
          height: 38,
          borderRadius: 'var(--radius-sm)',
          background: 'var(--surface-raised)',
          color: 'var(--accent)',
        }}
      >
        <Icon name={icon} size={19} />
      </span>
      <span
        style={{
          fontSize: 'var(--text-md)',
          fontWeight: 'var(--fw-semibold)',
          color: 'var(--text-strong)',
        }}
      >
        {title}
      </span>
      {description && (
        <span
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-muted)',
            lineHeight: 'var(--lh-snug)',
          }}
        >
          {description}
        </span>
      )}
    </button>
  );
}

export default TemplateCard;
