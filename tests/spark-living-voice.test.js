"use strict";

/* The Spark's living voice, stage 1 (Aaron, Nov 19, 2026):
 * their sound is not a switch and not a sound pack. These
 * tests hold the fences the design names:
 *  - identity: the living layer reads the frozen v1 voice
 *    (chirp root, sound family, voice box) and adds exactly
 *    one new deterministic stream — same seed, same motif,
 *    forever; the v1 derivations themselves are untouched.
 *  - growth: the repertoire is computed from the record —
 *    body stage, distinct days together, kept practice days —
 *    never stored, never bought, never reset.
 *  - presence: waiting / awake / nightwatch / resting / away
 *    / a kept quiet promise decide whether they sound; there
 *    is no on/off toggle left in the panel.
 *  - interactions: tap, hold (name-call), stroke, the living
 *    call-and-response, the record-only day remark, and the
 *    moment answer are all wired in the presence. */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const Core = require("../docs/assets/js/spark-companion.js");

const read = (rel) => fs.readFileSync(path.join(__dirname, "..", rel), "utf8");

const SEED_A = Core.makeSeed({ moon: 8, patternDay: 216, kindIndex: 1, nonce: "ab12cd34" });
const SEED_B = Core.makeSeed({ moon: 8, patternDay: 216, kindIndex: 1, nonce: "zz98yy76" });

const days = (n) => Array.from({ length: n }, (_, i) => i + 1);
function recordFor(companion, over = {}) {
  return {
    seed: companion.seed,
    pagesSeen: [],
    practiceDays: [],
    daysSeen: [],
    growth: 0,
    ...over
  };
}

test("living voice identity: pinned to the seed, built only from the frozen v1 voice", () => {
  const a = Core.generate(SEED_A);
  const living = Core.livingVoiceIdentityFor(a);
  assert.equal(living.version, "living-voice/1");
  /* The v1 voice, read — never re-rolled. */
  const chirp = Core.chirpFor(a);
  const sound = Core.soundFor(a);
  assert.equal(living.tonic, chirp.first, "the motif stands on their own chirp root");
  assert.deepEqual(living.greeting, [chirp.first, chirp.second], "their greeting pair is untouched");
  assert.equal(living.family, sound.family, "their family is the family soundFor settled");
  assert.equal(living.familyName, sound.familyName);
  assert.deepEqual(living.box, Core.voiceBoxFor(a), "their voice box is the v1 box, whole");
  /* The one new stream, pinned: this seed's motif is this
   * motif on every device, every load, forever. */
  assert.deepEqual(living.signatureSteps, [0, 2, 3, 3, 1], "SEED_A's signature steps are pinned");
  assert.deepEqual(
    living.signature.map((n) => n.f0),
    [458, 572.5, 611.4, 611.4, 515.3],
    "SEED_A's signature pitches are pinned"
  );
  assert.deepEqual(living.variationSteps, [4, 3], "the Guardian variation is pinned too");
  assert.deepEqual(Core.livingVoiceIdentityFor(a), living, "same seed, same living voice, twice");
  /* Every note stands on their own scale, off their own root. */
  for (const note of [...living.signature, ...living.variation]) {
    assert.ok(note.f0 >= living.tonic * 0.99 && note.f0 <= living.tonic * 2.01, "notes stay on their scale");
    assert.ok(note.dur >= 0.08 && note.dur <= 0.22, "notes stay brief");
  }
  /* A different seed grows a different motif. */
  const b = Core.generate(SEED_B);
  const livingB = Core.livingVoiceIdentityFor(b);
  assert.notDeepEqual(livingB.signatureSteps, living.signatureSteps, "another seed, another motif");
  assert.equal(Core.livingVoiceIdentityFor(null), null, "no companion, no living voice");
});

