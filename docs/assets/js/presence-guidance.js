/*
 * Presence Guidance — the Spark's first guidance lines, computed from
 * the visitor's own on-device records.
 *
 * Living Witness, Rung 1 (Dashboard item 17, approved Nov 18, 2026).
 * Design: living-witness-system-design, Sections 1.3, 2 (Rung 1) and
 * 3.1 — the presence's memory is pattern recognition over a person's
 * own record, and at one person's scale counting beats learning:
 * periodicity, co-occurrence, and plain counts, with observed and
 * inferred never merged. Every line this module produces is either a
 * count of what the record shows (spoken as noticed) or an offered
 * next door (spoken as an offer). It never infers anything about
 * anyone else, and nothing it reads leaves the device.
 *
 * This module is the shared pattern layer's first site-side piece:
 * the Spark build speaks these same lines through the companion, so
 * the guidance is computed here, once, from the record — the face
 * never gets a bigger voice than the evidence under it.
 *
 * Footprints: the module stamps the civil days a visitor returns, in
 * its own small localStorage entry (civil dates only, capped). That
 * stamp is the "days returned" footprint the design names; it holds
 * no page content and no record content.
 */
(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.CodexPresenceGuidance = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const FOOTPRINT_KEY = "codex.presence.footprints.v1";
  const FOOTPRINT_CAP = 400;
  const MAX_LINES = 3;

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

  const resolveRepository = RecordHelpers.createRepositoryResolver();

  /* --------------------------- pure core ---------------------------- */

  function dayKey(record) {
    const temporal = record?.temporal || {};

    if (temporal.patternDay !== null && temporal.patternDay !== undefined) {
      return `pd:${temporal.patternYear}:${temporal.patternDay}`;
    }

    return temporal.civilDate ? `civil:${temporal.civilDate}` : null;
  }

  function distinctDays(records) {
    const days = new Set();

    for (const record of records || []) {
      const key = dayKey(record);
      if (key) days.add(key);
    }

    return days;
  }

  function moonKey(temporal) {
    if (!temporal || temporal.moon === null || temporal.moon === undefined) {
      return null;
    }

    return `${temporal.patternYear}:${temporal.moon}`;
  }

  function previousMoon(today) {
    if (!today || today.moon === null || today.moon === undefined) {
      return null;
    }

    if (today.moon > 1) {
      return { patternYear: today.patternYear, moon: today.moon - 1 };
    }

    return { patternYear: today.patternYear - 1, moon: 13 };
  }

  function practiceDaysByMoon(records) {
    const byMoon = new Map();

    for (const record of records || []) {
      if (record?.subtype !== "practice-session") continue;

      const key = moonKey(record.temporal);

      if (!key) continue;

      if (!byMoon.has(key)) byMoon.set(key, new Set());

      const day = dayKey(record);
      if (day) byMoon.get(key).add(day);
    }

    return byMoon;
  }

  /*
   * today: an Atlas-shaped temporal ({ patternYear, moon, moonDay,
   * patternDay, civilDate }) for the current day, as produced by
   * day-notes' temporalFromConversion.
   */
  function computeGuidance({ records = [], today = null, visitDays = [] } = {}) {
    const lines = [];
    const all = Array.isArray(records) ? records : [];

    /* --- practice rhythm across the last two moons (noticed) --- */
    if (today && today.moon !== null && today.moon !== undefined) {
      const byMoon = practiceDaysByMoon(all);
      const thisMoon =
        byMoon.get(`${today.patternYear}:${today.moon}`)?.size || 0;
      const prev = previousMoon(today);
      const lastMoon = prev
        ? byMoon.get(`${prev.patternYear}:${prev.moon}`)?.size || 0
        : 0;

      if (thisMoon > 0 && lastMoon > 0) {
        lines.push({
          tone: "noticed",
          text:
            `You sealed practice on ${thisMoon} day${thisMoon === 1 ? "" : "s"} ` +
            `this moon — last moon it was ${lastMoon}.`,
          href: null
        });
      } else if (thisMoon > 0) {
        lines.push({
          tone: "noticed",
          text:
            `You sealed practice on ${thisMoon} day${thisMoon === 1 ? "" : "s"} ` +
            "this moon.",
          href: null
        });
      } else if (lastMoon > 0) {
        lines.push({
          tone: "offer",
          text:
            `Last moon you sealed practice on ${lastMoon} day${lastMoon === 1 ? "" : "s"}. ` +
            "This moon is still open.",
          href: "teach.html"
        });
      }
    }

    /* --- return rhythm (noticed) --- */
    const recentVisits = (visitDays || []).filter(date => {
      if (!today?.civilDate || typeof date !== "string") return false;
      const then = Date.parse(`${date}T12:00:00Z`);
      const now = Date.parse(`${today.civilDate}T12:00:00Z`);
      if (Number.isNaN(then) || Number.isNaN(now)) return false;
      const age = (now - then) / 86400000;
      return age >= 0 && age < 28;
    });

    const distinctVisits = new Set(recentVisits).size;

    if (distinctVisits >= 3) {
      lines.push({
        tone: "noticed",
        text: `You have come back on ${distinctVisits} of the last 28 days.`,
        href: null
      });
    }

    /* --- today is unwritten (offer) --- */
    if (today?.civilDate) {
      const notedToday = all.some(
        record =>
          record?.subtype === "day-note" &&
          record?.temporal?.civilDate === today.civilDate
      );

      if (!notedToday && all.length > 0) {
        lines.push({
          tone: "offer",
          text: "Nothing written on today yet — the day is open for a note.",
          href: "#day-notes"
        });
      }
    }

    /* --- a first step, when the record is still empty (offer) --- */
    if (!all.length) {
      lines.push({
        tone: "offer",
        text:
          "Nothing kept here yet. Most people start with a note on today, " +
          "or a sealed practice session.",
        href: "#day-notes"
      });
    }

    return lines.slice(0, MAX_LINES);
  }

  /* --------------------------- footprints --------------------------- */

  function readFootprints(storage) {
    try {
      const raw = storage?.getItem(FOOTPRINT_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? parsed.filter(value => typeof value === "string")
        : [];
    } catch {
      return [];
    }
  }

  function stampFootprint(storage, civilDate) {
    if (!storage || !civilDate) return [];

    const days = readFootprints(storage);

    if (!days.includes(civilDate)) days.push(civilDate);

    const capped = days.slice(-FOOTPRINT_CAP);

    try {
      storage.setItem(FOOTPRINT_KEY, JSON.stringify(capped));
    } catch {
      /* storage full or blocked — footprints are a courtesy, not a duty */
    }

    return capped;
  }

  /* ------------------------- browser wiring ------------------------- */


  async function renderGuidance() {
    const slots = document.querySelectorAll("[data-presence-guidance]");

    if (!slots.length) return;

    const DayNotes =
      typeof globalThis !== "undefined" ? globalThis.CodexDayNotes : null;

    if (!DayNotes) return;

    const conversion = DayNotes.conversionForInstant(new Date());

    if (!conversion) return;

    const today = DayNotes.temporalFromConversion(conversion, new Date());

    let storage = null;

    try {
      storage = window.localStorage;
    } catch {
      storage = null;
    }

    const visitDays = today?.civilDate
      ? stampFootprint(storage, today.civilDate)
      : readFootprints(storage);

    const repository = await resolveRepository();

    let records = [];

    if (repository) {
      try {
        records = (await repository.all()) || [];
      } catch {
        records = [];
      }
    }

    const lines = computeGuidance({ records, today, visitDays });

    for (const slot of slots) {
      slot.innerHTML = "";

      if (!lines.length) {
        slot.hidden = true;
        continue;
      }

      slot.hidden = false;

      const label = document.createElement("p");
      label.className = "presence-guidance__label";
      label.textContent = "Noticed from your records, on this device only:";
      slot.append(label);

      const list = document.createElement("ul");
      list.className = "presence-guidance__list";

      for (const line of lines) {
        const item = document.createElement("li");
        item.className = `presence-guidance__line presence-guidance__line--${line.tone}`;

        if (line.href) {
          const link = document.createElement("a");
          link.href = line.href;
          link.textContent = line.text;
          item.append(link);
        } else {
          item.textContent = line.text;
        }

        list.append(item);
      }

      slot.append(list);
    }
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        void renderGuidance();
      });
    } else {
      void renderGuidance();
    }

    document.addEventListener("sof:life-atlas-records-changed", () => {
      void renderGuidance();
    });
  }

  return {
    FOOTPRINT_KEY,
    MAX_LINES,
    computeGuidance,
    practiceDaysByMoon,
    distinctDays,
    previousMoon,
    readFootprints,
    stampFootprint
  };
});
