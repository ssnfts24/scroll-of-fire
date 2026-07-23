"use strict";

importScripts("./assets/js/moons-version.js");

const { APP_VERSION: VERSION, CACHE_PREFIX, SERVICE_WORKER_BUILD } = self.SOF_13_MOONS;
if (SERVICE_WORKER_BUILD !== VERSION) {
  throw new Error(`Service-worker build ${SERVICE_WORKER_BUILD} does not match app version ${VERSION}`);
}
const CORE_CACHE = `${CACHE_PREFIX}core-${VERSION}`;
const RUNTIME_CACHE = `${CACHE_PREFIX}runtime-${VERSION}`;
const IMAGE_CACHE = `${CACHE_PREFIX}images-${VERSION}`;
const INSTALL_CACHE = `${CACHE_PREFIX}install-${SERVICE_WORKER_BUILD}`;
const PRESERVE_CACHE = `${CACHE_PREFIX}refresh-preserve-${SERVICE_WORKER_BUILD}`;
const RECOVERY_METADATA_URL = new URL("./__refresh-recovery__", self.registration.scope).toString();
const CURRENT_CACHES = new Set([CORE_CACHE, RUNTIME_CACHE, IMAGE_CACHE, INSTALL_CACHE]);
const ROOT = self.registration.scope;

