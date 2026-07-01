-- 0023_condicao_card_enum.sql
-- Kobly — card visual "Condição" (redirecionador IF/ELSE) no construtor de fluxo.
-- ALTER TYPE ... ADD VALUE não pode coexistir com o USO do novo valor na mesma
-- transação — migration separada da 0024 (colunas da árvore de ramos).
-- ---------------------------------------------------------------------------

alter type public.tipo_card_fluxo add value if not exists 'Condição';
