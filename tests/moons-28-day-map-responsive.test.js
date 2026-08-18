"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "docs/moons.html"), "utf8");
const css = fs.readFileSync(
  path.join(root, "docs/assets/css/moons-interface.css"),
  "utf8"
);

test("Moons exposes one clearly named canonical 28-Day Moon Map", () => {
  assert.match(html, /28-Day Moon Map/);
  assert.match(html, /id="todaySummaryMoonGrid"/);
  assert.match(html, /aria-label="Select Moon day 1 through 28"/);
});

test("legacy anonymous Moon Days representation is hidden", () => {
  assert.match(html, /class="weekrow legacy-moon-days" hidden/);
  assert.match(css, /\.legacy-moon-days\s*\{[\s\S]*display:\s*none\s*!important/);
});

test("28-day map is a seven-column Moon calendar", () => {
  assert.match(
    css,
    /\.moon-map-grid\.today-summary-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(7/
  );
});

test("phone Sphere details no longer absolutely cover the instrument", () => {
  const phone = css.slice(css.indexOf("@media (max-width: 699px)"));
  assert.match(
    phone,
    /#moons-sphere-today-card \.sphere-today-data\s*\{[\s\S]*position:\s*relative/
  );
  assert.match(
    phone,
    /#moons-sphere-today-preview\s*\{[\s\S]*position:\s*relative\s*!important/
  );
});

test("compact web uses a deliberate two-column command surface", () => {
  assert.match(
    css,
    /@media \(min-width: 700px\) and \(max-width: 1179px\)[\s\S]*grid-template-columns:\s*repeat\(2/
  );
});

test("wide web keeps a deliberate twelve-column composition", () => {
  assert.match(
    css,
    /@media \(min-width: 1180px\)[\s\S]*grid-template-columns:\s*repeat\(12/
  );
});

test("Moon map preserves reduced-motion behavior", () => {
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.moon-map-grid/
  );
});
