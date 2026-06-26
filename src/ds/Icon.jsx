// Kobly Design System — Icon.
// Maps a kebab-case Lucide name (e.g. "layout-dashboard") to its lucide-react
// component. Stroke inherits currentColor so icons pick up orange/light/grey
// from context. Replaces the prototype's CDN-loaded Lucide global.
import * as Lucide from 'lucide-react';

const cache = new Map();
function resolve(name) {
  if (cache.has(name)) return cache.get(name);
  const pascal = String(name)
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
  const Cmp = Lucide[pascal] || null;
  cache.set(name, Cmp);
  return Cmp;
}

export function Icon({ name, size = 18, strokeWidth = 2, style, className, ...rest }) {
  const Cmp = resolve(name);
  if (!Cmp) {
    if (import.meta.env?.DEV) console.warn(`[Kobly Icon] unknown icon "${name}"`);
    return null;
  }
  return <Cmp size={size} strokeWidth={strokeWidth} style={style} className={className} {...rest} />;
}

export default Icon;
