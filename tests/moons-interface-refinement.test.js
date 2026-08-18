"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

const html = fs.readFileSync(
  path.join(ROOT, "docs/moons.html"),
  "utf8"
);

const css = fs.readFileSync(
  path.join(ROOT, "docs/assets/css/moons-interface.css"),
  "utf8"
);

const worker = fs.readFileSync(
  path.join(ROOT, "docs/service-worker.js"),
  "utf8"
);

test("Moons loads the interface refinement after core styles", () => {
  const core = html.indexOf("assets/css/moons.css");
  const refinement = html.indexOf("assets/css/moons-interface.css");

  assert.ok(core >= 0);
  assert.ok(refinement > core);
});

test("Today panel exposes one command-surface layout hook", () => {
  assert.match(
    html,
    /id="todayPanel"\s+class="tabPanel active today-command-surface"/
  );
});

test("canonical Today Sphere is promoted to ambient visual stage", () => {
  assert.match(
    html,
    /id="moons-sphere-today-card" class="card sphere-today-card moons-ambient-stage"/
  );

  assert.match(
    html,
    /id="moons-sphere-today-preview"/
  );
});

test("ambient stage never steals page pointer input", () => {
  assert.match(
    css,
    /#moons-sphere-today-preview[\s\S]*?pointer-events:\s*none/
  );
});

test("Today command surface becomes one column on phones", () => {
  assert.match(
    css,
    /@media \(max-width:\s*640px\)[\s\S]*?#todayPanel\.today-command-surface\.active[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/
  );
});

test("calendar tabs remain horizontally navigable on small screens", () => {
  assert.match(
    css,
    /\.tabs\[aria-label="Calendar tools"\][\s\S]*?overflow-x:\s*auto/
  );

  assert.match(
    css,
    /scroll-snap-type:\s*x proximity/
  );
});

test("new Moons interface CSS is part of mandatory PWA shell", () => {
  assert.match(
    worker,
    /"\.\/assets\/css\/moons-interface\.css"/
  );
});

test("refinement preserves reduced-motion treatment", () => {
  assert.match(
    css,
    /@media \(prefers-reduced-motion:\s*reduce\)/
  );
});
