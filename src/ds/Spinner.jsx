// Kobly Design System — Spinner.
// Small circular activity indicator. Stroke inherits currentColor so it takes the
// color of whatever it sits in (e.g. a primary Button's label). Animation lives in
// global.css (@keyframes kbly-spin); reduced-motion freezes it to a static ring.
export function Spinner({ size = 16, strokeWidth = 2, label = 'Carregando', style = {}, ...rest }) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="status"
      aria-label={label}
      style={{ display: 'inline-block', flex: 'none', animation: 'kbly-spin 0.7s linear infinite', ...style }}
      {...rest}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * 0.7}
        opacity="0.9"
      />
    </svg>
  );
}

export default Spinner;
