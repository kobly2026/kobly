-- 0051_org_reply_to_citext.sql
-- Fix de review: `organizations.reply_to_email` foi criada como `text` puro em
-- 0050, mas todas as outras colunas de e-mail do schema usam
-- `extensions.citext` (0002_core_tables.sql, 0003_crm_and_email.sql,
-- 0005_events_automation_support.sql, 0049_email_suppressions_citext.sql) —
-- convenção reforçada explicitamente na migration anterior. Diferente de
-- 0049, aqui não há bug de correção: `reply_to_email` nunca é comparado, só é
-- ecoado no header `Reply-To` dos envios, então `text` funcionaria igual. A
-- conversão é puramente por consistência de schema. Coluna está vazia
-- (recém-criada, sem uso ainda), então a conversão é trivial.
-- ---------------------------------------------------------------------------
alter table public.organizations
  alter column reply_to_email type extensions.citext using reply_to_email::extensions.citext;
