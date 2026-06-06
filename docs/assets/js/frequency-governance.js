(() => {
  "use strict";

  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);

  const PRESETS = [
    [40, "Gamma Spark", "sharp focus / bright cognition"],
    [111, "Body Ground", "low field / temple resonance"],
    [144, "Root Expansion", "foundation carrier"],
    [174, "Soft Release", "gentle body calm"],
    [285, "Repair Field", "restoration symbolism"],
    [369, "Creative Pulse", "motion / pattern / emergence"],
    [396, "Unburden", "release / grounding"],
    [417, "Shift Gate", "change / movement"],
    [432, "Foundation", "stable Scroll carrier"],
    [528, "Restoration", "bright coherence field"],
    [639, "Heart Link", "connection / harmony"],
    [741, "Clarity", "clean signal / expression"],
    [852, "Vision", "inner attention"],
    [963, "Crown", "upper carrier / awe"],
    [1111, "Mirror Field", "symbolic observation"],
    [1728, "Cube Harmonic", "12³ structure field"]
  ];

  const SEQUENCES = {
    calm: [174, 285, 396, 432],
    focus: [144, 369, 432, 528, 741],
    restore: [285, 396, 432, 528, 639],
    clarity: [432, 528, 741, 852, 963],
    dream: [432, 285, 174, 111],
    ascent: [144, 288, 432, 528, 741, 963],
    remnant: [144, 369, 432, 528, 963, 432],
    t7: [111, 144, 369, 432, 528, 741, 963, 1728]
  };

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

  let ac = null;
  let master = null;
  let nodes = [];
  let activeFreq = 432;
  let visualFreq = 432;
  let playing = false;
  let seqTimer = null;
  let sessionTimer = null;
  let phase = 0;
  let history = JSON.parse(localStorage.getItem("sof_freq_history_v1") || "[]");

  const clamp = (v, min, max) => Math.max(min, Math.min(max, Number(v) || min));

  function log(msg) {
    const el = $("#log");
    if (!el) return;
    const t = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    el.textContent += `\n[${t}] ${msg}`;
    el.scrollTop = el.scrollHeight;
  }

  function gainFromVolume(v) {
    const p = clamp(v, 0, 100) / 100;
    return Math.pow(p, 2) * 0.42;
  }

  function fadeTime() {
    return clamp($("#fadeTime")?.value || 1.25, 0.15, 5);
  }

  function getAudio() {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain();
      master.gain.value = gainFromVolume($("#volume")?.value || 24);
      master.connect(ac.destination);
    }
    return ac;
  }

  function syncUI() {
    activeFreq = clamp(activeFreq, 40, 1800);

    if ($("#freqValue")) $("#freqValue").textContent = Math.round(activeFreq);
    if ($("#freqSlider")) $("#freqSlider").value = Math.round(activeFreq);
    if ($("#freqInput")) $("#freqInput").value = Math.round(activeFreq);
    if ($("#stateText")) $("#stateText").textContent = playing ? "active" : "stopped";
    if ($("#meter")) $("#meter").style.width = `${$("#volume")?.value || 0}%`;

    const h = $("#harmonic")?.selectedOptions?.[0]?.textContent || "Single Tone";
    const b = $("#beatMode")?.selectedOptions?.[0]?.textContent || "None";

    if ($("#settingText")) {
      $("#settingText").textContent =
        `${Math.round(activeFreq)} Hz · ${$("#volume")?.value || 24}% volume · ${h} · ${b} · ${fadeTime().toFixed(2)}s fade`;
    }

    $$(".toneBtn,.libBtn").forEach(btn => {
      btn.classList.toggle("active", Number(btn.dataset.f) === Math.round(activeFreq));
    });

    if (master && ac) {
      master.gain.setTargetAtTime(gainFromVolume($("#volume")?.value || 24), ac.currentTime, 0.05);
    }
  }

  function stopTone(fade = fadeTime()) {
    if (!ac) return;
    const now = ac.currentTime;

    nodes.forEach(n => {
      try {
        n.gain.gain.cancelScheduledValues(now);
        n.gain.gain.setTargetAtTime(0.0001, now, fade / 4);
        n.osc.stop(now + fade + 0.05);
      } catch {}
    });

    nodes = [];
    playing = false;
    syncUI();
  }

  function makeOsc(freq, panValue, gainValue, fade) {
    const ctx = getAudio();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

    osc.type = $("#waveType")?.value || "sine";
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), now + fade);

    if (pan) {
      pan.pan.value = panValue;
      osc.connect(gain).connect(pan).connect(master);
    } else {
      osc.connect(gain).connect(master);
    }

    osc.start(now);
    return { osc, gain };
  }

  function playTone(freq = activeFreq) {
    const ctx = getAudio();
    if (ctx.state === "suspended") ctx.resume();

    const old = nodes.slice();
    nodes = [];

    activeFreq = clamp(freq, 40, 1800);

    const ratios = HARMONICS[$("#harmonic")?.value || "single"] || [1];
    const offset = BEATS[$("#beatMode")?.value || "none"] || 0;
    const fade = fadeTime();
    const channels = offset ? 2 : 1;
    const eachGain = 0.52 / Math.max(1, ratios.length * channels);

    ratios.forEach((r, i) => {
      const base = activeFreq * r;
      if (base < 20 || base > 2200) return;

      if (offset) {
        nodes.push(makeOsc(Math.max(20, base - offset / 2), -0.72, eachGain, fade));
        nodes.push(makeOsc(Math.min(2200, base + offset / 2), 0.72, eachGain, fade));
      } else {
        const pan = ratios.length === 1 ? 0 : -0.55 + (1.1 * i) / Math.max(1, ratios.length - 1);
        nodes.push(makeOsc(base, pan, eachGain, fade));
      }
    });

    old.forEach(n => {
      try {
        n.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, fade / 4);
        n.osc.stop(ctx.currentTime + fade + 0.05);
      } catch {}
    });

    playing = true;
    pushHistory(activeFreq);
    syncUI();
  }

  function smoothChange(freq) {
    activeFreq = clamp(freq, 40, 1800);
    playing ? playTone(activeFreq) : syncUI();
  }

  function pushHistory(freq) {
    history.unshift({
      freq: Math.round(freq),
      time: Date.now(),
      harmonic: $("#harmonic")?.value || "single",
      beat: $("#beatMode")?.value || "none"
    });
    history = history.slice(0, 80);
    localStorage.setItem("sof_freq_history_v1", JSON.stringify(history));
  }

  function renderPresets() {
    const top = [144, 369, 432, 528, 741, 963];

    if ($("#toneList")) {
      $("#toneList").innerHTML = PRESETS
        .filter(p => top.includes(p[0]))
        .map(([f, name, desc]) => `
          <div class="tone">
            <span><strong>${f} Hz</strong><small>${name} / ${desc}</small></span>
            <button class="btn toneBtn" data-f="${f}" type="button">Play</button>
          </div>
        `).join("");
    }

    if ($("#libraryGrid")) {
      $("#libraryGrid").innerHTML = PRESETS.map(([f, name]) => `
        <button class="btn libBtn" data-f="${f}" type="button">${f} Hz<br><small>${name}</small></button>
      `).join("");
    }

    $$(".toneBtn,.libBtn").forEach(btn => {
      on(btn, "click", () => {
        stopSequence();
        smoothChange(Number(btn.dataset.f));
        log(`Carrier selected: ${btn.dataset.f} Hz.`);
      });
    });
  }

  function stopSequence() {
    clearInterval(seqTimer);
    seqTimer = null;
    if ($("#seqStatus")) $("#seqStatus").value = "stopped";
  }

  function runSequence(name) {
    const seq = SEQUENCES[name] || SEQUENCES.remnant;
    const seconds = clamp($("#seqSeconds")?.value || 8, 2, 90);
    let i = 0;

    stopSequence();

    const step = () => {
      const f = seq[i % seq.length];
      smoothChange(f);
      if ($("#seqStatus")) $("#seqStatus").value = `${name} · ${f} Hz · ${(i % seq.length) + 1}/${seq.length}`;
      i++;
    };

    step();
    seqTimer = setInterval(step, seconds * 1000);
    log(`Sequence started: ${name}.`);
  }

  function stopSession() {
    clearInterval(sessionTimer);
    sessionTimer = null;
    if ($("#timerBtn")) $("#timerBtn").textContent = "Start Session";
  }

  function startSession() {
    const mins = clamp($("#sessionMinutes")?.value || 12, 1, 120);
    const end = Date.now() + mins * 60000;

    playTone(activeFreq);
    clearInterval(sessionTimer);

    sessionTimer = setInterval(() => {
      const left = Math.max(0, end - Date.now());
      const m = Math.floor(left / 60000);
      const s = Math.floor((left % 60000) / 1000);

      if ($("#timerBtn")) $("#timerBtn").textContent = `${m}:${String(s).padStart(2, "0")} left`;

      if (left <= 0) {
        stopSession();
        stopSequence();
        stopTone();
        log("Session complete.");
      }
    }, 500);

    log(`Session started: ${mins} minute(s).`);
  }

  function saveSettings() {
    localStorage.setItem("sof_frequency_governance_v4", JSON.stringify({
      freq: activeFreq,
      volume: $("#volume")?.value,
      harmonic: $("#harmonic")?.value,
      wave: $("#waveType")?.value,
      visual: $("#visualPower")?.value,
      beat: $("#beatMode")?.value,
      fade: $("#fadeTime")?.value,
      minutes: $("#sessionMinutes")?.value,
      seconds: $("#seqSeconds")?.value
    }));
    log("Settings saved.");
  }

  function loadSettings() {
    const d = JSON.parse(localStorage.getItem("sof_frequency_governance_v4") || "{}");
    if (!d.freq) return log("No saved settings found.");

    activeFreq = d.freq;
    if ($("#volume")) $("#volume").value = d.volume || 24;
    if ($("#harmonic")) $("#harmonic").value = d.harmonic || "single";
    if ($("#waveType")) $("#waveType").value = d.wave || "sine";
    if ($("#visualPower")) $("#visualPower").value = d.visual || 120;
    if ($("#beatMode")) $("#beatMode").value = d.beat || "none";
    if ($("#fadeTime")) $("#fadeTime").value = d.fade || 1.25;
    if ($("#sessionMinutes")) $("#sessionMinutes").value = d.minutes || 12;
    if ($("#seqSeconds")) $("#seqSeconds").value = d.seconds || 8;

    syncUI();
    log("Settings loaded.");
  }

  function bootEvents() {
    let dragTimer = null;

    on($("#freqSlider"), "input", e => {
      activeFreq = clamp(e.target.value, 40, 1800);
      syncUI();
      clearTimeout(dragTimer);
      dragTimer = setTimeout(() => smoothChange(activeFreq), 90);
    });

    on($("#freqInput"), "change", e => smoothChange(e.target.value));
    on($("#volume"), "input", syncUI);
    on($("#visualPower"), "input", syncUI);
    on($("#fadeTime"), "input", syncUI);

    ["#harmonic", "#waveType", "#beatMode"].forEach(id => {
      on($(id), "change", () => playing ? playTone(activeFreq) : syncUI());
    });

    on($("#playBtn"), "click", () => {
      playTone(activeFreq);
      log(`Playing ${Math.round(activeFreq)} Hz.`);
    });

    on($("#stopBtn"), "click", () => {
      stopSession();
      stopSequence();
      stopTone();
      log("Stopped.");
    });

    on($("#timerBtn"), "click", () => sessionTimer ? (stopSession(), stopTone()) : startSession());
    on($("#saveBtn"), "click", saveSettings);
    on($("#loadBtn"), "click", loadSettings);
    on($("#stopSeq"), "click", () => { stopSequence(); stopTone(); log("Sequence stopped."); });

    $$(".seqBtn").forEach(btn => on(btn, "click", () => runSequence(btn.dataset.seq)));

    on($("#liftPresetBtn"), "click", () => {
      activeFreq = 432;
      if ($("#beatMode")) $("#beatMode").value = "schumann";
      if ($("#harmonic")) $("#harmonic").value = "single";
      if ($("#waveType")) $("#waveType").value = "sine";
      if ($("#volume")) $("#volume").value = 22;
      syncUI();
      playTone(432);
      log("Lift Practice started — 432 Hz + 7.83 Hz pulse.");
    });

    on($("#liftStopBtn"), "click", () => {
      stopSession();
      stopSequence();
      stopTone();
      log("Lift Practice ended.");
    });

    document.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        stopSession();
        stopSequence();
        stopTone(0.25);
        log("Emergency stop.");
      }
    });
  }

  const canvas = $("#field");
  const ctx = canvas?.getContext?.("2d");

  function fitCanvas() {
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(320, rect.width * dpr);
    canvas.height = Math.max(260, rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawField() {
    if (!canvas || !ctx) return;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const cx = w / 2;
    const cy = h / 2;

    visualFreq += (activeFreq - visualFreq) * 0.035;

    const visual = clamp($("#visualPower")?.value || 120, 20, 240) / 100;
    const vol = clamp($("#volume")?.value || 24, 0, 100) / 100;
    const push = playing ? Math.max(0.22, vol * visual) : 0.24 * visual;
    const n = Math.round(280 * visual);
    const fr = (visualFreq % 1000) / 1000;
    const baseR = Math.min(w, h) * (0.24 + 0.08 * Math.sin(phase * 0.025 + fr * 6.28) * push);

    ctx.fillStyle = "rgba(5,7,13,.085)";
    ctx.fillRect(0, 0, w, h);

    const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, Math.min(w, h) * (0.52 + push * 0.22));
    glow.addColorStop(0, `rgba(122,243,255,${0.16 + push * 0.15})`);
    glow.addColorStop(0.42, `rgba(196,163,255,${0.06 + push * 0.08})`);
    glow.addColorStop(0.66, `rgba(243,201,122,${0.08 + push * 0.1})`);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(w, h) * 0.64, 0, Math.PI * 2);
    ctx.fill();

    for (let ring = 0; ring < 4; ring++) {
      ctx.strokeStyle = `rgba(122,243,255,${0.08 + ring * 0.028 + push * 0.04})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, baseR * (0.55 + ring * 0.32), 0, Math.PI * 2);
      ctx.stroke();
    }

    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + phase * 0.008;
      const wobble = Math.sin(i * 0.055 + phase * 0.018 + fr * 9);
      const r = baseR * (0.8 + 0.5 * wobble);
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a * 1.08) * r * 0.68;
      const t = (i % 100) / 100;

      ctx.fillStyle =
        t < 0.34 ? `rgba(122,243,255,${0.42 + push * 0.32})` :
        t < 0.67 ? `rgba(196,163,255,${0.32 + push * 0.25})` :
        `rgba(243,201,122,${0.42 + push * 0.32})`;

      ctx.beginPath();
      ctx.arc(x, y, 1.1 + push * 2.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(w - x, y, 1.1 + push * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(244,241,232,.92)";
    ctx.font = "800 13px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(playing ? `${Math.round(activeFreq)} Hz ACTIVE` : "FREQUENCY FIELD", cx, 25);

    phase += 0.9;
    requestAnimationFrame(drawField);
  }

  fitCanvas();
  on(window, "resize", fitCanvas, { passive: true });

  renderPresets();
  bootEvents();
  syncUI();
  drawField();

  log("Console initialized. Start low volume. Press Escape to stop.");
})();
