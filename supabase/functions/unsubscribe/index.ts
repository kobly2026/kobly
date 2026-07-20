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
