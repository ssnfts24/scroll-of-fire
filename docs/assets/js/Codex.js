/* ======================================================================
   Scroll of Fire — Codex.js
   (bulletproof banner swap, equation activation, reveal effects, a11y)
   ====================================================================== */
(function () {
  "use strict";

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const on  = (t, e, f, o) => t.addEventListener(e, f, o);
  const raf = (fn) => (window.requestAnimationFrame || setTimeout)(fn, 16);
  const caf = (id) => (window.cancelAnimationFrame || clearTimeout)(id);

  const mqReduced      = matchMedia("(prefers-reduced-motion: reduce)");
  const prefersReduced = mqReduced.matches;
  const hasIO          = "IntersectionObserver" in window;
  const hasRO          = "ResizeObserver" in window;

  const inViewport = (el, thr = 0.9) => {
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    return r.top < vh * thr && r.bottom > 0;
  };

  function setYear() {
    const y = $("#yr");
    if (y) y.textContent = String(new Date().getFullYear());
  }

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
  function initBanner() {
    const img = $("#heroBanner");
    if (!img) return;

    const hero = img.closest(".hero");
    const remote = img.getAttribute("data-src-raw") || "";
    const remoteSet = img.getAttribute("data-srcset-raw") || "";
    const localSet  = img.getAttribute("data-srcset-local") || "";
    const sizesAttr = img.getAttribute("data-sizes") ||
      "(max-width: 600px) 100vw, (max-width: 1100px) 94vw, 1100px";

    const ua = navigator.userAgent || "";
    const isMetaApp = /FBAN|FBAV|Facebook|Instagram|FB_IAB|FBAN\/Messenger/i.test(ua);
    const isOffline = !navigator.onLine;

    applyHeroAspectAndFocal(img);
    // If the author explicitly wants contain mode, honor it immediately.
    enforceHeroFit(hero, img);

    if (img.complete && img.naturalWidth > 0) {
      img.classList.add("hero-ready");
      // Re-evaluate fit once natural sizes are known
      enforceHeroFit(hero, img);
    } else {
      on(img, "load", () => {
        img.classList.add("hero-ready");
        enforceHeroFit(hero, img);
      }, { once: true });
    }

    // Always give browsers a local srcset to pick an optimal size early.
    if (localSet) {
      img.srcset = localSet;
      img.sizes  = sizesAttr;
    }

    // Don’t attempt remote upgrade in flaky contexts.
    if (!remote || isMetaApp || isOffline) {
      wireHeroFitListeners(hero, img);
      return;
    }

    const swapToRemote = () => {
      if (remoteSet) {
        img.srcset = remoteSet;
        img.sizes  = sizesAttr;
        // Safari/iOS nudge to recompute source selection
        img.setAttribute("data-rselect", String(Date.now()));
        void img.currentSrc;
      } else {
        img.src = remote;
      }
    };

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
    on(probe, "error", () => { /* keep local silently */ }, { once: true });
    probe.src = remote;

    const retryOnce = () => {
      window.removeEventListener("online", retryOnce);
      if (img && remote && img.currentSrc.indexOf(remote) === -1) {
        probe.src = remote + (remote.includes("?") ? "&" : "?") + "r=" + Date.now();
      }
    };
    on(window, "online", retryOnce, { once: true });

    wireHeroFitListeners(hero, img);
  }

  // Apply aspect & focal point (CSS custom properties + object-position)
  function applyHeroAspectAndFocal(img) {
    const aspect = img.getAttribute("data-aspect") || "16/9";
    img.style.setProperty("--hero-aspect", aspect);
    const mobile = img.getAttribute("data-focal-mobile") || "63% 50%";
    const desk   = img.getAttribute("data-focal-desktop") || "59% 50%";
    const bpDesk = window.matchMedia("(min-width: 860px)").matches;
    img.style.objectPosition = bpDesk ? desk : mobile;
  }

  // Decide whether to show entire image (contain) vs edge-to-edge (cover)
  function enforceHeroFit(hero, img) {
    if (!hero || !img) return;

    // 1) Author override
    const forceContain = (img.getAttribute("data-fit") || "").toLowerCase() === "contain";
    if (forceContain) {
      hero.classList.add("hero--contain");
      return;
    }

    // 2) Heuristic: if aspect mismatch is large, prefer contain
    const natW = img.naturalWidth || parseInt(img.getAttribute("width") || "0", 10);
    const natH = img.naturalHeight || parseInt(img.getAttribute("height") || "0", 10);
    const containerW = hero.clientWidth || img.clientWidth || 1;
    const cssAspect = getComputedStyle(img).getPropertyValue("--hero-aspect").trim() || "16/9";
    const contAspect = parseAspect(cssAspect) || (containerW / Math.max(hero.clientHeight, 1));

    if (natW > 0 && natH > 0) {
      const imgAspect = natW / natH;          // >1 wide, <1 tall
      const diff = Math.abs(imgAspect - contAspect) / contAspect; // relative difference
      if (diff > 0.25) hero.classList.add("hero--contain");
      else hero.classList.remove("hero--contain");
    }
  }

  function parseAspect(expr) {
    // Accept "16/9", "4/3", "1.777", etc.
    if (!expr) return null;
    const parts = String(expr).split("/");
    if (parts.length === 2) {
      const a = parseFloat(parts[0].trim());
      const b = parseFloat(parts[1].trim());
      if (a > 0 && b > 0) return a / b;
      return null;
    }
    const n = parseFloat(expr);
    return isFinite(n) && n > 0 ? n : null;
  }

  function wireHeroFitListeners(hero, img) {
    const onReflow = () => {
      applyHeroAspectAndFocal(img);
      enforceHeroFit(hero, img);
    };
    on(window, "resize", onReflow, { passive: true });
    on(window, "orientationchange", onReflow, { passive: true });

    // In case fonts/layout shift height, observe hero box if available
    if ("ResizeObserver" in window) {
      const ro = new ResizeObserver(onReflow);
      ro.observe(hero);
    }
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
      card.addEventListener("touchstart", reset, { passive: true });
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

  on(window, "pageshow", (e) => {
    if (e && e.persisted) {
      setYear();
      initBanner();
      typesetSoon(100);
    }
  });

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
