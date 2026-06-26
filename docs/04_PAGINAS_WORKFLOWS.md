# Kobly — Front-end (páginas) — Notas de Extração

Abordagem: por página → layout/propósito + workflows (eventos → ações). Elementos-chave inferidos dos workflows e screenshots. (Árvores de elementos têm muitos nós repetitivos de baixo valor, ex. células de calendário, então o foco é estrutura significativa + lógica.)

Header global (todas as páginas internas): logo "Kobly / Automação de Marketing" + "Current User's Nome" + "@TipoUserGeral". Overlay "Menu lateral" (reusable) e "G Nave bar" presentes nas páginas internas.

---

## index (login / cadastro / privacidade / curadoria)
**Propósito:** porta de entrada — login, cadastro, política de privacidade, e "curadoria" (onboarding/seleção de interesses com vários cards).
**Grupos:** g Login, g PrivacyPolicy.
**Workflows (40):**
- Login: `Botão Login is clicked` → 1) Log the user in; 2) Create HistóricoAcesso; 3) Go to page dashboard (se @TipoUserGeral ≠ Administrador); 4) Go to page seguranca (se Administrador)
- Login: `PossuConta? is clicked` (toggle login/cadastro)
- LoginGoogle: `Botão login google is clicked`
- Cadastro: `BotãoContinuarCadastro is clicked`; `Text Ao me cadastrar copy is clicked`
- Navegação: `Botão Voltar is clicked`; `Termos is clicked`
- ClickArea (31): seleção de curadoria — vários `Botão UX design (copy 5) is clicked` (cards de seleção) + `Botão entrar curadoria is clicked`
- TriggerErro (2): `Botão Login has an error running a workflow`; `EventoErro` (tratamento de erro de login)

---

## dashboard (analytics / visão consolidada)
**Propósito:** painel de métricas do usuário/Cliente — taxas (abertura, CTR), emails enviados, vendas recuperadas; seletor de campanha; calendário de filtro; sugestão IA; visão consolidada de "todas as contas" (para Gestor).
**Overlays:** menu lateral, Focus calendar (calendário c/ navegação de mês, CalendarMonth), G Nave bar.
**Data:** Current User's Estatísticas (EstatísticasDashboard), Campanhas, EstatisticasCampanha. Param de URL `conta` (Gestor vê relatório por conta).
**Workflows (22):**
- *Calendário (Uncategorized 5):* Group date clicked; Icon avançar/voltar mes; Icon calendar; Icon deletar data
- *EstatísticasUser (9):* Dropdown SelecioneCampanha value changed (x2 — recalcula/mostra stats da campanha); Page is loaded (quando @TipoUserGeral=Cliente); Just once on load → recalcula se `Current date -1 ≷ Estatísticas.ÚltimoCálculoDate`, ou `Search Campanhas count is 0`, ou `Get conta from page URL`; MostrarSugestãoCampanhaDropdown; MostrarSugestãoGestor (exibe sugestões IA)
- *G resumo de resultado (4):* abrir detalhe de CTR / taxa de abertura média / total de emails enviados / vendas recuperadas (KPI cards)
- *Grupo Inicial Visão consolidada (1):* Botão todas as contas clicked (Gestor)
- *Works breadcrumb dash (2):* Step 1/Step 2 clicked (navegação breadcrumb)
- *Works G todas as contas (1):* botão abrir relatorio da conta clicked

---

## campanhas (CORE — gestão de campanha + construtor de fluxo + criador de email)
**Propósito:** página central. Criar/editar campanhas, montar o fluxo de automação (drag-drop de cards: Gatilho, Adicionar/Remover Tag, Envio de e-mail, Acionar Fluxo), criar e-mails (com geração de HTML por IA via n8n), aplicar templates, definir metas/tags.
**Data:** Campanhas, FluxoCampanha, EtapaFluxo, TagsUsuário, EmailsUsuário, TemplatesProntos, DomíniosUsuário. Usa option set @TipoCardFluxo.
**Workflows (47):**
- *Breadcrumbs (3):* TXT empresa xpto; TXT Go to Fluxo; Icon ar (navegação)
- *CarregamentoPagina:* (page load)
- *ConstrutorFluxo (17) — construtor visual de fluxo:* `DropArea Top has a group dropped on it` (drag-drop de card no fluxo); `Botão CriarAdicionarTag`; `Button Definir Tags`; `Button Ver detalhes` (expande/colapsa card — condição g ConstrutorFluxo Expandir contém/não EtapaFluxo); `g AdicionarTag`; `g CardFluxoVazioCriarEmail`; `g Cell clicked` (toggle tag em PopupDefinirMetaCampanha.TagsParaAdicionar — contém/não contém); `g Cell Tipo`; `g Gatilho`; `IconEscolherCard`; `IconifyIcon ExpandirCard`; `Switch AtivarFluxo changed` (ativa/desativa fluxo); Every time condition
- *CriarCampanha (4):* `Botão CriarCampanha clicked` (x3 — variações por condição); `fechar pop cadastro de dominio`
- *CriarEmail (11) — editor de e-mail c/ IA:* `Botão CriarEmail` (EmailsUsuário vazio/não); `Botão CancelarEmail`; `botão dashboard menu lateral` (condições G Descreva+AI MostrarHTML? yes/no — alterna preview HTML); `ButtonEmailTeste` (enviar email teste); `CodeEditor A content updated`; `TriggerAtualizarHTML` (gera/atualiza HTML via n8n GerarHTML); `IconifyIcon I`
- *EventosErrosSucesso (2):* EventoErro; EventoSucesso
- *GF Email (7):* abrir/editar email (`g AbriTelaEmail`, `Group EmailsUsuário clicked`); excluir email (`ButtonExcluirEmail`, confirmação, `Icon tra`); fechar popups
- *Templates (2):* `g Template clicked` (aplica template); `TXT Go to Fluxo copy`

