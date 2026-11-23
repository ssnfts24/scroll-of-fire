"use strict";

/* Spark Activities — Slice 1: Watching (Nov 23, 2026; the
 * activities design approved whole by Aaron the same day).
 *
 * What is pinned here:
 *  - the honest signal: a watch counts only at >=90% played
 *    coverage, at a human pace, with the page present, and the
 *    player's ended event fired — a click, a scrub to the end,
 *    a fast-forward, or a hidden tab earns nothing; two sittings
 *    in one visit add up;
 *  - the record: one "episode-watched" Life Atlas record in the
 *    Story lane, keyed by the episode's distinguisher (bible
 *    §12), carrying the token, the measured hum, and the
 *    Waymaker skill marked "met" — written to the same
 *    repository every other door writes to;
 *  - once per episode per year; a rewatch in the episode's own
 *    Moon in a later year writes only a "met again" line;
 *  - the portrait: breadth of keeping kinds, Spark -> Kindled at
 *    three kinds, never more in this slice, never a rank;
 *  - the fences: keepsakes only (no tallies in any written line),
 *    nothing tradable (shareAllowed false), no network calls in
 *    the module, the Spark never gendered in any written copy,
 *    and no protected page touched — the story layer lazy-loads
 *    the module, so living-time-sphere.html never names it.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const DOCS = path.join(root, "docs");
const JS = path.join(DOCS, "assets/js");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8");

const Activities = require(path.join(JS, "spark-activities.js"));
const Schema = require(path.join(JS, "life-atlas/life-atlas-schema.js"));

/* The real canonical converter, loaded in the site's own order. */
require(path.join(JS, "calendar/pattern-calendar-version.js"));
require(path.join(JS, "calendar/pattern-calendar-data.js"));
require(path.join(JS, "calendar/pattern-calendar-format.js"));
require(path.join(JS, "calendar/pattern-calendar-boundary.js"));
require(path.join(JS, "calendar/pattern-calendar.js"));

const story = JSON.parse(read("docs/assets/data/codex-story.json"));

function temporal(overrides = {}) {
  return {
    instant: "2026-11-23T12:00:00.000Z",
    start: "2026-11-23T12:00:00.000Z",
    end: null,
    timezone: "UTC",
    boundaryMode: "midnight",
    civilDate: "2026-11-23",
    patternYear: 2026,
    moon: 8,
    moonDay: 25,
    patternDay: 221,
    week: null,
    weekGate: null,
    outsideDay: false,
    ...overrides
  };
}

/* Play a tracker honestly: sample every quarter second of media
 * time from `from` to `to`. */
function playThrough(tracker, from, to, options = {}) {
  for (let t = from; t <= to; t += 0.25) {
    tracker.tick(t, { playing: true, rate: 1, visible: true, ...options });
  }
}

/* --------------------------- the episodes --------------------------- */

test("the episode table covers the spine's chapters; every filmed episode is watchable", () => {
  assert.equal(Activities.EPISODES.length, story.chapters.length,
    "the table keys all seventeen trunk chapters by their marks, the gate included");
  const filmed = story.chapters.filter(c => c.episode && c.episode.film);
  assert.equal(filmed.length, 16, "sixteen chapters carry a film on their pages in this slice");
  for (const chapter of filmed) {
    const ep = Activities.episodeByChapterId(chapter.id);
    assert.ok(ep, `${chapter.id} has an activities entry`);
    assert.equal(ep.title, chapter.title, `${chapter.id} title matches the spine`);
    assert.equal(ep.n, chapter.n);
  }
  assert.equal(Activities.episodeByChapterId("the-gate-at-first-light").skill, null,
    "the gate episode is an episode, but the curriculum names no single skill for it");
  assert.equal(Activities.episodeByChapterId("no-such-chapter"), null);
});

test("every distinguisher is name + land + a Set A Moon name + token", () => {
  for (const ep of Activities.EPISODES) {
    assert.ok(Activities.MOON_NAMES_SET_A.includes(ep.moonName), `${ep.chapterId} moon is Set A`);
    assert.ok(ep.title && ep.land && ep.token, `${ep.chapterId} carries its full mark`);
    assert.equal(
      Activities.distinguisherLine(ep),
      `${ep.title} — of ${ep.land}, under ${ep.moonName}, ${ep.token}`
    );
  }
  /* The bible's own worked example shape (§12), on the episode
   * whose token is the fair copy: */
  assert.equal(
    Activities.distinguisherLine(Activities.episodeByChapterId("the-second-book")),
    "The Second Book — of the Desk, under Crown Balance, the fair copy, corrected beneath"
  );
});

