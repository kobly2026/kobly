# Deliverability do domínio compartilhado — design

**Data:** 2026-07-20
**Autor:** Giuseppe + Claude
**Status:** proposto (aguardando revisão)

## Contexto

O cliente (Loja do João / org `d47ca6d3`) reportou que "os e-mails não estão
funcionando" — especificamente, **não chegam na caixa**. Investigação no banco
(`email_events`) mostrou o padrão real:

- Os envios **são aceitos** pelo Resend (13 `enviado` com `message-id` real no
  disparo de 19/07; 32 `enviado` no histórico).
- O `resend-webhook` está *Enabled* mas só assina `opened`/`clicked` e tem "No
  webhook events yet" em 19 dias — **zero aberturas em 32 envios**, coerente com
  e-mail caindo em Spam (onde abertura/imagem não dispara).
- 68 das 82 falhas históricas eram `403 – lojadojoao.com.br domain is not
  verified` (envio pelo domínio do cliente antes do deploy de 18/07).

O modelo de produto escolhido é **domínio compartilhado da plataforma como
padrão para escalar a 300+ clientes, sem suporte por cliente** (o wizard de
domínio próprio já existe em Integrações e continua opcional/self-service).

### Causa raiz da não-entrega (confirmada no painel Resend, 2026-07-20)

**A autenticação NÃO é o problema.** O domínio verificado no Resend é a raiz
`koblay.io` (região sa-east-1), e ela está corretamente autenticada:

| Registro | Estado |
|---|---|
| DKIM (`resend._domainkey.koblay.io`) | ✅ chave publicada e válida |
| SPF return-path (`send.koblay.io` TXT) | ✅ `v=spf1 include:amazonses.com ~all` |
| MX return-path/bounce (`send.koblay.io`) | ✅ `feedback-smtp.sa-east-1.amazonses.com` |
| DMARC (`_dmarc.koblay.io`) | ✅ `v=DMARC1; p=none` |

