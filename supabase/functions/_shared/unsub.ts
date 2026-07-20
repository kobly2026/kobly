// supabase/functions/_shared/unsub.ts
// Token de descadastro stateless: token = base64url(payload) + "." + base64url(hmac(payload))
// payload = `${orgId}:${email(lower)}:${nowMs}`. Sem expiração (unsubscribe vale sempre).
function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
async function hmac(secret: string, msg: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg)));
}
export async function signUnsubToken(secret: string, orgId: string, email: string, nowMs: number): Promise<string> {
  const payload = `${orgId}:${String(email).toLowerCase()}:${nowMs}`;
  return `${b64url(new TextEncoder().encode(payload))}.${b64url(await hmac(secret, payload))}`;
}
export async function verifyUnsubToken(secret: string, token: string): Promise<{ orgId: string; email: string } | null> {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return null;
  let payload: string;
  try { payload = new TextDecoder().decode(b64urlToBytes(parts[0])); } catch { return null; }
  const expected = b64url(await hmac(secret, payload));
  if (expected.length !== parts[1].length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ parts[1].charCodeAt(i);
  if (diff !== 0) return null;
  const seg = payload.split(":");
  if (seg.length < 3 || !seg[0] || !seg[1]) return null;
  return { orgId: seg[0], email: seg[1] };
}
