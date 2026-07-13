#!/usr/bin/env node
/**
 * Scroll of Fire — Codex Data Validator
 * File: scripts/validate-codex-data.js
 *
 * Usage:  node scripts/validate-codex-data.js
 *
 * Validates:
 *   docs/assets/data/codex-updates.json
 *   docs/assets/data/moons.json
 *   docs/assets/data/field-notes.json   (if present)
 *   docs/assets/data/artifacts.json     (if present)
 *
 * Does not require any npm packages beyond Node.js built-ins.
 */

"use strict";

const fs   = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

/* ------------------------------------------------------------------
   Helper: load JSON from a file path relative to the repo root.
   Returns null if the file does not exist, throws on parse error.
------------------------------------------------------------------ */
function loadJSON(relPath) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) return null;
  try {
    return JSON.parse(fs.readFileSync(abs, "utf8"));
  } catch (err) {
    throw new Error("JSON parse error in " + relPath + ": " + err.message);
  }
}

/* ------------------------------------------------------------------
   Helper: report an error and increment a counter.
------------------------------------------------------------------ */
let errorCount = 0;
let warnCount  = 0;

function fail(file, msg) {
  console.error("  [ERROR] " + file + ": " + msg);
  errorCount++;
}

function warn(file, msg) {
  console.warn ("  [WARN]  " + file + ": " + msg);
  warnCount++;
}

