// Kobly — Edge Function `bulk-send` (control plane do disparo em massa).
// Cria o cabeçalho + enfileira destinatários (fan-out server-side via RPC). O envio
// em si é feito pelo worker `process-bulk` (cron). Ações:
//  - estimate { canal, filter }        → { total }   (prévia da audiência)
//  - create   { canal, template_id, filter, rate_por_min? } → { bulk_send_id, total }
//  - status   { id }                   → contadores do cabeçalho
//  - cancel   { id }                   → marca 'cancelado' (o worker ignora)
// Auth: JWT + anti-IDOR por org (Admin qualquer; Cliente própria; Gestor membership).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// Normaliza o canal recebido da UI para o enum public.tipo_envio ('email'|'Whatsapp'|'SMS').
function normCanal(raw: string): string | null {
  const c = String(raw || "").toLowerCase();
  if (c === "email" || c === "e-mail") return "email";
  if (c === "whatsapp") return "Whatsapp";
  if (c === "sms") return "SMS";
  return null;
}
const templateCol: Record<string, string> = {
  email: "email_id", Whatsapp: "whatsapp_message_id", SMS: "sms_message_id",
};
const templateTable: Record<string, string> = {
  email: "emails", Whatsapp: "whatsapp_messages", SMS: "sms_messages",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: any = {};
  try { body = await req.json(); } catch { /* ok */ }
  const action = body.action || "estimate";

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: userData, error: userErr } = await sb.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);

  const { data: prof } = await sb.from("profiles")
    .select("id, tipo_user_geral, organization_id")
    .eq("auth_id", userData.user.id).maybeSingle();
  if (!prof) return json({ error: "forbidden" }, 403);
  const role = String(prof.tipo_user_geral);

  // ---- status / cancel: resolvem a org pelo próprio bulk_send -----
  if (action === "status" || action === "cancel") {
    const id = body.id;
    if (!id) return json({ error: "missing_id" }, 400);
    const { data: bs } = await sb.from("bulk_sends").select("*").eq("id", id).maybeSingle();
    if (!bs) return json({ error: "not_found" }, 404);
    if (!(await hasOrgAccess(sb, role, prof, bs.organization_id))) return json({ error: "forbidden" }, 403);
    if (action === "cancel") {
      await sb.from("bulk_sends").update({ status: "cancelado", updated_at: new Date().toISOString() }).eq("id", id);
      return json({ ok: true, status: "cancelado" });
    }
    return json({ ok: true, id: bs.id, status: bs.status, total: bs.total, enviados: bs.enviados, falhados: bs.falhados, pulados: bs.pulados });
  }

  // ---- estimate / create: precisam de org + canal -----
  const orgId: string | null = body.organization_id || prof.organization_id || null;
  if (!orgId) return json({ error: "no_org" }, 400);
  if (!(await hasOrgAccess(sb, role, prof, orgId))) return json({ error: "forbidden" }, 403);

  const canal = normCanal(body.canal);
  if (!canal) return json({ error: "invalid_canal", detail: "canal deve ser email | whatsapp | sms" }, 400);
  const filter = (body.filter && typeof body.filter === "object") ? body.filter : {};

  if (action === "estimate") {
    const { data, error } = await sb.rpc("bulk_count_audience", { p_org: orgId, p_canal: canal, p_filter: filter });
    if (error) return json({ error: "estimate_failed", detail: error.message }, 500);
    return json({ ok: true, total: data ?? 0 });
  }

  if (action === "create") {
    const templateId = body.template_id;
    if (!templateId) return json({ error: "missing_template" }, 400);
    // Valida que o template pertence à org.
    const { data: tpl } = await sb.from(templateTable[canal]).select("id, organization_id").eq("id", templateId).maybeSingle();
    if (!tpl || tpl.organization_id !== orgId) return json({ error: "invalid_template" }, 400);

    // Idempotência: retry de rede / duplo-clique NÃO deve criar um 2º disparo. Dedup por
    // (org, canal, template, filtro) ainda ativo criado nos últimos 60s → devolve o existente.
    const { data: cands } = await sb.from("bulk_sends")
      .select("id, total, filtro")
      .eq("organization_id", orgId).eq("canal", canal).eq(templateCol[canal], templateId)
      .in("status", ["enfileirando", "enviando"])
      .gte("created_at", new Date(Date.now() - 60_000).toISOString());
    const dupe = (cands || []).find((c) => JSON.stringify(c.filtro || {}) === JSON.stringify(filter || {}));
    if (dupe) return json({ ok: true, bulk_send_id: dupe.id, total: dupe.total, deduped: true });

    // Audiência prévia (para checar limite antes de enfileirar).
    const { data: total, error: cErr } = await sb.rpc("bulk_count_audience", { p_org: orgId, p_canal: canal, p_filter: filter });
    if (cErr) return json({ error: "estimate_failed", detail: cErr.message }, 500);
    const audience = Number(total) || 0;
    if (audience <= 0) return json({ error: "empty_audience", detail: "Nenhum lead corresponde ao filtro." }, 400);

    // Reserva de uso ATÔMICA: cria a linha do contador se faltar + incrementa respeitando o
    // limite, travando a linha (sem TOCTOU/lost-update entre chamadas concorrentes).
    const { data: reserved, error: rErr } = await sb.rpc("bulk_reserve_usage", { p_org: orgId, p_n: audience });
    if (rErr) return json({ error: "reserve_failed", detail: rErr.message }, 500);
    if (!reserved) return json({ error: "plan_limit_exceeded", detail: `O disparo (${audience}) excede o limite do plano.` }, 403);

    // Cria o cabeçalho e enfileira.
    const insert: Record<string, unknown> = {
      organization_id: orgId, canal, filtro: filter, status: "enfileirando",
      rate_por_min: Math.max(1, Number(body.rate_por_min) || 60), created_by: prof.id,
    };
    insert[templateCol[canal]] = templateId;
    const { data: bs, error: iErr } = await sb.from("bulk_sends").insert(insert).select("id").single();
    if (iErr || !bs) return json({ error: "create_failed", detail: iErr?.message }, 500);

    const { data: enq, error: eErr } = await sb.rpc("bulk_enqueue_recipients", { p_bulk_send_id: bs.id, p_filter: filter });
    if (eErr) {
      await sb.from("bulk_sends").update({ status: "falhou" }).eq("id", bs.id);
      return json({ error: "enqueue_failed", detail: eErr.message }, 500);
    }
    const enqueued = Number(enq) || 0;
    // Uso já reservado atomicamente acima (bulk_reserve_usage) — nada a incrementar aqui.
    await sb.from("bulk_sends").update({ status: "enviando" }).eq("id", bs.id);
    return json({ ok: true, bulk_send_id: bs.id, total: enqueued });
  }

  return json({ error: "unknown_action", detail: action }, 400);
});

// Anti-IDOR: Admin qualquer org; Cliente só a própria; demais precisam de membership.
async function hasOrgAccess(sb: any, role: string, prof: any, orgId: string): Promise<boolean> {
  if (role === "Administrador") return true;
  if (role === "Cliente") return !!prof.organization_id && prof.organization_id === orgId;
  if (prof.organization_id === orgId) return true;
  const { data: mem } = await sb.from("organization_memberships")
    .select("id").eq("organization_id", orgId).eq("profile_id", prof.id).maybeSingle();
  return !!mem;
}
