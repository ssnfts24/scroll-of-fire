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
 *  Still named, not faked: the carrying tricks (Fetch the
 *  Token, Carry the Lantern) and the Whole Road performance
 *  derive in the app; on the site their stages are Their Home
 *  and the year's reading, and they stand designed, not built.
 *  The older count-based trick list in the site-wide companion
 *  core is left exactly as it was — the Sphere's book follows
 *  the ruled design; unifying the two is a later slice's work.
 *
 *  The pure half (readout parsing, ring math, the hop arc, the
 *  idle choice, slice 2's breadth, preference, and target
 *  derivations, and slice 3's writer, facts fold, trick
 *  derivation, route logic and performance choreography)
 *  carries no DOM dependency and is unit-tested.
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
          episodes.push({ id: p.episodeId, patternDay: pd });
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
    route: "The Route You Taught",
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
   * each with the act it was learned by — Gate E's derivation.
   * Pure: writes nothing. (The carrying tricks and the Whole
   * Road derive in the app at Gate E; on the site their
   * performances belong to Their Home and the year's reading,
   * and stand designed, not built — see the addendum.) */
  function derivedTricks({ kind, stage, facts, lines } = {}) {
    const out = [];
    const held = Array.isArray(lines) ? lines : [];
    const closeDay = held.find((l) => l.line === "care-act" && l.kind === "close-day");
    if (closeDay) out.push({ trick: "bow", via: closeDay.id || "care:close-day" });
    const paired = pairedActFor(kind, facts);
    if (stage && stage !== "spark" && paired.stands && SIGNATURE_BY_KIND[kind]) {
      out.push({ trick: SIGNATURE_BY_KIND[kind], via: paired.ref });
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
    for (const d of derivedTricks({ kind, stage, facts, lines })) {
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
  function trickBookFrom({ name, kind, record, facts } = {}) {
    const who = typeof name === "string" && name.trim() ? name.trim() : "The Spark";
    const lines = lifeLinesOf(record);
    const stage = lifeStageFromFacts(facts);
    const paired = pairedActFor(kind, facts);
    const learnedLines = lines.filter((l) => l.line === "trick-learned" && l.trick !== "route");
    const learnedIds = new Set(learnedLines.map((l) => l.trick));
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
    if (signature && !learnedIds.has(signature)) {
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

    return {
      stage,
      stageName: LIFE_STAGE_NAMES[stage] || "Spark",
      kindsPresent: (facts?.kinds || []).filter((k) => k.present).map((k) => k.label),
      basics: BASIC_TRICKS.map((trick) => ({ trick, name: TRICK_NAMES[trick] })),
      learned: learnedLines.map((l) => ({
        trick: l.trick,
        name: TRICK_NAMES[l.trick] || l.trick,
        viaPlain: viaPlainFor(l.via, lines),
        patternDay: l.patternDay ?? null,
      })),
      unlearned,
      route: demo ? { demo, learned: Boolean(routeLearned), learnedLine: routeLearned } : null,
      who,
    };
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
        refreshBreadth();
        learnNewTricksNow();
        renderTrickBook();
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
      try {
        const s = root.SphereSpark?.stamp?.();
        if (s?.civilDate) return s;
      } catch { /* fall through to the pipeline itself */ }
      const date = new Date();
      let pos = null;
      try { pos = root.SOFTemporalCursor?.resolvePosition ? root.SOFTemporalCursor.resolvePosition(date) : null; } catch { pos = null; }
      if (!pos) {
        try { pos = root.PatternCalendar?.fromCivilDate ? root.PatternCalendar.fromCivilDate({ date }) : null; } catch { pos = null; }
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

    function sparkKind(record) {
      try { return root.SparkCompanion?.generate?.(record?.seed)?.kind || null; } catch { return null; }
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
     * saying what would teach them. */
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
      const book = trickBookFrom({ name: sparkName(record), kind: sparkKind(record), record, facts });
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
        performRow(item, `learned by ${item.viaPlain}${item.patternDay ? ` · Pattern Day ${item.patternDay}` : ""}`);
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

      for (const item of book.unlearned) {
        const p = document.createElement("p");
        p.className = "sphere-spark-tricks-line sphere-spark-trick-unlearned";
        p.textContent = `${item.name} — not yet learned. ${item.teachLine}`;
        trickSection.appendChild(p);
      }
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

    function runPerformance(trickId, { routeDays = null, onDone = null } = {}) {
      if (perf || !holder || mode === "in-day" || postPd == null) return false;
      let steps = performanceSteps(trickId, { postPd, projected: projectedPds(), routeDays });
      if (!steps.length) return false;
      if (reducedMotion) steps = steps.filter((s) => s.type !== "travel");
      if (!steps.length) return false;
      if (mode === "idle" || mode === "travelling-visit") {
        clearIdleMarks();
        idleReturnPd = null;
        travel = null;
        mode = "posted";
      }
      perf = { trick: trickId, steps, idx: 0, onDone };
      holder.dataset.inhabitantTrick = trickId;
      mode = "performing";
      setPosture("stand");
      advancePerf();
      return true;
    }

    function advancePerf() {
      if (!perf) return;
      clearPerfAct();
      const step = perf.steps[perf.idx];
      perf.idx += 1;
      if (!step) { finishPerf(); return; }
      const now = performance.now();
      if (step.type === "pause") { perfStepEndsAt = now + step.ms; return; }
      if (step.type === "act") { applyPerfAct(step); return; }
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
      if (step.act === "glow" || step.act === "note") holder.classList.add("inhabitant-do-glow");
      if (step.act === "spin") holder.classList.add("inhabitant-do-spin");
      if (step.act === "halo") holder.classList.add("inhabitant-do-halo");
      if (step.act === "note") {
        try { root.SphereSpark?.soundMotif?.(); } catch { /* the voice is a grace, not a gate */ }
      }
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
      perf = null;
      perfStepEndsAt = 0;
      perfStepFx = null;
      clearPerfAct();
      clearStarFx();
      if (holder) delete holder.dataset.inhabitantTrick;
      mode = "posted";
      setPosture("settle");
      root.setTimeout(() => { if (mode === "posted") setPosture("stand"); }, 900);
      renderTrickBook();
      if (done) done();
    }

    function cancelPerf() {
      if (!perf) return;
      perf = null;
      perfStepEndsAt = 0;
      perfStepFx = null;
      clearPerfAct();
      clearStarFx();
      if (holder) {
        delete holder.dataset.inhabitantTrick;
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
      const read = document.createElement("p");
      read.className = "sphere-spark-closing-line";
      read.textContent = marks.length
        ? `Pattern Day ${postPd} — ${marks.join(" · ")}. ${name} stands in it with you.`
        : `Pattern Day ${postPd} — nothing stands on this day in the record yet. Standing in it together is its first mark.`;
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
      if (mode === "posted" && !teaching && wallNow - lastActionAt > IDLE_AFTER_MS && wallNow > idleUntil) {
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
        if (pick === "keep" && breadth?.tokenDays?.length) {
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
      placeClosingRow();
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
      if (closingRow) { closingRow.remove(); closingRow = null; }
      closingNote = null;
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
    performanceSteps,
    mount,
  };
});
