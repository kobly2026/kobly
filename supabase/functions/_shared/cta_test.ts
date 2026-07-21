// supabase/functions/_shared/cta_test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  botoesUsamCta,
  corpoUsaCta,
  devePularPorFaltaDeLink,
  isUsableCtaLink,
  resolveCtaLink,
} from "./cta.ts";

Deno.test("isUsableCtaLink: aceita http(s) com host", () => {
  assertEquals(isUsableCtaLink("https://checkout.payt.com.br/qr-pix/ABC123"), true);
  assertEquals(isUsableCtaLink("http://loja.com/x"), true);
  assertEquals(isUsableCtaLink("  https://loja.com/x  "), true);
});

Deno.test("isUsableCtaLink: rejeita os fallbacks mortos que hoje saem no e-mail", () => {
  assertEquals(isUsableCtaLink("#"), false);
  assertEquals(isUsableCtaLink(""), false);
  assertEquals(isUsableCtaLink("   "), false);
  assertEquals(isUsableCtaLink(null), false);
  assertEquals(isUsableCtaLink(undefined), false);
  assertEquals(isUsableCtaLink("mailto:x@y.com"), false);
  assertEquals(isUsableCtaLink("javascript:alert(1)"), false);
  assertEquals(isUsableCtaLink("loja.com/sem-esquema"), false);
  assertEquals(isUsableCtaLink(123), false);
});

Deno.test("corpoUsaCta: detecta o placeholder no corpo", () => {
  assertEquals(corpoUsaCta('<a href="{{cta_link}}">Pagar</a>'), true);
  assertEquals(corpoUsaCta('<a href="https://fixo.com">Pagar</a>'), false);
  assertEquals(corpoUsaCta(null), false);
  assertEquals(corpoUsaCta(undefined), false);
});

Deno.test("botoesUsamCta: botao URL SEM url propria usa o CTA por default", () => {
  // process-steps:508 faz String(b?.url || "{{cta_link}}") — o botao usa o CTA
  // mesmo sem o placeholder aparecer em lugar nenhum. Detectar so pelo corpo
  // deixaria este caso passar pelo gate.
  assertEquals(botoesUsamCta([{ type: "URL", label: "Pagar" }]), true);
  assertEquals(botoesUsamCta([{ label: "Pagar" }]), true); // type default = URL
  assertEquals(botoesUsamCta([{ type: "URL", url: "{{cta_link}}" }]), true);
  assertEquals(botoesUsamCta([{ type: "URL", url: "https://fixo.com" }]), false);
  assertEquals(botoesUsamCta([{ type: "REPLY", label: "Oi" }]), false);
  assertEquals(botoesUsamCta([{ type: "CALL", phone: "11999999999" }]), false);
  assertEquals(botoesUsamCta([]), false);
  assertEquals(botoesUsamCta(null), false);
});

Deno.test("botoesUsamCta: so olha os 3 primeiros (mesmo corte do envio)", () => {
  const quatro = [
    { type: "URL", url: "https://a.com" },
    { type: "URL", url: "https://b.com" },
    { type: "URL", url: "https://c.com" },
    { type: "URL" }, // 4o usaria o CTA, mas e descartado no envio (slice(0,3))
  ];
  assertEquals(botoesUsamCta(quatro), false);
});

Deno.test("resolveCtaLink: evento gatilho tem prioridade sobre o lead", () => {
  // O link do evento e imutavel; o do lead e sobrescrito/pegajoso.
  assertEquals(
    resolveCtaLink({
      eventoCheckoutUrl: "https://checkout.payt.com.br/qr-pix/NOVO",
      leadLinkRecuperacao: "https://checkout.payt.com.br/qr-pix/ANTIGO",
      brandLink: "https://loja.com",
      fallback: "#",
    }),
    "https://checkout.payt.com.br/qr-pix/NOVO",
  );
});

Deno.test("resolveCtaLink: cai pro lead so quando o evento nao tem link utilizavel", () => {
  assertEquals(
    resolveCtaLink({ eventoCheckoutUrl: null, leadLinkRecuperacao: "https://l.com/x", brandLink: null, fallback: "#" }),
    "https://l.com/x",
  );
  assertEquals(
    resolveCtaLink({ eventoCheckoutUrl: "#", leadLinkRecuperacao: "https://l.com/x", brandLink: null, fallback: "#" }),
    "https://l.com/x",
  );
});

Deno.test("resolveCtaLink: brand e ultimo; fallback quando nada presta", () => {
  assertEquals(
    resolveCtaLink({ eventoCheckoutUrl: null, leadLinkRecuperacao: null, brandLink: "https://loja.com", fallback: "#" }),
    "https://loja.com",
  );
  assertEquals(
    resolveCtaLink({ eventoCheckoutUrl: null, leadLinkRecuperacao: null, brandLink: "", fallback: "#" }),
    "#",
  );
  // SMS usa fallback "" (process-steps:631), nao "#"
  assertEquals(
    resolveCtaLink({ eventoCheckoutUrl: null, leadLinkRecuperacao: null, brandLink: null, fallback: "" }),
    "",
  );
});

Deno.test("devePularPorFaltaDeLink: pula evento transacional sem link utilizavel", () => {
  for (const ev of ["Pix Gerado", "Boleto Gerado", "Abandono de carrinho", "Depósito Solicitado", "Compra Recusada"]) {
    assertEquals(
      devePularPorFaltaDeLink({ usaCta: true, tipoEventoGatilho: ev, linkResolvido: "#" }),
      true,
      `deveria pular em ${ev}`,
    );
  }
});

Deno.test("devePularPorFaltaDeLink: NAO pula quando o link presta", () => {
  assertEquals(
    devePularPorFaltaDeLink({ usaCta: true, tipoEventoGatilho: "Pix Gerado", linkResolvido: "https://c.com/x" }),
    false,
  );
});

Deno.test("devePularPorFaltaDeLink: NAO pula evento terminal nem passo sem CTA", () => {
  assertEquals(
    devePularPorFaltaDeLink({ usaCta: true, tipoEventoGatilho: "Compra Aprovada", linkResolvido: "#" }),
    false,
  );
  assertEquals(
    devePularPorFaltaDeLink({ usaCta: false, tipoEventoGatilho: "Pix Gerado", linkResolvido: "#" }),
    false,
  );
});

Deno.test("devePularPorFaltaDeLink: sem evento gatilho, nao pula (fail-open)", () => {
  // Passo criado fora de postback (webhook_event_id NULL) nao tem transacao
  // pendente conhecida — nao e caso deste gate.
  assertEquals(
    devePularPorFaltaDeLink({ usaCta: true, tipoEventoGatilho: null, linkResolvido: "#" }),
    false,
  );
});
