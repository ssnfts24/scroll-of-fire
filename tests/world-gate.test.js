"use strict";

/**
 * The World Gate — Codex World Phase 1 (Aaron approved the
 * world design Nov 20, 2026).
 *
 * The laws under test:
 *   - The map can never drift from the site: the lands are
 *     generated from the site catalog, and every catalog entry
 *     is accounted for exactly once — shelved in one of the
 *     thirteen lands, or named as the road, the sky, or flat
 *     by design.
 *   - The flat twin is an equal: the Porch list, the flat list,
 *     and the relief's spoken lines are one projection of one
 *     model — same lands, same words, same order, same next
 *     steps.
 *   - The engine's sky is Their Home's sky: the extraction is
 *     pinned to the proof, hour by hour and day by day, so the
 *     shared engine can never quietly drift from it.
 *   - The flat decision is honest: plain switch, no WebGL,
 *     reduced motion, and save-data each serve the twin, each
 *     with its reason named.
 *   - Their Home stands exactly as it stood: this work does
 *     not touch its module, and its module does not lean on
 *     the new engine.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "docs");
const JS = path.join(DOCS, "assets/js");

const LandsData = require(path.join(JS, "world-lands.js"));
const Engine = require(path.join(JS, "world-engine.js"));
const Gate = require(path.join(JS, "world-gate.js"));
const HomeWorld = require(path.join(JS, "spark-home-world.js"));

const read = rel => fs.readFileSync(path.join(ROOT, rel), "utf8");
const catalog = JSON.parse(read("docs/data/site-catalog.json"));
const landsSource = JSON.parse(read("scripts/world-lands.json"));

const TODAY = { moon: 8, day: 22, dayOfPatternYear: 218, patternYear: 2, moonName: "Deep Mirror", isDayOutOfTime: false, isDeepTimeDay: false };

function model(overrides = {}) {
  return Gate.buildModel({ today: TODAY, hour: 15, ...overrides });
}

/* --------------------- the map cannot drift --------------------- */

test("the lands are generated from the catalog, and the generated data is current", () => {
  execFileSync(process.execPath, [path.join(ROOT, "scripts/build-world-lands.mjs"), "--check"], { stdio: "pipe" });
  assert.equal(LandsData.lands.length, 13, "the world has thirteen lands");
  assert.equal(LandsData.generatedFrom, "scripts/world-lands.json + docs/data/site-catalog.json");
});

test("every catalog entry is accounted for exactly once: a land, the road, the sky, or flat by design", () => {
  const seen = new Map();
  const claim = (id, where) => {
    assert.ok(!seen.has(id), `catalog entry ${id} accounted for twice: ${seen.get(id)} and ${where}`);
    seen.set(id, where);
  };
  for (const land of landsSource.lands) for (const id of land.entries) claim(id, `land ${land.id}`);
  for (const r of landsSource.road) claim(r.entry, "the road");
  for (const r of landsSource.sky) claim(r.entry, "the sky");
  for (const r of landsSource.flat) claim(r.entry, "flat by design");
  for (const entry of catalog.entries) {
    assert.ok(seen.has(entry.id), `catalog entry ${entry.id} (${entry.path}) is not accounted for in scripts/world-lands.json`);
  }
  assert.equal(seen.size, catalog.entries.length);
});

test("the generated lands carry the catalog's own titles and paths — no hand-copied registry", () => {
  const byId = new Map(catalog.entries.map(e => [e.id, e]));
  const check = page => {
    const entry = byId.get(page.id);
    assert.ok(entry, `generated page ${page.id} exists in the catalog`);
    assert.equal(page.title, entry.title, `${page.id}: title comes from the catalog`);
    assert.equal(page.path, entry.path, `${page.id}: path comes from the catalog`);
  };
  for (const land of LandsData.lands) land.pages.forEach(check);
  LandsData.road.forEach(check);
  LandsData.sky.forEach(check);
  LandsData.flat.forEach(check);
});

test("the sky is not a land, the road is not a land, and the flat rooms carry their reasons", () => {
  assert.deepEqual(LandsData.sky.map(s => s.id), ["living-time-sphere"], "the Sphere is the sky — never shelved in a land");
  assert.deepEqual(LandsData.road.map(s => s.id), ["covenant-caravan"], "the Caravan is the road itself");
  const flatIds = LandsData.flat.map(f => f.id).sort();
  assert.deepEqual(flatIds, ["about-aaron", "circle", "codex-guide", "ethics", "guide", "methods", "provenance", "repo-readme", "sending-test"]);
  for (const f of LandsData.flat) assert.ok(f.reason && f.reason.length > 10, `${f.id}: flat by design, with its reason stated`);
  const landPages = LandsData.lands.flatMap(l => l.pages.map(p => p.id));
  for (const id of [...flatIds, "living-time-sphere", "covenant-caravan"]) {
    assert.ok(!landPages.includes(id), `${id} is not shelved in any land`);
  }
});

