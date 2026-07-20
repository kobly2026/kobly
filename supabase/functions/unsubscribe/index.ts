// supabase/functions/unsubscribe/index.ts
// Descadastro público (verify_jwt=false).
// GET  → NÃO grava nada. Renderiza uma página com formulário (POST de confirmação).
//        Link scanners corporativos (Microsoft Defender Safe Links, Proofpoint URL
//        Defense) e prefetchers de e-mail buscam TODA URL do corpo da mensagem via
//        GET. Se o GET escrevesse a supressão, esses scanners descadastrariam
//        silenciosamente destinatários que nunca clicaram — por isso GET é só leitura.
// POST → grava email_suppressions (idempotente). Dois caminhos:
//   - confirm=1 (querystring ou body urlencoded) = nosso próprio formulário → source='link'
//   - sem confirm = one-click RFC 8058 do cliente de e-mail → source='header'
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

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const page = (msg: string, status = 200) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<title>Descadastro</title><div style="font-family:system-ui,sans-serif;max-width:420px;margin:12vh auto;text-align:center;color:#111">`
    + `<h2 style="font-size:18px">${msg}</h2></div>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );

// Página exibida no GET (token válido): NÃO grava nada — só oferece um formulário
// que o humano precisa efetivamente submeter (POST) para confirmar. É essa etapa
// extra que impede link scanners/prefetchers (que só fazem GET) de descadastrar
// gente que nunca abriu o e-mail.
const confirmPage = (token: string) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<title>Descadastro</title><div style="font-family:system-ui,sans-serif;max-width:420px;margin:12vh auto;text-align:center;color:#111">`
    + `<h2 style="font-size:18px">Confirmar descadastro</h2>`
    + `<p style="color:#555;font-size:14px;margin:8px 0 20px">Clique no botão abaixo para não receber mais estes e-mails.</p>`
    + `<form method="POST" action="">`
    + `<input type="hidden" name="token" value="${escapeHtml(token)}">`
    + `<input type="hidden" name="confirm" value="1">`
    + `<button type="submit" style="font:inherit;padding:10px 20px;border:0;border-radius:6px;background:#111;color:#fff;cursor:pointer">Confirmar descadastro</button>`
    + `</form></div>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok");
  if (req.method !== "GET" && req.method !== "POST") return page("Método não permitido", 405);

  const url = new URL(req.url);
  let token = url.searchParams.get("token") || "";
  // `confirm=1` identifica nosso próprio formulário de confirmação (renderizado no
  // GET, ver confirmPage). Ausente = one-click RFC 8058 disparado pelo cliente de
  // e-mail direto na URL do header List-Unsubscribe. Lido da query OU do body.
  let confirm = url.searchParams.get("confirm") === "1";

  if (req.method === "POST") {
    const raw = await req.text().catch(() => "");
    if (raw) {
      // Aceita tanto JSON (chamadas programáticas) quanto urlencoded (nosso <form>
      // do confirmPage, e o que alguns clientes de e-mail usam no one-click).
      let parsedJson: any = null;
      try { parsedJson = JSON.parse(raw); } catch { /* não é JSON — tenta urlencoded abaixo */ }
      if (parsedJson && typeof parsedJson === "object") {
        if (!token && parsedJson.token) token = String(parsedJson.token);
        if (String(parsedJson.confirm) === "1") confirm = true;
      } else {
        const params = new URLSearchParams(raw);
        if (!token && params.get("token")) token = params.get("token")!;
        if (params.get("confirm") === "1") confirm = true;
      }
    }
    // Corpo pode vir vazio no one-click RFC 8058 (cliente só POSTa na URL do header,
    // sem body) — nesse caso o token já veio da query string acima.
  }

  // Rejeita tokens com formato inválido localmente, antes de consultar o Vault
  // (evita round-trip de decrypt no Postgres para requests obviamente malformadas).
  const tokenParts = token.split(".");
  if (!token || tokenParts.length !== 2) return page("Link de descadastro inválido.", 400);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: secret } = await sb.rpc("get_secret", { p_name: "unsubscribe_secret" });
  if (!secret) return page("Descadastro indisponível no momento.", 500);

  const res = await verifyUnsubToken(String(secret), token);
  if (!res) return page("Link de descadastro inválido.", 400);

  // GET: token válido, mas NÃO escreve — só mostra o formulário de confirmação.
  if (req.method === "GET") return confirmPage(token);

  const { error: upsertError } = await sb.from("email_suppressions").upsert(
    // source='link': confirmado pelo nosso formulário (humano clicou "Confirmar").
    // source='header': one-click RFC 8058 (cliente de e-mail POSTou sem confirm).
    { email: res.email.toLowerCase(), organization_id: res.orgId, reason: "unsubscribe", source: confirm ? "link" : "header" },
    { onConflict: "email,organization_id", ignoreDuplicates: true },
  );

  if (upsertError) {
    console.error("unsubscribe: falha ao gravar email_suppressions", upsertError);
    return new Response(null, { status: 500 });
  }

  // Confirmação via nosso formulário: mostra página de sucesso pro humano.
  // One-click RFC 8058: bare 200 (é o cliente de e-mail que POSTa, não um browser).
  if (confirm) return page("Pronto! Você não receberá mais estes e-mails.");
  return new Response(null, { status: 200 });
});
