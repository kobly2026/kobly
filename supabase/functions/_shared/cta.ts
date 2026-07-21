// supabase/functions/_shared/cta.ts
// Lógica PURA do destino do CTA dos fluxos (sem I/O, para poder ter deno test).
// É inlinada em process-steps/index.ts — ao mexer aqui, mexa lá também.
//
// Por que existe: o botão dos e-mails de recuperação apontava para
// `lead.link_recuperacao || brand.link || "#"`. Três problemas, todos medidos em
// produção em 2026-07-21: (1) `link_recuperacao` nunca é limpo, então comprador
// recorrente recebia o checkout de uma compra ANTERIOR — parece funcionar e leva
// a um Pix expirado; (2) as 6 brands estão com `link_loja` vazio, então o
// fallback resolvia para `#` — botão morto, sem nenhuma visibilidade; (3) o
// evento que ORIGINOU o passo é imutável e está em webhook_events, enquanto
// `leads.ultimo_evento` é sobrescrito por qualquer postback posterior (divergia
// em 17 de 42 passos agendados).

// Estados com transação pendente ou reprocessável — nos quais o CTA promete
// retomar algo ESPECÍFICO e um link genérico é pior que não enviar. Os terminais
// (Compra Aprovada, Compra cancelada, Compra Reembolsada, Chargeback,
// Cancelamento de Assinatura) ficam de fora de propósito.
// ⚠️ Ponto de manutenção: evento de recuperação novo no enum `tipo_evento`
// precisa entrar AQUI, senão volta a sair e-mail com botão quebrado em silêncio.
export const EVENTOS_RECUPERACAO: ReadonlySet<string> = new Set([
  "Abandono de carrinho",
  "Pix Gerado",
  "Boleto Gerado",
  "Depósito Solicitado",
  "Compra Recusada",
]);

// Prefixo `pulado:` é o contrato que a jornada usa para exibir passo pulado em vez
// de falha vermelha (ver process-steps:313/:372/:379). Não remover o prefixo.
export const PULADO_SEM_LINK = "pulado: sem link de recuperação";

// Só http(s) com host. Rejeita "#", "", "mailto:", "javascript:" e URL sem esquema —
// que é exatamente o que sai hoje quando não há link.
export function isUsableCtaLink(v: unknown): boolean {
  if (typeof v !== "string") return false;
  const s = v.trim();
  if (!/^https?:\/\//i.test(s)) return false;
  try {
    return !!new URL(s).hostname;
  } catch {
    return false;
  }
}

export function corpoUsaCta(corpo: string | null | undefined): boolean {
  return typeof corpo === "string" && corpo.includes("{{cta_link}}");
}

// O botão de URL do WhatsApp usa o CTA por DEFAULT quando não tem url própria
// (process-steps:508 → String(b?.url || "{{cta_link}}")). Detectar só pelo corpo
// deixaria esse caso escapar do gate. O slice(0,3) espelha o corte do envio.
export function botoesUsamCta(botoes: unknown): boolean {
  if (!Array.isArray(botoes)) return false;
  return botoes.slice(0, 3).some((b: Record<string, unknown> | null) => {
    const type = String(b?.type || "URL").toUpperCase();
    if (type !== "URL") return false;
    return String(b?.url || "{{cta_link}}").includes("{{cta_link}}");
  });
}

// Prioridade: link do EVENTO gatilho (imutável) > link do lead (fallback para
// passos sem webhook_event_id) > URL da loja > fallback do canal.
export function resolveCtaLink(a: {
  eventoCheckoutUrl?: string | null;
  leadLinkRecuperacao?: string | null;
  brandLink?: string | null;
  fallback: string;
}): string {
  if (isUsableCtaLink(a.eventoCheckoutUrl)) return String(a.eventoCheckoutUrl).trim();
  if (isUsableCtaLink(a.leadLinkRecuperacao)) return String(a.leadLinkRecuperacao).trim();
  if (isUsableCtaLink(a.brandLink)) return String(a.brandLink).trim();
  return a.fallback;
}

// Pula quando as três valem juntas: o passo vai renderizar um CTA dinâmico, o
// evento gatilho é de recuperação transacional, e o link resolvido não presta.
// Sem evento gatilho → fail-open (passo criado fora de postback).
export function devePularPorFaltaDeLink(a: {
  usaCta: boolean;
  tipoEventoGatilho: string | null;
  linkResolvido: string;
}): boolean {
  if (!a.usaCta) return false;
  if (!a.tipoEventoGatilho || !EVENTOS_RECUPERACAO.has(a.tipoEventoGatilho)) return false;
  return !isUsableCtaLink(a.linkResolvido);
}
