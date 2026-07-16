(() => {
  "use strict";

  if (window.ScrollOfFirePWA) return;

  const CACHE_NAME = 'scroll-of-fire-v20260716-r3';
  const MIGRATION_FLAG = 'sof-sw-reset-20260716-r3';
  const RELOAD_FLAG = 'sof-sw-reset-20260716-r3-reloaded';
  let initPromise = null;

  async function migrateOldWorkers() {
    if (!("serviceWorker" in navigator) || !("caches" in window)) return { reloaded: false };
    if (localStorage.getItem(MIGRATION_FLAG) === 'done') return { reloaded: false };
    const registrations = await navigator.serviceWorker.getRegistrations();
    let shouldReload = false;
    await Promise.all(registrations.map(async registration => {
      try { await registration.update(); } catch {}
      const activeScript = registration.active?.scriptURL || registration.waiting?.scriptURL || '';
      if (activeScript && activeScript.includes(location.origin) && !activeScript.endsWith('service-worker.js')) shouldReload = true;
    }));
    const keys = await caches.keys();
    await Promise.all(keys.map(async key => {
      if ((key.startsWith('scroll-of-fire') || key.startsWith('remnant-13-moons')) && !key.startsWith(CACHE_NAME)) {
        shouldReload = true;
        await caches.delete(key);
      }
    }));
    localStorage.setItem(MIGRATION_FLAG, 'done');
    if (shouldReload && navigator.serviceWorker.controller && sessionStorage.getItem(RELOAD_FLAG) !== 'done') {
      sessionStorage.setItem(RELOAD_FLAG, 'done');
      location.reload();
      return { reloaded: true };
    }
    return { reloaded: false };
  }

  function showUpdateButton(registration) {
    const button = document.querySelector('[data-pwa-update]');
    if (!button) return;
    const sync = waiting => {
      button.hidden = !waiting;
      button.disabled = !waiting;
    };
    sync(!!registration.waiting);
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) sync(true);
      });
    });
    button.addEventListener('click', () => {
      if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => sync(false));
  }

  async function init() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      if (!("serviceWorker" in navigator)) return null;
      try {
        const migration = await migrateOldWorkers();
        if (migration.reloaded) return null;
      } catch (error) {
        console.warn('[PWA] migration skipped', error);
      }
      const registration = await navigator.serviceWorker.register(new URL('service-worker.js', document.baseURI), {
        scope: new URL('./', document.baseURI).pathname
      });
      showUpdateButton(registration);
      return registration;
    })();
    return initPromise;
  }

  window.ScrollOfFirePWA = { init, cacheName: CACHE_NAME, migrationFlag: MIGRATION_FLAG };
})();
