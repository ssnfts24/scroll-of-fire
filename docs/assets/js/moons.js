(function(){
  "use strict";
  const $ =(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const on=(t,e,f,o)=>t&&t.addEventListener(e,f,o);
  const pad=n=>String(n).padStart(2,"0");
  const warn=(...a)=>{ try{console.warn('[Moons]',...a);}catch(_){} };

  $("#yr")?.textContent=new Date().getFullYear();

  /* ---------- Data ---------- */
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

  /* ---------- TZ setup (robust) ---------- */
  const TZ_KEY="sof_moons_tz";
  const tzPick = $("#tzPick");
  const COMMON_TZ = ["UTC","America/Los_Angeles","America/Denver","America/Chicago","America/New_York","Europe/London","Europe/Berlin","Europe/Helsinki","Africa/Johannesburg","Asia/Dubai","Asia/Kolkata","Asia/Shanghai","Asia/Tokyo","Australia/Sydney"];
  let defaultTZ;
  try{ defaultTZ = localStorage.getItem(TZ_KEY) || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }catch(_){ defaultTZ = "UTC"; }

  let ALL_TZ = COMMON_TZ;
  try{
    if (Intl.supportedValuesOf) ALL_TZ = Array.from(new Set([...COMMON_TZ, ...Intl.supportedValuesOf("timeZone")]));
  }catch(_){ /* fallback */ }

  if (tzPick){
    tzPick.innerHTML = ALL_TZ.map(z=>`<option value="${z}">${z}</option>`).join("");
    tzPick.value = ALL_TZ.includes(defaultTZ) ? defaultTZ : "UTC";
    on(tzPick,"change",()=>{ try{ localStorage.setItem(TZ_KEY, tzPick.value); }catch(_){} writeURL(); updateAll(); buildYearMap(); });
  }

  /* ---------- Date helpers ---------- */
  function dateInTZ(baseDate, tz, overrideHour){
    // formatToParts is widely supported; keep a try/catch fallback
    try{
      const opts={timeZone:tz, hour12:false, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit"};
      const parts=new Intl.DateTimeFormat("en-CA",opts).formatToParts(baseDate);
      const m=Object.fromEntries(parts.map(p=>[p.type,p.value]));
      const h = (overrideHour==null? m.hour : pad(overrideHour));
      return new Date(`${m.year}-${m.month}-${m.day}T${h}:${m.minute}:${m.second}Z`);
    }catch(e){
      warn('dateInTZ fallback used', e);
      // naive fallback: shift by TZ offset *at the moment* (approx)
      const offMin = -new Date().getTimezoneOffset(); // user local
      const d = new Date(baseDate);
      if (overrideHour!=null) d.setUTCHours(overrideHour, 0, 0, 0);
      return new Date(d.getTime() + offMin*60000);
    }
  }
  const formatDate = (d,tz)=> new Intl.DateTimeFormat(undefined,{dateStyle:"full", timeZone:tz}).format(d);
  const formatClock= (d,tz)=> new Intl.DateTimeFormat(undefined,{timeStyle:"medium", timeZone:tz}).format(d);
  const utcTrunc = (d)=> new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

  /* ---------- 13-Moon math ---------- */
  const isLeapYear = y=> (y%4===0 && y%100!==0) || (y%400===0);
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
    const day = (idx%28)+1;
    const s=startOfYear13(d,tz).getUTCFullYear();
    return {special:null, moon, day, year:`${s}/${s+1}`};
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
  function yearMoonSpans(anchor, tz){
    const spans=[]; let curStart = utcTrunc(anchor);
    for(let m=1;m<=13;m++){
      const start = curStart;
      const end = utcTrunc(addDaysSkippingSpecials(start, 27, tz));
      spans.push({m, name:MOONS[m-1], essence:MOON_ESSENCE[m-1], start, end});
      curStart = utcTrunc(addDaysSkippingSpecials(end, 1, tz));
    }
    return spans;
  }

  /* ---------- Phase + sim ---------- */
  function moonPhase(d){
    const syn = 29.530588853, epoch = Date.UTC(2000,0,6,18,14,0);
    const age = ((d.getTime()-epoch)/86400000);
    const frac = ((age % syn)+syn)%syn / syn;
    const illum = (1 - Math.cos(2*Math.PI*frac))/2;
    const names = [
      {n:"New Moon", r:[0.00,0.03]}, {n:"Waxing Crescent", r:[0.03,0.22]},
      {n:"First Quarter", r:[0.22,0.28]}, {n:"Waxing Gibbous", r:[0.28,0.47]},
      {n:"Full Moon", r:[0.47,0.53]}, {n:"Waning Gibbous", r:[0.53,0.72]},
      {n:"Last Quarter", r:[0.72,0.78]}, {n:"Waning Crescent", r:[0.78,0.97]},
      {n:"New Moon", r:[0.97,1.01]},
    ];
    const phase = names.find(x=> frac>=x.r[0] && frac<x.r[1])?.n || "—";
    return {phase, ageDays: age, illum, frac};
  }
  function drawMoonSim(canvas, illum, sunAngle){
    const ctx=canvas.getContext('2d'); const W=canvas.width, H=canvas.height; ctx.clearRect(0,0,W,H);
    const g=ctx.createRadialGradient(W*0.5,H*0.35,20,W*0.5,H*0.35,W*0.6); g.addColorStop(0,"#0a0e15"); g.addColorStop(1,"#06080d");
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    const cx=W/2, cy=H/2, R=Math.min(W,H)*0.32; const sx = cx + Math.cos(sunAngle)*R*1.6; const sy = cy - Math.sin(sunAngle)*R*1.6;
    ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.fillStyle="#1b2231"; ctx.fill();
    const k = 2*illum-1; const rx = R*Math.abs(k), ry = R;
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(-sunAngle);
    ctx.beginPath();
    if (k>=0){ ctx.ellipse(0,0,rx,ry,0,Math.PI/2,-Math.PI/2,true); ctx.arc(0,0,R,-Math.PI/2,Math.PI/2,false); }
    else     { ctx.ellipse(0,0,rx,ry,0,-Math.PI/2,Math.PI/2,true); ctx.arc(0,0,R,Math.PI/2,-Math.PI/2,false); }
    const glow=ctx.createLinearGradient(-R,0,R,0); glow.addColorStop(0,"#7af3ff33"); glow.addColorStop(1,"#f3c97a33");
    ctx.fillStyle=glow; ctx.fill();
    ctx.globalCompositeOperation='lighter';
    ctx.beginPath(); ctx.arc(0,0,R*1.01,0,Math.PI*2); ctx.strokeStyle="#7af3ff22"; ctx.lineWidth=2; ctx.stroke();
    ctx.restore(); ctx.globalCompositeOperation='source-over';
    ctx.beginPath(); ctx.arc(sx,sy,6,0,Math.PI*2); ctx.fillStyle="#f3c97a"; ctx.fill();
  }

  /* ---------- Numerology ---------- */
  const sumDigits = n => String(n).split("").reduce((a,b)=>a+(+b||0),0);
  function reduceNum(n){ while(n>9 && n!==11 && n!==22 && n!==33){ n=sumDigits(n); } return n; }
  function numerology(d, tz){
    const dt = dateInTZ(d, tz);
    const y=dt.getUTCFullYear(), m=dt.getUTCMonth()+1, day=dt.getUTCDate();
    const total = reduceNum(sumDigits(y)+sumDigits(m)+sumDigits(day));
    const monthN = reduceNum(sumDigits(y)+sumDigits(m));
    const dayN = reduceNum(sumDigits(day));
    return {total, monthN, dayN};
  }

  /* ---------- Kin (optional) ---------- */
  function kinFromDate(selUTC, rules){
    const { epochUTC, skipLeapDay, skipDOOT, tz } = rules;
    let count = Math.floor((utcTrunc(selUTC) - utcTrunc(epochUTC)) / 86400000);
    const start = utcTrunc(epochUTC), end = utcTrunc(selUTC);
    let d = new Date(start);
    while (d <= end){
      const isLeap = isLeapDayUTC(d);
      const doot   = isDOOT(d, tz);
      if ((isLeap && skipLeapDay) || (doot && skipDOOT)) count -= 1;
      d = new Date(d.getTime()+86400000);
    }
    const kin = ((count % 260) + 260) % 260 + 1;
    const tone = ((kin-1) % 13) + 1;
    const seal = SEALS[(kin-1) % 20];
    return { kin, tone, seal };
  }

  /* ---------- ICS ---------- */
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

  /* ---------- UI refs ---------- */
  const nowDate=$("#nowDate"), nowClock=$("#nowClock"), nowTZ=$("#nowTZ");
  const moonName=$("#moonName"), moonEssence=$("#moonEssence"), dayInMoon=$("#dayInMoon"), moonArc=$("#moonArc");
  const yearSpan=$("#yearSpan"), dootWarn=$("#dootWarn"), moonLine=$("#moonLine");
  const simMoon=$("#simMoon"), phaseLine=$("#phaseLine"), phaseMeta=$("#phaseMeta");
  const numLine=$("#numLine"), numMeta=$("#numMeta"), energyQuote=$("#energyQuote");
  const yearMap=$("#yearMap tbody"), nextMoonInfo=$("#nextMoonInfo");
  const datePick=$("#datePick"), hourScrub=$("#hourScrub");
  const weekDots=$("#weekDots");
  const sourceChip=$("#sourceChip");
  const skyBg=$("#skyBg");

  const kinOn = $("#kinOn"), kinEpoch = $("#kinEpoch"), kinSkipLeap = $("#kinSkipLeap"), kinSkipDOOT = $("#kinSkipDOOT");
  const kinBadge = $("#kinBadge"), kinLine = $("#kinLine");
  const dlICS = $("#dlICS"), regenICS = $("#regenICS");

  // Build 28 dots on first run
  if (weekDots && !weekDots.children.length){
    const frag = document.createDocumentFragment();
    for (let i=0;i<28;i++){ const d=document.createElement('i'); d.className='dot'; d.setAttribute('aria-hidden','true'); frag.appendChild(d); }
    weekDots.appendChild(frag);
  }
  const weekAndDow = day => ({ week: Math.floor((day-1)/7)+1, dow: ((day-1)%7)+1 });

  /* ---------- URL sync ---------- */
  function readURL(){
    const u=new URL(location.href);
    const d=u.searchParams.get("d");
    const z=u.searchParams.get("tz");
    const h=u.searchParams.get("t");
    if(z && tzPick){ tzPick.value=z; try{ localStorage.setItem(TZ_KEY,z); }catch(_){} }
    // default date = "today" in chosen tz
    if(d){ datePick.value=d; }
    else { const t=dateInTZ(new Date(), tzPick?.value || "UTC"); datePick.value=t.toISOString().slice(0,10); }
    // default hour = user's current hour
    const curHour = new Date().getHours();
    hourScrub.value = (h!=null) ? Math.min(23,Math.max(0, +h)) : curHour;
  }
  function writeURL(){
    const u=new URL(location.href);
    if (datePick) u.searchParams.set("d", datePick.value);
    if (tzPick)   u.searchParams.set("tz", tzPick.value);
    if (hourScrub)u.searchParams.set("t", hourScrub.value);
    history.replaceState(null,"",u);
  }

  /* ---------- Sky (twinkle + aurora) ---------- */
  (function initSky(){
    if (!skyBg) return;
    const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = skyBg.getContext('2d');
    const stars = Array.from({length: 130}, ()=>({
      x: Math.random()*skyBg.width,
      y: Math.random()*skyBg.height,
      r: Math.random()*1.2 + 0.3,
      p: Math.random()*Math.PI*2,
      s: 0.006 + Math.random()*0.012
    }));
    function drawAurora(t){
      const g=ctx.createLinearGradient(0,0,skyBg.width,0);
      g.addColorStop(0, 'rgba(122,243,255,0.08)');
      g.addColorStop(0.5, 'rgba(243,201,122,0.05)');
      g.addColorStop(1, 'rgba(177,140,255,0.08)');
      ctx.fillStyle=g;
      const y = 40 + Math.sin(t*0.0005)*16;
      ctx.beginPath();
      ctx.moveTo(0, y+8);
      for(let x=0;x<=skyBg.width;x+=20){
        const yy = y + Math.sin((t*0.001) + x*0.01)*8;
        ctx.lineTo(x, yy);
      }
      ctx.lineTo(skyBg.width,0); ctx.lineTo(0,0); ctx.closePath(); ctx.fill();
    }
    function tick(ts){
      ctx.clearRect(0,0,skyBg.width,skyBg.height);
      // gradient night sky
      const g=ctx.createLinearGradient(0,0,0,skyBg.height);
      g.addColorStop(0,'#05060b'); g.addColorStop(1,'#0b0e14');
      ctx.fillStyle=g; ctx.fillRect(0,0,skyBg.width,skyBg.height);
      // aurora
      if (!RM) drawAurora(ts);
      // stars
      stars.forEach(s=>{
        const a = (Math.sin(s.p + ts*s.s)*0.5 + 0.5)*0.9 + 0.1;
        ctx.globalAlpha = a;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fillStyle='#cfe9ff'; ctx.fill();
      });
      ctx.globalAlpha = 1;
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    addEventListener('resize', ()=>{ skyBg.width=innerWidth; skyBg.height=Math.max(320, Math.round(innerHeight*0.45)); }, {passive:true});
    // first size
    skyBg.width=innerWidth; skyBg.height=Math.max(320, Math.round(innerHeight*0.45));
  })();

  /* ---------- Rendering ---------- */
  function buildYearMap(){
    const tz=tzPick?.value || "UTC"; const sel = new Date(datePick.value + `T${pad(+hourScrub.value)}:00:00Z`);
    const anchor = startOfYear13(sel, tz);
    const spans = yearMoonSpans(anchor, tz);
    const todayStr = dateInTZ(sel, tz).toISOString().slice(0,10);
    if (!yearMap) return;
    yearMap.innerHTML = spans.map(s=>{
      const sStr = dateInTZ(s.start, tz).toISOString().slice(0,10);
      const eStr = dateInTZ(s.end, tz).toISOString().slice(0,10);
      const isNow = todayStr>=sStr && todayStr<=eStr;
      return `<tr class="row ${isNow?'is-today':''}">
        <td>${s.m}</td>
        <td><span class="tag">${s.name}</span></td>
        <td class="meta">${s.essence}</td>
        <td>${formatDate(dateInTZ(s.start, tz), tz)}</td>
        <td>${formatDate(dateInTZ(s.end, tz), tz)}</td>
      </tr>`;
    }).join("");
  }

  // ring gradient shifts with illumination
  function applyPhaseAccent(illum){
    // 0=new, 1=full
    const cold = '#7af3ff', warm = '#f3c97a';
    const mix = (a,b,t)=> {
      const pa=parseInt(a.slice(1),16), pb=parseInt(b.slice(1),16);
      const ar=(pa>>16)&255, ag=(pa>>8)&255, ab=pa&255;
      const br=(pb>>16)&255, bg=(pb>>8)&255, bb=pb&255;
      const rr=Math.round(ar+(br-ar)*t), gg=Math.round(ag+(bg-ag)*t), bb2=Math.round(ab+(bb-ab)*t);
      return `#${((1<<24)+(rr<<16)+(gg<<8)+bb2).toString(16).slice(1)}`;
    };
    const c1 = mix(cold, warm, illum*0.6);
    const c2 = mix(warm, cold, (1-illum)*0.6);
    document.documentElement.style.setProperty('--moon-accent', c1);
    document.documentElement.style.setProperty('--moon-accent-2', c2);
  }

  function updateAll(){
    const tz=tzPick?.value || "UTC";
    const base=new Date();
    const wall=dateInTZ(base, tz, +hourScrub.value || 0);
    nowDate && (nowDate.textContent = formatDate(wall, tz));
    nowClock && (nowClock.textContent = formatClock(base, tz));
    nowTZ && (nowTZ.textContent = tz);

    const sel = new Date(datePick.value + `T${pad(+hourScrub.value || 0)}:00:00Z`);
    const m13 = calc13Moon(sel, tz);
    yearSpan && (yearSpan.textContent = m13.year);

    dootWarn && (dootWarn.style.display = m13.special ? 'block' : 'none');

    if(m13.special){
      moonName && (moonName.textContent = m13.special);
      moonEssence && (moonEssence.textContent = 'Outside the 13×28 count');
      dayInMoon && (dayInMoon.textContent = '—');
      moonArc && moonArc.setAttribute('stroke-dasharray', '0 316');
      moonLine && (moonLine.textContent = m13.special);
      if (weekDots){ Array.from(weekDots.children).forEach(n => n.classList.remove('on')); weekDots.setAttribute('aria-label','No week/day (special)'); }
    } else {
      const idx=m13.moon-1;
      moonName && (moonName.textContent = `${MOONS[idx]} Moon (${m13.moon})`);
      moonEssence && (moonEssence.textContent = MOON_ESSENCE[idx]);
      dayInMoon && (dayInMoon.textContent = m13.day);
      const dash = Math.round(316 * (m13.day/28));
      moonArc && moonArc.setAttribute('stroke-dasharray', `${dash} ${316-dash}`);
      moonLine && (moonLine.textContent = `You are in ${MOONS[idx]} Moon — Day ${m13.day} of 28`);
      if (weekDots){
        const { week, dow } = weekAndDow(m13.day);
        const nodes = Array.from(weekDots.children);
        nodes.forEach(n => n.classList.remove('on'));
        const dotIndex = (week-1)*7 + (dow-1);
        if (nodes[dotIndex]) nodes[dotIndex].classList.add('on');
        weekDots.setAttribute('aria-label', `Week ${week}, Day ${dow} (1–7)`);
      }
    }

    // Numerology + YHWH resonance
    const nu = numerology(sel, tz);
    numLine && (numLine.textContent = `Universal ${nu.total}`);
    numMeta && (numMeta.textContent = `Month tone ${nu.monthN} • Day tone ${nu.dayN}`);
    const resonant = [1,4,7,11,22,33].includes(nu.total);
    if (sourceChip) sourceChip.style.boxShadow = resonant? '0 0 0 1px #7af3ff55, 0 8px 28px #7af3ff22' : 'none';

    // Quote
    const qIdx = Math.abs(sel.getUTCFullYear()*372 + (sel.getUTCMonth()+1)*31 + sel.getUTCDate()) % QUOTES.length;
    energyQuote && (energyQuote.textContent = QUOTES[qIdx]);

    // Phase + sim + accent
    const ph = moonPhase(dateInTZ(sel, tz, +hourScrub.value || 0));
    phaseLine && (phaseLine.textContent = `${ph.phase}`);
    phaseMeta && (phaseMeta.textContent = `Age ≈ ${ph.ageDays.toFixed(1)} d • Illum ≈ ${(ph.illum*100).toFixed(0)}%`);
    applyPhaseAccent(ph.illum);
    simMoon && drawMoonSim(simMoon, ph.illum, ((+hourScrub.value||0)/24) * Math.PI*2);

    // Year map + next moon info
    buildYearMap();
    const anchor = startOfYear13(sel, tz);
    const spans = yearMoonSpans(anchor, tz);
    if(nextMoonInfo){
      if(!m13.special){
        const next = spans[m13.moon] || null;
        nextMoonInfo.textContent = next
          ? `Next: ${next.name} Moon starts ${formatDate(dateInTZ(next.start, tz), tz)}`
          : `This is the Cosmic Moon. New Year begins ${formatDate(dateInTZ(new Date(Date.UTC(anchor.getUTCFullYear()+1,6,26)), tz), tz)}`;
      } else {
        nextMoonInfo.textContent = `New Year begins ${formatDate(dateInTZ(new Date(Date.UTC(startOfYear13(sel,tz).getUTCFullYear()+1,6,26)), tz), tz)}`;
      }
    }

    // Kin (optional)
    if (kinOn?.checked){
      const rules = {
        epochUTC: new Date(`${kinEpoch.value}T00:00:00Z`),
        skipLeapDay: !!kinSkipLeap?.checked,
        skipDOOT: !!kinSkipDOOT?.checked,
        tz
      };
      const K = kinFromDate(sel, rules);
      if (kinBadge) kinBadge.textContent = `Kin ${K.kin}`;
      if (kinLine)  kinLine.textContent  = `Tone ${K.tone} • ${K.seal}`;
    } else {
      if (kinBadge) kinBadge.textContent = `Kin —`;
      if (kinLine)  kinLine.textContent  = `—`;
    }

    // ICS
    if (dlICS){
      const ics = makeICS(spans, tz, `${anchor.getUTCFullYear()}/${anchor.getUTCFullYear()+1}`);
      const blob = new Blob([ics], {type:"text/calendar;charset=utf-8"});
      const url = URL.createObjectURL(blob);
      dlICS.href = url;
      dlICS.download = `13-moon-${anchor.getUTCFullYear()}-${anchor.getUTCFullYear()+1}.ics`;
      // cleanup on next refresh
      dlICS.dataset._url && URL.revokeObjectURL(dlICS.dataset._url);
      dlICS.dataset._url = url;
    }
  }

  /* ---------- Controls ---------- */
  const btnToday=$("#btnToday"), prevDay=$("#prevDay"), nextDay=$("#nextDay"), shareLink=$("#shareLink");
  on(btnToday,"click",()=>{ const tz=tzPick?.value || "UTC"; const t=dateInTZ(new Date(), tz); datePick.value=t.toISOString().slice(0,10); hourScrub.value = new Date().getHours(); writeURL(); updateAll(); });
  on(prevDay,"click",()=>{ const d=new Date(datePick.value+"T00:00:00Z"); d.setUTCDate(d.getUTCDate()-1); datePick.value=d.toISOString().slice(0,10); writeURL(); updateAll(); });
  on(nextDay,"click",()=>{ const d=new Date(datePick.value+"T00:00:00Z"); d.setUTCDate(d.getUTCDate()+1); datePick.value=d.toISOString().slice(0,10); writeURL(); updateAll(); });
  on(shareLink,"click",()=>{ writeURL(); navigator.clipboard?.writeText(location.href).catch(()=>{}); const t=document.createElement('div'); t.className='toast'; t.textContent='Link copied'; document.body.appendChild(t); requestAnimationFrame(()=>t.style.opacity=1); setTimeout(()=>{t.style.opacity=0; setTimeout(()=>t.remove(),250);},1800); });
  on(datePick,"change",()=>{ writeURL(); updateAll(); });
  on(hourScrub,"input",()=>{ writeURL(); updateAll(); });

  on($("#kinOn"), "change", updateAll);
  on($("#kinEpoch"), "change", updateAll);
  on($("#kinSkipLeap"), "change", updateAll);
  on($("#kinSkipDOOT"), "change", updateAll);
  on($("#regenICS"), "click", ()=>{ updateAll(); const t=document.createElement('div'); t.className='toast'; t.textContent='Calendar refreshed'; document.body.appendChild(t); requestAnimationFrame(()=>t.style.opacity=1); setTimeout(()=>{t.style.opacity=0; setTimeout(()=>t.remove(),250);},1800); });

  // Live clock + same-day rollover
  setInterval(()=>{
    if (nowClock && tzPick) nowClock.textContent = formatClock(new Date(), tzPick.value);
    if (!tzPick || !datePick) return;
    const tz=tzPick.value;
    const today = dateInTZ(new Date(), tz).toISOString().slice(0,10);
    if(datePick.value === today){ updateAll(); }
  },1000);

  // Init
  readURL(); updateAll(); buildYearMap();
})();
