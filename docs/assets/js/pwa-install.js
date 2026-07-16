(() => {
  "use strict";

  const DISMISS_KEY = "sof_moons_install_dismissed_v1";
  const DISMISS_MS = 1000 * 60 * 60 * 24 * 7;
  let deferredPrompt = null;
  let registration = null;
  let updateReady = false;

  const $ = selector => document.querySelector(selector);

  function baseUrl(path) {
    return new URL(path, document.baseURI).toString();
  }

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }

  function isChromium() {
    return /chrome|chromium|crios|edg/i.test(navigator.userAgent) && !/firefox|fxios/i.test(navigator.userAgent);
  }

  function wasDismissedRecently() {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (!raw) return false;
      const until = Number(raw);
      return Number.isFinite(until) && until > Date.now();
    } catch {
      return false;
    }
  }

  function dismissInstallPrompt() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS));
    } catch {}
  }

  function setInstallHelp(message = "", { hidden = false } = {}) {
    const node = $("#appInstallHelp");
    if (!node) return;
    node.hidden = hidden || !message;
    node.textContent = hidden ? "" : message;
  }

  function updateInstallUI() {
    const installButton = $("#installApp");
    if (!installButton) return;

    const standalone = isStandalone();
    installButton.hidden = standalone || !deferredPrompt || wasDismissedRecently();
    if (standalone) {
      setInstallHelp("13 Moons is running as an installed app.", { hidden: false });
      return;
    }

    if (updateReady) return;

    if (deferredPrompt && !wasDismissedRecently()) {
      setInstallHelp("Install this living calendar for offline opening and daily use.", { hidden: false });
      return;
    }

    if (isIos()) {
      setInstallHelp("On iPhone or iPad Safari: tap Share, then choose Add to Home Screen.", { hidden: false });
      return;
    }

    if (!isChromium()) {
      setInstallHelp("Installation is browser-dependent. In supported desktop browsers, use the browser install option for this page.", { hidden: false });
      return;
    }

    setInstallHelp("", { hidden: true });
  }

  function showUpdateButton(show) {
    const button = $("#appUpdate");
    if (!button) return;
    updateReady = show;
    button.hidden = !show;
    if (show) {
      setInstallHelp("A new version of 13 Moons is ready. Update when you are ready to reload.", { hidden: false });
    } else {
      updateInstallUI();
    }
  }

  function watchRegistration(reg) {
    if (!reg) return;
    if (reg.waiting) {
      showUpdateButton(true);
      return;
    }

    reg.addEventListener("updatefound", () => {
      const worker = reg.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          showUpdateButton(true);
        }
      });
    });
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;

    try {
      registration = await navigator.serviceWorker.register(baseUrl("service-worker.js"), {
        scope: baseUrl("./")
      });
      watchRegistration(registration);

      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (updateReady) {
          window.location.reload();
        }
      });
    } catch {
      setInstallHelp("Offline support could not be enabled in this browser.", { hidden: false });
    }
  }

  async function promptInstall() {
    if (!deferredPrompt) return;

    const prompt = deferredPrompt;
    deferredPrompt = null;
    prompt.prompt();

    const result = await prompt.userChoice;
    if (result.outcome === "accepted") {
      try {
        if (typeof gtag === "function") gtag("event", "moons_install_accepted");
      } catch {}
      setInstallHelp("13 Moons is being installed.", { hidden: false });
    } else {
      dismissInstallPrompt();
      try {
        if (typeof gtag === "function") gtag("event", "moons_install_dismissed");
      } catch {}
      setInstallHelp("Installation dismissed for now.", { hidden: false });
    }

    updateInstallUI();
  }

  function setup() {
    const installButton = $("#installApp");
    const updateButton = $("#appUpdate");

    installButton?.addEventListener("click", promptInstall);
    updateButton?.addEventListener("click", () => {
      if (!registration?.waiting) return;
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    });

    window.addEventListener("beforeinstallprompt", event => {
      event.preventDefault();
      deferredPrompt = event;
      try {
        if (typeof gtag === "function") gtag("event", "moons_install_prompt_displayed");
      } catch {}
      updateInstallUI();
    });

    window.addEventListener("appinstalled", () => {
      deferredPrompt = null;
      showUpdateButton(false);
      setInstallHelp("13 Moons installed successfully.", { hidden: false });
    });

    window.addEventListener("online", updateInstallUI);
    window.addEventListener("offline", () => {
      setInstallHelp("Offline mode detected. Cached 13 Moons content remains available after the first successful visit.", { hidden: false });
      try {
        if (typeof gtag === "function") gtag("event", "moons_offline_mode_detected");
      } catch {}
    });

    registerServiceWorker();
    updateInstallUI();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
})();
