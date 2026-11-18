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

test("the dual-header census is the whole overlap, not a sample", () => {
  assert.ok(
    dualHeaderPages.length >= 60,
    `expected >=60 pages carrying both headers, got ${dualHeaderPages.length}`
  );
});

test("exactly one brand/home element reads at the top of dual-header pages", () => {
  for (const rel of dualHeaderPages) {
    const html = read(`docs/${rel}`);
    assert.equal(
      (html.match(/class="living-nav-brand"/g) || []).length,
      1,
      `${rel}: one unified brand`
    );
    const header = headerBlock(html);
    assert.ok(header, `${rel}: site header still present`);
    assert.ok(
      !/<a\b[^>]*\bclass="brand"/.test(header),
      `${rel}: legacy brand anchor removed from the site header`
    );
    assert.ok(
      !/aria-label="(Scroll of Fire|Codex of Reality) home"/.test(header),
      `${rel}: no second home-labelled brand in the header`
    );
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
});

test("the deep menu survives intact on every dual-header page", () => {
  for (const rel of dualHeaderPages) {
    const html = read(`docs/${rel}`);
    assert.ok(html.includes("data-site-nav"), `${rel}: deep nav present`);
    assert.ok(html.includes("data-nav-toggle"), `${rel}: menu toggle present`);
    const about = html.match(/id="nav-about"[\s\S]*?<\/div>/);
    if (about) {
      for (const label of [
        "Start Here",
        "Covenant Caravan",
        "Manifest",
        "Ethics",
        "Downloads",
        "Remnant Whitepaper",
        "13 Moons Whitepaper"
      ]) {
        assert.ok(about[0].includes(`>${label}<`), `${rel}: About menu still links ${label}`);
      }
    }
  }
  const home = read("docs/index.html");
  for (const section of ["Today", "Explore", "Build", "Artifacts", "About"]) {
    assert.ok(
      home.includes(`data-dropdown-toggle>\n          ${section} `) ||
        new RegExp(`aria-controls="nav-[a-z]+" data-dropdown-toggle>\\s*${section}\\s`).test(home),
      `homepage: ${section} dropdown still present`
    );
  }
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
