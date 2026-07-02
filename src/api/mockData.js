// Kobly — camada de dados (mock) espelhando o MODELO REAL extraído do Bubble.
// Fonte da verdade: docs/01..04. Exposto em window.KoblyMockDB.
// 27 data types, 15 option sets, papéis @TipoUserGeral (Gestor/Cliente/Suporte/Administrador).
// Canal real do legado: E-MAIL (SendGrid). SMS/WhatsApp existem em @TipoEnvio mas são roadmap.
// ---------------------------------------------------------------------------
// OPTION SETS (15) — valores + tom de cor para badges
// ---------------------------------------------------------------------------
// Segmentos de organização (onboarding self-service e criação de conta pelo Gestor).
export const SEGMENTOS = ['Suplementos', 'Infoproduto', 'Beleza', 'Moda', 'Serviços', 'Outro'];

const optionSets = {
  StatusCampanha: {
    Ativa: 'success', Pausada: 'warning', Finalizada: 'neutral', Inativa: 'neutral', Pendente: 'info',
  },
  StatusAgendamento: {
    Iniciado: 'info', 'Em andamento': 'warning', 'Encerrado por Meta': 'success', Finalizado: 'neutral',
  },
  StatusCriticidade: {
    Crítico: 'danger', Mediano: 'warning', Bom: 'info', Excelente: 'success', 'Não Iniciado': 'neutral',
  },
  StatusUser: { Ativo: 'success', Desabilitado: 'danger', Pendente: 'warning' },
  StatusPlanos: { Ativo: 'success', Inativo: 'neutral' },
  StatusPagamento: { Pago: 'success', Pendente: 'warning', 'Pagamento recusado': 'danger' },
  StatusChamado: { 'Em andamento': 'warning', Resolvida: 'success' },
  PrioridadeChamado: { Alta: 'danger', Média: 'warning', Baixa: 'neutral' },
  TipoChamado: ['Dúvidas', 'Integração com a Plataforma', 'Pagamento', 'Erros'],
  TipoUserGeral: ['Gestor', 'Cliente', 'Suporte', 'Administrador'],
  TipoEnvio: ['email', 'SMS', 'Whatsapp'],
  TipoCardFluxo: ['Gatilho', 'Adicionar Tag', 'Remover Tag', 'Envio de e-mail', 'Acionar Fluxo'],
  MetodoHTTPS: ['GET', 'POST', 'DELETE', 'PATCH'],
  TipoEvento: [
    'Abandono de carrinho', 'Boleto Gerado', 'Compra cancelada', 'Depósito Solicitado', 'Pix Gerado',
    'Chargeback', 'Cancelamento de Assinatura', 'Compra Reembolsada', 'Compra Aprovada', 'Compra Recusada',
  ],
  TipoTemplate: [
    'Criar em Branco', 'Vender Curso', 'Abandono de Carrinho', 'Envio de oportunidade p/ Kobly CRM',
    'Marcar Leads eCommerce como oportunidades', 'Marcar Leads eCommerce como vendas', 'Pré-inscrição de curso',
    'Indique e Ganhe', 'Pós-venda', 'Cupom de Desconto', 'Resposta automática', 'Nutrição de Leads',
  ],
};

// Tom por tipo de evento (para badges/timeline)
const eventTone = {
  'Abandono de carrinho': 'danger', 'Pix Gerado': 'warning', 'Boleto Gerado': 'warning',
  'Compra Aprovada': 'success', 'Compra Recusada': 'danger', 'Compra Reembolsada': 'neutral',
  'Chargeback': 'danger', 'Compra cancelada': 'neutral', 'Cancelamento de Assinatura': 'neutral',
  'Depósito Solicitado': 'info',
};

// ---------------------------------------------------------------------------
// PLANOS
// ---------------------------------------------------------------------------
const planos = [
  { id: 'pl_1', nome: 'Starter', descricao: 'Para quem está começando a recuperar vendas.', status: 'Ativo', valorMensal: 97, valorAnual: 970, limiteCampanhas: 3, limiteExecucoes: 5000, deleted: false },
  { id: 'pl_2', nome: 'Pro', descricao: 'Operação multicampanha com automação completa.', status: 'Ativo', valorMensal: 197, valorAnual: 1970, limiteCampanhas: 10, limiteExecucoes: 25000, deleted: false },
  { id: 'pl_3', nome: 'Scale', descricao: 'Para agências e alto volume de eventos.', status: 'Ativo', valorMensal: 397, valorAnual: 3970, limiteCampanhas: 50, limiteExecucoes: 100000, deleted: false },
  { id: 'pl_4', nome: 'Legado 2024', descricao: 'Plano antigo descontinuado.', status: 'Inativo', valorMensal: 67, valorAnual: 670, limiteCampanhas: 2, limiteExecucoes: 3000, deleted: false },
];

