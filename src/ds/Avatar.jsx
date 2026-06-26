// Kobly Design System — Avatar.
// Round avatar showing an initial (user/workspace), or an image when `src` is given.
// Navy tile + light glyph by default; `teal` / `slate` tones available.

const SIZES = { sm: 28, md: 36, lg: 44 };
const FONTS = { sm: 12, md: 14, lg: 17 };

const TONES = {
  navy: { background: 'var(--surface-raised)', color: 'var(--text-strong)' },
  teal: { background: 'var(--accent)', color: 'var(--text-on-accent)' },
  slate: { background: 'var(--ink-600)', color: 'var(--ink-100)' },
};

export function Avatar({ name = '', size = 'md', src = null, tone = 'navy', style = {}, ...rest }) {
  const dim = SIZES[size] || SIZES.md;
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  const t = TONES[tone] || TONES.navy;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: dim,
        height: dim,
        borderRadius: '50%',
        flex: 'none',
        overflow: 'hidden',
        fontFamily: 'var(--font-sans)',
        fontWeight: 'var(--fw-bold)',
        fontSize: FONTS[size] || 14,
        ...t,
        ...style,
      }}
      {...rest}
    >
      {src ? (
        <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        initial
      )}
    </span>
  );
}

export default Avatar;
