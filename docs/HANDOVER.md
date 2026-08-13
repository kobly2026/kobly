# KOBLY — Handover técnico

> Gerado 2026-08-13 · branch `main` · remote `origin` = `kobly2026/kobly` · espelho visual: [`HANDOVER.html`](./HANDOVER.html)  
> Fatos do repositório — incertezas marcadas. Sem secrets.

## 1. Em uma frase

**Kobly** (domínio `koblay.io`, package `koblay`) é o console SaaS de **automação de recuperação de vendas**: eventos de checkout disparam campanhas de e-mail/WhatsApp/SMS com fluxo visual, billing via Asaas, e suporte (IA + humano) multi-tenant no Supabase.

## 2. Stack e estrutura do repo

App único (não monorepo). v0.1.0.

| Camada | Escolha | Status |
|--------|---------|--------|
| Front | Vite 5 · React 18 · alias `@` → `src/` | ok |
| Backend | Supabase (Postgres/RLS, Auth, Edge Deno, Realtime, Storage, Vault) | ok |
| UI | `src/ds/` + tokens CSS “Carvão Quente” — sem Tailwind | ok |
| Charts / ícones | apexcharts · lucide-react (Icon dinâmico — dívida de bundle) | legado |
| Package manager | npm (`package-lock.json`) | ok |
| Node | 20 (Netlify) | ok |
| Deploy | Netlify SPA → `dist/` · `app.koblay.io` | ok |
| Integrações | Resend · Z-API · Asaas · DeepSeek (`ai-chat`) | ok |

```
src/          ds/, api/, store/, shell/, routes/, styles/tokens/
supabase/     migrations/ (0001…0066, sem 0064), functions/
docs/         histórico + go-live + superpowers specs/plans
```

**Legado de nome:** `mockApi.js` / `KoblyMockDB` falam com Supabase de verdade. Prefixos `Kobly*` nas telas vêm do protótipo.

## 3. Arquitetura runtime

```
Browser (Vite SPA / Netlify)
    │  VITE_SUPABASE_* + Realtime + Edge invoke
    ▼
Supabase — Auth · Postgres/RLS · Storage · Vault
    │  Edge: process-steps/bulk, send-*, webhook/postback,
    │        asaas(+webhook), resend-*, zapi-webhook, ai-chat, unsubscribe…
    ▼
Resend · Z-API · Asaas · DeepSeek
```

- Multi-tenant por `organization_id` (RLS). Signup → e-mail → RPC `create_own_org` (Starter).
- Project ref documentado: `hvkuymprmfrjrgpqaxbw`. Staging separado: **a confirmar**.

## 4. Como rodar local + envs

```bash
npm install
cp .env.example .env   # VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm run dev            # http://localhost:5173
npm run build && npm run preview
```

| Nome | Onde | Uso |
|------|------|-----|
| `VITE_SUPABASE_URL` | .env / Netlify | Client (obrigatória no build prod) |
| `VITE_SUPABASE_ANON_KEY` | .env / Netlify | Anon key no bundle |
| `deepseek_api_key` | Vault | `ai-chat` |
| `resend_api_key`, `resend_from`, `resend_sending_domain` | Vault | E-mail |
| Credenciais Z-API | Vault | WhatsApp (global, não por org) |
| `asaas_api_key`, `asaas_env`, `asaas_webhook_token` | Vault | Billing + auth webhook |
| `unsubscribe_secret`, `resend_webhook_secret` | Vault | Unsub / Svix |

Credenciais de integração no **Vault** via `get_secret()` — não em “Edge Functions → Secrets”. Sem Docker Compose no repo.

## 5. Domínio de produto

| Papel | Home | Nav (resumo) |
|-------|------|--------------|
| Cliente | Dashboard | painel · pipeline · campanhas · disparos · leads · integrações · planos · chamados · ajuda · perfil |
| Gestor | Dashboard | + clientes · relatórios |
| Suporte | Chamados | chamados · leads · ajuda · perfil |
| Administrador | Dashboard | painel · clientes · relatórios · planos · segurança · chamados · perfil |

**Golden path:** login/org → integrações (webhook + Resend) → campanha FlowBuilder → evento → worker → métricas → planos Asaas.

Personas demo (seed 0013) — e-mails em `src/api/demoPersonas.js`: `vitor@dizevolv.com`, `joao@lojadojoao.com.br`, `marina@kobly.com`, `daniela@kobly.com`. Senha **não** repetida aqui (arquivo no repo; rotacionar/remover em prod).

## 6. Dados / domínio analítico crítico

