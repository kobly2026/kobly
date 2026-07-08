# Templates de e-mail de Auth (Supabase)

E-mails transacionais do GoTrue (confirmação, convite, recuperação, magic link)
com o visual da marca Koblay. O GoTrue **não** versiona templates via código —
este diretório é a referência; o HTML é colado no dashboard.

## Como aplicar

**Dashboard → Authentication → Emails → Templates** e cole cada arquivo:

| Arquivo | Template no dashboard | Assunto sugerido |
|---|---|---|
| `confirm-signup.html` | Confirm signup | Confirme seu e-mail — Koblay |
| `invite-user.html` | Invite user | Você foi convidado para a Koblay |
| `reset-password.html` | Reset password | Redefinir sua senha — Koblay |
| `magic-link.html` | Magic Link | Seu link de acesso — Koblay |

O link de ação usa a variável `{{ .ConfirmationURL }}`, substituída pelo GoTrue no envio.

## Regenerar

Os arquivos são gerados a partir do `renderEmail` (`src/lib/emailTemplate.js`),
a mesma engine dos e-mails de campanha — então o visual nunca diverge da marca.

```
node supabase/email-templates/generate.mjs
```
