"use strict";

/*
 * Social Bridge — share-out and follow doors, privacy-first.
 *
 * Pins Aaron's standing rules in code: nothing posts by itself (no
 * network calls, no SDKs, no auto-post verbs in the module), the words
 * follow the adopted posting-style frame (coordinate first, plain
 * punctuation, the closing ritual, three hashtags), the coordinate
 * comes from the canonical PatternCalendar only, and the follow doors
 * are exactly the profile links Aaron's About page already carries.
 * The Sphere page (R1.7) must never gain the bridge.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const MODULE = "docs/assets/js/social-bridge.js";
const source = read(MODULE);

const EXCLUDED = new Set([
  "living-time-sphere.html",
  "404.html",
  "offline.html",
  "caravan.html",
  // Page programme (Nov 24, 2026): the Remnant Whitepaper folded into
  // the Codex White Paper as Part II; this page is a redirect stub now.
  "scroll-of-fire-codex-of-reality-remnant-whitepaper.html",
  // Page programme (Nov 24, 2026): start.html and witness-world.html
  // folded into the front door and the Witness page; redirect stubs now.
  "start.html",
  "witness-world.html",
  // Page programme (Nov 24, 2026): the theory doorway merges folded
  // these four pages into their practical homes; they are now
  // meta-refresh redirect stubs, as caravan.html is.
  "theory/ethics.html",
  "theory/glossary.html",
  "theory/witness.html",
  "theory/frequency-governance.html",
  // Gate G (G2): account.html is a utility page, as offline.html.
  "account.html"
]);

function mainHousePages() {
  return fs
    .readdirSync(path.join(root, "docs"))
    .filter((name) => name.endsWith(".html") && !EXCLUDED.has(name))
    .filter((name) => read("docs/" + name).includes("living-ui.js"));
}

test("the bridge rides the shared living chrome on every main-house page", () => {
  const pages = mainHousePages();
  assert.ok(pages.length >= 30, "expected the main house, got " + pages.length);
  for (const name of pages) {
    const html = read("docs/" + name);
    assert.ok(html.includes("assets/css/social-bridge.css"), name + ": css");
    assert.ok(html.includes("assets/js/social-bridge.js"), name + ": js");
    if (name === "shop.html") {
      // The Living Moon Theme gave the whole main house — the shop
      // included — the canonical calendar, so the shop's bridge speaks
      // the full coordinate like every other room (an earlier pin held
      // the shop calendar-free; the moon theme superseded it, and
      // living-page-openings.test.js now requires the calendar there).
      assert.ok(html.includes("calendar/pattern-calendar.js"), "shop: calendar from the moon theme");
    }
    assert.ok(html.includes("assets/js/day-telling.js"), name + ": telling");
    assert.ok(
      html.includes("calendar/pattern-calendar.js"),
      name + ": canonical calendar"
    );
  }
});

test("the Sphere page carries no social bridge (R1.7)", () => {
  const sphere = read("docs/living-time-sphere.html");
  assert.ok(!sphere.includes("social-bridge"));
});

test("the module makes no network calls and loads no third-party code", () => {
  assert.ok(!/\bfetch\s*\(/.test(source), "no fetch");
  assert.ok(!/XMLHttpRequest/.test(source), "no XHR");
  assert.ok(!/sendBeacon/.test(source), "no beacon");
  assert.ok(!/connect\.facebook|platform\.twitter|sdk\.js/i.test(source), "no SDKs");
});

test("follow doors are exactly the profile links on Aaron's About page", () => {
  const about = read("docs/about-aaron.html");
  const context = { Date, Intl, URL, URLSearchParams, document: undefined };
  context.globalThis = context;
  context.window = context;
  // Load with no DOM: the module must expose its data and stop there.
  const sandbox = {
    Date, Intl, URL, URLSearchParams,
    document: { querySelector: () => null, body: null },
    navigator: {}
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  vm.runInNewContext(source, sandbox);
  const follow = sandbox.CodexSocialBridge.follow;
  assert.ok(Array.isArray(follow) && follow.length >= 4);
  for (const door of follow) {
    assert.ok(
      about.includes('href="' + door.href + '"'),
      "About page must already carry " + door.href
    );
  }
});

function loadBridge() {
  const scripts = [
    "docs/assets/js/calendar/pattern-calendar-version.js",
    "docs/assets/js/calendar/pattern-calendar-data.js",
    "docs/assets/js/calendar/pattern-calendar-format.js",
    "docs/assets/js/calendar/pattern-calendar-boundary.js",
    "docs/assets/js/calendar/pattern-calendar.js",
    "docs/assets/js/day-telling.js"
  ];
  const sandbox = {
    Date, Intl, URL, URLSearchParams,
    document: { querySelector: () => null, body: null },
    navigator: {},
    location: { href: "https://codexofreality.org/theory.html" }
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  scripts.forEach((s) => vm.runInNewContext(read(s), sandbox));
  vm.runInNewContext(source, sandbox);
  return sandbox.CodexSocialBridge;
}

test("Nov 19, 2026 share text follows the adopted frame, coordinate first", () => {
  const bridge = loadBridge();
  const moment = bridge.buildMoment("2026-11-19", {
    timeZone: "America/Los_Angeles",
    pageName: "Theory of Resonance",
    url: "https://codexofreality.org/theory.html"
  });
  assert.equal(moment.coordinate, "Moon 8 · Day 21 · Pattern Day 217");
  assert.equal(moment.moonName, "Deep Mirror");
  const lines = moment.text.split("\n");
  assert.equal(lines[0], "Moon 8 · Day 21 · Pattern Day 217");
  assert.equal(lines[1], "Moon of Deep Mirror");
  assert.match(lines[2], /Thursday, November 19, 2026/);
  assert.ok(moment.text.includes("Practice: Look beneath the surface. Journal before judging."));
  assert.ok(moment.text.includes("Observe. Breathe. Align. Return."));
  assert.ok(moment.text.includes("#13Moons #LivingTime #CodexOfReality"));
  assert.ok(!moment.text.includes("—"), "no em-dashes in the share words");
});

test("a second date gives its own day, not today's words", () => {
  const bridge = loadBridge();
  const moment = bridge.buildMoment("2026-07-17", {
    timeZone: "UTC",
    pageName: "Start",
    url: "https://codexofreality.org/start.html"
  });
  assert.equal(moment.coordinate, "Moon 4 · Day 8 · Pattern Day 92");
  assert.equal(moment.moonName, "Stone Witness");
});

test("with no calendar on the page, the bridge invents nothing", () => {
  const sandbox = {
    Date, Intl, URL, URLSearchParams,
    document: { querySelector: () => null, body: null },
    navigator: {},
    location: { href: "https://codexofreality.org/shop.html" }
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  vm.runInNewContext(source, sandbox);
  const moment = sandbox.CodexSocialBridge.buildMoment("2026-11-19", {
    timeZone: "America/Los_Angeles",
    pageName: "Shop",
    url: "https://codexofreality.org/shop.html"
  });
  assert.equal(moment.coordinate, null);
  assert.match(moment.text, /Thursday, November 19, 2026/);
  assert.ok(!/Pattern Day/.test(moment.text));
});

test("compose doors open the platforms' own composers with the words ready", () => {
  const bridge = loadBridge();
  const moment = bridge.buildMoment("2026-11-19", {
    timeZone: "America/Los_Angeles",
    pageName: "Theory of Resonance",
    url: "https://codexofreality.org/theory.html"
  });
  const links = bridge.composeLinks(moment);
  assert.ok(links.facebook.startsWith("https://www.facebook.com/sharer/sharer.php?u="));
  assert.ok(links.x.startsWith("https://twitter.com/intent/tweet?text="));
  assert.ok(decodeURIComponent(links.x).includes("Pattern Day 217"));
  assert.ok(links.email.startsWith("mailto:?subject="));
});
