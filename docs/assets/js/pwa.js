(() => {
  "use strict";

  const { APP_VERSION, CACHE_PREFIX } = window.SOF_13_MOONS;
  let promptEvent = null;
  let registration = null;
  let reloadPending = false;

  const byId = id => document.getElementById(id);
  const standalone = () =>
    matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const inApp = () => /(FBAN|FBAV|Instagram|Messenger|GSA|Gmail)/i.test(navigator.userAgent);
  const setText = (id, value) => {
    const node = byId(id);
    if (node) node.textContent = value;
  };

  function status(message) {
    setText("appStatus", message);
    const live = byId("appStatusLive");
    if (live) live.textContent = message;
  }

  function updateDeviceStatus() {
    setText("appVersion", APP_VERSION);
    setText("serviceWorkerVersion", APP_VERSION);
    setText("installedStatus", standalone() ? "App Installed" : "Browser mode");
    setText("standaloneStatus", standalone() ? "Yes" : "No");
    setText("networkStatus", navigator.onLine ? "Online" : "Offline");
    setText("savedRecordCount", String(window.MoonsStorage?.recordCount() || 0));
    setText("lastUpdateDate", localStorage.getItem("sof_moons_last_update") || "Not recorded");
    document.documentElement.classList.toggle("is-standalone", standalone());
    const snapshotNode = byId("offlineSnapshot");
    if (snapshotNode) {
      let snapshot = null;
      try {
        snapshot = !navigator.onLine
          ? JSON.parse(localStorage.getItem("sof_moons_offline_snapshot") || "null")
          : null;
      } catch {}
      snapshotNode.hidden = !snapshot;
      snapshotNode.textContent = snapshot
        ? `Offline — showing the last saved daily state. ${snapshot.date}; Moon ${snapshot.moonNumber}, ${snapshot.moonName}; Moon Day ${snapshot.moonDay}; year day ${snapshot.yearDay}; ${snapshot.moonPhase}; ${snapshot.sunsetBoundary.label}; ${snapshot.shabbatStatus}. Last updated ${new Date(snapshot.updatedAt).toLocaleString()}.`
        : "";
    }
  }

  function updateInstallUI() {
    const button = byId("installApp");
    const installed = standalone();
    if (button) {
      button.hidden = installed;
      button.disabled = installed || !promptEvent;
      button.textContent = installed ? "App Installed" : "Install 13 Moons";
    }
    const iosHelp = byId("iosInstallHelp");
    const browserWarning = byId("inAppBrowserWarning");
    if (iosHelp) iosHelp.hidden = !ios() || installed;
    if (browserWarning) browserWarning.hidden = !ios() || !inApp() || installed;

    if (installed) {
      status("App Installed — running in standalone mode.");
    } else if (promptEvent) {
      status("Installation is ready. Press Install 13 Moons.");
    } else if (ios()) {
      status(inApp()
        ? "To install 13 Moons on iPhone, open this page in Safari first."
        : "Use Safari Share → Add to Home Screen.");
    } else {
      status("Installation is not available yet. Make sure you are using Chrome, the page has fully loaded, and the app is not already installed. You can also use Chrome menu → Add to Home screen or Install app.");
    }
    updateDeviceStatus();
  }

  function writingWitness() {
    return Array.from(document.querySelectorAll("#witnessPanel textarea, #witnessPanel input"))
      .some(input => input.value && input.value.trim());
  }

  function showUpdate() {
    const notice = byId("updateNotice");
    const button = byId("updateApp");
    if (notice) notice.hidden = false;
    if (button) button.disabled = false;
    setText("updateStatus", "Update available");
    status("A new 13 Moons version is ready. Saved logs will be preserved.");
  }

  function watch(reg) {
    if (reg.waiting) showUpdate();
    reg.addEventListener("updatefound", () => {
      const worker = reg.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) showUpdate();
      });
    });
  }

  async function register() {
    if (!("serviceWorker" in navigator)) {
      setText("serviceWorkerVersion", "Unsupported");
      return;
    }
    try {
      registration = await navigator.serviceWorker.register(
        new URL("service-worker.js", document.baseURI),
        { scope: new URL("./", document.baseURI).pathname }
      );
      watch(registration);
    } catch (error) {
      status(`Offline support could not start: ${error.message}`);
    }
  }

  async function install() {
    if (!promptEvent) {
      updateInstallUI();
      return;
    }
    const currentPrompt = promptEvent;
    promptEvent = null;
    await currentPrompt.prompt();
    const choice = await currentPrompt.userChoice;
    localStorage.setItem("sof_moons_install_result", choice.outcome);
    status(choice.outcome === "accepted"
      ? "Installation accepted. 13 Moons is being added."
      : "Installation dismissed. You can retry from the browser menu.");
    updateInstallUI();
  }

  function applyUpdate() {
    if (!registration?.waiting) {
      registration?.update();
      status("Checking for a newer app version…");
      return;
    }
    if (writingWitness() && !confirm("An unsaved witness entry is open. Update and reload now?")) return;
    reloadPending = true;
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  }

  async function refreshFiles() {
    if (!navigator.onLine) {
      status("Reconnect before refreshing app files so the application can download a fresh shell.");
      return;
    }
    if (!confirm("Refresh 13 Moons app files? Saved logs and settings will remain.")) return;
    const registrations = await navigator.serviceWorker.getRegistrations();
    const workerUrl = new URL("service-worker.js", document.baseURI).toString();
    await Promise.all(registrations
      .filter(reg => [
        reg.active?.scriptURL,
        reg.waiting?.scriptURL,
        reg.installing?.scriptURL
      ].includes(workerUrl))
      .map(reg => reg.unregister()));
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith(CACHE_PREFIX))
      .map(key => caches.delete(key)));
    location.reload();
  }

  function bindStorageControls() {
    byId("exportAllData")?.addEventListener("click", () => {
      window.MoonsStorage.download(
        window.MoonsStorage.buildExport(),
        `13-moons-backup-${new Date().toISOString().slice(0, 10)}.json`
      );
    });
    byId("downloadBackup")?.addEventListener("click", () => byId("exportAllData")?.click());
    byId("importAllData")?.addEventListener("click", () => byId("importDataFile")?.click());
    byId("importDataFile")?.addEventListener("change", async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        const mode = byId("importMode")?.value || "merge";
        const counts = window.MoonsStorage.importData(data, mode);
        status(`Import complete: ${counts.logs.length} logs, ${counts.mirrorEntries.length} mirror entries, ${counts.savedPatterns.length} patterns. A rollback backup was created.`);
        updateDeviceStatus();
      } catch (error) {
        status(`Import failed: ${error.message}`);
      }
      event.target.value = "";
    });
    byId("resetAppSettings")?.addEventListener("click", () => {
      if (!confirm("Reset app settings? Witness logs will not be deleted.")) return;
      window.MoonsStorage.resetSettings();
      status("App settings reset. Saved logs were preserved.");
    });
    byId("eraseLocalData")?.addEventListener("click", () => {
      if (!byId("eraseDataConfirm")?.checked) {
        status("Confirm that you exported important records before erasing.");
        return;
      }
      if (!confirm("Permanently erase all local 13 Moons settings, logs, witness entries, mirror entries, and patterns?")) return;
      if (!confirm("Final confirmation: this local 13 Moons data cannot be recovered unless you exported it.")) return;
      window.MoonsStorage.eraseAll();
      updateDeviceStatus();
      status("Local 13 Moons data erased.");
    });
    byId("exportCurrentWitness")?.addEventListener("click", () => {
      const witness = byId("witnessOutput")?.value || byId("witnessOutput")?.textContent || "";
      window.MoonsStorage.download({
        exportSchemaVersion: 1,
        appVersion: APP_VERSION,
        exportedAt: new Date().toISOString(),
        witness
      }, `13-moons-witness-${new Date().toISOString().slice(0, 10)}.json`);
    });
    byId("copyCurrentReading")?.addEventListener("click", () => byId("copyMirror")?.click());
  }

  function init() {
    byId("installApp")?.addEventListener("click", install);
    byId("checkForUpdates")?.addEventListener("click", async () => {
      await registration?.update();
      status(registration?.waiting ? "Update available." : "13 Moons is up to date.");
    });
    byId("updateApp")?.addEventListener("click", applyUpdate);
    byId("refreshAppFiles")?.addEventListener("click", refreshFiles);
    bindStorageControls();
    addEventListener("beforeinstallprompt", event => {
      event.preventDefault();
      promptEvent = event;
      updateInstallUI();
    });
    addEventListener("appinstalled", () => {
      promptEvent = null;
      localStorage.setItem("sof_moons_install_result", "accepted");
      updateInstallUI();
    });
    addEventListener("online", updateDeviceStatus);
    addEventListener("offline", updateDeviceStatus);
    navigator.serviceWorker?.addEventListener("controllerchange", () => {
      if (!reloadPending || sessionStorage.getItem("sof_moons_update_reloaded")) return;
      sessionStorage.setItem("sof_moons_update_reloaded", "1");
      localStorage.setItem("sof_moons_last_update", new Date().toISOString());
      location.reload();
    });
    document.addEventListener("sof:moon-render", event => {
      try {
        localStorage.setItem("sof_moons_offline_snapshot", JSON.stringify({
          date: event.detail.effectiveISO,
          moonNumber: event.detail.info.moonNumber,
          moonName: event.detail.info.moon.name,
          moonDay: event.detail.info.dayInMoon,
          yearDay: event.detail.info.dayOfYear,
          moonPhase: event.detail.phase,
          sunsetBoundary: event.detail.boundary,
          shabbatStatus: event.detail.shabbat.state,
          updatedAt: new Date().toISOString()
        }));
      } catch {}
      updateDeviceStatus();
    });
    register();
    updateInstallUI();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
