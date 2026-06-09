/* =====================================================
   Scroll of Fire — Frequency Governance
   DJ Observatory Workstation
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
    minor: [1, 1.2, 1.5],
    deep: [0.5, 1, 2],
    crown: [1, 2, 3],
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
    headache: [174, 285, 432, 174],
    calm: [432, 396, 417, 432],
    focus: [144, 369, 432, 528],
    clarity: [432, 528, 741, 963],
    restore: [285, 396, 432, 528, 639],
    dream: [432, 285, 174, 111],
    ascent: [144, 288, 432, 528, 741, 963],
    remnant: [144, 369, 432, 528, 963, 432],
    t7: [111, 144, 369, 432, 528, 741, 963],
    lift: [432, 432, 528, 369, 432, 963, 432]
  };

  const STORE_PRESET = "sof_frequency_dj_preset_v2";
  const STORE_TRACK = "sof_frequency_dj_track_v2";
  const STORE_JOURNAL = "sof_frequency_dj_journal_v2";

  let audioCtx = null;
  let masterGain = null;
  let deckNodes = [];
  let isPlaying = false;
  let selectedDeck = 0;

  let loopSteps = [];
  let loopTimer = null;
  let sequenceTimer = null;
  let liftTimer = null;
  let liftStep = 0;

  let recording = false;
  let recordStart = 0;
  let recordedEvents = [];
  let trackTimer = null;
  let trackStart = 0;
  let trackCursor = 0;

  let sessionTimer = null;
  let sessionEnd = 0;

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

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
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

  function storeGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function storeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  function safeText(text) {
    return String(text || "").replace(/[<>&]/g, c => ({
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;"
    }[c]));
  }

  function getDeckCards() {
    return $$(".deck-card");
  }

  function getDeckCard(index) {
    return getDeckCards()[index];
  }

  function getDeckState(index) {
    const card = getDeckCard(index);
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

  function getDeckStates() {
    return getDeckCards().map((_, index) => getDeckState(index)).filter(Boolean);
  }

  function hasSolo() {
    return getDeckStates().some(deck => deck.solo);
  }

  function masterVolume() {
    return clamp($("#masterVolume")?.value || 22, 0, 100) / 100;
  }

  function fadeTime() {
    return clamp($("#fadeTime")?.value || 1.25, 0.15, 6);
  }

  function gainCurve(percent) {
    const p = clamp(percent, 0, 100) / 100;
    return Math.pow(p, 2) * 0.78;
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

  function createOscillator(freq, wave, panValue, gainValue, fade) {
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

  function deckAudible(deck) {
    if (deck.muted) return false;
    if (hasSolo() && !deck.solo) return false;
    return deck.volume > 0;
  }

  function crossfadeGain(deckIndex) {
    const cross = clamp($("#crossfader")?.value || 0, 0, 100) / 100;
    if (deckIndex === 0) return 1 - cross;
    if (deckIndex === 1) return cross;
    return 1;
  }

  function playDeck(index) {
    const deck = getDeckState(index);
    if (!deck) return;

    const ac = getAudio();
    if (ac.state === "suspended") ac.resume();

    const oldGroup = deckNodes[index] || [];
    const fade = fadeTime();
    const ratios = HARMONICS[deck.harmonic] || [1];
    const beat = BEATS[deck.beat] || 0;
    const audible = deckAudible(deck);
    const baseGain = audible ? gainCurve(deck.volume) * crossfadeGain(index) : 0.0001;
    const count = beat ? ratios.length * 2 : ratios.length;
    const perGain = baseGain / Math.max(1, count);

    const group = [];

    ratios.forEach((ratio, i) => {
      const base = deck.freq * ratio;
      if (base < 20 || base > 2200) return;

      if (beat) {
        group.push(createOscillator(base - beat / 2, deck.wave, Math.max(-1, deck.pan - 0.28), perGain, fade));
        group.push(createOscillator(base + beat / 2, deck.wave, Math.min(1, deck.pan + 0.28), perGain, fade));
      } else {
        const offset = ratios.length === 1 ? 0 : -0.25 + (0.5 * i) / Math.max(1, ratios.length - 1);
        group.push(createOscillator(base, deck.wave, Math.max(-1, Math.min(1, deck.pan + offset)), perGain, fade));
      }
    });

    deckNodes[index] = group;
    stopNodeGroup(oldGroup, fade);
    isPlaying = true;
    recordEvent("deck", { index, state: deck });
    updateUI();
  }

  function playMix() {
    getDeckStates().forEach(deck => {
      if (deck.volume > 0 || deck.index === 0) playDeck(deck.index);
    });

    isPlaying = true;
    recordEvent("playMix", {});
    log("Mix started.");
    updateUI();
  }

  function stopAll(fade = fadeTime()) {
    deckNodes.forEach(group => stopNodeGroup(group, fade));
    deckNodes = [];
    isPlaying = false;
    stopSequence(false);
    stopLoop(false);
    stopTrack(false);
    stopLiftLoop(false);
    stopSession(false);
    recordEvent("stop", {});
    updateUI();
  }

  function refreshDecks() {
    if (!isPlaying) {
      updateUI();
      return;
    }
    getDeckStates().forEach(deck => playDeck(deck.index));
  }

  function cueDeck(index) {
    selectedDeck = index;
    updateDeckTargets();

    const card = getDeckCard(index);
    const vol = $(".deck-vol", card);

    if (vol && Number(vol.value) === 0) {
      vol.value = 55;
    }

    playDeck(index);
    log(`Deck ${String.fromCharCode(65 + index)} cued.`);
  }

  function setDeckFrequency(index, freq, volume) {
    const card = getDeckCard(index);
    if (!card) return;

    $(".deck-freq", card).value = Math.round(clamp(freq, 40, 1800));
    if (typeof volume === "number") $(".deck-vol", card).value = clamp(volume, 0, 100);

    playDeck(index);
  }

  function applyDeckState(index, state) {
    const card = getDeckCard(index);
    if (!card || !state) return;

    $(".deck-freq", card).value = state.freq ?? 432;
    $(".deck-vol", card).value = state.volume ?? 0;
    $(".deck-pan", card).value = Math.round((state.pan ?? 0) * 100);
    $(".deck-wave", card).value = state.wave || "sine";
    $(".deck-harmonic", card).value = state.harmonic || "single";
    $(".deck-beat", card).value = state.beat || "none";
    card.classList.toggle("is-muted", !!state.muted);
    card.classList.toggle("is-solo", !!state.solo);
    playDeck(index);
  }

  function leadDeck() {
    const decks = getDeckStates();
    return decks.find(deck => deckAudible(deck)) || decks[0] || { freq: 432, volume: 0 };
  }

  function updateUI() {
    const decks = getDeckStates();
    const lead = leadDeck();
    const active = decks.filter(deck => deckAudible(deck)).length;
    const preset = PRESETS.find(p => p[0] === Math.round(lead.freq));

    if (masterGain && audioCtx) {
      masterGain.gain.setTargetAtTime(Math.pow(masterVolume(), 2) * 0.42, audioCtx.currentTime, 0.06);
    }

    $("#masterValue") && ($("#masterValue").textContent = Math.round(lead.freq));
    $("#statCarrier") && ($("#statCarrier").textContent = `${Math.round(lead.freq)} Hz`);
    $("#statDecks") && ($("#statDecks").textContent = String(active));
    $("#statState") && ($("#statState").textContent = isPlaying ? "Active" : "Stopped");
    $("#statTrack") && ($("#statTrack").textContent = recording ? "Recording" : trackTimer ? "Playing" : "Idle");
    $("#commandTitle") && ($("#commandTitle").textContent = `${Math.round(lead.freq)} Hz · ${preset ? preset[1] : "Custom Mix"}`);
    $("#stateText") && ($("#stateText").textContent = isPlaying ? "active" : "stopped");
    $("#stateText") && $("#stateText").classList.toggle("active", isPlaying);
    $("#meter") && ($("#meter").style.width = `${Math.round(masterVolume() * 100)}%`);

    const visualName = $("#visualMode")?.selectedOptions?.[0]?.textContent || "Torus Field";
    $("#settingText") && ($("#settingText").textContent = `${Math.round(lead.freq)} Hz · ${Math.round(masterVolume() * 100)}% master · ${visualName}`);

    getDeckCards().forEach((card, i) => {
      const deck = getDeckState(i);
      card.classList.toggle("is-active", isPlaying && deckAudible(deck));
      card.classList.toggle("is-muted", deck.muted);
      card.classList.toggle("is-solo", deck.solo);
    });

    $("#trackClock") && ($("#trackClock").textContent = recording ? formatTime(Date.now() - recordStart) : $("#trackClock").textContent || "00:00");
    $("#trackEvents") && ($("#trackEvents").textContent = String(recordedEvents.length));
    $("#recordTrack") && $("#recordTrack").classList.toggle("recording", recording);
  }

  function updateDeckTargets() {
    $$(".deck-target").forEach(btn => {
      btn.classList.toggle("active", Number(btn.dataset.target) === selectedDeck);
    });
  }

  function recordEvent(type, payload) {
    if (!recording) return;
    recordedEvents.push({
      at: Date.now() - recordStart,
      type,
      payload
    });
    renderTrackTimeline();
    updateUI();
  }

  function startRecording() {
    recordedEvents = [];
    recording = true;
    recordStart = Date.now();
    renderTrackTimeline();
    log("Track recording started.");
    updateUI();
  }

  function stopRecording() {
    recording = false;
    log(`Track recording stopped. ${recordedEvents.length} events captured.`);
    updateUI();
  }

  function renderTrackTimeline(activeIndex = -1) {
    const el = $("#trackTimeline");
    if (!el) return;

    if (!recordedEvents.length) {
      el.innerHTML = `<span class="fine">No recorded events yet.</span>`;
      return;
    }

    el.innerHTML = recordedEvents.map((event, i) => {
      const label = event.type === "deck"
        ? `${formatTime(event.at)} · Deck ${String.fromCharCode(65 + event.payload.index)} · ${Math.round(event.payload.state.freq)} Hz`
        : `${formatTime(event.at)} · ${event.type}`;
      return `<span class="track-chip ${i === activeIndex ? "active" : ""}">${safeText(label)}</span>`;
    }).join("");
  }

  function playRecordedTrack() {
    if (!recordedEvents.length) {
      log("No recorded track to play.");
      return;
    }

    stopTrack(false);
    stopSequence(false);
    stopLoop(false);

    trackCursor = 0;
    trackStart = Date.now();
    log("Track playback started.");

    trackTimer = setInterval(() => {
      const elapsed = Date.now() - trackStart;
      $("#trackClock") && ($("#trackClock").textContent = formatTime(elapsed));

      while (trackCursor < recordedEvents.length && recordedEvents[trackCursor].at <= elapsed) {
        const event = recordedEvents[trackCursor];
        applyRecordedEvent(event);
        renderTrackTimeline(trackCursor);
        trackCursor++;
      }

      if (trackCursor >= recordedEvents.length) {
        stopTrack();
        log("Track playback complete.");
      }

      updateUI();
    }, 90);
  }

  function applyRecordedEvent(event) {
    if (event.type === "deck") {
      applyDeckState(event.payload.index, event.payload.state);
    }

    if (event.type === "playMix") {
      playMix();
    }

    if (event.type === "stop") {
      deckNodes.forEach(group => stopNodeGroup(group, 0.25));
      deckNodes = [];
      isPlaying = false;
      updateUI();
    }
  }

  function stopTrack(update = true) {
    clearInterval(trackTimer);
    trackTimer = null;
    trackCursor = 0;
    renderTrackTimeline();
    if (update) updateUI();
  }

  function saveTrack() {
    storeSet(STORE_TRACK, recordedEvents);
    log("Track saved locally.");
  }

  function loadTrack() {
    recordedEvents = storeGet(STORE_TRACK, []);
    renderTrackTimeline();
    log(`Track loaded. ${recordedEvents.length} events.`);
    updateUI();
  }

  function exportTrack() {
    const blob = new Blob([JSON.stringify(recordedEvents, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "frequency-governance-track.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
  }

  function clearTrack() {
    recordedEvents = [];
    renderTrackTimeline();
    updateUI();
    log("Track cleared.");
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
        setDeckFrequency(selectedDeck, freq, 55);
        log(`${freq} Hz loaded into Deck ${String.fromCharCode(65 + selectedDeck)}.`);
      });
    });
  }

  function addLoopStep(deckIndex) {
    const deck = getDeckState(deckIndex);
    loopSteps.push({
      deck: deckIndex,
      freq: Math.round(deck.freq),
      volume: deck.volume,
      pan: deck.pan,
      wave: deck.wave,
      harmonic: deck.harmonic,
      beat: deck.beat
    });

    renderLoop();
    log(`Loop step added: Deck ${String.fromCharCode(65 + deckIndex)} · ${Math.round(deck.freq)} Hz.`);
  }

  function renderLoop(activeIndex = -1) {
    const el = $("#loopTimeline");
    if (!el) return;

    if (!loopSteps.length) {
      el.innerHTML = `<span class="fine">No custom loop yet. Use “Add Loop” on a deck.</span>`;
      return;
    }

    el.innerHTML = loopSteps.map((step, i) => `
      <span class="loop-chip ${i === activeIndex ? "active" : ""}">
        ${String.fromCharCode(65 + step.deck)} · ${step.freq} Hz
      </span>
    `).join("");
  }

  function stopLoop(update = true) {
    clearInterval(loopTimer);
    loopTimer = null;
    renderLoop();
    if (update) updateUI();
  }

  function playLoop() {
    if (!loopSteps.length) {
      log("Custom loop is empty.");
      return;
    }

    stopLoop(false);
    stopSequence(false);

    const seconds = clamp($("#seqSeconds")?.value || 8, 2, 90);
    let i = 0;

    function step() {
      const item = loopSteps[i % loopSteps.length];
      applyDeckState(item.deck, item);
      renderLoop(i % loopSteps.length);
      $("#seqStatus") && ($("#seqStatus").value = `custom loop · ${(i % loopSteps.length) + 1}/${loopSteps.length}`);
      i++;
    }

    step();
    loopTimer = setInterval(step, seconds * 1000);
    log("Custom loop started.");
  }

  function stopSequence(update = true) {
    clearInterval(sequenceTimer);
    sequenceTimer = null;
    $$(".seqBtn").forEach(btn => btn.classList.remove("is-active"));
    $("#seqStatus") && ($("#seqStatus").value = "stopped");
    if (update) updateUI();
  }

  function runSequence(name) {
    const seq = SEQUENCES[name] || SEQUENCES.remnant;
    const seconds = clamp($("#seqSeconds")?.value || 8, 2, 90);
    let i = 0;

    stopSequence(false);
    stopLoop(false);

    function step() {
      const freq = seq[i % seq.length];
      setDeckFrequency(selectedDeck, freq, 60);
      $("#seqStatus") && ($("#seqStatus").value = `${name} · ${freq} Hz · ${(i % seq.length) + 1}/${seq.length}`);
      $$(".seqBtn").forEach(btn => btn.classList.toggle("is-active", btn.dataset.seq === name));
      i++;
    }

    step();
    sequenceTimer = setInterval(step, seconds * 1000);
    log(`Sequence started: ${name}.`);
  }

  function startT7() {
    const setup = [
      { deck: 0, freq: 432, volume: 65, pan: -0.18, wave: "sine", harmonic: "single", beat: "schumann" },
      { deck: 1, freq: 528, volume: 34, pan: 0.18, wave: "sine", harmonic: "fifth", beat: "none" },
      { deck: 2, freq: 369, volume: 25, pan: -0.42, wave: "sine", harmonic: "single", beat: "none" },
      { deck: 3, freq: 963, volume: 18, pan: 0.42, wave: "sine", harmonic: "octave", beat: "none" }
    ];

    setup.forEach(item => applyDeckState(item.deck, item));
    $("#visualMode") && ($("#visualMode").value = "torus");
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
    stopLoop(false);

    const seq = SEQUENCES.lift;
    liftStep = 0;

    $("#visualMode") && ($("#visualMode").value = "lift");

    const base = {
      deck: 0,
      freq: 432,
      volume: 64,
      pan: 0,
      wave: "sine",
      harmonic: "single",
      beat: "schumann"
    };

    applyDeckState(0, base);
    playDeck(0);

    function step() {
      const dot = (liftStep % 7) + 1;
      setLiftDot(dot);
      setDeckFrequency(0, seq[liftStep % seq.length], 64);
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

  function stopSession(update = true) {
    clearInterval(sessionTimer);
    sessionTimer = null;
    sessionEnd = 0;
    if (update) updateUI();
  }

  function savePreset() {
    const preset = {
      masterVolume: $("#masterVolume")?.value,
      visualPower: $("#visualPower")?.value,
      fadeTime: $("#fadeTime")?.value,
      visualMode: $("#visualMode")?.value,
      crossfader: $("#crossfader")?.value,
      decks: getDeckStates(),
      loopSteps
    };

    storeSet(STORE_PRESET, preset);
    log("Mixer preset saved.");
  }

  function loadPreset() {
    const preset = storeGet(STORE_PRESET, null);
    if (!preset) {
      log("No saved mixer preset found.");
      return;
    }

    $("#masterVolume").value = preset.masterVolume || 22;
    $("#visualPower").value = preset.visualPower || 130;
    $("#fadeTime").value = preset.fadeTime || 1.25;
    $("#visualMode").value = preset.visualMode || "torus";
    $("#crossfader").value = preset.crossfader || 0;

    (preset.decks || []).forEach((deck, index) => applyDeckState(index, deck));
    loopSteps = preset.loopSteps || [];
    renderLoop();
    updateUI();
    log("Mixer preset loaded.");
  }

  function resetMixer() {
    const defaults = [
      { freq: 432, volume: 80, pan: -0.15, wave: "sine", harmonic: "single", beat: "none" },
      { freq: 528, volume: 0, pan: 0.15, wave: "sine", harmonic: "single", beat: "none" },
      { freq: 369, volume: 0, pan: -0.35, wave: "sine", harmonic: "single", beat: "none" },
      { freq: 963, volume: 0, pan: 0.35, wave: "sine", harmonic: "single", beat: "none" }
    ];

    defaults.forEach((deck, index) => applyDeckState(index, deck));
    $("#masterVolume").value = 22;
    $("#visualPower").value = 130;
    $("#fadeTime").value = 1.25;
    $("#visualMode").value = "torus";
    $("#crossfader").value = 0;
    loopSteps = [];
    renderLoop();
    updateUI();
    log("Mixer reset.");
  }

  function buildJournalText() {
    const lead = leadDeck();
    return `Frequency Governance Witness
Date: ${new Date().toLocaleString()}
Lead Carrier: ${Math.round(lead.freq)} Hz
Visual Mode: ${$("#visualMode")?.selectedOptions?.[0]?.textContent || "Torus Field"}
Active Decks: ${getDeckStates().filter(deck => deckAudible(deck)).length}
Intention: ${$("#journalIntention")?.value || ""}
Body Signal: ${$("#journalBody")?.value || ""}
Witness Note:
${$("#journalNote")?.value || ""}`;
  }

  function renderJournal() {
    const list = $("#journalList");
    if (!list) return;

    const items = storeGet(STORE_JOURNAL, []);
    list.innerHTML = items.length
      ? items.map((item, i) => `
        <article class="journal-entry">
          <strong>${safeText(item.when)}</strong>
          <p class="fine">${safeText(item.text).slice(0, 440)}</p>
          <button class="fg-btn ghost copy-journal-entry" data-i="${i}" type="button">Copy</button>
        </article>
      `).join("")
      : `<p class="fine">No saved witnesses yet.</p>`;

    $$(".copy-journal-entry").forEach(btn => {
      on(btn, "click", async () => {
        const item = items[Number(btn.dataset.i)];
        await navigator.clipboard.writeText(item.text);
        btn.textContent = "Copied";
        setTimeout(() => (btn.textContent = "Copy"), 900);
      });
    });
  }

  function saveJournal() {
    const items = storeGet(STORE_JOURNAL, []);
    items.unshift({ when: new Date().toLocaleString(), text: buildJournalText() });
    storeSet(STORE_JOURNAL, items.slice(0, 80));
    renderJournal();
    log("Witness saved.");
  }

  function exportJournal() {
    const items = storeGet(STORE_JOURNAL, []);
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
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
      const current = storeGet(STORE_JOURNAL, []);
      storeSet(STORE_JOURNAL, data.concat(current).slice(0, 120));
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
    stars = Array.from({ length: 175 }, () => ({
      x: Math.random() * starCanvas.width,
      y: Math.random() * starCanvas.height,
      r: Math.random() * 1.4 + 0.25,
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
    const active = getDeckStates().filter(deck => deckAudible(deck));
    const visual = clamp($("#visualPower")?.value || 130, 20, 260) / 100;
    const mode = $("#visualMode")?.value || "torus";
    const push = isPlaying ? Math.max(0.22, masterVolume() * visual) : 0.18 * visual;

    visualFreq += (lead.freq - visualFreq) * 0.035;

    const fr = (visualFreq % 1000) / 1000;
    const baseR = Math.min(w, h) * (0.18 + 0.16 * visual + 0.05 * Math.sin(phase * 0.02 + fr * Math.PI * 2));

    fieldCtx.fillStyle = "rgba(5,7,13,0.10)";
    fieldCtx.fillRect(0, 0, w, h);

    const glow = fieldCtx.createRadialGradient(cx, cy, 4, cx, cy, Math.min(w, h) * (0.52 + push * 0.25));
    glow.addColorStop(0, `rgba(122,243,255,${0.16 + push * 0.15})`);
    glow.addColorStop(0.42, `rgba(196,163,255,${0.06 + push * 0.08})`);
    glow.addColorStop(0.62, `rgba(243,201,122,${0.07 + push * 0.10})`);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    fieldCtx.fillStyle = glow;
    fieldCtx.beginPath();
    fieldCtx.arc(cx, cy, Math.min(w, h) * 0.68, 0, Math.PI * 2);
    fieldCtx.fill();

    if (mode === "lattice") drawLattice(w, h, cx, cy, baseR, fr, push, visual);
    else if (mode === "rose") drawRose(w, h, cx, cy, baseR, fr, push, visual);
    else if (mode === "chladni") drawChladni(w, h, fr, push, visual);
    else if (mode === "orbit") drawOrbit(w, h, cx, cy, baseR, fr, push, visual, active);
    else if (mode === "constellation") drawConstellation(w, h, cx, cy, baseR, fr, push, visual);
    else if (mode === "lift") drawLift(w, h, cx, cy, baseR, fr, push);
    else if (mode === "waveform") drawWaveform(w, h, cx, cy, fr, push, active);
    else if (mode === "dj") drawDjSpectrum(w, h, active, push);
    else drawTorus(w, h, cx, cy, baseR, fr, push, visual);

    fieldCtx.fillStyle = "rgba(244,241,232,0.92)";
    fieldCtx.font = "800 13px Inter, system-ui, sans-serif";
    fieldCtx.textAlign = "center";
    fieldCtx.fillText(isPlaying ? `${Math.round(lead.freq)} Hz · MIX ACTIVE` : "FREQUENCY FIELD", cx, 25);

    phase += 0.9;
    requestAnimationFrame(drawVisualizer);
  }

  function drawTorus(w, h, cx, cy, baseR, fr, push, visual) {
    const n = Math.round(280 * visual);

    for (let ring = 0; ring < 4; ring++) {
      fieldCtx.strokeStyle = `rgba(122,243,255,${0.08 + ring * 0.03 + push * 0.04})`;
      fieldCtx.lineWidth = 1;
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

  function drawLattice(w, h, cx, cy, baseR, fr, push, visual) {
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

  function drawOrbit(w, h, cx, cy, baseR, fr, push, visual, active) {
    const count = Math.max(4, active.length * 4 || 7);

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

  function drawConstellation(w, h, cx, cy, baseR, fr, push, visual) {
    const n = Math.round(32 + visual * 30);
    const pts = [];

    for (let i = 0; i < n; i++) {
      const a = i * 2.399 + phase * 0.004;
      const r = baseR * (0.35 + ((i * 37) % 100) / 100);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }

    fieldCtx.strokeStyle = `rgba(122,243,255,${0.08 + push * 0.10})`;

    for (let i = 1; i < pts.length; i++) {
      fieldCtx.beginPath();
      fieldCtx.moveTo(pts[i - 1][0], pts[i - 1][1]);
      fieldCtx.lineTo(pts[i][0], pts[i][1]);
      fieldCtx.stroke();
    }

    pts.forEach((p, i) => {
      fieldCtx.fillStyle = color(i / pts.length, 0.45 + push * 0.28);
      fieldCtx.beginPath();
      fieldCtx.arc(p[0], p[1], 1.6 + push * 2, 0, Math.PI * 2);
      fieldCtx.fill();
    });
  }

  function drawLift(w, h, cx, cy, baseR, fr, push) {
    const columnW = Math.min(w, h) * 0.22;
    const pulses = 9;

    fieldCtx.strokeStyle = `rgba(159,247,200,${0.18 + push * 0.22})`;
    fieldCtx.lineWidth = 2;

    for (let i = 0; i < pulses; i++) {
      const y = h - ((phase * 2 + i * h / pulses) % h);
      const radius = columnW * (0.45 + 0.28 * Math.sin(phase * 0.03 + i));
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

    fieldCtx.fillStyle = `rgba(243,201,122,${0.30 + push * 0.25})`;
    fieldCtx.beginPath();
    fieldCtx.arc(cx, cy, 7 + push * 7, 0, Math.PI * 2);
    fieldCtx.fill();
  }

  function drawWaveform(w, h, cx, cy, fr, push, active) {
    const amp = h * (0.16 + push * 0.08);
    const freq = 2 + fr * 8;

    fieldCtx.beginPath();

    for (let x = 0; x <= w; x += 3) {
      let y = cy;

      active.forEach((deck, i) => {
        y += Math.sin((x / w) * Math.PI * 2 * freq + phase * 0.035 + i) * amp * ((deck.volume || 1) / 100);
      });

      x ? fieldCtx.lineTo(x, y) : fieldCtx.moveTo(x, y);
    }

    fieldCtx.strokeStyle = `rgba(122,243,255,${0.55 + push * 0.20})`;
    fieldCtx.lineWidth = 2;
    fieldCtx.stroke();
  }

  function drawDjSpectrum(w, h, active, push) {
    const bars = 36;
    const bw = w / bars;

    for (let i = 0; i < bars; i++) {
      const deck = active[i % Math.max(1, active.length)] || { freq: 432, volume: 0 };
      const v = (Math.sin(phase * 0.05 + i * 0.7 + deck.freq * 0.01) * 0.5 + 0.5) * (deck.volume / 100 || 0.2);
      const bh = h * (0.08 + v * 0.75);
      fieldCtx.fillStyle = color(i / bars, 0.35 + push * 0.25);
      fieldCtx.fillRect(i * bw + 3, h - bh - 18, Math.max(2, bw - 6), bh);
    }
  }

  function bindEvents() {
    $("#playBtn") && on($("#playBtn"), "click", playMix);
    $("#stopBtn") && on($("#stopBtn"), "click", () => {
      stopLiftLoop(false);
      stopAll();
      log("Stopped.");
    });

    $("#dockPlay") && on($("#dockPlay"), "click", playMix);
    $("#dockStop") && on($("#dockStop"), "click", () => stopAll(0.25));
    $("#dockRecord") && on($("#dockRecord"), "click", () => recording ? stopRecording() : startRecording());
    $("#dockLift") && on($("#dockLift"), "click", startLiftLoop);
    $("#dockLog") && on($("#dockLog"), "click", () => $("#journalIntention")?.scrollIntoView({ behavior: "smooth", block: "center" }));

    ["masterVolume", "visualPower", "fadeTime", "visualMode", "crossfader"].forEach(id => {
      on($("#" + id), "input", refreshDecks);
      on($("#" + id), "change", updateUI);
    });

    getDeckCards().forEach((card, index) => {
      $$(".deck-freq, .deck-vol, .deck-pan, .deck-wave, .deck-harmonic, .deck-beat", card).forEach(control => {
        on(control, "input", () => playDeck(index));
        on(control, "change", () => playDeck(index));
      });

      on($(".deck-cue", card), "click", () => cueDeck(index));

      on($(".deck-mute", card), "click", () => {
        card.classList.toggle("is-muted");
        refreshDecks();
        log(`Deck ${String.fromCharCode(65 + index)} mute toggled.`);
      });

      on($(".deck-solo", card), "click", () => {
        card.classList.toggle("is-solo");
        refreshDecks();
        log(`Deck ${String.fromCharCode(65 + index)} solo toggled.`);
      });

      on($(".deck-add-loop", card), "click", () => addLoopStep(index));
    });

    $$(".deck-target").forEach(btn => {
      on(btn, "click", () => {
        selectedDeck = Number(btn.dataset.target);
        updateDeckTargets();
        log(`Library target set to Deck ${String.fromCharCode(65 + selectedDeck)}.`);
      });
    });

    $$(".seqBtn").forEach(btn => on(btn, "click", () => runSequence(btn.dataset.seq)));

    $("#playLoop") && on($("#playLoop"), "click", playLoop);
    $("#clearLoop") && on($("#clearLoop"), "click", () => {
      loopSteps = [];
      renderLoop();
      log("Custom loop cleared.");
    });
    $("#stopSeq") && on($("#stopSeq"), "click", () => {
      stopSequence();
      stopLoop();
      log("Sequence stopped.");
    });

    $("#recordTrack") && on($("#recordTrack"), "click", startRecording);
    $("#stopRecord") && on($("#stopRecord"), "click", stopRecording);
    $("#playTrack") && on($("#playTrack"), "click", playRecordedTrack);
    $("#stopTrack") && on($("#stopTrack"), "click", () => stopTrack());
    $("#saveTrack") && on($("#saveTrack"), "click", saveTrack);
    $("#loadTrack") && on($("#loadTrack"), "click", loadTrack);
    $("#exportTrack") && on($("#exportTrack"), "click", exportTrack);
    $("#clearTrack") && on($("#clearTrack"), "click", clearTrack);

    $("#savePreset") && on($("#savePreset"), "click", savePreset);
    $("#loadPreset") && on($("#loadPreset"), "click", loadPreset);
    $("#resetMixer") && on($("#resetMixer"), "click", resetMixer);

    $("#startT7") && on($("#startT7"), "click", startT7);
    $("#stopT7") && on($("#stopT7"), "click", () => {
      stopAll();
      log("T7 Field ended.");
    });

    $("#startLiftLoop") && on($("#startLiftLoop"), "click", startLiftLoop);
    $("#stopLiftLoop") && on($("#stopLiftLoop"), "click", () => stopLiftLoop());

    $("#saveJournal") && on($("#saveJournal"), "click", saveJournal);
    $("#copyJournal") && on($("#copyJournal"), "click", async () => {
      await navigator.clipboard.writeText(buildJournalText());
      log("Witness copied.");
    });
    $("#clearJournal") && on($("#clearJournal"), "click", () => {
      $("#journalIntention").value = "";
      $("#journalBody").value = "";
      $("#journalNote").value = "";
      log("Journal fields cleared.");
    });

    $("#exportJournal") && on($("#exportJournal"), "click", exportJournal);
    $("#importJournal") && on($("#importJournal"), "click", () => $("#importJournalFile")?.click());
    $("#importJournalFile") && on($("#importJournalFile"), "change", e => {
      const file = e.target.files?.[0];
      if (file) importJournal(file);
      e.target.value = "";
    });

    $("#clearJournalArchive") && on($("#clearJournalArchive"), "click", () => {
      localStorage.removeItem(STORE_JOURNAL);
      renderJournal();
      log("Journal archive cleared.");
    });

    $("#clearField") && on($("#clearField"), "click", () => {
      fieldCtx && fieldCtx.clearRect(0, 0, fieldCanvas.width, fieldCanvas.height);
    });

    $("#saveFieldPng") && on($("#saveFieldPng"), "click", () => {
      if (!fieldCanvas) return;
      const a = document.createElement("a");
      a.href = fieldCanvas.toDataURL("image/png");
      a.download = "frequency-governance-field.png";
      a.click();
    });

    $("#randomSeed") && on($("#randomSeed"), "click", () => {
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
    renderLoop();
    renderTrackTimeline();
    renderJournal();
    bindEvents();
    updateDeckTargets();
    updateUI();
    drawStars();
    drawVisualizer();
    log("DJ Observatory Workstation loaded.");
  }

  boot();
})();
