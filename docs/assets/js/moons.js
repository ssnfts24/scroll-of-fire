/* ==========================================================================
   Scroll of Fire — Moons Engine (Living Clock)
   File: assets/js/moons.js
   Version: v2025.11.03-w7 (wall-time unification + safer wiring)
   ========================================================================== */
(function () {
  "use strict";

  /* ------------------------------- Mini DOM ------------------------------- */
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const pad = n => String(n).padStart(2, "0");
  const noop = () => {};

  const showError = (msg) => {
    const b = $("#errorBanner"); if (!b) return;
    b.textContent = msg; b.classList.add("show");
  };
  const hideError = () => {
    const b = $("#errorBanner"); if (!b) return;
    b.classList.remove("show"); b.textContent = "";
  };

  /* ------------------------------ Config --------------------------------- */
  const MOONS = (window.__MOONS__ && Array.isArray(window.__MOONS__) && window.__MOONS__.length === 13)
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

  /* --------------------------- Time helpers ------------------------------ */
  const getTZ = () => {
    try {
      const qp = new URLSearchParams(location.search);
      const forced = qp.get("tz");
      if (forced) return forced;
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch { return "UTC"; }
  };

  // Build a Date whose *UTC* fields equal local wall-time in tz.
  function atWall(y, m, d, hh = 12, mm = 0, ss = 0, tz = getTZ()) {
    try {
      const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
      });
      const partsArr = fmt.formatToParts(new Date(Date.UTC(y, m - 1, d, hh, mm, ss)));
      const parts = Object.create(null);
      for (const p of partsArr) parts[p.type] = p.value;
      const Y = parts.year   ?? String(y);
      const M = parts.month  ?? pad(m);
      const D = parts.day    ?? pad(d);
      const H = parts.hour   ?? pad(hh);
      const MIN = parts.minute?? pad(mm);
      const S = parts.second ?? pad(ss);
      return new Date(`${Y}-${M}-${D}T${H}:${MIN}:${S}Z`);
    } catch {
      return new Date(Date.UTC(y, m - 1, d, hh, mm, ss));
    }
  }

  // UTC-iso (for internal math) and wall-iso (for UI)
  const isoDate = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  function wallParts(date, tz = getTZ()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, year:"numeric", month:"2-digit", day:"2-digit"
    }).formatToParts(date).reduce((a,p)=> (a[p.type]=p.value, a), {});
    return { Y:Number(parts.year), M:Number(parts.month), D:Number(parts.day) };
  }
  function wallIso(date, tz = getTZ()) {
    const {Y,M,D} = wallParts(date, tz);
    return `${Y}-${pad(M)}-${pad(D)}`;
  }

  // UTC day stepping (safe across tz)
  const addDaysUTC  = (d, days) => { const nd = new Date(d.getTime()); nd.setUTCDate(nd.getUTCDate() + days); return nd; };
  const diffDaysUTC = (a, b) => Math.floor((a - b) / 86400000);
  const isLeap      = y => (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0));

  /* ----------------------- 13×28 + DOOT + Leap skip ---------------------- */
  function remYearStart(dw) {
    const y = dw.getUTCFullYear();
    const jul26 = atWall(y, 7, 26, 12, 0, 0);
    return (dw < jul26) ? atWall(y - 1, 7, 26, 12, 0, 0) : jul26;
  }
  function isDOOT(dw) {
    const yStart = remYearStart(dw);
    const y = yStart.getUTCFullYear();
    return isoDate(dw) === isoDate(atWall(y, 7, 25, 12, 0, 0));
  }
  function leapDaysBetween(start, end) {
    let hits = 0;
    for (let y = start.getUTCFullYear(); y <= end.getUTCFullYear(); y++) {
      if (!isLeap(y)) continue;
      const f = atWall(y, 2, 29, 12, 0, 0);
      if (f >= start && f <= end) hits++;
    }
    return hits;
  }
  function wallForIndex(start, idx0) {
    let d = addDaysUTC(start, idx0);
    const leaps = leapDaysBetween(start, d);
    if (leaps > 0) d = addDaysUTC(d, leaps);
    return d;
  }
  function remPos(dw) {
    if (isDOOT(dw)) return { doot: true };
    const start = remYearStart(dw);
    let days = diffDaysUTC(dw, start) - leapDaysBetween(start, dw);
    const clamped = Math.max(0, Math.min(363, days));
    const moon = Math.floor(clamped / 28) + 1;
    const day  = (clamped % 28) + 1;
    const week = Math.floor((day - 1) / 7) + 1;
    return { doot: false, moon, day, week, idxYear: clamped };
  }
  const yearLabel = (dw) => { const ys = remYearStart(dw).getUTCFullYear(); return `${ys}/${ys + 1}`; };

  /* ----------------------------- Anchor date ----------------------------- */
  // Rules:
  // - If ?date present -> anchor to that wall date in tz (or ?tz).
  // - Else -> anchor to *today* at hour ?t (or 12) in current tz.
  function getAnchor() {
    try {
      const qp = new URLSearchParams(location.search);
      const tz = getTZ();
      let d = qp.get("date") || qp.get("d");
      let hour = qp.get("t");
      if (!hour || isNaN(+hour)) hour = "12";
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
        const [Y, M, D] = d.split("-").map(Number);
        return atWall(Y, M, D, Number(hour), 0, 0, tz);
      }
      const now = new Date();
      return atWall(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate(), Number(hour), 0, 0, tz);
    } catch (e) {
      console.warn("[Moons] getAnchor failed:", e);
      return new Date();
    }
  }

  /* ------------------------ UI render (main paint) ----------------------- */
  function setBodyThemes(moon, day) {
    const b = document.body; if (!b) return;
    for (let i = 1; i <= 13; i++) b.classList.remove(`theme-moon-${i}`);
    for (let i = 1; i <= 28; i++) b.classList.remove(`daytone-${i}`);
    if (moon >= 1 && moon <= 13) b.classList.add(`theme-moon-${moon}`);
    if (day  >= 1 && day  <= 28) b.classList.add(`daytone-${day}`);
  }

  function paint() {
    try {
      const tz     = getTZ();
      const anchor = getAnchor();
      const pos    = remPos(anchor);
      const year   = yearLabel(anchor);

      // top status chips
      const fmtDate = new Intl.DateTimeFormat("en-US",{timeZone:tz,weekday:"short",year:"numeric",month:"short",day:"2-digit"});
      const fmtTime = new Intl.DateTimeFormat("en-GB",{timeZone:tz,hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false});
      $("#nowDate")  && ($("#nowDate").textContent  = fmtDate.format(anchor));
      $("#nowClock") && ($("#nowClock").textContent = fmtTime.format(new Date()));
      $("#nowTZ")    && ($("#nowTZ").textContent    = tz);
      $("#yearSpan") && ($("#yearSpan").textContent = year);

      if (pos.doot) {
        $("#dootWarn")?.removeAttribute("hidden");
        $("#moonName")    && ($("#moonName").textContent    = "Day Out of Time");
        $("#moonEssence") && ($("#moonEssence").textContent = "Pause · Reset");
        $("#moonLine")    && ($("#moonLine").textContent    = "DOOT — outside the 13×28 cadence");
        $("#dayInMoon")   && ($("#dayInMoon").textContent   = "—");
        const arc = $("#moonArc");
        if (arc) {
          const full = 316;
          arc.style.strokeDasharray = `1 ${full-1}`;
          arc.style.stroke = getComputedStyle(document.documentElement).getPropertyValue('--accent') || "#7aa8ff";
        }
        document.body.classList.add("theme-doot");
      } else {
        $("#dootWarn") && ($("#dootWarn").hidden = true);
        const md = MOONS[pos.moon - 1] || {};
        $("#moonName")    && ($("#moonName").textContent    = md.name || `Moon ${pos.moon}`);
        $("#moonEssence") && ($("#moonEssence").textContent = md.essence || "—");
        $("#moonLine")    && ($("#moonLine").textContent    = `Moon ${pos.moon} · Day ${pos.day} · Week ${pos.week}`);
        $("#dayInMoon")   && ($("#dayInMoon").textContent   = String(pos.day));
        const full = 316, cur = Math.max(1, Math.floor(((pos.day - 1) / 28) * full));
        const arc = $("#moonArc");
        if (arc) { arc.style.strokeDasharray = `${cur} ${full - cur}`; arc.style.stroke = md.color || "#7af3ff"; }
        document.body.classList.remove("theme-doot");
        setBodyThemes(pos.moon, pos.day);
        $("#essenceLive") && ($("#essenceLive").textContent = `${md.name} — ${md.essence}`);
      }

      // week dots
      const dotsWrap = $("#weekDots");
      if (dotsWrap) {
        dotsWrap.innerHTML = "";
        for (let wk = 1; wk <= 4; wk++) {
          const g = document.createElement("div"); g.className = "wdots";
          for (let d = 1; d <= 7; d++) {
            const i = (wk - 1) * 7 + d;
            const dot = document.createElement("i"); dot.className = "wdot";
            if (!pos.doot && i === pos.day) dot.classList.add("is-today");
            g.appendChild(dot);
          }
          dotsWrap.appendChild(g);
        }
      }

      buildYearMap(anchor);
      buildDualCalendars(anchor, pos);

      $("#datePick")  && ($("#datePick").value = wallIso(anchor, tz));
      $("#hourScrub") && ($("#hourScrub").value = String(anchor.getUTCHours())); // hour remains UTC-consistent
      $("#jumpMoon")  && ($("#jumpMoon").value  = pos.doot ? "" : String(pos.moon));

      $("#dbg") && ($("#dbg").textContent = JSON.stringify({ tz, anchor: wallIso(anchor, tz), pos }, null, 2));

      drawLunarPhase(anchor);
      ensureSky();
      ensureAstrology(anchor, tz);

      hideError();
    } catch (err) {
      console.error("[Moons] paint failed:", err);
      showError("Paint error: " + (err?.message || String(err)));
    }
  }

  /* --------------------------- Calendars/Map ----------------------------- */
  function buildDualCalendars(anchor, pos) { buildRemMonth(anchor, pos); buildGregMonth(anchor); }

  function buildRemMonth(anchor, pos) {
    const host = $("#remCal"); if (!host) return;
    host.innerHTML = "";
    const tz = getTZ();
    const yStart = remYearStart(anchor);
    const hdr = $("#remHdr");
    if (hdr) hdr.textContent = pos.doot ? "Remnant Month — DOOT" : `Remnant Month — ${MOONS[pos.moon - 1].name} (${pos.moon}/13)`;
    $("#remMeta") && ($("#remMeta").textContent = `13 × 28 fixed — ${tz}`);

    const grid = document.createElement("ol"); grid.className = "r-grid"; grid.setAttribute("role", "grid");
    ["D1","D2","D3","D4","D5","D6","D7"].forEach(l => {
      const th = document.createElement("li"); th.className = "r-lbl"; th.setAttribute("role","columnheader");
      th.textContent = l; grid.appendChild(th);
    });

    if (pos.doot) {
      const li = document.createElement("li"); li.className = "r-doot"; li.textContent = "Day Out of Time"; grid.appendChild(li);
    } else {
      const startIdx0 = (pos.moon - 1) * 28;
      for (let i = 0; i < 28; i++) {
        const idx0 = startIdx0 + i, dWall = wallForIndex(yStart, idx0);
        const cell = document.createElement("li"); cell.className = "r-day" + (((i+1)===pos.day) ? " is-today" : ""); cell.setAttribute("role","gridcell");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.dataset.r = isoDate(dWall);
        btn.dataset.moon = String(pos.moon);
        btn.dataset.day  = String(i+1);
        btn.title = new Intl.DateTimeFormat("en-US",{timeZone:tz,year:"numeric",month:"short",day:"2-digit"}).format(dWall) + " ("+tz+")";
        btn.textContent = String(i+1);
        btn.addEventListener("click", () => jumpTo(btn.dataset.r));
        cell.appendChild(btn); grid.appendChild(cell);
      }
    }
    host.appendChild(grid);
  }

  function buildGregMonth(anchor) {
    const host = $("#gregCal"); if (!host) return;
    host.innerHTML = "";

    const tz = getTZ();
    const {Y, M} = wallParts(anchor, tz); // wall-time year & month (1-12)

    const first     = atWall(Y, M, 1, 12, 0, 0, tz);
    const nextFirst = (M === 12) ? atWall(Y + 1, 1, 1, 12, 0, 0, tz)
                                 : atWall(Y, M + 1, 1, 12, 0, 0, tz);

    const daysIn  = Math.round((nextFirst - first) / 86400000);
    const firstDow = first.getUTCDay();

    $("#gregHdr")  && ($("#gregHdr").textContent = `Gregorian Month — ${new Intl.DateTimeFormat("en-US",{timeZone:tz,month:"long"}).format(first)} ${Y}`);
    $("#gregMeta") && ($("#gregMeta").textContent = "Variable weeks");

    const grid = document.createElement("ol"); grid.className = "g-grid"; grid.setAttribute("role","grid");
    ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].forEach(l => {
      const th = document.createElement("li"); th.className = "g-lbl"; th.setAttribute("role","columnheader"); th.textContent = l; grid.appendChild(th);
    });
    for (let i=0;i<firstDow;i++){
      const padc=document.createElement("li"); padc.className="g-pad"; padc.setAttribute("aria-hidden","true"); grid.appendChild(padc);
    }

    const todayYMD = wallIso(new Date(), tz);
    for (let d=1; d<=daysIn; d++){
      const dWall   = atWall(Y, M, d, 12, 0, 0, tz);
      const isToday = (wallIso(dWall, tz) === todayYMD);
      const li = document.createElement("li"); li.className = "g-day" + (isToday ? " is-today" : ""); li.setAttribute("role","gridcell");
      const btn = document.createElement("button"); btn.type = "button"; btn.dataset.g = wallIso(dWall, tz); btn.textContent = String(d);
      btn.addEventListener("click", () => jumpTo(btn.dataset.g));
      li.appendChild(btn); grid.appendChild(li);
    }
    host.appendChild(grid);
  }

  function buildYearMap(anchor) {
    const tbody = $("#yearMap tbody"); if (!tbody) return;
    const tz = getTZ();
    const yStart = remYearStart(anchor);
    const rows = [];
    for (let i = 0; i < 13; i++) {
      const s = wallForIndex(yStart, i * 28);
      const e = addDaysUTC(s, 27);
      rows.push({ i: i + 1, s, e, name: MOONS[i].name, essence: MOONS[i].essence });
    }
    const fmt = d => new Intl.DateTimeFormat("en-US",{timeZone:tz,year:"numeric",month:"short",day:"2-digit"}).format(d);
    tbody.innerHTML = rows.map(r =>
      `<tr><td>${r.i}</td><td>${r.name}</td><td>${r.essence}</td><td>${fmt(r.s)} <span class="tag mono">${tz}</span></td><td>${fmt(r.e)} <span class="tag mono">${tz}</span></td></tr>`
    ).join("");

    const pos = remPos(anchor), info = $("#nextMoonInfo");
    if (!info) return;
    if (!pos.doot) {
      const nextStart = wallForIndex(yStart, (pos.moon % 13) * 28);
      const label = new Intl.DateTimeFormat("en-US",{timeZone:tz,month:"short",day:"2-digit"}).format(nextStart);
      info.textContent = `Next: ${MOONS[pos.moon % 13].name} begins ${label} (${tz})`;
    } else {
      info.textContent = "This is the Day Out of Time — the count resumes tomorrow.";
    }
  }

  /* ----------------------------- Lunar phase ----------------------------- */
  function drawLunarPhase(anchor) {
    const c = $("#simMoon"); if (!c) return;
    const ctx = c.getContext && c.getContext("2d"); if (!ctx) return;
    const W = c.width, H = c.height, R = Math.min(W, H) * 0.42;
    ctx.clearRect(0,0,W,H);

    const syn = 29.5306;
    const base = Date.UTC(2001,0,6,18,14,0);
    const age = ((anchor - base) / 86400000) % syn;
    const phase = (age + syn) % syn;
    const k = Math.abs(phase - syn/2) / (syn/2);
    const illum = 1 - k;

    const cx=W/2, cy=H/2;
    ctx.fillStyle="#090e17"; ctx.beginPath(); ctx.arc(cx,cy,R+4,0,Math.PI*2); ctx.fill();
    ctx.shadowColor="rgba(0,0,0,.6)"; ctx.shadowBlur=12;
    ctx.fillStyle="#e8edf6"; ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0;

    const waxing = phase < (syn/2);
    const rx = R * Math.cos((phase / syn) * Math.PI * 2);
    ctx.globalCompositeOperation="destination-out";
    ctx.beginPath(); ctx.ellipse(cx + (waxing ? -rx : rx), cy, Math.abs(rx), R, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation="source-over";

    $("#phaseLine") && ($("#phaseLine").textContent = `Phase: ${waxing?"Waxing":"Waning"} — ${(illum*100).toFixed(0)}% lit`);
    $("#phaseMeta") && ($("#phaseMeta").textContent = `Age ≈ ${phase.toFixed(1)} d · Synodic ≈ 29.53 d`);
  }

  /* --------------------------- Animated sky bg --------------------------- */
  let skyOnce=false;
  function ensureSky(){
    if(skyOnce) return;
    const canvas=$("#skyBg"); if(!canvas) return;
    const ctx=canvas.getContext && canvas.getContext("2d"); if (!ctx) return;
    const DPR=Math.max(1, Math.min(2, window.devicePixelRatio||1));
    let W,H,stars=[]; const reduce=matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
    function resize(){
      const r=canvas.getBoundingClientRect(); W=Math.floor(r.width*DPR); H=Math.floor(r.height*DPR);
      canvas.width=W; canvas.height=H;
      stars=new Array(Math.floor((W*H)/(12000*DPR))).fill(0).map(()=>({x:Math.random()*W,y:Math.random()*H,r:Math.random()*(1.4*DPR)+0.3*DPR,s:Math.random()*0.8+0.2}));
    }
    resize(); addEventListener("resize",resize);
    function tick(t){
      ctx.clearRect(0,0,W,H);
      const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,"#06080e"); g.addColorStop(1,"#0b0f16");
      ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
      ctx.globalAlpha=0.18; ctx.fillStyle="rgba(122,243,255,.08)";
      const R=Math.min(W,H)*0.35; ctx.beginPath(); ctx.arc(W*0.8,H*0.15,R,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
      ctx.fillStyle="#cfe6ff";
      for(const s of stars){
        const flick=reduce?1:(0.75+0.25*Math.sin((t/1000)*(0.5+s.s)+s.x));
        ctx.globalAlpha=0.6*flick; ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha=1; if(!reduce) requestAnimationFrame(tick);
    }
    if(!reduce) requestAnimationFrame(tick);
    skyOnce=true;
  }

  /* ----------------------------- Astrology demo -------------------------- */
  function ensureAstrology(anchor, tz) {
    const wheel=$("#astroWheel"); if(!wheel) return;
    const labels=$("#signLabels"); const dots=$("#planetDots");

    if(labels && !labels.hasChildNodes()){
      const SIG=["♈︎","♉︎","♊︎","♋︎","♌︎","♍︎","♎︎","♏︎","♐︎","♑︎","♒︎","♓︎"];
      for(let i=0;i<12;i++){
        const ang=(i/12)*Math.PI*2 - Math.PI/2; const x=180+Math.cos(ang)*120; const y=180+Math.sin(ang)*120;
        const t=document.createElementNS("http://www.w3.org/2000/svg","text");
        t.setAttribute("x",x.toFixed(1)); t.setAttribute("y",y.toFixed(1)); t.textContent=SIG[i]; labels.appendChild(t);
      }
    }
    if(dots && !dots.hasChildNodes()){
      const PLAN=["sun","moon","mercury","venus","mars","jupiter","saturn"];
      PLAN.forEach((p)=>{const c=document.createElementNS("http://www.w3.org/2000/svg","circle"); c.setAttribute("r","4.6"); c.classList.add("dot"); c.dataset.dot=p; dots.appendChild(c);});
    }

    const reduce=matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
    if(reduce){
      $("#astroStamp") && ($("#astroStamp").textContent=new Date(anchor).toISOString().slice(0,19).replace("T"," "));
      $("#astroTZ")    && ($("#astroTZ").textContent=tz);
      $("#astroSource")&& ($("#astroSource").textContent=window.__EPHEMERIS__?"Ephemeris":"Demo");
      return;
    }

    let rafId=0;
    function animate(t){
      const nodes=$$("#planetDots .dot");
      nodes.forEach((n,i)=>{ const speed=0.0002+i*0.00008; const radius=60+i*10; const ang=(t*speed)+i*0.7; const x=180+Math.cos(ang)*radius; const y=180+Math.sin(ang)*radius;
        n.setAttribute("cx",x.toFixed(1)); n.setAttribute("cy",y.toFixed(1)); });
      $("#astroStamp") && ($("#astroStamp").textContent=new Date(anchor).toISOString().slice(0,19).replace("T"," "));
      $("#astroTZ")    && ($("#astroTZ").textContent=tz);
      $("#astroSource")&& ($("#astroSource").textContent=window.__EPHEMERIS__?"Ephemeris":"Demo");
      rafId=requestAnimationFrame(animate);
    }
    if (rafId) cancelAnimationFrame(rafId);
    rafId=requestAnimationFrame(animate);
  }

  /* ------------------------------- Actions -------------------------------- */
  function jumpTo(ymd) {
    const qp = new URLSearchParams(location.search);
    qp.set("date", ymd); qp.set("pin", "1");
    history.replaceState(null, "", `${location.pathname}?${qp.toString()}`);
    paint();
  }

  /* -------------------------- Time-Zone Picker --------------------------- */
  function populateTZs() {
    const sel = $("#tzPick"); if (!sel) return;
    let zones = [];
    try { if (Intl.supportedValuesOf) zones = Intl.supportedValuesOf("timeZone"); } catch {}
    if (!zones || zones.length === 0) {
      zones = ["UTC","America/Los_Angeles","America/Denver","America/Chicago","America/New_York","Europe/London","Europe/Paris","Europe/Berlin","Europe/Athens","Asia/Jerusalem","Asia/Dubai","Asia/Kolkata","Asia/Tokyo","Australia/Sydney"];
    }
    const cur = getTZ();
    sel.innerHTML = zones.map(z => `<option value="${z}" ${z===cur?'selected':''}>${z}</option>`).join("");
    sel.addEventListener("change", (e) => {
      const qp = new URLSearchParams(location.search);
      qp.set("tz", e.target.value);
      history.replaceState(null, "", `${location.pathname}?${qp.toString()}`);
      paint();
    });
    $("#resetTZ")?.addEventListener("click", () => {
      const qp = new URLSearchParams(location.search);
      qp.set("tz", "America/Los_Angeles");
      history.replaceState(null, "", `${location.pathname}?${qp.toString()}`);
      paint();
    });
  }

  /* ------------------------------- ICS ----------------------------------- */
  function makeICS(dw) {
    const tz = getTZ();
    const yStart = remYearStart(dw);
    const labelYear = `${yStart.getUTCFullYear()}/${yStart.getUTCFullYear() + 1}`;
    const stamp = (() => {
      const d = new Date();
      return d.getUTCFullYear()+pad(d.getUTCMonth()+1)+pad(d.getUTCDate())+"T"+pad(d.getUTCHours())+pad(d.getUTCMinutes())+pad(d.getUTCSeconds())+"Z";
    })();
    const fmtDate = d => d.getUTCFullYear() + pad(d.getUTCMonth()+1) + pad(d.getUTCDate());
    const uuid = (typeof crypto !== "undefined" && crypto.randomUUID) ? () => crypto.randomUUID() : () => ("sof-" + Math.random().toString(36).slice(2));

    let ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Scroll of Fire//13 Moon//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n";
    for (let i = 0; i < 13; i++) {
      const s = wallForIndex(yStart, i * 28);
      const e = new Date(s); e.setUTCDate(e.getUTCDate() + 28);
      ics += "BEGIN:VEVENT\r\nUID:"+uuid()+"@scroll-of-fire\r\nDTSTAMP:"+stamp+"\r\nDTSTART;VALUE=DATE:"+fmtDate(s)+"\r\nDTEND;VALUE=DATE:"+fmtDate(e)+"\r\nSUMMARY:"+(i+1)+". "+MOONS[i].name+" Moon — "+labelYear+" ("+tz+")\r\nDESCRIPTION:"+MOONS[i].essence+"\r\nEND:VEVENT\r\n";
    }
    ics += "END:VCALENDAR\r\n";
    return new Blob([ics], { type: "text/calendar" });
  }

  /* ------------------------------ Wiring --------------------------------- */
  function wire() {
    try{
      hideError();

      // ICS actions
      $("#dlICS")?.addEventListener("click",(e)=>{e.preventDefault(); const blob=makeICS(getAnchor()); const a=e.currentTarget; a.href=URL.createObjectURL(blob); a.download="13-moon-year.ics";});
      $("#regenICS")?.addEventListener("click",()=>{ const a=$("#dlICS"); if(a) a.href="#"; });

      // Today / prev / next
      $("#btnToday")?.addEventListener("click",()=>{ const qp=new URLSearchParams(location.search); qp.delete("date"); qp.delete("pin"); history.replaceState(null,"",`${location.pathname}?${qp.toString()}`.replace(/\?$/,"")); paint();});
      $("#prevDay")?.addEventListener("click",()=>{ const prev = addDaysUTC(getAnchor(), -1); jumpTo(wallIso(prev, getTZ())); });
      $("#nextDay")?.addEventListener("click",()=>{ const next = addDaysUTC(getAnchor(), +1); jumpTo(wallIso(next, getTZ())); });

      // Date and moon jumpers
      $("#datePick")?.addEventListener("change",(ev)=>jumpTo(ev.target.value));
      $("#jumpMoon")?.addEventListener("change",(ev)=>{ const m=parseInt(ev.target.value||"0",10); if(!m) return; const a=getAnchor(), start=remYearStart(a); const target=wallForIndex(start,(m-1)*28); jumpTo(isoDate(target)); });

      // Live clock tick
      setInterval(()=>{ const el=$("#nowClock"); if(!el) return; el.textContent=new Intl.DateTimeFormat("en-GB",{timeZone:getTZ(),hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(new Date()); },1000);

      // Time zone selector
      populateTZs();

      // Hour scrubber → ?t (engine-owned) + repaint
      (function(){
        const s = $("#hourScrub"); if (!s) return;
        const apply = (h) => {
          const qp = new URLSearchParams(location.search);
          qp.set("t", String(h));
          history.replaceState(null, "", `${location.pathname}?${qp.toString()}`);
          paint();
        };
        s.addEventListener("input", e => apply(e.target.value));
      })();

      // First paint
      paint();

      // Paint probe in case something stopped early
      setTimeout(function () {
        const ok = ( $("#nowDate")?.textContent || "" ).trim() !== "—";
        if (!ok) {
          showError("Engine loaded but did not paint (check console for JS errors or a broken tag earlier in the DOM).");
          console.warn("[Moons probe] Engine didn’t paint. Common causes: an unclosed quote before this script, or a JS exception in moons.js.");
        }
      }, 650);
    }catch(err){
      console.error("[Moons] wire failed:",err);
      showError("Initialization error: " + (err?.message || String(err)));
    }
  }

  // Wire regardless of readyState (covers cached-fast loads)
  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", wire, { once: true });
  } else {
    wire();
  }

  // small debug hook
  window.__moons_debug = { getTZ, getAnchor, remPos, atWall, addDaysUTC, isoDate, wallIso, wallParts };
})();
