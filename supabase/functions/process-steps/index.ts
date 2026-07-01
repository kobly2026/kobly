// Kobly — Edge Function `process-steps` (worker da fila do motor).
// Varre scheduled_steps DEVIDAS (status Iniciado/Em andamento e run_at <= now()) e executa:
//  - Envio de e-mail: resolve email_id → envia via Resend → grava email_events + incrementa
//    lead_metrics e campaign_stats.emails_enviados (SÓ em sucesso) → marca Finalizado.
//  - Envio de WhatsApp: resolve whatsapp_message_id → envia via Z-API → grava email_events
//    (channel='whatsapp') + lead_metrics.enviados e campaign_stats.whatsapp_enviados
//    (métrica por canal; NÃO toca emails_enviados) → marca Finalizado.
//  - Adicionar/Remover Tag: muta lead_tags → marca Finalizado.
// CONDIÇÃO (IF/ELSE do fluxo): cards de envio podem ter flow_steps.condicao
// ('comprou' | 'nao_comprou'), avaliada AQUI na hora do envio contra os
// webhook_events "Compra Aprovada" do lead desde o início desta execução
// (scheduled_steps.created_at). Não atendida → finaliza como "pulado" (sem
// envio, sem métrica, sem retry) — quem pagou no meio da cadência para de
// receber recuperação e pode receber o agradecimento do mesmo fluxo.
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

