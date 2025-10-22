/* ==========================================================================
   Scroll of Fire — codex.js v3.3.2
   - Sticky header, tab ink
   - Card reveal IO
   - Hero activation + light parallax (safe)
   - Simple mode, HUD toggle
   - Page search mini-suggest + '/' focus
   - Command palette shell
   - Equation pop-out viewer + drag-scroll
   - MathJax: on-demand typeset (the fix)
   ========================================================================== */
(() => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  document.documentElement.classList.add('js-ready');

  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const RD = matchMedia('(prefers-reduced-data: reduce)').matches;
  const ALLOW_MOTION = !(RM || RD);

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

  /* ---- Card reveal ---- */
  const reveal = () => {
    const cards = $$('.card');
    if (!('IntersectionObserver' in window) || !ALLOW_MOTION) { cards.forEach(c=>c.classList.add('visible')); return; }
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
    }), { rootMargin:'80px 0px' });
    cards.forEach(c=>io.observe(c));
  }; reveal();

  /* ---- Hero activation + light parallax (safe) ---- */
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

  /* ---- Simple/Echo mode ---- */
  const setSimple = on => { document.body.classList.toggle('simple-on', !!on); $('#toggleSimple')?.setAttribute('aria-pressed', on?'true':'false'); };
  $('#simple')?.addEventListener('change', e => setSimple(e.currentTarget.checked));
  $('#toggleSimple')?.addEventListener('click', () => setSimple(!document.body.classList.contains('simple-on')));

  /* ---- HUD ---- */
  const laser = $('.laser-grid');
  const setHUD = on => { if (!laser) return; laser.style.display = on? '' : 'none'; $('#toggleGrid')?.setAttribute('aria-pressed', on?'true':'false'); };
  setHUD(!!laser); $('#toggleGrid')?.addEventListener('click', ()=> setHUD(laser && laser.style.display==='none'));

  /* ---- Back to top ---- */
  const toTop = $('#toTop');
  const topBtn = () => toTop?.classList.toggle('show', scrollY>400);
  topBtn(); addEventListener('scroll', topBtn, { passive:true });
  toTop?.addEventListener('click', ()=> scrollTo({ top:0, behavior: ALLOW_MOTION ? 'smooth' : 'auto' }));

  /* ---- Page search mini-suggest + '/' ---- */
  const siteSearch = $('#site-search'); const siteSuggest = $('#site-suggest');
  const CAND = $$('h1[id],h2[id],h3[id],section[id],article[id]');
  const suggest = (q) => {
    if (!siteSuggest) return;
    siteSuggest.innerHTML = '';
    q = (q||'').trim().toLowerCase();
    if (!q) { siteSuggest.classList.add('hidden'); return; }
    const results = [
      ...CAND.filter(el => (el.textContent||'').toLowerCase().includes(q)).map(el => ({text:el.textContent.trim(), href:'#'+el.id})),
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

  /* ---- Command palette shell ---- */
  const palette = $('#palette'); const palInput = $('#palInput'); const palList = $('#palList');
  const togglePalette = (open) => { if (!palette) return; palette.classList.toggle('open', !!open); open ? palInput?.focus() : palInput?.blur(); if (open) build(''); };
  const rows = [
    { label:'Go: Theory', href:'theory.html' },
    { label:'Go: Manifest', href:'teach.html' },
    { label:'Toggle Echo View', action:() => $('#toggleSimple')?.click() },
    { label:'Toggle HUD', action:() => $('#toggleGrid')?.click() },
    { label:'Back to Top', action:() => $('#toTop')?.click() },
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

  /* ---- Equations: drag scroll + pop-out + MATHJAX TYPESET ---------------- */
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

  // On-demand MathJax typeset
  const typeset = (root=document) => {
    if (!window.MathJax || !MathJax.typesetPromise) return;
    MathJax.typesetClear?.();
    MathJax.typesetPromise(Array.from(root.querySelectorAll('.eq'))).catch(()=>{});
  };
  // Typeset when any .eq enters viewport
  if ('IntersectionObserver' in window) {
    const ioEq = new IntersectionObserver((es)=>{
      if (es.some(e=>e.isIntersecting)) { typeset(document); }
    }, { rootMargin:'200px 0px' });
    const firstEq = $('.eq'); firstEq && ioEq.observe(firstEq);
  } else {
    // Fallback: typeset once DOM ready
    addEventListener('load', ()=> typeset(document));
  }

  // Pop-out viewer re-typesets inside the popout
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
})();






const toTop=document.getElementById('toTop');
window.addEventListener('scroll',()=> {
  toTop.classList.toggle('visible',window.scrollY>600);
});
toTop.addEventListener('click',()=>scrollTo({top:0,behavior:'smooth'}));








/* ====================================================================== */
/* Alive Pack (timed random affects for equations & UI)                   */
/* Adds subtle, randomized life to headings, cards, and especially .eq    */
/* ====================================================================== */
(function alivePack(){
  const root  = document.documentElement;
  const body  = document.body;
  const prefersReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduce || body.classList.contains('affect-off')) return;

  const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
  const rnd   = (a,b)=>a + Math.random()*(b-a);
  const pick  = arr => arr[(Math.random()*arr.length)|0];

  /* ---------- 1) Headline sheen pulses ---------- */
  const sheenTargets = Array.from(document.querySelectorAll('.title, h2, h3'));
  sheenTargets.forEach(el => el.classList.add('alive-sheen'));
  function scheduleSheen(el){
    const t = rnd(2600, 5200);
    el.classList.toggle('sheen-on', true);
    setTimeout(()=> el.classList.toggle('sheen-on', false), 2200);
    setTimeout(()=> scheduleSheen(el), rnd(6500, 14000));
  }
  sheenTargets.forEach((el,i)=> setTimeout(()=> scheduleSheen(el), rnd(1200, 5400) + i*90));

  /* ---------- 2) Subtle float on tiles/cards/ctas ---------- */
  const floatTargets = Array.from(document.querySelectorAll('.tile, .card, .cta, .tab'));
  floatTargets.forEach(el=>{
    el.style.setProperty('--alive-dur', `${rnd(9,16).toFixed(2)}s`);
    el.classList.add('alive-float');
  });

  /* ---------- 3) Rare twinkle on links & small text ---------- */
  const twinkles = Array.from(document.querySelectorAll('a, .meta, .hint'));
  twinkles.forEach(el=>{
    if(Math.random() < 0.55){
      el.style.setProperty('--alive-twinkle', `${rnd(9,14).toFixed(2)}s`);
      el.classList.add('alive-twinkle');
    }
  });

  /* ---------- 4) Equations: sparks + arcs + tone ----------- */
  const eqs = Array.from(document.querySelectorAll('.eq'));
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(onIO, {threshold:0.15}) : null;

  eqs.forEach(eq=>{
    eq.classList.add('alive');
    // Create spark container (reuse .eq itself)
    const sparkBudget = Math.min( (parseInt(getComputedStyle(root).getPropertyValue('--alive-spark-count'))||18), 40 );

    // Pre-build a few spark nodes to reuse
    const pool = [];
    for(let i=0;i<sparkBudget;i++){
      const s = document.createElement('i');
      s.className = 'spark';
      eq.appendChild(s);
      pool.push(s);
    }

    // Add a single arc tracer element
    const arc = document.createElement('i');
    arc.className = 'arc';
    eq.appendChild(arc);

    // Runner: randomly light a few sparks and occasional arc
    function runBurst(){
      if (!eq.isConnected) return;
      const rect = eq.getBoundingClientRect();
      // Skip if currently far offscreen (in case no IO)
      if (rect.bottom < -200 || rect.top > innerHeight + 200) {
        setTimeout(runBurst, rnd(1200, 2800));
        return;
      }
      // Choose 2–5 sparks
      const n = (2 + Math.random()*3)|0;
      for(let k=0;k<n;k++){
        const s = pick(pool);
        // Random local positions within eq-scroll if present
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

        // retrigger
        s.classList.remove('run'); void s.offsetWidth; s.classList.add('run');
      }

      // Occasionally sweep an arc (1 in ~5 bursts)
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

    function onIO(entries){
      for (const e of entries){
        if (e.isIntersecting){
          runBurst();
          io && io.unobserve(e.target);
        }
      }
    }

    if (io) io.observe(eq); else setTimeout(runBurst, rnd(800, 2200));
  });

  /* ---------- 5) Laser grid tiny breath ---------- */
  const grid = document.querySelector('.laser-grid');
  if (grid) grid.classList.add('alive');

  /* ---------- 6) Safety: honor global kill switch dynamically ---------- */
  const mo = new MutationObserver(()=> {
    if (body.classList.contains('affect-off')){
      // Let CSS kill animations; nothing else to do
      mo.disconnect();
    }
  });
  mo.observe(body, {attributes:true, attributeFilter:['class']});
})();
