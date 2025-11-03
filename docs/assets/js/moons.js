<script>
/* ===========================================================================
   Remnant 13-Moon — Living Clock Engine (TZ-true, DST-safe, Leap/DOOT aware)
   v2025.11.03-a “Crown the Breath — Keep the Field Bright”
   ---------------------------------------------------------------------------
   Highlights
   - Single wall-time anchor (local noon) from ?date=YYYY-MM-DD&pin=1 or “today”
   - DOOT = Jul 25 (local tz), Year start = Jul 26 (local tz)
   - Skips Feb 29 *inside* 13×28 cadence, but shows it in the civil (Gregorian)
   - Motion-safe: background aurora is CSS; starfield is JS with reduced-motion guard
   - Auto theme per moon (body.classList: theme-moon-N + CSS vars)
   - Lunar phase simulator (approx), numerology, Remnant verse
   - Dual calendars + Year Map + .ics export
   - Keyboard: ↑/↓ day, ←/→ hour, T = today; click grid cells to pin date
   - Accessible roles/labels; defensive DOM checks
   =========================================================================== */

(function () {
  "use strict";

  /* -------------------------- Shortcuts & Guards -------------------------- */
  const $  = (sel, ctx=document) => ctx.querySelector(sel);
  const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
  const pad = (n) => String(n).padStart(2,"0");
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /* ------------------------ Minimal MoonTZ (fallback) --------------------- */
  // If your project already ships MoonTZ, we’ll use it. Otherwise this shim keeps
  // wall-time semantics (convert Date -> same instant *as seen* in tz).
  if (typeof window.MoonTZ === "undefined") {
    window.MoonTZ = {
      getTZ() {
        try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }
        catch { return "UTC"; }
      },
      wallParts(d, tz) {
        try {
          // Convert instant -> same wall clock in tz, then treat as UTC container
          const s = d.toLocaleString("en-US", { timeZone: tz });
          // Parse back as local; wrap to Date (local) then force to UTC container
          return new Date(s);
        } catch { return new Date(d); }
      },
      isoDateWall(d) {
        const tz = this.getTZ();
        const w = this.wallParts(d, tz);
        return `${w.getFullYear()}-${pad(w.getMonth()+1)}-${pad(w.getDate())}`;
      }
    };
  }

  /* ------------------------------ Dataset --------------------------------- */
  // Prefer external data if present: window.REMNANT_MOONS (or __MOONS__)
  const MOONS = (window.REMNANT_MOONS || window.__MOONS__ || [
    {"idx":1,"name":"Magnetic","essence":"Unify · Purpose","color":"#6FE7FF"},
    {"idx":2,"name":"Lunar","essence":"Polarize · Challenge","color":"#B1C7FF"},
    {"idx":3,"name":"Electric","essence":"Activate · Service","color":"#7AF3FF"},
    {"idx":4,"name":"Self-Existing","essence":"Define · Form","color":"#7BF3B8"},
    {"idx":5,"name":"Overtone","essence":"Empower · Radiance","color":"#FFD27A"},
    {"idx":6,"name":"Rhythmic","essence":"Organize · Equality","color":"#A7FFCF"},
    {"idx":7,"name":"Resonant","essence":"Channel · Attunement","color":"#7AF3FF"},
    {"idx":8,"name":"Galactic","essence":"Harmonize · Integrity","color":"#9BD3FF"},
    {"idx":9,"name":"Solar","essence":"Pulse · Intention","color":"#FFBC6F"},
    {"idx":10,"name":"Planetary","essence":"Perfect · Manifestation","color":"#FFD9A6"},
    {"idx":11,"name":"Spectral","essence":"Dissolve · Liberation","color":"#B8C7FF"},
    {"idx":12,"name":"Crystal","essence":"Dedicate · Cooperation","color":"#CFEFFF"},
    {"idx":13,"name":"Cosmic","essence":"Endure · Presence","color":"#E7D1FF"}
  ]);

  /* --------------------------- TZ + Wall helpers -------------------------- */
  const getTZ = () => MoonTZ.getTZ();
  const atWall = (y, m, d, hh=12, mm=0, ss=0) =>
    MoonTZ.wallParts(new Date(Date.UTC(y, m-1, d, hh, mm, ss)), getTZ());
  const isoDateWall = (d) => MoonTZ.isoDateWall(d);
  const nowWall = () => MoonTZ.wallParts(new Date(), getTZ());
  const addDaysUTC = (d, days) => { const nd = new Date(d.getTime()); nd.setUTCDate(nd.getUTCDate() + days); return nd; };
  const diffDaysUTC = (a, b) => Math.floor((a.getTime() - b.getTime()) / 86400000);
  const isLeap = (y) => (y%4===0 && (y%100!==0 || y%400===0));

  /* ----------------------- Single “wall-anchor” source -------------------- */
  function getWallAnchor() {
    const qp = new URLSearchParams(location.search);
    const pinned = qp.get("pin") === "1";
    const d = qp.get("date");
    if (pinned && d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const [Y,M,D] = d.split("-").map(Number);
      return atWall(Y, M, D, 12, 0, 0); // normalized to local noon
    }
    // Not pinned → “today” (local noon) and purge stale params for clarity
    if (qp.has("date") || qp.has("pin")) {
      qp.delete("date"); qp.delete("pin");
      history.replaceState(null, "", `${location.pathname}?${qp.toString()}`.replace(/\?$/,""));
    }
    const w = nowWall();
    return atWall(w.getUTCFullYear(), w.getUTCMonth()+1, w.getUTCDate(), 12, 0, 0);
  }

  /* ----------------------- Remnant calendar math ------------------------- */
  function remYearStart(dw) {
    const y = dw.getUTCFullYear();
    const jul26 = atWall(y, 7, 26, 12, 0, 0);
    return (dw < jul26) ? atWall(y-1, 7, 26, 12, 0, 0) : jul26;
  }
  function isDOOT(dw) {
    const start = remYearStart(dw);
    const y = start.getUTCFullYear();
    return isoDateWall(dw) === isoDateWall(atWall(y, 7, 25, 12, 0, 0));
  }
  function leapDaysBetween(start, end) {
    const y0 = start.getUTCFullYear();
    let hits = 0;
    for (let y of [y0, y0+1]) {
      if (!isLeap(y)) continue;
      const f = atWall(y, 2, 29, 12, 0, 0);
      if (f >= start && f <= end) hits++;
    }
    return hits;
  }
  function remnantPosition(dw) {
    if (isDOOT(dw)) return { doot: true };
    const start = remYearStart(dw);
    let days = diffDaysUTC(dw, start);
    days -= leapDaysBetween(start, dw);
    const clamped = clamp(days, 0, 363);
    const moon = Math.floor(clamped / 28) + 1;
    const day  = (clamped % 28) + 1;
    const week = Math.floor((day - 1) / 7) + 1;
    return { doot:false, moon, day, week, idxYear:clamped };
  }
  function wallDateForRemIdx(start, idx0) {
    let d = addDaysUTC(start, idx0);
    const leaps = leapDaysBetween(start, d);
    if (leaps > 0) d = addDaysUTC(d, leaps);
    return d;
  }

  /* --------------------------- Astrology / Verse -------------------------- */
  const VERSES = [
    {he:"יהוה אור־חיים", en:"YHWH is light of the living.", ref:"Ps 56:13"},
    {he:"נֵר יְהוָה נִשְׁמַת אָדָם", en:"The lamp of YHWH is the human breath.", ref:"Pr 20:27"},
    {he:"קַו־קָו זְעֵיר שָׁם", en:"Line by line, a little here, a little there.", ref:"Is 28:10"},
    {he:"הֲלֹא כֹה דְבָרִי כָּאֵשׁ", en:"Is not My word like fire?", ref:"Jer 23:29"},
    {he:"שָׁלוֹם רָב לְאֹהֲבֵי תוֹרָתֶךָ", en:"Great peace to those who love Your teaching.", ref:"Ps 119:165"}
  ];
  function pickVerse(seed){
    const i = seed % VERSES.length;
    return VERSES[i];
  }

  /* ------------------------------ Numerology ------------------------------ */
  function numerologyFor(dw, pos){
    // Simple: (moon, day) → energy number 1..9
    const energy = ((pos.moon + pos.day) % 9) || 9;
    const line = `Energy ${energy} · ${MOONS[pos.moon-1]?.name || "—"} ${pos.day}/28`;
    const meta = [
      "", // 0
      "1 — spark, initiative, first flame.",
      "2 — polarity, listening, bridge.",
      "3 — service, weaving, motion.",
      "4 — form, edges, measure.",
      "5 — radiance, hand, empowerment.",
      "6 — equality, balance, fields align.",
      "7 — resonance, attune, channel clean.",
      "8 — integrity, star lattice, law.",
      "9 — intention crowned; seed to fruit."
    ][energy];
    return {energy, line, meta};
  }

  /* ------------------------------ Lunar Phase ----------------------------- */
  // Meeus-lite: compute phase age (days since known new moon) for local wall date.
  function lunarPhaseFor(dw) {
    // Known new moon (UTC): 2000-01-06 18:14 UTC (approx)
    const K0 = Date.UTC(2000,0,6,18,14,0);
    const syn = 29.530588853 * 86400000; // mean synodic period
    const t = dw.getTime() - K0;
    const age = ((t % syn) + syn) % syn; // 0..syn
    const days = age / 86400000;
    const illum = 0.5 * (1 - Math.cos(2*Math.PI * (days / 29.530588853)));
    let name = "Waxing Crescent";
    const p = days;
    if (p < 1.0) name = "New Moon";
    else if (p < 6.382) name = "Waxing Crescent";
    else if (p < 8.382) name = "First Quarter";
    else if (p < 13.765) name = "Waxing Gibbous";
    else if (p < 15.765) name = "Full Moon";
    else if (p < 21.147) name = "Waning Gibbous";
    else if (p < 23.147) name = "Last Quarter";
    else if (p < 28.531) name = "Waning Crescent";
    else name = "New Moon";
    return { days: +days.toFixed(2), illum, name };
  }
  function paintLunarCanvas(phase){
    const c = $("#simMoon"); if (!c) return;
    const ctx = c.getContext("2d");
    const w = c.width, h = c.height;
    ctx.clearRect(0,0,w,h);
    const r = Math.min(w,h)*0.42, cx = w/2, cy=h/2;

    // Backdrop
    ctx.fillStyle = "#0a0f14";
    ctx.fillRect(0,0,w,h);

    // Moon disc
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
    const grad = ctx.createRadialGradient(cx-r*0.3, cy-r*0.3, r*0.2, cx,cy,r);
    grad.addColorStop(0, "rgba(255,255,255,0.9)");
    grad.addColorStop(1, "rgba(220,225,240,0.7)");
    ctx.fillStyle = grad; ctx.fill();

    // Shadow (basic terminator)
    const k = Math.cos(2*Math.PI*(phase.days/29.530588853)); // -1..1
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.ellipse(cx,cy, Math.abs(k)*r, r, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    // Rim glow
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
  }

  /* ----------------------------- Theme switch ----------------------------- */
  function applyMoonTheme(pos){
    const b = document.body;
    // Remove existing theme-moon-* classes
    (b.className.match(/theme-moon-\d+/g)||[]).forEach(c=>b.classList.remove(c));
    if (!pos.doot) b.classList.add(`theme-moon-${pos.moon}`); else b.classList.add("theme-doot");

    const m = MOONS[(pos.moon-1) % 13] || {};
    const root = document.documentElement;
    if (m.color) root.style.setProperty("--moon-accent", m.color);
    // An accent-2 that harmonizes
    if (m.color) root.style.setProperty("--moon-accent-2", m.color);

    // Motto / essence live
    $("#essenceLive") && ($("#essenceLive").textContent = m.essence || "—");
  }

  /* ----------------------------- Year label ------------------------------- */
  function yearLabelFor(dw) {
    const yStart = remYearStart(dw).getUTCFullYear();
    return `${yStart}/${yStart+1}`;
  }

  /* ----------------------------- Paint (master) --------------------------- */
  function paint() {
    const anchor = getWallAnchor();
    const tz = getTZ();
    const pos = remnantPosition(anchor);

    // Header chips
    $("#nowDate")  && ($("#nowDate").textContent  =
      new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday:"short", year:"numeric", month:"short", day:"2-digit" }).format(anchor));
    $("#nowClock") && ($("#nowClock").textContent =
      MoonTZ.wallParts(new Date(), tz).toTimeString().slice(0,8));
    $("#nowTZ")    && ($("#nowTZ").textContent    = tz);
    $("#yearSpan") && ($("#yearSpan").textContent = yearLabelFor(anchor));

    // Verse (deterministic by idxYear)
    const v = pickVerse(pos.doot ? 0 : pos.idxYear);
    $("#vHeb") && ($("#vHeb").textContent = v.he);
    $("#vEn")  && ($("#vEn").textContent  = v.en);
    $("#vRef") && ($("#vRef").textContent = v.ref);

    // DOOT / normal state
    if (pos.doot) {
      $("#dootWarn")?.removeAttribute("hidden");
      $("#moonName")    && ($("#moonName").textContent    = "Day Out of Time");
      $("#moonEssence") && ($("#moonEssence").textContent = "Pause · Reset");
      $("#moonLine")    && ($("#moonLine").textContent    = "DOOT — outside the 13×28 cadence");
      $("#dayInMoon")   && ($("#dayInMoon").textContent   = "—");
      const arc = $("#moonArc"); if (arc) { const full = 316; arc.style.strokeDasharray = `1 ${full-1}`; }
    } else {
      $("#dootWarn") && ($("#dootWarn").hidden = true);
      const moonData = MOONS[pos.moon - 1] || {};
      $("#moonName")    && ($("#moonName").textContent    = moonData.name || `Moon ${pos.moon}`);
      $("#moonEssence") && ($("#moonEssence").textContent = moonData.essence || "—");
      $("#moonLine")    && ($("#moonLine").textContent    = `Moon ${pos.moon} · Day ${pos.day} · Week ${pos.week}`);
      $("#dayInMoon")   && ($("#dayInMoon").textContent   = String(pos.day));
      const full = 316;
      const cur  = Math.max(1, Math.floor(((pos.day - 1) / 28) * full));
      const arc = $("#moonArc");
      if (arc) {
        arc.style.strokeDasharray = `${cur} ${full - cur}`;
        const color = moonData.color || getComputedStyle(document.documentElement).getPropertyValue('--moon-accent').trim();
        if (color) arc.style.stroke = color;
      }
    }

    // Week dots
    const dotsWrap = $("#weekDots");
    if (dotsWrap) {
      dotsWrap.innerHTML = "";
      for (let wk=1; wk<=4; wk++) {
        const group = document.createElement("div"); group.className = "wdots";
        for (let d=1; d<=7; d++) {
          const i = (wk-1)*7 + d;
          const dot = document.createElement("i");
          dot.className = "wdot";
          if (!pos.doot && i === pos.day) dot.classList.add("is-today");
          group.appendChild(dot);
        }
        dotsWrap.appendChild(group);
      }
    }

    // Numerology
    const num = numerologyFor(anchor, pos);
    $("#numLine") && ($("#numLine").textContent = num.line);
    $("#numMeta") && ($("#numMeta").textContent = num.meta);
    $("#energyQuote") && ($("#energyQuote").textContent = (pos.doot ? "Stand outside the count. Breathe and reset." : "Align intention with the tone of this day."));

    // Lunar phase
    const phase = lunarPhaseFor(anchor);
    $("#phaseLine") && ($("#phaseLine").textContent = `${phase.name} — ${Math.round(phase.illum*100)}% illuminated`);
    $("#phaseMeta") && ($("#phaseMeta").textContent = `Age: ${phase.days} days`);
    paintLunarCanvas(phase);

    // Build UI
    buildYearMap(anchor);
    buildDualCalendars(anchor, pos);

    // Controls reflect anchor
    $("#datePick")  && ($("#datePick").value  = isoDateWall(anchor));
    $("#hourScrub") && ($("#hourScrub").value = MoonTZ.wallParts(anchor, tz).getUTCHours());
    $("#jumpMoon")  && ($("#jumpMoon").value  = pos.doot ? "" : String(pos.moon));

    // Theme
    applyMoonTheme(pos);

    // Debug (optional)
    const dbg = $("#dbg");
    if (dbg) {
      dbg.textContent = JSON.stringify({
        tz, anchor: isoDateWall(anchor),
        doot: !!pos.doot, moon: pos.moon, day: pos.day, week: pos.week, idxYear: pos.idxYear
      }, null, 2);
    }
  }

  /* -------------------------- Year map builder ---------------------------- */
  function buildYearMap(dw) {
    const tbody = $("#yearMap tbody"); if (!tbody) return;
    const tz = getTZ();
    const start = remYearStart(dw);
    const rows = [];
    for (let i=0; i<13; i++) {
      const s = wallDateForRemIdx(start, i*28);
      const e = addDaysUTC(s, 27);
      rows.push({ i:i+1, s, e, name: MOONS[i].name, essence: MOONS[i].essence });
    }
    const fmt = (d) => new Intl.DateTimeFormat("en-US", { timeZone: tz, year:"numeric", month:"short", day:"2-digit" }).format(d);
    tbody.innerHTML = rows.map(r =>
      `<tr><td>${r.i}</td><td>${r.name}</td><td>${r.essence}</td><td>${fmt(r.s)} <span class="tag mono">${tz}</span></td><td>${fmt(r.e)} <span class="tag mono">${tz}</span></td></tr>`
    ).join("");

    const pos = remnantPosition(dw);
    const info = $("#nextMoonInfo");
    if (!info) return;
    if (!pos.doot) {
      const nextStart = wallDateForRemIdx(start, (pos.moon % 13) * 28);
      const label = new Intl.DateTimeFormat("en-US", { timeZone: tz, month:"short", day:"2-digit" }).format(nextStart);
      info.textContent = `Next: ${MOONS[pos.moon % 13].name} begins ${label} (${tz})`;
    } else {
      info.textContent = "This is the Day Out of Time — the count resumes tomorrow.";
    }
  }

  /* ----------------------- Dual calendar builders ------------------------ */
  function buildDualCalendars(wallAnchor, pos) {
    buildRemnantMonth(wallAnchor, pos);
    buildGregorianMonth(wallAnchor);
  }

  function buildRemnantMonth(wallAnchor, pos) {
    const host = $("#remCal"); if (!host) return;
    host.innerHTML = "";

    const tz = getTZ();
    const yStart = remYearStart(wallAnchor);

    const hdr = $("#remHdr");
    if (hdr) hdr.textContent = pos.doot ? "Remnant Month — DOOT" : `Remnant Month — ${MOONS[pos.moon-1].name} (${pos.moon}/13)`;
    $("#remMeta") && ($("#remMeta").textContent = `13 × 28 fixed — ${tz}`);

    const grid = document.createElement("ol");
    grid.className = "r-grid"; grid.setAttribute("role","grid");
    ["D1","D2","D3","D4","D5","D6","D7"].forEach(l => {
      const th = document.createElement("li");
      th.className = "r-lbl"; th.setAttribute("role","columnheader"); th.textContent = l;
      grid.appendChild(th);
    });

    if (pos.doot) {
      const li = document.createElement("li");
      li.className = "r-doot";
      li.textContent = "Day Out of Time";
      grid.appendChild(li);
    } else {
      const startIdx0 = (pos.moon - 1) * 28;
      for (let i=0; i<28; i++) {
        const idx0 = startIdx0 + i;
        const dWall = wallDateForRemIdx(yStart, idx0);
        const label = new Intl.DateTimeFormat("en-US", { timeZone: tz, year:"numeric", month:"short", day:"2-digit" }).format(dWall);

        const cell = document.createElement("li");
        cell.className = "r-day" + ((i+1)===pos.day ? " is-today" : "");
        cell.setAttribute("role","gridcell");

        const btn = document.createElement("button");
        btn.type = "button";
        btn.dataset.r = isoDateWall(dWall);
        btn.dataset.moon = String(pos.moon);
        btn.dataset.day = String(i+1);
        btn.title = `${label} (${tz})`;
        btn.textContent = String(i+1);
        btn.addEventListener("click", () => {
          const qp = new URLSearchParams(location.search);
          qp.set("date", btn.dataset.r);
          qp.set("pin", "1");
          history.replaceState(null, "", `${location.pathname}?${qp.toString()}`);
          paint();  // redraw to selected date
        });

        cell.appendChild(btn);
        grid.appendChild(cell);
      }
    }
    host.appendChild(grid);
  }

  function buildGregorianMonth(wallAnchor) {
    const host = $("#gregCal"); if (!host) return;
    host.innerHTML = "";

    const tz = getTZ();

    // Derive the civil Y/M from the anchor itself (wall-time)
    const a = MoonTZ.wallParts(wallAnchor, tz);
    const Y = a.getUTCFullYear();
    const M0 = a.getUTCMonth(); // 0..11

    // First day of this month @ local noon, next month @ local noon
    const first = atWall(Y, M0+1, 1, 12, 0, 0);
    const nextFirst = (M0===11) ? atWall(Y+1, 1, 1, 12, 0, 0) : atWall(Y, M0+2, 1, 12, 0, 0);
    const daysIn = Math.round((nextFirst - first) / 86400000);
    const firstDow = first.getUTCDay();

    $("#gregHdr")  && ($("#gregHdr").textContent = `Gregorian Month — ${new Intl.DateTimeFormat("en-US",{ timeZone: tz, month:"long"}).format(first)} ${Y}`);
    $("#gregMeta") && ($("#gregMeta").textContent = "Variable weeks");

    const grid = document.createElement("ol");
    grid.className = "g-grid"; grid.setAttribute("role","grid");
    ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].forEach(l => {
      const th = document.createElement("li");
      th.className = "g-lbl"; th.setAttribute("role","columnheader"); th.textContent = l;
      grid.appendChild(th);
    });
    for (let i=0; i<firstDow; i++) {
      const padCell = document.createElement("li");
      padCell.className = "g-pad"; padCell.setAttribute("aria-hidden","true");
      grid.appendChild(padCell);
    }

    const todayYMD = isoDateWall(atWall(
      nowWall().getUTCFullYear(),
      nowWall().getUTCMonth()+1,
      nowWall().getUTCDate(), 12,0,0
    ));

    for (let d=1; d<=daysIn; d++) {
      const dWall = atWall(Y, M0+1, d, 12, 0, 0);
      const isToday = (isoDateWall(dWall) === todayYMD);

      const li = document.createElement("li");
      li.className = "g-day" + (isToday ? " is-today" : "");
      li.setAttribute("role","gridcell");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.g = `${Y}-${pad(M0+1)}-${pad(d)}`;
      btn.textContent = String(d);
      btn.addEventListener("click", () => {
        const qp = new URLSearchParams(location.search);
        qp.set("date", btn.dataset.g);
        qp.set("pin", "1");
        history.replaceState(null, "", `${location.pathname}?${qp.toString()}`);
        paint();
      });

      li.appendChild(btn);
      grid.appendChild(li);
    }

    host.appendChild(grid);
  }

  /* ----------------------------- ICS export ------------------------------- */
  function buildICSBlob(dw) {
    const tz = getTZ();
    const yStart = remYearStart(dw);
    const labelYear = `${yStart.getUTCFullYear()}/${yStart.getUTCFullYear()+1}`;
    const stamp = (() => {
      const d = new Date();
      return d.getUTCFullYear() + pad(d.getUTCMonth()+1) + pad(d.getUTCDate()) +
             "T" + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + "Z";
    })();
    const fmtDate = (d) => d.getUTCFullYear() + pad(d.getUTCMonth()+1) + pad(d.getUTCDate());
    const uid = () => (crypto && crypto.randomUUID) ? crypto.randomUUID() : ("sof-" + Math.random().toString(36).slice(2));

    let ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Scroll of Fire//13 Moon//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n";
    for (let i=0; i<13; i++) {
      const s = wallDateForRemIdx(yStart, i*28);
      const e = addDaysUTC(s, 28); // exclusive DTEND
      ics += "BEGIN:VEVENT\r\n" +
             `UID:${uid()}@scroll-of-fire\r\n` +
             `DTSTAMP:${stamp}\r\n` +
             `DTSTART;VALUE=DATE:${fmtDate(s)}\r\n` +
             `DTEND;VALUE=DATE:${fmtDate(e)}\r\n` +
             `SUMMARY:${i+1}. ${MOONS[i].name} Moon — ${labelYear} (${tz})\r\n` +
             `DESCRIPTION:${MOONS[i].essence}\r\n` +
             "END:VEVENT\r\n";
    }
    ics += "END:VCALENDAR\r\n";
    return new Blob([ics], { type: "text/calendar" });
  }

  const dl = $("#dlICS");
  if (dl) {
    dl.addEventListener("click", (e) => {
      e.preventDefault();
      const blob = buildICSBlob(getWallAnchor());
      dl.href = URL.createObjectURL(blob);
      dl.download = "13-moon-year.ics";
    });
  }
  $("#regenICS")?.addEventListener("click", () => { if (dl) dl.href = "#"; });

  /* ------------------------------ Live clock ------------------------------ */
  setInterval(() => {
    const tz = getTZ();
    const el = $("#nowClock");
    if (el) el.textContent = MoonTZ.wallParts(new Date(), tz).toTimeString().slice(0,8);
  }, 1000);

  /* ------------------------------ Controls -------------------------------- */
  // Time zone picker
  (function hydrateTZ(){
    const s = $("#tzPick"); if (!s) return;
    let zones = ["UTC","America/Los_Angeles","America/Denver","America/Chicago","America/New_York"];
    try { if (Intl.supportedValuesOf) zones = Intl.supportedValuesOf("timeZone"); } catch {}
    const cur = getTZ();
    s.innerHTML = zones.map(z => `<option value="${z}" ${z===cur?"selected":""}>${z}</option>`).join("");
    s.addEventListener("change", () => paint());
    $("#resetTZ")?.addEventListener("click", () => { s.value="America/Los_Angeles"; paint(); });
  })();

  // Date & hour controls
  $("#datePick")?.addEventListener("input", (ev) => {
    const v = ev.target.value; if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
    const qp = new URLSearchParams(location.search);
    qp.set("date", v); qp.set("pin","1");
    history.replaceState(null,"",`${location.pathname}?${qp.toString()}`);
    paint();
  });
  $("#hourScrub")?.addEventListener("input", (ev) => {
    // Hour scrub doesn’t change the anchor date; it just updates the clock line visually
    const h = clamp(+ev.target.value|0, 0, 23);
    const tz = getTZ();
    const w = nowWall();
    w.setUTCHours(h, 0, 0, 0);
    $("#nowClock") && ($("#nowClock").textContent = w.toTimeString().slice(0,8));
  });

  // Today / step buttons
  $("#btnToday")?.addEventListener("click", forceToday);
  $("#prevDay")?.addEventListener("click", () => stepDays(-1));
  $("#nextDay")?.addEventListener("click", () => stepDays(+1));

  // Jump to moon start
  $("#jumpMoon")?.addEventListener("change", (ev) => {
    const m = parseInt(ev.target.value, 10);
    if (!m || m<1 || m>13) return;
    const start = remYearStart(getWallAnchor());
    const d = wallDateForRemIdx(start, (m-1)*28);
    const qp = new URLSearchParams(location.search);
    qp.set("date", isoDateWall(d)); qp.set("pin","1");
    history.replaceState(null,"",`${location.pathname}?${qp.toString()}`);
    paint();
  });

  // Share link
  $("#shareLink")?.addEventListener("click", async () => {
    const qp = new URLSearchParams(location.search);
    const a = getWallAnchor();
    qp.set("date", isoDateWall(a)); qp.set("pin","1");
    const url = `${location.origin}${location.pathname}?${qp.toString()}`;
    try { await navigator.clipboard.writeText(url); } catch {}
    $("#shareLink").textContent = "Copied ✓";
    setTimeout(()=>($("#shareLink").textContent="Copy Link"),1000);
  });

  // Keyboard navigation
  document.addEventListener("keydown", (e) => {
    if (e.key==="ArrowUp") { stepDays(+1); e.preventDefault(); }
    else if (e.key==="ArrowDown") { stepDays(-1); e.preventDefault(); }
    else if (e.key==="ArrowLeft") { stepHours(-1); e.preventDefault(); }
    else if (e.key==="ArrowRight") { stepHours(+1); e.preventDefault(); }
    else if (e.key.toLowerCase()==="t") { forceToday(); e.preventDefault(); }
  });

  function stepDays(delta){
    const a = getWallAnchor();
    const d = addDaysUTC(a, delta);
    const qp = new URLSearchParams(location.search);
    qp.set("date", isoDateWall(d)); qp.set("pin","1");
    history.replaceState(null,"",`${location.pathname}?${qp.toString()}`);
    paint();
  }
  function stepHours(delta){
    const scr = $("#hourScrub"); if (!scr) return;
    scr.value = String(clamp((+scr.value|0)+delta, 0, 23));
    scr.dispatchEvent(new Event("input", {bubbles:true}));
  }

  /* ------------------------------- Starfield ------------------------------ */
  (function starfield(){
    const c = $("#skyBg"); if (!c) return;
    const ctx = c.getContext("2d");
    const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

    function fit(){
      const b = c.getBoundingClientRect();
      c.width = Math.round(b.width * DPR);
      c.height = Math.round(b.height * DPR);
    }
    fit(); window.addEventListener("resize", fit, { passive:true });

    // Build stars (soft, sparse)
    const COUNT = 180;
    const stars = [];
    function seed(){
      stars.length = 0;
      for (let i=0;i<COUNT;i++){
        stars.push({
          x: Math.random()*c.width,
          y: Math.random()*c.height,
          r: (Math.random()*1.2+0.3)*DPR,
          a0: Math.random()*Math.PI*2,
          sp: 0.0008 + Math.random()*0.0016
        });
      }
    }
    seed();

    const reduceMotion = matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    function tick(t){
      ctx.clearRect(0,0,c.width,c.height);
      ctx.globalAlpha = 0.55; // softened brightness
      for (const s of stars){
        const tw = reduceMotion ? 0.08 : (0.15 + 0.10*Math.sin(s.a0 + t*s.sp));
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
        ctx.fillStyle = `rgba(240,244,255,${0.3 + tw})`;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (!reduceMotion) requestAnimationFrame(tick);
    }
    if (!reduceMotion) requestAnimationFrame(tick);
    else tick(0);
  })();

  /* ------------------------------ Kickoff --------------------------------- */
  window.paint = paint; // optional external access
  paint();

  /* Helpers exposed */
  window.forceToday = function(){
    const qp = new URLSearchParams(location.search);
    qp.delete("date"); qp.delete("pin");
    history.replaceState(null,"",`${location.pathname}?${qp.toString()}`.replace(/\?$/,""));
    paint();
  };

})();
</script>