test("the hums are the production ledger's measured motifs", () => {
  const hum = id => Activities.episodeByChapterId(id).hum;
  assert.deepEqual([hum("the-road-of-thirteen-moons").rootHz, hum("the-road-of-thirteen-moons").scale], [222, "Hijaz"]);
  assert.deepEqual(hum("the-road-of-thirteen-moons").motifHz, [444, 499.5, 555, 666]);
  assert.deepEqual([hum("the-picture-lesson").rootHz, hum("the-picture-lesson").scale], [210, "minor pentatonic"]);
  assert.deepEqual([hum("the-high-library").rootHz, hum("the-high-library").scale], [196, "Dorian"]);
  assert.deepEqual([hum("the-atlas-room").rootHz, hum("the-atlas-room").scale], [205, "Freygish"]);
  assert.deepEqual(hum("the-atlas-room").motifHz, [205, 307.2, 410, 307.2, 205]);
  for (const ep of Activities.EPISODES) {
    assert.ok(ep.hum.rootHz > 0 && ep.hum.motifHz.length >= 2, `${ep.chapterId} hum is measured, not invented`);
  }
});

test("skills are the bible §11 curriculum marks, state met only", () => {
  const skill = id => Activities.episodeByChapterId(id).skill;
  assert.equal(skill("through-the-day-door").name, "Read the day");
  assert.equal(skill("the-garden-of-thirteen-beds").name, "Wait for the right Moon");
  assert.equal(skill("the-practice-yard").kitMark, "the cup");
  assert.equal(skill("the-atlas-room").name, "Hold both views");
});

/* --------------------------- the coverage --------------------------- */

test("an honest watch through attests: >=90% coverage and ended", () => {
  const tracker = Activities.createWatchTracker(100);
  playThrough(tracker, 0, 100);
  assert.ok(tracker.coverage() >= 0.99);
  assert.equal(tracker.attested(), false, "not attested until the player itself ends");
  tracker.markEnded();
  assert.equal(tracker.attested(), true);
});

test("a scrub to the end earns nothing", () => {
  const tracker = Activities.createWatchTracker(100);
  playThrough(tracker, 0, 5);
  tracker.tick(95, { playing: true, rate: 1, visible: true }); /* the jump */
  playThrough(tracker, 95, 100);
  tracker.markEnded();
  assert.ok(tracker.coverage() < 0.2, `coverage was ${tracker.coverage()}`);
  assert.equal(tracker.attested(), false);
});

test("fast playback does not count toward coverage", () => {
  const tracker = Activities.createWatchTracker(100);
  playThrough(tracker, 0, 100, { rate: 4 });
  tracker.markEnded();
  assert.equal(tracker.coverage(), 0);
  assert.equal(tracker.attested(), false);
  const at2x = Activities.createWatchTracker(100);
  playThrough(at2x, 0, 100, { rate: 2 });
  at2x.markEnded();
  assert.equal(at2x.attested(), true, "2x is the fastest honest pace the design allows");
});

test("a hidden page does not accrue coverage", () => {
  const tracker = Activities.createWatchTracker(100);
  playThrough(tracker, 0, 100, { visible: false });
  tracker.markEnded();
  assert.equal(tracker.coverage(), 0);
  assert.equal(tracker.attested(), false);
});

test("two sittings in the same visit add up — an interrupted keeper is not a cheat", () => {
  const tracker = Activities.createWatchTracker(100);
  playThrough(tracker, 0, 50);
  tracker.breakStretch();
  playThrough(tracker, 50, 100);
  tracker.markEnded();
  assert.equal(tracker.attested(), true);
});

test("eighty-nine percent is not a watch", () => {
  const tracker = Activities.createWatchTracker(100);
  playThrough(tracker, 0, 89);
  tracker.markEnded();
  assert.equal(tracker.attested(), false);
});

/* ---------------------------- the records ---------------------------- */

