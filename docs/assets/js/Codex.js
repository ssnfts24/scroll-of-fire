/* === Scroll of Fire — Codex.js (Living Tech edition) =========================
 * Keeps: reveal on scroll, current year swap, link hardening, banner failover,
 *        MathJax gentle re-typeset.
 * Adds : hero parallax (motion-safe), card tilt (motion-safe),
 *        anchor smart-scroll, Copy TeX buttons for .eq blocks,
 *        reduced-motion + battery-friendly guards.
 * ========================================================================== */

(function () {
  "use strict";

  /** ----------------------- utils ---------------------------------------- **/
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const motionOK = matchMedia("(prefers-reduced-motion: no-preference)").matches;

  const inViewport = (el, threshold = 0.88) => {
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    return r.top < vh * threshold;
  };

  /** -------------------- reveal on scroll -------------------------------- **/
  function initReveal() {
    const targets = $$(".card, .divider");
    const addVisible = (el) => el.classList.add("visible");

    if ("IntersectionObserver" in window && motionOK) {
      const io = new IntersectionObserver(
        (entries) => entries.forEach(e => {
          if (e.isIntersecting) { addVisible(e.target); io.unobserve(e.target); }
        }),
        { root: null, rootMargin: "0px 0px -12%" }
      );
      targets.forEach(el => io.observe(el));
    } else {
      // rAF-throttled scroll fallback
      const tick = () => targets.forEach(el => inViewport(el) && addVisible(el));
      let ticking = false;
      const onScroll = () => {
        if (!ticking) { ticking = true; requestAnimationFrame(() => { tick(); ticking = false; }); }
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("load", tick);
      tick();
    }
  }

  /** -------------------- current year ------------------------------------ **/
  function swapYear() {
    const y = $("#yr");
    if (y) y.textContent = String(new Date().getFullYear());
  }

  /** -------- external links: target + rel hardening ---------------------- **/
  function hardenExternal() {
    $$('a[target="_blank"]').forEach((a) => {
      const rel = (a.getAttribute("rel") || "").toLowerCase();
      if (!rel.includes("noopener")) a.setAttribute("rel", (rel ? rel + " " : "") + "noopener");
    });
  }

  /** ------------- banner failover (webview / errors) --------------------- **/
  function bannerFailover() {
    const heroImg = $(".hero img");
    if (!heroImg) return;

    const primary = heroImg.getAttribute("data-src-raw")
      || "https://raw.githubusercontent.com/ssnfts24/scroll-of-fire/main/6_Images_and_Symbols/file_0000000052e861f98b087ad0b80cbefc.png?v=2025-10-16";
    const fallbackNoQuery = primary.split("?")[0];
    const localFallback = heroImg.getAttribute("data-src-local") || "assets/img/banner.png";

    const tryFallback = (nextSrc) => {
      if (heroImg.dataset.tried === nextSrc) return; // avoid loops
      heroImg.dataset.tried = nextSrc;
      heroImg.src = nextSrc;
    };

    // Meta webviews often block githubusercontent — swap immediately
    const ua = navigator.userAgent || "";
    const isMetaWebView = /FBAN|FBAV|Facebook|Instagram|FB_IAB|FBAN\/Messenger/i.test(ua);
    if (isMetaWebView) tryFallback(localFallback);

    heroImg.addEventListener("error", function onErr() {
      if (heroImg.src === primary) { tryFallback(fallbackNoQuery); return; }
      if (!heroImg.src.includes(localFallback)) { tryFallback(localFallback); return; }
      heroImg.removeEventListener("error", onErr);
    });
    // timeout safety
    setTimeout(() => {
      if (!heroImg.complete || heroImg.naturalWidth === 0) tryFallback(localFallback);
    }, 2500);
  }

  /** --------------------- MathJax gentle re-typeset ---------------------- **/
  function mathjaxNudge() {
    if (!window.MathJax) return;
    const run = () => { try { if (window.MathJax.typeset) window.MathJax.typeset(); } catch(_){} };
    window.addEventListener("load", () => setTimeout(run, 200));
  }

  /** -------- anchor smart-scroll (accounts for small screens) ------------ **/
  function smartAnchors() {
    const offset = 12; // px breathing room
    function go(hash) {
      const id = (hash || "").replace("#", "");
      if (!id) return;
      const target = document.getElementById(id);
      if (!target) return;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: motionOK ? "smooth" : "auto" });
    }
    // on-page clicks
    $$(".wrap a[href^='#']").forEach(a => {
      a.addEventListener("click", (e) => {
        const href = a.getAttribute("href");
        if (href && href.startsWith("#")) {
          e.preventDefault();
          history.pushState(null, "", href);
          go(href);
        }
      });
    });
    // on load with hash
    if (location.hash) setTimeout(() => go(location.hash), 50);
  }

  /** --------------------- Copy TeX for equations ------------------------- **/
  function addCopyButtons() {
    $$(".eq").forEach((box) => {
      if (box.querySelector(".copytex")) return;
      const btn = document.createElement("button");
      btn.className = "copytex";
      btn.type = "button";
      btn.setAttribute("aria-label", "Copy TeX");
      btn.textContent = "Copy TeX";
      box.appendChild(btn);

      btn.addEventListener("click", async () => {
        // Try to recover TeX from MathJax or text fallback
        let tex = "";
        const mjx = box.querySelector("mjx-container");
        if (mjx) {
          // MathJax often stores original in <script type="math/tex"> siblings,
          // but if not, fallback to the LaTeX between $$..$$ from previous HTML.
          // Here we use textContent as a pragmatic fallback.
          tex = mjx.textContent.trim();
        } else {
          tex = box.textContent.trim();
        }
        try {
          await navigator.clipboard.writeText(tex);
          btn.classList.add("ok");
          btn.textContent = "Copied!";
          setTimeout(() => { btn.classList.remove("ok"); btn.textContent = "Copy TeX"; }, 1200);
        } catch {
          btn.classList.add("err");
          btn.textContent = "Failed";
          setTimeout(() => { btn.classList.remove("err"); btn.textContent = "Copy TeX"; }, 1200);
        }
      });
    });
  }

  /** -------------------- Hero parallax (motion-safe) --------------------- **/
  function heroParallax() {
    if (!motionOK) return;
    const hero = $(".hero");
    if (!hero) return;
    const img = hero.querySelector("img");
    let raf = 0;

    const onMove = (e) => {
      const rect = hero.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2; // -1..1
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        img.style.transform = `translate(${x * 6}px, ${y * 4}px) scale(1.01)`;
        hero.style.setProperty("--sigGlowShift", `${(-x * 35).toFixed(1)}%`);
      });
    };
    const reset = () => { img.style.transform = ""; hero.style.setProperty("--sigGlowShift", "0%"); };
    hero.addEventListener("mousemove", onMove);
    hero.addEventListener("mouseleave", reset);
  }

  /** ----------------- Card tilt micro-interaction ------------------------ **/
  function cardTilt() {
    if (!motionOK) return;
    const cards = $$(".card");
    cards.forEach(card => {
      let raf = 0;
      const onMove = (e) => {
        const r = card.getBoundingClientRect();
        const rx = ((e.clientY - r.top) / r.height - 0.5) * -8;  // tilt X
        const ry = ((e.clientX - r.left) / r.width - 0.5) * 10;  // tilt Y
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          card.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
        });
      };
      const reset = () => { card.style.transform = ""; };
      card.addEventListener("mousemove", onMove);
      card.addEventListener("mouseleave", reset);
    });
  }

  /** ------------------------------ init ---------------------------------- **/
  document.addEventListener("DOMContentLoaded", () => {
    initReveal();
    swapYear();
    hardenExternal();
    bannerFailover();
    mathjaxNudge();
    smartAnchors();
    addCopyButtons();
    heroParallax();
    cardTilt();
  });

})();
