"use strict";

/**
 * Living Witness, Rungs 1–2 (Dashboard item 17, approved Nov 18, 2026
 * on terms that start those two rungs).
 *
 * Covers: the Day Notes panel's temporal stamp against the real
 * PatternCalendar (Aaron's fixtures: 2026-11-17 = Moon 8 · Day 19 ·
 * Pattern Day 215; 2026-09-15 = Moon 6 · Day 12 · Pattern Day 152;
 * 2026-11-18 = Moon 8 · Day 20 · Pattern Day 216), the note record's
 * Life Atlas round-trip (found by Pattern Day and by civil date, once),
 * the Day Out of Time carrying no Pattern Day, the guidance lines'
 * counts across two moons, and the Guide's calendar answers, claim
 * matching, and passage shaping.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

const DOCS = path.resolve(__dirname, "../docs");
const JS = path.join(DOCS, "assets/js");

/* The real canonical converter, loaded in the site's own order. */
require(path.join(JS, "calendar/pattern-calendar-version.js"));
require(path.join(JS, "calendar/pattern-calendar-data.js"));
require(path.join(JS, "calendar/pattern-calendar-format.js"));
require(path.join(JS, "calendar/pattern-calendar-boundary.js"));
require(path.join(JS, "calendar/pattern-calendar.js"));

const DayNotes = require(path.join(JS, "day-notes.js"));
const Guidance = require(path.join(JS, "presence-guidance.js"));
const Guide = require(path.join(JS, "codex-guide.js"));
const Repository = require(path.join(JS, "life-atlas/life-atlas-repository.js"));

const ENV = {
  calendar: globalThis.PatternCalendar,
  timeZone: "UTC",
  boundaryMode: "midnight"
};

function conversionFor(isoDate) {
  return DayNotes.conversionForInstant(new Date(`${isoDate}T12:00:00Z`), ENV);
}

/* --------------------------- Day Notes ----------------------------- */

test("day-notes: temporal stamp matches Aaron's fixtures", () => {
  const nov17 = DayNotes.temporalFromConversion(conversionFor("2026-11-17"));
  assert.equal(nov17.civilDate, "2026-11-17");
  assert.equal(nov17.patternYear, 2026);
  assert.equal(nov17.moon, 8);
  assert.equal(nov17.moonDay, 19);
  assert.equal(nov17.patternDay, 215);
  assert.equal(nov17.outsideDay, false);

  const sep15 = DayNotes.temporalFromConversion(conversionFor("2026-09-15"));
  assert.equal(sep15.moon, 6);
  assert.equal(sep15.moonDay, 12);
  assert.equal(sep15.patternDay, 152);
});

test("day-notes: the Day Out of Time carries no Pattern Day", () => {
  const dot = conversionFor("2026-04-16");
  const temporal = DayNotes.temporalFromConversion(dot);

  assert.equal(temporal.patternDay, null);
  assert.equal(temporal.moon, null);
  assert.equal(temporal.outsideDay, true);
  assert.equal(DayNotes.describeConversion(dot).headline, "Day Out of Time");
  /* Its only query key is the civil date. */
  assert.deepEqual(DayNotes.dayQueries(dot), [{ civilDate: "2026-04-16" }]);
});

test("day-notes: a note round-trips through the Life Atlas, found once", async () => {
  const repository = Repository.createRepository();
  const conversion = conversionFor("2026-11-18");

  const record = DayNotes.buildNoteRecord({
    text: "First line of the note\nSecond line, kept whole.",
    conversion,
    instant: new Date("2026-11-18T12:00:00Z")
  });

  assert.equal(record.type, "note");
  assert.equal(record.subtype, "day-note");
  assert.equal(record.title, "First line of the note");
  assert.match(record.summary, /Second line, kept whole\./);
  assert.equal(record.temporal.patternDay, 216);
  assert.equal(record.provenance.calculationAuthority, "PatternCalendar");

  const saved = await repository.put(record);
  assert.ok(saved.id);

  const found = await DayNotes.recordsForDay(repository, conversion);
  assert.equal(found.length, 1);
  assert.equal(found[0].id, saved.id);
  assert.equal(DayNotes.kindLabel(found[0]), "Day note");

  const otherDay = await DayNotes.recordsForDay(
    repository,
    conversionFor("2026-11-19")
  );
  assert.equal(otherDay.length, 0);
});

test("day-notes: an empty note is refused", () => {
  const conversion = conversionFor("2026-11-18");
  assert.equal(
    DayNotes.buildNoteRecord({ text: "   ", conversion }),
    null
  );
});

test("day-notes: describeConversion names the day plainly", () => {
  const description = DayNotes.describeConversion(conversionFor("2026-11-18"));
  assert.equal(
    description.headline,
    "Moon 8 · Day 20 · Pattern Day 216"
  );
  assert.match(description.detail, /Deep Mirror/);
});

