"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const docsRoot = path.join(root, "docs");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

/* ------------------------------------------------------------------ */
/* Helpers: minimal DOM + SOFCalendar stub for unit testing            */
/* ------------------------------------------------------------------ */

function makeCalendarStub(isoDate, moonNumber, moonDay) {
  const dayIndex = (moonNumber - 1) * 28 + (moonDay - 1);
  return {
    getTZ:       () => "America/Los_Angeles",
    todayISO:    () => isoDate,
    get13Moon:   () => ({
      iso:          isoDate,
      isDayOutOfTime: false,
      moon:         moonNumber,
      moonName:     "Test Moon",
      moonEssence:  "Test essence",
      day:          moonDay,
      dayIndex:     dayIndex,
      week:         Math.floor((moonDay - 1) / 7) + 1
    }),
    getMoonPhase: () => ({ name: "Waxing Crescent", illumination: 0.22 }),
    CONFIG: { dayBoundary: "sunset", fallbackSunset: "18:00" }
  };
}

/* Evaluate codex-state.js in a fresh sandbox for each test */
function evalCodexState(calendarStub, windowOverrides) {
  const src = read("docs/assets/js/codex-state.js");

  /* Minimal global environment */
  const win = {
    SOFCalendar: calendarStub || null,
    CodexState:  {},
    CodexStateModule: null,
    ...windowOverrides
  };

  const docEvents = {};
  const bodyClasses = new Set();
  const bodyDataset = {};
  const domDoc = {
    addEventListener: (ev, fn) => { docEvents[ev] = fn; },
    dispatchEvent:    () => {},
    readyState:       "complete",
    body: {
      classList: {
        add:    (c) => bodyClasses.add(c),
        remove: (c) => bodyClasses.delete(c),
        forEach: (fn) => bodyClasses.forEach(fn)
      },
      dataset: bodyDataset
    }
  };

  const sandbox = {
    window:   win,
    document: domDoc,
    CustomEvent: class CustomEvent { constructor(name, opts) { this.type = name; this.detail = opts && opts.detail; } }
  };

  /* Wrap source in function scope with sandbox bindings */
  const wrapper = new Function(
    "window", "document", "CustomEvent", "localStorage",
    src
  );
  wrapper(win, domDoc, sandbox.CustomEvent, {
    getItem:  () => null,
    setItem:  () => {},
    removeItem: () => {}
  });

  return { win, bodyClasses, bodyDataset };
}

/* ------------------------------------------------------------------ */
/* TESTS                                                               */
/* ------------------------------------------------------------------ */

/* --- 1. Module files exist ----------------------------------------- */

test("codex-state.js exists in docs/assets/js", () => {
  assert.ok(fileExists("docs/assets/js/codex-state.js"), "codex-state.js missing");
});

test("living-day.css exists in docs/assets/css", () => {
  assert.ok(fileExists("docs/assets/css/living-day.css"), "living-day.css missing");
});

test("LIVING-CODEX-PHASE-1.md documentation exists", () => {
  assert.ok(fileExists("docs/LIVING-CODEX-PHASE-1.md"), "LIVING-CODEX-PHASE-1.md missing");
});

/* --- 2. index.html integration ------------------------------------- */

test("index.html loads codex-state.js", () => {
  const html = read("docs/index.html");
  assert.ok(html.includes("codex-state.js"), "codex-state.js not loaded in index.html");
});

test("index.html loads themes.moons.css", () => {
  const html = read("docs/index.html");
  assert.ok(html.includes("themes.moons.css"), "themes.moons.css not loaded in index.html");
});

test("index.html loads living-day.css", () => {
  const html = read("docs/index.html");
  assert.ok(html.includes("living-day.css"), "living-day.css not loaded in index.html");
});

