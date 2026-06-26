-- 0009_seed_demo.sql
-- Kobly — SEED DEMO (idempotente). Espelha src/api/mockData.js fielmente.
-- UUIDs determinísticos: extensions.uuid_generate_v5(NS, 'kobly:'||<legacy_id>).
-- Todos os inserts usam `on conflict do nothing` -> a migration roda 2x sem erro.
-- auth_id dos profiles fica NULL (reconciliado no primeiro login por handle_new_user).
-- NÃO use uuid aleatório: toda referência é resolvida pelo id determinístico.
-- ---------------------------------------------------------------------------

-- Helper temporário: id determinístico a partir do legacy_id do mock.
-- Namespace fixo 'a0000000-0000-0000-0000-0000000000ff'.
create or replace function pg_temp.kid(legacy text)
returns uuid
language sql
immutable
as $$
  select extensions.uuid_generate_v5('a0000000-0000-0000-0000-0000000000ff'::uuid, 'kobly:' || legacy);
$$;

-- ===========================================================================
-- PLANS (pl_1..4)
-- ===========================================================================
insert into public.plans (id, nome, descricao, status, valor_mensal, valor_anual, limite_campanhas, limite_execucoes, deleted, legacy_id) values
  (pg_temp.kid('pl_1'), 'Starter', 'Para quem está começando a recuperar vendas.', 'Ativo',   97,  970,  3,  5000,   false, 'pl_1'),
  (pg_temp.kid('pl_2'), 'Pro',     'Operação multicampanha com automação completa.', 'Ativo',  197, 1970, 10, 25000,  false, 'pl_2'),
  (pg_temp.kid('pl_3'), 'Scale',   'Para agências e alto volume de eventos.', 'Ativo',         397, 3970, 50, 100000, false, 'pl_3'),
  (pg_temp.kid('pl_4'), 'Legado 2024', 'Plano antigo descontinuado.', 'Inativo',               67,  670,  2,  3000,   false, 'pl_4')
on conflict (id) do nothing;

-- ===========================================================================
-- TEMPLATES GLOBAIS (tpl_0..7) — organization_id NULL
-- ===========================================================================
insert into public.templates (id, tipo_template, nome, descricao, icone, blank, gatilho, is_global, organization_id, legacy_id) values
  (pg_temp.kid('tpl_0'), 'Criar em Branco',        'Criar em branco',       'Comece o fluxo do zero, sem etapas.',        'plus',                  true,  null,                   true, null, 'tpl_0'),
  (pg_temp.kid('tpl_1'), 'Abandono de Carrinho',   'Abandono de carrinho',  'Recupera carrinhos com cadência de e-mails.', 'shopping-cart',        false, 'Abandono de carrinho', true, null, 'tpl_1'),
  (pg_temp.kid('tpl_2'), 'Pós-venda',              'Pós-venda',             'Relacionamento após compra aprovada.',       'heart-handshake',       false, 'Compra Aprovada',      true, null, 'tpl_2'),
  (pg_temp.kid('tpl_3'), 'Vender Curso',           'Vender curso',          'Sequência de conversão para infoprodutos.',  'graduation-cap',        false, 'Pix Gerado',           true, null, 'tpl_3'),
  (pg_temp.kid('tpl_4'), 'Cupom de Desconto',      'Cupom de desconto',     'Oferta com código de desconto.',             'badge-percent',         false, 'Abandono de carrinho', true, null, 'tpl_4'),
  (pg_temp.kid('tpl_5'), 'Nutrição de Leads',      'Nutrição de leads',     'Aquece a base ao longo do tempo.',           'sprout',                false, 'Compra Aprovada',      true, null, 'tpl_5'),
  (pg_temp.kid('tpl_6'), 'Indique e Ganhe',        'Indique e ganhe',       'Campanha de indicação para clientes.',       'gift',                  false, 'Compra Aprovada',      true, null, 'tpl_6'),
  (pg_temp.kid('tpl_7'), 'Resposta automática',    'Resposta automática',   'Resposta imediata a um evento.',             'message-square-reply',  false, 'Pix Gerado',           true, null, 'tpl_7')
on conflict (id) do nothing;

-- ===========================================================================
-- ORGANIZATIONS (emp_1..4) — user_fundador_id setado depois dos profiles
-- ===========================================================================
insert into public.organizations (id, nome, segmento, plano_id, criticidade, leads_count, campanhas_ativas_count, legacy_id) values
  (pg_temp.kid('emp_1'), 'Loja do João',     'Suplementos', pg_temp.kid('pl_2'), 'Bom',       1842, 4, 'emp_1'),
  (pg_temp.kid('emp_2'), 'Cursos Aurora',    'Infoproduto', pg_temp.kid('pl_3'), 'Excelente', 5310, 7, 'emp_2'),
  (pg_temp.kid('emp_3'), 'Studio Marília',   'Beleza',      pg_temp.kid('pl_1'), 'Crítico',   318,  1, 'emp_3'),
  (pg_temp.kid('emp_4'), 'Infinity Wear',    'Moda',        pg_temp.kid('pl_2'), 'Mediano',   1290, 3, 'emp_4')
on conflict (id) do nothing;

