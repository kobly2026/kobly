// Kobly — Email Design System.
// HTML de e-mail à prova de cliente (layout em <table>, estilos inline, bgcolor para
// Outlook) na identidade visual do Kobly: tema escuro + acento laranja, tipografia
// Plus Jakarta (com fallback de sistema) e componentes reutilizáveis.
//
// Uso declarativo:
//   renderEmail({ brand: { name, initial }, preheader, blocks: [ {type:'hero', ...}, ... ] })
// Blocos disponíveis: hero · paragraph · button · coupon · product · bullets · divider · spacer · note
//
// Consumido por: o gerador "Gerar HTML" do editor (src/api/ai.js) e o rebrand das
// campanhas. O worker (process-steps) envia o corpo_html resultante como está.

const C = {
  bg: '#000000', // surface-app (preto)
  card: '#1a1a1a', // surface-card
  raised: '#242424', // chips / caixas internas
  borderSubtle: '#2a2a2a',
  border: '#3a3a3a',
  strong: '#f9f9f9', // texto forte
  body: '#cfcfcf', // texto corpo
  muted: '#808080', // texto apagado
  accent: '#ff6800', // laranja primário
  accentInk: '#1a1a1a', // texto escuro sobre laranja
  success: '#3ddc84',
};
const FONT =
  "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function esc(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── Componentes (cada um devolve um trecho de HTML email-safe) ──────────────

// Monograma da loja: quadrado laranja arredondado com a inicial (linguagem do mark Kobly).
function monogram(initial) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td width="40" height="40" align="center" valign="middle" bgcolor="${C.accent}" style="width:40px;height:40px;border-radius:11px;font-family:${FONT};font-size:20px;font-weight:800;color:${C.accentInk};line-height:40px;text-align:center;">${esc(initial || 'L')}</td>
  </tr></table>`;
}

// Mark do Kobly em miniatura (footer "Enviado com Kobly").
function koblyMark(size = 18) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;vertical-align:middle;"><tr>
    <td width="${size}" height="${size}" align="center" valign="middle" bgcolor="${C.accent}" style="width:${size}px;height:${size}px;border-radius:5px;font-family:${FONT};font-size:${Math.round(size * 0.62)}px;font-weight:800;color:${C.accentInk};line-height:${size}px;text-align:center;">K</td>
  </tr></table>`;
}

function hero({ eyebrow, title, text }) {
  return `
  ${eyebrow ? `<p style="margin:0 0 10px;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:${C.accent};">${esc(eyebrow)}</p>` : ''}
  ${title ? `<h1 style="margin:0 0 14px;font-family:${FONT};font-size:27px;line-height:1.2;font-weight:800;color:${C.strong};">${esc(title)}</h1>` : ''}
  ${text ? `<p style="margin:0 0 4px;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.body};">${esc(text)}</p>` : ''}`;
}

function paragraph({ text }) {
  return `<p style="margin:14px 0 0;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.body};">${esc(text)}</p>`;
}

function note({ text }) {
  return `<p style="margin:18px 0 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.muted};">${esc(text)}</p>`;
}

// CTA bulletproof (com VML para o Outlook desktop).
function button({ label, href = '#' }) {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 4px;"><tr><td align="left">
    <!--[if mso]>
    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${esc(href)}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="22%" fillcolor="${C.accent}" stroke="f">
      <w:anchorlock/><center style="color:${C.accentInk};font-family:${FONT};font-size:15px;font-weight:700;">${esc(label)}</center>
    </v:roundrect>
    <![endif]-->
    <!--[if !mso]><!-- -->
    <a href="${esc(href)}" style="display:inline-block;background:${C.accent};color:${C.accentInk};font-family:${FONT};font-size:15px;font-weight:700;text-decoration:none;padding:14px 30px;border-radius:11px;">${esc(label)}</a>
    <!--<![endif]-->
  </td></tr></table>`;
}

// Caixa de cupom: borda tracejada laranja + código em destaque.
function coupon({ code, detail }) {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0 4px;"><tr>
    <td bgcolor="${C.raised}" style="background:${C.raised};border:1px dashed ${C.accent};border-radius:12px;padding:18px 20px;">
      ${detail ? `<p style="margin:0 0 6px;font-family:${FONT};font-size:12px;font-weight:600;letter-spacing:.6px;text-transform:uppercase;color:${C.muted};">${esc(detail)}</p>` : ''}
      <p style="margin:0;font-family:${FONT};font-size:24px;font-weight:800;letter-spacing:3px;color:${C.accent};">${esc(code)}</p>
    </td>
  </tr></table>`;
}