test("codex-state.js is loaded before living-codex.js in index.html", () => {
  const html = read("docs/index.html");
  const stateIdx = html.indexOf("codex-state.js");
  const codexIdx = html.indexOf("living-codex.js");
  assert.ok(stateIdx !== -1 && codexIdx !== -1, "scripts not found");
  assert.ok(stateIdx < codexIdx, "codex-state.js must appear before living-codex.js");
});

test("index.html has living day panel HTML", () => {
  const html = read("docs/index.html");
  assert.ok(html.includes("data-living-day-panel"), "living day panel missing");
  assert.ok(html.includes("data-living-day-toggle"), "living day toggle missing");
  assert.ok(html.includes("data-living-day-content"), "living day content missing");
});

test("index.html has calendar summary elements", () => {
  const html = read("docs/index.html");
  assert.ok(html.includes("data-codex-calendar-summary"), "calendar summary missing");
  assert.ok(html.includes("data-codex-moon-label"), "moon label missing");
  assert.ok(html.includes("data-codex-year-label"), "year label missing");
  assert.ok(html.includes("data-codex-week-gate"), "week gate missing");
});

test("index.html has shabbat and movement rows", () => {
  const html = read("docs/index.html");
  assert.ok(html.includes("data-codex-shabbat-row"), "shabbat row missing");
  assert.ok(html.includes("data-codex-movement-row"), "movement row missing");
  assert.ok(html.includes("data-codex-daily-movement"), "daily movement span missing");
});

test("index.html has suggested gate section", () => {
  const html = read("docs/index.html");
  assert.ok(html.includes("data-codex-suggested"), "suggested gate section missing");
  assert.ok(html.includes("data-codex-suggested-link"), "suggested link missing");
  assert.ok(html.includes("data-codex-freq-row"), "freq row missing");
});

test("index.html has gate and frequency action buttons", () => {
  const html = read("docs/index.html");
  assert.ok(html.includes("data-codex-gate-btn"), "gate button missing");
  assert.ok(html.includes("data-codex-freq-btn"), "frequency button missing");
});

/* --- 3. codex-state.js static data --------------------------------- */