const mandatoryPaths = [
  "./moons.html",
  "./equinox-passage.html",
  "./offline.html",
  "./manifest.webmanifest",
  "./assets/css/codex.css",
  "./assets/css/navigation.css",
  "./assets/css/moons.css",
  "./assets/css/equinox-passage.css",
  "./assets/css/astrology.css",
  "./assets/css/animations.css",
  "./assets/css/pwa.css",
  "./assets/js/moons.js",
  "./assets/js/moons-version.js",
  "./assets/js/calendar/pattern-calendar-version.js",
  "./assets/js/calendar/pattern-calendar-data.js",
  "./assets/js/calendar/pattern-calendar-format.js",
  "./assets/js/calendar/pattern-calendar-boundary.js",
  "./assets/js/calendar/pattern-calendar.js",
  "./assets/js/astronomy/astronomy-version.js",
  "./assets/js/astronomy/astronomy-sources.js",
  "./assets/js/astronomy/timezone-tools.js",
  "./assets/js/astronomy/equinox-reference-data.js",
  "./assets/js/astronomy/lunar-at-equinox.js",
  "./assets/js/astronomy/equinox-engine.js",
  "./assets/js/equinox/equinox-passage-format.js",
  "./assets/js/equinox/equinox-passage-engine.js",
  "./assets/js/equinox/equinox-passage-data.js",
  "./assets/js/equinox/equinox-passage-export.js",
  "./assets/js/equinox/equinox-passage-storage.js",
  "./assets/js/equinox/equinox-passage-visualization-data.js",
  "./assets/js/equinox/equinox-passage-ui.js",
  "./assets/js/alignment/alignment-version.js",
  "./assets/js/alignment/alignment-ledger-engine.js",
  "./assets/js/alignment/alignment-ledger-data.js",
  "./assets/js/alignment/alignment-comparison.js",
  "./assets/js/alignment/alignment-recurrence.js",
  "./assets/js/alignment/alignment-offsets.js",
  "./assets/js/alignment/alignment-signature.js",
  "./assets/js/alignment/alignment-export.js",
  "./assets/js/alignment/alignment-url-state.js",
  "./assets/js/alignment/alignment-ui.js",
  "./assets/js/sphere/living-time-sphere-version.js",
  "./assets/js/sphere/living-time-sphere-model.js",
  "./assets/js/sphere/living-time-sphere-layout.js",
  "./assets/js/sphere/living-time-sphere-renderer-svg.js",
  "./assets/js/sphere/living-time-sphere-renderer-canvas.js",
  "./assets/js/sphere/living-time-sphere-interaction.js",
  "./assets/js/sphere/living-time-sphere-accessibility.js",
  "./assets/js/sphere/living-time-sphere-export.js",
  "./assets/js/sphere/living-time-sphere-url-state.js",
  "./assets/js/sphere/living-time-sphere-ui.js",
  "./assets/css/alignment-ledger.css",
  "./assets/css/living-time-sphere.css",
  "./alignment-ledger.html",
  "./living-time-sphere.html",
  "./assets/js/astrology.js",
  "./assets/js/moons-images.js",
  "./assets/js/moons-migrations.js",
  "./assets/js/moons-storage.js",
  "./assets/js/pwa-refresh.js",
  "./assets/js/pwa.js",
  "./assets/js/site.js",
  "./assets/js/living-codex.js",
  "./assets/js/codex-witness.js",
  "./assets/js/motion.js",
  "./assets/data/moons.json",
  "./data/equinox-passage/equinox-reference-2014-2026.json",
  "./data/equinox-passage/equinox-passage-2014-2026.csv",
  "./assets/img/moons/app/icon-192.png",
  "./assets/img/moons/app/icon-512.png",
  "./assets/img/moons/app/icon-maskable-512.png"
];
const optionalPaths = [
  "./genesis-oracle.html",
  "./assets/css/genesis-oracle.css",
  "./assets/js/genesis-oracle.js",
  "./assets/js/oracle/oracle-version.js",
  "./assets/js/oracle/oracle-data.js",
  "./assets/js/oracle/oracle-name-code.js",
  "./assets/js/oracle/oracle-aspects.js",
  "./assets/js/oracle/oracle-signature.js",
  "./assets/js/oracle/oracle-reading.js",
  "./assets/js/oracle/oracle-compatibility.js",
  "./assets/js/oracle/oracle-storage.js",
  "./assets/js/oracle/oracle-profile-repository.js",
  "./assets/js/oracle/oracle-engine.js",
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
const mandatoryUrls = mandatoryPaths.map(path => new URL(path, ROOT).toString());
const optionalUrls = optionalPaths.map(path => new URL(path, ROOT).toString());
const coreUrls = [...mandatoryUrls, ...optionalUrls];
const offlineUrl = new URL("./offline.html", ROOT).toString();
const appUrl = new URL("./moons.html", ROOT).toString();
const development = ["localhost", "127.0.0.1"].includes(self.location.hostname);

const readyMessage = type => ({
  type,
  appVersion: VERSION,
  serviceWorkerBuild: SERVICE_WORKER_BUILD,
  mandatoryAssetCount: mandatoryUrls.length
});

async function notifyClients(message) {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  clients.forEach(client => client.postMessage(message));
}

async function mandatoryCacheReady() {
  for (const cacheName of [INSTALL_CACHE, CORE_CACHE]) {
    const cache = await caches.open(cacheName);
    const matches = await Promise.all(mandatoryUrls.map(url => cache.match(url)));
    if (matches.every(Boolean)) return true;
  }
  return false;
}

async function activeRecoveryCaches(keys) {
  if (!keys.includes(PRESERVE_CACHE)) return null;
  try {
    const cache = await caches.open(PRESERVE_CACHE);
    const response = await cache.match(RECOVERY_METADATA_URL);
    const metadata = await response?.json();
    if (metadata?.appVersion !== VERSION ||
        metadata?.serviceWorkerBuild !== SERVICE_WORKER_BUILD ||
        !Array.isArray(metadata?.recoveryCaches)) return null;
    return metadata.recoveryCaches.filter(name =>
      typeof name === "string" &&
      name.startsWith(CACHE_PREFIX) &&
      !name.startsWith(`${CACHE_PREFIX}install-`) &&
      !name.startsWith(`${CACHE_PREFIX}refresh-preserve-`)
    );
  } catch {
    return null;
  }
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    await caches.delete(INSTALL_CACHE);
    const cache = await caches.open(INSTALL_CACHE);
    try {
      await Promise.all(mandatoryUrls.map(async url => {
        const response = await fetch(url, { cache: "reload" });
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`.trim());
        await cache.put(url, response);
      }));
    } catch (error) {
      console.error("13 Moons service-worker install failed: mandatory app-shell file unavailable.", error);
      await caches.delete(INSTALL_CACHE);
      await notifyClients(readyMessage("APP_SHELL_FAILED"));
      throw error;
    }

    const optionalResults = await Promise.allSettled(optionalUrls.map(async url => {
      const response = await fetch(url, { cache: "reload" });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`.trim());
      await cache.put(url, response);
      return url;
    }));
    if (development) {
      optionalResults.forEach((result, index) => {
        if (result.status === "rejected") {
          console.warn(`Optional 13 Moons asset was not cached: ${optionalUrls[index]}`, result.reason);
        }
      });
    }
    await notifyClients(readyMessage("APP_SHELL_READY"));
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const installCache = await caches.open(INSTALL_CACHE);
    const coreCache = await caches.open(CORE_CACHE);
    await Promise.all(coreUrls.map(async url => {
      const response = await installCache.match(url);
      if (response) await coreCache.put(url, response);
    }));
    const promoted = await Promise.all(mandatoryUrls.map(url => coreCache.match(url)));
    if (!promoted.every(Boolean)) {
      throw new Error("Current app-shell cache promotion was incomplete.");
    }
    await caches.delete(INSTALL_CACHE);
    const keys = await caches.keys();
    const recoveryCaches = await activeRecoveryCaches(keys);
    const allowed = new Set(CURRENT_CACHES);
    if (recoveryCaches) {
      allowed.add(PRESERVE_CACHE);
      recoveryCaches.forEach(name => allowed.add(name));
    }
    await Promise.all(keys.map(key => {
      if (key.startsWith(CACHE_PREFIX) && !allowed.has(key)) return caches.delete(key);
      return Promise.resolve(false);
    }));
    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (event.data?.type === "ACTIVATE_VERIFIED_REFRESH") {
    event.waitUntil((async () => {
      const recoveryCaches = Array.isArray(event.data.recoveryCaches)
        ? event.data.recoveryCaches.filter(name =>
          typeof name === "string" &&
          name.startsWith(CACHE_PREFIX) &&
          !name.startsWith(`${CACHE_PREFIX}install-`) &&
          !name.startsWith(`${CACHE_PREFIX}refresh-preserve-`)
        )
        : [];
      const cache = await caches.open(PRESERVE_CACHE);
      await cache.put(RECOVERY_METADATA_URL, new Response(JSON.stringify({
        appVersion: VERSION,
        serviceWorkerBuild: SERVICE_WORKER_BUILD,
        recoveryCaches
      }), { headers: { "Content-Type": "application/json" } }));
      await self.skipWaiting();
    })());
    return;
  }
  if (event.data?.type === "GET_APP_SHELL_READY") {
    event.waitUntil((async () => {
      if (await mandatoryCacheReady()) {
        event.source?.postMessage(readyMessage("APP_SHELL_READY"));
      }
    })());
  }
});

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const coreCache = await caches.open(CORE_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) ||
      (await coreCache.match(appUrl)) ||
      (await coreCache.match(offlineUrl));
  }
}

async function staleWhileRevalidate(request, cacheName = CORE_CACHE) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: true });
  const update = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || update || Response.error();
}

async function cacheImage(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
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