// ---------------------------------------------------------------------------
// EMPRESAS (contas de cliente — multi-tenant via Empresa)
// ---------------------------------------------------------------------------
const empresas = [
  { id: 'emp_1', nome: 'Loja do João', fundadorId: 'u_joao', segmento: 'Suplementos', planoId: 'pl_2', leads: 1842, campanhasAtivas: 4, criticidade: 'Bom' },
  { id: 'emp_2', nome: 'Cursos Aurora', fundadorId: 'u_aurora', segmento: 'Infoproduto', planoId: 'pl_3', leads: 5310, campanhasAtivas: 7, criticidade: 'Excelente' },
  { id: 'emp_3', nome: 'Studio Marília', fundadorId: 'u_marilia', segmento: 'Beleza', planoId: 'pl_1', leads: 318, campanhasAtivas: 1, criticidade: 'Crítico' },
  { id: 'emp_4', nome: 'Infinity Wear', fundadorId: 'u_rafael', segmento: 'Moda', planoId: 'pl_2', leads: 1290, campanhasAtivas: 3, criticidade: 'Mediano' },
];

// ---------------------------------------------------------------------------
// USERS / PROFILES
// ---------------------------------------------------------------------------
const users = [
  { id: 'u_vitor', nome: 'Vitor Andrade', email: 'vitor@dizevolv.com', tipo: 'Gestor', status: 'Ativo', celular: '+55 11 99812-4455', local: 'São Paulo, BR', ultimoLogin: '25/06/2026 09:14', perfilCompleto: true, empresaId: null },
  { id: 'u_joao', nome: 'João Mendes', email: 'joao@lojadojoao.com.br', tipo: 'Cliente', status: 'Ativo', celular: '+55 21 99654-2210', local: 'Rio de Janeiro, BR', ultimoLogin: '25/06/2026 08:02', perfilCompleto: true, empresaId: 'emp_1' },
  { id: 'u_aurora', nome: 'Aurora Lima', email: 'aurora@cursosaurora.com', tipo: 'Cliente', status: 'Ativo', celular: '+55 31 99877-1100', local: 'Belo Horizonte, BR', ultimoLogin: '24/06/2026 21:40', perfilCompleto: true, empresaId: 'emp_2' },
  { id: 'u_marilia', nome: 'Marília Reis', email: 'marilia@studiomarilia.com', tipo: 'Cliente', status: 'Pendente', celular: '+55 41 99220-5566', local: 'Curitiba, BR', ultimoLogin: '20/06/2026 11:25', perfilCompleto: false, empresaId: 'emp_3' },
  { id: 'u_rafael', nome: 'Rafael Tavares', email: 'rafael@infinitywear.com', tipo: 'Cliente', status: 'Ativo', celular: '+55 51 99431-8890', local: 'Porto Alegre, BR', ultimoLogin: '25/06/2026 07:33', perfilCompleto: true, empresaId: 'emp_4' },
  { id: 'u_marina', nome: 'Marina Costa', email: 'marina@kobly.com', tipo: 'Suporte', status: 'Ativo', celular: '+55 11 98123-7766', local: 'São Paulo, BR', ultimoLogin: '25/06/2026 09:50', perfilCompleto: true, empresaId: null },
  { id: 'u_daniela', nome: 'Daniela Rocha', email: 'daniela@kobly.com', tipo: 'Administrador', status: 'Ativo', celular: '+55 11 97712-3344', local: 'São Paulo, BR', ultimoLogin: '25/06/2026 09:58', perfilCompleto: true, empresaId: null },
  { id: 'u_bruno', nome: 'Bruno Salles', email: 'bruno@lojadojoao.com.br', tipo: 'Cliente', status: 'Desabilitado', celular: '+55 21 99000-1212', local: 'Niterói, BR', ultimoLogin: '02/05/2026 14:10', perfilCompleto: true, empresaId: 'emp_1' },
];

// Sessão atual por papel (o seletor de papel troca isto ao vivo)
const sessionByRole = {
  Gestor:        { userId: 'u_vitor',   empresaId: null,   contextLabel: 'Agência Dizevolv' },
  Cliente:       { userId: 'u_joao',    empresaId: 'emp_1', contextLabel: 'Loja do João' },
  Suporte:       { userId: 'u_marina',  empresaId: null,   contextLabel: 'Central Koblay' },
  Administrador: { userId: 'u_daniela', empresaId: null,   contextLabel: 'Admin Koblay' },
};

