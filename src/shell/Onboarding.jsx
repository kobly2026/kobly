import { useState } from 'react';
import { Button, Input, Select } from '@/ds';
import { useKobly } from '@/store/store.jsx';
import { SEGMENTOS } from '@/api/mockData.js';

// Kobly — Onboarding self-service. Mostrado pelo store quando um Cliente autenticado
// ainda não tem organização (cadastro novo): passo 1 cria a empresa (create_own_org),
// passo 2 (opcional) escolhe nichos de interesse (profiles.curadoria). KoblyOnboarding

const NICHOS = [
  'UX Design', 'Web Design', 'Design Gráfico', 'Marketing Digital', 'Desenvolvimento Pessoal',
  'Imobiliária', 'Contabilidade', 'Advocacia', 'Odontologia', 'Consultoria Empresarial',
  'Arquitetura / Engenharia', 'Infoprodutos', 'Startups', 'Lançamentos', 'Afiliados',
];

function Chip({ on, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      style={{
        cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
        fontWeight: 'var(--fw-semibold)', padding: '9px 14px', borderRadius: 'var(--radius-pill)',
        lineHeight: 1.25, transition: 'all var(--dur-fast)',
        border: `1px solid ${on ? 'var(--accent)' : 'var(--border-default)'}`,
        background: on ? 'var(--accent-soft)' : 'transparent',
        color: on ? 'var(--accent)' : 'var(--text-body)',
      }}
    >
      {children}
    </button>
  );
}

function KoblyOnboarding() {
  const store = useKobly();
  const [step, setStep] = useState(1);
  const [nome, setNome] = useState('');
  const [segmento, setSegmento] = useState('');
  const [nichos, setNichos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const toggleNicho = (n) => setNichos((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]));

  async function finish(withNichos) {
    setErr('');
    setBusy(true);
    const r = await store.completeOnboarding({
      nome: nome.trim(), segmento: segmento || null, nichos: withNichos ? nichos : [],
    });
    // Sucesso: o store re-hidrata e troca a fase para 'app' — este componente desmonta.
    if (r && r.error) {
      setBusy(false);
      setErr(r.error.includes('nome') ? 'Informe o nome da empresa.' : 'Não foi possível criar sua conta agora. Tente novamente.');
      setStep(1);
    }
  }

  const canNext = nome.trim().length >= 2;

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-app)', padding: 24, fontFamily: 'var(--font-sans)' }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22, justifyContent: 'center' }}>
          <img src="/assets/koblay-mark.svg" alt="Koblay" width={34} height={34} />
          <span style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)', letterSpacing: 'var(--ls-tight)' }}>Koblay</span>
        </div>

        <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', padding: 28 }}>
          <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-eyebrow)', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8 }}>
            Passo {step} de 2
          </div>

          {step === 1 && (
            <>
              <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)', letterSpacing: 'var(--ls-tight)' }}>Sobre sua empresa</h1>
              <p style={{ margin: '6px 0 20px', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                Bem-vindo{store.session && store.session.name ? `, ${store.session.name.split(' ')[0]}` : ''}! Conte pra gente onde você vai recuperar vendas.
              </p>
              {err && <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--status-danger-bg)', color: 'var(--status-danger-fg)', fontSize: 'var(--text-sm)' }}>{err}</div>}
              <form onSubmit={(e) => { e.preventDefault(); if (canNext) setStep(2); }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Input label="Nome da empresa / loja" placeholder="Ex.: Loja da Maria" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
                <Select label="Segmento" value={segmento} onChange={(e) => setSegmento(e.target.value)}
                  options={[{ value: '', label: 'Selecione (opcional)' }, ...SEGMENTOS.map((s) => ({ value: s, label: s }))]} />
                <Button type="submit" variant="primary" disabled={!canNext || busy} iconRight="arrow-right" style={{ width: '100%', justifyContent: 'center' }}>
                  Continuar
                </Button>
              </form>
            </>
          )}

          {step === 2 && (
            <>
              <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)', letterSpacing: 'var(--ls-tight)' }}>Áreas de interesse</h1>
              <p style={{ margin: '6px 0 20px', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                Opcional — nos ajuda a sugerir campanhas e conteúdos melhores para {nome.trim() || 'sua empresa'}.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {NICHOS.map((n) => <Chip key={n} on={nichos.includes(n)} onClick={() => toggleNicho(n)}>{n}</Chip>)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Button variant="primary" disabled={busy} iconLeft="check" style={{ width: '100%', justifyContent: 'center' }} onClick={() => finish(true)}>
                  {busy ? 'Criando sua conta…' : 'Concluir e entrar'}
                </Button>
                <Button variant="ghost" disabled={busy} style={{ width: '100%', justifyContent: 'center' }} onClick={() => finish(false)}>
                  Pular esta etapa
                </Button>
              </div>
            </>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button type="button" onClick={() => store.signOut()} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-subtle)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)' }}>
            Entrar com outra conta
          </button>
        </div>
      </div>
    </div>
  );
}

export { KoblyOnboarding };