/* ------------------------------------------------------------------
   Helper: check whether a string looks like a valid ISO date YYYY-MM-DD.
------------------------------------------------------------------ */
function isValidDate(str) {
  if (typeof str !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(str + "T00:00:00Z");
  return !isNaN(d.getTime());
}

/* ------------------------------------------------------------------
   Validate: codex-updates.json
------------------------------------------------------------------ */
function validateCodexUpdates(relPath) {
  const data = loadJSON(relPath);
  if (data === null) {
    warn(relPath, "File not found — skipping.");
    return;
  }

  console.log("Checking " + relPath + " ...");

  if (!Array.isArray(data)) {
    fail(relPath, "Root value must be an array.");
    return;
  }

  const VALID_TYPES = new Set([
    "system", "calendar", "artifact", "build log",
    "field note", "theory", "caravan", "update"
  ]);

  const seenIds = new Set();

  data.forEach(function (item, idx) {
    const ref = "[" + idx + "]";

    if (typeof item !== "object" || item === null) {
      fail(relPath, ref + " Entry is not an object.");
      return;
    }

    /* Required fields */
    if (!item.date) {
      fail(relPath, ref + " Missing required field: date.");
    } else if (!isValidDate(item.date)) {
      fail(relPath, ref + " Invalid date format: " + item.date + " (expected YYYY-MM-DD).");
    }

    if (!item.title || typeof item.title !== "string" || !item.title.trim()) {
      fail(relPath, ref + " Missing or empty required field: title.");
    }

    /* Type validation */
    if (item.type && !VALID_TYPES.has(item.type)) {
      warn(relPath, ref + " Unknown type: " + item.type + ". Valid types: " + Array.from(VALID_TYPES).join(", "));
    }

    /* Duplicate ID check (if id field is present) */
    if (item.id) {
      if (seenIds.has(item.id)) {
        fail(relPath, ref + " Duplicate id: " + item.id);
      }
      seenIds.add(item.id);
    }

    /* URL check — internal paths should not be absolute external URLs */
    if (item.url && typeof item.url === "string") {
      if (item.url.startsWith("http://")) {
        warn(relPath, ref + " url uses http:// — consider https://.");
      }
    }
  });

  console.log("  " + data.length + " entries checked.");
}

/* ------------------------------------------------------------------
   Validate: moons.json
------------------------------------------------------------------ */
function validateMoonsJSON(relPath) {
  const data = loadJSON(relPath);
  if (data === null) {
    warn(relPath, "File not found — skipping.");
    return;
  }

  console.log("Checking " + relPath + " ...");

  if (!Array.isArray(data)) {
    fail(relPath, "Root value must be an array of moon objects.");
    return;
  }

  const seenMoonNumbers = new Set();

  data.forEach(function (item, idx) {
    const ref = "[" + idx + "]";

    if (typeof item !== "object" || item === null) {
      fail(relPath, ref + " Entry is not an object.");
      return;
    }

    /* moons.json uses 'idx' (0-based moon index) */
    const moonField = item.moon !== undefined ? "moon" : item.idx !== undefined ? "idx" : null;
    if (!moonField) {
      fail(relPath, ref + " Missing moon index field (expected 'moon' or 'idx').");
    } else {
      const n = Number(item[moonField]);
      if (isNaN(n)) {
        fail(relPath, ref + " Moon index is not a number: " + item[moonField]);
      }
      if (seenMoonNumbers.has(n)) {
        fail(relPath, ref + " Duplicate moon index: " + n);
      }
      seenMoonNumbers.add(n);
    }

    if (!item.name || typeof item.name !== "string" || !item.name.trim()) {
      warn(relPath, ref + " Missing or empty moon name.");
    }
  });

  console.log("  " + data.length + " moon entries checked.");
}

/* ------------------------------------------------------------------
   Validate: field-notes.json (if present)
------------------------------------------------------------------ */
function validateFieldNotes(relPath) {
  const data = loadJSON(relPath);
  if (data === null) return; /* Optional file */

  console.log("Checking " + relPath + " ...");

  if (!Array.isArray(data)) {
    fail(relPath, "Root value must be an array.");
    return;
  }

  const seenIds = new Set();

  data.forEach(function (item, idx) {
    const ref = "[" + idx + "]";

    if (!item.id) {
      warn(relPath, ref + " Missing id field.");
    } else {
      if (seenIds.has(item.id)) {
        fail(relPath, ref + " Duplicate id: " + item.id);
      }
      seenIds.add(item.id);
    }

    if (!item.date) {
      fail(relPath, ref + " Missing required field: date.");
    } else if (!isValidDate(item.date)) {
      fail(relPath, ref + " Invalid date format: " + item.date);
    }

    if (!item.title || !item.title.trim()) {
      fail(relPath, ref + " Missing or empty title.");
    }
  });

  console.log("  " + data.length + " field-note entries checked.");
}

/* ------------------------------------------------------------------
   Validate: artifacts.json (if present)
------------------------------------------------------------------ */
function validateArtifacts(relPath) {
  const data = loadJSON(relPath);
  if (data === null) return; /* Optional file */

  console.log("Checking " + relPath + " ...");

  if (!Array.isArray(data)) {
    fail(relPath, "Root value must be an array.");
    return;
  }

  const seenIds = new Set();

  data.forEach(function (item, idx) {
    const ref = "[" + idx + "]";

    if (!item.id) {
      warn(relPath, ref + " Missing id field.");
    } else {
      if (seenIds.has(item.id)) {
        fail(relPath, ref + " Duplicate id: " + item.id);
      }
      seenIds.add(item.id);
    }

    if (!item.name || typeof item.name !== "string" || !item.name.trim()) {
      fail(relPath, ref + " Missing or empty name.");
    }

    if (item.dateAdded && !isValidDate(item.dateAdded)) {
      fail(relPath, ref + " Invalid dateAdded format: " + item.dateAdded);
    }
  });

  console.log("  " + data.length + " artifact entries checked.");
}

/* ------------------------------------------------------------------
   Run all checks
------------------------------------------------------------------ */
console.log("=== Codex Data Validator ===\n");

try {
  validateCodexUpdates("docs/assets/data/codex-updates.json");
  validateMoonsJSON    ("docs/assets/data/moons.json");
  validateFieldNotes   ("docs/assets/data/field-notes.json");
  validateArtifacts    ("docs/assets/data/artifacts.json");
} catch (err) {
  console.error("\nFatal error:", err.message);
  process.exit(1);
}

console.log("\n=== Result ===");
if (errorCount === 0 && warnCount === 0) {
  console.log("All checks passed. No errors or warnings.");
} else {
  if (errorCount > 0) console.error(errorCount + " error(s) found.");
  if (warnCount  > 0) console.warn (warnCount  + " warning(s) found.");
}

process.exit(errorCount > 0 ? 1 : 0);
