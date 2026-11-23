"use strict";

/*
 * The Evolution Opening — how the Sphere grew, told on the Sphere.
 *
 * Unit coverage for the opening's pure core (the flat calendar
 * grid, the first Sphere's portrait drawn from its own build's
 * code, the spiral formulas, the auto-open rule), plus source
 * guards: the opening presents only — it lives outside the
 * protected set, loads through the companion layer's loader, and
 * reads the page's own public records (PatternCalendar, the
 * Alignment Ledger, the Spark core) without ever reaching into
 * the Sphere's kernel.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const opening = require(path.join(root, "docs/assets/js/sphere-evolution-opening.js"));
const source = fs.readFileSync(path.join(root, "docs/assets/js/sphere-evolution-opening.js"), "utf8");
const companionLayer = fs.readFileSync(path.join(root, "docs/assets/js/sphere-companion-layer.js"), "utf8");

test("the deck is four stages and four tour steps, in Aaron's order", () => {
  assert.deepEqual(opening.STAGES.map((s) => s.id),
    ["calendars", "first-sphere", "sphere-now", "spark"]);
  assert.deepEqual(opening.TOUR_STEPS.map((s) => s.id),
    ["meet", "turn", "rings", "keep"]);
});

test("the calendar grid is 13 moons of 28 days from the real names", () => {
  const names = Array.from({ length: 13 }, (_, i) => `Name ${i + 1}`);
  const grid = opening.buildCalendarGrid({ moonNames: names, today: null });
  assert.equal(grid.length, 13);
  assert.equal(grid.reduce((n, m) => n + m.days.length, 0), 364);
  assert.equal(grid[0].name, "Name 1");
  assert.equal(grid[12].moon, 13);
  assert.ok(grid.every((m) => !m.isTodayMoon));
});

test("today's cell is flagged exactly once, on the house fixture", () => {
  // House fixture: 2026-07-17 = Moon 4 Day 8, Pattern Day 92.
  const grid = opening.buildCalendarGrid({ moonNames: null, today: { moon: 4, day: 8 } });
  const flagged = grid.flatMap((m) => m.days).filter((d) => d.isToday);
  assert.equal(flagged.length, 1);
  assert.equal(grid[3].isTodayMoon, true);
  assert.equal(grid[3].days[7].isToday, true);
  assert.equal(grid[3].name, "Moon 4", "names fall back to numbers, never invented");
});

test("pattern angles follow the first build's convention", () => {
  assert.equal(opening.patternAngleForDayOfYear(1), 0);
  assert.equal(opening.patternAngleForDayOfYear(92), 90); // (91 / 364) * 360
  assert.equal(opening.patternAngleForDayOfYear(364), 359.010989);
});

test("the spiral formulas are the first build's own", () => {
  const range = { start: 2014, end: 2026 };
  assert.equal(opening.spiralRadiusForYear(2014, range), 0);
  assert.equal(opening.spiralRadiusForYear(2026, range), 1);
  assert.equal(opening.spiralAngleForYear(2014, range), 0);
  // (12/12) * 360 * (12/13 + 1) = 692.307692…
  assert.equal(opening.spiralAngleForYear(2026, range), 692.307692);
});

test("the first Sphere portrait draws thirteen numbered wedges", () => {
  const svg = opening.buildFirstSphereSVG({ todayMoon: 8 });
  assert.match(svg, /<svg/);
  assert.equal((svg.match(/<title>Moon \d+<\/title>/g) || []).length, 13);
  assert.equal((svg.match(/<text/g) || []).length, 13);
  // The active moon wears the first build's amber fill.
  assert.match(svg, /rgba\(220,160,80,0\.25\)/);
  // The Year Gate stands at the top, always.
  assert.match(svg, /Year Gate \(Moon 1, Day 1\)/);
});

test("the portrait omits what the record cannot place — never guesses", () => {
  const bare = opening.buildFirstSphereSVG({});
  assert.doesNotMatch(bare, /Equinox Passage/);
  assert.doesNotMatch(bare, /Lunar cycle position/);
  assert.doesNotMatch(bare, /sphere-spiral|100,200,180/);
  const full = opening.buildFirstSphereSVG({
    todayMoon: 1,
    equinoxAngle: 80,
    passageDays: 29,
    lunarAngle: 120,
    studyRange: { start: 2014, end: 2027 },
    years: [
      { year: 2014, equinoxAngle: 79, selected: false },
      { year: 2027, equinoxAngle: 81, selected: true },
    ],
  });
  assert.match(full, /Equinox Passage: 29 days/);
  assert.match(full, /Lunar cycle position/);
  assert.match(full, /rgba\(100,200,180,0\.4\)/, "the teal spiral stands when years are given");
  assert.match(full, /<title>2027<\/title>/);
});

test("auto-open is first-visit only, and never in front of a shared view", () => {
  assert.equal(opening.shouldAutoOpen({ seen: false, sessionShown: false, sharedView: false }), true);
  assert.equal(opening.shouldAutoOpen({ seen: true, sessionShown: false, sharedView: false }), false);
  assert.equal(opening.shouldAutoOpen({ seen: false, sessionShown: true, sharedView: false }), false);
  assert.equal(opening.shouldAutoOpen({ seen: false, sessionShown: false, sharedView: true }), false);
});

test("source guards: the opening presents, and only presents", () => {
  // It never reaches into the Sphere's kernel or its cursor.
  assert.doesNotMatch(source, /SOFTemporalCursor/);
  assert.doesNotMatch(source, /LivingTimeSphereRenderer3d/);
  assert.doesNotMatch(source, /LivingTimeSphereUi/);
  assert.doesNotMatch(source, /LivingTimeSphereDayZoom/);
  // It reads the page's public records, and says so.
  assert.match(source, /PatternCalendar/);
  assert.match(source, /AlignmentLedgerData/);
  assert.match(source, /SparkCompanion/);
  // The demonstration is labelled on its face.
  assert.match(source, /A short demonstration/);
  // First-visit flag + the replay door's name.
  assert.match(source, /sof\.sphere\.evolutionOpening\.v2/);
  assert.match(source, /See how it grew/);
  // The one public control it may press, at the visitor's tap.
  assert.match(source, /data-sgb="today"/);
});

test("the companion layer carries the loader, and nothing else changed shape", () => {
  assert.match(companionLayer, /data-sphere-evolution-opening/);
  assert.match(companionLayer, /sphere-evolution-opening\.js/);
  assert.match(companionLayer, /sphere-evolution-opening\.css/);
});

/* ── The cinematic amendment (Aaron, Nov 23, 2026) ─────────── */

