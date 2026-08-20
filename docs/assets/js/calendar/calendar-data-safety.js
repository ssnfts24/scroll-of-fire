(() => {
  "use strict";

  const VERSION = "calendar-data-safety/1.0.0-b731";
  const FORMAT = "sof-calendar-backup";
  const SCHEMA = 1;
  const LAST_EXPORT_KEY = "sof.calendar-safety.last-export.v1";
  const SNAPSHOT_KEY = "sof.calendar-safety.settings-snapshot.v1";
  const SNAPSHOT_AT_KEY = "sof.calendar-safety.settings-snapshot-at.v1";
  const MAX_LOCAL_VALUE_BYTES = 2 * 1024 * 1024;

  const PREFIXES = Object.freeze([
    "sof_moon_",
    "sof_moons_",
    "sof.calendar-workbench.",
    "sof.observatory.",
    "sof.question-quests.",
    "sof.living-time.",
    "sof.livingtime.",
    "sof-unit-preferences",
    "sof:environment",
    "sof.environment",
    "lts-"
  ]);

  function ownedKey(key) {
    const text = String(key || "");
    if (!text || text === SNAPSHOT_KEY || text === SNAPSHOT_AT_KEY) return false;
    return PREFIXES.some(prefix => text.startsWith(prefix));
  }

  function readLocalStorage() {
    const records = {};
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!ownedKey(key)) continue;
        const value = localStorage.getItem(key);
        if (typeof value !== "string") continue;
        if (new Blob([value]).size > MAX_LOCAL_VALUE_BYTES) continue;
        records[key] = value;
      }
    } catch (_) {}
    return records;
  }

  async function repository() {
    if (globalThis.CodexLifeAtlasRuntime?.ready) {
      try { return await globalThis.CodexLifeAtlasRuntime.ready; } catch (_) {}
    }
    const Repo = globalThis.CodexLifeAtlasRepository;
    if (Repo?.createPersistentRepository) {
      try { return Repo.createPersistentRepository(); } catch (_) {}
    }
    return null;
  }

  async function lifeAtlasRecords() {
    const repo = await repository();
    if (!repo) return [];
    try {
      if (typeof repo.exportRecords === "function") return await repo.exportRecords({});
      if (typeof repo.all === "function") return await repo.all();
    } catch (_) {}
    return [];
  }

  async function storageStatus() {
    const status = {
      persisted: null,
      quota: null,
      usage: null,
      indexedDb: typeof indexedDB !== "undefined"
    };
    try {
      if (navigator.storage?.persisted) status.persisted = await navigator.storage.persisted();
      if (navigator.storage?.estimate) {
        const estimate = await navigator.storage.estimate();
        status.quota = Number(estimate?.quota) || null;
        status.usage = Number(estimate?.usage) || null;
      }
    } catch (_) {}
    return status;
  }

  async function buildBackup() {
    const localStorageRecords = readLocalStorage();
    const lifeAtlas = await lifeAtlasRecords();
    const storage = await storageStatus();
    return {
      format: FORMAT,
      schemaVersion: SCHEMA,
      exportedAt: new Date().toISOString(),
      app: "Scroll of Fire — Living Calendar",
      origin: location.origin,
      page: location.pathname,
      storage,
      counts: {
        localStorageRecords: Object.keys(localStorageRecords).length,
        lifeAtlasRecords: lifeAtlas.length
      },
      localStorageRecords,
      lifeAtlasRecords: lifeAtlas
    };
  }

  function download(data, filename = null) {
    const stamp = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || `codex-living-calendar-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    try { localStorage.setItem(LAST_EXPORT_KEY, new Date().toISOString()); } catch (_) {}
    emit("export", { bytes: blob.size, counts: data.counts || null });
    return blob.size;
  }

  function validate(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Backup must be a JSON object.");
    if (data.format !== FORMAT || Number(data.schemaVersion) !== SCHEMA) throw new Error("This is not a supported Living Calendar backup.");
    if (!data.localStorageRecords || typeof data.localStorageRecords !== "object" || Array.isArray(data.localStorageRecords)) {
      throw new Error("Backup local settings are malformed.");
    }
    if (!Array.isArray(data.lifeAtlasRecords)) throw new Error("Backup Life Atlas records are malformed.");
    const invalid = Object.keys(data.localStorageRecords).find(key => !ownedKey(key));
    if (invalid) throw new Error(`Backup contains unsupported calendar storage key: ${invalid}`);
    return true;
  }

  function applyLocal(records, mode) {
    const imported = { localImported: 0, localSkipped: 0 };
    if (mode === "replace") {
      try {
        const keys = [];
        for (let i = 0; i < localStorage.length; i += 1) {
          const key = localStorage.key(i);
          if (ownedKey(key)) keys.push(key);
        }
        keys.forEach(key => localStorage.removeItem(key));
      } catch (_) {}
    }
    Object.entries(records).forEach(([key, value]) => {
      if (!ownedKey(key) || typeof value !== "string") return;
      try {
        if (mode === "merge" && localStorage.getItem(key) != null) {
          imported.localSkipped += 1;
          return;
        }
        localStorage.setItem(key, value);
        imported.localImported += 1;
      } catch (_) {}
    });
    return imported;
  }

  async function importBackup(data, { mode = "merge" } = {}) {
    validate(data);
    if (!["merge", "replace"].includes(mode)) throw new Error("Import mode must be merge or replace.");

    // Keep a settings-only safety snapshot before any mutation.
    saveSettingsSnapshot();

    const localResult = applyLocal(data.localStorageRecords, mode);
    const repo = await repository();
    let lifeImported = 0;
    let lifeRejected = 0;
    if (repo) {
      if (mode === "replace" && typeof repo.clear === "function") await repo.clear();
      if (typeof repo.importRecords === "function") {
        const result = await repo.importRecords(data.lifeAtlasRecords);
        lifeImported = result?.imported?.length || 0;
        lifeRejected = result?.rejected?.length || 0;
      } else if (typeof repo.put === "function") {
        for (const record of data.lifeAtlasRecords) {
          try { await repo.put(record); lifeImported += 1; } catch (_) { lifeRejected += 1; }
        }
      }
    }
    const result = { ...localResult, lifeImported, lifeRejected, mode };
    emit("import", result);
    return result;
  }

  function saveSettingsSnapshot() {
    try {
      const records = readLocalStorage();
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ schemaVersion: 1, records }));
      localStorage.setItem(SNAPSHOT_AT_KEY, new Date().toISOString());
      return Object.keys(records).length;
    } catch (_) {
      return 0;
    }
  }

  function restoreSettingsSnapshot() {
    try {
      const snapshot = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || "null");
      if (!snapshot?.records || typeof snapshot.records !== "object") return { restored: 0 };
      const result = applyLocal(snapshot.records, "replace");
      emit("snapshot-restore", result);
      return { restored: result.localImported };
    } catch (_) {
      return { restored: 0 };
    }
  }

  async function requestPersistence() {
    if (!navigator.storage?.persist) return { supported: false, persisted: false };
    let already = false;
    try { already = !!(await navigator.storage.persisted?.()); } catch (_) {}
    if (already) return { supported: true, persisted: true, already: true };
    try {
      const persisted = !!(await navigator.storage.persist());
      emit("persistence", { persisted });
      return { supported: true, persisted, already: false };
    } catch (_) {
      return { supported: true, persisted: false, already: false };
    }
  }

  async function diagnostics() {
    const storage = await storageStatus();
    const repo = await repository();
    let lifeAtlasCount = 0;
    try { lifeAtlasCount = repo?.count ? await repo.count() : 0; } catch (_) {}
    let lastExport = null;
    let snapshotAt = null;
    try {
      lastExport = localStorage.getItem(LAST_EXPORT_KEY);
      snapshotAt = localStorage.getItem(SNAPSHOT_AT_KEY);
    } catch (_) {}
    return {
      version: VERSION,
      storage,
      lifeAtlasCount,
      localRecordCount: Object.keys(readLocalStorage()).length,
      lastExport,
      snapshotAt
    };
  }

  function emit(action, detail = {}) {
    try {
      window.dispatchEvent(new CustomEvent("sof:calendar-safety", { detail: { action, ...detail } }));
    } catch (_) {}
  }

  function bindControls(root = document) {
    root.querySelectorAll("[data-calendar-backup-export]").forEach(button => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";
      button.addEventListener("click", async () => {
        button.disabled = true;
        try { download(await buildBackup()); } finally { button.disabled = false; refreshSafetyUi(root); }
      });
    });
    root.querySelectorAll("[data-calendar-backup-import]").forEach(button => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";
      button.addEventListener("click", () => {
        const input = root.querySelector("[data-calendar-backup-file]") || document.querySelector("[data-calendar-backup-file]");
        input?.click();
      });
    });
    root.querySelectorAll("[data-calendar-backup-file]").forEach(input => {
      if (input.dataset.bound === "true") return;
      input.dataset.bound = "true";
      input.addEventListener("change", async event => {
        const file = event.target.files?.[0];
        if (!file) return;
        const status = root.querySelector("[data-calendar-safety-status]") || document.querySelector("[data-calendar-safety-status]");
        try {
          const data = JSON.parse(await file.text());
          const mode = root.querySelector("[data-calendar-backup-mode]")?.value || document.querySelector("[data-calendar-backup-mode]")?.value || "merge";
          if (mode === "replace" && !confirm("Replace existing Living Calendar settings and Life Atlas records with this backup?")) return;
          const result = await importBackup(data, { mode });
          if (status) status.textContent = `Restored ${result.localImported} settings and ${result.lifeImported} Life Atlas records. Reload to apply all restored settings.`;
        } catch (error) {
          if (status) status.textContent = `Backup import failed: ${error.message}`;
        } finally {
          event.target.value = "";
          refreshSafetyUi(root);
        }
      });
    });
    root.querySelectorAll("[data-calendar-storage-persist]").forEach(button => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";
      button.addEventListener("click", async () => {
        const status = root.querySelector("[data-calendar-safety-status]") || document.querySelector("[data-calendar-safety-status]");
        const result = await requestPersistence();
        if (status) status.textContent = !result.supported
          ? "This browser does not expose persistent-storage protection. Download backups regularly."
          : result.persisted
            ? "Browser storage protection is enabled. Portable backup files are still recommended."
            : "The browser kept storage in best-effort mode. Download backups regularly.";
        refreshSafetyUi(root);
      });
    });
    root.querySelectorAll("[data-calendar-settings-restore]").forEach(button => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";
      button.addEventListener("click", () => {
        const result = restoreSettingsSnapshot();
        const status = root.querySelector("[data-calendar-safety-status]") || document.querySelector("[data-calendar-safety-status]");
        if (status) status.textContent = result.restored
          ? `Recovered ${result.restored} local calendar settings. Reload to apply them.`
          : "No local settings recovery snapshot is available.";
      });
    });
  }

  async function refreshSafetyUi(root = document) {
    const diag = await diagnostics();
    root.querySelectorAll("[data-calendar-safety-status]").forEach(node => {
      const storageLabel = diag.storage.persisted === true ? "Protected storage" : "Best-effort storage";
      const exportLabel = diag.lastExport ? ` · last backup ${new Date(diag.lastExport).toLocaleDateString()}` : " · no portable backup yet";
      node.textContent = `${storageLabel} · ${diag.lifeAtlasCount} Life Atlas records · ${diag.localRecordCount} calendar settings${exportLabel}`;
    });
    root.querySelectorAll("[data-calendar-safety-reminder]").forEach(node => {
      let due = diag.lifeAtlasCount > 0 || diag.localRecordCount > 3;
      if (diag.lastExport) {
        const age = Date.now() - Date.parse(diag.lastExport);
        due = due && (!Number.isFinite(age) || age > 14 * 86400000);
      }
      node.hidden = !due;
    });
  }

  function init() {
    saveSettingsSnapshot();
    bindControls(document);
    refreshSafetyUi(document);
    window.addEventListener("pagehide", saveSettingsSnapshot, { passive: true });
    window.addEventListener("sof:life-atlas-ready", () => refreshSafetyUi(document));
  }

  globalThis.SOFCalendarDataSafety = Object.freeze({
    VERSION,
    FORMAT,
    buildBackup,
    download,
    importBackup,
    validate,
    diagnostics,
    requestPersistence,
    saveSettingsSnapshot,
    restoreSettingsSnapshot,
    bindControls,
    refreshSafetyUi,
    init
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
