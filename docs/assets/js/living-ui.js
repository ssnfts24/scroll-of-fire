/*
 * Living UI — the tiny runtime for the shared living design layer.
 *
 * Its only job: staged reveal-on-enter for top-level sections on pages
 * that carry the layer (body.living-ui). Sections are visible by
 * default; the hidden state (.lui-reveal-pending) is applied here, at
 * runtime, only to sections still below the fold — so no-JS and
 * reduced-motion visitors lose nothing, and nothing is ever hijacked.
 *
 * The homepage opts out: living-entry.js already runs the same reveal
 * discipline there alongside the entry overlay and the path rail.
 */
(() => {
  "use strict";

  if (document.querySelector('script[src*="living-entry"]')) return;
  if (!document.body || !document.body.classList.contains("living-ui")) return;

  const reducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