No painel **Emails** do Resend, os envios recentes aparecem como **Delivered**
(ex.: `vitorleitt2@gmail.com`, `agenciavl.digital1@gmail.com` — "Seu Pix expira
em breve", 15h; `nexopayt@gmail.com` — "Última chance com 10% OFF", 2d). **"Delivered"
= o Gmail aceitou a mensagem** (sem bounce, sem drop).

Portanto o problema real é **colocação em caixa**: os e-mails chegam ao Gmail
mas caem em **Spam** ou na aba **Promoções** — o cliente olha a caixa principal
e "não vê". Causa: **conformidade de remetente em massa + reputação + conteúdo**,
não DNS/autenticação.

**Descasamento de config (secundário, a corrigir):** o código monta o remetente
como `<sender_local>@envio.koblay.io` (migration 0040), mas `envio.koblay.io`
**não existe** no Resend — só a raiz `koblay.io`. Como os envios são *aceitos*,
conclui-se que o secret `resend_sending_domain` **não está setado** e o worker
cai no fallback `resend_from` (um endereço fixo `@koblay.io`). A feature de
subdomínio por-org (0040) está **dormente**. **Decisão:** usar `koblay.io` como
domínio de envio (já verificado) — sem publicar DNS novo.

Agravantes no código de envio (`process-bulk`, `process-steps`, `send-email`),
que violam as regras de remetente em massa do Gmail/Yahoo (fev/2024):

- **Sem header `List-Unsubscribe`** (exigido para bulk sender).
- Link "Descadastrar" do template é `href="#"` — **não funciona**.
- **Sem `Reply-To`**, sem objeto `headers` — payload é só `{from,to,subject,html}`.
- `resend-webhook` só trata `opened`/`clicked` — **ignora** entrega/bounce/spam,
  então não há como monitorar a saúde do domínio compartilhado nem suprimir
  endereços ruins.

## Objetivos

1. E-mails do domínio compartilhado `koblay.io` **saem da pasta Spam para a
   caixa** do Gmail/Yahoo (autenticação já OK; foco em conformidade + reputação).
2. Conformidade com as regras de remetente em massa (List-Unsubscribe funcional,
   Reply-To, baixa taxa de spam).
3. **Visibilidade e proteção da reputação compartilhada**: monitorar entrega/
   bounce/reclamação e suprimir automaticamente endereços ruins, para que um
   tenant não derrube a entrega dos outros.
4. Zero trabalho de onboarding por cliente (o padrão continua zero-touch).

## Não-objetivos

- **Não** vamos exigir domínio próprio por cliente (continua opcional, o wizard
  self-service já existe em Integrações e é mantido como está).
- **Não** vamos trocar de provedor (segue Resend).
- **Não** vamos construir warmup automatizado nesta fase (documentar ramp manual).
- **Não** mexer em WhatsApp/SMS.

## Frente 1 — Alinhar config para `koblay.io` (autenticação já OK)

`koblay.io` já está verificado e autenticado no Resend — **nenhum DNS novo é
necessário**. Esta frente vira só alinhamento de config + melhorias de reputação.

1. **Setar `resend_sending_domain = koblay.io`** no Vault. Isso ativa a feature
   0040: cada org passa a enviar de `<sender_local>@koblay.io` (bom para tracking
   e para o header do Reply-To), todos DKIM-assinados por `koblay.io`.
2. **DMARC:** já existe `_dmarc.koblay.io = p=none`. Manter por ora; após ~2
   semanas de tráfego limpo e relatórios, subir para `p=quarantine`. Opcional
   adicionar `rua=mailto:dmarc@koblay.io` para receber relatórios agregados.
3. **Reputação / conteúdo (o que tira do Spam/Promoções):**
   - koblay.io é um domínio de envio **frio** — precisa de *warmup*: começar com
     volume baixo e crescer gradualmente; engajamento real melhora a reputação.
   - Pedir aos destinatários de teste (time do cliente) para marcar **"Não é
     spam"** / mover para a caixa principal — sinal forte de reputação.
   - Rever o conteúdo: assuntos de urgência ("Última chance", "expira em breve")
     e HTML pesado (7,6 KB) empurram para Promoções/Spam. Reduzir peso, manter
     bom ratio texto/imagem, um CTA claro.

> **Aba Promoções ≠ falha.** Gmail coloca e-mail de marketing em Promoções por
> padrão — isso é esperado e "funciona". Só **Spam** é problema de entrega real.
> Calibrar a expectativa do cliente sobre isso.

### (Futuro, opcional) Subdomínio dedicado `envio.koblay.io`

Best-practice para isolar a reputação de marketing da raiz (protege e-mails
corporativos/transacionais de `koblay.io` caso um tenant faça spam). Se/quando
adotado: adicionar `envio.koblay.io` como domínio no Resend, publicar os
registros DKIM/SPF/MX que ele pedir, DMARC dedicado, e setar
`resend_sending_domain = envio.koblay.io`. **Fora do escopo desta fase.**

## Frente 2 — Conformidade de remetente em massa (código)

### 2.1 Tabela de supressão

Nova tabela `email_suppressions`:

| coluna | tipo | nota |
|---|---|---|
| `id` | uuid pk | |
| `email` | text (lower) | destinatário |
| `organization_id` | uuid null | `null` = supressão global (hard bounce) |
| `reason` | text | `unsubscribe` \| `bounce` \| `complaint` |
| `source` | text | `header` \| `link` \| `webhook` |
| `created_at` | timestamptz default now() | |

- Índice único parcial por `(email, organization_id)`.
- RLS: escrita só service_role (edge functions); leitura pela org dona.
- **Regra de envio:** antes de enviar a um destino, o worker pula se existir
  linha com `email = destino` e (`organization_id IS NULL` **ou**
  `organization_id = org`). Marca o recipient como `pulado`
  (`last_error='suprimido'`), sem chamar o Resend.

### 2.2 Endpoint de descadastro (`unsubscribe` edge function, verify_jwt=false)

- **Token stateless assinado** (HMAC-SHA256, secret `unsubscribe_secret` no
  Vault): `token = base64url(org_id.email.ts) + "." + base64url(hmac)`.
  Sem estado no banco; imutável e não forjável.
- `GET  /unsubscribe?token=…` → valida HMAC → grava supressão
  (`reason='unsubscribe'`, `source='link'`) → devolve página HTML simples de
  confirmação (marca do tenant no título, sem login).
- `POST /unsubscribe` (RFC 8058, one-click) → mesma lógica, resposta 200 vazia.
  Necessário para `List-Unsubscribe-Post`.
- Idempotente (upsert).

### 2.3 Headers e Reply-To em todos os envios de marketing

Nos três pontos que chamam `api.resend.com/emails`
(`process-bulk`, `process-steps`, `send-email`), o payload passa a incluir:

```jsonc
{
  "from": "...", "to": ["..."], "subject": "...", "html": "...",
  "reply_to": "<reply-to da org>",           // ver 2.4
  "headers": {
    "List-Unsubscribe": "<https://…/functions/v1/unsubscribe?token=TT>, <mailto:unsubscribe@koblay.io>",
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
  }
}
```

- `TT` é o token por destinatário (2.2).
- O template (`emailTemplate.js`) troca o `href="#"` do "Descadastrar" por um
  placeholder `{{unsubscribe_url}}`, substituído por destinatário no worker
  (mesma mecânica de `{{nome}}`/`{{cta_link}}`).

### 2.4 Reply-To por org

`organizations` não tem campo de contato. Adicionar coluna nullable
`reply_to_email` (editável em Integrações → aba Domínio/Remetente). Resolução:
`reply_to_email` da org → e-mail do profile fundador → omitir Reply-To.

## Frente 3 — Webhook de entrega + supressão automática (código + config)

### 3.1 Estender `resend-webhook`

Ampliar o `MAP` para tratar, além de `opened`/`clicked`:

| Evento Resend | `email_events.event` / `status` | Ação extra |
|---|---|---|
| `email.delivered` | `delivered` / `entregue` | — |
| `email.bounced` (hard) | `bounce` / `bounce` | insere supressão **global** (`organization_id NULL`, `reason='bounce'`) |
| `email.complained` | `complaint` / `reclamado` | insere supressão **da org** (`reason='complaint'`) |
| `email.delivery_delayed` | `deferred` / `adiado` | — |

- A resolução de org/campanha reusa o casamento por `sg_message_id` já existente.
- A verificação de assinatura svix (`resend_webhook_secret`) já está implementada
  — mantida.

### 3.2 Config no painel Resend (operacional)

- Adicionar webhook → `${SUPABASE_URL}/functions/v1/resend-webhook`.
- Assinar os eventos: `email.delivered`, `email.bounced`, `email.complained`,
  `email.delivery_delayed`, `email.opened`, `email.clicked`.
- Copiar o signing secret para o Vault (`resend_webhook_secret`).

## Sequência de entrega

1. **Frente 2** (List-Unsubscribe one-click + Reply-To + descadastro funcional +
   supressão) — o principal lever de Spam → caixa de entrada. Prioridade máxima.
2. **Frente 3** (webhook delivered/bounced/complained + eventos no painel +
   auto-supressão) — visibilidade e proteção da reputação.
3. **Frente 1** (config `resend_sending_domain=koblay.io` + warmup/conteúdo) —
   alinhamento + reputação gradual; sem bloqueio, feito em paralelo.

## Verificação (por frente)

- **F1:** enviar teste a um Gmail → "Mostrar original" mostra `SPF=PASS`,
  `DKIM=PASS`, `DMARC=PASS` (já esperado); rodar mail-tester.com e mirar ≥ 8/10;
  confirmar se cai em **Promoções** (ok) vs **Spam** (agir).
- **F2:** enviar teste → header `List-Unsubscribe` presente; clicar o link →
  linha em `email_suppressions`; novo disparo ao mesmo endereço → recipient
  `pulado` (`suprimido`), sem chamada ao Resend.
- **F3:** disparar teste → chegam eventos `delivered` em `email_events`; simular
  bounce (endereço `bounced@resend.dev`) → evento `bounce` + supressão global.

## Riscos / decisões em aberto

- **Reputação compartilhada:** um tenant com conteúdo spammy prejudica todos.
  Mitigação nesta fase: supressão automática de bounce/reclamação + monitorar a
  taxa de spam via webhook. Controles de conteúdo/limite por tenant ficam para
  uma fase futura.
- **`p=quarantine`/`p=reject`:** só após validar relatórios DMARC (`rua`).
- **Reputação fria + conteúdo promocional:** mesmo com tudo certo, a saída do
  Spam é gradual (warmup + engajamento). List-Unsubscribe + supressão aceleram,
  mas não são instantâneos.
- **Enviar marketing pela raiz `koblay.io`:** um tenant spammy pode manchar a
  reputação da raiz (afeta e-mails corporativos/transacionais). Mitigação nesta
  fase: supressão automática; a médio prazo, migrar para o subdomínio dedicado
  `envio.koblay.io` (seção Futuro da Frente 1).
