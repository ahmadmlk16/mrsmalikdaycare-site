// Google reviews via the Places API (New). Needs the GOOGLE_PLACES_API_KEY secret.
// Results are saved in the database and refreshed at most once every 30 days
// (or when the admin clicks "Refresh reviews now"), so Google is called only a
// handful of times a year.
import { db } from './db.js';

const PLACES = 'https://places.googleapis.com/v1';
const CACHE_DAYS = 30;
const CACHE_KEY = 'google_reviews';

export function writeReviewUrl(placeId) {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

function shape(place, placeId) {
  return {
    name: place.displayName?.text || '',
    rating: place.rating || null,
    count: place.userRatingCount || 0,
    mapsUrl: place.googleMapsUri || `https://www.google.com/maps/place/?q=place_id:${placeId}`,
    writeReviewUrl: writeReviewUrl(placeId),
    reviews: (place.reviews || []).map((r) => ({
      rating: r.rating || 0,
      text: r.text?.text || r.originalText?.text || '',
      when: r.relativePublishTimeDescription || '',
      author: r.authorAttribution?.displayName || 'Google user',
      authorUrl: r.authorAttribution?.uri || '',
      authorPhoto: r.authorAttribution?.photoUri || '',
      googleUrl: r.googleMapsUri || '',
    })),
  };
}

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

export async function getReviews(env, placeId, { refresh = false } = {}) {
  if (!env.GOOGLE_PLACES_API_KEY) return { error: 'not_configured' };
  if (!placeId) return { error: 'no_place_id' };

  const cached = await readCache(env);
  const sameplace = cached && cached.placeId === placeId;
  const fresh = sameplace && Date.now() - cached.fetchedAt < CACHE_DAYS * 86400 * 1000;
  if (fresh && !refresh) return { ...cached.data, fetchedAt: cached.fetchedAt };

  const res = await fetch(`${PLACES}/places/${encodeURIComponent(placeId)}`, {
    headers: {
      'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': 'displayName,rating,userRatingCount,reviews,googleMapsUri',
    },
  });
  if (!res.ok) {
    console.warn('Google Places error', res.status, (await res.text()).slice(0, 300));
    // Keep showing the last good copy if Google is having a problem.
    if (sameplace) return { ...cached.data, fetchedAt: cached.fetchedAt };
    return { error: 'google_error', status: res.status };
  }
  const data = shape(await res.json(), placeId);
  const fetchedAt = Date.now();
  await writeCache(env, { placeId, fetchedAt, data });
  return { ...data, fetchedAt };
}

// Used by the admin "Find on Google" button to look up the Place ID.
export async function searchPlaces(env, query) {
  if (!env.GOOGLE_PLACES_API_KEY) return { error: 'not_configured' };
  const res = await fetch(`${PLACES}/places:searchText`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount',
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 5 }),
  });
  if (!res.ok) return { error: 'google_error', status: res.status, detail: (await res.text()).slice(0, 300) };
  const data = await res.json();
  return {
    places: (data.places || []).map((p) => ({
      id: p.id,
      name: p.displayName?.text || '',
      address: p.formattedAddress || '',
      rating: p.rating || null,
      count: p.userRatingCount || 0,
    })),
  };
}
