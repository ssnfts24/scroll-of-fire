/* 13 Moons — Living Clock (advanced, DPR-aware, phase-tinted, v3.7) */
(function(){
  "use strict";

  /* ===================== Tiny utils ===================== */
  const $  =(s,r=document)=>r.querySelector(s);
  const $$ =(s,r=document)=>Array.from(r.querySelectorAll(s));
  const on =(t,e,f,o)=>t&&t.addEventListener(e,f,o);
  const pad=n=>String(n).padStart(2,"0");
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
  const lerp=(a,b,t)=>a+(b-a)*t;
  const ease=(t)=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2; // cubic in/out
  const safe = fn => { try{ return fn(); } catch(e){ console.warn("[Moons]",e); return void 0; } };
  const prefersReduced = ()=> (typeof matchMedia==="function") && matchMedia("(prefers-reduced-motion: reduce)").matches;

  const crash=(msg,err)=>{
    console.error("[Moons crash]", msg, err);
    const n=document.createElement("div");
    n.style.cssText="position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:99999;background:#230b0b;color:#ffd7d7;border:1px solid #712828;padding:8px 10px;border-radius:10px;font:600 13px/1.3 Inter";
    n.textContent="Moons: "+msg;
    document.body.appendChild(n);
  };

  /* Footer year */
  safe(()=> $("#yr") && ($("#yr").textContent=new Date().getFullYear()));

  /* ===================== Data ===================== */
  const MOONS = ["Magnetic","Lunar","Electric","Self-Existing","Overtone","Rhythmic","Resonant","Galactic","Solar","Planetary","Spectral","Crystal","Cosmic"];
  const MOON_ESSENCE = ["Attract purpose","Stabilize challenge","Activate service","Define form","Empower radiance","Balance equality","Channel inspiration","Harmonize integrity","Pulse intention","Perfect manifestation","Dissolve release","Dedicate cooperation","Endure presence"];
  const QUOTES = [
    "“Teach us to number our days, that we may apply our hearts unto wisdom.” — Psalm 90:12",
    "“For everything there is a season…” — Ecclesiastes 3:1",
    "“The light shines in the darkness, and the darkness has not overcome it.” — John 1:5",
    "“In quietness and trust is your strength.” — Isaiah 30:15",
    "“He heals the brokenhearted and binds up their wounds.” — Psalm 147:3"
  ];
  const SEALS = ["Red Dragon","White Wind","Blue Night","Yellow Seed","Red Serpent","White Worldbridger","Blue Hand","Yellow Star","Red Moon","White Dog","Blue Monkey","Yellow Human","Red Skywalker","White Wizard","Blue Eagle","Yellow Warrior","Red Earth","White Mirror","Blue Storm","Yellow Sun"];

  /* ===================== TZ setup ===================== */
  const TZ_KEY="sof_moons_tz";
  const tzPick = $("#tzPick");
  const COMMON_TZ = ["UTC","America/Los_Angeles","America/Denver","America/Chicago","America/New_York","Europe/London","Europe/Berlin","Europe/Helsinki","Africa/Johannesburg","Asia/Dubai","Asia/Kolkata","Asia/Shanghai","Asia/Tokyo","Australia/Sydney"];
  let defaultTZ = safe(()=> localStorage.getItem(TZ_KEY)) || safe(()=>Intl.DateTimeFormat().resolvedOptions().timeZone) || "UTC";

  let ALL_TZ = COMMON_TZ.slice(0);
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
    on(tzPick,"change",()=>{ safe(()=> localStorage.setItem(TZ_KEY, tzPick.value)); writeURL(); updateAll(true); buildYearMap(); }, {passive:true});
  }

  /* ===================== Date helpers ===================== */
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
  const fmtDate=(d,tz)=> safe(()=> new Intl.DateTimeFormat(undefined,{dateStyle:"full", timeZone:tz}).format(d))
                       || new Intl.DateTimeFormat(undefined,{weekday:"long", year:"numeric", month:"long", day:"numeric", timeZone:tz}).format(d);
  const fmtTime=(d,tz)=> safe(()=> new Intl.DateTimeFormat(undefined,{timeStyle:"medium", timeZone:tz}).format(d))
                       || new Intl.DateTimeFormat(undefined,{hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false, timeZone:tz}).format(d);
  const utcTrunc = (d)=> new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const validDateStr = s => /^\d{4}-\d{2}-\d{2}$/.test(s);

  /* ===================== 13-Moon math ===================== */
  const isLeapYear   = y=> (y%4===0 && y%100!==0) || (y%400===0);
  const isLeapDayUTC = d=> d.getUTCMonth()===1 && d.getUTCDate()===29;
  const isDOOT = (d, tz)=>{ const dt=dateInTZ(d,tz); return (dt.getUTCMonth()===6 && dt.getUTCDate()===25); };

  function startOfYear13(d, tz){
    const dt = dateInTZ(d, tz);
    const y = dt.getUTCFullYear();
    const anchorThis = new Date(Date.UTC(y,6,26));
    const anchorPrev = new Date(Date.UTC(y-1,6,26));
    return dt >= anchorThis ? anchorThis : anchorPrev;
  }
  function addDaysSkippingSpecials(start, n, tz){
    let d = new Date(start); let moved = 0;
    while(moved < n){
      d = new Date(d.getTime()+86400000);
      if (isDOOT(d,tz) || isLeapDayUTC(d)) continue;
      moved++;
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

  /* ===================== Phase + sim ===================== */
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
    const phase = (names.find(x=> frac>=x.r[0] && frac<x.r[1])||{}).n || "—";
    return {phase, ageDays, illum, frac};
  }

  /* DPR-aware canvas with ResizeObserver */
  const simMoon = $("#simMoon");
  let ctx=null, DPR=1, CW=0, CH=0;
  function sizeCanvas(){
    if (!simMoon) return;
    DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const rect = simMoon.getBoundingClientRect();
    const w = Math.max(300, Math.round(rect.width));
    const h = Math.max(220, Math.round(rect.height || rect.width*0.6));
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
  }

  /* Parallax control */
  let pointerX = 0, pointerY = 0, parallax = 0;
  if (simMoon){
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

  function drawMoonSim(illum, sunAngle, tBreath){
    if (!ctx) return;
    const W=CW, H=CH;
    ctx.clearRect(0,0,W,H);

    // Background grad with gentle aurora shimmer
    const g=ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,"#0a0e15"); g.addColorStop(1,"#06080d");
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);

    // Parallax offset
    const offX = parallax ? pointerX*8 : 0;
    const offY = parallax ? pointerY*6 : 0;

    // Moon body
    const cx=W/2 + offX, cy=H/2 + offY;
    const R=Math.min(W,H)*0.32 * (1 + 0.015*Math.sin(tBreath*0.0016)); // tiny breath
    const sx = cx + Math.cos(sunAngle)*R*1.7;
    const sy = cy - Math.sin(sunAngle)*R*1.7;

    // Core sphere
    ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2);
    const body=ctx.createRadialGradient(cx,cy-R*0.65,R*0.2, cx,cy,R*1.05);
    body.addColorStop(0, "#1a2130"); body.addColorStop(1, "#0e131c");
    ctx.fillStyle=body; ctx.fill();

    // Terminator shape
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

    // “Sun” dot
    ctx.beginPath(); ctx.arc(sx,sy,6,0,Math.PI*2); ctx.fillStyle="#f3c97a"; ctx.fill();
  }

  /* ===================== Numerology & Kin ===================== */
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

  /* ===================== ICS ===================== */
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

  /* ===================== UI refs ===================== */
  /* Content registry (lazy-loaded) */
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

