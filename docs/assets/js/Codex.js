<script>
/* ==========================================================================
   Scroll of Fire — codex.js v4.0
   - System-safe: motion/data prefs, safe-area CSS vars, DPR changes
   - Year stamp (#yr, #y) + meta theme-color sync by theme/skin
   - Sticky glass header + scroll progress rail (#scrollProg optional)
   - Tabs ink bar: center on load; font-ready; resize; DPR changes
   - Command palette: inert background, focus trap, return focus
   - Smooth anchor scroll (sticky header aware) + a11y hash focus
   - Explore Dock IO; Back-to-top uses .visible
   - Mini-suggest (v1) skips if v2 present
   - Carrier: cycler, URL param (?carrier=432), persisted
   - Alive modes (Calm/Lively/Max/Off) palette integration
   - Equation FX builder + drag/scroll polish + copy buttons
   - MathJax on-demand + pop-out viewer (accessible dialog)
   ========================================================================== */
(() => {
  if (document.documentElement.hasAttribute('data-sof-js-init')) return;
  document.documentElement.setAttribute('data-sof-js-init','1');

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  document.documentElement.classList.add('js-ready');

  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const RD = matchMedia('(prefers-reduced-data: reduce)').matches;
  const ALLOW_MOTION = !(RM || RD);
  const rIC = window.requestIdleCallback || ((fn)=> setTimeout(fn, 1));

  /* ---- Safe-area CSS vars (iOS notch friendliness) ---- */
  (function safeAreaVars(){
    const root = document.documentElement.style;
    const apply = () => {
      root.setProperty('--safe-top',    getComputedStyle(document.documentElement).getPropertyValue('padding-top') || '0px');
      // Also expose env() values explicitly:
      root.setProperty('--safe-area-top',    'env(safe-area-inset-top)');
      root.setProperty('--safe-area-bottom', 'env(safe-area-inset-bottom)');
      root.setProperty('--safe-area-left',   'env(safe-area-inset-left)');
      root.setProperty('--safe-area-right',  'env(safe-area-inset-right)');
    };
    apply();
    addEventListener('orientationchange', apply, { passive:true });
    addEventListener('resize', apply, { passive:true });
  })();

  /* ---- Year stamp + system theme sync ---- */
  const yearEl = $('#yr') || $('#y');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const META_THEME = document.querySelector('meta[name="theme-color"]');
  const themeFromRoot = () => document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const themeColorMap = {
    dark:'#0b0b0f',
    light:'#ffffff'
  };
  const syncThemeMeta = () => {
    if (!META_THEME) return;
    const t = themeFromRoot();
    META_THEME.setAttribute('content', themeColorMap[t] || '#0b0b0f');
  };
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', syncThemeMeta, { passive:true });
  syncThemeMeta();

  /* Optional theme toggle button (#toggleTheme) */
  (function themeToggle(){
    const btn = $('#toggleTheme');
    if (!btn) return;
    const cycle = () => {
      const cur = themeFromRoot();
      const nxt = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', nxt);
      syncThemeMeta();
      btn.setAttribute('aria-pressed', String(nxt==='dark'));
      btn.textContent = nxt==='dark' ? '☾ Dark' : '☀ Light';
      try{ localStorage.setItem('sof.theme', nxt); }catch(_){}
    };
    try{
      const saved = localStorage.getItem('sof.theme');
      if (saved) { document.documentElement.setAttribute('data-theme', saved); syncThemeMeta(); }
    }catch(_){}
    btn.addEventListener('click', cycle, { passive:true });
  })();

  /* ---- Sticky header + scroll progress rail (optional #scrollProg) ---- */
  const header = $('header.site');
  const stick = () => header?.classList.toggle('is-stuck', scrollY > 6);
  stick(); addEventListener('scroll', stick, { passive:true });

  const prog = $('#scrollProg');
  if (prog){
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
      prog.style.setProperty('--p', p.toFixed(4));
    };
    onScroll(); addEventListener('scroll', onScroll, { passive:true });
    addEventListener('resize', onScroll, { passive:true });
  }

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
    const at = activeTab(); cue(at);
    try { at?.scrollIntoView({block:'nearest', inline:'center', behavior: ALLOW_MOTION ? 'smooth' : 'auto'}); } catch(_){}
    $$('.tabs .tab').forEach(a=>{
      a.addEventListener('mouseenter', ()=>cue(a), {passive:true});
      a.addEventListener('focus',     ()=>cue(a), {passive:true});
    });
    ['resize','hashchange'].forEach(ev => addEventListener(ev, ()=>cue(activeTab()), {passive:true}));
    tabs?.addEventListener('mouseleave', ()=>cue(activeTab()), {passive:true});
    document.fonts?.ready?.then(()=> cue(activeTab())).catch(()=>{});
    /* Recompute on DPR changes (zoom or display swap) */
    matchMedia(`(resolution: ${devicePixelRatio}dppx)`).addEventListener?.('change', ()=>cue(activeTab()), { passive:true });
  };
  initInk();

  /* ---- Reveal-on-intersect ---- */
  const reveal = () => {
    const nodes = $$('.card, .reveal, .tile');
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
    if (ALLOW_MOTION && heroImg) {
      let ticking = false;
      const onScroll = () => {
        if (ticking) return; ticking = true;
        requestAnimationFrame(() => {
          const r = hero.getBoundingClientRect(); const vh = innerHeight || 800;
          const mid = r.top + r.height/2; const dist = Math.abs((vh/2)-mid)/(vh/2);
          const pz = 1 + 0.02*(1 - Math.min(1, Math.max(0, dist)));
          heroImg.style.transform = `translateZ(0) scale(${pz})`;
          ticking = false;
        });
      };
      addEventListener('scroll', onScroll, {passive:true}); onScroll();
    }
  }

  /* ---- Carrier cycler + URL param + Lights toggle ---- */
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

    /* URL param preset (?carrier=528) */
    try {
      const q = new URLSearchParams(location.search);
      const p = q.get('carrier');
      if (p && ['144','369','432','528','963','none'].includes(p)) {
        skins.forEach(s=>html.classList.remove(s));
        if (p!=='none') html.classList.add(`carrier-${p}`);
        localStorage.setItem('sof.carrier', p);
      } else {
        const saved = localStorage.getItem('sof.carrier');
        if (saved && saved!=='none') html.classList.add(`carrier-${saved}`);
      }
    }catch(_){}

    if (btn){
      if (!curSkin()) html.classList.add(skins[0]);
      btn.textContent = `Carrier ${curSkin().split('-')[1]}`;
      btn.addEventListener('click', ()=>{
        const cur=curSkin(), nxt=nextSkin(cur);
        skins.forEach(s=>html.classList.remove(s));
        html.classList.add(nxt);
        btn.textContent = `Carrier ${nxt.split('-')[1]}`;
        try { localStorage.setItem('sof.carrier', nxt.split('-')[1]); }catch(_){}
      }, {passive:true});
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

  /* ---- Affect master toggle (toolbar) ---- */
  const btnAffect = $('#toggleAffect');
  const setAffect = on => {
    document.body.classList.toggle('affect-off', !on);
    btnAffect?.setAttribute('aria-pressed', on?'true':'false');
  };
  setAffect(!document.body.classList.contains('affect-off'));
  btnAffect?.addEventListener('click', () => setAffect(document.body.classList.contains('affect-off')));

  /* ---- Back to top ---- */
  const toTop = $('#toTop') || $('.to-top');
  const topBtn = () => toTop?.classList.toggle('visible', scrollY>400);
  topBtn(); addEventListener('scroll', topBtn, { passive:true });
  toTop?.addEventListener('click', ()=> scrollTo({ top:0, behavior: ALLOW_MOTION ? 'smooth' : 'auto' }));

  /* ---- Explore Dock IO ---- */
  (function exploreDockIO(){
    const dock = $('#exploreDock'); const hero = $('#hero'); const explore = $('#explore');
    if(!dock || !hero || !explore || !('IntersectionObserver' in window)) return;
    let heroOut=false, pastExplore=false;
    const ioHero = new IntersectionObserver(([e])=>{ heroOut = !e.isIntersecting; update(); }, {threshold:0.01});
    const ioExplore = new IntersectionObserver(([e])=>{ pastExplore = e.isIntersecting; update(); }, {threshold:0.05});
    function update(){ dock.classList.toggle('show', heroOut && !pastExplore); }
    ioHero.observe(hero); ioExplore.observe(explore);
  })();

  /* ---- Search mini-suggest (v1) ---- */
  const SEARCH_V2 = (() => {
    const s = document.getElementById('site-suggest');
    return !!(s && s.getAttribute('role') === 'listbox' && s.dataset.v === '2');
  })();
  if (!SEARCH_V2) {
    const siteSearch = $('#site-search'); const siteSuggest = $('#site-suggest');
    if (siteSuggest && !siteSuggest.getAttribute('role')) {
      siteSuggest.setAttribute('role','listbox');
      siteSuggest.setAttribute('aria-label','Suggestions');
    }
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
      results.forEach(r => {
        const a=document.createElement('a');
        a.href=r.href; a.textContent=r.text; a.role='option';
        a.addEventListener('click',()=>siteSuggest.classList.add('hidden'));
        siteSuggest.appendChild(a);
      });
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

  /* ---- Command palette (with inert & trap) ---- */
  const palette = $('#palette'); const palInput = $('#palInput'); const palList = $('#palList');
  let palLastFocus = null; let palKeyTrap = null;
  const rows = [
    { label:'Go: Theory', href:'theory.html' },
    { label:'Go: Manifest', href:'teach.html' },
    { label:'Toggle Echo View', action:() => $('#toggleSimple')?.click() },
    { label:'Toggle HUD', action:() => $('#toggleGrid')?.click() },
    { label:'Animation: Calm', action:() => setAliveMode('calm') },
    { label:'Animation: Lively', action:() => setAliveMode('lively') },
    { label:'Animation: Max', action:() => setAliveMode('max') },
    { label:'Animation: Off', action:() => setAliveMode('off') },
    { label:'Back to Top', action:() => ( $('#toTop')||$('.to-top') )?.click() },
    { label:'Jump: Explore', href:'#explore' },
    { label:'Jump: Canon', href:'#canon' },
  ];
  function build(q){
    if (!palList) return;
    palList.innerHTML='';
    q=(q||'').toLowerCase();
    rows.filter(r=>!q || r.label.toLowerCase().includes(q)).forEach((r,i)=>{
      const li=document.createElement('li'); li.textContent=r.label; if(i===0) li.classList.add('sel');
      li.tabIndex = 0;
      li.addEventListener('click', ()=>{ r.href? location.href=r.href : r.action?.(); togglePalette(false); });
      li.addEventListener('keydown', (e)=>{ if(e.key==='Enter' || e.key===' ') { e.preventDefault(); li.click(); } });
      palList.appendChild(li);
    });
  }
  const trapFocus = () => {
    if (!palette) return;
    const main = $('main, #top, .wrap') || document.body;
    main?.setAttribute?.('inert','');
    const selectable = Array.from(palette.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(x=>!x.hasAttribute('disabled'));
    const first = selectable[0], last = selectable[selectable.length-1];
    palKeyTrap = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); togglePalette(false); return; }
      if (e.key !== 'Tab' || selectable.length===0) return;
      if (e.shiftKey && document.activeElement === first) { last?.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last) { first?.focus(); e.preventDefault(); }
    };
    document.addEventListener('keydown', palKeyTrap);
  };
  const untrapFocus = () => {
    const main = $('main, #top, .wrap');
    main?.removeAttribute?.('inert');
    if (palKeyTrap) document.removeEventListener('keydown', palKeyTrap);
    palKeyTrap=null;
  };
  const togglePalette = (open) => {
    if (!palette) return;
    if (open) {
      palLastFocus = document.activeElement;
      palette.classList.add('open');
      build('');
      trapFocus();
      palInput?.focus();
    } else {
      untrapFocus();
      palette.classList.remove('open');
      palLastFocus?.focus();
    }
  };
  $('#openPalette')?.addEventListener('click', ()=> togglePalette(true));
  document.addEventListener('keydown', e => {
    if ((e.key.toLowerCase()==='k') && (e.metaKey||e.ctrlKey)) { e.preventDefault(); togglePalette(true); }
    if (e.key==='Escape' && palette?.classList.contains('open')) togglePalette(false);
  });
  palette?.addEventListener('click', e => { if (e.target===palette) togglePalette(false); });

  /* ---- Alive FX: equations + UI ---- */
  (function alivePack(){
    const body  = document.body;
    const prefersReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduce || body.classList.contains('affect-off')) return;

    const rnd   = (a,b)=>a + Math.random()*(b-a);
    const pick  = arr => arr[(Math.random()*arr.length)|0];

    // 1) Headline sheen pulses
    const sheenTargets = Array.from(document.querySelectorAll('.title, h2, h3'));
    sheenTargets.forEach(el => el.classList.add('alive-sheen'));
    function scheduleSheen(el){
      el.classList.toggle('sheen-on', true);
      setTimeout(()=> el.classList.toggle('sheen-on', false), 2200);
      setTimeout(()=> scheduleSheen(el), rnd(6500, 14000));
    }
    sheenTargets.forEach((el,i)=> setTimeout(()=> scheduleSheen(el), rnd(1200, 5400) + i*90));

    // 2) Subtle float
    const floatTargets = Array.from(document.querySelectorAll('.tile, .card, .cta, .tab'));
    floatTargets.forEach(el=>{
      el.style.setProperty('--alive-dur', `${rnd(9,16).toFixed(2)}s`);
      el.classList.add('alive-float');
    });

    // 3) Rare twinkle
    const twinkles = Array.from(document.querySelectorAll('a, .meta, .hint'));
    twinkles.forEach(el=>{
      if(Math.random() < 0.55){
        el.style.setProperty('--alive-twinkle', `${rnd(9,14).toFixed(2)}s`);
        el.classList.add('alive-twinkle');
      }
    });

    // 4) Equations: sparks + arcs
    const eqs = Array.from(document.querySelectorAll('.eq'));
    const io = 'IntersectionObserver' in window ? new IntersectionObserver(onIO, {threshold:0.15}) : null;

    eqs.forEach(eq=>{
      eq.classList.add('alive');
      const budgetVar = getComputedStyle(document.documentElement).getPropertyValue('--alive-spark-count').trim();
      const sparkBudget = Math.min( (parseInt(budgetVar||'18',10)||18), 40 );
      const pool = [];
      for(let i=0;i<sparkBudget;i++){
        const s = document.createElement('i');
        s.className = 'spark';
        eq.appendChild(s); pool.push(s);
      }
      const arc = document.createElement('i'); arc.className = 'arc'; eq.appendChild(arc);

      function runBurst(){
        if (!eq.isConnected) return;
        const rect = eq.getBoundingClientRect();
        if (rect.bottom < -200 || rect.top > innerHeight + 200) { setTimeout(runBurst, rnd(1200, 2800)); return; }
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

    // 5) Laser grid tiny breath
    const grid = document.querySelector('.laser-grid'); if (grid) grid.classList.add('alive');

    // 6) Kill switch watcher
    const mo = new MutationObserver(()=> { if (body.classList.contains('affect-off')) mo.disconnect(); });
    mo.observe(body, {attributes:true, attributeFilter:['class']});
  })();

  /* ---- Alive Palette helpers (Calm / Lively / Max / Off) ---- */
  function setAliveMode(id, opts={}){
    const root = document.documentElement;
    const body = document.body;
    const prev = (body.classList.contains('affect-off') ? 'off' : (root.getAttribute('data-alive') || 'lively'));
    if (id === 'off'){ body.classList.add('affect-off'); root.removeAttribute('data-alive'); }
    else { body.classList.remove('affect-off'); root.setAttribute('data-alive', id); }
    const prefersReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!opts.boot || !prefersReduce){ try{ localStorage.setItem('sof.alive.mode.v1', id); }catch(_){ } }
    if (!opts.boot){ root.dataset.alivePulse = '1'; requestAnimationFrame(()=> delete root.dataset.alivePulse); }
    if (prev !== id) { try{ console.debug('[SoF] Alive mode:', id); }catch(_){} }
    const btn = document.getElementById('aliveToggle');
    if (btn) {
      const label = {calm:'Affect: Calm', lively:'Affect: Lively', max:'Affect: Max', off:'Affect: Off'}[id] || 'Affect: Lively';
      btn.textContent = label;
    }
  }
  (function bootAlive(){
    try{
      const saved = localStorage.getItem('sof.alive.mode.v1') || 'lively';
      setAliveMode(saved, {boot:true});
      const quick = document.querySelector('.quick.quick--utils');
      if (quick && !quick.querySelector('#aliveToggle')){
        const btn = document.createElement('button');
        btn.id='aliveToggle'; btn.className='cta'; btn.type='button'; btn.title='Animation energy';
        btn.textContent= {calm:'Affect: Calm', lively:'Affect: Lively', max:'Affect: Max', off:'Affect: Off'}[saved] || 'Affect: Lively';
        btn.addEventListener('click', ()=>{
          const order = ['calm','lively','max','off'];
          const i = order.indexOf((document.body.classList.contains('affect-off')?'off':document.documentElement.getAttribute('data-alive')) || 'lively');
          const next = order[(i+1) % order.length];
          setAliveMode(next);
          btn.textContent = {calm:'Affect: Calm', lively:'Affect: Lively', max:'Affect: Max', off:'Affect: Off'}[next];
        });
        quick.appendChild(btn);
      }
    }catch(_){}
  })();

  /* ---- Equations: drag/scroll + polish + copy ---- */
  const initDragScroll = (root=document) => {
    $$('.eq .eq-scroll', root).forEach(scroller=>{
      let down=false, sx=0, sl=0;
      const stopDrag = ()=>{ down=false; scroller.classList.remove('dragging'); };
      scroller.addEventListener('mousedown', e=>{ down=true; sx=e.clientX; sl=scroller.scrollLeft; scroller.classList.add('dragging'); e.preventDefault(); });
      addEventListener('mousemove', e=>{ if(!down) return; scroller.scrollLeft = sl - (e.clientX - sx); }, { passive:true });
      addEventListener('mouseup', stopDrag, { passive:true });
      scroller.addEventListener('touchstart', e=>{ down=true; sx=e.touches[0].clientX; sl=scroller.scrollLeft; }, { passive:true });
      scroller.addEventListener('touchmove', e=>{ if(!down) return; scroller.scrollLeft = sl - (e.touches[0].clientX - sx); }, { passive:true });
      scroller.addEventListener('touchend', stopDrag, { passive:true });
      scroller.addEventListener('wheel', e=>{
        const prev = scroller.scrollLeft;
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          scroller.scrollLeft += e.deltaY;
          if (scroller.scrollLeft !== prev) e.preventDefault();
        }
      }, { passive:false });
    });
  };
  initDragScroll();

  (function eqPolish(){
    $$('.eq').forEach(b => {
      const hasFX = b.getAttribute('data-fx');
      if (!hasFX || Math.random() < 0.7) b.setAttribute('data-fx','calm');
    });
    const copyText = async (text) => {
      text = (text || '').replace(/\u200b/g,'').trim();
      try{ if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; } }catch(_){}
      try{
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position='fixed'; ta.style.top='-1000px';
        document.body.appendChild(ta); ta.focus(); ta.select();
        const ok = document.execCommand('copy'); ta.remove(); return ok;
      }catch(_){ return false; }
    };
    $$('.eq-card .eq').forEach(eq => {
      if (eq.querySelector('.eq-copy')) return;
      const btn = document.createElement('button');
      btn.className = 'eq-copy'; btn.type = 'button';
      btn.setAttribute('aria-label', 'Copy equation TeX');
      btn.innerHTML = '<span class="dot" aria-hidden="true"></span><span>Copy</span>';
      btn.addEventListener('click', async () => {
        const src = eq.querySelector('.eq-scroll'); if(!src) return;
        const ok = await copyText(src.innerText);
        const old = btn.innerHTML;
        btn.innerHTML = `<span class="dot" aria-hidden="true"></span><span>${ok?'Copied':'Failed'}</span>`;
        setTimeout(()=>btn.innerHTML = old, 1200);
      });
      eq.appendChild(btn);
    });
    const refreshMask = (el)=>{
      const atTop   = el.scrollTop <= 1;
      const atBottom= el.scrollHeight - el.clientHeight - el.scrollTop <= 1;
      const topStop = atTop ? 0 : 12;
      const botStop = atBottom ? 0 : 12;
      const v = `linear-gradient(to bottom, transparent ${topStop}px, black ${topStop+1}px, black calc(100% - ${botStop+1}px), transparent calc(100% - ${botStop}px))`;
      el.style.webkitMaskImage = v; el.style.maskImage = v;
    };
    const scrollers = $$('.eq-card .eq-scroll');
    scrollers.forEach(s=>{
      s.addEventListener('scroll', ()=>refreshMask(s), {passive:true});
      rIC(()=>refreshMask(s));
    });
    addEventListener('resize', ()=> scrollers.forEach(s=>refreshMask(s)), {passive:true});
    if (window.MathJax?.startup?.promise){
      MathJax.startup.promise.then(()=> scrollers.forEach(s=>refreshMask(s))).catch(()=>{});
    }
  })();

  /* ---- MathJax on-demand typeset ---- */
  const typeset = (root=document) => {
    if (!window.MathJax || !MathJax.typesetPromise) return;
    try { MathJax.typesetClear?.(); } catch(_){}
    MathJax.typesetPromise(Array.from(root.querySelectorAll('.eq'))).catch(()=>{});
  };
  if ('IntersectionObserver' in window) {
    const ioEq = new IntersectionObserver((es)=>{
      if (es.some(e=>e.isIntersecting)) { typeset(document); }
    }, { rootMargin:'200px 0px' });
    const firstEq = $('.eq'); firstEq && ioEq.observe(firstEq);
  } else {
    addEventListener('load', ()=> typeset(document), {once:true});
  }

  /* ---- Equation pop-out viewer (accessible dialog + focus trap) ---- */
  let eqPop=null, lastFocus=null, untrap=null;
  const closePop = () => {
    if (!eqPop) return;
    untrap?.(); untrap=null;
    eqPop.remove(); eqPop=null;
    document.body.style.removeProperty('overflow');
    lastFocus?.focus();
  };
  document.addEventListener('click', e=>{
    const btn=e.target.closest('[data-eq-expand]'); if(!btn) return;
    const host = btn.closest('.card, .eq');
    const eq = host?.querySelector('.eq') || btn.closest('.eq'); if(!eq) return;
    lastFocus = document.activeElement;

    eqPop=document.createElement('div'); eqPop.className='eq eq--expanded';
    eqPop.setAttribute('role','dialog'); eqPop.setAttribute('aria-modal','true'); eqPop.setAttribute('aria-label','Equation');
    const inner=document.createElement('div'); inner.className='eq-scroll'; inner.innerHTML = (eq.querySelector('.eq-scroll')||eq).innerHTML;
    const close=document.createElement('button'); close.className='eq-close'; close.type='button'; close.textContent='Close';
    close.addEventListener('click', closePop);
    eqPop.append(inner, close); document.body.appendChild(eqPop); document.body.style.overflow='hidden';
    initDragScroll(eqPop); typeset(eqPop);

    eqPop.addEventListener('click', (ev)=>{ if (ev.target === eqPop) closePop(); });

    const trap = (ev)=>{
      if (!eqPop) { document.removeEventListener('keydown', trap); return; }
      if (ev.key === 'Escape') { ev.preventDefault(); closePop(); return; }
      if (ev.key !== 'Tab') return;
      const foci = [close, ...Array.from(eqPop.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(x=>!x.hasAttribute('disabled'))];
      if (!foci.length) return;
      const first = foci[0], last = foci[foci.length-1];
      if (ev.shiftKey && document.activeElement === first) { last.focus(); ev.preventDefault(); }
      else if (!ev.shiftKey && document.activeElement === last) { first.focus(); ev.preventDefault(); }
    };
    document.addEventListener('keydown', trap);
    untrap = ()=> document.removeEventListener('keydown', trap);

    close.focus();
  });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape' && eqPop) closePop(); });

  /* ---- Smooth anchor scroll + hash a11y focus ---- */
  document.addEventListener('click', e=>{
    const a=e.target.closest('a[href^="#"]'); if(!a) return;
    const href = a.getAttribute('href'); if (!href || href === '#') return;
    const id = href.slice(1); const t=id?document.getElementById(id):null; if(!t) return;
    e.preventDefault();
    const stickyH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--head-h')) || 96;
    const offset = stickyH + 12;
    const top = t.getBoundingClientRect().top + scrollY - offset;
    scrollTo({ top, behavior: ALLOW_MOTION ? 'smooth' : 'auto' });
    history.pushState(null,'',`#${id}`);
    setTimeout(()=>{
      setInk(a.closest('.tab') || activeTab());
      if (!/^(INPUT|TEXTAREA|BUTTON|A)$/.test(t.tagName)) { t.setAttribute('tabindex','-1'); t.focus({ preventScroll:true }); }
    }, 50);
  }, {passive:false});
})();
</script>
