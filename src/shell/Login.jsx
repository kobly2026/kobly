import React, { useState } from 'react';
import { Button } from '@/ds';
import { useKobly } from '@/store/store.jsx';

// Kobly — tela de autenticação (login / cadastro / recuperação / nova senha).

function traduz(msg) {
  const m = (msg || '').toLowerCase();
  if (m.includes('invalid login')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Já existe uma conta com esse e-mail.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas. Aguarde um momento e tente de novo.';
  if (m.includes('password') && m.includes('6')) return 'A senha deve ter ao menos 6 caracteres.';
  return msg || 'Algo deu errado. Tente novamente.';
}

const inputStyle = {
  width: '100%', background: 'var(--surface-sunken)', border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)', color: 'var(--text-strong)', fontFamily: 'var(--font-sans)',
  fontSize: 'var(--text-md)', padding: '11px 13px', outline: 'none',
};
function Field({ label, ...props }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--text-body)', marginBottom: 6 }}>{label}</span>
      <input style={inputStyle} {...props} />
    </label>
  );
}

export function KoblyAuthScreen({ mode = 'login' }) {
  const store = useKobly();
  const [form, setForm] = useState(mode === 'recovery' ? 'recovery' : 'login'); // login | signup | reset | recovery
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [nome, setNome] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  const clear = () => { setErr(''); setInfo(''); };
  const go = (f) => { clear(); setPassword(''); setPassword2(''); setForm(f); };

  async function doLogin(e) {
    e.preventDefault(); clear(); setBusy(true);
    const { error } = await store.signIn(email, password);
    setBusy(false);
    if (error) setErr(traduz(error)); // sucesso → o store troca pra fase 'app'
  }
  async function doSignup(e) {
    e.preventDefault(); clear();
    if (password.length < 6) return setErr('A senha deve ter ao menos 6 caracteres.');
    setBusy(true);
    const { error, needsConfirmation } = await store.signUp(email, password, nome);
    setBusy(false);
    if (error) return setErr(traduz(error));
    if (needsConfirmation) { go('login'); setInfo('Conta criada! Confirme seu e-mail para poder entrar.'); }
  }
  async function doReset(e) {
    e.preventDefault(); clear(); setBusy(true);
    const { error } = await store.resetPassword(email);
    setBusy(false);
    if (error) setErr(traduz(error));
    else setInfo('Se houver uma conta com esse e-mail, enviamos um link de redefinição.');
  }
  async function doRecovery(e) {
    e.preventDefault(); clear();
    if (password.length < 6) return setErr('A senha deve ter ao menos 6 caracteres.');
    if (password !== password2) return setErr('As senhas não conferem.');
    setBusy(true);
    const { error } = await store.updatePassword(password);
    setBusy(false);
    if (error) setErr(traduz(error));
    else store.notify('success', 'Senha atualizada! Você já está conectado.'); // sessão de recovery → store hidrata
  }

  const titles = {
    login: ['Entrar', 'Acesse o console da Kobly.'],
    signup: ['Criar conta', 'Comece a recuperar vendas por e-mail.'],
    reset: ['Recuperar senha', 'Enviaremos um link para redefinir sua senha.'],
    recovery: ['Definir nova senha', 'Escolha uma nova senha para sua conta.'],
  };
  const [title, subtitle] = titles[form] || titles.login;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-app)', padding: 24, fontFamily: 'var(--font-sans)' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22, justifyContent: 'center' }}>
          <img src="/assets/kobly-mark.svg" alt="Kobly" width={34} height={34} />
          <span style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)', letterSpacing: 'var(--ls-tight)' }}>Kobly</span>
        </div>

        <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', padding: 28 }}>
          <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)', letterSpacing: 'var(--ls-tight)' }}>{title}</h1>
          <p style={{ margin: '6px 0 20px', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{subtitle}</p>

          {info && <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--status-success-bg)', color: 'var(--status-success-fg)', fontSize: 'var(--text-sm)' }}>{info}</div>}
          {err && <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--status-danger-bg)', color: 'var(--status-danger-fg)', fontSize: 'var(--text-sm)' }}>{err}</div>}

          {form === 'login' && (
            <form onSubmit={doLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="E-mail" type="email" autoComplete="email" placeholder="voce@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Field label="Senha" type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -6 }}>
                <button type="button" onClick={() => go('reset')} style={linkBtn}>Esqueci minha senha</button>
              </div>
              <Button type="submit" variant="primary" disabled={busy || !email || !password} iconLeft="log-in" style={{ width: '100%', justifyContent: 'center' }}>{busy ? 'Entrando…' : 'Entrar'}</Button>
              <div style={{ textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                Não tem conta? <button type="button" onClick={() => go('signup')} style={linkBtn}>Criar conta</button>
              </div>
            </form>
          )}

          {form === 'signup' && (
            <form onSubmit={doSignup} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Nome" type="text" autoComplete="name" placeholder="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} />
              <Field label="E-mail" type="email" autoComplete="email" placeholder="voce@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Field label="Senha" type="password" autoComplete="new-password" placeholder="mín. 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} />
              <Button type="submit" variant="primary" disabled={busy || !email || !password} iconLeft="user-plus" style={{ width: '100%', justifyContent: 'center' }}>{busy ? 'Criando…' : 'Criar conta'}</Button>
              <div style={{ textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                Já tem conta? <button type="button" onClick={() => go('login')} style={linkBtn}>Entrar</button>
              </div>
            </form>
          )}

          {form === 'reset' && (
            <form onSubmit={doReset} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="E-mail" type="email" autoComplete="email" placeholder="voce@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Button type="submit" variant="primary" disabled={busy || !email} iconLeft="mail" style={{ width: '100%', justifyContent: 'center' }}>{busy ? 'Enviando…' : 'Enviar link'}</Button>
              <div style={{ textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                <button type="button" onClick={() => go('login')} style={linkBtn}>Voltar ao login</button>
              </div>
            </form>
          )}

          {form === 'recovery' && (
            <form onSubmit={doRecovery} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Nova senha" type="password" autoComplete="new-password" placeholder="mín. 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} />
              <Field label="Confirmar nova senha" type="password" autoComplete="new-password" placeholder="repita a senha" value={password2} onChange={(e) => setPassword2(e.target.value)} />
              <Button type="submit" variant="primary" disabled={busy || !password} iconLeft="check" style={{ width: '100%', justifyContent: 'center' }}>{busy ? 'Salvando…' : 'Salvar nova senha'}</Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

const linkBtn = {
  background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--accent)',
  fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)',
};
