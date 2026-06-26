// Kobly — wrapper de gráficos sobre ApexCharts (carregado via CDN no HTML).
// Tema escuro alinhado aos tokens da marca. Expõe window.Chart e window.Sparkline.
// ApexCharts desenha SVG com as cores passadas em JS, então usamos hex reais
// (CSS vars não resolvem em atributos setados via script).
(function () {
  const { useRef, useEffect } = React;

  // Paleta resolvida (espelha tokens/colors.css)
  const C = {
    accent: '#ff6800', accent400: '#ff8128', green: '#3ddc84', amber: '#ffb020',
    red: '#ff6a61', textMuted: '#808080', textSubtle: '#6b6b6b', textStrong: '#f9f9f9',
    grid: '#242424', card: '#1a1a1a', track: '#0d0d0d',
  };
  window.KoblyChartColors = C;

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
  window.KoblyChartBase = base;

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
      if (!window.ApexCharts || !ref.current) return;
      inst.current = new window.ApexCharts(ref.current, opts);
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
      if (!window.ApexCharts || !ref.current) return;
      inst.current = new window.ApexCharts(ref.current, opts);
      inst.current.render();
      return () => { try { inst.current && inst.current.destroy(); } catch (e) {} };
    }, []);
    useEffect(() => {
      if (inst.current) { try { inst.current.updateSeries([{ data }], false); } catch (e) {} }
    }, [JSON.stringify(data), color]);
    return <div ref={ref} style={{ width: '100%' }} />;
  }

  Object.assign(window, { Chart, Sparkline });
})();
