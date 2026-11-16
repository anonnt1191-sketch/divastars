// sw.js — service worker for offline PWA. Caches all static assets.
const CACHE_NAME = "divas-den-v2";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./lib/pixi.min.js",
  "./js/main.js",
  "./js/core/app.js",
  "./js/core/store.js",
  "./js/core/sfx.js",
  "./js/core/fx.js",
  "./js/core/voice.js",
  "./js/core/session.js",
  "./js/core/photos.js",
  "./js/core/i18n.js",
  "./js/core/ticker.js",
  "./js/core/animations.js",
  "./js/data/divas.js",
  "./js/data/world-cast-names.js",
  "./js/data/games-registry.js",
  "./js/data/diva-bios.js",
  "./js/data/game-rules.js",
  "./js/screens/ageGate.js",
  "./js/screens/onboarding.js",
  "./js/screens/lobby.js",
  "./js/screens/memoryBook.js",
  "./js/screens/guide.js",
  "./js/screens/gameHost.js",
  "./js/games/cash-me.js",
  "./js/games/plinko.js",
  "./js/games/mines.js",
  "./js/games/wheel.js",
  "./js/games/archery.js",
  "./js/games/floor-slots.js",
  "./js/games/reel-rush.js",
  "./js/games/diva-jet.js",
  "./js/games/jetx.js",
  "./js/games/spaceman.js",
  "./js/games/roulette.js",
  "./js/games/blackjack.js",
  "./js/games/teen-patti.js",
  "./js/games/call-break.js",
  "./js/games/andar-bahar.js",
  "./js/games/dragon-tiger.js",
  "./js/games/baccarat.js",
  "./js/games/sic-bo.js",
  "./js/games/casino-holdem.js",
  "./js/games/poker-draw.js",
  "./js/games/war.js",
  "./js/games/three-card.js",
  "./js/games/video-poker.js",
  "./js/games/hilo.js",
  "./js/games/dice.js",
  "./js/games/limbo.js",
  "./js/games/keno.js",
  "./js/games/scratch.js",
  "./js/games/bingo.js",
  "./js/games/crazy-time.js",
  "./js/games/coin-flip.js",
  "./js/games/cash-hunt.js",
  "./js/games/pachinko.js",
  "./js/games/megaways.js",
  "./js/games/cluster.js",
  "./js/games/hold-spin.js",
  "./js/games/drops-wins.js",
  "./js/games/ex-revenge.js",
  "./js/games/pinball.js",
  "./js/games/whack.js",
  "./js/games/shoot.js",
  "./js/games/fishing.js",
  "./js/games/memory.js",
  "./js/games/quiz.js",
  "./js/games/karaoke.js",
  "./js/games/scooty-race.js",
  "./js/games/group-selfie.js",
  "./js/games/momos.js",
  "./js/games/group-chat.js",
  "./js/games/vibe-check.js",
  "./js/games/aunty-net.js",
  "./js/games/tika.js",
  "./js/games/late-night.js",
  "./js/games/photo-drop.js",
  "./js/games/reunion.js",
  "./js/core/reunion.js",
  "./locales/en.json",
  "./locales/ne-NP.json",
  "./locales/hi-IN.json"
];

// PHASE 1: also cache thumbnail directories on install (lazy-cache on first fetch via fetch handler)
// Thumbnails are small (~15KB each) so caching them on demand works fine.

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE).catch(e => console.warn("cache add fail", e)))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  // network-first for HTML/JS, cache-first for images
  if (req.destination === "document" || req.destination === "script" || req.destination === "style") {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(()=>{});
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
    );
  } else {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(()=>{});
        return res;
      }).catch(() => cached))
    );
  }
});
