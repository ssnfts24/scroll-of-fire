"use strict";

/**
 * The Pattern Quests — the quest frame, rung 1.
 *
 * A quest is the instrument used playfully. The Spark asks a
 * question that can only be answered by reading the Sphere —
 * not trivia, not general knowledge: a question whose answer
 * lives in the keeper's own calendar and record. The keeper
 * makes a one-tap prediction, hunts the answer out of the
 * instrument itself (the games), and the reveal is stated as a
 * count. A quest ends with an answer card in the Life Atlas —
 * a keepsake of attention, never points, never a score.
 *
 * The frame: offer → setting (the question) → one-tap
 * prediction → hunt → reveal, stated as a count → answer-card
 * keepsake → one-line close.
 *
 *   - The Spark offers at most one quest a day, and a kind the
 *     keeper has turned away for good is never offered again.
 *     "Not today" is free and costs nothing.
 *   - Hints are free. The Spark never just gives the answer —
 *     the answer must be read out of the instrument, or it
 *     teaches nothing.
 *   - A hunt not finished leaves no card. In Catch the turning,
 *     the minute survives only as an attention frame: a turning
 *     not caught is not recorded — only catches are written.
 *
 * Rung 1 reframes the three built Observatory games: Find the
 * day (hunt), Echo, and Catch the turning. Later rungs — the
 * garden's quests, cross-Moon questions, the pattern questions —
 * come in their own builds, behind their own word.
 *
 * Pure core + a thin page wiring in sphere-play.js. Records go
 * through the shared Life Atlas helpers, the same door the
 * garden and the day-notes use. The Spark is named, never
 * gendered.
 */
