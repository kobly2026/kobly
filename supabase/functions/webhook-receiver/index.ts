// Kobly — Edge Function `webhook-receiver` (PÚBLICA, verify_jwt=false).
// Ponto de entrada do motor. PROVIDER-AWARE: roteia por plataforma via adaptador.
//   • Caminho ADAPTADOR: URL `?provider=&token=<secret>` → resolve o webhook pelo token,
//     o provider vem DA LINHA (nunca do corpo), verifica assinatura (HMAC) se exigida,
//     e o adaptador traduz o payload nativo → evento normalizado. Status desconhecido = 200 ignored.
//   • Caminho LEGADO `generic`: `{secret, tipo_evento, ...}` no CORPO — comportamento idêntico ao de antes
//     (inclui 400 missing_fields). É a rede de segurança / harness de teste do motor já provado.
// Core compartilhado (inalterado): grava webhook_events (idempotente), upsert do lead, enfileira steps.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAdapter, type NormalizedEvent } from "./adapters/index.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const WH_COLS = "id, organization_id, desabilitado, testado, provider, signing_secret";
const RATE_LIMIT_PER_MIN = 120;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  // Corpo CRU primeiro (a verificação de assinatura HMAC precisa dos bytes como recebidos).
  const rawBody = await req.text();
  let body: any;
  try { body = JSON.parse(rawBody || "{}"); } catch { return json({ error: "invalid_json" }, 400); }

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // ── Dispatch: caminho adaptador (token na URL) vs legado (secret no corpo) ──
  let wh: any = null;
  let providerName = "generic";
  let isLegacy = false;

  if (token) {
    const { data } = await sb.from("webhooks").select(WH_COLS).eq("secret", token).maybeSingle();
    wh = data;
    providerName = (wh?.provider as string) || "generic";
    if (!wh) return json({ error: "invalid_token" }, 401);
  } else if (body && body.secret) {
    isLegacy = true;
    providerName = "generic";
    // Mesma precedência de hoje: validar campos ANTES de resolver o webhook.
    if (!body.tipo_evento) return json({ error: "missing_fields", detail: "secret e tipo_evento são obrigatórios" }, 400);
    const { data } = await sb.from("webhooks").select(WH_COLS).eq("secret", body.secret).maybeSingle();
    wh = data;
    if (!wh) return json({ error: "invalid_secret" }, 401);
  } else {
    return json({ error: "unauthorized", detail: "token (URL) ou secret (corpo) obrigatório" }, 401);
  }
  if (wh.desabilitado) return json({ error: "webhook_disabled" }, 403);

  const org = wh.organization_id;
  const adapter = getAdapter(providerName);

  // ── Assinatura (só adaptadores que exigem) ──
  if (adapter.requiresSignature) {
    const okSig = await adapter.verify(rawBody, req.headers, (wh.signing_secret as string) ?? null);
    if (!okSig) return json({ error: "invalid_signature" }, 401);
  }

  // ── Rate-limit barato por organização (usa idx_webhook_events_org_created) ──
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count: recent } = await sb.from("webhook_events")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org).gte("created_at", since);
  if ((recent ?? 0) > RATE_LIMIT_PER_MIN) return json({ error: "rate_limited" }, 429);

  // ── Tradução pelo adaptador ──
  const out = adapter.parse(body, req.headers);
  if ((out as any).ignore || !(out as NormalizedEvent).tipo_evento) {
    // Status desconhecido/irrelevante → grava cru p/ auditoria (id_webhook único p/ não colidir) e 200.
    await sb.from("webhook_events").insert({
      organization_id: org, webhook_id: wh.id, provider: providerName,
      id_webhook: `ignored:${crypto.randomUUID()}`, payload: body,
    });
    return json({ ok: true, ignored: true });
  }
  const ev = out as NormalizedEvent;

  if (!wh.testado) await sb.from("webhooks").update({ testado: true }).eq("id", wh.id);

  // ── 1) webhook_events (idempotente por (webhook_id, id_webhook)) ──
  const evt: any = {
    organization_id: org, webhook_id: wh.id, tipo_evento: ev.tipo_evento, provider: providerName, id_webhook: ev.id_webhook ?? null,
    email: ev.email ?? null, nome_comprador: ev.nome ?? null, sobrenome_comprador: ev.sobrenome ?? null, telefone: ev.telefone ?? null,
    produto: ev.produto ?? null, valor_produto: ev.valor ?? null, metodo_pagamento: ev.metodo_pagamento ?? null, pix_gerado: !!ev.pix_gerado, payload: body,
  };
  const ins = await sb.from("webhook_events").insert(evt).select("id").single();
  if (ins.error) return json({ ok: true, deduped: true, detail: ins.error.message });
  const webhookEventId = ins.data.id;

  // ── 2) Lead por (org, email). Sem email → registra evento mas pula (visível). ──
  if (!ev.email) {
    return json({ ok: true, webhook_event_id: webhookEventId, lead_skipped: "no_email", enqueued: 0 });
  }
  let leadId: string | null = null;
  const { data: ex } = await sb.from("leads").select("id").eq("organization_id", org).eq("email", ev.email).maybeSingle();
  if (ex) {
    leadId = ex.id;
    await sb.from("leads").update({ ultimo_evento: ev.tipo_evento, produto: ev.produto ?? null, valor_compra: ev.valor ?? null, metodo_pagamento: ev.metodo_pagamento ?? null, pix_gerado: !!ev.pix_gerado }).eq("id", leadId);
  } else {
    const { data: nl } = await sb.from("leads").insert({
      organization_id: org, email: ev.email, nome: ev.nome ?? null, sobrenome: ev.sobrenome ?? null, telefone: ev.telefone ?? null,
      produto: ev.produto ?? null, valor_compra: ev.valor ?? null, metodo_pagamento: ev.metodo_pagamento ?? null, pix_gerado: !!ev.pix_gerado, ultimo_evento: ev.tipo_evento,
    }).select("id").single();
    leadId = nl?.id ?? null;
  }
  if (leadId) await sb.from("webhook_events").update({ lead_id: leadId }).eq("id", webhookEventId);

  // ── 3) Enfileira etapas das campanhas ATIVAS cujo Gatilho casa o tipo_evento ──
  // flow_steps tem 2 FKs p/ campaign_flows (flow_id e fluxo_alvo_id) -> desambigua com !flow_id
  const { data: camps, error: campErr } = await sb.from("campaigns")
    .select("id, campaign_flows(id, flow_steps!flow_id(id, tipo_card, tipo_evento, atraso, posicao))")
    .eq("organization_id", org).eq("status_campanha", "Ativa");
  if (campErr) return json({ ok: true, lead_id: leadId, webhook_event_id: webhookEventId, enqueued: 0, warn: "match_failed", detail: campErr.message });

  let enqueued = 0; const campanhasAcionadas: string[] = [];
  for (const c of camps || []) {
    const flow = Array.isArray((c as any).campaign_flows) ? (c as any).campaign_flows[0] : (c as any).campaign_flows;
    const steps = (flow && flow.flow_steps) || [];
    const casa = steps.some((s: any) => s.tipo_card === "Gatilho" && s.tipo_evento === ev.tipo_evento);
    if (!casa || !leadId) continue;
    // Exclui Gatilho E Condição (marcador visual — a condição é avaliada por
    // process-steps nos filhos), igual ao postback-receiver. Antes incluía Condição,
    // criando um scheduled_step inútil por execução.
    const acoes = steps
      .filter((s: any) => s.tipo_card !== "Gatilho" && s.tipo_card !== "Condição")
      .sort((a: any, b: any) => a.posicao - b.posicao);
    // Atraso CUMULATIVO (cada etapa após a anterior) — mesmo fix do postback-receiver.
    let accMin = 0;
    const rows = acoes.map((s: any) => {
      accMin += Number(s.atraso) || 0;
      return {
        organization_id: org, step_id: s.id, lead_id: leadId, webhook_event_id: webhookEventId,
        status_agendamento: "Iniciado", run_at: new Date(Date.now() + accMin * 60000).toISOString(),
      };
    });
    if (rows.length) {
      const r = await sb.from("scheduled_steps").insert(rows);
      if (!r.error) { enqueued += rows.length; campanhasAcionadas.push((c as any).id); }
    }
  }

  return json({ ok: true, lead_id: leadId, webhook_event_id: webhookEventId, enqueued, campanhas_acionadas: campanhasAcionadas });
});
