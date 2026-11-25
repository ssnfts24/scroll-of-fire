"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const docsDir = path.join(root, "docs");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

/*
 * The living layer is wired into every top-level content page.
 * Exclusions are explicit:
 * - living-time-sphere.html: R1.7-protected — never edited outside the
 *   sphere discipline.
 * - 404.html: error page, served from the domain root with its own base.
 * - offline.html: offline fallback utility page (no stylesheet stack).
 * - caravan.html: meta-refresh redirect stub to covenant-caravan.html.
 * - account.html was excluded under Gate G (G2) as a sign-in
 *   utility page; Page Evolution Batch E3 (Nov 25, 2026) brought
 *   it into the one-nav system by the plan's named step, so it
 *   is a wired page here now.
 */
const EXCLUDED = [
  "living-time-sphere.html",
  "404.html",
  "offline.html",
  "caravan.html",
  // Page programme (Nov 24, 2026): start.html and witness-world.html
  // folded into the front door and the Witness page; redirect stubs.
  "start.html",
  "witness-world.html",
  // Page programme (Nov 24, 2026): the Remnant Whitepaper folded into
  // the Codex White Paper as Part II; a redirect stub now.
  "scroll-of-fire-codex-of-reality-remnant-whitepaper.html"
];

const topLevelPages = fs
  .readdirSync(docsDir)
  .filter((name) => name.endsWith(".html"))
  .sort();

const wiredPages = topLevelPages.filter((name) => !EXCLUDED.includes(name));

test("the exclusion list is exactly the protected + utility pages", () => {
  assert.deepEqual(EXCLUDED, [
    "living-time-sphere.html",
    "404.html",
    "offline.html",
    "caravan.html",
    "start.html",
    "witness-world.html",
    "scroll-of-fire-codex-of-reality-remnant-whitepaper.html"
  ]);
  for (const name of EXCLUDED) {
    assert.ok(topLevelPages.includes(name), `excluded page should exist: ${name}`);
  }
});

test("every non-excluded top-level page references the living layer once", () => {
  assert.ok(wiredPages.length >= 25, `expected at least 25 wired pages, got ${wiredPages.length}`);
  for (const name of wiredPages) {
    const html = read("docs/" + name);
    const cssRefs = html.match(/assets\/css\/living-ui\.css/g) || [];
    const jsRefs = html.match(/assets\/js\/living-ui\.js/g) || [];
    assert.equal(cssRefs.length, 1, `${name}: living-ui.css must be referenced exactly once`);
    assert.equal(jsRefs.length, 1, `${name}: living-ui.js must be referenced exactly once`);
    const body = html.match(/<body\b[^>]*>/);
    assert.ok(body && /class="[^"]*\bliving-ui\b/.test(body[0]),
      `${name}: body must carry the living-ui class`);
    assert.match(html, /<base href="\.\/">/, `${name}: base tag must remain the depth-relative "./"`);
  }
});

test("excluded pages carry no living layer references", () => {
  for (const name of EXCLUDED) {
    const html = read("docs/" + name);
    assert.ok(!html.includes("living-ui"),
      `${name} is excluded and must not reference the living layer`);
  }
});

test("the protected sphere page is byte-identical to its pre-layer state", () => {
  const html = read("docs/living-time-sphere.html");
  assert.ok(!html.includes("living-ui.css"));
  assert.ok(!html.includes("living-ui.js"));
  const body = html.match(/<body\b[^>]*>/);
  assert.ok(body && !/\bliving-ui\b/.test(body[0]),
    "sphere page body must not gain the living-ui class");
});

test("living layer assets exist and carry their guards", () => {
  const css = read("docs/assets/css/living-ui.css");
  const js = read("docs/assets/js/living-ui.js");
  assert.match(css, /body\.living-ui::before/);
  assert.match(css, /::selection/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.lui-reveal-pending\s*\{[^}]*opacity:\s*0/);
  assert.match(js, /living-entry/, "living-ui.js must opt out on the homepage");
  assert.match(js, /classList\.add\("lui-reveal-pending"\)/);
  assert.match(js, /prefers-reduced-motion/);
});

test("no wired page hides sections by default", () => {
  const css = read("docs/assets/css/living-ui.css");
  assert.ok(!/main\s*>\s*section\s*\{[^}]*opacity:\s*0/.test(css),
    "default section CSS must not hide sections");
  for (const name of wiredPages) {
    const html = read("docs/" + name);
    assert.ok(!html.includes("lui-reveal-pending"),
      `${name}: hidden reveal state must never appear in markup`);
  }
});
