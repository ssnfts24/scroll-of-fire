"use strict";

/* The Pattern Quests, rung 1 (Nov 23, 2026 — the play redesign's
 * quest frame): the Spark asks a question answerable only by
 * reading the instrument, the keeper predicts in one tap, hunts
 * the answer out of the Sphere itself, hears the reveal stated
 * as a count, and keeps an answer card in the Life Atlas.
 *
 * These tests pin the fences:
 *  - keepsakes, never points: the card records the learning,
 *    hit or miss, and no score exists anywhere in the frame;
 *  - one offer a day; a kind turned away for good is never
 *    offered again; "not today" costs nothing;
 *  - hints point at the instrument, never at the answer;
 *  - Catch the turning's minute is an attention frame only —
 *    a turning not caught is not recorded;
 *  - the Spark is named, never gendered. */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const JS = path.join(root, "docs/assets/js");

const Quests = require(path.join(JS, "pattern-quests.js"));
const Schema = require(path.join(JS, "life-atlas/life-atlas-schema.js"));

const play = read("docs/assets/js/sphere-play.js");
const spherePage = read("docs/living-time-sphere.html");

function temporal(overrides = {}) {
  return {
    moon: 8,
    patternDay: 220,
    patternYear: 2026,
    civilDate: "2026-11-10",
    ...overrides
  };
}

/* ------------------------------ the quests ---------------------------- */

test("rung 1 is the three built games, reframed — no fourth thing invented", () => {
  assert.deepEqual(Quests.QUESTS.map(q => q.id), ["find-the-day", "echo", "catch-the-turning"]);
  assert.deepEqual(Quests.QUESTS.map(q => q.kind), ["hunt", "echo", "turning"]);
  for (const q of Quests.QUESTS) {
    assert.equal(q.rung, 1);
    assert.ok(q.offer && q.teach && q.close, `${q.id} carries offer, teaching and close`);
  }
  assert.equal(Quests.questFor("hunt").id, "find-the-day");
  assert.equal(Quests.questFor("catch-the-turning").kind, "turning");
  assert.equal(Quests.questFor("nope"), null);
});

test("the questions are answerable only by reading the instrument", () => {
  const hunt = Quests.questFor("hunt");
  assert.equal(
    Quests.questionFor(hunt, { targetMoon: 4, targetDay: 8 }),
    "Where does Moon 4 · Day 8 stand in the count of the year?"
  );
  assert.equal(Quests.questionFor(hunt, {}), null, "no target, no question — never a made-up one");
  assert.equal(Quests.questionFor(Quests.questFor("echo"), {}), "How many notes does your Spark's motif sing?");
  assert.equal(Quests.questionFor(Quests.questFor("turning"), {}), "How many times does the day's light turn?");
});

test("the reveal is stated as a count, and the prediction is judged against the instrument's own facts", () => {
  const hunt = Quests.questFor("hunt");
  /* Aaron's fixture: Moon 4 · Day 8 = Pattern Day 92 — first half. */
  const first = Quests.judge(hunt, "first-half", { patternDay: 92, targetMoon: 4, targetDay: 8 });
  assert.equal(first.correct, true);
  assert.equal(first.count, 92);
  assert.match(first.revealText, /Pattern Day 92 of 364/);
  const missed = Quests.judge(hunt, "first-half", { patternDay: 300, targetMoon: 11, targetDay: 20 });
  assert.equal(missed.correct, false);
  assert.equal(missed.count, 300);
  assert.match(missed.revealText, /second half/);
  assert.equal(Quests.judge(hunt, "first-half", {}), null, "no fact, no verdict");

  const echo = Quests.judge(Quests.questFor("echo"), "3", { notes: 3 });
  assert.equal(echo.correct, true);
  assert.equal(echo.count, 3);
  assert.equal(Quests.judge(Quests.questFor("echo"), "2", { notes: 3 }).correct, false);

  const turning = Quests.judge(Quests.questFor("turning"), "4", { band: "dusk" });
  assert.equal(turning.correct, true);
  assert.equal(turning.count, 4);
  assert.match(turning.revealText, /four times/);
  assert.match(turning.revealText, /dusk/);
  assert.equal(Quests.judge(Quests.questFor("turning"), "6", { band: "dusk" }).correct, false);
});

