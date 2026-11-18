/*
 * Living Witness — homepage only (docs/index.html).
 *
 * The hero carries a small stack of witness lines: teachings and
 * observations harvested verbatim from the site's own pages (each line
 * names its source in its data-source attribute). This script rotates
 * them with a slow crossfade so the homepage keeps changing, calmly:
 *
 *   - one line every 9 seconds, crossfading over ~1.1s (CSS);
 *   - rotation pauses while the visitor hovers or focuses the block,
 *     and while the tab is hidden;
 *   - under prefers-reduced-motion it never starts — the first line,
 *     which carries .is-active in the markup, simply stands;
 *   - without JS the same first line stands. Nothing is ever hidden
 *     by this script: inactive lines are marked aria-hidden only once
 *     rotation is actually running.
 *
 * The lines are stacked in a single grid cell (see living-entry.css),
 * so the block's height is fixed by the longest line and the rotation
 * causes zero layout shift. The guided path's reveals are untouched:
 * the block lives inside the hero section, above the fold.
 */
(() => {
  "use strict";

  const ROTATE_MS = 9000;

  const root = document.querySelector("[data-living-witness]");
  if (!root) return;

  const lines = Array.from(root.querySelectorAll(".living-witness-line"));
  if (lines.length < 2) return;

  const reducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) return;

  let index = Math.max(0, lines.findIndex((line) => line.classList.contains("is-active")));
  let timer = null;
  let paused = false;

  lines.forEach((line, i) => {
    if (i !== index) line.setAttribute("aria-hidden", "true");
  });

  function show(next) {
    lines[index].classList.remove("is-active");
    lines[index].setAttribute("aria-hidden", "true");
    index = next;
    lines[index].classList.add("is-active");
    lines[index].removeAttribute("aria-hidden");
  }

  function start() {
    if (timer === null && !paused && !document.hidden) {
      timer = window.setInterval(() => show((index + 1) % lines.length), ROTATE_MS);
    }
  }

  function stop() {
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  }

  function pause() {
    paused = true;
    stop();
  }

  function resume() {
    paused = false;
    start();
  }

  root.addEventListener("mouseenter", pause);
  root.addEventListener("mouseleave", resume);
  root.addEventListener("focusin", pause);
  root.addEventListener("focusout", resume);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stop();
    } else {
      start();
    }
  });

  start();
})();