test("living voice growth: computed from the record — stage, days, practices", () => {
  const a = Core.generate(SEED_A);
  const growthOf = (over) => Core.livingVoiceGrowthFor({ record: recordFor(a, over), companion: a });

  const young = growthOf({});
  assert.equal(young.id, "spark");
  assert.equal(young.name, "Spark voice");
  assert.equal(young.maxNotes, 1, "a new Spark sounds one note of the motif");

  /* The life path: days together plus a kept practice. */
  assert.equal(growthOf({ daysSeen: days(3) }).id, "spark", "days alone, no practice yet, stay young");
  const kindled = growthOf({ daysSeen: days(3), practiceDays: [92] });
  assert.equal(kindled.id, "kindled");
  assert.equal(kindled.maxNotes, 2);
  assert.equal(kindled.daysTogether, 3);
  assert.equal(kindled.practiceDays, 1);
  assert.ok(kindled.basis.some((b) => b.includes("3 distinct days")), "the basis is stated, not hidden");

  /* The body path: growth points alone can kindle a voice —
   * nine return days earn Kindled's points with no practice at
   * all, and the voice follows the body. */
  assert.equal(growthOf({ daysSeen: days(9) }).id, "kindled", "body stage 2 (Kindled) kindles the voice");

  const bearer = growthOf({ daysSeen: days(14), practiceDays: days(5) });
  assert.equal(bearer.id, "bearer");
  assert.equal(bearer.maxNotes, 5, "a Bearer sings the whole signature motif");
  const pages = Array.from({ length: 10 }, (_, i) => `page-${i}.html`);
  assert.equal(
    growthOf({ daysSeen: days(14), pagesSeen: pages }).id,
    "bearer",
    "body stage 3 (Guardian) carries the motif even before the life path ripens"
  );

  /* Guardian is earned by a life, not a stage alone: the
   * fullest body AND sixty distinct days AND twenty kept
   * practice days. Guardian without the days stays Bearer. */
  assert.equal(growthOf({ growth: 25, daysSeen: days(59), practiceDays: days(20) }).id, "bearer");
  assert.equal(growthOf({ growth: 25, daysSeen: days(60), practiceDays: days(19) }).id, "bearer");
  const guardian = growthOf({ growth: 25, daysSeen: days(60), practiceDays: days(20) });
  assert.equal(guardian.id, "guardian");
  assert.equal(guardian.name, "Guardian voice");
  assert.equal(guardian.maxNotes, 7, "a Guardian sings the motif with its variation");

  /* Distinct days are counted, not raw entries. */
  assert.equal(growthOf({ daysSeen: [5, 5, 5, 9] }).daysTogether, 2, "a day lived twice is one day");
});

test("living voice plan: the repertoire follows the growth, the context shapes the answer", () => {
  const a = Core.generate(SEED_A);
  const plan = (over, ctx, extra = {}) =>
    Core.livingVoicePlanFor({ companion: a, record: recordFor(a, over), context: ctx, hour: 12, ...extra });

  assert.equal(plan({}, "tap").notes.length, 1, "a young Spark's tap is one chirp");
  assert.equal(plan({}, "hold").notes.length, 1, "even a name-call cannot sing what is not grown");
  assert.equal(plan({ daysSeen: days(3), practiceDays: [92] }, "tap").notes.length, 2);
  assert.equal(plan({ daysSeen: days(3), practiceDays: [92] }, "stroke").notes.length, 2);
  const bearer = { daysSeen: days(14), practiceDays: days(5) };
  assert.equal(plan(bearer, "tap").notes.length, 3, "a Bearer's tap is a small motif");
  assert.equal(plan(bearer, "hold").notes.length, 5, "a name-call sings the whole motif");
  assert.equal(plan(bearer, "call").notes.length, 5, "the call is the whole motif");
  const guardian = { growth: 25, daysSeen: days(60), practiceDays: days(20) };
  const full = plan(guardian, "hold");
  assert.equal(full.notes.length, 7, "a Guardian's name-call is a melodic sentence");
  assert.deepEqual(
    full.notes.map((n) => n.step),
    [...Core.livingVoiceIdentityFor(a).signatureSteps, ...Core.livingVoiceIdentityFor(a).variationSteps],
    "the sentence is their motif plus their variation — nothing imported"
  );
  /* A stroke is the motif slowed and softened in glide. */
  const stroke = plan(bearer, "stroke");
  const plain = plan(bearer, "tap");
  assert.ok(stroke.notes[0].dur > plain.notes[0].dur, "a stroke lingers longer on each note");
  /* The sentence still answers its words: a question lifts,
   * a statement settles — the living layer keeps the rule. */
  const q = plan(bearer, "line", { text: "Shall we wander on?" });
  assert.ok(q.notes[q.notes.length - 1].glide > 1, "a question's last note lifts");
  const s = plan(bearer, "line", { text: "We wander on." });
  assert.ok(s.notes[s.notes.length - 1].glide < 1, "a statement's last note settles");
  assert.deepEqual(plan(bearer, "hold"), plan(bearer, "hold"), "the same life sings the same answer twice");
  assert.deepEqual(
    Core.livingVoicePlanFor({ companion: null, record: null, context: "tap" }).notes,
    [],
    "no companion, no plan"
  );
});

