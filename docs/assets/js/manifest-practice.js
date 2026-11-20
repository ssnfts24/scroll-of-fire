/**
 * Manifest Practice Loop — Seal → Life Atlas → Calendar / Sphere markers
 *
 * The Manifest — Remnant Visual Exercise (teach.html) has always ended in
 * "Seal → Ledger". The on-page ledger is a localStorage list; the seal
 * landed nowhere living. This module closes the loop:
 *
 *   1. On seal, the session is written to the canonical Life Atlas
 *      repository (CodexLifeAtlasRepository — the same store the Sphere,
 *      planner, and calendar projection read). No parallel store.
 *   2. The record is a canonical LifeRecord: type "event" (the schema's
 *      frozen type list has no practice type) with subtype
 *      "practice-session" — the schema's type + subtype extension path —
 *      and the session detail under payload.manifestPractice.
 *   3. Its temporal coordinate is read from PatternCalendar (the same
 *      converter the canonical cursor delegates to), never hand-computed,
 *      and persisted with the Life Atlas convention: temporal.patternYear
 *      is the anchor (alignment) civil year, not PatternCalendar's
 *      internal ordinal year.
 *   4. Days holding sealed sessions carry a special placement marker:
 *      a gold glyph in the Sphere day-zoom panel (rendered by
 *      living-time-sphere-day-zoom.js from the same records) and a
 *      kind-glyphed marker on the 13 Moons calendar cells (decorated
 *      here from the Atlas repository at render).
 *   5. A read-only "This Moon" summary counts what was sealed. It is an
 *      observed record of the visitor's own sessions — nothing is
 *      inferred and no effect is claimed. Ξ is stored as the console's
 *      coherence estimate, labeled as such.
 *
 * Records are browser-local like every Life Atlas record, and they ride
 * the existing Atlas export/backup (repository export/import) unchanged.
 *
 * The pure functions (buildSessionRecord, isPracticeSession,
 * markedPatternDays, summarizeMoon, temporalFromConversion) carry no DOM
 * or storage dependency and are unit-tested in
 * tests/manifest-practice.test.js.
 */