- Uso: `usage_counters`, `usage_period_history`, `org_pode()`, `enforce_limite_*`, `bulk_reserve_usage`.
- Isenção: `organizations.limites_isentos` — em 2026-07-30 as 9 orgs `true` de propósito.
- Billing: `valor_*`, `preco_excedente`; lógica `_shared/billing_cycle.ts` inlinada no `asaas`.
- CTA: Task 11 de extração determinística **bloqueada** (payload externo).
- Deliverability: `email_suppressions`, unsub assinado, List-Unsubscribe.

**Antes de faturar:** `asaas_activate_plan` zera uso sem arquivar em `usage_period_history` (follow-up documentado).

## 7. Estado atual do trabalho

**Feito (recente):** cobrança real dos planos (semestral, excedente, gates) — merge `6185d40`; schema `0063` + `0065`/`0066`; CTA lote; marca Lexend/#FF6201; deliverability SDD.

**WIP:** untracked `doc-top.jpeg`; stash `wip-gti-sms-unrelated-to-task7-review`; branches `feat/checklist-infra-botoes`, `fix/auditoria-e2e-criticos`.

**Bloqueado / decisão:**

- Task 6 / `0064` **cancelada** — não forçar `limites_isentos=false`.
- CTA Task 11 — dependência plataforma (evento real no banco).
- Segurança `create_postback_token` — detalhes **fora** do repo público.
- Go-live dashboard (Redirect URLs, SMTP, demos) — doc 07.

HEAD: `a7d72ac`.

## 8. Remotes e branches úteis

| Remote | URL |
|--------|-----|
| `origin` | `git@github.com:kobly2026/kobly.git` |
| `dizevolv` | `git@github.com:DizevolvTech/kobly.git` |

`main` sync com `origin/main`.

## 9. Ops / deploy / backup

- Netlify: `netlify.toml` (build, Node 20, SPA fallback, headers). Envs `VITE_*`.
- DNS: CNAME `app` → Netlify.
- `asaas-webhook` **fail-open** se token Vault ausente.
- CI GitHub Actions: **ausente** no repo.
- Backups Postgres: **a confirmar** (plano Supabase).

Runbooks: `docs/07_GO_LIVE_CHECKLIST.md`, `docs/08_INFRA_ASAAS_DNS_RESEND.md`, README § Deploy.

## 10. Convenções para quem assume

- Sem `CONVENTIONS.md` / `AGENTS.md` / `CLAUDE.md` — usar README + `docs/superpowers/`.
- Migrations `00NN_nome.sql`; próximo após `0066` (não reusar `0064` sem ler o plano).
- Edge: `_shared/` + `deno test`; **inlinar** na function no deploy.
- Tokens semânticos CSS; gates de plano no **Postgres**.
- `verify_jwt` em `supabase/config.toml`.

## 11. Contatos / contexto de negócio

- `koblay.io` · `app.koblay.io` · `contato@koblay.io`
- Agência DizevolvTech (persona Gestor)
- 9 orgs de teste isentas (doc 2026-07-30); “Digital” acima do limite Starter de integrações
- Contatos humanos extras: **não listados no repo**

## 12. Checklist do próximo engineer

- [ ] Clonar, `npm install`, `.env`, `npm run dev`, persona DEV
- [ ] Ler README + doc 08 + spec/plano planos 2026-07-30
- [ ] Confirmar Vault `asaas_webhook_token` (POST sem header → 401)
- [ ] Auth Redirect URLs + SMTP Resend (doc 07)
- [ ] Não ativar `limites_isentos=false` sem decisão comercial
- [ ] Antes de faturar: corrigir starve de `usage_period_history`
- [ ] Tratar item de segurança postback por canal privado
- [ ] CTA Task 11 só com payload real
- [ ] Plano de remoção das personas demo em prod
- [ ] Mapear acessos Netlify + Supabase

## 13. Índice de docs críticos

| Doc | Para quê |
|-----|----------|
| [README.md](../README.md) | Estado atual |
| [07_GO_LIVE_CHECKLIST.md](./07_GO_LIVE_CHECKLIST.md) | Auth/SMTP/demos |
| [08_INFRA_ASAAS_DNS_RESEND.md](./08_INFRA_ASAAS_DNS_RESEND.md) | Asaas/DNS/Resend |
| [spec planos](./superpowers/specs/2026-07-30-planos-cobranca-real-design.md) | Decisões + cancelamento 0064 |
| [plano planos](./superpowers/plans/2026-07-30-planos-cobranca-real.md) | Tasks + follow-ups |
| [plano CTA](./superpowers/plans/2026-07-21-cta-link-recuperacao.md) | Task 11 bloqueada |
| [docs/README.md](./README.md) | Histórico Bubble (referência) |
| [supabase/config.toml](../supabase/config.toml) | verify_jwt |
