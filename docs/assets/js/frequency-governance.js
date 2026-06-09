/* =====================================================
   Scroll of Fire — Frequency Governance
   Stable DJ Observatory Build
   File: assets/js/frequency-governance.js
===================================================== */

(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);

  const PRESETS = [
    [40, "Gamma Spark", "bright focus"],
    [111, "Body Ground", "low field"],
    [144, "Root Expansion", "foundation"],
    [174, "Soft Release", "gentle calm"],
    [285, "Repair Field", "restoration symbol"],
    [369, "Creative Pulse", "pattern motion"],
    [396, "Unburden", "grounding"],
    [417, "Shift Gate", "movement"],
    [432, "Foundation", "Scroll carrier"],
    [528, "Restoration", "bright coherence"],
    [639, "Heart Link", "connection"],
    [741, "Clarity", "clear signal"],
    [852, "Vision", "inner attention"],
    [963, "Crown", "upper carrier"],
    [1111, "Mirror Field", "symbolic observation"],
    [1728, "Cube Harmonic", "structure field"]
  ];

  const HARMONICS = {
    single: [1],
    octave: [1, 2],
    fifth: [1, 1.5],
    triad: [1, 1.25, 1.5],
    deep: [0.5, 1, 2],
    field: [0.5, 1, 1.5, 2]
  };

  const BEATS = {
    none: 0,
    alpha: 10,
    theta: 6,
    delta: 3,
    gamma: 40,
    schumann: 7.83
  };

  const SEQUENCES = {
    calm: [432, 396, 417, 432],
    focus: [144, 369, 432, 528],
    clarity: [432, 528, 741, 963],
    restore: [285, 396, 432, 528, 639],
    dream: [432, 285, 174, 111],
    ascent: [144, 288, 432, 528, 741, 963],
    t7: [111, 144, 369, 432, 528, 741, 963],
    lift: [432, 432, 528, 369, 432, 963, 432]
  };

  const STORE_JOURNAL = "sof_frequency_governance_journal_v1";

  let audioCtx = null;
  let masterGain = null;
  let deckNodes = [];
  let isPlaying = false;
  let selectedDeck = 0;
  let sequenceTimer = null;
  let liftTimer = null;
  let liftStep = 0;

  let visualSeed = Math.random() * 9999;
  let phase = 0;
  let visualFreq = 432;

  const fieldCanvas = $("#fieldCanvas");
  const fieldCtx = fieldCanvas?.getContext?.("2d");
  const starCanvas = $("#starField");
  const starCtx = starCanvas?.getContext?.("2d");
  let stars = [];

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || min));
  }

  function nowStamp() {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function log(message) {
    const el = $("#log");
    if (!el) return;
    el.textContent += `\n[${nowStamp()}] ${message}`;
    el.scrollTop = el.scrollHeight;
  }

  function safeText(text) {
    return String(text || "").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
  }

  function getCards() {
    return $$(".deck-card");
  }

  function getCard(index) {
    return getCards()[index];
  }

  function getDeck(index) {
    const card = getCard(index);
    if (!card) return null;

    return {
      index,
      freq: clamp($(".deck-freq", card)?.value, 40, 1800),
      volume: clamp($(".deck-vol", card)?.value, 0, 100),
      pan: clamp($(".deck-pan", card)?.value || 0, -100, 100) / 100,
      wave: $(".deck-wave", card)?.value || "sine",
      harmonic: $(".deck-harmonic", card)?.value || "single",
      beat: $(".deck-beat", card)?.value || "none",
      muted: card.classList.contains("is-muted"),
      solo: card.classList.contains("is-solo")
    };
  }

  function getDecks() {
    return getCards().map((_, i) => getDeck(i)).filter(Boolean);
  }

  function hasSolo() {
    return getDecks().some(d => d.solo);
  }

  function deckAudible(deck) {
    if (!deck || deck.muted) return false;
    if (hasSolo() && !deck.solo) return false;
    return deck.volume > 0;
  }

  function leadDeck() {
    return getDecks().find(deckAudible) || getDeck(0) || { freq: 432, volume: 0 };
  }

  function masterVolume() {
    return clamp($("#masterVolume")?.value || 22, 0, 100) / 100;
  }

  function fadeTime() {
    return clamp($("#fadeTime")?.value || 1.2, 0.15, 5);
  }

  function gainCurve(percent) {
    const p = clamp(percent, 0, 100) / 100;
    return Math.pow(p, 2) * 0.68;
  }

  function crossGain(index) {
    const cross = clamp($("#crossfader")?.value || 0, 0, 100) / 100;
    if (index === 0) return 1 - cross;
    if (index === 1) return cross;
    return 1;
  }

  function getAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = Math.pow(masterVolume(), 2) * 0.42;
      masterGain.connect(audioCtx.destination);
    }
    return audioCtx;
  }

  function stopNodeGroup(group, fade = fadeTime()) {
    if (!audioCtx || !group) return;
    const now = audioCtx.currentTime;

    group.forEach(node => {
      try {
        node.gain.gain.cancelScheduledValues(now);
        node.gain.gain.setValueAtTime(Math.max(node.gain.gain.value, 0.0001), now);
        node.gain.gain.exponentialRampToValueAtTime(0.0001, now + fade);
        node.osc.stop(now + fade + 0.05);
      } catch {}
    });
  }

  function createOsc(freq, wave, panValue, gainValue, fade) {
    const ac = getAudio();
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const pan = ac.createStereoPanner ? ac.createStereoPanner() : null;

    osc.type = wave;
    osc.frequency.setValueAtTime(clamp(freq, 20, 2200), now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), now + fade);

    if (pan) {
      pan.pan.value = panValue;
      osc.connect(gain).connect(pan).connect(masterGain);
    } else {
      osc.connect(gain).connect(masterGain);
    }

    osc.start(now);
    return { osc, gain };
  }

  function playDeck(index) {
    const deck = getDeck(index);
    if (!deck) return;

    const ac = getAudio();
    if (ac.state === "suspended") ac.resume();

    const oldGroup = deckNodes[index] || [];
    const fade = fadeTime();
    const ratios = HARMONICS[deck.harmonic] || [1];
    const beat = BEATS[deck.beat] || 0;
    const baseGain = deckAudible(deck) ? gainCurve(deck.volume) * crossGain(index) : 0.0001;
    const oscCount = beat ? ratios.length * 2 : ratios.length;
    const perGain = baseGain / Math.max(1, oscCount);

    const group = [];

    ratios.forEach((ratio, i) => {
      const base = deck.freq * ratio;
      if (base < 20 || base > 2200) return;

      if (beat) {
        group.push(createOsc(base - beat / 2, deck.wave, Math.max(-1, deck.pan - 0.25), perGain, fade));
        group.push(createOsc(base + beat / 2, deck.wave, Math.min(1, deck.pan + 0.25), perGain, fade));
      } else {
        const spread = ratios.length === 1 ? 0 : -0.22 + (0.44 * i) / Math.max(1, ratios.length - 1);
        group.push(createOsc(base, deck.wave, Math.max(-1, Math.min(1, deck.pan + spread)), perGain, fade));
      }
    });

    deckNodes[index] = group;
    stopNodeGroup(oldGroup, fade);
    isPlaying = true;
    updateUI();
  }

  function playMix() {
    getDecks().forEach(deck => {
      if (deck.index === 0 || deck.volume > 0) playDeck(deck.index);
    });
    isPlaying = true;
    updateUI();
    log("Mix started.");
  }

  function refreshDecks() {
    if (!isPlaying) {
      updateUI();
      return;
    }
    getDecks().forEach(deck => playDeck(deck.index));
  }

  function stopAll(fade = fadeTime()) {
    deckNodes.forEach(group => stopNodeGroup(group, fade));
    deckNodes = [];
    isPlaying = false;
    stopSequence(false);
    stopLiftLoop(false);
    updateUI();
  }

  function cueDeck(index) {
    selectedDeck = index;
    updateDeckTargets();

    const card = getCard(index);
    const vol = $(".deck-vol", card);
    if (vol && Number(vol.value) === 0) vol.value = 55;

    playDeck(index);
    log(`Deck ${String.fromCharCode(65 + index)} cued.`);
  }

  function setDeckFreq(index, freq, volume = 60) {
    const card = getCard(index);
    if (!card) return;

    $(".deck-freq", card).value = Math.round(clamp(freq, 40, 1800));
    $(".deck-vol", card).value = clamp(volume, 0, 100);

    playDeck(index);
  }

  function applyDeck(index, data) {
    const card = getCard(index);
    if (!card) return;

    $(".deck-freq", card).value = data.freq ?? 432;
    $(".deck-vol", card).value = data.volume ?? 0;
    $(".deck-pan", card).value = Math.round((data.pan ?? 0) * 100);
    $(".deck-wave", card).value = data.wave || "sine";
    $(".deck-harmonic", card).value = data.harmonic || "single";
    $(".deck-beat", card).value = data.beat || "none";
    card.classList.toggle("is-muted", !!data.muted);
    card.classList.toggle("is-solo", !!data.solo);
    playDeck(index);
  }

  function updateUI() {
    const lead = leadDeck();
    const activeDecks = getDecks().filter(deckAudible).length;
    const visualName = $("#visualMode")?.selectedOptions?.[0]?.textContent || "Torus Field";
    const preset = PRESETS.find(p => p[0] === Math.round(lead.freq));

    if (masterGain && audioCtx) {
      masterGain.gain.setTargetAtTime(Math.pow(masterVolume(), 2) * 0.42, audioCtx.currentTime, 0.06);
    }

    $("#masterValue") && ($("#masterValue").textContent = Math.round(lead.freq));
    $("#statCarrier") && ($("#statCarrier").textContent = `${Math.round(lead.freq)} Hz`);
    $("#statDecks") && ($("#statDecks").textContent = String(activeDecks));
    $("#statVisual") && ($("#statVisual").textContent = visualName.split(" ")[0]);
    $("#statState") && ($("#statState").textContent = isPlaying ? "Active" : "Stopped");
    $("#commandTitle") && ($("#commandTitle").textContent = `${Math.round(lead.freq)} Hz · ${preset ? preset[1] : "Custom Mix"}`);

    $("#stateText") && ($("#stateText").textContent = isPlaying ? "active" : "stopped");
    $("#stateText")?.classList.toggle("active", isPlaying);

    $("#meter") && ($("#meter").style.width = `${Math.round(masterVolume() * 100)}%`);
    $("#settingText") && ($("#settingText").textContent = `${Math.round(lead.freq)} Hz · ${Math.round(masterVolume() * 100)}% master · ${visualName}`);

    getCards().forEach((card, i) => {
      const deck = getDeck(i);
      card.classList.toggle("is-active", isPlaying && deckAudible(deck));
      card.classList.toggle("is-muted", deck.muted);
      card.classList.toggle("is-solo", deck.solo);
    });
  }

  function updateDeckTargets() {
    $$(".deck-target").forEach(btn => {
      btn.classList.toggle("active", Number(btn.dataset.target) === selectedDeck);
    });
  }

  function renderLibrary() {
    const grid = $("#libraryGrid");
    if (!grid) return;

    grid.innerHTML = PRESETS.map(([freq, name, desc]) => `
      <button class="fg-btn lib-btn" data-freq="${freq}" type="button">
        <strong>${freq} Hz</strong>
        <small>${name} · ${desc}</small>
      </button>
    `).join("");

    $$(".lib-btn").forEach(btn => {
      on(btn, "click", () => {
        const freq = Number(btn.dataset.freq);
        setDeckFreq(selectedDeck, freq, 55);
        log(`${freq} Hz loaded into Deck ${String.fromCharCode(65 + selectedDeck)}.`);
      });
    });
  }

  function stopSequence(update = true) {
    clearInterval(sequenceTimer);
    sequenceTimer = null;
    $("#seqStatus") && ($("#seqStatus").value = "stopped");
    $$(".seqBtn").forEach(btn => btn.classList.remove("is-active"));
    if (update) updateUI();
  }

  function runSequence(name) {
    const seq = SEQUENCES[name] || SEQUENCES.calm;
    const seconds = clamp($("#seqSeconds")?.value || 8, 2, 90);
    let i = 0;

    stopSequence(false);

    function step() {
      const freq = seq[i % seq.length];
      setDeckFreq(selectedDeck, freq, 60);
      $("#seqStatus") && ($("#seqStatus").value = `${name} · ${freq} Hz · ${(i % seq.length) + 1}/${seq.length}`);
      $$(".seqBtn").forEach(btn => btn.classList.toggle("is-active", btn.dataset.seq === name));
      i++;
    }

    step();
    sequenceTimer = setInterval(step, seconds * 1000);
    log(`Sequence started: ${name}.`);
  }

  function startT7() {
    $("#visualMode") && ($("#visualMode").value = "torus");

    applyDeck(0, { freq: 432, volume: 64, pan: -0.12, wave: "sine", harmonic: "single", beat: "schumann" });
    applyDeck(1, { freq: 528, volume: 32, pan: 0.16, wave: "sine", harmonic: "fifth", beat: "none" });
    applyDeck(2, { freq: 369, volume: 22, pan: -0.35, wave: "sine", harmonic: "single", beat: "none" });
    applyDeck(3, { freq: 963, volume: 16, pan: 0.35, wave: "sine", harmonic: "octave", beat: "none" });

    playMix();
    log("T7 Field started.");
  }

  function setLiftDot(step) {
    for (let i = 1; i <= 7; i++) {
      $(`#liftStep${i}`)?.classList.toggle("active", i === step);
    }
  }

  function startLiftLoop() {
    stopLiftLoop(false);
    stopSequence(false);

    $("#visualMode") && ($("#visualMode").value = "lift");

    const seq = SEQUENCES.lift;
    liftStep = 0;

    applyDeck(0, { freq: 432, volume: 62, pan: 0, wave: "sine", harmonic: "single", beat: "schumann" });
    playDeck(0);

    function step() {
      const dot = (liftStep % 7) + 1;
      setLiftDot(dot);
      setDeckFreq(0, seq[liftStep % seq.length], 62);
      log(`Lift Loop step ${dot}/7.`);
      liftStep++;
    }

    step();
    liftTimer = setInterval(step, 30000);
    log("Lift Loop started.");
  }

  function stopLiftLoop(update = true) {
    clearInterval(liftTimer);
    liftTimer = null;
    setLiftDot(1);
    if (update) log("Lift Loop stopped.");
  }

  function buildJournalText() {
    const lead = leadDeck();
    return `Frequency Governance Witness
Date: ${new Date().toLocaleString()}
Lead Carrier: ${Math.round(lead.freq)} Hz
Visual Mode: ${$("#visualMode")?.selectedOptions?.[0]?.textContent || "Torus Field"}
Active Decks: ${getDecks().filter(deckAudible).length}

Intention:
${$("#journalIntention")?.value || ""}

Body Signal:
${$("#journalBody")?.value || ""}

Witness Note:
${$("#journalNote")?.value || ""}`;
  }

  function getJournal() {
    try {
      return JSON.parse(localStorage.getItem(STORE_JOURNAL) || "[]");
    } catch {
      return [];
    }
  }

  function setJournal(items) {
    localStorage.setItem(STORE_JOURNAL, JSON.stringify(items));
  }

  function renderJournal() {
    const list = $("#journalList");
    if (!list) return;

    const items = getJournal();

    list.innerHTML = items.length
      ? items.map((item, i) => `
        <article class="journal-entry">
          <strong>${safeText(item.when)}</strong>
          <p class="fine">${safeText(item.text).slice(0, 460)}</p>
          <button class="fg-btn ghost copy-entry" data-i="${i}" type="button">Copy</button>
        </article>
      `).join("")
      : `<p class="fine">No saved witnesses yet.</p>`;

    $$(".copy-entry").forEach(btn => {
      on(btn, "click", async () => {
        const item = items[Number(btn.dataset.i)];
        await navigator.clipboard.writeText(item.text);
        btn.textContent = "Copied";
        setTimeout(() => (btn.textContent = "Copy"), 900);
      });
    });
  }

  function saveJournal() {
    const items = getJournal();
    items.unshift({ when: new Date().toLocaleString(), text: buildJournalText() });
    setJournal(items.slice(0, 80));
    renderJournal();
    log("Witness saved.");
  }

  function exportJournal() {
    const blob = new Blob([JSON.stringify(getJournal(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "frequency-governance-journal.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 600);
  }

  async function importJournal(file) {
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data)) throw new Error("Invalid JSON");
      setJournal(data.concat(getJournal()).slice(0, 120));
      renderJournal();
      log("Journal imported.");
    } catch {
      log("Journal import failed.");
    }
  }

  function fitFieldCanvas() {
    if (!fieldCanvas || !fieldCtx) return;
    const rect = fieldCanvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    fieldCanvas.width = Math.max(320, Math.floor(rect.width * dpr));
    fieldCanvas.height = Math.max(260, Math.floor(rect.height * dpr));
    fieldCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function fitStars() {
    if (!starCanvas || !starCtx) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    starCanvas.width = Math.floor(innerWidth * dpr);
    starCanvas.height = Math.floor(innerHeight * dpr);
    stars = Array.from({ length: 170 }, () => ({
      x: Math.random() * starCanvas.width,
      y: Math.random() * starCanvas.height,
      r: Math.random() * 1.35 + 0.25,
      a: Math.random() * Math.PI * 2
    }));
  }

  function drawStars() {
    if (!starCtx || !starCanvas) return;

    starCtx.clearRect(0, 0, starCanvas.width, starCanvas.height);

    stars.forEach(star => {
      star.a += 0.012;
      starCtx.fillStyle = `rgba(244,241,232,${0.17 + Math.sin(star.a) * 0.14})`;
      starCtx.beginPath();
      starCtx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      starCtx.fill();
    });

    requestAnimationFrame(drawStars);
  }

  function color(t, a) {
    if (t < 0.34) return `rgba(122,243,255,${a})`;
    if (t < 0.67) return `rgba(196,163,255,${a})`;
    return `rgba(243,201,122,${a})`;
  }

  function drawVisualizer() {
    if (!fieldCtx || !fieldCanvas) return;

    const w = fieldCanvas.clientWidth || 800;
    const h = fieldCanvas.clientHeight || 430;
    const cx = w / 2;
    const cy = h / 2;
    const lead = leadDeck();
    const visual = clamp($("#visualPower")?.value || 120, 20, 240) / 100;
    const mode = $("#visualMode")?.value || "torus";
    const push = isPlaying ? Math.max(0.2, masterVolume() * visual) : 0.18 * visual;

    visualFreq += (lead.freq - visualFreq) * 0.035;
    const fr = (visualFreq % 1000) / 1000;
    const baseR = Math.min(w, h) * (0.18 + 0.16 * visual + 0.05 * Math.sin(phase * 0.02 + fr * Math.PI * 2));

    fieldCtx.fillStyle = "rgba(5,7,13,0.12)";
    fieldCtx.fillRect(0, 0, w, h);

    const glow = fieldCtx.createRadialGradient(cx, cy, 4, cx, cy, Math.min(w, h) * (0.54 + push * 0.25));
    glow.addColorStop(0, `rgba(122,243,255,${0.16 + push * 0.15})`);
    glow.addColorStop(0.42, `rgba(196,163,255,${0.06 + push * 0.08})`);
    glow.addColorStop(0.64, `rgba(243,201,122,${0.07 + push * 0.10})`);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    fieldCtx.fillStyle = glow;
    fieldCtx.beginPath();
    fieldCtx.arc(cx, cy, Math.min(w, h) * 0.68, 0, Math.PI * 2);
    fieldCtx.fill();

    if (mode === "lattice") drawLattice(w, h, cx, cy, fr, push, visual);
    else if (mode === "rose") drawRose(w, h, cx, cy, baseR, fr, push, visual);
    else if (mode === "chladni") drawChladni(w, h, fr, push, visual);
    else if (mode === "orbit") drawOrbit(w, h, cx, cy, baseR, fr, push);
    else if (mode === "lift") drawLift(w, h, cx, cy, push);
    else if (mode === "scope") drawScope(w, h, cx, cy, fr, push);
    else drawTorus(w, h, cx, cy, baseR, fr, push, visual);

    fieldCtx.fillStyle = "rgba(244,241,232,0.92)";
    fieldCtx.font = "800 13px Inter, system-ui, sans-serif";
    fieldCtx.textAlign = "center";
    fieldCtx.fillText(isPlaying ? `${Math.round(lead.freq)} Hz · MIX ACTIVE` : "FREQUENCY FIELD", cx, 25);

    phase += 0.9;
    requestAnimationFrame(drawVisualizer);
  }

  function drawTorus(w, h, cx, cy, baseR, fr, push, visual) {
    const n = Math.round(260 * visual);

    for (let ring = 0; ring < 4; ring++) {
      fieldCtx.strokeStyle = `rgba(122,243,255,${0.08 + ring * 0.03 + push * 0.04})`;
      fieldCtx.beginPath();
      fieldCtx.arc(cx, cy, baseR * (0.58 + ring * 0.28), 0, Math.PI * 2);
      fieldCtx.stroke();
    }

    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + phase * 0.008;
      const wobble = Math.sin(i * 0.055 + phase * 0.018 + fr * 9 + visualSeed);
      const r = baseR * (0.78 + 0.48 * wobble);
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a * 1.08) * r * 0.68;

      fieldCtx.fillStyle = color((i % 100) / 100, 0.42 + push * 0.32);
      fieldCtx.beginPath();
      fieldCtx.arc(x, y, 1.2 + push * 2.3, 0, Math.PI * 2);
      fieldCtx.fill();

      fieldCtx.beginPath();
      fieldCtx.arc(w - x, y, 1.2 + push * 2.3, 0, Math.PI * 2);
      fieldCtx.fill();
    }
  }

  function drawLattice(w, h, cx, cy, fr, push, visual) {
    const lines = Math.round(9 + visual * 8);

    for (let i = 0; i < lines; i++) {
      fieldCtx.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const y = cy + Math.sin(x * 0.014 + i * 0.75 + phase * 0.014 + fr * 8) * h * 0.16;
        x ? fieldCtx.lineTo(x, y + (i - lines / 2) * 12) : fieldCtx.moveTo(x, y);
      }
      fieldCtx.strokeStyle = color(i / lines, 0.26 + push * 0.22);
      fieldCtx.lineWidth = 1.5;
      fieldCtx.stroke();
    }
  }

  function drawRose(w, h, cx, cy, baseR, fr, push, visual) {
    const n = Math.round(520 * visual);
    const k = 3 + Math.round(fr * 8);

    fieldCtx.beginPath();
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * Math.PI * 10;
      const r = baseR * 1.15 * Math.cos(k * t + phase * 0.01);
      const x = cx + r * Math.cos(t);
      const y = cy + r * Math.sin(t);
      i ? fieldCtx.lineTo(x, y) : fieldCtx.moveTo(x, y);
    }

    fieldCtx.strokeStyle = `rgba(243,201,122,${0.58 + push * 0.20})`;
    fieldCtx.lineWidth = 2;
    fieldCtx.stroke();
  }

  function drawChladni(w, h, fr, push, visual) {
    const step = Math.max(7, 16 - visual * 3);

    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const v =
          Math.sin((x / w) * Math.PI * (3 + fr * 8) + phase * 0.018) *
          Math.sin((y / h) * Math.PI * (2 + fr * 9) - phase * 0.015);

        if (Math.abs(v) < 0.10 + push * 0.10) {
          fieldCtx.fillStyle = color((v + 1) / 2, 0.30 + push * 0.22);
          fieldCtx.fillRect(x, y, 2.2, 2.2);
        }
      }
    }
  }

  function drawOrbit(w, h, cx, cy, baseR, fr, push) {
    const count = 10;

    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + phase * 0.008 * (i % 2 ? -1 : 1);
      const r = baseR * (0.7 + (i % 4) * 0.22);
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r * 0.72;

      fieldCtx.strokeStyle = color(i / count, 0.16 + push * 0.12);
      fieldCtx.beginPath();
      fieldCtx.arc(cx, cy, r, 0, Math.PI * 2);
      fieldCtx.stroke();

      fieldCtx.fillStyle = color(i / count, 0.70);
      fieldCtx.beginPath();
      fieldCtx.arc(x, y, 3 + push * 3, 0, Math.PI * 2);
      fieldCtx.fill();
    }
  }

  function drawLift(w, h, cx, cy, push) {
    const columnW = Math.min(w, h) * 0.22;

    for (let i = 0; i < 9; i++) {
      const y = h - ((phase * 2 + i * h / 9) % h);
      const radius = columnW * (0.45 + 0.28 * Math.sin(phase * 0.03 + i));
      fieldCtx.strokeStyle = `rgba(159,247,200,${0.18 + push * 0.22})`;
      fieldCtx.lineWidth = 2;
      fieldCtx.beginPath();
      fieldCtx.ellipse(cx, y, radius, radius * 0.24, 0, 0, Math.PI * 2);
      fieldCtx.stroke();
    }

    const grad = fieldCtx.createLinearGradient(cx, h, cx, 0);
    grad.addColorStop(0, "rgba(159,247,200,0)");
    grad.addColorStop(0.45, `rgba(159,247,200,${0.10 + push * 0.12})`);
    grad.addColorStop(1, "rgba(122,243,255,0)");
    fieldCtx.fillStyle = grad;
    fieldCtx.fillRect(cx - columnW / 2, 0, columnW, h);
  }

  function drawScope(w, h, cx, cy, fr, push) {
    fieldCtx.beginPath();

    for (let x = 0; x <= w; x += 3) {
      const y = cy + Math.sin((x / w) * Math.PI * 2 * (2 + fr * 8) + phase * 0.035) * h * (0.14 + push * 0.08);
      x ? fieldCtx.lineTo(x, y) : fieldCtx.moveTo(x, y);
    }

    fieldCtx.strokeStyle = `rgba(122,243,255,${0.55 + push * 0.20})`;
    fieldCtx.lineWidth = 2;
    fieldCtx.stroke();
  }

  function bind() {
    on($("#playBtn"), "click", playMix);
    on($("#stopBtn"), "click", () => {
      stopAll();
      log("Stopped.");
    });

    on($("#dockPlay"), "click", playMix);
    on($("#dockStop"), "click", () => stopAll(0.25));
    on($("#dockT7"), "click", startT7);
    on($("#dockLift"), "click", startLiftLoop);
    on($("#dockLog"), "click", () => $("#journalIntention")?.scrollIntoView({ behavior: "smooth", block: "center" }));

    ["masterVolume", "visualPower", "fadeTime", "visualMode", "crossfader"].forEach(id => {
      on($("#" + id), "input", refreshDecks);
      on($("#" + id), "change", updateUI);
    });

    getCards().forEach((card, index) => {
      $$(".deck-freq, .deck-vol, .deck-pan, .deck-wave, .deck-harmonic, .deck-beat", card).forEach(control => {
        on(control, "input", () => playDeck(index));
        on(control, "change", () => playDeck(index));
      });

      on($(".deck-cue", card), "click", () => cueDeck(index));

      on($(".deck-mute", card), "click", () => {
        card.classList.toggle("is-muted");
        refreshDecks();
      });

      on($(".deck-solo", card), "click", () => {
        card.classList.toggle("is-solo");
        refreshDecks();
      });
    });

    $$(".deck-target").forEach(btn => {
      on(btn, "click", () => {
        selectedDeck = Number(btn.dataset.target);
        updateDeckTargets();
      });
    });

    $$(".seqBtn").forEach(btn => on(btn, "click", () => runSequence(btn.dataset.seq)));
    on($("#stopSeq"), "click", () => {
      stopSequence();
      log("Sequence stopped.");
    });

    on($("#startT7"), "click", startT7);
    on($("#stopT7"), "click", () => {
      stopAll();
      log("T7 Field ended.");
    });

    on($("#startLiftLoop"), "click", startLiftLoop);
    on($("#stopLiftLoop"), "click", () => stopLiftLoop());

    on($("#saveJournal"), "click", saveJournal);

    on($("#copyJournal"), "click", async () => {
      await navigator.clipboard.writeText(buildJournalText());
      log("Witness copied.");
    });

    on($("#clearJournal"), "click", () => {
      $("#journalIntention").value = "";
      $("#journalBody").value = "";
      $("#journalNote").value = "";
      log("Journal fields cleared.");
    });

    on($("#exportJournal"), "click", exportJournal);
    on($("#importJournal"), "click", () => $("#importJournalFile")?.click());

    on($("#importJournalFile"), "change", e => {
      const file = e.target.files?.[0];
      if (file) importJournal(file);
      e.target.value = "";
    });

    on($("#clearJournalArchive"), "click", () => {
      localStorage.removeItem(STORE_JOURNAL);
      renderJournal();
      log("Journal archive cleared.");
    });

    on($("#clearField"), "click", () => {
      if (!fieldCanvas || !fieldCtx) return;
      fieldCtx.clearRect(0, 0, fieldCanvas.width, fieldCanvas.height);
    });

    on($("#saveFieldPng"), "click", () => {
      if (!fieldCanvas) return;
      const a = document.createElement("a");
      a.href = fieldCanvas.toDataURL("image/png");
      a.download = "frequency-governance-field.png";
      a.click();
    });

    on($("#randomSeed"), "click", () => {
      visualSeed = Math.random() * 9999;
      log("New visual seed.");
    });

    document.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        stopAll(0.25);
        log("Emergency stop.");
      }
    });

    window.addEventListener("resize", () => {
      fitFieldCanvas();
      fitStars();
    }, { passive: true });

    window.addEventListener("pointerdown", () => {
      if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    }, { once: true, passive: true });
  }

  function boot() {
    $("#yr") && ($("#yr").textContent = new Date().getFullYear());
    fitFieldCanvas();
    fitStars();
    renderLibrary();
    renderJournal();
    bind();
    updateDeckTargets();
    updateUI();
    drawStars();
    drawVisualizer();
    log("Stable DJ Observatory loaded.");
  }

  boot();
})();
