"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8");

function storage() {
  return {
    _store: {},
    getItem(k) { return this._store[k] ?? null; },
    setItem(k, v) { this._store[k] = String(v); },
    removeItem(k) { delete this._store[k]; }
  };
}

function loadEnvContext(fetchImpl) {
  const listeners = new Map();
  const ctx = {
    Date,
    URL,
    URLSearchParams,
    console,
    AbortController,
    setTimeout,
    clearTimeout,
    localStorage: storage(),
    sessionStorage: storage(),
    navigator: { onLine: true },
    fetch: fetchImpl,
    CustomEvent: class {
      constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
    },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    dispatchEvent(event) {
      for (const listener of listeners.get(event.type) || []) listener.call(ctx, event);
      return true;
    },
  };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.runInNewContext(read("docs/assets/js/environment/environment-state.js"), ctx);
  vm.runInNewContext(read("docs/assets/js/environment/providers/open-meteo-forecast.js"), ctx);
  vm.runInNewContext(read("docs/assets/js/environment/open-meteo-adapter.js"), ctx);
  return ctx;
}

function samplePayload() {
  return {
    current: {
      temperature_2m: 20,
      apparent_temperature: 19,
      relative_humidity_2m: 58,
      dew_point_2m: 11,
      precipitation: 0,
      rain: 0,
      snowfall: 0,
      weather_code: 2,
      cloud_cover: 44,
      pressure_msl: 1012,
      wind_speed_10m: 8,
      wind_direction_10m: 228,
      wind_gusts_10m: 14,
      shortwave_radiation: 420,
      is_day: 1,
      time: "2026-07-31T00:00"
    },
    hourly: {
      time: ["2026-07-31T00:00"],
      cloud_cover_low: [22], cloud_cover_mid: [39], cloud_cover_high: [57],
      temperature_2m: [20], apparent_temperature: [19], relative_humidity_2m: [58],
      precipitation_probability: [10], precipitation: [0], weather_code: [2],
      pressure_msl: [1012], visibility: [9000], wind_speed_10m: [8], wind_direction_10m: [228],
      wind_gusts_10m: [14], shortwave_radiation: [420], uv_index: [4]
    },
    daily: {
      time: ["2026-07-31"],
      weather_code: [2],
      sunrise: ["2026-07-31T05:42"],
      sunset: ["2026-07-31T20:45"],
      daylight_duration: [54180],
      sunshine_duration: [39000],
      temperature_2m_max: [24],
      temperature_2m_min: [14],
      precipitation_probability_max: [18],
      precipitation_sum: [0],
      wind_speed_10m_max: [12],
      wind_gusts_10m_max: [22],
      uv_index_max: [8]
    }
  };
}

test("location first-run reports not set", () => {
  const ctx = loadEnvContext(async () => ({ ok: true, json: async () => samplePayload() }));
  const state = ctx.OpenMeteoAdapter.getLocationState();
  assert.equal(state.mode, "none");
});

test("manual coordinates validate and persist as active place", () => {
  const ctx = loadEnvContext(async () => ({ ok: true, json: async () => samplePayload() }));
  assert.equal(ctx.OpenMeteoAdapter.setManualCoordinates(47.61, -122.33, "Seattle"), true);
  assert.equal(ctx.OpenMeteoAdapter.setManualCoordinates(120, -122.33, "Bad"), false);
  const active = ctx.OpenMeteoAdapter.getActivePlace();
  assert.equal(active.name, "Seattle");
  assert.ok(Math.abs(active.latitude - 47.61) < 0.0001);
  const persisted = JSON.parse(ctx.sessionStorage.getItem(ctx.OpenMeteoAdapter.keys.activePlace));
  assert.equal(persisted.name, "Seattle");
});

test("provider request includes required forecast endpoint parameters", async () => {
  let requestedUrl = "";
  const ctx = loadEnvContext(async url => {
    requestedUrl = String(url);
    return { ok: true, json: async () => samplePayload() };
  });
  const result = await ctx.OpenMeteoForecastProvider.getForecastSnapshot({
    place: { name: "Seattle", latitude: 47.61, longitude: -122.33 },
    force: true
  });
  assert.equal(result.ok, true);
  assert.ok(requestedUrl.startsWith("https://api.open-meteo.com/v1/forecast?"));
  assert.ok(requestedUrl.includes("timezone=auto"));
  assert.ok(requestedUrl.includes("current=temperature_2m"));
  assert.ok(requestedUrl.includes("hourly=temperature_2m"));
  assert.ok(requestedUrl.includes("daily=weather_code"));
});

