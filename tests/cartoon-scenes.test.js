/* cartoon-scenes.test.js — the cartoon exploration pass (Nov 20, 2026).
 *
 * Aaron: "Is there other cartoons around the site? … make some
 * more of those cartoons around. Like a exploration." The rules
 * pinned here: every scene exists as a phone-sized still, is
 * lazy-loaded (never on a page's first-screen critical path),
 * carries alt text that states its mapping, and stands only at a
 * real doorway whose subject it maps — never on Scripture or
 * Evidence surfaces (the #198 refusal logic).
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const bytes = (p) => fs.statSync(path.join(root, p)).size;

const SCENES = [
  { file: "docs/assets/img/cartoon/cartoon-companions.webp", page: "docs/companions.html", maps: "companions travelling together" },
  { file: "docs/assets/img/cartoon/cartoon-moons-road.webp", page: "docs/moons.html", maps: "the year walked moon by moon" },
  { file: "docs/assets/img/cartoon/cartoon-garden.webp", page: "docs/garden.html", maps: "this garden's real beds" },
  { file: "docs/assets/img/cartoon/cartoon-setting-out.webp", page: "docs/downloads.html", maps: "taking the work with you" },
  { file: "docs/assets/img/cartoon/cartoon-witness-desk.webp", page: "docs/witness.html", maps: "the Witness's desk" },
];

test("every placed scene exists, is phone-sized, lazy, and carries its mapping as alt text", () => {
  for (const s of SCENES) {
    assert.ok(fs.existsSync(path.join(root, s.file)), `${s.file} exists`);
    assert.ok(bytes(s.file) < 200_000, `${s.file} is under 200 KB (actual ${bytes(s.file)})`);
    const page = read(s.page);
    assert.ok(page.includes(path.basename(s.file)), `${s.page} places the scene`);
    assert.ok(page.includes('loading="lazy"'), `${s.page} lazy-loads it`);
    assert.ok(page.includes("cartoon-scenes.css"), `${s.page} carries the shared scene treatment`);
  }
});

test("the Day World doorway scene rides the Sphere page layer", () => {
  const layer = read("docs/assets/js/sphere-armillary.js");
  assert.ok(layer.includes("cartoon-day-door.webp"), "the Day World scene is the day-door still");
  assert.ok(layer.includes("day-world-scene"), "it is set at the Day World room's head");
  assert.ok(fs.existsSync(path.join(root, "docs/assets/img/cartoon/cartoon-day-door.webp")), "the still exists");
  assert.ok(bytes("docs/assets/img/cartoon/cartoon-day-door.webp") < 200_000, "and is phone-sized");
});

test("the Witness page keeps its honest label with the scene on it", () => {
  const page = read("docs/witness.html");
  assert.ok(page.includes("written and tended by an AI"), "the caption keeps the page's honesty about itself");
  assert.ok(page.includes("an illustration, not a photograph"), "the scene is labeled an illustration");
});

test("no cartoon scene stands on a Scripture or Evidence surface", () => {
  for (const page of ["docs/scroll.html", "docs/evidence.html", "docs/claims-atlas.html"]) {
    const full = path.join(root, page);
    if (!fs.existsSync(full)) continue;
    assert.ok(!read(page).includes("cartoon-scene"), `${page} carries no cartoon scene`);
  }
});
