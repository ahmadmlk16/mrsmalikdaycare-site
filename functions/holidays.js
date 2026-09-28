// "Daycare holidays" page: the days the daycare is closed. Not linked from the
// homepage; families reach it from their portal or a shared link.
import { currentUser } from '../src/auth.js';
import { getSite } from '../src/db.js';
import { getClosures } from '../src/closures.js';
import { renderHolidays } from '../src/render-holidays.js';

export async function onRequestGet({ request, env }) {
  const [site, closures] = await Promise.all([getSite(env), getClosures(env)]);
  const user = env.DB ? await currentUser(request, env).catch(() => null) : null;
  return new Response(renderHolidays(site, closures, { loggedIn: user?.role || null }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' },
  });
}
