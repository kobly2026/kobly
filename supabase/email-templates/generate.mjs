// Gera os templates de e-mail de AUTH (Supabase GoTrue) com o visual da marca
// Koblay, reusando o renderEmail dos e-mails de campanha (fonte da verdade).
//
// Uso:  node supabase/email-templates/generate.mjs
//
// Os arquivos .html resultantes são colados manualmente no dashboard:
//   Authentication → Emails → Templates
// (o GoTrue não versiona templates via código; este diretório é a referência.)
//
// Variáveis do GoTrue mantidas literais para substituição no envio:
//   {{ .ConfirmationURL }}  — link de ação (confirmar, aceitar convite, redefinir)
import { renderEmail } from '../../src/lib/emailTemplate.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const brand = { name: 'Koblay', mode: 'dark', color: '#ff6800' };
const URL = '{{ .ConfirmationURL }}';

const templates = {
  'confirm-signup': {
    preheader: 'Confirme seu e-mail para ativar sua conta na Koblay.',
    blocks: [
      { type: 'hero', eyebrow: 'Bem-vindo(a)', title: 'Confirme seu e-mail', text: 'Falta só um passo para ativar sua conta na Koblay e começar a recuperar vendas.' },
      { type: 'button', label: 'Confirmar meu e-mail', href: URL },
      { type: 'note', text: 'Se o botão não funcionar, copie e cole este link no navegador:' },
      { type: 'paragraph', text: URL },
      { type: 'divider' },
      { type: 'note', text: 'Se você não criou uma conta na Koblay, pode ignorar este e-mail com segurança.' },
    ],
  },
  'invite-user': {
    preheader: 'Você foi convidado para uma conta na Koblay.',
    blocks: [
      { type: 'hero', eyebrow: 'Convite', title: 'Você foi convidado para a Koblay', text: 'Aceite o convite abaixo para definir sua senha e acessar o painel da sua conta.' },
      { type: 'button', label: 'Aceitar convite', href: URL },
      { type: 'note', text: 'Se o botão não funcionar, copie e cole este link no navegador:' },
      { type: 'paragraph', text: URL },
      { type: 'divider' },
      { type: 'note', text: 'Se você não esperava este convite, pode ignorar este e-mail.' },
    ],
  },
  'reset-password': {
    preheader: 'Redefina a senha da sua conta Koblay.',
    blocks: [
      { type: 'hero', eyebrow: 'Segurança', title: 'Redefinir sua senha', text: 'Recebemos um pedido para redefinir a senha da sua conta. Clique abaixo para criar uma nova senha.' },
      { type: 'button', label: 'Redefinir senha', href: URL },
      { type: 'note', text: 'Se o botão não funcionar, copie e cole este link no navegador:' },
      { type: 'paragraph', text: URL },
      { type: 'divider' },
      { type: 'note', text: 'Se você não pediu isso, ignore este e-mail — sua senha continua a mesma.' },
    ],
  },
  'magic-link': {
    preheader: 'Seu link de acesso à Koblay.',
    blocks: [
      { type: 'hero', eyebrow: 'Acesso', title: 'Seu link de acesso', text: 'Clique no botão abaixo para entrar na sua conta Koblay. O link é válido por tempo limitado.' },
      { type: 'button', label: 'Entrar na Koblay', href: URL },
      { type: 'note', text: 'Se o botão não funcionar, copie e cole este link no navegador:' },
      { type: 'paragraph', text: URL },
      { type: 'divider' },
      { type: 'note', text: 'Se você não pediu este link, pode ignorar este e-mail.' },
    ],
  },
};

// Rodapé transacional: e-mail de conta não leva "Descadastrar" nem "interagiu
// com a loja" (isso é copy de campanha).
function transactionalFooter(html) {
  return html
    .replace('<a href="#" style="color:#808080;text-decoration:underline;">Descadastrar</a>', '<a href="mailto:contato@koblay.io" style="color:#808080;text-decoration:underline;">Suporte</a>')
    .replace('Você recebeu este e-mail porque interagiu com a loja.', 'E-mail automático de segurança da sua conta Koblay.');
}

const outDir = dirname(fileURLToPath(import.meta.url));
mkdirSync(outDir, { recursive: true });
for (const [name, cfg] of Object.entries(templates)) {
  const html = transactionalFooter(renderEmail({ brand, preheader: cfg.preheader, blocks: cfg.blocks }));
  writeFileSync(join(outDir, `${name}.html`), html, 'utf8');
  console.log(`gerado: ${name}.html (${html.length} bytes)`);
}
