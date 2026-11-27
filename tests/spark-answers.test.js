/*
 * The Spark answers (Aaron, Nov 26, 2026, 19:42 PST: "The
 * spark needs to be way more intelligent"). The intelligence
 * pinned here is a narrow, honest kind: the keeper's own
 * Spark answers plain questions from the keeper's REAL
 * local records — the calendar's day, the record's sealed
 * days, the album's held cards, the lean's counted walks,
 * the room knowledge the tours carry — and never invents.
 * These tests seed a snapshot, ask, and check the answer
 * carries the snapshot's facts; they empty the snapshot
 * and check the Spark admits what it does not know. An
 * unreadable record is answered as unseen, never as empty.
 * The guidance names the keeper's actual things, and a
 * remembered "no" is respected exactly as the lean rules
 * it: refused sleeps a Moon, shown rests a week.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const Answers = require(path.join(root, "docs/assets/js/spark-answers.js"));
const Lean = require(path.join(root, "docs/assets/js/spark-lean.js"));

function world(patch) {
  return Object.assign({
    sparkName: "Selor",
    day: 224,
    today: {
      moon: 8, day: 28, dayOfPatternYear: 224,
      moonName: "Deep Mirror", dayName: "The Mirror Gate",
      dayGloss: "reflection, honestly faced", outside: false
    },
    sealedDays: [200, 210, 223],
    cards: [
      { name: "Deep Mirror", foundDay: 217 },
      { name: "Root Waters", foundDay: 223 }
    ],
    rooms: [
      { page: "index.html", label: "the first page", visits: 12 },
      { page: "garden.html", label: "the Garden", visits: 0 },
      { page: "card-album.html", label: "the Card Album", visits: 4 }
    ],
    moved: null,
    room: { name: "The Garden", about: "The Pattern Garden. Thirteen beds, one for each Moon." },
    spans: { refusal: Lean.REFUSAL_SLEEP_DAYS, rest: Lean.OFFER_REST_DAYS }
  }, patch || {});
}

test("the day answer carries the calendar's own facts — Pattern Day, Moon, the day's name", () => {
  const a = Answers.answer("day", world());
  assert.equal(a.id, "day");
  assert.match(a.text, /Pattern Day 224/);
  assert.match(a.text, /day 28 of Moon 8, the Deep Mirror moon/);
  assert.match(a.text, /The Mirror Gate/);
  assert.match(a.text, /reflection, honestly faced/);
});

test("a typed question finds its answer by plain words", () => {
  assert.equal(Answers.answer("What day is it?", world()).id, "day");
  assert.equal(Answers.answer("what cards do I hold", world()).id, "cards");
  assert.equal(Answers.answer("where haven't I been in a while?", world()).id, "away");
  assert.equal(Answers.answer("what is this room?", world()).id, "room");
  assert.equal(Answers.answer("what should I do next", world()).id, "next");
});

test("the witnessed answer counts the sealed days and names today open", () => {
  const a = Answers.answer("witnessed", world());
  assert.match(a.text, /sealed 3 days/);
  assert.match(a.text, /The last was Pattern Day 223/);
  assert.match(a.text, /Pattern Day 224 — is still open/);
});

test("a sealed today is answered as sealed", () => {
  const a = Answers.answer("witnessed", world({ sealedDays: [223, 224] }));
  assert.match(a.text, /Pattern Day 224 — is already sealed/);
});

test("no sealed days: the Spark says so, and offers today as the first", () => {
  const a = Answers.answer("witnessed", world({ sealedDays: [] }));
  assert.match(a.text, /No days are sealed yet/);
  assert.match(a.text, /Pattern Day 224, could be the first/);
});

test("the cards answer names the held cards and the last one found", () => {
  const a = Answers.answer("cards", world());
  assert.match(a.text, /You hold 2 cards: Deep Mirror, Root Waters\./);
  assert.match(a.text, /The last one you found was Root Waters — Pattern Day 223/);
});

test("an unreadable album is answered as unseen — never as empty", () => {
  const a = Answers.answer("cards", world({ cards: null }));
  assert.match(a.text, /can't see your album from here/);
  assert.ok(!/empty/.test(a.text), "an unseen album is not called empty");
});

test("an empty album is answered as empty, with the road's rule", () => {
  const a = Answers.answer("cards", world({ cards: [] }));
  assert.match(a.text, /album is empty for now/);
  assert.match(a.text, /found by doing the work/);
});

test("found together counts what stands: cards and sealed days", () => {
  const a = Answers.answer("found", world());
  assert.match(a.text, /2 cards in the album and 3 days sealed/);
  const none = Answers.answer("found", world({ cards: [], sealedDays: [] }));
  assert.match(none.text, /Nothing found together yet/);
});

test("the away answer names the room never walked", () => {
  const a = Answers.answer("away", world());
  assert.match(a.text, /haven't walked the Garden yet/);
});

test("with every room walked, the away answer names the least-walked", () => {
  const a = Answers.answer("away", world({
    rooms: [
      { page: "index.html", label: "the first page", visits: 12 },
      { page: "garden.html", label: "the Garden", visits: 2 },
      { page: "card-album.html", label: "the Card Album", visits: 4 }
    ]
  }));
  assert.match(a.text, /the Garden is the one you've walked least — 2 times/);
});

test("no walks counted yet: the Spark admits it hasn't learned them", () => {
  const a = Answers.answer("away", world({ rooms: null }));
  assert.match(a.text, /haven't learned your walks yet/);
});

test("the room answer is the room's own tour knowledge", () => {
  const a = Answers.answer("room", world());
  assert.equal(a.text, "The Pattern Garden. Thirteen beds, one for each Moon.");
  const none = Answers.answer("room", world({ room: null }));
  assert.match(none.text, /don't have this room's story in front of me/);
});

test("a question the Spark cannot ground is answered as not known — never filled in", () => {
  const a = Answers.answer("what is the weather in Everett?", world());
  assert.equal(a.id, "unknown");
  assert.match(a.text, /I don't know that one yet/);
  assert.ok(!/Everett/.test(a.text), "the answer does not pretend to the question's facts");
});

test("an unreadable calendar is admitted, not guessed", () => {
  const a = Answers.answer("day", world({ today: null }));
  assert.match(a.text, /can't read the day from here/);
});

test("a day outside the count is answered as outside — no Pattern Day invented", () => {
  const a = Answers.answer("day", world({
    today: { moon: null, day: null, dayOfPatternYear: null, moonName: "Day Out of Time", dayName: null, dayGloss: null, outside: true }
  }));
  assert.match(a.text, /stands outside the count/);
  assert.ok(!/Pattern Day \d/.test(a.text));
});

/* ---- the guidance: names the keeper's actual things ---- */

