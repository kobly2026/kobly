# Email Deliverability (Frentes 2 e 3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tirar os e-mails do domínio compartilhado `koblay.io` do Spam para a caixa, via conformidade de remetente em massa (List-Unsubscribe one-click, descadastro funcional, Reply-To, supressão) e telemetria de entrega (webhook delivered/bounced/complained + auto-supressão).

**Architecture:** Nova tabela `email_suppressions`; endpoint público `unsubscribe` (token HMAC stateless); os três senders (`process-bulk`, `process-steps`, `send-email`) passam a injetar headers `List-Unsubscribe`/`List-Unsubscribe-Post`, `Reply-To`, o link `{{unsubscribe_url}}` no corpo, e pular endereços suprimidos; o `resend-webhook` passa a gravar entrega/bounce/reclamação e a auto-suprimir bounces/reclamações.

**Tech Stack:** Supabase (Postgres 15 + Vault + Edge Functions em Deno), Resend HTTP API, React/Vite (frontend do template e da aba de Integrações).

## Global Constraints

- Domínio de envio = `koblay.io` (já verificado no Resend, sa-east-1). NÃO publicar DNS novo nesta fase.
- Edge functions são Deno (`Deno.serve`, `createClient` de `https://esm.sh/@supabase/supabase-js@2`), segredos via RPC `get_secret({ p_name })` com service_role.
- `verify_jwt` é declarado em `supabase/config.toml` por função. Webhooks/endpoints públicos = `verify_jwt = false`.
- Migrations: arquivos `supabase/migrations/00NN_nome.sql`, numeração sequencial (próximo = `0048`), com cabeçalho em comentário. Aplicar em produção via `mcp__kobly-supabase__apply_migration` e regenerar `src/api/database.types.ts` via `mcp__kobly-supabase__generate_typescript_types`.
- Deploy de function via `mcp__kobly-supabase__deploy_edge_function`.
- Não há test runner JS. Lógica pura de token → `deno test`. Integração → `curl`/invoke + SQL de asserção.
- Emails são sempre comparados/armazenados em **lowercase** na supressão.
- Mailto de fallback do List-Unsubscribe: `mailto:unsubscribe@koblay.io`.

---

## Preâmbulo: branch de trabalho

- [ ] **Criar branch** (estamos na `main`):

```bash
cd /Users/giuseppedangelis/Dev/kobly
git checkout -b feat/email-deliverability
```

---

## Task 1: Migration `email_suppressions`

**Files:**
- Create: `supabase/migrations/0048_email_suppressions.sql`
- Modify (regen): `src/api/database.types.ts`

**Interfaces:**
- Produces: tabela `public.email_suppressions(id uuid, email text, organization_id uuid null, reason text, source text, created_at timestamptz)` com índice único `(email, organization_id) NULLS NOT DISTINCT`.

- [ ] **Step 1: Escrever a migration**

```sql
-- 0048_email_suppressions.sql
-- Lista de supressão de e-mail (conformidade + proteção da reputação do domínio
-- compartilhado). Um endereço suprimido não recebe mais envios da org (ou global,
-- para hard bounce). Preenchida por: endpoint unsubscribe (reason='unsubscribe'),
-- webhook Resend (reason='bounce' global / 'complaint' por org).
-- ---------------------------------------------------------------------------
create table if not exists public.email_suppressions (
  id              uuid primary key default gen_random_uuid(),
  email           text not null,
  organization_id uuid references public.organizations(id) on delete cascade,
  reason          text not null check (reason in ('unsubscribe','bounce','complaint')),
  source          text not null default 'link' check (source in ('link','header','webhook')),
  created_at      timestamptz not null default now()
);

-- NULLS NOT DISTINCT (PG15): trata organization_id NULL (global) como valor único,
-- então hard bounces globais também deduplicam. Requer Postgres 15+.
create unique index if not exists email_suppressions_uq
  on public.email_suppressions (email, organization_id) nulls not distinct;

create index if not exists email_suppressions_email_idx
  on public.email_suppressions (email);

alter table public.email_suppressions enable row level security;

-- Escrita só service_role (edge functions). Leitura pela org dona (para futura UI).
drop policy if exists email_suppressions_read on public.email_suppressions;
create policy email_suppressions_read on public.email_suppressions
  for select using (
    organization_id is not null
    and public.has_org_access(organization_id)
  );
```

> Nota: `has_org_access(uuid)` já é usada em outras policies do projeto (ver `resend-admin`/migrations 0043+). Se o nome exato divergir, use a helper de acesso à org existente no schema (confirme com `\df has_org_access` equivalente: `select proname from pg_proc where proname ilike '%org_access%';`).

- [ ] **Step 2: Confirmar a helper de RLS existe**

Run (via `mcp__kobly-supabase__execute_sql`):
```sql
select proname, pg_get_function_arguments(oid) from pg_proc where proname ilike '%org_access%';
```
Expected: retorna `has_org_access(...)` (ou equivalente). Ajuste o nome na policy se necessário antes de aplicar.

