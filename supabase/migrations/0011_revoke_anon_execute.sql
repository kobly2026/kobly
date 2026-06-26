-- 0011_revoke_anon_execute.sql
-- Kobly — fecha definitivamente o RPC anônimo das funções SECURITY DEFINER.
-- O Supabase concede EXECUTE EXPLÍCITO a anon/authenticated/service_role nas funções
-- de `public` via ALTER DEFAULT PRIVILEGES — por isso o `revoke from public` de 0010
-- não bastou (anon mantinha o grant explícito). Aqui revogamos de `anon` diretamente,
-- limpando o lint 0028 (anon_security_definer_function_executable).
-- `authenticated` MANTÉM o EXECUTE: as policies de RLS precisam chamá-las (lint 0029
-- remanescente nos 7 helpers é o padrão aceito de helpers de RLS — não vaza dados).
-- ---------------------------------------------------------------------------

revoke execute on function public.current_profile_id() from anon;
revoke execute on function public.current_role_geral() from anon;
revoke execute on function public.is_admin() from anon;
revoke execute on function public.is_support() from anon;
revoke execute on function public.is_gestor() from anon;
revoke execute on function public.my_org_ids() from anon;
revoke execute on function public.has_org_access(uuid) from anon;

-- Funções de trigger: não devem ser chamáveis por NINGUÉM via RPC (o trigger as
-- dispara sem checar EXECUTE). authenticated já foi revogado em 0010; remove anon.
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.tg_profiles_guard() from anon;
