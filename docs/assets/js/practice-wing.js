/**
 * Practices — the Exercises Wing (practices.html, the Training Grounds)
 *
 * Aaron's direction (Nov 19, 2026): "All the kind exercises and all
 * kinds of stuff to enhance a human. I want it to be something people
 * don't normally get." The wing is the school's drill room: short
 * exercises for breath, attention, witness, memory, and intention,
 * each fully done on the page, in plain words.
 *
 * The record contract is the bench's own, verified against the
 * shipped code, not assumed:
 *
 *   1. A completed exercise seals a canonical Life Atlas record in
 *      the same repository the Sphere, planner, calendar, and garden
 *      read (CodexLifeAtlasRepository). No wing store, no silo.
 *   2. The record is type "event" / subtype "practice-session" — the
 *      schema's type + subtype extension path, the exact shape
 *      manifest-practice.js writes — with the session detail under
 *      payload.manifestPractice and one added sub-object,
 *      payload.manifestPractice.exercise, naming the wing exercise,
 *      its family, and its own results.
 *   3. Because the shape is exact, the bench honours it with no
 *      changes anywhere else: the garden counts the day as practice
 *      rain (it queries subtype "practice-session" by civil date),
 *      the day takes its practice marker on the 13 Moons calendar and
 *      in the Sphere's day view, and the Spark celebrates the seal.
 *   4. Every record's temporal coordinate is read from
 *      PatternCalendar (the canonical converter), never
 *      hand-computed, and persisted with the Life Atlas convention:
 *      temporal.patternYear is the anchor (alignment) civil year.
 *   5. A record is written only at a real completion, at the seal.
 *      Leaving mid-exercise writes nothing, and the page says so.
 *      Durations are measured from the keeper's own Begin and Seal
 *      taps — real seconds, never the plan's estimate. Nothing here
 *      decays, no count is kept against the keeper, and nothing
 *      leaves the device;
 *      this module makes no network calls.
 *
 * Honesty fence: these are practices, not medical treatment, and no
 * exercise here is offered as medicine, promises a power, or claims
 * an effect beyond what the doing itself plainly is. Where an exercise descends from an
 * older tradition, the page labels the tradition's claim as its
 * claim.
 *
 * The pure functions (EXERCISES, phasePlan, countReturns,
 * buildSessionRecord, isWingSession, summarizeWingSessions,
 * countSessionsOn, temporalFromConversion) carry no DOM or storage
 * dependency and are unit-tested in tests/practice-wing.test.js.
 */
