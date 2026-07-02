// Kobly — camada de API (Supabase). Mantém a assinatura `KoblyApi` (contrato da UI):
// a UI depende só destas assinaturas async. Antes lia de um mock em memória; agora lê
// do Supabase via loadDB() (escopado por RLS multi-tenant) e escreve via supabase-js.
// Toda a SÍNTESE de séries/gráficos foi preservada — só a FONTE dos dados mudou.
import { supabase, SUPABASE_URL } from './supabaseClient.js';
import { loadDB, resetDb, currentProfile, firstOrgId, fmtDate, fmtDateTime } from './supabaseDb.js';
import { renderEmail } from '../lib/emailTemplate.js';

const clone = (o) => JSON.parse(JSON.stringify(o));
const br = (n) => Number(n).toLocaleString('pt-BR');
const pct = (n) => (n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
const money = (n) => 'R$ ' + Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// helpers de lookup (recebem o db hidratado)
const empresaNome = (db, id) => (db.empresas.find((e) => e.id === id) || {}).nome || '—';
const userById = (db, id) => db.users.find((u) => u.id === id) || {};
const planoById = (db, id) => db.planos.find((p) => p.id === id) || {};

// ---- Séries temporais sintéticas (determinísticas por seed) ----------------
function seeded(seed) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const RANGES = { hoje: 24, '7d': 7, '30d': 30, '90d': 90 };
function axisLabels(range) {
  const n = RANGES[range] || 30;
  if (range === 'hoje') return Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}h`);
  const out = []; const today = new Date(2026, 5, 25);
  for (let i = n - 1; i >= 0; i--) { const d = new Date(today); d.setDate(d.getDate() - i); out.push(`${d.getDate()}/${d.getMonth() + 1}`); }
  return out;
}
function series(seed, range, total, volatility = 0.35) {
  const n = RANGES[range] || 30; const rnd = seeded(seed);
  const base = []; let acc = 0;
  for (let i = 0; i < n; i++) { const trend = 0.6 + (i / n) * 0.7; const noise = 1 + (rnd() - 0.5) * volatility * 2; const v = Math.max(0, trend * noise); base.push(v); acc += v; }
  return base.map((v) => Math.round((v / acc) * total));
}
const rangeFactor = (range) => ({ hoje: 0.06, '7d': 0.28, '30d': 1, '90d': 2.7 }[range] || 1);

// ---- Sessão derivada do perfil autenticado --------------------------------
function buildSession(profile, db) {
  const role = profile.tipo_user_geral;
  const org = db.empresas.find((e) => e.id === profile.organization_id);
  const plano = org ? (db.planos.find((p) => p.id === org.planoId) || {}).nome : undefined;
  const contextLabel = (org && org.nome) || role;
  return { userId: profile.id, empresaId: profile.organization_id, contextLabel, role, name: profile.nome, email: profile.email, plano };
}

export const KoblyApi = {
  br, pct, money,

  // ---- Autenticação (login real) ------------------------------------------
  // Login por e-mail/senha. O store reage via onAuthStateChange e hidrata a sessão.
  async signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email: (email || '').trim(), password });
    if (!error) resetDb();
    return { error: error ? error.message : null };
  },
  // Atalho de demonstração (DEV-only): entra como a persona do papel. O import
  // dinâmico sob o guard mantém as credenciais demo fora do bundle de produção.
  async signInAsRole(role) {
    if (!import.meta.env.DEV) return { error: 'Disponível apenas em desenvolvimento' };
    const { DEMO_PERSONAS, DEMO_PASSWORD } = await import('./demoPersonas.js');
    const persona = DEMO_PERSONAS[role];
    if (!persona) return { error: 'Papel desconhecido: ' + role };
    return this.signIn(persona.email, DEMO_PASSWORD);
  },
  async signUp(email, password, nome) {
    const { data, error } = await supabase.auth.signUp({
      email: (email || '').trim(), password, options: { data: { nome: nome || '' } },
    });
    if (error) return { error: error.message };
    if (data && data.session) resetDb();
    // sem session => o projeto exige confirmação de e-mail
    return { error: null, needsConfirmation: !(data && data.session) };
  },
  async resetPassword(email) {
    const redirectTo = (typeof window !== 'undefined') ? window.location.origin : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail((email || '').trim(), { redirectTo });
    return { error: error ? error.message : null };
  },
  async updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error ? error.message : null };
  },
  // Constrói a sessão do app a partir do usuário autenticado atual (ou null).
  async loadAppSession() {
    const profile = await currentProfile();
    if (!profile) return null;
    const db = await loadDB();
    return buildSession(profile, db);
  },
  async getSession() { return this.loadAppSession(); },
  async signOut() { await supabase.auth.signOut(); resetDb(); return true; },

  // ---- Campanhas ----------------------------------------------------------
  async listCampaigns() {
    const db = await loadDB();
    return { campaigns: clone(db.campanhas), templates: clone(db.templates) };
  },
  async getCampaign(id) {
    const db = await loadDB();
    const c = db.campanhas.find((x) => x.id === id);
    return c ? clone(c) : null;
  },
  async createCampaign(tpl, empresaId, nome) {
    const me = await currentProfile();
    const orgId = empresaId || await firstOrgId(me);
    if (!orgId) throw new Error('Sua conta ainda não tem organização configurada.');
    const finalNome = (nome && nome.trim()) || (tpl.blank ? 'Nova campanha' : tpl.nome);
    const { data: camp, error } = await supabase.from('campaigns').insert({
      organization_id: orgId, nome: finalNome, status_campanha: 'Rascunho',
      usa_template: !tpl.blank, template_id: tpl.blank ? null : tpl.id, criador_id: me ? me.id : null,
    }).select().single();
    if (error) throw error;
    const { data: flow } = await supabase.from('campaign_flows').insert({ campaign_id: camp.id, organization_id: orgId }).select().single();
    const fluxo = [];
    if (tpl.gatilho && flow) {
      const { data: st } = await supabase.from('flow_steps').insert({
        flow_id: flow.id, organization_id: orgId, tipo_card: 'Gatilho', nome: tpl.gatilho, posicao: 0, atraso: 0, tipo_evento: tpl.gatilho,
      }).select().single();
      if (st) fluxo.push({ id: st.id, tipo: 'Gatilho', nome: tpl.gatilho, posicao: 0, atraso: 0, config: { tipoEvento: tpl.gatilho, webhookId: null } });
    }
    await supabase.from('campaign_stats').insert({ campaign_id: camp.id, organization_id: orgId });
    resetDb();
    return {
      id: camp.id, empresaId: orgId, nome: camp.nome, status: 'Rascunho', usaTemplate: !tpl.blank, templateId: tpl.blank ? null : tpl.id,
      criadorId: me ? me.id : null, criadoEm: fmtDate(camp.created_at),
      stats: { taxaAbertura: 0, ctr: 0, emailsEnviados: 0, vendasRecuperadas: 0, criticidade: 'Não Iniciado', valorCriticidade: 0, ultimoCalculo: '—' },
      tagsMeta: [], fluxo,
    };
  },
  async setCampaignStatus(id, status) {
    const { error } = await supabase.from('campaigns').update({ status_campanha: status }).eq('id', id);
    resetDb();
    return !error;
  },

  // Cria uma campanha COMPLETA a partir de um plano gerado por IA:
  // Gatilho (plan.gatilho) + N e-mails (etapas com atraso, assunto e corpo renderizado na marca).
  async createCampaignFromPlan(plan, empresaId) {
    const me = await currentProfile();
    const orgId = empresaId || await firstOrgId(me);
    if (!plan) return null;
    if (!orgId) throw new Error('Sua conta ainda não tem organização configurada.');
    // marca white-label da org p/ renderizar os e-mails
    let brand = { name: 'Sua Loja' };
    try {
      const { data: b } = await supabase.from('org_branding').select('nome, logo_url, cor, modo').eq('organization_id', orgId).maybeSingle();
      if (b) brand = { name: b.nome || 'Sua Loja', logoUrl: b.logo_url || undefined, color: b.cor || undefined, mode: b.modo || 'dark' };
    } catch (e) { /* usa default */ }

    const { data: camp, error } = await supabase.from('campaigns').insert({
      organization_id: orgId, nome: plan.nome || 'Campanha (IA)', status_campanha: 'Rascunho', usa_template: false, criador_id: me ? me.id : null,
    }).select().single();
    if (error) throw error;
    const { data: flow } = await supabase.from('campaign_flows').insert({ campaign_id: camp.id, organization_id: orgId }).select().single();
    await supabase.from('campaign_stats').insert({ campaign_id: camp.id, organization_id: orgId });

    const fluxo = [];
    const gatilho = plan.gatilho || 'Abandono de carrinho';
    const { data: gat } = await supabase.from('flow_steps').insert({
      flow_id: flow.id, organization_id: orgId, tipo_card: 'Gatilho', nome: gatilho, posicao: 0, atraso: 0, tipo_evento: gatilho,
    }).select().single();
    if (gat) fluxo.push({ id: gat.id, tipo: 'Gatilho', nome: gatilho, posicao: 0, atraso: 0, config: { tipoEvento: gatilho, webhookId: null } });

    let pos = 1;
    for (const et of (plan.etapas || [])) {
      const atraso = Number(et.atraso_min) || 0;
      // Condição de envio (IF/ELSE do fluxo) — só valores válidos; o resto vira "sempre" (null).
      const condicao = ['comprou', 'nao_comprou'].includes(et.condicao) ? et.condicao : null;

      // Etapa de WhatsApp (plan.etapas[].canal === 'whatsapp'): cria a mensagem em
      // whatsapp_messages e o card 'Envio de WhatsApp' — espelha o caminho do e-mail.
      if (et.canal === 'whatsapp') {
        let texto = String(et.texto || '').trim() || `Oi! Aqui é a ${brand.name}. Seus itens ainda estão reservados. 😉\nFinalize por aqui: {{cta_link}}`;
        // Normaliza variantes malformadas do placeholder que a IA às vezes gera
        // ({cta_link}, {{cta_link} …) e garante que ele exista — sem ele a mensagem
        // sai sem o link de recuperação.
        texto = texto.replace(/\{{1,2}\s*cta_link\s*\}{1,2}/gi, '{{cta_link}}');
        if (!texto.includes('{{cta_link}}')) texto = `${texto}\n\n{{cta_link}}`;
        const tituloWa = et.titulo || et.assunto || 'Mensagem WhatsApp';
        const { data: wm } = await supabase.from('whatsapp_messages').insert({
          organization_id: orgId, titulo: tituloWa, corpo_texto: texto, created_by: me ? me.id : null,
        }).select().single();
        const { data: st } = await supabase.from('flow_steps').insert({
          flow_id: flow.id, organization_id: orgId, tipo_card: 'Envio de WhatsApp', nome: tituloWa, posicao: pos, atraso, whatsapp_message_id: wm ? wm.id : null, condicao,
        }).select().single();
        if (st) fluxo.push({ id: st.id, tipo: 'Envio de WhatsApp', nome: tituloWa, posicao: pos, atraso, config: { whatsappMessageId: wm ? wm.id : null, condicao } });
        pos += 1;
        continue;
      }

      const blocks = [
        { type: 'hero', eyebrow: et.eyebrow || 'Sua loja', title: et.titulo || et.assunto || 'Você esqueceu algo', text: (et.paragrafos || [])[0] || '' },
        ...((et.paragrafos || []).slice(1).map((p) => ({ type: 'paragraph', text: p }))),
        ...((et.cupom && et.cupom.codigo) ? [{ type: 'coupon', code: et.cupom.codigo, detail: et.cupom.detalhe || '' }] : []),
        // {{cta_link}}: token trocado no envio pelo link de recuperação do lead (process-steps).
        { type: 'button', label: et.cta || 'Concluir compra', href: '{{cta_link}}' },
      ];
      const html = renderEmail({ brand, preheader: et.assunto || '', blocks });
      const { data: em } = await supabase.from('emails').insert({
        organization_id: orgId, titulo: et.assunto || 'E-mail da campanha', assunto: et.assunto || '', corpo_html: html, remetente: brand.name,
      }).select().single();
      const { data: st } = await supabase.from('flow_steps').insert({
        flow_id: flow.id, organization_id: orgId, tipo_card: 'Envio de e-mail', nome: et.assunto || 'Envio de e-mail', posicao: pos, atraso, email_id: em ? em.id : null, condicao,
      }).select().single();
      if (st) fluxo.push({ id: st.id, tipo: 'Envio de e-mail', nome: et.assunto || 'Envio de e-mail', posicao: pos, atraso, config: { emailId: em ? em.id : null, condicao } });
      pos += 1;
    }

    resetDb();
    return {
      id: camp.id, empresaId: orgId, nome: camp.nome, status: 'Rascunho', usaTemplate: false, templateId: null,
      criadorId: me ? me.id : null, criadoEm: fmtDate(camp.created_at),
      stats: { taxaAbertura: 0, ctr: 0, emailsEnviados: 0, vendasRecuperadas: 0, criticidade: 'Não Iniciado', valorCriticidade: 0, ultimoCalculo: '—' },
      tagsMeta: [], fluxo,
    };
  },
  async renameCampaign(id, nome) {
    const { error } = await supabase.from('campaigns').update({ nome }).eq('id', id);
    resetDb();
    return !error;
  },
  async saveFlow(id, fluxo, tagsMeta) {
    const { data: flowRow } = await supabase.from('campaign_flows').select('id, organization_id').eq('campaign_id', id).maybeSingle();
    if (!flowRow) return false;
    const flowId = flowRow.id; const orgId = flowRow.organization_id;
    await supabase.from('flow_steps').delete().eq('flow_id', flowId);
    await supabase.from('flow_meta_tags').delete().eq('flow_id', flowId);
    const arr = fluxo || [];
    const idMap = {}; // id do builder → id novo no banco (p/ parent_step_id dos ramos)
    const insertStep = async (s, i) => {
      const cfg = s.config || {};
      let fluxoAlvoId = null;
      if (s.tipo === 'Acionar Fluxo' && cfg.fluxoAlvo) {
        const { data: tf } = await supabase.from('campaign_flows').select('id').eq('campaign_id', cfg.fluxoAlvo).maybeSingle();
        fluxoAlvoId = tf ? tf.id : null;
      }
      // Ramo do card Condição COMPILA a condição do filho ('sim' → comprou,
      // 'nao' → nao_comprou) — o motor só conhece flow_steps.condicao (0022);
      // parent/ramo servem pra redesenhar a árvore no builder. Steps raiz usam
      // a condição própria do card (cfg.condicao).
      const condicao = s.parentId
        ? (s.ramo === 'sim' ? 'comprou' : 'nao_comprou')
        : (cfg.condicao || null);
      const parentDbId = s.parentId ? (idMap[s.parentId] || null) : null;
      const { data: st, error: stErr } = await supabase.from('flow_steps').insert({
        flow_id: flowId, organization_id: orgId, tipo_card: s.tipo, nome: s.nome,
        // posicao = ordem do ARRAY do builder (fonte da verdade da ordem visual;
        // s.posicao antigo fica stale depois de drag/reorder).
        posicao: i, atraso: s.atraso || 0,
        email_id: cfg.emailId || null, whatsapp_message_id: cfg.whatsappMessageId || null,
        condicao,
        parent_step_id: parentDbId, ramo: parentDbId ? (s.ramo || null) : null,
        tipo_evento: cfg.tipoEvento || null, webhook_id: cfg.webhookId || null, fluxo_alvo_id: fluxoAlvoId,
      }).select().single();
      // Nunca falhar em silêncio: os steps antigos já foram apagados acima — se o
      // insert falhar, avisa o chamador para a UI não fingir que salvou.
      if (stErr) { console.error('saveFlow steps insert failed', stErr); return false; }
      idMap[s.id] = st.id;
      if (st && s.tipo === 'Adicionar Tag' && (cfg.tags || []).length) await supabase.from('step_add_tags').insert(cfg.tags.map((t) => ({ step_id: st.id, tag_id: t })));
      if (st && s.tipo === 'Remover Tag' && (cfg.tags || []).length) await supabase.from('step_remove_tags').insert(cfg.tags.map((t) => ({ step_id: st.id, tag_id: t })));
      return true;
    };
    // Duas passadas: raiz primeiro (os filhos dos ramos referenciam o id novo do pai —
    // o card Condição pode estar DEPOIS dos filhos no array após um drag).
    for (let i = 0; i < arr.length; i++) if (!arr[i].parentId) { if (!(await insertStep(arr[i], i))) return false; }
    for (let i = 0; i < arr.length; i++) if (arr[i].parentId) { if (!(await insertStep(arr[i], i))) return false; }
    if ((tagsMeta || []).length) await supabase.from('flow_meta_tags').insert(tagsMeta.map((t) => ({ flow_id: flowId, tag_id: t })));
    resetDb();
    return true;
  },

  // ---- Leads --------------------------------------------------------------
  async listLeads() {
    const db = await loadDB();
    const rows = clone(db.leads);
    // Contagens REAIS do pipeline de e-mail, escopadas por RLS às orgs acessíveis.
    const countOf = async (builder) => { const { count } = await builder; return count || 0; };
    const [enviados, rejeitados, fila] = await Promise.all([
      countOf(supabase.from('email_events').select('id', { count: 'exact', head: true }).eq('status', 'enviado')),
      countOf(supabase.from('email_events').select('id', { count: 'exact', head: true }).eq('status', 'falhou')),
      countOf(supabase.from('scheduled_steps').select('id', { count: 'exact', head: true }).in('status_agendamento', ['Iniciado', 'Em andamento'])),
    ]);
    const status = {
      processados: enviados + rejeitados, // total de tentativas processadas (enviadas + rejeitadas)
      enviados,                           // email_events.status = 'enviado'
      rejeitados,                         // email_events.status = 'falhou'
      adiados: fila,                      // scheduled_steps ainda pendentes (na fila)
    };
    return { rows, status, tags: clone(db.tags) };
  },

  // Funil de recuperação — contagens REAIS por etapa, escopadas por RLS (opcionalmente
  // filtradas por empresaId). Etapas: eventos recebidos → e-mails enviados → abertos →
  // clicados → recuperados. Abertos/clicados = e-mails ÚNICOS (por destinatário).
  async getFunnel(empresaId) {
    const scope = (q) => (empresaId ? q.eq('organization_id', empresaId) : q);
    const countOf = async (builder) => { const { count } = await builder; return count || 0; };
    const uniqueEmails = async (ev) => {
      let q = supabase.from('email_events').select('email').eq('event', ev);
      if (empresaId) q = q.eq('organization_id', empresaId);
      const { data } = await q;
      return new Set((data || []).map((r) => r.email)).size;
    };
    const [eventos, enviados] = await Promise.all([
      countOf(scope(supabase.from('webhook_events').select('id', { count: 'exact', head: true }))),
      countOf(scope(supabase.from('email_events').select('id', { count: 'exact', head: true }).eq('status', 'enviado'))),
    ]);
    const [abertos, clicados] = await Promise.all([uniqueEmails('open'), uniqueEmails('click')]);
    let rq = supabase.from('campaign_stats').select('vendas_recuperadas');
    if (empresaId) rq = rq.eq('organization_id', empresaId);
    const { data: cs } = await rq;
    const recuperados = (cs || []).reduce((s, r) => s + (Number(r.vendas_recuperadas) || 0), 0);
    return { eventos, enviados, abertos, clicados, recuperados };
  },

  // Dashboard completo — KPIs + funil + eventos recentes + top campanhas, tudo REAL.
  async getDashboard(empresaId) {
    const db = await loadDB();
    const funnel = await this.getFunnel(empresaId);
    const camps = (db.campanhas || []).filter((c) => !empresaId || c.empresaId === empresaId);
    const leads = (db.leads || []).filter((l) => !empresaId || l.empresaId === empresaId);
    const enviados = funnel.enviados;
    const kpis = {
      leads: leads.length,
      enviados,
      abertura: enviados ? funnel.abertos / enviados : 0,
      ctr: enviados ? funnel.clicados / enviados : 0,
      recuperados: funnel.recuperados,
      ativas: camps.filter((c) => c.status === 'Ativa').length,
    };
    const recent = await this.getRecentEvents(8, empresaId);
    const topCampaigns = camps
      .map((c) => ({ id: c.id, nome: c.nome, status: c.status, recuperadas: c.stats.vendasRecuperadas, enviados: c.stats.emailsEnviados, taxaAbertura: c.stats.taxaAbertura }))
      .sort((a, b) => (b.recuperadas - a.recuperadas) || (b.enviados - a.enviados))
      .slice(0, 5);
    return { kpis, funnel, recent, topCampaigns };
  },

  // Jornada cronológica de UM lead: eventos de checkout + e-mails (agendados/enviados,
  // com assunto e abertura/clique) + tags aplicadas — mesclados e ordenados no tempo.
  // Fontes: webhook_events, scheduled_steps(→flow_steps→emails + campaigns), lead_tags(→tags),
  // enriquecido com lead_metrics (aberturas/cliques por etapa). Tudo escopado por RLS.
  async getLeadTimeline(leadId) {
    if (!leadId) return [];
    const items = [];

    // 1) Eventos de checkout recebidos (entrada e conversão)
    const { data: evs } = await supabase.from('webhook_events')
      .select('id, tipo_evento, produto, valor_produto, provider, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });
    (evs || []).forEach((e) => items.push({
      id: 'ev_' + e.id, kind: 'evento', at: e.created_at,
      titulo: e.tipo_evento,
      sub: [e.produto, e.valor_produto != null ? money(e.valor_produto) : null].filter(Boolean).join(' · '),
      meta: e.provider || 'postback', tipoEvento: e.tipo_evento,
    }));

    // 2) Métricas por etapa (aberturas/cliques) p/ enriquecer os e-mails
    const { data: mets } = await supabase.from('lead_metrics')
      .select('etapa_email_origem_id, enviados, aberturas, cliques')
      .eq('lead_id', leadId);
    const metByStep = {};
    (mets || []).forEach((m) => { if (m.etapa_email_origem_id) metByStep[m.etapa_email_origem_id] = m; });

    // 3) E-mails do fluxo (agendados/enviados) — resolve assunto via flow_steps→emails
    const { data: steps } = await supabase.from('scheduled_steps')
      .select('id, status_agendamento, run_at, updated_at, created_at, step_id, flow_steps!step_id(nome, tipo_card, emails(assunto, titulo), campaign_flows!flow_id(campaigns(nome)))')
      .eq('lead_id', leadId)
      .order('run_at', { ascending: false });
    (steps || []).forEach((s) => {
      const fs = s.flow_steps || {};
      const email = fs.emails || {};
      const camp = fs.campaign_flows && fs.campaign_flows.campaigns ? fs.campaign_flows.campaigns.nome : null;
      const enviado = s.status_agendamento === 'Finalizado';
      const m = metByStep[s.step_id];
      const flags = [];
      if (m && m.aberturas > 0) flags.push('aberto');
      if (m && m.cliques > 0) flags.push('clicado');
      items.push({
        id: 'st_' + s.id, kind: 'email',
        at: enviado ? (s.updated_at || s.run_at) : s.run_at,
        titulo: email.assunto || fs.nome || 'E-mail',
        sub: [camp, enviado ? 'Enviado' : `Agendado (${s.status_agendamento})`, ...flags].filter(Boolean).join(' · '),
        status: s.status_agendamento, enviado, flags,
      });
    });

    // 4) Tags aplicadas (timestamp real)
    const { data: lts } = await supabase.from('lead_tags')
      .select('tag_id, created_at, tags(nome)')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });
    (lts || []).forEach((t) => items.push({
      id: 'tg_' + t.tag_id, kind: 'tag', at: t.created_at,
      titulo: t.tags ? t.tags.nome : 'Tag', sub: 'Tag aplicada',
    }));

    // Ordena tudo por tempo (mais recente primeiro) e formata a data
    items.sort((a, b) => new Date(b.at) - new Date(a.at));
    return items.map((it) => ({ ...it, quando: it.at ? fmtDateTime(it.at) : '—' }));
  },

  // Listas de apoio do construtor de fluxo (ids reais escopados por RLS).
  async getFlowOptions() {
    const db = await loadDB();
    return {
      webhooks: clone(db.webhooks),
      emails: clone(db.emails),
      whatsappMessages: clone(db.whatsappMessages || []),
      tags: clone(db.tags),
      campaigns: db.campanhas.map((c) => ({ id: c.id, nome: c.nome })),
    };
  },

  // ---- Clientes (Gestor) --------------------------------------------------
  async listClients() {
    const db = await loadDB();
    return db.empresas.map((e) => ({
      ...e, plano: planoById(db, e.planoId).nome,
      fundador: userById(db, e.fundadorId).nome, fundadorEmail: userById(db, e.fundadorId).email,
    }));
  },

  // ---- Integrações --------------------------------------------------------
  async getIntegrations() {
    const db = await loadDB();
    return {
      dominios: clone(db.dominios),
      webhooks: clone(db.webhooks),
      tags: clone(db.tags),
      emails: clone(db.emails),
    };
  },

  // ---- Marca / white-label ------------------------------------------------
  async getBranding(empresaId) {
    const me = await currentProfile();
    const orgId = empresaId || await firstOrgId(me);
    if (!orgId) return null;
    const { data } = await supabase.from('org_branding').select('*').eq('organization_id', orgId).maybeSingle();
    return data || { organization_id: orgId, nome: '', logo_url: '', cor: '#ff6800', modo: 'dark', link_loja: '' };
  },
  async saveBranding(empresaId, { nome, cor, logoUrl, modo, linkLoja }) {
    const me = await currentProfile();
    const orgId = empresaId || await firstOrgId(me);
    if (!orgId) return { error: 'no_org' };
    // Normaliza a URL da loja: adiciona https:// se vier sem esquema.
    let link = (linkLoja || '').trim();
    if (link && !/^https?:\/\//i.test(link)) link = `https://${link}`;
    const { error } = await supabase.from('org_branding').upsert(
      { organization_id: orgId, nome: nome || null, cor: cor || null, logo_url: logoUrl || null, modo: modo === 'light' ? 'light' : 'dark', link_loja: link || null, updated_at: new Date().toISOString() },
      { onConflict: 'organization_id' },
    );
    resetDb();
    return { error };
  },
  async uploadLogo(file, empresaId) {
    const me = await currentProfile();
    const orgId = empresaId || await firstOrgId(me);
    if (!orgId || !file) return { error: 'missing' };
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
    const path = `${orgId}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('branding').upload(path, file, { upsert: true, contentType: file.type || 'image/png' });
    if (error) return { error };
    const { data } = supabase.storage.from('branding').getPublicUrl(path);
    return { url: data.publicUrl };
  },

  // ---- Postback Tokens ----------------------------------------------------
  async getPostbackTokens() {
    const me = await currentProfile();
    const orgId = await firstOrgId(me);
    if (!orgId) return [];
    const { data, error } = await supabase.from('postback_tokens')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });
    if (error) return [];
    return data || [];
  },
  async getOrCreatePostbackToken(empresaId) {
    const me = await currentProfile();
    const orgId = empresaId || await firstOrgId(me);
    if (!orgId) return null;
    // Busca token existente
    const { data: existing } = await supabase.from('postback_tokens')
      .select('*')
      .eq('organization_id', orgId)
      .eq('ativo', true)
      .limit(1)
      .maybeSingle();
    if (existing) return existing;
    // Cria novo via RPC
    const { data, error } = await supabase.rpc('create_postback_token', {
      p_org_id: orgId,
      p_nome: 'Token principal',
    });
    if (error) return null;
    return data;
  },
  async createPostbackToken(nome, empresaId) {
    const me = await currentProfile();
    const orgId = empresaId || await firstOrgId(me);
    if (!orgId) return null;
    const { data, error } = await supabase.rpc('create_postback_token', {
      p_org_id: orgId,
      p_nome: nome || 'Novo token',
    });
    if (error) return null;
    resetDb();
    return data;
  },
  async revokePostbackToken(tokenId) {
    const { error } = await supabase.from('postback_tokens')
      .update({ ativo: false })
      .eq('id', tokenId);
    resetDb();
    return !error;
  },

  // ---- Últimos eventos recebidos ------------------------------------------
  async getRecentEvents(limit = 20, empresaId) {
    const me = await currentProfile();
    const orgId = empresaId || await firstOrgId(me);
    if (!orgId) return [];
    const { data, error } = await supabase.from('webhook_events')
      .select('id, tipo_evento, email, produto, valor_produto, provider, created_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return [];
    return data || [];
  },
  async createTag(tag) {
    const me = await currentProfile();
    const orgId = await firstOrgId(me);
    if (!orgId) throw new Error('Sua conta ainda não tem organização configurada.');
    const { data, error } = await supabase.from('tags').insert({
      organization_id: orgId, nome: tag.nome, descricao: tag.descricao, tipo_evento: tag.tipoEvento || null,
    }).select().single();
    if (error) throw error;
    resetDb();
    return { id: data.id, nome: data.nome, descricao: data.descricao, tipoEvento: data.tipo_evento, empresaId: data.organization_id };
  },

  // ---- Perfil (update) ----------------------------------------------------
  async updateProfile(patch) {
    const me = await currentProfile();
    if (!me) return { error: 'Sem sessão' };
    const { error } = await supabase.from('profiles').update({
      nome: patch.nome, celular: patch.celular, local: patch.local,
    }).eq('id', me.id);
    resetDb();
    return { error: error ? error.message : null };
  },

  // ---- Webhooks (create + provider + secret + signing_secret + eventos) ----
  async createWebhook({ nome, descricao, eventos, provider, signingSecret }) {
    const me = await currentProfile();
    const orgId = await firstOrgId(me);
    const rand = Math.random().toString(16).slice(2, 14);
    const prov = provider || 'generic';
    const base = SUPABASE_URL;
    const secret = 'whsec_' + rand;
    // generic = legado (secret no corpo). Demais plataformas = postback identificado por token na URL.
    const url = prov === 'generic'
      ? `${base}/functions/v1/webhook-receiver`
      : `${base}/functions/v1/webhook-receiver?provider=${prov}&token=${secret}`;
    const { data: wh, error } = await supabase.from('webhooks').insert({
      organization_id: orgId, nome, descricao: descricao || '', url, secret,
      provider: prov, signing_secret: signingSecret || null, testado: false, desabilitado: false,
    }).select().single();
    if (error) throw error;
    if ((eventos || []).length) {
      await supabase.from('webhook_event_types').insert(eventos.map((e) => ({ webhook_id: wh.id, tipo_evento: e })));
    }
    resetDb();
    return { id: wh.id, nome, descricao: descricao || '', url, secret, provider: prov, testado: false, desabilitado: false, eventos: eventos || [] };
  },

  // ---- E-mail (create de template) -----------------------------------------
  // Cria um template novo com corpo base renderizado na marca da org — antes o
  // "Novo template" da UI só chamava updateEmail e não criava nada.
  async createEmail({ titulo, assunto, remetente, corpoHtml }, empresaId) {
    const me = await currentProfile();
    const orgId = empresaId || await firstOrgId(me);
    if (!orgId) return { error: 'Sua conta ainda não tem organização configurada.', id: null };
    let html = (corpoHtml || '').trim();
    if (!html) {
      let brand = { name: remetente || 'Sua loja' };
      try {
        const b = await this.getBranding(orgId);
        if (b) brand = { name: b.nome || brand.name, logoUrl: b.logo_url || undefined, color: b.cor || undefined, mode: b.modo || 'dark' };
      } catch (e) { /* usa default */ }
      html = renderEmail({
        brand, preheader: assunto || '',
        blocks: [
          { type: 'hero', title: titulo || 'Você esqueceu algo', text: '' },
          { type: 'button', label: 'Concluir compra', href: '{{cta_link}}' },
        ],
      });
    }
    const { data, error } = await supabase.from('emails').insert({
      organization_id: orgId, titulo: titulo || 'Novo template', assunto: assunto || '',
      remetente: remetente || null, corpo_html: html, created_by: me ? me.id : null,
    }).select().single();
    resetDb();
    return { error: error ? error.message : null, id: data ? data.id : null };
  },

  // ---- E-mail (update do template) ----------------------------------------
  async updateEmail(id, patch) {
    const { error } = await supabase.from('emails').update({
      titulo: patch.titulo, assunto: patch.assunto, remetente: patch.remetente, corpo_html: patch.corpoHtml,
    }).eq('id', id);
    resetDb();
    return { error: error ? error.message : null };
  },

  // ---- E-mail (envio via Resend, Edge Function send-email) ----------------
  async sendTestEmail({ to, subject, html, text, from }) {
    // No teste não há lead, então resolve o {{cta_link}} pela URL da loja (ou '#').
    let testHtml = html || '';
    if (testHtml.includes('{{cta_link}}')) {
      let fallback = '#';
      try { const b = await this.getBranding(); if (b && b.link_loja) fallback = b.link_loja; } catch (e) { /* usa '#' */ }
      testHtml = testHtml.split('{{cta_link}}').join(fallback);
    }
    const { data, error } = await supabase.functions.invoke('send-email', { body: { to, subject, html: testHtml, text, from } });
    if (error) {
      // Em não-2xx (FunctionsHttpError) o corpo vem em error.context — tenta ler
      // para transformar erros conhecidos em mensagem amigável.
      const body = await error.context?.json?.().catch(() => null);
      if (body && body.error === 'secret_unavailable') return { error: 'Resend não configurado — a API key é definida pelo suporte.' };
      if (body && (body.detail || body.error)) {
        const msg = (body.detail && typeof body.detail === 'object') ? body.detail.message : body.detail;
        return { error: msg || body.error };
      }
      return { error: error.message };
    }
    if (data && data.error) {
      if (data.error === 'secret_unavailable') return { error: 'Resend não configurado (falta a API key).' };
      const msg = (data.detail && typeof data.detail === 'object') ? data.detail.message : data.detail;
      return { error: msg || data.error || 'Falha no envio' };
    }
    return { error: null, id: data && data.id };
  },

  // ---- WhatsApp (mensagens + envio de teste via Edge Function send-whatsapp)
  // Mesma modelagem dos templates de e-mail: lista escopada por RLS, título +
  // corpo em texto puro com suporte ao placeholder {{cta_link}}.
  async listWhatsappMessages() {
    const db = await loadDB();
    return clone(db.whatsappMessages || []);
  },
  // Cria (sem id) ou atualiza (com id) uma mensagem de WhatsApp da org.
  async saveWhatsappMessage({ id, titulo, corpoTexto, mediaUrl }, empresaId) {
    if (id) {
      const { error } = await supabase.from('whatsapp_messages').update({
        titulo, corpo_texto: corpoTexto, media_url: mediaUrl || null, updated_at: new Date().toISOString(),
      }).eq('id', id);
      resetDb();
      return { error: error ? error.message : null, id };
    }
    const me = await currentProfile();
    const orgId = empresaId || await firstOrgId(me);
    if (!orgId) return { error: 'Sua conta ainda não tem organização configurada.', id: null };
    const { data, error } = await supabase.from('whatsapp_messages').insert({
      organization_id: orgId, titulo, corpo_texto: corpoTexto, media_url: mediaUrl || null, created_by: me ? me.id : null,
    }).select().single();
    resetDb();
    return { error: error ? error.message : null, id: data ? data.id : null };
  },
  // Envio de teste — espelha o sendTestEmail: no teste não há lead, então o
  // {{cta_link}} é resolvido pela URL da loja (ou '#'). Credenciais Z-API ficam
  // no Vault e são resolvidas pela própria edge function.
  async sendTestWhatsapp({ phone, message }) {
    let testMsg = message || '';
    if (testMsg.includes('{{cta_link}}')) {
      let fallback = '#';
      try { const b = await this.getBranding(); if (b && b.link_loja) fallback = b.link_loja; } catch (e) { /* usa '#' */ }
      testMsg = testMsg.split('{{cta_link}}').join(fallback);
    }
    const { data, error } = await supabase.functions.invoke('send-whatsapp', { body: { phone, message: testMsg } });
    if (error) {
      // Em não-2xx (FunctionsHttpError) o corpo vem em error.context — tenta ler
      // para transformar erros conhecidos em mensagem amigável.
      const body = await error.context?.json?.().catch(() => null);
      if (body && body.error === 'secret_unavailable') return { error: 'Z-API não configurada — as credenciais são definidas pelo suporte.' };
      if (body && (body.detail || body.error)) {
        const msg = (body.detail && typeof body.detail === 'object') ? body.detail.message : body.detail;
        return { error: msg || body.error };
      }
      return { error: error.message };
    }
    if (data && data.error) {
      if (data.error === 'secret_unavailable') return { error: 'Z-API não configurada (faltam as credenciais no Vault).' };
      const msg = (data.detail && typeof data.detail === 'object') ? data.detail.message : data.detail;
      return { error: msg || data.error || 'Falha no envio' };
    }
    return { error: null, id: data && data.id };
  },

  // Estado da conexão WhatsApp (Z-API): conectado? qual número/nome está plugado?
  // Mostrado na aba WhatsApp pra ninguém precisar abrir o painel da Z-API.
  async getWhatsappStatus() {
    const { data, error } = await supabase.functions.invoke('send-whatsapp', { body: { action: 'status' } });
    if (error) {
      const body = await error.context?.json?.().catch(() => null);
      if (body && body.error === 'secret_unavailable') return { error: 'Z-API não configurada — as credenciais são definidas pelo suporte.' };
      return { error: (body && (body.detail || body.error)) || error.message };
    }
    if (data && data.error) return { error: data.detail || data.error };
    return { error: null, connected: !!(data && data.connected), smartphoneConnected: !!(data && data.smartphoneConnected), phone: (data && data.phone) || null, name: (data && data.name) || null };
  },

  // ---- Onboarding self-service (Cliente sem org cria a própria) -----------
  async createOwnOrg({ nome, segmento }) {
    const { data, error } = await supabase.rpc('create_own_org', { p_nome: nome, p_segmento: segmento || null });
    resetDb();
    if (error) return { error: error.message, org: null };
    return { error: null, org: data };
  },
  // Nichos de interesse escolhidos no onboarding (profiles.curadoria text[]).
  async saveCuradoria(nichos) {
    const me = await currentProfile();
    if (!me) return { error: 'Sem sessão' };
    const { error } = await supabase.from('profiles').update({ curadoria: nichos || [] }).eq('id', me.id);
    resetDb();
    return { error: error ? error.message : null };
  },

  // ---- Organizações / contas (Gestor cria; membro edita básico) -----------
  async createOrganization({ nome, segmento }) {
    const { data, error } = await supabase.rpc('create_managed_org', { p_nome: nome, p_segmento: segmento });
    resetDb();
    if (error) return { error: error.message };
    return { error: null, org: data };
  },
  async updateOrganization(id, patch) {
    const { error } = await supabase.from('organizations').update({ nome: patch.nome, segmento: patch.segmento }).eq('id', id);
    resetDb();
    return { error: error ? error.message : null };
  },

  // ---- Planos -------------------------------------------------------------
  async getPlans() {
    const db = await loadDB();
    const me = await currentProfile();
    const org = db.empresas.find((e) => e.id === (me && me.organization_id)) || db.empresas[0];
    const plano = (org && db.planos.find((p) => p.id === org.planoId)) || db.planos.find((p) => p.nome === 'Pro') || db.planos[0] || {};
    const usoCamp = db.campanhas.filter((c) => !org || c.empresaId === org.id).length;
    const { data: uc } = await supabase.from('usage_counters').select('*');
    const usage = (uc && uc[0]) || null;
    return {
      planos: clone(db.planos),
      atual: clone(plano),
      uso: { campanhas: usoCamp, limiteCampanhas: plano.limiteCampanhas, execucoes: usage ? Number(usage.numero_execucoes) : 0, limiteExecucoes: plano.limiteExecucoes },
      transacoes: db.transacoes.map((t) => ({ ...t, usuario: userById(db, t.userId).nome, plano: planoById(db, t.planoId).nome })),
    };
  },
  async createPlan(p) {
    const { data, error } = await supabase.from('plans').insert({
      nome: p.nome, descricao: p.descricao, valor_mensal: p.valorMensal, valor_anual: p.valorAnual,
      limite_campanhas: p.limiteCampanhas, limite_execucoes: p.limiteExecucoes, status: 'Ativo', deleted: false,
    }).select().single();
    if (error) throw error;
    resetDb();
    return { id: data.id, status: data.status, deleted: false, ...p };
  },

  // ---- Chamados (chat) ----------------------------------------------------
  async listConversations() {
    const db = await loadDB();
    return clone(db.conversas);
  },
  async sendMessage(convId, texto, autor, nome) {
    const me = await currentProfile();
    const isStaff = me && (me.tipo_user_geral === 'Suporte' || me.tipo_user_geral === 'Administrador');
    const finalAutor = isStaff ? (autor || 'suporte') : 'cliente';
    await supabase.from('support_messages').insert({
      conversation_id: convId, autor: finalAutor, profile_id: me ? me.id : null, nome: nome || (me ? me.nome : null), mensagem: texto,
    });
    await supabase.from('support_conversations').update({ updated_at: new Date().toISOString() }).eq('id', convId);
    resetDb();
    const db = await loadDB();
    return db.conversas.find((c) => c.id === convId) || null;
  },
  async resolveConversation(convId) {
    const { error } = await supabase.from('support_conversations').update({ status_chamado: 'Resolvida' }).eq('id', convId);
    resetDb();
    return !error;
  },

  // ---- Suporte / FAQ ------------------------------------------------------
  async getHelp() { const db = await loadDB(); return { faq: clone(db.faq) }; },

  // ---- Segurança (Admin) --------------------------------------------------
  async getSecurity() {
    const db = await loadDB();
    return {
      users: db.users.map((u) => ({ ...u, empresa: u.empresaId ? empresaNome(db, u.empresaId) : '—' })),
      historico: clone(db.historicoAcesso),
      sessoes: clone(db.sessoesAtivas),
      webhooks: clone(db.webhooks),
    };
  },
  async setUserStatus(id, status) {
    const { error } = await supabase.from('profiles').update({ status_user: status }).eq('id', id);
    resetDb();
    return !error;
  },
  async endSession(id) {
    const { error } = await supabase.from('active_sessions').delete().eq('id', id);
    resetDb();
    return !error;
  },

  // ---- Relatórios globais -------------------------------------------------
  async getReports(range = '90d') {
    const db = await loadDB();
    const labels = axisLabels(range);
    const porConta = db.empresas.map((e) => {
      const camps = db.campanhas.filter((c) => c.empresaId === e.id);
      const enviados = camps.reduce((s, c) => s + c.stats.emailsEnviados, 0);
      const vendas = camps.reduce((s, c) => s + c.stats.vendasRecuperadas, 0);
      const ab = camps.length ? camps.reduce((s, c) => s + c.stats.taxaAbertura, 0) / camps.length : 0;
      return { id: e.id, conta: e.nome, segmento: e.segmento, plano: planoById(db, e.planoId).nome, campanhas: camps.length, enviados, vendas, taxaAbertura: ab, criticidade: e.criticidade };
    });
    const totalEnviados = porConta.reduce((s, r) => s + r.enviados, 0);
    const totalVendas = porConta.reduce((s, r) => s + r.vendas, 0);
    const f = rangeFactor(range);

    const campanhasCriadas = { labels, series: series(31, range, db.campanhas.length * 6) };
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
  async getProfile() {
    const db = await loadDB();
    const me = await currentProfile();
    const user = (me && db.users.find((u) => u.id === me.id)) || null;
    const emp = me ? db.empresas.find((e) => e.id === me.organization_id) : null;
    return { user: user ? clone(user) : null, empresa: emp ? clone(emp) : null, plano: emp ? clone(planoById(db, emp.planoId)) : null };
  },
};
