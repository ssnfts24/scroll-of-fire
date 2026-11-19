/*
 * Day Notes — the 13 Moons page's panel for a single day.
 *
 * Living Witness, Rung 1 (Dashboard item 17, approved Nov 18, 2026 on
 * terms that start Rungs 1–2). Design: living-witness-system-design,
 * Section 2, Rung 1 — "Day Notes panel on the 13 Moons page: pick a
 * day, see everything on it (all record kinds, read straight from
 * storage), write a plain note on the day. Records stay on the
 * visitor's device."
 *
 * How it reads the day: every conversion goes through the canonical
 * pipeline — SOFTemporalCursor.resolvePosition when the cursor is on
 * the page, PatternCalendar.fromCivilDate under it (the cursor's own
 * delegation, per docs/development/TEMPORAL-AUTHORITY-CONTRACT.md).
 * This module never keeps a second clock.
 *
 * How it reads and writes records: the Life Atlas repository, the
 * same store the Sphere, the planner, and the Manifest practice loop
 * use (resolve idiom copied from manifest-practice.js). A note is a
 * Life Atlas record — type "note", subtype "day-note" — stamped with
 * the day's coordinate in the Atlas temporal shape (the mapping
 * mirrors manifest-practice.js's temporalFromConversion exactly, so a
 * note, a practice session, and a planner entry for the same day are
 * found by the same queries). Nothing leaves the device.
 *
 * The panel lists every record kind stored for the chosen day. It
 * writes notes only; it never edits or deletes anyone's records —
 * visitors keep their own records with their own hands.
 */