// ---------------------------------------------------------------------------
// TAGS (TagsUsuário) por @TIpoEvento — escopo: Loja do João
// ---------------------------------------------------------------------------
const tags = [
  { id: 'tag_1', nome: 'Carrinho abandonado', descricao: 'Iniciou checkout e não concluiu', tipoEvento: 'Abandono de carrinho', empresaId: 'emp_1' },
  { id: 'tag_2', nome: 'Pix pendente', descricao: 'Gerou Pix e não pagou', tipoEvento: 'Pix Gerado', empresaId: 'emp_1' },
  { id: 'tag_3', nome: 'Comprou', descricao: 'Compra aprovada', tipoEvento: 'Compra Aprovada', empresaId: 'emp_1' },
  { id: 'tag_4', nome: 'Boleto em aberto', descricao: 'Gerou boleto sem pagamento', tipoEvento: 'Boleto Gerado', empresaId: 'emp_1' },
  { id: 'tag_5', nome: 'Reembolsado', descricao: 'Pediu reembolso', tipoEvento: 'Compra Reembolsada', empresaId: 'emp_1' },
  { id: 'tag_6', nome: 'Cliente VIP', descricao: 'Mais de 3 compras', tipoEvento: 'Compra Aprovada', empresaId: 'emp_1' },
];

// ---------------------------------------------------------------------------
// TEMPLATES PRONTOS (@TipoTemplate) — galeria "Nova campanha"
// ---------------------------------------------------------------------------
const templates = [
  { id: 'tpl_0', tipo: 'Criar em Branco', nome: 'Criar em branco', icone: 'plus', descricao: 'Comece o fluxo do zero, sem etapas.', blank: true },
  { id: 'tpl_1', tipo: 'Abandono de Carrinho', nome: 'Abandono de carrinho', icone: 'shopping-cart', descricao: 'Recupera carrinhos com cadência de e-mails.', gatilho: 'Abandono de carrinho' },
  { id: 'tpl_2', tipo: 'Pós-venda', nome: 'Pós-venda', icone: 'heart-handshake', descricao: 'Relacionamento após compra aprovada.', gatilho: 'Compra Aprovada' },
  { id: 'tpl_3', tipo: 'Vender Curso', nome: 'Vender curso', icone: 'graduation-cap', descricao: 'Sequência de conversão para infoprodutos.', gatilho: 'Pix Gerado' },
  { id: 'tpl_4', tipo: 'Cupom de Desconto', nome: 'Cupom de desconto', icone: 'badge-percent', descricao: 'Oferta com código de desconto.', gatilho: 'Abandono de carrinho' },
  { id: 'tpl_5', tipo: 'Nutrição de Leads', nome: 'Nutrição de leads', icone: 'sprout', descricao: 'Aquece a base ao longo do tempo.', gatilho: 'Compra Aprovada' },
  { id: 'tpl_6', tipo: 'Indique e Ganhe', nome: 'Indique e ganhe', icone: 'gift', descricao: 'Campanha de indicação para clientes.', gatilho: 'Compra Aprovada' },
  { id: 'tpl_7', tipo: 'Resposta automática', nome: 'Resposta automática', icone: 'message-square-reply', descricao: 'Resposta imediata a um evento.', gatilho: 'Pix Gerado' },
];

// ---------------------------------------------------------------------------
// E-MAILS (EmailsUsuário) — templates de e-mail
// ---------------------------------------------------------------------------
const emails = [
  { id: 'em_1', titulo: 'Carrinho — lembrete 1', assunto: 'Você esqueceu algo no carrinho 🛒', remetente: 'João da Loja', dominioId: 'dom_1', corpoHtml: '<h1>Ainda dá tempo!</h1><p>Seu carrinho continua reservado. Conclua a compra e ganhe frete grátis.</p>' },
  { id: 'em_2', titulo: 'Carrinho — última chance', assunto: 'Última chance: 10% OFF no seu pedido', remetente: 'João da Loja', dominioId: 'dom_1', corpoHtml: '<h1>Seu cupom expira hoje</h1><p>Use <b>VOLTA10</b> e finalize agora.</p>' },
  { id: 'em_3', titulo: 'Pix — lembrete', assunto: 'Seu Pix ainda está aguardando pagamento', remetente: 'João da Loja', dominioId: 'dom_1', corpoHtml: '<h1>Falta pouco</h1><p>Seu código Pix expira em breve. Pague para garantir o pedido.</p>' },
  { id: 'em_4', titulo: 'Pós-venda — obrigado', assunto: 'Obrigado pela compra! 💙', remetente: 'João da Loja', dominioId: 'dom_1', corpoHtml: '<h1>Pedido confirmado</h1><p>Acompanhe a entrega e conheça produtos que combinam com o seu.</p>' },
];

