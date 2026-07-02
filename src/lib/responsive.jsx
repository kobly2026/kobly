import { useState, useEffect } from 'react';

// Kobly — responsive helper. Reports the active breakpoint bucket via matchMedia
// so the shell can adapt (collapse the rail on tablet, swap it for a drawer on
// mobile). Mirrors the usePrefersReducedMotion pattern in lib/motion.jsx: seeded
// from the current match, then kept in sync with a single listener per query.
// Canonical breakpoints (max-width): 1024 tablet · 860 narrow · 768 mobile.
const QUERIES = {
  isTablet: '(max-width: 1024px)',
  isNarrow: '(max-width: 860px)',
  isMobile: '(max-width: 768px)',
};

const canMatch = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function';

function readAll() {
  if (!canMatch()) return { isTablet: false, isNarrow: false, isMobile: false };
  return {
    isTablet: window.matchMedia(QUERIES.isTablet).matches,
    isNarrow: window.matchMedia(QUERIES.isNarrow).matches,
    isMobile: window.matchMedia(QUERIES.isMobile).matches,
  };
}

function useBreakpoint() {
  const [bp, setBp] = useState(readAll);

  useEffect(() => {
    if (!canMatch()) return undefined;
    const mqs = Object.entries(QUERIES).map(([, q]) => window.matchMedia(q));
    const onChange = () => setBp(readAll());
    mqs.forEach((mq) => (mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange)));
    onChange(); // reconcile in case a query flipped between initial render and effect
    return () => {
      mqs.forEach((mq) => (mq.removeEventListener ? mq.removeEventListener('change', onChange) : mq.removeListener(onChange)));
    };
  }, []);

  return bp;
}

export { useBreakpoint };
