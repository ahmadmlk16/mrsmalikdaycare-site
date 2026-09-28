// Shared layout (head, header, footer) for the smaller pages like /holidays and
// /articles, so they match the homepage and follow the current color theme.
import { esc } from './util.js';
import { activeTheme, themeStyle } from './themes.js';

export const ASSET_V = '20260928d';

export function pageShell(site, { title, description = '', bodyClass = '', loggedIn = null, adminHref = '/admin', noindex = false, now = new Date(), content }) {
  const theme = activeTheme(site, { now });
  const style = themeStyle(theme.key);
  const year = new Date(now).getFullYear();
  const account = loggedIn
    ? `<a class="btn btn-ghost btn-sm" href="${loggedIn === 'admin' ? esc(adminHref) : '/portal'}">${loggedIn === 'admin' ? 'Dashboard' : 'My photos'}</a>`
    : `<a class="btn btn-ghost btn-sm" href="/login">Parent login</a>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} | ${esc(site.name)}</title>
${description ? `<meta name="description" content="${esc(description)}">` : ''}
${noindex ? '<meta name="robots" content="noindex">' : ''}
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/site.css?v=${ASSET_V}">
${style ? `<style>${style}</style>` : ''}
</head>
<body class="theme-${esc(theme.key)} page-sub ${esc(bodyClass)}">
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <div class="container header-inner">
    <a class="brand" href="/">
      <img src="/assets/favicon.svg" alt="" width="36" height="36">
      <span>${esc(site.name)}</span>
    </a>
    <nav class="site-nav site-nav-simple" aria-label="Main">
      <a href="/">Home</a>
      ${account}
    </nav>
  </div>
</header>

<main id="main">
${content}
</main>

<footer class="site-footer">
  <div class="container footer-inner">
    <div>
      <strong>${esc(site.name)}</strong>
      <p>${esc(site.license)}${site.area ? ' · ' + esc(site.area) : ''}</p>
    </div>
    <div class="footer-links"><a href="/">Home</a><a href="/articles">Articles</a><a href="/login">Parent login</a></div>
    <p class="copyright">&copy; ${year} ${esc(site.name)}</p>
  </div>
</footer>
</body>
</html>`;
}
