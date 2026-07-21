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
// 4xx é FATAL (não retenta), EXCETO os que não são específicos do destinatário/remetente:
// 401 (chave inválida/rotacionada) e 402 (conta suspensa) são erros GLOBAIS de plataforma
// — tratá-los como fatal mataria em definitivo TODOS os steps devidos no primeiro tick após
// uma rotação de chave, sem janela de recuperação; 408/409/429 são transitórios (timeout,
// conflito, rate limit). Esses cinco continuam com retry/backoff — ver isFatalClientError().
// COTA: cada tentativa reserva 1 unidade antes de disparar; se a tentativa
// termina em definitivo sem entregar (4xx fatal ou gaveup ao esgotar MAX_ATTEMPTS), a
// unidade é ESTORNADA (scheduled_step_release_usage, nunca abaixo de zero).
// Em produção é chamada por pg_cron a cada minuto.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Inlinado de _shared/unsub.ts (parte de assinatura; per-function deploy não empacota ../_shared/).
// Manter semanticamente idêntico a signUnsubToken em _shared/unsub.ts.
function b64url(bytes: Uint8Array): string {
  let s = ""; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function _hmac(secret: string, msg: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg)));
}
async function signUnsubToken(secret: string, orgId: string, email: string, nowMs: number): Promise<string> {
  const payload = `${orgId}:${String(email).toLowerCase()}:${nowMs}`;
  return `${b64url(new TextEncoder().encode(payload))}.${b64url(await _hmac(secret, payload))}`;
}

