/*
 * Deep Time — Sphere R3, Wave 2.
 *
 * The Sphere shows one year. This layer gives it years: travel by
 * year, the historical onion (the current 13-year spiral in full,
 * decades beyond it as structural rings), and the Alignment Plane,
 * where two days stand side by side and what lines up between them
 * is shown — never what it means.
 *
 * Overlay discipline (the PR #159 pattern, binding here, and the
 * Day World's after it):
 *   - This module lives beside the instrument. It never touches the
 *     sphere engine, geometry, camera, motion, picking, or labels,
 *     and it never moves the Sphere's own year. The travel state it
 *     keeps — the year the visitor is standing in — is a separate
 *     notion from the Sphere's current date and from the picked day,
 *     and the three are never confused in this code.
 *   - One clock: every coordinate comes through the canonical line
 *     (SOFTemporalCursor → PatternCalendar). Dates are converted by
 *     PatternCalendar.fromCivilDate; a day's records are gathered
 *     through the day-zoom module's own public pieces (buildDayView,
 *     mergeRecords, and the same three record reads its controller
 *     makes), never through a private copy of the calendar.
 *   - One translation, named plainly: PatternCalendar counts years
 *     from the epoch (2026 is its year 1), while the record layer —
 *     the cursor, the planner, Day Notes, the Life Atlas — stamps
 *     records with the anchor's civil year (2026). Selections built
 *     here carry the record layer's year, so a day's records match
 *     the day. The moon, day, and Pattern Day in every selection are
 *     PatternCalendar's own, exactly as the day's telling speaks
 *     them.
 *   - Honesty of content: a year or a day shows only records that
 *     exist. Empty is shown as empty and says so. A year this device
 *     has not counted is drawn as structure and labeled uncounted —
 *     never as empty, which would be a claim nobody made. The
 *     Alignment Plane shows alignments; meaning is interpretation
 *     and stays with the reader.
 *   - The Spark is referred to by name, as "the Spark", or as
 *     "it/they" — never with feminine pronouns.
 */
