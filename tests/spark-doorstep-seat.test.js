"use strict";

/*
 * Pass 8b — the doorstep clears the Spark's seat at every
 * width (Aaron's standing bar, Nov 26, 2026: the blocks work
 * on all screens).
 *
 * Pass 8 stood the doorstep clear of the seat with two moves,
 * measured from the seat that stands on the page: if the seat
 * rests on the right half, the invitation narrows to its clear
 * side; if on the left half, it steps to the seat's right. The
 * all-widths walk found the third case standing open: at
 * tablet widths (768px measured) the Spark comes home to the
 * centre of the bottom shore — its seat astride the midline
 * (x 366–475 across the 384 midline) — and neither side move
 * clears it, so the invitation lay across the figure by some
 * five thousand square pixels. The third move stands the
 * invitation above the seat instead, on the same shore.
 *
 * The measured proof is the pass 8b browser walk at 360, 430,
 * 768 and 1280px (captures pass8b-*); these pins hold the
 * structure that produces it.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

test("the doorstep's seat clearance carries all three moves", () => {
  const src = read("docs/assets/js/spark-living.js");
  const start = src.indexOf("The Spark's own seat stands on the same shore");
  assert.ok(start >= 0, "the seat clearance stands in spark-living.js");
  const block = src.slice(start, start + 5600);
  assert.ok(block.includes("s.left >= window.innerWidth / 2"), "seat on the right half: the invitation narrows");
  assert.ok(block.includes("s.right <= window.innerWidth / 2"), "seat on the left half: the invitation steps right");
  assert.ok(
    block.includes("chip.style.bottom = `${Math.ceil(window.innerHeight - s.top + 8)}px`"),
    "seat astride the middle: the invitation stands above the seat"
  );
  assert.ok(block.includes("crosses"), "every move is gated on an actual crossing, measured from the standing seat");
});

test("the clearance is re-taken once the Spark settles — a bounded watch, not a single measure", () => {
  const src = read("docs/assets/js/spark-living.js");
  const start = src.indexOf("The Spark's own seat stands on the same shore");
  const block = src.slice(start, start + 5600);
  assert.ok(block.includes("const clearOfSeat = () =>"), "the clearance is one re-runnable measure");
  assert.ok(block.includes("window.setInterval"), "a watch re-measures while the Spark glides home");
  assert.ok(block.includes("stablePolls >= 2"), "a re-measure waits for the seat to stand still, so the chip never jitters");
  assert.ok(block.includes("polls > 32"), "the watch is bounded");
  assert.ok(block.includes("!chip.isConnected"), "the watch ends with the invitation");
});

test("the changed living layer rides a fresh loader from the presence", () => {
  const presence = read("docs/assets/js/spark-presence.js");
  assert.ok(presence.includes("spark-living.js?v=20261126-8"), "the lazy load names the new stamp");
  assert.ok(!presence.includes("spark-living.js?v=20261126-7"), "the old stamp is gone");
});
