import { useState } from 'react';
import { KoblyApi } from '@/api/mockApi.js';
import { Button, Card, Icon } from '@/ds';
import { PageIntro, useAsync } from '@/lib/hooks.jsx';
import { useKobly } from '@/store/store.jsx';

// Kobly — Central de ajuda (suporte). FAQ + acesso a vídeos + abrir chamado. KoblyHelp

function FaqItem({ item, open, onToggle }) {
  return (
    <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <button onClick={onToggle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%', textAlign: 'start', cursor: 'pointer', border: 'none', background: 'transparent', padding: '16px 4px', fontFamily: 'var(--font-sans)' }}>
        <span style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-strong)' }}>{item.q}</span>
        <Icon name={open ? 'minus' : 'plus'} size={18} style={{ color: 'var(--text-muted)', flex: 'none' }} />
      </button>
      {open && <p style={{ margin: '0 4px 16px', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 'var(--lh-normal)', maxWidth: 720 }}>{item.a}</p>}
    </div>
  );
}

function KoblyHelp() {
  const store = useKobly();
  const a = useAsync(() => KoblyApi.getHelp(), []);
  const [open, setOpen] = useState(0);
  if (a.status === 'loading') return <div style={{ color: 'var(--text-muted)' }}>Carregando…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageIntro>Perguntas frequentes, tutoriais e canais de atendimento. Não achou o que procurava? Abra um chamado.</PageIntro>
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, alignItems: 'start' }}>
        <Card title="Perguntas frequentes">
          <div>
            {a.data.faq.map((item, i) => <FaqItem key={i} item={item} open={open === i} onToggle={() => setOpen(open === i ? -1 : i)} />)}
          </div>
        </Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="Tutoriais em vídeo">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {['Primeiros passos no Koblay', 'Conectando seu checkout', 'Montando um fluxo de recuperação'].map((t) => (
                <button key={t} onClick={() => store.notify('info', 'Player de vídeo (demo)')} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'start', cursor: 'pointer', border: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)', padding: 12, fontFamily: 'var(--font-sans)' }}>
                  <span style={{ display: 'inline-flex', width: 36, height: 36, flex: 'none', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', background: 'var(--accent-soft)', color: 'var(--accent)' }}><Icon name="play" size={16} /></span>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-strong)', fontWeight: 'var(--fw-medium)' }}>{t}</span>
                </button>
              ))}
            </div>
          </Card>
          <Card title="Precisa de ajuda?">
            <p style={{ margin: '0 0 14px', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 'var(--lh-normal)' }}>Nossa equipe responde em até 1 dia útil pelos chamados.</p>
            <Button variant="primary" iconLeft="messages-square" fullWidth onClick={() => store.navigate('chamados')}>Abrir um chamado</Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
export { KoblyHelp };