test("provider normalization maps condition and day values", async () => {
  const ctx = loadEnvContext(async () => ({ ok: true, json: async () => samplePayload() }));
  const result = await ctx.OpenMeteoAdapter.requestRefresh({
    place: { name: "Seattle", latitude: 47.61, longitude: -122.33 },
    force: true
  });
  assert.equal(result.providerConfigured, true);
  assert.equal(result.current.condition, "Partly cloudy");
  assert.equal(result.daily.sunrise, "2026-07-31T05:42");
  assert.equal(result.daily.sunset, "2026-07-31T20:45");
});

test("weather refresh is re-entry safe and performs one request per location", async () => {
  let fetchCount = 0;
  const ctx = loadEnvContext(async () => {
    fetchCount += 1;
    return { ok: true, json: async () => samplePayload() };
  });
  ctx.OpenMeteoAdapter.setManualCoordinates(47.61, -122.33, "Seattle");

  let reentrantRefresh = null;
  let loadingEvents = 0;
  ctx.addEventListener(ctx.SofEnvironmentState.EVENT_NAME, event => {
    if (event.detail?.state?.status !== "loading") return;
    loadingEvents += 1;
    if (!reentrantRefresh) {
      reentrantRefresh = ctx.OpenMeteoAdapter.requestRefresh({ force: false });
    }
  });

  const primaryRefresh = ctx.OpenMeteoAdapter.requestRefresh({ force: true });
  const result = await primaryRefresh;
  await reentrantRefresh;

  assert.equal(fetchCount, 1, "a synchronous environment listener must share the active request");
  assert.equal(loadingEvents, 1, "loading must be announced once without recursive dispatch");
  assert.equal(result.current.condition, "Partly cloudy");
  assert.equal(ctx.SofEnvironmentState.getEnvironmentState().status, "available");
});

test("live snapshot construction is pure and cannot start weather requests", () => {
  const code = read("docs/assets/js/sphere/living-time-sphere-live-data.js");
  const body = code.match(/function resolveWeather\(options\) \{([\s\S]*?)\n  \}\n\n  function resolveHistory/)?.[1] || "";
  assert.ok(body, "resolveWeather body should be discoverable");
  assert.doesNotMatch(body, /requestRefresh\s*\(/, "model reads must not initiate provider updates");
});

test("continue without weather clears persistent active location and snapshot", async () => {
  const ctx = loadEnvContext(async () => ({ ok: true, json: async () => samplePayload() }));
  ctx.OpenMeteoAdapter.setManualCoordinates(47.61, -122.33, "Seattle");
  await ctx.OpenMeteoAdapter.requestRefresh({ force: true });
  assert.equal(ctx.OpenMeteoAdapter.getActivePlace().name, "Seattle");

  ctx.OpenMeteoAdapter.continueWithoutLocation();

  assert.equal(ctx.OpenMeteoAdapter.getActivePlace(), null);
  assert.equal(ctx.localStorage.getItem(ctx.OpenMeteoAdapter.keys.activePlace), null);
  assert.equal(ctx.OpenMeteoAdapter.getSnapshot().providerConfigured, false);
});

test("stale fallback returns last successful snapshot when provider fails", async () => {
  let first = true;
  const ctx = loadEnvContext(async () => {
    if (first) {
      first = false;
      return { ok: true, json: async () => samplePayload() };
    }
    throw new Error("network down");
  });
  await ctx.OpenMeteoForecastProvider.getForecastSnapshot({
    place: { name: "Seattle", latitude: 47.61, longitude: -122.33 },
    force: true
  });
  const second = await ctx.OpenMeteoForecastProvider.getForecastSnapshot({
    place: { name: "Seattle", latitude: 47.61, longitude: -122.33 },
    force: true
  });
  assert.equal(second.ok, true);
  assert.equal(second.stale, true);
  assert.equal(second.snapshot.current.weather_code, 2);
});

test('label manager internals preserve persistent Observatory Moon identity labels', () => {
  const src = require('node:fs').readFileSync(
    'docs/assets/js/sphere/living-time-sphere-label-manager.js',
    'utf8'
  );

  assert.match(
    src,
    /labelMode === "all"[\s\S]*profile === "observatory"/
  );

  assert.match(
    src,
    /length:\s*13/
  );

  assert.match(
    src,
    /runtimeProfile !== "observatory"/
  );
});

test("label manager priority gives selected moon highest precedence", () => {
  const context = { globalThis: null, window: {}, console };
  context.globalThis = context;
  vm.runInNewContext(read("docs/assets/js/sphere/living-time-sphere-label-manager.js"), context);
  const priority = context.LivingTimeSphereLabelManager._internals.priorityForMoon;
  assert.ok(priority(6, { selectedMoon: 6, todayMoon: 5, selectedDayMoon: 5, equinoxMoon: 13 }) >
            priority(5, { selectedMoon: 6, todayMoon: 5, selectedDayMoon: 5, equinoxMoon: 13 }));
});
