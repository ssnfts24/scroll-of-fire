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
