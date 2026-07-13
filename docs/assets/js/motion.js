/* =======================================================================
   Scroll of Fire — Shared Motion System
   File: assets/js/motion.js
   Purpose:
     • Section reveal via IntersectionObserver
     • Canvas breath animation for the homepage 60-Second Codex Entry
     • Page Visibility API: pause canvas when tab is hidden
     • View Transitions API progressive enhancement for internal links
   Reduced-motion: all motion is suppressed when prefers-reduced-motion
   is active. Content remains fully readable without this script.
   ======================================================================= */

(function () {
  "use strict";

  const prefersReduced =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* -----------------------------------------------------------------
     1. SECTION REVEAL
     Adds .reveal to major section containers, then uses
     IntersectionObserver to add .in when they enter the viewport.
     Content is visible by default; JS adds opacity:0 only after
     initialization, so no flash of invisible content on slow JS.
  ----------------------------------------------------------------- */

  function initReveal() {
    if (prefersReduced) return;
    if (!("IntersectionObserver" in window)) return;

    /* Select major structural sections, panels, and card groups.
       Do not select every paragraph. */
    const SELECTORS = [
      ".section-shell",
      ".hub-grid",
      ".hub-notice",
      ".what-grid",
      ".feature-grid",
      ".codex-live-grid",
      ".exercise-grid",
      ".caravan-grid",
      ".spotlight-grid",
      ".signal-strip",
      ".witness-strip",
      ".codex-seal",
    ].join(", ");

    const targets = Array.from(document.querySelectorAll(SELECTORS));

    if (!targets.length) return;

    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -60px 0px", threshold: 0.07 }
    );

    targets.forEach(function (el) {
      /* Add .reveal class after a microtask so the element is
         initially visible; the animation adds opacity:0 a frame later */
      if (el.classList.contains("in")) return;
      el.classList.add("reveal");
      observer.observe(el);
    });
  }

  /* -----------------------------------------------------------------
     2. CANVAS BREATH ANIMATION
     Draws an expanding/contracting ring on #codexExerciseCanvas
     synchronized with the Inhale 4 / Hold 2 / Exhale 6 breath cycle.
     Uses requestAnimationFrame and pauses when the tab is hidden.
  ----------------------------------------------------------------- */

  var breathRaf = null;
  var breathPaused = false;
  var breathLoopFn = null;

  function initBreathCanvas() {
    var canvas = document.getElementById("codexExerciseCanvas");
    if (!canvas) return;

    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    /* Breath cycle timings (seconds) */
    var cycle = [
      { label: "Inhale", dur: 4 },
      { label: "Hold",   dur: 2 },
      { label: "Exhale", dur: 6 },
      { label: "Return", dur: 1 },
    ];

    var totalDur = cycle.reduce(function (s, p) { return s + p.dur; }, 0);

    /* Resize canvas to its CSS display size (devicePixelRatio aware) */
    function sizeCanvas() {
      var dpr = window.devicePixelRatio || 1;
      var rect = canvas.getBoundingClientRect();
      var w = Math.max(320, Math.round(rect.width  * dpr));
      var h = Math.max(260, Math.round(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width  = w;
        canvas.height = h;
        ctx.scale(dpr, dpr);
      }
    }

    /* Determine the current phase and progress [0,1] within it */
    function getPhase(tSec) {
      var t = ((tSec % totalDur) + totalDur) % totalDur;
      var elapsed = 0;
      for (var i = 0; i < cycle.length; i++) {
        var d = cycle[i].dur;
        if (t < elapsed + d) {
          return { index: i, progress: (t - elapsed) / d };
        }
        elapsed += d;
      }
      return { index: 0, progress: 0 };
    }

    /* Ease in-out for smooth expand / contract */
    function easeInOut(t) {
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    /* Map phase to visual ring radius (fraction of available space) */
    function phaseToRadius(phase) {
      var p = easeInOut(phase.progress);
      switch (phase.index) {
        case 0: return 0.30 + p * 0.28;           /* Inhale: 0.30 → 0.58 */
        case 1: return 0.58;                        /* Hold:   steady     */
        case 2: return 0.58 - p * 0.28;           /* Exhale: 0.58 → 0.30 */
        case 3: return 0.30;                        /* Return: steady     */
        default: return 0.42;
      }
    }

    /* Accent colours matching Codex palette */
    var ACCENT_CYAN = "rgba(122,243,255,";
    var ACCENT_GOLD = "rgba(243,201,122,";

    function draw(tSec) {
      sizeCanvas();

      var dpr  = window.devicePixelRatio || 1;
      var cw   = canvas.width  / dpr;
      var ch   = canvas.height / dpr;
      var cx   = cw / 2;
      var cy   = ch / 2;
      var maxR = Math.min(cx, cy) * 0.9;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      var phase = getPhase(tSec);
      var r = phaseToRadius(phase) * maxR;
      var progress = easeInOut(phase.progress);

      /* Outer glow ring */
      var grad = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 1.2);
      grad.addColorStop(0, ACCENT_CYAN + "0.12)");
      grad.addColorStop(1, ACCENT_CYAN + "0)");
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.2, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      /* Main ring */
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = ACCENT_CYAN + "0.55)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      /* Inner gold ring — counter-movement */
      var innerR = r * 0.55;
      ctx.beginPath();
      ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
      ctx.strokeStyle = ACCENT_GOLD + "0.35)";
      ctx.lineWidth = 1;
      ctx.stroke();

      /* Central dot */
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = phase.index <= 1
        ? ACCENT_CYAN + (0.6 + progress * 0.3) + ")"
        : ACCENT_GOLD + (0.5 + (1 - progress) * 0.3) + ")";
      ctx.fill();

      /* Phase label */
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = "rgba(184,179,166,0.55)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(cycle[phase.index].label, cx, cy + r + 22);
    }

    if (prefersReduced) {
      /* Static render only — show the ring at rest position */
      sizeCanvas();
      draw(0);
      return;
    }

    var startTime = null;

    function loop(ts) {
      if (breathPaused) return;
      if (startTime === null) startTime = ts;
      var elapsedSec = (ts - startTime) / 1000;
      draw(elapsedSec);
      breathRaf = requestAnimationFrame(loop);
    }

    breathLoopFn = loop;
    breathRaf = requestAnimationFrame(loop);
  }

  /* -----------------------------------------------------------------
     3. PAGE VISIBILITY — pause canvas loop when tab is hidden
  ----------------------------------------------------------------- */

  function initVisibilityControl() {
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        breathPaused = true;
        if (breathRaf) {
          cancelAnimationFrame(breathRaf);
          breathRaf = null;
        }
      } else if (breathPaused) {
        breathPaused = false;
        /* Re-launch the loop from the point the page was hidden.
           The loop function is captured in breathLoopFn if canvas exists. */
        if (typeof breathLoopFn === "function") {
          breathRaf = requestAnimationFrame(breathLoopFn);
        }
      }
    });
  }

  /* -----------------------------------------------------------------
     4. VIEW TRANSITIONS (progressive enhancement)
     Only applies to same-origin internal page navigations.
     Normal navigation is unaffected in unsupported browsers.
  ----------------------------------------------------------------- */

  function initViewTransitions() {
    if (prefersReduced) return;
    if (!document.startViewTransition) return;

    document.addEventListener("click", function (event) {
      var anchor = event.target.closest("a[href]");
      if (!anchor) return;

      /* Only same-origin, non-hash, non-external links */
      var href = anchor.getAttribute("href");
      if (!href) return;
      if (href.startsWith("#")) return;
      if (href.startsWith("mailto:")) return;
      if (href.startsWith("tel:")) return;
      if (anchor.target && anchor.target !== "_self") return;

      try {
        var dest = new URL(href, window.location.href);
        if (dest.origin !== window.location.origin) return;
        /* Skip if the destination is just a hash change */
        if (dest.pathname === window.location.pathname && dest.hash) return;
      } catch (_) {
        return;
      }

      event.preventDefault();
      document.startViewTransition(function () {
        window.location.href = href;
      });
    });
  }

  /* -----------------------------------------------------------------
     5. INITIALISE
  ----------------------------------------------------------------- */

  function init() {
    initReveal();
    initBreathCanvas();
    initVisibilityControl();
    initViewTransitions();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
