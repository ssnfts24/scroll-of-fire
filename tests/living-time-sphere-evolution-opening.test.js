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
  assert.match(source, /sof\.sphere\.evolutionOpening\.v1/);
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

test("the score is tuned at A=432, in D, and stands inside the film", () => {
  assert.equal(opening.freqFor(69), 432, "A4 is 432 Hz");
  assert.equal(opening.freqFor(opening.SCORE_ROOT_MIDI), 288.33, "the root is D4 at A=432");
  const events = opening.buildScoreEvents();
  assert.ok(events.length > 30, "the score is a real plan, not a stub");
  const total = opening.FILM_TOTAL_MS / 1000;
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    assert.ok(ev.at >= 0 && ev.at < total, `event at ${ev.at}s starts inside the film`);
    assert.ok(ev.at + ev.dur <= total + 1, `event at ${ev.at}s rings out within a breath of the film's end`);
    if (i > 0) assert.ok(events[i - 1].at <= ev.at, "events stand in time order");
    assert.ok(["cello", "bowl", "drum", "pluck", "flute"].includes(ev.voice),
      "the palette is the re-score brief's five voices");
    if (ev.midi != null) assert.equal(ev.freq, opening.freqFor(ev.midi));
  }
});

test("the Count: drum counts, the NAME figure stated, thirteen counted plucks", () => {
  const [start, end] = filmWindows().calendars;
  const events = opening.buildScoreEvents();
  const inWindow = (voice) => events.filter((e) => e.voice === voice && e.at >= start && e.at < end);
  assert.equal(inWindow("drum").length, 4, "four frame-drum counts");
  const figure = inWindow("pluck").filter((e) => e.at < start + 5.4).map((e) => e.midi);
  assert.deepEqual(figure, [62, 66, 69, 66, 62],
    "root → third → fifth → third → root, stated");
  const counted = inWindow("pluck").filter((e) => e.at >= start + 5.4);
  assert.equal(counted.length, 13, "thirteen counted plucks — the moons");
  for (let i = 1; i < counted.length; i++) {
    assert.ok(counted[i].midi > counted[i - 1].midi, "the count climbs the scale");
  }
});

test("the figure trails unfinished over the first Sphere, and completes at the reveal", () => {
  const events = opening.buildScoreEvents();
  const plucksIn = (id) => {
    const [start, end] = filmWindows()[id];
    return events.filter((e) => e.voice === "pluck" && e.at >= start && e.at < end).map((e) => e.midi);
  };
  assert.deepEqual(plucksIn("first-sphere"), [62, 66, 69],
    "root → third → fifth, and no way back — left unfinished");
  assert.deepEqual(plucksIn("sphere-now"), [62, 66, 69, 74, 69, 66, 62],
    "the figure completes as the scrim lifts");
});

test("the Call sounds as the Spark appears — the Whistle's contour at A=432", () => {
  const [start, end] = filmWindows().spark;
  const call = opening.buildScoreEvents()
    .filter((e) => e.voice === "flute" && e.at >= start && e.at < end);
  assert.deepEqual(call.map((e) => e.midi), [86, 91, 88, 86], "D6 → G6 → E6 → D6");
  const expected = [1153.3, 1539.47, 1294.54, 1153.3];
  call.forEach((e, i) => {
    assert.ok(Math.abs(e.freq - expected[i]) < 0.5,
      `the Call's ${i + 1}th note stands at ${expected[i]} Hz (got ${e.freq})`);
  });
});

test("the sound rule is pinned in the source: one door to sound, opened only by a gesture", () => {
  // The AudioContext is constructed in exactly one place —
  // inside armScore — and armScore is reached only from a
  // gesture: the door tap that opens a replay, or the first
  // touch/keypress listener armed while the film plays.
  const armStart = source.indexOf("function armScore");
  const armEnd = source.indexOf("function onFirstGesture");
  assert.ok(armStart > 0 && armEnd > armStart, "armScore stands in the source");
  const armBody = source.slice(armStart, armEnd);
  assert.match(armBody, /new AC\(\)/, "the context is built inside armScore");
  assert.equal((source.match(/new AC\(\)/g) || []).length, 1,
    "no other construction of an AudioContext anywhere in the module");
  assert.match(source, /addEventListener\("pointerdown", onFirstGesture, true\)/);
  assert.match(source, /addEventListener\("keydown", onFirstGesture, true\)/);
  assert.match(source, /if \(source === "door"\) armScore\(\);/,
    "a replay's own tap arms its score from the first beat");
  // The film starts silent: nothing in the boot path arms the
  // score, and the invitation stands in the scene until a touch.
  assert.match(source, /touch anywhere to let it in/);
  const bootBody = source.slice(source.indexOf("function boot()"));
  assert.doesNotMatch(bootBody, /armScore/);
});

test("played or skipped, the seen flag is set on every close — the autoplay never returns", () => {
  const closeBody = source.slice(source.indexOf("function closeOpening"));
  assert.match(closeBody, /storeSet\(SEEN_KEY, "1"\)/);
  assert.match(closeBody, /stopFilm\(\)/);
  assert.match(closeBody, /stopScore\(\)/);
});
