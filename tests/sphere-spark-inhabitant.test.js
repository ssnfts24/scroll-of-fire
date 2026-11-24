/* The Spark, inhabiting the Sphere — slice 1 (Nov 23, 2026).
 *
 * The inhabitant layer drives the keeper's Spark onto the
 * calendar's projected geometry: it stands on today's plate,
 * travels to the selected day, enters the opened day's panel,
 * lives idly while the keeper is still, and answers the
 * keeper's hour. These tests pin the module's pure half — the
 * readout grammar it shares with the Genesis layer, the ring
 * math of its travel, the hop arc, the daypart bands it shares
 * with the Spark's living voice, and the idle choice's honest
 * lean on the keeper's own play record. The browser half is
 * verified by scripted captures, not here.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const inhabitantSrc = fs.readFileSync("docs/assets/js/sphere-spark-inhabitant.js", "utf8");

/* Objects born inside the vm carry its realm's prototypes;
 * compare them as plain JSON, the way the record itself would. */
const plain = (v) => JSON.parse(JSON.stringify(v));

function loadInhabitant() {
  const sandbox = { module: { exports: {} }, console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(inhabitantSrc, sandbox, { filename: "sphere-spark-inhabitant.js" });
  return sandbox.module.exports;
}

test("the readout grammar matches the strip the Genesis layer parses", () => {
  const layer = loadInhabitant();
  assert.deepEqual(plain(layer.parseReadout("Today — Moon 8 · Day 26 · Day 222/364")),
    { moon: 8, day: 26, patternDay: 222 });
  assert.deepEqual(plain(layer.parseReadout("Selected — Moon 3 · Day 10 · Day 66/364")),
    { moon: 3, day: 10, patternDay: 66 });
  assert.deepEqual(plain(layer.parseReadout("Moon 13 · Day 28")),
    { moon: 13, day: 28, patternDay: 364 });
  assert.equal(layer.parseReadout("Day Out of Time"), null);
  assert.equal(layer.parseReadout(""), null);
});

test("pattern-day conversions round-trip across the whole ring", () => {
  const layer = loadInhabitant();
  assert.equal(layer.patternDayFor(1, 1), 1);
  assert.equal(layer.patternDayFor(8, 26), 222);
  assert.equal(layer.patternDayFor(13, 28), 364);
  assert.equal(layer.patternDayFor(0, 1), null);
  assert.equal(layer.patternDayFor(14, 1), null);
  assert.equal(layer.patternDayFor(3, 29), null);
  for (const pd of [1, 66, 222, 364]) {
    const md = layer.moonDayFor(pd);
    assert.equal(layer.patternDayFor(md.moon, md.day), pd);
  }
  assert.equal(layer.moonDayFor(365), null);
});

test("ring distance walks the short way and wraps at the Year Gate", () => {
  const layer = loadInhabitant();
  assert.equal(layer.ringDistance(222, 66), -156);
  assert.equal(layer.ringDistance(66, 222), 156);
  assert.equal(layer.ringDistance(360, 5), 9);
  assert.equal(layer.ringDistance(5, 360), -9);
  assert.equal(layer.ringDistance(100, 100), 0);
  assert.equal(layer.ringDistance(1, 364), -1);
});

test("the hop arc rises and settles, bounded for near and far travel", () => {
  const layer = loadInhabitant();
  assert.equal(layer.hopArc(0, 300), 0);
  assert.equal(layer.hopArc(1, 300), 0);
  const near = layer.hopArc(0.5, 40);
  const far = layer.hopArc(0.5, 900);
  assert.ok(near > 0 && near < far, "a farther travel hops higher");
  assert.ok(far <= 46, "the arc is bounded");
  assert.equal(layer.hopArc(0.5, 0), 6 * 1, "even a still hop breathes a little");
});

test("travel duration is bounded and grows with distance", () => {
  const layer = loadInhabitant();
  assert.ok(layer.travelDurationMs(0) >= 650);
  assert.ok(layer.travelDurationMs(100) < layer.travelDurationMs(600));
  assert.ok(layer.travelDurationMs(100000) <= 3400);
});

test("dayparts keep the living voice's bands", () => {
  const layer = loadInhabitant();
  assert.equal(layer.daypartForHour(5), "morning");
  assert.equal(layer.daypartForHour(9), "morning");
  assert.equal(layer.daypartForHour(10), "day");
  assert.equal(layer.daypartForHour(16), "day");
  assert.equal(layer.daypartForHour(17), "evening");
  assert.equal(layer.daypartForHour(20), "evening");
  assert.equal(layer.daypartForHour(21), "night");
  assert.equal(layer.daypartForHour(2), "night");
});

test("the idle choice leans on the record, rests at night, and never invents", () => {
  const layer = loadInhabitant();
  // The lean is a weighting, so it is tested as one: sweep the
  // whole draw and measure each act's share.
  const shares = (kinds, daypart) => {
    const counts = { sit: 0, observe: 0, rest: 0, visit: 0 };
    for (let r = 0; r < 1; r += 0.001) counts[layer.pickIdle(kinds, daypart, r)] += 1;
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, v / total]));
  };
  // No record at all: the plain defaults, every act reachable.
  const plainShares = shares(null, "day");
  assert.ok(Math.abs(plainShares.sit - 0.3) < 0.01);
  assert.ok(Math.abs(plainShares.observe - 0.3) < 0.01);
  assert.ok(Math.abs(plainShares.visit - 0.2) < 0.01);
  assert.ok(Math.abs(plainShares.rest - 0.2) < 0.01);
  // Night rests most, whatever the record says.
  const night = shares({ chase: 9 }, "night");
  assert.ok(Math.abs(night.rest - 0.55) < 0.01, `night rest share ${night.rest}`);
  // A chase-played record leans to visiting; an echo-played
  // record leans to observing. The lean is real but small —
  // temperament, not a track.
  assert.ok(Math.abs(shares({ chase: 3, echo: 1 }, "day").visit - 0.45) < 0.01);
  assert.ok(Math.abs(shares({ echo: 4 }, "day").observe - 0.45) < 0.01);
  // Chase and echo together: the larger count carries the lean,
  // and a tie goes to the road (chase), as the design's
  // playmate-first reading says.
  assert.ok(shares({ chase: 2, echo: 2 }, "day").visit > shares({ chase: 2, echo: 2 }, "day").observe);
  // The choice is a posture, never a progression: the same
  // inputs give the same act, every time.
  assert.equal(layer.pickIdle({ chase: 2 }, "evening", 0.62), layer.pickIdle({ chase: 2 }, "evening", 0.62));
});

