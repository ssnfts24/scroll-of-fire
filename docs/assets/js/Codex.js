/* ======================================================================
   Scroll of Fire — Codex.js (v2.1)
   Bulletproof banner • hero toolbar • palette • mini-TOC • a11y/perf
   ====================================================================== */
(() => {
  "use strict";

  /* ---------------------------- tiny utilities ---------------------------- */
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const on = (t, e, f, o) => t && t.addEventListener && t.addEventListener(e, f, o);

  const raf = (fn) => (window.requestAnimationFrame || ((f)=>setTimeout(f,16)))(fn);
  const caf = (id) => (window.cancelAnimationFrame || clearTimeout)(id);
  const now = () => (performance && performance.now ? performance.now() : Date.now());

  const store = {
    get(k, d=null){ try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del(k){ try { localStorage.removeItem(k); } catch {} }
  };

  const conn  = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const saveD = !!(conn && conn.saveData);
  const mqReduced = matchMedia("(prefers-reduced-motion: reduce)");
  const prefersReduced = mqReduced && mqReduced.matches;

  const hasIO = "IntersectionObserver" in window;
  const hasRO = "ResizeObserver" in window;

  const UA = navigator.userAgent || "";
  const isMetaApp = /FBAN|FBAV|Facebook|Instagram|FB_IAB|FBAN\/Messenger/i.test(UA);
  const isOffline = () => !navigator.onLine;

  const inViewport = (el, thr = 0.9) => {
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    return r.top < vh * thr && r.bottom > 0;
  };
  const debounce = (fn, ms = 120) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; };
  const throttleRAF = (fn) => { let running=false; return (...a)=>{ if(running) return; running=true; raf(()=>{ running=false; fn(...a); }); }; };

  /* --------------------------- site basics / a11y -------------------------- */
  function setYear(){ const y=$("#yr"); if (y) y.textContent=String(new Date().getFullYear()); }
  function hardenExternal(){
    const hereHost = location.hostname.replace(/^www\./,"");
    $$('a[target="_blank"]').forEach(a=>{
      const rel = new Set((a.getAttribute("rel")||"").toLowerCase().split(/\s+/).filter(Boolean));
      rel.add("noopener"); rel.add("noreferrer");
      try{
        const u=new URL(a.href,location.href);
        if(u.hostname.replace(/^www\./,"")!==hereHost && !a.getAttribute("aria-label")){
          const t=(a.textContent||"").trim(); if(t) a.setAttribute("aria-label",`${t} (opens in new tab)`);
        }
      }catch{}
      a.setAttribute("rel",[...rel].join(" "));
    });
  }

  /* ------------------------------- simple mode ----------------------------- */
  function wireSimpleMode(){
    const c1 = $("#simple");
    const c2 = $("#simple-dup");
    const apply = (on)=>{
      document.body.classList.toggle("simple-on", !!on);
      if (c1 && c1.checked!==on) c1.checked=on;
      if (c2 && c2.checked!==on) c2.checked=on;
      store.set("codex:simple", !!on);
    };
    const saved = store.get("codex:simple", false);
    apply(!!saved);
    [c1,c2].forEach(c=> c && on(c,"change",()=>apply(c.checked)));
  }

  /* -------------------------------- banner --------------------------------- */
  function initBanner(){
    const img = $("#heroBanner");
    const fig = img && img.closest(".hero");
    if(!img || !fig) return;

    const localSrc   = img.getAttribute("data-src-local") || img.getAttribute("src") || "";
    const remoteSrc  = img.getAttribute("data-src-raw")   || "";
    const localSet   = img.getAttribute("data-srcset-local") || "";
    const remoteSet  = img.getAttribute("data-srcset-raw")   || "";
    const sizesAttr  = img.getAttribute("data-sizes") || "(max-width: 600px) 100vw, (max-width: 1100px) 94vw, 1100px";
    const authorFit  = (img.getAttribute("data-fit")||"").toLowerCase(); // ""|"contain"|"cover"
    const prefFit    = store.get("codex:hero-fit", authorFit || "auto");

    setHeroFit(fig, prefFit);

    if (localSet){ img.srcset = localSet; img.sizes = sizesAttr; }
    else if (localSrc){ img.src = localSrc; }

    // hard fallback (silent stalls + errors)
    let timeoutId = setTimeout(()=>{ if (!img.complete || !img.naturalWidth) { if (remoteSrc) img.src = remoteSrc; } }, 4000);
    img.onerror = () => { if (remoteSrc && !img.src.includes(remoteSrc)) img.src = remoteSrc; };
    on(img,"load", ()=> clearTimeout(timeoutId), { once:true });

    img.classList.add("hero-ready");

    const onLoad = () => checkFitAuto(fig, img, prefFit);
    if (img.complete && img.naturalWidth>0) onLoad(); else on(img,"load",onLoad,{once:true});

    if (!remoteSrc || isMetaApp || isOffline() || saveD) {
      wireHeroObservers(fig, img, prefFit);
      buildHeroToolbar(fig, img);
      return;
    }

    const probe = new Image();
    probe.decoding="async"; probe.loading="eager"; probe.referrerPolicy="no-referrer";
    const swap = ()=> {
      if (remoteSet && prefFit!=="contain"){ img.srcset = remoteSet; img.sizes = sizesAttr; void img.currentSrc; }
      else { img.src = remoteSrc; img.removeAttribute("srcset"); img.removeAttribute("sizes"); }
    };
    const safeSwap = ()=> (typeof probe.decode==="function" ? probe.decode().then(swap).catch(swap) : swap());
    on(probe,"load",safeSwap,{once:true});
    on(probe,"error",()=>{/* keep local */},{once:true});
    probe.src = remoteSrc;

    const retryOnce = () => {
      window.removeEventListener("online", retryOnce);
      if (img && remoteSrc && !img.src.includes(remoteSrc)) {
        probe.src = remoteSrc + (remoteSrc.includes("?") ? "&" : "?") + "r=" + Date.now();
      }
    };
    on(window,"online",retryOnce,{once:true});

    wireHeroObservers(fig, img, prefFit);
    buildHeroToolbar(fig, img);
  }

  function setHeroFit(fig, mode){ // "cover" | "contain" | "auto"
    fig.dataset.fit = mode;
    fig.classList.toggle("hero--contain", mode==="contain");
    fig.classList.toggle("hero--cover",   mode==="cover");
    store.set("codex:hero-fit", mode);
  }
  function parseAspect(expr){
    if (!expr) return null;
    const parts = (""+expr).split("/");
    if (parts.length===2){
      const a=+parts[0], b=+parts[1];
      return (a>0 && b>0) ? a/b : null;
    }
    const n = parseFloat(expr);
    return Number.isFinite(n) && n>0 ? n : null;
  }
  function checkFitAuto(fig, img, pref){
    if (pref==="contain" || pref==="cover") return; // user forced
    const natW = img.naturalWidth  || +img.getAttribute("width")  || 0;
    const natH = img.naturalHeight || +img.getAttribute("height") || 0;
    const cssAspect = getComputedStyle(img).getPropertyValue("--hero-aspect").trim() || "16/9";
    const contAspect = parseAspect(cssAspect) || (16/9);
    if (natW>0 && natH>0){
      const imgAspect = natW / natH;
      const diff = Math.abs(imgAspect - contAspect) / contAspect;
      fig.classList.toggle("hero--contain", diff>0.25);
      fig.classList.toggle("hero--cover", diff<=0.25);
      fig.dataset.fit = "auto";
      store.set("codex:hero-fit", "auto");
    }
  }
  function wireHeroObservers(fig, img, pref){
    const reflow = throttleRAF(()=> checkFitAuto(fig, img, pref));
    on(window,"resize",reflow,{passive:true});
    on(window,"orientationchange",reflow,{passive:true});
    if (hasRO){ const ro=new ResizeObserver(reflow); ro.observe(fig); }
  }

  /* ----------------------------- hero toolbar ----------------------------- */
  function buildHeroToolbar(fig){
    if ($(".hero-ui", fig)) return;
    const ui = document.createElement("div");
    ui.className = "hero-ui";
    ui.innerHTML = `
      <button class="hero-btn" data-act="fit">Contain</button>
      <button class="hero-btn" data-act="zoom">Zoom</button>
      <button class="hero-btn" data-act="pulse">Pulse</button>
    `;
    fig.appendChild(ui);

    const bFit   = $('[data-act="fit"]', ui);
    const bZoom  = $('[data-act="zoom"]', ui);
    const bPulse = $('[data-act="pulse"]', ui);

    const updateFitLabel = ()=>{
      const m = fig.dataset.fit || "auto";
      bFit.textContent = (m==="contain" ? "Cover" : "Contain");
    };
    const updatePulseState = ()=>{
      const on = fig.classList.contains("pulse");
      bPulse.textContent = on ? "Pulse: On" : "Pulse: Off";
    };
    updateFitLabel(); updatePulseState();

    on(bFit,"click",()=>{
      const m = fig.dataset.fit || "auto";
      const next = (m==="contain" ? "cover" : "contain");
      setHeroFit(fig, next); updateFitLabel();
    });
    on(bZoom,"click",()=>{
      fig.classList.toggle("is-zoomed");
      bZoom.textContent = fig.classList.contains("is-zoomed") ? "Close" : "Zoom";
      document.documentElement.style.overflow = fig.classList.contains("is-zoomed") ? "hidden" : "";
    });
    on(bPulse,"click",()=>{
      const nowOn = !fig.classList.contains("pulse");
      fig.classList.toggle("pulse", nowOn);
      updatePulseState();
      store.set("codex:hero-pulse", nowOn);
    });

    const pulsePref = store.get("codex:hero-pulse", true);
    fig.classList.toggle("pulse", !!pulsePref); updatePulseState();

    on(document,"keydown",(e)=>{
      if (e.key==="Escape" && fig.classList.contains("is-zoomed")){
        fig.classList.remove("is-zoomed");
        bZoom.textContent="Zoom";
        document.documentElement.style.overflow="";
      }
    });
  }

  /* ------------------------------ MathJax safe ----------------------------- */
  function typesetSoon(delay=80){
    const mj = window.MathJax; if(!mj) return;
    const run = () => {
      try {
        if (mj.typesetClear) mj.typesetClear();
        if (mj.typesetPromise) mj.typesetPromise().catch(()=>{});
        else if (mj.typeset) mj.typeset();
      } catch {}
    };
    if (mj.startup && mj.startup.promise) mj.startup.promise.then(()=>setTimeout(run,delay)).catch(run);
    else setTimeout(run, delay);
  }
  function typesetOnFontsReady(){
    if (!document.fonts || !document.fonts.ready) return;
    document.fonts.ready.then(()=>typesetSoon(50)).catch(()=>{});
  }

  /* ------------------------- reveal-on-scroll cards ------------------------ */
  function revealOnScroll(){
    const cards = $$(".card"); if (!cards.length) return;
    if (!prefersReduced && hasIO){
      const io = new IntersectionObserver((entries)=>{
        for(const e of entries) if(e.isIntersecting){ e.target.classList.add("visible"); io.unobserve(e.target); }
      }, { root:null, rootMargin:"0px 0px -12%", threshold:0.08 });
      cards.forEach(el=>io.observe(el));
    } else {
      const tick = ()=> cards.forEach(el=> inViewport(el) && el.classList.add("visible"));
      const onS = throttleRAF(tick);
      on(window,"scroll",onS,{passive:true}); on(window,"load",tick); tick();
    }
  }

  /* --------------------------- equation activator -------------------------- */
  function activateEquations(){
    const blocks = $$(".eq"); if(!blocks.length) return;
    const act = (el)=>{ if(!el.classList.contains("eq-on")){ el.classList.add("eq-on"); typesetSoon(120); } };
    if (!prefersReduced && hasIO){
      const io = new IntersectionObserver((entries)=>{
        for(const e of entries) if(e.isIntersecting){ act(e.target); io.unobserve(e.target); }
      }, { root:null, rootMargin:"0px 0px -10%", threshold:0.06 });
      blocks.forEach(el=>io.observe(el));
    } else {
      const tick = ()=> blocks.forEach(el=> inViewport(el, .94) && act(el));
      const onS = throttleRAF(tick);
      on(window,"scroll",onS,{passive:true}); on(window,"load",tick); tick();
    }
  }

  /* ------------------------------ card tilt -------------------------------- */
  function tiltCards(){
    if (prefersReduced) return;
    $$(".card").forEach(card=>{
      let rid=0;
      const onMove=(e)=>{
        const r=card.getBoundingClientRect();
        const p = "touches" in e && e.touches.length ? e.touches[0] : e;
        const x=(p.clientX - r.left)/r.width, y=(p.clientY - r.top)/r.height;
        caf(rid); rid=raf(()=>{
          const rx=(0.5-y)*4, ry=(x-0.5)*6;
          card.style.transform=`perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
        });
      };
      const reset=()=>{ card.style.transform=""; };
      on(card,"mousemove",onMove);
      on(card,"mouseleave",reset);
      on(card,"blur",reset,true);
      on(card,"touchstart",reset,{passive:true});
    });
    on(mqReduced,"change",(e)=>{ if(e.matches) $$(".card").forEach(c=> c.style.transform=""); });
  }

  /* ------------------------------- back to top ----------------------------- */
  function backToTop(){
    let btn = $(".to-top");
    if (!btn){
      btn = document.createElement("button");
      btn.className="to-top"; btn.type="button"; btn.textContent="↑ Top";
      document.body.appendChild(btn);
    }
    on(btn, "click", ()=> window.scrollTo({top:0, behavior:"smooth"}));
    const reveal = throttleRAF(()=>{
      const y = window.scrollY || document.documentElement.scrollTop;
      btn.classList.toggle("show", y > 600);
    });
    on(window,"scroll",reveal,{passive:true}); reveal();
  }

  /* ------------------------------- mini TOC -------------------------------- */
  function miniTOCHighlight(){
    const links = $$(".mini-toc a[href^='#']");
    if (!links.length || !hasIO) return;
    const map = new Map();
    links.forEach(a=>{
      const id = a.getAttribute("href").slice(1);
      const el = id && document.getElementById(id);
      if (el) map.set(el, a);
    });
    const activeClass = "active";
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{
        const a = map.get(e.target); if (!a) return;
        if (e.isIntersecting) {
          links.forEach(l=>l.classList.remove(activeClass));
          a.classList.add(activeClass);
        }
      });
    }, { rootMargin:"-30% 0px -60% 0px", threshold: [0, 1e-4, 0.1] });
    map.forEach((_, el)=> io.observe(el));
  }

  /* ----------------------------- command palette --------------------------- */
  function palette(){
    let shell = $(".palette");
    if (!shell){
      shell = document.createElement("div");
      shell.className="palette";
      shell.innerHTML = `
        <div class="panel" role="dialog" aria-modal="true" aria-label="Command palette">
          <input type="search" placeholder="Jump to… (type to filter, ↑/↓, Enter)" aria-label="Filter commands" />
          <ul></ul>
        </div>`;
      document.body.appendChild(shell);
    }
    const input = $("input", shell);
    const list  = $("ul", shell);

    // static list of items from headings + a few quick links
    const items = [];
    $$("main h2[id], main h3[id]").forEach(h=>{
      items.push({label:h.textContent.trim(), href:"#"+h.id});
    });
    $$(".list a[href]").slice(0,10).forEach(a=>{
      items.push({label:(a.textContent||a.href).trim(), href:a.href});
    });

    // render once, then filter in-place (avoid rebinding handlers repeatedly)
    let view = []; let idx = 0;
    const setSel=(n)=>{
      idx=Math.max(0, Math.min(n, list.children.length-1));
      [...list.children].forEach((li,i)=> li.classList.toggle("sel", i===idx));
    };
    const go=()=>{
      const li=list.children[idx]; if(!li) return;
      const it=view[+li.dataset.i]; close();
      if (it.href.startsWith("#")){
        const el=document.getElementById(it.href.slice(1));
        if(el){ el.scrollIntoView({behavior:"smooth", block:"start"}); el.setAttribute("tabindex","-1"); el.focus({preventScroll:true}); }
      } else { location.href = it.href; }
    };
    const render = (q)=>{
      const qq = q.toLowerCase().trim();
      view = items.filter(it => !qq || it.label.toLowerCase().includes(qq)).slice(0, 30);
      list.innerHTML = view.map((it,i)=>`<li data-i="${i}" tabindex="0">${it.label}</li>`).join("");
      setSel(0);
    };

    const open = ()=>{
      shell.classList.add("open");
      input.value=""; render(""); setTimeout(()=>input.focus(), 20);
      document.documentElement.style.overflow="hidden";
    };
    const close = ()=>{
      shell.classList.remove("open");
      document.documentElement.style.overflow="";
      input.blur();
    };

    // bind once
    on(list, "click", (e)=>{ const li=e.target.closest("li"); if(li){ idx=[...list.children].indexOf(li); go(); } });
    on(input, "keydown", (e)=>{
      if (e.key==="ArrowDown"){ e.preventDefault(); setSel(idx+1); }
      else if (e.key==="ArrowUp"){ e.preventDefault(); setSel(idx-1); }
      else if (e.key==="Enter"){ e.preventDefault(); go(); }
      else if (e.key==="Escape"){ e.preventDefault(); close(); }
    });
    on(input, "input", ()=> render(input.value));
    on(document, "keydown", (e)=>{
      const meta = e.ctrlKey || e.metaKey;
      if (meta && (e.key==="k" || e.key==="K")){ e.preventDefault(); shell.classList.contains("open") ? close() : open(); }
      if (e.key==="Escape" && shell.classList.contains("open")){ close(); }
    });
    on(shell, "click", (e)=>{ if (e.target === shell) close(); });

    // initial build
    render("");
  }

  /* ------------------------------ anchor focus ----------------------------- */
  function focusAnchors(){
    on(document, "click", (ev)=>{
      const a = ev.target && ev.target.closest && ev.target.closest("a[href^='#']");
      if (!a) return;
      const id = a.getAttribute("href").slice(1);
      const tgt = id && document.getElementById(id);
      if (tgt){ if(!tgt.hasAttribute("tabindex")) tgt.setAttribute("tabindex","-1"); tgt.focus({preventScroll:true}); }
    });
  }

  /* --------------------------- visibility hygiene -------------------------- */
  function visibilityFixes(){
    on(document, "visibilitychange", ()=>{
      if (document.visibilityState === "visible") {
        typesetSoon(80);
        const img=$("#heroBanner"), fig=img && img.closest(".hero");
        if (img && fig) checkFitAuto(fig, img, fig.dataset.fit||"auto");
      }
    });
    on(window,"pageshow",(e)=>{
      if (e && e.persisted){ setYear(); initBanner(); typesetSoon(100); }
    });
  }

  /* --------------------------------- boot ---------------------------------- */
  function boot(){
    setYear();
    hardenExternal();
    wireSimpleMode();
    initBanner();
    revealOnScroll();
    activateEquations();
    tiltCards();
    typesetSoon(250);
    typesetOnFontsReady();
    focusAnchors();
    backToTop();
    miniTOCHighlight();
    palette();
    visibilityFixes();
  }
  on(document,"DOMContentLoaded",boot);

  // Keep MathJax tidy on resizes (and when RO is absent)
  if (hasRO){
    const ro = new ResizeObserver(debounce(()=>typesetSoon(120),120));
    $$(".eq").forEach(el=> ro.observe(el));
  } else {
    on(window,"resize", debounce(()=>typesetSoon(120),200), {passive:true});
  }

  // Opt-in telemetry
  function log(m){ if (window.SOFTelemetry) console.log("[Codex.js]", m); }
  log("ready @ " + Math.round(now()) + "ms");
})();
