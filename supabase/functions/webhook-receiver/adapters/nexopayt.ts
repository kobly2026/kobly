// Kobly — adaptador `nexopayt`.
// Formato do postback baseado na família Payt/NexoPayt (ref. pública: ventuinha/payt-postback).
// Campos: integration_key, transaction_id, status (pedido), customer{name,email,phone,doc},
//   transaction{payment_method, payment_status, total_price}, product{name,price}, payment_method.
// ⚠️ A CONFIRMAR com 1 postback REAL da conta NexoPayt:
//   (a) mecanismo de auth — integration_key no corpo (padrão Payt) vs assinatura HMAC em header;
//   (b) unidade de total_price (assumido centavos, como na API de saída);
//   (c) nomes exatos dos campos (se a NexoPayt divergir da família Payt).
import type { Adapter, ParseResult } from "./types.ts";

const SIGNATURE_HEADER = "x-signature"; // fallback HMAC, caso a NexoPayt assine via header
const SIGNATURE_ENCODING: "hex" | "base64" = "hex";

// transaction.payment_status (lifecycle de pagamento) → tipo_evento (enum Kobly).
const PAYMENT_STATUS_MAP: Record<string, string> = {
  paid: "Compra Aprovada",
  refused: "Compra Recusada",
  one_click_buy_refused: "Compra Recusada",
  refunded: "Compra Reembolsada",
  refunded_partial: "Compra Reembolsada",
  one_click_buy_refunded: "Compra Reembolsada",
  one_click_buy_refunded_partial: "Compra Reembolsada",
  pending_refund: "Compra Reembolsada",
  chargeback: "Chargeback",
  chargeback_presented: "Chargeback",
  canceled: "Compra cancelada",
};
// status (pedido) → tipo_evento, para casos não cobertos pelo payment_status.
const ORDER_STATUS_MAP: Record<string, string> = {
  paid: "Compra Aprovada",
  canceled: "Compra cancelada",
  lost_cart: "Abandono de carrinho",
  subscription_canceled: "Cancelamento de Assinatura",
};
const PAYMENT_LABEL: Record<string, string> = { pix: "Pix", credit_card: "Cartão", boleto: "Boleto" };

async function hmacSha256(rawBody: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const bytes = new Uint8Array(sig);
  if (SIGNATURE_ENCODING === "base64") return btoa(String.fromCharCode(...bytes));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function resolveTipoEvento(root: Record<string, any>, tx: Record<string, any>, pm: string): string | null {
  const payStatus = String(tx.payment_status ?? root.payment_status ?? "").toLowerCase();
  const orderStatus = String(root.status ?? "").toLowerCase();
  // waiting_payment → depende do método: pix → Pix Gerado, boleto → Boleto Gerado
  if (payStatus === "waiting_payment" || orderStatus === "waiting_payment") {
    if (pm === "boleto") return "Boleto Gerado";
    if (pm === "pix") return "Pix Gerado";
    return null;
  }
  return PAYMENT_STATUS_MAP[payStatus] || ORDER_STATUS_MAP[orderStatus] || null;
}

export const nexopayt: Adapter = {
  requiresSignature: true,
  async verify(rawBody, headers, signingSecret) {
    if (!signingSecret) return false;
    // 1) integration_key no corpo (padrão da família Payt)
    try {
      const b = JSON.parse(rawBody || "{}");
      if (b && typeof b.integration_key === "string" && b.integration_key === signingSecret) return true;
    } catch { /* corpo não-JSON cai no fallback */ }
    // 2) fallback: assinatura HMAC em header
    const provided = (headers.get(SIGNATURE_HEADER) || "").trim();
    if (provided) {
      const expected = await hmacSha256(rawBody, signingSecret);
      if (provided.toLowerCase() === expected.toLowerCase()) return true;
    }
    return false;
  },
  parse(parsed): ParseResult {
    const root = (parsed ?? {}) as Record<string, any>;
    const tx = (root.transaction ?? {}) as Record<string, any>;
    const pm = String(tx.payment_method ?? root.payment_method ?? "").toLowerCase();
    const tipo_evento = resolveTipoEvento(root, tx, pm);
    if (!tipo_evento) return { ignore: true };

    const c = (root.customer ?? {}) as Record<string, any>;
    const prod = (root.product ?? {}) as Record<string, any>;
    const totalRaw = Number(tx.total_price ?? root.total_price ?? prod.price ?? 0);
    const txId = root.transaction_id ?? tx.id ?? root.id ?? null;

    return {
      tipo_evento,
      email: c.email ?? null,
      nome: c.name ?? null,
      sobrenome: null, // família Payt usa nome único
      telefone: c.phone ?? c.phone_number ?? null,
      produto: prod.name ?? prod.title ?? null,
      valor: totalRaw ? Math.round(totalRaw) / 100 : null, // ⚠️ assume centavos — confirmar
      metodo_pagamento: PAYMENT_LABEL[pm] ?? (pm || null),
      pix_gerado: tipo_evento === "Pix Gerado" || pm === "pix",
      id_webhook: txId ? `${txId}:${tipo_evento}` : null, // idempotência por transição de status
    };
  },
};
