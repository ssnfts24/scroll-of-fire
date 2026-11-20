/**
 * Codex Life Atlas — Record Helpers (the one record layer, first brick)
 *
 * Build-it-once foundation F1: every door that writes a Life Atlas
 * record cleans it the same way, stamps it with the same temporal
 * shape, resolves the same repository, and announces changes with the
 * same event. These helpers used to be copy-pasted into each door —
 * day-notes.js, manifest-practice.js, shroom-garden.js (and the
 * repository resolver into presence-guidance.js) — and the copies had
 * already drifted. They live here now, once. A door imports this
 * module; it does not re-define the helpers.
 *
 * Drift resolutions (deliberate, pinned by tests/record-helpers.test.js):
 *
 * - cleanText: the day-notes copy collapsed internal whitespace runs
 *   to one space; the manifest-practice / shroom-garden copies did
 *   not. The unified behavior does NOT collapse — it trims and caps
 *   only — because collapsing rewrites what a keeper actually wrote,
 *   and every existing call site cleans a single-line field where a
 *   trim is all the shaping the shape needs. The default cap is 4000,
 *   the largest of the drifted defaults (2000 / 4000), so the shared
 *   default preserves the most content; every existing call site
 *   passes its own explicit cap, unchanged.
 *
 * - cleanNullable: the drifted defaults were 80 (day-notes) and 2000
 *   (the other two). Its real work is short fields — timezone,
 *   boundary mode, civil date, labels — so the unified default is 80.
 *   Every existing call site passes an explicit cap, unchanged.
 *
 * - todayISOInZone: three copies formatted with en-CA and returned
 *   null on failure; living-moon-theme assembled the same date from
 *   parts; homepage-sphere added an injectable `now` and fell back to
 *   the UTC date on failure. The unified form assembles from parts,
 *   accepts the injectable `now`, and returns null on failure (the
 *   majority behavior, and the honest one: a failed zone lookup has
 *   no date to offer). Its five current homes ride the site-wide
 *   page shell, so they migrate to this module with that shell work;
 *   the helper is here, tested, when they do.
 *
 * This module has no DOM, network, or storage dependency of its own:
 * notifyRecordsChanged dispatches only where a document/window
 * exists, and the repository resolver reads the page's Atlas runtime
 * or repository globals at call time, exactly as the doors did.
 */
(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.CodexRecordHelpers = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "record-helpers/1.0.0";

  const RECORDS_CHANGED_EVENT = "sof:life-atlas-records-changed";

  /* --------------------------- text cleaning --------------------------- */

  function cleanText(value, max = 4000) {
    if (value === null || value === undefined) return "";
    return String(value).trim().slice(0, max);
  }

  function cleanNullable(value, max = 80) {
    const cleaned = cleanText(value, max);
    return cleaned || null;
  }

  function finiteOrNull(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  /* ------------------------- the temporal shape ------------------------ */

  /*
   * PatternCalendar conversion -> Life Atlas temporal shape.
   * patternYear is the anchor's civil year, patternDay is the
   * conversion's dayOfPatternYear, and a day outside the counted year
   * carries null coordinates with outsideDay set. Every door stamps
   * records with this one mapping, so a note, a practice session, a
   * garden tend, and a planner entry for the same day are found by
   * the same queries.
   */
  function temporalFromConversion(conversion, instant = null) {
    if (!conversion || typeof conversion !== "object") return null;

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
      const when = instant instanceof Date ? instant : new Date(instant);

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

  /* ------------------------------ the day ------------------------------ */

  function todayISOInZone(timeZone, now = new Date()) {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).formatToParts(now);

      const get = type => (parts.find(part => part.type === type) || {}).value;
      const year = get("year");
      const month = get("month");
      const day = get("day");

      if (year && month && day) return `${year}-${month}-${day}`;
    } catch {
      /* fall through — a failed zone lookup has no date to offer */
    }

    return null;
  }

  /* ------------------------ repository resolution ----------------------- */

  /*
   * The doors' shared idiom, once: the Atlas runtime when the page
   * provides one, a direct persistent repository otherwise, an
   * in-memory repository when IndexedDB is unavailable, and null
   * when the page carries no Atlas at all. Each door calls
   * createRepositoryResolver() once and keeps the returned function;
   * the promise is cached per door, exactly as the copies cached it.
   */
  function createRepositoryResolver() {
    let repositoryPromise = null;

    return function resolveRepository() {
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
    };
  }

  /* --------------------------- change notices --------------------------- */

  function notifyRecordsChanged(detail) {
    if (typeof document !== "undefined") {
      document.dispatchEvent(
        new CustomEvent(RECORDS_CHANGED_EVENT, { detail })
      );
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(RECORDS_CHANGED_EVENT, { detail })
      );
    }
  }

  return {
    VERSION,
    RECORDS_CHANGED_EVENT,
    cleanText,
    cleanNullable,
    finiteOrNull,
    temporalFromConversion,
    todayISOInZone,
    createRepositoryResolver,
    notifyRecordsChanged
  };
});
