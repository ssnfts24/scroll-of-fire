"use strict";

/**
 * The home-first settle (Aaron's phone, Nov 25, 2026, 22:39 PST).
 *
 * The failure this pins against: Aaron's screenshots showed two
 * Sparks at once aboard Spark. Living Day — Luor (Light) on the
 * app's own faces, Selor (Water · Kindled) still presented by the
 * bundled Observatory. His words: "Somehow my old spark is like
 * built into the observatory now. While my new spark is the one
 * on the app." Selor had been retired at home (the app's native
 * store, the record's home) but the web rooms' localStorage
 * mirror still held Selor's copy, and the site layers aboard —
 * presence, the companions page, the agent seat, and the
 * Sphere's two Spark faces — read the mirror first and asked
 * home only when the mirror was empty, or never. The Sphere's
 * faces also write their grown record back into the mirror, so
 * the stale copy kept itself alive.
 *
 * The shape these tests hold, for every one of those layers:
 *   - a record read from the mirror is settled against home
 *     (settleFromHome) before it is presented;
 *   - a different seed at home settles the mirror down from
 *     home and home's Spark is the one presented;
 *   - the seed home names as deliberately let go clears the
 *     mirror instead of being presented;
 *   - no bridge (the open web) changes nothing: the core stays
 *     platform-free and the mirror is the record, as before.
 *
 * And the corner-clearance rule from the same screenshots: the
 * fixed bottom-left pills (the seat, the Sound of the Day
 * toggle) mark the body and the page grows bottom clearance,
 * so the pills can never cover the page's own controls.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

const JS = path.resolve(__dirname, "../docs/assets/js");
const CSS = path.resolve(__dirname, "../docs/assets/css");
const read = (p) => fs.readFileSync(p, "utf8");

const SETTLED_LAYERS = [
  "spark-presence.js",
  "spark-companions-page.js",
  "spark-agent-seat.js",
  "sphere-spark.js",
  "sphere-spark-inhabitant.js",
];

for (const file of SETTLED_LAYERS) {
  test(`${file}: the mirror read is settled against home`, () => {
    const src = read(path.join(JS, file));
    assert.ok(src.includes("settleFromHome"), `${file} defines the settle`);
    assert.ok(src.includes("sparkRecordJson"), `${file} reads home through the record door`);
    assert.ok(src.includes("sparkLetGoSeed"), `${file} consults the let-go tombstone`);
    assert.ok(src.includes("LivingPhoneNative"), `${file} speaks to the app bridge only`);
  });
}

test("presence: start() settles the mirror record before greeting", () => {
  const src = read(path.join(JS, "spark-presence.js"));
  const start = src.slice(src.indexOf("async function start()"));
  assert.ok(start.includes("settleFromHome(readRecord())"),
    "the greeting record is the settled record");
  assert.ok(start.indexOf("settleFromHome(readRecord())") < start.indexOf("adoptedStart"),
    "the settle stands before the greeting");
});

test("companions page: start() settles the mirror record before showing", () => {
  const src = read(path.join(JS, "spark-companions-page.js"));
  const start = src.slice(src.indexOf("function start()"));
  assert.ok(start.includes("settleFromHome(readRecord())"),
    "the shown record is the settled record");
});

test("sphere seat: readRecord returns the settled record", () => {
  const src = read(path.join(JS, "sphere-spark.js"));
  const readRecord = src.slice(src.indexOf("function readRecord()"), src.indexOf("function soundOff()"));
  assert.ok(readRecord.includes("settleFromHome(record)"),
    "every seat read is settled, so its write-backs keep the standing Spark");
});

test("inhabitant: readRecord returns the settled record", () => {
  const src = read(path.join(JS, "sphere-spark-inhabitant.js"));
  const at = src.indexOf("function readRecord()");
  const readRecord = src.slice(at, at + 400);
  assert.ok(readRecord.includes("settleFromHome(record)"),
    "the Spark who inhabits the Sphere is the settled Spark");
});

test("agent seat: readRecord returns the settled record", () => {
  const src = read(path.join(JS, "spark-agent-seat.js"));
  const at = src.indexOf("function readRecord(Core)");
  const readRecord = src.slice(at, at + 400);
  assert.ok(readRecord.includes("settleFromHome(Core, record)"),
    "the seat speaks for the settled Spark");
});

test("the settle never lives in the core: SparkCompanion stays platform-free", () => {
  const core = read(path.join(JS, "spark-companion.js"));
  assert.ok(!core.includes("LivingPhoneNative"),
    "the core never speaks to the app bridge");
  assert.ok(!core.includes("settleFromHome"),
    "the settle is a page-layer law, not a core law");
});

test("corner clearance: the seat marks the body and the page grows room", () => {
  const seat = read(path.join(JS, "spark-agent-seat.js"));
  assert.ok(seat.includes('classList.add("spark-seat-on")'),
    "standing the seat pill marks the body");
  const css = read(path.join(CSS, "spark-agent-seat.css"));
  assert.ok(css.includes("body.spark-seat-on"), "the seat's clearance rule stands");
  assert.ok(css.includes("body.heaven-toggle-on .spark-seat"),
    "where both pills stand, the seat stacks above the toggle");
  assert.ok(css.includes("padding-bottom"),
    "the clearance is real page room, not a smaller pill");
});

test("corner clearance: the Sound of the Day toggle marks the body too", () => {
  const heaven = read(path.join(JS, "heaven-sound.js"));
  assert.ok(heaven.includes('classList.add("heaven-toggle-on")'),
    "standing the toggle marks the body");
  assert.ok(heaven.includes("body.heaven-toggle-on"),
    "the toggle carries its own clearance rule for pages without the seat's stylesheet");
});
