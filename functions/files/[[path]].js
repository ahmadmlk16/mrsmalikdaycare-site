// Document downloads: /files/<id>/<filename>
// Public forms can be downloaded by anyone. A family's private documents only by
// that family or an admin. Everything else gets "not found".
import { currentUser } from '../../src/auth.js';
import { db } from '../../src/db.js';

const notFound = () => new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } });

export async function onRequestGet({ request, env, params }) {
  const [id] = params.path || [];
  if (!env.DB || !env.PHOTOS || !/^[\w-]{6,40}$/.test(id || '')) return notFound();
  const d = await db(env);
  const doc = await d.prepare(`SELECT * FROM documents WHERE id = ?1`).bind(id).first();
  if (!doc) return notFound();
  if (doc.scope !== 'public') {
    const user = await currentUser(request, env);
    if (!user || (user.role !== 'admin' && user.id !== doc.family_id)) return notFound();
  }
  const obj = await env.PHOTOS.get(doc.r2_key);
  if (!obj) return notFound();

  const download = new URL(request.url).searchParams.has('download');
  // PDFs and pictures can open in the browser; everything else downloads.
  const viewable = /^(application\/pdf|image\/(jpeg|png))$/.test(doc.content_type);
  const disposition = download || !viewable ? 'attachment' : 'inline';
  const ascii = doc.filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '');
  const headers = new Headers({
    'content-type': doc.content_type,
    'content-disposition': `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,
    'cache-control': doc.scope === 'public' ? 'public, max-age=300' : 'private, no-store',
    'x-content-type-options': 'nosniff',
    'content-security-policy': "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
    'x-robots-tag': 'noindex',
  });
  // Chrome won't show PDFs under a sandbox policy, so only add it for other files.
  if (doc.content_type === 'application/pdf') headers.delete('content-security-policy');
  return new Response(obj.body, { headers });
}
