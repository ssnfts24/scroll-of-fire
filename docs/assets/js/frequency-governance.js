/* =====================================================
   Scroll of Fire
   Frequency Governance v3
   Living Sound Observatory

   PART 1
   Core Foundation
===================================================== */

(() => {

"use strict";

/* =====================================================
   HELPERS
===================================================== */

const $ = (s, r = document) =>
  r.querySelector(s);

const $$ = (s, r = document) =>
  [...r.querySelectorAll(s)];

const clamp = (v, min, max) =>
  Math.max(min, Math.min(max, Number(v) || min));

const lerp = (a, b, t) =>
  a + (b - a) * t;

const nowStamp = () =>
  new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });

function setText(el, value) {
  if (el) el.textContent = value;
}

/* =====================================================
   STORAGE
===================================================== */

const STORE = {

  field:
    "sof_fg_field_v3",

  journal:
    "sof_fg_journal_v3",

  track:
    "sof_fg_track_v3"

};

function saveStore(key, value) {

  try {

    localStorage.setItem(
      key,
      JSON.stringify(value)
    );

  } catch (err) {

    console.warn(err);

  }

}

function loadStore(key, fallback) {

  try {

    const data =
      localStorage.getItem(key);

    return data
      ? JSON.parse(data)
      : fallback;

  } catch {

    return fallback;

  }

}

/* =====================================================
   APPLICATION STATE
===================================================== */

const STATE = {

  running: false,

  activePath: "Foundation",

  selectedDeck: 0,

  visualMode: "torus",

  visualPower: 130,

  masterVolume: 0.24,

  sequence: null,

  recording: false,

  trackEvents: [],

  sessionStart: 0,

  visualSeed:
    Math.random() * 9999,

  pointer: {

    x: 0.5,
    y: 0.5,
    active: false

  }

};

/* =====================================================
   FREQUENCY LIBRARY
===================================================== */

const LIBRARY = [

  {
    freq: 111,
    name: "Body Ground",
    category: "Grounding"
  },

  {
    freq: 174,
    name: "Soft Release",
    category: "Grounding"
  },

  {
    freq: 285,
    name: "Restore",
    category: "Grounding"
  },

  {
    freq: 396,
    name: "Unburden",
    category: "Grounding"
  },

  {
    freq: 432,
    name: "Foundation",
    category: "Core"
  },

  {
    freq: 528,
    name: "Connection",
    category: "Core"
  },

  {
    freq: 639,
    name: "Bridge",
    category: "Core"
  },

  {
    freq: 741,
    name: "Clarity",
    category: "Core"
  },

  {
    freq: 963,
    name: "Ascent",
    category: "Symbolic"
  },

  {
    freq: 1111,
    name: "Mirror",
    category: "Symbolic"
  },

  {
    freq: 1728,
    name: "Cube Harmonic",
    category: "Symbolic"
  }

];

/* =====================================================
   PATHS
===================================================== */

const PATHS = {

  calm: {

    label:
      "Calm Path",

    visual:
      "torus",

    decks: [

      {
        freq: 432,
        volume: 80
      },

      {
        freq: 396,
        volume: 35
      }

    ]

  },

  focus: {

    label:
      "Focus Path",

    visual:
      "lattice",

    decks: [

      {
        freq: 144,
        volume: 70
      },

      {
        freq: 369,
        volume: 45
      }

    ]

  },

  clarity: {

    label:
      "Clarity Path",

    visual:
      "rose",

    decks: [

      {
        freq: 432,
        volume: 60
      },

      {
        freq: 741,
        volume: 55
      }

    ]

  },

  remnant: {

    label:
      "Remnant Path",

    visual:
      "tree",

    decks: [

      {
        freq: 144,
        volume: 55
      },

      {
        freq: 432,
        volume: 70
      }

    ]

  }

};

/* =====================================================
   AUDIO ENGINE
===================================================== */

const AUDIO = {

  ctx: null,

  master: null,

  decks: []

};

