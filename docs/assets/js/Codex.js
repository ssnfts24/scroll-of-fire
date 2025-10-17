/* === Scroll of Fire — Codex.js (Living Tech edition) =======================
 * - Equation activation on scroll (IO + rAF fallback)
 * - Reveal on scroll for cards/dividers
 * - Current year swap
 * - External links hardening
 * - Banner failover (Meta webviews, slow decodes)
 * - MathJax gentle re-typeset on activation
 * - Subtle parallax/tilt on cards (reduced-motion aware)
 */

(function () {
  "use strict";

  /** utils **/
  const $ = (sel, root = document) => root.querySelector(sel);
  const $all = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const prefersNoMotion = !matchMedia("(prefers-reduced-motion: no-preference)").matches;

  const inViewport = (el, threshold = 0.9) => {
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    return r.top < vh * threshold && r.bottom > 0;
  };

  /** year **/
  function swapYear() {
    const y = document.getElementById("yr");
    if (y) y.textContent = String(new Date().getFullYear());
  }

  /** external links hardening **/
  function hardenExternal() {
    $all('a[target="_blank"]').forEach((a) => {
      const rel = (a.getAttribute("rel") || "").toLowerCase();
      if (!rel.includes("noopener")) a.setAttribute("rel", (rel ? rel + " " : "") + "noopener");
    });
  }

  /** banner failover **/
  function bannerFailover() {
    const img = $("#heroBanner");
    if (!img) return;

    const local = img.getAttribute("data-src-local");
    const primary = img.getAttribute("data-src-raw") || img.src;
    const fallbackNoQuery = primary.split("?")[0];

    const ua = navigator.userAgent || "";
    const isMetaWebView = /FBAN|FBAV|Facebook|Instagram|FB_IAB|FBAN\/Messenger/i.test(ua);

    function swapToLocal() {
      if (img && local && img.src.indexOf(local) === -1) img.src = local;
    }

    if (isMetaWebView) swapToLocal();

    img.addEventListener(
      "error",
      () => {
        if (img.src === primary) img.src = fallbackNoQuery;
        else swapToLocal();
      },
      { once: true }
    );

    // timeout fallback (slow decode / blocked)
    const t = setTimeout(() => {
      if (!img.complete || img.naturalWidth === 0) swapToLocal();
    }, 2500);
    img.addEventListener("load", () => clearTimeout(t), { once: true });
  }

  /** gentle MathJax nudge **/
  function mathjaxTypesetSoon() {
    if (!window.MathJax) return;
    try {
      if (window.MathJax.typeset) window.MathJax.typeset();
    } catch (e) { /* ignore */ }
  }

  /** reveal on scroll (cards/dividers) **/
  function initReveal() {
    const targets = $all(".card, .divider");
    if (!targets.length) return;

    if (!prefersNoMotion && "IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              e.target.classList.add("visible");
              io.unobserve(e.target);
            }
          }
        },
        { root: null, rootMargin: "0px 0px -12%" }
      );
      targets.forEach((el) => io.observe(el));
    } else {
      const tick = () => targets.forEach((el) => inViewport(el) && el.classList.add("visible"));
      let ticking = false;
      const onScroll = () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(() => {
            tick();
            ticking = false;
          });
        }
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("load", tick);
      tick();
    }
  }

  /** equation activation (no HTML changes) **/
  function initEquations() {
    const eqs = $all(".eq"); // uses existing .eq wrappers
    if (!eqs.length) return;

    // stagger delays by DOM order (small ramp)
    eqs.forEach((el, i) => el.style.setProperty("--eq-delay", `${Math.min(i * 0.08, 0.8)}s`));

    const activate = (el) => {
      if (!el.classList.contains("eq-on")) {
        el.classList.add("eq-on");
        // re-typeset once the class is applied so MathJax positions nicely
        setTimeout(mathjaxTypesetSoon, 80);
      }
    };

    if (!prefersNoMotion && "IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              activate(e.target);
              io.unobserve(e.target);
            }
          }
        },
        { root: null, rootMargin: "0px 0px -10%" }
      );
      eqs.forEach((el) => io.observe(el));
    } else {
      const tick = () => eqs.forEach((el) => inViewport(el, 0.94) && activate(el));
      let ticking = false;
      const onScroll = () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(() => {
            tick();
            ticking = false;
          });
        }
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("load", tick);
      tick();
    }
  }

  /** subtle “living” tilt for cards **/
  function initTilt() {
    if (prefersNoMotion) return;
    const cards = $all(".card");
    if (!cards.length) return;

    cards.forEach((card) => {
      let raf = 0;
      const onMove = (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          const rx = (0.5 - y) * 4; // tilt strength
          const ry = (x - 0.5) * 6;
          card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
        });
      };
      const reset = () => (card.style.transform = "");

      card.addEventListener("mousemove", onMove);
      card.addEventListener("mouseleave", reset);
      card.addEventListener("blur", reset, true);
    });
  }

  /** init **/
  document.addEventListener("DOMContentLoaded", () => {
    swapYear();
    hardenExternal();
    bannerFailover();
    initReveal();
    initEquations();
    initTilt();
    // final nudge once everything settled
    setTimeout(mathjaxTypesetSoon, 250);
  });
})();
