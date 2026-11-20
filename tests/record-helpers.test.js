"use strict";

/**
 * Record Helpers — the one record layer (build-it-once foundation F1).
 *
 * Pins the shared module every Life Atlas door now imports
 * (life-atlas/record-helpers.js, CodexRecordHelpers) and the drift
 * resolutions its header documents:
 *
 * - cleanText trims and caps but does NOT collapse internal
 *   whitespace (the day-notes copy collapsed; collapsing rewrites
 *   what a keeper wrote). Default cap 4000 — the largest of the
 *   drifted defaults, preserving the most content.
 * - cleanNullable's default cap is 80 (its real work is short
 *   fields); every door call site passes an explicit cap.
 * - temporalFromConversion's shape is the one temporal shape every
 *   door stamps — field for field, including patternYear as the
 *   anchor's civil year and outsideDay for uncounted days.
 * - todayISOInZone assembles from parts, accepts an injectable
 *   `now`, and returns null on a failed zone lookup.
 * - createRepositoryResolver caches per door and walks the doors'
 *   idiom: runtime, then persistent, then in-memory, then null.
 * - The doors no longer define the helpers: the copies are gone
 *   from day-notes.js, manifest-practice.js, shroom-garden.js, and
 *   presence-guidance.js, and the three door pages load the shared
 *   module before the doors that import it.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

const DOCS = path.resolve(__dirname, "../docs");
const JS = path.join(DOCS, "assets/js");

const Helpers = require(path.join(JS, "life-atlas/record-helpers.js"));

test("cleanText trims and caps, and preserves internal whitespace", () => {
  assert.equal(Helpers.cleanText(null), "");
  assert.equal(Helpers.cleanText(undefined), "");
  assert.equal(Helpers.cleanText("  hello  "), "hello");
  // The pinned drift resolution: no collapsing. The words a keeper
  // wrote stay the words that are stored.
  assert.equal(Helpers.cleanText("a  b\tc"), "a  b\tc");
  assert.equal(Helpers.cleanText("abcdef", 3), "abc");
  // Default cap is 4000, the largest of the drifted defaults.
  assert.equal(Helpers.cleanText("x".repeat(5000)).length, 4000);
  assert.equal(Helpers.cleanText(42), "42");
});

test("cleanNullable returns null for empty, caps at 80 by default", () => {
  assert.equal(Helpers.cleanNullable(""), null);
  assert.equal(Helpers.cleanNullable("   "), null);
  assert.equal(Helpers.cleanNullable(null), null);
  assert.equal(Helpers.cleanNullable("  zone  "), "zone");
  assert.equal(Helpers.cleanNullable("y".repeat(120)).length, 80);
  assert.equal(Helpers.cleanNullable("y".repeat(120), 2000).length, 120);
});

test("finiteOrNull keeps finite numbers, nulls the rest", () => {
  assert.equal(Helpers.finiteOrNull(3.5), 3.5);
  assert.equal(Helpers.finiteOrNull("7"), 7);
  assert.equal(Helpers.finiteOrNull(""), null);
  assert.equal(Helpers.finiteOrNull(null), null);
  assert.equal(Helpers.finiteOrNull(undefined), null);
  assert.equal(Helpers.finiteOrNull("abc"), null);
  assert.equal(Helpers.finiteOrNull(Infinity), null);
  assert.equal(Helpers.finiteOrNull(NaN), null);
});

test("temporalFromConversion stamps the one temporal shape", () => {
  const conversion = {
    anchorDate: new Date(Date.UTC(2026, 3, 17)),
    timeZone: "America/Los_Angeles",
    boundaryMode: "sunset",
    civilDate: "2026-09-15",
    moon: 6,
    day: 12,
    dayOfPatternYear: 152,
    weekOfYear: 22,
    insideCountedYear: true
  };

  const temporal = Helpers.temporalFromConversion(
    conversion,
    new Date("2026-09-15T12:00:00.000Z")
  );

  assert.deepEqual(temporal, {
    instant: "2026-09-15T12:00:00.000Z",
    start: "2026-09-15T12:00:00.000Z",
    end: null,
    timezone: "America/Los_Angeles",
    boundaryMode: "sunset",
    civilDate: "2026-09-15",
    patternYear: 2026,
    moon: 6,
    moonDay: 12,
    patternDay: 152,
    week: 22,
    weekGate: null,
    outsideDay: false
  });

  // A day outside the counted year: outsideDay set, shape unchanged.
  const outside = Helpers.temporalFromConversion({
    ...conversion,
    insideCountedYear: false
  });
  assert.equal(outside.outsideDay, true);
  assert.equal(outside.instant, null);

  // Short fields are capped by the shared cleaning rules.
  const long = Helpers.temporalFromConversion({
    ...conversion,
    timeZone: "z".repeat(200)
  });
  assert.equal(long.timezone.length, 80);

  assert.equal(Helpers.temporalFromConversion(null), null);
  assert.equal(Helpers.temporalFromConversion("nope"), null);
});

test("todayISOInZone assembles the civil date in the zone", () => {
  const now = new Date("2026-11-19T12:00:00.000Z");
  assert.equal(Helpers.todayISOInZone("UTC", now), "2026-11-19");
  assert.equal(
    Helpers.todayISOInZone("America/Los_Angeles", now),
    "2026-11-19"
  );
  assert.equal(
    Helpers.todayISOInZone("Pacific/Auckland", now),
    "2026-11-20"
  );
  // A failed zone lookup has no date to offer.
  assert.equal(Helpers.todayISOInZone("Not/AZone", now), null);
});

test("createRepositoryResolver caches and walks the doors' idiom", async () => {
  const savedRuntime = globalThis.CodexLifeAtlasRuntime;
  const savedRepository = globalThis.CodexLifeAtlasRepository;

  try {
    // Runtime first, and the promise is cached per resolver.
    const runtimeRepository = { marker: "runtime" };
    globalThis.CodexLifeAtlasRuntime = {
      ready: Promise.resolve(runtimeRepository)
    };
    globalThis.CodexLifeAtlasRepository = null;

    const resolve = Helpers.createRepositoryResolver();
    const first = resolve();
    const second = resolve();
    assert.equal(first, second);
    assert.equal(await first, runtimeRepository);

    // No runtime: persistent repository next — and the factory runs
    // once per resolver however many times the door asks.
    delete globalThis.CodexLifeAtlasRuntime;
    const persistent = { marker: "persistent" };
    let persistentCalls = 0;
    globalThis.CodexLifeAtlasRepository = {
      createPersistentRepository: () => {
        persistentCalls += 1;
        return persistent;
      },
      createRepository: () => ({ marker: "memory" })
    };
    const resolvePersistent = Helpers.createRepositoryResolver();
    assert.equal(await resolvePersistent(), persistent);
    assert.equal(await resolvePersistent(), persistent);
    assert.equal(persistentCalls, 1);

    // Persistent throws (no IndexedDB): in-memory fallback.
    globalThis.CodexLifeAtlasRepository = {
      createPersistentRepository: () => {
        throw new Error("no indexeddb");
      },
      createRepository: () => ({ marker: "memory" })
    };
    const memory = await Helpers.createRepositoryResolver()();
    assert.equal(memory.marker, "memory");

    // No Atlas on the page at all: null, honestly.
    globalThis.CodexLifeAtlasRepository = null;
    assert.equal(await Helpers.createRepositoryResolver()(), null);
  } finally {
    if (savedRuntime === undefined) {
      delete globalThis.CodexLifeAtlasRuntime;
    } else {
      globalThis.CodexLifeAtlasRuntime = savedRuntime;
    }
    if (savedRepository === undefined) {
      delete globalThis.CodexLifeAtlasRepository;
    } else {
      globalThis.CodexLifeAtlasRepository = savedRepository;
    }
  }
});

test("notifyRecordsChanged dispatches the shared event where a page exists", () => {
  const seen = [];
  globalThis.document = {
    dispatchEvent: event => seen.push(["document", event.type, event.detail])
  };
  globalThis.window = {
    dispatchEvent: event => seen.push(["window", event.type, event.detail])
  };

  try {
    Helpers.notifyRecordsChanged({ source: "test" });
    assert.deepEqual(seen, [
      ["document", "sof:life-atlas-records-changed", { source: "test" }],
      ["window", "sof:life-atlas-records-changed", { source: "test" }]
    ]);
  } finally {
    delete globalThis.document;
    delete globalThis.window;
  }
});

test("the doors import the helpers — the copies are gone", () => {
  const doors = [
    "day-notes.js",
    "manifest-practice.js",
    "shroom-garden.js",
    "presence-guidance.js"
  ];

  for (const door of doors) {
    const source = fs.readFileSync(path.join(JS, door), "utf8");
    assert.match(
      source,
      /life-atlas\/record-helpers\.js/,
      `${door} must load the shared record helpers`
    );
    for (const name of [
      "cleanText",
      "cleanNullable",
      "finiteOrNull",
      "temporalFromConversion",
      "notifyRecordsChanged",
      "resolveRepository"
    ]) {
      assert.ok(
        !new RegExp(`function ${name}\\s*\\(`).test(source),
        `${door} must not re-define ${name}`
      );
    }
  }
});

test("the door pages load the shared module before the doors", () => {
  const pages = {
    "moons.html": "manifest-practice.js",
    "teach.html": "manifest-practice.js",
    "garden.html": "shroom-garden.js"
  };

  for (const [page, door] of Object.entries(pages)) {
    const html = fs.readFileSync(path.join(DOCS, page), "utf8");
    const helpersAt = html.indexOf('src="assets/js/life-atlas/record-helpers.js');
    const doorAt = html.indexOf(`src="assets/js/${door}`);
    assert.ok(helpersAt !== -1, `${page} must load record-helpers.js`);
    assert.ok(doorAt !== -1, `${page} must load ${door}`);
    assert.ok(
      helpersAt < doorAt,
      `${page} must load record-helpers.js before ${door}`
    );
  }
});

test("the doors still stamp identical temporals through the shared module", () => {
  const DayNotes = require(path.join(JS, "day-notes.js"));
  const Manifest = require(path.join(JS, "manifest-practice.js"));
  const Garden = require(path.join(JS, "shroom-garden.js"));

  const conversion = {
    anchorDate: new Date(Date.UTC(2026, 3, 17)),
    timeZone: "UTC",
    boundaryMode: "sunset",
    civilDate: "2026-09-15",
    moon: 6,
    day: 12,
    dayOfPatternYear: 152,
    weekOfYear: 22,
    insideCountedYear: true
  };
  const instant = new Date("2026-09-15T12:00:00.000Z");

  const fromNotes = DayNotes.temporalFromConversion(conversion, instant);
  const fromManifest = Manifest.temporalFromConversion(conversion, instant);
  const fromGarden = Garden.temporalFromConversion(conversion, instant);

  assert.deepEqual(fromNotes, fromManifest);
  assert.deepEqual(fromManifest, fromGarden);
  assert.deepEqual(fromNotes, Helpers.temporalFromConversion(conversion, instant));
});