(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.CodexPracticeWing = api;
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function () {
    "use strict";

    const VERSION = "practice-wing/1.0.0";

    const RECORD_TYPE = "event";
    const RECORD_SUBTYPE = "practice-session";
    const RECORD_TAG = "manifest-practice";
    const WING_TAG = "practice-wing";
    const SOURCE_TYPE = "practice-wing";
    const SOURCE_ID = "practices.html";

    const XI_LABEL =
      "console coherence estimate (Ξ) — the exercise console's own number, not a measured effect";

    const FAMILIES = Object.freeze({
      breath: "Breath",
      attention: "Attention",
      witness: "Witness",
      memory: "Memory",
      intention: "Intention"
    });

    /* ------------------------- pure helpers ------------------------- */

    function finiteOrNull(value) {
      if (value === null || value === undefined || value === "") {
        return null;
      }

      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    }

    function cleanText(value, max = 2000) {
      if (value === null || value === undefined) return "";

      return String(value).trim().slice(0, max);
    }

    function cleanNullable(value, max = 2000) {
      const text = cleanText(value, max);
      return text || null;
    }

    function phase(label, prompt, seconds, extra = {}) {
      return Object.freeze({ label, prompt, seconds, ...extra });
    }

    function fourfoldRounds(rounds) {
      const phases = [];

      for (let round = 1; round <= rounds; round += 1) {
        phases.push(
          phase("Observe — breathe in", "Breathe in, counted to four.", 4, { ring: "in", round }),
          phase("Breathe — hold", "Hold, easy. Nothing to force.", 4, { ring: "hold", round }),
          phase("Align — breathe out", "Breathe out, counted to four.", 4, { ring: "out", round }),
          phase("Return — rest", "Rest at the bottom of the breath.", 4, { ring: "rest", round })
        );
      }

      return phases;
    }

    function returnsBlocks(blocks) {
      const phases = [];

      for (let block = 1; block <= blocks; block += 1) {
        phases.push(
          phase("Attend", "Stay with the light. When the mind wanders, that wandering is part of the exercise — the question is coming.", 20, { block }),
          phase("The question", "Were you here?", 0, { ask: true, block })
        );
      }

      return phases;
    }

    function intentionBreaths(rounds) {
      const phases = [];

      for (let round = 1; round <= rounds; round += 1) {
        phases.push(
          phase("Breathe in", "In, counted to four.", 4, { ring: "in", round }),
          phase("Breathe out", "Out, counted to four.", 4, { ring: "out", round })
        );
      }

      return phases;
    }

    /* ------------------------- the exercises ------------------------ */

    const EXERCISES = Object.freeze([
      Object.freeze({
        id: "fourfold-breath",
        name: "The Fourfold Breath",
        family: "breath",
        glyph: "🌬",
        timeLabel: "About 3 minutes",
        trains:
          "Breath pacing, and settling your attention on one counted rhythm.",
        intro:
          "The site's own ritual line, turned into a breath: Observe, Breathe, Align, Return — in for four, hold for four, out for four, rest for four, ten rounds. Slow counted breathing is a plain, well-attested way to settle. Nothing more is claimed for it, and nothing more is needed.",
        visual: "ring",
        breathPattern: "Fourfold — in 4 · hold 4 · out 4 · rest 4",
        sealNote: "optional",
        phases: Object.freeze([
          phase("Settle", "Sit tall. Let your shoulders drop. Nothing to fix.", 10, { ring: "rest" }),
          ...fourfoldRounds(10),
          phase("Complete", "Let the breath find its own pace again.", 8, { ring: "rest" })
        ])
      }),

      Object.freeze({
        id: "count-the-returns",
        name: "Count the Returns",
        family: "attention",
        glyph: "🌀",
        timeLabel: "About 3 minutes, plus your answers",
        trains:
          "Noticing that the mind wandered, and returning — the one move every attention practice is built on.",
        intro:
          "A small light drifts. Every twenty seconds you are asked one honest question: were you here? Answer Here or Drifted. A return is a Drifted followed by a Here, and returns are what get counted. Drifting is not failure here — drifting is the weight, and returning is the rep. The count is your own honest tally, recorded as exactly that.",
        visual: "drift",
        breathPattern: null,
        sealNote: "optional",
        phases: Object.freeze([
          phase("Settle", "Rest your eyes on the small light. Let it move; you stay.", 8, {}),
          ...returnsBlocks(9),
          phase("Complete", "That is the count: not how still you were, but how often you came back.", 8, {})
        ])
      }),

      Object.freeze({
        id: "sixty-seconds-of-seeing",
        name: "Sixty Seconds of Seeing",
        family: "witness",
        glyph: "👁",
        timeLabel: "One minute, plus one line",
        trains:
          "Observation before interpretation — the Witness method, practised as a drill instead of read as a doctrine.",
        intro:
          "For sixty seconds, only noticing, in three layers: sounds, then the body, then light. Then one line — the one thing you noticed that you would have missed. That line is the fruit of the exercise, and it rides your record as its witness note.",
        visual: "still",
        breathPattern: null,
        sealNote: "none",
        phases: Object.freeze([
          phase("Begin", "For one minute, only noticing. Nothing to interpret yet.", 6, {}),
          phase("Sounds", "Listen only. Near sounds, far sounds, the sounds under the sounds.", 20, {}),
          phase("The body", "Feel only. Weight, touch, warmth, the places holding tension.", 20, {}),
          phase("Light", "See only. Light and shadow, edges, the shapes they make.", 20, {}),
          phase("The one thing", "Write the one thing you noticed that you would have missed.", 0, { write: "note", required: true })
        ])
      }),

      Object.freeze({
        id: "the-keeping",
        name: "The Keeping",
        family: "memory",
        glyph: "🗝",
        timeLabel: "About 2–3 minutes",
        trains:
          "Deliberate recall, and choosing what to carry — memory practised as keeping, not storage.",
        intro:
          "Sit with today for a few breaths, then write three things from today you want to keep — one line each, no more. The day is reviewed while it is still warm, and the choosing is the exercise. Your lines stay in your own record, on this device.",
        visual: "still",
        breathPattern: null,
        sealNote: "none",
        phases: Object.freeze([
          phase("Settle", "Close your eyes if you like. Let today come back to you, from the morning forward.", 20, {}),
          phase("The keeping", "Write three things from today you want to keep. One line each.", 0, { write: "lines", required: true })
        ])
      }),

      Object.freeze({
        id: "the-sealed-intention",
        name: "The Sealed Intention",
        family: "intention",
        glyph: "🜚",
        timeLabel: "About 3 minutes",
        trains:
          "Holding one pictured intention steady, and sealing it in one written line you can return to.",
        intro:
          "The small, plain sibling of the Manifest console at Teach. Four slow breaths; bring one specific thing to mind — a finished task, a room as it will be, a kindness you will do; hold it three ways — see it, hear it, feel its weight; then write the intention in one line and seal it. The thought-power tradition claims thought shapes circumstance; that is the tradition's claim, and this bench keeps the stronger claim where it can be tested, at the Sending Test. What this exercise claims is smaller and true: a pictured, written intention is a commitment you made yourself, kept in your own record.",
        visual: "ring",
        breathPattern: "Four slow breaths — in 4 · out 4",
        sealNote: "none",
        phases: Object.freeze([
          phase("Four slow breaths", "Before the intention, four slow breaths.", 6, { ring: "rest" }),
          ...intentionBreaths(4),
          phase("See it", "Bring the one thing to mind, as done. See it whole.", 30, { ring: "hold" }),
          phase("Hear it", "Stay with it. What sounds belong to it, finished? Words said, tools set down, the quiet after.", 30, { ring: "hold" }),
          phase("Feel its weight", "Feel what it is like to have done it. Not wishing — remembering forward.", 30, { ring: "hold" }),
          phase("The line", "Write the intention in one line, as a thing you will do.", 0, { write: "intention", required: true })
        ])
      })
    ]);

    function exerciseById(id) {
      return EXERCISES.find(exercise => exercise.id === id) || null;
    }

    /**
     * The timed plan of an exercise: phases with cumulative start
     * offsets. Manual phases (seconds 0 — a question to answer, a
     * line to write) carry no offset time; the keeper's own pace
     * rules them, and the sealed record measures real elapsed
     * seconds rather than this plan.
     */
    function phasePlan(exercise) {
      if (!exercise) return { phases: [], plannedSeconds: 0 };

      let offset = 0;

      const phases = exercise.phases.map((entry, index) => {
        const planned = { ...entry, index, startAt: offset };
        offset += Math.max(0, entry.seconds || 0);
        return planned;
      });

      return { phases, plannedSeconds: offset };
    }

    /**
     * Count an attention run. A return is an answer of "here" that
     * follows an answer of "drifted" — the rep the exercise trains.
     */
    function countReturns(answers) {
      const list = (Array.isArray(answers) ? answers : []).filter(
        answer => answer === "here" || answer === "drifted"
      );

      let here = 0;
      let drifted = 0;
      let returns = 0;

      for (let index = 0; index < list.length; index += 1) {
        if (list[index] === "here") {
          here += 1;
          if (index > 0 && list[index - 1] === "drifted") returns += 1;
        } else {
          drifted += 1;
        }
      }

      return { prompts: list.length, here, drifted, returns };
    }

    /* --------------------- temporal (canonical) --------------------- */

    /**
     * Map a PatternCalendar.fromCivilDate conversion into the
     * temporal shape Life Atlas records persist — the same mapping,
     * and the same patternYear convention (the anchor civil year),
     * as manifest-practice.js.
     */
    function temporalFromConversion(conversion, instant = null) {
      if (!conversion || typeof conversion !== "object") {
        return null;
      }

      const anchor =
        conversion.anchorDate instanceof Date
          ? conversion.anchorDate
          : conversion.anchorDate
            ? new Date(conversion.anchorDate)
            : null;

      const anchorYear =
        anchor && !Number.isNaN(anchor.getTime())
          ? anchor.getUTCFullYear()
          : null;

      let instantIso = null;

      if (instant) {
        const when =
          instant instanceof Date ? instant : new Date(instant);

        if (!Number.isNaN(when.getTime())) {
          instantIso = when.toISOString();
        }
      }

      return {
        instant: instantIso,
        start: instantIso,
        end: null,

        timezone: cleanNullable(conversion.timeZone, 80),
        boundaryMode: cleanNullable(conversion.boundaryMode, 40),

        civilDate: cleanNullable(conversion.civilDate, 20),

        patternYear: anchorYear,
        moon: finiteOrNull(conversion.moon),
        moonDay: finiteOrNull(conversion.day),
        patternDay: finiteOrNull(conversion.dayOfPatternYear),
        week: finiteOrNull(conversion.weekOfYear),

        weekGate: null,
        outsideDay: !conversion.insideCountedYear
      };
    }

    function coordinateForInstant(
      instant = new Date(),
      options = {},
      patternCalendar = null
    ) {
      const calendar =
        patternCalendar ||
        (typeof globalThis !== "undefined"
          ? globalThis.PatternCalendar
          : null);

      if (!calendar?.fromCivilDate) {
        return null;
      }

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

        return temporalFromConversion(conversion, instant);
      } catch {
        return null;
      }
    }

    function coordinateLabel(temporal) {
      if (!temporal) return "coordinate unavailable";

      if (temporal.outsideDay || temporal.patternDay === null) {
        return temporal.civilDate
          ? `${temporal.civilDate} · Day Out of Time · outside the 364-day count`
          : "Day Out of Time · outside the 364-day count";
      }

      const moon =
        temporal.moon !== null && temporal.moon !== undefined
          ? `Moon ${temporal.moon}`
          : "Moon —";

      const day =
        temporal.moonDay !== null && temporal.moonDay !== undefined
          ? `Day ${temporal.moonDay}`
          : "Day —";

      return `${moon} · ${day} · Pattern Day ${temporal.patternDay}`;
    }

    /* ------------------------- record builder ----------------------- */

    function cleanResults(exercise, results = {}) {
      if (!exercise || typeof results !== "object" || results === null) {
        return {};
      }

      if (exercise.id === "count-the-returns") {
        const counted = countReturns(results.answers);
        return {
          prompts: counted.prompts,
          here: counted.here,
          drifted: counted.drifted,
          returns: counted.returns
        };
      }

      if (exercise.id === "the-keeping") {
        const lines = (Array.isArray(results.lines) ? results.lines : [])
          .map(line => cleanText(line, 300))
          .filter(Boolean)
          .slice(0, 3);
        return { lines };
      }

      return {};
    }

    function resultsSummary(exercise, results) {
      if (exercise.id === "count-the-returns") {
        return `${results.prompts} questions · ${results.here} here · ${results.drifted} drifted · ${results.returns} return${results.returns === 1 ? "" : "s"} counted.`;
      }

      if (exercise.id === "the-keeping") {
        return `${results.lines.length} thing${results.lines.length === 1 ? "" : "s"} kept from today.`;
      }

      return "";
    }

    /**
     * Build the (pre-normalization) LifeRecord input for a completed
     * wing exercise — the manifest-practice shape exactly, with the
     * wing's exercise detail in one added sub-object. Returns null
     * for an unknown exercise: the wing seals only what it knows.
     */
    function buildSessionRecord(input = {}, temporal = null) {
      const exercise = exerciseById(input.exerciseId);
      if (!exercise) return null;

      const results = cleanResults(exercise, input.results || {});

      const intention =
        exercise.id === "the-sealed-intention"
          ? cleanText(input.intention, 1000)
          : "";

      let witnessNote = cleanNullable(input.witnessNote, 2000);

      if (exercise.id === "sixty-seconds-of-seeing") {
        witnessNote = cleanNullable(input.note, 2000) || witnessNote;
      }

      if (exercise.id === "the-keeping" && results.lines?.length) {
        witnessNote = results.lines.join(" · ");
      }

      const durationRaw = finiteOrNull(input.durationSeconds);
      const durationSeconds =
        durationRaw === null || durationRaw <= 0
          ? null
          : Math.round(durationRaw);

      const summaryParts = [
        resultsSummary(exercise, results),
        witnessNote && exercise.id !== "the-keeping" ? witnessNote : ""
      ].filter(Boolean);

      return {
        type: RECORD_TYPE,
        subtype: RECORD_SUBTYPE,

        title: exercise.name,
        summary: summaryParts.join(" "),

        temporal: temporal || {},

        tags: [RECORD_TAG, "practice", WING_TAG, exercise.family],

        provenance: {
          sourceType: SOURCE_TYPE,
          sourceId: SOURCE_ID,
          calculationAuthority: "PatternCalendar"
        },

        privacy: {
          visibility: "private",
          containsPersonalData: true,
          shareAllowed: false
        },

        payload: {
          manifestPractice: {
            version: 1,
            sealedVia: `Exercises Wing — ${exercise.name}`,

            intention,
            sessionKind: "practice",

            carriersHz: [],
            sequencePath: exercise.name,

            visualMode: null,
            seed: null,

            breathPattern: exercise.breathPattern || null,

            durationSeconds,

            xi: {
              value: null,
              label: XI_LABEL
            },

            materials: null,
            witnessNote,

            exercise: {
              version: 1,
              id: exercise.id,
              family: exercise.family,
              name: exercise.name,
              results
            }
          }
        }
      };
    }

    function isWingSession(record) {
      if (!record || typeof record !== "object") return false;
      if (record.subtype !== RECORD_SUBTYPE) return false;

      return Boolean(
        record.payload?.manifestPractice?.exercise ||
        (Array.isArray(record.tags) && record.tags.includes(WING_TAG))
      );
    }

    function summarizeWingSessions(records = []) {
      const sessions = (Array.isArray(records) ? records : []).filter(
        isWingSession
      );

      const byFamily = {};
      const byExercise = {};

      for (const session of sessions) {
        const detail = session.payload?.manifestPractice?.exercise || {};
        const family = detail.family || "unknown";
        const id = detail.id || "unknown";

        byFamily[family] = (byFamily[family] || 0) + 1;
        byExercise[id] = (byExercise[id] || 0) + 1;
      }

      return { count: sessions.length, byFamily, byExercise };
    }

    /**
     * How many practice sessions — the wing's and Teach's together,
     * one bench, one record family — were sealed on a civil date.
     */
    function countSessionsOn(records = [], civilDate = null) {
      if (!civilDate) return 0;

      return (Array.isArray(records) ? records : []).filter(
        record =>
          record?.subtype === RECORD_SUBTYPE &&
          record?.temporal?.civilDate === civilDate
      ).length;
    }

    /* --------------------- browser integration --------------------- */

    let repositoryPromise = null;

    function resolveRepository() {
      if (repositoryPromise) return repositoryPromise;

      repositoryPromise = (async () => {
        const runtime =
          typeof globalThis !== "undefined"
            ? globalThis.CodexLifeAtlasRuntime
            : null;

        if (runtime?.ready) {
          try {
            const repository = await runtime.ready;
            if (repository) return repository;
          } catch {
            /* fall through to a direct persistent repository */
          }
        }

        const Repository =
          typeof globalThis !== "undefined"
            ? globalThis.CodexLifeAtlasRepository
            : null;

        if (!Repository) return null;

        try {
          if (typeof Repository.createPersistentRepository === "function") {
            return Repository.createPersistentRepository();
          }
        } catch {
          /* IndexedDB unavailable — memory fallback below */
        }

        try {
          return Repository.createRepository();
        } catch {
          return null;
        }
      })();

      return repositoryPromise;
    }

    function notifyRecordsChanged(detail) {
      if (typeof document !== "undefined") {
        document.dispatchEvent(
          new CustomEvent("sof:life-atlas-records-changed", { detail })
        );
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("sof:life-atlas-records-changed", { detail })
        );
      }
    }

    function reducedMotion() {
      try {
        return (
          window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
          document.documentElement.dataset.codexMotion === "off"
        );
      } catch {
        return false;
      }
    }

    function formatClock(totalSeconds) {
      const seconds = Math.max(0, Math.floor(totalSeconds));
      const minutes = Math.floor(seconds / 60);
      const rest = seconds % 60;
      return `${minutes}:${String(rest).padStart(2, "0")}`;
    }

    /* --------------------------- the stage -------------------------- */

    const els = {};
    let run = null;
    let tickTimer = 0;

    function cacheElements() {
      const ids = [
        "pw-stage",
        "pw-stage-title",
        "pw-stage-family",
        "pw-phase-label",
        "pw-phase-prompt",
        "pw-visual",
        "pw-ring",
        "pw-dot",
        "pw-clock",
        "pw-answers",
        "pw-write",
        "pw-write-note",
        "pw-write-lines",
        "pw-write-intention",
        "pw-write-done",
        "pw-seal-panel",
        "pw-seal-line",
        "pw-seal-note-row",
        "pw-seal-note",
        "pw-seal-button",
        "pw-seal-dismiss",
        "pw-leave",
        "pw-status"
      ];

      for (const id of ids) {
        els[id] = document.getElementById(id);
      }
    }

    function setStatus(message) {
      if (els["pw-status"]) els["pw-status"].textContent = message;
    }

    function stopTick() {
      if (tickTimer) {
        clearInterval(tickTimer);
        tickTimer = 0;
      }
    }

    function showStagePart(part) {
      const parts = {
        answers: els["pw-answers"],
        write: els["pw-write"],
        seal: els["pw-seal-panel"]
      };

      for (const [name, el] of Object.entries(parts)) {
        if (el) el.hidden = name !== part;
      }

      if (els["pw-leave"]) {
        els["pw-leave"].hidden = part === "seal";
      }
    }

    function setRing(state, seconds) {
      const ring = els["pw-ring"];
      if (!ring) return;

      const scale =
        state === "in" || state === "hold" ? 1.5 : 1;

      if (reducedMotion()) {
        ring.style.transition = "none";
      } else {
        ring.style.transition = `transform ${Math.max(0.3, seconds)}s linear`;
      }

      ring.style.transform = `scale(${scale})`;
    }

    function renderPhase() {
      if (!run) return;

      const entry = run.plan.phases[run.index];
      if (!entry) return;

      if (els["pw-phase-label"]) {
        els["pw-phase-label"].textContent = entry.round
          ? `${entry.label} · round ${entry.round}`
          : entry.label;
      }

      if (els["pw-phase-prompt"]) {
        els["pw-phase-prompt"].textContent = entry.prompt;
      }

      if (els["pw-visual"]) {
        els["pw-visual"].dataset.visual = run.exercise.visual;
        els["pw-visual"].dataset.still = reducedMotion() ? "true" : "false";
      }

      if (run.exercise.visual === "ring") {
        setRing(entry.ring || "rest", entry.seconds || 4);
      }

      if (entry.ask) {
        showStagePart("answers");
      } else if (entry.write) {
        showWrite(entry);
      } else {
        showStagePart(null);
      }
    }

    function showWrite(entry) {
      showStagePart("write");

      const note = els["pw-write-note"];
      const lines = els["pw-write-lines"];
      const intention = els["pw-write-intention"];

      if (note) note.hidden = entry.write !== "note";
      if (lines) lines.hidden = entry.write !== "lines";
      if (intention) intention.hidden = entry.write !== "intention";
    }

    function advance() {
      if (!run) return;

      run.index += 1;

      if (run.index >= run.plan.phases.length) {
        finishRun();
        return;
      }

      beginPhase();
    }

    function beginPhase() {
      if (!run) return;

      const entry = run.plan.phases[run.index];
      if (!entry) return;

      renderPhase();

      if (entry.ask || entry.write) {
        run.phaseEndsAt = null;
        if (els["pw-clock"]) {
          els["pw-clock"].textContent =
            "In your own time — the exercise waits for you.";
        }
        return;
      }

      run.phaseEndsAt = Date.now() + entry.seconds * 1000;
    }

    function tick() {
      if (!run) return;

      const now = Date.now();
      const elapsed = Math.floor((now - run.startedAt) / 1000);

      if (run.phaseEndsAt) {
        const left = Math.max(0, Math.ceil((run.phaseEndsAt - now) / 1000));

        if (els["pw-clock"]) {
          els["pw-clock"].textContent =
            `${formatClock(elapsed)} in · ${left} second${left === 1 ? "" : "s"} in this phase`;
        }

        if (left <= 0) {
          advance();
        }
      } else if (els["pw-clock"] && run.awaitingSeal) {
        els["pw-clock"].textContent = `${formatClock(elapsed)} in`;
      }
    }

    function startRun(exerciseId) {
      const exercise = exerciseById(exerciseId);
      if (!exercise || !els["pw-stage"]) return;

      stopTick();

      run = {
        exercise,
        plan: phasePlan(exercise),
        index: 0,
        startedAt: Date.now(),
        phaseEndsAt: null,
        answers: [],
        awaitingSeal: false
      };

      if (els["pw-stage-title"]) {
        els["pw-stage-title"].textContent = exercise.name;
      }

      if (els["pw-stage-family"]) {
        els["pw-stage-family"].textContent =
          `${FAMILIES[exercise.family] || exercise.family} · ${exercise.timeLabel}`;
      }

      setStatus("");
      showStagePart(null);
      beginPhase();

      tickTimer = setInterval(tick, 200);
      tick();

      els["pw-stage"].scrollIntoView({
        behavior: reducedMotion() ? "auto" : "smooth",
        block: "start"
      });
    }

    function leaveRun() {
      stopTick();
      run = null;

      if (els["pw-stage-title"]) {
        els["pw-stage-title"].textContent = "The stage is quiet";
      }

      if (els["pw-stage-family"]) els["pw-stage-family"].textContent = "";

      if (els["pw-phase-label"]) {
        els["pw-phase-label"].textContent = "Choose an exercise below to begin.";
      }

      if (els["pw-phase-prompt"]) {
        els["pw-phase-prompt"].textContent =
          "Nothing was recorded. In this room a record is written only when an exercise is finished and sealed — leaving early leaves no mark, and that is by design.";
      }

      if (els["pw-clock"]) els["pw-clock"].textContent = "";
      if (els["pw-ring"]) {
        els["pw-ring"].style.transform = "scale(1)";
      }

      showStagePart(null);
      if (els["pw-leave"]) els["pw-leave"].hidden = true;
      setStatus("");
    }

    function finishRun() {
      if (!run) return;

      run.awaitingSeal = true;
      run.phaseEndsAt = null;

      if (els["pw-phase-label"]) {
        els["pw-phase-label"].textContent = "Complete";
      }

      if (els["pw-phase-prompt"]) {
        els["pw-phase-prompt"].textContent =
          "The exercise is done. Seal it and the day carries it — or let it go unrecorded. Both are honest.";
      }

      if (els["pw-ring"]) setRing("rest", 1);

      const duration = Math.round((Date.now() - run.startedAt) / 1000);

      if (els["pw-seal-line"]) {
        els["pw-seal-line"].textContent =
          `${run.exercise.name} — ${formatClock(duration)} by your own clock.`;
      }

      if (els["pw-seal-note-row"]) {
        els["pw-seal-note-row"].hidden = run.exercise.sealNote !== "optional";
      }

      showStagePart("seal");
    }

    function collectWrite() {
      if (!run) return null;

      const entry = run.plan.phases[run.index];
      if (!entry?.write) return null;

      if (entry.write === "note") {
        const field = document.getElementById("pw-note-field");
        const value = cleanText(field?.value, 2000);

        if (entry.required && !value) {
          setStatus("Write the one thing first — that line is the exercise's fruit.");
          return null;
        }

        return { note: value };
      }

      if (entry.write === "lines") {
        const values = [1, 2, 3].map(number => {
          const field = document.getElementById(`pw-line-${number}`);
          return cleanText(field?.value, 300);
        });

        if (entry.required && !values.some(Boolean)) {
          setStatus("Keep at least one thing from today — one line is enough to seal.");
          return null;
        }

        return { lines: values };
      }

      if (entry.write === "intention") {
        const field = document.getElementById("pw-intention-field");
        const value = cleanText(field?.value, 1000);

        if (entry.required && !value) {
          setStatus("Write the intention in one line first — the line is the seal's centre.");
          return null;
        }

        return { intention: value };
      }

      return {};
    }

    async function sealRun() {
      if (!run || !run.awaitingSeal) return;

      const exercise = run.exercise;
      const durationSeconds = Math.round((Date.now() - run.startedAt) / 1000);

      const input = {
        exerciseId: exercise.id,
        durationSeconds,
        answers: run.answers,
        results: {},
        intention: run.collected?.intention || "",
        note: run.collected?.note || "",
        witnessNote:
          exercise.sealNote === "optional"
            ? cleanText(els["pw-seal-note"]?.value, 2000)
            : ""
      };

      if (run.collected?.lines) {
        input.results = { lines: run.collected.lines };
      }

      if (exercise.id === "count-the-returns") {
        input.results = { answers: run.answers };
      }

      const repository = await resolveRepository();

      if (!repository) {
        setStatus(
          "The Life Atlas was unavailable, so this exercise was not recorded. The doing still happened; the record could not be kept."
        );
        return;
      }

      const temporal = coordinateForInstant(new Date());
      const record = buildSessionRecord(input, temporal);

      if (!record) {
        setStatus("This exercise could not be sealed — its shape was not recognised.");
        return;
      }

      const saved = await repository.put(record);

      notifyRecordsChanged({
        source: SOURCE_TYPE,
        kind: "practice",
        recordId: saved.id
      });

      stopTick();
      const finishedName = exercise.name;
      const finishedTemporal = temporal;
      run = null;

      if (els["pw-phase-label"]) {
        els["pw-phase-label"].textContent = "Sealed";
      }

      if (els["pw-phase-prompt"]) {
        els["pw-phase-prompt"].textContent =
          "Kept in your Life Atlas, on this device. Choose another exercise whenever you are ready — there is no pace to keep here but your own.";
      }

      showStagePart(null);
      if (els["pw-leave"]) els["pw-leave"].hidden = true;

      setStatus(
        `Sealed to your Life Atlas — ${coordinateLabel(finishedTemporal)}. ` +
          "Today now counts as a practice day: it rains on your garden in the Training Grounds and carries its marker on the calendar. Records stay on this device."
      );

      void refreshTodayStrip();
    }

    /* ------------------------- today strip -------------------------- */

    async function refreshTodayStrip() {
      if (typeof document === "undefined") return;

      const coords = document.getElementById("pw-today-coords");
      const countEl = document.getElementById("pw-today-count");
      if (!coords && !countEl) return;

      const temporal = coordinateForInstant(new Date());

      if (coords) {
        coords.textContent = temporal
          ? `${temporal.civilDate || ""} · ${coordinateLabel(temporal)}`
          : "Today's coordinate is unavailable";
      }

      /* The day's door needs only the coordinate and the moon's
       * own words — never the record — so it renders before the
       * repository work below, whatever that work finds. */
      renderDaysDoor(temporal);

      let count = null;

      const repository = await resolveRepository();

      if (repository && temporal?.civilDate) {
        try {
          const records = await repository.query({ subtype: RECORD_SUBTYPE });
          count = countSessionsOn(records, temporal.civilDate);
        } catch {
          count = null;
        }
      }

      if (countEl) {
        countEl.textContent =
          count === null
            ? "Session count unavailable"
            : count === 0
              ? "No practice sessions sealed today yet — the day is open"
              : `${count} practice session${count === 1 ? "" : "s"} sealed today across the bench`;
      }
    }

    /* --------------------- the day's door (Q-06) ---------------------
     * Exercises slice 2, approved Nov 25, 2026 under Aaron's
     * approvals delegation (queue card Q-06), hung on the school
     * root by Page Evolution Batch E5. The telling's moon-practice
     * line names the day: each moon's practice words, verbatim
     * from PatternCalendarData, are matched to one of the wing's
     * five exercises, and the Practices room opens with that
     * exercise lit. The match is a table, in the open — one moon,
     * one exercise, one plain reason — so the suggestion can be
     * read, argued with, and changed in one place. */

    const DAYS_DOOR = {
      1: { exercise: "the-sealed-intention", why: "Speak the first word, mark the seed: an intention is a first word, marked." },
      2: { exercise: "the-keeping", why: "The moon's work is memory, cleansed; the Keeping is the wing's memory exercise." },
      3: { exercise: "fourfold-breath", why: "Breathe before response: the breath exercise is this moon's own shape." },
      4: { exercise: "sixty-seconds-of-seeing", why: "Record what happened begins with seeing it; observation first, then the record." },
      5: { exercise: "the-sealed-intention", why: "Speak with care, through ordered language: one line, written with care, and sealed." },
      6: { exercise: "count-the-returns", why: "Courage without rushing is attention held; the return is how it is held." },
      7: { exercise: "count-the-returns", why: "Weighing the pattern begins with noticing where the mind is." },
      8: { exercise: "sixty-seconds-of-seeing", why: "Look beneath the surface: notice the thing you would have missed." },
      9: { exercise: "count-the-returns", why: "Correct course, repair one broken loop: the return is the rep." },
      10: { exercise: "the-keeping", why: "Build, fix, organize: keep the day's made and mended things, one line each." },
      11: { exercise: "the-keeping", why: "Remember names, lineage, and the long story: memory is this moon's practice." },
      12: { exercise: "sixty-seconds-of-seeing", why: "Track timing, do not force the river: watch the signs as they pass." },
      13: { exercise: "the-sealed-intention", why: "Close the loop, harvest the lesson: sealing is this exercise's own act." }
    };

    const EXERCISE_NAMES = {
      "fourfold-breath": "The Fourfold Breath",
      "count-the-returns": "Count the Returns",
      "sixty-seconds-of-seeing": "Sixty Seconds of Seeing",
      "the-keeping": "The Keeping",
      "the-sealed-intention": "The Sealed Intention"
    };

    function renderDaysDoor(temporal) {
      const mount = document.getElementById("pw-days-door");
      if (!mount || mount.dataset.rendered) return;

      let moonName = null;
      let practiceLine = null;
      let pick = null;

      if (!temporal || temporal.outsideDay || temporal.patternDay === null || temporal.patternDay === undefined) {
        moonName = "The Day Out of Time";
        practiceLine = "No moon practice today; witness the pause itself.";
        pick = { exercise: "sixty-seconds-of-seeing", why: "Witness the pause itself: sixty seconds of seeing, and one line." };
      } else {
        const data = globalThis.PatternCalendarData;
        const record = data && Array.isArray(data.moons)
          ? data.moons.find(moon => moon.idx === temporal.moon)
          : null;
        if (!record || !DAYS_DOOR[record.idx]) return;
        moonName = `Moon ${record.idx} · ${record.name}`;
        practiceLine = record.practice;
        pick = DAYS_DOOR[record.idx];
      }

      mount.dataset.rendered = "1";
      mount.replaceChildren();

      const line = document.createElement("p");
      line.textContent = `${moonName}. The practice for this moon: ${practiceLine}`;
      mount.appendChild(line);

      const suggestion = document.createElement("p");
      suggestion.textContent = `Today's exercise: ${EXERCISE_NAMES[pick.exercise]}. ${pick.why}`;
      mount.appendChild(suggestion);

      const begin = document.createElement("button");
      begin.type = "button";
      begin.className = "pw-btn";
      begin.textContent = `Begin ${EXERCISE_NAMES[pick.exercise]}`;
      begin.addEventListener("click", () => {
        const cardButton = document.querySelector(`[data-pw-begin="${pick.exercise}"]`);
        if (cardButton) cardButton.click();
      });
      mount.appendChild(begin);

      const cardButton = document.querySelector(`[data-pw-begin="${pick.exercise}"]`);
      const card = cardButton ? cardButton.closest(".pw-card") : null;
      if (card && !card.classList.contains("pw-card--today")) {
        card.classList.add("pw-card--today");
        const badge = document.createElement("p");
        badge.className = "pw-card-meta pw-today-badge";
        badge.textContent = "The day's door · suggested today";
        card.insertBefore(badge, card.firstChild);
      }
    }

    /* ------------------------------ init ---------------------------- */

    function init() {
      if (typeof document === "undefined") return;
      if (!document.getElementById("pw-stage")) return;

      cacheElements();

      document.querySelectorAll("[data-pw-begin]").forEach(button => {
        button.addEventListener("click", () => {
          startRun(button.dataset.pwBegin);
        });
      });

      document.querySelectorAll("[data-pw-answer]").forEach(button => {
        button.addEventListener("click", () => {
          if (!run) return;
          run.answers.push(button.dataset.pwAnswer);
          advance();
        });
      });

      if (els["pw-write-done"]) {
        els["pw-write-done"].addEventListener("click", () => {
          if (!run) return;

          const collected = collectWrite();
          if (!collected) return;

          run.collected = { ...(run.collected || {}), ...collected };
          setStatus("");
          advance();
        });
      }

      if (els["pw-seal-button"]) {
        els["pw-seal-button"].addEventListener("click", () => {
          void sealRun();
        });
      }

      if (els["pw-seal-dismiss"]) {
        els["pw-seal-dismiss"].addEventListener("click", () => {
          leaveRun();
        });
      }

      if (els["pw-leave"]) {
        els["pw-leave"].addEventListener("click", () => {
          leaveRun();
        });
        els["pw-leave"].hidden = true;
      }

      void refreshTodayStrip();

      document.addEventListener("sof:life-atlas-records-changed", event => {
        if (event?.detail?.source === SOURCE_TYPE) return;
        void refreshTodayStrip();
      });
    }

    if (typeof document !== "undefined") {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
      } else {
        init();
      }
    }

    return Object.freeze({
      VERSION,

      RECORD_TYPE,
      RECORD_SUBTYPE,
      RECORD_TAG,
      WING_TAG,
      FAMILIES,
      EXERCISES,

      exerciseById,
      phasePlan,
      countReturns,

      buildSessionRecord,
      isWingSession,
      summarizeWingSessions,
      countSessionsOn,

      temporalFromConversion,
      coordinateForInstant,
      coordinateLabel
    });
  }
);
