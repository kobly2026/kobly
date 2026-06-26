// Kobly — Edge Function `resend-admin` (setup de domínio de envio).
// Lê a chave do Resend do Vault (server-side, nunca vai pro browser/transcript) e fala
// com a API do Resend para: listar domínios, criar um domínio de envio e verificá-lo.
// Usada só na configuração inicial (entregabilidade p/ destinatários reais). verify_jwt=false.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: any = {};
  try { body = await req.json(); } catch { /* corpo vazio ok */ }
  const action = body.action || "list";

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: apiKey } = await sb.rpc("get_secret", { p_name: "resend_api_key" });
  if (!apiKey) return json({ error: "no_api_key", detail: "resend_api_key ausente no Vault" }, 500);

  const rs = (path: string, method = "GET", payload?: unknown) =>
    fetch(`https://api.resend.com${path}`, {
      method,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: payload ? JSON.stringify(payload) : undefined,
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  try {
    if (action === "list") {
      const r = await rs("/domains");
      return json({ ok: r.status < 300, ...r });
    }
    if (action === "create") {
      // body.name = ex. "send.dizeops.com" ; region opcional
      if (!body.name) return json({ error: "missing_name" }, 400);
      const r = await rs("/domains", "POST", { name: body.name, region: body.region || "us-east-1" });
      return json({ ok: r.status < 300, ...r });
    }
    if (action === "verify") {
      if (!body.id) return json({ error: "missing_id" }, 400);
      const r = await rs(`/domains/${body.id}/verify`, "POST");
      return json({ ok: r.status < 300, ...r });
    }
    if (action === "get") {
      if (!body.id) return json({ error: "missing_id" }, 400);
      const r = await rs(`/domains/${body.id}`);
      return json({ ok: r.status < 300, ...r });
    }
    return json({ error: "unknown_action", detail: action }, 400);
  } catch (e) {
    return json({ error: "resend_call_failed", detail: String(e) }, 500);
  }
});
