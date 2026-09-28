// "Articles" page: links to other pages on this site and to outside articles.
import { currentUser } from '../src/auth.js';
import { getSite } from '../src/db.js';
import { getArticles } from '../src/articles.js';
import { renderArticles } from '../src/render-articles.js';

export async function onRequestGet({ request, env }) {
  const [site, articles] = await Promise.all([getSite(env), getArticles(env)]);
  const user = env.DB ? await currentUser(request, env).catch(() => null) : null;
  return new Response(renderArticles(site, articles, { loggedIn: user?.role || null }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' },
  });
}
