// All /api/* endpoints.
import {
  checkNewPassword,
  createSession,
  currentUser,
  destroySession,
  hashPassword,
  rateLimit,
  recordAttempt,
  requireUser,
  sessionCookie,
  tempPassword,
  verifyPassword,
  COOKIE,
} from './auth.js';
import { db, getSite, saveSite } from './db.js';
import { sendInquiryEmail } from './email.js';
import { cleanProfile, parseProfile } from './profile.js';
import { getGoogleRating } from './google.js';
import { getClosures, saveClosures, suggestions } from './closures.js';
import { cleanUrl, getArticles, saveArticles } from './articles.js';
import { DOC_TYPES, FAMILY_CATEGORIES, MAX_DOC, docOut, extOf, safeFilename } from './documents.js';
import { THEMES, BASE_THEMES, HOLIDAY_THEMES, activeTheme } from './themes.js';
import { HttpError, clientIp, fail, isEmail, json, now, parseCookies, randomId, readJson, sha256, str } from './util.js';

const MAX_UPLOAD = 10 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const routes = [];
function route(method, pattern, handler) {
  const keys = [];
  const re = new RegExp(
    '^' + pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '/?$',
  );
  routes.push({ method, re, keys, handler });
}

export async function handleApi(request, env) {
  const url = new URL(request.url);
  try {
    // Block cross-site form posts: browsers always send Origin on these requests.
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const origin = request.headers.get('origin');
      if (origin && origin !== url.origin) fail(403, 'Cross-site request blocked.');
    }
    for (const r of routes) {
      if (r.method !== request.method) continue;
      const m = url.pathname.match(r.re);
      if (!m) continue;
      const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      return await r.handler({ request, env, url, params });
    }
    return json({ error: 'Not found' }, 404);
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    console.error(err);
    return json({ error: 'Something went wrong on our end. Please try again.' }, 500);
  }
}

function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    children: u.children || '',
    mustChangePassword: !!u.must_change_password,
    profile: cleanProfile(u.role, {}, parseProfile(u.profile)),
  };
}

/* ----------------------------- Session & login ---------------------------- */

route('GET', '/api/session', async ({ request, env }) => {
  const user = await currentUser(request, env);
  return json({ user: user ? publicUser(user) : null });
});

route('POST', '/api/login', async ({ request, env }) => {
  const body = await readJson(request);
  const email = str(body.email, 200).toLowerCase();
  const password = String(body.password || '');
  const key = `login:${clientIp(request)}`;
  await rateLimit(env, key, 10, 15 * 60);

  const d = await db(env);
  const user = await d.prepare(`SELECT * FROM users WHERE email = ?1 AND active = 1`).bind(email).first();
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    await recordAttempt(env, key);
    fail(401, 'That email and password do not match.');
  }
  await d.prepare(`UPDATE users SET last_login_at = ?1 WHERE id = ?2`).bind(now(), user.id).run();
  const cookie = await createSession(env, request, user.id);
  return json({ user: publicUser(user) }, 200, { 'set-cookie': cookie });
});

route('POST', '/api/logout', async ({ request, env }) => {
  await destroySession(request, env);
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie(request, '', 0) });
});

route('POST', '/api/account/password', async ({ request, env }) => {
  const user = await requireUser(request, env);
  const body = await readJson(request);
  const d = await db(env);
  const row = await d.prepare(`SELECT password_hash FROM users WHERE id = ?1`).bind(user.id).first();
  const key = `pw:${user.id}`;
  await rateLimit(env, key, 10, 15 * 60);
  if (!(await verifyPassword(String(body.current || ''), row.password_hash))) {
    await recordAttempt(env, key);
    fail(400, 'Your current password is not correct.');
  }
  checkNewPassword(body.next);
  if (body.next === body.current) fail(400, 'Please choose a new password that is different.');
  await d
    .prepare(`UPDATE users SET password_hash = ?1, must_change_password = 0 WHERE id = ?2`)
    .bind(await hashPassword(body.next), user.id)
    .run();
  // Sign out other devices but keep this one.
  const token = parseCookies(request)[COOKIE];
  await d
    .prepare(`DELETE FROM sessions WHERE user_id = ?1 AND id != ?2`)
    .bind(user.id, token ? await sha256(token) : '')
    .run();
  return json({ ok: true });
});

