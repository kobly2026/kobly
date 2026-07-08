-- 0030_ajuste_planos.sql
-- Kobly — Ajustes de planos pedidos pelo cliente (06/07/2026):
--   CFG-1: excluir (soft-delete) o plano "Legado 2024".
--   CFG-2: aumentar o limite de campanhas do plano Starter de 3 para 5.
-- Idempotente (re-executável). Soft-delete preserva o histórico de transações
-- que referenciam pl_4 (FK transactions.plano_id). A UI (Plans.jsx) já filtra
-- com !p.deleted, então o Legado 2024 some da listagem de planos disponíveis.
-- ---------------------------------------------------------------------------

-- CFG-1: Soft-delete do plano "Legado 2024" (descontinuado).
update public.plans
   set deleted = true,
       status  = 'Inativo'
 where nome = 'Legado 2024' and deleted = false;

-- CFG-2: Starter passa a permitir até 5 campanhas (antes 3).
update public.plans
   set limite_campanhas = 5
 where nome = 'Starter' and deleted = false;
