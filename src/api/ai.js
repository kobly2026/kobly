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
    return {
      papel: view,
      campanhas: db.campanhas.map((c) => ({
        nome: c.nome, status: c.status, taxaAbertura: c.stats.taxaAbertura, ctr: c.stats.ctr,
        emailsEnviados: c.stats.emailsEnviados, vendasRecuperadas: c.stats.vendasRecuperadas, criticidade: c.stats.criticidade,
      })),
      contas: db.empresas.map((e) => ({ nome: e.nome, segmento: e.segmento, criticidade: e.criticidade, leads: e.leads })),
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
  // Sugestão para uma campanha (usa a criticidade para contextualizar)
  async suggestForCampaign(campaign) {
    await wait(1100 + Math.random() * 700);
    const pool = suggestionsByCriticidade[campaign.criticidade] || suggestionsByCriticidade['Bom'];
    return pick(pool);
  },

  // Sugestão consolidada (dashboard — "todas as campanhas")
  async suggestForDashboard() {
    await wait(1200 + Math.random() * 600);
    return pick([
      'Suas campanhas de Pix convertem melhor que as de carrinho. Realoque esforço de cópia para o fluxo de carrinho.',
      'A conta "Studio Marília" está em criticidade Crítico — priorize revisão do domínio e dos assuntos.',
      '3 campanhas usam o mesmo e-mail de "última chance". Personalize por segmento para reduzir fadiga.',
    ]);
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

  // Geração de HTML de e-mail por IA (no legado: GET /generate_html).
  // Usa o Email Design System do Kobly (src/lib/emailTemplate.js) — mesmo template
  // branded/componentizado dos disparos reais, então editor e envio ficam idênticos.
  async generateEmailHtml(brief) {
    await wait(1400 + Math.random() * 800);
    const titulo = (brief && brief.titulo) || 'Você esqueceu algo no carrinho';
    const cta = (brief && brief.cta) || 'Concluir compra';
    const intro = (brief && brief.intro) ||
      'Separamos seus itens e eles continuam reservados pra você — conclua agora antes que o estoque acabe.';
    const brand = (brief && brief.brand) || { name: 'Sua Loja' };
    return renderEmail({
      brand,
      preheader: titulo,
      blocks: [
        { type: 'hero', eyebrow: 'Sua loja', title: titulo, text: intro },
        { type: 'button', label: cta, href: '#' },
        { type: 'note', text: 'Se você já finalizou, pode ignorar este e-mail. Para não receber mais, descadastre-se.' },
      ],
    });
  },
};