// ---------------------------------------------------------------------------
// DOMÍNIOS (DomíniosUsuário) — autenticação SendGrid (DKIM/DMARC/CNAME)
// ---------------------------------------------------------------------------
const dominios = [
  {
    id: 'dom_1', url: 'lojadojoao.com.br', validado: true, idSendGrid: 'sg_d_88213', empresaId: 'emp_1',
    registros: [
      { tipo: 'CNAME', host: 'em1234.lojadojoao.com.br', valor: 'u88213.wl.sendgrid.net', status: 'verificado' },
      { tipo: 'CNAME', host: 's1._domainkey.lojadojoao.com.br', valor: 's1.domainkey.u88213.wl.sendgrid.net', status: 'verificado' },
      { tipo: 'CNAME', host: 's2._domainkey.lojadojoao.com.br', valor: 's2.domainkey.u88213.wl.sendgrid.net', status: 'verificado' },
      { tipo: 'TXT', host: '_dmarc.lojadojoao.com.br', valor: 'v=DMARC1; p=none; rua=mailto:dmarc@lojadojoao.com.br', status: 'verificado' },
    ],
  },
  {
    id: 'dom_2', url: 'promo.lojadojoao.com.br', validado: false, idSendGrid: 'sg_d_88990', empresaId: 'emp_1',
    registros: [
      { tipo: 'CNAME', host: 'em5566.promo.lojadojoao.com.br', valor: 'u88990.wl.sendgrid.net', status: 'pendente' },
      { tipo: 'CNAME', host: 's1._domainkey.promo.lojadojoao.com.br', valor: 's1.domainkey.u88990.wl.sendgrid.net', status: 'pendente' },
      { tipo: 'TXT', host: '_dmarc.promo.lojadojoao.com.br', valor: 'v=DMARC1; p=quarantine;', status: 'pendente' },
    ],
  },
];

// ---------------------------------------------------------------------------
// WEBHOOKS (WebhooksUsuario) — config de entrada de e-commerce
// ---------------------------------------------------------------------------
const webhooks = [
  { id: 'wh_1', nome: 'Hotmart — checkout', descricao: 'Eventos de compra e carrinho da Hotmart', url: 'https://api.koblay.io/wh/emp_1/hotmart_9f3a2c81', secret: 'whsec_8f2a91c0e4', testado: true, desabilitado: false, eventos: ['Abandono de carrinho', 'Pix Gerado', 'Compra Aprovada'] },
  { id: 'wh_2', nome: 'Braip — checkout', descricao: 'Eventos da Braip', url: 'https://api.koblay.io/wh/emp_1/braip_2c81f3a9', secret: 'whsec_1b77e0aa42', testado: true, desabilitado: false, eventos: ['Boleto Gerado', 'Compra Aprovada', 'Chargeback'] },
  { id: 'wh_3', nome: 'Loja própria (Shopify)', descricao: 'Webhook custom da loja', url: 'https://api.koblay.io/wh/emp_1/custom_aa42b1c7', secret: 'whsec_55a1c2b3d4', testado: false, desabilitado: true, eventos: ['Compra Aprovada'] },
];

// ---------------------------------------------------------------------------
// LEADS (CRM) — escopo Loja do João
// ---------------------------------------------------------------------------
function makeLeads() {
  const nomes = [
    ['Ana', 'Souza'], ['Lucas', 'Martins'], ['Carla', 'Ribeiro'], ['Pedro', 'Alves'], ['Júlia', 'Ferreira'],
    ['Bruno', 'Lima'], ['Sofia', 'Dias'], ['Rafael', 'Teixeira'], ['Helena', 'Moraes'], ['Diego', 'Santos'],
    ['Letícia', 'Rocha'], ['Gabriel', 'Nunes'], ['Marina', 'Pires'], ['Thiago', 'Barros'], ['Beatriz', 'Cardoso'],
    ['Felipe', 'Araújo'], ['Camila', 'Gomes'], ['Rodrigo', 'Carvalho'], ['Larissa', 'Mendonça'], ['Vinícius', 'Fagundes'],
  ];
  const produtos = ['Whey Protein 900g', 'Creatina 300g', 'Multivitamínico', 'Kit Hipertrofia', 'Pré-treino', 'Ômega 3'];
  const eventos = ['Abandono de carrinho', 'Pix Gerado', 'Compra Aprovada', 'Boleto Gerado', 'Compra Recusada'];
  const metodos = ['Pix', 'Cartão', 'Boleto'];
  const leadTags = [['tag_1'], ['tag_2'], ['tag_3', 'tag_6'], ['tag_4'], ['tag_1', 'tag_2'], ['tag_3'], ['tag_5']];
  return nomes.map((n, i) => {
    const ev = eventos[i % eventos.length];
    const valor = [149.9, 89.9, 320, 540, 67.5, 210][i % 6];
    return {
      id: 'l' + (i + 1),
      empresaId: 'emp_1',
      nome: n[0], sobrenome: n[1],
      email: `${n[0].toLowerCase()}.${n[1].toLowerCase()}@email.com`.normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
      telefone: `+55 ${11 + (i % 80)} 9${(8000 + i * 37) % 9999}-${(1000 + i * 53) % 9999}`,
      produto: produtos[i % produtos.length],
      valorCompra: valor,
      metodoPagamento: metodos[i % metodos.length],
      pixGerado: ev === 'Pix Gerado',
      ultimoEvento: ev,
      tags: leadTags[i % leadTags.length],
      criadoEm: `${(i % 27) + 1}/06/2026`,
      metricas: { enviados: (i % 5) + 1, aberturas: i % 4, cliques: i % 3 },
    };
  });
}
const leads = makeLeads();