test("hints point at the instrument and never state the answer", () => {
  for (const q of Quests.QUESTS) {
    const hint = Quests.hintFor(q);
    assert.ok(hint && hint.length > 20, `${q.id} has a real hint`);
  }
  assert.ok(!/\b92\b/.test(Quests.hintFor(Quests.questFor("hunt"))), "the hunt hint does not leak a count");
});

/* --------------------------- the offer memory -------------------------- */

test("one offer a day, rotating kinds, and a dismissed kind is never offered again", () => {
  const kinds = ["hunt", "echo", "turning"];
  let memory = Quests.emptyMemory();
  assert.equal(Quests.chooseOfferKind(memory, "2026-11-10", kinds), "hunt");
  memory = Quests.noteOffer(memory, "2026-11-10");
  assert.equal(Quests.chooseOfferKind(memory, "2026-11-10", kinds), null, "no second offer the same day");
  assert.equal(Quests.chooseOfferKind(memory, "2026-11-11", kinds), "echo", "the offer rotates");

  const deferred = Quests.deferOffer(Quests.emptyMemory(), "2026-11-10");
  assert.equal(Quests.chooseOfferKind(deferred, "2026-11-10", kinds), null, "not today spends today's offer");
  assert.equal(Quests.chooseOfferKind(deferred, "2026-11-11", kinds), "hunt", "and costs nothing tomorrow");

  const dismissed = Quests.dismissKind(Quests.emptyMemory(), "hunt");
  for (const day of ["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"]) {
    assert.notEqual(Quests.chooseOfferKind(dismissed, day, kinds), "hunt");
  }
  const allGone = Quests.dismissKind(Quests.dismissKind(Quests.dismissKind(Quests.emptyMemory(), "hunt"), "echo"), "turning");
  assert.equal(Quests.chooseOfferKind(allGone, "2026-11-10", kinds), null, "every kind turned away: silence, respected");
});

test("the offer memory is immutable and round-trips through its storage text", () => {
  const frozen = Object.freeze(Quests.emptyMemory());
  const noted = Quests.noteOffer(frozen, "2026-11-10");
  assert.equal(frozen.lastOfferCivilDate, null, "the original memory is untouched");
  assert.equal(noted.offerCount, 1);
  const round = Quests.parseMemory(Quests.serializeMemory(Quests.dismissKind(noted, "echo")));
  assert.deepEqual(round.dismissedKinds, ["echo"]);
  assert.equal(round.lastOfferCivilDate, "2026-11-10");
  assert.deepEqual(Quests.parseMemory("not json"), Quests.emptyMemory());
  assert.deepEqual(Quests.parseMemory(null), Quests.emptyMemory());
});

/* ----------------------------- the answer card ------------------------- */

test("the answer card is a Life Atlas artifact that passes the canonical schema", () => {
  const card = Quests.buildAnswerCardRecord(
    {
      questId: "find-the-day",
      question: "Where does Moon 4 · Day 8 stand in the count of the year?",
      predictionId: "first-half",
      predictionCorrect: true,
      reveal: "Moon 4 · Day 8 stands at Pattern Day 92 of 364 — the first half of the year.",
      count: 92
    },
    temporal()
  );
  assert.ok(card);
  assert.equal(card.type, "artifact");
  assert.equal(card.subtype, "quest-answer");
  assert.ok(card.tags.includes("pattern-quest"));
  const created = Schema.createLifeRecord(card);
  assert.ok(created.id);
  const p = created.payload.patternQuest;
  assert.equal(p.questId, "find-the-day");
  assert.equal(p.prediction, "In the first half of the year");
  assert.equal(p.predictionCorrect, true);
  assert.equal(p.count, 92);
  assert.equal(p.moon, 8);
  assert.equal(Quests.buildAnswerCardRecord({ questId: "nope" }, temporal()), null);
});