// Inlinado de _shared/cta.ts (per-function deploy não empacota ../_shared/).
// Manter semanticamente idêntico ao módulo — os testes vivem em _shared/cta_test.ts.
// Canais e-mail e WhatsApp já usam este bloco (resolveCtaLink no destino do
// botão, o gate via devePularPorFaltaDeLink/PULADO_SEM_LINK; WhatsApp também usa
// botoesUsamCta, pois o botão de URL sem url própria cai em {{cta_link}}).
const EVENTOS_RECUPERACAO: ReadonlySet<string> = new Set([
  "Abandono de carrinho", "Pix Gerado", "Boleto Gerado", "Depósito Solicitado", "Compra Recusada",
]);
const PULADO_SEM_LINK = "pulado: sem link de recuperação";
function isUsableCtaLink(v: unknown): boolean {
  if (typeof v !== "string") return false;
  const s = v.trim();
  if (!/^https?:\/\//i.test(s)) return false;
  try { return !!new URL(s).hostname; } catch { return false; }
}
function corpoUsaCta(corpo: string | null | undefined): boolean {
  return typeof corpo === "string" && corpo.includes("{{cta_link}}");
}
function botoesUsamCta(botoes: unknown): boolean {
  if (!Array.isArray(botoes)) return false;
  return botoes.slice(0, 3).some((b: Record<string, unknown> | null) => {
    const type = String(b?.type || "URL").toUpperCase();
    if (type !== "URL") return false;
    return String(b?.url || "{{cta_link}}").includes("{{cta_link}}");
  });
}
function resolveCtaLink(a: {
  eventoCheckoutUrl?: string | null; leadLinkRecuperacao?: string | null;
  brandLink?: string | null; fallback: string;
}): string {
  if (isUsableCtaLink(a.eventoCheckoutUrl)) return String(a.eventoCheckoutUrl).trim();
  if (isUsableCtaLink(a.leadLinkRecuperacao)) return String(a.leadLinkRecuperacao).trim();
  if (isUsableCtaLink(a.brandLink)) return String(a.brandLink).trim();
  return a.fallback;
}
function devePularPorFaltaDeLink(a: {
  usaCta: boolean; tipoEventoGatilho: string | null; linkResolvido: string;
}): boolean {
  if (!a.usaCta) return false;
  if (!a.tipoEventoGatilho || !EVENTOS_RECUPERACAO.has(a.tipoEventoGatilho)) return false;
  return !isUsableCtaLink(a.linkResolvido);
}

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const MAX_ATTEMPTS = 4;        // tentativas totais antes de desistir
const RETRY_BACKOFF_MIN = 5;   // backoff linear: 5min, 10min, 15min...

// Teto de ADIAMENTOS consecutivos por indisponibilidade da CONSULTA de supressão
// (não do resultado — ver isEmailSuppressed). Sem teto, uma consulta cronicamente
// fora do ar faz o step voltar pro topo da fila pra sempre: o claim otimista do
// topo do loop já reagenda +5min por tick sem chamar finalize/failStep, então o
// step nunca vira falha e o contador `deferred` só existe no corpo da resposta
// HTTP (que o pg_cron descarta) — invisível na jornada. Contagem guardada no
// próprio last_error (prefixo abaixo), NÃO em `attempts`: `attempts` alimenta o
// backoff/teto do failStep para tentativas REAIS de envio (MAX_ATTEMPTS=4); usar
// o mesmo contador faria adiamentos por indisponibilidade da supressão consumir
// o orçamento de retry de uma falha real de envio. A contagem se autolimpa: assim
// que qualquer outro caminho do step roda (envio ok, skip, falha real), ele
// sobrescreve last_error via finalize()/failStep() — só o caminho de adiamento
// escreve este marcador. Claim reagenda +5min por tick → 12 ≈ 1h.
const MAX_SUPPRESSION_DEFERRALS = 12;
const SUPPRESSION_DEFER_PREFIX = "supressao_indisponivel:";
const SUPPRESSION_DEFER_RE = /^supressao_indisponivel:(\d+)/;

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
// Formata valor_compra (number) como moeda BRL — SEM Intl (locale pode variar no runtime
// Deno): duas casas decimais fixas, vírgula decimal, ponto de milhar manual. null/undefined/
// não-finito → string vazia (placeholder some do e-mail em vez de virar "R$ NaN").
function formatBRL(valor: number | null | undefined): string {
  const n = Number(valor);
  if (valor === null || valor === undefined || !isFinite(n)) return "";
  const cents = Math.round(n * 100);
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const intPart = Math.floor(abs / 100);
  const decPart = String(abs % 100).padStart(2, "0");
  const intStr = String(intPart).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}R$ ${intStr},${decPart}`;
}
// 4xx que é FATAL (falha DEFINITIVA do destinatário/remetente — ex.: endereço/número
// rejeitado, domínio não verificado) — exclui os que são erro GLOBAL de plataforma
// (401 chave inválida/rotacionada, 402 conta suspensa) ou transitório (408 timeout,
// 409 conflito, 429 rate limit): esses cinco continuam com retry/backoff.
const NON_FATAL_4XX = new Set([401, 402, 408, 409, 429]);
function isFatalClientError(status: number): boolean {
  return status >= 400 && status < 500 && !NON_FATAL_4XX.has(status);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: apiKey } = await sb.rpc("get_secret", { p_name: "resend_api_key" });
  const { data: unsubSecret } = await sb.rpc("get_secret", { p_name: "unsubscribe_secret" });
  // Gate de CTA sem link: DESLIGADO por padrão (secret ausente ou != "true").
  // Ligado só depois que o postback voltar a trazer o link de checkout — antes
  // disso ele pularia em massa os passos de recuperação de Pix. Ler aqui (uma vez
  // por tick) e não por step, para não multiplicar decrypt no Postgres.
  // Erro na RPC (`error` descartado de propósito) também cai no gate DESLIGADO:
  // `data` vem `null`, `gateLigado` fica `false`, e o comportamento é idêntico ao
  // de hoje (envia normalmente) — falha aqui nunca pode virar bloqueio de envio.
  const { data: gateFlag } = await sb.rpc("get_secret", { p_name: "cta_gate_enabled" });
  const gateLigado = String(gateFlag ?? "").trim().toLowerCase() === "true";
  const baseUrl = Deno.env.get("SUPABASE_URL")!;
  const replyCache = new Map<string, string | null>();
  const resolveReplyTo = async (org: string): Promise<string | null> => {
    if (replyCache.has(org)) return replyCache.get(org)!;
    const { data } = await sb.from("organizations").select("reply_to_email").eq("id", org).maybeSingle();
    const v = (data?.reply_to_email && String(data.reply_to_email).trim()) || null;
    replyCache.set(org, v); return v;
  };
  async function isEmailSuppressed(email: string, org: string): Promise<boolean> {
    const e = String(email).toLowerCase();
    const { data, error } = await sb.from("email_suppressions").select("id, organization_id")
      .eq("email", e).or(`organization_id.eq.${org},organization_id.is.null`).limit(1);
    // Falha FECHADA: se a consulta falhar não sabemos se este e-mail está suprimido, e
    // enviar para quem optou por sair não é reversível. Lançar (em vez de devolver false)
    // é capturado pelo try/catch do step e vira reagendamento via failStep — a próxima
    // tentativa reconsulta em vez de assumir "não suprimido" por um erro transitório.
    // NÃO troque isto por "return false" em caso de erro — é exatamente o bug que isto evita.
    if (error) {
      console.error("process-steps: falha ao consultar email_suppressions, tratando como erro do step (fail-closed)", error);
      throw new Error(`suppression_lookup_failed: ${error.message}`);
    }
    return !!(data && data.length);
  }
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
  const { data: twilioApiKey } = await sb.rpc("get_secret", { p_name: "twilio_api_key_sid" });

  // MARCA-1: inclui campaigns.brand_id na cadeia para resolver a marca da campanha
  // (flow_steps → campaign_flows → campaigns.brand_id). NULL = marca padrão da org.
  // CTA-1: webhook_events é a fonte IMUTÁVEL do evento que originou este passo.
  // `leads.ultimo_evento` NÃO serve: é sobrescrito por qualquer postback posterior
  // do mesmo e-mail e divergia do gatilho em 17 de 42 passos (40%) em 21/07 —
  // um passo de Pix cujo lead virou "Compra Aprovada" seria classificado como
  // terminal e escaparia do gate. `checkout_url` idem: o do evento é o daquela
  // transação, o do lead é pegajoso (nunca limpo).
  const { data: due, error } = await sb.from("scheduled_steps")
    .select("id, organization_id, lead_id, webhook_event_id, attempts, last_error, created_at, flow_steps(id, tipo_card, email_id, whatsapp_message_id, sms_message_id, flow_id, condicao, campaign_flows!flow_id(campaign_id, campaigns(brand_id))), leads(id, email, nome, telefone, link_recuperacao, produto, valor_compra), webhook_events(tipo_evento, checkout_url)")
    .in("status_agendamento", ["Iniciado", "Em andamento"])
    .lte("run_at", new Date().toISOString())
    .limit(100);
  if (error) return json({ error: "query_failed", detail: error.message }, 500);

  let processed = 0, sent = 0, tagged = 0, failed = 0, retried = 0, gaveup = 0, skipped = 0, deferred = 0, refunded = 0;

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

  // Reserva 1 unidade da cota do plano ANTES do envio (auditoria E2E — Billing C4:
  // fluxos/automações também consomem cota, não só o disparo em massa). Atômico
  // via bulk_reserve_usage. Devolve o estado REAL da reserva — 'error' NÃO é
  // sinônimo de reservado: é fail-open (deixa enviar, não trava a fila por hiccup
  // do banco), mas sem ter de fato somado ao contador. Achado dos revisores: antes
  // isto devolvia boolean e os chamadores tratavam 'error' como reservado, então o
  // estorno em falha definitiva decrementava numero_execucoes de uma unidade que
  // NUNCA foi somada — o contador ficava abaixo do uso real (deriva de cota). Agora
  // os chamadores só marcam reservedThisAttempt=true quando o retorno é 'reserved'.
  const reserveOne = async (orgId: string): Promise<"reserved" | "denied" | "error"> => {
    const { data, error } = await sb.rpc("bulk_reserve_usage", { p_org: orgId, p_n: 1 });
    if (error) {
      console.error("process-steps: reserveOne RPC (bulk_reserve_usage) falhou, fail-open (deixando enviar, SEM contar como reservado)", orgId, error);
      return "error";
    }
    return data === true ? "reserved" : "denied";
  };

  // Estorna 1 unidade da cota reservada por reserveOne quando a tentativa termina em
  // falha DEFINITIVA (4xx fatal, ou gaveup ao esgotar MAX_ATTEMPTS) — NUNCA em falha
  // transitória que ainda vai ser retentada: a reserva desta tentativa fica de pé, e a
  // PRÓXIMA tentativa (próximo tick) reserva de novo antes de tentar enviar de novo. Sem
  // estorno aqui, um envio que nunca sai queima cota do plano sem entregar nada.
  // scheduled_step_release_usage nunca deixa numero_execucoes ir abaixo de zero.
  const releaseOne = async (orgId: string): Promise<void> => {
    const { error } = await sb.rpc("scheduled_step_release_usage", { p_org: orgId, p_n: 1 });
    if (error) console.error("process-steps: releaseOne RPC (scheduled_step_release_usage) falhou — cota pode ficar presa", orgId, error);
    else refunded++;
  };

  for (const s of due || []) {
    // Claim OTIMISTA (evita envio DUPLICADO se dois ticks do cron se sobrepõem): empurra
    // run_at 5min p/ frente condicionalmente. Se 0 linhas voltarem, outro tick já pegou
    // esta etapa → pula. Se o tick crashar no meio, a linha reaparece após 5min (crash-safe).
    // finalize/failStep sobrescrevem esse run_at ao terminar. Mesmo padrão do process-bulk.
    const nowIso = new Date().toISOString();
    const { data: claimed } = await sb.from("scheduled_steps")
      .update({ status_agendamento: "Em andamento", run_at: new Date(Date.now() + 5 * 60000).toISOString() })
      .eq("id", s.id)
      .in("status_agendamento", ["Iniciado", "Em andamento"])
      .lte("run_at", nowIso)
      .select("id");
    if (!claimed || claimed.length === 0) continue;

    const step = (s as any).flow_steps; const lead = (s as any).leads;
    const curAttempts = Number((s as any).attempts) || 0;
    // true assim que reserveOne() reservar com sucesso NESTA tentativa — usado para
    // decidir se uma desistência definitiva (gaveup, em qualquer ramo — inclusive o
    // catch genérico abaixo) precisa estornar a cota.
    let reservedThisAttempt = false;
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
        // Destino do botão: link do EVENTO gatilho (imutável, daquela transação) >
        // link do lead (só para passo sem webhook_event_id) > URL da loja > '#'.
        // A ordem antiga começava pelo lead, que é pegajoso: comprador recorrente
        // recebia o checkout da compra anterior — parece funcionar e leva a um Pix
        // já pago ou expirado.
        const eventoGatilho = s.webhook_events ?? null;
        const tipoEventoGatilho: string | null = eventoGatilho?.tipo_evento ?? null;
        const ctaLink = resolveCtaLink({
          eventoCheckoutUrl: eventoGatilho?.checkout_url ?? null,
          leadLinkRecuperacao: lead.link_recuperacao,
          brandLink: brand.link,
          fallback: "#",
        });
        // Placeholders do e-mail de fluxo: {{cta_link}} (link de recuperação/loja), {{nome}},
        // {{produto}} (fallback neutro p/ checkout multi-produto sob o mesmo token) e {{valor}}
        // (moeda BRL via formatBRL — nunca deixa o literal chegar cru na caixa do comprador).
        const html = (em.corpo_html || "<p></p>")
          .split("{{cta_link}}").join(ctaLink)
          .split("{{nome}}").join(lead.nome || "")
          .split("{{produto}}").join(lead.produto || "seu pedido")
          .split("{{valor}}").join(formatBRL(lead.valor_compra));
        // Remetente: NOME (campo/marca) + e-mail do domínio verificado da org (ou plataforma).
        const senderEmail = await resolveSenderEmail(s.organization_id);
        const from = `${fromNameSafe(em.remetente || brand.nome)} <${senderEmail}>`;
        // Supressão: destinatário descadastrado (global ou da org) — não conta cota nem envia.
        // Falha na CONSULTA (não no resultado): ADIA sem queimar attempts. O claim
        // otimista do topo do loop já empurrou run_at +5min para este step (Em
        // andamento) — um `continue` aqui (sem finalize/failStep) já basta para
        // reagendá-lo de graça, sem consumir tentativa. Preserva o fail-closed original
        // (nunca envia sem confirmar); só não deixa mais um soluço transitório de
        // consulta desistir do envio em definitivo.
        let suppressed: boolean;
        try {
          suppressed = await isEmailSuppressed(lead.email, s.organization_id);
        } catch (e) {
          // Teto de adiamentos consecutivos (ver MAX_SUPPRESSION_DEFERRALS acima):
          // lê a contagem gravada no último adiamento (se o last_error atual não bate
          // com o prefixo, é a primeira falha nesta sequência — conta 1). Continua
          // "Em andamento" (não finaliza, não falha) em QUALQUER contagem — só muda o
          // texto do last_error ao estourar o teto, pra ficar visível na jornada em
          // vez de girar eternamente sem rastro.
          const prevMatch = SUPPRESSION_DEFER_RE.exec(String((s as any).last_error || ""));
          const deferCount = (prevMatch ? Number(prevMatch[1]) : 0) + 1;
          const overCap = deferCount >= MAX_SUPPRESSION_DEFERRALS;
          const note = overCap
            ? `${SUPPRESSION_DEFER_PREFIX}${deferCount} — consulta de supressão indisponível há ~1h (${deferCount} tentativas consecutivas); step segue ativo, retomará sozinho quando a consulta normalizar`
            : `${SUPPRESSION_DEFER_PREFIX}${deferCount}`;
          console.error("process-steps: falha ao consultar supressão, adiando step sem consumir attempts", s.id, `deferCount=${deferCount}`, String(e).slice(0, 200));
          await sb.from("scheduled_steps").update({ last_error: note }).eq("id", s.id);
          deferred++;
          continue;
        }
        if (suppressed) {
          await finalize(s.id, curAttempts + 1, "pulado: destinatário descadastrado");
          skipped++; processed++;
          continue;
        }
        // CTA sem destino: não enviar. Um e-mail que promete "finalizar seu Pix" e
        // leva para `#` ou para a home queima reputação e frustra o comprador —
        // pior que não mandar. Antes do reserveOne de propósito: passo pulado não
        // pode custar cota. Só vale para evento de recuperação transacional; e-mail
        // não-transacional segue com o fallback de sempre.
        if (gateLigado && devePularPorFaltaDeLink({
          usaCta: corpoUsaCta(em.corpo_html),
          tipoEventoGatilho,
          linkResolvido: ctaLink,
        })) {
          await finalize(s.id, curAttempts + 1, PULADO_SEM_LINK);
          skipped++; processed++;
          continue;
        }
        // Cota do plano: reserva antes de enviar (não conta condição-pulada/órfão).
        const reserveResultEmail = await reserveOne(s.organization_id);
        if (reserveResultEmail === "denied") {
          await finalize(s.id, curAttempts + 1, "pulado: limite do plano atingido");
          skipped++; processed++;
          continue;
        }
        // Só marca reservado quando a RPC de fato reservou ('error' é fail-open: envia
        // mesmo assim, mas sem reserva real — releaseOne() não deve estornar depois).
        reservedThisAttempt = reserveResultEmail === "reserved";
        let ok = false, msgId: string | null = null, errDetail: string | null = null;
        let emailFatal = false; // 4xx definitivo do Resend (ex.: 403 domain is not verified) → sem retry
        if (apiKey) {
          let htmlBody = html;
          let unsubUrl: string | null = null;
          if (unsubSecret) {
            const token = await signUnsubToken(String(unsubSecret), s.organization_id, lead.email, Date.now());
            unsubUrl = `${baseUrl}/functions/v1/unsubscribe?token=${token}`;
            htmlBody = htmlBody.split("{{unsubscribe_url}}").join(unsubUrl)
                               .replace(/href="#"(\s[^>]*>\s*Descadastrar)/i, `href="${unsubUrl}"$1`);
          } else {
            // Sem secret: nunca deixa o literal "{{unsubscribe_url}}" (ou o href="#" morto)
            // ir pro destinatário — melhor um mailto genérico funcional no rodapé.
            htmlBody = htmlBody.split("{{unsubscribe_url}}").join("mailto:unsubscribe@koblay.io")
                               .replace(/href="#"(\s[^>]*>\s*Descadastrar)/i, `href="mailto:unsubscribe@koblay.io"$1`);
          }
          const listUnsub = unsubUrl ? `<${unsubUrl}>, <mailto:unsubscribe@koblay.io>` : `<mailto:unsubscribe@koblay.io>`;
          const replyTo = await resolveReplyTo(s.organization_id);
          // List-Unsubscribe-Post (RFC 8058 one-click) só faz sentido junto de uma URL
          // https clicável; omitido quando só temos o mailto (sem unsubUrl).
          const payload: Record<string, unknown> = {
            from, to: [lead.email], subject: em.assunto || "Koblay", html: htmlBody,
            headers: unsubUrl
              ? { "List-Unsubscribe": listUnsub, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
              : { "List-Unsubscribe": listUnsub },
          };
          if (replyTo) payload.reply_to = replyTo;
          const resp = await fetch("https://api.resend.com/emails", {
            method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const out = await resp.json().catch(() => ({}));
          ok = resp.ok; msgId = out?.id ?? null;
          if (!ok) {
            errDetail = JSON.stringify(out).slice(0, 200);
            // 4xx = definitivo (ex.: 403 domain is not verified) — EXCETO os não
            // específicos do destinatário/remetente (ver isFatalClientError). Espelha o process-bulk.
            if (isFatalClientError(resp.status)) emailFatal = true;
          }
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
        } else if (emailFatal) {
          // 4xx definitivo → finaliza SEM retry (não queima as 4 tentativas à toa) e
          // estorna a unidade de cota já reservada (este envio nunca vai sair). Só
          // estorna se ESTA tentativa de fato reservou (reserveOne 'reserved'); se foi
          // fail-open ('error', nada foi somado), estornar decrementaria o contador
          // abaixo do uso real — mesma regra dos ramos de retry/gaveup abaixo.
          if (reservedThisAttempt) await releaseOne(s.organization_id);
          await finalize(s.id, curAttempts + 1, errDetail);
          failed++; processed++;
        } else {
          // Falha transitória → reagenda (não descarta) até o teto. Só estorna se
          // esgotou as tentativas (gaveup); um retry em andamento mantém a reserva
          // desta tentativa (a próxima tentativa reserva de novo antes de tentar).
          const r = await failStep(s.id, curAttempts, errDetail);
          if (r === "gaveup") { gaveup++; if (reservedThisAttempt) await releaseOne(s.organization_id); } else retried++;
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
        // Mesma prioridade do e-mail: evento gatilho > lead > loja > '#'.
        const eventoGatilho = s.webhook_events ?? null;
        const tipoEventoGatilho: string | null = eventoGatilho?.tipo_evento ?? null;
        const ctaLink = resolveCtaLink({
          eventoCheckoutUrl: eventoGatilho?.checkout_url ?? null,
          leadLinkRecuperacao: lead.link_recuperacao,
          brandLink: brand.link,
          fallback: "#",
        });
        // Mesmos 4 placeholders do e-mail (consistência entre canais do mesmo fluxo).
        const message = String(wm?.corpo_texto || wm?.titulo || "")
          .split("{{cta_link}}").join(ctaLink)
          .split("{{nome}}").join(lead.nome || "")
          .split("{{produto}}").join(lead.produto || "seu pedido")
          .split("{{valor}}").join(formatBRL(lead.valor_compra));
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

        // CTA sem destino: não enviar (mesma regra do e-mail). Fica ANTES do bloco
        // Z-API porque o reserveOne deste canal (abaixo) está depois de uma chamada
        // de rede (phone-exists) e dentro do if de credenciais — pular aqui evita
        // gastar rede num passo que não vai sair, e funciona mesmo sem credencial.
        // `botoesUsamCta`: o botão de URL sem url própria usa {{cta_link}} por
        // default, então o corpo pode não ter o placeholder e ainda assim depender dele.
        if (gateLigado && devePularPorFaltaDeLink({
          usaCta: corpoUsaCta(wm?.corpo_texto) || botoesUsamCta(wm?.botoes),
          tipoEventoGatilho,
          linkResolvido: ctaLink,
        })) {
          await finalize(s.id, curAttempts + 1, PULADO_SEM_LINK);
          skipped++; processed++;
          continue;
        }

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
            const reserveResultWa = await reserveOne(s.organization_id);
            if (reserveResultWa === "denied") {
              // Cota do plano estourada → não envia (número válido, mas sem saldo).
              await finalize(s.id, curAttempts + 1, "pulado: limite do plano atingido");
              skipped++; processed++;
              continue;
            }
            // Só marca reservado quando a RPC de fato reservou (ver reserveOne).
            reservedThisAttempt = reserveResultWa === "reserved";
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
          // Só estorna se esgotou as tentativas (gaveup); retry mantém a reserva desta tentativa.
          const r = await failStep(s.id, curAttempts, errDetail);
          if (r === "gaveup") { gaveup++; if (reservedThisAttempt) await releaseOne(s.organization_id); } else retried++;
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
        // Substitui {{cta_link}} e {{nome}} no corpo do SMS (já existia) + {{produto}} e
        // {{valor}} (novos, mesmos fallbacks do e-mail/WhatsApp).
        const message = String(sm.corpo_texto || sm.titulo || "")
          .split("{{cta_link}}").join(ctaLink)
          .split("{{nome}}").join(lead.nome || "")
          .split("{{produto}}").join(lead.produto || "seu pedido")
          .split("{{valor}}").join(formatBRL(lead.valor_compra));

        // Cota do plano: reserva antes de enviar (mesmo trilho de e-mail/WhatsApp).
        const reserveResultSms = await reserveOne(s.organization_id);
        if (reserveResultSms === "denied") {
          await finalize(s.id, curAttempts + 1, "pulado: limite do plano atingido");
          skipped++; processed++;
          continue;
        }
        // Só marca reservado quando a RPC de fato reservou (ver reserveOne).
        reservedThisAttempt = reserveResultSms === "reserved";
        let ok = false, msgId: string | null = null, errDetail: string | null = null;
        let smsFatal = false; // 4xx do Twilio (nº inválido) → falha DEFINITIVA (sem retry)
        if (twilioSid && twilioAuth && twilioFrom) {
          // Twilio exige E.164 COM '+', form-urlencoded e Basic auth (sid:auth_token).
          const to = `+${normalizePhone(lead.telefone)}`;
          const form = new URLSearchParams({ From: String(twilioFrom), To: to, Body: message });
          const basicUser = twilioApiKey ? String(twilioApiKey) : String(twilioSid);
          const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
            method: "POST",
            headers: {
              Authorization: `Basic ${btoa(`${basicUser}:${twilioAuth}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: form.toString(),
          });
          const out = await resp.json().catch(() => ({}));
          ok = resp.ok; msgId = out?.sid ?? null;
          if (!ok) {
            errDetail = JSON.stringify(out).slice(0, 200);
            // 4xx = definitivo (nº/param inválido) — EXCETO os não específicos do
            // destinatário/remetente (ver isFatalClientError).
            if (isFatalClientError(resp.status)) smsFatal = true;
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
          // Número/param inválido → falha DEFINITIVA: finaliza sem retry e estorna a
          // unidade de cota já reservada. Só estorna se ESTA tentativa de fato reservou
          // (reserveOne 'reserved'); fail-open ('error') não somou nada — mesma regra
          // dos ramos de retry/gaveup abaixo.
          if (reservedThisAttempt) await releaseOne(s.organization_id);
          await finalize(s.id, curAttempts + 1, errDetail);
          failed++; processed++;
        } else {
          // Falha transitória (5xx/rede/secret) → reagenda com backoff. Só estorna se
          // esgotou as tentativas (gaveup); retry mantém a reserva desta tentativa.
          const r = await failStep(s.id, curAttempts, errDetail);
          if (r === "gaveup") { gaveup++; if (reservedThisAttempt) await releaseOne(s.organization_id); } else retried++;
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
      // Exceção inesperada → trata como falha com retry (não descarta). Se esta
      // tentativa já tinha reservado cota (reservedThisAttempt) e aqui é desistência
      // definitiva (gaveup), estorna — mesma regra dos ramos de envio acima.
      const r = await failStep(s.id, curAttempts, String(e).slice(0, 200));
      if (r === "gaveup") { gaveup++; if (reservedThisAttempt) await releaseOne(s.organization_id); } else retried++;
      failed++;
    }
  }

  return json({ ok: true, devidas: (due || []).length, processed, sent, tagged, failed, retried, gaveup, skipped, deferred, refunded });
});
