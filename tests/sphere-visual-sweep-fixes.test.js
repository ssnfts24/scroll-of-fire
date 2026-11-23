"use strict";

/*
 * Sphere visual sweep fixes (Nov 23, 2026) — structural pins.
 *
 * The sweep (sphere-visual-sweep-2026-11-23.md) photographed the
 * Sphere's defects at phone widths; the fixes that live outside
 * the R1.7 protected set are pinned here at the source level, and
 * their geometry is proven by the lab probe's before/after frames
 * (kept with the sweep's evidence). The three findings whose only
 * source is a protected file — the rim tags and the centre
 * plaque (renderer-3d) and the year card's "temporal membrane"
 * wording (temporal-strata) — are NOT pinned here; they are
 * reported held for Aaron's word on those files.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const adapterCss = read("docs/assets/css/sphere-day-world-adapter.css");
const adapterJs = read("docs/assets/js/sphere-day-world-adapter.js");
const armillaryCss = read("docs/assets/css/sphere-armillary.css");
const ambientJs = read("docs/assets/js/sphere-ambient.js");
const rebuildCss = read("docs/assets/css/sphere-rebuild.css");

test("one owner for the top strip: the year and plans cards retire inside the day", () => {
  // The orientation chip owns the day's name at the day stages;
  // the label layer's pinned cards must not stack into its strip.
  assert.match(adapterCss, /\.sphere-instrument-shell:has\(\.dw-chip\[data-dw-stage="immersive"\]\) \.sphere-semantic-label\[data-semantic-kind="temporal-year"\]/,
    "the selected-year card retires at Immersive Day, clear of the Play pill");
  assert.match(adapterCss, /\.sphere-instrument-shell:has\(\.dw-chip\[data-dw-stage="living"\]\) \.sphere-semantic-label\[data-semantic-kind="temporal-year"\]/,
    "the selected-year card retires at Living Day too — its edge slid under the pill there");
  assert.match(adapterCss, /\.sphere-instrument-shell:has\(\.dw-chip\[data-dw-stage="immersive"\]\) \.sphere-semantic-label\[data-semantic-kind="living-plan-summary"\]/,
    "the plans card retires at Immersive Day");
  assert.match(adapterCss, /\.sphere-instrument-shell:has\(\.dw-chip\[data-dw-stage="living"\]\) \.sphere-semantic-label\[data-semantic-kind="living-plan-summary"\]/,
    "the plans card retires at Living Day, where the chip sliced its last line");
  // The retirement is scoped to the day stages only: the same
  // cards must still be free to stand at the Moon and the years.
  assert.doesNotMatch(adapterCss, /data-dw-stage="moon"\]\) \.sphere-semantic-label/,
    "no retirement reaches the Moon stage");
  assert.doesNotMatch(adapterCss, /data-dw-stage="years"\]\) \.sphere-semantic-label/,
    "no retirement reaches the years line");
});

test("the Play lane stands: the chip still drops beneath the pill at phone widths", () => {
  assert.match(adapterCss, /@media \(max-width: 900px\) \{\s*\.dw-chip \{\s*top: calc\(0\.5rem \+ 40px \+ 0\.75rem\);/,
    "the chip's reserved-lane drop (Phase B) is intact");
});

test("year shells wear a plaque: the numeral stands clear of the wireframe", () => {
  const sprite = adapterJs.slice(adapterJs.indexOf("function makeTextSprite"), adapterJs.indexOf("function makeSymbolSprite"));
  assert.match(sprite, /roundRect/, "the label is drawn on a plaque, not bare on the wireframe");
  assert.match(sprite, /rgba\(12, 8, 5, 0\.85\)/, "the plaque wears the day world's near-black ground");
  assert.match(sprite, /600 62px Georgia/, "the year is drawn at a phone-legible size");
  assert.match(sprite, /32px Georgia/, "the word beneath the year is drawn large enough to read");
});

test("sheet clearance: every room starts below the two-row bar", () => {
  assert.match(armillaryCss, /\.sphere-sidebar > \*,\s*\.sphere-sidebar \[data-sphere-spark-talk\] \{\s*scroll-margin-top: 7\.75rem;/,
    "sheet children and the Spark talk carry the full bar clearance");
  assert.match(armillaryCss, /\.sphere-more-tools \{\s*scroll-margin-top: 7\.75rem;/, "the older 4.5rem allowance is raised to match");
  assert.match(armillaryCss, /\.sphere-day-details \{\s*scroll-margin-top: 7\.75rem;/, "the older 4.5rem allowance is raised to match");
  assert.doesNotMatch(armillaryCss, /scroll-margin-top: 4\.5rem/, "no stale short clearance remains");
  // At 320px the bar wraps taller (151px measured), so the
  // clearance grows on narrow widths.
  assert.match(armillaryCss, /@media \(max-width: 480px\) \{\s*\.sphere-sidebar > \*,\s*\.sphere-sidebar \[data-sphere-spark-talk\],\s*\.sphere-more-tools,\s*\.sphere-day-details \{\s*scroll-margin-top: 12rem;/,
    "narrow widths carry clearance for the taller wrapped bar");
});

test("the caption wraps whole: the two-line clamp that cut it mid-word is gone", () => {
  const clamp = armillaryCss.slice(armillaryCss.indexOf("html.living-time-sphere-page .sphere-rebuild-caption .sphere-ambient-line {"), armillaryCss.indexOf("}", armillaryCss.indexOf("html.living-time-sphere-page .sphere-rebuild-caption .sphere-ambient-line {")));
  assert.doesNotMatch(clamp, /-webkit-line-clamp/, "no line clamp remains on the name line");
  assert.doesNotMatch(clamp, /overflow: hidden/, "the name line no longer hides its own overflow");
  assert.match(clamp, /display: block;/, "the name line is a plain wrapping block");
  // The sentence itself is pinned word-for-word by
  // tests/sphere-ambient.test.js (the audit's own words) and is
  // deliberately unchanged: the fix is that the line may wrap,
  // not that it says less.
  assert.match(ambientJs, /nameLine\.textContent = "A living calendar: 13 moons of 28 days, turning around today\. Tap a moon, then a day, to look at it\.";/,
    "the pinned name line stands unchanged");
});

test("gold discipline: the Spark door wears neutral chrome at rest", () => {
  const spark = rebuildCss.slice(rebuildCss.indexOf(".sphere-rebuild-dock-spark {"), rebuildCss.indexOf("}", rebuildCss.indexOf(".sphere-rebuild-dock-spark {")));
  assert.match(spark, /border-color: var\(--rebuild-line\);/, "the Spark door's border is the neutral line its siblings wear");
  assert.match(spark, /box-shadow: none;/, "the gold glow is gone");
  assert.doesNotMatch(spark, /--rebuild-brass/, "no brass is spent on navigation chrome");
});