test("every land's door and next step are real pages, and the next steps never dead-end", () => {
  const doors = new Set(LandsData.lands.map(l => l.door));
  for (const land of LandsData.lands) {
    assert.ok(fs.existsSync(path.join(DOCS, land.door)), `${land.id}: door ${land.door} exists`);
    assert.ok(fs.existsSync(path.join(DOCS, land.nextStep.href)), `${land.id}: next step ${land.nextStep.href} exists`);
    assert.ok(land.character.length > 20, `${land.id}: a land has a character, in words`);
    assert.ok(land.pages.length >= 1, `${land.id}: a land holds at least one catalog page`);
  }
  /* Walk the next steps from the Gate: the road visits every
   * land and returns — no dead ends, by construction. */
  const byDoor = new Map(LandsData.lands.map(l => [l.door, l]));
  const visited = [];
  let current = LandsData.lands.find(l => l.id === "gate");
  for (let i = 0; i < LandsData.lands.length; i++) {
    visited.push(current.id);
    const next = byDoor.get(current.nextStep.href);
    assert.ok(next, `${current.id}'s next step (${current.nextStep.href}) leads to a land's door`);
    current = next;
  }
  assert.equal(current.id, "gate", "the road returns to the Gate");
  assert.deepEqual([...visited].sort(), LandsData.lands.map(l => l.id).sort(), "the walking order visits all thirteen lands");
  assert.ok(doors.size === 13, "every land has its own door");
});

/* ------------------------- the flat twin ------------------------- */

test("the flat twin is the same Gate: Porch, flat list, and relief speak one projection", () => {
  const m = model();
  const porch = Gate.porchEntries(m);
  const flat = Gate.flatEntries(m);
  const scene = Gate.sceneEntries(m);
  assert.deepEqual(flat, porch, "the flat list is the Porch list, word for word");
  assert.deepEqual(scene, porch, "the relief's lands are the Porch's lands");
  assert.equal(porch.length, 13);
  for (const entry of porch) {
    assert.ok(entry.say.startsWith(entry.name + "."), `${entry.id}: the spoken line opens with the land's name`);
    assert.ok(entry.say.includes(entry.character), `${entry.id}: the spoken line carries the same character the lists print`);
    assert.ok(entry.nextLabel && entry.nextHref, `${entry.id}: every land names its next step in every face`);
  }
});

test("the flat decision names its reason: plain, no WebGL, reduced motion, save-data", () => {
  assert.deepEqual(Engine.flatDecision({ plain: true, webgl: true }), { flat: true, reason: "plain" });
  assert.deepEqual(Engine.flatDecision({ plain: false, webgl: false }), { flat: true, reason: "no-webgl" });
  assert.deepEqual(Engine.flatDecision({ webgl: true, reducedMotion: true }), { flat: true, reason: "reduced-motion" });
  assert.deepEqual(Engine.flatDecision({ webgl: true, saveData: true }), { flat: true, reason: "save-data" });
  assert.deepEqual(Engine.flatDecision({ webgl: true }), { flat: false, reason: null });
  assert.equal(Engine.PLAIN_KEY, "sof.world.plain.v1", "the plain-site switch keeps its own key, on the keeper's device");
});

test("the Gate module writes nothing but the keeper's own switches", () => {
  const gate = read("docs/assets/js/world-gate.js");
  const writes = gate.match(/localStorage\.setItem\([^)]*\)/g) || [];
  assert.ok(writes.length >= 1, "the guidance dismissal is the one write");
  for (const w of writes) assert.ok(w.includes("GUIDE_KEY"), `the Gate writes only its guidance key: ${w}`);
  const engine = read("docs/assets/js/world-engine.js");
  const engineWrites = engine.match(/localStorage\.setItem\([^)]*\)/g) || [];
  for (const w of engineWrites) assert.ok(w.includes("PLAIN_KEY"), `the engine writes only the plain preference: ${w}`);
  assert.ok(!/XMLHttpRequest|sendBeacon/.test(gate), "nothing leaves the device through the Gate");
});

/* --------------------- the engine's sky is true --------------------- */

test("the engine's sky is Their Home's sky — the extraction is pinned to the proof", () => {
  for (let h = 0; h < 24; h += 0.5) {
    assert.equal(Engine.phaseForHour(h), HomeWorld.phaseForHour(h), `phase at hour ${h}`);
  }
  for (const pd of [null, 0, 1, 45, 91, 92, 150, 182, 183, 218, 273, 274, 330, 364, 365]) {
    assert.equal(Engine.seasonForPatternDay(pd), HomeWorld.seasonForPatternDay(pd), `season at Pattern Day ${pd}`);
  }
  const samples = [
    TODAY,
    { moon: null, day: null, dayOfPatternYear: null, isDayOutOfTime: true, isDeepTimeDay: false },
    { moon: null, day: null, dayOfPatternYear: null, isDayOutOfTime: false, isDeepTimeDay: true },
    null
  ];
  for (const t of samples) assert.equal(Engine.todayLineFor(t), HomeWorld.todayLineFor(t));
  const sky = Engine.skyFor({ today: TODAY, hour: 15 });
  assert.equal(sky.line, "Daytime · Autumn of the Pattern year — Moon 8 · Day 22 · Pattern Day 218");
});

