const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const authorityPath = path.join(ROOT, "docs/assets/js/environment/environment-authority.js");

test("B7.61 the 10-minute environment cycle refreshes the forecast too", async () => {
  const place = { name: "Test Place", latitude: 47.6, longitude: -122.3 };
  let store = {
    status: "unavailable",
    place,
    current: null,
    hourly: [],
    daily: {},
    airQuality: null,
    spaceWeather: null,
    provenance: "none",
  };
  const calls = { forecast: [], air: 0, space: 0 };

  const sandbox = {};
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  sandbox.document = { visibilityState: "visible" };
  sandbox.setInterval = () => 0;
  sandbox.setTimeout = () => 0;
  sandbox.clearInterval = () => {};
  sandbox.addEventListener = () => {};
  sandbox.CustomEvent = class CustomEvent { constructor(name, init) { this.type = name; this.detail = init?.detail; } };
  sandbox.SofEnvironmentState = {
    EVENT_NAME: "sof:environment-change",
    getEnvironmentState: () => store,
    setEnvironmentState: (next) => { store = { ...next }; return store; },
  };
  sandbox.OpenMeteoAdapter = {
    getActivePlace: () => place,
    requestRefresh: async (options) => {
      calls.forecast.push(options);
      // The adapter writes the fresh forecast snapshot into the shared
      // state itself, exactly as the real adapter does.
      store = { ...store, current: { cloudCover: 42, weatherCode: 2, precipitation: 0, isDay: 1, windSpeed: 9 } };
      return store;
    },
  };
  sandbox.OpenMeteoAirQualityProvider = {
    getCurrent: async () => { calls.air += 1; return { status: "available", provider: "AQ", fetchedAt: "t1" }; },
  };
  sandbox.SofSpaceWeatherProvider = {
    getCurrent: async () => { calls.space += 1; return { status: "available", provider: "SW", fetchedAt: "t1" }; },
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(authorityPath, "utf8"), sandbox, { filename: authorityPath });

  const authority = sandbox.SofEnvironmentAuthority;
  assert.ok(authority, "authority module loads");

  const result = await authority.refreshCurrent({ force: true });

  assert.equal(calls.forecast.length, 1, "forecast fetch joins the refresh cycle");
  assert.equal(calls.forecast[0]?.force, true);
  assert.equal(calls.air, 1);
  assert.equal(calls.space, 1);
  // The augmentation write must preserve the fresh forecast fields.
  assert.equal(store.current.cloudCover, 42, "forecast current survives the AQ/SW augmentation");
  assert.equal(store.airQuality.provider, "AQ");
  assert.equal(store.spaceWeather.provider, "SW");
  assert.equal(result.current.cloudCover, 42);
});

test("B7.61 the authority reschedules when a placed state lacks a forecast", () => {
  const source = fs.readFileSync(authorityPath, "utf8");
  assert.match(source, /OpenMeteoAdapter[\s\S]*?requestRefresh/);
  assert.match(source, /!current\.current/);
});

test("B7.61 normalization preserves the hourly cloud-band arrays", () => {
  const statePath = path.join(ROOT, "docs/assets/js/environment/environment-state.js");
  const sandbox = {};
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(statePath, "utf8"), sandbox, { filename: statePath });
  const api = sandbox.SofEnvironmentState;
  const normalized = api.normalizeEnvironmentState({
    current: { cloudCover: 55 },
    hourly: { cloud_cover_low: [80], cloud_cover_mid: [40], cloud_cover_high: [5] },
  });
  assert.equal(normalized.hourly.cloud_cover_low[0], 80);
  assert.equal(normalized.hourly.cloud_cover_mid[0], 40);
  assert.equal(normalized.hourly.cloud_cover_high[0], 5);
});
