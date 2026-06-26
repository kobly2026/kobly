# Kobly — Especificação Técnica (extraída do Bubble)

> Documento de referência do app **Kobly — Automação de Marketing** (Bubble app id `kobly`), produzido por engenharia reversa do editor Bubble para servir de base à reconstrução em **Next.js + Supabase**.
> Data da extração: 25/06/2026.

## 1. Visão geral do produto

Kobly é uma plataforma **SaaS de automação de marketing por e-mail** orientada a e-commerce. O fluxo central:

1. Eventos de e-commerce (compra aprovada, abandono de carrinho, pix gerado, etc.) chegam via **webhook**.
2. O webhook cria/atualiza um **Lead** e dispara a **execução de campanhas** (fluxos de automação).
3. Cada campanha tem um **fluxo** (FluxoCampanha) composto por **etapas** (EtapaFluxo) — cards de: Gatilho, Adicionar Tag, Remover Tag, Envio de e-mail, Acionar Fluxo.
4. E-mails são enviados (SendGrid/Brevo), eventos de e-mail são rastreados (aberturas, cliques), e **estatísticas** são calculadas (taxa de abertura, CTR, vendas recuperadas, criticidade).
5. Sugestões de melhoria são geradas por **IA** (via n8n).

### Papéis de usuário (`@TipoUserGeral`)
- **Cliente**: dono da conta — cria campanhas, fluxos, e-mails, vê leads e estatísticas próprias.
- **Gestor**: gerencia múltiplas contas de Clientes (agência) — dashboard consolidado, página `clientes`, relatórios globais.
- **Administrador**: gestão da plataforma — página `seguranca` (usuários/sessões/webhooks/histórico), cria planos.
- **Suporte**: atende chamados/chat de suporte.

### Stack atual (Bubble)
- Frontend + backend no Bubble (15 páginas web, 12 reusables, 16 backend workflows — todos legados `old_`).
- **Lógica de automação migrada para n8n** self-hosted (`webhook.dizevolv.tech`, provável servidor Easypanel/Hostinger `2.25.177.23`).
- E-mail: **SendGrid** (autenticação de domínio DKIM/DMARC/CNAME, envio, tracking via webhook) + **Brevo** (envio transacional — verificar papel).
- IA: n8n endpoints (`/suggestion-ai`, `/generate_html`).

---

## 2. Modelo de dados (27 tipos)

> Convenção: `→ X` = referência a outro tipo; `[X]` = lista de X; `@X` = option set. Campos built-in do Bubble (Creator, Created/Modified Date, Slug, unique id) omitidos salvo relevância. `User` é o tipo de usuário nativo do Bubble (auth).

### Núcleo de usuários & contas
**User** (auth)
- `@StatusUser`, `@TipoUserGeral`, Nome, Celular, Local, IPConexão, UltimoLogin (date), ImagemPerfil (image), PerfilCompleto? (bool)
- `Empresa → Empresa`, `EmpresasQueGerencia → [Empresa]`, `GestorResponsavel → User`, `Criador → User`
- `Estatísticas → EstatísticasDashboard`, `InfoPlano → UserInfoPlano`, `Curadoria → [text]`

**Empresa** — NomeEmpresa, `UserFundador → User`, `UsuáriosEmpresa → [User]`

**Plano** — Nome, Descrição, Id (num), `@Status (@StatusPlanos)`, ValorMensal, ValorAnual, LimiteCampanhas (num), LimiteExecuções (num), Deleted? (bool)

**UserInfoPlano** — `Plano → Plano`, `User → User`, NúmeroCampanhas (num), NumeroExecuções (num)  *(uso vs. limite)*

**TransaçõesUsuários** — `@StatusPagamento`, `PlanoAssinado → Plano`, `User → User`, ValorPago (num), FormaPagamento, ID_Transação

**HistóricoAcesso** — `User → User`, IPConexão, Local, TipoLog

### CRM / Leads / Tags
**Leads** — Nome, Sobrenome, Email, Telefone, Endereço, Produto, ValorCompra (num), MétodoPagamento, PixGerado, `Tags → [TagsUsuário]`, `Métricas → MétricasLead`, `User → User`

