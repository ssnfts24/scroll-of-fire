/* ==========================================================================
   Scroll of Fire — 13 Moons Engine
   Responsibilities:
   - Map real time (TZ-true) → (Moon 1–13, Day 1–28) with DOOT/Leap handling
   - Render mini moonbar + badge + week dots
   - Build Gregorian year map and practices (assets/data/moons.json)
   - Expose helpers for other pages + emit events for accents/astro
   ========================================================================== */
(() => {
  "use strict";

  /* --------------------------- Time helpers -------------------------------- */
  const TZ = () => document.documentElement.dataset.tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const fmt = (date, opt={}) => new Intl.DateTimeFormat('en-US', { timeZone: TZ(), ...opt }).format(date);
  const isoLocal = (d) => {
    // ISO without TZ, but "interpreted" by TZ() through formatters where needed
    const z = new Date(d);
    return `${z.getFullYear()}-${String(z.getMonth()+1).padStart(2,"0")}-${String(z.getDate()).padStart(2,"0")}`;
  };
  const localNow = () => new Date(new Date().toLocaleString("en-US",{timeZone:TZ()}));
  const localMidnight = (d = localNow()) => new Date(new Date(d).setHours(0,0,0,0));

  // DOOT/Year anchor — fixed: New Year = July 26; DOOT = July 25
  function yearAnchor(date = localNow()){
    const y = date.getFullYear();
    const dootThis = new Date(Date.UTC(y, 6, 25, 12)); // use UTC noon to avoid DST flip; we format in TZ later
    const newYearThis = new Date(Date.UTC(y, 6, 26, 12));
    // If current date before DOOT (in TZ), we’re still in previous 13-moon year
    const inTZ = (d)=> new Date(fmt(d,{year:'numeric',month:'2-digit',day:'2-digit'}));
    if (inTZ(date) < inTZ(dootThis)) {
      // previous Gregorian year’s Jul 26
      return new Date(Date.UTC(y-1, 6, 26, 12));
    }
    return newYearThis;
  }

  /* --------------------------- Core mapping -------------------------------- */
  function dayOfYear13(d = localNow()){
    // Returns {yearStart, dayIndex (0-based across 364), doot:boolean, moon:1-13, day:1-28}
    const start = yearAnchor(d); // Jul 26 of 13-moon year
    const ms = localMidnight(d) - localMidnight(new Date(fmt(start)));
    const days = Math.floor(ms / 86400000);
    // DOOT handling: July 25 is outside cycle (day -1 relative to start)
    const y = d.getFullYear();
    const dootDate = new Date(Date.UTC((fmt(d,{month:'numeric'})<'7'?y-1:y), 6, 25, 12));
    const isDOOT = isoLocal(d) === isoLocal(new Date(fmt(dootDate)));
    if (isDOOT) return { yearStart:start, dayIndex:-1, doot:true, moon:null, day:null };
    const idx = ((days % 364) + 364) % 364; // safe wrap
    const moon = Math.floor(idx / 28) + 1;
    const day  = (idx % 28) + 1;
    return { yearStart:start, dayIndex:idx, doot:false, moon, day };
  }

  /* --------------------------- Mini Moonbar -------------------------------- */
  function renderMini(){
    const miniFG = document.getElementById("moonArcMini");
    const nameEl = document.getElementById("mbName");
    const essEl  = document.getElementById("mbEssence");
    const dayEl  = document.getElementById("mbDay");
    const yearEl = document.getElementById("mbYear");
    if(!miniFG || !nameEl) return;

    const m = dayOfYear13();
    const frac = m.doot ? 1 : (m.day + (m.moon-1)*28)/364;
    miniFG.setAttribute("stroke-dasharray", `${Math.round(163*frac)} 163`);
    yearEl.textContent = new Intl.DateTimeFormat('en',{timeZone:TZ(),year:'numeric'}).format(localNow());

    // lazy fetch of metadata
    fetch("assets/data/moons.json", {cache:"force-cache"}).then(r=>r.json()).then(list=>{
      if(m.doot){
        nameEl.innerHTML = "<b>Day Out of Time</b>";
        essEl.textContent = "Rest • Reflect • Reset";
        dayEl.textContent = "—/28";
        window.dispatchEvent(new CustomEvent("accent:lunar",{detail:{intensity:0.1}}));
        return;
      }
      const meta = list.find(x=> x.idx === m.moon) || {};
      nameEl.innerHTML = `<b>${meta.name||"Moon"}</b>`;
      essEl.textContent = meta.essence || "—";
      dayEl.textContent = `${m.day}/28`;

      // signal accents (0 near new moon, 1 near full) using simple sine of day-in-synodic (approx ~29.53)
      const syn = ((m.day + (m.moon-1)*28) % 29.53) / 29.53;
      const intensity = Math.sin(Math.PI * syn); // 0..1
      window.dispatchEvent(new CustomEvent("accent:lunar",{detail:{intensity}}));
    }).catch(()=>{});
  }

  /* --------------------------- Badge + week dots --------------------------- */
  function renderBadge(){
    const badgeDay = document.getElementById("dayInMoon");
    const arc = document.getElementById("moonArc");
    const chipN = document.getElementById("moonName");
    const chipE = document.getElementById("moonEssence");
    const weekDots = document.getElementById("weekDots");
    const line = document.getElementById("moonLine");
    const dootWarn = document.getElementById("dootWarn");

    if(!badgeDay) return;
    fetch("assets/data/moons.json", {cache:"force-cache"}).then(r=>r.json()).then(list=>{
      const m = dayOfYear13();
      if(m.doot){
        badgeDay.textContent = "—";
        arc && arc.setAttribute("stroke-dasharray", `316 316`);
        chipN.textContent = "Day Out of Time";
        chipE.textContent = "Reset gate";
        weekDots.innerHTML = "";
        line && (line.textContent = "Day Out of Time");
        dootWarn && (dootWarn.style.display = "block");
        return;
      }
      dootWarn && (dootWarn.style.display = "none");
      const meta = list.find(x=>x.idx===m.moon) || {};
      badgeDay.textContent = String(m.day);
      const frac = (m.day)/28;
      arc && arc.setAttribute("stroke-dasharray", `${Math.round(316*frac)} 316`);
      chipN.textContent = `${meta.name||"Moon"} (#${m.moon})`;
      chipE.textContent = meta.essence || "—";
      line && (line.textContent = `${meta.name||"Moon"} • Day ${m.day} / 28`);
      // week dots (1–4 × 7)
      const w = Math.ceil(m.day/7);
      weekDots.innerHTML = Array.from({length:28},(_,i)=>{
        const on = i < m.day ? "on":"";
        return `<span class="dot ${on}" aria-hidden="true"></span>`;
      }).join("");
    }).catch(()=>{});
  }

  /* --------------------------- Year map & info ----------------------------- */
  function renderYearMap(){
    const tbody = document.querySelector("#yearMap tbody");
    const span  = document.getElementById("nextMoonInfo");
    if(!tbody) return;
    const anchor = yearAnchor(localNow());
    const startTZ = new Date(fmt(anchor)); // TZ-local Jul 26
    fetch("assets/data/moons.json", {cache:"force-cache"}).then(r=>r.json()).then(list=>{
      tbody.innerHTML = "";
      for(let i=0;i<13;i++){
        const s = new Date(startTZ.getTime() + i*28*86400000);
        const e = new Date(s.getTime() + 27*86400000);
        const meta = list[i];
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${meta.idx}</td>
          <td>${meta.name}</td>
          <td class="meta">${meta.essence}</td>
          <td class="mono">${fmt(s,{year:'numeric',month:'short',day:'2-digit'})} ${TZ().replace('_',' ')}</td>
          <td class="mono">${fmt(e,{year:'numeric',month:'short',day:'2-digit'})} ${TZ().replace('_',' ')}</td>`;
        tbody.appendChild(tr);
      }
      // next moon info
      const today = dayOfYear13();
      if(!today.doot){
        const nextStart = new Date(startTZ.getTime() + (today.moon)*28*86400000);
        const daysLeft = 28 - today.day;
        span.textContent = `Next moon begins ${fmt(nextStart,{month:'long',day:'numeric'})} (${daysLeft} day${daysLeft!==1?'s':''} left in #${today.moon}).`;
      } else {
        span.textContent = "New year begins tomorrow (after Day Out of Time).";
      }
    });
  }

  /* --------------------------- Controls & bindings ------------------------- */
  function bindControls(){
    const tzPick   = document.getElementById("tzPick");
    const datePick = document.getElementById("datePick");
    const hourScrub= document.getElementById("hourScrub");
    const btnToday = document.getElementById("btnToday");
    const prevDay  = document.getElementById("prevDay");
    const nextDay  = document.getElementById("nextDay");
    const nowDate  = document.getElementById("nowDate");
    const nowClock = document.getElementById("nowClock");
    const nowTZ    = document.getElementById("nowTZ");
    const jumpMoon = document.getElementById("jumpMoon");
    const share    = document.getElementById("shareLink");

    if(nowTZ) nowTZ.textContent = TZ();

    // populate timezones (minimal — system + UTC)
    if(tzPick){
      const current = TZ();
      const common = ["UTC", current];
      tzPick.innerHTML = [...new Set(common)].map(z=>`<option value="${z}">${z}</option>`).join("");
      tzPick.value = current;
      tzPick.addEventListener("change", ()=>{ window.SOFTZ.set(tzPick.value); boot(); });
    }

    // live clock
    function tickClock(){
      if(nowDate) nowDate.textContent = fmt(localNow(), {weekday:'short', month:'short', day:'numeric', year:'numeric'});
      if(nowClock) nowClock.textContent= fmt(localNow(), {hour:'2-digit', minute:'2-digit', second:'2-digit'});
    }
    tickClock(); setInterval(tickClock, 1000);

    // date/hour scrub preview (affects badge only; we don't mutate global TZ)
    if(datePick && hourScrub){
      const applyPreview = ()=>{
        const base = new Date(datePick.value ? `${datePick.value}T00:00:00` : isoLocal(localNow()));
        base.setHours(+hourScrub.value||0,0,0,0);
        // fake "now" for mapping
        const m = dayOfYear13(base);
        const name = document.getElementById("moonName"); const ess = document.getElementById("moonEssence");
        fetch("assets/data/moons.json").then(r=>r.json()).then(list=>{
          if(m.doot){
            name.textContent="Day Out of Time"; ess.textContent="Reset gate";
          } else {
            const meta = list.find(x=>x.idx===m.moon)||{};
            name.textContent=`${meta.name} (#${m.moon})`;
            ess.textContent=meta.essence||"—";
            document.getElementById("dayInMoon").textContent = String(m.day);
            document.getElementById("moonArc").setAttribute("stroke-dasharray", `${Math.round(316*(m.day/28))} 316`);
          }
        });
      };
      datePick.addEventListener("input", applyPreview);
      hourScrub.addEventListener("input", applyPreview);
    }

    // today / prev / next
    btnToday && btnToday.addEventListener("click", ()=>{ datePick.value=""; hourScrub.value=localNow().getHours(); boot(); });
    prevDay  && prevDay.addEventListener("click", ()=>{ datePick.value = isoLocal(new Date(localMidnight().getTime()-86400000)); boot(); });
    nextDay  && nextDay.addEventListener("click", ()=>{ datePick.value = isoLocal(new Date(localMidnight().getTime()+86400000)); boot(); });

    // jump to moon
    jumpMoon && jumpMoon.addEventListener("change", ()=>{
      const n = +jumpMoon.value; if(!n) return;
      const anchor = yearAnchor(localNow());
      const s = new Date(new Date(fmt(anchor)).getTime() + (n-1)*28*86400000);
      datePick.value = isoLocal(s); hourScrub.value = "12"; 
      jumpMoon.value=""; boot();
    });

    // share link with tz param
    share && share.addEventListener("click", async ()=>{
      const u = new URL(location.href); u.searchParams.set("tz", TZ());
      try{ await navigator.clipboard.writeText(u.toString()); alert("Link copied."); }catch{ prompt("Copy link:", u.toString()); }
    });

    // keys
    window.addEventListener("keydown",(e)=>{
      if(document.activeElement && /input|textarea|select/i.test(document.activeElement.tagName)) return;
      if(e.key==="T"||e.key==="t"){ btnToday?.click(); }
      if(e.key==="ArrowUp"){ prevDay?.click(); }
      if(e.key==="ArrowDown"){ nextDay?.click(); }
      if(e.key==="ArrowLeft"){ hourScrub && (hourScrub.value = Math.max(0, (+hourScrub.value||0)-1), hourScrub.dispatchEvent(new Event("input"))); }
      if(e.key==="ArrowRight"){ hourScrub && (hourScrub.value = Math.min(23,(+hourScrub.value||0)+1), hourScrub.dispatchEvent(new Event("input"))); }
    });
  }

  /* --------------------------- Practices/notes ----------------------------- */
  function bindPractice(){
    const listEl = document.getElementById("practiceList");
    const note   = document.getElementById("noteText");
    const save   = document.getElementById("btnSaveNote");
    if(!listEl) return;
    fetch("assets/data/moons.json").then(r=>r.json()).then(list=>{
      const now = dayOfYear13(); if(now.doot) return;
      const meta = list.find(x=>x.idx===now.moon)||{};
      listEl.innerHTML = (meta.practice||[]).map(p=>`<li>${p}</li>`).join("");
      const KEY = `sofc.note.${now.moon}`;
      try{ note.value = localStorage.getItem(KEY)||""; }catch{}
      save && save.addEventListener("click",()=>{ try{ localStorage.setItem(KEY, note.value||""); alert("Saved."); }catch{} });
    });
  }

  /* --------------------------- Public helpers ------------------------------ */
  window.SOFMoons = { map: dayOfYear13, anchor: yearAnchor, tz: ()=>TZ() };

  /* --------------------------- Boot --------------------------------------- */
  function boot(){
    renderMini();
    renderBadge();
    renderYearMap();
    bindPractice();
  }
  document.readyState !== "loading" ? boot() : document.addEventListener("DOMContentLoaded", boot);
  window.addEventListener("accent:change", boot); // when TZ/theme changes
})();
