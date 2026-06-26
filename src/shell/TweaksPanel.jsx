import { TweakColor, TweakRadio, TweakSection, TweakToggle, TweaksPanel } from '@/lib/tweaks-panel.jsx';
import { KoblyTweaks, useKoblyTweak } from '@/lib/tweaks.jsx';

// Kobly — painel de Tweaks. Usa o shell TweaksPanel (protocolo do host) + controles do
// starter, escrevendo no store reativo KoblyTweaks. KoblyTweaksPanel
function KoblyTweaksPanel() {
  const t = {
    builderVariant: useKoblyTweak('builderVariant', 'vertical'),
    accent: useKoblyTweak('accent', '#FF6800'),
    density: useKoblyTweak('density', 'comfortable'),
    showOnboarding: useKoblyTweak('showOnboarding', true),
  };
  const set = (k, v) => KoblyTweaks.set({ [k]: v });

  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Construtor de fluxo" />
      <TweakRadio label="Layout" value={t.builderVariant}
        options={[{ value: 'vertical', label: 'Vertical' }, { value: 'horizontal', label: 'Horizontal' }, { value: 'compact', label: 'Compacto' }]}
        onChange={(v) => set('builderVariant', v)} />

      <TweakSection label="Aparência" />
      <TweakColor label="Cor de acento" value={t.accent}
        options={['#FF6800', '#2A6FDB', '#1F8A5B', '#7C5CFF']}
        onChange={(v) => set('accent', v)} />
      <TweakRadio label="Densidade" value={t.density}
        options={[{ value: 'comfortable', label: 'Conforto' }, { value: 'compact', label: 'Compacto' }]}
        onChange={(v) => set('density', v)} />

      <TweakSection label="Dashboard" />
      <TweakToggle label="Mostrar onboarding" value={t.showOnboarding} onChange={(v) => set('showOnboarding', v)} />
    </TweaksPanel>
  );
}
export { KoblyTweaksPanel };
