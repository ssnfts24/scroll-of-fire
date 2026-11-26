"use strict";

/* Living Look — the Episode Library as the story's front door
 * (episodes.html). Pins the preview's shape: the one token sheet
 * consumed, the Watch shelf as a place with the real day on its
 * face, each film a door, mid-watch resume kept in this layer's own
 * single local record, one clear action, the headline feature kept
 * a FEATURE PRESENTATION and never wired as an episode, and no
 * R1.7 protected file carrying the remake. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const html = read("docs/episodes.html");
const css = read("docs/assets/css/episodes-living.css");
const js = read("docs/assets/js/episodes-living.js");

test("the page wears the one token sheet and the Moon's tint sheet, once each new layer", () => {
  assert.ok(html.includes("assets/css/codex.css"), "codex.css is the token sheet");
  assert.equal((html.match(/living-moon-theme\.css/g) || []).length, 1, "living-moon-theme.css exactly once");
  assert.equal((html.match(/living-moon-theme\.js/g) || []).length, 1, "living-moon-theme.js exactly once");
  assert.equal((html.match(/episodes-living\.css/g) || []).length, 1, "episodes-living.css exactly once");
  assert.equal((html.match(/episodes-living\.js/g) || []).length, 1, "episodes-living.js exactly once");
  assert.ok(css.includes("var(--gold)"), "gold comes from the token sheet");
  assert.ok(css.includes("var(--radius-lg)"), "radii come from the token sheet");
  assert.ok(css.includes("var(--moon-accent"), "the Moon's tint lights the room");
  const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!/#05070d|#08101a|#f3c97a|#d99545|#f4f1e8/i.test(cssNoComments), "no re-declared palette hexes");
});

test("the real day stands on the face, from the canonical calendar only", () => {
  assert.ok(html.includes("episodes-stage"), "the stage stands on the page");
  assert.ok(js.includes("PatternCalendar"), "coordinate read from PatternCalendar");
  assert.ok(js.includes("fromCivilDate"), "through its public converter only");
  assert.ok(js.includes("PatternCalendarData"), "moon names from the site's existing data");
  assert.ok(!/86400000/.test(js), "no private calendar math");
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon/.test(js), "no tracking or fetching");
});

test("the stage stands before the feature, and the one action stands in the stage", () => {
  const stage = html.indexOf("episodes-stage");
  const feature = html.indexOf("library-feature");
  assert.ok(stage > -1 && feature > stage, "the stage stands before the headline feature");
  assert.ok(html.includes('id="episodes-stage-action"'), "the one action stands in the stage");
  assert.ok(html.includes('id="episode-shelf"'), "the shelf itself stands as it always has");
  assert.ok(html.includes("episode-library.js"), "the shelf still renders from the page's own module");
});

test("each film a door: the card takes the door's shape, films untouched", () => {
  assert.ok(css.includes("#episode-shelf .episode-card"), "the shelf's cards take the door treatment");
  assert.ok(css.includes("episode-resume-tag"), "a left film carries its place on its face");
  assert.ok(!/\.mp4|\.webp|poster/.test(js.replace(/\/\*[\s\S]*?\*\//g, "")), "the layer names no film or poster asset");
});

test("memory is mid-watch resume — one local record, and never a watch", () => {
  assert.ok(js.includes("sof.episodes.resume.v1"), "the resume record is this layer's own, named");
  assert.equal((js.match(/localStorage\.setItem/g) || []).length, 1, "one store written, in one place");
  assert.ok(js.includes("RESUME_KEY, JSON.stringify(store)"), "the one write is the resume record");
  assert.ok(js.includes("I kept your place"), "welcome framing");
  assert.ok(!/missed|streak|you have not/i.test(js), "no absence or guilt framing");
  assert.ok(!/foldWatches|LifeAtlas|repository/i.test(js), "the watch record is never read or written here");
});

test("the headline feature stays a feature presentation, never an episode", () => {
  assert.ok(html.includes("Feature presentation"), "the feature keeps its standing on the page");
  assert.ok(html.includes("library-feature"), "the feature section stands as ruled");
  assert.ok(js.includes("episode-shelf"), "the wiring is scoped to the Watch shelf");
  assert.ok(!/library-feature/.test(js), "the living layer never touches the feature");
});

test("chapter text stays as it stands: this layer opens nothing", () => {
  assert.ok(!/details|open\s*=/.test(js), "no chapter or panel is forced open by the layer");
  assert.ok(!/story-layer|chapter/i.test(css), "the layer restyles no chapter surface");
});

test("motion has a still twin", () => {
  assert.ok(css.includes("prefers-reduced-motion: no-preference"), "motion only where motion is welcome");
  assert.ok(css.includes("@media (prefers-reduced-motion: reduce)"), "the still design stands whole");
  assert.ok(js.includes("prefers-reduced-motion: reduce"), "the intro is never injected for reduced motion");
});

test("no R1.7 protected file carries the remake", () => {
  const manifest = read("docs/development/R1.7-PROTECTED-MANIFEST.md");
  for (const rel of [
    "docs/assets/js/episodes-living.js",
    "docs/assets/css/episodes-living.css",
  ]) {
    assert.ok(!manifest.includes(path.basename(rel)), `${rel} is not a protected file`);
  }
  assert.ok(!js.includes("LivingTimeSphere"), "the sphere stack is not touched or driven");
});