-- ===========================================================================
-- PROFILES (u_*) — auth_id NULL; ultimo_login mapeado a timestamps reais
-- ===========================================================================
insert into public.profiles (id, auth_id, nome, email, tipo_user_geral, status_user, celular, local, ultimo_login, perfil_completo, organization_id, legacy_id) values
  (pg_temp.kid('u_vitor'),   null, 'Vitor Andrade',  'vitor@dizevolv.com',         'Gestor',        'Ativo',        '+55 11 99812-4455', 'São Paulo, BR',       '2026-06-25 09:14'::timestamptz, true,  null,                   'u_vitor'),
  (pg_temp.kid('u_joao'),    null, 'João Mendes',    'joao@lojadojoao.com.br',     'Cliente',       'Ativo',        '+55 21 99654-2210', 'Rio de Janeiro, BR',  '2026-06-25 08:02'::timestamptz, true,  pg_temp.kid('emp_1'),   'u_joao'),
  (pg_temp.kid('u_aurora'),  null, 'Aurora Lima',    'aurora@cursosaurora.com',    'Cliente',       'Ativo',        '+55 31 99877-1100', 'Belo Horizonte, BR',  '2026-06-24 21:40'::timestamptz, true,  pg_temp.kid('emp_2'),   'u_aurora'),
  (pg_temp.kid('u_marilia'), null, 'Marília Reis',   'marilia@studiomarilia.com',  'Cliente',       'Pendente',     '+55 41 99220-5566', 'Curitiba, BR',        '2026-06-20 11:25'::timestamptz, false, pg_temp.kid('emp_3'),   'u_marilia'),
  (pg_temp.kid('u_rafael'),  null, 'Rafael Tavares', 'rafael@infinitywear.com',    'Cliente',       'Ativo',        '+55 51 99431-8890', 'Porto Alegre, BR',    '2026-06-25 07:33'::timestamptz, true,  pg_temp.kid('emp_4'),   'u_rafael'),
  (pg_temp.kid('u_marina'),  null, 'Marina Costa',   'marina@kobly.com',           'Suporte',       'Ativo',        '+55 11 98123-7766', 'São Paulo, BR',       '2026-06-25 09:50'::timestamptz, true,  null,                   'u_marina'),
  (pg_temp.kid('u_daniela'), null, 'Daniela Rocha',  'daniela@kobly.com',          'Administrador', 'Ativo',        '+55 11 97712-3344', 'São Paulo, BR',       '2026-06-25 09:58'::timestamptz, true,  null,                   'u_daniela'),
  (pg_temp.kid('u_bruno'),   null, 'Bruno Salles',   'bruno@lojadojoao.com.br',    'Cliente',       'Desabilitado', '+55 21 99000-1212', 'Niterói, BR',         '2026-05-02 14:10'::timestamptz, true,  pg_temp.kid('emp_1'),   'u_bruno')
on conflict (id) do nothing;

-- Fundadores das orgs (depende dos profiles)
update public.organizations set user_fundador_id = pg_temp.kid('u_joao')    where id = pg_temp.kid('emp_1');
update public.organizations set user_fundador_id = pg_temp.kid('u_aurora')  where id = pg_temp.kid('emp_2');
update public.organizations set user_fundador_id = pg_temp.kid('u_marilia') where id = pg_temp.kid('emp_3');
update public.organizations set user_fundador_id = pg_temp.kid('u_rafael')  where id = pg_temp.kid('emp_4');

-- ===========================================================================
-- MEMBERSHIPS — Vitor (Gestor) gerencia emp_1..4
-- ===========================================================================
insert into public.organization_memberships (id, organization_id, profile_id, role) values
  (pg_temp.kid('mem_vitor_emp_1'), pg_temp.kid('emp_1'), pg_temp.kid('u_vitor'), 'Gestor'),
  (pg_temp.kid('mem_vitor_emp_2'), pg_temp.kid('emp_2'), pg_temp.kid('u_vitor'), 'Gestor'),
  (pg_temp.kid('mem_vitor_emp_3'), pg_temp.kid('emp_3'), pg_temp.kid('u_vitor'), 'Gestor'),
  (pg_temp.kid('mem_vitor_emp_4'), pg_temp.kid('emp_4'), pg_temp.kid('u_vitor'), 'Gestor')
on conflict (id) do nothing;

-- ===========================================================================
-- TAGS (tag_1..6) — escopo emp_1
-- ===========================================================================
insert into public.tags (id, organization_id, nome, descricao, tipo_evento, legacy_id) values
  (pg_temp.kid('tag_1'), pg_temp.kid('emp_1'), 'Carrinho abandonado', 'Iniciou checkout e não concluiu', 'Abandono de carrinho', 'tag_1'),
  (pg_temp.kid('tag_2'), pg_temp.kid('emp_1'), 'Pix pendente',        'Gerou Pix e não pagou',           'Pix Gerado',           'tag_2'),
  (pg_temp.kid('tag_3'), pg_temp.kid('emp_1'), 'Comprou',             'Compra aprovada',                 'Compra Aprovada',      'tag_3'),
  (pg_temp.kid('tag_4'), pg_temp.kid('emp_1'), 'Boleto em aberto',    'Gerou boleto sem pagamento',      'Boleto Gerado',        'tag_4'),
  (pg_temp.kid('tag_5'), pg_temp.kid('emp_1'), 'Reembolsado',         'Pediu reembolso',                 'Compra Reembolsada',   'tag_5'),
  (pg_temp.kid('tag_6'), pg_temp.kid('emp_1'), 'Cliente VIP',         'Mais de 3 compras',               'Compra Aprovada',      'tag_6')
on conflict (id) do nothing;

-- ===========================================================================
-- DOMAINS (dom_1, dom_2) + DNS RECORDS — escopo emp_1
-- ===========================================================================
insert into public.domains (id, organization_id, url, validado, id_sendgrid, legacy_id) values
  (pg_temp.kid('dom_1'), pg_temp.kid('emp_1'), 'lojadojoao.com.br',       true,  'sg_d_88213', 'dom_1'),
  (pg_temp.kid('dom_2'), pg_temp.kid('emp_1'), 'promo.lojadojoao.com.br', false, 'sg_d_88990', 'dom_2')
