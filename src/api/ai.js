// Kobly — camada de IA. `answerAssistant` (chat flutuante) usa DeepSeek REAL via a
// Edge Function `ai-chat` (chave no Vault, server-side). As demais (sugestões/HTML)
// seguem mock por ora — podem ser migradas para a mesma função.
import { supabase } from './supabaseClient.js';
import { loadDB } from './supabaseDb.js';
import { renderEmail } from '../lib/emailTemplate.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Monta um contexto compacto e REAL (escopado por RLS) para fundamentar a IA.
async function buildContext(view) {
  try {
    const db = await loadDB();
    // Contagem REAL de leads por org (o org.leads_count é um contador congelado do seed).
    const leadsPorOrg = {};
    db.leads.forEach((l) => { leadsPorOrg[l.empresaId] = (leadsPorOrg[l.empresaId] || 0) + 1; });
    return {
      papel: view,
      campanhas: db.campanhas.map((c) => ({
        nome: c.nome, status: c.status, taxaAbertura: c.stats.taxaAbertura, ctr: c.stats.ctr,
        emailsEnviados: c.stats.emailsEnviados, vendasRecuperadas: c.stats.vendasRecuperadas, criticidade: c.stats.criticidade,
      })),
      contas: db.empresas.map((e) => ({ nome: e.nome, segmento: e.segmento, criticidade: e.criticidade, leads: leadsPorOrg[e.id] || 0 })),
      leadsTotal: db.leads.length,
    };
  } catch (e) {
    return { papel: view };
  }
}

const ANSWERS_ASSISTANT = [
  'Analisei seus dados: a queda vem do fluxo de carrinho, com atraso longo na 1ª etapa. Reduza para 30 min e teste um assunto mais curto.',
  'A campanha "Pix gerado — lembrete" lidera em CTR (27%). Vale replicar a estrutura dela para os outros gatilhos.',
  'Nos últimos 30 dias a abertura média subiu 3,1% e você recuperou mais vendas que no período anterior. Mantenha o ritmo e monitore a fadiga da lista.',
  'Para abandono de carrinho, uma cadência de 3 toques (30 min, 24 h, 48 h) com cupom no 2º e-mail costuma converter melhor.',
  'Recomendo autenticar o domínio (DKIM/DMARC) antes de escalar os disparos — isso melhora a entregabilidade e reduz spam.',
];

const suggestionsByCriticidade = {
  'Crítico': [
    'A taxa de abertura está baixa. Teste assuntos mais curtos e com o primeiro nome do lead.',
    'Reduza o atraso da primeira etapa para até 30 min — a intenção de compra cai rápido após o evento.',
    'Revise a autenticação do domínio: e-mails sem DKIM/DMARC válidos tendem a cair em spam.',
  ],
  'Mediano': [
    'Adicione uma etapa de "última chance" com cupom 24h após o primeiro e-mail.',
    'Segmente por valor do carrinho: ofertas diferentes para tickets altos e baixos.',
    'Inclua prova social (avaliações) no corpo do e-mail para subir o CTR.',
  ],
  'Bom': [
    'Bom desempenho. Teste um 3º toque por e-mail 48h depois para capturar indecisos.',
    'Considere uma tag-meta extra para encerrar leads que já recompraram.',
    'Experimente personalizar o assunto com o nome do produto abandonado.',
  ],
  'Excelente': [
    'Excelente conversão. Replique a estrutura desta campanha para outros gatilhos.',
    'Mantenha o ritmo atual e monitore a fadiga de lista (descadastros).',
    'Crie uma variação A/B do assunto para buscar ganho marginal de abertura.',
  ],
  'Não Iniciado': [
    'Esta campanha ainda não rodou. Conecte um webhook e ative o fluxo para começar a coletar dados.',
    'Defina ao menos um Gatilho e uma etapa de Envio de e-mail antes de ativar.',
  ],
};

