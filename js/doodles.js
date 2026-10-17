// Hand-drawn style SVG doodles and line icons, all inline so they work offline.

const INK = '#6f5ea3';
const BLUSH = '#ffb3c8';
const EAR = '#ffd3e1';

const DOODLES = {
  bunny: `<svg viewBox="0 0 64 64" aria-hidden="true"><g stroke="${INK}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path fill="#fff" d="M23 32C17.5 21 16.5 7 22.5 6S29.5 18 29 29"/>
    <path fill="#fff" d="M41 32c5.5-11 6.5-25 .5-26S34.5 18 35 29"/>
    <ellipse cx="23.4" cy="18" rx="2" ry="7" fill="${EAR}" stroke="none" transform="rotate(-6 23.4 18)"/>
    <ellipse cx="40.6" cy="18" rx="2" ry="7" fill="${EAR}" stroke="none" transform="rotate(6 40.6 18)"/>
    <ellipse cx="32" cy="43" rx="18.5" ry="14.5" fill="#fff"/>
    <path fill="none" d="M29.5 47q1.25 1.6 2.5 0 1.25 1.6 2.5 0"/></g>
    <circle cx="25.2" cy="42" r="2" fill="${INK}"/><circle cx="38.8" cy="42" r="2" fill="${INK}"/>
    <ellipse cx="21" cy="47.5" rx="3.2" ry="1.9" fill="${BLUSH}"/><ellipse cx="43" cy="47.5" rx="3.2" ry="1.9" fill="${BLUSH}"/></svg>`,

  cat: `<svg viewBox="0 0 64 64" aria-hidden="true"><g stroke="${INK}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path fill="#fff" d="M12.5 44c0-8.5 2-14.5 4.5-19L15.5 10.5l12 8c3-.8 6-.8 9 0l12-8L47 25c2.5 4.5 4.5 10.5 4.5 19 0 9.5-8.5 14-19.5 14s-19.5-4.5-19.5-14z"/>
    <path fill="none" d="M21.5 40.5q3-3 6 0M36.5 40.5q3-3 6 0M32 46.8v1.2q-1.6 2-3.2.4M32 48q1.6 2 3.2.4M11 43.5l-6-1.2M11 47.5l-6 .8M53 43.5l6-1.2M53 47.5l6 .8"/></g>
    <path fill="${EAR}" d="M19 15.5l.9 7 4.3-3.2zM45 15.5l-.9 7-4.3-3.2z"/>
    <path fill="#f58fae" d="M30.4 45.2h3.2L32 46.9z"/>
    <ellipse cx="20" cy="46" rx="3.2" ry="1.9" fill="${BLUSH}"/><ellipse cx="44" cy="46" rx="3.2" ry="1.9" fill="${BLUSH}"/></svg>`,

  sleepycat: `<svg viewBox="0 0 132 72" aria-hidden="true"><g stroke="#2d2541" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path fill="#3f3658" d="M116 58c10-2 13-12 6-15"/>
    <ellipse cx="80" cy="52" rx="44" ry="17" fill="#3f3658"/>
    <path fill="#3f3658" d="M8 50c0-8 2-13 4-17l-1.5-13 10.5 7c2.6-.7 5.4-.7 8 0l10.5-7L38 33c2 4 4 9 4 17 0 8.5-7.5 13-17 13S8 58.5 8 50z"/>
    <ellipse cx="32" cy="64" rx="7" ry="4" fill="#fff"/><ellipse cx="48" cy="65" rx="7" ry="4" fill="#fff"/></g>
    <path d="M15 47q3.2 2.6 6.4 0M28.6 47q3.2 2.6 6.4 0" fill="none" stroke="#e9e0ff" stroke-width="2" stroke-linecap="round"/>
    <ellipse cx="14" cy="53" rx="3" ry="1.7" fill="#ff9fbc" opacity=".85"/><ellipse cx="36" cy="53" rx="3" ry="1.7" fill="#ff9fbc" opacity=".85"/>
    <path fill="#ffd3e1" d="M14.5 24.5l.6 5.2 3.4-2.4zM35.5 24.5l-.6 5.2-3.4-2.4z"/>
    <text x="48" y="22" font-family="Fredoka, sans-serif" font-size="12" fill="#a99bd6">z</text><text x="57" y="13" font-family="Fredoka, sans-serif" font-size="9" fill="#c4b8ea">z</text></svg>`,

  heart: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-10a4.2 4.2 0 0 1 7.5-2.6 4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" fill="#ffb3cb" stroke="#ec86a8" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
  star: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.5 2.6 5.2 5.7.8-4.1 4 1 5.7L12 16.5l-5.2 2.7 1-5.7-4.1-4 5.7-.8z" fill="#ffe08a" stroke="#efb94c" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
  sparkle: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5c.8 5.2 2.3 7.8 9.5 9.5-7.2 1.7-8.7 4.3-9.5 9.5-.8-5.2-2.3-7.8-9.5-9.5 7.2-1.7 8.7-4.3 9.5-9.5z" fill="#d9ccff" stroke="#a996e6" stroke-width="1.3" stroke-linejoin="round"/></svg>`,
};

