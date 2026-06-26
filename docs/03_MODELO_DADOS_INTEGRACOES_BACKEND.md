# Kobly — Notas de Extração (Bubble)

App: **Kobly — Automação de Marketing**
URL editor: bubble.io/page?id=kobly

## Páginas Web (15)
1. index — contém grupos `g Login` e `g PrivacyPolicy` (login + política de privacidade)
2. campanhas
3. chamados
4. clientes
5. dashboard
6. integracao
7. leads
8. perfil
9. planos_cobrancas
10. relatorios_globais
11. seguranca
12. suporte
13. testes
14. reset_pw (reset de senha)
15. 404

## Reutilizáveis (12)
- abrir focos rg
- arrow focus rg
- DetalhesPlano
- EditarEtapaIcon
- EmptyState
- Header
- InfoLeads
- menu abrir cell rg
- Menu lateral
- PopupEditarPlano
- PopupNovoPlano
- StatusCampanha

## Integrações (API Connector) — captura inicial
- **Brevo** (email): Criar sender, Deletar Sender, Buscar senders, Enviar email, Autenticar domínio, Buscar domínio autenticado, Remover domínio, Verificar autenticação domínio, Verificação DMARC
- **n8n** (automação)

## Supabase conectado nesta sessão
- Projeto MCP: supabase_godoy_prime_2 (verificar relação com Kobly)

## Email infra
- **SendGrid** é o provedor real (DomíniosUsuário guarda DKIM/DMARC/CNAME e id_SendGrid; SendGridWebhook rastreia eventos; MétricasLead.CódigoSendgrid). API Connector também tinha labels "Brevo" — confirmar se é legado.
- **n8n** para roteamento/automação ("LogErrosRouter" sugere um Router via n8n).

## API CONNECTOR (detalhe)
**Coleção Sendgrid (8)** — base `https://api.sendgrid.com/v3`
- Autenticar domínio: POST /whitelist/domains (body: domain, automatic_security:true) — ex domain: kobly.com.br
- Buscar domínio autenticado: GET
- Remover domínio: DELETE
- Verificar autenticação domínio: POST
- Criar sender: POST
- Deletar Sender: DELETE
- Buscar senders: GET
- Enviar email: POST

**Verificação DMARC (1)**
- GoogleDNS: GET `https://dns.google/resolve?name=_dmarc.[url]&type=TXT` (consulta TXT DMARC)

**n8n (3)** — base `https://webhook.dizevolv.tech/webhook` (n8n self-hosted, provável no servidor Easypanel/Hostinger 2.25.177.23)
- GerarHTML: GET /generate_html (geração de HTML de email via IA)
- GerarSugestãoAI - Todas Campanhas: POST /suggestion-ai (param IdEstatísticas)
- GerarSugestãoAI - Campanha: POST /suggestion-ai
→ alimentam SugestãoCampanha / SugestãoTodasCampanhas e flags GerandoSugestão?

**Brevo (1)**
- Envio: POST `https://api.brevo.com/v3/smtp/email` (envio de email transacional)
→ SendGrid e Brevo coexistem para email — confirmar papel de cada (SendGrid p/ domínio+tracking, Brevo p/ envio?)

---
# DATA MODEL (27 tipos) — campos (campos @ = Option set; "List of" = lista)

### AgendamentosEtapa  (execução agendada de etapa de fluxo)
- Etapa → EtapaFluxo; IdAgendamento (text); Lead → Leads; Status → @StatusAgendamento; User; WebhookAtivador → WebhookDados

### Campanhas
- @StatusCampanha; Criador → User; Empresa; EstatísticasCampanha → EstatisticasCampanha; FluxoCampanha; Nome (text); Template → TemplatesProntos; UsaTemplate? (yes/no)

### ConversaChat  (suporte/chamados)
- @Prioridade → @PrioridadeChamado; @Status → @StatusChamado; @Tipo → @TipoChamado; Cliente → User; ID (text); Mensagens (List of MensagemChat); ÚltimaAtualização (date)

