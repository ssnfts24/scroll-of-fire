"use strict";

/*
 * Living Look — the Scroll Library as a room (scroll/index.html).
 *
 * Three jobs, all from machinery the site already keeps:
 *
 * 1. THE REAL DAY ON THE FACE. Today's coordinate is read from the
 *    canonical PatternCalendar already loaded on this page (never a
 *    private calculation, never a guessed coordinate) and written
 *    into the day's line in the hero. The same reading stamps
 *    html[data-moon] / html[data-pattern-day] / html[data-daypart],
 *    which switches the Moon's tint through the site's own
 *    living-moon-theme.css palettes. (The theme's script is not
 *    carried here: it builds its day line with a root-relative
 *    "moons.html" door, which would break from inside /scroll/.
 *    This page builds its line with the library's own doors.)
 *
 * 2. IT REMEMBERS, AND RESUMES. The reader already keeps one local
 *    record — sof-scroll-last-passage, written by reader.js — and
 *    library.js already turns it into a "continue reading" bar.
 *    This layer folds that bar into today's reading panel, in the
 *    welcome framing: "I kept your place." Nothing new is stored.
 *
 * 3. EVERY SHELF REMEMBERS. The same single record names the last
 *    passage opened. Its shelf is found by matching its section id
 *    against the shelf lists this page already loads
 *    (data/shelf-*.html, fetched by the shelf loader on open) —
 *    read-only, no new store of watched or read state. The shelf
 *    that holds it is marked, on its card and in the full index.
 */
(() => {
  const root = document.documentElement;

  /* ---- 1. The day's line and the Moon's tint ---- */
  const hour = new Date().getHours();
  root.dataset.daypart = hour < 5 ? "night" : hour < 11 ? "morning" : hour < 17 ? "day" : hour < 20 ? "dusk" : "night";

  function todayISOInZone(timeZone) {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone, year: "numeric", month: "2-digit", day: "2-digit"
      }).formatToParts(new Date());
      const get = (t) => (parts.find((p) => p.type === t) || {}).value;
      if (get("year") && get("month") && get("day")) {
        return `${get("year")}-${get("month")}-${get("day")}`;
      }
    } catch (error) { /* fall through */ }
    return null;
  }

  let summary = null;
  try {
    const calendar = globalThis.PatternCalendar;
    if (calendar && typeof calendar.fromCivilDate === "function") {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const iso = todayISOInZone(timeZone);
      if (iso) summary = calendar.fromCivilDate({ date: iso, timeZone, boundaryMode: "midnight" });
    }
  } catch (error) { summary = null; }

  const civil = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
  const dayText = document.querySelector("[data-ll-day-text]");
  if (summary && summary.insideCountedYear) {
    root.dataset.moon = String(summary.moon);
    root.dataset.patternDay = String(summary.dayOfPatternYear);
    root.dataset.lmt = "on";
    if (dayText) {
      dayText.textContent = `${civil} · Moon ${summary.moon}${summary.moonName ? ` · ${summary.moonName}` : ""} · Day ${summary.day} · Pattern Day ${summary.dayOfPatternYear}`;
    }
  } else if (summary) {
    root.dataset.moon = "outside";
    root.dataset.lmt = "on";
    if (dayText) {
      dayText.textContent = `${civil} · ${summary.isDeepTimeDay ? "Deep Time Day" : (summary.moonName || "Day Out of Time")}`;
    }
  } else if (dayText) {
    dayText.textContent = civil;
  }

  /* ---- 2 + 3. The kept place, and its shelf ---- */
  let last = null;
  try {
    last = JSON.parse(localStorage.getItem("sof-scroll-last-passage") || "null");
  } catch (error) { last = null; }

  /* library.js renders the same record as a bar after the hero;
   * the room carries it inside today's reading instead — one
   * record, one door, never two. */
  const legacyBar = document.querySelector(".continue-reading");
  if (legacyBar) legacyBar.remove();

  if (!last || !last.id || !last.title) return;

  const href = `reader.html?section=${encodeURIComponent(last.id)}#reading`;
  const resume = document.querySelector("[data-ll-resume]");
  const resumeLink = document.querySelector("[data-ll-resume-link]");
  const resumeTitle = document.querySelector("[data-ll-resume-title]");
  if (resume && resumeLink) {
    resumeLink.href = href;
    if (resumeTitle) resumeTitle.textContent = last.title;
    resume.hidden = false;
  }

  const SHELVES = ["foundations", "scripture", "history", "evidence", "technology", "prophecy", "witness", "reference"];

  function markShelf(shelf) {
    const card = document.querySelectorAll(".shelf-grid .shelf-card")[SHELVES.indexOf(shelf)];
    if (card) {
      const chip = document.createElement("span");
      chip.className = "ll-shelf-kept";
      chip.textContent = "I kept your place on this shelf";
      card.appendChild(chip);
    }
    const details = document.getElementById(`shelf-${shelf}`);
    if (details) {
      const chip = document.createElement("a");
      chip.className = "ll-shelf-kept ll-shelf-kept-link";
      chip.href = href;
      chip.textContent = `I kept your place — ${last.title}`;
      const summaryEl = details.querySelector("summary");
      if (summaryEl) summaryEl.insertAdjacentElement("afterend", chip);
    }
  }

  (async () => {
    for (const shelf of SHELVES) {
      try {
        const res = await fetch(`data/shelf-${shelf}.html`);
        if (!res.ok) continue;
        const html = await res.text();
        if (html.includes(`reader.html?section=${last.id}`)) {
          markShelf(shelf);
          return;
        }
      } catch (error) {
        return; /* The shelf lists are a bonus mark; the resume door already stands. */
      }
    }
  })();
})();
