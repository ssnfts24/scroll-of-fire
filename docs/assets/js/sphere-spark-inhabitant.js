/**
 * The Spark, inhabiting the Sphere — slice 1 (Nov 23, 2026).
 *
 * Aaron's direction ("Spark — Living Play and Companion
 * Expansion"): the Spark must become an inhabitant of the actual
 * Living Sphere rather than an animated layer placed over it.
 * This module is the first slice of that, and it lives where the
 * fences say it must: in the companion layer, on the page by
 * sphere-companion-layer.js's loader, touching no protected file.
 *
 * What it does, honestly stated:
 *
 *  TRAVEL ON REAL GEOMETRY. The Spark's presence (the holder
 *  sphere-spark.js builds) is driven from the calendar's own
 *  published projection: the label layer projects every faced
 *  day's plate into the page as a semantic label
 *  (data-semantic-id="pattern-day-number-N"), and the Spark
 *  stands on that projection — on today's plate at rest, and on
 *  the keeper's selected day when the selection moves. Selection
 *  still flows through the canonical pipeline and the page's own
 *  controls; this module only reads the state strip and the
 *  projected labels, the way the Genesis layer (PR #276) reads
 *  the strip. Its movement is the ruled vocabulary: a drift with
 *  a hop's arc, tracking the plate as the instrument turns.
 *
 *  ENTERING THE DAY. When the keeper opens a day — the page
 *  carries day-world-open on its root while the Day World is
 *  open — the Spark steps through the door with them: its holder
 *  (the companion layer's own element) is reparented into the
 *  Day World room itself and takes its station at the day
 *  sheet's top-right, present inside the day's environment
 *  alongside the keeper. (The room is a fixed body-level room;
 *  nothing inside the stage wrap can be seen inside it, so
 *  entering had to be literal or not at all.) When the keeper
 *  comes back out, the holder steps back into the wrap and the
 *  Spark returns to the selected day's plate.
 *
 *  IDLE LIFE. While the keeper is still, the Spark lives on its
 *  own: it sits, observes, rests, or drifts to a nearby day and
 *  looks, then returns. The choice leans on the keeper's own
 *  record where the record supports a preference (the play log's
 *  kinds, read through SphereSpark.playSummary's own counting
 *  where available), and falls back to plain defaults where it
 *  does not. Any keeper action ends idle behaviour at once.
 *
 *  ENVIRONMENT. The Spark's light answers the keeper's local
 *  time of day — morning, day, evening, night — in the same
 *  daypart bands the Spark's living voice already keeps.
 *
 *  Slice 1 writes NOTHING to the record: travel, idling and
 *  entering are showings, and the play/care/tricks design's rule
 *  is that showings write nothing. It reads the record only to
 *  lean its idle choices. A marker pinned inside the 3D scene
 *  itself would need the protected renderer's hooks; that piece
 *  is held for Aaron's word, exactly as the Genesis layer's
 *  in-scene marker is held — not faked here.
 *
 *  ── Slice 2 (Nov 23, 2026): preferences and discovery ──────
 *
 *  BEHAVIOURAL PREFERENCES FROM BREADTH. The Spark's idle
 *  choices are now shaped by the breadth of the whole shared
 *  record, not the play log alone: the play log's kinds, the
 *  lands walked (the record's pages seen), the Moons kept, the
 *  days witnessed (the Codex memory's witnessed days, converted
 *  by the canonical PatternCalendar), the practice days, the
 *  tokens brought home (the Atlas's episode-watched records),
 *  and the keeper's Genesis birth day. Where the breadth stands,
 *  new idle acts open — ranging the ring, going to a marked day,
 *  resting beside a keepsake — and the Spark's travel reach
 *  grows. Where the record is thin, nothing is invented: the
 *  plain defaults of slice 1 hold. The derivation is inspectable
 *  in the Spark's own panel on this page (the ambient panel,
 *  where the keeper line already stands): it says, in plain
 *  words, what the Spark has come to favour and the record
 *  breadth each favour comes from.
 *
 *  IDLE BREADTH & SPONTANEOUS DISCOVERY. The idle repertoire
 *  widens: the Spark may roam the ring, and it may DISCOVER —
 *  travelling to a day that carries a real mark from the
 *  keeper's record (a witnessed day, a day a token came home,
 *  the Genesis birth day, a practice day, a day kept together)
 *  and regarding it there, its discovery named on the holder
 *  while it lasts. Closing a day is one of the charter's three
 *  witnessing touches, so a closed day is discovered as what it
 *  is in the record: a witnessed day. Discoveries are composed
 *  only from record facts, and they write nothing: no
 *  play-session writer stood on the site yet, and a reading
 *  writes nothing — the design's own rule for readings.
 *
 *  ── Slice 3 (Nov 23, 2026): teaching and performed tricks ──
 *
 *  THE WRITER. The keeper's seed-keyed Spark record now carries
 *  its life lines — play-session, care-act, trick-learned —
 *  appended only, under the design's never-carries discipline
 *  (Gate E's writer, mirrored): a line carrying a score, a
 *  streak, a duration, a refusal, a meter, a level, hunger,
 *  health, a performance count, a rank or a reward is refused
 *  outright, and a line stands on a day or not at all. Only
 *  three acts write: a demonstrated route (a play-session),
 *  closing a day together (a care-act), and a learning landing
 *  (a trick-learned). Readings, idling and PERFORMANCES write
 *  nothing — a performance is a showing.
 *
 *  THE TRICK BOOK. The Spark's panel carries what the Spark can
 *  do, derived from the record the way the app derives it: the
 *  Basics from birth (Hop, Drift, Glow Pulse, First Note); the
 *  Bow from the first day closed together; the kind's signature
 *  at Kindled, when its paired act stands; the Bearer signature
 *  in Aaron's ruled names, when the paired act stands in a
 *  second Moon. A trick not yet learned is not offered as
 *  performable — the book says in plain words what would teach
 *  it. The stage portrait is breadth, never rank; nothing here
 *  is scored or losable.
 *
 *  PERFORMANCES. A learned trick is performed on the Sphere's
 *  real geometry — at the standing day and across nearby plates,
 *  in the ruled hop-and-drift vocabulary: hops, drifts, dimmed
 *  crossings, loops, bows, glow, the voice's note, and small
 *  lights laid on the plates themselves (ripples, ember motes,
 *  ground-glow, stars). It happens in the instrument's space;
 *  it is not a dialogue line and not a panel animation.
 *
 *  TEACHING BY DEMONSTRATION. The keeper travels a route across
 *  days with the Spark following — the slice-1 following, on
 *  the real geometry — and the route is recorded as one
 *  play-session naming its days. When the Spark walks the route
 *  back in a second Moon, the learning lands as a trick-learned
 *  line: breadth is what makes it the Spark's own, the design's
 *  rule that a trick's paired act is done in more than one
 *  Moon. A same-Moon walk-back is a performance and writes
 *  nothing.
 *
 *  CLOSE THE DAY, TOGETHER. The site's one care act in this
 *  slice: inside the day's own room, keeper and Spark close the
 *  day together, and the care-act line stands in the record.
 *  The remaining care kinds are the care slice's work.
 *
 *  SLICE 4 — THE HOME AND WORLD ANSWER THE HISTORY. The
 *  carrying tricks now derive on the site exactly as Gate E
 *  derives them in the app: Fetch the Token at the Bearer
 *  stage itself; Carry the Lantern at Bearer when a Waymaker
 *  skill stands met in an episode watched through (its token
 *  home) and a practice stands sealed (a plan completed). Their
 *  performances live on their true stages, not on this face:
 *  the fetch in Their Home (spark-home-world.js, reading this
 *  module's own derivations), the lantern at an opened day —
 *  when the lantern stands learned, the Spark carries it lit
 *  at its station in the Day World while the keeper reads.
 *  The book names both, learned or not, with where each is
 *  performed. And the hum repertoire joins the book: every
 *  episode watched through teaches its hum (derived from the
 *  watch records, stored nowhere else), and a hum is performed
 *  here — the Spark travels to the day the token came home,
 *  when that plate stands on the face, and sounds the motif
 *  there in its own voice. Performances still write nothing.
 *
 *  Still named, not faked: the Whole Road performance stands
 *  designed, not built — its stage is the year's reading, a
 *  later slice. The older count-based trick list in the
 *  site-wide companion core is left exactly as it was — the
 *  Sphere's book follows the ruled design; unifying the two
 *  is a later slice's work.
 *
 *  ── Slice 5 (Nov 24, 2026): the world answers; the care ────
 *  ── kinds land; the two trick books become one ───────────
 *
 *  SEASONS AND SURROUNDINGS. The Spark now answers the year
 *  it stands in, read from the canonical pipeline and nothing
 *  else: the Moon's own character (its name and essence, from
 *  the calendar's data), the year's quarter, a Moon's turn
 *  (its last day, and the opening of the next), the Year Gate
 *  (Pattern Day 1), and the days outside the count (the Day
 *  Out of Time, the Deep Time Day), where there is no plate
 *  and the Spark keeps the threshold — no position is faked
 *  for them. The season stands named on the holder and in a
 *  line of the Spark's own panel. At a turn or the Gate, the
 *  first ranging idle of the day crosses to the season's day
 *  — the new Moon's first day, or the old year's last day
 *  across the Gate — and regards it there. Inside an opened
 *  day, the Spark answers the day's own character: the
 *  strongest mark the record lays on it (the birth day, a
 *  garden day, a token's home, a practice, a witnessing, a
 *  keeping), in posture and light. And a keepsake-rest idle
 *  may now rest beside a garden day, where the record holds
 *  one. No weather, no event, nothing the record and the
 *  calendar do not themselves say.
 *
 *  THE CARE KINDS. The remaining care kinds of the design
 *  land where their honest occasions stand on this face,
 *  through the slice-3 writer only, in Gate E's exact kinds:
 *  kindle (one real act done with the Spark present, on the
 *  day it stands on), tend (the keeper chooses the day's
 *  dress for the Spark's light, from the dresses it has —
 *  its own glow, the hour's halo, and the flame wrap's
 *  firelight where the wrap stands), rest (the keeper sends
 *  the Spark to rest at its post) — each once a day, in the
 *  Spark's panel; sat-with (Quiet Company, inside an opened
 *  day: the Spark settles at its station, makes no offers,
 *  and the sitting is the care) — once per day per day sat
 *  with; and carry / carry-end, whose home is Their Home
 *  (spark-home-world.js writes them through this module's
 *  writer door): one keepsake at a time, its end recorded
 *  against its beginning, and while a carry stands open the
 *  keepsake's light rides the holder here too. Care is a
 *  record of what was done together; nothing runs down.
 *
 *  ONE TRICK DERIVATION. The site-wide companion core's
 *  count-based kind trick and the Sphere book's ruled kind
 *  signature are one feat under two names (Flare /
 *  Flare-Spin, Ripple / Ripple-Bow, Vanish / Peek-Back,
 *  Loop / Feather Loop, Root / Root Bow, Beam / Halo Bow).
 *  They now derive once, from a union neither face can lose
 *  by: a trick-learned line naming the signature, the core's
 *  stored list, or the core's own count standing — the core
 *  reads the lines (its tricksFor honours them), and this
 *  module reads the core's counts and store (its derivation
 *  honours them, and the learning pass witnesses the
 *  signature into a line, via the play that taught it). The
 *  core's three shared play feats (Spin, Leap, Glow pulse)
 *  and the book's Basics have no counterpart on the other
 *  face; each keeps its one standing derivation, and no feat
 *  anywhere is derived two different ways.
 *
 *  THE CARRIED LINE. When Fetch the Token first carries a
 *  keepsake, one line lands on the keepsake's own Atlas
 *  record — "carried to you, [day]" (design §1.4) — through
 *  the repository's own write path, once, and the home's
 *  readout names it. The grammar lives here
 *  (carriedLineForRecord); Their Home performs the write.
 *
 *  ── Slice 6 (Nov 24, 2026): the Whole Road ───────────────
 *
 *  THE WHOLE ROAD. The Guardian set piece stands built, in
 *  the addendum's elevated form: the Sphere itself is the
 *  stage. Its programme derives here exactly as Gate E
 *  derives it in the app — the birth coordinate, the hums in
 *  the order they came home, the tricks in the order they
 *  were learned, the first closing — composed only from
 *  record facts, null until a full Pattern year stands kept.
 *  Asked in the book, or at the year's reading on the Day
 *  Out of Time where its offer stands in the season's
 *  section, the Spark walks the programme's stations in
 *  order on the real plates: the seed-motif at the birth
 *  day, each hum sounded at the day its token came home,
 *  each learned feat performed at the day it was learned
 *  (a feat whose stage is another face is regarded there,
 *  and named — never faked onto this one), the lantern
 *  carried lit through the road's middle where it stands
 *  learned, the Bow at the first closing's day, and at the
 *  end, rest. The short road walks the year's turning
 *  points only, from the same programme. The book reads the
 *  road as it walks, naming each beat as the Spark reaches
 *  it. A performance writes nothing; any keeper action sets
 *  the road down. With this slice the inhabitant
 *  programme's designed work stands complete.
 *
 *  The pure half (readout parsing, ring math, the hop arc, the
 *  idle choice, slice 2's breadth, preference, and target
 *  derivations, slice 3's writer, facts fold, trick
 *  derivation, route logic and performance choreography,
 *  slice 4's hum repertoire fold, and slice 6's Whole Road
 *  programme, short form, and choreography) carries no DOM
 *  dependency and is unit-tested.
 */
