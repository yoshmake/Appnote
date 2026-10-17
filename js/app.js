import { db } from './db.js';
import { doodle, icon } from './doodles.js';
import { pushOverlay, popOverlay, overlayDepth, openSheet, closeSheet, confirmSheet, toast, burst } from './ui.js';

/* ---------- Constants ---------- */

const COLORS = ['pink', 'lilac', 'blue', 'yellow', 'mint', 'peach', 'cream'];
const COLOR_NAMES = { pink: 'Pink', lilac: 'Lilac', blue: 'Sky', yellow: 'Butter', mint: 'Mint', peach: 'Peach', cream: 'Cream' };
const PAPERS = { plain: 'Plain', lined: 'Lined', grid: 'Grid' };
const BUDDIES = { bunny: 'Bunny', cat: 'Kitty', none: 'None' };
const FOLDER_COLORS = ['#f7a3b0', '#93d8c8', '#b4a4f2', '#ffd27f', '#f59fd1', '#a5b5f5', '#f9b98f', '#9fd3f0'];
const DEFAULT_FOLDERS = [
  ['School / Uni', '#f7a3b0'],
  ['Work', '#93d8c8'],
  ['Personal', '#b4a4f2'],
  ['Ideas', '#ffd27f'],
  ['Gaming', '#f59fd1'],
  ['Other', '#a5b5f5'],
];

const PEP = [
  'You got this!',
  'Small steps still count ♡',
  'Good things take time',
  'One thing at a time',
  'Done is better than perfect',
  'Progress, not perfection',
  'Brain dump first, sort later',
  'Rest is productive too',
  'Be proud of the little wins',
  "You're doing better than you think",
  'Future you says thank you ♡',
  "It's okay to start messy",
];
const CHEERS = ['Yay! ✨', 'Nice one!', 'One down ♡', 'Look at you go!', 'Ticked! ✦', 'So proud of you', 'Woohoo!'];

const VIEWS = {
  home: { title: 'My Notes', sub: '' },
  notes: { title: 'All Notes', sub: '' },
  todo: { title: 'To Do', sub: 'one tick at a time' },
  reminders: { title: 'Reminders', sub: 'gentle nudges' },
  starred: { title: 'Starred', sub: 'your faves' },
  archive: { title: 'Archive', sub: 'resting, not gone' },
};

/* ---------- Helpers ---------- */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const BULLET_RE = /^(\s*)([-*•])\s+/;

const fmtDay = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
const fmtTime = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const fmtShort = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function fmtWhen(ts) {
  const day = startOfDay(new Date(ts));
  const today = startOfDay();
  const time = fmtTime.format(ts);
  if (day === today) return `Today ${time}`;
  if (day === today + 864e5) return `Tomorrow ${time}`;
  if (day === today - 864e5) return `Yesterday ${time}`;
  return `${fmtShort.format(ts)}, ${time}`;
}

const toLocalInput = (ts) => {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

function hydrateIcons(root = document) {
  for (const el of $$('[data-icon]', root)) {
    el.outerHTML = icon(el.dataset.icon);
  }
  for (const el of $$('[data-doodle]', root)) {
    el.innerHTML = doodle(el.dataset.doodle);
  }
}

/* ---------- State ---------- */

const state = {
  notes: [],
  folders: [],
  view: 'home',
  folderId: null,
  query: '',
  sort: 'updated',
  hideFinished: false,
  pepIndex: Math.floor(Date.now() / 864e5) % PEP.length,
};

const folderById = (id) => state.folders.find((f) => f.id === id);
const live = () => state.notes.filter((n) => !n.archived);
const isOverdue = (n) => n.reminderAt && !n.reminderDone && !n.archived && n.reminderAt <= Date.now();

function isEmpty(n) {
  return !n.title.trim() && !n.body.trim() && !n.items.some((i) => i.text.trim()) && !n.images.length;
}

function noteText(n) {
  const folder = folderById(n.folderId);
  return [n.title, n.body, ...n.items.map((i) => i.text), folder ? folder.name : ''].join(' ').toLowerCase();
}

function matches(n, q) {
  const text = noteText(n);
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => text.includes(w));
}

const byUpdated = (a, b) => b.updatedAt - a.updatedAt;
const pinnedFirst = (a, b) => (b.pinned - a.pinned) || byUpdated(a, b);

/* ---------- Persistence ---------- */

function normalise(n) {
  return {
    id: n.id || uid(),
    title: n.title || '',
    body: n.body || '',
    items: Array.isArray(n.items) ? n.items.map((i) => ({ id: i.id || uid(), text: i.text || '', done: !!i.done })) : [],
    images: Array.isArray(n.images) ? n.images : [],
    color: COLORS.includes(n.color) ? n.color : 'pink',
    paper: PAPERS[n.paper] ? n.paper : 'plain',
    doodle: BUDDIES[n.doodle] ? n.doodle : 'bunny',
    folderId: n.folderId || null,
    pinned: !!n.pinned,
    starred: !!n.starred,
    archived: !!n.archived,
    reminderAt: n.reminderAt || null,
    reminderDone: !!n.reminderDone,
    reminderNotified: !!n.reminderNotified,
    createdAt: n.createdAt || Date.now(),
    updatedAt: n.updatedAt || Date.now(),
  };
}

async function saveNote(n) {
  const i = state.notes.indexOf(n);
  if (isEmpty(n)) {
    if (i >= 0) {
      state.notes.splice(i, 1);
      await db.del('notes', n.id);
      scheduleRender();
    }
    return;
  }
  if (i < 0) state.notes.push(n);
  await db.put('notes', n);
  scheduleRender();
}

async function seed() {
  const folders = DEFAULT_FOLDERS.map(([name, color], order) => ({ id: uid(), name, color, order }));
  const now = Date.now();
  const notes = [
    normalise({
      title: 'Welcome to NoteBae ♡',
      body: '• Tap the big + to jot something down\n• Everything saves by itself — no save button\n• Tick boxes straight from the cards\n• Pin, star and colour notes from the editor\n• Back up now and then (menu → Backup)',
      color: 'lilac',
      paper: 'grid',
      doodle: 'bunny',
      pinned: true,
      createdAt: now - 2000,
      updatedAt: now - 2000,
    }),
    normalise({
      title: 'To Do Today',
      items: [
        { text: 'Try ticking me off', done: false },
        { text: 'Make a note with +', done: false },
        { text: 'Pick a colour for a note', done: false },
        { text: 'Be kind to yourself', done: true },
      ],
      color: 'pink',
      doodle: 'cat',
      folderId: folders[2].id,
      createdAt: now - 1000,
      updatedAt: now - 1000,
    }),
  ];
  await db.putMany('folders', folders);
  await db.putMany('notes', notes);
  await db.setMeta('seeded', true);
  return { folders, notes };
}

async function cleanOrphanImages() {
  const used = new Set(state.notes.flatMap((n) => n.images));
  const all = await db.all('images');
  for (const im of all) if (!used.has(im.id)) db.del('images', im.id);
}

