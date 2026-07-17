(() => {
  "use strict";

  const {
    APP_VERSION,
    CACHE_PREFIX,
    PAGE_BUILD,
    CSS_RELEASE,
    SERVICE_WORKER_BUILD,
    DEPLOYMENT_COMMIT,
    APP_SCOPE,
    MANIFEST_PATH
  } = window.SOF_13_MOONS;
  let promptEvent = null;
  let registration = null;
  let reloadPending = false;
  let manifestDetails = null;
  let installUiState = null;
  let appInstalledSeen = localStorage.getItem("sof_moons_install_result") === "accepted";
  let helpPanelOpener = null;

  const byId = id => document.getElementById(id);
  const standalone = () =>
    matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const inApp = () => /(FBAN|FBAV|Instagram|Messenger|GSA|Gmail)/i.test(navigator.userAgent);
  const supportsInstallPrompt = () =>
    !ios() && /Chrome|Chromium|EdgA/i.test(navigator.userAgent);
  const setText = (id, value) => {
    const node = byId(id);
    if (node) node.textContent = value;
  };
  const setVisible = (id, visible) => {
    const node = byId(id);
    if (node) node.hidden = !visible;
  };
  const manifestUrl = () => document.querySelector('link[rel="manifest"]')?.href ||
    new URL(MANIFEST_PATH, document.baseURI).toString();
  const settingsJump = () =>
    document.querySelector('[data-tab="settingsPanel"]') ||
    document.querySelector('[data-tab-jump="settingsPanel"]');
  const cssUrl = () =>
    document.querySelector('link[href*="assets/css/moons.css"]')?.href ||
    new URL("assets/css/moons.css", document.baseURI).toString();
  const browserMode = () => standalone() ? "standalone" : "tab";

  function status(message) {
    setText("appStatus", message);
    const live = byId("appStatusLive");
    if (live) live.textContent = message;
  }

  function resolveScope() {
    return new URL(APP_SCOPE, document.baseURI).toString();
  }

  function scrollToInstallHelp() {
    settingsJump()?.click?.();
    byId("settingsPanel")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }

  function scrollToIosHelp() {
    scrollToInstallHelp();
    byId("iosInstallHelp")?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  }

  function shortcutLabel(state) {
    if (!state) return "Download App";
    switch (state.key) {
      case "standalone": return "Installed";
      case "ios-safari":
      case "ios-in-app": return "iPhone Instructions";
      case "ready": return "Install App";
      default: return "Installation Help";
    }
  }

  function handleHelpPanelKeydown(e) {
    const panel = byId("iphoneHelpPanel");
    if (!panel) return;
    if (e.key === "Escape") {
      closeHelpPanel();
      return;
    }
    if (e.key === "Tab") {
      const focusables = Array.from(
        panel.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")
      ).filter(el => !el.disabled && !el.hidden);
      if (focusables.length < 2) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function openHelpPanel() {
    const panel = byId("iphoneHelpPanel");
    if (!panel) return;
    helpPanelOpener = document.activeElement;
    panel.hidden = false;
    const trigger = byId("openIphoneHelp");
    if (trigger) trigger.setAttribute("aria-expanded", "true");
    const closeBtn = byId("iphoneHelpClose");
    (closeBtn || panel.querySelector("button"))?.focus();
    document.addEventListener("keydown", handleHelpPanelKeydown);
  }

  function closeHelpPanel() {
    const panel = byId("iphoneHelpPanel");
    if (!panel) return;
    panel.hidden = true;
    document.removeEventListener("keydown", handleHelpPanelKeydown);
    const trigger = byId("openIphoneHelp");
    if (trigger) trigger.setAttribute("aria-expanded", "false");
    helpPanelOpener?.focus?.();
    helpPanelOpener = null;
  }

  function currentServiceWorkerControl() {
    const controller = navigator.serviceWorker?.controller;
    if (!controller?.scriptURL) return "No active controller";
    try {
      return `Controlled by ${new URL(controller.scriptURL).pathname}`;
    } catch {
      return `Controlled by ${controller.scriptURL}`;
    }
  }

  function manifestIssue(details) {
    if (!details) return null;
    return details.issue;
  }

  function previousInstallDetected() {
    return appInstalledSeen || localStorage.getItem("sof_moons_install_result") === "accepted";
  }

  function installState() {
    const issue = manifestIssue(manifestDetails);
    const previousInstall = previousInstallDetected();

    if (standalone()) {
      return {
        key: "standalone",
        label: "App Installed",
        note: "13 Moons is already running in standalone mode on this device.",
        action: "none",
        disabled: true,
        status: "App Installed — running in standalone mode."
      };
    }

    if (ios()) {
      return {
        key: inApp() ? "ios-in-app" : "ios-safari",
        label: "Open in Safari and use Add to Home Screen",
        note: inApp()
          ? "This page is inside an in-app browser. Open it in Safari first, then use Share → Add to Home Screen."
          : "Safari does not show the Android install prompt. Use Share → Add to Home Screen.",
        action: "ios-help",
        disabled: false,
        status: inApp()
          ? "To install 13 Moons on iPhone, open this page in Safari first."
          : "Use Safari Share → Add to Home Screen."
      };
    }

    if (promptEvent) {
      return {
        key: "ready",
        label: "Install 13 Moons",
        note: "Installation is ready in this browser. Local logs and settings stay on this device.",
        action: "prompt",
        disabled: false,
        status: "Installation is ready. Press Install 13 Moons."
      };
    }

    if (!("serviceWorker" in navigator)) {
      return {
        key: "unsupported-service-worker",
        label: "Installation unavailable in this browser",
        note: "This browser does not support the service worker required for installation.",
        action: "settings-help",
        disabled: false,
        status: "Installation is unavailable in this browser."
      };
    }

    if (issue) {
      return {
        key: "manifest-issue",
        label: "Installation unavailable in this browser",
        note: `Installation is unavailable because ${issue}.`,
        action: "settings-help",
        disabled: false,
        status: "Installation is unavailable in this browser."
      };
    }

    if (!supportsInstallPrompt()) {
      return {
        key: "unsupported-prompt",
        label: "Installation unavailable in this browser",
        note: "This browser does not expose the install prompt. Use Android Chrome or Safari on iPhone/iPad.",
        action: "settings-help",
        disabled: false,
        status: "Installation is unavailable in this browser."
      };
    }

    return {
      key: "not-ready",
      label: "Installation unavailable in this browser",
      note: previousInstall
        ? "The install prompt is not available yet. Chrome still remembers an earlier 13 Moons install on this device, so reopen this page in Chrome and use Chrome menu → Install app/Add to Home screen if the prompt does not return."
        : "The install prompt is not available yet. Let the page finish loading, confirm the service worker is active, or use Chrome menu → Install app/Add to Home screen.",
      action: "settings-help",
      disabled: false,
      status: previousInstall
        ? "Chrome is re-checking install availability after a previous installation."
        : "Installation is not available yet."
    };
  }

  function updateDeviceStatus() {
    setText("appVersion", APP_VERSION);
    setText("serviceWorkerVersion", SERVICE_WORKER_BUILD);
    setText("cssRelease", new URL(cssUrl()).searchParams.get("v") || CSS_RELEASE);
    setText("pageBuild", PAGE_BUILD);
    setText(
      "deploymentCommit",
      DEPLOYMENT_COMMIT === "not-embedded" ? "Not embedded in this build" : DEPLOYMENT_COMMIT
    );
    setText("installedStatus", installUiState?.label || "Checking…");
    setText("standaloneStatus", browserMode());
    setText("networkStatus", navigator.onLine ? "Online" : "Offline");
    setText("savedRecordCount", String(window.MoonsStorage?.recordCount() || 0));
    setText("lastUpdateDate", localStorage.getItem("sof_moons_last_update") || "Not recorded");
    setText("beforeInstallPromptStatus", promptEvent ? "Captured" : "Not captured");
    setText("appInstalledEventStatus", appInstalledSeen ? "Seen" : "Not seen");
    document.documentElement.classList.toggle("is-standalone", standalone());

    const refreshButton = byId("refreshAppFiles");
    if (refreshButton) {
      refreshButton.disabled = !navigator.onLine;
      refreshButton.title = navigator.onLine
        ? ""
        : window.MoonsPwaRefresh.offlineMessage;
    }

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

  async function refreshDiagnostics() {
    const manifest = manifestDetails;
    let registrations = [];
    if (navigator.serviceWorker?.getRegistrations) {
      try {
        registrations = await navigator.serviceWorker.getRegistrations();
      } catch {}
    }
    const scope = resolveScope();
    const matchingRegistrations = registrations.filter(reg => reg.scope === scope);

    setText("serviceWorkerControl", currentServiceWorkerControl());
    setText("serviceWorkerScope", registration?.scope || matchingRegistrations[0]?.scope || scope);
    setText("serviceWorkerRegistrations", String(matchingRegistrations.length));
    setText("manifestId", manifest?.id || "Unavailable");
    setText("manifestStartUrl", manifest?.start_url || "Unavailable");
    setText("manifestScope", manifest?.scope || "Unavailable");
    setText("manifestDisplay", manifest?.display || "Unavailable");
    updateDeviceStatus();
  }

  async function loadManifest() {
    try {
      const response = await fetch(manifestUrl(), { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`.trim());
      const manifest = await response.json();
      const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
      const screenshots = Array.isArray(manifest.screenshots) ? manifest.screenshots : [];
      const issues = [];
      if (manifest.id !== "./moons.html") issues.push(`manifest ID is ${manifest.id || "missing"}`);
      if (manifest.start_url !== "./moons.html?source=installed") issues.push("manifest start_url is not the expected installed entry");
      if (manifest.scope !== "./") issues.push("manifest scope is not the expected site scope");
      if (manifest.display !== "standalone") issues.push(`manifest display is ${manifest.display || "missing"}`);
      if (!icons.some(icon => icon.sizes === "192x192")) issues.push("the 192×192 icon is missing");
      if (!icons.some(icon => icon.sizes === "512x512" && /any/.test(icon.purpose || "any"))) issues.push("the 512×512 icon is missing");
      if (!icons.some(icon => icon.sizes === "512x512" && /maskable/.test(icon.purpose || ""))) issues.push("the maskable icon is missing");
      if (!screenshots.length) issues.push("manifest screenshots are missing");

      manifestDetails = {
        id: manifest.id || "Unavailable",
        start_url: manifest.start_url || "Unavailable",
        scope: manifest.scope || "Unavailable",
        display: manifest.display || "Unavailable",
        resolvedStartUrl: manifest.start_url ? new URL(manifest.start_url, document.baseURI).toString() : null,
        issue: issues[0] || null
      };
    } catch (error) {
      manifestDetails = {
        id: "Unavailable",
        start_url: "Unavailable",
        scope: "Unavailable",
        display: "Unavailable",
        resolvedStartUrl: null,
        issue: `the manifest could not be loaded (${error.message})`
      };
    }
    updateInstallUI();
    await refreshDiagnostics();
  }

  function updateInstallUI() {
    const button = byId("installApp");
    installUiState = installState();

    if (button) {
      button.hidden = false;
      button.disabled = installUiState.disabled;
      button.textContent = installUiState.label;
      button.dataset.installState = installUiState.key;
    }

    const shortcut = byId("installAppShortcut");
    if (shortcut) {
      shortcut.hidden = false;
      shortcut.disabled = installUiState.disabled;
      shortcut.textContent = shortcutLabel(installUiState);
      shortcut.dataset.installState = installUiState.key;
    }

    setText("installStateNote", installUiState.note);
    setVisible("iosInstallHelp", ios());
    setVisible("inAppBrowserWarning", ios() && inApp());
    status(installUiState.status);
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
      updateInstallUI();
      return;
    }
    try {
      registration = await navigator.serviceWorker.register(
        new URL("service-worker.js", document.baseURI),
        { scope: new URL(APP_SCOPE, document.baseURI).pathname }
      );
      watch(registration);
      await refreshDiagnostics();
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
    appInstalledSeen = choice.outcome === "accepted" || appInstalledSeen;
    status(choice.outcome === "accepted"
      ? "Installation accepted. 13 Moons is being added."
      : "Installation dismissed. You can retry from the browser menu.");
    updateInstallUI();
  }

  async function onInstallAction() {
    switch (installUiState?.action) {
      case "prompt":
        await install();
        return;
      case "ios-help":
        scrollToIosHelp();
        status(installUiState.note);
        return;
      case "settings-help":
        scrollToInstallHelp();
        status(installUiState.note);
        return;
      default:
        status(installUiState?.note || "Installation state unavailable.");
    }
  }

  async function onShortcutAction() {
    if (installUiState?.action === "ios-help") {
      openHelpPanel();
      return;
    }
    await onInstallAction();
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
    const replacement = await window.MoonsPwaRefresh.refreshAppFiles({
      cachePrefix: CACHE_PREFIX,
      currentCoreCache: `${CACHE_PREFIX}core-${APP_VERSION}`,
      expectedVersion: APP_VERSION,
      expectedBuild: SERVICE_WORKER_BUILD,
      status,
      onRegistered: reg => watch(reg)
    });
    registration = replacement || registration;
    const actions = byId("refreshRecoveryActions");
    if (actions) actions.hidden = Boolean(replacement);
    await refreshDiagnostics();
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
        const result = window.MoonsStorage.importData(data, mode);
        status(`Import complete: ${result.imported} imported, ${result.merged} merged, ${result.skipped} skipped, ${result.conflicts} conflicting records. A rollback backup was created.`);
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
    byId("installApp")?.addEventListener("click", onInstallAction);
    byId("installAppShortcut")?.addEventListener("click", onShortcutAction);
    byId("openIphoneHelp")?.addEventListener("click", openHelpPanel);
    byId("iphoneHelpClose")?.addEventListener("click", closeHelpPanel);
    byId("iphoneHelpBackdrop")?.addEventListener("click", closeHelpPanel);
    byId("iphoneHelpMoreSettings")?.addEventListener("click", () => {
      closeHelpPanel();
      settingsJump()?.click?.();
      setTimeout(() => {
        byId("installApp")?.scrollIntoView?.({ behavior: "smooth", block: "center" });
        byId("installTitle")?.focus?.();
      }, 80);
    });
    byId("checkForUpdates")?.addEventListener("click", async () => {
      await registration?.update();
      status(registration?.waiting ? "Update available." : "13 Moons is up to date.");
      await refreshDiagnostics();
    });
    byId("updateApp")?.addEventListener("click", applyUpdate);
    byId("refreshAppFiles")?.addEventListener("click", refreshFiles);
    byId("retryRefreshAppFiles")?.addEventListener("click", refreshFiles);
    byId("cancelRefreshAppFiles")?.addEventListener("click", () => {
      const actions = byId("refreshRecoveryActions");
      if (actions) actions.hidden = true;
      status("App file refresh cancelled. Your previous recovery files remain available.");
    });
    bindStorageControls();
    addEventListener("beforeinstallprompt", event => {
      event.preventDefault();
      promptEvent = event;
      updateInstallUI();
    });
    addEventListener("appinstalled", () => {
      promptEvent = null;
      appInstalledSeen = true;
      localStorage.setItem("sof_moons_install_result", "accepted");
      updateInstallUI();
    });
    addEventListener("online", () => {
      updateDeviceStatus();
      refreshDiagnostics();
    });
    addEventListener("offline", updateDeviceStatus);
    navigator.serviceWorker?.addEventListener("controllerchange", async () => {
      await refreshDiagnostics();
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
    register().then(async () => {
      await window.MoonsPwaRefresh.completePendingRefresh({
        cachePrefix: CACHE_PREFIX,
        currentCoreCache: `${CACHE_PREFIX}core-${APP_VERSION}`,
        expectedVersion: APP_VERSION,
        expectedBuild: SERVICE_WORKER_BUILD,
        status
      });
      await refreshDiagnostics();
    });
    loadManifest();
    updateInstallUI();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
