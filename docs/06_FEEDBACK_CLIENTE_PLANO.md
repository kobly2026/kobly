# Kobly — Cockpit do Feedback do Cliente (06/07/2026)

> Fonte: feedback enviado pelo cliente em 06/07/2026.
> Priorização definida pelo próprio cliente: **Crítico** = fluxo de onboarding (cadastro/auth),
> arquitetura de webhooks e persistência da edição das telas. O restante = melhorias de UX / evolução.

## Resumo de mapeamento

Stack: **Vite + React 18 + Supabase** (Postgres + RLS multi-tenant + Edge Functions + Auth).
Auth self-service: `signup -> confirmacao de e-mail -> onboarding (create_own_org, plano Starter)`.
Canais: **e-mail** (Resend) e **WhatsApp** (Z-API). Entrada de eventos: `postback-receiver` (URL universal por token) + `webhook-receiver` (legado).

Legenda — **Pri**: 🔴 Crítico · 🟠 Alto · 🟡 Médio · 🟢 Quick win. **Tipo**: `code` (frontend) · `fn` (edge function) · `sql` (migration/RLS) · `cfg` (config Supabase/dashboard) · `ux`.

## Tabela mestra

| ID | Área | Item | Pri | Tipo | Estado atual | Ação |
|----|------|------|-----|------|--------------|------|
| UX-1 | UX/Nav | Sair da página ao editar e-mail/template perde a edição e volta ao dashboard | 🔴 | code | `Campaigns.jsx` guarda `mode`/`active` em `useState` local; navegar pelo rail desmonta a rota e perde o estado (FlowBuilder é todo em memória, salva só no "Salvar fluxo") | Persistir rascunho (localStorage/autosave) + travar navegação com "sair sem salvar?" + manter `active` no store |
| UX-2 | UX/Nav | Ao "Salvar" a página rola para baixo, parecendo que não salvou | 🟡 | code/ux | Toast/botão sem `preventDefault` ou scroll-into-view agressivo | Garantir `e.preventDefault()` nos submits e rolar para o topo/cabeçalho após salvar; feedback visual claro |
| UX-3 | UX/Nav | Campanha nova aparece no fim da lista (quer recentes no topo) | 🟠 | code | `supabaseDb.hydrate()` busca `campaigns` **sem `order`** -> ordem natural (inserção) | Ordenar por `created_at desc` no hydrate (afeta lista, dashboard, relatórios) |
| MARCA-1 | Marca/Contas | Múltiplas marcas/produtos por conta (identidade, checkout, campanhas próprios) | 🔴 | sql+code | Hoje `org_branding` é **1:1** com `organization` (`maybeSingle()`); tudo escopa por `organization_id` | Nova tabela `brands` (1:N) + `campaigns.brand_id` + seletor de marca ativa + refatorar branding/IA/process-steps |
| MARCA-2 | Marca/Contas | Cadastro de conta: onde entra e-mail, como recebe acesso, perfil, plano | 🔴 | code+ux | Self-service: signup (nome/e-mail/senha) -> confirma e-mail -> onboarding (nome+segmento) cria org com plano Starter. Falta clareza do fluxo **gestor criando conta p/ cliente** | Documentar o self-service + completar o fluxo "Gestor/Admin cria conta" (e-mail, convite, perfil, plano) |
| TPL-1 | Templates | Editar mensagem de WhatsApp direto na campanha (como o e-mail) | 🟠 | code | `FlowBuilder.Inspector` tem Select de mensagem WhatsApp, mas **não tem editor inline** (só email abre o `EmailEditor` modal) | Editor de WhatsApp (modal) reusando `whatsapp_messages`, com geração por IA |
| TPL-2 | Templates | IA do WhatsApp sempre pensa em carrinho e usa `{{cta_link}}` mesmo em pós-compra | 🟠 | fn+code | `ai-chat` task=whatsapp + fallback em `ai.js` hardcoded em "recuperação de carrinho" + `{{cta_link}}` fixo | Passar **objetivo/contexto** (tipo_evento da campanha) ao prompt; variável dinâmica por objetivo |
| WEB-1 | Integrações | Múltiplos webhooks nomeados + vincular campanha a webhook específico | 🔴 | sql+code+fn | `postback_tokens` já suporta **múltiplos** (com `nome`), mas a UI mostra só "Token principal" e **campanha não tem vínculo** a um token (match é por `tipo_evento`) | UI de CRUD de webhooks nomeados em Integrações + `campaigns.postback_token_id` + `postback-receiver` filtra campanhas por token |
| EMAIL-1 | E-mails | Política de domínio de envio (Kobly vs domínio próprio) | 🟠 | cfg+fn | Tudo via **Resend** (sem SMTP do Supabase). Dev usa `onboarding@resend.dev` | Política: domínio verificado no Resend (ex.: `app.koblay.io`) como remetente padrão + opcional domínio próprio por marca |
| EMAIL-2 | E-mails | E-mail de confirmação/convite/reset sem identidade Kobly (sai pelo SMTP default do Supabase) | 🟠 | cfg | Auth usa SMTP built-in do Supabase (genérico, com rate-limit) | Roteá-lo pelo **Resend SMTP** (Host `smtp.resend.com`:465, user `resend`, senha=API key) + customizar templates de Auth com a marca Kobly |
| EMAIL-3 | E-mails | Link de confirmação redirecionava para `localhost:3000` (erro) | ✅ | cfg+code | `Site URL` estava `localhost:3000`; `signUp` não enviava `emailRedirectTo` | Site URL = `https://app.koblay.io` (feito) + Redirect URLs allowlist: `https://app.koblay.io` e `http://localhost:5173` (dev) + code `emailRedirectTo` (feito) |
| CFG-1 | Config | Excluir plano "Legado 2024" | 🟢 | sql | Existe `pl_4 'Legado 2024'` `Inativo`, `deleted=false` | Soft-delete: `plans.deleted = true` (preserva histórico de transações) |
| CFG-2 | Config | Starter -> até 5 campanhas | 🟢 | sql | `Starter` com `limite_campanhas = 3` | `update plans set limite_campanhas = 5 where nome='Starter'` |