/* ---------- Images ---------- */

const imageURLs = new Map();

async function imageURL(id) {
  if (imageURLs.has(id)) return imageURLs.get(id);
  const row = await db.get('images', id);
  if (!row) return '';
  const url = URL.createObjectURL(row.blob);
  imageURLs.set(id, url);
  return url;
}

function hydrateImages(root) {
  for (const img of $$('img[data-img]:not([src])', root)) {
    imageURL(img.dataset.img).then((url) => {
      if (url) img.src = url;
    });
  }
}

async function shrinkImage(file) {
  const MAX = 1600;
  let bmp;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file;
  }
  const scale = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
  if (scale === 1 && file.size < 1.2e6) return file;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b || file), 'image/jpeg', 0.86));
}

async function storeImage(file) {
  const blob = await shrinkImage(file);
  const id = uid();
  await db.put('images', { id, blob });
  return id;
}

/* ---------- Rendering: chrome ---------- */

let renderQueued = false;
function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderAll();
  });
}

function renderAll() {
  renderNav();
  renderFolders();
  renderHead();
  renderChips();
  renderContent();
}

function renderNav() {
  const active = state.view;
  for (const b of $$('[data-view]')) {
    b.classList.toggle('active', b.dataset.view === active);
    if (b.dataset.view === active) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  const overdue = state.notes.filter(isOverdue).length;
  for (const b of $$('[data-badge="reminders"]')) {
    b.hidden = !overdue;
    b.textContent = overdue;
  }
}

function folderCount(id) {
  return state.notes.filter((n) => n.folderId === id && !n.archived).length;
}

function renderFolders() {
  $('#folderList').innerHTML = state.folders
    .map(
      (f) => `<li><button class="folder-item ${state.view === 'folder' && state.folderId === f.id ? 'active' : ''}" data-folder="${f.id}">
        <span class="folder-ic" style="--fc:${f.color}">${icon('folder')}</span>
        <span class="folder-name">${esc(f.name)}</span>
        <span class="folder-count">${folderCount(f.id)}</span></button></li>`,
    )
    .join('');
}

function renderHead() {
  const title = $('#viewTitle');
  const sub = $('#viewSub');
  if (state.query) {
    title.textContent = 'Search';
    sub.textContent = `for “${state.query}”`;
  } else if (state.view === 'folder') {
    const f = folderById(state.folderId);
    title.innerHTML = `<span class="title-dot" style="background:${f.color}"></span>${esc(f.name)}`;
    sub.innerHTML = `<button class="link-btn" data-act="edit-folder">${icon('edit')} edit</button>`;
  } else {
    title.textContent = VIEWS[state.view].title;
    sub.textContent = state.view === 'home' ? fmtDay.format(new Date()) : VIEWS[state.view].sub;
  }
  $('#searchClear').hidden = !state.query;
}

function renderChips() {
  const show = !state.query && ['home', 'notes', 'folder', 'starred'].includes(state.view);
  const el = $('#chips');
  el.hidden = !show;
  if (!show) return;
  const allActive = state.view === 'notes' || state.view === 'home';
  el.innerHTML =
    `<button class="chip ${allActive ? 'active' : ''}" data-chip="notes" role="listitem">All <b>${live().length}</b></button>` +
    `<button class="chip ${state.view === 'starred' ? 'active' : ''}" data-chip="starred" role="listitem">${icon('star')} Starred</button>` +
    state.folders
      .map(
        (f) => `<button class="chip ${state.view === 'folder' && state.folderId === f.id ? 'active' : ''}" data-chip-folder="${f.id}" role="listitem">
          <i style="background:${f.color}"></i>${esc(f.name)} <b>${folderCount(f.id)}</b></button>`,
      )
      .join('');
}

/* ---------- Rendering: cards ---------- */

function bodyPreview(body, maxLines = 5) {
  // Skip blank lines and bullets with nothing after them.
  const lines = body.split('\n').filter((l) => l.trim() && !/^\s*[-*•]\s*$/.test(l));
  const shown = lines.slice(0, maxLines);
  let html = '';
  let inList = false;
  for (const line of shown) {
    const m = line.match(BULLET_RE);
    if (m) {
      if (!inList) html += '<ul>';
      inList = true;
      html += `<li>${esc(line.slice(m[0].length))}</li>`;
    } else {
      if (inList) html += '</ul>';
      inList = false;
      html += `<p>${esc(line)}</p>`;
    }
  }
  if (inList) html += '</ul>';
  return { html, more: lines.length > maxLines || body.length > 200 };
}

function cardHTML(n, { showRestore = false, showReminderDone = false } = {}) {
  const folder = folderById(n.folderId);
  const items = n.items.filter((i) => i.text.trim());
  const done = items.filter((i) => i.done).length;
  const body = bodyPreview(n.body, items.length ? 3 : 5);
  const img = n.images[0];
  const sideImage = img && !items.length && n.body.length < 90;
  const shownItems = items.slice(0, 6);
  const label = n.title || n.body.split('\n')[0] || (items[0] && items[0].text) || 'Image note';

  return `<article class="card ${sideImage ? 'side-img' : ''}" data-id="${n.id}" data-color="${n.color}" data-paper="${n.paper}" tabindex="0" aria-label="${esc(label)}">
    <span class="tape" aria-hidden="true"></span>
    <span class="card-flags">${n.pinned ? icon('pin', 'flag-pin') : ''}${n.starred ? icon('star', 'flag-star') : ''}</span>
    ${img ? `<div class="card-media"><img data-img="${img}" alt="" loading="lazy">${n.images.length > 1 ? `<span class="more-img">+${n.images.length - 1}</span>` : ''}</div>` : ''}
    <div class="card-text">
      ${n.title ? `<h3 class="card-title">${esc(n.title)}</h3>` : ''}
      ${body.html ? `<div class="card-body ${body.more ? 'faded' : ''}">${body.html}</div>` : ''}
      ${
        shownItems.length
          ? `<div class="card-items">${shownItems
              .map(
                (i) => `<label class="ci ${i.done ? 'done' : ''}"><input type="checkbox" data-tick="${i.id}" ${i.done ? 'checked' : ''}><span>${esc(i.text)}</span></label>`,
              )
              .join('')}${items.length > shownItems.length ? `<span class="ci-more">+${items.length - shownItems.length} more</span>` : ''}</div>`
          : ''
      }
    </div>
    ${items.length ? `<div class="progress" aria-label="${done} of ${items.length} done"><i style="width:${(done / items.length) * 100}%"></i></div>` : ''}
    <footer class="card-meta">
      ${folder ? `<span class="meta-folder"><i style="background:${folder.color}"></i>${esc(folder.name)}</span>` : ''}
      ${n.reminderAt ? `<span class="meta-rem ${isOverdue(n) ? 'due' : ''} ${n.reminderDone ? 'off' : ''}">${icon('bell')}${fmtWhen(n.reminderAt)}</span>` : ''}
      ${items.length ? `<span class="meta-prog">${done}/${items.length}</span>` : ''}
    </footer>
    ${showRestore ? `<button class="card-action" data-act="restore">${icon('upload')} Restore</button>` : ''}
    ${showReminderDone && n.reminderAt && !n.reminderDone ? `<button class="card-action" data-act="rem-done">${icon('check')} Done</button>` : ''}
    ${n.doodle !== 'none' ? `<span class="card-doodle" aria-hidden="true">${doodle(n.doodle)}</span>` : ''}
  </article>`;
}

/* Masonry: drop each card into whichever column is shortest, so reading order stays left-to-right. */
function columnCount(width) {
  if (width < 250) return 1;
  return Math.max(2, Math.min(4, Math.floor((width + 14) / 190)));
}

function fillGrid(grid) {
  const notes = grid._notes || [];
  const cols = columnCount(grid.clientWidth);
  grid._cols = cols;
  grid.innerHTML = '';
  const colEls = [];
  const heights = [];
  for (let i = 0; i < cols; i++) {
    const c = document.createElement('div');
    c.className = 'col';
    grid.append(c);
    colEls.push(c);
    heights.push(0);
  }
  const tpl = document.createElement('template');
  for (const n of notes) {
    tpl.innerHTML = cardHTML(n, grid._opts).trim();
    const card = tpl.content.firstElementChild;
    const i = heights.indexOf(Math.min(...heights));
    colEls[i].append(card);
    heights[i] += card.offsetHeight + 14;
  }
  hydrateImages(grid);
}

const resizer = new ResizeObserver(() => {
  for (const grid of $$('.grid')) {
    if (columnCount(grid.clientWidth) !== grid._cols) fillGrid(grid);
  }
});

function section(title, notes, opts = {}, extra = '') {
  if (!notes.length) return null;
  return { title, notes, opts, extra };
}

function emptyState(msg, sub = 'Tap + to start ♡', buddy = 'bunny') {
  return `<div class="empty"><span class="empty-buddy">${doodle(buddy)}</span><p>${msg}</p><small>${sub}</small></div>`;
}

function pepCard() {
  return `<button class="pep" data-act="pep" aria-label="Encouragement, tap for another">
    <span class="pep-buddy">${doodle('cat')}</span>
    <span class="pep-text"><small>today's reminder</small><b>${PEP[state.pepIndex]}</b></span>
    <span class="pep-star">${doodle('star')}</span></button>`;
}

function renderContent() {
  const content = $('#content');
  const sections = [];
  let top = '';
  let empty = '';
  const v = state.view;

  if (state.query) {
    const res = state.notes.filter((n) => matches(n, state.query)).sort(pinnedFirst);
    sections.push(section(`${res.length} found`, res));
    empty = emptyState('Nothing matches that', 'Try a different word ♡', 'cat');
  } else if (v === 'home') {
    top = pepCard();
    const notes = live();
    const soon = notes
      .filter((n) => n.reminderAt && !n.reminderDone && n.reminderAt < startOfDay() + 2 * 864e5)
      .sort((a, b) => a.reminderAt - b.reminderAt);
    if (soon.length) {
      top += `<div class="soon"><h2 class="sec-title">${icon('bell')} Coming up</h2><div class="soon-list">${soon
        .map(
          (n) => `<button class="soon-item ${isOverdue(n) ? 'due' : ''}" data-open="${n.id}"><b>${fmtWhen(n.reminderAt)}</b><span>${esc(n.title || n.body.split('\n')[0] || 'Reminder')}</span></button>`,
        )
        .join('')}</div></div>`;
    }
    // One grid, pinned first: fewer headings, no half-empty rows on a phone.
    sections.push(section(soon.length ? 'Notes' : '', notes.sort(pinnedFirst)));
    empty = emptyState('Your notebook is empty', 'Tap + to catch your first thought ♡');
  } else if (v === 'notes') {
    const sorters = {
      updated: byUpdated,
      created: (a, b) => b.createdAt - a.createdAt,
      az: (a, b) => (a.title || a.body).localeCompare(b.title || b.body),
    };
    top = `<div class="seg" role="group" aria-label="Sort">${[
      ['updated', 'Recently edited'],
      ['created', 'Newest'],
      ['az', 'A–Z'],
    ]
      .map(([k, l]) => `<button class="seg-btn ${state.sort === k ? 'active' : ''}" data-sort="${k}">${l}</button>`)
      .join('')}</div>`;
    sections.push(section('', live().sort(sorters[state.sort])));
    empty = emptyState('No notes yet');
  } else if (v === 'todo') {
    top = `<form class="quick-todo" id="quickTodo">
      <span class="qt-box" aria-hidden="true"></span>
      <input name="t" placeholder="Quick to-do… (press enter)" enterkeyhint="done" autocomplete="off" aria-label="Quick to-do">
      <button class="icon-btn" aria-label="Add">${icon('plus')}</button></form>
      <label class="toggle"><input type="checkbox" id="hideFinished" ${state.hideFinished ? 'checked' : ''}> Hide finished lists</label>`;
    const lists = live().filter((n) => n.items.some((i) => i.text.trim()));
    const finished = (n) => n.items.filter((i) => i.text.trim()).every((i) => i.done);
    sections.push(section('In progress', lists.filter((n) => !finished(n)).sort(pinnedFirst)));
    if (!state.hideFinished) sections.push(section('All done ✓', lists.filter(finished).sort(byUpdated)));
    empty = emptyState('No lists yet', 'Type a quick to-do above ♡', 'cat');
  } else if (v === 'reminders') {
    const withRem = live().filter((n) => n.reminderAt);
    const open = withRem.filter((n) => !n.reminderDone).sort((a, b) => a.reminderAt - b.reminderAt);
    const today = startOfDay();
    const opts = { showReminderDone: true };
    sections.push(section('Overdue', open.filter((n) => n.reminderAt <= Date.now()), opts));
    sections.push(section('Today', open.filter((n) => n.reminderAt > Date.now() && n.reminderAt < today + 864e5), opts));
    sections.push(section('Later', open.filter((n) => n.reminderAt >= today + 864e5), opts));
    sections.push(section('Done', withRem.filter((n) => n.reminderDone).sort((a, b) => b.reminderAt - a.reminderAt)));
    empty = emptyState('No reminders', 'Open a note and tap the bell ♡', 'cat');
  } else if (v === 'starred') {
    sections.push(section('', live().filter((n) => n.starred).sort(pinnedFirst)));
    empty = emptyState('No starred notes yet', 'Tap the ☆ in a note to keep it here');
  } else if (v === 'archive') {
    top = `<p class="hint">Archived notes rest here, out of the way. Tap restore to bring one back.</p>`;
    sections.push(section('', state.notes.filter((n) => n.archived).sort(byUpdated), { showRestore: true }));
    empty = emptyState('Archive is empty', 'Nothing resting here', 'cat');
  } else if (v === 'folder') {
    sections.push(section('', live().filter((n) => n.folderId === state.folderId).sort(pinnedFirst)));
    empty = emptyState('This folder is empty', 'Tap + to add a note here ♡');
  }

  const real = sections.filter(Boolean);
  content.innerHTML =
    top +
    (real.length
      ? real
          .map((s, i) => `${s.title ? `<h2 class="sec-title">${esc(s.title)}</h2>` : ''}<div class="grid" data-sec="${i}"></div>`)
          .join('')
      : empty);
  $$('.grid', content).forEach((grid, i) => {
    grid._notes = real[i].notes;
    grid._opts = real[i].opts;
    fillGrid(grid);
    resizer.observe(grid);
  });
}

/* ---------- Content interactions ---------- */

async function tickItem(noteId, itemId, checked, el) {
  const n = state.notes.find((x) => x.id === noteId);
  const item = n && n.items.find((i) => i.id === itemId);
  if (!item) return;
  item.done = checked;
  n.updatedAt = Date.now();
  el.closest('.ci, .ck-row')?.classList.toggle('done', checked);
  if (checked) celebrate(n, el);
  await db.put('notes', n);
  // Re-render a beat later so the strike-through is visible before anything moves.
  setTimeout(scheduleRender, 600);
}

function celebrate(n, el) {
  const r = el.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2);
  const items = n.items.filter((i) => i.text.trim());
  if (items.length && items.every((i) => i.done)) {
    toast(`All done! ${pick(['You did it ♡', "You're amazing ✨", 'Proud of you ♡'])}`);
  } else if (Math.random() < 0.35) {
    toast(pick(CHEERS), { timeout: 1600 });
  }
}

