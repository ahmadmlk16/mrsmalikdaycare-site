// Database setup. Tables are created automatically on first use, so there
// are no migration commands to run when setting up Cloudflare.
import { DEFAULT_SITE, cleanSite } from './content.js';
import { fail } from './util.js';

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'family')),
    children TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    must_change_password INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    last_login_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id)`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    r2_key TEXT NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('site', 'gallery', 'family')),
    family_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    caption TEXT NOT NULL DEFAULT '',
    content_type TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    sort INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS photos_scope ON photos(scope, family_id, sort)`,
  `CREATE TABLE IF NOT EXISTS inquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    child_age TEXT NOT NULL DEFAULT '',
    preferred_date TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL DEFAULT '',
    emailed INTEGER NOT NULL DEFAULT 0,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS attempts (
    key TEXT NOT NULL,
    at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS attempts_key ON attempts(key, at)`,
];

let ready = null;

export function db(env) {
  if (!env.DB) fail(500, 'Database is not connected yet (missing DB binding).');
  if (!ready) {
    ready = env.DB.batch(SCHEMA.map((sql) => env.DB.prepare(sql))).catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready.then(() => env.DB);
}

export async function getSite(env) {
  if (!env.DB) return { ...DEFAULT_SITE };
  const d = await db(env);
  const row = await d.prepare(`SELECT value FROM settings WHERE key = 'site'`).first();
  if (!row) return { ...DEFAULT_SITE };
  try {
    return cleanSite(JSON.parse(row.value));
  } catch {
    return { ...DEFAULT_SITE };
  }
}

export async function saveSite(env, site) {
  const d = await db(env);
  const clean = cleanSite(site);
  await d
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES ('site', ?1, ?2)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .bind(JSON.stringify(clean), Math.floor(Date.now() / 1000))
    .run();
  return clean;
}
