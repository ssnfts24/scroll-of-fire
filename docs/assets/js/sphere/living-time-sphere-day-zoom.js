/**
 * Living Time Sphere — Day Zoom (Living Strata Phase E, day depth)
 *
 * The day-depth view for the sphere page: it follows the canonical
 * SOFTemporalCursor (the single temporal authority — see
 * docs/development/TEMPORAL-AUTHORITY-CONTRACT.md) and renders the
 * selected Pattern Day in depth: civil date, Moon / Day / Pattern Day
 * indices, and that day's Life Atlas schedule.
 *
 * Records come from the same data path the Life Atlas calendar
 * projection already uses: CodexLivingPlanner.plansForYear(patternYear)
 * filtered to the selected patternDay, with times resolved through
 * CodexLifeAtlasScheduling.getSchedule(record). Manifest practice
 * sessions (Life Atlas records with subtype "practice-session", sealed
 * from the Remnant Visual Exercise — see manifest-practice.js) are not
 * planner records, so refresh() also reads them straight from the Life
 * Atlas repository and merges them in; they render with a special
 * placement marker (gold glyph + kind label). Refresh() also reads the
 * whole Atlas record set for the selection straight from the
 * repository, so this view shows the day's FULL schedule: imported
 * records, notes, observations, and day-stamped records of every other
 * kind the Atlas holds for the day — grouped (timed / all day / on
 * this day) and rendered with each record's recorded depth (time
 * range, place, intention, symbol, practice detail), not just its
 * title and summary. This module is a
 * projection: it never owns temporal truth, never mutates records, and
 * requests selection changes only through the cursor
 * (setPatternDay / moveDays / today).
 *
 * Semantic zoom stays derived view state: opening day depth does not
 * move the camera and does not alter the canonical cursor by itself.
 */
