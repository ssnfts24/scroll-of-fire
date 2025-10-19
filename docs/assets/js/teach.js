/* ========================================================================
   Scroll of Fire — Teaching Lab Engine
   - Zero libraries, offline-first
   - Accessibility & mobile friendly
   - Defensive: permissions, motion/data preferences, errors handled
   - Persistent state via localStorage (namespaced)
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
  const NS = 'codex:teach:';                            // storage namespace
  const S  = (k, v) => v === undefined
    ? JSON.parse(localStorage.getItem(NS+k) || 'null')
    : localStorage.setItem(NS+k, JSON.stringify(v));
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);

  /* Visible helper for cards (so they’re not stuck at opacity:0) */
  function revealOnScroll() {
    const cards = $$('.card');
    if (!('IntersectionObserver' in window)) {
      cards.forEach(c => c.classList.add('visible')); return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
      });
    }, {rootMargin: '140px 0px'});
    cards.forEach(c => io.observe(c));
    // Safety net: force-show after first tick
    setTimeout(() => cards.forEach(c => c.classList.add('visible')), 900);
  }

  /* ----------------------------- Tabs ----------------------------------- */
  function initTabs() {
    const pills  = $$('.pill[role="tab"]');
    const panels = $$('.tab');
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
    // restore last tab
    const last = S('tab') || 'observer';
    activate(last);
  }

  /* -------------------------- Coach Mode -------------------------------- */
  function initCoach() {
    const box = $('#coach');
    const enabled = S('coach') ?? false;
    if (box) { box.checked = !!enabled; toggle(box.checked); }
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

    const PHASES = ['𝓘 • Intend', '𝓛 • Light', '𝓒 • Witness', '𝓢 • Return'];
    let timer = null, i = 0, round = 0, totalPhases = 0, phaseSec = 12, rounds = 3, t0=0;

    // Restore user prefs
    const savedSec = S('observer:sec'); const savedRounds = S('observer:rounds');
    if (savedSec)   secIn.value = clamp(savedSec, 3, 120);
    if (savedRounds) roundsIn.value = clamp(savedRounds, 1, 20);

    function draw(progress01) {
      // ring is drawn with stroke-dashoffset (0 filled, 100 empty)
      const dash = clamp(100 - progress01*100, 0, 100);
      ringFg.style.strokeDashoffset = String(dash);
    }

    function setPhase(idx) {
      const p = idx % 4; phaseTxt.textContent = PHASES[p];
      countTxt.textContent = `Round ${round+1}/${rounds} • Phase ${p+1}/4`;
    }

    function tick() {
      const elapsed = (performance.now() - t0)/1000;
      const progress = clamp(elapsed / phaseSec, 0, 1);
      draw(progress);
      if (progress >= 1) {
        // next phase
        i++; totalPhases++;
        t0 = performance.now();
        if (i % 4 === 0) round++;
        if (round >= rounds) { stop(); return; }
        setPhase(i);
      }
      timer = requestAnimationFrame(tick);
    }

    function start() {
      if (timer) cancelAnimationFrame(timer);
      phaseSec = clamp(Number(secIn.value||12), 3, 120);
      rounds   = clamp(Number(roundsIn.value||3), 1, 20);
      S('observer:sec', phaseSec); S('observer:rounds', rounds);
      i = 0; round = 0; totalPhases = 0; t0 = performance.now();
      setPhase(i); draw(0);
      timer = requestAnimationFrame(tick);
    }
    function stop() {
      if (timer) cancelAnimationFrame(timer); timer = null;
      phaseTxt.textContent = 'Ready'; countTxt.textContent = '—'; draw(0);
    }
    on(startBtn, 'click', start);
    on(stopBtn, 'click', stop);
  }

  /* -------------------------- Voice Gate (FFT) --------------------------- */
  function initAudioLab() {
    const btnStart = $('#micStart'), btnStop = $('#micStop');
    const wave = $('#wave'), fft = $('#fft'), hint = $('#nearKey');

    if (!btnStart || !wave || !fft) return;

    /** State */
    let ctx, src, analyser, rafId;
    const FFT_SIZE = 2048;
    const CAR_KEYS = [432, 528, 369]; // Hz

    /** Drawing helpers */
    const wctx = wave.getContext('2d', {alpha:false});
    const fctx = fft.getContext('2d',  {alpha:false});
    function clearCanvas(ctx, canvas){
      ctx.fillStyle = '#0f0f14'; ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.strokeStyle = '#2a2a33'; ctx.strokeRect(0,0,canvas.width,canvas.height);
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
        fctx.fillRect(i*step, fft.height-h, step*0.9, h);
      }
    }

    /** Peak & nearest-key detection */
    function analyze(freqData, sampleRate, fftSize) {
      // bin index -> frequency: f = bin * sampleRate / fftSize
      let bestBin = 0, bestVal = 0;
      for (let i=1;i<freqData.length-1;i++){
        const v = freqData[i];
        // simple peak test
        if (v > bestVal && v > freqData[i-1] && v > freqData[i+1]) {
          bestVal = v; bestBin = i;
        }
      }
      const freq = bestBin * sampleRate / fftSize;
      let nearest = CAR_KEYS[0], dmin = Math.abs(freq - CAR_KEYS[0]);
      for (const k of CAR_KEYS.slice(1)) {
        const d = Math.abs(freq - k);
        if (d < dmin){ dmin = d; nearest = k; }
      }
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
          const closeness = Math.max(0, 1 - diff/20); // within 20Hz = strong
          hint.textContent = `Near ${nearest} Hz (peak ~ ${fmt(peakHz,0)} Hz)`;
          hint.style.color = closeness > 0.7 ? '#7af3ff' : '#b8b3a6';
        } else {
          hint.textContent = '—';
        }
        rafId = requestAnimationFrame(step);
      };
      step();
    }

    async function start() {
      try {
        if (ctx) await stop();
        // Permissions & constraints: prefer built-in mic, mono, low latency
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
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
        hint.textContent = 'Microphone permission denied/unavailable.';
        console.error(err);
      }
    }
    async function stop() {
      cancelAnimationFrame(rafId);
      if (src && src.mediaStream){
        src.mediaStream.getTracks().forEach(t => t.stop());
      }
      if (ctx && ctx.state !== 'closed') await ctx.close();
      ctx = src = analyser = null;
      hint.textContent = '—';
      clearCanvas(wctx, wave); clearCanvas(fctx, fft);
    }

    on(btnStart, 'click', start);
    on(btnStop,  'click', stop);
    // Auto-stop on visibility change (battery/memory friendly)
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
      // simple tokenizer splits on spaces/punct but keeps words & numbers
      return (s || '').trim().split(/(\s+|[.,!?;:()"'`~\[\]{}<>/\\\-])/).filter(Boolean);
    }

    function renderChips(tokens) {
      lane.innerHTML = '';
      const frag = document.createDocumentFragment();
      tokens.forEach((tok, idx) => {
        if (/\s+/.test(tok)) return; // skip pure whitespace tokens as chips
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.draggable = true;
        chip.dataset.idx = String(idx);
        chip.dataset.w = S('chip:w:'+tok) ?? '1.0';
        chip.textContent = tok;
        const ww = document.createElement('span');
        ww.className = 'w';
        ww.textContent = `w=${fmt(parseFloat(chip.dataset.w),2)}`;
        chip.appendChild(ww);
        // drag to reorder emphasis
        chip.addEventListener('dragstart', e => {
          chip.classList.add('dragging'); e.dataTransfer.setData('text/plain', chip.dataset.idx);
        });
        chip.addEventListener('dragend', () => chip.classList.remove('dragging'));
        // click to cycle weight 0.5 → 1 → 1.5 → 2.0 → 0.5
        chip.addEventListener('click', () => {
          const next = { '0.5':'1.0','1.0':'1.5','1.5':'2.0','2.0':'0.5' }[chip.dataset.w] || '1.0';
          chip.dataset.w = next; ww.textContent = `w=${next}`; S('chip:w:'+tok, next);
          updateScore();
        });
        frag.appendChild(chip);
      });
      lane.appendChild(frag);
      // Enable drop on lane
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
          // very basic reframe
          const map = { 'no':'choose', 'not':'choose', 'never':'always choose', "can't":'can', "won't":'will', "don't":'do', "isn't":'is', "aren't":'are', "shouldn\'t":'should', "couldn\'t":'could', "wouldn\'t":'would', 'without':'with', 'stop':'begin', 'avoid':'select', 'against':'for' };
          return (map[m.toLowerCase()] || 'choose');
        })
        .replace(/\bI don.?t want\b/gi, 'I choose')
        .replace(/\bi want\b/gi, 'I choose')
        .replace(/\s{2,}/g, ' ')
        .trim();

      outSug.innerHTML = suggestion ? highlightSuggestion(suggestion) : '—';
      updateScore();
      S('phrase:in', txt);
    }

    function highlightSuggestion(s) {
      // emphasize verbs/nouns-ish by simple POS proxy (ends with ly? deemphasize)
      return s.split(/\s+/).map(tok => /ly$|^\W+$/.test(tok) ? tok : `<mark>${tok}</mark>`).join(' ');
    }

    function updateScore() {
      const chips = $$('.chip', lane);
      if (!chips.length) { outScore.textContent = 'Semantic weight: —'; return; }
      let sum = 0, n = 0;
      chips.forEach(c => { sum += parseFloat(c.dataset.w||'1'); n++; });
      const score = sum / n; // average weight ~ “clarity”
      outScore.textContent = `Semantic weight: ${fmt(score,2)} (∑wₖ / N)`;
    }

    on(btnTune, 'click', tune);
    on(btnClear, 'click', () => { inBox.value = ''; lane.innerHTML=''; outNeg.textContent='0'; outSug.textContent='—'; outScore.textContent='Semantic weight: —'; S('phrase:in',''); });
    // Restore last input
    const last = S('phrase:in'); if (last) { inBox.value = last; }

    // Enter key to tune
    on(inBox, 'keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); tune(); } });
  }

  /* -------------------------- Coherence Desk ----------------------------- */
  function initCoherenceDesk() {
    const hDotI = $('#hDotI'), mVar = $('#mVar'), btnXi = $('#btnXi'), outXi = $('#outXi');
    const tau = $('#tauDays'), btnHL = $('#btnHalfLife'), outHL = $('#outHalfLife');
    const spark = $('#xiSpark'), ctx = spark?.getContext('2d', {alpha:false});

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
      hist.push(Number(fmt(xi,3)));
      S('xi:hist', hist);
      drawSpark();
      if ($('#autoLogXi')?.checked) ledger.addEntry({ auto: true, xi });
    }

    function computeHL() {
      const T = clamp(parseFloat(tau.value||10), 1, 120);
      const lambda = 1 / T;
      const halfLife = Math.log(2) / lambda;
      outHL.textContent = `λ = ${fmt(lambda,3)} day⁻¹,  t½ = ${fmt(halfLife,2)} days`;
    }

    on(btnXi, 'click', computeXi);
    on(btnHL, 'click', computeHL);
    drawSpark();
  }

  /* --------------------------- Witness Ledger ---------------------------- */
  const ledger = (function () {
    const T = $('#ledgerTable tbody');
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
        I: partial.I ?? inI.value.trim(),
        carrier: partial.carrier ?? inC.value.trim(),
        xi: partial.xi ?? (inQ.value || ''),
        tags: partial.tags ?? inTags.value.trim(),
        witness: partial.witness ?? inW.value.trim(),
        auto: !!partial.auto
      };
      rows.unshift(row); save();
      // clear inputs (but keep intention text to encourage iteration)
      inCarrierClear(); inW.value=''; inTags.value=''; inQ.value='';
    }
    function inCarrierClear(){ inC.value=''; }

    function del(id) { rows = rows.filter(r => r.id !== id); save(); }

    function paint() {
      const q = (filterIn.value || '').toLowerCase();
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
          <td><button data-del="${r.id}">✕</button></td>`;
        T.appendChild(tr);
      }
    }
    function esc(s){ return (s||'').replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }

    function updateStreak() {
      // streak in days with any entry
      const set = new Set(rows.map(r => r.dt.slice(0,10)));
      let streak = 0; let d = new Date(); d.setHours(0,0,0,0);
      while (set.has(d.toISOString().slice(0,10))) { streak++; d.setDate(d.getDate()-1); }
      outStreak.textContent = String(streak);
      // badges
      badge7?.classList.toggle('unlit', streak < 7);
      badge33?.classList.toggle('unlit', streak < 33);
      badge144?.classList.toggle('unlit', streak < 144);
    }

    function exportJson() {
      const blob = new Blob([JSON.stringify(rows, null, 2)], {type:'application/json'});
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `codex-ledger-${todayKey()}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(a.href);
    }
    function importJson(file) {
      const reader = new FileReader();
      reader.onload = () => {
        try { const data = JSON.parse(reader.result); if (Array.isArray(data)) { rows = data.concat(rows); save(); } }
        catch (e) { alert('Invalid JSON.'); }
      };
      reader.readAsText(file);
    }

    // events
    on(btnAdd, 'click', () => addEntry());
    on(T, 'click', (e) => {
      const id = e.target?.dataset?.del; if (id) del(id);
    });
    on(btnExport, 'click', exportJson);
    on(btnImport, 'click', () => fileImport.click());
    on(fileImport, 'change', () => { const f = fileImport.files?.[0]; if (f) importJson(f); fileImport.value=''; });
    on(filterIn, 'input', paint);

    // init once
    updateStreak(); paint();

    return { addEntry };
  })();

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

    // Keyboard shortcuts (power-user)
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
