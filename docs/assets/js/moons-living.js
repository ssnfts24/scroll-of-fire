/*
 * Remnant 13 Moons — the Living Look layer (moons.html).
 *
 * Presentation only. The calendar, its records, and its rules all live
 * in the page's own engines; this layer never writes a calendar record,
 * never computes a date of its own, and rebuilds nothing. It reads the
 * day only through the canonical PatternCalendar's public surface
 * (PatternCalendar.fromCivilDate) and the moon names and details only
 * from PatternCalendarData — the site's existing data, exactly as it
 * stands. It adds the Living Look's four tests to the room:
 *
 *  1. Responds — the one action, opening today, stands first in the
 *     stage and takes the keeper straight to today's day in the
 *     page's own 28-day map, through the page's own tab surface.
 *  2. Remembers — the welcome is drawn only from the page's own
 *     existing local records (the last room the page itself kept,
 *     sof_moons_last_tab_v1, and the saved witness logs,
 *     sof_moon_logs_v3 / sof_moon_logs_v2), read before the page's
 *     setup for this visit rewrites the last-room note. This layer
 *     writes no record of its own.
 *  3. One clear action — the Spark's station points at that action.
 *  4. The real day — the breathing intro and the stage carry today's
 *     coordinate from the canonical PatternCalendar; the Moon you are
 *     in fills the stage, its tint (the site's living-moon-theme) is
 *     the room's light, today's Moon stands in gold among the
 *     thirteen, and today's day stands in gold in the Moon's map.
 *
 * The astrology layer keeps its fence exactly as built: this layer
 * never loads it; it opens only when its own tab opens, as now.
 * Motion only answers; under prefers-reduced-motion the intro is
 * never injected and every decoration stands still.
 */
