"use strict";

/**
 * The Mint Rule (Aaron, Nov 25, 2026): "when you get a spark.
 * You shouldn't be able to simply just. Let one go and get a
 * new one. They should act like mints."
 *
 * The failure this pins against: after the v1.0.2 install, a
 * web room whose local mirror had not yet settled greeted
 * Aaron with a brand-new Spark (Luor) while Anera already
 * stood in the app's native store — the room asked before
 * the mirror had spoken. These tests hold the shape:
 *
 *   - before any meeting is offered, the presence layer and
 *     the companions page ask the app's bridge what stands
 *     at home, and greet that Spark instead;
 *   - an adoption made in a room is handed home at once;
 *   - letting go is a deliberate road — a panel that states
 *     the cost plainly and a final button that wakes only
 *     when the keeper types the Spark's own name; the old
 *     two-tap arm is gone;
 *   - the platform-free core stays platform-free: the bridge
 *     is consulted by the page layers, never by the core.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

const JS = path.resolve(__dirname, "../docs/assets/js");
const CSS = path.resolve(__dirname, "../docs/assets/css");
const read = (p) => fs.readFileSync(p, "utf8");

test("presence: the bridged record is consulted before any meeting", () => {
  const src = read(path.join(JS, "spark-presence.js"));
  assert.ok(src.includes("readBridgedRecord"), "presence defines the bridged read");
  assert.ok(src.includes("LivingPhoneNative"), "the bridge is the app bridge");
  assert.ok(src.includes("sparkRecordJson"), "the read goes through the record door");
  const start = src.slice(src.indexOf("async function start()"));
  const bridgedAt = start.indexOf("readBridgedRecord()");
  const meetingAt = start.indexOf("renderEncounter");
  assert.ok(bridgedAt !== -1, "start() consults the bridge");
  assert.ok(meetingAt === -1 || bridgedAt < meetingAt,
    "the bridged read stands before the meeting in start()");
  assert.ok(start.includes("if (record) writeRecord(record);") ||
            start.includes("writeRecord(record)"),
    "a Spark found at home is mirrored into the room");
});

test("presence: an adoption in a room is handed home in the same breath", () => {
  const src = read(path.join(JS, "spark-presence.js"));
  assert.ok(src.includes("handRecordUp"), "presence defines the hand-up");
  assert.ok(src.includes("sparkRecordFromWeb"), "the hand-up uses the record door");
  const finish = src.slice(src.indexOf("const finish = (keeperName)"));
  assert.ok(finish.slice(0, 600).includes("handRecordUp(record)"),
    "the adoption finish hands the record up");
});

test("companions page: the bridged record gates the meeting, and keeping hands up", () => {
  const src = read(path.join(JS, "spark-companions-page.js"));
  assert.ok(src.includes("readBridgedRecord"), "the page defines the bridged read");
  const start = src.slice(src.indexOf("function start()"));
  assert.ok(start.indexOf("readBridgedRecord()") !== -1 &&
            start.indexOf("readBridgedRecord()") < start.indexOf("wireMeeting"),
    "start() consults the bridge before wiring the meeting");
  assert.ok(src.includes("handRecordUp(record)"),
    "keeping a Spark here hands it home");
});

test("letting go is a deliberate road, never two taps", () => {
  const page = read(path.join(JS, "spark-companions-page.js"));
  assert.ok(!page.includes("dataset.armed"), "the two-tap arm is gone from the companions page");
  assert.ok(page.includes("spark-leave-panel"), "the road is a panel");
  assert.ok(page.includes("minted once"), "the panel states the mint rule plainly");
  assert.ok(page.includes("cannot"), "the panel states it cannot be undone");
  assert.ok(page.includes("go for good"), "the final button says what it does");
  assert.ok(page.includes("input.value.trim().toLowerCase() !== name.toLowerCase()"),
    "the final button wakes only on the Spark's own typed name");
  assert.ok(page.includes("Keep ${name}"), "keeping the Spark is always one tap");
  const css = read(path.join(CSS, "spark-companion.css"));
  assert.ok(css.includes(".spark-leave-panel"), "the panel is styled");
});

test("the core stays platform-free", () => {
  const core = read(path.join(JS, "spark-companion.js"));
  assert.ok(!core.includes("LivingPhoneNative"),
    "the Spark core never speaks to the app bridge");
});
