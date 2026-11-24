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

/* ── Slice 3: the writer, the trick book, teaching ─────────────
 * The writer's discipline is the design's: append-only life
 * lines under the never-carries columns; tricks derived from
 * the record's facts by breadth, never counted performances;
 * a taught route learned only when walked back in a second
 * Moon. Performances spell choreography and write nothing —
 * the pure half only spells, and these tests pin the spelling. */

const STAMP = { moon: 8, day: 26, patternDay: 222, patternYear: 1, civilDate: "2026-11-24" };

const atlasNote = (id, pd, moon, patternYear = 1) => ({
  id, type: "note", subtype: "day-note",
  temporal: { patternDay: pd, moon, patternYear, civilDate: "2026-11-20" }, payload: {},
});
const atlasGarden = (id, pd, moon, patternYear = 1) => ({
  id, type: "event", subtype: "garden-planting",
  temporal: { patternDay: pd, moon, patternYear, civilDate: "2026-11-20" }, payload: {},
});
const atlasWatch = (id, episodeId, pd, moon, patternYear = 1) => ({
  id, type: "event", subtype: "episode-watched",
  temporal: { patternDay: pd, moon, patternYear, civilDate: "2026-11-20" },
  payload: { sparkActivities: { version: 1, action: "watch", episodeId } },
});
const atlasPlan = (id, pd, moon, status) => ({
  id, type: "note", subtype: "plan",
  temporal: { patternDay: pd, moon, patternYear: 1, civilDate: "2026-11-20" },
  payload: { schedule: { status } },
});
const atlasWord = (id, pd, moon) => ({
  id, type: "note", subtype: "word-keepsake",
  temporal: { patternDay: pd, moon, patternYear: 1, civilDate: "2026-11-20" }, payload: {},
});

test("the writer takes the design's shapes and refuses the never-carries columns by name", () => {
  const layer = loadInhabitant();
  const ok = layer.makeLifeLine("play-session", { kind: "route-demo", ref: "route:222,224", ...layer.lineCoordinateFromStamp(STAMP) });
  assert.equal(ok.line, "play-session");
  assert.equal(ok.kind, "route-demo");
  assert.equal(ok.patternDay, 222);
  for (const bad of ["score", "scores", "points", "streak", "duration", "accuracy", "refusals", "givenUp", "meter", "level", "hunger", "health", "count", "performances", "rank", "xp", "reward", "penalty"]) {
    assert.equal(
      layer.makeLifeLine("play-session", { kind: "chase", civilDate: "2026-11-24", [bad]: 1 }),
      null, `a line carrying ${bad} is refused`);
  }
  // An unknown key is refused too: the shape is a closed set.
  assert.equal(layer.makeLifeLine("play-session", { kind: "chase", civilDate: "2026-11-24", mood: "glad" }), null);
  // Shapes and their required names.
  assert.equal(layer.makeLifeLine("trick-learned", { civilDate: "2026-11-24" }), null);
  assert.equal(layer.makeLifeLine("play-session", { civilDate: "2026-11-24" }), null);
  assert.equal(layer.makeLifeLine("care-act", { kind: "close-day", civilDate: "2026-11-24" }).kind, "close-day");
  assert.equal(layer.makeLifeLine("diary", { kind: "x", civilDate: "2026-11-24" }), null);
  // A line stands on a day: no civil date, no line.
  assert.equal(layer.makeLifeLine("play-session", { kind: "chase" }), null);
  assert.equal(layer.makeLifeLine("play-session", { kind: "chase", civilDate: "Nov 24" }), null);
  assert.equal(layer.lineCoordinateFromStamp(null), null);
  assert.equal(layer.lineCoordinateFromStamp({ patternDay: 222 }), null);
});

test("appending is append-only, id-sequential, and never mutates the record it was given", () => {
  const layer = loadInhabitant();
  const record = { seed: "s", lifeLines: [] };
  const line = layer.makeLifeLine("care-act", { kind: "close-day", ref: "pattern-day:222", ...layer.lineCoordinateFromStamp(STAMP) });
  const first = layer.appendLifeLine(record, line);
  assert.equal(first.line.id, "line-0001");
  assert.equal(record.lifeLines.length, 0, "the input record is untouched");
  const second = layer.appendLifeLine(first.record,
    layer.makeLifeLine("trick-learned", { trick: "bow", via: "line-0001", ...layer.lineCoordinateFromStamp(STAMP) }));
  assert.equal(second.line.id, "line-0002");
  assert.deepEqual(plain(layer.lifeLinesOf(second.record)).map((l) => l.id), ["line-0001", "line-0002"]);
  assert.equal(layer.appendLifeLine(null, line), null);
  assert.equal(layer.appendLifeLine(record, null), null);
});

