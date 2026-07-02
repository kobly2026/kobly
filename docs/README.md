# Kobly — Documentação (histórico da migração)

> **Status:** HISTÓRICO · Extraído por engenharia reversa do editor Bubble do app `kobly` em 25/06/2026,
> como insumo da migração. A reconstrução foi concluída em **Vite + React + Supabase** (não Next.js) e o
> produto vive no código — para o estado atual, veja o [`README.md` da raiz](../README.md).
> Estes documentos permanecem como referência do modelo de dados/regras do legado.

---

## Documentos

| # | Arquivo | Conteúdo |
|---|---|---|
| 01 | [`01_ESPECIFICACAO_TECNICA.md`](01_ESPECIFICACAO_TECNICA.md) | Visão do produto, papéis, modelo de dados (27 tipos), option sets (15), páginas (15) + reusables (12), integrações, motor de automação. **Comece por aqui.** |
| 02 | [`02_PLANO_MIGRACAO.md`](02_PLANO_MIGRACAO.md) | Arquitetura alvo, mapeamento Bubble→Supabase, auth/RLS, rotas Next.js, motor de automação, fases e riscos. |
| 03 | [`03_MODELO_DADOS_INTEGRACOES_BACKEND.md`](03_MODELO_DADOS_INTEGRACOES_BACKEND.md) | Notas cruas de extração: data model campo-a-campo, option sets, API Connector detalhado, plugins, backend workflows `old_*`, pendências. |
| 04 | [`04_PAGINAS_WORKFLOWS.md`](04_PAGINAS_WORKFLOWS.md) | Front-end página-a-página: propósito, dados, e workflows (evento→ação). Matriz papéis × páginas no fim. |

---

## Resumo do produto

**Kobly — Automação de Marketing.** SaaS de automação de e-mail para e-commerce: eventos de checkout chegam por **webhook** → criam/atualizam **Leads** → disparam **campanhas** cujo **fluxo** (cards drag-drop: Gatilho, Add/Remove Tag, Envio de e-mail, Acionar Fluxo) envia e-mails via **SendGrid**, rastreia eventos e calcula **estatísticas** (abertura, CTR, vendas recuperadas, criticidade). Sugestões e geração de HTML por **IA via n8n**.

- **Stack atual:** Bubble (front+back) + lógica de automação migrada para **n8n** self-hosted (`webhook.dizevolv.tech`).
- **Stack alvo:** Next.js (App Router) + Supabase (Postgres/RLS multi-tenant, Auth, Edge Functions, pg_cron).
- **Papéis (`@TipoUserGeral`):** Gestor · Cliente · Suporte · Administrador.
- **Números do legado:** 27 data types · 15 option sets · 15 páginas · 12 reusables · 16 backend workflows (`old_*`).

---

## Pendências críticas (bloqueiam paridade total)

1. **Exportar os fluxos do n8n** — a lógica viva roda fora do Bubble; os `old_*` são só referência estrutural.
2. **Campos exatos de cada "Make changes"** e thresholds de criticidade — exigem passada passo-a-passo no editor/n8n.
3. **SendGrid vs. Brevo** — confirmar provedor de envio efetivo.
4. **Gateway de pagamento** — `TransaçõesUsuários` existe, mas sem gateway no API Connector (Asaas recomendado por analogia).
5. **Multicanal = só e-mail no legado** — `@TipoEnvio` cita SMS/WhatsApp, mas nada disso está implementado. Roadmap, não funcionalidade atual.

---

## Histórico

A spec especulativa antiga (tenants/workspaces/memberships, circuit breakers, budget caps, dead-letters, eventos `cart_abandoned`/`pix_generated`, papéis `campaign_manager`/`viewer`) e o export boilerplate do Bubble foram **removidos** — descreviam um produto que não existe. A reconstrução segue **exclusivamente** os 4 documentos desta pasta.
