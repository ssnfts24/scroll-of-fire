"use strict";

/* Sphere-native play (Aaron, Nov 20, 2026): "The sphere should be
 * fun and interactive too" — games that belong to the instrument,
 * played WITH the real calendar. These tests pin the fences:
 *  - the hunt's target is a true Pattern coordinate, in the count;
 *  - every finished game is written to the keeper's one record
 *    stamped from the canonical cursor (never a second clock);
 *  - the echo game's pads and sequence come from the living-voice
 *    call and the keeper's own signature motif;
 *  - still mode turns play quiet;
 *  - play is a room of the page, never a cover over the Sphere. */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const play = read("docs/assets/js/sphere-play.js");
const spark = read("docs/assets/js/sphere-spark.js");
const css = read("docs/assets/css/sphere-rebuild.css");

test("the play room exists with three plainly named games", () => {
  assert.ok(play.includes('setAttribute("data-sphere-play", "")'), "the room carries its marker");
  for (const label of ["Find the day", "Echo", "Catch the turning", "Play with the Sphere"]) {
    assert.ok(play.includes(label), `play speaks: ${label}`);
  }
});

test("the hunt target is a true Pattern coordinate, inside the count", () => {
  assert.ok(play.includes("PC.fromCivilDate({ date: new Date() })"), "today comes from the calendar itself");
  assert.ok(play.includes("if (pd > 364) pd -= 364"), "the target wraps inside the 364-day count — never a false day");
  assert.ok(play.includes("SOFCurrentTemporalCoordinate"), "the win is read from the canonical cursor's state");
});

test("every game writes to the one record, stamped from the one clock", () => {
  assert.ok(spark.includes("patternStamp"), "the stamp lives in the Spark layer");
  assert.ok(spark.includes("SOFTemporalCursor"), "the stamp reads the canonical cursor first");
  assert.ok(spark.includes("playLog"), "the record keeps one play log");
  for (const call of ['logPlay?.("hunt"', 'logPlay("echo"', 'logPlay?.("turning"']) {
    assert.ok(play.includes(call), `stamped on completion: ${call}`);
  }
  assert.ok(!/\.getFullYear\(\)|\.getMonth\(\)/.test(play), "play keeps no civil-date clock of its own");
});

test("the echo game plays the keeper's own motif through the living call", () => {
  assert.ok(play.includes("livingCallFor"), "pads come from the living-voice call");
  assert.ok(play.includes("signatureSteps"), "the sequence is the Spark's signature, mapped onto the pads");
});

test("still mode turns play quiet, and play never covers the Sphere", () => {
  assert.ok(play.includes("Play rests while the Sphere is still."), "the still line is plain");
  assert.ok(play.includes("sphere-frozen"), "play rests when the shell has frozen the Sphere");
  assert.ok(play.includes('"still"'), "and when the motion mode itself is still");
  const block = css.slice(css.indexOf(".sphere-play {"), css.indexOf(".sphere-play {") + 300);
  assert.ok(block.includes("margin: 1.5rem auto"), "the room sits in the page flow");
  assert.ok(!/position:\s*fixed/.test(block), "the play room is never an overlay");
});
