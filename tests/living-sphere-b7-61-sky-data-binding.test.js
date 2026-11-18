const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");

function loadModule(relPath, globalName) {
  const filePath = path.join(ROOT, relPath);
  const sandbox = {};
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(filePath, "utf8"), sandbox, { filename: filePath });
  return sandbox[globalName];
}

const sky = loadModule("docs/assets/js/sphere/living-time-sphere-sky.js", "LivingTimeSphereSky");
const renderer = fs.readFileSync(path.join(ROOT, "docs/assets/js/sphere/living-time-sphere-renderer-3d.js"), "utf8");
const svgRenderer = fs.readFileSync(path.join(ROOT, "docs/assets/js/sphere/living-time-sphere-renderer-svg.js"), "utf8");

function snapshot(current, hourly = {}) {
  return { current, hourly, daily: {}, fetchedAt: "2026-11-17T12:00:00Z" };
}

test("B7.61 no snapshot -> honest unset sky, nothing invented", () => {
  for (const input of [null, undefined, {}, { current: null }]) {
    const s = sky.skyFromSnapshot(input);
    assert.equal(s.hasData, false);
    assert.equal(s.precipitation.mode, "none");
    assert.equal(s.veilOpacity, 0);
    assert.equal(s.driftRadiansPerSecond, 0);
  }
});

test("B7.61 cover drives band opacity and density monotonically", () => {
  assert.equal(sky.bandOpacity(0), 0);
  assert.ok(sky.bandOpacity(50) > sky.bandOpacity(25));
  assert.ok(sky.bandOpacity(100) > sky.bandOpacity(50));
  assert.ok(Math.abs(sky.bandOpacity(50) - 0.475) < 1e-9, "50% cover is clearly visible, not a whisper");
  assert.ok(Math.abs(sky.bandOpacity(100) - 0.85) < 1e-9);
  assert.equal(sky.bandDensity(0), 0);
  assert.equal(sky.bandDensity(20), 1);
  assert.equal(sky.bandDensity(50), 2);
  assert.equal(sky.bandDensity(90), 3);
});

test("B7.61 low/mid/high cover feed their own bands, total is the fallback", () => {
  const s = sky.skyFromSnapshot(snapshot(
    { cloudCover: 40, weatherCode: 2, precipitation: 0, isDay: 1, windSpeed: 5 },
    { cloud_cover_low: [90], cloud_cover_mid: [10], cloud_cover_high: [0] }
  ));
  assert.equal(s.bands[0].level, "low");
  assert.equal(s.bands[0].cover, 90);
  assert.equal(s.bands[0].density, 3);
  assert.equal(s.bands[1].cover, 10);
  assert.equal(s.bands[1].density, 1);
  assert.equal(s.bands[2].cover, 0);
  assert.equal(s.bands[2].opacity, 0);

  const fallback = sky.skyFromSnapshot(snapshot(
    { cloudCover: 40, weatherCode: 2, precipitation: 0, isDay: 1, windSpeed: 5 }
  ));
  assert.ok(fallback.bands.every(b => b.cover === 40));
});

test("B7.61 weather_code chooses precipitation mode; rate sets intensity", () => {
  const rain = sky.skyFromSnapshot(snapshot({ cloudCover: 80, weatherCode: 61, precipitation: 2.4, isDay: 1, windSpeed: 12 }));
  assert.equal(rain.precipitation.mode, "rain");
  assert.ok(Math.abs(rain.precipitation.intensity - 0.63) < 1e-9);

  for (const code of [71, 73, 75, 77, 85, 86]) {
    const snow = sky.skyFromSnapshot(snapshot({ cloudCover: 90, weatherCode: code, precipitation: 1, isDay: 1, windSpeed: 4 }));
    assert.equal(snow.precipitation.mode, "snow", `code ${code} must read as snow`);
  }
  for (const code of [51, 63, 65, 80, 82, 95]) {
    const r = sky.skyFromSnapshot(snapshot({ cloudCover: 90, weatherCode: code, precipitation: 1, isDay: 1, windSpeed: 4 }));
    assert.equal(r.precipitation.mode, "rain", `code ${code} must read as rain`);
  }

  const dry = sky.skyFromSnapshot(snapshot({ cloudCover: 10, weatherCode: 1, precipitation: 0, isDay: 1, windSpeed: 4 }));
  assert.equal(dry.precipitation.mode, "none");
  assert.equal(dry.precipitation.intensity, 0);
});

test("B7.61 is_day and cover set the light; night wins over cover", () => {
  const noon = sky.skyFromSnapshot(snapshot({ cloudCover: 5, weatherCode: 0, precipitation: 0, isDay: 1, windSpeed: 3 }));
  assert.equal(noon.light.mode, "day");

  const grey = sky.skyFromSnapshot(snapshot({ cloudCover: 85, weatherCode: 3, precipitation: 0, isDay: 1, windSpeed: 3 }));
  assert.equal(grey.light.mode, "overcast");
  assert.ok(grey.veilOpacity > 0);

  const night = sky.skyFromSnapshot(snapshot({ cloudCover: 85, weatherCode: 3, precipitation: 0, isDay: 0, windSpeed: 3 }));
  assert.equal(night.light.mode, "night");
  assert.ok(night.light.cloudColor !== noon.light.cloudColor);
});

test("B7.61 wind speed sets drift, capped, never negative", () => {
  assert.ok(Math.abs(sky.driftRadiansPerSecond(0) - 0.003) < 1e-9);
  assert.ok(sky.driftRadiansPerSecond(30) > sky.driftRadiansPerSecond(5));
  assert.ok(Math.abs(sky.driftRadiansPerSecond(500) - 0.053) < 1e-9);
  const s = sky.skyFromSnapshot(snapshot({ cloudCover: 20, weatherCode: 1, precipitation: 0, isDay: 1, windSpeed: 30 }));
  assert.ok(Math.abs(s.driftRadiansPerSecond - sky.driftRadiansPerSecond(30)) < 1e-9);
});

test("B7.61 both renderers draw from the one sky mapping", () => {
  assert.match(renderer, /LivingTimeSphereSky\?\.skyFromSnapshot/);
  assert.match(renderer, /environment-cloud-veil/);
  assert.match(renderer, /_animateSky/);
  assert.match(svgRenderer, /renderCloudVeil/);
  assert.match(svgRenderer, /LivingTimeSphereSky\?\.skyFromSnapshot/);
});
