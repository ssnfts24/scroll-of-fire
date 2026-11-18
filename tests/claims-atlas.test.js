const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const catalog = JSON.parse(read("docs/data/site-catalog.json"));
const curation = JSON.parse(read("scripts/site-catalog-curation.json"));
const register = JSON.parse(read("docs/scroll/evidence/claim-register.json"));
const updates = JSON.parse(read("docs/assets/data/codex-updates.json"));
const page = read("docs/claims-atlas.html");
const script = read("docs/assets/js/claims-atlas.js");

test("claims atlas page carries the unified nav, the register, and a no-JS fallback", () => {
  assert.match(page, /data-site-nav/);
  assert.match(page, /site-nav:global:start[\s\S]*?Scroll Library[\s\S]*?codex-atlas\.html/);
  for (const route of ["scroll/search.html", "scroll/lexicon.html", "scroll/atlas.html", "scroll/editorial.html"]) {
    assert.ok(page.includes(route), `claims atlas misses ${route} in its navigation`);
  }
  assert.ok(page.includes("assets/js/claims-atlas.js"), "page does not load the atlas script");
  assert.ok(page.includes("scroll/evidence/claim-register.json"), "page does not point at the claim register");
  assert.ok(page.includes('data-claims-list'), "page has no claims list mount");
  assert.ok(page.includes('data-claims-filters'), "page has no filter form");
  assert.match(page, /<noscript>[\s\S]*?scroll\/editorial\.html[\s\S]*?scroll\/evidence\/register\.md[\s\S]*?scroll\/evidence\/claim-register\.json[\s\S]*?<\/noscript>/);
  assert.ok(page.includes("https://codexofreality.org/claims-atlas.html"), "page lacks its canonical URL");
  assert.ok(page.includes("The historical timeline"), "page does not say the timeline is still planned");
});

test("claims atlas script renders only from the register and deep-links each claim", () => {
  assert.ok(script.includes("scroll/evidence/claim-register.json"), "script does not fetch the register");
  assert.ok(script.includes("register.claims"), "script does not render from register.claims");
  assert.ok(script.includes("evidenceStatusGuide"), "script does not render the register's status guide");
  assert.ok(script.includes("scroll/editorial.html"), "script does not link to the Evidence Edition");
  assert.ok(script.includes("encodeURIComponent(claim.id)"), "script does not deep-link by claim id");
  assert.ok(!script.includes("QAT-001"), "script must not hard-code claim content");
});

test("catalog carries the claims atlas live and the timeline stays planned", () => {
  const atlas = catalog.entries.find(entry => entry.id === "claims-atlas");
  assert.ok(atlas, "catalog has no claims-atlas entry");
  assert.equal(atlas.status, "live");
  assert.equal(atlas.path, "claims-atlas.html");
  assert.ok(atlas.url, "claims-atlas has no public URL");
  const ids = new Set(catalog.entries.map(entry => entry.id));
  for (const related of atlas.related) assert.ok(ids.has(related), `claims-atlas -> ${related}`);
  const curated = curation.entries.find(entry => entry.id === "claims-atlas");
  assert.ok(curated, "curation has no claims-atlas entry");
  assert.equal(curated.area, "evidence");
  const timeline = catalog.entries.find(entry => entry.id === "planned-timeline");
  assert.ok(timeline, "catalog lost the planned-timeline entry");
  assert.equal(timeline.status, "planned");
  assert.equal(timeline.url, null);
  assert.ok(timeline.related.includes("claims-atlas"), "timeline does not point at the atlas");
});

test("register backs the atlas: every claim is linkable and has the fields the page shows", () => {
  assert.equal(register.claims.length, 21);
  const ids = new Set();
  for (const claim of register.claims) {
    assert.ok(claim.id && !ids.has(claim.id), `duplicate or missing claim id ${claim.id}`);
    ids.add(claim.id);
    for (const field of ["title", "status", "statusLabel", "classification", "evidenceStatus", "evidenceStatusDescription", "sourceReviewStatusDescription"]) {
      assert.ok(claim[field], `${claim.id} missing ${field}`);
    }
    assert.ok(Array.isArray(claim.sources), `${claim.id} sources is not a list`);
  }
  assert.ok(Object.keys(register.evidenceStatusGuide || {}).length >= 5, "register status guide is thin");
});

test("growth record carries the claims atlas entry", () => {
  const entry = updates.find(update => update.url === "./claims-atlas.html");
  assert.ok(entry, "growth record has no claims-atlas entry");
  assert.equal(entry.date, "2026-11-18");
  assert.ok(entry.title.includes("atlas"), "growth entry title does not name the atlas");
  assert.ok(entry.summary.includes("21 claims"), "growth entry summary does not state the claim count");
});
