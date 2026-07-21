# Link de recuperação no CTA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o botão dos e-mails de recuperação apontar para o checkout daquela transação, e não enviar quando não existe link utilizável.

**Architecture:** A lógica pura (validar link, decidir se pula) vive em `supabase/functions/_shared/cta.ts` com `deno test`, e é **inlinada** em `process-steps/index.ts` — mesma convenção já usada por `_shared/unsub.ts`. O CTA passa a ser resolvido pelo **evento gatilho** (`webhook_events.checkout_url`, imutável, alcançado por `scheduled_steps.webhook_event_id`) em vez de `leads.link_recuperacao` (mutável e pegajoso). O gate fica atrás de uma chave de desligamento lida do Vault, default DESLIGADO, para poder subir antes da plataforma mandar o campo.

**Tech Stack:** Supabase (Postgres 15 + Vault + Edge Functions em Deno), PostgREST, Resend/Z-API/Twilio, React/Vite (gerador de template).

## Global Constraints

- **Prefixo obrigatório `pulado:` no `last_error`.** É o contrato que a jornada usa para exibir passo pulado; sem ele o passo aparece como **falha vermelha**. Ver `process-steps/index.ts:313`, `:372`, `:379`.
- **Gate sempre ANTES de `reserveOne`.** Passo pulado não pode consumir cota do plano.
- **No WhatsApp, também antes da chamada de rede ao Z-API** (`phone-exists`): o `reserveOne` desse canal está em `:546`, depois da rede — não replicar essa posição.
- **Nada de `../_shared/` importado em `process-steps`**: a lógica é inlinada, com comentário `manter idêntico a _shared/cta.ts`. Mesma razão documentada em `send-email/index.ts:26`.
- **Emails/strings comparados sempre com `trim()`**; link só é válido se casar `^https?://` e ter hostname.
- Migrations: `supabase/migrations/00NN_nome.sql`, próximo número = `0059`.
- Deploy: `supabase functions deploy <nome> --project-ref hvkuymprmfrjrgpqaxbw` (a CLI está instalada e o projeto linkado; usar a CLI, não o MCP — o arquivo tem 37 KB).
- Não há test runner JS. Lógica pura → `deno test`. Integração → SQL de asserção.
- **Nada neste plano é testável de ponta a ponta enquanto nenhuma campanha Ativa escutar o token `7384a44e`** (ver Task 9).

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `supabase/functions/_shared/cta.ts` | **Criar.** Lógica pura: validar link, detectar uso de CTA, resolver destino, decidir pulo. Sem I/O. |
| `supabase/functions/_shared/cta_test.ts` | **Criar.** `deno test` da lógica acima. |
| `supabase/functions/process-steps/index.ts` | **Modificar.** Inlinar a lógica; trocar a fonte do CTA nos 3 canais; aplicar o gate; ler a chave de desligamento. |
| `supabase/functions/postback-receiver/index.ts` | **Modificar.** Validar a URL antes de gravar (`extractRecoveryLink`). |
| `src/lib/emailTemplate.js` | **Modificar.** Default do `button()` passa de `'#'` para `{{cta_link}}`. |
| `supabase/migrations/0059_cta_gate_flag.sql` | **Criar.** Secret da chave de desligamento no Vault. |

---

## Task 1: Lógica pura do CTA (`_shared/cta.ts`)

**Files:**
- Create: `supabase/functions/_shared/cta.ts`
- Test: `supabase/functions/_shared/cta_test.ts`

**Interfaces:**
- Produces:
  - `EVENTOS_RECUPERACAO: ReadonlySet<string>`
  - `PULADO_SEM_LINK: string`
  - `isUsableCtaLink(v: unknown): boolean`
  - `corpoUsaCta(corpo: string | null | undefined): boolean`
  - `botoesUsamCta(botoes: unknown): boolean`
  - `resolveCtaLink(a: { eventoCheckoutUrl?: string | null; leadLinkRecuperacao?: string | null; brandLink?: string | null; fallback: string }): string`
  - `devePularPorFaltaDeLink(a: { usaCta: boolean; tipoEventoGatilho: string | null; linkResolvido: string }): boolean`

- [ ] **Step 1: Escrever o teste que falha**

Create `supabase/functions/_shared/cta_test.ts`:

```ts
// supabase/functions/_shared/cta_test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  botoesUsamCta,
  corpoUsaCta,
  devePularPorFaltaDeLink,
  isUsableCtaLink,
  resolveCtaLink,
} from "./cta.ts";

Deno.test("isUsableCtaLink: aceita http(s) com host", () => {
  assertEquals(isUsableCtaLink("https://checkout.payt.com.br/qr-pix/ABC123"), true);
  assertEquals(isUsableCtaLink("http://loja.com/x"), true);
  assertEquals(isUsableCtaLink("  https://loja.com/x  "), true);
});

Deno.test("isUsableCtaLink: rejeita os fallbacks mortos que hoje saem no e-mail", () => {
  assertEquals(isUsableCtaLink("#"), false);
  assertEquals(isUsableCtaLink(""), false);
  assertEquals(isUsableCtaLink("   "), false);
  assertEquals(isUsableCtaLink(null), false);
  assertEquals(isUsableCtaLink(undefined), false);
  assertEquals(isUsableCtaLink("mailto:x@y.com"), false);
  assertEquals(isUsableCtaLink("javascript:alert(1)"), false);
  assertEquals(isUsableCtaLink("loja.com/sem-esquema"), false);
  assertEquals(isUsableCtaLink(123), false);
});

Deno.test("corpoUsaCta: detecta o placeholder no corpo", () => {
  assertEquals(corpoUsaCta('<a href="{{cta_link}}">Pagar</a>'), true);
  assertEquals(corpoUsaCta('<a href="https://fixo.com">Pagar</a>'), false);
  assertEquals(corpoUsaCta(null), false);
  assertEquals(corpoUsaCta(undefined), false);
});

Deno.test("botoesUsamCta: botao URL SEM url propria usa o CTA por default", () => {
  // process-steps:508 faz String(b?.url || "{{cta_link}}") — o botao usa o CTA
  // mesmo sem o placeholder aparecer em lugar nenhum. Detectar so pelo corpo
  // deixaria este caso passar pelo gate.
  assertEquals(botoesUsamCta([{ type: "URL", label: "Pagar" }]), true);
  assertEquals(botoesUsamCta([{ label: "Pagar" }]), true); // type default = URL
  assertEquals(botoesUsamCta([{ type: "URL", url: "{{cta_link}}" }]), true);
  assertEquals(botoesUsamCta([{ type: "URL", url: "https://fixo.com" }]), false);
  assertEquals(botoesUsamCta([{ type: "REPLY", label: "Oi" }]), false);
  assertEquals(botoesUsamCta([{ type: "CALL", phone: "11999999999" }]), false);
  assertEquals(botoesUsamCta([]), false);
  assertEquals(botoesUsamCta(null), false);
});

Deno.test("botoesUsamCta: so olha os 3 primeiros (mesmo corte do envio)", () => {
  const quatro = [
    { type: "URL", url: "https://a.com" },
    { type: "URL", url: "https://b.com" },
    { type: "URL", url: "https://c.com" },
    { type: "URL" }, // 4o usaria o CTA, mas e descartado no envio (slice(0,3))
  ];
  assertEquals(botoesUsamCta(quatro), false);
});

Deno.test("resolveCtaLink: evento gatilho tem prioridade sobre o lead", () => {
  // O link do evento e imutavel; o do lead e sobrescrito/pegajoso.
  assertEquals(
    resolveCtaLink({
      eventoCheckoutUrl: "https://checkout.payt.com.br/qr-pix/NOVO",
      leadLinkRecuperacao: "https://checkout.payt.com.br/qr-pix/ANTIGO",
      brandLink: "https://loja.com",
      fallback: "#",
    }),
    "https://checkout.payt.com.br/qr-pix/NOVO",
  );
});

Deno.test("resolveCtaLink: cai pro lead so quando o evento nao tem link utilizavel", () => {
  assertEquals(
    resolveCtaLink({ eventoCheckoutUrl: null, leadLinkRecuperacao: "https://l.com/x", brandLink: null, fallback: "#" }),
    "https://l.com/x",
  );
  assertEquals(
    resolveCtaLink({ eventoCheckoutUrl: "#", leadLinkRecuperacao: "https://l.com/x", brandLink: null, fallback: "#" }),
    "https://l.com/x",
  );
});

Deno.test("resolveCtaLink: brand e ultimo; fallback quando nada presta", () => {
  assertEquals(
    resolveCtaLink({ eventoCheckoutUrl: null, leadLinkRecuperacao: null, brandLink: "https://loja.com", fallback: "#" }),
    "https://loja.com",
  );
  assertEquals(
    resolveCtaLink({ eventoCheckoutUrl: null, leadLinkRecuperacao: null, brandLink: "", fallback: "#" }),
    "#",
  );
  // SMS usa fallback "" (process-steps:631), nao "#"
  assertEquals(
    resolveCtaLink({ eventoCheckoutUrl: null, leadLinkRecuperacao: null, brandLink: null, fallback: "" }),
    "",
  );
});

Deno.test("devePularPorFaltaDeLink: pula evento transacional sem link utilizavel", () => {
  for (const ev of ["Pix Gerado", "Boleto Gerado", "Abandono de carrinho", "Depósito Solicitado", "Compra Recusada"]) {
    assertEquals(
      devePularPorFaltaDeLink({ usaCta: true, tipoEventoGatilho: ev, linkResolvido: "#" }),
      true,
      `deveria pular em ${ev}`,
    );
  }
});

Deno.test("devePularPorFaltaDeLink: NAO pula quando o link presta", () => {
  assertEquals(
    devePularPorFaltaDeLink({ usaCta: true, tipoEventoGatilho: "Pix Gerado", linkResolvido: "https://c.com/x" }),
    false,
  );
});

Deno.test("devePularPorFaltaDeLink: NAO pula evento terminal nem passo sem CTA", () => {
  assertEquals(
    devePularPorFaltaDeLink({ usaCta: true, tipoEventoGatilho: "Compra Aprovada", linkResolvido: "#" }),
    false,
  );
  assertEquals(
    devePularPorFaltaDeLink({ usaCta: false, tipoEventoGatilho: "Pix Gerado", linkResolvido: "#" }),
    false,
  );
});

Deno.test("devePularPorFaltaDeLink: sem evento gatilho, nao pula (fail-open)", () => {
  // Passo criado fora de postback (webhook_event_id NULL) nao tem transacao
  // pendente conhecida — nao e caso deste gate.
  assertEquals(
    devePularPorFaltaDeLink({ usaCta: true, tipoEventoGatilho: null, linkResolvido: "#" }),
    false,
  );
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `deno test --allow-read supabase/functions/_shared/cta_test.ts`
Expected: FAIL — `Module not found "file:///.../_shared/cta.ts"`.

- [ ] **Step 3: Implementar o módulo**

Create `supabase/functions/_shared/cta.ts`:

```ts
// supabase/functions/_shared/cta.ts
// Lógica PURA do destino do CTA dos fluxos (sem I/O, para poder ter deno test).
// É inlinada em process-steps/index.ts — ao mexer aqui, mexa lá também.
//
// Por que existe: o botão dos e-mails de recuperação apontava para
// `lead.link_recuperacao || brand.link || "#"`. Três problemas, todos medidos em
// produção em 2026-07-21: (1) `link_recuperacao` nunca é limpo, então comprador
// recorrente recebia o checkout de uma compra ANTERIOR — parece funcionar e leva
// a um Pix expirado; (2) as 6 brands estão com `link_loja` vazio, então o
// fallback resolvia para `#` — botão morto, sem nenhuma visibilidade; (3) o
// evento que ORIGINOU o passo é imutável e está em webhook_events, enquanto
// `leads.ultimo_evento` é sobrescrito por qualquer postback posterior (divergia
// em 17 de 42 passos agendados).

