// Color themes for the public homepage, plus automatic holiday themes.
// Each theme overrides the CSS color variables used in public/assets/site.css.

export const THEMES = {
  warm: {
    label: 'Warm peach (default)',
    vars: {},
  },
  ocean: {
    label: 'Ocean blue',
    vars: {
      cream: '#f2f8fc', peach: '#d9ebf7', sky: '#e3f1f4', line: '#dbe7ef',
      orange: '#2f80c2', 'orange-dark': '#1f5f95', blue: '#1b4d6b', sun: '#f6c453', ground: '#cfe7ee',
    },
  },
  meadow: {
    label: 'Meadow green',
    vars: {
      cream: '#f5f9f1', peach: '#e0efd6', sky: '#e8f3ea', line: '#e0ead6',
      orange: '#4f9a4a', 'orange-dark': '#387535', blue: '#2e5a3a', sun: '#f2c94c', ground: '#cde5bf',
    },
  },
  lavender: {
    label: 'Lavender',
    vars: {
      cream: '#f8f5fc', peach: '#ebe1f7', sky: '#eee8f8', line: '#e7def2',
      orange: '#8a5cc7', 'orange-dark': '#6b41a3', blue: '#4b3a7a', sun: '#f6c453', ground: '#ddd2ee',
    },
  },
  sunshine: {
    label: 'Sunshine yellow',
    vars: {
      cream: '#fffbea', peach: '#fff0bf', sky: '#fdf6d8', line: '#f3e7bd',
      orange: '#e0a100', 'orange-dark': '#a87600', blue: '#6b4f00', sun: '#ffcf33', ground: '#f0e3a8',
    },
  },
  rose: {
    label: 'Rose pink',
    vars: {
      cream: '#fff5f7', peach: '#fbdde5', sky: '#fbe8ee', line: '#f3dde3',
      orange: '#d9557e', 'orange-dark': '#b23a61', blue: '#7a2f4b', sun: '#f6c453', ground: '#f3d3dd',
    },
  },

  // Holiday themes
  christmas: {
    label: 'Christmas',
    holiday: true,
    banner: '🎄 Merry Christmas and happy holidays from all of us!',
    vars: {
      cream: '#f7fbf8', peach: '#f9dcdc', sky: '#e7f2ec', line: '#e3ece6',
      orange: '#c0392b', 'orange-dark': '#962d22', blue: '#1f6b43', sun: '#f4c542', ground: '#ffffff',
    },
  },
  newyear: {
    label: 'New Year',
    holiday: true,
    banner: '🎉 Happy New Year! Wishing your family a wonderful year ahead.',
    vars: {
      cream: '#f7f7fb', peach: '#f3e6c4', sky: '#e6e9f5', line: '#e2e4ef',
      orange: '#c9961a', 'orange-dark': '#9a7110', blue: '#23305e', sun: '#f4c542', ground: '#dfe3f3',
    },
  },
  valentines: {
    label: "Valentine's Day",
    holiday: true,
    banner: "💝 Happy Valentine's Day! Lots of love from our daycare family.",
    vars: {
      cream: '#fff5f6', peach: '#fbd9df', sky: '#fce8ec', line: '#f4dbe0',
      orange: '#d6336c', 'orange-dark': '#a61e4d', blue: '#8a1c3b', sun: '#f7a8b8', ground: '#f8d4dc',
    },
  },
  eidfitr: {
    label: 'Eid al-Fitr',
    holiday: true,
    banner: '🌙 Eid Mubarak! Wishing your family joy and blessings.',
    vars: {
      cream: '#f5faf7', peach: '#dcefe3', sky: '#e3f0ea', line: '#dbe9e1',
      orange: '#1f8a5b', 'orange-dark': '#156845', blue: '#1d4d5c', sun: '#e8c35a', ground: '#d4ebdd',
    },
  },
  easter: {
    label: 'Easter / Spring',
    holiday: true,
    banner: '🐣 Happy Spring! Hoping your family has a sunny, joyful season.',
    vars: {
      cream: '#fbfaf2', peach: '#f3e3f6', sky: '#e3f3f7', line: '#ece9dc',
      orange: '#9b6bd1', 'orange-dark': '#7549ad', blue: '#3c6e8f', sun: '#ffe066', ground: '#d8efc9',
    },
  },
  eidadha: {
    label: 'Eid al-Adha',
    holiday: true,
    banner: '🌙 Eid Mubarak! Wishing your family peace and happiness.',
    vars: {
      cream: '#f7f9fb', peach: '#e3eaf6', sky: '#e6eef6', line: '#dde5ee',
      orange: '#2c6fb3', 'orange-dark': '#1f528a', blue: '#1d3f66', sun: '#e8c35a', ground: '#dbe6f2',
    },
  },
  july4: {
    label: 'Fourth of July',
    holiday: true,
    banner: '🎆 Happy Fourth of July!',
    vars: {
      cream: '#f7f9fc', peach: '#f8dada', sky: '#e2eaf6', line: '#e0e6ef',
      orange: '#c8323c', 'orange-dark': '#9c2530', blue: '#1f3f7a', sun: '#f4c542', ground: '#dce5f3',
    },
  },
  halloween: {
    label: 'Halloween',
    holiday: true,
    banner: '🎃 Happy Halloween! Have a safe and spooky-fun week.',
    vars: {
      cream: '#fdf7f0', peach: '#fbdcc0', sky: '#ece4f3', line: '#efe2d4',
      orange: '#e8741c', 'orange-dark': '#b85510', blue: '#4b2e6b', sun: '#f7b733', ground: '#e9d6c2',
    },
  },
  thanksgiving: {
    label: 'Thanksgiving',
    holiday: true,
    banner: '🍂 Happy Thanksgiving! We are so thankful for our daycare families.',
    vars: {
      cream: '#fcf6ee', peach: '#f3dcc2', sky: '#f1e8dc', line: '#eadccb',
      orange: '#b5651d', 'orange-dark': '#8a4a12', blue: '#5b3a1e', sun: '#e5a93a', ground: '#e6d2b4',
    },
  },
};