/* New UI refs */
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
const btnSaveNote   = $("#btnSaveNote");

/* Tiny store per browser (notes per moon) */
const noteKey = idx => `sof_moon_note_${idx}`;
  const nowDate=$("#nowDate"), nowClock=$("#nowClock"), nowTZ=$("#nowTZ");
  const moonName=$("#moonName"), moonEssence=$("#moonEssence"), dayInMoon=$("#dayInMoon");
  const ringArc=$("#moonArc");
  const yearSpan=$("#yearSpan"), dootWarn=$("#dootWarn"), moonLine=$("#moonLine");
  const phaseLine=$("#phaseLine"), phaseMeta=$("#phaseMeta");
  const numLine=$("#numLine"), numMeta=$("#numMeta"), energyQuote=$("#energyQuote");
  const yearMap=$("#yearMap tbody"), nextMoonInfo=$("#nextMoonInfo");
  const datePick=$("#datePick"), hourScrub=$("#hourScrub");
  const weekDots=$("#weekDots");
  const sourceChip=$("#sourceChip");
  const skyBg=$("#skyBg");
  const dlICS = $("#dlICS");
  const moonChip = $("#moonChip");

  // Kin opts
  const kinOn = $("#kinOn"), kinEpoch = $("#kinEpoch"), kinSkipLeap = $("#kinSkipLeap"), kinSkipDOOT = $("#kinSkipDOOT");
  const kinBadge = $("#kinBadge"), kinLine = $("#kinLine");

  /* Build week dots once */
  if (weekDots && !weekDots.children.length){
    const frag = document.createDocumentFragment();
    for (let i=0;i<28;i++){ const d=document.createElement("i"); d.className="dot"; d.setAttribute("aria-hidden","true"); frag.appendChild(d); }
    weekDots.appendChild(frag);
  }

  /* ===================== URL sync ===================== */
  function readURL(){
    let u;
    try{ u=new URL(location.href); }catch(e){ return; }
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
  function writeURL(){
    let u; try{ u=new URL(location.href); }catch(e){ return; }
    if (datePick && validDateStr(datePick.value)) u.searchParams.set("d", datePick.value);
    if (tzPick)   u.searchParams.set("tz", tzPick.value);
    if (hourScrub)u.searchParams.set("t", hourScrub.value);
    history.replaceState(null,"",u);
  }

  /* ===================== Sky (animated) ===================== */
  (function initSky(){
    if (!skyBg) return;
    const RM = prefersReduced();
    const c = skyBg, k = c.getContext("2d"); if(!k) return;

    function size(){
      c.width = innerWidth;
      c.height = Math.max(320, Math.round(innerHeight*0.45));
    }
    size();
    on(window,"resize", size, {passive:true});

    const stars = Array.from({length: 150}, ()=>({
      x: Math.random()*c.width,
      y: Math.random()*c.height,
      r: Math.random()*1.2 + 0.3,
      p: Math.random()*Math.PI*2,
      s: 0.006 + Math.random()*0.012
    }));

    let rafId=0, visible=true;
    function tick(ts){
      if (!visible) return;
      k.clearRect(0,0,c.width,c.height);
      const bg=k.createLinearGradient(0,0,0,c.height);
      bg.addColorStop(0,"#05060b"); bg.addColorStop(1,"#0b0e14");
      k.fillStyle=bg; k.fillRect(0,0,c.width,c.height);

      if (!RM){
        const g=k.createLinearGradient(0,0,c.width,0);
        g.addColorStop(0, "rgba(122,243,255,0.085)");
        g.addColorStop(0.5,"rgba(243,201,122,0.05)");
        g.addColorStop(1, "rgba(177,140,255,0.085)");
        k.fillStyle=g; const y = 40 + Math.sin(ts*0.0005)*16;
        k.beginPath(); k.moveTo(0, y+8);
        for(let x=0;x<=c.width;x+=18){ const yy = y + Math.sin((ts*0.001) + x*0.01)*8; k.lineTo(x, yy); }
        k.lineTo(c.width,0); k.lineTo(0,0); k.closePath(); k.fill();
      }
      stars.forEach(s=>{
        const a = (Math.sin(s.p + ts*s.s)*0.5 + 0.5)*0.9 + 0.1;
        k.globalAlpha = a; k.beginPath(); k.arc(s.x, s.y, s.r, 0, Math.PI*2); k.fillStyle="#cfe9ff"; k.fill();
      });
      k.globalAlpha = 1;
      rafId = requestAnimationFrame(tick);
    }
    const io = ("IntersectionObserver" in window) ? new IntersectionObserver(([e])=>{
      visible = e && e.isIntersecting;
      if (visible){ cancelAnimationFrame(rafId); rafId=requestAnimationFrame(tick); }
    }) : null;
    io && io.observe(c);

    let hidden=false;
    on(document,"visibilitychange", ()=>{ hidden=document.hidden; if (!hidden){ cancelAnimationFrame(rafId); rafId=requestAnimationFrame(tick);} });

    rafId=requestAnimationFrame(tick);
  })();

  /* ===================== Phase-driven accents + widget contrast ===================== */
  function setGradientStops(defId, c1, c2){
    const grad = document.getElementById(defId);
    if (!grad) return;
    const stops = grad.querySelectorAll("stop");
    if (stops[0]) stops[0].setAttribute("stop-color", c1);
    if (stops[1]) stops[1].setAttribute("stop-color", c2);
  }
  function mixHex(a,b,t){
    const pa=parseInt(a.slice(1),16), pb=parseInt(b.slice(1),16);
    const ar=(pa>>16)&255, ag=(pa>>8)&255, ab=pa&255;
    const br=(pb>>16)&255, bg=(pb>>8)&255, bb=pb&255;
    const rr=Math.round(ar+(br-ar)*t), gg=Math.round(ag+(bg-ag)*t), bb2=Math.round(ab+(bb-ab)*t);
    return `#${((1<<24)+(rr<<16)+(gg<<8)+bb2).toString(16).slice(1)}`;
  }
  function applyPhaseAccent(illum){
    const cold = "#7af3ff", warm = "#f3c97a";
    const t = clamp(illum, 0, 1);
    const c1 = mixHex(cold, warm, t*0.7);
    const c2 = mixHex(warm, cold, (1-t)*0.7);
    setGradientStops("rg", c1, c2);
    setGradientStops("mbGrad", c1, c2);
    const root = document.documentElement;
    root.style.setProperty("--moon-accent",  c1);
    root.style.setProperty("--moon-accent-2",c2);
    // tell widget to re-evaluate contrast
    updateWidgetContrast();
    document.dispatchEvent(new Event("sof:accent-change"));
  }

  // Auto-contrast for .moonbar text (Share/TZ/tags) so letters stay readable
  const parseColor = (s) => {
    if (!s) return null;
    s=s.trim();
    if (s.startsWith("#")){
      const v = s.length===4
        ? "#"+s[1]+s[1]+s[2]+s[2]+s[3]+s[3]
        : s;
      const n=parseInt(v.slice(1),16);
      return {r:(n>>16)&255,g:(n>>8)&255,b:n&255};
    }
    const m = s.match(/rgba?\(([^)]+)\)/i);
    if (m){
      const [r,g,b]=m[1].split(",").map(x=>parseFloat(x));
      return {r,g,b};
    }
    return null;
  };
  const relLuma = ({r,g,b})=>{
    const t = [r,g,b].map(v=>{
      v/=255; return (v<=0.03928)? v/12.92 : Math.pow((v+0.055)/1.055,2.4);
    });
    return 0.2126*t[0]+0.7152*t[1]+0.0722*t[2];
  };
