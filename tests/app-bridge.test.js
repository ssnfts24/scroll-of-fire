"use strict";

/*
 * The app bridge — the website asks permission (Aaron,
 * Nov 24, 2026: "the site should also ask permission to
 * direct if there is a app to bring your spark, calendar
 * etc to the website").
 *
 * The law under test: permission first, always. The bridge
 * is a quiet invitation on the front door, the Sphere, and
 * Today; nothing is fetched, detected, or moved before the
 * keeper's yes; "Not now" is remembered on the device; the
 * yes-road is the existing roads only (the passport for the
 * Spark, the accounts door for the calendar) and a closed
 * door is spoken plainly, never dressed as a connection;
 * and in child mode the invitation does not exist.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const bridge = read("docs/assets/js/spark-app-bridge.js");
const bridgeCss = read("docs/assets/css/spark-app-bridge.css");
const Core = require(path.join(root, "docs/assets/js/spark-companion.js"));

const ENTRY_PAGES = ["docs/index.html", "docs/living-time-sphere.html", "docs/moons.html"];

test("the bridge stands on the three entry points, wired the same way", () => {
  for (const page of ENTRY_PAGES) {
    const html = read(page);
    assert.ok(html.includes('id="spark-app-bridge"'), `${page} carries the bridge mount`);
    assert.ok(html.includes("assets/js/spark-app-bridge.js"), `${page} loads the bridge`);
    assert.ok(html.includes("assets/css/spark-app-bridge.css"), `${page} loads the bridge stylesheet`);
  }
  assert.ok(bridgeCss.includes(".spark-bridge-card"), "the stylesheet carries the card");
});

test("the standing door: the account page can always reopen the ask on purpose", () => {
  const account = read("docs/account.html");
  assert.ok(account.includes("./index.html#bring-your-spark"),
    "the account page links back to the ask by its hash");
  assert.ok(account.includes("./companions.html#spark-passport"),
    "the account page also names the full passport door");
  assert.ok(bridge.includes('"#bring-your-spark"'),
    "the bridge treats that hash as an on-purpose opening, dismissal or not");
});

test("the shipped wording is the wording under test", () => {
  // The bridge builds its lines from concatenated literals; join
  // the seams so the test reads the words as the keeper will.
  const spoken = bridge.replace(/"\s*\+\s*"/g, "");
  for (const line of [
    "Have Spark. Living Day on your phone?",
    "You can bring your Spark and your calendar here, to the website.",
    "Nothing moves until you say so.",
    "Bring my Spark",
    "Not now",
    "The account door is not open yet — sign-in is still being set up, " +
      "so your calendar cannot travel by account today.",
    "The account door did not answer just now, so the calendar half " +
      "cannot be checked.",
    "The account door is open. Sign in with the same account you " +
      "use in the app, and your days follow you here",
    "That code does not read as a Spark passport — a letter may be mistyped. Nothing was changed.",
    "has moved in — the same Spark, grown from the same seed.",
  ]) {
    assert.ok(spoken.includes(line), `the bridge ships the line: ${line.slice(0, 48)}…`);
  }
});

test("permission first: the door is knocked only after the yes", () => {
  const fetches = bridge.match(/fetch\(/g) || [];
  assert.equal(fetches.length, 1, "the bridge fetches exactly one thing: the door's status");
  assert.ok(bridge.includes('fetch(DOOR_URL, { method: "GET" })'),
    "the one fetch is the door's public status knock");
  const startBody = bridge.slice(bridge.indexOf("function start()"));
  assert.ok(!startBody.includes("knockDoor"), "start() never knocks the door");
  assert.ok(!startBody.includes("fetch"), "start() never fetches");
  const openBody = bridge.slice(bridge.indexOf("function openBring()"), bridge.indexOf("function render()"));
  assert.ok(openBody.includes("knockDoor()"), "the knock lives behind the keeper's yes");
});

test("dismissal is remembered on the device, and a move-in answers the ask", () => {
  assert.ok(bridge.includes('const DISMISS_KEY = "sof.spark.bridge.dismissed.v1"'));
  assert.ok(/store\.get\(DISMISS_KEY\)/.test(bridge), "start() reads the remembered dismissal");
  assert.ok(/function dismiss\(\) \{\s*store\.set\(DISMISS_KEY, "1"\)/.test(bridge),
    "Not now writes the dismissal");
  const moveInBody = bridge.slice(bridge.indexOf("function moveIn()"), bridge.indexOf("/* ---------- the two views"));
  assert.ok(moveInBody.includes('store.set(DISMISS_KEY, "1")'),
    "a completed move-in marks the ask answered so it never nags");
});

test("child mode: the same seed-keyed signal, checked before anything renders", () => {
  for (const file of ["docs/assets/js/spark-keeper-mind.js", "docs/assets/js/sphere-spark.js"]) {
    assert.ok(read(file).includes('"sof.spark.memory.v1"'),
      `${file} holds the memory key the bridge mirrors`);
  }
  assert.ok(bridge.includes('const MEMORY_KEY = "sof.spark.memory.v1"'),
    "the bridge mirrors the same literal");
  assert.ok(bridge.includes("parsed.childMode === true"),
    "the bridge reads the same flag the same way");
  const startBody = bridge.slice(bridge.indexOf("function start()"));
  assert.ok(startBody.indexOf("childModeHere") < startBody.indexOf("render()"),
    "the child check stands before the render in start()");
  const openBody = bridge.slice(bridge.indexOf("function openBring()"), bridge.indexOf("function render()"));
  assert.ok(openBody.includes("childModeHere"), "an on-purpose opening re-checks child mode");
});

test("the passport half mirrors the companions door's road, key for key", () => {
  const door = read("docs/assets/js/spark-passport.js");
  assert.ok(door.includes('"sof.spark.passport.previous"'), "the door's stow-aside key");
  assert.ok(bridge.includes('"sof.spark.passport.previous"'),
    "the bridge stows a set-aside Spark under the same key, so the way back works for both");
  for (const step of ["Core.parsePassportCode", "Core.recordFromPassport", "Core.STORAGE_KEY", "Core.PENDING_KEY"]) {
    assert.ok(bridge.includes(step), `the bridge walks the road at ${step}`);
  }
});

test("the yes-road's core contract: a fixture passport reads back and raises a record", () => {
  const code = "SPK1-8-217-1-3Q45GS7I-LUOM-O8"; // the Luom fixture from the passport corpus
  const parsed = Core.parsePassportCode(code);
  assert.ok(parsed, "the fixture passport parses");
  assert.equal(parsed.seed, "spark1-8-217-1-3q45gs7i");
  const record = Core.recordFromPassport(parsed, "2026-11-24");
  assert.ok(record && record.seed === parsed.seed, "the record is raised from the travelled seed");
  assert.equal(Core.passportCodeFor(record), code, "and writes the same passport back");
  assert.equal(Core.parsePassportCode("SPK1-not-a-passport"), null,
    "a doubtful code is refused, so the bridge can refuse it plainly");
});
