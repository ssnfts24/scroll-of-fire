"use strict";

/**
 * spark-ease.test.js — the ease pass's pins (Nov 24, 2026,
 * Aaron's word: "The Spark scheduling should be more easier.
 * Interacting with the Spark needs to be easier and better.").
 *
 * The pass cuts steps, never fences: quick phrases resolve the
 * way keepers actually talk; the day and the time are one tap
 * on chips instead of a second composed sentence; the proposal
 * card's heading carries the whole restatement and its yes is
 * the widest thing on the card; finishing a thing is one tap on
 * its own row in the timeline — and every write still waits for
 * the keeper's yes, child mode still refuses the family, and
 * the marker layer still keeps no store of its own.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const Core = require(path.join(ROOT, "docs/assets/js/spark-schedule-core.js"));

// Tuesday, November 24, 2026 — Moon 8 · Day 26, Pattern Day 222.
const CTX = { todayCivil: "2026-11-24", todayPatternDay: 222, todayAnchorYear: 2026 };

test("quick phrases: tonight, tomorrow morning, this evening, next week", () => {
  const tonight = Core.parseScheduleRequest("remind me to water the beds tonight", CTX);
  assert.equal(tonight.kind, "schedule");
  assert.equal(tonight.title, "Water the beds");
  assert.equal(tonight.stamp.civilDate, "2026-11-24", "tonight is today");
  assert.equal(tonight.partOfDay, "evening", "tonight carries the evening as a note, not a clock time");

  const tm = Core.parseScheduleRequest("schedule Call the hall tomorrow morning", CTX);
  assert.equal(tm.title, "Call the hall", "the whole quick phrase lifts out of the title");
  assert.equal(tm.stamp.civilDate, "2026-11-25");
  assert.equal(tm.partOfDay, "morning");

  const te = Core.parseScheduleRequest("schedule Sharpen the mower this evening", CTX);
  assert.equal(te.title, "Sharpen the mower");
  assert.equal(te.stamp.civilDate, "2026-11-24");
  assert.equal(te.partOfDay, "evening");

  const nw = Core.parseScheduleRequest("schedule Post the pack next week", CTX);
  assert.equal(nw.title, "Post the pack");
  assert.equal(nw.stamp.civilDate, "2026-12-01", "next week stands seven days on");

  const fri = Core.parseScheduleRequest("schedule Water the beds on Friday morning", CTX);
  assert.equal(fri.title, "Water the beds");
  assert.equal(fri.stamp.civilDate, "2026-11-27");
  assert.equal(fri.partOfDay, "morning", "a part of day riding a named day still lands as a note");
});

test("quick phrases never eat a title that merely holds the word", () => {
  const mp = Core.parseScheduleRequest("schedule Morning pages tomorrow", CTX);
  assert.equal(mp.title, "Morning pages", "a bare part-of-day word counts only at the end of the words");
  assert.equal(mp.partOfDay, null);
  const clock = Core.parseScheduleRequest("remind me to call the hall on Thursday at 10am", CTX);
  assert.equal(clock.time, "10:00", "the clock grammar is untouched by the quick phrases");
  assert.equal(clock.partOfDay, null);
});

test("the panel: chips carry the day, the time, and the first steps", () => {
  const src = read("docs/assets/js/sphere-spark.js");
  assert.ok(src.includes("function addChips"), "one-tap answers stand under Spark lines");
  assert.ok(src.includes("Tap one, or name any day"), "a missing day is answered with taps, not a grammar lesson");
  assert.ok(src.includes("dayChip(\"Today\"") && src.includes("dayChip(\"Tomorrow\""), "today and tomorrow are the first day chips");
  assert.ok(src.includes("SLOT_TIMES"), "the proposal's time chips ride the core's own daypart times");
  assert.ok(src.includes("sphere-spark-proposal-chips") || src.includes("proposal-chip"), "the proposal card renders its chips");
  assert.ok(src.includes("What's on today") && src.includes("Make me a schedule"), "the greeting offers the common first steps as taps");
  assert.ok(src.includes("Nothing is written until you say yes"), "the proposal still says the law out loud (the scheduling pin)");
  assert.ok(src.includes("SphereSparkScheduleGate"), "the panel publishes the child-mode gate for the rail");
  assert.ok(src.includes("Replies are named as they come"), "the privacy note is the short form");
  assert.ok(!src.includes("Your record's summary —"), "the long privacy wall is gone");
});

test("the rail: one-tap completion, gated and verified like the panel's", () => {
  const src = read("docs/assets/js/sphere-spark-schedule.js");
  assert.ok(src.includes("renderStanding"), "the rail lists what stands, not only day ticks");
  assert.ok(src.includes("completeFromRail"), "completion from the rail has its own named road");
  assert.ok(src.includes("completionAllowed"), "the Done buttons answer to the gate");
  assert.ok(src.includes("SphereSparkScheduleGate"), "the gate is the panel's published question — the layer reads no store");
  assert.ok(!src.includes("localStorage"), "the marker layer still keeps no store of its own");
  const at = src.indexOf("async function completeFromRail");
  const body = src.slice(at, at + 1400);
  assert.ok(body.includes("completePlan"), "the rail completes through the one planner path");
  assert.ok(body.includes("isCompleted"), "the rail verifies the completion stands before it trusts it");
  assert.ok(body.includes("recordWitness"), "a rail completion counts the day witnessed, as the panel's does (Nov 23 ruling)");
  assert.ok(body.includes("completionAllowed()"), "the write itself re-checks the gate, not only the button's rendering");
  assert.ok(src.includes("openRail()"), "a beacon tap opens the strip where its day's things stand");
});

test("the mind's road to the Sphere is one breath, and still names itself", () => {
  const mind = read("docs/assets/js/spark-keeper-mind.js");
  assert.ok(mind.includes("Scheduling itself lives on the Sphere"), "the road still names itself (the scheduling pin)");
  assert.ok(mind.includes("Here I can read what stands"), "the short form of the road stands");
});