test("play kinds are counted from the record's own log, nothing invented", () => {
  const layer = loadInhabitant();
  assert.deepEqual(plain(layer.playKindCounts(null)), {});
  assert.deepEqual(plain(layer.playKindCounts({})), {});
  assert.deepEqual(
    plain(layer.playKindCounts({ playLog: [{ kind: "chase" }, { kind: "echo" }, { kind: "chase" }, { stamp: {} }] })),
    { chase: 2, echo: 1 }
  );
});

test("the module loads its browser half only where a document lives", () => {
  const layer = loadInhabitant();
  assert.equal(typeof layer.mount, "function");
  // mount() in a document-less sandbox is a quiet no-op.
  assert.doesNotThrow(() => layer.mount({}));
});

/* ── Slice 2: breadth, preferences, discovery ──────────────────
 * Two keepers, the same kind of Spark (the same seed), different
 * shared records. The thin record must yield slice 1's plain
 * defaults and the honest still-learning line; the rich record
 * must yield standing favours whose lines carry the record's own
 * numbers, a wider idle repertoire, and discovery targets drawn
 * only from marked, projected days. */

const THIN_RECORD = {
  seed: "spark1-8-217-1-ab12cd34",
  name: "Selor",
  daysSeen: [222],
  pagesSeen: [],
  practiceDays: [],
  playLog: []
};

const RICH_RECORD = {
  seed: "spark1-8-217-1-ab12cd34",
  name: "Selor",
  daysSeen: [10, 38, 66, 94, 122, 150, 178, 206, 222],
  pagesSeen: ["index.html", "living-time-sphere.html", "garden.html", "episodes.html", "scroll-library.html", "genesis-oracle.html"],
  practiceDays: [66, 198],
  playLog: [
    { kind: "chase", stamp: { moon: 2, day: 10, patternDay: 38 } },
    { kind: "chase", stamp: { moon: 5, day: 10, patternDay: 122 } },
    { kind: "chase", stamp: { moon: 8, day: 26, patternDay: 222 } },
    { kind: "chase", stamp: { moon: 8, day: 26, patternDay: 222 } },
    { kind: "echo", stamp: { moon: 8, day: 26, patternDay: 222 } }
  ]
};

function richBreadth(layer) {
  return layer.breadthFromSources({
    record: RICH_RECORD,
    witnessedPds: [220],
    genesisPd: 66,
    tokenInfo: { tokenCount: 2, tokenDays: [224] }
  });
}

function thinBreadth(layer) {
  return layer.breadthFromSources({ record: THIN_RECORD });
}