export const BASE_THEMES = Object.keys(THEMES).filter((k) => !THEMES[k].holiday);
export const HOLIDAY_THEMES = Object.keys(THEMES).filter((k) => THEMES[k].holiday);

// Eid dates follow the lunar calendar and can shift by a day depending on the
// moon sighting; these are the commonly expected dates in the US.
export const EID_FITR = ['2026-03-20', '2027-03-10', '2028-02-27', '2029-02-14', '2030-02-05', '2031-01-25', '2032-01-14'];
export const EID_ADHA = ['2026-05-27', '2027-05-16', '2028-05-05', '2029-04-24', '2030-04-13', '2031-04-03', '2032-03-22'];

const utc = (y, m, d) => Date.UTC(y, m - 1, d);

function easter(y) {
  // Anonymous Gregorian algorithm
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(y, month, day);
}

export function thanksgiving(y) {
  const nov1 = new Date(utc(y, 11, 1)).getUTCDay(); // 0 = Sunday
  const firstThu = 1 + ((4 - nov1 + 7) % 7);
  return utc(y, 11, firstThu + 21);
}

function holidayDates(y) {
  const iso = (list) => list.filter((s) => s.startsWith(String(y))).map((s) => Date.parse(s + 'T00:00:00Z'));
  return [
    ['newyear', [utc(y, 1, 1)]],
    ['valentines', [utc(y, 2, 14)]],
    ['eidfitr', iso(EID_FITR)],
    ['easter', [easter(y)]],
    ['eidadha', iso(EID_ADHA)],
    ['july4', [utc(y, 7, 4)]],
    ['halloween', [utc(y, 10, 31)]],
    ['thanksgiving', [thanksgiving(y)]],
    ['christmas', [utc(y, 12, 25)]],
  ];
}

// Today's date in the daycare's time zone, as a UTC midnight timestamp.
function todayInVirginia(now = new Date()) {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' })
    .format(now)
    .split('-')
    .map(Number);
  return utc(y, m, d);
}

// The holiday within `windowDays` of today that is closest, or null.
export function currentHoliday(enabled, { now = new Date(), windowDays = 7 } = {}) {
  const today = todayInVirginia(now);
  const year = new Date(today).getUTCFullYear();
  let best = null;
  for (const y of [year - 1, year, year + 1]) {
    for (const [key, dates] of holidayDates(y)) {
      if (!enabled.includes(key)) continue;
      for (const t of dates) {
        const days = Math.abs(t - today) / 86400000;
        if (days <= windowDays && (!best || days < best.days)) best = { key, days };
      }
    }
  }
  return best ? best.key : null;
}

// Decide which theme to show right now.
export function activeTheme(site, opts) {
  const base = THEMES[site.theme] ? site.theme : 'warm';
  if (site.holidayThemes) {
    const holiday = currentHoliday(site.holidays, opts);
    if (holiday) return { key: holiday, holiday: true };
  }
  return { key: base, holiday: false };
}

export function themeStyle(key) {
  const t = THEMES[key] || THEMES.warm;
  const vars = Object.entries(t.vars).map(([k, v]) => `--${k}:${v}`);
  return vars.length ? `:root{${vars.join(';')}}` : '';
}
