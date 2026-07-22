"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

const ACTIVE_SCAN_ROOTS = [
  "docs/assets/js",
  "docs"
];

const ALLOWED_PATHS = new Set([
  "assets/js/moons.js",
  "docs/CODEX_MAINTENANCE.md",
  "docs/LIVING_CODEX_STATUS.md",
  "docs/LIVING-CODEX-PHASE-1.md",
  "docs/LIVING-CODEX-SHARE-THE-DAY.md",
  "docs/13-MOONS-FINAL-MOBILE-UX.md"
]);

const FILE_EXTENSIONS = new Set([".js", ".html", ".webmanifest"]);

const PROHIBITED = [
  { label: "nearestNewMoonAfter", pattern: /\bnearestNewMoonAfter\b/ },
  { label: "anchorOverrides", pattern: /\banchorOverrides\b/ },
  { label: "approxAnchor", pattern: /\bapproxAnchor\b/ },
  { label: "mapToRemnant", pattern: /\bmapToRemnant\b/ },
  { label: "new Date(y, 2, 20)", pattern: /new\s+Date\(\s*y\s*,\s*2\s*,\s*20\s*\)/ },
  {
    label: "private MOON_NAMES array",
    pattern: /\b(?:const|let|var)\s+MOON_NAMES\s*=\s*(?:\{|\[)/
  }
];

function walk(relativeDir, acc = []) {
  const absDir = path.join(root, relativeDir);
  if (!fs.existsSync(absDir)) return acc;
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    const rel = path.join(relativeDir, entry.name).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      if (rel.startsWith("docs/theory/") || rel.startsWith("docs/systems/archive")) continue;
      walk(rel, acc);
      continue;
    }
    if (FILE_EXTENSIONS.has(path.extname(entry.name))) {
      acc.push(rel);
    }
  }
  return acc;
}

function activeFiles() {
  const files = new Set();
  for (const dir of ACTIVE_SCAN_ROOTS) {
    walk(dir, []).forEach(file => files.add(file));
  }
  files.add("docs/service-worker.js");
  files.add("docs/manifest.webmanifest");
  return [...files]
    .filter(file => fs.existsSync(path.join(root, file)))
    .filter(file => !ALLOWED_PATHS.has(file));
}

test("active app code blocks prohibited legacy calendar signatures", () => {
  const violations = [];

  for (const relativePath of activeFiles()) {
    const source = fs.readFileSync(path.join(root, relativePath), "utf8");
    for (const rule of PROHIBITED) {
      if (rule.pattern.test(source)) {
        violations.push(`${relativePath}: ${rule.label}`);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Prohibited legacy signatures found:\n${violations.join("\n")}`
  );
});