### Device  (sem campos custom)

### DomíniosUsuário  (autenticação de domínio SendGrid)
- dkim1/2Record_(host_name,status,type,value); dmarc_(host_name,status,type,value); id_SendGrid; mail_cname_(host,status,type,value); Url; UserCliente → User; Validado? (yes/no)

### EmailsUsuário  (template de email)
- Assunto; CorpoEmail; Domínio_Remetente → DomíniosUsuário; Remetente; Título

### Empresa  (multi-tenant)
- NomeEmpresa; UserFundador → User; UsuáriosEmpresa (List of User)

### EstatisticasCampanha
- Campanha; Empresa; EstatísticasDash → EstatísticasDashboard; GerandoSugestão? (yes/no); StatusCriticidade → @StatusCriticidade; TaxaAbertura; TaxaCliquesCTR; User; ValorCriticidade; VendasRecuperadas; ÚltimoCálculo (date)

### EstatísticasDashboard
- EstatísticasCampanhas (List); GerandoSugestão?; TaxaAberturaTodasCampanhas; TaxaCliquesCTRTodasCampanhas; TotalCampanhasAtivas; TotalContasGerenciadas; User; VendasRecuperadasTodasCampanhas; ÚltimoCálculoDate

### EtapaFluxo  (passo do fluxo de automação)
- @TipoCard → @TipoCardFluxo; AcionarFluxos (List of FluxoCampanha); Atraso (number); EmailEtapa → EmailsUsuário; FluxoCampanha; Nome; PosiçãoFluxo (number); TagsGatilhos (List of TagsUsuário); TagsParaAdicionar (List); TagsParaRemover (List)

### FluxoCampanha
- Campanha; Etapas (List of EtapaFluxo); TagsMeta (List of TagsUsuário)

### HistóricoAcesso  (log de acesso)
- IPConexão; Local; TipoLog; User

### Leads  (CRM)
- Email; Endereço; MétodoPagamento; Métricas → MétricasLead; Nome; PixGerado; Produto; Sobrenome; Tags (List of TagsUsuário); Telefone; User; ValorCompra (number)

### LogErrosRouter
- TipoErro (text)

### MensagemChat
- Arquivos (List of files); Conversa → ConversaChat; Mensagem; User

### MétricasLead
- CódigoSendgrid; EtapaEmailOrigem → EtapaFluxo; Lead; ListaInfoWebhook (List of SendGridWebhook); User

### Plano  (planos de assinatura)
- @Status → @StatusPlanos; Deleted? (yes/no); Descrição; Id (number); LimiteCampanhas; LimiteExecuções; Nome; ValorAnual; ValorMensal

### SendGridWebhook  (eventos de email)
- asm_group_id; attempt; Campanha; category; email; event; ip; MétricasLead; reason; response; sg_event_id; sg_message_id; smtp-id; status; timestamp; url; User; user_agent

### SugestãoCampanha  (sugestão IA por campanha)
- Estatísticas → EstatisticasCampanha; Sugestão (text)

### SugestãoTodasCampanhas  (sugestão IA global)
- Estatísticas → EstatísticasDashboard; Sugestão (text)

### TagsUsuário
- @TipoEvento → @TIpoEvento; Descrição; Nome; User

### TemplatesProntos
- @TipoTemplate; Descrição; NomeTemplate; Ícone_txt

### TransaçõesUsuários  (pagamentos)
- @StatusPagamento; FormaPagamento; ID_Transação; PlanoAssinado → Plano; User; ValorPago

### User
- @StatusUser; @TipoUserGeral; Celular; Criador → User; Curadoria (List of text); Empresa; EmpresasQueGerencia (List of Empresa); Estatísticas → EstatísticasDashboard; GestorResponsavel → User; ImagemPerfil (image); InfoPlano → UserInfoPlano; IPConexão; Local; Nome; PerfilCompleto? (yes/no); UltimoLogin (date)