function createAudio() {

  if (AUDIO.ctx)
    return AUDIO.ctx;

  AUDIO.ctx =
    new (
      window.AudioContext ||
      window.webkitAudioContext
    )();

  AUDIO.master =
    AUDIO.ctx.createGain();

  AUDIO.master.gain.value =
    0.18;

  AUDIO.master.connect(
    AUDIO.ctx.destination
  );

  return AUDIO.ctx;

}

/* =====================================================
   DECK ENGINE
===================================================== */

function buildDeck() {

  const ctx =
    createAudio();

  const osc =
    ctx.createOscillator();

  const gain =
    ctx.createGain();

  const pan =
    ctx.createStereoPanner();

  osc.type =
    "sine";

  gain.gain.value =
    0;

  osc.connect(gain);
  gain.connect(pan);
  pan.connect(AUDIO.master);

  osc.start();

  return {

    osc,
    gain,
    pan

  };

}

function ensureDecks() {

  while (
    AUDIO.decks.length < 4
  ) {

    AUDIO.decks.push(
      buildDeck()
    );

  }

}

/* =====================================================
   LOGGING
===================================================== */

function log(msg) {

  const el =
    $("#log");

  if (!el)
    return;

  el.textContent +=
    `\n[${nowStamp()}] ${msg}`;

  el.scrollTop =
    el.scrollHeight;

}

/* =====================================================
   UI UPDATE
===================================================== */

function updateStatus() {

  setText(
    $("#statPath"),
    STATE.activePath
  );

  setText(
    $("#statState"),
    STATE.running
      ? "Active"
      : "Stopped"
  );

  setText(
    $("#stateText"),
    STATE.running
      ? "active"
      : "stopped"
  );

}

/* =====================================================
   FREQUENCY LIBRARY UI
===================================================== */

function renderLibrary() {

  const grid =
    $("#libraryGrid");

  if (!grid)
    return;

  grid.innerHTML =
    LIBRARY.map(item => `

      <button
        class="fg-btn lib-btn"
        data-freq="${item.freq}">

        <strong>
          ${item.freq} Hz
        </strong>

        <small>
          ${item.name}
        </small>

      </button>

    `).join("");

}

/* =====================================================
   BOOT
===================================================== */

function boot() {

  renderLibrary();

  updateStatus();

  setText(
    $("#yr"),
    new Date().getFullYear()
  );

  log(
    "Frequency Governance initialized."
  );

}

document.addEventListener(
  "DOMContentLoaded",
  boot
);

})();





/* =====================================================
   PART 2
   MIXER + PATH ENGINE
===================================================== */

const HARMONICS = {

  single:[1],

  octave:[1,2],

  fifth:[1,1.5],

  triad:[1,1.25,1.5],

  field:[0.5,1,1.5,2]

};

const DECK_STATE = [

  {
    freq:432,
    volume:80,
    pan:0,
    wave:"sine",
    harmonic:"single",
    mute:false,
    solo:false
  },

  {
    freq:528,
    volume:40,
    pan:0,
    wave:"sine",
    harmonic:"single",
    mute:false,
    solo:false
  },

  {
    freq:741,
    volume:0,
    pan:0,
    wave:"sine",
    harmonic:"single",
    mute:false,
    solo:false
  },

  {
    freq:963,
    volume:0,
    pan:0,
    wave:"sine",
    harmonic:"single",
    mute:false,
    solo:false
  }

];

/* =====================================================
   DECK UPDATES
===================================================== */

function updateMasterGain() {

  if (!AUDIO.master)
    return;

  AUDIO.master.gain.value =
    Math.pow(
      STATE.masterVolume,
      2
    ) * 0.45;

}

function updateDeck(index) {

  ensureDecks();

  const deck =
    DECK_STATE[index];

  const node =
    AUDIO.decks[index];

  if (!deck || !node)
    return;

  node.osc.type =
    deck.wave;

  node.osc.frequency.value =
    deck.freq;

  node.pan.pan.value =
    deck.pan;

  let gain =
    deck.volume / 100;

  gain =
    Math.pow(gain,2);

  if (deck.mute)
    gain = 0;

  node.gain.gain.setTargetAtTime(

    gain * 0.35,

    AUDIO.ctx.currentTime,

    0.05

  );

}

