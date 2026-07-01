// Kobly — Edge Function `postback-receiver` (PÚBLICA, verify_jwt=false).
// URL universal de postback: qualquer plataforma pode chamar com JSON padronizado.
// Autenticação: token na query string (?token=pbk_xxx) → valida via RPC validate_postback_token.
// Payload esperado (contrato genérico Kobly):
//   { event, email, name, product, value, payment_method, external_id, metadata }
// Também aceita nativamente o payload de Webhook da Hotmart (v2), sem tradução manual
// pelo cliente: { event: "PURCHASE_APPROVED", data: { buyer: {...}, purchase: {...} } }.
// Mapeamento event → tipo_evento é feito internamente (EVENT_MAP / HOTMART_EVENT_MAP).
// Fluxo core: webhook_events (idempotente) → upsert lead → enfileira steps.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const RATE_LIMIT_PER_MIN = 120;

// ── Mapeamento event → tipo_evento (enum do banco) — contrato genérico Kobly ──
const EVENT_MAP: Record<string, string> = {
  cart_abandoned: "Abandono de carrinho",
  payment_approved: "Compra Aprovada",
  payment_refused: "Compra Recusada",
  payment_refunded: "Compra Reembolsada",
  payment_chargeback: "Chargeback",
  payment_canceled: "Compra cancelada",
  subscription_canceled: "Cancelamento de Assinatura",
  pix_generated: "Pix Gerado",
  boleto_generated: "Boleto Gerado",
  deposit_requested: "Depósito Solicitado",
};

// ── Mapeamento nativo Hotmart (Webhook v2) → tipo_evento ──
// Confirmado na doc oficial: PURCHASE_APPROVED/COMPLETE/CANCELED/EXPIRED/REFUNDED/
// CHARGEBACK/BILLET_PRINTED, SUBSCRIPTION_CANCELLATION. PURCHASE_OUT_OF_SHOPPING_CART
// (abandono de carrinho) e eventos de PROTEST/DELAYED não têm 1:1 confirmado — ficam
// de fora do mapa (evento cai em "ignored", não quebra o webhook). A Hotmart não expõe
// um evento dedicado de "Pix gerado" (só o status final da compra), então esse gatilho
// não tem equivalente nativo — ajustar aqui assim que o 1º payload real confirmar nomes.
const HOTMART_EVENT_MAP: Record<string, string> = {
  PURCHASE_APPROVED: "Compra Aprovada",
  PURCHASE_COMPLETE: "Compra Aprovada",
  PURCHASE_CANCELED: "Compra cancelada",
  PURCHASE_EXPIRED: "Compra cancelada",
  PURCHASE_REFUNDED: "Compra Reembolsada",
  PURCHASE_CHARGEBACK: "Chargeback",
  PURCHASE_BILLET_PRINTED: "Boleto Gerado",
  PURCHASE_OUT_OF_SHOPPING_CART: "Abandono de carrinho",
  SUBSCRIPTION_CANCELLATION: "Cancelamento de Assinatura",
};

// Payload é "formato Hotmart" quando vem aninhado em `data.{buyer,purchase,subscriber}`
// em vez do contrato plano da Kobly (email/name/product no nível raiz).
function isHotmartShaped(body: any): boolean {
  return !!(body && body.data && (body.data.buyer || body.data.purchase || body.data.subscriber));
}

