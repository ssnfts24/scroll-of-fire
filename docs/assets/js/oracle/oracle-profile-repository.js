(() => {
  "use strict";

  // oracle-profile-repository.js
  // Canonical profile-storage interface for Genesis Oracle 2.0, Daily Mirror,
  // Mirror Through My Seal, profile comparison, import/export, and sharing.
  // All other modules must use this interface — do not read localStorage directly.

  const STORAGE_KEY_V2 = "sofGenesisProfilesV2";
  const STORAGE_KEY_LEGACY = "sofGenesisProfiles";

  // Canonical state definition
  let _state = {
    status: "idle",        // "idle" | "loading" | "ready" | "empty" | "error"
    profiles: [],
    legacyProfiles: [],
    rejectedRecords: [],
    selectedProfileId: null,
    error: null
  };

  const _listeners = new Set();

  function _emit() {
    const snapshot = Object.freeze({ ..._state, profiles: [..._state.profiles], legacyProfiles: [..._state.legacyProfiles] });
    _listeners.forEach(fn => { try { fn(snapshot); } catch { /* ignore */ } });
  }

  function _setState(patch) {
    _state = { ..._state, ...patch };
    _emit();
  }

  function _readRaw(key) {
    try {
      const raw = (typeof localStorage !== "undefined") ? localStorage.getItem(key) : null;
      return JSON.parse(raw || "[]");
    } catch {
      return [];
    }
  }

  function _writeRaw(key, data) {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(key, JSON.stringify(data));
      }
    } catch {
      // Storage might be unavailable (private browsing, quota exceeded)
    }
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
    const id = record.id ||
      `legacy-${record.birth || record.name || Math.random().toString(36).slice(2)}`;
    return {
      id,
      legacyRecord: true,
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

    try {
      const rawV2 = _readRaw(STORAGE_KEY_V2);
      const rawLegacy = _readRaw(STORAGE_KEY_LEGACY);

      const profiles = [];
      const legacyProfiles = [];
      const rejectedRecords = [];

      rawV2.forEach((record, i) => {
        if (_isV2Profile(record)) {
          if (!record.id) record.id = _generateId();
          profiles.push(record);
        } else if (_isLegacyRecord(record)) {
          legacyProfiles.push(_toLegacyWrapper(record));
        } else {
          rejectedRecords.push({ index: i, reason: "invalid-v2-structure", record });
        }
      });

      rawLegacy.forEach((record, i) => {
        if (!record || typeof record !== "object") {
          rejectedRecords.push({ index: i, reason: "invalid-legacy-structure", record });
          return;
        }
        legacyProfiles.push(_toLegacyWrapper(record));
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
    } catch (err) {
      _setState({
        status: "error",
        error: err?.message || "Could not read saved profiles."
      });
    }
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
      calendarVersion: result.calendarVersion,
      oracleVersion: result.oracleVersion,
      createdAt: new Date().toISOString(),
      input: result.input,
      calculated: {
        patternPosition: result.patternPosition,
        coreSignature: result.coreSignature,
        nameSignature: result.nameSignature,
        relationships: result.relationships
      },
      interpretation: {
        reading: result.reading,
        methods: result.methods
      }
    };

    const updated = [profile, ..._state.profiles].slice(0, 80);
    _writeRaw(STORAGE_KEY_V2, updated);
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
    _writeRaw(STORAGE_KEY_V2, merged);

    const legacySeen = new Set(_state.legacyProfiles.map(p => p.id));
    const newLegacy = legacy.filter(p => !legacySeen.has(p.id));
    const updatedLegacy = [...newLegacy, ..._state.legacyProfiles].slice(0, 80);

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
    return Object.freeze({ ..._state, profiles: [..._state.profiles], legacyProfiles: [..._state.legacyProfiles] });
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
    STORAGE_KEY_LEGACY
  });
})();