test("the film opens on the welcome, then the four stages in order", () => {
  assert.deepEqual(opening.FILM_STAGES.map((s) => s.id),
    ["welcome", "calendars", "first-sphere", "sphere-now", "spark"]);
  // The welcome is a held title beat — two to three seconds.
  assert.ok(opening.FILM_STAGES[0].holdMs >= 2000 && opening.FILM_STAGES[0].holdMs <= 3000);
  // The whole film runs in the thirty-to-forty-five-second range.
  assert.equal(opening.FILM_TOTAL_MS,
    opening.FILM_STAGES.reduce((n, s) => n + s.holdMs, 0));
  assert.ok(opening.FILM_TOTAL_MS >= 30000 && opening.FILM_TOTAL_MS <= 45000,
    `film total ${opening.FILM_TOTAL_MS}ms stands in the 30–45s range`);
  // Every stage holds by its weight — no metronome.
  const holds = opening.FILM_STAGES.slice(1).map((s) => s.holdMs);
  assert.ok(new Set(holds).size > 1, "stage holds differ");
  assert.match(source, /Welcome to the Sphere/);
});

test("the film plays only where motion is welcome — reduced motion keeps the still form", () => {
  assert.equal(opening.shouldPlayFilm({ reducedMotion: false }), true);
  assert.equal(opening.shouldPlayFilm({ reducedMotion: true }), false);
  assert.match(source, /shouldPlayFilm\(\{ reducedMotion \}\)/);
});

test("the film starts only from the opening's own doors", () => {
  // startFilm has exactly one call site: openOpening. The
  // auto-open path into it stays gated by shouldAutoOpen, so
  // the autoplay is first-visit only; the door's replay is a
  // deliberate tap, and it is the only other way in.
  assert.equal((source.match(/startFilm\(\)/g) || []).length, 2,
    "the definition and its one call in openOpening");
  assert.match(source, /openOpening\("auto"\)/);
  assert.match(source, /openOpening\("door"\)/);
});

// The film's stage windows, in seconds, derived from the map.
function filmWindows() {
  const windows = {};
  let t = 0;
  for (const s of opening.FILM_STAGES) {
    windows[s.id] = [t / 1000, (t + s.holdMs) / 1000];
    t += s.holdMs;
  }
  return windows;
}

test("the sound is one cinematic swell at the root — the composed score is gone", () => {
  assert.equal(opening.freqFor(69), 432, "A4 is 432 Hz");
  assert.equal(opening.freqFor(opening.SWELL_ROOT_MIDI), 72.08, "the root is D2 at A=432");
  // Aaron's direction replaced the score outright: no event
  // plan, no scheduler, no five-voice palette remains.
  assert.equal(typeof opening.buildScoreEvents, "undefined");
  assert.doesNotMatch(source, /buildScoreEvents|startScoreScheduler|playVoice/);
  const swell = opening.buildCinematicSwell();
  assert.equal(swell.voice, "swell", "there is exactly one sound, and it is the swell");
  assert.equal(swell.midi, opening.SWELL_ROOT_MIDI);
  assert.equal(swell.freq, opening.freqFor(opening.SWELL_ROOT_MIDI));
  assert.equal(swell.at, 0, "the swell belongs to the film's first moment");
  const total = opening.FILM_TOTAL_MS / 1000;
  assert.ok(swell.at + swell.dur < total,
    "the swell settles inside the film — the Spark's beat stands in quiet");
});

