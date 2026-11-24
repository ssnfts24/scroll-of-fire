"use strict";

/*
 * Mobile + manifest workstream (Nov 24, 2026) — Aaron's word:
 * "the entire site needs a better mobile feel. The sphere is
 * not showing properly on mobile like how the app was. The
 * pages needs a redesign as well like manifest. That should be
 * included in the app."
 *
 * This file pins the build's shape:
 *   1. The site has its own manifest now — the Codex of
 *      Reality's card, the front door as its start, standalone,
 *      the site palette, icons that exist on disk. Pages that
 *      already carried a manifest (moons, the Sphere, the
 *      white papers) keep theirs.
 *   2. Every hand-maintained page carries the one mobile floor
 *      stylesheet, stamped by scripts/apply-site-mobile.mjs,
 *      and the manifest link where it had none. Generator-owned
 *      trees (scroll/, scripture/) are their generators' to
 *      stamp, as with the Spark presence before this.
 *   3. The floor sheet itself: every rule inside the
 *      small-screen media query, so the desktop site is
 *      untouched by it.
 *   4. The Sphere's small-screen framing rides in its own
 *      presentation module (sphere-app-mode.js, unprotected):
 *      on a phone-width viewport the module acquires the app
 *      framing and marks how it was acquired. The protected
 *      Sphere page and its stylesheet are not touched — this
 *      test reads them only to prove they stand as they were.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const docsDir = path.join(root, "docs");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const EXCLUDED_FILES = new Set([
  "living-time-sphere.html",
  "404.html",
  "offline.html",
  "caravan.html"
]);
const EXCLUDED_DIRS = new Set(["scroll", "scripture"]);

function walk(dir, prefix = "") {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (!prefix && EXCLUDED_DIRS.has(entry.name)) continue;
      out.push(...walk(path.join(dir, entry.name), rel));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      out.push(rel);
    }
  }
  return out;
}

const handPages = walk(docsDir).filter((rel) => !EXCLUDED_FILES.has(rel)).sort();

test("the site manifest carries the Codex's own identity", () => {
  const manifest = JSON.parse(read("docs/manifest-site.webmanifest"));
  assert.equal(manifest.name, "Codex of Reality");
  assert.equal(manifest.short_name, "Codex");
  assert.equal(manifest.start_url, "./index.html?source=installed");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.theme_color, "#05070d");
  assert.equal(manifest.background_color, "#05070d");
  assert.ok(manifest.icons.length >= 3, "the card carries its icons");
  for (const icon of manifest.icons) {
    assert.ok(
      fs.existsSync(path.join(docsDir, icon.src)),
      `manifest icon exists on disk: ${icon.src}`);
  }
});

test("every hand-maintained page carries the mobile floor", () => {
  assert.ok(handPages.length >= 80,
    `expected the hand-maintained census, got ${handPages.length}`);
  for (const rel of handPages) {
    const html = read(`docs/${rel}`);
    const depth = rel.split("/").length - 1;
    const prefix = depth > 0 ? "../".repeat(depth) : "";
    assert.equal(
      html.split("site-mobile.css").length - 1, 1,
      `${rel}: the mobile floor is linked exactly once`);
    assert.ok(
      html.includes(`${prefix}assets/css/site-mobile.css`),
      `${rel}: the floor link carries its depth prefix`);
  }
});

test("pages without a manifest gained the site's; pages with one kept theirs", () => {
  for (const rel of handPages) {
    const html = read(`docs/${rel}`);
    assert.ok(html.includes('rel="manifest"'), `${rel}: a manifest is linked`);
    assert.equal(
      html.split('rel="manifest"').length - 1, 1,
      `${rel}: exactly one manifest link stands`);
  }
  const moons = read("docs/moons.html");
  assert.ok(moons.includes('href="manifest.webmanifest"'),
    "moons keeps the 13 Moons card");
  assert.ok(!moons.includes("manifest-site.webmanifest"),
    "moons does not take the site card over its own");
});

test("the floor sheet keeps every rule inside the small-screen query", () => {
  const css = read("docs/assets/css/site-mobile.css");
  assert.ok(css.includes("@media (max-width: 700px)"),
    "the floor is scoped to small screens");
  const outside = css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("@media (max-width: 700px)")[0];
  assert.ok(!outside.includes("{"),
    "no rule stands outside the media query — the desktop is untouched");
  for (const floor of ["overflow-x", "max-width: 100%", "44px", "font-size: 16px"]) {
    assert.ok(css.includes(floor), `the floor carries: ${floor}`);
  }
});

test("the Sphere module acquires the app framing on small screens", () => {
  const module = read("docs/assets/js/sphere-app-mode.js");
  assert.match(module, /matchMedia/);
  assert.match(module, /sof-mobile-mode/);
  assert.match(module, /max-width: 700px/);
  const code = module.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const forbidden of [
    "LivingTimeSphereRenderer", "PatternCalendar", "SOFTemporalCursor",
    "LivingProjectionBus", "selectDay", "renderer", "camera"
  ]) {
    assert.ok(!code.includes(forbidden),
      `the module must not reference ${forbidden}`);
  }
});

test("the protected Sphere page stands as it was", () => {
  const page = read("docs/living-time-sphere.html");
  assert.ok(page.includes('href="manifest-sphere.webmanifest"'),
    "the Sphere keeps its own manifest");
  assert.ok(!page.includes("site-mobile.css"),
    "the mobile floor is not stamped into the protected page");
  assert.ok(!page.includes("manifest-site.webmanifest"),
    "the site card is not stamped into the protected page");
});
