/* The day's telling — homepage panel.
 *
 * Computes today's telling from the site's canonical calendar only:
 * PatternCalendar.fromCivilDate (the same computation living-entry.js
 * uses for the coordinate line printed above the panel) joined with
 * PatternCalendarData (moon names and practices, day archetypes, week
 * gates). The sentence shapes match the 13 Moons telling so the site
 * speaks about a day in one voice. The static markup already carries
 * the real telling for the day the page was last sealed; this script
 * refreshes it for the visitor's actual day. On any failure — or on a
 * day outside the counted year — the static copy stands.
 */
(() => {
  "use strict";

  const block = document.querySelector("[data-home-telling]");
  if (!block) return;
  const mainEl = block.querySelector("[data-home-telling-main]");
  const practiceEl = block.querySelector("[data-home-telling-practice]");
  if (!mainEl || !practiceEl) return;

  function todayISOInZone(timeZone) {
    try {
      // en-CA formats as YYYY-MM-DD.
      return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
    } catch (error) {
      return null;
    }
  }

  // "Watch pressure, and refinement." -> "watch pressure, and refinement"
  function soften(sentence) {
    const text = String(sentence || "").trim().replace(/\.$/, "");
    return text.charAt(0).toLowerCase() + text.slice(1);
  }

  // "Look beneath. Journal first." -> "look beneath; journal first"
  function softenSentences(text) {
    const joined = String(text || "").trim().replace(
      /\.\s+(\S)/g,
      (match, ch) => "; " + ch.toLowerCase()
    );
    return soften(joined);
  }

  try {
    const calendar = globalThis.PatternCalendar;
    const data = globalThis.PatternCalendarData;
    if (!calendar || typeof calendar.fromCivilDate !== "function" || !data) return;

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const iso = todayISOInZone(timeZone);
    if (!iso) return;

    const mapped = calendar.fromCivilDate({
      date: iso,
      timeZone,
      boundaryMode: "midnight"
    });
    if (!mapped) return;

    if (!mapped.insideCountedYear) {
      const name = mapped.isDeepTimeDay
        ? data.deepTimeDayName
        : (mapped.moonName || data.dayOutOfTimeName);
      mainEl.textContent =
        name + " — outside the counted 364 days. The year rests before it turns.";
      practiceEl.textContent =
        "No moon practice today; witness the pause itself.";
      return;
    }

    const moon = data.moons[mapped.moon - 1];
    const archetype = data.dayArchetypes[mapped.day - 1];
    const week = Math.ceil(mapped.day / 7);
    const gate = data.weekGates[week - 1];
    if (!moon || !archetype || !gate) return;

    mainEl.textContent =
      "Day " + mapped.day + " of the " + moon.name + " moon · Pattern Day " +
      mapped.dayOfPatternYear + " of 364. " + gate[0] + ": " + soften(gate[1]) +
      ". The day's name is " + archetype[0] + " — " + soften(archetype[1]) + ".";
    practiceEl.textContent =
      "The moon's practice: " + softenSentences(moon.practice) + ".";
  } catch (error) {
    /* The static telling stands. */
  }
})();
