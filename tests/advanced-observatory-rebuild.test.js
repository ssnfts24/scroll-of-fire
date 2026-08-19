"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

function workspaceContext() {
  const context = { console, Date, Intl, Math, setTimeout, clearTimeout };
  context.globalThis = context;
  vm.runInNewContext(read("docs/assets/js/sphere/living-time-observatory-workspace.js"), context);
  return context;
}

test("homepage is sphere-first while retaining the canonical deep link", () => {
  const html = read("docs/index.html");
  const section = html.slice(html.indexOf('id="home-sphere-observatory"'), html.indexOf("codex-live-grid"));
  assert.ok(section.includes('id="home-sphere-today-preview"'));
  assert.ok(section.includes('id="home-sphere-today-open-link"'));
  assert.match(
    section,
    /id="home-sphere-today-open-link"[^>]*href="\.\/living-time-sphere\.html\?view=today&amp;marker=today&amp;source=home"/
  );
  assert.equal(section.includes("data-location-use-device"), false, "homepage Sphere should not expose the location command deck");
  assert.equal(section.includes('class="home-living-sphere__mode-controls"'), false, "homepage Sphere should not expose mode controls");
});

test("homepage lazy loader includes the complete 3D stack in authority order", () => {
  const code = read("docs/assets/js/home-observatory-instrument.js");
  const capability = code.indexOf("observatory-capability-manager.js");
  const materials = code.indexOf("living-time-sphere-materials.js");
  const renderer = code.indexOf("living-time-sphere-renderer-3d.js");
  const mount = code.indexOf("living-time-sphere-mount.js");
  assert.ok(capability >= 0 && capability < materials && materials < renderer && renderer < mount);
  assert.ok(code.includes("for (const path of REQUIRED_DEPENDENCIES) await loadScript(path)"));
  assert.ok(code.includes('renderer: "auto"'));
  assert.equal(code.includes("activeMount.teardown()"), false, "intersection exit must not destroy the reusable mount");
});

test("shared mount reports baseline, upgrade, fallback, and active renderer state", () => {
  const code = read("docs/assets/js/sphere/living-time-sphere-mount.js");
  assert.ok(code.includes("function emitRenderer("));
  assert.ok(code.includes('phase: "upgrading"'));
  assert.ok(code.includes('activeRenderer: "3d"'));
  assert.ok(code.includes('reason: "WEBGL_CONTEXT_LOST"'));
  assert.ok(code.includes("getRendererState()"));
});

test("Observatory workspace exposes local-first records, quests, recurrence, import, and map wiring", () => {
  const html = read("docs/living-time-sphere.html");
  const code = read("docs/assets/js/sphere/living-time-observatory-workspace.js");
  const css = read("docs/assets/css/observatory-workspace.css");
  assert.ok(html.includes("living-time-observatory-workspace.js"));
  assert.ok(html.includes("observatory-workspace.css"));
  [
    "sof.observatory.records.v2",
    "sof.question-quests.v1",
    "function importRecords(",
    "function renderCenturyMap(",
    "function renderRecurrence(",
    "function preserveQuestionAnswer(",
    "function wireWitnessForm(",
  ].forEach(marker => assert.ok(code.includes(marker), `missing workspace marker: ${marker}`));
  const layout = workspaceContext().LivingTimeObservatoryWorkspace._internals.resolveCenturyMapLayout(338, 500);
  assert.deepEqual(JSON.parse(JSON.stringify(layout)), {
    width: 338,
    height: 300,
    pad: { left: 42, right: 12, top: 22, bottom: 34 },
    tickStep: 100,
    compact: true,
  });
  assert.ok(css.includes(".obs-century-empty"));
  assert.equal(css.includes("min-width: 720px"), false);
});

test("recurrence scoring is bounded and rewards explainable shared context", () => {
  const api = workspaceContext().LivingTimeObservatoryWorkspace;
  const base = {
    tags: ["weather", "family"],
    placeId: "NODE-1",
    context: { moon: 4, dayOfPatternYear: 98, season: "Summer" },
  };
  const close = api.computeSimilarity(base, {
    tags: ["weather", "family", "work"],
    placeId: "NODE-1",
    context: { moon: 4, dayOfPatternYear: 100, season: "Summer" },
  });
  const far = api.computeSimilarity(base, {
    tags: ["unrelated"],
    placeId: "NODE-2",
    context: { moon: 11, dayOfPatternYear: 300, season: "Winter" },
  });
  assert.ok(close.score >= 0 && close.score <= 1);
  assert.ok(far.score >= 0 && far.score <= 1);
  assert.ok(close.score > far.score);
  assert.ok(close.reasons.some(reason => reason.includes("same Moon")));
  assert.ok(close.reasons.some(reason => reason.includes("shared tags")));
});

test("quest cadence supports daily, interval, and Moon Day schedules", () => {
  const api = workspaceContext().LivingTimeObservatoryWorkspace;
  const now = new Date("2026-08-15T12:00:00Z");
  assert.equal(api.isQuestDue({ schedule: "daily", paused: false, lastAnsweredAt: "2026-08-14T12:00:00Z" }, null, now), true);
  assert.equal(api.isQuestDue({ schedule: "interval", intervalDays: 7, paused: false, lastAnsweredAt: "2026-08-10T12:00:00Z" }, null, now), false);
  assert.equal(api.isQuestDue({ schedule: "moonDay", moonDay: 7, paused: false, lastAnsweredAt: null }, { pattern: { day: 7 } }, now), true);
  assert.equal(api.isQuestDue({ schedule: "moonDay", moonDay: 7, paused: false, lastAnsweredAt: null }, { pattern: { day: 8 } }, now), false);
});

test("deploy cache policy revalidates source assets and network-checks scripts/styles", () => {
  const netlify = read("netlify.toml");
  const worker = read("docs/service-worker.js");
  assert.ok(netlify.includes('Cache-Control = "public, max-age=0, must-revalidate"'));
  assert.ok(netlify.includes('Cache-Control = "no-cache, no-store, must-revalidate"'));
  assert.ok(worker.includes("async function networkFirstAsset(request)"));
  assert.ok(worker.includes("event.respondWith(networkFirstAsset(event.request))"));
});

test("site audit enforces every deployed HTML page and local reference", () => {
  const audit = read("scripts/audit-site.mjs");
  assert.ok(audit.includes("expected exactly one h1"));
  assert.ok(audit.includes("duplicate id"));
  assert.ok(audit.includes("canonical must use the production origin"));
  assert.ok(audit.includes("CSS url target is missing"));
});
