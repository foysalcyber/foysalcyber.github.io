const CACHE_VERSION = 'meal-ledger-shell-v7';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js?v=1.4.1',
  './core.js?v=1.4.1',
  './pwa-install.js?v=1.4.1',
  './manifest.webmanifest',
  './assets/icons/favicon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/fonts/syne-400.ttf',
  './assets/fonts/syne-500.ttf',
  './assets/fonts/syne-600.ttf',
  './assets/fonts/syne-700.ttf',
  './assets/fonts/syne-800.ttf',
  './assets/fonts/dm-mono-400.ttf',
  './assets/fonts/dm-mono-500.ttf',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => Promise.allSettled(
        APP_SHELL.map((asset) => cache.add(new Request(asset, { cache: 'reload' }))),
      ))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith('meal-ledger-shell-') && key !== CACHE_VERSION)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

// Network-first, cache fallback. Code, styles and pages must always reflect the
// latest deployment so installed apps never serve stale builds; offline opens
// still fall back to the cached shell.
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cacheKey = request.mode === 'navigate' ? './index.html' : request;
      const copy = response.clone();
      caches.open(CACHE_VERSION).then((cache) => cache.put(cacheKey, copy));
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request)
      || await caches.match('./index.html')
      || await caches.match('./');
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Page navigations always try the network first.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Application code, styles and the install helper must never go stale.
  const file = url.pathname.split('/').pop();
  if (/^(app|core|pwa-install)\.js$/.test(file) || file.endsWith('.css')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets (fonts, icons, images) are safe to serve cache-first.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