**TagsUsuário** — Nome, Descrição, `@TipoEvento (@TIpoEvento)`, `User → User`

**MétricasLead** — `Lead → Leads`, `EtapaEmailOrigem → EtapaFluxo`, CódigoSendgrid, `ListaInfoWebhook → [SendGridWebhook]`, `User → User`

### Campanhas & fluxos de automação
**Campanhas** — Nome, `@StatusCampanha`, `Criador → User`, `Empresa → Empresa`, `FluxoCampanha → FluxoCampanha`, `EstatísticasCampanha → EstatisticasCampanha`, `Template → TemplatesProntos`, UsaTemplate? (bool)

**FluxoCampanha** — `Campanha → Campanhas`, `Etapas → [EtapaFluxo]`, `TagsMeta → [TagsUsuário]`  *(TagsMeta = condição de encerramento da campanha p/ o lead)*

**EtapaFluxo** (nó do fluxo) — Nome, `@TipoCard (@TipoCardFluxo)`, PosiçãoFluxo (num), Atraso (num), `FluxoCampanha → FluxoCampanha`, `EmailEtapa → EmailsUsuário`, `AcionarFluxos → [FluxoCampanha]`, `TagsGatilhos → [TagsUsuário]`, `TagsParaAdicionar → [TagsUsuário]`, `TagsParaRemover → [TagsUsuário]`

**TemplatesProntos** — NomeTemplate, Descrição, `@TipoTemplate`, Ícone_txt

**AgendamentosEtapa** (execução agendada de etapa) — `Etapa → EtapaFluxo`, `Lead → Leads`, `Status (@StatusAgendamento)`, IdAgendamento, `WebhookAtivador → WebhookDados`, `User → User`

### E-mails & domínios
**EmailsUsuário** (template de e-mail) — Título, Assunto, CorpoEmail (text/HTML), Remetente, `Domínio_Remetente → DomíniosUsuário`

**DomíniosUsuário** (autenticação SendGrid) — Url, Validado? (bool), id_SendGrid, dkim1/2Record_(host_name/status/type/value), dmarc_(host_name/status/type/value), mail_cname_(host/status/type/value), `UserCliente → User`

### Webhooks (entrada e-commerce + SendGrid)
**WebhooksUsuario** (config de webhook do usuário) — Nome, Descrição, URL, Secret, Payload (text), Testado? (bool), Desabilitado? (bool), `TagsUsuario → [TagsUsuário]`, `User → User`

**WebhookDados** (evento recebido) — id_webhook, `TipoEventoSistema (@TIpoEvento)`, nome/sobrenome/email/telefone/endereço_comprador, produto, valor_produto (num), metodo_pagamento, pix_gerado, data_criação (date), `Campanha → Campanhas`, `Lead → Leads`, `Webhook → WebhooksUsuario`, `TagsAcionadoras → [TagsUsuário]`, `User → User`

**SendGridWebhook** (evento de e-mail) — event, email, timestamp, status, reason, response, category, ip, url, user_agent, attempt, sg_event_id, sg_message_id, smtp-id, asm_group_id, `Campanha → Campanhas`, `MétricasLead → MétricasLead`, `User → User`

### Estatísticas & IA
**EstatisticasCampanha** — `Campanha → Campanhas`, `Empresa → Empresa`, `EstatísticasDash → EstatísticasDashboard`, TaxaAbertura (num), TaxaCliquesCTR (num), VendasRecuperadas (num), ValorCriticidade (num), `StatusCriticidade (@StatusCriticidade)`, GerandoSugestão? (bool), ÚltimoCálculo (date), `User → User`

**EstatísticasDashboard** — `EstatísticasCampanhas → [EstatisticasCampanha]`, TotalCampanhasAtivas (num), TotalContasGerenciadas (num), TaxaAberturaTodasCampanhas (num), TaxaCliquesCTRTodasCampanhas (num), VendasRecuperadasTodasCampanhas (num), GerandoSugestão? (bool), ÚltimoCálculoDate (date), `User → User`