function refreshMixer() {

  DECK_STATE.forEach(
    (_,i)=>updateDeck(i)
  );

  updateMasterGain();

}

/* =====================================================
   START / STOP
===================================================== */

function startField() {

  createAudio();

  ensureDecks();

  refreshMixer();

  STATE.running = true;

  updateStatus();

  log(
    "Field activated."
  );

}

function stopField() {

  ensureDecks();

  AUDIO.decks.forEach(deck=>{

    deck.gain.gain.setTargetAtTime(

      0,

      AUDIO.ctx.currentTime,

      0.15

    );

  });

  STATE.running = false;

  updateStatus();

  log(
    "Field stopped."
  );

}

/* =====================================================
   PATH LOADING
===================================================== */

function loadPath(name) {

  const path =
    PATHS[name];

  if (!path)
    return;

  STATE.activePath =
    path.label;

  STATE.visualMode =
    path.visual;

  path.decks.forEach(
    (d,index)=>{

      if (!DECK_STATE[index])
        return;

      Object.assign(
        DECK_STATE[index],
        d
      );

    }
  );

  refreshMixer();

  updateStatus();

  log(
    `Path loaded: ${path.label}`
  );

}

/* =====================================================
   T7 CHAMBER
===================================================== */

function loadT7Field() {

  DECK_STATE[0] = {

    freq:111,
    volume:35,
    pan:-0.25,
    wave:"sine",
    harmonic:"single"

  };

  DECK_STATE[1] = {

    freq:432,
    volume:80,
    pan:0,
    wave:"sine",
    harmonic:"single"

  };

  DECK_STATE[2] = {

    freq:528,
    volume:42,
    pan:0.20,
    wave:"sine",
    harmonic:"fifth"

  };

  DECK_STATE[3] = {

    freq:963,
    volume:20,
    pan:0.35,
    wave:"sine",
    harmonic:"octave"

  };

  STATE.activePath =
    "T7 Field";

  refreshMixer();

  log(
    "T7 Resonant Field loaded."
  );

}

/* =====================================================
   YHWH CHAMBER
===================================================== */

function loadYHWHField() {

  DECK_STATE[0] = {

    freq:72,
    volume:35,
    pan:-0.35

  };

  DECK_STATE[1] = {

    freq:144,
    volume:40,
    pan:-0.15

  };

  DECK_STATE[2] = {

    freq:432,
    volume:75,
    pan:0.15

  };

  DECK_STATE[3] = {

    freq:639,
    volume:35,
    pan:0.35

  };

  STATE.activePath =
    "𐤉𐤄𐤅𐤄";

  refreshMixer();

  log(
    "YHWH chamber loaded."
  );

}

/* =====================================================
   SEQUENCE ENGINE
===================================================== */

let sequenceTimer = null;

function stopSequence() {

  clearInterval(
    sequenceTimer
  );

  sequenceTimer = null;

  log(
    "Sequence stopped."
  );

}

function runSequence(list,seconds=8) {

  stopSequence();

  let step = 0;

  function advance() {

    const freq =
      list[
        step % list.length
      ];

    DECK_STATE[0].freq =
      freq;

    updateDeck(0);

    log(
      `Sequence: ${freq} Hz`
    );

    step++;

  }

  advance();

  sequenceTimer =
    setInterval(

      advance,

      seconds * 1000

    );

}

/* =====================================================
   PRESET SEQUENCES
===================================================== */

const SEQUENCES = {

  calm:[
    432,
    396,
    417,
    432
  ],

  focus:[
    144,
    369,
    432,
    528,
    741
  ],

  restore:[
    285,
    396,
    432,
    528,
    639
  ],

  ascent:[
    144,
    288,
    432,
    528,
    741,
    963
  ],

  remnant:[
    144,
    432,
    528,
    741,
    432
  ]

};