on conflict (id) do nothing;

insert into public.domain_dns_records (id, domain_id, tipo, host, valor, status, record_role) values
  (pg_temp.kid('dom_1_rec_0'), pg_temp.kid('dom_1'), 'CNAME', 'em1234.lojadojoao.com.br',            'u88213.wl.sendgrid.net',                       'verificado', 'mail_cname'),
  (pg_temp.kid('dom_1_rec_1'), pg_temp.kid('dom_1'), 'CNAME', 's1._domainkey.lojadojoao.com.br',     's1.domainkey.u88213.wl.sendgrid.net',          'verificado', 'dkim1'),
  (pg_temp.kid('dom_1_rec_2'), pg_temp.kid('dom_1'), 'CNAME', 's2._domainkey.lojadojoao.com.br',     's2.domainkey.u88213.wl.sendgrid.net',          'verificado', 'dkim2'),
  (pg_temp.kid('dom_1_rec_3'), pg_temp.kid('dom_1'), 'TXT',   '_dmarc.lojadojoao.com.br',            'v=DMARC1; p=none; rua=mailto:dmarc@lojadojoao.com.br', 'verificado', 'dmarc'),
  (pg_temp.kid('dom_2_rec_0'), pg_temp.kid('dom_2'), 'CNAME', 'em5566.promo.lojadojoao.com.br',      'u88990.wl.sendgrid.net',                       'pendente',   'mail_cname'),
  (pg_temp.kid('dom_2_rec_1'), pg_temp.kid('dom_2'), 'CNAME', 's1._domainkey.promo.lojadojoao.com.br','s1.domainkey.u88990.wl.sendgrid.net',         'pendente',   'dkim1'),
  (pg_temp.kid('dom_2_rec_2'), pg_temp.kid('dom_2'), 'TXT',   '_dmarc.promo.lojadojoao.com.br',      'v=DMARC1; p=quarantine;',                      'pendente',   'dmarc')
on conflict (id) do nothing;

-- ===========================================================================
-- EMAILS (em_1..4) — escopo emp_1, dominio dom_1
-- ===========================================================================
insert into public.emails (id, organization_id, titulo, assunto, corpo_html, remetente, dominio_id, legacy_id) values
  (pg_temp.kid('em_1'), pg_temp.kid('emp_1'), 'Carrinho — lembrete 1',     'Você esqueceu algo no carrinho 🛒',          '<h1>Ainda dá tempo!</h1><p>Seu carrinho continua reservado. Conclua a compra e ganhe frete grátis.</p>', 'João da Loja', pg_temp.kid('dom_1'), 'em_1'),
  (pg_temp.kid('em_2'), pg_temp.kid('emp_1'), 'Carrinho — última chance',  'Última chance: 10% OFF no seu pedido',        '<h1>Seu cupom expira hoje</h1><p>Use <b>VOLTA10</b> e finalize agora.</p>', 'João da Loja', pg_temp.kid('dom_1'), 'em_2'),
  (pg_temp.kid('em_3'), pg_temp.kid('emp_1'), 'Pix — lembrete',            'Seu Pix ainda está aguardando pagamento',     '<h1>Falta pouco</h1><p>Seu código Pix expira em breve. Pague para garantir o pedido.</p>', 'João da Loja', pg_temp.kid('dom_1'), 'em_3'),
  (pg_temp.kid('em_4'), pg_temp.kid('emp_1'), 'Pós-venda — obrigado',      'Obrigado pela compra! 💙',                    '<h1>Pedido confirmado</h1><p>Acompanhe a entrega e conheça produtos que combinam com o seu.</p>', 'João da Loja', pg_temp.kid('dom_1'), 'em_4')
on conflict (id) do nothing;

-- ===========================================================================
-- WEBHOOKS (wh_1..3) + WEBHOOK_EVENT_TYPES — escopo emp_1
-- ===========================================================================
insert into public.webhooks (id, organization_id, nome, descricao, url, secret, testado, desabilitado, legacy_id) values
  (pg_temp.kid('wh_1'), pg_temp.kid('emp_1'), 'Hotmart — checkout',      'Eventos de compra e carrinho da Hotmart', 'https://api.kobly.app/wh/emp_1/hotmart_9f3a2c81', 'whsec_8f2a91c0e4', true,  false, 'wh_1'),
  (pg_temp.kid('wh_2'), pg_temp.kid('emp_1'), 'Braip — checkout',        'Eventos da Braip',                        'https://api.kobly.app/wh/emp_1/braip_2c81f3a9',   'whsec_1b77e0aa42', true,  false, 'wh_2'),
  (pg_temp.kid('wh_3'), pg_temp.kid('emp_1'), 'Loja própria (Shopify)',  'Webhook custom da loja',                  'https://api.kobly.app/wh/emp_1/custom_aa42b1c7',  'whsec_55a1c2b3d4', false, true,  'wh_3')
on conflict (id) do nothing;

insert into public.webhook_event_types (webhook_id, tipo_evento) values
  (pg_temp.kid('wh_1'), 'Abandono de carrinho'),
  (pg_temp.kid('wh_1'), 'Pix Gerado'),
  (pg_temp.kid('wh_1'), 'Compra Aprovada'),
  (pg_temp.kid('wh_2'), 'Boleto Gerado'),
  (pg_temp.kid('wh_2'), 'Compra Aprovada'),
  (pg_temp.kid('wh_2'), 'Chargeback'),
  (pg_temp.kid('wh_3'), 'Compra Aprovada')
on conflict (webhook_id, tipo_evento) do nothing;