// Update your own contact details. Families edit their contact info; admins
// can also change their name, login email, and notification preference.
route('PATCH', '/api/account/profile', async ({ request, env }) => {
  const user = await requireUser(request, env);
  const body = await readJson(request);
  const d = await db(env);
  const profile = cleanProfile(user.role, body.profile || {}, parseProfile(user.profile));
  let { name, email } = user;
  if (user.role === 'admin') {
    if (body.name !== undefined) name = str(body.name, 100);
    if (body.email !== undefined) email = str(body.email, 200).toLowerCase();
    if (!name) fail(400, 'Please enter a name.');
    if (!isEmail(email)) fail(400, 'Please enter a valid email.');
    if (email !== user.email.toLowerCase()) {
      const taken = await d.prepare(`SELECT id FROM users WHERE email = ?1 AND id != ?2`).bind(email, user.id).first();
      if (taken) fail(409, 'Another account already uses that email.');
    }
  }
  await d
    .prepare(`UPDATE users SET name = ?1, email = ?2, profile = ?3 WHERE id = ?4`)
    .bind(name, email, JSON.stringify(profile), user.id)
    .run();
  const fresh = await d.prepare(`SELECT * FROM users WHERE id = ?1`).bind(user.id).first();
  return json({ user: publicUser(fresh) });
});

/* --------------------------- First-time admin setup ------------------------ */

async function adminCount(env) {
  const d = await db(env);
  const row = await d.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin'`).first();
  return row?.n || 0;
}

route('GET', '/api/setup', async ({ env }) => {
  return json({ needsSetup: (await adminCount(env)) === 0, setupKeyConfigured: !!env.SETUP_KEY });
});

route('POST', '/api/setup', async ({ request, env }) => {
  if ((await adminCount(env)) > 0) fail(403, 'Setup is already complete. Please log in.');
  if (!env.SETUP_KEY) fail(400, 'SETUP_KEY is not configured in Cloudflare yet.');
  const key = `setup:${clientIp(request)}`;
  await rateLimit(env, key, 10, 15 * 60);
  const body = await readJson(request);
  if (String(body.setupKey || '') !== env.SETUP_KEY) {
    await recordAttempt(env, key);
    fail(403, 'Setup key is not correct.');
  }
  const email = str(body.email, 200).toLowerCase();
  const name = str(body.name, 100);
  if (!name) fail(400, 'Please enter a name.');
  if (!isEmail(email)) fail(400, 'Please enter a valid email.');
  checkNewPassword(body.password);
  const d = await db(env);
  const res = await d
    .prepare(
      `INSERT INTO users (email, name, role, password_hash, must_change_password, created_at)
       VALUES (?1, ?2, 'admin', ?3, 0, ?4)`,
    )
    .bind(email, name, await hashPassword(body.password), now())
    .run();
  const cookie = await createSession(env, request, res.meta.last_row_id);
  return json({ ok: true }, 200, { 'set-cookie': cookie });
});

/* ------------------------------ Public inquiry ----------------------------- */

