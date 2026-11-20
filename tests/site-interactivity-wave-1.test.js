"use strict";

/* Site interactivity wave 1 (Aaron's charge, Nov 19 2026: "really good
   interactivity all along the site"). Census:
   ~/workspace/your_files/site-interactivity-census-2026-11-19.md
   Wave 1 gives the two reading families their missing actions and teaches
   the 404 gate the day it is in. All state stays in the visitor's own
   browser records; nothing is counted, streaked, or transmitted. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const readJson = relative => JSON.parse(read(relative));

/* ---------- Scripture: mark chapter read ---------- */

test("scripture reader carries a chapter-read record in its own store", () => {
  const code = read("docs/scripture/assets/scripture.js");
  assert.ok(code.includes("state.read = state.read || [];"), "read list initialised in sof.scripture.v1");
  assert.ok(code.includes("id: 'sf-read'"), "read toggle button is built with the controls");
  assert.ok(code.includes("function toggleRead()"), "toggle handler exists");
  assert.ok(code.includes("Chapter read ✓ (tap to undo)"), "toggle announces its state in words");
  assert.ok(code.includes("aria-pressed"), "toggle exposes pressed state");
  assert.ok(code.includes("chapterKey = book + '.' + ch;"), "chapter key comes from the page's own data");
});

test("scripture home builds a reading shelf from the read record", () => {
  const code = read("docs/scripture/assets/scripture.js");
  assert.ok(code.includes("function buildReadingShelf(lede)"), "shelf builder exists");
  assert.ok(code.includes("Your reading shelf"), "shelf is named in plain words");
  assert.ok(code.includes("kept in this browser only"), "shelf states its local-only keeping");
  const css = read("docs/scripture/assets/scripture.css");
  assert.ok(css.includes(".sf-shelf"), "shelf styles exist");
  assert.ok(css.includes('.sf-today'), "today panel styles exist");
  assert.ok(css.includes('#sf-read[aria-pressed="true"]'), "read state is visible");
});

/* ---------- Scripture: a verse for today ---------- */

