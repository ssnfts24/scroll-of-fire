const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const catalog = JSON.parse(read("docs/data/site-catalog.json"));
const inventory = JSON.parse(read("site-audit/site-master-inventory.json"));
const reconciliation = JSON.parse(read("site-audit/downloads-reconciliation.json"));
const curation = JSON.parse(read("scripts/site-catalog-curation.json"));

test("public catalog has six areas, usable routes, and only explicit publication entries", () => {
  assert.equal(catalog.areas.length, 6);
  assert.deepEqual(catalog.areas.map(area => area.title), [
    "Scroll and Scripture",
    "Living Time and Observatory",
    "Systems and Living Technology",
    "Evidence and Research",
    "Artifacts and Creative Works",
    "Archive and Downloads"
  ]);
  assert.equal(catalog.frontDoor.length, 5);
  assert.deepEqual(catalog.frontDoor.map(path => path.label), [
    "Read", "Explore", "Build", "Living Time", "Archive"
  ]);
  const ids = new Set(catalog.entries.map(entry => entry.id));
  assert.equal(ids.size, catalog.entries.length);
  for (const area of catalog.areas) {
    const entryPoint = catalog.entries.find(entry => entry.id === area.entryPoint);
    assert.ok(entryPoint, `${area.id} has no catalog entry point`);
    assert.ok(entryPoint.url, `${area.id} entry point has no route`);
  }
  for (const entry of catalog.entries) {
    assert.equal(entry.publicationEligibility, "approved-public");
    assert.ok(catalog.statuses.includes(entry.status), entry.id);
    for (const related of entry.related) assert.ok(ids.has(related), `${entry.id} -> ${related}`);
    if (entry.status === "planned") assert.equal(entry.url, null, entry.id);
    else assert.ok(entry.url, `${entry.id} has no public URL`);
  }
  assert.equal(catalog.entries.some(entry => entry.path === "EVIDENCE_REGISTER.md"), false);
  assert.ok(catalog.entries.some(entry =>
    entry.path === "README.md" && entry.publicationEligibility === "approved-public"
  ));
});

test("master inventory covers every deployed page and numbered archive file with provenance fields", () => {
  const htmlPages = inventory.resources.filter(resource =>
    resource.sourcePath?.startsWith("docs/") && resource.sourcePath.endsWith(".html")
  );
  assert.equal(htmlPages.length, inventory.summary.publicHtmlPages);
  assert.ok(htmlPages.some(resource => resource.sourcePath === "docs/scroll/editorial.html"));
  assert.ok(htmlPages.some(resource => resource.sourcePath === "docs/scroll/lexicon.html"));
  assert.ok(htmlPages.some(resource => resource.sourcePath === "docs/scroll/search.html"));
  assert.ok(htmlPages.some(resource => resource.sourcePath === "docs/scroll/atlas.html"));

  for (const resource of inventory.resources) {
    for (const key of ["id", "title", "description", "category", "sourcePath",
      "relatedProjects", "publicUrl", "publicationStatus", "lastVerifiedSourceRevision", "relatedPages",
      "canonicalUrl", "privacyEligibility", "issues"]) {
      assert.ok(Object.hasOwn(resource, key), `${resource.id} missing ${key}`);
    }
    assert.ok(resource.description.length > 20, `${resource.id} needs a short description`);
  }
  const numberedFiles = inventory.resources.filter(resource =>
    resource.category === "Numbered archive file"
  );
  assert.ok(numberedFiles.length > 0);
  assert.ok(numberedFiles.every(resource =>
    /^([1-7])_/.test(resource.sourcePath) &&
    resource.publicUrl?.includes("/blob/main/") &&
    resource.privacyEligibility === "published-via-downloads"
  ));
  assert.ok(inventory.resources.some(resource =>
    resource.sourcePath === "README.md" && resource.privacyEligibility === "approved-public"
  ));
});

test("global navigation, Scroll entry points, filters and local-data disclosure are connected", () => {
  const htmlFiles = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (file.endsWith(".html")) htmlFiles.push(file);
    }
  }
  walk(path.join(root, "docs"));

  for (const file of htmlFiles) {
    const source = fs.readFileSync(file, "utf8");
    if (!source.includes('data-site-nav')) continue;
    assert.match(source, /site-nav:global:start[\s\S]*?Scroll Library[\s\S]*?codex-atlas\.html/);
    for (const route of ["scroll/search.html", "scroll/lexicon.html", "scroll/atlas.html", "scroll/editorial.html"]) {
      assert.ok(source.includes(route), `${file} misses ${route} in its navigation`);
    }
  }

  const homepage = read("docs/index.html");
  for (const label of ["Read", "Explore", "Build", "Living Time", "Archive"]) {
    assert.match(homepage, new RegExp(`>${label}<`));
  }
  assert.match(homepage, /scroll\/editorial\.html/);
  assert.match(homepage, /codex-atlas\.html/);

  const atlas = read("docs/codex-atlas.html");
  for (const field of ["category", "type", "status", "area"]) {
    assert.match(atlas, new RegExp(`name="${field}"`));
  }
  assert.match(atlas, /do not synchronize between devices/i);
  assert.match(atlas, /data-atlas-filters/);

  for (const file of [
    "docs/scroll/index.html",
    "docs/scroll/reader.html",
    "docs/scroll/search.html",
    "docs/scroll/lexicon.html",
    "docs/scroll/atlas.html",
    "docs/scroll/editorial.html"
  ]) {
    const source = read(file);
    assert.match(source, /\.\.\/codex-atlas\.html/);
    assert.match(source, /\.\.\/index\.html/);
  }
});

test("recent activity includes the reviewed October and November library releases", () => {
  const updates = JSON.parse(read("docs/assets/data/codex-updates.json"));
  const newer = updates.filter(item => item.date > "2026-08-18");
  assert.ok(newer.length >= 3);
  assert.ok(newer.some(item => item.date === "2026-11-01" && item.url === "./scroll/editorial.html"));
  assert.ok(newer.some(item => item.title.includes("Hebrew lexicon") && item.url === "./scroll/search.html"));
  assert.ok(newer.some(item => item.title.includes("archival edition")));
  const homepage = read("docs/index.html");
  assert.match(homepage, /site-catalog:front-door:start[\s\S]*?Recent additions/);
});

test("Downloads reconciliation preserves snapshot accounting and reports rather than rewrites", () => {
  assert.equal(reconciliation.note, "Report only. downloads.html and its integrity history were not modified.");
  assert.equal(reconciliation.snapshot.commit, "af3078a5fc2cc7969733ad9df1fcffd6754d974c");
  assert.equal(reconciliation.snapshot.declaredFiles, 167);
  assert.equal(reconciliation.snapshot.parsedRows, 167);
  assert.equal(reconciliation.counts.added, 27);
  assert.equal(reconciliation.counts.removed, 0);
  assert.equal(reconciliation.counts.changed, 0);
  assert.equal(reconciliation.counts.unchanged, 167);
  assert.ok(curation.entries.some(entry => entry.id === "downloads"));
});
