// Kobly — Edge Function `resend-webhook` (PÚBLICA, verify_jwt=false).
// Recebe os eventos de e-mail do Resend (https://resend.com/webhooks) e transforma
// abertura/clique em DADO REAL: grava email_events, incrementa lead_metrics.aberturas/cliques
// e recalcula campaign_stats.taxa_abertura/ctr (frações 0–1) a partir de contagens reais.
//
// Casamento: o Resend manda data.email_id = o id que gravamos como email_events.sg_message_id
// no envio (process-steps). A partir do envio original resolvemos org + campaign_id.
//
// Config no Resend: aponte o webhook para
//   ${SUPABASE_URL}/functions/v1/resend-webhook
// e assine os eventos email.opened / email.clicked.
//
// ⚠️ Rastreamento de abertura/clique do Resend só dispara com DOMÍNIO VERIFICADO
// (o sender de sandbox onboarding@resend.dev não rastreia). Sem isso, o pipeline
// funciona mas não recebe eventos reais.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// Resend event type → nosso mapeamento interno
const MAP: Record<string, { event: string; col: "aberturas" | "cliques"; status: string }> = {
  "email.opened": { event: "open", col: "aberturas", status: "aberto" },
  "email.clicked": { event: "click", col: "cliques", status: "clicado" },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const raw = await req.text();
  let body: any;
  try { body = JSON.parse(raw || "{}"); } catch { return json({ error: "invalid_json" }, 400); }

  const m = MAP[body?.type];
  if (!m) return json({ ok: true, ignored: true, type: body?.type ?? null }); // demais eventos → 200 ignore

  const data = body.data || {};
  const messageId: string | null = data.email_id || null;
  const recipient: string | null = Array.isArray(data.to) ? data.to[0] : (data.to || null);
  if (!messageId && !recipient) return json({ ok: true, ignored: true, reason: "no_match_key" });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Resolve org + campanha a partir do ENVIO original (casado por sg_message_id)
  let org: string | null = null;
  let campaignId: string | null = null;
  let email: string | null = recipient;
  if (messageId) {
    const { data: send } = await sb.from("email_events")
      .select("organization_id, campaign_id, email")
      .eq("sg_message_id", messageId).eq("status", "enviado").limit(1).maybeSingle();
    if (send) { org = send.organization_id; campaignId = send.campaign_id; email = send.email || recipient; }
  }
  if (!org && recipient) {
    const { data: lead } = await sb.from("leads").select("organization_id").eq("email", recipient).limit(1).maybeSingle();
    org = lead?.organization_id ?? null;
  }
  if (!org) return json({ ok: true, ignored: true, reason: "unmatched" });

  // 1) Registra o evento de abertura/clique
  await sb.from("email_events").insert({
    organization_id: org, campaign_id: campaignId, event: m.event, status: m.status,
    email, sg_message_id: messageId, url: data.click?.link ?? null, "timestamp": new Date().toISOString(),
  });

  // 2) Incrementa a métrica do lead
  if (email) {
    const { data: lead } = await sb.from("leads").select("id").eq("organization_id", org).eq("email", email).maybeSingle();
    if (lead) {
      const { data: lm } = await sb.from("lead_metrics").select("id, aberturas, cliques").eq("lead_id", lead.id).limit(1).maybeSingle();
      if (lm) await sb.from("lead_metrics").update({ [m.col]: (Number((lm as any)[m.col]) || 0) + 1 }).eq("id", lm.id);
      else await sb.from("lead_metrics").insert({ lead_id: lead.id, organization_id: org, [m.col]: 1 });
    }
  }

  // 3) Recalcula taxa_abertura / ctr da campanha por ABRIDORES/CLICADORES ÚNICOS ÷ enviados
  if (campaignId) {
    const uniqueBy = async (ev: string) => {
      const { data } = await sb.from("email_events").select("email").eq("campaign_id", campaignId).eq("event", ev);
      return new Set((data || []).map((r: any) => r.email)).size;
    };
    const opens = await uniqueBy("open");
    const clicks = await uniqueBy("click");
    const { data: cs } = await sb.from("campaign_stats").select("id, emails_enviados").eq("campaign_id", campaignId).maybeSingle();
    if (cs) {
      const env = Number(cs.emails_enviados) || 0;
      await sb.from("campaign_stats").update({
        taxa_abertura: env ? Math.min(1, opens / env) : 0,
        ctr: env ? Math.min(1, clicks / env) : 0,
        ultimo_calculo: new Date().toISOString(),
      }).eq("id", cs.id);
    }
  }

  return json({ ok: true, type: body.type, event: m.event, campaign_id: campaignId });
});