(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
    return;
  }

  root.SphereSparkInhabitant = api;
  api.mount(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const IDLE_AFTER_MS = 24000;
  const PATTERN_DAYS = 364;

  /* The state strip's own grammar — the same forms the Genesis
   * layer and the story doors parse. */
  function parseReadout(text) {
    const t = String(text || "");
    const full = t.match(/Moon (\d{1,2}) · Day (\d{1,2}) · Day (\d{1,3})\/364/);
    if (full) return { moon: Number(full[1]), day: Number(full[2]), patternDay: Number(full[3]) };
    const part = t.match(/Moon (\d{1,2}) · Day (\d{1,2})/);
    if (part) return { moon: Number(part[1]), day: Number(part[2]), patternDay: patternDayFor(Number(part[1]), Number(part[2])) };
    return null;
  }

  function patternDayFor(moon, day) {
    const m = Number(moon), d = Number(day);
    if (!Number.isInteger(m) || !Number.isInteger(d)) return null;
    if (m < 1 || m > 13 || d < 1 || d > 28) return null;
    return (m - 1) * 28 + d;
  }

  function moonDayFor(patternDay) {
    const pd = Number(patternDay);
    if (!Number.isInteger(pd) || pd < 1 || pd > PATTERN_DAYS) return null;
    return { moon: Math.floor((pd - 1) / 28) + 1, day: ((pd - 1) % 28) + 1 };
  }

  /* The shortest signed walk along the 364-day ring, from one
   * Pattern Day to another: positive walks forward through the
   * year, negative backward; the ring wraps at the Year Gate. */
  function ringDistance(fromPd, toPd) {
    const a = Number(fromPd), b = Number(toPd);
    if (!Number.isInteger(a) || !Number.isInteger(b)) return null;
    let d = (((b - a) % PATTERN_DAYS) + PATTERN_DAYS) % PATTERN_DAYS;
    if (d > PATTERN_DAYS / 2) d -= PATTERN_DAYS;
    return d;
  }

  /* The hop's arc: height at progress t (0..1) for a travel of
   * distPx screen pixels — a low hop for a near day, a higher
   * one for a Moon-crossing drift, always bounded. */
  function hopArc(t, distPx) {
    const p = Math.min(1, Math.max(0, Number(t) || 0));
    if (p <= 0 || p >= 1) return 0;
    const dist = Math.max(0, Number(distPx) || 0);
    const peak = Math.min(46, Math.max(6, dist * 0.18));
    return Math.sin(Math.PI * p) * peak;
  }

  function travelDurationMs(distPx) {
    const dist = Math.max(0, Number(distPx) || 0);
    return Math.round(Math.min(3400, Math.max(650, 500 + dist * 1.15)));
  }

  /* The Spark's dayparts — the same bands sphere-spark.js's
   * living voice keeps (daypartForHour), named for the keeper's
   * own clock: morning, day, evening, night. */
  function daypartForHour(hour) {
    const h = Number(hour);
    if (!Number.isFinite(h)) return "night";
    return h >= 5 && h < 10 ? "morning" : h >= 10 && h < 17 ? "day" : h >= 17 && h < 21 ? "evening" : "night";
  }

  /* The idle choice. playKinds is the keeper's own play-log
   * counting ({chase: n, echo: n, ...}) or null where the record
   * holds none; roll is a 0..1 draw, passed in so the choice is
   * testable. The lean is honest and small: a Spark whose keeper
   * plays chase goes visiting; one whose keeper plays echo sits
   * and glows (observe); night rests, whatever the record says.
   * Nothing here is a progression — it is a temperament for an
   * idle moment, re-chosen each time. */
  function pickIdle(playKinds, daypart, roll) {
    const r = Math.min(0.999999, Math.max(0, Number(roll) || 0));
    const kinds = playKinds && typeof playKinds === "object" ? playKinds : {};
    const chase = Number(kinds.chase || 0);
    const echo = Number(kinds.echo || 0);
    let weights;
    if (daypart === "night") {
      weights = { rest: 0.55, sit: 0.2, observe: 0.15, visit: 0.1 };
    } else if (chase > 0 && chase >= echo) {
      weights = { visit: 0.45, observe: 0.2, sit: 0.2, rest: 0.15 };
    } else if (echo > 0) {
      weights = { observe: 0.45, sit: 0.25, visit: 0.15, rest: 0.15 };
    } else {
      weights = { sit: 0.3, observe: 0.3, visit: 0.2, rest: 0.2 };
    }
    let acc = 0;
    for (const name of ["sit", "observe", "rest", "visit"]) {
      acc += weights[name];
      if (r < acc) return name;
    }
    return "sit";
  }

  /* Play-log kinds, counted the plain way from a record — the
   * fallback when SphereSpark's own summary is not on the page. */
  function playKindCounts(record) {
    const log = Array.isArray(record?.playLog) ? record.playLog : [];
    const counts = {};
    for (const e of log) {
      if (e && typeof e.kind === "string") counts[e.kind] = (counts[e.kind] || 0) + 1;
    }
    return counts;
  }

  /* ── Slice 2: breadth, preferences, discovery ────────────── */

  /* A stored Pattern Day counts only when it is a whole day of
   * the counted year: 1..364. The Day Out of Time (365 in the
   * seed grammar) has no plate, and nothing here invents one. */
  function validPatternDays(list) {
    const out = [];
    for (const v of Array.isArray(list) ? list : []) {
      const pd = Number(v);
      if (Number.isInteger(pd) && pd >= 1 && pd <= PATTERN_DAYS && !out.includes(pd)) out.push(pd);
    }
    return out.sort((a, b) => a - b);
  }

  /* A witnessed civil day (an ISO date in the Codex memory)
   * becomes a Pattern Day only through the canonical calendar —
   * the converter is passed in, so the pure half stays testable
   * and the page's own PatternCalendar does the converting.
   * Outside the counted year (the Day Out of Time) reads null:
   * there is no plate to stand on, and none is faked. */
  function patternDayForCivil(iso, convert) {
    if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    if (typeof convert !== "function") return null;
    let pos = null;
    try { pos = convert({ date: new Date(`${iso}T12:00:00Z`) }); } catch { return null; }
    const pd = Number(pos?.dayOfPatternYear);
    if (!Number.isInteger(pd) || pd < 1 || pd > PATTERN_DAYS) return null;
    return pd;
  }

  /* The keeper's Genesis birth day, read from the saved Oracle
   * profile array exactly as the Genesis layer (PR #276) reads
   * it: a record counts only when it carries myGenesis and a
   * usable birth coordinate. Anything else reads as none. */
  function genesisPatternDayFromRaw(raw) {
    let records;
    try { records = JSON.parse(raw || "[]"); } catch { return null; }
    if (!Array.isArray(records)) return null;
    const mine = records.find((r) => r && r.myGenesis === true);
    const pos = mine?.calculated?.patternPosition;
    if (!pos) return null;
    return patternDayFor(pos.moonNumber, pos.dayInMoon);
  }

  /* The days tokens came home, folded from the Atlas's own
   * records: an episode-watched record with a watch action is a
   * token brought home, and its temporal stamp names the day.
   * (SparkActivities.foldWatches folds the same records for the
   * shelf; it does not carry the day, so the day is read here,
   * from the same records, for this one purpose.) A watch on the
   * Day Out of Time counts as a token home but names no plate. */
  function tokenDaysFromRecords(records) {
    const days = [];
    let tokenCount = 0;
    for (const r of Array.isArray(records) ? records : []) {
      if (!r || r.type !== "event" || r.subtype !== "episode-watched") continue;
      const p = r.payload?.sparkActivities;
      if (!p || p.action !== "watch") continue;
      tokenCount += 1;
      const pd = Number(r.temporal?.patternDay);
      if (Number.isInteger(pd) && pd >= 1 && pd <= PATTERN_DAYS && !days.includes(pd)) days.push(pd);
    }
    return { tokenCount, tokenDays: days.sort((a, b) => a - b) };
  }

  /* The marks a day can carry, in the order a discovery names
   * them — the most particular first: the birth day before a
   * token's day, a token's day before a witnessed day, and a
   * day merely kept together last. */
  const MARK_KINDS = ["genesis", "token", "witnessed", "practice", "kept"];

  function markKindFor(kinds) {
    const held = Array.isArray(kinds) ? kinds : [];
    for (const kind of MARK_KINDS) if (held.includes(kind)) return kind;
    return null;
  }

  /* The breadth of the shared record, gathered from its sources
   * — every number here is a count of facts the record itself
   * holds; nothing is estimated and nothing is carried in from
   * outside. `record` is the Spark's own record (sof.spark.v1);
   * the rest arrive already converted by the DOM half from
   * their own stores, through the canonical pipeline. */
  function breadthFromSources({ record, witnessedPds, genesisPd, tokenInfo } = {}) {
    const rec = record && typeof record === "object" ? record : {};
    const keptDays = validPatternDays(rec.daysSeen);
    const practiceDays = validPatternDays(rec.practiceDays);
    const playKinds = playKindCounts(rec);
    const lands = new Set();
    for (const p of Array.isArray(rec.pagesSeen) ? rec.pagesSeen : []) {
      if (typeof p === "string" && p) lands.add(p);
    }
    const moons = new Set();
    const notePd = (pd) => { const md = moonDayFor(pd); if (md) moons.add(md.moon); };
    for (const pd of keptDays) notePd(pd);
    for (const pd of practiceDays) notePd(pd);
    for (const e of Array.isArray(rec.playLog) ? rec.playLog : []) {
      const pd = Number(e?.stamp?.patternDay) || patternDayFor(e?.stamp?.moon, e?.stamp?.day);
      if (pd) notePd(pd);
    }
    const witnessedDays = validPatternDays(witnessedPds);
    const tokenDays = validPatternDays(tokenInfo?.tokenDays);
    const tokenCount = Math.max(0, Number(tokenInfo?.tokenCount) || 0);
    const birthPd = Number.isInteger(genesisPd) && genesisPd >= 1 && genesisPd <= PATTERN_DAYS ? genesisPd : null;

    const marks = {};
    const addMark = (pd, kind) => {
      if (!marks[pd]) marks[pd] = [];
      if (!marks[pd].includes(kind)) marks[pd].push(kind);
    };
    for (const pd of keptDays) addMark(pd, "kept");
    for (const pd of practiceDays) addMark(pd, "practice");
    for (const pd of witnessedDays) addMark(pd, "witnessed");
    for (const pd of tokenDays) addMark(pd, "token");
    if (birthPd) addMark(birthPd, "genesis");

    const markedDays = Object.keys(marks).map(Number).sort((a, b) => a - b);
    /* A strong mark is a day the record marks beyond the keeping
     * itself — witnessed, practised, a token's home, a birth
     * day. One kept day is a beginning, not a preference. */
    const strongMarkedDays = markedDays.filter((pd) => marks[pd].some((k) => k !== "kept"));

    return {
      playKinds,
      daysTogether: keptDays.length,
      keptDays,
      practiceDays,
      lands: lands.size,
      moonsKept: moons.size,
      witnessedDays,
      tokenCount,
      tokenDays,
      genesisPd: birthPd,
      marks,
      markedDays,
      strongMarkedDays,
    };
  }

  /* Preferences derived from breadth. Every favour carries the
   * facts it stands on, in plain words, so the keeper's panel
   * can show its working. A favour stands only when its bar is
   * met in the record; below every bar, `favours` is empty and
   * the weights are slice 1's plain defaults — the Spark keeps
   * the defaults and the panel says it is still learning. */
  function preferencesFromBreadth(breadth, name) {
    const b = breadth && typeof breadth === "object" ? breadth : breadthFromSources({});
    const who = typeof name === "string" && name.trim() ? name.trim() : "The Spark";
    const kinds = b.playKinds || {};
    const chase = Number(kinds.chase || 0);
    const echo = Number(kinds.echo || 0);

    /* Slice 1's leans, carried whole: play shapes the postures. */
    let weights;
    if (chase > 0 && chase >= echo) weights = { sit: 0.2, observe: 0.2, rest: 0.15, visit: 0.45, roam: 0, approach: 0, keep: 0 };
    else if (echo > 0) weights = { sit: 0.25, observe: 0.45, rest: 0.15, visit: 0.15, roam: 0, approach: 0, keep: 0 };
    else weights = { sit: 0.3, observe: 0.3, rest: 0.2, visit: 0.2, roam: 0, approach: 0, keep: 0 };

    const favours = [];

    if (chase >= 2) {
      weights.roam = 0.18;
      favours.push({
        act: "roam",
        line: `${who} ranges the ring when you are still — the two of you have played chase ${chase} times.`,
      });
    }
    if (echo >= 2) {
      favours.push({
        act: "observe",
        line: `${who} often sits and watches — you have echoed together ${echo} times.`,
      });
    }
    if (b.strongMarkedDays.length >= 1 || b.markedDays.length >= 3) {
      weights.approach = 0.16;
      favours.push({
        act: "approach",
        line: `${who} goes to days your life has marked — ${b.markedDays.length} marked ${b.markedDays.length === 1 ? "day stands" : "days stand"} in the record${b.genesisPd ? ", your birth day among them" : ""}.`,
      });
    }
    if (b.tokenCount >= 1) {
      weights.keep = 0.14;
      favours.push({
        act: "keep",
        line: `${who} rests beside the keepsakes — ${b.tokenCount} ${b.tokenCount === 1 ? "token has" : "tokens have"} come home${b.tokenDays.length ? `, on ${b.tokenDays.map((pd) => `Pattern Day ${pd}`).join(" and ")}` : ""}.`,
      });
    }

    /* Travel style: the reach of an idle ranging grows with the
     * breadth of Moons and lands the keeping spans — a Spark
     * whose life is wide ranges wider. */
    let roamReach = 3;
    if (b.moonsKept >= 3 || b.lands >= 5) roamReach = 6;
    if (b.moonsKept >= 5 && b.daysTogether >= 14) roamReach = 10;
    if (roamReach > 3) {
      favours.push({
        act: "travel",
        line: `${who} travels far on its own — your keeping spans ${b.moonsKept} ${b.moonsKept === 1 ? "Moon" : "Moons"} and ${b.lands} ${b.lands === 1 ? "land" : "lands"}.`,
      });
    }

    /* Normalise so the acts share one whole draw. */
    const total = Object.values(weights).reduce((a, v) => a + v, 0);
    for (const k of Object.keys(weights)) weights[k] = total > 0 ? weights[k] / total : 0;

    return { weights, roamReach, favours, stands: favours.length > 0 };
  }

  /* The panel's lines: the favours, each with its facts, and
   * the breadth they were drawn from — or, where nothing
   * stands, the honest sentence that the Spark is still
   * learning and the defaults hold. */
  function favoursLines(preferences, breadth, name) {
    const who = typeof name === "string" && name.trim() ? name.trim() : "The Spark";
    const b = breadth && typeof breadth === "object" ? breadth : breadthFromSources({});
    if (!preferences || !preferences.stands) {
      return [`${who} is still learning your ways — for now its idle hours keep the plain defaults: sitting, watching, resting, and visiting a near day.`];
    }
    const lines = preferences.favours.map((f) => f.line);
    lines.push(
      `Drawn from your record together: ${b.daysTogether} ${b.daysTogether === 1 ? "day" : "days"} kept, ` +
      `${b.moonsKept} ${b.moonsKept === 1 ? "Moon" : "Moons"}, ${b.lands} ${b.lands === 1 ? "land" : "lands"} walked, ` +
      `${b.witnessedDays.length} ${b.witnessedDays.length === 1 ? "day" : "days"} witnessed, ${b.tokenCount} ${b.tokenCount === 1 ? "token" : "tokens"} home.`
    );
    return lines;
  }

  /* The idle choice, widened. Night keeps slice 1's temper —
   * rest most, and no ranging, approaching, or keepsake rest
   * in the dark, whatever the record says. By day the derived
   * weights rule; where no preference stands they are exactly
   * slice 1's defaults, and the new acts never appear. */
  const IDLE_ACTS = ["sit", "observe", "rest", "visit", "roam", "approach", "keep"];
  function pickIdle2(preferences, daypart, roll) {
    const r = Math.min(0.999999, Math.max(0, Number(roll) || 0));
    const weights = daypart === "night"
      ? { sit: 0.2, observe: 0.15, rest: 0.55, visit: 0.1, roam: 0, approach: 0, keep: 0 }
      : (preferences?.weights || preferencesFromBreadth(null).weights);
    let acc = 0;
    for (const act of IDLE_ACTS) {
      acc += Number(weights[act] || 0);
      if (r < acc) return act;
    }
    return "sit";
  }

  /* A discovery's target: among the marked days the instrument
   * is actually showing (their plates are projected), the
   * nearest few by the ring's own distance, the draw choosing
   * among them. The post itself is never a discovery — the
   * Spark is already standing on it. Nothing projected, no
   * discovery: null, and the caller degrades honestly. */
  function pickDiscoveryTarget(marks, projectedPds, fromPd, roll) {
    const projected = new Set(Array.isArray(projectedPds) ? projectedPds : []);
    const cands = [];
    for (const [pdText, kinds] of Object.entries(marks && typeof marks === "object" ? marks : {})) {
      const pd = Number(pdText);
      if (!Number.isInteger(pd) || !projected.has(pd) || pd === fromPd) continue;
      const kind = markKindFor(kinds);
      if (!kind) continue;
      cands.push({ pd, kind, dist: Math.abs(ringDistance(fromPd, pd) ?? PATTERN_DAYS) });
    }
    if (!cands.length) return null;
    cands.sort((a, b) => a.dist - b.dist || a.pd - b.pd);
    const nearest = cands.slice(0, 4);
    const idx = Math.min(nearest.length - 1, Math.floor(Math.min(0.999999, Math.max(0, Number(roll) || 0)) * nearest.length));
    return nearest[idx];
  }

  /* ── Slice 3: the writer, the trick book, teaching ─────── */

  /* The record's life lines — the play/care/tricks design's
   * §4 shapes, with Gate E's writer discipline mirrored key
   * for key: a line may carry only the allowed keys, and the
   * never-carries columns (scores, streaks, durations as
   * judgement, refusals, meters, levels, hunger, health,
   * performance counts, rank, rewards) refuse the line
   * outright. A line stands on a day: no civil date, no line.
   * Tricks, repertoire and stages DERIVE from these lines and
   * the record, and are stored nowhere separately. */
  const LIFE_LINE_SHAPES = ["play-session", "care-act", "trick-learned"];
  const LIFE_LINE_ALLOWED_KEYS = [
    "line", "kind", "trick", "patternDay", "patternYear", "moon",
    "civilDate", "ref", "via", "at", "id",
  ];
  const LIFE_LINE_FORBIDDEN_KEYS = [
    "score", "scores", "points", "point", "streak", "streaks",
    "duration", "durations", "accuracy", "refusals", "refused",
    "givenUp", "meter", "meters", "level", "levels", "hunger",
    "health", "count", "counts", "performances", "rank", "xp",
    "reward", "rewards", "penalty", "penalties",
  ];

  function makeLifeLine(shape, fields) {
    if (!LIFE_LINE_SHAPES.includes(shape)) return null;
    if (!fields || typeof fields !== "object" || Array.isArray(fields)) return null;
    for (const key of Object.keys(fields)) {
      if (LIFE_LINE_FORBIDDEN_KEYS.includes(key)) return null;
      if (!LIFE_LINE_ALLOWED_KEYS.includes(key)) return null;
    }
    if (shape === "trick-learned") {
      if (typeof fields.trick !== "string" || !fields.trick.trim()) return null;
    } else if (typeof fields.kind !== "string" || !fields.kind.trim()) {
      return null;
    }
    if (typeof fields.civilDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fields.civilDate)) return null;
    const line = { line: shape };
    if (fields.kind != null) line.kind = String(fields.kind);
    if (fields.trick != null) line.trick = String(fields.trick);
    for (const key of ["patternDay", "patternYear", "moon"]) {
      if (fields[key] != null) {
        const n = Number(fields[key]);
        if (!Number.isFinite(n)) return null;
        line[key] = n;
      }
    }
    line.civilDate = fields.civilDate;
    if (fields.ref != null) line.ref = String(fields.ref);
    if (fields.via != null) line.via = String(fields.via);
    if (fields.at != null) line.at = String(fields.at);
    if (fields.id != null) line.id = String(fields.id);
    return line;
  }

  /* The coordinate a line is stamped with, from the canonical
   * stamp's shape (SphereSpark.stamp / patternStamp: the one
   * clock). Null when the stamp carries no civil date — the
   * write then refuses, honestly. */
  function lineCoordinateFromStamp(stamp) {
    if (!stamp || typeof stamp.civilDate !== "string" || !stamp.civilDate) return null;
    return {
      patternDay: stamp.patternDay ?? null,
      patternYear: stamp.patternYear ?? null,
      moon: stamp.moon ?? null,
      civilDate: stamp.civilDate,
    };
  }

  function lifeLinesOf(record) {
    const lines = Array.isArray(record?.lifeLines) ? record.lifeLines : [];
    return lines.filter((l) => l && typeof l === "object" && LIFE_LINE_SHAPES.includes(l.line));
  }

  /* Append one line to the record — purely: the input record
   * is not mutated; the stored line takes the next id in Gate
   * E's form (line-0001, …) unless it carries one. Returns
   * null when the line refuses (see makeLifeLine). */
  function appendLifeLine(record, line) {
    if (!record || typeof record !== "object" || !line) return null;
    const existing = lifeLinesOf(record);
    const stored = line.id ? line : { ...line, id: `line-${String(existing.length + 1).padStart(4, "0")}` };
    return { record: { ...record, lifeLines: [...existing, stored] }, line: stored };
  }

  /* The kinds of keeping — the same table SparkActivities
   * keeps (its KEEPING_KINDS), mirrored so the fold below can
   * run before that module stands on the page; a test pins
   * the two tables equal. */
  const KEEPING_KINDS_TABLE = [
    { id: "day", label: "a day witnessed", subtypes: ["day-note", "witness-mark"] },
    { id: "garden", label: "a bed planted", subtypes: ["garden-planting"] },
    { id: "episode", label: "an episode watched", subtypes: ["episode-watched"] },
    { id: "quest", label: "a quest answered", subtypes: ["quest-answer"] },
    { id: "word", label: "a word kept", subtypes: ["word-keepsake", "word-card"] },
  ];

  /* The facts of a shared life, folded from the Atlas's own
   * records plus the Spark record's play life — Gate E's
   * gatherFacts, read against the site's stores. Every fact
   * is a record standing in the Atlas or the Spark's own
   * record; nothing is estimated. A record's day is its
   * temporal stamp, the way every site fold reads it. */
  function lifeFactsFromRecords(records, sparkRecord) {
    const witnessedDays = [];
    const witnessedByMoon = {};
    const gardenDays = [];
    const gardenByMoon = {};
    const episodes = [];
    const episodeKeys = new Set();
    const wordDays = [];
    const wordKeys = new Set();
    const milestones = [];
    const keptByYear = {};
    let questAnswered = false;
    let madeThing = false;
    let stillBed = false;

    const moonKey = (t) => (t.patternYear == null ? `m${t.moon}` : `${t.patternYear}:${t.moon}`);
    const noteKept = (t) => {
      if (t.patternYear == null || !Number.isInteger(t.patternDay)) return;
      if (!keptByYear[t.patternYear]) keptByYear[t.patternYear] = new Set();
      keptByYear[t.patternYear].add(t.patternDay);
    };
    const noteMoonDay = (byMoon, t) => {
      if (t.moon == null || !Number.isInteger(t.patternDay)) return;
      const key = moonKey(t);
      if (!byMoon[key]) byMoon[key] = new Set();
      byMoon[key].add(t.patternDay);
    };

    const keepingSubtype = new Set(KEEPING_KINDS_TABLE.flatMap((k) => k.subtypes));
    for (const r of Array.isArray(records) ? records : []) {
      if (!r || typeof r !== "object") continue;
      const subtype = typeof r.subtype === "string" ? r.subtype : "";
      const t = r.temporal && typeof r.temporal === "object" ? r.temporal : {};
      const pd = Number.isInteger(t.patternDay) && t.patternDay >= 1 && t.patternDay <= PATTERN_DAYS ? t.patternDay : null;
      const temporal = { patternDay: pd, patternYear: t.patternYear ?? null, moon: t.moon ?? null };

      if (subtype.startsWith("garden-")) {
        if (pd && !gardenDays.includes(pd)) gardenDays.push(pd);
        noteMoonDay(gardenByMoon, temporal);
        if (subtype === "garden-still-bed") stillBed = true;
        noteKept(temporal);
        continue;
      }
      if (subtype === "made") madeThing = true;
      if (subtype === "quest-answer") questAnswered = true;
      if (subtype === "day-note" || subtype === "witness-mark") {
        if (pd && !witnessedDays.includes(pd)) witnessedDays.push(pd);
        noteMoonDay(witnessedByMoon, temporal);
      }
      if (subtype === "word-keepsake" || subtype === "word-card") {
        if (pd && !wordDays.includes(pd)) wordDays.push(pd);
        if (temporal.moon != null) wordKeys.add(moonKey(temporal));
      }
      if (subtype === "episode-watched") {
        const p = r.payload?.sparkActivities;
        if (p && p.action === "watch" && typeof p.episodeId === "string") {
          /* The watch record carries the episode's hum and its
           * distinguisher — the repertoire and the story corner
           * derive from this record and are stored nowhere else
           * (design §3.4; SparkActivities.foldWatches reads the
           * same fields). */
          const d = p.distinguisher && typeof p.distinguisher === "object" ? p.distinguisher : {};
          episodes.push({
            id: p.episodeId, patternDay: pd,
            hum: p.hum && typeof p.hum === "object" ? p.hum : null,
            skill: p.skill && typeof p.skill === "object" ? p.skill : null,
            title: typeof d.name === "string" ? d.name : "",
            land: typeof d.land === "string" ? d.land : "",
            moonName: typeof d.moonName === "string" ? d.moonName : "",
            token: typeof d.token === "string" ? d.token : "",
            line: typeof d.line === "string" ? d.line : "",
          });
          if (temporal.moon != null) episodeKeys.add(moonKey(temporal));
        }
      }
      if (r.payload?.schedule?.status === "completed") {
        milestones.push({ id: typeof r.id === "string" ? r.id : "plan", key: temporal.moon != null ? moonKey(temporal) : null });
      }
      if (keepingSubtype.has(subtype)) noteKept(temporal);
    }

    /* The Spark's own life lines are keeping days too (Gate E
     * counts them the same way). */
    for (const l of lifeLinesOf(sparkRecord)) {
      if (l.patternYear != null && Number.isInteger(l.patternDay)) {
        if (!keptByYear[l.patternYear]) keptByYear[l.patternYear] = new Set();
        keptByYear[l.patternYear].add(l.patternDay);
      }
    }

    const kinds = KEEPING_KINDS_TABLE.map((k) => ({
      id: k.id,
      label: k.label,
      present: (Array.isArray(records) ? records : []).some((r) => r && k.subtypes.includes(r.subtype)),
    }));

    /* Play's ground, from the Spark's own record: the chase's
     * catches stand in the core's play counts; the chase's
     * Moons stand in the play log's stamps. */
    const catches = Math.max(0, Math.floor(Number(sparkRecord?.play?.catches) || 0));
    const chaseKeys = new Set();
    for (const e of Array.isArray(sparkRecord?.playLog) ? sparkRecord.playLog : []) {
      if (e?.kind === "chase" && e.stamp?.moon != null) {
        chaseKeys.add(e.stamp.patternYear == null ? `m${e.stamp.moon}` : `${e.stamp.patternYear}:${e.stamp.moon}`);
      }
    }

    return {
      kinds,
      witnessedDays: witnessedDays.sort((a, b) => a - b),
      witnessedByMoon,
      witnessedKeys: Object.keys(witnessedByMoon),
      gardenDays: gardenDays.sort((a, b) => a - b),
      gardenByMoon,
      gardenKeys: Object.keys(gardenByMoon),
      episodes,
      episodeKeys: [...episodeKeys],
      wordDays: wordDays.sort((a, b) => a - b),
      wordKeys: [...wordKeys],
      milestones,
      milestoneKeys: [...new Set(milestones.map((m) => m.key).filter(Boolean))],
      questAnswered,
      madeThing,
      stillBed,
      keptByYear,
      catches,
      chaseKeys: [...chaseKeys],
    };
  }

  /* The hum repertoire (design §3.4): one entry per episode
   * watched through, folded from the watch records the facts
   * already read — the hum itself rides the watch record, and
   * the repertoire is stored nowhere else. The shape mirrors
   * SparkActivities.humRepertoire (episodeId, line, rootHz,
   * scale, motifHz) and adds the day the token came home and
   * the episode's place, which the performance travels to.
   * An episode watched on the Day Out of Time names no plate:
   * its hum is still the Spark's, performed where it stands. */
  function humRepertoireFromFacts(facts) {
    const f = facts && typeof facts === "object" ? facts : lifeFactsFromRecords([], null);
    const out = [];
    for (const e of Array.isArray(f.episodes) ? f.episodes : []) {
      if (!e || !e.hum) continue;
      const motifHz = Array.isArray(e.hum.motifHz)
        ? e.hum.motifHz.filter((hz) => Number.isFinite(hz) && hz > 0)
        : [];
      if (!motifHz.length) continue;
      out.push({
        episodeId: e.id,
        title: e.title || "",
        line: e.line || "",
        land: e.land || "",
        moonName: e.moonName || "",
        token: e.token || "",
        rootHz: Number.isFinite(e.hum.rootHz) ? e.hum.rootHz : null,
        scale: typeof e.hum.scale === "string" ? e.hum.scale : "",
        motifHz,
        patternDay: Number.isInteger(e.patternDay) ? e.patternDay : null,
      });
    }
    return out;
  }

  const LIFE_STAGE_NAMES = { spark: "Spark", kindled: "Kindled", bearer: "Bearer", guardian: "Guardian" };

  function moonSpansDays(byMoon, days) {
    return Object.values(byMoon || {}).some((set) => (set instanceof Set ? set.size : (set || []).length) >= days);
  }

  /* The stage portrait, Gate E's rule read against the site's
   * facts: Kindled at three kinds of keeping; Bearer when a
   * carrying breadth stands (a Moon of garden across its
   * days, five episodes home, a still bed, a thing made) and
   * a Moon stands witnessed across its days; Guardian when
   * every counted day of one Pattern Year stands kept.
   * Facts only accumulate, so the portrait never goes down. */
  function lifeStageFromFacts(facts) {
    const f = facts && typeof facts === "object" ? facts : lifeFactsFromRecords([], null);
    for (const days of Object.values(f.keptByYear || {})) {
      if ((days instanceof Set ? days.size : (days || []).length) >= PATTERN_DAYS) return "guardian";
    }
    const carries = moonSpansDays(f.gardenByMoon, 14)
      || (f.episodes || []).length >= 5
      || Boolean(f.stillBed) || Boolean(f.madeThing);
    if (carries && moonSpansDays(f.witnessedByMoon, 14)) return "bearer";
    const kindCount = (f.kinds || []).filter((k) => k.present).length;
    if (kindCount >= 3) return "kindled";
    return "spark";
  }

  const SIGNATURE_BY_KIND = {
    fire: "flare-spin", water: "ripple-bow", shadow: "peek-back",
    air: "feather-loop", earth: "root-bow", light: "halo-bow",
  };
  const SECOND_SIGNATURE_BY_KIND = {
    fire: "ember-trail", water: "ripple-dance", shadow: "between-worlds",
    air: "windweaver", earth: "living-ground", light: "constellation",
  };
  const TRICK_NAMES = {
    hop: "Hop", drift: "Drift", "glow-pulse": "Glow Pulse", "first-note": "First Note",
    bow: "Bow",
    "flare-spin": "Flare-Spin", "ripple-bow": "Ripple-Bow", "peek-back": "Peek-Back",
    "feather-loop": "Feather Loop", "root-bow": "Root Bow", "halo-bow": "Halo Bow",
    "ember-trail": "Ember Trail", "ripple-dance": "Ripple Dance",
    "between-worlds": "Between Worlds", windweaver: "Windweaver",
    "living-ground": "Living Ground", constellation: "Constellation",
    "fetch-the-token": "Fetch the Token", "carry-the-lantern": "Carry the Lantern",
    route: "The Route You Taught", "whole-road": "The Whole Road",
  };
  const BASIC_TRICKS = ["hop", "drift", "glow-pulse", "first-note"];

  /* Each kind's paired act — the design's §3.2 table, in the
   * site readings Gate E named: Fire's practice sealed at the
   * Bench is a plan standing completed; Water's day beside
   * water is a day witnessed; Shadow's is the chase played to
   * a catch; Air's turning caught is an episode watched
   * through; Earth's is the garden kept on two days; Light's
   * is a word kept in the Word-Hoard. `plain` says the act in
   * plain words for the book's teaching lines. */
  function pairedActFor(kind, facts) {
    const f = facts && typeof facts === "object" ? facts : lifeFactsFromRecords([], null);
    switch (kind) {
      case "fire": return { stands: (f.milestones || []).length >= 1, moons: (f.milestoneKeys || []).length, ref: f.milestones?.[0]?.id || "", plain: "a plan standing completed in your planner" };
      case "water": return { stands: (f.witnessedDays || []).length >= 1, moons: (f.witnessedKeys || []).length, ref: f.witnessedDays?.length ? `pattern-day:${f.witnessedDays[0]}` : "", plain: "a day witnessed" };
      case "shadow": return { stands: (f.catches || 0) >= 1, moons: (f.chaseKeys || []).length, ref: "play:chase", plain: "a chase played to a catch" };
      case "air": return { stands: (f.episodes || []).length >= 1, moons: (f.episodeKeys || []).length, ref: f.episodes?.[0]?.id || "", plain: "an episode watched through" };
      case "earth": return { stands: (f.gardenDays || []).length >= 2, moons: (f.gardenKeys || []).length, ref: "garden", plain: "the garden kept on two different days" };
      case "light": return { stands: (f.wordDays || []).length >= 1, moons: (f.wordKeys || []).length, ref: f.wordDays?.length ? `pattern-day:${f.wordDays[0]}` : "", plain: "a word kept" };
      default: return { stands: false, moons: 0, ref: "", plain: "" };
    }
  }

  /* The tricks the record now supports, in learning order,
   * each with the act it was learned by — Gate E's derivation,
   * mirrored whole in slice 4, the carrying tricks included:
   * Fetch the Token learned with the Bearer stage itself (the
   * stage's proof performed, design §3.3); Carry the Lantern
   * at Bearer when an episode stands watched through — a
   * Waymaker skill met, its token home — and a practice stands
   * sealed, which Gate E reads on the site's records as a plan
   * standing completed (a milestone). Pure: writes nothing. */
  function derivedTricks({ kind, stage, facts, lines, record } = {}) {
    const out = [];
    const held = Array.isArray(lines) ? lines : [];
    const f = facts && typeof facts === "object" ? facts : lifeFactsFromRecords([], null);
    const closeDay = held.find((l) => l.line === "care-act" && l.kind === "close-day");
    if (closeDay) out.push({ trick: "bow", via: closeDay.id || "care:close-day" });
    const paired = pairedActFor(kind, f);
    if (stage && stage !== "spark" && paired.stands && SIGNATURE_BY_KIND[kind]) {
      out.push({ trick: SIGNATURE_BY_KIND[kind], via: paired.ref });
    }
    /* Slice 5 — the unified path: the site-wide core's kind
     * trick is this same feat under its own name. When the
     * core's learning stands on the record — its id stored in
     * play.tricks, or its counter at its need — the signature
     * derives too, at any stage: the keeper taught it on the
     * other face, and nobody loses a learned trick to the
     * unification. The learning pass witnesses it into a line
     * under the play's own via (play:<core id>). */
    if (SIGNATURE_BY_KIND[kind] && !out.some((d) => d.trick === SIGNATURE_BY_KIND[kind])) {
      const legacy = legacySignatureStands(record, kind);
      if (legacy.stands) out.push({ trick: SIGNATURE_BY_KIND[kind], via: legacy.via });
    }
    if (stage === "bearer" || stage === "guardian") {
      out.push({ trick: "fetch-the-token", via: "stage:bearer" });
      if ((f.episodes || []).length >= 1 && (f.milestones || []).length >= 1) {
        out.push({ trick: "carry-the-lantern", via: f.episodes[0].id });
      }
    }
    if ((stage === "bearer" || stage === "guardian") && paired.moons >= 2 && SECOND_SIGNATURE_BY_KIND[kind]) {
      out.push({ trick: SECOND_SIGNATURE_BY_KIND[kind], via: paired.ref });
    }
    return out;
  }

  /* The trick-learned lines a fresh derivation would add —
   * idempotent: a trick already witnessed by a line is never
   * witnessed twice. The coordinate is the day the learning
   * is witnessed on, from the canonical stamp. */
  function newTrickLines({ record, kind, facts, stamp, at } = {}) {
    const coord = lineCoordinateFromStamp(stamp);
    if (!coord) return [];
    const lines = lifeLinesOf(record);
    const stage = lifeStageFromFacts(facts);
    const held = new Set(lines.filter((l) => l.line === "trick-learned").map((l) => l.trick));
    const out = [];
    for (const d of derivedTricks({ kind, stage, facts, lines, record })) {
      if (held.has(d.trick)) continue;
      const line = makeLifeLine("trick-learned", { trick: d.trick, via: d.via || undefined, ...coord, at: at || null });
      if (line) { out.push(line); held.add(d.trick); }
    }
    return out;
  }

  /* ── The taught route ──────────────────────────────────── */
  /* A route is a play-session's reference: its days, in the
   * order the keeper showed them. The line carries the days
   * as its reference and nothing else — no score of the walk,
   * no judgement of it. */
  const ROUTE_MAX_DAYS = 12;
  function routeRefFor(days) {
    const list = Array.isArray(days) ? days.map(Number) : [];
    if (list.length < 2 || list.length > ROUTE_MAX_DAYS) return null;
    if (!list.every((pd) => Number.isInteger(pd) && pd >= 1 && pd <= PATTERN_DAYS)) return null;
    return `route:${list.join(",")}`;
  }

  function routeDaysFromRef(ref) {
    const m = typeof ref === "string" ? /^route:(\d{1,3}(?:,\d{1,3})*)$/.exec(ref) : null;
    if (!m) return null;
    const days = m[1].split(",").map(Number);
    return routeRefFor(days) ? days : null;
  }

  function routeDemosFromLines(lines) {
    const out = [];
    for (const l of Array.isArray(lines) ? lines : []) {
      if (!l || l.line !== "play-session" || l.kind !== "route-demo") continue;
      const days = routeDaysFromRef(l.ref);
      if (days) out.push({ id: l.id || "", days, moon: l.moon ?? null, patternYear: l.patternYear ?? null, patternDay: l.patternDay ?? null, civilDate: l.civilDate || null });
    }
    return out;
  }

  function routeLearningFor(lines, demo) {
    if (!demo) return null;
    return (Array.isArray(lines) ? lines : []).find(
      (l) => l && l.line === "trick-learned" && l.trick === "route" && l.via === demo.id
    ) || null;
  }

  /* A via reference, in plain words for the book: what act
   * taught this trick, said the way a keeper would say it. */
  function viaPlainFor(via, lines) {
    if (!via) return "from the record";
    const held = Array.isArray(lines) ? lines : [];
    if (held.some((l) => l && l.id === via && l.line === "care-act" && l.kind === "close-day")) {
      return "closing a day together";
    }
    if (via === "play:chase") return "the chase, played to a catch";
    const playRule = Object.values(CORE_KIND_TRICK_RULES).find((r) => `play:${r.id}` === via);
    if (playRule) return `learned by ${playRule.teacher}`;
    if (via === "garden") return "the garden, kept";
    if (via === "stage:bearer") return "the Bearer stage";
    if (/^pattern-day:\d+$/.test(via)) return "a day in the record";
    if (/^(ch|ep)-/.test(via) || via.includes("episode")) return "an episode watched through";
    return "an act in the record";
  }

  /* The trick book, whole — the model the panel renders.
   * Basics from birth; learned tricks with their days and
   * acts; the unlearned with what would teach them, in plain
   * words; the taught route and where its learning stands. */
  function trickBookFrom({ name, kind, record, facts, companion } = {}) {
    const who = typeof name === "string" && name.trim() ? name.trim() : "The Spark";
    const lines = lifeLinesOf(record);
    const stage = lifeStageFromFacts(facts);
    /* Slice 6 — the Whole Road stands in the book: its
     * programme at Guardian, its asking below it. */
    const road = wholeRoadProgrammeFrom({ name, kind, record, facts, companion });
    const roadShort = road ? wholeRoadShortFrom(road, kind) : null;
    const paired = pairedActFor(kind, facts);
    const learnedLines = lines.filter((l) => l.line === "trick-learned" && l.trick !== "route");
    const learnedIds = new Set(learnedLines.map((l) => l.trick));
    /* Slice 5 — the unified derivation: a signature the
     * site-wide core's learning already stands for (its id
     * stored, or its counter at its need) is this book's
     * learned trick too, even before the learning pass has
     * witnessed it into a line. Both faces derive one feat. */
    const signatureId = SIGNATURE_BY_KIND[kind];
    const legacySig = legacySignatureStands(record, kind);
    const signatureStands = Boolean(signatureId) && (learnedIds.has(signatureId) || legacySig.stands);
    const demos = routeDemosFromLines(lines);
    const demo = demos.length ? demos[demos.length - 1] : null;
    const routeLearned = demo ? routeLearningFor(lines, demo) : null;

    const unlearned = [];
    if (!learnedIds.has("bow")) {
      unlearned.push({
        trick: "bow", name: TRICK_NAMES.bow,
        teachLine: "Learned the first time the two of you close a day together — that rite stands in the day itself, before you leave it.",
      });
    }
    const signature = SIGNATURE_BY_KIND[kind];
    if (signature && !signatureStands) {
      unlearned.push({
        trick: signature, name: TRICK_NAMES[signature],
        teachLine: `Learned when your keeping spans three kinds and ${paired.plain} stands in the record.`,
      });
    }
    const second = SECOND_SIGNATURE_BY_KIND[kind];
    if (second && !learnedIds.has(second)) {
      unlearned.push({
        trick: second, name: TRICK_NAMES[second],
        teachLine: `Learned at Bearer, when ${paired.plain} stands in a second Moon as well.`,
      });
    }
    /* The carrying tricks (slice 4): learned exactly as Gate E
     * derives them, performed on their own stages — the book
     * names the stage so no keeper looks for them on this face. */
    if (!learnedIds.has("fetch-the-token")) {
      unlearned.push({
        trick: "fetch-the-token", name: TRICK_NAMES["fetch-the-token"],
        teachLine: "Learned with the Bearer stage itself — the stage where the Spark visibly carries. It is performed in Their Home, where the Spark brings you what you name.",
      });
    }
    if (!learnedIds.has("carry-the-lantern")) {
      unlearned.push({
        trick: "carry-the-lantern", name: TRICK_NAMES["carry-the-lantern"],
        teachLine: "Learned at Bearer, when a Waymaker skill stands met in an episode watched through and a practice stands sealed — a plan completed in your planner. It is carried at an opened day.",
      });
    }
    if (!road) {
      unlearned.push({
        trick: "whole-road", name: TRICK_NAMES["whole-road"],
        teachLine: "Learned with the Guardian stage itself — a full Pattern year kept, every counted day of it. Then the Spark performs the keeping on the Sphere itself: the birth day, the hums in the order they came home, the feats in the order they were learned, the first day closed together, and rest. It stands offered at the year's reading on the Day Out of Time, and in this book at any time — always at your asking, never by itself.",
      });
    }

    /* Where a learned trick is performed, when its stage is
     * not this face. Face tricks carry no `where`. */
    const WHERE_BY_TRICK = {
      "fetch-the-token": "performed in Their Home",
      "carry-the-lantern": "carried at an opened day",
    };

    const legacyEntry = signatureStands && !learnedIds.has(signatureId) ? [{
      trick: signatureId,
      name: TRICK_NAMES[signatureId] || signatureId,
      viaPlain: viaPlainFor(legacySig.via, lines),
      patternDay: null,
      where: null,
    }] : [];

    return {
      stage,
      stageName: LIFE_STAGE_NAMES[stage] || "Spark",
      kindsPresent: (facts?.kinds || []).filter((k) => k.present).map((k) => k.label),
      basics: BASIC_TRICKS.map((trick) => ({ trick, name: TRICK_NAMES[trick] })),
      learned: [...learnedLines.map((l) => ({
        trick: l.trick,
        name: TRICK_NAMES[l.trick] || l.trick,
        viaPlain: l.trick === "carry-the-lantern"
          ? "an episode watched through, its skill met, and a practice sealed"
          : viaPlainFor(l.via, lines),
        patternDay: l.patternDay ?? null,
        where: WHERE_BY_TRICK[l.trick] || null,
      })), ...legacyEntry],
      unlearned,
      hums: humRepertoireFromFacts(facts),
      route: demo ? { demo, learned: Boolean(routeLearned), learnedLine: routeLearned } : null,
      road,
      roadShort,
      who,
    };
  }

  /* ── Slice 6: the Whole Road ───────────────────────────── */
  /* The Guardian set piece (design §3.5), in the addendum's
   * elevated form (§4): the Sphere itself is the stage, and
   * the programme is composed ONLY from what the record
   * holds — no fabricated memories, no artificial milestones,
   * no invented experiences. The derivation mirrors Gate E's
   * wholeRoadProgramme in the app, beat for beat, so both
   * faces tell the same road: the birth coordinate first
   * (Gate E's own text for it), then the hums in the order
   * they came home, then the tricks in the order they were
   * learned, then the first closing — the beat Gate E's
   * programme names in its own account. Null until the
   * Guardian stage: a full Pattern year kept. A thin history
   * composes a short road; nothing is padded to length.
   * The programme is a reading: it writes nothing, and the
   * performance it spells (wholeRoadSteps) writes nothing. */
  function wholeRoadProgrammeFrom({ name, kind, record, facts, companion } = {}) {
    const f = facts && typeof facts === "object" ? facts : lifeFactsFromRecords([], null);
    if (lifeStageFromFacts(f) !== "guardian") return null;
    const lines = lifeLinesOf(record);
    const beats = [];
    const birthMoon = Number.isInteger(companion?.birthMoon) ? companion.birthMoon : null;
    const birthPdRaw = Number.isInteger(companion?.birthPatternDay) ? companion.birthPatternDay : null;
    const birthPd = birthPdRaw != null && birthPdRaw >= 1 && birthPdRaw <= PATTERN_DAYS ? birthPdRaw : null;
    beats.push({
      beat: "birth",
      ref: typeof record?.seed === "string" ? record.seed : "",
      pd: birthPd,
      moon: birthMoon,
      patternDay: birthPdRaw,
      text: birthMoon != null && birthPdRaw != null
        ? `Born Moon ${birthMoon} · Pattern Day ${birthPdRaw}`
        : "Born of the seed",
    });
    /* The hums walk in the order they came home. Gate E's
     * programme reads the app store in completion order; the
     * site's repository presents the record newest-first, so
     * the repertoire — which keeps that presentation — is
     * walked back into the order the watches were made. */
    for (const entry of [...humRepertoireFromFacts(f)].reverse()) {
      beats.push({
        beat: "hum", ref: entry.episodeId, pd: entry.patternDay ?? null,
        text: `The hum of ${entry.title || entry.episodeId}, carried home`,
        hum: entry,
      });
    }
    const demos = routeDemosFromLines(lines);
    for (const l of lines) {
      if (l.line !== "trick-learned") continue;
      const beat = {
        beat: "trick", ref: l.trick,
        pd: Number.isInteger(l.patternDay) ? l.patternDay : null,
        text: `${TRICK_NAMES[l.trick] || l.trick}, learned by ${viaPlainFor(l.via, lines)}`,
      };
      if (l.trick === "route") {
        /* The route's own walk rides its beat: the days the
         * keeper showed, read from the demonstration the
         * learning line names. */
        const demo = demos.find((d) => d.id && d.id === l.via);
        if (demo) beat.days = demo.days;
      }
      beats.push(beat);
    }
    const firstClose = lines.find((l) => l.line === "care-act" && l.kind === "close-day");
    if (firstClose) {
      beats.push({
        beat: "closing", ref: firstClose.id || "",
        pd: Number.isInteger(firstClose.patternDay) ? firstClose.patternDay : null,
        text: "The first day closed together",
      });
    }
    return {
      beats,
      bowStands: lines.some((l) => l.line === "trick-learned" && l.trick === "bow"),
      lanternStands: lines.some((l) => l.line === "trick-learned" && l.trick === "carry-the-lantern"),
    };
  }

  /* The shorter presentation (design §3.5; addendum §4):
   * the same facts, the year's turning points only — the
   * birth day, the first hum home and the latest, the two
   * signatures of the Spark's own kind, and the first day
   * closed together. A selection of the programme's own
   * beats, in the programme's own order; nothing is added
   * that the full road does not hold. */
  function wholeRoadShortFrom(programme, kind) {
    if (!programme || !Array.isArray(programme.beats)) return null;
    const beats = programme.beats;
    const out = [];
    const birth = beats.find((b) => b.beat === "birth");
    if (birth) out.push(birth);
    const hums = beats.filter((b) => b.beat === "hum");
    if (hums.length) {
      out.push(hums[0]);
      if (hums[hums.length - 1] !== hums[0]) out.push(hums[hums.length - 1]);
    }
    const sigIds = [SIGNATURE_BY_KIND[kind], SECOND_SIGNATURE_BY_KIND[kind]].filter(Boolean);
    for (const b of beats) {
      if (b.beat === "trick" && sigIds.includes(b.ref) && !out.includes(b)) out.push(b);
    }
    const closing = beats.find((b) => b.beat === "closing");
    if (closing) out.push(closing);
    return { beats: out, bowStands: programme.bowStands, lanternStands: programme.lanternStands };
  }

  /* ── Performances ──────────────────────────────────────── */
  /* A performance is a small choreography spelled in the
   * ruled vocabulary — hop, drift, glow, voice — over the
   * calendar's real plates. Steps:
   *   {type:"travel", pd, style:"hop"|"drift"|"dim"|"loop", fx?}
   *   {type:"act", act, ms}   — an in-place feat at the post
   *   {type:"pause", ms}
   * A travel leg aims at the nearest projected plate to its
   * ring target; a plate not on the face is never faked — the
   * leg lands on the post itself and reads as a hop in place.
   * Performances write nothing; this function only spells. */
  function performanceSteps(trickId, ctx = {}) {
    const post = Number(ctx.postPd);
    if (!Number.isInteger(post) || post < 1 || post > PATTERN_DAYS) return [];
    const projected = new Set(Array.isArray(ctx.projected) ? ctx.projected : []);
    const target = (step) => {
      const want = ringStepSafe(post, step);
      if (projected.has(want)) return want;
      let best = null;
      let bestDist = Infinity;
      for (const pd of projected) {
        const d = Math.abs(ringDistance(want, pd) ?? PATTERN_DAYS);
        if (d < bestDist) { bestDist = d; best = pd; }
      }
      return best != null && bestDist <= 6 ? best : post;
    };
    const farTarget = () => {
      let best = post;
      let bestDist = -1;
      for (const pd of projected) {
        const d = Math.abs(ringDistance(post, pd) ?? 0);
        if (d > bestDist) { bestDist = d; best = pd; }
      }
      return best;
    };
    const travel = (pd, style, fx) => ({ type: "travel", pd, style: style || "hop", ...(fx ? { fx } : {}) });
    const act = (name, ms) => ({ type: "act", act: name, ms });
    const pause = (ms) => ({ type: "pause", ms });

    switch (trickId) {
      case "hop": return [act("hop", 750)];
      case "drift": return [travel(target(1), "drift"), pause(350), travel(post, "drift")];
      case "glow-pulse": return [act("glow", 1300)];
      case "first-note": return [act("note", 1000)];
      case "bow": return [act("bow", 1600)];
      case "flare-spin": return [act("spin", 950)];
      case "ripple-bow": return [act("ripple", 1100), act("bow", 1400)];
      case "peek-back": return [travel(target(3), "dim"), pause(600), travel(post, "hop")];
      case "feather-loop": return [travel(target(2), "loop"), travel(post, "loop")];
      case "root-bow": return [act("ground", 1200), act("bow", 1700)];
      case "halo-bow": return [act("halo", 1300), act("bow", 1400)];
      case "ember-trail": return [travel(target(1), "drift", "motes"), travel(target(2), "drift", "motes"), travel(post, "drift")];
      case "ripple-dance": return [
        travel(target(1), "drift"), act("ripple", 900), act("bow", 900),
        travel(target(2), "drift"), act("ripple", 900), act("bow", 900),
        travel(post, "drift"),
      ];
      case "between-worlds": return [travel(farTarget(), "dim"), pause(700), travel(post, "drift")];
      case "windweaver": return [travel(target(2), "loop"), travel(target(1), "drift"), travel(target(3), "loop"), travel(post, "drift")];
      case "living-ground": return [travel(target(1), "hop", "ground"), travel(target(2), "hop", "ground"), travel(post, "hop")];
      case "constellation": return [
        travel(target(1), "drift", "stars"), travel(target(3), "drift", "stars"),
        travel(target(2), "drift", "stars"), pause(1300), travel(post, "drift"),
      ];
      case "hum": {
        /* A learned hum, performed at the day its token came
         * home when that plate stands on the face — the Spark
         * visits the episode's place on the instrument and
         * regards it by sounding the motif there. A token day
         * not on the face, or the Day Out of Time's no-plate,
         * is never faked: the hum sounds where the Spark
         * stands. ctx.humMs sizes the act to the motif. */
        const humPd = Number.isInteger(ctx.humPd) && ctx.humPd >= 1 && ctx.humPd <= PATTERN_DAYS ? ctx.humPd : null;
        const ms = Math.max(900, Math.min(4200, Number(ctx.humMs) || 1600));
        const steps = [];
        const away = humPd != null && humPd !== post && projected.has(humPd);
        if (away) steps.push(travel(humPd, "drift"));
        steps.push(act("hum", ms));
        if (away) steps.push(travel(post, "drift"));
        return steps;
      }
      case "route": {
        const days = (Array.isArray(ctx.routeDays) ? ctx.routeDays : [])
          .filter((pd) => Number.isInteger(pd) && pd >= 1 && pd <= PATTERN_DAYS);
        if (!days.length) return [];
        return [...days.map((pd) => travel(pd, "hop")), act("bow", 1400)];
      }
      default: return [];
    }
  }

  function ringStepSafe(from, step) {
    let dest = from + step;
    if (dest > PATTERN_DAYS) dest -= PATTERN_DAYS;
    if (dest < 1) dest += PATTERN_DAYS;
    return dest;
  }

  /* The Whole Road, spelled as a performance: the Spark
   * travels the programme's stations in the programme's own
   * order, on the Sphere's real plates, and at each station
   * does what the beat is — the seed-motif at the birth day,
   * the hum sounded at the day its token came home, a learned
   * feat performed at the day it was learned (a feat whose
   * stage is another face — the fetch, the lantern — is
   * regarded there with a glow, and named by the road's
   * reading; it is not faked onto this face), the Bow at the
   * first closing's day, and at the end, rest. Every step
   * carries its beat's index, so the road's reading can name
   * the beat as it is reached. A station whose plate is not
   * on the face degrades the way every performance degrades:
   * the travel leg reads as a hop in place, never a faked
   * path — the beat still stands, and is still named.
   * Pure: this function only spells; a performance writes
   * nothing. */
  function wholeRoadSteps(beats, ctx = {}) {
    const list = Array.isArray(beats) ? beats : [];
    const start = Number(ctx.postPd);
    if (!Number.isInteger(start) || start < 1 || start > PATTERN_DAYS || !list.length) return [];
    const projected = Array.isArray(ctx.projected) ? ctx.projected : [];
    const steps = [];
    let cur = start;
    list.forEach((b, i) => {
      if (!b || typeof b !== "object") return;
      if (i > 0) steps.push({ type: "pause", ms: 260, beat: i });
      if (Number.isInteger(b.pd) && b.pd >= 1 && b.pd <= PATTERN_DAYS && b.pd !== cur) {
        steps.push({ type: "travel", pd: b.pd, style: "drift", beat: i });
        cur = b.pd;
      }
      if (b.beat === "birth") {
        steps.push({ type: "act", act: "note", ms: 1100, beat: i });
        steps.push({ type: "act", act: "glow", ms: 900, beat: i });
      } else if (b.beat === "hum") {
        const entry = b.hum && typeof b.hum === "object" ? b.hum : null;
        const ms = entry && Array.isArray(entry.motifHz)
          ? Math.max(900, Math.min(4200, entry.motifHz.length * 420 + 500))
          : 1400;
        steps.push({ type: "act", act: "hum", ms, beat: i, ...(entry ? { hum: entry } : {}) });
      } else if (b.beat === "trick") {
        const station = cur;
        const sub = performanceSteps(b.ref, {
          postPd: station, projected,
          routeDays: Array.isArray(b.days) ? b.days : null,
        });
        if (sub.length) {
          for (const s of sub) {
            steps.push({ ...s, beat: i });
            if (s.type === "travel") cur = s.pd;
          }
          /* The road resumes from the station the beat
           * stands on, whatever the feat's own walk did. */
          if (cur !== station) {
            steps.push({ type: "travel", pd: station, style: "drift", beat: i });
            cur = station;
          }
        } else {
          steps.push({ type: "act", act: "glow", ms: 1000, beat: i });
        }
      } else if (b.beat === "closing") {
        steps.push(ctx.bowStands
          ? { type: "act", act: "bow", ms: 1600, beat: i }
          : { type: "act", act: "glow", ms: 1000, beat: i });
      } else {
        steps.push({ type: "act", act: "glow", ms: 900, beat: i });
      }
    });
    /* The design's ending: at the end, rest — at the final
     * station, in the posture itself. Its beat index stands
     * one past the programme's last beat. */
    steps.push({ type: "act", act: "rest", ms: 2000, beat: list.length });
    return steps;
  }


  /* ── Slice 5: the season, read from the pipeline ───────── */
  /* The year's turning, in the calendar's own facts. The
   * position arrives normalized by the DOM half from the one
   * pipeline (the temporal cursor, else the calendar): a
   * counted day with its Moon and Moon day, or a day outside
   * the count with its flag. The Moon's character (name,
   * element, essence) is the calendar data's own, passed in.
   * The quarter rule is the home world's (seasonForPatternDay
   * in spark-home-world.js): four quarters from the Year
   * Gate, so both faces name the same season. */
  const SEASON_QUARTER_NAMES = { spring: "Spring", summer: "Summer", autumn: "Autumn", winter: "Winter" };

  function quarterForPatternDay(pd) {
    const n = Number(pd);
    if (!Number.isInteger(n) || n < 1 || n > PATTERN_DAYS) return null;
    if (n <= 91) return "spring";
    if (n <= 182) return "summer";
    if (n <= 273) return "autumn";
    return "winter";
  }

  function seasonContextFor(pos, moonChar) {
    if (!pos || typeof pos !== "object") return null;
    const char = moonChar && typeof moonChar === "object" ? moonChar : null;
    const base = {
      moon: Number.isInteger(pos.moon) ? pos.moon : null,
      moonDay: Number.isInteger(pos.moonDay) ? pos.moonDay : null,
      patternDay: Number.isInteger(pos.patternDay) ? pos.patternDay : null,
      patternYear: pos.patternYear ?? null,
      moonName: (char && char.name) || pos.moonName || null,
      essence: (char && char.essence) || null,
      element: (char && char.element) || null,
      quarter: null,
      seasonDay: null,
    };
    if (pos.isDeepTimeDay) return { ...base, kind: "deep-time-day" };
    if (pos.isDayOutOfTime) return { ...base, kind: "day-out-of-time" };
    if (base.patternDay == null) return null;
    base.quarter = quarterForPatternDay(base.patternDay);
    if (base.patternDay === 1) {
      /* The Year Gate: the new year's first day. Across the
       * gate stands the old year's last day — the season's
       * day an idle ranging may cross to and regard. */
      return { ...base, kind: "year-gate", seasonDay: PATTERN_DAYS };
    }
    if (base.moonDay === 28) {
      /* The Moon's last day: the turn. The season's day is
       * the next Moon's first day (ringStepSafe wraps the
       * year's own end back to the Gate). */
      return { ...base, kind: "moon-turn", seasonDay: ringStepSafe(base.patternDay, 1) };
    }
    if (base.moonDay === 1 && base.moon != null && base.moon > 1) {
      /* A Moon opens today; behind it stands the day just
       * closed, the season's day to regard. */
      return { ...base, kind: "moon-opening", seasonDay: ringStepSafe(base.patternDay, -1) };
    }
    return { ...base, kind: "moon" };
  }

  /* The season, in plain words for the Spark's panel — every
   * fact in it is the pipeline's or the calendar data's own:
   * the Moon's name and essence, the quarter, the next Moon
   * at a turn. Nothing is forecast and no weather is claimed. */
  function seasonLineFor(ctx, opts) {
    if (!ctx) return null;
    const name = opts && typeof opts.name === "string" && opts.name.trim() ? opts.name.trim() : "The Spark";
    const nextMoonChar = opts && opts.nextMoonChar && typeof opts.nextMoonChar === "object" ? opts.nextMoonChar : null;
    const moonBit = ctx.moon != null
      ? `Moon ${ctx.moon}${ctx.moonName ? `, ${ctx.moonName}` : ""}`
      : null;
    const quarterBit = ctx.quarter ? `${SEASON_QUARTER_NAMES[ctx.quarter]} of the Pattern year` : null;
    const essenceBit = ctx.essence ? ` — ${ctx.essence.charAt(0).toLowerCase()}${ctx.essence.slice(1)}` : "";
    switch (ctx.kind) {
      case "day-out-of-time":
        return `Today stands outside the count — the Day Out of Time, belonging to no Moon. There is no plate for ${name} to stand on today, and none is pretended: ${name} keeps the threshold with you.`;
      case "deep-time-day":
        return `Today is the Deep Time Day — the leap day of the Pattern year, standing outside the count of Moons. ${name} keeps the threshold with you; there is no plate today, and none is pretended.`;
      case "year-gate":
        return `The Year Gate — Pattern Day 1 of a new Pattern year${moonBit ? `, opening on ${moonBit}` : ""}. Behind the gate stands the year that was; when ${name} ranges, it may cross to the old year's last day and look back.`;
      case "moon-turn": {
        const nextBit = nextMoonChar
          ? `Moon ${nextMoonChar.idx != null ? nextMoonChar.idx : ""}${nextMoonChar.name ? `, ${nextMoonChar.name}` : ""}`
          : null;
        return `The Moon turns: ${moonBit || "this Moon"} closes with this day${nextBit ? `, and ${nextBit} opens next` : ""}. When ${name} ranges, it goes to the new Moon's first day and regards it.`;
      }
      case "moon-opening":
        return `A Moon opens today: ${moonBit || "a new Moon"}${essenceBit}. The day just closed stands behind the gate of it, and ${name} may go and regard it.`;
      case "moon":
        return `The year around ${name}: ${moonBit || "a Moon of the year"}${essenceBit}${quarterBit ? `. ${quarterBit}` : ""}.`;
      default:
        return null;
    }
  }

  /* ── Slice 5: surroundings — the opened day's character ── */
  /* What the Spark answers inside an opened day: the
   * strongest character the record lays on that day, in the
   * order a discovery names marks — the birth day first, then
   * a garden day (the garden's own records, folded with the
   * facts), a token's home, a practice, a witnessing, and a
   * day merely kept. The answer is a posture, and a glow for
   * the birth day; nothing is claimed beyond the record. */
  const SURROUND_POSTURES = {
    genesis: "observe", garden: "observe", token: "observe",
    practice: "stand", witnessed: "settle", kept: "sit",
  };

  function surroundingsForDay(input) {
    const args = input || {};
    const pd = Number(args.patternDay);
    if (!Number.isInteger(pd)) return { kind: null, posture: "observe", glow: false };
    const marks = args.marks && typeof args.marks === "object" ? args.marks : {};
    const held = Array.isArray(marks[pd]) ? marks[pd] : [];
    if (held.includes("genesis")) return { kind: "genesis", posture: "observe", glow: true };
    if (Array.isArray(args.gardenDays) && args.gardenDays.includes(pd)) {
      return { kind: "garden", posture: "observe", glow: false };
    }
    const kind = markKindFor(held);
    if (!kind) return { kind: null, posture: "observe", glow: false };
    return { kind, posture: SURROUND_POSTURES[kind] || "observe", glow: false };
  }

  /* ── Slice 5: care, in Gate E's kinds ──────────────────── */
  /* The care kinds are Gate E's names, exactly (SparkLife's
   * CARE_* constants): the standing acts, Carry For Me with
   * its end recorded against it, and Quiet Company. The
   * derivations here are readings over the life lines — the
   * panel's states and the open carry — and write nothing. */
  const CARE_KINDS = ["kindle", "tend", "rest", "close-day", "carry", "carry-end", "sat-with"];

  /* The open carry, Gate E's semantics exactly: a carry line
   * whose id no carry-end line names as its ref. The last
   * such line stands (a second carry is refused at the
   * writing, so at most one can honestly stand open). */
  function openCarryFromLines(lines) {
    const held = Array.isArray(lines) ? lines : [];
    const ended = new Set();
    for (const l of held) {
      if (l && l.line === "care-act" && l.kind === "carry-end" && l.ref != null) ended.add(String(l.ref));
    }
    let open = null;
    for (const l of held) {
      if (l && l.line === "care-act" && l.kind === "carry" && l.id != null && !ended.has(String(l.id))) open = l;
    }
    return open;
  }

  /* The day's care, read for the panel: which of today's
   * acts already stand, and the carry that stands open.
   * "Today" is the civil date the acts are stamped with —
   * the dedupe the panel's buttons honour is by that date,
   * per kind (and per ref where the ref is the act's own
   * object: the day sat with, the dress chosen). */
  function careStateFromLines(lines, civilDate) {
    const held = (Array.isArray(lines) ? lines : []).filter((l) => l && l.line === "care-act");
    const today = typeof civilDate === "string" ? civilDate : null;
    const todays = today ? held.filter((l) => l.civilDate === today) : [];
    return {
      kindledToday: todays.some((l) => l.kind === "kindle"),
      restedToday: todays.some((l) => l.kind === "rest"),
      tendRefsToday: todays.filter((l) => l.kind === "tend").map((l) => l.ref || ""),
      satWithRefsToday: todays.filter((l) => l.kind === "sat-with").map((l) => l.ref || ""),
      openCarry: openCarryFromLines(held),
    };
  }

  /* ── Slice 5: one trick derivation, two faces ──────────── */
  /* The companion core's kind trick and this book's kind
   * signature are one feat under two names. The core's rule
   * table (its KIND_TRICKS) is mirrored here so this face can
   * read the core's learning from the record alone — the
   * counts live in the record's play and care blocks, the
   * learned ids in its play.tricks. A test pins this mirror
   * against the core's own table, the way the keeping table
   * is pinned against SparkActivities'. */
  const CORE_KIND_TRICK_RULES = {
    fire: { id: "flare", via: "kindles", need: 2, teacher: "kindling" },
    water: { id: "ripple", via: "pets", need: 8, teacher: "petting, patiently" },
    shadow: { id: "vanish", via: "rests", need: 2, teacher: "resting together" },
    air: { id: "loop", via: "plays", need: 2, teacher: "chases walked to their end" },
    earth: { id: "root", via: "bond", need: 4, teacher: "the bond itself" },
    light: { id: "beam", via: "echoBest", need: 3, teacher: "the echo game" },
  };

  /* The counters a trick can learn from, read from the Spark
   * record the way the core reads them (its playOf / careOf
   * sanitisers, mirrored): play's own counts, and care's. */
  function coreCountsFromRecord(record) {
    const num = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
    const p = (record && record.play) || {};
    const c = (record && record.care) || {};
    return {
      pets: num(p.pets), pokes: num(p.pokes), drags: num(p.drags),
      catches: num(p.catches), echoBest: num(p.echoBest),
      kindles: num(c.kindles), plays: num(c.plays), rests: num(c.rests),
      bond: num(c.bond),
    };
  }

  /* Whether the core's kind trick stands learned by the
   * core's own rule — its id stored by an earlier learning,
   * or its counter at its need. The via names the play line
   * the learning is witnessed under (play:<core id>). */
  function legacySignatureStands(record, kind) {
    const rule = CORE_KIND_TRICK_RULES[kind];
    if (!rule) return { stands: false, via: null, teacher: "" };
    const stored = record && record.play && Array.isArray(record.play.tricks) ? record.play.tricks : [];
    if (stored.includes(rule.id)) return { stands: true, via: `play:${rule.id}`, teacher: rule.teacher };
    const counts = coreCountsFromRecord(record);
    if ((counts[rule.via] || 0) >= rule.need) return { stands: true, via: `play:${rule.id}`, teacher: rule.teacher };
    return { stands: false, via: null, teacher: rule.teacher };
  }

  /* ── Slice 5: the carried line (design §1.4) ───────────── */
  /* A fetch of a keepsake never yet fetched writes one line
   * on the keepsake's own Atlas record: "carried to you,
   * [day]". The line rides the record's payload as
   * carriedLines — append-only, like everything in this
   * house — and the record itself is the proof it happened:
   * a record already carrying a line is never written twice.
   * Pure: the updated record, or null when the line already
   * stands or no day is given. Their Home performs the write
   * through the repository's own put. */
  function carriedLineFor(coord) {
    const args = coord || {};
    if (typeof args.civilDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(args.civilDate)) return null;
    return {
      text: `carried to you, ${args.civilDate}`,
      civilDate: args.civilDate,
      patternDay: Number.isInteger(args.patternDay) ? args.patternDay : null,
    };
  }

  function carriedLinesOfRecord(record) {
    const lines = record && record.payload ? record.payload.carriedLines : null;
    return Array.isArray(lines) ? lines.filter((l) => l && typeof l.text === "string") : [];
  }

  function carriedLineForRecord(record, coord) {
    if (!record || typeof record !== "object") return null;
    if (carriedLinesOfRecord(record).length) return null;
    const line = carriedLineFor(coord);
    if (!line) return null;
    const payload = { ...(record.payload && typeof record.payload === "object" ? record.payload : {}) };
    payload.carriedLines = [...carriedLinesOfRecord(record), line];
    return { record: { ...record, payload }, line };
  }


  /* Today's stamp from the canonical pipeline, read from any
   * root: the Spark's own stamp where it stands (SphereSpark
   * .stamp is the cursor, else the calendar), else the same
   * pipeline read directly. One implementation, shared by the
   * mount's writer and the writer door below. */
  function stampFromRoot(rootLike) {
    try {
      const s = rootLike.SphereSpark && rootLike.SphereSpark.stamp ? rootLike.SphereSpark.stamp() : null;
      if (s && s.civilDate) return s;
    } catch { /* fall through to the pipeline itself */ }
    const date = new Date();
    let pos = null;
    try { pos = rootLike.SOFTemporalCursor && rootLike.SOFTemporalCursor.resolvePosition ? rootLike.SOFTemporalCursor.resolvePosition(date) : null; } catch { pos = null; }
    if (!pos) {
      try { pos = rootLike.PatternCalendar && rootLike.PatternCalendar.fromCivilDate ? rootLike.PatternCalendar.fromCivilDate({ date }) : null; } catch { pos = null; }
    }
    if (!pos) return null;
    return {
      moon: pos.moon ?? null,
      day: pos.day ?? null,
      patternDay: pos.dayOfPatternYear ?? null,
      patternYear: pos.patternYear ?? null,
      civilDate: pos.civilDate || date.toISOString().slice(0, 10),
    };
  }

  /* The writer door, for the companion layer's other faces:
   * Their Home's carry writes its care-act lines through this
   * door — the same writer (makeLifeLine + appendLifeLine),
   * the same seed-keyed store, the same refusal rules (no
   * coordinate, no line). Returns the stored line, or null
   * when the line refuses: nothing is written then. */
  function appendLifeLineViaRoot(rootLike, shape, fields) {
    let record = null;
    try {
      const raw = rootLike.localStorage ? rootLike.localStorage.getItem("sof.spark.v1") : null;
      record = raw ? JSON.parse(raw) : null;
    } catch { return null; }
    if (!record) return null;
    const coord = lineCoordinateFromStamp(stampFromRoot(rootLike));
    if (!coord) return null;
    const line = makeLifeLine(shape, { ...(fields || {}), ...coord, at: new Date().toISOString() });
    if (!line) return null;
    const appended = appendLifeLine(record, line);
    if (!appended) return null;
    try { rootLike.localStorage.setItem("sof.spark.v1", JSON.stringify(appended.record)); } catch { return null; }
    return appended.line;
  }

  function mount(root) {
    const document = root.document;
    if (!document) return;
    const wrap = document.querySelector(".sphere-canvas-wrap");
    const strip = document.getElementById("sphere-state-strip");
    if (!wrap || !strip) return;

    const reducedMotion = typeof root.matchMedia === "function"
      && root.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let holder = null;
    let raf = 0;
    let destroyed = false;

    /* ── State ─────────────────────────────────────────────── */
    let postPd = null;          // the Pattern Day the Spark stands on / travels to
    let todayPd = null;         // today's Pattern Day (home)
    let mode = "posted";        // posted | travelling | idle | in-day
    let posture = "stand";      // stand | settle | sit | observe | rest
    let pos = null;             // {x, y} wrap-relative centre, once placed
    let travel = null;          // {from:{x,y}, startedAt, durationMs, targetPd}
    let lastActionAt = Date.now();
    let idleUntil = 0;          // posture behaviours: when this idle act ends
    let idleReturnPd = null;    // a visit's way home
    let lastStripText = null;
    let missingSince = null;    // when the post's label was last seen present

    /* ── Slice 2 state ─────────────────────────────────────── */
    let breadth = null;         // the shared record's breadth, refreshed as it changes
    let prefs = null;           // preferences derived from that breadth
    let tokenInfo = { tokenCount: 0, tokenDays: [] }; // the Atlas fold, read async
    let idleAct = null;         // the idle act in progress (slice 2's wider set)
    let arrivalStayMs = 6000;   // how long a travelling idle act stays on arrival
    let arrivalPosture = "observe";
    let pendingDiscovery = null; // {pd, kind} a travelling approach/keep will regard
    let favoursSection = null;  // the panel section, once placed
    let favoursText = null;     // the lines last written to it

    /* ── Slice 3 state ─────────────────────────────────────── */
    let atlasFacts = null;      // the life facts folded from the Atlas (async)
    let trickSection = null;    // the trick book's panel section, once placed
    let bookNote = null;        // a one-line note the book shows until it changes
    let teaching = null;        // {days:[pd…]} while the keeper shows a route
    let perf = null;            // {trick, steps, idx, onDone} while performing
    let perfStepEndsAt = 0;     // rAF-clock deadline for the current act/pause
    let perfAct = null;         // the in-place act in progress (hop, spin…)
    let perfActMs = 0;
    let perfStepFx = null;      // the light the current travel leg lays on arrival
    let perfTravelFrom = null;  // the current leg's origin point (for motes)
    const perfStars = [];       // constellation stars, held until the performance ends
    let closingRow = null;      // the closing rite's row inside the Day World
    let closingTries = 0;
    let closingNote = null;

    /* ── Slice 4 state ─────────────────────────────────────── */
    let perfHum = null;         // the repertoire entry a hum performance sounds
    let lanternEl = null;       // the lit lantern the holder carries in a day

    /* ── Slice 5 state ─────────────────────────────────────── */
    let seasonCtx = null;       // the season context, from the pipeline
    let seasonSection = null;   // the season's panel section, once placed
    let seasonText = null;      // the season line last written to it
    let careSection = null;     // the care panel's section, once placed
    let careNote = null;        // a one-line note the care panel shows
    let seasonVisitDone = false; // the season's first ranging, once per page visit
    let restUntil = 0;          // a keeper-sent rest: idle life waits until then
    let quietSitting = false;   // Quiet Company in progress inside a day
    let sittingRow = null;      // Quiet Company's row inside the Day World
    let sittingNote = null;
    let carryTitles = {};       // carry ref → the keepsake's name, from the Atlas fold

    /* ── Slice 6 state ─────────────────────────────────────── */
    let roadNowEl = null;       // the road's reading line in the book, while it walks
    let roadNowText = "";       // the beat the reading last named
    let seasonRoadNote = null;  // a one-line note the season's offer shows

    function readRecord() {
      try {
        const raw = root.localStorage?.getItem("sof.spark.v1");
        return raw ? JSON.parse(raw) : null;
      } catch { return null; }
    }

    function readRaw(key) {
      try { return root.localStorage?.getItem(key) ?? null; } catch { return null; }
    }

    function readJson(key) {
      const raw = readRaw(key);
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return null; }
    }

    /* The witnessed days, from the Codex memory's own store,
     * converted by the canonical calendar — the one pipeline,
     * read the way the Spark's own stamps read it. */
    function readWitnessedPds() {
      const memory = readJson("sof.codexMemory.v1");
      const days = Array.isArray(memory?.currentCycle?.witnessedDays)
        ? memory.currentCycle.witnessedDays : [];
      const convert = root.PatternCalendar?.fromCivilDate
        ? (arg) => root.PatternCalendar.fromCivilDate(arg) : null;
      const out = [];
      for (const iso of days) {
        const pd = patternDayForCivil(iso, convert);
        if (pd && !out.includes(pd)) out.push(pd);
      }
      return out;
    }

    function sparkName(record) {
      const n = typeof record?.name === "string" ? record.name.trim() : "";
      return n || "The Spark";
    }

    /* Breadth and preferences, refreshed from the record's own
     * sources. The synchronous sources are read fresh every
     * time; the Atlas fold (tokens) lands async and refreshes
     * again when it arrives. */
    function refreshBreadth() {
      const record = readRecord();
      breadth = breadthFromSources({
        record,
        witnessedPds: readWitnessedPds(),
        genesisPd: genesisPatternDayFromRaw(readRaw("sofGenesisProfilesV2")),
        tokenInfo,
      });
      prefs = preferencesFromBreadth(breadth, sparkName(record));
      renderFavours();
      return breadth;
    }

    /* The tokens, read from the Life Atlas the page already
     * carries — the same runtime spark-home-world reads, queried
     * read-only. The runtime stands up late on this page (the
     * page gives the calendar quiet windows first), so the fold
     * waits for it rather than reading once and missing it; and
     * it re-folds whenever the page's own records-changed signal
     * fires, so a token that comes home while the keeper is on
     * this page is folded without a reload. Absent runtime,
     * absent tokens: the breadth simply holds none, and no
     * favour claims a keepsake. */
    let tokensInFlight = false;
    let tokensQueued = false;
    async function refreshTokens() {
      if (tokensInFlight) { tokensQueued = true; return; }
      tokensInFlight = true;
      try {
        let runtime = root.CodexLifeAtlasRuntime;
        for (let i = 0; i < 90 && !runtime?.ready; i += 1) {
          await new Promise((resolve) => root.setTimeout(resolve, 2000));
          runtime = root.CodexLifeAtlasRuntime;
        }
        if (!runtime?.ready) return;
        const repository = await runtime.ready;
        if (!repository?.query) return;
        const records = await repository.query({});
        tokenInfo = tokenDaysFromRecords(records);
        /* Slice 3: the same fold carries the life facts the
         * trick book derives from — one query, read once. A
         * learning the record now supports is witnessed here,
         * on the day it is derived (Gate E's semantics). */
        atlasFacts = lifeFactsFromRecords(records, readRecord());
        /* Slice 5: the carry's names, for the care panel's
         * carrying line — the keepsakes and tokens a carry ref
         * can name, read from this same fold. */
        carryTitles = {};
        for (const r of Array.isArray(records) ? records : []) {
          if (!r || typeof r !== "object") continue;
          const payload = r.payload && typeof r.payload === "object" ? r.payload : {};
          if (r.type === "artifact" && r.subtype === "hidden-keepsake" && r.id) {
            carryTitles[`keepsake:${r.id}`] = payload.name || payload.title || r.title || "";
          }
          const acts = payload.sparkActivities && typeof payload.sparkActivities === "object" ? payload.sparkActivities : null;
          const epId = payload.episodeId || (acts && acts.episodeId);
          if (r.type === "event" && r.subtype === "episode-watched" && epId) {
            carryTitles[`token:${epId}`] = payload.episodeTitle
              || (acts && acts.distinguisher && acts.distinguisher.token) || "";
          }
        }
        refreshBreadth();
        learnNewTricksNow();
        renderTrickBook();
        renderCare();
        renderSeason();
        refreshCarriedMark();
      } catch { /* the fold is a reading; a failed reading changes nothing */ }
      finally {
        tokensInFlight = false;
        if (tokensQueued) { tokensQueued = false; refreshTokens(); }
      }
    }

    /* The favours, in the Spark's own panel on this page — the
     * ambient panel where the keeper line already stands. Not a
     * new page and not a new surface: the panel the keeper
     * already reads, given the derivation in plain words. */
    function renderFavours() {
      if (!favoursSection || !breadth || !prefs) return;
      const lines = favoursLines(prefs, breadth, sparkName(readRecord()));
      const text = lines.join("\n");
      if (text === favoursText) return;
      favoursText = text;
      favoursSection.replaceChildren();
      const heading = document.createElement("h3");
      heading.className = "sphere-spark-favours-title";
      heading.textContent = `What ${sparkName(readRecord())} has come to favour`;
      favoursSection.appendChild(heading);
      for (const line of lines) {
        const p = document.createElement("p");
        p.className = "sphere-spark-favours-line";
        p.textContent = line;
        favoursSection.appendChild(p);
      }
    }

    function placeFavoursPanel() {
      let tries = 0;
      const timer = root.setInterval(() => {
        tries += 1;
        const panel = document.querySelector(".sphere-ambient-panel");
        if (panel) {
          root.clearInterval(timer);
          if (!panel.querySelector(".sphere-spark-favours")) {
            favoursSection = document.createElement("section");
            favoursSection.className = "sphere-spark-favours";
            favoursSection.setAttribute("aria-label", "What your Spark has come to favour");
            panel.appendChild(favoursSection);
            favoursText = null;
            renderFavours();
          }
          return;
        }
        if (tries > 60) root.clearInterval(timer);
      }, 250);
    }

    /* ── Slice 3: the writer ───────────────────────────────── */
    /* Today's coordinate from the canonical pipeline — the
     * Spark's own stamp where it stands (SphereSpark.stamp is
     * the cursor, else the calendar), else the same pipeline
     * read directly. A line is stamped with the day the act
     * happens on; if no stamp can be read, the write refuses —
     * a line without its day is not written at all. */
    function currentStamp() {
      return stampFromRoot(root);
    }

    function sparkKind(record) {
      try { return root.SparkCompanion?.generate?.(record?.seed)?.kind || null; } catch { return null; }
    }

    /* The Spark's generated self — its birth coordinate rides
     * it (the seed's Moon and Pattern Day), the Whole Road's
     * first beat. Read the way sparkKind reads the kind. */
    function sparkCompanionOf(record) {
      try { return root.SparkCompanion?.generate?.(record?.seed) || null; } catch { return null; }
    }

    function persistRecord(record) {
      try {
        root.localStorage?.setItem("sof.spark.v1", JSON.stringify(record));
        return true;
      } catch { return false; }
    }

    /* Append one life line to the keeper's record — the only
     * door the writer has. Returns the stored line, or null
     * when the line refuses (a forbidden key, no coordinate,
     * no record): nothing is written then, and the act that
     * asked says so. */
    function appendLifeLineNow(shape, fields) {
      const record = readRecord();
      if (!record) return null;
      const coord = lineCoordinateFromStamp(currentStamp());
      if (!coord) return null;
      const line = makeLifeLine(shape, { ...fields, ...coord, at: new Date().toISOString() });
      if (!line) return null;
      const appended = appendLifeLine(record, line);
      if (!appended || !persistRecord(appended.record)) return null;
      return appended.line;
    }

    /* Witness the learnings the record now supports: tricks
     * whose derivation stands and that no line has witnessed
     * yet are appended as trick-learned lines, stamped today.
     * Idempotent — a second fold over the same record adds
     * nothing. Runs when the Atlas fold lands and after the
     * acts that can teach (closing a day together). */
    function learnNewTricksNow() {
      const record = readRecord();
      if (!record) return [];
      const facts = atlasFacts || lifeFactsFromRecords([], record);
      const fresh = newTrickLines({
        record, kind: sparkKind(record), facts,
        stamp: currentStamp(), at: new Date().toISOString(),
      });
      if (!fresh.length) return [];
      let current = record;
      const stored = [];
      for (const line of fresh) {
        const appended = appendLifeLine(current, line);
        if (appended) { current = appended.record; stored.push(appended.line); }
      }
      if (!stored.length || !persistRecord(current)) return [];
      bookNote = `${sparkName(record)} has learned ${stored.map((l) => TRICK_NAMES[l.trick] || l.trick).join(" and ")}.`;
      return stored;
    }

    /* ── Slice 3: the trick book ───────────────────────────── */
    /* The book stands in the same ambient panel as the favours
     * — the Spark's existing surface, not a new page. Learned
     * tricks are buttons; unlearned tricks are plain words
     * saying what would teach them. Slice 4: the carrying
     * tricks stand as named lines (their stages are Their Home
     * and the opened day, not this face), and the learned hums
     * stand as buttons under their own heading. */
    function renderTrickBook() {
      if (!trickSection) return;
      const record = readRecord();
      trickSection.replaceChildren();
      const heading = document.createElement("h3");
      heading.className = "sphere-spark-tricks-title";
      if (!record) {
        heading.textContent = "What the Spark can do";
        trickSection.appendChild(heading);
        const p = document.createElement("p");
        p.className = "sphere-spark-tricks-line";
        p.textContent = "No Spark stands here yet.";
        trickSection.appendChild(p);
        return;
      }
      const facts = atlasFacts || lifeFactsFromRecords([], record);
      const book = trickBookFrom({ name: sparkName(record), kind: sparkKind(record), record, facts, companion: sparkCompanionOf(record) });
      heading.textContent = `What ${book.who} can do`;
      trickSection.appendChild(heading);

      const stageLine = document.createElement("p");
      stageLine.className = "sphere-spark-tricks-line";
      stageLine.textContent = `${book.who} stands ${book.stageName} — painted by breadth: ${book.kindsPresent.length ? book.kindsPresent.join(", ") : "the keeping is just beginning"}.`;
      trickSection.appendChild(stageLine);

      if (bookNote) {
        const note = document.createElement("p");
        note.className = "sphere-spark-tricks-line sphere-spark-tricks-note";
        note.textContent = bookNote;
        trickSection.appendChild(note);
      }

      const performRow = (item, viaLine) => {
        const row = document.createElement("div");
        row.className = "sphere-spark-trick-row";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sphere-spark-trick-btn";
        btn.textContent = item.name;
        btn.setAttribute("aria-label", `Ask ${book.who} to perform ${item.name}`);
        btn.addEventListener("click", () => performTrick(item.trick));
        row.appendChild(btn);
        if (viaLine) {
          const via = document.createElement("span");
          via.className = "sphere-spark-trick-via";
          via.textContent = viaLine;
          row.appendChild(via);
        }
        trickSection.appendChild(row);
      };
      for (const item of book.basics) performRow(item, "from birth");
      for (const item of book.learned) {
        const viaLine = `learned by ${item.viaPlain}${item.patternDay ? ` · Pattern Day ${item.patternDay}` : ""}`;
        if (item.where) {
          /* A carrying trick's stage is not this face: the book
           * names it and where it is performed — no button
           * pretends otherwise. */
          const p = document.createElement("p");
          p.className = "sphere-spark-tricks-line sphere-spark-trick-carrying";
          p.textContent = `${item.name} — ${viaLine}; ${item.where}.`;
          trickSection.appendChild(p);
          continue;
        }
        performRow(item, viaLine);
      }

      /* The hums (slice 4): one button per episode watched
       * through — the Spark sounds its motif at the day the
       * token came home. Nothing watched, no hums: the book
       * says so in one honest line. */
      const humsTitle = document.createElement("p");
      humsTitle.className = "sphere-spark-tricks-line sphere-spark-tricks-hums-title";
      humsTitle.textContent = book.hums.length
        ? `The hums ${book.who} has learned — one for each episode watched through:`
        : `No hums learned yet — an episode watched through to its end teaches ${book.who} its hum.`;
      trickSection.appendChild(humsTitle);
      for (const hum of book.hums) {
        const row = document.createElement("div");
        row.className = "sphere-spark-trick-row";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sphere-spark-trick-btn";
        btn.textContent = hum.title ? `Sound the hum of ${hum.title}` : "Sound a learned hum";
        btn.setAttribute("aria-label", `Ask ${book.who} to sound the hum of ${hum.title || "an episode watched through"}`);
        btn.addEventListener("click", () => performHum(hum));
        row.appendChild(btn);
        const via = document.createElement("span");
        via.className = "sphere-spark-trick-via";
        via.textContent = [
          hum.land ? `of ${hum.land}` : "",
          hum.moonName ? `under ${hum.moonName}` : "",
          hum.patternDay ? `its token came home on Pattern Day ${hum.patternDay}` : "its token came home on the Day Out of Time",
        ].filter(Boolean).join(" · ");
        row.appendChild(via);
        trickSection.appendChild(row);
      }

      /* The taught route: teaching in progress, a route
       * standing unlearned, a route learned, or the offer. */
      if (teaching) {
        const line = document.createElement("p");
        line.className = "sphere-spark-tricks-line";
        line.textContent = teaching.days.length > 1
          ? `The way so far: Pattern Days ${teaching.days.join(", ")}. Open the next day of the route — ${book.who} follows you.`
          : `Teaching a route. Open the days of the way, one after another — ${book.who} follows you.`;
        trickSection.appendChild(line);
        const row = document.createElement("div");
        row.className = "sphere-spark-trick-row";
        const done = document.createElement("button");
        done.type = "button";
        done.className = "sphere-spark-trick-btn";
        done.textContent = "That's the route";
        done.disabled = teaching.days.length < 2;
        done.addEventListener("click", finishTeaching);
        const letGo = document.createElement("button");
        letGo.type = "button";
        letGo.className = "sphere-spark-trick-btn sphere-spark-trick-btn-quiet";
        letGo.textContent = "Let it go";
        letGo.addEventListener("click", cancelTeaching);
        row.append(done, letGo);
        trickSection.appendChild(row);
      } else if (book.route) {
        const { demo, learned } = book.route;
        const line = document.createElement("p");
        line.className = "sphere-spark-tricks-line";
        line.textContent = learned
          ? `The route you taught — Pattern Days ${demo.days.join(", ")} — is ${book.who}'s own now.`
          : `The route you taught: Pattern Days ${demo.days.join(", ")}, shown in Moon ${demo.moon ?? "?"}. Walk it back in another Moon and it becomes ${book.who}'s own.`;
        trickSection.appendChild(line);
        const row = document.createElement("div");
        row.className = "sphere-spark-trick-row";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sphere-spark-trick-btn";
        btn.textContent = learned ? "Walk the route" : "Walk it back";
        btn.addEventListener("click", () => performRoute(demo, !learned));
        row.appendChild(btn);
        trickSection.appendChild(row);
      } else {
        const row = document.createElement("div");
        row.className = "sphere-spark-trick-row";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sphere-spark-trick-btn";
        btn.textContent = `Teach ${book.who} a route`;
        btn.addEventListener("click", startTeaching);
        row.appendChild(btn);
        trickSection.appendChild(row);
        const line = document.createElement("p");
        line.className = "sphere-spark-tricks-line";
        line.textContent = `Travel a way across days with ${book.who} following, and the way is remembered.`;
        trickSection.appendChild(line);
      }

      /* The Whole Road (slice 6): at Guardian the book offers
       * the performance itself — the full road and the short
       * road — and while it walks, the book reads it: the beat
       * the Spark stands in is named here, as it is reached.
       * Below Guardian the road stands in the unlearned lines
       * below, with what it asks. */
      if (book.road) {
        const summary = document.createElement("p");
        summary.className = "sphere-spark-tricks-line sphere-spark-road-summary";
        summary.textContent = roadSummaryLine(book);
        trickSection.appendChild(summary);
        const row = document.createElement("div");
        row.className = "sphere-spark-trick-row";
        const walkBtn = document.createElement("button");
        walkBtn.type = "button";
        walkBtn.className = "sphere-spark-trick-btn";
        walkBtn.textContent = "Walk the Whole Road";
        walkBtn.setAttribute("aria-label", `Ask ${book.who} to walk the Whole Road`);
        walkBtn.addEventListener("click", () => startWholeRoad("full"));
        const shortBtn = document.createElement("button");
        shortBtn.type = "button";
        shortBtn.className = "sphere-spark-trick-btn sphere-spark-trick-btn-quiet";
        shortBtn.textContent = "The short road";
        shortBtn.setAttribute("aria-label", `Ask ${book.who} to walk the short road`);
        shortBtn.addEventListener("click", () => startWholeRoad("short"));
        row.append(walkBtn, shortBtn);
        trickSection.appendChild(row);
        const offerLine = document.createElement("p");
        offerLine.className = "sphere-spark-tricks-line";
        offerLine.textContent = `The short road walks the year's turning points only. The road stands offered at the year's reading on the Day Out of Time, and here whenever you ask — it is never walked unasked.`;
        trickSection.appendChild(offerLine);
        roadNowEl = document.createElement("p");
        roadNowEl.className = "sphere-spark-tricks-line sphere-spark-road-now";
        roadNowEl.textContent = roadNowText;
        trickSection.appendChild(roadNowEl);
      } else {
        roadNowEl = null;
      }

      for (const item of book.unlearned) {
        const p = document.createElement("p");
        p.className = "sphere-spark-tricks-line sphere-spark-trick-unlearned";
        p.textContent = `${item.name} — not yet learned. ${item.teachLine}`;
        trickSection.appendChild(p);
      }
    }

    /* The road, in one plain line for the book: what the
     * performance holds, counted from the programme's own
     * beats — the record's numbers, nothing else's. */
    function roadSummaryLine(book) {
      const beats = book.road.beats;
      const hums = beats.filter((b) => b.beat === "hum").length;
      const feats = beats.filter((b) => b.beat === "trick").length;
      const birth = beats.find((b) => b.beat === "birth");
      const parts = [
        birth ? birth.text.toLowerCase() : "born of the seed",
        hums ? `${hums} ${hums === 1 ? "hum" : "hums"} home` : "no hums home yet",
        feats ? `${feats} ${feats === 1 ? "feat" : "feats"} learned` : "no feats learned yet",
        beats.some((b) => b.beat === "closing") ? "the first day closed together" : null,
        "and rest",
      ].filter(Boolean);
      return `The Whole Road — ${book.who}'s keeping, performed on the Sphere: ${parts.join(" · ")}.`;
    }

    function placeTrickPanel() {
      let tries = 0;
      const timer = root.setInterval(() => {
        tries += 1;
        const panel = document.querySelector(".sphere-ambient-panel");
        if (panel) {
          root.clearInterval(timer);
          if (!panel.querySelector(".sphere-spark-tricks")) {
            trickSection = document.createElement("section");
            trickSection.className = "sphere-spark-tricks";
            trickSection.setAttribute("aria-label", "What your Spark can do");
            panel.appendChild(trickSection);
            renderTrickBook();
          }
          return;
        }
        if (tries > 60) root.clearInterval(timer);
      }, 250);
    }


    /* ── Slice 5: the season, on the holder and in the panel ── */
    /* The season is read from the one pipeline — the temporal
     * cursor, else the calendar — and the Moon's character
     * from the calendar's own data. At a day outside the count
     * there is no plate: the Spark keeps the threshold, rests
     * at its post, and no position is pretended for it. */
    function moonCharFor(idx) {
      const moons = root.PatternCalendarData?.moons;
      if (!Array.isArray(moons) || idx == null) return null;
      return moons.find((m) => m && m.idx === idx) || null;
    }

    function currentPosition() {
      const date = new Date();
      let pos = null;
      try { pos = root.SOFTemporalCursor?.resolvePosition ? root.SOFTemporalCursor.resolvePosition(date) : null; } catch { pos = null; }
      if (!pos) {
        try { pos = root.PatternCalendar?.fromCivilDate ? root.PatternCalendar.fromCivilDate({ date }) : null; } catch { pos = null; }
      }
      return pos;
    }

    function refreshSeason() {
      const pos = currentPosition();
      const norm = pos ? {
        patternDay: pos.dayOfPatternYear ?? pos.patternDay ?? null,
        moon: pos.moon ?? null,
        moonDay: pos.moonDay ?? pos.day ?? null,
        moonName: pos.moonName || null,
        patternYear: pos.patternYear ?? null,
        isDayOutOfTime: Boolean(pos.isDayOutOfTime),
        isDeepTimeDay: Boolean(pos.isDeepTimeDay),
      } : null;
      seasonCtx = seasonContextFor(norm, norm ? moonCharFor(norm.moon) : null);
      if (holder && seasonCtx) {
        holder.dataset.inhabitantSeason = seasonCtx.kind;
        if (seasonCtx.moon != null) holder.dataset.inhabitantMoon = String(seasonCtx.moon);
        if ((seasonCtx.kind === "day-out-of-time" || seasonCtx.kind === "deep-time-day") && mode === "posted") {
          setPosture("rest");
        }
      }
      renderSeason();
    }

    function renderSeason() {
      if (!seasonSection) return;
      const record = readRecord();
      const name = sparkName(record);
      const nextChar = seasonCtx && seasonCtx.kind === "moon-turn" && seasonCtx.moon != null
        ? moonCharFor((seasonCtx.moon % 13) + 1) : null;
      const line = seasonCtx ? seasonLineFor(seasonCtx, { name, nextMoonChar: nextChar }) : null;
      /* Slice 6 — on the Day Out of Time, the year's reading
       * stands in this section, and the Whole Road's offer
       * stands in it (Aaron's ruling: offered at the year's
       * reading, entirely optional, and accessible outside it
       * in the book). The offer's state rides the render key
       * so the section re-renders when the record's breadth
       * lands or the note below changes. */
      let roadProgramme = null;
      let roadStage = null;
      if (seasonCtx && seasonCtx.kind === "day-out-of-time" && record) {
        const facts = atlasFacts || lifeFactsFromRecords([], record);
        roadStage = lifeStageFromFacts(facts);
        roadProgramme = wholeRoadProgrammeFrom({
          name, kind: sparkKind(record), record, facts, companion: sparkCompanionOf(record),
        });
      }
      const offerKey = seasonCtx && seasonCtx.kind === "day-out-of-time"
        ? `|road:${roadProgramme ? "stands" : roadStage || "none"}|note:${seasonRoadNote || ""}`
        : "";
      const text = (line || "") + offerKey;
      if (text === seasonText) return;
      seasonText = text;
      seasonSection.replaceChildren();
      const heading = document.createElement("h3");
      heading.className = "sphere-spark-season-title";
      heading.textContent = "The year around the Spark";
      seasonSection.appendChild(heading);
      const p = document.createElement("p");
      p.className = "sphere-spark-season-line";
      p.textContent = line || "The year's turning cannot be read just now — nothing is claimed for it.";
      seasonSection.appendChild(p);
      if (seasonCtx && seasonCtx.kind === "day-out-of-time" && record) {
        const offer = document.createElement("div");
        offer.className = "sphere-spark-season-road";
        const offerLine = document.createElement("p");
        offerLine.className = "sphere-spark-season-line sphere-spark-road-offer-line";
        if (roadProgramme) {
          offerLine.textContent = `The year's reading stands here, on the day outside the count. The Whole Road — ${name}'s keeping, performed on the Sphere itself — stands offered here, at your choice, as it does in the book at any time. It is never walked unasked.`;
          offer.appendChild(offerLine);
          const row = document.createElement("div");
          row.className = "sphere-spark-trick-row";
          const ask = (form, label) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "sphere-spark-trick-btn";
            btn.textContent = label;
            btn.setAttribute("aria-label", `Ask ${name} to walk ${form === "short" ? "the short road" : "the Whole Road"}`);
            btn.addEventListener("click", () => {
              if (startWholeRoad(form)) { seasonRoadNote = null; return; }
              seasonRoadNote = postPd == null
                ? `${name} stands at the threshold today, with no plate underfoot. Step onto any day of the year, and the road can be walked from there.`
                : "The road could not start just now — nothing was walked.";
              seasonText = null;
              renderSeason();
            });
            return btn;
          };
          row.append(ask("full", "Walk the Whole Road"), ask("short", "The short road"));
          offer.appendChild(row);
        } else {
          offerLine.textContent = `The year's reading stands here, on the day outside the count. The Whole Road will stand offered here when a full Pattern year stands kept — ${name} stands ${LIFE_STAGE_NAMES[roadStage] || "Spark"}. The road asks the Guardian stage: every counted day of one Pattern year, kept.`;
          offer.appendChild(offerLine);
        }
        if (seasonRoadNote) {
          const note = document.createElement("p");
          note.className = "sphere-spark-season-line sphere-spark-road-note";
          note.textContent = seasonRoadNote;
          offer.appendChild(note);
        }
        seasonSection.appendChild(offer);
      }
    }

    function placeSeasonPanel() {
      let tries = 0;
      const timer = root.setInterval(() => {
        tries += 1;
        const panel = document.querySelector(".sphere-ambient-panel");
        if (panel) {
          root.clearInterval(timer);
          if (!panel.querySelector(".sphere-spark-season")) {
            seasonSection = document.createElement("section");
            seasonSection.className = "sphere-spark-season";
            seasonSection.setAttribute("aria-label", "The year around the Spark");
            panel.appendChild(seasonSection);
            seasonText = null;
            renderSeason();
          }
          return;
        }
        if (tries > 60) root.clearInterval(timer);
      }, 250);
    }

    /* ── Slice 5: the care panel ───────────────────────────── */
    /* The remaining care kinds, where their honest occasions
     * stand on this face — each a plain act in the Spark's own
     * panel, each writing through the slice-3 writer only,
     * each standing once a day the way close-day stands once
     * a day: the guard is read fresh from the record at the
     * moment of the act, not from a stale render. Carry and
     * its end live in Their Home; here the panel only names a
     * carry that stands open, and the keepsake's light rides
     * the holder (refreshCarriedMark). */
    function wearsForRecord(record) {
      const wears = [
        { id: "kind-glow", label: "its own glow" },
        { id: "hour-halo", label: "the hour's halo" },
      ];
      try {
        if (root.SparkCompanion?.wrapFor && root.SparkCompanion.wrapFor(record) === 1) {
          wears.push({ id: "flame-wrap", label: "the flame wrap's firelight" });
        }
      } catch { /* the wrap is read from the record, never assumed */ }
      return wears;
    }

    function careStateNow() {
      const record = readRecord();
      const stamp = currentStamp();
      return { record, stamp, state: careStateFromLines(lifeLinesOf(record), stamp?.civilDate || null) };
    }

    function careKindle() {
      const { stamp, state } = careStateNow();
      if (state.kindledToday) { careNote = "Kindled together already today — the act stands in the record."; renderCare(); return; }
      const ref = stamp && stamp.patternDay != null ? `pattern-day:${stamp.patternDay}` : "outside-the-count";
      const line = appendLifeLineNow("care-act", { kind: "kindle", ref });
      careNote = line
        ? "Kindled together — one real act, done with the Spark present, stands in the record."
        : "The record would not take the line just now — nothing was written.";
      if (line && holder) {
        holder.classList.add("inhabitant-do-glow");
        root.setTimeout(() => holder && holder.classList.remove("inhabitant-do-glow"), 1300);
      }
      renderCare();
    }

    function careTend(wearId) {
      const { state } = careStateNow();
      if (state.tendRefsToday.includes(`wear:${wearId}`)) {
        careNote = "That dress already stands chosen today — the record holds it.";
        renderCare();
        return;
      }
      const line = appendLifeLineNow("care-act", { kind: "tend", ref: `wear:${wearId}` });
      if (line) {
        if (holder) holder.dataset.inhabitantWear = wearId;
        const wear = wearsForRecord(readRecord()).find((w) => w.id === wearId);
        careNote = `Dressed in ${wear ? wear.label : "the chosen dress"} for the day — the choice stands in the record.`;
      } else {
        careNote = "The record would not take the line just now — nothing was written.";
      }
      renderCare();
    }

    function careRest() {
      const { state } = careStateNow();
      if (state.restedToday) { careNote = "Rest already stands in today's record."; renderCare(); return; }
      const line = appendLifeLineNow("care-act", { kind: "rest" });
      if (line) {
        restUntil = Date.now() + 20000;
        if (mode === "idle" || mode === "travelling-visit") noteAction();
        setPosture("rest");
        careNote = "Sent to rest — the Spark rests at its post a while, and the rest stands in the record.";
      } else {
        careNote = "The record would not take the line just now — nothing was written.";
      }
      renderCare();
    }

    function renderCare() {
      if (!careSection) return;
      const { record, state } = careStateNow();
      const name = sparkName(record);
      careSection.replaceChildren();
      const heading = document.createElement("h3");
      heading.className = "sphere-spark-care-title";
      heading.textContent = `Care for ${name}`;
      careSection.appendChild(heading);
      if (!record) {
        const p = document.createElement("p");
        p.className = "sphere-spark-care-line";
        p.textContent = "No Spark stands here yet.";
        careSection.appendChild(p);
        return;
      }
      const intro = document.createElement("p");
      intro.className = "sphere-spark-care-line";
      intro.textContent = "Care is a record of what was done together — nothing here runs down, and nothing is owed.";
      careSection.appendChild(intro);
      if (careNote) {
        const note = document.createElement("p");
        note.className = "sphere-spark-care-line sphere-spark-care-note";
        note.textContent = careNote;
        careSection.appendChild(note);
      }
      const row = (label, onClick, disabled, aria) => {
        const div = document.createElement("div");
        div.className = "sphere-spark-care-row";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sphere-spark-care-btn";
        btn.textContent = label;
        btn.disabled = Boolean(disabled);
        btn.setAttribute("aria-label", aria || label);
        btn.addEventListener("click", onClick);
        div.appendChild(btn);
        careSection.appendChild(div);
      };
      row(
        state.kindledToday ? `Kindled with ${name} today` : `Kindle with ${name}`,
        careKindle, state.kindledToday,
        `Kindle with ${name} — mark one real act done together today`
      );
      for (const wear of wearsForRecord(record)) {
        const chosen = state.tendRefsToday.includes(`wear:${wear.id}`);
        row(
          chosen ? `Wearing ${wear.label} today` : `Dress ${name} in ${wear.label}`,
          () => careTend(wear.id), chosen,
          `Choose ${wear.label} as ${name}'s dress for the day`
        );
      }
      row(
        state.restedToday ? `${name} has rested today` : `Send ${name} to rest`,
        careRest, state.restedToday,
        `Send ${name} to rest at its post`
      );
      if (state.openCarry) {
        const p = document.createElement("p");
        p.className = "sphere-spark-care-line sphere-spark-care-carrying";
        const title = carryTitles[state.openCarry.ref] || "a keepsake";
        p.textContent = `${name} is carrying ${title} for you today — its light rides with ${name} here too. Take it back in Their Home, and the carrying is complete.`;
        careSection.appendChild(p);
      }
    }

    function placeCarePanel() {
      let tries = 0;
      const timer = root.setInterval(() => {
        tries += 1;
        const panel = document.querySelector(".sphere-ambient-panel");
        if (panel) {
          root.clearInterval(timer);
          if (!panel.querySelector(".sphere-spark-care")) {
            careSection = document.createElement("section");
            careSection.className = "sphere-spark-care";
            careSection.setAttribute("aria-label", "Care for your Spark");
            panel.appendChild(careSection);
            renderCare();
          }
          return;
        }
        if (tries > 60) root.clearInterval(timer);
      }, 250);
    }

    /* The carried keepsake's light, riding the holder wherever
     * the Spark stands on this face — a small steady light at
     * the holder's side while a carry stands open in the
     * record, gone when the carry ends. */
    function refreshCarriedMark() {
      if (!holder) return;
      const record = readRecord();
      const open = record ? openCarryFromLines(lifeLinesOf(record)) : null;
      if (open) {
        holder.dataset.inhabitantCarrying = open.ref || "1";
        if (!holder.querySelector(".inhabitant-carried")) {
          const el = document.createElement("span");
          el.className = "inhabitant-carried";
          el.setAttribute("aria-hidden", "true");
          holder.appendChild(el);
        }
      } else {
        delete holder.dataset.inhabitantCarrying;
        const el = holder.querySelector(".inhabitant-carried");
        if (el) el.remove();
      }
    }

    /* ── Slice 5: Quiet Company, inside an opened day ──────── */
    /* Sat-with, in its true place: the day's own room, beside
     * the closing rite. The keeper asks the Spark to sit with
     * them in this day; the Spark settles at its station,
     * makes no offers, and the sitting itself is the care.
     * The line stands once per day per day sat with; a second
     * sitting the same day is the keeper's again, unwritten. */
    function placeSittingRow() {
      if (mode !== "in-day" || !dayRoom || !holder) return;
      const sheet = dayRoom.querySelector(".day-world-sheet");
      if (!sheet) {
        root.setTimeout(placeSittingRow, 250);
        return;
      }
      if (sittingRow && dayRoom.contains(sittingRow)) { renderSittingRow(); return; }
      sittingRow = document.createElement("div");
      sittingRow.className = "sphere-spark-closing sphere-spark-sitting";
      const questions = sheet.querySelector(".day-world-questions");
      const host = questions ? (questions.closest("section") || questions.parentElement || sheet) : sheet;
      host.appendChild(sittingRow);
      renderSittingRow();
    }

    function renderSittingRow() {
      if (!sittingRow) return;
      const record = readRecord();
      const name = sparkName(record);
      const ref = `pattern-day:${postPd}`;
      const stamp = currentStamp();
      const state = careStateFromLines(lifeLinesOf(record), stamp?.civilDate || null);
      const satAlready = state.satWithRefsToday.includes(ref);
      sittingRow.replaceChildren();
      const line = document.createElement("p");
      line.className = "sphere-spark-closing-line";
      line.textContent = quietSitting
        ? `Quiet Company. ${name} sits with you in this day — no task, no game. The sitting itself is the care.`
        : satAlready
          ? `Quiet Company has been kept in this day already — the sitting stands in the record. You may sit again; it will not be written twice.`
          : `Quiet Company: sit with ${name} in this day a while. No task, no game — the sitting itself is the care.`;
      sittingRow.appendChild(line);
      if (sittingNote) {
        const note = document.createElement("p");
        note.className = "sphere-spark-closing-line sphere-spark-closing-note";
        note.textContent = sittingNote;
        sittingRow.appendChild(note);
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sphere-spark-closing-btn";
      btn.textContent = quietSitting ? "That's enough" : "Sit with me";
      btn.addEventListener("click", quietSitting ? endSitting : beginSitting);
      sittingRow.appendChild(btn);
    }

    function beginSitting() {
      const record = readRecord();
      const name = sparkName(record);
      const ref = `pattern-day:${postPd}`;
      const stamp = currentStamp();
      const state = careStateFromLines(lifeLinesOf(record), stamp?.civilDate || null);
      if (!state.satWithRefsToday.includes(ref)) {
        const line = appendLifeLineNow("care-act", { kind: "sat-with", ref });
        sittingNote = line
          ? `Sat together — the sitting stands in the record.`
          : "The record would not take the line just now — the sitting is yours anyway, unwritten.";
      } else {
        sittingNote = `${name} sits with you again — unwritten, as it should be: the record already holds today's sitting.`;
      }
      quietSitting = true;
      if (holder) holder.dataset.inhabitantQuiet = "1";
      setPosture("rest");
      renderSittingRow();
    }

    function endSitting() {
      quietSitting = false;
      sittingNote = null;
      if (holder) delete holder.dataset.inhabitantQuiet;
      if (mode === "in-day") setPosture("observe");
      renderSittingRow();
    }

    /* ── Slice 3: teaching by demonstration ────────────────── */
    function startTeaching() {
      if (teaching || perf || mode === "in-day" || postPd == null) return;
      teaching = { days: [postPd] };
      bookNote = null;
      renderTrickBook();
    }

    function finishTeaching() {
      if (!teaching) return;
      const days = teaching.days.slice();
      teaching = null;
      const name = sparkName(readRecord());
      const ref = routeRefFor(days);
      const line = ref ? appendLifeLineNow("play-session", { kind: "route-demo", ref }) : null;
      bookNote = line
        ? `The route stands in the record — ${days.length} days, in order. Walk it back with ${name} in another Moon and it becomes ${name}'s own.`
        : "The record would not take the route just now — nothing was written.";
      renderTrickBook();
    }

    function cancelTeaching() {
      teaching = null;
      bookNote = null;
      renderTrickBook();
    }

    /* Walking a route back: a performance like any other —
     * it writes nothing itself. The learning lands only when
     * the walk-back completes in a different Moon from the
     * demonstration's (the design's breadth rule), and then
     * it is the trick-learned line that lands, not the walk. */
    function performRoute(demo, isWalkBack) {
      runPerformance("route", {
        routeDays: demo.days,
        onDone: () => {
          if (!isWalkBack) return;
          const record = readRecord();
          if (!record) return;
          const name = sparkName(record);
          if (routeLearningFor(lifeLinesOf(record), demo)) return;
          const stamp = currentStamp();
          const pair = (y, m) => `${y ?? "?"}:${m ?? "?"}`;
          if (stamp && pair(stamp.patternYear, stamp.moon) !== pair(demo.patternYear, demo.moon)) {
            const line = appendLifeLineNow("trick-learned", { trick: "route", via: demo.id });
            bookNote = line
              ? `Walked back in a new Moon — the route is ${name}'s own now.`
              : "The record would not take the learning just now — nothing was written.";
          } else {
            bookNote = `Walked back. It becomes ${name}'s own when the two of you walk it in another Moon.`;
          }
          renderTrickBook();
        },
      });
    }

    /* ── Slice 3: performances ─────────────────────────────── */
    /* A performance runs its steps on the face: travel legs
     * ride the frame loop's own travel machinery (mode
     * "performing"), in-place acts run against a deadline the
     * frame loop watches. Any keeper action cancels it — the
     * keeper's word always outranks a showing. */
    function performTrick(trickId) {
      runPerformance(trickId, {});
    }

    /* The Spark's voice, sounding a learned hum's own motif —
     * the episode's measured notes, in the house's sound
     * discipline (a sine tone, a soft attack, a falling decay;
     * the keeper's sound setting honoured, read the way the
     * presence reads it). Sound is a grace: any failure is
     * silence, never an error. Notes are bounded — a motif is
     * a handful of tones, never a concert. */
    let humAudioCtx = null;
    function soundMotifHz(motifHz) {
      try {
        if (root.localStorage?.getItem("sof.spark.sound") === "off") return;
        const notes = (Array.isArray(motifHz) ? motifHz : []).filter((hz) => Number.isFinite(hz) && hz > 0).slice(0, 12);
        if (!notes.length) return;
        const AC = root.AudioContext || root.webkitAudioContext;
        if (!AC) return;
        humAudioCtx = humAudioCtx || new AC();
        if (humAudioCtx.state === "suspended") humAudioCtx.resume();
        const ctx = humAudioCtx;
        notes.forEach((hz, i) => {
          const t = ctx.currentTime + 0.03 + i * 0.42;
          const dur = 0.5;
          const osc = ctx.createOscillator();
          osc.type = "sine";
          osc.frequency.value = hz;
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0, t);
          gain.gain.linearRampToValueAtTime(0.12, t + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
          osc.connect(gain); gain.connect(ctx.destination);
          osc.start(t); osc.stop(t + dur + 0.05);
        });
      } catch { /* the voice is a grace, not a gate */ }
    }

    /* A hum from the book: the Spark travels to the day the
     * episode's token came home, when that plate stands on the
     * face, and sounds the motif there — a performance like any
     * other, writing nothing. */
    function performHum(entry) {
      if (!entry) return;
      runPerformance("hum", { hum: entry });
    }

    function runPerformance(trickId, { routeDays = null, onDone = null, hum = null, road = null } = {}) {
      if (perf || !holder || mode === "in-day" || postPd == null) return false;
      let steps = road
        ? wholeRoadSteps(road.beats, { postPd, projected: projectedPds(), bowStands: road.bowStands })
        : performanceSteps(trickId, {
          postPd, projected: projectedPds(), routeDays,
          humPd: hum ? hum.patternDay : null,
          humMs: hum ? hum.motifHz.length * 420 + 500 : null,
        });
      if (!steps.length) return false;
      if (reducedMotion) steps = steps.filter((s) => s.type !== "travel");
      if (!steps.length) return false;
      if (mode === "idle" || mode === "travelling-visit") {
        clearIdleMarks();
        idleReturnPd = null;
        travel = null;
        mode = "posted";
      }
      perf = { trick: trickId, steps, idx: 0, onDone, road: road || null, beatSeen: -1 };
      perfHum = trickId === "hum" ? hum : null;
      holder.dataset.inhabitantTrick = trickId;
      if (perfHum) holder.dataset.inhabitantHum = perfHum.episodeId;
      if (road) holder.dataset.inhabitantRoad = trickId === "whole-road-short" ? "short" : "full";
      mode = "performing";
      setPosture("stand");
      advancePerf();
      return true;
    }

    /* ── Slice 6: the Whole Road, walked ───────────────────── */
    /* The keeper asks — in the book, or at the year's reading
     * on the Day Out of Time — and the Spark performs its
     * keeping on the Sphere itself. The programme is derived
     * fresh at the asking, from the record as it stands; the
     * performance writes nothing, like every performance.
     * Returns false when the road cannot start (no Spark, no
     * Guardian programme, no post to stand on), so the asking
     * surface can say so honestly. */
    function startWholeRoad(form) {
      const record = readRecord();
      if (!record || perf) return false;
      const facts = atlasFacts || lifeFactsFromRecords([], record);
      const kind = sparkKind(record);
      const programme = wholeRoadProgrammeFrom({
        name: sparkName(record), kind, record, facts, companion: sparkCompanionOf(record),
      });
      if (!programme) return false;
      const chosen = form === "short" ? wholeRoadShortFrom(programme, kind) : programme;
      if (!chosen || !chosen.beats.length) return false;
      roadNowText = "";
      const started = runPerformance(form === "short" ? "whole-road-short" : "whole-road", {
        road: chosen,
        onDone: () => {
          roadNowText = "The road stands walked — every station a day the record truly holds.";
          if (roadNowEl) roadNowEl.textContent = roadNowText;
        },
      });
      if (!started) return false;
      return true;
    }

    /* The road's reading: as each beat's first act begins —
     * the Spark standing on the beat's own station — the beat
     * is named in the book and mirrored on the holder. The
     * lantern, where it stands learned, is carried through
     * the road's middle (design §3.5), the way it attends an
     * opened day: lit, and set down again after. */
    function onRoadBeat(idx) {
      if (!perf?.road || !holder) return;
      const beats = perf.road.beats;
      const b = beats[idx] || null;
      roadNowText = b ? b.text : "And at the end, rest.";
      if (roadNowEl) roadNowEl.textContent = roadNowText;
      holder.dataset.inhabitantRoadBeat = String(idx);
      if (b && Number.isInteger(b.pd)) holder.dataset.inhabitantRoadPd = String(b.pd);
      else delete holder.dataset.inhabitantRoadPd;
      const n = beats.length;
      const inMiddle = perf.road.lanternStands && n >= 3 && idx >= Math.floor(n / 3) && idx < n - Math.floor(n / 3);
      if (inMiddle) placeLantern();
      else if (holder.dataset.inhabitantLantern) removeLantern();
    }

    function advancePerf() {
      if (!perf) return;
      clearPerfAct();
      const step = perf.steps[perf.idx];
      perf.idx += 1;
      if (!step) { finishPerf(); return; }
      const now = performance.now();
      if (step.type === "pause") { perfStepEndsAt = now + step.ms; return; }
      if (step.type === "act") {
        /* The Whole Road's reading names a beat as its first
         * act begins — the Spark standing on its station. */
        if (perf.road && step.beat != null && step.beat !== perf.beatSeen) {
          perf.beatSeen = step.beat;
          onRoadBeat(step.beat);
        }
        applyPerfAct(step);
        return;
      }
      /* A travel leg. A plate not projected, or the post
       * itself, reads as a hop in place — never a faked path. */
      const target = labelPoint(step.pd);
      if (!target || !pos || step.pd === postPd) {
        perfAct = "hop";
        perfActMs = 500;
        perfStepEndsAt = now + 500;
        return;
      }
      const dist = Math.hypot(target.x - pos.x, target.y - pos.y);
      const scaleMs = step.style === "drift" ? 1.35 : step.style === "dim" ? 1.15 : 1.1;
      travel = {
        from: { x: pos.x, y: pos.y },
        startedAt: now,
        durationMs: Math.max(500, travelDurationMs(dist) * scaleMs),
        dist,
        targetPd: step.pd,
        lift: step.style === "loop" ? 2.1 : 1,
      };
      perfStepFx = step.fx || null;
      perfTravelFrom = { x: pos.x, y: pos.y };
      postPd = step.pd;
      if (step.style === "dim") holder.style.opacity = "0.22";
      setPosture("stand");
    }

    function applyPerfAct(step) {
      perfAct = step.act;
      perfActMs = step.ms;
      perfStepEndsAt = performance.now() + step.ms;
      if (step.act === "bow" || step.act === "ripple" || step.act === "ground") setPosture("bow");
      if (step.act === "glow" || step.act === "note" || step.act === "hum") holder.classList.add("inhabitant-do-glow");
      if (step.act === "spin") holder.classList.add("inhabitant-do-spin");
      if (step.act === "halo") holder.classList.add("inhabitant-do-halo");
      if (step.act === "note") {
        try { root.SphereSpark?.soundMotif?.(); } catch { /* the voice is a grace, not a gate */ }
      }
      if (step.act === "hum") {
        setPosture("observe");
        /* A road beat carries its own hum; a lone hum
         * performance carries the performance's. */
        const entry = step.hum || perfHum;
        if (entry) {
          soundMotifHz(entry.motifHz);
          holder.dataset.inhabitantHum = entry.episodeId;
        }
      }
      if (step.act === "rest") setPosture("rest");
      if (step.act === "ripple") spawnFxAt("ripple", labelPoint(postPd), null);
      if (step.act === "ground") spawnFxAt("ground", labelPoint(postPd), null);
    }

    function clearPerfAct() {
      perfAct = null;
      perfActMs = 0;
      if (!holder) return;
      holder.classList.remove("inhabitant-do-glow", "inhabitant-do-spin", "inhabitant-do-halo");
      if (posture === "bow") setPosture("stand");
    }

    function finishPerf() {
      const done = perf?.onDone || null;
      const wasRoad = Boolean(perf?.road);
      perf = null;
      perfHum = null;
      perfStepEndsAt = 0;
      perfStepFx = null;
      clearPerfAct();
      clearStarFx();
      if (wasRoad && holder?.dataset.inhabitantLantern) removeLantern();
      if (holder) {
        delete holder.dataset.inhabitantTrick; delete holder.dataset.inhabitantHum;
        delete holder.dataset.inhabitantRoad; delete holder.dataset.inhabitantRoadBeat;
        delete holder.dataset.inhabitantRoadPd;
      }
      mode = "posted";
      setPosture("settle");
      root.setTimeout(() => { if (mode === "posted") setPosture("stand"); }, 900);
      renderTrickBook();
      if (done) done();
    }

    function cancelPerf() {
      if (!perf) return;
      const wasRoad = Boolean(perf.road);
      perf = null;
      perfHum = null;
      perfStepEndsAt = 0;
      perfStepFx = null;
      clearPerfAct();
      clearStarFx();
      if (wasRoad) {
        /* The keeper's word set the road down: the reading
         * says so, and the road stands in the book to be
         * asked again. The lantern is set down with it. */
        roadNowText = "The road was set down — it stands in the book whenever you ask again.";
        if (roadNowEl) roadNowEl.textContent = roadNowText;
        if (holder?.dataset.inhabitantLantern) removeLantern();
      }
      if (holder) {
        delete holder.dataset.inhabitantTrick;
        delete holder.dataset.inhabitantHum;
        delete holder.dataset.inhabitantRoad; delete holder.dataset.inhabitantRoadBeat;
        delete holder.dataset.inhabitantRoadPd;
        holder.style.opacity = "";
      }
      travel = null;
      mode = "posted";
      setPosture("stand");
    }

    /* Small lights laid on the plates themselves — a ripple
     * ring, ember motes along a drift, a ground-glow at a
     * landing, a star that holds while the figure joins.
     * Pure showing: appended to the wrap, animated by the
     * stylesheet, removed when spent. */
    function spawnFxAt(kind, point, fromPoint) {
      if (!point) return;
      const make = (cls, x, y) => {
        const el = document.createElement("div");
        el.className = `inhabitant-fx inhabitant-fx-${cls}`;
        el.style.left = `${Math.round(x)}px`;
        el.style.top = `${Math.round(y)}px`;
        wrap.appendChild(el);
        return el;
      };
      if (kind === "motes") {
        const spots = [];
        if (fromPoint) spots.push({ x: (fromPoint.x + point.x) / 2, y: (fromPoint.y + point.y) / 2 });
        spots.push(point);
        for (const spot of spots) {
          for (let i = 0; i < 3; i += 1) {
            const el = make("mote", spot.x + (i - 1) * 9, spot.y + ((i + 1) % 2) * 7);
            root.setTimeout(() => el.remove(), 1300);
          }
        }
        return;
      }
      if (kind === "stars") {
        perfStars.push(make("star", point.x, point.y));
        return;
      }
      const el = make(kind, point.x, point.y);
      root.setTimeout(() => el.remove(), 1500);
    }

    function clearStarFx() {
      while (perfStars.length) perfStars.pop().remove();
    }

    /* ── Slice 4: Carry the Lantern, at an opened day ──────── */
    /* When the lantern stands learned — witnessed by its
     * trick-learned line, or derivable from the facts already
     * folded — the Spark takes it up at its station in the
     * room: a small lit lamp riding the holder, present while
     * the keeper reads the day. It performs nothing and solves
     * nothing; it attends, lit (design §3.3). */
    function lanternStands() {
      const record = readRecord();
      if (!record) return false;
      if (lifeLinesOf(record).some((l) => l.line === "trick-learned" && l.trick === "carry-the-lantern")) return true;
      if (!atlasFacts) return false;
      const stage = lifeStageFromFacts(atlasFacts);
      return derivedTricks({ kind: sparkKind(record), stage, facts: atlasFacts, lines: lifeLinesOf(record) })
        .some((d) => d.trick === "carry-the-lantern");
    }

    function placeLantern() {
      removeLantern();
      if (!holder || !lanternStands()) return;
      lanternEl = document.createElement("span");
      lanternEl.className = "inhabitant-lantern";
      lanternEl.setAttribute("aria-hidden", "true");
      const frame = document.createElement("span");
      frame.className = "inhabitant-lantern-frame";
      const flame = document.createElement("span");
      flame.className = "inhabitant-lantern-flame";
      frame.appendChild(flame);
      lanternEl.appendChild(frame);
      holder.appendChild(lanternEl);
      holder.dataset.inhabitantLantern = "lit";
    }

    function removeLantern() {
      if (lanternEl) { lanternEl.remove(); lanternEl = null; }
      if (holder) delete holder.dataset.inhabitantLantern;
    }

    /* ── Slice 3: close the day, together ──────────────────── */
    /* The site's one care act in this slice, standing in the
     * day's own leave-taking section: the Spark reads the day
     * from the record's marks, and the keeper closes it with
     * the Spark. The care-act line it writes is the Bow's
     * teacher — the first closing teaches the Bow, witnessed
     * by the learning pass that follows it. */
    function placeClosingRow() {
      if (mode !== "in-day" || !dayRoom || !holder) return;
      const sheet = dayRoom.querySelector(".day-world-sheet");
      if (!sheet) {
        if (closingTries < 24) {
          closingTries += 1;
          root.setTimeout(placeClosingRow, 250);
        }
        return;
      }
      if (closingRow && dayRoom.contains(closingRow)) { renderClosingRow(); return; }
      closingRow = document.createElement("div");
      closingRow.className = "sphere-spark-closing";
      const questions = sheet.querySelector(".day-world-questions");
      const host = questions ? (questions.closest("section") || questions.parentElement || sheet) : sheet;
      host.appendChild(closingRow);
      renderClosingRow();
    }

    function renderClosingRow() {
      if (!closingRow) return;
      const record = readRecord();
      const name = sparkName(record);
      const ref = `pattern-day:${postPd}`;
      const closed = lifeLinesOf(record).some(
        (l) => l.line === "care-act" && l.kind === "close-day" && l.ref === ref
      );
      closingRow.replaceChildren();
      const marks = (breadth?.marks?.[postPd] || []).map((kind) => ({
        genesis: "your birth day",
        token: "a token came home to this day",
        witnessed: "a day you have witnessed",
        practice: "a practice day",
        kept: "a day kept together",
      }[kind] || kind));
      /* Slice 5: a garden day is named in the day's reading
       * too, from the garden's own folded records. */
      if ((atlasFacts?.gardenDays || []).includes(postPd) && !marks.includes("a garden day")) {
        marks.push("a garden day");
      }
      const read = document.createElement("p");
      read.className = "sphere-spark-closing-line";
      read.textContent = (marks.length
        ? `Pattern Day ${postPd} — ${marks.join(" · ")}. ${name} stands in it with you.`
        : `Pattern Day ${postPd} — nothing stands on this day in the record yet. Standing in it together is its first mark.`)
        + (holder?.dataset.inhabitantLantern ? " The lantern is lit beside you." : "");
      closingRow.appendChild(read);
      if (closingNote) {
        const note = document.createElement("p");
        note.className = "sphere-spark-closing-line sphere-spark-closing-note";
        note.textContent = closingNote;
        closingRow.appendChild(note);
      }
      if (closed) {
        const done = document.createElement("p");
        done.className = "sphere-spark-closing-line";
        done.textContent = "This day stands closed together.";
        closingRow.appendChild(done);
        return;
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sphere-spark-closing-btn";
      btn.textContent = "Close the day, together";
      btn.addEventListener("click", closeDayTogether);
      closingRow.appendChild(btn);
    }

    function closeDayTogether() {
      const name = sparkName(readRecord());
      const line = appendLifeLineNow("care-act", { kind: "close-day", ref: `pattern-day:${postPd}` });
      if (!line) {
        closingNote = "The record would not take the line just now — nothing was written.";
        renderClosingRow();
        return;
      }
      const learned = learnNewTricksNow();
      const bowed = learned.some((l) => l.trick === "bow");
      closingNote = bowed
        ? `Closed together — and ${name} has learned to bow.`
        : "Closed together.";
      /* The first showing of the Bow, at the Spark's station
       * in the room: a posture, a showing — it writes nothing. */
      setPosture("bow");
      root.setTimeout(() => { if (mode === "in-day") setPosture("observe"); }, 1700);
      renderClosingRow();
      renderTrickBook();
    }

    /* Every Pattern Day whose plate the instrument is currently
     * projecting — read from the label layer's own semantic
     * labels, the published geometry, at the moment of asking. */
    function projectedPds() {
      const out = [];
      for (const el of document.querySelectorAll('[data-semantic-id^="pattern-day-number-"]')) {
        const m = /^pattern-day-number-(\d{1,3})$/.exec(el.getAttribute("data-semantic-id") || "");
        if (m) {
          const pd = Number(m[1]);
          if (pd >= 1 && pd <= PATTERN_DAYS && !out.includes(pd)) out.push(pd);
        }
      }
      return out;
    }

    function labelFor(pd) {
      if (!pd) return null;
      return document.querySelector(`[data-semantic-id="pattern-day-number-${pd}"]`);
    }

    function labelPoint(pd) {
      const el = labelFor(pd);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      const wr = wrap.getBoundingClientRect();
      return {
        x: r.x - wr.x + r.width / 2,
        y: r.y - wr.y + r.height / 2,
        plate: Math.max(r.width, r.height),
      };
    }

    function writeTransform(x, y, scale) {
      holder.style.transform =
        `translate(${Math.round(x - 34)}px, ${Math.round(y - 34)}px) scale(${scale.toFixed(3)})`;
    }

    function scaleFor(plate) {
      if (!plate) return 0.9;
      return Math.min(1.12, Math.max(0.55, plate / 30));
    }

    function setPosture(next) {
      if (posture === next) return;
      posture = next;
      holder.dataset.inhabitantPosture = next;
    }

    /* The module's state, mirrored onto the holder where the
     * page's other instruments can read it — the same honesty
     * the diagnostics readouts practise. */
    function mirrorState() {
      if (!holder) return;
      if (holder.dataset.inhabitantMode !== mode) holder.dataset.inhabitantMode = mode;
      const post = postPd == null ? "" : String(postPd);
      if (holder.dataset.inhabitantPost !== post) holder.dataset.inhabitantPost = post;
    }

    function setDaypart() {
      const dp = daypartForHour(new Date().getHours());
      if (holder.dataset.inhabitantDaypart !== dp) holder.dataset.inhabitantDaypart = dp;
    }

    /* ── Travel ────────────────────────────────────────────── */
    function travelTo(pd) {
      if (!pd || pd === postPd) return;
      const target = labelPoint(pd);
      postPd = pd;
      if (!pos || !target || reducedMotion) {
        // No honest path to draw (first placement, the plate not
        // projected yet, or the keeper prefers stillness): the
        // Spark simply takes its post; the frame loop settles it.
        travel = null;
        if (mode !== "in-day") mode = "posted";
        return;
      }
      const dist = Math.hypot(target.x - pos.x, target.y - pos.y);
      travel = {
        from: { x: pos.x, y: pos.y },
        startedAt: performance.now(),
        durationMs: travelDurationMs(dist),
        dist,
        targetPd: pd,
      };
      mode = "travelling";
      setPosture("stand");
    }

    /* ── The frame loop ────────────────────────────────────── */
    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (destroyed || !holder || !document.contains(holder)) {
        destroyed = true;
        cancelAnimationFrame(raf);
        return;
      }
      if (document.hidden) return;
      setDaypart();
      mirrorState();

      const frozen = Boolean(root.SphereRebuild?.isFrozen?.());

      if (mode === "in-day") {
        const station = dayStation();
        if (station) {
          pos = pos
            ? { x: pos.x + (station.x - pos.x) * 0.2, y: pos.y + (station.y - pos.y) * 0.2 }
            : station;
          writeTransform(pos.x, pos.y, 0.95);
        }
        return;
      }

      if (frozen) { setPosture("rest"); return; }

      /* Idle entry: the keeper has been still a while, the Spark
       * is posted, and nothing else owns the moment. (Idle timing
       * runs on the wall clock; travel progress below runs on
       * the rAF clock — the two are never mixed.) */
      const wallNow = Date.now();
      /* A keeper-sent rest (slice 5) holds the post: idle life
       * waits until the rest runs out, then the Spark stands
       * again of its own accord. */
      if (restUntil && wallNow > restUntil) {
        restUntil = 0;
        if (mode === "posted") setPosture("stand");
      }
      if (mode === "posted" && !teaching && wallNow - lastActionAt > IDLE_AFTER_MS && wallNow > idleUntil && wallNow > restUntil) {
        beginIdle();
      }

      if (mode === "idle") {
        if (wallNow >= idleUntil) endIdle();
        else if (idleReturnPd != null) {
          // A visit: stand on the visited day and look. If the
          // visited plate rotates out of projection, the visit
          // is over — the Spark comes home rather than hovering
          // where the day used to be.
          const p = labelPoint(postPd);
          if (p) {
            missingSince = null;
            pos = { x: p.x, y: p.y }; writeTransform(p.x, p.y, scaleFor(p.plate));
          } else {
            if (missingSince == null) missingSince = now;
            if (now - missingSince > 1500) { missingSince = null; endIdle(); }
          }
          return;
        } else {
          // A posture behaviour: stay on the post, in posture.
          const p = labelPoint(postPd);
          if (p) { pos = { x: p.x, y: p.y }; writeTransform(p.x, p.y, scaleFor(p.plate)); }
          return;
        }
      }

      if ((mode === "travelling" || mode === "travelling-visit" || mode === "performing") && travel) {
        const target = labelPoint(travel.targetPd);
        if (!target) {
          // The plate has not come around yet: wait at the
          // threshold, low on the face, until it is projected.
          waitAtThreshold();
          return;
        }
        const t = Math.min(1, (now - travel.startedAt) / travel.durationMs);
        const ease = t * (2 - t);
        const x = travel.from.x + (target.x - travel.from.x) * ease;
        const y = travel.from.y + (target.y - travel.from.y) * ease - hopArc(t, travel.dist) * (travel.lift || 1);
        pos = { x, y };
        writeTransform(x, y, scaleFor(target.plate) * (1 + 0.06 * Math.sin(Math.PI * t)));
        if (t >= 1) {
          if (mode === "performing") {
            // A performance leg has landed: lay its light on
            // the plate it arrived on, then take the next step.
            const fx = perfStepFx;
            const fromPoint = perfTravelFrom;
            perfStepFx = null;
            perfTravelFrom = null;
            travel = null;
            holder.style.opacity = "";
            if (fx) spawnFxAt(fx, { x: target.x, y: target.y }, fromPoint);
            advancePerf();
            return;
          }
          const wasVisit = mode === "travelling-visit";
          travel = null;
          if (wasVisit) {
            // Arrived on the visited day: stay a while, in the
            // posture the act chose. An approach or a keepsake
            // rest names its discovery on the holder while it
            // lasts — the mark it travelled to, from the record.
            mode = "idle";
            idleUntil = Date.now() + arrivalStayMs;
            setPosture(arrivalPosture);
            if (pendingDiscovery) {
              holder.dataset.inhabitantDiscovery = `${pendingDiscovery.kind}:${pendingDiscovery.pd}`;
              pendingDiscovery = null;
            }
          } else {
            mode = "posted";
            setPosture("settle");
            window.setTimeout(() => { if (mode === "posted") setPosture("stand"); }, 900);
          }
        }
        return;
      }

      /* A performance's in-place act runs against its deadline
       * here — the frame loop is the only clock a showing has. */
      if (mode === "performing" && !travel && perfStepEndsAt && now >= perfStepEndsAt) {
        perfStepEndsAt = 0;
        advancePerf();
      }

      /* Posted: stand on the post's plate, tracking it as the
       * instrument turns under it. (A performing Spark stands
       * here too, between its steps; a hop or spin act lifts it
       * off the plate on the same arc a travel hop rides.) */
      if (postPd) {
        const p = labelPoint(postPd);
        if (p) {
          missingSince = null;
          pos = { x: p.x, y: p.y };
          let liftY = 0;
          if ((perfAct === "hop" || perfAct === "spin") && perfStepEndsAt) {
            const total = perfActMs || 750;
            const progress = Math.min(1, Math.max(0, 1 - (perfStepEndsAt - now) / total));
            liftY = Math.sin(Math.PI * progress) * (perfAct === "hop" ? 26 : 12);
          }
          writeTransform(p.x, p.y - liftY, scaleFor(p.plate));
          if (mode !== "performing") holder.style.opacity = "";
        } else {
          if (missingSince == null) missingSince = now;
          if (now - missingSince > 2500) waitAtThreshold();
        }
      }
    }

    function waitAtThreshold() {
      const wr = wrap.getBoundingClientRect();
      if (!wr.width || !wr.height) return;
      const x = wr.width / 2, y = wr.height - 30;
      pos = pos
        ? { x: pos.x + (x - pos.x) * 0.08, y: pos.y + (y - pos.y) * 0.08 }
        : { x, y };
      writeTransform(pos.x, pos.y, 0.8);
      holder.style.opacity = "0.85";
    }

    /* While the keeper is inside a day, the Spark's station is
     * the top-right of the day's own sheet, in the room's own
     * coordinate space (the holder is a guest in the room then —
     * see enterDay). The sheet is re-read every frame, so the
     * Spark rides the room's own scroll. */
    function dayStation() {
      if (!dayRoom) return null;
      const rr = dayRoom.getBoundingClientRect();
      const sheet = dayRoom.querySelector(".day-world-sheet");
      if (sheet) {
        const r = sheet.getBoundingClientRect();
        if (r.width) {
          return {
            x: (r.x - rr.x) + dayRoom.scrollLeft + r.width - 48,
            y: (r.y - rr.y) + dayRoom.scrollTop + 38,
          };
        }
      }
      return { x: dayRoom.scrollLeft + Math.max(60, rr.width - 60), y: dayRoom.scrollTop + 48 };
    }

    /* ── Idle life ─────────────────────────────────────────── */
    /* An idle travel: the Spark leaves its post for a day the
     * instrument is showing, stays a while in the act's posture,
     * and the frame loop's visit branch stands it there until
     * the stay runs out. Returns false when the day is not
     * projected from here, so the caller can degrade honestly. */
    function travelIdleTo(dest, { stayMs, posture, discovery } = {}) {
      const target = labelPoint(dest);
      if (!target || !pos) return false;
      idleReturnPd = postPd;
      postPd = dest;
      const dist = Math.hypot(target.x - pos.x, target.y - pos.y);
      travel = { from: { x: pos.x, y: pos.y }, startedAt: performance.now(), durationMs: travelDurationMs(dist), dist, targetPd: dest };
      mode = "travelling-visit";
      idleUntil = Date.now() + 20000; // travel + the stay, bounded by the arrival reset in frame()
      arrivalStayMs = stayMs || 6000;
      arrivalPosture = posture || "observe";
      pendingDiscovery = discovery || null;
      setPosture("observe");
      return true;
    }

    function ringStep(from, step) {
      let dest = from + step;
      if (dest > PATTERN_DAYS) dest -= PATTERN_DAYS;
      if (dest < 1) dest += PATTERN_DAYS;
      return dest;
    }

    function clearIdleMarks() {
      idleAct = null;
      pendingDiscovery = null;
      if (holder) {
        delete holder.dataset.inhabitantAct;
        delete holder.dataset.inhabitantDiscovery;
      }
    }

    function beginIdle() {
      refreshBreadth();
      const pick = pickIdle2(prefs, daypartForHour(new Date().getHours()), Math.random());
      const wallNow = Date.now();
      mode = "idle";
      idleAct = pick;
      if (holder) holder.dataset.inhabitantAct = pick;

      const canTravel = !reducedMotion && postPd && pos;
      /* Slice 5 — the season's first ranging: at a Moon's turn,
       * its opening, or the Year Gate, the first ranging idle
       * of this page visit crosses to the season's own day —
       * the new Moon's first day, the day just closed, or the
       * old year's last day across the Gate — and regards it
       * there. Once per page visit; the ordinary idle life
       * resumes after, and the visit is named on the holder. */
      if (canTravel && !seasonVisitDone && seasonCtx && seasonCtx.seasonDay != null
        && (pick === "visit" || pick === "roam")
        && projectedPds().includes(seasonCtx.seasonDay)
        && travelIdleTo(seasonCtx.seasonDay, { stayMs: 8000, posture: "observe" })) {
        seasonVisitDone = true;
        if (holder) holder.dataset.inhabitantSeasonVisit = String(seasonCtx.seasonDay);
        return;
      }
      if (canTravel && pick === "visit") {
        const step = [1, 2, 3, -1, -2, -3][Math.floor(Math.random() * 6)];
        if (travelIdleTo(ringStep(postPd, step), { stayMs: 6000, posture: "observe" })) return;
      }
      if (canTravel && pick === "roam") {
        // Ranging: a longer walk along the ring, there and back.
        const reach = Math.max(4, prefs?.roamReach || 3);
        const magnitude = 4 + Math.floor(Math.random() * (reach - 3));
        const step = (Math.random() < 0.5 ? -1 : 1) * magnitude;
        if (travelIdleTo(ringStep(postPd, step), { stayMs: 6000, posture: "observe" })) return;
        const near = [1, 2, 3, -1, -2, -3][Math.floor(Math.random() * 6)];
        if (travelIdleTo(ringStep(postPd, near), { stayMs: 6000, posture: "observe" })) return;
      }
      if (canTravel && (pick === "approach" || pick === "keep")) {
        // A discovery: a day the record has marked. A keepsake
        // rest aims at a token's day and rests there; an approach
        // takes the nearest marked days the face is showing.
        let target = null;
        /* Slice 5 — a keepsake rest may rest beside a garden
         * day, where the garden's own records hold one on the
         * face: the garden is a surrounding the Spark answers,
         * and resting beside it is the keep. */
        if (pick === "keep") {
          const gardenOnFace = (atlasFacts?.gardenDays || []).filter((pd) => projectedPds().includes(pd));
          if (gardenOnFace.length) {
            const pd = gardenOnFace[Math.floor(Math.random() * gardenOnFace.length)];
            target = { pd, kind: "garden", posture: "rest", stayMs: 9000 };
          }
        }
        if (!target && pick === "keep" && breadth?.tokenDays?.length) {
          const projected = projectedPds();
          const kept = pickDiscoveryTarget(
            Object.fromEntries(breadth.tokenDays.map((pd) => [pd, ["token"]])),
            projected, postPd, Math.random());
          if (kept) target = { ...kept, posture: "rest", stayMs: 9000 };
        }
        if (!target && breadth?.marks) {
          const found = pickDiscoveryTarget(breadth.marks, projectedPds(), postPd, Math.random());
          if (found) target = { ...found, posture: "observe", stayMs: 7000 };
        }
        if (target && travelIdleTo(target.pd, {
          stayMs: target.stayMs, posture: target.posture,
          discovery: { pd: target.pd, kind: target.kind },
        })) return;
        // No marked day is on the face from here: the act
        // degrades to its posture at the post, and no discovery
        // is claimed — the Spark did not go anywhere.
      }
      idleReturnPd = null;
      idleUntil = wallNow + (pick === "rest" || pick === "keep" ? 11000 : 8000);
      setPosture(pick === "visit" || pick === "roam" || pick === "approach" ? "observe" : pick === "keep" ? "rest" : pick);
    }

    function endIdle() {
      clearIdleMarks();
      if (idleReturnPd != null && postPd !== idleReturnPd) {
        const home = idleReturnPd;
        idleReturnPd = null;
        idleUntil = Date.now() + IDLE_AFTER_MS; // a quiet spell before the next act
        travelTo(home);
        return;
      }
      idleReturnPd = null;
      mode = "posted";
      setPosture("stand");
      idleUntil = Date.now() + IDLE_AFTER_MS;
      lastActionAt = Date.now() - IDLE_AFTER_MS / 2;
    }

    /* A visit travels under its own mode so the keeper's
     * selection arriving mid-visit can still take over. */
    function noteAction() {
      lastActionAt = Date.now();
      if (mode === "performing") cancelPerf();
      if (mode === "idle" || mode === "travelling-visit") {
        clearIdleMarks();
        if (idleReturnPd != null && postPd !== idleReturnPd) {
          const home = idleReturnPd;
          idleReturnPd = null;
          travelTo(home);
        } else {
          idleReturnPd = null;
          mode = "posted";
        }
        setPosture("stand");
      }
    }

    /* ── Selection: the strip is the public readout ────────── */
    function onStrip() {
      const text = (strip.textContent || "").trim().replace(/\s+/g, " ");
      if (text === lastStripText) return;
      lastStripText = text;
      const coord = parseReadout(text);
      if (!coord || !coord.patternDay) return;
      if (text.startsWith("Today")) todayPd = coord.patternDay;
      if (todayPd == null) todayPd = coord.patternDay;
      noteAction();
      refreshBreadth();
      if (mode !== "in-day" && coord.patternDay !== postPd) travelTo(coord.patternDay);
      else if (mode !== "in-day" && postPd == null) { postPd = coord.patternDay; }
      /* Teaching: the keeper's road is the days they open, in
       * order, with the Spark following — the following is the
       * travel above; the route only remembers the days. */
      if (teaching && coord.patternDay
        && teaching.days[teaching.days.length - 1] !== coord.patternDay
        && teaching.days.length < ROUTE_MAX_DAYS) {
        teaching.days.push(coord.patternDay);
        renderTrickBook();
      }
    }

    /* ── Entering the day ──────────────────────────────────── */
    /* The Day World room is a fixed, body-level room of its own
     * (z-index 1200): nothing inside the stage wrap can be seen
     * inside it. So entering is literal — the Spark's holder,
     * which is the companion layer's own element, steps through
     * the door and takes its place in the room, at the day sheet's
     * top-right; when the keeper comes back out, the holder steps
     * back into the wrap and the Spark returns to its plate. The
     * move is a plain reparenting of the layer's own node: every
     * reference the presence keeps (its button, its observers)
     * rides along untouched. */
    let dayRoom = null;

    function enterDay() {
      const room = document.querySelector(".day-world");
      if (room && holder.parentElement !== room) {
        room.appendChild(holder);
        holder.style.position = "absolute";
        holder.style.left = "0px";
        holder.style.top = "0px";
        holder.style.zIndex = "5";
        dayRoom = room;
        pos = null; // room space is not wrap space; take the station fresh
      }
      mode = "in-day";
      travel = null;
      setPosture("observe");
      holder.dataset.inhabitantInDay = "1";
      closingTries = 0;
      closingNote = null;
      sittingNote = null;
      /* Slice 5 — the day's own character answers: the
       * strongest mark the record lays on this day sets the
       * Spark's posture here, and a glow for the birth day.
       * The answer is named on the holder, never invented. */
      const surround = surroundingsForDay({
        patternDay: postPd,
        marks: breadth?.marks || {},
        gardenDays: atlasFacts?.gardenDays || [],
      });
      if (surround.kind) {
        holder.dataset.inhabitantSurround = surround.kind;
        setPosture(surround.posture);
        if (surround.glow) holder.classList.add("inhabitant-do-glow");
      }
      /* The lantern first: the closing row's reading names it,
       * and the row may render on its first placement. */
      placeLantern();
      placeClosingRow();
      placeSittingRow();
    }

    function exitDay() {
      if (dayRoom && holder.parentElement === dayRoom) {
        wrap.appendChild(holder);
        holder.style.position = "";
        holder.style.left = "";
        holder.style.top = "";
        holder.style.zIndex = "12"; // the face standing, restored (see takeOver)
      }
      dayRoom = null;
      delete holder.dataset.inhabitantInDay;
      delete holder.dataset.inhabitantSurround;
      delete holder.dataset.inhabitantQuiet;
      holder.classList.remove("inhabitant-do-glow");
      quietSitting = false;
      removeLantern();
      if (closingRow) { closingRow.remove(); closingRow = null; }
      if (sittingRow) { sittingRow.remove(); sittingRow = null; }
      closingNote = null;
      sittingNote = null;
      pos = null;
      mode = "posted";
      setPosture("stand");
      if (postPd) { const pd = postPd; postPd = null; travelTo(pd); }
    }

    function onDayWorld() {
      const open = document.documentElement.classList.contains("day-world-open");
      if (open && mode !== "in-day") enterDay();
      else if (!open && mode === "in-day") exitDay();
    }

    /* ── Takeover ──────────────────────────────────────────── */
    function takeOver(found) {
      if (holder) return;
      holder = found;
      holder.dataset.inhabitantDriven = "1";
      holder.dataset.inhabitantPosture = "stand";
      /* The Spark stands ON the plates, so it stands above the
       * label layer that projects them (the layer rides at
       * z-index 11 in the wrap): a keeper zoomed close to today
       * sees the Spark on the day's gilded disc, not tucked
       * behind its ring. The page's own cards and doors keep
       * their higher ground. */
      holder.style.zIndex = "12";
      setDaypart();
      wrap.classList.add("sphere-inhabitant-on");
      refreshBreadth();
      refreshTokens();
      placeFavoursPanel();
      placeTrickPanel();
      placeSeasonPanel();
      placeCarePanel();
      refreshSeason();
      refreshCarriedMark();
      root.setInterval(refreshSeason, 60000);
      onStrip();
      if (postPd) {
        const p = labelPoint(postPd);
        if (p) { pos = { x: p.x, y: p.y }; writeTransform(p.x, p.y, scaleFor(p.plate)); }
      }
      new MutationObserver(onStrip).observe(strip, { childList: true, subtree: true, characterData: true });
      new MutationObserver(onDayWorld).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      root.addEventListener("sof:selected-date-change", () => { noteAction(); onStrip(); });
      root.addEventListener("sof:life-atlas-records-changed", () => refreshTokens());
      document.addEventListener("sof:life-atlas-records-changed", () => refreshTokens());
      root.addEventListener("sof:sphere-deferred-tools-ready", () => refreshTokens());
      for (const ev of ["pointerdown", "keydown", "wheel", "touchstart"]) {
        document.addEventListener(ev, noteAction, { passive: true, capture: true });
      }
      onDayWorld();
      raf = requestAnimationFrame(frame);
    }

    const existing = wrap.querySelector(".sphere-spark-presence");
    if (existing) { takeOver(existing); return; }
    const watcher = new MutationObserver(() => {
      const found = wrap.querySelector(".sphere-spark-presence");
      if (found) { watcher.disconnect(); takeOver(found); }
    });
    watcher.observe(wrap, { childList: true });
  }

  return {
    IDLE_AFTER_MS,
    PATTERN_DAYS,
    parseReadout,
    patternDayFor,
    moonDayFor,
    ringDistance,
    hopArc,
    travelDurationMs,
    daypartForHour,
    pickIdle,
    playKindCounts,
    MARK_KINDS,
    markKindFor,
    validPatternDays,
    patternDayForCivil,
    genesisPatternDayFromRaw,
    tokenDaysFromRecords,
    breadthFromSources,
    preferencesFromBreadth,
    favoursLines,
    pickIdle2,
    pickDiscoveryTarget,
    makeLifeLine,
    lineCoordinateFromStamp,
    lifeLinesOf,
    appendLifeLine,
    LIFE_LINE_ALLOWED_KEYS,
    LIFE_LINE_FORBIDDEN_KEYS,
    KEEPING_KINDS_TABLE,
    lifeFactsFromRecords,
    humRepertoireFromFacts,
    lifeStageFromFacts,
    LIFE_STAGE_NAMES,
    pairedActFor,
    SIGNATURE_BY_KIND,
    SECOND_SIGNATURE_BY_KIND,
    TRICK_NAMES,
    BASIC_TRICKS,
    derivedTricks,
    newTrickLines,
    routeRefFor,
    routeDaysFromRef,
    routeDemosFromLines,
    routeLearningFor,
    viaPlainFor,
    trickBookFrom,
    wholeRoadProgrammeFrom,
    wholeRoadShortFrom,
    performanceSteps,
    wholeRoadSteps,
    quarterForPatternDay,
    seasonContextFor,
    seasonLineFor,
    SURROUND_POSTURES,
    surroundingsForDay,
    CARE_KINDS,
    openCarryFromLines,
    careStateFromLines,
    CORE_KIND_TRICK_RULES,
    coreCountsFromRecord,
    legacySignatureStands,
    carriedLineFor,
    carriedLinesOfRecord,
    carriedLineForRecord,
    stampFromRoot,
    appendLifeLineViaRoot,
    mount,
  };
});