test("breadth is counted from the record's own facts, source by source", () => {
  const layer = loadInhabitant();
  const b = richBreadth(layer);
  assert.equal(b.daysTogether, 9);
  assert.equal(b.lands, 6);
  assert.equal(b.moonsKept, 8);
  assert.deepEqual(plain(b.playKinds), { chase: 4, echo: 1 });
  assert.deepEqual(plain(b.witnessedDays), [220]);
  assert.equal(b.tokenCount, 2);
  assert.deepEqual(plain(b.tokenDays), [224]);
  assert.equal(b.genesisPd, 66);
  // The marks: each day carries exactly the marks its sources give it.
  assert.deepEqual(plain(b.marks[66]).sort(), ["genesis", "kept", "practice"]);
  assert.deepEqual(plain(b.marks[198]), ["practice"]);
  assert.deepEqual(plain(b.marks[220]), ["witnessed"]);
  assert.deepEqual(plain(b.marks[224]), ["token"]);
  assert.deepEqual(plain(b.marks[10]), ["kept"]);
  assert.deepEqual(plain(b.strongMarkedDays), [66, 198, 220, 224]);
  // Nothing is read that is not there: the thin record is thin.
  const t = thinBreadth(layer);
  assert.equal(t.daysTogether, 1);
  assert.equal(t.moonsKept, 1);
  assert.equal(t.tokenCount, 0);
  assert.equal(t.genesisPd, null);
  assert.deepEqual(plain(t.strongMarkedDays), []);
});

test("civil witnessed days convert only through the canonical calendar", () => {
  const layer = loadInhabitant();
  const stub = ({ date }) => ({ dayOfPatternYear: date && typeof date.getTime === "function" ? 220 : null });
  assert.equal(layer.patternDayForCivil("2026-11-21", stub), 220);
  // The Day Out of Time has no plate: 365 converts to no target.
  assert.equal(layer.patternDayForCivil("2026-04-16", () => ({ dayOfPatternYear: 365 })), null);
  assert.equal(layer.patternDayForCivil("2026-04-16", () => null), null);
  assert.equal(layer.patternDayForCivil("not-a-date", stub), null);
  assert.equal(layer.patternDayForCivil("2026-11-21", null), null);
});

test("the Genesis birth day is read as the Genesis layer reads it", () => {
  const layer = loadInhabitant();
  const raw = JSON.stringify([
    { myGenesis: false, calculated: { patternPosition: { moonNumber: 1, dayInMoon: 1 } } },
    { myGenesis: true, calculated: { patternPosition: { moonNumber: 3, dayInMoon: 10 } } }
  ]);
  assert.equal(layer.genesisPatternDayFromRaw(raw), 66);
  assert.equal(layer.genesisPatternDayFromRaw(JSON.stringify([{ calculated: {} }])), null);
  assert.equal(layer.genesisPatternDayFromRaw("not json"), null);
  assert.equal(layer.genesisPatternDayFromRaw(null), null);
});

test("token days fold from the Atlas's watch records and nothing else", () => {
  const layer = loadInhabitant();
  const records = [
    { type: "event", subtype: "episode-watched", payload: { sparkActivities: { action: "watch" } }, temporal: { patternDay: 224 } },
    { type: "event", subtype: "episode-watched", payload: { sparkActivities: { action: "watch" } }, temporal: { patternDay: null, outsideDay: true } },
    { type: "event", subtype: "episode-watched", payload: { sparkActivities: { action: "met-again" } }, temporal: { patternDay: 224 } },
    { type: "event", subtype: "day-note", payload: { sparkActivities: { action: "watch" } }, temporal: { patternDay: 90 } },
    { type: "note", subtype: "episode-watched", payload: { sparkActivities: { action: "watch" } }, temporal: { patternDay: 91 } },
    null
  ];
  const folded = layer.tokenDaysFromRecords(records);
  assert.equal(folded.tokenCount, 2, "both watches count as tokens home, the Day Out of Time one included");
  assert.deepEqual(plain(folded.tokenDays), [224], "only the counted day names a plate");
  assert.deepEqual(plain(layer.tokenDaysFromRecords(null)), { tokenCount: 0, tokenDays: [] });
});

test("a thin record invents no preferences: the defaults hold and the panel says so", () => {
  const layer = loadInhabitant();
  const b = thinBreadth(layer);
  const prefs = layer.preferencesFromBreadth(b, "Selor");
  assert.equal(prefs.stands, false);
  assert.deepEqual(plain(prefs.favours), []);
  assert.equal(prefs.roamReach, 3);
  const lines = layer.favoursLines(prefs, b, "Selor");
  assert.equal(lines.length, 1);
  assert.match(lines[0], /still learning your ways/);
  // The idle draw over the thin record is exactly slice 1's
  // default distribution — no ranging, no approaching, no
  // keepsake rest can ever be drawn.
  const shares = {};
  for (let r = 0; r < 1; r += 0.001) {
    const act = layer.pickIdle2(prefs, "day", r);
    shares[act] = (shares[act] || 0) + 1;
  }
  assert.equal(shares.roam || 0, 0);
  assert.equal(shares.approach || 0, 0);
  assert.equal(shares.keep || 0, 0);
  assert.ok(Math.abs(shares.visit / 1000 - 0.2) < 0.01);
  assert.ok(Math.abs(shares.sit / 1000 - 0.3) < 0.01);
});

