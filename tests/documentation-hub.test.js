const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const catalog = JSON.parse(read("docs/data/site-catalog.json"));
const curation = JSON.parse(read("scripts/site-catalog-curation.json"));
const register = JSON.parse(read("docs/scroll/evidence/claim-register.json"));
const hub = JSON.parse(read("docs/assets/data/documentation-hub.json"));
const page = read("docs/claims-atlas.html");
const script = read("docs/assets/js/documentation-hub.js");

test("documentation hub page carries the unified nav, the hub mounts, and a no-JS fallback", () => {
  assert.match(page, /data-site-nav/);
  assert.match(page, /site-nav:global:start[\s\S]*?Scroll Library[\s\S]*?codex-atlas\.html/);
  for (const route of ["scroll/search.html", "scroll/lexicon.html", "scroll/atlas.html", "scroll/editorial.html"]) {
    assert.ok(page.includes(route), `documentation hub misses ${route} in its navigation`);
  }
  assert.ok(page.includes("assets/js/documentation-hub.js"), "page does not load the hub script");
  assert.ok(page.includes("scroll/evidence/claim-register.json"), "page does not point at the claim register");
  assert.ok(page.includes("assets/data/documentation-hub.json"), "page does not point at the hub data");
  assert.ok(page.includes("data-hub-sections"), "page has no hub sections mount");
  assert.ok(page.includes("data-hub-filters"), "page has no filter form");
  assert.match(page, /<noscript>[\s\S]*?scroll\/editorial\.html[\s\S]*?scroll\/evidence\/register\.md[\s\S]*?scroll\/evidence\/claim-register\.json[\s\S]*?<\/noscript>/);
  assert.ok(page.includes("https://codexofreality.org/claims-atlas.html"), "page lacks its canonical URL");
  assert.ok(page.includes("The historical timeline"), "page does not say the timeline is still planned");
});

test("hub script renders only from the two data files and deep-links register claims", () => {
  assert.ok(script.includes("assets/data/documentation-hub.json"), "script does not fetch the hub data");
  assert.ok(script.includes("scroll/evidence/claim-register.json"), "script does not fetch the register");
  assert.ok(script.includes("register.claims"), "script does not render from register.claims");
  assert.ok(script.includes("evidenceStatusGuide"), "script does not render the register's grade guide");
  assert.ok(script.includes("scroll/editorial.html"), "script does not link to the Evidence Edition");
  assert.ok(script.includes("encodeURIComponent(entry.id)"), "script does not deep-link by entry id");
  for (const id of ["GOV-MKULTRA-001", "EPS-NPA-001", "TES-WARD-004", "ORP-BRACE-001", "QAT-001"]) {
    assert.ok(!script.includes(id), `script must not hard-code entry content (${id})`);
  }
});

test("hub data: every entry is documented, graded in the register scheme, and sourced", () => {
  const guideKeys = new Set(Object.keys(register.evidenceStatusGuide));
  assert.ok(guideKeys.size >= 5, "register grade guide is thin");
  assert.ok(Array.isArray(hub.entries), "hub has no entries list");
  assert.ok(hub.entries.length >= 60, `hub is thin: ${hub.entries.length} entries`);
  const domainIds = new Set(hub.domains.map(domain => domain.id));
  const ids = new Set();
  const perDomain = new Map();
  for (const entry of hub.entries) {
    assert.ok(entry.id && !ids.has(entry.id), `duplicate or missing entry id ${entry.id}`);
    ids.add(entry.id);
    perDomain.set(entry.domain, (perDomain.get(entry.domain) || 0) + 1);
    assert.ok(domainIds.has(entry.domain), `${entry.id} names an unknown domain ${entry.domain}`);
    for (const field of ["title", "statement", "grade", "dates", "shows"]) {
      assert.ok(entry[field], `${entry.id} missing ${field}`);
    }
    assert.ok(guideKeys.has(entry.grade), `${entry.id} grade ${entry.grade} is outside the register scheme`);
    assert.ok(Array.isArray(entry.sources) && entry.sources.length >= 1, `${entry.id} has no source`);
    for (const source of entry.sources) {
      assert.ok(source.name, `${entry.id} has an unnamed source`);
      assert.match(source.url, /^https?:\/\//, `${entry.id} source is not a URL: ${source.url}`);
    }
  }
  for (const [domain, floor] of [["government", 12], ["corporations", 10], ["epstein", 8], ["tesla", 8], ["orphan-trains", 5], ["old-world", 6], ["bench", 1]]) {
    assert.ok((perDomain.get(domain) || 0) >= floor, `domain ${domain} is thin: ${perDomain.get(domain) || 0}`);
  }
  assert.ok(domainIds.has("register"), "hub domains lost the register domain");
});

test("catalog carries the documentation hub live and the timeline stays planned", () => {
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
  assert.ok(timeline.related.includes("claims-atlas"), "timeline does not point at the hub");
});

test("register backs the hub: every claim is linkable and has the fields the page shows", () => {
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
