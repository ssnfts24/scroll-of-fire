/* 13 Moons — Mini Widget (ancient wizard / DPR-aware / synced)
   - Populates #mbMoon, #mbDayLine, #mbEssence, #mbYear
   - Drives mini ring arc (id="mbArc" or .mb-fg) with dash=316
   - Phase-tints CSS vars --moon-accent / --moon-accent-2
   - Builds deep link with d,tz,t and supports native share + TZ
*/
(function(){
  "use strict";

  /* ---------- Tiny utils ---------- */
  const $  = s => document.querySelector(s);
  const el = id => document.getElementById(id);
  const on = (t,e,f,o)=> t&&t.addEventListener(e,f,o);
  const pad = n => String(n).padStart(2,"0");
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
  const toast = (msg)=>{
    const t=document.createElement('div');
    t.className='toast'; t.textContent=msg;
    document.body.appendChild(t); requestAnimationFrame(()=>t.style.opacity=1);
    setTimeout(()=>{ t.style.opacity=0; setTimeout(()=>t.remove(),250); }, 1500);
  };

  /* ---------- Data ---------- */
  const MOONS = ["Magnetic","Lunar","Electric","Self-Existing","Overtone","Rhythmic","Resonant","Galactic","Solar","Planetary","Spectral","Crystal","Cosmic"];
  const ESS  = ["Attract purpose","Stabilize challenge","Activate service","Define form","Empower radiance","Balance equality","Channel inspiration","Harmonize integrity","Pulse intention","Perfect manifestation","Dissolve release","Dedicate cooperation","Endure presence"];

  /* ---------- TZ + URL ---------- */
  const TZ_KEY="sof_moons_tz";
  const link = el("moonMiniLink"); // optional deep link <a>
  const getTZ = () => localStorage.getItem(TZ_KEY) || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const setTZ = z => localStorage.setItem(TZ_KEY, z);

  function validDateStr(s){ return /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function dateInTZ(baseDate, tz, overrideHour){
    try{
      const opts={timeZone:tz, hour12:false, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit"};
      const parts=new Intl.DateTimeFormat("en-CA",opts).formatToParts(baseDate);
      const m=Object.fromEntries(parts.map(p=>[p.type,p.value]));
      const h = (overrideHour==null? m.hour : pad(overrideHour));
      return new Date(`${m.year}-${m.month}-${m.day}T${h}:${m.minute}:${m.second}Z`);
    }catch{
      const d=new Date(baseDate); if (overrideHour!=null) d.setUTCHours(overrideHour,0,0,0); return d;
    }
  }

  /* ---------- 13-moon core ---------- */
  const utcTrunc = d => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
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

  /* ---------- Phase hue for accents ---------- */
  function moonPhase(d){
    const syn = 29.530588853, epoch = Date.UTC(2000,0,6,18,14,0);
    const age = ((d.getTime()-epoch)/86400000);
    const frac = ((age % syn)+syn)%syn / syn;
    const illum = (1 - Math.cos(2*Math.PI*frac))/2;
    return {illum};
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
    const t = Math.min(1, Math.max(0, illum));
    const c1 = mixHex(cold, warm, t*0.7);
    const c2 = mixHex(warm, cold, (1-t)*0.7);
    const root = document.documentElement;
    root.style.setProperty("--moon-accent",  c1);
    root.style.setProperty("--moon-accent-2",c2);
  }

  /* ---------- Populate widget ---------- */
  const mbMoon    = el("mbMoon");
  const mbDayLine = el("mbDayLine");
  const mbEssence = el("mbEssence");
  const mbYear    = el("mbYear");
  const mbYHWH    = el("mbYHWH");
  const shareBtn  = el("mbShare");
  const tzBtn     = el("mbTZ");

  // ring arc: prefer id, fallback to class
  const arc = el("mbArc") || $(".mb-fg");
  const DASH_TOTAL = 316;

  function setArc(day){
    if (!arc) return;
    const dash = Math.round(DASH_TOTAL * (clamp(day,1,28)/28));
    arc.setAttribute("stroke-dasharray", `${dash} ${Math.max(0,DASH_TOTAL-dash)}`);
  }

  function update(deepLinkOnly){
    const tz = getTZ();
    const now = new Date();
    const wall = dateInTZ(now, tz, now.getHours());

    const m13 = calc13Moon(wall, tz);

    // labels
    if (m13.special){
      mbMoon && (mbMoon.textContent = m13.special);
      mbEssence && (mbEssence.textContent = "Outside the 13×28 count");
      mbDayLine && (mbDayLine.textContent = "—");
      setArc(0);
    }else{
      const idx = m13.moon-1;
      mbMoon && (mbMoon.textContent = `${MOONS[idx]} Moon`);
      mbEssence && (mbEssence.textContent = ESS[idx]);
      mbDayLine && (mbDayLine.textContent = `Day ${m13.day} / 28`);
      setArc(m13.day);
    }
    mbYear && (mbYear.textContent = m13.year);

    // phase-driven accent
    const ph = moonPhase(wall);
    applyPhaseAccent(ph.illum);

    // YHWH chip highlight on resonant numerology (1,4,7,11,22,33)
    const resonant=[1,4,7,11,22,33].includes((((wall.getUTCFullYear()+"").split("").map(Number).reduce((a,b)=>a+b,0)) + (wall.getUTCMonth()+1) + wall.getUTCDate())%34);
    const root = link?.closest(".moonbar") || document.querySelector(".moonbar");
    if (root){
      root.classList.toggle("yhwh-on", !!resonant);
    }

    // deep link
    if (link && !deepLinkOnly){
      try{
        const u = new URL(link.getAttribute("href") || "moons.html", document.baseURI || location.href);
        const d = dateInTZ(now, tz).toISOString().slice(0,10);
        u.searchParams.set("d", d);
        u.searchParams.set("tz", tz);
        u.searchParams.set("t", String(now.getHours()));
        link.setAttribute("href", u.toString());
      }catch{}
    }
  }

  /* ---------- Share + TZ ---------- */
  async function nativeShare(){
    try{
      const url = new URL((link?.href)||location.href, location.href).toString();
      const text = mbMoon?.textContent && mbDayLine?.textContent
        ? `${mbMoon.textContent} — ${mbDayLine.textContent}`
        : "13-Moon living clock";
      if (navigator.share){ await navigator.share({title:"13-Moon — today", text, url}); return true; }
    }catch{}
    return false;
  }

  on(shareBtn, "click", async ()=>{
    if (await nativeShare()){ toast("Shared"); return; }
    try{
      const url = new URL((link?.href)||location.href, location.href).toString();
      await navigator.clipboard.writeText(url);
      toast("Link copied");
    }catch{ toast("Unable to copy"); }
  });

  on(tzBtn, "click", ()=>{
    const current = getTZ();
    const input = prompt(`Timezone (IANA)\nEx: America/Los_Angeles, UTC, Europe/Berlin\n\nCurrent: ${current}`, current);
    if (!input) return;
    try{
      new Intl.DateTimeFormat("en-CA",{timeZone:input}).format(new Date());
      setTZ(input);
      update(true); // refresh deep link and accents
      document.dispatchEvent(new Event("sof:tz-change"));
      toast(`Timezone set: ${input}`);
    }catch{ toast("Invalid timezone"); }
  });

  /* ---------- Lifecycle ---------- */
  function tick(){
    update();
  }
  let iv = setInterval(tick, 60*1000); // refresh every minute
  on(document, "visibilitychange", ()=>{ if(document.hidden){ clearInterval(iv); } else { tick(); iv=setInterval(tick, 60*1000);} });
  on(window, "focus", tick);
  on(document, "sof:tz-change", tick);

  // init
  // reduce initial FOUC for motion-sensitive users
  if (arc && matchMedia('(prefers-reduced-motion: reduce)').matches){ arc.style.transition='none'; }
  tick();
})();