(function registerPatternQuests(globalObject) {
  const root = typeof globalObject !== "undefined" ? globalObject : globalThis;
  const helpers =
    root.CodexRecordHelpers ||
    (typeof require === "function"
      ? require("./life-atlas/record-helpers.js")
      : null);

  const cleanText = helpers?.cleanText || ((value) => String(value ?? "").trim());
  const finiteOrNull = helpers?.finiteOrNull || ((value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  });

  const VERSION = "pattern-quests/1.0.0";
  const STORAGE_KEY = "sof.pattern-quests.v1";
  const ANSWER_SUBTYPE = "quest-answer";
  const ANSWER_TAGS = Object.freeze(["pattern-quest", "quest-answer"]);

  /**
   * The rung-1 quests. `kind` is the SphereSpark play kind the
   * game already writes; the quest is the frame around it.
   */
  const QUESTS = Object.freeze([
    Object.freeze({
      id: "find-the-day",
      kind: "hunt",
      rung: 1,
      title: "Find the day",
      offer: "A day is hidden somewhere in the year. Find where it stands in the count.",
      teach: "The year is a count of 364 days, and every day has a place in it.",
      close: "You can find any day in the year now. The count is a place, and you stood in it."
    }),
    Object.freeze({
      id: "echo",
      kind: "echo",
      rung: 1,
      title: "Echo",
      offer: "Your Spark sings a short motif. Hear it, hold it, play it back.",
      teach: "Listening is a kind of keeping: what you hold in memory, you carry.",
      close: "You held the Spark's song in memory and gave it back whole. Listening is keeping."
    }),
    Object.freeze({
      id: "catch-the-turning",
      kind: "turning",
      rung: 1,
      title: "Catch the turning",
      offer: "The day's light turns four times. Catch the turning when it comes.",
      teach: "Attention is the first act of witness: a day turns whether or not anyone notices.",
      close: "You noticed the day turn. Attention is the first act of witness."
    })
  ]);

  function questFor(idOrKind) {
    return (
      QUESTS.find(q => q.id === idOrKind || q.kind === idOrKind) || null
    );
  }

  /**
   * The question the Spark asks, set from the hunt's own facts —
   * a question answerable only by reading the instrument.
   * facts: { targetMoon, targetDay } for the hunt,
   * { } for echo (the motif is only heard, never seen),
   * { } for the turning.
   */
  function questionFor(quest, facts = {}) {
    if (!quest) return null;
    if (quest.kind === "hunt") {
      const moon = finiteOrNull(facts.targetMoon);
      const day = finiteOrNull(facts.targetDay);
      if (moon == null || day == null) return null;
      return `Where does Moon ${moon} · Day ${day} stand in the count of the year?`;
    }
    if (quest.kind === "echo") {
      return "How many notes does your Spark's motif sing?";
    }
    if (quest.kind === "turning") {
      return "How many times does the day's light turn?";
    }
    return null;
  }

  /* The one-tap predictions offered for each quest. */
  function predictionOptionsFor(quest) {
    if (!quest) return [];
    if (quest.kind === "hunt") {
      return [
        { id: "first-half", label: "In the first half of the year" },
        { id: "second-half", label: "In the second half of the year" }
      ];
    }
    if (quest.kind === "echo") {
      return [
        { id: "2", label: "2 notes" },
        { id: "3", label: "3 notes" },
        { id: "4", label: "4 notes" }
      ];
    }
    if (quest.kind === "turning") {
      return [
        { id: "2", label: "Twice a day" },
        { id: "4", label: "Four times a day" },
        { id: "6", label: "Six times a day" }
      ];
    }
    return [];
  }

  /* A free hint: it points at the instrument, never at the
   * answer. The Spark never just gives the answer. */
  function hintFor(quest) {
    if (!quest) return null;
    if (quest.kind === "hunt") {
      return "The Sphere's face reads the day under your hand. Walk the Moons and watch the Pattern Day count climb — the target's place is written there.";
    }
    if (quest.kind === "echo") {
      return "Listen for the motif as one phrase, not note by note. Hear its shape, then play the shape back.";
    }
    if (quest.kind === "turning") {
      return "The day's bands are dawn, day, dusk and night. Arm the catch and watch which band the light is turning into.";
    }
    return null;
  }

  /**
   * Judge a finished hunt against the keeper's prediction. The
   * reveal is always stated as a count — the number the hunt
   * itself produced.
   *
   * facts: hunt — { patternDay }; echo — { notes };
   * turning — { band } (the day turns four times, always).
   */
  function judge(quest, predictionId, facts = {}) {
    if (!quest) return null;
    if (quest.kind === "hunt") {
      const patternDay = finiteOrNull(facts.patternDay);
      if (patternDay == null) return null;
      const half = patternDay <= 182 ? "first-half" : "second-half";
      return {
        correct: predictionId === half,
        count: patternDay,
        revealText:
          `Moon ${finiteOrNull(facts.targetMoon)} · Day ${finiteOrNull(facts.targetDay)} stands at Pattern Day ${patternDay} of 364 — the ${half === "first-half" ? "first" : "second"} half of the year.`
      };
    }
    if (quest.kind === "echo") {
      const notes = finiteOrNull(facts.notes);
      if (notes == null) return null;
      return {
        correct: Number(predictionId) === notes,
        count: notes,
        revealText: `The motif sang ${notes} note${notes === 1 ? "" : "s"} — and you held every one.`
      };
    }
    if (quest.kind === "turning") {
      const band = cleanText(facts.band, 20) || "the turning";
      return {
        correct: Number(predictionId) === 4,
        count: 4,
        revealText: `The day's light turns four times — dawn, day, dusk, night. You caught the turn to ${band}: one of the day's four turnings, witnessed.`
      };
    }
    return null;
  }

  /**
   * The offer memory: which quest kinds the keeper has turned
   * away for good, and the day the last offer was made. Pure
   * and immutable — every change returns a new memory. One
   * offer a day; a dismissed kind is never offered again;
   * "not today" costs nothing and closes nothing.
   */
  function emptyMemory() {
    return { dismissedKinds: [], lastOfferCivilDate: null, offerCount: 0 };
  }

  function parseMemory(text) {
    try {
      const parsed = JSON.parse(String(text || ""));
      if (!parsed || typeof parsed !== "object") return emptyMemory();
      return {
        dismissedKinds: Array.isArray(parsed.dismissedKinds)
          ? [...new Set(parsed.dismissedKinds.map(v => cleanText(v, 20)).filter(Boolean))]
          : [],
        lastOfferCivilDate: cleanText(parsed.lastOfferCivilDate, 20) || null,
        offerCount: Math.max(0, Math.floor(Number(parsed.offerCount) || 0))
      };
    } catch {
      return emptyMemory();
    }
  }

  function serializeMemory(memory) {
    const m = memory || emptyMemory();
    return JSON.stringify({
      dismissedKinds: Array.isArray(m.dismissedKinds) ? m.dismissedKinds : [],
      lastOfferCivilDate: m.lastOfferCivilDate || null,
      offerCount: Math.max(0, Math.floor(Number(m.offerCount) || 0))
    });
  }

  /* Which quest kind to offer today, or null: no offer on a day
   * one was already made, and never a dismissed kind. The offer
   * rotates through the remaining kinds by the count of offers
   * made, so no single game wears out its welcome. */
  function chooseOfferKind(memory, civilDate, kinds) {
    const m = memory || emptyMemory();
    if (!civilDate || m.lastOfferCivilDate === civilDate) return null;
    const pool = (Array.isArray(kinds) && kinds.length ? kinds : QUESTS.map(q => q.kind))
      .filter(kind => !(m.dismissedKinds || []).includes(kind));
    if (!pool.length) return null;
    return pool[(m.offerCount || 0) % pool.length];
  }

  function noteOffer(memory, civilDate) {
    const m = memory || emptyMemory();
    return {
      dismissedKinds: [...(m.dismissedKinds || [])],
      lastOfferCivilDate: civilDate || m.lastOfferCivilDate || null,
      offerCount: (m.offerCount || 0) + 1
    };
  }

  /* "Not today": today's offer is spent, nothing else changes. */
  function deferOffer(memory, civilDate) {
    const m = memory || emptyMemory();
    return {
      dismissedKinds: [...(m.dismissedKinds || [])],
      lastOfferCivilDate: civilDate || m.lastOfferCivilDate || null,
      offerCount: m.offerCount || 0
    };
  }

  /* "Don't offer this kind again": kept forever, quietly. */
  function dismissKind(memory, kind) {
    const m = memory || emptyMemory();
    const kinds = new Set(m.dismissedKinds || []);
    if (kind) kinds.add(kind);
    return {
      dismissedKinds: [...kinds],
      lastOfferCivilDate: m.lastOfferCivilDate || null,
      offerCount: m.offerCount || 0
    };
  }

  /**
   * The answer card — the quest's keepsake in the Life Atlas.
   * An artifact record like the garden's keepsakes: a thing
   * kept, with the question, the keeper's prediction, whether
   * it stood, and the reveal's count written in it. A missed
   * prediction is kept too — the card records the learning,
   * not a score.
   */
  function buildAnswerCardRecord(input = {}, temporal = {}) {
    const quest = questFor(input.questId || input.kind);
    if (!quest) return null;
    const prediction = predictionOptionsFor(quest).find(o => o.id === String(input.predictionId || ""));
    const moon = finiteOrNull(temporal.moon);
    const patternDay = finiteOrNull(temporal.patternDay);
    const patternYear = finiteOrNull(temporal.patternYear);
    const civilDate = cleanText(temporal.civilDate, 20) || null;
    /* The same record shape the garden's builders write: a
     * plain Life Atlas record the repository takes as it stands
     * and the schema completes. */
    return {
      type: "artifact",
      subtype: ANSWER_SUBTYPE,
      title: `Answer card — ${quest.title}`,
      summary:
        `A Pattern Quest answer card. ${cleanText(input.question, 160)} ` +
        `The reveal, as a count: ${cleanText(input.reveal, 220)}`,
      temporal: temporal || {},
      tags: [...ANSWER_TAGS],
      provenance: {
        sourceType: "pattern-quest",
        sourceId: "living-time-sphere.html",
        calculationAuthority: "PatternCalendar"
      },
      privacy: {
        visibility: "private",
        containsPersonalData: true,
        shareAllowed: false
      },
      payload: {
        patternQuest: {
          version: 1,
          action: "answer-card",
          questId: quest.id,
          kind: quest.kind,
          rung: quest.rung,
          question: cleanText(input.question, 160) || null,
          prediction: prediction ? prediction.label : cleanText(input.prediction, 80) || null,
          predictionId: cleanText(input.predictionId, 20) || null,
          predictionCorrect: Boolean(input.predictionCorrect),
          reveal: cleanText(input.reveal, 220) || null,
          count: finiteOrNull(input.count),
          moon,
          patternDay,
          patternYear,
          civilDate
        }
      }
    };
  }

  function isAnswerCard(record) {
    return Boolean(
      record &&
      record.type === "artifact" &&
      record.subtype === ANSWER_SUBTYPE &&
      Array.isArray(record.tags) &&
      record.tags.includes("pattern-quest")
    );
  }

  /* The keeper's answer cards, newest first — the shelf the
   * play room shows under the games. */
  function foldAnswerCards(records) {
    const list = Array.isArray(records) ? records : [];
    return list
      .filter(isAnswerCard)
      .slice()
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .map(record => {
        const p = record.payload?.patternQuest || {};
        const quest = questFor(p.questId || p.kind);
        return {
          recordId: record.id || null,
          questId: p.questId || null,
          kind: p.kind || null,
          title: quest ? quest.title : record.title || "A quest",
          question: p.question || null,
          prediction: p.prediction || null,
          predictionCorrect: Boolean(p.predictionCorrect),
          reveal: p.reveal || null,
          count: finiteOrNull(p.count),
          civilDate: p.civilDate || record.temporal?.civilDate || null
        };
      });
  }

  const api = {
    VERSION,
    STORAGE_KEY,
    QUESTS,
    ANSWER_SUBTYPE,
    questFor,
    questionFor,
    predictionOptionsFor,
    hintFor,
    judge,
    emptyMemory,
    parseMemory,
    serializeMemory,
    chooseOfferKind,
    noteOffer,
    deferOffer,
    dismissKind,
    buildAnswerCardRecord,
    isAnswerCard,
    foldAnswerCards
  };

  root.CodexPatternQuests = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
