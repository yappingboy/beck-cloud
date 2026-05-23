const http = require('http');

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://directus.cms:8055';
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || '';
const CACHE_TTL = 60000;

let cachedHtml = null;
let cacheTime = 0;

function fetchContent() {
  return new Promise((resolve) => {
    const url = `${DIRECTUS_URL}/items/pages/home`;
    const req = http.get(url, {
      headers: DIRECTUS_TOKEN ? { Authorization: `Bearer ${DIRECTUS_TOKEN}` } : {}
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.data && json.data[0]) {
            resolve(renderPage(json.data[0]));
          } else {
            resolve(defaultPage());
          }
        } catch (e) {
          resolve(defaultPage());
        }
      });
    });
    req.on('error', () => resolve(defaultPage()));
    req.setTimeout(5000, () => { req.destroy(); resolve(defaultPage()); });
  });
}

const DEFAULT_STYLE = `
body{font-family:system-ui;margin:0;background:#0f172a;color:#e2e8f0}
.hero{text-align:center;padding:6rem 2rem}
h1{font-size:3rem;margin-bottom:1rem}
.content{max-width:800px;margin:0 auto;padding:2rem}
a{color:#38bdf8;text-decoration:none}
a:hover{text-decoration:underline}
p{color:#94a3b8;line-height:1.6}`;

const RICH_STYLE = DEFAULT_STYLE + `
.content p{margin-bottom:1rem}`;

function renderPage(page) {
  return [
    '<!doctype html>',
    '<html><head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${page.title || 'Becklab'}</title>`,
    `<style>${RICH_STYLE}</style>`,
    '</head><body>',
    '<div class="hero">',
    `<h1>${page.title || 'Becklab'}</h1>`,
    '</div>',
    '<div class="content">',
    `${page.body || '<p>Home automation, media, and infrastructure.</p>'}`,
    '</div></body></html>'
  ].join('\n');
}

function defaultPage() {
  return [
    '<!doctype html>',
    '<html><head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>Becklab</title>',
    `<style>${DEFAULT_STYLE}</style>`,
    '</head><body>',
    '<div class="hero">',
    '<h1>Becklab</h1>',
    '<p>Home automation, media, and infrastructure.</p>',
    '</div></body></html>'
  ].join('\n');
}

const server = http.createServer((req, res) => {
  if (!cachedHtml || Date.now() - cacheTime > CACHE_TTL) {
    fetchContent().then(html => {
      cachedHtml = html;
      cacheTime = Date.now();
    });
  }
  const html = cachedHtml || defaultPage();
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
});

server.listen(80, () => console.log('Landing page server running on port 80'));