test("every verse in the today pool exists in the edition's own chapter data", () => {
  const code = read("docs/scripture/assets/scripture.js");
  const match = code.match(/var VERSE_POOL = \[([^\]]+)\];/);
  assert.ok(match, "verse pool is declared");
  const pool = [...match[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
  assert.ok(pool.length >= 10, "pool is wide enough to turn with the days");
  const cache = new Map();
  for (const ref of pool) {
    const [book, ch] = ref.split(".");
    const key = `${book}-${ch}`;
    if (!cache.has(key)) {
      cache.set(key, readJson(`docs/scripture/data/chapters/${book}-${String(ch).padStart(2, "0")}.json`));
    }
    const verse = cache.get(key).verses.find(v => v.id === ref);
    assert.ok(verse, `${ref} resolves in chapter data`);
    assert.ok(typeof verse.en === "string" && verse.en.length > 0, `${ref} carries the edition's English text`);
  }
});

test("the verse for today is chosen by the date, not by the calendar engine", () => {
  const code = read("docs/scripture/assets/scripture.js");
  assert.ok(code.includes("function verseForToday()"), "chooser exists");
  assert.ok(code.includes("Math.floor(Date.now() / 86400000)"), "seed is the civil day count");
  assert.ok(code.includes("the same verse for every visitor today"), "the rule is stated on the page");
  assert.ok(code.includes("getJSON('data/chapters/'"), "text is fetched from the edition's data, never hand-written");
  assert.equal(code.includes("PatternCalendar"), false, "scripture.js never re-implements the one clock");
});

/* ---------- Scroll Library: continue + by lot ---------- */

test("scroll reader remembers the passage and the library door offers it back", () => {
  const reader = read("docs/scroll/assets/reader.js");
  assert.ok(reader.includes('const lastPassageKey = "sof-scroll-last-passage";'), "one shared key");
  assert.ok(reader.includes("localStorage.setItem(lastPassageKey, JSON.stringify({ id: requested.id, title: requested.title }))"),
    "reader saves the opened passage");
  const library = read("docs/scroll/assets/library.js");
  assert.ok(library.includes('localStorage.getItem("sof-scroll-last-passage")'), "library reads the same key");
  assert.ok(library.includes("Continue where you left off: "), "the door is offered in plain words");
  assert.ok(library.includes("reader.html?section=${encodeURIComponent(last.id)}"), "door opens the reader at the passage");
  assert.ok(library.includes("remembered in this browser only"), "local keeping is stated");
  const css = read("docs/scroll/assets/library.css");
  assert.ok(css.includes(".continue-reading"), "continue bar is styled");
});

test("scroll search can open a passage by lot from the loaded index", () => {
  const html = read("docs/scroll/search.html");
  assert.ok(html.includes("data-lot"), "lot button is on the search page");
  assert.ok(html.includes("Open a passage by lot"), "button is named in plain words");
  const code = read("docs/scroll/assets/search.js");
  assert.ok(code.includes('document.querySelector("[data-lot]")'), "lot button is wired");
  assert.ok(code.includes("loadSections()"), "draw uses the already-loaded sections index");
  assert.ok(code.includes("reader.html?section=${encodeURIComponent(row[0])}"), "draw opens the reader");
  assert.ok(code.includes("The lot fell on"), "the draw announces its result before the door");
});

/* ---------- 404: the day went on ---------- */

test("the 404 gate names today from the one calendar and offers the day's doors", () => {
  const html = read("docs/404.html");
  assert.ok(html.includes('id="sof-404-day"'), "day line exists");
  assert.ok(html.includes("The day went on without this page."), "the gate speaks the house's lesson");
  for (const f of ["pattern-calendar-version", "pattern-calendar-data", "pattern-calendar-format", "pattern-calendar-boundary", "pattern-calendar"]) {
    assert.ok(html.includes(`assets/js/calendar/${f}.js`), `404 loads ${f} from the canonical calendar stack`);
  }
  assert.ok(html.includes("PatternCalendar.fromCivilDate"), "coordinate comes from the canonical engine");
  assert.ok(html.includes('href="moons.html"'), "door to the moons");
  assert.ok(html.includes('href="living-time-sphere.html"'), "door to the Sphere");
  assert.ok(html.includes("This page is missing, but the day is not."), "fallback copy keeps the meaning");
});

test("the canonical calendar still answers the recorded fixtures", () => {
  const context = { console, Date, Intl, Math };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  for (const f of ["pattern-calendar-version", "pattern-calendar-data", "pattern-calendar-format", "pattern-calendar-boundary", "pattern-calendar"]) {
    vm.runInContext(read(`docs/assets/js/calendar/${f}.js`), context, { filename: f });
  }
  const at = d => context.PatternCalendar.fromCivilDate({ date: d });
  const nov19 = at("2026-11-19");
  assert.equal(nov19.moon, 8); assert.equal(nov19.day, 21); assert.equal(nov19.dayOfPatternYear, 217);
  const jul17 = at("2026-07-17");
  assert.equal(jul17.moon, 4); assert.equal(jul17.day, 8); assert.equal(jul17.dayOfPatternYear, 92);
  const sep15 = at("2026-09-15");
  assert.equal(sep15.moon, 6); assert.equal(sep15.day, 12); assert.equal(sep15.dayOfPatternYear, 152);
});

/* ---------- House rules ---------- */

test("wave 1 adds no motion, no sound, and no guilt mechanics", () => {
  const surfaces = [
    read("docs/scripture/assets/scripture.js"),
    read("docs/scripture/assets/scripture.css"),
    read("docs/scroll/assets/library.js"),
    read("docs/scroll/assets/library.css"),
    read("docs/scroll/assets/search.js"),
    read("docs/404.html"),
  ].join("\n");
  assert.equal(surfaces.includes("requestAnimationFrame"), false, "no animation loops added");
  assert.equal(surfaces.includes("new Audio"), false, "no sound added");
  assert.equal(/streak/i.test(surfaces), false, "no streak language");
  /* scripture.js carries exactly two pre-existing scrollIntoView calls
     (deep-link verse positioning, shipped long before this wave); wave 1
     must add none, and its new files must carry none at all. */
  const scripture = read("docs/scripture/assets/scripture.js");
  assert.equal((scripture.match(/scrollIntoView/g) || []).length, 2, "no new scroll manipulation in scripture.js");
  assert.equal(read("docs/scroll/assets/library.js").includes("scrollIntoView"), false, "no scroll manipulation in the new library door");
});

test("growth record carries the wave 1 entry", () => {
  const updates = readJson("docs/assets/data/codex-updates.json");
  const entry = updates.find(u => u.title === "The reading rooms learned to remember and to answer");
  assert.ok(entry, "entry exists");
  assert.equal(entry.date, "2026-11-19");
  assert.ok(entry.summary.includes("Nothing is counted, streaked, or sent anywhere"), "entry states the keeping rule");
});
