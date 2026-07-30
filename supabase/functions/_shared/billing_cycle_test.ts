// supabase/functions/_shared/billing_cycle_test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveCycleValue } from "./billing_cycle.ts";

const PLANO = { valor_mensal: 197, valor_semestral: 1087, valor_anual: 1970 };

Deno.test("resolveCycleValue: cada ciclo lê o seu próprio campo", () => {
  assertEquals(resolveCycleValue("MONTHLY", PLANO), 197);
  assertEquals(resolveCycleValue("SEMIANNUALLY", PLANO), 1087);
  assertEquals(resolveCycleValue("YEARLY", PLANO), 1970);
});

Deno.test("resolveCycleValue: numeric do Postgres pode chegar como string", () => {
  // PostgREST devolve `numeric` como número, mas o driver já entregou string em
  // alguns caminhos; o código antigo fazia Number(...) justamente por isso.
  assertEquals(resolveCycleValue("MONTHLY", { valor_mensal: "97.00" }), 97);
  assertEquals(resolveCycleValue("SEMIANNUALLY", { valor_semestral: "535" }), 535);
});

Deno.test("resolveCycleValue: campo AUSENTE devolve null, não NaN", () => {
  // Este é o bug que a guarda antiga não pegava: se o `select` do plano não
  // trouxer a coluna, Number(undefined) é NaN e `NaN <= 0` é false — passava
  // direto e criava assinatura no Asaas com value: NaN.
  assertEquals(resolveCycleValue("SEMIANNUALLY", { valor_mensal: 97 }), null);
  assertEquals(resolveCycleValue("YEARLY", { valor_mensal: 97 }), null);
});

Deno.test("resolveCycleValue: nulo, zero e negativo são inválidos", () => {
  assertEquals(resolveCycleValue("SEMIANNUALLY", { valor_semestral: null }), null);
  assertEquals(resolveCycleValue("SEMIANNUALLY", { valor_semestral: 0 }), null);
  assertEquals(resolveCycleValue("MONTHLY", { valor_mensal: -10 }), null);
  assertEquals(resolveCycleValue("MONTHLY", { valor_mensal: "abc" }), null);
});

Deno.test("resolveCycleValue: NUNCA cai em outro ciclo", () => {
  // O código antigo fazia `Number(valor_anual) || Number(valor_mensal) * 12`,
  // ou seja: plano sem valor anual cobrava 12x o mensal — o cliente escolhia
  // "anual", via o desconto anunciado e pagava preço cheio. Silenciosamente.
  assertEquals(resolveCycleValue("YEARLY", { valor_mensal: 97, valor_anual: null }), null);
  assertEquals(resolveCycleValue("SEMIANNUALLY", { valor_mensal: 97, valor_semestral: null }), null);
});

Deno.test("resolveCycleValue: ciclo não suportado devolve null", () => {
  // A API do Asaas aceita WEEKLY/BIWEEKLY/QUARTERLY também. Tratar um deles
  // como mensal cobraria a menos sem ninguém perceber.
  assertEquals(resolveCycleValue("QUARTERLY", PLANO), null);
  assertEquals(resolveCycleValue("", PLANO), null);
  assertEquals(resolveCycleValue("mensal", PLANO), null);
});

Deno.test("resolveCycleValue: case-insensitive no ciclo", () => {
  assertEquals(resolveCycleValue("yearly", PLANO), 1970);
  assertEquals(resolveCycleValue("SemiAnnually", PLANO), 1087);
});
