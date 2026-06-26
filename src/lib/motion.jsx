import React, { useState, useEffect } from 'react';

// Kobly — motion helpers. Entrance motion is STATE-DRIVEN (a mount flag flips via a
// timer, then CSS transitions interpolate). The resting style is always fully visible,
// so content never gets stuck hidden when the animation clock is throttled (background
// tabs, screenshot capture, print/export). Respects prefers-reduced-motion.
// Exposes: usePrefersReducedMotion, Reveal, useEnter
const Q = '(prefers-reduced-motion: reduce)';

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia(Q).matches);
  useEffect(() => {
    const mq = window.matchMedia(Q);
    const onChange = () => setReduce(mq.matches);
    mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange);
    return () => { mq.removeEventListener ? mq.removeEventListener('change', onChange) : mq.removeListener(onChange); };
  }, []);
  return reduce;
}

// false on first paint, true shortly after mount (drives the enter transition).
function useEntered(delay = 0) {
  const reduce = usePrefersReducedMotion();
  const [on, setOn] = useState(reduce);
  useEffect(() => {
    if (reduce) { setOn(true); return; }
    const id = setTimeout(() => setOn(true), delay + 20);
    return () => clearTimeout(id);
  }, [reduce, delay]);
  return on;
}

function enterStyle(on, reduce, y) {
  if (reduce) return {};
  return {
    opacity: on ? 1 : 0,
    transform: on ? 'none' : `translateY(${y}px)`,
    transition: 'opacity var(--dur-med) var(--ease-out), transform var(--dur-med) var(--ease-out)',
  };
}

// Hook form — returns a style object. Use in components that own their element
// (e.g. a list <li>) where a wrapper isn't wanted.
function useEnter(delay = 0, y = 10) {
  const reduce = usePrefersReducedMotion();
  const on = useEntered(delay);
  return enterStyle(on, reduce, y);
}

// Component form — wraps children in an element that reveals on mount.
function Reveal({ children, delay = 0, y = 10, as = 'div', style = {}, ...rest }) {
  const s = useEnter(delay, y);
  return React.createElement(as, { style: { ...s, ...style }, ...rest }, children);
}

export { usePrefersReducedMotion, useEnter, Reveal };
