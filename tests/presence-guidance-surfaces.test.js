"use strict";

/**
 * Q-03 — the site's memory speaks at the front door and the library
 * (recommendation approved by Aaron, Nov 22, 2026; program §C2).
 *
 * The guidance lines are computed once, in presence-guidance.js,
 * from the visitor's own on-device record. These tests hold the
 * three surfaces to that shape:
 *
 *   - the 13 Moons Day Notes panel keeps the core's own doors;
 *   - the homepage's Today panel and the Scroll Library's opening
 *     carry the same slot, name their own doors for the offers,
 *     and load the record layer before the guidance module;
 *   - only the link target ever changes per surface — the words,
 *     the counts, and which lines exist stay the core's.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

const DOCS = path.resolve(__dirname, "../docs");
const JS = path.join(DOCS, "assets/js");

const Guidance = require(path.join(JS, "presence-guidance.js"));

function readPage(rel) {
  return fs.readFileSync(path.join(DOCS, rel), "utf8");
}

function slotOf(html) {
  const match = html.match(/<div[^>]*data-presence-guidance[^>]*>/);
  return match ? match[0] : null;
}

function scriptOrder(html, needles) {
  return needles.map((needle) => {
    const at = html.indexOf(needle);
    assert.notEqual(at, -1, `expected ${needle} to be loaded`);
    return at;
  });
}

test("hrefForLine: no overrides keeps the core's doors", () => {
  assert.equal(Guidance.hrefForLine({ href: "teach.html" }, {}), "teach.html");
  assert.equal(Guidance.hrefForLine({ href: "#day-notes" }, {}), "#day-notes");
  assert.equal(Guidance.hrefForLine({ href: null }, {}), null);
  assert.equal(Guidance.hrefForLine({}, {}), null);
});

test("hrefForLine: a surface's named doors replace only their own offer", () => {
  const overrides = { practiceHref: "../teach.html", noteHref: "../moons.html#day-notes" };
  assert.equal(Guidance.hrefForLine({ href: "teach.html" }, overrides), "../teach.html");
  assert.equal(Guidance.hrefForLine({ href: "#day-notes" }, overrides), "../moons.html#day-notes");
  /* An href the overrides do not name passes through untouched. */
  assert.equal(Guidance.hrefForLine({ href: "elsewhere.html" }, overrides), "elsewhere.html");
  /* A missing override leaves that offer on the core's door. */
  assert.equal(Guidance.hrefForLine({ href: "teach.html" }, { noteHref: "n.html" }), "teach.html");
});

test("the 13 Moons panel keeps the core's slot, unnamed doors and all", () => {
  const moons = readPage("moons.html");
  const slot = slotOf(moons);
  assert.ok(slot, "moons.html carries a guidance slot");
  assert.ok(!slot.includes("data-guidance-practice-href"), "moons names no practice override");
  assert.ok(!slot.includes("data-guidance-note-href"), "moons names no note override");
});

test("the front door carries the slot in its Today panel, with the Day Notes door named", () => {
  const home = readPage("index.html");
  const slot = slotOf(home);
  assert.ok(slot, "index.html carries a guidance slot");
  assert.match(slot, /data-guidance-note-href="moons\.html#day-notes"/);
  assert.ok(
    home.indexOf('data-codex-today-title') < home.indexOf("data-presence-guidance"),
    "the slot stands inside the Today panel, under its heading"
  );
  const order = scriptOrder(home, [
    "life-atlas/life-atlas-schema.js",
    "life-atlas/life-atlas-repository.js",
    "life-atlas/record-helpers.js",
    "day-notes.js",
    "presence-guidance.js"
  ]);
  assert.deepEqual(order, [...order].sort((a, b) => a - b), "the record layer loads before the guidance module");
  assert.match(home, /assets\/css\/presence\.css/, "the front door carries the guidance styles");
});

test("the Scroll Library's opening carries the slot, its doors named from the library side", () => {
  const library = readPage("scroll/index.html");
  const slot = slotOf(library);
  assert.ok(slot, "scroll/index.html carries a guidance slot");
  assert.match(slot, /data-guidance-practice-href="\.\.\/teach\.html"/);
  assert.match(slot, /data-guidance-note-href="\.\.\/moons\.html#day-notes"/);
  assert.ok(
    library.indexOf("library-hero") < library.indexOf("data-presence-guidance"),
    "the slot stands at the library's opening, below the hero"
  );
  const order = scriptOrder(library, [
    "calendar/pattern-calendar.js",
    "life-atlas/life-atlas-schema.js",
    "life-atlas/record-helpers.js",
    "day-notes.js",
    "presence-guidance.js"
  ]);
  assert.deepEqual(order, [...order].sort((a, b) => a - b), "calendar and record layer load before the guidance module");
  assert.match(library, /assets\/css\/presence\.css/, "the library carries the guidance styles");
});

test("the guidance module still sends nothing anywhere", () => {
  const source = fs.readFileSync(path.join(JS, "presence-guidance.js"), "utf8");
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon/.test(source), "the guidance reads the device only");
});
