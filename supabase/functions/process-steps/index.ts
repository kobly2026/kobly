// Kobly — Edge Function `process-steps` (worker da fila do motor).
// Varre scheduled_steps DEVIDAS (status Iniciado/Em andamento e run_at <= now()) e executa:
//  - Envio de e-mail: resolve email_id → envia via Resend → grava email_events + incrementa
//    lead_metrics e campaign_stats.emails_enviados (SÓ em sucesso) → marca Finalizado.
//  - Adicionar/Remover Tag: muta lead_tags → marca Finalizado.
// RETRY: se o envio FALHA (erro do Resend, exceção), NÃO finaliza — reagenda com backoff e
// attempts++, até MAX_ATTEMPTS; só então desiste (Finalizado + last_error). Isso evita perder
// e-mail de recuperação por soluço transitório do Resend (ex.: 500 application_error).
// Em produção é chamada por pg_cron a cada minuto.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const MAX_ATTEMPTS = 4;        // tentativas totais antes de desistir
const RETRY_BACKOFF_MIN = 5;   // backoff linear: 5min, 10min, 15min...

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: apiKey } = await sb.rpc("get_secret", { p_name: "resend_api_key" });
  const { data: fromCfg } = await sb.rpc("get_secret", { p_name: "resend_from" });
  const sender = fromCfg || "Kobly <onboarding@resend.dev>";

  const { data: due, error } = await sb.from("scheduled_steps")
    .select("id, organization_id, lead_id, attempts, flow_steps(id, tipo_card, email_id, flow_id), leads(id, email, nome, link_recuperacao)")
    .in("status_agendamento", ["Iniciado", "Em andamento"])
    .lte("run_at", new Date().toISOString())
    .limit(100);
  if (error) return json({ error: "query_failed", detail: error.message }, 500);

  let processed = 0, sent = 0, tagged = 0, failed = 0, retried = 0, gaveup = 0;

  // Fallback do link do botão por org (URL da loja/checkout configurada na aba Marca).
  const orgLinkCache = new Map<string, string | null>();
  const getOrgLink = async (org: string): Promise<string | null> => {
    if (orgLinkCache.has(org)) return orgLinkCache.get(org)!;
    const { data } = await sb.from("org_branding").select("link_loja").eq("organization_id", org).maybeSingle();
    const link = (data?.link_loja as string) || null;
    orgLinkCache.set(org, link);
    return link;
  };

  // Finaliza a etapa (sucesso ou desistência definitiva).
  const finalize = (id: string, attempts: number, lastError: string | null = null) =>
    sb.from("scheduled_steps").update({ status_agendamento: "Finalizado", attempts, last_error: lastError }).eq("id", id);

  // Reagenda a etapa p/ nova tentativa (backoff) ou desiste se estourou o teto.
  // Retorna 'retry' | 'gaveup'.
  const failStep = async (id: string, curAttempts: number, lastError: string | null) => {
    const attempts = curAttempts + 1;
    if (attempts >= MAX_ATTEMPTS) { await finalize(id, attempts, lastError); return "gaveup"; }
    const nextRun = new Date(Date.now() + RETRY_BACKOFF_MIN * 60000 * attempts).toISOString();
    await sb.from("scheduled_steps").update({ status_agendamento: "Em andamento", attempts, last_error: lastError, run_at: nextRun }).eq("id", id);
    return "retry";
  };

  for (const s of due || []) {
    const step = (s as any).flow_steps; const lead = (s as any).leads;
    const curAttempts = Number((s as any).attempts) || 0;
    try {
      if (step?.tipo_card === "Envio de e-mail" && step.email_id && lead?.email) {
        // resolve a campanha (p/ stats) via flow → campaign
        let campaignId: string | null = null;
        if (step.flow_id) {
          const { data: cf } = await sb.from("campaign_flows").select("campaign_id").eq("id", step.flow_id).maybeSingle();
          campaignId = cf?.campaign_id ?? null;
        }
        const { data: em } = await sb.from("emails").select("assunto, corpo_html, remetente").eq("id", step.email_id).maybeSingle();
        // Resolve o destino do botão: link do lead (do postback) > URL da loja (org) > '#'.
        const ctaLink = lead.link_recuperacao || (await getOrgLink(s.organization_id)) || "#";
        const html = (em?.corpo_html || "<p></p>").split("{{cta_link}}").join(ctaLink);
        let ok = false, msgId: string | null = null, errDetail: string | null = null;
        if (apiKey) {
          const resp = await fetch("https://api.resend.com/emails", {
            method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from: sender, to: [lead.email], subject: em?.assunto || "Kobly", html }),
          });
          const out = await resp.json().catch(() => ({}));
          ok = resp.ok; msgId = out?.id ?? null; if (!ok) errDetail = JSON.stringify(out).slice(0, 200);
        } else { errDetail = "resend_api_key ausente"; }

        // Registra o evento SEMPRE (auditoria de tentativas).
        await sb.from("email_events").insert({
          organization_id: s.organization_id, campaign_id: campaignId, event: "send",
          email: lead.email, status: ok ? "enviado" : "falhou", sg_message_id: msgId, reason: errDetail, "timestamp": new Date().toISOString(),
        });

        if (ok) {
          // Incrementa métricas SÓ quando o e-mail realmente saiu.
          const { data: lm } = await sb.from("lead_metrics").select("id, enviados").eq("lead_id", lead.id).limit(1).maybeSingle();
          if (lm) await sb.from("lead_metrics").update({ enviados: (Number(lm.enviados) || 0) + 1 }).eq("id", lm.id);
          else await sb.from("lead_metrics").insert({ lead_id: lead.id, organization_id: s.organization_id, enviados: 1 });
          if (campaignId) {
            const { data: cs } = await sb.from("campaign_stats").select("id, emails_enviados").eq("campaign_id", campaignId).maybeSingle();
            if (cs) await sb.from("campaign_stats").update({ emails_enviados: (Number(cs.emails_enviados) || 0) + 1, ultimo_calculo: new Date().toISOString() }).eq("id", cs.id);
          }
          await finalize(s.id, curAttempts + 1);
          sent++; processed++;
        } else {
          // Falha de envio → reagenda (não descarta) até o teto.
          const r = await failStep(s.id, curAttempts, errDetail);
          if (r === "gaveup") gaveup++; else retried++;
          failed++;
        }
      } else if (step?.tipo_card === "Adicionar Tag" && lead?.id) {
        const { data: tags } = await sb.from("step_add_tags").select("tag_id").eq("step_id", step.id);
        for (const t of tags || []) await sb.from("lead_tags").upsert({ lead_id: lead.id, tag_id: t.tag_id });
        await finalize(s.id, curAttempts + 1);
        tagged++; processed++;
      } else if (step?.tipo_card === "Remover Tag" && lead?.id) {
        const { data: tags } = await sb.from("step_remove_tags").select("tag_id").eq("step_id", step.id);
        for (const t of tags || []) await sb.from("lead_tags").delete().eq("lead_id", lead.id).eq("tag_id", t.tag_id);
        await finalize(s.id, curAttempts + 1);
        processed++;
      } else {
        // Tipo de card sem ação de envio (ex.: Gatilho enfileirado por engano, Acionar Fluxo)
        // → finaliza p/ não ficar em loop na fila.
        await finalize(s.id, curAttempts + 1);
        processed++;
      }
    } catch (e) {
      // Exceção inesperada → trata como falha com retry (não descarta).
      const r = await failStep(s.id, curAttempts, String(e).slice(0, 200));
      if (r === "gaveup") gaveup++; else retried++;
      failed++;
    }
  }

  return json({ ok: true, devidas: (due || []).length, processed, sent, tagged, failed, retried, gaveup });
});
