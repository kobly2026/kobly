// Kobly — Edge Function `send-whatsapp`: proxy seguro para a Z-API (WhatsApp).
// Credenciais no Vault (service_role). Suporta:
//  - action=status → estado da conexão
//  - texto puro → POST /send-text
//  - com buttonActions → POST /send-button-actions (CTA URL / CALL / REPLY)
// verify_jwt = true.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function normalizePhone(raw: string): string {
  const digits = String(raw).replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 11 ? `55${digits}` : digits;
}

// Normaliza botões para o contrato Z-API send-button-actions.
// type: URL | CALL | REPLY. URL deve começar com http(s).
function normalizeButtons(raw: unknown, ctaFallback?: string): Array<Record<string, string>> {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const out: Array<Record<string, string>> = [];
  for (let i = 0; i < Math.min(raw.length, 3); i++) {
    const b = raw[i] as any;
    if (!b || !b.label) continue;
    const type = String(b.type || "URL").toUpperCase();
    const id = String(b.id || String(i + 1));
    const label = String(b.label).slice(0, 20);
    if (type === "URL") {
      let url = String(b.url || ctaFallback || "").trim();
      if (url.includes("{{cta_link}}") && ctaFallback) url = url.split("{{cta_link}}").join(ctaFallback);
      if (!url || url === "#") url = ctaFallback || "";
      if (!/^https?:\/\//i.test(url)) continue; // Z-API exige http(s)
      out.push({ id, type: "URL", label, url });
    } else if (type === "CALL") {
      const phone = normalizePhone(b.phone || "");
      if (!phone) continue;
      out.push({ id, type: "CALL", label, phone });
    } else if (type === "REPLY") {
      out.push({ id, type: "REPLY", label });
    }
  }
  // Z-API: não misturar REPLY com CALL/URL no mesmo envio.
  const hasReply = out.some((x) => x.type === "REPLY");
  const hasAction = out.some((x) => x.type === "URL" || x.type === "CALL");
  if (hasReply && hasAction) return out.filter((x) => x.type !== "REPLY");
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  let body: any;
  try { body = await req.json(); } catch (e) {
    return json({ error: "bad_request", detail: String(e).slice(0, 300) }, 400);
  }
  const { phone, message, action, buttonActions, title, footer, ctaLink } = body ?? {};
  if (action !== "status" && (!phone || !message)) {
    return json({ error: "missing_fields", detail: "phone e message são obrigatórios" }, 400);
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Auditoria E2E (Canais M1): exige perfil autenticado (não confia só no gateway
  // verify_jwt) — impede disparo de WhatsApp com credenciais compartilhadas do
  // Vault por sessão anônima/mal-configurada (fraude de custo).
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: authUser } = await admin.auth.getUser(jwt);
  if (!authUser?.user) return json({ error: "unauthorized" }, 401);
  const { data: caller } = await admin.from("profiles").select("id").eq("auth_id", authUser.user.id).maybeSingle();
  if (!caller) return json({ error: "forbidden" }, 403);

  const { data: instanceId } = await admin.rpc("get_secret", { p_name: "zapi_instance_id" });
  const { data: token } = await admin.rpc("get_secret", { p_name: "zapi_token" });
  const { data: clientToken } = await admin.rpc("get_secret", { p_name: "zapi_client_token" });
  if (!instanceId || !token) {
    return json({ error: "secret_unavailable", detail: "Defina as secrets 'zapi_instance_id' e 'zapi_token' no Vault." }, 500);
  }

  const zapiBase = `https://api.z-api.io/instances/${instanceId}/token/${token}`;
  const zapiHeaders = { "Content-Type": "application/json", ...(clientToken ? { "Client-Token": clientToken } : {}) };

  if (action === "status") {
    try {
      const [st, dev] = await Promise.all([
        fetch(`${zapiBase}/status`, { headers: zapiHeaders }).then((r) => r.json()).catch(() => ({})),
        fetch(`${zapiBase}/device`, { headers: zapiHeaders }).then((r) => r.json()).catch(() => ({})),
      ]);
      return json({
        ok: true,
        connected: !!st?.connected,
        smartphoneConnected: !!st?.smartphoneConnected,
        phone: dev?.phone ?? null,
        name: dev?.name ?? null,
      });
    } catch (e) {
      return json({ error: "zapi_unreachable", detail: String(e).slice(0, 200) }, 502);
    }
  }

  let target = normalizePhone(phone);
  try {
    const chk = await fetch(`${zapiBase}/phone-exists/${target}`, { headers: zapiHeaders });
    const chkOut = await chk.json().catch(() => ({}));
    if (chk.ok && chkOut) {
      if (chkOut.exists === false) {
        return json({ error: "phone_not_on_whatsapp", detail: "Este número não tem WhatsApp — confira o DDD e os dígitos." }, 400);
      }
      if (typeof chkOut.phone === "string" && chkOut.phone) target = chkOut.phone;
    }
  } catch (_) { /* segue */ }

  const buttons = normalizeButtons(buttonActions, ctaLink);
  const endpoint = buttons.length > 0 ? "send-button-actions" : "send-text";
  const payload: Record<string, unknown> = { phone: target, message };
  if (buttons.length > 0) {
    payload.buttonActions = buttons;
    if (title) payload.title = title;
    if (footer) payload.footer = footer;
  }

  let resp: Response;
  try {
    resp = await fetch(`${zapiBase}/${endpoint}`, {
      method: "POST",
      headers: zapiHeaders,
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return json({ error: "zapi_unreachable", detail: String(e).slice(0, 200) }, 502);
  }
  const out = await resp.json().catch(() => ({}));
  if (!resp.ok) return json({ error: "zapi_error", status: resp.status, detail: out }, 502);
  return json({ ok: true, id: out.messageId ?? out.id ?? out.zaapId ?? null, withButtons: buttons.length > 0 });
});
