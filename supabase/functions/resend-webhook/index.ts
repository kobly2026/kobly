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
// e assine os eventos do MAP abaixo (opened, clicked, delivered, delivery_delayed,
// bounced, complained).
//
// ⚠️ ABERTURA/CLIQUE NÃO CHEGAM SÓ POR TER DOMÍNIO VERIFICADO. O Resend desliga o
// rastreamento por padrão em todo domínio ("Open and click tracking is disabled by
// default for all domains") e ele só fica ATIVO com DUAS condições simultâneas:
//   1) a flag open_tracking/click_tracking ligada no domínio, e
//   2) um subdomínio de tracking (ex.: links.koblay.io) publicado por CNAME e verificado.
// Sem as duas, o pixel nunca é inserido e NENHUM evento open/click existe — mesmo com
// 100% de entrega em caixa de entrada. Este arquivo já afirmou que bastava "domínio
// verificado"; era falso, e essa crença fez ler "0 aberturas em 67 entregas" como prova
// de que os e-mails caíam em Spam (auditoria de 21/07). Zero abertura com tracking
// desligado não é sinal de entrega — é ausência de instrumento. Antes de tirar qualquer
// conclusão de taxa de abertura, confirme que as duas condições acima estão de pé.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// Resend event type → mapeamento interno. `kind` decide o tratamento.
const MAP: Record<string, { event: string; status: string; kind: "engage" | "info" | "bounce" | "complaint"; col?: "aberturas" | "cliques" }> = {
  "email.opened":           { event: "open",      status: "aberto",    kind: "engage", col: "aberturas" },
  "email.clicked":          { event: "click",     status: "clicado",   kind: "engage", col: "cliques" },
  "email.delivered":        { event: "delivered", status: "entregue",  kind: "info" },
  "email.delivery_delayed": { event: "deferred",  status: "adiado",    kind: "info" },
  "email.bounced":          { event: "bounce",    status: "bounce",    kind: "bounce" },
  "email.complained":       { event: "complaint", status: "reclamado", kind: "complaint" },
};

// Verificação de assinatura svix (Resend). signedContent = "<id>.<ts>.<body>";
// secret = base64 após o prefixo "whsec_". Compara HMAC-SHA256 com o header
// svix-signature ("v1,<b64> v1,<b64>"). Auditoria E2E (Canais A1).
function b64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function tsafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
async function verifySvix(secret: string, id: string, ts: string, sigHeader: string, body: string): Promise<boolean> {
  try {
    const raw = secret.startsWith("whsec_") ? secret.slice(6) : secret;
    const key = await crypto.subtle.importKey("raw", b64ToBytes(raw), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${body}`));
    const expected = bytesToB64(new Uint8Array(mac));
    return sigHeader.split(" ").some((part) => {
      const val = part.split(",")[1];
      return !!val && tsafeEqual(val, expected);
    });
  } catch { return false; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const raw = await req.text();
  let body: any;
  try { body = JSON.parse(raw || "{}"); } catch { return json({ error: "invalid_json" }, 400); }

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Verificação de assinatura svix (auditoria E2E — Canais A1): sem isto, qualquer
  // um podia POSTar aberturas/cliques forjados e inflar métricas. A secret vem do
  // Vault (resend_webhook_secret = signing secret do webhook no painel do Resend).
  //
  // FAIL CLOSED: se a secret não estiver definida, REJEITAMOS a request (503) em vez
  // de processar sem verificar. Antes disto, "sem secret → segue sem checar" era
  // aceitável quando este endpoint só gravava telemetria; agora que ele também
  // escreve email_suppressions (bounce permanente → bloqueio GLOBAL, todo tenant),
  // pular a verificação vira um curl anônimo capaz de suprimir qualquer endereço
  // pra sempre em toda a plataforma. Não "simplifique" isto de volta para opcional.
  const { data: signingSecret } = await sb.rpc("get_secret", { p_name: "resend_webhook_secret" });
  if (!signingSecret) {
    return json({ error: "webhook_unconfigured" }, 503);
  }
  {
    const id = req.headers.get("svix-id") || "";
    const ts = req.headers.get("svix-timestamp") || "";
    const sig = req.headers.get("svix-signature") || "";
    if (!id || !ts || !sig || !(await verifySvix(String(signingSecret), id, ts, sig, raw))) {
      return json({ error: "invalid_signature" }, 401);
    }
  }

  const m = MAP[body?.type];
  if (!m) return json({ ok: true, ignored: true, type: body?.type ?? null }); // demais eventos → 200 ignore

  const data = body.data || {};
  const messageId: string | null = data.email_id || null;
  const recipient: string | null = Array.isArray(data.to) ? data.to[0] : (data.to || null);
  if (!messageId && !recipient) return json({ ok: true, ignored: true, reason: "no_match_key" });

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

  // Motivo do bounce. O Resend manda data.bounce = { type, subType, message } — e SÓ em
  // email.bounced: o payload de email.delivery_delayed não carrega campo de motivo algum
  // (ver docs/webhooks/emails/delivery-delayed), então `deferred` fica com reason null por
  // limite do provedor, não por esquecimento — não "conserte" isso inventando um texto.
  // Antes disto o insert gravava reason null em TODO bounce, e a única forma de saber por
  // que um endereço quicou era abrir o painel do Resend. Foi exatamente esse buraco que
  // cegou o diagnóstico de entregabilidade de 21/07: 12 eventos bounce/deferred na base,
  // nenhum com motivo, forçando inferência por padrão temporal em vez de ler a resposta do MTA.
  const bounce = body?.data?.bounce ?? null;
  const bounceReason: string | null = bounce
    ? ([[bounce.type, bounce.subType].filter(Boolean).join("/"), bounce.message]
        .filter(Boolean).join(" — ").slice(0, 500) || null)
    : null;

  // Registra o evento (todos os tipos mapeados) — único insert por evento.
  await sb.from("email_events").insert({
    organization_id: org, campaign_id: campaignId, event: m.event, status: m.status,
    email, sg_message_id: messageId, reason: bounceReason,
    url: (body.data?.click?.link ?? null), "timestamp": new Date().toISOString(),
  });

  // Supressão automática: SÓ bounce PERMANENTE vira supressão global; reclamação de
  // spam → por org (abaixo). Resend manda data.bounce.type = "Permanent" | "Transient"
  // | "Undetermined". "Transient" cobre coisas como MailboxFull/MessageTooLarge — uma
  // caixa cheia por um dia não pode virar bloqueio PERMANENTE e PLATAFORMA INTEIRA
  // (organization_id=null): a policy de leitura esconde linhas globais até de admins
  // e não existe policy de escrita nem UI pra reverter — vira definitivo. Transient/
  // Undetermined/ausente: já gravamos o email_events acima (telemetria), mas NÃO suprime.
  const bounceType: string | null = bounce?.type ?? null;
  if (m.kind === "bounce" && email && bounceType === "Permanent") {
    await sb.from("email_suppressions").upsert(
      { email: String(email).toLowerCase(), organization_id: null, reason: "bounce", source: "webhook" },
      { onConflict: "email,organization_id", ignoreDuplicates: true },
    );
  }
  if (m.kind === "complaint" && email) {
    await sb.from("email_suppressions").upsert(
      { email: String(email).toLowerCase(), organization_id: org, reason: "complaint", source: "webhook" },
      { onConflict: "email,organization_id", ignoreDuplicates: true },
    );
  }

  // Só engajamento (open/click) alimenta lead_metrics e stats de campanha.
  if (m.kind !== "engage") return json({ ok: true, type: body.type, event: m.event });

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
