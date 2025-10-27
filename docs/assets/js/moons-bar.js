/* 13 Moons — Mini Widget (v2.2)
   - New IDs:  #mbName, #mbDay, #mbEssence, #mbYear, #moonArcMini, #btnShareImage, #btnJump
   - Legacy:   #mbMoon, #mbDayLine, #mbEssence, #mbYear, #mbArc, #mbShare, #mbTZ
   - Deep link: moons.html?d=YYYY-MM-DD&tz=Area/City&t=H#moon-N
*/
(function(){
  "use strict";

  /* ---------- Tiny utils ---------- */
  const $  =(s,r=document)=>r.querySelector(s);
  const on =(t,e,f,o)=>t&&t.addEventListener(e,f,o);
  const pad=n=>String(n).padStart(2,"0");
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
  const safe = fn => { try{ return fn(); } catch{ return void 0; } };
  const toast = (msg)=>{
    const t=document.createElement('div');
    t.className='toast'; t.textContent=msg;
    Object.assign(t.style,{
      position:"fixed",left:"50%",bottom:"calc(22px + env(safe-area-inset-bottom))",
      transform:"translateX(-50%)",background:"#0e131c",color:"#e6f9ff",
      padding:"8px 12px",border:"1px solid var(--line,#2a3242)",borderRadius:"10px",
      boxShadow:"0 10px 28px rgba(0,0,0,.35)",zIndex:"9999",opacity:"0",transition:"opacity .2s"
    });
    document.body.appendChild(t); requestAnimationFrame(()=>t.style.opacity=1);
    setTimeout(()=>{t.style.opacity=0; setTimeout(()=>t.remove(),250);},1500);
  };

  /* ---------- Data ---------- */
  const MOONS = ["Magnetic","Lunar","Electric","Self-Existing","Overtone","Rhythmic","Resonant","Galactic","Solar","Planetary","Spectral","Crystal","Cosmic"];
  const ESS   = ["Attract purpose","Stabilize challenge","Activate service","Define form","Empower radiance","Balance equality","Channel inspiration","Harmonize integrity","Pulse intention","Perfect manifestation","Dissolve release","Dedicate cooperation","Endure presence"];

  /* ---------- TZ + URL ---------- */
  const TZ_KEY="sof_moons_tz";
  const getTZ = ()=> safe(()=>localStorage.getItem(TZ_KEY)) || safe(()=>Intl.DateTimeFormat().resolvedOptions().timeZone) || "UTC";
  const setTZ = z => safe(()=>localStorage.setItem(TZ_KEY,z));

  function dateInTZ(baseDate, tz, overrideHour){
    try{
      const opts={timeZone:tz,hour12:false,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"};
      const parts=new Intl.DateTimeFormat("en-CA",opts).formatToParts(baseDate);
      const m=Object.fromEntries(parts.map(p=>[p.type,p.value]));
      const h = (overrideHour==null? m.hour : pad(overrideHour));
      return new Date(`${m.year}-${m.month}-${m.day}T${h}:${m.minute}:${m.second}Z`);
    }catch{
      const d=new Date(baseDate); if (overrideHour!=null) d.setUTCHours(overrideHour,0,0,0); return d;
    }
  }
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
  function dayIndexSinceStart(d, tz){
    const start = new Date(Date.UTC(startOfYear13(d, tz).getUTCFullYear(),6,26));
    const dt = new Date(Date.UTC(dateInTZ(d, tz).getUTCFullYear(), dateInTZ(d, tz).getUTCMonth(), dateInTZ(d, tz).getUTCDate()));
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

  /* ---------- Phase accent (sync with CSS vars / SVG defs) ---------- */
  function mixHex(a,b,t){
    const pa=parseInt(a.slice(1),16), pb=parseInt(b.slice(1),16);
    const ar=(pa>>16)&255, ag=(pa>>8)&255, ab=pa&255;
    const br=(pb>>16)&255, bg=(pb>>8)&255, bb=pb&255;
    const rr=Math.round(ar+(br-ar)*t), gg=Math.round(ag+(bg-ag)*t), bb2=Math.round(ab+(bb-ab)*t);
    return `#${((1<<24)+(rr<<16)+(gg<<8)+bb2).toString(16).slice(1)}`;
  }
  function moonPhase(d){
    const syn = 29.530588853, epoch = Date.UTC(2000,0,6,18,14,0);
    const ageDays = ((d.getTime()-epoch)/86400000);
    const frac = ((ageDays % syn)+syn)%syn / syn;
    const illum = (1 - Math.cos(2*Math.PI*frac))/2;
    return {illum};
  }
  function setGradientStops(defId, c1, c2){
    const grad = document.getElementById(defId);
    if (!grad) return;
    const stops = grad.querySelectorAll("stop");
    if (stops[0]) stops[0].setAttribute("stop-color", c1);
    if (stops[1]) stops[1].setAttribute("stop-color", c2);
  }
  function applyPhaseAccent(illum){
    const cold = "#7af3ff", warm = "#f3c97a";
    const t = Math.min(1, Math.max(0, illum));
    const c1 = mixHex(cold, warm, t*0.7);
    const c2 = mixHex(warm, cold, (1-t)*0.7);
    const root = document.documentElement;
    root.style.setProperty("--moon-accent",  c1);
    root.style.setProperty("--moon-accent-2",c2);
    setGradientStops("mbGrad", c1, c2); // mini ring
    setGradientStops("rg", c1, c2);     // main ring (if present)
    const bar = $(".moonbar");
    bar && bar.classList.remove("contrast-light");
  }

  /* ---------- DOM targets (new & legacy) ---------- */
  const elName = $("#mbName") || $("#mbMoon");
  const elDay  = $("#mbDay")  || $("#mbDayLine");
  const elEss  = $("#mbEssence");
  const elYear = $("#mbYear");
  const arc    = $("#moonArcMini") || $("#mbArc") || $(".mb-fg");
  const btnShare = $("#btnShareImage") || $("#mbShare");
  const btnJump  = $("#btnJump");
  const tzBtn    = $("#mbTZ"); // legacy optional
  const link     = $("#moonMiniLink"); // optional <a> wrapper for deep link
  const barRoot  = $(".moonbar");

  const DASH_TOTAL = 316;
  function setArc(day){
    if (!arc) return;
    const d = Math.round(DASH_TOTAL * (clamp(day,1,28)/28));
    arc.setAttribute("stroke-dasharray", `${d} ${Math.max(0,DASH_TOTAL-d)}`);
  }

  function buildDeepLink(now, tz, m13){
    const base = (link?.getAttribute("href")) || "moons.html";
    let u;
    try{ u=new URL(base, document.baseURI || location.href); }
    catch{ u=new URL(String(base), location.href); }
    const d = dateInTZ(now, tz).toISOString().slice(0,10);
    u.searchParams.set("d", d);
    u.searchParams.set("tz", tz);
    u.searchParams.set("t", String(now.getHours()));
    if (m13 && m13.moon) u.hash = `moon-${m13.moon}`;
    return u.toString();
  }

  /* ---------- Populate widget ---------- */
  function update({deepLinkOnly=false}={}){
    const tz = getTZ();
    const now = new Date();
    const wall = dateInTZ(now, tz, now.getHours());
    const m13 = calc13Moon(wall, tz);

    if (!deepLinkOnly){
      if (m13.special){
        elName && (elName.textContent = m13.special);
        elEss  && (elEss.textContent  = "Outside the 13×28 count");
        elDay  && (elDay.textContent  = "—/28");
        setArc(0);
      } else {
        const idx=m13.moon-1;
        elName && (elName.textContent = `${MOONS[idx]} Moon`);
        elEss  && (elEss.textContent  = ESS[idx]);
        elDay  && (elDay.textContent  = `${m13.day}/28`);
        setArc(m13.day);
      }
      elYear && (elYear.textContent = m13.year);

      // subtle YHWH resonance chip cue for numerology (1,4,7,11,22,33)
      const y = wall.getUTCFullYear(), mm = wall.getUTCMonth()+1, dd = wall.getUTCDate();
      const sum = String(y).split("").reduce((a,b)=>a+(+b),0) + mm + dd;
      const resonant = [1,4,7,11,22,33].includes(sum % 34);
      barRoot && barRoot.classList.toggle("yhwh-on", !!resonant);

      // phase accent match
      applyPhaseAccent(moonPhase(wall).illum);
    }

    // Deep link
    const dl = buildDeepLink(now, tz, m13);
    if (link) link.setAttribute("href", dl);
    return dl;
  }

  /* ---------- Share + Jump + TZ ---------- */
  on(btnShare, "click", async ()=>{
    const url = update(); // ensure fresh link
    const title = elName?.textContent || "13 Moons";
    try{
      if (navigator.share){
        await navigator.share({title, text:title, url});
        toast("Shared");
      } else {
        await navigator.clipboard.writeText(url);
        toast("Link copied");
      }
    }catch{}
  });

  on(btnJump, "click", ()=>{
    const url = update();
    location.href = url; // same-tab deep link
  });

  on(tzBtn, "click", ()=>{
    const current = getTZ();
    const input = prompt(`Timezone (IANA)\nEx: America/Los_Angeles, UTC, Europe/Berlin\n\nCurrent: ${current}`, current);
    if (!input) return;
    try{
      new Intl.DateTimeFormat("en-CA",{timeZone:input}).format(new Date());
      setTZ(input);
      update({deepLinkOnly:false});
      document.dispatchEvent(new Event("sof:tz-change"));
      toast(`Timezone set: ${input}`);
    }catch{ toast("Invalid timezone"); }
  });

  /* ---------- Reactivity with the main page ---------- */
  on(document, "sof:accent-change", ()=>{
    const bar = $(".moonbar");
    bar && bar.classList.remove("contrast-light");
  });
  on(document, "sof:tz-change", ()=> update({deepLinkOnly:false}));

  /* ---------- Lifecycle ---------- */
  if (arc && matchMedia('(prefers-reduced-motion: reduce)').matches){ arc.style.transition='none'; }
  update();
  let iv = setInterval(update, 60*1000);
  on(document, "visibilitychange", ()=>{ if(document.hidden){ clearInterval(iv); } else { update(); iv=setInterval(update,60*1000);} });
  on(window, "focus", update);
})();