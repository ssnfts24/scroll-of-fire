/*
 * App-surface truth — the staleness class fix (selling-point
 * audit, Nov 24, 2026, cross-cutting item: "any surface that
 * names a version, a permission, or a capability gets a line
 * in the landing checklist for the release that changes it").
 *
 * The homepage's app section once kept selling v0.3.0 — "no
 * account and no internet" — two full releases after Gate G
 * changed both facts. It was the third incident of the class
 * (the app bundle's stale Sphere was the second). This test
 * is the checklist, made mechanical: the surfaces that name
 * the app's version and seal must agree with the file they
 * actually serve, and the dead claims must stay dead.
 *
 * When a future release replaces the APK, this test fails
 * until the surfaces are updated to the new file's truth —
 * which is the point.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";

const APK = "3_Living_Technology/Living-Phone-App.apk";
const apkBytes = readFileSync(new URL(`../${APK}`, import.meta.url));
const apkSha = createHash("sha256").update(apkBytes).digest("hex");
const apkMb = (statSync(new URL(`../${APK}`, import.meta.url)).size / 1048576)
  .toFixed(2);

const index = readFileSync(new URL("../docs/index.html", import.meta.url), "utf8");
const downloads = readFileSync(
  new URL("../docs/downloads.html", import.meta.url), "utf8");

test("the served APK's seal is the seal the Downloads page prints", () => {
  assert.ok(downloads.includes(apkSha),
    "downloads.html must print the served APK's true SHA-256");
  const row = downloads.match(/Living-Phone-App\.apk[\s\S]{0,400}/);
  assert.ok(row, "downloads.html carries the Living Day row");
  assert.ok(row[0].includes(`${apkMb} MB`),
    "the row's size must be the served file's true size");
});

test("the homepage names the same build the file is", () => {
  const section = index.match(
    /id="living-phone-app"[\s\S]{0,4000}/);
  assert.ok(section, "the homepage carries the app section");
  assert.ok(section[0].includes("version 1.0.1"),
    "the section names the standing build's version");
  assert.ok(section[0].includes(`${apkMb} MB`),
    "the section's size is the served file's true size");
});

test("the dead claims stay dead", () => {
  const section = index.match(
    /id="living-phone-app"[\s\S]{0,4000}/)[0];
  for (const stale of [
    "0.3.0", "coming soon", "Coming soon",
    "no account and no internet", "photos by day",
  ]) {
    assert.ok(!section.includes(stale),
      `the app section must not say "${stale}" — Gate G changed it`);
  }
});