// ---------------------------------------------------------------------------
// CAMPANHAS + FLUXO + ETAPAS + ESTATÍSTICAS — escopo Loja do João
// Card types (@TipoCardFluxo): Gatilho, Adicionar Tag, Remover Tag, Envio de e-mail, Acionar Fluxo
// ---------------------------------------------------------------------------
const campanhas = [
  {
    id: 'camp_1', empresaId: 'emp_1', nome: 'Recuperação de carrinho', status: 'Ativa', usaTemplate: true, templateId: 'tpl_1', criadorId: 'u_joao', criadoEm: '10/06/2026',
    stats: { taxaAbertura: 0.42, ctr: 0.18, emailsEnviados: 2840, vendasRecuperadas: 184, criticidade: 'Bom', valorCriticidade: 0.31, ultimoCalculo: '25/06/2026 06:00' },
    tagsMeta: ['tag_3'],
    fluxo: [
      { id: 'st_1', tipo: 'Gatilho', nome: 'Abandono de carrinho', posicao: 0, atraso: 0, config: { tipoEvento: 'Abandono de carrinho', webhookId: 'wh_1' } },
      { id: 'st_2', tipo: 'Adicionar Tag', nome: 'Marcar carrinho abandonado', posicao: 1, atraso: 0, config: { tags: ['tag_1'] } },
      { id: 'st_3', tipo: 'Envio de e-mail', nome: 'Lembrete 1', posicao: 2, atraso: 30, config: { emailId: 'em_1' } },
      { id: 'st_4', tipo: 'Envio de e-mail', nome: 'Última chance', posicao: 3, atraso: 1440, config: { emailId: 'em_2' } },
      { id: 'st_5', tipo: 'Remover Tag', nome: 'Limpar tag ao comprar', posicao: 4, atraso: 0, config: { tags: ['tag_1'] } },
    ],
  },
  {
    id: 'camp_2', empresaId: 'emp_1', nome: 'Pix gerado — lembrete', status: 'Pausada', usaTemplate: false, templateId: null, criadorId: 'u_joao', criadoEm: '02/06/2026',
    stats: { taxaAbertura: 0.55, ctr: 0.27, emailsEnviados: 980, vendasRecuperadas: 142, criticidade: 'Excelente', valorCriticidade: 0.52, ultimoCalculo: '25/06/2026 06:00' },
    tagsMeta: ['tag_3'],
    fluxo: [
      { id: 'st_6', tipo: 'Gatilho', nome: 'Pix gerado', posicao: 0, atraso: 0, config: { tipoEvento: 'Pix Gerado', webhookId: 'wh_1' } },
      { id: 'st_7', tipo: 'Adicionar Tag', nome: 'Marcar Pix pendente', posicao: 1, atraso: 0, config: { tags: ['tag_2'] } },
      { id: 'st_8', tipo: 'Envio de e-mail', nome: 'Lembrete Pix', posicao: 2, atraso: 15, config: { emailId: 'em_3' } },
    ],
  },
  {
    id: 'camp_3', empresaId: 'emp_1', nome: 'Pós-venda suplementos', status: 'Ativa', usaTemplate: true, templateId: 'tpl_2', criadorId: 'u_joao', criadoEm: '28/05/2026',
    stats: { taxaAbertura: 0.61, ctr: 0.22, emailsEnviados: 1520, vendasRecuperadas: 96, criticidade: 'Excelente', valorCriticidade: 0.48, ultimoCalculo: '25/06/2026 06:00' },
    tagsMeta: [],
    fluxo: [
      { id: 'st_9', tipo: 'Gatilho', nome: 'Compra aprovada', posicao: 0, atraso: 0, config: { tipoEvento: 'Compra Aprovada', webhookId: 'wh_1' } },
      { id: 'st_10', tipo: 'Adicionar Tag', nome: 'Marcar comprou', posicao: 1, atraso: 0, config: { tags: ['tag_3'] } },
      { id: 'st_11', tipo: 'Envio de e-mail', nome: 'Agradecimento', posicao: 2, atraso: 60, config: { emailId: 'em_4' } },
      { id: 'st_12', tipo: 'Acionar Fluxo', nome: 'Iniciar nutrição', posicao: 3, atraso: 4320, config: { fluxoAlvo: 'camp_4' } },
    ],
  },
  {
    id: 'camp_4', empresaId: 'emp_1', nome: 'Nutrição de leads', status: 'Rascunho', usaTemplate: true, templateId: 'tpl_5', criadorId: 'u_joao', criadoEm: '22/06/2026',
    stats: { taxaAbertura: 0, ctr: 0, emailsEnviados: 0, vendasRecuperadas: 0, criticidade: 'Não Iniciado', valorCriticidade: 0, ultimoCalculo: '—' },
    tagsMeta: [],
    fluxo: [
      { id: 'st_13', tipo: 'Gatilho', nome: 'Compra aprovada', posicao: 0, atraso: 0, config: { tipoEvento: 'Compra Aprovada', webhookId: 'wh_1' } },
    ],
  },
  {
    id: 'camp_5', empresaId: 'emp_1', nome: 'Cupom de desconto', status: 'Finalizada', usaTemplate: true, templateId: 'tpl_4', criadorId: 'u_joao', criadoEm: '15/05/2026',
    stats: { taxaAbertura: 0.38, ctr: 0.14, emailsEnviados: 3200, vendasRecuperadas: 71, criticidade: 'Mediano', valorCriticidade: 0.22, ultimoCalculo: '20/06/2026 06:00' },
    tagsMeta: ['tag_3'],
    fluxo: [
      { id: 'st_14', tipo: 'Gatilho', nome: 'Abandono de carrinho', posicao: 0, atraso: 0, config: { tipoEvento: 'Abandono de carrinho', webhookId: 'wh_2' } },
      { id: 'st_15', tipo: 'Envio de e-mail', nome: 'Cupom VOLTA10', posicao: 1, atraso: 120, config: { emailId: 'em_2' } },
    ],
  },
  {
    id: 'camp_6', empresaId: 'emp_1', nome: 'Boleto em aberto', status: 'Inativa', usaTemplate: false, templateId: null, criadorId: 'u_joao', criadoEm: '08/05/2026',
    stats: { taxaAbertura: 0.29, ctr: 0.09, emailsEnviados: 440, vendasRecuperadas: 12, criticidade: 'Crítico', valorCriticidade: 0.11, ultimoCalculo: '18/06/2026 06:00' },
    tagsMeta: ['tag_3'],
    fluxo: [
      { id: 'st_16', tipo: 'Gatilho', nome: 'Boleto gerado', posicao: 0, atraso: 0, config: { tipoEvento: 'Boleto Gerado', webhookId: 'wh_2' } },
      { id: 'st_17', tipo: 'Adicionar Tag', nome: 'Marcar boleto', posicao: 1, atraso: 0, config: { tags: ['tag_4'] } },
      { id: 'st_18', tipo: 'Envio de e-mail', nome: 'Lembrete boleto', posicao: 2, atraso: 720, config: { emailId: 'em_3' } },
    ],
  },
];

