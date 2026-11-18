/*
 * Living Entry — homepage only (docs/index.html).
 *
 * Three behaviours, all progressive enhancements:
 *
 * 1. THE ENTRY — on every visit, the Codex wakes:
 *    a cracked-stone emblem draws its gold seams, the teal eye opens, and a
 *    status line walks the growth sequence (Witness → Encode → Resonate →
 *    Integrate → Illuminate) over a living data line: today's civil date
 *    and today's 13 Moons coordinate, computed with the site's own
 *    PatternCalendar (loaded before this file). ~3.9s, then it fades softly.
 *    Any click, tap, or keypress dismisses it at once. It never appears
 *    under prefers-reduced-motion, and never without JS (it is injected
 *    from here, never hard-coded in the HTML).
 *
 * 2. THE PATH RAIL — the fixed step indicator gets its active state from
 *    an IntersectionObserver over the five step heads. Without JS the rail
 *    is plain anchors and still works.
 *
 * 3. STAGED REVEALS — main sections fade/rise as they enter the viewport,
 *    once each. Sections are visible by default; the hidden state is only
 *    applied by this script, at runtime, to sections still below the fold.
 *    No scroll hijacking, no scroll-snap.
 */
(() => {
  "use strict";

  const STAGES = [
    "Witnessing…",
    "Encoding…",
    "Resonating…",
    "Integrating…",
    "Illuminating…"
  ];

  const STAGE_MS = 575;
  const HOLD_END_MS = 3200;
  const FADE_MS = 750;

  const reducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------------- */
  /* The living data line                                              */
  /* ---------------------------------------------------------------- */

  function todayISOInZone(timeZone) {
    try {
      // en-CA formats as YYYY-MM-DD.
      return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
    } catch (error) {
      return null;
    }
  }

  function livingCoordinateLine() {
    const civil = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });

    let coordinate = null;

    try {
      const calendar = globalThis.PatternCalendar;
      if (calendar && typeof calendar.fromCivilDate === "function") {
        const timeZone =
          Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
        const iso = todayISOInZone(timeZone);
        if (iso) {
          const mapped = calendar.fromCivilDate({
            date: iso,
            timeZone,
            boundaryMode: "midnight"
          });
          if (mapped && mapped.insideCountedYear) {
            coordinate =
              "Moon " + mapped.moon +
              " · Day " + mapped.day +
              " · Pattern Day " + mapped.dayOfPatternYear;
          } else if (mapped) {
            // Day Out of Time / Deep Time Day — outside the counted year.
            coordinate = mapped.isDeepTimeDay
              ? "Deep Time Day"
              : (mapped.moonName || "Day Out of Time");
          }
        }
      }
    } catch (error) {
      coordinate = null;
    }

    return { civil, coordinate };
  }

  /* ---------------------------------------------------------------- */
  /* The entry overlay                                                 */
  /* ---------------------------------------------------------------- */

  const EMBLEM = [
    '<svg class="le-emblem" viewBox="0 0 200 200" aria-hidden="true" focusable="false">',
    "<defs>",
    '<radialGradient id="le-stone" cx="50%" cy="42%" r="68%">',
    '<stop offset="0%" stop-color="#1a2233"/>',
    '<stop offset="70%" stop-color="#0b0f1a"/>',
    '<stop offset="100%" stop-color="#05070d"/>',
    "</radialGradient>",
    "</defs>",
    '<circle cx="100" cy="100" r="86" fill="url(#le-stone)" stroke="#3a4358" stroke-width="1.5"/>',
    '<circle class="le-orbit" cx="100" cy="100" r="86" fill="none" stroke="rgba(243,201,122,0.35)" stroke-width="1" stroke-dasharray="3 7"/>',
    '<g fill="none" stroke="#f3c97a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
    '<path class="le-crack" pathLength="100" style="--d:0.05s" d="M100 14 L92 44 L104 66 L96 92"/>',
    '<path class="le-crack" pathLength="100" style="--d:0.2s" d="M186 100 L156 94 L138 108 L118 100"/>',
    '<path class="le-crack" pathLength="100" style="--d:0.35s" d="M100 186 L108 156 L94 138 L102 116"/>',
    '<path class="le-crack" pathLength="100" style="--d:0.5s" d="M14 100 L44 108 L62 92 L84 102"/>',
    '<path class="le-crack" pathLength="100" style="--d:0.65s" d="M160 40 L138 62 L142 84"/>',
    '<path class="le-crack" pathLength="100" style="--d:0.8s" d="M40 160 L62 140 L58 118"/>',
    "</g>",
    '<g class="le-eye">',
    '<path d="M100 100 m0 -5 a5 5 0 0 1 5 5 a10 10 0 0 1 -10 10 a15 15 0 0 1 -15 -15 a20 20 0 0 1 20 -20 a25 25 0 0 1 25 25 a30 30 0 0 1 -30 30" fill="none" stroke="#7af3ff" stroke-width="3" stroke-linecap="round"/>',
    '<circle class="le-pupil" cx="100" cy="100" r="3.4" fill="#f3c97a"/>',
    "</g>",
    "</svg>"
  ].join("");

  function showEntry() {
    if (reducedMotion) return;

    const { civil, coordinate } = livingCoordinateLine();

    const overlay = document.createElement("div");
    overlay.className = "le-overlay";
    overlay.setAttribute("aria-hidden", "true");

    const dataLine = coordinate
      ? "<strong>" + civil + "</strong> · " + coordinate
      : "<strong>" + civil + "</strong>";

    overlay.innerHTML =
      '<div class="le-overlay-inner">' +
        '<div class="le-emblem-wrap">' + EMBLEM + "</div>" +
        '<p class="le-status">' + STAGES[0] + "</p>" +
        '<p class="le-data"><span class="le-alive">The Codex is alive</span>' +
          dataLine +
        "</p>" +
        '<p class="le-hint">Click or press any key to enter</p>' +
      "</div>";

    document.body.appendChild(overlay);
    document.body.classList.add("le-lock");

    const status = overlay.querySelector(".le-status");
    let stageIndex = 0;
    let dismissed = false;

    const stageTimer = window.setInterval(() => {
      stageIndex += 1;
      if (stageIndex >= STAGES.length) {
        window.clearInterval(stageTimer);
        return;
      }
      status.classList.add("le-status-swap");
      window.setTimeout(() => {
        status.textContent = STAGES[stageIndex];
        status.classList.remove("le-status-swap");
      }, 200);
    }, STAGE_MS);

    const holdTimer = window.setTimeout(() => dismiss(false), HOLD_END_MS);

    function onKeydown() {
      dismiss(true);
    }

    function onPointerdown() {
      dismiss(true);
    }

    function dismiss(instant) {
      if (dismissed) return;
      dismissed = true;
      window.clearInterval(stageTimer);
      window.clearTimeout(holdTimer);
      document.removeEventListener("keydown", onKeydown, true);
      if (instant) {
        // A visitor's tap or keypress is never trapped by the soft fade.
        overlay.remove();
        document.body.classList.remove("le-lock");
        return;
      }
      overlay.classList.add("le-leaving");
      window.setTimeout(() => {
        overlay.remove();
        document.body.classList.remove("le-lock");
      }, FADE_MS);
    }

    overlay.addEventListener("pointerdown", onPointerdown);
    document.addEventListener("keydown", onKeydown, true);
  }

  /* ---------------------------------------------------------------- */
  /* The path rail                                                     */
  /* ---------------------------------------------------------------- */

  function initRail() {
    const links = Array.from(
      document.querySelectorAll(".le-rail a[href^='#step-']")
    );
    const heads = Array.from(document.querySelectorAll(".le-path-head[id]"));
    if (!links.length || !heads.length) return;
    if (!("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          links.forEach((link) => {
            const active =
              link.getAttribute("href") === "#" + entry.target.id;
            link.classList.toggle("is-active", active);
            if (active) {
              link.setAttribute("aria-current", "step");
            } else {
              link.removeAttribute("aria-current");
            }
          });
        });
      },
      { rootMargin: "-38% 0px -55% 0px", threshold: 0 }
    );

    heads.forEach((head) => observer.observe(head));
  }

  /* ---------------------------------------------------------------- */
  /* Staged reveals                                                    */
  /* ---------------------------------------------------------------- */

  function initReveals() {
    if (reducedMotion) return;
    if (!("IntersectionObserver" in window)) return;

    const targets = Array.from(
      document.querySelectorAll("#main > section, #main > .le-path-lead")
    );
    if (!targets.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.remove("le-reveal-pending");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.04 }
    );

    targets.forEach((target) => {
      const rect = target.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.94) {
        // Already in (or near) the first viewport — never hide it.
        return;
      }
      target.classList.add("le-reveal-pending");
      observer.observe(target);
    });
  }

  /* ---------------------------------------------------------------- */
  /* The living activity panel ("The Codex Today")                     */
  /*                                                                   */
  /* Fed only by real site data: today's coordinate from the site's    */
  /* own PatternCalendar (the same computation as the entry overlay),  */
  /* the latest growth-record additions mirrored live from the Front   */
  /* Door list (so stewardship edits flow here — no second copy to     */
  /* keep), and a line for the day chosen by day-of-year from lines    */
  /* that already stand on this page. Nothing is invented; without     */
  /* JS the panel still shows the real values in its static markup.    */
  /* ---------------------------------------------------------------- */

  const TEACHINGS = [
    { text: "Look at what is happening before rushing to name it.", source: "The Daily Return" },
    { text: "Give the pattern a clean word, symbol, moon marker, or ledger note.", source: "The Daily Return" },
    { text: "Breathe, record, act, and bring the body back into the present field.", source: "The Daily Return" },
    { text: "Track rhythm through the Remnant 13 Moons calendar, moon phase, symbolic day reading, and seasonal witness practice.", source: "13 Moons" },
    { text: "The daily rhythm engine: moon, element, witness, calendar, mirror, and return.", source: "The Daily Rhythm" },
    { text: "Use the moving field as a simple mirror. Let the page slow the room before choosing where to go next.", source: "First Exercise" },
    { text: "Explore handcrafted copper, stone, glass, and Living Technology pieces entered into the Artifact Registry.", source: "Living Technology" }
  ];

  function dayOfYear(now) {
    const start = new Date(now.getFullYear(), 0, 0);
    return Math.floor((now - start) / 86400000);
  }

  function initActivity() {
    const panel = document.getElementById("living-activity");
    if (!panel) return;

    const todayEl = panel.querySelector("[data-le-today]");
    if (todayEl) {
      const { civil, coordinate } = livingCoordinateLine();
      todayEl.textContent = coordinate ? civil + " · " + coordinate : civil;
    }

    const growthEl = panel.querySelector("[data-le-growth]");
    const sourceList = document.querySelector(
      'section[aria-labelledby="front-door-recent"] ul'
    );
    if (growthEl && sourceList) {
      const items = Array.from(sourceList.querySelectorAll("li")).slice(0, 3);
      if (items.length) {
        growthEl.replaceChildren(
          ...items.map((item) => item.cloneNode(true))
        );
      }
    }

    const teachingEl = panel.querySelector("[data-le-teaching]");
    const sourceEl = panel.querySelector("[data-le-teaching-source]");
    if (teachingEl) {
      const pick = TEACHINGS[dayOfYear(new Date()) % TEACHINGS.length];
      teachingEl.textContent = pick.text;
      if (sourceEl) sourceEl.textContent = pick.source;
    }
  }

  /* ---------------------------------------------------------------- */

  function init() {
    initActivity();
    showEntry();
    initRail();
    initReveals();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
