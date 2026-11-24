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
 *  play-session writer stands on the site yet, and a reading
 *  writes nothing — the design's own rule for readings.
 *
 *  The pure half (readout parsing, ring math, the hop arc, the
 *  idle choice, and slice 2's breadth, preference, and target
 *  derivations) carries no DOM dependency and is unit-tested.
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
        refreshBreadth();
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
      if (mode === "posted" && wallNow - lastActionAt > IDLE_AFTER_MS && wallNow > idleUntil) {
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

      if ((mode === "travelling" || mode === "travelling-visit") && travel) {
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
        const y = travel.from.y + (target.y - travel.from.y) * ease - hopArc(t, travel.dist);
        pos = { x, y };
        writeTransform(x, y, scaleFor(target.plate) * (1 + 0.06 * Math.sin(Math.PI * t)));
        if (t >= 1) {
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

      /* Posted: stand on the post's plate, tracking it as the
       * instrument turns under it. */
      if (postPd) {
        const p = labelPoint(postPd);
        if (p) {
          missingSince = null;
          pos = { x: p.x, y: p.y };
          writeTransform(p.x, p.y, scaleFor(p.plate));
          holder.style.opacity = "";
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
    mount,
  };
});
