-- 0049_email_suppressions_citext.sql
-- Fix de review: `email_suppressions.email` foi criada como `text` puro em 0048,
-- então o índice único `email_suppressions_uq (email, organization_id)` compara
-- byte a byte — "Foo@Bar.com" e "foo@bar.com" viram linhas distintas e um
-- endereço suprimido poderia ser reenviado só variando a caixa das letras.
-- Todas as outras colunas de e-mail do schema usam `extensions.citext`
-- (0002_core_tables.sql, 0003_crm_and_email.sql, 0005_events_automation_support.sql).
-- Alinha esta coluna à convenção do repo: dedupe fica case-insensitive por
-- construção e fecha esse bypass. Tabela está vazia, então a conversão é trivial.
-- ---------------------------------------------------------------------------
alter table public.email_suppressions
  alter column email type extensions.citext using email::extensions.citext;