// Estados com transação pendente ou reprocessável — nos quais o CTA promete
// retomar algo ESPECÍFICO e um link genérico é pior que não enviar. Os terminais
// (Compra Aprovada, Compra cancelada, Compra Reembolsada, Chargeback,
// Cancelamento de Assinatura) ficam de fora de propósito.
// ⚠️ Ponto de manutenção: evento de recuperação novo no enum `tipo_evento`
// precisa entrar AQUI, senão volta a sair e-mail com botão quebrado em silêncio.
export const EVENTOS_RECUPERACAO: ReadonlySet<string> = new Set([
  "Abandono de carrinho",
  "Pix Gerado",
  "Boleto Gerado",
  "Depósito Solicitado",
  "Compra Recusada",
]);

// Prefixo `pulado:` é o contrato que a jornada usa para exibir passo pulado em vez
// de falha vermelha (ver process-steps:313/:372/:379). Não remover o prefixo.
export const PULADO_SEM_LINK = "pulado: sem link de recuperação";

// Só http(s) com host. Rejeita "#", "", "mailto:", "javascript:" e URL sem esquema —
// que é exatamente o que sai hoje quando não há link.
export function isUsableCtaLink(v: unknown): boolean {
  if (typeof v !== "string") return false;
  const s = v.trim();
  if (!/^https?:\/\//i.test(s)) return false;
  try {
    return !!new URL(s).hostname;
  } catch {
    return false;
  }
}

export function corpoUsaCta(corpo: string | null | undefined): boolean {
  return typeof corpo === "string" && corpo.includes("{{cta_link}}");
}

// O botão de URL do WhatsApp usa o CTA por DEFAULT quando não tem url própria
// (process-steps:508 → String(b?.url || "{{cta_link}}")). Detectar só pelo corpo
// deixaria esse caso escapar do gate. O slice(0,3) espelha o corte do envio.
export function botoesUsamCta(botoes: unknown): boolean {
  if (!Array.isArray(botoes)) return false;
  return botoes.slice(0, 3).some((b: Record<string, unknown> | null) => {
    const type = String((b as any)?.type || "URL").toUpperCase();
    if (type !== "URL") return false;
    return String((b as any)?.url || "{{cta_link}}").includes("{{cta_link}}");
  });
}

// Prioridade: link do EVENTO gatilho (imutável) > link do lead (fallback para
// passos sem webhook_event_id) > URL da loja > fallback do canal.
export function resolveCtaLink(a: {
  eventoCheckoutUrl?: string | null;
  leadLinkRecuperacao?: string | null;
  brandLink?: string | null;
  fallback: string;
}): string {
  if (isUsableCtaLink(a.eventoCheckoutUrl)) return String(a.eventoCheckoutUrl).trim();
  if (isUsableCtaLink(a.leadLinkRecuperacao)) return String(a.leadLinkRecuperacao).trim();
  if (isUsableCtaLink(a.brandLink)) return String(a.brandLink).trim();
  return a.fallback;
}

// Pula quando as três valem juntas: o passo vai renderizar um CTA dinâmico, o
// evento gatilho é de recuperação transacional, e o link resolvido não presta.
// Sem evento gatilho → fail-open (passo criado fora de postback).
export function devePularPorFaltaDeLink(a: {
  usaCta: boolean;
  tipoEventoGatilho: string | null;
  linkResolvido: string;
}): boolean {
  if (!a.usaCta) return false;
  if (!a.tipoEventoGatilho || !EVENTOS_RECUPERACAO.has(a.tipoEventoGatilho)) return false;
  return !isUsableCtaLink(a.linkResolvido);
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `deno test --allow-read supabase/functions/_shared/cta_test.ts`
Expected: PASS — `ok | 12 passed | 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/cta.ts supabase/functions/_shared/cta_test.ts
git commit -m "feat(cta): logica pura de resolucao e gate do link de recuperacao"
```

---

## Task 2: Chave de desligamento no Vault

**Files:**
- Create: `supabase/migrations/0059_cta_gate_flag.sql`

**Interfaces:**
- Produces: secret `cta_gate_enabled` no Vault, lido por `get_secret`. Valor `"true"` liga o gate; qualquer outro valor (ou ausência) mantém desligado.

**Por que default desligado:** o gate só deve valer depois que a plataforma mandar o campo de URL (Task 10). Ligado antes disso, os passos de recuperação de PIX passam a ser pulados em massa. A chave permite subir o código agora e ligar depois, sem deploy.

- [ ] **Step 1: Escrever a migration**

Create `supabase/migrations/0059_cta_gate_flag.sql`:

```sql
-- 0059_cta_gate_flag.sql
-- Chave de desligamento do gate de CTA sem link (ver process-steps).
-- Default "false": o código sobe inerte e o comportamento não muda até alguém
-- ligar. Motivo: o gate só faz sentido depois que o postback voltar a trazer o
-- link de checkout; ligado antes, ele pula em massa os passos de recuperação de
-- Pix. Sem esta chave, a única reversão de um falso positivo seria um deploy.
-- Ligar com:  select vault.update_secret((select id from vault.secrets where name='cta_gate_enabled'), 'true');
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'cta_gate_enabled') then
    perform vault.create_secret('false', 'cta_gate_enabled', 'Liga o gate que impede envio de passo de recuperacao sem link utilizavel no CTA');
  end if;
end $$;
```

- [ ] **Step 2: Aplicar**

Aplicar via `mcp__kobly-supabase__apply_migration` (name: `0059_cta_gate_flag`, query: o SQL acima). Se o classificador bloquear, rodar o mesmo SQL no SQL Editor do painel.

- [ ] **Step 3: Verificar**

Run (via `mcp__kobly-supabase__execute_sql`):
```sql
select name from vault.secrets where name = 'cta_gate_enabled';
```
Expected: 1 linha.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0059_cta_gate_flag.sql
git commit -m "feat(db): flag cta_gate_enabled (default desligado)"
```

---

## Task 3: Trazer o evento gatilho para a fila do `process-steps`

**Files:**
- Modify: `supabase/functions/process-steps/index.ts:187-188`

**Interfaces:**
- Produces: cada item `s` da fila passa a expor `s.webhook_event_id` e `s.webhook_events?.{tipo_evento, checkout_url}`.

**Por que é uma task própria:** sem este campo o gate lê `undefined`, classifica tudo como não-transacional e libera 100% dos envios — falha silenciosa. O `deno test` da Task 1 passaria mesmo assim, porque recebe o campo pronto. Este é o passo que o teste puro não cobre.

- [ ] **Step 1: Alterar o select**

Em `supabase/functions/process-steps/index.ts`, linha 187-188, trocar:

```ts
  const { data: due, error } = await sb.from("scheduled_steps")
    .select("id, organization_id, lead_id, attempts, last_error, created_at, flow_steps(id, tipo_card, email_id, whatsapp_message_id, sms_message_id, flow_id, condicao, campaign_flows!flow_id(campaign_id, campaigns(brand_id))), leads(id, email, nome, telefone, link_recuperacao, produto, valor_compra)")
```

por:

```ts
  // CTA-1: webhook_events é a fonte IMUTÁVEL do evento que originou este passo.
  // `leads.ultimo_evento` NÃO serve: é sobrescrito por qualquer postback posterior
  // do mesmo e-mail e divergia do gatilho em 17 de 42 passos (40%) em 21/07 —
  // um passo de Pix cujo lead virou "Compra Aprovada" seria classificado como
  // terminal e escaparia do gate. `checkout_url` idem: o do evento é o daquela
  // transação, o do lead é pegajoso (nunca limpo).
  const { data: due, error } = await sb.from("scheduled_steps")
    .select("id, organization_id, lead_id, webhook_event_id, attempts, last_error, created_at, flow_steps(id, tipo_card, email_id, whatsapp_message_id, sms_message_id, flow_id, condicao, campaign_flows!flow_id(campaign_id, campaigns(brand_id))), leads(id, email, nome, telefone, link_recuperacao, produto, valor_compra), webhook_events(tipo_evento, checkout_url)")
```

- [ ] **Step 2: Verificar que o embed resolve (antes de deployar)**

Run (via `mcp__kobly-supabase__execute_sql`) — o equivalente SQL do embed:
```sql
select ss.id, ss.webhook_event_id, we.tipo_evento, we.checkout_url
from public.scheduled_steps ss
left join public.webhook_events we on we.id = ss.webhook_event_id
limit 5;
```
Expected: retorna linhas com `tipo_evento` preenchido onde `webhook_event_id` não é nulo. Se a FK não existir, o embed do PostgREST falharia — este SQL prova que existe.

- [ ] **Step 3: Deploy**

```bash
supabase functions deploy process-steps --project-ref hvkuymprmfrjrgpqaxbw
```

- [ ] **Step 4: Verificar que a fila não quebrou**

Run (via `mcp__kobly-supabase__get_logs`, service `edge-function`): as invocações de `process-steps` devem seguir `200`. Um select inválido no PostgREST devolveria `query_failed` — o handler responde 500 nesse caso (linha 191).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/process-steps/index.ts
git commit -m "feat(process-steps): fila passa a trazer o evento gatilho (webhook_events)"
```

---

## Task 4: Inlinar a lógica + ler a chave de desligamento

**Files:**
- Modify: `supabase/functions/process-steps/index.ts` (topo do arquivo, e junto dos outros `get_secret` em `:111-112`)

**Interfaces:**
- Consumes: `_shared/cta.ts` (Task 1) — copiado, não importado.
- Produces: no escopo do handler, `EVENTOS_RECUPERACAO`, `PULADO_SEM_LINK`, `isUsableCtaLink`, `corpoUsaCta`, `botoesUsamCta`, `resolveCtaLink`, `devePularPorFaltaDeLink`, e a const `gateLigado: boolean`.

- [ ] **Step 1: Inlinar o módulo no topo**

Em `supabase/functions/process-steps/index.ts`, logo abaixo do bloco inline de `signUnsubToken` (que termina na linha 43), colar:

```ts
// Inlinado de _shared/cta.ts (per-function deploy não empacota ../_shared/).
// Manter semanticamente idêntico ao módulo — os testes vivem em _shared/cta_test.ts.
const EVENTOS_RECUPERACAO: ReadonlySet<string> = new Set([
  "Abandono de carrinho", "Pix Gerado", "Boleto Gerado", "Depósito Solicitado", "Compra Recusada",
]);
const PULADO_SEM_LINK = "pulado: sem link de recuperação";
function isUsableCtaLink(v: unknown): boolean {
  if (typeof v !== "string") return false;
  const s = v.trim();
  if (!/^https?:\/\//i.test(s)) return false;
  try { return !!new URL(s).hostname; } catch { return false; }
}
function corpoUsaCta(corpo: string | null | undefined): boolean {
  return typeof corpo === "string" && corpo.includes("{{cta_link}}");
}
function botoesUsamCta(botoes: unknown): boolean {
  if (!Array.isArray(botoes)) return false;
  return botoes.slice(0, 3).some((b: any) => {
    const type = String(b?.type || "URL").toUpperCase();
    if (type !== "URL") return false;
    return String(b?.url || "{{cta_link}}").includes("{{cta_link}}");
  });
}
function resolveCtaLink(a: {
  eventoCheckoutUrl?: string | null; leadLinkRecuperacao?: string | null;
  brandLink?: string | null; fallback: string;
}): string {
  if (isUsableCtaLink(a.eventoCheckoutUrl)) return String(a.eventoCheckoutUrl).trim();
  if (isUsableCtaLink(a.leadLinkRecuperacao)) return String(a.leadLinkRecuperacao).trim();
  if (isUsableCtaLink(a.brandLink)) return String(a.brandLink).trim();
  return a.fallback;
}
function devePularPorFaltaDeLink(a: {
  usaCta: boolean; tipoEventoGatilho: string | null; linkResolvido: string;
}): boolean {
  if (!a.usaCta) return false;
  if (!a.tipoEventoGatilho || !EVENTOS_RECUPERACAO.has(a.tipoEventoGatilho)) return false;
  return !isUsableCtaLink(a.linkResolvido);
}
```

- [ ] **Step 2: Ler a chave de desligamento**

Em `supabase/functions/process-steps/index.ts`, logo depois da linha 112 (`unsubSecret`), acrescentar:

```ts
  // Gate de CTA sem link: DESLIGADO por padrão (secret ausente ou != "true").
  // Ligado só depois que o postback voltar a trazer o link de checkout — antes
  // disso ele pularia em massa os passos de recuperação de Pix. Ler aqui (uma vez
  // por tick) e não por step, para não multiplicar decrypt no Postgres.
  const { data: gateFlag } = await sb.rpc("get_secret", { p_name: "cta_gate_enabled" });
  const gateLigado = String(gateFlag ?? "").trim().toLowerCase() === "true";
```

- [ ] **Step 3: Verificar que compila**

Run: `deno lint supabase/functions/process-steps/index.ts 2>&1 | grep -c 'error\['`
Expected: o mesmo número de antes da mudança (comparar com `deno lint` na versão do HEAD via `git show HEAD:supabase/functions/process-steps/index.ts > /tmp/ps_head.ts && deno lint /tmp/ps_head.ts`). Nenhum erro novo.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/process-steps/index.ts
git commit -m "feat(process-steps): inlina logica de CTA + flag de desligamento"
```

---

## Task 5: Canal e-mail — nova fonte do CTA + gate

**Files:**
- Modify: `supabase/functions/process-steps/index.ts:330-331` (resolução) e `:376` (gate, antes do `reserveOne`)

**Interfaces:**
- Consumes: `resolveCtaLink`, `devePularPorFaltaDeLink`, `corpoUsaCta`, `PULADO_SEM_LINK`, `gateLigado` (Tasks 3 e 4).

- [ ] **Step 1: Trocar a resolução do CTA**

Trocar as linhas 330-331:

```ts
        // Resolve o destino do botão: link do lead (do postback) > URL da loja (org) > '#'.
        const ctaLink = lead.link_recuperacao || brand.link || "#";
```

por:

```ts
        // Destino do botão: link do EVENTO gatilho (imutável, daquela transação) >
        // link do lead (só para passo sem webhook_event_id) > URL da loja > '#'.
        // A ordem antiga começava pelo lead, que é pegajoso: comprador recorrente
        // recebia o checkout da compra anterior — parece funcionar e leva a um Pix
        // já pago ou expirado.
        const eventoGatilho = (s as any).webhook_events ?? null;
        const tipoEventoGatilho: string | null = eventoGatilho?.tipo_evento ?? null;
        const ctaLink = resolveCtaLink({
          eventoCheckoutUrl: eventoGatilho?.checkout_url ?? null,
          leadLinkRecuperacao: lead.link_recuperacao,
          brandLink: brand.link,
          fallback: "#",
        });
```

- [ ] **Step 2: Aplicar o gate antes de reservar cota**

Localizar (linha ~376):

```ts
        // Cota do plano: reserva antes de enviar (não conta condição-pulada/órfão).
        const reserveResultEmail = await reserveOne(s.organization_id);
```

e inserir IMEDIATAMENTE ANTES:

```ts
        // CTA sem destino: não enviar. Um e-mail que promete "finalizar seu Pix" e
        // leva para `#` ou para a home queima reputação e frustra o comprador —
        // pior que não mandar. Antes do reserveOne de propósito: passo pulado não
        // pode custar cota. Só vale para evento de recuperação transacional; e-mail
        // não-transacional segue com o fallback de sempre.
        if (gateLigado && devePularPorFaltaDeLink({
          usaCta: corpoUsaCta(em.corpo_html),
          tipoEventoGatilho,
          linkResolvido: ctaLink,
        })) {
          await finalize(s.id, curAttempts + 1, PULADO_SEM_LINK);
          skipped++; processed++;
          continue;
        }
```

- [ ] **Step 3: Deploy**

```bash
supabase functions deploy process-steps --project-ref hvkuymprmfrjrgpqaxbw
```

- [ ] **Step 4: Verificar que nada mudou com o gate desligado**

Run (via `mcp__kobly-supabase__execute_sql`):
```sql
select last_error, count(*) from public.scheduled_steps
where updated_at > now() - interval '15 minutes' group by 1;
```
Expected: **nenhuma** linha com `pulado: sem link de recuperação` — a flag está `false`, o comportamento é idêntico ao anterior.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/process-steps/index.ts
git commit -m "feat(process-steps): e-mail resolve CTA pelo evento gatilho + gate sem link"
```

---

## Task 6: Canal WhatsApp — nova fonte do CTA + gate antes da rede

**Files:**
- Modify: `supabase/functions/process-steps/index.ts:493-494` (resolução) e após `:522` (gate)

**Interfaces:**
- Consumes: `resolveCtaLink`, `devePularPorFaltaDeLink`, `corpoUsaCta`, `botoesUsamCta`, `PULADO_SEM_LINK`, `gateLigado`.

**Cuidado específico deste canal:** o `reserveOne` do WhatsApp (linha 546) está aninhado em `if (zapiInstanceId && zapiToken)` e **depois** da chamada de rede `phone-exists`. Colocar o gate "no mesmo lugar do e-mail" gastaria uma chamada de rede num passo que vai ser pulado, e não rodaria quando faltam credenciais Z-API. O gate vai **antes** do bloco de rede.

- [ ] **Step 1: Trocar a resolução do CTA**

Trocar as linhas 493-494:

```ts
        // Mesmo destino do botão do e-mail: link do lead (postback) > URL da loja (org) > '#'.
        const ctaLink = lead.link_recuperacao || brand.link || "#";
```

por:

```ts
        // Mesma prioridade do e-mail: evento gatilho > lead > loja > '#'.
        const eventoGatilho = (s as any).webhook_events ?? null;
        const tipoEventoGatilho: string | null = eventoGatilho?.tipo_evento ?? null;
        const ctaLink = resolveCtaLink({
          eventoCheckoutUrl: eventoGatilho?.checkout_url ?? null,
          leadLinkRecuperacao: lead.link_recuperacao,
          brandLink: brand.link,
          fallback: "#",
        });
```

- [ ] **Step 2: Aplicar o gate antes do bloco de rede**

Localizar (linha ~524, logo depois de `const buttons = hasReply && hasAction ? ... : buttonActions;`):

```ts
        let ok = false, msgId: string | null = null, errDetail: string | null = null;
        let semWhatsapp = false; // número não existe no WhatsApp → falha DEFINITIVA (sem retry)
```

e inserir IMEDIATAMENTE ANTES:

```ts
        // CTA sem destino: não enviar (mesma regra do e-mail). Fica ANTES do bloco
        // Z-API porque o reserveOne deste canal (abaixo) está depois de uma chamada
        // de rede (phone-exists) e dentro do if de credenciais — pular aqui evita
        // gastar rede num passo que não vai sair, e funciona mesmo sem credencial.
        // `botoesUsamCta`: o botão de URL sem url própria usa {{cta_link}} por
        // default, então o corpo pode não ter o placeholder e ainda assim depender dele.
        if (gateLigado && devePularPorFaltaDeLink({
          usaCta: corpoUsaCta(wm?.corpo_texto) || botoesUsamCta(wm?.botoes),
          tipoEventoGatilho,
          linkResolvido: ctaLink,
        })) {
          await finalize(s.id, curAttempts + 1, PULADO_SEM_LINK);
          skipped++; processed++;
          continue;
        }
```

- [ ] **Step 3: Deploy**

```bash
supabase functions deploy process-steps --project-ref hvkuymprmfrjrgpqaxbw
```

- [ ] **Step 4: Verificar**

Run: `deno lint supabase/functions/process-steps/index.ts 2>&1 | grep -c 'error\['`
Expected: sem erros novos em relação ao HEAD anterior.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/process-steps/index.ts
git commit -m "feat(process-steps): whatsapp resolve CTA pelo evento gatilho + gate antes da rede"
```

---

## Task 7: Canal SMS — nova fonte do CTA + gate

**Files:**
- Modify: `supabase/functions/process-steps/index.ts:631` (resolução) e `:640` (gate)

**Interfaces:**
- Consumes: `resolveCtaLink`, `devePularPorFaltaDeLink`, `corpoUsaCta`, `PULADO_SEM_LINK`, `gateLigado`.

**Nota factual:** o fallback deste canal é `""` (string vazia), não `"#"` como e-mail e WhatsApp. Sem link, a mensagem sai com a URL sumida no meio da frase (`"Acesse: "`). Manter o `""` como fallback — o gate é que impede a frase quebrada de sair.

- [ ] **Step 1: Trocar a resolução do CTA**

Trocar a linha 631:

```ts
        const ctaLink = lead.link_recuperacao || brand.link || "";
```

por:

```ts
        // Mesma prioridade dos outros canais. Fallback "" (não "#"): num SMS um
        // "#" apareceria como lixo no texto; vazio ao menos não polui. O gate
        // abaixo é o que impede a frase truncada de sair.
        const eventoGatilho = (s as any).webhook_events ?? null;
        const tipoEventoGatilho: string | null = eventoGatilho?.tipo_evento ?? null;
        const ctaLink = resolveCtaLink({
          eventoCheckoutUrl: eventoGatilho?.checkout_url ?? null,
          leadLinkRecuperacao: lead.link_recuperacao,
          brandLink: brand.link,
          fallback: "",
        });
```

- [ ] **Step 2: Aplicar o gate antes de reservar cota**

Localizar (linha ~640):

```ts
        // Cota do plano: reserva antes de enviar (mesmo trilho de e-mail/WhatsApp).
        const reserveResultSms = await reserveOne(s.organization_id);
```

e inserir IMEDIATAMENTE ANTES:

```ts
        // CTA sem destino: não enviar (mesma regra dos outros canais).
        if (gateLigado && devePularPorFaltaDeLink({
          usaCta: corpoUsaCta(sm.corpo_texto),
          tipoEventoGatilho,
          linkResolvido: ctaLink,
        })) {
          await finalize(s.id, curAttempts + 1, PULADO_SEM_LINK);
          skipped++; processed++;
          continue;
        }
```

- [ ] **Step 3: Deploy**

```bash
supabase functions deploy process-steps --project-ref hvkuymprmfrjrgpqaxbw
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/process-steps/index.ts
git commit -m "feat(process-steps): sms resolve CTA pelo evento gatilho + gate sem link"
```

---

## Task 8: Validar a URL antes de gravar (postback-receiver)

**Files:**
- Modify: `supabase/functions/postback-receiver/index.ts` (fim de `extractRecoveryLink`, linha ~331)

**Interfaces:**
- Consumes: nada de outras tasks.
- Produces: `extractRecoveryLink` só devolve URL `http(s)` com host, ou `null`.

**Por quê:** o varredor pontua por nome de chave e pode eleger qualquer string que comece com `http`. Um link inválido gravado é pior que link ausente: passa pelo gate da Task 5 e vira botão quebrado.

- [ ] **Step 1: Trocar o return final**

Em `extractRecoveryLink`, trocar:

```ts
  walk(payload);
  return best ? best.url : null;
}
```

por:

```ts
  walk(payload);
  // Valida antes de devolver: o `consider` acima só exige que a string comece com
  // http, então uma chave com nome plausível e valor lixo ("https://") passaria e
  // seria gravada como link de recuperação. Link inválido é PIOR que ausente —
  // atravessa o gate do process-steps e vira botão quebrado na caixa do comprador.
  if (!best) return null;
  try {
    return new URL(best.url).hostname ? best.url : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Verificar que nada regrediu no lint**

Run:
```bash
git show HEAD:supabase/functions/postback-receiver/index.ts > /tmp/pb_head.ts
echo "antes: $(deno lint /tmp/pb_head.ts 2>&1 | grep -c 'error\[')"
echo "depois: $(deno lint supabase/functions/postback-receiver/index.ts 2>&1 | grep -c 'error\[')"
```
Expected: os dois números iguais.

- [ ] **Step 3: Deploy**

```bash
supabase functions deploy postback-receiver --project-ref hvkuymprmfrjrgpqaxbw
```

- [ ] **Step 4: Verificar que links legítimos continuam entrando**

Run (via `mcp__kobly-supabase__execute_sql`), após o próximo postback com link:
```sql
select checkout_url, created_at from public.webhook_events
where checkout_url is not null order by created_at desc limit 3;
```
Expected: URLs completas, nenhum valor truncado ou vazio.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/postback-receiver/index.ts
git commit -m "fix(postback): valida a URL antes de gravar como link de recuperacao"
```

---

## Task 9: Default do botão no gerador de template

**Files:**
- Modify: `src/lib/emailTemplate.js:80`

**Interfaces:**
- Consumes: nada.
- Produces: template novo nasce com CTA dinâmico.

**Por quê:** hoje `button()` tem `href = '#'` como default, então todo template criado sem preencher o link nasce com botão morto. Trocar o default faz o caminho certo ser o caminho preguiçoso — é o que impede a próxima campanha de repetir o problema.

- [ ] **Step 1: Trocar o default**

Em `src/lib/emailTemplate.js`, linha 80, trocar:

```js
function button({ label, href = '#' }, P) {
```

por:

```js
// Default é o placeholder, não '#': um botão sem link explícito deve apontar para
// o checkout da transação (resolvido no envio pelo process-steps), não para lugar
// nenhum. Em 21/07 havia 3 passos ATIVOS com href="#" — botão morto na caixa do
// comprador — e 7 apontando todos para o MESMO hash de checkout.
function button({ label, href = '{{cta_link}}' }, P) {
```

- [ ] **Step 2: Verificar que o build passa**

Run: `npm run build`
Expected: build conclui sem erro.

- [ ] **Step 3: Verificar visualmente**

Abrir o editor de e-mail no app, criar um template novo com botão e sem preencher link; conferir no HTML gerado que o `href` é `{{cta_link}}` e não `#`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/emailTemplate.js
git commit -m "feat(template): botao sem link explicito nasce com {{cta_link}}"
```

---

## Task 10: Migração dos 21 passos ativos (conteúdo do cliente)

**Files:** nenhum arquivo de código — é conteúdo em `public.emails`.

**Interfaces:** nenhuma.

**Esta task NÃO é automatizável e NÃO deve ser feita por um agente sozinho.** São 21 passos de campanhas Ativas de um cliente real. Trocar o `href` de todos por `{{cta_link}}` em massa mudaria o destino de e-mails de marketing sem revisão — inclusive dos 11 que apontam para `applotto.live/30off/`, que pode ser uma landing legítima e não um checkout.

- [ ] **Step 1: Levantar o estado exato**

Run (via `mcp__kobly-supabase__execute_sql`):
```sql
select e.id, c.nome as campanha, fs.posicao, e.assunto,
       substring(e.corpo_html from 'href="([^"]{1,90})"') as destino_atual
from public.campaign_flows cf
join public.campaigns c on c.id = cf.campaign_id
join public.flow_steps fs on fs.flow_id = cf.id and fs.tipo_card = 'Envio de e-mail'
join public.emails e on e.id = fs.email_id
where c.status_campanha = 'Ativa'
order by c.nome, fs.posicao;
```

- [ ] **Step 2: Decidir passo a passo COM o cliente**

Para cada linha, decidir: o CTA deve retomar a transação (→ `{{cta_link}}`) ou levar a uma página fixa (→ manter). Registrar a decisão. Os 7 que apontam para `checkout.payt.com.br/2ef8206a…` são prioridade — hoje mandam todo comprador para o carrinho de outra pessoa.

- [ ] **Step 3: Aplicar as trocas aprovadas**

Uma migration por lote aprovado, nunca ad-hoc em produção. Exemplo para um id específico:
```sql
update public.emails
   set corpo_html = replace(corpo_html, 'href="https://checkout.payt.com.br/2ef8206a06371a094ec06428718d95b8"', 'href="{{cta_link}}"')
 where id = '<id-aprovado>';
```

- [ ] **Step 4: Verificar**

Run:
```sql
select count(*) filter (where e.corpo_html like '%{{cta_link}}%') as com_cta,
       count(*) as total
from public.campaign_flows cf
join public.campaigns c on c.id = cf.campaign_id
join public.flow_steps fs on fs.flow_id = cf.id and fs.tipo_card='Envio de e-mail'
join public.emails e on e.id = fs.email_id
where c.status_campanha = 'Ativa';
```
Expected: `com_cta` igual ao número de passos aprovados no Step 2.

---

## Task 11: Extração determinística do campo novo — BLOQUEADA

**Files:**
- Modify: `supabase/functions/postback-receiver/index.ts` (`extractRecoveryLink`, antes do varredor genérico)

**Interfaces:**
- Consumes: Task 8 (validação).

**⚠️ BLOQUEADA por dependência externa.** Não começar antes de os dois pré-requisitos estarem satisfeitos:

1. A plataforma confirmar que passou a incluir a URL de checkout no payload ENTITY.
2. **Um evento real com o campo estar capturado no banco.** Escrever a extração contra um nome de campo suposto é exatamente o erro que criou este problema.

- [ ] **Step 1: Capturar o payload real**

Run (via `mcp__kobly-supabase__execute_sql`):
```sql
select payload from public.webhook_events
where payload ? 'kind' order by created_at desc limit 1;
```
Localizar no JSON o caminho exato da URL (ex.: `data.checkout.url`).

- [ ] **Step 2: Ler o caminho explícito antes do varredor**

Em `extractRecoveryLink`, logo depois da declaração de `best` e ANTES de `walk(payload)`, colar o bloco abaixo. **Substituir apenas `CAMINHO_CONFIRMADO`** pelo caminho real observado no Step 1 — o resto é literal:

```ts
  // Extração DETERMINÍSTICA do envelope ENTITY. Vem antes do varredor genérico
  // porque o varredor pontua por nome de chave e pode eleger a URL errada quando
  // o payload tiver mais de uma. Caminho confirmado num payload real em <DATA>;
  // se a plataforma mudar o campo, o log do Step 3 mostra a queda para o varredor.
  const direto = (payload as any)?.data?.CAMINHO_CONFIRMADO;   // ← trocar pelo caminho real
  if (typeof direto === "string" && /^https?:\/\//i.test(direto.trim())) {
    try {
      if (new URL(direto.trim()).hostname) {
        console.log("postback-receiver: link resolvido por deterministico");
        return direto.trim();
      }
    } catch { /* cai no varredor abaixo */ }
  }
```

- [ ] **Step 3: Registrar quando o varredor for quem resolveu**

No `return` final de `extractRecoveryLink` (o que a Task 8 já transformou em bloco `try`), acrescentar o log antes de devolver:

```ts
  if (!best) return null;
  try {
    if (!new URL(best.url).hostname) return null;
    console.log("postback-receiver: link resolvido por varredor");
    return best.url;
  } catch {
    return null;
  }
```

Assim, se o determinístico parar de acertar porque o payload mudou de novo, os logs passam a mostrar `varredor` (ou nenhum link) antes de virar centenas de e-mails quebrados.

- [ ] **Step 4: Confirmar a premissa do "sem retry" no formato novo**

Run:
```sql
with e as (
  select lead_id,
         min(created_at) as primeiro,
         min(created_at) filter (where checkout_url is not null) as primeiro_com_link
  from public.webhook_events
  where lead_id is not null and payload ? 'kind'
  group by lead_id
)
select count(*) filter (where primeiro_com_link is not null) as com_link,
       count(*) filter (where primeiro_com_link > primeiro) as link_veio_depois
from e;
```
Expected: `link_veio_depois = 0`. Se for maior que zero, o "finaliza sem retry" das Tasks 5/6/7 está errado e precisa virar um adiamento curto antes de finalizar.

- [ ] **Step 5: Deploy + commit**

```bash
supabase functions deploy postback-receiver --project-ref hvkuymprmfrjrgpqaxbw
git add supabase/functions/postback-receiver/index.ts
git commit -m "feat(postback): extracao deterministica do link no envelope ENTITY"
```

---

## Task 12: Ligar o gate

**Files:** nenhum — é operação.

**Interfaces:**
- Consumes: Tasks 2, 5, 6, 7, 11.

**Pré-requisitos, todos obrigatórios:**
- Task 11 em produção e confirmada com evento real.
- Task 10 concluída (senão o gate não protege nada — nenhum passo ativo usa o placeholder).
- **Cliente avisado** do efeito no painel (ver abaixo).

- [ ] **Step 1: Avisar o cliente do efeito na atribuição**

Passo pulado não gera `email_events` com `status='enviado'`, e a atribuição de venda recuperada depende disso (`postback-receiver:565-571` só credita a campanha quando existe um envio anterior à "Compra Aprovada"). Com o gate ligado, o painel mostra **receita recuperada caindo enquanto as vendas continuam acontecendo**. Sem esse aviso, vira chamado de "a plataforma parou".

- [ ] **Step 2: Ligar**

Run (via `mcp__kobly-supabase__execute_sql`):
```sql
select vault.update_secret((select id from vault.secrets where name='cta_gate_enabled'), 'true');
```

- [ ] **Step 3: Observar o primeiro tick**

Run, ~2 minutos depois:
```sql
select last_error, count(*) from public.scheduled_steps
where updated_at > now() - interval '5 minutes' group by 1 order by 2 desc;
```
Expected: aparecem linhas `pulado: sem link de recuperação` **apenas** para passos de evento transacional sem link. Se aparecer volume inesperado, desligar imediatamente (`update_secret(..., 'false')`) — sem deploy.

- [ ] **Step 4: Confirmar que passo pulado não consumiu cota**

Comparar o contador de uso da org antes e depois do tick; o número de pulados não deve aparecer como consumo.

- [ ] **Step 5: Query agregada de acompanhamento**

```sql
select date_trunc('day', updated_at) as dia, count(*) as pulados_sem_link
from public.scheduled_steps
where last_error = 'pulado: sem link de recuperação'
group by 1 order by 1 desc;
```
É o número que teria mostrado o problema em 20/07, quando saltaria de 0 para ~90% num dia.

---

## Verificação final (end-to-end)

- [ ] `deno test --allow-read supabase/functions/_shared/cta_test.ts` → 13 passed.
      **O `--allow-read` é obrigatório**: o 13º teste (anti-drift) lê
      `process-steps/index.ts` para conferir que a cópia inline não divergiu de
      `_shared/cta.ts`. Sem a flag o Deno nega a leitura e o teste falha — falha
      barulhenta de propósito, para ninguém concluir que a suíte está verde quando
      a checagem de drift nem rodou.
- [ ] Um postback de teste com link → `webhook_events.checkout_url` preenchido → passo agendado → e-mail recebido com o botão apontando para o checkout **daquela** transação (conferir a URL no "Mostrar original").
- [ ] Um postback de teste sem link, evento "Pix Gerado" → passo aparece na jornada como **pulado** (não como falha vermelha), com o texto `pulado: sem link de recuperação`.
- [ ] Um passo de evento terminal ("Compra Aprovada") sem link → **envia** normalmente.
- [ ] Desligar a flag (`'false'`) e confirmar que os pulos param no tick seguinte, sem deploy.
- [ ] **Fechar a premissa não-verificada do spec:** abrir uma URL `checkout.payt.com.br/qr-pix/<code>` de uma transação de TESTE (nunca de um comprador real) e confirmar que a página mostra QR **e** copia-e-cola sem exigir login. É a única justificativa para não embutir o código PIX no corpo do e-mail; se a página não mostrar, o não-objetivo cai e o spec precisa ser revisto. Lembrar que isso vale só para "Pix Gerado" — os links de "Abandono de carrinho" apontam para `checkout.payt.com.br/<hash>?cart=<code>`, checkout comum, sem QR.
