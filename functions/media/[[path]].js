// Public photos (cover, story, and gallery). Family photos are never served here.
import { db } from '../../src/db.js';

export async function onRequestGet({ env, params }) {
  const id = Array.isArray(params.path) ? params.path[0] : params.path;
  if (!id || !env.DB || !env.PHOTOS) return new Response('Not found', { status: 404 });
  const d = await db(env);
  const photo = await d
    .prepare(`SELECT r2_key, content_type FROM photos WHERE id = ?1 AND scope IN ('site', 'gallery')`)
    .bind(id)
    .first();
  if (!photo) return new Response('Not found', { status: 404 });
  const obj = await env.PHOTOS.get(photo.r2_key);
  if (!obj) return new Response('Not found', { status: 404 });
  return new Response(obj.body, {
    headers: {
      'content-type': photo.content_type,
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
    },
  });
}
