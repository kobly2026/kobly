// Kobly — Edge Function `resend-admin`: domínio de envio via Resend (por organização).
// Ações:
//  - list   → lista domínios da org (banco) + status Resend se houver id_resend
//  - create { name, from_email?, organization_id? } → cria no Resend + grava domains + DNS
//  - verify { id } → pede verificação no Resend e atualiza validado/status
//  - get    { id } → detalhe + DNS records
//  - delete { id } → remove do Resend (se possível) e do banco
// Auth: JWT + has_org_access (Cliente da org, Gestor, Admin).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function mapDns(records: any[] | undefined, domainId: string) {
  if (!Array.isArray(records)) return [];
  return records.map((r) => ({
    domain_id: domainId,
    tipo: String(r.type || r.record || "TXT").toUpperCase(),
    host: String(r.name || r.host || ""),
    valor: String(r.value || r.content || ""),
    status: r.status === "verified" ? "verificado" : "pendente",
    record_role: r.record || r.type || null,
  }));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: any = {};
  try { body = await req.json(); } catch { /* ok */ }
  const action = body.action || "list";

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: userData, error: userErr } = await sb.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);

  const { data: prof } = await sb.from("profiles")
    .select("id, tipo_user_geral, organization_id")
    .eq("auth_id", userData.user.id).maybeSingle();
  if (!prof) return json({ error: "forbidden" }, 403);

  const role = String(prof.tipo_user_geral);
  // Org alvo: body.organization_id (gestor multi-conta) ou org do profile.
  let orgId: string | null = body.organization_id || prof.organization_id || null;

  // Anti-IDOR: service_role NÃO confia em organization_id do body sem membership.
  // Admin: qualquer org. Gestor: membership. Cliente: só a própria org.
  const assertOrgAccess = async (target: string | null) => {
    if (!target) return false;
    if (role === "Administrador") return true;
    if (prof.organization_id && prof.organization_id === target) return true;
    const { data: mem } = await sb.from("organization_memberships")
      .select("id").eq("organization_id", target).eq("profile_id", prof.id).maybeSingle();
    return !!mem;
  };

  if (orgId && !(await assertOrgAccess(orgId))) {
    return json({ error: "forbidden", detail: "Sem acesso a esta organização" }, 403);
  }
  if (!orgId && role !== "Administrador") {
    return json({ error: "no_org", detail: "Sem organização vinculada" }, 400);
  }

  // Só Admin (setup plataforma) lista domínios crus da conta Resend sem org.
  const platformMode = !orgId && role === "Administrador";

  const { data: apiKey } = await sb.rpc("get_secret", { p_name: "resend_api_key" });
  if (!apiKey) return json({ error: "no_api_key", detail: "resend_api_key ausente no Vault" }, 500);

  const rs = (path: string, method = "GET", payload?: unknown) =>
    fetch(`https://api.resend.com${path}`, {
      method,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: payload ? JSON.stringify(payload) : undefined,
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  try {
    // ── LIST ──────────────────────────────────────────────────────────────
    if (action === "list") {
      if (platformMode) {
        const r = await rs("/domains");
        return json({ ok: r.status < 300, platform: true, ...r });
      }
      const { data: rows } = await sb.from("domains")
        .select("*, domain_dns_records(*)")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });
      return json({ ok: true, domains: rows || [] });
    }

    // ── CREATE ────────────────────────────────────────────────────────────
    if (action === "create") {
      if (!orgId) return json({ error: "no_org" }, 400);
      const name = String(body.name || "").trim().toLowerCase();
      if (!name || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(name)) {
        return json({ error: "invalid_name", detail: "Informe um domínio válido (ex.: envio.sualoja.com.br)" }, 400);
      }
      const fromEmail = body.from_email
        ? String(body.from_email).trim().toLowerCase()
        : `contato@${name}`;

      const r = await rs("/domains", "POST", { name, region: body.region || "us-east-1" });
      if (r.status >= 300) {
        return json({ error: "resend_error", status: r.status, detail: r.body }, 502);
      }
      const resendId = r.body?.id || r.body?.data?.id || null;
      const records = r.body?.records || r.body?.data?.records || [];

      const { data: dom, error: insErr } = await sb.from("domains").insert({
        organization_id: orgId,
        url: name,
        validado: false,
        id_resend: resendId,
        id_sendgrid: resendId, // legado
        from_email: fromEmail,
        status: "pending",
        created_by: prof.id,
      }).select().single();
      if (insErr || !dom) {
        return json({ error: "db_insert_failed", detail: insErr?.message }, 500);
      }

      const dnsRows = mapDns(records, dom.id);
      if (dnsRows.length) {
        await sb.from("domain_dns_records").insert(dnsRows);
      }

      const { data: full } = await sb.from("domains")
        .select("*, domain_dns_records(*)").eq("id", dom.id).maybeSingle();
      return json({ ok: true, domain: full, resend: r.body });
    }

    // ── GET / VERIFY / DELETE ─────────────────────────────────────────────
    if (action === "get" || action === "verify" || action === "delete") {
      const id = body.id;
      if (!id) return json({ error: "missing_id" }, 400);

      const { data: dom } = await sb.from("domains")
        .select("*, domain_dns_records(*)").eq("id", id).maybeSingle();
      if (!dom) return json({ error: "not_found" }, 404);
      // Anti-IDOR: domínio só se o caller tem acesso à org dona.
      if (!(await assertOrgAccess(dom.organization_id))) {
        return json({ error: "forbidden" }, 403);
      }

      if (action === "get") {
        let resend: unknown = null;
        if (dom.id_resend) {
          const r = await rs(`/domains/${dom.id_resend}`);
          resend = r.body;
        }
        return json({ ok: true, domain: dom, resend });
      }

      if (action === "verify") {
        if (!dom.id_resend) return json({ error: "no_resend_id" }, 400);
        const r = await rs(`/domains/${dom.id_resend}/verify`, "POST");
        // Re-fetch status
        const g = await rs(`/domains/${dom.id_resend}`);
        const status = String(g.body?.status || g.body?.data?.status || "").toLowerCase();
        const verified = status === "verified";
        await sb.from("domains").update({
          validado: verified,
          status: verified ? "verified" : (status || "pending"),
          updated_at: new Date().toISOString(),
        }).eq("id", dom.id);

        // Atualiza DNS records se vierem
        const records = g.body?.records || g.body?.data?.records;
        if (Array.isArray(records) && records.length) {
          await sb.from("domain_dns_records").delete().eq("domain_id", dom.id);
          await sb.from("domain_dns_records").insert(mapDns(records, dom.id));
        }

        // Se verificado, opcionalmente atualiza resend_from no Vault? Não — fica por org.
        const { data: full } = await sb.from("domains")
          .select("*, domain_dns_records(*)").eq("id", dom.id).maybeSingle();
        return json({ ok: r.status < 300 || verified, domain: full, resend_status: status, verify: r.body });
      }

      if (action === "delete") {
        if (dom.id_resend) {
          await rs(`/domains/${dom.id_resend}`, "DELETE").catch(() => null);
        }
        await sb.from("domain_dns_records").delete().eq("domain_id", dom.id);
        await sb.from("domains").delete().eq("id", id);
        return json({ ok: true });
      }
    }

    return json({ error: "unknown_action", detail: action }, 400);
  } catch (e) {
    return json({ error: "resend_call_failed", detail: String(e).slice(0, 300) }, 500);
  }
});
