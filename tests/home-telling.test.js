"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const HTML = read("docs/index.html");
const CSS = read("docs/assets/css/living-entry.css");
const JS = read("docs/assets/js/home-telling.js");

test("the day's telling block stands in the living activity panel", () => {
  const panelAt = HTML.indexOf('id="living-activity"');
  const tellingAt = HTML.indexOf("data-home-telling");
  const sphereAt = HTML.indexOf('id="home-sphere-observatory"');
  assert.ok(tellingAt > panelAt, "telling sits inside the activity panel");
  assert.ok(tellingAt < sphereAt, "telling precedes the sphere observatory");
  assert.match(HTML, /data-home-telling-main/);
  assert.match(HTML, /data-home-telling-practice/);
  // The panel's growth-mirror test counts every <li> in this slice:
  // the telling must speak in paragraphs, never list items.
  const block = HTML.slice(tellingAt, HTML.indexOf('class="le-act-grid"', tellingAt));
  assert.ok(!block.includes("<li"), "telling block must not contain <li> elements");
});

test("home-telling.js loads after the canonical calendar and data", () => {
  assert.match(HTML, /<script defer src="assets\/js\/home-telling\.js\?v=[^"]+"><\/script>/);
  const dataAt = HTML.indexOf("assets/js/calendar/pattern-calendar-data.js");
  const calendarAt = HTML.indexOf("assets/js/calendar/pattern-calendar.js");
  const tellingAt = HTML.indexOf("assets/js/home-telling.js");
  assert.ok(dataAt > -1 && calendarAt > dataAt, "calendar stack loads in order");
  assert.ok(tellingAt > calendarAt, "home-telling.js must load after PatternCalendar");
});

test("the telling is computed from the canonical calendar only", () => {
  assert.match(JS, /PatternCalendar/);
  assert.match(JS, /fromCivilDate/);
  assert.match(JS, /PatternCalendarData/);
  assert.match(JS, /boundaryMode: "midnight"/,
    "same boundary mode as the coordinate line above the panel");
});

test("fixture: the static telling matches the calendar data for 2026-11-18", () => {
  const files = [
    "pattern-calendar-version.js",
    "pattern-calendar-data.js",
    "pattern-calendar-format.js",
    "pattern-calendar-boundary.js",
    "pattern-calendar.js"
  ];
  for (const file of files) {
    (0, eval)(read("docs/assets/js/calendar/" + file));
  }
  const calendar = globalThis.PatternCalendar;
  const data = globalThis.PatternCalendarData;
  const mapped = calendar.fromCivilDate({
    date: "2026-11-18",
    timeZone: "America/Los_Angeles",
    boundaryMode: "midnight"
  });
  assert.equal(mapped.moon, 8);
  assert.equal(mapped.day, 20);
  assert.equal(mapped.dayOfPatternYear, 216);

  const soften = (s) => {
    const t = String(s).trim().replace(/\.$/, "");
    return t.charAt(0).toLowerCase() + t.slice(1);
  };
  const moon = data.moons[mapped.moon - 1];
  const archetype = data.dayArchetypes[mapped.day - 1];
  const gate = data.weekGates[Math.ceil(mapped.day / 7) - 1];
  const expectedMain =
    "Day " + mapped.day + " of the " + moon.name + " moon · Pattern Day " +
    mapped.dayOfPatternYear + " of 364. " + gate[0] + ": " + soften(gate[1]) +
    ". The day's name is " + archetype[0] + " — " + soften(archetype[1]) + ".";
  assert.ok(HTML.includes(expectedMain),
    "static telling must be the real telling for the seal date: " + expectedMain);

  const softenSentences = (text) => soften(
    String(text).trim().replace(/\.\s+(\S)/g, (m, ch) => "; " + ch.toLowerCase())
  );
  const expectedPractice =
    "The moon's practice: " + softenSentences(moon.practice) + ".";
  assert.ok(HTML.includes(expectedPractice),
    "static practice must come from the moon data: " + expectedPractice);
});

test("the tidy: duplicated door-card sections are gone, their lines re-homed", () => {
  assert.ok(!HTML.includes('id="what-title"'), "What You Can Do Here cards removed");
  assert.ok(!HTML.includes('id="core-title"'), "Main Systems card grid removed");
  assert.ok(!HTML.includes('aria-label="Signal summary"'), "signal strip removed");
  // Sentences the day's teaching rotation draws from must still stand
  // verbatim on the page (see living-entry.test.js TEACHINGS).
  for (const line of [
    "Track rhythm through the Remnant 13 Moons calendar, moon phase, symbolic day reading, and seasonal witness practice.",
    "The daily rhythm engine: moon, element, witness, calendar, mirror, and return.",
    "Explore handcrafted copper, stone, glass, and Living Technology pieces entered into the Artifact Registry."
  ]) {
    assert.ok(HTML.includes(line), "teaching line must survive the tidy: " + line);
  }
});

test("telling styles breathe only when motion is welcome", () => {
  assert.match(CSS, /\.le-act-telling\s*\{/);
  assert.match(CSS, /@media \(prefers-reduced-motion: no-preference\) \{\s*\.le-act-telling \{ animation: le-telling-breathe/);
});
