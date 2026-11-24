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
 *
 * Nov 24, 2026 (mobile + manifest workstream): the module
 * gained a second, web-only door — on a phone-width viewport
 * it acquires the app-mode class itself and marks the
 * acquisition sof-mobile-mode, so a phone browser gets the
 * app-mode chrome budget (the three bars absent). The stage's
 * size and the guide's sheet belong to the page's own shell
 * in the protected stylesheet and are not this sheet's to
 * move; they wait on Aaron's word as their own item. The app
 * never carries the mobile mark; its framing is the class
 * gate alone, unchanged.
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

test("the stylesheet gates every rule — app-mode class, or the mobile mark inside its media query", () => {
  // The sanctioned gates (Nov 24, 2026): the app-mode class,
  // exactly as before, and — should a small-screen web rule
  // ever stand here — the sof-mobile-mode mark inside the
  // max-width media query, the only other gate this sheet
  // allows. No rule may stand ungated: nothing in this sheet
  // may restyle the open-web desktop page.
  const clean = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  function blocks(css) {
    const out = [];
    let i = 0;
    while (i < css.length) {
      const open = css.indexOf("{", i);
      if (open === -1) break;
      const prelude = css.slice(i, open).trim();
      let depth = 1, j = open + 1;
      while (j < css.length && depth > 0) {
        if (css[j] === "{") depth++;
        else if (css[j] === "}") depth--;
        j++;
      }
      out.push({ prelude, body: css.slice(open + 1, j - 1) });
      i = j;
    }
    return out;
  }
  let gated = 0;
  for (const block of blocks(clean)) {
    if (block.prelude.startsWith("@media")) {
      const mobileBlock = block.prelude.includes("max-width: 700px");
      for (const inner of blocks(block.body)) {
        assert.ok(
          inner.prelude.includes(mobileBlock ? "sof-mobile-mode" : "sof-app-mode") ||
            inner.prelude.includes("sof-mobile-mode"),
          `every rule inside a media block is gated: ${inner.prelude}`);
        gated++;
      }
    } else {
      assert.ok(block.prelude.includes("sof-app-mode"),
        `every rule is app-mode gated: ${block.prelude}`);
      gated++;
    }
  }
  assert.ok(gated >= 5, "the sheet carries its budget of rules");
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