// Eventos recentes (WebhookDados) — timeline do dashboard
const webhookEvents = [
  { id: 'ev_1', empresaId: 'emp_1', provider: 'Hotmart', tipoEvento: 'Abandono de carrinho', email: 'ana.souza@email.com', produto: 'Whey Protein 900g', valor: 149.9, when: 'há 2 min', campanha: 'Recuperação de carrinho' },
  { id: 'ev_2', empresaId: 'emp_1', provider: 'Hotmart', tipoEvento: 'Pix Gerado', email: 'lucas.martins@email.com', produto: 'Kit Hipertrofia', valor: 540, when: 'há 6 min', campanha: 'Pix gerado — lembrete' },
  { id: 'ev_3', empresaId: 'emp_1', provider: 'Braip', tipoEvento: 'Compra Aprovada', email: 'carla.ribeiro@email.com', produto: 'Creatina 300g', valor: 89.9, when: 'há 11 min', campanha: 'Pós-venda suplementos' },
  { id: 'ev_4', empresaId: 'emp_1', provider: 'Hotmart', tipoEvento: 'Abandono de carrinho', email: 'pedro.alves@email.com', produto: 'Pré-treino', valor: 67.5, when: 'há 18 min', campanha: 'Recuperação de carrinho' },
  { id: 'ev_5', empresaId: 'emp_1', provider: 'Braip', tipoEvento: 'Boleto Gerado', email: 'julia.ferreira@email.com', produto: 'Multivitamínico', valor: 210, when: 'há 24 min', campanha: 'Boleto em aberto' },
  { id: 'ev_6', empresaId: 'emp_1', provider: 'Hotmart', tipoEvento: 'Compra Aprovada', email: 'bruno.lima@email.com', produto: 'Ômega 3', valor: 120, when: 'há 31 min', campanha: 'Pós-venda suplementos' },
];

