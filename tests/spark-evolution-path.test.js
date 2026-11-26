/*
 * The long path (Aaron, Nov 26, 2026): inside the four great arcs
 * — Spark, Kindled, Bearer, Guardian — a long series of smaller
 * stages, a dozen to two dozen and more, generated from the
 * Spark's own seed the way its voice and form are. The same seed
 * and the same lived record always generate the same path; the
 * arcs keep their thresholds; old records read correctly.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const root = path.join(__dirname, "..");
const Core = require(path.join(root, "docs/assets/js/spark-companion.js"));

function companionFor(nonce) {
  const seed = Core.makeSeed({ moon: 8, patternDay: 216, kindIndex: 1, nonce });
  return Core.generate(seed);
}

function recordWithPoints(points) {
  // growthPoints: returnDays*2 + practice*3 + pages + bond.
  // Build points from return days alone where possible.
  const days = [];
  // (daysSeen.length - 1) * 2 points from return days.
  const returns = Math.floor(points / 2);
  for (let i = 0; i <= returns; i++) days.push(i + 1);
  const record = { daysSeen: days, practiceDays: [], pagesSeen: [] };
  if (points % 2 === 1) record.pagesSeen = ["index.html"];
  return record;
}

test("the path is long: 16–24 stages for every seed tried", () => {
  for (const nonce of ["ab12cd34", "zz98yy76", "q1w2e3r4", "m9n8b7v6", "x0x0x0x0"]) {
    const p = Core.evolutionPathFor(companionFor(nonce));
    assert.ok(p.count >= 16 && p.count <= 24, `count ${p.count} in 16–24`);
    assert.equal(p.stages.length, p.count);
  }
});

test("the path is the seed's own: same seed, same path, forever", () => {
  const a = Core.evolutionPathFor(companionFor("ab12cd34"));
  const b = Core.evolutionPathFor(companionFor("ab12cd34"));
  assert.deepEqual(a, b);
});

test("different seeds walk different paths", () => {
  const paths = ["ab12cd34", "zz98yy76", "q1w2e3r4", "m9n8b7v6"].map(
    (n) => JSON.stringify(Core.evolutionPathFor(companionFor(n)))
  );
  assert.ok(new Set(paths).size > 1, "at least two distinct paths among four seeds");
});

test("the anchors stand exactly on their arc thresholds, once each", () => {
  for (const nonce of ["ab12cd34", "zz98yy76", "q1w2e3r4"]) {
    const p = Core.evolutionPathFor(companionFor(nonce));
    const anchors = p.stages.filter((s) => s.anchor);
    assert.deepEqual(
      anchors.map((s) => [s.anchor, s.min]),
      [["Spark", 0], ["Kindled", 8], ["Bearer", 16], ["Guardian", 25]]
    );
    assert.equal(p.stages[0].name, "Spark");
    assert.equal(p.stages[p.stages.length - 1].name, "Guardian");
  }
});

test("thresholds climb monotonically and stage names are unique", () => {
  for (const nonce of ["ab12cd34", "zz98yy76", "m9n8b7v6", "x0x0x0x0", "p5p5p5p5"]) {
    const p = Core.evolutionPathFor(companionFor(nonce));
    for (let i = 1; i < p.stages.length; i++) {
      assert.ok(p.stages[i].min > p.stages[i - 1].min, "strictly climbing");
    }
    assert.equal(new Set(p.stages.map((s) => s.name)).size, p.stages.length);
  }
});

test("every stage knows its arc", () => {
  const p = Core.evolutionPathFor(companionFor("ab12cd34"));
  for (const s of p.stages) {
    const expected = s.min >= 25 ? "Guardian" : s.min >= 16 ? "Bearer" : s.min >= 8 ? "Kindled" : "Spark";
    assert.equal(s.arc, expected);
  }
});

test("a fresh record stands at the path's first stage", () => {
  const c = companionFor("ab12cd34");
  const at = Core.pathOf({ daysSeen: [216], practiceDays: [], pagesSeen: [] }, c);
  assert.equal(at.index, 0);
  assert.equal(at.name, "Spark");
  assert.equal(at.arc, "Spark");
  assert.ok(at.next);
});

test("the path's summit is the body ladder's summit: Guardian at the same facts", () => {
  const c = companionFor("ab12cd34");
  const pace = c.shape.pace;
  const needed = Math.ceil(25 / pace);
  const record = recordWithPoints(needed + 4);
  const at = Core.pathOf(record, c);
  assert.equal(at.index, at.count - 1);
  assert.equal(at.name, "Guardian");
  assert.equal(Core.stageOf(record, c).name, "Guardian");
});

test("crossing the Kindled threshold lands in the Kindled arc on both ladders", () => {
  const c = companionFor("zz98yy76");
  const pace = c.shape.pace;
  const needed = Math.ceil(8 / pace);
  const record = recordWithPoints(needed);
  assert.equal(Core.stageOf(record, c).name, "Kindled");
  assert.equal(Core.pathOf(record, c).arc, "Kindled");
});

test("a record kept by an earlier build (sparse shape) reads correctly", () => {
  const c = companionFor("q1w2e3r4");
  const at = Core.pathOf({}, c);
  assert.equal(at.index, 0);
  assert.equal(at.name, "Spark");
  const at2 = Core.pathOf({ daysSeen: [1, 2, 3] }, c);
  assert.ok(at2.index >= 0 && at2.points === Core.growthPoints({ daysSeen: [1, 2, 3] }));
});
