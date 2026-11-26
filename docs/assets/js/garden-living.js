/*
 * The Pattern Garden — the Living Look layer (garden.html).
 *
 * Presentation only. The garden's record, beds, and rules all live in
 * pattern-garden.js and the Life Atlas; this layer never writes a
 * record, never computes a date of its own, and rebuilds nothing.
 * It adds the Living Look's four tests to the room:
 *
 *  1. Responds — the one tending action stands first in the stage and
 *     takes the keeper straight to today's open bed.
 *  2. Remembers — a returning keeper is welcomed with "I kept your
 *     place" (a device-local note that a visit happened; the garden
 *     record itself is the Atlas's, untouched by this layer).
 *  3. One clear action — the Spark's station points at that action.
 *  4. The real day — the breathing intro and the stage carry today's
 *     coordinate from the canonical PatternCalendar, and today's bed
 *     is marked in gold with the Spark standing in it.
 *
 * A bed with nothing in it says so plainly and waits. No absence is
 * framed as a failure. Motion only answers; under
 * prefers-reduced-motion the intro is never injected and every
 * decoration stands still.
 */
(() => {
  "use strict";

  const reducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const VISITED_KEY = "sof.pattern-garden.visited.v1";
  const INTRO_KEY = "sof.pattern-garden.intro.v1";

  /* ---------------- today's line, from the canonical calendar -------- */

  function todayLine() {
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
      const mapped = calendar.fromCivilDate({ date: iso, timeZone, boundaryMode: "midnight" });
      if (!mapped) return null;
      if (mapped.insideCountedYear) {
        return `Moon ${mapped.moon} · Day ${mapped.day} · Pattern Day ${mapped.dayOfPatternYear}`;
      }
      return mapped.isDeepTimeDay ? "Deep Time Day" : "Day Out of Time";
    } catch { return null; }
  }

  /* ---------------- the breathing intro ------------------------------ */
  /* Solid ground of its own, slowed to breathe, one tap dismisses it.
   * Injected from here, never hard-coded: no JS or reduced motion
   * means the garden simply stands open. Once per session. */

  function showIntro() {
    if (reducedMotion) return;
    try { if (sessionStorage.getItem(INTRO_KEY)) return; } catch { /* show it */ }
    const overlay = document.createElement("div");
    overlay.className = "gl-intro";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "The Pattern Garden — entry");
    const inner = document.createElement("div");
    inner.className = "gl-intro-inner";
    const mark = document.createElement("span");
    mark.className = "gl-intro-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = "☲";
    const name = document.createElement("p");
    name.className = "gl-intro-name";
    name.textContent = "The Pattern Garden";
    const line = document.createElement("p");
    line.className = "gl-intro-line";
    line.textContent = todayLine() || "Thirteen beds, one for each Moon.";
    const hint = document.createElement("p");
    hint.className = "gl-intro-hint";
    hint.textContent = "Tap anywhere to step in";
    inner.append(mark, name, line, hint);
    overlay.appendChild(inner);
    document.body.appendChild(overlay);
    document.body.classList.add("gl-intro-lock");

    let gone = false;
    const dismiss = () => {
      if (gone) return;
      gone = true;
      try { sessionStorage.setItem(INTRO_KEY, "1"); } catch { /* the tap still counts */ }
      overlay.classList.add("gl-intro-leaving");
      document.body.classList.remove("gl-intro-lock");
      window.setTimeout(() => overlay.remove(), 700);
    };
    overlay.addEventListener("pointerdown", dismiss);
    window.addEventListener("keydown", dismiss, { once: true });
    window.setTimeout(dismiss, 4600);
  }

  /* ---------------- the kept place ----------------------------------- */

  function welcome() {
    const host = document.getElementById("garden-welcome");
    if (!host) return;
    let returning = false;
    try {
      returning = Boolean(localStorage.getItem(VISITED_KEY));
      localStorage.setItem(VISITED_KEY, new Date().toISOString());
    } catch { /* the welcome still stands for this visit */ }
    host.textContent = returning
      ? "I kept your place — welcome back. Your beds stand as your record holds them."
      : "Welcome to the garden. Thirteen beds stand ready, one for each Moon — today's is lit in gold.";
  }

  /* ---------------- the beds: today's face, plainly resting beds ----- */

  function decorateBeds() {
    const host = document.getElementById("garden-beds");
    if (!host) return;
    for (const card of host.querySelectorAll(".garden-bed")) {
      if (card.dataset.glDecorated) continue;
      card.dataset.glDecorated = "1";
      if (card.classList.contains("garden-bed-open")) {
        const badge = document.createElement("p");
        badge.className = "gl-bed-badge";
        const spark = document.createElement("span");
        spark.className = "gl-spark-dot";
        spark.setAttribute("aria-hidden", "true");
        badge.append(spark, document.createTextNode("Today's bed — your Spark is here"));
        card.prepend(badge);
      }
      const hasPlanting = card.querySelector(".garden-bed-growth");
      const hasChoices = card.querySelector(".garden-plant-choices");
      const hasNote = card.querySelector(".garden-bed-note");
      if (!hasPlanting && !hasChoices && !hasNote) {
        const empty = document.createElement("p");
        empty.className = "gl-bed-empty";
        empty.textContent = card.classList.contains("garden-bed-open")
          ? "This bed stands open and empty today. What the farm record offers for it stands below — plant when you are ready."
          : "Nothing is planted in this bed. It rests, and waits for its Moon.";
        card.appendChild(empty);
      }
    }
    /* The tending action learns today's bed's name once it stands. */
    const tend = document.getElementById("garden-tend-btn");
    const open = host.querySelector(".garden-bed-open h3");
    if (tend && open) {
      tend.textContent = `Tend today's bed — ${open.textContent}`;
    }
  }

  function watchBeds() {
    const host = document.getElementById("garden-beds");
    if (!host) return;
    decorateBeds();
    const observer = new MutationObserver(() => {
      observer.disconnect();
      decorateBeds();
      observer.observe(host, { childList: true, subtree: true });
    });
    observer.observe(host, { childList: true, subtree: true });
  }

  /* ---------------- the one tending action --------------------------- */

  function wireTend() {
    const btn = document.getElementById("garden-tend-btn");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const open = document.querySelector(".garden-bed-open");
      const target = open || document.getElementById("garden-beds");
      if (!target) return;
      target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
      const witness = open
        ? [...open.querySelectorAll("button")].find(b => /witness/i.test(b.textContent) && !b.disabled)
        : null;
      window.setTimeout(() => { if (witness) witness.focus({ preventScroll: true }); }, reducedMotion ? 0 : 450);
    });
  }

  function init() {
    showIntro();
    welcome();
    watchBeds();
    wireTend();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