---

## leads (lista de leads — CRM)
**Propósito:** listagem paginada de Leads, com filtro (BuscaEventos) e clique na linha para detalhe (reusable InfoLeads).
**Data:** Leads (RG_Leads), paginação client-side (g Paginator com PageSelecionada).
**Workflows (4):**
- `Page is loaded` → Set state BuscaEventos (init filtro)
- `g Cell is clicked` → Go to page of RG_Leads + Set state PageSelecionada
- `IconifyIcon Left/Right clicked` → paginação (Set state PageSelecionada, limites 1..count)

---

## clientes (Gestor: gerenciar contas de clientes)
**Propósito:** Gestor lista/cria/edita "contas" (Cliente = User + Empresa + Domínio). Popup CriarConta.
**Data:** User, Empresa, DomíniosUsuário.
**Workflows (7):**
- *EditarUser:* `Botão Salvar` → Make changes User; Make changes Empresa; Make changes DomíniosUsuário (x2)
- *Navegação (3):* `TXT Todas as contas` → Go to current page (reset); `Botão Cadastrar nova conta` (cria conta/abre); `Botão Cancelar`
- *Pop conta nova (2):* `Botão Cadastrar nova conta` → Animate Popup CriarConta; `Icon Close` → fecha popup
- *EventosErroSucesso:* EventoSucesso

---

## integracao (CORE — hub de integrações: domínios, webhooks, API, tags)
**Propósito:** configurar domínios de envio (SendGrid: cadastrar domínio, ver registros DNS DKIM/DMARC/CNAME, copiar p/ área de transferência, verificar DMARC), webhooks de entrada (WebhooksUsuario: criar/editar/excluir, secret), config de API, e tags (TagsUsuário por @TIpoEvento).
**Data:** DomíniosUsuário, WebhooksUsuario, TagsUsuário. Integrações: SendGrid (Autenticar/Verificar domínio), GoogleDNS (DMARC).
**Workflows (51):**
- *Uncategorized (7):* TXT Todos os domínios; Botão Domínios; botão drop cadastrar dominio; Botão tag; fechar pop cadastro de dominio; G4 (x2)
- *Domínios (6):* `Botão CadastrarNovoDomínio`; `g DNS clicked`; `InputDomínioInformado value changed` (valida vazio/não); `PopupCriarDomínio closing`; `Verificar-DMARC` (chama GoogleDNS)
- *CopiarCampos (17):* `CopiarÁreaTrabalho` + G1..G8 (botões copiar registros DNS para clipboard — Air Copy)
- *Webhooks (7):* `Botão CadastrarWebhook` (WebhooksUsuario vazio/não); `ButtonCriarWebhook`; `Button Excluir`; `Group WebhooksUsuario clicked` (editar); `PopupCriar/EditarWebhook closing`
- *Tags (3):* `BotãoCriarTag`; `TagSelecionar clicked` (toggle por @TIpoEvento)
- *Api (1):* `Botão conf api`; *POP conf api:* fechar
- *Aba api/integrações (1):* `Botão Webhooks`
- *PopUpExcluirTag (5):* confirmação de exclusão
- *Toasts (2):* EventoErro/EventoSucesso; *breadcrumb:* Text ajuda

---

## perfil (perfil do usuário + meu plano)
**Propósito:** ver/editar perfil (g Perfil) e ver plano atual (g Plano = "Ver meu plano"). Popup criar nova conta.
**Data:** User, UserInfoPlano/Plano.
**Workflows (8):**
- *Navegação (2):* `Button Ver meu plano` (alterna g Perfil ↔ g Plano)
- *PerfilUser:* `Botão Salvar` (salva perfil)
- *Pop conta nova (2):* `Botão Cadastrar nova conta`; `Icon Close`
- *Uncategorized:* `Botão Cancelar`; *Toasts (2):* EventoErro/EventoSucesso

---

