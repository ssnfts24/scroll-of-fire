/* Living Genesis Profile (Nov 23, 2026): the permanent-profile model
 * on the online Oracle. Create once, save permanently; exactly one
 * profile designated My Genesis; recalculation as a new entry that
 * never overwrites the original; the Sphere's Genesis layer reading
 * the same record through its pure half. The storage format these
 * tests pin is specified in docs/development/GENESIS-PROFILE-FORMAT.md.
 *
 * Repository tests follow the stabilization suite's pattern: a
 * hand-built engine-shaped result factory, and a stub engine for
 * recalculation (the engine's own math is pinned by the mirror
 * determinism suite, not here). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const repositorySrc = fs.readFileSync("docs/assets/js/oracle/oracle-profile-repository.js", "utf8");
const sphereGenesisSrc = fs.readFileSync("docs/assets/js/sphere-genesis-layer.js", "utf8");
const pageControllerSrc = fs.readFileSync("docs/assets/js/genesis-oracle.js", "utf8");

function makeStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    _store: store
  };
}

/* An engine-shaped reading for a keeper, in the exact shape
 * GenesisOracleEngine.run returns and saveProfile consumes. */
function makeResult(name, birthDate, moonNumber = 8, dayInMoon = 25, tone = 5) {
  return {
    calendarVersion: "pattern-calendar/test",
    oracleVersion: "genesis-oracle/2.0.0",
    input: {
      name,
      birthDate,
      birthTime: "",
      timeKnown: false,
      timeZone: "UTC",
      boundaryMode: "midnight",
      sunsetTime: "18:00"
    },
    patternPosition: { moonNumber, moonName: "Deep Mirror", dayInMoon, dayOfPatternYear: 221 },
    coreSignature: { tone, carrier: { hz: 528 }, toneProfile: { name: "Overtone" } },
    nameSignature: { fullNameReduction: 7 },
    birthTimeLayer: { source: "time-unknown" },
    relationships: { nameToBirthResonance: { classification: "harmonic" } },
    reading: { quickSeal: "Test seal." },
    methods: { stub: true }
  };
}