route('POST', '/api/inquiry', async ({ request, env }) => {
  const body = await readJson(request, 20_000);
  if (body.website) return json({ ok: true }); // honeypot: bots fill hidden fields
  const inquiry = {
    kind: body.kind === 'tour' ? 'tour' : 'question',
    name: str(body.name, 100),
    email: str(body.email, 200),
    phone: str(body.phone, 40),
    child_age: str(body.childAge, 60),
    preferred_date: str(body.preferredDate, 100),
    message: str(body.message, 4000),
  };
  if (!inquiry.name) fail(400, 'Please enter your name.');
  if (!isEmail(inquiry.email)) fail(400, 'Please enter a valid email address.');
  if (!inquiry.message && inquiry.kind !== 'tour') fail(400, 'Please enter a message.');

  const key = `inquiry:${clientIp(request)}`;
  await rateLimit(env, key, 5, 60 * 60);
  await recordAttempt(env, key);

  const d = await db(env);
  const res = await d
    .prepare(
      `INSERT INTO inquiries (kind, name, email, phone, child_age, preferred_date, message, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    )
    .bind(
      inquiry.kind,
      inquiry.name,
      inquiry.email,
      inquiry.phone,
      inquiry.child_age,
      inquiry.preferred_date,
      inquiry.message,
      now(),
    )
    .run();

  let result;
  try {
    const { results: admins } = await d
      .prepare(`SELECT email, profile FROM users WHERE role = 'admin' AND active = 1`)
      .all();
    const adminEmails = admins.filter((a) => parseProfile(a.profile).notifyEmail !== false).map((a) => a.email);
    result = await sendInquiryEmail(env, inquiry, adminEmails);
  } catch (err) {
    result = { sent: false, reason: String(err) };
  }
  if (result.sent) {
    await d.prepare(`UPDATE inquiries SET emailed = 1 WHERE id = ?1`).bind(res.meta.last_row_id).run();
  } else {
    console.warn('Inquiry email not sent:', result.reason);
  }
  return json({ ok: true });
});

/* ------------------------------ Google rating ------------------------------ */

route('GET', '/api/admin/google/status', async ({ request, env, url }) => {
  await requireUser(request, env, 'admin');
  const site = await getSite(env);
  const configured = !!env.GOOGLE_PLACES_API_KEY;
  const live = configured
    ? await getGoogleRating(env, site.googlePlaceId, { refresh: url.searchParams.has('refresh') })
    : null;
  return json({ configured, placeId: site.googlePlaceId, live });
});

/* ------------------------------- Admin: content ---------------------------- */

function themeInfo(site) {
  const pick = (keys) =>
    keys.map((k) => ({ key: k, label: THEMES[k].label, vars: THEMES[k].vars, banner: THEMES[k].banner || '' }));
  return { base: pick(BASE_THEMES), holidays: pick(HOLIDAY_THEMES), active: activeTheme(site) };
}

route('GET', '/api/admin/content', async ({ request, env }) => {
  await requireUser(request, env, 'admin');
  const site = await getSite(env);
  return json({ site, themes: themeInfo(site) });
});

route('PUT', '/api/admin/content', async ({ request, env }) => {
  await requireUser(request, env, 'admin');
  const body = await readJson(request);
  const site = await saveSite(env, body.site);
  return json({ site, themes: themeInfo(site) });
});

/* ------------------------------ Admin: closed days --------------------------- */

route('GET', '/api/admin/closures', async ({ request, env }) => {
  await requireUser(request, env, 'admin');
  const closures = await getClosures(env);
  return json({ closures, suggestions: suggestions(closures.days) });
});

route('PUT', '/api/admin/closures', async ({ request, env }) => {
  await requireUser(request, env, 'admin');
  const body = await readJson(request);
  const closures = await saveClosures(env, body.closures);
  return json({ closures, suggestions: suggestions(closures.days) });
});

/* ------------------------------ Admin: articles ----------------------------- */

route('GET', '/api/admin/articles', async ({ request, env }) => {
  await requireUser(request, env, 'admin');
  return json({ articles: await getArticles(env) });
});

route('PUT', '/api/admin/articles', async ({ request, env }) => {
  await requireUser(request, env, 'admin');
  const body = await readJson(request);
  for (const l of body.articles?.links || []) {
    if (!String(l?.title || '').trim()) fail(400, 'Every link needs a title.');
    if (!cleanUrl(l?.url))
      fail(400, `"${String(l.url || '').slice(0, 80)}" doesn't look like a link. Use a full web address (https://…) or a page on this site starting with "/".`);
  }
  return json({ articles: await saveArticles(env, body.articles) });
});

/* ------------------------------ Admin: documents ---------------------------- */

route('GET', '/api/admin/documents', async ({ request, env, url }) => {
  await requireUser(request, env, 'admin');
  const d = await db(env);
  const stmt =
    url.searchParams.get('scope') === 'family'
      ? d
          .prepare(`SELECT * FROM documents WHERE scope = 'family' AND family_id = ?1 ORDER BY sort, created_at DESC`)
          .bind(Number(url.searchParams.get('familyId')))
      : d.prepare(`SELECT * FROM documents WHERE scope = 'public' ORDER BY sort, created_at DESC`);
  const { results } = await stmt.all();
  return json({ documents: results.map(docOut), categories: FAMILY_CATEGORIES });
});

