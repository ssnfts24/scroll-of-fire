/* ========================================================================
   Scroll of Fire — 13 Moons (Core + Calendars + Astro guard)
   v4.1 Remnant — DPR canvas, TZ-correct anchors, scroll-safe URLs
   ======================================================================== */
(function () {
  "use strict";

  /* --------------------------- Utilities -------------------------------- */
  const $  = (sel, ctx=document) => ctx.querySelector(sel);
  const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
  const on = (t,e,f,o)=> t && t.addEventListener(e,f,o);
  const pad = n => String(n).padStart(2, "0");
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const prefersReduced = () => (typeof matchMedia==="function") && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const safe = fn => { try { return fn(); } catch(e){ console.warn("[Moons]", e); return void 0; } };

  // Crash toast (non-blocking)
  const crash=(msg,err)=>{
    console.error("[Moons crash]", msg, err);
    const n=document.createElement("div");
    n.style.cssText="position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:99999;background:#230b0b;color:#ffd7d7;border:1px solid #712828;padding:8px 10px;border-radius:10px;font:600 13px/1.3 Inter";
    n.textContent="Moons: "+msg;
    document.body.appendChild(n);
    setTimeout(()=>n.remove(), 3500);
  };

  /* Footer year */
  safe(()=> $("#yr") && ($("#yr").textContent=new Date().getFullYear()));

  /* ------------------------------ Data ---------------------------------- */
  const MOONS = ["Magnetic","Lunar","Electric","Self-Existing","Overtone","Rhythmic","Resonant","Galactic","Solar","Planetary","Spectral","Crystal","Cosmic"];
  const MOON_ESSENCE = ["Attract purpose","Stabilize challenge","Activate service","Define form","Empower radiance","Balance equality","Channel inspiration","Harmonize integrity","Pulse intention","Perfect manifestation","Dissolve release","Dedicate cooperation","Endure presence"];
  const SEALS = ["Red Dragon","White Wind","Blue Night","Yellow Seed","Red Serpent","White Worldbridger","Blue Hand","Yellow Star","Red Moon","White Dog","Blue Monkey","Yellow Human","Red Skywalker","White Wizard","Blue Eagle","Yellow Warrior","Red Earth","White Mirror","Blue Storm","Yellow Sun"];
  const QUOTES = [
    "“Teach us to number our days, that we may apply our hearts unto wisdom.” — Psalm 90:12",
    "“For everything there is a season…” — Ecclesiastes 3:1",
    "“The light shines in the darkness, and the darkness has not overcome it.” — John 1:5",
    "“In quietness and trust is your strength.” — Isaiah 30:15",
    "“He heals the brokenhearted and binds up their wounds.” — Psalm 147:3"
  ];

  /* --------------------------- Prefs / TZ ------------------------------- */
  const TZ_KEY="sof_moons_tz";
  const tzPick = $("#tzPick");
  const COMMON_TZ = ["UTC","America/Los_Angeles","America/Denver","America/Chicago","America/New_York","Europe/London","Europe/Berlin","Europe/Helsinki","Africa/Johannesburg","Asia/Dubai","Asia/Kolkata","Asia/Shanghai","Asia/Tokyo","Australia/Sydney"];
  let ALL_TZ = COMMON_TZ.slice(0);
  let defaultTZ = safe(()=> localStorage.getItem(TZ_KEY)) || safe(()=>Intl.DateTimeFormat().resolvedOptions().timeZone) || "UTC";

  safe(()=>{
    if (Intl.supportedValuesOf) {
      const full = Intl.supportedValuesOf("timeZone");
      if (Array.isArray(full) && full.length) ALL_TZ = Array.from(new Set([...COMMON_TZ, ...full]));
    }
  });

  if (tzPick){
    try{
      tzPick.innerHTML = ALL_TZ.map(z=>`<option value="${z}">${z}</option>`).join("");
      tzPick.value = ALL_TZ.includes(defaultTZ) ? defaultTZ : "UTC";
    }catch(e){
      tzPick.innerHTML = COMMON_TZ.map(z=>`<option value="${z}">${z}</option>`).join("");
      tzPick.value = "UTC";
    }
    on(tzPick,"change",()=>{
      safe(()=> localStorage.setItem(TZ_KEY, tzPick.value));
      safeWriteURL(()=>origWriteURL());
      updateAll(true);
      buildYearMap();
      window.buildCalendars && window.buildCalendars();
    }, {passive:true});
  }

  /* ------------------------- Date helpers ------------------------------- */
  function dateInTZ(baseDate, tz, overrideHour){
    try{
      const opts={timeZone:tz, hour12:false, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit"};
      const parts=new Intl.DateTimeFormat("en-CA",opts).formatToParts(baseDate);
      const m=Object.fromEntries(parts.map(p=>[p.type,p.value]));
      const h = (overrideHour==null? m.hour : pad(overrideHour));
      return new Date(`${m.year}-${m.month}-${m.day}T${h}:${m.minute}:${m.second}Z`);
    }catch(e){
      const d = new Date(baseDate);
      if (overrideHour!=null) d.setUTCHours(overrideHour,0,0,0);
      return d;
    }
  }
  const fmtDateTZ=(d,tz)=> safe(()=> new Intl.DateTimeFormat(undefined,{dateStyle:"full", timeZone:tz}).format(d))
                        || new Intl.DateTimeFormat(undefined,{weekday:"long", year:"numeric", month:"long", day:"numeric", timeZone:tz}).format(d);
  const fmtShort=(d,tz)=> safe(()=> new Intl.DateTimeFormat(undefined,{month:"short", day:"2-digit", timeZone:tz}).format(d));
  const fmtTime=(d,tz)=> safe(()=> new Intl.DateTimeFormat(undefined,{timeStyle:"medium", timeZone:tz}).format(d))
                       || new Intl.DateTimeFormat(undefined,{hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false, timeZone:tz}).format(d);
  const utcTrunc = (d)=> new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const validDateStr = s => /^\d{4}-\d{2}-\d{2}$/.test(s);

  const isLeapYear   = y=> (y%4===0 && y%100!==0) || (y%400===0);
  const isLeapDayUTC = d=> d.getUTCMonth()===1 && d.getUTCDate()===29;
  const isDOOT = (d, tz)=>{ const dt=dateInTZ(d,tz); return (dt.getUTCMonth()===6 && dt.getUTCDate()===25); };

  // TZ-STRICT start of year (Jul 26 00:00 in chosen TZ)
  function startOfYear13(date, tz){
    // Get the year number in the given TZ
    const yPart = new Intl.DateTimeFormat('en-US',{timeZone:tz, year:'numeric'}).formatToParts(date)
                   .find(p=>p.type==='year').value;
    // Build a UTC date representing that TZ's 00:00 on Jul 26
    // We ask the formatter for components to avoid DST quirks
    const mk = (Y,M,D)=> new Date(Date.UTC(+Y, M-1, D, 0,0,0));
    // This already produces stable UTC instants for comparison
    return mk(yPart, 7, 26);
  }

  function addDaysSkippingSpecials(start, n, tz){
    let d = new Date(start); let moved = 0;
    const step = Math.sign(n)||1;
    while(moved !== n){
      d = new Date(d.getTime()+step*86400000);
      if (isDOOT(d,tz) || isLeapDayUTC(d)) continue;
      moved += step;
    }
    return d;
  }
  function dayIndexSinceStart(d, tz){
    const start = utcTrunc(startOfYear13(d, tz));
    const dt = utcTrunc(dateInTZ(d, tz));
    let days = Math.floor((dt - start)/86400000);
    const doot = new Date(Date.UTC(start.getUTCFullYear()+1,6,25));
    if (dt >= doot) days -= 1;
    for (let y=start.getUTCFullYear(); y<=dt.getUTCFullYear(); y++){
      if(isLeapYear(y)){
        const feb29 = new Date(Date.UTC(y,1,29));
        if (dt >= feb29 && start <= feb29) days -= 1;
      }
    }
    return days; // 0..363
  }
  function calc13Moon(d, tz){
    if (isDOOT(d,tz)){
      const s=startOfYear13(d,tz).getUTCFullYear();
      return {special:"Day Out of Time", year:`${s}/${s+1}`};
    }
    if (isLeapDayUTC(dateInTZ(d,tz))){
      const s=startOfYear13(d,tz).getUTCFullYear();
      return {special:"Leap Day", year:`${s}/${s+1}`};
    }
    const idx = dayIndexSinceStart(d, tz);
    const moon = Math.floor(idx/28)+1;
    const day  = (idx%28)+1;
    const s=startOfYear13(d,tz).getUTCFullYear();
    return {special:null, moon, day, year:`${s}/${s+1}`};
  }
  function yearMoonSpans(anchor, tz){
    const spans=[]; let curStart = utcTrunc(anchor);
    for(let m=1;m<=13;m++){
      const start = curStart;
      const end   = utcTrunc(addDaysSkippingSpecials(start, 27, tz));
      spans.push({m, name:MOONS[m-1], essence:MOON_ESSENCE[m-1], start, end});
      curStart = utcTrunc(addDaysSkippingSpecials(end, 1, tz));
    }
    return spans;
  }

  /* ---------------------- Lunar Phase + Canvas --------------------------- */
  function moonPhase(d){
    const syn = 29.530588853, epoch = Date.UTC(2000,0,6,18,14,0);
    const ageDays = ((d.getTime()-epoch)/86400000);
    const frac = ((ageDays % syn)+syn)%syn / syn;
    const illum = (1 - Math.cos(2*Math.PI*frac))/2;
    const names = [
      {n:"New Moon", r:[0.00,0.03]}, {n:"Waxing Crescent", r:[0.03,0.22]},
      {n:"First Quarter", r:[0.22,0.28]}, {n:"Waxing Gibbous", r:[0.28,0.47]},
      {n:"Full Moon", r:[0.47,0.53]}, {n:"Waning Gibbous", r:[0.53,0.72]},
      {n:"Last Quarter", r:[0.72,0.78]}, {n:"Waning Crescent", r:[0.78,0.97]},
      {n:"New Moon", r:[0.97,1.01]},
    ];
    const phase = (names.find(x => frac >= x.r[0] && frac < x.r[1]) || {}).n || "—";
    return {phase, ageDays, illum, frac};
  }

  // Canvas refs/state
  const simMoon = $("#simMoon");
  let ctx=null, DPR=1, CW=0, CH=0;
  let pointerX=0, pointerY=0, parallax=0;
  let currentIllum=0, currentSunAngle=0;

  function sizeCanvas(){
    if (!simMoon) return;
    DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const rect = simMoon.getBoundingClientRect();
    const w = Math.max(220, Math.round(rect.width || 280));
    const h = w; // square
    CW = w; CH = h;
    simMoon.width  = Math.round(w * DPR);
    simMoon.height = Math.round(h * DPR);
    simMoon.style.width  = w + "px";
    simMoon.style.height = h + "px";
    ctx = simMoon.getContext("2d");
    if (ctx) ctx.setTransform(DPR,0,0,DPR,0,0);
  }
  if (simMoon){
    sizeCanvas();
    const ro = ("ResizeObserver" in window) ? new ResizeObserver(sizeCanvas) : null;
    ro && ro.observe(simMoon);
    on(window,"resize", sizeCanvas, {passive:true});
    on(simMoon, "pointermove", e=>{
      const r = simMoon.getBoundingClientRect();
      const x = (e.clientX - r.left)/r.width - 0.5;
      const y = (e.clientY - r.top )/r.height - 0.5;
      pointerX = clamp(x*2, -1, 1);
      pointerY = clamp(y*2, -1, 1);
      parallax = 1;
    }, {passive:true});
    on(simMoon, "pointerleave", ()=>{ parallax = 0; }, {passive:true});
  }

  // Activity ring (kept lightweight)
  let activity = {particles:[], mode:"magnetic"};
  let currentMoonIdx = 0;
  function seededRand(seed){ let x = Math.imul(seed ^ 0x6d2b79f5, 1); return ()=>((x=Math.imul(x ^ (x>>>15), 1|x))>>>0)/4294967295; }
  function buildActivityForMoon(mIdx){
    currentMoonIdx = mIdx;
    const rand = seededRand(0xBEEF ^ mIdx);
    const count = 24 + Math.floor(rand()*22);
    const spinDir = (mIdx%2===0) ? 1 : -1;
    const modes = ["magnetic","lunar","electric","self","overtone","rhythmic","resonant","galactic","solar","planetary","spectral","crystal","cosmic"];
    activity.mode = modes[(mIdx-1)%modes.length];
    activity.particles = Array.from({length:count}, (_,i)=>{
      const base = (i/count)*Math.PI*2;
      return { a: base + rand()*0.6, r: 1.15 + rand()*0.25, s: (0.18 + rand()*0.22)*spinDir, z: 0.6 + rand()*0.6, j: rand()*0.04 + 0.01 };
    });
  }
  function drawActivity(cx, cy, R, t){
    if (!ctx || prefersReduced()) return;
    ctx.save();
    ctx.translate(cx,cy);
    ctx.globalCompositeOperation="lighter";
    ctx.strokeStyle="rgba(255,255,255,0.06)";
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(0,0,R*1.45,0,Math.PI*2); ctx.stroke();
    activity.particles.forEach(p=>{
      const a = p.a + t*0.0008*p.s + Math.sin(t*0.001 + p.a*3)*p.j;
      const rr = R * p.r * (1 + 0.02*Math.sin(t*0.0012 + p.a*5));
      const x = Math.cos(a)*rr, y = Math.sin(a)*rr;
      ctx.beginPath(); ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.arc(x, y, 2.2 + p.z*1.2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.strokeStyle = "rgba(199,233,255,0.25)"; ctx.lineWidth=1; ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(a)*6, y - Math.sin(a)*6); ctx.stroke();
    });
    if (activity.mode==="resonant" || activity.mode==="solar" || activity.mode==="cosmic"){
      ctx.strokeStyle="rgba(243,201,122,0.16)"; ctx.lineWidth=1.2;
      for(let k=0;k<3;k++){ const s=R*(1.1+k*0.12); ctx.beginPath(); ctx.arc(0,0,s,0,Math.PI*2); ctx.stroke(); }
    }
    ctx.restore();
  }

  function drawMoonSimToContext(illum, sunAngle, tBreath){
    if (!ctx) return;
    const W=CW, H=CH;
    ctx.clearRect(0,0,W,H);
    const g=ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,"#0a0e15"); g.addColorStop(1,"#06080d");
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    const offX = parallax ? pointerX*8 : 0;
    const offY = parallax ? pointerY*6 : 0;
    const cx=W/2 + offX, cy=H/2 + offY;
    const R=Math.min(W,H)*0.32 * (1 + 0.015*Math.sin(tBreath*0.0016));
    const sx = cx + Math.cos(sunAngle)*R*1.7;
    const sy = cy - Math.sin(sunAngle)*R*1.7;

    // body
    ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2);
    const body=ctx.createRadialGradient(cx,cy-R*0.65,R*0.2, cx,cy,R*1.05);
    body.addColorStop(0, "#1a2130"); body.addColorStop(1, "#0e131c");
    ctx.fillStyle=body; ctx.fill();

    // terminator
    const k = 2*illum-1; const rx = R*Math.abs(k), ry = R;
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(-sunAngle);
    ctx.beginPath();
    if (k>=0){ ctx.ellipse(0,0,rx,ry,0,Math.PI/2,-Math.PI/2,true); ctx.arc(0,0,R,-Math.PI/2,Math.PI/2,false); }
    else     { ctx.ellipse(0,0,rx,ry,0,-Math.PI/2,Math.PI/2,true); ctx.arc(0,0,R,Math.PI/2,-Math.PI/2,false); }
    const glow=ctx.createLinearGradient(-R,0,R,0);
    glow.addColorStop(0,"#7af3ff33"); glow.addColorStop(1,"#f3c97a33");
    ctx.fillStyle=glow; ctx.fill();
    ctx.globalCompositeOperation="lighter";
    ctx.beginPath(); ctx.arc(0,0,R*1.01,0,Math.PI*2); ctx.strokeStyle="#7af3ff22"; ctx.lineWidth=2; ctx.stroke();
    ctx.globalCompositeOperation="source-over";
    ctx.restore();

    drawActivity(cx, cy, R, tBreath);
    ctx.beginPath(); ctx.arc(sx,sy,6,0,Math.PI*2); ctx.fillStyle="#f3c97a"; ctx.fill();
  }

  // Public helpers so a bridge can force draw
  function drawMoonPhase(canvasEl, phase){
    if (!canvasEl) return;
    if (canvasEl !== simMoon){
      // simple external draw (no activity/parallax)
      const dpr = Math.max(1, Math.min(devicePixelRatio||1, 3));
      const box = canvasEl.getBoundingClientRect();
      const size = Math.max(220, Math.floor(box.width || 280));
      if (canvasEl.width !== size*dpr || canvasEl.height !== size*dpr){
        canvasEl.width = size*dpr; canvasEl.height = size*dpr;
        const c = canvasEl.getContext("2d"); c.setTransform(dpr,0,0,dpr,0,0);
      }
      // reuse internal context drawing by swapping refs temporarily
      const prev = {ctx, CW, CH};
      ctx = canvasEl.getContext("2d"); CW=canvasEl.width/dpr; CH=canvasEl.height/dpr;
      drawMoonSimToContext(phase.illum, currentSunAngle, performance.now());
      ctx = prev.ctx; CW=prev.CW; CH=prev.CH;
      return;
    }
    drawMoonSimToContext(phase.illum, currentSunAngle, performance.now());
  }
  function getLunarPhase(){
    const tz=(tzPick && tzPick.value)||"UTC";
    const base=new Date();
    const hour= +($("#hourScrub")?.value||0);
    const wall=dateInTZ(base, tz, hour);
    return moonPhase(wall);
  }

  /* ---------------------- Numerology & Kin ------------------------------- */
  const sumDigits = n => String(n).split("").reduce((a,b)=>a+(+b||0),0);
  function reduceNum(n){ while(n>9 && n!==11 && n!==22 && n!==33){ n=sumDigits(n); } return n; }
  function numerology(d, tz){
    const dt = dateInTZ(d, tz);
    const y=dt.getUTCFullYear(), m=dt.getUTCMonth()+1, day=dt.getUTCDate();
    const total  = reduceNum(sumDigits(y)+sumDigits(m)+sumDigits(day));
    const monthN = reduceNum(sumDigits(y)+sumDigits(m));
    const dayN   = reduceNum(sumDigits(day));
    return {total, monthN, dayN};
  }
  function kinFromDate(selUTC, rules){
    const { epochUTC, skipLeapDay, skipDOOT, tz } = rules;
    let count = Math.floor((utcTrunc(selUTC) - utcTrunc(epochUTC)) / 86400000);
    const start = utcTrunc(epochUTC), end = utcTrunc(selUTC);
    for (let d=new Date(start); d < end; d = new Date(d.getTime()+86400000)){
      const isLeap = isLeapDayUTC(d);
      const doot   = isDOOT(d, tz);
      if ((isLeap && skipLeapDay) || (doot && skipDOOT)) count -= 1;
    }
    const kin  = ((count % 260) + 260) % 260 + 1;
    const tone = ((kin-1) % 13) + 1;
    const seal = SEALS[(kin-1) % 20];
    return { kin, tone, seal };
  }

  /* ----------------------------- ICS ------------------------------------ */
  function icsEscape(s){ return String(s).replace(/([,;])/g,"\\$1").replace(/\n/g,"\\n"); }
  function makeICS(spans, tz, titleYear){
    const lines = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Scroll of Fire//13 Moon//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH"];
    spans.forEach((s,i)=>{
      const uid = `sof-13moon-${titleYear}-${i+1}@scroll-of-fire`;
      const dtStart = dateInTZ(s.start, tz);
      const dtEnd   = new Date(s.end.getTime()+86400000);
      const fmt = (d)=> d.toISOString().slice(0,10).replace(/-/g,"");
      lines.push(
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `SUMMARY:${icsEscape(`#${s.m} ${s.name} Moon — ${s.essence}`)}`,
        `DTSTART;VALUE=DATE:${fmt(dtStart)}`,
        `DTEND;VALUE=DATE:${fmt(dtEnd)}`,
        `DESCRIPTION:${icsEscape(`13-Moon: ${s.name} (${s.m}) • ${s.essence} • TZ ${tz}`)}`,
        "END:VEVENT"
      );
    });
    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  }

  /* ------------------------------ UI refs -------------------------------- */
  // Primary hooks
  const nowDate=$("#nowDate"), nowClock=$("#nowClock"), nowTZ=$("#nowTZ");
  const moonName=$("#moonName"), moonEssence=$("#moonEssence"), dayInMoon=$("#dayInMoon");
  const ringArc=$("#moonArc"), ringArcMini=$("#moonArcMini");
  const yearSpan=$("#yearSpan"), dootWarn=$("#dootWarn"), moonLine=$("#moonLine");
  const phaseLine=$("#phaseLine"), phaseMeta=$("#phaseMeta");
  const numLine=$("#numLine"), numMeta=$("#numMeta"), energyQuote=$("#energyQuote");
  const yearMap=$("#yearMap tbody"), nextMoonInfo=$("#nextMoonInfo");
  const datePick=$("#datePick"), hourScrub=$("#hourScrub");
  const weekDots=$("#weekDots");
  const sourceChip=$("#sourceChip");
  const dlICS = $("#dlICS");
  const moonChip = $("#moonChip");
  const jumpMoon = $("#jumpMoon");

  if (weekDots && !weekDots.children.length){
    const frag = document.createDocumentFragment();
    for (let i=0;i<28;i++){ const d=document.createElement("i"); d.className="dot"; d.setAttribute("aria-hidden","true"); frag.appendChild(d); }
    weekDots.appendChild(frag);
  }

  /* ----------------------- URL (scroll-safe) ----------------------------- */
  let lastURLWrite = 0;
  function safeWriteURL(writeFn){
    const now = performance.now();
    if (now - lastURLWrite < 500) return; // throttle
    lastURLWrite = now;
    const x = window.scrollX, y = window.scrollY;
    writeFn();
    requestAnimationFrame(()=>window.scrollTo(x,y));
  }
  function origWriteURL(){
    let u; try{ u=new URL(location.href); }catch(e){ return; }
    if (datePick && validDateStr(datePick.value)) u.searchParams.set("d", datePick.value);
    if (tzPick)   u.searchParams.set("tz", tzPick.value);
    if (hourScrub)u.searchParams.set("t", hourScrub.value);
    history.replaceState(null,"",u);
  }
  function writeURL(){ safeWriteURL(()=>origWriteURL()); }

  /* ------------------------ Moon-specific lore --------------------------- */
  let MOON_DATA = null;
  async function loadMoonData(){
    if (MOON_DATA) return MOON_DATA;
    try{
      const res = await fetch("assets/data/moons.json", {cache:"no-store"});
      MOON_DATA = await res.json();
    }catch(e){ console.warn("moons.json load failed", e); MOON_DATA = []; }
    return MOON_DATA;
  }
  function findMoonData(idx){
    if (!MOON_DATA) return null;
    return MOON_DATA.find(m => +m.idx === +idx) || null;
  }
  const loreHebrew = $("#loreHebrew");
  const lorePsalm  = $("#lorePsalm");
  const loreCodex  = $("#loreCodex");
  const loreEssay  = $("#loreEssay");
  const loreSigil  = $("#loreSigil");
  const practiceList = $("#practiceList");
  const mediaImage = $("#mediaImage");
  const mediaCaption = $("#mediaCaption");
  const mediaAudio = $("#mediaAudio");
  const btnShareImage = $("#btnShareImage");

  function renderCodexForMoon(moonIdx){
    const data = findMoonData(moonIdx) || {};
    if (loreHebrew) loreHebrew.textContent = data.hebrew || "יהוה";
    if (lorePsalm)  lorePsalm.textContent  = data.psalm  || "Let there be lights in the firmament (Gen 1:14).";
    if (loreEssay)  loreEssay.textContent  = data.essay || "";
    if (loreSigil){
      if (data.sigil){ loreSigil.innerHTML = `<img alt="Sigil" src="${data.sigil}" loading="lazy">`; }
      else loreSigil.innerHTML = "";
    }
    if (practiceList){
      const items = Array.isArray(data.practices)? data.practices : [];
      practiceList.innerHTML = items.map(x=>`<li>${String(x)}</li>`).join("") || "<li>Keep the watch. Pray at dawn and dusk.</li>";
    }
    if (mediaImage){
      if (data.image){ mediaImage.setAttribute("src", data.image); mediaImage.removeAttribute("hidden"); }
      else { mediaImage.setAttribute("hidden",""); }
    }
    if (mediaCaption) mediaCaption.textContent = data.caption || "";
    if (mediaAudio){
      if (data.audio){ mediaAudio.innerHTML = `<audio controls preload="none" src="${data.audio}"></audio>`; }
      else mediaAudio.innerHTML = "";
    }
    if (loreCodex){
      const files = Array.isArray(data.files) ? data.files : [];
      loreCodex.innerHTML = files.length
        ? `<ul class="prompts">${files.map(f=>`<li><a href="${f.url}" target="_blank" rel="noopener">${f.title||f.url}</a></li>`).join("")}</ul>`
        : `<div class="hint">No codex files for this moon yet.</div>`;
    }
  }

  /* ----------------------------- Year Map -------------------------------- */
  function buildYearMap(){
    try{
      const tz=tzPick?.value || "UTC";
      if (!datePick || !yearMap) return;
      const selStr = validDateStr(datePick.value) ? datePick.value : dateInTZ(new Date(), tz).toISOString().slice(0,10);
      const sel = new Date(`${selStr}T${pad(+hourScrub?.value || 0)}:00:00Z`);
      const anchor = startOfYear13(sel, tz);
      const spans = yearMoonSpans(anchor, tz);
      const todayStr = dateInTZ(sel, tz).toISOString().slice(0,10);
      yearMap.innerHTML = spans.map(s=>{
        const sStr = dateInTZ(s.start, tz).toISOString().slice(0,10);
        const eStr = dateInTZ(s.end, tz).toISOString().slice(0,10);
        const isNow = todayStr>=sStr && todayStr<=eStr;
        return `<tr class="row ${isNow?'is-today':''}">
          <td>${s.m}</td>
          <td><span class="tag">${s.name}</span></td>
          <td class="meta">${s.essence}</td>
          <td>${fmtDateTZ(dateInTZ(s.start, tz), tz)}</td>
          <td>${fmtDateTZ(dateInTZ(s.end, tz), tz)}</td>
        </tr>`;
      }).join("");
    }catch(e){ crash("year map failed", e); }
  }

  /* --------------------------- Update All -------------------------------- */
  let ringDashTarget = 0, ringDashNow = 0, lastTween = 0;
  function tweenRing(ts){
    if (!ringArc) return;
    if (lastTween===0) lastTween=ts;
    const dt = clamp((ts - lastTween)/500, 0, 1);
    lastTween = ts;
    const t = prefersReduced() ? 1 : (dt<.5? 4*dt*dt*dt : 1 - Math.pow(-2*dt+2,3)/2);
    ringDashNow = ringDashNow + (ringDashTarget - ringDashNow)*t;
    ringArc.setAttribute("stroke-dasharray", `${Math.round(ringDashNow)} ${Math.max(0,316-Math.round(ringDashNow))}`);
    if (Math.abs(ringDashNow - ringDashTarget) > 0.5) requestAnimationFrame(tweenRing);
  }

  function mirrorMiniDash(){
    if (!ringArcMini) return;
    const dash = ringArc?.getAttribute("stroke-dasharray");
    if (dash){
      const used = +dash.split(" ")[0] || 0;
      const mini = Math.round(163 * (used/316));
      ringArcMini.setAttribute("stroke-dasharray", mini + " " + (163-mini));
    }else{
      const dNum = parseInt((dayInMoon?.textContent||"0").replace(/\D/g,''),10) || 0;
      const len = Math.round(163 * (dNum/28));
      ringArcMini.setAttribute("stroke-dasharray", len + " " + (163-len));
    }
  }

  function applyPhaseAccent(illum){
    // Update CSS custom props via gradients already in your HTML
    const mixHex=(a,b,t)=>{
      const pa=parseInt(a.slice(1),16), pb=parseInt(b.slice(1),16);
      const ar=(pa>>16)&255, ag=(pa>>8)&255, ab=pa&255;
      const br=(pb>>16)&255, bg=(pb>>8)&255, bb=pb&255;
      const rr=Math.round(ar+(br-ar)*t), gg=Math.round(ag+(bg-ag)*t), bb2=Math.round(ab+(bb-ab)*t);
      return `#${((1<<24)+(rr<<16)+(gg<<8)+bb2).toString(16).slice(1)}`;
    };
    const cold="#7af3ff", warm="#f3c97a";
    const t = clamp(illum, 0, 1);
    const c1 = mixHex(cold, warm, t*0.7);
    const c2 = mixHex(warm, cold, (1-t)*0.7);
    const setStops=(id,a,b)=>{
      const grad=document.getElementById(id);
      if (!grad) return;
      const stops=grad.querySelectorAll("stop");
      if (stops[0]) stops[0].setAttribute("stop-color", a);
      if (stops[1]) stops[1].setAttribute("stop-color", b);
    };
    setStops("rg", c1, c2);
    setStops("mbGrad", c1, c2);
    document.documentElement.style.setProperty("--moon-accent", c1);
    document.documentElement.style.setProperty("--moon-accent-2", c2);
    document.dispatchEvent(new Event("sof:accent-change"));
  }

  function updateAll(forceTween=false){
    try{
      const tz=tzPick?.value || "UTC";
      const base=new Date();
      const hour = +hourScrub?.value || 0;
      const wall=dateInTZ(base, tz, hour);

      if (nowDate) {
        const long = fmtDateTZ(wall, tz);
        const short = fmtShort(wall, tz) || long;
        nowDate.textContent = long;
        nowDate.setAttribute("data-short", short);
      }
      if (nowClock) nowClock.textContent = fmtTime(base, tz);
      if (nowTZ)    nowTZ.textContent   = tz;

      const selStr = validDateStr(datePick?.value) ? datePick.value : dateInTZ(new Date(), tz).toISOString().slice(0,10);
      const sel = new Date(`${selStr}T${pad(hour)}:00:00Z`);

      const m13 = calc13Moon(sel, tz);
      if (yearSpan) yearSpan.textContent = m13.year;
      if (dootWarn) dootWarn.style.display = m13.special ? "block" : "none";

      if(m13.special){
        if (moonName)    moonName.textContent = m13.special;
        if (moonEssence) moonEssence.textContent = "Outside the 13×28 count";
        if (dayInMoon)   dayInMoon.textContent = "—";
        ringDashTarget = 0;
        if (moonLine)    moonLine.textContent = m13.special;
        if (moonChip)    moonChip.removeAttribute("data-idx");
        if (weekDots){
          [...weekDots.children].forEach(n => n.classList.remove("on"));
          weekDots.setAttribute("aria-label","No week/day (special)");
        }
        if (loreCodex) loreCodex.innerHTML = `<div class="hint">Special day — the Codex rests.</div>`;
      } else {
        const idx=m13.moon-1;
        if (moonName)    moonName.textContent = `${MOONS[idx]} Moon (${m13.moon})`;
        if (moonEssence) moonEssence.textContent = MOON_ESSENCE[idx];
        if (moonChip) {
          moonChip.setAttribute("data-idx", String(m13.moon));
          moonChip.title = `${MOONS[idx]} — ${MOON_ESSENCE[idx]}`;
        }
        if (dayInMoon)   dayInMoon.textContent = String(m13.day);
        ringDashTarget = Math.round(316 * (m13.day/28));
        if (moonLine)    moonLine.textContent = `You are in ${MOONS[idx]} Moon — Day ${m13.day} of 28`;

        if (weekDots){
          const week = Math.floor((m13.day-1)/7)+1, dow = ((m13.day-1)%7)+1;
          const nodes = [...weekDots.children];
          nodes.forEach(n => n.classList.remove("on"));
          const dotIndex = (week-1)*7 + (dow-1);
          if (nodes[dotIndex]) nodes[dotIndex].classList.add("on");
          weekDots.setAttribute("aria-label", `Week ${week}, Day ${dow} (1–7)`);
        }
        if (currentMoonIdx !== m13.moon) buildActivityForMoon(m13.moon);
        renderCodexForMoon(m13.moon);
      }

      if (ringArc){
        if (forceTween || Math.abs(ringDashNow - ringDashTarget) > 2) {
          requestAnimationFrame(ts=>{ lastTween=ts; requestAnimationFrame(tweenRing); });
        } else {
          ringArc.setAttribute("stroke-dasharray", `${ringDashTarget} ${Math.max(0,316-ringDashTarget)}`);
          ringDashNow = ringDashTarget;
        }
        mirrorMiniDash();
      }

      const nu = numerology(sel, tz);
      if (numLine) numLine.textContent = `Universal ${nu.total}`;
      if (numMeta) numMeta.textContent = `Month tone ${nu.monthN} • Day tone ${nu.dayN}`;

      // Quote
      const qIdx = Math.abs(sel.getUTCFullYear()*372 + (sel.getUTCMonth()+1)*31 + sel.getUTCDate()) % QUOTES.length;
      if (energyQuote) energyQuote.textContent = QUOTES[qIdx];

      // Phase + accents
      const ph = moonPhase(dateInTZ(sel, tz, hour));
      if (phaseLine) phaseLine.textContent = `${ph.phase}`;
      if (phaseMeta) phaseMeta.textContent = `Age ≈ ${ph.ageDays.toFixed(1)} d • Illum ≈ ${(ph.illum*100).toFixed(0)}%`;
      applyPhaseAccent(ph.illum);
      currentIllum = ph.illum;
      currentSunAngle = (hour/24) * Math.PI*2;

      buildYearMap();
      const anchor = startOfYear13(sel, tz);
      const spans  = yearMoonSpans(anchor, tz);
      if(nextMoonInfo){
        if(!m13.special){
          const next = spans[m13.moon] || null;
          nextMoonInfo.textContent = next
            ? `Next: ${next.name} Moon starts ${fmtDateTZ(dateInTZ(next.start, tz), tz)}`
            : `This is the Cosmic Moon. New Year begins ${fmtDateTZ(dateInTZ(new Date(Date.UTC(anchor.getUTCFullYear()+1,6,26)), tz), tz)}`;
        } else {
          nextMoonInfo.textContent = `New Year begins ${fmtDateTZ(dateInTZ(new Date(Date.UTC(startOfYear13(sel,tz).getUTCFullYear()+1,6,26)), tz), tz)}`;
        }
      }

      if (dlICS){
        const ics  = makeICS(spans, tz, `${anchor.getUTCFullYear()}/${anchor.getUTCFullYear()+1}`);
        const blob = new Blob([ics], {type:"text/calendar;charset=utf-8"});
        const url  = URL.createObjectURL(blob);
        if (dlICS.dataset._url) URL.revokeObjectURL(dlICS.dataset._url);
        dlICS.href = url;
        dlICS.dataset._url = url;
        dlICS.download = `13-moon-${anchor.getUTCFullYear()}-${anchor.getUTCFullYear()+1}.ics`;
      }

      // announce update
      document.dispatchEvent(new Event("sof:update"));
    }catch(e){ crash("update failed — check console", e); }
  }

  /* ------------------------------ Controls ------------------------------- */
  const btnToday=$("#btnToday"), prevDay=$("#prevDay"), nextDay=$("#nextDay"), shareLink=$("#shareLink");
  on(btnToday,"click",()=>{
    const tz=tzPick?.value || "UTC";
    const t=dateInTZ(new Date(), tz);
    if (datePick)   datePick.value=t.toISOString().slice(0,10);
    if (hourScrub)  hourScrub.value = new Date().getHours();
    writeURL(); updateAll(true);
  });
  on(prevDay,"click",()=>{
    if (!datePick || !validDateStr(datePick.value)) return;
    const d=new Date(datePick.value+"T00:00:00Z"); d.setUTCDate(d.getUTCDate()-1);
    datePick.value=d.toISOString().slice(0,10); writeURL(); updateAll(true);
  });
  on(nextDay,"click",()=>{
    if (!datePick || !validDateStr(datePick.value)) return;
    const d=new Date(datePick.value+"T00:00:00Z"); d.setUTCDate(d.getUTCDate()+1);
    datePick.value=d.toISOString().slice(0,10); writeURL(); updateAll(true);
  });
  on(shareLink,"click",()=>{
    writeURL();
    safe(()=> navigator.clipboard.writeText(location.href));
    const t=document.createElement("div"); t.className="toast"; t.textContent="Link copied";
    document.body.appendChild(t); requestAnimationFrame(()=>t.style.opacity=1);
    setTimeout(()=>{t.style.opacity=0; setTimeout(()=>t.remove(),250);},1800);
  });
  on(datePick, "change", ()=>{ writeURL(); updateAll(true); }, {passive:true});
  on(hourScrub, "input", ()=>{ writeURL(); updateAll(true); }, {passive:true});
  on(hourScrub, "wheel", (e)=>{
    e.preventDefault();
    const dir = Math.sign(e.deltaY);
    const v = clamp((+hourScrub.value||0) + dir, 0, 23);
    hourScrub.value = v; writeURL(); updateAll(true);
  }, {passive:false});
  on(document, "keydown", (e)=>{
    if (e.altKey || e.metaKey || e.ctrlKey) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight"){
      const delta = e.key === "ArrowRight" ? 1 : -1;
      if (hourScrub){
        const v = clamp((+hourScrub.value||0) + delta, 0, 23);
        hourScrub.value = v; writeURL(); updateAll(true);
      }
      e.preventDefault();
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown"){
      if (!datePick || !validDateStr(datePick.value)) return;
      const d=new Date(datePick.value+"T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + (e.key==="ArrowUp"? 1 : -1));
      datePick.value=d.toISOString().slice(0,10); writeURL(); updateAll(true);
      e.preventDefault();
    }
  });

  // Go-to moon quick jump
  on(jumpMoon, "change", ()=>{
    const val = parseInt(jumpMoon.value, 10);
    const tz = (tzPick && tzPick.value) || "UTC";
    if (!val || Number.isNaN(val)) return;
    // compute current year's spans and go to start of that moon
    const selStr = validDateStr(datePick?.value) ? datePick.value : dateInTZ(new Date(), tz).toISOString().slice(0,10);
    const sel = new Date(`${selStr}T00:00:00Z`);
    const anchor = startOfYear13(sel, tz);
    const spans = yearMoonSpans(anchor, tz);
    const span = spans[val-1];
    if (span){
      const key = dateInTZ(span.start, tz).toISOString().slice(0,10);
      datePick.value = key; writeURL(); updateAll(true);
    }
    jumpMoon.value = "";
  }, {passive:true});

  // Live clock / tick
  setInterval(()=>{
    if (nowClock && tzPick) nowClock.textContent = fmtTime(new Date(), tzPick.value);
    if (!tzPick || !datePick) return;
    const tz=tzPick.value;
    const today = dateInTZ(new Date(), tz).toISOString().slice(0,10);
    if(datePick.value === today){ updateAll(); }
    document.dispatchEvent(new Event("sof:tick"));
  }, 1000);

  // Animation loop for lunar canvas
  let raf=0, animVisible=true, docHidden=false;
  function loop(ts){
    if (!simMoon){ cancelAnimationFrame(raf); return; }
    if (!animVisible || docHidden){ raf=requestAnimationFrame(loop); return; }
    drawMoonSimToContext(currentIllum, currentSunAngle, ts);
    raf=requestAnimationFrame(loop);
  }
  const simIO = ("IntersectionObserver" in window) && simMoon
    ? new IntersectionObserver(([e])=>{ animVisible = !!(e && e.isIntersecting); })
    : null;
  simIO && simIO.observe(simMoon);
  on(document, "visibilitychange", ()=>{ docHidden = document.hidden; });
  raf=requestAnimationFrame(loop);

  // Initial URL read
  function readURL(){
    let u; try{ u=new URL(location.href); }catch(e){ return; }
    const d=u.searchParams.get("d");
    const z=u.searchParams.get("tz");
    const h=u.searchParams.get("t");
    if(z && tzPick){ tzPick.value=z; safe(()=> localStorage.setItem(TZ_KEY,z)); }
    const tz = (tzPick&&tzPick.value) || "UTC";
    if (datePick){
      if (d && validDateStr(d)) datePick.value=d;
      else datePick.value=dateInTZ(new Date(), tz).toISOString().slice(0,10);
    }
    if (hourScrub){
      const curHour = new Date().getHours();
      hourScrub.value = (h!=null && !Number.isNaN(+h)) ? clamp(+h,0,23) : curHour;
    }
  }

  // Astro: hide panel if no ephemeris
  function hasEphemeris(){
    // Allow you to set window.__EPHEMERIS__ = { ... } later
    return !!(window.__EPHEMERIS__ && typeof window.__EPHEMERIS__ === "object");
  }
  function maybeHideAstro(){
    const host = $(".astro");
    if (!host) return;
    if (!hasEphemeris()){
      host.setAttribute("hidden","hidden");
      host.style.display = "none";
    }
  }

  // Boot
  try{
    readURL();
    if (tzPick && !tzPick.options.length){
      tzPick.innerHTML = COMMON_TZ.map(z=>`<option value="${z}">${z}</option>`).join("");
      tzPick.value = "UTC";
    }
    loadMoonData().finally(()=>{
      updateAll(true);
      buildYearMap();
      maybeHideAstro();
      // first mini dash mirror in case ring tween hasn't run yet
      mirrorMiniDash();
    });
  }catch(e){ crash("init failed", e); }

  // Expose a small core API for other scripts
  window.__sof_core__ = {
    // date helpers
    dateInTZ, fmtDate: fmtDateTZ, fmtShort, pad, startOfYear13, yearMoonSpans, addDaysSkippingSpecials, validDateStr,
    // lifecycle
    writeURL, updateAll,
    // lunar helpers for bridges
    drawMoonPhase, getLunarPhase,
    // ephemeris check
    hasEphemeris
  };

})();