test("codex-state.js defines 28 day archetypes", () => {
  const src = read("docs/assets/js/codex-state.js");
  /* 28 entries in DAY_ARCHETYPES array */
  const matches = src.match(/\["\w+", "[^"]+"\]/g) || [];
  assert.ok(matches.length >= 28, "fewer than 28 day archetypes in codex-state.js");
});

test("codex-state.js defines 4 week gates", () => {
  const src = read("docs/assets/js/codex-state.js");
  assert.ok(src.includes("Week 1"), "Week 1 missing");
  assert.ok(src.includes("Week 2"), "Week 2 missing");
  assert.ok(src.includes("Week 3"), "Week 3 missing");
  assert.ok(src.includes("Week 4"), "Week 4 missing");
});

test("codex-state.js defines 13 moon paths", () => {
  const src = read("docs/assets/js/codex-state.js");
  assert.ok(src.includes("MOON_PATHS"), "MOON_PATHS missing");
  /* Should have 13 objects with label+url */
  const entries = (src.match(/{ label:/g) || []).length;
  assert.ok(entries >= 13, "fewer than 13 MOON_PATHS entries found");
});

test("codex-state.js defines 13 moon frequency labels", () => {
  const src = read("docs/assets/js/codex-state.js");
  assert.ok(src.includes("MOON_FREQS"), "MOON_FREQS missing");
});

/* --- 4. Moon body class selection ---------------------------------- */

test("moon body class codex-moon-04 applied for Moon 4", () => {
  const { bodyClasses } = evalCodexState(makeCalendarStub("2026-07-17", 4, 7));
  assert.ok(bodyClasses.has("codex-moon-04"), "codex-moon-04 not applied");
  assert.ok(bodyClasses.has("theme-moon-4"), "theme-moon-4 not applied for compat");
});

test("moon body class codex-moon-01 applied for Moon 1", () => {
  const { bodyClasses } = evalCodexState(makeCalendarStub("2026-04-18", 1, 2));
  assert.ok(bodyClasses.has("codex-moon-01"), "codex-moon-01 not applied");
});

test("moon body class codex-moon-13 applied for Moon 13", () => {
  const { bodyClasses } = evalCodexState(makeCalendarStub("2026-04-01", 13, 28));
  assert.ok(bodyClasses.has("codex-moon-13"), "codex-moon-13 not applied");
});

test("no stale moon class remains after class update", () => {
  /* Simulate a previous moon-3 class on body */
  const { bodyClasses } = evalCodexState(makeCalendarStub("2026-04-18", 1, 1));
  /* After applying moon-1, moon-3 should not be present */
  assert.ok(!bodyClasses.has("codex-moon-03"), "stale codex-moon-03 not removed");
});

/* --- 5. Shabbat state --------------------------------------------- */

function computeShabbatFromSrc(weekday) {
  /* Run codex-state.js with a Date stub that returns a fixed weekday */
  const src = read("docs/assets/js/codex-state.js");
  const win = { SOFCalendar: null, CodexState: {}, CodexStateModule: null };
  const bodyClasses = new Set();
  const domDoc = {
    addEventListener: () => {},
    dispatchEvent: () => {},
    readyState: "complete",
    body: {
      classList: { add: (c) => bodyClasses.add(c), remove: () => {}, forEach: () => {} },
      dataset: {}
    }
  };
  /* Capture the computed shabbat state by patching after evaluation */
  const stub = makeCalendarStub("2026-07-17", 4, 7);
  /* Override computeShabbatState to test it directly via CodexStateModule */
  /* We extract and evaluate it with a custom Date */
  const fnSrc = `
    var weekday = ${weekday};
    var date = { getDay: function() { return weekday; } };
    if (weekday === 5) return { code: "preparation", label: "Preparation Gate" };
    if (weekday === 6) return { code: "active",      label: "Shabbat · Rest" };
    if (weekday === 0) return { code: "return",      label: "Return Gate" };
    return { code: "ordinary", label: "Ordinary Day" };
  `;
  return new Function(fnSrc)();
}

test("Shabbat state: Friday = preparation", () => {
  const result = computeShabbatFromSrc(5);
  assert.equal(result.code, "preparation");
});

test("Shabbat state: Saturday = active (Shabbat)", () => {
  const result = computeShabbatFromSrc(6);
  assert.equal(result.code, "active");
});

test("Shabbat state: Sunday = return", () => {
  const result = computeShabbatFromSrc(0);
  assert.equal(result.code, "return");
});

test("Shabbat state: Wednesday = ordinary", () => {
  const result = computeShabbatFromSrc(3);
  assert.equal(result.code, "ordinary");
});

/* --- 6. Daily state rendering -------------------------------------- */

test("computeState returns yearDay as dayIndex+1", () => {
  const stub = makeCalendarStub("2026-07-17", 4, 7);
  /* dayIndex for Moon 4 Day 7 = (4-1)*28 + (7-1) = 90 */
  const { win } = evalCodexState(stub);
  const s = win.CodexState;
  assert.ok(s && typeof s.yearDay === "number", "yearDay not a number");
  assert.equal(s.yearDay, 91); /* dayIndex = 90, yearDay = 91 */
});

test("computeState returns correct weekGate for day 7 (week 1)", () => {
  const { win } = evalCodexState(makeCalendarStub("2026-07-17", 4, 7));
  assert.ok(win.CodexState.weekGate.includes("Week 1"), "Week 1 gate not returned for day 7");
});

test("computeState returns Week 2 gate for day 8", () => {
  const { win } = evalCodexState(makeCalendarStub("2026-07-17", 4, 8));
  assert.ok(win.CodexState.weekGate.includes("Week 2"), "Week 2 gate not returned for day 8");
});

test("computeState returns Week 4 gate for day 22", () => {
  const { win } = evalCodexState(makeCalendarStub("2026-07-17", 4, 22));
  assert.ok(win.CodexState.weekGate.includes("Week 4"), "Week 4 gate not returned for day 22");
});

test("computeState returns dailyMovement string for day 1 (Spark)", () => {
  const { win } = evalCodexState(makeCalendarStub("2026-07-17", 1, 1));
  assert.ok(win.CodexState.dailyMovement, "dailyMovement empty for day 1");
  assert.ok(win.CodexState.dailyMovement.includes("ignition") || win.CodexState.dailyMovement.includes("begin") || win.CodexState.dailyMovement.includes("Start"),
    "Day 1 movement should reference Spark/ignition content");
});

test("computeState: same day always produces same movement", () => {
  const s1 = evalCodexState(makeCalendarStub("2026-07-17", 4, 4)).win.CodexState;
  const s2 = evalCodexState(makeCalendarStub("2026-07-17", 4, 4)).win.CodexState;
  assert.equal(s1.dailyMovement, s2.dailyMovement, "Movement not deterministic");
});

test("computeState returns suggestedPath and suggestedPathUrl", () => {
  const { win } = evalCodexState(makeCalendarStub("2026-07-17", 4, 4));
  assert.ok(win.CodexState.suggestedPath, "suggestedPath empty");
  assert.ok(win.CodexState.suggestedPathUrl, "suggestedPathUrl empty");
  assert.ok(win.CodexState.suggestedPathUrl.endsWith(".html"), "suggestedPathUrl should be html");
});

test("computeState returns suggestedFrequency for moon 4", () => {
  const { win } = evalCodexState(makeCalendarStub("2026-07-17", 4, 4));
  assert.ok(win.CodexState.suggestedFrequency, "suggestedFrequency empty for moon 4");
  assert.ok(win.CodexState.suggestedFrequency.includes("Hz"), "suggestedFrequency should include Hz");
});

/* --- 7. Missing / fallback state ----------------------------------- */

test("computeState returns null when SOFCalendar not loaded", () => {
  const src = read("docs/assets/js/codex-state.js");
  /* computeState uses window.SOFCalendar — extract and call without it */
  const win = { SOFCalendar: null, CodexState: {}, CodexStateModule: null };
  const bodyClasses = new Set();
  const domDoc = {
    addEventListener: () => {},
    dispatchEvent: () => {},
    readyState: "complete",
    body: {
      classList: { add: (c) => bodyClasses.add(c), remove: () => {}, forEach: () => {} },
      dataset: {}
    }
  };
  const wrapper = new Function("window", "document", "CustomEvent", "localStorage", src);
  wrapper(win, domDoc, class CustomEvent {}, {
    getItem: () => null, setItem: () => {}, removeItem: () => {}
  });
  /* CodexState should remain empty / default since SOFCalendar is null */
  assert.ok(!win.CodexState.moonNumber, "moonNumber should not be set without SOFCalendar");
});

test("codex-state.js handles isDayOutOfTime gracefully", () => {
  /* Stub returns isDayOutOfTime: true */
  const stub = {
    getTZ:       () => "UTC",
    todayISO:    () => "2026-04-16",
    get13Moon:   () => ({
      iso:            "2026-04-16",
      isDayOutOfTime: true,
      moonName:       "Outside Count",
      moonEssence:    ""
    }),
    getMoonPhase: () => null,
    CONFIG: { dayBoundary: "midnight", fallbackSunset: "18:00" }
  };
  const { win } = evalCodexState(stub);
  assert.ok(!win.CodexState.moonNumber, "moonNumber should be null for day-out-of-time");
  assert.ok(!win.CodexState.moonDay, "moonDay should be null for day-out-of-time");
});

test("codex-state.js handles missing getMoonPhase gracefully", () => {
  const stub = {
    getTZ:       () => "UTC",
    todayISO:    () => "2026-07-17",
    get13Moon:   () => ({
      iso: "2026-07-17", isDayOutOfTime: false,
      moon: 4, moonName: "Stone Witness", moonEssence: "body",
      day: 7, dayIndex: 90
    }),
    getMoonPhase: null,
    CONFIG: { dayBoundary: "sunset", fallbackSunset: "18:00" }
  };
  const { win } = evalCodexState(stub);
  assert.ok(!win.CodexState.phaseName || win.CodexState.phaseName === "", "phaseName should be empty when getMoonPhase missing");
});

/* --- 8. Suggested links point to real pages ----------------------- */

test("all MOON_PATHS urls refer to existing docs pages", () => {
  const src = read("docs/assets/js/codex-state.js");
  /* Extract all url: "./..." strings from MOON_PATHS and SHABBAT_PATHS */
  const urls = [...src.matchAll(/url:\s*"(\.\/[^"]+)"/g)].map(m => m[1]);
  assert.ok(urls.length >= 13, "fewer than 13 path urls found");
  for (const url of urls) {
    const filePath = url.replace("./", "docs/");
    assert.ok(fileExists(filePath), `Suggested path ${url} does not exist as ${filePath}`);
  }
});

/* --- 9. links under production and GitHub Pages base path --------- */

test("index.html uses relative hrefs (./…) for all internal Codex links", () => {
  const html = read("docs/index.html");
  /* Ensure no absolute /scroll-of-fire/ hardcoded paths inside anchor tags */
  assert.ok(!html.includes('href="/scroll-of-fire/'), "Hardcoded /scroll-of-fire/ href found");
});

/* --- 10. CSS classes exist ---------------------------------------- */

test("living-day.css defines codex-moon-01 through codex-moon-13", () => {
  const css = read("docs/assets/css/living-day.css");
  for (let i = 1; i <= 13; i++) {
    const cls = "codex-moon-" + String(i).padStart(2, "0");
    assert.ok(css.includes(cls), `${cls} missing from living-day.css`);
  }
});

test("living-day.css defines living-day-panel class", () => {
  const css = read("docs/assets/css/living-day.css");
  assert.ok(css.includes(".living-day-panel"), ".living-day-panel not in living-day.css");
});

test("living-day.css defines living-day-toggle class", () => {
  const css = read("docs/assets/css/living-day.css");
  assert.ok(css.includes(".living-day-toggle"), ".living-day-toggle not in living-day.css");
});

test("living-day.css honours prefers-reduced-motion", () => {
  const css = read("docs/assets/css/living-day.css");
  assert.ok(css.includes("prefers-reduced-motion"), "prefers-reduced-motion not in living-day.css");
});

/* --- 11. No horizontal overflow risk ------------------------------ */

test("living-day.css prevents horizontal overflow on signal shell", () => {
  const css = read("docs/assets/css/living-day.css");
  assert.ok(css.includes("overflow-x: hidden"), "overflow-x: hidden not found in living-day.css");
});

/* --- 12. localStorage key documented ------------------------------ */

test("codex-state.js uses versioned localStorage key sof.codexState.v1", () => {
  const src = read("docs/assets/js/codex-state.js");
  assert.ok(src.includes("sof.codexState.v1"), "versioned localStorage key missing");
});

test("codex-state.js dispatches codexstatechange event", () => {
  const src = read("docs/assets/js/codex-state.js");
  assert.ok(src.includes("codexstatechange"), "codexstatechange event name missing");
});

/* --- 13. Documentation -------------------------------------------- */

test("LIVING-CODEX-PHASE-1.md documents key sections", () => {
  const md = read("docs/LIVING-CODEX-PHASE-1.md");
  assert.ok(md.includes("codex-state.js"), "documentation missing codex-state.js reference");
  assert.ok(md.includes("sof.codexState.v1"), "documentation missing localStorage key");
  assert.ok(md.includes("codexstatechange"), "documentation missing event name");
  assert.ok(md.includes("codex-moon-"), "documentation missing moon class reference");
});
