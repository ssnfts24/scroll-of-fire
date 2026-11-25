/**
 * School paths — Page Evolution Batch E5 (Nov 25, 2026).
 *
 * The Practices room becomes the school's root in fact: the
 * approved Exercises slices Q-06 (the day's door) and Q-07
 * (the remaining seven) hang off it as named courses, the
 * bench's practice rooms take their places in the sequence,
 * the word-study path and the Genesis chapter-a-day door join
 * the same shelf, and the Lab names Teach with a first step.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const docs = path.join(__dirname, "..", "docs");
const read = (rel) => fs.readFileSync(path.join(docs, rel), "utf8");

test("the Practices room is the school's root: every course stands on its shelf", () => {
  const page = read("practices.html");
  assert.ok(page.includes('id="pw-school-title"'), "the school shelf stands");
  for (const href of [
    "#pw-exercises-title",
    "./micro.html",
    "./systems/mind-renewal.html",
    "./guide.html",
    "./teach.html",
    "./scripture/word-studies/index.html",
    "./scripture/index.html#genesis-path"
  ]) {
    assert.ok(page.includes(`href="${href}"`), `course door ${href} stands on the shelf`);
  }
  for (const name of ["The Day's Door", "The Exercises Wing", "The Remaining Seven", "The 90-Second Micro-Run", "The Mind-Renewal Protocol", "Practice Playbook", "Teach — the Manifest Console", "The Word Studies", "Genesis, a Chapter a Day"]) {
    assert.ok(page.includes(name), `course named: ${name}`);
  }
});

test("Q-07: the remaining seven are named, family by family", () => {
  const page = read("practices.html");
  for (const name of ["The Long Exhale", "One Sound Deep", "The Undeniable Witness", "Backward Through the Day", "One Face", "The Sent Kindness", "Hands and Ground"]) {
    assert.ok(page.includes(name), `seven named: ${name}`);
  }
  assert.ok(page.includes("Arriving one family at a time"), "their state is stated honestly");
});

test("Q-06: the day's door names a real exercise for every moon, from the moon's own words", () => {
  const page = read("practices.html");
  const wing = read("assets/js/practice-wing.js");
  const beginIds = new Set([...page.matchAll(/data-pw-begin="([^"]+)"/g)].map((m) => m[1]));
  assert.equal(beginIds.size, 5, "the wing's five exercises stand");
  const table = wing.match(/const DAYS_DOOR = \{([\s\S]*?)\n    \};/);
  assert.ok(table, "the day's door table stands in the open");
  const entries = [...table[1].matchAll(/(\d+): \{ exercise: "([^"]+)"/g)];
  assert.equal(entries.length, 13, "one suggestion per moon");
  for (const [, idx, exercise] of entries) {
    assert.ok(beginIds.has(exercise), `Moon ${idx} suggests a real exercise (${exercise})`);
  }
  assert.ok(wing.includes("record.practice"), "the moon's practice line is quoted from PatternCalendarData, not retyped");
  assert.ok(wing.includes("Day Out of Time"), "the Day Out of Time has its door too");
  assert.ok(wing.includes("pw-card--today"), "the suggested card stands lit");
  assert.ok(page.includes('id="pw-days-door"'), "the door's mount stands on the page");
});

test("the Genesis chapter-a-day door stands above the full list, generator-pinned", () => {
  const index = read("scripture/index.html");
  const doorAt = index.indexOf('id="genesis-path"');
  const booksAt = index.indexOf('<div class="books">');
  assert.ok(doorAt > 0 && booksAt > doorAt, "the door stands above the chapter list");
  assert.ok(index.includes('href="genesis/01.html"'), "the path begins at Genesis 1");
  assert.ok(index.includes('href="../practices.html#pw-school-title"'), "the door names the school root");
  const generator = fs.readFileSync(path.join(__dirname, "..", "scripts", "r2_02_pages.py"), "utf8");
  assert.ok(generator.includes('id="genesis-path"'), "the generator emits the door (a rebuild keeps it)");
});

test("the Lab names Teach with a start-a-practice first step", () => {
  const lab = read("lab.html");
  assert.ok(lab.includes("First step — start a practice"), "the first step stands");
  assert.ok(lab.includes('<a href="./teach.html">Teach — the Manifest Practice</a>'), "Teach is surfaced by name");
  assert.ok(lab.includes('href="./practices.html#pw-school-title"'), "the first step names the school root");
});
