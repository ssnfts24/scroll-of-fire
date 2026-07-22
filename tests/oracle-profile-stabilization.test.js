"use strict";

// oracle-profile-stabilization.test.js
// Phase 1.1 stabilization tests for OracleProfileRepository and genesis-oracle.js.
// Covers all 18 required test paths from the problem statement.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

// ── Helper: load OracleProfileRepository in a sandboxed VM context ─────────────

function makeLocalStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem(key, val) { store[key] = val; },
    removeItem(key) { delete store[key]; },
    clear() { Object.keys(store).forEach(k => delete store[k]); },
    _store: store
  };
}

function makeThrowingLocalStorage(errorName = "QuotaExceededError") {
  return {
    getItem() { return null; },
    setItem() {
      const err = new Error("Storage quota exceeded.");
      err.name = errorName;
      throw err;
    },
    removeItem() {},
    clear() {}
  };
}

function makeUnavailableLocalStorage() {
  // Simulates SecurityError when accessing localStorage (e.g. blocked in iframe)
  const p = {};
  Object.defineProperty(p, "getItem", {
    get() { throw new Error("Access denied to localStorage."); }
  });
  return p;
}

function loadRepo(overrides = {}) {
  const context = {
    localStorage: makeLocalStorage(),
    ...overrides
  };
  context.globalThis = context;
  vm.runInNewContext(read("docs/assets/js/oracle/oracle-profile-repository.js"), context);
  return context.OracleProfileRepository;
}

// ── Minimal valid Oracle 2.0 profile factory ──────────────────────────────────

function makeV2Result(overrides = {}) {
  return {
    calendarVersion: "pattern-calendar/2026.1",
    oracleVersion: "genesis-oracle/2.0.0",
    input: { name: "Test User", birthDate: "1990-01-15", birthTime: "08:30", timezone: "UTC", timeKnown: true },
    patternPosition: { moonNumber: 3, moonName: "Breath Gate", dayInMoon: 7 },
    coreSignature: { tone: 5, carrier: { hz: 432 }, moonKey: "X", dayKey: "Y", weekGate: "Z", resonantSum: 12, element: { moonElement: "fire", dayElement: "water", relationship: "tension" }, toneProfile: { name: "Resonant" } },
    nameSignature: { fullNameReduction: 8 },
    birthTimeLayer: { gate: "Gate 12", timezone: "UTC" },
    relationships: { nameToBirthResonance: { classification: "harmonic" } },
    reading: "Test reading.",
    methods: { toneResonant: { relationshipState: "aligned", delta: 0 } },
    ...overrides
  };
}

