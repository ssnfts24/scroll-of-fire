/* ========================================================================
   Scroll of Fire — Moons Engine
   File: assets/js/moons.js
   Version: v2025.11.03
   Purpose:
     - Compute Remnant 13×28 positions (with DOOT + leap-day handling)
     - Render ring, week dots, dual calendars, year map, .ics
     - Apply theme-moon-{1..13} and daytone-{1..28}
     - Animate starfield + subtle zodiac wheel (performance-safe)
     - Hook optional window.__EPHEMERIS__ (fallback demo if absent)
   No external deps. Motion is guarded by prefers-reduced-motion.
   ======================================================================== */
(function () {
  "use strict";

  /* ------------------------------ Utilities ------------------------------ */
  const $  = (sel, ctx=document) => ctx.querySelector(sel);
  const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
  const pad = (n) => String(n).padStart(2,'0');
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // Timezone helpers (use page shim if present)
  const getTZ = () => (window.MoonTZ?.getTZ?.() || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const wallParts = (d, tz=getTZ()) => (window.MoonTZ?.wallParts?.(d, tz) || d);
  const isoDateWall = (d) => (window.MoonTZ?.isoDateWall?.(d) ||
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`);

  const atWall = (Y,M,D,h=12,m=0,s=0,tz=getTZ()) =>
    wallParts(new Date(Date.UTC(Y, M-1, D, h, m, s)), tz);

  const nowWall = (tz=getTZ()) => wallParts(new Date(), tz);

  const addDaysUTC = (d,days)=> { const nd=new Date(d.getTime()); nd.setUTCDate(nd.getUTCDate()+days); return nd; };
  const diffDaysUTC = (a,b)=> Math.floor((a-b)/86400000);

  const isLeap = (y) => (y%4===0 && (y%100!==0 || y%400===0));

  /* ---------------------------- Remnant Rules ---------------------------- */
  // New year starts July 26; Day Out Of Time = July 25 (wall-time, local tz).
  function remYearStart(dw){
    const y = dw.getUTCFullYear();
    const jul26 = atWall(y,7,26,12,0,0);
    return (dw < jul26) ? atWall(y-1,7,26,12,0,0) : jul26;
  }

  function isDOOT(dw){
    const start = remYearStart(dw);
    const y = start.getUTCFullYear();
    return isoDateWall(dw) === isoDateWall(atWall(y,7,25,12,0,0));
  }

  // Leap-day adjustment: Skip Feb 29 from Remnant count
  function leapDaysBetween(start,end){
    let hits=0;
    for (let y=start.getUTCFullYear(); y<=end.getUTCFullYear(); y++){
      if (!isLeap(y)) continue;
      const f=atWall(y,2,29,12,0,0);
      if (f>=start && f<=end) hits++;
    }
    return hits;
  }

  function remnantPosition(dw){
    if (isDOOT(dw)) return {doot:true};
    const start = remYearStart(dw);
    let days = diffDaysUTC(dw,start);
    days -= leapDaysBetween(start,dw);
    const clamped = clamp(days, 0, 363);
    const moon = Math.floor(clamped/28)+1;
    const day  = (clamped%28)+1;
    const week = Math.floor((day-1)/7)+1;
    return {doot:false, moon, day, week, idxYear: clamped};
  }

  function wallDateForRemIdx(start, idx0){
    let d = addDaysUTC(start, idx0);
    const leaps = leapDaysBetween(start,d);
    if (leaps>0) d = addDaysUTC(d,leaps);
    return d;
  }

  function yearLabelFor(dw){ const y = remYearStart(dw).getUTCFullYear(); return `${y}/${y+1}`; }

  /* ------------------------------- State --------------------------------- */
  const state = {
    tz: getTZ(),
    anchor: null,     // UTC date whose wall parts are in tz (noon-safe)
    pos: null,        // remnantPosition(anchor)
    moons: Array.isArray(window.__MOONS__) && window.__MOONS__.length===13 ? window.__MOONS__ : getMoonDataset(),
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    anim: { raf: 0, startT: 0, sky: null, skyCtx: null }
  };

  function getWallAnchorFromURL(){
    const qp=new URLSearchParams(location.search);
    const pinned = qp.get('pin')==='1';
    const d = qp.get('date');
    if (pinned && d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const [Y,M,D]=d.split('-').map(Number);
      return atWall(Y,M,D,12,0,0);
    }
    return atWall(nowWall().getUTCFullYear(), nowWall().getUTCMonth()+1, nowWall().getUTCDate(), 12,0,0);
  }

  function getMoonDataset(){
    return [
      {"idx":1,"name":"Magnetic","essence":"Unify · Purpose","color":"#6FE7FF"},
      {"idx":2,"name":"Lunar","essence":"Polarize · Challenge","color":"#B1C7FF"},
      {"idx":3,"name":"Electric","essence":"Activate · Service","color":"#7AF3FF"},
      {"idx":4,"name":"Self-Existing","essence":"Define · Form","color":"#7BF3B8"},
      {"idx":5,"name":"Overtone","essence":"Empower · Radiance","color":"#FFD27A"},
      {"idx":6,"name":"Rhythmic","essence":"Organize · Equality","color":"#A7FFCF"},
      {"idx":7,"name":"Resonant","essence":"Channel · Attunement","color":"#D5B6FF"},
      {"idx":8,"name":"Galactic","essence":"Harmonize · Integrity","color":"#A8FFD9"},
      {"idx":9,"name":"Solar","essence":"Pulse · Intention","color":"#FFBC6F"},
      {"idx":10,"name":"Planetary","essence":"Perfect · Manifestation","color":"#A2FFD1"},
      {"idx":11,"name":"Spectral","essence":"Dissolve · Liberation","color":"#A8B8FF"},
      {"idx":12,"name":"Crystal","essence":"Dedicate · Cooperation","color":"#FFD7A8"},
      {"idx":13,"name":"Cosmic","essence":"Endure · Presence","color":"#9DDAFF"}
    ];
  }

  /* ------------------------------ Theming ------------------------------- */
  function applyTheme(moon, day, doot=false){
    const cls = document.body.classList;
    // Remove old moon/daytone classes
    for (let i=1;i<=13;i++) cls.remove(`theme-moon-${i}`);
    for (let i=1;i<=28;i++) cls.remove(`daytone-${i}`);
    cls.remove('theme-doot');

    if (doot){
      cls.add('theme-doot');
      return;
    }
    cls.add(`theme-moon-${clamp(moon,1,13)}`);
    cls.add(`daytone-${clamp(day,1,28)}`);
  }

  /* ------------------------------ Painting ------------------------------ */
  function paint() {
    // Anchor, tz, and position
    state.tz = getTZ();
    state.anchor = getWallAnchorFromURL();
    state.pos = remnantPosition(state.anchor);

    // Top chips
    const fmtDay = new Intl.DateTimeFormat("en-US",{timeZone:state.tz,weekday:"short",year:"numeric",month:"long",day:"2-digit"});
    $("#nowDate") && ($("#nowDate").textContent = fmtDay.format(state.anchor));
    $("#nowTZ") && ($("#nowTZ").textContent = state.tz);
    $("#nowClock") && ($("#nowClock").textContent = wallParts(new Date(), state.tz).toTimeString().slice(0,8));
    $("#yearSpan") && ($("#yearSpan").textContent = yearLabelFor(state.anchor));

    // Ring + header
    if (state.pos.doot){
      $("#dootWarn")?.removeAttribute("hidden");
      $("#moonName") && ($("#moonName").textContent="Day Out of Time");
      $("#moonEssence") && ($("#moonEssence").textContent="Pause · Reset");
      $("#moonLine") && ($("#moonLine").textContent="DOOT — outside the 13×28 cadence");
      $("#dayInMoon") && ($("#dayInMoon").textContent="—");
      const arc=$("#moonArc"); if (arc){ const full=316; arc.style.strokeDasharray=`1 ${full-1}`; }
      applyTheme(1,1,true);
    } else {
      $("#dootWarn") && ($("#dootWarn").hidden=true);
      const md = state.moons[state.pos.moon-1] || {};
      $("#moonName") && ($("#moonName").textContent = md.name || `Moon ${state.pos.moon}`);
      $("#moonEssence") && ($("#moonEssence").textContent = md.essence || "—");
      $("#moonLine") && ($("#moonLine").textContent = `Moon ${state.pos.moon} · Day ${state.pos.day} · Week ${state.pos.week}`);
      $("#dayInMoon") && ($("#dayInMoon").textContent = String(state.pos.day));
      const full=316, cur=Math.max(1, Math.floor(((state.pos.day-1)/28)*full));
      const arc=$("#moonArc"); if (arc){ arc.style.strokeDasharray = `${cur} ${full-cur}`; arc.style.stroke = md.color || getComputedStyle(document.documentElement).getPropertyValue('--accent'); }
      applyTheme(state.pos.moon, state.pos.day, false);
    }

    // Week dots
    const dotsWrap=$("#weekDots"); if (dotsWrap){
      dotsWrap.innerHTML="";
      for(let wk=1;wk<=4;wk++){
        const g=document.createElement('div'); g.className='wdots';
        for(let d=1;d<=7;d++){
          const i=(wk-1)*7+d;
          const dot=document.createElement('i'); dot.className='wdot';
          if(!state.pos.doot && i===state.pos.day) dot.classList.add('is-today');
          g.appendChild(dot);
        }
        dotsWrap.appendChild(g);
      }
    }

    // Year map + calendars
    buildYearMap(); buildDualCalendars();

    // Inputs
    $("#datePick") && ($("#datePick").value = isoDateWall(state.anchor));
    $("#hourScrub") && ($("#hourScrub").value = wallParts(state.anchor, state.tz).getUTCHours());
    $("#jumpMoon") && ($("#jumpMoon").value = state.pos.doot ? "" : String(state.pos.moon));

    // Live numerology + verse (demo hooks)
    updateNumerology(); updateVerse();

    // Astrology widgets
    renderAstrology();

    // Debug
    const dbg=$("#dbg");
    if (dbg) dbg.textContent = JSON.stringify({ tz: state.tz, anchor: isoDateWall(state.anchor), pos: state.pos }, null, 2);
  }

  /* -------------------------- Calendars / Maps --------------------------- */
  function buildDualCalendars(){ buildRemnantMonth(); buildGregorianMonth(); }

  function buildRemnantMonth(){
    const host=$("#remCal"); if(!host) return; host.innerHTML="";
    const tz=state.tz; const yStart=remYearStart(state.anchor);

    const hdr=$("#remHdr");
    if (hdr) hdr.textContent = state.pos.doot ? "Remnant Month — DOOT" :
      `Remnant Month — ${state.moons[state.pos.moon-1].name} (${state.pos.moon}/13)`;

    $("#remMeta") && ($("#remMeta").textContent = `13 × 28 fixed — ${tz}`);

    const grid=document.createElement('ol'); grid.className='r-grid'; grid.setAttribute('role','grid');
    ["D1","D2","D3","D4","D5","D6","D7"].forEach(l=>{ const th=document.createElement('li'); th.className='r-lbl'; th.setAttribute('role','columnheader'); th.textContent=l; grid.appendChild(th); });

    if (state.pos.doot){
      const li=document.createElement('li'); li.className='r-doot'; li.textContent='Day Out of Time'; grid.appendChild(li);
    } else {
      const startIdx0=(state.pos.moon-1)*28;
      for(let i=0;i<28;i++){
        const idx0=startIdx0+i, dWall=wallDateForRemIdx(yStart,idx0);
        const cell=document.createElement('li'); cell.className='r-day'+(((i+1)===state.pos.day)?' is-today':''); cell.setAttribute('role','gridcell');
        const btn=document.createElement('button'); btn.type='button';
        btn.dataset.r=isoDateWall(dWall); btn.dataset.moon=String(state.pos.moon); btn.dataset.day=String(i+1);
        btn.title = new Intl.DateTimeFormat("en-US",{timeZone:tz,year:"numeric",month:"short",day:"2-digit"}).format(dWall)+" ("+tz+")";
        btn.textContent=String(i+1);
        btn.addEventListener('click',()=> pinTo(btn.dataset.r));
        cell.appendChild(btn); grid.appendChild(cell);
      }
    }
    host.appendChild(grid);
  }

  function buildGregorianMonth(){
    // BUGFIX: month label is anchored to the actual view anchor, not "now".
    const host=$("#gregCal"); if(!host) return; host.innerHTML="";
    const tz=state.tz; const a=wallParts(state.anchor,tz); const Y=a.getUTCFullYear(); const M0=a.getUTCMonth();
    const first=atWall(Y,M0+1,1,12,0,0,tz);
    const nextFirst=(M0===11)?atWall(Y+1,1,1,12,0,0,tz):atWall(Y,M0+2,1,12,0,0,tz);
    const daysIn=Math.round((nextFirst-first)/86400000), firstDow=first.getUTCDay();

    $("#gregHdr") && ($("#gregHdr").textContent=`Gregorian Month — ${new Intl.DateTimeFormat("en-US",{timeZone:tz,month:"long"}).format(first)} ${Y}`);
    $("#gregMeta") && ($("#gregMeta").textContent="Variable weeks");

    const grid=document.createElement('ol'); grid.className='g-grid'; grid.setAttribute('role','grid');
    ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].forEach(l=>{ const th=document.createElement('li'); th.className='g-lbl'; th.setAttribute('role','columnheader'); th.textContent=l; grid.appendChild(th); });

    for(let i=0;i<firstDow;i++){ const padCell=document.createElement('li'); padCell.className='g-pad'; padCell.setAttribute('aria-hidden','true'); grid.appendChild(padCell); }

    const todayYMD = isoDateWall(atWall(nowWall().getUTCFullYear(), nowWall().getUTCMonth()+1, nowWall().getUTCDate(), 12,0,0,tz));
    for(let d=1; d<=daysIn; d++){
      const dWall=atWall(Y,M0+1,d,12,0,0,tz), isToday=(isoDateWall(dWall)===todayYMD);
      const li=document.createElement('li'); li.className='g-day'+(isToday?' is-today':''); li.setAttribute('role','gridcell');
      const btn=document.createElement('button'); btn.type='button'; btn.dataset.g=`${Y}-${pad(M0+1)}-${pad(d)}`; btn.textContent=String(d);
      btn.addEventListener('click',()=> pinTo(btn.dataset.g));
      li.appendChild(btn); grid.appendChild(li);
    }
    host.appendChild(grid);
  }

  function buildYearMap(){
    const tbody=$("#yearMap tbody"); if(!tbody) return;
    const tz=state.tz; const start=remYearStart(state.anchor);
    const rows=[];
    for(let i=0;i<13;i++){
      const s=wallDateForRemIdx(start,i*28); const e=addDaysUTC(s,27);
      rows.push({i:i+1,s,e,name:state.moons[i].name,essence:state.moons[i].essence});
    }
    const fmt=d=>new Intl.DateTimeFormat("en-US",{timeZone:tz,year:"numeric",month:"short",day:"2-digit"}).format(d);
    tbody.innerHTML = rows.map(r=>`<tr><td>${r.i}</td><td>${r.name}</td><td>${r.essence}</td><td>${fmt(r.s)} <span class="tag mono">${tz}</span></td><td>${fmt(r.e)} <span class="tag mono">${tz}</span></td></tr>`).join("");
    const pos=state.pos, info=$("#nextMoonInfo");
    if (!info) return;
    if (!pos.doot){
      const nextStart=wallDateForRemIdx(start,(pos.moon%13)*28);
      const label=new Intl.DateTimeFormat("en-US",{timeZone:tz,month:"short",day:"2-digit"}).format(nextStart);
      info.textContent = `Next: ${state.moons[pos.moon%13].name} begins ${label} (${tz})`;
    } else info.textContent="This is the Day Out of Time — the count resumes tomorrow.";
  }

  /* ------------------------------- ICS ----------------------------------- */
  function buildICSBlob(){
    const tz=state.tz; const yStart=remYearStart(state.anchor);
    const labelYear=`${yStart.getUTCFullYear()}/${yStart.getUTCFullYear()+1}`;
    const stamp=(()=>{const d=new Date();return d.getUTCFullYear()+pad(d.getUTCMonth()+1)+pad(d.getUTCDate())+'T'+pad(d.getUTCHours())+pad(d.getUTCMinutes())+pad(d.getUTCSeconds())+'Z'})()
    const fmtDate=d=> d.getUTCFullYear()+pad(d.getUTCMonth()+1)+pad(d.getUTCDate());
    const uid=()=> (crypto&&crypto.randomUUID)?crypto.randomUUID():('sof-'+Math.random().toString(36).slice(2));

    let ics="BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Scroll of Fire//13 Moon//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n";
    for(let i=0;i<13;i++){
      const s=wallDateForRemIdx(yStart,i*28), e=new Date(s); e.setUTCDate(e.getUTCDate()+28);
      ics+="BEGIN:VEVENT\r\n"+"UID:"+uid()+"@scroll-of-fire\r\nDTSTAMP:"+stamp+
        "\r\nDTSTART;VALUE=DATE:"+fmtDate(s)+"\r\nDTEND;VALUE=DATE:"+fmtDate(e)+
        "\r\nSUMMARY:"+(i+1)+". "+state.moons[i].name+" Moon — "+labelYear+" ("+tz+")\r\nDESCRIPTION:"+state.moons[i].essence+"\r\nEND:VEVENT\r\n";
    }
    ics+="END:VCALENDAR\r\n";
    return new Blob([ics],{type:"text/calendar"});
  }

  /* ----------------------------- Numerology ------------------------------ */
  function updateNumerology(){
    const pos = state.pos;
    const line = $("#numLine"), meta=$("#numMeta"), quote=$("#energyQuote");
    if (!line || !meta || !quote) return;

    if (pos.doot){
      line.textContent = "DOOT · 0";
      meta.textContent = "Pause + Reset: outside the 13×28 cadence.";
      quote.textContent = "“Between breaths, the field remembers.”";
      return;
    }
    const moon = pos.moon, day = pos.day, sum = moon + day;
    line.textContent = `Moon ${moon} + Day ${day} = ${sum}`;
    meta.textContent = (()=>{
      // loose vibe text
      const vibes = [
        "Seed the intention.",
        "Balance the polarities.",
        "Channel and activate.",
        "Define the form.",
        "Crown the radiance.",
        "Stabilize equality.",
        "Tune the resonance.",
        "Harmonize integrity.",
        "Pulse the will.",
        "Perfect manifestation.",
        "Dissolve to liberate.",
        "Dedicate cooperation.",
        "Endure in presence."
      ];
      return vibes[(moon-1)%vibes.length];
    })();
    quote.textContent = "“Number the days; crown the weeks; keep the remnant bright.”";
  }

  /* -------------------------------- Verse -------------------------------- */
  function updateVerse(){
    const he = $("#vHeb"), en=$("#vEn"), ref=$("#vRef");
    if (!he || !en || !ref) return;
    // Small rotating set (can be replaced by your data file later)
    const verses = [
      {he:"בראשית יהוה ברא אור", en:"In the beginning YHWH set the light apart.", ref:"Genesis (Remnant gloss)"},
      {he:"יהוה נרי וישעי", en:"YHWH is my light and my salvation.", ref:"Psalm (Remnant gloss)"},
      {he:"שָׁלוֹם עַל הָאֵשׁ הַנִּצְחִית", en:"Peace upon the eternal fire.", ref:"Scroll of Fire"}
    ];
    const idx = (state.pos.doot ? 0 : (state.pos.moon + state.pos.day) % verses.length);
    he.textContent = verses[idx].he;
    en.textContent = verses[idx].en;
    ref.textContent = verses[idx].ref;
  }

  /* ------------------------------ Astrology ------------------------------ */
  function renderAstrology(){
    const stamp = $("#astroStamp"), tzEl=$("#astroTZ"), src=$("#astroSource");
    if (stamp) stamp.textContent = new Intl.DateTimeFormat("en-US",{timeZone:state.tz,year:"numeric",month:"short",day:"2-digit",hour:"2-digit",minute:"2-digit"}).format(state.anchor);
    if (tzEl) tzEl.textContent = state.tz;

    const eph = window.__EPHEMERIS__;
    if (src) src.textContent = eph ? "Ephemeris" : "Demo";

    // Update chips
    const planetNames = ["sun","moon","mercury","venus","mars","jupiter","saturn","uranus","neptune","pluto","north_node"];
    planetNames.forEach(p=>{
      const posSpan = $(`.mono.pos[data-pos="${p}"]`);
      const signSpan= $(`.sign[data-sign="${p}"]`);
      const val = eph ? eph[p]?.degree ?? NaN : demoDegreeFor(p);
      const sign = degreeToSign(val);
      if (posSpan) posSpan.textContent = Number.isFinite(val) ? `${val.toFixed(1)}°` : "—";
      if (signSpan) signSpan.textContent = sign || "—";
    });

    drawWheel(planetNames.map(p=>{
      const deg = eph ? eph[p]?.degree ?? NaN : demoDegreeFor(p);
      return {key:p, degree: Number.isFinite(deg) ? deg : 0};
    }));

    // Aspects (simplified demo aspects)
    const tbody = $("#aspBody");
    if (tbody){
      const aspects = computeAspects(planetNames, (p)=> (eph ? eph[p]?.degree ?? NaN : demoDegreeFor(p)));
      tbody.innerHTML = aspects.map(a=>`<tr><td>${a.p1}–${a.p2}</td><td>${a.kind}</td><td>${a.orb.toFixed(1)}°</td></tr>`).join("");
    }
  }

  const SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
  function degreeToSign(deg){
    if (!Number.isFinite(deg)) return "";
    const z = ((deg%360)+360)%360;
    return SIGNS[Math.floor(z/30)];
  }

  function demoDegreeFor(p){
    // pleasant deterministic drift so UI feels alive
    const t = Date.now()/1000;
    const base = { sun:10, moon: 200, mercury: 40, venus: 80, mars: 120, jupiter: 160, saturn: 220, uranus: 260, neptune: 300, pluto: 340, north_node: 20 }[p] || 0;
    const speed = { moon: 13, mercury: 1.2, venus: 1.1, sun: .99, mars: .5, jupiter: .08, saturn: .03, uranus: .01, neptune: .008, pluto: .005, north_node: .06 }[p] || .02;
    return (base + (t * speed)) % 360;
  }

  function drawWheel(points){
    const svg = $("#astroWheel"); if (!svg) return;
    const gSigns = $("#signLabels"), gHouses = $("#houseLines"), gDots=$("#planetDots");
    if (gSigns && gSigns.childNodes.length===0){
      // place sign labels
      for(let i=0;i<12;i++){
        const ang = (i*30-90) * Math.PI/180;
        const x = 180 + Math.cos(ang)*120;
        const y = 180 + Math.sin(ang)*120;
        const t = document.createElementNS("http://www.w3.org/2000/svg","text");
        t.setAttribute("x", x.toFixed(1)); t.setAttribute("y", y.toFixed(1)); t.textContent = SIGNS[i].slice(0,3);
        gSigns.appendChild(t);
      }
    }
    if (gHouses && gHouses.childNodes.length===0){
      for(let i=0;i<12;i++){
        const ang = (i*30) * Math.PI/180;
        const x1 = 180 + Math.cos(ang)*145, y1 = 180 + Math.sin(ang)*145;
        const x2 = 180 + Math.cos(ang)*165, y2 = 180 + Math.sin(ang)*165;
        const l = document.createElementNS("http://www.w3.org/2000/svg","line");
        l.setAttribute("x1", x1); l.setAttribute("y1", y1); l.setAttribute("x2", x2); l.setAttribute("y2", y2);
        gHouses.appendChild(l);
      }
    }
    // place dots
    if (gDots){
      const r = 135;
      points.forEach(pt=>{
        const dot = svg.querySelector(`circle[data-dot="${pt.key}"]`);
        if (!dot) return;
        const ang = (pt.degree-90) * Math.PI/180;
        const x = 180 + Math.cos(ang)*r, y = 180 + Math.sin(ang)*r;
        dot.setAttribute("cx", x.toFixed(1));
        dot.setAttribute("cy", y.toFixed(1));
      });
    }
  }

  function computeAspects(planets, degreeFn){
    const res=[]; const kinds=[{k:"☌ Conj", a:0, orb:6},{k:"✶ Sext", a:60, orb:4},{k:"□ Sq", a:90, orb:4},{k:"△ Tri", a:120, orb:4},{k:"☍ Opp", a:180, orb:6}];
    for(let i=0;i<planets.length;i++){
      for(let j=i+1;j<planets.length;j++){
        const p1=planets[i], p2=planets[j];
        const d1=degreeFn(p1), d2=degreeFn(p2);
        if (!Number.isFinite(d1) || !Number.isFinite(d2)) continue;
        const sep = Math.abs((((d1-d2+540)%360)+360)%360 - 180);
        for (const kind of kinds){
          const diff = Math.abs(sep - (180-kind.a));
          if (diff <= kind.orb) { res.push({p1, p2, kind: kind.k, orb: diff}); break; }
        }
      }
    }
    return res;
  }

  /* ----------------------------- Sky Canvas ------------------------------ */
  function startSky(){
    const cvs = $("#skyBg"); if (!cvs) return;
    state.anim.sky = cvs; state.anim.skyCtx = cvs.getContext('2d', {alpha:true});
    resizeSky(); drawSky(0);
    if (!state.reducedMotion) { state.anim.startT = performance.now(); loopSky(); }
  }

  function resizeSky(){
    const dpr = Math.max(1, Math.min(2, devicePixelRatio || 1));
    const w = Math.floor(innerWidth * dpr), h = Math.floor(innerHeight * dpr);
    const cvs = state.anim.sky, ctx = state.anim.skyCtx; if (!cvs || !ctx) return;
    if (cvs.width !== w || cvs.height !== h){ cvs.width = w; cvs.height = h; }
  }

  function loopSky(){
    state.anim.raf = requestAnimationFrame((t)=>{ drawSky(t - state.anim.startT); loopSky(); });
  }

  function drawSky(t){
    const cvs=state.anim.sky, ctx=state.anim.skyCtx; if (!cvs || !ctx) return;
    const dpr = Math.max(1, Math.min(2, devicePixelRatio || 1));
    const w=cvs.width, h=cvs.height;
    ctx.clearRect(0,0,w,h);

    // Deep gradient
    const g = ctx.createRadialGradient(w*0.5,h*-0.1, h*0.1, w*0.5,h*0.3,h*0.9);
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--moon-accent').trim() || '#7af3ff';
    g.addColorStop(0, hexA(accent, .08));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0,0,w,h);

    // Stars
    const seed = 1337; // deterministic
    const rand = mulberry32(seed);
    const N = Math.floor((w*h)/(180*180)); // density tuned for perf
    ctx.fillStyle = '#ffffff';
    for(let i=0;i<N;i++){
      const x = Math.floor(rand()*w), y = Math.floor(rand()*h);
      const tw = 0.7 + Math.sin((t/9000)+(i*0.37)) * 0.3;
      ctx.globalAlpha = 0.25 + 0.35*tw;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;

    // Subtle “planets” on slow orbits (parallax)
    drawPlanet(ctx, w, h, accent, (t/18000)%1, 0.15, 2.3*dpr);
    drawPlanet(ctx, w, h, '#a7b1ca', (t/26000)%1, 0.82, 1.6*dpr);
  }

  function drawPlanet(ctx, w, h, color, phase, radiusFactor, size){
    const r = Math.min(w,h)*radiusFactor;
    const ang = phase * Math.PI*2;
    const cx = w/2 + Math.cos(ang)*r;
    const cy = h/2 + Math.sin(ang)*r*0.55;
    ctx.beginPath();
    ctx.arc(cx, cy, size, 0, Math.PI*2);
    ctx.fillStyle = hexA(color, .8);
    ctx.fill();
  }

  function mulberry32(a){ return function(){ var t = a += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; } }
  function hexA(hex, a){
    // supports #rrggbb
    const m = hex.trim().match(/^#?([0-9a-f]{6})$/i); if(!m) return `rgba(122,243,255,${a})`;
    const v = parseInt(m[1],16); const r=(v>>16)&255, g=(v>>8)&255, b=v&255;
    return `rgba(${r},${g},${b},${a})`;
  }

  /* ------------------------------ Actions -------------------------------- */
  function pinTo(ymd){
    const qp=new URLSearchParams(location.search);
    qp.set('date', ymd); qp.set('pin','1');
    history.replaceState(null,'',`${location.pathname}?${qp.toString()}`);
    paint();
  }

  function wireUI(){
    $("#btnToday")?.addEventListener('click',()=>{
      const qp=new URLSearchParams(location.search); qp.delete('date'); qp.delete('pin');
      history.replaceState(null,'',`${location.pathname}?${qp.toString()}`.replace(/\?$/,''));
      paint();
    });
    $("#prevDay")?.addEventListener('click',()=>{
      const a=state.anchor; const y=a.getUTCFullYear(), m=a.getUTCMonth()+1, d=a.getUTCDate()-1;
      pinTo(`${y}-${pad(m)}-${pad(d)}`);
    });
    $("#nextDay")?.addEventListener('click',()=>{
      const a=state.anchor; const y=a.getUTCFullYear(), m=a.getUTCMonth()+1, d=a.getUTCDate()+1;
      pinTo(`${y}-${pad(m)}-${pad(d)}`);
    });
    $("#datePick")?.addEventListener('change',(ev)=> pinTo(ev.target.value));
    $("#jumpMoon")?.addEventListener('change',(ev)=>{
      const m=parseInt(ev.target.value||'0',10); if(!m) return;
      const start=remYearStart(state.anchor);
      const target=wallDateForRemIdx(start,(m-1)*28);
      pinTo(isoDateWall(target));
    });
    $("#shareLink")?.addEventListener('click',()=>{
      const url = location.href;
      navigator.clipboard?.writeText(url).then(()=> {
        $("#shareLink").textContent="Copied!";
        setTimeout(()=> $("#shareLink").textContent="Copy Link", 1500);
      });
    });
    $("#resetTZ")?.addEventListener('click',()=>{
      try {
        Intl.DateTimeFormat().resolvedOptions().timeZone = "America/Los_Angeles";
      } catch {}
      paint();
    });

    // Live clock tick
    setInterval(()=>{ const el=$("#nowClock"); if (el) el.textContent = wallParts(new Date(), getTZ()).toTimeString().slice(0,8); }, 1000);

    // Resize observer for canvas
    addEventListener('resize', resizeSky, {passive:true});
    addEventListener('orientationchange', resizeSky, {passive:true});

    // .ics
    const dl=$("#dlICS"); const regen=$("#regenICS");
    if (dl){
      dl.addEventListener('click', (e)=>{ e.preventDefault(); const blob=buildICSBlob(); dl.href=URL.createObjectURL(blob); dl.download='13-moon-year.ics'; });
    }
    regen?.addEventListener('click',()=>{ if(dl) dl.href='#'; });
  }

  /* -------------------------------- Init --------------------------------- */
  function boot(){
    startSky();
    wireUI();
    paint();
  }

  if (document.readyState === "loading"){
    document.addEventListener('DOMContentLoaded', boot, {once:true});
  } else {
    boot();
  }
})();
