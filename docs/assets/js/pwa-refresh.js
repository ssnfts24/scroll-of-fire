(() => {
  "use strict";

  const offlineMessage = "Reconnect to the internet before refreshing app files.";

  function waitForInstall(registration) {
    const worker = registration.installing || registration.waiting || registration.active;
    if (!worker || ["installed", "activated"].includes(worker.state)) {
      return Promise.resolve();
    }
    if (worker.state === "redundant") {
      return Promise.reject(new Error("The replacement service worker could not install."));
    }
    return new Promise((resolve, reject) => {
      worker.addEventListener("statechange", () => {
        if (["installed", "activated"].includes(worker.state)) resolve();
        if (worker.state === "redundant") {
          reject(new Error("The replacement service worker could not install."));
        }
      });
    });
  }

  async function refreshAppFiles({
    cachePrefix,
    currentCoreCache,
    status,
    onRegistered
  }) {
    if (!navigator.onLine) {
      status(offlineMessage);
      return null;
    }
    if (!confirm("Refresh 13 Moons app files? Saved logs and settings will remain.")) return null;
    if (!navigator.onLine) {
      status(offlineMessage);
      return null;
    }

    const appUrl = new URL("./moons.html", document.baseURI);
    const workerUrl = new URL("service-worker.js", document.baseURI).toString();
    appUrl.searchParams.set("refresh", Date.now().toString());
    status("Checking the network before refreshing app files…");

    try {
      const response = await fetch(appUrl, {
        cache: "no-store",
        credentials: "same-origin"
      });
      if (!response.ok) throw new Error(`Network check returned ${response.status}.`);
      if (!navigator.onLine) {
        status(offlineMessage);
        return null;
      }

      const scopeUrl = new URL("./", document.baseURI).toString();
      const registrations = await navigator.serviceWorker.getRegistrations();
      const applicable = registrations.filter(reg => {
        const scripts = [
          reg.active?.scriptURL,
          reg.waiting?.scriptURL,
          reg.installing?.scriptURL
        ];
        return reg.scope === scopeUrl && scripts.includes(workerUrl);
      });

      status("Downloading a fresh 13 Moons app shell…");
      await Promise.all(applicable.map(reg => reg.unregister()));

      const replacement = await navigator.serviceWorker.register(workerUrl, {
        scope: new URL("./", document.baseURI).pathname
      });
      await waitForInstall(replacement);
      onRegistered?.(replacement);

      const keys = await caches.keys();
      await Promise.all(keys
        .filter(key => key.startsWith(cachePrefix) && key !== currentCoreCache)
        .map(key => caches.delete(key)));
      status("Fresh app files are ready. Reloading from the network…");
      location.replace(appUrl.toString());
      return replacement;
    } catch (error) {
      try {
        const recovery = await navigator.serviceWorker.register(workerUrl, {
          scope: new URL("./", document.baseURI).pathname
        });
        onRegistered?.(recovery);
      } catch {}
      status(`App files were not refreshed: ${error.message} Your saved data was preserved; reconnect and try again.`);
      return null;
    }
  }

  window.MoonsPwaRefresh = Object.freeze({
    offlineMessage,
    refreshAppFiles
  });
})();
