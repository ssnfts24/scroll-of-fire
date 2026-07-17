/* =====================================================
   Scroll of Fire — Frequency Governance
   Living Sound Observatory Build
   File: assets/js/frequency-governance.js
   Upgrade: louder gain chain, audio boost, limiter,
   mobile controls, sound check, better navigation hooks.
===================================================== */

(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);

  const STORE_JOURNAL = "sof_frequency_governance_journal_v2";
  const STORE_FIELD = "sof_frequency_governance_field_v2";
  const STORE_TRACK = "sof_frequency_governance_track_v2";

  const PRESETS = [
    [40, "Gamma Spark", "bright focus"],
    [72, "Breath Gate", "entry pulse"],
    [108, "Temple Door", "sacred measure"],
    [111, "Body Ground", "low field"],
    [144, "Root Expansion", "foundation"],
    [174, "Soft Release", "gentle calm"],
    [222, "Witness Pair", "balance mirror"],
    [285, "Repair Field", "restoration symbol"],
    [333, "Spark Mirror", "creative signal"],
    [369, "Creative Pulse", "pattern motion"],
    [396, "Unburden", "grounding"],
    [417, "Shift Gate", "movement"],
    [432, "Foundation", "Scroll carrier"],
    [528, "Restoration", "bright coherence"],
    [555, "Change Gate", "movement marker"],
    [639, "Heart Link", "connection"],
    [741, "Clarity", "clear signal"],
    [777, "Sevenfold Gate", "completion path"],
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

  const TEXTURE_GAIN = {
    pure: 1.1,
    warm: 1,
    breath: 0.92,
    bell: 0.88,
    choir: 0.84,
    crystal: 0.88,
    temple: 0.94,
    earth: 0.98,
    solar: 0.92
  };

  const INTENSITY_MULT = {
    soft: 0.72,
    balanced: 1,
    deep: 1.18,
    monumental: 1.34
  };

  const PATHS = {
    calm: {
      label: "Calm Path",
      visual: "torus",
      texture: "warm",
      decks: [
        { freq: 432, volume: 74, pan: -0.08, wave: "sine", harmonic: "single", beat: "schumann" },
        { freq: 396, volume: 42, pan: 0.18, wave: "sine", harmonic: "deep", beat: "none" }
      ],
      seq: [432, 396, 417, 432]
    },
    focus: {
      label: "Focus Path",
      visual: "lattice",
      texture: "crystal",
      decks: [
        { freq: 144, volume: 72, pan: -0.16, wave: "sine", harmonic: "octave", beat: "alpha" },
        { freq: 369, volume: 48, pan: 0.16, wave: "triangle", harmonic: "fifth", beat: "none" },
        { freq: 741, volume: 32, pan: 0, wave: "sine", harmonic: "single", beat: "none" }
      ],
      seq: [144, 369, 432, 528, 741]
    },
    clarity: {
      label: "Clarity Path",
      visual: "rose",
      texture: "bell",
      decks: [
        { freq: 432, volume: 64, pan: -0.12, wave: "sine", harmonic: "single", beat: "none" },
        { freq: 528, volume: 52, pan: 0.12, wave: "triangle", harmonic: "fifth", beat: "none" },
        { freq: 741, volume: 36, pan: 0, wave: "sine", harmonic: "octave", beat: "alpha" }
      ],
      seq: [432, 528, 741, 963]
    },
    restore: {
      label: "Restore Path",
      visual: "flower",
      texture: "warm",
      decks: [
        { freq: 285, volume: 60, pan: -0.18, wave: "sine", harmonic: "deep", beat: "theta" },
        { freq: 432, volume: 58, pan: 0.12, wave: "sine", harmonic: "single", beat: "schumann" },
        { freq: 528, volume: 38, pan: 0.25, wave: "triangle", harmonic: "fifth", beat: "none" }
      ],
      seq: [285, 396, 432, 528, 639]
    },
    create: {
      label: "Create Path",
      visual: "orbit",
      texture: "solar",
      decks: [
        { freq: 333, volume: 58, pan: -0.24, wave: "triangle", harmonic: "triad", beat: "none" },
        { freq: 369, volume: 64, pan: 0.16, wave: "sine", harmonic: "fifth", beat: "alpha" },
        { freq: 528, volume: 38, pan: 0.35, wave: "sine", harmonic: "octave", beat: "none" }
      ],
      seq: [333, 369, 432, 528, 555]
    },
    dream: {
      label: "Dream Gate",
      visual: "constellation",
      texture: "choir",
      decks: [
        { freq: 432, volume: 56, pan: -0.18, wave: "sine", harmonic: "deep", beat: "theta" },
        { freq: 285, volume: 40, pan: 0.18, wave: "sine", harmonic: "single", beat: "delta" },
        { freq: 174, volume: 30, pan: 0, wave: "sine", harmonic: "single", beat: "none" }
      ],
      seq: [432, 285, 174, 111]
    },
    t7: {
      label: "T7 Field",
      visual: "torus",
      texture: "temple",
      decks: [
        { freq: 111, volume: 42, pan: -0.35, wave: "sine", harmonic: "deep", beat: "none" },
        { freq: 432, volume: 78, pan: 0, wave: "sine", harmonic: "single", beat: "schumann" },
        { freq: 528, volume: 44, pan: 0.18, wave: "sine", harmonic: "fifth", beat: "none" },
        { freq: 963, volume: 28, pan: 0.36, wave: "sine", harmonic: "octave", beat: "none" }
      ],
      seq: [111, 144, 369, 432, 528, 741, 963]
    },
    lift: {
      label: "Lift Loop",
      visual: "lift",
      texture: "breath",
      decks: [
        { freq: 432, volume: 78, pan: 0, wave: "sine", harmonic: "single", beat: "schumann" },
        { freq: 528, volume: 42, pan: 0.2, wave: "sine", harmonic: "fifth", beat: "none" },
        { freq: 963, volume: 28, pan: 0.34, wave: "sine", harmonic: "octave", beat: "none" }
      ],
      seq: [432, 432, 528, 369, 432, 963, 432]
    },
    remnant: {
      label: "Remnant Path",
      visual: "tree",
      texture: "earth",
      decks: [
        { freq: 432, volume: 72, pan: 0, wave: "sine", harmonic: "single", beat: "schumann" },
        { freq: 144, volume: 42, pan: -0.22, wave: "sine", harmonic: "octave", beat: "none" },
        { freq: 741, volume: 34, pan: 0.22, wave: "triangle", harmonic: "single", beat: "none" }
      ],
      seq: [144, 432, 528, 741, 432]
    },
    study: { alias: "focus" },
    build: { alias: "create" },
    prayer: { alias: "yhwh" },
    ground: { alias: "calm" },
    release: { alias: "restore" },
    witness: { alias: "remnant" },
    yod: {
      label: "𐤉 · Breath",
      visual: "torus",
      texture: "breath",
      decks: [
        { freq: 72, volume: 52, pan: -0.12, wave: "sine", harmonic: "octave", beat: "theta" },
        { freq: 432, volume: 70, pan: 0.12, wave: "sine", harmonic: "single", beat: "schumann" }
      ],
      seq: [72, 144, 432]
    },
    heh1: {
      label: "𐤄 · Expansion",
      visual: "flower",
      texture: "choir",
      decks: [
        { freq: 144, volume: 54, pan: -0.2, wave: "sine", harmonic: "field", beat: "none" },
        { freq: 528, volume: 62, pan: 0.18, wave: "triangle", harmonic: "fifth", beat: "alpha" }
      ],
      seq: [144, 288, 432, 528]
    },
    waw: {
      label: "𐤅 · Connection",
      visual: "metatron",
      texture: "warm",
      decks: [
        { freq: 222, volume: 52, pan: -0.22, wave: "sine", harmonic: "octave", beat: "none" },
        { freq: 639, volume: 62, pan: 0.22, wave: "sine", harmonic: "fifth", beat: "theta" }
      ],
      seq: [222, 432, 639]
    },
    heh2: {
      label: "𐤄 · Return",
      visual: "tree",
      texture: "earth",
      decks: [
        { freq: 432, volume: 70, pan: 0, wave: "sine", harmonic: "single", beat: "schumann" },
        { freq: 174, volume: 34, pan: 0.2, wave: "sine", harmonic: "deep", beat: "none" }
      ],
      seq: [639, 432, 174, 111]
    },
    yhwh: {
      label: "𐤉𐤄𐤅𐤄 · Full Name Path",
      visual: "metatron",
      texture: "temple",
      decks: [
        { freq: 72, volume: 40, pan: -0.36, wave: "sine", harmonic: "octave", beat: "theta" },
        { freq: 144, volume: 46, pan: -0.12, wave: "sine", harmonic: "field", beat: "none" },
        { freq: 432, volume: 72, pan: 0.12, wave: "sine", harmonic: "single", beat: "schumann" },
        { freq: 639, volume: 42, pan: 0.34, wave: "triangle", harmonic: "fifth", beat: "none" }
      ],
      seq: [72, 144, 432, 639, 432, 174, 111]
    },
    orhadabar: {
      label: "Or HaDabar",
      visual: "rose",
      texture: "solar",
      decks: [
        { freq: 333, volume: 48, pan: -0.3, wave: "triangle", harmonic: "triad", beat: "none" },
        { freq: 528, volume: 62, pan: 0, wave: "sine", harmonic: "fifth", beat: "alpha" },
        { freq: 741, volume: 42, pan: 0.28, wave: "sine", harmonic: "octave", beat: "none" }
      ],
      seq: [333, 432, 528, 741, 963]
    }
  };

  let audioCtx = null;
  let masterGain = null;
  let boostGain = null;
  let compressor = null;
  let limiter = null;
  let deckNodes = [];
  let isPlaying = false;
  let selectedDeck = 0;
  let sequenceTimer = null;
  let liftTimer = null;
  let liftStep = 0;
  let activePath = "Foundation";
  let currentSeq = null;
  let recording = false;
  let trackStart = 0;
  let trackEvents = [];
  let trackTimer = null;
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

  function text(el, value) {
    if (el) el.textContent = value;
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

  function safeText(value) {
    return String(value || "").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
  }

  function selectValue(id, fallback = "") {
    return $("#" + id)?.value || fallback;
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
    return clamp($("#masterVolume")?.value || 72, 0, 100) / 100;
  }

  function audioBoost() {
    return clamp($("#audioBoost")?.value || 1.5, 1, 2.6);
  }

  function outputModeMultiplier() {
    const mode = selectValue("outputMode", "headphones");
    if (mode === "phone") return 1.28;
    if (mode === "speaker") return 1.14;
    return 1;
  }

  function fadeTime() {
    return clamp($("#fadeTime")?.value || 1.75, 0.15, 8);
  }

  function gainCurve(percent) {
    const p = clamp(percent, 0, 100) / 100;
    const intensity = INTENSITY_MULT[selectValue("presetIntensity", "balanced")] || 1;
    const texture = TEXTURE_GAIN[selectValue("presetTexture", "warm")] || 1;
    return Math.pow(p, 1.35) * 0.34 * intensity * texture;
  }

  function crossGain(index) {
    const cross = clamp($("#crossfader")?.value || 0, 0, 100) / 100;
    if (index === 0) return 1 - cross * 0.75;
    if (index === 1) return 0.25 + cross * 0.75;
    return 1;
  }

  function unlockAudio() {
    const ac = getAudio();
    if (ac.state === "suspended") ac.resume();
    updateOutputGain();
    return ac;
  }

  function getAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();

      masterGain = audioCtx.createGain();
      boostGain = audioCtx.createGain();
      compressor = audioCtx.createDynamicsCompressor();
      limiter = audioCtx.createDynamicsCompressor();

      compressor.threshold.value = -22;
      compressor.knee.value = 24;
      compressor.ratio.value = 3;
      compressor.attack.value = 0.012;
      compressor.release.value = 0.18;

      limiter.threshold.value = -6;
      limiter.knee.value = 0;
      limiter.ratio.value = 18;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.12;

      masterGain.connect(boostGain);
      boostGain.connect(compressor);
      compressor.connect(limiter);
      limiter.connect(audioCtx.destination);

      updateOutputGain();
    }

    return audioCtx;
  }

  function updateOutputGain() {
    if (!audioCtx || !masterGain || !boostGain) return;

    const now = audioCtx.currentTime;
    const mv = Math.pow(masterVolume(), 1.15);
    const boost = audioBoost() * outputModeMultiplier();

    masterGain.gain.setTargetAtTime(mv, now, 0.04);
    boostGain.gain.setTargetAtTime(boost, now, 0.04);
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
    const ac = unlockAudio();
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const pan = ac.createStereoPanner ? ac.createStereoPanner() : null;

    osc.type = wave;
    osc.frequency.setValueAtTime(clamp(freq, 20, 2200), now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), now + fade);

    if (pan) {
      pan.pan.setValueAtTime(clamp(panValue, -1, 1), now);
      osc.connect(gain).connect(pan).connect(masterGain);
    } else {
      osc.connect(gain).connect(masterGain);
    }

    osc.start(now);
    return { osc, gain, pan };
  }

  function textureRatios(baseRatios) {
    const texture = selectValue("presetTexture", "warm");
    if (texture === "bell") return [...baseRatios, 2.41, 3.03];
    if (texture === "choir") return [...baseRatios, 0.5, 1.01, 1.5, 2.01];
    if (texture === "crystal") return [...baseRatios, 2, 3, 4];
    if (texture === "temple") return [...baseRatios, 0.5, 1, 1.5, 2, 3];
    if (texture === "earth") return [...baseRatios, 0.5, 0.75, 1];
    if (texture === "solar") return [...baseRatios, 1.25, 1.5, 2, 3];
    return baseRatios;
  }

  function playDeck(index) {
    const deck = getDeck(index);
    if (!deck) return;

    const oldGroup = deckNodes[index] || [];
    const fade = fadeTime();
    const ratios = textureRatios(HARMONICS[deck.harmonic] || [1]);
    const beat = BEATS[deck.beat] || 0;
    const baseGain = deckAudible(deck) ? gainCurve(deck.volume) * crossGain(index) : 0.0001;
    const oscCount = beat ? ratios.length * 2 : ratios.length;
    const perGain = baseGain / Math.max(1, Math.sqrt(oscCount) * 1.65);
    const group = [];

    ratios.forEach((ratio, i) => {
      const base = deck.freq * ratio;
      if (base < 20 || base > 2200) return;

      if (beat) {
        group.push(createOsc(base - beat / 2, deck.wave, deck.pan - 0.22, perGain, fade));
        group.push(createOsc(base + beat / 2, deck.wave, deck.pan + 0.22, perGain, fade));
      } else {
        const spread = ratios.length === 1 ? 0 : -0.22 + (0.44 * i) / Math.max(1, ratios.length - 1);
        group.push(createOsc(base, deck.wave, deck.pan + spread, perGain, fade));
      }
    });

    deckNodes[index] = group;
    stopNodeGroup(oldGroup, fade);
    isPlaying = true;
    updateUI();
  }

  function playMix() {
    unlockAudio();
    updateOutputGain();
    getDecks().forEach(deck => {
      if (deck.volume > 0 || deck.index === 0) playDeck(deck.index);
    });
    isPlaying = true;
    updateUI();
    recordEvent("play", { path: activePath });
    log("Field started.");
  }

  function refreshDecks() {
    updateOutputGain();
    if (!isPlaying) {
      updateUI();
      return;
    }
    getDecks().forEach(deck => playDeck(deck.index));
  }

  function soundCheck() {
    unlockAudio();

    const ac = audioCtx;
    const now = ac.currentTime;
    const gain = ac.createGain();
    const osc1 = ac.createOscillator();
    const osc2 = ac.createOscillator();

    osc1.type = "sine";
    osc2.type = "triangle";
    osc1.frequency.setValueAtTime(432, now);
    osc2.frequency.setValueAtTime(528, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.38, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(masterGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 1.5);
    osc2.stop(now + 1.5);

    updateUI();
    log("Sound Check played. Raise media volume if needed.");
  }

  function cycleBoost() {
    const boost = $("#audioBoost");
    if (!boost) return;

    const order = ["1", "1.5", "2", "2.6"];
    const next = order[(order.indexOf(boost.value) + 1) % order.length];
    boost.value = next;
    updateOutputGain();
    updateUI();
    log(`Audio Boost set to ${boost.selectedOptions?.[0]?.textContent || next}.`);
  }

  function stopAll(fade = fadeTime()) {
    deckNodes.forEach(group => stopNodeGroup(group, fade));
    deckNodes = [];
    isPlaying = false;
    stopSequence(false);
    stopLiftLoop(false);
    updateUI();
  }

  function applyDeck(index, data = {}) {
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

    if (isPlaying) playDeck(index);
  }

  function clearDecks() {
    getCards().forEach((card, i) => applyDeck(i, { freq: [432, 528, 369, 963][i] || 432, volume: 0 }));
  }

  function resolvePath(name) {
    const path = PATHS[name] || PATHS.calm;
    return path.alias ? resolvePath(path.alias) : path;
  }

  function loadPath(name, autoPlay = true) {
    const path = resolvePath(name);
    activePath = path.label;
    currentSeq = path.seq || [432];

    stopSequence(false);
    stopLiftLoop(false);

    if ($("#visualMode")) $("#visualMode").value = path.visual || "torus";
    if ($("#presetTexture")) $("#presetTexture").value = path.texture || selectValue("presetTexture", "warm");

    clearDecks();
    (path.decks || []).forEach((deck, i) => applyDeck(i, deck));

    if (autoPlay) playMix();

    updateForgeStats();
    updateUI();
    recordEvent("path", { name, label: path.label });
    log(`Path loaded: ${path.label}.`);

    /* Phase 2 — record frequency session start in CodexMemory */
    if (autoPlay && window.CodexMemory && typeof window.CodexMemory.recordFrequency === "function") {
      try {
        const lead = path.decks && path.decks[0];
        const carrier = lead ? Math.round(lead.freq) + " Hz" : "";
        window.CodexMemory.recordFrequency({
          presetName: path.label,
          carrier:    carrier,
          startedAt:  new Date().toISOString(),
          sourceUrl:  window.location.href
        });
      } catch (_) {}
    }
  }

  function setDeckFreq(index, freq, volume = 64) {
    const card = getCard(index);
    if (!card) return;
    $(".deck-freq", card).value = Math.round(clamp(freq, 40, 1800));
    $(".deck-vol", card).value = clamp(volume, 0, 100);
    playDeck(index);
  }

  function cueDeck(index) {
    selectedDeck = index;
    updateDeckTargets();

    const card = getCard(index);
    const vol = $(".deck-vol", card);
    if (vol && Number(vol.value) === 0) vol.value = 58;

    playDeck(index);
    log(`Deck ${String.fromCharCode(65 + index)} cued.`);
  }

  function updateForgeStats() {
    text($("#statTexture"), $("#presetTexture")?.selectedOptions?.[0]?.textContent || "Warm Harmonic");
    text($("#statBreath"), $("#breathPace")?.selectedOptions?.[0]?.textContent || "4 · 2 · 6");
    text($("#statIntensity"), ($("#presetIntensity")?.selectedOptions?.[0]?.textContent || "Balanced Field").replace(" Field", ""));
    text($("#statSession"), ($("#sessionLength")?.selectedOptions?.[0]?.textContent || "7 Minutes").replace(" Minutes", " min"));
  }

  function updateUI() {
    const lead = leadDeck();
    const visualName = $("#visualMode")?.selectedOptions?.[0]?.textContent || "Torus Field";
    const boostName = $("#audioBoost")?.selectedOptions?.[0]?.textContent || "Boosted";

    updateOutputGain();

    text($("#masterValue"), Math.round(lead.freq));
    text($("#statCarrier"), `${Math.round(lead.freq)} Hz`);
    text($("#statPath"), activePath);
    text($("#statState"), isPlaying ? "Active" : "Stopped");
    text($("#commandTitle"), `${Math.round(lead.freq)} Hz · ${activePath}`);
    text($("#stateText"), isPlaying ? "active" : "stopped");

    $("#stateText")?.classList.toggle("active", isPlaying);

    if ($("#meter")) $("#meter").style.width = `${Math.round(masterVolume() * 100)}%`;

    text(
      $("#settingText"),
      `${Math.round(lead.freq)} Hz · ${Math.round(masterVolume() * 100)}% master · ${boostName} · ${visualName}`
    );

    getCards().forEach((card, i) => {
      const deck = getDeck(i);
      card.classList.toggle("is-active", isPlaying && deckAudible(deck));
      card.classList.toggle("is-muted", deck.muted);
      card.classList.toggle("is-solo", deck.solo);
    });

    updateForgeStats();
  }

  function updateDeckTargets() {
    $$(".deck-target").forEach(btn => btn.classList.toggle("active", Number(btn.dataset.target) === selectedDeck));
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
        setDeckFreq(selectedDeck, freq, 64);
        recordEvent("carrier", { freq });
        log(`${freq} Hz loaded into Deck ${String.fromCharCode(65 + selectedDeck)}.`);
      });
    });
  }

  function stopSequence(update = true) {
    clearInterval(sequenceTimer);
    sequenceTimer = null;
    if ($("#seqStatus")) $("#seqStatus").value = "stopped";
    $$(".seqBtn").forEach(btn => btn.classList.remove("is-active"));
    if (update) updateUI();
  }

  function runSequence(name) {
    loadPath(name, true);

    const path = resolvePath(name);
    const seq = path.seq || currentSeq || [432];
    const seconds = clamp($("#seqSeconds")?.value || 8, 2, 90);
    let i = 0;

    stopSequence(false);

    function step() {
      const freq = seq[i % seq.length];
      setDeckFreq(0, freq, getDeck(0)?.volume || 70);
      if ($("#seqStatus")) $("#seqStatus").value = `${path.label} · ${freq} Hz · ${(i % seq.length) + 1}/${seq.length}`;
      $$(".seqBtn").forEach(btn => btn.classList.toggle("is-active", btn.dataset.seq === name));
      i++;
    }

    step();
    sequenceTimer = setInterval(step, seconds * 1000);
    recordEvent("sequence", { name, label: path.label });
  }

  function startT7() {
    loadPath("t7", true);
    log("T7 Field started.");
  }

  function setLiftDot(step) {
    for (let i = 1; i <= 7; i++) $(`#liftStep${i}`)?.classList.toggle("active", i === step);
  }

  function startLiftLoop() {
    loadPath("lift", true);
    liftStep = 0;

    function step() {
      const dot = (liftStep % 7) + 1;
      setLiftDot(dot);
      const seq = PATHS.lift.seq;
      setDeckFreq(0, seq[liftStep % seq.length], 78);
      log(`Lift Loop step ${dot}/7.`);
      liftStep++;
    }

    clearInterval(liftTimer);
    step();
    liftTimer = setInterval(step, 30000);
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
Path: ${activePath}
Lead Carrier: ${Math.round(lead.freq)} Hz
Master Volume: ${Math.round(masterVolume() * 100)}%
Audio Boost: ${$("#audioBoost")?.selectedOptions?.[0]?.textContent || ""}
Output Mode: ${$("#outputMode")?.selectedOptions?.[0]?.textContent || ""}
Texture: ${$("#presetTexture")?.selectedOptions?.[0]?.textContent || ""}
Intensity: ${$("#presetIntensity")?.selectedOptions?.[0]?.textContent || ""}
Breath Pace: ${$("#breathPace")?.selectedOptions?.[0]?.textContent || ""}
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
    try { return JSON.parse(localStorage.getItem(STORE_JOURNAL) || "[]"); }
    catch { return []; }
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
    items.unshift({ when: new Date().toLocaleString(), path: activePath, text: buildJournalText() });
    setJournal(items.slice(0, 120));
    renderJournal();
    log("Witness saved.");

    /* Phase 2 — record frequency session in CodexMemory */
    if (window.CodexMemory && typeof window.CodexMemory.recordFrequency === "function") {
      try {
        const lead = leadDeck();
        const carrier = lead ? Math.round(lead.freq) + " Hz" : "";
        window.CodexMemory.recordFrequency({
          presetName:  activePath || "Custom Field",
          carrier:     carrier,
          startedAt:   new Date().toISOString(),
          completedAt: new Date().toISOString(),
          sourceUrl:   window.location.href
        });
      } catch (_) {}
    }
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
      setJournal(data.concat(getJournal()).slice(0, 160));
      renderJournal();
      log("Journal imported.");
    } catch {
      log("Journal import failed.");
    }
  }

  function fieldSnapshot() {
    return {
      path: activePath,
      selectedDeck,
      visualMode: selectValue("visualMode", "torus"),
      presetTexture: selectValue("presetTexture", "warm"),
      presetIntensity: selectValue("presetIntensity", "balanced"),
      breathPace: selectValue("breathPace", "426"),
      sessionLength: selectValue("sessionLength", "7"),
      masterVolume: $("#masterVolume")?.value,
      audioBoost: $("#audioBoost")?.value,
      outputMode: $("#outputMode")?.value,
      visualPower: $("#visualPower")?.value,
      fadeTime: $("#fadeTime")?.value,
      crossfader: $("#crossfader")?.value,
      decks: getDecks()
    };
  }

  function saveField() {
    localStorage.setItem(STORE_FIELD, JSON.stringify(fieldSnapshot()));
    log("Field saved.");
  }

  function loadField() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_FIELD) || "{}");
      if (!saved.decks) throw new Error("No saved field");

      [
        "visualMode",
        "presetTexture",
        "presetIntensity",
        "breathPace",
        "sessionLength",
        "masterVolume",
        "audioBoost",
        "outputMode",
        "visualPower",
        "fadeTime",
        "crossfader"
      ].forEach(id => {
        if ($("#" + id) && saved[id] != null) $("#" + id).value = saved[id];
      });

      activePath = saved.path || "Saved Field";
      selectedDeck = saved.selectedDeck || 0;
      saved.decks.forEach((deck, i) => applyDeck(i, deck));
      updateDeckTargets();
      updateUI();
      if (isPlaying) refreshDecks();
      log("Field loaded.");
    } catch {
      log("No saved field found.");
    }
  }

  function resetField() {
    stopAll(0.35);
    activePath = "Foundation";
    selectedDeck = 0;

    if ($("#visualMode")) $("#visualMode").value = "torus";
    if ($("#presetTexture")) $("#presetTexture").value = "warm";
    if ($("#presetIntensity")) $("#presetIntensity").value = "balanced";
    if ($("#breathPace")) $("#breathPace").value = "426";
    if ($("#sessionLength")) $("#sessionLength").value = "7";
    if ($("#masterVolume")) $("#masterVolume").value = 72;
    if ($("#audioBoost")) $("#audioBoost").value = "1.5";
    if ($("#outputMode")) $("#outputMode").value = "headphones";

    clearDecks();
    applyDeck(0, { freq: 432, volume: 100, pan: 0, wave: "sine", harmonic: "single", beat: "schumann" });
    applyDeck(1, { freq: 528, volume: 28, pan: 0.15, wave: "sine", harmonic: "fifth", beat: "none" });
    applyDeck(2, { freq: 369, volume: 18, pan: -0.35, wave: "triangle", harmonic: "single", beat: "none" });
    applyDeck(3, { freq: 963, volume: 16, pan: 0.35, wave: "sine", harmonic: "octave", beat: "none" });

    updateUI();
    log("Field reset.");
  }

  function recordEvent(type, data = {}) {
    if (!recording) return;
    trackEvents.push({ t: Math.round(performance.now() - trackStart), type, data });
    updateTrackUI();
  }

  function startRecord() {
    recording = true;
    trackEvents = [];
    trackStart = performance.now();
    clearInterval(trackTimer);
    trackTimer = setInterval(updateTrackUI, 500);
    text($("#statTrack"), "Recording");
    log("Track recording started.");
  }

  function stopRecord() {
    recording = false;
    clearInterval(trackTimer);
    text($("#statTrack"), "Idle");
    updateTrackUI();
    log("Track recording stopped.");
  }

  function updateTrackUI() {
    text($("#trackEvents"), String(trackEvents.length));

    if ($("#trackClock")) {
      const ms = recording ? performance.now() - trackStart : (trackEvents.at(-1)?.t || 0);
      const s = Math.floor(ms / 1000);
      $("#trackClock").textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    }

    const timeline = $("#trackTimeline");
    if (timeline) {
      timeline.innerHTML = trackEvents.length
        ? trackEvents.slice(-20).map(e => `<span class="fine">+${(e.t / 1000).toFixed(1)}s · ${safeText(e.type)} · ${safeText(e.data.label || e.data.name || e.data.freq || "")}</span>`).join("<br>")
        : `<span class="fine">No recorded events yet.</span>`;
    }
  }

  function saveTrack() {
    localStorage.setItem(STORE_TRACK, JSON.stringify(trackEvents));
    log("Track saved.");
  }

  function loadTrack() {
    try {
      trackEvents = JSON.parse(localStorage.getItem(STORE_TRACK) || "[]");
      updateTrackUI();
      log("Track loaded.");
    } catch {
      log("No track found.");
    }
  }

  function exportTrack() {
    const blob = new Blob([JSON.stringify(trackEvents, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "frequency-governance-track.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 600);
  }

  function clearTrack() {
    trackEvents = [];
    updateTrackUI();
    log("Track cleared.");
  }

  function playTrack() {
    if (!trackEvents.length) {
      log("No track events to play.");
      return;
    }

    stopAll(0.25);
    text($("#statTrack"), "Playing");

    trackEvents.forEach(e => {
      setTimeout(() => {
        if (e.type === "path" || e.type === "sequence") loadPath(e.data.name, true);
        if (e.type === "carrier") setDeckFreq(selectedDeck, e.data.freq, 64);
      }, e.t);
    });

    setTimeout(() => {
      text($("#statTrack"), "Idle");
      log("Track playback complete.");
    }, (trackEvents.at(-1)?.t || 0) + 700);
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
    stars = Array.from({ length: 180 }, () => ({
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
    const visual = clamp($("#visualPower")?.value || 130, 20, 260) / 100;
    const mode = selectValue("visualMode", "torus");
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
    else if (mode === "waveform") drawScope(w, h, cx, cy, fr, push);
    else if (mode === "flower") drawFlower(w, h, cx, cy, baseR, push);
    else if (mode === "metatron") drawMetatron(w, h, cx, cy, baseR, push);
    else if (mode === "tree") drawTree(w, h, cx, cy, baseR, push);
    else if (mode === "constellation") drawConstellation(w, h, cx, cy, baseR, push);
    else drawTorus(w, h, cx, cy, baseR, fr, push, visual);

    fieldCtx.fillStyle = "rgba(244,241,232,0.92)";
    fieldCtx.font = "800 13px Inter, system-ui, sans-serif";
    fieldCtx.textAlign = "center";
    fieldCtx.fillText(isPlaying ? `${activePath} · ${Math.round(lead.freq)} Hz` : "FREQUENCY FIELD", cx, 25);

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
        const v = Math.sin((x / w) * Math.PI * (3 + fr * 8) + phase * 0.018) * Math.sin((y / h) * Math.PI * (2 + fr * 9) - phase * 0.015);
        if (Math.abs(v) < 0.10 + push * 0.10) {
          fieldCtx.fillStyle = color((v + 1) / 2, 0.30 + push * 0.22);
          fieldCtx.fillRect(x, y, 2.2, 2.2);
        }
      }
    }
  }

  function drawOrbit(w, h, cx, cy, baseR, fr, push) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + phase * 0.008 * (i % 2 ? -1 : 1);
      const r = baseR * (0.7 + (i % 4) * 0.22);
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r * 0.72;
      fieldCtx.strokeStyle = color(i / 10, 0.16 + push * 0.12);
      fieldCtx.beginPath();
      fieldCtx.arc(cx, cy, r, 0, Math.PI * 2);
      fieldCtx.stroke();
      fieldCtx.fillStyle = color(i / 10, 0.70);
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

  function drawFlower(w, h, cx, cy, baseR, push) {
    for (let ring = 0; ring < 3; ring++) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + ring * 0.22 + phase * 0.003;
        const x = cx + Math.cos(a) * baseR * ring * 0.33;
        const y = cy + Math.sin(a) * baseR * ring * 0.33;
        fieldCtx.strokeStyle = `rgba(243,201,122,${0.16 + push * 0.18})`;
        fieldCtx.beginPath();
        fieldCtx.arc(x, y, baseR * 0.36, 0, Math.PI * 2);
        fieldCtx.stroke();
      }
    }
  }

  function drawMetatron(w, h, cx, cy, baseR, push) {
    const pts = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + phase * 0.004;
      pts.push([cx + Math.cos(a) * baseR, cy + Math.sin(a) * baseR]);
    }
    pts.push([cx, cy]);

    fieldCtx.strokeStyle = `rgba(122,243,255,${0.18 + push * 0.18})`;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j += 2) {
        fieldCtx.beginPath();
        fieldCtx.moveTo(pts[i][0], pts[i][1]);
        fieldCtx.lineTo(pts[j][0], pts[j][1]);
        fieldCtx.stroke();
      }
    }

    pts.forEach(([x, y]) => {
      fieldCtx.fillStyle = `rgba(243,201,122,${0.55 + push * 0.2})`;
      fieldCtx.beginPath();
      fieldCtx.arc(x, y, 3 + push * 2, 0, Math.PI * 2);
      fieldCtx.fill();
    });
  }

  function drawTree(w, h, cx, cy, baseR, push) {
    fieldCtx.strokeStyle = `rgba(159,247,200,${0.28 + push * 0.20})`;
    fieldCtx.lineWidth = 2;
    fieldCtx.beginPath();
    fieldCtx.moveTo(cx, cy + baseR);
    fieldCtx.lineTo(cx, cy - baseR);
    fieldCtx.stroke();

    for (let i = 0; i < 7; i++) {
      const y = cy + baseR * 0.7 - i * (baseR * 0.24);
      const spread = baseR * (0.18 + i * 0.055);
      fieldCtx.beginPath();
      fieldCtx.moveTo(cx, y);
      fieldCtx.lineTo(cx - spread, y - baseR * 0.14);
      fieldCtx.moveTo(cx, y);
      fieldCtx.lineTo(cx + spread, y - baseR * 0.14);
      fieldCtx.stroke();
    }
  }

  function drawConstellation(w, h, cx, cy, baseR, push) {
    const pts = Array.from({ length: 22 }, (_, i) => {
      const a = i * 2.399 + visualSeed;
      const r = baseR * (0.35 + ((i * 37) % 100) / 100);
      return [cx + Math.cos(a + phase * 0.002) * r, cy + Math.sin(a * 1.1 + phase * 0.002) * r * 0.75];
    });

    fieldCtx.strokeStyle = `rgba(122,243,255,${0.16 + push * 0.16})`;
    fieldCtx.beginPath();
    pts.forEach(([x, y], i) => i ? fieldCtx.lineTo(x, y) : fieldCtx.moveTo(x, y));
    fieldCtx.stroke();

    pts.forEach(([x, y], i) => {
      fieldCtx.fillStyle = color((i % 10) / 10, 0.58 + push * 0.16);
      fieldCtx.beginPath();
      fieldCtx.arc(x, y, 2 + push * 2, 0, Math.PI * 2);
      fieldCtx.fill();
    });
  }

  function bind() {
    on($("#soundCheckBtn"), "click", soundCheck);
    on($("#playBtn"), "click", playMix);
    on($("#stopBtn"), "click", () => { stopAll(); recordEvent("stop"); log("Stopped."); });

    on($("#dockPlay"), "click", playMix);
    on($("#dockSoundCheck"), "click", soundCheck);
    on($("#dockBoost"), "click", cycleBoost);
    on($("#dockStop"), "click", () => stopAll(0.25));
    on($("#dockRecord"), "click", () => recording ? stopRecord() : startRecord());
    on($("#dockLift"), "click", startLiftLoop);
    on($("#dockLog"), "click", () => $("#journalIntention")?.scrollIntoView({ behavior: "smooth", block: "center" }));

    [
      "masterVolume",
      "audioBoost",
      "outputMode",
      "visualPower",
      "fadeTime",
      "visualMode",
      "crossfader",
      "presetTexture",
      "presetIntensity",
      "breathPace",
      "sessionLength"
    ].forEach(id => {
      on($("#" + id), "input", refreshDecks);
      on($("#" + id), "change", () => {
        refreshDecks();
        updateUI();
        recordEvent("setting", { id, value: $("#" + id)?.value });
      });
    });

    $$(".seqBtn").forEach(btn => on(btn, "click", () => runSequence(btn.dataset.seq)));

    $$(".geometry-btn").forEach(btn => {
      on(btn, "click", () => {
        if ($("#visualMode")) $("#visualMode").value = btn.dataset.visual;
        updateUI();
        recordEvent("visual", { visual: btn.dataset.visual });
        log(`Visual seal: ${btn.dataset.visual}.`);
      });
    });

    getCards().forEach((card, index) => {
      $$(".deck-freq, .deck-vol, .deck-pan, .deck-wave, .deck-harmonic, .deck-beat", card).forEach(control => {
        on(control, "input", () => playDeck(index));
        on(control, "change", () => playDeck(index));
      });

      on($(".deck-cue", card), "click", () => cueDeck(index));
      on($(".deck-mute", card), "click", () => { card.classList.toggle("is-muted"); refreshDecks(); });
      on($(".deck-solo", card), "click", () => { card.classList.toggle("is-solo"); refreshDecks(); });
      on($(".deck-add-loop", card), "click", () => {
        log(`Deck ${String.fromCharCode(65 + index)} added to loop memory.`);
      });
    });

    $$(".deck-target").forEach(btn => on(btn, "click", () => {
      selectedDeck = Number(btn.dataset.target);
      updateDeckTargets();
    }));

    on($("#playLoop"), "click", () => runSequence("remnant"));
    on($("#clearLoop"), "click", () => {
      stopSequence();
      log("Custom loop cleared.");
    });
    on($("#stopSeq"), "click", () => {
      stopSequence();
      log("Sequence stopped.");
    });

    on($("#startT7"), "click", startT7);
    on($("#stopT7"), "click", () => { stopAll(); log("T7 Field ended."); });
    on($("#startLiftLoop"), "click", startLiftLoop);
    on($("#stopLiftLoop"), "click", () => stopLiftLoop());

    on($("#savePreset"), "click", saveField);
    on($("#loadPreset"), "click", loadField);
    on($("#resetMixer"), "click", resetField);

    on($("#recordTrack"), "click", startRecord);
    on($("#stopRecord"), "click", stopRecord);
    on($("#playTrack"), "click", playTrack);
    on($("#stopTrack"), "click", () => stopAll(0.25));
    on($("#saveTrack"), "click", saveTrack);
    on($("#loadTrack"), "click", loadTrack);
    on($("#exportTrack"), "click", exportTrack);
    on($("#clearTrack"), "click", clearTrack);

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

    on($("#clearField"), "click", () => fieldCtx?.clearRect(0, 0, fieldCanvas.width, fieldCanvas.height));

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
    }, { passive: true });
  }

  function boot() {
    text($("#yr"), new Date().getFullYear());
    fitFieldCanvas();
    fitStars();
    renderLibrary();
    renderJournal();
    bind();
    updateDeckTargets();
    resetField();
    updateTrackUI();
    drawStars();
    drawVisualizer();
    log("Living Sound Observatory loaded. Press Sound Check first.");
  }

  boot();
})();
