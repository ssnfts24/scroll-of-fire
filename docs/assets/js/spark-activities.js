/**
 * Spark Activities — Slice 1: Watching (Aaron's approval of the
 * activities design whole, Nov 23, 2026 — "Everything else that
 * you discussed we discussed previously today go ahead and
 * approve it all." The design governs:
 * your_files/spark-activities-design-2026-11-23.md §§1, 4, 5.)
 *
 * What this module does, and only this:
 *
 *   1. WATCHING. On a page carrying a fitted Series One episode
 *      (the story layer's <figure class="story-episode">), it
 *      keeps an honest account of the playing: the union of the
 *      ranges actually played, at a human pace, with the page
 *      present. When that union covers at least 90% of the
 *      episode and the player's own `ended` event has fired, the
 *      watch is real, and three things are written to the
 *      keeper's ONE Life Atlas record — the same repository the
 *      Pattern Garden and every other door write to, resolved
 *      the same way (CodexRecordHelpers.createRepositoryResolver):
 *
 *        - the episode's TOKEN, as an "episode-watched" record
 *          in the Story lane, keyed by the episode's distinguisher
 *          (name + land + Set A Moon name + token — story bible
 *          §12). Their Home's story corner and the Atlas read the
 *          token off this record; neither is stored separately.
 *        - the episode's HUM, carried in the same record: the
 *          measured root motif from the Series One production
 *          ledger, which the Spark's repertoire derives from.
 *        - the episode's Waymaker skill marked "met" (bible
 *          §11) — met, not earned: the paired practices that fill
 *          a mark to "earned" are later slices and are NOT built
 *          here.
 *
 *      Once per episode per year. A rewatch in the episode's own
 *      Moon in a later year writes one further record only: a
 *      "met again" line beside the first.
 *
 *   2. THE STAGE PORTRAIT, first step. A pure fold over the
 *      keeper's records: the breadth of kinds of keeping that
 *      stand in the record (a day witnessed, a bed planted, an
 *      episode watched, a quest answered, a word kept). Three
 *      kinds at least once paints the portrait's second stage,
 *      Kindled; fewer paints Spark. Slice 1 spans Spark →
 *      Kindled only. A portrait is not a rank: it never goes
 *      down, unlocks nothing, and the Spark's seed-born core is
 *      never touched by it (the character persistence rule).
 *
 * THE FENCES (design §4, pinned by tests/spark-activities.test.js):
 * keepsakes only — this module writes no tally of any kind,
 * nothing here can be lost, traded, or shown to anyone else;
 * the record is private and shareAllowed is false; the earning
 * path makes no network calls of its own (no fetch, no XHR, no
 * beacon — the Atlas stack it writes through is the site's own
 * same-origin modules, lazy-loaded the way Their Home loads the
 * garden stack); the Spark is never gendered in any line this
 * module writes; children earn by watching on the same terms as
 * every other keeper — no account, nothing leaves the device.
 *
 * The pure half (the episode table, the coverage tracker, the
 * record builders, the watch plan, the folds, the portrait)
 * carries no DOM or storage dependency and is unit-tested. The
 * browser half only observes the story layer's rendered player,
 * resolves the repository when a watch completes or a token is
 * read back, and writes through it. The story layer lazy-loads
 * this module the first time an episode renders on a page — no
 * page's markup carries it, and no protected page is touched.
 */
