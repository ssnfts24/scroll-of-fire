// Page programme batch D-small guards (Nov 24, 2026): the audit's small
// refashions hold — retitles, the lemma page's standing content, the word
// studies' next steps, the five-maps order, and the Mind-Renewal check-off.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../docs/${p}`, import.meta.url), "utf8");

test("the witness hash tool's title matches its heading", () => {
  const html = read("systems/witness.html");
  assert.ok(html.includes("<title>Remnant Witness Hash — Scroll of Fire</title>"), "title matches the H1");
  assert.ok(!html.includes("<title>Remnant Witness Ledger"), "the colliding ledger title is gone");
});

test("the practice playbook carries its new name, and the Lab doors to it", () => {
  const guide = read("guide.html");
  assert.ok(guide.includes("Practice Playbook — Practice That Sticks"), "guide retitled");
  assert.ok(!guide.includes("Field Guide — Practice That Sticks"), "the colliding name is gone");
  assert.ok(!guide.includes("Field Guide"), "no Field Guide naming remains on the page's face");
  assert.ok(read("lab.html").includes('href="./guide.html"'), "the Lab links the playbook");
});

test("the lemma page stands with content when JavaScript is off", () => {
  const html = read("scripture/lemma.html");
  assert.ok(html.includes('id="lemma-standing"'), "the standing section stands");
  for (const study of ["adam", "adamah", "enosh", "ruach", "nephesh", "or", "shem"]) {
    assert.ok(html.includes(`word-studies/${study}.html`), `the ${study} study is a standing door`);
  }
});

test("every word study ends with a way onward", () => {
  for (const study of ["adam", "adamah", "enosh", "ruach", "nephesh", "or", "shem"]) {
    const html = read(`scripture/word-studies/${study}.html`);
    assert.ok(html.includes(`id="ws-next-${study}"`), `${study} carries its Where to Next`);
    assert.ok(html.includes("../genesis/"), `${study} doors into the chapter reader`);
  }
  const shem = read("scripture/word-studies/shem.html");
  assert.ok(shem.includes('aria-label="Contents of this study"'), "shem carries its contents jump");
  const adam = read("scripture/word-studies/adam.html");
  const adamah = read("scripture/word-studies/adamah.html");
  assert.ok(adam.includes("A two-step path") && adamah.includes("A two-step path"), "adam and adamah form the two-step path");
});

test("the five maps carry their order on their faces", () => {
  for (const page of ["hub.html", "claims-atlas.html", "codex-atlas.html", "systems/archive.html", "search.html"]) {
    assert.ok(read(page).includes("five-maps-line"), `${page} states the order of the maps`);
  }
});

test("mind-renewal is a check-off now, saved on the device", () => {
  const html = read("systems/mind-renewal.html");
  assert.equal((html.match(/data-mr-day=/g) || []).length, 7, "seven day check-offs");
  assert.ok(html.includes("codex.mindRenewal.v1"), "ticks persist locally");
  assert.ok(html.includes('href="witness.html"'), "the witness door points at the real page");
});

test("install.html keeps its two doors clearly separate", () => {
  const html = read("install.html");
  assert.ok(html.includes('id="app-door-h"'), "door one stands: the Android app");
  assert.ok(html.includes("Living-Phone-App.apk?raw=1"), "door one carries the real download");
  assert.ok(html.includes("Show the Android steps") && html.includes("Show the iPhone and iPad steps"), "the per-platform steps are folded");
  assert.ok(!html.includes("The fuller instrument:"), "the app is no longer a footnote");
});

test("the garden leads with the game, and its rules stand under their heading", () => {
  const html = read("garden.html");
  const lead = html.slice(html.indexOf('id="garden-title"'), html.indexOf('id="garden-county"'));
  assert.ok(lead.includes("that is the whole game"), "the lead is the short form");
  assert.ok(!lead.includes("witnessed on seven of its days"), "the grading detail left the lead");
  const rules = html.slice(html.indexOf('id="garden-grows"'));
  assert.ok(rules.includes("witnessed on seven of its days"), "the grading stands under How the garden grows");
});

test("the shop puts Buy today first and labels every other state", () => {
  const html = read("shop.html");
  assert.ok(html.indexOf('id="buy-today-title"') < html.indexOf('id="gathered-title"'), "buy today precedes the gathered shelf");
  assert.ok(html.indexOf('id="tensor-title"') < html.indexOf('id="gathered-title"'), "the Tensor Bands stand in the buy-today ground");
  assert.ok(html.includes("Read the states plainly"), "the gathered shelf states its states");
  assert.ok(!html.includes("Everything That Can Be Bought or Given, in One Place"), "the overclaiming title is gone");
});

test("the atlas opens with the path in", () => {
  const html = read("codex-atlas.html");
  assert.ok(html.indexOf('id="atlas-start-here-h"') < html.indexOf('data-atlas-filters'), "start here precedes the filters");
});

test("downloads opens with a top shelf and folds the archive behind one door", () => {
  const html = read("downloads.html");
  assert.ok(html.includes('id="top-shelf-h"'), "the top shelf stands");
  assert.ok(html.includes('class="archive-door"'), "the archive stands behind one door");
  assert.ok(html.indexOf('id="top-shelf-h"') < html.indexOf('class="archive-door"'), "the shelf precedes the archive");
  assert.ok(html.includes("63fffe8f8889194504794789c8d55e73c9c843734d321ba4bd9dce4f79191dcd"), "the app's true seal is on the shelf");
});

test("moons names its one flow: read, write, seal", () => {
  const html = read("moons.html");
  assert.ok(html.includes('id="moons-flow-title"'), "the flow strip stands");
  assert.ok(html.includes('href="#flowPanel"'), "the strip doors to the seal");
});

test("the white paper names its sources and method", () => {
  const html = read("codex-white-paper.html");
  assert.ok(html.includes('id="paper-sources-h"'), "the sources section stands");
  assert.ok(html.includes('href="provenance.html"') && html.includes('href="methods.html"'), "both doors are linked");
  assert.ok(read("moons.html").includes('href="./provenance.html"'), "moons doors to provenance too");
});