-- ===========================================================================
-- LEADS (l1..l20) — escopo emp_1 (espelha makeLeads())
-- ===========================================================================
insert into public.leads (id, organization_id, nome, sobrenome, email, telefone, produto, valor_compra, metodo_pagamento, pix_gerado, ultimo_evento, legacy_id)
select pg_temp.kid(v.legacy), pg_temp.kid('emp_1'), v.nome, v.sobrenome, v.email, v.telefone, v.produto, v.valor_compra, v.metodo_pagamento, v.pix_gerado, v.ultimo_evento::public.tipo_evento, v.legacy
from (values
  ('l1', 'Ana', 'Souza', 'ana.souza@email.com', '+55 11 98000-1000', 'Whey Protein 900g', 149.9, 'Pix', false, 'Abandono de carrinho'),
  ('l2', 'Lucas', 'Martins', 'lucas.martins@email.com', '+55 12 98037-1053', 'Creatina 300g', 89.9, 'Cartão', true, 'Pix Gerado'),
  ('l3', 'Carla', 'Ribeiro', 'carla.ribeiro@email.com', '+55 13 98074-1106', 'Multivitamínico', 320, 'Boleto', false, 'Compra Aprovada'),
  ('l4', 'Pedro', 'Alves', 'pedro.alves@email.com', '+55 14 98111-1159', 'Kit Hipertrofia', 540, 'Pix', false, 'Boleto Gerado'),
  ('l5', 'Júlia', 'Ferreira', 'julia.ferreira@email.com', '+55 15 98148-1212', 'Pré-treino', 67.5, 'Cartão', false, 'Compra Recusada'),
  ('l6', 'Bruno', 'Lima', 'bruno.lima@email.com', '+55 16 98185-1265', 'Ômega 3', 210, 'Boleto', false, 'Abandono de carrinho'),
  ('l7', 'Sofia', 'Dias', 'sofia.dias@email.com', '+55 17 98222-1318', 'Whey Protein 900g', 149.9, 'Pix', true, 'Pix Gerado'),
  ('l8', 'Rafael', 'Teixeira', 'rafael.teixeira@email.com', '+55 18 98259-1371', 'Creatina 300g', 89.9, 'Cartão', false, 'Compra Aprovada'),
  ('l9', 'Helena', 'Moraes', 'helena.moraes@email.com', '+55 19 98296-1424', 'Multivitamínico', 320, 'Boleto', false, 'Boleto Gerado'),
  ('l10', 'Diego', 'Santos', 'diego.santos@email.com', '+55 20 98333-1477', 'Kit Hipertrofia', 540, 'Pix', false, 'Compra Recusada'),
  ('l11', 'Letícia', 'Rocha', 'leticia.rocha@email.com', '+55 21 98370-1530', 'Pré-treino', 67.5, 'Cartão', false, 'Abandono de carrinho'),
  ('l12', 'Gabriel', 'Nunes', 'gabriel.nunes@email.com', '+55 22 98407-1583', 'Ômega 3', 210, 'Boleto', true, 'Pix Gerado'),
  ('l13', 'Marina', 'Pires', 'marina.pires@email.com', '+55 23 98444-1636', 'Whey Protein 900g', 149.9, 'Pix', false, 'Compra Aprovada'),
  ('l14', 'Thiago', 'Barros', 'thiago.barros@email.com', '+55 24 98481-1689', 'Creatina 300g', 89.9, 'Cartão', false, 'Boleto Gerado'),
  ('l15', 'Beatriz', 'Cardoso', 'beatriz.cardoso@email.com', '+55 25 98518-1742', 'Multivitamínico', 320, 'Boleto', false, 'Compra Recusada'),
  ('l16', 'Felipe', 'Araújo', 'felipe.araujo@email.com', '+55 26 98555-1795', 'Kit Hipertrofia', 540, 'Pix', false, 'Abandono de carrinho'),
  ('l17', 'Camila', 'Gomes', 'camila.gomes@email.com', '+55 27 98592-1848', 'Pré-treino', 67.5, 'Cartão', true, 'Pix Gerado'),
  ('l18', 'Rodrigo', 'Carvalho', 'rodrigo.carvalho@email.com', '+55 28 98629-1901', 'Ômega 3', 210, 'Boleto', false, 'Compra Aprovada'),
  ('l19', 'Larissa', 'Mendonça', 'larissa.mendonca@email.com', '+55 29 98666-1954', 'Whey Protein 900g', 149.9, 'Pix', false, 'Boleto Gerado'),
  ('l20', 'Vinícius', 'Fagundes', 'vinicius.fagundes@email.com', '+55 30 98703-2007', 'Creatina 300g', 89.9, 'Cartão', false, 'Compra Recusada')
) as v(legacy, nome, sobrenome, email, telefone, produto, valor_compra, metodo_pagamento, pix_gerado, ultimo_evento)
on conflict (id) do nothing;

-- LEAD_TAGS (espelha leadTags[i % len])
insert into public.lead_tags (lead_id, tag_id)
select pg_temp.kid(v.lead), pg_temp.kid(v.tag)
from (values
  ('l1','tag_1'),('l2','tag_2'),('l3','tag_3'),('l3','tag_6'),('l4','tag_4'),
  ('l5','tag_1'),('l5','tag_2'),('l6','tag_3'),('l7','tag_5'),('l8','tag_1'),
  ('l9','tag_2'),('l10','tag_3'),('l10','tag_6'),('l11','tag_4'),('l12','tag_1'),
  ('l12','tag_2'),('l13','tag_3'),('l14','tag_5'),('l15','tag_1'),('l16','tag_2'),
  ('l17','tag_3'),('l17','tag_6'),('l18','tag_4'),('l19','tag_1'),('l19','tag_2'),
  ('l20','tag_3')
) as v(lead, tag)
on conflict (lead_id, tag_id) do nothing;

