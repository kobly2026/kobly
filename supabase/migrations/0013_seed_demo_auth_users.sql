-- 0013_seed_demo_auth_users.sql
-- Kobly — usuários de AUTENTICAÇÃO demo (logáveis) para o seletor de papéis.
-- Cada papel do topbar faz login real como uma destas personas; a RLS faz o
-- isolamento. Senha demo: kobly-demo-2026 (bcrypt via pgcrypto).
-- O trigger handle_new_user (0006) linka profiles.auth_id por e-mail no INSERT.
-- IDs determinísticos (uuid_generate_v5) -> idempotente. Tokens setados como ''
-- para evitar o bug de scan-NULL do GoTrue no login.
-- ⚠️ APENAS DEMO. Trocar/rotacionar senhas antes de produção.
-- ---------------------------------------------------------------------------

create or replace function pg_temp.kid(legacy text)
returns uuid language sql immutable
as $$ select extensions.uuid_generate_v5('a0000000-0000-0000-0000-0000000000ff'::uuid, 'kobly:' || legacy); $$;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  pg_temp.kid('auth:' || u.legacy),
  'authenticated', 'authenticated', u.email,
  extensions.crypt('kobly-demo-2026', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('nome', u.nome),
  now(), now(), '', '', '', ''
from (values
  ('u_vitor',   'vitor@dizevolv.com',        'Vitor Andrade'),
  ('u_joao',    'joao@lojadojoao.com.br',    'João Mendes'),
  ('u_marina',  'marina@kobly.com',          'Marina Costa'),
  ('u_daniela', 'daniela@kobly.com',         'Daniela Rocha')
) as u(legacy, email, nome)
on conflict (id) do nothing;

-- Identidade 'email' exigida pelo GoTrue para login por senha.
insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select au.id::text, au.id,
       jsonb_build_object('sub', au.id::text, 'email', au.email, 'email_verified', true, 'phone_verified', false),
       'email', now(), now(), now()
from auth.users au
where au.email in ('vitor@dizevolv.com','joao@lojadojoao.com.br','marina@kobly.com','daniela@kobly.com')
on conflict do nothing;