(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SparkActivities = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "spark-activities/1.0.0";

  const WATCH_SUBTYPE = "episode-watched";
  const RECORD_TAG = "spark-activities";

  /* The thirteen Moons by their settled names (Set A —
   * PatternCalendarData governs; story bible §9 Q3, settled
   * Nov 23, 2026). Index 0 is Moon 1. */
  const MOON_NAMES_SET_A = Object.freeze([
    "Seed Flame",
    "Root Waters",
    "Breath Gate",
    "Stone Witness",
    "Living Word",
    "Fire Trial",
    "Crown Balance",
    "Deep Mirror",
    "Return Path",
    "Builder's Hand",
    "Star Remembrance",
    "River of Signs",
    "Completion Seal"
  ]);

  /* ------------------------- the episodes ------------------------- */

  /*
   * The fitted Series One episodes, by their marks (story bible
   * §5, re-issued under §12): name + land + Moon (Set A) + token.
   * The hum is the episode's measured root motif from the Series
   * One production ledger — root and scale from the record's own
   * per-page tone assignment, motif notes as measured in the
   * finished films. The skill is the Waymaker skill the episode
   * teaches (bible §11), with its kit mark; episodes the
   * curriculum does not name carry no skill, and their watch
   * marks none.
   */
  const EPISODES = Object.freeze([
    {
      chapterId: "the-gate-at-first-light", n: 1,
      title: "The Gate at First Light", land: "the World Gate",
      moonName: "Seed Flame", token: "the lantern's spark",
      skill: null,
      hum: { rootHz: 174, scale: "Freygish", motifHz: [1174.7, 1568.0, 1318.5, 1174.7], note: "the Whistle — the road's constant, sounded over the home root" }
    },
    {
      chapterId: "a-friend-for-the-road", n: 2,
      title: "A Friend for the Road", land: "the Clearing",
      moonName: "Root Waters", token: "the open hand",
      skill: null,
      hum: { rootHz: 174, scale: "Freygish", motifHz: [696, 870, 1044, 870, 696], note: "" }
    },
    {
      chapterId: "the-road-of-thirteen-moons", n: 3,
      title: "The Road of Thirteen Moons", land: "the Wheel",
      moonName: "Seed Flame", token: "the notebook opened",
      skill: { n: 2, name: "Keep the record", kitMark: "the notebook" },
      hum: { rootHz: 222, scale: "Hijaz", motifHz: [444, 499.5, 555, 666], note: "" }
    },
    {
      chapterId: "through-the-day-door", n: 4,
      title: "Through the Day Door", land: "the Observatory",
      moonName: "Breath Gate", token: "the Day Door",
      skill: { n: 1, name: "Read the day", kitMark: "the lantern, opened" },
      hum: { rootHz: 174, scale: "Freygish", motifHz: [261, 348, 522], note: "" }
    },
    {
      chapterId: "the-garden-of-thirteen-beds", n: 5,
      title: "The Garden of Thirteen Beds", land: "the Garden",
      moonName: "Stone Witness", token: "the leaf-wrapped seed",
      skill: { n: 3, name: "Wait for the right Moon", kitMark: "the leaf-wrapped seed (carried, never used)" },
      hum: { rootHz: 174, scale: "Freygish", motifHz: [174, 261, 348, 435, 522], note: "" }
    },
    {
      chapterId: "packing-for-the-way", n: 6,
      title: "Packing for the Way", land: "the Registry & Storehouse",
      moonName: "Root Waters", token: "the pack packed light",
      skill: { n: 4, name: "Choose for the road ahead", kitMark: "the pack, packed light" },
      hum: { rootHz: 174, scale: "Freygish", motifHz: [174, 261, 348, 261], note: "" }
    },
    {
      chapterId: "the-desk-at-the-crossroads", n: 7,
      title: "The Desk at the Crossroads", land: "the Desk",
      moonName: "Crown Balance", token: "the tale read back",
      skill: { n: 5, name: "Be checked", kitMark: "the fair copy, corrected beneath" },
      hum: { rootHz: 174, scale: "Freygish", motifHz: [348, 174], note: "" }
    },
    {
      chapterId: "the-signpost-meadow", n: 8,
      title: "The Signpost Meadow", land: "the World Gate",
      moonName: "Crown Balance", token: "the turned signpost",
      skill: null,
      hum: { rootHz: 174, scale: "Freygish", motifHz: [348, 435, 522, 348, 261, 174], note: "" }
    },
    {
      chapterId: "the-roundhouse-of-engines", n: 9,
      title: "The Roundhouse of Engines", land: "the Roundhouse",
      moonName: "Living Word", token: "the engines' names written down",
      skill: null,
      hum: { rootHz: 174, scale: "Freygish", motifHz: [174, 219.5, 261, 174], note: "" }
    },
    {
      chapterId: "the-remnant-lab", n: 10,
      title: "The Workshop That Tests", land: "the Roundhouse",
      moonName: "Living Word", token: "the tested tool, mended",
      skill: { n: 6, name: "Test a claim", kitMark: "the tested tool, mended" },
      hum: { rootHz: 174, scale: "Freygish", motifHz: [348, 261], note: "" }
    },
    {
      chapterId: "the-practice-yard", n: 11,
      title: "The Practice Yard", land: "the Practice Yard",
      moonName: "Fire Trial", token: "the cup",
      skill: { n: 7, name: "A little, every day", kitMark: "the cup" },
      hum: { rootHz: 174, scale: "Freygish", motifHz: [174, 232.7, 261, 232.7], note: "" }
    },
    {
      chapterId: "the-picture-lesson", n: 12,
      title: "The Picture Lesson", land: "the Practice Yard",
      moonName: "Fire Trial", token: "the whole seen before its parts",
      skill: { n: 8, name: "See whole before naming", kitMark: "the unlabelled drawer, left open by choice" },
      hum: { rootHz: 210, scale: "minor pentatonic", motifHz: [420, 314.6, 280.3, 249.7], note: "" }
    },
    {
      chapterId: "the-second-book", n: 13,
      title: "The Second Book", land: "the Desk",
      moonName: "Crown Balance", token: "the fair copy, corrected beneath",
      skill: { n: 5, name: "Be checked", kitMark: "the fair copy, corrected beneath" },
      hum: { rootHz: 174, scale: "Freygish", motifHz: [261, 232.7, 261, 232.7], note: "" }
    },
    {
      chapterId: "the-word-hoard", n: 14,
      title: "The Word-Hoard", land: "the Word-Hoard",
      moonName: "Return Path", token: "the unlabelled drawer",
      skill: { n: 8, name: "See whole before naming", kitMark: "the unlabelled drawer, left open by choice" },
      hum: { rootHz: 174, scale: "Freygish", motifHz: [174, 219.5, 261], note: "the figure's fourth step (329.4 Hz) is withheld, by design" }
    },
    {
      chapterId: "the-high-library", n: 15,
      title: "The High Library", land: "the High Library",
      moonName: "Builder's Hand", token: "the ribbon in the book",
      skill: { n: 9, name: "Leave depth open", kitMark: "the ribbon in the book" },
      hum: { rootHz: 196, scale: "Dorian", motifHz: [196, 261.6, 293.7, 392], note: "" }
    },
    {
      chapterId: "the-registry-stall", n: 16,
      title: "The Registry Stall", land: "the Registry & Storehouse",
      moonName: "Star Remembrance", token: "the entry in the book",
      skill: { n: 10, name: "Make and enter", kitMark: "the registry entry" },
      hum: { rootHz: 174, scale: "Freygish", motifHz: [174, 219.5, 261, 348], note: "" }
    },
    {
      chapterId: "the-atlas-room", n: 17,
      title: "The Atlas Room", land: "the World Gate",
      moonName: "River of Signs", token: "the map rolled tight",
      skill: { n: 11, name: "Hold both views", kitMark: "the map, rolled tight" },
      hum: { rootHz: 205, scale: "Freygish", motifHz: [205, 307.2, 410, 307.2, 205], note: "" }
    }
  ]);

  function episodeByChapterId(chapterId) {
    return EPISODES.find(e => e.chapterId === chapterId) || null;
  }

  /* The spoken form of the distinguisher (bible §12):
   * "The Second Book — of the Desk, under Crown Balance, the
   * fair copy, corrected beneath." */
  function distinguisherLine(episode) {
    if (!episode) return "";
    return `${episode.title} — of ${episode.land}, under ${episode.moonName}, ${episode.token}`;
  }

  /* --------------------------- text --------------------------- */

  function cleanText(value, max = 4000) {
    if (value === null || value === undefined) return "";
    return String(value).trim().slice(0, max);
  }

  /* --------------------- the coverage tracker --------------------- */

  /*
   * The honest signal (design §1.2). The browser half samples the
   * player while it plays and calls tick() with the media time at
   * each sample. A stretch of media time counts only when it was
   * played continuously (a seek makes the sample jump, and the
   * jump is not counted), at a human pace (playbackRate at or
   * below MAX_RATE), with the page present (visible). Ranges from
   * separate sittings in the same visit add up — the union is
   * kept, because a keeper interrupted mid-episode is not a
   * cheat. The watch attests when the union covers at least
   * COVERAGE_REQUIRED of the episode's duration AND the player's
   * `ended` event has fired (markEnded).
   */
  const MAX_RATE = 2;
  const COVERAGE_REQUIRED = 0.9;
  /* A sample-to-sample media-time step larger than this is a
   * seek, not playing: at the fastest honest rate (2x) a 250 ms
   * sampler steps 0.5 s; 1.5 s leaves generous room for slow
   * timers without ever crediting a jump. */
  const MAX_STEP_SECONDS = 1.5;

  function createWatchTracker(durationSeconds) {
    const duration = Number(durationSeconds);
    let ranges = [];
    let lastTime = null;
    let ended = false;

    function addRange(start, end) {
      if (!(end > start)) return;
      ranges.push([start, end]);
      ranges.sort((a, b) => a[0] - b[0]);
      const merged = [];
      for (const [s, e] of ranges) {
        const prev = merged[merged.length - 1];
        if (prev && s <= prev[1]) {
          if (e > prev[1]) prev[1] = e;
        } else {
          merged.push([s, e]);
        }
      }
      ranges = merged;
    }

    return {
      /* One sample of the player. Counts the stretch since the
       * previous sample only under the honest conditions. */
      tick(mediaTime, { playing = false, rate = 1, visible = true } = {}) {
        const t = Number(mediaTime);
        if (!Number.isFinite(t)) { lastTime = null; return; }
        if (playing && visible && Number(rate) <= MAX_RATE && lastTime !== null) {
          const step = t - lastTime;
          if (step > 0 && step <= MAX_STEP_SECONDS) addRange(lastTime, t);
        }
        lastTime = t;
      },
      /* Playback paused or the page hid: the next sample starts
       * a fresh stretch, so a resume elsewhere is never bridged. */
      breakStretch() { lastTime = null; },
      markEnded() { ended = true; },
      playedSeconds() {
        return ranges.reduce((sum, [s, e]) => sum + (e - s), 0);
      },
      coverage() {
        if (!Number.isFinite(duration) || duration <= 0) return 0;
        return Math.min(1, this.playedSeconds() / duration);
      },
      hasEnded() { return ended; },
      attested() {
        return ended && this.coverage() >= COVERAGE_REQUIRED;
      }
    };
  }

  /* ------------------------- the temporal ------------------------- */

  /* The garden's own idiom (pattern-garden.js coordinateForInstant):
   * every coordinate from PatternCalendar, never hand-computed. */
  function coordinateForInstant(instant = new Date(), options = {}, patternCalendar = null) {
    const calendar =
      patternCalendar ||
      (typeof globalThis !== "undefined" ? globalThis.PatternCalendar : null);
    if (!calendar?.fromCivilDate) return null;
    const timeZone =
      options.timeZone ||
      (() => {
        try {
          return Intl.DateTimeFormat().resolvedOptions().timeZone;
        } catch {
          return "UTC";
        }
      })();
    try {
      const conversion = calendar.fromCivilDate({
        date: instant instanceof Date ? instant : new Date(instant),
        timeZone,
        boundaryMode: options.boundaryMode || "midnight",
        sunsetTime: options.sunsetTime || "18:00"
      });
      const helpers =
        typeof globalThis !== "undefined" ? globalThis.CodexRecordHelpers : null;
      if (helpers?.temporalFromConversion) {
        return helpers.temporalFromConversion(conversion, instant);
      }
      return null;
    } catch {
      return null;
    }
  }

  function moonNameForTemporal(temporal) {
    if (!temporal || temporal.outsideDay || temporal.moon == null) return null;
    return MOON_NAMES_SET_A[temporal.moon - 1] || null;
  }

  function watchedOnLine(temporal) {
    if (!temporal) return "a day in Living Time";
    if (temporal.outsideDay || temporal.patternDay == null) {
      return temporal.civilDate ? `the Day Out of Time (${temporal.civilDate})` : "the Day Out of Time";
    }
    const moon = temporal.moon != null ? `Moon ${temporal.moon}` : "Moon —";
    const day = temporal.moonDay != null ? `Day ${temporal.moonDay}` : "Day —";
    return `${moon} · ${day} · Pattern Day ${temporal.patternDay}`;
  }

  /* ------------------------- record shapes ------------------------- */

  function isWatchRecord(record) {
    return Boolean(
      record &&
      record.type === "event" &&
      record.subtype === WATCH_SUBTYPE &&
      record.payload &&
      record.payload.sparkActivities
    );
  }

  function watchPayload(record) {
    return (record && record.payload && record.payload.sparkActivities) || null;
  }

  function baseRecord({ title, summary, temporal, payload }) {
    return {
      type: "event",
      subtype: WATCH_SUBTYPE,
      title,
      summary: summary || "",
      temporal: temporal || {},
      tags: [RECORD_TAG, "episode-watched", "story"],
      provenance: {
        sourceType: "spark-activities",
        sourceId: "episode-watch",
        calculationAuthority: "PatternCalendar"
      },
      privacy: {
        visibility: "private",
        containsPersonalData: true,
        shareAllowed: false
      },
      payload: {
        sparkActivities: payload
      }
    };
  }

  function buildWatchRecord(episode, temporal = null) {
    const line = distinguisherLine(episode);
    return baseRecord({
      title: `Watched ${line}`,
      summary:
        `An episode watched through to its end on its own page. Its token — ${episode.token} — ` +
        `stands in Their Home's story corner, the Spark has learned its hum, and ` +
        (episode.skill
          ? `the Waymaker skill it teaches, ${episode.skill.name}, is marked met.`
          : `this episode teaches by its walking, and carries no single skill mark.`),
      temporal,
      payload: {
        version: 1,
        action: "watch",
        episodeId: episode.chapterId,
        chapterN: episode.n,
        distinguisher: {
          name: episode.title,
          land: episode.land,
          moonName: episode.moonName,
          token: episode.token,
          line
        },
        hum: {
          rootHz: episode.hum.rootHz,
          scale: episode.hum.scale,
          motifHz: [...episode.hum.motifHz],
          note: episode.hum.note || ""
        },
        skill: episode.skill
          ? { n: episode.skill.n, name: episode.skill.name, kitMark: episode.skill.kitMark, state: "met" }
          : null,
        coverageAttested: true
      }
    });
  }

  function buildMetAgainRecord(episode, temporal = null) {
    const line = distinguisherLine(episode);
    return baseRecord({
      title: `Met again — ${line}`,
      summary:
        `The keeper met this episode again in its own Moon, in a later year, and watched it through. ` +
        `The line is written beside the first watch; the token was already home and is not written twice.`,
      temporal,
      payload: {
        version: 1,
        action: "met-again",
        episodeId: episode.chapterId,
        chapterN: episode.n,
        distinguisher: {
          name: episode.title,
          land: episode.land,
          moonName: episode.moonName,
          token: episode.token,
          line
        },
        coverageAttested: true
      }
    });
  }

  /* --------------------------- the plan --------------------------- */

  /*
   * What a completed watch should write, decided against the
   * record before anything is written (the catalogue's standing
   * rule: the Atlas is read first, everywhere):
   *   - no watch record for the episode yet → "watch"
   *   - a watch stands, and today is in the episode's own Moon
   *     in a LATER pattern year, with no met-again line yet in
   *     this pattern year → "met-again"
   *   - anything else → "none"
   */
  function planWatch(records, episode, temporal) {
    if (!episode) return { action: "none", reason: "no-episode" };
    const mine = (Array.isArray(records) ? records : []).filter(
      r => isWatchRecord(r) && watchPayload(r).episodeId === episode.chapterId
    );
    const watch = mine.find(r => watchPayload(r).action === "watch");
    if (!watch) return { action: "watch", reason: "first-watch" };

    const watchYear = watch.temporal ? Number(watch.temporal.patternYear) : NaN;
    const thisYear = temporal ? Number(temporal.patternYear) : NaN;
    if (!Number.isFinite(thisYear) || !Number.isFinite(watchYear) || thisYear <= watchYear) {
      return { action: "none", reason: "same-year" };
    }
    if (moonNameForTemporal(temporal) !== episode.moonName) {
      return { action: "none", reason: "not-its-moon" };
    }
    const alreadyThisYear = mine.some(
      r =>
        watchPayload(r).action === "met-again" &&
        r.temporal &&
        Number(r.temporal.patternYear) === thisYear
    );
    if (alreadyThisYear) return { action: "none", reason: "met-again-already" };
    return { action: "met-again", reason: "later-year-own-moon" };
  }

  /* ----------------------------- folds ----------------------------- */

  /* The story corner, read off the watch records: one token per
   * watched episode, its met-again years standing beside it. The
   * token, the hum, and the skill mark all derive from the watch
   * record — none is stored anywhere else. */
  function foldWatches(records) {
    const tokens = [];
    const byEpisode = new Map();
    for (const record of Array.isArray(records) ? records : []) {
      if (!isWatchRecord(record)) continue;
      const p = watchPayload(record);
      if (p.action === "watch") {
        const token = {
          episodeId: p.episodeId,
          chapterN: p.chapterN != null ? p.chapterN : null,
          line: (p.distinguisher && p.distinguisher.line) || record.title || "",
          token: (p.distinguisher && p.distinguisher.token) || "",
          moonName: (p.distinguisher && p.distinguisher.moonName) || "",
          hum: p.hum || null,
          skill: p.skill || null,
          watchedOn: watchedOnLine(record.temporal),
          watchedYear: record.temporal ? Number(record.temporal.patternYear) || null : null,
          metAgainYears: []
        };
        tokens.push(token);
        byEpisode.set(p.episodeId, token);
      }
    }
    for (const record of Array.isArray(records) ? records : []) {
      if (!isWatchRecord(record)) continue;
      const p = watchPayload(record);
      if (p.action !== "met-again") continue;
      const token = byEpisode.get(p.episodeId);
      const year = record.temporal ? Number(record.temporal.patternYear) : NaN;
      if (token && Number.isFinite(year) && !token.metAgainYears.includes(year)) {
        token.metAgainYears.push(year);
      }
    }
    for (const token of tokens) token.metAgainYears.sort((a, b) => a - b);
    return { tokens, tokenCount: tokens.length };
  }

  /* The Spark's learned hums, derived from the same records: one
   * repertoire entry per watched episode. */
  function humRepertoire(records) {
    return foldWatches(records).tokens
      .filter(t => t.hum)
      .map(t => ({
        episodeId: t.episodeId,
        line: t.line,
        rootHz: t.hum.rootHz,
        scale: t.hum.scale,
        motifHz: Array.isArray(t.hum.motifHz) ? [...t.hum.motifHz] : []
      }));
  }

  /* ------------------------- the portrait ------------------------- */

  /*
   * Breadth of keeping (design §3): the kinds of keeping that
   * stand in the record at least once. Kinds are read from the
   * record kinds the site's own doors already write — never from
   * any tally this module keeps.
   */
  const KEEPING_KINDS = Object.freeze([
    { id: "day", label: "a day witnessed", subtypes: ["day-note", "witness-mark"] },
    { id: "garden", label: "a bed planted", subtypes: ["garden-planting"] },
    { id: "episode", label: "an episode watched", subtypes: [WATCH_SUBTYPE] },
    { id: "quest", label: "a quest answered", subtypes: ["quest-answer"] },
    { id: "word", label: "a word kept", subtypes: ["word-keepsake", "word-card"] }
  ]);

  const KINDLED_KINDS_REQUIRED = 3;

  function kindsFromRecords(records) {
    const list = Array.isArray(records) ? records : [];
    return KEEPING_KINDS.map(kind => ({
      id: kind.id,
      label: kind.label,
      present: list.some(r => r && kind.subtypes.includes(r.subtype))
    }));
  }

  /* Slice 1 spans Spark → Kindled only (design §5): the later
   * stages are tuned against real records when their slice
   * comes. The portrait never goes down — it is a fold over
   * everything the record holds, and records are only added. */
  function portraitFromRecords(records) {
    const kinds = kindsFromRecords(records);
    const present = kinds.filter(k => k.present);
    const kindCount = present.length;
    const stageName = kindCount >= KINDLED_KINDS_REQUIRED ? "Kindled" : "Spark";
    const line =
      kindCount === 0
        ? "The portrait of keeping: nothing stands in it yet. It is painted by keeping — a day witnessed, a bed planted, an episode watched — and it is never taken away."
        : `The portrait of keeping: the Spark stands ${stageName} in it — ${present.map(k => k.label).join(", ")} ${kindCount === 1 ? "stands" : "stand"} in the record. ` +
          (stageName === "Kindled"
            ? "Three kinds of keeping are enough to kindle the portrait; it only ever grows from here."
            : "Kinds of keeping are its measure, not counts — one of a new kind paints more than many of a kind already there.");
    return { kinds, kindCount, stageName, line };
  }

  return {
    VERSION,
    WATCH_SUBTYPE,
    RECORD_TAG,
    MOON_NAMES_SET_A,
    EPISODES,
    MAX_RATE,
    COVERAGE_REQUIRED,
    episodeByChapterId,
    distinguisherLine,
    createWatchTracker,
    coordinateForInstant,
    moonNameForTemporal,
    watchedOnLine,
    isWatchRecord,
    buildWatchRecord,
    buildMetAgainRecord,
    planWatch,
    foldWatches,
    humRepertoire,
    KEEPING_KINDS,
    KINDLED_KINDS_REQUIRED,
    kindsFromRecords,
    portraitFromRecords
  };
});