-- LEAD_METRICS — espelha makeLeads(): enviados=(i%5)+1, aberturas=i%4, cliques=i%3
-- (i = 0..19). A UI de Leads (mockApi.listLeads) lê l.metricas.{enviados,aberturas,
-- cliques} para o painel de status de entrega; sem esta seed os totais ficam 0.
insert into public.lead_metrics (id, lead_id, organization_id, enviados, aberturas, cliques)
select pg_temp.kid('lm_'||v.lead), pg_temp.kid(v.lead), pg_temp.kid('emp_1'), v.env, v.ab, v.cl
from (values
  ('l1',1,0,0),('l2',2,1,1),('l3',3,2,2),('l4',4,3,0),('l5',5,0,1),
  ('l6',1,1,2),('l7',2,2,0),('l8',3,3,1),('l9',4,0,2),('l10',5,1,0),
  ('l11',1,2,1),('l12',2,3,2),('l13',3,0,0),('l14',4,1,1),('l15',5,2,2),
  ('l16',1,3,0),('l17',2,0,1),('l18',3,1,2),('l19',4,2,0),('l20',5,3,1)
) as v(lead, env, ab, cl)
on conflict (id) do nothing;

-- ===========================================================================
-- CAMPAIGNS (camp_1..6) + FLOWS + STEPS + STATS — escopo emp_1
-- ===========================================================================
insert into public.campaigns (id, organization_id, nome, status_campanha, usa_template, template_id, criador_id, legacy_id) values
  (pg_temp.kid('camp_1'), pg_temp.kid('emp_1'), 'Recuperação de carrinho', 'Ativa',      true,  pg_temp.kid('tpl_1'), pg_temp.kid('u_joao'), 'camp_1'),
  (pg_temp.kid('camp_2'), pg_temp.kid('emp_1'), 'Pix gerado — lembrete',   'Pausada',    false, null,                 pg_temp.kid('u_joao'), 'camp_2'),
  (pg_temp.kid('camp_3'), pg_temp.kid('emp_1'), 'Pós-venda suplementos',   'Ativa',      true,  pg_temp.kid('tpl_2'), pg_temp.kid('u_joao'), 'camp_3'),
  (pg_temp.kid('camp_4'), pg_temp.kid('emp_1'), 'Nutrição de leads',       'Rascunho',   true,  pg_temp.kid('tpl_5'), pg_temp.kid('u_joao'), 'camp_4'),
  (pg_temp.kid('camp_5'), pg_temp.kid('emp_1'), 'Cupom de desconto',       'Finalizada', true,  pg_temp.kid('tpl_4'), pg_temp.kid('u_joao'), 'camp_5'),
  (pg_temp.kid('camp_6'), pg_temp.kid('emp_1'), 'Boleto em aberto',        'Inativa',    false, null,                 pg_temp.kid('u_joao'), 'camp_6')
on conflict (id) do nothing;

-- campaign_flows (1:1) — id determinístico por 'flow_'||camp
insert into public.campaign_flows (id, campaign_id, organization_id) values
  (pg_temp.kid('flow_camp_1'), pg_temp.kid('camp_1'), pg_temp.kid('emp_1')),
  (pg_temp.kid('flow_camp_2'), pg_temp.kid('camp_2'), pg_temp.kid('emp_1')),
  (pg_temp.kid('flow_camp_3'), pg_temp.kid('camp_3'), pg_temp.kid('emp_1')),
  (pg_temp.kid('flow_camp_4'), pg_temp.kid('camp_4'), pg_temp.kid('emp_1')),
  (pg_temp.kid('flow_camp_5'), pg_temp.kid('camp_5'), pg_temp.kid('emp_1')),
  (pg_temp.kid('flow_camp_6'), pg_temp.kid('camp_6'), pg_temp.kid('emp_1'))
on conflict (id) do nothing;

