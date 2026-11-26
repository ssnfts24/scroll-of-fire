/*! Heavenly Ambience v1.3 — the Sound of the Day
    - Procedural pads + chimes, no audio files
    - Page-aware "scenes", opt-in, respectful
    - The day's chimes are seeded by the canonical Pattern Day (the same
      engine that tells the day everywhere else on the site), so a given
      day sounds the same on every visit and every device, and a new day
      sounds new. Seeding touches presentation only — never a fact.
    - The site's master sound switch (sof.spark.sound) silences this too:
      when the keeper has turned sound off, the Sound of the Day stays off.
    - Scales: Ahava Rabbah (Freygish), Hijaz, Minor Pentatonic, Dorian
*/
(function(){
  "use strict";

  // Respect user preferences
  const PREFERS_OFF = matchMedia("(prefers-reduced-motion: reduce)").matches ||
                      matchMedia("(prefers-reduced-data: reduce)").matches;

  // Scene selection (per page). You can tweak/expand.
  // Each scene: root Hz, scale, drone mix, chime density, reverb length, filter
  const SCENES = {
    home:   { root: 174, scale:"freygish", density:0.12, drone:[0, 7, -5],   rev:2.8, lp:1600 },
    moons:  { root: 222, scale:"hijaz",    density:0.10, drone:[0, 12],      rev:3.2, lp:1800 },
    theory: { root: 196, scale:"dorian",   density:0.08, drone:[0, -7, 5],   rev:2.4, lp:1400 },
    teach:  { root: 210, scale:"pentatonic",density:0.06,drone:[0, 12],      rev:2.0, lp:1200 },
    codex:  { root: 205, scale:"freygish", density:0.07, drone:[0, 7],       rev:2.6, lp:1500 }
  };

  // Pick scene by body data attribute, path, or fallback
  function resolveScene(){
    const data = document.body?.dataset?.heaven;
    if (data && SCENES[data]) return SCENES[data];
    const p = (location.pathname || "").toLowerCase();
    if (p.includes("moons")) return SCENES.moons;
    if (p.includes("theory")) return SCENES.theory;
    if (p.includes("teach"))  return SCENES.teach;
    if (p.includes("codex")||p.includes("index")) return SCENES.codex;
    return SCENES.home;
  }

  // Scales (semitone intervals from root)
  const SCALES = {
    // Ahava Rabbah (Freygish): 0,1,4,5,7,8,11 (eastern/Jewish prayer mode)
    freygish:   [0, 1, 4, 5, 7, 8, 11],
    hijaz:      [0, 1, 5, 7, 8, 11],
    dorian:     [0, 2, 3, 5, 7, 9, 10],
    pentatonic: [0, 3, 5, 7, 10]
  };

  // Utilities
  const rnd = (a,b)=>a + Math.random()*(b-a);
  const choice = arr => arr[(Math.random()*arr.length)|0];
  const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));

  /* ---- the day's seed ------------------------------------------------
   * One seed per Pattern Day, from the canonical calendar engine when
   * the page carries it (the main house does), else from the civil
   * date. mulberry32 keeps the sequence identical everywhere. */
  function mulberry32(seed){
    let a = seed >>> 0;
    return function(){
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function todayCoordinate(){
    try {
      const cal = window.PatternCalendar;
      if (cal && typeof cal.fromCivilDate === "function"){
        const s = cal.fromCivilDate({ date: new Date(), boundaryMode: "midnight" });
        if (s && typeof s.dayOfPatternYear === "number"){
          return { patternYear: s.patternYear || 0, patternDay: s.dayOfPatternYear, moon: s.moon || null, source: "pattern" };
        }
      }
    } catch(_){ /* fall through to the civil date */ }
    const d = new Date();
    return { patternYear: d.getFullYear(), patternDay: d.getFullYear()*10000 + (d.getMonth()+1)*100 + d.getDate(), moon: null, source: "civil" };
  }

  function seedForDay(coord){
    const c = coord || todayCoordinate();
    return ((c.patternYear * 1000) + c.patternDay) >>> 0;
  }

  // The day's chime picker: a fresh picker replays the same sequence.
  function makeChimePicker(pool){
    const rng = mulberry32(seedForDay());
    return ()=> pool[Math.floor(rng() * pool.length)];
  }

  // The site's master sound switch — the Spark's mute silences the place too.
  function masterSoundOff(){
    try { return localStorage.getItem("sof.spark.sound") === "off"; } catch(_){ return false; }
  }
  const now = ()=> (audio?.currentTime||0);
  const store = {
    get(k, d){ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch(_){ return d; } },
    set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(_){ } }
  };

  let audio=null, master=null, reverb=null, lpFilter=null;
  let playing=false, scene=resolveScene(), vol = store.get("sof.heaven.vol", 0.18);

  function makeAudio(){
    audio = new (window.AudioContext||window.webkitAudioContext)({latencyHint:"interactive"});
    master = audio.createGain(); master.gain.value = 0.0001; // fade in
    lpFilter = audio.createBiquadFilter(); lpFilter.type="lowpass"; lpFilter.frequency.value = scene.lp || 1600;
    reverb = makeConvolver(scene.rev||2.4);

    master.connect(lpFilter);
    lpFilter.connect(reverb);
    reverb.connect(audio.destination);

    // Fade up gently
    ramp(master.gain, 0.0001, vol, 4.0);
  }

  function ramp(param, from, to, t=0.5){
    const t0 = now(); param.setValueAtTime(from, t0);
    param.exponentialRampToValueAtTime(clamp(to, 0.0001, 1), t0 + t);
  }

  // Quick exponential-decay noise IR (tiny)
  function makeConvolver(seconds=2.8){
    const rate = 44100, len = rate*seconds|0;
    const buf = (audio||{createBuffer:()=>null}).createBuffer(2,len,rate);
    for(let ch=0; ch<2; ch++){
      const d = buf.getChannelData(ch);
      for (let i=0;i<len;i++){
        const x = Math.random()*2-1;
        // soft band-limited-ish impulse
        d[i] = (x + 0.7*(Math.random()*2-1))*Math.pow(1 - i/len, 1.9);
      }
    }
    const con = audio.createConvolver(); con.buffer = buf; return con;
  }

  // Hz helpers
  const SEMI = Math.pow(2, 1/12);
  const hz = (root, semis)=> root * Math.pow(SEMI, semis);
  function scalePool(rootHz, scaleName){
    const iv = SCALES[scaleName] || SCALES.freygish;
    // Spread across a few octaves centered near the root
    const pool = [];
    for (let oct=-2; oct<=2; oct++){
      for (const s of iv) pool.push(hz(rootHz, s + 12*oct));
    }
    return pool.sort((a,b)=>a-b);
  }

  // Voice builders
  function makeDroneVoice(freq, gain=0.15){
    const o = audio.createOscillator(); o.type="sine"; o.frequency.value=freq;
    const g = audio.createGain(); g.gain.value=0.0001;
    const lfo = audio.createOscillator(); lfo.type="sine"; lfo.frequency.value=rnd(0.03, 0.09);
    const lGain = audio.createGain(); lGain.gain.value=rnd(0.01, 0.03);
    lfo.connect(lGain); lGain.connect(g.gain);
    o.connect(g); g.connect(master);
    o.start(); lfo.start();
    ramp(g.gain, 0.0001, gain, 6.0);
    return {stop: (t=3)=>{ const t1=now()+t; g.gain.exponentialRampToValueAtTime(0.0001, t1); setTimeout(()=>{o.stop();lfo.stop();}, t*1000+50); }};
  }

  function chimeOnce(freq, dur=2.2){
    const o=audio.createOscillator(); o.type="sine"; o.frequency.setValueAtTime(freq, now());
    const g=audio.createGain(); g.gain.value=0.0001;
    const a=audio.createBiquadFilter(); a.type="bandpass"; a.Q.value=8; a.frequency.value=freq;
    o.connect(a); a.connect(g); g.connect(master);
    o.start();
    // ADSR: quick in, gentle out
    const t0=now();
    g.gain.linearRampToValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.3*vol, t0+0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
    // tiny random bend for “alive” feel
    o.frequency.exponentialRampToValueAtTime(freq*rnd(0.998,1.002), t0+0.4);
    setTimeout(()=>o.stop(), dur*1000+60);
  }

  // Scheduler
  let schedulerId=null, drones=[];
  function startScene(){
    if (PREFERS_OFF) return;
    if (!audio) makeAudio();
    audio.resume?.();

    // Drones
    const pool = scalePool(scene.root, scene.scale);
    drones = (scene.drone||[0]).map(semi=>{
      const f = hz(scene.root, semi);
      return makeDroneVoice(f, 0.08 + Math.abs(semi)*0.004);
    });

    // Chimes loop — pitches come from the day's seeded picker, so the
    // day has a melody-shape of its own; only the spacing breathes free.
    const pickChime = makeChimePicker(pool);
    function loop(){
      const p = Math.random();
      if (p < scene.density){ chimeOnce(pickChime(), rnd(1.8, 3.2)); }
      schedulerId = setTimeout(loop, rnd(900, 2400)); // gentle spacing
    }
    loop();

    // On blur, duck. On focus, return.
    window.addEventListener("blur", duck, {passive:true});
    window.addEventListener("focus", unduck, {passive:true});
  }

  function stopScene(){
    if (schedulerId){ clearTimeout(schedulerId); schedulerId=null; }
    drones.forEach(d=>d.stop?.(1.5)); drones=[];
    if (master) ramp(master.gain, master.gain.value, 0.0001, 0.8);
    window.removeEventListener("blur", duck);
    window.removeEventListener("focus", unduck);
  }

  function duck(){ if(master) ramp(master.gain, master.gain.value, 0.0006, 0.4); }
  function unduck(){ if(master) ramp(master.gain, master.gain.value, vol, 0.8); }

  // Public toggle
  function setEnabled(on){
    if (on && masterSoundOff()){
      // The master switch is off: the place stays silent, and the
      // toggle says so instead of pretending to play.
      playing = false;
      const btn0 = document.getElementById("heavenToggle");
      if (btn0) btn0.setAttribute("aria-pressed", "false");
      store.set("sof.heaven.enabled", false);
      return;
    }
    playing = !!on;
    const btn = document.getElementById("heavenToggle");
    if (btn) btn.setAttribute("aria-pressed", playing ? "true" : "false");
    store.set("sof.heaven.enabled", playing);
    if (playing) startScene(); else stopScene();
  }

  // Volume via wheel on the button (nice to have)
  function bindUI(){
    const btn = document.getElementById("heavenToggle");
    if (!btn) return;

    btn.addEventListener("click", ()=>{
      if (!playing && (audio?.state==="suspended")) audio.resume();
      setEnabled(!playing);
    }, {passive:true});

    btn.addEventListener("wheel", e=>{
      e.preventDefault();
      vol = clamp(vol + (e.deltaY>0 ? -0.02 : 0.02), 0.04, 0.35);
      store.set("sof.heaven.vol", vol);
      if (master) master.gain.setTargetAtTime(vol, now(), 0.25);
      btn.title = `Volume ${(vol*100|0)}% (scroll to adjust)`;
    }, {passive:false});

    // Keyboard quick-mute (M) — never while typing, never with modifiers.
    document.addEventListener("keydown", e=>{
      const t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ""))) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.toLowerCase()==="m"){ setEnabled(!playing); }
    });
  }

  // The toggle: a page may provide #heavenToggle; where none does, the
  // module builds its own quiet pill at the bottom-left (the Spark's
  // ember owns the bottom-right).
  function ensureToggle(){
    if (document.getElementById("heavenToggle")) return;
    if (!document.getElementById("heaven-toggle-style")){
      const st = document.createElement("style");
      st.id = "heaven-toggle-style";
      st.textContent =
        ".heaven-toggle{position:fixed;left:max(12px,env(safe-area-inset-left));bottom:max(12px,env(safe-area-inset-bottom));z-index:9000;" +
        "font:inherit;font-size:.82rem;letter-spacing:.02em;padding:.5rem .8rem;border-radius:999px;cursor:pointer;" +
        "color:var(--sof-ink,#e8e2d4);background:var(--sof-panel,rgba(16,20,32,.82));border:1px solid var(--sof-line,rgba(201,168,106,.45));" +
        "backdrop-filter:blur(6px);}" +
        ".heaven-toggle[aria-pressed=\"true\"]{border-color:var(--sof-gold,#c9a86a);color:var(--sof-gold,#c9a86a);}" +
        "@media (prefers-reduced-motion: reduce){.heaven-toggle{transition:none;}}" +
        /* The corner-clearance rule (companion layer): this
         * fixed pill shares the bottom-left corner with the
         * Spark seat and must never cover the page's own
         * controls — the body mark grows the page's bottom
         * clearance by the pill's height (spark-agent-seat.css
         * carries the shared rule). */
        "body.heaven-toggle-on{padding-bottom:4.25rem;}" +
        "body.heaven-toggle-on.spark-seat-on{padding-bottom:7.75rem;}";
      document.head.appendChild(st);
    }
    const btn = document.createElement("button");
    btn.id = "heavenToggle";
    btn.type = "button";
    btn.className = "heaven-toggle";
    btn.textContent = "Sound of the Day";
    btn.setAttribute("aria-pressed", "false");
    btn.title = "The Sound of the Day — a quiet soundscape grown from today's date";
    document.body.appendChild(btn);
    try { document.body.classList.add("heaven-toggle-on"); } catch { /* the pill still stands */ }
  }

  // Boot (but don’t start sound until user clicks)
  function boot(){
    ensureToggle();
    bindUI();
    // restore previous choice (the master switch outranks it)
    const saved = !!store.get("sof.heaven.enabled", false) && !masterSoundOff();
    scene = resolveScene(); // in case body data was set late
    if (!PREFERS_OFF && saved){
      // browsers require a user gesture; many allow playback if user enabled before.
      // we’ll try after first interaction.
      const arming = ()=>{ setEnabled(true); window.removeEventListener("pointerdown", arming); window.removeEventListener("keydown", arming); };
      window.addEventListener("pointerdown", arming, {once:true});
      window.addEventListener("keydown", arming, {once:true});
      const btn=document.getElementById("heavenToggle"); if(btn) btn.setAttribute("aria-pressed","true");
    }
  }

  // Expose a tiny API (optional)
  window.SOFSound = {
    setScene(id){ if (SCENES[id]){ scene=SCENES[id]; if (playing){ stopScene(); startScene(); } } },
    enable(){ setEnabled(true); }, disable(){ setEnabled(false); },
    // The day's identity, for tests and for any surface that wants to
    // show it: the seed, and the first n chime pitches the day will
    // sound (from the current scene's pool, replayed deterministically).
    daySeed(){ return seedForDay(); },
    coordinate(){ return todayCoordinate(); },
    chimePlan(n){
      const pool = scalePool(scene.root, scene.scale);
      const pick = makeChimePicker(pool);
      return Array.from({ length: n || 8 }, ()=> pick());
    }
  };

  window.addEventListener("DOMContentLoaded", boot);
})();