/* =====================================================
   LIFT LOOP
===================================================== */

let liftTimer = null;

function startLiftLoop() {

  stopLiftLoop();

  const sequence = [

    111,
    144,
    222,
    333,
    432,
    528,
    741

  ];

  let position = 0;

  function step() {

    DECK_STATE[0].freq =
      sequence[position];

    updateDeck(0);

    const dot =
      position + 1;

    for(
      let i=1;
      i<=7;
      i++
    ){

      const el =
        document.getElementById(
          `liftStep${i}`
        );

      if(el){

        el.classList.toggle(
          "active",
          i===dot
        );

      }

    }

    position++;

    if(
      position >= sequence.length
    ){

      position = 0;

    }

  }

  step();

  liftTimer =
    setInterval(
      step,
      30000
    );

  log(
    "Lift Loop started."
  );

}

function stopLiftLoop() {

  clearInterval(
    liftTimer
  );

  liftTimer = null;

}

/* =====================================================
   TRACK RECORDER
===================================================== */

function trackEvent(type,data={}) {

  if(
    !STATE.recording
  ) return;

  STATE.trackEvents.push({

    t:
      Math.round(
        performance.now() -
        STATE.sessionStart
      ),

    type,

    data

  });

}

function startRecording() {

  STATE.trackEvents = [];

  STATE.recording = true;

  STATE.sessionStart =
    performance.now();

  log(
    "Recording started."
  );

}

function stopRecording() {

  STATE.recording = false;

  log(
    "Recording stopped."
  );

}

/* =====================================================
   TRACK SAVE / LOAD
===================================================== */

function saveTrack() {

  saveStore(

    STORE.track,

    STATE.trackEvents

  );

  log(
    "Track saved."
  );

}

function loadTrack() {

  STATE.trackEvents =

    loadStore(
      STORE.track,
      []
    );

  log(
    "Track loaded."
  );

}

/* =====================================================
   EVENT WIRING
===================================================== */

function bindMixerEvents() {

  $("#playBtn")
    ?.addEventListener(
      "click",
      startField
    );

  $("#stopBtn")
    ?.addEventListener(
      "click",
      stopField
    );

  $("#startT7")
    ?.addEventListener(
      "click",
      loadT7Field
    );

  $("#startYHWH")
    ?.addEventListener(
      "click",
      loadYHWHField
    );

  $("#recordTrack")
    ?.addEventListener(
      "click",
      startRecording
    );

  $("#stopRecord")
    ?.addEventListener(
      "click",
      stopRecording
    );

}





/* =====================================================
   PART 3
   VISUAL FIELD ENGINE
===================================================== */

const CANVAS =
  document.getElementById(
    "fieldCanvas"
  );

const CTX =
  CANVAS?.getContext("2d");

let visualPhase = 0;

function fitCanvas() {

  if(!CANVAS)
    return;

  const rect =
    CANVAS.getBoundingClientRect();

  const dpr =
    Math.min(
      window.devicePixelRatio || 1,
      2
    );

  CANVAS.width =
    rect.width * dpr;

  CANVAS.height =
    rect.height * dpr;

  CTX.setTransform(
    dpr,0,0,dpr,0,0
  );

}

function leadFrequency() {

  return (
    DECK_STATE[0]?.freq ||
    432
  );

}

function glowColor() {

  const freq =
    leadFrequency();

  if(freq < 300)
    return "#7af3ff";

  if(freq < 700)
    return "#f3c97a";

  return "#c4a3ff";

}

/* =====================================================
   TORUS FIELD
===================================================== */

