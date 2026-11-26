/*
 * The Spark-led introduction (Aaron, Nov 26, 2026): one flow —
 * the guide leads the visitor to the meeting, and the moment a
 * record stands, the keeper's own Spark leads the tour. The
 * fences pinned here: the guide is plainly a guide; the tour
 * never creates or alters a Spark record; what is coming is
 * labelled as coming, never as live; the tour plays once and
 * Skip is always there; the words are on screen.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const intro = read("docs/assets/js/spark-intro.js");

test("the guide is plainly a guide, never the visitor's Spark", () => {
  assert.match(intro, /I am a guide Spark — not yours, a guide/);
  assert.match(intro, /guideCompanion/);
});

test("the tour never writes the Spark record — the meeting is not its business", () => {
  assert.ok(!/setItem\(Core\.STORAGE_KEY/.test(intro), "no write to sof.spark.v1");
  assert.ok(!/newRecord|recordFromPassport/.test(intro), "no mint machinery");
});

test("the road ahead is labelled honestly: on its way, never live", () => {
  for (const name of ["Spark. Living Day", "SPARK! Wake the World", "PayBack"]) {
    assert.ok(intro.includes(name), name + " is named");
  }
  const roadScene = intro.slice(intro.indexOf("Down the road"));
  assert.match(roadScene, /on its way/);
  assert.ok(!/now live|is live|download now/i.test(roadScene));
});

test("plays once, skippable, and lives on as a Show me", () => {
  assert.match(intro, /sof\.spark\.intro\.v1/);
  assert.match(intro, /markSeen\(\)/);
  assert.match(intro, /spark-tour-skip/);
  assert.match(intro, /Skip/);
  for (const page of ["docs/index.html", "docs/companions.html"]) {
    const html = read(page);
    assert.ok(html.includes('id="spark-intro-show"'), page + " carries the Show me");
    assert.ok(html.includes("spark-intro.js?v=20261126-1"), page + " loads the tour");
    assert.ok(html.includes("spark-intro.css?v=20261126-1"), page + " loads the tour styles");
  }
});

test("the tour demonstrates by doing: voice, day, Sphere, card, home", () => {
  assert.match(intro, /This is my voice/);
  assert.match(intro, /You are standing in Moon/);
  assert.match(intro, /sphereSceneSVG/);
  assert.match(intro, /Cards are found by doing the work/);
  assert.match(intro, /Their Home, and the Hearth/);
  assert.match(intro, /aria-live="polite"/); // the words are on screen
});

test("the figure travels the stage — movement is part of the demonstration", () => {
  assert.match(intro, /pos-left/);
  assert.match(intro, /pos-right/);
  const css = read("docs/assets/css/spark-intro.css");
  assert.match(css, /transition: left 0\.9s/);
  assert.match(css, /prefers-reduced-motion/);
});
