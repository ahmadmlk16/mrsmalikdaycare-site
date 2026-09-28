// The separate "Daycare holidays" page (/holidays). Not linked from the homepage;
// the admin shares the link with families and it's linked from the family portal.
import { esc } from './util.js';
import { pageShell } from './page-shell.js';
import { formatRange, todayNY, weekdayCount } from './closures.js';

const MONTH = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short' });
const DAY = (iso) => Number(iso.slice(8, 10));
const telHref = (phone) => 'tel:' + String(phone || '').replace(/[^\d+]/g, '');

export function renderHolidays(site, closures, { loggedIn = null, now = new Date() } = {}) {
  const today = todayNY(now);
  const upcoming = closures.days.filter((c) => (c.end || c.start) >= today);
  const closedToday = upcoming.find((c) => c.start <= today);

  const byYear = new Map();
  for (const c of upcoming) {
    const y = c.start.slice(0, 4);
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(c);
  }

  const item = (c) => {
    const n = weekdayCount(c);
    const isNow = c.start <= today;
    return `
      <li class="closure${isNow ? ' is-now' : ''}">
        <div class="closure-date" aria-hidden="true"><span>${MONTH(c.start)}</span><strong>${DAY(c.start)}</strong></div>
        <div class="closure-body">
          <h3>${esc(c.name || 'Closed')}${isNow ? ' <span class="closure-tag">Closed now</span>' : ''}</h3>
          <p class="closure-when">${esc(formatRange(c))}${c.end && n > 1 ? ` · ${n} weekdays` : ''}</p>
          ${c.note ? `<p class="closure-note">${esc(c.note)}</p>` : ''}
        </div>
      </li>`;
  };

  const list = upcoming.length
    ? [...byYear]
        .map(
          ([y, items]) => `
      <h2 class="closure-year">${y}</h2>
      <ul class="closure-list">${items.map(item).join('')}</ul>`,
        )
        .join('')
    : `<div class="empty-card"><p>No closed days are scheduled right now. We're open our normal hours.</p></div>`;

  const hoursLine = site.hours.map((h) => `${h.days}${h.days && h.time ? ': ' : ''}${h.time}`).join(' · ');

  return pageShell(site, {
    title: closures.title,
    description: `Days ${site.name} is closed.`,
    bodyClass: 'page-holidays',
    loggedIn,
    adminHref: '/admin#closures',
    noindex: true,
    now,
    content: `
  <section class="section closures-page">
    <div class="container closures-inner">
      <div class="section-head">
        <p class="eyebrow">Closed days</p>
        <h1>${esc(closures.title)}</h1>
        ${closures.intro ? `<p class="muted">${esc(closures.intro)}</p>` : ''}
      </div>
      ${
        closedToday
          ? `<div class="closed-today" role="status"><strong>We're closed today</strong> for ${esc(closedToday.name || 'a scheduled closure')}.${
              closedToday.end ? ` We're closed through ${esc(formatRange({ start: closedToday.end }))}.` : ''
            }</div>`
          : ''
      }
      ${list}
      <p class="closures-foot muted">
        ${hoursLine ? `Regular hours: ${esc(hoursLine)}.<br>` : ''}
        Questions? ${site.phone ? `Call <a href="${telHref(site.phone)}">${esc(site.phone)}</a>` : ''}${site.phone && site.email ? ' or email ' : ''}${
          site.email ? `<a href="mailto:${esc(site.email)}">${esc(site.email)}</a>` : ''
        }.
      </p>
    </div>
  </section>`,
  });
}
