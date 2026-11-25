const CACHE_NAME = 'mudra-static-shell-v1';
const STATIC_ASSETS = ['/mudrapublications_logo.jpeg', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Never cache protected /api/* or /library/* HTML/PDF responses (Requirement 4: Keep PDF files and protected pages private)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  }
});
