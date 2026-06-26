-- 0010_security_perf_hardening.sql
-- Kobly — remediação dos advisors do Supabase pós-aplicação do schema.
-- 1) Least-privilege de EXECUTE nas funções SECURITY DEFINER (fecha o RPC para anon;
--    funções de trigger não são chamáveis por ninguém — o trigger dispara sem checar EXECUTE).
-- 2) auth_rls_initplan: envolve auth.uid() em subselect nas policies de profiles (1 avaliação/consulta).
-- 3) multiple_permissive_policies: transactions/usage_counters — escrita admin sem sobrepor o SELECT.
-- 4) unindexed_foreign_keys: índices nas FKs created_by.
-- NOTA: o lint "authenticated_security_definer" remanescente nos 7 helpers é o padrão
-- documentado de helpers de RLS — `authenticated` PRECISA de EXECUTE para as policies
-- avaliarem; chamá-los direto não vaza dados (retornam o status do próprio chamador).
-- ---------------------------------------------------------------------------

-- 1) EXECUTE least-privilege ----------------------------------------------
-- Helpers de RLS: remove o grant implícito de PUBLIC (do qual anon dependia);
-- authenticated mantém o grant explícito de 0006.
revoke execute on function public.current_profile_id() from public;
revoke execute on function public.current_role_geral() from public;
revoke execute on function public.is_admin() from public;
revoke execute on function public.is_support() from public;
revoke execute on function public.is_gestor() from public;
revoke execute on function public.my_org_ids() from public;
revoke execute on function public.has_org_access(uuid) from public;

-- Funções de trigger SECURITY DEFINER: nunca devem ser chamadas via RPC.
-- O trigger as invoca sem checar EXECUTE, então revogar de todos é seguro.
revoke execute on function public.handle_new_user() from public, authenticated;
revoke execute on function public.tg_profiles_guard() from public, authenticated;

-- 2) auth_rls_initplan — (select auth.uid()) em profiles --------------------
drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
using (
  auth_id = (select auth.uid())
  or public.is_admin()
  or public.is_support()
  or (public.is_gestor() and public.has_org_access(organization_id))
);

drop policy profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
using (auth_id = (select auth.uid()) or public.is_admin())
with check (auth_id = (select auth.uid()) or public.is_admin());

-- 3) multiple_permissive_policies — split write (sem sobrepor SELECT) -------
drop policy transactions_write on public.transactions;
create policy transactions_insert on public.transactions for insert to authenticated with check (public.is_admin());
create policy transactions_update on public.transactions for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy transactions_delete on public.transactions for delete to authenticated using (public.is_admin());

drop policy usage_counters_write on public.usage_counters;
create policy usage_counters_insert on public.usage_counters for insert to authenticated with check (public.is_admin());
create policy usage_counters_update on public.usage_counters for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy usage_counters_delete on public.usage_counters for delete to authenticated using (public.is_admin());

-- 4) unindexed_foreign_keys — created_by ------------------------------------
create index idx_campaigns_created_by on public.campaigns (created_by);
create index idx_domains_created_by on public.domains (created_by);
create index idx_emails_created_by on public.emails (created_by);
create index idx_leads_created_by on public.leads (created_by);
create index idx_memberships_created_by on public.organization_memberships (created_by);
create index idx_tags_created_by on public.tags (created_by);
create index idx_transactions_created_by on public.transactions (created_by);
create index idx_webhooks_created_by on public.webhooks (created_by);
