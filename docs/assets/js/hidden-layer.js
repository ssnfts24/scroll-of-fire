/**
 * The Hidden Layer — little games in their own rooms (stage 1),
 * and the parked finds engine.
 *
 * Aaron's design (Nov 20, 2026), argued in
 * your_files/hidden-layer-design-2026-11-20.md:
 *
 *   1. Every game is DERIVED from its host page's own material and
 *      teaches that page's teaching by doing:
 *        - "Find the Day's Tone" on Frequency Governance (the Sound
 *          Observatory) — attunement: know the day's tone by ear.
 *        - "The Count" on 13 Moons Theory — the Pattern count itself,
 *          stepped by hand across moon boundaries and the Day Out of
 *          Time, every coordinate computed by PatternCalendar.
 *   2. The Spark accompanies the games (guide seat, never the
 *      opposition seat). Woven into live material: tones come from
 *      the Sound of the Day (SOFSound.chimePlan — today's seeded
 *      chimes) and from the keeper's own Spark's seed voice
 *      (SparkCompanion chirpFor / soundsFor). This module edits
 *      none of those files and keeps no second record: game
 *      keepsakes are canonical Life Atlas records, type "artifact"
 *      / subtype "hidden-keepsake", the garden pass's own shape
 *      (PR #166).
 *
 * THE FINDS ARE PARKED (Aaron, Nov 20, 2026: "The finds layer is
 * pointless right now"). The finds engine — the level curve, the
 * deterministic rolls, the placement table, the candidate builder
 * — remains below as pure functions, unit-tested and uncalled by
 * the browser path: no find spawns on any page, nothing renders
 * for finds, and only the two game rooms load this module at all.
 * Finds a keeper already kept stay in that keeper's Life Atlas
 * exactly as recorded; the layer adds nothing and deletes nothing.
 *
 * The pure functions (levelFor, rollFor, candidateFor, buildCountRound,
 * toneRoundFor, buildKeepsakeRecord) carry no DOM or storage
 * dependency and are unit-tested in tests/hidden-layer.test.js.
 */
