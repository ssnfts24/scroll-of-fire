/* ==========================================================================
   Scroll of Fire — 13 Moons Engine + Lively Astrology
   File: assets/js/moons.js
   v2025.11.03-r3
   - Fix: Gregorian month was stuck (UTC drift & stale anchor) → now TZ-correct.
   - Fix: "Today" always re-derives anchor from live wall time (per TZ select).
   - New: Lively astrology demo (smooth drift if no __EPHEMERIS__), motion-safe.
   - New: Hebrew verse pulse + aurora starfield (disabled on reduced motion).
   - New: Robust DOOT/leap handling; .ics, week dots, dual calendars.
   ========================================================================== */

(() => {
  "use strict";

  /* --------------------------- Tiny Utilities --------------------------- */
  const $  = (s, c=document) => c.querySelector(s);
  const $$ = (s, c=document) => Array.from(c.querySelectorAll(s));
  const pad = (n) => String(n).padStart(2, "0");
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const prefersReduced = () =>
    window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  const fmtDate = (d, tz, opts={}) =>
    new Intl.DateTimeFormat("en-US", { timeZone: tz, ...opts }).format(d);

  const TODAY_FMT = { weekday:"short", year:"numeric", month:"short", day:"2-digit" };

  /* --------------------------- Timezone Helper -------------------------- */
  const MoonTZ = {
    get() {
      try { return $("#tzPick")?.value || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }
      catch { return "UTC"; }
    },
    // Make a Date carrying WALL clock fields of given TZ (noon-safe)
    atWall(y, m, d, hh=12, mm=0, ss=0, tz = null) {
      tz = tz || MoonTZ.get();
      // Build yyyy-mm-ddThh:mm:ss in TZ, then reinterpret as UTC
      const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz, year:"numeric", month:"2-digit", day:"2-digit",
        hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false
      });
      const parts = Object.fromEntries(fmt.formatToParts(new Date(Date.UTC(y,m-1,d,hh,mm,ss))).map(p=>[p.type,p.value]));
      const iso = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`;
      return new Date(iso);
    },
    nowWall(tz = null) {
      tz = tz || MoonTZ.get();
      const d = new Date();
      const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz, year:"numeric", month:"2-digit", day:"2-digit",
        hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false
      });
      const p = Object.fromEntries(fmt.formatToParts(d).map(x=>[x.type, x.value]));
      return new Date(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
    },
    isoDateWall(d) {
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;
    }
  };

  /* ---------------------------- 13 Moon Data ---------------------------- */
  const MOONS = (Array.isArray(window.__MOONS__) && window.__MOONS__.length===13)
    ? window.__MOONS__
    : [
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

  const DOOT_NAME = "Day Out of Time";
  const DOOT_ESS  = "Pause · Reset";

  const isLeap = y => (y%4===0 && (y%100!==0 || y%400===0));

  // Remnant year starts at local Jul 26. DOOT is local Jul 25 and skipped.
  function remYearStart(dw) {
    const tz = MoonTZ.get();
    const y  = dw.getUTCFullYear();
    const jul26 = MoonTZ.atWall(y,7,26,12,0,0,tz);
    return (dw < jul26) ? MoonTZ.atWall(y-1,7,26,12,0,0,tz) : jul26;
  }
  function isDOOT(dw) {
    const tz = MoonTZ.get();
    const yStart = remYearStart(dw).getUTCFullYear();
    const d = MoonTZ.atWall(yStart,7,25,12,0,0,tz);
    return MoonTZ.isoDateWall(dw) === MoonTZ.isoDateWall(d);
  }
  // Leap-days between two wall-anchored UTC dates, in local TZ frame
  function leapDaysBetween(start, end) {
    const tz = MoonTZ.get();
    let hits = 0;
    for (let y = start.getUTCFullYear()-1; y <= end.getUTCFullYear()+1; y++) {
      if (!isLeap(y)) continue;
      const feb29 = MoonTZ.atWall(y,2,29,12,0,0,tz);
      if (feb29 >= start && feb29 <= end) hits++;
    }
    return hits;
  }
  function addDaysUTC(d, days) {
    const nd = new Date(d.getTime());
    nd.setUTCDate(nd.getUTCDate() + days);
    return nd;
  }
  function diffDaysUTC(a,b) { return Math.floor((a-b)/86400000); }

  function remnantPosition(dw) {
    if (isDOOT(dw)) return { doot:true };
    const start = remYearStart(dw);
    let days = diffDaysUTC(dw, start);
    days -= leapDaysBetween(start, dw);
    const clamped = clamp(days, 0, 363); // 13*28 - 1
    const moon = Math.floor(clamped / 28) + 1;
    const day  = (clamped % 28) + 1;
    const week = Math.floor((day - 1) / 7) + 1;
    return { doot:false, moon, day, week, idxYear: clamped };
  }
  function wallDateForRemIdx(start, idx0) {
    let d = addDaysUTC(start, idx0);
    const leaps = leapDaysBetween(start, d);
    if (leaps > 0) d = addDaysUTC(d, leaps);
    return d;
  }
  function yearLabelFor(dw) {
    const yStart = remYearStart(dw).getUTCFullYear();
    return `${yStart}/${yStart+1}`;
  }

  /* --------------------------- Anchor Handling -------------------------- */
  function getAnchor() {
    const tz = MoonTZ.get();
    const qp = new URLSearchParams(location.search);
    const pinned = qp.get("pin") === "1";
    const d = qp.get("date");
    if (pinned && d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const [Y,M,D] = d.split("-").map(Number);
      return MoonTZ.atWall(Y, M, D, 12,0,0, tz);
    }
    // Live wall "today" at noon TZ
    const w = MoonTZ.nowWall(tz);
    return MoonTZ.atWall(w.getUTCFullYear(), w.getUTCMonth()+1, w.getUTCDate(), 12,0,0, tz);
  }
  function setAnchorToDateStr(ymd) {
    const qp = new URLSearchParams(location.search);
    qp.set("date", ymd); qp.set("pin","1");
    history.replaceState(null, "", `${location.pathname}?${qp.toString()}`);
  }
  function clearAnchor() {
    const qp = new URLSearchParams(location.search);
    qp.delete("date"); qp.delete("pin");
    const s = qp.toString();
    history.replaceState(null, "", `${location.pathname}${s ? "?"+s : ""}`);
  }

  /* ------------------------------ Painters ------------------------------ */
  function paintHeader(anchor, pos) {
    const tz = MoonTZ.get();
    $("#nowDate") && ($("#nowDate").textContent = fmtDate(anchor, tz, TODAY_FMT));
    // live ticking wall clock
    (function tick() {
      const el = $("#nowClock");
      if (!el) return;
      const now = MoonTZ.nowWall(tz);
      el.textContent = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;
      // run every second; stop if element removed
      if (document.body.contains(el)) setTimeout(tick, 1000);
    })();
    $("#nowTZ") && ($("#nowTZ").textContent = tz);
    $("#yearSpan") && ($("#yearSpan").textContent = yearLabelFor(anchor));

    // Ring + labels
    const ring = $("#moonArc");
    const dayEl = $("#dayInMoon");
    const nameEl = $("#moonName");
    const essEl  = $("#moonEssence");
    const lineEl = $("#moonLine");
    const doot   = $("#dootWarn");
    for (let i=1;i<=13;i++) document.body.classList.remove(`theme-moon-${i}`);
    if (pos.doot) {
      nameEl && (nameEl.textContent = DOOT_NAME);
      essEl  && (essEl.textContent  = DOOT_ESS);
      lineEl && (lineEl.textContent = "DOOT — outside the 13×28 cadence");
      dayEl  && (dayEl.textContent  = "—");
      if (ring) {
        const full = 316; ring.style.strokeDasharray = `1 ${full-1}`;
      }
      doot?.removeAttribute("hidden");
      document.body.classList.add("theme-doot");
    } else {
      const md = MOONS[pos.moon-1] || {};
      nameEl && (nameEl.textContent = md.name || `Moon ${pos.moon}`);
      essEl  && (essEl.textContent  = md.essence || "—");
      lineEl && (lineEl.textContent = `Moon ${pos.moon} · Day ${pos.day} · Week ${pos.week}`);
      dayEl  && (dayEl.textContent  = String(pos.day));
      if (ring) {
        const full = 316;
        const cur  = Math.max(1, Math.floor(((pos.day-1) / 28) * full));
        ring.style.strokeDasharray = `${cur} ${full-cur}`;
        ring.style.stroke = md.color || getComputedStyle(document.documentElement).getPropertyValue("--accent");
      }
      doot && (doot.hidden = true);
      document.body.classList.add(`theme-moon-${pos.moon}`);
    }

    // verse pulse (ancient/Hebrew vibe)
    const verses = [
      {he:"בְּרוּךְ אוֹר הָאֵשׁ", en:"Blessed is the Light of Fire", ref:"Witness · 1"},
      {he:"זְכֹור אֶת הַיּוֹם", en:"Remember the Day", ref:"Remnant · 13"},
      {he:"קוֹל שֶׁל נְשָׁמָה", en:"A Voice of Breath", ref:"Scroll · Seal 2"},
    ];
    const v = verses[(pos.doot?0:pos.moon+pos.day) % verses.length];
    $("#vHeb") && ($("#vHeb").textContent = v.he);
    $("#vEn")  && ($("#vEn").textContent  = v.en);
    $("#vRef") && ($("#vRef").textContent = v.ref);
  }

  function buildWeekDots(pos) {
    const host = $("#weekDots"); if (!host) return;
    host.innerHTML = "";
    for (let wk=1; wk<=4; wk++) {
      const g = document.createElement("div"); g.className = "wdots";
      for (let d=1; d<=7; d++) {
        const i = (wk-1)*7 + d;
        const dot = document.createElement("i"); dot.className = "wdot";
        if (!pos.doot && i===pos.day) dot.classList.add("is-today");
        g.appendChild(dot);
      }
      host.appendChild(g);
    }
  }

  function buildRemnantMonth(anchor, pos) {
    const host = $("#remCal"); if (!host) return; host.innerHTML = "";
    const tz = MoonTZ.get();
    $("#remHdr") && ($("#remHdr").textContent = pos.doot
      ? "Remnant Month — DOOT"
      : `Remnant Month — ${MOONS[pos.moon-1].name} (${pos.moon}/13)`);
    $("#remMeta") && ($("#remMeta").textContent = `13 × 28 fixed — ${tz}`);
    const grid = document.createElement("ol");
    grid.className = "r-grid"; grid.setAttribute("role","grid");
    ["D1","D2","D3","D4","D5","D6","D7"].forEach(l=>{
      const th = document.createElement("li");
      th.className="r-lbl"; th.setAttribute("role","columnheader"); th.textContent = l;
      grid.appendChild(th);
    });
    if (pos.doot) {
      const li = document.createElement("li"); li.className = "r-doot"; li.textContent = DOOT_NAME;
      grid.appendChild(li);
    } else {
      const start = remYearStart(anchor);
      const startIdx0 = (pos.moon - 1) * 28;
      for (let i=0; i<28; i++) {
        const idx0 = startIdx0 + i;
        const dWall = wallDateForRemIdx(start, idx0);
        const li = document.createElement("li");
        li.className = "r-day" + ((i+1)===pos.day ? " is-today" : "");
        li.setAttribute("role","gridcell");
        const btn = document.createElement("button");
        btn.type="button"; btn.textContent = String(i+1);
        btn.title = fmtDate(dWall, tz, { year:"numeric", month:"short", day:"2-digit" }) + ` (${tz})`;
        btn.addEventListener("click", () => {
          setAnchorToDateStr(MoonTZ.isoDateWall(dWall));
          paint(); // repaint with new anchor
        });
        li.appendChild(btn); grid.appendChild(li);
      }
    }
    host.appendChild(grid);
  }

  function buildGregorianMonth(anchor) {
    const host = $("#gregCal"); if (!host) return; host.innerHTML = "";
    const tz = MoonTZ.get();

    // Anchor is local-noon UTC date for selected TZ — derive the FIRST of that local month:
    const wall = MoonTZ.nowWall(tz); // use live wall for month name if user is on "today"
    const a = MoonTZ.atWall(anchor.getUTCFullYear(), anchor.getUTCMonth()+1, anchor.getUTCDate(), 12,0,0, tz);
    const Y = a.getUTCFullYear(), M0 = a.getUTCMonth();

    const first = MoonTZ.atWall(Y, M0+1, 1, 12,0,0, tz);
    const nextFirst = (M0===11)
      ? MoonTZ.atWall(Y+1, 1, 1, 12,0,0, tz)
      : MoonTZ.atWall(Y, M0+2, 1, 12,0,0, tz);

    const daysIn = Math.round((nextFirst - first)/86400000);
    const firstDow = first.getUTCDay();

    $("#gregHdr") && ($("#gregHdr").textContent =
      `Gregorian Month — ${fmtDate(first, tz, { month:"long" })} ${Y}`);
    $("#gregMeta") && ($("#gregMeta").textContent = "Variable weeks");

    const grid = document.createElement("ol");
    grid.className = "g-grid"; grid.setAttribute("role","grid");
    ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].forEach(l=>{
      const th=document.createElement("li"); th.className="g-lbl"; th.setAttribute("role","columnheader"); th.textContent=l;
      grid.appendChild(th);
    });
    for (let i=0; i<firstDow; i++) {
      const padCell=document.createElement("li"); padCell.className="g-pad"; padCell.setAttribute("aria-hidden","true");
      grid.appendChild(padCell);
    }
    const todayYMD = MoonTZ.isoDateWall(MoonTZ.nowWall(tz));
    for (let d=1; d<=daysIn; d++) {
      const dWall = MoonTZ.atWall(Y, M0+1, d, 12,0,0, tz);
      const isToday = (MoonTZ.isoDateWall(dWall) === todayYMD);
      const li = document.createElement("li");
      li.className = "g-day" + (isToday ? " is-today" : "");
      li.setAttribute("role","gridcell");
      const btn = document.createElement("button");
      btn.type="button"; btn.textContent = String(d);
      btn.addEventListener("click", () => {
        setAnchorToDateStr(`${Y}-${pad(M0+1)}-${pad(d)}`);
        paint();
      });
      li.appendChild(btn); grid.appendChild(li);
    }
    host.appendChild(grid);
  }

  function buildYearMap(anchor) {
    const tz = MoonTZ.get();
    const tbody = $("#yearMap tbody"); if (!tbody) return;
    const start = remYearStart(anchor);
    const rows = [];
    for (let i=0;i<13;i++){
      const s = wallDateForRemIdx(start, i*28);
      const e = addDaysUTC(s, 27);
      rows.push({i:i+1, s, e, name:MOONS[i].name, essence:MOONS[i].essence});
    }
    tbody.innerHTML = rows.map(r=>{
      const s=fmtDate(r.s, tz, {year:"numeric", month:"short", day:"2-digit"});
      const e=fmtDate(r.e, tz, {year:"numeric", month:"short", day:"2-digit"});
      return `<tr><td>${r.i}</td><td>${r.name}</td><td>${r.essence}</td><td>${s} <span class="tag mono">${tz}</span></td><td>${e} <span class="tag mono">${tz}</span></td></tr>`;
    }).join("");

    const pos = remnantPosition(anchor);
    const info = $("#nextMoonInfo"); if (!info) return;
    if (!pos.doot) {
      const nextStart = wallDateForRemIdx(start, (pos.moon % 13) * 28);
      const label = fmtDate(nextStart, tz, { month:"short", day:"2-digit" });
      info.textContent = `Next: ${MOONS[pos.moon%13].name} begins ${label} (${tz})`;
    } else {
      info.textContent = "This is the Day Out of Time — the count resumes tomorrow.";
    }
  }

  /* -------------------------------- ICS --------------------------------- */
  function buildICSBlob(anchor) {
    const tz = MoonTZ.get();
    const yStart = remYearStart(anchor);
    const labelYear = `${yStart.getUTCFullYear()}/${yStart.getUTCFullYear()+1}`;
    const stamp = (()=>{const d=new Date();return d.getUTCFullYear()+pad(d.getUTCMonth()+1)+pad(d.getUTCDate())+"T"+pad(d.getUTCHours())+pad(d.getUTCMinutes())+pad(d.getUTCSeconds())+"Z"})();
    const fmtDate = d => d.getUTCFullYear()+pad(d.getUTCMonth()+1)+pad(d.getUTCDate());
    const uid = () => (crypto?.randomUUID?.() || ("sof-"+Math.random().toString(36).slice(2)));
    let ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Scroll of Fire//13 Moon//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n";
    for (let i=0;i<13;i++){
      const s = wallDateForRemIdx(yStart, i*28);
      const e = new Date(s); e.setUTCDate(e.getUTCDate()+28);
      ics += "BEGIN:VEVENT\r\n"+
        "UID:"+uid()+"@scroll-of-fire\r\n"+
        "DTSTAMP:"+stamp+"\r\n"+
        "DTSTART;VALUE=DATE:"+fmtDate(s)+"\r\n"+
        "DTEND;VALUE=DATE:"+fmtDate(e)+"\r\n"+
        "SUMMARY:"+(i+1)+". "+MOONS[i].name+" Moon — "+labelYear+" ("+tz+")\r\n"+
        "DESCRIPTION:"+MOONS[i].essence+"\r\nEND:VEVENT\r\n";
    }
    ics += "END:VCALENDAR\r\n";
    return new Blob([ics], {type:"text/calendar"});
  }

  /* ---------------------------- Astrology ------------------------------- */
  // If window.__EPHEMERIS__ exists, read positions (deg 0..360 for each key).
  // Otherwise, create a gentle, deterministic drift based on time (lively!).
  const PLANETS = ["sun","moon","mercury","venus","mars","jupiter","saturn"];
  const OUTERS  = ["uranus","neptune","pluto","north_node"];

  function getPlanetPositions(anchor) {
    const tz = MoonTZ.get();
    const base = MoonTZ.atWall(anchor.getUTCFullYear(), anchor.getUTCMonth()+1, anchor.getUTCDate(), anchor.getUTCHours(), 0, 0, tz);
    if (window.__EPHEMERIS__ && typeof window.__EPHEMERIS__ === "object") {
      return {...window.__EPHEMERIS__};
    }
    // Lively fallback: smooth drift by time-of-day; daily seed by date.
    const t = base.getTime()/86400000; // days
    const seed = (n) => (Math.sin(n*12.9898)*43758.5453)%1;
    const pos = {};
    PLANETS.forEach((p,i)=>{
      const baseDeg = (seed(i+1)*360);
      const daily   = (t* (5 - i*0.6)) % 360; // faster inner, slower outer
      pos[p] = (baseDeg + daily) % 360;
    });
    OUTERS.forEach((p,i)=>{
      const baseDeg = (seed(100+i)*360);
      const slow    = (t * 0.2 * (1 - i*0.1)) % 360;
      pos[p] = (baseDeg + slow) % 360;
    });
    return pos;
  }

  function paintAstrology(anchor) {
    const tz = MoonTZ.get();
    const C = $("#astroWheel"); if (!C) return;

    const setGrad = () => {
      const stops = C.querySelectorAll("#awGrad stop");
      if (stops.length>=2) {
        const cs = getComputedStyle(document.documentElement);
        const a  = cs.getPropertyValue("--bridge-accent") || "#7af3ff";
        const b  = cs.getPropertyValue("--bridge-accent-2") || "#7aa8ff";
        stops[0].setAttribute("stop-color", a.trim());
        stops[1].setAttribute("stop-color", b.trim());
      }
    };
    setGrad();

    const houseLines = $("#houseLines");
    const signLabels = $("#signLabels");
    const dotsGroup  = $("#planetDots");
    if (houseLines && !houseLines.hasChildNodes()) {
      for (let i=0;i<12;i++){
        const line = document.createElementNS("http://www.w3.org/2000/svg","line");
        const ang = (Math.PI*2)*(i/12);
        const r0=40, r1=162;
        const x0=180+ r0*Math.sin(ang), y0=180- r0*Math.cos(ang);
        const x1=180+ r1*Math.sin(ang), y1=180- r1*Math.cos(ang);
        line.setAttribute("x1", x0); line.setAttribute("y1", y0);
        line.setAttribute("x2", x1); line.setAttribute("y2", y1);
        houseLines.appendChild(line);
      }
    }
    if (signLabels && !signLabels.hasChildNodes()) {
      const names = ["Ar","Ta","Ge","Cn","Le","Vi","Li","Sc","Sg","Cp","Aq","Pi"];
      for (let i=0;i<12;i++){
        const t = document.createElementNS("http://www.w3.org/2000/svg","text");
        const ang = (Math.PI*2)*(i/12) + (Math.PI/12);
        const r=135;
        const x=180+ r*Math.sin(ang), y=180- r*Math.cos(ang);
        t.setAttribute("x", x); t.setAttribute("y", y);
        t.textContent = names[i];
        signLabels.appendChild(t);
      }
    }

    const stamp = $("#astroStamp");
    const tzEl  = $("#astroTZ");
    const srcEl = $("#astroSource");
    stamp && (stamp.textContent = fmtDate(anchor, tz, {year:"numeric",month:"short",day:"2-digit", hour:"2-digit", minute:"2-digit"}));
    tzEl  && (tzEl.textContent  = tz);
    srcEl && (srcEl.textContent = window.__EPHEMERIS__ ? "External Ephemeris" : "Lively Demo");

    const positions = getPlanetPositions(anchor);
    // Place chips text
    PLANETS.concat(OUTERS).forEach(p=>{
      const posSpan = $(`[data-pos="${p}"]`);
      const signSpan= $(`[data-sign="${p}"]`);
      if (posSpan) posSpan.textContent = `${positions[p]?.toFixed(1) ?? "—"}°`;
      if (signSpan) {
        const deg = positions[p] ?? 0;
        const idx = Math.floor((deg % 360) / 30);
        const signs = ["Ar","Ta","Ge","Cn","Le","Vi","Li","Sc","Sg","Cp","Aq","Pi"];
        signSpan.textContent = signs[idx];
      }
    });

    // Animate dots gently (motion-safe)
    const r = 150;
    const dots = PLANETS.map(p => ({ el: C.querySelector(`[data-dot="${p}"]`), key: p }));
    let raf = 0;
    const baseT = performance.now();
    function frame() {
      const t = (performance.now()-baseT) / 1000;
      dots.forEach((d,i)=>{
        if (!d.el) return;
        const base = positions[d.key] || 0;
        const drift = window.__EPHEMERIS__ ? 0 : Math.sin(t * (0.15 + i*0.03)) * 0.25; // slow drift
        const deg = (base + drift) * Math.PI/180;
        const x = 180 + r * Math.sin(deg);
        const y = 180 - r * Math.cos(deg);
        d.el.setAttribute("cx", x);
        d.el.setAttribute("cy", y);
      });
      raf = requestAnimationFrame(frame);
    }
    if (!prefersReduced()) {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    }
  }

  /* --------------------------- Starfield FX ----------------------------- */
  function startStars() {
    const cv = $("#skyBg"); if (!cv) return;
    const ctx = cv.getContext("2d");
    let w = cv.width = cv.clientWidth, h = cv.height = cv.clientHeight;
    const STAR_N = 120;
    const stars = Array.from({length:STAR_N}, (_,i)=>({
      x: Math.random()*w, y: Math.random()*h,
      z: 0.4 + Math.random()*0.6,
      p: Math.random()*Math.PI*2, s: 0.5 + Math.random()*1.5
    }));
    function resize() {
      w = cv.width = cv.clientWidth; h = cv.height = cv.clientHeight;
    }
    window.addEventListener("resize", resize);

    let raf = 0;
    function frame(t) {
      ctx.clearRect(0,0,w,h);
      ctx.fillStyle = "rgba(255,255,255,.85)";
      stars.forEach(st=>{
        const tw = (Math.sin(t*0.001 + st.p)+1)/2; // 0..1
        const a = 0.15 + tw*0.35 * st.z;
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.s*st.z, 0, Math.PI*2);
        ctx.fill();
        // slow parallax drift
        st.x += (st.z-0.5)*0.04; st.y += (st.z-0.5)*0.02;
        if (st.x< -4) st.x = w+4; if (st.x>w+4) st.x = -4;
        if (st.y< -4) st.y = h+4; if (st.y>h+4) st.y = -4;
      });
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    }
    if (!prefersReduced()) raf = requestAnimationFrame(frame);
  }

  /* ------------------------------ Controls ------------------------------ */
  function wireControls() {
    $("#btnToday")?.addEventListener("click", ()=>{ clearAnchor(); paint(); });
    $("#prevDay")?.addEventListener("click", ()=>{
      const a = getAnchor();
      const tz= MoonTZ.get();
      const prev = addDaysUTC(a, -1);
      setAnchorToDateStr(MoonTZ.isoDateWall(prev));
      paint();
    });
    $("#nextDay")?.addEventListener("click", ()=>{
      const a = getAnchor();
      const next = addDaysUTC(a, +1);
      setAnchorToDateStr(MoonTZ.isoDateWall(next));
      paint();
    });
    $("#datePick")?.addEventListener("change", (ev)=>{
      const v = ev.target.value;
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        setAnchorToDateStr(v); paint();
      }
    });
    $("#jumpMoon")?.addEventListener("change", (ev)=>{
      const m = parseInt(ev.target.value||"0", 10);
      if (!m) return;
      const a = getAnchor();
      const start = remYearStart(a);
      const target = wallDateForRemIdx(start, (m-1)*28);
      setAnchorToDateStr(MoonTZ.isoDateWall(target));
      paint();
    });
    $("#tzPick")?.addEventListener("change", ()=> paint());

    // ICS
    const dl = $("#dlICS");
    $("#regenICS")?.addEventListener("click", ()=>{ if (dl) dl.href = "#"; });
    if (dl) dl.addEventListener("click", (e)=>{
      e.preventDefault();
      const blob = buildICSBlob(getAnchor());
      dl.href = URL.createObjectURL(blob);
      dl.download = "13-moon-year.ics";
    });
  }

  /* ------------------------------ Painter ------------------------------- */
  function paint() {
    const anchor = getAnchor();
    const pos    = remnantPosition(anchor);

    paintHeader(anchor, pos);
    buildWeekDots(pos);
    buildRemnantMonth(anchor, pos);
    buildGregorianMonth(anchor);
    buildYearMap(anchor);
    paintAstrology(anchor);

    // Sync UI controls
    $("#datePick") && ($("#datePick").value = MoonTZ.isoDateWall(anchor));
    $("#jumpMoon") && ($("#jumpMoon").value = pos.doot ? "" : String(pos.moon));
  }

  /* ------------------------------- Boot --------------------------------- */
  function populateTZSelect() {
    const sel = $("#tzPick"); if (!sel) return;
    const common = [
      "America/Los_Angeles","America/Denver","America/Chicago","America/New_York",
      "Europe/London","Europe/Berlin","Europe/Moscow","Asia/Dubai","Asia/Kolkata",
      "Asia/Shanghai","Asia/Tokyo","Australia/Sydney","Pacific/Auckland","UTC"
    ];
    sel.innerHTML = common.map(z=>`<option value="${z}">${z}</option>`).join("");
    // pick current tz if present, else LA as your default
    const cur = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";
    sel.value = common.includes(cur) ? cur : "America/Los_Angeles";
  }

  function init() {
    populateTZSelect();
    wireControls();
    if (!prefersReduced()) startStars();
    paint();
  }

  window.addEventListener("DOMContentLoaded", init);
})();
