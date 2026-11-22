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
 * placement marker (gold glyph + kind label). refresh() additionally
 * reads every other Life Atlas record stored for the pattern year
 * straight from the repository, so the day view shows the day's FULL
 * schedule — planner entries, practice sessions, and any other record
 * the calendar projection would mark on that day — and each entry
 * carries its recorded detail under the title (a planner entry's
 * intention; a session's intention, carriers, sequence, visual mode,
 * breath, materials, and the console's own Ξ estimate, labeled as the
 * console labels it). This module is a projection: it never owns
 * temporal truth, never mutates records, and requests selection
 * changes only through the cursor (setPatternDay / moveDays / today).
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
     * Every Life Atlas record stored for the pattern year, read the
     * same way as the practice sessions above. The planner path only
     * ever returns records tagged "living-planner", and the practice
     * path only sealed sessions; the day's full schedule also includes
     * any other record the calendar projection would mark on the day
     * (imported records, notes, and events kept outside the planner).
     * refresh() merges all three reads by id, planner first so its
     * normalized copy of a record wins.
     */
    async function defaultDayRecords(patternYear) {
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
        patternYear
      });
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

    /**
     * The recorded detail lines an entry carries under its title —
     * the day's full depth. Everything here is read from the record
     * itself: a planner entry's intention and seasonal window; a
     * Manifest session's intention, carriers and sequence, visual
     * mode, breath pattern, materials, and the console's own Ξ
     * estimate (carried with the console's label, never upgraded
     * here). Lines that would only repeat the title or the summary
     * are skipped.
     */
    function detailsForRecord(record, base = {}) {
      const details = [];

      function push(label, value) {
        const text =
          cleanString(value);

        if (!text) return;

        const line =
          `${label}: ${text}`;

        if (
          line === base.title ||
          line === base.summary ||
          text === base.title ||
          text === base.summary
        ) {
          return;
        }

        if (!details.includes(line)) {
          details.push(line);
        }
      }

      if (isPracticeRecord(record)) {
        const mp =
          record.payload?.manifestPractice || {};

        push("Intention", mp.intention);

        if (
          Array.isArray(mp.carriersHz) &&
          mp.carriersHz.length
        ) {
          push(
            "Carriers",
            `${mp.carriersHz.join(" · ")} Hz`
          );
        }

        push("Sequence", mp.sequencePath);

        const visual =
          cleanString(mp.visualMode?.label);

        if (visual) {
          push(
            "Visual",
            mp.seed !== null &&
            mp.seed !== undefined
              ? `${visual} · seed ${mp.seed}`
              : visual
          );
        }

        push("Breath", mp.breathPattern);

        const xiValue =
          mp.xi?.value;

        if (
          xiValue !== null &&
          xiValue !== undefined &&
          Number.isFinite(Number(xiValue))
        ) {
          const xiLine =
            `Ξ ${xiValue}` +
            (
              cleanString(mp.xi?.label)
                ? ` — ${cleanString(mp.xi.label)}`
                : ""
            );

          if (!details.includes(xiLine)) {
            details.push(xiLine);
          }
        }

        push("Materials", mp.materials);

        return details;
      }

      const planner =
        record.payload?.planner;

      if (planner) {
        push("Intention", planner.intention);
        push("Seasonal window", planner.seasonalWindow);
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

      const entry = {
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
        end:
          !allDay
            ? cleanString(schedule?.end)
            : null,

        timeLabel:
          allDay
            ? "All day"
            : formatTime(start),

        status:
          cleanString(schedule?.status) || null,

        completed:
          Boolean(
            scheduling?.isCompleted?.(record)
          )
      };

      entry.details =
        detailsForRecord(record, entry);

      return entry;
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

        entries
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

      async function resolveDayRecords(patternYear) {
        if (typeof dayRecordsProvider === "function") {
          return dayRecordsProvider(patternYear);
        }

        return defaultDayRecords(patternYear);
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

        if (
          selection.patternYear !== null &&
          selection.patternYear !== undefined
        ) {
          try {
            dayRecords =
              (await resolveDayRecords(
                selection.patternYear
              )) || [];
          } catch (error) {
            console.warn(
              "[LivingTimeSphereDayZoom] Unable to read Life Atlas records.",
              error
            );

            dayRecords = [];
          }
        }

        const view = buildDayView({
          selection,
          records: mergeRecords(
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

      for (const entry of view.entries) {
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

        for (const line of entry.details || []) {
          const detail =
            document.createElement("span");

          detail.className =
            "sphere-day-zoom-summary";

          detail.textContent =
            line;

          body.appendChild(detail);
        }

        item.appendChild(time);
        item.appendChild(body);
        listEl.appendChild(item);
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
        onRender(view, reason) {
          renderDayZoom(view, reason);
          renderDayWorldCard(view);
        }
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

      startZoomDepth(zoom);

      return zoom;
    }

    /* ------------------------------------------------------------------
     * ZOOM-DEPTH STAGES (Sphere deep-fix, Aaron, Nov 22, 2026) —
     * groundwork under the Living Sphere Evolution directive ("Living
     * Day Worlds and a Unified Spatial Interface"). The directive
     * names the keeper's approach to a day as a passage through
     * stages, and this extension gives the passage its first working
     * form on the existing module:
     *
     *   Year View      — the whole Sphere. The faced Moon discloses
     *                    its 28 days (label manager, this change set).
     *   Moon View      — the faced Moon's numbers read at full
     *                    strength (label manager, this change set).
     *   Day Approach   — closing on the selected day (distance
     *                    ≤ 2.0): its number and its schedule mark grow,
     *                    and the day's world card rises inside the
     *                    stage naming the day.
     *   Living Day     — distance ≤ 1.5: the world card stands open —
     *                    the day named, its scheduled things listed
     *                    with the same glyphs the face itself carries,
     *                    read from the same view model the Day
     *                    Details panel renders (one record, one
     *                    telling). A day with nothing scheduled shows
     *                    its full coordinates and the honest empty
     *                    line — never an empty box.
     *   Immersive Day  — distance ≤ 1.22: the existing Day Details
     *                    door opens (the page's own dock button is
     *                    pressed, so the sheet, its focus handling,
     *                    and the Day World door inside it behave
     *                    exactly as a keeper's tap). Zooming back out
     *                    past the exit distance folds it away — but
     *                    only when zoom itself opened it; a sheet the
     *                    keeper opened by hand is never closed by the
     *                    camera.
     *
     * Stage changes are discrete and hysteretic (enter and exit
     * distances differ, so resting on a boundary never flutters);
     * CSS transitions carry the reveal between stages, so nothing
     * pops. This controller never touches the calendar: it reads the
     * camera's distance and the day-zoom view model, and its only
     * outward acts are pressing the page's own buttons.
     * ------------------------------------------------------------------ */

    const ZOOM_STAGES = Object.freeze([
      "year",
      "moon",
      "approach",
      "living",
      "immersive"
    ]);

    const ZOOM_STAGE_BOUNDS = Object.freeze({
      approach: { enter: 2.0, exit: 2.15 },
      living: { enter: 1.5, exit: 1.62 },
      immersive: { enter: 1.22, exit: 1.45 }
    });

    const ZOOM_STAGE_ORDER = Object.freeze({
      year: 0,
      moon: 1,
      approach: 2,
      living: 3,
      immersive: 4
    });

    function zoomStageForDistance(distance, previousStage = "year") {
      const d =
        Number(distance);

      if (!Number.isFinite(d) || d <= 0) {
        return "year";
      }

      let stage =
        d <= ZOOM_STAGE_BOUNDS.immersive.enter
          ? "immersive"
          : d <= ZOOM_STAGE_BOUNDS.living.enter
            ? "living"
            : d <= ZOOM_STAGE_BOUNDS.approach.enter
              ? "approach"
              : d < 3.01
                ? "moon"
                : "year";

      // Hysteresis: a deeper stage already held survives until the
      // distance passes that stage's exit threshold.
      const held =
        ZOOM_STAGE_BOUNDS[previousStage];

      if (
        held &&
        ZOOM_STAGE_ORDER[previousStage] > ZOOM_STAGE_ORDER[stage] &&
        d < held.exit
      ) {
        stage = previousStage;
      }

      return stage;
    }

    /*
     * The glyphs the face itself carries for a scheduled thing — the
     * same table the Life Atlas record extension draws its day marks
     * from (SYMBOL_BY_CATEGORY there), kept to the common kinds.
     * Practice sessions carry their own marker from the console.
     */
    const DAY_WORLD_GLYPHS = Object.freeze({
      task: "✓",
      event: "●",
      reminder: "⚑",
      project: "◆",
      travel: "✈",
      milestone: "★",
      practice: "✦",
      growing: "🌱",
      farming: "🌾",
      planting: "🌱",
      harvest: "🌾",
      watering: "💧",
      seasonal: "☀"
    });

    function dayWorldGlyphForEntry(entry) {
      if (entry?.practice) {
        return entry.markerGlyph || "🜚";
      }

      const kind =
        cleanString(entry?.type).toLowerCase();

      return DAY_WORLD_GLYPHS[kind] || "●";
    }

    function createZoomDepth({
      getDistance = null,
      onStage = null
    } = {}) {
      let stage = "year";

      function currentDistance() {
        if (typeof getDistance === "function") {
          const value =
            Number(getDistance());

          return Number.isFinite(value) ? value : null;
        }

        const camera =
          typeof globalThis !== "undefined"
            ? globalThis.LivingTimeSphereCamera
            : null;

        const value =
          Number(camera?.getState?.().dist);

        return Number.isFinite(value) ? value : null;
      }

      function update() {
        const distance =
          currentDistance();

        if (distance === null) {
          return stage;
        }

        const next =
          zoomStageForDistance(distance, stage);

        if (next !== stage) {
          stage = next;

          if (typeof onStage === "function") {
            onStage(stage, distance);
          }
        }

        return stage;
      }

      return Object.freeze({
        update,

        getStage() {
          return stage;
        }
      });
    }

    function buildDayWorldCard() {
      const card =
        document.createElement("aside");

      card.id =
        "sphere-day-world-card";

      card.className =
        "sphere-day-world-card";

      card.dataset.stage =
        "year";

      card.setAttribute(
        "aria-label",
        "The selected day, in depth"
      );

      const kicker =
        document.createElement("p");

      kicker.className =
        "sphere-day-world-kicker";

      kicker.textContent =
        "Living Day";

      const date =
        document.createElement("h3");

      date.className =
        "sphere-day-world-date";

      const coords =
        document.createElement("p");

      coords.className =
        "sphere-day-world-coords";

      const list =
        document.createElement("ul");

      list.className =
        "sphere-day-world-list";

      const empty =
        document.createElement("p");

      empty.className =
        "sphere-day-world-empty";

      card.append(kicker, date, coords, list, empty);

      return card;
    }

    function renderDayWorldCard(view) {
      if (typeof document === "undefined" || !view) return;

      const card =
        document.getElementById("sphere-day-world-card");

      if (!card) return;

      const date =
        card.querySelector(".sphere-day-world-date");

      const coords =
        card.querySelector(".sphere-day-world-coords");

      const list =
        card.querySelector(".sphere-day-world-list");

      const empty =
        card.querySelector(".sphere-day-world-empty");

      if (date) {
        date.textContent =
          formatCivilDate(view.civilDate);
      }

      if (coords) {
        coords.textContent =
          coordinateLine(view);
      }

      if (list) {
        list.replaceChildren();

        for (const entry of view.entries) {
          const item =
            document.createElement("li");

          item.className =
            "sphere-day-world-item";

          if (entry.completed) {
            item.classList.add("is-completed");
          }

          const glyph =
            document.createElement("span");

          glyph.className =
            "sphere-day-world-glyph";

          glyph.textContent =
            dayWorldGlyphForEntry(entry);

          glyph.setAttribute("aria-hidden", "true");

          const name =
            document.createElement("span");

          name.className =
            "sphere-day-world-name";

          name.textContent =
            entry.title;

          item.append(glyph, name);

          if (!entry.allDay && entry.timeLabel) {
            const time =
              document.createElement("span");

            time.className =
              "sphere-day-world-time";

            time.textContent =
              entry.timeLabel;

            item.appendChild(time);
          }

          list.appendChild(item);
        }
      }

      if (empty) {
        empty.hidden =
          !view.empty;

        empty.textContent =
          view.empty
            ? view.emptyMessage
            : "";
      }
    }

    function startZoomDepth(dayZoom = null) {
      if (typeof document === "undefined") {
        return null;
      }

      const container =
        document.getElementById("sphere-container");

      if (!container || container.dataset.zoomDepth === "on") {
        return null;
      }

      container.dataset.zoomDepth =
        "on";

      // The stage stands at Year View from the start; the
      // controller's onStage only fires on CHANGES, so without
      // this the attribute would be absent until the first zoom.
      container.dataset.zoomStage =
        "year";

      /*
       * The card is looked up — and if necessary re-seated — on
       * every tick rather than captured once: the stage's contents
       * are rebuilt around this module (the renderer's mount, the
       * shell's rooms), and a card seated at DOMContentLoaded can
       * be wiped by a later mount. Re-seating re-renders the last
       * known view so the day is never lost with the element.
       */
      const currentCard = () => {
        const host =
          document.getElementById("sphere-container");

        if (!host) return null;

        let card =
          document.getElementById("sphere-day-world-card");

        if (!card || card.parentElement !== host) {
          card = buildDayWorldCard();
          host.appendChild(card);

          const view =
            dayZoom?.getLastView?.();

          if (view) {
            renderDayWorldCard(view);
          }
        }

        return card;
      };

      currentCard();

      let openedByZoom = false;

      const roomsOpen = () =>
        document.documentElement.classList.contains(
          "armillary-rooms-open"
        );

      const depth = createZoomDepth({
        onStage(stage) {
          const host =
            document.getElementById("sphere-container");

          if (host) {
            host.dataset.zoomStage =
              stage;
          }

          const card =
            currentCard();

          if (card) {
            card.dataset.stage =
              stage;
          }

          
        }
      });

      /*
       * The Immersive Day door is worked from the tick, not only
       * from the stage flip: the dock's Day Details button is
       * seated by the shell rebuild and may not exist in the same
       * instant the zoom crosses the threshold. Entry therefore
       * gets a short run of attempts (about three seconds). The
       * attempts stop the moment the door opens, the stage leaves
       * Immersive Day, or the run is spent — so a keeper who
       * closes the sheet by hand at closest zoom is never fought:
       * by then the run is over, and zoom only ever closes a
       * sheet it opened itself.
       */
      let immersiveAttempts = 0;
      let wasImmersive = false;

      const tick = () => {
        // A sheet the keeper closed by hand is no longer zoom's to
        // close; forget the claim before the next stage change.
        if (!roomsOpen()) {
          openedByZoom = false;
        }

        currentCard();

        const stageNow =
          depth.update();

        const immersive =
          stageNow === "immersive";

        if (immersive && !wasImmersive) {
          immersiveAttempts = 15;
        }

        wasImmersive = immersive;

        const fullPage =
          document.documentElement.classList.contains(
            "sphere-full-page"
          );

        if (immersive && immersiveAttempts > 0 && !roomsOpen() && !fullPage) {
          immersiveAttempts -= 1;

          const button =
            document.querySelector(
              "[data-sphere-rebuild-daydetails]"
            );

          if (button) {
            openedByZoom = true;
            button.click();
            immersiveAttempts = 0;
          }
        }

        if (!immersive && openedByZoom) {
          openedByZoom = false;

          if (roomsOpen()) {
            document
              .querySelector(".sphere-sheet-close")
              ?.click();
          }
        }
      };

      const timer =
        setInterval(tick, 200);

      if (typeof timer === "object" && typeof timer.unref === "function") {
        timer.unref();
      }

      container.addEventListener("sphere:interact-end", tick);
      window.addEventListener("sof:temporal-cursor-change", tick);

      tick();

      return depth;
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
      buildDayView,
      isPracticeRecord,
      practiceKindOf,
      mergeRecords,
      PRACTICE_SUBTYPE,
      PRACTICE_KIND_GLYPHS,

      createDayZoom,

      formatCivilDate,
      coordinateLine,
      renderDayZoom,
      initDayZoom,

      ZOOM_STAGES,
      ZOOM_STAGE_BOUNDS,
      zoomStageForDistance,
      dayWorldGlyphForEntry,
      createZoomDepth,
      renderDayWorldCard,
      startZoomDepth
    });
  }
);
