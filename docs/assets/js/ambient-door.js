/* The Ambient Door — the homepage's first face.
 *
 * Speaks today's coordinate and telling from the site's canonical
 * calendar only: PatternCalendar.fromCivilDate joined with
 * PatternCalendarData — the same computation home-telling.js and
 * living-entry.js use, so the door and the rest of the site never
 * disagree about what day it is. This module keeps no clock and no
 * calendar math of its own. The static markup already carries the real
 * day for the moment the page was last sealed; this script refreshes
 * it for the visitor's actual day. On any failure — or on a day
 * outside the counted year — honest static copy stands.
 *
 * It also rests the door's light on the visitor's own daypart (dawn,
 * day, dusk, night) — a class, nothing more. No sound, ever; the film
 * is tap-to-play and starts silent until a visitor chooses it.
 */
(() => {
  "use strict";

  const door = document.querySelector("[data-ambient-door]");
  if (!door) return;

  const civilEl = door.querySelector("[data-ambient-civil]");
  const coordinateEl = door.querySelector("[data-ambient-coordinate]");
  const patternEl = door.querySelector("[data-ambient-pattern]");
  const tellingEl = door.querySelector("[data-ambient-telling]");
  const practiceEl = door.querySelector("[data-ambient-practice]");

  // The door's light follows the visitor's own hour.
  try {
    const hour = new Date().getHours();
    const part =
      hour >= 5 && hour < 10 ? "dawn" :
      hour >= 10 && hour < 17 ? "day" :
      hour >= 17 && hour < 21 ? "dusk" : "night";
    door.classList.add("ambient-door--" + part);
  } catch (error) {
    /* The sealed gradient stands. */
  }

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

    if (civilEl) {
      try {
        const civil = new Intl.DateTimeFormat("en-US", {
          timeZone,
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric"
        }).format(new Date());
        civilEl.textContent = "Today · " + civil;
      } catch (error) {
        /* The sealed civil line stands. */
      }
    }

    if (!mapped.insideCountedYear) {
      const name = mapped.isDeepTimeDay
        ? data.deepTimeDayName
        : (mapped.moonName || data.dayOutOfTimeName);
      if (coordinateEl) coordinateEl.textContent = name;
      if (patternEl) patternEl.textContent = "Outside the counted 364 days";
      if (tellingEl) {
        tellingEl.textContent =
          name + " — outside the counted 364 days. The year rests before it turns.";
      }
      if (practiceEl) {
        practiceEl.textContent =
          "No moon practice today; witness the pause itself.";
      }
      return;
    }

    const moon = data.moons[mapped.moon - 1];
    const archetype = data.dayArchetypes[mapped.day - 1];
    const week = Math.ceil(mapped.day / 7);
    const gate = data.weekGates[week - 1];
    if (!moon || !archetype || !gate) return;

    if (coordinateEl) {
      coordinateEl.textContent =
        "Day " + mapped.day + " of the " + moon.name + " moon";
    }
    if (patternEl) {
      patternEl.textContent =
        "Pattern Day " + mapped.dayOfPatternYear + " of 364";
    }
    if (tellingEl) {
      tellingEl.textContent =
        "Day " + mapped.day + " of the " + moon.name + " moon · Pattern Day " +
        mapped.dayOfPatternYear + " of 364. " + gate[0] + ": " + soften(gate[1]) +
        ". The day's name is " + archetype[0] + " — " + soften(archetype[1]) + ".";
    }
    if (practiceEl) {
      practiceEl.textContent =
        "The moon's practice: " + softenSentences(moon.practice) + ".";
    }
  } catch (error) {
    /* The static day stands. */
  }
})();
