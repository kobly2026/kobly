// Kobly — camada de API (mock). Exposto em window.KoblyApi.
// Métodos assíncronos com latência simulada, lendo de window.KoblyMockDB.
// A UI depende SÓ destas assinaturas — trocar mock por API real = reescrever só este arquivo.
(function () {
  const DB = window.KoblyMockDB;
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const br = (n) => Number(n).toLocaleString('pt-BR');
  const pct = (n) => (n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
  const money = (n) => 'R$ ' + Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const empresaNome = (id) => (DB.empresas.find((e) => e.id === id) || {}).nome || '—';
  const userById = (id) => DB.users.find((u) => u.id === id) || {};
  const planoById = (id) => DB.planos.find((p) => p.id === id) || {};

  // ---- Séries temporais sintéticas (determinísticas por seed) ----------------
  // Gera uma curva suave e estável (mesmo seed → mesma série) para gráficos.
  function seeded(seed) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
  const RANGES = { hoje: 24, '7d': 7, '30d': 30, '90d': 90 };
  // Rótulos de eixo X conforme o range
  function axisLabels(range) {
    const n = RANGES[range] || 30;
    if (range === 'hoje') return Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}h`);
    const out = []; const today = new Date(2026, 5, 25);
    for (let i = n - 1; i >= 0; i--) { const d = new Date(today); d.setDate(d.getDate() - i); out.push(`${d.getDate()}/${d.getMonth() + 1}`); }
    return out;
  }
  // Série de inteiros com tendência leve de alta + ruído, somando ~total.
  function series(seed, range, total, volatility = 0.35) {
    const n = RANGES[range] || 30; const rnd = seeded(seed);
    const base = []; let acc = 0;
    for (let i = 0; i < n; i++) { const trend = 0.6 + (i / n) * 0.7; const noise = 1 + (rnd() - 0.5) * volatility * 2; const v = Math.max(0, trend * noise); base.push(v); acc += v; }
    return base.map((v) => Math.round((v / acc) * total));
  }
  const rangeFactor = (range) => ({ hoje: 0.06, '7d': 0.28, '30d': 1, '90d': 2.7 }[range] || 1);

  window.KoblyApi = {
    br, pct, money,

    // ---- Sessão -------------------------------------------------------------
    getSession(role) {
      const s = DB.sessionByRole[role] || DB.sessionByRole.Cliente;
      const u = userById(s.userId);
      return { ...s, role, name: u.nome, email: u.email, plano: planoById((DB.empresas.find((e) => e.id === s.empresaId) || {}).planoId).nome };
    },

    // ---- Dashboard ----------------------------------------------------------
    // Cliente: stats da própria empresa. Gestor: consolidado das contas geridas.
    async getDashboard(role, empresaId, range = '30d') {
      await wait(560 + Math.random() * 300);
      const consolidated = role === 'Gestor' || role === 'Administrador';
      const scopeCamps = consolidated ? DB.campanhas : DB.campanhas.filter((c) => c.empresaId === empresaId);
      const ativas = DB.campanhas.filter((c) => c.status === 'Ativa');
      const f = rangeFactor(range);
      const labels = axisLabels(range);

      // Agrega métricas (escopo do papel) e escala por período
      const agg = scopeCamps.reduce((a, c) => {
        a.enviados += c.stats.emailsEnviados; a.vendas += c.stats.vendasRecuperadas;
        a.abSum += c.stats.taxaAbertura * (c.stats.emailsEnviados || 1);
        a.ctrSum += c.stats.ctr * (c.stats.emailsEnviados || 1);
        a.w += (c.stats.emailsEnviados || 1);
        return a;
      }, { enviados: 0, vendas: 0, abSum: 0, ctrSum: 0, w: 0 });
      const taxaAbertura = agg.w ? agg.abSum / agg.w : 0;
      const ctr = agg.w ? agg.ctrSum / agg.w : 0;
      const enviadosP = Math.round(agg.enviados * f);
      const vendasP = Math.round(agg.vendas * f);

      // Séries para sparklines / drill-down (por métrica)
      const sEnviados = series(11, range, enviadosP, 0.4);
      const sVendas = series(23, range, vendasP, 0.5);
      const sAbertura = labels.map((_, i) => +(taxaAbertura * (0.85 + (i / labels.length) * 0.3)).toFixed(3));
      const sCtr = labels.map((_, i) => +(ctr * (0.8 + (i / labels.length) * 0.4)).toFixed(3));

      const metrics = consolidated ? [
        { key: 'contas', label: 'Contas gerenciadas', value: br(DB.empresas.length), icon: 'building-2', spark: series(7, range, DB.empresas.length * 10), unit: 'int' },
        { key: 'ativas', label: 'Campanhas ativas', value: br(ativas.length), icon: 'megaphone', accent: true, spark: series(9, range, ativas.length * 8), unit: 'int' },
        { key: 'abertura', label: 'Taxa de abertura', value: pct(taxaAbertura), icon: 'mail-open', delta: '+4,2%', deltaTone: 'up', spark: sAbertura, unit: 'pct' },
        { key: 'ctr', label: 'CTR médio', value: pct(ctr), icon: 'mouse-pointer-click', spark: sCtr, unit: 'pct' },
        { key: 'vendas', label: 'Vendas recuperadas', value: br(vendasP), icon: 'trending-up', delta: '+18', deltaTone: 'up', spark: sVendas, unit: 'int' },
      ] : [
        { key: 'abertura', label: 'Taxa de abertura', value: pct(taxaAbertura), icon: 'mail-open', delta: '+3,1%', deltaTone: 'up', spark: sAbertura, unit: 'pct' },
        { key: 'ctr', label: 'CTR médio', value: pct(ctr), icon: 'mouse-pointer-click', delta: '+0,8%', deltaTone: 'up', spark: sCtr, unit: 'pct' },
        { key: 'enviados', label: 'E-mails enviados', value: br(enviadosP), icon: 'send', spark: sEnviados, unit: 'int' },
        { key: 'vendas', label: 'Vendas recuperadas', value: br(vendasP), icon: 'trending-up', accent: true, spark: sVendas, unit: 'int' },
        { key: 'ativas', label: 'Campanhas ativas', value: br(ativas.length), icon: 'megaphone', spark: series(9, range, ativas.length * 8), unit: 'int' },
      ];

      // Tendência principal (enviados x recuperadas) ao longo do período
      const trend = { labels, enviados: sEnviados, recuperadas: sVendas };

      // Detalhe por métrica (drill-down ao clicar no KPI)
      const metricDrill = {
        enviados: { title: 'E-mails enviados', labels, series: sEnviados, unit: 'int', color: 'var(--accent)' },
        vendas: { title: 'Vendas recuperadas', labels, series: sVendas, unit: 'int', color: '#3ddc84' },
        abertura: { title: 'Taxa de abertura', labels, series: sAbertura.map((v) => +(v * 100).toFixed(1)), unit: 'pct', color: '#ffb020' },
        ctr: { title: 'CTR médio', labels, series: sCtr.map((v) => +(v * 100).toFixed(1)), unit: 'pct', color: '#ff8128' },
        ativas: { title: 'Campanhas ativas', labels, series: series(9, range, ativas.length * 8), unit: 'int', color: 'var(--accent)' },
        contas: { title: 'Contas gerenciadas', labels, series: series(7, range, DB.empresas.length * 10), unit: 'int', color: 'var(--accent)' },
      };

      // Breakdown por tipo de evento (donut) — derivado dos gatilhos das campanhas
      const evCount = {};
      scopeCamps.forEach((c) => { const g = (c.fluxo.find((s) => s.tipo === 'Gatilho') || {}).nome || 'Outros'; evCount[g] = (evCount[g] || 0) + Math.round(c.stats.emailsEnviados * f); });
      const breakdown = Object.entries(evCount).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);

      // Funil de entrega
      const funnel = [
        { etapa: 'Eventos aceitos', valor: Math.round(enviadosP * 1.18) },
        { etapa: 'E-mails enviados', valor: enviadosP },
        { etapa: 'Abertos', valor: Math.round(enviadosP * taxaAbertura) },
        { etapa: 'Cliques', valor: Math.round(enviadosP * ctr) },
        { etapa: 'Vendas recuperadas', valor: vendasP },
      ];

      const onboarding = [
        { label: 'Configurar perfil', done: true },
        { label: 'Autenticar domínio de envio', done: true },
        { label: 'Criar primeira campanha', done: DB.campanhas.length > 0 },
        { label: 'Conectar webhook de checkout', done: DB.webhooks.some((w) => w.testado) },
      ];

      return {
        consolidated, range, metrics, trend, breakdown, funnel, metricDrill,
        events: clone(DB.webhookEvents),
        campaigns: scopeCamps.map((c) => ({ id: c.id, nome: c.nome, status: c.status, ...c.stats })),
        accounts: DB.empresas.map((e) => ({ ...e, plano: planoById(e.planoId).nome })),
        onboarding,
      };
    },

    // Detalhe (drill-down) de uma campanha — série + breakdown de eventos
    async getCampaignDrill(id, range = '30d') {
      await wait(300);
      const c = DB.campanhas.find((x) => x.id === id);
      if (!c) return null;
      const labels = axisLabels(range);
      const f = rangeFactor(range);
      const seed = id.split('').reduce((s, ch) => s + ch.charCodeAt(0), 0);
      return {
        id: c.id, nome: c.nome, status: c.status, stats: clone(c.stats),
        labels,
        enviados: series(seed, range, Math.round(c.stats.emailsEnviados * f), 0.45),
        recuperadas: series(seed + 5, range, Math.round(c.stats.vendasRecuperadas * f), 0.6),
        etapas: c.fluxo.length,
      };
    },

    // ---- Campanhas ----------------------------------------------------------
    async listCampaigns(empresaId) {
      await wait(520 + Math.random() * 240);
      const rows = DB.campanhas.filter((c) => !empresaId || c.empresaId === empresaId);
      return { campaigns: clone(rows), templates: clone(DB.templates) };
    },
    async getCampaign(id) {
      await wait(360);
      const c = DB.campanhas.find((x) => x.id === id);
      return c ? clone(c) : null;
    },
    async createCampaign(tpl, empresaId) {
      await wait(380);
      const id = 'camp_' + Date.now();
      const c = {
        id, empresaId, nome: tpl.blank ? 'Nova campanha' : tpl.nome, status: 'Rascunho',
        usaTemplate: !tpl.blank, templateId: tpl.id, criadorId: 'u_joao', criadoEm: 'hoje',
        stats: { taxaAbertura: 0, ctr: 0, emailsEnviados: 0, vendasRecuperadas: 0, criticidade: 'Não Iniciado', valorCriticidade: 0, ultimoCalculo: '—' },
        tagsMeta: [],
        fluxo: tpl.gatilho
          ? [{ id: 'st_' + Date.now(), tipo: 'Gatilho', nome: tpl.gatilho, posicao: 0, atraso: 0, config: { tipoEvento: tpl.gatilho, webhookId: 'wh_1' } }]
          : [],
      };
      DB.campanhas = [c, ...DB.campanhas];
      return clone(c);
    },
    async setCampaignStatus(id, status) {
      await wait(220);
      const c = DB.campanhas.find((x) => x.id === id);
      if (c) c.status = status;
      return true;
    },
    async renameCampaign(id, nome) {
      const c = DB.campanhas.find((x) => x.id === id);
      if (c) c.nome = nome;
      return true;
    },
    async saveFlow(id, fluxo, tagsMeta) {
      await wait(300);
      const c = DB.campanhas.find((x) => x.id === id);
      if (c) { c.fluxo = clone(fluxo); if (tagsMeta) c.tagsMeta = clone(tagsMeta); }
      return true;
    },

    // ---- Leads --------------------------------------------------------------
    async listLeads(empresaId) {
      await wait(520 + Math.random() * 240);
      const rows = DB.leads.filter((l) => !empresaId || l.empresaId === empresaId).map((l) => clone(l));
      const enviados = rows.reduce((s, l) => s + l.metricas.enviados, 0);
      const status = {
        processados: enviados + Math.round(enviados * 0.12),
        enviados,
        rejeitados: Math.round(enviados * 0.07),
        adiados: Math.round(enviados * 0.05),
      };
      return { rows, status };
    },

    // ---- Clientes (Gestor) --------------------------------------------------
    async listClients() {
      await wait(520);
      return DB.empresas.map((e) => ({
        ...e, plano: planoById(e.planoId).nome,
        fundador: userById(e.fundadorId).nome, fundadorEmail: userById(e.fundadorId).email,
      }));
    },

    // ---- Integrações --------------------------------------------------------
    async getIntegrations(empresaId) {
      await wait(540);
      return {
        dominios: clone(DB.dominios.filter((d) => d.empresaId === empresaId)),
        webhooks: clone(DB.webhooks),
        tags: clone(DB.tags.filter((t) => t.empresaId === empresaId)),
        apiKey: 'kbl_live_' + 'a3f9c2e1b884d07f',
      };
    },
    async verifyDmarc(domId) {
      await wait(900);
      const d = DB.dominios.find((x) => x.id === domId);
      if (d) { d.validado = true; d.registros.forEach((r) => (r.status = 'verificado')); }
      return true;
    },
    async createTag(tag) {
      await wait(260);
      const t = { id: 'tag_' + Date.now(), empresaId: 'emp_1', ...tag };
      DB.tags = [...DB.tags, t];
      return clone(t);
    },

    // ---- Planos -------------------------------------------------------------
    async getPlans(empresaId) {
      await wait(420);
      const emp = DB.empresas.find((e) => e.id === empresaId);
      const plano = planoById(emp ? emp.planoId : 'pl_2');
      const usoCamp = DB.campanhas.filter((c) => c.empresaId === (empresaId || 'emp_1')).length;
      return {
        planos: clone(DB.planos),
        atual: clone(plano),
        uso: { campanhas: usoCamp, limiteCampanhas: plano.limiteCampanhas, execucoes: 14230, limiteExecucoes: plano.limiteExecucoes },
        transacoes: DB.transacoes.map((t) => ({ ...t, usuario: userById(t.userId).nome, plano: planoById(t.planoId).nome })),
      };
    },
    async createPlan(p) {
      await wait(320);
      const np = { id: 'pl_' + Date.now(), status: 'Ativo', deleted: false, ...p };
      DB.planos = [...DB.planos, np];
      return clone(np);
    },

    // ---- Chamados (chat) ----------------------------------------------------
    async listConversations(role, empresaId) {
      await wait(460);
      let rows = DB.conversas;
      if (role === 'Cliente') rows = rows.filter((c) => c.empresa === empresaNome(empresaId));
      return rows.map((c) => clone(c));
    },
    async sendMessage(convId, texto, autor, nome) {
      await wait(180);
      const c = DB.conversas.find((x) => x.id === convId);
      if (c) {
        c.mensagens.push({ id: 'msg_' + Date.now(), autor, nome, texto, when: 'agora' });
        c.atualizadoEm = 'agora';
      }
      return clone(c);
    },
    async resolveConversation(convId) {
      const c = DB.conversas.find((x) => x.id === convId);
      if (c) c.status = 'Resolvida';
      return true;
    },

    // ---- Suporte / FAQ ------------------------------------------------------
    async getHelp() { await wait(300); return { faq: clone(DB.faq) }; },

    // ---- Segurança (Admin) --------------------------------------------------
    async getSecurity() {
      await wait(520);
      return {
        users: DB.users.map((u) => ({ ...u, empresa: u.empresaId ? empresaNome(u.empresaId) : '—' })),
        historico: clone(DB.historicoAcesso),
        sessoes: clone(DB.sessoesAtivas),
        webhooks: clone(DB.webhooks),
      };
    },
    async setUserStatus(id, status) {
      await wait(260);
      const u = DB.users.find((x) => x.id === id);
      if (u) u.status = status;
      return true;
    },
    async endSession(id) {
      await wait(220);
      DB.sessoesAtivas = DB.sessoesAtivas.filter((s) => s.id !== id);
      return true;
    },

    // ---- Relatórios globais -------------------------------------------------
    async getReports(range = '90d') {
      await wait(560);
      const labels = axisLabels(range);
      const porConta = DB.empresas.map((e) => {
        const camps = DB.campanhas.filter((c) => c.empresaId === e.id);
        const enviados = camps.reduce((s, c) => s + c.stats.emailsEnviados, 0);
        const vendas = camps.reduce((s, c) => s + c.stats.vendasRecuperadas, 0);
        const ab = camps.length ? camps.reduce((s, c) => s + c.stats.taxaAbertura, 0) / camps.length : 0;
        return { id: e.id, conta: e.nome, segmento: e.segmento, plano: planoById(e.planoId).nome, campanhas: camps.length, enviados, vendas, taxaAbertura: ab, criticidade: e.criticidade };
      });
      const totalEnviados = porConta.reduce((s, r) => s + r.enviados, 0);
      const totalVendas = porConta.reduce((s, r) => s + r.vendas, 0);
      const f = rangeFactor(range);

      // 3 gráficos consolidados
      const campanhasCriadas = { labels, series: series(31, range, DB.campanhas.length * 6) };
      const disparosPorCanal = {
        labels,
        email: series(41, range, Math.round(totalEnviados * f)),
        sms: series(42, range, Math.round(totalEnviados * f * 0.18)),
        whatsapp: series(43, range, Math.round(totalEnviados * f * 0.31)),
      };
      const conversoesPorCanal = [
        { canal: 'E-mail', valor: Math.round(totalVendas * f * 0.74) },
        { canal: 'WhatsApp', valor: Math.round(totalVendas * f * 0.19) },
        { canal: 'SMS', valor: Math.round(totalVendas * f * 0.07) },
      ];
      const entrega = { abertura: 0.47, cliques: 0.19, bounce: 0.024 };
      const insights = [
        { tone: 'warning', icon: 'alert-triangle', text: 'A conta "Studio Marília" está em criticidade Crítico — priorize revisão de domínio e assuntos.' },
        { tone: 'info', icon: 'sparkles', text: 'Campanhas de Pix convertem 23% acima da média. Replique a cadência em outros gatilhos.' },
        { tone: 'success', icon: 'trending-up', text: 'WhatsApp cresceu como canal de conversão no período. Avalie ampliar o investimento.' },
      ];
      return { porConta, totalEnviados, totalVendas, range, campanhasCriadas, disparosPorCanal, conversoesPorCanal, entrega, insights };
    },

    // ---- Perfil -------------------------------------------------------------
    async getProfile(role) {
      await wait(360);
      const s = DB.sessionByRole[role];
      const u = userById(s.userId);
      const emp = DB.empresas.find((e) => e.id === u.empresaId);
      return { user: clone(u), empresa: emp ? clone(emp) : null, plano: emp ? clone(planoById(emp.planoId)) : null };
    },
  };
})();
