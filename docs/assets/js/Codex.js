/* ===========================================================
   Scroll of Fire — Codex.js (Resonant, overflow-safe)
   - Equation activation on scroll (IO + rAF fallback)
   - Dedicated inner scroller for .eq (auto-wrap if missing)
   - Current year swap
   - External links hardening
   - Banner failover (Meta/Instagram webviews, slow decode)
   - MathJax gentle re-typeset on activation
   - Subtle parallax/tilt on cards (reduced-motion aware)
   - UA-aware hero focus nudge (object-position)
   =========================================================== */
(function () {
  "use strict";

  /** ---------- utils ---------- **/
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const prefersReduced =
    !("matchMedia" in window) ||
    !window.matchMedia("(prefers-reduced-motion: no-preference)").matches;

  const raf = (cb) => (window.requestAnimationFrame || setTimeout)(cb, 16);

  function inViewport(el, threshold = 0.9) {
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    return r.top < vh * threshold && r.bottom > 0;
  }

  /** ---------- year ---------- **/
  function swapYear() {
    const y = $("#yr");
    if (y) y.textContent = String(new Date().getFullYear());
  }

  /** ---------- external links hardening ---------- **/
  function hardenExternal() {
    $$('a[target="_blank"]').forEach((a) => {
      const rel = (a.getAttribute("rel") || "").toLowerCase();
      // keep noopener and noreferrer for safety
      const needed = ["noopener", "noreferrer"];
      const tokens = new Set(rel.split(/\s+/).filter(Boolean));
      needed.forEach((t) => tokens.add(t));
      a.setAttribute("rel", Array.from(tokens).join(" "));
    });
  }

  /** ---------- hero banner failover & framing ---------- **/
  function bannerFailover() {
    const img = $("#heroBanner");
    if (!img) return;

    // UA sniff (only for layout nudge or webview fallback)
    const ua = navigator.userAgent || "";
    const isMeta =
      /FBAN|FBAV|Facebook|Instagram|FB_IAB|FBAN\/Messenger/i.test(ua);
    const isiOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;

    // Slight right nudge for iOS & Meta webviews to match visual crop
    const root = document.documentElement;
    const baseX = getComputedStyle(root).getPropertyValue("--hero-x").trim();
    const baseNum = parseFloat(baseX) || 61;
    const tweak = (isiOS ? 1.0 : 0) + (isMeta ? 1.0 : 0); // +1–2%
    root.style.setProperty("--hero-x", `${Math.min(baseNum + tweak, 70)}%`);

    const primary = img.getAttribute("data-src-raw") || img.currentSrc || img.src;
    const local = img.getAttribute("data-src-local");
    const fallbackNoQuery = primary ? primary.split("?")[0] : null;

    // If Meta in-app browser, skip to local immediately (they block some CDNs)
    if (isMeta && local) {
      img.src = local;
    }

    let settled = false;

    function swapToLocal() {
      if (settled) return;
      if (img && local && img.src !== local) {
        img.src = local;
        settled = true;
      }
    }

    function tryNoQuery() {
      if (settled || !fallbackNoQuery) return;
      if (img.src !== fallbackNoQuery) {
        img.src = fallbackNoQuery;
      }
    }

    img.addEventListener(
      "error",
      () => {
        // First: strip query params (common CDN block)
        if (!settled && primary && img.src === primary) {
          tryNoQuery();
          return;
        }
        // Second: use local asset
        swapToLocal();
      },
      { once: true }
    );

    // If decode stalls, force fallback
    const t = setTimeout(() => {
      if (!img.complete || !img.naturalWidth) {
        if (!isMeta) tryNoQuery();
        // if still not good after another short wait, go local
        setTimeout(swapToLocal, 400);
      }
    }, 2000);

    img.addEventListener(
      "load",
      () => {
        clearTimeout(t);
      },
      { once: true }
    );
  }

  /** ---------- MathJax nudge ---------- **/
  function mathjaxTypesetSoon(delay = 50) {
    if (!window.MathJax) return;
    setTimeout(() => {
      try {
        if (window.MathJax.typeset) window.MathJax.typeset();
      } catch (_) {}
    }, delay);
  }

  /** ---------- reveal on scroll for cards/dividers ---------- **/
  function initReveal() {
    const targets = $$(".card, .divider");
    if (!targets.length) return;

    if (!prefersReduced && "IntersectionObserver" in window) {
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
      const tick = () =>
        targets.forEach((el) => inViewport(el) && el.classList.add("visible"));
      let ticking = false;
      const onScroll = () => {
        if (!ticking) {
          ticking = true;
          raf(() => {
            tick();
            ticking = false;
          });
        }
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("load", tick, { once: true });
      tick();
    }
  }

  /** ---------- equations: ensure inner scroller, activate on view ---------- **/
  function initEquations() {
    const wraps = $$(".eq");
    if (!wraps.length) return;

    // 1) Make sure every .eq has a dedicated inner scroller
    wraps.forEach((el) => {
      const hasScroller = el.querySelector(":scope > .eq-scroll");
      if (!hasScroller) {
        const scroller = document.createElement("div");
        scroller.className = "eq-scroll";
        // Move all children into scroller
        while (el.firstChild) scroller.appendChild(el.firstChild);
        el.appendChild(scroller);
      }
    });

    // 2) Set stagger delays if you want progressive glow (optional)
    wraps.forEach((el, i) =>
      el.style.setProperty("--eq-delay", `${Math.min(i * 0.08, 0.8)}s`)
    );

    // 3) Activate on reveal (for MathJax crisp layout right after CSS paints)
    const activate = (el) => {
      // minor CSS class if you ever want to target "active" state
      if (!el.classList.contains("eq-on")) {
        el.classList.add("eq-on");
        mathjaxTypesetSoon(80);
      }
    };

    if (!prefersReduced && "IntersectionObserver" in window) {
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
      wraps.forEach((el) => io.observe(el));
    } else {
      const tick = () =>
        wraps.forEach((el) => inViewport(el, 0.94) && activate(el));
      let ticking = false;
      const onScroll = () => {
        if (!ticking) {
          ticking = true;
          raf(() => {
            tick();
            ticking = false;
          });
        }
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("load", tick, { once: true });
      tick();
    }
  }

  /** ---------- subtle “living” tilt for cards ---------- **/
  function initTilt() {
    if (prefersReduced) return;
    const cards = $$(".card");
    if (!cards.length) return;

    cards.forEach((card) => {
      let rafId = 0;
      function onMove(e) {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        cancelAnimationFrame(rafId);
        rafId = raf(() => {
          const rx = (0.5 - y) * 4;
          const ry = (x - 0.5) * 6;
          card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
        });
      }
      function reset() {
        card.style.transform = "";
      }
      card.addEventListener("mousemove", onMove);
      card.addEventListener("mouseleave", reset);
      card.addEventListener("blur", reset, true);
    });
  }

  /** ---------- init ---------- **/
  document.addEventListener("DOMContentLoaded", () => {
    swapYear();
    hardenExternal();
    bannerFailover();
    initReveal();
    initEquations();
    initTilt();
    // final MathJax nudge once layout settles
    mathjaxTypesetSoon(250);
  });
})();
