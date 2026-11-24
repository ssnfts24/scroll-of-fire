/*
 * Sphere app mode — Gate D of the Spark. Living Day app rework
 * (design v3 §3.2, §14 call 4), prepared Nov 23, 2026.
 *
 * This module is the SIGNATURE FILE for the one named
 * protected-set change of Gate D: the Sphere page
 * (docs/living-time-sphere.html) learning to render its own
 * true app mode, so the app no longer has to inject a framing
 * stylesheet into it. The change is carried on a branch for
 * Aaron's word; the protection test's declaration names exactly
 * that one protected path.
 *
 * The module is INERT unless the page's own boot script has
 * marked the document with the `sof-app-mode` class (set before
 * first paint when the page is opened with ?sofapp=1, or when
 * the app shell's context latch is present). On the open web —
 * no flag, no class — this file defines its marker and does
 * nothing else: no DOM writes, no listeners, no behaviour.
 *
 * One second door, added Nov 24, 2026 (mobile + manifest
 * workstream, Aaron's word: "The sphere is not showing properly
 * on mobile like how the app was"): on a small screen — a phone
 * browser, max-width 700px, the same line the site-wide mobile
 * floor uses — the module acquires the app-mode class itself,
 * adding a `sof-mobile-mode` class that records how the mode
 * was acquired. A phone browser therefore gets the app mode's
 * chrome budget — the state strip, the environment bridge,
 * and the interact bar step aside — instead of the desktop
 * framing it cannot use. The stage's size and the guide's
 * sheet belong to the page's own shell system and are not
 * this module's to move (see the note in the stylesheet);
 * in mobile-acquired mode the module likewise does not plant
 * its pull-up handle, whose sheet is the app shell's context,
 * not the web page's. If the viewport grows past the line
 * again (rotation, a desktop window), a mode the module
 * acquired this way is released; a mode the app context set
 * is never the module's to remove.
 *
 * What it does in app mode:
 *   - announces itself on window.SOFAppMode and dispatches
 *     `sof:app-mode-ready` once the guide bar exists;
 *   - gives the guide bar its pull-up sheet behaviour natively
 *     (the same behaviour the app's injection frame carries
 *     until this lands and the bundle re-syncs): the bar rests
 *     collapsed to its handle and readout, and a tap on either
 *     raises it over the stage's lower third.
 *   - at phone width (the same max-width 700px line), it moves
 *     the caption deck's two standing panels — the sky dome and
 *     the test layers — out of the caption and into the guide
 *     sheet as rooms. The caption's frame slot is flex 0 0 auto
 *     in a fixed-height frame, so everything seated in it
 *     stands over the stage on arrival: measured Nov 24, 2026,
 *     the two panels had grown the caption to ~670px of a
 *     844px phone screen and the Sphere stood below the fold
 *     on Aaron's A16, in the app and the browser alike. In the
 *     sheet the panels ride lowered like every other room,
 *     one tap away (More, the dock doors), and the stage
 *     stands first. When the viewport grows past the line —
 *     or the mode itself is released — the panels go back to
 *     the caption, in their order. Desktop never moves them.
 *
 * What it never does: touch the renderer, the calendar, the
 * temporal cursor, selection, labels, or any protected module.
 * Presentation and one sheet toggle only.
 */
