// Links shown on the /articles page: pages on this site (like /holidays) or
// articles on other websites. Stored in settings under 'articles'.
import { db } from './db.js';
import { str } from './util.js';

export const DEFAULT_ARTICLES = {
  title: 'Articles',
  intro: 'Helpful pages and reading for our families.',
  links: [],
};

// Only allow links to pages on this site ("/holidays") or normal web addresses.
export function cleanUrl(value) {
  let v = str(value, 1000).trim();
  if (!v) return '';
  if (v.startsWith('/') && !v.startsWith('//')) return /^\/[^\s<>"]*$/.test(v) ? v : '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) v = 'https://' + v; // "example.com/page"
  try {
    const u = new URL(v);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
    if (!u.hostname.includes('.')) return '';
    return u.href;
  } catch {
    return '';
  }
}

export function cleanArticles(input) {
  const s = { ...DEFAULT_ARTICLES, ...(input || {}) };
  const links = (Array.isArray(s.links) ? s.links : [])
    .slice(0, 100)
    .map((l) => ({ title: str(l?.title, 150), url: cleanUrl(l?.url), description: str(l?.description, 500) }))
    .filter((l) => l.title && l.url);
  return { title: str(s.title, 100) || DEFAULT_ARTICLES.title, intro: str(s.intro, 1000), links };
}

export async function getArticles(env) {
  if (!env.DB) return cleanArticles();
  const d = await db(env);
  const row = await d.prepare(`SELECT value FROM settings WHERE key = 'articles'`).first();
  try {
    return cleanArticles(row ? JSON.parse(row.value) : null);
  } catch {
    return cleanArticles();
  }
}

export async function saveArticles(env, input) {
  const clean = cleanArticles(input);
  const d = await db(env);
  await d
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES ('articles', ?1, ?2)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .bind(JSON.stringify(clean), Math.floor(Date.now() / 1000))
    .run();
  return clean;
}
