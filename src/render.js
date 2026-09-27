// Server-rendered homepage, built from the content saved in the admin dashboard.
import { esc } from './util.js';

const paragraphs = (text) =>
  String(text || '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('');

const telHref = (phone) => 'tel:' + String(phone || '').replace(/[^\d+]/g, '');

const ICONS = {
  phone:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5-8-5V6l8 5 8-5z"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>',
  clock:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7z"/></svg>',
  heart:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-10-9.3C.4 8.3 2.4 4 6.5 4c2.1 0 3.6 1.1 4.5 2.5C11.9 5.1 13.4 4 15.5 4 19.6 4 21.6 8.3 22 11.7 19.5 16.4 12 21 12 21z"/></svg>',
  shield:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5zm-1.2 14.2-3.5-3.5 1.4-1.4 2.1 2.1 4.9-4.9 1.4 1.4z"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.8 5.7 21.4l1.5-7.1L1.8 9.4 9 8.6z"/></svg>',
};
const HIGHLIGHT_ICONS = ['shield', 'heart', 'star', 'heart', 'shield', 'star'];

// Friendly illustration used until a cover photo is uploaded.
const COVER_ILLUSTRATION = `
<svg class="cover-illustration" viewBox="0 0 480 420" role="img" aria-label="Illustration of a cozy house with a sun and a tree">
  <circle cx="390" cy="80" r="46" fill="#F6C453"/>
  <g stroke="#F6C453" stroke-width="8" stroke-linecap="round">
    <path d="M390 12v14M390 134v14M322 80h14M444 80h14M342 32l10 10M428 118l10 10M342 128l10-10M428 42l10-10"/>
  </g>
  <ellipse cx="240" cy="380" rx="220" ry="34" fill="#CFE3C4"/>
  <circle cx="92" cy="250" r="58" fill="#8DB386"/><circle cx="60" cy="210" r="40" fill="#9FC398"/>
  <rect x="86" y="280" width="14" height="96" rx="6" fill="#9A6B4C"/>
  <rect x="160" y="200" width="200" height="176" rx="14" fill="#FFFFFF"/>
  <path d="M140 214 260 112l120 102z" fill="#E2712F" stroke="#E2712F" stroke-width="16" stroke-linejoin="round"/>
  <rect x="236" y="286" width="48" height="90" rx="24" fill="#1E4F7A"/>
  <circle cx="274" cy="334" r="4" fill="#F6C453"/>
  <rect x="184" y="236" width="46" height="46" rx="10" fill="#DDEBF6"/>
  <rect x="290" y="236" width="46" height="46" rx="10" fill="#DDEBF6"/>
  <path d="M207 236v46M184 259h46M313 236v46M290 259h46" stroke="#FFFFFF" stroke-width="4"/>
  <circle cx="190" cy="360" r="8" fill="#F29BAB"/><circle cx="330" cy="362" r="8" fill="#F6C453"/>
  <circle cx="352" cy="352" r="8" fill="#F29BAB"/><circle cx="170" cy="350" r="6" fill="#F6C453"/>
</svg>`;

export function renderHome(site, gallery, { loggedIn = null } = {}) {
  const year = new Date().getFullYear();
  const hoursLine = site.hours.map((h) => `${h.days}${h.days && h.time ? ': ' : ''}${h.time}`).join(' · ');
  const title = `${site.name} | Family Home Daycare in ${site.area}`;
  const description = site.heroSubtitle;

  const cover = site.coverPhotoId
    ? `<img src="/media/${esc(site.coverPhotoId)}" alt="${esc(site.name)}" fetchpriority="high">`
    : COVER_ILLUSTRATION;

  const nav = [
    ['about', 'About'],
    ['schedule', 'Daily schedule'],
    ['faq', 'FAQ'],
    ['gallery', 'Gallery'],
    ['contact', 'Contact'],
  ];

  const loginLink = loggedIn
    ? `<a class="btn btn-ghost btn-sm" href="${loggedIn === 'admin' ? '/admin' : '/portal'}">${loggedIn === 'admin' ? 'Dashboard' : 'My photos'}</a>`
    : `<a class="btn btn-ghost btn-sm" href="/login">Parent login</a>`;

  const galleryHtml = gallery.length
    ? `<div class="gallery-grid">${gallery
        .map(
          (p, i) => `
        <figure class="gallery-item">
          <button type="button" class="gallery-open" data-index="${i}" aria-label="Open photo${p.caption ? ': ' + esc(p.caption) : ''}">
            <img src="/media/${esc(p.id)}" alt="${esc(p.caption || 'Daycare photo')}" loading="lazy"${
              p.width && p.height ? ` width="${p.width}" height="${p.height}"` : ''
            }>
          </button>
          ${p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : ''}
        </figure>`,
        )
        .join('')}</div>`
    : `<div class="empty-card"><p>Photos of our play space and activities are coming soon.</p></div>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(site.name)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
${site.coverPhotoId ? `<meta property="og:image" content="/media/${esc(site.coverPhotoId)}">` : ''}
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/site.css">
<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ChildCare',
    name: site.name,
    description,
    telephone: site.phone,
    email: site.email,
    address: site.area,
    openingHours: hoursLine,
  }).replace(/</g, '\\u003c')}</script>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>

<header class="site-header" id="top">
  <div class="container header-inner">
    <a class="brand" href="#top">
      <img src="/assets/favicon.svg" alt="" width="36" height="36">
      <span>${esc(site.name)}</span>
    </a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav">
      <span class="sr-only">Menu</span><span class="bars" aria-hidden="true"></span>
    </button>
    <nav id="site-nav" class="site-nav" aria-label="Main">
      ${nav.map(([id, label]) => `<a href="#${id}" data-nav="${id}">${label}</a>`).join('')}
      ${loginLink}
    </nav>
  </div>
</header>

<main id="main">
  <section class="hero" aria-labelledby="hero-title">
    <div class="container hero-inner">
      <div class="hero-copy">
        ${site.enrollmentStatus ? `<span class="pill"><span class="dot"></span>${esc(site.enrollmentStatus)}</span>` : ''}
        <h1 id="hero-title">${esc(site.heroTitle)}</h1>
        <p class="lead">${esc(site.heroSubtitle)}</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="#contact" data-kind="tour">Schedule a visit</a>
          ${site.phone ? `<a class="btn btn-secondary" href="${esc(telHref(site.phone))}">${ICONS.phone} Call ${esc(site.phone)}</a>` : ''}
        </div>
        <dl class="facts">
          ${site.ages ? `<div><dt>Ages</dt><dd>${esc(site.ages)}</dd></div>` : ''}
          ${site.hours[0] ? `<div><dt>Hours</dt><dd>${esc(site.hours[0].time)}</dd></div>` : ''}
          ${site.license ? `<div><dt>Licensed</dt><dd>${esc(site.license)}</dd></div>` : ''}
        </dl>
      </div>
      <div class="hero-media${site.coverPhotoId ? ' has-photo' : ''}">${cover}</div>
    </div>
  </section>

  <section id="about" class="section" aria-labelledby="about-title">
    <div class="container about-inner">
      <div class="about-media">
        ${
          site.storyPhotoId
            ? `<img src="/media/${esc(site.storyPhotoId)}" alt="${esc(site.storyTitle)}" loading="lazy">`
            : `<div class="about-placeholder" aria-hidden="true">${ICONS.heart}</div>`
        }
      </div>
      <div class="about-copy">
        <p class="eyebrow">About us</p>
        <h2 id="about-title">${esc(site.storyTitle)}</h2>
        ${paragraphs(site.storyBody)}
      </div>
    </div>
    ${
      site.highlights.length
        ? `<div class="container"><ul class="highlights">${site.highlights
            .map(
              (h, i) => `<li><span class="icon">${ICONS[HIGHLIGHT_ICONS[i]]}</span><h3>${esc(h.title)}</h3><p>${esc(
                h.text,
              )}</p></li>`,
            )
            .join('')}</ul></div>`
        : ''
    }
  </section>

  <section id="schedule" class="section section-tint" aria-labelledby="schedule-title">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">A day with us</p>
        <h2 id="schedule-title">Daily schedule</h2>
        ${hoursLine ? `<p class="muted">${ICONS.clock} ${esc(hoursLine)}</p>` : ''}
      </div>
      <ol class="timeline">
        ${site.schedule
          .map(
            (s) => `<li>
          <span class="time">${esc(s.time)}</span>
          <div class="what"><h3>${esc(s.activity)}</h3>${s.detail ? `<p>${esc(s.detail)}</p>` : ''}</div>
        </li>`,
          )
          .join('')}
      </ol>
    </div>
  </section>

  <section id="faq" class="section" aria-labelledby="faq-title">
    <div class="container narrow">
      <div class="section-head">
        <p class="eyebrow">Questions</p>
        <h2 id="faq-title">Frequently asked questions</h2>
      </div>
      <div class="faq-list">
        ${site.faqs
          .map(
            (f) => `<details class="faq">
          <summary>${esc(f.q)}</summary>
          <div class="faq-answer">${paragraphs(f.a)}</div>
        </details>`,
          )
          .join('')}
      </div>
    </div>
  </section>

  <section id="gallery" class="section section-tint" aria-labelledby="gallery-title">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">Take a look</p>
        <h2 id="gallery-title">Gallery</h2>
      </div>
      ${galleryHtml}
    </div>
  </section>

  <section id="contact" class="section" aria-labelledby="contact-title">
    <div class="container contact-inner">
      <div class="contact-info">
        <p class="eyebrow">Get in touch</p>
        <h2 id="contact-title">Schedule a visit or ask a question</h2>
        <p>${esc(site.contactIntro)}</p>
        <ul class="contact-list">
          ${site.phone ? `<li>${ICONS.phone}<a href="${esc(telHref(site.phone))}">${esc(site.phone)}</a></li>` : ''}
          ${site.email ? `<li>${ICONS.mail}<a href="mailto:${esc(site.email)}">${esc(site.email)}</a></li>` : ''}
          ${site.area ? `<li>${ICONS.pin}<span>${esc(site.area)}</span></li>` : ''}
          ${site.hours.map((h) => `<li>${ICONS.clock}<span>${esc(h.days)}${h.days && h.time ? ': ' : ''}${esc(h.time)}</span></li>`).join('')}
        </ul>
      </div>

      <form class="card contact-form" id="inquiry-form" novalidate>
        <div class="segmented" role="radiogroup" aria-label="What would you like to do?">
          <label><input type="radio" name="kind" value="tour" checked><span>Schedule a visit</span></label>
          <label><input type="radio" name="kind" value="question"><span>Ask a question</span></label>
        </div>
        <div class="field-row">
          <label class="field"><span>Your name *</span><input name="name" autocomplete="name" required maxlength="100"></label>
          <label class="field"><span>Email *</span><input name="email" type="email" autocomplete="email" required maxlength="200"></label>
        </div>
        <div class="field-row">
          <label class="field"><span>Phone</span><input name="phone" type="tel" autocomplete="tel" maxlength="40"></label>
          <label class="field"><span>Child's age</span><input name="childAge" maxlength="60" placeholder="e.g. 18 months"></label>
        </div>
        <label class="field tour-only"><span>Preferred day &amp; time for a visit</span><input name="preferredDate" maxlength="100" placeholder="e.g. Tuesday afternoon"></label>
        <label class="field"><span class="msg-label">Message</span><textarea name="message" rows="4" maxlength="4000"></textarea></label>
        <label class="hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>
        <button class="btn btn-primary btn-block" type="submit">Send</button>
        <p class="form-status" role="status" aria-live="polite"></p>
      </form>
    </div>
  </section>
</main>

<footer class="site-footer">
  <div class="container footer-inner">
    <div>
      <strong>${esc(site.name)}</strong>
      <p>${esc(site.license)}${site.area ? ' · ' + esc(site.area) : ''}</p>
    </div>
    <div class="footer-links">
      <a href="#contact" data-kind="tour">Schedule a visit</a>
      <a href="/login">Parent login</a>
    </div>
    <p class="copyright">&copy; ${year} ${esc(site.name)}</p>
  </div>
</footer>

<div class="lightbox" id="lightbox" hidden>
  <button class="lb-close" type="button" aria-label="Close">&times;</button>
  <button class="lb-prev" type="button" aria-label="Previous photo">&#8249;</button>
  <figure><img alt=""><figcaption></figcaption></figure>
  <button class="lb-next" type="button" aria-label="Next photo">&#8250;</button>
</div>

<script>window.GALLERY=${JSON.stringify(gallery.map((p) => ({ src: `/media/${p.id}`, caption: p.caption }))).replace(/</g, '\\u003c')};</script>
<script src="/assets/site.js" defer></script>
</body>
</html>`;
}