function bindContent() {
  const content = $('#content');

  content.addEventListener('change', (e) => {
    const box = e.target.closest('input[data-tick]');
    if (box) tickItem(box.closest('.card').dataset.id, box.dataset.tick, box.checked, box);
    if (e.target.id === 'hideFinished') {
      state.hideFinished = e.target.checked;
      renderContent();
    }
  });

  content.addEventListener('click', async (e) => {
    if (e.target.closest('.ci')) return; // ticking a box shouldn't open the note
    const act = e.target.closest('[data-act]');
    const card = e.target.closest('.card');
    if (act) {
      const n = card && state.notes.find((x) => x.id === card.dataset.id);
      if (act.dataset.act === 'pep') {
        state.pepIndex = (state.pepIndex + 1) % PEP.length;
        act.querySelector('b').textContent = PEP[state.pepIndex];
      } else if (act.dataset.act === 'restore' && n) {
        n.archived = false;
        await db.put('notes', n);
        toast('Restored ♡');
        renderAll();
      } else if (act.dataset.act === 'rem-done' && n) {
        n.reminderDone = true;
        await db.put('notes', n);
        burst(e.clientX, e.clientY);
        toast(pick(CHEERS));
        renderAll();
      }
      return;
    }
    const sort = e.target.closest('[data-sort]');
    if (sort) {
      state.sort = sort.dataset.sort;
      return renderContent();
    }
    const open = e.target.closest('[data-open]');
    if (open) return openEditor(open.dataset.open);
    if (card) openEditor(card.dataset.id);
  });

  content.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.classList.contains('card')) openEditor(e.target.dataset.id);
  });

  content.addEventListener('submit', async (e) => {
    if (e.target.id !== 'quickTodo') return;
    e.preventDefault();
    const input = e.target.elements.t;
    const text = input.value.trim();
    if (!text) return;
    await addQuickTodo(text);
    input.value = '';
    toast('Added ♡', { timeout: 1200 });
    renderAll();
    $('#quickTodo input')?.focus();
  });
}

