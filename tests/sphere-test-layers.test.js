"use strict";

/*
 * The test layers' pure helpers — the honesty of these layers is
 * arithmetic: a civil date must land on the Pattern Day the
 * canonical calendar says, a bead past today must be the open
 * future bead, and a year with no record must come back a gap,
 * never a filled bead. The pack pins below hold the ingested
 * data to the published sources it was built from.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const readJSON = (relative) => JSON.parse(read(relative));

function loadLayer() {
  const context = { Intl, Date, URL, console };
  context.globalThis = context;
  context.window = context;
  vm.runInNewContext(read("docs/assets/js/sphere-test-layers.js"), context);
  return context.CodexSphereTestLayers;
}

/* Objects built inside the vm realm carry its prototypes; bring
 * them home before deep comparison. */
const plain = (value) => JSON.parse(JSON.stringify(value));

test("day-index: the calendar fixtures land on their Pattern Days", () => {
  const layer = loadLayer();
  // The Codex's canonical fixtures (MEMORY / gap map):
  // July 17, 2026 = Moon 4 Day 8 = Pattern Day 92;
  // Sept 15, 2026 = Pattern Day 152; Nov 23, 2026 = Pattern Day 221.
  assert.deepEqual(plain(layer.civilToShellSlot({ year: 2026, month: 7, day: 17 })), { shell: 2026, slot: 92 });
  assert.deepEqual(plain(layer.civilToShellSlot({ year: 2026, month: 9, day: 15 })), { shell: 2026, slot: 152 });
  assert.deepEqual(plain(layer.civilToShellSlot({ year: 2026, month: 11, day: 23 })), { shell: 2026, slot: 221 });
  // The window opens April 17: that morning is slot 1 of its shell.
  assert.deepEqual(plain(layer.civilToShellSlot({ year: 2026, month: 4, day: 17 })), { shell: 2026, slot: 1 });
  // April 16 closes the old shell as the Day Out of Time (365),
  // and in the 366-day window before a leap year the Deep Time
  // Day stands at 366.
  assert.deepEqual(plain(layer.civilToShellSlot({ year: 2027, month: 4, day: 16 })), { shell: 2026, slot: 365 });
  assert.deepEqual(plain(layer.civilToShellSlot({ year: 2028, month: 4, day: 15 })), { shell: 2027, slot: 365 });
  assert.deepEqual(plain(layer.civilToShellSlot({ year: 2028, month: 4, day: 16 })), { shell: 2027, slot: 366 });
});

test("day-index: slot and civil date convert both ways", () => {
  const layer = loadLayer();
  assert.equal(layer.slotToCivilISO(2026, 92), "2026-07-17");
  assert.equal(layer.slotToCivilISO(2026, 365), "2027-04-16");
  assert.equal(layer.slotToCivilISO(2027, 366), "2028-04-16");
  assert.equal(layer.slotToCivilISO(1938, 259), "1938-12-31");
  assert.equal(layer.slotToCivilISO(1938, 260), "1939-01-01");
});

test("compare budget: a third test layer sets the oldest down; the sky counts", () => {
  const layer = loadLayer();
  // Two of ours, no sky: both stand.
  assert.deepEqual(plain(layer.decideActivation(["salmon"], false, "kyoto")), { lit: ["salmon", "kyoto"], setDown: null });
  // Sky on: only one of ours may stand beside it.
  assert.deepEqual(plain(layer.decideActivation(["salmon"], true, "kyoto")), { lit: ["kyoto"], setDown: "salmon" });
  // Re-lighting a layer that already stands changes nothing.
  assert.deepEqual(plain(layer.decideActivation(["salmon", "kyoto"], false, "salmon")), { lit: ["kyoto", "salmon"], setDown: null });
});