// ---------------------------------------------------------------------------
// CHAMADOS (ConversaChat + MensagemChat)
// ---------------------------------------------------------------------------
const conversas = [
  {
    id: 'conv_1', clienteId: 'u_joao', clienteNome: 'João Mendes', empresa: 'Loja do João', tipo: 'Integração com a Plataforma', status: 'Em andamento', prioridade: 'Alta', atualizadoEm: 'há 5 min', assunto: 'Webhook da Hotmart não dispara',
    mensagens: [
      { id: 'msg_1', autor: 'cliente', nome: 'João Mendes', texto: 'Oi! Configurei o webhook da Hotmart mas os eventos de carrinho não estão chegando.', when: '09:12' },
      { id: 'msg_2', autor: 'suporte', nome: 'Marina (Suporte)', texto: 'Bom dia, João! Você marcou o webhook como "Testado"? Pode me enviar o secret usado?', when: '09:18' },
      { id: 'msg_3', autor: 'cliente', nome: 'João Mendes', texto: 'Testei sim. O secret é o whsec_8f2a91c0e4.', when: '09:21' },
    ],
  },
  {
    id: 'conv_2', clienteId: 'u_aurora', clienteNome: 'Aurora Lima', empresa: 'Cursos Aurora', tipo: 'Pagamento', status: 'Em andamento', prioridade: 'Média', atualizadoEm: 'há 1 h', assunto: 'Upgrade de plano para Scale',
    mensagens: [
      { id: 'msg_4', autor: 'cliente', nome: 'Aurora Lima', texto: 'Quero subir para o plano Scale. Como faço o upgrade?', when: '08:40' },
      { id: 'msg_5', autor: 'suporte', nome: 'Marina (Suporte)', texto: 'Posso gerar a cobrança proporcional agora mesmo. Confirma?', when: '08:52' },
    ],
  },
  {
    id: 'conv_3', clienteId: 'u_rafael', clienteNome: 'Rafael Tavares', empresa: 'Infinity Wear', tipo: 'Dúvidas', status: 'Resolvida', prioridade: 'Baixa', atualizadoEm: 'ontem', assunto: 'Como criar uma tag por evento',
    mensagens: [
      { id: 'msg_6', autor: 'cliente', nome: 'Rafael Tavares', texto: 'Como crio uma tag que dispara em "Compra Aprovada"?', when: 'ontem 16:02' },
      { id: 'msg_7', autor: 'suporte', nome: 'Marina (Suporte)', texto: 'Em Integrações > Tags, crie a tag e escolha o tipo de evento. Pronto!', when: 'ontem 16:20' },
      { id: 'msg_8', autor: 'cliente', nome: 'Rafael Tavares', texto: 'Perfeito, obrigado!', when: 'ontem 16:25' },
    ],
  },
];

// ---------------------------------------------------------------------------
// TRANSAÇÕES (cobrança)
// ---------------------------------------------------------------------------
const transacoes = [
  { id: 'tx_1', userId: 'u_joao', planoId: 'pl_2', valorPago: 197, formaPagamento: 'Cartão', status: 'Pago', idTransacao: 'pay_9f3a2c81', data: '01/06/2026' },
  { id: 'tx_2', userId: 'u_aurora', planoId: 'pl_3', valorPago: 397, formaPagamento: 'Pix', status: 'Pago', idTransacao: 'pay_2c81f3a9', data: '01/06/2026' },
  { id: 'tx_3', userId: 'u_marilia', planoId: 'pl_1', valorPago: 97, formaPagamento: 'Boleto', status: 'Pendente', idTransacao: 'pay_aa42b1c7', data: '03/06/2026' },
  { id: 'tx_4', userId: 'u_rafael', planoId: 'pl_2', valorPago: 197, formaPagamento: 'Cartão', status: 'Pagamento recusado', idTransacao: 'pay_55a1c2b3', data: '02/06/2026' },
  { id: 'tx_5', userId: 'u_joao', planoId: 'pl_2', valorPago: 197, formaPagamento: 'Cartão', status: 'Pago', idTransacao: 'pay_77b1e0aa', data: '01/05/2026' },
];

// ---------------------------------------------------------------------------
// HISTÓRICO DE ACESSO + SESSÕES (seguranca)
// ---------------------------------------------------------------------------
const historicoAcesso = [
  { id: 'ha_1', userId: 'u_joao', nome: 'João Mendes', ip: '189.45.12.88', local: 'Rio de Janeiro, BR', tipoLog: 'Login', when: '25/06 08:02' },
  { id: 'ha_2', userId: 'u_vitor', nome: 'Vitor Andrade', ip: '201.17.220.4', local: 'São Paulo, BR', tipoLog: 'Login', when: '25/06 09:14' },
  { id: 'ha_3', userId: 'u_aurora', nome: 'Aurora Lima', ip: '177.92.10.51', local: 'Belo Horizonte, BR', tipoLog: 'Login', when: '24/06 21:40' },
  { id: 'ha_4', userId: 'u_bruno', nome: 'Bruno Salles', ip: '187.33.4.120', local: 'Niterói, BR', tipoLog: 'Login falho', when: '24/06 18:11' },
  { id: 'ha_5', userId: 'u_rafael', nome: 'Rafael Tavares', ip: '191.5.88.32', local: 'Porto Alegre, BR', tipoLog: 'Login', when: '25/06 07:33' },
];
const sessoesAtivas = [
  { id: 'se_1', userId: 'u_joao', nome: 'João Mendes', dispositivo: 'Chrome · macOS', ip: '189.45.12.88', when: 'agora' },
  { id: 'se_2', userId: 'u_vitor', nome: 'Vitor Andrade', dispositivo: 'Safari · iOS', ip: '201.17.220.4', when: 'há 12 min' },
  { id: 'se_3', userId: 'u_aurora', nome: 'Aurora Lima', dispositivo: 'Edge · Windows', ip: '177.92.10.51', when: 'há 3 h' },
];