/* ============================ browser half ============================ */
(function () {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const Activities = window.SparkActivities;
  if (!Activities) return;

  /* The Atlas stack, lazy-loaded only when a watch completes or
   * a token is read back — the way Their Home loads the garden
   * stack: the standing page stays light, and nothing is fetched
   * for a keeper who never watches an episode through. These are
   * the site's own same-origin modules; the earning path itself
   * makes no network calls and reports nothing anywhere. */
  const STACK = [
    ["CodexLifeAtlasSchema", "assets/js/life-atlas/life-atlas-schema.js"],
    ["CodexLifeAtlasRepository", "assets/js/life-atlas/life-atlas-repository.js"],
    ["CodexLifeAtlasIndexedDb", "assets/js/life-atlas/life-atlas-indexeddb.js"],
    ["CodexLifeAtlasRuntime", "assets/js/life-atlas/life-atlas-runtime.js"],
    ["CodexRecordHelpers", "assets/js/life-atlas/record-helpers.js"]
  ];

  function moduleBase() {
    const script = document.querySelector('script[src*="spark-activities.js"]');
    try {
      return script ? new URL(".", script.src).href : document.baseURI;
    } catch {
      return document.baseURI;
    }
  }

  function loadScript(rel) {
    return new Promise((resolve, reject) => {
      const el = document.createElement("script");
      el.src = new URL(rel, moduleBase()).href;
      el.onload = () => resolve();
      el.onerror = () => reject(new Error(`could not load ${rel}`));
      document.head.appendChild(el);
    });
  }

  let repositoryPromise = null;
  function resolveRepository() {
    if (repositoryPromise) return repositoryPromise;
    repositoryPromise = (async () => {
      for (const [globalName, rel] of STACK) {
        if (!window[globalName]) {
          try { await loadScript(rel); } catch { /* a later global may still carry it */ }
        }
      }
      const Helpers = window.CodexRecordHelpers;
      if (Helpers?.createRepositoryResolver) {
        try {
          const repository = await Helpers.createRepositoryResolver()();
          if (repository) return repository;
        } catch { /* fall through to the runtime */ }
      }
      if (window.CodexLifeAtlasRuntime?.ready) {
        try {
          return await window.CodexLifeAtlasRuntime.ready;
        } catch { return null; }
      }
      return null;
    })();
    return repositoryPromise;
  }

  async function readRecords() {
    const repository = await resolveRepository();
    if (!repository) return null;
    try {
      return await repository.query({});
    } catch {
      return null;
    }
  }

  /* ------------------------- the token line ------------------------- */

  function tokenLineFor(figure, episode, fold) {
    const token = fold.tokens.find(t => t.episodeId === episode.chapterId);
    let line = figure.querySelector(".story-token-line");
    if (!token) {
      if (line) line.remove();
      return;
    }
    if (!line) {
      line = document.createElement("p");
      line.className = "story-token-line";
      figure.appendChild(line);
    }
    const again = token.metAgainYears.length
      ? ` Met again in its own Moon in ${token.metAgainYears.join(", ")}.`
      : "";
    line.textContent =
      `The token is home: ${episode.token} — watched through on ${token.watchedOn}. ` +
      `It stands in Their Home's story corner, and the Spark has learned this episode's hum.` +
      (token.skill ? ` The skill it teaches, ${token.skill.name}, is marked met.` : "") +
      again;
  }

  async function refreshTokenLine(figure, episode) {
    const records = await readRecords();
    if (!records) return;
    tokenLineFor(figure, episode, Activities.foldWatches(records));
  }

  /* --------------------------- the earning --------------------------- */

  let earningInFlight = false;
  async function earnWatch(figure, episode) {
    if (earningInFlight) return;
    earningInFlight = true;
    try {
      const repository = await resolveRepository();
      if (!repository) return;
      const records = await repository.query({});
      const temporal = Activities.coordinateForInstant(new Date());
      const plan = Activities.planWatch(records, episode, temporal);
      if (plan.action === "watch") {
        await repository.put(Activities.buildWatchRecord(episode, temporal));
      } else if (plan.action === "met-again") {
        await repository.put(Activities.buildMetAgainRecord(episode, temporal));
      } else {
        return;
      }
      if (window.CodexRecordHelpers?.notifyRecordsChanged) {
        window.CodexRecordHelpers.notifyRecordsChanged({ source: "spark-activities" });
      }
      const after = await repository.query({});
      tokenLineFor(figure, episode, Activities.foldWatches(after));
    } catch {
      /* The record is the keeper's; a failed write is silent here
       * and the watch simply has not been written yet. */
    } finally {
      earningInFlight = false;
    }
  }

  /* --------------------------- the player --------------------------- */

  const wired = new WeakSet();

  function wireFigure(figure) {
    if (wired.has(figure)) return;
    const video = figure.querySelector("video");
    const slot = figure.closest("[data-story-slot]");
    if (!video || !slot) return;
    const episode = Activities.episodeByChapterId(slot.getAttribute("data-story-chapter"));
    if (!episode) return;
    wired.add(figure);

    let tracker = null;
    let sampler = null;

    function ensureTracker() {
      if (!tracker) tracker = Activities.createWatchTracker(video.duration || NaN);
      return tracker;
    }

    function sample() {
      if (!tracker) return;
      tracker.tick(video.currentTime, {
        playing: !video.paused && !video.ended,
        rate: video.playbackRate || 1,
        visible: !document.hidden
      });
    }

    video.addEventListener("play", () => {
      ensureTracker();
      if (sampler) clearInterval(sampler);
      sampler = setInterval(sample, 250);
    });
    video.addEventListener("pause", () => {
      sample();
      if (sampler) clearInterval(sampler);
      sampler = null;
      if (tracker) tracker.breakStretch();
    });
    video.addEventListener("seeked", () => { if (tracker) tracker.breakStretch(); });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && tracker) tracker.breakStretch();
    });
    video.addEventListener("ended", () => {
      sample();
      if (sampler) clearInterval(sampler);
      sampler = null;
      const t = ensureTracker();
      t.markEnded();
      if (t.attested()) void earnWatch(figure, episode);
    });

    /* Read-back: when the episode first comes into view, show
     * the token as home if the record already holds the watch. */
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            observer.disconnect();
            void refreshTokenLine(figure, episode);
          }
        }
      }, { rootMargin: "200px" });
      observer.observe(figure);
    }
  }

  function scan() {
    document.querySelectorAll("figure.story-episode").forEach(wireFigure);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scan);
  } else {
    scan();
  }
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
})();