### UserInfoPlano  (uso/limites do plano)
- NumeroExecuções; NúmeroCampanhas; Plano → Plano; User

### WebhookDados  (payload de webhook de e-commerce recebido)
- Campanha; data_criação (date); email; endereço_comprador; id_webhook; Lead; metodo_pagamento; nome_comprador; pix_gerado; produto; sobrenome_comprador; TagsAcionadoras (List of TagsUsuário); telefone; TipoEventoSistema → @TIpoEvento; User; valor_produto (number); Webhook → WebhooksUsuario

### WebhooksUsuario  (config de webhook do usuário)
- Desabilitado? (yes/no); Descrição; Nome; Payload (text); Secret; TagsUsuario (List); Testado? (yes/no); URL; User

---
# OPTION SETS (15)
- **@MétodoHTTPS**: GET, POST, DELETE, PATCH
- **@PrioridadeChamado**: Alta, Média, Baixa
- **@StatusAgendamento**: Iniciado, Em andamento, Encerrado por Meta, Finalizado
- **@StatusCampanha**: Ativa, Pausada, Finalizada, Inativa, Pendente
- **@StatusChamado**: Em andamento, Resolvida
- **@StatusCriticidade**: Crítico, Mediano, Bom, Excelente, Não Iniciado
- **@StatusPagamento**: Pago, Pendente, Pagamento recusado
- **@StatusPlanos**: Ativo, Inativo
- **@StatusUser**: Ativo, Desabilitado, Pendente
- **@TipoCardFluxo** (nós do construtor de fluxo): Adicionar Tag, Acionar Fluxo, Envio de e-mail, Gatilho, Remover Tag
- **@TipoChamado**: Dúvidas, Integração com a Plataforma, Pagamento, Erros
- **@TipoEnvio** (canais): email, SMS, Whatsapp
- **@TIpoEvento** (eventos e-commerce/webhook): Abandono de carrinho, Boleto Gerado, Compra cancelada, Depósito Solicitado, Pix Gerado, Chargeback, Cancelamento de Assinatura, Compra Reembolsada, Compra Aprovada, Compra Recusada
- **@TipoTemplate** (templates de campanha): Criar em Branco, Vender Curso, Abandono de Carrinho, Envio de oportunidade p/ Kobly CRM, Marcar Leads eCommerce como oportunidades, Marcar Leads eCommerce como vendas, Pré-inscrição de curso, Indique e Ganhe, Pós-venda, Cupom de Desconto, Resposta automática, Nutrição de Leads
- **@TipoUserGeral** (papéis): Gestor, Cliente, Suporte, Administrador

---
# PLUGINS INSTALADOS (~26)
Air Copy To Clipboard, AirAlert, Alert Toast Message Notify·BEP, Apex Chart Lite, **API Connector**, **Brevo (Formerly Sendinblue)**, Calendar & Timeslots Custom·BEP, Chart Element, Code Editor (HTML/JS), CSS Loading Animations, Custom Progress Bar, Draggable Elements, File & MultiFile Uploader·BEP, IP Geolocation, JSON Manipulator, JSON Pretty Printer, Multiselect Dropdown, OC Drag Move And Resize, Pan Zoom, Premium Charts Bundle - Chart JS, **SendGrid**, Switch (Toggle) And Checkbox, **Toolbox** (JS server/client), Unix Time Converter, Iconify Plus
(vários marcados "CAN UPGRADE")

---
# BACKEND WORKFLOWS (16) — todos prefixo "old_" (LEGADO; lógica nova migrada p/ n8n)
> Referência da lógica de negócio original. Triggers DB exigem plano com triggers ("This event type is only available on plans that support triggers").

