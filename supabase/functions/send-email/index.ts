// Kobly — Edge Function `send-email`: proxy seguro para o Resend.
// Chave do Resend no Supabase Vault (RPC get_secret, service_role). NUNCA no browser.
// from: body.from completo → body.fromName + e-mail do secret → secret `resend_from` → fallback.
// verify_jwt = true: só usuários autenticados (a UI envia o JWT da sessão).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Inlinado de _shared/unsub.ts (parte de assinatura; per-function deploy não empacota ../_shared/).
// Manter semanticamente idêntico a signUnsubToken em _shared/unsub.ts.
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

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function extractEmail(s: string | null | undefined): string | null {
  if (!s) return null;
  const m = String(s).match(/<([^>]+)>/);
  return (m ? m[1] : String(s)).trim() || null;
}
function fromNameSafe(n: string | null | undefined): string {
  return String(n || "").replace(/["<>\\]/g, "").replace(/,/g, " ").trim() || "Koblay";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    // `from` completo do body é IGNORADO (anti-abuso na chave compartilhada).
    // Só aceita fromName (display) + endereço do secret resend_from.
    const { to, subject, html, text, fromName } = await req.json();
    if (!to || !subject || (!html && !text)) return json({ error: "missing_fields", detail: "to, subject e html/text são obrigatórios" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: apiKey } = await admin.rpc("get_secret", { p_name: "resend_api_key" });
    if (!apiKey) return json({ error: "secret_unavailable", detail: "Defina a secret 'resend_api_key' no Vault." }, 500);
    const { data: fromCfg } = await admin.rpc("get_secret", { p_name: "resend_from" });
    const addr = extractEmail(fromCfg) || "onboarding@resend.dev";
    let sender: string;
    if (fromName) sender = `${fromNameSafe(fromName)} <${addr}>`;
    else if (fromCfg && fromCfg.includes("<")) sender = fromCfg;
    else sender = `Koblay <${addr}>`;

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
    // List-Unsubscribe-Post (RFC 8058 one-click) só faz sentido junto de uma URL https
    // clicável; anunciá-lo ao lado de um List-Unsubscribe só-mailto é combinação sem
    // sentido pra RFC 8058 — omitido quando não há unsubUrl.
    const unsubHeaders: Record<string, string> = unsubUrl
      ? { "List-Unsubscribe": listUnsub, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
      : { "List-Unsubscribe": listUnsub };

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: sender,
        to: Array.isArray(to) ? to : [to],
        subject, html: htmlOut, text,
        headers: unsubHeaders,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    const out = await resp.json().catch(() => ({}));
    if (!resp.ok) return json({ error: "resend_error", status: resp.status, detail: out }, 502);
    return json({ ok: true, id: out.id, from: sender });
  } catch (e) {
    return json({ error: "bad_request", detail: String(e).slice(0, 300) }, 400);
  }
});