## Detalhamento por área

### 1) UX / Navegação
- **UX-1 (persistência da edição)** — raiz técnica: o `AppShell` renderiza a rota atual conforme `store.view`; trocar de item no rail desmonta `Campaigns.jsx`, e junto vão `mode`/`active`/o estado do `FlowBuilder` (passos, dirty). **Solução em 3 camadas**: (a) autosave de rascunho do fluxo em `localStorage` (key por `campaignId`); (b) avisar "Você tem alterações não salvas. Sair?" ao tentar navegar com `dirty=true`; (c) manter `active`/`mode` no store para restaurar ao voltar.
- **UX-2 (scroll ao salvar)** — revisar todos os handlers de "Salvar" (Fluxo, Marca, Email): garantir `preventDefault` e, após sucesso, rolar para o cabeçalho/botão e manter o toast visível.
- **UX-3 (recentes no topo)** — `supabaseDb.hydrate()` busca `campaigns` sem ordenação. Ordenar por `created_at desc`.

### 2) Marca / Contas
- **MARCA-1 (multi-marca)** — **maior impacto estrutural**. Hoje `org_branding` é 1:1. Para múltiplos produtos/marcas: novo modelo `brands(id, organization_id, nome, cor, logo_url, modo, link_checkout, ...)` (1:N); `campaigns.brand_id` (null = marca padrão); refatorar `getBranding`/`process-steps`/`ai.js` para usar a marca da campanha; UI com seletor de marca + CRUD. **Depende de decisão de produto** — modelar com backend specialist (RLS) + product/UX (fluxo).
- **MARCA-2 (fluxo de cadastro/onboarding)** — documentar o caminho self-service e fechar o fluxo "gestor/agência cria conta para cliente": onde o e-mail é cadastrado, como o convite chega, como o perfil é definido e quando o plano é escolhido. `createOrganization` (`create_managed_org`) existe, mas o convite por e-mail não está completo.

### 3) Templates
- **TPL-1 (editor de WhatsApp na campanha)** — criar `WhatsappEditor` (modal, espelhando o `EmailEditor`) que escreve em `whatsapp_messages` (já existe, `0021`) com preview + geração por IA + envio de teste (já há `sendTestWhatsapp`).
- **TPL-2 (IA de WhatsApp contextual)** — passar o **objetivo/tipo_evento** da campanha no `brief` e tornar a variável do CTA dinâmica (pós-compra -> area de membros, não `{{cta_link}}`).

### 4) Integrações / Webhooks
- **WEB-1 (webhooks nomeados + vínculo por campanha)** — o banco **já suporta** múltiplos `postback_tokens` nomeados (`0017`), mas: (a) a UI de Integrações não expõe CRUD de tokens; (b) **não há vínculo campanha<->token** — o `postback-receiver` resolve token -> org e dá match só por `tipo_evento`. Mudanças: `sql` `campaigns.postback_token_id`; `fn` `postback-receiver` filtra campanhas por token (null = qualquer token da org, retrocompatível); `code` UI de Webhooks + campo "Webhook de origem" no gatilho.

### 5) E-mails
> **Decisão de infra (06/07):** e-mail **somente via Resend** — não usamos o SMTP do Supabase. Isso vale tanto pros disparos de campanha (`send-email`) quanto para os e-mails transacionais do Auth (confirmação/convite/reset), que devem ser roteados pelo Resend.

