// Kobly — Edge Function `postback-receiver` (PÚBLICA, verify_jwt=false).
// URL universal de postback: qualquer plataforma pode chamar com JSON padronizado.
// Autenticação: token na query string (?token=pbk_xxx) → valida via RPC validate_postback_token.
// Payload esperado:
//   { event, email, name, product, value, payment_method, external_id, metadata }
// Mapeamento event → tipo_evento é feito internamente (tabela EVENT_MAP).
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

// ── Mapeamento event → tipo_evento (enum do banco) ──
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

  // ── Campos obrigatórios ──
  if (!body.event) return json({ error: "missing_field", detail: "event é obrigatório" }, 400);
  if (!body.email) return json({ error: "missing_field", detail: "email é obrigatório" }, 400);

  const tipoEvento = EVENT_MAP[body.event];
  if (!tipoEvento) {
    return json({
      error: "unknown_event",
      detail: `Evento "${body.event}" não reconhecido. Eventos suportados: ${Object.keys(EVENT_MAP).join(", ")}`,
    }, 400);
  }

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
  const idWebhook = body.external_id ?? `pbk:${crypto.randomUUID()}`;

  // ── 1) webhook_events (idempotente) ──
  const evt = {
    organization_id: org,
    tipo_evento: tipoEvento,
    provider: "postback",
    id_webhook: idWebhook,
    email: body.email ?? null,
    nome_comprador: body.name ?? null,
    produto: body.product ?? null,
    valor_produto: body.value ?? null,
    metodo_pagamento: body.payment_method ?? null,
    pix_gerado: body.event === "pix_generated",
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
    .eq("email", body.email)
    .maybeSingle();

  if (ex) {
    leadId = ex.id;
    await sb.from("leads").update({
      ultimo_evento: tipoEvento,
      produto: body.product ?? null,
      valor_compra: body.value ?? null,
      metodo_pagamento: body.payment_method ?? null,
      pix_gerado: body.event === "pix_generated",
    }).eq("id", leadId);
  } else {
    const { data: nl } = await sb.from("leads").insert({
      organization_id: org,
      email: body.email,
      nome: body.name ?? null,
      produto: body.product ?? null,
      valor_compra: body.value ?? null,
      metodo_pagamento: body.payment_method ?? null,
      pix_gerado: body.event === "pix_generated",
      ultimo_evento: tipoEvento,
    }).select("id").single();
    leadId = nl?.id ?? null;
  }

  if (leadId) {
    await sb.from("webhook_events").update({ lead_id: leadId }).eq("id", webhookEventId);
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
    event: body.event,
    tipo_evento: tipoEvento,
    lead_id: leadId,
    webhook_event_id: webhookEventId,
    enqueued,
    campanhas_acionadas: campanhasAcionadas,
  });
});