test("living voice presence: states, not switches", () => {
  const a = Core.generate(SEED_A);
  const grown = recordFor(a, { growth: 25, daysSeen: days(60), practiceDays: days(20) });
  const plan = (extra) =>
    Core.livingVoicePlanFor({ companion: a, record: grown, context: "hold", hour: 12, ...extra });

  assert.equal(plan({ greeted: false }).presence.id, "waiting", "ungreeted, they wait — silent");
  assert.deepEqual(plan({ greeted: false }).notes, []);
  const awake = plan({});
  assert.equal(awake.presence.id, "awake");
  assert.equal(awake.notes.length, 7);
  assert.equal(awake.level, 1);
  const night = plan({ hour: 23 });
  assert.equal(night.presence.id, "nightwatch", "the night hours are kept quieter");
  assert.equal(night.notes.length, 3, "nightwatch trims the sentence");
  assert.ok(night.level < awake.level, "nightwatch is softer");
  assert.equal(plan({ hour: 4 }).presence.id, "nightwatch");
  assert.equal(plan({ hour: 5 }).presence.id, "awake", "the watch ends at five");
  assert.equal(plan({ hour: 21 }).presence.id, "awake");
  assert.equal(plan({ hour: 22 }).presence.id, "nightwatch", "the watch begins at ten");
  const resting = plan({ still: true });
  assert.equal(resting.presence.id, "resting", "still mode is a resting Spark, not a muted one");
  assert.deepEqual(resting.notes, []);
  assert.equal(plan({ hidden: true }).presence.id, "away", "a hidden tab is never sounded into");
  assert.deepEqual(plan({ hidden: true }).notes, []);
  const promise = plan({ legacyQuiet: true });
  assert.equal(promise.presence.id, "quiet-promise", "an earlier quiet choice is kept, not overridden");
  assert.deepEqual(promise.notes, []);
});

test("living call-and-response: their motif, on pads tuned to their tonic", () => {
  const a = Core.generate(SEED_A);
  const grown = recordFor(a, { growth: 25, daysSeen: days(60), practiceDays: days(20) });
  const call = Core.livingCallFor({ companion: a, record: grown, hour: 12 });
  const identity = Core.livingVoiceIdentityFor(a);
  assert.equal(call.pads.length, 4, "four pads, as the echo game has always had");
  assert.deepEqual(
    call.pads.map((p) => p.note),
    [1, 1.25, 1.5, 2].map((r) => Math.round(identity.tonic * r)),
    "the pads are tuned to their own root"
  );
  assert.equal(call.steps.length, 5, "a Guardian's call is the whole signature motif");
  assert.ok(call.steps.every((s) => s >= 0 && s <= 3), "every step lands on a pad");
  const young = Core.livingCallFor({ companion: a, record: recordFor(a), hour: 12 });
  assert.equal(young.steps.length, 1, "a young Spark calls with one note");
  const resting = Core.livingCallFor({ companion: a, record: grown, hour: 12, still: true });
  assert.deepEqual(resting.steps, [], "resting, there is no call to answer");
});

