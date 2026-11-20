/*
 * The Sphere Farm Panel — the Day World's ground layer.
 *
 * Data: docs/assets/data/farm-western-wa.json — planting windows for
 * western Washington gathered from WSU Extension county calendars,
 * NOAA climate normals, the USDA hardiness map, and the almanacs,
 * every window carrying its source. This module holds no planting
 * facts of its own; it only counts dates against that dataset.
 *
 * Two layers, never blended (Aaron's rule for the Day World):
 *   - The fact layer: extension and climate dates, computed here.
 *   - The Codex layer: moon timing. This module never generates it.
 *     A caller may hand in moon lines of its own (from the Codex's
 *     own calendar) and they are returned under their own label,
 *     kept visibly apart from the facts above them.
 *
 * Wiring for the Day World (PR #183, sphere-day-world.js) — the farm
 * section currently shows a labeled placeholder line. To fill it:
 *   1. Load this module and the dataset beside sphere-day-world.js.
 *   2. In the farm section, replace the placeholder line with:
 *        const advice = CodexSphereFarmPanel.adviceForDate(
 *          farmData, keeperCountyId, view.civilISO);
 *        CodexSphereFarmPanel.renderInto(farm, advice);
 *      where view.civilISO is the day's civil date from the canonical
 *      cursor (the Day World already holds it) and keeperCountyId is
 *      the keeper's chosen county ("lewis" or "snohomish").
 */
