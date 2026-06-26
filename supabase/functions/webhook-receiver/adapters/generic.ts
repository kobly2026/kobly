// Kobly — adaptador `generic`: preserva o comportamento atual (formato próprio no corpo).
// É o caminho legado/rede-de-segurança e o harness de teste do motor já provado.
import type { Adapter, ParseResult } from "./types.ts";

export const generic: Adapter = {
  requiresSignature: false,
  verify() {
    return Promise.resolve(true);
  },
  parse(parsed: unknown): ParseResult {
    const b = (parsed ?? {}) as Record<string, unknown>;
    return {
      tipo_evento: b.tipo_evento as string,
      email: (b.email as string) ?? null,
      nome: (b.nome as string) ?? null,
      sobrenome: (b.sobrenome as string) ?? null,
      telefone: (b.telefone as string) ?? null,
      produto: (b.produto as string) ?? null,
      valor: (b.valor as number) ?? null,
      metodo_pagamento: (b.metodo_pagamento as string) ?? null,
      pix_gerado: !!b.pix_gerado,
      id_webhook: (b.id_webhook as string) ?? null,
    };
  },
};
