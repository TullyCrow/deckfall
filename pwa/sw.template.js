// Service worker for Deckfall. The build fills in VERSION and FILES (see vite.config.ts).
// Every file of the game is stored on install, so it opens and plays with no connection.
const VERSION = '__VERSION__';
const FILES = __FILES__;
const CACHE = `deckfall-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('deckfall-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  // The page itself: try the network first so a new version arrives promptly, fall back to the stored copy offline.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('./', { ignoreVary: true })));
    return;
  }

  // Everything else is either fingerprinted or rebuilt with a new VERSION, so the stored copy is always right.
  // ignoreVary: some servers add a Vary header that would otherwise make the stored copy miss.
  event.respondWith(caches.match(request, { ignoreSearch: true, ignoreVary: true }).then((hit) => hit ?? fetch(request)));
});
