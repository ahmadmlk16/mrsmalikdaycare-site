// "Documents" page: public forms parents can download and fill out.
import { currentUser } from '../src/auth.js';
import { db, getSite } from '../src/db.js';
import { docOut } from '../src/documents.js';
import { renderDocuments } from '../src/render-documents.js';

export async function onRequestGet({ request, env }) {
  const site = await getSite(env);
  let documents = [];
  let user = null;
  if (env.DB) {
    const d = await db(env);
    const { results } = await d.prepare(`SELECT * FROM documents WHERE scope = 'public' ORDER BY sort, created_at DESC`).all();
    documents = results.map(docOut);
    user = await currentUser(request, env).catch(() => null);
  }
  return new Response(renderDocuments(site, documents, { loggedIn: user?.role || null }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' },
  });
}