async function addQuickTodo(text) {
  const inboxId = await db.getMeta('inboxId');
  let n = state.notes.find((x) => x.id === inboxId && !x.archived);
  if (!n) {
    n = normalise({ title: 'Quick to-dos', color: 'yellow', doodle: 'bunny' });
    await db.setMeta('inboxId', n.id);
    state.notes.push(n);
  }
  n.items.push({ id: uid(), text, done: false });
  n.updatedAt = Date.now();
  await db.put('notes', n);
}

/* ---------- Routing ---------- */

function parseHash() {
  const [v, id] = location.hash.replace(/^#\/?/, '').split('/');
  if (v === 'folder' && folderById(id)) return { view: 'folder', folderId: id };
  if (VIEWS[v]) return { view: v, folderId: null };
  return { view: 'home', folderId: null };
}

function go(view, folderId) {
  const hash = view === 'folder' ? `#/folder/${folderId}` : `#/${view}`;
  if (location.hash !== hash) location.hash = hash;
  else applyRoute();
}

function applyRoute() {
  Object.assign(state, parseHash());
  state.query = '';
  $('#search').value = '';
  renderAll();
  $('#main').scrollTo({ top: 0 });
  window.scrollTo({ top: 0 });
}

/* ---------- Drawer (mobile sidebar) ---------- */

const desktop = window.matchMedia('(min-width: 900px)');
let drawerOpen = false;

function openDrawer() {
  if (desktop.matches || drawerOpen) return;
  drawerOpen = true;
  $('#sidebar').classList.add('open');
  $('#scrim').hidden = false;
  pushOverlay(hideDrawer);
}

function hideDrawer() {
  drawerOpen = false;
  $('#sidebar').classList.remove('open');
  $('#scrim').hidden = true;
}

// Navigate from the sidebar, closing the drawer first on phones.
function navTo(view, folderId) {
  if (drawerOpen) popOverlay(() => go(view, folderId));
  else go(view, folderId);
}

/* ---------- Editor ---------- */

const ed = { note: null, timer: null };

function newNote(opts = {}) {
  const inFolder = state.view === 'folder' ? state.folderId : null;
  return normalise({
    title: opts.title || '',
    body: opts.body || '',
    items: opts.list ? [{ text: '' }] : [],
    color: opts.color || COLORS[state.notes.length % 5],
    doodle: pick(['bunny', 'cat']),
    folderId: inFolder,
    starred: state.view === 'starred',
  });
}

function openEditor(id, opts = {}) {
  if (ed.note) return;
  const n = id ? state.notes.find((x) => x.id === id) : newNote(opts);
  if (!n) return;
  ed.note = n;
  const el = $('#editor');
  el.hidden = false;
  renderEditor();
  requestAnimationFrame(() => el.classList.add('open'));
  pushOverlay(hideEditor);
  $('#edScroll').scrollTop = 0;
  // Focus straight away (inside the tap) so the phone keyboard pops up for quick capture.
  if (opts.focus === 'body') $('#edBody').focus();
  if (opts.focus === 'item') $('#edCheck .ck-text')?.focus();
}

function hideEditor() {
  const n = ed.note;
  if (!n) return;
  // Tidy blank checklist rows on the way out.
  n.items = n.items.filter((i) => i.text.trim());
  flush();
  ed.note = null;
  const el = $('#editor');
  el.classList.remove('open');
  document.activeElement?.blur();
  setTimeout(() => {
    if (!ed.note) el.hidden = true;
  }, 260);
}

function closeEditor(then) {
  if (ed.note) popOverlay(then, overlayDepth());
}

function setSaved(status) {
  const el = $('#edSaved');
  el.dataset.status = status;
  el.textContent = status === 'saved' ? 'Saved ♡' : status === 'saving' ? 'Saving…' : '';
}

function touch() {
  const n = ed.note;
  if (!n) return;
  n.updatedAt = Date.now();
  setSaved('saving');
  clearTimeout(ed.timer);
  ed.timer = setTimeout(flush, 350);
}

async function flush() {
  clearTimeout(ed.timer);
  ed.timer = null;
  const n = ed.note;
  if (!n) return;
  try {
    await saveNote(n);
    if (ed.note === n) setSaved('saved');
  } catch (err) {
    console.error(err);
    toast("Couldn't save — is storage full?");
  }
}

function autoGrow(ta) {
  ta.style.height = 'auto';
  ta.style.height = `${ta.scrollHeight + 2}px`;
}

function renderEditor() {
  const n = ed.note;
  const paper = $('#edPaper');
  paper.dataset.color = n.color;
  paper.dataset.paper = n.paper;
  $('#edTitle').value = n.title;
  const body = $('#edBody');
  body.value = n.body;
  body.classList.toggle('short', n.items.length > 0 || n.images.length > 0);
  requestAnimationFrame(() => autoGrow(body));
  $('#edPin').setAttribute('aria-pressed', n.pinned);
  $('#edStar').setAttribute('aria-pressed', n.starred);
  $('#edCheer').textContent = pick(PEP);
  $('#edDoodle').innerHTML = doodle(n.doodle);
  setSaved(state.notes.includes(n) ? 'saved' : '');
  renderEdFolder();
  renderEdReminder();
  renderChecklist();
  renderEdImages();
}

function renderEdFolder() {
  const f = folderById(ed.note.folderId);
  $('#edFolder').innerHTML = f
    ? `<i style="background:${f.color}"></i>${esc(f.name)}`
    : `${icon('folder')}<span>No folder</span>`;
}

function renderEdReminder() {
  const n = ed.note;
  $('#edReminder').innerHTML = n.reminderAt
    ? `<button class="rem-chip ${isOverdue(n) ? 'due' : ''} ${n.reminderDone ? 'off' : ''}" data-ed="remind">${icon('bell')}${fmtWhen(n.reminderAt)}${n.reminderDone ? ' · done' : ''}</button>`
    : '';
}

function renderChecklist(focusId, caret = 'end') {
  const n = ed.note;
  const box = $('#edCheck');
  if (!n.items.length) {
    box.innerHTML = '';
    return;
  }
  const done = n.items.filter((i) => i.done && i.text.trim()).length;
  const total = n.items.filter((i) => i.text.trim()).length;
  box.innerHTML =
    (total ? `<div class="ck-progress"><span>${done} of ${total} done</span><div class="progress"><i style="width:${(done / total) * 100}%"></i></div></div>` : '') +
    n.items
      .map(
        (it) => `<div class="ck-row ${it.done ? 'done' : ''}" data-id="${it.id}">
          <input type="checkbox" class="ck-box" ${it.done ? 'checked' : ''} aria-label="Done">
          <input class="ck-text" value="${esc(it.text)}" placeholder="To do…" enterkeyhint="next" autocomplete="off" aria-label="Checklist item">
          <button class="icon-btn sm ck-del" aria-label="Remove item">${icon('close')}</button></div>`,
      )
      .join('') +
    `<button class="ck-add" data-ck="add">${icon('plus')} Add item</button>`;
  if (focusId) {
    const input = $(`.ck-row[data-id="${focusId}"] .ck-text`, box);
    if (input) {
      input.focus();
      const pos = caret === 'end' ? input.value.length : 0;
      input.setSelectionRange(pos, pos);
    }
  }
}

function updateCkProgress() {
  const n = ed.note;
  const total = n.items.filter((i) => i.text.trim()).length;
  const done = n.items.filter((i) => i.done && i.text.trim()).length;
  const el = $('#edCheck .ck-progress');
  if (!el) return total && renderChecklistKeepFocus();
  el.querySelector('span').textContent = `${done} of ${total} done`;
  el.querySelector('i').style.width = `${total ? (done / total) * 100 : 0}%`;
}

function renderChecklistKeepFocus() {
  const active = document.activeElement;
  const row = active && active.closest('.ck-row');
  const pos = active && active.selectionStart;
  renderChecklist(row && row.dataset.id);
  if (row && pos != null) {
    const input = $(`.ck-row[data-id="${row.dataset.id}"] .ck-text`);
    input?.setSelectionRange(pos, pos);
  }
}

function addItem(afterId, focus = true) {
  const n = ed.note;
  const item = { id: uid(), text: '', done: false };
  const idx = afterId ? n.items.findIndex((i) => i.id === afterId) + 1 : n.items.length;
  n.items.splice(idx, 0, item);
  $('#edBody').classList.add('short');
  autoGrow($('#edBody'));
  renderChecklist(focus ? item.id : null);
  touch();
}

function renderEdImages() {
  const n = ed.note;
  $('#edImages').innerHTML = n.images
    .map(
      (id) => `<figure class="ed-img"><img data-img="${id}" alt="Attached image" data-view-img="${id}">
        <button class="icon-btn sm img-del" data-img-del="${id}" aria-label="Remove image">${icon('close')}</button></figure>`,
    )
    .join('');
  hydrateImages($('#edImages'));
}

function bulletToggle() {
  const ta = $('#edBody');
  const { value, selectionStart } = ta;
  const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
  const line = value.slice(lineStart);
  const m = line.match(BULLET_RE);
  let caret;
  if (m) {
    ta.value = value.slice(0, lineStart) + value.slice(lineStart + m[0].length);
    caret = Math.max(lineStart, selectionStart - m[0].length);
  } else {
    ta.value = `${value.slice(0, lineStart)}• ${value.slice(lineStart)}`;
    caret = selectionStart + 2;
  }
  ta.focus();
  ta.setSelectionRange(caret, caret);
  ed.note.body = ta.value;
  autoGrow(ta);
  touch();
}

function bindEditor() {
  const title = $('#edTitle');
  const body = $('#edBody');
  const check = $('#edCheck');

  title.addEventListener('input', () => {
    ed.note.title = title.value;
    touch();
  });
  title.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      body.focus();
    }
  });

  body.addEventListener('input', () => {
    ed.note.body = body.value;
    autoGrow(body);
    touch();
  });

  // Keep bullet lists going when you press enter; an empty bullet ends the list.
  body.addEventListener('beforeinput', (e) => {
    if (e.inputType !== 'insertLineBreak' && e.inputType !== 'insertParagraph') return;
    const { value, selectionStart, selectionEnd } = body;
    if (selectionStart !== selectionEnd) return;
    const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
    const line = value.slice(lineStart, selectionStart);
    const m = line.match(BULLET_RE);
    if (!m) return;
    e.preventDefault();
    if (line.trim() === m[2]) {
      body.setRangeText('', lineStart, selectionStart, 'end');
    } else {
      body.setRangeText(`\n${m[1]}${m[2]} `, selectionStart, selectionEnd, 'end');
    }
    body.dispatchEvent(new Event('input'));
  });

  check.addEventListener('input', (e) => {
    const row = e.target.closest('.ck-row');
    if (!row || !e.target.classList.contains('ck-text')) return;
    const item = ed.note.items.find((i) => i.id === row.dataset.id);
    item.text = e.target.value;
    updateCkProgress();
    touch();
  });

  check.addEventListener('change', (e) => {
    if (!e.target.classList.contains('ck-box')) return;
    const row = e.target.closest('.ck-row');
    const item = ed.note.items.find((i) => i.id === row.dataset.id);
    item.done = e.target.checked;
    row.classList.toggle('done', item.done);
    if (item.done && item.text.trim()) celebrate(ed.note, e.target);
    updateCkProgress();
    touch();
  });

  check.addEventListener('keydown', (e) => {
    if (!e.target.classList.contains('ck-text')) return;
    const row = e.target.closest('.ck-row');
    const items = ed.note.items;
    const idx = items.findIndex((i) => i.id === row.dataset.id);
    if (e.key === 'Enter') {
      e.preventDefault();
      // Enter on an empty last row finishes the list.
      if (!e.target.value.trim() && idx === items.length - 1 && items.length > 1) {
        items.splice(idx, 1);
        renderChecklist();
        touch();
        body.focus();
        return;
      }
      addItem(row.dataset.id);
    } else if (e.key === 'Backspace' && e.target.value === '') {
      e.preventDefault();
      items.splice(idx, 1);
      const prev = items[Math.max(0, idx - 1)];
      if (!items.length) $('#edBody').classList.toggle('short', ed.note.images.length > 0);
      renderChecklist(prev && prev.id);
      if (!items.length) body.focus();
      touch();
    }
  });

  check.addEventListener('click', (e) => {
    const del = e.target.closest('.ck-del');
    if (del) {
      const id = del.closest('.ck-row').dataset.id;
      ed.note.items = ed.note.items.filter((i) => i.id !== id);
      renderChecklist();
      touch();
    } else if (e.target.closest('[data-ck="add"]')) {
      addItem();
    }
  });

  $('#edImages').addEventListener('click', (e) => {
    const del = e.target.closest('[data-img-del]');
    if (del) {
      ed.note.images = ed.note.images.filter((id) => id !== del.dataset.imgDel);
      renderEdImages();
      touch();
      return;
    }
    const img = e.target.closest('[data-view-img]');
    if (img && img.src) openLightbox(img.src);
  });

  $('#editor').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-ed]');
    if (!btn || !ed.note) return;
    const n = ed.note;
    switch (btn.dataset.ed) {
      case 'close':
        return closeEditor();
      case 'pin':
        n.pinned = !n.pinned;
        btn.setAttribute('aria-pressed', n.pinned);
        toast(n.pinned ? 'Pinned to the top ♡' : 'Unpinned', { timeout: 1400 });
        return touch();
      case 'star':
        n.starred = !n.starred;
        btn.setAttribute('aria-pressed', n.starred);
        if (n.starred) burst(e.clientX, e.clientY);
        return touch();
      case 'bullet':
        return bulletToggle();
      case 'check':
        return addItem();
      case 'image':
        return $('#imagePick').click();
      case 'theme':
        return themeSheet();
      case 'remind':
        return reminderSheet();
      case 'folder':
        return folderPickSheet();
      case 'more':
        return moreSheet();
    }
  });

  $('#imagePick').addEventListener('change', async (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length || !ed.note) return;
    const n = ed.note;
    for (const f of files) {
      try {
        n.images.push(await storeImage(f));
      } catch (err) {
        console.error(err);
        toast("Couldn't add that image");
      }
    }
    $('#edBody').classList.add('short');
    renderEdImages();
    touch();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && ed.timer) flush();
  });
  window.addEventListener('pagehide', () => ed.timer && flush());
}

