(() => {
  "use strict";

  const { APP_VERSION } = window.SOF_13_MOONS;
  const ROLLBACK_KEY = "sof_moons_import_rollback";
  const SETTINGS_KEYS = new Set([
    "sof_moons_tz_v2",
    "sof_moons_boundary_v1",
    "sof_moons_sunset_v1",
    "sof_moons_location_v1",
    "sof_moons_last_tab_v1",
    "sof_moons_install_dismissed_v1"
  ]);
  const LOG_KEYS = new Set(["sof_moon_logs_v2", "sof_moon_logs_v3"]);
  const owned = key => /^(sof_moon_|sof_moons_)/.test(key) && key !== ROLLBACK_KEY;

  function parse(value, fallback) {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function readOwned() {
    const data = {};
    try {
      Object.keys(localStorage).filter(owned).forEach(key => {
        data[key] = localStorage.getItem(key);
      });
    } catch {}
    return data;
  }

  function classify(data = readOwned()) {
    const settings = {};
    const logs = [];
    const witnessEntries = [];
    const mirrorEntries = [];
    const savedPatterns = [];

    Object.entries(data).forEach(([key, value]) => {
      if (SETTINGS_KEYS.has(key)) settings[key] = value;
      if (LOG_KEYS.has(key)) {
        const entries = parse(value, []);
        if (Array.isArray(entries)) {
          entries.forEach(entry => {
            logs.push(entry);
            witnessEntries.push(entry);
          });
        }
      } else if (/mirror/i.test(key)) {
        const entries = parse(value, []);
        mirrorEntries.push(...(Array.isArray(entries) ? entries : [entries]));
      } else if (/pattern/i.test(key)) {
        const entries = parse(value, []);
        savedPatterns.push(...(Array.isArray(entries) ? entries : [entries]));
      }
    });

    return { settings, logs, witnessEntries, mirrorEntries, savedPatterns };
  }

  function buildExport() {
    const records = readOwned();
    return {
      exportSchemaVersion: 1,
      dataSchemaVersion: window.MoonsMigrations?.DATA_SCHEMA_VERSION || 1,
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      ...classify(records),
      records
    };
  }

  function download(data, filename) {
    const url = URL.createObjectURL(new Blob(
      [JSON.stringify(data, null, 2)],
      { type: "application/json" }
    ));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function validate(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("The backup must contain a JSON object.");
    }
    if (data.exportSchemaVersion !== 1 || !data.records ||
        typeof data.records !== "object" || Array.isArray(data.records)) {
      throw new Error("This is not a supported 13 Moons backup.");
    }
    const invalid = Object.keys(data.records).find(key => !owned(key));
    if (invalid) throw new Error(`Backup contains an unsupported key: ${invalid}`);
    Object.values(data.records).forEach(value => {
      if (value !== null && typeof value !== "string") {
        throw new Error("Backup records are malformed.");
      }
    });
    return classify(data.records);
  }

  function stable(value) {
    if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
    if (value && typeof value === "object") {
      return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
  }

  function identity(entry) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const field = ["id", "uuid", "saved", "createdAt", "timestamp"]
      .find(key => entry[key] !== undefined && entry[key] !== null);
    return field ? `${field}:${stable(entry[field])}` : null;
  }

  function mergeArrays(existing, incoming, result) {
    const merged = [...existing];
    incoming.forEach(entry => {
      const exact = stable(entry);
      if (merged.some(current => stable(current) === exact)) {
        result.skipped += 1;
        return;
      }
      const marker = identity(entry);
      if (marker && merged.some(current => identity(current) === marker)) {
        result.conflicts += 1;
        return;
      }
      merged.push(entry);
      result.merged += 1;
    });
    return merged;
  }

  function mergeObjects(existing, incoming, result) {
    const merged = { ...existing };
    Object.entries(incoming).forEach(([key, value]) => {
      if (!(key in merged)) {
        merged[key] = value;
        result.merged += 1;
      } else if (stable(merged[key]) === stable(value)) {
        result.skipped += 1;
      } else {
        result.conflicts += 1;
      }
    });
    return merged;
  }

  function importData(data, mode) {
    validate(data);
    if (!["merge", "replace"].includes(mode)) throw new Error("Choose Merge or Replace.");
    const before = readOwned();
    const result = { imported: 0, merged: 0, skipped: 0, conflicts: 0 };
    localStorage.setItem(ROLLBACK_KEY, JSON.stringify({
      createdAt: new Date().toISOString(),
      records: before
    }));
    if (mode === "replace") Object.keys(before).forEach(key => localStorage.removeItem(key));

    Object.entries(data.records).forEach(([key, value]) => {
      if (value === null) {
        result.skipped += 1;
        return;
      }
      const currentValue = localStorage.getItem(key);
      if (mode === "replace" || currentValue === null) {
        localStorage.setItem(key, value);
        result.imported += 1;
        return;
      }
      if (SETTINGS_KEYS.has(key)) {
        result.skipped += 1;
        return;
      }

      const existing = parse(currentValue, undefined);
      const incoming = parse(value, undefined);
      if (Array.isArray(existing) && Array.isArray(incoming)) {
        localStorage.setItem(key, JSON.stringify(mergeArrays(existing, incoming, result)));
      } else if (existing && incoming &&
          typeof existing === "object" && typeof incoming === "object" &&
          !Array.isArray(existing) && !Array.isArray(incoming)) {
        localStorage.setItem(key, JSON.stringify(mergeObjects(existing, incoming, result)));
      } else if (stable(existing) === stable(incoming)) {
        result.skipped += 1;
      } else {
        result.conflicts += 1;
      }
    });
    return result;
  }

  function recordCount() {
    return classify().logs.length;
  }

  function resetSettings() {
    SETTINGS_KEYS.forEach(key => localStorage.removeItem(key));
  }

  function eraseAll() {
    Object.keys(readOwned()).forEach(key => localStorage.removeItem(key));
    localStorage.removeItem(ROLLBACK_KEY);
  }

  window.MoonsStorage = Object.freeze({
    APP_VERSION,
    buildExport,
    download,
    importData,
    recordCount,
    resetSettings,
    eraseAll
  });
})();
