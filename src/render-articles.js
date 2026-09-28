// The /articles page: a simple list of links the admin manages.
import { esc } from './util.js';
import { pageShell } from './page-shell.js';

const ARROW_OUT =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3h7v7h-2V6.4l-9.3 9.3-1.4-1.4L17.6 5H14zM5 5h6v2H7v10h10v-4h2v6H5z"/></svg>';
const ARROW =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.2 5.3 19.9 12l-6.7 6.7-1.4-1.4 4.3-4.3H4v-2h12.1l-4.3-4.3z"/></svg>';

export function renderArticles(site, articles, { loggedIn = null } = {}) {
  const list = articles.links.length
    ? `<ul class="article-list">${articles.links
        .map((l) => {
          const external = !l.url.startsWith('/');
          let host = '';
          if (external) {
            try {
              host = new URL(l.url).hostname.replace(/^www\./, '');
            } catch {}
          }
          return `
        <li>
          <a class="article-link" href="${esc(l.url)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>
            <span class="article-text">
              <strong>${esc(l.title)}</strong>
              ${l.description ? `<span class="article-desc">${esc(l.description)}</span>` : ''}
              ${host ? `<span class="article-host">${esc(host)}</span>` : ''}
            </span>
            <span class="article-icon">${external ? ARROW_OUT : ARROW}</span>
            ${external ? '<span class="sr-only">(opens in a new tab)</span>' : ''}
          </a>
        </li>`;
        })
        .join('')}</ul>`
    : `<div class="empty-card"><p>Nothing here yet. Check back soon!</p></div>`;

  return pageShell(site, {
    title: articles.title,
    description: articles.intro || `Articles and helpful links from ${site.name}.`,
    bodyClass: 'page-articles',
    loggedIn,
    adminHref: '/admin#articles',
    content: `
  <section class="section articles-page">
    <div class="container articles-inner">
      <div class="section-head">
        <p class="eyebrow">For families</p>
        <h1>${esc(articles.title)}</h1>
        ${articles.intro ? `<p class="muted">${esc(articles.intro)}</p>` : ''}
      </div>
      ${list}
    </div>
  </section>`,
  });
}
