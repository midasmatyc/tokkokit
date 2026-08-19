/* TokkoKit PWA Service Worker (sw.js) */
const CACHE_NAME = 'tokkokit-v1.5';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/logo.png',
  './css/styles.css',
  './css/print.css',
  './data/shippingRates.json',
  './vendor/html2canvas.min.js',
  './js/app.js',
  './js/storage.js',
  './js/license.js',
  './js/modules/invoice.js',
  './js/modules/templates.js',
  './js/modules/orders.js',
  './js/modules/shipping.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching app shell & static rate data');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Cache-first strategy for local assets
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        // Fallback for offline navigation
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
