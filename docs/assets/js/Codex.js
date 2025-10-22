<script>
/* ==========================================================================
   Scroll of Fire — codex.js v3.4 (consolidated)
   - Sticky header, tab ink
   - Card + .reveal IO
   - Hero activation + safe parallax
   - Carrier cycler + Lights toggle + Year
   - Simple mode, HUD toggle, Affect toggle
   - Explore Dock IO
   - Page search mini-suggest + '/' (skips if v2 present)
   - Command palette shell
   - Equation FX builder (DOM) + drag-scroll + pop-out
   - MathJax: on-demand typeset (robust)
   - Alive Pack (sparks, arcs, sheen/float/twinkle)
   - Alive Palette (Calm/Lively/Max/Off) with persistence
   - Ξ driver (updates --xi)
   ========================================================================== */
(() => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  document.documentElement.classList.add('js-ready');

  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const RD = matchMedia('(prefers-reduced-data: reduce)').matches;
  const ALLOW_MOTION = !(RM || RD);

  // Year stamp
  const y = $('#y'); if (y) y.textContent = new Date().getFullYear();

  // Detect if search v2 (inline-initialized) exists so we don’t double-bind
  const SEARCH_V2 = (() => {
    const s = document.getElementById('site-suggest');
    return !!(s && s.getAttribute('role') === 'listbox');
  })();

  /* ---- Sticky header ---- */
  const header = $('header.site');
  const stick = () => header?.classList.toggle('is-stuck', scrollY > 6);
  stick(); addEventListener('scroll', stick, { passive:true });

  /* ---- Tabs ink ---- */
  const tabs = $('.tabs'); const ink = $('.tabs .tab-ink');
  const setInk = (el) => {
    if (!tabs || !ink || !el) return;
    const tb = tabs.getBoundingClientRect();
    const eb = el.getBoundingClientRect();
    const x = Math.max(0, eb.left - tb.left);
    const w = Math.max(8, eb.width);
    ink.style.setProperty('--ink-x', `${x}px`);
    ink.style.setProperty('--ink-w', `${w}px`);
  };
  const activeTab = () => {
    const all = $$('.tabs .tab');
    return all.find(a => a.getAttribute('aria-current') === 'page')
        || all.find(a => a.getAttribute('href') === location.hash)
        || all[0];
  };
  const initInk = () => {
    let raf;
    const cue = (el) => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setInk(el)); };
    cue(activeTab());
    $$('.tabs .tab').forEach(a=>{
      a.addEventListener('mouseenter', ()=>cue(a));
      a.addEventListener('focus',     ()=>cue(a));
    });
    ['resize','hashchange'].forEach(ev => addEventListener(ev, ()=>cue(activeTab())));
    tabs?.addEventListener('mouseleave', ()=>cue(activeTab()));
  };
  initInk();

  /* ---- Card + .reveal IO ---- */
  const reveal = () => {
    const nodes = $$('.card, .reveal');
    if (!('IntersectionObserver' in window) || !ALLOW_MOTION) { nodes.forEach(c=>c.classList.add('visible','in')); return; }
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible','in'); io.unobserve(e.target); }
    }), { rootMargin:'80px 0px' });
    nodes.forEach(c=>io.observe(c));
  }; reveal();

  /* ---- Hero activation + safe parallax ---- */
  const hero = $('#hero'); const heroImg = $('#heroBanner');
  if (hero) {
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(es => hero.classList.toggle('is-active', es.some(e=>e.isIntersecting)), {rootMargin:'200px 0px'});
      io.observe(hero);
    } else hero.classList.add('is-active');
    if (ALLOW_MOTION) {
      let pz = 1;
      const onScroll = () => {
        const r = hero.getBoundingClientRect(); const vh = innerHeight || 800;
        const mid = r.top + r.height/2; const dist = Math.abs((vh/2)-mid)/(vh/2);
        pz = 1 + 0.02*(1 - Math.min(1, Math.max(0, dist)));
        heroImg && (heroImg.style.transform = `translateZ(0) scale(${pz})`);
      };
      addEventListener('scroll', onScroll, {passive:true}); onScroll();
    }
  }

  /* ---- Carrier cycler + Lights toggle ---- */
  (function carriers(){
    const html = document.documentElement;
    const btn  = $('#cycleCarrier');
    const lights = $('#heroLights');
    const btnLights = $('#toggleLights');

    const skinsAttr = (html.getAttribute('data-carriers') || '')
      .split(',').map(s=>s.trim()).filter(Boolean);
    const skins = (skinsAttr.length ? skinsAttr : ['432','528','369','144','963'])
      .map(n=>`carrier-${n}`);

    const curSkin = ()=> skins.find(s=>html.classList.contains(s)) || skins[0];
    const nextSkin= c=> skins[(skins.indexOf(c)+1)%skins.length];

    if (btn){
      if (!curSkin()) html.classList.add(skins[0]);
      btn.textContent = `Carrier ${curSkin().split('-')[1]}`;
      btn.addEventListener('click', ()=>{
        const cur=curSkin(), nxt=nextSkin(cur); skins.forEach(s=>html.classList.remove(s)); html.classList.add(nxt);
        btn.textContent = `Carrier ${nxt.split('-')[1]}`;
      });
    }
    btnLights?.addEventListener('click', ()=>{
      if (!lights) return;
      const off = lights.classList.toggle('off');
      btnLights.setAttribute('aria-pressed', String(!off));
    });
  })();

  /* ---- Simple/Echo mode ---- */
  const setSimple = on => { document.body.classList.toggle('simple-on', !!on); $('#toggleSimple')?.setAttribute('aria-pressed', on?'true':'false'); };
  $('#simple')?.addEventListener('change', e => setSimple(e.currentTarget.checked));
  $('#toggleSimple')?.addEventListener('click', () => setSimple(!document.body.classList.contains('simple-on')));

  /* ---- HUD ---- */
  const laser = $('.laser-grid');
  const setHUD = on => { if (!laser) return; laser.style.display = on? '' : 'none'; $('#toggleGrid')?.setAttribute('aria-pressed', on?'true':'false'); };
  setHUD(!!laser); $('#toggleGrid')?.addEventListener('click', ()=> setHUD(laser && laser.style.display==='none'));

  /* ---- Affect (toolbar button) ---- */
  const btnAffect = $('#toggleAffect');
  const setAffect = on => {
    document.body.classList.toggle('affect-off', !on);
    btnAffect?.setAttribute('aria-pressed', on?'true':'false');
  };
  setAffect(!document.body.classList.contains('affect-off'));
  btnAffect?.addEventListener('click', () => setAffect(document.body.classList.contains('affect-off')));

  /* ---- Back to top (supports .to-top and #toTop) ---- */
  const toTop = $('#toTop') || $('.to-top');
  const topBtn = () => toTop?.classList.toggle('show', scrollY>400);
  topBtn(); addEventListener('scroll', topBtn, { passive:true });
  toTop?.addEventListener('click', ()=> scrollTo({ top:0, behavior: ALLOW_MOTION ? 'smooth' : 'auto' }));

  /* ---- Explore Dock IO (hide near hero; hide after #explore in view) ---- */
  (function exploreDockIO(){
    const dock = $('#exploreDock'); const hero = $('#hero'); const explore = $('#explore');
    if(!dock || !hero || !explore || !('IntersectionObserver' in window)) return;
    let heroOut=false, pastExplore=false;
    const ioHero = new IntersectionObserver(([e])=>{ heroOut = !e.isIntersecting; update(); }, {threshold:0.01});
    const ioExplore = new IntersectionObserver(([e])=>{ pastExplore = e.isIntersecting; update(); }, {threshold:0.05});
    function update(){ dock.classList.toggle('show', heroOut && !pastExplore); }
    ioHero.observe(hero); ioExplore.observe(explore);
  })();

  /* ---- Page search mini-suggest + '/' (skip if v2 exists) ---- */
  if (!SEARCH_V2) {
    const siteSearch = $('#site-search'); const siteSuggest = $('#site-suggest');
    const CAND = $$('h1[id],h2[id],h3[id],section[id],article[id],.eq-card[id]');
    const suggest = (q) => {
      if (!siteSuggest) return;
      siteSuggest.innerHTML = '';
      q = (q||'').trim().toLowerCase();
      if (!q) { siteSuggest.classList.add('hidden'); return; }
      const results = [
        ...CAND.filter(el => (el.innerText||'').toLowerCase().includes(q)).map(el => ({text:(el.innerText||'').trim(), href:'#'+el.id})),
        ...$$('a[href^="#"]').filter(a => (a.textContent||'').toLowerCase().includes(q)).map(a => ({text:a.textContent.trim(), href:a.getAttribute('href')}))
      ].slice(0,12);
      results.forEach(r => { const a=document.createElement('a'); a.href=r.href; a.textContent=r.text; a.addEventListener('click',()=>siteSuggest.classList.add('hidden')); siteSuggest.appendChild(a);});
      siteSuggest.classList.toggle('hidden', results.length===0);
    };
    siteSearch?.addEventListener('input', e => suggest(e.currentTarget.value));
    siteSearch?.addEventListener('focus', e => suggest(e.currentTarget.value));
    document.addEventListener('click', e => { if (!siteSuggest) return; if (e.target!==siteSearch && !siteSuggest.contains(e.target)) siteSuggest.classList.add('hidden'); });
    document.addEventListener('keydown', e => {
      if (e.key==='/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag=(document.activeElement?.tagName||'').toLowerCase(); if (tag!=='input' && tag!=='textarea'){ e.preventDefault(); siteSearch?.focus(); }
      }
    });
  }

  /* ---- Command palette shell ---- */
  const palette = $('#palette'); const palInput = $('#palInput'); const palList = $('#palList');
  const togglePalette = (open) => { if (!palette) return; palette.classList.toggle('open', !!open); open ? palInput?.focus() : palInput?.blur(); if (open) build(''); };
  const rows = [
    { label:'Go: Theory', href:'theory.html' },
    { label:'Go: Manifest', href:'teach.html' },
    { label:'Toggle Echo View', action:() => $('#toggleSimple')?.click() },
    { label:'Toggle HUD', action:() => $('#toggleGrid')?.click() },
    { label:'Back to Top', action:() => toTop?.click() },
    { label:'Jump: Explore', href:'#explore' },
    { label:'Jump: Canon', href:'#canon' },
  ];
  function build(q){
    if (!palList) return;
    palList.innerHTML='';
    q=(q||'').toLowerCase();
    rows.filter(r=>!q || r.label.toLowerCase().includes(q)).forEach((r,i)=>{
      const li=document.createElement('li'); li.textContent=r.label; if(i===0) li.classList.add('sel');
      li.addEventListener('click', ()=>{ r.href? location.href=r.href : r.action?.(); togglePalette(false); });
      palList.appendChild(li);
    });
  }
  $('#openPalette')?.addEventListener('click', ()=> togglePalette(true));
  document.addEventListener('keydown', e => {
    if ((e.key.toLowerCase()==='k') && (e.metaKey||e.ctrlKey)) { e.preventDefault(); togglePalette(true); }
    if (e.key==='Escape' && palette?.classList.contains('open')) togglePalette(false);
  });
  palette?.addEventListener('click', e => { if (e.target===palette) togglePalette(false); });

  /* ---- Equation FX DOM builder (matches CSS data-fx recipes) ---- */
  (function eqFX(){
    if (!ALLOW_MOTION) return;
    const boxes = $$('.eq');
    const variants = ['beams','orbit','spiral','nebula','rays','combo'];
    let vix = 0;

    boxes.forEach((wrap)=>{
      // Ensure fx layer exists
      let fx = wrap.querySelector('.fx-layer');
      if(!fx){ fx = document.createElement('div'); fx.className='fx-layer'; wrap.prepend(fx); }

      // Variant (respect data-fx, otherwise rotate; "calm" handled by CSS)
      const declared = wrap.getAttribute('data-fx');
      const chosen = declared && declared!=='combo' ? declared : variants[(vix++) % variants.length];
      const actual = (declared==='combo' || (!declared && Math.random()<0.28)) ? 'combo' : chosen;
      wrap.setAttribute('data-fx', actual);

      // Speeds
      wrap.style.setProperty('--beam-speed',       (22 + Math.random()*10).toFixed(2)+'s');
      wrap.style.setProperty('--beam-speed-alt',   (26 + Math.random()*12).toFixed(2)+'s');
      wrap.style.setProperty('--orbit-speed',      (30 + Math.random()*14).toFixed(2)+'s');
      wrap.style.setProperty('--spiral-speed',     (34 + Math.random()*16).toFixed(2)+'s');
      wrap.style.setProperty('--spiral-speed-alt', (38 + Math.random()*18).toFixed(2)+'s');
      wrap.style.setProperty('--rays-speed',       (36 + Math.random()*16).toFixed(2)+'s');

      // Element makers
      function addBeams(n=2+Math.floor(Math.random()*3)){
        for(let i=0;i<n;i++){
          const d=document.createElement('div');
          d.className='beam'+(Math.random()<0.45?' alt':'');
          d.style.setProperty('--d', `${(Math.random()*9).toFixed(2)}s`);
          const tilt = (Math.random()<0.5?1:-1)*(8+Math.random()*12);
          d.style.transform = `translateX(0) rotate(${tilt}deg)`;
          fx.appendChild(d);
        }
      }
      function addOrbit(){
        const o1=document.createElement('div'); o1.className='orbit';
        o1.style.setProperty('--tilt', `${(8+Math.random()*14)*(Math.random()<.5?-1:1)}deg`);
        const o2=document.createElement('div'); o2.className='orbit counter';
        o2.style.setProperty('--tilt', `${(10+Math.random()*12)*(Math.random()<.5?-1:1)}deg`);
        const b1=document.createElement('div'); b1.className='orb';
        const b2=document.createElement('div'); b2.className='orb gold';
        o1.appendChild(b1); o2.appendChild(b2); fx.append(o1,o2);
      }
      function addSpiral(){
        const s=document.createElement('div'); s.className='spiral'; fx.appendChild(s);
        if(Math.random()<.55){ const a=document.createElement('div'); a.className='spiral alt'; fx.appendChild(a); }
      }
      function addNebula(){ const n=document.createElement('div'); n.className='nebula'; fx.appendChild(n); }
      function addRays(){
        const r=document.createElement('div'); r.className='rays'; fx.appendChild(r);
        const d=document.createElement('div'); d.className='dust'; fx.appendChild(d);
        const f=document.createElement('div'); f.className='flare'; fx.appendChild(f);
      }

      // Populate
      if(actual==='beams'){ addBeams(); }
      else if(actual==='orbit'){ addOrbit(); }
      else if(actual==='spiral'){ addSpiral(); }
      else if(actual==='nebula'){ addNebula(); }
      else if(actual==='rays'){ addRays(); }
      else { addBeams(); addOrbit(); if(Math.random()<.7) addSpiral(); if(Math.random()<.6) addNebula(); if(Math.random()<.5) addRays(); }
    });
  })();

  /* ---- Equations: drag scroll ---- */
  const initDragScroll = (root=document) => {
    $$('.eq .eq-scroll', root).forEach(scroller=>{
      let down=false, sx=0, sl=0;
      scroller.addEventListener('mousedown', e=>{ down=true; sx=e.clientX; sl=scroller.scrollLeft; scroller.classList.add('dragging'); e.preventDefault(); });
      addEventListener('mousemove', e=>{ if(!down) return; scroller.scrollLeft = sl - (e.clientX - sx); }, { passive:true });
      addEventListener('mouseup', ()=>{ down=false; scroller.classList.remove('dragging'); });
      scroller.addEventListener('touchstart', e=>{ down=true; sx=e.touches[0].clientX; sl=scroller.scrollLeft; }, { passive:true });
      scroller.addEventListener('touchmove', e=>{ if(!down) return; scroller.scrollLeft = sl - (e.touches[0].clientX - sx); }, { passive:true });
      scroller.addEventListener('touchend', ()=>{ down=false; });
    });
  };
  initDragScroll();

  /* === Equation polish utilities: calm bias + copy button + scroll-fade refresh === */
  (function eqPolish(){
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 1) Bias toward calm if unset
    $$('.eq').forEach(b => {
      const hasFX = b.getAttribute('data-fx');
      if (!hasFX || Math.random() < 0.7) b.setAttribute('data-fx','calm');
    });

    // 2) Copy button
    $$('.eq-card .eq').forEach(eq => {
      if (eq.querySelector('.eq-copy')) return;
      const btn = document.createElement('button');
      btn.className = 'eq-copy';
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Copy equation TeX');
      btn.innerHTML = '<span class="dot" aria-hidden="true"></span><span>Copy</span>';
      btn.addEventListener('click', async () => {
        const src = eq.querySelector('.eq-scroll');
        if(!src) return;
        const text = src.innerText.trim();
        try{
          await navigator.clipboard.writeText(text);
          const old = btn.innerHTML;
          btn.innerHTML = '<span class="dot" aria-hidden="true"></span><span>Copied</span>';
          setTimeout(()=>btn.innerHTML = old, 1200);
        }catch(e){
          btn.innerHTML = '<span class="dot" aria-hidden="true"></span><span>Failed</span>';
          setTimeout(()=>btn.innerHTML = 'Copy', 1200);
        }
      });
      eq.appendChild(btn);
    });

    // 3) Refresh scroll fades
    const refreshMask = (el)=>{
      const atTop   = el.scrollTop <= 1;
      const atBottom= el.scrollHeight - el.clientHeight - el.scrollTop <= 1;
      const topStop = atTop ? 0 : 12;
      const botStop = atBottom ? 0 : 12;
      el.style.webkitMaskImage = `linear-gradient(to bottom, transparent ${topStop}px, black ${topStop+1}px, black calc(100% - ${botStop+1}px), transparent calc(100% - ${botStop}px))`;
      el.style.maskImage = el.style.webkitMaskImage;
    };
    const scrollers = $$('.eq-card .eq-scroll');
    scrollers.forEach(s=>{
      s.addEventListener('scroll', ()=>refreshMask(s), {passive:true});
      setTimeout(()=>refreshMask(s), 60);
    });

    if (window.MathJax && MathJax.startup && MathJax.startup.promise){
      MathJax.startup.promise.then(()=> scrollers.forEach(s=>refreshMask(s)));
    }

    if (!reduce && matchMedia('(hover: none)').matches){
      // no-op (hover zoom already ignored on touch)
    }
  })();

  /* ---- MathJax on-demand typeset ---- */
  const typeset = (root=document) => {
    if (!window.MathJax || !MathJax.typesetPromise) return;
    MathJax.typesetClear?.();
    MathJax.typesetPromise(Array.from(root.querySelectorAll('.eq'))).catch(()=>{});
  };
  if ('IntersectionObserver' in window) {
    const ioEq = new IntersectionObserver((es)=>{
      if (es.some(e=>e.isIntersecting)) { typeset(document); }
    }, { rootMargin:'200px 0px' });
    const firstEq = $('.eq'); firstEq && ioEq.observe(firstEq);
  } else {
    addEventListener('load', ()=> typeset(document));
  }

  /* ---- Equation pop-out viewer ---- */
  let eqPop=null;
  const closePop = () => { if (!eqPop) return; eqPop.remove(); eqPop=null; document.body.style.removeProperty('overflow'); };
  document.addEventListener('click', e=>{
    const btn=e.target.closest('[data-eq-expand]'); if(!btn) return;
    const eq = btn.closest('.card, .eq')?.querySelector('.eq') || btn.closest('.eq'); if(!eq) return;
    eqPop=document.createElement('div'); eqPop.className='eq eq--expanded';
    const inner=document.createElement('div'); inner.className='eq-scroll'; inner.innerHTML = (eq.querySelector('.eq-scroll')||eq).innerHTML;
    const close=document.createElement('button'); close.className='eq-close'; close.type='button'; close.textContent='Close';
    close.addEventListener('click', closePop);
    eqPop.append(inner, close); document.body.appendChild(eqPop); document.body.style.overflow='hidden';
    initDragScroll(eqPop); typeset(eqPop);
  });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closePop(); });

  /* ---- Smooth anchor scroll accounting for sticky glass ---- */
  document.addEventListener('click', e=>{
    const a=e.target.closest('a[href^="#"]'); if(!a) return;
    const id=a.getAttribute('href').slice(1); const t=id?document.getElementById(id):null; if(!t) return;
    e.preventDefault();
    const top = t.getBoundingClientRect().top + scrollY - 96;
    scrollTo({ top, behavior: ALLOW_MOTION ? 'smooth' : 'auto' });
    history.pushState(null,'',`#${id}`);
    setTimeout(()=>setInk(a.closest('.tab') || activeTab()), 50);
  });

  /* ---- Ξ driver (updates --xi softly; CSS uses it) ---- */
  (function xiDriver(){
    if (!ALLOW_MOTION) return;
    const root = document.documentElement;
    let xi = 0.35, rafId;
    function tween(target, dur=2200){
      const start = xi; const t0 = performance.now();
      cancelAnimationFrame(rafId);
      function step(t){
        const p=Math.min(1,(t-t0)/dur);
        xi = start + (target-start)*(0.5-0.5*Math.cos(Math.PI*p));
        root.style.setProperty('--xi', xi.toFixed(3));
        rafId = requestAnimationFrame(p<1 ? step : loop);
      }
      rafId = requestAnimationFrame(step);
    }
    function loop(){
      const target = 0.25 + Math.random()*0.6;
      const dur = 2200 + Math.random()*1600;
      tween(target, dur);
    }
    loop();
  })();
})();

