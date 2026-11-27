/*
 * Aiyana's Spark — a REAL Spark, proven against the canonical
 * core itself.
 *
 * Aaron's ruling (Nov 26, 2026): "Her spark should generate
 * like all the other sparks. And be like all the other
 * sparks." So these tests do not test a copy of the Spark law —
 * they import the site's own SparkCompanion core and pin that
 * the dashboard's road runs through it: the same seed makes
 * the same Spark (name, kind, figure, byte for byte), growth
 * counts only her real acts, and the guide that speaks for her
 * Spark answers only from the state it is handed — and says
 * plainly when it does not know.
 *
 * The worked example below is a fixed seed, so the Spark it
 * names is the same in every run: seed spark1-8-224-2-42.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import SparkCompanion from "../docs/assets/js/spark-companion.js";
import AiyanaGuide from "../docs/assets/js/aiyana-guide.js";

const SEED = "spark1-8-224-2-42";

test("the same seed generates the same Spark as the canonical core", () => {
  const a = SparkCompanion.generate(SEED);
  const b = SparkCompanion.generate(SEED);
  assert.equal(a.name, b.name);
  assert.equal(a.kind, b.kind);
  assert.equal(a.kindName, b.kindName);
  assert.equal(a.temperament, b.temperament);
  assert.equal(a.trait, b.trait);
  assert.deepEqual(a.form, b.form);
  assert.deepEqual(a.palette, b.palette);
  /* The figure is the seed's figure, byte for byte. */
  assert.equal(
    SparkCompanion.renderSVG(a, { stage: 0 }),
    SparkCompanion.renderSVG(b, { stage: 0 })
  );
  /* The worked example, named: this seed's Spark. */
  assert.equal(a.name, "Veor");
  assert.equal(a.kindName, "Shadow");
});

test("the dashboard mints her Spark through the canonical core, once", async () => {
  const src = await readFile(new URL("../docs/assets/js/aiyana-dashboard.js", import.meta.url), "utf8");
  /* The seed is made the canonical way — the day's coordinate
     chooses the kind, a fresh nonce salts it, makeSeed speaks it. */
  assert.ok(src.includes("Core.resolveKindIndex({ moon: today.moon, patternDay: today.patternDay, answers: [] })"));
  assert.ok(src.includes("Core.makeSeed({"));
  assert.ok(src.includes("Core.randomNonce()"));
  /* The record is the core's own newRecord, kept through the
     door store — never a device-only keepsake. */
  assert.ok(src.includes("Core.newRecord({ seed: spark.pendingSeed, name: \"\", civilDate: civilToday() })"));
  assert.ok(src.includes('call({ action: "spark-meet", token: token, seed: spark.pendingSeed, record: record })'));
  assert.ok(src.includes('call({ action: "spark-get", token: token })'));
  /* Her Spark is met on her dashboard only — it never stands
     on her public page. */
  const page = await readFile(new URL("../docs/aiyanas-world.html", import.meta.url), "utf8");
  assert.ok(!page.includes("spark-companion"));
  assert.ok(!page.includes("aiyana-guide"));
});

test("growth counts only her real acts", () => {
  const fresh = SparkCompanion.newRecord({ seed: SEED, name: "", civilDate: "2026-11-26" });
  const untouched = SparkCompanion.growthPoints(fresh);
  assert.equal(SparkCompanion.stageOf(fresh).index, 0);
  /* A visit on a new day is a real act. */
  const visited = SparkCompanion.recordVisit(fresh, { patternDay: 225, page: "aiyana-dashboard.html" });
  assert.ok(SparkCompanion.growthPoints(visited) > untouched);
  /* Reading and writing are practice days. */
  const practiced = SparkCompanion.recordPractice(visited, { patternDay: 226 });
  assert.ok(SparkCompanion.growthPoints(practiced) > SparkCompanion.growthPoints(visited));
  /* Nothing grows from nothing: the same record, re-read,
     holds the same points. */
  assert.equal(SparkCompanion.growthPoints(fresh), untouched);
  /* Enough real acts carry the Spark to its next stage. */
  let r = fresh;
  for (let d = 1; d <= 12; d++) {
    r = SparkCompanion.recordVisit(r, { patternDay: 300 + d, page: "aiyana-dashboard.html" });
    r = SparkCompanion.recordPractice(r, { patternDay: 300 + d });
  }
  assert.ok(SparkCompanion.stageOf(r).index >= 1);
});

/* ---------- The guide: grounded answers, honest unknowns ---------- */

function world(over) {
  return Object.assign({
    spark: { name: "Veor", kindName: "Shadow" },
    pending: [{ id: "a" }, { id: "b" }],
    approved: [{ id: "s1", title: "The Brave Little Boat" }],
    mine: [{ id: "m1", title: "My Dragon" }],
    awayCount: 0,
    garden: [{ word: "enormous", kind: "learned" }, { word: "flibber", kind: "invented" }],
    page: { welcome: "Hi!", mood: null, trim: null, banner: null, topPicture: null, featuredTitle: null, favourites: [] }
  }, over || {});
}

