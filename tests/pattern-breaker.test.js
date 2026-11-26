"use strict";

/*
 * Pattern Breaker — the daily pattern puzzle.
 *
 * The engine is a pure function of the Pattern Day. These tests walk
 * a whole Pattern Year (364 counted days) and prove, for every day:
 * the puzzle generates, the independent verifier finds exactly one
 * defensible answer, and generating twice gives the same puzzle —
 * the same puzzle for everyone, everywhere, offline.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

function loadEngine() {
  const context = { Intl, Date };
  context.globalThis = context;
  vm.runInNewContext(read("docs/assets/js/pattern-breaker.js"), context);
  return context.PatternBreaker;
}

const PB = loadEngine();
const FREQS = PB.constants.MOON_FREQS;

/* The day's context, built with the calendar's own arithmetic —
 * the same shape the page builds from PatternCalendar's summary. */
function ctxFor(patternYear, dayOfPatternYear) {
  const moon = Math.floor((dayOfPatternYear - 1) / 28) + 1;
  const dayOfMoon = ((dayOfPatternYear - 1) % 28) + 1;
  return {
    seedKey: `pb:${patternYear}:${dayOfPatternYear}`,
    patternYear,
    dayOfPatternYear,
    moon,
    dayOfMoon,
    freqHz: FREQS[moon - 1],
    moonName: null,
    dayLabel: `Pattern Day ${dayOfPatternYear}`
  };
}

test("the engine loads without a page and exposes its gate", () => {
  assert.equal(typeof PB.generate, "function");
  assert.equal(typeof PB.verify, "function");
  assert.deepEqual([...PB.constants.KINDS], ["sequence", "oddone", "chain"]);
});

test("difficulty breathes with the Moon: gentle, middle, sharp thirds", () => {
  assert.equal(PB.tierFor(1), 1);
  assert.equal(PB.tierFor(9), 1);
  assert.equal(PB.tierFor(10), 2);
  assert.equal(PB.tierFor(19), 2);
  assert.equal(PB.tierFor(20), 3);
  assert.equal(PB.tierFor(28), 3);
});

test("Pattern Day 224 generates a fair puzzle (the rotation's second kind)", () => {
  const puzzle = PB.generate(ctxFor(1, 224));
  const verdict = PB.verify(puzzle);
  assert.ok(verdict.ok, `verifier rejected the day: ${JSON.stringify(verdict)}`);
  assert.equal(verdict.solutions, 1);
  assert.equal(puzzle.kind, "oddone", "day 224 falls on the rotation's second kind");
  assert.equal(puzzle.shareLine, "I found the one that breaks it — Pattern Day 224");
});

test("the whole Pattern Year is fair: 364 days, one answer each", () => {
  for (let day = 1; day <= 364; day++) {
    const puzzle = PB.generate(ctxFor(1, day));
    const verdict = PB.verify(puzzle);
    assert.ok(verdict.ok, `day ${day} (${puzzle.kind}/${puzzle.family}) failed verification`);
    assert.equal(verdict.solutions, 1, `day ${day} has ${verdict.solutions} defensible answers`);
    if (puzzle.kind === "oddone") {
      assert.equal(puzzle.options.length, puzzle.board.tiles.length, `day ${day}: oddone options mirror the board`);
      assert.equal(puzzle.options.filter((o) => o.correct).length, 1, `day ${day}: one breaker flagged`);
    } else {
      assert.equal(puzzle.options.length, 4, `day ${day}: four choices`);
      assert.equal(puzzle.options.filter((o) => o.correct).length, 1, `day ${day}: one choice flagged right`);
    }
    assert.ok(puzzle.ruleText.length > 20, `day ${day}: the rule is explained after the solve`);
    assert.ok(puzzle.shareLine.endsWith(`Pattern Day ${day}`), `day ${day}: the share card is words for the day`);
  }
});

test("the kinds rotate by the day, and no two days in a row are the same puzzle", () => {
  let previous = null;
  for (let day = 1; day <= 364; day++) {
    const puzzle = PB.generate(ctxFor(1, day));
    assert.equal(puzzle.kind, PB.constants.KINDS[(day - 1) % 3], `day ${day} kind rotation`);
    const sig = PB.signature(puzzle);
    assert.notEqual(sig, previous, `day ${day} repeats day ${day - 1}`);
    previous = sig;
  }
});

test("the same day is the same puzzle, generated twice, in any year", () => {
  for (const [year, day] of [[1, 1], [1, 100], [1, 364], [2, 1], [2, 223], [3, 364]]) {
    const a = PB.generate(ctxFor(year, day));
    const b = PB.generate(ctxFor(year, day));
    assert.equal(JSON.stringify(a), JSON.stringify(b), `year ${year} day ${day} is not deterministic`);
    assert.ok(PB.verify(a).ok, `year ${year} day ${day} failed verification`);
  }
});

test("the Day Out of Time still stands a fair puzzle", () => {
  const ctx = {
    seedKey: "pb:1:X1", patternYear: 1, dayOfPatternYear: null,
    moon: 3, dayOfMoon: null, freqHz: FREQS[2], moonName: "Day Out of Time",
    dayLabel: "Day Out of Time"
  };
  const puzzle = PB.generate(ctx);
  const verdict = PB.verify(puzzle);
  assert.ok(verdict.ok);
  assert.equal(verdict.solutions, 1);
  assert.equal(puzzle.tier, 1, "the day outside the count stays gentle");
});

test("the page carries the living layer once, the calendar, and the puzzle", () => {
  const html = read("docs/pattern-breaker.html");
  assert.equal((html.match(/assets\/js\/living-ui\.js/g) || []).length, 1, "living-ui.js exactly once");
  assert.equal((html.match(/assets\/css\/living-ui\.css/g) || []).length, 1, "living-ui.css exactly once");
  assert.equal((html.match(/data-living-nav/g) || []).length, 1, "one travel bar");
  assert.ok(html.includes("assets/css/codex.css"), "the one token sheet");
  assert.ok(html.includes("assets/css/pattern-breaker.css"), "the puzzle's own sheet");
  assert.ok(html.includes("assets/js/pattern-breaker.js"), "the puzzle's script");
  assert.ok(html.includes("assets/js/calendar/pattern-calendar.js"), "the canonical calendar");
  assert.ok(html.includes("assets/js/living-moon-theme.js"), "the Moon's tint");
  assert.ok(html.includes("assets/js/spark-presence.js"), "the Spark is present");
  assert.ok(!/streak/i.test(html), "no streak mechanics, in word or deed");
  assert.ok(!/missed|you missed/i.test(html), "a missed day is never mentioned");
});

test("the script reads the day only from PatternCalendar and keeps the record local", () => {
  const js = read("docs/assets/js/pattern-breaker.js");
  assert.ok(js.includes("PatternCalendar"), "the calendar is the only date authority");
  assert.ok(js.includes("fromCivilDate"), "read through the calendar's public surface");
  assert.ok(js.includes("sof.pattern-breaker.v1"), "one local record, named");
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon/.test(js), "nothing leaves the device");
  assert.ok(js.includes("prefers-reduced-motion"), "the still design is honored");
});

test("the sheet declares no palette of its own — tokens only", () => {
  const css = read("docs/assets/css/pattern-breaker.css");
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(css), "no hex colours outside codex.css tokens");
  assert.ok(css.includes("var(--gold)"), "the Codex gold, by token");
  assert.ok(css.includes("prefers-reduced-motion"), "reduced motion stands whole");
});
