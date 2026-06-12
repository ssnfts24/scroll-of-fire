/*
  Scroll of Fire — Frequency Nature Engine v2
  Drop-in file path:
  docs/assets/js/frequency-nature.js
*/

(function () {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  let ctx;
  let master;
  let compressor;
  const beds = new Map();

  function clamp(number, min, max) {
    return Math.max(min, Math.min(max, number));
  }

  function level(value) {
    return clamp(Number(value || 0) / 100, 0, 1);
  }

  function logNature(message) {
    const log = $("#log");
    if (!log) return;
    log.textContent = (log.textContent + "\n" + message).split("\n").slice(-28).join("\n");
    log.scrollTop = log.scrollHeight;
  }

  function ensureAudio() {
    if (ctx) return ctx;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      logNature("Nature engine unavailable: Web Audio not supported.");
      return null;
    }

    ctx = new AudioContext();

    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 18;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.006;
    compressor.release.value = 0.18;

    master = ctx.createGain();
    master.gain.value = level($("#natureMasterVolume")?.value || 20) * 0.55;

    master.connect(compressor);
    compressor.connect(ctx.destination);

    return ctx;
  }

  function resumeAudio() {
    ensureAudio();
    if (ctx && ctx.state === "suspended") ctx.resume();
  }

  function noiseBuffer(seconds = 4) {
    const sampleRate = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, Math.floor(sampleRate * seconds), sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    return buffer;
  }

  function makeNoiseSource(seconds = 4) {
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer(seconds);
    source.loop = true;
    return source;
  }

  function makeBasicNoise(filterType, frequency, q = 0.8) {
    const source = makeNoiseSource(4);
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    gain.gain.value = 0;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();

    return {
      source,
      filter,
      gain,
      extras: [],
      targetGain: 0
    };
  }

  function addLfo(param, frequency, depth, type = "sine") {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.value = depth;

    osc.connect(gain);
    gain.connect(param);
    osc.start();

    return [osc, gain];
  }

  function makeRain() {
    const bed = makeBasicNoise("bandpass", 1300, 0.75);
    bed.extras.push(...addLfo(bed.filter.frequency, 0.11, 180));
    return bed;
  }

  function makeOcean() {
    const bed = makeBasicNoise("lowpass", 680, 0.9);
    const swellGain = ctx.createGain();
    swellGain.gain.value = 0.35;

    bed.gain.disconnect();
    bed.gain.connect(swellGain);
    swellGain.connect(master);

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();

    lfo.frequency.value = 0.045;
    lfoGain.gain.value = 0.34;

    lfo.connect(lfoGain);
    lfoGain.connect(swellGain.gain);
    lfo.start();

    bed.extras.push(lfo, lfoGain, swellGain, ...addLfo(bed.filter.frequency, 0.031, 220));
    return bed;
  }

  function makeWind() {
    const bed = makeBasicNoise("highpass", 460, 0.45);
    bed.extras.push(...addLfo(bed.filter.frequency, 0.075, 360));
    return bed;
  }

  function makeMountain() {
    const bed = makeBasicNoise("bandpass", 420, 0.65);
    bed.extras.push(...addLfo(bed.filter.frequency, 0.038, 240));
    return bed;
  }

  function makeForest() {
    const bed = makeBasicNoise("lowpass", 900, 0.35);
    bed.extras.push(...addLfo(bed.filter.frequency, 0.05, 160));
    return bed;
  }

  function makeStream() {
    const bed = makeBasicNoise("bandpass", 2400, 1.25);
    bed.extras.push(...addLfo(bed.filter.frequency, 0.19, 420));
    return bed;
  }

  function makeSpace() {
    const bed = makeBasicNoise("lowpass", 380, 0.55);

    const drone = ctx.createOscillator();
    const droneGain = ctx.createGain();

    drone.type = "sine";
    drone.frequency.value = 55;
    droneGain.gain.value = 0.0;

    drone.connect(droneGain);
    droneGain.connect(master);
    drone.start();

    bed.spaceDroneGain = droneGain;
    bed.extras.push(drone, droneGain, ...addLfo(bed.filter.frequency, 0.025, 120));

    return bed;
  }

  function makeTrain() {
    const bed = makeBasicNoise("bandpass", 180, 0.9);

    const pulse = ctx.createOscillator();
    const pulseGain = ctx.createGain();
    const modGain = ctx.createGain();

    pulse.type = "square";
    pulse.frequency.value = 2.1;
    pulseGain.gain.value = 0.08;
    modGain.gain.value = 0;

    pulse.connect(pulseGain);
    pulseGain.connect(modGain.gain);

    bed.gain.disconnect();
    bed.gain.connect(modGain);
    modGain.connect(master);

    pulse.start();

    bed.trainModGain = modGain;
    bed.extras.push(pulse, pulseGain, modGain);

    return bed;
  }

  function makeFire() {
    const bed = makeBasicNoise("bandpass", 850, 0.9);

    const crackleGain = ctx.createGain();
    crackleGain.gain.value = 0;
    crackleGain.connect(master);

    const timer = setInterval(() => {
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = Math.random() > 0.5 ? "triangle" : "square";
      osc.frequency.value = 90 + Math.random() * 1100;

      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.018 + Math.random() * 0.045,
        ctx.currentTime + 0.008
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        ctx.currentTime + 0.055 + Math.random() * 0.12
      );

      osc.connect(gain);
      gain.connect(crackleGain);

      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    }, 75 + Math.random() * 110);

    bed.crackleGain = crackleGain;
    bed.extras.push({ stop: () => clearInterval(timer) }, crackleGain);

    return bed;
  }

  function makeNight() {
    const bed = makeBasicNoise("highpass", 1900, 0.8);

    const timer = setInterval(() => {
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.value = 3100 + Math.random() * 1450;

      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.018 + Math.random() * 0.018,
        ctx.currentTime + 0.018
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        ctx.currentTime + 0.075 + Math.random() * 0.06
      );

      osc.connect(gain);
      gain.connect(master);

      osc.start();
      osc.stop(ctx.currentTime + 0.14);
    }, 420 + Math.random() * 900);

    bed.extras.push({ stop: () => clearInterval(timer) });
    return bed;
  }

  function makeBirds() {
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(master);

    const timer = setInterval(() => {
      if (!ctx) return;

      const chirps = 1 + Math.floor(Math.random() * 3);

      for (let i = 0; i < chirps; i++) {
        const osc = ctx.createOscillator();
        const chirpGain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(
          1400 + Math.random() * 1500,
          ctx.currentTime + i * 0.07
        );
        osc.frequency.exponentialRampToValueAtTime(
          2200 + Math.random() * 1800,
          ctx.currentTime + 0.08 + i * 0.07
        );

        chirpGain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.07);
        chirpGain.gain.exponentialRampToValueAtTime(
          0.04,
          ctx.currentTime + 0.02 + i * 0.07
        );
        chirpGain.gain.exponentialRampToValueAtTime(
          0.0001,
          ctx.currentTime + 0.11 + i * 0.07
        );

        osc.connect(chirpGain);
        chirpGain.connect(gain);

        osc.start(ctx.currentTime + i * 0.07);
        osc.stop(ctx.currentTime + 0.16 + i * 0.07);
      }
    }, 850 + Math.random() * 1300);

    return {
      gain,
      extras: [{ stop: () => clearInterval(timer) }],
      targetGain: 0
    };
  }

  function makeFrogs() {
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(master);

    const timer = setInterval(() => {
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const croakGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = "sawtooth";
      osc.frequency.value = 95 + Math.random() * 70;

      filter.type = "lowpass";
      filter.frequency.value = 520 + Math.random() * 320;

      croakGain.gain.setValueAtTime(0.0001, ctx.currentTime);
      croakGain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.05);
      croakGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.32);

      osc.connect(filter);
      filter.connect(croakGain);
      croakGain.connect(gain);

      osc.start();
      osc.stop(ctx.currentTime + 0.36);
    }, 900 + Math.random() * 1600);

    return {
      gain,
      extras: [{ stop: () => clearInterval(timer) }],
      targetGain: 0
    };
  }

  function makeThunder() {
    const bed = makeBasicNoise("lowpass", 115, 1.35);

    const timer = setInterval(() => {
      if (!ctx) return;

      const target = bed.targetGain || 0.18;

      bed.gain.gain.cancelScheduledValues(ctx.currentTime);
      bed.gain.gain.setValueAtTime(
        Math.max(0.001, bed.gain.gain.value),
        ctx.currentTime
      );
      bed.gain.gain.linearRampToValueAtTime(
        Math.min(0.6, target * 2.7 + 0.08),
        ctx.currentTime + 0.18
      );
      bed.gain.gain.exponentialRampToValueAtTime(
        Math.max(0.001, target * 0.22),
        ctx.currentTime + 3.2
      );
    }, 8500 + Math.random() * 9000);

    bed.extras.push({ stop: () => clearInterval(timer) });
    return bed;
  }

  function makeBowl() {
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(master);

    const freqs = [136.1, 216, 432, 528];

    const oscs = freqs.map((freq, index) => {
      const osc = ctx.createOscillator();
      const partialGain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.value = freq;
      partialGain.gain.value = 0.16 / (index + 1);

      osc.connect(partialGain);
      partialGain.connect(gain);
      osc.start();

      return [osc, partialGain];
    });

    return {
      gain,
      extras: oscs.flat(),
      targetGain: 0
    };
  }

  const builders = {
    rain: makeRain,
    ocean: makeOcean,
    wind: makeWind,
    fire: makeFire,
    stream: makeStream,
    forest: makeForest,
    night: makeNight,
    thunder: makeThunder,
    birds: makeBirds,
    frogs: makeFrogs,
    mountain: makeMountain,
    space: makeSpace,
    bowl: makeBowl,
    train: makeTrain
  };

  function getBed(name) {
    resumeAudio();

    if (!ctx || !builders[name]) return null;

    if (!beds.has(name)) {
      beds.set(name, builders[name]());
    }

    return beds.get(name);
  }

  function setLevel(name, value) {
    const bed = getBed(name);
    if (!bed || !ctx) return;

    const amount = level(value);
    const target = amount * 0.45;

    bed.targetGain = target;

    bed.gain.gain.cancelScheduledValues(ctx.currentTime);
    bed.gain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);

    if (bed.crackleGain) {
      bed.crackleGain.gain.cancelScheduledValues(ctx.currentTime);
      bed.crackleGain.gain.setTargetAtTime(target * 0.85, ctx.currentTime, 0.08);
    }

    if (bed.spaceDroneGain) {
      bed.spaceDroneGain.gain.cancelScheduledValues(ctx.currentTime);
      bed.spaceDroneGain.gain.setTargetAtTime(target * 0.35, ctx.currentTime, 0.12);
    }

    if (bed.trainModGain) {
      bed.trainModGain.gain.cancelScheduledValues(ctx.currentTime);
      bed.trainModGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
    }

    if (amount > 0) {
      const label = name.charAt(0).toUpperCase() + name.slice(1);
      logNature(`Nature ${label}: ${Math.round(amount * 100)}%`);
    }
  }

  function setMaster(value) {
    resumeAudio();

    if (!master || !ctx) return;

    master.gain.setTargetAtTime(
      level(value) * 0.55,
      ctx.currentTime,
      0.08
    );
  }

  function clearNature() {
    $$(".nature-level").forEach((slider) => {
      slider.value = 0;
      setLevel(slider.dataset.nature, 0);
    });

    logNature("Nature beds cleared.");
  }

  const presets = {
    forestRain: {
      rain: 22,
      forest: 16,
      stream: 8,
      wind: 4
    },
    oceanWind: {
      ocean: 26,
      wind: 14,
      thunder: 3
    },
    fireNight: {
      fire: 18,
      night: 12,
      wind: 3
    },
    storm: {
      rain: 28,
      wind: 20,
      thunder: 14
    },
    sunrise: {
      birds: 18,
      forest: 12,
      stream: 8
    },
    swamp: {
      frogs: 18,
      night: 10,
      stream: 8,
      forest: 8
    },
    mountainTemple: {
      mountain: 20,
      wind: 12,
      bowl: 9
    },
    spaceBowl: {
      space: 20,
      bowl: 10
    },
    trainDream: {
      train: 16,
      rain: 10,
      space: 8
    },
    clear: {}
  };

  function applyPreset(name) {
    if (name === "clear") {
      clearNature();
      return;
    }

    const preset = presets[name] || {};

    $$(".nature-level").forEach((slider) => {
      const value = preset[slider.dataset.nature] || 0;
      slider.value = value;
      setLevel(slider.dataset.nature, value);
    });

    logNature(`Nature preset loaded: ${name}`);
  }

  function saveNatureState() {
    const state = {};

    $$(".nature-level").forEach((slider) => {
      state[slider.dataset.nature] = Number(slider.value || 0);
    });

    localStorage.setItem("sof:nature:v2", JSON.stringify(state));
  }

  function loadNatureState() {
    try {
      const state = JSON.parse(localStorage.getItem("sof:nature:v2") || "{}");

      $$(".nature-level").forEach((slider) => {
        if (state[slider.dataset.nature] != null) {
          slider.value = state[slider.dataset.nature];
        }
      });
    } catch (error) {
      console.warn("Nature state could not be loaded.", error);
    }
  }

  document.addEventListener("input", (event) => {
    const target = event.target;

    if (target.matches(".nature-level")) {
      setLevel(target.dataset.nature, target.value);
      saveNatureState();
    }

    if (target.id === "natureMasterVolume") {
      setMaster(target.value);
    }
  });

  document.addEventListener("click", (event) => {
    const presetButton = event.target.closest(".nature-preset");

    if (presetButton) {
      applyPreset(presetButton.dataset.preset);
      saveNatureState();
    }

    if (
      event.target.closest("#stopBtn") ||
      event.target.closest("#dockStop")
    ) {
      clearNature();
    }
  });

  loadNatureState();

  window.ScrollOfFireNature = {
    setLevel,
    clearNature,
    applyPreset,
    setMaster
  };
})();