test("the watch record is a Life Atlas event in the Story lane, keyed by the distinguisher", () => {
  const ep = Activities.episodeByChapterId("the-second-book");
  const record = Activities.buildWatchRecord(ep, temporal());
  assert.equal(record.type, "event");
  assert.equal(record.subtype, "episode-watched");
  assert.ok(record.tags.includes("story"), "the Story lane tag stands on it");
  assert.equal(record.privacy.visibility, "private");
  assert.equal(record.privacy.shareAllowed, false, "nothing earned is tradable or shareable as a record");
  const p = record.payload.sparkActivities;
  assert.equal(p.action, "watch");
  assert.equal(p.coverageAttested, true);
  assert.equal(p.distinguisher.line, "The Second Book — of the Desk, under Crown Balance, the fair copy, corrected beneath");
  assert.equal(p.distinguisher.token, "the fair copy, corrected beneath");
  assert.equal(p.hum.rootHz, 174);
  assert.equal(p.skill.state, "met", "the watch marks the skill met — never earned; practices are a later slice");
  assert.equal(p.skill.name, "Be checked");
  /* It must pass the Atlas schema's own normalisation. */
  const normalised = Schema.normalizeLifeRecord(record);
  assert.equal(normalised.type, "event");
  assert.equal(normalised.subtype, "episode-watched");
});

test("the met-again record stands beside the watch, never instead of it", () => {
  const ep = Activities.episodeByChapterId("the-practice-yard");
  const record = Activities.buildMetAgainRecord(ep, temporal({ patternYear: 2027, moon: 6 }));
  const p = record.payload.sparkActivities;
  assert.equal(p.action, "met-again");
  assert.equal(p.episodeId, "the-practice-yard");
  assert.equal(p.hum, undefined, "a met-again line carries no second hum");
  assert.equal(p.skill, undefined, "and no second skill mark");
});

/* ----------------------------- the plan ----------------------------- */

test("planWatch: first watch writes; same year writes nothing", () => {
  const ep = Activities.episodeByChapterId("the-practice-yard"); /* Fire Trial */
  assert.equal(Activities.planWatch([], ep, temporal()).action, "watch");
  const existing = [Activities.buildWatchRecord(ep, temporal())];
  assert.equal(Activities.planWatch(existing, ep, temporal()).action, "none");
});

test("planWatch: a later year in the episode's own Moon writes met-again, once", () => {
  const ep = Activities.episodeByChapterId("the-practice-yard"); /* under Fire Trial = Moon 6 */
  const existing = [Activities.buildWatchRecord(ep, temporal({ patternYear: 2026 }))];
  const nextYearFireTrial = temporal({ patternYear: 2027, moon: 6, moonDay: 3, patternDay: 143, civilDate: "2027-09-03" });
  assert.equal(Activities.planWatch(existing, ep, nextYearFireTrial).action, "met-again");
  const wrongMoon = temporal({ patternYear: 2027, moon: 8, civilDate: "2027-11-23" });
  assert.equal(Activities.planWatch(existing, ep, wrongMoon).action, "none", "a later year outside its Moon is an ordinary rewatch");
  const withAgain = [...existing, Activities.buildMetAgainRecord(ep, nextYearFireTrial)];
  assert.equal(Activities.planWatch(withAgain, ep, nextYearFireTrial).action, "none", "met again is written once per year");
});

/* ------------------------------ the folds ------------------------------ */

test("foldWatches derives the tokens, the hums, and the met-again years from the records alone", () => {
  const ep = Activities.episodeByChapterId("the-practice-yard");
  const records = [
    Activities.buildWatchRecord(ep, temporal({ patternYear: 2026 })),
    Activities.buildMetAgainRecord(ep, temporal({ patternYear: 2027, moon: 6 })),
    { type: "event", subtype: "garden-planting", payload: { patternGarden: {} }, temporal: temporal() }
  ];
  const fold = Activities.foldWatches(records);
  assert.equal(fold.tokenCount, 1);
  assert.equal(fold.tokens[0].token, "the cup");
  assert.deepEqual(fold.tokens[0].metAgainYears, [2027]);
  assert.equal(fold.tokens[0].skill.state, "met");
  const hums = Activities.humRepertoire(records);
  assert.equal(hums.length, 1);
  assert.equal(hums[0].rootHz, 174);
  assert.deepEqual(hums[0].motifHz, [174, 232.7, 261, 232.7]);
});

/* ---------------------------- the portrait ---------------------------- */

