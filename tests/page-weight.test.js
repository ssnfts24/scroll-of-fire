const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const docsRoot = path.join(repoRoot, "docs");
const budget = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "tests/fixtures/page-weight-budget.json"), "utf8")
);

function walkPages() {
  const out = [];
  (function walk(dir, prefix) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!prefix && ["scroll", "scripture", "assets"].includes(entry.name)) continue;
        walk(path.join(dir, entry.name), rel);
      } else if (entry.name.endsWith(".html")) {
        out.push(rel);
      }
    }
  })(docsRoot, "");
  return out.sort();
}

function pageWeight(rel) {
  const file = path.join(docsRoot, rel);
  const html = fs.readFileSync(file, "utf8");
  let total = fs.statSync(file).size;
  const seen = new Set();
  for (const m of html.matchAll(/(?:src|href)="((?:\.\.\/)*assets\/[^"]+\.(?:js|css))(?:\?[^"]*)?"/g)) {
    let asset = m[1];
    while (asset.startsWith("../")) asset = asset.slice(3);
    if (seen.has(asset)) continue;
    seen.add(asset);
    const assetFile = path.join(docsRoot, asset);
    if (fs.existsSync(assetFile)) total += fs.statSync(assetFile).size;
  }
  return total;
}

test("every page fits its standing weight budget — and every page has one", () => {
  const pages = walkPages();
  for (const rel of pages) {
    const cap = budget.caps[rel];
    assert.ok(cap, `${rel} has no weight budget — new pages are budgeted when they land (tests/fixtures/page-weight-budget.json)`);
    const weight = pageWeight(rel);
    assert.ok(
      weight <= cap,
      `${rel} weighs ${weight} bytes, over its ${cap}-byte budget. Diet first (dedupe loads, defer, trim), then raise the cap deliberately if the growth is real.`
    );
  }
  for (const rel of Object.keys(budget.caps)) {
    assert.ok(pages.includes(rel), `the budget names a page that no longer exists: ${rel}`);
  }
});

test("the diet cannot regress silently: the idempotent stacks load once per page", () => {
  const safeStacks = [
    "calendar/pattern-calendar-version.js",
    "calendar/pattern-calendar-data.js",
    "calendar/pattern-calendar-format.js",
    "calendar/pattern-calendar-boundary.js",
    "calendar/pattern-calendar.js",
    "living-trail.js"
  ];
  for (const rel of walkPages()) {
    const html = fs.readFileSync(path.join(docsRoot, rel), "utf8");
    const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]);
    for (const stack of safeStacks) {
      const loads = srcs.filter(s => s.includes(stack));
      assert.ok(loads.length <= 1, `${rel} loads ${stack} ${loads.length} times — the Nov 20 diet removed 71 duplicate loads; keep it that way`);
    }
  }
});
