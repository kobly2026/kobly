// Kobly — contrato dos adaptadores de plataforma de checkout.
// Cada adaptador traduz o payload nativo de uma plataforma → evento normalizado interno,
// que o core do webhook-receiver consome (lead upsert + enqueue), sem saber de provider.

export type NormalizedEvent = {
  // Um dos 10 valores do enum public.tipo_evento. O receiver rejeita (ignore) o que não casar.
  tipo_evento: string;
  email?: string | null;
  nome?: string | null;
  sobrenome?: string | null;
  telefone?: string | null;
  produto?: string | null;
  valor?: number | null; // em REAIS (numeric(10,2)) — adaptadores convertem de centavos aqui.
  metodo_pagamento?: string | null;
  pix_gerado?: boolean;
  // Chave de idempotência. Para multi-status da MESMA transação, deve variar por status
  // (ex.: `${hash}:${tipo_evento}`), senão a dedup (webhook_id,id_webhook) descarta o 2º+.
  id_webhook?: string | null;
};

// Status conhecido-mas-irrelevante (ou desconhecido) → ignorar com 200 (sem 4xx/5xx).
export type ParseResult = NormalizedEvent | { ignore: true };

export interface Adapter {
  // Se true, o receiver exige signing_secret na linha do webhook e chama verify().
  requiresSignature: boolean;
  // Verifica a assinatura do postback a partir do corpo CRU (bytes como recebidos).
  verify(rawBody: string, headers: Headers, signingSecret: string | null): Promise<boolean>;
  // Traduz o payload já parseado em evento normalizado, ou {ignore:true}.
  parse(parsed: unknown, headers: Headers): ParseResult;
}