test("the engine carries the performance ladder the design's law requires", () => {
  const engine = read("docs/assets/js/world-engine.js");
  assert.ok(engine.includes("IntersectionObserver"), "scenes boot on approach, and pause off-screen");
  assert.ok(engine.includes('rootMargin = "240px"') || engine.includes('"240px"'), "boot on scroll-near, the Their Home margin");
  assert.ok(engine.includes("1.75") && engine.includes("1.25"), "pixel-ratio ladder: 1.75, stepping to 1.25, then 1.0");
  assert.ok(engine.includes("document.hidden"), "the loop pauses when the tab hides");
  assert.ok(engine.includes("prefers-reduced-motion"), "reduced motion is a first-class signal");
  assert.ok(engine.includes("assets/vendor/three/three.module.min.js"), "one vendored engine, shared — built once");
});

/* --------------------------- today's land --------------------------- */

test("today's land follows the world's own count: Moon N opens land N; the still days open the Gate", () => {
  const m = model();
  assert.equal(m.todaysLand.id, "proving-grounds", "Moon 8 — the eighth land in the design's table order");
  const doot = Gate.buildModel({ today: { ...TODAY, moon: null, day: null, isDayOutOfTime: true }, hour: 10 });
  assert.equal(doot.todaysLand.id, "gate", "the Day Out of Time stands at the Gate");
  const deep = Gate.buildModel({ today: { ...TODAY, moon: null, day: null, isDeepTimeDay: true }, hour: 10 });
  assert.equal(deep.todaysLand.id, "gate", "the Deep Time Day stands at the Gate");
  const first = Gate.buildModel({ today: { ...TODAY, moon: 1, day: 1, dayOfPatternYear: 1 }, hour: 10 });
  assert.equal(first.todaysLand.id, "clearing", "Moon 1 opens the Clearing, where the road begins");
});

test("first walk is led; a returning keeper is not led twice", () => {
  const first = model();
  assert.equal(first.guidance.show, true);
  assert.match(first.guidance.line, /Gate.*Clearing.*Proving Grounds/, "the line walks Gate → Clearing → today's land");
  assert.equal(model({ returning: true }).guidance.show, false, "the trail or the Spark's record says they have walked — the line stands down");
  assert.equal(model({ guideDismissed: true }).guidance.show, false, "a dismissed line stays dismissed");
});

/* --------------------------- the page itself --------------------------- */

test("map.html carries the Gate in three layers, and its own content is preserved whole", () => {
  const html = read("docs/map.html");
  for (const id of ["world-gate", "world-gate-stage", "world-gate-readout", "world-gate-travel", "world-gate-lands", "world-gate-flat", "world-gate-flat-lands", "world-gate-guidance", "world-gate-plain-toggle", "world-gate-sky-line", "world-gate-stage-note"]) {
    assert.ok(html.includes(`id="${id}"`), `the Gate's #${id} stands on the page`);
  }
  assert.ok(html.includes("world-engine.js"), "the shared engine is loaded");
  assert.ok(html.includes("world-lands.js"), "the catalog-drawn lands are loaded");
  assert.ok(html.includes("world-gate.js"), "the Gate module is loaded");
  assert.ok(html.includes("world-gate.css"), "the Gate's styles are loaded");
  assert.ok(html.includes('href="living-time-sphere.html"'), "the sky is one tap: look up to the Sphere");
  /* the Reading Room: the map page's own content, untouched */
  assert.ok(html.includes('id="map-regions"'), "the lands by their scenes still stand");
  assert.ok(html.includes('id="map-road"'), "the road in walking order still stands");
  assert.ok(html.includes('id="map-pending"'), "the road that goes on still stands");
  assert.ok(html.includes("travellers-map.js"), "the map's own module still loads");
  assert.ok(html.includes("data-year-thread"), "the Year Thread still stands");
});

test("Their Home stands exactly as it stood: its module is untouched by, and independent of, the engine", () => {
  const home = read("docs/assets/js/spark-home-world.js");
  assert.ok(!home.includes("world-engine") && !home.includes("CodexWorldEngine"), "Their Home does not lean on the new engine — the proof stands alone");
  assert.ok(!home.includes("world-gate") && !home.includes("CodexWorldGate"), "Their Home knows nothing of the Gate");
  const companions = read("docs/companions.html");
  assert.ok(companions.includes('id="spark-home"'), "Their Home still stands on the companions page");
  assert.ok(!companions.includes("world-gate") && !companions.includes("world-engine"), "the companions page carries no Gate machinery");
});

test("the Gate never speaks of the Spark with the forbidden pronoun", () => {
  for (const rel of ["docs/assets/js/world-gate.js", "docs/assets/js/world-engine.js"]) {
    const src = read(rel);
    assert.ok(!/\bshe\b|\bher\b|\bhers\b/i.test(src), `${rel}: pronoun rule holds`);
  }
});