test("the day remark: record-only facts, nothing invented", () => {
  const a = Core.generate(SEED_A);
  const today = { moon: 8, day: 21, dayOfPatternYear: 217, moonName: "Deep Mirror" };
  const remark = Core.livingDayRemarkFor({
    record: recordFor(a, { daysSeen: days(3), practiceDays: [217] }),
    companion: a,
    today,
    hour: 10
  });
  assert.ok(remark.line.includes("Moon 8 · Day 21 · Pattern Day 217"), "the coordinate is the calendar's");
  assert.ok(remark.line.includes("Under Deep Mirror"), "the moon is named as the calendar names it");
  assert.ok(remark.line.includes("Practice is sealed for today"), "a kept practice is stated as kept");
  assert.ok(remark.line.includes("3 days together"), "the life together is counted from the record");
  const unsealed = Core.livingDayRemarkFor({
    record: recordFor(a, { daysSeen: days(3), practiceDays: [216] }),
    companion: a,
    today,
    hour: 10
  });
  assert.ok(unsealed.line.includes("No practice is sealed for today"), "an unkept practice is stated plainly");
  const withFarm = Core.livingDayRemarkFor({
    record: recordFor(a),
    companion: a,
    today,
    hour: 10,
    farmNote: "Kale can go out this week in Lewis County."
  });
  assert.ok(withFarm.line.includes("Kale can go out this week"), "a supplied farm note is carried as supplied");
  const bare = Core.livingDayRemarkFor({ record: recordFor(a), companion: a, today: null, hour: 10 });
  assert.ok(!/Moon \d/.test(bare.line), "no day handed in, no day invented");
});

test("the presence carries the living voice — and no toggle remains", () => {
  const presence = read("docs/assets/js/spark-presence.js");
  for (const hook of [
    "livingVoicePlanFor",
    "livingVoiceIdentityFor",
    "livingVoiceGrowthFor",
    "livingCallFor",
    "livingDayRemarkFor",
    "doVoiceRoom",
    "doNameCall",
    "doDayRemark",
    "spark-voice-hear",
    "spark-voice-day",
    "livingLegacyQuiet",
    "livingStill"
  ]) {
    assert.ok(presence.includes(hook), `the presence carries ${hook}`);
  }
  /* The switches are gone from the panel's language: the More
   * state offers a Voice room, not two toggles, and no toggle
   * function survives anywhere in the file. */
  assert.ok(!presence.includes("toggleVoice"), "no voice toggle remains");
  assert.ok(!presence.includes("toggleSounds"), "no sounds toggle remains");
  assert.ok(!presence.includes('bubbleBtn("Sounds"'), "the More state has no Sounds bubble");
  const moreAt = presence.indexOf("function showMore(");
  const more = presence.slice(moreAt, moreAt + 700);
  assert.ok(more.includes('bubbleBtn("Voice", "◉", doVoiceRoom, "spark-presence-voice"'), "More opens the Voice room");
  /* The interactions are wired at the hand: tap answers as a
   * tap, a stroke as a stroke, a hold as a name-call, a real
   * completion as a moment. */
  assert.ok(presence.includes('vocalize(beatLine("poke"), "tap")'), "a tap answers as a tap");
  assert.ok(presence.includes('vocalize(beatLine("pet"), "stroke")'), "a stroke answers as a stroke");
  assert.ok(presence.includes("650"), "the hold is timed at ~650ms");
  assert.ok(presence.includes('announceLine(line, "moment")'), "a kept moment answers with the moment motif");
  /* Their record states the voice growth beside the sound. */
  assert.ok(presence.includes('"Voice:"'), "the record panel carries a Voice row");
  /* No sound before a greeting, none into a hidden tab: the
   * plan is always built through the presence helper. */
  assert.ok(presence.includes("greeted: voiceArmed"), "the plan is gated on the greeting");
  assert.ok(presence.includes("hidden: document.hidden"), "the plan is gated on the tab standing open");
});