- [ ] **Step 3: Aplicar a migration**

Aplicar via `mcp__kobly-supabase__apply_migration` (name: `0048_email_suppressions`, query: o SQL do Step 1).

- [ ] **Step 4: Verificar tabela + índice**

Run (via `mcp__kobly-supabase__execute_sql`):
```sql
select count(*) as tabela from information_schema.tables where table_name='email_suppressions';
select indexname from pg_indexes where tablename='email_suppressions';
```
Expected: `tabela=1`; índices incluem `email_suppressions_uq` e `email_suppressions_email_idx`.

- [ ] **Step 5: Regenerar types + commit**

Regenerar `src/api/database.types.ts` via `mcp__kobly-supabase__generate_typescript_types` e salvar o output no arquivo.
```bash
git add supabase/migrations/0048_email_suppressions.sql src/api/database.types.ts
git commit -m "feat(db): tabela email_suppressions + RLS"
```

---

## Task 2: Migration `organizations.reply_to_email`

**Files:**
- Create: `supabase/migrations/0049_org_reply_to.sql`
- Modify (regen): `src/api/database.types.ts`

**Interfaces:**
- Produces: coluna `organizations.reply_to_email text null`.

- [ ] **Step 1: Escrever a migration**

```sql
-- 0049_org_reply_to.sql
-- Endereço de Reply-To por organização (opcional). Quando setado, os envios de
-- e-mail incluem reply_to = este endereço, para que respostas cheguem ao cliente
-- em vez do domínio da plataforma. Vazio → sem Reply-To.
-- ---------------------------------------------------------------------------
alter table public.organizations
  add column if not exists reply_to_email text;
```

- [ ] **Step 2: Aplicar** via `mcp__kobly-supabase__apply_migration` (name: `0049_org_reply_to`, query: SQL acima).

- [ ] **Step 3: Verificar**

Run (via `mcp__kobly-supabase__execute_sql`):
```sql
select column_name from information_schema.columns
where table_name='organizations' and column_name='reply_to_email';
```
Expected: uma linha `reply_to_email`.

- [ ] **Step 4: Regenerar types + commit**

Regenerar `src/api/database.types.ts` e salvar.
```bash
git add supabase/migrations/0049_org_reply_to.sql src/api/database.types.ts
git commit -m "feat(db): organizations.reply_to_email"
```

---

## Task 3: Helper de token de descadastro (lógica pura + `deno test`)

**Files:**
- Create: `supabase/functions/_shared/unsub.ts`
- Test: `supabase/functions/_shared/unsub_test.ts`

**Interfaces:**
- Produces:
  - `signUnsubToken(secret: string, orgId: string, email: string, nowMs: number): Promise<string>`
  - `verifyUnsubToken(secret: string, token: string): Promise<{ orgId: string; email: string } | null>`
- Consumes: nada.

> O mesmo código é **inlinado** nas functions que precisam (Tasks 4–7), porque o deploy por-função não empacota `../_shared`. Este arquivo é a fonte-da-verdade e o alvo do teste. Ao editar as cópias, mantê-las idênticas a este arquivo.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// supabase/functions/_shared/unsub_test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { signUnsubToken, verifyUnsubToken } from "./unsub.ts";

const SECRET = "s3cr3t-de-teste";

Deno.test("round-trip: assina e verifica", async () => {
  const t = await signUnsubToken(SECRET, "org-1", "Fulano@Gmail.com", 1700000000000);
  const r = await verifyUnsubToken(SECRET, t);
  assertEquals(r, { orgId: "org-1", email: "fulano@gmail.com" });
});

Deno.test("rejeita token adulterado", async () => {
  const t = await signUnsubToken(SECRET, "org-1", "a@b.com", 1700000000000);
  const bad = t.slice(0, -2) + (t.endsWith("aa") ? "bb" : "aa");
  assertEquals(await verifyUnsubToken(SECRET, bad), null);
});

Deno.test("rejeita secret errado", async () => {
  const t = await signUnsubToken(SECRET, "org-1", "a@b.com", 1700000000000);
  assertEquals(await verifyUnsubToken("outro-secret", t), null);
});

