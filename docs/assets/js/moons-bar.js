(() => {
  "use strict";
  const el = id => document.getElementById(id);
  const has = sel => !!document.querySelector(sel);

  // Bail if container missing (safe include on pages that don’t use it)
  if (!has('#moonMiniBar')) return;

  /* Data */
  const MOONS = ["Magnetic","Lunar","Electric","Self-Existing","Overtone","Rhythmic","Resonant","Galactic","Solar","Planetary","Spectral","Crystal","Cosmic"];
  const ESS = ["Attract purpose","Stabilize challenge","Activate service","Define form","Empower radiance","Balance equality","Channel inspiration","Harmonize integrity","Pulse intention","Perfect manifestation","Dissolve release","Dedicate cooperation","Endure presence"];
  const QUOTES = [
    "“Teach us to number our days…” — Psalm 90:12",
    "“For everything there is a season…” — Eccl. 3:1",
    "“The light shines in the darkness…” — John 1:5",
    "“In quietness and trust is your strength.” — Isa. 30:15",
    "“He heals the brokenhearted…” — Psalm 147:3"
  ];

  /* TZ */
  const TZ_KEY = "sof_moons_tz";
  const tz = localStorage.getItem(TZ_KEY) || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const pad = n => String(n).padStart(2,"0");

  /* Time helpers (same as page) */
  function dateInTZ(baseDate, zone, overrideHour){
    const opts={timeZone:zone, hour12:false, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit"};
    const parts=new Intl.DateTimeFormat("en-CA",opts).formatToParts(baseDate);
    const m=Object.fromEntries(parts.map(p=>[p.type,p.value]));
    const h = (overrideHour==null? m.hour : pad(overrideHour));
    return new Date(`${m.year}-${m.month}-${m.day}T${h}:${m.minute}:${m.second}Z`);
  }
  const utcTrunc = d => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const isLeapYear = y => (y%4===0 && y%100!==0) || (y%400===0);
  const isLeapDayUTC = d => d.getUTCMonth()===1 && d.getUTCDate()===29;
  const isDOOT = (d, zone) => { const dt=dateInTZ(d, zone); return (dt.getUTCMonth()===6 && dt.getUTCDate()===25); }; // July 25
  function startOfYear13(d, zone){
    const dt = dateInTZ(d, zone);
    const y = dt.getUTCFullYear();
    const anchorThis = new Date(Date.UTC(y,6,26)); // Jul 26
    const anchorPrev = new Date(Date.UTC(y-1,6,26));
    return dt >= anchorThis ? anchorThis : anchorPrev;
  }
  function dayIndexSinceStart(d, zone){
    const start = utcTrunc(startOfYear13(d, zone));
    const dt = utcTrunc(dateInTZ(d, zone));
    let days = Math.floor((dt - start)/86400000);
    // subtract DOOT after start
    const doot = new Date(Date.UTC(start.getUTCFullYear()+1,6,25));
    if (dt >= doot) days -= 1;
    // subtract Feb 29 crossed
    for (let y=start.getUTCFullYear(); y<=dt.getUTCFullYear(); y++){
      if (isLeapYear(y)){
        const feb29 = new Date(Date.UTC(y,1,29));
        if (dt >= feb29 && start <= feb29) days -= 1;
      }
    }
    return days; // 0..363
  }
  function calc13Moon(d, zone){
    if (isDOOT(d,zone)) {
      const s=startOfYear13(d,zone).getUTCFullYear();
      return {special:"Day Out of Time", year:`${s}/${s+1}`};
    }
    if (isLeapDayUTC(dateInTZ(d,zone))){
      const s=startOfYear13(d,zone).getUTCFullYear();
      return {special:"Leap Day", year:`${s}/${s+1}`};
    }
    const idx = dayIndexSinceStart(d, zone);
    const moon = Math.floor(idx/28)+1;
    const day = (idx%28)+1;
    const s=startOfYear13(d,zone).getUTCFullYear();
    return {special:null, moon, day, year:`${s}/${s+1}`};
  }

  /* Numerology (for YHWH pulse) */
  const sumDigits = n => String(n).split("").reduce((a,b)=>a+(+b||0),0);
  function reduceNum(n){ while(n>9 && n!==11 && n!==22 && n!==33){ n=sumDigits(n); } return n; }
  function numerology(d, zone){
    const dt = dateInTZ(d, zone);
    const y=dt.getUTCFullYear(), m=dt.getUTCMonth()+1, day=dt.getUTCDate();
    return reduceNum(sumDigits(y)+sumDigits(m)+sumDigits(day));
  }

  /* UI refs */
  const bar = document.getElementById('moonMiniBar');
  const link = document.getElementById('moonMiniLink');
  const arc  = document.getElementById('mbArc');
  const txtDay = document.getElementById('mbDay');
  const lineMoon = document.getElementById('mbMoon');
  const lineDay = document.getElementById('mbDayLine');
  const subEss = document.getElementById('mbEssence');
  const yearSpan = document.getElementById('mbYear');
  const yhwh = document.getElementById('mbYHWH');
  const shareBtn = document.getElementById('mbShare');

  function captionFor(m13){
    if (m13.special) return `${m13.special} — Year ${m13.year}`;
    const name = MOONS[m13.moon-1];
    return `${name} Moon — Day ${m13.day} · Year ${m13.year}`;
  }

  function update(){
    const now = new Date();
    // Show “today at current hour”
    const sel = dateInTZ(now, tz, now.getHours());
    const m13 = calc13Moon(sel, tz);

    // Deep link to full page
    const dstr = sel.toISOString().slice(0,10);
    const hrs  = String(sel.getUTCHours());
    const params = new URLSearchParams({ d: dstr, tz, t: hrs });
    link.href = `moons.html?${params.toString()}`;

    yearSpan.textContent = m13.year;

    // Special states
    bar.dataset.state = '';
    if (m13.special){
      bar.dataset.state = /Out/.test(m13.special) ? 'doot' : 'leap';
      txtDay.textContent = '—';
      lineMoon.textContent = m13.special;
      lineDay.textContent = 'Outside 13×28';
      subEss.textContent = 'Rest • reflect • reset';
      subEss.title = 'This date does not belong to any 13-Moon day';
      arc.setAttribute('stroke-dasharray', '0 316');
    } else {
      const idx = m13.moon - 1;
      const dash = Math.round(316 * (m13.day/28));
      arc.setAttribute('stroke-dasharray', `${dash} ${316-dash}`);
      txtDay.textContent = String(m13.day);
      lineMoon.textContent = `${MOONS[idx]} Moon (${m13.moon})`;
      lineDay.textContent = `Day ${m13.day} of 28`;
      subEss.textContent = ESS[idx];
      subEss.title = ESS[idx];
    }

    // YHWH pulse on resonant numerology days
    const uni = numerology(sel, tz);
    const resonant = [1,4,7,11,22,33].includes(uni);
    bar.classList.toggle('yhwh-on', resonant);
  }

  // Share caption
  async function copyShare(){
    const url = new URL(link.href, location.href).toString();
    const now = new Date();
    const sel = dateInTZ(now, tz, now.getHours());
    const m13 = calc13Moon(sel, tz);
    const quote = QUOTES[Math.abs(sel.getUTCFullYear()*372+(sel.getUTCMonth()+1)*31+sel.getUTCDate()) % QUOTES.length];
    const text = `${captionFor(m13)}\n${quote}\n${url}`;
    try{
      await navigator.clipboard.writeText(text);
      toast('Copied 13-Moon link');
    }catch{
      // Fallback
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position='fixed'; ta.style.top='-1000px';
      document.body.appendChild(ta); ta.focus(); ta.select();
      document.execCommand('copy'); ta.remove();
      toast('Copied 13-Moon link');
    }
  }

  // Tiny toast
  function toast(msg){
    const el=document.createElement('div');
    Object.assign(el.style,{position:'fixed',left:'50%',bottom:'20px',transform:'translateX(-50%)',background:'#0e131c',color:'#e6f9ff',padding:'8px 12px',border:'1px solid #2a3242',borderRadius:'10px',boxShadow:'0 10px 28px rgba(0,0,0,.35)',zIndex:9999,opacity:0,transition:'opacity .2s'});
    el.textContent=msg; document.body.appendChild(el);
    requestAnimationFrame(()=> el.style.opacity=1);
    setTimeout(()=>{ el.style.opacity=0; setTimeout(()=> el.remove(),250); }, 1500);
  }

  // Wire
  shareBtn?.addEventListener('click', copyShare);
  update();

  // Rollover + minute tick
  let prevKey='';
  setInterval(()=>{
    update();
    // When the wall date changes in TZ, the deep link and copy will auto-refresh
    const nowKey = new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    if (nowKey !== prevKey){ prevKey = nowKey; update(); }
  }, 60*1000);

  // First key set
  prevKey = new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
})();