/* ---------------------------- Guidance ------------------------------ */

function practiceRecord(patternYear, moon, patternDay, civilDate) {
  return {
    type: "event",
    subtype: "practice-session",
    title: "Manifest practice session",
    temporal: {
      patternYear,
      moon,
      moonDay: ((patternDay - 1) % 28) + 1,
      patternDay,
      civilDate
    }
  };
}

const TODAY = {
  patternYear: 2026,
  moon: 8,
  moonDay: 20,
  patternDay: 216,
  civilDate: "2026-11-18"
};

test("guidance: practice counts across two moons are spoken as noticed", () => {
  const records = [
    practiceRecord(2026, 8, 200, "2026-11-02"),
    practiceRecord(2026, 8, 205, "2026-11-07"),
    practiceRecord(2026, 8, 205, "2026-11-07"), // same day, second seal
    practiceRecord(2026, 8, 210, "2026-11-12"),
    practiceRecord(2026, 7, 170, "2026-10-03"),
    practiceRecord(2026, 7, 175, "2026-10-08"),
    practiceRecord(2026, 7, 180, "2026-10-13"),
    practiceRecord(2026, 7, 185, "2026-10-18"),
    practiceRecord(2026, 7, 190, "2026-10-23")
  ];

  const lines = Guidance.computeGuidance({ records, today: TODAY });

  assert.equal(lines[0].tone, "noticed");
  assert.match(lines[0].text, /3 days this moon/);
  assert.match(lines[0].text, /last moon it was 5/);
});

test("guidance: a silent this-moon after a kept last moon becomes an offer", () => {
  const records = [practiceRecord(2026, 7, 170, "2026-10-03")];
  const lines = Guidance.computeGuidance({ records, today: TODAY });

  assert.equal(lines[0].tone, "offer");
  assert.match(lines[0].text, /Last moon you sealed practice on 1 day/);
  assert.equal(lines[0].href, "teach.html");
});

test("guidance: an empty record earns one first-step offer, nothing more", () => {
  const lines = Guidance.computeGuidance({ records: [], today: TODAY });
  assert.equal(lines.length, 1);
  assert.match(lines[0].text, /Nothing kept here yet/);
});

test("guidance: a day-note on today closes the unwritten-day offer", () => {
  const records = [
    {
      type: "note",
      subtype: "day-note",
      title: "A note",
      temporal: { ...TODAY }
    }
  ];

  const lines = Guidance.computeGuidance({ records, today: TODAY });
  assert.ok(!lines.some(line => /Nothing written on today/.test(line.text)));
});

test("guidance: lines never exceed the cap", () => {
  const records = [
    practiceRecord(2026, 8, 200, "2026-11-02"),
    { type: "note", subtype: "other", title: "x", temporal: { civilDate: "2026-11-01" } }
  ];

  const visitDays = ["2026-11-10", "2026-11-12", "2026-11-15", "2026-11-17"];
  const lines = Guidance.computeGuidance({ records, today: TODAY, visitDays });

  assert.ok(lines.length <= Guidance.MAX_LINES);
  assert.ok(lines.some(line => /come back on 4 of the last 28 days/.test(line.text)));
});

test("guidance: footprints stamp once per day and cap", () => {
  const store = new Map();
  const storage = {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value)
  };

  Guidance.stampFootprint(storage, "2026-11-18");
  const days = Guidance.stampFootprint(storage, "2026-11-18");
  assert.deepEqual(days, ["2026-11-18"]);
});

/* ------------------------------ Guide ------------------------------- */

test("guide: calendar intents are recognized in ordinary words", () => {
  assert.deepEqual(Guide.parseCalendarIntent("When is Pattern Day 216?"), {
    kind: "pattern-day",
    patternDay: 216
  });
  assert.deepEqual(Guide.parseCalendarIntent("what day is moon 4 day 8"), {
    kind: "moon-day",
    moon: 4,
    day: 8
  });
  assert.deepEqual(
    Guide.parseCalendarIntent("What is November 18, 2026 in the calendar?"),
    { kind: "civil-date", civilDate: "2026-11-18" }
  );
  assert.deepEqual(Guide.parseCalendarIntent("when is the day out of time"), {
    kind: "day-out-of-time"
  });
  assert.equal(Guide.parseCalendarIntent("tell me about resonance"), null);
});