**SugestãoCampanha** — `Estatísticas → EstatisticasCampanha`, Sugestão (text)
**SugestãoTodasCampanhas** — `Estatísticas → EstatísticasDashboard`, Sugestão (text)

### Suporte (chat)
**ConversaChat** — ID, `Cliente → User`, `@Status (@StatusChamado)`, `@Prioridade (@PrioridadeChamado)`, `@Tipo (@TipoChamado)`, `Mensagens → [MensagemChat]`, ÚltimaAtualização (date)
**MensagemChat** — Mensagem, `Conversa → ConversaChat`, `Arquivos → [file]`, `User → User`

### Sistema
**LogErrosRouter** — TipoErro  *(log de erros do roteador/n8n)*
**Device** — (sem campos custom)

---

## 3. Option sets (15)

| Option set | Valores |
|---|---|
| @MétodoHTTPS | GET, POST, DELETE, PATCH |
| @PrioridadeChamado | Alta, Média, Baixa |
| @StatusAgendamento | Iniciado, Em andamento, Encerrado por Meta, Finalizado |
| @StatusCampanha | Ativa, Pausada, Finalizada, Inativa, Pendente |
| @StatusChamado | Em andamento, Resolvida |
| @StatusCriticidade | Crítico, Mediano, Bom, Excelente, Não Iniciado |
| @StatusPagamento | Pago, Pendente, Pagamento recusado |
| @StatusPlanos | Ativo, Inativo |
| @StatusUser | Ativo, Desabilitado, Pendente |
| @TipoCardFluxo | Adicionar Tag, Acionar Fluxo, Envio de e-mail, Gatilho, Remover Tag |
| @TipoChamado | Dúvidas, Integração com a Plataforma, Pagamento, Erros |
| @TipoEnvio | email, SMS, Whatsapp |
| @TIpoEvento | Abandono de carrinho, Boleto Gerado, Compra cancelada, Depósito Solicitado, Pix Gerado, Chargeback, Cancelamento de Assinatura, Compra Reembolsada, Compra Aprovada, Compra Recusada |
| @TipoTemplate | Criar em Branco, Vender Curso, Abandono de Carrinho, Envio de oportunidade p/ Kobly CRM, Marcar Leads eCommerce como oportunidades, Marcar Leads eCommerce como vendas, Pré-inscrição de curso, Indique e Ganhe, Pós-venda, Cupom de Desconto, Resposta automática, Nutrição de Leads |
| @TipoUserGeral | Gestor, Cliente, Suporte, Administrador |

---

## 4. Páginas (front-end) — 15 páginas + 12 reusables

Header global (logo Kobly + Current User) e overlay **Menu lateral** presentes nas páginas internas.

### index — Login / Cadastro / Privacidade / Curadoria (40 workflows)
Porta de entrada. Login (`Botão Login` → Log the user in → cria HistóricoAcesso → redireciona: dashboard se ≠ Administrador, **seguranca** se Administrador), login Google, cadastro (`BotãoContinuarCadastro`), política de privacidade (g PrivacyPolicy), e "curadoria" (onboarding com ~31 cards de seleção em ClickArea). Tratamento de erro de login (TriggerErro).

### dashboard — Analytics / visão consolidada (22 workflows)
Painel de métricas: taxa de abertura, CTR, total de e-mails enviados, vendas recuperadas, criticidade. Seletor de campanha (Dropdown SelecioneCampanha), calendário de filtro (Focus calendar), sugestões IA (MostrarSugestãoCampanhaDropdown / MostrarSugestãoGestor). On-load recalcula stats se `Current date -1 ≷ Estatísticas.ÚltimoCálculoDate`. Gestor: "todas as contas" / relatório por conta (param URL `conta`).

