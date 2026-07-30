# Planos: cobrança real — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** fazer as regras de assinatura que a página de vendas anuncia valerem dinheiro de verdade — hoje os gates existem, estão corretos e não se aplicam a ninguém.

**Architecture:** o cálculo de valor por ciclo de cobrança vira lógica pura em `supabase/functions/_shared/billing_cycle.ts` com `deno test`, e é **inlinada** em `asaas/index.ts` — mesma convenção de `_shared/unsub.ts` e `_shared/cta.ts`, porque o deploy por função não empacota `../_shared/` (ver `send-email/index.ts:26`). As regras de plano continuam morando no banco (trigger + `org_pode()`), nunca no JS: o front escreve direto no PostgREST, então limite conferido em JS é cosmético.

**Tech Stack:** Supabase (Postgres 15 + Vault + Edge Functions em Deno), PostgREST, Asaas, React/Vite.

## Global Constraints

- **Migrations:** `supabase/migrations/00NN_nome.sql`, próximos números = `0063` e `0064`. A `0062` já existe (CTA).
- **Deploy de edge function:** `supabase functions deploy <nome> --project-ref hvkuymprmfrjrgpqaxbw`. A CLI está instalada e o projeto linkado.
- **Ordem obrigatória:** a migration de schema (`0063`) sobe **antes** do deploy do `asaas`. Nunca o inverso — haveria uma janela em que o código lê uma coluna que não existe.
- **A isenção sai por último** (Task 6), depois que a mensagem de erro do limite já estiver no front (Task 4). Ativar o gate antes disso mostra "Não foi possível criar o webhook" sem explicar o motivo.
- **Nada de `../_shared/` importado dentro de uma edge function.** Lógica pura vive em `_shared/` com teste e é copiada para dentro da função, com o comentário `manter idêntico a _shared/billing_cycle.ts`.
- **Valores decididos** (registrados em `docs/superpowers/specs/2026-07-30-planos-cobranca-real-design.md`): excedente R$ 0,020 / 0,010 / 0,005 por mensagem (Starter/Pro/Scale); semestral R$ 535 / 1.087 / 2.191.
- **Não há runner JS no projeto.** Lógica pura → `deno test`. Integração → SQL de asserção.

**Desvio consciente da spec:** a spec previa uma migration só. O plano usa duas — `0063` (schema e preços, inerte) e `0064` (tira a isenção, ativa a cobrança). A garantia de ordem é a mesma, e separar permite rejeitar a ativação sem rejeitar o schema.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `supabase/functions/_shared/billing_cycle.ts` | **Criar.** Lógica pura: resolver o valor de um plano para um ciclo de cobrança. Sem I/O. |
| `supabase/functions/_shared/billing_cycle_test.ts` | **Criar.** `deno test` da lógica acima. |
| `supabase/migrations/0063_planos_schema_e_precos.sql` | **Criar.** `valor_semestral`, `preco_excedente`, drop de `limite_numeros_whatsapp`. Inerte. |
| `supabase/functions/asaas/index.ts` | **Modificar.** Trazer `valor_semestral` no select, inlinar a lógica, trocar a guarda. |
| `src/api/mockApi.js` | **Modificar.** `createPostbackToken` devolve o erro; `createPlan` insere os campos que faltam. |
| `src/api/supabaseDb.js` | **Modificar.** Mapear os campos novos de plano. |
| `src/routes/Integrations.jsx` | **Modificar.** Exibir a mensagem real do limite. |
| `src/routes/Plans.jsx` | **Modificar.** Formulário com os campos que governam cobrança. |
| `supabase/migrations/0064_ativar_cobranca.sql` | **Criar.** `limites_isentos = false`. Ativa tudo. |

---

## Task 1: Lógica pura do valor por ciclo

**Files:**
- Create: `supabase/functions/_shared/billing_cycle.ts`
- Test: `supabase/functions/_shared/billing_cycle_test.ts`

**Interfaces:**
- Produces:
  - `type BillingCycle = "MONTHLY" | "SEMIANNUALLY" | "YEARLY"`
  - `CYCLE_FIELD: Readonly<Record<BillingCycle, string>>`
  - `resolveCycleValue(cycle: string, plan: Record<string, unknown>): number | null` — devolve o valor em reais, ou `null` quando o ciclo não é suportado ou o plano não tem valor utilizável para ele. **Nunca** cai em outro ciclo.

- [ ] **Step 1: Escrever o teste que falha**

Create `supabase/functions/_shared/billing_cycle_test.ts`:

