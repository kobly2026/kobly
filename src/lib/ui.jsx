import { useState, useEffect } from 'react';
import { Icon, IconButton, StatusLine } from '@/ds';

// Kobly — UI primitives the design system doesn't ship: loading skeletons, drawn
// empty states, an animated toast, and a small segmented control.
// Built strictly on Kobly tokens. Exposes them on window.

// ---- Skeleton block (shimmer) ---------------------------------------------
function Skeleton({ w = '100%', h = 14, r = 'var(--radius-sm)', style = {} }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: w, height: h, borderRadius: r, flex: 'none',
        background: 'linear-gradient(90deg, var(--ink-800) 25%, var(--ink-700) 37%, var(--ink-800) 63%)',
        backgroundSize: '200% 100%', animation: 'kbly-shimmer 1.4s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

function SkeletonMetric() {
  return (
    <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton w={90} h={12} />
        <Skeleton w={32} h={32} r="var(--radius-sm)" />
      </div>
      <Skeleton w="55%" h={26} />
    </div>
  );
}

function SkeletonRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <Skeleton w={34} h={34} r="var(--radius-sm)" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <Skeleton w="40%" h={12} />
        <Skeleton w="60%" h={10} />
      </div>
      <Skeleton w={86} h={20} r="var(--radius-pill)" />
    </div>
  );
}

// Full dashboard loading shape — mirrors the populated layout.
function SkeletonDashboard() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 16 }}>
        {Array.from({ length: 5 }).map((_, i) => <SkeletonMetric key={i} />)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, alignItems: 'start' }}>
        <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
            <Skeleton w={150} h={15} />
          </div>
          <div style={{ padding: '4px 20px 16px' }}>
            {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        </div>
        <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Skeleton w={130} h={15} />
          <Skeleton w="100%" h={6} r="var(--radius-pill)" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Skeleton w={20} h={20} r="50%" />
              <Skeleton w="65%" h={12} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Drawn empty state -----------------------------------------------------
function EmptyState({ icon = 'inbox', title, message, action, tone = 'accent', compact = false }) {
  const ring = tone === 'danger' ? 'var(--status-danger-bg)' : 'var(--accent-soft)';
  const fg = tone === 'danger' ? 'var(--status-danger-fg)' : 'var(--accent)';
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', gap: 14, padding: compact ? '36px 24px' : '56px 32px',
    }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 56, height: 56, borderRadius: 'var(--radius-lg)', background: ring, color: fg,
      }}>
        <Icon name={icon} size={26} />
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 360 }}>
        <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)' }}>{title}</div>
        {message && <div style={{ fontSize: 'var(--text-md)', color: 'var(--text-muted)', lineHeight: 'var(--lh-normal)' }}>{message}</div>}
      </div>
      {action}
    </div>
  );
}

// ---- Toast (animated, auto-dismissed by the store) -------------------------
function Toast({ tone = 'success', children, onClose }) {
  return (
    <div style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 60, animation: 'kbly-toast-in var(--dur-med) var(--ease-out) both' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, paddingRight: 6,
        background: 'var(--surface-card)', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
      }}>
        <StatusLine tone={tone} style={{ background: 'transparent', paddingRight: 4 }}>{children}</StatusLine>
        <IconButton icon="x" size="sm" aria-label="Fechar" onClick={onClose} />
      </div>
    </div>
  );
}

