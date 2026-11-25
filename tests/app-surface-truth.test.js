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

/*
 * The capability-claim guard, extended (full-page audit,
 * Nov 24, 2026, cross-cutting resolution 2: "the staleness
 * class, killed as a class"). The audit found the same fault
 * four times — a page promising what the system no longer
 * (or does not yet) do. Each dead claim below was live once
 * and was removed by hand; this test refuses to let any of
 * them back in. Dated log entries are history and are NOT
 * policed — the guard binds present-tense promises only.
 */
const garden = readFileSync(
  new URL("../docs/garden.html", import.meta.url), "utf8");
const account = readFileSync(
  new URL("../docs/account.html", import.meta.url), "utf8");

test("the garden does not promise the removed Shroom Search passes", () => {
  assert.ok(!garden.includes("see your passes below"),
    "Aaron removed the passes on Nov 20 — the garden must not point at them");
});

test("no surface calls the app wholly offline or account-free", () => {
  assert.ok(!index.includes("works wholly offline"),
    "the app carries INTERNET since Gate G — the homepage must not overstate");
  assert.ok(!downloads.includes("wholly offline, no account"),
    "downloads must not call the app wholly offline or account-free");
});

test("the account page keeps its promise honest", () => {
  assert.ok(account.includes("Accounts are not yet open"),
    "until the store is configured, the account page must say so on its face");
  assert.ok(!account.includes("and your record follows you"),
    "the present-tense sign-in promise stays off the page until it can be kept");
});

test("the theory doorway merges hold: stubs redirect and the folds stand whole", () => {
  const readDoc = (rel) =>
    readFileSync(new URL(`../docs/${rel}`, import.meta.url), "utf8");
  const stubs = [
    ["theory/ethics.html", "ethics.html"],
    ["theory/glossary.html", "glossary.html"],
    ["theory/witness.html", "witness.html"],
    ["theory/frequency-governance.html", "systems/frequencies.html"]
  ];
  for (const [stub, target] of stubs) {
    const html = readDoc(stub);
    assert.match(html, /http-equiv="refresh"/, `${stub} must stay a redirect stub`);
    assert.ok(html.includes(target), `${stub} must point at ${target}`);
    assert.ok(!html.includes("data-living-nav"), `${stub} carries no living nav`);
  }
  assert.ok(readDoc("ethics.html").includes("Ethical Law is a gate, not a decorative score."),
    "the Ethical Law theory must stand on the Ethics page");
  assert.ok(readDoc("glossary.html").includes('id="symbol-index"'),
    "the Symbol Index must stand in the Glossary");
  assert.ok(readDoc("witness.html").includes("The Witness Protocol"),
    "the discipline of witness must stand on the Witness page");
  assert.ok(readDoc("systems/frequencies.html").includes("The Harmonic Gate decides what enters."),
    "Frequency Governance must stand in the Sound Observatory");
});