test("a missed prediction is kept too — the card records the learning, not a score", () => {
  const card = Quests.buildAnswerCardRecord(
    {
      questId: "catch-the-turning",
      question: "How many times does the day's light turn?",
      predictionId: "6",
      predictionCorrect: false,
      reveal: "The day's light turns four times — dawn, day, dusk, night.",
      count: 4
    },
    temporal()
  );
  const p = card.payload.patternQuest;
  assert.equal(p.predictionCorrect, false);
  assert.equal(p.count, 4);
  assert.ok(!("score" in p) && !("points" in p) && !("xp" in p), "no score hides in the card");
});

test("the shelf folds answer cards newest first and ignores everything else", () => {
  const older = Schema.createLifeRecord(Quests.buildAnswerCardRecord(
    { questId: "echo", question: "How many notes does your Spark's motif sing?", predictionId: "3", predictionCorrect: true, reveal: "The motif sang 3 notes — and you held every one.", count: 3 },
    temporal({ civilDate: "2026-11-09" })
  ));
  const newer = Schema.createLifeRecord(Quests.buildAnswerCardRecord(
    { questId: "find-the-day", question: "Where does Moon 4 · Day 8 stand in the count of the year?", predictionId: "second-half", predictionCorrect: false, reveal: "Pattern Day 92 of 364.", count: 92 },
    temporal()
  ));
  older.createdAt = "2026-11-09T12:00:00.000Z";
  newer.createdAt = "2026-11-10T12:00:00.000Z";
  const other = Schema.createLifeRecord({
    type: "note",
    title: "An unrelated record",
    temporal: temporal()
  });
  const frozen = Object.freeze([Object.freeze(older), Object.freeze(other), Object.freeze(newer)]);
  const cards = Quests.foldAnswerCards(frozen);
  assert.equal(cards.length, 2);
  assert.equal(cards[0].questId, "find-the-day", "newest first");
  assert.equal(cards[0].predictionCorrect, false);
  assert.equal(cards[1].questId, "echo");
  assert.ok(Quests.isAnswerCard(newer));
  assert.ok(!Quests.isAnswerCard(other));
});

/* --------------------------- the wiring fences ------------------------- */

test("the Sphere page loads the quest frame before the play room, and the room speaks the fences", () => {
  const questsAt = spherePage.indexOf("assets/js/pattern-quests.js");
  const playAt = spherePage.indexOf("assets/js/sphere-play.js");
  assert.ok(questsAt > -1 && playAt > -1 && questsAt < playAt, "pattern-quests.js loads before sphere-play.js");
  assert.ok(play.includes("CodexPatternQuests"), "the play room uses the quest frame");
  assert.ok(play.includes("finishQuest(\"hunt\""), "the hunt's finish feeds the frame");
  assert.ok(play.includes("finishQuest(\"echo\""), "the echo's finish feeds the frame");
  assert.ok(play.includes("finishQuest(\"turning\""), "the turning's catch feeds the frame");
  assert.ok(play.includes("not caught is not recorded"), "the attention frame's law is on its face");
  assert.ok(play.includes("data-quest-panel"), "the quest panel stands in the room");
  assert.ok(play.includes("data-quest-cards"), "the answer-card shelf stands in the room");
});

test("no points, scores, streaks or rarity anywhere in the quest frame or its wiring", () => {
  const frame = read("docs/assets/js/pattern-quests.js");
  for (const src of [frame, play]) {
    assert.ok(!/\bXP\b|leaderboard|rarity/i.test(src), "the banned economies stay out");
  }
  assert.ok(!/streak/i.test(frame), "no streaks in the frame");
});

test("the Spark is named, never gendered, in the quest frame and the play room", () => {
  const frame = read("docs/assets/js/pattern-quests.js");
  for (const src of [frame, play]) {
    assert.ok(!/\bshe\b|\bher\b/i.test(src.replace(/Sphere/g, "")), "no gendered pronoun for the Spark");
  }
});
