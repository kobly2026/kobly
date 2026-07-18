// Kobly — Edge Function `invite-client` (MARCA-2: Gestor convida cliente).
// Fecha o fluxo "agência cadastra cliente": cria o usuário Auth, envia o convite
// por e-mail e vincula o profile do cliente à org gerida.
//
// Contrato (chamado por KoblyApi.createOrganization):
//   POST { org_id, email, nome }  + Authorization: Bearer <jwt do gestor>
//   → { ok, invited }                        (novo cliente convidado)
//   → { ok, already_exists: true }           (e-mail já tinha conta → só revincula)
//   → { error, detail }                      (falha de autorização/entrada)
//
// Segurança: verify_jwt=true + anti-IDOR. Só Administrador ou Gestor COM
// membership na org podem convidar. O papel/org do convidado é definido pelo
// SERVIDOR (service_role) — nunca por metadata controlada pelo cliente
// (ver 0043_auth_hardening.sql: handle_new_user só confia em app_metadata).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: any = {};
  try { body = await req.json(); } catch { /* ok */ }
  const orgId = String(body.org_id || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const nome = String(body.nome || "").trim();
  if (!orgId || !email) return json({ error: "missing_fields", detail: "org_id e email são obrigatórios" }, 400);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // 1) Autentica o chamador e resolve papel/acesso à org.
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: userData, error: userErr } = await sb.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);

  const { data: prof } = await sb.from("profiles")
    .select("id, tipo_user_geral, organization_id")
    .eq("auth_id", userData.user.id).maybeSingle();
  if (!prof) return json({ error: "forbidden" }, 403);
  const role = String(prof.tipo_user_geral);

  const hasAccess =
    role === "Administrador" ||
    (prof.organization_id === orgId) ||
    !!(await sb.from("organization_memberships")
        .select("id").eq("organization_id", orgId).eq("profile_id", prof.id).maybeSingle()).data;
  if (!hasAccess || (role !== "Administrador" && role !== "Gestor")) {
    return json({ error: "forbidden", detail: "Apenas Administrador ou Gestor da conta podem convidar" }, 403);
  }

  // 2) Convida por e-mail. app_metadata define papel/org de forma confiável.
  const appMeta = { tipo_user_geral: "Cliente", organization_id: orgId };
  const redirectTo = Deno.env.get("PUBLIC_SITE_URL") || undefined;
  let alreadyExists = false;

  const { data: invited, error: inviteErr } = await sb.auth.admin.inviteUserByEmail(email, {
    data: { nome },
    redirectTo,
  });

  if (inviteErr) {
    // Usuário já registrado → não é erro; segue para revincular o profile.
    const msg = String(inviteErr.message || "").toLowerCase();
    if (msg.includes("already") || (inviteErr as any).status === 422) alreadyExists = true;
    else return json({ error: "invite_failed", detail: inviteErr.message }, 502);
  }

  // Garante app_metadata (inviteUserByEmail só grava user_metadata).
  const invitedId = invited?.user?.id;
  if (invitedId) {
    await sb.auth.admin.updateUserById(invitedId, { app_metadata: appMeta });
  }

  // 3) Vincula o profile à org (service_role — liberado pelo guard em 0043).
  //    handle_new_user já criou o profile por e-mail; aqui garantimos org+papel.
  const { error: linkErr } = await sb.from("profiles")
    .update({ organization_id: orgId, tipo_user_geral: "Cliente" })
    .eq("email", email);
  if (linkErr) return json({ error: "link_failed", detail: linkErr.message }, 500);

  return json({ ok: true, invited: !alreadyExists, already_exists: alreadyExists });
});
