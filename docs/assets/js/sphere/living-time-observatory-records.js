(() => {
  "use strict";

  const SCHEMA_VERSION = "2.0.0";
  const STORAGE_KEY = "sof.observatory.records.v1";
  const SETTINGS_KEY = "sof.observatory.settings.v1";
  const MAX_RECORDS = 25000;

  const cleanText = (value, max = 4000) => String(value ?? "").trim().slice(0, max);
  const cleanTags = value => [...new Set((Array.isArray(value) ? value : String(value || "").split(","))
    .map(v => cleanText(v, 64).toLowerCase()).filter(Boolean))].slice(0, 30);
  const finiteOrNull = value => Number.isFinite(Number(value)) ? Number(value) : null;
  const nowIso = () => new Date().toISOString();
  const clone = value => JSON.parse(JSON.stringify(value));

  function id(prefix = "obs") {
    if (globalThis.crypto?.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`;
  }

  function readJson(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "null");
      return parsed ?? fallback;
    } catch { return fallback; }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (error) {
      dispatchEvent(new CustomEvent("observatory:storage-error", { detail: { error } }));
      return false;
    }
  }

  function snapshot(options = {}) {
    const live = globalThis.LivingTimeSphereLiveData?.getSnapshot?.(options) || null;
    const state = globalThis.LivingTimeSphereUi?.getState?.() || null;
    const pattern = live?.pattern || state?.selectedPatternPosition || {};
    const lunar = live?.lunar || {};
    const solar = live?.solar || {};
    const passage = live?.passage || {};
    const instant = live?.instant || options.instant || nowIso();
    return {
      instant: new Date(instant).toISOString(),
      civilDate: pattern.civilDate || state?.civilDate || null,
      effectiveDate: pattern.effectiveDate || state?.effectiveDate || null,
      timeZone: live?.timeZone || state?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      boundaryMode: live?.boundaryMode || state?.boundaryMode || "sunset",
      manualSunset: live?.manualSunset || state?.manualSunset || "18:00",
      pattern: {
        patternYear: pattern.patternYear ?? null,
        moon: pattern.moon ?? null,
        moonName: cleanText(pattern.moonName, 120) || null,
        moonDay: pattern.day ?? pattern.moonDay ?? null,
        dayOf364: pattern.dayOfPatternYear ?? null,
        week: pattern.weekOfMoon ?? null,
        weekGate: cleanText(pattern.weekGate?.label || pattern.dayArchetype || pattern.weekGate, 120) || null,
        outsideDay: !!(pattern.isDayOutOfTime || pattern.isDeepTimeDay),
        afterBoundary: pattern.afterBoundary ?? null
      },
      astronomy: {
        lunarPhase: cleanText(lunar.phaseName || lunar.phase, 120) || null,
        illumination: finiteOrNull(lunar.illuminationPercent ?? lunar.illumination),
        lunarAge: finiteOrNull(lunar.ageDays ?? lunar.lunarAge),
        moonrise: lunar.moonrise || null,
        moonset: lunar.moonset || null,
        sunrise: solar.sunrise || null,
        sunset: solar.sunset || null,
        daylightMinutes: finiteOrNull(solar.daylightMinutes),
        solarGate: cleanText(solar.gate || solar.solarGate, 120) || null,
        seasonGate: cleanText(solar.season || solar.seasonGate, 120) || null,
        passage: {
          active: !!passage.active,
          elapsed: finiteOrNull(passage.elapsed),
          remaining: finiteOrNull(passage.remaining),
          progress: finiteOrNull(passage.progress)
        }
      },
      sphere: {
        mode: state?.mode || new URLSearchParams(location.search).get("view") || "today",
        renderer: state?.renderer || "auto",
        selectedYear: state?.selectedYear ?? null,
        selectedDay: state?.selectedDay ?? pattern.dayOfPatternYear ?? null,
        visibleLayers: clone(state?.visibleLayers || {}),
        quality: state?.quality || "auto",
        motionMode: state?.motionMode || "still",
        connectionMode: state?.connectionMode || "contextual"
      },
      environment: { ...clone(live?.environment || {}), ...(globalThis.LivingTimeSeasonalEnvironment?.enrich?.({ instant }) || {}) },
      provenance: {
        createdAt: nowIso(),
        source: live ? "LivingTimeSphereLiveData" : "Observatory fallback",
        calculated: !!live,
        sphereVersion: globalThis.LivingTimeSphereVersion?.version || null,
        calendarVersion: globalThis.PatternCalendarVersion?.version || null,
        astronomyVersion: globalThis.AstronomyVersion?.version || null,
        schemaVersion: SCHEMA_VERSION
      }
    };
  }

  function createRecord(input = {}, options = {}) {
    const base = snapshot(options);
    const witness = input.witness || input;
    return {
      schemaVersion: SCHEMA_VERSION,
      recordId: input.recordId || id(),
      createdAt: input.createdAt || nowIso(),
      updatedAt: nowIso(),
      ...base,
      witness: {
        intention: cleanText(witness.intention, 240),
        observation: cleanText(witness.observation, 6000),
        interpretation: cleanText(witness.interpretation, 6000),
        uncertainty: cleanText(witness.uncertainty, 3000),
        action: cleanText(witness.action, 3000),
        outcome: cleanText(witness.outcome, 3000),
        tags: cleanTags(witness.tags)
      },
      personal: {
        mood: cleanText(input.personal?.mood, 80),
        energy: finiteOrNull(input.personal?.energy),
        sleepHours: finiteOrNull(input.personal?.sleepHours),
        stress: finiteOrNull(input.personal?.stress),
        focus: finiteOrNull(input.personal?.focus),
        notes: cleanText(input.personal?.notes, 2000)
      },
      recordType: cleanText(input.recordType || "witness", 40),
      claim: { type: ["observed","measured","reported","inferred","symbolic","experimental","theoretical","disputed","corrected","unresolved"].includes(input.claim?.type) ? input.claim.type : "observed", confidence: finiteOrNull(input.claim?.confidence), statement: cleanText(input.claim?.statement, 2000) },
      entities: { personIds: cleanTags(input.entities?.personIds), placeId: cleanText(input.entities?.placeId,160)||null, artifactIds: cleanTags(input.entities?.artifactIds), projectIds: cleanTags(input.entities?.projectIds), nodeIds: cleanTags(input.entities?.nodeIds) },
      environment: { ...base.environment, ...(input.environment || {}), ...(globalThis.LivingTimeSeasonalEnvironment?.enrich?.({ instant: base.instant, location: input.environment?.location, manual: input.environment?.conditions || input.environment || {} }) || {}) },
      relationships: Array.isArray(input.relationships) ? input.relationships.slice(0, 50).map(r => ({
        type: cleanText(r.type, 80), targetId: cleanText(r.targetId, 160), label: cleanText(r.label, 240)
      })) : [],
      privacy: {
        visibility: ["private", "anonymous", "public"].includes(input.privacy?.visibility) ? input.privacy.visibility : "private",
        includeLocation: !!input.privacy?.includeLocation,
        includePersonal: !!input.privacy?.includePersonal
      }
    };
  }

  function validate(record) {
    const errors = [];
    if (!record || typeof record !== "object") errors.push("Record must be an object.");
    if (!record?.recordId) errors.push("recordId is required.");
    if (!record?.schemaVersion) errors.push("schemaVersion is required.");
    if (!record?.instant || Number.isNaN(Date.parse(record.instant))) errors.push("A valid instant is required.");
    const day = record?.pattern?.dayOf364;
    if (day != null && (day < 1 || day > 366)) errors.push("Pattern day is outside the supported range.");
    return { valid: errors.length === 0, errors };
  }

  function list() {
    const data = readJson(STORAGE_KEY, { schemaVersion: SCHEMA_VERSION, records: [] });
    return Array.isArray(data.records) ? data.records : [];
  }

  function save(record) {
    const check = validate(record);
    if (!check.valid) throw new Error(check.errors.join(" "));
    const records = list();
    const index = records.findIndex(r => r.recordId === record.recordId);
    const stored = clone({ ...record, updatedAt: nowIso() });
    if (index >= 0) records[index] = stored; else records.unshift(stored);
    if (records.length > MAX_RECORDS) records.length = MAX_RECORDS;
    if (!writeJson(STORAGE_KEY, { schemaVersion: SCHEMA_VERSION, updatedAt: nowIso(), records })) {
      throw new Error("The record could not be saved in this browser.");
    }
    dispatchEvent(new CustomEvent("observatory:record-saved", { detail: { record: stored } }));
    return stored;
  }

  function remove(recordId) {
    const records = list().filter(r => r.recordId !== recordId);
    writeJson(STORAGE_KEY, { schemaVersion: SCHEMA_VERSION, updatedAt: nowIso(), records });
    dispatchEvent(new CustomEvent("observatory:records-changed"));
  }

  function clear() {
    localStorage.removeItem(STORAGE_KEY);
    dispatchEvent(new CustomEvent("observatory:records-changed"));
  }

  function exportBundle({ visibility = null } = {}) {
    const records = list().filter(r => !visibility || r.privacy?.visibility === visibility);
    return {
      type: "codex-observatory-export",
      schemaVersion: SCHEMA_VERSION,
      exportedAt: nowIso(),
      recordCount: records.length,
      records
    };
  }

  function download(filename = `codex-observatory-${new Date().toISOString().slice(0,10)}.json`) {
    const blob = new Blob([JSON.stringify(exportBundle(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importBundle(fileOrText, { merge = true } = {}) {
    const text = typeof fileOrText === "string" ? fileOrText : await fileOrText.text();
    const parsed = JSON.parse(text);
    const incoming = Array.isArray(parsed) ? parsed : parsed.records;
    if (!Array.isArray(incoming)) throw new Error("No Observatory records were found.");
    const accepted = [];
    for (const raw of incoming) {
      const migrated = migrate(raw);
      if (validate(migrated).valid) accepted.push(migrated);
    }
    const map = new Map((merge ? list() : []).map(r => [r.recordId, r]));
    accepted.forEach(r => map.set(r.recordId, r));
    const records = [...map.values()].sort((a,b) => Date.parse(b.instant) - Date.parse(a.instant)).slice(0, MAX_RECORDS);
    writeJson(STORAGE_KEY, { schemaVersion: SCHEMA_VERSION, updatedAt: nowIso(), records });
    dispatchEvent(new CustomEvent("observatory:records-changed"));
    return { accepted: accepted.length, total: incoming.length };
  }

  function migrate(raw) {
    if (raw?.schemaVersion === SCHEMA_VERSION) return clone(raw);
    const base = createRecord({
      recordId: raw?.recordId || raw?.id,
      createdAt: raw?.createdAt || raw?.timestamp,
      witness: raw?.witness || raw,
      personal: raw?.personal,
      privacy: raw?.privacy
    });
    return {
      ...base,
      instant: raw?.instant || raw?.timestamp || base.instant,
      pattern: { ...base.pattern, ...(raw?.pattern || {}) },
      astronomy: { ...base.astronomy, ...(raw?.astronomy || {}) },
      environment: raw?.environment || base.environment,
      provenance: { ...base.provenance, migratedFrom: raw?.schemaVersion || "legacy" }
    };
  }

  function settings(next) {
    if (next === undefined) return readJson(SETTINGS_KEY, { locationPermission: false, analytics: false });
    const merged = { ...settings(), ...next };
    writeJson(SETTINGS_KEY, merged);
    return merged;
  }

  globalThis.LivingTimeObservatoryRecords = Object.freeze({
    SCHEMA_VERSION, STORAGE_KEY, snapshot, createRecord, validate, list, save, remove, clear,
    exportBundle, download, importBundle, migrate, settings
  });
})();
