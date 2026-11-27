"use strict";

/*
 * Schedule markers on the Calendar Atlas grid + the freeing of
 * the Atlas popup (Aaron, Thu Nov 26, 2026, 22:57 PST: "There
 * is a grid down below the day numbers. That can hold a good
 * amount of small emoji like holographic markers resembling
 * whatever it is you are scheduling. There can be multiple
 * emoji for a day if multiple things are scheduled. Would have
 * to be small and detailed in a way someone can see them." —
 * and, of the popup that holds that grid: "when the living day
 * whatever pops up it's off the screen").
 *
 * The popup finding, measured at 390×844 before the fix: the
 * Calendar Atlas dialog (#calendar-atlas-modal >
 * .calendar-atlas-dialog) opened with its top at 815px and its
 * bottom at 1557px on an 844px screen. Root cause: in the
 * rebuilt DOM the modal lives inside
 * aside.sphere-sidebar.sphere-sheet, which carries a transform
 * (the day sheet parked ~730px down) — a transformed ancestor
 * is the containing block for fixed descendants, so the
 * modal's position:fixed inset:0 anchored to the sheet, not
 * the viewport. The fix lives in the new companion module
 * (docs/assets/js/sphere-schedule-markers.js): it relocates
 * the modal to <body>, where its own stylesheet always assumed
 * it lived, and decorates the workbench's day cells read-only.
 *
 * These tests pin the pure marker core (choice order, day
 * grouping, the row cap) against the shipped module, the
 * read-only law (no storage write, no planner mutation road
 * anywhere in the file), the companion-layer loader, and the
 * modal-freeing relocation. The measured fit proof is the
 * browser walk in the build record.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = path.join(ROOT, "docs", "assets", "js", "sphere-schedule-markers.js");
const core = require(MODULE_PATH);
const source = fs.readFileSync(MODULE_PATH, "utf8");

function record({ title = "", category = "event", symbol = null, year = 2026, day = 230 } = {}) {
  return {
    title,
    subtype: category,
    temporal: { patternYear: year, patternDay: day },
    payload: { planner: { category, symbol } }
  };
}

test("the keeper's own emoji symbol wins over title and kind", () => {
  const r = record({ title: "Moon watch", category: "observation", symbol: "🐝" });
  assert.equal(core.markerForRecord(r), "🐝");
});

test("a geometric stored symbol falls through to the kind", () => {
  const r = record({ title: "Field day", category: "farming", symbol: "◆" });
  assert.equal(core.markerForRecord(r), "🚜");
});

test("a plain word in the title names the marker", () => {
  assert.equal(core.markerForRecord(record({ title: "Moon watch with Tanya" })), "🌙");
  assert.equal(core.markerForRecord(record({ title: "Fix the gate hinge", category: "task" })), "🔧");
  assert.equal(core.markerForRecord(record({ title: "Plant garlic beds", category: "task" })), "🌱");
  assert.equal(core.markerForRecord(record({ title: "Birthday cake for Aiyana", category: "family" })), "🎂");
  assert.equal(core.markerForRecord(record({ title: "Check the hives", category: "task" })), "🐝");
  /* Reading is the act: the seed catalog is read, not planted. */
  assert.equal(core.markerForRecord(record({ title: "Read the seed catalog", category: "research" })), "📖");
});

test("a title word beats the kind when both speak", () => {
  const r = record({ title: "Fix the fence", category: "farming" });
  assert.equal(core.markerForRecord(r), "🔧");
});

test("the kind speaks when the title is quiet", () => {
  assert.equal(core.markerForRecord(record({ title: "Greenhouse rows", category: "watering" })), "💧");
  assert.equal(core.markerForRecord(record({ title: "Circle time", category: "meeting" })), "👥");
  assert.equal(core.markerForRecord(record({ title: "Quiet sitting", category: "practice" })), "🧘");
});

test("an unknown kind with a quiet title gets the one default", () => {
  const r = record({ title: "Something held", category: "not-a-kind" });
  assert.equal(core.markerForRecord(r), core.DEFAULT_MARKER);
  assert.equal(core.DEFAULT_MARKER, "✨");
});

test("a day's markers: one per thing, capped, the rest counted", () => {
  const many = Array.from({ length: 13 }, (_, i) => record({ title: "Thing " + (i + 1), day: 230 }));
  const built = core.markersForDay(many);
  assert.equal(built.markers.length, core.MAX_MARKERS);
  assert.equal(built.overflow, 3);

  const few = core.markersForDay([record({ title: "Moon watch" }), record({ title: "Water the rows", category: "watering" })]);
  assert.deepEqual(few.markers.map(m => m.emoji), ["🌙", "💧"]);
  assert.equal(few.overflow, 0);
  assert.deepEqual(core.markersForDay([]), { markers: [], overflow: 0 });
  assert.deepEqual(core.markersForDay(null), { markers: [], overflow: 0 });
});

test("grouping keeps only the asked year and real days", () => {
  const records = [
    record({ day: 230 }),
    record({ day: 230, title: "Second" }),
    record({ day: 232 }),
    record({ day: 230, year: 2027 }),
    record({ day: 0 }),
    record({ day: 365 }),
    { title: "No coordinate", payload: { planner: { category: "event", symbol: null } } }
  ];
  const byDay = core.groupPlansByDay(records, 2026);
  assert.equal(byDay.get(230).length, 2);
  assert.equal(byDay.get(232).length, 1);
  assert.equal(byDay.size, 2);
});

test("the layer is read-only: it reads plans and writes nothing", () => {
  assert.match(source, /plansForYear/);
  for (const forbidden of [
    "localStorage.setItem", "sessionStorage.setItem",
    "createPlan", "updatePlan", "deletePlan", "completePlan",
    ".put(", "indexedDB"
  ]) {
    assert.ok(!source.includes(forbidden), `module must not contain ${forbidden}`);
  }
});

test("the modal freeing is in the shipped module", () => {
  assert.match(source, /calendar-atlas-modal/);
  assert.match(source, /document\.body\.appendChild\(modal\)/);
});

test("the companion layer loads the markers layer, once, versioned", () => {
  const layer = fs.readFileSync(path.join(ROOT, "docs", "assets", "js", "sphere-companion-layer.js"), "utf8");
  assert.match(layer, /sphere-schedule-markers\.js\?v=20261127-1/);
  assert.match(layer, /sphere-schedule-markers\.css\?v=20261127-1/);
  assert.match(layer, /data-sphere-schedule-markers/);
});

test("the workbench stylesheet carries the safe-area fit for the popup", () => {
  const css = fs.readFileSync(path.join(ROOT, "docs", "assets", "css", "living-time-calendar-workbench.css"), "utf8");
  assert.match(css, /max\(0\.8rem, env\(safe-area-inset-top\)\)/);
  assert.match(css, /\.calendar-atlas-dialog \{[^}]*padding-bottom: env\(safe-area-inset-bottom\)/s);
});
