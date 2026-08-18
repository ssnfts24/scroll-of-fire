"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const css = fs.readFileSync(
  path.join(root, "docs/assets/css/moons-interface.css"),
  "utf8"
);

test("Moons has physical-touch fallback for Desktop site mode", () => {
  assert.match(css, /@media \(pointer: coarse\), \(hover: none\)/);
});

test("touch fallback forces Today command surface to one column", () => {
  const block = css.slice(css.lastIndexOf("@media (pointer: coarse), (hover: none)"));

  assert.match(
    block,
    /#todayPanel\.today-command-surface\.active[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important/
  );
});

test("touch fallback makes embedded Sphere full width and non-overlay", () => {
  const block = css.slice(css.lastIndexOf("@media (pointer: coarse), (hover: none)"));

  assert.match(
    block,
    /#moons-sphere-today-preview[\s\S]*position:\s*relative\s*!important[\s\S]*width:\s*100%\s*!important/
  );

  assert.match(
    block,
    /#moons-sphere-today-card \.sphere-today-data[\s\S]*position:\s*relative\s*!important[\s\S]*width:\s*100%\s*!important/
  );
});

test("touch fallback prevents tab artwork from becoming a narrow rail", () => {
  const block = css.slice(css.lastIndexOf("@media (pointer: coarse), (hover: none)"));

  assert.match(
    block,
    /\.tabPanel\.active > img[\s\S]*width:\s*100%\s*!important/
  );
});

test("touch fallback preserves horizontally scrollable tab strip", () => {
  const block = css.slice(css.lastIndexOf("@media (pointer: coarse), (hover: none)"));

  assert.match(
    block,
    /\.tabs\[aria-label="Calendar tools"\][\s\S]*overflow-x:\s*auto\s*!important/
  );
});
