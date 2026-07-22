(() => {
  "use strict";

  const STORAGE_KEY = "sofGenesisProfilesV2";
  const LEGACY_KEY = "sofGenesisProfiles";

  function nowIso() {
    return new Date().toISOString();
  }

  function readRaw(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      return [];
    }
  }

  function validateProfile(profile) {
    if (!profile || typeof profile !== "object") return false;
    if (!profile.calendarVersion || !profile.oracleVersion || !profile.createdAt) return false;
    if (!profile.input || !profile.calculated || !profile.interpretation) return false;
    return true;
  }

  function toLegacyRecord(record) {
    return {
      id: `legacy-${record.birth || record.name || Math.random().toString(36).slice(2)}`,
      legacyRecord: true,
      calendarVersion: record.calendarVersion || "legacy/genesis-oracle/new-moon-anchor",
      oracleVersion: record.oracleVersion || "legacy/genesis-oracle/pre-1.0.0",
      createdAt: nowIso(),
      input: {
        name: record.name || "Unnamed",
        birthDate: record.birth || "",
        birthTime: record.birthTime || "",
        timezone: record.timezone || "UTC"
      },
      calculated: record,
      interpretation: {
        note: "Legacy record retained unchanged. Use Recalculate with Oracle 2.0 for current deterministic outputs."
      }
    };
  }

  function readProfiles() {
    const v2 = readRaw(STORAGE_KEY).filter(validateProfile);
    const legacy = readRaw(LEGACY_KEY).map(toLegacyRecord);
    return [...v2, ...legacy].slice(0, 80);
  }

  function writeProfiles(profiles) {
    const clean = profiles.filter(validateProfile).slice(0, 80);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  }

  function saveProfile(result) {
    const profiles = readRaw(STORAGE_KEY).filter(validateProfile);
    const profile = {
      id: `profile-${Date.now()}`,
      calendarVersion: result.calendarVersion,
      oracleVersion: result.oracleVersion,
      createdAt: nowIso(),
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
    profiles.unshift(profile);
    writeProfiles(profiles);
    return profile;
  }

  function importProfiles(raw) {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("Imported JSON must be an array of profiles.");
    }
    const valid = parsed.filter(validateProfile);
    if (!valid.length) {
      throw new Error("No valid Oracle 2.0 profiles found in import.");
    }
    writeProfiles(valid);
    return valid.length;
  }

  globalThis.GenesisOracleStorage = Object.freeze({
    STORAGE_KEY,
    LEGACY_KEY,
    validateProfile,
    readProfiles,
    writeProfiles,
    saveProfile,
    importProfiles
  });
})();