-- flow_steps (st_1..st_18). email_id/tipo_evento/webhook_id/fluxo_alvo_id por config.
-- fluxo_alvo de st_12 aponta para o flow de camp_4 (Acionar Fluxo).
insert into public.flow_steps (id, flow_id, organization_id, tipo_card, nome, posicao, atraso, email_id, tipo_evento, webhook_id, fluxo_alvo_id, legacy_id) values
  -- camp_1
  (pg_temp.kid('st_1'),  pg_temp.kid('flow_camp_1'), pg_temp.kid('emp_1'), 'Gatilho',        'Abandono de carrinho',          0, 0,    null,                 'Abandono de carrinho', pg_temp.kid('wh_1'), null, 'st_1'),
  (pg_temp.kid('st_2'),  pg_temp.kid('flow_camp_1'), pg_temp.kid('emp_1'), 'Adicionar Tag',  'Marcar carrinho abandonado',    1, 0,    null,                 null,                   null,                null, 'st_2'),
  (pg_temp.kid('st_3'),  pg_temp.kid('flow_camp_1'), pg_temp.kid('emp_1'), 'Envio de e-mail','Lembrete 1',                    2, 30,   pg_temp.kid('em_1'),  null,                   null,                null, 'st_3'),
  (pg_temp.kid('st_4'),  pg_temp.kid('flow_camp_1'), pg_temp.kid('emp_1'), 'Envio de e-mail','Última chance',                 3, 1440, pg_temp.kid('em_2'),  null,                   null,                null, 'st_4'),
  (pg_temp.kid('st_5'),  pg_temp.kid('flow_camp_1'), pg_temp.kid('emp_1'), 'Remover Tag',    'Limpar tag ao comprar',         4, 0,    null,                 null,                   null,                null, 'st_5'),
  -- camp_2
  (pg_temp.kid('st_6'),  pg_temp.kid('flow_camp_2'), pg_temp.kid('emp_1'), 'Gatilho',        'Pix gerado',                    0, 0,    null,                 'Pix Gerado',           pg_temp.kid('wh_1'), null, 'st_6'),
  (pg_temp.kid('st_7'),  pg_temp.kid('flow_camp_2'), pg_temp.kid('emp_1'), 'Adicionar Tag',  'Marcar Pix pendente',           1, 0,    null,                 null,                   null,                null, 'st_7'),
  (pg_temp.kid('st_8'),  pg_temp.kid('flow_camp_2'), pg_temp.kid('emp_1'), 'Envio de e-mail','Lembrete Pix',                  2, 15,   pg_temp.kid('em_3'),  null,                   null,                null, 'st_8'),
  -- camp_3
  (pg_temp.kid('st_9'),  pg_temp.kid('flow_camp_3'), pg_temp.kid('emp_1'), 'Gatilho',        'Compra aprovada',               0, 0,    null,                 'Compra Aprovada',      pg_temp.kid('wh_1'), null, 'st_9'),
  (pg_temp.kid('st_10'), pg_temp.kid('flow_camp_3'), pg_temp.kid('emp_1'), 'Adicionar Tag',  'Marcar comprou',                1, 0,    null,                 null,                   null,                null, 'st_10'),
  (pg_temp.kid('st_11'), pg_temp.kid('flow_camp_3'), pg_temp.kid('emp_1'), 'Envio de e-mail','Agradecimento',                 2, 60,   pg_temp.kid('em_4'),  null,                   null,                null, 'st_11'),
  (pg_temp.kid('st_12'), pg_temp.kid('flow_camp_3'), pg_temp.kid('emp_1'), 'Acionar Fluxo',  'Iniciar nutrição',              3, 4320, null,                 null,                   null,                pg_temp.kid('flow_camp_4'), 'st_12'),
  -- camp_4
  (pg_temp.kid('st_13'), pg_temp.kid('flow_camp_4'), pg_temp.kid('emp_1'), 'Gatilho',        'Compra aprovada',               0, 0,    null,                 'Compra Aprovada',      pg_temp.kid('wh_1'), null, 'st_13'),
  -- camp_5
  (pg_temp.kid('st_14'), pg_temp.kid('flow_camp_5'), pg_temp.kid('emp_1'), 'Gatilho',        'Abandono de carrinho',          0, 0,    null,                 'Abandono de carrinho', pg_temp.kid('wh_2'), null, 'st_14'),
  (pg_temp.kid('st_15'), pg_temp.kid('flow_camp_5'), pg_temp.kid('emp_1'), 'Envio de e-mail','Cupom VOLTA10',                 1, 120,  pg_temp.kid('em_2'),  null,                   null,                null, 'st_15'),
  -- camp_6
  (pg_temp.kid('st_16'), pg_temp.kid('flow_camp_6'), pg_temp.kid('emp_1'), 'Gatilho',        'Boleto gerado',                 0, 0,    null,                 'Boleto Gerado',        pg_temp.kid('wh_2'), null, 'st_16'),
  (pg_temp.kid('st_17'), pg_temp.kid('flow_camp_6'), pg_temp.kid('emp_1'), 'Adicionar Tag',  'Marcar boleto',                 1, 0,    null,                 null,                   null,                null, 'st_17'),
  (pg_temp.kid('st_18'), pg_temp.kid('flow_camp_6'), pg_temp.kid('emp_1'), 'Envio de e-mail','Lembrete boleto',               2, 720,  pg_temp.kid('em_3'),  null,                   null,                null, 'st_18')
on conflict (id) do nothing;

-- step_add_tags (Adicionar Tag)
insert into public.step_add_tags (step_id, tag_id) values
  (pg_temp.kid('st_2'),  pg_temp.kid('tag_1')),
  (pg_temp.kid('st_7'),  pg_temp.kid('tag_2')),
  (pg_temp.kid('st_10'), pg_temp.kid('tag_3')),
  (pg_temp.kid('st_17'), pg_temp.kid('tag_4'))
on conflict (step_id, tag_id) do nothing;

-- step_remove_tags (Remover Tag)
insert into public.step_remove_tags (step_id, tag_id) values
  (pg_temp.kid('st_5'), pg_temp.kid('tag_1'))
on conflict (step_id, tag_id) do nothing;

-- flow_meta_tags (tagsMeta de cada campanha)
insert into public.flow_meta_tags (flow_id, tag_id) values
  (pg_temp.kid('flow_camp_1'), pg_temp.kid('tag_3')),
  (pg_temp.kid('flow_camp_2'), pg_temp.kid('tag_3')),
  (pg_temp.kid('flow_camp_5'), pg_temp.kid('tag_3')),
  (pg_temp.kid('flow_camp_6'), pg_temp.kid('tag_3'))
on conflict (flow_id, tag_id) do nothing;

-- campaign_stats (status_criticidade é setado pelo trigger classify_criticidade)
insert into public.campaign_stats (id, campaign_id, organization_id, taxa_abertura, ctr, emails_enviados, vendas_recuperadas, valor_criticidade, ultimo_calculo) values
  (pg_temp.kid('cstat_camp_1'), pg_temp.kid('camp_1'), pg_temp.kid('emp_1'), 0.42, 0.18, 2840, 184, 0.31, '2026-06-25 06:00'::timestamptz),
  (pg_temp.kid('cstat_camp_2'), pg_temp.kid('camp_2'), pg_temp.kid('emp_1'), 0.55, 0.27, 980,  142, 0.52, '2026-06-25 06:00'::timestamptz),
  (pg_temp.kid('cstat_camp_3'), pg_temp.kid('camp_3'), pg_temp.kid('emp_1'), 0.61, 0.22, 1520, 96,  0.48, '2026-06-25 06:00'::timestamptz),
  (pg_temp.kid('cstat_camp_4'), pg_temp.kid('camp_4'), pg_temp.kid('emp_1'), 0,    0,    0,    0,   0,    null),
  (pg_temp.kid('cstat_camp_5'), pg_temp.kid('camp_5'), pg_temp.kid('emp_1'), 0.38, 0.14, 3200, 71,  0.22, '2026-06-20 06:00'::timestamptz),
  (pg_temp.kid('cstat_camp_6'), pg_temp.kid('camp_6'), pg_temp.kid('emp_1'), 0.29, 0.09, 440,  12,  0.11, '2026-06-18 06:00'::timestamptz)
