"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
function context() {
  const ctx = { console, Date, Intl, URL }; ctx.globalThis=ctx; ctx.window=ctx;
  for (const rel of [
    "docs/assets/js/calendar/pattern-calendar-version.js",
    "docs/assets/js/calendar/pattern-calendar-data.js",
    "docs/assets/js/calendar/pattern-calendar-format.js",
    "docs/assets/js/calendar/pattern-calendar-boundary.js",
    "docs/assets/js/calendar/pattern-calendar.js",
    "docs/assets/js/astronomy/equinox-reference-data.js",
    "docs/assets/js/astronomy/deep-time-seasonal-ledger.js",
    "docs/assets/js/sphere/living-time-sphere-url-state.js"
  ]) vm.runInNewContext(fs.readFileSync(path.join(root, rel), "utf8"), ctx);
  return ctx;
}
test("deep-time ledger builds all four events across full supported range",()=>{
  const c=context();
  for (const year of [1000,1500,2026,2500,3000]) {
    const built=c.DeepTimeSeasonalLedger.buildYear(year);
    assert.equal(built.events.length,4);
    for (const event of built.events) {
      assert.ok(Number.isFinite(Date.parse(event.utcInstant)));
      assert.ok(Number.isFinite(event.julianEphemerisDateTT));
      assert.ok(Number.isFinite(event.deltaTSeconds));
      assert.ok(event.pattern);
    }
  }
});
test("deep-time events follow seasonal order",()=>{
  const c=context();
  for (const year of [1000,2026,3000]) {
    const times=c.DeepTimeSeasonalLedger.buildYear(year).events.map(e=>Date.parse(e.utcInstant));
    for (let index=1; index<times.length; index+=1) assert.ok(times[index] > times[index-1]);
  }
});
test("URL state accepts 1000-3000 and rejects outside range",()=>{
  const c=context();
  assert.equal(c.LivingTimeSphereUrlState.parseSphereUrl("https://x/living-time-sphere.html?deep_year=1000").deepTimeYear,1000);
  assert.equal(c.LivingTimeSphereUrlState.parseSphereUrl("https://x/living-time-sphere.html?deep_year=3000").deepTimeYear,3000);
  assert.equal(c.LivingTimeSphereUrlState.parseSphereUrl("https://x/living-time-sphere.html?deep_year=999").deepTimeYear,null);
  assert.equal(c.LivingTimeSphereUrlState.parseSphereUrl("https://x/living-time-sphere.html?deep_year=3001").deepTimeYear,null);
});
