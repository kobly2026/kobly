// Kobly — Edge Function `send-email`: proxy seguro para o Resend ("Enviar teste").
// Chave do Resend no Supabase Vault (RPC get_secret, service_role). NUNCA no browser.
// from: body.from completo é IGNORADO (anti-abuso); body.fromName (display) + endereço
// resolvido pela MESMA prioridade dos workers (process-bulk/process-steps):
// domínio próprio verificado da org > <sender_local>@resend_sending_domain > secret
// `resend_from` (fallback antigo).
// verify_jwt = true SÓ garante que o Authorization é um JWT válido assinado pelo projeto —
// a anon key (publishable, que vai no bundle do frontend) É um desses JWTs e atravessa o
// gateway. Por isso a function faz sua PRÓPRIA verificação: admin.auth.getUser(jwt) tem que
// resolver um usuário real E esse usuário tem que ter organização — caso contrário falha
// FECHADO com 401 antes de tocar no Resend. Sem isto, qualquer portador da anon key vira um
// open relay usando a chave Resend compartilhada e o remetente de domínio verificado da org.
// Persiste o resultado em public.email_events (event='send_test', não 'send') para
// diagnosticar testes sem poluir os KPIs de campanha (contagem enviados/rejeitados, funil,
// métricas de entrega — todos filtram por event='send') e sem consumir cota do plano —
// nenhuma RPC de reserva/consumo é chamada aqui.
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

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function extractEmail(s: string | null | undefined): string | null {
  if (!s) return null;
  const m = String(s).match(/<([^>]+)>/);
  return (m ? m[1] : String(s)).trim() || null;
}
function fromNameSafe(n: string | null | undefined): string {
  return String(n || "").replace(/["<>\\]/g, "").replace(/,/g, " ").trim() || "Koblay";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    // `from` completo do body é IGNORADO (anti-abuso na chave compartilhada).
    // Só aceita fromName (display); o endereço vem da resolução por org abaixo.
    const { to, subject, html, text, fromName } = await req.json();
    if (!to || !subject || (!html && !text)) return json({ error: "missing_fields", detail: "to, subject e html/text são obrigatórios" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Identidade do chamador é OBRIGATÓRIA — falha FECHADO (401) antes de qualquer secret
    // do Resend ser lida ou usada. Ver nota de topo do arquivo sobre por que verify_jwt=true
    // sozinho não basta (a anon key também é um JWT válido, mas não é um usuário).
    let callerOrg: string | null = null;
    let replyTo: string | null = null;
    try {
      const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const { data: u, error: authErr } = await admin.auth.getUser(jwt);
      if (authErr || !u?.user) return json({ error: "unauthorized" }, 401);
      const { data: prof } = await admin.from("profiles").select("organization_id").eq("auth_id", u.user.id).maybeSingle();
      callerOrg = prof?.organization_id ?? null;
      if (!callerOrg) return json({ error: "unauthorized" }, 401);
      const { data: org } = await admin.from("organizations").select("reply_to_email").eq("id", callerOrg).maybeSingle();
      replyTo = (org?.reply_to_email && String(org.reply_to_email).trim()) || null;
    } catch {
      return json({ error: "unauthorized" }, 401);
    }
    if (!callerOrg) return json({ error: "unauthorized" }, 401); // defensivo — nunca deveria ser alcançado

    const { data: apiKey } = await admin.rpc("get_secret", { p_name: "resend_api_key" });
    if (!apiKey) return json({ error: "secret_unavailable", detail: "Defina a secret 'resend_api_key' no Vault." }, 500);
    const { data: fromCfg } = await admin.rpc("get_secret", { p_name: "resend_from" });
    const { data: sendingDomainRaw } = await admin.rpc("get_secret", { p_name: "resend_sending_domain" });
    const sendingDomain = (sendingDomainRaw && String(sendingDomainRaw).trim()) || null;
    const platformAddr = extractEmail(fromCfg) || "onboarding@resend.dev";

    // Remetente por org — mesma prioridade de process-bulk/process-steps (resolveSender):
    // 1) domínio próprio verificado da org (domains.status='verified', com id_resend
    //    real, não SendGrid legado); 2) <sender_local>@resend_sending_domain;
    // 3) fallback antigo (secret resend_from / onboarding@resend.dev).
    let addr = platformAddr;
    const { data: dom } = await admin.from("domains")
      .select("from_email, url, status, id_resend")
      .eq("organization_id", callerOrg).eq("status", "verified")
      .not("id_resend", "is", null).not("id_resend", "like", "sg%")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    let resolved: string | null = null;
    if (dom) resolved = extractEmail(dom.from_email) || (dom.url ? `contato@${dom.url}` : null);
    if (!resolved && sendingDomain) {
      const { data: o } = await admin.from("organizations").select("sender_local").eq("id", callerOrg).maybeSingle();
      if (o?.sender_local) resolved = `${o.sender_local}@${sendingDomain}`;
    }
    if (resolved) addr = resolved;
    const sender = fromName ? `${fromNameSafe(fromName)} <${addr}>` : `Koblay <${addr}>`;

    const primeiroTo = Array.isArray(to) ? to[0] : to;

    // Supressão: único caminho de e-mail do produto que ainda faltava consultar
    // email_suppressions. Falha FECHADA (mesma política de process-steps/process-bulk):
    // se a consulta falhar não sabemos se o destinatário está suprimido, e reenviar para
    // quem optou por sair não é reversível — não vira "segue sem checar".
    if (primeiroTo) {
      const emailLower = String(primeiroTo).toLowerCase();
      const { data: sup, error: supErr } = await admin.from("email_suppressions")
        .select("id").eq("email", emailLower)
        .or(`organization_id.eq.${callerOrg},organization_id.is.null`).limit(1);
      if (supErr) return json({ error: "suppression_check_failed", detail: "Não foi possível verificar supressão do destinatário." }, 500);
      if (sup && sup.length) return json({ ok: false, skipped: "suppressed" }, 200);
    }

    const { data: unsubSecret } = await admin.rpc("get_secret", { p_name: "unsubscribe_secret" });
    let unsubUrl: string | null = null;
    let htmlOut = html;
    if (unsubSecret && primeiroTo) {
      const token = await signUnsubToken(String(unsubSecret), callerOrg, String(primeiroTo), Date.now());
      unsubUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/unsubscribe?token=${token}`;
      if (htmlOut) htmlOut = String(htmlOut).split("{{unsubscribe_url}}").join(unsubUrl)
                     .replace(/href="#"(\s[^>]*>\s*Descadastrar)/i, `href="${unsubUrl}"$1`);
    }
    const listUnsub = unsubUrl ? `<${unsubUrl}>, <mailto:unsubscribe@koblay.io>` : `<mailto:unsubscribe@koblay.io>`;
    // List-Unsubscribe-Post (RFC 8058 one-click) só faz sentido junto de uma URL https
    // clicável; anunciá-lo ao lado de um List-Unsubscribe só-mailto é combinação sem
    // sentido pra RFC 8058 — omitido quando não há unsubUrl.
    const unsubHeaders: Record<string, string> = unsubUrl
      ? { "List-Unsubscribe": listUnsub, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
      : { "List-Unsubscribe": listUnsub };

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: sender,
        to: Array.isArray(to) ? to : [to],
        subject, html: htmlOut, text,
        headers: unsubHeaders,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    const out = await resp.json().catch(() => ({}));

    // Persiste o resultado do teste em email_events (mesmo formato do worker, mas
    // event='send_test' — NÃO 'send' — para não poluir os KPIs de campanha do cliente,
    // que filtram por event='send'). NÃO chama nenhuma RPC de reserva/consumo de cota:
    // teste não deve custar cota do plano. callerOrg está sempre resolvido aqui (fail
    // closed acima garante isso).
    const { error: evErr } = await admin.from("email_events").insert({
      organization_id: callerOrg,
      campaign_id: null,
      event: "send_test",
      channel: "email",
      email: primeiroTo,
      status: resp.ok ? "enviado" : "falhou",
      sg_message_id: resp.ok ? (out?.id ?? null) : null,
      reason: resp.ok ? null : JSON.stringify(out).slice(0, 300),
      timestamp: new Date().toISOString(),
    });
    if (evErr) console.warn("send-email: falha ao gravar email_events do teste", evErr);

    if (!resp.ok) return json({ error: "resend_error", status: resp.status, detail: out }, 502);
    return json({ ok: true, id: out.id, from: sender });
  } catch (e) {
    return json({ error: "bad_request", detail: String(e).slice(0, 300) }, 400);
  }
});
