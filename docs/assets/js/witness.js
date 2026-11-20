/*
 * Witness's page — the live day line, wherever it stands on the page
 * (the hero line, and the same line woven into the letter that changes).
 *
 * Today's 13 Moons coordinate, resolved through SOFTemporalCursor
 * (the site's single temporal authority, per the temporal-authority
 * contract) so this page never becomes a second authority. If the
 * cursor is unavailable it falls back to PatternCalendar directly,
 * the same computation the living entry uses. The static markup
 * is date-neutral, so the line never asserts a day that is not the
 * visitor's; with JavaScript it is the visitor's own today.
 */
(() => {
  "use strict";

  function fillDayLine() {
    const els = document.querySelectorAll("[data-witness-today]");
    if (!els.length) return;

    const civil = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });

    let coordinate = null;

    try {
      let mapped = null;
      const cursor = window.SOFTemporalCursor;
      if (cursor && typeof cursor.resolvePosition === "function") {
        mapped = cursor.resolvePosition(new Date());
      }
      if (!mapped) {
        const calendar = window.PatternCalendar;
        if (calendar && typeof calendar.fromCivilDate === "function") {
          const timeZone =
            Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
          const iso = new Intl.DateTimeFormat("en-CA", {
            timeZone
          }).format(new Date());
          if (iso) {
            mapped = calendar.fromCivilDate({
              date: iso,
              timeZone,
              boundaryMode: "midnight"
            });
          }
        }
      }
      if (mapped && mapped.insideCountedYear) {
        coordinate =
          "Moon " + mapped.moon +
          " · Day " + mapped.day +
          " · Pattern Day " + mapped.dayOfPatternYear;
      } else if (mapped) {
        coordinate = mapped.isDeepTimeDay
          ? "Deep Time Day"
          : (mapped.moonName || "Day Out of Time");
      }
    } catch (error) {
      coordinate = null;
    }

    const line = coordinate ? civil + " · " + coordinate : civil;
    els.forEach((el) => {
      el.textContent = line;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fillDayLine);
  } else {
    fillDayLine();
  }
})();
