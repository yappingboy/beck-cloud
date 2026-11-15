#!/usr/bin/env node
/* knit-studio server: static frontend + pattern library API. Zero deps. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 8732);
const ROOT = __dirname;
const PUB = path.join(ROOT, 'public');
const LIB = process.env.LIBRARY_DIR
  ? path.resolve(process.env.LIBRARY_DIR)
  : path.join(ROOT, 'library');
const MAX_BODY = 8 * 1024 * 1024;
const ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

fs.mkdirSync(LIB, { recursive: true });

function send(res, code, body, type) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  res.writeHead(code, {
    'Content-Type': type || 'application/json; charset=utf-8',
    'Content-Length': buf.length,
    'Cache-Control': 'no-store'
  });
  res.end(buf);
}
const json = (res, code, obj) => send(res, code, JSON.stringify(obj));
const bad = (res, code, msg) => json(res, code, { error: msg });

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function fileFor(id) {
  if (!ID_RE.test(id)) return null;
  return path.join(LIB, id + '.json');
}

function summarize(id, p) {
  return {
    id,
    name: p.name || id,
    width: p.width,
    height: p.height,
    tags: (p.meta && p.meta.tags) || [],
    updatedAt: p.updatedAt || null,
    thumb: p.thumb || null
  };
}

function listPatterns() {
  const out = [];
  for (const f of fs.readdirSync(LIB)) {
    if (!f.endsWith('.json')) continue;
    const id = f.slice(0, -5);
    if (!ID_RE.test(id)) continue;
    try {
      out.push(summarize(id, JSON.parse(fs.readFileSync(path.join(LIB, f), 'utf8'))));
    } catch (e) { /* skip corrupt file in listing */ }
  }
  out.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  return out;
}

async function api(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean); // ['api', ...]

  if (parts[1] === 'health') return json(res, 200, { status: 'ok', uptime: process.uptime() });

  if (parts[1] === 'patterns') {
    if (parts.length === 2) {
      if (req.method === 'GET') return json(res, 200, { patterns: listPatterns() });
      return bad(res, 405, 'method not allowed');
    }
    const fp = fileFor(decodeURIComponent(parts[2]));
    if (!fp) return bad(res, 400, 'invalid pattern id');

    if (req.method === 'GET') {
      if (!fs.existsSync(fp)) return bad(res, 404, 'not found');
      try { return send(res, 200, fs.readFileSync(fp), MIME['.json']); }
      catch (e) { return bad(res, 500, 'unreadable pattern file'); }
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      let body;
      try { body = JSON.parse((await readBody(req)).toString('utf8')); }
      catch (e) { return bad(res, 400, 'invalid JSON: ' + e.message); }
      if (!body || body.format !== 'knit-studio/1') return bad(res, 400, 'body must be a knit-studio/1 pattern');
      if (!(Number.isInteger(body.width) && Number.isInteger(body.height) &&
            body.width > 0 && body.height <= 4000 && body.width <= 4000)) {
        return bad(res, 400, 'bad dimensions');
      }
      if (!Array.isArray(body.rows) || body.rows.length !== body.height ||
          body.rows.some((r) => typeof r !== 'string' || r.length !== body.width)) {
        return bad(res, 400, 'rows do not match width/height');
      }
      body.id = decodeURIComponent(parts[2]);
      body.updatedAt = new Date().toISOString();
      const tmp = fp + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(body, null, 1));
      fs.renameSync(tmp, fp); // atomic-ish: no half-written library files
      return json(res, 200, summarize(body.id, body));
    }

    if (req.method === 'DELETE') {
      if (!fs.existsSync(fp)) return bad(res, 404, 'not found');
      fs.unlinkSync(fp);
      return json(res, 200, { deleted: decodeURIComponent(parts[2]) });
    }
    return bad(res, 405, 'method not allowed');
  }

  return bad(res, 404, 'no such api route');
}

function serveStatic(res, pathname) {
  let rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const fp = path.normalize(path.join(PUB, rel));
  if (!fp.startsWith(PUB + path.sep) && fp !== PUB) return bad(res, 403, 'forbidden');
  fs.readFile(fp, (err, buf) => {
    if (err) return bad(res, 404, 'not found');
    send(res, 200, buf, MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream');
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return bad(res, 405, 'method not allowed');
    return serveStatic(res, url.pathname);
  } catch (e) {
    return bad(res, 500, String(e.message || e));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`knit-studio listening on http://0.0.0.0:${PORT} (library: ${LIB})`);
});
