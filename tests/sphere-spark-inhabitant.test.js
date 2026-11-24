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
