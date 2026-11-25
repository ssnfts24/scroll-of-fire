/*
 * Header tidy: one brand per page + a mobile menu that scrolls home.
 *
 * Aaron's phone report (Nov 17, 2026, with screenshots):
 *   1. The slide-in site menu could not be scrolled to its bottom —
 *      on the homepage the fixed bottom step rail (.le-rail) covered
 *      the panel's last items, and the panel itself overshot the
 *      visible viewport by the height of the unified nav bar above
 *      the legacy header, so the lowest links could never be tapped.
 *   2. Two brand/home buttons were stacked at the top-left: the
 *      unified living nav's "Codex of Reality" brand and the legacy
 *      site header's "Scroll of Fire / Codex of Reality" brand, both
 *      reading as home buttons.
 *
 * The fix, verified here:
 *   - scripts/apply-living-nav.mjs strips the legacy brand anchor
 *     from every page that carries the unified nav (the header keeps
 *     its toggle and its deep navigation; nothing is lost — the
 *     unified brand and its Home link go to the same place). Pages
 *     the script never touches (404, the R1.7 sphere page) keep
 *     their legacy brand: there it is the only one.
 *   - navigation.css sizes the mobile menu panel to the visible
 *     viewport (subtracting --living-nav-h) and pads its bottom on
 *     the homepage so the last item scrolls clear of the step rail.
 *
 * Batch E3 (Nov 25, 2026) finished the fold this file's problem
 * began: the legacy header itself is gone from every page that
 * carries the unified nav (scripts/apply-one-nav.mjs), its deep
 * links homed on the Library shelf, the Theory and Systems hubs,
 * and the Codex Atlas Start Here path first. The tests below now
 * pin the folded law — one navigation — alongside the surviving
 * CSS and emission guarantees. The full E3 census lives in
 * tests/one-navigation.test.js.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const docsDir = path.join(root, "docs");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

function walk(dir, prefix = "") {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(path.join(dir, entry.name), rel));
    else if (entry.isFile() && entry.name.endsWith(".html")) out.push(rel);
  }
  return out;
}

const allPages = walk(docsDir).sort();

function headerBlock(html) {
  const m = html.match(/<header\b[^>]*\bdata-sof-header[^>]*>[\s\S]*?<\/header>/);
  return m ? m[0] : null;
}

const dualHeaderPages = allPages.filter((rel) => {
  const html = read(`docs/${rel}`);
  return html.includes("data-sof-header") && html.includes("data-living-nav");
});

test("the fold is complete: the legacy header survives only outside the nav's reach", () => {
  const survivors = allPages.filter((rel) => read(`docs/${rel}`).includes("data-sof-header"));
  assert.deepEqual(
    survivors,
    ["404.html", "aiyanas-world.html", "living-time-sphere.html"],
    "the legacy header stands only on the utility 404, Aiyana's World (hers to rule), and the protected Sphere page"
  );
});

test("exactly one brand/home element reads at the top of folded pages", () => {
  for (const rel of allPages) {
    if (["404.html", "aiyanas-world.html", "living-time-sphere.html", "offline.html", "caravan.html"].includes(rel)) continue;
    const html = read(`docs/${rel}`);
    if (!html.includes("data-living-nav")) continue;
    assert.equal(
      (html.match(/class="living-nav-brand"/g) || []).length,
      1,
      `${rel}: one unified brand`
    );
    assert.ok(!html.includes("data-sof-header"), `${rel}: no legacy header under the one nav`);
  }
});

test("pages outside the nav's reach keep their only brand", () => {
  for (const rel of ["404.html", "living-time-sphere.html"]) {
    const html = read(`docs/${rel}`);
    const header = headerBlock(html);
    assert.ok(header, `${rel}: site header present`);
    assert.ok(
      /<a\b[^>]*\bclass="brand"/.test(header),
      `${rel}: legacy brand kept (it is the only brand on this page)`
    );
    assert.ok(!html.includes("data-living-nav"), `${rel}: still excluded from the unified nav`);
  }
  /* Aiyana's World keeps its legacy header by her design
   * authority — E3 does not rule on the menu over her world. */
  assert.ok(headerBlock(read("docs/aiyanas-world.html")), "aiyanas-world: legacy header untouched");
});

test("the mobile menu panel is contracted to scroll fully", () => {
  const css = read("docs/assets/css/navigation.css");
  const mediaAt = css.indexOf("@media (max-width: 760px)");
  assert.ok(mediaAt >= 0, "mobile nav block exists");
  const mobile = css.slice(mediaAt);
  const panel = mobile.match(/\.site-nav\s*\{([^}]*)\}/);
  assert.ok(panel, "mobile .site-nav rule exists");
  assert.match(panel[1], /overflow-y:\s*auto/, "panel scrolls vertically");
  assert.match(panel[1], /-webkit-overflow-scrolling:\s*touch/, "panel keeps momentum scrolling");
  assert.match(
    panel[1],
    /height:\s*calc\(100dvh[\s\S]*?--living-nav-h/,
    "panel height is the visible viewport: dynamic viewport height minus the bars above it"
  );
  const clearance = mobile.match(/html\.home-page\s+\.site-nav\s*\{([^}]*)\}/);
  assert.ok(clearance, "homepage rail-clearance rule exists");
  const rem = clearance[1].match(/padding-bottom:\s*calc\((\d+(?:\.\d+)?)rem/);
  assert.ok(rem, "clearance is a calc() padding-bottom in rem");
  assert.ok(Number(rem[1]) >= 4, `clearance clears the step rail (>= 4rem), got ${rem[1]}rem`);
});

test("the living nav publishes its height for the panel math", () => {
  const css = read("docs/assets/css/living-ui.css");
  assert.match(css, /--living-nav-h:\s*\d+px/, "living-ui.css defines --living-nav-h");
});

test("the strip lives in the emission path, so it stays fixed by construction", () => {
  const script = read("scripts/apply-living-nav.mjs");
  assert.match(script, /stripLegacyBrand/, "apply-living-nav.mjs strips the legacy brand");
  assert.match(script, /LEGACY_BRAND_RE/, "the brand pattern is named and scoped");
  assert.match(script, /data-sof-header/, "the strip is scoped to the site header");
});
