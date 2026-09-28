// Days the daycare is closed (holidays, vacation, teacher training, etc.).
// Stored on their own (settings key 'closures') so saving the homepage never
// overwrites them, and shown only on the separate /holidays page.
import { db } from './db.js';
import { str } from './util.js';
import { EID_ADHA, EID_FITR, thanksgiving } from './themes.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (v) => {
  if (!DATE.test(v || '')) return '';
  const d = new Date(v + 'T12:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === v ? v : '';
};

export const DEFAULT_CLOSURES = {
  title: 'Daycare holidays',
  intro: 'The daycare is closed on the days below. Please plan other care for these dates. If anything changes we will let you know.',
  days: [],
};

export function cleanClosures(input) {
  const s = { ...DEFAULT_CLOSURES, ...(input || {}) };
  const days = (Array.isArray(s.days) ? s.days : [])
    .slice(0, 200)
    .map((c) => {
      const start = validDate(c?.start);
      let end = validDate(c?.end);
      if (!start || end <= start) end = '';
      return { start, end, name: str(c?.name, 100), note: str(c?.note, 300) };
    })
    .filter((c) => c.start)
    .sort((a, b) => a.start.localeCompare(b.start));
  return { title: str(s.title, 100) || DEFAULT_CLOSURES.title, intro: str(s.intro, 1000), days };
}

export async function getClosures(env) {
  if (!env.DB) return cleanClosures();
  const d = await db(env);
  const row = await d.prepare(`SELECT value FROM settings WHERE key = 'closures'`).first();
  try {
    return cleanClosures(row ? JSON.parse(row.value) : null);
  } catch {
    return cleanClosures();
  }
}

export async function saveClosures(env, input) {
  const clean = cleanClosures(input);
  const d = await db(env);
  await d
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES ('closures', ?1, ?2)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .bind(JSON.stringify(clean), Math.floor(Date.now() / 1000))
    .run();
  return clean;
}

// Today's date (YYYY-MM-DD) in the daycare's time zone.
export function todayNY(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(now);
}

const fmt = (iso, opts) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', ...opts });

// "Thursday, Nov 26" or "Mon, Dec 22 – Fri, Jan 2"
export function formatRange({ start, end }) {
  if (!end) return fmt(start, { weekday: 'long', month: 'long', day: 'numeric' });
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  return `${fmt(start, { weekday: 'short', month: 'short', day: 'numeric' })} – ${fmt(end, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })}`;
}

// Number of weekdays covered (so "Dec 22 – Jan 2" shows as 10 days, not 12).
export function weekdayCount({ start, end }) {
  let n = 0;
  const last = new Date((end || start) + 'T12:00:00Z');
  for (let d = new Date(start + 'T12:00:00Z'); d <= last; d.setUTCDate(d.getUTCDate() + 1)) {
    const w = d.getUTCDay();
    if (w !== 0 && w !== 6) n++;
  }
  return n;
}

// Common closure days for the next 12 months, offered as one-click suggestions
// in the admin (skipping any that are already on the list).
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const nthWeekday = (y, m, weekday, n) => {
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  return Date.UTC(y, m - 1, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7);
};
const lastWeekday = (y, m, weekday) => {
  const last = new Date(Date.UTC(y, m, 0));
  return Date.UTC(y, m - 1, last.getUTCDate() - ((last.getUTCDay() - weekday + 7) % 7));
};
const DAY_MS = 86400000;

export function suggestions(existing = [], now = new Date()) {
  const today = todayNY(now);
  const limit = iso(Date.parse(today + 'T00:00:00Z') + 366 * DAY_MS);
  const taken = new Set(existing.map((c) => c.start));
  const out = [];
  const y0 = Number(today.slice(0, 4));
  for (const y of [y0, y0 + 1]) {
    const eid = (list) => list.find((d) => d.startsWith(String(y)));
    const tg = thanksgiving(y);
    const items = [
      ["New Year's Day", iso(Date.UTC(y, 0, 1))],
      ['Martin Luther King Jr. Day', iso(nthWeekday(y, 1, 1, 3))],
      ["Presidents' Day", iso(nthWeekday(y, 2, 1, 3))],
      ['Eid al-Fitr', eid(EID_FITR)],
      ['Memorial Day', iso(lastWeekday(y, 5, 1))],
      ['Eid al-Adha', eid(EID_ADHA)],
      ['Juneteenth', iso(Date.UTC(y, 5, 19))],
      ['Independence Day', iso(Date.UTC(y, 6, 4))],
      ['Labor Day', iso(nthWeekday(y, 9, 1, 1))],
      ['Thanksgiving', iso(tg), iso(tg + DAY_MS)],
      ['Christmas', iso(Date.UTC(y, 11, 24)), iso(Date.UTC(y, 11, 25))],
    ];
    for (const [name, start, end = ''] of items) {
      if (start && start >= today && start <= limit && !taken.has(start)) out.push({ name, start, end, note: '' });
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}