Deno.test("rejeita formato inválido", async () => {
  assertEquals(await verifyUnsubToken(SECRET, "lixo"), null);
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd supabase/functions/_shared && deno test unsub_test.ts --allow-none`
Expected: FAIL — `Module not found "./unsub.ts"`.

- [ ] **Step 3: Implementar o helper**

```ts
// supabase/functions/_shared/unsub.ts
// Token de descadastro stateless: token = base64url(payload) + "." + base64url(hmac(payload))
// payload = `${orgId}:${email(lower)}:${nowMs}`. Sem expiração (unsubscribe vale sempre).
function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
async function hmac(secret: string, msg: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg)));
}
export async function signUnsubToken(secret: string, orgId: string, email: string, nowMs: number): Promise<string> {
  const payload = `${orgId}:${String(email).toLowerCase()}:${nowMs}`;
  return `${b64url(new TextEncoder().encode(payload))}.${b64url(await hmac(secret, payload))}`;
}
export async function verifyUnsubToken(secret: string, token: string): Promise<{ orgId: string; email: string } | null> {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return null;
  let payload: string;
  try { payload = new TextDecoder().decode(b64urlToBytes(parts[0])); } catch { return null; }
  const expected = b64url(await hmac(secret, payload));
  if (expected.length !== parts[1].length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ parts[1].charCodeAt(i);
  if (diff !== 0) return null;
  const seg = payload.split(":");
  if (seg.length < 3 || !seg[0] || !seg[1]) return null;
  return { orgId: seg[0], email: seg[1] };
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd supabase/functions/_shared && deno test unsub_test.ts --allow-none`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/unsub.ts supabase/functions/_shared/unsub_test.ts
git commit -m "feat(edge): helper de token de descadastro (HMAC) + testes"
```

---

## Task 4: Edge function `unsubscribe` + secret do Vault

**Files:**
- Create: `supabase/functions/unsubscribe/index.ts`
- Modify: `supabase/config.toml` (adicionar bloco da função)

**Interfaces:**
- Consumes: `email_suppressions` (Task 1), `verifyUnsubToken` (Task 3, inlinado), secret `unsubscribe_secret`.
- Produces: rota pública `GET|POST /functions/v1/unsubscribe?token=…`.

- [ ] **Step 1: Criar o secret `unsubscribe_secret` no Vault**

Operacional (dashboard Supabase → Project Settings → Vault, ou CLI). Valor = 32 bytes aleatórios, ex.:
```bash
openssl rand -base64 32
```
Guardar como secret `unsubscribe_secret`. (Se a RPC `set_secret` estiver liberada: `select vault.create_secret('<valor>', 'unsubscribe_secret');` — senão, usar o dashboard.)

- [ ] **Step 2: Declarar verify_jwt=false**

Em `supabase/config.toml`, na seção de funções PÚBLICAS (junto de `resend-webhook`), adicionar:
```toml
[functions.unsubscribe]
verify_jwt = false
```

- [ ] **Step 3: Escrever a função**

```ts
// supabase/functions/unsubscribe/index.ts
// Descadastro público (verify_jwt=false). GET → página de confirmação; POST → RFC 8058
// one-click (List-Unsubscribe-Post). Grava email_suppressions (idempotente).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- inline de _shared/unsub.ts (manter idêntico) ---
function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  return Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad), (c) => c.charCodeAt(0));
}
function b64url(bytes: Uint8Array): string {
  let s = ""; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function hmac(secret: string, msg: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg)));
}
async function verifyUnsubToken(secret: string, token: string): Promise<{ orgId: string; email: string } | null> {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return null;
  let payload: string;
  try { payload = new TextDecoder().decode(b64urlToBytes(parts[0])); } catch { return null; }
  const expected = b64url(await hmac(secret, payload));
  if (expected.length !== parts[1].length) return null;
  let diff = 0; for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ parts[1].charCodeAt(i);
  if (diff !== 0) return null;
  const seg = payload.split(":");
  if (seg.length < 3 || !seg[0] || !seg[1]) return null;
  return { orgId: seg[0], email: seg[1] };
}
// --- fim inline ---

const page = (msg: string, status = 200) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<title>Descadastro</title><div style="font-family:system-ui,sans-serif;max-width:420px;margin:12vh auto;text-align:center;color:#111">`
    + `<h2 style="font-size:18px">${msg}</h2></div>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok");
  if (req.method !== "GET" && req.method !== "POST") return page("Método não permitido", 405);

  const url = new URL(req.url);
  let token = url.searchParams.get("token") || "";
  if (!token && req.method === "POST") {
    try { const b = await req.json(); token = b?.token || ""; } catch { /* body pode ser vazio no one-click */ }
  }

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: secret } = await sb.rpc("get_secret", { p_name: "unsubscribe_secret" });
  if (!secret) return page("Descadastro indisponível no momento.", 500);

  const res = await verifyUnsubToken(String(secret), token);
  if (!res) return page("Link de descadastro inválido ou expirado.", 400);

  await sb.from("email_suppressions").upsert(
    { email: res.email.toLowerCase(), organization_id: res.orgId, reason: "unsubscribe", source: req.method === "POST" ? "header" : "link" },
    { onConflict: "email,organization_id", ignoreDuplicates: true },
  );

  if (req.method === "POST") return new Response(null, { status: 200 });
  return page("Pronto! Você não receberá mais estes e-mails.");
});
```

- [ ] **Step 4: Deploy**

Deploy via `mcp__kobly-supabase__deploy_edge_function` (name: `unsubscribe`, arquivos: `index.ts`).

- [ ] **Step 5: Verificação funcional (token inválido → 400)**

Obter a URL base via `mcp__kobly-supabase__get_project_url`. Então:
```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://<PROJECT>.supabase.co/functions/v1/unsubscribe?token=lixo"
```
Expected: `400`.

- [ ] **Step 6: Verificação funcional (token válido → grava supressão)**

Gerar um token válido localmente com o helper (usando o mesmo valor do secret `unsubscribe_secret`):
```bash
cd supabase/functions/_shared
deno eval 'import { signUnsubToken } from "./unsub.ts"; console.log(await signUnsubToken("<VALOR_DO_SECRET>", "<ORG_ID_REAL>", "qa-unsub@example.com", 1700000000000));'
```
`curl` o GET com esse token e depois checar o banco:
```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://<PROJECT>.supabase.co/functions/v1/unsubscribe?token=<TOKEN>"
```
Expected: `200`. Depois, via `mcp__kobly-supabase__execute_sql`:
```sql
select email, reason, source from public.email_suppressions where email='qa-unsub@example.com';
```
Expected: uma linha `qa-unsub@example.com | unsubscribe | link`. (Limpar depois: `delete from public.email_suppressions where email='qa-unsub@example.com';`)

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/unsubscribe/index.ts supabase/config.toml
git commit -m "feat(edge): endpoint unsubscribe (token HMAC, one-click)"
```

---

## Task 5: `process-bulk` — supressão + List-Unsubscribe + Reply-To + unsubscribe_url

**Files:**
- Modify: `supabase/functions/process-bulk/index.ts`

**Interfaces:**
- Consumes: `email_suppressions` (Task 1), `organizations.reply_to_email` (Task 2), `signUnsubToken` (Task 3, inlinado), secret `unsubscribe_secret`.

- [ ] **Step 1: Inlinar `signUnsubToken` + helpers b64url no topo do arquivo**

Logo após os imports, adicionar (idêntico a `_shared/unsub.ts`, só a parte de assinar):
```ts
function b64url(bytes: Uint8Array): string {
  let s = ""; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function _hmac(secret: string, msg: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg)));
}
async function signUnsubToken(secret: string, orgId: string, email: string, nowMs: number): Promise<string> {
  const payload = `${orgId}:${String(email).toLowerCase()}:${nowMs}`;
  return `${b64url(new TextEncoder().encode(payload))}.${b64url(await _hmac(secret, payload))}`;
}
```

- [ ] **Step 2: Carregar secret + Reply-To cache + set de supressão (após o fetch de `due`)**

Logo após o bloco que popula `due` (após a linha `if (error) return json(...)`, por volta da linha 103), adicionar:
```ts
const { data: unsubSecret } = await sb.rpc("get_secret", { p_name: "unsubscribe_secret" });
const baseUrl = Deno.env.get("SUPABASE_URL")!;