on conflict (id) do nothing;

-- ===========================================================================
-- WEBHOOK_EVENTS (ev_1..6) — escopo emp_1; campaign_id resolvido por nome
-- ===========================================================================
insert into public.webhook_events (id, organization_id, webhook_id, campaign_id, provider, tipo_evento, id_webhook, email, produto, valor_produto) values
  (pg_temp.kid('ev_1'), pg_temp.kid('emp_1'), pg_temp.kid('wh_1'), pg_temp.kid('camp_1'), 'Hotmart', 'Abandono de carrinho', 'ev_1', 'ana.souza@email.com',     'Whey Protein 900g', 149.9),
  (pg_temp.kid('ev_2'), pg_temp.kid('emp_1'), pg_temp.kid('wh_1'), pg_temp.kid('camp_2'), 'Hotmart', 'Pix Gerado',           'ev_2', 'lucas.martins@email.com', 'Kit Hipertrofia',   540),
  (pg_temp.kid('ev_3'), pg_temp.kid('emp_1'), pg_temp.kid('wh_2'), pg_temp.kid('camp_3'), 'Braip',   'Compra Aprovada',      'ev_3', 'carla.ribeiro@email.com', 'Creatina 300g',     89.9),
  (pg_temp.kid('ev_4'), pg_temp.kid('emp_1'), pg_temp.kid('wh_1'), pg_temp.kid('camp_1'), 'Hotmart', 'Abandono de carrinho', 'ev_4', 'pedro.alves@email.com',   'Pré-treino',        67.5),
  (pg_temp.kid('ev_5'), pg_temp.kid('emp_1'), pg_temp.kid('wh_2'), pg_temp.kid('camp_6'), 'Braip',   'Boleto Gerado',        'ev_5', 'julia.ferreira@email.com','Multivitamínico',   210),
  (pg_temp.kid('ev_6'), pg_temp.kid('emp_1'), pg_temp.kid('wh_1'), pg_temp.kid('camp_3'), 'Hotmart', 'Compra Aprovada',      'ev_6', 'bruno.lima@email.com',    'Ômega 3',           120)
on conflict (id) do nothing;

-- ===========================================================================
-- SUPPORT_CONVERSATIONS (conv_1..3) + MESSAGES (msg_1..8)
-- ===========================================================================
insert into public.support_conversations (id, organization_id, cliente_id, assigned_to, assunto, tipo_chamado, prioridade_chamado, status_chamado, legacy_id) values
  (pg_temp.kid('conv_1'), pg_temp.kid('emp_1'), pg_temp.kid('u_joao'),   pg_temp.kid('u_marina'), 'Webhook da Hotmart não dispara', 'Integração com a Plataforma', 'Alta',  'Em andamento', 'conv_1'),
  (pg_temp.kid('conv_2'), pg_temp.kid('emp_2'), pg_temp.kid('u_aurora'), pg_temp.kid('u_marina'), 'Upgrade de plano para Scale',    'Pagamento',                   'Média', 'Em andamento', 'conv_2'),
  (pg_temp.kid('conv_3'), pg_temp.kid('emp_4'), pg_temp.kid('u_rafael'), pg_temp.kid('u_marina'), 'Como criar uma tag por evento',  'Dúvidas',                     'Baixa', 'Resolvida',    'conv_3')
on conflict (id) do nothing;

insert into public.support_messages (id, conversation_id, autor, profile_id, nome, mensagem) values
  (pg_temp.kid('msg_1'), pg_temp.kid('conv_1'), 'cliente', pg_temp.kid('u_joao'),   'João Mendes',      'Oi! Configurei o webhook da Hotmart mas os eventos de carrinho não estão chegando.'),
  (pg_temp.kid('msg_2'), pg_temp.kid('conv_1'), 'suporte', pg_temp.kid('u_marina'), 'Marina (Suporte)', 'Bom dia, João! Você marcou o webhook como "Testado"? Pode me enviar o secret usado?'),
  (pg_temp.kid('msg_3'), pg_temp.kid('conv_1'), 'cliente', pg_temp.kid('u_joao'),   'João Mendes',      'Testei sim. O secret é o whsec_8f2a91c0e4.'),
  (pg_temp.kid('msg_4'), pg_temp.kid('conv_2'), 'cliente', pg_temp.kid('u_aurora'), 'Aurora Lima',      'Quero subir para o plano Scale. Como faço o upgrade?'),
  (pg_temp.kid('msg_5'), pg_temp.kid('conv_2'), 'suporte', pg_temp.kid('u_marina'), 'Marina (Suporte)', 'Posso gerar a cobrança proporcional agora mesmo. Confirma?'),
  (pg_temp.kid('msg_6'), pg_temp.kid('conv_3'), 'cliente', pg_temp.kid('u_rafael'), 'Rafael Tavares',   'Como crio uma tag que dispara em "Compra Aprovada"?'),
  (pg_temp.kid('msg_7'), pg_temp.kid('conv_3'), 'suporte', pg_temp.kid('u_marina'), 'Marina (Suporte)', 'Em Integrações > Tags, crie a tag e escolha o tipo de evento. Pronto!'),
  (pg_temp.kid('msg_8'), pg_temp.kid('conv_3'), 'cliente', pg_temp.kid('u_rafael'), 'Rafael Tavares',   'Perfeito, obrigado!')