test("the portrait is breadth of kinds: three kinds kindle it, and this slice goes no further", () => {
  const ep = Activities.episodeByChapterId("the-practice-yard");
  const day = { type: "event", subtype: "day-note", payload: {}, temporal: temporal() };
  const bed = { type: "event", subtype: "garden-planting", payload: {}, temporal: temporal() };
  const watch = Activities.buildWatchRecord(ep, temporal());
  const quest = { type: "event", subtype: "quest-answer", payload: {}, temporal: temporal() };

  assert.equal(Activities.portraitFromRecords([]).stageName, "Spark");
  assert.equal(Activities.portraitFromRecords([day, watch]).stageName, "Spark");
  assert.equal(Activities.portraitFromRecords([day, watch]).kindCount, 2);
  const kindled = Activities.portraitFromRecords([day, bed, watch]);
  assert.equal(kindled.stageName, "Kindled");
  assert.equal(kindled.kindCount, 3);
  /* Many of one kind paint no more than one of it. */
  assert.equal(Activities.portraitFromRecords([watch, watch, watch]).kindCount, 1);
  /* Slice 1's span only: even a full record paints no stage past Kindled here. */
  assert.equal(Activities.portraitFromRecords([day, bed, watch, quest]).stageName, "Kindled");
});

/* ------------------------------ the fences ------------------------------ */

test("no network machinery anywhere in the module", () => {
  const src = read("docs/assets/js/spark-activities.js");
  assert.ok(!/fetch\s*\(/.test(src), "no fetch");
  assert.ok(!/XMLHttpRequest/.test(src), "no XHR");
  assert.ok(!/sendBeacon/.test(src), "no beacon");
  assert.ok(!/WebSocket/.test(src), "no socket");
  assert.ok(!/EventSource/.test(src), "no event source");
});

test("no tally language in anything the module writes", () => {
  const ep = Activities.episodeByChapterId("the-practice-yard");
  const written = [
    Activities.buildWatchRecord(ep, temporal()),
    Activities.buildMetAgainRecord(ep, temporal()),
    Activities.portraitFromRecords([Activities.buildWatchRecord(ep, temporal())])
  ];
  const text = JSON.stringify(written).toLowerCase();
  for (const banned of ["point", "score", "streak", "leaderboard", " xp", "level up", "rank"]) {
    assert.ok(!text.includes(banned), `no "${banned}" in written copy`);
  }
});

test("the Spark is never gendered in any copy this slice writes", () => {
  const lines = [];
  for (const ep of Activities.EPISODES) {
    const r = Activities.buildWatchRecord(ep, temporal());
    lines.push(r.title, r.summary);
    lines.push(Activities.buildMetAgainRecord(ep, temporal()).summary);
  }
  lines.push(Activities.portraitFromRecords([]).line);
  const text = lines.join(" ");
  assert.ok(!/\b(she|her|hers|he|him|his)\b/i.test(text.replace(/Their Home/g, "").replace(/the Spark has/g, "")), "no gendered pronoun for the Spark");
});

test("the story layer lazy-loads the module for episodes; no page carries it statically", () => {
  const layer = read("docs/assets/js/story-layer.js");
  assert.ok(layer.includes("assets/js/spark-activities.js"), "the story layer names the module");
  assert.ok(layer.includes("ensureActivities()"), "and lazy-loads it when an episode renders");
  const filmed = story.chapters.filter(c => c.episode && c.episode.film);
  for (const chapter of filmed) {
    const page = read(`docs/${chapter.page}`);
    assert.ok(!page.includes("spark-activities.js"),
      `${chapter.page} carries no static tag — the lazy load keeps its weight budget`);
  }
  const home = read("docs/assets/js/spark-home-world.js");
  assert.ok(home.includes("SparkActivities.foldWatches"), "Their Home folds the watch records into the story corner");
  assert.ok(home.includes("SparkActivities.portraitFromRecords"), "Their Home reads the portrait of keeping");
  assert.ok(home.includes("storyCorner"), "the story corner stands in the home model");
});

test("no protected page is touched: the Sphere page never names the module", () => {
  const page = read("docs/living-time-sphere.html");
  assert.ok(!page.includes("spark-activities"),
    "living-time-sphere.html (R1.7) is untouched by this slice — the episode there earns through the story layer's lazy load, like every other");
});
