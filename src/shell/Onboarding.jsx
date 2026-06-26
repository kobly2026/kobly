import { useState } from 'react';
import { Button, Icon } from '@/ds';
import { useKobly } from '@/store/store.jsx';

// Kobly — Onboarding / Curadoria. Overlay de boas-vindas: seleção de áreas de
// interesse (nichos). Chip laranja → selecionado fica verde. Persiste em localStorage
// e aparece uma vez por navegador. KoblyOnboarding
const LS = 'kobly.curadoria';

const NICHOS = [
  'UX Design', 'Web Design', 'Design Gráfico', 'Marketing Digital', 'Desenvolvimento Pessoal',
  'Imobiliária', 'Contabilidade', 'Advocacia', 'Odontologia', 'Consultoria Empresarial',
  'Arquitetura / Engenharia', 'Infoprodutos', 'Startups', 'Lançamentos', 'Afiliados',
];

function NichoChip({ label, on, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="kbly-nicho"
      aria-pressed={on}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer',
        fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)',
        padding: '13px 14px', borderRadius: 'var(--radius-md)', textAlign: 'center', lineHeight: 1.25,
        border: `1px solid ${on ? 'var(--status-success-fg)' : 'var(--accent)'}`,
        background: on ? 'var(--status-success-bg)' : 'var(--accent-soft)',
        color: on ? 'var(--status-success-fg)' : 'var(--accent)',
        transition: 'all var(--dur-fast)',
      }}
    >
      {on && <Icon name="check" size={15} />}
      {label}
    </button>
  );
}

function KoblyOnboarding() {
  const store = useKobly();
  const seen = (() => { try { return !!localStorage.getItem(LS); } catch (e) { return false; } })();
  const [open, setOpen] = useState(!seen);
  const [sel, setSel] = useState([]);

  function toggle(n) { setSel((s) => s.includes(n) ? s.filter((x) => x !== n) : [...s, n]); }
  function finish() {
    try { localStorage.setItem(LS, JSON.stringify(sel)); } catch (e) {}
    setOpen(false);
    store.notify && store.notify('success', sel.length ? `${sel.length} ${sel.length === 1 ? 'área selecionada' : 'áreas selecionadas'}` : 'Você pode escolher suas áreas depois');
  }

  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(0,0,0,0.72)', animation: 'kbly-fade var(--dur-med) ease both' }}>
      <div style={{
        width: 720, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto',
        background: 'var(--surface-card)', border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-pop)',
        padding: '32px 34px', animation: 'kbly-toast-in var(--dur-med) var(--ease-out) both',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <span style={{ display: 'inline-flex', width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 9, background: 'var(--accent)', color: 'var(--text-on-accent)', fontWeight: 800, fontSize: 18 }}>K</span>
          <span style={{ fontSize: 'var(--text-2xs)', letterSpacing: 'var(--ls-eyebrow)', textTransform: 'uppercase', color: 'var(--text-subtle)', fontWeight: 'var(--fw-semibold)' }}>Bem-vindo à Kobly</span>
        </div>
        <h2 style={{ margin: '0 0 4px', fontSize: 'var(--text-2xl)', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)', letterSpacing: 'var(--ls-tight)' }}>Escolha sua área</h2>
        <p style={{ margin: '0 0 22px', fontSize: 'var(--text-md)', color: 'var(--text-muted)' }}>Escolha pelo menos uma área e clique em finalizar. Usamos isso para personalizar templates e sugestões.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {NICHOS.map((n) => <NichoChip key={n} label={n} on={sel.includes(n)} onToggle={() => toggle(n)} />)}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 26 }}>
          <button onClick={finish} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)' }}>Pular por enquanto</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-subtle)' }}>{sel.length} selecionada{sel.length === 1 ? '' : 's'}</span>
            <Button variant="primary" iconLeft="check" onClick={finish} disabled={sel.length === 0}>Finalizar</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { KoblyOnboarding };
