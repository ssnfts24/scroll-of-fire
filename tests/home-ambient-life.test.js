/* Homepage ambient life — the alive pass on the finished home page.
 *
 * Pins the shape Aaron approved: a cheap, decorative 2D field behind
 * the hero, chosen by the visitor's hour; the existing Spark presence
 * remains the only Spark system; and motion stops for reduced-motion
 * visitors, an off-screen hero, and a hidden tab.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const HTML = fs.readFileSync(path.join(ROOT, "docs/index.html"), "utf8");
const JS = fs.readFileSync(path.join(ROOT, "docs/assets/js/home-ambient-life.js"), "utf8");
const CSS = fs.readFileSync(path.join(ROOT, "docs/assets/css/home-ambient-life.css"), "utf8");

test("the homepage loads one light ambient layer after the Spark presence", () => {
  assert.equal((HTML.match(/home-ambient-life\.js/g) || []).length, 1);
  assert.equal((HTML.match(/home-ambient-life\.css/g) || []).length, 1);
  assert.ok(
    HTML.indexOf("assets/js/home-ambient-life.js") > HTML.indexOf("assets/js/spark-presence.js"),
    "ambient life follows, and does not replace, the existing Spark presence"
  );
  assert.ok(!/SparkCompanion|localStorage|AudioContext/.test(JS), "no second Spark, store, or sound system");
});

test("the visitor's hour chooses pollen by day and fireflies by night", () => {
  assert.match(JS, /new Date\(\)\.getHours\(\)/);
  assert.match(JS, /"pollen"/);
  assert.match(JS, /"fireflies"/);
  assert.match(JS, /canvas\.dataset\.mode = mode/);
});

test("the field is cheap, decorative, and behind the hero", () => {
  assert.match(JS, /getContext\("2d"/);
  assert.match(JS, /Math\.min\(42/);
  assert.match(JS, /Math\.min\(window\.devicePixelRatio \|\| 1, 1\.25\)/);
  assert.ok(!/three|webgl/i.test(JS), "no heavy 3D library or WebGL layer");
  assert.match(CSS, /position: absolute/);
  assert.match(CSS, /z-index: -1/);
  assert.match(CSS, /pointer-events: none/);
});

test("motion pauses off-screen and in a hidden tab, and reduced motion is still", () => {
  assert.match(JS, /IntersectionObserver/);
  assert.match(JS, /visibilitychange/);
  assert.match(JS, /document\.hidden/);
  assert.match(JS, /prefers-reduced-motion: reduce/);
  assert.match(JS, /if \(reducedMotion\) \{\s+draw\(1\.25\);/);
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\)/);
});
