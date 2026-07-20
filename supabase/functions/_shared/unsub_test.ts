// supabase/functions/_shared/unsub_test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { signUnsubToken, verifyUnsubToken } from "./unsub.ts";

const SECRET = "s3cr3t-de-teste";

Deno.test("round-trip: assina e verifica", async () => {
  const t = await signUnsubToken(SECRET, "org-1", "Fulano@Gmail.com", 1700000000000);
  const r = await verifyUnsubToken(SECRET, t);
  assertEquals(r, { orgId: "org-1", email: "fulano@gmail.com" });
});

Deno.test("rejeita token adulterado", async () => {
  const t = await signUnsubToken(SECRET, "org-1", "a@b.com", 1700000000000);
  const bad = t.slice(0, -2) + (t.endsWith("aa") ? "bb" : "aa");
  assertEquals(await verifyUnsubToken(SECRET, bad), null);
});

Deno.test("rejeita secret errado", async () => {
  const t = await signUnsubToken(SECRET, "org-1", "a@b.com", 1700000000000);
  assertEquals(await verifyUnsubToken("outro-secret", t), null);
});

Deno.test("rejeita formato inválido", async () => {
  assertEquals(await verifyUnsubToken(SECRET, "lixo"), null);
});