```ts
// supabase/functions/_shared/billing_cycle_test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveCycleValue } from "./billing_cycle.ts";

const PLANO = { valor_mensal: 197, valor_semestral: 1087, valor_anual: 1970 };

Deno.test("resolveCycleValue: cada ciclo lê o seu próprio campo", () => {
  assertEquals(resolveCycleValue("MONTHLY", PLANO), 197);
  assertEquals(resolveCycleValue("SEMIANNUALLY", PLANO), 1087);
  assertEquals(resolveCycleValue("YEARLY", PLANO), 1970);
});

Deno.test("resolveCycleValue: numeric do Postgres pode chegar como string", () => {
  // PostgREST devolve `numeric` como número, mas o driver já entregou string em
  // alguns caminhos; o código antigo fazia Number(...) justamente por isso.
  assertEquals(resolveCycleValue("MONTHLY", { valor_mensal: "97.00" }), 97);
  assertEquals(resolveCycleValue("SEMIANNUALLY", { valor_semestral: "535" }), 535);
});

Deno.test("resolveCycleValue: campo AUSENTE devolve null, não NaN", () => {
  // Este é o bug que a guarda antiga não pegava: se o `select` do plano não
  // trouxer a coluna, Number(undefined) é NaN e `NaN <= 0` é false — passava
  // direto e criava assinatura no Asaas com value: NaN.
  assertEquals(resolveCycleValue("SEMIANNUALLY", { valor_mensal: 97 }), null);
  assertEquals(resolveCycleValue("YEARLY", { valor_mensal: 97 }), null);
});

Deno.test("resolveCycleValue: nulo, zero e negativo são inválidos", () => {
  assertEquals(resolveCycleValue("SEMIANNUALLY", { valor_semestral: null }), null);
  assertEquals(resolveCycleValue("SEMIANNUALLY", { valor_semestral: 0 }), null);
  assertEquals(resolveCycleValue("MONTHLY", { valor_mensal: -10 }), null);
  assertEquals(resolveCycleValue("MONTHLY", { valor_mensal: "abc" }), null);
});

Deno.test("resolveCycleValue: NUNCA cai em outro ciclo", () => {
  // O código antigo fazia `Number(valor_anual) || Number(valor_mensal) * 12`,
  // ou seja: plano sem valor anual cobrava 12x o mensal — o cliente escolhia
  // "anual", via o desconto anunciado e pagava preço cheio. Silenciosamente.
  assertEquals(resolveCycleValue("YEARLY", { valor_mensal: 97, valor_anual: null }), null);
  assertEquals(resolveCycleValue("SEMIANNUALLY", { valor_mensal: 97, valor_semestral: null }), null);
});

Deno.test("resolveCycleValue: ciclo não suportado devolve null", () => {
  // A API do Asaas aceita WEEKLY/BIWEEKLY/QUARTERLY também. Tratar um deles
  // como mensal cobraria a menos sem ninguém perceber.
  assertEquals(resolveCycleValue("QUARTERLY", PLANO), null);
  assertEquals(resolveCycleValue("", PLANO), null);
  assertEquals(resolveCycleValue("mensal", PLANO), null);
});

Deno.test("resolveCycleValue: case-insensitive no ciclo", () => {
  assertEquals(resolveCycleValue("yearly", PLANO), 1970);
  assertEquals(resolveCycleValue("SemiAnnually", PLANO), 1087);
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `deno test --allow-read supabase/functions/_shared/billing_cycle_test.ts`
Expected: FAIL — `Module not found ... billing_cycle.ts`

- [ ] **Step 3: Implementar o módulo**

Create `supabase/functions/_shared/billing_cycle.ts`:

```ts
// supabase/functions/_shared/billing_cycle.ts
// Resolve o valor de um plano para um ciclo de cobrança do Asaas.
//
// Regra única: cada ciclo lê SÓ o seu próprio campo. Não há fallback entre
// ciclos — se o plano não tem valor para o ciclo pedido, a resposta é null e o
// chamador recusa a operação. O código anterior fazia
// `Number(valor_anual) || Number(valor_mensal) * 12`, que cobrava 12x o mensal
// de um cliente que escolheu "anual" e viu um desconto anunciado.
//
// Esta lógica é INLINADA em asaas/index.ts (o deploy por função não empacota
// ../_shared/). Ao mudar aqui, mudar lá — e vice-versa.

export type BillingCycle = "MONTHLY" | "SEMIANNUALLY" | "YEARLY";

export const CYCLE_FIELD: Readonly<Record<BillingCycle, string>> = {
  MONTHLY: "valor_mensal",
  SEMIANNUALLY: "valor_semestral",
  YEARLY: "valor_anual",
};

