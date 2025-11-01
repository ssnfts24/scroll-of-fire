/* Remnant 13-Moon — main logic (TZ-true mapping, dual calendar, ICS export) */
(function(){
"use strict";
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));

/* dataset */
const MOONS = (window.__MOONS__||[
  {"idx":1,"name":"Magnetic","essence":"Unify Purpose","color":"#6FE7FF"},
  {"idx":2,"name":"Lunar","essence":"Polarize Challenge","color":"#B1C7FF"},
  {"idx":3,"name":"Electric","essence":"Activate Service","color":"#7AF3FF"},
  {"idx":4,"name":"Self-Existing","essence":"Define Form","color":"#7BF3B8"},
  {"idx":5,"name":"Overtone","essence":"Empower Radiance","color":"#FFD27A"},
  {"idx":6,"name":"Rhythmic","essence":"Organize Equality","color":"#A7FFCF"},
  {"idx":7,"name":"Resonant","essence":"Channel Inspiration","color":"#7AF3FF"},
  {"idx":8,"name":"Galactic","essence":"Harmonize Integrity","color":"#9BD3FF"},
  {"idx":9,"name":"Solar","essence":"Pulse Intention","color":"#FFBC6F"},
  {"idx":10,"name":"Planetary","essence":"Perfect Manifestation","color":"#FFD9A6"},
  {"idx":11,"name":"Spectral","essence":"Dissolve Release","color":"#B8C7FF"},
  {"idx":12,"name":"Crystal","essence":"Dedicate Cooperation","color":"#CFEFFF"},
  {"idx":13,"name":"Cosmic","essence":"Endure Presence","color":"#E7D1FF"}
]);

const tz = MoonTZ.getTZ();

/* helpers */
const isLeap = y => (y%4===0 && y%100!==0) || (y%400===0);
const fmtISO = d => d.toISOString().slice(0,10);
const wall = d => MoonTZ.wallParts(d, tz);

/* map wall-time to remnant day */
function currentWall(){
  const q = new URLSearchParams(location.search).get("d");
  return q ? wall(new Date(q+"T12:00:00Z")) : MoonTZ.nowWall();
}
function remnantYearStart(y){ return new Date(Date.UTC(y,6,26)); } // Jul 26 UTC anchor

function calc(w){
  const yWall = (w.getUTCMonth()>6 || (w.getUTCMonth()===6 && w.getUTCDate()>=26)) ? w.getUTCFullYear() : w.getUTCFullYear()-1;
  const startWall = wall(remnantYearStart(yWall));
  const dootWall  = wall(new Date(Date.UTC(yWall,6,25)));
  const inDOOT = MoonTZ.isoDateWall(w) === MoonTZ.isoDateWall(dootWall);

  let dayCount = null; // 1..364
  if(!inDOOT){
    let d = Math.floor((w - startWall)/(86400e3)) + 1;
    if (isLeap(w.getUTCFullYear())){
      const feb29 = wall(new Date(Date.UTC(w.getUTCFullYear(),1,29)));
      if (MoonTZ.isoDateWall(w) >= MoonTZ.isoDateWall(feb29)) d -= 1;
    }
    dayCount = d;
  }
  let moonIdx=null, dayInMoon=null, week=null;
  if(dayCount){ moonIdx = Math.floor((dayCount-1)/28)+1; dayInMoon=((dayCount-1)%28)+1; week=Math.floor((dayInMoon-1)/7)+1; }

  return { tz, year:yWall, yearSpan:`${yWall}/${yWall+1}`, inDOOT, dayCount, moonIdx, dayInMoon, week };
}

/* paint UI */
function paint(){
  const w = currentWall();
  $("#nowDate").textContent = MoonTZ.isoDateWall(w);
  $("#nowClock").textContent = w.toLocaleTimeString([], {hour12:false});
  $("#nowTZ").textContent = tz;

  const r = calc(w);
  const m = MOONS.find(x=>x.idx===r.moonIdx) || {};
  const color = m.color || getComputedStyle(document.documentElement).getPropertyValue('--accent');

  // header ring + labels
  $("#dayInMoon").textContent = r.dayInMoon || "—";
  $("#moonName").textContent  = m.name || "—";
  $("#moonEssence").textContent = m.essence || "—";
  $("#yearSpan").textContent = r.yearSpan;
  $("#moonLine").textContent = r.inDOOT ? "Day Out of Time" : `Moon ${r.moonIdx} • Day ${r.dayInMoon} • Week ${r.week}`;
  $("#dootWarn").style.display = r.inDOOT ? "block" : "none";

  // arcs
  const full = 316, cur = r.dayInMoon? ((r.dayInMoon-1)/28)*full : 0;
  const arc = $("#moonArc"); if(arc){ arc.style.strokeDasharray = `${cur} ${full}`; arc.style.stroke = color; }
  const arcMini = $("#moonArcMini"); if(arcMini){ const L=163; const p=r.dayInMoon?((r.dayInMoon-1)/28)*L:0; arcMini.setAttribute('stroke-dasharray',`${p} ${L}`); arcMini.style.stroke=color; }

  // week dots
  const dots = $("#weekDots"); if(dots){ dots.innerHTML=""; for(let i=1;i<=28;i++){ const el=document.createElement("i"); el.className="dot wk"; if(r.dayInMoon && i<=r.dayInMoon) el.classList.add("on"); dots.appendChild(el);} }

  // practices
  injectPractices(r.moonIdx);

  // calendars
  buildYearMap(r.year);
  buildDualCalendars(w, r);
}

