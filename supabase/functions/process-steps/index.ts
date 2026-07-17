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
  const { data: sendingDomainRaw } = await sb.rpc("get_secret", { p_name: "resend_sending_domain" });
  // Só o endereço do remetente vem da config (domínio verificado da plataforma);
  // por org, se houver domain validado, usa domains.from_email. Nome = campo remetente.
  const platformSenderEmail = extractEmail(fromCfg) || "onboarding@resend.dev";
  // Subdomínio de envio da plataforma, verificado UMA vez no Resend (ex.: envio.koblay.io).
  // Se definido, cada org envia de <sender_local>@<sendingDomain> — remetente único e
  // branded, SEM nenhum DNS do lado do cliente.
  const sendingDomain = (sendingDomainRaw && String(sendingDomainRaw).trim()) || null;
  const senderEmailCache = new Map<string, string>();
  const resolveSenderEmail = async (orgId: string) => {
    if (senderEmailCache.has(orgId)) return senderEmailCache.get(orgId)!;
    // Prioridade do remetente:
    // 1) Domínio PRÓPRIO do cliente, realmente verificado no Resend (id real, não 'sg_*').
    //    Domínios legados migrados do SendGrid têm id_resend 'sg_*' (0035) e NUNCA foram
    //    verificados no Resend — usá-los faria o Resend recusar (403 "domain not verified").
    const { data: dom } = await sb.from("domains")
      .select("from_email, url, status, id_resend")
      .eq("organization_id", orgId)
      .eq("status", "verified")
      .not("id_resend", "is", null)
      .not("id_resend", "like", "sg%")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    let addr: string | null = null;
    if (dom) addr = extractEmail(dom.from_email) || (dom.url ? `contato@${dom.url}` : null);
    // 2) Subdomínio automático da plataforma (zero-DNS por cliente): <sender_local>@<sendingDomain>.
    if (!addr && sendingDomain) {
      const { data: o } = await sb.from("organizations").select("sender_local").eq("id", orgId).maybeSingle();
      if (o?.sender_local) addr = `${o.sender_local}@${sendingDomain}`;
    }
    // 3) Fallback global (remetente da plataforma).
    if (!addr) addr = platformSenderEmail;
    senderEmailCache.set(orgId, addr);
    return addr;
  };
  // Credenciais Z-API (canal WhatsApp) — resolvidas UMA vez por varredura, como o Resend.
  // Client-Token (conta) é OPCIONAL: header enviado só se a secret existir (a conta
  // atual não o exige — mesma regra da edge function send-whatsapp).
  const { data: zapiInstanceId } = await sb.rpc("get_secret", { p_name: "zapi_instance_id" });
  const { data: zapiToken } = await sb.rpc("get_secret", { p_name: "zapi_token" });
  const { data: zapiClientToken } = await sb.rpc("get_secret", { p_name: "zapi_client_token" });
  // Credenciais Twilio (canal SMS) — resolvidas UMA vez por varredura, como Resend/Z-API.
  const { data: twilioSid } = await sb.rpc("get_secret", { p_name: "twilio_account_sid" });
  const { data: twilioAuth } = await sb.rpc("get_secret", { p_name: "twilio_auth_token" });
  const { data: twilioFrom } = await sb.rpc("get_secret", { p_name: "twilio_from" });

  // MARCA-1: inclui campaigns.brand_id na cadeia para resolver a marca da campanha
  // (flow_steps → campaign_flows → campaigns.brand_id). NULL = marca padrão da org.
  const { data: due, error } = await sb.from("scheduled_steps")
    .select("id, organization_id, lead_id, attempts, created_at, flow_steps(id, tipo_card, email_id, whatsapp_message_id, sms_message_id, flow_id, condicao, campaign_flows!flow_id(campaign_id, campaigns(brand_id))), leads(id, email, nome, telefone, link_recuperacao)")
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

  // MARCA-1: resolve a marca — por brand_id (campanha vinculada) ou fallback da org
  // (1º brand). Cache por brandId + por orgId. Antes lia org_branding (1:1); agora
  // lê brands (1:N). Se a campanha tem brand_id, usa aquela marca; senão a padrão.
  const brandCache = new Map<string, { nome: string | null; link: string | null }>();
  const resolveBrand = async (org: string, brandId: string | null) => {
    // Tenta pelo brand_id específico da campanha (MARCA-1).
    if (brandId) {
      const ck = `b:${brandId}`;
      if (brandCache.has(ck)) return brandCache.get(ck)!;
      const { data } = await sb.from("brands").select("nome, link_loja").eq("id", brandId).maybeSingle();
      const brand = { nome: (data?.nome as string) || null, link: (data?.link_loja as string) || null };
      brandCache.set(ck, brand);
      return brand;
    }
    // Fallback: 1º brand da org (retrocompatível).
    const ck = `o:${org}`;
    if (brandCache.has(ck)) return brandCache.get(ck)!;
    const { data } = await sb.from("brands").select("nome, link_loja").eq("organization_id", org).order("ordem").limit(1).maybeSingle();
    const brand = { nome: (data?.nome as string) || null, link: (data?.link_loja as string) || null };
    brandCache.set(ck, brand);
    return brand;
  };
  // Extrai o brand_id da campanha a partir do step (join flow_steps→campaign_flows→campaigns).
  const brandIdOf = (s: any): string | null => {
    const cf = s?.flow_steps?.campaign_flows;
    const camp = Array.isArray(cf) ? cf[0] : cf;
    return (camp?.campaigns?.brand_id as string) || null;
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
      if (step?.tipo_card === "Envio de e-mail" && (!step.email_id || !lead?.email)) {
        // Sem template ou lead sem e-mail → finaliza com erro (não fica preso na fila).
        await finalize(s.id, curAttempts + 1, !step.email_id ? "etapa sem e-mail vinculado" : "lead sem e-mail");
        failed++; processed++;
        continue;
      }
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
        if (!em) {
          await finalize(s.id, curAttempts + 1, "template de e-mail não encontrado");
          failed++; processed++;
          continue;
        }
        const brand = await resolveBrand(s.organization_id, brandIdOf(s));
        // Resolve o destino do botão: link do lead (do postback) > URL da loja (org) > '#'.
        const ctaLink = lead.link_recuperacao || brand.link || "#";
        const html = (em.corpo_html || "<p></p>").split("{{cta_link}}").join(ctaLink);
        // Remetente: NOME (campo/marca) + e-mail do domínio verificado da org (ou plataforma).
        const senderEmail = await resolveSenderEmail(s.organization_id);
        const from = `${fromNameSafe(em.remetente || brand.nome)} <${senderEmail}>`;
        let ok = false, msgId: string | null = null, errDetail: string | null = null;
        if (apiKey) {
          const resp = await fetch("https://api.resend.com/emails", {
            method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from, to: [lead.email], subject: em.assunto || "Koblay", html }),
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
      } else if (step?.tipo_card === "Envio de WhatsApp" && (!step.whatsapp_message_id || !lead?.telefone)) {
        // Sem template ou lead sem telefone → finaliza com erro (espelha e-mail órfão).
        // (Lead sem telefone também cai aqui se message_id ausente; o ramo só-telefone fica abaixo por retrocompat.)
        await finalize(
          s.id,
          curAttempts + 1,
          !step.whatsapp_message_id ? "etapa sem mensagem WhatsApp vinculada" : "lead sem telefone",
        );
        failed++; processed++;
        continue;
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
        const { data: wm } = await sb.from("whatsapp_messages").select("titulo, corpo_texto, botoes").eq("id", step.whatsapp_message_id).maybeSingle();
        if (!wm) {
          // Template de WhatsApp deletado → finaliza com erro (espelha o e-mail órfão ~171).
          // Antes caía em message="" e postava um send-text vazio, queimando 4 tentativas.
          await finalize(s.id, curAttempts + 1, "template de WhatsApp não encontrado");
          failed++; processed++;
          continue;
        }
        const brand = await resolveBrand(s.organization_id, brandIdOf(s));
        // Mesmo destino do botão do e-mail: link do lead (postback) > URL da loja (org) > '#'.
        const ctaLink = lead.link_recuperacao || brand.link || "#";
        const message = String(wm?.corpo_texto || wm?.titulo || "").split("{{cta_link}}").join(ctaLink);
        // Botões interativos (Z-API send-button-actions): resolve {{cta_link}} nas URLs.
        const rawButtons = Array.isArray(wm?.botoes) ? (wm!.botoes as any[]) : [];
        const buttonActions = rawButtons.slice(0, 3).map((b: any, i: number) => {
          const type = String(b?.type || "URL").toUpperCase();
          const label = String(b?.label || "Abrir").slice(0, 20);
          const id = String(b?.id || String(i + 1));
          if (type === "URL") {
            let url = String(b?.url || "{{cta_link}}");
            url = url.split("{{cta_link}}").join(ctaLink);
            if (!/^https?:\/\//i.test(url)) return null;
            return { id, type: "URL", label, url };
          }
          if (type === "CALL") {
            const phone = String(b?.phone || "").replace(/\D/g, "");
            if (!phone) return null;
            return { id, type: "CALL", label, phone };
          }
          if (type === "REPLY") return { id, type: "REPLY", label };
          return null;
        }).filter(Boolean) as Array<Record<string, string>>;
        // Z-API: não misturar REPLY com CALL/URL.
        const hasReply = buttonActions.some((x) => x.type === "REPLY");
        const hasAction = buttonActions.some((x) => x.type === "URL" || x.type === "CALL");
        const buttons = hasReply && hasAction
          ? buttonActions.filter((x) => x.type !== "REPLY")
          : buttonActions;

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
            const endpoint = buttons.length > 0 ? "send-button-actions" : "send-text";
            const payload: Record<string, unknown> = { phone: target, message };
            if (buttons.length > 0) payload.buttonActions = buttons;
            const resp = await fetch(`${zapiBase}/${endpoint}`, {
              method: "POST", headers: zapiHeaders,
              body: JSON.stringify(payload),
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
      } else if (step?.tipo_card === "Envio de SMS" && (!step.sms_message_id || !lead?.telefone)) {
        // Sem template ou lead sem telefone → finaliza com erro (espelha e-mail/WhatsApp órfão).
        await finalize(
          s.id,
          curAttempts + 1,
          !step.sms_message_id ? "etapa sem SMS vinculado" : "lead sem telefone",
        );
        failed++; processed++;
        continue;
      } else if (step?.tipo_card === "Envio de SMS" && step.sms_message_id && lead?.telefone) {
        // IF/ELSE do fluxo: mesma avaliação de condição do e-mail/WhatsApp.
        if (!(await condicaoAtendida(s, step.condicao ?? null))) {
          await finalize(s.id, curAttempts + 1, `pulado: condição '${step.condicao}' não atendida`);
          skipped++; processed++;
          continue;
        }
        let campaignId: string | null = null;
        if (step.flow_id) {
          const { data: cf } = await sb.from("campaign_flows").select("campaign_id").eq("id", step.flow_id).maybeSingle();
          campaignId = cf?.campaign_id ?? null;
        }
        const { data: sm } = await sb.from("sms_messages").select("titulo, corpo_texto").eq("id", step.sms_message_id).maybeSingle();
        if (!sm) {
          // Template de SMS deletado → finaliza com erro (espelha o e-mail/WhatsApp órfão).
          await finalize(s.id, curAttempts + 1, "template de SMS não encontrado");
          failed++; processed++;
          continue;
        }
        const brand = await resolveBrand(s.organization_id, brandIdOf(s));
        const ctaLink = lead.link_recuperacao || brand.link || "";
        // Substitui {{cta_link}} e {{nome}} no corpo do SMS.
        const message = String(sm.corpo_texto || sm.titulo || "")
          .split("{{cta_link}}").join(ctaLink)
          .split("{{nome}}").join(lead.nome || "");

        let ok = false, msgId: string | null = null, errDetail: string | null = null;
        let smsFatal = false; // 4xx do Twilio (nº inválido) → falha DEFINITIVA (sem retry)
        if (twilioSid && twilioAuth && twilioFrom) {
          // Twilio exige E.164 COM '+', form-urlencoded e Basic auth (sid:auth_token).
          const to = `+${normalizePhone(lead.telefone)}`;
          const form = new URLSearchParams({ From: String(twilioFrom), To: to, Body: message });
          const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
            method: "POST",
            headers: {
              Authorization: `Basic ${btoa(`${twilioSid}:${twilioAuth}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: form.toString(),
          });
          const out = await resp.json().catch(() => ({}));
          ok = resp.ok; msgId = out?.sid ?? null;
          if (!ok) {
            errDetail = JSON.stringify(out).slice(0, 200);
            if (resp.status >= 400 && resp.status < 500) smsFatal = true; // nº/param inválido
          }
        } else { errDetail = "twilio secrets ausentes"; }

        await sb.from("email_events").insert({
          organization_id: s.organization_id, campaign_id: campaignId, event: "send", channel: "sms",
          email: lead.email, status: ok ? "enviado" : "falhou", sg_message_id: msgId, reason: errDetail, "timestamp": new Date().toISOString(),
        });

        if (ok) {
          const { data: lm } = await sb.from("lead_metrics").select("id, enviados").eq("lead_id", lead.id).limit(1).maybeSingle();
          if (lm) await sb.from("lead_metrics").update({ enviados: (Number(lm.enviados) || 0) + 1 }).eq("id", lm.id);
          else await sb.from("lead_metrics").insert({ lead_id: lead.id, organization_id: s.organization_id, enviados: 1 });
          if (campaignId) {
            // Métrica por CANAL: SMS incrementa sms_enviados (0038), nunca emails_enviados.
            const { data: cs } = await sb.from("campaign_stats").select("id, sms_enviados").eq("campaign_id", campaignId).maybeSingle();
            if (cs) await sb.from("campaign_stats").update({ sms_enviados: (Number(cs.sms_enviados) || 0) + 1, ultimo_calculo: new Date().toISOString() }).eq("id", cs.id);
          }
          await finalize(s.id, curAttempts + 1);
          sent++; processed++;
        } else if (smsFatal) {
          // Número/param inválido → falha DEFINITIVA: finaliza sem retry.
          await finalize(s.id, curAttempts + 1, errDetail);
          failed++; processed++;
        } else {
          // Falha transitória (5xx/rede/secret) → reagenda com backoff.
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

  return json({ ok: true, devidas: (due || []).length, processed, sent, tagged, failed, retried, gaveup, skipped });
});