/* ====================================================================== */
/* Alive Pack (timed random affects for equations & UI)                   */
/* ====================================================================== */
(function alivePack(){
  const root  = document.documentElement;
  const body  = document.body;
  const prefersReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduce || body.classList.contains('affect-off')) return;

  const rnd   = (a,b)=>a + Math.random()*(b-a);
  const pick  = arr => arr[(Math.random()*arr.length)|0];

  /* 1) Headline sheen pulses */
  const sheenTargets = Array.from(document.querySelectorAll('.title, h2, h3'));
  sheenTargets.forEach(el => el.classList.add('alive-sheen'));
  function scheduleSheen(el){
    el.classList.toggle('sheen-on', true);
    setTimeout(()=> el.classList.toggle('sheen-on', false), 2200);
    setTimeout(()=> scheduleSheen(el), rnd(6500, 14000));
  }
  sheenTargets.forEach((el,i)=> setTimeout(()=> scheduleSheen(el), rnd(1200, 5400) + i*90));

  /* 2) Subtle float */
  const floatTargets = Array.from(document.querySelectorAll('.tile, .card, .cta, .tab'));
  floatTargets.forEach(el=>{
    el.style.setProperty('--alive-dur', `${rnd(9,16).toFixed(2)}s`);
    el.classList.add('alive-float');
  });

  /* 3) Rare twinkle */
  const twinkles = Array.from(document.querySelectorAll('a, .meta, .hint'));
  twinkles.forEach(el=>{
    if(Math.random() < 0.55){
      el.style.setProperty('--alive-twinkle', `${rnd(9,14).toFixed(2)}s`);
      el.classList.add('alive-twinkle');
    }
  });

  /* 4) Equations: sparks + arcs */
  const eqs = Array.from(document.querySelectorAll('.eq'));
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(onIO, {threshold:0.15}) : null;

  eqs.forEach(eq=>{
    eq.classList.add('alive');

    const sparkBudget = Math.min( (parseInt(getComputedStyle(root).getPropertyValue('--alive-spark-count'))||18), 40 );
    const pool = [];
    for(let i=0;i<sparkBudget;i++){
      const s = document.createElement('i');
      s.className = 'spark';
      eq.appendChild(s);
      pool.push(s);
    }

    const arc = document.createElement('i'); arc.className = 'arc'; eq.appendChild(arc);

    function runBurst(){
      if (!eq.isConnected) return;
      const rect = eq.getBoundingClientRect();
      if (rect.bottom < -200 || rect.top > innerHeight + 200) {
        setTimeout(runBurst, rnd(1200, 2800));
        return;
      }
      const n = (2 + Math.random()*3)|0;
      for(let k=0;k<n;k++){
        const s = pick(pool);
        const pad = 18;
        const w = eq.clientWidth, h = eq.clientHeight;
        const x = rnd(pad, Math.max(pad, w - pad));
        const y = rnd(pad, Math.max(pad, h - pad));
        const dx = rnd(-60, 80);
        const dy = rnd(-50, 30);
        const sscale = rnd(.8, 1.4);
        const dur = rnd(6, 12).toFixed(2) + 's';
        const delay = rnd(0, 0.8).toFixed(2) + 's';
        s.style.setProperty('--x',  x.toFixed(1) + 'px');
        s.style.setProperty('--y',  y.toFixed(1) + 'px');
        s.style.setProperty('--dx', dx.toFixed(1) + 'px');
        s.style.setProperty('--dy', dy.toFixed(1) + 'px');
        s.style.setProperty('--s',  sscale.toFixed(2));
        s.style.setProperty('--dur', dur);
        s.style.setProperty('--delay', delay);
        s.classList.remove('run'); void s.offsetWidth; s.classList.add('run');
      }
      if (Math.random() < 0.2){
        arc.style.setProperty('--cx', `${rnd(35,65).toFixed(1)}%`);
        arc.style.setProperty('--cy', `${rnd(35,65).toFixed(1)}%`);
        arc.style.setProperty('--a0', `${rnd(0,360).toFixed(0)}deg`);
        arc.style.setProperty('--ad', `${rnd(3.6,6.2).toFixed(2)}s`);
        arc.style.setProperty('--delay', `${rnd(.0,.8).toFixed(2)}s`);
        arc.classList.remove('run'); void arc.offsetWidth; arc.classList.add('run');
      }
      setTimeout(runBurst, rnd(1400, 3600));
    }
    function onIO(entries){ for (const e of entries){ if (e.isIntersecting){ runBurst(); io && io.unobserve(e.target); } } }
    if (io) io.observe(eq); else setTimeout(runBurst, rnd(800, 2200));
  });

  /* 5) Laser grid tiny breath */
  const grid = document.querySelector('.laser-grid'); if (grid) grid.classList.add('alive');

  /* 6) Safety: honor global kill switch dynamically */
  const mo = new MutationObserver(()=> { if (body.classList.contains('affect-off')) mo.disconnect(); });
  mo.observe(body, {attributes:true, attributeFilter:['class']});
})();

