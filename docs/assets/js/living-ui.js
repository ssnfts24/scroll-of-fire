/*
 * Living UI — the tiny runtime for the shared living design layer.
 *
 * Two jobs, both progressive enhancements:
 *
 * 1. THE PAGE OPENING — one quiet moment on arrival (every content page
 *    except the homepage, which keeps its own full entry): the
 *    cracked-stone / spiral-eye mark settles in on the same opaque
 *    deep-stone ground as the homepage entry, with the page's own name
 *    and today's living line — the civil date, plus the 13 Moons
 *    coordinate ONLY where the site's PatternCalendar is already loaded
 *    on that page (never an invented coordinate). While it plays, the
 *    page beneath is neither visible nor interactive: the ground is
 *    opaque, the overlay takes the taps, and the page is scroll-locked
 *    (body.lpo-opening), exactly as the homepage entry locks. It adds
 *    no panels, no controls and no decisions, and leaves nothing
 *    behind: any click, tap or keypress dismisses it in the same
 *    instant (never trapped by the fade), it fades on its own at
 *    ~3.4s over 0.75s — pacing at or beyond the homepage entry's — and
 *    it removes itself from the DOM when done. Scrolling does not
 *    dismiss it: the page is locked still beneath it (some pages
 *    scroll themselves on arrival, and their opening must not be
 *    killed by their own machinery), exactly as the homepage entry
 *    is dismissed only by tap or key. It is injected from here, never
 *    hard-coded in markup, so no-JS pages render fully normal — and
 *    it never appears under prefers-reduced-motion.
 *
 * 2. STAGED REVEALS — reveal-on-enter for top-level sections on pages
 *    that carry the layer (body.living-ui). Sections are visible by
 *    default; the hidden state (.lui-reveal-pending) is applied here,
 *    at runtime, only to sections still below the fold — so no-JS and
 *    reduced-motion visitors lose nothing, and nothing is ever
 *    hijacked.
 *
 * The homepage opts out of both: living-entry.js already runs the full
 * entry and the same reveal discipline there.
 */
