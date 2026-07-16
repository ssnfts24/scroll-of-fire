const CACHE_NAME = 'scroll-of-fire-v20260716-r1';
const HTML_CACHE = `${CACHE_NAME}-html`;
const ASSET_CACHE = `${CACHE_NAME}-assets`;
const IMAGE_CACHE = `${CACHE_NAME}-images`;
const OFFLINE_URL = new URL('./offline.html', self.registration.scope).toString();
const PRECACHE = [
  OFFLINE_URL,
  new URL('./manifest.webmanifest', self.registration.scope).toString(),
  new URL('./assets/img/moons/app/icon-192.png', self.registration.scope).toString(),
  new URL('./assets/img/moons/app/icon-512.png', self.registration.scope).toString(),
  new URL('./assets/img/moons/app/icon-maskable-512.png', self.registration.scope).toString()
];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(ASSET_CACHE);
    await cache.addAll(PRECACHE);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(key => ((key.startsWith('scroll-of-fire') || key.startsWith('remnant-13-moons')) && !key.startsWith(CACHE_NAME)) ? caches.delete(key) : Promise.resolve()));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
async function networkFirst(request, cacheName, fallbackResponse = null) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || fallbackResponse || Response.error();
  }
}
async function staleWhileRevalidate(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  const networkPromise = fetch(request).then(response => { if (response.ok) cache.put(request, response.clone()); return response; }).catch(() => null);
  return cached || networkPromise || fetch(request);
}
async function cacheFirst(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith((async () => networkFirst(event.request, HTML_CACHE, await caches.match(OFFLINE_URL)))());
    return;
  }
  if (url.pathname.endsWith('.js')) { event.respondWith(networkFirst(event.request, ASSET_CACHE)); return; }
  if (url.pathname.endsWith('.css')) { event.respondWith(staleWhileRevalidate(event.request)); return; }
  if (url.pathname.endsWith('manifest.webmanifest')) { event.respondWith(networkFirst(event.request, ASSET_CACHE)); return; }
  if (event.request.destination === 'image') { event.respondWith(cacheFirst(event.request)); }
});
