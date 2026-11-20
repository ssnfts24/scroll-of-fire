/**
 * Theory — Work This Page (Interactivity Wave 2).
 *
 * The pure core of docs/assets/js/theory-work.js: the playgrounds
 * compute the page's own stated forms (and show the model's own
 * edges instead of hiding them), the witness note is a canonical
 * Life Atlas "witness" record in the house's existing shapes, and
 * every one of the family's 35 pages carries the module's hook.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const work = require("../docs/assets/js/theory-work.js");

const DOCS = path.join(__dirname, "..", "docs");

function theoryPageFiles() {
  const files = ["theory.html"];
  for (const name of fs.readdirSync(path.join(DOCS, "theory"))) {
    if (name.endsWith(".html")) files.push(`theory/${name}`);
  }
  for (const name of fs.readdirSync(path.join(DOCS, "theory", "equations"))) {
    if (name.endsWith(".html")) files.push(`theory/equations/${name}`);
  }
  return files.sort();
}

/* --------------------------- playgrounds --------------------------- */

test("the master equation lives on both pages that state it", () => {
  assert.equal(work.playgroundForPage("master-equation.html")?.id, "master-reality");
  assert.equal(work.playgroundForPage("eq00.html")?.id, "master-reality");
});

test("concept pages and the index get no playground — note only", () => {
  for (const page of [
    "theory.html",
    "canon.html",
    "witness.html",
    "unified-field.html",
    "bibliography.html"
  ]) {
    assert.equal(work.playgroundForPage(page), null, page);
  }
});

test("the non-computable equation pages get no playground", () => {
  // eq02 (operator tensor), eq04b (sum over arbitrary voices),
  // eq05 (set Keep/Remove), eq07/eq08 (comparators the Canon leaves
  // UNR — unresolved), eq11 (frame projection): none states a single
  // numeric form, so sliders would invent numbers.
  for (const page of ["eq02.html", "eq04b.html", "eq05.html", "eq07.html", "eq08.html", "eq11.html"]) {
    assert.equal(work.playgroundForPage(page), null, page);
  }
});

test("thirteen pages carry a playground, each a form its page states", () => {
  const withPlayground = work.PLAYGROUNDS.flatMap(p => p.pages);
  assert.equal(withPlayground.length, 14); // 13 forms, master on 2 pages
  assert.equal(new Set(withPlayground).size, 14);
});

test("master equation: all ones give 1; one zero term empties it", () => {
  const pg = work.playgroundForPage("master-equation.html");
  assert.match(work.computePlayground(pg, {}).text, /𝔑 = 1$/);
  const zeroed = work.computePlayground(pg, { M: 0 });
  assert.match(zeroed.text, /𝔑 = 0$/);
  assert.match(zeroed.note, /empties the whole product/);
});

test("master equation: 0^0 is shown as the model's own edge", () => {
  const pg = work.playgroundForPage("master-equation.html");
  const edge = work.computePlayground(pg, { E: 0, C: 0 });
  assert.match(edge.text, /𝔑 = —/);
  assert.match(edge.note, /0⁰ is undefined/);
});

test("harmonic gate: at the threshold, half the signal passes", () => {
  const pg = work.playgroundForPage("eq03.html");
  const out = work.computePlayground(pg, { x: 5, theta: 5, X: 40 });
  assert.match(out.text, /H = 0\.5/);
  assert.match(out.text, /Y = 20 of 40/);
});

test("ethical gate: the page's stop rule — one zero halts everything", () => {
  const pg = work.playgroundForPage("eq09.html");
  const out = work.computePlayground(pg, { T: 0 });
  assert.match(out.text, /𝔈₉ = 0$/);
  assert.match(out.note, /stop rule/);
});

test("beat relation: 432 against 436 beats at 4 Hz", () => {
  const pg = work.playgroundForPage("eq06.html");
  assert.match(work.computePlayground(pg, {}).text, /f_beat = 4 Hz/);
});

test("return rule: the state settles toward its resting point", () => {
  const pg = work.playgroundForPage("eq12.html");
  const out = work.computePlayground(pg, { x0: 20, target: 80, beta: 0.3, steps: 10 });
  const value = Number(out.text.match(/x = ([\d.]+)/)[1]);
  assert.ok(value > 70 && value < 80, out.text);
});

test("learning kernel: zero error teaches nothing this step", () => {
  const pg = work.playgroundForPage("eq15.html");
  const out = work.computePlayground(pg, { K: 2, rho: 0.5, delta: 0 });
  assert.match(out.text, /K next = 1$/);
  assert.match(out.note, /nothing new is learned/);
});