### campanhas — CORE: gestão de campanha + construtor de fluxo + criador de e-mail (47 workflows)
Página central:
- **ConstrutorFluxo (17)**: construtor visual drag-drop. `DropArea Top has a group dropped` (arrasta card p/ o fluxo); cards de tipo @TipoCardFluxo (Gatilho, Adicionar/Remover Tag, Envio de e-mail, Acionar Fluxo); `Switch AtivarFluxo changed` (ativa fluxo); expandir/colapsar cards; toggle de tags em PopupDefinirMetaCampanha.
- **CriarCampanha (4)**: criar campanha + popup cadastro de domínio.
- **CriarEmail (11)**: editor de e-mail com **geração de HTML por IA** (TriggerAtualizarHTML → n8n `/generate_html`; toggle MostrarHTML? preview), CodeEditor, enviar e-mail de teste.
- **GF Email (7)**: abrir/editar/excluir e-mails.
- **Templates (2)**: aplicar TemplatesProntos.

### leads — Lista de leads / CRM (4 workflows)
RG paginado de Leads (paginação client-side), filtro (BuscaEventos), clique na linha abre detalhe (reusable InfoLeads).

### clientes — Gestor: gerenciar contas (7 workflows)
Gestor lista/cria/edita contas (Cliente = User + Empresa + DomíniosUsuário). `Botão Salvar` → Make changes User + Empresa + DomíniosUsuário. Popup CriarConta.

### integracao — CORE: hub de integrações (51 workflows)
- **Domínios (6)**: cadastrar domínio SendGrid, exibir registros DNS, `Verificar-DMARC` (GoogleDNS).
- **CopiarCampos (17)**: botões copiar registros DNS p/ clipboard (DKIM/DMARC/CNAME) via Air Copy.
- **Webhooks (7)**: criar/editar/excluir WebhooksUsuario (secret).
- **Tags (3)**: criar/selecionar TagsUsuário por @TIpoEvento.
- **Api**: configuração de API.

### perfil — Perfil + meu plano (8 workflows)
Editar perfil (g Perfil) e ver plano (g Plano). Popup criar nova conta.

### planos_cobrancas — Planos & cobrança (3 workflows)
Criar plano (Admin, PopupNovoPlano/PopupEditarPlano), planos ativos, histórico de cobrança (TransaçõesUsuários). Reusables DetalhesPlano.

### chamados — Chat de suporte (11 workflows)
Conversa de suporte (ConversaChat/MensagemChat) — enviar mensagens com anexos (File&Multifile). Aberto via param URL.

### suporte — Central de ajuda / FAQ (4 workflows)
FAQ, vídeos tutoriais, sugestões da IA. Majoritariamente estático.

### seguranca — Painel ADMIN (21 workflows)
Destino do login Administrador. Gerenciar usuários (ativar/desabilitar @StatusUser, encerrar sessões), gerenciar webhooks, histórico de acesso (HistóricoAcesso), sessões ativas.

### relatorios_globais — Relatórios consolidados (0 workflows)
Exibição/WIP. Consome EstatísticasDashboard/EstatisticasCampanha agregados.

### reset_pw (1) — redefinir senha · testes (0) — sandbox dev (ignorar) · 404 — erro padrão

### Reusables (12)
Header, Menu lateral, InfoLeads (detalhe de Lead), StatusCampanha (badge), DetalhesPlano, PopupNovoPlano, PopupEditarPlano, EmptyState, EditarEtapaIcon (edição de etapa no construtor), abrir focos rg / arrow focus rg / menu abrir cell rg (auxiliares de repeating groups).

---

## 5. Integrações externas

### API Connector (Bubble)
**SendGrid** (`https://api.sendgrid.com/v3`) — 8 chamadas: Autenticar domínio (`POST /whitelist/domains`, body `{domain, automatic_security:true}`), Buscar/Remover/Verificar domínio, Criar/Deletar/Buscar sender, Enviar e-mail.
**GoogleDNS** (`GET https://dns.google/resolve?name=_dmarc.[url]&type=TXT`) — verificação DMARC.
**n8n** (`https://webhook.dizevolv.tech/webhook`) — `GET /generate_html` (geração de HTML de e-mail por IA), `POST /suggestion-ai` (sugestões IA por campanha e p/ todas as campanhas, param IdEstatísticas).
**Brevo** (`POST https://api.brevo.com/v3/smtp/email`) — envio de e-mail transacional.