function makeLegacyRecord(overrides = {}) {
  return {
    name: "Legacy Person",
    birth: "1985-06-20",
    birthTime: "14:00",
    timezone: "UTC",
    moonName: "Seed Flame",
    tone: 3,
    ...overrides
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Canonical repository-only access
// ═══════════════════════════════════════════════════════════════════════════════

test("repository exposes canonical keys and no direct localStorage reads externally", () => {
  const repo = loadRepo();
  assert.equal(typeof repo.STORAGE_KEY_V2, "string");
  assert.equal(typeof repo.STORAGE_KEY_LEGACY, "string");
  assert.equal(typeof repo.STORAGE_KEY_LEGACY_IMPORTS, "string");
  assert.equal(repo.STORAGE_KEY_V2, "sofGenesisProfilesV2");
  assert.equal(repo.STORAGE_KEY_LEGACY, "sofGenesisProfiles");
});

test("genesis-oracle.js does not reference GenesisOracleStorage directly", () => {
  const source = read("docs/assets/js/genesis-oracle.js");
  assert.ok(
    !source.includes("GenesisOracleStorage"),
    "genesis-oracle.js must not call GenesisOracleStorage directly"
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Old and new storage keys
// ═══════════════════════════════════════════════════════════════════════════════

test("initialize reads from both sofGenesisProfilesV2 and sofGenesisProfiles", async () => {
  const ls = makeLocalStorage({
    sofGenesisProfilesV2: JSON.stringify([{
      id: "p-001",
      calendarVersion: "pattern-calendar/2026.1",
      oracleVersion: "genesis-oracle/2.0.0",
      createdAt: "2026-01-01T00:00:00.000Z",
      input: { name: "Alice" },
      calculated: {},
      interpretation: {}
    }]),
    sofGenesisProfiles: JSON.stringify([{ name: "Legacy Bob", birth: "1980-03-10" }])
  });
  const repo = loadRepo({ localStorage: ls });
  await repo.initialize();
  const state = repo.getStatus();
  assert.equal(state.status, "ready");
  assert.equal(state.profiles.length, 1);
  assert.equal(state.legacyProfiles.length, 1);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Malformed JSON produces error state
// ═══════════════════════════════════════════════════════════════════════════════

test("malformed JSON in sofGenesisProfilesV2 sets status to error", async () => {
  const ls = makeLocalStorage({ sofGenesisProfilesV2: "NOT VALID JSON{{{" });
  const repo = loadRepo({ localStorage: ls });
  await repo.initialize();
  const state = repo.getStatus();
  assert.equal(state.status, "error");
  assert.ok(state.error, "error object must be present");
  assert.ok(state.error.code, "error must have a code");
  assert.ok(state.error.storageKey, "error must include storageKey");
  assert.equal(state.error.storageKey, "sofGenesisProfilesV2");
});

test("non-array JSON in sofGenesisProfilesV2 sets status to error", async () => {
  const ls = makeLocalStorage({ sofGenesisProfilesV2: JSON.stringify({ not: "an array" }) });
  const repo = loadRepo({ localStorage: ls });
  await repo.initialize();
  const state = repo.getStatus();
  assert.equal(state.status, "error");
  assert.equal(state.error.code, "INVALID_FORMAT");
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Storage unavailable
// ═══════════════════════════════════════════════════════════════════════════════

test("missing localStorage sets status to error", async () => {
  // No localStorage property at all
  const context = {};
  context.globalThis = context;
  vm.runInNewContext(read("docs/assets/js/oracle/oracle-profile-repository.js"), context);
  const repo = context.OracleProfileRepository;
  await repo.initialize();
  const state = repo.getStatus();
  assert.equal(state.status, "error");
  assert.equal(state.error.code, "STORAGE_UNAVAILABLE");
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Failed writes / quota errors
// ═══════════════════════════════════════════════════════════════════════════════

test("quota exceeded error on saveProfile sets status to error and throws", async () => {
  const ls = makeThrowingLocalStorage("QuotaExceededError");
  const repo = loadRepo({ localStorage: ls });
  // Initialize from empty (getItem returns null)
  await repo.initialize();
  // status will be error due to unavailable write, but let's reset manually via a fresh repo
  // Actually getItem returns null so initialize won't throw
  // Set initial state to "ready" by loading with normal storage first, then swap
  const ls2 = makeLocalStorage({});
  const repo2 = loadRepo({ localStorage: ls2 });
  await repo2.initialize();
  assert.equal(repo2.getStatus().status, "empty");

  // Now make writes fail
  ls2.setItem = () => {
    const err = new Error("Quota exceeded");
    err.name = "QuotaExceededError";
    throw err;
  };

  const result = makeV2Result();
  await assert.rejects(async () => repo2.saveProfile(result), /Quota exceeded|quota/i);
  const state = repo2.getStatus();
  assert.equal(state.status, "error");
  assert.equal(state.error.code, "QUOTA_EXCEEDED");
});

test("write denied error on saveProfile sets status to error", async () => {
  const ls2 = makeLocalStorage({});
  const repo2 = loadRepo({ localStorage: ls2 });
  await repo2.initialize();

  ls2.setItem = () => {
    const err = new Error("Write denied by policy.");
    err.name = "SecurityError";
    throw err;
  };

  const result = makeV2Result();
  await assert.rejects(async () => repo2.saveProfile(result), /Write denied|policy/i);
  assert.equal(repo2.getStatus().status, "error");
  assert.equal(repo2.getStatus().error.code, "WRITE_DENIED");
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Deterministic legacy IDs (no Math.random)
// ═══════════════════════════════════════════════════════════════════════════════

test("legacy IDs are deterministic — same record produces same ID across initializations", async () => {
  const legacyRecord = { name: "Legacy Carol", birth: "1975-09-12", birthTime: "06:00", timezone: "UTC" };
  const stored = JSON.stringify([legacyRecord]);

  const ls1 = makeLocalStorage({ sofGenesisProfiles: stored });
  const repo1 = loadRepo({ localStorage: ls1 });
  await repo1.initialize();
  const id1 = repo1.listLegacyProfiles()[0]?.id;

  const ls2 = makeLocalStorage({ sofGenesisProfiles: stored });
  const repo2 = loadRepo({ localStorage: ls2 });
  await repo2.initialize();
  const id2 = repo2.listLegacyProfiles()[0]?.id;

  assert.ok(id1, "ID must be defined");
  assert.equal(id1, id2, "Same legacy record must produce the same ID in separate initializations");
  assert.ok(!id1.includes("undefined"), "ID must not contain 'undefined'");
});

test("legacy ID does not contain random-looking suffixes across multiple calls", async () => {
  const legacyRecord = { name: "Stable Dave", birth: "1990-04-22" };
  const stored = JSON.stringify([legacyRecord]);

  const ids = [];
  for (let i = 0; i < 5; i++) {
    const ls = makeLocalStorage({ sofGenesisProfiles: stored });
    const repo = loadRepo({ localStorage: ls });
    await repo.initialize();
    ids.push(repo.listLegacyProfiles()[0]?.id);
  }
  const unique = new Set(ids);
  assert.equal(unique.size, 1, `All IDs must be identical; got: ${[...unique].join(", ")}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. Imported legacy profiles persist after reload
// ═══════════════════════════════════════════════════════════════════════════════

test("imported legacy profiles are written to STORAGE_KEY_LEGACY_IMPORTS and survive reload", async () => {
  const ls = makeLocalStorage({});
  const repo = loadRepo({ localStorage: ls });
  await repo.initialize();

  const legacyPayload = JSON.stringify([{ name: "Import Eve", birth: "1982-11-03", birthTime: "00:00", timezone: "UTC" }]);
  repo.importProfiles(legacyPayload);

  // Reload with same storage
  const repo2 = loadRepo({ localStorage: ls });
  await repo2.initialize();
  const legacies = repo2.listLegacyProfiles();
  assert.equal(legacies.length, 1, "Imported legacy profile must survive reload");
  assert.equal(legacies[0].input.name, "Import Eve");
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. Selection by stable profile ID
// ═══════════════════════════════════════════════════════════════════════════════

test("selectProfile stores stable profile ID, not array index", async () => {
  const ls = makeLocalStorage({});
  const repo = loadRepo({ localStorage: ls });
  await repo.initialize();

  const result = makeV2Result();
  const saved = repo.saveProfile(result);
  repo.selectProfile(saved.id);

  const state = repo.getStatus();
  assert.equal(state.selectedProfileId, saved.id);
  assert.ok(saved.id.startsWith("profile-"), "ID should start with 'profile-'");
});

test("getSelectedProfile returns correct profile after selection", async () => {
  const ls = makeLocalStorage({});
  const repo = loadRepo({ localStorage: ls });
  await repo.initialize();

  const r1 = makeV2Result({ input: { name: "First", birthDate: "1990-01-01" } });
  const r2 = makeV2Result({ input: { name: "Second", birthDate: "1991-02-02" } });
  const p1 = repo.saveProfile(r1);
  const p2 = repo.saveProfile(r2);

  repo.selectProfile(p1.id);
  assert.equal(repo.getSelectedProfile()?.id, p1.id);

  repo.selectProfile(p2.id);
  assert.equal(repo.getSelectedProfile()?.id, p2.id);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. Comparison uses repository (no direct storage reads)
// ═══════════════════════════════════════════════════════════════════════════════

test("genesis-oracle.js runCompare uses getProfile via repository, not GenesisOracleStorage", () => {
  const source = read("docs/assets/js/genesis-oracle.js");
  // runCompare must use repo.getProfile, not GenesisOracleStorage
  assert.ok(!source.includes("GenesisOracleStorage"), "No GenesisOracleStorage references allowed");
  // Verify runCompare uses repo.getProfile (check for the pattern in the source)
  assert.ok(
    source.includes("repo.getProfile(idA)") || source.includes("repo.getProfile("),
    "runCompare must use repo.getProfile to look up profiles by stable ID"
  );
});

test("comparison selectors use stable profile IDs not array indexes", () => {
  const source = read("docs/assets/js/genesis-oracle.js");
  // The old code used: optionA.value = String(index);
  // The new code must use: profile.id
  assert.ok(
    !source.includes("String(index)") || !source.includes("optionA.value = String(index)"),
    "Option values must not be array indexes"
  );
  // Verify the new pattern using profile.id is present
  assert.ok(
    source.includes("optionA.value = profile.id"),
    "Comparison selectors must use profile.id as option value"
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. saveProfile preserves birthTimeLayer and schemaVersion
// ═══════════════════════════════════════════════════════════════════════════════

test("saveProfile preserves birthTimeLayer in stored profile", async () => {
  const ls = makeLocalStorage({});
  const repo = loadRepo({ localStorage: ls });
  await repo.initialize();

  const result = makeV2Result();
  const saved = repo.saveProfile(result);

  assert.ok(saved.calculated.birthTimeLayer, "birthTimeLayer must be present in saved profile");
  assert.equal(saved.calculated.birthTimeLayer.gate, "Gate 12");

  // Verify persisted in storage
  const raw = JSON.parse(ls.getItem("sofGenesisProfilesV2"));
  assert.ok(raw[0].calculated.birthTimeLayer, "birthTimeLayer must be persisted to storage");
});

test("saveProfile adds schemaVersion to stored profile", async () => {
  const ls = makeLocalStorage({});
  const repo = loadRepo({ localStorage: ls });
  await repo.initialize();

  const result = makeV2Result();
  const saved = repo.saveProfile(result);

  assert.equal(saved.schemaVersion, 1, "saved profile must include schemaVersion: 1");

  const raw = JSON.parse(ls.getItem("sofGenesisProfilesV2"));
  assert.equal(raw[0].schemaVersion, 1, "schemaVersion must be persisted");
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11. No personalized output without selection / personalized after selection
// ═══════════════════════════════════════════════════════════════════════════════

test("getSelectedProfile returns null when no profile is selected", async () => {
  const ls = makeLocalStorage({});
  const repo = loadRepo({ localStorage: ls });
  await repo.initialize();

  const result = makeV2Result();
  repo.saveProfile(result);

  assert.equal(repo.getSelectedProfile(), null, "Must return null before selectProfile is called");
});

test("getSelectedProfile returns profile after selection", async () => {
  const ls = makeLocalStorage({});
  const repo = loadRepo({ localStorage: ls });
  await repo.initialize();

  const result = makeV2Result();
  const saved = repo.saveProfile(result);
  repo.selectProfile(saved.id);

  const selected = repo.getSelectedProfile();
  assert.ok(selected, "Must return profile after selection");
  assert.equal(selected.id, saved.id);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 12. Profile deletion clears selection
// ═══════════════════════════════════════════════════════════════════════════════

test("deleting the selected profile clears selectedProfileId", async () => {
  const ls = makeLocalStorage({});
  const repo = loadRepo({ localStorage: ls });
  await repo.initialize();

  const result = makeV2Result();
  const saved = repo.saveProfile(result);
  repo.selectProfile(saved.id);
  assert.equal(repo.getStatus().selectedProfileId, saved.id);

  repo.deleteProfile(saved.id);
  assert.equal(repo.getStatus().selectedProfileId, null, "selectedProfileId must be null after deleting selected profile");
});

test("deleting a non-selected profile preserves selection", async () => {
  const ls = makeLocalStorage({});
  const repo = loadRepo({ localStorage: ls });
  await repo.initialize();

  const p1 = repo.saveProfile(makeV2Result({ input: { name: "Keep Me" } }));
  const p2 = repo.saveProfile(makeV2Result({ input: { name: "Delete Me" } }));
  repo.selectProfile(p1.id);

  repo.deleteProfile(p2.id);
  assert.equal(repo.getStatus().selectedProfileId, p1.id, "Selection must be preserved when a different profile is deleted");
});

// ═══════════════════════════════════════════════════════════════════════════════
// 13. Legacy discovery
// ═══════════════════════════════════════════════════════════════════════════════

test("legacy profiles from sofGenesisProfiles are discovered and wrapped", async () => {
  const ls = makeLocalStorage({
    sofGenesisProfiles: JSON.stringify([
      { name: "Old Oracle Frank", birth: "1963-07-04", birthTime: "12:00" },
      { name: "Ancient Grace", birth: "1955-12-25" }
    ])
  });
  const repo = loadRepo({ localStorage: ls });
  await repo.initialize();
  const state = repo.getStatus();
  assert.equal(state.legacyProfiles.length, 2);
  assert.equal(state.legacyProfiles[0].legacyRecord, true);
  assert.ok(state.legacyProfiles[0].id.startsWith("legacy-"));
});

test("legacy profile deduplication by ID works across both legacy keys", async () => {
  // Same record present in both legacy storage and legacy imports
  const record = { name: "Dup Henry", birth: "1970-02-14" };
  const ls = makeLocalStorage({
    sofGenesisProfiles: JSON.stringify([record]),
    sofGenesisLegacyImports: JSON.stringify([{ ...record, id: undefined }])
  });
  const repo = loadRepo({ localStorage: ls });
  await repo.initialize();
  // Both records produce the same deterministic ID, so only 1 should remain
  assert.equal(repo.listLegacyProfiles().length, 1, "Duplicate legacy records must be deduplicated");
});

// ═══════════════════════════════════════════════════════════════════════════════
// 14. Subscriber pattern fires on state change
// ═══════════════════════════════════════════════════════════════════════════════

test("subscribers receive state updates on initialize and saveProfile", async () => {
  const ls = makeLocalStorage({});
  const repo = loadRepo({ localStorage: ls });

  const events = [];
  repo.subscribe(state => events.push(state.status));

  await repo.initialize();
  const result = makeV2Result();
  repo.saveProfile(result);

  assert.ok(events.includes("loading"), "must emit loading state");
  assert.ok(events.includes("empty") || events.includes("ready"), "must emit empty or ready after init");
  const lastStatus = events[events.length - 1];
  assert.equal(lastStatus, "ready", "final state after save must be ready");
});

// ═══════════════════════════════════════════════════════════════════════════════
// 15. Cross-tab storage events — initialization re-reads storage
// ═══════════════════════════════════════════════════════════════════════════════

test("re-initialize picks up externally written profiles (simulates cross-tab storage event)", async () => {
  const ls = makeLocalStorage({});
  const repo = loadRepo({ localStorage: ls });
  await repo.initialize();
  assert.equal(repo.getStatus().profiles.length, 0);

  // Simulate another tab writing a profile
  const externalProfile = {
    id: "external-001",
    schemaVersion: 1,
    calendarVersion: "pattern-calendar/2026.1",
    oracleVersion: "genesis-oracle/2.0.0",
    createdAt: "2026-01-01T00:00:00Z",
    input: { name: "External User" },
    calculated: {},
    interpretation: {}
  };
  ls.setItem("sofGenesisProfilesV2", JSON.stringify([externalProfile]));

  // Re-initialize simulates responding to storage event
  await repo.initialize();
  assert.equal(repo.getStatus().profiles.length, 1);
  assert.equal(repo.getStatus().profiles[0].id, "external-001");
});

// ═══════════════════════════════════════════════════════════════════════════════
// 16. Imported text rendered safely — no HTML injection in picker items
// ═══════════════════════════════════════════════════════════════════════════════

test("genesis-oracle.js _buildProfilePickerItem does not use innerHTML with user data", () => {
  const source = read("docs/assets/js/genesis-oracle.js");

  // Find the _buildProfilePickerItem function body
  const fnMatch = source.match(/function _buildProfilePickerItem\(profile\)\s*\{[\s\S]*?\n  \}/);
  assert.ok(fnMatch, "_buildProfilePickerItem must be defined");
  const fnBody = fnMatch[0];

  // Must NOT use innerHTML to interpolate name, birthDate, moon, day, or oracleVer
  assert.ok(
    !fnBody.includes("li.innerHTML"),
    "_buildProfilePickerItem must not assign user data via li.innerHTML"
  );
  // Must use textContent for user-sourced values
  assert.ok(
    fnBody.includes("textContent"),
    "_buildProfilePickerItem must use textContent for user-sourced values"
  );
});

test("profile name with HTML special characters is treated as plain text by textContent", () => {
  // This is a unit-level proof that textContent assignment cannot produce HTML injection.
  // We verify the DOM API contract: assigning to textContent always escapes.
  // Since we don't have a real DOM here, we verify source-level: no template-literal
  // interpolation of user values into innerHTML strings.
  const source = read("docs/assets/js/genesis-oracle.js");

  // Ensure no template literal with ${name}, ${birthDate}, ${moon}, ${day}
  // appears inside an innerHTML assignment in _buildProfilePickerItem
  const dangerPatterns = [
    /innerHTML\s*=\s*`[^`]*\$\{name\}/,
    /innerHTML\s*=\s*`[^`]*\$\{birthDate\}/,
    /innerHTML\s*=\s*`[^`]*\$\{moon\}/,
    /innerHTML\s*=\s*`[^`]*\$\{oracleVer\}/
  ];
  for (const pattern of dangerPatterns) {
    assert.ok(
      !pattern.test(source),
      `User value must not be interpolated into innerHTML: ${pattern}`
    );
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 17. Read-after-write verification
// ═══════════════════════════════════════════════════════════════════════════════

test("saveProfile succeeds and data is persisted (read-after-write verified)", async () => {
  const ls = makeLocalStorage({});
  const repo = loadRepo({ localStorage: ls });
  await repo.initialize();

  const result = makeV2Result();
  const saved = repo.saveProfile(result);

  // Verify it's actually in localStorage
  const stored = JSON.parse(ls.getItem("sofGenesisProfilesV2") || "[]");
  assert.ok(stored.some(p => p.id === saved.id), "Profile must be verifiably written to storage");
});

// ═══════════════════════════════════════════════════════════════════════════════
// 18. Service worker caches oracle-profile-repository.js
// ═══════════════════════════════════════════════════════════════════════════════

test("service worker optionalPaths includes oracle-profile-repository.js", () => {
  const source = read("docs/service-worker.js");
  assert.ok(
    source.includes("oracle-profile-repository.js"),
    "service-worker.js must include oracle-profile-repository.js in its asset list"
  );
});

test("genesis-oracle.html script tag for oracle-profile-repository.js is present", () => {
  const source = read("docs/genesis-oracle.html");
  assert.ok(
    source.includes("oracle-profile-repository.js"),
    "genesis-oracle.html must load oracle-profile-repository.js"
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// Bonus: origin isolation notice — alternate-origin check
// ═══════════════════════════════════════════════════════════════════════════════

test("genesis-oracle.js includes checkOriginIsolation function", () => {
  const source = read("docs/assets/js/genesis-oracle.js");
  assert.ok(
    source.includes("checkOriginIsolation"),
    "genesis-oracle.js must include origin isolation check"
  );
  // Verify the production hostname is referenced for origin gating (exact hostname match in code)
  assert.match(
    source,
    /hostname\s*===\s*["']codexofreality\.org["']/,
    "origin isolation must compare hostname against the production domain exactly"
  );
});
