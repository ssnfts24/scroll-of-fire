/* ========================================================================
   Scroll of Fire — Teaching Lab Engine  (teach.js)
   v2025.10.19-b
   - Zero libraries, offline-first, mobile-friendly
   - Defensive: permissions, wake-lock, motion/data prefs, visibility, errors
   - Persistent state via localStorage (namespaced, guarded)
   - DPR-aware canvases, hash-based tab routing (works with back button)
   - All features no-op if corresponding controls aren’t in DOM
   ======================================================================== */
(function () {
  "use strict";

  /* --------------------------- Utilities -------------------------------- */
  const $  = (sel, ctx=document) => ctx.querySelector(sel);
  const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const fmt = (n, d=2) => Number.isFinite(n) ? Number(n).toFixed(d) : "—";
  const nowIso = () => new Date().toISOString();
  const todayKey = () => new Date().toISOString().slice(0,10);
  const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const prefersReducedData   = ('connection' in navigator && navigator.connection?.saveData) ||
                                matchMedia('(prefers-reduced-data: reduce)').matches;

  // Storage (guarded)
  const NS = 'codex:teach:';
  const S  = (k, v) => {
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem(NS+k) || 'null');
      localStorage.setItem(NS+k, JSON.stringify(v));
    } catch { /* quota/blocked; ignore */ }
  };

  const on = (el, ev, fn, opts) => el && el.addEventListener && el.addEventListener(ev, fn, opts);
  const vibrate = (ms=12) => (navigator.vibrate && !prefersReducedMotion) ? navigator.vibrate(ms) : void 0;
  const inFormField = (e) => e && e.target && /input|textarea|select/i.test(e.target.tagName);
  const getNum = (inp, def=0) => { if (!inp) return def; const n = parseFloat(inp.value); return Number.isFinite(n) ? n : def; };

  // Speech prompt helper (opt-in via #speakPrompts)
  function speak(line){
    const box = $('#speakPrompts');
    if (!('speechSynthesis' in window) || !box || !box.checked) return;
    try { window.speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(line)); } catch {}
  }

  // DPR-aware canvas sizing
  function fitCanvas(c, w=c.clientWidth||c.width, h=c.clientHeight||c.height){
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    if (c.width !== Math.round(w*dpr) || c.height !== Math.round(h*dpr)) {
      c.width = Math.round(w*dpr); c.height = Math.round(h*dpr);
      const ctx = c.getContext('2d'); if (ctx) ctx.setTransform(dpr,0,0,dpr,0,0);
    }
  }

  // Simple debounce
  const debounce = (fn, ms=120) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; };

  // Wake Lock (keeps screen on during ring timers if possible)
  let wakeLock;
  async function lockScreen(onFlag){
    try{
      if (!('wakeLock' in navigator)) return;
      if (onFlag){
        wakeLock = await navigator.wakeLock.request('screen');
        on(document, 'visibilitychange', async () => { if (!document.hidden && wakeLock?.released) wakeLock = await navigator.wakeLock.request('screen'); });
      } else { await wakeLock?.release(); wakeLock = null; }
    } catch { /* ignore */ }
  }

  /* -------------------- Reveal-on-scroll for cards ---------------------- */
  function revealOnScroll() {
    const cards = $$('.card');
    if (!cards.length) return;
    if (!('IntersectionObserver' in window)) { cards.forEach(c => c.classList.add('visible')); return; }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
    }, {rootMargin: '140px 0px'});
    cards.forEach(c => io.observe(c));
    // Safety net
    setTimeout(() => cards.forEach(c => c.classList.add('visible')), 900);
  }

  /* ----------------------------- Tabs & Routing ------------------------- */
  function initTabs() {
    const pills  = $$('.pill[role="tab"]');
    const panels = $$('.tab');
    if (!pills.length || !panels.length) return;

    const nameFromHash = () => (location.hash.replace('#','') || S('tab') || 'observer');
    const setHash = (name) => { if (location.hash !== '#'+name) history.pushState(null, '', '#'+name); };

    function activate(name, push=true) {
      pills.forEach(b => {
        const is = (b.dataset.tab === name);
        b.classList.toggle('active', is);
        b.setAttribute('aria-selected', is ? 'true' : 'false');
        b.tabIndex = is ? 0 : -1;
      });
      panels.forEach(p => {
        const is = (p.id === 'tab-' + name);
        p.classList.toggle('active', is);
        p.setAttribute('aria-hidden', is ? 'false' : 'true');
        if (is) (p.querySelector('button, input, textarea, select, a')||p).focus({preventScroll:true});
      });
      S('tab', name);
      const status = $('#lab-status'); if (status) status.textContent = `Tab: ${name}`;
      if (push) setHash(name);
    }

    // clicks
    pills.forEach(b => on(b, 'click', () => activate(b.dataset.tab)));
    // data-nav buttons (QuickStart)
    $$('.lab-card [data-nav]').forEach(b => on(b, 'click', () => activate(b.dataset.nav)));

    // restore from hash or storage
    activate(nameFromHash(), false);

    // hash/back-button support
    on(window, 'hashchange', () => activate(nameFromHash(), false));
    on(window, 'popstate', () => activate(nameFromHash(), false));

    // Hotkeys 1..7, ?, S (unless focused in field)
    on(document, 'keydown', (e) => {
      if (inFormField(e)) return;
      const map = { '1':'observer','2':'voice','3':'phrase','4':'coherence','5':'visuals','6':'breath','7':'ledger' };
      if (map[e.key]) { e.preventDefault(); activate(map[e.key]); }
      if (e.key === '?' || (e.shiftKey && e.key === '/')) { e.preventDefault(); toggleHelp(); }
      if (e.key.toLowerCase() === 's') { e.preventDefault(); $('#startTimer')?.click(); }
    });
  }

  /* -------------------------- Coach Mode -------------------------------- */
  function initCoach() {
    const box = $('#coach');
    if (!box) return;
    const enabled = S('coach') ?? false;
    box.checked = !!enabled; toggle(box.checked);
    function toggle(onFlag) {
      document.body.classList.toggle('coach-on', onFlag);
      S('coach', !!onFlag);
      box.setAttribute('aria-pressed', onFlag ? 'true' : 'false');
    }
    on(box, 'change', () => toggle(box.checked));
  }

  /* -------------------------- QuickStart ------------------------------- */
  function initQuickStart() {
    // Preset carrier buttons (in header + voice sidebar)
    $$('.lab-btn[data-carrier]').forEach(btn => on(btn, 'click', () => {
      const v = btn.dataset.carrier;
      $('#qsCarrier') && ($('#qsCarrier').value = v);
      $('#carrierOut') && ($('#carrierOut').value = v);
      S('carrier', v);
      const status = $('#lab-status'); if (status) status.textContent = `Preset carrier: ${v} Hz`;
    }));
    // Intention propagation to Phrase & Voice intention fields
    const qsInt = $('#qsIntention');
    on(qsInt, 'input', (e) => {
      const val = (e.target.value || '').trim();
      const p = $('#phraseIn'); if (val && p && !p.value) p.value = val;
      const v = $('#intentionFromVoice'); if (v && !v.value) v.value = val;
    });
    // Ctrl/⌘+Enter → send to Phrase Tuner
    on(qsInt, 'keydown', (e)=>{ if ((e.ctrlKey||e.metaKey) && e.key==='Enter'){ e.preventDefault(); $('.pill[data-tab="phrase"]')?.click(); }});
    // Restore stored carrier
    const savedCar = S('carrier'); if (savedCar) { $('#qsCarrier') && ($('#qsCarrier').value=savedCar); $('#carrierOut') && ($('#carrierOut').value=savedCar); }
  }

  /* ----------------------- Observer 4-Beat Ring -------------------------- */
  function initObserver() {
    const ringFg = $('#ringFg'), phaseTxt = $('#ringPhase'), countTxt = $('#ringCount');
    const secIn = $('#phaseSec'), roundsIn = $('#rounds'), paceSel = $('#pace');
    const startBtn = $('#startTimer'), stopBtn = $('#stopTimer');
    if (!ringFg || !phaseTxt || !secIn || !roundsIn || !startBtn || !stopBtn) return;

    // Optional beeper on phase boundary
    let audioCtx, beepOsc, beepGain;
    function beep() {
      if (prefersReducedMotion || prefersReducedData) return;
      try {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        beepOsc = audioCtx.createOscillator(); beepGain = audioCtx.createGain();
        beepOsc.frequency.value = 660; // soft tick
        beepGain.gain.value = 0.0001;
        beepOsc.connect(beepGain).connect(audioCtx.destination);
        beepOsc.start();
        beepGain.gain.exponentialRampToValueAtTime(0.04, audioCtx.currentTime + 0.02);
        beepGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.08);
        beepOsc.stop(audioCtx.currentTime + 0.10);
      } catch {}
    }

    const PHASES = [
      {k:'𝓘', label:'Intend',   prompt:'Choose one clean line.'},
      {k:'𝓛', label:'Look',     prompt:'Notice one undeniable detail.'},
      {k:'𝓒', label:'Coalesce', prompt:'Soften jaw/shoulders; exhale; feel weight.'},
      {k:'𝓢', label:'Seal',     prompt:'Whisper thanks. Allow settling.'}
    ];

    let raf=null, i=0, round=0, phaseSec=12, rounds=3, t0=0;

    // Restore user prefs
    const savedSec = S('observer:sec'); const savedRounds = S('observer:rounds'); const savedPace = S('observer:pace') || 'free';
    if (savedSec)   secIn.value = clamp(savedSec, 3, 120);
    if (savedRounds) roundsIn.value = clamp(savedRounds, 1, 20);
    if (paceSel) paceSel.value = savedPace;

    // Presets e.g. data-preset="12-3"
    $$('[data-preset]').forEach(b => on(b, 'click', () => {
      const [s,r] = (b.dataset.preset || '').split('-').map(n => parseInt(n,10));
      if (Number.isFinite(s)) secIn.value = clamp(s, 3, 120);
      if (Number.isFinite(r)) roundsIn.value = clamp(r, 1, 20);
    }));

    function draw(progress01) {
      const dash = clamp(100 - progress01*100, 0, 100);
      ringFg.style.strokeDashoffset = String(dash);
    }

    function setPhase(idx) {
      const p = idx % 4, P = PHASES[p];
      phaseTxt.textContent = `${P.k} • ${P.label}`;
      countTxt.textContent = `Round ${round+1}/${rounds} • Phase ${p+1}/4`;
      vibrate(10); beep();
      const pace = paceSel?.value || 'free';
      if (pace === 'box')      speak(`${P.label}. Gentle four.`);
      else if (pace === '4-7-8') speak(`${P.label}. Ease.`);
      else                      speak(P.prompt);
    }

    function tick() {
      const elapsed = (performance.now() - t0)/1000;
      const progress = clamp(elapsed / phaseSec, 0, 1);
      draw(progress);
      if (progress >= 1) {
        i++; if (i % 4 === 0) round++;
        if (round >= rounds) { stop(); return; }
        t0 = performance.now(); setPhase(i);
      }
      raf = requestAnimationFrame(tick);
    }

    function start() {
      if (raf) cancelAnimationFrame(raf);
      phaseSec = clamp(Number(secIn.value||12), 3, 120);
      rounds   = clamp(Number(roundsIn.value||3), 1, 20);
      S('observer:sec', phaseSec); S('observer:rounds', rounds); if (paceSel) S('observer:pace', paceSel.value);
      i = 0; round = 0; t0 = performance.now(); setPhase(i); draw(0);
      lockScreen(true); raf = requestAnimationFrame(tick);
    }
    function stop() {
      if (raf) cancelAnimationFrame(raf); raf = null;
      phaseTxt.textContent = 'Ready'; countTxt.textContent = '—'; draw(0);
      lockScreen(false); speak('Session complete');
    }

    on(startBtn, 'click', start);
    on(stopBtn,  'click', stop);
    on(document, 'visibilitychange', () => { if (document.hidden) stop(); });
  }

  /* -------------------------- Voice Gate (FFT) --------------------------- */
  function initAudioLab() {
    const btnStart = $('#micStart'), btnStop = $('#micStop');
    const wave = $('#wave'), fft = $('#fft'), hint = $('#nearKey');
    const stabilityTxt = $('#stability'), noiseWarn = $('#noiseWarn'), useCarrier = $('#useCarrier');
    if (!btnStart || !wave || !fft || !hint) return;

    /** Resize canvases to DPR & container */
    function resizeAll(){
      fitCanvas(wave); fitCanvas(fft);
      clearCanvas(wctx, wave); clearCanvas(fctx, fft);
    }
    const wctx = wave.getContext('2d', {alpha:false});
    const fctx = fft.getContext('2d',  {alpha:false});
    resizeAll();
    on(window,'resize',debounce(resizeAll,120));

    /** State */
    let ctx, src, analyser, rafId, stream;
    const FFT_SIZE = 2048;
    const CAR_KEYS = [432, 528, 369]; // Hz

    /** Drawing helpers */
    function clearCanvas(ctx2d, canvas){
      ctx2d.fillStyle = '#0f0f14'; ctx2d.fillRect(0,0,canvas.width,canvas.height);
      ctx2d.strokeStyle = '#2a2a33'; ctx2d.strokeRect(0,0,canvas.width,canvas.height);
    }
    function drawWave(data) {
      clearCanvas(wctx, wave);
      wctx.beginPath(); wctx.lineWidth = 2; wctx.strokeStyle = '#7af3ff';
      const step = wave.width / data.length;
      for (let i=0;i<data.length;i++){
        const v = (data[i]-128)/128; // -1..1
        const y = wave.height*(0.5 - v*0.45);
        const x = i*step;
        i===0 ? wctx.moveTo(x,y) : wctx.lineTo(x,y);
      }
      wctx.stroke();
    }
    function drawFFT(freq) {
      clearCanvas(fctx, fft);
      const N = freq.length;
      const max = Math.max(1, ...freq);
      const step = fft.width / N;
      fctx.fillStyle = '#7aa8ff';
      for (let i=0;i<N;i++){
        const mag = freq[i]/max;
        const h = mag * (fft.height-10);
        fctx.fillRect(i*step, fft.height-h, Math.max(1, step*0.9), h);
      }
    }

    // Simple stability + noise estimator over last few frames
    const lastPeaks = [];
    function stabilityUpdate(peakHz, energy){
      lastPeaks.push(peakHz); if (lastPeaks.length > 15) lastPeaks.shift();
      const mean = lastPeaks.reduce((a,b)=>a+b,0)/lastPeaks.length;
      const varSum = lastPeaks.reduce((a,b)=>a+(b-mean)*(b-mean),0)/Math.max(1,lastPeaks.length-1);
      const st = Math.max(0, 1 - Math.sqrt(varSum)/60); // rough: ±60Hz spread → 0 stability
      stabilityTxt && (stabilityTxt.textContent = `Stability: ${(st*100|0)}%`);
      const nz = Math.max(0, Math.min(1, 1 - energy)); // energy 0..1 (higher = cleaner tone), invert for "noise"
      noiseWarn && (noiseWarn.textContent = nz > 0.35 ? 'Noise: high' : 'Noise: ok');
      if (useCarrier) { useCarrier.disabled = !(peakHz && st > 0.6 && nz < 0.5); useCarrier.dataset.hz = String(peakHz); }
    }

    /** Peak & nearest-key detection */
    function analyze(freqData, sampleRate, fftSize) {
      let bestBin = 0, bestVal = 0;
      for (let i=2;i<freqData.length-2;i++){
        const v = freqData[i];
        if (v > bestVal && v > freqData[i-1] && v > freqData[i+1]) { bestVal = v; bestBin = i; }
      }
      const freq = bestBin * sampleRate / fftSize; // Hz
      let nearest = CAR_KEYS[0], dmin = Math.abs(freq - CAR_KEYS[0]);
      for (const k of CAR_KEYS.slice(1)) { const d = Math.abs(freq - k); if (d < dmin){ dmin=d; nearest=k; } }
      return {peakHz: freq, nearest, diff: dmin, energy: bestVal/255};
    }

    /** Main loop */
    function loop() {
      const timeData = new Uint8Array(analyser.fftSize);
      const freqData = new Uint8Array(analyser.frequencyBinCount);

      const step = () => {
        analyser.getByteTimeDomainData(timeData);
        analyser.getByteFrequencyData(freqData);
        drawWave(timeData);
        drawFFT(freqData);

        const {peakHz, nearest, diff, energy} = analyze(freqData, ctx.sampleRate, analyser.fftSize);
        if (Number.isFinite(peakHz) && peakHz > 50) {
          const close = Math.max(0, 1 - diff/18);
          hint.textContent = `Near ${nearest} Hz (peak ≈ ${fmt(peakHz,0)} Hz)`;
          hint.style.color = close > 0.7 ? '#7af3ff' : '#b8b3a6';
          stabilityUpdate(peakHz, energy);
          window._labSetCarrier?.({hz: peakHz, stable: close, noise: 1 - energy});
        } else {
          hint.textContent = '—'; hint.style.color = '#b8b3a6';
        }
        rafId = requestAnimationFrame(step);
      };
      step();
    }

    async function start() {
      try {
        if (ctx) await stop();
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation:true, noiseSuppression:true, channelCount:1 },
          video: false
        });
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = ctx.createAnalyser();
        analyser.fftSize = FFT_SIZE;
        analyser.smoothingTimeConstant = 0.85;
        src = ctx.createMediaStreamSource(stream);
        src.connect(analyser);
        loop();
      } catch (err) {
        hint.textContent = 'Microphone permission denied or unavailable.'; hint.style.color = '#f3c97a';
        console.error(err);
      }
    }
    async function stop() {
      cancelAnimationFrame(rafId);
      try { stream?.getTracks()?.forEach(t => t.stop()); } catch {}
      try { if (ctx && ctx.state !== 'closed') await ctx.close(); } catch {}
      ctx = src = analyser = stream = null;
      hint.textContent = '—'; hint.style.color = '#b8b3a6';
      clearCanvas(wctx, wave); clearCanvas(fctx, fft);
    }

    on(btnStart, 'click', start);
    on(btnStop,  'click', stop);
    on(document, 'visibilitychange', () => { if (document.hidden) stop(); });

    // “Set as carrier” → copy to fields + status
    on(useCarrier, 'click', (e) => {
      const v = e.currentTarget?.dataset?.hz;
      if (!v) return;
      const hz = Math.round(v);
      $('#carrierOut')  && ($('#carrierOut').value = hz);
      $('#qsCarrier')   && ($('#qsCarrier').value = hz);
      S('carrier', hz);
      const status = $('#lab-status'); if (status) status.textContent = `Carrier set: ${hz} Hz`;
    });
  }

  /* ------------------------- Phrase Tuner Pro ---------------------------- */
  function initPhraseTuner() {
    const inBox   = $('#phraseIn');
    const lane    = $('#chipLane');
    const btnTune = $('#btnTuned'), btnClear = $('#btnClearPhrase');
    const outNeg  = $('#negCount'), outSug = $('#phraseOut'), outScore = $('#semScore');
    if (!inBox || !lane) return;

    // Expanded negation list + contractions normalized
    const NEG = /\b(no|not|never|cant|won't|wont|don't|dont|isn't|isnt|aren't|arent|shouldn't|shouldnt|couldn't|couldnt|wouldn't|wouldnt|without|stop|avoid|against|can't)\b/gi;

    function tokenize(s) {
      return (s || '').trim().split(/(\s+|[.,!?;:()"'`~\[\]{}<>/\\\-])/).filter(Boolean);
    }

    function renderChips(tokens) {
      lane.innerHTML = '';
      const frag = document.createDocumentFragment();
      tokens.forEach((tok, idx) => {
        if (/\s+/.test(tok)) return;
        const chip = document.createElement('span');
        chip.className = 'chip'; chip.draggable = true;
        chip.dataset.idx = String(idx);
        chip.dataset.w = S('chip:w:'+tok) ?? '1.0';
        chip.textContent = tok;
        const ww = document.createElement('span'); ww.className = 'w'; ww.textContent = `w=${fmt(parseFloat(chip.dataset.w),2)}`;
        chip.appendChild(ww);

        chip.addEventListener('dragstart', e => { chip.classList.add('dragging'); e.dataTransfer.setData('text/plain', chip.dataset.idx); });
        chip.addEventListener('dragend', () => chip.classList.remove('dragging'));
        chip.addEventListener('click', () => {
          const next = { '0.5':'1.0','1.0':'1.5','1.5':'2.0','2.0':'0.5' }[chip.dataset.w] || '1.0';
          chip.dataset.w = next; ww.textContent = `w=${next}`; S('chip:w:'+tok, next); updateScore();
        });
        frag.appendChild(chip);
      });
      lane.appendChild(frag);
      lane.ondragover = e => { e.preventDefault(); const after = getDragAfter(e.clientX); if (after == null) lane.appendChild($('.chip.dragging')); else lane.insertBefore($('.chip.dragging'), after); };
      lane.ondrop = e => e.preventDefault();
    }
    function getDragAfter(x) {
      const chips = $$('.chip:not(.dragging)', lane);
      let closest = null, closestOffset = Number.NEGATIVE_INFINITY;
      chips.forEach(ch => {
        const rect = ch.getBoundingClientRect();
        const offset = x - rect.left - rect.width/2;
        if (offset < 0 && offset > closestOffset) { closestOffset = offset; closest = ch; }
      });
      return closest;
    }

    function tune() {
      const txt = inBox.value.trim();
      const tokens = tokenize(txt);
      renderChips(tokens);

      const norm = txt.replace(/’/g,"'").replace(/\bcan['’]?t\b/gi,'cant').replace(/\bwon['’]?t\b/gi,'wont')
                      .replace(/\bdon['’]?t\b/gi,'dont').replace(/\bisn['’]?t\b/gi,'isnt')
                      .replace(/\baren['’]?t\b/gi,'arent').replace(/\bshouldn['’]?t\b/gi,'shouldnt')
                      .replace(/\bcouldn['’]?t\b/gi,'couldnt').replace(/\bwouldn['’]?t\b/gi,'wouldnt');
      const negCount = (norm.match(NEG) || []).length;
      outNeg.textContent = String(negCount);

      const map = { no:'choose', not:'choose', never:'always choose', cant:'can', "can't":'can', wont:'will', "won't":'will',
                    dont:'do', "don't":'do', isnt:'is', "isn't":'is', arent:'are', "aren't":'are',
                    shouldnt:'should', couldnt:'could', wouldnt:'would', without:'with', stop:'begin', avoid:'select', against:'for' };

      const suggestion = norm
        .replace(NEG, (m) => map[m.toLowerCase()] || 'choose')
        .replace(/\bI don.?t want\b/gi, 'I choose')
        .replace(/\bi want\b/gi, 'I choose')
        .replace(/\s{2,}/g, ' ')
        .trim();

      outSug.innerHTML = suggestion ? highlightSuggestion(suggestion) : '—';
      updateScore(); S('phrase:in', txt);
    }

    function highlightSuggestion(s) {
      return s.split(/\s+/).map(tok => /ly$|^\W+$/.test(tok) ? tok : `<mark>${tok}</mark>`).join(' ');
    }

    function updateScore() {
      const chips = $$('.chip', lane);
      if (!chips.length) { outScore.textContent = 'Semantic weight: —'; return; }
      let sum = 0; let n = 0;
      chips.forEach(c => { sum += parseFloat(c.dataset.w||'1'); n++; });
      const score = sum / n;
      outScore.textContent = `Semantic weight: ${fmt(score,2)} (∑wₖ / N)`;
    }

    on(btnTune, 'click', tune);
    on(btnClear, 'click', () => { inBox.value = ''; lane.innerHTML=''; outNeg.textContent='0'; outSug.textContent='—'; outScore.textContent='Semantic weight: —'; S('phrase:in',''); });
    const last = S('phrase:in'); if (last) inBox.value = last;
    on(inBox, 'keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); tune(); } });
  }

  /* -------------------------- Coherence Desk ----------------------------- */
  function initCoherenceDesk() {
    const hDotI = $('#hDotI'), mVar = $('#mVar'), btnXi = $('#btnXi'), outXi = $('#outXi');
    const tau = $('#tauDays'), btnHL = $('#btnHalfLife'), outHL = $('#outHalfLife');
    const spark = $('#xiSpark'), ctx = spark?.getContext('2d', {alpha:false});
    if (!hDotI || !mVar || !btnXi || !outXi) return;

    const hist = S('xi:hist') || [];

    function drawSpark() {
      if (!ctx || !spark) return;
      fitCanvas(spark, spark.clientWidth, spark.clientHeight);
      ctx.fillStyle = '#0f0f14'; ctx.fillRect(0,0,spark.width,spark.height);
      if (!hist.length) return;
      const maxN = 60; const arr = hist.slice(-maxN);
      const min = Math.min(...arr); const max = Math.max(...arr);
      const range = Math.max(0.001, max - min);
      ctx.strokeStyle = '#7af3ff'; ctx.lineWidth = 2; ctx.beginPath();
      arr.forEach((v, i) => {
        const x = (i/(arr.length-1)) * (spark.width-8) + 4;
        const y = spark.height - 4 - ((v - min)/range)*(spark.height-8);
        i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
      });
      ctx.stroke();
    }

    function computeXi() {
      const a = clamp(parseFloat(hDotI.value||0), 0, 1);
      const v = clamp(parseFloat(mVar.value||0), 0, 2);
      const xi = a / (1 + v);
      outXi.textContent = `Ξ = ${fmt(xi,2)}`;
      hist.push(Number(fmt(xi,3))); S('xi:hist', hist); drawSpark();
      if ($('#autoLogXi')?.checked) ledger.addEntry({ auto: true, xi: fmt(xi,3) });
    }

    function computeHL() {
      if (!tau || !btnHL || !outHL) return;
      const T = clamp(parseFloat(tau.value||10), 1, 120);
      const lambda = 1 / T;
      const halfLife = Math.log(2) / lambda;
      outHL.textContent = `λ = ${fmt(lambda,3)} day⁻¹,  t½ = ${fmt(halfLife,2)} days`;
    }

    on(btnXi, 'click', computeXi);
    if (btnHL) on(btnHL, 'click', computeHL);
    drawSpark();
    on(window,'resize',debounce(drawSpark,120));
  }

  /* --------------------------- Visual Focus ------------------------------ */
  function initVisualFocus() {
    const cvs = $('#focusDot'), btn = $('#vfStart');
    const holdIn = $('#vfHold'), expIn = $('#vfExpand');
    if (!cvs || !btn) return;
    const ctx = cvs.getContext('2d', {alpha:false});
    const size = ()=>fitCanvas(cvs, cvs.clientWidth||600, cvs.clientHeight||280);
    size(); on(window,'resize',debounce(size,120));

    function drawDot(r){ // center dot
      ctx.fillStyle = '#0f0f14'; ctx.fillRect(0,0,cvs.width,cvs.height);
      const cx = (cvs.width)/2, cy = (cvs.height)/2;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2);
      ctx.fillStyle = '#f3c97a'; ctx.shadowColor = 'rgba(243,201,122,.6)'; ctx.shadowBlur = 12; ctx.fill();
      ctx.shadowBlur = 0;
    }
    function drawRing(r){ // expanding ring
      ctx.fillStyle = '#0f0f14'; ctx.fillRect(0,0,cvs.width,cvs.height);
      const cx = (cvs.width)/2, cy = (cvs.height)/2;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2);
      ctx.lineWidth = 6; ctx.strokeStyle = '#7af3ff';
      ctx.shadowColor = 'rgba(122,243,255,.4)'; ctx.shadowBlur = 10; ctx.stroke();
      ctx.shadowBlur = 0;
    }

    let raf=null, t0=0, phase='idle';
    function start() {
      cancelAnimationFrame(raf);
      const hold = clamp(getNum(holdIn,10), 5, 60);
      const expand = clamp(getNum(expIn,6), 3, 30);
      const dotR = 6, maxR = Math.min(cvs.width, cvs.height)/2 - 12;
      t0 = performance.now(); phase='hold'; speak('Single point. Hold.');

      const step = () => {
        const t = (performance.now() - t0)/1000;
        if (phase==='hold') {
          drawDot(dotR);
          if (t >= hold) { phase='expand'; t0=performance.now(); speak('Expand softly.'); }
        } else if (phase==='expand') {
          const p = clamp(t/expand, 0, 1);
          const r = dotR + (maxR - dotR)*p;
          drawRing(r);
          if (p>=1) { phase='idle'; speak('Cycle complete.'); return; }
        } else return;
        raf = requestAnimationFrame(step);
      };
      step();
    }

    on(btn, 'click', start);
    on(document, 'visibilitychange', ()=>{ if (document.hidden) cancelAnimationFrame(raf); });
  }

  /* --------------------------- Breath Ring ------------------------------- */
  function initBreathRing() {
    const fg = $('#breathFg'), pTxt = $('#breathPhase'), cTxt = $('#breathCount');
    const sel = $('#breathPattern'), btnStart = $('#breathStart'), btnStop = $('#breathStop');
    if (!fg || !pTxt || !cTxt || !sel || !btnStart || !btnStop) return;

    const patterns = {
      '4-4-4-4': [4,4,4,4],
      '4-7-8':  [4,7,8,0],
      '5-5-5-5':[5,5,5,5]
    };
    const names = ['Inhale','Hold','Exhale','Hold'];
    let raf=null, t0=0, idx=0, segs=[4,4,4,4], progress=0;

    function draw(p) { fg.style.strokeDashoffset = String(clamp(100 - p*100, 0, 100)); }
    function setSeg(i) {
      const n = names[i];
      pTxt.textContent = n; cTxt.textContent = `${n} ${segs[i]}s`;
      vibrate(8); speak(n);
    }
    function start() {
      segs = patterns[sel.value] || patterns['4-4-4-4'];
      idx=0; t0=performance.now(); setSeg(idx); draw(0); lockScreen(true);
      const step = () => {
        const elapsed = (performance.now()-t0)/1000;
        const segDur = segs[idx] || 0.0001;
        const p = clamp(elapsed/segDur, 0, 1);
        const half = (idx<=1);
        progress = half ? ((idx===0?0:segs[0]) + elapsed) / (segs[0]+segs[1] || 1)
                        : 1 - (((idx===2?0:segs[2]) + elapsed) / (segs[2]+segs[3] || 1));
        draw(clamp(progress,0,1));
        if (p>=1) { idx=(idx+1)%4; t0=performance.now(); setSeg(idx); }
        raf = requestAnimationFrame(step);
      };
      step();
    }
    function stop(){ cancelAnimationFrame(raf); raf=null; pTxt.textContent='Ready'; cTxt.textContent='—'; draw(0); lockScreen(false); }

    on(btnStart, 'click', start);
    on(btnStop, 'click', stop);
    on(document, 'visibilitychange', ()=>{ if (document.hidden) stop(); });
  }

  /* --------------------------- Witness Ledger ---------------------------- */
  const ledger = (function () {
    const T = $('#ledgerTable tbody');
    if (!T) return { addEntry: () => {} };

    const inI = $('#entryIntention'), inC = $('#entryCarrier'), inQ = $('#entryQuality'), inTags = $('#entryTags'), inW = $('#entryWitness');
    const btnAdd = $('#btnAddEntry'), btnExport = $('#btnExport'), btnImport = $('#btnImport'), fileImport = $('#fileImport');
    const outStreak = $('#streakDays'), filterIn = $('#ledgerFilter');
    const emptyState = $('#ledgerEmpty');

    // badge sets
    const badge7 = $('#badge7'), badge33 = $('#badge33'), badge144 = $('#badge144');
    const badge7b = $('#badge7b'), badge33b = $('#badge33b'), badge144b = $('#badge144b');

    // Insights
    const chart = $('#ledgerChart'); const chartCtx = chart?.getContext('2d',{alpha:false});
    const weekCount = $('#weekCount'), highRate = $('#highRate'), topTag = $('#topTag');
    function sizeChart(){ if (chart) fitCanvas(chart, chart.clientWidth||560, chart.clientHeight||120); }
    sizeChart(); on(window,'resize',debounce(sizeChart,120));

    // Helper chips
    $$('.lab-btn[data-stamp-quality]').forEach(b => on(b,'click',()=>{ if (inQ) inQ.value = b.dataset.stampQuality; }));
    $$('.lab-btn[data-add-tag]').forEach(b => on(b,'click',()=>{ if (!inTags) return; const t=b.dataset.addTag; const cur=(inTags.value||'').trim(); inTags.value = cur ? `${cur}, ${t}` : t; }));
    $$('.lab-btn[data-template]').forEach(b => on(b,'click',()=>{ if (inI && !inI.value) inI.value = b.dataset.template; }));

    let rows = S('ledger') || [];

    const byId = new Set(rows.map(r=>r.id)); // for dedupe on import
    function save() { S('ledger', rows); updateStreak(); paint(); drawInsights(); }

    function addEntry(partial={}) {
      const row = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random()),
        dt: nowIso(),
        I: partial.I ?? (inI?.value.trim() || ''),
        carrier: partial.carrier ?? (inC?.value.trim() || ''),
        xi: partial.xi ?? (inQ?.value || ''),
        tags: partial.tags ?? (inTags?.value.trim() || ''),
        witness: partial.witness ?? (inW?.value.trim() || ''),
        auto: !!partial.auto
      };
      if (byId.has(row.id)) row.id += '-d'; // ultra-rare
      byId.add(row.id);
      rows.unshift(row); save();
      inC && (inC.value=''); inW && (inW.value=''); inTags && (inTags.value=''); inQ && (inQ.value='');
      emptyState && (emptyState.style.display = rows.length ? 'none' : 'block');
    }
    function del(id) { rows = rows.filter(r => r.id !== id); byId.delete(id); save(); emptyState && (emptyState.style.display = rows.length ? 'none' : 'block'); }

    function esc(s){ return (s||'').replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }

    function paint() {
      const q = (filterIn?.value || '').toLowerCase();
      T.innerHTML = '';
      for (const r of rows) {
        if (q && !(r.I+','+r.tags+','+r.witness).toLowerCase().includes(q)) continue;
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${new Date(r.dt).toLocaleString()}</td>
          <td>${esc(r.I)}</td>
          <td>${esc(r.carrier||'')}</td>
          <td>${esc(r.xi||'')}</td>
          <td>${esc(r.tags||'')}</td>
          <td>${esc(r.witness||'')}</td>
          <td><button data-del="${r.id}" aria-label="Delete entry">✕</button></td>`;
        T.appendChild(tr);
      }
      emptyState && (emptyState.style.display = rows.length ? 'none' : 'block');
    }

    function updateStreak() {
      const set = new Set(rows.map(r => r.dt.slice(0,10)));
      let streak = 0; let d = new Date(); d.setHours(0,0,0,0);
      while (set.has(d.toISOString().slice(0,10))) { streak++; d.setDate(d.getDate()-1); }
      outStreak && (outStreak.textContent = String(streak));
      // toggle both badge sets
      [badge7,badge7b].forEach(b => b?.classList.toggle('unlit', streak < 7));
      [badge33,badge33b].forEach(b => b?.classList.toggle('unlit', streak < 33));
      [badge144,badge144b].forEach(b => b?.classList.toggle('unlit', streak < 144));
      [badge7,badge7b,badge33,badge33b,badge144,badge144b].forEach(b => b?.classList.toggle('lit', !b?.classList.contains('unlit')));
    }

    function drawInsights() {
      if (!chartCtx || !chart) return;
      sizeChart();
      // last 7 days window
      const now = new Date(); const d7 = new Date(now.getTime() - 7*864e5);
      const recent = rows.filter(r => new Date(r.dt) >= d7);

      weekCount && (weekCount.textContent = `Entries (7d): ${recent.length}`);

      const hi = recent.filter(r => (String(r.xi)||'').toLowerCase().includes('high') || parseFloat(r.xi) >= 0.8).length;
      highRate && (highRate.textContent = recent.length ? `Ξ High rate: ${Math.round(100*hi/recent.length)}%` : 'Ξ High rate: —');

      // Top tag (last 30d)
      const d30 = new Date(now.getTime() - 30*864e5);
      const tags = {};
      rows.filter(r => new Date(r.dt) >= d30).forEach(r => {
        (r.tags||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean).forEach(t => tags[t]=(tags[t]||0)+1);
      });
      const top = Object.entries(tags).sort((a,b)=>b[1]-a[1])[0];
      topTag && (topTag.textContent = top ? `Top tag: #${top[0]} (${top[1]})` : 'Top tag: —');

      // Sparkline
      const scores = recent.map(r => {
        const x = parseFloat(r.xi);
        if (Number.isFinite(x)) return clamp(x, 0, 1);
        const s = (String(r.xi)||'').toLowerCase();
        if (s.includes('high')) return 0.9;
        if (s.includes('med'))  return 0.6;
        if (s.includes('low'))  return 0.3;
        return 0.5;
      });
      chartCtx.fillStyle = '#0f0f14'; chartCtx.fillRect(0,0,chart.width,chart.height);
      if (!scores.length) return;
      const min = Math.min(...scores), max = Math.max(...scores);
      const range = Math.max(0.001, max-min);
      chartCtx.strokeStyle = '#7af3ff'; chartCtx.lineWidth = 2; chartCtx.beginPath();
      scores.forEach((v,i)=>{
        const x = (i/(scores.length-1))*(chart.width-8)+4;
        const y = chart.height-4 - ((v-min)/range)*(chart.height-8);
        i===0 ? chartCtx.moveTo(x,y) : chartCtx.lineTo(x,y);
      });
      chartCtx.stroke();
    }

    function exportJson() {
      const blob = new Blob([JSON.stringify(rows, null, 2)], {type:'application/json'});
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `codex-ledger-${todayKey()}.json`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
    }
    function importJson(file) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (Array.isArray(data)) {
            for (const r of data) { if (r && !byId.has(r.id)) { byId.add(r.id); rows.push(r); } }
            rows.sort((a,b)=> new Date(b.dt) - new Date(a.dt));
            save();
          }
        } catch { alert('Invalid JSON.'); }
      };
      reader.readAsText(file);
    }

    on(btnAdd, 'click', () => addEntry());
    on(T, 'click', (e) => { const id = e.target?.dataset?.del; if (id) del(id); });
    on(btnExport, 'click', exportJson);
    on(btnImport, 'click', () => fileImport?.click());
    on(fileImport, 'change', () => { const f = fileImport.files?.[0]; if (f) importJson(f); fileImport.value=''; });
    on(filterIn, 'input', () => { paint(); drawInsights(); });

    updateStreak(); paint(); drawInsights();
    emptyState && (emptyState.style.display = rows.length ? 'none' : 'block');

    return { addEntry };
  })();

  /* --------------------------- Help overlay ------------------------------ */
  function toggleHelp() {
    let el = $('#labHelp');
    if (!el) {
      el = document.createElement('div');
      el.id = 'labHelp';
      el.style.cssText = 'position:fixed;inset:0;z-index:60;background:rgba(10,10,14,.6);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:16px';
      el.innerHTML = `
        <div class="panel" style="max-width:720px;background:#101017;border:1px solid #2a2a33;border-radius:14px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.45)">
          <div style="padding:14px 16px;border-bottom:1px solid #23232c;font:600 16px Inter;color:#eae7df;">Teaching Lab — Quick Keys</div>
          <div style="padding:14px 16px;color:#b8b3a6;line-height:1.6">
            <p><b>1–7</b> switch tabs • <b>S</b> start/stop ring • <b>Ctrl/⌘+K</b> focus Phrase box • <b>Ctrl/⌘+G</b> Voice Gate • <b>Ctrl/⌘+L</b> Ledger.</p>
            <p>Click tokens in Phrase Tuner to cycle weights (0.5→1→1.5→2→0.5). Drag chips to reorder emphasis.</p>
            <p>Export your ledger to .json anytime; data stays on this device unless you export it.</p>
          </div>
          <div style="padding:12px 16px;border-top:1px solid #23232c;display:flex;justify-content:flex-end">
            <button id="labHelpClose" style="appearance:none;border:1px solid #2a2a33;background:rgba(255,255,255,.03);color:#eae7df;padding:8px 10px;border-radius:10px;font:600 13px Inter;cursor:pointer">Close</button>
          </div>
        </div>`;
      document.body.appendChild(el);
      $('#labHelpClose')?.addEventListener('click', toggleHelp);
      el.addEventListener('click', (e)=>{ if (e.target === el) toggleHelp(); });
    } else {
      el.remove();
    }
  }

  /* ------------------------ Page bootstrap ------------------------------- */
  function boot() {
    revealOnScroll();
    initTabs();
    initCoach();
    initQuickStart();
    initObserver();
    initAudioLab();
    initPhraseTuner();
    initCoherenceDesk();
    initVisualFocus();
    initBreathRing();

    // Year in footer
    const yr = $('#yr'); if (yr) yr.textContent = String(new Date().getFullYear());

    // Power-user focus jumpers
    on(document, 'keydown', (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() === 'k') { e.preventDefault(); $('#phraseIn')?.focus(); }
      if (e.key.toLowerCase() === 'g') { e.preventDefault(); $('.pill[data-tab="voice"]')?.click(); }
      if (e.key.toLowerCase() === 'l') { e.preventDefault(); $('.pill[data-tab="ledger"]')?.click(); }
    });

    // Offline hint (status line)
    const status = $('#lab-status');
    function net() { status && (status.textContent = navigator.onLine ? 'Ready.' : 'Offline: ledger & tools available.'); }
    on(window,'online',net); on(window,'offline',net); net();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
