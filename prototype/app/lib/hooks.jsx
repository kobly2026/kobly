// Kobly — hooks e primitivos de layout compartilhados pelas rotas.
// window.useAsync, window.PageIntro, window.Field, window.Money, window.Pct, window.Cluster
(function () {
  const { useState, useEffect, useCallback } = React;
  const DS = window.KoblyDesignSystem_29b7f4;

  // Carrega dados async com estados loading/error/ready. deps re-dispara.
  function useAsync(fn, deps) {
    const [state, setState] = useState({ status: 'loading', data: null, error: null });
    const run = useCallback(() => {
      let alive = true;
      setState((s) => ({ ...s, status: 'loading', error: null }));
      Promise.resolve(fn())
        .then((data) => { if (alive) setState({ status: 'ready', data, error: null }); })
        .catch((err) => { if (alive) setState({ status: 'error', data: null, error: err.message || 'Erro inesperado.' }); });
      return () => { alive = false; };
    }, deps || []);
    useEffect(run, deps || []);
    return { ...state, reload: run, setData: (d) => setState((s) => ({ ...s, data: typeof d === 'function' ? d(s.data) : d })) };
  }

  // Subtítulo introdutório da página (abaixo do topbar).
  function PageIntro({ children, action }) {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 22 }}>
        <p style={{ margin: 0, fontSize: 'var(--text-md)', color: 'var(--text-muted)', maxWidth: 720, lineHeight: 'var(--lh-normal)' }}>{children}</p>
        {action}
      </div>
    );
  }

  // Linha rótulo→valor para painéis de detalhe.
  function Field({ label, children, mono = false }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', fontWeight: 'var(--fw-semibold)' }}>{label}</span>
        <span style={{ fontSize: 'var(--text-md)', color: 'var(--text-strong)', fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)', wordBreak: 'break-word' }}>{children}</span>
      </div>
    );
  }

  function Cluster({ children, gap = 10, style = {} }) {
    return <div style={{ display: 'flex', alignItems: 'center', gap, flexWrap: 'wrap', ...style }}>{children}</div>;
  }

  Object.assign(window, { useAsync, PageIntro, Field, Cluster });
})();
