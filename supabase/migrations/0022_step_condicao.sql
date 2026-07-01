-- 0022_step_condicao.sql
-- Kobly — condição de envio por etapa (IF/ELSE do fluxo).
-- flow_steps.condicao controla SE o card de envio executa, avaliado pelo motor
-- (process-steps) NA HORA do envio, olhando se o lead teve "Compra Aprovada"
-- desde que esta execução do fluxo começou (scheduled_steps.created_at):
--   null | 'sempre'  → envia sempre (comportamento atual, retrocompatível)
--   'nao_comprou'    → só envia se o lead AINDA NÃO comprou (recuperação
--                      para de incomodar quem pagou no meio da cadência)
--   'comprou'        → só envia se o lead JÁ comprou (ex.: agradecimento
--                      pós-conversão dentro do mesmo fluxo)
-- Condição não atendida → etapa finalizada como "pulado" (sem envio, sem métrica).
-- ---------------------------------------------------------------------------

alter table public.flow_steps
  add column if not exists condicao text
  constraint flow_steps_condicao_check
  check (condicao is null or condicao in ('sempre', 'comprou', 'nao_comprou'));

comment on column public.flow_steps.condicao is 'Condição de envio do card, avaliada no envio: null/sempre | comprou | nao_comprou (vs. Compra Aprovada do lead desde o início da execução).';