## planos_cobrancas (planos & cobrança)
**Propósito:** gestão/visualização de planos (Admin cria planos), planos ativos, e histórico de cobrança/transações. Usa reusables DetalhesPlano, PopupNovoPlano, PopupEditarPlano.
**Data:** Plano, TransaçõesUsuários, UserInfoPlano.
**Workflows (3):** `Button Criar novo plano clicked` (Admin); `g HistóricoCobrança clicked` (TransaçõesUsuários); `g PlanosAtivos clicked`

---

## chamados (chat de suporte / ticket)
**Propósito:** visualização de uma conversa de suporte (chat) — enviar mensagens com anexos de arquivo. Aberto via param de URL (Get pagina from URL).
**Data:** ConversaChat, MensagemChat (List of files).
**Workflows (11):**
- *Uncategorized (3):* `Page is loaded` (Get pagina from URL); `TXT empresa xpto`; `Fechar popup`
- *EnviarMensagem (4):* `Icon EnviarMensagem clicked` (cria MensagemChat, com/sem arquivos — File&Multifile Preview); `File&Multifile A Files Saved`; `g DropFiles clicked`
- *Navegação (4):* `Button Voltar`; `Icon anexar arquivo`; `IconActions`; Unnamed Workflow

---

## suporte (central de ajuda / FAQ)
**Propósito:** página de ajuda — FAQ (mostrar perguntas), vídeos tutoriais (resposta em vídeo, checkout), sugestões da IA. Conteúdo majoritariamente estático/informativo.
**Workflows (4):** `TXT Sugestões da IA clicked`; `Icon mostrar pergunta 1 clicked`; `Icon video resposta clicked`; `Icon video resposta checkout clicked`

---

## seguranca (painel ADMIN — destino do login de Administrador)
**Propósito:** controle administrativo: gerenciar usuários (ativar/desabilitar via @StatusUser, encerrar sessões), gerenciar webhooks globalmente, histórico de acesso, sessões ativas.
**Data:** User (@StatusUser), HistóricoAcesso, WebhooksUsuario.
**Workflows (21):**
- *AtivarUsuário (4):* `Btn AtivarUser`; `BTN Habilitar/Desabilitar` (quando @StatusUser=Ativo); `BTN CancelarEncerrarSessão`; fechar popup
- *DesabilitarUsuário (3):* `Btn EncerrarConfirmar`; `BTN CancelarEncerrarSessão`; fechar
- *GerenciamentoUsers (4):* `g Cell clicked`; `BTN Habilitar/Desabilitar` (@StatusUser=Desabilitado); paginação Left/Right
- *GerenciamentoWebhooks (3):* `g Cell`; paginação
- *HistóricoAcesso (3):* `Icon Login`; paginação (g ResultadosPorPágina)
- *SessõesAtivas (2):* `Icon Users`; `Icon IrGerenciarWebhook`
- *Breadcrumbs/EventoSucesso/PlanosCobranças:* nav + toasts

---

## relatorios_globais (relatórios consolidados — Admin/Gestor)
**Propósito:** página de relatórios globais. **0 workflows** — somente exibição (data sources nos elementos) ou em construção (WIP). Provavelmente consome EstatísticasDashboard/EstatisticasCampanha agregados.

---

## reset_pw (redefinir senha)
**Workflows (1):** `Button Confirm clicked` — fluxo padrão de reset de senha (token do email → nova senha).

## testes (sandbox de desenvolvimento)
**0 workflows** — página de teste/dev, fora do produto. Ignorar na migração.

## 404 (página não encontrada)
Página de erro padrão.

---

# REUTILIZÁVEIS (12) — componentes compartilhados
- **Header**: cabeçalho global (logo Kobly + dados do Current User)
- **Menu lateral**: navegação lateral (links p/ dashboard, campanhas, leads, clientes, integracao, perfil, suporte, etc.) — overlay em quase todas as páginas internas
- **InfoLeads**: painel/detalhe de um Lead (usado em leads)
- **StatusCampanha**: badge/indicador de @StatusCampanha
- **DetalhesPlano**: card de detalhe de Plano (planos_cobrancas)
- **PopupNovoPlano / PopupEditarPlano**: popups CRUD de Plano (Admin)
- **EmptyState**: estado vazio (listas sem dados)
- **EditarEtapaIcon**: ícone/controle de edição de etapa do fluxo (construtor de fluxo)
- **abrir focos rg / arrow focus rg / menu abrir cell rg**: componentes auxiliares de repeating groups (abrir foco/seleção de célula, setas) — usados em listas/RGs

# Papéis (@TipoUserGeral) × páginas
- **Cliente**: dashboard (próprias stats), campanhas, leads, integracao, perfil, suporte, chamados, planos
- **Gestor**: dashboard consolidado (todas as contas), clientes (gerencia contas), relatorios_globais
- **Administrador**: login → **seguranca** (gerencia usuários/sessões/webhooks/histórico), planos_cobrancas (cria planos)
- **Suporte**: chamados/suporte (atende chamados)
