// Homepage: rendered on the server from the content saved in the admin dashboard.
import { currentUser } from '../src/auth.js';
import { db, getSite } from '../src/db.js';
import { renderHome } from '../src/render.js';
import { getGoogleRating } from '../src/google.js';
import { THEMES } from '../src/themes.js';

export async function onRequestGet({ request, env }) {
  let site;
  let gallery = [];
  let user = null;
  try {
    site = await getSite(env);
    // Live Google rating/count (cached 30 days); falls back to the admin's numbers.
    const live = await getGoogleRating(env, site.googlePlaceId).catch(() => null);
    if (live) {
      site.googleRating = live.rating;
      site.googleReviewCount = live.count;
    }
    if (env.DB) {
      const d = await db(env);
      const { results } = await d
        .prepare(`SELECT id, caption, width, height FROM photos WHERE scope = 'gallery' ORDER BY sort, created_at DESC LIMIT 60`)
        .all();
      gallery = results;
      user = await currentUser(request, env);
    }
  } catch (err) {
    console.error('Homepage data error', err);
    const { DEFAULT_SITE } = await import('../src/content.js');
    site = site || { ...DEFAULT_SITE };
  }
  // ?theme=christmas lets the admin preview any theme without saving it.
  const preview = new URL(request.url).searchParams.get('theme');
  const previewTheme = preview && THEMES[preview] ? preview : null;
  return new Response(renderHome(site, gallery, { loggedIn: user?.role || null, previewTheme }), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-cache',
    },
  });
}
