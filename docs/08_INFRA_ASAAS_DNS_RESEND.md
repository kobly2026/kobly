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
```

4. Deploy da function:
```bash
supabase functions deploy asaas
```

### 1.2 O que o app faz
- Edge function `asaas`: `status`, `create_customer`, `create_payment`, `create_subscription`.
- UI em **Planos**: botão “Assinar com Asaas (PIX)” quando a key está configurada.
- `organizations.asaas_customer_id` guarda o customer criado no Asaas.

### 1.3 Produção
1. Conta real em [https://www.asaas.com](https://www.asaas.com).
2. Trocar Vault: `asaas_api_key` (prod) + `asaas_env=production`.
3. Webhook de pagamento (opcional, futuro): URL da function + eventos `PAYMENT_RECEIVED`.

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

## 5. SMS (Twilio)

### 5.1 Secrets (Vault)
| Vault key | Exemplo |
|-----------|---------|
| `twilio_account_sid` | `AC...` |
| `twilio_auth_token` | `...` |
| `twilio_from` | número E.164 (`+15005550006`) **ou** Messaging Service SID (`MG...`) |

### 5.2 O que o app faz
- Edge function `send-sms`: envio de teste (form-urlencoded + Basic auth Twilio).
- `process-steps` ganhou o card **Envio de SMS** no fluxo (`flow_steps.sms_message_id`).
- UI: **Integrações → SMS** (templates + teste) e card SMS no FlowBuilder.
- Métrica separada: `campaign_stats.sms_enviados`; eventos em `email_events` com `channel='sms'`.
- Atenção PT-BR: acentos usam UCS-2 (70/67 chars por segmento) — o editor mostra a contagem.

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

### Novidades (0037–0039)
- enum `tipo_card_fluxo` += `Envio de SMS`
- `sms_messages` (templates SMS) + `flow_steps.sms_message_id`
- `email_events.channel` aceita `sms`; `campaign_stats.sms_enviados`
- `bulk_sends` + `bulk_send_recipients` + RPCs `bulk_count_audience` / `bulk_enqueue_recipients`
- cron `kobly-process-bulk` (a cada minuto)
