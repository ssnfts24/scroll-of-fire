(() => {
  "use strict";

  if (window.ScrollOfFirePWA) return;

  const CACHE_NAME = 'scroll-of-fire-v20260716-r4';
  const MIGRATION_FLAG = 'sof-sw-reset-20260716-r4';
  const RELOAD_FLAG = 'sof-sw-reset-20260716-r4-reloaded';
  let initPromise = null;
  let deferredPrompt = null;
  let registration = null;
  let updateReady = false;
  let pendingReload = false;

  const q = selector => document.querySelector(selector);

  function installButton() { return q('[data-pwa-install]'); }
  function updateButton() { return q('[data-pwa-update]'); }
  function helpNode() { return q('[data-pwa-install-help]'); }

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }

  function isAndroid() {
    return /android/i.test(navigator.userAgent);
  }

  function isDesktop() {
    return !isIos() && !isAndroid();
  }

  function setHelp(message, hidden = false) {
    const node = helpNode();
    if (!node) return;
    node.hidden = hidden || !message;
    node.textContent = hidden ? '' : message;
  }

  function updateInstallButtonVisibility() {
    const button = installButton();
    if (!button) return;
    const show = !isStandalone() && !!deferredPrompt;
    button.hidden = !show;
    button.disabled = !show;
  }

  function updateInstallGuidance() {
    updateInstallButtonVisibility();
    if (updateReady) {
      setHelp('A new version is ready. Tap Update available to activate it.');
      return;
    }
    if (isStandalone()) {
      setHelp('13 Moons is running as an installed app.');
      return;
    }
    if (deferredPrompt) {
      setHelp('Install 13 Moons for offline opening and daily use.');
      return;
    }
    if (isIos()) {
      setHelp('On iPhone: tap Share, then Add to Home Screen.');
      return;
    }
    if (isAndroid()) {
      setHelp('On Android: use browser menu → Install app / Add to Home Screen.');
      return;
    }
    if (isDesktop()) {
      setHelp('On desktop Chromium browsers: use the install icon in the address bar or browser menu.');
      return;
    }
    setHelp('Install support depends on browser capabilities.');
  }

  function setUpdateReady(ready) {
    updateReady = ready;
    const button = updateButton();
    if (button) {
      button.hidden = !ready;
      button.disabled = !ready;
    }
    updateInstallGuidance();
  }

  async function migrateOldWorkers() {
    if (!("serviceWorker" in navigator) || !("caches" in window)) return { reloaded: false };
    if (localStorage.getItem(MIGRATION_FLAG) === 'done') return { reloaded: false };
    const registrations = await navigator.serviceWorker.getRegistrations();
    let shouldReload = false;
    await Promise.all(registrations.map(async registrationItem => {
      try { await registrationItem.update(); } catch {}
      const activeScript = registrationItem.active?.scriptURL || registrationItem.waiting?.scriptURL || '';
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

  function watchRegistration(reg) {
    if (!reg) return;
    if (reg.waiting) setUpdateReady(true);
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          setUpdateReady(true);
        }
      });
    });
  }

  function handleControllerChange() {
    if (!pendingReload) return;
    pendingReload = false;
    setUpdateReady(false);
    location.reload();
  }

  async function promptInstall() {
    if (!deferredPrompt) return;
    const installEvent = deferredPrompt;
    deferredPrompt = null;
    updateInstallGuidance();
    installEvent.prompt();
    try {
      const result = await installEvent.userChoice;
      if (result?.outcome === 'dismissed') setHelp('Installation dismissed. You can install again from your browser menu.');
    } catch {
      setHelp('Install prompt failed in this browser.');
    }
    updateInstallGuidance();
  }

  function bindPwaEvents() {
    installButton()?.addEventListener('click', () => promptInstall());
    updateButton()?.addEventListener('click', () => {
      if (!registration?.waiting) return;
      pendingReload = true;
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    });

    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      deferredPrompt = event;
      updateInstallGuidance();
    });

    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      setUpdateReady(false);
      setHelp('13 Moons installed. Open it from your home screen or app launcher.');
      updateInstallGuidance();
    });

    navigator.serviceWorker?.addEventListener('controllerchange', handleControllerChange);
  }

  async function init() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      if (!("serviceWorker" in navigator)) {
        updateInstallGuidance();
        return null;
      }
      try {
        const migration = await migrateOldWorkers();
        if (migration.reloaded) return null;
      } catch (error) {
        console.warn('[PWA] migration skipped', error);
      }
      bindPwaEvents();
      registration = await navigator.serviceWorker.register(new URL('service-worker.js', document.baseURI), {
        scope: new URL('./', document.baseURI).pathname
      });
      watchRegistration(registration);
      updateInstallGuidance();
      return registration;
    })();
    return initPromise;
  }

  window.ScrollOfFirePWA = {
    init,
    cacheName: CACHE_NAME,
    migrationFlag: MIGRATION_FLAG,
    __simulate(type) {
      if (type === 'beforeinstallprompt') {
        deferredPrompt = { prompt() {}, userChoice: Promise.resolve({ outcome:'accepted' }) };
        updateInstallGuidance();
      }
      if (type === 'appinstalled') {
        deferredPrompt = null;
        setHelp('13 Moons installed. Open it from your home screen or app launcher.');
        updateInstallGuidance();
      }
      if (type === 'waiting') setUpdateReady(true);
      if (type === 'controllerchange') handleControllerChange();
    }
  };
})();