export function resolveCycleValue(
  cycle: string,
  plan: Record<string, unknown>,
): number | null {
  const key = String(cycle ?? "").toUpperCase() as BillingCycle;
  const field = CYCLE_FIELD[key];
  if (!field) return null;                 // ciclo não suportado

  const raw = plan?.[field];
  if (raw === null || raw === undefined) return null;   // nulo OU coluna ausente

  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `deno test --allow-read supabase/functions/_shared/billing_cycle_test.ts`
Expected: PASS — 7 testes

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/billing_cycle.ts supabase/functions/_shared/billing_cycle_test.ts
git commit -m "feat(billing): logica pura do valor por ciclo de cobranca"
```

---

## Task 2: Migration de schema e preços (inerte)

**Files:**
- Create: `supabase/migrations/0063_planos_schema_e_precos.sql`

**Interfaces:**
- Produces: coluna `public.plans.valor_semestral numeric`; `preco_excedente` preenchido nos 3 planos ativos; coluna `public.plans.limite_numeros_whatsapp` removida.
- Consumes: nada.

Esta migration não muda comportamento nenhum: `preco_excedente` só é lido por `reset_usage_cycles()` no vira-mês, e `valor_semestral` só por quem pedir o ciclo — que ainda não existe no código.

- [ ] **Step 1: Escrever a migration**

Create `supabase/migrations/0063_planos_schema_e_precos.sql`:

```sql
-- 0063_planos_schema_e_precos.sql
-- Kobly — schema e preços para a cobrança real dos planos. INERTE: não muda
-- comportamento. A ativação está na 0064.
--
-- Decisões registradas em docs/superpowers/specs/2026-07-30-planos-cobranca-real-design.md:
--
-- EXCEDENTE escalonado por plano (R$/mensagem acima da franquia). Faz o upgrade
-- ser sempre a escolha racional em 2x a franquia, sem punir ninguém: um Starter
-- que manda 10.000 paga 97 + 5.000*0,02 = R$197, exatamente o preço do Pro, onde
-- teria 25.000. O cliente nunca paga mais que o tier de cima sem perceber.
--
-- SEMESTRAL arredondado PARA BAIXO, para o desconto real nunca ficar abaixo dos
-- -8% que a página anuncia (8,08% / 8,04% / 8,02%).
--
-- limite_numeros_whatsapp: coluna morta. Nenhuma função, trigger ou linha de
-- código a lê (verificado em 2026-07-30). O WhatsApp é single-tenant — os
-- secrets zapi_instance_id/zapi_token são globais, não por org — e número único
-- passou a ser decisão de produto. Valores originais, caso alguém precise:
-- Starter 1, Pro 2, Scale 4.
-- ---------------------------------------------------------------------------
alter table public.plans add column if not exists valor_semestral numeric;

comment on column public.plans.valor_semestral is
  'Valor do ciclo semestral (Asaas cycle=SEMIANNUALLY). Nulo = plano nao oferece semestral; asaas/index.ts recusa o ciclo em vez de cobrar outro valor.';

comment on column public.plans.preco_excedente is
  'R$ por mensagem acima da franquia do periodo. Lido por reset_usage_cycles() ao arquivar em usage_period_history.';

update public.plans set valor_semestral = 535,  preco_excedente = 0.020 where nome = 'Starter' and deleted = false;
update public.plans set valor_semestral = 1087, preco_excedente = 0.010 where nome = 'Pro'     and deleted = false;
update public.plans set valor_semestral = 2191, preco_excedente = 0.005 where nome = 'Scale'   and deleted = false;

alter table public.plans drop column if exists limite_numeros_whatsapp;

-- Guarda: os 3 planos ativos precisam sair daqui completos.
do $$
declare n int;
begin
  select count(*) into n
    from public.plans
   where status = 'Ativo' and deleted = false
     and (valor_semestral is null or preco_excedente is null);
  if n > 0 then
    raise exception 'ha % plano(s) ativo(s) sem valor_semestral ou preco_excedente', n;
  end if;
end $$;
```

- [ ] **Step 2: Aplicar**

Aplicar via `mcp__kobly-supabase__apply_migration` com `name = "planos_schema_e_precos"` e o corpo acima (sem o cabeçalho de comentários, que fica no arquivo do repo).

Expected: `{"success": true}`. Se a guarda disparar, a transação inteira volta — investigar qual plano ficou de fora antes de tentar de novo.

- [ ] **Step 3: Verificar**

Run (via `mcp__kobly-supabase__execute_sql`):

```sql
select nome, valor_mensal, valor_semestral, valor_anual, preco_excedente,
       round((1 - valor_semestral / (valor_mensal * 6)) * 100, 2) as desconto_semestral_pct
  from public.plans
 where status = 'Ativo' and deleted = false
 order by valor_mensal;
```

Expected: 3 linhas — Starter `97 / 535 / 970 / 0.020 / 8.08`, Pro `197 / 1087 / 1970 / 0.010 / 8.04`, Scale `397 / 2191 / 3970 / 0.005 / 8.02`. Todos os descontos **≥ 8,00**.

```sql
select count(*) as coluna_morta
  from information_schema.columns
 where table_schema='public' and table_name='plans' and column_name='limite_numeros_whatsapp';
```

Expected: `0`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0063_planos_schema_e_precos.sql
git commit -m "feat(planos): valor semestral, preco de excedente e remocao do limite de numeros"
```

---

## Task 3: Ciclo semestral no Asaas

**Files:**
- Modify: `supabase/functions/asaas/index.ts:131-142`

**Interfaces:**
- Consumes: `resolveCycleValue` da Task 1 (copiada, não importada) e a coluna `valor_semestral` da Task 2.
- Produces: `POST /functions/v1/asaas` com `{ action: "create_subscription", plan_id, cycle: "SEMIANNUALLY" }` passa a criar assinatura com o valor semestral.

- [ ] **Step 1: Trazer a coluna nova no select**

Em `supabase/functions/asaas/index.ts`, linha 132, trocar:

```ts
        .select("id, nome, valor_mensal, valor_anual, status")
```

por:

```ts
        .select("id, nome, valor_mensal, valor_semestral, valor_anual, status")
```

Sem isto, `plan.valor_semestral` é `undefined` — e é exatamente o caso que o teste "campo AUSENTE devolve null" cobre.

- [ ] **Step 2: Inlinar a lógica pura**

Em `supabase/functions/asaas/index.ts`, inserir **depois da linha 13** (`import { createClient } ...`, o último import) e **antes da linha 15** (`const cors = {`):

```ts
// Inlinado de _shared/billing_cycle.ts (per-function deploy não empacota ../_shared/).
// Manter idêntico a resolveCycleValue em _shared/billing_cycle.ts.
// Regra: cada ciclo lê SÓ o seu campo; sem valor utilizável devolve null e o
// chamador recusa. Nada de fallback entre ciclos.
const CYCLE_FIELD: Record<string, string> = {
  MONTHLY: "valor_mensal",
  SEMIANNUALLY: "valor_semestral",
  YEARLY: "valor_anual",
};
function resolveCycleValue(cycle: string, plan: Record<string, unknown>): number | null {
  const field = CYCLE_FIELD[String(cycle ?? "").toUpperCase()];
  if (!field) return null;
  const raw = plan?.[field];
  if (raw === null || raw === undefined) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}
```

- [ ] **Step 3: Trocar o cálculo e a guarda**

Substituir as linhas 139–142:

```ts
      const value = cycle === "YEARLY"
        ? Number(plan.valor_anual) || Number(plan.valor_mensal) * 12
        : Number(plan.valor_mensal) || 0;
      if (value <= 0) return json({ error: "invalid_plan_value" }, 400);
```

por:

```ts
      const value = resolveCycleValue(cycle, plan as Record<string, unknown>);
      if (value === null) {
        return json({ error: "invalid_plan_value", detail: `plano "${plan.nome}" nao tem valor para o ciclo ${cycle}` }, 400);
      }
```

**Mudança de comportamento deliberada, que um revisor pode rejeitar isoladamente:** o `|| Number(plan.valor_mensal) * 12` some. Antes, um plano sem `valor_anual` cobrava 12× o mensal de quem escolheu "anual" — preço cheio, sem o desconto anunciado, sem erro. Agora recusa. Os 3 planos ativos têm `valor_anual` preenchido, então nenhum fluxo atual muda.

- [ ] **Step 4: Verificar que compila e que a cópia não divergiu**

Run:
```bash
deno check supabase/functions/asaas/index.ts
```
Expected: sem erros.

Run (anti-drift — a cópia inlinada tem que bater com o módulo):
```bash
diff <(sed -n '/^function resolveCycleValue/,/^}/p' supabase/functions/asaas/index.ts) \
     <(sed -n '/^export function resolveCycleValue/,/^}/p' supabase/functions/_shared/billing_cycle.ts | sed 's/^export //')
```
Expected: sem saída (as duas versões são idênticas a menos do `export`).

- [ ] **Step 5: Deploy**

Run:
```bash
supabase functions deploy asaas --project-ref hvkuymprmfrjrgpqaxbw
```
Expected: `Deployed Functions on project hvkuymprmfrjrgpqaxbw: asaas`

- [ ] **Step 6: Verificar em produção que o ciclo novo resolve**

Confirmar primeiro que a coluna existe (Task 2 já subiu) e depois que a função enxerga o valor. Run (via `mcp__kobly-supabase__execute_sql`):

```sql
select nome, valor_semestral from public.plans where nome = 'Pro' and deleted = false;
```
Expected: `Pro | 1087`

Não disparar `create_subscription` real contra o Asaas neste passo — criaria cobrança de verdade. A validação do cálculo já está coberta pelo `deno test` da Task 1.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/asaas/index.ts
git commit -m "feat(asaas): ciclo semestral e recusa de plano sem valor para o ciclo"
```

---

## Task 4: Mensagem real do limite de integrações

**Files:**
- Modify: `src/api/mockApi.js:731-742` (`createPostbackToken`)
- Modify: `src/routes/Integrations.jsx:164-176` (`createWebhook`)

**Interfaces:**
- Consumes: nada.
- Produces: `KoblyApi.createPostbackToken(nome, empresaId)` passa a devolver `{ ok: true, token }` ou `{ ok: false, error: string }` em vez de token-ou-`null`.

Precisa vir **antes** da Task 6. Quando o gate ligar, a Digital vai bater no limite, e hoje a tela responde "Não foi possível criar o webhook" — sem dizer que é o plano.

- [ ] **Step 1: Fazer a API devolver o erro**

Em `src/api/mockApi.js`, substituir `createPostbackToken` (linhas 731–742):

```js
  async createPostbackToken(nome, empresaId) {
    const me = await currentProfile();
    const orgId = empresaId || await firstOrgId(me);
    if (!orgId) return { ok: false, error: 'Conta não encontrada.' };
    const { data, error } = await supabase.rpc('create_postback_token', {
      p_org_id: orgId,
      p_nome: nome || 'Novo token',
    });
    if (error) {
      // O trigger enforce_limite_integracoes levanta check_violation com a
      // mensagem 'limite_integracoes_atingido: o plano permite N integracao(oes)
      // de checkout. Remova uma ou faça upgrade.' — mostrar isso, não um genérico.
      const msg = String(error.message || '');
      if (msg.includes('limite_integracoes_atingido')) {
        return { ok: false, error: msg.replace(/^.*?limite_integracoes_atingido:\s*/, '') };
      }
      return { ok: false, error: 'Não foi possível criar o webhook' };
    }
    resetDb();
    return { ok: true, token: data };
  },
```

- [ ] **Step 2: Consumir o novo retorno na tela**

Em `src/routes/Integrations.jsx`, substituir `createWebhook` (linhas 164–176):

```jsx
  async function createWebhook() {
    const nome = (newName || '').trim() || 'Novo webhook';
    setCreating(true);
    const r = await KoblyApi.createPostbackToken(nome, empresaId);
    setCreating(false);
    if (r && r.ok) {
      setNewName('');
      await loadTokens();
      store.notify('success', `Webhook "${nome}" criado`);
    } else {
      store.notify('danger', (r && r.error) || 'Não foi possível criar o webhook');
    }
  }
```

- [ ] **Step 3: Procurar outros consumidores do retorno antigo**

Run:
```bash
grep -rn "createPostbackToken" src/ | grep -v node_modules
```
Expected: só as duas ocorrências acima (definição em `mockApi.js` e uso em `Integrations.jsx`). Se aparecer outra, ela também espera token-ou-`null` e precisa do mesmo ajuste — corrigir antes de seguir.

- [ ] **Step 4: Verificar que o build passa**

Run: `npm run build`
Expected: build sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/api/mockApi.js src/routes/Integrations.jsx
git commit -m "fix(integracoes): exibir a mensagem real do limite do plano ao criar webhook"
```

---

## Task 5: Formulário de planos governa os campos de cobrança

**Files:**
- Modify: `src/api/supabaseDb.js:134-137` (mapeamento de `planos`)
- Modify: `src/api/mockApi.js:1316-1324` (`createPlan`)
- Modify: `src/routes/Plans.jsx:70`, `:80-95`, `:274-279`

**Interfaces:**
- Consumes: nada.
- Produces: `KoblyApi.createPlan(p)` passa a aceitar também `valorSemestral`, `limiteIntegracoes`, `precoExcedente`, `smsHabilitado`, `disparoMassaHabilitado`, `dominioProprioHabilitado` (todos opcionais).

Sem esta task, o próximo plano criado pela tela nasce com `limite_integracoes` nulo — que o trigger lê como **ilimitado** — e sem `preco_excedente`, ou seja com excedente medido e não faturado. As capacidades booleanas têm default `false` no banco e são seguras.

**O que esta task resolve, e o que ela não resolve.** O problema é o campo ser *invisível*, não a semântica: quem cria um plano hoje não tem como saber que existe um limite de integrações, um preço de excedente ou três capacidades. Depois desta task os campos aparecem no formulário e a escolha passa a ser deliberada. O que **continua** valendo é que limite em branco ou `0` significa ilimitado — isso é o contrato do `enforce_limite_integracoes` (`if v_limite is null or v_limite <= 0 then return new`), não uma decisão deste plano, e mudá-lo alteraria o comportamento de planos já existentes. Por isso o rótulo do campo diz explicitamente o que o branco faz.

- [ ] **Step 1: Mapear os campos novos na leitura**

Em `src/api/supabaseDb.js`, substituir o bloco `planos` (linhas 134–137):

```js
    planos: plans.map((pl) => ({
      id: pl.id, nome: pl.nome, descricao: pl.descricao, status: pl.status, valorMensal: num(pl.valor_mensal),
      valorAnual: num(pl.valor_anual), limiteCampanhas: num(pl.limite_campanhas), limiteExecucoes: num(pl.limite_execucoes), deleted: pl.deleted,
      valorSemestral: num(pl.valor_semestral), limiteIntegracoes: num(pl.limite_integracoes),
      precoExcedente: num(pl.preco_excedente),
      smsHabilitado: !!pl.sms_habilitado, disparoMassaHabilitado: !!pl.disparo_massa_habilitado,
      dominioProprioHabilitado: !!pl.dominio_proprio_habilitado,
    })),
```

- [ ] **Step 2: Inserir os campos novos na criação**

Em `src/api/mockApi.js`, substituir `createPlan` (linhas 1316–1324):

```js
  async createPlan(p) {
    const { data, error } = await supabase.from('plans').insert({
      nome: p.nome, descricao: p.descricao, valor_mensal: p.valorMensal, valor_anual: p.valorAnual,
      valor_semestral: p.valorSemestral ?? null,
      limite_campanhas: p.limiteCampanhas, limite_execucoes: p.limiteExecucoes,
      // limite_integracoes NULO significa ILIMITADO para enforce_limite_integracoes.
      // Um plano novo não pode nascer vendendo integração sem teto por omissão.
      limite_integracoes: p.limiteIntegracoes ?? 0,
      preco_excedente: p.precoExcedente ?? null,
      sms_habilitado: !!p.smsHabilitado,
      disparo_massa_habilitado: !!p.disparoMassaHabilitado,
      dominio_proprio_habilitado: !!p.dominioProprioHabilitado,
      status: 'Ativo', deleted: false,
    }).select().single();
    if (error) throw error;
    resetDb();
    return { id: data.id, status: data.status, deleted: false, ...p };
  },
```

Nota sobre `limite_integracoes: p.limiteIntegracoes ?? 0`: o trigger trata `null` e `<= 0` do mesmo jeito — ambos liberam. O `?? 0` não muda o resultado para quem deixa em branco; serve para o campo nunca chegar `undefined` vindo de outro chamador. O ganho real da task é o campo existir na tela: a escolha passa a ser **feita**, não herdada do default do banco.

- [ ] **Step 3: Adicionar os campos ao estado do formulário**

Em `src/routes/Plans.jsx`, linha 70, substituir:

```jsx
  const [pf, setPf] = useState({ nome: '', descricao: '', valorMensal: '', valorAnual: '', limiteCampanhas: '', limiteExecucoes: '' });
```

por:

```jsx
  const PF_VAZIO = {
    nome: '', descricao: '', valorMensal: '', valorAnual: '', valorSemestral: '',
    limiteCampanhas: '', limiteExecucoes: '', limiteIntegracoes: '', precoExcedente: '',
    smsHabilitado: 'nao', disparoMassaHabilitado: 'nao', dominioProprioHabilitado: 'nao',
  };
  const [pf, setPf] = useState(PF_VAZIO);
```

- [ ] **Step 4: Enviar os campos novos no submit**

Em `src/routes/Plans.jsx`, substituir `createPlan` (linhas 80–95):

```jsx
  async function createPlan() {
    if (!pf.nome.trim()) return;
    setBusy(true);
    try {
      await KoblyApi.createPlan({
        nome: pf.nome, descricao: pf.descricao,
        valorMensal: Number(pf.valorMensal) || 0, valorAnual: Number(pf.valorAnual) || 0,
        valorSemestral: pf.valorSemestral === '' ? null : Number(pf.valorSemestral),
        limiteCampanhas: parseInt(pf.limiteCampanhas, 10) || 0, limiteExecucoes: parseInt(pf.limiteExecucoes, 10) || 0,
        limiteIntegracoes: parseInt(pf.limiteIntegracoes, 10) || 0,
        precoExcedente: pf.precoExcedente === '' ? null : Number(pf.precoExcedente),
        smsHabilitado: pf.smsHabilitado === 'sim',
        disparoMassaHabilitado: pf.disparoMassaHabilitado === 'sim',
        dominioProprioHabilitado: pf.dominioProprioHabilitado === 'sim',
      });
      store.notify('success', `Plano "${pf.nome}" criado`);
      setModal(false); setPf(PF_VAZIO);
      a.reload();
    } catch (e) {
      store.notify('danger', 'Não foi possível criar o plano.');
    } finally { setBusy(false); }
  }
```

- [ ] **Step 5: Adicionar os controles ao modal**

Em `src/routes/Plans.jsx`, importar `Select` — linha 4, trocar:

```jsx
import { Badge, Button, Card, DataTable, Icon, Input } from '@/ds';
```

por:

```jsx
import { Badge, Button, Card, DataTable, Icon, Input, Select } from '@/ds';
```

E substituir o grid do modal (linhas 274–279):

```jsx
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Input label="Valor mensal (R$)" type="number" placeholder="297" value={pf.valorMensal} onChange={setField('valorMensal')} />
            <Input label="Valor semestral (R$)" type="number" placeholder="1640" value={pf.valorSemestral} onChange={setField('valorSemestral')} />
            <Input label="Valor anual (R$)" type="number" placeholder="2970" value={pf.valorAnual} onChange={setField('valorAnual')} />
            <Input label="Limite de campanhas" type="number" placeholder="20" value={pf.limiteCampanhas} onChange={setField('limiteCampanhas')} />
            <Input label="Limite de execuções/mês" type="number" placeholder="50000" value={pf.limiteExecucoes} onChange={setField('limiteExecucoes')} />
            <Input label="Limite de integrações (vazio = ilimitado)" type="number" placeholder="10" value={pf.limiteIntegracoes} onChange={setField('limiteIntegracoes')} />
            <Input label="Excedente (R$/mensagem)" type="number" step="0.001" placeholder="0.010" value={pf.precoExcedente} onChange={setField('precoExcedente')} />
            <Select label="SMS" value={pf.smsHabilitado} onChange={setField('smsHabilitado')}
              options={[{ value: 'nao', label: 'Não' }, { value: 'sim', label: 'Sim' }]} />
            <Select label="Disparo em massa" value={pf.disparoMassaHabilitado} onChange={setField('disparoMassaHabilitado')}
              options={[{ value: 'nao', label: 'Não' }, { value: 'sim', label: 'Sim' }]} />
            <Select label="Domínio próprio" value={pf.dominioProprioHabilitado} onChange={setField('dominioProprioHabilitado')}
              options={[{ value: 'nao', label: 'Não' }, { value: 'sim', label: 'Sim' }]} />
          </div>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            Deixar “Limite de integrações” em branco ou 0 libera integrações ilimitadas.
          </p>
```

`setField` (linha 79) já funciona com `Select`, porque o `onChange` do `Select` recebe o evento nativo do `<select>` e `e.target.value` existe igual ao `<input>`.

- [ ] **Step 6: Verificar que o build passa**

Run: `npm run build`
Expected: build sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/api/supabaseDb.js src/api/mockApi.js src/routes/Plans.jsx
git commit -m "fix(planos): formulario governa os campos que passaram a valer cobranca"
```

---

## Task 6: Ativar a cobrança

**Files:**
- Create: `supabase/migrations/0064_ativar_cobranca.sql`

**Interfaces:**
- Consumes: Task 2 (preços existem) e Task 4 (a tela sabe explicar o bloqueio).
- Produces: `org_pode()` e os triggers passam a valer para as 9 organizações.

Este é o passo que muda comportamento de cliente. Só rodar depois das Tasks 2 e 4.

- [ ] **Step 1: Registrar o estado de antes**

Run (via `mcp__kobly-supabase__execute_sql`) e **guardar a saída** — é o rollback:

```sql
select o.nome, p.nome as plano, o.limites_isentos,
       (select count(*) from public.postback_tokens t where t.organization_id = o.id) as integracoes,
       p.limite_integracoes,
       (select count(*) from public.campaigns c where c.organization_id = o.id) as campanhas,
       p.limite_campanhas
  from public.organizations o
  left join public.plans p on p.id = o.plano_id
 order by o.nome;
```

Expected em 2026-07-30: 9 linhas, todas com `limites_isentos = true`; só a **Digital** acima do limite (5 integrações para 3).

- [ ] **Step 2: Escrever a migration**

Create `supabase/migrations/0064_ativar_cobranca.sql`:

```sql
-- 0064_ativar_cobranca.sql
-- Kobly — tira a isenção e faz os gates do 0061 valerem para todo mundo.
--
-- ESTADO ANTES (medido em 2026-07-30): as 9 organizações estavam com
-- limites_isentos = true, ou seja org_pode() devolvia true de saída e nenhum
-- gate se aplicava a ninguém.
--
-- IMPACTO MEDIDO, não estimado: 8 das 9 seguem exatamente como estão. Só a
-- Digital (Starter) está acima do plano — 5 postback_tokens para
-- limite_integracoes = 3. Como enforce_limite_integracoes é INSERT-only e conta
-- as linhas existentes, ela MANTÉM as 5 e só é bloqueada ao criar a 6ª. Nenhum
-- dado é apagado, nenhuma campanha para, nenhum envio é interrompido.
--
-- Consumo estava muito abaixo da franquia (máximo 163 mensagens de 25.000) e o
-- excedente acumulado era zero em todas — então a franquia não morde ninguém
-- neste momento.
--
-- Nenhum Starter usava recurso de tier superior (0 sms_messages e 0 bulk_sends
-- em todas as orgs Starter), então os gates de capacidade também não tiram nada
-- de ninguém.
--
-- ROLLBACK: update public.organizations set limites_isentos = true;
--           (as 9 estavam isentas — restaurar em bloco devolve o estado exato)
-- ---------------------------------------------------------------------------
update public.organizations set limites_isentos = false where limites_isentos;

do $$
declare n int;
begin
  select count(*) into n from public.organizations where limites_isentos;
  if n > 0 then
    raise exception 'ainda ha % organizacao(oes) isenta(s)', n;
  end if;
end $$;
```

- [ ] **Step 3: Aplicar**

Aplicar via `mcp__kobly-supabase__apply_migration` com `name = "ativar_cobranca"`.

Expected: `{"success": true}`

- [ ] **Step 4: Verificar que o gate morde quem está fora e não morde quem está dentro**

Run (via `mcp__kobly-supabase__execute_sql`) — o `rollback` desfaz, nada é gravado:

```sql
begin;
  insert into public.postback_tokens (organization_id, token, ativo)
  select o.id, 'pbk_teste_gate_' || replace(gen_random_uuid()::text, '-', ''), true
    from public.organizations o where o.nome = 'Digital';
rollback;
```

Expected: **erro** `limite_integracoes_atingido: o plano permite 3 integracao(oes) de checkout. Remova uma ou faça upgrade.`

E a contraprova, numa org dentro do limite:

```sql
begin;
  insert into public.postback_tokens (organization_id, token, ativo)
  select o.id, 'pbk_teste_gate_' || replace(gen_random_uuid()::text, '-', ''), true
    from public.organizations o where o.nome = 'Nayara ';
rollback;
```

Expected: **sucesso** (`INSERT 0 1`) antes do rollback. Atenção ao espaço no fim de `'Nayara '` — é o nome real da org.

- [ ] **Step 5: Verificar que nada foi destruído**

Run:

```sql
select o.nome, o.limites_isentos,
       (select count(*) from public.postback_tokens t where t.organization_id = o.id) as integracoes
  from public.organizations o
 order by o.nome;
```

Expected: 9 linhas, todas `limites_isentos = false`, e a **Digital ainda com 5 integrações** — a contagem tem que bater com a saída do Step 1.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0064_ativar_cobranca.sql
git commit -m "feat(planos): tirar a isencao e ativar a cobranca dos limites"
```

---

## Fora deste plano

**Copy da página de vendas.** A landing não está neste repositório (`src/routes/Plans.jsx` é a tela interna). As mudanças necessárias estão listadas na seção "Copy da página" da spec: remover a contagem de números de WhatsApp dos 3 planos, reescrever a FAQ do número, remover os pacotes de créditos de SMS e a FAQ correspondente, trocar "pacote adicional de mensagens" por excedente automático, e remover "% recorrente paga automaticamente" do bloco Agências.

**Follow-up comercial.** Decidir se a Digital sobe para Pro (hoje trava em 5 integrações num plano de 3).

**Non-goals registrados na spec:** créditos de SMS pré-pagos, comissão de agência, multi-número de WhatsApp, alerta de 80% da franquia, proração de upgrade/downgrade.
