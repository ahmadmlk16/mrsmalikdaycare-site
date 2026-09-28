// Little things that drift down over the cover during holidays: snowflakes for
// Christmas, pumpkins for Halloween, crescents and stars for Eid, and so on.
// Pure CSS animation (no JavaScript), hidden for people who prefer less motion.

const SHAPES = {
  snowflake: (c) =>
    `<svg viewBox="0 0 24 24"><g stroke="${c}" stroke-width="2" stroke-linecap="round" fill="none"><path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7"/><path d="m9 4 3 2.5L15 4M9 20l3-2.5 3 2.5"/></g></svg>`,
  snowdot: (c) => `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="${c}"/></svg>`,
  pumpkin: (c) =>
    `<svg viewBox="0 0 24 24"><path d="M12 7c-1-2.5 0-4.5 2-5" stroke="#4f7a2a" stroke-width="2" fill="none" stroke-linecap="round"/><ellipse cx="7.5" cy="14" rx="5.5" ry="7" fill="${c}"/><ellipse cx="16.5" cy="14" rx="5.5" ry="7" fill="${c}"/><ellipse cx="12" cy="14" rx="4.5" ry="7.5" fill="#f7a13d"/><path d="M12 7v14" stroke="#c96a12" stroke-width="1" opacity=".6"/></svg>`,
  crescent: (c) => `<svg viewBox="0 0 24 24"><path d="M15.5 2.5a10 10 0 1 0 6 16.8A8 8 0 1 1 15.5 2.5z" fill="${c}"/></svg>`,
  star: (c) =>
    `<svg viewBox="0 0 24 24"><path d="m12 2 2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 16.9l-6.1 3.5 1.5-6.8L2.2 9l6.9-.7z" fill="${c}"/></svg>`,
  heart: (c) =>
    `<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-10-9.3C.4 8.3 2.4 4 6.5 4c2.1 0 3.6 1.1 4.5 2.5C11.9 5.1 13.4 4 15.5 4 19.6 4 21.6 8.3 22 11.7 19.5 16.4 12 21 12 21z" fill="${c}"/></svg>`,
  egg: (c) =>
    `<svg viewBox="0 0 24 24"><path d="M12 2C7.8 2 5 9 5 14a7 7 0 0 0 14 0c0-5-2.8-12-7-12z" fill="${c}"/><path d="m5.3 12.5 2.3-1.8 2.2 1.8 2.2-1.8 2.2 1.8 2.2-1.8 2.3 1.8" stroke="#fff" stroke-width="1.5" fill="none" stroke-linejoin="round"/></svg>`,
  leaf: (c) =>
    `<svg viewBox="0 0 24 24"><path d="M12 2 14 7l4-2-1 5 5 1-4 3 2 3-5-.5L12 22l-3-5.5-5 .5 2-3-4-3 5-1-1-5 4 2z" fill="${c}"/><path d="M12 8v14" stroke="#7a3f12" stroke-width="1" opacity=".5"/></svg>`,
  confetti: (c) => `<svg viewBox="0 0 24 24"><rect x="8" y="3" width="8" height="18" rx="2" fill="${c}"/></svg>`,
};

// [shape, color] pairs for each holiday theme.
const EFFECTS = {
  christmas: [['snowflake', '#b9d3ea'], ['snowdot', '#dbe8f4'], ['snowflake', '#cfe0ef'], ['snowdot', '#c9dcec']],
  newyear: [['confetti', '#e2b23a'], ['confetti', '#6c7fd8'], ['star', '#f2c94c'], ['confetti', '#e46a8a'], ['snowdot', '#f2c94c']],
  valentines: [['heart', '#f28fa5'], ['heart', '#e3526f'], ['heart', '#f7b8c6']],
  eidfitr: [['crescent', '#e6b43c'], ['star', '#f2cd5c'], ['crescent', '#d9a42b'], ['star', '#b8a4e0']],
  easter: [['egg', '#f7b6c8'], ['egg', '#a8d8f0'], ['egg', '#c4e3a4'], ['egg', '#f9dc87'], ['egg', '#cdb8ef']],
  eidadha: [['crescent', '#e6b43c'], ['star', '#f2cd5c'], ['crescent', '#d9a42b'], ['star', '#9ed0c4']],
  july4: [['star', '#c8323c'], ['star', '#2b4c9b'], ['confetti', '#c8323c'], ['confetti', '#2b4c9b'], ['star', '#c9d3e6']],
  halloween: [['pumpkin', '#ef8a23'], ['pumpkin', '#e57a17'], ['leaf', '#b5561c'], ['pumpkin', '#f39a36']],
  thanksgiving: [['leaf', '#d9662b'], ['leaf', '#b8431f'], ['leaf', '#e0a02f'], ['leaf', '#9a5a2a']],
};

export const HAS_EFFECT = Object.keys(EFFECTS);

// Small seeded random generator, so the layout is the same on every page load.
function rng(seed) {
  let s = 0;
  for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function fallingHtml(themeKey, count = 18) {
  const set = EFFECTS[themeKey];
  if (!set) return '';
  const rand = rng(themeKey);
  const items = [];
  for (let i = 0; i < count; i++) {
    const [shape, color] = set[i % set.length];
    const size = Math.round(12 + rand() * 14); // 12–26px
    const dur = (11 + rand() * 9).toFixed(1); // seconds to fall
    const x = ((i + rand() * 0.8) / count) * 100; // spread across the width
    items.push(
      `<i style="--x:${x.toFixed(1)}%;--s:${size}px;--d:${dur}s;--delay:-${(rand() * dur).toFixed(1)}s;--spin:${Math.round(
        (rand() - 0.5) * 540,
      )}deg;--sway:${Math.round(8 + rand() * 18)}px">${SHAPES[shape](color)}</i>`,
    );
  }
  return `<div class="fall fall-${themeKey}" aria-hidden="true">${items.join('')}</div>`;
}