/* ---------- Editor sheets ---------- */

function themeSheet() {
  const n = ed.note;
  const pressed = (on) => `aria-pressed="${on}"`;
  openSheet({
    title: 'Make it yours',
    body: `
      <h4 class="sheet-label">Colour</h4>
      <div class="swatches">${COLORS.map((c) => `<button class="swatch" data-act="color" data-v="${c}" data-color="${c}" ${pressed(n.color === c)} aria-label="${COLOR_NAMES[c]}"></button>`).join('')}</div>
      <h4 class="sheet-label">Paper</h4>
      <div class="opts">${Object.entries(PAPERS).map(([k, l]) => `<button class="opt paper-opt" data-act="paper" data-v="${k}" data-paper="${k}" ${pressed(n.paper === k)}>${l}</button>`).join('')}</div>
      <h4 class="sheet-label">Buddy</h4>
      <div class="opts">${Object.entries(BUDDIES).map(([k, l]) => `<button class="opt buddy-opt" data-act="doodle" data-v="${k}" ${pressed(n.doodle === k)}>${k === 'none' ? '' : `<span>${doodle(k)}</span>`}${l}</button>`).join('')}</div>`,
    onAction(act, btn) {
      n[act === 'color' ? 'color' : act === 'paper' ? 'paper' : 'doodle'] = btn.dataset.v;
      for (const b of $$(`[data-act="${act}"]`, btn.parentElement)) b.setAttribute('aria-pressed', b === btn);
      $('#edPaper').dataset.color = n.color;
      $('#edPaper').dataset.paper = n.paper;
      $('#edDoodle').innerHTML = doodle(n.doodle);
      touch();
    },
  });
}

