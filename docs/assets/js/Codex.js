/* ——— Scroll of Fire • Codex.js ———
   - Compact hero behavior
   - Reveal on scroll
   - Equation activation + MathJax responsive fix
   - External link hardening
   - Banner failover
   Last update: 2025-10-18
*/
(function(){
  "use strict";

  const $ = (s, r=document)=>r.querySelector(s);
  const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
  const prefersNoMotion = !matchMedia("(prefers-reduced-motion: no-preference)").matches;

  /* util: in viewport */
  const inViewport = (el, threshold=0.9)=>{
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    return r.top < vh * threshold && r.bottom > 0;
  };

  /* year */
  const setYear = ()=>{ const y = $("#yr"); if(y) y.textContent = String(new Date().getFullYear()); };

  /* external links hardening */
  const hardenExternal = ()=>{
    $$('a[target="_blank"]').forEach(a=>{
      const rel=(a.getAttribute("rel")||"").toLowerCase();
      if(!rel.includes("noopener")) a.setAttribute("rel", (rel?rel+" ":"") + "noopener");
    });
  };

  /* hero failover & compacting */
  const bannerFailover = ()=>{
    const img = $("#heroBanner");
    if(!img) return;

    const local = img.getAttribute("data-src-local");
    const primary = img.getAttribute("data-src-raw") || img.src;
    const fallbackNoQuery = primary.split("?")[0];

    const ua = navigator.userAgent || "";
    const isMeta = /FBAN|FBAV|Facebook|Instagram|FB_IAB|Messenger/i.test(ua);

    const swapLocal = ()=>{ if(local && img.src.indexOf(local)===-1) img.src = local; };

    if(isMeta) swapLocal();

    img.addEventListener("error", ()=>{
      if(img.src === primary) img.src = fallbackNoQuery;
      else swapLocal();
    }, {once:true});

    // timeout fallback (slow decode)
    const t = setTimeout(()=>{ if(!img.complete || img.naturalWidth===0) swapLocal(); }, 2200);
    img.addEventListener("load", ()=>clearTimeout(t), {once:true});
  };

  /* MathJax re-typeset + responsive fix (forces SVG to fit container) */
  const fitMath = ()=>{
    const svgs = $$('mjx-container[jax="SVG"] svg');
    svgs.forEach(svg=>{
      svg.style.maxWidth = "100%";
      svg.style.height = "auto";
      svg.removeAttribute("width");
      svg.removeAttribute("height");
      svg.setAttribute("preserveAspectRatio","xMidYMid meet");
    });
  };
  const typesetSoon = ()=>{
    if(!window.MathJax) return;
    try{
      if(window.MathJax.typeset){ window.MathJax.typeset(); fitMath(); }
      else if(window.MathJax.typesetPromise){ window.MathJax.typesetPromise().then(fitMath).catch(()=>{}); }
    }catch(e){ /* ignore */ }
  };

  /* reveal */
  const initReveal = ()=>{
    const targets = $$(".card, .divider");
    if(!targets.length) return;

    if(!prefersNoMotion && "IntersectionObserver" in window){
      const io = new IntersectionObserver((entries)=>{
        for(const e of entries){
          if(e.isIntersecting){ e.target.classList.add("visible"); io.unobserve(e.target); }
        }
      }, {root:null, rootMargin:"0px 0px -12%"});
      targets.forEach(el=>io.observe(el));
    }else{
      const tick = ()=>targets.forEach(el=>inViewport(el) && el.classList.add("visible"));
      const onScroll = ()=>{
        requestAnimationFrame(tick);
      };
      window.addEventListener("scroll", onScroll, {passive:true});
      window.addEventListener("load", tick);
      tick();
    }
  };

  /* equation activation */
  const initEquations = ()=>{
    const eqs = $$(".eq");
    if(!eqs.length) return;

    const activate = el=>{
      if(!el.classList.contains("eq-on")){
        el.classList.add("eq-on");
        setTimeout(typesetSoon, 60);
      }
    };

    if(!prefersNoMotion && "IntersectionObserver" in window){
      const io = new IntersectionObserver((entries)=>{
        for(const e of entries){ if(e.isIntersecting){ activate(e.target); io.unobserve(e.target); } }
      }, {root:null, rootMargin:"0px 0px -10%"});
      eqs.forEach(el=>io.observe(el));
    }else{
      const tick = ()=>eqs.forEach(el=>inViewport(el, 0.94) && activate(el));
      const onScroll = ()=>requestAnimationFrame(tick);
      window.addEventListener("scroll", onScroll, {passive:true});
      window.addEventListener("load", tick);
      tick();
    }
  };

  /* on resize, keep MathJax fitting */
  const onResize = ()=>{
    fitMath();
  };

  /* init */
  document.addEventListener("DOMContentLoaded", ()=>{
    setYear();
    hardenExternal();
    bannerFailover();
    initReveal();
    initEquations();
    typesetSoon();
    window.addEventListener("resize", onResize);
  });
})();