// Extrai só o endereço de "Nome <email>" ou de um e-mail puro.
function extractEmail(s: string | null): string | null {
  if (!s) return null;
  const m = String(s).match(/<([^>]+)>/);
  return (m ? m[1] : String(s)).trim() || null;
}
// Sanitiza o nome de exibição do remetente (remove aspas/< >/vírgula que quebram o header From).
function fromNameSafe(n: string | null | undefined): string {
  return String(n || "").replace(/["<>\\]/g, "").replace(/,/g, " ").trim() || "Koblay";
}
// Normaliza telefone p/ E.164 sem '+': só dígitos; 10-11 dígitos (BR sem DDI) → prefixa 55.
// Mesma regra da edge function send-whatsapp.
function normalizePhone(raw: string): string {
  const digits = String(raw).replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 11 ? `55${digits}` : digits;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: apiKey } = await sb.rpc("get_secret", { p_name: "resend_api_key" });
  const { data: fromCfg } = await sb.rpc("get_secret", { p_name: "resend_from" });
  // Só o endereço do remetente vem da config (domínio verificado); o NOME de exibição
  // é o da marca do cliente (loja), resolvido por e-mail/org logo abaixo.
  const senderEmail = extractEmail(fromCfg) || "onboarding@resend.dev";
  // Credenciais Z-API (canal WhatsApp) — resolvidas UMA vez por varredura, como o Resend.
  // Client-Token (conta) é OPCIONAL: header enviado só se a secret existir (a conta
  // atual não o exige — mesma regra da edge function send-whatsapp).
  const { data: zapiInstanceId } = await sb.rpc("get_secret", { p_name: "zapi_instance_id" });
  const { data: zapiToken } = await sb.rpc("get_secret", { p_name: "zapi_token" });
  const { data: zapiClientToken } = await sb.rpc("get_secret", { p_name: "zapi_client_token" });

  const { data: due, error } = await sb.from("scheduled_steps")
    .select("id, organization_id, lead_id, attempts, created_at, flow_steps(id, tipo_card, email_id, whatsapp_message_id, flow_id, condicao), leads(id, email, nome, telefone, link_recuperacao)")
    .in("status_agendamento", ["Iniciado", "Em andamento"])
    .lte("run_at", new Date().toISOString())
    .limit(100);
  if (error) return json({ error: "query_failed", detail: error.message }, 500);

  let processed = 0, sent = 0, tagged = 0, failed = 0, retried = 0, gaveup = 0, skipped = 0;

  // Avalia a condição do card no MOMENTO do envio: o lead teve "Compra Aprovada"
  // desde que esta execução do fluxo começou (created_at do agendamento)?
  const condicaoAtendida = async (s: any, condicao: string | null) => {
    if (!condicao || condicao === "sempre") return true;
    const { count } = await sb.from("webhook_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", s.organization_id)
      .eq("lead_id", s.lead_id)
      .eq("tipo_evento", "Compra Aprovada")
      .gte("created_at", s.created_at);
    const comprou = (count ?? 0) > 0;
    return condicao === "comprou" ? comprou : !comprou;
  };

  // Marca da org por conta: nome (remetente) + URL de fallback do botão (aba Marca).
  const orgBrandCache = new Map<string, { nome: string | null; link: string | null }>();
  const getOrgBrand = async (org: string) => {
    if (orgBrandCache.has(org)) return orgBrandCache.get(org)!;
    const { data } = await sb.from("org_branding").select("nome, link_loja").eq("organization_id", org).maybeSingle();
    const brand = { nome: (data?.nome as string) || null, link: (data?.link_loja as string) || null };
    orgBrandCache.set(org, brand);
    return brand;
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
        // IF/ELSE do fluxo: condição não atendida → pula sem enviar (e sem retry).
        if (!(await condicaoAtendida(s, step.condicao ?? null))) {
          await finalize(s.id, curAttempts + 1, `pulado: condição '${step.condicao}' não atendida`);
          skipped++; processed++;
          continue;
        }
        // resolve a campanha (p/ stats) via flow → campaign
        let campaignId: string | null = null;
        if (step.flow_id) {
          const { data: cf } = await sb.from("campaign_flows").select("campaign_id").eq("id", step.flow_id).maybeSingle();
          campaignId = cf?.campaign_id ?? null;
        }
        const { data: em } = await sb.from("emails").select("assunto, corpo_html, remetente").eq("id", step.email_id).maybeSingle();
        const brand = await getOrgBrand(s.organization_id);
        // Resolve o destino do botão: link do lead (do postback) > URL da loja (org) > '#'.
        const ctaLink = lead.link_recuperacao || brand.link || "#";
        const html = (em?.corpo_html || "<p></p>").split("{{cta_link}}").join(ctaLink);
        // Remetente: NOME da marca do cliente (do e-mail ou da org) + endereço do domínio verificado.
        const from = `${fromNameSafe(em?.remetente || brand.nome)} <${senderEmail}>`;
        let ok = false, msgId: string | null = null, errDetail: string | null = null;
        if (apiKey) {
          const resp = await fetch("https://api.resend.com/emails", {
            method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from, to: [lead.email], subject: em?.assunto || "Koblay", html }),
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
      } else if (step?.tipo_card === "Envio de WhatsApp" && step.whatsapp_message_id && lead?.telefone) {
        // IF/ELSE do fluxo: mesma avaliação de condição do e-mail.
        if (!(await condicaoAtendida(s, step.condicao ?? null))) {
          await finalize(s.id, curAttempts + 1, `pulado: condição '${step.condicao}' não atendida`);
          skipped++; processed++;
          continue;
        }
        // resolve a campanha (p/ stats) via flow → campaign — mesmo caminho do e-mail
        let campaignId: string | null = null;
        if (step.flow_id) {
          const { data: cf } = await sb.from("campaign_flows").select("campaign_id").eq("id", step.flow_id).maybeSingle();
          campaignId = cf?.campaign_id ?? null;
        }
        const { data: wm } = await sb.from("whatsapp_messages").select("titulo, corpo_texto").eq("id", step.whatsapp_message_id).maybeSingle();
        const brand = await getOrgBrand(s.organization_id);
        // Mesmo destino do botão do e-mail: link do lead (postback) > URL da loja (org) > '#'.
        const ctaLink = lead.link_recuperacao || brand.link || "#";
        const message = String(wm?.corpo_texto || wm?.titulo || "").split("{{cta_link}}").join(ctaLink);
        let ok = false, msgId: string | null = null, errDetail: string | null = null;
        let semWhatsapp = false; // número não existe no WhatsApp → falha DEFINITIVA (sem retry)
        if (zapiInstanceId && zapiToken) {
          const zapiBase = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}`;
          const zapiHeaders = { "Content-Type": "application/json", ...(zapiClientToken ? { "Client-Token": zapiClientToken } : {}) };
          // Resolve o número CANÔNICO via phone-exists: números BR antigos são
          // registrados SEM o nono dígito — mandar pro formato com 9 é aceito
          // (devolve id) mas NÃO entrega. Checagem indisponível → segue normalizado.
          let target = normalizePhone(lead.telefone);
          try {
            const chk = await fetch(`${zapiBase}/phone-exists/${target}`, { headers: zapiHeaders });
            const chkOut = await chk.json().catch(() => ({}));
            if (chk.ok && chkOut) {
              if (chkOut.exists === false) semWhatsapp = true;
              else if (typeof chkOut.phone === "string" && chkOut.phone) target = chkOut.phone;
            }
          } catch (_) { /* segue com o número normalizado */ }
          if (!semWhatsapp) {
            const resp = await fetch(`${zapiBase}/send-text`, {
              method: "POST", headers: zapiHeaders,
              body: JSON.stringify({ phone: target, message }),
            });
            const out = await resp.json().catch(() => ({}));
            // Prefere o messageId (id do WhatsApp): o callback de status da Z-API manda
            // esse id em ids[], nunca o zaapId — é ele que casa o envio no zapi-webhook.
            ok = resp.ok; msgId = out?.messageId ?? out?.id ?? out?.zaapId ?? null; if (!ok) errDetail = JSON.stringify(out).slice(0, 200);
          } else { errDetail = "número sem WhatsApp"; }
        } else { errDetail = "zapi secrets ausentes"; }

        // Registra o evento SEMPRE (auditoria de tentativas) — mesmo trilho do e-mail,
        // com channel='whatsapp'; email do lead mantém o rastreio por lead.
        await sb.from("email_events").insert({
          organization_id: s.organization_id, campaign_id: campaignId, event: "send", channel: "whatsapp",
          email: lead.email, status: ok ? "enviado" : "falhou", sg_message_id: msgId, reason: errDetail, "timestamp": new Date().toISOString(),
        });

        if (ok) {
          // Incrementa métricas SÓ quando a mensagem realmente saiu.
          const { data: lm } = await sb.from("lead_metrics").select("id, enviados").eq("lead_id", lead.id).limit(1).maybeSingle();
          if (lm) await sb.from("lead_metrics").update({ enviados: (Number(lm.enviados) || 0) + 1 }).eq("id", lm.id);
          else await sb.from("lead_metrics").insert({ lead_id: lead.id, organization_id: s.organization_id, enviados: 1 });
          if (campaignId) {
            // Métrica por CANAL: WhatsApp incrementa whatsapp_enviados (coluna da migration
            // 0021), NUNCA emails_enviados — que é o denominador de taxa_abertura/ctr e
            // seria deflacionado por envios de WhatsApp.
            const { data: cs } = await sb.from("campaign_stats").select("id, whatsapp_enviados").eq("campaign_id", campaignId).maybeSingle();
            if (cs) await sb.from("campaign_stats").update({ whatsapp_enviados: (Number(cs.whatsapp_enviados) || 0) + 1, ultimo_calculo: new Date().toISOString() }).eq("id", cs.id);
          }
          await finalize(s.id, curAttempts + 1);
          sent++; processed++;
        } else if (semWhatsapp) {
          // Número não existe no WhatsApp → falha DEFINITIVA: finaliza sem retry
          // (reagendar não muda nada; auditoria fica no email_events 'falhou').
          await finalize(s.id, curAttempts + 1, errDetail);
          failed++; processed++;
        } else {
          // Falha de envio → reagenda (não descarta) até o teto (mesmo backoff do e-mail).
          const r = await failStep(s.id, curAttempts, errDetail);
          if (r === "gaveup") gaveup++; else retried++;
          failed++;
        }
      } else if (step?.tipo_card === "Envio de WhatsApp" && !lead?.telefone) {
        // Lead sem telefone → finaliza com erro registrado (não fica em loop, não conta envio).
        await finalize(s.id, curAttempts + 1, "lead sem telefone");
        processed++;
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

  return json({ ok: true, devidas: (due || []).length, processed, sent, tagged, failed, retried, gaveup, skipped });
});
