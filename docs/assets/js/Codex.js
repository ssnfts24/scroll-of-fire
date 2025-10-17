/* === Scroll of Fire — Codex.js (Mobile-first, robust) =====================
 * - Reveal on scroll for cards/dividers
 * - Current year swap
 * - External links hardening
 * - Banner failover (Meta webviews, slow decodes)
 * - Gentle MathJax typeset nudge
 */

(function () {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const prefersNoMotion = !matchMedia("(prefers-reduced-motion: no-preference)").matches;

  /* year */
  const swapYear = () => { const y = $("#yr"); if (y) y.textContent = String(new Date().getFullYear()); };

  /* external links hardening */
  function hardenExternal(){
    $$('a[target="_blank"]').forEach(a=>{
      const rel = (a.getAttribute("rel")||"").toLowerCase();
      if(!rel.includes("noopener")) a.setAttribute("rel", (rel?rel+" ":"")+"noopener");
    });
  }

  /* banner failover + sizing sanity for in-app browsers */
  function bannerFailover(){
    const img = $("#heroBanner");
    if(!img) return;

    const local = img.getAttribute("data-src-local");
    const primary = img.getAttribute("data-src-raw") || img.src;
    const fallbackNoQuery = primary.split("?")[0];

    const ua = navigator.userAgent || "";
    const isMetaWebView = /FBAN|FBAV|Facebook|Instagram|FB_IAB|FBAN\/Messenger/i.test(ua);

    function swapToLocal(){
      if(img && local && img.src.indexOf(local)===-1) img.src = local;
    }

    if(isMetaWebView) swapToLocal();

    img.addEventListener("error", ()=>{
      if(img.src===primary) img.src = fallbackNoQuery;
      else swapToLocal();
    }, {once:true});

    const t = setTimeout(()=>{
      if(!img.complete || img.naturalWidth===0) swapToLocal();
    }, 2500);
    img.addEventListener("load", ()=>clearTimeout(t), {once:true});
  }

  /* MathJax nudge */
  const typesetSoon = () => {
    if(!window.MathJax) return;
    try{ window.MathJax.typeset && window.MathJax.typeset(); }catch(e){}
  };

  /* reveal cards */
  function initReveal(){
    const targets = $$(".card, .divider");
    if(!targets.length) return;

    if(!prefersNoMotion && "IntersectionObserver" in window){
      const io = new IntersectionObserver((entries)=>{
        for(const e of entries){
          if(e.isIntersecting){
            e.target.classList.add("visible");
            io.unobserve(e.target);
          }
        }
      }, {root:null, rootMargin:"0px 0px -12%"});
      targets.forEach(el=>io.observe(el));
    }else{
      const tick = () => targets.forEach(el => {
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight || document.documentElement.clientHeight;
        if(r.top < vh*0.92 && r.bottom > 0) el.classList.add("visible");
      });
      window.addEventListener("scroll", tick, {passive:true});
      window.addEventListener("load", tick);
      tick();
    }
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    swapYear();
    hardenExternal();
    bannerFailover();
    initReveal();
    setTimeout(typesetSoon, 250);
  });
})();