- **EMAIL-1 (domínio de envio)** — usar um domínio verificado no Resend (ex.: `app.koblay.io`) como remetente padrão; futuro opcional: domínio próprio por marca (verificação DNS no Resend).
- **EMAIL-2 (identidade nos e-mails de auth)** — o Auth hoje usa o SMTP **built-in** do Supabase (genérico, com rate-limit e que só entrega para membros do time em alguns planos). Solução: (a) rotear o Auth pelo **Resend SMTP** em *Authentication → Email → SMTP Settings*; (b) customizar os templates de Auth (Confirm/Invite/Reset) com a marca Kobly. Sem isso o e-mail de confirmação não terá a identidade da Kobly.
- **EMAIL-3 (redirect localhost:3000)** — ✅ **Site URL já corrigida para `https://app.koblay.io`** (feito no dashboard). Falta apenas adicionar **`https://app.koblay.io`** e **`http://localhost:5173`** (dev) em *Authentication → URL Configuration → Redirect URLs*. O code (`emailRedirectTo: window.location.origin`) já está aplicado no `signUp`.

### 6) Configurações (quick wins)
- **CFG-1 / CFG-2** — migration única de ajuste de planos (soft-delete do Legado 2024 + Starter 5 campanhas).

## Go-live config checklist (dashboard Supabase — não-commitável)

### Domínio próprio app.koblay.io (produção)
O deploy roda no **Netlify** (`netlify.toml` já com SPA fallback + security headers). Para servir em `app.koblay.io`:
1. **Netlify → Site → Domain management → Add custom domain** → `app.koblay.io`. O Netlify exibirá o alvo do DNS (CNAME para `<seu-site>.netlify.app` ou um A record).
2. **DNS do `koblay.io`** (no registrador): criar registro
   - `app  CNAME  <seu-site>.netlify.app.` (subdomínio aponta pro Netlify).
   - (Opcional, apex `koblay.io` → se quiser redirecionar raiz: A record para o IP do Netlify OU usar o redirect puro de domínio do Netlify.)
3. **SSL**: provisionado automaticamente pelo Netlify (Let's Encrypt) após o DNS propagar.
4. **Supabase Auth** (já ajustado Site URL; complementar Redirect URLs): em *Authentication → URL Configuration* adicionar `https://app.koblay.io` em **Redirect URLs** (+ `http://localhost:5173` para dev).

### Resend como SMTP do Auth (EMAIL-2)
Em **Authentication → Email → SMTP Settings** (habilitar custom SMTP):
- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: **sua API key do Resend** (`re_...`) — mesma do Vault (`resend_api_key`)
- Sender email: `contato@app.koblay.io` · Sender name: `Kobly`
- ✅ Pré-requisito cumprido: domínio já **verificado no Resend** (06/07). O remetente `@app.koblay.io` já pode ser usado.
- Depois: customizar os templates em *Authentication → Email Templates* (Confirm signup / Invite user / Reset password / Magic link) com header/logo Kobly.

### Redirect URLs (EMAIL-3 — complemento da Site URL já corrigida)
Em **Authentication → URL Configuration**:
- Site URL: ✅ `https://app.koblay.io` (já feito)
- Redirect URLs (allowlist): adicionar `https://app.koblay.io` e `http://localhost:5173` (para dev). Sem o domínio na allowlist, o `emailRedirectTo` do code é ignorado e cai de volta na Site URL.

## Roadmap sugerido
- **Sprint 0 — Quick wins (executados neste ciclo):** CFG-1, CFG-2 (migration), UX-3 (ordenação), parte code do EMAIL-3 (emailRedirectTo).
- **Sprint 1 — Críticos de UX/auth:** UX-1 (persistência/autosave), EMAIL-3 (config dashboard), MARCA-2 (fechar/desenhar fluxo de cadastro).
- **Sprint 2 — Arquitetura:** WEB-1 (webhooks nomeados + vínculo) e MARCA-1 (multi-marca) — ambos tocam schema + RLS + UI; modelar juntos.
- **Sprint 3 — Evolução de canal:** TPL-1 (editor WhatsApp), TPL-2 (IA contextual), UX-2 (polimento de save/scroll), EMAIL-1/EMAIL-2.

## Dependências e riscos
- **MARCA-1 e WEB-1** se cruzam em campanha<->entidade; modelar juntos evita retrabalho.
- Após toda `sql` (migration), rodar `get_advisors` (RLS) e regenerar `database.types.ts`.
- Configurações de dashboard (EMAIL-2, EMAIL-3) **não são commitáveis** — checklist manual de go-live.
