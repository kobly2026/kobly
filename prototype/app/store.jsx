// Kobly — store global. Mantém papel ativo (RBAC), sessão derivada, conta em foco
// (Gestor), toast e helpers. Persiste o papel em localStorage.
// Expõe window.KoblyStoreProvider e window.useKobly.
(function () {
  const { createContext, useContext, useState, useCallback, useRef, useMemo } = React;
  const Ctx = createContext(null);
  const LS_ROLE = 'kobly.role';

  function KoblyStoreProvider({ children }) {
    const DB = window.KoblyMockDB;
    const initialRole = (() => {
      try { const r = localStorage.getItem(LS_ROLE); return DB.roles[r] ? r : 'Cliente'; } catch (e) { return 'Cliente'; }
    })();

    const [role, setRoleState] = useState(initialRole);
    const [view, setView] = useState(() => DB.roles[initialRole].home);
    const [toast, setToast] = useState(null);
    const toastTimer = useRef(null);

    const session = useMemo(() => window.KoblyApi.getSession(role), [role]);

    const fireToast = useCallback((tone, msg) => {
      clearTimeout(toastTimer.current);
      setToast({ tone, msg, key: Date.now() });
      toastTimer.current = setTimeout(() => setToast(null), 3600);
    }, []);

    const setRole = useCallback((r) => {
      if (!DB.roles[r]) return;
      setRoleState(r);
      setView(DB.roles[r].home);
      try { localStorage.setItem(LS_ROLE, r); } catch (e) {}
    }, [DB]);

    const navigate = useCallback((v) => setView(v), []);

    const value = {
      role, roleDef: DB.roles[role], setRole,
      view, navigate,
      session,
      can: DB.roles[role].can,
      toast, notify: fireToast, dismissToast: () => setToast(null),
    };
    return React.createElement(Ctx.Provider, { value }, children);
  }

  function useKobly() { return useContext(Ctx); }
  Object.assign(window, { KoblyStoreProvider, useKobly });
})();
