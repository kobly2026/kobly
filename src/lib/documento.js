// Kobly — documento fiscal brasileiro (CPF / CNPJ), pronto para o CNPJ alfanumérico.
//
// IN RFB nº 2.229/2024: a partir de julho/2026 a Receita emite CNPJ com letras.
// Layout das 14 posições: 1–8 raiz [0-9A-Z], 9–12 ordem do estabelecimento
// [0-9A-Z], 13–14 dígitos verificadores (sempre numéricos). Máscara e tamanho
// não mudam; CNPJs já emitidos continuam válidos com o mesmo DV.
//
// O DV segue módulo 11, mas cada caractere vale (ASCII − 48): '0'=0 … '9'=9,
// 'A'=17, 'B'=18 … 'Z'=42. Como para dígitos isso devolve o próprio valor, o
// MESMO algoritmo valida o CNPJ numérico legado e o alfanumérico novo — não
// existe "validador antigo" a manter em paralelo.
//
// Regras que este módulo existe para impedir: `replace(/\D/g,'')` em documento
// (come as letras), coluna/parse numérico, e `length === 14` sem checar a classe
// de cada caractere.
//
// AUTORIDADE: o banco. `public.is_documento_br()` (migration 0060) roda o mesmo
// algoritmo em SQL e é quem barra dado inválido via CHECK em organizations.
// Este módulo é a camada de UX (máscara + erro inline antes do submit).
// Testes: supabase/functions/_shared/documento_test.ts (`deno test`).

/** Remove máscara e normaliza para a forma de armazenamento: A–Z maiúsculo + 0–9. */
export function normalizeDoc(valor) {
  return String(valor ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');
}

// DV do CNPJ: módulo 11 com pesos 2..9 ciclando da direita para a esquerda.
// Sobre `charCodeAt(i) - 48`, ver o cabeçalho.
function cnpjDv(base) {
  let soma = 0;
  let peso = 2;
  for (let i = base.length - 1; i >= 0; i--) {
    soma += (base.charCodeAt(i) - 48) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

// DV do CPF: módulo 11 com pesos decrescentes (10..2 no primeiro dígito).
function cpfDv(base) {
  let soma = 0;
  const pesoInicial = base.length + 1;
  for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i);
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

/** Valida CNPJ numérico (legado) ou alfanumérico (2026+). Aceita com ou sem máscara. */
export function isCnpj(valor) {
  const c = normalizeDoc(valor);
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(c)) return false;
  if (/^(.)\1{13}$/.test(c)) return false;
  const d1 = cnpjDv(c.slice(0, 12));
  const d2 = cnpjDv(c.slice(0, 12) + d1);
  return c.slice(12) === `${d1}${d2}`;
}

/** Valida CPF (11 dígitos). Inalterado pela IN 2.229 — CPF continua numérico. */
export function isCpf(valor) {
  const c = normalizeDoc(valor);
  if (!/^[0-9]{11}$/.test(c)) return false;
  if (/^(\d)\1{10}$/.test(c)) return false;
  const d1 = cpfDv(c.slice(0, 9));
  const d2 = cpfDv(c.slice(0, 9) + d1);
  return c.slice(9) === `${d1}${d2}`;
}

/** Aceita CPF (org de pessoa física / MEI) ou CNPJ. É o que o Asaas chama de cpfCnpj. */
export function isDocumentoBr(valor) {
  const c = normalizeDoc(valor);
  return c.length === 11 ? isCpf(c) : isCnpj(c);
}

/** 'CPF' | 'CNPJ' | null — pelo formato já digitado, sem validar DV. */
export function tipoDocumento(valor) {
  const c = normalizeDoc(valor);
  if (/[A-Z]/.test(c) || c.length > 11) return 'CNPJ';
  if (c.length === 11) return 'CPF';
  return null;
}

function maskCpf(c) {
  let out = c.slice(0, 3);
  if (c.length > 3) out += `.${c.slice(3, 6)}`;
  if (c.length > 6) out += `.${c.slice(6, 9)}`;
  if (c.length > 9) out += `-${c.slice(9, 11)}`;
  return out;
}

function maskCnpj(c) {
  let out = c.slice(0, 2);
  if (c.length > 2) out += `.${c.slice(2, 5)}`;
  if (c.length > 5) out += `.${c.slice(5, 8)}`;
  if (c.length > 8) out += `/${c.slice(8, 12)}`;
  if (c.length > 12) out += `-${c.slice(12, 14)}`;
  return out;
}

/**
 * Máscara progressiva (serve para digitação). Escolhe CPF ou CNPJ pelo conteúdo:
 * qualquer letra ⇒ CNPJ; mais de 11 caracteres ⇒ CNPJ; senão CPF.
 */
export function maskDocumento(valor) {
  const c = normalizeDoc(valor).slice(0, 14);
  return tipoDocumento(c) === 'CNPJ' ? maskCnpj(c) : maskCpf(c);
}
