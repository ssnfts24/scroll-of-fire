/* ======================================================================
   Scroll of Fire — Codex.js
   (bulletproof banner swap, equation activation, reveal effects, a11y)
   ====================================================================== */
(function () {
  "use strict";

  /* ---------------------------- tiny helpers --------------------------- */
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const on  = (t, e, f, o) => t.addEventListener(e, f, o);
  const raf = (fn) => (window.requestAnimationFrame || setTimeout)(fn, 16);
  const caf = (id) => (window.cancelAnimationFrame || clearTimeout)(id);

  const mqReduced      = matchMedia("(prefers-reduced-motion: reduce)");
  const prefersReduced = mqReduced.matches;
  const hasIO          = "IntersectionObserver" in window;
  const hasRO          = "ResizeObserver" in window;

  /* Basic viewport check for fallback paths */
  const inViewport = (el, thr = 0.9) => {
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    return r.top < vh * thr && r.bottom > 0;
  };

  /* ----------------------- global small utilities ---------------------- */
  function setYear() {
    const y = $("#yr");
    if (y) y.textContent = String(new Date().getFullYear());
  }

  // Add rel="noopener noreferrer" where target=_blank; a11y label for externals
  function hardenExternal() {
    const hereHost = location.hostname.replace(/^www\./, "");
    $$('a[target="_blank"]').forEach(a => {
      const rel = (a.getAttribute("rel") || "").toLowerCase();
      const parts = new Set(rel.split(/\s+/).filter(Boolean));
      parts.add("noopener"); parts.add("noreferrer");
      try {
        const u = new URL(a.href, location.href);
        if (u.hostname.replace(/^www\./, "") !== hereHost && !a.getAttribute("aria-label")) {
          const txt = a.textContent.trim();
          if (txt) a.setAttribute("aria-label", `${txt} (opens in new tab)`);
        }
      } catch(_) {}
      a.setAttribute("rel", Array.from(parts).join(" "));
    });
  }

  /* ---------------------------- banner logic --------------------------- */
  /**
   * Goals:
   *  - Local-first to avoid flashes, then safe remote upgrade.
   *  - Honor srcset for DPR/width. Work around iOS/Safari decode quirks.
   *  - Focal control by breakpoint (object-position), no cropping surprises.
   *  - Skip remote in Meta webviews & offline; retry when network returns.
   */
  function initBanner() {
    const img = $("#heroBanner");
    if (!img) return;

    // Inputs from HTML (see patch below)
    const remote = img.getAttribute("data-src-raw") || "";
    const remoteSet = img.getAttribute("data-srcset-raw") || ""; // optional comma list
    const localSet  = img.getAttribute("data-srcset-local") || ""; // optional comma list
    const sizesAttr = img.getAttribute("data-sizes") ||
      "(max-width: 600px) 100vw, (max-width: 1100px) 94vw, 1100px";

    // In-app webviews (Meta) are flaky for cross-origin images — keep local there.
    const ua = navigator.userAgent || "";
    const isMetaApp = /FBAN|FBAV|Facebook|Instagram|FB_IAB|FBAN\/Messenger/i.test(ua);
    const isOffline = !navigator.onLine;

    // Ensure aspect lock & focal variables are applied immediately
    applyHeroAspectAndFocal(img);

    // Mark local image "ready" as soon as it’s decoded, to avoid white flash
    if (img.complete && img.naturalWidth > 0) {
      img.classList.add("hero-ready");
    } else {
      on(img, "load", () => img.classList.add("hero-ready"), { once: true });
    }

    // Always provide a srcset for local too (so small screens get smaller file)
    if (localSet) {
      img.srcset = localSet;
      img.sizes  = sizesAttr;
    }

    // Bail on remote in constrained environments; local remains displayed.
    if (!remote || isMetaApp || isOffline) return;

    // If a full remote srcset is provided, prefer that; else upgrade single src.
    const swapToRemote = () => {
      if (remoteSet) {
        img.srcset = remoteSet;
        img.sizes  = sizesAttr;
        // Force selection refresh in Safari/iOS by toggling a benign attribute
        img.setAttribute("data-rselect", String(Date.now()));
        // Access currentSrc to nudge layout engines to commit the choice
        void img.currentSrc;
      } else {
        img.src = remote;
      }
      // Keep hero-ready (fade handled by CSS)
    };

    // Preload & decode the remote before swapping (prevents flashes)
    const probe = new Image();
    probe.decoding = "async";
    probe.loading  = "eager";
    probe.referrerPolicy = "no-referrer";

    const doSwap = () => {
      if (typeof probe.decode === "function") {
        probe.decode().then(swapToRemote).catch(swapToRemote);
      } else {
        swapToRemote();
      }
    };

    on(probe, "load", doSwap,  { once: true });
    on(probe, "error", () => { /* silently keep local */ }, { once: true });
    probe.src = remote; // NB: enough to validate the origin; srcset validated on swap

    // Retry once when connection returns
    const retryOnce = () => {
      window.removeEventListener("online", retryOnce);
      if (img && remote && img.currentSrc.indexOf(remote) === -1) {
        probe.src = remote + (remote.includes("?") ? "&" : "?") + "r=" + Date.now();
      }
    };
    on(window, "online", retryOnce, { once: true });

    // Update focal/object-position on resize/orientation
    on(window, "resize", () => applyHeroAspectAndFocal(img), { passive: true });
    on(window, "orientationchange", () => applyHeroAspectAndFocal(img), { passive: true });
  }

  /* Aspect + focal control for consistent cropping across devices */
  function applyHeroAspectAndFocal(img) {
    // Aspect
    const aspect = img.getAttribute("data-aspect") || "16/9";
    img.style.setProperty("--hero-aspect", aspect);

    // Focal points: allow per-breakpoint control via data attributes
    const mobile = img.getAttribute("data-focal-mobile") || "63% 50%";
    const desk   = img.getAttribute("data-focal-desktop") || "59% 50%";
    const bp     = window.matchMedia("(min-width: 860px)").matches ? desk : mobile;
    img.style.objectPosition = bp;
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
    document.fonts.ready.then(() => typesetSoon(50)).catch(() => {});
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
      return;
    }

    const tick = () => cards.forEach(el => inViewport(el) && el.classList.add("visible"));
    let ticking = false;
    const onS = () => {
      if (!ticking) {
        ticking = true;
        raf(() => { tick(); ticking = false; });
      }
    };
    on(window, "scroll", onS, { passive: true });
    on(window, "load", tick);
    tick();
  }

  /* -------------------------- equation activator ----------------------- */
  function activateEquations() {
    const blocks = $$(".eq");
    if (!blocks.length) return;

    const activate = (el) => {
      if (!el.classList.contains("eq-on")) {
        el.classList.add("eq-on");
        typesetSoon(120);
      }
    };

    if (!prefersReduced && hasIO) {
      const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            activate(e.target);
            io.unobserve(e.target);
          }
        }
      }, { root: null, rootMargin: "0px 0px -10%", threshold: 0.06 });
      blocks.forEach(el => io.observe(el));
      return;
    }

    const tick = () => blocks.forEach(el => inViewport(el, 0.94) && activate(el));
    let ticking = false;
    const onS = () => {
      if (!ticking) {
        ticking = true;
        raf(() => { tick(); ticking = false; });
      }
    };
    on(window, "scroll", onS, { passive: true });
    on(window, "load", tick);
    tick();
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
      card.addEventListener("mousemove", onMove);
      card.addEventListener("mouseleave", reset);
      card.addEventListener("blur", reset, true);
      card.addEventListener("touchstart", reset, { passive: true }); // disable tilt on touch
    });

    const rmListener = (e) => { if (e.matches) $$(".card").forEach(c => c.style.transform = ""); };
    on(mqReduced, "change", rmListener);
  }

  /* ----------------------------- anchors a11y -------------------------- */
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

  /* ------------------------------- boot -------------------------------- */
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

  // bfcache restore (Safari/Firefox)
  on(window, "pageshow", (e) => {
    if (e && e.persisted) {
      setYear();
      initBanner();
      typesetSoon(100);
    }
  });

  // Re-typeset on container width changes for MathJax wrapping
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