test("memory weight fades with age", () => {
  const pg = work.playgroundForPage("eq16.html");
  const young = work.computePlayground(pg, { age: 0 }).text;
  const old = work.computePlayground(pg, { age: 30 }).text;
  assert.ok(Number(young.match(/ω = ([\d.]+)/)[1]) > Number(old.match(/ω = ([\d.]+)/)[1]));
});

test("playground inputs are clamped to the page's own ranges", () => {
  const pg = work.playgroundForPage("eq09.html");
  const out = work.computePlayground(pg, { C: 5 });
  // C clamps to 1, the rest default 0.9: 0.9^6 ≈ 0.531441
  assert.match(out.text, /𝔈₉ = 0\.5314/);
});

test("the playground carries its honesty in plain words", () => {
  assert.match(work.HONESTY_LINE, /does not prove the equation/);
  assert.match(work.HONESTY_LINE, /not a measured law/);
  assert.match(work.HONESTY_LINE, /a pattern is not a cause/);
});

/* ------------------------- witness records ------------------------- */

test("a witness note is a canonical witness record in house shape", () => {
  const record = work.buildWitnessNoteRecord(
    {
      pageId: "eq09.html",
      pagePath: "theory/equations/eq09.html",
      pageTitle: "Equation 9 — Ethical Law",
      note: "  Nothing is allowed unless every gate holds.  ",
      markedRead: true
    },
    { civilDate: "2026-11-19", patternDay: 217, moon: 8, moonDay: 21 }
  );

  assert.equal(record.type, "witness");
  assert.equal(record.subtype, "theory-witness-note");
  assert.equal(record.summary, "Nothing is allowed unless every gate holds.");
  assert.deepEqual(record.tags, ["theory-witness", "eq09.html"]);
  assert.equal(record.privacy.visibility, "private");
  assert.equal(record.privacy.shareAllowed, false);
  assert.equal(record.payload.theoryWitness.pageId, "eq09.html");
  assert.equal(record.payload.theoryWitness.markedRead, true);
  assert.equal(record.provenance.sourceType, "theory-work-module");
});

test("latestNoteForPage takes the newest record for that page only", () => {
  const mk = (pageId, note) => ({
    type: "witness",
    subtype: "theory-witness-note",
    payload: { theoryWitness: { pageId, note, markedRead: false } }
  });
  const records = [
    mk("eq03.html", "newest for eq03"),
    mk("eq09.html", "for eq09"),
    mk("eq03.html", "older for eq03"),
    { type: "event", subtype: "practice-session", payload: {} }
  ];

  assert.equal(
    work.latestNoteForPage(records, "eq03.html").payload.theoryWitness.note,
    "newest for eq03"
  );
  assert.equal(work.latestNoteForPage(records, "eq17.html"), null);
  assert.equal(work.latestNoteForPage([], "eq03.html"), null);
});

test("temporal mapping follows the Life Atlas anchor-year convention", () => {
  const temporal = work.temporalFromConversion(
    {
      anchorDate: "2026-04-17T00:00:00.000Z",
      civilDate: "2026-11-19",
      moon: 8,
      day: 21,
      dayOfPatternYear: 217,
      weekOfYear: 31,
      insideCountedYear: true,
      timeZone: "America/Los_Angeles",
      boundaryMode: "midnight"
    },
    new Date("2026-11-19T12:00:00.000Z")
  );

  assert.equal(temporal.patternYear, 2026);
  assert.equal(temporal.patternDay, 217);
  assert.equal(temporal.outsideDay, false);
  assert.equal(
    work.coordinateLabel(temporal),
    "Moon 8 · Day 21 · Pattern Day 217"
  );
});

/* ------------------------------ pages ------------------------------ */

test("all 35 Theory pages carry the module hook", () => {
  const files = theoryPageFiles();
  assert.equal(files.length, 35);

  for (const rel of files) {
    const html = fs.readFileSync(path.join(DOCS, rel), "utf8");
    assert.ok(html.includes("assets/css/theory-work.css"), `${rel} css`);
    assert.ok(html.includes("assets/js/theory-work.js"), `${rel} js`);
    assert.ok(
      html.includes("assets/js/life-atlas/life-atlas-repository.js"),
      `${rel} repository`
    );
    assert.ok(
      html.includes("assets/js/life-atlas/record-helpers.js"),
      `${rel} record helpers`
    );
  }
});

test("the module file itself exists and names its honesty", () => {
  const source = fs.readFileSync(
    path.join(DOCS, "assets/js/theory-work.js"),
    "utf8"
  );
  assert.match(source, /theory-witness-note/);
  assert.match(source, /CodexRecordHelpers/);
  assert.doesNotMatch(source, /\bshe\b|\bher\b/i);
});