// ---- Segmented control (state demo switcher) -------------------------------
function Segmented({ value, onChange, options, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {label && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', fontWeight: 'var(--fw-semibold)', textTransform: 'uppercase', letterSpacing: 'var(--ls-eyebrow)' }}>{label}</span>}
      <div role="tablist" style={{ display: 'inline-flex', gap: 2, padding: 3, background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(opt.value)}
              className="kbly-seg"
              style={{
                border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)',
                padding: '5px 12px', borderRadius: 'var(--radius-sm)',
                color: active ? 'var(--accent)' : 'var(--text-muted)',
                background: active ? 'var(--accent-soft)' : 'transparent',
                transition: 'background var(--dur-fast), color var(--dur-fast)',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- Drawer lateral (drill-down, detalhe de lead, etc.) --------------------
function Drawer({ open, onClose, title, subtitle, width = 460, children, footer }) {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', animation: 'kbly-fade var(--dur-fast) ease both' }} />
      <aside style={{ position: 'relative', width, maxWidth: '94vw', height: '100%', background: 'var(--surface-card)', borderInlineStart: '1px solid var(--border-default)', boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', animation: 'kbly-slide-in var(--dur-med) var(--ease-out) both' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '18px 22px', borderBottom: '1px solid var(--border-subtle)', flex: 'none' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)', lineHeight: 1.2 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>}
          </div>
          <IconButton icon="x" aria-label="Fechar" onClick={onClose} />
        </header>
        <div style={{ flex: 1, overflowY: 'auto', padding: 22 }}>{children}</div>
        {footer && <footer style={{ flex: 'none', padding: '14px 22px', borderTop: '1px solid var(--border-subtle)' }}>{footer}</footer>}
      </aside>
    </div>
  );
}

// ---- Modal central (formulários de criação/edição) -----------------------
function Modal({ open, onClose, title, subtitle, width = 460, children, footer }) {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', animation: 'kbly-fade var(--dur-fast) ease both' }} />
      <div style={{ position: 'relative', width, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-pop)', padding: 24, animation: 'kbly-toast-in var(--dur-med) var(--ease-out) both' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 'var(--fw-bold)', color: 'var(--text-strong)' }}>{title}</h3>
            {subtitle && <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{subtitle}</p>}
          </div>
          <IconButton icon="x" aria-label="Fechar" onClick={onClose} />
        </div>
        {children}
        {footer && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>{footer}</div>}
      </div>
    </div>
  );
}

// ---- Card de sugestão da IA (DeepSeek) -------------------------------------
// `load` é uma função async que retorna a string da sugestão. Recarrega ao montar
// e no botão "gerar de novo". Mostra skeleton enquanto a IA pensa.
function AISuggestion({ title = 'Sugestão da IA', load }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(true);
  async function run() {
    if (!load) return;
    setBusy(true);
    try { const t = await load(); setText(t || 'Sem sugestão no momento.'); }
    catch (e) { setText('Não consegui gerar a sugestão agora.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { run(); }, []);
  return (
    <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'inline-flex', width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', background: 'var(--accent-soft)', color: 'var(--accent)', flex: 'none' }}><Icon name="sparkles" size={15} /></span>
        <span style={{ flex: 1, fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)' }}>{title}</span>
        <IconButton icon="refresh-cw" size="sm" aria-label="Gerar de novo" onClick={run} disabled={busy} />
      </div>
      {busy
        ? <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}><Skeleton w="100%" h={11} /><Skeleton w="78%" h={11} /></div>
        : <p style={{ margin: 0, fontSize: 'var(--text-sm)', lineHeight: 'var(--lh-normal)', color: 'var(--text-body)' }}>{text}</p>}
    </div>
  );
}

// ---- Campo de telefone: país (DDI) + máscara nacional ----------------------
// Dropdown de país (bandeira + DDI) e máscara enquanto digita — no Brasil,
// (98) 98814-8222. Emite via onChange o número COMPLETO só-dígitos com DDI
// (ex.: 5598988148222), pronto pro backend (que ainda resolve o formato
// canônico do WhatsApp via phone-exists).
const PHONE_COUNTRIES = [
  { code: 'BR', ddi: '55', flag: '🇧🇷', nome: 'Brasil', max: 11, placeholder: '(11) 99999-9999' },
  { code: 'PT', ddi: '351', flag: '🇵🇹', nome: 'Portugal', max: 9, placeholder: '912 345 678' },
  { code: 'US', ddi: '1', flag: '🇺🇸', nome: 'EUA/Canadá', max: 10, placeholder: '(555) 123-4567' },
  { code: 'AR', ddi: '54', flag: '🇦🇷', nome: 'Argentina', max: 11, placeholder: '11 2345-6789' },
  { code: 'MX', ddi: '52', flag: '🇲🇽', nome: 'México', max: 10, placeholder: '55 1234 5678' },
  { code: 'ES', ddi: '34', flag: '🇪🇸', nome: 'Espanha', max: 9, placeholder: '612 34 56 78' },
];

// Máscara BR progressiva: (dd → (dd) dddd → (dd) dddd-dddd → (dd) ddddd-dddd (celular).
function maskBRPhone(d) {
  d = d.slice(0, 11);
  if (!d) return '';
  if (d.length <= 2) return `(${d}`;
  const rest = d.slice(2);
  if (rest.length <= 4) return `(${d.slice(0, 2)}) ${rest}`;
  const cut = rest.length >= 9 ? 5 : 4; // 9 dígitos locais = celular com nono dígito
  return `(${d.slice(0, 2)}) ${rest.slice(0, cut)}-${rest.slice(cut)}`;
}

function PhoneField({ label = 'Telefone', value = '', onChange }) {
  // Deriva país + parte nacional do valor completo (DDI + nacional).
  const match = PHONE_COUNTRIES.find((c) => value && value.startsWith(c.ddi)) || PHONE_COUNTRIES[0];
  const [country, setCountry] = useState(match.code);
  const c = PHONE_COUNTRIES.find((x) => x.code === country) || PHONE_COUNTRIES[0];
  const national = value && value.startsWith(c.ddi) ? value.slice(c.ddi.length) : value;

  const emit = (ddi, nat) => onChange && onChange(nat ? `${ddi}${nat}` : '');
  function onCountry(e) {
    const next = PHONE_COUNTRIES.find((x) => x.code === e.target.value) || PHONE_COUNTRIES[0];
    setCountry(next.code);
    emit(next.ddi, national.slice(0, next.max));
  }
  function onDigits(e) {
    const nat = String(e.target.value).replace(/\D/g, '').slice(0, c.max);
    emit(c.ddi, nat);
  }

  const inputStyle = {
    fontFamily: 'var(--font-sans)', fontSize: 'var(--text-md)', color: 'var(--text-strong)',
    background: 'var(--surface-card)', border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)', minHeight: 40, outline: 'none', boxSizing: 'border-box',
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--text-body)' }}>{label}</span>}
      <div style={{ display: 'flex', gap: 8 }}>
        <select
          aria-label="País"
          value={country}
          onChange={onCountry}
          className="kbly-input"
          style={{ ...inputStyle, width: 108, flex: 'none', padding: '9px 8px', cursor: 'pointer', appearance: 'none' }}
        >
          {PHONE_COUNTRIES.map((x) => <option key={x.code} value={x.code}>{x.flag} +{x.ddi}</option>)}
        </select>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          className="kbly-input"
          placeholder={c.placeholder}
          value={c.code === 'BR' ? maskBRPhone(national) : national}
          onChange={onDigits}
          style={{ ...inputStyle, flex: 1, minWidth: 0, padding: '9px 13px' }}
        />
      </div>
    </div>
  );
}

export { Skeleton, SkeletonRow, SkeletonMetric, SkeletonDashboard, EmptyState, Toast, Segmented, Drawer, Modal, AISuggestion, PhoneField };
