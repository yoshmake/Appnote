// Offline support: cache the app shell, serve it cache-first, refresh in the background.
const VERSION = 'notebae-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/db.js',
  './js/doodles.js',
  './js/ui.js',
  './fonts/fredoka-latin.woff2',
  './fonts/fredoka-latin-ext.woff2',
  './fonts/patrickhand-latin.woff2',
  './fonts/patrickhand-latin-ext.woff2',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/badge-96.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // Launch URLs like ?new=note or share-target ?text=… all load the same page.
  const key = req.mode === 'navigate' ? './index.html' : req;
  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(key, { ignoreSearch: req.mode === 'navigate' });
      const network = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(key, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const id = event.notification.data && event.notification.data.id;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const win = wins[0];
      if (win) {
        win.postMessage({ type: 'open-note', id });
        return win.focus();
      }
      return self.clients.openWindow(`./?note=${encodeURIComponent(id || '')}`);
    }),
  );
});
