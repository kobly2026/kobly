// Kobly — Importação de template de e-mail a partir de arquivo (.html ou .zip do Canva).
// Extrai o HTML, embute as imagens do ZIP como data: URIs e SANITIZA (DOMPurify)
// antes de devolver. A string resultante vai depois pro Resend e é renderizada no
// preview, então a sanitização AQUI é a fronteira de segurança real — o sandbox do
// iframe do preview é apenas defesa em profundidade.
//
// Este módulo é importado dinamicamente (`await import(...)`) pelo EmailEditor para
// que jszip + dompurify fiquem num chunk separado, fora do bundle principal.
import JSZip from 'jszip';
import DOMPurify from 'dompurify';

const IMG_EXT = /\.(png|jpe?g|gif|svg|webp)$/i;
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp' };

const baseName = (p) => String(p).split('/').pop().toLowerCase();

// Sanitiza HTML de e-mail: preserva documento completo (<html>/<head>/<style>) e
// estilos inline (tabelas/cores do template), mas remove <script>/<iframe>/handlers
// on* e URLs perigosas (javascript:, data:text/html).
function sanitize(html) {
  return DOMPurify.sanitize(html, {
    WHOLE_DOCUMENT: true,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'base'],
    FORBID_ATTR: ['ping'],
    ADD_ATTR: ['target'],
  });
}

function sizeWarnings(html) {
  const bytes = new Blob([html]).size;
  const w = [];
  if (bytes > 100 * 1024) {
    w.push(`O HTML tem ${(bytes / 1024).toFixed(0)}KB — o Gmail corta e-mails acima de ~102KB. Considere hospedar as imagens em vez de embuti-las.`);
  }
  return w;
}

// Reescreve referências relativas de imagem (src / background / url(...)) para as
// data: URIs extraídas do ZIP, casando por basename (tolera ./images/x.png vs x.png).
function rewriteAssets(html, dataUris) {
  if (!Object.keys(dataUris).length) return html;
  const swap = (ref) => {
    if (/^(data:|https?:|cid:|mailto:|#)/i.test(ref)) return null; // já absoluto/embutido
    return dataUris[baseName(ref)] || null;
  };
  html = html.replace(/(\bsrc\s*=\s*)(["'])([^"']+)\2/gi, (m, pre, q, ref) => {
    const uri = swap(ref); return uri ? `${pre}${q}${uri}${q}` : m;
  });
  html = html.replace(/(\bbackground\s*=\s*)(["'])([^"']+)\2/gi, (m, pre, q, ref) => {
    const uri = swap(ref); return uri ? `${pre}${q}${uri}${q}` : m;
  });
  html = html.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (m, q, ref) => {
    const uri = swap(ref); return uri ? `url(${q}${uri}${q})` : m;
  });
  return html;
}

// Importa um File (.html/.htm ou .zip) → { html (sanitizado), warnings[] }.
export async function importEmailFile(file) {
  const name = (file.name || '').toLowerCase();

  if (name.endsWith('.html') || name.endsWith('.htm') || file.type === 'text/html') {
    const text = await file.text();
    const html = sanitize(text);
    return { html, warnings: sizeWarnings(html) };
  }

  if (name.endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed') {
    const zip = await JSZip.loadAsync(file);
    const entries = Object.values(zip.files).filter((f) => !f.dir);
    const htmlEntries = entries.filter((f) => /\.html?$/i.test(f.name));
    if (!htmlEntries.length) throw new Error('O ZIP não contém nenhum arquivo .html.');
    const htmlEntry = htmlEntries.find((f) => /(^|\/)index\.html?$/i.test(f.name)) || htmlEntries[0];
    let html = await htmlEntry.async('string');

    const dataUris = {};
    for (const img of entries.filter((f) => IMG_EXT.test(f.name))) {
      const ext = img.name.split('.').pop().toLowerCase();
      const b64 = await img.async('base64');
      dataUris[baseName(img.name)] = `data:${MIME[ext] || 'application/octet-stream'};base64,${b64}`;
    }
    html = rewriteAssets(html, dataUris);
    html = sanitize(html);
    return { html, warnings: sizeWarnings(html) };
  }

  throw new Error('Formato não suportado — envie um arquivo .html ou .zip.');
}
