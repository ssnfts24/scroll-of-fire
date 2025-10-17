/* === Scroll of Fire — Codex.js (Living Tech edition) =======================
 * - Equation activation on scroll (IO + rAF fallback)
 * - Reveal on scroll for cards/dividers
 * - Current year swap
 * - External links hardening
 * - Banner failover (Meta webviews, slow decodes)
 * - MathJax gentle re-typeset on activation / hash nav
 * - Subtle parallax/tilt on cards (reduced-motion aware)
 * - Smooth in-page anchor scroll + equation deep-linking
 */

(function () {
  "use strict";

  /** -------------------- utils -------------------- **/
  const $ = (sel, root = document) => root.querySelector(sel);
  const $all = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const prefersNoMotion = !matchMedia("(prefers-reduced-motion: no-preference)").matches;

  const inViewport = (el, threshold = 0.9) => {
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    return r.top < vh * threshold && r.bottom > 0;
  };

  const raf = window.requestAnimationFrame || ((fn) => setTimeout(fn, 16));

  /** -------------------- year --------------------- **/
  function swapYear() {
    const y = document.getElementById("yr");
    if (y) y.textContent = String(new Date().getFullYear());
  }

  /** --------------- external links ---------------- **/
  function hardenExternal() {
    $all('a[target="_blank"]').forEach((a) => {
      const rel = (a.getAttribute("rel") || "").toLowerCase();
      if (!rel.includes("noopener")) {
        a.setAttribute("rel", (rel ? rel + " " : "") + "noopener");
      }
    });
  }

  /** ---------------- banner failover --------------- **/
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

    const t = setTimeout(() => {
      if (!img.complete || img.naturalWidth === 0) swapToLocal();
    }, 2500);
    img.addEventListener("load", () => clearTimeout(t), { once: true });
  }

  /** --------------- MathJax helper ----------------- **/
  function mathjaxTypesetSoon(delay = 0) {
    if (!window.MathJax) return;
    try {
      setTimeout(() => {
        if (window.MathJax.typeset) window.MathJax.typeset();
      }, delay);
    } catch (e) { /* noop */ }
  }

  /** --------------- reveal on scroll --------------- **/
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
          raf(() => { tick(); ticking = false; });
        }
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("load", tick);
      tick();
    }
  }

  /** ---------------- equations on scroll ----------- **/
  function initEquations() {
    const eqs = $all(".eq");
    if (!eqs.length) return;

    // stagger glow
    eqs.forEach((el, i) => el.style.setProperty("--eq-delay", `${Math.min(i * 0.08, 0.8)}s`));

    const activate = (el) => {
      if (!el.classList.contains("eq-on")) {
        el.classList.add("eq-on");
        mathjaxTypesetSoon(80);
      }
    };

    if (!prefersNoMotion && "IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => entries.forEach((e) => {
          if (e.isIntersecting) {
            activate(e.target);
            io.unobserve(e.target);
          }
        }),
        { root: null, rootMargin: "0px 0px -10%" }
      );
      eqs.forEach((el) => io.observe(el));
    } else {
      const tick = () => eqs.forEach((el) => inViewport(el, 0.94) && activate(el));
      let ticking = false;
      const onScroll = () => {
        if (!ticking) {
          ticking = true;
          raf(() => { tick(); ticking = false; });
        }
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("load", tick);
      tick();
    }
  }

  /** ----------------- living tilt ------------------- **/
  function initTilt() {
    if (prefersNoMotion) return;
    const cards = $all(".card");
    if (!cards.length) return;

    cards.forEach((card) => {
      let req = 0;
      const onMove = (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        cancelAnimationFrame(req);
        req = raf(() => {
          const rx = (0.5 - y) * 4;
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

  /** --------- smooth hash anchor scrolling ---------- **/
  function initSmoothAnchors() {
    const samePage = (a) => a.origin === location.origin && a.pathname === location.pathname;
    document.addEventListener("click", (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || href === "#") return;
      const id = href.slice(1);
      const target = document.getElementById(id);
      if (!target) return;

      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - 10;
      if (prefersNoMotion) window.scrollTo(0, top);
      else window.scrollTo({ top, behavior: "smooth" });

      history.replaceState(null, "", `#${id}`);
      // Let MathJax settle if target contains equations
      if (target.querySelector(".eq")) mathjaxTypesetSoon(150);
    });

    // If arriving with a hash, scroll after layout/MathJax
    if (location.hash) {
      const id = location.hash.slice(1);
      const target = document.getElementById(id);
      if (target) {
        setTimeout(() => {
          const top = target.getBoundingClientRect().top + window.scrollY - 10;
          window.scrollTo(0, top);
          if (target.querySelector(".eq")) mathjaxTypesetSoon(150);
        }, 350);
      }
    }
  }

  /** ------- add deep links to equation headings ------ **/
  function initEqDeepLinks() {
    const heads = $all('h3[id^="eq-"], h2[id^="equations"]');
    heads.forEach((h) => {
      if (h.querySelector(".deeplink")) return;
      const a = document.createElement("a");
      a.className = "deeplink";
      a.href = `#${h.id}`;
      a.setAttribute("aria-label", "Link to this section");
      a.textContent = "§";
      a.style.marginLeft = "8px";
      a.style.opacity = ".6";
      a.style.textDecoration = "none";
      a.addEventListener("mouseenter", () => (a.style.opacity = "1"));
      a.addEventListener("mouseleave", () => (a.style.opacity = ".6"));
      h.appendChild(a);
    });
  }

  /** --------------------- init ---------------------- **/
  document.addEventListener("DOMContentLoaded", () => {
    swapYear();
    hardenExternal();
    bannerFailover();
    initReveal();
    initEquations();
    initTilt();
    initSmoothAnchors();
    initEqDeepLinks();
    // final nudge once everything settles
    mathjaxTypesetSoon(250);
  });
})();