// FAQ (suporte)
const faq = [
  { q: 'Como conectar meu checkout (Hotmart/Braip)?', a: 'Em Integrações > Webhooks, crie um webhook, copie a URL e o secret e cole na plataforma de checkout.' },
  { q: 'Por que meus e-mails caem em spam?', a: 'Autentique seu domínio em Integrações > Domínios (DKIM/DMARC/CNAME via SendGrid) e aguarde a verificação.' },
  { q: 'O que é "criticidade" da campanha?', a: 'É um índice (0–1) calculado a partir de abertura, CTR e vendas recuperadas, classificado de Crítico a Excelente.' },
  { q: 'Como encerro um lead na campanha?', a: 'Defina as Tags-meta da campanha. Quando o lead recebe o evento correspondente, o fluxo é encerrado.' },
  { q: 'Atingi o limite de execuções do plano. E agora?', a: 'Os disparos pausam até a renovação do período ou upgrade de plano em Planos & cobrança.' },
];

// ---------------------------------------------------------------------------
// NAV + RBAC por papel
// ---------------------------------------------------------------------------
// Item de nav: { id, icon, label }. A visibilidade depende do papel.
// v2: Simplificado — foco em automação pura (Campanhas, Leads, Integrações, Perfil).
const NAV = {
  painel:       { id: 'painel',       icon: 'layout-dashboard', label: 'Dashboard' },
  pipeline:     { id: 'pipeline',     icon: 'kanban',           label: 'Pipeline' },
  campanhas:    { id: 'campanhas',    icon: 'megaphone',        label: 'Campanhas' },
  leads:        { id: 'leads',        icon: 'users-round',      label: 'Leads' },
  integracoes:  { id: 'integracoes',  icon: 'plug',             label: 'Integrações' },
  perfil:       { id: 'perfil',       icon: 'user-round',       label: 'Perfil' },
};

// Papéis: nav visível (em ordem), página inicial e capacidades.
const roles = {
  Cliente: {
    label: 'Cliente',
    descricao: 'Dono da conta — dashboard, pipeline, campanhas, leads, integrações.',
    nav: ['painel', 'pipeline', 'campanhas', 'leads', 'integracoes', 'perfil'],
    home: 'painel',
    can: { editCampaign: true, viewAllAccounts: false, createPlan: false, manageUsers: false, answerTickets: false },
  },
  Gestor: {
    label: 'Gestor',
    descricao: 'Agência — visão consolidada de várias contas.',
    nav: ['painel', 'pipeline', 'campanhas', 'leads', 'integracoes', 'perfil'],
    home: 'painel',
    can: { editCampaign: true, viewAllAccounts: true, createPlan: false, manageUsers: false, answerTickets: false },
  },
  Suporte: {
    label: 'Suporte',
    descricao: 'Atende chamados e chat de suporte.',
    nav: ['leads', 'perfil'],
    home: 'leads',
    can: { editCampaign: false, viewAllAccounts: true, createPlan: false, manageUsers: false, answerTickets: true },
  },
  Administrador: {
    label: 'Administrador',
    descricao: 'Plataforma — usuários, planos, segurança, auditoria.',
    nav: ['painel', 'pipeline', 'campanhas', 'leads', 'integracoes', 'perfil'],
    home: 'painel',
    can: { editCampaign: false, viewAllAccounts: true, createPlan: true, manageUsers: true, answerTickets: false },
  },
};

// Títulos de rota (topbar)
const routeTitle = {
  painel: 'Dashboard', pipeline: 'Pipeline', campanhas: 'Campanhas', leads: 'Leads', integracoes: 'Integrações', perfil: 'Perfil',
};

// ---------------------------------------------------------------------------
export const KoblyMockDB = {
  optionSets, eventTone, planos, empresas, users, sessionByRole, tags, templates,
  emails, dominios, webhooks, leads, campanhas, webhookEvents, conversas, transacoes,
  historicoAcesso, sessoesAtivas, faq, NAV, roles, routeTitle,

  // helpers de label
  channelIcon: { email: 'mail', SMS: 'smartphone', Whatsapp: 'message-circle' },
  cardIcon: { 'Gatilho': 'zap', 'Adicionar Tag': 'tag', 'Remover Tag': 'tag', 'Envio de e-mail': 'mail', 'Acionar Fluxo': 'git-branch' },
  cardTone: { 'Gatilho': 'info', 'Adicionar Tag': 'success', 'Remover Tag': 'danger', 'Envio de e-mail': 'warning', 'Acionar Fluxo': 'neutral' },
};