(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.CodexDayNotes = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const NOTE_TYPE = "note";
  const NOTE_SUBTYPE = "day-note";
  const NOTE_TAG = "day-note";
  const SOURCE_ID = "moons.html#day-notes";

  /* ------------------------- small helpers ------------------------- */

  function cleanText(value, max = 4000) {
    if (value === null || value === undefined) return "";
    return String(value).replace(/\s+/g, " ").trim().slice(0, max);
  }

  function cleanMultiline(value, max = 4000) {
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

  function localTimeZone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  }

  /* ------------------- the canonical conversion ------------------- */

  /*
   * Resolve an instant to its PatternCalendar conversion through the
   * one pipeline: the cursor when present, PatternCalendar under it.
   * `env` lets tests inject { cursor, calendar, timeZone }.
   */
  function conversionForInstant(instant, env = {}) {
    const when =
      instant instanceof Date ? instant : new Date(instant || Date.now());

    if (Number.isNaN(when.getTime())) return null;

    const cursor =
      env.cursor ||
      (typeof globalThis !== "undefined"
        ? globalThis.SOFTemporalCursor
        : null);

    if (cursor && typeof cursor.resolvePosition === "function") {
      try {
        const resolved = cursor.resolvePosition(when);
        if (resolved) return resolved;
      } catch {
        /* fall through to the calendar itself */
      }
    }

    const calendar =
      env.calendar ||
      (typeof globalThis !== "undefined" ? globalThis.PatternCalendar : null);

    if (!calendar || typeof calendar.fromCivilDate !== "function") {
      return null;
    }

    try {
      return calendar.fromCivilDate({
        date: when,
        timeZone: env.timeZone || localTimeZone(),
        boundaryMode: env.boundaryMode || "sunset",
        sunsetTime: env.sunsetTime || "18:00"
      });
    } catch {
      return null;
    }
  }

  /*
   * PatternCalendar conversion -> Life Atlas temporal shape. Mirrors
   * manifest-practice.js's temporalFromConversion field for field:
   * patternYear is the anchor's civil year, patternDay is the
   * conversion's dayOfPatternYear, and a day outside the counted year
   * carries null coordinates with outsideDay set.
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

  /* ------------------------- the note record ------------------------ */

  function buildNoteRecord({ text, conversion, instant = null } = {}) {
    const body = cleanMultiline(text, 4000);

    if (!body) return null;

    const temporal = temporalFromConversion(conversion, instant);

    if (!temporal) return null;

    const firstLine =
      body
        .split("\n")
        .map(line => line.trim())
        .find(Boolean) || "Day note";

    return {
      type: NOTE_TYPE,
      subtype: NOTE_SUBTYPE,

      title: cleanText(firstLine, 140) || "Day note",
      summary: body,

      temporal,

      tags: [NOTE_TAG],

      provenance: {
        sourceType: "day-notes-panel",
        sourceId: SOURCE_ID,
        calculationAuthority: "PatternCalendar"
      },

      privacy: {
        visibility: "private",
        containsPersonalData: true
      }
    };
  }

  function isDayNote(record) {
    return (
      !!record && record.type === NOTE_TYPE && record.subtype === NOTE_SUBTYPE
    );
  }

  /* --------------------------- day queries -------------------------- */

  /*
   * The queries that together find everything stored for a day: by
   * civil date (every stamped record carries one) and, inside the
   * counted year, by Pattern Day + pattern year (the day view's key).
   * The Day Out of Time and days outside the counted year have no
   * Pattern Day, so the civil-date query is their only key — which is
   * why both queries always run and the results merge.
   */
  function dayQueries(conversion) {
    const temporal = temporalFromConversion(conversion);

    if (!temporal) return [];

    const queries = [];

    if (temporal.civilDate) queries.push({ civilDate: temporal.civilDate });

    if (temporal.patternDay !== null && temporal.patternYear !== null) {
      queries.push({
        patternDay: temporal.patternDay,
        patternYear: temporal.patternYear
      });
    }

    return queries;
  }

  function mergeDayRecords(...lists) {
    const byId = new Map();
    const anonymous = [];

    for (const list of lists) {
      if (!Array.isArray(list)) continue;

      for (const record of list) {
        if (!record || typeof record !== "object") continue;

        if (record.id) {
          if (!byId.has(record.id)) byId.set(record.id, record);
        } else {
          anonymous.push(record);
        }
      }
    }

    const merged = [...byId.values(), ...anonymous];

    merged.sort((a, b) => {
      const aTime = a.temporal?.instant || a.createdAt || "";
      const bTime = b.temporal?.instant || b.createdAt || "";

      if (aTime !== bTime) return aTime < bTime ? -1 : 1;

      return String(a.title || "").localeCompare(String(b.title || ""));
    });

    return merged;
  }

  async function recordsForDay(repository, conversion) {
    if (!repository || typeof repository.query !== "function") return [];

    const lists = [];

    for (const query of dayQueries(conversion)) {
      try {
        lists.push(await repository.query(query));
      } catch {
        lists.push([]);
      }
    }

    return mergeDayRecords(...lists);
  }

  /* --------------------------- day wording -------------------------- */

  function describeConversion(conversion) {
    if (!conversion) {
      return {
        headline: "This day could not be resolved",
        detail: "",
        civilDate: null,
        isDayOutOfTime: false,
        insideCountedYear: false
      };
    }

    const civilDate = conversion.civilDate || null;

    if (conversion.isDayOutOfTime) {
      return {
        headline: "Day Out of Time",
        detail: "The day between the years — no Moon, no Pattern Day.",
        civilDate,
        isDayOutOfTime: true,
        insideCountedYear: false
      };
    }

    if (!conversion.insideCountedYear || conversion.moon === null) {
      return {
        headline: civilDate || "Outside the counted year",
        detail: "Outside the counted year — the calendar names no Moon for it.",
        civilDate,
        isDayOutOfTime: false,
        insideCountedYear: false
      };
    }

    return {
      headline:
        `Moon ${conversion.moon} · Day ${conversion.day}` +
        ` · Pattern Day ${conversion.dayOfPatternYear}`,
      detail: conversion.moonName
        ? `${conversion.moonName} — day ${conversion.day} of 28` +
          (conversion.dayArchetype ? ` · ${conversion.dayArchetype}` : "")
        : "",
      civilDate,
      isDayOutOfTime: false,
      insideCountedYear: true
    };
  }

  function kindLabel(record) {
    if (!record) return "Record";

    if (isDayNote(record)) return "Day note";

    if (record.subtype === "practice-session") return "Practice session";

    const type = String(record.type || "record");

    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  /* --------------------- repository resolution ---------------------- */
  /* The manifest-practice.js idiom: the Atlas runtime when the page
   * provides one, a direct persistent repository otherwise. */

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

  /* ------------------------- browser panel -------------------------- */

  function initPanel() {
    const panel = document.querySelector("[data-day-notes]");

    if (!panel || panel.dataset.dayNotesReady) return;

    panel.dataset.dayNotesReady = "1";

    const headlineEl = panel.querySelector("[data-day-notes-headline]");
    const detailEl = panel.querySelector("[data-day-notes-detail]");
    const listEl = panel.querySelector("[data-day-notes-list]");
    const emptyEl = panel.querySelector("[data-day-notes-empty]");
    const statusEl = panel.querySelector("[data-day-notes-status]");
    const form = panel.querySelector("[data-day-notes-form]");
    const textarea = panel.querySelector("[data-day-notes-text]");
    const dateInput = panel.querySelector("[data-day-notes-date]");

    /* Local noon keeps the selected civil day stable across stepping. */
    const now = new Date();
    let selected = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      12,
      0,
      0
    );

    function setStatus(message) {
      if (statusEl) statusEl.textContent = message;
    }

    async function render() {
      const conversion = conversionForInstant(selected);
      const description = describeConversion(conversion);

      if (headlineEl) headlineEl.textContent = description.headline;
      if (detailEl) detailEl.textContent = description.detail;

      if (dateInput && description.civilDate) {
        dateInput.value = description.civilDate;
      }

      if (!listEl) return;

      listEl.innerHTML = "";

      const repository = await resolveRepository();

      if (!repository) {
        if (emptyEl) {
          emptyEl.hidden = false;
          emptyEl.textContent =
            "The record store was not available on this page, so the day's records could not be read.";
        }
        return;
      }

      const records = await recordsForDay(repository, conversion);

      if (!records.length) {
        if (emptyEl) {
          emptyEl.hidden = false;
          emptyEl.textContent = "Nothing on this day yet.";
        }
        return;
      }

      if (emptyEl) emptyEl.hidden = true;

      for (const record of records) {
        const item = document.createElement("li");
        item.className = "day-notes__record";

        const kind = document.createElement("span");
        kind.className = "day-notes__kind";
        kind.textContent = kindLabel(record);

        const title = document.createElement("strong");
        title.className = "day-notes__title";
        title.textContent = record.title || "Untitled record";

        const summary = document.createElement("span");
        summary.className = "day-notes__summary";
        summary.textContent = record.summary
          ? String(record.summary).slice(0, 220)
          : "";

        item.append(kind, title, summary);
        listEl.append(item);
      }
    }

    function step(days) {
      selected = new Date(selected.getTime() + days * 86400000);
      void render();
    }

    panel
      .querySelector("[data-day-notes-prev]")
      ?.addEventListener("click", () => step(-1));

    panel
      .querySelector("[data-day-notes-next]")
      ?.addEventListener("click", () => step(1));

    panel
      .querySelector("[data-day-notes-today]")
      ?.addEventListener("click", () => {
        const today = new Date();
        selected = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          12,
          0,
          0
        );
        void render();
      });

    dateInput?.addEventListener("change", () => {
      if (!dateInput.value) return;

      const [year, month, day] = dateInput.value.split("-").map(Number);

      if (!year || !month || !day) return;

      selected = new Date(year, month - 1, day, 12, 0, 0);
      void render();
    });

    form?.addEventListener("submit", async event => {
      event.preventDefault();

      const text = textarea?.value || "";

      if (!text.trim()) {
        setStatus("Write the note first — even one line is enough.");
        return;
      }

      const repository = await resolveRepository();

      if (!repository) {
        setStatus(
          "The record store was not available, so the note was not saved."
        );
        return;
      }

      const conversion = conversionForInstant(selected);
      const record = buildNoteRecord({
        text,
        conversion,
        instant: new Date()
      });

      if (!record) {
        setStatus("That note could not be stamped with this day.");
        return;
      }

      const saved = await repository.put(record);

      notifyRecordsChanged({ source: "day-notes", recordId: saved.id });

      if (textarea) textarea.value = "";

      setStatus(
        "Note written on this day. It stays on this device, with everything else you keep here."
      );

      void render();
    });

    document.addEventListener("sof:life-atlas-records-changed", event => {
      if (event.detail?.source !== "day-notes") void render();
    });

    void render();
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initPanel);
    } else {
      initPanel();
    }
  }

  return {
    NOTE_TYPE,
    NOTE_SUBTYPE,
    NOTE_TAG,
    SOURCE_ID,
    conversionForInstant,
    temporalFromConversion,
    buildNoteRecord,
    isDayNote,
    dayQueries,
    mergeDayRecords,
    recordsForDay,
    describeConversion,
    kindLabel
  };
});
