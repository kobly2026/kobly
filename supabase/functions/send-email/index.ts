// Kobly — Edge Function `send-email`: proxy seguro para o Resend.
// Chave do Resend no Supabase Vault (RPC get_secret, service_role). NUNCA no browser.
// from: body.from completo → body.fromName + e-mail do secret → secret `resend_from` → fallback.
// verify_jwt = true: só usuários autenticados (a UI envia o JWT da sessão).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: sender, to: Array.isArray(to) ? to : [to], subject, html, text }),
    });
    const out = await resp.json().catch(() => ({}));
    if (!resp.ok) return json({ error: "resend_error", status: resp.status, detail: out }, 502);
    return json({ ok: true, id: out.id, from: sender });
  } catch (e) {
    return json({ error: "bad_request", detail: String(e).slice(0, 300) }, 400);
  }
});