route('POST', '/api/admin/documents', async ({ request, env, url }) => {
  await requireUser(request, env, 'admin');
  if (!env.PHOTOS) fail(500, 'File storage is not connected yet (missing PHOTOS binding).');
  const scope = url.searchParams.get('scope');
  if (!['public', 'family'].includes(scope)) fail(400, 'Unknown document type.');
  // A non-form content type means browsers must ask first (CORS), so other sites can't upload.
  if ((request.headers.get('content-type') || '').split(';')[0].trim() !== 'application/octet-stream') fail(415, 'Unexpected upload format.');
  const filename = safeFilename(url.searchParams.get('filename'));
  const ext = extOf(filename);
  const contentType = DOC_TYPES[ext];
  if (!contentType) fail(415, 'Please upload a PDF, Word, Excel, or image file.');
  if (Number(request.headers.get('content-length') || 0) > MAX_DOC) fail(413, 'That file is too large (25 MB max).');

  const d = await db(env);
  let familyId = null;
  if (scope === 'family') {
    familyId = Number(url.searchParams.get('familyId'));
    const fam = await d.prepare(`SELECT id FROM users WHERE id = ?1 AND role = 'family'`).bind(familyId).first();
    if (!fam) fail(404, 'Family not found.');
  }
  const data = await request.arrayBuffer();
  if (data.byteLength === 0) fail(400, 'The file was empty.');
  if (data.byteLength > MAX_DOC) fail(413, 'That file is too large (25 MB max).');

  const id = randomId(12);
  const r2Key = scope === 'family' ? `docs/family/${familyId}/${id}.${ext}` : `docs/public/${id}.${ext}`;
  await env.PHOTOS.put(r2Key, data, { httpMetadata: { contentType } });
  const title = str(url.searchParams.get('title'), 150) || filename.replace(/\.[^.]*$/, '');
  const category = str(url.searchParams.get('category'), 60);
  const minSort = await d
    .prepare(`SELECT COALESCE(MIN(sort), 0) AS s FROM documents WHERE scope = ?1 AND COALESCE(family_id, 0) = ?2`)
    .bind(scope, familyId || 0)
    .first();
  await d
    .prepare(
      `INSERT INTO documents (id, r2_key, scope, family_id, title, description, category, filename, content_type, size, sort, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
    )
    .bind(id, r2Key, scope, familyId, title, str(url.searchParams.get('description'), 500), category, filename, contentType, data.byteLength, minSort.s - 1, now())
    .run();
  const row = await d.prepare(`SELECT * FROM documents WHERE id = ?1`).bind(id).first();
  return json({ document: docOut(row) });
});

route('PATCH', '/api/admin/documents/:id', async ({ request, env, params }) => {
  await requireUser(request, env, 'admin');
  const body = await readJson(request);
  const d = await db(env);
  const doc = await d.prepare(`SELECT * FROM documents WHERE id = ?1`).bind(params.id).first();
  if (!doc) fail(404, 'Document not found.');
  const title = body.title !== undefined ? str(body.title, 150) : doc.title;
  if (!title) fail(400, 'Please give the document a title.');
  await d
    .prepare(`UPDATE documents SET title = ?1, description = ?2, category = ?3 WHERE id = ?4`)
    .bind(
      title,
      body.description !== undefined ? str(body.description, 500) : doc.description,
      body.category !== undefined ? str(body.category, 60) : doc.category,
      doc.id,
    )
    .run();
  return json({ document: docOut(await d.prepare(`SELECT * FROM documents WHERE id = ?1`).bind(doc.id).first()) });
});

route('DELETE', '/api/admin/documents/:id', async ({ request, env, params }) => {
  await requireUser(request, env, 'admin');
  const d = await db(env);
  const doc = await d.prepare(`SELECT * FROM documents WHERE id = ?1`).bind(params.id).first();
  if (!doc) fail(404, 'Document not found.');
  await deleteDocuments(env, [doc]);
  return json({ ok: true });
});

route('POST', '/api/admin/documents/reorder', async ({ request, env }) => {
  await requireUser(request, env, 'admin');
  const body = await readJson(request);
  const ids = Array.isArray(body.ids) ? body.ids.slice(0, 500).map((x) => String(x)) : [];
  const d = await db(env);
  if (ids.length) await d.batch(ids.map((id, i) => d.prepare(`UPDATE documents SET sort = ?1 WHERE id = ?2`).bind(i, id)));
  return json({ ok: true });
});

async function deleteDocuments(env, docs) {
  if (!docs.length) return;
  const d = await db(env);
  if (env.PHOTOS) await env.PHOTOS.delete(docs.map((x) => x.r2_key));
  await d.batch(docs.map((x) => d.prepare(`DELETE FROM documents WHERE id = ?1`).bind(x.id)));
}

/* ------------------------------- Admin: photos ----------------------------- */

function photoOut(p) {
  const isPublic = p.scope !== 'family';
  return {
    id: p.id,
    scope: p.scope,
    familyId: p.family_id,
    caption: p.caption,
    width: p.width,
    height: p.height,
    sort: p.sort,
    createdAt: p.created_at,
    url: isPublic ? `/media/${p.id}` : `/api/photos/${p.id}`,
  };
}

route('GET', '/api/admin/photos', async ({ request, env, url }) => {
  await requireUser(request, env, 'admin');
  const scope = url.searchParams.get('scope') || 'gallery';
  const d = await db(env);
  const stmt =
    scope === 'family'
      ? d
          .prepare(`SELECT * FROM photos WHERE scope = 'family' AND family_id = ?1 ORDER BY sort, created_at DESC`)
          .bind(Number(url.searchParams.get('familyId')))
      : d.prepare(`SELECT * FROM photos WHERE scope = ?1 ORDER BY sort, created_at DESC`).bind(scope);
  const { results } = await stmt.all();
  return json({ photos: results.map(photoOut) });
});

route('POST', '/api/admin/photos', async ({ request, env, url }) => {
  await requireUser(request, env, 'admin');
  if (!env.PHOTOS) fail(500, 'Photo storage is not connected yet (missing PHOTOS binding).');
  const scope = url.searchParams.get('scope');
  if (!['site', 'gallery', 'family'].includes(scope)) fail(400, 'Unknown photo type.');
  const contentType = (request.headers.get('content-type') || '').split(';')[0].trim();
  if (!IMAGE_TYPES.includes(contentType)) fail(415, 'Please upload a JPG, PNG, or WebP image.');
  const size = Number(request.headers.get('content-length') || 0);
  if (size > MAX_UPLOAD) fail(413, 'That photo is too large (10 MB max).');

  const d = await db(env);
  let familyId = null;
  if (scope === 'family') {
    familyId = Number(url.searchParams.get('familyId'));
    const fam = await d.prepare(`SELECT id FROM users WHERE id = ?1 AND role = 'family'`).bind(familyId).first();
    if (!fam) fail(404, 'Family not found.');
  }

  const data = await request.arrayBuffer();
  if (data.byteLength === 0) fail(400, 'The photo was empty.');
  if (data.byteLength > MAX_UPLOAD) fail(413, 'That photo is too large (10 MB max).');

  const id = randomId(12);
  const ext = contentType.split('/')[1].replace('jpeg', 'jpg');
  const r2Key = scope === 'family' ? `family/${familyId}/${id}.${ext}` : `public/${id}.${ext}`;
  await env.PHOTOS.put(r2Key, data, { httpMetadata: { contentType } });

  const width = Number(url.searchParams.get('w')) || null;
  const height = Number(url.searchParams.get('h')) || null;
  const minSort = await d
    .prepare(`SELECT COALESCE(MIN(sort), 0) AS s FROM photos WHERE scope = ?1 AND COALESCE(family_id, 0) = ?2`)
    .bind(scope, familyId || 0)
    .first();
  await d
    .prepare(
      `INSERT INTO photos (id, r2_key, scope, family_id, caption, content_type, width, height, sort, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
    )
    .bind(
      id,
      r2Key,
      scope,
      familyId,
      str(url.searchParams.get('caption'), 200),
      contentType,
      width,
      height,
      (minSort?.s || 0) - 1,
      now(),
    )
    .run();
  const photo = await d.prepare(`SELECT * FROM photos WHERE id = ?1`).bind(id).first();
  return json({ photo: photoOut(photo) }, 201);
});

route('PATCH', '/api/admin/photos/:id', async ({ request, env, params }) => {
  await requireUser(request, env, 'admin');
  const body = await readJson(request);
  const d = await db(env);
  const photo = await d.prepare(`SELECT * FROM photos WHERE id = ?1`).bind(params.id).first();
  if (!photo) fail(404, 'Photo not found.');
  const caption = body.caption !== undefined ? str(body.caption, 200) : photo.caption;
  const sort = Number.isFinite(body.sort) ? Math.trunc(body.sort) : photo.sort;
  await d.prepare(`UPDATE photos SET caption = ?1, sort = ?2 WHERE id = ?3`).bind(caption, sort, params.id).run();
  return json({ ok: true });
});

route('POST', '/api/admin/photos/reorder', async ({ request, env }) => {
  await requireUser(request, env, 'admin');
  const body = await readJson(request);
  const ids = Array.isArray(body.ids) ? body.ids.slice(0, 500).map((x) => String(x)) : [];
  const d = await db(env);
  if (ids.length) {
    await d.batch(ids.map((id, i) => d.prepare(`UPDATE photos SET sort = ?1 WHERE id = ?2`).bind(i, id)));
  }
  return json({ ok: true });
});

async function deletePhotos(env, photos) {
  if (!photos.length) return;
  const d = await db(env);
  if (env.PHOTOS) await env.PHOTOS.delete(photos.map((p) => p.r2_key));
  await d.batch(photos.map((p) => d.prepare(`DELETE FROM photos WHERE id = ?1`).bind(p.id)));
  // If a deleted photo was the cover or story photo, clear it from the page.
  const site = await getSite(env);
  const ids = new Set(photos.map((p) => p.id));
  const providerHit = site.providers.some((p) => ids.has(p.photoId));
  if (ids.has(site.coverPhotoId) || ids.has(site.storyPhotoId) || providerHit) {
    if (ids.has(site.coverPhotoId)) site.coverPhotoId = '';
    if (ids.has(site.storyPhotoId)) site.storyPhotoId = '';
    site.providers.forEach((p) => {
      if (ids.has(p.photoId)) p.photoId = '';
    });
    await saveSite(env, site);
  }
}

route('DELETE', '/api/admin/photos/:id', async ({ request, env, params }) => {
  await requireUser(request, env, 'admin');
  const d = await db(env);
  const photo = await d.prepare(`SELECT * FROM photos WHERE id = ?1`).bind(params.id).first();
  if (!photo) fail(404, 'Photo not found.');
  await deletePhotos(env, [photo]);
  return json({ ok: true });
});

/* ------------------------------ Admin: families ---------------------------- */

route('GET', '/api/admin/families', async ({ request, env }) => {
  await requireUser(request, env, 'admin');
  const d = await db(env);
  const { results } = await d
    .prepare(
      `SELECT u.id, u.email, u.name, u.children, u.profile, u.active, u.must_change_password, u.created_at, u.last_login_at,
              (SELECT COUNT(*) FROM photos p WHERE p.family_id = u.id) AS photo_count,
              (SELECT COUNT(*) FROM documents x WHERE x.family_id = u.id) AS doc_count
       FROM users u WHERE u.role = 'family' ORDER BY u.name COLLATE NOCASE`,
    )
    .all();
  return json({
    families: results.map((f) => ({
      id: f.id,
      email: f.email,
      name: f.name,
      children: f.children,
      profile: cleanProfile('family', {}, parseProfile(f.profile)),
      active: !!f.active,
      mustChangePassword: !!f.must_change_password,
      createdAt: f.created_at,
      lastLoginAt: f.last_login_at,
      photoCount: f.photo_count,
      docCount: f.doc_count,
    })),
  });
});

async function createAccount(env, body, role) {
  const email = str(body.email, 200).toLowerCase();
  const name = str(body.name, 100);
  if (!name) fail(400, 'Please enter a name.');
  if (!isEmail(email)) fail(400, 'Please enter a valid email.');
  const d = await db(env);
  const exists = await d.prepare(`SELECT id FROM users WHERE email = ?1`).bind(email).first();
  if (exists) fail(409, 'An account with that email already exists.');
  const password = tempPassword();
  const res = await d
    .prepare(
      `INSERT INTO users (email, name, role, children, profile, password_hash, must_change_password, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7)`,
    )
    .bind(
      email,
      name,
      role,
      str(body.children, 300),
      JSON.stringify(cleanProfile(role, body.profile || {})),
      await hashPassword(password),
      now(),
    )
    .run();
  return { id: res.meta.last_row_id, email, name, tempPassword: password };
}

route('POST', '/api/admin/families', async ({ request, env }) => {
  await requireUser(request, env, 'admin');
  return json(await createAccount(env, await readJson(request), 'family'), 201);
});

async function getFamily(env, id) {
  const d = await db(env);
  const fam = await d.prepare(`SELECT * FROM users WHERE id = ?1 AND role = 'family'`).bind(Number(id)).first();
  if (!fam) fail(404, 'Family not found.');
  return fam;
}

route('PATCH', '/api/admin/families/:id', async ({ request, env, params }) => {
  await requireUser(request, env, 'admin');
  const fam = await getFamily(env, params.id);
  const body = await readJson(request);
  const email = body.email !== undefined ? str(body.email, 200).toLowerCase() : fam.email;
  if (!isEmail(email)) fail(400, 'Please enter a valid email.');
  const d = await db(env);
  if (email !== fam.email.toLowerCase()) {
    const taken = await d.prepare(`SELECT id FROM users WHERE email = ?1 AND id != ?2`).bind(email, fam.id).first();
    if (taken) fail(409, 'Another account already uses that email.');
  }
  const name = body.name !== undefined ? str(body.name, 100) : fam.name;
  if (!name) fail(400, 'Please enter a name.');
  const children = body.children !== undefined ? str(body.children, 300) : fam.children;
  const active = body.active !== undefined ? (body.active ? 1 : 0) : fam.active;
  const profile = cleanProfile('family', body.profile || {}, parseProfile(fam.profile));
  const stmts = [
    d
      .prepare(`UPDATE users SET email = ?1, name = ?2, children = ?3, active = ?4, profile = ?5 WHERE id = ?6`)
      .bind(email, name, children, active, JSON.stringify(profile), fam.id),
  ];
  if (!active) stmts.push(d.prepare(`DELETE FROM sessions WHERE user_id = ?1`).bind(fam.id));
  await d.batch(stmts);
  return json({ ok: true });
});

route('POST', '/api/admin/families/:id/reset-password', async ({ request, env, params }) => {
  await requireUser(request, env, 'admin');
  const fam = await getFamily(env, params.id);
  const password = tempPassword();
  const d = await db(env);
  await d.batch([
    d
      .prepare(`UPDATE users SET password_hash = ?1, must_change_password = 1 WHERE id = ?2`)
      .bind(await hashPassword(password), fam.id),
    d.prepare(`DELETE FROM sessions WHERE user_id = ?1`).bind(fam.id),
  ]);
  return json({ tempPassword: password });
});

route('DELETE', '/api/admin/families/:id', async ({ request, env, params }) => {
  await requireUser(request, env, 'admin');
  const fam = await getFamily(env, params.id);
  const d = await db(env);
  const { results } = await d.prepare(`SELECT * FROM photos WHERE family_id = ?1`).bind(fam.id).all();
  await deletePhotos(env, results);
  const docs = await d.prepare(`SELECT * FROM documents WHERE family_id = ?1`).bind(fam.id).all();
  await deleteDocuments(env, docs.results);
  await d.batch([
    d.prepare(`DELETE FROM sessions WHERE user_id = ?1`).bind(fam.id),
    d.prepare(`DELETE FROM users WHERE id = ?1`).bind(fam.id),
  ]);
  return json({ ok: true });
});

/* ------------------------------- Admin: admins ----------------------------- */

route('GET', '/api/admin/admins', async ({ request, env }) => {
  await requireUser(request, env, 'admin');
  const d = await db(env);
  const { results } = await d
    .prepare(`SELECT id, email, name, profile, last_login_at FROM users WHERE role = 'admin' ORDER BY name COLLATE NOCASE`)
    .all();
  return json({
    admins: results.map((a) => ({ ...a, profile: cleanProfile('admin', {}, parseProfile(a.profile)) })),
  });
});

route('POST', '/api/admin/admins', async ({ request, env }) => {
  await requireUser(request, env, 'admin');
  return json(await createAccount(env, await readJson(request), 'admin'), 201);
});

route('DELETE', '/api/admin/admins/:id', async ({ request, env, params }) => {
  const me = await requireUser(request, env, 'admin');
  if (Number(params.id) === me.id) fail(400, "You can't remove your own admin account.");
  const d = await db(env);
  await d.batch([
    d.prepare(`DELETE FROM sessions WHERE user_id = ?1`).bind(Number(params.id)),
    d.prepare(`DELETE FROM users WHERE id = ?1 AND role = 'admin'`).bind(Number(params.id)),
  ]);
  return json({ ok: true });
});

/* ----------------------------- Admin: inquiries ---------------------------- */

route('GET', '/api/admin/inquiries', async ({ request, env }) => {
  await requireUser(request, env, 'admin');
  const d = await db(env);
  const { results } = await d.prepare(`SELECT * FROM inquiries ORDER BY created_at DESC LIMIT 500`).all();
  return json({ inquiries: results });
});

route('PATCH', '/api/admin/inquiries/:id', async ({ request, env, params }) => {
  await requireUser(request, env, 'admin');
  const body = await readJson(request);
  const d = await db(env);
  await d
    .prepare(`UPDATE inquiries SET is_read = ?1 WHERE id = ?2`)
    .bind(body.read ? 1 : 0, Number(params.id))
    .run();
  return json({ ok: true });
});

route('DELETE', '/api/admin/inquiries/:id', async ({ request, env, params }) => {
  await requireUser(request, env, 'admin');
  const d = await db(env);
  await d.prepare(`DELETE FROM inquiries WHERE id = ?1`).bind(Number(params.id)).run();
  return json({ ok: true });
});

/* ------------------------------- Family portal ----------------------------- */

route('GET', '/api/family/documents', async ({ request, env }) => {
  const user = await requireUser(request, env, 'family');
  const d = await db(env);
  const { results } = await d
    .prepare(`SELECT * FROM documents WHERE scope = 'family' AND family_id = ?1 ORDER BY sort, created_at DESC`)
    .bind(user.id)
    .all();
  return json({ documents: results.map(docOut) });
});

route('GET', '/api/family/photos', async ({ request, env }) => {
  const user = await requireUser(request, env, 'family');
  const d = await db(env);
  const { results } = await d
    .prepare(`SELECT * FROM photos WHERE scope = 'family' AND family_id = ?1 ORDER BY sort, created_at DESC`)
    .bind(user.id)
    .all();
  return json({ photos: results.map(photoOut) });
});

// Private photos: only the family they belong to (or an admin) can view them.
route('GET', '/api/photos/:id', async ({ request, env, params, url }) => {
  const user = await requireUser(request, env);
  const d = await db(env);
  const photo = await d.prepare(`SELECT * FROM photos WHERE id = ?1`).bind(params.id).first();
  if (!photo) fail(404, 'Photo not found.');
  if (user.role !== 'admin' && photo.family_id !== user.id) fail(404, 'Photo not found.');
  const obj = await env.PHOTOS.get(photo.r2_key);
  if (!obj) fail(404, 'Photo not found.');
  const headers = new Headers({
    'content-type': photo.content_type,
    'cache-control': 'private, max-age=86400',
    'x-content-type-options': 'nosniff',
  });
  if (url.searchParams.has('download')) {
    const ext = photo.content_type.split('/')[1].replace('jpeg', 'jpg');
    headers.set('content-disposition', `attachment; filename="photo-${photo.id}.${ext}"`);
  }
  return new Response(obj.body, { headers });
});