test("the greeting names her Spark and what is waiting", () => {
  const g = AiyanaGuide.greeting(world());
  assert.ok(g.line.startsWith("Hi Aiyana! I'm Veor, your Spark."));
  assert.ok(g.line.includes("Two stories are waiting for you"));
  assert.equal(g.steps.length, 4);
  const none = AiyanaGuide.greeting(world({ pending: [] }));
  assert.ok(none.line.includes("No stories are waiting"));
});

test("answers come from the state handed in — and only from it", () => {
  assert.ok(AiyanaGuide.answer("waiting", world()).includes("Two stories are waiting"));
  assert.ok(AiyanaGuide.answer("waiting", world({ pending: [] })).includes("No stories are waiting"));
  assert.ok(AiyanaGuide.answer("on-my-page", world()).includes("The Brave Little Boat"));
  assert.ok(AiyanaGuide.answer("what-i-wrote", world()).includes("My Dragon"));
  assert.ok(AiyanaGuide.answer("what-i-wrote", world({ mine: [] })).includes("haven't written"));
  assert.ok(AiyanaGuide.answer("word-garden", world()).includes("enormous"));
  assert.ok(AiyanaGuide.answer("word-garden", world()).includes("flibber"));
});

test("an unknown question is admitted, never invented", () => {
  assert.equal(AiyanaGuide.answer("the-weather", world()), null);
  assert.equal(AiyanaGuide.answer("", world()), null);
  const src = readFile(new URL("../docs/assets/js/aiyana-dashboard.js", import.meta.url), "utf8");
  return src.then((s) => {
    assert.ok(s.includes("I don't know that one yet — but I'm learning!"));
  });
});

/* ---------- The spelling friend ---------- */

test("a misspelling gets a kind, confident fix — checking never changes text", () => {
  const r = AiyanaGuide.checkWord("becuase", {});
  assert.equal(r.kind, "fix");
  assert.equal(r.suggestion, "because");
  assert.equal(AiyanaGuide.checkWord("siad", {}).suggestion, "said");
  assert.equal(AiyanaGuide.checkWord("happend", {}).suggestion, "happened");
  /* checkWord is a pure look: it returns advice and holds no
     pen. The dashboard applies a fix only on her tap (pinned
     in the source test below). */
});

test("real words in their working clothes are left alone", () => {
  for (const w of ["happened", "whispered", "stories", "butterflies", "puppies",
    "giggling", "stopped", "ladies", "teeth", "leaves", "tomatoes", "wolves",
    "knives", "geese", "mice", "feet", "enormous", "whisper", "because",
    "warm", "toast", "morning", "danced", "sparkles", "floating", "rainbow"]) {
    assert.equal(AiyanaGuide.checkWord(w, {}).kind, "fine", w);
  }
  /* A capital in the middle of a sentence is a name, and
     names are hers to spell. */
  assert.equal(AiyanaGuide.checkWord("Zorblax", { capitalized: true, sentenceStart: false }).kind, "fine");
});

test("an unknown word is met with welcome, never a flag", () => {
  const r = AiyanaGuide.checkWord("flibber", {});
  assert.equal(r.kind, "unknown");
  const line = AiyanaGuide.unknownWordLine("flibber");
  assert.ok(line.includes("Ooh, I haven't met the word"));
  assert.ok(line.includes("Made-up words are welcome here"));
  assert.ok(line.includes("writers invent the best ones"));
  /* Once it is hers — in her garden — it is never asked about again. */
  const after = AiyanaGuide.checkWord("flibber", { garden: ["flibber"] });
  assert.equal(after.kind, "fine");
  /* A word she keeps is left alone too. */
  const kept = AiyanaGuide.checkWord("becuase", { kept: true });
  assert.equal(kept.kind, "fine");
});

test("her writing changes only on her tap — the friend holds no pen", async () => {
  const src = await readFile(new URL("../docs/assets/js/aiyana-dashboard.js", import.meta.url), "utf8");
  /* The only road from a suggestion to her text is the
     "Fix it" button's own handler calling replaceWord. */
  assert.ok(src.includes('label: "Fix it"'));
  assert.ok(src.includes("replaceWord(activeField, word, suggestion, start, end)"));
  /* The friend watches finished words — a separator or leaving
     the field — never letter by letter. */
  assert.ok(src.includes('field.addEventListener("input"'));
  assert.ok(src.includes('field.addEventListener("blur"'));
  /* Aaron's praise rides with every fix offer. */
  assert.ok(src.includes("You're doing a good job though!"));
  /* And the invented-word buttons are the warm pair. */
  assert.ok(src.includes('"It\'s mine!"'));
  assert.ok(src.includes('"Help me fix it"'));
  /* Praise never swallows teaching: a wow bubble yields the
     moment a fix or a new word needs the bubble. */
  assert.ok(src.includes("if ((busy && !busyIsWow) || !Guide) return;"));
});

test("the reading chair knows simple meanings and admits the rest", () => {
  assert.ok(AiyanaGuide.meaningOf("enormous").includes("very, very big"));
  assert.ok(AiyanaGuide.meaningOf("whisper"));
  assert.equal(AiyanaGuide.meaningOf("flibber"), null);
  /* A wow word earns its specific praise. */
  assert.equal(AiyanaGuide.wowWord("enormous").word, "enormous");
  assert.equal(AiyanaGuide.wowWord("the"), null);
});