function reminderSheet() {
  const n = ed.note;
  const now = new Date();
  const at = (days, h, m = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(h, m, 0, 0);
    return d.getTime();
  };
  const tonight = now.getHours() < 18 ? at(0, 19) : null;
  const monday = (() => {
    const d = new Date();
    d.setDate(d.getDate() + (((8 - d.getDay()) % 7) || 7));
    d.setHours(9, 0, 0, 0);
    return d.getTime();
  })();
  const presets = [
    ['In 1 hour', Date.now() + 36e5],
    tonight && ['Tonight, 7pm', tonight],
    ['Tomorrow, 9am', at(1, 9)],
    ['Monday, 9am', monday],
  ].filter(Boolean);
  const initial = n.reminderAt && n.reminderAt > Date.now() ? n.reminderAt : Date.now() + 36e5;

  openSheet({
    title: 'Remind me',
    body: `
      <div class="presets">${presets.map(([l, t]) => `<button class="preset" data-act="set" data-t="${t}">${icon('clock')}<b>${l}</b><small>${fmtWhen(t)}</small></button>`).join('')}</div>
      <h4 class="sheet-label">Pick a time</h4>
      <div class="custom-time"><input type="datetime-local" id="remInput" value="${toLocalInput(initial)}" aria-label="Reminder time">
        <button class="btn primary" data-act="custom">Set</button></div>
      ${n.reminderAt ? `<button class="btn ghost full" data-act="clear">${icon('trash')} Remove reminder</button>` : ''}
      <p class="sheet-note">Reminders pop up while NoteBae is open or running in the background.</p>`,
    onAction(act, btn) {
      let t = null;
      if (act === 'set') t = Number(btn.dataset.t);
      if (act === 'custom') {
        const v = $('#remInput').value;
        if (!v) return;
        t = new Date(v).getTime();
      }
      if (act === 'clear') {
        n.reminderAt = null;
      } else {
        n.reminderAt = t;
        n.reminderDone = false;
        n.reminderNotified = false;
        askNotifyPermission();
      }
      touch();
      closeSheet(() => {
        renderEdReminder();
        if (t) toast(`I'll nudge you ${fmtWhen(t).replace(/^(\w)/, (c) => c.toLowerCase())} ♡`);
      });
    },
  });
}

