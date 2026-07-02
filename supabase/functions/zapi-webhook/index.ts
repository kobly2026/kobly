// Kobly — Edge Function `zapi-webhook` (PÚBLICA, verify_jwt=false).
// Recebe callbacks de STATUS de mensagens WhatsApp da Z-API e grava linhas de
// AUDITORIA em email_events (event='status', channel='whatsapp'), casadas com o
// envio original por sg_message_id (o messageId gravado no envio pelo process-steps).
//
// REGRA CENTRAL: NUNCA faz UPDATE na linha de envio — email_events event='send' fica
// com status='enviado' para sempre. A atribuição de vendas recuperadas do
// postback-receiver e os contadores do front filtram por status='enviado'; mudar o
// status do send para 'entregue'/'lido' quebraria esses dois consumidores.
//
// Mapeamento: SENT → ignorado sem insert (a linha de send já registra o envio;
// inserir de novo dobraria a contagem); DELIVERED/RECEIVED → 'entregue';
// READ/VIEWED → 'lido'. Payload desconhecido/sem id → 200 ignored, NUNCA 4xx
// (a Z-API reenviaria em erro).
//
// Config na Z-API: aponte o webhook "Ao atualizar status da mensagem" para
//   ${SUPABASE_URL}/functions/v1/zapi-webhook
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// Status da Z-API → nosso status interno (só os que geram linha de auditoria;
// SENT fica de fora de propósito — ver comentário do topo).
const STATUS_MAP: Record<string, string> = {
  DELIVERED: "entregue",
  RECEIVED: "entregue",
  READ: "lido",
  VIEWED: "lido",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const raw = await req.text();
  let body: any;
  try { body = JSON.parse(raw || "{}"); } catch { return json({ ok: true, ignored: true, reason: "invalid_json" }); }

  // Payload típico: { type: 'MessageStatusCallback', status: 'SENT'|'RECEIVED'|'READ',
  //                   ids: [...] | messageId | zaapId, phone, momment }
  const rawStatus = String(body?.status ?? body?.type ?? "").toUpperCase();
  // SENT: a linha de send do process-steps já registra o envio — não insere nada.
  if (rawStatus === "SENT") return json({ ok: true, ignored: true });
  const mapped = STATUS_MAP[rawStatus];
  if (!mapped) return json({ ok: true, ignored: true, status: rawStatus || null });

  const ids: string[] = [
    ...(Array.isArray(body?.ids) ? body.ids : []),
    body?.messageId,
    body?.zaapId,
  ].filter((v: unknown): v is string => typeof v === "string" && v.length > 0);
  if (!ids.length) return json({ ok: true, ignored: true, reason: "no_match_key" });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let matched = 0, recorded = 0;
  for (const id of ids) {
    // Localiza o ENVIO original (gravado pelo process-steps com event='send') só para
    // COPIAR o contexto dele — a linha de send nunca é atualizada (ver topo).
    const { data: send } = await sb.from("email_events")
      .select("organization_id, campaign_id, email")
      .eq("sg_message_id", id).eq("channel", "whatsapp").eq("event", "send")
      .limit(1).maybeSingle();
    if (!send) continue;
    matched++;

    // Linha de auditoria do callback. Erro do insert é IGNORADO de propósito: a unique
    // parcial (sg_message_id, status) p/ channel='whatsapp' e event='status' (migration
    // 0021) dedupa reentregas do mesmo status de graça — e aqui nunca respondemos 4xx.
    const ins = await sb.from("email_events").insert({
      organization_id: send.organization_id, campaign_id: send.campaign_id,
      event: "status", channel: "whatsapp", status: mapped,
      email: send.email, sg_message_id: id, "timestamp": new Date().toISOString(),
    });
    if (!ins.error) recorded++;
  }

  if (!matched) return json({ ok: true, unmatched: true });
  return json({ ok: true, status: mapped, matched, recorded });
});