function drawTorus() {

  const w =
    CANVAS.clientWidth;

  const h =
    CANVAS.clientHeight;

  const cx = w/2;
  const cy = h/2;

  const freq =
    leadFrequency();

  const radius =
    Math.min(w,h) *
    (
      0.22 +
      ((freq % 1000)/1000)*0.12
    );

  for(
    let i=0;
    i<260;
    i++
  ){

    const a =
      (i/260) *
      Math.PI*2 +
      visualPhase;

    const r =
      radius *
      (
        1 +
        0.35 *
        Math.sin(
          a*3 +
          visualPhase
        )
      );

    const x =
      cx +
      Math.cos(a)*r;

    const y =
      cy +
      Math.sin(a)*r*0.65;

    CTX.fillStyle =
      glowColor();

    CTX.globalAlpha =
      0.45;

    CTX.beginPath();

    CTX.arc(
      x,
      y,
      2,
      0,
      Math.PI*2
    );

    CTX.fill();

  }

}

/* =====================================================
   ROSE FIELD
===================================================== */

function drawRose() {

  const w =
    CANVAS.clientWidth;

  const h =
    CANVAS.clientHeight;

  const cx=w/2;
  const cy=h/2;

  const radius =
    Math.min(w,h)*0.3;

  CTX.beginPath();

  for(
    let i=0;
    i<1000;
    i++
  ){

    const t =
      i/100 *
      Math.PI;

    const r =
      radius *
      Math.cos(4*t);

    const x =
      cx +
      r*Math.cos(t);

    const y =
      cy +
      r*Math.sin(t);

    if(i===0)
      CTX.moveTo(x,y);
    else
      CTX.lineTo(x,y);

  }

  CTX.strokeStyle =
    glowColor();

  CTX.lineWidth = 2;

  CTX.stroke();

}

/* =====================================================
   METATRON FIELD
===================================================== */

function drawMetatron() {

  const w =
    CANVAS.clientWidth;

  const h =
    CANVAS.clientHeight;

  const cx=w/2;
  const cy=h/2;

  const r =
    Math.min(w,h)*0.18;

  const points=[];

  for(
    let i=0;
    i<12;
    i++
  ){

    const a =
      (i/12)*
      Math.PI*2;

    points.push({

      x:
        cx+
        Math.cos(a)*r*2,

      y:
        cy+
        Math.sin(a)*r*2

    });

  }

  points.push({
    x:cx,
    y:cy
  });

  CTX.strokeStyle =
    glowColor();

  CTX.globalAlpha = 0.28;

  points.forEach(p1=>{

    points.forEach(p2=>{

      CTX.beginPath();

      CTX.moveTo(
        p1.x,
        p1.y
      );

      CTX.lineTo(
        p2.x,
        p2.y
      );

      CTX.stroke();

    });

  });

}

/* =====================================================
   TREE OF LIFE
===================================================== */

function drawTree() {

  const w =
    CANVAS.clientWidth;

  const h =
    CANVAS.clientHeight;

  const cx=w/2;
  const cy=h/2;

  const nodes = [

    [0,-220],
    [0,-140],
    [-90,-60],
    [90,-60],
    [0,0],
    [-90,90],
    [90,90],
    [0,170],
    [0,260]

  ];

  CTX.strokeStyle =
    glowColor();

  CTX.lineWidth = 2;

  nodes.forEach(
    ([x,y])=>{

      CTX.beginPath();

      CTX.arc(
        cx+x,
        cy+y,
        18,
        0,
        Math.PI*2
      );

      CTX.stroke();

    }
  );

}

/* =====================================================
   CYMATICS FIELD
===================================================== */

function drawCymatics() {

  const w =
    CANVAS.clientWidth;

  const h =
    CANVAS.clientHeight;

  const freq =
    leadFrequency();

  const step =
    Math.max(
      6,
      18 -
      (freq/100)
    );

  for(
    let y=0;
    y<h;
    y+=step
  ){

    for(
      let x=0;
      x<w;
      x+=step
    ){

      const value =

        Math.sin(
          x*0.02
        ) *

        Math.sin(
          y*0.02
        );

      if(
        Math.abs(value)
        < 0.15
      ){

        CTX.fillStyle =
          glowColor();

        CTX.fillRect(
          x,
          y,
          2,
          2
        );

      }

    }

  }

}

/* =====================================================
   VISUAL ROUTER
===================================================== */