(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.CodexManifestPractice = api;
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function () {
    "use strict";

    const VERSION = "manifest-practice/1.0.0";

    const RECORD_TYPE = "event";
    const RECORD_SUBTYPE = "practice-session";
    const RECORD_TAG = "manifest-practice";

    const SESSION_KINDS = Object.freeze([
      "practice",
      "craft",
      "working"
    ]);

    const MARKER_GLYPH = "🜚";

    const KIND_GLYPHS = Object.freeze({
      practice: "🜚",
      craft: "◆",
      working: "✦"
    });

    const XI_LABEL =
      "console coherence estimate (Ξ) — the exercise console's own number, not a measured effect";

        /* The one record layer: record cleaning, the temporal shape,
     * repository resolution, and change notices live in
     * life-atlas/record-helpers.js (CodexRecordHelpers) — one shared
     * module for every door. Do not re-define them here. */
    const RecordHelpers =
      (typeof globalThis !== "undefined" ? globalThis.CodexRecordHelpers : null) ||
      (typeof module === "object" && module.exports
        ? (() => {
            try {
              return require("./life-atlas/record-helpers.js");
            } catch {
              return null;
            }
          })()
        : null);

    if (!RecordHelpers) {
      throw new Error(
        "CodexRecordHelpers is required — load life-atlas/record-helpers.js first."
      );
    }

    const cleanText = RecordHelpers.cleanText;
    const cleanNullable = RecordHelpers.cleanNullable;
    const finiteOrNull = RecordHelpers.finiteOrNull;
    const temporalFromConversion = RecordHelpers.temporalFromConversion;
    const notifyRecordsChanged = RecordHelpers.notifyRecordsChanged;
    const resolveRepository = RecordHelpers.createRepositoryResolver();

    /* ------------------------- pure helpers ------------------------- */


    

    function sessionKindOf(record) {
      const kind =
        record?.payload?.manifestPractice?.sessionKind;

      return SESSION_KINDS.includes(kind)
        ? kind
        : "practice";
    }

    function isPracticeSession(record) {
      if (!record || typeof record !== "object") {
        return false;
      }

      if (record.subtype !== RECORD_SUBTYPE) {
        return false;
      }

      return Boolean(
        record.payload?.manifestPractice ||
        (Array.isArray(record.tags) &&
          record.tags.includes(RECORD_TAG))
      );
    }


    /**
     * Read today's (or any instant's) temporal coordinate from the
     * canonical converter. Returns null when PatternCalendar is not
     * loaded — callers degrade to "no stamp" rather than inventing one.
     */
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
        temporal.moon !== null ? `Moon ${temporal.moon}` : "Moon —";

      const day =
        temporal.moonDay !== null
          ? `Day ${temporal.moonDay}`
          : "Day —";

      return `${moon} · ${day} · Pattern Day ${temporal.patternDay}`;
    }

    /**
     * Build the (pre-normalization) LifeRecord input for a sealed
     * session. The canonical schema normalizes and validates this when
     * the repository stores it; unknown types are impossible here by
     * construction (type is the frozen-list "event").
     *
     * Fields the console cannot supply stay null — notably
     * durationSeconds: the exercise console tracks no session timer,
     * so no duration is recorded rather than an invented one.
     */
    function buildSessionRecord(input = {}, temporal = null) {
      const kind = SESSION_KINDS.includes(input.sessionKind)
        ? input.sessionKind
        : "practice";

      const intention = cleanText(input.intention, 1000);

      const carriers = [
        ...new Set(
          (Array.isArray(input.carriers) ? input.carriers : [])
            .map(finiteOrNull)
            .filter(value => value !== null && value > 0)
        )
      ].sort((a, b) => a - b);

      const xiRaw = finiteOrNull(input.xi);
      const xi =
        xiRaw === null
          ? null
          : Math.max(0, Math.min(1, xiRaw));

      const visualMode =
        input.visualMode && typeof input.visualMode === "object"
          ? {
              value: cleanNullable(input.visualMode.value, 40),
              label: cleanNullable(input.visualMode.label, 80)
            }
          : null;

      const title =
        cleanText(input.title, 140) ||
        (intention
          ? intention.slice(0, 80)
          : `Manifest ${kind} session`);

      const witnessNote = cleanNullable(input.witnessNote, 2000);
      const materials = cleanNullable(input.materials, 500);

      return {
        type: RECORD_TYPE,
        subtype: RECORD_SUBTYPE,

        title,
        summary:
          witnessNote ||
          (materials ? `Materials: ${materials}` : ""),

        temporal: temporal || {},

        tags: [RECORD_TAG, kind],

        provenance: {
          sourceType: "manifest-visual-exercise",
          sourceId: "teach.html#manifest",
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
            sealedVia: "Seal → Ledger (Manifest — Remnant Visual Exercise)",

            intention,
            sessionKind: kind,

            carriersHz: carriers,
            sequencePath: cleanNullable(input.sequencePath, 200),

            visualMode,
            seed: finiteOrNull(input.seed),

            breathPattern: cleanNullable(input.breathPattern, 80),

            durationSeconds: finiteOrNull(input.durationSeconds),

            xi: {
              value: xi,
              label: XI_LABEL
            },

            materials,
            witnessNote
          }
        }
      };
    }

    /**
     * Pure marker logic: given records, which Pattern Days are marked,
     * and with what. Returns a Map keyed "patternYear:patternDay".
     * Sessions sealed on outside days (Day Out of Time) carry no
     * Pattern Day and so cannot take a day marker; they still count in
     * summaries by civil date / moon filters where applicable.
     */
    function markedPatternDays(records = []) {
      const marked = new Map();

      for (const record of Array.isArray(records) ? records : []) {
        if (!isPracticeSession(record)) continue;

        const year = finiteOrNull(record.temporal?.patternYear);
        const day = finiteOrNull(record.temporal?.patternDay);

        if (year === null || day === null || day < 1 || day > 364) {
          continue;
        }

        const key = `${year}:${day}`;

        if (!marked.has(key)) {
          marked.set(key, {
            patternYear: year,
            patternDay: day,
            count: 0,
            kinds: [],
            recordIds: []
          });
        }

        const entry = marked.get(key);
        const kind = sessionKindOf(record);

        entry.count += 1;

        if (!entry.kinds.includes(kind)) {
          entry.kinds.push(kind);
        }

        entry.recordIds.push(record.id || null);
      }

      return marked;
    }

    /**
     * Read-only summary of one Moon's sealed sessions, computed from
     * records alone. Observed counts only — no inference, no claims.
     */
    function summarizeMoon(records = [], { patternYear = null, moon = null } = {}) {
      const year = finiteOrNull(patternYear);
      const moonNumber = finiteOrNull(moon);

      const sessions = (Array.isArray(records) ? records : []).filter(
        record => {
          if (!isPracticeSession(record)) return false;
          if (year !== null && record.temporal?.patternYear !== year) {
            return false;
          }
          if (moonNumber !== null && record.temporal?.moon !== moonNumber) {
            return false;
          }
          return true;
        }
      );

      const byKind = { practice: 0, craft: 0, working: 0 };
      const carrierCounts = new Map();

      for (const session of sessions) {
        byKind[sessionKindOf(session)] += 1;

        const carriers =
          session.payload?.manifestPractice?.carriersHz;

        for (const hz of Array.isArray(carriers) ? carriers : []) {
          const value = finiteOrNull(hz);
          if (value === null) continue;
          carrierCounts.set(value, (carrierCounts.get(value) || 0) + 1);
        }
      }

      const marked = markedPatternDays(sessions);

      return {
        patternYear: year,
        moon: moonNumber,
        count: sessions.length,
        byKind,
        carriers: [...carrierCounts.entries()]
          .map(([hz, count]) => ({ hz, count }))
          .sort((a, b) => b.count - a.count || a.hz - b.hz),
        daysMarked: marked.size,
        patternDays: [...marked.values()]
          .map(entry => entry.patternDay)
          .sort((a, b) => a - b)
      };
    }


    
    function parseHzActive(text) {
      const match = String(text || "").match(/(\d+(?:\.\d+)?)\s*Hz\s+active/i);
      return match ? Number(match[1]) : null;
    }

    /**
     * Read the exercise console's live state from the DOM at seal time.
     * Only values the console actually holds are read; the seed comes
     * from the console's own window.__sofManifestSeed getter (the seed
     * is otherwise closure-private to the console script).
     */
    function readConsoleState(doc = document) {
      const value = id => doc.getElementById(id)?.value ?? "";
      const text = id => doc.getElementById(id)?.textContent ?? "";

      const activeHz = parseHzActive(text("toneNow"));

      const seqButton = doc.querySelector(".seq-btn.active");
      const seqReadout = cleanText(
        text("seqReadout").replace(/^Sequence:\s*/i, ""),
        200
      );

      const sequencePath =
        (seqButton ? cleanText(seqButton.textContent, 200) : "") ||
        (seqReadout && seqReadout !== "—" ? seqReadout : "") ||
        null;

      const visMode = doc.getElementById("visMode");
      const breathPat = doc.getElementById("breathPat");

      const xiText =
        text("hudXi") || text("xiOut");
      const xiMatch = xiText.match(/(\d+(?:\.\d+)?)/);

      let seed = null;

      try {
        if (typeof window !== "undefined" &&
            typeof window.__sofManifestSeed === "function") {
          seed = window.__sofManifestSeed();
        }
      } catch {
        seed = null;
      }

      return {
        intention: cleanText(value("rmnLine"), 1000),
        carriers: activeHz !== null ? [activeHz] : [],
        sequencePath,
        visualMode: visMode
          ? {
              value: visMode.value,
              label:
                visMode.options?.[visMode.selectedIndex]?.textContent?.trim() ||
                visMode.value
            }
          : null,
        seed,
        breathPattern: breathPat
          ? cleanText(
              breathPat.options?.[breathPat.selectedIndex]?.textContent || breathPat.value,
              80
            )
          : null,
        xi: xiMatch ? Number(xiMatch[1]) : null,
        sessionKind: value("mpKind") || "practice",
        materials: value("mpMaterials"),
        witnessNote: value("mpNote"),

        /* The console tracks no session timer; duration stays null. */
        durationSeconds: null
      };
    }

    function setSealStatus(message) {
      if (typeof document === "undefined") return;

      const el = document.getElementById("mpSealStatus");
      if (el) el.textContent = message;
    }

    async function sealSessionFromConsole() {
      if (typeof document === "undefined") return null;

      const state = readConsoleState(document);

      if (!state.intention) {
        /* The console's own seal handler already prompts for 𝓘. */
        return null;
      }

      const repository = await resolveRepository();

      if (!repository) {
        setSealStatus(
          "Sealed to the on-page ledger. The Life Atlas was unavailable, so this session was not recorded to the calendar or Sphere."
        );
        return null;
      }

      const temporal = coordinateForInstant(new Date());
      const record = buildSessionRecord(state, temporal);
      const saved = await repository.put(record);

      notifyRecordsChanged({
        source: "manifest-practice",
        recordId: saved.id
      });

      setSealStatus(
        `Sealed to your Life Atlas — ${coordinateLabel(temporal)} · ${state.sessionKind}. ` +
        "The day now carries your marker on the 13 Moons calendar and in the Sphere's day view. Records stay on this device."
      );

      void refreshTeachSurfaces();
      void refreshTodayStrips();

      return saved;
    }

    /* ------------------------- today strip ------------------------- */

    async function refreshTodayStrips() {
      if (typeof document === "undefined") return;

      const strips =
        document.querySelectorAll("[data-manifest-today]");

      if (!strips.length) return;

      const temporal = coordinateForInstant(new Date());

      let count = null;

      const repository = await resolveRepository();

      if (repository && temporal?.civilDate) {
        try {
          const todays = await repository.query({
            subtype: RECORD_SUBTYPE,
            civilDate: temporal.civilDate
          });

          count = todays.length;
        } catch {
          count = null;
        }
      }

      for (const strip of strips) {
        const coords =
          strip.querySelector("[data-manifest-today-coords]");

        const countEl =
          strip.querySelector("[data-manifest-today-count]");

        if (coords) {
          coords.textContent = temporal
            ? `${temporal.civilDate || ""} · ${coordinateLabel(temporal)}`
            : "Today's coordinate is unavailable";
        }

        if (countEl) {
          countEl.textContent =
            count === null
              ? "Session count unavailable"
              : count === 0
                ? "No sessions sealed today yet"
                : `${count} session${count === 1 ? "" : "s"} sealed today`;
        }
      }
    }

    /* ----------------------- teach: summary ------------------------ */

    function renderSummary(summary, temporal) {
      const body = document.getElementById("mpSummaryBody");
      if (!body) return;

      if (!summary || summary.count === 0) {
        body.textContent =
          "No sessions sealed this Moon yet. Seal a session above and it will be counted here, marked on its day, and shown in the Sphere's day view.";
        return;
      }

      const kinds = SESSION_KINDS
        .filter(kind => summary.byKind[kind] > 0)
        .map(kind => `${summary.byKind[kind]} ${kind}`)
        .join(" · ");

      const carriers = summary.carriers.length
        ? summary.carriers
            .map(entry => `${entry.hz} Hz × ${entry.count}`)
            .join(", ")
        : "none recorded";

      body.replaceChildren();

      const lines = [
        `${summary.count} session${summary.count === 1 ? "" : "s"} sealed in Moon ${summary.moon ?? "—"} (Pattern Year ${summary.patternYear ?? "—"}).`,
        `Kinds: ${kinds || "—"}.`,
        `Carriers used: ${carriers}.`,
        `Days marked: ${summary.daysMarked} (${summary.patternDays.map(day => `Pattern Day ${day}`).join(", ")}).`
      ];

      for (const line of lines) {
        const p = document.createElement("p");
        p.className = "manifest-summary-line";
        p.textContent = line;
        body.appendChild(p);
      }
    }

    async function refreshTeachSurfaces() {
      if (typeof document === "undefined") return;
      if (!document.getElementById("mpSummaryBody")) return;

      const temporal = coordinateForInstant(new Date());
      const repository = await resolveRepository();

      if (!repository || !temporal || temporal.moon === null) {
        renderSummary(null, temporal);
        return;
      }

      try {
        const records = await repository.query({
          subtype: RECORD_SUBTYPE,
          patternYear: temporal.patternYear,
          moon: temporal.moon
        });

        renderSummary(
          summarizeMoon(records, {
            patternYear: temporal.patternYear,
            moon: temporal.moon
          }),
          temporal
        );
      } catch {
        renderSummary(null, temporal);
      }
    }

    /* --------------------- moons: day markers ---------------------- */

    let markedDays = new Map();
    let markerObserver = null;
    let markerTimer = 0;

    function decoratePracticeCells() {
      if (typeof document === "undefined") return;

      const cells = document.querySelectorAll(
        "#remCal [data-pattern-year][data-pattern-day], " +
        "#gregCal [data-pattern-year][data-pattern-day], " +
        "#todaySummaryMoonGrid [data-pattern-year][data-pattern-day]"
      );

      cells.forEach(cell => {
        const key =
          `${cell.dataset.patternYear}:${cell.dataset.patternDay}`;

        const entry = markedDays.get(key);

        let host = cell.querySelector(
          ":scope > .manifest-practice-markers"
        );

        if (!entry) {
          host?.remove();
          cell.classList.remove("has-manifest-practice");
          cell.removeAttribute("data-practice-count");
          return;
        }

        cell.classList.add("has-manifest-practice");
        cell.dataset.practiceCount = String(entry.count);

        const signature = entry.recordIds.join("|");

        if (host?.dataset.signature === signature) return;

        host = host || document.createElement("span");
        host.className = "manifest-practice-markers";
        host.dataset.signature = signature;
        host.replaceChildren();

        for (const kind of entry.kinds) {
          const marker = document.createElement("span");

          marker.className =
            `manifest-practice-marker manifest-practice-marker--${kind}`;

          marker.textContent = KIND_GLYPHS[kind] || MARKER_GLYPH;
          marker.title =
            `Manifest ${kind} session sealed — ${entry.count} on this day`;
          marker.setAttribute("aria-hidden", "true");

          host.appendChild(marker);
        }

        if (!cell.contains(host)) {
          cell.appendChild(host);
        }
      });
    }

    async function refreshPracticeMarks() {
      const repository = await resolveRepository();
      if (!repository) return;

      try {
        const records = await repository.query({
          subtype: RECORD_SUBTYPE
        });

        markedDays = markedPatternDays(records);
        decoratePracticeCells();
      } catch {
        /* Markers are an enhancement; the calendar stands without them. */
      }
    }

    function scheduleMarkerRefresh() {
      clearTimeout(markerTimer);
      markerTimer = setTimeout(() => {
        void refreshPracticeMarks();
      }, 40);
    }

    function observePracticeGrids() {
      if (typeof document === "undefined" || markerObserver) return;

      const grids = [
        document.getElementById("remCal"),
        document.getElementById("gregCal"),
        document.getElementById("todaySummaryMoonGrid")
      ].filter(Boolean);

      if (!grids.length) return;

      markerObserver = new MutationObserver(mutations => {
        const external = mutations.some(mutation => {
          const target = mutation.target;
          return !(
            target instanceof Element &&
            target.closest(".manifest-practice-markers")
          );
        });

        if (external) scheduleMarkerRefresh();
      });

      grids.forEach(grid =>
        markerObserver.observe(grid, { childList: true, subtree: true })
      );
    }

    /* ---------------------------- init ----------------------------- */

    let debounceTimer = 0;

    function refreshAll() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void refreshTodayStrips();
        void refreshTeachSurfaces();
        void refreshPracticeMarks();
      }, 40);
    }

    function init() {
      if (typeof document === "undefined") return;

      const sealButton = document.getElementById("rmnSeal");

      if (sealButton) {
        /*
         * The console's own Seal → Ledger handler is registered by the
         * inline console script during parsing; this listener is added
         * after it, so the on-page ledger entry is written first and
         * the Atlas record follows from the same click.
         */
        sealButton.addEventListener("click", () => {
          void sealSessionFromConsole();
        });

        void refreshTeachSurfaces();
      }

      if (
        document.getElementById("remCal") ||
        document.getElementById("gregCal") ||
        document.getElementById("todaySummaryMoonGrid")
      ) {
        observePracticeGrids();
        void refreshPracticeMarks();
      }

      void refreshTodayStrips();

      document.addEventListener(
        "sof:life-atlas-records-changed",
        refreshAll
      );

      window.addEventListener(
        "sof:life-atlas-records-changed",
        refreshAll
      );

      window.addEventListener("livingtime:ready", refreshAll);
      window.addEventListener("livingtime:selectionchange", refreshAll);

      window.addEventListener(
        "pagehide",
        () => {
          markerObserver?.disconnect();
          markerObserver = null;
          clearTimeout(markerTimer);
          clearTimeout(debounceTimer);
        },
        { once: true }
      );
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
      SESSION_KINDS,
      MARKER_GLYPH,
      KIND_GLYPHS,
      XI_LABEL,

      buildSessionRecord,
      isPracticeSession,
      sessionKindOf,
      markedPatternDays,
      summarizeMoon,
      temporalFromConversion,
      coordinateForInstant,
      coordinateLabel,

      readConsoleState,
      sealSessionFromConsole,
      refreshTodayStrips,
      refreshTeachSurfaces,
      refreshPracticeMarks
    });
  }
);
