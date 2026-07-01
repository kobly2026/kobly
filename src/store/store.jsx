import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { KoblyMockDB } from '@/api/mockData.js';
import { KoblyApi } from '@/api/mockApi.js';
import { supabase } from '@/api/supabaseClient.js';
import { KoblyAuthScreen } from '@/shell/Login.jsx';

// Kobly — store global + AUTENTICAÇÃO REAL (Supabase Auth).
// Fases: loading → login → app (e recovery quando o usuário chega pelo link de
// redefinição de senha). A sessão é derivada do profile autenticado; a RLS faz o
// isolamento. O seletor de persona do topbar só aparece em DEV (atalho de demo);
// em produção, troca-se de conta via logout + login.
const Ctx = createContext(null);
const IS_DEV = !!import.meta.env.DEV;

function LoadingScreen({ label }) {
  return React.createElement(
    'div',
    { style: { height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, background: 'var(--surface-app)', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' } },
    React.createElement('img', { src: '/assets/koblay-mark.svg', alt: 'Koblay', width: 42, height: 42, style: { opacity: 0.92 } }),
    React.createElement('div', { style: { fontSize: 'var(--text-sm)', letterSpacing: 'var(--ls-tight)' } }, label || 'Carregando…'),
  );
}

function KoblyStoreProvider({ children }) {
  const DB = KoblyMockDB;
  const [phase, setPhase] = useState('loading'); // loading | login | recovery | app
  const [role, setRoleState] = useState(null);
  const [session, setSession] = useState(null);
  const [view, setView] = useState(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const fireToast = useCallback((tone, msg) => {
    clearTimeout(toastTimer.current);
    setToast({ tone, msg, key: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 3600);
  }, []);

  const hydrate = useCallback(async () => {
    const s = await KoblyApi.loadAppSession();
    if (s) {
      setSession(s);
      setRoleState(s.role);
      setView(((DB.roles[s.role] || DB.roles.Cliente)).home);
      setPhase('app');
    } else {
      setPhase('login');
    }
  }, [DB]);

  useEffect(() => {
    // onAuthStateChange dispara INITIAL_SESSION na montagem (sessão restaurada ou null),
    // além de SIGNED_IN / SIGNED_OUT / PASSWORD_RECOVERY / TOKEN_REFRESHED.
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      if (event === 'PASSWORD_RECOVERY') { setPhase('recovery'); return; }
      if (event === 'SIGNED_OUT' || !sess) {
        setSession(null); setRoleState(null); setView(null); setPhase('login'); setAuthBusy(false);
        return;
      }
      hydrate().finally(() => setAuthBusy(false));
    });
    return () => { try { sub.subscription.unsubscribe(); } catch (e) { /* noop */ } };
  }, [hydrate]);

  const navigate = useCallback((v) => setView(v), []);

  // Troca de papel = atalho de demo (login na persona). Só exposto em DEV.
  const setRole = useCallback((rk) => {
    if (!IS_DEV || !DB.roles[rk]) return;
    setAuthBusy(true);
    KoblyApi.signInAsRole(rk).then((r) => {
      if (r && r.error) { setAuthBusy(false); fireToast('danger', 'Não foi possível entrar como ' + rk); }
    });
  }, [DB, fireToast]);

  const value = {
    phase, isDev: IS_DEV, authBusy,
    role, roleDef: role ? DB.roles[role] : null, can: role ? DB.roles[role].can : {},
    setRole, view, navigate, session,
    // ações de autenticação (usadas pela tela de login e pelo perfil/topbar)
    signIn: (email, pw) => KoblyApi.signIn(email, pw),
    signInAsRole: (rk) => KoblyApi.signInAsRole(rk),
    signUp: (email, pw, nome) => KoblyApi.signUp(email, pw, nome),
    resetPassword: (email) => KoblyApi.resetPassword(email),
    updatePassword: (pw) => KoblyApi.updatePassword(pw),
    signOut: () => KoblyApi.signOut(),
    toast, notify: fireToast, dismissToast: () => setToast(null),
  };

  let content;
  if (phase === 'loading') content = React.createElement(LoadingScreen, { label: 'Carregando…' });
  else if (phase === 'login') content = React.createElement(KoblyAuthScreen, { mode: 'login' });
  else if (phase === 'recovery') content = React.createElement(KoblyAuthScreen, { mode: 'recovery' });
  else content = children;

  return React.createElement(Ctx.Provider, { value }, content);
}

function useKobly() { return useContext(Ctx); }
export { KoblyStoreProvider, useKobly };
