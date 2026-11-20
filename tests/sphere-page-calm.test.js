"use strict";

/* Sphere page calm pass (Nov 19, 2026) — the two presentational fixes
 * from the sphere-page improvement audit (F7 camera pills, F8 whole-word
 * coordinate table) live as overrides in observatory-workspace.css, the
 * sphere page's own workspace sheet, which loads after the protected
 * stylesheet. These tests pin the overrides and the fence: the calm pass
 * touches no protected file's rules and adds no wide min-width. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const css = read("docs/assets/css/observatory-workspace.css");
const calm = css.slice(css.indexOf("Sphere page calm pass"));

test("calm pass is present and phone-scoped", () => {
  assert.ok(calm.length > 0, "calm pass section missing");
  assert.ok(calm.includes("@media (max-width: 640px)"));
  assert.equal(css.includes("min-width: 720px"), false);
});

test("F7: camera presets become one row of compact pills on phone", () => {
  assert.ok(calm.includes(".sphere-camera-controls .sphere-cam-btn"));
  assert.ok(/\.sphere-cam-btn\s*\{[^}]*flex:\s*1 1 0/.test(calm));
  assert.ok(/\.sphere-cam-btn\s*\{[^}]*border-radius:\s*999px/.test(calm));
  assert.ok(/\.sphere-camera-controls\s*\{[^}]*flex-wrap:\s*nowrap/.test(calm));
});

test("F8: coordinate table scrolls whole and keeps field names unbroken", () => {
  assert.ok(/\.sphere-coordinate-table\s*\{[^}]*overflow-x:\s*auto/.test(calm));
  assert.ok(/\.sphere-coordinate-table\s*\{[^}]*table-layout:\s*auto/.test(calm));
  assert.ok(/td:first-child\s*\{[^}]*white-space:\s*nowrap/.test(calm));
  assert.ok(/td:first-child\s*\{[^}]*word-break:\s*normal/.test(calm));
});

test("the calm pass overrides presentation only — no geometry or layout of the instrument", () => {
  for (const banned of ["sphere-container", "living-time-sphere-3d", "sphere-moon-label", "sphere-anchored"]) {
    assert.equal(calm.includes(banned), false, `calm pass must not touch ${banned}`);
  }
});