function folderPickSheet() {
  const n = ed.note;
  openSheet({
    title: 'Move to folder',
    body: `<div class="folder-pick">
      <button class="fp-item" data-act="pick" data-v="" aria-pressed="${!n.folderId}"><i class="none"></i>No folder</button>
      ${state.folders.map((f) => `<button class="fp-item" data-act="pick" data-v="${f.id}" aria-pressed="${n.folderId === f.id}"><i style="background:${f.color}"></i>${esc(f.name)}</button>`).join('')}
      </div>`,
    onAction(act, btn) {
      n.folderId = btn.dataset.v || null;
      touch();
      closeSheet(renderEdFolder);
    },
  });
}

function moreSheet() {
  const n = ed.note;
  openSheet({
    title: 'Note options',
    body: `<div class="menu-list">
      ${navigator.share ? `<button class="menu-item" data-act="share">${icon('share')} Share</button>` : ''}
      <button class="menu-item" data-act="archive">${icon('archive')} ${n.archived ? 'Unarchive' : 'Archive'}</button>
      <button class="menu-item danger" data-act="delete">${icon('trash')} Delete</button></div>`,
    async onAction(act) {
      if (act === 'share') {
        const lines = [n.title, n.body, ...n.items.filter((i) => i.text.trim()).map((i) => `${i.done ? '☑' : '☐'} ${i.text}`)];
        closeSheet();
        try {
          await navigator.share({ title: n.title || 'Note', text: lines.filter(Boolean).join('\n') });
        } catch {
          /* user cancelled */
        }
      } else if (act === 'archive') {
        closeEditor(() => archiveNote(n, !n.archived));
      } else if (act === 'delete') {
        closeEditor(() => deleteNote(n));
      }
    },
  });
}

async function archiveNote(n, archived) {
  if (!state.notes.includes(n)) return;
  n.archived = archived;
  await db.put('notes', n);
  renderAll();
  toast(archived ? 'Archived — resting safely' : 'Back in your notes ♡', {
    action: 'Undo',
    onAction: async () => {
      n.archived = !archived;
      await db.put('notes', n);
      renderAll();
    },
  });
}

async function deleteNote(n) {
  const i = state.notes.indexOf(n);
  if (i < 0) return;
  state.notes.splice(i, 1);
  await db.del('notes', n.id);
  renderAll();
  let undone = false;
  toast('Note deleted', {
    action: 'Undo',
    onAction: async () => {
      undone = true;
      state.notes.push(n);
      await db.put('notes', n);
      renderAll();
    },
  });
  setTimeout(() => {
    if (undone) return;
    for (const id of n.images) {
      db.del('images', id);
      if (imageURLs.has(id)) URL.revokeObjectURL(imageURLs.get(id));
      imageURLs.delete(id);
    }
  }, 8000);
}

/* ---------- Lightbox ---------- */

function openLightbox(src) {
  const lb = $('#lightbox');
  lb.innerHTML = `<img src="${src}" alt=""><button class="icon-btn lb-close" aria-label="Close">${icon('close')}</button>`;
  lb.hidden = false;
  lb.onclick = () => popOverlay();
  pushOverlay(() => {
    lb.hidden = true;
    lb.innerHTML = '';
  });
}

/* ---------- Folders ---------- */

function folderSheet(folder) {
  const editing = !!folder;
  let color = editing ? folder.color : FOLDER_COLORS[state.folders.length % FOLDER_COLORS.length];
  openSheet({
    title: editing ? 'Edit folder' : 'New folder',
    body: `
      <input class="field" id="folderName" placeholder="Folder name" value="${editing ? esc(folder.name) : ''}" maxlength="40" autocomplete="off" enterkeyhint="done">
      <h4 class="sheet-label">Colour</h4>
      <div class="swatches">${FOLDER_COLORS.map((c) => `<button class="swatch" data-act="color" data-v="${c}" style="--sw:${c}" aria-pressed="${c === color}" aria-label="Colour ${c}"></button>`).join('')}</div>
      <div class="sheet-actions">
        ${editing ? `<button class="btn danger-ghost" data-act="delete">${icon('trash')} Delete</button>` : ''}
        <button class="btn primary" data-act="save">Save</button></div>`,
    onOpen(panel) {
      const input = $('#folderName', panel);
      input.focus();
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') panel.querySelector('[data-act="save"]').click();
      });
    },
    async onAction(act, btn) {
      if (act === 'color') {
        color = btn.dataset.v;
        for (const b of $$('[data-act="color"]', btn.parentElement)) b.setAttribute('aria-pressed', b === btn);
      } else if (act === 'save') {
        const name = $('#folderName').value.trim();
        if (!name) return $('#folderName').focus();
        const f = folder || { id: uid(), order: Math.max(-1, ...state.folders.map((x) => x.order)) + 1 };
        Object.assign(f, { name, color });
        if (!editing) state.folders.push(f);
        await db.put('folders', f);
        closeSheet(() => (editing ? renderAll() : navTo('folder', f.id)));
      } else if (act === 'delete') {
        closeSheet(async () => {
          const count = state.notes.filter((n) => n.folderId === folder.id).length;
          const ok = await confirmSheet(
            'Delete folder?',
            count ? `The ${count} note${count > 1 ? 's' : ''} inside will stay safe — just without a folder.` : 'This folder is empty.',
            'Delete folder',
            true,
          );
          if (!ok) return;
          const moved = state.notes.filter((n) => n.folderId === folder.id);
          for (const n of moved) n.folderId = null;
          await db.putMany('notes', moved);
          state.folders = state.folders.filter((x) => x !== folder);
          await db.del('folders', folder.id);
          go('home');
          toast('Folder deleted');
        });
      }
    },
  });
}

