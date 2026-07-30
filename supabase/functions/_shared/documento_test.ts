// Testes de src/lib/documento.js — CPF e CNPJ (numérico legado + alfanumérico 2026).
//
// Vivem aqui junto dos demais testes do repo (`deno test supabase/functions/_shared/`),
// embora o módulo sob teste seja do front: é JS puro, sem React e sem DOM.
//
// Rodar: deno test --allow-read supabase/functions/_shared/documento_test.ts
// (--allow-read é exigido pelos outros testes desta pasta, não por este.)
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  isCnpj,
  isCpf,
  isDocumentoBr,
  maskDocumento,
  normalizeDoc,
  tipoDocumento,
} from "../../../src/lib/documento.js";

// Exemplo oficial divulgado pela Receita para o formato alfanumérico.
const CNPJ_ALFA = "12ABC34501DE35";
// Derivado à mão pelo algoritmo da IN 2.229 (raiz toda em letras) — segunda
// amostra para não depender de um único vetor.
const CNPJ_ALFA_2 = "ABCDEFGH000195";
const CNPJ_NUM = "11222333000181";

Deno.test("normalizeDoc: tira máscara e sobe caixa", () => {
  assertEquals(normalizeDoc("12.abc.345/01de-35"), CNPJ_ALFA);
  assertEquals(normalizeDoc("11.222.333/0001-81"), CNPJ_NUM);
  assertEquals(normalizeDoc("529.982.247-25"), "52998224725");
  assertEquals(normalizeDoc(null), "");
  assertEquals(normalizeDoc(undefined), "");
});

Deno.test("isCnpj: aceita o numérico legado (com e sem máscara)", () => {
  assertEquals(isCnpj(CNPJ_NUM), true);
  assertEquals(isCnpj("11.222.333/0001-81"), true);
});

Deno.test("isCnpj: aceita o alfanumérico da IN 2.229", () => {
  assertEquals(isCnpj(CNPJ_ALFA), true);
  assertEquals(isCnpj("12.ABC.345/01DE-35"), true);
  assertEquals(isCnpj("12.abc.345/01de-35"), true, "minúscula é normalizada, não rejeitada");
  assertEquals(isCnpj(CNPJ_ALFA_2), true);
});

Deno.test("isCnpj: rejeita DV errado — o mesmo módulo 11 vale para os dois formatos", () => {
  assertEquals(isCnpj("11222333000182"), false);
  assertEquals(isCnpj("12ABC34501DE36"), false);
  assertEquals(isCnpj("12ABC34501DF35"), false, "mudar a base invalida o DV");
});

Deno.test("isCnpj: DV continua numérico — letra nas posições 13/14 é inválida", () => {
  assertEquals(isCnpj("12ABC34501DEA5"), false);
  assertEquals(isCnpj("12ABC34501DE3E"), false);
});

Deno.test("isCnpj: rejeita tamanho errado e caractere fora de [0-9A-Z]", () => {
  assertEquals(isCnpj(""), false);
  assertEquals(isCnpj("1122233300018"), false);
  assertEquals(isCnpj("112223330001811"), false);
  assertEquals(isCnpj("12ÁBC34501DE35"), false, "acento não existe no formato");
});

Deno.test("isCnpj: rejeita repetição total (numérica e alfabética)", () => {
  assertEquals(isCnpj("00000000000000"), false);
  assertEquals(isCnpj("11111111111111"), false);
  assertEquals(isCnpj("AAAAAAAAAAAAAA"), false);
});

Deno.test("isCpf: continua numérico e inalterado pela IN 2.229", () => {
  assertEquals(isCpf("52998224725"), true);
  assertEquals(isCpf("529.982.247-25"), true);
  assertEquals(isCpf("11144477735"), true);
  assertEquals(isCpf("52998224724"), false);
  assertEquals(isCpf("11111111111"), false);
  assertEquals(isCpf("5299822472A"), false, "CPF não aceita letra");
});

Deno.test("isDocumentoBr: aceita CPF e CNPJ, rejeita tamanhos intermediários", () => {
  assertEquals(isDocumentoBr("52998224725"), true);
  assertEquals(isDocumentoBr(CNPJ_ALFA), true);
  assertEquals(isDocumentoBr(CNPJ_NUM), true);
  assertEquals(isDocumentoBr("123456789012"), false);
  assertEquals(isDocumentoBr(""), false);
});

Deno.test("tipoDocumento: letra ⇒ CNPJ mesmo antes de completar 14", () => {
  assertEquals(tipoDocumento("12A"), "CNPJ");
  assertEquals(tipoDocumento("123456789012"), "CNPJ");
  assertEquals(tipoDocumento("52998224725"), "CPF");
  assertEquals(tipoDocumento("529982"), null);
});

Deno.test("maskDocumento: máscara do CNPJ preserva letras", () => {
  assertEquals(maskDocumento("12ABC34501DE35"), "12.ABC.345/01DE-35");
  assertEquals(maskDocumento("11222333000181"), "11.222.333/0001-81");
  assertEquals(maskDocumento("12abc34501de35"), "12.ABC.345/01DE-35");
});

Deno.test("maskDocumento: progressiva durante a digitação", () => {
  assertEquals(maskDocumento("12"), "12");
  assertEquals(maskDocumento("12A"), "12.A");
  assertEquals(maskDocumento("12ABC3"), "12.ABC.3");
  assertEquals(maskDocumento("12ABC3450"), "12.ABC.345/0");
  assertEquals(maskDocumento("12ABC34501DE3"), "12.ABC.345/01DE-3");
});

Deno.test("maskDocumento: CPF enquanto for só dígito e couber em 11", () => {
  assertEquals(maskDocumento("529"), "529");
  assertEquals(maskDocumento("529982"), "529.982");
  assertEquals(maskDocumento("52998224725"), "529.982.247-25");
});

Deno.test("maskDocumento: descarta excedente além de 14", () => {
  assertEquals(maskDocumento("12ABC34501DE35999"), "12.ABC.345/01DE-35");
});
