/* === Scroll of Fire — Codex.js ===
 * - Reveal on scroll (rAF + IO fallback)
 * - Current year swap
 * - External links hardening
 * - Banner failover
 * - MathJax gentle re-typeset
 */

(function () {
  "use strict";

  /** utils **/
  const $all = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const inViewport = (el, threshold = 0.88) => {
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    return r.top < vh * threshold;
  };

  /** reveal on scroll **/
  const revealTargets = () => $all(".card, .divider");

  const addVisible = (el) => el.classList.add("visible");

  const useIO = "IntersectionObserver" in window && matchMedia("(prefers-reduced-motion: no-preference)").matches;

  function initReveal() {
    const targets = revealTargets();
    if (useIO) {
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) if (e.isIntersecting) { addVisible(e.target); io.unobserve(e.target); }
        },
        { root: null, rootMargin: "0px 0px -12%" }
      );
      targets.forEach((el) => io.observe(el));
    } else {
      // rAF-throttled scroll for older browsers or reduced motion
      const tick = () => targets.forEach((el) => inViewport(el) && addVisible(el));
      let ticking = false;
      const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { tick(); ticking = false; }); } };
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("load", tick);
      tick();
    }
  }

  /** current year **/
  function swapYear() {
    const y = document.getElementById("yr");
    if (y) y.textContent = String(new Date().getFullYear());
  }

  /** external links: target + rel **/
  function hardenExternal() {
    $all('a[target="_blank"]').forEach((a) => {
      const rel = (a.getAttribute("rel") || "").toLowerCase();
      if (!rel.includes("noopener")) a.setAttribute("rel", (rel ? rel + " " : "") + "noopener");
    });
  }

  /** banner failover (in case Messenger/webview blocks query params or image fails) **/
  function bannerFailover() {
    const heroImg = document.querySelector(".hero img");
    if (!heroImg) return;

    const primary = "https://raw.githubusercontent.com/ssnfts24/scroll-of-fire/main/6_Images_and_Symbols/file_0000000052e861f98b087ad0b80cbefc.png?v=2025-10-16";
    const fallbackNoQuery = "https://raw.githubusercontent.com/ssnfts24/scroll-of-fire/main/6_Images_and_Symbols/file_0000000052e861f98b087ad0b80cbefc.png";
    const localFallback = "assets/img/banner.png"; // add a local copy if you like

    const tryFallback = (nextSrc) => {
      if (heroImg.dataset.tried === nextSrc) return; // avoid loops
      heroImg.dataset.tried = nextSrc;
      heroImg.src = nextSrc;
    };

    heroImg.addEventListener("error", function onErr() {
      // strip query param first (some in-app browsers break on ?v=)
      if (heroImg.src === primary) { tryFallback(fallbackNoQuery); return; }
      // then try local asset if present
      if (!heroImg.src.includes(localFallback)) { tryFallback(localFallback); return; }
      // give up: remove listener
      heroImg.removeEventListener("error", onErr);
    }, { once:false });
  }

  /** MathJax: gentle re-typeset after load/late images **/
  function mathjaxNudge() {
    if (!window.MathJax) return;
    const run = () => {
      try {
        if (window.MathJax.typeset) window.MathJax.typeset();
      } catch (e) { /* ignore */ }
    };
    window.addEventListener("load", () => setTimeout(run, 200));
  }

  /** init **/
  document.addEventListener("DOMContentLoaded", () => {
    initReveal();
    swapYear();
    hardenExternal();
    bannerFailover();
    mathjaxNudge();
  });

})();
