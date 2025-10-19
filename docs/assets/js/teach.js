/* ========================================================================
   Scroll of Fire — Teaching Lab Engine  (teach.js)
   - Zero libraries, offline-first, mobile-friendly
   - Defensive: permissions, motion/data prefs, visibility, errors handled
   - Persistent state via localStorage (namespaced)
   - All features gracefully skip if corresponding controls aren’t in DOM
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
  const prefersReducedData = matchMedia('(prefers-reduced-data: reduce)').matches;
  const NS = 'codex:teach:'; // storage namespace
  const S  = (k, v) => v === undefined
    ? JSON.parse(localStorage.getItem(NS+k) || 'null')
    : localStorage.setItem(NS+k, JSON.stringify(v));
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);
  const vibrate = (ms=12) => (navigator.vibrate && !prefersReducedMotion) ? navigator.vibrate(ms) : void 0;

  // Announce helper (opt-in if you add a checkbox#speakPrompts in HTML)
  function speak(line){
    const box = $('#speakPrompts');
    if (!('speechSynthesis' in window) || !box || !box.checked) return;
    try { window.speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(line)); } catch {}
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

  /* ----------------------------- Tabs ----------------------------------- */
  function initTabs() {
    const pills  = $$('.pill[role="tab"]');
    const panels = $$('.tab');
    if (!pills.length || !panels.length) return;

    function activate(name) {
      pills.forEach(b => {
        const is = (b.dataset.tab === name);
        b.classList.toggle('active', is);
        b.setAttribute('aria-selected', is ? 'true' : 'false');
      });
      panels.forEach(p => {
        const is = (p.id === 'tab-' + name);
        p.classList.toggle('active', is);
        p.setAttribute('aria-hidden', is ? 'false' : 'true');
        if (is) (p.querySelector('button, input, textarea, select, a')||p).focus({preventScroll:true});
      });
      S('tab', name);
    }
    pills.forEach(b => on(b, 'click', () => activate(b.dataset.tab)));
    activate(S('tab') || 'observer');

    // Optional numeric shortcuts 1..5 (if header tip mentions it)
    on(document, 'keydown', (e) => {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      const map = { '1':'observer','2':'voice','3':'phrase','4':'coherence','5':'ledger' };
      if (map[e.key]) { e.preventDefault(); activate(map[e.key]); }
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault(); toggleHelp();
      }
      if (e.key.toLowerCase() === 's') {
        e.preventDefault(); $('#startTimer')?.click();
      }
    });
  }

  /* -------------------------- Coach Mode -------------------------------- */
  function initCoach() {
    const box = $('#coach');
    if (!box) return;
    const enabled = S('coach') ?? false;
    box.checked = !!enabled; toggle(box.checked);
    function toggle(on) {
      document.body.classList.toggle('coach-on', on);
      S('coach', !!on);
    }
    on(box, 'change', () => toggle(box.checked));
  }

  /* ----------------------- Observer 4-Beat Ring -------------------------- */
  function initObserver() {
    const ringFg = $('#ringFg'), phaseTxt = $('#ringPhase'), countTxt = $('#ringCount');
    const secIn = $('#phaseSec'), roundsIn = $('#rounds');
    const startBtn = $('#startTimer'), stopBtn = $('#stopTimer');
    if (!ringFg || !phaseTxt || !secIn || !roundsIn || !startBtn || !stopBtn) return;

    // Optional beeper (soft short tick at each phase boundary)
    let audioCtx, beepOsc, beepGain;
    function beep() {
      if (prefersReducedMotion || prefersReducedData) return;
      try {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        beepOsc = audioCtx.createOscillator(); beepGain = audioCtx.createGain();
        beepOsc.frequency.value = 660; // gentle click
        beepGain.gain.value = 0.0001;
        beepOsc.connect(beepGain).connect(audioCtx.destination);
        beepOsc.start();
        beepGain.gain.exponentialRampToValueAtTime(0.04, audioCtx.currentTime + 0.02);
        beepGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.08);
        beepOsc.stop(audioCtx.currentTime + 0.10);
      } catch {}
    }

    const PHASES = [
      {k:'𝓘', label:'Intend', prompt:'Choose one clean line.'},
      {k:'𝓛', label:'Light',   prompt:'See/feel the clean line.'},
      {k:'𝓒', label:'Witness', prompt:'Notice one factual change.'},
      {k:'𝓢', label:'Return',  prompt:'Thank & release.'}
    ];

    let raf=null, i=0, round=0, phaseSec=12, rounds=3, t0=0;

    // Restore user prefs
    const savedSec = S('observer:sec'); const savedRounds = S('observer:rounds');
    if (savedSec)   secIn.value = clamp(savedSec, 3, 120);
    if (savedRounds) roundsIn.value = clamp(savedRounds, 1, 20);

    function draw(progress01) {
      const dash = clamp(100 - progress01*100, 0, 100); // 0 full, 100 empty
      ringFg.style.strokeDashoffset = String(dash);
    }

    function setPhase(idx) {
      const p = idx % 4, P = PHASES[p];
      phaseTxt.textContent = `${P.k} • ${P.label}`;
      countTxt.textContent = `Round ${round+1}/${rounds} • Phase ${p+1}/4`;
      vibrate(10); beep(); speak(P.prompt);
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
      S('observer:sec', phaseSec); S('observer:rounds', rounds);
      i = 0; round = 0; t0 = performance.now(); setPhase(i); draw(0);
      raf = requestAnimationFrame(tick);
    }
    function stop() {
      if (raf) cancelAnimationFrame(raf); raf = null;
      phaseTxt.textContent = 'Ready'; countTxt.textContent = '—'; draw(0);
      speak('Session complete');
    }

    on(startBtn, 'click', start);
    on(stopBtn,  'click', stop);
    // Battery/memory safety
    on(document, 'visibilitychange', () => { if (document.hidden) stop(); });
  }

  /* -------------------------- Voice Gate (FFT) --------------------------- */
  function initAudioLab() {
    const btnStart = $('#micStart'), btnStop = $('#micStop');
    const wave = $('#wave'), fft = $('#fft'), hint = $('#nearKey');
    if (!btnStart || !wave || !fft || !hint) return;

    /** State */
    let ctx, src, analyser, rafId;
    const FFT_SIZE = 2048;
    const CAR_KEYS = [432, 528, 369]; // Hz (order doesn’t matter)

    /** Drawing helpers */
    const wctx = wave.getContext('2d', {alpha:false});
    const fctx = fft.getContext('2d',  {alpha:false});
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
      return {peakHz: freq, nearest, diff: dmin};
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

        const {peakHz, nearest, diff} = analyze(freqData, ctx.sampleRate, analyser.fftSize);
        if (Number.isFinite(peakHz)) {
          const close = Math.max(0, 1 - diff/18); // within ~18Hz = strong
          hint.textContent = `Near ${nearest} Hz (peak ≈ ${fmt(peakHz,0)} Hz)`;
          hint.style.color = close > 0.7 ? '#7af3ff' : '#b8b3a6';
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
        const stream = await navigator.mediaDevices.getUserMedia({
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
        hint.textContent = 'Microphone permission denied/unavailable.'; hint.style.color = '#f3c97a';
        console.error(err);
      }
    }
    async function stop() {
      cancelAnimationFrame(rafId);
      if (src && src.mediaStream){ src.mediaStream.getTracks().forEach(t => t.stop()); }
      if (ctx && ctx.state !== 'closed') await ctx.close();
      ctx = src = analyser = null;
      hint.textContent = '—'; hint.style.color = '#b8b3a6';
      clearCanvas(wctx, wave); clearCanvas(fctx, fft);
    }

    on(btnStart, 'click', start);
    on(btnStop,  'click', stop);
    on(document, 'visibilitychange', () => { if (document.hidden) stop(); });
  }

  /* ------------------------- Phrase Tuner Pro ---------------------------- */
  function initPhraseTuner() {
    const inBox   = $('#phraseIn');
    const lane    = $('#chipLane');
    const btnTune = $('#btnTuned'), btnClear = $('#btnClearPhrase');
    const outNeg  = $('#negCount'), outSug = $('#phraseOut'), outScore = $('#semScore');
    if (!inBox || !lane) return;

    const NEG = /\b(no|not|never|can't|won't|don't|isn't|aren't|shouldn't|couldn't|wouldn't|without|stop|avoid|against)\b/gi;

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

      const negCount = (txt.match(NEG) || []).length;
      outNeg.textContent = String(negCount);

      const suggestion = txt
        .replace(NEG, (m) => {
          const map = { 'no':'choose', 'not':'choose', 'never':'always choose', "can't":'can', "won't":'will', "don't":'do', "isn't":'is', "aren't":'are', "shouldn\'t":'should', "couldn\'t":'could', "wouldn\'t":'would', 'without':'with', 'stop':'begin', 'avoid':'select', 'against':'for' };
          return (map[m.toLowerCase()] || 'choose');
        })
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
      if ($('#autoLogXi')?.checked) ledger.addEntry({ auto: true, xi });
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
  }

  /* --------------------------- Witness Ledger ---------------------------- */
  const ledger = (function () {
    const T = $('#ledgerTable tbody');
    if (!T) return { addEntry: () => {} };

    const inI = $('#entryIntention'), inC = $('#entryCarrier'), inQ = $('#entryQuality'), inTags = $('#entryTags'), inW = $('#entryWitness');
    const btnAdd = $('#btnAddEntry'), btnExport = $('#btnExport'), btnImport = $('#btnImport'), fileImport = $('#fileImport');
    const outStreak = $('#streakDays'), filterIn = $('#ledgerFilter');
    const badge7 = $('#badge7'), badge33 = $('#badge33'), badge144 = $('#badge144');

    let rows = S('ledger') || [];

    function save() { S('ledger', rows); updateStreak(); paint(); }
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
      rows.unshift(row); save();
      if (inC) inC.value=''; if (inW) inW.value=''; if (inTags) inTags.value=''; if (inQ) inQ.value='';
    }
    function del(id) { rows = rows.filter(r => r.id !== id); save(); }

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
    }
    function esc(s){ return (s||'').replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }

    function updateStreak() {
      const set = new Set(rows.map(r => r.dt.slice(0,10)));
      let streak = 0; let d = new Date(); d.setHours(0,0,0,0);
      while (set.has(d.toISOString().slice(0,10))) { streak++; d.setDate(d.getDate()-1); }
      if (outStreak) outStreak.textContent = String(streak);
      badge7?.classList.toggle('unlit', streak < 7);
      badge33?.classList.toggle('unlit', streak < 33);
      badge144?.classList.toggle('unlit', streak < 144);
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
        try { const data = JSON.parse(reader.result); if (Array.isArray(data)) { rows = data.concat(rows); save(); } }
        catch { alert('Invalid JSON.'); }
      };
      reader.readAsText(file);
    }

    on(btnAdd, 'click', () => addEntry());
    on(T, 'click', (e) => { const id = e.target?.dataset?.del; if (id) del(id); });
    on(btnExport, 'click', exportJson);
    on(btnImport, 'click', () => fileImport?.click());
    on(fileImport, 'change', () => { const f = fileImport.files?.[0]; if (f) importJson(f); fileImport.value=''; });
    on(filterIn, 'input', paint);

    updateStreak(); paint();
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
        <div style="max-width:720px;background:#101017;border:1px solid #2a2a33;border-radius:14px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.45)">
          <div style="padding:14px 16px;border-bottom:1px solid #23232c;font:600 16px Inter;color:#eae7df;">Teaching Lab — Quick Keys</div>
          <div style="padding:14px 16px;color:#b8b3a6;line-height:1.6">
            <p><b>1–5</b> switch tabs • <b>S</b> start/stop ring • <b>Ctrl/⌘+K</b> focus Phrase box • <b>Ctrl/⌘+G</b> Voice Gate • <b>Ctrl/⌘+L</b> Ledger.</p>
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
    initObserver();
    initAudioLab();
    initPhraseTuner();
    initCoherenceDesk();

    // Year in footer
    const yr = $('#yr'); if (yr) yr.textContent = String(new Date().getFullYear());

    // Power-user focus jumpers
    on(document, 'keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'k') { e.preventDefault(); $('#phraseIn')?.focus(); }
        if (e.key.toLowerCase() === 'g') { e.preventDefault(); $('.pill[data-tab="voice"]')?.click(); }
        if (e.key.toLowerCase() === 'l') { e.preventDefault(); $('.pill[data-tab="ledger"]')?.click(); }
      }
    });
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
