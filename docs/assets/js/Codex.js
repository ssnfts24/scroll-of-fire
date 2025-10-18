/* ======================================================================
   Scroll of Fire — Codex.js
   - Local-first banner; remote upgrade w/ in-app (Meta) + offline fallbacks
   - Reveal-on-scroll (IO w/ legacy fallback)
   - Equation activation + MathJax nudges (font-ready, resize, bfcache)
   - External link hardening + anchor focus a11y
   - Optional card tilt (respects reduced motion + live changes)
   ====================================================================== */
(function () {
  "use strict";

  /* ---------------------------- tiny helpers --------------------------- */
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const on  = (t, e, f, o) => t.addEventListener(e, f, o);
  const off = (t, e, f, o) => t.removeEventListener(e, f, o);
  const raf = (fn) => (window.requestAnimationFrame || setTimeout)(fn, 16);
  const caf = (id) => (window.cancelAnimationFrame || clearTimeout)(id);

  const mqReduced      = matchMedia("(prefers-reduced-motion: reduce)");
  const prefersReduced = mqReduced.matches;
  const hasIO          = "IntersectionObserver" in window;
  const hasRO          = "ResizeObserver" in window;

  // Simple viewport check for legacy fallbacks
  const inViewport = (el, thr = 0.9) => {
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    return r.top < vh * thr && r.bottom > 0;
  };

  /* ----------------------- small utilities ----------------------------- */
  function setYear() {
    const y = $("#yr");
    if (y) y.textContent = String(new Date().getFullYear());
  }

  // Harden external links + better SR (screen reader) labels
  function hardenExternal() {
    const hereHost = location.hostname.replace(/^www\./, "");
    $$('a[target="_blank"]').forEach(a => {
      const rel = (a.getAttribute("rel") || "").toLowerCase();
      const parts = new Set(rel.split(/\s+/).filter(Boolean));
      parts.add("noopener"); parts.add("noreferrer");

      try {
        const u = new URL(a.href, location.href);
        if (u.hostname.replace(/^www\./, "") !== hereHost) {
          parts.add("external");
          if (!a.getAttribute("aria-label") && a.textContent.trim()) {
            a.setAttribute("aria-label", `${a.textContent.trim()} (opens in new tab)`);
          }
        }
      } catch (_) { /* ignore */ }

      a.setAttribute("rel", Array.from(parts).join(" "));
    });
  }

  /* ---------------------------- banner logic --------------------------- */
  // Local-first image; upgrade to remote only after verified load.
  function initBanner() {
    const img = $("#heroBanner");
    if (!img) return;

    const remoteAttr = img.getAttribute("data-src-raw");
    const REMOTE_FALLBACK =
      "https://raw.githubusercontent.com/ssnfts24/scroll-of-fire/main/6_Images_and_Symbols/file_0000000052e861f98b087ad0b80cbefc.png?v=2025-10-18";
    const REMOTE = remoteAttr || REMOTE_FALLBACK;

    const ua = navigator.userAgent || "";
    const isMetaApp = /FBAN|FBAV|Facebook|Instagram|FB_IAB|FBAN\/Messenger/i.test(ua);

    // Mark local as ready (prevents fade/flash)
    if (img.complete && img.naturalWidth > 0) img.classList.add("hero-ready");
    else on(img, "load", () => img.classList.add("hero-ready"), { once: true });

    // Don’t upgrade in in-app Meta webviews or while offline
    if (!navigator.onLine || isMetaApp) return;

    const swapToRemote = () => {
      img.src = REMOTE;
      img.srcset = `${REMOTE} 1600w, assets/img/banner-1200.png 1200w, assets/img/banner-800.png 800w`;
      img.sizes  = "(max-width: 600px) 100vw, (max-width: 1100px) 94vw, 1100px";
    };

    const probe = new Image();
    probe.decoding = "async";
    probe.loading  = "eager";
    probe.referrerPolicy = "no-referrer";

    on(probe, "load", () => {
      if (typeof probe.decode === "function") {
        probe.decode().then(swapToRemote).catch(swapToRemote);
      } else swapToRemote();
    }, { once: true });

    on(probe, "error", () => { /* keep local silently */ }, { once: true });

    probe.src = REMOTE;

    // If the user goes online later, retry once (cache-busted)
    on(window, "online", function retryOnce() {
      off(window, "online", retryOnce);
      if (img.src !== REMOTE) probe.src = REMOTE + "&r=" + Date.now();
    }, { once: true });
  }

  /* --------------------------- MathJax helpers ------------------------- */
  function typesetSoon(delay = 80) {
    const mj = window.MathJax;
    if (!mj) return;
    const run = () => { try { mj.typeset && mj.typeset(); } catch (_) {} };
    if (mj.startup && mj.startup.promise) {
      mj.startup.promise.then(() => setTimeout(run, delay));
    } else {
      setTimeout(run, delay);
    }
  }

  function typesetOnFontsReady() {
    if (!document.fonts || !document.fonts.ready) return;
    document.fonts.ready.then(() => typesetSoon(60)).catch(() => {});
  }

  /* -------------------------- reveal-on-scroll ------------------------- */
  function revealOnScroll() {
    const cards = $$(".card");
    if (!cards.length) return;

    if (!prefersReduced && hasIO) {
      const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            io.unobserve(e.target);
          }
        }
      }, { root: null, rootMargin: "0px 0px -12%", threshold: 0.08 });
      cards.forEach(el => io.observe(el));
    } else {
      const tick = () => cards.forEach(el => inViewport(el) && el.classList.add("visible"));
      let ticking = false;
      const onS = () => { if (!ticking) { ticking = true; raf(() => { tick(); ticking = false; }); } };
      on(window, "scroll", onS, { passive: true });
      on(window, "load", tick);
      tick();
    }
  }

  /* -------------------------- equation activator ----------------------- */
  function activateEquations() {
    const eqs = $$(".eq");
    if (!eqs.length) return;

    const activate = (el) => {
      if (!el.classList.contains("eq-on")) {
        el.classList.add("eq-on");
        typesetSoon(120);
      }
    };

    if (!prefersReduced && hasIO) {
      const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.isIntersecting) { activate(e.target); io.unobserve(e.target); }
        }
      }, { root: null, rootMargin: "0px 0px -10%", threshold: 0.06 });
      eqs.forEach(el => io.observe(el));
    } else {
      const tick = () => eqs.forEach(el => inViewport(el, 0.94) && activate(el));
      let ticking = false;
      const onS = () => { if (!ticking) { ticking = true; raf(() => { tick(); ticking = false; }); } };
      on(window, "scroll", onS, { passive: true });
      on(window, "load", tick);
      tick();
    }
  }

  /* ----------------------------- card tilt ----------------------------- */
  function tiltCards() {
    if (prefersReduced) return;
    $$(".card").forEach(card => {
      let rid = 0;
      const onMove = (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        caf(rid);
        rid = raf(() => {
          const rx = (0.5 - y) * 4;
          const ry = (x - 0.5) * 6;
          card.style.transform =
            `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
        });
      };
      const reset = () => { card.style.transform = ""; };
      on(card, "mousemove", onMove);
      on(card, "mouseleave", reset);
      on(card, "blur", reset, true);
      on(card, "touchstart", reset, { passive: true }); // disable tilt on touch
    });

    // Respect live changes to reduced motion
    on(mqReduced, "change", (e) => {
      if (e.matches) $$(".card").forEach(c => { c.style.transform = ""; });
    });
  }

  /* ----------------------------- anchors a11y -------------------------- */
  // Ensure in-page anchors move programmatic focus to their target
  function focusAnchors() {
    on(document, "click", (ev) => {
      const a = ev.target.closest("a[href^='#']");
      if (!a) return;
      const id = a.getAttribute("href").slice(1);
      if (!id) return;
      const tgt = document.getElementById(id);
      if (tgt) {
        if (!tgt.hasAttribute("tabindex")) tgt.setAttribute("tabindex", "-1");
        tgt.focus({ preventScroll: true });
      }
    });
  }

  /* -------------------------------- boot ------------------------------- */
  function boot() {
    setYear();
    hardenExternal();
    initBanner();
    revealOnScroll();
    activateEquations();
    tiltCards();
    typesetSoon(250);
    typesetOnFontsReady();
    focusAnchors();
  }

  on(document, "DOMContentLoaded", boot);

  // Handle bfcache restores (Safari/Firefox)
  on(window, "pageshow", (e) => {
    if (e && e.persisted) {
      setYear();
      initBanner();
      typesetSoon(100);
    }
  });

  // Re-typeset on size changes (fixes occasional line-break glitches)
  if (hasRO) {
    const ro = new ResizeObserver(() => typesetSoon(120));
    $$(".eq").forEach(el => ro.observe(el));
  } else {
    let wait = false;
    on(window, "resize", () => {
      if (wait) return;
      wait = true;
      setTimeout(() => { wait = false; typesetSoon(120); }, 200);
    }, { passive: true });
  }
})();