(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.CodexHiddenLayer = api;
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function () {
    "use strict";

    const VERSION = "hidden-layer/1.0.0";

    const RECORD_TAG = "hidden-layer";
    const KEEPSAKE_TYPE = "artifact";
    const KEEPSAKE_SUBTYPE = "hidden-keepsake";
    const STATE_KEY = "sof.hidden-layer.v1";
    const SPARK_STORAGE_KEY = "sof.spark.v1";
    const MASTER_SOUND_KEY = "sof.spark.sound";

    /* ------------------------- hashing ------------------------- */

    function hashString(str) {
      let h = 0x811c9dc5;
      const s = String(str);
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
      }
      return h >>> 0;
    }

    function mulberry32(seed) {
      let a = seed >>> 0;
      return function () {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    /* One deterministic draw in [0, 1) from any salt string. */
    function hash01(salt) {
      return mulberry32(hashString(salt))();
    }

    /* ------------------------- the curve ------------------------- */

    const LEVELS = Object.freeze([
      Object.freeze({ name: "First Steps", maxFinds: 0, p: 0.85, assurance: 2 }),
      Object.freeze({ name: "Kindling", maxFinds: 1, p: 0.6, assurance: 3 }),
      Object.freeze({ name: "Walking", maxFinds: 4, p: 0.35, assurance: 5 }),
      Object.freeze({ name: "Deepening", maxFinds: 9, p: 0.18, assurance: 9 }),
      Object.freeze({ name: "Rare Air", maxFinds: 19, p: 0.09, assurance: 18 }),
      Object.freeze({ name: "Quiet Country", maxFinds: Infinity, p: 0.045, assurance: 36 })
    ]);

    function levelFor(findsKept) {
      const n = Math.max(0, Math.floor(Number(findsKept) || 0));
      return LEVELS.find(level => n <= level.maxFinds) || LEVELS[LEVELS.length - 1];
    }

    /* The spawn roll for one page on one day, from the keeper's seed.
     * Deterministic: the same seed, day, and page always roll alike. */
    function rollFor({ seed, civilDate, pageId }) {
      return hash01(`${seed}|hidden-layer:spawn|${civilDate}|${pageId}`);
    }

    /* Decide whether a find waits on this page today.
     * opportunitiesSinceFind counts opportunities BEFORE this one. */
    function shouldSpawn({ seed, civilDate, pageId, findsKept, opportunitiesSinceFind }) {
      const level = levelFor(findsKept);
      if (opportunitiesSinceFind + 1 >= level.assurance) return true;
      return rollFor({ seed, civilDate, pageId }) < level.p;
    }

    /* ------------------ the finds (parked) ------------------ */

    /* The finds engine rests here, uncalled by the browser path:
     * the placement table, the kindred lean, the word pool, the
     * teachings, and the candidate builder. Which kinds each page
     * offered in stage 1 — a page not listed offered nothing. */
    const PAGE_FINDS = Object.freeze({
      frequencies: Object.freeze(["tone-fragment"]),
      glossary: Object.freeze(["word"]),
      garden: Object.freeze(["pressed-leaf"]),
      moons: Object.freeze(["pressed-leaf"]),
      "equinox-passage": Object.freeze(["smooth-stone"])
    });

    /* A Spark leans toward its kindred kind — flavour, never a gate. */
    const KIND_LEAN = Object.freeze({
      fire: "tone-fragment",
      light: "tone-fragment",
      earth: "smooth-stone",
      water: "pressed-leaf",
      air: "word",
      shadow: "word"
    });
    const LEAN_WEIGHT = 1.5;

    /* The word pool: the Glossary page's own term cards, with the
     * page's own first-line definitions. The find teaches the word
     * it carries, in the page's own words. */
    const WORD_POOL = Object.freeze([
      Object.freeze({
        term: "Resonance",
        line: "A measurable or experienced response between patterns, materials, tones, ideas, environments, or people. Resonance does not automatically prove a cause; it identifies a relationship worth observing."
      }),
      Object.freeze({
        term: "Coherence",
        line: "The condition in which multiple parts of a system work together without unnecessary contradiction."
      }),
      Object.freeze({
        term: "Carrier",
        line: "A tone, phrase, symbol, page, rhythm, object, or repeated practice used to hold and transmit a pattern or intention through a larger process."
      }),
      Object.freeze({
        term: "Witness",
        line: "A dated record of an observation, experience, pattern, change, practice, or result. Witnessing separates what happened from what was later assumed about it."
      }),
      Object.freeze({
        term: "Remnant",
        line: "That which remains after distortion, pressure, loss, or erasure. Within the Codex, the Remnant is the preserved signal capable of remembering, rebuilding, and returning with greater clarity."
      }),
      Object.freeze({
        term: "Glyph",
        line: "A visual mark carrying compressed meaning. Glyphs may represent concepts, processes, relationships, gates, or classifications."
      }),
      Object.freeze({
        term: "Daily Witness",
        line: "A compact daily entry recording conditions, attention, actions, meaningful patterns, and what should be carried into the next day."
      }),
      Object.freeze({
        term: "Living Mirror",
        line: "A surface in the Codex that shows the keeper their own day, pattern, or record as it truly stands."
      })
    ]);

    const KIND_TEACHINGS = Object.freeze({
      "tone-fragment":
        "Attunement: a tone is known by ear, the way this room teaches — inspected, bounded, kept.",
      word:
        "The Name: a word carries compressed meaning, and keeping it is a small act of learning it.",
      "pressed-leaf":
        "The count, lived: days are tended like beds, and a leaf keeps the day it grew in.",
      "smooth-stone":
        "Stability under a moving sky: the sky moves; the Pattern remains stable — a stone is the stable thing.",
      "tone-kept":
        "Attunement, earned: the day's tone, found by ear and kept.",
      "day-marker":
        "The Pattern count: a day stepped by hand across the count's own turning."
    });

    function coordinateLabel(conv) {
      if (!conv) return "today";
      if (conv.isDayOutOfTime) return "the Day Out of Time";
      if (conv.moon && conv.day) {
        return `Moon ${conv.moon}${conv.moonName ? ` (${conv.moonName})` : ""} · Day ${conv.day} · Pattern Day ${conv.dayOfPatternYear}`;
      }
      return conv.civilDate || "today";
    }

    /* The candidate find for one page on one day. Deterministic from
     * (seed, civil date, page): the same find waits all day.
     * `chimePlan` is today's pitches from the Sound of the Day, when
     * the kind needs one; `conv` is today's PatternCalendar summary. */
    function candidateFor({ seed, civilDate, pageId, sparkKind, conv, chimePlan }) {
      const kinds = PAGE_FINDS[pageId];
      if (!kinds || !kinds.length) return null;

      const rand = mulberry32(hashString(`${seed}|hidden-layer:find|${civilDate}|${pageId}`));
      let kind = kinds[0];
      if (kinds.length > 1) {
        const lean = KIND_LEAN[sparkKind];
        const weights = kinds.map(k => (k === lean ? LEAN_WEIGHT : 1));
        const total = weights.reduce((a, b) => a + b, 0);
        let draw = rand() * total;
        kind = kinds[kinds.length - 1];
        for (let i = 0; i < kinds.length; i++) {
          draw -= weights[i];
          if (draw <= 0) {
            kind = kinds[i];
            break;
          }
        }
      } else {
        rand();
      }

      const findKey = `${civilDate}|${pageId}|${kind}`;
      const teaching = KIND_TEACHINGS[kind];
      const where = pageId;

      if (kind === "tone-fragment") {
        const plan = Array.isArray(chimePlan) && chimePlan.length ? chimePlan : [222, 264, 297, 333];
        const hz = Math.round(plan[Math.floor(rand() * plan.length)]);
        return {
          findKey,
          kind,
          where,
          teaching,
          name: `A tone fragment — ${hz} Hz`,
          detail: `One of the tones the Sound of the Day is sounding today, caught on ${coordinateLabel(conv)}.`,
          hz
        };
      }

      if (kind === "word") {
        const entry = WORD_POOL[Math.floor(rand() * WORD_POOL.length)];
        return {
          findKey,
          kind,
          where,
          teaching,
          name: `A word — ${entry.term}`,
          detail: entry.line,
          term: entry.term
        };
      }

      if (kind === "pressed-leaf") {
        return {
          findKey,
          kind,
          where,
          teaching,
          name: `A pressed leaf — ${conv && conv.moonName ? conv.moonName : "this moon"}`,
          detail: `Pressed between the days on ${coordinateLabel(conv)}. It keeps the day it grew in.`,
          moonName: conv ? conv.moonName || null : null
        };
      }

      /* smooth-stone */
      return {
        findKey,
        kind,
        where,
        teaching,
        name: "A smooth stone",
        detail: `River-smooth, and heavy for its size. Found on ${coordinateLabel(conv)}. The sky moves; the Pattern remains stable.`
      };
    }

    /* ------------------------- keepsake records ------------------------- */

    function buildKeepsakeRecord(input = {}, temporal = null) {
      const isGame = input.source === "game";
      const title = isGame
        ? `Keepsake — ${input.name || "won in play"}`
        : `Found — ${input.name || "a small thing"}`;

      return {
        type: KEEPSAKE_TYPE,
        subtype: KEEPSAKE_SUBTYPE,

        title,
        summary:
          input.detail ||
          "A keepsake from the site's hidden layer, held in the keeper's Life Atlas on this device. Nothing about it leaves this device.",

        temporal: temporal || {},

        tags: [RECORD_TAG, isGame ? "game-keepsake" : "spark-find"],

        provenance: {
          sourceType: "hidden-layer",
          sourceId: input.where || "",
          calculationAuthority: "PatternCalendar"
        },

        privacy: {
          visibility: "private",
          containsPersonalData: true,
          shareAllowed: false
        },

        payload: {
          hiddenLayer: {
            kind: input.kind || null,
            source: isGame ? "game" : "find",
            name: input.name || null,
            teaching: input.teaching || KIND_TEACHINGS[input.kind] || null,
            detail: input.detail || null,
            where: input.where || null,
            findKey: input.findKey || null,
            hz: input.hz || null,
            term: input.term || null,
            moonName: input.moonName || null,
            coordinate: input.coordinate || null
          }
        }
      };
    }

    /* ------------------------- the tone game ------------------------- */

    /* One round of Find the Day's Tone: the target is one of today's
     * chime pitches; the other two options are its nearest neighbours
     * in the same plan, so the ear must truly discriminate. */
    function toneRoundFor({ chimePlan, salt }) {
      const plan = [...new Set((chimePlan || []).map(hz => Math.round(hz)))].sort((a, b) => a - b);
      if (plan.length < 3) return null;

      const rand = mulberry32(hashString(`hidden-layer:tone-round|${salt}`));
      const targetIndex = Math.floor(rand() * plan.length);
      const target = plan[targetIndex];

      const byDistance = plan
        .map((hz, i) => ({ hz, d: Math.abs(Math.log2(hz / target)), i }))
        .filter(entry => entry.i !== targetIndex)
        .sort((a, b) => a.d - b.d);
      const distractors = byDistance.slice(0, 2).map(entry => entry.hz);

      const options = [target, ...distractors];
      /* Deterministic order from the same stream. */
      for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
      }

      return { target, options, correctIndex: options.indexOf(target) };
    }

    /* ------------------------- the count game ------------------------- */

    function stepLabel(conv) {
      if (!conv) return "—";
      if (conv.isDayOutOfTime) return "Day Out of Time";
      return `Moon ${conv.moon} · Day ${conv.day}`;
    }

    function addDaysISO(iso, days) {
      const date = new Date(`${iso}T12:00:00Z`);
      date.setUTCDate(date.getUTCDate() + days);
      return date.toISOString().slice(0, 10);
    }

    function convOn(calendar, iso) {
      return calendar.fromCivilDate({
        date: new Date(`${iso}T12:00:00Z`),
        timeZone: "UTC",
        boundaryMode: "midnight"
      });
    }

    /* One round of The Count. The run of four shown days is chosen so
     * the step INTO the answer crosses a turning of the count — a
     * moon's end, or the Day Out of Time — whenever such a run exists
     * within ±70 days of the anchor; otherwise the run nearest the
     * anchor that crosses a turning anywhere inside it; otherwise a
     * plain run at the anchor. Every label is a real conversion. */
    function buildCountRound(calendar, anchorISO) {
      if (!calendar || !anchorISO) return null;

      const runs = [];
      for (let offset = -70; offset <= 70; offset++) {
        const startISO = addDaysISO(anchorISO, offset);
        const convs = [0, 1, 2, 3, 4].map(step => convOn(calendar, addDaysISO(startISO, step)));
        if (convs.some(conv => !conv)) continue;

        const steps = convs.slice(0, 4);
        const answer = convs[4];
        const crossesIntoAnswer =
          answer.isDayOutOfTime ||
          (!steps[3].isDayOutOfTime && answer.day === 1) ||
          (steps[3].isDayOutOfTime && answer.day === 1 && answer.moon === 1);
        const crossesInside =
          steps.some((conv, i) => i > 0 && (conv.isDayOutOfTime || conv.day === 1)) ||
          steps[0].isDayOutOfTime;
        runs.push({ startISO, steps, answer, crossesIntoAnswer, crossesInside, distance: Math.abs(offset) });
      }
      if (!runs.length) return null;

      const chosen =
        runs.filter(run => run.crossesIntoAnswer).sort((a, b) => a.distance - b.distance)[0] ||
        runs.filter(run => run.crossesInside).sort((a, b) => a.distance - b.distance)[0] ||
        runs.sort((a, b) => a.distance - b.distance)[0];

      const answerLabel = stepLabel(chosen.answer);
      const dayAfter = convOn(calendar, addDaysISO(chosen.startISO, 5));
      const skipLabel = stepLabel(dayAfter);
      const last = chosen.steps[3];
      const boundaryLabel = last.isDayOutOfTime
        ? `Moon 13 · Day 28`
        : `Moon ${last.moon} · Day ${last.day + 1}`;

      const options = [...new Set([answerLabel, skipLabel, boundaryLabel])];
      return {
        startCivilDate: chosen.startISO,
        steps: chosen.steps.map(stepLabel),
        stepCoordinates: chosen.steps.map(conv => coordinateLabel(conv)),
        answer: answerLabel,
        answerCoordinate: coordinateLabel(chosen.answer),
        options,
        correctIndex: options.indexOf(answerLabel),
        crossesIntoAnswer: chosen.crossesIntoAnswer
      };
    }

    /* =========================== browser =========================== */

    const isBrowser =
      typeof document !== "undefined" && typeof window !== "undefined";

    function readSparkRecord() {
      try {
        const raw = window.localStorage.getItem(SPARK_STORAGE_KEY);
        if (!raw) return null;
        const record = JSON.parse(raw);
        if (!record || !record.seed) return null;
        const Core = window.SparkCompanion;
        if (Core && typeof Core.parseSeed === "function" && !Core.parseSeed(record.seed)) {
          return null;
        }
        return record;
      } catch {
        return null;
      }
    }

    function loadState() {
      try {
        return JSON.parse(window.localStorage.getItem(STATE_KEY)) || {};
      } catch {
        return {};
      }
    }

    function saveState(state) {
      try {
        window.localStorage.setItem(STATE_KEY, JSON.stringify(state));
      } catch {
        /* storage blocked: the layer simply rests */
      }
    }

    function resolveRepository() {
      try {
        const Repository = window.CodexLifeAtlasRepository;
        if (!Repository) return null;
        if (typeof Repository.createPersistentRepository === "function") {
          return Repository.createPersistentRepository();
        }
        if (typeof Repository.createRepository === "function") {
          return Repository.createRepository();
        }
      } catch {
        /* fall through */
      }
      return null;
    }

    function todayConversion() {
      const calendar = window.PatternCalendar;
      if (!calendar || typeof calendar.fromCivilDate !== "function") return null;
      let timeZone = "UTC";
      try {
        timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      } catch {
        /* keep UTC */
      }
      try {
        return calendar.fromCivilDate({ date: new Date(), timeZone, boundaryMode: "midnight" });
      } catch {
        return null;
      }
    }

    function temporalForNow(conv) {
      const Helpers = window.CodexRecordHelpers || window.RecordHelpers;
      if (Helpers && typeof Helpers.temporalFromConversion === "function" && conv) {
        try {
          return Helpers.temporalFromConversion(conv, new Date());
        } catch {
          /* fall through */
        }
      }
      if (!conv) return {};
      return {
        civilDate: conv.civilDate || null,
        patternYear: conv.patternYear || null,
        moon: conv.moon || null,
        moonDay: conv.day || null,
        patternDay: conv.dayOfPatternYear || null,
        outsideDay: Boolean(conv.isDayOutOfTime)
      };
    }

    function masterSoundOff() {
      try {
        return window.localStorage.getItem(MASTER_SOUND_KEY) === "off";
      } catch {
        return false;
      }
    }

    let audioCtx = null;
    function playTone(hz, family) {
      if (masterSoundOff()) return;
      try {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return;
        audioCtx = audioCtx || new Ctor();
        if (audioCtx.state === "suspended") audioCtx.resume();
        const type = { bell: "sine", hum: "triangle", pluck: "square", blip: "sine" }[family] || "sine";
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const now = audioCtx.currentTime;
        osc.type = type;
        osc.frequency.setValueAtTime(hz, now);
        if (family === "blip") {
          osc.frequency.exponentialRampToValueAtTime(Math.max(40, hz * 0.94), now + 0.5);
        }
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.14, now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 1);
      } catch {
        /* sound is a courtesy, never a requirement */
      }
    }

    function el(tag, className, text) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text != null) node.textContent = text;
      return node;
    }

    /* ------------------------- boot ------------------------- */

    async function boot() {
      const conv = todayConversion();
      const civilDate = conv ? conv.civilDate : new Date().toISOString().slice(0, 10);
      const record = readSparkRecord();
      const Core = window.SparkCompanion;
      const companion = record && Core ? Core.generate(record.seed) : null;
      const sparkName =
        record && Core && companion ? Core.displayName(record, companion) : "your Spark";

      /* The stored state is carried whole: a keeper's parked finds
       * fields ride along untouched in storage, and only the games
       * read or write anything here (their own gameDays). */
      const state = Object.assign({ gameDays: {} }, loadState());

      const repository = resolveRepository();

      /* ---- the games ---- */
      bootToneGame({ state, repository, conv, civilDate, companion, sparkName });
      bootCountGame({ state, repository, conv, civilDate, sparkName });
    }

    /* ------------------------- the tone game ------------------------- */

    function bootToneGame({ state, repository, conv, civilDate, companion, sparkName }) {
      const mount = document.querySelector('[data-hidden-layer-game="tone"]');
      if (!mount) return;

      const plan =
        window.SOFSound && typeof window.SOFSound.chimePlan === "function"
          ? window.SOFSound.chimePlan(8)
          : [174, 196, 222, 249, 264, 297, 333, 396];
      const family = companion && window.SparkCompanion
        ? (window.SparkCompanion.soundFor(companion) || {}).family
        : null;

      let round = toneRoundFor({ chimePlan: plan, salt: `${civilDate}|tone` });
      let selected = null;
      let won = false;

      mount.innerHTML = "";
      const box = el("div", "hl-game");
      box.appendChild(el("h2", "hl-game-title", "Find the Day's Tone"));
      box.appendChild(
        el(
          "p",
          "hl-game-line",
          "Listening play, in this room's own frame: bounded, comfortable, and you can stop whenever. " +
            "No claim rides on it — a tone here is a tone to know by ear, nothing more."
        )
      );
      const sparkLine = el(
        "p",
        "hl-game-spark",
        companion
          ? `${sparkName} hums the day's tone first. Then three tones sound — find the one that matches.`
          : "The day hums its tone first. Then three tones sound — find the one that matches."
      );
      box.appendChild(sparkLine);

      const status = el("p", "hl-game-status", "");
      status.setAttribute("aria-live", "polite");

      const hear = el("button", "hl-btn hl-btn-keep", "Hear the day's tone");
      hear.type = "button";
      hear.addEventListener("click", () => {
        if (round) playTone(round.target, family);
      });
      box.appendChild(hear);

      const optionsBox = el("div", "hl-game-options");
      const letters = ["A", "B", "C"];
      const optionButtons = [];
      if (round) {
        round.options.forEach((hz, i) => {
          const btn = el("button", "hl-btn hl-tone-btn", `Tone ${letters[i]}`);
          btn.type = "button";
          btn.addEventListener("click", () => {
            playTone(hz, family);
            selected = i;
            optionButtons.forEach((other, j) =>
              other.classList.toggle("is-selected", j === i)
            );
            status.textContent = `Tone ${letters[i]} — hear it again, or keep this answer.`;
          });
          optionButtons.push(btn);
          optionsBox.appendChild(btn);
        });
      }
      box.appendChild(optionsBox);

      const confirm = el("button", "hl-btn hl-btn-keep", "Keep this answer");
      confirm.type = "button";
      confirm.addEventListener("click", async () => {
        if (selected === null || !round) {
          status.textContent = "Hear a tone first, then choose.";
          return;
        }
        if (round.options[selected] === round.target) {
          if (!won) {
            won = true;
            status.textContent = companion
              ? `That's the one. ${sparkName} knew you would hear it.`
              : "That's the one — the day's own tone.";
            const gameKey = `tone|${civilDate}`;
            if (!state.gameDays[gameKey]) {
              state.gameDays[gameKey] = true;
              saveState(state);
              if (repository) {
                try {
                  await repository.put(
                    buildKeepsakeRecord(
                      {
                        kind: "tone-kept",
                        source: "game",
                        where: "frequencies",
                        name: `The day's tone — ${round.target} Hz`,
                        detail: `Found by ear in the Sound Observatory on ${coordinateLabel(conv)}.`,
                        teaching: KIND_TEACHINGS["tone-kept"],
                        hz: round.target,
                        coordinate: coordinateLabel(conv)
                      },
                      temporalForNow(conv)
                    )
                  );
                } catch {
                  /* a missed write never blocks the moment */
                }
              }
            }
          } else {
            status.textContent = "That's the one, again. The day is still sounding.";
          }
        } else {
          status.textContent = "Not that one — the day is still sounding. Hear the day's tone again, and try another.";
        }
      });
      box.appendChild(confirm);
      box.appendChild(status);
      mount.appendChild(box);
    }

    /* ------------------------- the count game ------------------------- */

    function bootCountGame({ state, repository, conv, civilDate, sparkName }) {
      const mount = document.querySelector('[data-hidden-layer-game="count"]');
      if (!mount) return;
      const calendar = window.PatternCalendar;
      if (!calendar) return;

      const round = buildCountRound(calendar, civilDate);
      if (!round) return;

      mount.innerHTML = "";
      const box = el("div", "hl-game");
      box.appendChild(el("h2", "hl-game-title", "The Count"));
      box.appendChild(
        el(
          "p",
          "hl-game-line",
          "This page states the count: thirteen moons of twenty-eight days, and the Day Out of Time between the years. " +
            "Here the hand performs it. The days step forward — what comes next?"
        )
      );
      if (sparkName && sparkName !== "your Spark") {
        box.appendChild(el("p", "hl-game-spark", `${sparkName} is counting with you.`));
      }

      const steps = el("ol", "hl-count-steps");
      for (const label of round.steps) {
        steps.appendChild(el("li", "hl-count-step", label));
      }
      steps.appendChild(el("li", "hl-count-step hl-count-next", "?"));
      box.appendChild(steps);

      const status = el("p", "hl-game-status", "");
      status.setAttribute("aria-live", "polite");

      const optionsBox = el("div", "hl-game-options");
      let won = false;
      round.options.forEach(label => {
        const btn = el("button", "hl-btn hl-count-btn", label);
        btn.type = "button";
        btn.addEventListener("click", async () => {
          if (label === round.answer) {
            status.textContent = `Yes — ${round.answer}. ${round.answerCoordinate}.`;
            if (!won) {
              won = true;
              const gameKey = `count|${civilDate}`;
              if (!state.gameDays[gameKey]) {
                state.gameDays[gameKey] = true;
                saveState(state);
                if (repository) {
                  try {
                    await repository.put(
                      buildKeepsakeRecord(
                        {
                          kind: "day-marker",
                          source: "game",
                          where: "thirteen-moons",
                          name: `A day-marker — ${round.answer}`,
                          detail: `Stepped by hand in The Count on ${coordinateLabel(conv)}: the day after the shown run is ${round.answerCoordinate}.`,
                          teaching: KIND_TEACHINGS["day-marker"],
                          coordinate: round.answerCoordinate
                        },
                        temporalForNow(conv)
                      )
                    );
                  } catch {
                    /* a missed write never blocks the moment */
                  }
                }
              }
            }
          } else {
            status.textContent = "Not that day. Count the run again — watch the moon's end.";
          }
        });
        optionsBox.appendChild(btn);
      });
      box.appendChild(optionsBox);
      box.appendChild(status);
      mount.appendChild(box);
    }

    if (isBrowser) {
      /* Boot at DOMContentLoaded, never at script execution: some
       * host pages (the Theory family) load PatternCalendar as
       * deferred body-end scripts, which run after this module's own
       * deferred tag. DOMContentLoaded fires after every deferred
       * script has run, so the calendar, the companion core, and the
       * Sound of the Day are all standing when the layer wakes. */
      if (document.readyState === "complete") {
        boot().catch(() => {});
      } else {
        document.addEventListener("DOMContentLoaded", () => {
          boot().catch(() => {});
        });
      }
    }

    return {
      VERSION,
      LEVELS,
      PAGE_FINDS,
      KIND_LEAN,
      WORD_POOL,
      KIND_TEACHINGS,
      levelFor,
      rollFor,
      shouldSpawn,
      candidateFor,
      buildKeepsakeRecord,
      toneRoundFor,
      buildCountRound,
      stepLabel,
      coordinateLabel,
      hashString,
      mulberry32,
      hash01
    };
  }
);
