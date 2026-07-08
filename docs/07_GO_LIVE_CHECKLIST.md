# Kobly — Checklist de Go-Live (Dashboard Supabase)

> Última atualização: 07/07/2026.
> Configurações manuais no dashboard do Supabase que **não vivem no repositório**.
> Valores verificados neste projeto:
> - **Project URL:** `https://hvkuymprmfrjrgpqaxbw.supabase.co`
> - **Domínio verificado no Resend:** `koblay.io` → remetente `contato@koblay.io`
> - **`resend_from` (Vault):** `contato@koblay.io` ✅
> - **`resend_api_key` (Vault):** presente ✅

---

## 🔴 EMAIL-3 — Redirect URLs (sem isto o signup quebra)

**Onde:** Authentication → URL Configuration

- **Site URL:** `https://app.koblay.io` ✅ (já feito)
- **Redirect URLs** (allowlist) — **FALTA ADICIONAR**:
  ```
  https://app.koblay.io
  http://localhost:5173
  ```
  Sem estes na allowlist, o `emailRedirectTo` do código é **ignorado** e o link de
  confirmação cai de volta na Site URL genérica.

---

## 🟠 EMAIL-2 — SMTP custom do Auth com Resend (identidade Kobly)

**Problema:** os e-mails de confirmação/convite/reset saem pelo SMTP built-in do
Supabase (genérico, rate-limit, só entrega para membros do time).

**Solução:** rotear pelo **Resend** (mesmo provedor das campanhas).

### Valores para colar (Authentication → Email → SMTP Settings)

| Campo | Valor |
|-------|-------|
| **Host** | `smtp.resend.com` |
| **Port** | `465` |
| **Username** | `resend` |
| **Password** | sua API key do Resend (`re_...`) — mesma do Vault |
| **Sender email** | `contato@koblay.io` |
| **Sender name** | `Kobly` |

### Alternativa: Management API (automatizável)

```bash

---

## 🟠 EMAIL-2 (templates) — Auth com a marca Kobly

**Onde:** Authentication → Email Templates. Use as variáveis nativas
(`{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .Email }}`, `{{ .SiteURL }}`).

### Confirm signup
```html
<div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
  <h1 style="color: #ff6800; font-size: 22px;">Bem-vindo ao Kobly!</h1>
  <p style="color: #333; line-height: 1.6;">Confirme seu e-mail para ativar sua conta e começar a recuperar vendas.</p>
  <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: #ff6800; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">Confirmar e-mail</a>
  <p style="color: #888; font-size: 13px; margin-top: 24px;">Se você não criou uma conta no Kobly, ignore este e-mail.</p>
</div>
```

### Invite user
```html
<div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
  <h1 style="color: #ff6800; font-size: 22px;">Você foi convidado para o Kobly</h1>
  <p style="color: #333; line-height: 1.6;">Sua conta está pronta. Defina sua senha para acessar.</p>
  <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: #ff6800; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">Definir senha e acessar</a>
</div>
```

### Reset password
```html
<div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
  <h1 style="color: #ff6800; font-size: 22px;">Redefinir senha</h1>
  <p style="color: #333; line-height: 1.6;">Recebemos uma solicitação para redefinir sua senha no Kobly.</p>
  <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: #ff6800; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">Redefinir senha</a>
  <p style="color: #888; font-size: 13px; margin-top: 24px;">Se não foi você, ignore este e-mail.</p>
</div>
```

---

## ✅ EMAIL-1 — Política de domínio de envio

**Estado:** ✅ **Definida e implementada.** Sem ação de dashboard necessária.

- Remetente padrão: `contato@koblay.io` (domínio verificado no Resend).
- Domínio próprio por marca: suportado pela arquitetura multi-marca (MARCA-1).
  Cada marca pode ter seu domínio verificado no Resend separadamente.

---

## 🟢 Segurança — complementos do go-live

| Item | Onde | Ação |
|------|------|------|
| **Leaked Password Protection** | Authentication → Sign In / Providers | Habilitar (HaveIBeenPwned) |
| **Personas demo** | Auth → Users | Remover os `*@kobly.com` da seed 0013 (senha publicada no repo) |

---

## Ordem de execução recomendada

1. 🔴 **EMAIL-3** — Redirect URLs (5 min) — sem isto o signup quebra
2. 🟠 **EMAIL-2 SMTP** — Configurar Resend SMTP (10 min)
3. 🟠 **EMAIL-2 Templates** — Colar os 4 templates (10 min)
4. 🟢 **Segurança** — Leaked password + remover demos (5 min)
5. ✅ **EMAIL-1** — Sem ação

**Total: ~30 min de dashboard.**

export SUPABASE_ACCESS_TOKEN="seu-token"   # dashboard/account/tokens
curl -X PATCH "https://api.supabase.com/v1/projects/hvkuymprmfrjrgpqaxbw/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"smtp_host":"smtp.resend.com","smtp_port":"465","smtp_user":"resend","smtp_pass":"SUA_API_KEY","smtp_admin_email":"contato@koblay.io","smtp_sender_name":"Kobly"}'
```

> ✅ Pré-requisito cumprido: domínio `koblay.io` já verificado no Resend.
