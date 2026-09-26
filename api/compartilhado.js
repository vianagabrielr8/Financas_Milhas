// Prévia do link compartilhado (WhatsApp, Telegram...): esses apps não rodam
// o site, só leem o <head> da página. Aqui montamos o <head> com o nome do
// link ("Contas – Lucas Irmão") e devolvemos a mesma página do app.
// Só busca o NOME do link (função titulo_link_compartilhado); nenhum valor.
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default async function handler(req, res) {
  const codigo = String(req.query.codigo || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 128);
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const base = `https://${host}`;
  let html;
  try {
    html = await (await fetch(`${base}/index.html`)).text();
  } catch {
    res.status(302).setHeader('Location', '/').end();
    return;
  }

  let titulo = null;
  const url = process.env.VITE_SUPABASE_URL, chave = process.env.VITE_SUPABASE_ANON_KEY;
  if (codigo.length >= 32 && url && chave) {
    try {
      const r = await fetch(`${url}/rest/v1/rpc/titulo_link_compartilhado`, {
        method: 'POST',
        headers: { apikey: chave, Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_codigo: codigo }),
      });
      if (r.ok) titulo = await r.json();
    } catch { /* sem nome: fica a prévia padrão */ }
  }

  const nome = titulo ? `Contas – ${titulo}` : 'Contas – MilheiroSmart';
  const descricao = 'Resumo dos gastos, vencimentos e pagamentos. Toque para ver.';
  const tags = [
    `<title>${esc(nome)}</title>`,
    `<meta name="description" content="${esc(descricao)}" />`,
    `<meta property="og:title" content="${esc(nome)}" />`,
    `<meta property="og:description" content="${esc(descricao)}" />`,
    `<meta property="og:image" content="${base}/icone-512.png" />`,
    `<meta property="og:type" content="website" />`,
    `<meta name="robots" content="noindex" />`,
  ].join('\n    ');
  html = html
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/<meta name="description"[^>]*>/, '')
    .replace('</head>', `    ${tags}\n  </head>`);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).send(html);
}
