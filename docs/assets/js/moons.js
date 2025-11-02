<script>
/* Remnant 13-Moon — main logic (TZ-true mapping, dual calendar, ICS export)
   v2025.11.02-d “Crown to Coast — Leap-true”
   - Anchors all wall-time math to MoonTZ.getTZ()
   - DOOT = Jul 25 (local tz), Year start = Jul 26 (local tz)
   - Skips Feb 29 inside 13×28 cadence (checks FY and FY+1 windows)
   - Honors ?date=YYYY-MM-DD only when pin=1; else “today”
   - Defensive: no-ops if elements are missing; won’t crash
*/
(function () {
  "use strict";

  /* ----------------------------- Shortcuts -------------------------------- */
  const $  = (sel, ctx=document) => ctx.querySelector(sel);
  const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
  const pad = (n) => String(n).padStart(2,"0");
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /* ------------------------------ Dataset --------------------------------- */
  const MOONS = (window.__MOONS__ || [
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
  const atWall = (y, m, d, hh=0, mm=0, ss=0) =>
    MoonTZ.wallParts(new Date(Date.UTC(y, m-1, d, hh, mm, ss)), getTZ());
  const isoDateWall = (d) => MoonTZ.isoDateWall(d);
  const nowWall = () => MoonTZ.nowWall();
  const addDaysUTC = (d, days) => { const nd = new Date(d.getTime()); nd.setUTCDate(nd.getUTCDate() + days); return nd; };
  const diffDaysUTC = (a, b) => Math.floor((a.getTime() - b.getTime()) / 86400000);
  const isLeap = (y) => (y%4===0 && (y%100!==0 || y%400===0));

  /* ----------------------- Query param date handling ---------------------- */
  function initialWallDate() {
    const qp = new URLSearchParams(location.search);
    const pinned = qp.get("pin") === "1";
    const d = qp.get("date");
    if (pinned && d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const [Y,M,D] = d.split("-").map(Number);
      return atWall(Y, M, D, 12, 0, 0); // noon avoids DST edges
    }
    return nowWall();
  }

  /* ----------------------- Remnant calendar math ------------------------- */
  // Jul 26 (wall tz) starts the Remnant year containing dw
  function remYearStart(dw) {
    const y = dw.getUTCFullYear();
    const jul26 = atWall(y, 7, 26, 0, 0, 0);
    return (dw < jul26) ? atWall(y-1, 7, 26, 0, 0, 0) : jul26;
  }

  // Is the wall date DOOT (Jul 25 in this Remnant year’s base)?
  function isDOOT(dw) {
    const start = remYearStart(dw);
    const y = start.getUTCFullYear();
    return isoDateWall(dw) === isoDateWall(atWall(y, 7, 25));
  }

  // Count how many Feb 29 wall-days occur in (start..=end)
  function leapDaysBetween(start, end) {
    // Feb 29 can only appear in start’s civil year or start+1
    const y0 = start.getUTCFullYear();
    let hits = 0;
    for (let y of [y0, y0+1]) {
      if (!isLeap(y)) continue;
      const f = atWall(y, 2, 29);
      if (f >= start && f <= end) hits++;
    }
    return hits;
  }

  // For a wall date, return Remnant position or DOOT
  function remnantPosition(dw) {
    if (isDOOT(dw)) return { doot: true };
    const start = remYearStart(dw);

    let days = diffDaysUTC(dw, start);
    // Skip each Feb 29 that falls within the cadence window
    days -= leapDaysBetween(start, dw);

    const clamped = clamp(days, 0, 363);
    const moon = Math.floor(clamped / 28) + 1;
    const day  = (clamped % 28) + 1;
    const week = Math.floor((day - 1) / 7) + 1;
    return { doot:false, moon, day, week };
  }

  // Wall date for the Nth day (0-based idx) of the Remnant year, skipping Feb 29
  function wallDateForRemIdx(start, idx0) {
    // March forward from the start by idx0 + number of Feb 29s encountered up to that date
    let d = addDaysUTC(start, idx0);
    // If a Feb 29 exists between start..=d, add one day to skip it
    const leaps = leapDaysBetween(start, d);
    if (leaps > 0) d = addDaysUTC(d, leaps);
    return d;
  }

  /* ----------------------------- Painting -------------------------------- */
  function yearLabelFor(dw) {
    const yStart = remYearStart(dw).getUTCFullYear();
    return `${yStart}/${yStart+1}`;
  }

  function paint() {
    const w  = initialWallDate();
    const tz = getTZ();
    const pos = remnantPosition(w);

    // Header chips
    $("#nowDate")  && ($("#nowDate").textContent  =
      new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday:"short", year:"numeric", month:"short", day:"2-digit" }).format(w));
    $("#nowClock") && ($("#nowClock").textContent = MoonTZ.wallParts(new Date(), tz).toTimeString().slice(0,8));
    $("#nowTZ")    && ($("#nowTZ").textContent    = tz);

    // Year span label (always startYear/startYear+1)
    $("#yearSpan") && ($("#yearSpan").textContent = yearLabelFor(w));

    // DOOT + header line
    if (pos.doot) {
      $("#dootWarn") && ($("#dootWarn").hidden = false);
      $("#moonName") && ($("#moonName").textContent = "Day Out of Time");
      $("#moonEssence") && ($("#moonEssence").textContent = "Pause · Reset");
      $("#moonLine") && ($("#moonLine").textContent = "DOOT — outside the 13×28 cadence");
      $("#dayInMoon") && ($("#dayInMoon").textContent = "—");
      const arc = $("#moonArc"); if (arc) { const full = 316; arc.style.strokeDasharray = `1 ${full-1}`; }
    } else {
      $("#dootWarn") && ($("#dootWarn").hidden = true);
      const moonData = MOONS[pos.moon - 1] || {};
      $("#moonName")    && ($("#moonName").textContent    = moonData.name || `Moon ${pos.moon}`);
      $("#moonEssence") && ($("#moonEssence").textContent = moonData.essence || "—");
      $("#moonLine")    && ($("#moonLine").textContent    = `Moon ${pos.moon} · Day ${pos.day} · Week ${pos.week}`);
      $("#dayInMoon")   && ($("#dayInMoon").textContent   = String(pos.day));

      // Ring arc
      const full = 316;
      const cur  = Math.max(1, Math.floor(((pos.day - 1) / 28) * full));
      const arc = $("#moonArc"); if (arc) {
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

    buildYearMap(w);
    buildDualCalendars(w, pos);

    // Controls (if present)
    $("#datePick")   && ($("#datePick").value   = isoDateWall(w));
    $("#hourScrub")  && ($("#hourScrub").value  = MoonTZ.wallParts(w, tz).getUTCHours());
    $("#jumpMoon")   && ($("#jumpMoon").value   = pos.doot ? "" : String(pos.moon));
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
  function buildDualCalendars(wallNow, pos) {
    buildRemnantMonth(wallNow, pos);
    buildGregorianMonth(wallNow);
  }

  function buildRemnantMonth(wallNow, pos) {
    const host = $("#remCal"); if (!host) return;
    host.innerHTML = "";

    const tz = getTZ();
    const yStart = remYearStart(wallNow);

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
          paint();  // redraw to the selected date
        });

        cell.appendChild(btn);
        grid.appendChild(cell);
      }
    }
    host.appendChild(grid);
  }

  function buildGregorianMonth(wallNow) {
    const host = $("#gregCal"); if (!host) return;
    host.innerHTML = "";

    const tz = getTZ();
    const wall = MoonTZ.wallParts(wallNow, tz);
    const y = wall.getUTCFullYear();
    const m = wall.getUTCMonth(); // 0..11

    const first = atWall(y, m+1, 1);
    const nextFirst = (m===11) ? atWall(y+1, 1, 1) : atWall(y, m+2, 1);
    const daysIn = Math.round((nextFirst - first) / 86400000);
    const firstDow = first.getUTCDay();

    $("#gregHdr")  && ($("#gregHdr").textContent = `Gregorian Month — ${new Intl.DateTimeFormat("en-US",{ timeZone: tz, month:"long"}).format(first)} ${y}`);
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

    const todayYMD = isoDateWall(nowWall());
    for (let d=1; d<=daysIn; d++) {
      const dWall = atWall(y, m+1, d);
      const isToday = (isoDateWall(dWall) === todayYMD);

      const li = document.createElement("li");
      li.className = "g-day" + (isToday ? " is-today" : "");
      li.setAttribute("role","gridcell");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.g = `${y}-${pad(m+1)}-${pad(d)}`;
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
      const blob = buildICSBlob(initialWallDate());
      dl.href = URL.createObjectURL(blob);
      dl.download = "13-moon-year.ics";
    });
  }
  $("#regenICS")?.addEventListener("click", () => { if (dl) dl.href = "#"; });

  /* ----------------------------- Live clock ------------------------------- */
  setInterval(() => {
    const tz = getTZ();
    const el = $("#nowClock");
    if (el) el.textContent = MoonTZ.wallParts(new Date(), tz).toTimeString().slice(0,8);
  }, 1000);

  /* ------------------------------ Kickoff --------------------------------- */
  window.paint = paint; // optional external access
  paint();
})();
</script>