/* ========================================================================
   Calendars module: Remnant + Gregorian
   (kept separate for clarity; uses __sof_core__ APIs)
   ======================================================================== */
(function(){
  "use strict";
  const $  =(s,r=document)=>r.querySelector(s);
  const on =(t,e,f,o)=>t&&t.addEventListener(e,f,o);
  const safe = fn => { try{ return fn(); } catch(e){ console.warn("[Moons-Cal]",e); return void 0; } };

  const core = window.__sof_core__ || {};
  const {
    dateInTZ, fmtDate, fmtShort, pad,
    startOfYear13, yearMoonSpans, addDaysSkippingSpecials, validDateStr,
    writeURL, updateAll
  } = core;

  const tzPick = $("#tzPick");
  const datePick = $("#datePick");
  const hourScrub = $("#hourScrub");
  const ymd = (d,tz)=> dateInTZ(d,tz).toISOString().slice(0,10);

  const getEv = (store, key)=> Array.isArray(store?.[key]) ? store[key] : [];
  const cellButton=()=>{ const b=document.createElement('button'); b.type='button'; b.className='cal__cell'; return b; };
  const chip=(txt,cls="chip")=>{ const s=document.createElement('span'); s.className=cls; s.textContent=txt; return s; };

  function buildRemnantMonth(sel, tz){
    const wrap = document.getElementById('remCal');
    const remHdr=document.getElementById('remHdr');
    const remMeta=document.getElementById('remMeta');
    if (!wrap || !startOfYear13) return;
    wrap.innerHTML = '';

    const anchor = startOfYear13(sel, tz);
    const spans = yearMoonSpans(anchor, tz);

    const idx = (function(){
      for (let i=0;i<spans.length;i++){
        const s=spans[i];
        const start = dateInTZ(s.start, tz).toISOString().slice(0,10);
        const end   = dateInTZ(s.end, tz).toISOString().slice(0,10);
        const cur   = ymd(sel, tz);
        if (cur>=start && cur<=end) return i;
      }
      return 0;
    })();

    const span = spans[idx];
    const start = span.start, end = span.end;

    const labels=document.createElement('div'); labels.className='cal__labels';
    ["D1","D2","D3","D4","D5","D6","D7"].forEach(l=>{
      const el=document.createElement('div'); el.className='cal__label'; el.textContent=l; labels.appendChild(el);
    });

    const grid=document.createElement('div'); grid.className='cal__grid cal__grid--remnant';
    let d = new Date(start);
    for(let r=0;r<4;r++){
      for(let c=0;c<7;c++){
        const key=ymd(d,tz);
        const isSel = (key === ymd(sel,tz));
        const weekend = (c===0 || c===6);
        const btn = cellButton();
        if (weekend) btn.classList.add('is-weekend');
        if (isSel)   btn.classList.add('is-today');

        const top=document.createElement('div'); top.className='cal__top';
        top.appendChild(chip(`D${r*7+c+1}`));
        const sub=document.createElement('div'); sub.className='cal__sub mono';
        sub.textContent = fmtShort(d, tz) || key;
        btn.appendChild(top); btn.appendChild(sub);

        const evs = getEv(window.REMNANT_EVENTS, key);
        if (evs.length){
          const dots=document.createElement('div'); dots.className='cal__dots';
          evs.slice(0,2).forEach(e=>{
            const i=document.createElement('i'); i.className='dot';
            if (e.type) i.setAttribute('data-type', e.type);
            dots.appendChild(i);
          });
          btn.appendChild(dots);
          const ul=document.createElement('ul'); ul.className='cal__list';
          evs.slice(0,3).forEach(e=>{
            const li=document.createElement('li');
            li.textContent = (e.at? `${e.at} `:'')+(e.title||'Event');
            ul.appendChild(li);
          });
          btn.appendChild(ul);
        }

        btn.setAttribute('aria-label', `Remnant day ${r*7+c+1}; Gregorian ${fmtDate(d, tz)}`);
        btn.addEventListener('click', ()=>{
          if (datePick){ datePick.value = key; writeURL && writeURL(); updateAll && updateAll(true); }
        }, {passive:true});

        grid.appendChild(btn);
        d = addDaysSkippingSpecials(d, 1, tz);
      }
    }

    wrap.classList.add('cal','cal--remnant');
    wrap.appendChild(labels);
    wrap.appendChild(grid);

    if (remHdr)  remHdr.textContent = `${span.m}. ${span.name} — ${span.essence}`;
    if (remMeta) remMeta.textContent= `${fmtDate(start, tz)} → ${fmtDate(end, tz)} • 13×28 fixed`;
  }

  function buildGregorianMonth(sel, tz){
    const wrap = document.getElementById('gregCal');
    const gregHdr=document.getElementById('gregHdr');
    const gregMeta=document.getElementById('gregMeta');
    const legend=document.getElementById('calLegend');
    if (!wrap || !fmtDate) return;
    wrap.innerHTML = '';

    const base = dateInTZ(sel, tz);
    const y = base.getUTCFullYear(), m = base.getUTCMonth();
    const first = new Date(Date.UTC(y,m,1));
    const firstDow = first.getUTCDay();
    const gridStart = new Date(Date.UTC(y,m,1 - firstDow));

    const labels=document.createElement('div'); labels.className='cal__labels';
    ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].forEach(l=>{
      const el=document.createElement('div'); el.className='cal__label'; el.textContent=l; labels.appendChild(el);
    });

    const grid=document.createElement('div'); grid.className='cal__grid cal__grid--greg';
    let d = new Date(gridStart);
    for (let i=0; i<42; i++){
      const key = ymd(d, tz);
      const thisMonth = (d.getUTCMonth()===m);
      const isToday = (key === ymd(new Date(), tz));
      const weekend = (d.getUTCDay()===0 || d.getUTCDay()===6);
      const evs = getEv(window.GREG_EVENTS, key);

      const btn = cellButton();
      if (!thisMonth) btn.classList.add('is-other');
      if (weekend)    btn.classList.add('is-weekend');
      if (isToday)    btn.classList.add('is-today');

      const top=document.createElement('div'); top.className='cal__top';
      top.appendChild(chip(String(d.getUTCDate()).padStart(2,'0')));
      const sub=document.createElement('div'); sub.className='cal__sub meta';
      sub.textContent = new Intl.DateTimeFormat(undefined,{month:'short', timeZone:tz}).format(d);
      btn.appendChild(top); btn.appendChild(sub);

      if (evs.length){
        const dots=document.createElement('div'); dots.className='cal__dots';
        evs.slice(0,2).forEach(e=>{
          const i=document.createElement('i'); i.className='dot';
          if (e.type) i.setAttribute('data-type', e.type);
          dots.appendChild(i);
        });
        btn.appendChild(dots);

        const ul=document.createElement('ul'); ul.className='cal__list';
        evs.slice(0,3).forEach(e=>{
          const li=document.createElement('li');
          li.textContent = (e.at? `${e.at} `:'')+(e.title||'Event');
          ul.appendChild(li);
        });
        btn.appendChild(ul);
      }

      btn.setAttribute('aria-label', `Gregorian ${fmtDate(d, tz)}`);
      btn.addEventListener('click', ()=>{
        if (datePick){ datePick.value = key; writeURL && writeURL(); updateAll && updateAll(true); }
      }, {passive:true});

      grid.appendChild(btn);
      d.setUTCDate(d.getUTCDate()+1);
    }

    wrap.classList.add('cal','cal--greg');
    wrap.appendChild(labels);
    wrap.appendChild(grid);

    if (gregHdr){
      const monthName = new Intl.DateTimeFormat(undefined,{month:'long', year:'numeric', timeZone:tz}).format(first);
      gregHdr.textContent = monthName;
    }
    if (gregMeta) gregMeta.textContent = '6×7 grid • weekends/today highlighted';

    if (legend){
      legend.innerHTML = `
        <span class="legend__item"><i class="dot"></i> event</span>
        <span class="legend__item"><i class="dot" data-type="ceremony"></i> ceremony</span>
        <span class="legend__item"><i class="dot" data-type="remnant"></i> remnant</span>
        <span class="legend__item badge is-today">today</span>
        <span class="legend__item badge is-weekend">weekend</span>
        <span class="legend__item badge is-other">other month</span>
      `;
    }
  }

  function buildCalendars(){
    const tz = (tzPick && tzPick.value) || 'UTC';
    const selStr = (datePick && validDateStr(datePick.value)) ? datePick.value : ymd(new Date(), tz);
    const sel = new Date(`${selStr}T${pad(+hourScrub?.value || 0)}:00:00Z`);
    safe(()=> buildRemnantMonth(sel, tz));
    safe(()=> buildGregorianMonth(sel, tz));

    const prevMoon=$("#prevMoon"), nextMoon=$("#nextMoon");
    if (prevMoon && !prevMoon._wired){
      prevMoon._wired=true;
      prevMoon.addEventListener('click', ()=>{
        const tz=(tzPick && tzPick.value) || 'UTC';
        if (!datePick) return;
        let d=new Date(`${(datePick.value||ymd(new Date(),tz))}T00:00:00Z`);
        for (let i=0;i<28;i++) d = addDaysSkippingSpecials(d, -1, tz);
        datePick.value = ymd(d, tz);
        writeURL && writeURL(); updateAll && updateAll(true); buildCalendars();
      }, {passive:true});
    }
    if (nextMoon && !nextMoon._wired){
      nextMoon._wired=true;
      nextMoon.addEventListener('click', ()=>{
        const tz=(tzPick && tzPick.value) || 'UTC';
        if (!datePick) return;
        let d=new Date(`${(datePick.value||ymd(new Date(),tz))}T00:00:00Z`);
        for (let i=0;i<28;i++) d = addDaysSkippingSpecials(d, 1, tz);
        datePick.value = ymd(d, tz);
        writeURL && writeURL(); updateAll && updateAll(true); buildCalendars();
      }, {passive:true});
    }
  }

  window.buildCalendars = buildCalendars;
  on(datePick, "change", buildCalendars, {passive:true});
  on(hourScrub, "input",  buildCalendars, {passive:true});
  on(tzPick,    "change", buildCalendars, {passive:true});
  requestAnimationFrame(buildCalendars);
})();