function loadRepo(storage) {
  const sandbox = { console, localStorage: storage };
  sandbox.globalThis = sandbox;
  // Stub engine: recalculation in the repository calls run() on the
  // stored input. Deterministic echo of the input, engine-shaped.
  sandbox.GenesisOracleEngine = {
    run(input) {
      return makeResult(input?.name || "", input?.birthDate || "");
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(repositorySrc, sandbox, { filename: "oracle-profile-repository.js" });
  return sandbox.OracleProfileRepository;
}

function rawProfiles(storage) {
  return JSON.parse(storage.getItem("sofGenesisProfilesV2") || "[]");
}

test("first saved profile becomes My Genesis; later saves never take it silently", async () => {
  const storage = makeStorage();
  const repo = loadRepo(storage);
  await repo.initialize();

  const a = repo.saveProfile(makeResult("Keeper One", "1990-01-15"));
  assert.equal(a.myGenesis, true, "first save is designated");
  assert.equal(repo.getMyGenesis().id, a.id);

  const b = repo.saveProfile(makeResult("Family Two", "1985-06-20", 3, 9, 2));
  assert.notEqual(b.myGenesis, true, "second save does not steal the designation");
  assert.equal(repo.getMyGenesis().id, a.id);

  const raw = rawProfiles(storage);
  assert.equal(raw.filter(p => p.myGenesis === true).length, 1, "exactly one flag in storage");
});

test("setMyGenesis moves the designation and persists exactly one flag", async () => {
  const storage = makeStorage();
  const repo = loadRepo(storage);
  await repo.initialize();

  const a = repo.saveProfile(makeResult("Keeper One", "1990-01-15"));
  const b = repo.saveProfile(makeResult("Family Two", "1985-06-20", 3, 9, 2));

  repo.setMyGenesis(b.id);
  assert.equal(repo.getMyGenesis().id, b.id);
  assert.equal(repo.getSelectedProfile().id, b.id, "designation also selects for the Mirror");

  const raw = rawProfiles(storage);
  assert.equal(raw.filter(p => p.myGenesis === true).length, 1);
  assert.equal(raw.find(p => p.id === b.id).myGenesis, true);
  assert.notEqual(raw.find(p => p.id === a.id).myGenesis, true);
});

test("initialize defaults the session selection to My Genesis", async () => {
  const storage = makeStorage();
  const writer = loadRepo(storage);
  await writer.initialize();
  writer.saveProfile(makeResult("Keeper One", "1990-01-15"));
  const b = writer.saveProfile(makeResult("Family Two", "1985-06-20", 3, 9, 2));
  writer.setMyGenesis(b.id);

  // A fresh page load over the same storage: selection lands on My Genesis.
  const reader = loadRepo(storage);
  await reader.initialize();
  assert.equal(reader.getSelectedProfile().id, b.id);
  assert.equal(reader.getMyGenesis().id, b.id);
});

test("deleting My Genesis leaves none designated — no silent promotion", async () => {
  const storage = makeStorage();
  const repo = loadRepo(storage);
  await repo.initialize();

  const a = repo.saveProfile(makeResult("Keeper One", "1990-01-15"));
  repo.saveProfile(makeResult("Family Two", "1985-06-20", 3, 9, 2));

  repo.deleteProfile(a.id);
  assert.equal(repo.getMyGenesis(), null);
  assert.equal(rawProfiles(storage).filter(p => p.myGenesis === true).length, 0);
});

test("import: a standing designation outranks an imported one; otherwise the first imported flag stands", async () => {
  // Standing wins.
  const storageA = makeStorage();
  const repoA = loadRepo(storageA);
  await repoA.initialize();
  const mine = repoA.saveProfile(makeResult("Keeper One", "1990-01-15"));
  const importedFlagged = JSON.parse(JSON.stringify(rawProfiles(storageA)[0]));
  importedFlagged.id = "profile-imported-1";
  importedFlagged.input = { ...importedFlagged.input, name: "Imported One" };
  repoA.importProfiles([importedFlagged]);
  assert.equal(repoA.getMyGenesis().id, mine.id, "standing designation kept");
  assert.notEqual(repoA.getProfile("profile-imported-1").myGenesis, true);

  // No standing designation: the first imported flag is kept, the rest stripped.
  const storageB = makeStorage();
  const repoB = loadRepo(storageB);
  await repoB.initialize();
  const d = JSON.parse(JSON.stringify(importedFlagged));
  d.id = "profile-imported-d";
  d.myGenesis = true; // scenario A's import stripped the shared fixture's flag in place
  const e = JSON.parse(JSON.stringify(importedFlagged));
  e.id = "profile-imported-e";
  e.myGenesis = true;
  repoB.importProfiles([d, e]);
  assert.equal(repoB.getMyGenesis().id, "profile-imported-d");
  assert.notEqual(repoB.getProfile("profile-imported-e").myGenesis, true);
});

test("recalculateProfile: a new entry with the original inside it; the original stands untouched", async () => {
  const storage = makeStorage();
  const repo = loadRepo(storage);
  await repo.initialize();

  const a = repo.saveProfile(makeResult("Keeper One", "1990-01-15"));
  const rawBefore = JSON.stringify(rawProfiles(storage).find(p => p.id === a.id));

  const fresh = repo.recalculateProfile(a.id);
  assert.notEqual(fresh.id, a.id, "recalculation is a new entry");
  assert.equal(fresh.recalculatedFromId, a.id);
  assert.ok(fresh.recalculationTimestamp);
  assert.equal(JSON.stringify(fresh.originalProfileRecord.calculated), JSON.stringify(a.calculated));
  assert.equal(JSON.stringify(fresh.originalProfileRecord.input), JSON.stringify(a.input));
  assert.notEqual(fresh.myGenesis, true, "designation does not transfer on its own");

  const rawAfter = JSON.stringify(rawProfiles(storage).find(p => p.id === a.id));
  assert.equal(rawAfter, rawBefore, "the original record is byte-for-byte unchanged");
  assert.equal(repo.getMyGenesis().id, a.id, "the original keeps the designation");
});

test("page controller never touches legacy storage directly (repository is the writer)", () => {
  assert.ok(!/GenesisOracleStorage/.test(pageControllerSrc),
    "genesis-oracle.js must go through OracleProfileRepository, not the legacy adapter");
  assert.ok(/myGenesis/.test(repositorySrc), "repository carries the designation");
});

function loadSphereGenesis() {
  const sandbox = { console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(sphereGenesisSrc, sandbox, { filename: "sphere-genesis-layer.js" });
  return sandbox.SphereGenesisLayer;
}

test("sphere genesis layer: readout parse, profile reading, birth-on-show", () => {
  const layer = loadSphereGenesis();
  // Field-wise compares: VM-realm objects carry a different prototype.
  const full = layer.parseReadout("Moon 8 · Day 25 · Day 221/364");
  assert.equal(full.moon, 8); assert.equal(full.day, 25); assert.equal(full.patternDay, 221);
  const part = layer.parseReadout("Moon 3 · Day 9");
  assert.equal(part.moon, 3); assert.equal(part.day, 9); assert.equal(part.patternDay, null);
  assert.equal(layer.parseReadout("nothing here"), null);

  const profile = {
    id: "profile-x",
    myGenesis: true,
    input: { name: "Keeper One", birthDate: "1990-01-15" },
    calculated: {
      patternPosition: { moonNumber: 8, moonName: "Deep Mirror", dayInMoon: 25 },
      coreSignature: { tone: 5, carrier: { hz: 528 } },
      nameSignature: { fullNameReduction: 7 }
    }
  };
  assert.equal(layer.readMyGenesisFromRaw(JSON.stringify([profile])).id, "profile-x");
  assert.equal(layer.readMyGenesisFromRaw(JSON.stringify([{ ...profile, myGenesis: false }])), null);
  assert.equal(layer.readMyGenesisFromRaw("{not json"), null);
  assert.equal(layer.readMyGenesisFromRaw(null), null);

  const birth = layer.birthCoordinate(profile);
  assert.equal(birth.moon, 8); assert.equal(birth.day, 25);
  assert.equal(birth.moonName, "Deep Mirror"); assert.equal(birth.tone, 5);
  assert.equal(birth.name, "Keeper One"); assert.equal(birth.birthDate, "1990-01-15");
  assert.equal(layer.isBirthOnShow(birth, { moon: 8, day: 25 }), true);
  assert.equal(layer.isBirthOnShow(birth, { moon: 8, day: 26 }), false);

  // A birth outside the counted year has no Moon/Day coordinate to highlight.
  const outside = { ...profile, calculated: { ...profile.calculated, patternPosition: { moonNumber: null, dayInMoon: null } } };
  assert.equal(layer.birthCoordinate(outside), null);
  assert.equal(layer.readMyGenesisFromRaw(JSON.stringify([outside])), null);
});

test("sphere genesis layer: the seal is the Oracle's seal — deterministic, same derivation", () => {
  const layer = loadSphereGenesis();
  const profile = {
    input: { name: "Keeper One", birthDate: "1990-01-15" },
    calculated: {
      patternPosition: { moonNumber: 8, moonName: "Deep Mirror", dayInMoon: 25 },
      coreSignature: { tone: 5, carrier: { hz: 528 } },
      nameSignature: { fullNameReduction: 7 }
    }
  };
  const one = layer.sealSvgFor(profile, 120);
  const two = layer.sealSvgFor(profile, 120);
  assert.equal(one, two, "same record, same seal");
  assert.ok(one.includes("M8 · D25 · T5"), "seal label carries Moon, Day, Tone");

  const outsideProfile = {
    input: { name: "Keeper One", birthDate: "2026-07-16" },
    calculated: {
      patternPosition: { moonNumber: null, dayInMoon: null },
      coreSignature: { tone: 9, carrier: { hz: 432 } },
      nameSignature: { fullNameReduction: 3 }
    }
  };
  assert.ok(layer.sealSvgFor(outsideProfile, 120).includes("Outside · T9"));
});
