/*
 * No trackers: the site ships no Google Analytics.
 *
 * Aaron's ruling (Nov 23, 2026): the Google Analytics tag (G-2TBMEK502C)
 * comes out of every page and stays out — the Front Door promises panel
 * may print its no-trackers line once the last page (the R1.7-protected
 * Sphere page, named below) is cleaned too. The tag had
 * been carried by 72 of 181 pages, in three snippet shapes plus one
 * hand-rolled dynamic loader on the Sphere page; netlify.toml's CSP
 * also allowed the Google analytics hosts, and share-day.js reported
 * share events to gtag whenever it happened to be present.
 *
 * This test is the guard: if any page, script, or config file under
 * docs/ (or netlify.toml) carries the measurement ID or the gtag
 * loader again — by hand or by regeneration — the suite fails.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const docsDir = path.join(root, "docs");

const TEXT_EXT = new Set([".html", ".js", ".json", ".css", ".md", ".txt", ".xml", ".webmanifest", ".svg"]);
const FORBIDDEN = ["G-2TBMEK502C", "googletagmanager.com", "google-analytics.com"];

function walk(dir, prefix = "") {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(path.join(dir, entry.name), rel));
    else if (entry.isFile() && TEXT_EXT.has(path.extname(entry.name).toLowerCase())) out.push(rel);
  }
  return out;
}

/*
 * The one named exception: docs/living-time-sphere.html is an R1.7
 * protected file, and its hand-rolled GA loader sits inside the
 * protected page itself. This PR removes the tracker everywhere the
 * protected set does not reach; the Sphere page's loader (16 lines in
 * its <head>, nothing else) comes out the moment Aaron opens the
 * protected set for it, as he has for named repairs before. Until
 * then this test pins the exception to exactly that one file, so it
 * can never silently grow.
 */
const PROTECTED_EXCEPTION = "living-time-sphere.html";

test("no Google Analytics ID or loader anywhere under docs/ outside the one protected page", () => {
  const offenders = [];
  const exceptionHits = [];
  for (const rel of walk(docsDir)) {
    const text = fs.readFileSync(path.join(docsDir, rel), "utf8");
    for (const needle of FORBIDDEN) {
      if (!text.includes(needle)) continue;
      if (rel === PROTECTED_EXCEPTION) exceptionHits.push(needle);
      else offenders.push(`${rel} contains ${needle}`);
    }
  }
  assert.deepEqual(offenders, []);
  // The exception is exactly the protected Sphere page, still carrying
  // its loader until the protected set is opened for its removal.
  assert.ok(exceptionHits.length > 0, "protected exception file changed — update this test with its removal PR");
});

test("netlify.toml CSP grants no Google Analytics hosts", () => {
  const toml = fs.readFileSync(path.join(root, "netlify.toml"), "utf8");
  for (const needle of FORBIDDEN.slice(1)) {
    assert.ok(!toml.includes(needle), `netlify.toml still allows ${needle}`);
  }
});

test("share-day.js keeps its on-device record but reports nothing to gtag", () => {
  const js = fs.readFileSync(path.join(docsDir, "assets/js/share-day.js"), "utf8");
  assert.ok(!js.includes("gtag"), "share-day.js still references gtag");
  assert.match(js, /CodexMemory\.recordAction/);
});