// Card de produto (sem imagem — entregabilidade): nome, preço e nota.
function product({ name, price, note: pnote }) {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:22px 0 4px;"><tr>
    <td bgcolor="${C.raised}" style="background:${C.raised};border:1px solid ${C.border};border-radius:12px;padding:16px 18px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
        <td valign="middle" style="font-family:${FONT};">
          <p style="margin:0;font-size:15px;font-weight:700;color:${C.strong};">${esc(name)}</p>
          ${pnote ? `<p style="margin:4px 0 0;font-size:13px;color:${C.muted};">${esc(pnote)}</p>` : ''}
        </td>
        ${price ? `<td valign="middle" align="right" style="font-family:${FONT};font-size:16px;font-weight:800;color:${C.accent};white-space:nowrap;padding-left:12px;">${esc(price)}</td>` : ''}
      </tr></table>
    </td>
  </tr></table>`;
}

function bullets({ items = [] }) {
  const rows = items
    .map(
      (it) => `<tr>
      <td valign="top" width="22" style="font-family:${FONT};font-size:15px;line-height:1.6;color:${C.accent};">•</td>
      <td valign="top" style="font-family:${FONT};font-size:15px;line-height:1.6;color:${C.body};padding-bottom:6px;">${esc(it)}</td>
    </tr>`
    )
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 0;">${rows}</table>`;
}

function divider() {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:26px 0;"><tr><td height="1" bgcolor="${C.borderSubtle}" style="height:1px;line-height:1px;font-size:0;">&nbsp;</td></tr></table>`;
}

function spacer({ size = 16 }) {
  return `<div style="line-height:${size}px;height:${size}px;font-size:0;">&nbsp;</div>`;
}

const RENDERERS = { hero, paragraph, button, coupon, product, bullets, divider, spacer, note };

// ── Documento completo ──────────────────────────────────────────────────────

export function renderEmail({ brand = {}, preheader = '', blocks = [] } = {}) {
  const storeName = brand.name || 'Sua Loja';
  const initial = (brand.initial || storeName.trim().charAt(0) || 'L').toUpperCase();
  const year = brand.year || 2026;

  const body = blocks
    .map((b) => {
      const fn = RENDERERS[b && b.type];
      return fn ? fn(b) : '';
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="pt-BR" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${esc(storeName)}</title>
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
  <style>
    body{margin:0;padding:0;background:${C.bg};}
    table{border-collapse:collapse;}
    img{border:0;line-height:100%;outline:none;text-decoration:none;}
    a{color:${C.accent};}
    @media only screen and (max-width:620px){
      .kbly-container{width:100% !important;}
      .kbly-pad{padding-left:22px !important;padding-right:22px !important;}
      .kbly-card{border-radius:0 !important;}
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${C.bg};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${C.bg};">${esc(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${C.bg}" style="background:${C.bg};">
    <tr><td align="center" style="padding:28px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="kbly-container" style="width:600px;max-width:600px;">

        <!-- Card -->
        <tr><td bgcolor="${C.card}" class="kbly-card" style="background:${C.card};border:1px solid ${C.borderSubtle};border-radius:18px;overflow:hidden;">

          <!-- Header: monograma + nome da loja -->
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
            <td class="kbly-pad" style="padding:26px 34px 22px;border-bottom:1px solid ${C.borderSubtle};">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                <td valign="middle" style="padding-right:12px;">${monogram(initial)}</td>
                <td valign="middle" style="font-family:${FONT};font-size:18px;font-weight:800;color:${C.strong};letter-spacing:-.2px;">${esc(storeName)}</td>
              </tr></table>
            </td>
          </tr></table>

          <!-- Conteúdo -->
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
            <td class="kbly-pad" style="padding:30px 34px 32px;">
              ${body}
            </td>
          </tr></table>

          <!-- Footer -->
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
            <td class="kbly-pad" bgcolor="${C.bg}" style="background:${C.bg};padding:22px 34px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                <td valign="middle" style="font-family:${FONT};font-size:12px;color:${C.muted};">
                  ${koblyMark(18)}<span style="display:inline-block;vertical-align:middle;padding-left:7px;">Enviado com <span style="color:${C.body};font-weight:700;">Kobly</span></span>
                </td>
                <td valign="middle" align="right" style="font-family:${FONT};font-size:12px;color:${C.muted};">
                  <a href="#" style="color:${C.muted};text-decoration:underline;">Descadastrar</a>
                </td>
              </tr></table>
              <p style="margin:14px 0 0;font-family:${FONT};font-size:11px;line-height:1.5;color:#5a5a5a;">© ${esc(year)} ${esc(storeName)}. Você recebeu este e-mail porque interagiu com a loja.</p>
            </td>
          </tr></table>

        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// Builders individuais (para uso programático no editor, se desejado).
export const blocks = RENDERERS;
export const emailTokens = C;
