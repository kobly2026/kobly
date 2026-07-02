import { useEffect, useRef } from 'react';
import ApexCharts from 'apexcharts';

// Kobly — wrapper de gráficos sobre ApexCharts (carregado via CDN no HTML).
// Tema escuro alinhado aos tokens da marca. Expõe Chart e Sparkline.
// ApexCharts desenha SVG com as cores passadas em JS, então usamos hex reais
// (CSS vars não resolvem em atributos setados via script).

// Paleta resolvida (espelha tokens/colors.css — "Carvão Quente")
const C = {
  accent: '#ff6800', accent400: '#ff8128', green: '#3ddc84', amber: '#ffb020',
  red: '#ff6a61', textMuted: '#948e85', textSubtle: '#6b655d', textStrong: '#f7f4f0',
  grid: '#2b2824', card: '#171512', track: '#0b0a09',
};
export const KoblyChartColors = C;

// Base comum: fundo transparente, fonte da marca, tooltip escuro, sem toolbar.
function base(extra = {}) {
  return {
    chart: { fontFamily: 'var(--font-sans)', foreColor: C.textMuted, toolbar: { show: false }, zoom: { enabled: false }, animations: { enabled: true, speed: 420, easing: 'easeout' }, background: 'transparent', ...(extra.chart || {}) },
    grid: { borderColor: C.grid, strokeDashArray: 3, padding: { left: 8, right: 8 }, ...(extra.grid || {}) },
    tooltip: { theme: 'dark', style: { fontFamily: 'var(--font-sans)' }, ...(extra.tooltip || {}) },
    dataLabels: { enabled: false },
    legend: { labels: { colors: C.textMuted }, fontFamily: 'var(--font-sans)', markers: { radius: 3 }, ...(extra.legend || {}) },
    states: { hover: { filter: { type: 'lighten', value: 0.06 } } },
  };
}
export const KoblyChartBase = base;

// Componente genérico: cria/atualiza/destrói um ApexCharts.
function Chart({ type = 'area', series, options = {}, height = 280 }) {
  const ref = useRef(null);
  const inst = useRef(null);
  const opts = {
    ...base(options),
    ...options,
    chart: { ...base(options).chart, ...(options.chart || {}), type, height },
    series,
  };
  useEffect(() => {
    if (!ApexCharts || !ref.current) return;
    inst.current = new ApexCharts(ref.current, opts);
    inst.current.render();
    return () => { try { inst.current && inst.current.destroy(); } catch (e) {} };
  }, []);
  useEffect(() => {
    if (inst.current) { try { inst.current.updateOptions(opts, false, true); } catch (e) {} }
  }, [JSON.stringify(series), JSON.stringify(options), type, height]);
  return <div ref={ref} style={{ width: '100%' }} />;
}

// Sparkline minúsculo para KPI cards.
function Sparkline({ data = [], color = C.accent, height = 38 }) {
  const ref = useRef(null);
  const inst = useRef(null);
  const opts = {
    chart: { type: 'area', height, sparkline: { enabled: true }, animations: { enabled: false }, background: 'transparent' },
    stroke: { curve: 'smooth', width: 2 },
    fill: { type: 'gradient', gradient: { shadeIntensity: 0.4, opacityFrom: 0.35, opacityTo: 0, stops: [0, 100] } },
    colors: [color],
    tooltip: { enabled: false },
    series: [{ data }],
  };
  useEffect(() => {
    if (!ApexCharts || !ref.current) return;
    inst.current = new ApexCharts(ref.current, opts);
    inst.current.render();
    return () => { try { inst.current && inst.current.destroy(); } catch (e) {} };
  }, []);
  useEffect(() => {
    if (inst.current) { try { inst.current.updateSeries([{ data }], false); } catch (e) {} }
  }, [JSON.stringify(data), color]);
  return <div ref={ref} style={{ width: '100%' }} />;
}

export { Chart, Sparkline };
