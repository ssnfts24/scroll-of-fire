<script>
/* ======================================================================
   Scroll of Fire — Codex.js (v2.4)
   Bulletproof banner • hero toolbar (new+legacy) • tabs ink • palette • TOC
   Echo View • HUD toggle • on-page search • equation pop-out
   - Robust hero detection & failover (local→remote), auto-fit & persistence
   - Motion-safe equation activation + resize tidy
   - Deferred heavy features (palette / mini-TOC) on idle
   - Accessibility hardening, reduced-data/motion guards
   - Matches index.html + codex.css (2025-10-20)
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
  const ri = (fn, timeout=800) => {
    const ric = window.requestIdleCallback;
    return ric ? ric(fn, { timeout }) : setTimeout(fn, Math.min(timeout, 600));
  };
  const debounce = (fn, ms = 120) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; };
  const throttleRAF = (fn) => { let running=false; return (...a)=>{ if(running) return; running=true; raf(()=>{ running=false; fn(...a); }); }; };

  const store = {
    get(k, d=null){ try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del(k){ try { localStorage.removeItem(k); } catch {} }
  };

  const conn  = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const saveD = !!(conn && conn.saveData);
  const mqReduced = matchMedia("(prefers-reduced-motion: reduce)");
  const prefersReduced = !!(mqReduced && mqReduced.matches);

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

  const log = (m)=>{ if (window.SOFTelemetry) console.log("[Codex.js]", m); };

  /* --------------------------- site basics / a11y -------------------------- */
  function setYear(){
    const y = $("#y") || $("#yr");
    if (y) y.textContent = String(new Date().getFullYear());
  }

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
    const apply = (onFlag)=>{
      document.body.classList.toggle("simple-on", !!onFlag);
      if (c1 && c1.checked!==onFlag) c1.checked=onFlag;
      if (c2 && c2.checked!==onFlag) c2.checked=onFlag;
      store.set("codex:simple", !!onFlag);
    };
    const saved = store.get("codex:simple", false);
    apply(!!saved);
    [c1,c2].forEach(c=> c && on(c,"change",()=>apply(c.checked)));
    const btn = $("#toggleSimple");
    btn && on(btn,"click",()=> apply(!document.body.classList.contains("simple-on")));
  }

  /* ------------------------------ HUD toggle ------------------------------- */
  function wireHUD(){
    const btn = $("#toggleGrid");
    if (!btn) return;
    on(btn,"click", ()=>{
      const onFlag = document.body.classList.toggle("bg-grid-heavy");
      btn.setAttribute("aria-pressed", String(onFlag));
    });
  }

  /* ------------------------------ on-page search ---------------------------- */
  function wirePageSearch(){
    const box = $("#site-search");
    if (!box) return;
    let lastValidity = "";
    on(box,"input", ()=>{ if (lastValidity) { box.setCustomValidity(""); lastValidity=""; } });
    on(box,"keydown", (e)=>{
      if (e.key !== "Enter") return;
      const q = box.value.trim().toLowerCase(); if(!q) return;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      let node, found=false;
      while(node = walker.nextNode()){
        const pe = node.parentElement;
        if (!pe || pe.closest('header,nav,style,script,button,input,textarea,.palette,[aria-hidden="true"]')) continue;
        const s = node.nodeValue.toLowerCase();
        const i = s.indexOf(q);
        if (i >= 0){
          const range = document.createRange();
          range.setStart(node, i); range.setEnd(node, i+q.length);
          const rect = range.getBoundingClientRect();
          window.scrollBy({ top: rect.top - 120, behavior:(prefersReduced?'auto':'smooth') });
          found=true; break;
        }
      }
      if (!found){ box.setCustomValidity("Not found"); box.reportValidity(); lastValidity="nf"; }
    });
    // quick shortcut: "/" to focus search
    on(window,"keydown",(e)=>{
      if (e.key === "/" && !/input|textarea/i.test(document.activeElement.tagName) && !e.metaKey && !e.ctrlKey){
        e.preventDefault(); box.focus();
      }
    });
  }

  /* ------------------------------ hero helpers ----------------------------- */
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
    if (pref==="contain" || pref==="cover") return; // user-forced
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

  function findHeroElements(){
    let img = $("#heroBanner");
    let fig = img && img.closest(".hero");
    if (!fig) fig = $("#hero") || $(".hero");
    if (!img && fig) img = $("img", fig);
    if (!img) img = $(".hero img");
    return { fig, img };
  }

  /* -------------------------------- banner --------------------------------- */
  function initBanner(){
    const { fig, img } = findHeroElements();
    if(!img || !fig){ log("hero not found; will retry on load"); on(window,"load",()=>{ const h=findHeroElements(); if(h.img && h.fig) initBanner(); }); return; }

    const localSrc  = img.getAttribute("data-src-local") || img.getAttribute("src") || "";
    const remoteSrc = img.getAttribute("data-src-raw")   || "";
    const localSet  = img.getAttribute("data-srcset-local") || "";
    const remoteSet = img.getAttribute("data-srcset-raw")   || "";
    const sizesAttr = img.getAttribute("data-sizes") || "(max-width: 600px) 100vw, (max-width: 1100px) 94vw, 1100px";
    const authorFit = (img.getAttribute("data-fit")||"").toLowerCase();
    const prefFit   = store.get("codex:hero-fit", authorFit || "auto");

    setHeroFit(fig, prefFit);

    if (localSet){ img.srcset = localSet; img.sizes = sizesAttr; }
    else if (localSrc){ img.src = localSrc; }

    let swapped = false;
    const tryRemote = ()=>{
      if (swapped) return;
      if (remoteSrc) {
        swapped = true;
        img.removeAttribute("srcset");
        img.removeAttribute("sizes");
        img.src = remoteSrc;
        log("hero swapped to remote");
      }
    };
    let stallId = setTimeout(()=>{ if (!img.complete || !img.naturalWidth) tryRemote(); }, 4000);
    img.onerror = () => tryRemote();
    on(img,"load", ()=> clearTimeout(stallId), { once:true });

    const onLoad = () => checkFitAuto(fig, img, prefFit);
    if (img.complete && img.naturalWidth>0) onLoad(); else on(img,"load",onLoad,{once:true});

    if (!remoteSrc || isMetaApp || isOffline() || saveD) {
      wireHeroObservers(fig, img, prefFit);
      wireHeroToolbar(fig);
      return;
    }

    const probe = new Image();
    probe.decoding="async"; probe.loading="eager"; probe.referrerPolicy="no-referrer";
    const swapSrc = ()=> {
      if (remoteSet && (store.get("codex:hero-fit","auto")!=="contain")){
        img.srcset = remoteSet; img.sizes = sizesAttr; void img.currentSrc;
      } else {
        img.src = remoteSrc; img.removeAttribute("srcset"); img.removeAttribute("sizes");
      }
    };
    const safeSwap = ()=> (typeof probe.decode==="function" ? probe.decode().then(swapSrc).catch(swapSrc) : swapSrc());
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
    wireHeroToolbar(fig);
  }

  /* ----------------------------- hero toolbar ----------------------------- */
  function wireHeroToolbar(fig){
    const legacy = $(".hero-ui", fig);
    if (legacy){
      const bContain = $("#fitContain");
      const bCover   = $("#fitCover");
      const bPulse   = $("#btnTogglePulse");
      const bZoom    = $("#btnZoom");

      const mode = store.get("codex:hero-fit", fig.dataset.fit || "auto");
      setHeroFit(fig, mode);

      bContain && on(bContain,"click",()=>{ setHeroFit(fig,"contain"); bContain.setAttribute("aria-pressed","true"); bCover && bCover.setAttribute("aria-pressed","false"); });
      bCover   && on(bCover,"click",  ()=>{ setHeroFit(fig,"cover");   bCover.setAttribute("aria-pressed","true");   bContain && bContain.setAttribute("aria-pressed","false"); });
      bPulse   && on(bPulse,"click",  (e)=>{ const onNow = !fig.classList.contains("pulse"); fig.classList.toggle("pulse", onNow); e.currentTarget.setAttribute("aria-pressed",String(onNow)); store.set("codex:hero-pulse", onNow); });
      bZoom    && on(bZoom,"click",   (e)=>{ const onNow = fig.classList.toggle("is-zoomed"); e.currentTarget.setAttribute("aria-expanded",String(onNow)); document.documentElement.style.overflow = onNow ? "hidden" : ""; });

      const pulsePref = store.get("codex:hero-pulse", !saveD && !isMetaApp);
      fig.classList.toggle("pulse", !!pulsePref);
      bPulse && bPulse.setAttribute("aria-pressed", String(!!pulsePref));
      return;
    }

    // lightweight v2 toolbar
    const ui = document.createElement("div");
    ui.className = "hero-ui";
    ui.setAttribute("role","toolbar");
    ui.setAttribute("aria-label","Banner controls");
    ui.innerHTML = `
      <button class="hero-btn" data-act="fit" aria-pressed="false" title="Toggle fit">Contain</button>
      <button class="hero-btn" data-act="zoom" title="View full screen">Zoom</button>
      <button class="hero-btn" data-act="pulse" title="Toggle pulse">Pulse</button>
    `;
    fig.appendChild(ui);

    const bFit   = $('[data-act="fit"]', ui);
    const bZoom  = $('[data-act="zoom"]', ui);
    const bPulse = $('[data-act="pulse"]', ui);

    const updateFitLabel = ()=>{
      const m = fig.dataset.fit || "auto";
      bFit.textContent = (m==="contain" ? "Cover" : "Contain");
      bFit.setAttribute("aria-pressed", String(m==="contain"));
    };
    const updatePulseState = ()=>{
      const on = fig.classList.contains("pulse");
      bPulse.textContent = on ? "Pulse: On" : "Pulse: Off";
      bPulse.setAttribute("aria-pressed", String(on));
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
      if (!fig.classList.contains("is-zoomed")) bZoom.focus();
    });
    on(bPulse,"click",()=>{
      const nowOn = !fig.classList.contains("pulse");
      fig.classList.toggle("pulse", nowOn);
      updatePulseState();
      store.set("codex:hero-pulse", nowOn);
    });

    const pulsePref = store.get("codex:hero-pulse", !saveD && !isMetaApp);
    fig.classList.toggle("pulse", !!pulsePref);
    updatePulseState();

    on(document,"keydown",(e)=>{
      if (e.key==="Escape" && fig.classList.contains("is-zoomed")){
        fig.classList.remove("is-zoomed");
        bZoom.textContent="Zoom";
        document.documentElement.style.overflow="";
        bZoom.focus();
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

  /* --------------------------- equation pop-out UX ------------------------- */
  function wireEqExpand(scope=document){
    $$("[data-eq-expand]", scope).forEach(btn=>{
      on(btn,"click", ()=>{
        const eq = btn.closest(".card")?.querySelector(".eq");
        if(!eq) return;
        const clone = eq.cloneNode(true);
        clone.classList.add("eq--expanded");
        const close = document.createElement("button");
        close.className = "eq-close"; close.type = "button"; close.textContent = "Close";
        on(close,"click", ()=> clone.remove());
        clone.appendChild(close);
        document.body.appendChild(clone);
        typesetSoon(40);
      });
    });
  }

  /* ------------------------------ card tilt -------------------------------- */
  function tiltCards(){
    if (prefersReduced) return;
    $$(".card").forEach(card=>{
      let rid=0;
      const onMove=(e)=>{
        const r=card.getBoundingClientRect();
        const p = "touches" in e && e.touches && e.touches.length ? e.touches[0] : e;
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
      btn.setAttribute("aria-label","Back to top");
      document.body.appendChild(btn);
    }
    on(btn, "click", ()=> window.scrollTo({top:0, behavior:(prefersReduced?'auto':'smooth')}));
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
          <input id="palInput" type="search" placeholder="Jump to… (type to filter, ↑/↓, Enter)" aria-label="Filter commands" />
          <ul id="palList"></ul>
        </div>`;
      document.body.appendChild(shell);
    }
    const input = $("#palInput", shell);
    const list  = $("#palList", shell);

    const items = [];
    $$("main h2[id], main h3[id]").forEach(h=>{
      const label = (h.textContent||"").trim();
      if (label) items.push({label, href:"#"+h.id});
    });
    $$(".list a[href]").slice(0,10).forEach(a=>{
      items.push({label:((a.textContent||a.href)||"").trim(), href:a.href});
    });

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
        if(el){ el.scrollIntoView({behavior:(prefersReduced?'auto':'smooth'), block:"start"}); el.setAttribute("tabindex","-1"); el.focus({preventScroll:true}); }
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

    // button hook
    on($("#openPalette"),"click", open);
    // list + keys
    on(list, "click", (e)=>{ const li=e.target.closest("li"); if(li){ idx=[...list.children].indexOf(li); go(); } });
    on(input, "keydown", (e)=>{
      if (e.key==="ArrowDown"){ e.preventDefault(); setSel(idx+1); }
      else if (e.key==="ArrowUp"){ e.preventDefault(); setSel(idx-1); }
      else if (e.key==="Enter"){ e.preventDefault(); go(); }
      else if (e.key==="Escape"){ e.preventDefault(); close(); }
    });
    on(document, "keydown", (e)=>{
      const meta = e.ctrlKey || e.metaKey;
      if (meta && (e.key==="k" || e.key==="K")){ e.preventDefault(); shell.classList.contains("open") ? close() : open(); }
      if (e.key==="Escape" && shell.classList.contains("open")){ close(); }
    });
    on(shell, "click", (e)=>{ if (e.target === shell) close(); });

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

  /* ------------------------------ tabs ink bar ----------------------------- */
  function wirePrimaryTabs(){
    const tabs = $(".tabs");
    if (!tabs) return;
    const ink = tabs.querySelector(".tab-ink") || (()=> {
      const span = document.createElement("span"); span.className="tab-ink"; tabs.appendChild(span); return span;
    })();

    function setInk(el){
      if (!el) return;
      const r = el.getBoundingClientRect();
      const pr = tabs.getBoundingClientRect();
      const x = r.left - pr.left;
      ink.style.setProperty("--ink-x", x + "px");
      ink.style.setProperty("--ink-w", r.width + "px");
      tabs.querySelectorAll(".tab").forEach(a=>a.removeAttribute("aria-current"));
      el.setAttribute("aria-current","page");
    }

    tabs.querySelectorAll(".tab").forEach(a=>{
      on(a, "click", (e)=>{
        const href = a.getAttribute("href")||"#";
        if (href.startsWith("#")){
          e.preventDefault();
          const target = document.querySelector(href);
          target && target.scrollIntoView({behavior:(prefersReduced?'auto':'smooth')});
        }
        setInk(a);
      });
    });

    const start = (location.hash && tabs.querySelector(`.tab[href='${location.hash}']`)) || tabs.querySelector(".tab");
    setInk(start);

    const align = ()=> setInk(tabs.querySelector('.tab[aria-current="page"]') || tabs.querySelector('.tab'));
    on(window,"resize", throttleRAF(align), {passive:true});
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(align).catch(()=>{});
  }

  /* --------------------------- visibility hygiene -------------------------- */
  function visibilityFixes(){
    on(document, "visibilitychange", ()=>{
      if (document.visibilityState === "visible") {
        typesetSoon(80);
        const h=findHeroElements(); if (h.img && h.fig) checkFitAuto(h.fig, h.img, h.fig.dataset.fit||"auto");
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
    wireHUD();
    wirePageSearch();
    initBanner();
    revealOnScroll();
    activateEquations();
    wireEqExpand();
    tiltCards();
    typesetSoon(250);
    typesetOnFontsReady();
    focusAnchors();
    wirePrimaryTabs();
    backToTop();
    ri(()=>{ miniTOCHighlight(); palette(); });
    visibilityFixes();
  }
  on(document,"DOMContentLoaded",boot);

  // Keep MathJax tidy on resizes (and when RO is absent)
  if (hasRO){
    const ro = new ResizeObserver(debounce(()=>typesetSoon(120),120));
    on(document,"DOMContentLoaded",()=> $$(".eq").forEach(el=> ro.observe(el)));
  } else {
    on(window,"resize", debounce(()=>typesetSoon(120),200), {passive:true});
  }

  log("ready @ " + Math.round(now()) + "ms");
})();
</script>