> ⚠️ SendGrid e Brevo coexistem para e-mail — confirmar qual é o provedor de envio efetivo (hipótese: SendGrid p/ autenticação de domínio + tracking; Brevo p/ envio). Resolver na migração.

### Plugins instalados (~26)
API Connector, Brevo, SendGrid, Toolbox (JS server/client), Air Copy To Clipboard, AirAlert, Alert Toast Notify, Apex Chart Lite / Chart Element / Premium Charts (Chart JS), Calendar & Timeslots, Code Editor, CSS Loading Animations, Custom Progress Bar, Draggable Elements (construtor de fluxo), File & MultiFile Uploader, IP Geolocation, JSON Manipulator, JSON Pretty Printer, Multiselect Dropdown, OC Drag Move And Resize, Pan Zoom, Switch/Checkbox, Unix Time Converter, Iconify Plus.

---

## 6. Backend / motor de automação (REFERÊNCIA — legado)

> Os 16 backend workflows do Bubble estão **todos prefixados `old_`** (legados). A lógica nova roda em **n8n** (`webhook.dizevolv.tech`). Os `old_` documentam a lógica de negócio original e devem ser reimplementados no backend novo (Supabase Edge Functions / Next.js API + fila/cron). **Os fluxos n8n vivem fora do Bubble e precisam ser extraídos separadamente do servidor n8n.**

### Motor de execução de campanha (RodarCampanha)
1. **old_1-WebhookCriado** (trigger: WebhookDados criado) → cria Lead se não existir; vincula WebhookDados ao Lead; incrementa `UserInfoPlano.NumeroExecuções`; **encerra se exceder `Plano.LimiteExecuções`**; agenda `old_2`.
2. **old_2-buscar_campanhas** → agenda `old_3`.
3. **old_3-buscar_fluxo_campanha** → agenda `old_4` (se Etapas>0); cria AgendamentosEtapa.
4. **old_4-ativar_etapas_fluxo** (recursivo, núcleo) — para cada etapa, conforme `@TipoCardFluxo`:
   - *Adicionar/Remover Tag* → Make changes Leads.Tags
   - *Envio de e-mail* → SendGrid Enviar e-mail + cria MétricasLead + atualiza Lead
   - *Acionar Fluxo* → agenda recursivamente os AcionarFluxos
   - Encerra o lead na campanha quando `FluxoCampanha.TagsMeta ∩ webhook.TipoEventoSistema` (meta atingida) → cancela agendamentos
   - Respeita `Atraso`/`PosiçãoFluxo`; agenda próxima etapa.

### Webhooks
- **old_koblydata** (endpoint público, Return data from API) → valida WebhooksUsuario; agenda `old_criar_dados`.
- **old_criar_dados** → cria WebhookDados (dispara o motor).
- **old_gerarsecret / old_get_webhook_secret** → gestão de secret de webhook.
- **old_dados-sendgrid / old_processar-webhook-sendgrid** → recebe eventos SendGrid → cria SendGridWebhook + atualiza MétricasLead.

### Estatísticas
- **old_calcularestatísticas** (recursivo, param quant) → calcula taxas e classifica `StatusCriticidade` por `ValorCriticidade` (faixas ≤0.15, ≤0.25, ≤0.4, >0.4).
- **old_CampanhaDesativada / old_CampanhaFicouAtiva** (trigger DB @StatusCampanha) → atualiza EstatísticasDashboard.
- **old_EstatísticaCampanhaCriada** → atualiza EstatísticasDashboard + UserInfoPlano.
- **old_gerarsugestão** → chama n8n `/suggestion-ai`.
- **old_organizar** (recursivo) → reordena PosiçãoFluxo das etapas.

> Triggers de banco do Bubble exigem plano pago com suporte a triggers (aviso "only available on plans that support triggers" presente em vários) — outra razão da migração da lógica p/ n8n.
