# Plano de Intervenção — Kobly v2: Automação Pur

## Contexto

O cliente quer que o sistema funcione como uma **automação pura**: o usuário cria uma URL de postback, cola na plataforma de checkout (Hotmart, Braip, NexoPayt, etc.), e quando um evento acontece (carrinho abandonado, erro no pagamento, etc.), a plataforma chama o Kobly que automaticamente envia o email do template correspondente.

**O sistema já faz isso internamente** (webhook-receiver → scheduled_steps → process-steps → Resend). A mudança é **simplificar a experiência** e **remover o que não é core**.

---

## Fase 1: Backend — Postback URL Universal

**Objetivo:** Uma URL simples que qualquer plataforma pode chamar com um JSON padronizado.

### 1.1 Nova Edge Function: `postback-receiver`

- **URL:** `https://{project-ref}.supabase.co/functions/v1/postback-receiver?token={token}`
- **Autenticação:** Token por organização (query param `?token=...`)
- **Payload JSON padronizado:**

```json
{
  "event": "cart_abandoned",
  "email": "lead@email.com",
  "name": "Lead Name",
  "product": "Product Name",
  "value": 197.00,
  "payment_method": "pix",
  "external_id": "platform_transaction_id",
  "metadata": {}
}
```

- **Mapeamento event → tipo_evento:**

| Event (payload) | tipo_evento (DB) |
|---|---|
| `cart_abandoned` | Abandono de carrinho |
| `payment_approved` | Compra Aprovada |
| `payment_refused` | Compra Recusada |
| `payment_refunded` | Compra Reembolsada |
| `payment_chargeback` | Chargeback |
| `payment_canceled` | Compra cancelada |
| `subscription_canceled` | Cancelamento de Assinatura |
| `pix_generated` | Pix Gerado |
| `boleto_generated` | Boleto Gerado |
| `deposit_requested` | Depósito Solicitado |

- **Lógica interna (reutiliza o que já existe):**
  1. Validar token → resolver `organization_id`
  2. Rate limit (120/min por org)
  3. Normalizar payload → `NormalizedEvent`
  4. Idempotente insert em `webhook_events` (dedup por `external_id`)
  5. Upsert lead por `(org, email)`
  6. Query campanhas ativas cujo Gatilho matcha `tipo_evento`
  7. Inserir `scheduled_steps` com `run_at = now + atraso`
  8. Retornar `{ ok: true, matched_campaigns: N }`

### 1.2 Tabela `postback_tokens`

```sql
create table public.postback_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  token text not null unique default ('pbk_' || encode(gen_random_bytes(24), 'hex')),
  nome text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

- RLS: org members can read, admin only can create/delete
- Cada organização pode ter múltiplos tokens (para diferentes plataformas)

### 1.3 Manter webhook-receiver

O `webhook-receiver` existente fica para retrocompatibilidade. O `postback-receiver` é o entry point principal novos.

### 1.4 process-steps

Sem alterações. Já funciona perfeitamente: consome `scheduled_steps`, envia via Resend, atualiza métricas.

---

## Fase 2: Frontend — Simplificação

**Objetivo:** Remover telas não-core e focar na automação.

### 2.1 Telas a remover

| Tela | Motivo |
|---|---|
| Dashboard (complexo) | Relatórios e KPIs avançados não são core |
| Relatórios | Duplica info do dashboard |
| Chamados/Suporte | Funcionalidade auxiliar, não automação |
| Segurança | Admin stuff, não core |
| Planos & cobrança | Não é core da automação |
| Ajuda/FAQ | Pode ser uma página estática depois |
| Clientes (Gestor) | Multi-account é feature avançada |

### 2.2 Telas a manter

| Tela | O que fica |
|---|---|
| **Login** | Autenticação (já funciona) |
| **Campanhas** | Lista + FlowBuilder + EmailEditor (já funciona) |
| **Leads** | CRM com status e métricas (já funciona) |
| **Integrações** | **Simplificado:** Postback URL + Templates de email + Tags |
| **Perfil** | Edição de perfil + logout (já funciona) |

### 2.3 Integrações — Reestruturar abas

**Aba 1: Postback URL** (novo)
- Mostrar URL copiável com token da organização
- Lista de eventos suportados com descrição
- Exemplo de payload JSON para copiar
- Botão "Gerar novo token"
- Status: Último evento recebido há X minutos

**Aba 2: Templates de Email** (simplificado)
- Lista de emails criados
- Botão "Novo email" → abre EmailEditor
- Cada email: título, assunto, remetente, preview

**Aba 3: Tags** (manter como está)
- Lista de tags por evento
- Criar nova tag

**Remover:** Aba Domínios (SendGrid) e Aba API

### 2.4 Navegação — Simplificar

**Cliente (nav atual → novo):**
```
['dashboard', 'campanhas', 'leads', 'integracoes', 'chamados', 'planos', 'suporte', 'perfil']
→ ['campanhas', 'leads', 'integracoes', 'perfil']
```

**Home page:** `campanhas` (em vez de `dashboard`)

**Gestor:** Manter `['campanhas', 'leads', 'integracoes', 'perfil']` (remover clientes, relatórios, etc.)

**Suporte/Administrador:** Manter apenas `['perfil']` (ou remover esses roles por enquanto)

### 2.5 Remover do AppShell

- Remover import e uso do `KoblyAIAssistant` (AI flutuante)
- Remover import e uso do `KoblyOnboarding`
- Remover import e uso do `KoblyTweaksPanel`
- Simplificar o `SCREENS` map (remover telas removidas)

---

## Fase 3: Banco de Dados — Migration

Nova migration `0017_postback_receiver.sql`:

1. Criar tabela `postback_tokens`
2. Adicionar RLS policies
3. Criar função RPC `create_postback_token(org_id)` (SECURITY DEFINER)
4. Seed: token padrão para organizações existentes

---

## Fase 4: Atualizar mockApi.js

1. Adicionar método `getOrCreatePostbackToken(orgId)` — busca ou cria token
2. Adicionar método `getRecentEvents(orgId, limit)` — últimos eventos recebidos
3. Simplificar `getIntegrations()` — remover domínios e API key
4. Manter `createWebhook()` para retrocompatibilidade (ou remover)

---

## Fase 5: Ordem de Execução

1. **Migration** (0017_postback_receiver.sql) — criar tabela e policies
2. **Edge Function** (postback-receiver/index.ts) — nova function
3. **mockApi.js** — novos métodos + simplificação
4. **Integrations.jsx** — reestruturar abas
5. **mockData.js** — simplificar NAV e roles
6. **AppShell.jsx** — remover telas e imports
7. **Remover arquivos** Dashboard.jsx, Reports.jsx, Tickets.jsx, Security.jsx, Plans.jsx, Help.jsx, Clients.jsx (ou apenas deixar de importar)
8. **Testar** fluxo completo: postback → campanha → email

---

## Resumo Visual

```
ANTES:
  Platform → webhook-receiver (adapters) → scheduled_steps → process-steps → Resend
  Frontend: 13 telas, flow builder, dashboard, relatórios, chamados, etc.

DEPOIS:
  Platform → postback-receiver (universal URL) → scheduled_steps → process-steps → Resend
  Frontend: 4 telas (Campanhas, Leads, Integrações, Perfil) + Flow Builder
```