(function () {
  "use strict";

  var root = document.documentElement;
  if (!root) {
    return;
  }

  var SMALL_SCREEN = "(max-width: 700px)";
  var mobileAcquired = false;

  function acquireMobileMode() {
    if (root.classList.contains("sof-app-mode")) return;
    root.classList.add("sof-app-mode");
    root.classList.add("sof-mobile-mode");
    mobileAcquired = true;
  }

  function releaseMobileMode() {
    if (!mobileAcquired) return;
    root.classList.remove("sof-app-mode");
    root.classList.remove("sof-mobile-mode");
    mobileAcquired = false;
    if (document.body) document.body.classList.remove("lp-guide-open");
  }

  if (!root.classList.contains("sof-app-mode")) {
    var mq = window.matchMedia ? window.matchMedia(SMALL_SCREEN) : null;
    if (!mq || !mq.matches) {
      return;
    }
    acquireMobileMode();
    if (mq.addEventListener) {
      mq.addEventListener("change", function (event) {
        if (event.matches) {
          acquireMobileMode();
          ready();
        } else {
          releaseMobileMode();
        }
      });
    }
  }

  window.SOFAppMode = { name: "living-day", version: "1" };

  /* ── The standing panels ride in the sheet at phone width ──
   * See the header: the sky dome and the test layers are the
   * caption's two standing panels, and the caption's slot in
   * the frame takes whatever height they give it. A third
   * panel, the story doors, seats itself in the stage column
   * in the flow below the canvas — inside the fixed frame
   * that flow is the stage's own room, and the doors filled
   * it, so the Sphere still did not stand on arrival. While
   * the app mode stands at phone width all three belong in
   * the guide sheet with the other rooms — lowered on
   * arrival, raised only by the keeper's tap. The panels' own
   * modules keep their references across the move; nothing
   * about their insides changes, only where the section
   * stands, and each goes home to its own seat. */
  var PANEL_SELECTORS = ["[data-sphere-sky-dome]", "[data-sphere-test-layers]", ".sphere-story-doors"];
  var panelMq = window.matchMedia ? window.matchMedia(SMALL_SCREEN) : null;
  var movedPanels = [];

  function panelsShouldRide() {
    return root.classList.contains("sof-app-mode") && !!panelMq && panelMq.matches;
  }

  function movePanels() {
    var caption = document.querySelector(".sphere-rebuild-caption");
    var wrapper = document.querySelector(".sphere-wrapper");
    var sidebar = document.querySelector(".sphere-sidebar");
    if (!sidebar || (!caption && !wrapper)) return;
    PANEL_SELECTORS.forEach(function (sel) {
      var el = document.querySelector(sel);
      if (el && (el.parentElement === caption || el.parentElement === wrapper)) {
        movedPanels.push({ el: el, home: el.parentElement, next: el.nextSibling });
        el.classList.add("sphere-sheet-room");
        sidebar.appendChild(el);
      }
    });
  }

  function restorePanels() {
    var caption = document.querySelector(".sphere-rebuild-caption");
    if (!caption) return;
    movedPanels.forEach(function (rec) {
      rec.el.classList.remove("sphere-sheet-room");
      var home = rec.home && rec.home.isConnected ? rec.home : caption;
      if (rec.next && rec.next.parentElement === home) {
        home.insertBefore(rec.el, rec.next);
      } else {
        home.appendChild(rec.el);
      }
    });
    movedPanels = [];
    // A panel can also have arrived in the sheet without
    // passing through its seat (the test layers seat
    // themselves after the dome, wherever the dome stands).
    // Bring any straggler home too, in panel order — the
    // story doors to their seat below the canvas, the
    // caption's panels to the caption.
    PANEL_SELECTORS.forEach(function (sel) {
      var el = document.querySelector(sel);
      if (!el || el.parentElement === caption) return;
      if (el.classList.contains("sphere-story-doors")) {
        var wrap = document.querySelector(".sphere-canvas-wrap");
        if (wrap && wrap.parentElement) {
          el.classList.remove("sphere-sheet-room");
          wrap.after(el);
        }
        return;
      }
      if (el.closest(".sphere-sidebar")) {
        el.classList.remove("sphere-sheet-room");
        caption.appendChild(el);
      }
    });
  }

  function syncPanels() {
    if (panelsShouldRide()) movePanels();
    else restorePanels();
  }

  if (panelMq && panelMq.addEventListener) {
    panelMq.addEventListener("change", syncPanels);
  }

  // The panels are loaded late, by the companion layer, into a
  // caption the rebuild itself creates later still. Watch for
  // the caption, then watch the caption's children, and move
  // whatever lands while the panels should ride.
  function watchCaption() {
    var caption = document.querySelector(".sphere-rebuild-caption");
    if (!caption) return false;
    var observer = new MutationObserver(syncPanels);
    observer.observe(caption, { childList: true });
    // The story doors land in the stage column, not the
    // caption — watch their seat too.
    var wrapper = document.querySelector(".sphere-wrapper");
    if (wrapper) observer.observe(wrapper, { childList: true });
    syncPanels();
    return true;
  }
  if (!watchCaption()) {
    var captionWaiter = new MutationObserver(function () {
      if (watchCaption()) captionWaiter.disconnect();
    });
    if (document.body) {
      captionWaiter.observe(document.body, { childList: true, subtree: true });
    }
    document.addEventListener("DOMContentLoaded", function () {
      if (watchCaption()) captionWaiter.disconnect();
    });
  }

  function ready() {
    var bar = document.querySelector(".sphere-guide-bar");
    if (!bar) return false;

    if (!mobileAcquired && !bar.querySelector(".lp-guide-handle")) {
      var handle = document.createElement("button");
      handle.type = "button";
      handle.className = "lp-guide-handle";
      handle.setAttribute("aria-expanded", "false");
      handle.setAttribute("aria-label", "Raise or lower the guide");
      handle.textContent = "Guide — pull up";
      bar.insertBefore(handle, bar.firstChild);
      handle.addEventListener("click", function () {
        toggle();
      });
      var readout = bar.querySelector(".sgb-readout");
      if (readout) {
        readout.addEventListener("click", function () {
          toggle();
        });
      }
    }

    function toggle() {
      var open = document.body.classList.toggle("lp-guide-open");
      var h = bar.querySelector(".lp-guide-handle");
      if (h) {
        h.setAttribute("aria-expanded", open ? "true" : "false");
        h.textContent = open ? "Guide — lower" : "Guide — pull up";
      }
    }

    syncPanels();
    document.dispatchEvent(new CustomEvent("sof:app-mode-ready"));
    return true;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      if (!ready()) {
        var observer = new MutationObserver(function () {
          if (ready()) observer.disconnect();
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }
    });
  } else if (!ready()) {
    var observer = new MutationObserver(function () {
      if (ready()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
