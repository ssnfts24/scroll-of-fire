"use strict";

/*
 * Gate D app mode (Nov 23, 2026) — PREPARED, held for Aaron's
 * word. Design v3 §3.2 move 8 / §14 call 4 of the Spark. Living
 * Day app rework: the Sphere page renders its own true app mode
 * so the app no longer injects a framing stylesheet into it.
 *
 * This file pins the change's shape:
 *   1. The page carries exactly the three insertions the
 *      protection declaration names — a boot script that sets
 *      the sof-app-mode class before first paint in app context
 *      only, one stylesheet link after the app stylesheet, one
 *      defer script tag beside the app-shell tag — and no other
 *      app-mode wiring.
 *   2. The app-mode module is inert without the class: it
 *      returns before defining anything behaviour-bearing, and
 *      it touches no renderer, calendar, cursor, selection, or
 *      label surface.
 *   3. The app-mode stylesheet gates every rule on
 *      html.sof-app-mode and carries the standing budget: the
 *      three chrome bars absent, the stage filling the given
 *      viewport, the guide bar as a pull-up sheet.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const PAGE = fs.readFileSync(
  path.join(root, "docs/living-time-sphere.html"), "utf8");
const MODULE = fs.readFileSync(
  path.join(root, "docs/assets/js/sphere-app-mode.js"), "utf8");
const CSS = fs.readFileSync(
  path.join(root, "docs/assets/css/sphere-app-mode.css"), "utf8");

test("the page carries the boot mark, set before first paint, app context only", () => {
  assert.match(PAGE, /classList\.add\("sof-app-mode"\)/);
  assert.match(PAGE, /URLSearchParams\(location\.search\)\.has\("sofapp"\)/);
  assert.match(PAGE, /sessionStorage\.getItem\("sofAppMode"\)/);
  // The boot script stands in the head, before the charset and
  // before every stylesheet — the class must exist before the
  // first paint for the framing to be the page's own.
  const bootAt = PAGE.indexOf('classList.add("sof-app-mode")');
  assert.ok(bootAt > -1 && bootAt < PAGE.indexOf('<meta charset'),
    "the app-mode boot script precedes the charset declaration");
  assert.ok(bootAt < PAGE.indexOf('rel="stylesheet"'),
    "the app-mode boot script precedes the first stylesheet");
});

test("the page links the app-mode stylesheet once, after the app stylesheet", () => {
  const link = 'href="assets/css/sphere-app-mode.css?v=20261123-gated"';
  assert.equal(PAGE.split(link).length - 1, 1,
    "exactly one app-mode stylesheet link");
  assert.ok(
    PAGE.indexOf("living-time-sphere-app.css") < PAGE.indexOf(link),
    "the app-mode stylesheet follows the B7.61 app stylesheet");
});

test("the page loads the app-mode module once, beside the app shell", () => {
  const tag = 'src="assets/js/sphere-app-mode.js?v=20261123-gated"';
  assert.equal(PAGE.split(tag).length - 1, 1,
    "exactly one app-mode script tag");
  assert.ok(
    PAGE.indexOf("living-time-sphere-app-shell.js") < PAGE.indexOf(tag),
    "the app-mode module follows the app-shell module");
});

test("the module is inert without the app-mode class", () => {
  assert.match(MODULE, /classList\.contains\("sof-app-mode"\)/);
  const code = MODULE.replace(/\/\*[\s\S]*?\*\//g, "");
  const guardAt = code.indexOf('classList.contains("sof-app-mode")');
  const markerAt = code.indexOf("window.SOFAppMode");
  assert.ok(guardAt > -1 && markerAt > guardAt,
    "the inertness guard precedes the marker definition");
  assert.match(MODULE, /window\.SOFAppMode = \{ name: "living-day", version: "1" \}/);
  assert.match(MODULE, /sof:app-mode-ready/);
});

test("the module touches no instrument surface", () => {
  const code = MODULE.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const forbidden of [
    "LivingTimeSphereRenderer", "PatternCalendar", "SOFTemporalCursor",
    "LivingProjectionBus", "selectDay", "renderer", "camera"
  ]) {
    assert.ok(!code.includes(forbidden),
      `the app-mode module must not reference ${forbidden}`);
  }
});

test("the stylesheet gates every rule on the app-mode class", () => {
  const rules = CSS.split("}")
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.includes("{"));
  assert.ok(rules.length >= 5, "the sheet carries its budget of rules");
  for (const rule of rules) {
    const selector = rule.slice(0, rule.indexOf("{"));
    if (selector.includes("@media")) continue;
    assert.ok(selector.includes("sof-app-mode"),
      `every rule is app-mode gated: ${selector.trim()}`);
  }
});

test("the stylesheet carries the standing chrome budget", () => {
  assert.match(CSS, /#sphere-state-strip/);
  assert.match(CSS, /#sphere-environment-bridge/);
  assert.match(CSS, /\.sphere-interact-bar/);
  assert.match(CSS, /display: none/);
  assert.match(CSS, /\.sphere-guide-bar/);
  assert.match(CSS, /translateY\(calc\(100% - 54px\)\)/);
  assert.match(CSS, /prefers-reduced-motion: reduce/);
});
