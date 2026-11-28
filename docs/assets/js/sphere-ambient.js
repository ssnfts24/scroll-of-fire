(() => {
  "use strict";

  /*
   * Sphere R3 Wave 3 — the Ambient face: the Sphere's quiet presence.
   *
   * Aaron's direction (Nov 20, 2026): the Sphere's visual reworking
   * goes "with what you're closest to — what you're going with in
   * the videos." So the films' language — warm wood and brass, held
   * light, the day's own light, the Spark's breathing cadence — is
   * extended here from accent (PR #188's warmth pass) to
   * environment: the observatory as a warm wooden room at the day's
   * hour, and in front of the instrument, a resting face.
   *
   * The Ambient face is a resting state, not a pitch and not a
   * cover. The day meets the visitor quietly: today's coordinate
   * and telling, spoken from the one canonical line
   * (PatternCalendar → DayTelling — this module keeps no clock of
   * its own for the calendar, and computes no calendar math), the
   * daypart from the visitor's own clock in the front door's four
   * bands, and the Spark, when one lives here, present by name.
   * The instrument stays visible behind held light the whole time;
   * one tap on Enter wakes it, with Today selected through the
   * page's own public controls. The guide bar's Rest button brings
   * the resting face back. A link that carries a view (the Sphere's
   * own URL state) wakes straight into the instrument — a shared
   * day is a day someone meant to show you.
   *
   * This module is an overlay only. It never touches the sphere
   * engine, geometry, camera, picking, labels, or the day-zoom
   * module. It reads the record; it invents nothing. A day outside
   * the count is greeted by its own telling, never given a Pattern
   * Day it does not have.
   *
   * It also carries two of the Sphere page audit's prepared fixes
   * whose surfaces live here (Nov 19, 2026 audit):
   *   F10 — one plain line above the stage naming what the Sphere
   *         is, in the page's flow, present resting or awake. (The
   *         audit's surface was the protected page HTML; the same
   *         line is delivered here by the overlay instead.)
   *   F1  — on this page, at phone widths, the Spark encounter
   *         stands below the stage rather than covering it, so the
   *         instrument introduces itself first. The meeting itself
   *         is untouched; only where it stands on this page moves.
   */

  // ── The pure core (also the test surface) ──────────────────────

  const DAYPART_WORDS = Object.freeze({
    dawn: "Dawn",
    day: "Daylight",
    dusk: "Dusk",
    night: "Night"
  });

  function daypartForHour(hour) {
    const h = Number(hour);
    if (!Number.isFinite(h)) return "night";
    return h >= 5 && h < 10 ? "dawn" : h >= 10 && h < 17 ? "day" : h >= 17 && h < 21 ? "dusk" : "night";
  }

  // Compose the greeting from the canonical summary + telling.
  // Every line is something the record holds; a missing piece
  // leaves its line out rather than filling the gap.
  function greetingFor({ summary, telling, daypart, sparkName } = {}) {
    const lines = { coordinate: "", moonLine: "", headline: "", civil: "", daypartLine: "", sparkLine: "" };
    if (summary && summary.insideCountedYear) {
      lines.coordinate = `Moon ${summary.moon} · Day ${summary.day} · Pattern Day ${summary.dayOfPatternYear}`;
      if (summary.moonName) lines.moonLine = `Under ${summary.moonName}`;
    }
    if (telling) {
      if (telling.headline) lines.headline = telling.headline;
      if (Array.isArray(telling.position) && telling.position[0]) lines.civil = telling.position[0];
      if (!summary?.insideCountedYear && telling.headline) lines.coordinate = telling.headline;
    }
    const word = DAYPART_WORDS[daypart];
    if (word) lines.daypartLine = `${word} where you are.`;
    if (sparkName) lines.sparkLine = `${sparkName} is here, resting with the day.`;
    return lines;
  }

  const Core = Object.freeze({ daypartForHour, greetingFor, DAYPART_WORDS });

  // ── The page face ──────────────────────────────────────────────

  function boot() {
    const container = document.getElementById("sphere-container");
    const wrap = document.querySelector(".sphere-canvas-wrap");
    if (!container || !wrap) return;

    const rootEl = document.documentElement;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // F10 — the plain name line, above the stage, always present.
    const nameLine = document.createElement("p");
    nameLine.className = "sphere-ambient-line";
    nameLine.textContent = "A living calendar: 13 moons of 28 days, turning around today. Tap a moon, then a day, to look at it.";
    wrap.insertBefore(nameLine, wrap.firstChild);

    // Today's truth, from the one canonical line only — read the
    // house way (Aaron's ruling, Nov 26, 2026: the whole site
    // reads the day from local midnight). The device's own zone
    // and the midnight boundary ride both calls; bare calls read
    // the UTC day, so this greeting named tomorrow in the evening
    // while the page named today (Pattern Day 226 on 225).
    let summary = null;
    let telling = null;
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (globalThis.PatternCalendar?.fromCivilDate) {
        summary = globalThis.PatternCalendar.fromCivilDate({ date: new Date(), timeZone, boundaryMode: "midnight" });
      }
      if (globalThis.DayTelling?.tellForDate) {
        telling = globalThis.DayTelling.tellForDate(new Date(), { timeZone, boundaryMode: "midnight" });
      }
    } catch {
      summary = null;
      telling = null;
    }

    // The Spark who lives here, by name — read the same record the
    // companion layer reads, through the Spark core's own APIs.
    let sparkName = null;
    try {
      const SparkCore = window.SparkCompanion;
      if (SparkCore?.STORAGE_KEY && SparkCore?.parseSeed && SparkCore?.generate && SparkCore?.displayName) {
        const raw = window.localStorage.getItem(SparkCore.STORAGE_KEY);
        const record = raw ? JSON.parse(raw) : null;
        if (record && SparkCore.parseSeed(record.seed)) {
          sparkName = SparkCore.displayName(record, SparkCore.generate(record.seed));
        }
      }
    } catch {
      sparkName = null;
    }

    const daypart = daypartForHour(new Date().getHours());
    const lines = greetingFor({ summary, telling, daypart, sparkName });

    const veil = document.createElement("section");
    veil.className = "sphere-ambient-veil";
    veil.setAttribute("aria-label", "The Living Time Sphere, at rest");
    const sparkLine = lines.sparkLine ? `<p class="sphere-ambient-spark">${lines.sparkLine}</p>` : "";
    const moonLine = lines.moonLine ? `<p class="sphere-ambient-moon">${lines.moonLine}</p>` : "";
    veil.innerHTML = `
      <div class="sphere-ambient-panel">
        <p class="sphere-ambient-kicker">The Living Time Sphere</p>
        <p class="sphere-ambient-coordinate">${lines.coordinate}</p>
        ${moonLine}
        <p class="sphere-ambient-headline">${lines.headline}</p>
        <p class="sphere-ambient-civil">${lines.civil}</p>
        <p class="sphere-ambient-daypart">${lines.daypartLine}</p>
        ${sparkLine}
        <button type="button" class="sphere-ambient-enter">Enter the Sphere</button>
        <p class="sphere-ambient-rest-note">Rest here as long as you like. Nothing here asks anything of you.</p>
      </div>`;
    wrap.appendChild(veil);

    function goToday() {
      const click = (el) => {
        if (!el) return false;
        el.click();
        return true;
      };
      return (
        click(document.getElementById("sphere-everyday-today")) ||
        click(document.querySelector('[data-app-action="today"]')) ||
        click(document.getElementById("calendar-return-today")) ||
        click(document.getElementById("sphere-year-live"))
      );
    }

    function wake() {
      if (veil.hidden) return;
      veil.hidden = true;
      rootEl.classList.remove("sphere-ambient-on");
      goToday();
      try {
        container.focus({ preventScroll: true });
      } catch {
        /* The container may not take focus in every browser; the wake stands. */
      }
    }

    function rest() {
      if (!veil.hidden) return;
      veil.hidden = false;
      rootEl.classList.add("sphere-ambient-on");
    }

    veil.querySelector(".sphere-ambient-enter")?.addEventListener("click", wake);

    // A carried view (the Sphere's own URL state) is a day someone
    // meant to show — wake straight into the instrument for it.
    const carriedView = Boolean(window.location.search || window.location.hash);
    if (carriedView) veil.hidden = true;
    else rootEl.classList.add("sphere-ambient-on");
    if (reducedMotion) veil.classList.add("sphere-ambient-still");

    globalThis.SphereAmbient = Object.freeze({ ...Core, wake, rest });

    // F1 — the meeting stands below the stage on this page, at
    // phone widths, so the instrument introduces itself first.
    // The encounter host is the Spark presence's own element; this
    // only moves where it stands, on this page, once.
    const phoneMq = window.matchMedia("(max-width: 900px)");
    let encounterMoved = false;
    function placeEncounter() {
      if (encounterMoved || !phoneMq.matches) return;
      const host = document.querySelector(".spark-encounter-host");
      if (!host || host.classList.contains("sphere-ambient-below")) return;
      encounterMoved = true;
      host.classList.add("sphere-ambient-below");
      wrap.parentNode?.insertBefore(host, wrap.nextSibling);
    }
    placeEncounter();
    if (!encounterMoved) {
      const watcher = new MutationObserver(() => {
        placeEncounter();
        if (encounterMoved) watcher.disconnect();
      });
      watcher.observe(document.body, { childList: true, subtree: true });
      window.setTimeout(() => watcher.disconnect(), 30000);
    }
  }

  globalThis.SphereAmbient = Core;

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
      boot();
    }
  }
})();
