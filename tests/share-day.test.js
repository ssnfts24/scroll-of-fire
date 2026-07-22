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
  const elements = documentOverrides.elements || {};
  function elementOf(id) {
    return elements[id] || null;
  }
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
    querySelector() {
      return null;
    },
    getElementById(id) {
      return elementOf(id);
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
    getSelection: () => ({ toString: () => "" }),
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

function sampleState(overrides = {}) {
  return {
    isoDate: "2026-07-17",
    moonName: "Stone Witness",
    moonNumber: 4,
    moonDay: 4,
    yearDay: 88,
    weekGate: "Week 1 · Ignition",
    phaseName: "Waning Crescent",
    movement: "Ground what has become scattered.",
    shabbatCode: "ordinary",
    shabbatState: "Ordinary Day",
    link: "https://codexofreality.org/moons.html?date=2026-07-17",
    ...overrides
  };
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

test("compact description mode builds deterministic concise text", () => {
  const api = evalShareDay();
  const state = sampleState();
  const opts = { includeCalendar: true, includeReflection: true, includeLink: true, includeHashtags: true, includeIntention: false };

  const a = api.buildDescriptionPackage(state, "compact", opts);
  const b = api.buildDescriptionPackage(state, "compact", opts);

  assert.equal(a.description, b.description);
  assert.ok(a.description.length > 100);
  assert.ok(a.hashtags.length >= 3 && a.hashtags.length <= 5);
});

test("standard and professional modes are supported", () => {
  const api = evalShareDay();
  const state = sampleState();

  const standard = api.buildDescriptionPackage(state, "standard");
  const professional = api.buildDescriptionPackage(state, "professional");

  assert.equal(standard.mode, "standard");
  assert.equal(professional.mode, "professional");
  assert.notEqual(standard.description, professional.description);
});

test("different moons produce different deterministic opening text", () => {
  const api = evalShareDay();
  const stone = api.buildDescriptionPackage(sampleState({ moonNumber: 4, moonName: "Stone Witness" }), "standard");
  const living = api.buildDescriptionPackage(sampleState({ moonNumber: 5, moonName: "Living Word" }), "standard");
  assert.notEqual(stone.openingHook, living.openingHook);
});

test("shabbat treatment includes shabbat language and hashtags", () => {
  const api = evalShareDay();
  const shabbat = api.buildDescriptionPackage(sampleState({ shabbatCode: "shabbat", shabbatState: "Shabbat" }), "standard");
  assert.match(shabbat.description, /Shabbat/i);
  assert.ok(shabbat.hashtags.includes("#Shabbat"));
});

test("preparation treatment includes preparation language", () => {
  const api = evalShareDay();
  const prep = api.buildDescriptionPackage(sampleState({ shabbatCode: "preparation", shabbatState: "Preparation" }), "standard");
  assert.match(prep.description, /Preparation/i);
});

test("return treatment includes return language", () => {
  const api = evalShareDay();
  const ret = api.buildDescriptionPackage(sampleState({ shabbatCode: "return", shabbatState: "Return" }), "standard");
  assert.match(ret.description, /Return day/i);
});

test("day out of time treatment includes threshold language", () => {
  const api = evalShareDay();
  const dayOut = api.buildDescriptionPackage(sampleState({ moonDay: null, yearDay: null, weekGate: "Day Out of Time" }), "standard");
  assert.match(dayOut.description, /Day Out of Time/i);
});

test("new moon transition wording appears on moon day one", () => {
  const api = evalShareDay();
  const transition = api.buildDescriptionPackage(sampleState({ moonNumber: 5, moonName: "Living Word", moonDay: 1 }), "standard");
  assert.match(transition.openingHook, /new Moon chamber opens/i);
  assert.match(transition.openingHook, /(Stone Witness|Moon 4)/);
  assert.match(transition.openingHook, /Living Word/);
});

test("hashtags keep 3-5 unique tags", () => {
  const api = evalShareDay();
  const tags = api.buildHashtags(sampleState(), "standard");
  assert.ok(tags.length >= 3 && tags.length <= 5);
  assert.equal(new Set(tags).size, tags.length);
});

test("ordinary days do not include shabbat hashtag", () => {
  const api = evalShareDay();
  const tags = api.buildHashtags(sampleState({ shabbatCode: "ordinary", shabbatState: "Ordinary Day" }), "standard");
  assert.equal(tags.includes("#Shabbat"), false);
});

test("non-professional mode omits development discovery hashtags", () => {
  const api = evalShareDay();
  const tags = api.buildHashtags(sampleState(), "standard");
  assert.equal(tags.includes("#CreativeTechnology"), false);
});

test("copy complete post keeps expected line breaks", () => {
  const api = evalShareDay();
  const text = api._test.buildCompletePost("Line 1\nLine 2", "https://example.test", ["#One", "#Two"], true, true);
  assert.equal(text, "Line 1\nLine 2\nhttps://example.test\n\n#One #Two");
});

test("native share plan uses image+text when supported", () => {
  const api = evalShareDay();
  const nav = {
    share() {},
    canShare(payload) {
      return !!(payload.files && payload.text && payload.url);
    }
  };
  const plan = api._test.buildNativeSharePlan(nav, { name: "x.png" }, { title: "t", text: "body", url: "https://e.test" });
  assert.equal(plan.method, "file-text-link");
});

test("native share plan falls back to file-only when text payload unsupported", () => {
  const api = evalShareDay();
  const nav = {
    share() {},
    canShare(payload) {
      return !!(payload.files && !payload.text && !payload.url);
    }
  };
  const plan = api._test.buildNativeSharePlan(nav, { name: "x.png" }, { title: "t", text: "body", url: "https://e.test" });
  assert.equal(plan.method, "file-only");
});

test("native share plan returns text-link when file sharing unsupported", () => {
  const api = evalShareDay();
  const nav = {
    share() {},
    canShare() { return false; }
  };
  const plan = api._test.buildNativeSharePlan(nav, { name: "x.png" }, { title: "t", text: "body", url: "https://e.test" });
  assert.equal(plan.method, "text-link");
});

test("buildDescriptionPackage supports custom edits and restore source separation", () => {
  const api = evalShareDay();
  const pkg = api.buildDescriptionPackage(sampleState(), "standard");
  const edited = `${pkg.description}\n\nCustom user line.`;
  const complete = api._test.buildCompletePost(edited, pkg.link, pkg.hashtags, true, true);
  assert.match(complete, /Custom user line/);
  assert.match(complete, /#CodexOfReality/);
});

test("offline generation uses deterministic local mappings", () => {
  const api = evalShareDay();
  const a = api.buildDescriptionPackage(sampleState(), "standard");
  const b = api.buildDescriptionPackage(sampleState(), "standard");
  assert.equal(a.completePost, b.completePost);
});

test("share-day source does not call external AI or remote text generation", () => {
  const src = read("docs/assets/js/share-day.js");
  assert.equal(/openai|anthropic|\/chat\/completions|generativelanguage|api\.openai|fetch\([^)]*http/i.test(src), false);
});

test("share text excludes private witness content", () => {
  const api = evalShareDay();
  const pkg = api.buildDescriptionPackage(sampleState(), "standard");
  assert.equal(/witness entry|private note|ledger note/i.test(pkg.completePost), false);
});

test("safety helper accepts only strict ISO dates", () => {
  const api = evalShareDay();
  assert.equal(api._test.safeISO("2026-07-17"), "2026-07-17");
  assert.equal(api._test.safeISO("2026-7-17"), "");
  assert.equal(api._test.safeISO("javascript:alert(1)"), "");
});

test("modal markup includes unified sharing controls", () => {
  const src = read("docs/assets/js/share-day.js");
  assert.match(src, /Compact/);
  assert.match(src, /Standard/);
  assert.match(src, /Copy Signal/);
  assert.match(src, /Copy Full Scroll/);
  assert.match(src, /Native Share/);
  assert.match(src, /Copy Permanent Link/);
  assert.match(src, /Generate Share Image/);
  assert.match(src, /Share menu/);
  assert.match(src, /Share text/);
  assert.match(src, /Share image/);
  assert.match(src, /Copy link/);
  assert.match(src, /Export/);
  assert.match(src, /data-share-day-char-count/);
  assert.match(src, /role="dialog"/);
});

test("buildSourcePayload registers all required phase-1 sources", () => {
  const api = evalShareDay();
  const ids = [
    "today",
    "daily-mirror",
    "daily-flow",
    "shabbat",
    "daily-witness",
    "year-map",
    "oracle-quick-seal",
    "oracle-daily-mirror",
    "oracle-generated-seal",
    "generated-seal"
  ];
  ids.forEach(id => {
    const payload = api.buildSourcePayload(id);
    assert.equal(payload.sourceId, id);
    assert.equal(typeof payload.signal, "string");
    assert.equal(typeof payload.standard, "string");
    assert.equal(typeof payload.full, "string");
    assert.equal(typeof payload.link, "string");
  });
});

test("daily witness payload only shares user-selected text with privacy warning", () => {
  const api = evalShareDay(
    { getSelection: () => ({ toString: () => "Selected witness sentence." }) }
  );
  const payload = api.buildSourcePayload("daily-witness");
  assert.equal(payload.hasSelection, true);
  assert.match(payload.warning, /Privacy warning/i);
  assert.equal(payload.standard.includes("Selected witness sentence."), true);
  assert.equal(/private local logs/i.test(payload.standard), true);
});

test("oracle quick seal payload excludes personal inputs by default", () => {
  const api = evalShareDay({}, {
    elements: {
      quickSeal: {
        textContent: "Quick Seal: Stone Witness\nName: Private Person\nBirth Date: 1990-01-01\nSymbolic Signature: 8-4-1"
      },
      inTZ: { value: "UTC" },
      inBoundary: { value: "sunset" },
      inSunset: { value: "18:00" }
    }
  });
  const payload = api.buildSourcePayload("oracle-quick-seal");
  assert.equal(/Name:/i.test(payload.standard), false);
  assert.equal(/Birth Date:/i.test(payload.standard), false);
  assert.match(payload.standard, /Symbolic Signature|Quick Seal/i);
});

test("year-map payload includes selected pattern date fields", () => {
  const api = evalShareDay({}, {
    elements: {
      datePick: { value: "2026-07-17" },
      moonName: { textContent: "Stone Witness" },
      dayInMoon: { textContent: "4" },
      weekGate: { textContent: "Week 1 · Ignition" },
      dayArchetype: { textContent: "Witness" }
    }
  });
  const payload = api.buildSourcePayload("year-map");
  assert.match(payload.standard, /2026-07-17/);
  assert.match(payload.standard, /Stone Witness/);
  assert.match(payload.standard, /Week 1/i);
  assert.match(payload.standard, /Witness/);
});