test("guide: calendar answers are computed, and agree with the fixtures", () => {
  const calendar = globalThis.PatternCalendar;
  const now = new Date("2026-11-18T12:00:00Z");

  const byPatternDay = Guide.answerCalendarIntent(
    { kind: "pattern-day", patternDay: 216 },
    { calendar, now }
  );
  assert.equal(byPatternDay.civilDate, "2026-11-18");
  assert.match(byPatternDay.headline, /Moon 8 · Day 20/);

  const byMoonDay = Guide.answerCalendarIntent(
    { kind: "moon-day", moon: 4, day: 8 },
    { calendar, now }
  );
  assert.equal(byMoonDay.civilDate, "2026-07-17");

  const byCivil = Guide.answerCalendarIntent(
    { kind: "civil-date", civilDate: "2026-09-15" },
    { calendar, now }
  );
  assert.match(byCivil.headline, /Pattern Day 152/);

  const dot = Guide.answerCalendarIntent(
    { kind: "day-out-of-time" },
    { calendar, now }
  );
  assert.equal(dot.civilDate, "2027-04-16");
  assert.equal(dot.headline, "Day Out of Time");
  assert.match(dot.detail, /2027-04-16/);

  const impossible = Guide.answerCalendarIntent(
    { kind: "pattern-day", patternDay: 400 },
    { calendar, now }
  );
  assert.match(impossible.headline, /no Pattern Day 400/);
});

const FIXTURE_CLAIMS = [
  {
    id: "QAT-001",
    title: "Qatar aircraft offer, acceptance, and use",
    classification: "historical event and legal/ethics interpretation",
    statusLabel: "Pentagon acceptance reported May 21, 2025",
    establishes: "Two contemporaneous reports say the Defense Department accepted the aircraft.",
    unverified: "Whether and when the aircraft was operated.",
    evidenceStatus: "documented-event-with-cited-record",
    evidenceStatusDescription:
      "A discrete event is linked to a dated record.",
    sources: [
      {
        title: "Defense Department accepts luxury jet",
        publisher: "PBS NewsHour",
        date: "2025-05-21",
        url: "https://www.pbs.org/example"
      }
    ]
  },
  {
    id: "ACCORDS-001",
    title: "Abraham Accords",
    classification: "international agreement",
    establishes: "Agreements documented.",
    unverified: "The prophetic connection is interpretation.",
    evidenceStatus: "documented-event-with-cited-record",
    evidenceStatusDescription:
      "A discrete event is linked to a dated record.",
    sources: []
  }
];

test("guide: claims match by id and by title words, not by noise", () => {
  assert.deepEqual(
    Guide.matchClaims("what does QAT-001 establish?", FIXTURE_CLAIMS).map(
      claim => claim.id
    ),
    ["QAT-001"]
  );

  assert.deepEqual(
    Guide.matchClaims("the Qatar aircraft acceptance", FIXTURE_CLAIMS).map(
      claim => claim.id
    ),
    ["QAT-001"]
  );

  assert.deepEqual(Guide.matchClaims("how do I make bread", FIXTURE_CLAIMS), []);
});

test("guide: a claim card carries its grade and both halves", () => {
  const card = Guide.buildClaimCard(FIXTURE_CLAIMS[0]);

  assert.equal(card.grade, "documented-event-with-cited-record");
  assert.match(card.establishes, /accepted the aircraft/);
  assert.match(card.unverified, /operated/);
  assert.equal(card.sources.length, 1);
  assert.equal(card.sources[0].publisher, "PBS NewsHour");
});

test("guide: passages are shaped with their home and the lexicon flagged", () => {
  const core = {
    groupResults: results => results.map(result => ({ ...result, folded: [] })),
    /* The real core returns { text, ranges } — the fake keeps that shape. */
    snippetFor: () => ({ text: "a short passage", ranges: [] })
  };

  const passages = Guide.shapePassages(
    [
      { doc: { t: "Or — Light", a: "lexicon", u: "scroll/lexicon.html" } },
      { doc: { t: "Theory", a: "pages", u: "theory.html" } }
    ],
    core,
    "what is or"
  );

  assert.equal(passages[0].areaLabel, "Hebrew Lexicon");
  assert.equal(passages[0].isLexicon, true);
  assert.equal(passages[1].areaLabel, "Page");
  assert.equal(passages[1].snippet, "a short passage");
});

/* --------------------------- page wiring ---------------------------- */

test("pages: the Guide page carries its fence and its form", () => {
  const html = fs.readFileSync(path.join(DOCS, "codex-guide.html"), "utf8");

  assert.match(html, /data-codex-guide-form/);
  assert.match(html, /not Aaron/);
  assert.match(html, /never leaves your browser/i);
  assert.match(html, /codex-guide\.js/);
});

test("pages: the 13 Moons page carries the Day Notes panel", () => {
  const html = fs.readFileSync(path.join(DOCS, "moons.html"), "utf8");

  assert.match(html, /data-day-notes/);
  assert.match(html, /day-notes\.js/);
  assert.match(html, /presence-guidance\.js/);
  assert.match(html, /codex-guide\.html/);
});

test("pages: the search page opens a door to the Guide", () => {
  const html = fs.readFileSync(path.join(DOCS, "search.html"), "utf8");
  assert.match(html, /codex-guide\.html/);
});
