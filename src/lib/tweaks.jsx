import { useState, useEffect } from 'react';

// Kobly — store de tweaks reativo (pub/sub + localStorage). O painel de Tweaks escreve aqui;
// componentes leem via useKoblyTweak(key, default). KoblyTweaks
const LS = 'kobly.tweaks';
const DEFAULTS = {
  builderVariant: 'vertical', // vertical | horizontal | compact
  accent: '#FF6800',
  density: 'comfortable',     // comfortable | compact
  showOnboarding: true,
};
let state = (() => {
  try { return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(LS) || '{}')) }; } catch (e) { return { ...DEFAULTS }; }
})();
const subs = new Set();

function persist() { try { localStorage.setItem(LS, JSON.stringify(state)); } catch (e) {} }
function emit() { subs.forEach((fn) => fn(state)); }

const KoblyTweaks = {
  DEFAULTS,
  get(key) { return key ? state[key] : state; },
  set(patch) { state = { ...state, ...patch }; persist(); emit(); applyGlobals(); },
  reset() { state = { ...DEFAULTS }; persist(); emit(); applyGlobals(); },
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
};

// Aplica tweaks globais (cor de acento) no :root
function applyGlobals() {
  const root = document.documentElement;
  if (state.accent) {
    root.style.setProperty('--accent', state.accent);
    root.style.setProperty('--accent-hover', state.accent);
    root.style.setProperty('--accent-soft', state.accent + '24');
    root.style.setProperty('--primary-bg', state.accent);
    root.style.setProperty('--primary-bg-hover', state.accent);
  }
  root.style.setProperty('--content-pad', state.density === 'compact' ? '20px' : '32px');
}
applyGlobals();

function useKoblyTweak(key, dflt) {
  const [val, setVal] = useState(() => (state[key] !== undefined ? state[key] : dflt));
  useEffect(() => KoblyTweaks.subscribe((s) => setVal(s[key] !== undefined ? s[key] : dflt)), [key]);
  return val;
}

export { KoblyTweaks, useKoblyTweak };
