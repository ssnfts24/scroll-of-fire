"use strict";

/* Regression: the living signal bar died on pages that load calendar-cor.js
   without the Pattern Calendar engine (e.g. lab.html). calendar-cor's
   get13Moon throws by design when the engine is absent ("calculation was
   stopped to prevent a conflicting result"), and living-codex's refresh()
   called it unguarded, so buildState() threw before renderSignalBar() ran
   and the bar kept its static fallback text forever.
   The bar must degrade: render daypart + local time with no moon line. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const src = fs.readFileSync(
  path.join(root, "docs/assets/js/living-codex.js"),
  "utf8"
);

function runLivingCodex(calendarStub) {
  const signalRoot = { innerHTML: "STATIC FALLBACK" };
  const documentElement = {
    classList: { contains: () => false },
    setAttribute: () => {}
  };
  const doc = {
    readyState: "complete",
    baseURI: "https://codexofreality.org/",
    documentElement,
    addEventListener: () => {},
    dispatchEvent: () => {},
    querySelector: () => null,
    querySelectorAll: (selector) =>
      selector === "[data-living-signal-root]" ? [signalRoot] : []
  };
  const win = {
    SOFCalendar: calendarStub,
    ScrollOfFire: {},
    location: { pathname: "/lab.html" },
    setInterval: () => 0,
    addEventListener: () => {}
  };
  const sandbox = {
    window: win,
    document: doc,
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    },
    fetch: () => Promise.reject(new Error("offline in test")),
    CustomEvent: class CustomEvent {
      constructor(type, opts) {
        this.type = type;
        this.detail = opts && opts.detail;
      }
    },
    Intl,
    URL,
    Date,
    console
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return signalRoot;
}

function baseCalendar(overrides) {
  return {
    getTZ: () => "America/Los_Angeles",
    todayISO: () => "2026-11-18",
    daypart: () => "Day",
    formatLocalTime: () => "12:00 PM",
    getMoonPhase: () => ({ name: "Waxing Crescent", illumination: 0.22 }),
    ...overrides
  };
}

async function flush() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

test("signal bar renders when get13Moon throws (engine absent, lab.html case)", async () => {
  const signalRoot = runLivingCodex(
    baseCalendar({
      get13Moon: () => {
        throw new Error(
          "The shared Pattern Calendar engine is unavailable. Calendar calculation was stopped to prevent a conflicting result."
        );
      }
    })
  );
  await flush();
  assert.notEqual(signalRoot.innerHTML, "STATIC FALLBACK");
  assert.match(signalRoot.innerHTML, /Day · 12:00 PM/);
  assert.doesNotMatch(signalRoot.innerHTML, /☾/);
});

test("signal bar still shows the moon line when the engine answers", async () => {
  const signalRoot = runLivingCodex(
    baseCalendar({
      get13Moon: () => ({
        iso: "2026-11-18",
        moon: 8,
        moonName: "Test Moon",
        moonEssence: "",
        day: 20,
        week: 3,
        toneName: "Tone 7"
      })
    })
  );
  await flush();
  assert.match(signalRoot.innerHTML, /☾ Test Moon · Day 20\/28/);
  assert.match(signalRoot.innerHTML, /Day · 12:00 PM/);
});
