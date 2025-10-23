(() => {
  "use strict";

  /* ------------------------- Shortcuts / guards ------------------------- */
  const $  = (s, c=document) => c.querySelector(s);
  const id = s => document.getElementById(s);
  const has = s => !!$(s);
  if (!has('#moonMiniBar')) return; // safe include

  /* ------------------------------ Data sets ---------------------------- */
  const MOONS = ["Magnetic","Lunar","Electric","Self-Existing","Overtone","Rhythmic","Resonant","Galactic","Solar","Planetary","Spectral","Crystal","Cosmic"];
  const ESS   = ["Attract purpose","Stabilize challenge","Activate service","Define form","Empower radiance","Balance equality","Channel inspiration","Harmonize integrity","Pulse intention","Perfect manifestation","Dissolve release","Dedicate cooperation","Endure presence"];
  const QUOTES = [
    "“Teach us to number our days…” — Psalm 90:12",
    "“For everything there is a season…” — Eccl. 3:1",
    "“The light shines in the darkness…” — John 1:5",
    "“In quietness and trust is your strength.” — Isa. 30:15",
    "“He heals the brokenhearted…” — Psalm 147:3"
  ];

  /* Carrier palette (Codex voice-carriers) */
  const CARRIERS = {
    "432":["#7af3ff","#f3c97a"],
    "528":["#9ef7a3","#ffd27a"],
    "369":["#a8a6ff","#7af3ff"],
    "144":["#7aa8ff","#e3b1ff"],
    "963":["#d1b3ff","#fff0a6"]
  };

  /* ------------------------------ Time core ---------------------------- */
  const TZ_KEY = "sof_moons_tz";
  const tz = localStorage.getItem(TZ_KEY) || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const pad = n => String(n).padStart(2,"0");

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

  /* ------------------------ Numerology / pulse ------------------------- */
  const sumDigits = n => String(n).split("").reduce((a,b)=>a+(+b||0),0);
  function reduceNum(n){ while(n>9 && n!==11 && n!==22 && n!==33){ n=sumDigits(n); } return n; }
  function numerology(d, zone){
    const dt = dateInTZ(d, zone);
    const y=dt.getUTCFullYear(), m=dt.getUTCMonth()+1, day=dt.getUTCDate();
    return reduceNum(sumDigits(y)+sumDigits(m)+sumDigits(day));
  }

  /* ----------------------------- UI refs ------------------------------- */
  const bar       = id('moonMiniBar');
  const link      = id('moonMiniLink');
  const arc       = id('mbArc');
  const txtDay    = id('mbDay');
  const lineMoon  = id('mbMoon');
  const lineDay   = id('mbDayLine');
  const subEss    = id('mbEssence');
  const yearSpan  = id('mbYear');
  const yhwh      = id('mbYHWH');
  const shareBtn  = id('mbShare');
  const kinTag    = id('mbKin');           // optional, only if you added it
  const grad      = $('#mbGrad');          // SVG gradient for carrier colors
  const stopA     = grad?.querySelector('stop[offset="0"]');
  const stopB     = grad?.querySelector('stop[offset="1"]');

  /* ----------------------- Carrier color binding ----------------------- */
  function activeCarrier(){
    // 1) explicit data attribute on bar
    const d = bar?.dataset?.carrier || bar?.dataset?.carrierActive;
    if (d && CARRIERS[d]) return d;
    // 2) class on <html> like "carrier-432"
    const cls = document.documentElement.className.match(/carrier-(\d+)/);
    if (cls && CARRIERS[cls[1]]) return cls[1];
    // 3) default
    return "432";
  }
  function applyCarrier(){
    const c = activeCarrier();
    const [c1,c2] = CARRIERS[c] || CARRIERS["432"];
    stopA?.setAttribute("stop-color", c1);
    stopB?.setAttribute("stop-color", c2);
    bar?.style.setProperty('--carrier', c);
  }

  /* ----------------------------- Helpers ------------------------------- */
  function captionFor(m13){
    if (m13.special) return `${m13.special} — Year ${m13.year}`;
    const name = MOONS[m13.moon-1];
    return `${name} Moon — Day ${m13.day} · Year ${m13.year}`;
  }

  /* Robust ring draw: supports dasharray OR dashoffset */
  function drawArc(day){
    const total = 316;
    const p = Math.max(1, Math.min(28, day));
    const filled = Math.round(total * (p/28));
    if (!arc) return;
    if (arc.hasAttribute('pathLength')) {
      // use dashoffset style (smooth on some renderers)
      arc.style.strokeDasharray = total;
      arc.style.strokeDashoffset = (total - filled).toFixed(2);
    } else {
      // original approach
      arc.setAttribute('stroke-dasharray', `${filled} ${total - filled}`);
    }
  }

  /* ------------------------------- Update ------------------------------ */
  function update(){
    const now = new Date();
    const sel = dateInTZ(now, tz, now.getHours());
    const m13 = calc13Moon(sel, tz);

    // Deep link to full page + ledger-ish params
    const dstr = sel.toISOString().slice(0,10);
    const hrs  = String(sel.getUTCHours());
    const carrier = activeCarrier();
    const params = new URLSearchParams({ d: dstr, tz, t: hrs, carrier, proof:"sha256" });
    link.href = `moons.html?${params.toString()}`;

    yearSpan && (yearSpan.textContent = m13.year);
    applyCarrier(); // keep ring synced to current carrier

    // Special states
    bar.dataset.state = '';
    if (m13.special){
      bar.dataset.state = /Out/.test(m13.special) ? 'doot' : 'leap';
      txtDay && (txtDay.textContent = '—');
      lineMoon && (lineMoon.textContent = m13.special);
      lineDay && (lineDay.textContent = 'Outside 13×28');
      subEss && (subEss.textContent = 'Rest • reflect • reset');
      subEss && (subEss.title = 'This date does not belong to any 13-Moon day');
      drawArc(1); // minimal ring
    } else {
      const idx = m13.moon - 1;
      txtDay && (txtDay.textContent = String(m13.day));
      lineMoon && (lineMoon.textContent = `${MOONS[idx]} Moon (${m13.moon})`);
      lineDay && (lineDay.textContent = `Day ${m13.day} of 28`);
      subEss && (subEss.textContent = ESS[idx]);
      subEss && (subEss.title = ESS[idx]);
      drawArc(m13.day);
    }

    // Optional Kin tag (hook in your own kin calc if available)
    if (kinTag) {
      const kin = (typeof window.sofMoonKin === 'function') ? window.sofMoonKin(sel, tz) : null;
      kinTag.textContent = kin ? `KIN ${kin}` : 'KIN —';
    }

    // YHWH pulse on resonant numerology days (1/4/7/11/22/33)
    const uni = numerology(sel, tz);
    const resonant = [1,4,7,11,22,33].includes(uni);
    bar.classList.toggle('yhwh-on', resonant);

    // Motion-safe: if user prefers-reduced-motion, stop any CSS pulses
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      bar.classList.add('motion-off');
    } else {
      bar.classList.remove('motion-off');
    }
  }

  /* ------------------------------- Share ------------------------------- */
  function toast(msg){
    const el=document.createElement('div');
    Object.assign(el.style,{position:'fixed',left:'50%',bottom:'20px',transform:'translateX(-50%)',background:'#0e131c',color:'#e6f9ff',padding:'8px 12px',border:'1px solid #2a3242',borderRadius:'10px',boxShadow:'0 10px 28px rgba(0,0,0,.35)',zIndex:9999,opacity:0,transition:'opacity .2s'});
    el.textContent=msg; document.body.appendChild(el);
    requestAnimationFrame(()=> el.style.opacity=1);
    setTimeout(()=>{ el.style.opacity=0; setTimeout(()=> el.remove(),250); }, 1500);
  }

  async function doShare(){
    const url = new URL(link.href, location.href);
    const now = new Date();
    const sel = dateInTZ(now, tz, now.getHours());
    const m13 = calc13Moon(sel, tz);
    const quote = QUOTES[Math.abs(sel.getUTCFullYear()*372+(sel.getUTCMonth()+1)*31+sel.getUTCDate()) % QUOTES.length];
    const text = `${captionFor(m13)}\n${quote}`;

    // Prefer Web Share; fall back to clipboard (URL + caption)
    try {
      if (navigator.share) {
        await navigator.share({title:"13-Moon • Scroll of Fire", text, url:url.toString()});
        return;
      }
    } catch (_) { /* continue to clipboard */ }

    try{
      await navigator.clipboard.writeText(`${text}\n${url.toString()}`);
      toast('Copied 13-Moon link');
    }catch{
      const ta = document.createElement('textarea'); ta.value = `${text}\n${url.toString()}`;
      ta.style.position='fixed'; ta.style.top='-1000px'; document.body.appendChild(ta); ta.focus(); ta.select();
      document.execCommand('copy'); ta.remove();
      toast('Copied 13-Moon link');
    }
  }

  /* ------------------------------- Wire-up ----------------------------- */
  shareBtn?.addEventListener('click', doShare, {passive:true});
  update();

  // minute tick + rollover adjust
  let prevKey='';
  function yyyy_mm_dd(zone, d=new Date()){
    return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  }
  prevKey = yyyy_mm_dd(tz);
  setInterval(()=>{
    update();
    const nowKey = yyyy_mm_dd(tz);
    if (nowKey !== prevKey){ prevKey = nowKey; update(); }
  }, 60*1000);
})();
