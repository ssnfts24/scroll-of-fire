"use strict";

/*
 * One navigation (Page Evolution Batch E3, Aaron's order,
 * Nov 25, 2026: "Start all"; the Nov 24 release note's Batch B
 * fold, ordered by the page-by-page evolution plan).
 *
 * The site carried two navigation systems on 76 pages. These
 * tests pin the folded law:
 *   - the legacy header (data-sof-header) survives only where
 *     it is the only brand or not this programme's to rule:
 *     the utility 404, the protected Sphere page, and Aiyana's
 *     World (her design authority);
 *   - every folded page carries exactly one unified travel bar
 *     and no second nav system from the legacy stack;
 *   - the theory wing's stack is down to the travel bar (plus
 *     its breadcrumb and its pages' own prev/next chains): no
 *     legacy header, no theory secondary nav;
 *   - the legacy header's 31 deep links are homed, each on the
 *     surface the plan named — the Scroll doors on the Library
 *     shelf, Theory/Canon on the Theory hub, the Systems doors
 *     on the Systems Archive, the rest on the Codex Atlas;
 *   - account.html stands inside the one system (its door stays
 *     honestly closed; that is configuration, not navigation).
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const docsDir = path.join(repoRoot, "docs");
const read = (rel) => fs.readFileSync(path.join(docsDir, rel), "utf8");

function walk(dir, prefix = "") {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(path.join(dir, entry.name), rel));
    else if (entry.isFile() && entry.name.endsWith(".html")) out.push(rel);
  }
  return out.sort();
}

const allPages = walk(docsDir);
const HEADER_SURVIVORS = ["404.html", "aiyanas-world.html", "living-time-sphere.html"];

test("the legacy header survives only on the three named pages", () => {
  const survivors = allPages.filter((rel) => read(rel).includes("data-sof-header"));
  assert.deepEqual(survivors, HEADER_SURVIVORS);
});

test("no folded page stacks the legacy deep menu under the travel bar again", () => {
  for (const rel of allPages) {
    /* The survivors stand outside the fold by law — Aiyana's
     * World keeps its menu until she and Aaron rule on it, and
     * the scripture wing's own data-site-nav is its scripture
     * navigation, not the legacy deep menu (that menu is the
     * #primary-navigation / #site-navigation block, with its
     * toggle). */
    if (HEADER_SURVIVORS.includes(rel) || rel.startsWith("scripture/")) continue;
    const html = read(rel);
    if (html.includes("data-travel-bar")) {
      assert.ok(!html.includes('id="primary-navigation"'), `${rel}: legacy deep menu gone`);
      assert.ok(!html.includes('id="site-navigation"'), `${rel}: legacy deep menu gone`);
      assert.ok(!/<button[^>]*data-nav-toggle/.test(html), `${rel}: legacy menu toggle gone`);
    }
  }
});

test("the theory wing is down to the travel bar", () => {
  const theoryPages = allPages.filter((rel) => rel.startsWith("theory/"));
  assert.ok(theoryPages.length >= 30, `theory census: ${theoryPages.length}`);
  for (const rel of theoryPages) {
    const html = read(rel);
    if (html.includes("data-travel-bar")) {
      assert.ok(!html.includes("data-sof-header"), `${rel}: no legacy header`);
      assert.ok(!html.includes("data-theory-nav"), `${rel}: no theory secondary nav`);
    }
  }
});

test("the legacy header's deep links are homed on their named surfaces", () => {
  const homes = [
    ["scroll/index.html", ["search.html", "lexicon.html", "atlas.html", "editorial.html"]],
    ["theory.html", ["theory/canon.html", "canon.html"]],
    ["systems/archive.html", ["frequencies.html", "t-7.html", "recoder.html", "mind-renewal.html", "witness.html"]],
    ["codex-atlas.html", [
      "ledger.html", "hub.html", "genesis-oracle.html", "glossary.html", "lab.html",
      "invoke.html", "circle.html", "covenant-caravan.html", "teach.html", "ethics.html",
      "downloads.html", "13-moon-whitepaper.html", "about-aaron.html", "theory.html",
      "systems/archive.html", "moons.html", "shop.html"
    ]]
  ];
  for (const [page, targets] of homes) {
    const html = read(page);
    for (const target of targets) {
      assert.ok(html.includes(target), `${page} homes a link to ${target}`);
    }
  }
});

test("account.html stands inside the one navigation system", () => {
  const html = read("account.html");
  assert.equal((html.match(/data-living-nav/g) || []).length, 1, "one unified nav");
  assert.equal((html.match(/data-travel-bar/g) || []).length, 1, "one travel bar");
  assert.ok(!html.includes('class="rooms"'), "its private rooms nav is replaced, not stacked");
});

test("the fold tool exists and names its exclusions", () => {
  const script = fs.readFileSync(path.join(repoRoot, "scripts/apply-one-nav.mjs"), "utf8");
  for (const excluded of HEADER_SURVIVORS) {
    assert.ok(script.includes(`"${excluded}"`), `apply-one-nav.mjs excludes ${excluded}`);
  }
});