// Auto-contrast for .moonbar text (Share/TZ/tags)
// Keep mini bar text light; don't auto-darken on bright accents unless you want to.
function updateWidgetContrast(){
  const bar = document.querySelector(".moonbar");
  if (!bar) return;

  // Current behavior: always keep light text
  bar.classList.remove("contrast-light");

  // If you want automatic contrast instead, uncomment below:
  // const styles = getComputedStyle(document.documentElement);
  // const accent = styles.getPropertyValue("--moon-accent") || "#7af3ff";
  // const rgb = parseColor(accent) || {r:122,g:243,b:255};
  // const L = relLuma(rgb);
  // bar.classList.toggle("contrast-light", L > 0.65);
}
    const styles = getComputedStyle(document.documentElement);
    const accent = styles.getPropertyValue("--moon-accent") || "#7af3ff";
    const rgb = parseColor(accent) || {r:122,g:243,b:255};
    const L = relLuma(rgb);
    // Bright accent -> use dark text for contrast
    bar.classList.toggle("contrast-light", L > 0.65);
  }

  /* ===================== Rendering pipeline ===================== */
  let ringDashTarget = 0, ringDashNow = 0, lastTween = 0;

  function tweenRing(ts){
    if (!ringArc) return;
    if (lastTween===0) lastTween=ts;
    const dt = clamp((ts - lastTween)/500, 0, 1);
    lastTween = ts;
    const t = prefersReduced() ? 1 : ease(dt);
    ringDashNow = lerp(ringDashNow, ringDashTarget, t);
    ringArc.setAttribute("stroke-dasharray", `${Math.round(ringDashNow)} ${Math.max(0,316-Math.round(ringDashNow))}`);
    if (Math.abs(ringDashNow - ringDashTarget) > 0.5) requestAnimationFrame(tweenRing);
  }

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
          <td>${fmtDate(dateInTZ(s.start, tz), tz)}</td><td>${fmtDate(dateInTZ(s.end, tz), tz)}</td>
        </tr>`;
      }).join("");
    }catch(e){ crash("year map failed", e); }
  }

  /* ===================== Main update ===================== */
  let currentIllum = 0, currentSunAngle = 0;

  function updateAll(forceTween=false){
    try{
      const tz=tzPick?.value || "UTC";
      const base=new Date();
      const hour = +hourScrub?.value || 0;
      const wall=dateInTZ(base, tz, hour);

      $("#nowDate") && (nowDate.textContent = fmtDate(wall, tz));
      $("#nowClock") && (nowClock.textContent = fmtTime(base, tz));
      $("#nowTZ")    && (nowTZ.textContent   = tz);

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
      } else {
        const idx=m13.moon-1;
        // Visible title with explicit "(n)"
        if (moonName)    moonName.textContent = `${MOONS[idx]} Moon (${m13.moon})`;
        if (moonEssence) moonEssence.textContent = MOON_ESSENCE[idx];
        if (moonChip) {
          moonChip.setAttribute("data-idx", String(m13.moon));          // CSS also appends " (n)" after .k
          moonChip.title = `${MOONS[idx]} — ${MOON_ESSENCE[idx]}`;      // tooltip
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
      }

      if (ringArc){
        if (forceTween || Math.abs(ringDashNow - ringDashTarget) > 2) {
          requestAnimationFrame(ts=>{ lastTween=ts; requestAnimationFrame(tweenRing); });
        } else {
          ringArc.setAttribute("stroke-dasharray", `${ringDashTarget} ${Math.max(0,316-ringDashTarget)}`);
          ringDashNow = ringDashTarget;
        }
      }

      // Numerology
      const nu = numerology(sel, tz);
      if (numLine) numLine.textContent = `Universal ${nu.total}`;
      if (numMeta) numMeta.textContent = `Month tone ${nu.monthN} • Day tone ${nu.dayN}`;
      const resonant = [1,4,7,11,22,33].includes(nu.total);
      if (sourceChip) sourceChip.style.boxShadow = resonant
        ? "0 0 0 1px #7af3ff55, 0 8px 28px #7af3ff22"
        : "none";

      // Daily quote
      const qIdx = Math.abs(sel.getUTCFullYear()*372 + (sel.getUTCMonth()+1)*31 + sel.getUTCDate()) % QUOTES.length;
      if (energyQuote) energyQuote.textContent = QUOTES[qIdx];

      // Phase + accents + sim
      const ph = moonPhase(dateInTZ(sel, tz, hour));
      if (phaseLine) phaseLine.textContent = `${ph.phase}`;
      if (phaseMeta) phaseMeta.textContent = `Age ≈ ${ph.ageDays.toFixed(1)} d • Illum ≈ ${(ph.illum*100).toFixed(0)}%`;
      applyPhaseAccent(ph.illum);
      currentIllum = ph.illum;
      currentSunAngle = (hour/24) * Math.PI*2;

      // Rebuild list + next moon
      buildYearMap();
      const anchor = startOfYear13(sel, tz);
      const spans  = yearMoonSpans(anchor, tz);
      if(nextMoonInfo){
        if(!m13.special){
          const next = spans[m13.moon] || null;
          nextMoonInfo.textContent = next
            ? `Next: ${next.name} Moon starts ${fmtDate(dateInTZ(next.start, tz), tz)}`
            : `This is the Cosmic Moon. New Year begins ${fmtDate(dateInTZ(new Date(Date.UTC(anchor.getUTCFullYear()+1,6,26)), tz), tz)}`;
        } else {
          nextMoonInfo.textContent = `New Year begins ${fmtDate(dateInTZ(new Date(Date.UTC(startOfYear13(sel,tz).getUTCFullYear()+1,6,26)), tz), tz)}`;
        }
      }

      // Kin (optional)
      if (kinOn?.checked){
        const rules = {
          epochUTC: new Date(`${kinEpoch.value}T00:00:00Z`),
          skipLeapDay: !!kinSkipLeap?.checked,
          skipDOOT:    !!kinSkipDOOT?.checked,
          tz
        };
        const K = kinFromDate(sel, rules);
        if (kinBadge) kinBadge.textContent = `Kin ${K.kin}`;
        if (kinLine)  kinLine.textContent  = `Tone ${K.tone} • ${K.seal}`;
      } else {
        if (kinBadge) kinBadge.textContent = "Kin —";
        if (kinLine)  kinLine.textContent  = "—";
      }

      // ICS
      if (dlICS){
        const ics  = makeICS(spans, tz, `${anchor.getUTCFullYear()}/${anchor.getUTCFullYear()+1}`);
        const blob = new Blob([ics], {type:"text/calendar;charset=utf-8"});
        const url  = URL.createObjectURL(blob);
        if (dlICS.dataset._url) URL.revokeObjectURL(dlICS.dataset._url);
        dlICS.href = url;
        dlICS.dataset._url = url;
        dlICS.download = `13-moon-${anchor.getUTCFullYear()}-${anchor.getUTCFullYear()+1}.ics`;
      }
    }catch(e){ crash("update failed — check console", e); }
  }

  /* ===================== Controls & UX ===================== */
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

  // Inputs
  on(datePick, "change", ()=>{ writeURL(); updateAll(true); }, {passive:true});
  on(hourScrub, "input", ()=>{ writeURL(); updateAll(true); }, {passive:true});

  // Wheel adjust on hour scrub
  on(hourScrub, "wheel", (e)=>{
    e.preventDefault();
    const dir = Math.sign(e.deltaY);
    const v = clamp((+hourScrub.value||0) + dir, 0, 23);
    hourScrub.value = v;
    writeURL(); updateAll(true);
  }, {passive:false});

  // Keyboard shortcuts: ←/→ hour, ↑/↓ day
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

  on($("#kinOn"), "change", ()=>updateAll(true), {passive:true});
  on($("#kinEpoch"), "change", ()=>updateAll(true), {passive:true});
  on($("#kinSkipLeap"), "change", ()=>updateAll(true), {passive:true});
  on($("#kinSkipDOOT"), "change", ()=>updateAll(true), {passive:true});
  on($("#regenICS"), "click", ()=>{
    updateAll(true);
    const t=document.createElement("div"); t.className="toast"; t.textContent="Calendar refreshed";
    document.body.appendChild(t); requestAnimationFrame(()=>t.style.opacity=1);
    setTimeout(()=>{t.style.opacity=0; setTimeout(()=>t.remove(),250);},1800);
  });

  /* ===================== Live clock + animation loop ===================== */
  setInterval(()=>{
    if (nowClock && tzPick) nowClock.textContent = fmtTime(new Date(), tzPick.value);
    if (!tzPick || !datePick) return;
    const tz=tzPick.value;
    const today = dateInTZ(new Date(), tz).toISOString().slice(0,10);
    if(datePick.value === today){ updateAll(); }
  }, 1000);

  // Canvas animation (breath/parallax) with visibility throttling
  let raf=0, animVisible=true, docHidden=false;
  function loop(ts){
    if (!animVisible || docHidden) { raf=requestAnimationFrame(loop); return; }
    drawMoonSim(currentIllum, currentSunAngle, ts);
    raf=requestAnimationFrame(loop);
  }
  const simIO = ("IntersectionObserver" in window) && simMoon
    ? new IntersectionObserver(([e])=>{ animVisible = !!(e && e.isIntersecting); })
    : null;
  simIO && simIO.observe(simMoon);
  on(document, "visibilitychange", ()=>{ docHidden = document.hidden; });
  raf=requestAnimationFrame(loop);

  /* ===================== Init ===================== */
  try{
    readURL();
    if (tzPick && !tzPick.options.length){
      tzPick.innerHTML = COMMON_TZ.map(z=>`<option value="${z}">${z}</option>`).join("");
      tzPick.value = "UTC";
    }
    updateAll(true);
    buildYearMap();
    updateWidgetContrast(); // ensure widget letters are readable at load
  }catch(e){ crash("init failed", e); }
})();
