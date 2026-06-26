// Kobly — IA simulada (no legado vinha do n8n: /suggestion-ai e /generate_html).
// Aqui simulamos com latência + respostas montadas. Exposto em window.KoblyAI.
(function () {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

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

  window.KoblyAI = {
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

    // Resposta do assistente IA flutuante (contextual por rota) — mock offline.
    async answerAssistant(question, view) {
      await wait(900 + Math.random() * 700);
      const q = (question || '').toLowerCase();
      const byView = {
        integracoes: 'Verifique se os registros CNAME e o TXT de DMARC foram propagados no seu provedor de DNS (pode levar até algumas horas). Depois clique em "Verificar DNS" novamente.',
        leads: 'Leads com evento recente de "Pix gerado" ou "Abandono de carrinho" e ticket alto têm a maior intenção. Use as Tags-meta para priorizá-los.',
        relatorios: 'No período, o e-mail concentra a maior parte das conversões, mas o WhatsApp cresce rápido. A maior perda do funil está entre "Abertos" e "Cliques".',
        chamados: 'Resumo: o cliente relata que o webhook não dispara. Confirme se o webhook está marcado como "Testado" e se o secret confere com o da plataforma de checkout.',
      };
      if (q.includes('cta') || q.includes('assunto') || q.includes('e-mail') || q.includes('email')) {
        return 'Sugestão de assunto: "Falta pouco, {primeiro_nome} 👀" e CTA "Concluir compra agora". Assuntos curtos com o primeiro nome elevam a abertura.';
      }
      if (byView[view]) return byView[view];
      return pick(ANSWERS_ASSISTANT);
    },

    // Geração de HTML de e-mail por IA (no legado: GET /generate_html)
    async generateEmailHtml(brief) {
      await wait(1400 + Math.random() * 800);
      const titulo = brief && brief.titulo ? brief.titulo : 'Você esqueceu algo no carrinho';
      const cta = brief && brief.cta ? brief.cta : 'Concluir compra';
      return `<!-- Gerado por IA · Kobly -->
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #eee">
  <div style="background:#FF6800;padding:20px 28px;color:#1a1a1a;font-weight:800;font-size:20px">Loja do João</div>
  <div style="padding:28px">
    <h1 style="margin:0 0 12px;font-size:24px;color:#111">${titulo}</h1>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#444">
      Separamos seus itens e eles ainda estão reservados. Conclua agora e aproveite frete grátis nas próximas horas.
    </p>
    <a href="#" style="display:inline-block;background:#FF6800;color:#1a1a1a;font-weight:700;text-decoration:none;padding:13px 26px;border-radius:8px">${cta}</a>
    <p style="margin:22px 0 0;font-size:12px;color:#999">Se não quiser mais receber estes e-mails, descadastre-se aqui.</p>
  </div>
</div>`;
    },
  };
})();
