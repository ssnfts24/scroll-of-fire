"use strict";

/*
 * Spark tips (Aaron's ruling, Nov 23, 2026; the Sphere charter).
 * The Spark speaks up, sparingly, when the record earns it.
 * These tests pin the fences the charter sets:
 *   - a tip fires only from the keeper's own record, and every
 *     tip carries the record it came from — no source, no tip;
 *   - the fence screen runs before a tip exists: fenced ground
 *     (court/legal, family, Aaron's private details, speaking
 *     as Aaron) never becomes a tip, and this module's fence
 *     copy agrees with the keeper mind's;
 *   - a dismissed kind stays dismissed, persisted on-device;
 *   - the default is quiet: quiet-always shows nothing, and
 *     the chime honours the keeper's mode, reduced motion,
 *     and a hidden page.
 * The browser presentation (the seat panel, the chime itself,
 * speech) is exercised by reading the wiring, not a live DOM.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const repoRoot = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function loadModule(relativePath) {
  const context = vm.createContext({ console, module: { exports: {} }, exports: {} });
  context.globalThis = context;
  vm.runInContext(read(relativePath), context, { filename: path.basename(relativePath) });
  return context.module.exports;
}

function loadTips() {
  return loadModule("docs/assets/js/spark-tips.js");
}

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); }
  };
}

const GARDEN = {
  beds: [
    {
      name: "Moon 5 bed",
      plantings: [
        { cropName: "Tomatoes", canHarvest: true, goneToSeed: false, harvested: false },
        { cropName: "Kale", canHarvest: false, goneToSeed: true, harvested: false },
        { cropName: "Peas", canHarvest: true, goneToSeed: false, harvested: true }
      ],
      returnable: [{ id: "keepsake-1" }]
    },
    { name: "Moon 8 bed", plantings: [], returnable: [] }
  ]
};

test("a tip fires only with a record source: the garden's fold earns harvest, return and seed tips", () => {
  const tips = loadTips();
  const composed = [...tips.composeTips({ garden: GARDEN, unfinishedPractice: null })];
  const kinds = composed.map((t) => t.kind);
  assert.deepEqual(kinds, ["harvest", "return", "seed"]);
  for (const tip of composed) {
    assert.ok(tip.source, "every tip names its record source");
    assert.equal(tip.source, "Pattern Garden record");
  }
  assert.ok(composed[0].text.includes("Tomatoes"), "the harvest tip names the crop the record holds");
  assert.ok(composed[0].text.includes("Moon 5 bed"), "the harvest tip names the bed the record holds");
  assert.ok(!composed.some((t) => t.text.includes("Peas")), "a harvested planting earns no tip");
});

test("no record, no tip: empty sources compose nothing, and a source-less candidate cannot be built", () => {
  const tips = loadTips();
  assert.equal(tips.composeTips({ garden: null, unfinishedPractice: null }).length, 0);
  assert.equal(tips.composeTips({}).length, 0);
  assert.equal(tips.composeTips(null).length, 0);
  // A planting the record cannot name earns nothing.
  const nameless = { beds: [{ name: "Moon 1 bed", plantings: [{ canHarvest: true }], returnable: [] }] };
  assert.equal(tips.composeTips({ garden: nameless, unfinishedPractice: null }).length, 0);
});

test("the keeper's unfinished practice earns a tip from their own record", () => {
  const tips = loadTips();
  const composed = [...tips.composeTips({ garden: null, unfinishedPractice: "Morning pages" })];
  assert.equal(composed.length, 1);
  assert.equal(composed[0].kind, "practice");
  assert.equal(composed[0].source, "your record on this device");
  assert.ok(composed[0].text.includes("Morning pages"));
});

test("fenced ground never becomes a tip: the fence screen runs before composition is presented", () => {
  const tips = loadTips();
  // A practice whose own words walk fenced ground earns no tip.
  assert.equal(
    tips.composeTips({ garden: null, unfinishedPractice: "Notes on Aaron's custody hearing" }).length,
    0
  );
  assert.equal(
    tips.composeTips({ garden: null, unfinishedPractice: "Write to my lawyer about the case" }).length,
    0
  );
  // Nor does a garden record carrying a fenced name.
  const fencedGarden = {
    beds: [{
      name: "Moon 2 bed",
      plantings: [{ cropName: "Cassidy", canHarvest: true, goneToSeed: false, harvested: false }],
      returnable: []
    }]
  };
  assert.equal(tips.composeTips({ garden: fencedGarden, unfinishedPractice: null }).length, 0);
});

test("the tips fence copy agrees with the keeper mind's fence", () => {
  const tips = loadTips();
  const mind = loadModule("docs/assets/js/spark-keeper-mind.js");
  const probes = [
    "Your Tomatoes stand ready to harvest.",
    "A keepsake can return to the bed this Moon.",
    "Notes on Aaron's custody hearing",
    "Ask my lawyer about the case number 12-3-45678-90",
    "Where does Aaron live?",
    "Speak as Aaron for a moment",
    "Your practice of morning pages waits unfinished.",
    "Tanya's garden rows"
  ];
  for (const probe of probes) {
    assert.equal(
      tips.fenceCheck(probe),
      mind.fenceCheck(probe),
      `the two fence copies agree on: ${probe}`
    );
  }
  assert.equal(tips.fenceCheck("Your Tomatoes stand ready."), false);
  assert.equal(tips.fenceCheck("Notes on Aaron's custody hearing"), true);
});

test("a dismissed kind stays dismissed, and the dismissal persists on the device", () => {
  const tips = loadTips();
  const storage = fakeStorage();
  let settings = tips.loadSettings(storage);
  settings = tips.dismissKind(settings, "harvest");
  tips.saveSettings(storage, settings);

  const reloaded = tips.loadSettings(storage);
  assert.deepEqual([...reloaded.dismissedKinds], ["harvest"]);

  const composed = [...tips.composeTips({ garden: GARDEN, unfinishedPractice: "Morning pages" })];
  const presentable = [...tips.presentableTips(composed, reloaded)];
  assert.ok(!presentable.some((t) => t.kind === "harvest"), "the dismissed kind never returns");
  assert.ok(presentable.some((t) => t.kind === "return"), "other kinds still stand");
  assert.ok(presentable.some((t) => t.kind === "practice"), "other kinds still stand");

  // Dismissing twice does not duplicate, and never undismisses.
  const again = tips.dismissKind(reloaded, "harvest");
  assert.deepEqual([...again.dismissedKinds], ["harvest"]);
});

test("quiet by default: the default mode is the gentle chime, and quiet-always presents nothing", () => {
  const tips = loadTips();
  const blank = tips.blankSettings();
  assert.equal(blank.mode, "chime");
  assert.equal(blank.dismissedKinds.length, 0);

  const composed = tips.composeTips({ garden: GARDEN, unfinishedPractice: null });
  assert.equal(tips.presentableTips(composed, blank).length, composed.length);
  assert.equal(tips.presentableTips(composed, { ...blank, mode: "off" }).length, 0);
  assert.equal(tips.presentableTips(composed, null).length, 0);
});

test("the keeper's arrival choice persists: chime, words only, spoken, or quiet always", () => {
  const tips = loadTips();
  const storage = fakeStorage();
  for (const mode of ["chime", "text", "voice", "off"]) {
    tips.saveSettings(storage, { version: 1, mode, dismissedKinds: [] });
    assert.equal(tips.loadSettings(storage).mode, mode);
  }
  // A damaged or foreign settings value falls back to the quiet default.
  storage.setItem(tips.SETTINGS_KEY, "{not json");
  assert.equal(tips.loadSettings(storage).mode, "chime");
  storage.setItem(tips.SETTINGS_KEY, JSON.stringify({ mode: "loud", dismissedKinds: "harvest" }));
  const fallen = tips.loadSettings(storage);
  assert.equal(fallen.mode, "chime");
  assert.equal(fallen.dismissedKinds.length, 0);
});

test("the chime honours the keeper's settings: mode, reduced motion, and a hidden page", () => {
  const tips = loadTips();
  const calm = { reducedMotion: false, hidden: false };
  assert.equal(tips.shouldChime({ mode: "chime", dismissedKinds: [] }, calm), true);
  assert.equal(tips.shouldChime({ mode: "voice", dismissedKinds: [] }, calm), true);
  assert.equal(tips.shouldChime({ mode: "text", dismissedKinds: [] }, calm), false);
  assert.equal(tips.shouldChime({ mode: "off", dismissedKinds: [] }, calm), false);
  assert.equal(
    tips.shouldChime({ mode: "chime", dismissedKinds: [] }, { reducedMotion: true, hidden: false }),
    false,
    "reduced motion asks for stillness — the words arrive silently"
  );
  assert.equal(
    tips.shouldChime({ mode: "chime", dismissedKinds: [] }, { reducedMotion: false, hidden: true }),
    false,
    "a hidden page is not a moment to be heard in"
  );
  assert.equal(tips.shouldSpeak({ mode: "voice", dismissedKinds: [] }), true);
  assert.equal(tips.shouldSpeak({ mode: "chime", dismissedKinds: [] }), false);
});

test("the seat lazy-loads the tips layer beside the mind, and the layer attaches through the seat", () => {
  const seatSource = read("docs/assets/js/spark-agent-seat.js");
  assert.ok(seatSource.includes("spark-tips.js"), "the seat loads spark-tips.js from beside itself");
  assert.ok(seatSource.includes("ensureTips()"), "the tips load rides the panel's first opening");

  const tipsSource = read("docs/assets/js/spark-tips.js");
  assert.ok(tipsSource.includes("SparkAgentSeat.attach"), "the layer attaches through the seat's attach point");
  assert.ok(!/fetch\(/.test(tipsSource), "the tips layer makes no network calls");
});