function drawField() {

  if(
    !CANVAS ||
    !CTX
  ) return;

  CTX.clearRect(

    0,
    0,
    CANVAS.width,
    CANVAS.height

  );

  const mode =
    STATE.visualMode;

  switch(mode){

    case "rose":
      drawRose();
      break;

    case "metatron":
      drawMetatron();
      break;

    case "tree":
      drawTree();
      break;

    case "cymatics":
      drawCymatics();
      break;

    default:
      drawTorus();

  }

  visualPhase += 0.01;

  requestAnimationFrame(
    drawField
  );

}

/* =====================================================
   JOURNAL SYSTEM
===================================================== */

function saveJournal() {

  const archive =
    loadStore(
      STORE.journal,
      []
    );

  archive.unshift({

    date:
      new Date()
      .toLocaleString(),

    path:
      STATE.activePath,

    intention:
      $("#journalIntention")
      ?.value || "",

    body:
      $("#journalBody")
      ?.value || "",

    note:
      $("#journalNote")
      ?.value || ""

  });

  saveStore(
    STORE.journal,
    archive
  );

  renderJournal();

  log(
    "Witness saved."
  );

}

function renderJournal() {

  const container =
    $("#journalList");

  if(!container)
    return;

  const archive =
    loadStore(
      STORE.journal,
      []
    );

  container.innerHTML =
    archive.map(item=>`

      <article class="journal-entry">

        <strong>
          ${item.date}
        </strong>

        <p>
          ${item.path}
        </p>

      </article>

    `).join("");

}

/* =====================================================
   FIELD SAVE / LOAD
===================================================== */

function saveField() {

  saveStore(

    STORE.field,

    {

      decks:
        DECK_STATE,

      path:
        STATE.activePath,

      visual:
        STATE.visualMode

    }

  );

  log(
    "Field saved."
  );

}

function loadField() {

  const data =
    loadStore(
      STORE.field,
      null
    );

  if(!data)
    return;

  data.decks.forEach(
    (deck,index)=>{

      Object.assign(

        DECK_STATE[index],

        deck

      );

    }
  );

  STATE.activePath =
    data.path;

  STATE.visualMode =
    data.visual;

  refreshMixer();

  log(
    "Field loaded."
  );

}

/* =====================================================
   EXPORT PNG
===================================================== */

function savePNG() {

  const a =
    document.createElement("a");

  a.href =
    CANVAS.toDataURL(
      "image/png"
    );

  a.download =
    "frequency-field.png";

  a.click();

}

/* =====================================================
   MOBILE DOCK
===================================================== */

function bindMobileDock() {

  $("#dockPlay")
    ?.addEventListener(
      "click",
      startField
    );

  $("#dockStop")
    ?.addEventListener(
      "click",
      stopField
    );

  $("#dockRecord")
    ?.addEventListener(
      "click",
      ()=>{

        STATE.recording
          ? stopRecording()
          : startRecording();

      }
    );

  $("#dockLift")
    ?.addEventListener(
      "click",
      startLiftLoop
    );

}

/* =====================================================
   FINAL BINDINGS
===================================================== */

function bindPart3() {

  $("#saveJournal")
    ?.addEventListener(
      "click",
      saveJournal
    );

  $("#savePreset")
    ?.addEventListener(
      "click",
      saveField
    );

  $("#loadPreset")
    ?.addEventListener(
      "click",
      loadField
    );

  $("#saveFieldPng")
    ?.addEventListener(
      "click",
      savePNG
    );

}

/* =====================================================
   BOOT
===================================================== */

function bootFrequencyGovernance() {

  fitCanvas();

  bindMixerEvents();

  bindPart3();

  bindMobileDock();

  renderJournal();

  updateStatus();

  drawField();

  log(
    "Frequency Governance initialized."
  );

}

window.addEventListener(

  "resize",

  fitCanvas,

  {passive:true}

);

bootFrequencyGovernance();

/* =====================================================
   END OF FILE
===================================================== */

})();
