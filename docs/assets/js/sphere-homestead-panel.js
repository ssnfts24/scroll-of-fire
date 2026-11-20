/*
 * The Sphere Homestead Panel — the Day World's homestead layer.
 *
 * Data: docs/assets/data/farm-homestead-western-wa.json — the work
 * around the planting calendar (cover crops, the last sowings for a
 * winter harvest, season extension, harvest storage, beginner seed
 * saving, and small seasonal notes for chickens and goats), gathered
 * from extension and university sources only, every entry carrying
 * its source. This module holds no homestead facts of its own; it
 * only counts dates against that dataset. It stands beside the farm
 * panel (sphere-farm-panel.js) and imports nothing from it.
 *
 * Wiring for the Day World — beside the farm section, load this
 * module and the homestead dataset, then:
 *   const advice = CodexSphereHomesteadPanel.adviceForDate(
 *     homesteadData, keeperCountyId, view.civilISO);
 *   CodexSphereHomesteadPanel.renderInto(section, advice);
 * where view.civilISO is the day's civil date from the canonical
 * cursor and keeperCountyId is "lewis" or "snohomish".
 */
(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.CodexSphereHomesteadPanel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "sphere-homestead-panel/1.0.0";
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

  function fixedWindow(year, fixed) {
    if (!fixed) return null;
    const start = monthDayInYear(fixed.start, year);
    const end = monthDayInYear(fixed.end, year);
    if (!start || !end) return null;
    return { start, end };
  }

  function contains(win, date) {
    return win && date >= win.start && date <= win.end;
  }

  function containsWrapping(fixed, date, year) {
    if (!fixed || !fixed.wrapsYear) return contains(fixedWindow(year, fixed), date);
    const thisYear = { start: monthDayInYear(fixed.start, year), end: monthDayInYear(fixed.end, year + 1) };
    const lastYear = { start: monthDayInYear(fixed.start, year - 1), end: monthDayInYear(fixed.end, year) };
    return contains(thisYear, date) || contains(lastYear, date);
  }

  function startsWithin(win, date, days) {
    if (!win) return false;
    const diff = (win.start - date) / DAY_MS;
    return diff > 0 && diff <= days;
  }

  /*
   * adviceForDate(data, countyId, isoDate)
   * Returns plain language throughout, grouped so the panel can speak
   * it in order: cover crops to sow, the last sowings for a winter
   * harvest, season extension, storage, seed saving, and the animal
   * notes — each only in its season, the way the dataset gates them.
   */
  function adviceForDate(data, countyId, isoDate) {
    const date = parseISODate(isoDate);
    const location = (data.locations || []).find(l => l.id === countyId) || null;
    if (!date || !location) {
      return {
        ok: false,
        reason: !date ? "That date could not be read." : "That county is not in the homestead data yet.",
        lines: []
      };
    }

    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const lsf = monthDayInYear(location.lastSpringFrost, year);
    const safeLsf = monthDayInYear(location.safeLastSpringFrost, year);
    const fff = monthDayInYear(location.firstFallFrost, year);
    const safeFff = monthDayInYear(location.safeFirstFallFrost, year);

    const usedSourceIds = new Set();
    const collect = part => {
      if (part && Array.isArray(part.sources)) part.sources.forEach(s => usedSourceIds.add(s));
    };
    location.frostSources.forEach(s => usedSourceIds.add(s));
    location.safeFrostSources.forEach(s => usedSourceIds.add(s));
    location.zoneSources.forEach(s => usedSourceIds.add(s));

    /* Cover crops: sow now, or opening within three weeks. */
    const coverNow = [];
    const coverComing = [];
    for (const crop of data.coverCrops || []) {
      const win = fixedWindow(year, crop.sowWindow);
      const winNext = fixedWindow(year + 1, crop.sowWindow);
      if (contains(win, date)) {
        coverNow.push(`${crop.name} — sow now (${crop.sowWindow.text}; ${crop.rateText}). ${crop.purpose}.`);
        collect(crop);
      } else if (startsWithin(win, date, 21)) {
        coverComing.push(`${crop.name} — sowing opens ${formatDate(win.start)} (${crop.sowWindow.text}).`);
        collect(crop);
      } else if (startsWithin(winNext, date, 21)) {
        coverComing.push(`${crop.name} — sowing opens ${formatDate(winNext.start)} (${crop.sowWindow.text}).`);
        collect(crop);
      }
    }

    /* Final sowings for a winter harvest: speak in a crop's final
     * month, and in the month before it. */
    const finalSowingLines = [];
    const finalSowings = data.finalSowings || { crops: [] };
    for (const crop of finalSowings.crops || []) {
      if (month === crop.lastMonth) {
        finalSowingLines.push(`${crop.name} — last month to sow for a winter harvest (the chart counts ${crop.seedingText.toLowerCase()}; harvest ${crop.harvestText.toLowerCase()}).`);
        collect(crop);
      } else if (month === crop.lastMonth - 1 || (crop.lastMonth === 1 && month === 12)) {
        finalSowingLines.push(`${crop.name} — its final sowing month is next month (${crop.seedingText.toLowerCase()}).`);
        collect(crop);
      }
    }

    /* Season extension, counted against the county's frost record:
     * covers belong on before the fall frost window opens; cold frames
     * work the spring frost window; covers come off once the latest
     * recorded spring frost has passed. */
    const seasonLines = [];
    for (const item of data.seasonExtension || []) {
      let active = false;
      if (item.timing === "fixed") {
        active = contains(fixedWindow(year, item.fixed), date) || contains(fixedWindow(year - 1, item.fixed), date);
      } else if (item.timing === "fall-frost-watch") {
        active = date >= addDays(safeFff, -14) && date <= addDays(fff, 45);
      } else if (item.timing === "spring-frost-watch") {
        active = date >= addDays(lsf, -21) && date <= safeLsf;
      } else if (item.timing === "after-safe-last-frost") {
        active = date > safeLsf && date <= addDays(safeLsf, 28);
      }
      if (active) {
        seasonLines.push(`${item.name} — ${item.text}`);
        collect(item);
      }
    }

    /* Harvest storage, spoken in the harvest months the dataset
     * names (September to November). */
    const storageLines = [];
    if (month >= 9 && month <= 11) {
      for (const crop of (data.storage || {}).crops || []) {
        const life = crop.lifeMonths
          ? `keeps about ${crop.lifeMonths[0]}–${crop.lifeMonths[1]} months`
          : "keeps through the season";
        const cure = crop.cureText ? ` ${crop.cureText}` : "";
        storageLines.push(`${crop.name} — store at ${crop.temperatureText}, ${crop.humidityText}; ${life}.${cure}`);
        collect(crop);
      }
    }

    /* Beginner seed saving, spoken August through October, when
     * these crops ripen and dry down. */
    const seedLines = [];
    if (month >= 8 && month <= 10) {
      for (const crop of (data.seedSaving || {}).crops || []) {
        seedLines.push(`${crop.name} — ${crop.pollination}. ${crop.isolationText} ${crop.howText}`);
        collect(crop);
      }
      if (seedLines.length) collect(data.seedSaving);
    }

    /* Animal notes, each in its own fixed season. */
    const animalLines = [];
    for (const entry of (data.animals || {}).entries || []) {
      if (containsWrapping(entry.fixed, date, year)) {
        animalLines.push(`${entry.animal} — ${entry.name}:`, ...entry.lines);
        collect(entry);
      }
    }

    const sources = (data.sources || []).filter(s => usedSourceIds.has(s.id));

    return {
      ok: true,
      county: location.county,
      anchor: location.anchor,
      date: isoDate,
      seasonLine: `${location.county} — zone ${location.zones.join("/").replace("/", "–")}, average last spring frost ${formatDate(lsf)}, first fall frost ${formatDate(fff)}, about ${location.frostFreeDays} frost-free days.`,
      coverNow,
      coverComing,
      finalSowingLines,
      seasonLines,
      storageLines,
      seedLines,
      animalLines,
      sources
    };
  }

  function renderLines(advice) {
    if (!advice || !advice.ok) return [advice ? advice.reason : "The homestead data could not be read."];
    const lines = [advice.seasonLine];
    const group = (title, items) => {
      if (items.length) lines.push(title, ...items);
    };
    group("Sow cover crops now:", advice.coverNow);
    group("Cover crops coming up:", advice.coverComing);
    group("Last sowings for a winter harvest:", advice.finalSowingLines);
    group("Season extension:", advice.seasonLines);
    group("Harvest storage:", advice.storageLines);
    group("Seed saving:", advice.seedLines);
    group("Around the animals:", advice.animalLines);
    if (
      !advice.coverNow.length &&
      !advice.coverComing.length &&
      !advice.finalSowingLines.length &&
      !advice.seasonLines.length &&
      !advice.storageLines.length &&
      !advice.seedLines.length &&
      !advice.animalLines.length
    ) {
      lines.push("No homestead work is calling today. The place keeps its own rhythm; the next season will name its work here when it opens.");
    }
    if (advice.sources.length) {
      lines.push(
        `Sources: ${advice.sources.map(s => s.publisher).filter((v, i, a) => a.indexOf(v) === i).join("; ")}. Full citations ride with the data itself.`
      );
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
