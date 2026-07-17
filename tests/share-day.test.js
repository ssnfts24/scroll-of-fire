"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function evalShareDay(windowOverrides = {}, documentOverrides = {}) {
  const src = read("docs/assets/js/share-day.js");
  const listeners = {};
  const documentStub = {
    readyState: "complete",
    body: {
      classList: { add() {}, remove() {} },
      appendChild() {},
      children: []
    },
    addEventListener(name, fn) {
      listeners[name] = fn;
    },
    querySelectorAll() {
      return [];
    },
    ...documentOverrides
  };

  const win = {
    location: { href: "https://codexofreality.org/" },
    CodexState: {},
    SOFCalendar: {
      todayISO: () => "2026-07-17",
      getTZ: () => "UTC"
    },
    addEventListener() {},
    ...windowOverrides
  };

  const noopElement = function HTMLElement() {};
  noopElement.prototype = {};

  const wrapper = new Function(
    "window",
    "document",
    "navigator",
    "URL",
    "File",
    "Image",
    "HTMLElement",
    src
  );

  wrapper(
    win,
    documentStub,
    { clipboard: null },
    URL,
    class FileMock { constructor(parts, name, opts) { this.parts = parts; this.name = name; this.type = opts?.type; } },
    class ImageMock {},
    noopElement
  );

  return win.CodexShareDay;
}

test("share-day.js exists", () => {
  assert.ok(fs.existsSync(path.join(root, "docs/assets/js/share-day.js")));
});

test("index and moons load share-day assets", () => {
  const index = read("docs/index.html");
  const moons = read("docs/moons.html");
  assert.ok(index.includes("assets/css/share-day.css"));
  assert.ok(index.includes("assets/js/share-day.js"));
  assert.ok(moons.includes("assets/css/share-day.css"));
  assert.ok(moons.includes("assets/js/share-day.js"));
});

test("share buttons exist in required views", () => {
  const index = read("docs/index.html");
  const moons = read("docs/moons.html");
  const codex = read("docs/assets/js/living-codex.js");
  assert.ok(index.includes("data-share-day-open") && index.includes("data-share-source=\"homepage\""));
  assert.ok(moons.includes("id=\"shareDayBtn\""));
  assert.ok(codex.includes("data-share-source=\"signal\""));
});

test("buildDeepLink respects production and project-base URLs", () => {
  const apiProd = evalShareDay({ location: { href: "https://codexofreality.org/index.html" } });
  assert.equal(apiProd.buildDeepLink("2026-07-17"), "https://codexofreality.org/moons.html?date=2026-07-17");

  const apiGh = evalShareDay({ location: { href: "https://example.test/scroll-of-fire/index.html" } });
  assert.equal(apiGh.buildDeepLink("2026-07-17"), "https://example.test/scroll-of-fire/moons.html?date=2026-07-17");
});

test("deriveShareState uses CodexState fallback", () => {
  const api = evalShareDay({
    CodexState: {
      isoDate: "2026-07-17",
      moonNumber: 4,
      moonName: "Stone Witness",
      moonDay: 4,
      yearDay: 88,
      weekGate: "Week 1 · Ignition",
      phaseName: "Waning Crescent",
      phaseIllumination: 0.02,
      shabbatLabel: "Ordinary Day",
      shabbatState: "ordinary",
      dailyMovement: "Ground what has become scattered.",
      sunsetTime: "20:21"
    }
  });

  const shareState = api.deriveShareState();
  assert.equal(shareState.moonName, "Stone Witness");
  assert.equal(shareState.moonNumber, 4);
  assert.equal(shareState.phaseIllumination, 2);
  assert.equal(shareState.shareButtonLabel, "Share Today");
});

test("deriveShareState from moon engine marks selected date", () => {
  const api = evalShareDay({
    ScrollOfFireMoons: {
      effectiveContext: () => ({
        civilISO: "2026-07-15",
        effectiveISO: "2026-07-15",
        info: {
          inside: true,
          moon: { idx: 4, name: "Stone Witness", essence: "Body" },
          dayInMoon: 2,
          dayOfYear: 86
        },
        shabbat: { state: "Ordinary Day", code: "ordinary" },
        sunset: "20:21"
      })
    }
  });

  const shareState = api.deriveShareState();
  assert.equal(shareState.shareButtonLabel, "Share This Day");
  assert.equal(shareState.isSelectedDate, true);
});

test("daily share text is deterministic and concise", () => {
  const api = evalShareDay();
  const state = {
    moonName: "Stone Witness",
    moonNumber: 4,
    moonDay: 4,
    yearDay: 88,
    phaseName: "Waning Crescent",
    movement: "Ground what has become scattered.",
    link: "https://codexofreality.org/moons.html?date=2026-07-17"
  };

  const a = api.buildDailyText(state, { includePhase: true, includeMovement: true, includeSunset: false });
  const b = api.buildDailyText(state, { includePhase: true, includeMovement: true, includeSunset: false });

  assert.equal(a, b);
  assert.ok(a.includes("Today’s movement:"));
  assert.ok(a.includes("#Remnant13Moons"));
});

test("moon theme mapping includes all 13 moons", () => {
  const api = evalShareDay();
  for (let i = 1; i <= 13; i += 1) {
    const theme = api.getMoonTheme(i);
    assert.ok(theme && theme.accent && theme.atmosphere, `missing theme for moon ${i}`);
  }
});

test("safety helper accepts only strict ISO dates", () => {
  const api = evalShareDay();
  assert.equal(api._test.safeISO("2026-07-17"), "2026-07-17");
  assert.equal(api._test.safeISO("2026-7-17"), "");
  assert.equal(api._test.safeISO("javascript:alert(1)"), "");
});

test("modal markup includes required controls", () => {
  const src = read("docs/assets/js/share-day.js");
  assert.match(src, /Share Image/);
  assert.match(src, /Download Square/);
  assert.match(src, /Download Story/);
  assert.match(src, /Copy Daily Text/);
  assert.match(src, /Copy Link/);
  assert.match(src, /role="dialog"/);
});