(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.CodexSphereFarmPanel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "sphere-farm-panel/1.0.0";
  const DAY_MS = 86400000;

  function parseISODate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
    if (!m) return null;
    const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function monthDayInYear(monthDay, year) {
    const m = /^(\d{2})-(\d{2})$/.exec(String(monthDay || ""));
    if (!m) return null;
    return new Date(Date.UTC(year, Number(m[1]) - 1, Number(m[2])));
  }

  function addDays(date, days) {
    return new Date(date.getTime() + days * DAY_MS);
  }

  function formatDate(date) {
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      timeZone: "UTC"
    });
  }

  function formatRange(start, end) {
    return `${formatDate(start)} to ${formatDate(end)}`;
  }

  /* A spring window counted in weeks from the last spring frost.
   * weeks [a, b] may be negative (before the frost). The window runs
   * from the start of week a through the end of week b. */
  function frostWindow(location, year, weeks) {
    const lsf = monthDayInYear(location.lastSpringFrost, year);
    if (!lsf || !Array.isArray(weeks)) return null;
    return {
      start: addDays(lsf, weeks[0] * 7),
      end: addDays(lsf, weeks[1] * 7 + 6)
    };
  }

  function indoorWindow(location, year, weeksBefore) {
    const lsf = monthDayInYear(location.lastSpringFrost, year);
    if (!lsf || !Array.isArray(weeksBefore)) return null;
    return {
      start: addDays(lsf, -weeksBefore[1] * 7),
      end: addDays(lsf, -weeksBefore[0] * 7 + 6)
    };
  }

  function fixedWindow(year, fixed) {
    if (!fixed) return null;
    const start = monthDayInYear(fixed.start, year);
    const end = monthDayInYear(fixed.end, year);
    if (!start || !end) return null;
    return { start, end };
  }

  function fallWindow(year, fall) {
    if (!fall || !fall.startMonthDay || !fall.endMonthDay) return null;
    return {
      start: monthDayInYear(fall.startMonthDay, year),
      end: monthDayInYear(fall.endMonthDay, year)
    };
  }

  function contains(win, date) {
    return win && date >= win.start && date <= win.end;
  }

  function startsWithin(win, date, days) {
    if (!win) return false;
    const diff = (win.start - date) / DAY_MS;
    return diff > 0 && diff <= days;
  }

  function cropWindows(crop, location, year) {
    const out = {};
    if (crop.indoorStart) {
      out.indoor = indoorWindow(location, year, crop.indoorStart.weeksBeforeLastFrost);
    }
    if (crop.transplant) {
      out.transplant = crop.transplant.fixed
        ? fixedWindow(year, crop.transplant.fixed)
        : frostWindow(location, year, crop.transplant.weeksFromLastFrost);
    }
    if (crop.directSow) {
      out.sow = frostWindow(location, year, crop.directSow.weeksFromLastFrost);
    }
    if (crop.fall) {
      out.fall = fallWindow(year, crop.fall);
    }
    return out;
  }

  /*
   * adviceForDate(data, countyId, isoDate, opts)
   *   opts.moonLines: optional array of strings from the Codex layer.
   *     They are returned untouched under their own label and are
   *     never mixed into the fact lines.
   * Returns plain language throughout, grouped so the panel can
   * speak it in order: what to do now, what is coming, what is too
   * early, and whether frost is a live risk.
   */
  function adviceForDate(data, countyId, isoDate, opts) {
    const options = opts || {};
    const date = parseISODate(isoDate);
    const location = (data.locations || []).find(l => l.id === countyId) || null;
    if (!date || !location) {
      return {
        ok: false,
        reason: !date ? "That date could not be read." : "That county is not in the farm data yet.",
        lines: [],
        moonLayer: null
      };
    }

    const year = date.getUTCFullYear();
    const lsf = monthDayInYear(location.lastSpringFrost, year);
    const safeLsf = monthDayInYear(location.safeLastSpringFrost, year);
    const fff = monthDayInYear(location.firstFallFrost, year);
    const safeFff = monthDayInYear(location.safeFirstFallFrost, year);

    const startIndoorsNow = [];
    const putOutNow = [];
    const sowNow = [];
    const comingUp = [];
    const tooEarly = [];

    for (const crop of data.crops || []) {
      const w = cropWindows(crop, location, year);
      const wNext = cropWindows(crop, location, year + 1);

      if (w.indoor && contains(w.indoor, date)) {
        startIndoorsNow.push(`${crop.name} — start indoors now (${formatRange(w.indoor.start, w.indoor.end)}).`);
      } else if (w.indoor && startsWithin(w.indoor, date, 21)) {
        comingUp.push(`${crop.name} — start indoors from ${formatDate(w.indoor.start)}.`);
      } else if (wNext.indoor && startsWithin(wNext.indoor, date, 21)) {
        comingUp.push(`${crop.name} — start indoors from ${formatDate(wNext.indoor.start)}.`);
      }

      if (w.transplant && contains(w.transplant, date)) {
        putOutNow.push(`${crop.name} — can go out now (${formatRange(w.transplant.start, w.transplant.end)}).`);
      } else if (w.transplant && startsWithin(w.transplant, date, 21)) {
        comingUp.push(`${crop.name} — goes out from ${formatDate(w.transplant.start)}.`);
      }

      if (w.sow && contains(w.sow, date)) {
        sowNow.push(`${crop.name} — sow now (${formatRange(w.sow.start, w.sow.end)}).`);
      } else if (w.sow && startsWithin(w.sow, date, 21)) {
        comingUp.push(`${crop.name} — sow from ${formatDate(w.sow.start)}.`);
      }

      if (w.fall && contains(w.fall, date)) {
        sowNow.push(`${crop.name} — fall sowing: ${crop.fall.text}.`);
      } else if (w.fall && startsWithin(w.fall, date, 21)) {
        comingUp.push(`${crop.name} — fall sowing opens ${formatDate(w.fall.start)}: ${crop.fall.text}.`);
      }

      const tender = crop.frostClass === "tender" || crop.frostClass === "very-tender";
      const outdoor = w.transplant || w.sow;
      if (tender && outdoor && date < outdoor.start) {
        const days = Math.round((outdoor.start - date) / DAY_MS);
        if (days <= 120) {
          tooEarly.push(`${crop.name} — too early to put out; its window opens ${formatDate(outdoor.start)}.`);
        }
      }
    }

    /* Frost watch, spring: from three weeks before the average last
     * frost until the latest date frost is honestly expected here
     * (the county's safe line). Fall: from a month before the safe
     * first fall frost onward. The panel cannot see tonight's
     * forecast; it speaks about the risk window, and says so. */
    const frostLines = [];
    if (date >= addDays(lsf, -21) && date <= safeLsf) {
      frostLines.push(
        `Frost is still in play here. The average last spring frost in ${location.county} is ${formatDate(lsf)} (${location.station}), and frost has come as late as ${formatDate(safeLsf)} in the record these dates rest on. Hardy crops carry on; tender plants out now can still meet a frost. This panel cannot see tonight's forecast — if frost is forecast, cover tender plants tonight.`
      );
    }
    if (date >= addDays(safeFff, -30)) {
      frostLines.push(
        `The fall edge is near. The first fall frost in ${location.county} averages ${formatDate(fff)} and has come as early as ${formatDate(safeFff)} in the record these dates rest on. Tender crops are on borrowed time; hardy crops and roots carry on into winter. If frost is forecast, cover tender plants tonight.`
      );
    }

    const usedSourceIds = new Set();
    for (const crop of data.crops || []) {
      for (const key of ["indoorStart", "transplant", "directSow", "fall", "daysToMaturity"]) {
        const part = crop[key];
        if (part && Array.isArray(part.sources)) part.sources.forEach(s => usedSourceIds.add(s));
      }
    }
    location.frostSources.forEach(s => usedSourceIds.add(s));
    location.safeFrostSources.forEach(s => usedSourceIds.add(s));
    location.zoneSources.forEach(s => usedSourceIds.add(s));
    const sources = (data.sources || []).filter(s => usedSourceIds.has(s.id));

    const moonLines = Array.isArray(options.moonLines) ? options.moonLines.filter(Boolean) : [];
    const moonLayer = moonLines.length
      ? {
          label: "Codex layer — moon timing. This is the Codex's own layer, kept separate from the extension facts above; the two are never blended.",
          lines: moonLines
        }
      : null;

    return {
      ok: true,
      county: location.county,
      anchor: location.anchor,
      date: isoDate,
      seasonLine: `${location.county} — zone ${location.zones.join("/").replace("/", "–")}, average last spring frost ${formatDate(lsf)}, first fall frost ${formatDate(fff)}, about ${location.frostFreeDays} frost-free days.`,
      startIndoorsNow,
      putOutNow,
      sowNow,
      comingUp,
      tooEarly,
      frostLines,
      sources,
      moonLayer
    };
  }

  function renderLines(advice) {
    if (!advice || !advice.ok) return [advice ? advice.reason : "The farm data could not be read."];
    const lines = [advice.seasonLine];
    const group = (title, items) => {
      if (items.length) lines.push(title, ...items);
    };
    group("Start indoors now:", advice.startIndoorsNow);
    group("Put out now:", advice.putOutNow);
    group("Sow now:", advice.sowNow);
    group("Coming up:", advice.comingUp);
    group("Too early yet:", advice.tooEarly);
    if (
      !advice.startIndoorsNow.length &&
      !advice.putOutNow.length &&
      !advice.sowNow.length &&
      !advice.comingUp.length
    ) {
      lines.push("Nothing is asking to be planted today. The ground keeps its own calendar; the next window will name itself here when it opens.");
    }
    lines.push(...advice.frostLines);
    lines.push(
      `Sources: ${advice.sources.map(s => s.publisher).filter((v, i, a) => a.indexOf(v) === i).join("; ")}. Full citations ride with the data itself.`
    );
    if (advice.moonLayer) {
      lines.push(advice.moonLayer.label, ...advice.moonLayer.lines);
    }
    return lines;
  }

  function renderInto(container, advice, doc) {
    const documentRef = doc || (typeof document !== "undefined" ? document : null);
    if (!container || !documentRef) return false;
    container.textContent = "";
    for (const line of renderLines(advice)) {
      const p = documentRef.createElement("p");
      p.className = "day-world-line";
      p.textContent = line;
      container.append(p);
    }
    return true;
  }

  return { VERSION, adviceForDate, renderLines, renderInto };
});
