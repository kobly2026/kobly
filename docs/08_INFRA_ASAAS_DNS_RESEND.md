# Kobly — Infraestrutura: Asaas, DNS e Resend

> Setup manual (dashboard / Vault) para gateway de pagamento, domínio da app e remetente de e-mail.

---

## 1. Asaas (sandbox → produção)

### 1.1 Conta sandbox com o cliente
1. Acesse [https://sandbox.asaas.com](https://sandbox.asaas.com) e crie a conta.
2. Em **Integrações → API Key**, gere a chave sandbox (`$aact_...`).
3. Guarde a chave no Supabase Vault:

```sql
-- Via dashboard: Project Settings → Vault, ou RPC get_secret se já tiver helper
-- Nomes esperados pela edge function `asaas`:
--   asaas_api_key  = chave da API
--   asaas_env      = 'sandbox' | 'production'  (default: sandbox)
--
-- E pela function `asaas-webhook` (ver §1.4):
--   asaas_webhook_token = shared secret do header `asaas-access-token`
```

> **Vault, não "Edge Functions → Secrets".** São dois cofres diferentes no mesmo
> dashboard. Todas as integrações deste projeto leem via a RPC `get_secret()`, que
> consulta o **Vault** (`Integrations → Vault`). Valor colado em *Edge Functions →
> Secrets* vira variável de ambiente, fica salvo e válido, e é **invisível** para as
> functions — nenhuma delas usa `Deno.env.get()` para credencial.

4. Deploy da function:
```bash
supabase functions deploy asaas
```

### 1.2 O que o app faz
- Edge function `asaas`: `status`, `create_customer`, `create_payment`, `create_subscription`.
- UI em **Planos**: botão “Assinar com Asaas (PIX)” quando a key está configurada.
- `organizations.asaas_customer_id` guarda o customer criado no Asaas.

### 1.2.1 CPF/CNPJ do titular (obrigatório no gateway)
- `POST /customers` do Asaas exige `cpfCnpj`. A fonte é **`organizations.documento`**
  (migration `0060_org_documento.sql`) — nunca o body da requisição, que seria
  entrada não validada.
- Sem documento na org, a function devolve `documento_ausente` (HTTP 400) e a tela
  de **Planos** abre um modal pedindo o CPF/CNPJ antes de gerar a cobrança. O
  Gestor também informa no cadastro/edição da conta em **Clientes**.
- O documento é guardado **normalizado** (sem máscara, A–Z maiúsculo) e validado
  pelo CHECK `organizations_documento_valido` → `public.is_documento_br()`.
- **CNPJ alfanumérico (IN RFB nº 2.229/2024, vigente desde jul/2026)**: 1–12 em
  `[0-9A-Z]`, 13–14 DV numérico; DV em módulo 11 com valor de caractere
  `ASCII − 48`. O mesmo algoritmo valida o CNPJ numérico legado — não há
  validador antigo em paralelo. Espelho em JS (UX): `src/lib/documento.js`,
  testado em `supabase/functions/_shared/documento_test.ts`.
- Pendência externa: confirmar com o Asaas se a API v3 já aceita `cpfCnpj`
  alfanumérico (validação é do lado deles).

### 1.3 Produção
1. Conta real em [https://www.asaas.com](https://www.asaas.com).
2. Trocar Vault: `asaas_api_key` (prod, prefixo `aact_prod_`) **e** `asaas_env=production`.
   As duas juntas: a chave de homologação (`aact_hmlg_`) só autentica contra
   `sandbox.asaas.com`, então trocar só uma das pontas dá 401.
3. Exigir o `asaas_webhook_token` (§1.4) antes de aceitar pagamento real.

### 1.4 Webhook de pagamento — autenticação obrigatória
- `asaas-webhook` roda com `verify_jwt = false` (é webhook, o Asaas não manda JWT), então
  a autenticação é o header **`asaas-access-token`** comparado com a secret Vault
  `asaas_webhook_token` via `safeEqual`.
- **Atenção ao fail-open:** o teste é `if (expectedToken)`. Com a secret **ausente**, a
  function segue sem exigir header nenhum — e aí qualquer POST na URL pública forja um
  `PAYMENT_RECEIVED` e marca plano como pago. A secret existir não é detalhe de conforto:
  é o que fecha a porta.
- O **mesmo valor** vai nos dois lados: Vault + campo de token no painel do Asaas
  (Integrações → Webhooks). Se divergirem, o Asaas toma 401 e o pagamento acontece sem
  que o plano seja marcado — falha silenciosa do lado do cliente.
- Gerar: `openssl rand -hex 32` (hex, não base64 — `+`, `/` e `=` atrapalham em header HTTP).
- Verificar que está fechado: `POST` sem header na URL da function deve devolver
  `401 {"error":"unauthorized"}`.

---

## 2. Domínio da app (app.koblay.io) — DNS

| Tipo  | Host | Valor |
|-------|------|--------|
| CNAME | `app` | `<seu-site>.netlify.app` |

1. Netlify → Domain management → Add custom domain `app.koblay.io`.
2. DNS do registrador: CNAME `app` → site Netlify.
3. SSL automático (Let's Encrypt) após propagação.
4. Supabase Auth → URL Configuration:
   - Site URL: `https://app.koblay.io`
   - Redirect URLs: `https://app.koblay.io`, `http://localhost:5173`

---

## 3. Remetente customizado (Resend)

### 3.1 Secrets
| Vault key | Exemplo |
|-----------|---------|
| `resend_api_key` | `re_...` |
| `resend_from` | `Kobly <contato@koblay.io>` (fallback plataforma) |
| `resend_sending_domain` | `koblay.io` — subdomínio de envio da plataforma (remetente por org) |

### 3.0 Remetente por org — subdomínio automático (zero-DNS por cliente) ⭐
Prioridade do From no worker (`process-steps`/`process-bulk`):
1. **Domínio próprio verificado** do cliente (Resend real, `id_resend` ≠ `sg_*`).
2. **Subdomínio automático da plataforma**: `<organizations.sender_local>@<resend_sending_domain>`
   (ex.: `loja-do-joao-d47ca6@koblay.io`). `sender_local` é gerado do nome + id (migration 0040).
   Requer `resend_sending_domain` setado E o domínio verificado no Resend. **Zero DNS por cliente.**
3. **Fallback**: `resend_from` (`contato@koblay.io`).

> **Config atual:** `resend_sending_domain = koblay.io` (já verificado; funciona no plano base do
> Resend, que permite 1 domínio). Para isolar reputação depois (plano pago), verifique um subdomínio
> dedicado (`envio.koblay.io`) no Resend + DNS do koblay.io e troque o secret — nada mais muda.
>
> ⚠️ A `resend_api_key` atual é **restrita a envio** — NÃO gerencia domínios. O fluxo "domínio
> próprio" (3.2) e a criação de novos domínios de envio exigem uma key de **acesso total** no Vault.

### 3.2 Fluxo no app (Integrações → Domínio / Remetente)
1. Cliente adiciona domínio (ex.: `envio.sualoja.com.br`).
2. Resend devolve registros DNS (SPF/DKIM) → UI lista host/valor.
3. Cliente publica no DNS do domínio.
4. Clica **Verificar DNS**.
5. Quando `status=verified`, o `process-steps` usa `domains.from_email` como endereço From daquela org.

### 3.3 Deploy
```bash
supabase functions deploy resend-admin
supabase functions deploy process-steps
supabase functions deploy send-email
```

### 3.4 Auth e-mails (confirmação/convite)
SMTP custom no Supabase Auth → Resend:
- Host `smtp.resend.com` · Port `465` · User `resend` · Password = API key  
- Sender: `contato@koblay.io` · Name: `Kobly`

---

## 4. WhatsApp botões (Z-API)

Secrets já usadas: `zapi_instance_id`, `zapi_token`, opcional `zapi_client_token`.

Envio:
- Texto puro → `/send-text`
- Com botões CTA → `/send-button-actions` (`URL` | `CALL` | `REPLY`)

Deploy:
```bash
supabase functions deploy send-whatsapp
supabase functions deploy process-steps
```

---

## 5. SMS (GTI SMS)

> Substituiu o Twilio em jul/2026. As secrets `twilio_*` foram **removidas do Vault** e
> nenhuma function as lê — não recadastre. O par SID/Auth Token e o `twilio_from` não têm
> equivalente aqui: a GTI autentica por um único Bearer e o remetente é da conta dela.

### 5.1 Secrets (Vault)
| Vault key | Exemplo |
|-----------|---------|
| `gti_sms_token` | token da API v3, formato `404\|xxxxx` — enviado como `Authorization: Bearer` |

### 5.2 O que o app faz
- Edge function `send-sms`: envio de teste (JSON + Bearer, `POST https://sms.gtisms.com/api/v3/sms/send`).
- `process-steps` ganhou o card **Envio de SMS** no fluxo (`flow_steps.sms_message_id`).
- UI: **Integrações → SMS** (templates + teste) e card SMS no FlowBuilder.
- Métrica separada: `campaign_stats.sms_enviados`; eventos em `email_events` com `channel='sms'`.
- Número vai **sem `+`** (`5511988887777`); o Twilio exigia o prefixo, a GTI não aceita.
- Atenção PT-BR: a GTI só aceita **GSM-7** e rejeita acento/emoji, então o corpo passa por
  `toGsm7` antes de sair (inlinado em `send-sms`, `process-steps` e `process-bulk` — deploy
  por função não empacota `../_shared/`). Por isso a contagem é sempre 160/153: não existe
  mais o caso UCS-2 (70/67) do Twilio. O editor mostra o texto **como sai**, já transliterado.
- Resultado é lido **fail-closed**: exige HTTP ok **e** `status === "success"`, porque a GTI
  pode responder 200 com erro no corpo. O `500 "Unauthenticated."` (token inválido) não é 4xx,
  então é tratado como retentável — se o SMS parar de sair sem erro fatal, suspeite do token.

### 5.3 Deploy
```bash
supabase functions deploy send-sms
supabase functions deploy process-steps
```

---

## 6. Disparo em massa (email / WhatsApp / SMS)

- Edge `bulk-send` (control): `estimate`, `create`, `status`, `cancel` (authz por org).
- Worker `process-bulk` (cron, drena `bulk_send_recipients`) — separado do `process-steps`
  para não disputar o orçamento da recuperação.
- UI: rota **Disparo em massa** (nav de Cliente/Gestor). Audiência: todos / por tag / por
  último evento. Respeita limite de plano (`usage_counters` vs `plans.limite_execucoes`).
- `email_events` do disparo usam `campaign_id = null` (não contaminam "recuperado").

### 6.1 Deploy
```bash
supabase functions deploy bulk-send
supabase functions deploy process-bulk
```

---

## 7. Migrations a aplicar

```bash
supabase db push
# ou aplicar na ordem:
# 0034_checklist_ajustes.sql
# 0035_infra_botoes_dominio_asaas.sql
# 0036_recuperado_authz_fixes.sql
# 0037_sms_card_enum.sql          (enum 'Envio de SMS' — standalone, antes de 0038)
# 0038_sms_tables.sql             (sms_messages, flow_steps.sms_message_id, sms_enviados)
# 0039_bulk_sends.sql             (bulk_sends + recipients + RPCs + cron process-bulk)
```

### Colunas novas (0035)
- `whatsapp_messages.botoes` jsonb
- `domains.id_resend`, `from_email`, `status`
- `organizations.asaas_customer_id`
- `profiles.whatsapp_teste`

### Colunas novas (0060)
- `organizations.documento` — CPF/CNPJ normalizado do titular, exigido pelo Asaas.
  CHECK `organizations_documento_valido` (`public.is_documento_br`), aceita CNPJ
  alfanumérico da IN RFB 2.229. Ver §1.2.1.

### Novidades (0037–0039)
- enum `tipo_card_fluxo` += `Envio de SMS`
- `sms_messages` (templates SMS) + `flow_steps.sms_message_id`
- `email_events.channel` aceita `sms`; `campaign_stats.sms_enviados`
- `bulk_sends` + `bulk_send_recipients` + RPCs `bulk_count_audience` / `bulk_enqueue_recipients`
- cron `kobly-process-bulk` (a cada minuto)
