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

// ── Teste anti-drift: bloco inline em process-steps/index.ts vs este módulo ──
//
// Por quê: nenhuma edge function deployada importa _shared/cta.ts — o deploy é
// por função e não empacota ../_shared/, então process-steps/index.ts carrega uma
// CÓPIA inline da lógica (bloco que começa no comentário "// Inlinado de
// _shared/cta.ts"). Os 12 testes acima só exercitam ESTE módulo. Se alguém editar
// só um dos dois lados, esses testes continuam verdes atestando um comportamento
// que não é o que roda em produção.
//
// Abordagem escolhida: (a) comparação TEXTUAL — extrai o corpo de cada
// função/constante de ambos os arquivos por nome (varredura de chaves
// balanceadas, não regex ingênua, para lidar com os tipos de parâmetro
// multilinha de resolveCtaLink/devePularPorFaltaDeLink) e compara após
// normalizar espaço em branco. NÃO usei (b) (materializar o bloco inline como
// módulo importável via Deno.makeTempFile + import dinâmico e rodar a mesma
// matriz de entradas): validado que Deno.test não pode escalar permissão além
// da concedida ao processo pai ("NotCapable: Can't escalate parent thread
// permissions" — testado localmente), então (b) obrigaria rodar ESTE arquivo
// inteiro com `--allow-read --allow-write`, além de executar como código texto
// extraído de outro arquivo (superfície que um teste deveria evitar). (a) só
// precisa de --allow-read (ler process-steps/index.ts como texto), não executa
// nada extraído, e é determinística. Trade-off aceito conscientemente: duas
// implementações textualmente idênticas após normalizar espaço em branco são
// necessariamente idênticas em comportamento (mesmos operadores, identificadores,
// literais, estrutura) — qualquer mudança de LÓGICA sobra no texto normalizado e
// é pega; o que (a) NÃO pega é diferença de comentário DENTRO do corpo da função
// (nenhuma das duas cópias tem, hoje) ou reordenação de código sem efeito
// observável (nenhuma das cinco funções tem trechos comutativos hoje).
function extractBalanced(src: string, openIdx: number, open: string, close: string): number {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === open) depth++;
    else if (src[i] === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error(`'${open}' no offset ${openIdx} nunca fecha (arquivo truncado ou malformado?)`);
}

// Extrai "function NOME(...) { ... }" com chaves balanceadas — não usa regex
// gulosa porque resolveCtaLink/devePularPorFaltaDeLink têm tipo de parâmetro
// multilinha com "{" próprio (o `{` do TIPO do parâmetro não é o `{` do corpo).
function extractFunctionSrc(src: string, name: string, label: string): string {
  const sig = new RegExp(`function\\s+${name}\\s*\\(`).exec(src);
  if (!sig) {
    throw new Error(
      `função '${name}' não encontrada em ${label} — ` +
        `o bloco inline em process-steps divergiu de _shared/cta.ts — sincronize as duas cópias.`,
    );
  }
  const parenOpen = src.indexOf("(", sig.index);
  const parenClose = extractBalanced(src, parenOpen, "(", ")"); // pula o tipo do parâmetro inteiro, mesmo com "{" dentro
  const bodyOpen = src.indexOf("{", parenClose);
  if (bodyOpen === -1) throw new Error(`corpo de '${name}' não encontrado em ${label}.`);
  const bodyClose = extractBalanced(src, bodyOpen, "{", "}");
  return src.slice(sig.index, bodyClose + 1);
}

function extractConstSrc(src: string, name: string, label: string): string {
  const m = new RegExp(`(?:export\\s+)?const\\s+${name}\\b[\\s\\S]*?;`).exec(src);
  if (!m) {
    throw new Error(
      `constante '${name}' não encontrada em ${label} — ` +
        `o bloco inline em process-steps divergiu de _shared/cta.ts — sincronize as duas cópias.`,
    );
  }
  return m[0];
}

// Normaliza só espaço em branco (e o "export " que só o módulo tem — a cópia
// inline nunca exporta, isso é esperado, não é drift). Não mexe em identificadores,
// operadores nem literais: mudança de lógica sobrevive à normalização e quebra o teste.
function normalizeSnippet(s: string): string {
  return s.replace(/^export\s+/, "").replace(/\s+/g, " ").trim();
}

Deno.test("anti-drift: bloco inline em process-steps/index.ts bate com _shared/cta.ts", async () => {
  const moduleSrc = await Deno.readTextFile(new URL("./cta.ts", import.meta.url));
  const inlineFullSrc = await Deno.readTextFile(new URL("../process-steps/index.ts", import.meta.url));

  const MARKER = "// Inlinado de _shared/cta.ts";
  const markerIdx = inlineFullSrc.indexOf(MARKER);
  if (markerIdx === -1) {
    throw new Error(
      `marcador '${MARKER}' não encontrado em process-steps/index.ts — o bloco inline de CTA ` +
        `sumiu ou o comentário-âncora mudou. Se a lógica ainda está lá, restaure o comentário; ` +
        `se foi removida de propósito (ex.: process-steps passou a importar _shared/cta.ts ` +
        `direto), apague este teste anti-drift junto.`,
    );
  }
  const inlineSrc = inlineFullSrc.slice(markerIdx);

  const CONST_NAMES = ["EVENTOS_RECUPERACAO", "PULADO_SEM_LINK"];
  const FN_NAMES = [
    "isUsableCtaLink",
    "corpoUsaCta",
    "botoesUsamCta",
    "resolveCtaLink",
    "devePularPorFaltaDeLink",
  ];

  for (const name of CONST_NAMES) {
    const fromModule = normalizeSnippet(extractConstSrc(moduleSrc, name, "_shared/cta.ts"));
    const fromInline = normalizeSnippet(extractConstSrc(inlineSrc, name, "process-steps/index.ts (bloco inline)"));
    assertEquals(
      fromInline,
      fromModule,
      `constante '${name}': o bloco inline em process-steps divergiu de _shared/cta.ts — sincronize as duas cópias.`,
    );
  }

  for (const name of FN_NAMES) {
    const fromModule = normalizeSnippet(extractFunctionSrc(moduleSrc, name, "_shared/cta.ts"));
    const fromInline = normalizeSnippet(extractFunctionSrc(inlineSrc, name, "process-steps/index.ts (bloco inline)"));
    assertEquals(
      fromInline,
      fromModule,
      `função '${name}': o bloco inline em process-steps divergiu de _shared/cta.ts — sincronize as duas cópias.`,
    );
  }
});
