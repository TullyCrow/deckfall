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

// Lookups are limited to this version's own cache, which holds only the static files listed above.
// ignoreVary is safe for that reason, and needed because some servers add a Vary header to every response.
const stored = (key) => caches.open(CACHE).then((cache) => cache.match(key, { ignoreVary: true }));

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  // The page itself: try the network first so a new version arrives promptly, fall back to the stored copy offline.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => stored('./')));
    return;
  }

  // Everything else is either fingerprinted or rebuilt with a new VERSION, so the stored copy is always right.
  event.respondWith(stored(request).then((hit) => hit ?? fetch(request)));
});
