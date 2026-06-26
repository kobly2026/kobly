# Kobly — Front-end / UI por rota (análise visual)

> Análise visual+estrutural de cada rota, capturada no **modo Design do editor Bubble** com "mostrar todos os elementos" ativo (o app em Preview está protegido por senha do plano). Para cada rota: layout, seções, componentes (grupos, repeating groups, formulários, inputs, botões), estados/popups e visual (cores/labels). Serve de guia para reconstruir as telas em React/Next.js.

**Design system observado:** tema **escuro** (fundo quase preto), cor de destaque **laranja** (#F60 aprox.) em botões/títulos, verde para estado selecionado/sucesso, cards com borda arredondada e contorno laranja. Tipografia sans-serif. Layout com **sidebar lateral** (Menu lateral) + header (logo Kobly + usuário) nas páginas internas.

---

## /index — Login / Cadastro / Privacidade / Curadoria

Página pública (fundo escuro), múltiplos grupos sobrepostos com visibilidade condicional:

- **g FormLogin** — formulário de login: campos e-mail/senha + botão Login, **"Botão login google copy"** (login social Google), link "Possui conta?" (alterna login/cadastro), link Termos.
- **g FormCadastro** — formulário de cadastro (nome/e-mail/senha…), botão "Continuar Cadastro".
- **g Áreas — CURADORIA/ONBOARDING** (tela "Escolha sua área"):
  - Título **"Escolha sua área"** + subtítulo "Escolha pelo menos uma área e clique em finalizar".
  - 15 botões de nicho (cards toggláveis, laranja; selecionado fica **verde**): **UX design, Web Design, Design Gráfico, Marketing Digital, Desenvolvimento Pessoal, Imobiliária, Contabilidade, Advocacia, Odontologia, Consultoria Empresarial, Arquitetura / Engenharia, Infoprodutos, Startups, Lançamentos, Afiliados**.
  - Botão **"Finalizar"** (largo, laranja preenchido).
  - → persiste em `User.Curadoria` (List of text) — segmentação de interesse do cliente.
- **g PrivacyPolicy** — política de privacidade (texto).

**React:** rotas `/login`, `/signup` (toggle), `/onboarding` (wizard de seleção de nichos, multiselect chips), `/privacidade`. Login social Google. Pós-login: redireciona dashboard (ou /admin/seguranca se Administrador).

---

## /dashboard — Painel de analytics

**Header global:** logo Kobly + "Automação de Marketing" (esq.) · avatar laranja + "Current User's Nome" + "@TipoUserGeral" (dir.). Sidebar **Menu lateral**.
**Título:** "Dashboard".

**Composição (árvore):**
- **Overlays:** `Focus calendar` (calendário de filtro, com `G ano`/`G mes` e navegação de mês) · `menu lateral` · `G Nave bar`.
- **g Breadcrumbs** (`Arrow >`) — navegação/breadcrumb.
- **4 cards de KPI** (clicáveis p/ detalhe):
  - `G vendas recuperadas`
  - `G vendas (total de emails enviados)`
  - `G taxa de abertura média`
  - `G (CTR)`
- **G resumo de resultado** (`G corpo visualizar data`) — bloco de resumo com filtro de data.
- **g ResumoGestor** (+ `EmptyState A`) — resumo consolidado para Gestor (estado vazio quando sem contas).
- **g Contas** / **g ContaUserCliente** — visão de contas gerenciadas (Gestor) vs. conta do Cliente.
- Dropdown "SelecioneCampanha" (seletor de campanha) + área de sugestão IA.

**React:** `/dashboard` com grid de 4 KPI cards (Recharts/Chart.js), seletor de campanha, date-range picker (substitui Focus calendar), bloco de sugestão IA, e variação Gestor (lista de contas + consolidado) vs Cliente. EmptyState quando sem dados.

---

## /campanhas — CORE (título "Minhas Campanhas")

A página mais complexa (244 nós). Combina **lista de campanhas + construtor de fluxo + editor de e-mail**, com vários popups. Header global + Menu lateral.

### Seções principais (Main > g Pagina > g Campanhas)
1. **g ListaCampanhas — tabela de campanhas**
   - Cabeçalho com colunas: **Nome | Empresa | Domínio | E-mail | Ações**.
   - `RG ListaCampanhas` (uma linha por campanha): nome da campanha, empresa, `RepeatingGroup DomíniosUsuário` (domínio), badge **StatusCampanha** (reusable), ícone de ações.
   - `EmptyState A` quando sem campanhas.
   - Header da página com `Input editar campanha` e `Botão CriarCampanha`.
2. **g TemplatesDisponíveis** — `RG Templates` com cards `g Template` (g Corpo + ícone) — galeria de templates (@TipoTemplate).
3. **g ConstrutorFluxo — CONSTRUTOR VISUAL DE FLUXO** (`g Fluxos > g FluxoV1`):
   - `g InícioEmpty` ("Selecione um card para..."), `g CardFluxoVazioCriarEmail`.
   - Cards de tipo: `g AdicionarTag`, `g Gatilho` (cada um = card com ícone) — paleta de cards @TipoCardFluxo.
   - `g Buttons`: **Switch AtivarFluxo** ("Ativar campanha") + `Button Ver detalhes`.
   - `g CardMeta`: `Button Definir Tags` + `g Detalhes` (`RepeatingGroup TagsParaAdicionar` > g Tag).
   - **`rg Etapas` — a lista de etapas arrastáveis**: `Group EtapaFluxo` > **`Drag/dropGroup EtapaFluxo`** > `DropArea Top` + `g CardFluxo` (g Icons; `IconifyIcon ExpandirCard`; `EditarEtapaIcon`; `g Detalhes` com `g Atraso` e RepeatingGroups **TagsParaAdicionar / TagsGatilho / TagsRemover / Campanhas(AcionarFluxos)**); `g GhostDrag` (sombra de arraste); `IconEscolherCard`.
   - `g Avisos` / `AvisoIcon`.
4. **g CriarEmail — EDITOR DE E-MAIL** (`G corpo configurações`):
   - **Coluna config** (`G vertical esquerdo`): `Input Título`, `Input Assunto`, `Input Remetente`, `Dropdown Escolha um email` (domínio/remetente) e `Dropdown Escolha uma personalidade`; **`G Descreva + AI` / `G koblAi`** (geração por IA): `MultilineInput DescrevaAI` (prompt) + `CodeEditor A` (editor de HTML); `G ações do email`: `Botão CancelarEmail` + `Botão CriarEmail`.
   - **Coluna preview** (`G campos de configurações copy`): `G Pré-visualização do E-mail` > `g EmailCorpoPreview` > `HTML C` (render do e-mail) + `ButtonEmailTeste` (enviar teste).
5. **GF Emails** (painel) — `ListaEmails` > `RepeatingGroup EmailsUsuário` (gerenciar e-mails salvos), `g AbriTelaEmail`, Sugestões da IA.

### Overlays / popups
- `GFEscolhaEtapa` — seletor de tipo de card (`RG TiposSelecionáveis` > g Cell Tipo: ícone + nome do tipo).
- `PopupDefinirMetaCampanha` — define tags-meta da campanha (`RG Tags` + `Botão CriarAdicionarTag`).
- `PopupCriarCampanha` — `Input Nome da campanha` + `Botão CriarCampanha` (+ cadastro de domínio).
- `PopupExcluirEmail` — confirmação (ButtonCancelar/ButtonExcluir).

**React:** `/campanhas` (tabela TanStack: Nome/Empresa/Domínio/E-mail/Ações + status badge), `/campanhas/[id]/fluxo` (construtor **dnd-kit**: paleta de cards → lista de etapas arrastáveis, cada etapa com atraso + tags add/remove/gatilho/acionar-fluxo, switch ativar, definir meta), `/campanhas/[id]/email` (editor 2 colunas: form de config + gerador IA com Monaco/HTML + preview ao vivo + enviar teste). Galeria de templates. Popups → modais/dialogs.

---

## /leads — Lista de leads / CRM (título "Últimos leads")

Renderiza com dados de exemplo no editor. Header global + Menu lateral.

**Composição:**
- **`g Status Emails` — 4 cards de status de e-mail** (topo), cada um ícone + título + contagem: **Emails processados · Emails enviados · Emails rejeitados · Emails adiados** (valores ex. 4000).
- **`g Tabela de Leads`** — tabela com cabeçalho de colunas: **Email | Nome | Tags | Métricas**.
  - `RG_Leads` (linha por Lead): email, nome, `RepeatingGroup TagsGatilho` (tags do lead), **Métricas** com aberturas (`[fa]eye`) e cliques (`[fa]mouse-pointer`), e `InfoLeads A` (reusable de detalhe expandido).
  - `EmptyState A`.
  - **`g Paginator`** — paginação client-side (ListofNumbers + setas Left/Right + números de página).

**React:** `/leads` — 4 stat cards no topo + tabela (TanStack) Email/Nome/Tags/Métricas(aberturas, cliques) + paginação + drawer/expand de detalhe (InfoLeads). Filtro BuscaEventos.

---

## /clientes — Gestor: contas de clientes (título "Clientes" / "Todas as contas")

Header global + Menu lateral. Header com **Botão "Cadastrar nova conta"** + breadcrumb.

**Composição:**
- **`g Contas` — tabela de contas** com busca (`Input Buscar`) e colunas: **Nome | Empresa | E-mail | Domínio | Ações**.
  - `RG UsersClientes` (linha por conta/cliente): nome@email, empresa, e-mail, `RepeatingGroup DomíniosUsuário` (domínio), `menu abrir cell rg` (menu de ações).
- **`g UserSelecionado` — painel de edição da conta selecionada**: `Input EditarNomeCompleto`, `Input EditarNomeEmpresa`, `Input E-mail`, `Dropdown DominioEdit`, **Botão Salvar / Botão Cancelar**.
- **`Popup CriarConta`** — formulário (campos obrigatórios, asterisco vermelho): `Input NomeCompleto`, `Input E-mailCadastro`, `Input EmpresaNome`, `Dropdown Escolha um domínio`, `Input Senha temporária`, **Botão "Cadastrar nova conta"** ("Criar novo cliente").

**React:** `/clientes` — tabela de contas com busca + menu de ações por linha; painel/drawer de edição (Nome/Empresa/E-mail/Domínio, salvar/cancelar); modal CriarConta com form validado (cria User+Empresa+Domínio+senha temporária).

---

## /integracao — CORE: hub de integrações (abas Tag / Domínios / Webhooks)

Header global + Menu lateral. `g Header` com 3 abas: **Botão Tag · Botão Domínios · Botão Webhooks**. Link "Precisa de ajuda?".

### Aba Tags (`g Tags`)
- **`g CriarTag`**: `Input Nome da tag`, **`RG TipoEventos`** (`TagSelecionar` — escolher @TIpoEvento, ex. Compra Aprovada/Abandono de carrinho), `Input Descrição`, `BotãoCriarTag`.
- **`g TagsCriadas`**: `RepeatingGroup TagsUsuário` (cells com nome/descrição + menu) + `EmptyState`.

### Aba Domínios (`g Domínios`)
- Header (`Titulo Dominios` + `botão drop cadastrar dominio`); breadcrumb (Todos os domínios).
- **`g TabelaDomínios`**: colunas **Nome | Empresa | Domínio | Ações**; `RG ListaDomínios` (cells + `menu abrir cell rg`) + `EmptyState`.
- **`G detalhes do domínio`**: `Input` domínio + "Verificar DNS"; **tabela de registros DNS** com colunas **Tipo | Nome (Host) | Valor | Status** e 4 linhas (3× CNAME — MailCname/CNAME1/CNAME2 — + 1× TXT), cada uma com `Input` host (D1–D4) + `Input` valor (V1–V4) + **ícones copiar** (Air Copy). É a config de autenticação SendGrid (DKIM/DMARC/CNAME).

### Aba Webhooks (`g Webhooks`)
- `ButtonCriarWebhook`; `RepeatingGroup WebhooksUsuario` (g Cell: `Botão entrar` + `Botão conf api` "Configurar") + `EmptyState`.

### Popups
- **`PopupCriarDomínio`**: `InputDomínioInformado` com indicador válido/inválido ("Domínio inválido"), tabela DNS (mesma estrutura, com copiar), `Botão "Criar novo domínio"`.
- **`PopupCriar/EditarWebhook`**: `Input Nome do webhook`, `InputDescriçãoWebhook`, **`Multidropdown Escolha uma tag`** (tags acionadoras), **`InputUrlWebhookGerada`** (URL gerada do webhook + copiar), `Button Excluir`, `Botão "Criar Webhook"`.
- `PopupExcluirTag` / `PopupExcluirWebhook` — confirmação.

**React:** `/integracao` com 3 tabs. Tags: form criar tag (nome, tipo de evento, descrição) + lista. Domínios: tabela + painel de verificação DNS (tabela copiável de registros CNAME/TXT + status) integrado ao SendGrid. Webhooks: lista + modal criar/editar (nome, descrição, tags multiselect, URL gerada copiável, secret). Modais de confirmação de exclusão.

---

## /perfil — Perfil + Meu plano (toggle)

Header global + Menu lateral. `g Header`: "Perfil" + **Button "Ver meu plano"** (alterna g Perfil ↔ g Plano).

- **`g Perfil`** — formulário de perfil: foto (`Image foto user` + `Picture capturar foto user` = upload), `Input Perfil Nome`, `Input NomeEmpresa`, `Input E-mail`, **Botão Salvar / Botão Cancelar**.
- **`g Plano`** — "Meu plano": `g PlanoAtual` (nome do plano via Current User InfoPlano), título **"Limites Mensais"**, **2 cards de uso com barra de progresso**: `Card1` **Campanhas** (`CustomProgressBar A` + nº usado/limite) e `Card2` **Execuções** (`CustomProgressBar B` + nº usado/limite), **Button "Alterar Plano"**.
- **`Popup CriarConta`** — igual ao de /clientes + `Dropdown status user` (Status da conta).

**React:** `/perfil` com tabs Perfil/Plano. Perfil: form com upload de avatar + nome/empresa/email + salvar. Plano: card do plano atual + 2 progress bars (Campanhas e Execuções: uso vs. limite do plano) + CTA Alterar Plano.

---

## /planos_cobrancas — Planos & cobrança (título "Planos e cobranças")

Header global + Menu lateral. `g HeaderEscolha` com abas: **Planos ativos | Histórico de cobrança**.

- **`g Planos`** (Planos ativos): `Button "Criar novo plano"`; `RG Planos` (cells com `g Status` + reusable **DetalhesPlano**) — cards/lista de planos.
- **`g HistóricoCobranças`**: busca (`Input Buscar transação`); **tabela de transações** colunas: **Data da fatura | Cliente | Plano | Valor | Status | Nº da fatura**; `RG Transações` (cells: Data, User, Plano, Valor, StatusPagamento, FormaPagamento, Nº fatura).
- Overlay **`PopupNovoPlano`** (criar/editar plano; também reusable PopupEditarPlano).

**React:** `/planos` com tabs. Planos: grid de cards de plano (DetalhesPlano) + Criar novo plano (Admin → modal PlanoForm). Histórico: tabela de transações (TanStack) com busca, colunas data/cliente/plano/valor/status/nº fatura (Asaas).

---

## /chamados — Suporte: inbox + chat (título "Chamados" / "Lista de chamados")

Header global + Menu lateral. Layout de **inbox + thread** (visão do Suporte).

- **`g Conversas` — tabela de chamados**: busca (`Input Buscar chamado`); colunas: **Usuário | Cliente | Local aproximado | Prioridade | Login ativo desde | Última ação | Tipo | Ações**; `RG Conversas` (cells: ID, e-mail, IP, Status, Prioridade (ex. "alta"), TempoEstimado (ex. "4h restante"), Data (ex. 21/05/25-14:33), Tipo, `IconActions`).
- **`g Chat` — thread da conversa**: `HTML scrol do chat`; `RG Mensagens` com `g MensagemRecebida` / `g MensagemEnviada` (bolhas), cada mensagem com texto + `RG Files` (anexos de imagem); **`g EnviarMensagem`** (composer): `RG Anexos` (preview de anexos), `MultilineInput "Sua mensagem"`, `Icon anexar arquivo`, `Icon EnviarMensagem`; `Button Voltar`.
- Overlays: `g FocusAnexar` (drop de arquivos + File&Multifile uploader), `Popup imagem rg` (visualizador de imagem ampliada).

**React:** `/chamados` (lista/inbox de conversas com prioridade/tipo/tempo) + `/chamados/[id]` (thread de chat em tempo real — **Supabase Realtime** — bolhas recebida/enviada com anexos + composer com upload + visualizador de imagem).

---

## /suporte — Central de ajuda / FAQ (título "Suporte")

Header global + Menu lateral. Conteúdo majoritariamente estático/informativo.

- Destaque: **"Como criar minha primeira campanha"** (`G fluxo das telas`).
- **`G pagina suporte` — FAQ por categorias** (accordion): **Primeiros passos** (com respostas em vídeo — `Icon video resposta` / `video resposta checkout`), **Mensagens e Disparo**, **Relatórios e Métricas**, **Conta e Planos**. Cada categoria expande perguntas (`Icon mostrar pergunta`) → respostas (texto/vídeo).
- **`G pagina Video resposta`** — visualização de resposta em vídeo (`Video A`) + perguntas relacionadas.
- **`G flutuante lateral direito`** — painel **assistente IA flutuante** ("Sugestões da IA") — componente persistente que aparece também em /clientes, /perfil.

**React:** `/suporte` — KB/FAQ com categorias em accordion + player de vídeo + assistente IA flutuante (drawer global). Pode virar CMS/conteúdo estático.

---

## /seguranca — Painel ADMIN (destino do login de Administrador)

Header global + Menu lateral. **`g MenuList`** (menu de seções): **Sessões** (`Icon Users`) · **Histórico de Login** (`Icon Login`) · **Gerenciamento de Webhooks** (`Icon IrGerenciarWebhook`).

- **`g Usuarios` — tabela de usuários**: busca (`Input SearchUsers`); colunas: **Usuário | Status | IP | Local aproximado | Login ativo desde | Ações**; `RG Users` (cells com **`BTN Habilitar/Desabilitar`**) + `g Paginator`.
- **`g Historico` — tabela de histórico de acesso**: busca (`Input SearchHistorico`); colunas: **Usuário | IP | Local aproximado | Dispositivo | Log | Ações**; `RG Historicos` (cells: email, data, ip, local, dispositivo ex. "Chrome (Windows)", log, `abrir focos rg`) + paginação com `Dropdown "Resultados por página"`.
- **`g GerenciamentoWebhooks` — tabela de webhooks (global)**: busca; colunas: **Usuário | Descrição | Status | Número de Requisições | Ações**; `rg ListaWebhooksUsers` + paginação.
- **Popups**: `Popup Desabilitar usuário` (encerrar sessão — Cancelar/Confirmar), `Popup AtivarUser` (ativar usuário — Cancelar/Confirmar).

**React:** `/admin/seguranca` (guard role=Administrador) com sub-views (Usuários / Histórico de login / Webhooks). 3 tabelas (TanStack) com busca/paginação; ações habilitar/desabilitar usuário (@StatusUser) + modais de confirmação; histórico com device/local; webhooks com contagem de requisições.

---

## /relatorios_globais — Relatórios consolidados (título "Relatórios Globais")

Header global + Menu lateral. **0 workflows** — página de exibição (gráficos ainda com placeholder do plugin = WIP/sem dados). Layout/intenção clara:
- **3 cards de gráfico** (Bar/Line/Area): **Total de campanhas criadas por período**, **Número de disparos por canal**, **Conversões recuperadas por canal**.
- **Card "Melhores perfis de uso"** — insights/recomendações IA (ex.: "Sua taxa de abertura está abaixo da média. Considere ajustar o assunto"; "Campanha X teve bons resultados. Que tal repetir a cadência?").
- **Card "Métricas de entrega"** — Taxas médias de abertura · Cliques · Bounce.

**React:** `/admin/relatorios` (Gestor/Admin) — 3 gráficos (Recharts) sobre dados agregados (EstatísticasDashboard/EstatisticasCampanha) + painel de insights IA + painel de métricas de entrega. Concluir o wiring de dados (estava incompleto no Bubble).

---

## /reset_pw — Redefinir senha

**Tema claro** (fundo branco — destoa do app escuro; é a tela padrão Bubble). Título **"Reset your password"** + card central com `Input "New password"`, `Input "Confirm new password"` e botão azul **"Confirm"**.

**React:** `/reset-password` — fluxo nativo do Supabase Auth (token do e-mail → nova senha + confirmação). Aplicar tema/identidade do Kobly.

## /testes — sandbox dev (0 workflows) · /404 — erro padrão
Ignorar `testes` na migração. `404` = página de não encontrado padrão.

---

# Componentes globais / reusables (mapa React)
- **Header** → `<AppHeader/>` (logo Kobly + dados do usuário).
- **Menu lateral** → `<Sidebar/>` (navegação por papel).
- **G Nave bar** → barra de navegação/topo secundária.
- **InfoLeads** → `<LeadDetail/>` (drawer/painel de detalhe de lead).
- **StatusCampanha** → `<CampaignStatusBadge/>`.
- **DetalhesPlano / PopupNovoPlano / PopupEditarPlano** → `<PlanCard/>`, `<PlanFormModal/>`.
- **EmptyState** → `<EmptyState/>`.
- **EditarEtapaIcon** → controle de edição de etapa (construtor de fluxo).
- **abrir focos rg / arrow focus rg / menu abrir cell rg** → menus/ações de linha de tabela (`<RowActions/>`).
- **G flutuante lateral direito** → `<AIAssistantDrawer/>` (assistente IA "Sugestões da IA", flutuante, global em várias páginas).

# Padrões de UI recorrentes (para o design system)
- **Tema escuro** + destaque **laranja**; estado selecionado **verde**.
- **Tabelas** com cabeçalho de colunas + repeating group de linhas + `EmptyState` + **paginador** (Left/Right + números, "Resultados por página") → TanStack Table com paginação.
- **Busca** no topo das listas (Input Buscar).
- **Popups/modais** para criar/editar/excluir (CriarConta, CriarCampanha, CriarDomínio, Criar/EditarWebhook, NovoPlano, confirmar exclusão) → Dialog/Modal.
- **Cards de KPI** com ícone + título + valor; **progress bars** (uso de plano).
- **Toggle de abas** dentro da página (Tag/Domínios/Webhooks; Perfil/Plano; Planos ativos/Histórico).
