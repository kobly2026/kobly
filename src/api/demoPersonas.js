// Kobly — personas DEMO para o seletor de papéis do topbar.
// Cada papel (@TipoUserGeral) faz LOGIN REAL no Supabase Auth como a persona
// correspondente; a RLS multi-tenant faz o isolamento. As 4 personas são seedadas
// pela migration 0013 (auth.users + identities), com profiles linkados por e-mail.
// ⚠️ Credenciais de DEMO (a senha vai pro bundle). Trocar/rotacionar antes de produção.
export const DEMO_PASSWORD = 'kobly-demo-2026';

export const DEMO_PERSONAS = {
  Gestor:        { email: 'vitor@dizevolv.com',     contextLabel: 'Agência Dizevolv' },
  Cliente:       { email: 'joao@lojadojoao.com.br', contextLabel: 'Loja do João' },
  Suporte:       { email: 'marina@kobly.com',       contextLabel: 'Central Koblay' },
  Administrador: { email: 'daniela@kobly.com',      contextLabel: 'Admin Koblay' },
};