(() => {
  "use strict";

  const reducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const INTRO_KEY = "sof.moons.intro.v1";

  /* The page's own kept place, read now — this deferred script runs
   * before the page's DOMContentLoaded setup, which rewrites the
   * last-room note for this visit. Reading later would mistake this
   * visit for the last one. */
  const kept = (() => {
    let lastTab = null;
    let logCount = 0;
    try {
      lastTab = localStorage.getItem("sof_moons_last_tab_v1");
      for (const key of ["sof_moon_logs_v3", "sof_moon_logs_v2"]) {
        const parsed = JSON.parse(localStorage.getItem(key) || "[]");
        if (Array.isArray(parsed)) logCount += parsed.length;
      }
    } catch { /* the welcome still stands for this visit */ }
    return { lastTab, logCount };
  })();

  /* ---------------- today's line, from the canonical calendar -------- */

  function todaySummary() {
    try {
      const calendar = globalThis.PatternCalendar;
      if (!calendar || typeof calendar.fromCivilDate !== "function") return null;
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone, year: "numeric", month: "2-digit", day: "2-digit"
      }).formatToParts(new Date());
      const get = t => (parts.find(p => p.type === t) || {}).value;
      if (!get("year")) return null;
      const iso = `${get("year")}-${get("month")}-${get("day")}`;
      return calendar.fromCivilDate({ date: iso, timeZone, boundaryMode: "midnight" });
    } catch { return null; }
  }

  function moonData(summary) {
    try {
      const moons = globalThis.PatternCalendarData && globalThis.PatternCalendarData.moons;
      if (!summary || !summary.insideCountedYear || !Array.isArray(moons)) return null;
      return moons[summary.moon - 1] || null;
    } catch { return null; }
  }

  function todayLine(summary) {
    if (!summary) return null;
    if (summary.insideCountedYear) {
      return `Moon ${summary.moon} · ${summary.moonName} · Day ${summary.day} of 28 · Pattern Day ${summary.dayOfPatternYear}`;
    }
    return summary.isDeepTimeDay ? "Deep Time Day" : "Day Out of Time";
  }

  /* ---------------- the breathing intro ------------------------------ */
  /* Solid ground of its own, slowed to breathe, one tap dismisses it.
   * Injected from here, never hard-coded: no JS or reduced motion
   * means the calendar simply stands open. Once per session. */

  function showIntro(summary) {
    if (reducedMotion) return;
    try { if (sessionStorage.getItem(INTRO_KEY)) return; } catch { /* show it */ }
    const overlay = document.createElement("div");
    overlay.className = "ml-intro";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "Remnant 13 Moons — entry");
    const inner = document.createElement("div");
    inner.className = "ml-intro-inner";
    const mark = document.createElement("span");
    mark.className = "ml-intro-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = "☾";
    const name = document.createElement("p");
    name.className = "ml-intro-name";
    name.textContent = "Remnant 13 Moons";
    const line = document.createElement("p");
    line.className = "ml-intro-line";
    line.textContent = todayLine(summary) || "Thirteen moons, one counted year.";
    const hint = document.createElement("p");
    hint.className = "ml-intro-hint";
    hint.textContent = "Tap anywhere to step in";
    inner.append(mark, name, line, hint);
    overlay.appendChild(inner);
    document.body.appendChild(overlay);
    document.body.classList.add("ml-intro-lock");

    let gone = false;
    const dismiss = () => {
      if (gone) return;
      gone = true;
      try { sessionStorage.setItem(INTRO_KEY, "1"); } catch { /* the tap still counts */ }
      overlay.classList.add("ml-intro-leaving");
      document.body.classList.remove("ml-intro-lock");
      window.setTimeout(() => overlay.remove(), 700);
    };
    overlay.addEventListener("pointerdown", dismiss);
    window.addEventListener("keydown", dismiss, { once: true });
    window.setTimeout(dismiss, 4600);
  }

  /* ---------------- the kept place ----------------------------------- */

  function welcome(summary) {
    const host = document.getElementById("moons-welcome");
    if (!host) return;
    const tabButton = kept.lastTab
      ? document.querySelector(`.tab[data-tab="${kept.lastTab}"]`)
      : null;
    const roomName = tabButton ? tabButton.textContent.trim() : null;
    const parts = [];
    if (roomName && kept.lastTab !== "todayPanel") {
      parts.push(`you left off in ${roomName} — that room stands as you left it, one tap above`);
    }
    if (kept.logCount > 0) {
      parts.push(`your ${kept.logCount} saved witness log${kept.logCount === 1 ? "" : "s"} stand in Saved Logs`);
    }
    const moon = moonData(summary);
    const keptText = parts.join("; ");
    host.textContent = parts.length
      ? `I kept your place — welcome back. ${keptText.charAt(0).toUpperCase()}${keptText.slice(1)}.`
      : moon
        ? `Welcome. The Moon you are in is ${moon.name} — its days stand below, and today is lit in gold.`
        : "Welcome. The thirteen moons stand below, and today is lit in gold.";
  }

  /* ---------------- the stage: the Moon you are in ------------------- */

  function fillStage(summary) {
    const moon = moonData(summary);
    const name = document.getElementById("moons-stage-moon-name");
    const line = document.getElementById("moons-stage-line");
    const essence = document.getElementById("moons-stage-essence");
    if (line) line.textContent = todayLine(summary) || "The day's line loads with the calendar.";
    if (!moon || !summary.insideCountedYear) {
      if (name) name.textContent = summary ? (summary.isDeepTimeDay ? "Deep Time Day" : "Day Out of Time") : "The Thirteen Moons";
      if (essence) essence.textContent = "Outside the counted year — the day stands apart, and the count resumes with the next Moon.";
      return;
    }
    if (name) name.textContent = `Moon ${summary.moon} · ${moon.name}`;
    if (essence) {
      essence.textContent = `${moon.essence} · ${moon.element} · ${moon.freq} — ${moon.practice}`;
    }
    const btn = document.getElementById("moons-open-today");
    if (btn) btn.textContent = `Open today — Day ${summary.day} of ${moon.name}`;
  }

  /* ---------------- the thirteen moons as the face ------------------- */

  function activateTab(id) {
    document.dispatchEvent(new CustomEvent("sof:activate-tab", {
      detail: { id, updateHistory: true, scroll: false }
    }));
  }

  function buildStrip(summary) {
    const host = document.getElementById("moons-strip");
    if (!host) return;
    let moons = null;
    try { moons = globalThis.PatternCalendarData && globalThis.PatternCalendarData.moons; } catch { moons = null; }
    if (!Array.isArray(moons) || !moons.length) return;
    host.textContent = "";
    for (const moon of moons) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "ml-moon-chip";
      const isCurrent = Boolean(summary && summary.insideCountedYear && summary.moon === moon.idx);
      if (isCurrent) {
        chip.classList.add("is-current");
        chip.setAttribute("aria-current", "true");
      }
      const title = document.createElement("strong");
      title.textContent = `Moon ${moon.idx} · ${moon.name}`;
      const detail = document.createElement("small");
      detail.textContent = `${moon.element} · ${moon.freq} · ${moon.essence}`;
      chip.append(title, detail);
      if (isCurrent) {
        const tag = document.createElement("small");
        tag.className = "ml-moon-chip-tag";
        tag.textContent = "You are here — today stands in this Moon";
        chip.appendChild(tag);
      }
      chip.addEventListener("click", () => {
        if (isCurrent) { openToday(); return; }
        activateTab("yearPanel");
        const panel = document.getElementById("yearPanel");
        if (panel) panel.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
      });
      host.appendChild(chip);
    }
  }

  /* ---------------- today's Moon in the Year Map --------------------- */

  function decorateYearMap(summary) {
    if (!summary || !summary.insideCountedYear) return;
    const body = document.getElementById("yearMapBody");
    if (!body) return;
    for (const row of body.querySelectorAll("tr")) {
      if (row.dataset.mlDecorated) continue;
      const first = row.querySelector("td");
      if (!first || first.textContent.trim() !== `Moon ${summary.moon}`) continue;
      row.dataset.mlDecorated = "1";
      row.classList.add("ml-year-current");
      const tag = document.createElement("span");
      tag.className = "ml-year-tag";
      tag.textContent = " · Today's Moon";
      first.appendChild(tag);
    }
  }

  function watchYearMap(summary) {
    const body = document.getElementById("yearMapBody");
    if (!body) return;
    decorateYearMap(summary);
    const observer = new MutationObserver(() => decorateYearMap(summary));
    observer.observe(body, { childList: true });
  }

  /* ---------------- the one action: open today ----------------------- */

  function focusToday() {
    const day = document.querySelector("#todaySummaryMoonGrid .today-summary-grid-day.today");
    if (day) { day.focus({ preventScroll: true }); return true; }
    return false;
  }

  function openToday() {
    activateTab("todayPanel");
    const panel = document.getElementById("todayPanel");
    if (panel) panel.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    if (focusToday()) return;
    /* The map re-renders with the day; focus today when it stands,
     * retrying briefly while the page settles around the tap. */
    const onRender = () => {
      if (focusToday()) document.removeEventListener("sof:moon-render", onRender);
    };
    document.addEventListener("sof:moon-render", onRender);
    window.setTimeout(() => document.removeEventListener("sof:moon-render", onRender), 4000);
    for (const delay of [60, 300, 900, 1800]) {
      window.setTimeout(focusToday, reducedMotion ? 60 : delay);
    }
  }

  function init() {
    const summary = todaySummary();
    showIntro(summary);
    fillStage(summary);
    welcome(summary);
    buildStrip(summary);
    watchYearMap(summary);
    const btn = document.getElementById("moons-open-today");
    if (btn) btn.addEventListener("click", openToday);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
