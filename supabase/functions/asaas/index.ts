// Kobly — Edge Function `asaas`: gateway de pagamento (sandbox/produção).
// Secrets no Vault: asaas_api_key, asaas_env ('sandbox' | 'production').
// Ações:
//  - create_customer  { name?, email?, phone? } → customer Asaas + grava org.
//    O cpfCnpj NÃO vem do body: sai de organizations.documento (validado pelo
//    banco, aceita CNPJ alfanumérico da IN RFB 2.229). Sem ele → documento_ausente.
//  - create_subscription { plan_id, billingType?, cycle? } → assinatura + payment link
//  - create_payment { plan_id, billingType? } → cobrança avulsa (PIX/BOLETO/CREDIT_CARD)
//  - status → { configured, env }
// Auth: JWT. Admin: qualquer org. Gestor: org com membership. Cliente: apenas a
// própria org (vale para todas as ações — sempre escopado a organization_id do perfil).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Inlinado de _shared/billing_cycle.ts (per-function deploy não empacota ../_shared/).
// Manter idêntico a resolveCycleValue em _shared/billing_cycle.ts.
// Regra: cada ciclo lê SÓ o seu campo; sem valor utilizável devolve null e o
// chamador recusa. Nada de fallback entre ciclos.
type BillingCycle = "MONTHLY" | "SEMIANNUALLY" | "YEARLY";

const CYCLE_FIELD: Readonly<Record<BillingCycle, string>> = {
  MONTHLY: "valor_mensal",
  SEMIANNUALLY: "valor_semestral",
  YEARLY: "valor_anual",
};