// Reply-To por org (cache por varredura)
const replyCache = new Map<string, string | null>();
const resolveReplyTo = async (org: string): Promise<string | null> => {
  if (replyCache.has(org)) return replyCache.get(org)!;
  const { data } = await sb.from("organizations").select("reply_to_email").eq("id", org).maybeSingle();
  const v = (data?.reply_to_email && String(data.reply_to_email).trim()) || null;
  replyCache.set(org, v); return v;
};

// Supressão: carrega uma vez os endereços de e-mail suprimidos entre os devidos
const dueEmails = [...new Set((due || [])
  .filter((r: any) => r.bulk_sends?.canal === "email" && r.destino)
  .map((r: any) => String(r.destino).toLowerCase()))];
const suppressed = new Set<string>();
if (dueEmails.length) {
  const { data: sup } = await sb.from("email_suppressions").select("email, organization_id").in("email", dueEmails);
  for (const row of sup || []) suppressed.add(`${String((row as any).email).toLowerCase()}::${(row as any).organization_id ?? "*"}`);
}
const isSuppressed = (email: string, org: string) =>
  suppressed.has(`${String(email).toLowerCase()}::${org}`) || suppressed.has(`${String(email).toLowerCase()}::*`);
```

- [ ] **Step 3: Pular suprimidos (dentro do loop, logo após o claim otimista)**

Após o bloco do claim (`if (!claimed || claimed.length === 0) continue;`, ~linha 135) e antes de `const attempts = …`, adicionar:
```ts
if (header.canal === "email" && destino && isSuppressed(destino, r.organization_id)) {
  await sb.from("bulk_send_recipients").update({ status: "pulado", last_error: "suprimido" }).eq("id", r.id);
  skipped++; continue;
}
```
(Observação: `destino` é declarado mais abaixo hoje; suba a declaração `const destino = r.destino;` para ANTES deste bloco, ou use `r.destino` diretamente aqui.)

- [ ] **Step 4: Injetar unsubscribe + Reply-To + headers no branch de e-mail**

Substituir o corpo do `if (canal === "email") { … }` (linhas ~148-160) por:
```ts
if (canal === "email") {
  if (!destino) { fatal = true; errDetail = "sem e-mail"; }
  else if (!resendKey) { errDetail = "resend_api_key ausente"; }
  else {
    let html = subst(tpl.corpo_html || "<p></p>", lead);
    const fromHeader = `${fromNameSafe(tpl.remetente || "Koblay")} <${await resolveSender(r.organization_id)}>`;
    const replyTo = await resolveReplyTo(r.organization_id);
    // List-Unsubscribe: URL com token quando há secret; sempre inclui o mailto.
    let unsubUrl: string | null = null;
    if (unsubSecret) {
      const token = await signUnsubToken(String(unsubSecret), r.organization_id, destino, Date.now());
      unsubUrl = `${baseUrl}/functions/v1/unsubscribe?token=${token}`;
      html = html.split("{{unsubscribe_url}}").join(unsubUrl)
                 .replace(/href="#"(\s[^>]*>\s*Descadastrar)/i, `href="${unsubUrl}"$1`);
    }
    const listUnsub = unsubUrl
      ? `<${unsubUrl}>, <mailto:unsubscribe@koblay.io>`
      : `<mailto:unsubscribe@koblay.io>`;
    const payload: Record<string, unknown> = {
      from: fromHeader, to: [destino], subject: tpl.assunto || "Koblay", html,
      headers: { "List-Unsubscribe": listUnsub, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    };
    if (replyTo) payload.reply_to = replyTo;
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const out = await resp.json().catch(() => ({}));
    ok = resp.ok; msgId = out?.id ?? null;
    if (!ok) { errDetail = JSON.stringify(out).slice(0, 200); if (resp.status >= 400 && resp.status < 500 && resp.status !== 429) fatal = true; }
  }
}
```

- [ ] **Step 5: Deploy**

Deploy via `mcp__kobly-supabase__deploy_edge_function` (name: `process-bulk`).

- [ ] **Step 6: Verificação funcional**

Inserir uma supressão de teste e disparar um bulk pequeno para 2 endereços (um suprimido, um não), OU verificar via um recipient real. Caminho mínimo sem UI: inserir supressão para um e-mail de teste, garantir que exista um recipient `pendente` com esse destino num bulk `enviando`, aguardar o próximo tick do cron (ou invocar a função), e conferir:
```sql
-- após o tick
select destino, status, last_error from public.bulk_send_recipients
where destino = '<EMAIL_SUPRIMIDO_DE_TESTE>' order by id desc limit 1;
```
Expected: `status='pulado'`, `last_error='suprimido'` (não chamou o Resend).
Para o endereço NÃO suprimido: enviar um teste real a um Gmail próprio e conferir em "Mostrar original" que o header `List-Unsubscribe` está presente com a URL do endpoint.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/process-bulk/index.ts
git commit -m "feat(process-bulk): supressão + List-Unsubscribe + Reply-To"
```

---

## Task 6: `process-steps` — mesmas injeções (fluxos/automação)

**Files:**
- Modify: `supabase/functions/process-steps/index.ts`

**Interfaces:**
- Consumes: idem Task 5.

- [ ] **Step 1: Inlinar `signUnsubToken` + helpers b64url** no topo (mesmo bloco do Task 5, Step 1).

- [ ] **Step 2: Carregar secret + Reply-To cache** uma vez, junto de onde `apiKey` é resolvido (perto do topo do handler, após criar `sb`):
```ts
const { data: unsubSecret } = await sb.rpc("get_secret", { p_name: "unsubscribe_secret" });
const baseUrl = Deno.env.get("SUPABASE_URL")!;
const replyCache = new Map<string, string | null>();
const resolveReplyTo = async (org: string): Promise<string | null> => {
  if (replyCache.has(org)) return replyCache.get(org)!;
  const { data } = await sb.from("organizations").select("reply_to_email").eq("id", org).maybeSingle();
  const v = (data?.reply_to_email && String(data.reply_to_email).trim()) || null;
  replyCache.set(org, v); return v;
};
async function isEmailSuppressed(email: string, org: string): Promise<boolean> {
  const e = String(email).toLowerCase();
  const { data } = await sb.from("email_suppressions").select("id, organization_id")
    .eq("email", e).or(`organization_id.eq.${org},organization_id.is.null`).limit(1);
  return !!(data && data.length);
}
```

- [ ] **Step 3: Pular suprimidos** antes de reservar cota (logo após resolver `em` e antes de `reserveOne`, ~linha 224):
```ts
if (await isEmailSuppressed(lead.email, s.organization_id)) {
  await finalize(s.id, curAttempts + 1, "pulado: destinatário descadastrado");
  skipped++; processed++;
  continue;
}
```

- [ ] **Step 4: Injetar unsubscribe + Reply-To + headers no envio** (substituir o bloco `if (apiKey) { … }` das linhas ~232-239):
```ts
let ok = false, msgId: string | null = null, errDetail: string | null = null;
if (apiKey) {
  let htmlBody = html;
  let unsubUrl: string | null = null;
  if (unsubSecret) {
    const token = await signUnsubToken(String(unsubSecret), s.organization_id, lead.email, Date.now());
    unsubUrl = `${baseUrl}/functions/v1/unsubscribe?token=${token}`;
    htmlBody = htmlBody.split("{{unsubscribe_url}}").join(unsubUrl)
                       .replace(/href="#"(\s[^>]*>\s*Descadastrar)/i, `href="${unsubUrl}"$1`);
  }
  const listUnsub = unsubUrl ? `<${unsubUrl}>, <mailto:unsubscribe@koblay.io>` : `<mailto:unsubscribe@koblay.io>`;
  const replyTo = await resolveReplyTo(s.organization_id);
  const payload: Record<string, unknown> = {
    from, to: [lead.email], subject: em.assunto || "Koblay", html: htmlBody,
    headers: { "List-Unsubscribe": listUnsub, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
  if (replyTo) payload.reply_to = replyTo;
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const out = await resp.json().catch(() => ({}));
  ok = resp.ok; msgId = out?.id ?? null; if (!ok) errDetail = JSON.stringify(out).slice(0, 200);
} else { errDetail = "resend_api_key ausente"; }
```

- [ ] **Step 5: Deploy** via `mcp__kobly-supabase__deploy_edge_function` (name: `process-steps`).

- [ ] **Step 6: Verificação funcional**

Disparar um passo de fluxo para um Gmail próprio e conferir em "Mostrar original" o header `List-Unsubscribe`. Inserir supressão para um endereço e confirmar que um step para ele finaliza como `pulado: destinatário descadastrado` (via `email_events`/estado do step).

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/process-steps/index.ts
git commit -m "feat(process-steps): supressão + List-Unsubscribe + Reply-To"
```

---

## Task 7: `send-email` (botão "enviar teste") — headers + Reply-To

**Files:**
- Modify: `supabase/functions/send-email/index.ts`

**Interfaces:**
- Consumes: `signUnsubToken` (inlinado), secret `unsubscribe_secret`, `organizations.reply_to_email`.

- [ ] **Step 1: Inlinar `signUnsubToken` + helpers b64url** no topo (mesmo bloco do Task 5, Step 1).

- [ ] **Step 2: Resolver org do chamador + token + headers**

Após obter `admin` e as secrets (após a linha do `resend_from`, ~linha 36), e antes do `fetch`, adicionar:
```ts
// org do chamador (para token de descadastro + Reply-To)
let callerOrg: string | null = null, replyTo: string | null = null;
try {
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u } = await admin.auth.getUser(jwt);
  if (u?.user) {
    const { data: prof } = await admin.from("profiles").select("organization_id").eq("auth_id", u.user.id).maybeSingle();
    callerOrg = prof?.organization_id ?? null;
    if (callerOrg) {
      const { data: org } = await admin.from("organizations").select("reply_to_email").eq("id", callerOrg).maybeSingle();
      replyTo = (org?.reply_to_email && String(org.reply_to_email).trim()) || null;
    }
  }
} catch { /* teste sem org resolvível → segue sem token/reply */ }

