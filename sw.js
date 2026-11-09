// Service worker for Deckfall. The build fills in VERSION and FILES (see vite.config.ts).
// Every file of the game is stored on install, so it opens and plays with no connection.
const VERSION = '73427a861108';
const FILES = ["./","./assets/ibm-plex-mono-latin-400-italic-BqAiT5Ww.woff2","./assets/ibm-plex-mono-latin-400-normal-DMJ8VG8y.woff2","./assets/ibm-plex-mono-latin-600-normal-BgSNZQsw.woff2","./assets/ibm-plex-sans-latin-400-normal-CDDApCn2.woff2","./assets/ibm-plex-sans-latin-600-normal-CuJfVYMP.woff2","./assets/index-BNuFR1XM.js","./assets/index-DEdISTkV.css","./audio/ambience-deep.mp3","./audio/ambience-saturn.mp3","./audio/ambience-wind.mp3","./audio/sting-metal-1.mp3","./audio/sting-metal-2.mp3","./audio/sting-metal-3.mp3","./audio/sting-metal-4.mp3","./audio/sting-metal-5.mp3","./audio/sting-signal-1.mp3","./audio/sting-signal-2.mp3","./audio/sting-signal-3.mp3","./fx/static.gif","./icons/alien-bug.svg","./icons/alien-stare.svg","./icons/armor-vest.svg","./icons/artificial-intelligence.svg","./icons/astronaut-helmet.svg","./icons/atom-core.svg","./icons/bandit.svg","./icons/battle-mech.svg","./icons/captain-hat-profile.svg","./icons/cargo-crate.svg","./icons/chest-armor.svg","./icons/circuitry.svg","./icons/claw-slashes.svg","./icons/crowned-skull.svg","./icons/cyber-eye.svg","./icons/cyborg-face.svg","./icons/dread-skull.svg","./icons/elevator.svg","./icons/energy-sword.svg","./icons/floating-tentacles.svg","./icons/hazmat-suit.svg","./icons/kevlar-vest.svg","./icons/laser-gun.svg","./icons/layered-armor.svg","./icons/leather-vest.svg","./icons/lightning-frequency.svg","./icons/lightning-saber.svg","./icons/medical-pack.svg","./icons/microchip.svg","./icons/mimic-chest.svg","./icons/mono-wheel-robot.svg","./icons/muscle-up.svg","./icons/nano-bot.svg","./icons/pirate-skull.svg","./icons/pistol-gun.svg","./icons/radar-dish.svg","./icons/rat.svg","./icons/ray-gun.svg","./icons/rifle.svg","./icons/robot-golem.svg","./icons/secret-door.svg","./icons/semi-closed-eye.svg","./icons/shambling-zombie.svg","./icons/shield-reflect.svg","./icons/silence.svg","./icons/slime.svg","./icons/space-suit.svg","./icons/spectre.svg","./icons/sprint.svg","./icons/static-waves.svg","./icons/syringe.svg","./icons/targeting.svg","./icons/telescopic-baton.svg","./icons/terror.svg","./icons/trade.svg","./manifest.webmanifest","./og.jpg","./pwa/apple-touch-icon.png","./pwa/icon-192.png","./pwa/icon-512.png","./pwa/maskable-512.png","./scenes/cargo.jpg","./scenes/corridor.jpg","./scenes/dark.jpg","./scenes/elite.jpg","./scenes/fight.jpg","./scenes/glow.jpg","./scenes/guardian.jpg","./scenes/helmet.jpg","./scenes/lift.jpg","./scenes/medbay.jpg","./scenes/title.jpg","./scenes/trader.jpg","./sprites/ancient_champion.png","./sprites/aspiring_flesh.png","./sprites/bloated_husk.png","./sprites/broodmother.png","./sprites/chonchon0.png","./sprites/clockwork_bee.png","./sprites/cognitogaunt.png","./sprites/crawling_flesh_cage0.png","./sprites/electric_golem.png","./sprites/emperor_scorpion.png","./sprites/iron_golem.png","./sprites/ironbound_mechanist.png","./sprites/lurking_horror.png","./sprites/nameless_horror.png","./sprites/phantom.png","./sprites/radroach.png","./sprites/revenant.png","./sprites/unseen_horror.png","./sprites/wretched_star.png","./textures/hull.jpg"];
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