(() => {
  "use strict";

  if (document.querySelector('script[src*="living-entry"]')) return;
  if (!document.body || !document.body.classList.contains("living-ui")) return;

  const reducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------------- */
  /* The page opening                                                  */
  /* ---------------------------------------------------------------- */

  /* Pacing floor is the homepage entry's (living-entry.js: hold ends
   * at 3200ms, fade 750ms, ~3.95s on screen). The page opening holds a
   * breath longer: fade begins at 3400ms, fades over 750ms — 4.15s in
   * all. LPO_FADE_MS must equal the .lpo-overlay transition in
   * living-ui.css; tests/living-page-openings.test.js pins the pair. */
  const LPO_FADE_AT_MS = 3400;
  const LPO_FADE_MS = 750;

  const LPO_EMBLEM = [
    '<svg class="lpo-emblem" viewBox="0 0 200 200" aria-hidden="true" focusable="false">',
    "<defs>",
    '<radialGradient id="lpo-stone" cx="50%" cy="42%" r="68%">',
    '<stop offset="0%" stop-color="#1a2233"/>',
    '<stop offset="70%" stop-color="#0b0f1a"/>',
    '<stop offset="100%" stop-color="#05070d"/>',
    "</radialGradient>",
    "</defs>",
    '<circle cx="100" cy="100" r="86" fill="url(#lpo-stone)" stroke="#3a4358" stroke-width="1.5"/>',
    '<circle cx="100" cy="100" r="86" fill="none" stroke="rgba(243,201,122,0.35)" stroke-width="1" stroke-dasharray="3 7"/>',
    '<g fill="none" stroke="#f3c97a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
    '<path d="M100 14 L92 44 L104 66 L96 92"/>',
    '<path d="M186 100 L156 94 L138 108 L118 100"/>',
    '<path d="M100 186 L108 156 L94 138 L102 116"/>',
    '<path d="M14 100 L44 108 L62 92 L84 102"/>',
    '<path d="M160 40 L138 62 L142 84"/>',
    '<path d="M40 160 L62 140 L58 118"/>',
    "</g>",
    '<g class="lpo-eye">',
    '<path d="M100 100 m0 -5 a5 5 0 0 1 5 5 a10 10 0 0 1 -10 10 a15 15 0 0 1 -15 -15 a20 20 0 0 1 20 -20 a25 25 0 0 1 25 25 a30 30 0 0 1 -30 30" fill="none" stroke="#7af3ff" stroke-width="3" stroke-linecap="round"/>',
    '<circle cx="100" cy="100" r="3.4" fill="#f3c97a"/>',
    "</g>",
    "</svg>"
  ].join("");

  function lpoTodayISOInZone(timeZone) {
    try {
      // en-CA formats as YYYY-MM-DD.
      return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
    } catch (error) {
      return null;
    }
  }

  /* Today's living line. The 13 Moons coordinate is computed only when
   * this page already carries the site's PatternCalendar; otherwise the
   * line is the civil date alone — a coordinate is never guessed. */
  function lpoLivingLine() {
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
        const iso = lpoTodayISOInZone(timeZone);
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

    return coordinate ? civil + " · " + coordinate : civil;
  }

  function lpoPageName() {
    const heading = document.querySelector("h1");
    // innerText first: it honors <br> and block breaks in the heading
    // ("A scroll kept<br><em>whole.</em>" reads "A scroll kept whole.",
    // where textContent fuses the words). Fall back to textContent
    // wherever innerText is unavailable or empty.
    let name = heading ? (heading.innerText || heading.textContent || "") : "";
    name = (name || "").replace(/\s+/g, " ").trim();
    if (!name) {
      name = (document.title || "").split(/[·|—–-]/)[0].trim();
    }
    return name;
  }

  function initPageOpening() {
    if (reducedMotion) return;

    const overlay = document.createElement("div");
    overlay.className = "lpo-overlay";
    overlay.setAttribute("aria-hidden", "true");

    const emblemWrap = document.createElement("div");
    emblemWrap.className = "lpo-emblem-wrap";
    emblemWrap.innerHTML = LPO_EMBLEM;
    overlay.appendChild(emblemWrap);

    const name = lpoPageName();
    if (name) {
      const nameEl = document.createElement("p");
      nameEl.className = "lpo-name";
      nameEl.textContent = name;
      overlay.appendChild(nameEl);
    }

    const lineEl = document.createElement("p");
    lineEl.className = "lpo-line";
    lineEl.textContent = lpoLivingLine();
    overlay.appendChild(lineEl);

    document.body.appendChild(overlay);
    document.body.classList.add("lpo-opening");

    /* Dismissal is the homepage entry's model: tap or key only.
     * Scroll is deliberately absent — the page is scroll-locked while
     * the opening plays, and pages that scroll themselves on arrival
     * (the 13 Moons page does) must not kill their own opening. */
    const LPO_DISMISS_EVENTS = ["pointerdown", "keydown"];

    let dismissed = false;
    const fadeTimer = window.setTimeout(() => dismiss(false), LPO_FADE_AT_MS);

    function onFirstGesture() {
      dismiss(true);
    }

    function dismiss(instant) {
      if (dismissed) return;
      dismissed = true;
      window.clearTimeout(fadeTimer);
      for (const type of LPO_DISMISS_EVENTS) {
        window.removeEventListener(type, onFirstGesture, { capture: true });
      }
      if (instant) {
        // A visitor's first gesture is never trapped by the soft fade:
        // the opening is gone in the same instant, like the homepage
        // entry — the gesture itself is spent on the dismissal, and
        // nothing beneath the overlay ever receives it.
        overlay.remove();
        document.body.classList.remove("lpo-opening");
        return;
      }
      overlay.classList.add("lpo-leaving");
      window.setTimeout(() => {
        overlay.remove();
        document.body.classList.remove("lpo-opening");
      }, LPO_FADE_MS);
    }

    for (const type of LPO_DISMISS_EVENTS) {
      window.addEventListener(type, onFirstGesture, { capture: true, passive: true });
    }
  }

  initPageOpening();

  /* ---------------------------------------------------------------- */
  /* Staged reveals                                                    */
  /* ---------------------------------------------------------------- */

  if (reducedMotion) return;
  if (!("IntersectionObserver" in window)) return;

  const targets = Array.from(document.querySelectorAll("main > section"));
  if (!targets.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.remove("lui-reveal-pending");
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
    target.classList.add("lui-reveal-pending");
    observer.observe(target);
  });
})();