// Normaliza os dois formatos aceitos (genérico Kobly e nativo Hotmart) para um
// único shape interno. Retorna null quando o evento não é reconhecido/mapeável
// (nesse caso o chamador deve responder 200 "ignored", nunca 4xx — a Hotmart
// desativa automaticamente um Webhook que fica respondendo erro).
function normalizePayload(body: any): {
  tipoEvento: string; email: string | null; name: string | null; product: string | null;
  value: number | null; paymentMethod: string | null; externalId: string | null; sourceEvent: string;
} | null {
  if (!body || !body.event) return null;

  if (isHotmartShaped(body)) {
    const tipoEvento = HOTMART_EVENT_MAP[body.event];
    if (!tipoEvento) return null;
    const buyer = body.data.buyer || body.data.subscriber || {};
    const purchase = body.data.purchase || {};
    const product = body.data.product || {};
    if (!buyer.email) return null;
    return {
      tipoEvento,
      email: buyer.email,
      name: buyer.name || null,
      product: product.name || null,
      value: purchase?.price?.value ?? purchase?.full_price?.value ?? null,
      paymentMethod: purchase?.payment?.type || null,
      externalId: body.data.purchase?.transaction || body.id || null,
      sourceEvent: body.event,
    };
  }

  const tipoEvento = EVENT_MAP[body.event];
  if (!tipoEvento || !body.email) return null;
  return {
    tipoEvento,
    email: body.email,
    name: body.name || null,
    product: body.product || null,
    value: body.value ?? null,
    paymentMethod: body.payment_method || null,
    externalId: body.external_id || null,
    sourceEvent: body.event,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // ── Token ──
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return json({ error: "missing_token", detail: "Adicione ?token=pbk_xxx na URL" }, 401);

  // ── Body ──
  const rawBody = await req.text();
  let body: any;
  try { body = JSON.parse(rawBody || "{}"); } catch { return json({ error: "invalid_json" }, 400); }

  // ── Normaliza (contrato genérico Kobly OU payload nativo Hotmart) ──
  // Evento não reconhecido/sem e-mail → 200 "ignored", NUNCA 4xx: plataformas como a
  // Hotmart desativam automaticamente um Webhook que fica respondendo erro, o que
  // derrubaria TODOS os eventos futuros por causa de um único tipo não mapeado ainda.
  const norm = normalizePayload(body);
  if (!norm) {
    return json({ ok: true, ignored: true, reason: "unknown_event_or_missing_email", received_event: body?.event ?? null });
  }
  const tipoEvento = norm.tipoEvento;

  // ── Supabase client ──
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // ── Validar token → organization_id ──
  const { data: orgId, error: tokErr } = await sb.rpc("validate_postback_token", { p_token: token });
  if (tokErr || !orgId) return json({ error: "invalid_token", detail: "Token inválido ou inativo" }, 401);
  const org = orgId as string;

  // ── Rate limit ──
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count: recent } = await sb.from("webhook_events")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org).gte("created_at", since);
  if ((recent ?? 0) > RATE_LIMIT_PER_MIN) return json({ error: "rate_limited" }, 429);

  // ── Idempotência: dedup por external_id (se fornecido) ──
  const idWebhook = norm.externalId ?? `pbk:${crypto.randomUUID()}`;
  const isPix = norm.sourceEvent === "pix_generated"; // só o contrato genérico distingue Pix hoje

  // ── 1) webhook_events (idempotente) ──
  const evt = {
    organization_id: org,
    tipo_evento: tipoEvento,
    provider: "postback",
    id_webhook: idWebhook,
    email: norm.email,
    nome_comprador: norm.name,
    produto: norm.product,
    valor_produto: norm.value,
    metodo_pagamento: norm.paymentMethod,
    pix_gerado: isPix,
    payload: body,
  };
  const ins = await sb.from("webhook_events").insert(evt).select("id").single();
  if (ins.error) return json({ ok: true, deduped: true, detail: ins.error.message });
  const webhookEventId = ins.data.id;

  // ── 2) Lead por (org, email) ──
  let leadId: string | null = null;
  const { data: ex } = await sb.from("leads")
    .select("id")
    .eq("organization_id", org)
    .eq("email", norm.email)
    .maybeSingle();

  if (ex) {
    leadId = ex.id;
    await sb.from("leads").update({
      ultimo_evento: tipoEvento,
      produto: norm.product,
      valor_compra: norm.value,
      metodo_pagamento: norm.paymentMethod,
      pix_gerado: isPix,
    }).eq("id", leadId);
  } else {
    const { data: nl } = await sb.from("leads").insert({
      organization_id: org,
      email: norm.email,
      nome: norm.name,
      produto: norm.product,
      valor_compra: norm.value,
      metodo_pagamento: norm.paymentMethod,
      pix_gerado: isPix,
      ultimo_evento: tipoEvento,
    }).select("id").single();
    leadId = nl?.id ?? null;
  }

  if (leadId) {
    await sb.from("webhook_events").update({ lead_id: leadId }).eq("id", webhookEventId);
  }

  // ── 2b) Atribuição de VENDA RECUPERADA (dado real) ──
  // Se este é o 1º "Compra Aprovada" deste lead, credita cada campanha que já
  // enviou um e-mail de recuperação pra ele (email_events.status='enviado').
  if (tipoEvento === "Compra Aprovada" && leadId) {
    const { count: convCount } = await sb.from("webhook_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org).eq("lead_id", leadId).eq("tipo_evento", "Compra Aprovada");
    // convCount já inclui o evento recém-inserido → == 1 significa primeira conversão
    if ((convCount ?? 0) <= 1) {
      const { data: sent } = await sb.from("email_events")
        .select("campaign_id")
        .eq("organization_id", org).eq("email", norm.email).eq("status", "enviado")
        .not("campaign_id", "is", null);
      const campIds = Array.from(new Set((sent || []).map((e: any) => e.campaign_id)));
      for (const cid of campIds) {
        const { data: cs } = await sb.from("campaign_stats").select("id, vendas_recuperadas").eq("campaign_id", cid).maybeSingle();
        if (cs) {
          await sb.from("campaign_stats")
            .update({ vendas_recuperadas: (Number(cs.vendas_recuperadas) || 0) + 1, ultimo_calculo: new Date().toISOString() })
            .eq("id", cs.id);
        }
      }
    }
  }

  // ── 3) Enfileira etapas das campanhas ATIVAS cujo Gatilho casa o tipo_evento ──
  const { data: camps, error: campErr } = await sb.from("campaigns")
    .select("id, campaign_flows(id, flow_steps!flow_id(id, tipo_card, tipo_evento, atraso, posicao))")
    .eq("organization_id", org)
    .eq("status_campanha", "Ativa");

  if (campErr) {
    return json({
      ok: true, lead_id: leadId, webhook_event_id: webhookEventId,
      enqueued: 0, warn: "match_failed", detail: campErr.message,
    });
  }

  let enqueued = 0;
  const campanhasAcionadas: string[] = [];

  for (const c of camps || []) {
    const flow = Array.isArray((c as any).campaign_flows)
      ? (c as any).campaign_flows[0]
      : (c as any).campaign_flows;
    const steps = (flow && flow.flow_steps) || [];

    // Verifica se algum step Gatilho casa com o tipo_evento
    const casa = steps.some((s: any) => s.tipo_card === "Gatilho" && s.tipo_evento === tipoEvento);
    if (!casa || !leadId) continue;

    // Coleta as ações (exclui o Gatilho), ordena por posição
    const acoes = steps
      .filter((s: any) => s.tipo_card !== "Gatilho")
      .sort((a: any, b: any) => a.posicao - b.posicao);

    const rows = acoes.map((s: any) => ({
      organization_id: org,
      step_id: s.id,
      lead_id: leadId,
      webhook_event_id: webhookEventId,
      status_agendamento: "Iniciado",
      run_at: new Date(Date.now() + (Number(s.atraso) || 0) * 60000).toISOString(),
    }));

    if (rows.length) {
      const r = await sb.from("scheduled_steps").insert(rows);
      if (!r.error) {
        enqueued += rows.length;
        campanhasAcionadas.push((c as any).id);
      }
    }
  }

  return json({
    ok: true,
    event: norm.sourceEvent,
    tipo_evento: tipoEvento,
    lead_id: leadId,
    webhook_event_id: webhookEventId,
    enqueued,
    campanhas_acionadas: campanhasAcionadas,
  });
});
