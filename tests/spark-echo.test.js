"use strict";

/*
 * Spark Echo — the Spark's memory game.
 *
 * The engine is a pure function of its seed. These tests prove:
 * the alphabets are the site's own (the frequency page's solfeggio
 * set with its own names; the eight studied words, pointed, and
 * sounded by the pronunciation engine; the 432-rooted ladder),
 * sequences are deterministic and grow by prefix, the daily seed
 * turns with the Pattern Day, and the difficulty ramp lengthens
 * and quickens by its stated table — while chords and mixed word
 * steps only appear where the ramp says they may.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

function loadEngine() {
  const context = { Intl, Date, console };
  context.globalThis = context;
  vm.runInNewContext(read("docs/assets/js/spark-echo.js"), context);
  return context.SparkEcho;
}

function loadPronunciation() {
  const context = { console, module: { exports: {} }, exports: {} };
  context.globalThis = context;
  vm.runInNewContext(read("docs/assets/js/hebrew-pronunciation.js"), context);
  return context.module.exports;
}

const SE = loadEngine();
const HP = loadPronunciation();
const C = SE.constants;

test("the engine loads without a page and exposes its alphabets", () => {
  assert.equal(typeof SE.buildSequence, "function");
  assert.deepEqual([...C.MODES], ["light", "words", "tones"]);
  assert.equal(C.LIGHT_PADS.length, 6);
  assert.equal(C.WORD_TILES.length, 8);
  assert.equal(C.TONE_PADS.length, 9);
});

test("tones are the frequency page's own set, names and all", () => {
  const gov = read("docs/assets/js/frequency-governance.js");
  for (const pad of C.TONE_PADS) {
    const row = new RegExp(`\\[${pad.hz},\\s*"${pad.name}"`);
    assert.ok(row.test(gov), `${pad.hz} "${pad.name}" is not a Frequency Governance preset`);
  }
  assert.deepEqual(Array.from(C.TONE_PADS, (p) => p.hz), [174, 285, 396, 417, 528, 639, 741, 852, 963]);
});

test("light stones sing a pentatonic ladder rooted exactly on 432", () => {
  assert.equal(SE.lightFreq(0), 432);
  for (let i = 0; i < C.LIGHT_PADS.length; i++) {
    const expected = 432 * Math.pow(2, C.LIGHT_PADS[i].semis / 12);
    assert.equal(SE.lightFreq(i), expected, `stone ${i} off its rung`);
  }
  const freqs = C.LIGHT_PADS.map((_, i) => SE.lightFreq(i));
  assert.equal(new Set(freqs).size, freqs.length, "two stones share a note");
  assert.ok(freqs.every((f, i) => i === 0 || f > freqs[i - 1]), "the ladder climbs");
});

test("every word tile is pointed, studied, and sounded by the engine", () => {
  for (const tile of C.WORD_TILES) {
    assert.ok(HP.hasPointing(tile.hebrew), `${tile.slug} carries no pointing`);
    const spoken = HP.transliterate(tile.hebrew).spoken;
    assert.ok(spoken, `${tile.slug} cannot be sounded by the engine`);
    assert.ok(tile.gloss && tile.line, `${tile.slug} is missing its teaching line`);
  }
  const slugs = Array.from(C.WORD_TILES, (t) => t.slug);
  assert.deepEqual(slugs, ["or", "shem", "ruach", "nephesh", "adam", "adamah", "enosh", "davar"]);
  for (const slug of slugs.slice(0, 7)) {
    assert.ok(
      fs.existsSync(path.join(root, "docs/scripture/word-studies", `${slug}.html`)),
      `the ${slug} study page is missing`
    );
  }
});

test("sequences are deterministic: same seed, same sequence, any device", () => {
  for (const mode of C.MODES) {
    const a = SE.buildSequence("echo:daily:1:224", mode, 12, false);
    const b = SE.buildSequence("echo:daily:1:224", mode, 12, false);
    assert.deepEqual(a, b, `${mode} sequence is not deterministic`);
  }
});

test("a sequence grows by prefix: the Spark never swaps the pattern mid-game", () => {
  for (const mode of C.MODES) {
    for (const free of [false, true]) {
      const short = SE.buildSequence("echo:free:seedling", mode, 4, free);
      const long = SE.buildSequence("echo:free:seedling", mode, 11, free);
      assert.deepEqual(long.slice(0, 4), short, `${mode} (free=${free}) broke its prefix`);
    }
  }
});

test("the daily seed turns with the day and differs by mode", () => {
  const dayA = SE.buildSequence("echo:daily:1:224", "light", 8, false);
  const dayB = SE.buildSequence("echo:daily:1:225", "light", 8, false);
  const modeB = SE.buildSequence("echo:daily:1:224", "tones", 8, false);
  assert.notDeepEqual(dayA, dayB, "two days share a sequence");
  assert.notDeepEqual(dayA, modeB, "two modes share a sequence");
});

test("steps stay inside their alphabets", () => {
  for (let d = 1; d <= 28; d++) {
    for (const mode of C.MODES) {
      const seq = SE.buildSequence(`echo:daily:2:${d}`, mode, 16, true);
      for (const step of seq) {
        if (mode === "words") {
          assert.ok(typeof step.word === "number" && step.word < C.WORD_TILES.length);
          assert.equal(step.pads, undefined, "a words step grew pads");
        } else if (typeof step.word === "number") {
          assert.equal(mode, "light", "a word step escaped into tones");
          assert.ok(step.word < C.WORD_TILES.length);
        } else {
          const limit = mode === "tones" ? C.TONE_PADS.length : C.LIGHT_PADS.length;
          assert.ok(step.pads.every((i) => i >= 0 && i < limit), "a pad fell off the board");
          if (mode === "light") assert.equal(step.pads.length, 1, "light grew a chord");
        }
      }
    }
  }
});

test("the wide steps arrive only where the ramp puts them", () => {
  let sawChord = false;
  let sawMixedWord = false;
  for (let d = 1; d <= 60; d++) {
    const tones = SE.buildSequence(`echo:daily:3:${d}`, "tones", 16, false);
    tones.forEach((step, i) => {
      if (step.pads && step.pads.length === 2) {
        sawChord = true;
        assert.ok(i >= C.WIDE_FROM, `a chord arrived early, at step ${i}`);
        assert.notEqual(step.pads[0], step.pads[1], "a chord doubled one tone");
      }
    });
    const lightDaily = SE.buildSequence(`echo:daily:3:${d}`, "light", 16, false);
    assert.ok(lightDaily.every((s) => typeof s.word !== "number"), "the daily light game mixed a word in");
    const lightFree = SE.buildSequence(`echo:free:wandering:${d}`, "light", 16, true);
    lightFree.forEach((step, i) => {
      if (typeof step.word === "number") {
        sawMixedWord = true;
        assert.ok(i >= C.WIDE_FROM, `a mixed word arrived early, at step ${i}`);
      }
    });
  }
  assert.ok(sawChord, "no chord ever arrived in 60 days of tones");
  assert.ok(sawMixedWord, "no word ever folded into 60 free light games");
});

test("the ramp: length grows by one a round, pace quickens to its floor", () => {
  assert.equal(SE.lengthForRound(1), 3);
  assert.equal(SE.lengthForRound(2), 4);
  assert.equal(SE.lengthForRound(9), 11);
  assert.equal(SE.lengthForRound(100), C.MAX_LENGTH, "length runs away");
  let prev = Infinity;
  for (let r = 1; r <= 30; r++) {
    const pace = SE.paceForRound(r, "steady");
    assert.ok(pace <= prev, `round ${r} slowed down`);
    assert.ok(pace >= 340, `round ${r} broke the pace floor`);
    prev = pace;
  }
  assert.ok(SE.paceForRound(5, "gentle") > SE.paceForRound(5, "steady"));
  assert.ok(SE.paceForRound(5, "steady") > SE.paceForRound(5, "swift"));
  assert.equal(C.RAMP_TABLE.length, 3, "the stated ramp lost a row");
});

test("the page carries the game and names its kin", () => {
  const html = read("docs/spark-echo.html");
  assert.ok(html.includes("assets/js/spark-echo.js"), "the page forgot its engine");
  assert.ok(html.includes("assets/js/hebrew-pronunciation.js"), "the page forgot the pronunciation engine");
  assert.ok(html.includes("assets/css/spark-echo.css"), "the page forgot its skin");
  assert.ok(html.includes('href="systems/frequencies.html"'), "no door to the frequency page");
  assert.ok(html.includes('href="scripture/word-studies/index.html"'), "no door to the word studies");
  assert.ok(html.includes('href="companions.html"'), "no door to the Spark");
  const story = JSON.parse(read("docs/assets/data/codex-story.json"));
  const pages = JSON.stringify(story);
  assert.ok(pages.includes('"spark-echo.html"'), "the story spine does not name the page");
});

test("the fences hold in the game's own words: no streaks, nothing losable", () => {
  const js = read("docs/assets/js/spark-echo.js");
  assert.ok(!/leaderboard/i.test(js.replace(/no leaderboard/i, "")), "a leaderboard crept in");
  assert.ok(js.includes("sof.spark-echo.v1"), "the keepsake record lost its key");
  assert.ok(js.includes("nothing is lost"), "the kind miss lost its words");
});
