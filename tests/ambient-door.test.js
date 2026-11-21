/* The Ambient Door — the homepage's first face.
 *
 * Pins the fences that make the door what it is: it is the first face
 * (before the path head and the hero), it speaks the canonical day
 * (static copy is date-neutral and the script reads the same canonical
 * calendar as home-telling), the
 * film is tap-to-play and never automatic, and nothing below the fold
 * was lost — the hero, the Front Door, and the Sphere observatory all
 * keep their places.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const HTML = fs.readFileSync(path.join(ROOT, "docs/index.html"), "utf8");
const JS = fs.readFileSync(path.join(ROOT, "docs/assets/js/ambient-door.js"), "utf8");
const CSS = fs.readFileSync(path.join(ROOT, "docs/assets/css/ambient-door.css"), "utf8");

const doorAt = HTML.indexOf('id="ambient-door"');
const door = HTML.slice(doorAt, HTML.indexOf('id="step-witness"'));

test("the Ambient Door is the homepage's first face", () => {
  assert.ok(doorAt > HTML.indexOf('<main id="main">'), "door sits inside main");
  assert.ok(doorAt < HTML.indexOf('id="step-witness"'), "door precedes the path head");
  assert.ok(doorAt < HTML.indexOf('id="home-title"'), "door precedes the hero");
});

test("the door's static copy is date-neutral; the day comes from the calendar", () => {
  // Aaron's rule: everything shown must be real information. A sealed
  // day in static copy is false on every other day, so the static door
  // asserts no civil date, weekday, or Pattern coordinate — the script
  // fills the real day from the canonical calendar (pinned by the
  // script test below and the PatternCalendar fixtures).
  assert.match(door, /Today · on the Pattern calendar/);
  assert.ok(!/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),/.test(door),
    "no sealed weekday in static copy");
  assert.ok(!/Pattern Day \d+ of 364/.test(door),
    "no sealed Pattern Day in static copy");
  assert.ok(!/Day \d+ of the .* moon/.test(door),
    "no sealed moon coordinate in static copy");
});

test("the door's script reads the one canonical calendar", () => {
  assert.match(JS, /globalThis\.PatternCalendar/);
  assert.match(JS, /globalThis\.PatternCalendarData/);
  assert.match(JS, /fromCivilDate/);
  const dataAt = HTML.indexOf("assets/js/calendar/pattern-calendar-data.js");
  const calendarAt = HTML.indexOf("assets/js/calendar/pattern-calendar.js");
  const doorJsAt = HTML.indexOf("assets/js/ambient-door.js");
  assert.ok(dataAt > -1 && calendarAt > dataAt, "calendar loads before the door script");
  assert.ok(doorJsAt > calendarAt, "door script loads after the calendar");
});

test("the film is tap-to-play, never automatic, with a designed still", () => {
  assert.ok(!/autoplay/i.test(door), "no autoplay anywhere in the door");
  assert.match(door, /<video[^>]*controls/);
  assert.match(door, /preload="none"/);
  assert.match(door, /poster="assets\/media\/codex-cartoon-clip-poster\.webp"/);
  assert.match(door, /src="assets\/media\/codex-cartoon-clip\.mp4"/);
  assert.ok(fs.existsSync(path.join(ROOT, "docs/assets/media/codex-cartoon-clip.mp4")));
  assert.ok(fs.existsSync(path.join(ROOT, "docs/assets/media/codex-cartoon-clip-poster.webp")));
  // The still mode is designed, not a frozen accident.
  assert.match(CSS, /prefers-reduced-motion: reduce/);
});

test("the door invites, and every door below keeps its place", () => {
  assert.match(door, /href="\.\/living-time-sphere\.html"/, "Enter the Sphere");
  assert.match(door, /href="\.\/companions\.html"/, "Meet the Spark");
  assert.match(door, /href="#home-sphere-observatory"/, "Sit with the Sphere here");
  for (const needle of [
    'id="home-title"',
    'id="front-door"',
    'id="living-activity"',
    'id="home-sphere-observatory"',
    'id="living-phone-app"'
  ]) {
    assert.ok(HTML.includes(needle), `homepage keeps ${needle}`);
  }
});

test("the door's copy keeps the Spark ungendered", () => {
  assert.ok(!/\b(she|her|hers|herself)\b/i.test(door),
    "no she/her for the Spark (or anyone) in the door's copy");
});