(function (root, factory) {
  const api = factory();

  if (
    typeof module === "object"
    && module.exports
  ) {
    module.exports = api;
  }

  root.LivingTimeSphereDayZoom = api;

})(
  typeof globalThis !== "undefined"
    ? globalThis
    : this,

  function () {
    "use strict";

    const VERSION =
      "living-time-sphere-day-zoom/1.1.0";

    const EMPTY_MESSAGE =
      "No Life Atlas records for this day yet. Import or plan something for this date and it will appear here.";

    /**
     * Manifest practice sessions — the special placement marker.
     * manifest-practice.js is the source of truth for the record shape
     * (subtype "practice-session"); the glyph map is mirrored here so
     * this panel does not depend on that module being loaded.
     */
    const PRACTICE_SUBTYPE =
      "practice-session";

    const PRACTICE_KIND_GLYPHS = Object.freeze({
      practice: "🜚",
      craft: "◆",
      working: "✦"
    });

    function practiceKindOf(record) {
      const kind =
        record?.payload?.manifestPractice?.sessionKind;

      return Object.hasOwn(PRACTICE_KIND_GLYPHS, kind)
        ? kind
        : "practice";
    }

    function isPracticeRecord(record) {
      return Boolean(
        record &&
        record.subtype === PRACTICE_SUBTYPE &&
        record.payload?.manifestPractice
      );
    }

    function finite(value) {
      const number = Number(value);

      return Number.isFinite(number)
        ? number
        : null;
    }

    function cleanString(value) {
      if (
        value === undefined ||
        value === null
      ) {
        return null;
      }

      const text =
        String(value).trim();

      return text || null;
    }

    /**
     * Normalize a canonical cursor coordinate into the day selection
     * this view consumes. Accepts the SOFTemporalCoordinate shape
     * (coordinate.remnant13Moons + coordinate.gregorian.isoDate) and
     * the flatter shapes adapters already pass around.
     */
    function selectionFromCoordinate(
      coordinate = {},
      date = null
    ) {
      const remnant =
        coordinate.remnant13Moons ||
        coordinate.remnant ||
        coordinate.pattern ||
        {};

      let civilDate =
        cleanString(
          coordinate.gregorian?.isoDate ||
          coordinate.civilDate ||
          remnant.civilDate
        );

      if (
        !civilDate &&
        date instanceof Date &&
        !Number.isNaN(date.getTime())
      ) {
        civilDate =
          date.toISOString().slice(0, 10);
      }

      const patternDay =
        finite(
          remnant.patternDay ??
          remnant.dayOfPatternYear ??
          coordinate.patternDay ??
          coordinate.dayOfPatternYear
        );

      const moon =
        finite(
          remnant.moon ??
          coordinate.moon
        );

      const moonDay =
        finite(
          remnant.moonDay ??
          remnant.day ??
          coordinate.moonDay
        );

      return {
        civilDate,

        patternYear:
          finite(
            remnant.patternYear ??
            coordinate.patternYear
          ),

        patternDay,
        moon,
        moonDay,

        week:
          finite(
            remnant.week ??
            remnant.weekOfYear ??
            coordinate.week
          ),

        moonName:
          cleanString(
            remnant.moonName ||
            remnant.moonRecord?.name ||
            coordinate.moonName
          ),

        isYearGate:
          Boolean(
            remnant.isYearGate ??
            coordinate.isYearGate
          ),

        isDayOutOfTime:
          Boolean(
            remnant.isDayOutOfTime ??
            coordinate.isDayOutOfTime
          )
      };
    }

    function selectionFromCursor(cursor) {
      if (!cursor) {
        return null;
      }

      const state =
        typeof cursor.getState === "function"
          ? cursor.getState()
          : null;

      const date =
        typeof cursor.getDate === "function"
          ? cursor.getDate()
          : (
            state?.selectedDate
              ? new Date(state.selectedDate)
              : null
          );

      const coordinate =
        (
          typeof cursor.getCoordinate === "function"
            ? cursor.getCoordinate()
            : null
        ) ||
        state?.coordinate ||
        null;

      if (!coordinate && !date) {
        return null;
      }

      return selectionFromCoordinate(
        coordinate || {},
        date instanceof Date &&
        !Number.isNaN(date.getTime())
          ? date
          : null
      );
    }

    /**
     * Filter a pattern-year record list down to one Pattern Day.
     * Mirrors the recordsByDay index in
     * life-atlas-calendar-projection.js: a record belongs to the day
     * when temporal.patternYear and temporal.patternDay both match.
     * Records carrying only a civilDate that equals the selected civil
     * date are included as well, so imported records without Pattern
     * fields still surface on their day.
     */
    function recordsForDay(records = [], selection = {}) {
      const year =
        finite(selection.patternYear);

      const day =
        finite(selection.patternDay);

      const civilDate =
        cleanString(selection.civilDate);

      return (Array.isArray(records) ? records : [])
        .filter(record => {
          if (!record) return false;

          const recordYear =
            finite(record.temporal?.patternYear);

          const recordDay =
            finite(record.temporal?.patternDay);

          if (
            year !== null &&
            day !== null &&
            recordYear === year &&
            recordDay === day
          ) {
            return true;
          }

          if (
            civilDate &&
            recordDay === null &&
            cleanString(record.temporal?.civilDate) === civilDate
          ) {
            return true;
          }

          return false;
        });
    }

    /**
     * Practice sessions live in the Atlas repository but are not
     * planner records, so plansForYear never returns them. Read them
     * directly, keyed by the same patternYear the panel is showing.
     */
    async function defaultPracticeRecords(patternYear) {
      const runtime =
        typeof globalThis !== "undefined"
          ? globalThis.CodexLifeAtlasRuntime
          : null;

      if (!runtime?.ready) {
        return [];
      }

      const repository =
        await runtime.ready;

      if (!repository?.query) {
        return [];
      }

      return repository.query({
        subtype: PRACTICE_SUBTYPE,
        patternYear
      });
    }

    /**
     * Every Life Atlas record for the selection, read straight from
     * the repository through the Atlas runtime — the same door the
     * practice-session read uses. The planner path returns only
     * records tagged "living-planner" that carry a schedule, and the
     * practice read returns only Manifest sessions; the Atlas also
     * holds imported records, notes, observations, and day-stamped
     * records of other kinds, and the full day schedule means all of
     * them. Keyed by patternYear when the selection carries one; days
     * outside the count (Year Gate, Day Out of Time) carry no pattern
     * year, so those read by civilDate instead.
     */
    async function defaultDayRecords(selection = {}) {
      const runtime =
        typeof globalThis !== "undefined"
          ? globalThis.CodexLifeAtlasRuntime
          : null;

      if (!runtime?.ready) {
        return [];
      }

      const repository =
        await runtime.ready;

      if (!repository?.query) {
        return [];
      }

      const patternYear =
        selection.patternYear === null ||
        selection.patternYear === undefined
          ? null
          : finite(selection.patternYear);

      if (patternYear !== null) {
        return repository.query({ patternYear });
      }

      const civilDate =
        cleanString(selection.civilDate);

      if (civilDate) {
        return repository.query({ civilDate });
      }

      return [];
    }

    function mergeRecords(primary = [], extra = []) {
      const seen = new Set();
      const merged = [];

      for (const record of [...primary, ...extra]) {
        if (!record) continue;

        const id = record.id || null;

        if (id && seen.has(id)) continue;
        if (id) seen.add(id);

        merged.push(record);
      }

      return merged;
    }

    function scheduleOf(record, scheduling) {
      try {
        return scheduling?.getSchedule?.(record) || null;
      } catch {
        return null;
      }
    }

    function formatTime(iso) {
      if (!iso) return "";

      try {
        return new Intl.DateTimeFormat(undefined, {
          hour: "numeric",
          minute: "2-digit"
        }).format(new Date(iso));
      } catch {
        return "";
      }
    }

    function formatDuration(seconds) {
      const total =
        finite(seconds);

      if (total === null || total <= 0) {
        return null;
      }

      const minutes =
        Math.round(total / 60);

      if (minutes < 1) return "under a minute";
      if (minutes < 60) return `${minutes} min`;

      const hours =
        Math.floor(minutes / 60);

      const rest =
        minutes % 60;

      return rest
        ? `${hours} hr ${rest} min`
        : `${hours} hr`;
    }

    /**
     * The recorded depth of one record, as label/value pairs in the
     * order a reader wants them: where it happens, what was intended,
     * then the detail the writer actually stored. Only fields the
     * record really carries appear — nothing is invented to fill the
     * panel, and a value already shown as the entry's summary is not
     * repeated.
     */
    function detailsForRecord(record, schedule, practice) {
      const details = [];

      const push = (label, value) => {
        const text =
          cleanString(value);

        if (text) {
          details.push({ label, value: text });
        }
      };

      push(
        "Location",
        cleanString(schedule?.locationLabel) ||
        cleanString(record.spatial?.placeId)
      );

      const planner =
        record.payload?.planner || {};

      push("Intention", planner.intention);
      push("Symbol", planner.symbol);
      push("Season", planner.seasonalWindow);

      if (
        schedule?.priority &&
        schedule.priority !== "normal"
      ) {
        push("Priority", schedule.priority);
      }

      const freq =
        cleanString(schedule?.recurrence?.freq);

      if (freq && freq !== "none") {
        const interval =
          finite(schedule.recurrence.interval);

        push(
          "Repeats",
          interval && interval > 1
            ? `every ${interval} · ${freq}`
            : freq
        );
      }

      if (practice) {
        const session =
          record.payload?.manifestPractice || {};

        if (!cleanString(planner.intention)) {
          push("Intention", session.intention);
        }

        const carriers =
          (Array.isArray(session.carriersHz)
            ? session.carriersHz
            : []
          ).filter(value => finite(value) !== null);

        if (carriers.length) {
          push(
            "Carriers",
            carriers.map(hz => `${hz} Hz`).join(" · ")
          );
        }

        push("Sequence", session.sequencePath);

        const visual =
          cleanString(session.visualMode?.label) ||
          cleanString(session.visualMode?.value);

        if (visual) {
          push(
            "Visual mode",
            session.seed !== null &&
            session.seed !== undefined
              ? `${visual} · seed ${session.seed}`
              : visual
          );
        }

        push("Breath", session.breathPattern);
        push("Duration", formatDuration(session.durationSeconds));

        /* The Manifest console seals Ξ as a bare number; the visual
           exercise may seal it as { value, label }. Read both. */
        const xi =
          session.xi && typeof session.xi === "object"
            ? finite(session.xi.value)
            : typeof session.xi === "number" ||
                typeof session.xi === "string"
              ? finite(session.xi)
              : null;

        if (xi !== null) {
          const xiLabel =
            session.xi && typeof session.xi === "object"
              ? cleanString(session.xi.label) ||
                "the console's own estimate"
              : null;

          push(
            "Coherence Ξ",
            xiLabel
              ? `${Math.round(xi * 100) / 100} — ${xiLabel}`
              : String(Math.round(xi * 100) / 100)
          );
        }

        push("Materials", session.materials);

        if (
          cleanString(session.witnessNote) &&
          cleanString(session.witnessNote) !==
            cleanString(record.summary)
        ) {
          push("Witness note", session.witnessNote);
        }
      }

      const body =
        cleanString(record.body) ||
        cleanString(record.notes);

      if (body && body !== cleanString(record.summary)) {
        push("Notes", body);
      }

      return details;
    }

    function entryForRecord(record, scheduling) {
      const schedule =
        scheduleOf(record, scheduling);

      const allDay =
        Boolean(schedule?.allDay) ||
        !schedule?.start;

      const start =
        !allDay
          ? cleanString(schedule.start)
          : null;

      const practice =
        isPracticeRecord(record);

      const sessionKind =
        practice
          ? practiceKindOf(record)
          : null;

      const end =
        !allDay
          ? cleanString(schedule?.end)
          : null;

      const startLabel =
        start
          ? formatTime(start)
          : "";

      const endLabel =
        end
          ? formatTime(end)
          : "";

      return {
        id:
          record.id || "",

        title:
          cleanString(record.title) ||
          cleanString(record.subtype) ||
          cleanString(record.type) ||
          "Untitled record",

        type:
          practice
            ? `Manifest · ${sessionKind} session`
            : cleanString(
                record.payload?.planner?.category ||
                record.subtype ||
                record.type
              ) || "event",

        practice,

        sessionKind,

        markerGlyph:
          practice
            ? PRACTICE_KIND_GLYPHS[sessionKind]
            : null,

        summary:
          cleanString(record.summary) || "",

        allDay,
        start,
        end,

        timeLabel:
          allDay
            ? "All day"
            : (
              endLabel && endLabel !== startLabel
                ? `${startLabel} – ${endLabel}`
                : startLabel
            ),

        group:
          practice || !schedule
            ? "day"
            : (
              allDay
                ? "allday"
                : "timed"
            ),

        details:
          detailsForRecord(record, schedule, practice),

        status:
          cleanString(schedule?.status) || null,

        completed:
          Boolean(
            scheduling?.isCompleted?.(record)
          )
      };
    }

    function sortEntries(entries) {
      return [...entries].sort((a, b) => {
        if (a.allDay !== b.allDay) {
          return a.allDay ? -1 : 1;
        }

        const aTime =
          a.start ? Date.parse(a.start) : 0;

        const bTime =
          b.start ? Date.parse(b.start) : 0;

        if (aTime !== bTime) {
          return aTime - bTime;
        }

        return a.title.localeCompare(b.title);
      });
    }

    /**
     * The day's reading order: the timed schedule first (the spine of
     * the day), then all-day entries, then everything stamped onto the
     * day without a time of its own — sealed sessions, notes, and
     * other day records. Groups with nothing in them are omitted.
     */
    const GROUP_DEFS =
      Object.freeze([
        { id: "timed", label: "Timed" },
        { id: "allday", label: "All day" },
        { id: "day", label: "On this day" }
      ]);

    function groupEntries(entries = []) {
      return GROUP_DEFS
        .map(def => ({
          id: def.id,
          label: def.label,
          entries:
            entries.filter(entry => entry.group === def.id)
        }))
        .filter(group => group.entries.length > 0);
    }

    /**
     * Build the complete day-depth view model from a selection and the
     * full record list for the selection's pattern year. Pure: no DOM,
     * no cursor, no storage.
     */
    function buildDayView({
      selection = {},
      records = [],
      scheduling = null
    } = {}) {
      const dayRecords =
        recordsForDay(records, selection);

      const entries =
        sortEntries(
          dayRecords.map(record =>
            entryForRecord(record, scheduling)
          )
        );

      const isOutsideCount =
        Boolean(selection.isYearGate) ||
        Boolean(selection.isDayOutOfTime) ||
        selection.patternDay === null;

      return {
        version: VERSION,

        civilDate:
          selection.civilDate || null,

        patternYear:
          selection.patternYear ?? null,

        patternDay:
          selection.patternDay ?? null,

        moon:
          selection.moon ?? null,

        moonDay:
          selection.moonDay ?? null,

        week:
          selection.week ?? null,

        moonName:
          selection.moonName || null,

        isYearGate:
          Boolean(selection.isYearGate),

        isDayOutOfTime:
          Boolean(selection.isDayOutOfTime),

        isOutsideCount,

        count:
          entries.length,

        empty:
          entries.length === 0,

        emptyMessage:
          EMPTY_MESSAGE,

        entries,

        groups:
          groupEntries(entries)
      };
    }

    /**
     * Controller: binds a day-zoom view to the canonical cursor and
     * the planner data path. All dependencies are injectable so the
     * behavior is testable without a browser.
     */
    function createDayZoom({
      cursor = null,
      planner = null,
      scheduling = null,
      practiceRecordsProvider = null,
      dayRecordsProvider = null,
      eventTarget = null,
      onRender = null
    } = {}) {
      let activeCursor = cursor;
      let activeTarget = eventTarget;
      let listening = false;
      let refreshGeneration = 0;
      let lastView = null;
      const listeners = new Set();

      function resolveCursor() {
        return (
          activeCursor ||
          (
            typeof globalThis !== "undefined"
              ? globalThis.SOFTemporalCursor
              : null
          ) ||
          null
        );
      }

      function resolvePlanner() {
        return (
          planner ||
          (
            typeof globalThis !== "undefined"
              ? globalThis.CodexLivingPlanner
              : null
          ) ||
          null
        );
      }

      async function resolvePracticeRecords(patternYear) {
        if (typeof practiceRecordsProvider === "function") {
          return practiceRecordsProvider(patternYear);
        }

        return defaultPracticeRecords(patternYear);
      }

      async function resolveDayRecords(selection) {
        if (typeof dayRecordsProvider === "function") {
          return dayRecordsProvider(selection);
        }

        return defaultDayRecords(selection);
      }

      function resolveScheduling() {
        return (
          scheduling ||
          (
            typeof globalThis !== "undefined"
              ? globalThis.CodexLifeAtlasScheduling
              : null
          ) ||
          null
        );
      }

      function resolveEventTarget() {
        if (activeTarget) {
          return activeTarget;
        }

        if (
          typeof window !== "undefined" &&
          typeof window.addEventListener === "function"
        ) {
          return window;
        }

        return null;
      }

      function emit(view, reason) {
        lastView = view;

        const detail = {
          reason,
          view
        };

        for (const listener of listeners) {
          try {
            listener(detail);
          } catch (error) {
            console.error(
              "[LivingTimeSphereDayZoom] listener failed",
              error
            );
          }
        }

        if (typeof onRender === "function") {
          onRender(view, reason);
        }

        return detail;
      }

      async function refresh(reason = "manual") {
        const generation =
          ++refreshGeneration;

        const currentCursor =
          resolveCursor();

        const selection =
          selectionFromCursor(currentCursor);

        if (!selection) {
          const view = buildDayView({
            selection: {},
            records: [],
            scheduling: resolveScheduling()
          });

          if (generation !== refreshGeneration) {
            return { reason, view, stale: true };
          }

          emit(view, reason);

          return { reason, view, stale: false };
        }

        let records = [];

        const planApi =
          resolvePlanner();

        if (
          planApi &&
          selection.patternYear !== null &&
          selection.patternYear !== undefined
        ) {
          try {
            records =
              typeof planApi.plansForYear === "function"
                ? await planApi.plansForYear(
                    selection.patternYear
                  )
                : (
                  typeof planApi.allPlans === "function"
                    ? await planApi.allPlans()
                    : []
                );
          } catch (error) {
            console.warn(
              "[LivingTimeSphereDayZoom] Unable to read planner records.",
              error
            );

            records = [];
          }
        }

        let practiceRecords = [];

        if (
          selection.patternYear !== null &&
          selection.patternYear !== undefined
        ) {
          try {
            practiceRecords =
              (await resolvePracticeRecords(
                selection.patternYear
              )) || [];
          } catch (error) {
            console.warn(
              "[LivingTimeSphereDayZoom] Unable to read practice session records.",
              error
            );

            practiceRecords = [];
          }
        }

        let dayRecords = [];

        try {
          dayRecords =
            (await resolveDayRecords(selection)) || [];
        } catch (error) {
          console.warn(
            "[LivingTimeSphereDayZoom] Unable to read the full Life Atlas record set.",
            error
          );

          dayRecords = [];
        }

        const view = buildDayView({
          selection,
          records:
            mergeRecords(
              mergeRecords(records || [], practiceRecords),
              dayRecords
            ),
          scheduling: resolveScheduling()
        });

        if (generation !== refreshGeneration) {
          return { reason, view, stale: true };
        }

        emit(view, reason);

        return { reason, view, stale: false };
      }

      function onCursorChange(event) {
        const reason =
          event?.detail?.reason ||
          "temporal-cursor-change";

        void refresh(reason);
      }

      function onRecordsChange() {
        void refresh("life-atlas-records-changed");
      }

      function start() {
        if (listening) {
          return true;
        }

        const target =
          resolveEventTarget();

        if (
          !target ||
          typeof target.addEventListener !== "function"
        ) {
          return false;
        }

        target.addEventListener(
          "sof:temporal-cursor-change",
          onCursorChange
        );

        target.addEventListener(
          "sof:temporal-cursor-ready",
          onCursorChange
        );

        if (
          typeof document !== "undefined" &&
          typeof document.addEventListener === "function"
        ) {
          document.addEventListener(
            "sof:life-atlas-records-changed",
            onRecordsChange
          );
        }

        listening = true;

        void refresh("start");

        return true;
      }

      function stop() {
        if (!listening) {
          return false;
        }

        const target =
          resolveEventTarget();

        if (
          target &&
          typeof target.removeEventListener === "function"
        ) {
          target.removeEventListener(
            "sof:temporal-cursor-change",
            onCursorChange
          );

          target.removeEventListener(
            "sof:temporal-cursor-ready",
            onCursorChange
          );
        }

        if (
          typeof document !== "undefined" &&
          typeof document.removeEventListener === "function"
        ) {
          document.removeEventListener(
            "sof:life-atlas-records-changed",
            onRecordsChange
          );
        }

        listening = false;

        return true;
      }

      function subscribe(listener) {
        if (typeof listener !== "function") {
          throw new TypeError(
            "Day zoom subscriber must be a function."
          );
        }

        listeners.add(listener);

        return function unsubscribe() {
          listeners.delete(listener);
        };
      }

      /**
       * Selection requests — the only writes this view performs, and
       * every one goes through the canonical cursor.
       */
      function selectPatternDay(patternDay) {
        const currentCursor =
          resolveCursor();

        if (
          !currentCursor ||
          typeof currentCursor.setPatternDay !== "function"
        ) {
          return null;
        }

        return currentCursor.setPatternDay(
          patternDay,
          { source: "sphere-day-zoom" }
        );
      }

      function moveDays(days) {
        const currentCursor =
          resolveCursor();

        if (
          !currentCursor ||
          typeof currentCursor.moveDays !== "function"
        ) {
          return null;
        }

        return currentCursor.moveDays(
          days,
          { source: "sphere-day-zoom" }
        );
      }

      function goToday() {
        const currentCursor =
          resolveCursor();

        if (
          !currentCursor ||
          typeof currentCursor.today !== "function"
        ) {
          return null;
        }

        return currentCursor.today({
          source: "sphere-day-zoom"
        });
      }

      function getLastView() {
        return lastView;
      }

      function isListening() {
        return listening;
      }

      return Object.freeze({
        version: VERSION,

        refresh,
        subscribe,

        start,
        stop,

        selectPatternDay,
        moveDays,
        goToday,

        getLastView,
        isListening
      });
    }

    /* ------------------------------------------------------------------
     * Browser bootstrap — renders the controller's view model into the
     * sphere page's day-zoom panel. Guarded so Node tests can require
     * this module without a DOM.
     * ------------------------------------------------------------------ */

    function formatCivilDate(civilDate) {
      if (!civilDate) return "No day selected";

      try {
        return new Intl.DateTimeFormat(undefined, {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: "UTC"
        }).format(new Date(`${civilDate}T12:00:00Z`));
      } catch {
        return civilDate;
      }
    }

    function coordinateLine(view) {
      if (view.isYearGate) {
        return `Year Gate · outside the 13 × 28 pattern · Pattern Year ${view.patternYear ?? "—"}`;
      }

      if (view.isDayOutOfTime) {
        return `Day Out of Time · outside the 364-day count · Pattern Year ${view.patternYear ?? "—"}`;
      }

      if (view.patternDay === null) {
        return "Select a Pattern Day to see it in depth.";
      }

      const moonLabel =
        view.moon !== null
          ? `Moon ${view.moon}${view.moonName ? ` · ${view.moonName}` : ""}`
          : "Moon —";

      const dayLabel =
        view.moonDay !== null
          ? `Day ${view.moonDay}/28`
          : "Day —";

      const weekLabel =
        view.week !== null
          ? ` · Week ${view.week}`
          : "";

      return `${moonLabel} — ${dayLabel} · Pattern Day ${view.patternDay}/364${weekLabel} · Pattern Year ${view.patternYear ?? "—"}`;
    }

    function renderDayZoom(view) {
      if (typeof document === "undefined") return;

      const dateEl =
        document.getElementById("sphere-day-zoom-date");

      const coordsEl =
        document.getElementById("sphere-day-zoom-coords");

      const countEl =
        document.getElementById("sphere-day-zoom-count");

      const listEl =
        document.getElementById("sphere-day-zoom-list");

      const emptyEl =
        document.getElementById("sphere-day-zoom-empty");

      const statusEl =
        document.getElementById("sphere-day-zoom-status");

      const inputEl =
        document.getElementById("sphere-day-zoom-pattern-day");

      if (!dateEl || !listEl) return;

      dateEl.textContent =
        formatCivilDate(view.civilDate);

      if (coordsEl) {
        coordsEl.textContent =
          coordinateLine(view);
      }

      if (countEl) {
        countEl.textContent =
          String(view.count);
      }

      if (
        inputEl &&
        view.patternDay !== null &&
        document.activeElement !== inputEl
      ) {
        inputEl.value =
          String(view.patternDay);
      }

      listEl.replaceChildren();

      const renderGroups =
        Array.isArray(view.groups) && view.groups.length
          ? view.groups
          : [{ id: "all", label: null, entries: view.entries }];

      const showHeadings =
        renderGroups.length > 1;

      for (const group of renderGroups) {
        if (showHeadings && group.label) {
          const heading =
            document.createElement("li");

          heading.className =
            "sphere-day-zoom-group";

          heading.textContent =
            group.label;

          listEl.appendChild(heading);
        }

        for (const entry of group.entries) {
          const item =
            document.createElement("li");

          item.className =
            "sphere-day-zoom-item";

          if (entry.completed) {
            item.classList.add("is-completed");
          }

          if (entry.practice) {
            item.classList.add("is-practice");

            const marker =
              document.createElement("span");

            marker.className =
              "sphere-day-zoom-marker";

            marker.textContent =
              entry.markerGlyph || "🜚";

            marker.title =
              `Manifest ${entry.sessionKind || "practice"} session — sealed from the Remnant Visual Exercise`;

            marker.setAttribute(
              "aria-hidden",
              "true"
            );

            item.appendChild(marker);
          }

          const time =
            document.createElement("span");

          time.className =
            "sphere-day-zoom-time";

          time.textContent =
            entry.timeLabel;

          const body =
            document.createElement("span");

          body.className =
            "sphere-day-zoom-body";

          const title =
            document.createElement("strong");

          title.textContent =
            entry.title;

          body.appendChild(title);

          const meta =
            document.createElement("small");

          meta.textContent =
            entry.status && entry.status !== "planned"
              ? `${entry.type} · ${entry.status}`
              : entry.type;

          body.appendChild(meta);

          if (entry.summary) {
            const summary =
              document.createElement("span");

            summary.className =
              "sphere-day-zoom-summary";

            summary.textContent =
              entry.summary;

            body.appendChild(summary);
          }

          if (
            Array.isArray(entry.details) &&
            entry.details.length
          ) {
            const details =
              document.createElement("dl");

            details.className =
              "sphere-day-zoom-details";

            for (const pair of entry.details) {
              const term =
                document.createElement("dt");

              term.textContent =
                pair.label;

              const value =
                document.createElement("dd");

              value.textContent =
                pair.value;

              details.appendChild(term);
              details.appendChild(value);
            }

            body.appendChild(details);
          }

          item.appendChild(time);
          item.appendChild(body);
          listEl.appendChild(item);
        }
      }

      if (emptyEl) {
        emptyEl.hidden =
          !view.empty;

        emptyEl.textContent =
          view.emptyMessage;
      }

      if (statusEl) {
        statusEl.textContent =
          view.empty
            ? "Day depth ready. No records on this day."
            : `Day depth ready. ${view.count} ${view.count === 1 ? "record" : "records"} on this day.`;
      }
    }

    function initDayZoom() {
      if (typeof document === "undefined") {
        return null;
      }

      const panel =
        document.getElementById("sphere-day-zoom-panel");

      if (!panel) {
        return null;
      }

      const zoom = createDayZoom({
        onRender: renderDayZoom
      });

      const prev =
        document.getElementById("sphere-day-zoom-prev");

      const next =
        document.getElementById("sphere-day-zoom-next");

      const today =
        document.getElementById("sphere-day-zoom-today");

      const go =
        document.getElementById("sphere-day-zoom-go");

      const input =
        document.getElementById("sphere-day-zoom-pattern-day");

      prev?.addEventListener("click", () => {
        zoom.moveDays(-1);
      });

      next?.addEventListener("click", () => {
        zoom.moveDays(1);
      });

      today?.addEventListener("click", () => {
        zoom.goToday();
      });

      go?.addEventListener("click", () => {
        const day =
          Number(input?.value);

        if (
          Number.isInteger(day) &&
          day >= 1 &&
          day <= 364
        ) {
          zoom.selectPatternDay(day);
          panel.scrollIntoView({
            behavior: "smooth",
            block: "nearest"
          });
        }
      });

      input?.addEventListener("keydown", event => {
        if (event.key === "Enter") {
          event.preventDefault();
          go?.click();
        }
      });

      zoom.start();

      return zoom;
    }

    if (typeof document !== "undefined") {
      if (document.readyState === "loading") {
        document.addEventListener(
          "DOMContentLoaded",
          () => initDayZoom(),
          { once: true }
        );
      } else {
        initDayZoom();
      }
    }

    return Object.freeze({
      VERSION,
      EMPTY_MESSAGE,

      selectionFromCoordinate,
      selectionFromCursor,
      recordsForDay,
      entryForRecord,
      detailsForRecord,
      groupEntries,
      GROUP_DEFS,
      buildDayView,
      isPracticeRecord,
      practiceKindOf,
      mergeRecords,
      defaultDayRecords,
      PRACTICE_SUBTYPE,
      PRACTICE_KIND_GLYPHS,

      createDayZoom,

      formatCivilDate,
      coordinateLine,
      renderDayZoom,
      initDayZoom
    });
  }
);