test("the swell rises slowly, holds its depth, and settles as the scrim lifts", () => {
  const swell = opening.buildCinematicSwell();
  const env = swell.envelope;
  assert.deepEqual(env[0], [0, 0], "it begins in silence");
  assert.deepEqual(env[env.length - 1], [swell.dur, 0], "it ends in silence");
  const peak = env.reduce((a, b) => (b[1] > a[1] ? b : a));
  assert.equal(peak[1], 1, "the swell reaches full depth once");
  assert.ok(peak[0] >= 5, `the rise is slow — full depth at ${peak[0]}s, not a stab`);
  // The reveal (sphere-now) begins while the swell is in its
  // falling segment: sounding as the scrim lifts, settling
  // across it, gone before the Spark's beat.
  const [revealStart] = filmWindows()["sphere-now"];
  const falling = env.filter(([t], i) => i > 0 && env[i - 1][0] < revealStart && t > revealStart);
  assert.ok(falling.length >= 1, "an envelope segment falls across the reveal");
  assert.ok(swell.dur > revealStart && swell.dur < filmWindows().spark[0],
    "the settle completes between the reveal and the Spark");
});

test("the sound rule is pinned in the source: one door to sound, opened only by a gesture", () => {
  // The AudioContext is constructed in exactly one place —
  // inside armSound — and armSound is reached only from a
  // gesture: the door tap that opens a replay, or the first
  // touch/keypress listener armed while the film plays.
  const armStart = source.indexOf("function armSound");
  const armEnd = source.indexOf("function onFirstGesture");
  assert.ok(armStart > 0 && armEnd > armStart, "armSound stands in the source");
  const armBody = source.slice(armStart, armEnd);
  assert.match(armBody, /new AC\(\)/, "the context is built inside armSound");
  assert.equal((source.match(/new AC\(\)/g) || []).length, 1,
    "no other construction of an AudioContext anywhere in the module");
  assert.match(source, /addEventListener\("pointerdown", onFirstGesture, true\)/);
  assert.match(source, /addEventListener\("keydown", onFirstGesture, true\)/);
  assert.match(source, /if \(source === "door"\) armSound\(\);/,
    "a replay's own tap arms its sound from the first beat");
  // The swell starts only from the arm: startSwell is called
  // in exactly one place, inside armSound.
  assert.equal((source.match(/startSwell\(\)/g) || []).length, 2,
    "the definition and its one call in armSound");
  // The film starts silent: nothing in the boot path arms the
  // sound, and the invitation stands in the scene until a touch.
  assert.match(source, /touch anywhere to let it in/);
  const bootBody = source.slice(source.indexOf("function boot()"));
  assert.doesNotMatch(bootBody, /armSound/);
});

test("the seen flag is earned by the first painted beat — never by a close alone", () => {
  // The film keeps its own flag: v1 recorded the staged
  // click-through that stood here before the film existed,
  // and a visitor who closed that walk was robbed of the
  // film. 
  assert.equal(opening.SEEN_KEY, "sof.sphere.evolutionOpening.v2");
  // The flag is written in exactly one place — inside
  // markSeenOnceRendered, behind a requestAnimationFrame, so
  // it stands only once a first beat has actually painted.
  assert.equal((source.match(/storeSet\(SEEN_KEY, "1"\)/g) || []).length, 1,
    "the flag is written in exactly one place");
  const markStart = source.indexOf("function markSeenOnceRendered");
  const markEnd = source.indexOf("function openOpening");
  assert.ok(markStart > 0 && markEnd > markStart, "markSeenOnceRendered stands in the source");
  const markBody = source.slice(markStart, markEnd);
  assert.match(markBody, /requestAnimationFrame/);
  assert.match(markBody, /storeSet\(SEEN_KEY, "1"\)/);
  assert.match(markBody, /sessionSet\(SESSION_KEY, "1"\)/,
    "the session flag is earned at the same painted moment");
  // A close stops the film and fades the sound; it does not
  // itself mark the visitor — a botched load stays unmarked.
  const closeBody = source.slice(source.indexOf("function closeOpening"));
  assert.doesNotMatch(closeBody, /storeSet\(SEEN_KEY/);
  assert.match(closeBody, /stopFilm\(\)/);
  assert.match(closeBody, /stopSound\(\)/);
});
