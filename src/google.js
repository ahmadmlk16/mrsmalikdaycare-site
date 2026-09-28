// Live Google star rating and review count via the Places API (New).
// Needs the GOOGLE_PLACES_API_KEY secret. Only the rating and count are
// requested (no review text or photos). The result is saved in the database
// and refreshed at most once every 30 days, or when the admin clicks
// "Refresh from Google". If the key is missing or Google can't be reached,
// the site falls back to the numbers typed into the admin dashboard.
import { db } from './db.js';

const CACHE_DAYS = 30;
const RETRY_HOURS = 3;
const CACHE_KEY = 'google_rating';

async function readCache(env) {
  const d = await db(env);
  const row = await d.prepare(`SELECT value FROM settings WHERE key = ?1`).bind(CACHE_KEY).first();
  try {
    return row ? JSON.parse(row.value) : null;
  } catch {
    return null;
  }
}

async function writeCache(env, entry) {
  const d = await db(env);
  await d
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .bind(CACHE_KEY, JSON.stringify(entry), Math.floor(Date.now() / 1000))
    .run();
}

// Returns { rating, count, fetchedAt } or null when unavailable.
export async function getGoogleRating(env, placeId, { refresh = false } = {}) {
  if (!env.GOOGLE_PLACES_API_KEY || !placeId || !env.DB) return null;

  const cached = await readCache(env);
  const same = cached && cached.placeId === placeId;
  const maxAge = same && cached.ok ? CACHE_DAYS * 86400e3 : RETRY_HOURS * 3600e3;
  if (same && !refresh && Date.now() - cached.fetchedAt < maxAge) {
    return cached.ok ? cached.data : null;
  }

  let data = null;
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: { 'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY, 'X-Goog-FieldMask': 'rating,userRatingCount' },
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const j = await res.json();
      if (j.rating) data = { rating: Number(j.rating).toFixed(1), count: String(j.userRatingCount || 0) };
    } else {
      console.warn('Google rating error', res.status, (await res.text()).slice(0, 200));
    }
  } catch (err) {
    console.warn('Google rating fetch failed', String(err));
  }

  const fetchedAt = Date.now();
  if (data) {
    await writeCache(env, { placeId, ok: true, fetchedAt, data: { ...data, fetchedAt } });
    return { ...data, fetchedAt };
  }
  // Keep the last good numbers if Google has a hiccup; try again in a few hours.
  if (same && cached.ok) {
    await writeCache(env, { ...cached, fetchedAt: fetchedAt - (CACHE_DAYS * 86400e3 - RETRY_HOURS * 3600e3) });
    return cached.data;
  }
  await writeCache(env, { placeId, ok: false, fetchedAt });
  return null;
}