test("the keeping table mirrors SparkActivities' own, so the two folds never drift", () => {
  const activitiesSrc = fs.readFileSync("docs/assets/js/spark-activities.js", "utf8");
  const sandbox = { module: { exports: {} }, console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(activitiesSrc, sandbox, { filename: "spark-activities.js" });
  const layer = loadInhabitant();
  assert.deepEqual(plain(layer.KEEPING_KINDS_TABLE), plain(sandbox.module.exports.KEEPING_KINDS));
});

test("the facts fold reads the Atlas's own records and the Spark's own play", () => {
  const layer = loadInhabitant();
  const records = [
    atlasNote("n1", 220, 8), atlasNote("n2", 100, 4),
    atlasGarden("g1", 198, 8),
    atlasWatch("w1", "ep-the-first-light", 224, 8),
    atlasPlan("p1", 210, 8, "completed"),
    atlasPlan("p2", 211, 8, "open"),
    atlasWord("k1", 150, 6),
  ];
  const sparkRecord = { seed: "s", play: { catches: 2 }, playLog: [{ kind: "chase", stamp: { moon: 8, patternYear: 1 } }] };
  const facts = layer.lifeFactsFromRecords(records, sparkRecord);
  assert.deepEqual(plain(facts.kinds.filter((k) => k.present).map((k) => k.id)), ["day", "garden", "episode", "word"]);
  assert.deepEqual(plain(facts.witnessedDays), [100, 220]);
  assert.deepEqual(plain(facts.gardenDays), [198]);
  assert.deepEqual(plain(facts.episodes.map((e) => e.id)), ["ep-the-first-light"]);
  assert.deepEqual(plain(facts.milestones.map((m) => m.id)), ["p1"], "only a completed plan is a milestone");
  assert.deepEqual(plain(facts.wordDays), [150]);
  assert.equal(facts.catches, 2);
  assert.equal(facts.keptByYear[1].size, 5, "the keeping kinds' days stand kept (plans are not a keeping kind)");
});

test("the stage portrait is breadth: three kinds kindle, carrying plus witness bears, a full year guards", () => {
  const layer = loadInhabitant();
  const factsOf = (records, sparkRecord = { seed: "s" }) => layer.lifeFactsFromRecords(records, sparkRecord);
  assert.equal(layer.lifeStageFromFacts(factsOf([])), "spark");
  assert.equal(layer.lifeStageFromFacts(factsOf([atlasNote("n", 10, 1), atlasGarden("g", 11, 1)])), "spark");
  assert.equal(layer.lifeStageFromFacts(factsOf([
    atlasNote("n", 10, 1), atlasGarden("g", 11, 1), atlasWatch("w", "ep-x", 12, 1),
  ])), "kindled");
  const bearerRecords = [];
  for (let d = 1; d <= 14; d += 1) bearerRecords.push(atlasGarden(`g${d}`, d, 1));
  for (let d = 29; d <= 42; d += 1) bearerRecords.push(atlasNote(`n${d}`, d, 2));
  assert.equal(layer.lifeStageFromFacts(factsOf(bearerRecords)), "bearer");
  const yearRecords = [];
  for (let pd = 1; pd <= 364; pd += 1) {
    yearRecords.push(atlasNote(`y${pd}`, pd, Math.floor((pd - 1) / 28) + 1, 3));
  }
  assert.equal(layer.lifeStageFromFacts(factsOf(yearRecords)), "guardian");
});

test("each kind's paired act stands on its own record fact", () => {
  const layer = loadInhabitant();
  const factsOf = (records, sparkRecord = { seed: "s" }) => layer.lifeFactsFromRecords(records, sparkRecord);
  assert.equal(layer.pairedActFor("fire", factsOf([atlasPlan("p", 5, 1, "completed")])).stands, true);
  assert.equal(layer.pairedActFor("fire", factsOf([atlasPlan("p", 5, 1, "open")])).stands, false);
  assert.equal(layer.pairedActFor("water", factsOf([atlasNote("n", 5, 1)])).stands, true);
  assert.equal(layer.pairedActFor("shadow", factsOf([], { seed: "s", play: { catches: 1 } })).stands, true);
  assert.equal(layer.pairedActFor("shadow", factsOf([], { seed: "s", play: { catches: 0 } })).stands, false);
  assert.equal(layer.pairedActFor("air", factsOf([atlasWatch("w", "ep-x", 5, 1)])).stands, true);
  assert.equal(layer.pairedActFor("earth", factsOf([atlasGarden("g", 5, 1)])).stands, false);
  assert.equal(layer.pairedActFor("earth", factsOf([atlasGarden("g", 5, 1), atlasGarden("h", 6, 1)])).stands, true);
  assert.equal(layer.pairedActFor("light", factsOf([atlasWord("k", 5, 1)])).stands, true);
});

test("tricks derive by stage and breadth — and a learning is witnessed once, never twice", () => {
  const layer = loadInhabitant();
  const kindledWater = [
    atlasNote("n1", 220, 8), atlasGarden("g1", 198, 8), atlasWatch("w1", "ep-a", 224, 8),
  ];
  const facts = layer.lifeFactsFromRecords(kindledWater, { seed: "s" });
  assert.equal(layer.lifeStageFromFacts(facts), "kindled");
  // The signature derives at Kindled because Water's paired act stands.
  const derived = layer.derivedTricks({ kind: "water", stage: "kindled", facts, lines: [] });
  assert.deepEqual(plain(derived), [{ trick: "ripple-bow", via: "pattern-day:220" }]);
  // At Spark stage the same facts teach nothing beyond the Basics.
  assert.deepEqual(plain(layer.derivedTricks({ kind: "water", stage: "spark", facts, lines: [] })), []);
  // The Bow derives from the closing line alone, at any stage.
  const closed = [{ line: "care-act", kind: "close-day", id: "line-0003", civilDate: "2026-11-24" }];
  assert.deepEqual(plain(layer.derivedTricks({ kind: "fire", stage: "spark", facts: layer.lifeFactsFromRecords([], { seed: "s" }), lines: closed })),
    [{ trick: "bow", via: "line-0003" }]);
  // Witnessing: the first pass writes the line; the second writes nothing.
  const record = { seed: "s", lifeLines: [] };
  const fresh = layer.newTrickLines({ record, kind: "water", facts, stamp: STAMP, at: "2026-11-24T00:00:00.000Z" });
  assert.equal(fresh.length, 1);
  assert.equal(fresh[0].trick, "ripple-bow");
  assert.equal(fresh[0].civilDate, "2026-11-24");
  const after = layer.appendLifeLine(record, fresh[0]).record;
  assert.deepEqual(plain(layer.newTrickLines({ record: after, kind: "water", facts, stamp: STAMP })), []);
  // No stamp, no witnessing — the write refuses honestly.
  assert.deepEqual(plain(layer.newTrickLines({ record, kind: "water", facts, stamp: null })), []);
});

test("the Bearer signature needs the paired act in a second Moon", () => {
  const layer = loadInhabitant();
  const records = [];
  for (let d = 1; d <= 14; d += 1) records.push(atlasGarden(`g${d}`, d, 1));
  for (let d = 29; d <= 42; d += 1) records.push(atlasNote(`n${d}`, d, 2));
  records.push(atlasNote("n8", 220, 8));
  const facts = layer.lifeFactsFromRecords(records, { seed: "s" });
  assert.equal(layer.lifeStageFromFacts(facts), "bearer");
  const tricks = layer.derivedTricks({ kind: "water", stage: "bearer", facts, lines: [] }).map((d) => d.trick);
  assert.deepEqual(plain(tricks), ["ripple-bow", "fetch-the-token", "ripple-dance"],
    "witnessed days stand in Moons 2 and 8; Bearer itself teaches the fetch (slice 4), and no episode or sealed practice stands, so no lantern");
  const oneMoon = layer.lifeFactsFromRecords(records.filter((r) => r.id !== "n8"), { seed: "s" });
  const oneMoonTricks = layer.derivedTricks({ kind: "water", stage: "bearer", facts: oneMoon, lines: [] }).map((d) => d.trick);
  assert.deepEqual(plain(oneMoonTricks), ["ripple-bow", "fetch-the-token"], "one Moon teaches the signature only");
});

test("a route is its days in order; its learning is a line that names the demonstration", () => {
  const layer = loadInhabitant();
  assert.equal(layer.routeRefFor([222, 224, 226]), "route:222,224,226");
  assert.deepEqual(plain(layer.routeDaysFromRef("route:222,224,226")), [222, 224, 226]);
  assert.equal(layer.routeRefFor([222]), null, "a route is more than one day");
  assert.equal(layer.routeRefFor([222, 365]), null, "days stop at the year's edge");
  assert.equal(layer.routeRefFor(Array.from({ length: 13 }, (_, i) => i + 1)), null, "a teaching walk is bounded");
  assert.equal(layer.routeDaysFromRef("route:abc"), null);
  assert.equal(layer.routeDaysFromRef("222,224"), null);
  const lines = [
    { line: "play-session", kind: "route-demo", id: "line-0005", ref: "route:222,224,226", moon: 7, patternYear: 1, civilDate: "2026-11-10" },
    { line: "play-session", kind: "chase", id: "line-0006", civilDate: "2026-11-10" },
  ];
  const demos = layer.routeDemosFromLines(lines);
  assert.equal(demos.length, 1);
  assert.deepEqual(plain(demos[0].days), [222, 224, 226]);
  assert.equal(layer.routeLearningFor(lines, demos[0]), null);
  const learned = [...lines, { line: "trick-learned", trick: "route", via: "line-0005", civilDate: "2026-11-24" }];
  assert.equal(layer.routeLearningFor(learned, demos[0]).via, "line-0005");
});

test("the trick book: basics from birth, the unlearned named with their teaching, the route in its states", () => {
  const layer = loadInhabitant();
  const thinFacts = layer.lifeFactsFromRecords([], THIN_RECORD);
  const thin = layer.trickBookFrom({ name: "Selor", kind: "water", record: THIN_RECORD, facts: thinFacts });
  assert.equal(thin.stage, "spark");
  assert.deepEqual(plain(thin.basics.map((b) => b.trick)), ["hop", "drift", "glow-pulse", "first-note"]);
  assert.deepEqual(plain(thin.learned), []);
  assert.deepEqual(plain(thin.unlearned.map((u) => u.trick)), ["bow", "ripple-bow", "ripple-dance", "fetch-the-token", "carry-the-lantern", "whole-road"],
    "the Whole Road stands last among the unlearned, with what it asks (slice 6)");
  assert.equal(thin.road, null, "no road below Guardian");
  assert.equal(thin.roadShort, null);
  assert.match(thin.unlearned[0].teachLine, /close a day together/);
  assert.deepEqual(plain(thin.hums), [], "no episode watched, no hums — the repertoire is the watch records and nothing else");
  assert.equal(thin.route, null);

  const records = [atlasNote("n1", 220, 8), atlasGarden("g1", 198, 8), atlasWatch("w1", "ep-a", 224, 8)];
  const facts = layer.lifeFactsFromRecords(records, THIN_RECORD);
  const record = {
    ...THIN_RECORD,
    lifeLines: [
      { line: "care-act", kind: "close-day", id: "line-0001", ref: "pattern-day:222", civilDate: "2026-11-24" },
      { line: "trick-learned", trick: "bow", id: "line-0002", via: "line-0001", patternDay: 222, civilDate: "2026-11-24" },
      { line: "play-session", kind: "route-demo", id: "line-0003", ref: "route:222,224", moon: 7, patternYear: 1, civilDate: "2026-11-10" },
    ],
  };
  const book = layer.trickBookFrom({ name: "Selor", kind: "water", record, facts });
  assert.equal(book.stage, "kindled");
  assert.deepEqual(plain(book.learned.map((l) => l.trick)), ["bow"]);
  assert.equal(book.learned[0].viaPlain, "closing a day together");
  assert.equal(book.route.learned, false);
  const learnedRecord = {
    ...record,
    lifeLines: [...record.lifeLines, { line: "trick-learned", trick: "route", id: "line-0004", via: "line-0003", civilDate: "2026-11-24" }],
  };
  assert.equal(layer.trickBookFrom({ name: "Selor", kind: "water", record: learnedRecord, facts }).route.learned, true);
});

test("a performance is spelled in the ruled vocabulary, on the geometry, and spells nothing else", () => {
  const layer = loadInhabitant();
  const ctx = { postPd: 222, projected: [219, 220, 221, 222, 223, 224, 225, 300] };
  for (const trick of ["hop", "drift", "glow-pulse", "first-note", "bow",
    "flare-spin", "ripple-bow", "peek-back", "feather-loop", "root-bow", "halo-bow",
    "ember-trail", "ripple-dance", "between-worlds", "windweaver", "living-ground", "constellation"]) {
    const steps = layer.performanceSteps(trick, ctx);
    assert.ok(steps.length >= 1, `${trick} has a performance`);
    for (const step of steps) {
      assert.ok(["travel", "act", "pause"].includes(step.type), `${trick} step is a showing`);
      if (step.type === "travel") assert.ok(step.pd >= 1 && step.pd <= 364, `${trick} travels to a real day`);
    }
  }
  // The route is walked in the order it was taught, and bows at its end.
  const route = layer.performanceSteps("route", { ...ctx, routeDays: [224, 219, 226] });
  assert.deepEqual(plain(route.filter((s) => s.type === "travel").map((s) => s.pd)), [224, 219, 226]);
  assert.equal(route[route.length - 1].act, "bow");
  // Constellation lays its stars; Between Worlds crosses dimmed; Peek-Back peeks dimmed.
  assert.ok(layer.performanceSteps("constellation", ctx).some((s) => s.fx === "stars"));
  assert.ok(layer.performanceSteps("between-worlds", ctx).some((s) => s.style === "dim"));
  assert.ok(layer.performanceSteps("peek-back", ctx).some((s) => s.style === "dim"));
  assert.ok(layer.performanceSteps("living-ground", ctx).every((s) => s.type !== "travel" || s.style === "hop"),
    "Living Ground travels by hops only");
  // An unknown trick has no performance; a route with no days has none.
  assert.deepEqual(plain(layer.performanceSteps("cartwheel", ctx)), []);
  assert.deepEqual(plain(layer.performanceSteps("route", { ...ctx, routeDays: [] })), []);
  assert.deepEqual(plain(layer.performanceSteps("hop", { postPd: null })), []);
});

/* ── Slice 4: the carrying tricks and the hum repertoire ───────
 * The carrying tricks derive exactly as Gate E derives them in
 * the app: Fetch the Token with the Bearer stage itself; Carry
 * the Lantern at Bearer when an episode stands watched through
 * (a skill met, its token home) and a practice stands sealed
 * (a plan completed). The hum repertoire derives from the
 * watch records and is stored nowhere else. */

const atlasWatchFull = (id, episodeId, pd, moon, patternYear = 1) => ({
  id, type: "event", subtype: "episode-watched",
  temporal: { patternDay: pd, moon, patternYear, civilDate: "2026-11-20" },
  payload: {
    sparkActivities: {
      version: 1, action: "watch", episodeId, chapterN: 4,
      distinguisher: {
        name: "Through the Day Door", land: "the Observatory", moonName: "Breath Gate",
        token: "the Day Door",
        line: "Through the Day Door — of the Observatory, under Breath Gate, the Day Door"
      },
      hum: { rootHz: 174, scale: "Freygish", motifHz: [261, 348, 522], note: "" },
      skill: { n: 1, name: "Read the day", kitMark: "the lantern, opened", state: "met" }
    }
  },
});

function bearerRecords() {
  const records = [];
  for (let d = 1; d <= 14; d += 1) records.push(atlasGarden(`g${d}`, d, 1));
  for (let d = 29; d <= 42; d += 1) records.push(atlasNote(`n${d}`, d, 2));
  return records;
}

test("the facts fold carries the watch record's hum and distinguisher — the repertoire's only source", () => {
  const layer = loadInhabitant();
  const facts = layer.lifeFactsFromRecords([atlasWatchFull("w1", "through-the-day-door", 224, 8)], { seed: "s" });
  assert.equal(facts.episodes.length, 1);
  assert.equal(facts.episodes[0].token, "the Day Door");
  assert.equal(facts.episodes[0].land, "the Observatory");
  const repertoire = layer.humRepertoireFromFacts(facts);
  assert.equal(repertoire.length, 1);
  assert.equal(repertoire[0].episodeId, "through-the-day-door");
  assert.deepEqual(plain(repertoire[0].motifHz), [261, 348, 522]);
  assert.equal(repertoire[0].patternDay, 224, "the day the token came home is the performance's place");
  // A watch whose record carries no hum teaches none; a bare
  // episode fact (slice 3's shape) teaches none either.
  const bare = layer.lifeFactsFromRecords([atlasWatch("w2", "ep-bare", 100, 4)], { seed: "s" });
  assert.deepEqual(plain(layer.humRepertoireFromFacts(bare)), []);
  assert.deepEqual(plain(layer.humRepertoireFromFacts(null)), []);
});

test("the site repertoire and the activities module's own fold agree, record for record", () => {
  const activitiesSrc = fs.readFileSync("docs/assets/js/spark-activities.js", "utf8");
  const sandbox = { module: { exports: {} }, console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(activitiesSrc, sandbox, { filename: "spark-activities.js" });
  const Activities = sandbox.module.exports;
  const layer = loadInhabitant();
  const records = [atlasWatchFull("w1", "through-the-day-door", 224, 8), atlasWatch("w2", "ep-bare", 100, 4)];
  const theirs = Activities.humRepertoire(records);
  const ours = layer.humRepertoireFromFacts(layer.lifeFactsFromRecords(records, { seed: "s" }));
  assert.equal(ours.length, theirs.length);
  assert.equal(ours[0].episodeId, theirs[0].episodeId);
  assert.deepEqual(plain(ours[0].motifHz), plain(theirs[0].motifHz));
  assert.equal(ours[0].rootHz, theirs[0].rootHz);
});

test("the carrying tricks derive at Bearer, on Gate E's exact conditions", () => {
  const layer = loadInhabitant();
  const factsOf = (records) => layer.lifeFactsFromRecords(records, { seed: "s" });
  const ids = (records, stage) => plain(layer.derivedTricks({ kind: "water", stage, facts: factsOf(records), lines: [] }).map((d) => d.trick));
  // Bearer alone: the fetch, and only the fetch.
  assert.ok(ids(bearerRecords(), "bearer").includes("fetch-the-token"));
  assert.ok(!ids(bearerRecords(), "bearer").includes("carry-the-lantern"));
  // Bearer + an episode watched: still no lantern without a sealed practice.
  const withWatch = [...bearerRecords(), atlasWatchFull("w1", "through-the-day-door", 224, 8)];
  assert.ok(!ids(withWatch, "bearer").includes("carry-the-lantern"));
  // Bearer + a sealed practice: still no lantern without the episode.
  const withPlan = [...bearerRecords(), atlasPlan("p1", 210, 8, "completed")];
  assert.ok(!ids(withPlan, "bearer").includes("carry-the-lantern"));
  // Both standing: the lantern derives, learned by the episode.
  const both = [...withWatch, atlasPlan("p1", 210, 8, "completed")];
  const derived = layer.derivedTricks({ kind: "water", stage: "bearer", facts: factsOf(both), lines: [] });
  const lantern = derived.find((d) => d.trick === "carry-the-lantern");
  assert.ok(lantern, "the lantern derives when both acts stand");
  assert.equal(lantern.via, "through-the-day-door");
  assert.equal(derived.find((d) => d.trick === "fetch-the-token").via, "stage:bearer");
  // Below Bearer the same facts teach neither carrying trick.
  assert.ok(!ids(both, "kindled").includes("fetch-the-token"));
  assert.ok(!ids(both, "kindled").includes("carry-the-lantern"));
  // Guardian keeps both.
  assert.ok(ids(both, "guardian").includes("fetch-the-token"));
  assert.ok(ids(both, "guardian").includes("carry-the-lantern"));
});

test("a carrying learning is witnessed once, like every learning", () => {
  const layer = loadInhabitant();
  const records = [...bearerRecords(), atlasWatchFull("w1", "through-the-day-door", 224, 8), atlasPlan("p1", 210, 8, "completed")];
  const facts = layer.lifeFactsFromRecords(records, { seed: "s" });
  assert.equal(layer.lifeStageFromFacts(facts), "bearer");
  const record = { seed: "s", lifeLines: [] };
  const fresh = layer.newTrickLines({ record, kind: "water", facts, stamp: STAMP, at: "2026-11-24T00:00:00.000Z" });
  const tricks = plain(fresh.map((l) => l.trick));
  assert.ok(tricks.includes("fetch-the-token"), "the fetch is witnessed");
  assert.ok(tricks.includes("carry-the-lantern"), "the lantern is witnessed");
  let grown = record;
  for (const line of fresh) grown = layer.appendLifeLine(grown, line).record;
  assert.deepEqual(plain(layer.newTrickLines({ record: grown, kind: "water", facts, stamp: STAMP })), [],
    "a second fold over the same record witnesses nothing twice");
});

test("the book names the carrying tricks' stages, learned or not, and lists the hums", () => {
  const layer = loadInhabitant();
  const records = [...bearerRecords(), atlasWatchFull("w1", "through-the-day-door", 224, 8), atlasPlan("p1", 210, 8, "completed")];
  const facts = layer.lifeFactsFromRecords(records, { seed: "s" });
  const record = {
    seed: "s",
    lifeLines: [
      { line: "trick-learned", trick: "fetch-the-token", id: "line-0001", via: "stage:bearer", patternDay: 222, civilDate: "2026-11-24" },
      { line: "trick-learned", trick: "carry-the-lantern", id: "line-0002", via: "through-the-day-door", patternDay: 222, civilDate: "2026-11-24" },
    ],
  };
  const book = layer.trickBookFrom({ name: "Selor", kind: "water", record, facts });
  const fetch = book.learned.find((l) => l.trick === "fetch-the-token");
  const lantern = book.learned.find((l) => l.trick === "carry-the-lantern");
  assert.equal(fetch.where, "performed in Their Home");
  assert.equal(fetch.viaPlain, "the Bearer stage");
  assert.equal(lantern.where, "carried at an opened day");
  assert.match(lantern.viaPlain, /skill met/);
  assert.equal(book.hums.length, 1);
  assert.equal(book.hums[0].episodeId, "through-the-day-door");
  // Face tricks carry no `where` — their stage is this face.
  const kindledFacts = layer.lifeFactsFromRecords(
    [atlasNote("n1", 220, 8), atlasGarden("g1", 198, 8), atlasWatch("w1", "ep-a", 224, 8)], { seed: "s" });
  const kindledBook = layer.trickBookFrom({ name: "Selor", kind: "water", record: THIN_RECORD, facts: kindledFacts });
  const fetchU = kindledBook.unlearned.find((u) => u.trick === "fetch-the-token");
  const lanternU = kindledBook.unlearned.find((u) => u.trick === "carry-the-lantern");
  assert.match(fetchU.teachLine, /Their Home/);
  assert.match(lanternU.teachLine, /opened day/);
});

test("a hum performance travels to the token's day when it stands on the face — and never fakes the trip", () => {
  const layer = loadInhabitant();
  const ctx = { postPd: 222, projected: [220, 222, 224], humPd: 224, humMs: 1760 };
  const steps = layer.performanceSteps("hum", ctx);
  assert.deepEqual(plain(steps.map((s) => s.type)), ["travel", "act", "travel"]);
  assert.equal(steps[0].pd, 224);
  assert.equal(steps[1].act, "hum");
  assert.equal(steps[1].ms, 1760);
  assert.equal(steps[2].pd, 222, "the Spark comes home to its post");
  // The token day not on the face: the hum sounds where the Spark stands.
  const offFace = layer.performanceSteps("hum", { ...ctx, humPd: 100 });
  assert.deepEqual(plain(offFace.map((s) => s.type)), ["act"]);
  // The Day Out of Time names no plate: same honesty.
  const noPlate = layer.performanceSteps("hum", { ...ctx, humPd: null });
  assert.deepEqual(plain(noPlate.map((s) => s.type)), ["act"]);
  // Already standing on the token day: no travel at all.
  const atHome = layer.performanceSteps("hum", { ...ctx, humPd: 222 });
  assert.deepEqual(plain(atHome.map((s) => s.type)), ["act"]);
});

/* --------------------- slice 5: the season --------------------- */

const MOON8_CHAR = { idx: 8, name: "Deep Mirror", element: "Water", essence: "Reflection, hidden pattern, inner waters", practice: "Still water work" };
const MOON9_CHAR = { idx: 9, name: "Return Path", element: "Earth", essence: "The way back, walked in the body", practice: "Walking work" };

test("slice 5 — the season context reads the year's turning from the pipeline's own facts", () => {
  const layer = loadInhabitant();
  // An ordinary Moon day: the Moon and its quarter, nothing more claimed.
  const moon = layer.seasonContextFor({ patternDay: 222, moon: 8, moonDay: 26, patternYear: 1 }, MOON8_CHAR);
  assert.equal(moon.kind, "moon");
  assert.equal(moon.quarter, "autumn");
  assert.equal(moon.moonName, "Deep Mirror");
  assert.equal(moon.seasonDay, null);
  // The Moon's last day is its turn; the season's day is the next Moon's first.
  const turn = layer.seasonContextFor({ patternDay: 224, moon: 8, moonDay: 28, patternYear: 1 }, MOON8_CHAR);
  assert.equal(turn.kind, "moon-turn");
  assert.equal(turn.seasonDay, 225);
  // The year's own turn wraps: Moon 13's last day is PD 364, and its season day is the Gate.
  const yearTurn = layer.seasonContextFor({ patternDay: 364, moon: 13, moonDay: 28, patternYear: 1 }, { idx: 13, name: "The Thirteenth Moon" });
  assert.equal(yearTurn.kind, "moon-turn");
  assert.equal(yearTurn.seasonDay, 1);
  // A Moon opening: behind it stands the day just closed.
  const opening = layer.seasonContextFor({ patternDay: 225, moon: 9, moonDay: 1, patternYear: 1 }, MOON9_CHAR);
  assert.equal(opening.kind, "moon-opening");
  assert.equal(opening.seasonDay, 224);
  // Moon 1 Day 1 is the Year Gate, not a plain opening.
  const gate = layer.seasonContextFor({ patternDay: 1, moon: 1, moonDay: 1, patternYear: 2 }, { idx: 1, name: "First Moon" });
  assert.equal(gate.kind, "year-gate");
  assert.equal(gate.seasonDay, 364);
  // The days outside the count: no plate, no pretence.
  const doot = layer.seasonContextFor({ patternDay: null, moon: null, moonDay: null, isDayOutOfTime: true }, null);
  assert.equal(doot.kind, "day-out-of-time");
  const deep = layer.seasonContextFor({ patternDay: null, moon: null, moonDay: null, isDeepTimeDay: true }, null);
  assert.equal(deep.kind, "deep-time-day");
  // No position at all reads as no season.
  assert.equal(layer.seasonContextFor(null, null), null);
  assert.equal(layer.seasonContextFor({ patternDay: null }, null), null);
  // The quarter rule is the home world's: four quarters from the Gate.
  assert.equal(layer.quarterForPatternDay(1), "spring");
  assert.equal(layer.quarterForPatternDay(92), "summer");
  assert.equal(layer.quarterForPatternDay(200), "autumn");
  assert.equal(layer.quarterForPatternDay(300), "winter");
  assert.equal(layer.quarterForPatternDay(null), null);
});

test("slice 5 — the season's words name the Moon, the turn, and the threshold, and invent nothing", () => {
  const layer = loadInhabitant();
  const turn = layer.seasonContextFor({ patternDay: 224, moon: 8, moonDay: 28, patternYear: 1 }, MOON8_CHAR);
  const turnLine = layer.seasonLineFor(turn, { name: "Selor", nextMoonChar: MOON9_CHAR });
  assert.match(turnLine, /Moon turns/);
  assert.match(turnLine, /Deep Mirror/);
  assert.match(turnLine, /Return Path/, "the next Moon is named at the turn, from the calendar's own data");
  const doot = layer.seasonContextFor({ patternDay: null, isDayOutOfTime: true }, null);
  const dootLine = layer.seasonLineFor(doot, { name: "Selor" });
  assert.match(dootLine, /outside the count/);
  assert.match(dootLine, /no plate/i);
  assert.match(dootLine, /keeps the threshold/);
  const gate = layer.seasonContextFor({ patternDay: 1, moon: 1, moonDay: 1, patternYear: 2 }, { idx: 1, name: "First Moon", essence: "Beginnings" });
  assert.match(layer.seasonLineFor(gate, { name: "Selor" }), /Year Gate/);
  const moon = layer.seasonContextFor({ patternDay: 222, moon: 8, moonDay: 26, patternYear: 1 }, MOON8_CHAR);
  const moonLine = layer.seasonLineFor(moon, { name: "Selor" });
  assert.match(moonLine, /Deep Mirror/);
  assert.match(moonLine, /Autumn of the Pattern year/);
  assert.ok(!/rain|snow|storm|sunny|cloud/i.test(moonLine + turnLine + dootLine), "no weather is ever claimed");
  assert.equal(layer.seasonLineFor(null, { name: "Selor" }), null);
});

/* ------------------ slice 5: surroundings ------------------ */

test("slice 5 — surroundings answer the opened day's strongest mark, and a garden day outranks plain marks", () => {
  const layer = loadInhabitant();
  const marks = { 218: ["kept", "genesis"], 220: ["kept", "witnessed"], 221: ["kept"] };
  assert.deepEqual(plain(layer.surroundingsForDay({ patternDay: 218, marks, gardenDays: [] })),
    { kind: "genesis", posture: "observe", glow: true }, "the birth day glows");
  assert.deepEqual(plain(layer.surroundingsForDay({ patternDay: 219, marks, gardenDays: [219] })),
    { kind: "garden", posture: "observe", glow: false }, "a garden day is its own surrounding");
  assert.equal(layer.surroundingsForDay({ patternDay: 218, marks, gardenDays: [218] }).kind, "genesis",
    "the birth day still outranks the garden");
  assert.equal(layer.surroundingsForDay({ patternDay: 220, marks, gardenDays: [] }).kind, "witnessed");
  assert.equal(layer.surroundingsForDay({ patternDay: 221, marks, gardenDays: [] }).posture, "sit");
  assert.equal(layer.surroundingsForDay({ patternDay: 300, marks, gardenDays: [] }).kind, null,
    "an unmarked day claims no surrounding");
  assert.equal(layer.surroundingsForDay({ patternDay: null, marks, gardenDays: [] }).kind, null);
});

/* ---------------------- slice 5: care ---------------------- */

test("slice 5 — the care kinds are Gate E's names, and the open carry reads Gate E's semantics", () => {
  const layer = loadInhabitant();
  assert.deepEqual(plain(layer.CARE_KINDS), ["kindle", "tend", "rest", "close-day", "carry", "carry-end", "sat-with"]);
  const coord = layer.lineCoordinateFromStamp(STAMP);
  const carry = layer.makeLifeLine("care-act", { kind: "carry", ref: "keepsake:k1", ...coord });
  const withId = { ...carry, id: "line-0007" };
  assert.equal(layer.openCarryFromLines([withId]).ref, "keepsake:k1");
  const end = layer.makeLifeLine("care-act", { kind: "carry-end", ref: "line-0007", ...coord });
  assert.equal(layer.openCarryFromLines([withId, end]), null, "an end naming the carry's id closes it");
  const wrongEnd = layer.makeLifeLine("care-act", { kind: "carry-end", ref: "line-9999", ...coord });
  assert.equal(layer.openCarryFromLines([withId, wrongEnd]).ref, "keepsake:k1",
    "an end naming another line closes nothing");
  assert.equal(layer.openCarryFromLines([]), null);
});

test("slice 5 — the day's care state dedupes by the civil day, per kind and per ref", () => {
  const layer = loadInhabitant();
  const coord = layer.lineCoordinateFromStamp(STAMP); // civilDate 2026-11-24
  const lines = [
    layer.makeLifeLine("care-act", { kind: "kindle", ref: "pattern-day:222", ...coord }),
    layer.makeLifeLine("care-act", { kind: "tend", ref: "wear:kind-glow", ...coord }),
    layer.makeLifeLine("care-act", { kind: "sat-with", ref: "pattern-day:218", ...coord }),
    layer.makeLifeLine("care-act", { kind: "rest", ...layer.lineCoordinateFromStamp({ ...STAMP, civilDate: "2026-11-20" }) }),
  ];
  const state = layer.careStateFromLines(lines, "2026-11-24");
  assert.equal(state.kindledToday, true);
  assert.equal(state.restedToday, false, "a rest on another day is not today's rest");
  assert.deepEqual(plain(state.tendRefsToday), ["wear:kind-glow"], "a dress chosen today stands; another dress may still be chosen");
  assert.deepEqual(plain(state.satWithRefsToday), ["pattern-day:218"], "sat-with dedupes per day sat with");
  const other = layer.careStateFromLines(lines, "2026-11-25");
  assert.equal(other.kindledToday, false);
});

/* ---------------- slice 5: one trick derivation ---------------- */

test("slice 5 — the core-rule mirror is pinned against the companion core's own table", () => {
  const coreSrc = fs.readFileSync("docs/assets/js/spark-companion.js", "utf8");
  const sandbox = { module: { exports: {} }, console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(coreSrc, sandbox, { filename: "spark-companion.js" });
  const Core = sandbox.module.exports;
  const layer = loadInhabitant();
  for (const kind of Object.keys(Core.KIND_TRICKS)) {
    const core = Core.KIND_TRICKS[kind];
    const mirror = layer.CORE_KIND_TRICK_RULES[kind];
    assert.deepEqual(plain(mirror), plain({ id: core.id, via: core.via, need: core.need, teacher: core.teacher }),
      `${kind}: the mirror matches the core's rule`);
    assert.equal(Core.RULED_SIGNATURE_FOR_KIND[kind], layer.SIGNATURE_BY_KIND[kind],
      `${kind}: the core names the same signature the book does`);
  }
});

test("slice 5 — a signature learned on the core's face stands in the book, and nobody loses it", () => {
  const layer = loadInhabitant();
  const facts = layer.lifeFactsFromRecords([], { seed: "s" });
  // By count: eight pets teach Ripple on the core's face.
  const byCount = { seed: "s", play: { pets: 8 } };
  assert.equal(layer.legacySignatureStands(byCount, "water").stands, true);
  assert.equal(layer.legacySignatureStands(byCount, "water").via, "play:ripple");
  const derived = layer.derivedTricks({ kind: "water", stage: "spark", facts, lines: [], record: byCount });
  assert.ok(derived.some((d) => d.trick === "ripple-bow" && d.via === "play:ripple"),
    "the signature derives at any stage when the core's learning stands");
  // By stored id: an earlier learning's store teaches it with no counts at all.
  const byStore = { seed: "s", play: { tricks: ["ripple"] } };
  assert.equal(layer.legacySignatureStands(byStore, "water").stands, true);
  // Below the need, nothing stands — the unification invents nothing.
  const below = { seed: "s", play: { pets: 7 } };
  assert.equal(layer.legacySignatureStands(below, "water").stands, false);
  assert.ok(!layer.derivedTricks({ kind: "water", stage: "spark", facts, lines: [], record: below })
    .some((d) => d.trick === "ripple-bow"));
  // The book shows it learned, with the play that taught it, and not as unlearned.
  const book = layer.trickBookFrom({ name: "Selor", kind: "water", record: byCount, facts });
  const entry = book.learned.find((l) => l.trick === "ripple-bow");
  assert.ok(entry, "the book lists the signature as learned");
  assert.match(entry.viaPlain, /petting, patiently/);
  assert.ok(!book.unlearned.some((u) => u.trick === "ripple-bow"));
  // The learning pass witnesses it into a line, once.
  const fresh = layer.newTrickLines({ record: byCount, kind: "water", facts, stamp: STAMP, at: "2026-11-24T00:00:00Z" });
  const sigLine = fresh.find((l) => l.trick === "ripple-bow");
  assert.ok(sigLine && sigLine.via === "play:ripple", "witnessed under the play's own via");
  const after = { ...byCount, lifeLines: fresh };
  assert.equal(layer.newTrickLines({ record: after, kind: "water", facts, stamp: STAMP }).length, 0,
    "a witnessed learning is never witnessed twice");
});

test("slice 5 — both faces agree on one record: the core's tricksFor and the book's derivation", () => {
  const coreSrc = fs.readFileSync("docs/assets/js/spark-companion.js", "utf8");
  const sandbox = { module: { exports: {} }, console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(coreSrc, sandbox, { filename: "spark-companion.js" });
  const Core = sandbox.module.exports;
  const layer = loadInhabitant();
  const fixtures = [
    { seed: "spark1-8-217-1-ab12cd34" },                                            // nothing learned anywhere
    { seed: "spark1-8-217-1-ab12cd34", play: { pets: 8 } },                         // the count teaches it
    { seed: "spark1-8-217-1-ab12cd34", play: { tricks: ["ripple"] } },              // the store teaches it
    { seed: "spark1-8-217-1-ab12cd34", care: { kindles: 2 } },                      // a count for another kind's trick: teaches nothing here
    { seed: "spark1-8-217-1-ab12cd34", lifeLines: [{ line: "trick-learned", trick: "ripple-bow", id: "line-0001" }] }, // the book's line teaches it
  ];
  for (const record of fixtures) {
    const companion = Core.generate(record.seed);
    const kindTrick = Core.tricksFor({ record, companion }).find((t) => t.kindTrick);
    const facts = layer.lifeFactsFromRecords([], record);
    const book = layer.trickBookFrom({ name: "Selor", kind: companion.kind, record, facts });
    const signature = layer.SIGNATURE_BY_KIND[companion.kind];
    const inBook = book.learned.some((l) => l.trick === signature);
    assert.equal(kindTrick.learned, inBook,
      `faces agree for ${JSON.stringify(record.play || record.care || record.lifeLines || {})}: core=${kindTrick.learned}, book=${inBook}`);
  }
  // The pinned honesty holds: a fresh record knows no tricks on either face.
  const fresh = { seed: "spark1-8-217-1-ab12cd34" };
  const companion = Core.generate(fresh.seed);
  assert.ok(Core.tricksFor({ record: fresh, companion }).every((t) => !t.learned));
});

/* ------------------ slice 5: the carried line ------------------ */

test("slice 5 — the carried line lands on a keepsake's own record once, in the design's words", () => {
  const layer = loadInhabitant();
  const record = { id: "atlas-1", type: "artifact", subtype: "hidden-keepsake", payload: { hiddenLayer: { kind: "pressed-leaf" } } };
  const first = layer.carriedLineForRecord(record, { civilDate: "2026-11-24", patternDay: 222 });
  assert.equal(first.line.text, "carried to you, 2026-11-24");
  assert.equal(first.record.payload.carriedLines.length, 1);
  assert.equal(record.payload.carriedLines, undefined, "the input record is untouched");
  assert.equal(layer.carriedLineForRecord(first.record, { civilDate: "2026-11-25", patternDay: 223 }), null,
    "a record already carrying a line is never written twice");
  assert.equal(layer.carriedLineForRecord(record, { civilDate: "Nov 24" }), null, "no honest day, no line");
  assert.equal(layer.carriedLineForRecord(null, { civilDate: "2026-11-24" }), null);
  assert.deepEqual(plain(layer.carriedLinesOfRecord(first.record)).map((l) => l.text), ["carried to you, 2026-11-24"]);
});

/* ── Slice 6: the Whole Road ─────────────────────────────────
 * The Guardian set piece, in the addendum's elevated form:
 * the Sphere itself is the stage, and the programme is
 * composed only from record facts — Gate E's derivation
 * mirrored beat for beat (the birth coordinate, the hums in
 * the order they came home, the tricks in the order they
 * were learned, the first closing), null below Guardian. */

function guardianYearRecords() {
  const records = [];
  for (let pd = 1; pd <= 364; pd += 1) {
    records.push(atlasNote(`y${pd}`, pd, Math.floor((pd - 1) / 28) + 1, 1));
  }
  return records;
}

const ROAD_COMPANION = { kind: "water", birthMoon: 8, birthPatternDay: 217 };
const ROAD_RECORD = {
  seed: "spark1-8-217-1-ab12cd34", name: "Selor",
  lifeLines: [
    { line: "care-act", kind: "close-day", id: "line-0001", ref: "pattern-day:218", patternDay: 218, patternYear: 1, moon: 8, civilDate: "2026-11-18" },
    { line: "trick-learned", trick: "bow", id: "line-0002", via: "line-0001", patternDay: 218, patternYear: 1, moon: 8, civilDate: "2026-11-18" },
    { line: "trick-learned", trick: "ripple-bow", id: "line-0003", via: "pattern-day:219", patternDay: 219, patternYear: 1, moon: 8, civilDate: "2026-11-19" },
    { line: "trick-learned", trick: "carry-the-lantern", id: "line-0004", via: "ep-first", patternDay: 220, patternYear: 1, moon: 8, civilDate: "2026-11-20" },
    { line: "trick-learned", trick: "ripple-dance", id: "line-0005", via: "pattern-day:221", patternDay: 221, patternYear: 1, moon: 8, civilDate: "2026-11-21" },
    { line: "care-act", kind: "close-day", id: "line-0006", ref: "pattern-day:230", patternDay: 230, patternYear: 1, moon: 8, civilDate: "2026-11-23" },
  ],
};

function roadFacts(layer, extra = []) {
  return layer.lifeFactsFromRecords([...guardianYearRecords(), ...extra], ROAD_RECORD);
}

test("slice 6 — the Whole Road programme is null below Guardian, and stands at Guardian in Gate E's order", () => {
  const layer = loadInhabitant();
  const bearerFacts = layer.lifeFactsFromRecords(bearerRecords(), ROAD_RECORD);
  assert.equal(layer.lifeStageFromFacts(bearerFacts), "bearer");
  assert.equal(layer.wholeRoadProgrammeFrom({ name: "Selor", kind: "water", record: ROAD_RECORD, facts: bearerFacts, companion: ROAD_COMPANION }), null,
    "no road before the full year stands kept");
  assert.equal(layer.wholeRoadProgrammeFrom({ name: "Selor", kind: "water", record: THIN_RECORD, facts: layer.lifeFactsFromRecords([], THIN_RECORD), companion: ROAD_COMPANION }), null);

  /* The watches stand in the repository's own presentation
   * — newest first, as the record reaches the fold. The
   * programme walks them back into the order they came
   * home, Gate E's completion order, never the presentation's. */
  const facts = roadFacts(layer, [
    atlasWatchFull("w1", "ep-first", 219, 8),
    atlasWatchFull("w2", "ep-second", 205, 8),
  ]);
  const programme = layer.wholeRoadProgrammeFrom({ name: "Selor", kind: "water", record: ROAD_RECORD, facts, companion: ROAD_COMPANION });
  assert.deepEqual(plain(programme.beats.map((b) => [b.beat, b.ref, b.pd])), [
    ["birth", "spark1-8-217-1-ab12cd34", 217],
    ["hum", "ep-second", 205],
    ["hum", "ep-first", 219],
    ["trick", "bow", 218],
    ["trick", "ripple-bow", 219],
    ["trick", "carry-the-lantern", 220],
    ["trick", "ripple-dance", 221],
    ["closing", "line-0001", 218],
  ]);
  assert.equal(programme.beats[0].text, "Born Moon 8 · Pattern Day 217", "Gate E's own words for the birth beat");
  assert.equal(programme.beats[2].text, "The hum of Through the Day Door, carried home");
  assert.equal(programme.beats[3].text, "Bow, learned by closing a day together");
  assert.equal(programme.beats[7].text, "The first day closed together");
  assert.equal(programme.bowStands, true);
  assert.equal(programme.lanternStands, true);
});

test("slice 6 — the programme holds only what the record holds, and pads nothing", () => {
  const layer = loadInhabitant();
  /* A full year kept, but no hums and no learnings: the road
   * is the birth day alone, honestly short. */
  const bare = layer.wholeRoadProgrammeFrom({
    name: "Selor", kind: "water",
    record: { seed: "spark1-8-217-1-ab12cd34", name: "Selor", lifeLines: [] },
    facts: roadFacts(layer), companion: ROAD_COMPANION,
  });
  assert.deepEqual(plain(bare.beats.map((b) => b.beat)), ["birth"]);
  assert.equal(bare.bowStands, false);
  assert.equal(bare.lanternStands, false);
  /* An episode watched whose record carries no hum teaches
   * no hum beat — the repertoire's rule, the road's too. */
  const noHum = layer.wholeRoadProgrammeFrom({
    name: "Selor", kind: "water", record: ROAD_RECORD,
    facts: roadFacts(layer, [atlasWatch("w9", "ep-silent", 222, 8)]), companion: ROAD_COMPANION,
  });
  assert.equal(noHum.beats.filter((b) => b.beat === "hum").length, 0);
  /* A birth on the Day Out of Time (365 in the seed grammar)
   * names no plate: the beat stands, its station is null,
   * and no day is invented for it. */
  const doot = layer.wholeRoadProgrammeFrom({
    name: "Selor", kind: "water", record: ROAD_RECORD, facts: roadFacts(layer),
    companion: { kind: "water", birthMoon: null, birthPatternDay: 365 },
  });
  assert.equal(doot.beats[0].pd, null);
  assert.equal(doot.beats[0].text, "Born of the seed");
});

test("slice 6 — the short road walks the year's turning points only, from the same programme", () => {
  const layer = loadInhabitant();
  /* Presentation order again (newest first): the hums came
   * home ep-second, ep-third, ep-first. */
  const facts = roadFacts(layer, [
    atlasWatchFull("w1", "ep-first", 219, 8),
    atlasWatchFull("w3", "ep-third", 212, 8),
    atlasWatchFull("w2", "ep-second", 205, 8),
  ]);
  const programme = layer.wholeRoadProgrammeFrom({ name: "Selor", kind: "water", record: ROAD_RECORD, facts, companion: ROAD_COMPANION });
  const short = layer.wholeRoadShortFrom(programme, "water");
  assert.deepEqual(plain(short.beats.map((b) => [b.beat, b.ref])), [
    ["birth", "spark1-8-217-1-ab12cd34"],
    ["hum", "ep-second"], ["hum", "ep-first"],
    ["trick", "ripple-bow"], ["trick", "ripple-dance"],
    ["closing", "line-0001"],
  ], "the middle hum and the carrying feat are the full road's; the signatures are the kind's own");
  /* One hum home: it stands once, never twice. */
  const oneHum = layer.wholeRoadProgrammeFrom({
    name: "Selor", kind: "water", record: ROAD_RECORD,
    facts: roadFacts(layer, [atlasWatchFull("w1", "ep-first", 219, 8)]), companion: ROAD_COMPANION,
  });
  assert.equal(layer.wholeRoadShortFrom(oneHum, "water").beats.filter((b) => b.beat === "hum").length, 1);
  assert.equal(layer.wholeRoadShortFrom(null, "water"), null);
});

test("slice 6 — the road is spelled on the geometry in programme order, and ends in rest", () => {
  const layer = loadInhabitant();
  const facts = roadFacts(layer, [
    atlasWatchFull("w1", "ep-first", 219, 8),
    atlasWatchFull("w2", "ep-second", 205, 8),
  ]);
  const programme = layer.wholeRoadProgrammeFrom({ name: "Selor", kind: "water", record: ROAD_RECORD, facts, companion: ROAD_COMPANION });
  const projected = [];
  for (let pd = 197; pd <= 224; pd += 1) projected.push(pd);
  const steps = layer.wholeRoadSteps(programme.beats, { postPd: 222, projected, bowStands: programme.bowStands });
  /* The road departs for the birth day first. */
  assert.deepEqual(plain(steps[0]), { type: "travel", pd: 217, style: "drift", beat: 0 });
  /* Every beat is acted, in order; the last act is rest,
   * one beat past the programme's end. */
  const actBeats = steps.filter((s) => s.type === "act").map((s) => s.beat);
  assert.deepEqual(plain([...new Set(actBeats)]), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(plain(steps[steps.length - 1]), { type: "act", act: "rest", ms: 2000, beat: 8 });
  /* The hums sound their own motifs at their own stations. */
  const humActs = steps.filter((s) => s.type === "act" && s.act === "hum");
  assert.deepEqual(plain(humActs.map((s) => [s.beat, s.hum.episodeId])), [[1, "ep-second"], [2, "ep-first"]],
    "the hums sound in the order they came home, not the presentation's");
  /* The lantern's beat is regarded with a glow — its stage
   * is an opened day, and the road does not fake it here. */
  const lanternActs = steps.filter((s) => s.beat === 5);
  assert.deepEqual(plain(lanternActs.filter((s) => s.type === "act").map((s) => s.act)), ["glow"]);
  /* The closing bows, the Bow standing learned. */
  assert.ok(steps.some((s) => s.beat === 7 && s.type === "act" && s.act === "bow"));
  /* Reduced motion drops the travel and keeps every station:
   * each beat still acts, in the same order. */
  const still = steps.filter((s) => s.type !== "travel");
  assert.deepEqual(plain([...new Set(still.filter((s) => s.type === "act").map((s) => s.beat))]), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  /* No post, no road; no beats, no road. */
  assert.deepEqual(plain(layer.wholeRoadSteps(programme.beats, { postPd: null, projected })), []);
  assert.deepEqual(plain(layer.wholeRoadSteps([], { postPd: 222, projected })), []);
});

test("slice 6 — a learned route rides its beat on the road, walking its own days", () => {
  const layer = loadInhabitant();
  const record = {
    ...ROAD_RECORD,
    lifeLines: [
      ...ROAD_RECORD.lifeLines,
      { line: "play-session", kind: "route-demo", id: "line-0007", ref: "route:222,224,219", patternDay: 222, patternYear: 1, moon: 8, civilDate: "2026-11-22" },
      { line: "trick-learned", trick: "route", id: "line-0008", via: "line-0007", patternDay: 223, patternYear: 1, moon: 8, civilDate: "2026-11-23" },
    ],
  };
  const programme = layer.wholeRoadProgrammeFrom({ name: "Selor", kind: "water", record, facts: roadFacts(layer), companion: ROAD_COMPANION });
  const routeBeat = programme.beats.find((b) => b.beat === "trick" && b.ref === "route");
  assert.deepEqual(plain(routeBeat.days), [222, 224, 219], "the demonstration's days ride the beat");
  const projected = [];
  for (let pd = 197; pd <= 224; pd += 1) projected.push(pd);
  const steps = layer.wholeRoadSteps(programme.beats, { postPd: 217, projected, bowStands: true });
  const routeTravels = steps.filter((s) => s.type === "travel" && s.beat === routeBeatIndex(programme)).map((s) => s.pd);
  function routeBeatIndex(p) { return p.beats.indexOf(routeBeat); }
  assert.equal(routeTravels[0], 223, "the road first stands on the day the route was learned");
  assert.deepEqual(plain(routeTravels.slice(1, 4)), [222, 224, 219], "the route is walked in the order it was taught");
});

test("slice 6 — the book carries the road at Guardian, and the short road beside it", () => {
  const layer = loadInhabitant();
  const facts = roadFacts(layer, [atlasWatchFull("w1", "ep-first", 219, 8)]);
  const book = layer.trickBookFrom({ name: "Selor", kind: "water", record: ROAD_RECORD, facts, companion: ROAD_COMPANION });
  assert.equal(book.stage, "guardian");
  assert.ok(book.road, "the programme stands in the book");
  assert.equal(book.road.beats[0].text, "Born Moon 8 · Pattern Day 217");
  assert.ok(book.roadShort && book.roadShort.beats.length < book.road.beats.length, "the short road is shorter");
  assert.ok(!book.unlearned.some((u) => u.trick === "whole-road"), "a learned road is not listed among the unlearned");
  assert.equal(layer.TRICK_NAMES["whole-road"], "The Whole Road");
});