test("salmon beads: filled, gap, and the open future bead", () => {
  const layer = loadLayer();
  const pack = readJSON("docs/assets/data/sphere-test-salmon-bonneville.json");
  const today = layer.civilToShellSlot({ year: 2026, month: 11, day: 23 });
  // Fall Chinook's great day: Sept 1, 2023 — 41,510 counted
  // (DART's own table, read at ingestion).
  const bead = layer.salmonBead(pack, "chinook", 2023, 138, today);
  assert.equal(bead.state, "filled");
  assert.equal(bead.count, 41510);
  assert.ok(bead.total > 500000, "the year's total rides with the day");
  // Steelhead the same day: 3,092 (DART's published table).
  assert.equal(layer.salmonBead(pack, "steelhead", 2023, 138, today).count, 3092);
  // A winter day in the early record, when counting had not
  // begun for the year: a gap, not a zero.
  assert.equal(layer.salmonBead(pack, "chinook", 1940, 300, today).state, "gap");
  // The +1 bead from the present shell: the future, in the
  // expansion's words — never a drawn count.
  const future = layer.salmonBead(pack, "chinook", today.shell + 1, today.slot, today);
  assert.equal(future.state, "future");
  // Coho before they were separately counted (1980): gaps.
  assert.equal(layer.salmonBead(pack, "coho", 1975, 200, today).state, "gap");
});

test("kyoto beads: the thread, the gaps, and the future", () => {
  const layer = loadLayer();
  const pack = layer.indexKyoto(readJSON("docs/assets/data/sphere-test-kyoto-blossom.json"));
  // 2023: March 25 — the earliest bloom in the record.
  const bead = layer.kyotoBead(pack, 2023);
  assert.equal(bead.state, "filled");
  assert.equal(bead.record.doy, 84);
  assert.equal(bead.record.month, 3);
  assert.equal(bead.record.day, 25);
  // 1923 stands as Aono's own workbook has it: day 97, April 7
  // (the OWID grapher CSV's 98 is a one-cell copying error,
  // documented in the generator).
  assert.equal(layer.kyotoBead(pack, 1923).record.doy, 97);
  // 813: a year whose document does not survive — a named gap.
  assert.equal(layer.kyotoBead(pack, 813).state, "gap");
  // Past the record's end: the open future bead.
  assert.equal(layer.kyotoBead(pack, 2027).state, "future");
});

test("packs: shape, spans, and the capacity law", () => {
  const salmon = readJSON("docs/assets/data/sphere-test-salmon-bonneville.json");
  const kyoto = readJSON("docs/assets/data/sphere-test-kyoto-blossom.json");
  // The capacity law: one file per series, at most 2 MB.
  for (const rel of ["docs/assets/data/sphere-test-salmon-bonneville.json", "docs/assets/data/sphere-test-kyoto-blossom.json"]) {
    assert.ok(fs.statSync(path.join(root, rel)).size <= 2 * 1024 * 1024, `${rel} within the 2 MB pack law`);
  }
  // Salmon as published: DART serves Bonneville daily counts
  // from 1939 (its "[1938]" label is the dam's first counting
  // year; no 1938 rows are served).
  assert.deepEqual(salmon.civilSpan, [1939, 2026]);
  assert.deepEqual(salmon.speciesOrder, ["chinook", "steelhead", "sockeye", "coho"]);
  assert.ok(salmon.species.chinook.days > 20000, "chinook is a long daily record");
  // Every packed total is the sum of its packed days — the pack
  // may not carry a total the days do not add up to.
  for (const sp of Object.values(salmon.species)) {
    for (const [shell, days] of Object.entries(sp.years)) {
      assert.equal(sp.totals[shell], days.reduce((a, [, c]) => a + c, 0), `total for shell ${shell}`);
      for (const [slot] of days) assert.ok(slot >= 1 && slot <= 366, "slots stay inside the window");
    }
  }
  // Coho were not separately counted before 1980.
  assert.equal(Math.min(...Object.keys(salmon.species.coho.years).map(Number)), 1980);
  // Kyoto: 838 recorded years, 812–2026, 377 gaps — the census's
  // figures, held against the compiler's own workbook.
  assert.equal(kyoto.records.length, 838);
  assert.deepEqual(kyoto.span, [812, 2026]);
  assert.equal(kyoto.gapYears, 377);
  assert.equal(kyoto.records[0][0], 812);
  assert.equal(kyoto.records[kyoto.records.length - 1][0], 2026);
});
