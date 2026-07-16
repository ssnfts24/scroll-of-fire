"use strict";

importScripts("./assets/js/moons-version.js");

const { APP_VERSION: VERSION, CACHE_PREFIX } = self.SOF_13_MOONS;
const CORE_CACHE = `${CACHE_PREFIX}core-${VERSION}`;
const RUNTIME_CACHE = `${CACHE_PREFIX}runtime-${VERSION}`;
const IMAGE_CACHE = `${CACHE_PREFIX}images-${VERSION}`;
const ROOT = self.registration.scope;

const corePaths = [
  "./moons.html",
  "./offline.html",
  "./manifest.webmanifest",
  "./assets/css/codex.css",
  "./assets/css/navigation.css",
  "./assets/css/moons.css",
  "./assets/css/astrology.css",
  "./assets/css/animations.css",
  "./assets/css/pwa.css",
  "./assets/js/moons.js",
  "./assets/js/moons-version.js",
  "./assets/js/astrology.js",
  "./assets/js/moons-images.js",
  "./assets/js/moons-migrations.js",
  "./assets/js/moons-storage.js",
  "./assets/js/pwa.js",
  "./assets/js/site.js",
  "./assets/js/calendar-cor.js",
  "./assets/js/living-codex.js",
  "./assets/js/codex-witness.js",
  "./assets/js/motion.js",
  "./assets/data/moons.json",
  "./assets/img/moons/app/icon-192.png",
  "./assets/img/moons/app/icon-512.png",
  "./assets/img/moons/app/icon-maskable-512.png",
  "./assets/img/moons/app/apple-touch-icon.png",
  "./assets/img/moons/app/screenshot-mobile-390x844.png",
  "./assets/img/moons/app/screenshot-mobile-430x932.png",
  "./assets/img/moons/app/icon-512.webp",
  "./assets/img/home/gates/home-gate-13-moons.webp",
  "./assets/img/moons/sections/today.webp",
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
const coreUrls = corePaths.map(path => new URL(path, ROOT).toString());
const requiredUrls = coreUrls.slice(0, 26);
const optionalUrls = coreUrls.slice(26);
const offlineUrl = new URL("./offline.html", ROOT).toString();
const appUrl = new URL("./moons.html", ROOT).toString();

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CORE_CACHE);
    await Promise.all(requiredUrls.map(async url => {
      const response = await fetch(url, { cache: "reload" });
      if (!response.ok) throw new Error(`Unable to cache ${url}`);
      await cache.put(url, response);
    }));
    await Promise.allSettled(optionalUrls.map(async url => {
      const response = await fetch(url, { cache: "reload" });
      if (response.ok) await cache.put(url, response);
    }));
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const current = new Set([CORE_CACHE, RUNTIME_CACHE, IMAGE_CACHE]);
    const keys = await caches.keys();
    await Promise.all(keys.map(key => {
      if (key.startsWith(CACHE_PREFIX) && !current.has(key)) return caches.delete(key);
      return Promise.resolve(false);
    }));
    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) ||
      (await caches.match(appUrl)) ||
      (await caches.match(offlineUrl));
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await caches.match(request, { ignoreSearch: true });
  const update = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || update || Response.error();
}

async function cacheImage(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(networkFirst(event.request));
    return;
  }
  if (event.request.destination === "image") {
    event.respondWith(cacheImage(event.request));
    return;
  }
  if (coreUrls.includes(url.toString()) ||
      ["script", "style", "manifest"].includes(event.request.destination)) {
    event.respondWith(staleWhileRevalidate(event.request));
  }
});
