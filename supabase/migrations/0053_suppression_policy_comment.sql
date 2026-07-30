-- 0053_suppression_policy_comment.sql
-- Documentação apenas — nenhuma mudança de schema.
--
-- A policy email_suppressions_read (0048_email_suppressions.sql) exige
-- `organization_id is not null` além de has_org_access(organization_id). Isso é
-- DELIBERADO: linhas GLOBAIS (organization_id = null, ex.: bounce permanente) ficam
-- invisíveis para QUALQUER tenant, inclusive admins da própria org, via API/UI —
-- não existe leitura nem escrita client-side para elas.
--
-- Consequência: hoje a ÚNICA forma de remover uma supressão global é acesso direto
-- ao banco (execute_sql / psql), pois não há policy de escrita nem UI de reversão
-- para linhas com organization_id null. Se um endereço for suprimido globalmente por
-- engano, o operador precisa de acesso direto ao Postgres para desfazer.
comment on table public.email_suppressions is
  'Lista de supressão de e-mail. organization_id = null significa supressão GLOBAL '
  '(todas as orgs, ex.: bounce permanente). Ver comentário da policy '
  'email_suppressions_read: linhas globais são deliberadamente ocultas de tenants e '
  'admins via API/UI, e só podem ser removidas por acesso direto ao banco.';

comment on policy email_suppressions_read on public.email_suppressions is
  'Exige organization_id IS NOT NULL de propósito: esconde supressões GLOBAIS '
  '(organization_id null, ex.: bounce permanente escrito pelo resend-webhook) de '
  'QUALQUER tenant/admin via API/UI, mesmo com has_org_access(). Não há policy de '
  'escrita nem endpoint/UI para reverter uma supressão global — a única forma de '
  'remover uma dessas é acesso direto ao Postgres (execute_sql/psql). Não relaxe '
  'este guard sem antes decidir como uma reversão de supressão global fica segura '
  'e auditável.';
