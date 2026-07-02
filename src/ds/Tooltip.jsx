// Kobly Design System — Tooltip.
// Thin wrapper over the CSS-only tooltip (.kbly-tip + data-tip, defined in
// components.css). Reveals `tip` to the right of `children` on hover/focus.
// Used by the collapsed NavRail and icon-only affordances. Keep `tip` short.
export function Tooltip({ tip, children, style = {}, ...rest }) {
  if (!tip) return children;
  return (
    <span className="kbly-tip" data-tip={tip} style={{ display: 'inline-flex', ...style }} {...rest}>
      {children}
    </span>
  );
}

export default Tooltip;
