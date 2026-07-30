// supabase/functions/_shared/billing_cycle.ts
// Resolve o valor de um plano para um ciclo de cobrança do Asaas.
//
// Regra única: cada ciclo lê SÓ o seu próprio campo. Não há fallback entre
// ciclos — se o plano não tem valor para o ciclo pedido, a resposta é null e o
// chamador recusa a operação. O código anterior fazia
// `Number(valor_anual) || Number(valor_mensal) * 12`, que cobrava 12x o mensal
// de um cliente que escolheu "anual" e viu um desconto anunciado.
//
// Esta lógica é INLINADA em asaas/index.ts (o deploy por função não empacota
// ../_shared/). Ao mudar aqui, mudar lá — e vice-versa.

export type BillingCycle = "MONTHLY" | "SEMIANNUALLY" | "YEARLY";

export const CYCLE_FIELD: Readonly<Record<BillingCycle, string>> = {
  MONTHLY: "valor_mensal",
  SEMIANNUALLY: "valor_semestral",
  YEARLY: "valor_anual",
};

export function resolveCycleValue(
  cycle: string,
  plan: Record<string, unknown>,
): number | null {
  const key = String(cycle ?? "").toUpperCase() as BillingCycle;
  const field = CYCLE_FIELD[key];
  if (!field) return null;                 // ciclo não suportado

  const raw = plan?.[field];
  if (raw === null || raw === undefined) return null;   // nulo OU coluna ausente

  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}
