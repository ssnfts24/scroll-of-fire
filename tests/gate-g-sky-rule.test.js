"use strict";

/*
 * Gate G sky rule (Nov 24, 2026) — no place, no times.
 *
 * Aaron's screenshot fault: with no place kept on the device,
 * the Sphere's sky line printed "sunrise 9:44 PM · sunset
 * 9:49 AM here, computed on this device". The cause, read in
 * the code: the line's builder read the kept place through
 * Number(state && state.place && state.place.latitude) — when
 * no place stands, that chain is null, Number(null) is 0, and
 * 0 is finite, so the engine computed a sky for 0°, 0° and the
 * face printed it as fact.
 *
 * The rule these tests pin, at the source (the companion
 * layer's one sky builder, and the sky dome's place reading):
 *   - a coordinate counts only when it is PRESENT on a place
 *     object — never when Number() merely succeeds on its
 *     absence;
 *   - with no place kept, the sky line prints only what needs
 *     no place (season, the next turn, the Moon's phase and
 *     light) and states plainly that sunrise, sunset and the
 *     drawn sky need a place, and where to set one;
 *   - with a place kept, the times print, computed on this
 *     device from that place — the engine is the real one.
 *
 * The functional tests run the builder's own code, lifted
 * verbatim from sphere-armillary.js, against the real sky
 * engine — the words are proven, not pattern-matched.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const ARMILLARY = read("docs/assets/js/sphere-armillary.js");
const SKY_LAYER = read("docs/assets/js/sphere-sky-layer.js");

/* Lift the sky builder and its whole dependency span, verbatim:
 * SEASON_TURNS through the end of buildSkyText. */
function liftSkyBuilder() {
  const start = ARMILLARY.indexOf("var SEASON_TURNS = {");
  const endMarker = "    return text;\n  }";
  const end = ARMILLARY.indexOf(endMarker, start);
  assert.ok(start > -1 && end > start, "the sky builder's span is locatable");
  return ARMILLARY.slice(start, end + endMarker.length);
}

function makeContext(place) {
  const context = { Date, Math, Number, String, console };
  context.window = context;
  context.globalThis = context;
  vm.runInNewContext(read("docs/assets/js/astronomy/sky-engine.js"), context);
  context.SofEnvironmentState = {
    getEnvironmentState: () => ({ place }),
  };
  context.window.SofEnvironmentState = context.SofEnvironmentState;
  context.window.CodexSkyEngine = context.CodexSkyEngine;
  vm.runInNewContext(liftSkyBuilder() + "\n;this.__buildSkyText = buildSkyText; this.__keptPlace = keptPlace;", context);
  return context;
}

const DAY = new Date(2026, 10, 24, 12, 0, 0);

test("source: the absent-coordinate road is closed in both readers", () => {
  assert.ok(!ARMILLARY.includes("Number(placeState && placeState.place"),
    "the sky builder no longer Numbers a possibly-null place chain");
  assert.ok(!ARMILLARY.includes("Number(state && state.place && state.place.latitude)"),
    "the season flip no longer Numbers a possibly-null place chain");
  assert.ok(ARMILLARY.includes("function keptPlace()"),
    "the builder reads its place through the strict reader");
  assert.ok(SKY_LAYER.includes("rawLat === null"),
    "the dome's place reading is presence-strict too");
});

test("keptPlace: absence is absence, in every shape it arrives", () => {
  assert.equal(makeContext(null).__keptPlace(), null, "no place object");
  assert.equal(makeContext({}).__keptPlace(), null, "an empty place object");
  assert.equal(makeContext({ latitude: null, longitude: null }).__keptPlace(), null,
    "null coordinates are absent, not 0");
  assert.equal(makeContext({ latitude: "", longitude: "" }).__keptPlace(), null,
    "blank coordinates are absent");
  assert.equal(makeContext({ name: "Nowhere" }).__keptPlace(), null,
    "a name without coordinates is not a place for the sky");
  const zero = makeContext({ latitude: 0, longitude: 0 }).__keptPlace();
  assert.ok(zero && zero.lat === 0 && zero.lon === 0,
    "a place truly set at 0°, 0° counts — its coordinates are present");
  const seattle = makeContext({ latitude: 47.6062, longitude: -122.3321 }).__keptPlace();
  assert.ok(seattle && seattle.lat === 47.6062 && seattle.lon === -122.3321,
    "a kept place reads through whole");
});

test("no place kept: the line prints no time, and says what it needs", () => {
  const text = makeContext(null).__buildSkyText(DAY);
  assert.ok(text.startsWith("Sky: "), `the line keeps its label: ${text}`);
  assert.ok(!/sunrise \d/.test(text), `no sunrise time is printed: ${text}`);
  assert.ok(!/sunset \d/.test(text), `no sunset time is printed: ${text}`);
  assert.ok(!text.includes("computed on this device"),
    `nothing claims a computation that never happened: ${text}`);
  assert.ok(text.includes("the Moon is"), `the Moon's phase stands — it needs no place: ${text}`);
  assert.ok(text.includes("sunrise, sunset and the drawn sky need a place"),
    `the limit is stated plainly: ${text}`);
  assert.ok(text.includes("Set location"), `the line names where to set one: ${text}`);
});

test("a place-shaped absence prints no time either", () => {
  const text = makeContext({ latitude: null, longitude: null }).__buildSkyText(DAY);
  assert.ok(!/sunrise \d/.test(text), `no sunrise from null coordinates: ${text}`);
  assert.ok(text.includes("need a place"), `the limit is stated: ${text}`);
});

test("a place kept: the times print, computed from that place", () => {
  const text = makeContext({ latitude: 47.6062, longitude: -122.3321, name: "Seattle" })
    .__buildSkyText(DAY);
  assert.match(text, /sunrise \d{1,2}:\d{2} [AP]M/, `sunrise prints: ${text}`);
  assert.match(text, /sunset \d{1,2}:\d{2} [AP]M/, `sunset prints: ${text}`);
  assert.ok(text.includes("here, computed on this device"),
    `the computation is labelled as its own: ${text}`);
  assert.ok(!text.includes("need a place"), `no false limit is stated: ${text}`);
  // Seattle, late November: the day is short — sunrise after
  // 7 AM and sunset before 5 PM in the device's own clock words
  // would depend on the runner's timezone, so the pin is the
  // engine's own agreement: the printed times are the engine's
  // times for this place, recomputed here independently.
  const engine = makeContext(null).CodexSkyEngine;
  const tzOff = -new Date(2026, 10, 24, 12).getTimezoneOffset();
  const sun = engine.sunForCivilDate({ year: 2026, month: 11, day: 24 }, 47.6062, -122.3321, tzOff);
  const fmt = (d) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  assert.ok(text.includes(`sunrise ${fmt(sun.sunrise)}`), "the printed sunrise is the engine's");
  assert.ok(text.includes(`sunset ${fmt(sun.sunset)}`), "the printed sunset is the engine's");
});

test("the dome: with no place it draws nothing and names the door", () => {
  assert.ok(SKY_LAYER.includes("No place is kept on this device, so the sky can't be drawn"),
    "the dome's honest sentence stands");
  assert.ok(SKY_LAYER.includes("Set a place with Set location on this page and the sky will draw."),
    "the dome names where to set a place");
});