const primeiroTo = Array.isArray(to) ? to[0] : to;
const { data: unsubSecret } = await admin.rpc("get_secret", { p_name: "unsubscribe_secret" });
let unsubUrl: string | null = null;
let htmlOut = html;
if (unsubSecret && callerOrg && primeiroTo) {
  const token = await signUnsubToken(String(unsubSecret), callerOrg, String(primeiroTo), Date.now());
  unsubUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/unsubscribe?token=${token}`;
  if (htmlOut) htmlOut = String(htmlOut).split("{{unsubscribe_url}}").join(unsubUrl)
                 .replace(/href="#"(\s[^>]*>\s*Descadastrar)/i, `href="${unsubUrl}"$1`);
}
const listUnsub = unsubUrl ? `<${unsubUrl}>, <mailto:unsubscribe@koblay.io>` : `<mailto:unsubscribe@koblay.io>`;
```

- [ ] **Step 3: Incluir headers/reply_to/html no payload do fetch**

Substituir o `body: JSON.stringify({ from: sender, to: …, subject, html, text })` (linha ~46) por:
```ts
body: JSON.stringify({
  from: sender,
  to: Array.isArray(to) ? to : [to],
  subject, html: htmlOut, text,
  headers: { "List-Unsubscribe": listUnsub, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  ...(replyTo ? { reply_to: replyTo } : {}),
}),
```

- [ ] **Step 4: Deploy** via `mcp__kobly-supabase__deploy_edge_function` (name: `send-email`).

- [ ] **Step 5: Verificação funcional**

Pela UI (editor de e-mail → "enviar teste") ou via invoke autenticado, enviar para um Gmail próprio; conferir em "Mostrar original" o header `List-Unsubscribe` presente.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/send-email/index.ts
git commit -m "feat(send-email): List-Unsubscribe + Reply-To no envio de teste"
```

---

## Task 8: Template — `{{unsubscribe_url}}` no link + patch dos templates existentes

**Files:**
- Modify: `src/lib/emailTemplate.js:223`
- Create: `supabase/migrations/0050_patch_unsub_link.sql`

**Interfaces:**
- Produces: novos corpos de e-mail com `href="{{unsubscribe_url}}"`; corpos existentes migrados.

- [ ] **Step 1: Trocar o link no gerador de template**

Em `src/lib/emailTemplate.js`, linha 223, trocar:
```js
                  <a href="#" style="color:${P.muted};text-decoration:underline;">Descadastrar</a>
```
por:
```js
                  <a href="{{unsubscribe_url}}" style="color:${P.muted};text-decoration:underline;">Descadastrar</a>
```

- [ ] **Step 2: Migration de patch dos corpos existentes**

```sql
-- 0050_patch_unsub_link.sql
-- Converte o link de descadastro legado (href="#") dos corpos de e-mail já salvos
-- para o placeholder {{unsubscribe_url}}, que os workers substituem por destinatário.
-- Alvo restrito: apenas a âncora "Descadastrar" (não toca em CTAs que usem "#").
-- ---------------------------------------------------------------------------
update public.emails
set corpo_html = regexp_replace(corpo_html, 'href="#"(\s[^>]*>\s*Descadastrar)', 'href="{{unsubscribe_url}}"\1', 'gi')
where corpo_html like '%Descadastrar%' and corpo_html like '%href="#"%';
```

- [ ] **Step 3: Aplicar** via `mcp__kobly-supabase__apply_migration` (name: `0050_patch_unsub_link`, query: SQL acima).

- [ ] **Step 4: Verificar**

Run (via `mcp__kobly-supabase__execute_sql`):
```sql
select count(*) as ainda_legado from public.emails
where corpo_html like '%Descadastrar%' and corpo_html like '%href="#"%';
select count(*) as com_placeholder from public.emails where corpo_html like '%{{unsubscribe_url}}%';
```
Expected: `ainda_legado=0`; `com_placeholder >= 1`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/emailTemplate.js supabase/migrations/0050_patch_unsub_link.sql
git commit -m "feat(template): link de descadastro usa {{unsubscribe_url}} + patch dos existentes"
```

---

## Task 9: `resend-webhook` — delivered/bounced/complained + auto-supressão

**Files:**
- Modify: `supabase/functions/resend-webhook/index.ts`

**Interfaces:**
- Consumes: `email_suppressions` (Task 1), casamento por `sg_message_id` (já existe).
- Produces: eventos `delivered`/`bounce`/`complaint`/`deferred` em `email_events`; supressões automáticas.

- [ ] **Step 1: Ampliar o `MAP`**

Substituir a const `MAP` (linhas 28-31) por:
```ts
// Resend event type → mapeamento interno. `kind` decide o tratamento.
const MAP: Record<string, { event: string; status: string; kind: "engage" | "info" | "bounce" | "complaint"; col?: "aberturas" | "cliques" }> = {
  "email.opened":           { event: "open",      status: "aberto",    kind: "engage", col: "aberturas" },
  "email.clicked":          { event: "click",     status: "clicado",   kind: "engage", col: "cliques" },
  "email.delivered":        { event: "delivered", status: "entregue",  kind: "info" },
  "email.delivery_delayed": { event: "deferred",  status: "adiado",    kind: "info" },
  "email.bounced":          { event: "bounce",    status: "bounce",    kind: "bounce" },
  "email.complained":       { event: "complaint", status: "reclamado", kind: "complaint" },
};
```

- [ ] **Step 2: Tratar os novos tipos antes da lógica de engajamento**

Após resolver `org`/`campaignId`/`email` (após o bloco `if (!org) return json({ ok: true, ignored: true, reason: "unmatched" });`, ~linha 109), e ANTES do `// 1) Registra o evento de abertura/clique`, inserir:
```ts
// Registra o evento (todos os tipos mapeados)
await sb.from("email_events").insert({
  organization_id: org, campaign_id: campaignId, event: m.event, status: m.status,
  email, sg_message_id: messageId, "timestamp": new Date().toISOString(),
});

// Supressão automática: hard bounce → global; reclamação de spam → por org.
if (m.kind === "bounce" && email) {
  await sb.from("email_suppressions").upsert(
    { email: String(email).toLowerCase(), organization_id: null, reason: "bounce", source: "webhook" },
    { onConflict: "email,organization_id", ignoreDuplicates: true },
  );
}
if (m.kind === "complaint" && email) {
  await sb.from("email_suppressions").upsert(
    { email: String(email).toLowerCase(), organization_id: org, reason: "complaint", source: "webhook" },
    { onConflict: "email,organization_id", ignoreDuplicates: true },
  );
}

// Só engajamento (open/click) alimenta lead_metrics e stats de campanha.
if (m.kind !== "engage") return json({ ok: true, type: body.type, event: m.event });
```

- [ ] **Step 3: Remover o insert duplicado do evento no caminho de engajamento**

O bloco atual `// 1) Registra o evento de abertura/clique` faz `sb.from("email_events").insert({...})` com `url: data.click?.link`. Como o Step 2 já inseriu o evento base, **substituir** aquele insert por um que só acrescenta a `url` do clique quando existir — ou simplesmente manter APENAS o insert do Step 2 e mover o `url` para ele. Solução: no insert do Step 2, adicionar `url: (body.data?.click?.link ?? null)`. E **apagar** o bloco de insert original (linhas ~111-115) para não duplicar. Resultado: um único insert por evento, com `url` preenchida em cliques.

- [ ] **Step 4: Deploy** via `mcp__kobly-supabase__deploy_edge_function` (name: `resend-webhook`).

- [ ] **Step 5: Verificação funcional (bounce → supressão global)**

O Resend entrega para o endereço de teste `bounced@resend.dev` e emite `email.bounced`. Disparar um envio de teste (via `send-email` autenticado) para `bounced@resend.dev`; após alguns segundos:
```sql
select event, status from public.email_events where email='bounced@resend.dev' order by "timestamp" desc limit 5;
select email, reason, organization_id from public.email_suppressions where email='bounced@resend.dev';
```
Expected: um evento `bounce`/`bounce`; uma supressão `bounce` com `organization_id NULL`.
(Depende do webhook estar assinando `email.bounced` no painel — Task 10. Se ainda não, validar só o insert de evento manualmente reenviando um payload assinado.)

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/resend-webhook/index.ts
git commit -m "feat(resend-webhook): delivered/bounced/complained + auto-supressão"
```

---

## Task 10: Config do webhook no painel Resend (operacional)

**Files:** nenhum (runbook).

- [ ] **Step 1: Editar o webhook existente** em resend.com → Webhooks → o webhook `…/functions/v1/resend-webhook`.
- [ ] **Step 2: Assinar os eventos** (além de `email.opened`, `email.clicked`): `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`. Salvar.
- [ ] **Step 3: Confirmar o signing secret** continua igual ao secret `resend_webhook_secret` no Vault (já configurado). Se rotacionado, atualizar o Vault.
- [ ] **Step 4: Verificar** disparando um teste e observando eventos `delivered` chegando em `email_events` (repetir a query do Task 9 Step 5).

---

## Task 11: Config de domínio de envio (operacional)

**Files:** nenhum (runbook).

- [ ] **Step 1: Setar `resend_sending_domain = koblay.io`** no Vault (dashboard ou `select vault.create_secret('koblay.io','resend_sending_domain');` se a RPC estiver liberada). Isso ativa `<sender_local>@koblay.io` por org.
- [ ] **Step 2: Verificar** um novo disparo: no painel Resend → Emails, o `From` deve ser `…@koblay.io` (com o `sender_local` da org). Conferir `Delivered`.
- [ ] **Step 3 (opcional):** adicionar `rua=mailto:dmarc@koblay.io` ao registro `_dmarc.koblay.io` para receber relatórios agregados (mantém `p=none` por ora).

---

## Verificação final (end-to-end)

- [ ] Enviar um disparo de teste para um Gmail próprio → conferir em "Mostrar original": `SPF=PASS`, `DKIM=PASS`, `DMARC=PASS`, e header `List-Unsubscribe` + `List-Unsubscribe-Post` presentes.
- [ ] Rodar o e-mail no mail-tester.com → mirar ≥ 8/10; corrigir apontamentos de conteúdo se aparecerem.
- [ ] Clicar o link "Descadastrar" do rodapé → página de confirmação → `email_suppressions` ganha a linha → novo disparo ao mesmo endereço vira `pulado`/finaliza como descadastrado.
- [ ] Confirmar eventos `delivered` chegando em `email_events` após um envio real.
- [ ] Confirmar com o cliente se saiu do Spam (pode levar dias de warmup/engajamento).

## Self-review (cobertura do spec)

- Frente 2.1 (supressão) → Task 1. 2.2 (endpoint) → Tasks 3, 4. 2.3 (headers/reply-to/link) → Tasks 5, 6, 7, 8. 2.4 (reply_to_email) → Task 2 (coluna) + resolução nos senders. UI da coluna reply_to_email em Integrações: **follow-up menor** (adicionar um input na aba Domínio/Remetente que grava `organizations.reply_to_email`); não bloqueia deliverability e fica fora deste plano.
- Frente 3.1 (webhook eventos + supressão) → Task 9. 3.2 (config painel) → Task 10.
- Frente 1 (config koblay.io) → Task 11.
