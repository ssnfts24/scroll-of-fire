/* === Scroll of Fire — Codex.js ============================================
 * - Local-first banner, remote upgrade with failover (Meta webviews safe)
 * - Reveal on scroll (cards)
 * - Equation activation (gentle, IO fallback)
 * - External links hardening
 * - Current year swap
 * - MathJax nudge after activations
 * - Optional subtle tilt (reduced-motion aware)
 * ========================================================================== */

(function () {
  "use strict";

  /** utils **/
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const prefersReduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const inViewport = (el, threshold = 0.9) => {
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    return r.top < vh * threshold && r.bottom > 0;
  };

  /** year **/
  function setYear(){ const y = $("#yr"); if (y) y.textContent = String(new Date().getFullYear()); }

  /** external links **/
  function hardenExternal(){
    $$('a[target="_blank"]').forEach(a=>{
      const rel = (a.getAttribute("rel")||"").toLowerCase();
      if (!rel.includes("noopener")) a.setAttribute("rel", (rel? rel+" " : "") + "noopener");
    });
  }

  /** banner: local-first -> upgrade to remote if it decodes cleanly **/
  function initBanner(){
    const img = $("#heroBanner");
    if (!img) return;

    const remote = img.getAttribute("data-src-raw");
    if (!remote) return;

    // Skip upgrade for Meta in-app browsers (tend to block/slow)
    const ua = navigator.userAgent || "";
    const isMetaWebView = /FBAN|FBAV|Facebook|Instagram|FB_IAB|FBAN\/Messenger/i.test(ua);
    if (isMetaWebView) return;

    const test = new Image();
    test.decoding = "async";
    test.loading = "eager";
    test.src = remote;

    const swap = () => {
      // keep size stable; just swap the source
      img.src = remote;
    };

    test.addEventListener("load", swap, { once:true });
    test.addEventListener("error", ()=>{/* stick to local */}, { once:true });

    // safety timeout in case load hangs silently
    setTimeout(()=>{ /* no-op; we rely on local already shown */ }, 3000);
  }

  /** gentle MathJax nudge **/
  function typesetSoon(){
    if (!window.MathJax) return;
    try{ window.MathJax.typeset && window.MathJax.typeset(); }catch(_){}
  }

  /** reveal on scroll **/
  function revealOnScroll(){
    const targets = $$(".card");
    if (!targets.length) return;

    if (!prefersReduced && "IntersectionObserver" in window){
      const io = new IntersectionObserver((entries)=>{
        for (const e of entries){
          if (e.isIntersecting){
            e.target.classList.add("visible");
            io.unobserve(e.target);
          }
        }
      }, { root:null, rootMargin:"0px 0px -12%" });
      targets.forEach(el=>io.observe(el));
    } else {
      const tick = ()=> targets.forEach(el=> inViewport(el) && el.classList.add("visible"));
      let ticking=false;
      const onScroll=()=>{
        if (!ticking){
          ticking=true;
          requestAnimationFrame(()=>{ tick(); ticking=false; });
        }
      };
      window.addEventListener("scroll", onScroll, { passive:true });
      window.addEventListener("load", tick);
      tick();
    }
  }

  /** equation activation (CSS-driven glow; MathJax refresh) **/
  function activateEquations(){
    const eqs = $$(".eq");
    if (!eqs.length) return;

    const activate = el=>{
      if (!el.classList.contains("eq-on")){
        el.classList.add("eq-on");
        setTimeout(typesetSoon, 80);
      }
    };

    if (!prefersReduced && "IntersectionObserver" in window){
      const io = new IntersectionObserver((entries)=>{
        for (const e of entries){
          if (e.isIntersecting){ activate(e.target); io.unobserve(e.target); }
        }
      }, { root:null, rootMargin:"0px 0px -10%" });
      eqs.forEach(el=>io.observe(el));
    } else {
      const tick = ()=> eqs.forEach(el=> inViewport(el, 0.94) && activate(el));
      let ticking=false;
      const onScroll=()=>{
        if (!ticking){
          ticking=true;
          requestAnimationFrame(()=>{ tick(); ticking=false; });
        }
      };
      window.addEventListener("scroll", onScroll, { passive:true });
      window.addEventListener("load", tick);
      tick();
    }
  }

  /** optional subtle tilt on cards **/
  function tiltCards(){
    if (prefersReduced) return;
    const cards = $$(".card");
    cards.forEach(card=>{
      let raf=0;
      const onMove = e=>{
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(()=>{
          const rx = (0.5 - y) * 4;
          const ry = (x - 0.5) * 6;
          card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
        });
      };
      const reset = ()=> (card.style.transform = "");
      card.addEventListener("mousemove", onMove);
      card.addEventListener("mouseleave", reset);
      card.addEventListener("blur", reset, true);
    });
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    setYear();
    hardenExternal();
    initBanner();
    revealOnScroll();
    activateEquations();
    tiltCards();
    setTimeout(typesetSoon, 250);
  });
})();
