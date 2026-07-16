(() => {
  "use strict";

  const offlineMessage = "Reconnect to the internet before refreshing app files.";
  const failureMessage = "App file refresh could not be completed. Your previous recovery files were preserved. Please check your connection and try again.";
  const pendingKey = "sof_moons_refresh_pending";
  const defaultTimeout = 30000;

  function workerFor(registration) {
    return registration.installing || registration.waiting || registration.active;
  }

  function waitForReplacement({
    registration,
    workerUrl,
    scopeUrl,
    expectedVersion,
    expectedBuild,
    preserveRecovery = false,
    timeoutMs
  }) {
    return new Promise((resolve, reject) => {
      let worker = null;
      let ready = false;
      let checking = false;
      let settled = false;
      let activationRequested = false;

      const cleanup = () => {
        clearTimeout(timeout);
        navigator.serviceWorker.removeEventListener?.("message", onMessage);
        navigator.serviceWorker.removeEventListener?.("controllerchange", advance);
        registration.removeEventListener?.("updatefound", findWorker);
        worker?.removeEventListener?.("statechange", onStateChange);
      };
      const fail = error => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };
      const succeed = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(worker);
      };
      const registrationStillExists = async () => {
        if (!navigator.serviceWorker.getRegistration) return true;
        const current = await navigator.serviceWorker.getRegistration(scopeUrl);
        return Boolean(current);
      };
      const advance = async () => {
        if (settled || checking || !worker) return;
        if (worker.state === "redundant") {
          fail(new Error("The replacement service worker became redundant."));
          return;
        }
        if (ready && ["installed", "waiting"].includes(worker.state) &&
            !activationRequested) {
          activationRequested = true;
          worker.postMessage?.({
            type: preserveRecovery ? "ACTIVATE_VERIFIED_REFRESH" : "SKIP_WAITING"
          });
        }
        if (!ready || worker.state !== "activated") return;
        checking = true;
        try {
          if (!(await registrationStillExists())) {
            fail(new Error("The replacement service-worker registration disappeared."));
            return;
          }
          const controller = navigator.serviceWorker.controller;
          if (controller === worker ||
              (controller?.scriptURL && controller.scriptURL === workerUrl)) {
            succeed();
          }
        } catch (error) {
          fail(error);
        } finally {
          checking = false;
        }
      };
      const onStateChange = () => {
        if (worker?.state === "redundant") {
          fail(new Error("The replacement service worker became redundant."));
          return;
        }
        worker?.postMessage?.({ type: "GET_APP_SHELL_READY" });
        advance();
      };
      const attachWorker = nextWorker => {
        if (!nextWorker || nextWorker === worker) return;
        worker?.removeEventListener?.("statechange", onStateChange);
        worker = nextWorker;
        if (worker.scriptURL && worker.scriptURL !== workerUrl) {
          fail(new Error("The replacement service-worker script did not match."));
          return;
        }
        worker.addEventListener?.("statechange", onStateChange);
        worker.postMessage?.({ type: "GET_APP_SHELL_READY" });
        onStateChange();
      };
      const findWorker = () => attachWorker(workerFor(registration));
      const onMessage = event => {
        const data = event.data;
        if (!data || !["APP_SHELL_READY", "APP_SHELL_FAILED"].includes(data.type)) return;
        if (event.source && worker && event.source !== worker) return;
        if (data.appVersion !== expectedVersion ||
            data.serviceWorkerBuild !== expectedBuild) return;
        if (data.type === "APP_SHELL_FAILED") {
          fail(new Error("Mandatory app-shell precaching failed."));
          return;
        }
        if (!Number.isInteger(data.mandatoryAssetCount) ||
            data.mandatoryAssetCount < 1) return;
        ready = true;
        advance();
      };

      const timeout = setTimeout(() => {
        fail(new Error("Replacement service-worker installation timed out."));
      }, timeoutMs);
      navigator.serviceWorker.addEventListener?.("message", onMessage);
      navigator.serviceWorker.addEventListener?.("controllerchange", advance);
      registration.addEventListener?.("updatefound", findWorker);
      findWorker();
    });
  }

  async function refreshAppFiles({
    cachePrefix,
    currentCoreCache,
    expectedVersion,
    expectedBuild = expectedVersion,
    status,
    onRegistered,
    lifecycleTimeoutMs = defaultTimeout
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
    const scopeUrl = new URL("./", document.baseURI).toString();
    appUrl.searchParams.set("refresh", Date.now().toString());
    status("Checking the network before refreshing app files…");
    let replacement = null;

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

      const registrations = await navigator.serviceWorker.getRegistrations();
      const applicable = registrations.filter(reg => {
        const scripts = [
          reg.active?.scriptURL,
          reg.waiting?.scriptURL,
          reg.installing?.scriptURL
        ];
        return reg.scope === scopeUrl && scripts.includes(workerUrl);
      });

      status("Downloading and verifying a fresh 13 Moons app shell…");
      await Promise.all(applicable.map(reg => reg.unregister()));
      replacement = await navigator.serviceWorker.register(workerUrl, {
        scope: new URL("./", document.baseURI).pathname,
        updateViaCache: "none"
      });
      onRegistered?.(replacement);
      await waitForReplacement({
        registration: replacement,
        workerUrl,
        scopeUrl,
        expectedVersion,
        expectedBuild,
        preserveRecovery: true,
        timeoutMs: lifecycleTimeoutMs
      });

      const keys = await caches.keys();
      const recoveryCaches = keys.filter(key =>
        key.startsWith(cachePrefix) &&
        key !== currentCoreCache &&
        !key.startsWith(`${cachePrefix}install-`)
      );
      sessionStorage.setItem(pendingKey, JSON.stringify({
        appVersion: expectedVersion,
        serviceWorkerBuild: expectedBuild,
        recoveryCaches
      }));
      status("Replacement app shell verified. Reloading to complete recovery checks…");
      location.replace(appUrl.toString());
      return replacement;
    } catch {
      try {
        await replacement?.unregister?.();
        const recovery = await navigator.serviceWorker.register(workerUrl, {
          scope: new URL("./", document.baseURI).pathname
        });
        onRegistered?.(recovery);
      } catch {}
      status(failureMessage);
      return null;
    }
  }

  async function completePendingRefresh({
    currentCoreCache,
    expectedVersion,
    expectedBuild = expectedVersion,
    status,
    lifecycleTimeoutMs = defaultTimeout
  }) {
    const value = sessionStorage.getItem(pendingKey);
    if (!value) return false;

    try {
      const pending = JSON.parse(value);
      if (pending.appVersion !== expectedVersion ||
          pending.serviceWorkerBuild !== expectedBuild) {
        throw new Error("Pending refresh version does not match.");
      }
      const workerUrl = new URL("service-worker.js", document.baseURI).toString();
      const scopeUrl = new URL("./", document.baseURI).toString();
      const registration = await navigator.serviceWorker.getRegistration(scopeUrl);
      if (!registration) throw new Error("Replacement registration is unavailable.");
      await waitForReplacement({
        registration,
        workerUrl,
        scopeUrl,
        expectedVersion,
        expectedBuild,
        timeoutMs: lifecycleTimeoutMs
      });
      const response = await fetch(new URL("./moons.html", document.baseURI), {
        cache: "no-store",
        credentials: "same-origin"
      });
      if (!response.ok) throw new Error(`App-shell verification returned ${response.status}.`);
      await Promise.all((pending.recoveryCaches || [])
        .filter(key => key !== currentCoreCache)
        .map(key => caches.delete(key)));
      sessionStorage.removeItem(pendingKey);
      status("Fresh app files are ready. Previous recovery files were safely retired.");
      return true;
    } catch {
      status(failureMessage);
      return false;
    }
  }

  window.MoonsPwaRefresh = Object.freeze({
    failureMessage,
    offlineMessage,
    pendingKey,
    refreshAppFiles,
    completePendingRefresh
  });
})();
