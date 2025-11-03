/* =======================================================================
   Scroll of Fire — 13 Moons Engine (moons.js)
   No deps • mobile-first • TZ-true wall-time handling
   Wires: tz/date/hour controls · dual calendars · year map · lunar phase
   · practices/verse/numerology · .ics generator · URL pinning
   ======================================================================= */
(function () {
  "use strict";

  /* ---------------------------- Guards ---------------------------------- */
  const MOONS = (window.MoonData && MoonData.moons?.length === 13)
    ? MoonData.moons
    : (window.__MOONS__ && __MOONS__.length === 13 ? __MOONS__ : null);

  if (!MOONS) {
    console.warn("[Moons] Missing MOONS dataset; the page will use the HTML fallback.");
    return;
  }

  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const pad = (n) => String(n).padStart(2, "0");

  /* --------------------------- Time helpers ----------------------------- */
  const MoonTZ = window.MoonTZ || {
    getTZ() {
      try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }
      catch { return "UTC"; }
    },
    wallParts(d, tz) {
      try {
        tz = tz || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
        const fmt = new Intl.DateTimeFormat("en-CA", {
          timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
        });
        const parts = Object.fromEntries(fmt.formatToParts(d).map(p => [p.type, p.value]));
        const iso = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
        return new Date(iso + "Z"); // a UTC Date that carries local wall fields
      } catch { return new Date(d); }
    },
    isoDateWall(d) {
      const y = d.getUTCFullYear();
      const m = pad(d.getUTCMonth() + 1);
      const da = pad(d.getUTCDate());
      return `${y}-${m}-${da}`;
    }
  };

  const getTZ = () => (localStorage.getItem("sof.tz") || MoonTZ.getTZ());
  const setTZ = (tz) => { try { localStorage.setItem("sof.tz", tz); } catch {} };

  const atWall = (y, m, d, hh = 12, mm = 0, ss = 0, tz = getTZ()) =>
    MoonTZ.wallParts(new Date(Date.UTC(y, m - 1, d, hh, mm, ss)), tz);

  const nowWall = (tz = getTZ()) => MoonTZ.wallParts(new Date(), tz);

  const isoDateWall = (d) => MoonTZ.isoDateWall(d);

  const addDaysUTC = (d, days) => { const nd = new Date(d.getTime()); nd.setUTCDate(nd.getUTCDate() + days); return nd; };
  const diffDaysUTC = (a, b) => Math.floor((a - b) / 86400000);
  const isLeap = (y) => (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0));

  /* -------------------------- Remnant calendar -------------------------- */
  function remYearStart(dw) {
    const y = dw.getUTCFullYear();
    const jul26 = atWall(y, 7, 26, 12, 0, 0);
    return (dw < jul26) ? atWall(y - 1, 7, 26, 12, 0, 0) : jul26;
  }
  function isDOOT(dw) {
    const start = remYearStart(dw);
    const y = start.getUTCFullYear();
    return isoDateWall(dw) === isoDateWall(atWall(y, 7, 25, 12, 0, 0));
  }
  function leapDaysBetween(start, end) {
    const y0 = start.getUTCFullYear();
    let hits = 0;
    for (let y of [y0, y0 + 1]) {
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
    const clamped = Math.max(0, Math.min(363, days));
    const moon = Math.floor(clamped / 28) + 1;
    const day = (clamped % 28) + 1;
    const week = Math.floor((day - 1) / 7) + 1;
    return { doot: false, moon, day, week, idxYear: clamped };
  }
  function wallDateForRemIdx(start, idx0) {
    let d = addDaysUTC(start, idx0);
    const leaps = leapDaysBetween(start, d);
    if (leaps > 0) d = addDaysUTC(d, leaps);
    return d;
  }
  function yearLabelFor(dw) {
    const yStart = remYearStart(dw).getUTCFullYear();
    return `${yStart}/${yStart + 1}`;
  }

  /* --------------------------- URL pin helpers -------------------------- */
  function getAnchorFromURL(tz = getTZ()) {
    const qp = new URLSearchParams(location.search);
    const pinned = qp.get("pin") === "1";
    const d = qp.get("date");
    const h = qp.get("hour");
    if (pinned && d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const [Y, M, D] = d.split("-").map(Number);
      const H = (h && /^\d{1,2}$/.test(h)) ? Math.min(23, Math.max(0, Number(h))) : 12;
      return atWall(Y, M, D, H, 0, 0, tz);
    }
    if (qp.has("date") || qp.has("pin") || qp.has("hour")) {
      qp.delete("date"); qp.delete("pin"); qp.delete("hour");
      history.replaceState(null, "", `${location.pathname}?${qp.toString()}`.replace(/\?$/, ""));
    }
    const w = nowWall(tz);
    return atWall(w.getUTCFullYear(), w.getUTCMonth() + 1, w.getUTCDate(), w.getUTCHours(), w.getUTCMinutes(), 0, tz);
  }
  function pinToURL(dateISO, hour) {
    const qp = new URLSearchParams(location.search);
    qp.set("date", dateISO);
    qp.set("hour", String(hour));
    qp.set("pin", "1");
    history.replaceState(null, "", `${location.pathname}?${qp.toString()}`);
  }

  /* ------------------------- Timezone selector -------------------------- */
  function buildTZSelect() {
    const sel = $("#tzPick");
    if (!sel) return;
    let zones = [];
    try {
      zones = Intl.supportedValuesOf ? Intl.supportedValuesOf("timeZone") : [];
    } catch {}
    if (!zones || zones.length === 0) zones = ["America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York", "UTC"];

    const current = getTZ();
    sel.innerHTML = zones
      .map(z => `<option value="${z}">${z}</option>`)
      .join("");
    sel.value = current;
    sel.addEventListener("change", () => {
      setTZ(sel.value);
      window.paint?.();
    });

    $("#resetTZ")?.addEventListener("click", () => {
      setTZ("America/Los_Angeles");
      if (sel) sel.value = "America/Los_Angeles";
      window.paint?.();
    });
  }

  /* ------------------------------ UI wiring ----------------------------- */
  const ui = {
    nowDate:  $("#nowDate"),
    nowClock: $("#nowClock"),
    nowTZ:    $("#nowTZ"),
    yearSpan: $("#yearSpan"),
    moonName: $("#moonName"),
    moonEss:  $("#moonEssence"),
    moonLine: $("#moonLine"),
    dayInMoon: $("#dayInMoon"),
    moonArc:  $("#moonArc"),
    weekDots: $("#weekDots"),
    dootWarn: $("#dootWarn"),
    datePick: $("#datePick"),
    hourScrub: $("#hourScrub"),
    jumpMoon: $("#jumpMoon"),
    gregCal: $("#gregCal"),
    remCal: $("#remCal"),
    yearMapBody: $("#yearMap tbody"),
    nextMoonInfo: $("#nextMoonInfo"),
    dlICS: $("#dlICS"),
    simMoon: $("#simMoon"),
    phaseLine: $("#phaseLine"),
    phaseMeta: $("#phaseMeta"),
    numLine: $("#numLine"),
    numMeta: $("#numMeta"),
    energyQuote: $("#energyQuote"),
    verseBox: $("#verseBox"),
    vHeb: $("#vHeb"), vEn: $("#vEn"), vRef: $("#vRef"),
    essenceLive: $("#essenceLive"),
    practiceList: $("#practiceList"),
    noteText: $("#noteText")
  };

  /* ---------------------- Lunar phase (fast + pretty) ------------------- */
  // Simple synodic phase from epoch 2000-01-06 18:14 UT (near new moon)
  function lunarPhaseInfo(anchorUTC) {
    const synodic = 29.530588853;
    const epoch = Date.UTC(2000, 0, 6, 18, 14, 0);
    const days = (anchorUTC.getTime() - epoch) / 86400000;
    let age = (days % synodic + synodic) % synodic;
    const illum = (1 - Math.cos(2 * Math.PI * age / synodic)) / 2; // 0=new, 1=full
    let name = "New Moon";
    const deg = (age / synodic) * 360;
    if (deg >= 1 && deg < 89) name = "Waxing Crescent";
    else if (deg >= 89 && deg < 91) name = "First Quarter";
    else if (deg >= 91 && deg < 179) name = "Waxing Gibbous";
    else if (deg >= 179 && deg < 181) name = "Full Moon";
    else if (deg >= 181 && deg < 269) name = "Waning Gibbous";
    else if (deg >= 269 && deg < 271) name = "Last Quarter";
    else if (deg >= 271 && deg < 359) name = "Waning Crescent";

    return { ageDays: age, illumination: illum, phaseName: name, deg };
  }
  function drawLunarPhase(canvas, info) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0,0,w,h);
    const r = Math.min(w, h) * 0.42, cx = w/2, cy = h/2;

    // background
    ctx.fillStyle = "#0c0f16";
    ctx.fillRect(0,0,w,h);

    // moon disc
    ctx.fillStyle = "#111622";
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();

    // illuminated portion (simple circle clipping trick)
    const k = 2 * info.illumination - 1; // -1 .. 1
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.clip();

    ctx.fillStyle = "#f2f6ff";
    ctx.beginPath();
    ctx.ellipse(cx + k*r, cy, Math.abs(r*k), r, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();

    // rim
    ctx.strokeStyle = "#1f2a3d"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();
  }

  /* --------------------------- .ics generator --------------------------- */
  function buildICSBlob(dw) {
    const tz = getTZ();
    const yStart = remYearStart(dw);
    const labelYear = `${yStart.getUTCFullYear()}/${yStart.getUTCFullYear() + 1}`;
    const stamp = (() => {
      const d = new Date();
      return d.getUTCFullYear()
        + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate())
        + "T" + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + "Z";
    })();
    const fmtDate = (d) => d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate());
    const uid = () => (crypto && crypto.randomUUID) ? crypto.randomUUID() : ("sof-" + Math.random().toString(36).slice(2));
    let ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Scroll of Fire//13 Moon//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n";
    for (let i = 0; i < 13; i++) {
      const s = wallDateForRemIdx(yStart, i * 28);
      const e = new Date(s); e.setUTCDate(e.getUTCDate() + 28);
      ics += "BEGIN:VEVENT\r\n"
        + "UID:" + uid() + "@scroll-of-fire\r\n"
        + "DTSTAMP:" + stamp + "\r\n"
        + "DTSTART;VALUE=DATE:" + fmtDate(s) + "\r\n"
        + "DTEND;VALUE=DATE:" + fmtDate(e) + "\r\n"
        + "SUMMARY:" + (i + 1) + ". " + MOONS[i].name + " Moon — " + labelYear + " (" + tz + ")\r\n"
        + "DESCRIPTION:" + MOONS[i].essence + "\r\n"
        + "END:VEVENT\r\n";
    }
    ics += "END:VCALENDAR\r\n";
    return new Blob([ics], { type: "text/calendar" });
  }

  /* ------------------------------ Builders ------------------------------ */
  function buildWeekDots(target, pos) {
    if (!target) return;
    target.innerHTML = "";
    for (let wk = 1; wk <= 4; wk++) {
      const g = document.createElement("div");
      g.className = "wdots";
      for (let d = 1; d <= 7; d++) {
        const i = (wk - 1) * 7 + d;
        const dot = document.createElement("i");
        dot.className = "wdot";
        if (!pos.doot && i === pos.day) dot.classList.add("is-today");
        g.appendChild(dot);
      }
      target.appendChild(g);
    }
  }

  function buildYearMap(dw) {
    const tbody = ui.yearMapBody;
    if (!tbody) return;
    const tz = getTZ();
    const start = remYearStart(dw);
    const rows = [];
    for (let i = 0; i < 13; i++) {
      const s = wallDateForRemIdx(start, i * 28);
      const e = addDaysUTC(s, 27);
      rows.push({ i: i + 1, s, e, name: MOONS[i].name, essence: MOONS[i].essence });
    }
    const fmt = (d) => new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "short", day: "2-digit" }).format(d);
    tbody.innerHTML = rows.map(r =>
      `<tr><td>${r.i}</td><td>${r.name}</td><td>${r.essence}</td><td>${fmt(r.s)} <span class="tag mono">${tz}</span></td><td>${fmt(r.e)} <span class="tag mono">${tz}</span></td></tr>`
    ).join("");

    const pos = remnantPosition(dw);
    if (ui.nextMoonInfo) {
      if (!pos.doot) {
        const nextStart = wallDateForRemIdx(start, (pos.moon % 13) * 28);
        const label = new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short", day: "2-digit" }).format(nextStart);
        ui.nextMoonInfo.textContent = `Next: ${MOONS[pos.moon % 13].name} begins ${label} (${tz})`;
      } else {
        ui.nextMoonInfo.textContent = "This is the Day Out of Time — the count resumes tomorrow.";
      }
    }
  }

  function buildRemnantMonth(anchor, pos) {
    const host = ui.remCal; if (!host) return; host.innerHTML = "";
    const tz = getTZ(); const yStart = remYearStart(anchor);
    const hdr = $("#remHdr");
    if (hdr) hdr.textContent = pos.doot ? "Remnant Month — DOOT" : `Remnant Month — ${MOONS[pos.moon - 1].name} (${pos.moon}/13)`;
    $("#remMeta") && ($("#remMeta").textContent = `13 × 28 fixed — ${tz}`);

    const grid = document.createElement("ol");
    grid.className = "r-grid"; grid.setAttribute("role", "grid");
    ["D1", "D2", "D3", "D4", "D5", "D6", "D7"].forEach(l => {
      const th = document.createElement("li"); th.className = "r-lbl"; th.setAttribute("role", "columnheader"); th.textContent = l; grid.appendChild(th);
    });

    if (pos.doot) {
      const li = document.createElement("li"); li.className = "r-doot"; li.textContent = "Day Out of Time"; grid.appendChild(li);
    } else {
      const startIdx0 = (pos.moon - 1) * 28;
      for (let i = 0; i < 28; i++) {
        const idx0 = startIdx0 + i, dWall = wallDateForRemIdx(yStart, idx0);
        const cell = document.createElement("li");
        cell.className = "r-day" + (((i + 1) === pos.day) ? " is-today" : "");
        cell.setAttribute("role", "gridcell");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.dataset.r = isoDateWall(dWall);
        btn.dataset.moon = String(pos.moon);
        btn.dataset.day = String(i + 1);
        btn.title = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "short", day: "2-digit" }).format(dWall) + " (" + tz + ")";
        btn.textContent = String(i + 1);
        btn.addEventListener("click", () => { pinToURL(btn.dataset.r, ui.hourScrub ? ui.hourScrub.value : "12"); paint(); });
        cell.appendChild(btn); grid.appendChild(cell);
      }
    }
    host.appendChild(grid);
  }

  function buildGregorianMonth(anchor) {
    const host = ui.gregCal; if (!host) return; host.innerHTML = "";
    const tz = getTZ(); const a = MoonTZ.wallParts(anchor, tz);
    const Y = a.getUTCFullYear(); const M0 = a.getUTCMonth();
    const first = atWall(Y, M0 + 1, 1, 12, 0, 0);
    const nextFirst = (M0 === 11) ? atWall(Y + 1, 1, 1, 12, 0, 0) : atWall(Y, M0 + 2, 1, 12, 0, 0);
    const daysIn = Math.round((nextFirst - first) / 86400000);
    const firstDow = first.getUTCDay();
    $("#gregHdr") && ($("#gregHdr").textContent = `Gregorian Month — ${new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "long" }).format(first)} ${Y}`);
    $("#gregMeta") && ($("#gregMeta").textContent = "Variable weeks");

    const grid = document.createElement("ol");
    grid.className = "g-grid"; grid.setAttribute("role", "grid");
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach(l => {
      const th = document.createElement("li"); th.className = "g-lbl"; th.setAttribute("role", "columnheader"); th.textContent = l; grid.appendChild(th);
    });
    for (let i = 0; i < firstDow; i++) { const padCell = document.createElement("li"); padCell.className = "g-pad"; padCell.setAttribute("aria-hidden", "true"); grid.appendChild(padCell); }

    const todayYMD = isoDateWall(atWall(nowWall().getUTCFullYear(), nowWall().getUTCMonth() + 1, nowWall().getUTCDate(), 12, 0, 0));
    for (let d = 1; d <= daysIn; d++) {
      const dWall = atWall(Y, M0 + 1, d, 12, 0, 0);
      const isToday = (isoDateWall(dWall) === todayYMD);
      const li = document.createElement("li"); li.className = "g-day" + (isToday ? " is-today" : ""); li.setAttribute("role", "gridcell");
      const btn = document.createElement("button"); btn.type = "button"; btn.dataset.g = `${Y}-${pad(M0 + 1)}-${pad(d)}`; btn.textContent = String(d);
      btn.addEventListener("click", () => { pinToURL(btn.dataset.g, ui.hourScrub ? ui.hourScrub.value : "12"); paint(); });
      li.appendChild(btn); grid.appendChild(li);
    }
    host.appendChild(grid);
  }

  /* --------------------------- Practices & lore ------------------------- */
  function buildPracticesAndVerse(dateISO) {
    const daily = (window.MoonData && MoonData.daily) ? MoonData.daily(dateISO) : null;
    const numer = (window.MoonData && MoonData.numerology) ? MoonData.numerology(dateISO) : { line: "—", energy: "—" };

    if (ui.practiceList) {
      ui.practiceList.innerHTML = "";
      (daily?.practices || []).forEach(p => {
        const li = document.createElement("li");
        li.innerHTML = `<b>${p.title}.</b> ${p.text}`;
        ui.practiceList.appendChild(li);
      });
    }
    if (ui.vHeb && ui.vEn && ui.vRef) {
      const v = daily?.verse;
      if (v) {
        ui.vHeb.textContent = v.he; ui.vEn.textContent = v.en; ui.vRef.textContent = v.ref;
      }
    }
    if (ui.numLine && ui.numMeta && ui.energyQuote) {
      ui.numLine.textContent = numer.line || "—";
      ui.numMeta.textContent = `Root ${numer.root || "—"}`;
      ui.energyQuote.textContent = numer.energy || "—";
    }
  }

  /* ------------------------------- Paint -------------------------------- */
  function paint() {
    const tz = getTZ();
    const anchor = getAnchorFromURL(tz);
    const pos = remnantPosition(anchor);

    // header chips
    ui.nowDate && (ui.nowDate.textContent = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", year: "numeric", month: "short", day: "2-digit" }).format(anchor));
    ui.nowClock && (ui.nowClock.textContent = MoonTZ.wallParts(new Date(), tz).toTimeString().slice(0, 8));
    ui.nowTZ && (ui.nowTZ.textContent = tz);
    ui.yearSpan && (ui.yearSpan.textContent = yearLabelFor(anchor));

    // ring + labels
    if (pos.doot) {
      ui.dootWarn?.removeAttribute("hidden");
      ui.moonName && (ui.moonName.textContent = "Day Out of Time");
      ui.moonEss && (ui.moonEss.textContent = "Pause · Reset");
      ui.moonLine && (ui.moonLine.textContent = "DOOT — outside the 13×28 cadence");
      ui.dayInMoon && (ui.dayInMoon.textContent = "—");
      const full = 316; if (ui.moonArc) { ui.moonArc.style.strokeDasharray = `1 ${full - 1}`; }
      document.body.classList.add("theme-doot");
    } else {
      ui.dootWarn && (ui.dootWarn.hidden = true);
      const md = MOONS[pos.moon - 1] || {};
      ui.moonName && (ui.moonName.textContent = md.name || `Moon ${pos.moon}`);
      ui.moonEss && (ui.moonEss.textContent = md.essence || "—");
      ui.moonLine && (ui.moonLine.textContent = `Moon ${pos.moon} · Day ${pos.day} · Week ${pos.week}`);
      ui.dayInMoon && (ui.dayInMoon.textContent = String(pos.day));
      const full = 316, cur = Math.max(1, Math.floor(((pos.day - 1) / 28) * full));
      if (ui.moonArc) { ui.moonArc.style.strokeDasharray = `${cur} ${full - cur}`; ui.moonArc.style.stroke = md.color || getComputedStyle(document.documentElement).getPropertyValue('--accent'); }
      for (let i = 1; i <= 13; i++) document.body.classList.remove(`theme-moon-${i}`);
      document.body.classList.add(`theme-moon-${pos.moon}`);
      ui.essenceLive && (ui.essenceLive.textContent = md.essence || "—");
    }

    // week dots
    buildWeekDots(ui.weekDots, pos);

    // calendars + map
    buildYearMap(anchor);
    buildRemnantMonth(anchor, pos);
    buildGregorianMonth(anchor);

    // input states
    ui.datePick && (ui.datePick.value = isoDateWall(anchor));
    ui.hourScrub && (ui.hourScrub.value = String(anchor.getUTCHours()));
    ui.jumpMoon && (ui.jumpMoon.value = pos.doot ? "" : String(pos.moon));

    // lunar phase
    const phase = lunarPhaseInfo(anchor);
    ui.phaseLine && (ui.phaseLine.textContent = `${phase.phaseName} — ${Math.round(phase.illumination * 100)}% illuminated`);
    ui.phaseMeta && (ui.phaseMeta.textContent = `Age ${phase.ageDays.toFixed(2)} days · ${Math.round(phase.deg)}°`);
    drawLunarPhase(ui.simMoon, phase);

    // verse/practices/numerology
    buildPracticesAndVerse(isoDateWall(anchor));
  }
  window.paint = paint;

  /* ---------------------------- Event wiring ---------------------------- */
  function wire() {
    buildTZSelect();

    $("#btnToday")?.addEventListener("click", () => {
      const qp = new URLSearchParams(location.search);
      qp.delete("date"); qp.delete("pin"); qp.delete("hour");
      history.replaceState(null, "", `${location.pathname}?${qp.toString()}`.replace(/\?$/, ""));
      paint();
    });
    $("#prevDay")?.addEventListener("click", () => {
      const a = getAnchorFromURL(); const y = a.getUTCFullYear(), m = a.getUTCMonth() + 1, d = a.getUTCDate() - 1, h = a.getUTCHours();
      pinToURL(`${y}-${pad(m)}-${pad(d)}`, h); paint();
    });
    $("#nextDay")?.addEventListener("click", () => {
      const a = getAnchorFromURL(); const y = a.getUTCFullYear(), m = a.getUTCMonth() + 1, d = a.getUTCDate() + 1, h = a.getUTCHours();
      pinToURL(`${y}-${pad(m)}-${pad(d)}`, h); paint();
    });
    $("#datePick")?.addEventListener("change", (ev) => { const h = ui.hourScrub ? ui.hourScrub.value : "12"; pinToURL(ev.target.value, h); paint(); });
    $("#hourScrub")?.addEventListener("input", (ev) => { const a = getAnchorFromURL(); pinToURL(isoDateWall(a), ev.target.value); paint(); });
    $("#jumpMoon")?.addEventListener("change", (ev) => {
      const a = getAnchorFromURL(), start = remYearStart(a); const m = parseInt(ev.target.value || "0", 10); if (!m) return;
      const target = wallDateForRemIdx(start, (m - 1) * 28);
      const h = ui.hourScrub ? ui.hourScrub.value : "12";
      pinToURL(isoDateWall(target), h); paint();
    });

    $("#shareLink")?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(location.href);
        $("#shareLink").textContent = "Copied ✓"; setTimeout(() => $("#shareLink").textContent = "Copy Link", 1200);
      } catch {
        prompt("Copy URL", location.href);
      }
    });

    // .ics
    ui.dlICS && ui.dlICS.addEventListener("click", (e) => {
      e.preventDefault();
      const blob = buildICSBlob(getAnchorFromURL());
      ui.dlICS.href = URL.createObjectURL(blob);
      ui.dlICS.download = "13-moon-year.ics";
    });
    $("#regenICS")?.addEventListener("click", () => { if (ui.dlICS) ui.dlICS.href = "#"; });

    // live clock
    setInterval(() => {
      const tz = getTZ();
      ui.nowClock && (ui.nowClock.textContent = MoonTZ.wallParts(new Date(), tz).toTimeString().slice(0, 8));
    }, 1000);

    // notes (local to date)
    const storeKey = (d) => `sof.moons.note.${d}`;
    const loadNote = () => {
      const d = $("#datePick")?.value || isoDateWall(getAnchorFromURL());
      try { ui.noteText && (ui.noteText.value = localStorage.getItem(storeKey(d)) || ""); } catch {}
    };
    $("#btnSaveNote")?.addEventListener("click", () => {
      const d = $("#datePick")?.value || isoDateWall(getAnchorFromURL());
      try { localStorage.setItem(storeKey(d), ui.noteText?.value || ""); } catch {}
    });
    $("#btnClearNote")?.addEventListener("click", () => {
      const d = $("#datePick")?.value || isoDateWall(getAnchorFromURL());
      try { localStorage.removeItem(storeKey(d)); } catch {}
      if (ui.noteText) ui.noteText.value = "";
    });

    // initial render
    paint();
    loadNote();
  }

  if (document.readyState !== "loading") wire();
  else document.addEventListener("DOMContentLoaded", wire);
})();
