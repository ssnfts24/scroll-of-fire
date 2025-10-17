/* === Scroll of Fire — Codex.js (stability + mobile-safe equations) =======
 * - Reveal on scroll (cards/dividers)
 * - External links hardening
 * - Banner failover (Meta webviews, slow decodes)
 * - MathJax gentle re-typeset on activation
 * - Optional subtle tilt on cards (reduced-motion aware)
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
    }, 2200);
    img.addEventListener("load", () => clearTimeout(t), { once: true });
  }

  /** gentle MathJax nudge **/
  function typesetSoon(delay = 100) {
    if (!window.MathJax) return;
    setTimeout(() => {
      try { window.MathJax.typeset && window.MathJax.typeset(); } catch(e){}
    }, delay);
  }

  /** reveal on scroll (cards/dividers) **/
  function initReveal() {
    const targets = $all(".card, .divider");
    if (!targets.length) return;

    const reveal = (el) => el.classList.add("visible");

    if (!prefersNoMotion && "IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => entries.forEach((e) => {
          if (e.isIntersecting) {
            reveal(e.target);
            io.unobserve(e.target);
          }
        }),
        { root: null, rootMargin: "0px 0px -12%" }
      );
      targets.forEach((el) => io.observe(el));
    } else {
      const tick = () => targets.forEach((el) => inViewport(el) && reveal(el));
      let ticking = false;
      const onScroll = () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(() => { tick(); ticking = false; });
        }
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("load", tick);
      tick();
    }
  }

  /** prepare equation scrollers (wrap inner mjx in .eq-scroll if missing) */
  function initEqScrollers() {
    $all(".eq").forEach(eq => {
      // If developer pasted plain $$...$$ inside .eq, MathJax adds <mjx-container>.
      // We ensure those mjx nodes live inside a dedicated horizontally-scrollable div.
      const hasScroll = eq.querySelector(".eq-scroll");
      if (!hasScroll) {
        const scroller = document.createElement("div");
        scroller.className = "eq-scroll";
        while (eq.firstChild) scroller.appendChild(eq.firstChild);
        eq.appendChild(scroller);
      }
    });
    typesetSoon(150);
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
          const rx = (0.5 - y) * 3.5;
          const ry = (x - 0.5) * 5.5;
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
    // year + hardening + banner
    const y = document.getElementById("yr"); if (y) y.textContent = String(new Date().getFullYear());
    hardenExternal();
    bannerFailover();

    // visuals
    initReveal();
    initEqScrollers();
    initTilt();

    // final typeset nudge once everything is visible
    typesetSoon(350);
  });
})();
