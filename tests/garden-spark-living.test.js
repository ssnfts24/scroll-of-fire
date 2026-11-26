"use strict";
/*
 * The garden deepening (Aaron, Nov 26, 2026): the garden made
 * better as a living place — presence, day-truth, and the
 * Spark's attendance — inside the living layer only. The
 * garden's four calls from Nov 23 stand assistant-inferred
 * and unratified: nothing here enacts them; this pass improves
 * the living experience and decides nothing.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const LIVING = fs.readFileSync(path.join(__dirname, "..", "docs/assets/js/spark-living.js"), "utf8");
const CSS = fs.readFileSync(path.join(__dirname, "..", "docs/assets/css/spark-companion.css"), "utf8");
const GARDEN = fs.readFileSync(path.join(__dirname, "..", "docs/garden.html"), "utf8");

test("the garden of finds keeps what keeper and Spark found together", () => {
  assert.ok(LIVING.includes("gardenOfFinds"), "the finds garden stands");
  assert.ok(LIVING.includes("What you have found together"), "it is named for the two of them");
  assert.ok(LIVING.includes("sof.cards.v1.k"), "blooms are counted from the keeper's own album store");
});

test("the thirteen beds stand in miniature, day-true", () => {
  assert.ok(LIVING.includes("spark-beds-dot"), "one bed per Moon");
  assert.ok(LIVING.includes("is-today"), "today's bed is ringed");
  assert.ok(LIVING.includes("is-held"), "a bed lights where its Moon's card is held");
  assert.ok(LIVING.includes("Today the garden stands in Moon"), "the day is read aloud in the garden");
  assert.ok(CSS.includes(".spark-beds-dot.is-held"), "the beds have their styles");
});

test("the Spark tends the garden while it walks there", () => {
  assert.ok(LIVING.includes("is-gardening"), "the walker gardens on the garden page");
  assert.ok(CSS.includes("spark-garden-bob"), "a gentle tending motion, reduced-motion safe");
  assert.ok(CSS.includes("prefers-reduced-motion"), "stillness is honoured");
});

test("the deepening lives in the living layer — the garden page itself is untouched machinery", () => {
  assert.ok(GARDEN.includes('id="garden-beds"'), "the Atlas beds stand as they were");
  assert.ok(!GARDEN.includes("spark-beds-dot"), "no inferred calls were enacted into the page");
});