/* ---------- Backup ---------- */

const blobToDataURL = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

async function exportBackup() {
  const images = await db.all('images');
  const used = new Set(state.notes.flatMap((n) => n.images));
  const payload = {
    app: 'NoteBae',
    version: 1,
    exportedAt: new Date().toISOString(),
    folders: state.folders,
    notes: state.notes,
    images: await Promise.all(images.filter((im) => used.has(im.id)).map(async (im) => ({ id: im.id, data: await blobToDataURL(im.blob) }))),
  };
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `notebae-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  await db.setMeta('lastBackup', Date.now());
  toast('Backup saved ♡');
}

async function importBackup(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    return toast("That file isn't a NoteBae backup");
  }
  if (!data || data.app !== 'NoteBae' || !Array.isArray(data.notes)) return toast("That file isn't a NoteBae backup");
  const images = await Promise.all(
    (data.images || []).map(async (im) => ({ id: im.id, blob: await (await fetch(im.data)).blob() })),
  );
  const notes = data.notes.map(normalise);
  const folders = (data.folders || []).filter((f) => f && f.id && f.name);
  await db.putMany('images', images);
  await db.putMany('folders', folders);
  await db.putMany('notes', notes);
  const merge = (list, incoming) => {
    const map = new Map(list.map((x) => [x.id, x]));
    for (const x of incoming) map.set(x.id, x);
    return [...map.values()];
  };
  state.folders = merge(state.folders, folders).sort((a, b) => a.order - b.order);
  state.notes = merge(state.notes, notes);
  renderAll();
  toast(`Restored ${notes.length} note${notes.length === 1 ? '' : 's'} ♡`);
}

async function backupSheet() {
  const last = await db.getMeta('lastBackup');
  openSheet({
    title: 'Backup & restore',
    body: `<p class="sheet-text">Your notes live privately on this phone. Saving a backup file now and then keeps them safe if you switch phones or clear your browser.</p>
      <p class="sheet-note">${last ? `Last backup: ${fmtWhen(last)}` : 'No backup yet'}</p>
      <div class="menu-list">
        <button class="menu-item" data-act="export">${icon('download')} Save a backup file</button>
        <button class="menu-item" data-act="import">${icon('upload')} Restore from a backup file</button></div>`,
    onAction(act) {
      closeSheet(() => (act === 'export' ? exportBackup() : $('#importPick').click()));
    },
  });
}

/* ---------- Reminders ---------- */

let swReg = null;

function askNotifyPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

async function checkReminders() {
  const due = state.notes.filter((n) => isOverdue(n) && !n.reminderNotified);
  for (const n of due) {
    n.reminderNotified = true;
    await db.put('notes', n);
    const title = n.title || n.body.split('\n')[0] || 'Reminder';
    if ('Notification' in window && Notification.permission === 'granted' && swReg) {
      swReg.showNotification(`⏰ ${title}`, {
        body: pick(PEP),
        tag: n.id,
        data: { id: n.id },
        icon: 'icons/icon-192.png',
        badge: 'icons/badge-96.png',
      });
    }
    toast(`⏰ ${esc(title)}`, { action: 'Open', onAction: () => openEditor(n.id), timeout: 8000 });
  }
  if (due.length) renderNav();
}

/* ---------- Launch: shortcuts, share target, notifications ---------- */

async function handleLaunch() {
  const p = new URLSearchParams(location.search);
  if (![...p.keys()].length) return;
  history.replaceState(null, '', location.pathname + location.hash);
  if (p.get('note')) return openEditor(p.get('note'));
  const shared = [p.get('text'), p.get('url')].filter(Boolean).join('\n');
  if (p.get('title') || shared) {
    const n = newNote({ title: p.get('title') || '', body: shared });
    await saveNote(n);
    toast('Saved from share ♡');
    return openEditor(n.id);
  }
  if (p.get('new') === 'list') openEditor(null, { list: true, focus: 'item' });
  else if (p.get('new')) openEditor(null, { focus: 'body' });
}

/* ---------- Wiring ---------- */

function bindChrome() {
  $('#menuBtn').addEventListener('click', openDrawer);
  $('#scrim').addEventListener('click', () => popOverlay());

  $('#app').addEventListener('click', (e) => {
    const nav = e.target.closest('[data-view]');
    if (nav) return navTo(nav.dataset.view);
    const f = e.target.closest('[data-folder]');
    if (f) return navTo('folder', f.dataset.folder);
    const chip = e.target.closest('[data-chip], [data-chip-folder]');
    if (chip) {
      chip.dataset.chipFolder ? go('folder', chip.dataset.chipFolder) : go(chip.dataset.chip);
      return;
    }
    if (e.target.closest('[data-act="edit-folder"]')) folderSheet(folderById(state.folderId));
  });

  $('#addFolder').addEventListener('click', () => (drawerOpen ? popOverlay(() => folderSheet()) : folderSheet()));
  $('#backupBtn').addEventListener('click', () => (drawerOpen ? popOverlay(backupSheet) : backupSheet()));
  $('#importPick').addEventListener('change', (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) importBackup(file);
  });

  $('#fab').addEventListener('click', () => {
    const list = state.view === 'todo';
    openEditor(null, { list, focus: list ? 'item' : 'body' });
  });

  const search = $('#search');
  let t;
  search.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      state.query = search.value.trim();
      renderHead();
      renderChips();
      renderContent();
    }, 120);
  });
  $('#searchClear').addEventListener('click', () => {
    search.value = '';
    state.query = '';
    renderAll();
    search.focus();
  });

  window.addEventListener('hashchange', applyRoute);
  desktop.addEventListener('change', () => drawerOpen && popOverlay());

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkReminders();
      scheduleRender();
    }
  });
}

async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    swReg = await navigator.serviceWorker.register('sw.js');
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'open-note') {
        if (ed.note) closeEditor(() => openEditor(e.data.id));
        else openEditor(e.data.id);
      }
    });
  } catch (err) {
    console.warn('Service worker not registered', err);
  }
}

async function init() {
  hydrateIcons();
  try {
    navigator.storage && navigator.storage.persist && navigator.storage.persist();
  } catch {
    /* not supported */
  }
  let [notes, folders] = await Promise.all([db.all('notes'), db.all('folders')]);
  if (!(await db.getMeta('seeded'))) ({ notes, folders } = await seed());
  state.notes = notes.map(normalise);
  state.folders = folders.sort((a, b) => a.order - b.order);
  Object.assign(state, parseHash());

  bindChrome();
  bindContent();
  bindEditor();
  renderAll();
  document.body.classList.add('ready');

  await handleLaunch();
  registerSW();
  checkReminders();
  setInterval(checkReminders, 15000);
  setTimeout(cleanOrphanImages, 4000);
}

init();
