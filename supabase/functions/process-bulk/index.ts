// Kobly — Edge Function `process-bulk` (worker do disparo em massa).
// Drena bulk_send_recipients 'pendente' (run_at<=now) de cabeçalhos 'enviando',
// envia pelo canal (Resend / Z-API / Twilio) e concilia os contadores. Separado
// do process-steps (recuperação) para não disputar o mesmo orçamento por minuto.
// verify_jwt=false (chamada por pg_cron, mesma rota da 0015).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const MAX_ATTEMPTS = 4;
const BATCH = 100;
const CLAIM_HOLD_MIN = 3; // linha fica 'processando' por até 3min; depois é reciclada (crash-safe)

function extractEmail(s: string | null): string | null {
  if (!s) return null;
  const m = String(s).match(/<([^>]+)>/);
  return (m ? m[1] : String(s)).trim() || null;
}
function fromNameSafe(n: string | null | undefined): string {
  return String(n || "").replace(/["<>\\]/g, "").replace(/,/g, " ").trim() || "Koblay";
}
function normalizePhone(raw: string): string {
  const digits = String(raw).replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 11 ? `55${digits}` : digits;
}
function subst(text: string, lead: any): string {
  return String(text || "")
    .split("{{nome}}").join(lead?.nome || "")
    .split("{{cta_link}}").join(""); // bulk não tem link de recuperação por lead
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const now = new Date();

  // Secrets (uma vez por varredura).
  const { data: resendKey } = await sb.rpc("get_secret", { p_name: "resend_api_key" });
  const { data: resendFrom } = await sb.rpc("get_secret", { p_name: "resend_from" });
  const { data: sendingDomainRaw } = await sb.rpc("get_secret", { p_name: "resend_sending_domain" });
  const platformSenderEmail = extractEmail(resendFrom) || "onboarding@resend.dev";
  const sendingDomain = (sendingDomainRaw && String(sendingDomainRaw).trim()) || null;
  // Remetente por org (mesma prioridade do process-steps): domínio próprio verificado
  // > subdomínio da plataforma (<sender_local>@sendingDomain) > fallback resend_from.
  const senderCache = new Map<string, string>();
  const resolveSender = async (orgId: string): Promise<string> => {
    if (senderCache.has(orgId)) return senderCache.get(orgId)!;
    const { data: dom } = await sb.from("domains")
      .select("from_email, url, status, id_resend")
      .eq("organization_id", orgId).eq("status", "verified")
      .not("id_resend", "is", null).not("id_resend", "like", "sg%")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    let addr: string | null = null;
    if (dom) addr = extractEmail(dom.from_email) || (dom.url ? `contato@${dom.url}` : null);
    if (!addr && sendingDomain) {
      const { data: o } = await sb.from("organizations").select("sender_local").eq("id", orgId).maybeSingle();
      if (o?.sender_local) addr = `${o.sender_local}@${sendingDomain}`;
    }
    if (!addr) addr = platformSenderEmail;
    senderCache.set(orgId, addr);
    return addr;
  };
  const { data: zapiInstanceId } = await sb.rpc("get_secret", { p_name: "zapi_instance_id" });
  const { data: zapiToken } = await sb.rpc("get_secret", { p_name: "zapi_token" });
  const { data: zapiClientToken } = await sb.rpc("get_secret", { p_name: "zapi_client_token" });
  const { data: twilioSid } = await sb.rpc("get_secret", { p_name: "twilio_account_sid" });
  const { data: twilioAuth } = await sb.rpc("get_secret", { p_name: "twilio_auth_token" });
  const { data: twilioFrom } = await sb.rpc("get_secret", { p_name: "twilio_from" });

  // 0) Recicla linhas 'processando' presas (crash de tick anterior): ao reivindicar,
  //    empurramos run_at p/ +3min; se ainda estão 'processando' com run_at vencido, o
  //    tick que as pegou morreu — voltam p/ 'pendente'.
  await sb.from("bulk_send_recipients").update({ status: "pendente" })
    .eq("status", "processando").lte("run_at", now.toISOString());

  // 1) Busca destinatários devidos de cabeçalhos 'enviando'.
  const { data: due, error } = await sb.from("bulk_send_recipients")
    .select("id, bulk_send_id, organization_id, lead_id, destino, attempts, bulk_sends!inner(id, canal, email_id, whatsapp_message_id, sms_message_id, status), leads(nome, email, telefone)")
    .eq("status", "pendente")
    .lte("run_at", now.toISOString())
    .eq("bulk_sends.status", "enviando")
    .limit(BATCH);
  if (error) return json({ error: "query_failed", detail: error.message }, 500);

  const templateCache = new Map<string, any>();
  const loadTemplate = async (header: any) => {
    if (templateCache.has(header.id)) return templateCache.get(header.id);
    let tpl: any = null;
    if (header.canal === "email" && header.email_id) {
      const { data } = await sb.from("emails").select("assunto, corpo_html, remetente").eq("id", header.email_id).maybeSingle();
      tpl = data;
    } else if (header.canal === "Whatsapp" && header.whatsapp_message_id) {
      const { data } = await sb.from("whatsapp_messages").select("titulo, corpo_texto").eq("id", header.whatsapp_message_id).maybeSingle();
      tpl = data;
    } else if (header.canal === "SMS" && header.sms_message_id) {
      const { data } = await sb.from("sms_messages").select("titulo, corpo_texto").eq("id", header.sms_message_id).maybeSingle();
      tpl = data;
    }
    templateCache.set(header.id, tpl);
    return tpl;
  };

  const touched = new Set<string>();
  let sent = 0, failed = 0, skipped = 0;

  for (const r of due || []) {
    const header = (r as any).bulk_sends; const lead = (r as any).leads;
    touched.add(r.bulk_send_id);

    // Claim otimista: só prossegue quem virar 'processando' (evita duplo-envio em ticks sobrepostos).
    const holdUntil = new Date(Date.now() + CLAIM_HOLD_MIN * 60000).toISOString();
    const { data: claimed } = await sb.from("bulk_send_recipients")
      .update({ status: "processando", run_at: holdUntil })
      .eq("id", r.id).eq("status", "pendente").select("id");
    if (!claimed || claimed.length === 0) continue; // outro tick pegou

    const attempts = Number((r as any).attempts) || 0;
    const tpl = await loadTemplate(header);
    if (!tpl) {
      await sb.from("bulk_send_recipients").update({ status: "pulado", last_error: "template não encontrado" }).eq("id", r.id);
      skipped++; continue;
    }

    let ok = false, msgId: string | null = null, errDetail: string | null = null, fatal = false;
    const canal = header.canal;
    const destino = r.destino;

    if (canal === "email") {
      if (!destino) { fatal = true; errDetail = "sem e-mail"; }
      else if (!resendKey) { errDetail = "resend_api_key ausente"; }
      else {
        const html = subst(tpl.corpo_html || "<p></p>", lead);
        const fromHeader = `${fromNameSafe(tpl.remetente || "Koblay")} <${await resolveSender(r.organization_id)}>`;
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: fromHeader, to: [destino], subject: tpl.assunto || "Koblay", html }),
        });
        const out = await resp.json().catch(() => ({}));
        ok = resp.ok; msgId = out?.id ?? null; if (!ok) { errDetail = JSON.stringify(out).slice(0, 200); if (resp.status >= 400 && resp.status < 500 && resp.status !== 429) fatal = true; }
      }
    } else if (canal === "Whatsapp") {
      if (!destino) { fatal = true; errDetail = "sem telefone"; }
      else if (!zapiInstanceId || !zapiToken) { errDetail = "zapi secrets ausentes"; }
      else {
        const zapiBase = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}`;
        const zapiHeaders = { "Content-Type": "application/json", ...(zapiClientToken ? { "Client-Token": String(zapiClientToken) } : {}) };
        const message = subst(tpl.corpo_texto || tpl.titulo || "", lead);
        const resp = await fetch(`${zapiBase}/send-text`, { method: "POST", headers: zapiHeaders, body: JSON.stringify({ phone: normalizePhone(destino), message }) });
        const out = await resp.json().catch(() => ({}));
        ok = resp.ok; msgId = out?.messageId ?? out?.id ?? out?.zaapId ?? null; if (!ok) errDetail = JSON.stringify(out).slice(0, 200);
      }
    } else if (canal === "SMS") {
      if (!destino) { fatal = true; errDetail = "sem telefone"; }
      else if (!twilioSid || !twilioAuth || !twilioFrom) { errDetail = "twilio secrets ausentes"; }
      else {
        const message = subst(tpl.corpo_texto || tpl.titulo || "", lead);
        const form = new URLSearchParams({ From: String(twilioFrom), To: `+${normalizePhone(destino)}`, Body: message });
        const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
          method: "POST",
          headers: { Authorization: `Basic ${btoa(`${twilioSid}:${twilioAuth}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
          body: form.toString(),
        });
        const out = await resp.json().catch(() => ({}));
        ok = resp.ok; msgId = out?.sid ?? null; if (!ok) { errDetail = JSON.stringify(out).slice(0, 200); if (resp.status >= 400 && resp.status < 500) fatal = true; }
      }
    } else { fatal = true; errDetail = "canal desconhecido"; }

    // Auditoria/métrica: email_events com campaign_id NULL (não contamina "recuperado").
    const chan = canal === "email" ? "email" : canal === "SMS" ? "sms" : "whatsapp";
    await sb.from("email_events").insert({
      organization_id: r.organization_id, campaign_id: null, event: "send", channel: chan,
      email: lead?.email ?? destino, status: ok ? "enviado" : "falhou", sg_message_id: msgId, reason: errDetail, "timestamp": new Date().toISOString(),
    });

    if (ok) {
      await sb.from("bulk_send_recipients").update({ status: "enviado", sg_message_id: msgId, sent_at: new Date().toISOString(), attempts: attempts + 1, last_error: null }).eq("id", r.id);
      sent++;
    } else if (fatal || attempts + 1 >= MAX_ATTEMPTS) {
      await sb.from("bulk_send_recipients").update({ status: "falhou", attempts: attempts + 1, last_error: errDetail }).eq("id", r.id);
      failed++;
    } else {
      // Retry: volta p/ pendente com backoff linear.
      const nextRun = new Date(Date.now() + 5 * 60000 * (attempts + 1)).toISOString();
      await sb.from("bulk_send_recipients").update({ status: "pendente", attempts: attempts + 1, last_error: errDetail, run_at: nextRun }).eq("id", r.id);
      failed++;
    }
  }

  // 2) Concilia contadores dos cabeçalhos tocados (autoritativo, evita race de incrementos)
  //    e marca 'concluido' quando não há mais pendente/processando.
  for (const bulkId of touched) {
    const counts = { enviado: 0, falhou: 0, pulado: 0, pendente: 0, processando: 0 } as Record<string, number>;
    const { data: rows } = await sb.from("bulk_send_recipients").select("status").eq("bulk_send_id", bulkId);
    for (const row of rows || []) counts[(row as any).status] = (counts[(row as any).status] || 0) + 1;
    const patch: Record<string, unknown> = {
      enviados: counts.enviado, falhados: counts.falhou, pulados: counts.pulado, updated_at: new Date().toISOString(),
    };
    if ((counts.pendente + counts.processando) === 0) patch.status = "concluido";
    // Só rebaixa status se ainda estiver 'enviando' (não sobrescreve 'cancelado').
    const { data: hdr } = await sb.from("bulk_sends").select("status").eq("id", bulkId).maybeSingle();
    if (hdr?.status === "cancelado") { delete patch.status; }
    await sb.from("bulk_sends").update(patch).eq("id", bulkId);
  }

  return json({ ok: true, due: (due || []).length, sent, failed, skipped, headers: touched.size });
});
