/*
 * The lean (Aaron, Nov 26, 2026): the Spark's behaviour grows
 * toward its keeper from what the keeper does — counted locally,
 * reversible, one clear offer at a time, and a "no" remembered
 * for a full Moon.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const root = path.join(__dirname, "..");
const Lean = require(path.join(root, "docs/assets/js/spark-lean.js"));

function shim() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k)
  };
}

test("counts rooms and acts, and derives leanings from them", () => {
  const lean = Lean.createLean(shim());
  lean.note("room", "garden.html", { day: 100, hour: 9 });
  lean.note("room", "garden.html", { day: 101, hour: 9 });
  lean.note("act", "tend", { day: 101, hour: 10 });
  lean.note("room", "one-word.html", { day: 101, hour: 10 });
  const top = Lean.leaningsFor(lean.load());
  assert.equal(top[0].leaning, "garden");
  assert.equal(top[0].count, 3);
});

test("one offer at a time, from the strongest leaning", () => {
  const lean = Lean.createLean(shim());
  lean.note("room", "one-word.html", { day: 100, hour: 8 });
  lean.note("act", "search", { day: 100, hour: 8 });
  const offer = Lean.chooseOffer(lean.load(), { day: 100 });
  assert.equal(offer.id, "lean-study");
});

test("a refusal is remembered for a Moon, then the offer may return", () => {
  const lean = Lean.createLean(shim());
  lean.note("room", "one-word.html", { day: 100, hour: 8 });
  lean.refuse("lean-study", { day: 100 });
  assert.equal(Lean.chooseOffer(lean.load(), { day: 110 }), null);
  const later = Lean.chooseOffer(lean.load(), { day: 100 + Lean.REFUSAL_SLEEP_DAYS });
  assert.equal(later.id, "lean-study");
});

test("a shown offer rests a week", () => {
  const lean = Lean.createLean(shim());
  lean.note("room", "garden.html", { day: 100, hour: 8 });
  lean.markShown("lean-garden", { day: 100 });
  assert.equal(Lean.chooseOffer(lean.load(), { day: 103 }), null);
  assert.equal(Lean.chooseOffer(lean.load(), { day: 100 + Lean.OFFER_REST_DAYS }).id, "lean-garden");
});

test("the warmth returns only after a day has passed, and outranks leanings", () => {
  const lean = Lean.createLean(shim());
  lean.note("room", "garden.html", { day: 100, hour: 8 });
  lean.noteMoved({ text: "The film that moved you is still on its shelf.", href: "episodes.html", label: "Watch again" }, { day: 100 });
  assert.equal(Lean.chooseOffer(lean.load(), { day: 100 }).id, "lean-garden");
  const next = Lean.chooseOffer(lean.load(), { day: 101 });
  assert.equal(next.id, "warmth");
  assert.equal(next.href, "episodes.html");
});

test("path growth is heard once; the first sighting is only a baseline", () => {
  const lean = Lean.createLean(shim());
  assert.equal(lean.pathGrowth(3), null);
  assert.equal(lean.pathGrowth(3), null);
  assert.equal(lean.pathGrowth(4), 4);
  assert.equal(lean.pathGrowth(4), null);
});

test("rhythm remembers the keeper's usual hour", () => {
  const lean = Lean.createLean(shim());
  lean.note("room", "index.html", { day: 1, hour: 7 });
  lean.note("room", "index.html", { day: 2, hour: 8 });
  lean.note("room", "index.html", { day: 3, hour: 21 });
  assert.equal(lean.rhythm().bucket, "morning");
});

test("reset clears the whole lean — the growth is reversible", () => {
  const store = shim();
  const lean = Lean.createLean(store);
  lean.note("room", "garden.html", { day: 1, hour: 9 });
  lean.reset();
  assert.deepEqual(lean.load(), Lean.emptyState());
});

test("a corrupt stored lean reads as an empty one, never a crash", () => {
  const store = shim();
  store.setItem(Lean.STORE_KEY, "{not json");
  const lean = Lean.createLean(store);
  assert.deepEqual(lean.load(), Lean.emptyState());
});