export const KoblyAI = {
  // Sugestão para uma campanha — DeepSeek REAL (ai-chat task=suggestion); fallback enlatado.
  async suggestForCampaign(campaign) {
    try {
      const context = await buildContext('campaign');
      const nome = (campaign && (campaign.nome || campaign.name)) || 'esta campanha';
      const crit = (campaign && campaign.criticidade) || '';
      const brief = `Analise especificamente a campanha "${nome}"${crit ? ` (criticidade ${crit})` : ''} e dê 1 recomendação prática para melhorá-la.`;
      const { data, error } = await supabase.functions.invoke('ai-chat', { body: { task: 'suggestion', context, brief } });
      if (error || !data || !data.suggestion) throw error || new Error('sem sugestão');
      return data.suggestion;
    } catch (e) {
      const pool = suggestionsByCriticidade[campaign && campaign.criticidade] || suggestionsByCriticidade['Bom'];
      return pick(pool);
    }
  },

  // Sugestão consolidada (dashboard) — DeepSeek REAL; fallback enlatado.
  async suggestForDashboard(view) {
    try {
      const context = await buildContext(view || 'dashboard');
      const { data, error } = await supabase.functions.invoke('ai-chat', { body: { task: 'suggestion', context, brief: 'Olhando todas as campanhas e métricas, dê a recomendação mais impactante agora.' } });
      if (error || !data || !data.suggestion) throw error || new Error('sem sugestão');
      return data.suggestion;
    } catch (e) {
      return pick([
        'Reduza o atraso da 1ª etapa do fluxo de carrinho para até 30 min — a intenção de compra cai rápido.',
        'Priorize a campanha de criticidade mais alta: revise o assunto e adicione um 2º toque com cupom.',
        'Personalize o assunto com o nome do produto abandonado para subir a taxa de abertura.',
      ]);
    }
  },

  // Resposta do assistente IA flutuante — DeepSeek REAL via Edge Function `ai-chat`.
  // `messages` é o histórico do chat ({from:'user'|'ai', text}); multi-turn.
  async answerAssistant(messages, view) {
    try {
      const history = (Array.isArray(messages) ? messages : [{ from: 'user', text: String(messages || '') }])
        .filter((m) => m && m.text)
        .map((m) => ({ role: m.from === 'user' ? 'user' : 'assistant', content: m.text }));
      const context = await buildContext(view);
      const { data, error } = await supabase.functions.invoke('ai-chat', { body: { messages: history, context } });
      if (error || !data || !data.answer) {
        return 'Desculpe, não consegui falar com a IA agora. Tente de novo em instantes.';
      }
      return data.answer;
    } catch (e) {
      return 'Desculpe, tive um problema ao consultar a IA agora.';
    }
  },

  // Planeja uma campanha COMPLETA a partir de um objetivo: DeepSeek (ai-chat task=plan)
  // escolhe o gatilho + cadência + textos. `canais` (['email','whatsapp']) define os
  // canais da cadência — cada etapa volta com `canal` (whatsapp → campo `texto`).
  // Retorna { nome, gatilho, etapas:[...] }. Fallback: abandono de carrinho de 2 toques.
  async planCampaign(objetivo, canais) {
    const lista = Array.isArray(canais) && canais.length ? canais : ['email'];
    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', { body: { task: 'plan', brief: objetivo || '', canais: lista } });
      if (error || !data || !data.plan) throw error || new Error('sem plano');
      const p = data.plan;
      if (!p.etapas || !p.etapas.length) throw new Error('plano vazio');
      return p;
    } catch (e) {
      const soWhats = lista.includes('whatsapp') && !lista.includes('email');
      const etapas = soWhats
        ? [
            { canal: 'whatsapp', atraso_min: 30, assunto: 'Carrinho — lembrete', titulo: 'Carrinho — lembrete', texto: 'Oi! Vi que você deixou itens no carrinho e eles ainda estão reservados. 😉\nFinalize por aqui: {{cta_link}}', cupom: null },
            { canal: 'whatsapp', atraso_min: 1440, assunto: 'Carrinho — última chance', titulo: 'Carrinho — última chance', texto: 'Última chance: seus itens saem da reserva hoje.\nGaranta agora: {{cta_link}}', cupom: null },
          ]
        : [
            { canal: 'email', atraso_min: 30, assunto: 'Você esqueceu algo no carrinho', eyebrow: 'Recuperação', titulo: 'Seu carrinho ainda está aqui', paragrafos: ['Separamos seus itens e eles continuam reservados — conclua antes que acabem.'], cta: 'Voltar ao carrinho', cupom: null },
            ...(lista.includes('whatsapp')
              ? [{ canal: 'whatsapp', atraso_min: 120, assunto: 'Carrinho — toque no WhatsApp', titulo: 'Carrinho — toque no WhatsApp', texto: 'Oi! Seus itens ainda estão no carrinho. 😉\nFinalize por aqui: {{cta_link}}', cupom: null }]
              : []),
            { canal: 'email', atraso_min: 1440, assunto: 'Última chance: 10% OFF', eyebrow: 'Oferta', titulo: 'Um empurrãozinho pra fechar', paragrafos: ['Use o cupom abaixo e finalize hoje.'], cta: 'Usar cupom', cupom: { codigo: 'VOLTA10', detalhe: '10% de desconto por tempo limitado' } },
          ];
      return { nome: (objetivo && objetivo.slice(0, 40)) || 'Recuperação de carrinho', gatilho: 'Abandono de carrinho', etapas };
    }
  },

  // Geração de mensagem de WhatsApp por IA (ai-chat task=whatsapp): retorna
  // { titulo, texto } com {{cta_link}} garantido. Fallback: template estático.
  async generateWhatsappText(brief) {
    let brandName = 'Sua Loja';
    try {
      let q = supabase.from('org_branding').select('nome');
      if (brief && brief.empresaId) q = q.eq('organization_id', brief.empresaId);
      const { data: b } = await q.limit(1).maybeSingle();
      if (b && b.nome) brandName = b.nome;
    } catch (e) { /* segue com o default */ }
    const briefText = (brief && brief.brief) || 'Mensagem de recuperação de carrinho abandonado.';
    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', { body: { task: 'whatsapp', brief: briefText, brand: brandName } });
      if (error || !data || !data.mensagem || !data.mensagem.texto) throw error || new Error('sem mensagem');
      return { titulo: data.mensagem.titulo || '', texto: data.mensagem.texto };
    } catch (err) {
      return {
        titulo: 'Recuperação — WhatsApp',
        texto: `Oi! Aqui é a ${brandName}. Vi que você não finalizou sua compra — seus itens ainda estão reservados. 😉\nFinalize por aqui: {{cta_link}}`,
      };
    }
  },

  // Geração de e-mail por IA: DeepSeek (ai-chat task=email) ESCREVE assunto+corpo,
  // renderizado no Email Design System do Kobly. Retorna { html, assunto }.
  // Fallback: template estático se a IA falhar.
  async generateEmailHtml(brief) {
    const cta = (brief && brief.cta) || 'Concluir compra';
    let brand = (brief && brief.brand) || { name: 'Sua Loja' };
    // Aplica a marca white-label da org (logo + cor) por cima do brand recebido.
    try {
      let q = supabase.from('org_branding').select('nome, logo_url, cor, modo');
      if (brief && brief.empresaId) q = q.eq('organization_id', brief.empresaId);
      const { data: b } = await q.limit(1).maybeSingle();
      if (b) brand = { name: brand.name || b.nome || 'Sua Loja', logoUrl: b.logo_url || brand.logoUrl, color: b.cor || brand.color, mode: b.modo || brand.mode || 'dark' };
    } catch (e) { /* segue com o brand recebido */ }
    const briefText = (brief && (brief.brief || brief.titulo)) || 'E-mail de recuperação de carrinho abandonado.';
    const note = 'Se você já finalizou, pode ignorar este e-mail. Para não receber mais, descadastre-se.';
    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', { body: { task: 'email', brief: briefText, brand: brand.name || 'Sua Loja' } });
      if (error || !data || !data.email) throw error || new Error('sem email');
      const e = data.email;
      const blocks = [
        { type: 'hero', eyebrow: e.eyebrow || 'Sua loja', title: e.titulo || 'Você esqueceu algo', text: (e.paragrafos && e.paragrafos[0]) || '' },
        ...((e.paragrafos || []).slice(1).map((p) => ({ type: 'paragraph', text: p }))),
        ...((e.cupom && e.cupom.codigo) ? [{ type: 'coupon', code: e.cupom.codigo, detail: e.cupom.detalhe || '' }] : []),
        // {{cta_link}}: token trocado no envio (process-steps) pelo link de recuperação do lead.
        { type: 'button', label: e.cta || cta, href: '{{cta_link}}' },
        { type: 'note', text: note },
      ];
      const html = renderEmail({ brand, preheader: e.assunto || e.titulo || '', blocks });
      return { html, assunto: e.assunto || '' };
    } catch (err) {
      const titulo = (brief && brief.titulo) || 'Você esqueceu algo no carrinho';
      const html = renderEmail({ brand, preheader: titulo, blocks: [
        { type: 'hero', eyebrow: 'Sua loja', title: titulo, text: 'Separamos seus itens e eles continuam reservados — conclua antes que o estoque acabe.' },
        { type: 'button', label: cta, href: '{{cta_link}}' },
        { type: 'note', text: note },
      ] });
      return { html, assunto: '' };
    }
  },
};