## RodarCampanha — MOTOR DE EXECUÇÃO DE CAMPANHA (recursivo)
- **old_1-WebhookCriado** (trigger: WebhookDados criado): 1) Create Lead (se Search Leads count=0); 2/3) Make changes WebhookDados (liga ao Lead novo/existente); 4) Make changes UserInfoPlano (incrementa NumeroExecuções); 5) Terminate se NumeroExecuções > Plano.LimiteExecuções; 6/7) Schedule old_2-buscar_campanhas on a list
- **old_2-buscar_campanhas**: Schedule old_3-buscar_fluxo_campanha
- **old_3-buscar_fluxo_campanha**: Schedule old_4-ativar_etapas_fluxo (se Etapas count>0); Create AgendamentosEtapa
- **old_4-ativar_etapas_fluxo** (núcleo, recursivo por etapa): trata @TipoCard — Adicionar Tag (Make changes Leads), Remover Tag, Envio de e-mail (Sendgrid Enviar email + Create MétricasLead + update Lead), Acionar Fluxo (schedule recursivo + Create thing); cancela agendamentos quando TagsMeta∩TipoEventoSistema; agenda próxima etapa (Schedule old_4 on a list / Create AgendamentosEtapa). Usa Atraso/PosiçãoFluxo das etapas.

## Webhooks (receptor de e-commerce + SendGrid tracking)
- **old_koblydata** (Return data from API — endpoint público): Make changes WebhooksUsuario (se existe); Schedule old_criar_dados (se não); Return data
- **old_criar_dados**: Create WebhookDados (dispara old_1-WebhookCriado)
- **old_gerarsecret / old_get_webhook_secret**: gestão de secret do webhook (Return data from API)
- **old_dados-sendgrid**: Schedule old_processar-webhook-sendgrid on a list
- **old_processar-webhook-sendgrid**: Create SendGridWebhook; Make changes MétricasLead; Make changes SendGridWebhook (eventos de email → métricas)

## EstatísticasDashboard (analytics, recursivo)
- **old_calcularestatísticas** (param quant, recursivo n<quant): Make changes EstatisticasCampanha (taxas) + classifica StatusCriticidade por ValorCriticidade (≤0.15, ≤0.25, ≤0.4, >0.4); reschedule
- **old_CampanhaDesativada / old_CampanhaFicouAtiva** (trigger DB @StatusCampanha): atualiza EstatísticasDashboard (TotalCampanhasAtivas etc.), só p/ Cliente
- **old_EstatísticaCampanhaCriada** (trigger DB create): atualiza EstatísticasDashboard + UserInfoPlano
- **old_gerarsugestão**: chama n8n GerarSugestãoAI - Todas Campanhas

## OrganizarCampanha
- **old_organizar** (recursivo): Make changes EtapaFluxo (reordena PosiçãoFluxo); reschedule

---
# Pendências reais (o resto já está documentado)
> Workflows por página, elementos, plugins e backend workflows **já estão cobertos** neste doc e no `04_PAGINAS_WORKFLOWS.md`.

- [ ] **Exportar os fluxos do n8n** (`webhook.dizevolv.tech`) — a lógica viva roda fora do Bubble; os `old_*` são só referência.
- [ ] **Campos exatos de cada "Make changes"** e thresholds de criticidade (faixas ≤0.15/≤0.25/≤0.4/>0.4) — passada passo-a-passo no editor.
- [ ] **SendGrid vs. Brevo** — confirmar provedor de envio efetivo.
- [ ] **Settings do app**: Workflow API exposta (`exposes_wf_api`), idiomas, SEO, endpoints públicos.
- [ ] **Gateway de pagamento** — `TransaçõesUsuários` existe mas sem gateway no API Connector (Asaas é recomendação por analogia).

> ⚠️ **Multicanal é só e-mail no legado.** O option set `@TipoEnvio` lista email/SMS/WhatsApp, mas o app real só implementa **e-mail** (EmailsUsuário + SendGrid). Não há data type nem workflow de SMS/WhatsApp — tratar como roadmap, não como funcionalidade existente.
