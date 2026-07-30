-- 0066_comentarios_isencao.sql
-- Kobly — só comentários. A 0065_gates_coerencia mudou o COMPORTAMENTO de
-- bulk_reserve_usage (org isenta parou de acumular excedente faturável) mas
-- não atualizou os comentários de 0061_plan_gates, que ainda descreviam o
-- comportamento antigo — chegaram a afirmar o oposto do que o código faz hoje.
--
-- organizations.limites_isentos dizia "NÃO isenta da medição de excedente de
-- mensagens"; desde a 0065 isenta, sim: numero_execucoes (uso) continua
-- contando para telemetria, mas execucoes_excedente (o excedente FATURÁVEL)
-- para de acumular para quem é isento.
--
-- Sem DDL, sem DML, sem CREATE OR REPLACE FUNCTION — só `comment on`.
-- ---------------------------------------------------------------------------

comment on column public.organizations.limites_isentos is
  'true = isenta dos gates de capacidade e das contagens. numero_execucoes (uso) continua sendo contado normalmente; execucoes_excedente (o excedente faturável) NÃO acumula para quem é isento — ver bulk_reserve_usage (0065).';

comment on function public.bulk_reserve_usage(uuid, integer) is
  'Contabiliza p_n mensagens da org. SOFT-CAP: sempre retorna true, nunca nega por franquia. numero_execucoes conta para toda org (telemetria), inclusive isenta. O que passa de plans.limite_execucoes acumula em usage_counters.execucoes_excedente para faturar — exceto quando organizations.limites_isentos = true, caso em que o excedente faturável não acumula (0065).';
