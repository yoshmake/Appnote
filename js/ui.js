// Overlays (editor, drawer, sheets, lightbox) that close with Android's back button,
// plus bottom sheets and toasts.
import { icon } from './doodles.js';

const stack = [];
let afterPop = [];

// Register an open overlay. Each overlay gets its own history entry so the
// hardware/gesture back button closes it instead of leaving the app.
export function pushOverlay(close) {
  stack.push(close);
  history.pushState({ ov: stack.length }, '');
}

// Close the top overlay (or several). `then` runs once the history has settled.
export function popOverlay(then, count = 1) {
  if (then) afterPop.push(then);
  const n = Math.min(count, stack.length);
  if (n > 0) history.go(-n);
  else flushAfterPop();
}

export const overlayDepth = () => stack.length;

function flushAfterPop() {
  const fns = afterPop;
  afterPop = [];
  for (const fn of fns) fn();
}

window.addEventListener('popstate', (e) => {
  const depth = (e.state && e.state.ov) || 0;
  while (stack.length > depth) stack.pop()();
  flushAfterPop();
});

// A stale overlay entry survives a reload; drop it so back behaves.
if (history.state && history.state.ov) history.replaceState(null, '');

/* ---------- Bottom sheet ---------- */

const sheetEl = () => document.getElementById('sheet');
let sheetOpen = false;

export function openSheet({ title, body, onAction, onOpen, wide = false }) {
  const root = sheetEl();
  root.innerHTML = `
    <div class="sheet-backdrop" data-sheet-close></div>
    <div class="sheet-panel ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="sheet-grip" aria-hidden="true"></div>
      <header class="sheet-head"><h3>${title}</h3>
        <button class="icon-btn" data-sheet-close aria-label="Close">${icon('close')}</button></header>
      <div class="sheet-body">${body}</div>
    </div>`;
  root.hidden = false;
  requestAnimationFrame(() => root.classList.add('open'));
  sheetOpen = true;

  root.onclick = (e) => {
    if (e.target.closest('[data-sheet-close]')) return closeSheet();
    const btn = e.target.closest('[data-act]');
    if (btn && onAction) onAction(btn.dataset.act, btn, e);
  };
  root.onkeydown = (e) => {
    if (e.key === 'Escape') closeSheet();
  };
  pushOverlay(hideSheet);
  if (onOpen) onOpen(root.querySelector('.sheet-panel'));
  return root.querySelector('.sheet-panel');
}

function hideSheet() {
  const root = sheetEl();
  sheetOpen = false;
  root.classList.remove('open');
  setTimeout(() => {
    if (!sheetOpen) {
      root.hidden = true;
      root.innerHTML = '';
    }
  }, 220);
}

export function closeSheet(then) {
  if (sheetOpen) popOverlay(then);
  else if (then) then();
}

export function confirmSheet(title, text, okLabel = 'Yes', danger = false) {
  return new Promise((resolve) => {
    let answered = false;
    openSheet({
      title,
      body: `<p class="sheet-text">${text}</p>
        <div class="sheet-actions">
          <button class="btn ghost" data-act="no">Never mind</button>
          <button class="btn ${danger ? 'danger' : 'primary'}" data-act="yes">${okLabel}</button>
        </div>`,
      onAction(act) {
        answered = true;
        closeSheet(() => resolve(act === 'yes'));
      },
    });
    // Back button / backdrop counts as "no".
    const top = stack[stack.length - 1];
    stack[stack.length - 1] = () => {
      top();
      if (!answered) resolve(false);
    };
  });
}

/* ---------- Toasts ---------- */

export function toast(message, { action, onAction, timeout = 3200 } = {}) {
  const host = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.innerHTML = `<span>${message}</span>${action ? `<button class="toast-btn">${action}</button>` : ''}`;
  host.append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  const remove = () => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 250);
  };
  const timer = setTimeout(remove, action ? Math.max(timeout, 5000) : timeout);
  if (action) {
    el.querySelector('.toast-btn').onclick = () => {
      clearTimeout(timer);
      remove();
      onAction && onAction();
    };
  }
  // Keep at most three on screen so it never gets noisy.
  while (host.children.length > 3) host.firstElementChild.remove();
}

/* ---------- Little heart burst for ticking things off ---------- */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

export function burst(x, y) {
  if (reduceMotion.matches) return;
  const glyphs = ['♡', '✦', '♡', '✧', '♡'];
  for (let i = 0; i < 6; i++) {
    const s = document.createElement('span');
    s.className = 'burst';
    s.textContent = glyphs[i % glyphs.length];
    const angle = (Math.PI * 2 * i) / 6 + Math.random() * 0.5;
    s.style.left = `${x}px`;
    s.style.top = `${y}px`;
    s.style.setProperty('--dx', `${Math.cos(angle) * 34}px`);
    s.style.setProperty('--dy', `${Math.sin(angle) * 34 - 10}px`);
    document.body.append(s);
    setTimeout(() => s.remove(), 750);
  }
}
