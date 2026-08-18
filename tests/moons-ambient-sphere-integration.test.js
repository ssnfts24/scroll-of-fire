const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const HTML = fs.readFileSync(path.join(ROOT, "docs/moons.html"), "utf8");

test("Moons uses one canonical ambient Sphere in the Today panel", () => {
  const matches = HTML.match(/runtimeProfile:\s*"ambient"/g) || [];

  assert.equal(
    matches.length,
    1,
    `expected exactly 1 ambient mount, found ${matches.length}`
  );
});

test("Moons Today sphere no longer declares a competing auto renderer", () => {
  const start = HTML.indexOf("function initTodaySphereCard()");
  assert.ok(start >= 0, "Today Sphere init must exist");
  const end = HTML.indexOf("function init()", start);
  const block = HTML.slice(start, end > start ? end : start + 7000);

  assert.match(block, /runtimeProfile:\s*"ambient"/);
  assert.doesNotMatch(block, /renderer:\s*"auto"/);
});

test("retired compact Sphere is absent from Moons Today panel", () => {
  assert.doesNotMatch(
    HTML,
    /id="sphereCompactCard"/
  );

  assert.doesNotMatch(
    HTML,
    /id="sphere-compact-preview"/
  );

  assert.doesNotMatch(
    HTML,
    /function initCompactSphere\(\)/
  );

  assert.doesNotMatch(
    HTML,
    /LivingTimeSphereRendererSvg\.renderInto/
  );
});

test("Moons selected date is mapped through canonical PatternCalendar before Sphere refresh", () => {
  assert.match(HTML, /function syncTodaySphereSelection\(\)/);
  assert.match(HTML, /ScrollOfFireMoons\.selectedCivilDate\(\)/);
  assert.match(HTML, /PatternCalendar\.fromCivilDate\(\{/);
  assert.match(HTML, /selectedDay:\s*mapped\.dayOfPatternYear/);
  assert.match(HTML, /selectedMoon:\s*mapped\.moon/);
  assert.match(HTML, /selectedMarker:\s*"day-"\s*\+\s*mapped\.dayOfPatternYear/);
});

test("Moons render event drives ambient Sphere selection synchronization", () => {
  assert.match(
    HTML,
    /addEventListener\("sof:moon-render",\s*function\(\)\s*\{\s*syncTodaySphereSelection\(\);/s
  );
});

test("ambient Sphere synchronization preserves configured temporal boundary", () => {
  assert.match(HTML, /timeZone:\s*opts\.timeZone/);
  assert.match(HTML, /boundaryMode:\s*opts\.boundaryMode/);
  assert.match(HTML, /manualSunset:\s*opts\.manualSunset/);
});
