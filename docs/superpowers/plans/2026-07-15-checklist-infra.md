# Checklist + Infra Implementation Plan

> **For agentic workers:** Este plano documenta o trabalho **já executado** de forma ad-hoc e define a verificação/correção restante.  
> Spec: `docs/superpowers/specs/2026-07-15-checklist-infra-design.md`

**Goal:** Entregar bugs do checklist + botões interativos + infra Resend/Asaas de forma revisável e verificada.

**Architecture:** Ajustes de schema (0034/0035) + edge functions (process-steps, postback, send-*, resend-admin, asaas) + UI React nas rotas de fluxo/integrações/planos/campanhas.

**Tech Stack:** Vite + React 18, Supabase (Postgres/RLS/Edge), Resend, Z-API, Asaas.

---

## Mapa de arquivos (já tocados)

| Arquivo | Responsabilidade |
|---------|------------------|
| `supabase/migrations/0034_*.sql` | RLS webhook, recuperado, planos |
| `supabase/migrations/0035_*.sql` | botoes, domains Resend, asaas, whatsapp_teste |
| `supabase/functions/process-steps` | Fila + WA buttons + from por org |
| `supabase/functions/postback-receiver` | Crédito recuperado com e-mail pré-compra |
| `supabase/functions/send-email` | fromName |
| `supabase/functions/send-whatsapp` | send-button-actions |
| `supabase/functions/resend-admin` | Domínio por org |
| `supabase/functions/asaas` | Gateway sandbox/prod |
| `src/routes/*` | UI dos itens do checklist |
| `src/api/mockApi.js` | API client |

---

### Task 1: Isolar em branch + documentar

- [x] Branch `feat/checklist-infra-botoes`
- [x] Spec retroativa
- [x] Este plan

### Task 2: Verificar build local

- [x] `npm run build` → exit 0 (vite 1.6s)

### Task 3: Verificar remoto (MCP supabase_kobly)

- [x] Migrations `checklist_ajustes`, `infra_botoes_dominio_asaas`, `recuperado_authz_fixes`
- [x] Colunas novas existem
- [x] Functions redeployadas pós-review

### Task 4: Code review

- [x] Subagent review — **NO merge** (Critical IDOR + recuperado inconsistente)
- [x] Corrigido: authz resend-admin/asaas; recuperado SQL temporal; WA órfão; template email missing; send-email sem from arbitrário; RPC atômica

### Task 5: Smoke manual (pós-review)

- [ ] Editor e-mail salva e reabre
- [ ] Preview não redireciona
- [ ] WhatsApp com botão CTA (se Z-API ok)
- [ ] Domínio tab lista/cria (se resend key ok)
- [ ] Asaas status (not_configured sem key é OK)

### Task 6: Commit / PR (após review verde)

- [ ] Commits atômicos na branch `feat/checklist-infra-botoes`
- [ ] PR para main (não force-push)

### Ainda em aberto (Important residual)

- `saveFlow` apaga steps e cascateia fila de campanha Ativa (pré-existente, alta severidade operacional)
- Asaas PIX QR incompleto (só invoiceUrl)
- `database.types.ts` não regenerado
- Sem testes automatizados
