-- 0024_condicao_card_tree.sql
-- Kobly — árvore de ramos do card "Condição" (redirecionador IF/ELSE).
-- Um step filho aponta pro card Condição via parent_step_id e diz em qual ramo
-- está (ramo 'sim' = lead JÁ comprou · 'nao' = ainda NÃO comprou). No SAVE o
-- builder COMPILA o ramo na coluna condicao do filho ('comprou'/'nao_comprou',
-- 0022) — o motor (process-steps) continua avaliando só a condicao por step,
-- sem conhecer a árvore; parent/ramo existem para reconstruir o desenho na UI.
-- Filhos são removidos junto com o card Condição (on delete cascade).
-- ---------------------------------------------------------------------------

alter table public.flow_steps
  add column if not exists parent_step_id uuid references public.flow_steps(id) on delete cascade;

alter table public.flow_steps
  add column if not exists ramo text
  constraint flow_steps_ramo_check
  check (ramo is null or ramo in ('sim', 'nao'));

comment on column public.flow_steps.parent_step_id is 'Card Condição pai (árvore de ramos do builder); filhos caem em cascata com o pai.';
comment on column public.flow_steps.ramo is 'Ramo do card Condição pai: sim (lead JÁ comprou) | nao (ainda NÃO comprou). Compilado em condicao no save.';

create index if not exists idx_flow_steps_parent_step_id on public.flow_steps (parent_step_id);
