// Kobly — Edge Function `send-sms`: proxy seguro para a GTI SMS.
// Credenciais no Supabase Vault (RPC get_secret, service_role). NUNCA no browser.
// Secrets:
//   gti_sms_token — token da API v3 (formato "399|xxxx"), enviado como Bearer.
// A GTI nao tem parametro de remetente: o sender e definido na conta da GTI, nao por
// requisicao (por isso nao existe equivalente ao antigo `twilio_from`).
// verify_jwt = true: so usuarios autenticados (a UI envia o JWT da sessao).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const GTI_SEND_URL = "https://sms.gtisms.com/api/v3/sms/send";

// A GTI espera o numero SEM '+': "5511988887777" (DDI + DDD + numero).
// BR sem DDI (10-11 digitos) -> prefixa 55. Diferente do Twilio, que exigia o '+'.
function toGtiNumber(raw: string): string {
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return "";
  return digits.length >= 10 && digits.length <= 11 ? `55${digits}` : digits;
}

// A GTI so aceita GSM-7: "nao pode conter emojis, acentos ou outros caracteres
// especiais". Transliterar na saida e' melhor que falhar o envio — a automacao roda
// sem humano por perto. Mantido identico em process-steps e process-bulk.
function toGsm7(text: string): string {
  return String(text)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // tira acento: Voce <- Você
    .replace(/[ç]/g, "c").replace(/[Ç]/g, "C")
    .replace(/[“”„]/g, '"').replace(/[‘’‚]/g, "'")
    .replace(/[–—]/g, "-").replace(/…/g, "...")
    .replace(/[^\x20-\x7E\n\r]/g, "");                 // resto (emoji etc.) sai fora
}

// Estimativa local, usada so' quando a GTI nao devolve sms_count.
// Depois de toGsm7 o texto e' sempre GSM-7, entao 160/153.
function estimateSegments(text: string): number {
  const len = [...text].length;
  return len <= 160 ? 1 : Math.ceil(len / 153);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { to, message } = await req.json();
    if (!to || !message) return json({ error: "missing_fields", detail: "to e message sao obrigatorios" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Auditoria E2E: exige perfil autenticado (nao confia so no gateway verify_jwt).
    const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: authUser } = await admin.auth.getUser(jwt);
    if (!authUser?.user) return json({ error: "unauthorized" }, 401);
    const { data: caller } = await admin.from("profiles").select("id").eq("auth_id", authUser.user.id).maybeSingle();
    if (!caller) return json({ error: "forbidden" }, 403);

    const { data: token } = await admin.rpc("get_secret", { p_name: "gti_sms_token" });
    if (!token) {
      return json({ error: "secret_unavailable", detail: "Defina 'gti_sms_token' no Vault." }, 500);
    }

    const target = toGtiNumber(String(to));
    if (!target || target.length < 10) {
      return json({ error: "invalid_phone", detail: "Numero invalido — confira DDD e digitos." }, 400);
    }

    const body = toGsm7(String(message));
    const resp = await fetch(GTI_SEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipient: target, message: body }),
    });
    const out = await resp.json().catch(() => ({}));

    // A GTI carimba `status` no corpo em TODA resposta. Exigir os dois (HTTP ok E
    // status success) e' fail-closed: se um dia ela devolver 200 com status "error",
    // um SMS nao enviado nao pode ser contado como entregue.
    if (!resp.ok || out?.status !== "success") {
      return json({ error: "gti_error", status: resp.status, detail: out?.message || out }, 502);
    }
    return json({
      ok: true,
      sid: out?.data?.uid ?? null,
      status: out?.data?.status ?? null,
      segments: Number(out?.data?.sms_count) || estimateSegments(body),
    });
  } catch (e) {
    return json({ error: "bad_request", detail: String(e).slice(0, 300) }, 400);
  }
});
