// Local test server that mimics Cloudflare Pages + D1 + R2 using only Node 22.
// Usage: node dev/server.mjs  (then open http://localhost:8788)
// Real deployments do not use this file.
import { DatabaseSync } from 'node:sqlite';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dataDir = path.join(root, '.dev-data');
fs.mkdirSync(path.join(dataDir, 'r2'), { recursive: true });

/* ----------------------------- D1 shim ----------------------------- */
const sqlite = new DatabaseSync(path.join(dataDir, 'd1.sqlite'));
sqlite.exec('PRAGMA foreign_keys = ON');
const norm = (v) => (v === undefined ? (() => { throw new Error('D1_TYPE_ERROR: undefined bind'); })() : typeof v === 'boolean' ? (() => { throw new Error('D1_TYPE_ERROR: boolean bind'); })() : v);
class Stmt {
  constructor(sql, params = []) { this.sql = sql; this.params = params; }
  bind(...p) { return new Stmt(this.sql, p.map(norm)); }
  async first(col) { const r = sqlite.prepare(this.sql).get(...this.params); return r ? (col ? r[col] : { ...r }) : null; }
  async all() { return { results: sqlite.prepare(this.sql).all(...this.params).map((r) => ({ ...r })), success: true }; }
  async run() { const r = sqlite.prepare(this.sql).run(...this.params); return { success: true, meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } }; }
}
const DB = {
  prepare: (sql) => new Stmt(sql),
  async batch(stmts) {
    sqlite.exec('BEGIN');
    try { const out = []; for (const s of stmts) out.push(await s.run()); sqlite.exec('COMMIT'); return out; }
    catch (e) { sqlite.exec('ROLLBACK'); throw e; }
  },
};

/* ----------------------------- R2 shim ----------------------------- */
const r2path = (key) => path.join(dataDir, 'r2', encodeURIComponent(key));
const PHOTOS = {
  async put(key, data, opts = {}) {
    fs.writeFileSync(r2path(key), Buffer.from(data));
    fs.writeFileSync(r2path(key) + '.meta', JSON.stringify(opts.httpMetadata || {}));
  },
  async get(key) {
    if (!fs.existsSync(r2path(key))) return null;
    const buf = fs.readFileSync(r2path(key));
    return { body: new Blob([buf]).stream(), httpMetadata: JSON.parse(fs.readFileSync(r2path(key) + '.meta', 'utf8')) };
  },
  async delete(keys) {
    for (const k of [].concat(keys)) for (const f of [r2path(k), r2path(k) + '.meta']) fs.rmSync(f, { force: true });
  },
};

const env = { DB, PHOTOS, SETUP_KEY: process.env.SETUP_KEY || 'dev-setup-key' };
if (process.env.RESEND_API_KEY) env.RESEND_API_KEY = process.env.RESEND_API_KEY;

if (process.env.GOOGLE_PLACES_API_KEY) env.GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
// MOCK_GOOGLE=1 fakes the Google rating lookup for local testing.
if (process.env.MOCK_GOOGLE) {
  env.GOOGLE_PLACES_API_KEY = 'mock';
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) =>
    String(url).startsWith('https://places.googleapis.com/')
      ? Response.json({ rating: 4.9, userRatingCount: 21 })
      : realFetch(url, opts);
}

/* ----------------------------- Routing ----------------------------- */
const home = await import(path.join(root, 'functions/index.js'));
const api = await import(path.join(root, 'functions/api/[[path]].js'));
const media = await import(path.join(root, 'functions/media/[[path]].js'));

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.txt': 'text/plain' };

function serveStatic(pathname) {
  const pub = path.join(root, 'public');
  const candidates = [pathname, pathname + '.html', path.join(pathname, 'index.html')];
  for (const c of candidates) {
    const file = path.join(pub, path.normalize(c));
    if (file.startsWith(pub) && fs.existsSync(file) && fs.statSync(file).isFile()) {
      return new Response(fs.readFileSync(file), { headers: { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' } });
    }
  }
  return new Response('Not found', { status: 404 });
}

async function handle(request) {
  const { pathname } = new URL(request.url);
  const ctx = { request, env, params: {}, waitUntil() {}, next: () => serveStatic(pathname) };
  if (pathname === '/' && request.method === 'GET') return home.onRequestGet(ctx);
  if (pathname.startsWith('/api/')) return api.onRequest(ctx);
  if (pathname.startsWith('/media/')) {
    ctx.params = { path: pathname.slice(7).split('/') };
    return request.method === 'GET' ? media.onRequestGet(ctx) : new Response('Method not allowed', { status: 405 });
  }
  return serveStatic(pathname);
}

const port = Number(process.env.PORT || 8788);
http
  .createServer(async (req, res) => {
    try {
      const url = `http://localhost:${port}${req.url}`;
      const hasBody = !['GET', 'HEAD'].includes(req.method);
      const request = new Request(url, { method: req.method, headers: req.headers, body: hasBody ? Readable.toWeb(req) : undefined, duplex: 'half' });
      const response = await handle(request);
      const headers = {};
      response.headers.forEach((v, k) => (headers[k] = v));
      res.writeHead(response.status, headers);
      if (response.body) Readable.fromWeb(response.body).pipe(res);
      else res.end();
    } catch (err) {
      console.error(err);
      res.writeHead(500).end('dev server error');
    }
  })
  .listen(port, () => console.log(`Dev server on http://localhost:${port}`));
