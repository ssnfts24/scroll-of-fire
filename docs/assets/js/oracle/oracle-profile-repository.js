(() => {
  "use strict";

  // oracle-profile-repository.js
  // Canonical profile-storage interface for Genesis Oracle 2.0, Daily Mirror,
  // Mirror Through My Seal, profile comparison, import/export, and sharing.
  // All other modules must use this interface — do not read localStorage directly.
  // GenesisOracleStorage may only be used internally here as a migration adapter.

  const STORAGE_KEY_V2 = "sofGenesisProfilesV2";
  const STORAGE_KEY_LEGACY = "sofGenesisProfiles";
  const STORAGE_KEY_LEGACY_IMPORTS = "sofGenesisLegacyImports";
  const SCHEMA_VERSION = 1;

  // Canonical state definition
  let _state = {
    status: "idle",        // "idle" | "loading" | "ready" | "empty" | "error"
    profiles: [],
    legacyProfiles: [],
    rejectedRecords: [],
    selectedProfileId: null,
    error: null            // null or { code, message, storageKey }
  };

  const _listeners = new Set();

  function _emit() {
    const snapshot = Object.freeze({
      ..._state,
      profiles: [..._state.profiles],
      legacyProfiles: [..._state.legacyProfiles]
    });
    _listeners.forEach(fn => { try { fn(snapshot); } catch { /* ignore */ } });
  }

  function _setState(patch) {
    _state = { ..._state, ...patch };
    _emit();
  }

  // Returns { ok: true, data: [...] } or { ok: false, error: { code, message, storageKey } }
  function _readRaw(key) {
    if (typeof localStorage === "undefined") {
      return { ok: false, error: { code: "STORAGE_UNAVAILABLE", message: "localStorage is not available.", storageKey: key } };
    }
    try {
      const raw = localStorage.getItem(key);
      const parsed = JSON.parse(raw || "[]");
      if (!Array.isArray(parsed)) {
        return { ok: false, error: { code: "INVALID_FORMAT", message: "Stored data is not an array.", storageKey: key } };
      }
      return { ok: true, data: parsed };
    } catch (err) {
      return { ok: false, error: { code: "PARSE_ERROR", message: err?.message || "Malformed JSON in storage.", storageKey: key } };
    }
  }

  // Returns { ok: true } or { ok: false, error: { code, message, storageKey } }
  function _writeRaw(key, data) {
    if (typeof localStorage === "undefined") {
      return { ok: false, error: { code: "STORAGE_UNAVAILABLE", message: "localStorage is not available.", storageKey: key } };
    }
    try {
      const serialised = JSON.stringify(data);
      localStorage.setItem(key, serialised);
      // Read-after-write verification
      if (localStorage.getItem(key) === null) {
        return { ok: false, error: { code: "WRITE_NOT_VERIFIED", message: "Write could not be verified.", storageKey: key } };
      }
      return { ok: true };
    } catch (err) {
      const code = err?.name === "QuotaExceededError" || err?.name === "NS_ERROR_DOM_QUOTA_REACHED"
        ? "QUOTA_EXCEEDED" : "WRITE_DENIED";
      return { ok: false, error: { code, message: err?.message || "Storage write failed.", storageKey: key } };
    }
  }

  // Deterministic fingerprint — no Math.random(), based on record content
  function _fingerprint(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(36);
  }

  function _legacyId(record) {
    // Stable ID derived from name + birthDate + birthTime (original fields)
    const name = record.name || record.input?.name || "";
    const date = record.birth || record.input?.birthDate || "";
    const time = record.birthTime || record.input?.birthTime || "";
    const fp = _fingerprint(`${name}|${date}|${time}`);
    return `legacy-${fp}`;
  }

  function _isV2Profile(record) {
    if (!record || typeof record !== "object") return false;
    if (!record.calendarVersion || !record.oracleVersion) return false;
    if (!record.createdAt || !record.input || !record.calculated) return false;
    return true;
  }

  function _isLegacyRecord(record) {
    if (!record || typeof record !== "object") return false;
    // Legacy records lack calendarVersion / oracleVersion with the 2.0 format
    if (record.legacyRecord) return true;
    if (!record.calendarVersion && !record.oracleVersion) return true;
    if (!record.calendarVersion?.startsWith("pattern-calendar/") &&
        !record.oracleVersion?.startsWith("genesis-oracle/2.")) return true;
    return false;
  }

  function _toLegacyWrapper(record) {
    const id = record.id || _legacyId(record);
    return {
      id,
      legacyRecord: true,
      schemaVersion: SCHEMA_VERSION,
      calendarVersion: record.calendarVersion || "legacy/genesis-oracle/pre-2.0",
      oracleVersion: record.oracleVersion || "legacy/genesis-oracle/pre-2.0",
      createdAt: record.createdAt || new Date().toISOString(),
      input: {
        name: record.name || record.input?.name || "Unnamed",
        birthDate: record.birth || record.input?.birthDate || "",
        birthTime: record.birthTime || record.input?.birthTime || "",
        timezone: record.timezone || record.input?.timezone || "UTC"
      },
      calculated: record.calculated || record,
      interpretation: record.interpretation || {
        note: "Legacy record — recalculate with Oracle 2.0 for current deterministic output."
      }
    };
  }

  function _generateId() {
    return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  // ─── Public async API ────────────────────────────────────────────────────────

  async function initialize() {
    if (_state.status === "loading") return;
    _setState({ status: "loading", error: null });

    const v2Result = _readRaw(STORAGE_KEY_V2);
    if (!v2Result.ok) {
      _setState({ status: "error", error: v2Result.error });
      return;
    }

    const legacyResult = _readRaw(STORAGE_KEY_LEGACY);
    const legacyImportsResult = _readRaw(STORAGE_KEY_LEGACY_IMPORTS);

    const profiles = [];
    const legacyProfiles = [];
    const rejectedRecords = [];

    v2Result.data.forEach((record, i) => {
      if (_isV2Profile(record)) {
        if (!record.id) record.id = _generateId();
        profiles.push(record);
      } else if (_isLegacyRecord(record)) {
        legacyProfiles.push(_toLegacyWrapper(record));
      } else {
        rejectedRecords.push({ index: i, reason: "invalid-v2-structure", record });
      }
    });

    const legacyRaw = legacyResult.ok ? legacyResult.data : [];
    legacyRaw.forEach((record, i) => {
      if (!record || typeof record !== "object") {
        rejectedRecords.push({ index: i, reason: "invalid-legacy-structure", record });
        return;
      }
      legacyProfiles.push(_toLegacyWrapper(record));
    });

    // Merge in persisted legacy imports (survive reload)
    const legacyImportsRaw = legacyImportsResult.ok ? legacyImportsResult.data : [];
    legacyImportsRaw.forEach(record => {
      if (record && typeof record === "object") {
        legacyProfiles.push(_toLegacyWrapper(record));
      }
    });

    // Deduplicate legacy by id
    const seen = new Set();
    const dedupedLegacy = legacyProfiles.filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

    const hasAny = profiles.length > 0 || dedupedLegacy.length > 0;
    _setState({
      status: hasAny ? "ready" : "empty",
      profiles: profiles.slice(0, 80),
      legacyProfiles: dedupedLegacy.slice(0, 80),
      rejectedRecords,
      error: null
    });
  }

  function listProfiles() {
    return [..._state.profiles];
  }

  function listLegacyProfiles() {
    return [..._state.legacyProfiles];
  }

  function getProfile(id) {
    return _state.profiles.find(p => p.id === id) ||
           _state.legacyProfiles.find(p => p.id === id) ||
           null;
  }

  function saveProfile(result) {
    const profile = {
      id: _generateId(),
      schemaVersion: SCHEMA_VERSION,
      calendarVersion: result.calendarVersion,
      oracleVersion: result.oracleVersion,
      createdAt: new Date().toISOString(),
      input: result.input,
      calculated: {
        patternPosition: result.patternPosition,
        coreSignature: result.coreSignature,
        nameSignature: result.nameSignature,
        birthTimeLayer: result.birthTimeLayer,
        relationships: result.relationships
      },
      interpretation: {
        reading: result.reading,
        methods: result.methods
      }
    };

    const updated = [profile, ..._state.profiles].slice(0, 80);
    const writeResult = _writeRaw(STORAGE_KEY_V2, updated);
    if (!writeResult.ok) {
      _setState({ status: "error", error: writeResult.error });
      throw new Error(writeResult.error.message);
    }
    _setState({
      status: "ready",
      profiles: updated,
      selectedProfileId: _state.selectedProfileId
    });
    return profile;
  }

  function updateProfile(profile) {
    const updated = _state.profiles.map(p => p.id === profile.id ? { ...p, ...profile } : p);
    _writeRaw(STORAGE_KEY_V2, updated);
    _setState({ profiles: updated });
  }

  function deleteProfile(id) {
    const updated = _state.profiles.filter(p => p.id !== id);
    _writeRaw(STORAGE_KEY_V2, updated);
    const wasSelected = _state.selectedProfileId === id;
    _setState({
      profiles: updated,
      status: (updated.length > 0 || _state.legacyProfiles.length > 0) ? "ready" : "empty",
      selectedProfileId: wasSelected ? null : _state.selectedProfileId
    });
  }

  function importProfiles(payload, options = {}) {
    const { merge = true } = options;
    let parsed;
    if (typeof payload === "string") {
      parsed = JSON.parse(payload);
    } else {
      parsed = payload;
    }
    if (!Array.isArray(parsed)) {
      throw new Error("Imported JSON must be an array of profiles.");
    }

    const valid = [];
    const legacy = [];
    parsed.forEach(record => {
      if (_isV2Profile(record)) {
        if (!record.id) record.id = _generateId();
        valid.push(record);
      } else if (_isLegacyRecord(record)) {
        legacy.push(_toLegacyWrapper(record));
      }
    });

    if (!valid.length && !legacy.length) {
      throw new Error("No valid Oracle profiles found in import.");
    }

    const base = merge ? _state.profiles : [];
    const merged = [...valid, ...base].slice(0, 80);
    const writeResult = _writeRaw(STORAGE_KEY_V2, merged);
    if (!writeResult.ok) {
      _setState({ status: "error", error: writeResult.error });
      throw new Error(writeResult.error.message);
    }

    const legacySeen = new Set(_state.legacyProfiles.map(p => p.id));
    const newLegacy = legacy.filter(p => !legacySeen.has(p.id));
    const updatedLegacy = [...newLegacy, ..._state.legacyProfiles].slice(0, 80);

    // Persist imported legacy records so they survive reload
    if (newLegacy.length > 0) {
      const existingImportsResult = _readRaw(STORAGE_KEY_LEGACY_IMPORTS);
      const existingImports = existingImportsResult.ok ? existingImportsResult.data : [];
      const existingIds = new Set(existingImports.map(r => r.id));
      const toAdd = newLegacy.filter(p => !existingIds.has(p.id));
      _writeRaw(STORAGE_KEY_LEGACY_IMPORTS, [...toAdd, ...existingImports].slice(0, 80));
    }

    _setState({
      status: "ready",
      profiles: merged,
      legacyProfiles: updatedLegacy
    });

    return { imported: valid.length, legacyImported: legacy.length };
  }

  function exportProfile(id) {
    const profile = getProfile(id);
    if (!profile) throw new Error(`Profile ${id} not found.`);
    return JSON.stringify([profile], null, 2);
  }

  function exportProfiles() {
    return JSON.stringify([..._state.profiles], null, 2);
  }

  function findLegacyProfiles() {
    return [..._state.legacyProfiles];
  }

  function migrateLegacyProfile(id, options = {}) {
    const legacy = _state.legacyProfiles.find(p => p.id === id);
    if (!legacy) throw new Error(`Legacy profile ${id} not found.`);
    if (!globalThis.GenesisOracleEngine) throw new Error("Oracle engine not available.");

    const result = globalThis.GenesisOracleEngine.run({
      name: legacy.input?.name || "",
      birthDate: legacy.input?.birthDate || "",
      birthTime: legacy.input?.birthTime || "",
      timeZone: legacy.input?.timezone || "UTC",
      boundaryMode: "midnight",
      sunsetTime: "18:00"
    });

    const migrated = saveProfile(result);
    migrated.migratedFromLegacyId = id;
    migrated.originalLegacyRecord = options.preserveOriginal !== false ? {
      id: legacy.id,
      input: legacy.input,
      calculated: legacy.calculated,
      calendarVersion: legacy.calendarVersion,
      oracleVersion: legacy.oracleVersion,
      createdAt: legacy.createdAt
    } : undefined;
    migrated.migrationTimestamp = new Date().toISOString();

    // Update persisted entry to include migration metadata
    updateProfile(migrated);

    return migrated;
  }

  function selectProfile(id) {
    _setState({ selectedProfileId: id });
  }

  function getSelectedProfile() {
    if (!_state.selectedProfileId) return null;
    return getProfile(_state.selectedProfileId);
  }

  function subscribe(listener) {
    _listeners.add(listener);
    return () => _listeners.delete(listener);
  }

  function getStatus() {
    return Object.freeze({
      ..._state,
      profiles: [..._state.profiles],
      legacyProfiles: [..._state.legacyProfiles]
    });
  }

  globalThis.OracleProfileRepository = Object.freeze({
    initialize,
    listProfiles,
    listLegacyProfiles,
    getProfile,
    saveProfile,
    updateProfile,
    deleteProfile,
    importProfiles,
    exportProfile,
    exportProfiles,
    findLegacyProfiles,
    migrateLegacyProfile,
    selectProfile,
    getSelectedProfile,
    subscribe,
    getStatus,
    STORAGE_KEY_V2,
    STORAGE_KEY_LEGACY,
    STORAGE_KEY_LEGACY_IMPORTS,
    SCHEMA_VERSION
  });
})();