(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.CodexSphereDeepTime = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "sphere-deep-time/1.0.0";

  /* PatternCalendar counts 2026 as year 1; the record layer stamps
   * the anchor's civil year. The distance between the two counts is
   * the epoch year minus one. */
  const RECORD_YEAR_OFFSET = 2025;

  const SPIRAL_YEARS = 13;
  const RING_YEARS = 10;
  const HORIZON_BACK = 200;
  const HORIZON_FORWARD = 99;

  /* Plain-words explanations (Aaron's simplification mandate): every
   * part of the view says what it is and how to use it. */
  const EXPLAINERS = Object.freeze({
    view:
      "Deep Time is where the Sphere gains years. The Sphere behind you still shows its own year — nothing here moves it. This view is a reading room laid over the Sphere: travel by year, see how much each year holds on this device, open a far day where something was kept, and stand two days side by side.",
    travel:
      "Step through the years: one at a time, thirteen at a time (one full spiral), or ten at a time. The year you are standing in is named below. Standing in a year is not the same as picking a day on the Sphere, and neither one moves the Sphere. Today is always one tap home.",
    rings:
      "The rings are the onion. The thirteen rings at the centre are the current spiral — this year and the twelve before it. A ring glows stronger when its year holds records on this device; a faint ring is a counted year with nothing kept in it here. The dashed rings beyond are decades, drawn as the calendar's shape. Tap a ring to stand in its year.",
    year:
      "The year you are standing in, moon by moon. Days with something kept are listed under their moons — open one to see it in full. A year with nothing kept in it still stands complete: thirteen moons, counted the same as any year. Nothing is added to fill it.",
    day:
      "One day in full: its place in the count, its telling, and everything kept for it on this device. If nothing is kept, the day says so — its telling still stands.",
    plane:
      "The Alignment Plane stands two days side by side and shows what lines up between them: the same Moon and Day in different years, the same Pattern Day, the distance between them in days and moons. It shows the alignment only. What an alignment means is interpretation, and that stays with the reader.",
    counts:
      "Counts are records in your Life Atlas on this device, stamped with their pattern year. Another device would count its own records. A year drawn faint and marked uncounted was not counted on this device — that is different from a counted year that holds nothing."
  });

  const KIND_TINTS = Object.freeze({
    fire: "fire",
    water: "water",
    shadow: "shadow",
    air: "air",
    earth: "earth",
    light: "light"
  });

  function cleanText(value, max = 300) {
    if (value === null || value === undefined) return "";
    return String(value).replace(/\s+/g, " ").trim().slice(0, max);
  }

  function finite(value) {
    if (value === undefined || value === null || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function isoOf(date) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function parseCivil(civilDate) {
    if (typeof civilDate !== "string") return null;
    const match = /^(\d{4,})-(\d{2})-(\d{2})$/.exec(civilDate.trim());
    if (!match) return null;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  /* Whole days between two civil dates, signed (b minus a). Plain
   * date arithmetic on civil dates — no calendar counting. */
  function daysBetweenCivil(a, b) {
    const start = parseCivil(a);
    const end = parseCivil(b);
    if (!start || !end) return null;
    return Math.round((end.getTime() - start.getTime()) / 86400000);
  }

  /* The civil date of a Pattern Day in a pattern year, from the
   * calendar's own epoch for that year (the record layer's year —
   * the anchor's civil year — is the epoch's civil year). A null
   * Pattern Day names the year's first day outside the count: the
   * Day Out of Time. Returns null when the calendar cannot say. */
  function civilDateForPatternDay(patternYear, patternDay, calendar) {
    const engine = calendar || (typeof globalThis !== "undefined" ? globalThis.PatternCalendar : null);
    if (!engine || typeof engine.epochForYear !== "function") return null;
    if (!Number.isFinite(patternYear)) return null;

    const start = engine.epochForYear(patternYear);
    if (!(start instanceof Date) || Number.isNaN(start.getTime())) return null;

    const offset = patternDay === null || patternDay === undefined ? 364 : patternDay - 1;
    if (!Number.isFinite(offset) || offset < 0) return null;

    const date = new Date(start.getTime() + offset * 86400000);
    if (Number.isNaN(date.getTime())) return null;
    return isoOf(date);
  }

  /* The length of a pattern year's window in days (365, or 366 in a
   * leap window), from the calendar's own epochs. */
  function windowDaysForYear(patternYear, calendar) {
    const engine = calendar || (typeof globalThis !== "undefined" ? globalThis.PatternCalendar : null);
    if (!engine || typeof engine.epochForYear !== "function") return null;
    const start = engine.epochForYear(patternYear);
    const next = engine.epochForYear(patternYear + 1);
    if (!(start instanceof Date) || !(next instanceof Date)) return null;
    const days = Math.round((next.getTime() - start.getTime()) / 86400000);
    return Number.isFinite(days) ? days : null;
  }

  /* A day-zoom-shaped selection for any civil date, built from
   * PatternCalendar's own conversion, with the year translated into
   * the record layer's count so the day's records match the day. */
  function selectionForCivilDate(civilDate, calendar) {
    const engine = calendar || (typeof globalThis !== "undefined" ? globalThis.PatternCalendar : null);
    if (!engine || typeof engine.fromCivilDate !== "function") return null;
    const date = parseCivil(civilDate);
    if (!date) return null;

    const summary = engine.fromCivilDate({ date });
    if (!summary) return null;

    const patternDay = summary.insideCountedYear ? summary.dayOfPatternYear : null;

    return {
      civilDate: summary.civilDate,
      patternYear: Number.isFinite(summary.patternYear)
        ? summary.patternYear + RECORD_YEAR_OFFSET
        : null,
      patternDay,
      moon: summary.insideCountedYear ? summary.moon : null,
      moonDay: summary.insideCountedYear ? summary.day : null,
      week: summary.insideCountedYear ? summary.weekOfMoon : null,
      moonName: summary.insideCountedYear ? summary.moonName : null,
      isYearGate: patternDay === 364,
      isDayOutOfTime: Boolean(summary.isDayOutOfTime),
      isDeepTimeDay: Boolean(summary.isDeepTimeDay)
    };
  }

  /* Count a year's records by day, mirroring the day-zoom module's
   * recordsForDay rule: a record belongs to a day when its stamped
   * pattern year and pattern day match, and a record carrying only
   * a civil date belongs to that civil date's day. The input list
   * is the year's merged records, gathered the way the day-zoom
   * controller gathers them. */
  function dayCountsForYear(records, patternYear, calendar) {
    const counts = {};
    const civilOnly = {};
    (Array.isArray(records) ? records : []).forEach(record => {
      if (!record) return;
      const recordDay = finite(record.temporal?.patternDay);
      const recordCivil = cleanText(record.temporal?.civilDate, 20);
      if (recordDay !== null) {
        counts[recordDay] = (counts[recordDay] || 0) + 1;
      } else if (recordCivil) {
        civilOnly[recordCivil] = (civilOnly[recordCivil] || 0) + 1;
      }
    });

    const byDay = {};
    for (let patternDay = 1; patternDay <= 364; patternDay += 1) {
      const civil = civilDateForPatternDay(patternYear, patternDay, calendar);
      const total = (counts[patternDay] || 0) + (civil ? civilOnly[civil] || 0 : 0);
      if (total > 0) byDay[patternDay] = total;
    }

    const intercalary = [];
    const dotCivil = civilDateForPatternDay(patternYear, null, calendar);
    if (dotCivil) {
      intercalary.push({
        kind: "day-out-of-time",
        label: "Day Out of Time",
        civilDate: dotCivil,
        recordCount: civilOnly[dotCivil] || 0
      });
    }
    if (windowDaysForYear(patternYear, calendar) === 366) {
      /* The Deep Time Day is the second day outside the count:
       * epoch + 365 days, one past the Day Out of Time. */
      const leapCivil = civilDateForPatternDay(patternYear, 366, calendar);
      if (leapCivil) {
        intercalary.push({
          kind: "deep-time-day",
          label: "Deep Time Day",
          civilDate: leapCivil,
          recordCount: civilOnly[leapCivil] || 0
        });
      }
    }

    return { byDay, intercalary };
  }

  /* The onion: the current 13-year spiral in full, then decade
   * rings back to the horizon. countsByYear maps a pattern year to
   * its record count on this device; a year with no entry was not
   * counted here, and the model keeps that distinct from zero. */
  function buildSpiralModel({ currentPatternYear, countsByYear = {} } = {}) {
    if (!Number.isFinite(currentPatternYear)) {
      return { ready: false, version: VERSION };
    }

    const spiralStart = currentPatternYear - (SPIRAL_YEARS - 1);
    const spiral = [];
    for (let year = spiralStart; year <= currentPatternYear; year += 1) {
      const counted = Object.prototype.hasOwnProperty.call(countsByYear, year);
      const recordCount = counted ? finite(countsByYear[year]) ?? 0 : null;
      spiral.push({
        patternYear: year,
        recordCount,
        counted,
        hasRecords: counted && recordCount > 0,
        isCurrent: year === currentPatternYear
      });
    }

    const rings = [];
    let end = spiralStart - 1;
    const floor = currentPatternYear - HORIZON_BACK;
    while (end >= floor) {
      const start = Math.max(floor, end - (RING_YEARS - 1));
      let countedYears = 0;
      let total = 0;
      for (let year = start; year <= end; year += 1) {
        if (Object.prototype.hasOwnProperty.call(countsByYear, year)) {
          countedYears += 1;
          total += finite(countsByYear[year]) ?? 0;
        }
      }
      rings.push({
        startYear: start,
        endYear: end,
        label: `Years ${start}–${end}`,
        recordCount: countedYears === end - start + 1 ? total : null,
        countedYears,
        totalYears: end - start + 1,
        hasRecords: countedYears > 0 && total > 0
      });
      end = start - 1;
    }

    return {
      ready: true,
      version: VERSION,
      currentPatternYear,
      spiralStart,
      spiral,
      rings,
      horizonBack: HORIZON_BACK,
      horizonNote:
        "The full onion runs two hundred years back. Rings beyond the spiral are the calendar's shape; a ring is counted only when this device has counted every year in it."
    };
  }

  /* One year standing open: thirteen moons, the days that hold
   * records listed under their moons, and the days outside the
   * count named at the end. Pure structure plus real counts —
   * nothing else. */
  function buildYearModel({ patternYear, moonNames = [], dayCounts = {}, intercalary = [], calendar = null } = {}) {
    if (!Number.isFinite(patternYear)) {
      return { ready: false, version: VERSION };
    }

    const moons = [];
    let totalRecords = 0;
    for (let moon = 1; moon <= 13; moon += 1) {
      const startPatternDay = (moon - 1) * 28 + 1;
      const endPatternDay = moon * 28;
      const days = [];
      let recordCount = 0;
      for (let patternDay = startPatternDay; patternDay <= endPatternDay; patternDay += 1) {
        const count = finite(dayCounts[patternDay]) ?? 0;
        if (count > 0) {
          recordCount += count;
          days.push({
            patternDay,
            moonDay: patternDay - startPatternDay + 1,
            civilDate: civilDateForPatternDay(patternYear, patternDay, calendar),
            recordCount: count
          });
        }
      }
      totalRecords += recordCount;
      moons.push({
        moon,
        name: cleanText(moonNames[moon - 1], 60) || null,
        startPatternDay,
        endPatternDay,
        startCivil: civilDateForPatternDay(patternYear, startPatternDay, calendar),
        endCivil: civilDateForPatternDay(patternYear, endPatternDay, calendar),
        recordCount,
        days
      });
    }

    const outside = (Array.isArray(intercalary) ? intercalary : []).map(entry => ({
      kind: entry.kind,
      label: entry.label,
      civilDate: entry.civilDate || null,
      recordCount: finite(entry.recordCount) ?? 0
    }));
    outside.forEach(entry => {
      totalRecords += entry.recordCount;
    });

    return {
      ready: true,
      version: VERSION,
      patternYear,
      yearStartCivil: civilDateForPatternDay(patternYear, 1, calendar),
      nextYearStartCivil: (() => {
        const engine = calendar || (typeof globalThis !== "undefined" ? globalThis.PatternCalendar : null);
        if (!engine || typeof engine.epochForYear !== "function") return null;
        const next = engine.epochForYear(patternYear + 1);
        return next instanceof Date && !Number.isNaN(next.getTime()) ? isoOf(next) : null;
      })(),
      moons,
      intercalary: outside,
      totalRecords,
      hasRecords: totalRecords > 0
    };
  }

  function daySummary(selection, view, telling) {
    const entries = Array.isArray(view?.entries) ? view.entries : [];
    return {
      civilDate: selection?.civilDate || null,
      patternYear: selection?.patternYear ?? null,
      patternDay: selection?.patternDay ?? null,
      moon: selection?.moon ?? null,
      moonDay: selection?.moonDay ?? null,
      moonName: selection?.moonName || null,
      isYearGate: Boolean(selection?.isYearGate),
      isDayOutOfTime: Boolean(selection?.isDayOutOfTime),
      isDeepTimeDay: Boolean(selection?.isDeepTimeDay),
      telling: telling
        ? {
            headline: cleanText(telling.headline, 140),
            position: (telling.position || []).map(line => cleanText(line, 400)).filter(Boolean),
            readingLabel: cleanText(telling.readingLabel, 60) || "The Codex's reading",
            reading: (telling.reading || []).map(line => cleanText(line, 400)).filter(Boolean)
          }
        : null,
      entries: entries.map(entry => ({
        title: cleanText(entry.title || entry.label || entry.summary, 140) || "A kept record",
        time: cleanText(entry.timeLabel || entry.time || "", 40),
        kind: cleanText(entry.type || entry.kindLabel || entry.kind || "", 40)
      })),
      entryCount: entries.length,
      empty: entries.length === 0
    };
  }

  /* One day in full, for the year view's day opening. */
  function buildDayDetail({ selection = null, view = null, telling = null } = {}) {
    if (!selection || !selection.civilDate) {
      return { ready: false, version: VERSION };
    }
    return { ready: true, version: VERSION, ...daySummary(selection, view, telling) };
  }

  /* The Alignment Plane: two days side by side, and the lines that
   * state what lines up — facts only, each one checkable from the
   * two coordinates. Meaning is not computed here. */
  function buildAlignmentModel({ a = null, b = null } = {}) {
    if (!a || !b || !a.selection || !b.selection) {
      return { ready: false, version: VERSION };
    }

    const sideA = daySummary(a.selection, a.view, a.telling);
    const sideB = daySummary(b.selection, b.view, b.telling);
    const distance = daysBetweenCivil(sideA.civilDate, sideB.civilDate);
    const lines = [];

    if (sideA.civilDate && sideA.civilDate === sideB.civilDate) {
      lines.push("These are the same day, standing on both sides of the plane.");
    } else {
      if (
        sideA.patternDay !== null &&
        sideB.patternDay !== null &&
        sideA.patternDay === sideB.patternDay
      ) {
        const yearsApart = Math.abs((sideB.patternYear ?? 0) - (sideA.patternYear ?? 0));
        lines.push(
          `Both days are Pattern Day ${sideA.patternDay} — Moon ${sideA.moon}, Day ${sideA.moonDay}` +
            (yearsApart > 0
              ? ` — the same place in the count, ${yearsApart} pattern ${yearsApart === 1 ? "year" : "years"} apart.`
              : ", in the same pattern year.")
        );
      } else if (sideA.moon !== null && sideB.moon !== null && sideA.moon === sideB.moon) {
        lines.push(
          `Both days sit in Moon ${sideA.moon}${sideA.moonName ? `, the ${sideA.moonName} moon` : ""} — different days of the same moon.`
        );
      }

      if (sideA.patternDay === null || sideB.patternDay === null) {
        lines.push(
          "One of these days stands outside the 364-day count, so it carries no Pattern Day to line up. The distance between the days still holds."
        );
      }

      if (distance !== null && distance !== 0) {
        const span = Math.abs(distance);
        const moons = Math.floor(span / 28);
        const rest = span % 28;
        const spanText =
          moons > 0
            ? `${span} days — ${moons} full ${moons === 1 ? "moon" : "moons"} of 28 days${rest > 0 ? ` and ${rest} more ${rest === 1 ? "day" : "days"}` : ""}`
            : `${span} ${span === 1 ? "day" : "days"}`;
        lines.push(
          distance > 0
            ? `The second day comes ${spanText} after the first.`
            : `The second day comes ${spanText} before the first.`
        );
      }
    }

    if (sideA.empty && sideB.empty) {
      lines.push("Neither day holds records on this device. The alignment stands on the count alone.");
    } else if (sideA.empty || sideB.empty) {
      lines.push("One of these days holds records on this device; the other holds none. Both tellings stand either way.");
    }

    return {
      ready: true,
      version: VERSION,
      a: sideA,
      b: sideB,
      distanceDays: distance,
      lines,
      meaningNote:
        "The plane shows what lines up. What an alignment means is interpretation, and the Codex leaves that to the reader."
    };
  }

  function sparkTint(kind) {
    const key = cleanText(kind, 20).toLowerCase();
    return KIND_TINTS[key] || "none";
  }

  /* ------------------------- browser layer ------------------------- */

  function resolveRepository() {
    /* The resolve idiom copied from day-notes.js / sphere-day-world.js. */
    return (async () => {
      const runtime = typeof globalThis !== "undefined" ? globalThis.CodexLifeAtlasRuntime : null;
      if (runtime?.ready) {
        try {
          const repository = await runtime.ready;
          if (repository) return repository;
        } catch {
          /* fall through */
        }
      }
      const Repository = typeof globalThis !== "undefined" ? globalThis.CodexLifeAtlasRepository : null;
      if (!Repository) return null;
      try {
        if (typeof Repository.createPersistentRepository === "function") {
          return Repository.createPersistentRepository();
        }
      } catch {
        /* fall through */
      }
      try {
        return Repository.createRepository();
      } catch {
        return null;
      }
    })();
  }

  function readSpark() {
    try {
      const Core = typeof window !== "undefined" ? window.SparkCompanion : null;
      if (!Core) return null;
      const raw = window.localStorage.getItem(Core.STORAGE_KEY);
      if (!raw) return null;
      const record = JSON.parse(raw);
      if (!record || !Core.parseSeed(record.seed)) return null;
      const generated = Core.generate(record.seed);
      return {
        name: Core.displayName(record, generated),
        kind: (generated && (generated.kind || generated.element)) || record.kind || ""
      };
    } catch {
      return null;
    }
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function initDeepTime() {
    const panel = document.getElementById("sphere-day-zoom-panel");
    const DayZoom = typeof window !== "undefined" ? window.LivingTimeSphereDayZoom : null;
    const Calendar = typeof window !== "undefined" ? window.PatternCalendar : null;
    if (!panel || !DayZoom || typeof DayZoom.createDayZoom !== "function" || !Calendar) return;
    if (document.querySelector("[data-deep-time]")) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const todaySelection = selectionForCivilDate(isoOf(new Date()), Calendar);
    const currentPatternYear = todaySelection ? todaySelection.patternYear : null;
    if (!currentPatternYear) return;

    let standingYear = currentPatternYear;
    let viewOpen = false;
    let selectedCivil = todaySelection.civilDate;
    let countsByYear = {};
    let yearRecordsCache = new Map();
    let planeA = todaySelection.civilDate;
    let planeB = todaySelection.civilDate;

    /* --- the door, resting under the quick-look panel --- */
    const door = el("div", "deep-time-door");
    door.setAttribute("data-deep-time-door", "");
    const doorButton = el("button", "deep-time-door-button", "Step into Deep Time");
    doorButton.type = "button";
    const doorLine = el(
      "p",
      "deep-time-door-line",
      "Travel by year, see the thirteen-year spiral whole, and stand two days side by side."
    );
    door.append(doorButton, doorLine);
    panel.insertAdjacentElement("afterend", door);

    /* --- the view --- */
    const view = el("div", "deep-time");
    view.setAttribute("data-deep-time", "");
    view.hidden = true;
    view.setAttribute("role", "dialog");
    view.setAttribute("aria-modal", "true");
    view.setAttribute("aria-labelledby", "deep-time-title");
    const sheet = el("div", "deep-time-sheet");
    view.append(sheet);
    document.body.append(view);

    function section(title, explainer) {
      const wrap = el("section", "deep-time-section");
      wrap.append(el("h3", "deep-time-section-title", title));
      if (explainer) wrap.append(el("p", "deep-time-explain", explainer));
      return wrap;
    }

    function moonNames() {
      const data = window.PatternCalendarData;
      const moons = data && Array.isArray(data.moons) ? data.moons : [];
      return moons.map(moon => (moon && moon.name) || null);
    }

    async function gatherYearRecords(patternYear) {
      if (yearRecordsCache.has(patternYear)) return yearRecordsCache.get(patternYear);
      let records = [];

      const planner = window.CodexLivingPlanner || null;
      if (planner && typeof planner.plansForYear === "function") {
        try {
          records = (await planner.plansForYear(patternYear)) || [];
        } catch {
          records = [];
        }
      }

      const repository = await resolveRepository();
      if (repository && typeof repository.query === "function") {
        try {
          const practice = (await repository.query({ subtype: DayZoom.PRACTICE_SUBTYPE, patternYear })) || [];
          const all = (await repository.query({ patternYear })) || [];
          records = DayZoom.mergeRecords(DayZoom.mergeRecords(records, practice), all);
        } catch {
          /* keep what the planner gave */
        }
      }

      yearRecordsCache.set(patternYear, records);
      return records;
    }

    async function gatherCounts() {
      const repository = await resolveRepository();
      if (!repository || typeof repository.query !== "function") return;
      const years = [];
      for (let year = currentPatternYear - (SPIRAL_YEARS - 1); year <= currentPatternYear; year += 1) {
        years.push(year);
      }
      for (const year of years) {
        try {
          const records = await repository.query({ patternYear: year });
          countsByYear[year] = Array.isArray(records) ? records.length : 0;
        } catch {
          /* leave the year uncounted */
        }
      }
    }

    function tellingFor(civilDate) {
      if (!civilDate || !window.DayTelling || typeof window.DayTelling.tellForDate !== "function") {
        return null;
      }
      const date = parseCivil(civilDate);
      return date ? window.DayTelling.tellForDate(date) : null;
    }

    async function dayDetailFor(civilDate) {
      const selection = selectionForCivilDate(civilDate, Calendar);
      if (!selection) return null;
      const records = await gatherYearRecords(selection.patternYear);
      const scheduling = window.CodexLifeAtlasScheduling || null;
      const dayView = DayZoom.buildDayView({ selection, records, scheduling });
      return buildDayDetail({ selection, view: dayView, telling: tellingFor(civilDate) });
    }

    function renderDayInto(container, detail) {
      container.replaceChildren();
      if (!detail || !detail.ready) {
        container.append(el("p", "deep-time-line", "That day could not be read."));
        return;
      }
      const selection = {
        civilDate: detail.civilDate,
        patternYear: detail.patternYear,
        patternDay: detail.patternDay,
        moon: detail.moon,
        moonDay: detail.moonDay,
        moonName: detail.moonName,
        week: null,
        isYearGate: detail.isYearGate,
        isDayOutOfTime: detail.isDayOutOfTime
      };
      container.append(el("p", "deep-time-day-coordinate", DayZoom.coordinateLine(selection)));
      container.append(el("p", "deep-time-day-civil", DayZoom.formatCivilDate(detail.civilDate)));
      if (detail.telling) {
        container.append(el("p", "deep-time-headline", detail.telling.headline));
        detail.telling.position.forEach(line => container.append(el("p", "deep-time-line", line)));
        if (detail.telling.reading.length) {
          container.append(el("p", "deep-time-reading-label", detail.telling.readingLabel));
          detail.telling.reading.forEach(line => container.append(el("p", "deep-time-line", line)));
        }
      }
      if (detail.empty) {
        container.append(
          el(
            "p",
            "deep-time-line",
            "Nothing is kept for this day on this device. The day is still complete — its place in the count and its telling are here."
          )
        );
      } else {
        const list = el("ul", "deep-time-entries");
        detail.entries.forEach(entry => {
          const item = el("li", "deep-time-entry");
          item.append(el("span", "deep-time-entry-title", entry.title));
          const meta = [entry.time, entry.kind].filter(Boolean).join(" · ");
          if (meta) item.append(el("span", "deep-time-entry-meta", meta));
          list.append(item);
        });
        container.append(list);
      }
    }

    const dayDetailBox = el("div", "deep-time-day-detail");
    dayDetailBox.hidden = true;

    async function openDay(civilDate) {
      dayDetailBox.hidden = false;
      dayDetailBox.replaceChildren(el("p", "deep-time-line", "Reading the day…"));
      dayDetailBox.scrollIntoView({ block: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
      renderDayInto(dayDetailBox, await dayDetailFor(civilDate));
    }

    function ringsSvg(model) {
      const NS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(NS, "svg");
      svg.setAttribute("viewBox", "0 0 320 320");
      svg.setAttribute("class", "deep-time-rings");
      svg.setAttribute("role", "img");
      svg.setAttribute(
        "aria-label",
        `Rings of years: the spiral from ${model.spiralStart} to ${model.currentPatternYear}, with decades beyond drawn as structure.`
      );

      model.rings.forEach((ring, index) => {
        const circle = document.createElementNS(NS, "circle");
        circle.setAttribute("cx", "160");
        circle.setAttribute("cy", "160");
        circle.setAttribute("r", String(118 + index * 9));
        circle.setAttribute("class", "deep-time-ring-decade" + (ring.hasRecords ? " has-records" : ""));
        const title = document.createElementNS(NS, "title");
        title.textContent =
          ring.recordCount !== null
            ? `${ring.label}: ${ring.recordCount} records kept on this device.`
            : `${ring.label}: structure only — not counted on this device.`;
        circle.append(title);
        svg.append(circle);
      });

      [...model.spiral].reverse().forEach(entry => {
        const index = entry.patternYear - model.spiralStart;
        const circle = document.createElementNS(NS, "circle");
        circle.setAttribute("cx", "160");
        circle.setAttribute("cy", "160");
        circle.setAttribute("r", String(22 + index * 7.4));
        circle.setAttribute(
          "class",
          "deep-time-ring-year" +
            (entry.hasRecords ? " has-records" : "") +
            (entry.isCurrent ? " is-current" : "") +
            (entry.patternYear === standingYear ? " is-standing" : "")
        );
        circle.setAttribute("tabindex", "0");
        circle.setAttribute("role", "button");
        circle.setAttribute(
          "aria-label",
          `Stand in year ${entry.patternYear}` +
            (entry.isCurrent ? " (this year)" : "") +
            (entry.counted
              ? entry.recordCount > 0
                ? ` — ${entry.recordCount} records kept on this device`
                : " — counted, nothing kept in it here"
              : " — not counted on this device")
        );
        const title = document.createElementNS(NS, "title");
        title.textContent = `Year ${entry.patternYear}`;
        circle.append(title);
        const stand = () => {
          standingYear = entry.patternYear;
          void renderView();
        };
        circle.addEventListener("click", stand);
        circle.addEventListener("keydown", event => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            stand();
          }
        });
        svg.append(circle);
      });

      return svg;
    }

    async function renderView() {
      sheet.replaceChildren();
      const spark = readSpark();
      sheet.dataset.tint = spark ? sparkTint(spark.kind) : "none";

      const header = el("header", "deep-time-head");
      header.append(el("p", "deep-time-kicker", "Deep Time"));
      const title = el("h2", "deep-time-title", "The years behind the year");
      title.id = "deep-time-title";
      header.append(title);
      header.append(el("p", "deep-time-explain", EXPLAINERS.view));
      if (spark) {
        header.append(
          el(
            "p",
            "deep-time-line",
            `${spark.name} travels with you here too — the light of this room carries a little of its kind.`
          )
        );
      }
      const back = el("button", "deep-time-back", "Back to the Sphere");
      back.type = "button";
      back.addEventListener("click", closeView);
      header.append(back);
      sheet.append(header);

      /* --- travel + the onion --- */
      const travel = section("Travel by year", EXPLAINERS.travel);
      const standingLine = el(
        "p",
        "deep-time-standing",
        standingYear === currentPatternYear
          ? `You are standing in year ${standingYear} — this year. Its first day was ${DayZoom.formatCivilDate(civilDateForPatternDay(standingYear, 1, Calendar))}.`
          : `You are standing in year ${standingYear}. Its first day was ${DayZoom.formatCivilDate(civilDateForPatternDay(standingYear, 1, Calendar))}. Today is in year ${currentPatternYear}.`
      );
      travel.append(standingLine);

      const controls = el("div", "deep-time-controls");
      const step = (label, delta) => {
        const button = el("button", "deep-time-btn", label);
        button.type = "button";
        button.addEventListener("click", () => {
          standingYear = Math.min(
            currentPatternYear + HORIZON_FORWARD,
            Math.max(currentPatternYear - HORIZON_BACK, standingYear + delta)
          );
          void renderView();
        });
        return button;
      };
      controls.append(
        step("‹ 13 years", -13),
        step("‹ 10 years", -10),
        step("‹ 1 year", -1),
        step("1 year ›", 1),
        step("10 years ›", 10),
        step("13 years ›", 13)
      );
      const home = el("button", "deep-time-btn deep-time-btn-home", "Today — back to this year");
      home.type = "button";
      home.addEventListener("click", () => {
        standingYear = currentPatternYear;
        void renderView();
      });
      controls.append(home);
      travel.append(controls);

      const spiralModel = buildSpiralModel({ currentPatternYear, countsByYear });
      if (spiralModel.ready) {
        travel.append(ringsSvg(spiralModel));
        travel.append(el("p", "deep-time-explain", EXPLAINERS.rings));
        travel.append(el("p", "deep-time-explain", EXPLAINERS.counts));
        travel.append(el("p", "deep-time-explain", spiralModel.horizonNote));
      }
      sheet.append(travel);

      /* --- the standing year --- */
      const yearSection = section(`Year ${standingYear}`, EXPLAINERS.year);
      const yearBody = el("div", "deep-time-year-body");
      yearBody.append(el("p", "deep-time-line", "Reading the year…"));
      yearSection.append(yearBody);
      sheet.append(yearSection);

      const records = await gatherYearRecords(standingYear);
      const counts = dayCountsForYear(records, standingYear, Calendar);
      if (!viewOpen) return;
      const yearModel = buildYearModel({
        patternYear: standingYear,
        moonNames: moonNames(),
        dayCounts: counts.byDay,
        intercalary: counts.intercalary,
        calendar: Calendar
      });
      yearBody.replaceChildren();
      if (yearModel.ready) {
        yearBody.append(
          el(
            "p",
            "deep-time-line",
            yearModel.hasRecords
              ? `This year holds ${yearModel.totalRecords} ${yearModel.totalRecords === 1 ? "record" : "records"} on this device.`
              : "Nothing is kept in this year on this device. The year stands as structure — thirteen moons, counted the same as any year."
          )
        );
        const moonList = el("div", "deep-time-moons");
        yearModel.moons.forEach(moon => {
          const row = el("div", "deep-time-moon");
          const head = el(
            "p",
            "deep-time-moon-head",
            `Moon ${moon.moon}${moon.name ? ` · ${moon.name}` : ""} — ${DayZoom.formatCivilDate(moon.startCivil)} to ${DayZoom.formatCivilDate(moon.endCivil)}` +
              (moon.recordCount > 0 ? ` · ${moon.recordCount} kept` : "")
          );
          row.append(head);
          moon.days.forEach(day => {
            const button = el(
              "button",
              "deep-time-day-button",
              `Day ${day.moonDay} · Pattern Day ${day.patternDay} — ${DayZoom.formatCivilDate(day.civilDate)} · ${day.recordCount} kept`
            );
            button.type = "button";
            button.addEventListener("click", () => void openDay(day.civilDate));
            row.append(button);
          });
          moonList.append(row);
        });
        yearBody.append(moonList);
        yearModel.intercalary.forEach(entry => {
          if (entry.recordCount <= 0) return;
          const button = el(
            "button",
            "deep-time-day-button",
            `${entry.label} — ${DayZoom.formatCivilDate(entry.civilDate)} · ${entry.recordCount} kept`
          );
          button.type = "button";
          button.addEventListener("click", () => void openDay(entry.civilDate));
          yearBody.append(button);
        });
      }

      /* --- one day in full --- */
      const daySection = section("One day in full", EXPLAINERS.day);
      daySection.append(dayDetailBox);
      sheet.append(daySection);

      /* --- the Alignment Plane --- */
      const plane = section("The Alignment Plane", EXPLAINERS.plane);
      const planeControls = el("div", "deep-time-plane-controls");
      const makeSide = (label, get, set) => {
        const wrap = el("div", "deep-time-plane-side-controls");
        wrap.append(el("p", "deep-time-plane-side-label", label));
        const input = document.createElement("input");
        input.type = "date";
        input.className = "deep-time-date-input";
        input.value = get();
        input.setAttribute("aria-label", `${label} — pick a date`);
        input.addEventListener("change", () => {
          if (input.value) set(input.value);
        });
        wrap.append(input);
        const todayButton = el("button", "deep-time-btn", "Use today");
        todayButton.type = "button";
        todayButton.addEventListener("click", () => {
          set(todaySelection.civilDate);
          input.value = todaySelection.civilDate;
        });
        const pickedButton = el("button", "deep-time-btn", "Use the day picked on the Sphere");
        pickedButton.type = "button";
        pickedButton.addEventListener("click", () => {
          if (selectedCivil) {
            set(selectedCivil);
            input.value = selectedCivil;
          }
        });
        wrap.append(todayButton, pickedButton);
        return wrap;
      };
      planeControls.append(
        makeSide("First day", () => planeA, value => { planeA = value; }),
        makeSide("Second day", () => planeB, value => { planeB = value; })
      );
      plane.append(planeControls);
      const planeBody = el("div", "deep-time-plane-body");
      const standButton = el("button", "deep-time-btn deep-time-btn-home", "Stand them side by side");
      standButton.type = "button";
      standButton.addEventListener("click", async () => {
        planeBody.replaceChildren(el("p", "deep-time-line", "Standing the days side by side…"));
        const [detailA, detailB] = await Promise.all([dayDetailFor(planeA), dayDetailFor(planeB)]);
        const model = buildAlignmentModel({
          a: detailA ? { selection: selectionForCivilDate(planeA, Calendar), view: { entries: detailA.entries }, telling: detailA.telling } : null,
          b: detailB ? { selection: selectionForCivilDate(planeB, Calendar), view: { entries: detailB.entries }, telling: detailB.telling } : null
        });
        planeBody.replaceChildren();
        if (!model.ready) {
          planeBody.append(el("p", "deep-time-line", "Those two days could not be read."));
          return;
        }
        const columns = el("div", "deep-time-plane-columns");
        const colA = el("div", "deep-time-plane-column");
        const colB = el("div", "deep-time-plane-column");
        renderDayInto(colA, detailA);
        renderDayInto(colB, detailB);
        columns.append(colA, colB);
        planeBody.append(columns);
        const linesBox = el("div", "deep-time-plane-lines");
        linesBox.append(el("p", "deep-time-plane-lines-title", "What lines up"));
        model.lines.forEach(line => linesBox.append(el("p", "deep-time-line", line)));
        linesBox.append(el("p", "deep-time-explain", model.meaningNote));
        planeBody.append(linesBox);
      });
      plane.append(standButton, planeBody);
      sheet.append(plane);
    }

    function openView() {
      viewOpen = true;
      view.hidden = false;
      document.documentElement.classList.add("deep-time-open");
      void (async () => {
        await gatherCounts();
        if (viewOpen) void renderView();
      })();
      void renderView();
      const backButton = sheet.querySelector(".deep-time-back");
      if (backButton) backButton.focus({ preventScroll: true });
    }

    function closeView() {
      viewOpen = false;
      view.hidden = true;
      document.documentElement.classList.remove("deep-time-open");
      doorButton.focus({ preventScroll: true });
    }

    doorButton.addEventListener("click", openView);
    view.addEventListener("click", event => {
      if (event.target === view) closeView();
    });
    document.addEventListener("keydown", event => {
      if (viewOpen && event.key === "Escape") closeView();
    });
    document.addEventListener("sof:life-atlas-records-changed", () => {
      yearRecordsCache = new Map();
      countsByYear = {};
      if (viewOpen) {
        void (async () => {
          await gatherCounts();
          if (viewOpen) void renderView();
        })();
      }
    });

    const controller = DayZoom.createDayZoom({
      onRender(dayView) {
        if (dayView && dayView.civilDate) {
          selectedCivil = dayView.civilDate;
        }
      }
    });
    controller.start();
    if (!reducedMotion) door.classList.add("deep-time-door-ready");
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => initDeepTime(), { once: true });
    } else {
      initDeepTime();
    }
  }

  return Object.freeze({
    VERSION,
    EXPLAINERS,
    SPIRAL_YEARS,
    HORIZON_BACK,
    daysBetweenCivil,
    civilDateForPatternDay,
    windowDaysForYear,
    selectionForCivilDate,
    dayCountsForYear,
    buildSpiralModel,
    buildYearModel,
    buildDayDetail,
    buildAlignmentModel,
    sparkTint
  });
});
