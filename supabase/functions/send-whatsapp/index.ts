// Kobly — Edge Function `send-whatsapp`: proxy seguro para a Z-API (WhatsApp).
// Credenciais da Z-API no Supabase Vault (RPC get_secret, service_role). NUNCA no browser.
// Normaliza o telefone p/ E.164 sem '+': só dígitos; 10-11 dígitos (BR sem DDI) → prefixa 55.
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

// Só dígitos; número BR sem DDI (10-11 dígitos) ganha o prefixo 55.
function normalizePhone(raw: string): string {
  const digits = String(raw).replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 11 ? `55${digits}` : digits;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // ── Parse/validação do body → 400 (erro do CHAMADOR) ──
  let body: any;
  try { body = await req.json(); } catch (e) {
    return json({ error: "bad_request", detail: String(e).slice(0, 300) }, 400);
  }
  const { phone, message } = body ?? {};
  if (!phone || !message) return json({ error: "missing_fields", detail: "phone e message são obrigatórios" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: instanceId } = await admin.rpc("get_secret", { p_name: "zapi_instance_id" });
  const { data: token } = await admin.rpc("get_secret", { p_name: "zapi_token" });
  // Client-Token (token de segurança da CONTA, aba Segurança da Z-API) é OPCIONAL:
  // a conta atual não o exige (validado via /status sem o header). Se a secret existir,
  // o header é enviado — habilitar na Z-API + gravar a secret é o hardening recomendado.
  const { data: clientToken } = await admin.rpc("get_secret", { p_name: "zapi_client_token" });
  if (!instanceId || !token)
    return json({ error: "secret_unavailable", detail: "Defina as secrets 'zapi_instance_id' e 'zapi_token' no Vault." }, 500);

  // ── Chamada à Z-API → falha de rede/DNS é 502 (erro do UPSTREAM, não do chamador) ──
  let resp: Response;
  try {
    resp = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(clientToken ? { "Client-Token": clientToken } : {}) },
      body: JSON.stringify({ phone: normalizePhone(phone), message }),
    });
  } catch (e) {
    return json({ error: "zapi_unreachable", detail: String(e).slice(0, 200) }, 502);
  }
  const out = await resp.json().catch(() => ({}));
  if (!resp.ok) return json({ error: "zapi_error", status: resp.status, detail: out }, 502);
  // Prefere o messageId (id do WhatsApp) — é o id que o callback de status da Z-API
  // devolve em ids[], nunca o zaapId.
  return json({ ok: true, id: out.messageId ?? out.id ?? out.zaapId ?? null });
});
