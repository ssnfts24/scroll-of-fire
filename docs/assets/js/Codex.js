/* ======================================================================
   Scroll of Fire — Codex.js
   Bulletproof banner swap • equation activation • reveal effects • a11y
   - Extra hardening for FB/IG/Messenger in-app webviews and iOS Safari
   - Motion & data savers respected; offline-safe; resize/rotation debounced
   - MathJax queued safely; visibility/page cache restores re-typeset
   ====================================================================== */
(function () {
  "use strict";

  /* ---------------------------- tiny utilities ---------------------------- */
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const on = (t, e, f, o) => t && t.addEventListener && t.addEventListener(e, f, o);

  const raf  = (fn) => (window.requestAnimationFrame || ((f) => setTimeout(f,16)))(fn);
  const caf  = (id) => (window.cancelAnimationFrame || clearTimeout)(id);
  const now  = () => (performance && performance.now ? performance.now() : Date.now());

  const conn  = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const saveD = !!(conn && conn.saveData);
  const mqReduced = matchMedia("(prefers-reduced-motion: reduce)");
  const prefersReduced = mqReduced && mqReduced.matches;

  const hasIO = "IntersectionObserver" in window;
  const hasRO = "ResizeObserver" in window;

  const UA = navigator.userAgent || "";
  const isMetaApp = /FBAN|FBAV|Facebook|Instagram|FB_IAB|FBAN\/Messenger/i.test(UA);
  const isWebKit  = /WebKit/i.test(UA) && !/Edge/i.test(UA);
  const isOffline = () => !navigator.onLine;

  const inViewport = (el, thr = 0.9) => {
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    return r.top < vh * thr && r.bottom > 0;
  };

  const debounce = (fn, ms = 120) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), ms);
    };
  };

  const throttleRAF = (fn) => {
    let running = false;
    return (...args) => {
      if (running) return;
      running = true;
      raf(() => { running = false; fn.apply(null, args); });
    };
  };

  /* ------------------------------ basic polish ---------------------------- */
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
          const txt = (a.textContent || "").trim();
          if (txt) a.setAttribute("aria-label", `${txt} (opens in new tab)`);
        }
      } catch { /* ignore malformed hrefs */ }

      a.setAttribute("rel", Array.from(parts).join(" "));
    });
  }

  /* ------------------------------- banner -------------------------------- */
  function initBanner() {
    const img  = $("#heroBanner");
    if (!img) return;

    const hero = img.closest(".hero");
    const remote   = img.getAttribute("data-src-raw") || "";
    const remoteSet= img.getAttribute("data-srcset-raw") || "";
    const localSet = img.getAttribute("data-srcset-local") || "";
    const sizesAttr= img.getAttribute("data-sizes") ||
        "(max-width: 600px) 100vw, (max-width: 1100px) 94vw, 1100px";
    const authorWantsContain = (img.getAttribute("data-fit") || "").toLowerCase() === "contain";

    applyHeroAspectAndFocal(img);
    enforceHeroFit(hero, img, authorWantsContain);

    // Always seed with local srcset so layout picks an optimal size early.
    if (localSet) {
      img.srcset = localSet;
      img.sizes  = sizesAttr;
    }

    // Ensure visible in tricky in-app browsers.
    img.classList.add("hero-ready");

    const onImgLoad = () => enforceHeroFit(hero, img, authorWantsContain);
    if (img.complete && img.naturalWidth > 0) onImgLoad();
    else on(img, "load", onImgLoad, { once: true });

    // Bail on remote swap in cautious contexts
    if (!remote || isMetaApp || isOffline() || saveD) {
      wireHeroFitListeners(hero, img, authorWantsContain);
      return;
    }

    // Probe remote first (avoid broken image flash)
    const probe = new Image();
    probe.decoding = "async";
    probe.loading  = "eager";
    probe.referrerPolicy = "no-referrer";

    const swapToRemote = () => {
      if (!img) return;
      if (remoteSet && !authorWantsContain) {
        img.srcset = remoteSet;
        img.sizes  = sizesAttr;
        // Safari selection nudge
        img.setAttribute("data-rselect", String(Date.now()));
        void img.currentSrc;
      } else {
        img.src = remote;
        img.removeAttribute("srcset");
        img.removeAttribute("sizes");
      }
    };

    const safeSwap = () => {
      if (typeof probe.decode === "function") {
        probe.decode().then(swapToRemote).catch(swapToRemote);
      } else { swapToRemote(); }
    };

    on(probe, "load",  safeSwap, { once: true });
    on(probe, "error", () => {/* keep local silently */}, { once: true });
    probe.src = remote;

    // Retry once if we come back online.
    const retryOnce = () => {
      window.removeEventListener("online", retryOnce);
      if (img && remote && (img.currentSrc || img.src || "").indexOf(remote) === -1) {
        probe.src = remote + (remote.includes("?") ? "&" : "?") + "r=" + Date.now();
      }
    };
    on(window, "online", retryOnce, { once: true });

    wireHeroFitListeners(hero, img, authorWantsContain);
  }

  function applyHeroAspectAndFocal(img) {
    const aspect = img.getAttribute("data-aspect") || "16/9";
    img.style.setProperty("--hero-aspect", aspect);
    const mobile = img.getAttribute("data-focal-mobile") || "63% 50%";
    const desk   = img.getAttribute("data-focal-desktop") || "59% 50%";
    const bpDesk = window.matchMedia && window.matchMedia("(min-width: 860px)").matches;
    img.style.objectPosition = bpDesk ? desk : mobile;
  }

  function enforceHeroFit(hero, img, forceContain = false) {
    if (!hero || !img) return;
    if (forceContain) { hero.classList.add("hero--contain"); return; }

    // If aspect diverges a lot from container’s aspect, prefer contain
    const natW = img.naturalWidth  || parseInt(img.getAttribute("width")  || "0", 10);
    const natH = img.naturalHeight || parseInt(img.getAttribute("height") || "0", 10);

    const cssAspect = getComputedStyle(img).getPropertyValue("--hero-aspect").trim() || "16/9";
    const contAspect = parseAspect(cssAspect) || 16/9;
    if (natW > 0 && natH > 0) {
      const imgAspect = natW / natH;
      const diff = Math.abs(imgAspect - contAspect) / contAspect;
      if (diff > 0.25) hero.classList.add("hero--contain");
      else hero.classList.remove("hero--contain");
    }
  }

  function parseAspect(expr) {
    if (!expr) return null;
    const parts = String(expr).split("/");
    if (parts.length === 2) {
      const a = parseFloat(parts[0]), b = parseFloat(parts[1]);
      return (a > 0 && b > 0) ? a / b : null;
    }
    const n = parseFloat(expr);
    return isFinite(n) && n > 0 ? n : null;
  }

  function wireHeroFitListeners(hero, img, authorWantsContain) {
    const onReflow = throttleRAF(() => {
      applyHeroAspectAndFocal(img);
      enforceHeroFit(hero, img, authorWantsContain);
    });

    on(window, "resize", onReflow, { passive: true });
    on(window, "orientationchange", onReflow, { passive: true });

    if (hasRO) {
      const ro = new ResizeObserver(onReflow);
      ro.observe(hero);
    } else {
      // Fallback debounce for older webviews
      on(window, "resize", debounce(onReflow, 150), { passive: true });
    }
  }

  /* ------------------------------ MathJax ------------------------------- */
  function typesetSoon(delay = 80) {
    const mj = window.MathJax;
    if (!mj) return;

    const run = () => {
      try {
        if (mj.typesetClear) mj.typesetClear(); // no-op if not supported
        if (mj.typesetPromise) mj.typesetPromise().catch(()=>{});
        else if (mj.typeset) mj.typeset();
      } catch {/* ignore */}
    };

    if (mj.startup && mj.startup.promise) {
      mj.startup.promise.then(() => setTimeout(run, delay)).catch(run);
    } else {
      setTimeout(run, delay);
    }
  }

  function typesetOnFontsReady() {
    if (!document.fonts || !document.fonts.ready) return;
    document.fonts.ready.then(() => typesetSoon(50)).catch(() => {});
  }

  /* -------------------------- reveal-on-scroll -------------------------- */
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
    const onS  = throttleRAF(tick);
    on(window, "scroll", onS, { passive: true });
    on(window, "load", tick);
    tick();
  }

  /* --------------------------- equation activator ----------------------- */
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
    const onS  = throttleRAF(tick);
    on(window, "scroll", onS, { passive: true });
    on(window, "load", tick);
    tick();
  }

  /* ------------------------------- card tilt ---------------------------- */
  function tiltCards() {
    if (prefersReduced) return;

    $$(".card").forEach(card => {
      let rid = 0;
      const onMove = (e) => {
        const r = card.getBoundingClientRect();
        const cx = ("touches" in e && e.touches.length ? e.touches[0].clientX : e.clientX);
        const cy = ("touches" in e && e.touches.length ? e.touches[0].clientY : e.clientY);
        const x = (cx - r.left) / r.width;
        const y = (cy - r.top) / r.height;

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
      on(card, "touchstart", reset, { passive: true });
    });

    // If user toggles reduced-motion after load, clear transforms
    on(mqReduced, "change", (e) => { if (e.matches) $$(".card").forEach(c => c.style.transform = ""); });
  }

  /* ------------------------------ anchor a11y --------------------------- */
  function focusAnchors() {
    on(document, "click", (ev) => {
      const a = ev.target && ev.target.closest && ev.target.closest("a[href^='#']");
      if (!a) return;
      const id = a.getAttribute("href").slice(1);
      const tgt = id && document.getElementById(id);
      if (tgt) {
        if (!tgt.hasAttribute("tabindex")) tgt.setAttribute("tabindex", "-1");
        tgt.focus({ preventScroll: true });
      }
    });
  }

  /* --------------------------- visibility hygiene ----------------------- */
  function attachVisibilityFixes() {
    // Some webviews cache the page; re-typeset and re-fit banner on return.
    on(document, "visibilitychange", () => {
      if (document.visibilityState === "visible") {
        typesetSoon(80);
        const img = $("#heroBanner");
        if (img) enforceHeroFit(img.closest(".hero"), img, (img.dataset.fit||"").toLowerCase()==="contain");
      }
    });

    on(window, "pageshow", (e) => {
      if (e && e.persisted) {
        setYear();
        initBanner(); // includes re-fit
        typesetSoon(100);
      }
    });
  }

  /* ------------------------------- boot --------------------------------- */
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
    attachVisibilityFixes();
  }

  on(document, "DOMContentLoaded", boot);

  // Non-RO fallback to keep MathJax tidy on layout shifts
  if (hasRO) {
    const ro = new ResizeObserver(debounce(() => typesetSoon(120), 120));
    $$(".eq").forEach(el => ro.observe(el));
  } else {
    on(window, "resize", debounce(() => typesetSoon(120), 200), { passive: true });
  }

  /* ------------------------------ telemetry (opt-in) --------------------- */
  // Set window.SOFTelemetry = true in console to log basic milestones.
  function log(msg){ if (window.SOFTelemetry) console.log("[Codex.js]", msg); }
  log("ready @ " + Math.round(now()) + "ms");
})();