function resolveCycleValue(
  cycle: string,
  plan: Record<string, unknown>,
): number | null {
  const key = String(cycle ?? "").toUpperCase() as BillingCycle;
  const field = CYCLE_FIELD[key];
  if (!field) return null;                 // ciclo não suportado

  const raw = plan?.[field];
  if (raw === null || raw === undefined) return null;   // nulo OU coluna ausente

  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function asaasBase(env: string) {
  return env === "production"
    ? "https://api.asaas.com/v3"
    : "https://sandbox.asaas.com/api/v3";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: any = {};
  try { body = await req.json(); } catch { /* ok */ }
  const action = body.action || "status";

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: userData, error: userErr } = await sb.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);

  const { data: prof } = await sb.from("profiles")
    .select("id, nome, email, tipo_user_geral, organization_id, celular")
    .eq("auth_id", userData.user.id).maybeSingle();
  if (!prof) return json({ error: "forbidden" }, 403);

  const role = String(prof.tipo_user_geral);
  const { data: apiKey } = await sb.rpc("get_secret", { p_name: "asaas_api_key" });
  const { data: envCfg } = await sb.rpc("get_secret", { p_name: "asaas_env" });
  const env = (envCfg === "production" ? "production" : "sandbox") as string;

  if (action === "status") {
    return json({ ok: true, configured: !!apiKey, env: apiKey ? env : null });
  }

  if (!apiKey) {
    return json({
      error: "not_configured",
      detail: "Asaas não configurado. Defina asaas_api_key (e opcional asaas_env=sandbox|production) no Vault.",
    }, 503);
  }

  const base = asaasBase(env);
  const asaas = async (path: string, method = "GET", payload?: unknown) => {
    const r = await fetch(`${base}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        access_token: String(apiKey),
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  };

  // Anti-IDOR: Cliente só a própria org; Gestor precisa de membership; Admin livre.
  // Nunca confiar cegamente em body.organization_id.
  let orgId: string | null = body.organization_id || prof.organization_id || null;
  if (!orgId) return json({ error: "no_org", detail: "Organização não definida" }, 400);
  if (role === "Cliente") {
    if (!prof.organization_id || prof.organization_id !== orgId) {
      return json({ error: "forbidden", detail: "Cliente só opera a própria organização" }, 403);
    }
  } else if (role !== "Administrador") {
    const own = prof.organization_id === orgId;
    const { data: mem } = await sb.from("organization_memberships")
      .select("id").eq("organization_id", orgId).eq("profile_id", prof.id).maybeSingle();
    if (!own && !mem) return json({ error: "forbidden", detail: "Sem acesso a esta organização" }, 403);
  }

  // Garante customer Asaas para a org
  const ensureCustomer = async () => {
    const { data: org } = await sb.from("organizations")
      .select("id, nome, asaas_customer_id, documento").eq("id", orgId).maybeSingle();
    if (!org) throw new Error("org_not_found");
    if (org.asaas_customer_id) return org.asaas_customer_id as string;

    // POST /customers do Asaas exige cpfCnpj. A fonte é organizations.documento,
    // já validado pelo CHECK organizations_documento_valido (CPF, CNPJ numérico
    // ou alfanumérico da IN RFB 2.229) e guardado sem máscara — por isso NÃO se
    // aceita mais documento vindo do body: seria entrada não validada.
    if (!org.documento) throw new Error("documento_ausente");

    const name = body.name || org.nome || prof.nome || "Cliente Kobly";
    const email = body.email || prof.email;
    const r = await asaas("/customers", "POST", {
      name,
      email,
      cpfCnpj: org.documento,
      phone: body.phone || prof.celular || undefined,
      externalReference: org.id,
      notificationDisabled: false,
    });
    if (!r.ok || !r.data?.id) {
      throw new Error(r.data?.errors?.[0]?.description || r.data?.message || "falha ao criar customer Asaas");
    }
    await sb.from("organizations").update({ asaas_customer_id: r.data.id }).eq("id", org.id);
    return r.data.id as string;
  };

  try {
    if (action === "create_customer") {
      const id = await ensureCustomer();
      return json({ ok: true, customerId: id, env });
    }

    if (action === "create_payment" || action === "create_subscription") {
      const planId = body.plan_id;
      if (!planId) return json({ error: "missing_plan_id" }, 400);
      const { data: plan } = await sb.from("plans")
        .select("id, nome, valor_mensal, valor_semestral, valor_anual, status")
        .eq("id", planId).maybeSingle();
      if (!plan || plan.status !== "Ativo") return json({ error: "plan_not_found" }, 404);

      const customerId = await ensureCustomer();
      const billingType = (body.billingType || "PIX").toUpperCase(); // PIX | BOLETO | CREDIT_CARD
      const cycle = (body.cycle || "MONTHLY").toUpperCase();
      const value = resolveCycleValue(cycle, plan as Record<string, unknown>);
      if (value === null) {
        return json({ error: "invalid_plan_value", detail: `plano "${plan.nome}" não tem valor para o ciclo ${cycle}` }, 400);
      }

      if (action === "create_subscription") {
        const r = await asaas("/subscriptions", "POST", {
          customer: customerId,
          billingType,
          value,
          nextDueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
          cycle,
          description: `Kobly — ${plan.nome}`,
          externalReference: `${orgId}:${plan.id}`,
        });
        if (!r.ok) return json({ error: "asaas_error", detail: r.data }, 502);
        // Invoice URL se houver
        const subId = r.data?.id;
        let invoiceUrl: string | null = r.data?.invoiceUrl || null;
        if (!invoiceUrl && subId) {
          const pay = await asaas(`/subscriptions/${subId}/payments`);
          invoiceUrl = pay.data?.data?.[0]?.invoiceUrl || pay.data?.data?.[0]?.bankSlipUrl || null;
        }
        return json({ ok: true, subscriptionId: subId, invoiceUrl, env, value, plan: plan.nome });
      }

      // Cobrança avulsa
      const r = await asaas("/payments", "POST", {
        customer: customerId,
        billingType,
        value,
        dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        description: `Kobly — ${plan.nome}`,
        externalReference: `${orgId}:${plan.id}`,
      });
      if (!r.ok) return json({ error: "asaas_error", detail: r.data }, 502);

      // PIX: o POST /payments NÃO devolve o QR — é preciso o follow-up
      // GET /payments/{id}/pixQrCode → { encodedImage, payload, expirationDate }.
      let pixQrCode: string | null = null;     // imagem base64 (PNG) do QR
      let pixCopyPaste: string | null = null;  // "copia e cola" (payload EMV)
      let pixExpiration: string | null = null;
      const paymentId = r.data?.id;
      if (billingType === "PIX" && paymentId) {
        const qr = await asaas(`/payments/${paymentId}/pixQrCode`);
        if (qr.ok) {
          pixQrCode = qr.data?.encodedImage || null;
          pixCopyPaste = qr.data?.payload || null;
          pixExpiration = qr.data?.expirationDate || null;
        }
      }
      return json({
        ok: true,
        paymentId,
        invoiceUrl: r.data?.invoiceUrl || r.data?.bankSlipUrl || null,
        pixQrCode,
        pixCopyPaste,
        pixExpiration,
        env,
        value,
        plan: plan.nome,
      });
    }

    return json({ error: "unknown_action", detail: action }, 400);
  } catch (e) {
    // Erro acionável pelo usuário (não é falha do gateway): o front abre o campo
    // de CPF/CNPJ em vez de mostrar "asaas_failed".
    if (String(e).includes("documento_ausente")) {
      return json({
        error: "documento_ausente",
        detail: "Informe o CPF/CNPJ da conta antes de gerar a cobrança.",
      }, 400);
    }
    return json({ error: "asaas_failed", detail: String(e).slice(0, 300) }, 500);
  }
});