on conflict (id) do nothing;

-- ===========================================================================
-- TRANSACTIONS (tx_1..5) — organization_id resolvido via profile.organization
-- ===========================================================================
insert into public.transactions (id, organization_id, profile_id, plano_id, valor_pago, forma_pagamento, status_pagamento, id_transacao, data, legacy_id) values
  (pg_temp.kid('tx_1'), pg_temp.kid('emp_1'), pg_temp.kid('u_joao'),    pg_temp.kid('pl_2'), 197, 'Cartão', 'Pago',               'pay_9f3a2c81', '2026-06-01', 'tx_1'),
  (pg_temp.kid('tx_2'), pg_temp.kid('emp_2'), pg_temp.kid('u_aurora'),  pg_temp.kid('pl_3'), 397, 'Pix',    'Pago',               'pay_2c81f3a9', '2026-06-01', 'tx_2'),
  (pg_temp.kid('tx_3'), pg_temp.kid('emp_3'), pg_temp.kid('u_marilia'), pg_temp.kid('pl_1'), 97,  'Boleto', 'Pendente',           'pay_aa42b1c7', '2026-06-03', 'tx_3'),
  (pg_temp.kid('tx_4'), pg_temp.kid('emp_4'), pg_temp.kid('u_rafael'),  pg_temp.kid('pl_2'), 197, 'Cartão', 'Pagamento recusado', 'pay_55a1c2b3', '2026-06-02', 'tx_4'),
  (pg_temp.kid('tx_5'), pg_temp.kid('emp_1'), pg_temp.kid('u_joao'),    pg_temp.kid('pl_2'), 197, 'Cartão', 'Pago',               'pay_77b1e0aa', '2026-05-01', 'tx_5')
on conflict (id) do nothing;

-- ===========================================================================
-- ACCESS_LOGS (ha_1..5)
-- ===========================================================================
insert into public.access_logs (id, profile_id, nome, ip_conexao, local, tipo_log) values
  (pg_temp.kid('ha_1'), pg_temp.kid('u_joao'),   'João Mendes',    '189.45.12.88'::inet, 'Rio de Janeiro, BR', 'Login'),
  (pg_temp.kid('ha_2'), pg_temp.kid('u_vitor'),  'Vitor Andrade',  '201.17.220.4'::inet, 'São Paulo, BR',      'Login'),
  (pg_temp.kid('ha_3'), pg_temp.kid('u_aurora'), 'Aurora Lima',    '177.92.10.51'::inet, 'Belo Horizonte, BR', 'Login'),
  (pg_temp.kid('ha_4'), pg_temp.kid('u_bruno'),  'Bruno Salles',   '187.33.4.120'::inet, 'Niterói, BR',        'Login falho'),
  (pg_temp.kid('ha_5'), pg_temp.kid('u_rafael'), 'Rafael Tavares', '191.5.88.32'::inet,  'Porto Alegre, BR',   'Login')
on conflict (id) do nothing;

-- ===========================================================================
-- ACTIVE_SESSIONS (se_1..3)
-- ===========================================================================
insert into public.active_sessions (id, profile_id, dispositivo, ip_conexao) values
  (pg_temp.kid('se_1'), pg_temp.kid('u_joao'),   'Chrome · macOS',  '189.45.12.88'::inet),
  (pg_temp.kid('se_2'), pg_temp.kid('u_vitor'),  'Safari · iOS',    '201.17.220.4'::inet),
  (pg_temp.kid('se_3'), pg_temp.kid('u_aurora'), 'Edge · Windows',  '177.92.10.51'::inet)
on conflict (id) do nothing;

-- ===========================================================================
-- FAQ (faq_1..5) — conteúdo global
-- ===========================================================================
insert into public.faq (id, pergunta, resposta, ordem, ativo) values
  (pg_temp.kid('faq_1'), 'Como conectar meu checkout (Hotmart/Braip)?', 'Em Integrações > Webhooks, crie um webhook, copie a URL e o secret e cole na plataforma de checkout.', 1, true),
  (pg_temp.kid('faq_2'), 'Por que meus e-mails caem em spam?',          'Autentique seu domínio em Integrações > Domínios (DKIM/DMARC/CNAME via SendGrid) e aguarde a verificação.', 2, true),
  (pg_temp.kid('faq_3'), 'O que é "criticidade" da campanha?',          'É um índice (0–1) calculado a partir de abertura, CTR e vendas recuperadas, classificado de Crítico a Excelente.', 3, true),
  (pg_temp.kid('faq_4'), 'Como encerro um lead na campanha?',           'Defina as Tags-meta da campanha. Quando o lead recebe o evento correspondente, o fluxo é encerrado.', 4, true),
  (pg_temp.kid('faq_5'), 'Atingi o limite de execuções do plano. E agora?', 'Os disparos pausam até a renovação do período ou upgrade de plano em Planos & cobrança.', 5, true)
on conflict (id) do nothing;

-- ===========================================================================
-- USAGE_COUNTERS — 1 por org (numero_campanhas espelha campanhas seedadas)
-- ===========================================================================
insert into public.usage_counters (id, organization_id, plano_id, numero_campanhas, numero_execucoes, periodo_inicio) values
  (pg_temp.kid('usage_emp_1'), pg_temp.kid('emp_1'), pg_temp.kid('pl_2'), 6, 14230, '2026-06-01')
on conflict (id) do nothing;
