"use strict";

/**
 * Sphere R3 Wave 3 — the Ambient face.
 *
 * Aaron's direction (Nov 20, 2026): the Sphere's visual reworking
 * goes with the films' language — warm wood and brass, held light,
 * the day's own light — extended from accent to environment. The
 * resting face must (a) speak only what the record holds, through
 * the one canonical line (PatternCalendar → DayTelling, never a
 * second clock); (b) never invent a Pattern Day for a day outside
 * the count; (c) rest under reduced motion at the Spark's own
 * 4.6s breathing cadence; (d) live in overlay files only — the
 * protected instrument is never named; and (e) carry the audit's
 * F10 plain name line, F1's below-the-stage meeting on this page,
 * F2's slimmer phone chrome, and F4's whole-word readout.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

const scripts = [
  "docs/assets/js/calendar/pattern-calendar-version.js",
  "docs/assets/js/calendar/pattern-calendar-data.js",
  "docs/assets/js/calendar/pattern-calendar-format.js",
  "docs/assets/js/calendar/pattern-calendar-boundary.js",
  "docs/assets/js/calendar/pattern-calendar.js",
  "docs/assets/js/day-telling.js",
  "docs/assets/js/sphere-ambient.js"
];

function loadStack() {
  const context = { Date, Intl, URL, URLSearchParams, console };
  context.globalThis = context;
  context.window = context;
  scripts.forEach(script => vm.runInNewContext(read(script), context));
  return context;
}

const stack = loadStack();
const Ambient = stack.SphereAmbient;

function summary(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return stack.PatternCalendar.fromCivilDate({ date: new Date(Date.UTC(y, m - 1, d, 12)) });
}

function telling(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return stack.DayTelling.tellForDate(new Date(Date.UTC(y, m - 1, d, 12)));
}

test("the greeting speaks today's coordinate from the canonical line", () => {
  const lines = Ambient.greetingFor({
    summary: summary("2026-11-20"),
    telling: telling("2026-11-20"),
    daypart: "night",
    sparkName: null
  });
  assert.equal(lines.coordinate, "Moon 8 · Day 22 · Pattern Day 218");
  assert.equal(lines.moonLine, "Under Deep Mirror");
  assert.ok(lines.headline.includes("Deep Mirror"), "the telling's own headline");
  assert.ok(lines.civil.includes("November 20, 2026"), "the civil day, in words");
  assert.equal(lines.daypartLine, "Night where you are.");
  assert.equal(lines.sparkLine, "", "no Spark adopted — no Spark line, and no pitch");
});

test("the Spark is present by name, and only when one lives here", () => {
  const lines = Ambient.greetingFor({
    summary: summary("2026-11-20"),
    telling: telling("2026-11-20"),
    daypart: "dawn",
    sparkName: "Selor"
  });
  assert.ok(lines.sparkLine.includes("Selor"));
  assert.equal(lines.daypartLine, "Dawn where you are.");
});

test("a day outside the count is never given a Pattern Day", () => {
  const doot = summary("2027-04-16");
  assert.equal(doot.insideCountedYear, false);
  const lines = Ambient.greetingFor({
    summary: doot,
    telling: telling("2027-04-16"),
    daypart: "day",
    sparkName: null
  });
  assert.ok(!/Pattern Day/.test(lines.coordinate), "no invented Pattern Day");
  assert.ok(lines.coordinate.length > 0, "the day is still greeted, by its own telling");
  assert.equal(lines.moonLine, "", "no Moon line outside the Moons");
});

test("the daypart comes from the visitor's own clock, in the front door's four bands", () => {
  assert.equal(Ambient.daypartForHour(5), "dawn");
  assert.equal(Ambient.daypartForHour(9), "dawn");
  assert.equal(Ambient.daypartForHour(10), "day");
  assert.equal(Ambient.daypartForHour(16), "day");
  assert.equal(Ambient.daypartForHour(17), "dusk");
  assert.equal(Ambient.daypartForHour(20), "dusk");
  assert.equal(Ambient.daypartForHour(21), "night");
  assert.equal(Ambient.daypartForHour(4), "night");
});

test("the pronoun rule holds in the module's own words", () => {
  const source = read("docs/assets/js/sphere-ambient.js");
  assert.ok(!/\bshe\b/i.test(source), "no 'she' for the Spark");
  assert.ok(!/\bher\b/i.test(source), "no 'her' for the Spark");
  assert.ok(!/\bhers\b/i.test(source), "no 'hers' for the Spark");
});

test("the face is wired as an overlay: tags on the page, canonical reads only", () => {
  const page = read("docs/living-time-sphere.html");
  assert.ok(page.includes("assets/js/sphere-ambient.js"));
  assert.ok(page.includes("assets/css/sphere-ambient.css"));

  const source = read("docs/assets/js/sphere-ambient.js");
  assert.ok(source.includes("PatternCalendar"), "today through the canonical calendar");
  assert.ok(source.includes("DayTelling"), "the telling through the canonical telling module");
  assert.ok(!source.includes("living-time-sphere-camera"), "never reaches into the camera");
  assert.ok(!source.includes("living-time-sphere-calendar-geometry"), "never reaches into the geometry");
  assert.ok(!source.includes("living-time-sphere-renderer"), "never reaches into a renderer");
  assert.ok(!source.includes("living-time-sphere-day-zoom"), "never reaches into the day-zoom module");
});

test("the films' language: brass from the film, the Spark's cadence, a designed still face", () => {
  const css = read("docs/assets/css/sphere-ambient.css");
  assert.ok(css.includes("#daa45b"), "the film's brass, sampled in #188, is the room's brass");
  assert.ok(css.includes("sphere-ambient-breathe 4.6s ease-in-out"), "the held light breathes at spark-breathe's cadence");
  const still = css.slice(css.lastIndexOf("prefers-reduced-motion"));
  assert.ok(still.includes(".sphere-ambient-veil::before"), "the still face reaches the veil's light");
  assert.ok(still.includes("animation: none"), "in the still face the light rests");
  assert.ok(css.includes("--sphere-moon-hue"), "the Moon's hue is #188's variable, spent not re-minted");
  assert.ok(css.includes("--warm-glow"), "the daypart light is #188's variable, spent not re-minted");
});

test("the audit's carried fixes are present: F10's line, F1's placement, F2's slim chrome, F4's whole words", () => {
  const source = read("docs/assets/js/sphere-ambient.js");
  assert.ok(
    source.includes("A living calendar: 13 moons of 28 days, turning around today."),
    "F10: the plain name line, in the audit's own words"
  );
  assert.ok(source.includes("sphere-ambient-below"), "F1: the meeting can stand below the stage on this page");

  const css = read("docs/assets/css/sphere-ambient.css");
  assert.ok(css.includes(".spark-encounter-host.sphere-ambient-below"), "F1: the below-stage meeting is stood in the flow");
  assert.ok(css.includes(".sphere-location-season-strip"), "F2: the location strip folds slimmer");
  assert.ok(css.includes(".sphere-interact-bar"), "F2: the interact gate becomes a slim row");

  const deepening = read("docs/assets/css/sphere-deepening.css");
  const f4 = deepening.slice(deepening.indexOf("F4 (Sphere page audit"));
  assert.ok(f4.includes("white-space: normal"), "F4: the readout wraps");
  assert.ok(f4.includes("text-overflow: clip"), "F4: no word is cut in half");

  const layer = read("docs/assets/js/sphere-companion-layer.js");
  assert.ok(layer.includes('data-sgb="rest"'), "the guide bar can bring the resting face back");
  assert.ok(layer.includes("SphereAmbient"), "the Rest button speaks to the Ambient face's public face");
});
