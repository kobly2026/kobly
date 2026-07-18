// Kobly — Edge Function `asaas-webhook` (PÚBLICA, verify_jwt=false).
// Fecha o ciclo comercial: recebe a confirmação de pagamento do Asaas e ATIVA
// o plano da organização (auditoria E2E — Billing CRÍTICO 1).
//
// Config no Asaas (Configurações → Webhooks / Notificações):
//   URL: ${SUPABASE_URL}/functions/v1/asaas-webhook
//   Token de autenticação: o mesmo valor da secret Vault `asaas_webhook_token`
//   (o Asaas envia no header `asaas-access-token`).
//
// Eventos tratados:
//   PAYMENT_CONFIRMED / PAYMENT_RECEIVED → ativa o plano (via asaas_activate_plan)
//   PAYMENT_OVERDUE                      → marca inadimplência
//   demais                               → 200 ignore (não desativa o webhook)
//
// Casamento org+plano: usamos payment.externalReference = "<orgId>:<planId>"
// (gravado pela função `asaas` ao criar payment/subscription).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// Constant-time-ish compare para o token do webhook.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

const ACTIVATE = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // 1) Autenticação do webhook: header `asaas-access-token` == secret do Vault.
  const { data: expectedToken } = await sb.rpc("get_secret", { p_name: "asaas_webhook_token" });
  if (expectedToken) {
    const got = req.headers.get("asaas-access-token") || "";
    if (!safeEqual(got, String(expectedToken))) return json({ error: "unauthorized" }, 401);
  }
  // Se a secret não estiver definida, registramos e seguimos (dev). Em produção,
  // defina `asaas_webhook_token` para exigir o header.

  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const event = String(body?.event || "");
  const payment = body?.payment || {};
  const paymentId: string | null = payment.id || null;
  const value = Number(payment.value) || 0;
  const subscription: string | null = payment.subscription || null;
  const extRef = String(payment.externalReference || "");

  // externalReference = "<orgId>:<planId>". Fallback: resolve org por customer.
  let [orgId, planId] = extRef.includes(":") ? extRef.split(":") : [null, null];
  if (!orgId && payment.customer) {
    const { data: org } = await sb.from("organizations")
      .select("id, plano_id").eq("asaas_customer_id", payment.customer).maybeSingle();
    if (org) { orgId = org.id; planId = planId || org.plano_id; }
  }

  if (ACTIVATE.has(event)) {
    if (!orgId) return json({ ok: true, ignored: true, reason: "no_org_match" });
    // vencimento: nextDueDate/dueDate + ~1 ciclo; deixamos o Asaas reconfirmar
    // no próximo pagamento. Guardamos dueDate como referência de expiração.
    const expira = payment.dueDate ? new Date(`${payment.dueDate}T23:59:59Z`).toISOString() : null;
    const { error } = await sb.rpc("asaas_activate_plan", {
      p_org: orgId,
      p_plano: planId || null,
      p_payment_id: paymentId,
      p_value: value,
      p_subscription: subscription,
      p_expira: expira,
    });
    if (error) return json({ error: "activation_failed", detail: error.message }, 500);
    return json({ ok: true, activated: true, org: orgId, plan: planId, payment: paymentId });
  }

  if (event === "PAYMENT_OVERDUE") {
    if (orgId) await sb.rpc("asaas_mark_overdue", { p_org: orgId });
    return json({ ok: true, overdue: true, org: orgId });
  }

  return json({ ok: true, ignored: true, event });
});
