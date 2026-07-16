const CACHE_VERSION = "remnant-13-moons-v20260716-04";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const ROOT = self.registration.scope;

const PRECACHE_PATHS = [
  "./moons.html",
  "./moons/index.html",
  "./offline.html",
  "./manifest.webmanifest",
  "./assets/css/codex.css",
  "./assets/css/navigation.css",
  "./assets/css/moons.css?v=20260716-04",
  "./assets/css/astrology.css?v=20260715-11",
  "./assets/css/animations.css",
  "./assets/js/site.js",
  "./assets/js/calendar-cor.js",
  "./assets/js/living-codex.js",
  "./assets/js/codex-witness.js",
  "./assets/js/motion.js",
  "./assets/js/moons.js?v=20260716-05",
  "./assets/js/astrology.js?v=20260715-11",
  "./assets/js/moons-images.js?v=20260716-05",
  "./assets/js/moons-app.js?v=20260716-05",
  "./assets/js/pwa-install.js?v=20260716-05",
  "./assets/img/moons/app/icon-192.png",
  "./assets/img/moons/app/icon-512.png",
  "./assets/img/moons/app/icon-maskable-512.png",
  "./assets/img/moons/app/apple-touch-icon.png",
  "./assets/img/moons/app/icon-512.webp",
  "./assets/img/moons/app/og-image-1200x630.webp",
  "./assets/img/moons/app/app-bg-dark.webp",
  "./assets/img/moons/app/splash-2732.webp",
  "./assets/img/moons/app/empty-state.webp",
  "./assets/img/home/gates/home-gate-13-moons.webp",
  "./assets/img/moons/sections/today.webp",
  "./assets/img/moons/sections/transmission.webp",
  "./assets/img/moons/sections/memory.webp",
  "./assets/img/moons/sections/witness.webp",
  "./assets/img/moons/sections/astrology.webp",
  "./assets/img/moons/sections/calendars.webp",
  "./assets/img/moons/sections/builder.webp",
  "./assets/img/moons/sections/frequency.webp",
  "./assets/img/moons/gates/gate-01-preparation.webp",
  "./assets/img/moons/gates/gate-06-alignment.webp",
  "./assets/img/moons/gates/gate-08-return.webp",
  "./assets/img/moons/moons/moon-01-seed-flame.webp",
  "./assets/img/moons/moons/moon-02-root-waters.webp",
  "./assets/img/moons/moons/moon-03-breath-gate.webp",
  "./assets/img/moons/moons/moon-04-stone-witness.webp",
  "./assets/img/moons/moons/moon-05-living-word.webp",
  "./assets/img/moons/moons/moon-06-fire-trial.webp",
  "./assets/img/moons/moons/moon-07-crown-balance.webp",
  "./assets/img/moons/moons/moon-08-deep-mirror.webp",
  "./assets/img/moons/moons/moon-09-return-path.webp",
  "./assets/img/moons/moons/moon-10-builders-hand.webp",
  "./assets/img/moons/moons/moon-11-star-remembrance.webp",
  "./assets/img/moons/moons/moon-12-river-of-signs.webp",
  "./assets/img/moons/moons/moon-13-completion-seal.webp"
];

const PRECACHE_URLS = PRECACHE_PATHS.map(path => new URL(path, ROOT).toString());

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await Promise.all(PRECACHE_URLS.map(async url => {
      const response = await fetch(url, { cache: "no-cache" });
      if (response.ok) {
        await cache.put(url, response.clone());
      }
    }));
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(key => {
      if (![STATIC_CACHE, SHELL_CACHE].includes(key)) {
        return caches.delete(key);
      }
      return Promise.resolve();
    }));
    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (
      await cache.match(request) ||
      await caches.match(new URL("./moons.html", ROOT).toString()) ||
      await caches.match(new URL("./offline.html", ROOT).toString())
    );
  }
}

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Use network-first for HTML and JavaScript to avoid serving stale runtime
  if (url.pathname.endsWith(".html") || url.pathname.endsWith(".js")) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (PRECACHE_URLS.includes(url.toString()) || url.pathname.startsWith(new URL("./assets/", ROOT).pathname)) {
    event.respondWith(cacheFirst(event.request));
  }
});
