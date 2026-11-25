"use strict";

/*
 * The PWA identity consolidation (Nov 25, 2026) — ULS-001-R1 P2,
 * carried out under Aaron's "Start all" order of Nov 25, 2026.
 * This file is the change set's signature in
 * tests/homepage-sphere.test.js.
 *
 * The site carried three installation cards (manifest.webmanifest
 * "Remnant 13 Moons", manifest-site.webmanifest "Codex of
 * Reality", manifest-sphere.webmanifest "Living Time Sphere") —
 * three install identities under one scope, flagged as
 * DUPLICATION_REGISTER D-02. The consolidation leaves exactly
 * one: docs/manifest.webmanifest, carrying the settled identity
 * (name "Codex of Reality", short_name "Codex", the front door
 * as its start), with the Sphere and the moons panels carried as
 * shortcuts inside the one card so no deep link an installed
 * card offered is lost.
 *
 * The change set's only protected-file touch is one <head> line
 * in docs/living-time-sphere.html: its manifest link now names
 * the one card instead of the retired sphere card. No geometry,
 * rendering, camera, motion, selection, label, or calendar file
 * is touched. Every other protected path still fails the guard
 * loudly.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

test("PWA identity: exactly one installation card stands", () => {
  assert.ok(fs.existsSync(path.join(ROOT, "docs/manifest.webmanifest")),
    "the one card exists");
  assert.ok(!fs.existsSync(path.join(ROOT, "docs/manifest-site.webmanifest")),
    "the retired site card is gone");
  assert.ok(!fs.existsSync(path.join(ROOT, "docs/manifest-sphere.webmanifest")),
    "the retired sphere card is gone");
  const manifest = JSON.parse(read("docs/manifest.webmanifest"));
  assert.equal(manifest.name, "Codex of Reality");
  assert.equal(manifest.short_name, "Codex");
  assert.equal(manifest.id, "./index.html");
  assert.equal(manifest.start_url, "./index.html?source=installed");
  assert.equal(manifest.display, "standalone");
});

test("PWA identity: the one card keeps every deep link the three cards offered", () => {
  const manifest = JSON.parse(read("docs/manifest.webmanifest"));
  const urls = manifest.shortcuts.map((s) => s.url);
  for (const kept of [
    "./living-time-sphere.html?source=shortcut",
    "./moons.html?source=shortcut",
    "./moons.html?tab=shabbatPanel",
    "./moons.html?tab=mirrorPanel",
    "./moons.html?tab=witnessPanel",
    "./equinox-passage.html",
    "./episodes.html?source=shortcut",
    "./shop.html?source=shortcut"
  ]) {
    assert.ok(urls.includes(kept), `shortcut kept: ${kept}`);
  }
});

test("PWA identity: the protected Sphere page links the one card, once", () => {
  const page = read("docs/living-time-sphere.html");
  assert.equal(page.split('rel="manifest"').length - 1, 1,
    "exactly one manifest link stands on the protected page");
  assert.ok(page.includes('<link rel="manifest" href="manifest.webmanifest">'),
    "the protected page links the one card");
});