function injectPractices(idx){
  const map={
    1:["Clarify your purpose in one sentence.","Choose one devotion to repeat daily."],
    2:["Name the two poles in your dilemma.","Pick a stabilizing constraint for the week."],
    7:["Create a short ritual to open the channel.","Sit in silence for seven minutes."]
  };
  $("#practiceList").innerHTML = (map[idx]||["—"]).map(x=>`<li>${x}</li>`).join("");
}

function buildYearMap(yWall){
  const tb=$("#yearMap tbody"); if(!tb) return;
  tb.innerHTML=""; const tz = MoonTZ.getTZ();
  const start = wall(remnantYearStart(yWall));
  const fmt = d=> d.toLocaleDateString([], {year:"numeric",month:"short",day:"2-digit"});
  for(let i=0;i<13;i++){
    const m = MOONS[i];
    const from = new Date(start.getTime()+ i*28*86400e3);
    const to   = new Date(from.getTime()+ 27*86400e3);
    tb.insertAdjacentHTML("beforeend",
      `<tr><td>${m.idx}</td><td>${m.name}</td><td class="meta">${m.essence}</td><td>${fmt(from)} <span class="tag mono">${tz}</span></td><td>${fmt(to)} <span class="tag mono">${tz}</span></td></tr>`);
  }
  $("#nextMoonInfo").textContent = `Year ${yWall}/${yWall+1} in ${tz}.`;
}

/* Dual calendars */
function buildDualCalendars(wallNow, r){
  // Remnant month grid
  const rem = $("#remCal"); if(rem){
    rem.innerHTML="";
    rem.appendChild(monthTable(28, r.dayInMoon, "rem"));
  }
  // Gregorian month grid
  const g = $("#gregCal"); if(g){
    g.innerHTML="";
    const GY = wallNow.getUTCFullYear(), GM = wallNow.getUTCMonth();
    const first = new Date(Date.UTC(GY, GM, 1));
    const last  = new Date(Date.UTC(GY, GM+1, 0));
    const days = last.getUTCDate();
    g.appendChild(gregTable(first.getUTCDay(), days, wallNow.getUTCDate()));
  }
}
function monthTable(days, today, cls){
  const wrap = document.createElement("div");
  const grid = document.createElement("div");
  grid.style.display="grid";
  grid.style.gridTemplateColumns="repeat(7,1fr)";
  grid.style.gap="6px";
  const wd = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  wd.forEach(x=>{ const h=document.createElement("div"); h.className="meta mono"; h.textContent=x; grid.appendChild(h); });
  for(let i=1;i<=days;i++){
    const c=document.createElement("button");
    c.className="lab-btn"; c.textContent=String(i);
    if(today===i) c.style.outline="2px solid var(--accent)";
    grid.appendChild(c);
  }
  wrap.appendChild(grid); return wrap;
}
function gregTable(firstDow, days, today){
  const wrap = document.createElement("div");
  const grid = document.createElement("div");
  grid.style.display="grid"; grid.style.gridTemplateColumns="repeat(7,1fr)"; grid.style.gap="6px";
  const wd = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  wd.forEach(x=>{ const h=document.createElement("div"); h.className="meta mono"; h.textContent=x; grid.appendChild(h); });
  let offset = firstDow; // 0=Sun
  for(let i=0;i<offset;i++){ const pad=document.createElement("div"); grid.appendChild(pad); }
  for(let d=1; d<=days; d++){
    const c=document.createElement("button"); c.className="lab-btn"; c.textContent=String(d);
    if(today===d) c.style.outline="2px solid var(--accent)";
    grid.appendChild(c);
  }
  wrap.appendChild(grid); return wrap;
}

/* ICS export (13 moons spans for the year) */
function icsYear(){
  const r = calc(currentWall());
  const tz = MoonTZ.getTZ();
  const start = wall(remnantYearStart(r.year));
  const pad = n => String(n).padStart(2,"0");
  function fmtDate(d){ return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}`; }

  let ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Scroll of Fire//13 Moon//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
`;
  for(let i=0;i<13;i++){
    const m = MOONS[i];
    const from = new Date(start.getTime()+ i*28*86400e3);
    const to   = new Date(from.getTime()+ 28*86400e3); // DTEND exclusive
    ics += `BEGIN:VEVENT
UID:${crypto.randomUUID()}@scroll-of-fire
DTSTAMP:${fmtDate(new Date())}T000000Z
DTSTART;VALUE=DATE:${fmtDate(from)}
DTEND;VALUE=DATE:${fmtDate(to)}
SUMMARY:${m.idx}. ${m.name} Moon — ${r.year}/${r.year+1} (${tz})
DESCRIPTION:${m.essence}
END:VEVENT
`;
  }
  ics += `END:VCALENDAR`;
  return new Blob([ics],{type:"text/calendar"});
}
$("#dlICS")?.addEventListener("click",(e)=>{
  e.preventDefault();
  const blob = icsYear();
  const a = $("#dlICS");
  a.href = URL.createObjectURL(blob);
  a.download = "13-moon-year.ics";
});
$("#regenICS")?.addEventListener("click",()=>{ const a=$("#dlICS"); if(a){ a.href="#"; }});

/* kick */
paint();
setInterval(()=>{ $("#nowClock").textContent = currentWall().toLocaleTimeString([], {hour12:false}); },1000);

/* expose for fallback a11y shim to re-wrap paint if needed */
window.paint = paint;
})();