-- 0063_planos_schema_e_precos.sql
-- Kobly — schema e preços para a cobrança real dos planos. INERTE: não muda
-- comportamento. A ativação está na 0064.
--
-- Decisões registradas em docs/superpowers/specs/2026-07-30-planos-cobranca-real-design.md:
--
-- EXCEDENTE escalonado por plano (R$/mensagem acima da franquia). Faz o upgrade
-- ser sempre a escolha racional em 2x a franquia, sem punir ninguém: um Starter
-- que manda 10.000 paga 97 + 5.000*0,02 = R$197, exatamente o preço do Pro, onde
-- teria 25.000. O cliente nunca paga mais que o tier de cima sem perceber.
--
-- SEMESTRAL arredondado PARA BAIXO, para o desconto real nunca ficar abaixo dos
-- -8% que a página anuncia (8,08% / 8,04% / 8,02%).
--
-- limite_numeros_whatsapp: coluna morta. Nenhuma função, trigger ou linha de
-- código a lê (verificado em 2026-07-30). O WhatsApp é single-tenant — os
-- secrets zapi_instance_id/zapi_token são globais, não por org — e número único
-- passou a ser decisão de produto. Valores originais, caso alguém precise:
-- Starter 1, Pro 2, Scale 4.
-- ---------------------------------------------------------------------------
alter table public.plans add column if not exists valor_semestral numeric;

comment on column public.plans.valor_semestral is
  'Valor do ciclo semestral (Asaas cycle=SEMIANNUALLY). Nulo = plano nao oferece semestral; asaas/index.ts recusa o ciclo em vez de cobrar outro valor.';

comment on column public.plans.preco_excedente is
  'R$ por mensagem acima da franquia do periodo. Lido por reset_usage_cycles() ao arquivar em usage_period_history.';

update public.plans set valor_semestral = 535,  preco_excedente = 0.020 where nome = 'Starter' and deleted = false;
update public.plans set valor_semestral = 1087, preco_excedente = 0.010 where nome = 'Pro'     and deleted = false;
update public.plans set valor_semestral = 2191, preco_excedente = 0.005 where nome = 'Scale'   and deleted = false;

alter table public.plans drop column if exists limite_numeros_whatsapp;

-- Guarda: os 3 planos ativos precisam sair daqui completos.
do $$
declare n int;
begin
  select count(*) into n
    from public.plans
   where status = 'Ativo' and deleted = false
     and (valor_semestral is null or preco_excedente is null);
  if n > 0 then
    raise exception 'ha % plano(s) ativo(s) sem valor_semestral ou preco_excedente', n;
  end if;
end $$;