export const doodle = (name) => DOODLES[name] || '';

const ICONS = {
  home: '<path d="M4 11.5 12 5l8 6.5"/><path d="M6.5 10v8.5A1.5 1.5 0 0 0 8 20h8a1.5 1.5 0 0 0 1.5-1.5V10"/><path d="M10 20v-5h4v5"/>',
  notes: '<rect x="5" y="3.5" width="14" height="17" rx="3"/><path d="M9 8.5h6M9 12h6M9 15.5h4"/>',
  todo: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  archive: '<rect x="3.5" y="4.5" width="17" height="4.5" rx="1.5"/><path d="M5 9v8.5A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5V9M10 13h4"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  pin: '<path d="M9 4h6l-1 5 3.5 3.5h-11L10 9z"/><path d="M12 12.5V20"/>',
  star: '<path d="m12 3.8 2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8z"/>',
  more: '<circle cx="12" cy="5.5" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="18.5" r="1.3" fill="currentColor"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="m4 17 5-4.5 4 3.5 2.5-2 4.5 3.5"/>',
  palette: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-1 1.6-2.1-.5-1.3.3-2.4 1.7-2.4H18a2.5 2.5 0 0 0 2.5-2.5A8.5 8.5 0 0 0 12 3.5z"/><circle cx="7.8" cy="11" r="1.1"/><circle cx="10.5" cy="7.6" r="1.1"/><circle cx="14.8" cy="7.8" r="1.1"/>',
  bullet: '<circle cx="5.5" cy="7" r="1.2" fill="currentColor"/><circle cx="5.5" cy="12" r="1.2" fill="currentColor"/><circle cx="5.5" cy="17" r="1.2" fill="currentColor"/><path d="M10 7h9M10 12h9M10 17h9"/>',
  folder: '<path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h3.5l2 2.5H18a2.5 2.5 0 0 1 2.5 2.5v7a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 17z"/>',
  trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12.5h8L17 7"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>',
  upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 19.5h14"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4.5l3 2"/>',
  share: '<circle cx="17" cy="6" r="2.5"/><circle cx="7" cy="12" r="2.5"/><circle cx="17" cy="18" r="2.5"/><path d="m9.2 10.8 5.6-3.4M9.2 13.2l5.6 3.4"/>',
  heart: '<path d="M12 19.5s-7.5-4.6-7.5-10a4.2 4.2 0 0 1 7.5-2.6 4.2 4.2 0 0 1 7.5 2.6c0 5.4-7.5 10-7.5 10z"/>',
  edit: '<path d="M15.5 5.5l3 3L9 18H6v-3z"/>',
  check: '<path d="m6 12.5 4 4 8-9"/>',
};

export const icon = (name, cls = '') =>
  `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