test("the next step names the unwitnessed day by its number and Moon", () => {
  const step = Answers.nextStep(world(), { refusals: {}, shown: {} });
  assert.equal(step.id, "mind-open-day");
  assert.match(step.text, /Pattern Day 224, day 28 of the Deep Mirror moon — is still open/);
  assert.equal(step.href, "index.html");
});

test("with today sealed, the next step names the room never walked", () => {
  const step = Answers.nextStep(world({ sealedDays: [200, 210, 223, 224] }), { refusals: {}, shown: {} });
  assert.equal(step.id, "mind-room-garden.html");
  assert.match(step.text, /haven't walked the Garden yet/);
  assert.equal(step.href, "garden.html");
});

test("the card found yesterday is named, once the day and the room stand clear", () => {
  const step = Answers.nextStep(world({
    sealedDays: [200, 210, 223, 224],
    rooms: [
      { page: "index.html", label: "the first page", visits: 12 },
      { page: "garden.html", label: "the Garden", visits: 3 },
      { page: "card-album.html", label: "the Card Album", visits: 4 }
    ]
  }), { refusals: {}, shown: {} });
  assert.equal(step.id, "mind-card");
  assert.match(step.text, /Yesterday you found Root Waters/);
});

test("the warmth outranks the rest, as the lean has always ruled", () => {
  const step = Answers.nextStep(world({
    moved: { text: "The film that moved you is where you left it.", href: "episodes.html", label: "Return to it", day: 220 }
  }), { refusals: {}, shown: {} });
  assert.equal(step.id, "warmth");
});

test("a remembered no is respected: a refused step sleeps, and the next clear thing stands", () => {
  const leanState = { refusals: { "mind-open-day": 220 }, shown: {} };
  const step = Answers.nextStep(world(), leanState);
  assert.equal(step.id, "mind-room-garden.html", "the refused open day is not re-offered inside its Moon");
});

test("a shown step rests a week, then may stand again", () => {
  /* a world where the open day is the only step there is */
  const bare = (day) => world({ day, rooms: null, cards: null, sealedDays: [] });
  const resting = Answers.nextStep(bare(224), { refusals: {}, shown: { "mind-open-day": 220 } });
  assert.equal(resting, null, "four days after it was shown, the step still rests");
  const back = Answers.nextStep(bare(220 + Lean.OFFER_REST_DAYS), { refusals: {}, shown: { "mind-open-day": 220 } });
  assert.equal(back.id, "mind-open-day", "a week on, the step may stand again");
  const refused = Answers.nextStep(bare(220 + Lean.OFFER_REST_DAYS), { refusals: { "mind-open-day": 220 }, shown: {} });
  assert.equal(refused, null, "but a refused step still sleeps at a week — its span is the Moon");
  const woken = Answers.nextStep(bare(220 + Lean.REFUSAL_SLEEP_DAYS), { refusals: { "mind-open-day": 220 }, shown: {} });
  assert.equal(woken.id, "mind-open-day", "a Moon on, even a refused step may return");
});

test("when every step sleeps, the next answer is quiet — and re-offers nothing refused", () => {
  const leanState = {
    refusals: { "mind-open-day": 224, "mind-room-garden.html": 224, "mind-card": 224, warmth: 224 },
    shown: {}
  };
  const a = Answers.answer("next", world({
    sealedDays: [200, 210, 223, 224],
    moved: { text: "x", href: null, label: null, day: 220 }
  }), leanState);
  assert.match(a.text, /Nothing is calling right now/);
  assert.ok(!/still open/.test(a.text), "a refused step is not named behind the keeper's back");
});

test("the module is pure: it never touches storage, the network, or the clock", () => {
  const src = fs.readFileSync(path.join(root, "docs/assets/js/spark-answers.js"), "utf8");
  assert.ok(!/localStorage|sessionStorage|fetch\(|XMLHttpRequest|Date\(\)|new Date/.test(src),
    "no storage, no network, no clock — the layer hands the moment in");
});

/* ---- the wiring: the layer reads the real records, and
 * the doorstep names the keeper's real state ---- */

test("the ask layer assembles its snapshot from the real records — and writes none", () => {
  const intro = fs.readFileSync(path.join(root, "docs/assets/js/spark-intro.js"), "utf8");
  assert.match(intro, /spark-answers\.js\?v=20261126-7/, "the answers core rides in lazily");
  assert.match(intro, /function collectWorld/, "the snapshot is assembled in one place");
  assert.match(intro, /record\.practiceDays/, "the sealed days come from the Spark record itself");
  assert.match(intro, /CodexCards\.createStore/, "the cards come from the album's own store");
  assert.match(intro, /keeperKeyForSeed/, "under the keeper's own key");
  assert.match(intro, /SparkLean\.createLean/, "the walks come from the lean's counted record");
  assert.match(intro, /function startAsk/, "the asking has its own door");
  assert.match(intro, /spark-ask-launcher/, "the ✦ Ask button stands in every room the Spark walks");
  assert.match(intro, /ask: startAsk/, "the asking is callable");
  assert.ok(!/setItem\(Core\.STORAGE_KEY/.test(intro), "the asking never writes the Spark record");
});

test("the doorstep prefers the state-named step, under the lean's own marks", () => {
  const living = fs.readFileSync(path.join(root, "docs/assets/js/spark-living.js"), "utf8");
  assert.match(living, /function stateNamedStep/, "the doorstep computes a state-named step");
  assert.match(living, /SparkAnswers\.nextStep/, "from the answers core");
  assert.match(living, /stateNamedStep\(lean, record, day\) \|\|\s*LeanApi\.chooseOffer/,
    "the leaning offer stands as the fallback, unchanged");
  assert.match(living, /lean\.markShown\(offer\.id/, "a shown step rests by the same mark");
  assert.match(living, /lean\.refuse\(offer\.id/, "a 'not now' refuses the step's own id");
});

test("the loaders carry the pass, so no phone serves the cached one", () => {
  const presence = fs.readFileSync(path.join(root, "docs/assets/js/spark-presence.js"), "utf8");
  assert.ok(presence.includes("spark-intro.js?v=20261127-1"));
  assert.ok(presence.includes("spark-intro.css?v=20261126-7"));
  assert.ok(presence.includes("spark-living.js?v=20261126-8"));
});
