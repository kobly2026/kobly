// Kobly Design System — Input.
// Text input with label, optional leading Lucide icon, error and hint states.
import { Icon } from './Icon.jsx';

export function Input({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  icon = null,
  error = null,
  hint = null,
  disabled = false,
  id,
  style = {},
  ...rest
}) {
  const inputId = id || (label ? `kbly-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--fw-medium)',
            color: 'var(--text-body)',
          }}
        >
          {label}
        </label>
      )}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {icon && (
          <Icon
            name={icon}
            size={16}
            style={{ position: 'absolute', insetInlineStart: 12, color: 'var(--text-subtle)' }}
          />
        )}
        <input
          id={inputId}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          className="kbly-input"
          style={{
            width: '100%',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-md)',
            color: 'var(--text-strong)',
            background: disabled ? 'var(--surface-sunken)' : 'var(--surface-card)',
            border: `1px solid ${error ? 'var(--red-500)' : 'var(--border-default)'}`,
            borderRadius: 'var(--radius-md)',
            padding: icon ? '9px 13px 9px 36px' : '9px 13px',
            minHeight: 40,
            outline: 'none',
            transition: 'border-color var(--dur-fast), box-shadow var(--dur-fast)',
          }}
          {...rest}
        />
      </div>
      {error && (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--status-danger-fg)' }}>{error}</span>
      )}
      {!error && hint && (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{hint}</span>
      )}
    </div>
  );
}

export default Input;
