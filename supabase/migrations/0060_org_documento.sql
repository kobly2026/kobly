-- 0060_org_documento.sql
-- Kobly — documento fiscal da organização (CPF/CNPJ), já no formato alfanumérico.
--
-- POR QUÊ AGORA: `asaas/index.ts` cria o customer no gateway sem `cpfCnpj` — o
-- POST /customers do Asaas exige o documento, então o checkout só passa em
-- sandbox e quebraria em produção. Não havia onde guardar esse dado (nenhuma
-- coluna de documento existia no schema). Como o campo nasce agora, nasce já
-- aceitando o CNPJ alfanumérico da IN RFB nº 2.229/2024 (vigente desde
-- julho/2026) — nada de retrofit depois.
--
-- FORMATO (IN 2.229): 14 posições — 1–8 raiz [0-9A-Z], 9–12 ordem do
-- estabelecimento [0-9A-Z], 13–14 DV (sempre numéricos). DV segue módulo 11,
-- mas cada caractere vale (ASCII − 48): '0'=0 … '9'=9, 'A'=17 … 'Z'=42. Para
-- dígitos isso devolve o próprio valor, logo UM algoritmo cobre o CNPJ legado
-- e o novo. CNPJs já emitidos seguem válidos, com o mesmo DV.
--
-- ARMAZENAMENTO: `text` normalizado (sem máscara, A–Z maiúsculo). Nunca
-- numérico/bigint — letras não cabem. A máscara é só apresentação.
-- Espelho em JS (camada de UX): src/lib/documento.js. A AUTORIDADE é este
-- CHECK: cliente que mandar documento inválido ou mascarado toma erro do banco.
-- ---------------------------------------------------------------------------

-- DV de CNPJ (numérico ou alfanumérico): módulo 11, pesos 2..9 ciclando da
-- direita para a esquerda. Recebe a base já normalizada.
create or replace function public.cnpj_dv(p_base text)
returns int language plpgsql immutable strict set search_path = ''
as $$
declare soma int := 0; peso int := 2; i int; resto int;
begin
  for i in reverse length(p_base)..1 loop
    soma := soma + (ascii(substr(p_base, i, 1)) - 48) * peso;
    peso := case when peso = 9 then 2 else peso + 1 end;
  end loop;
  resto := soma % 11;
  return case when resto < 2 then 0 else 11 - resto end;
end;
$$;

-- Exige entrada JÁ normalizada (sem máscara, caixa alta): valor mascarado deve
-- falhar alto no CHECK em vez de entrar cru no banco.
create or replace function public.is_cnpj_br(p_cnpj text)
returns boolean language plpgsql immutable strict set search_path = ''
as $$
declare d1 int; d2 int;
begin
  if p_cnpj !~ '^[0-9A-Z]{12}[0-9]{2}$' then return false; end if;
  if p_cnpj ~ '^(.)\1{13}$' then return false; end if;
  d1 := public.cnpj_dv(substr(p_cnpj, 1, 12));
  d2 := public.cnpj_dv(substr(p_cnpj, 1, 12) || d1::text);
  return substr(p_cnpj, 13, 2) = (d1::text || d2::text);
end;
$$;

-- CPF: inalterado pela IN 2.229 (segue numérico, pesos decrescentes).
create or replace function public.is_cpf_br(p_cpf text)
returns boolean language plpgsql immutable strict set search_path = ''
as $$
declare soma int; i int; resto int; d1 int; d2 int;
begin
  if p_cpf !~ '^[0-9]{11}$' then return false; end if;
  if p_cpf ~ '^(.)\1{10}$' then return false; end if;
  soma := 0;
  for i in 1..9 loop
    soma := soma + (ascii(substr(p_cpf, i, 1)) - 48) * (11 - i);
  end loop;
  resto := (soma * 10) % 11;
  d1 := case when resto = 10 then 0 else resto end;
  soma := 0;
  for i in 1..9 loop
    soma := soma + (ascii(substr(p_cpf, i, 1)) - 48) * (12 - i);
  end loop;
  soma := soma + d1 * 2;
  resto := (soma * 10) % 11;
  d2 := case when resto = 10 then 0 else resto end;
  return substr(p_cpf, 10, 2) = (d1::text || d2::text);
end;
$$;

-- CPF (org de pessoa física / MEI) ou CNPJ — é o `cpfCnpj` do Asaas.
create or replace function public.is_documento_br(p_doc text)
returns boolean language sql immutable strict set search_path = ''
as $$
  select case when length(p_doc) = 11 then public.is_cpf_br(p_doc) else public.is_cnpj_br(p_doc) end;
$$;

comment on function public.is_documento_br(text) is
  'Valida CPF (11 dígitos) ou CNPJ (14, numérico ou alfanumérico da IN RFB 2.229/2024). Exige entrada normalizada: sem máscara, A-Z maiúsculo. Espelho em JS: src/lib/documento.js.';

alter table public.organizations
  add column if not exists documento text;

comment on column public.organizations.documento is
  'CPF/CNPJ da organização, normalizado (sem máscara, caixa alta). Enviado ao Asaas como cpfCnpj. Aceita CNPJ alfanumérico.';

alter table public.organizations
  drop constraint if exists organizations_documento_valido;
alter table public.organizations
  add constraint organizations_documento_valido
  check (documento is null or public.is_documento_br(documento));
