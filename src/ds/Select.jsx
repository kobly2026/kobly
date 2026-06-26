// Kobly Design System — Select.
// Native select styled to match Kobly inputs. `options`: [{ value, label }] or strings.
import { Icon } from './Icon.jsx';

export function Select({
  label,
  value,
  onChange,
  options = [],
  disabled = false,
  id,
  style = {},
  ...rest
}) {
  const selId = id || (label ? `kbly-sel-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      {label && (
        <label
          htmlFor={selId}
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
        <select
          id={selId}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className="kbly-input"
          style={{
            width: '100%',
            appearance: 'none',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-md)',
            color: 'var(--text-strong)',
            background: disabled ? 'var(--surface-sunken)' : 'var(--surface-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            padding: '9px 36px 9px 13px',
            minHeight: 40,
            outline: 'none',
            cursor: 'pointer',
          }}
          {...rest}
        >
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Icon
          name="chevron-down"
          size={16}
          style={{
            position: 'absolute',
            insetInlineEnd: 12,
            color: 'var(--text-subtle)',
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  );
}

export default Select;