test("a rich record's favours stand, and every line carries the record's own numbers", () => {
  const layer = loadInhabitant();
  const b = richBreadth(layer);
  const prefs = layer.preferencesFromBreadth(b, "Selor");
  assert.equal(prefs.stands, true);
  assert.equal(prefs.roamReach, 6, "eight Moons of keeping widen the reach to the first tier");
  const lines = layer.favoursLines(prefs, b, "Selor");
  const joined = lines.join("\n");
  assert.match(joined, /played chase 4 times/);
  assert.match(joined, /12 marked days stand in the record, your birth day among them/);
  assert.match(joined, /2 tokens have come home, on Pattern Day 224/);
  assert.match(joined, /spans 8 Moons and 6 lands/);
  assert.match(joined, /Drawn from your record together: 9 days kept, 8 Moons, 6 lands walked, 1 day witnessed, 2 tokens home\./);
});

test("two Sparks of one kind differ measurably when their records differ", () => {
  const layer = loadInhabitant();
  const shares = (prefs) => {
    const counts = {};
    for (let r = 0; r < 1; r += 0.001) {
      const act = layer.pickIdle2(prefs, "day", r);
      counts[act] = (counts[act] || 0) + 1;
    }
    return Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, v / 1000]));
  };
  const thin = shares(layer.preferencesFromBreadth(thinBreadth(layer), "Selor"));
  const rich = shares(layer.preferencesFromBreadth(richBreadth(layer), "Selor"));
  // The rich record's Spark ranges, approaches, and rests beside
  // keepsakes; the thin record's never does. The shared acts move too.
  assert.ok((rich.roam || 0) > 0.1, `rich roam share ${rich.roam}`);
  assert.ok((rich.approach || 0) > 0.09, `rich approach share ${rich.approach}`);
  assert.ok((rich.keep || 0) > 0.08, `rich keep share ${rich.keep}`);
  assert.equal(thin.roam || 0, 0);
  assert.equal(thin.approach || 0, 0);
  assert.equal(thin.keep || 0, 0);
  assert.ok(rich.visit > thin.visit, "the chase lean carries into the widened draw");
  // Night still rests, and nothing ranges in the dark.
  const night = {};
  for (let r = 0; r < 1; r += 0.001) {
    const act = layer.pickIdle2(layer.preferencesFromBreadth(richBreadth(layer), "Selor"), "night", r);
    night[act] = (night[act] || 0) + 1;
  }
  assert.ok(Math.abs(night.rest / 1000 - 0.55) < 0.01);
  assert.equal(night.roam || 0, 0);
  assert.equal(night.approach || 0, 0);
  assert.equal(night.keep || 0, 0);
});

test("a discovery target is a marked, projected day — never the post, never unmarked", () => {
  const layer = loadInhabitant();
  const marks = {
    66: ["kept", "practice", "genesis"],
    198: ["kept", "practice"],
    220: ["witnessed"],
    224: ["token"],
    222: ["kept"]
  };
  // From today's plate (222): the post itself is excluded even
  // though it is marked and projected; the unprojected 66 and
  // 198 cannot be chosen.
  const projected = [198, 220, 222, 224];
  const at = (roll) => layer.pickDiscoveryTarget(marks, projected, 222, roll);
  assert.deepEqual(plain(at(0)), { pd: 220, kind: "witnessed", dist: 2 });
  assert.deepEqual(plain(at(0.5)), { pd: 224, kind: "token", dist: 2 });
  assert.deepEqual(plain(at(0.99)), { pd: 198, kind: "practice", dist: 24 });
  // The mark named is the most particular the day carries.
  const all = layer.pickDiscoveryTarget(marks, [66], 222, 0);
  assert.equal(all.kind, "genesis");
  // Nothing marked on the face: no discovery, honestly null.
  assert.equal(layer.pickDiscoveryTarget(marks, [100, 101], 222, 0.5), null);
  assert.equal(layer.pickDiscoveryTarget({}, [220], 222, 0.5), null);
  assert.equal(layer.pickDiscoveryTarget(null, [220], 222, 0.5), null);
});