/* ====================================================================== */
/* Alive Palette (Calm / Lively / Max / Full Off)                         */
/* ====================================================================== */
(function alivePalette(){
  const doc = document;
  const root = doc.documentElement;
  const body = doc.body;

  const MODES = [
    {id:'calm',   label:'Calm — subtle, slower'},
    {id:'lively', label:'Lively — default'},
    {id:'max',    label:'Max — energetic'},
    {id:'off',    label:'Full Off — disable motion'},
  ];

  const key = 'sof.alive.mode.v1';
  const saved = localStorage.getItem(key) || 'lively';
  applyMode(saved, {boot:true});

  // Hook palette if present
  const pal = doc.getElementById('palette');
  const list = doc.getElementById('palList');
  const input = doc.getElementById('palInput');

  if (pal && list){
    const header = itemEl('— Animation Energy —', true);
    header.setAttribute('aria-disabled','true');
    list.appendChild(header);

    MODES.forEach(m=>{
      const el = itemEl(`⚡ ${m.label}`, false, m.id);
      if (m.id === saved) el.classList.add('sel');
      el.addEventListener('click', ()=>{ applyMode(m.id); pal.classList.remove('open'); });
      list.appendChild(el);
    });

    input?.addEventListener('input', ()=>{
      const q = input.value.trim().toLowerCase();
      Array.from(list.children).forEach(li=>{
        const id = li.dataset.mode || '';
        const txt = li.textContent.toLowerCase();
        if (!id){ li.style.display=''; return; } // header stays
        li.style.display = (q==='' || txt.includes(q) || id.includes(q) || /alive|energy|animation/.test(q)) ? '' : 'none';
      });
    });
  }

  // Optional quick button in a toolbar with .quick.quick--utils
  try{
    const quick = doc.querySelector('.quick.quick--utils');
    if (quick && !quick.querySelector('#aliveToggle')){
      const btn = doc.createElement('button');
      btn.id='aliveToggle'; btn.className='cta'; btn.type='button';
      btn.title='Animation energy';
      btn.textContent= labelFor(saved);
      btn.addEventListener('click', ()=>{
        const order = ['calm','lively','max','off'];
        const i = order.indexOf(currentMode());
        const next = order[(i+1) % order.length];
        applyMode(next);
        btn.textContent = labelFor(next);
      });
      quick.appendChild(btn);
    }
  }catch(e){ /* no-op */ }

  function itemEl(text, header=false, modeId=''){
    const li = document.createElement('li');
    li.textContent = text;
    if (!header){ li.tabIndex=0; li.dataset.mode = modeId; }
    return li;
  }
  function labelFor(id){
    const m = MODES.find(x=>x.id===id);
    return m ? `Affect: ${m.label.split(' — ')[0]}` : 'Affect: Lively';
    }
  function currentMode(){
    if (body.classList.contains('affect-off')) return 'off';
    return root.getAttribute('data-alive') || 'lively';
  }
  function applyMode(id, opts={}){
    const prev = currentMode();

    if (id === 'off'){
      body.classList.add('affect-off');
      root.removeAttribute('data-alive');
    }else{
      body.classList.remove('affect-off');
      root.setAttribute('data-alive', id);
    }

    const list = document.getElementById('palList');
    list && Array.from(list.querySelectorAll('[data-mode]')).forEach(el=>{
      el.classList.toggle('sel', el.dataset.mode === id);
    });

    const prefersReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!opts.boot || !prefersReduce){
      localStorage.setItem(key, id);
    }

    if (!opts.boot){
      root.dataset.alivePulse = '1';
      requestAnimationFrame(()=> delete root.dataset.alivePulse);
    }

    const btn = document.getElementById('aliveToggle');
    if (btn) btn.textContent = labelFor(id);

    if (prev !== id) { try{ console.debug('[SoF] Alive mode:', id); }catch(_){} }
  }
})();
</script>