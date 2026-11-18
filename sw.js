/* Service worker: aplikacija radi i bez interneta.
   Kad mijenjaš datoteke aplikacije, povećaj VERSION da se nova verzija preuzme. */
const VERSION = 'v8';
const CACHE = 'moj-napredak-' + VERSION;
const FILES = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './js/config.js',
  './js/store.js',
  './js/sync.js',
  './js/charts.js',
  './js/foods.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('moj-napredak-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Mreža prva (da uvijek dobiješ najnoviju verziju), a bez interneta iz predmemorije.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req, { cache: 'no-cache' }) // uvijek provjeri ima li nove verzije (GitHub Pages inače drži staro 10 min)
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});
