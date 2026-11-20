"use strict";

/**
 * Sphere Homestead Panel: the Day World's homestead layer.
 * Guards: (a) the dataset is complete and every entry carries a
 * source that exists in the registry — an entry with no source
 * behind it does not ship; (b) the date logic answers plainly and
 * correctly against fixed fixtures in both founding counties,
 * including the year-wrapping animal windows; (c) categories the
 * dataset gates by season stay silent outside their season.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const data = JSON.parse(
  fs.readFileSync(path.join(root, "docs/assets/data/farm-homestead-western-wa.json"), "utf8")
);
const panel = require(path.join(root, "docs/assets/js/sphere-homestead-panel.js"));

const sourceIds = new Set(data.sources.map(s => s.id));

function assertSourced(part, label) {
  assert.ok(part, `${label} missing`);
  assert.ok(Array.isArray(part.sources) && part.sources.length > 0, `${label} has no source`);
  for (const id of part.sources) {
    assert.ok(sourceIds.has(id), `${label} cites unknown source ${id}`);
  }
}

test("dataset: every source has a publisher, a title, and a real URL", () => {
  assert.ok(data.sources.length >= 12, `expected >= 12 sources, got ${data.sources.length}`);
  for (const s of data.sources) {
    assert.ok(s.id && s.publisher && s.title, `source ${s.id} incomplete`);
    assert.match(s.url, /^https?:\/\//, `source ${s.id} url`);
  }
});

test("dataset: both founding counties are present with sourced frost dates and zones", () => {
  const ids = data.locations.map(l => l.id);
  assert.deepEqual(ids.sort(), ["lewis", "snohomish"]);
  for (const loc of data.locations) {
    assert.match(loc.lastSpringFrost, /^\d{2}-\d{2}$/);
    assert.match(loc.firstFallFrost, /^\d{2}-\d{2}$/);
    assert.ok(loc.frostFreeDays > 150 && loc.frostFreeDays < 260);
    assert.ok(loc.zones.length >= 1);
    assertSourced({ sources: loc.frostSources }, `${loc.id} frost dates`);
    assertSourced({ sources: loc.safeFrostSources }, `${loc.id} safe frost dates`);
    assertSourced({ sources: loc.zoneSources }, `${loc.id} zones`);
    assert.ok(loc.frostRangeNote.length > 40, `${loc.id} must carry its disagreement/range note`);
  }
  const lewis = data.locations.find(l => l.id === "lewis");
  assert.equal(lewis.lastSpringFrost, "04-22"); // Centralia, NOAA median
  assert.equal(lewis.safeLastSpringFrost, "04-30"); // Almanac 30% line
  const snohomish = data.locations.find(l => l.id === "snohomish");
  assert.equal(snohomish.lastSpringFrost, "03-24"); // Everett lowland, NOAA median
  assert.equal(snohomish.safeLastSpringFrost, "05-01"); // WSU observed latest since 2012
});

test("dataset: cover crops all sourced, with WSU windows, rates, and purposes", () => {
  assert.ok(data.coverCrops.length >= 6, `expected >= 6 cover crops, got ${data.coverCrops.length}`);
  const ids = data.coverCrops.map(c => c.id);
  for (const required of ["cereal-rye", "crimson-clover", "hairy-vetch"]) {
    assert.ok(ids.includes(required), `missing ${required}`);
  }
  const seen = new Set();
  for (const crop of data.coverCrops) {
    assert.ok(!seen.has(crop.id), `duplicate cover crop ${crop.id}`);
    seen.add(crop.id);
    assert.ok(["grass", "legume"].includes(crop.kind), `${crop.id} kind`);
    assert.ok(crop.purpose.length > 10, `${crop.id} purpose`);
    assert.match(crop.sowWindow.start, /^\d{2}-\d{2}$/);
    assert.match(crop.sowWindow.end, /^\d{2}-\d{2}$/);
    assert.ok(crop.sowWindow.text.length > 5, `${crop.id} window words`);
    assert.ok(crop.rateText.length > 3, `${crop.id} rate`);
    assertSourced(crop, `${crop.id} cover crop`);
  }
});

test("dataset: final sowings, season extension, storage, seed saving, animals — all sourced", () => {
  assert.ok(data.finalSowings.crops.length >= 8, "final sowings list too short");
  for (const crop of data.finalSowings.crops) {
    assert.ok(crop.lastMonth >= 1 && crop.lastMonth <= 12, `${crop.id} lastMonth`);
    assert.ok(crop.seedingText && crop.harvestText, `${crop.id} chart words`);
    assertSourced(crop, `${crop.id} final sowing`);
  }
  assertSourced(data.finalSowings, "final sowings list");
  assert.ok(data.seasonExtension.length >= 4, "season extension entries");
  for (const item of data.seasonExtension) {
    assert.ok(item.text.length > 40, `${item.id} text`);
    assertSourced(item, `${item.id} season extension`);
  }
  const storageIds = data.storage.crops.map(c => c.id);
  for (const required of ["onions-dry", "potatoes-late", "winter-squash", "apples", "garlic"]) {
    assert.ok(storageIds.includes(required), `missing storage ${required}`);
  }
  for (const crop of data.storage.crops) {
    assert.ok(crop.temperatureText && crop.humidityText, `${crop.id} conditions`);
    assert.ok(
      Array.isArray(crop.lifeMonths) && crop.lifeMonths[1] >= crop.lifeMonths[0] && crop.lifeMonths[0] >= 1,
      `${crop.id} life range`
    );
    assertSourced(crop, `${crop.id} storage`);
  }
  const seedIds = data.seedSaving.crops.map(c => c.id);
  for (const required of ["beans-seed", "peas-seed", "lettuce-seed", "tomatoes-seed"]) {
    assert.ok(seedIds.includes(required), `missing seed crop ${required}`);
  }
  for (const crop of data.seedSaving.crops) {
    assert.ok(crop.pollination && crop.isolationText && crop.howText, `${crop.id} seed fields`);
    assertSourced(crop, `${crop.id} seed saving`);
  }
  assert.ok(data.animals.entries.length >= 3, "animal entries");
  for (const entry of data.animals.entries) {
    assert.ok(entry.lines.length >= 2, `${entry.id} lines`);
    assert.match(entry.fixed.start, /^\d{2}-\d{2}$/);
    assert.match(entry.fixed.end, /^\d{2}-\d{2}$/);
    assertSourced(entry, `${entry.id} animal note`);
  }
});

test("panel: Lewis in mid-September sows rye and clover, hears storage and seed saving", () => {
  const a = panel.adviceForDate(data, "lewis", "2026-09-10");
  assert.equal(a.ok, true);
  assert.ok(a.coverNow.some(l => l.startsWith("Cereal rye")), "rye sowing");
  assert.ok(a.coverNow.some(l => l.startsWith("Crimson clover")), "clover sowing");
  assert.ok(a.coverComing.some(l => l.startsWith("Winter wheat")), "wheat coming");
  assert.ok(a.finalSowingLines.some(l => l.startsWith("Chard")), "chard final month");
  assert.ok(a.storageLines.some(l => l.startsWith("Onions, dry")), "storage speaks in September");
  assert.ok(a.seedLines.some(l => l.startsWith("Beans")), "seed saving speaks in September");
  assert.ok(a.animalLines.some(l => l.includes("Winterize the coop")), "winterize speaks in September");
});

test("panel: Snohomish in early August hears final sowings and the winter-planting season", () => {
  const a = panel.adviceForDate(data, "snohomish", "2026-08-05");
  assert.equal(a.ok, true);
  assert.ok(a.finalSowingLines.some(l => l.startsWith("Carrots") && l.includes("last month")), "carrots final month");
  assert.ok(a.finalSowingLines.some(l => l.startsWith("Arugula") && l.includes("next month")), "arugula next month");
  assert.ok(a.seasonLines.some(l => l.includes("planted in summer")), "winter planting season");
  assert.ok(a.coverComing.some(l => l.startsWith("Cereal rye")), "rye coming");
});

test("panel: spring frost window brings the cold-frame line in Snohomish", () => {
  const a = panel.adviceForDate(data, "snohomish", "2026-04-10");
  assert.equal(a.ok, true);
  assert.ok(a.seasonLines.some(l => l.includes("Cold frames for seed starting")), "cold frame line");
  assert.equal(a.storageLines.length, 0, "storage silent outside harvest months");
  assert.equal(a.seedLines.length, 0, "seed saving silent in April");
});

test("panel: the goats' winter window wraps the year (January speaks, June is silent)", () => {
  const jan = panel.adviceForDate(data, "lewis", "2026-01-15");
  assert.ok(jan.animalLines.some(l => l.startsWith("Goats")), "goats speak in January");
  assert.ok(jan.animalLines.some(l => l.includes("14–16 hours of light") || l.includes("14-16")), "light line in January");
  const jun = panel.adviceForDate(data, "snohomish", "2026-06-15");
  assert.equal(jun.animalLines.length, 0, "animals silent in June");
  assert.ok(panel.renderLines(jun).some(l => l.includes("No homestead work is calling today")), "quiet day line");
});

test("panel: fall frost watch puts the covers on in Lewis by late October", () => {
  const a = panel.adviceForDate(data, "lewis", "2026-10-20");
  assert.ok(a.seasonLines.some(l => l.includes("Cold frames and low tunnels")), "covers line");
});

test("panel: bad county and bad date answer honestly", () => {
  const badCounty = panel.adviceForDate(data, "pierce", "2026-09-10");
  assert.equal(badCounty.ok, false);
  assert.match(badCounty.reason, /not in the homestead data/);
  const badDate = panel.adviceForDate(data, "lewis", "not-a-date");
  assert.equal(badDate.ok, false);
});

test("panel: every line's sources resolve and render carries the citations line", () => {
  const a = panel.adviceForDate(data, "lewis", "2026-09-10");
  assert.ok(a.sources.length >= 5, "sources gathered");
  for (const s of a.sources) assert.ok(sourceIds.has(s.id), `unknown source ${s.id}`);
  const lines = panel.renderLines(a);
  assert.ok(lines[lines.length - 1].startsWith("Sources:"), "citations line last");
});
