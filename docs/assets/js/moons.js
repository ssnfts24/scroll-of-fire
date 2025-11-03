/* ============================================================================
   Scroll of Fire — Moons Engine
   v2025.11.03-r4
   - TZ-true Remnant 13×28 + Gregorian (no double-UTC drift)
   - Animated ring, week dots, lunar phase canvas
   - Lively starfield background (motion-safe)
   - Astrology demo when no __EPHEMERIS__ (wheel + chips + aspects)
   - .ics generator
   Dependencies: none (uses optional window.MoonTZ + window.__MOONS__)
   ============================================================================ */
(() => {
  "use strict";

  /* ------------------------------- Utilities ------------------------------ */
  const $  = (s, c=document) => c.querySelector(s);
  const $$ = (s, c=document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const pad2 = (n) => String(n).padStart(2, "0");

  // Stable TZ helpers (don’t double-transform UTC → local → UTC)
  const getTZ = () => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }
    catch { return "UTC"; }
  };

  // Extract local wall Y/M/D/H/M/S for a Date in a target tz.
  function wallParts(d, tz=getTZ()) {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
    });
    const P = Object.fromEntries(fmt.formatToParts(d).map(p => [p.type, p.value]));
    return {
      Y: +P.year, M: +P.month, D: +P.day,
      h: +P.hour, m: +P.minute, s: +P.second
    };
  }

  // Build a UTC Date that *represents* a specific local wall time (noon-safe).
  function makeWallUTC(Y, M, D, h=12, m=0, s=0, tz=getTZ()) {
    // Create a string in the target wall time, then interpret as UTC.
    // This ensures date arithmetic in UTC matches the wall calendar we intend.
    const iso = `${Y}-${pad2(M)}-${pad2(D)}T${pad2(h)}:${pad2(m)}:${pad2(s)}Z`;
    // But adjust by the timezone offset between wall and UTC:
    // Use DateTimeFormat trick: find what UTC time has those wall fields.
    const probe = new Date(iso);
    const w = wallParts(probe, tz); // how probe displays in tz
    // If wall values don't match (DST/offset), shift by diff:
    const diffHours = (h - w.h);
    const diffMins  = (m - w.m);
    const diffSecs  = (s - w.s);
    const shifted = new Date(probe.getTime() + ((diffHours*3600 + diffMins*60 + diffSecs) * 1000));
    // Final check: force Y/M/D as intended
    const w2 = wallParts(shifted, tz);
    if (w2.Y !== Y || w2.M !== M || w2.D !== D) {
      // set via an anchor (noon is safest across DST)
      const anchor = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(), 12, 0, 0));
      const target = new Date(anchor.getTime() + ((h-12)*3600 + m*60 + s)*1000);
      return target;
    }
    return shifted;
  }

  const isoDate = (d, tz=getTZ()) => {
    const w = wallParts(d, tz);
    return `${w.Y}-${pad2(w.M)}-${pad2(w.D)}`;
  };

  // Date math in UTC domain
  const addDaysUTC = (d, n) => { const nd = new Date(d.getTime()); nd.setUTCDate(nd.getUTCDate() + n); return nd; };
  const diffDaysUTC = (a, b) => Math.floor((a - b) / 86400000);

  const isLeap = (y) => (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0));

  /* ------------------------------ Remnant Math ---------------------------- */
  // Year start = local-wall July 26 (noon-safe) in active TZ
  function remYearStart(dw, tz=getTZ()) {
    const { Y } = wallParts(dw, tz);
    const jul26 = makeWallUTC(Y, 7, 26, 12, 0, 0, tz);
    const before = dw < jul26;
    return before ? makeWallUTC(Y-1, 7, 26, 12, 0, 0, tz) : jul26;
  }

  function isDOOT(dw, tz=getTZ()) {
    const start = remYearStart(dw, tz);
    const { Y } = wallParts(start, tz);
    const doot = makeWallUTC(Y, 7, 25, 12, 0, 0, tz);
    return isoDate(dw, tz) === isoDate(doot, tz);
  }

  // Skip Feb 29 in the 13×28 count
  function leapDaysBetween(start, end, tz=getTZ()) {
    const ys = wallParts(start, tz).Y;
    let hits = 0;
    for (let y of [ys, ys+1]) {
      if (!isLeap(y)) continue;
      const f = makeWallUTC(y, 2, 29, 12, 0, 0, tz);
      if (f >= start && f <= end) hits++;
    }
    return hits;
  }

  function remnantPosition(dw, tz=getTZ()) {
    if (isDOOT(dw, tz)) return { doot: true };
    const start = remYearStart(dw, tz);
    let days = diffDaysUTC(dw, start);
    days -= leapDaysBetween(start, dw, tz);
    const idx = clamp(days, 0, 363);
    return {
      doot: false,
      moon: Math.floor(idx / 28) + 1,
      day: (idx % 28) + 1,
      week: Math.floor(((idx % 28)) / 7) + 1,
      idxYear: idx
    };
  }

  function wallDateForRemIdx(start, idx0, tz=getTZ()) {
    let d = addDaysUTC(start, idx0);
    const leaps = leapDaysBetween(start, d, tz);
    if (leaps > 0) d = addDaysUTC(d, leaps);
    return d;
  }

  const yearLabelFor = (dw, tz=getTZ()) => {
    const s = remYearStart(dw, tz);
    const Y = wallParts(s, tz).Y;
    return `${Y}/${Y+1}`;
  };

  /* ------------------------------ Datasets -------------------------------- */
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

  /* ------------------------------- Anchors -------------------------------- */
  function getAnchorTZ() {
    const tz = getTZ();
    const qp = new URLSearchParams(location.search);
    const pinned = qp.get("pin") === "1";
    const d = qp.get("date");
    if (pinned && d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const [Y, M, D] = d.split("-").map(Number);
      return makeWallUTC(Y, M, D, 12, 0, 0, tz);
    }
    // Today at local noon
    const now = new Date();
    const w = wallParts(now, tz);
    return makeWallUTC(w.Y, w.M, w.D, 12, 0, 0, tz);
  }

  /* ------------------------------ Painting -------------------------------- */
  function paint() {
    const tz = getTZ();
    const anchor = getAnchorTZ();
    const pos = remnantPosition(anchor, tz);

    // Header chips
    const nowFmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", year:"numeric", month:"short", day:"2-digit" });
    $("#nowDate") && ($("#nowDate").textContent = nowFmt.format(anchor));
    $("#nowTZ") && ($("#nowTZ").textContent = tz);
    $("#yearSpan") && ($("#yearSpan").textContent = yearLabelFor(anchor, tz));

    // Live clock tick (1Hz)
    (function ensureClock() {
      const el = $("#nowClock");
      if (!el) return;
      const tick = () => {
        const wp = wallParts(new Date(), tz);
        el.textContent = `${pad2(wp.h)}:${pad2(wp.m)}:${pad2(wp.s)}`;
      };
      if (!el._sofClock) {
        el._sofClock = setInterval(tick, 1000);
      }
      tick();
    })();

    // Ring + labels
    const arc = $("#moonArc");
    if (pos.doot) {
      $("#dootWarn")?.removeAttribute("hidden");
      $("#moonName") && ($("#moonName").textContent = "Day Out of Time");
      $("#moonEssence") && ($("#moonEssence").textContent = "Pause · Reset");
      $("#moonLine") && ($("#moonLine").textContent = "DOOT — outside the 13×28 cadence");
      $("#dayInMoon") && ($("#dayInMoon").textContent = "—");
      if (arc) arc.style.strokeDasharray = `1 ${316-1}`;
      document.body.classList.add("theme-doot");
    } else {
      $("#dootWarn") && ($("#dootWarn").hidden = true);
      const md = MOONS[pos.moon - 1] || {};
      $("#moonName") && ($("#moonName").textContent = md.name || `Moon ${pos.moon}`);
      $("#moonEssence") && ($("#moonEssence").textContent = md.essence || "—");
      $("#moonLine") && ($("#moonLine").textContent = `Moon ${pos.moon} · Day ${pos.day} · Week ${pos.week}`);
      $("#dayInMoon") && ($("#dayInMoon").textContent = String(pos.day));
      if (arc) {
        const full = 316, cur = Math.max(1, Math.floor(((pos.day - 1) / 28) * full));
        arc.style.strokeDasharray = `${cur} ${full - cur}`;
        arc.style.stroke = md.color || getComputedStyle(document.documentElement).getPropertyValue("--accent");
      }
      for (let i=1;i<=13;i++) document.body.classList.remove(`theme-moon-${i}`);
      document.body.classList.add(`theme-moon-${pos.moon}`);
    }

    // Week dots
    const dotsWrap = $("#weekDots");
    if (dotsWrap) {
      dotsWrap.innerHTML = "";
      for (let wk=1; wk<=4; wk++) {
        const g = document.createElement("div");
        g.className = "wdots";
        for (let d=1; d<=7; d++) {
          const i = (wk-1)*7 + d;
          const dot = document.createElement("i");
          dot.className = "wdot";
          if (!pos.doot && i === pos.day) dot.classList.add("is-today");
          g.appendChild(dot);
        }
        dotsWrap.appendChild(g);
      }
    }

    // Inputs reflect anchor
    $("#datePick") && ($("#datePick").value = isoDate(anchor, tz));
    $("#hourScrub") && ($("#hourScrub").value = wallParts(anchor, tz).h);
    $("#jumpMoon") && ($("#jumpMoon").value = pos.doot ? "" : String(pos.moon));

    // Calendars + map
    buildDualCalendars(anchor, pos, tz);
    buildYearMap(anchor, tz);

    // Numerology + essence callout
    $("#essenceLive") && ($("#essenceLive").textContent = pos.doot ? "Pause the field; cleanse the rim." : `${MOONS[pos.moon-1].name}: ${MOONS[pos.moon-1].essence}`);
    $("#numLine") && ($("#numLine").textContent = pos.doot ? "—" : `Moon ${pos.moon} | Day ${pos.day} | Week ${pos.week}`);
    $("#numMeta") && ($("#numMeta").textContent = pos.doot ? "DOOT has no tone." : "13×28 cadence; every 7 a crown.");
    $("#energyQuote") && ($("#energyQuote").textContent = pos.doot ? "“Rest the circuit; return bright.”" : "“As the ring turns, set your intent to the tone.”");

    // Lunar phase canvas
    drawLunarPhase(anchor, tz);

    // Astrology
    paintAstrology(anchor, tz);

    // Debug (optional)
    const dbg = $("#dbg");
    if (dbg) dbg.textContent = JSON.stringify({ tz, anchor: isoDate(anchor, tz), pos }, null, 2);
  }

  /* ---------------------------- Calendars --------------------------------- */
  function buildDualCalendars(anchor, pos, tz) {
    buildRemnantMonth(anchor, pos, tz);
    buildGregorianMonth(anchor, tz);
  }

  function buildRemnantMonth(anchor, pos, tz) {
    const host = $("#remCal"); if (!host) return;
    host.innerHTML = "";
    const yStart = remYearStart(anchor, tz);
    const hdr = $("#remHdr");
    if (hdr) hdr.textContent = pos.doot ? "Remnant Month — DOOT" : `Remnant Month — ${MOONS[pos.moon-1].name} (${pos.moon}/13)`;
    $("#remMeta") && ($("#remMeta").textContent = `13 × 28 fixed — ${tz}`);

    const grid = document.createElement("ol");
    grid.className = "r-grid"; grid.setAttribute("role", "grid");
    ["D1","D2","D3","D4","D5","D6","D7"].forEach(l => {
      const th = document.createElement("li");
      th.className = "r-lbl"; th.setAttribute("role","columnheader"); th.textContent = l;
      grid.appendChild(th);
    });

    if (pos.doot) {
      const li = document.createElement("li");
      li.className = "r-doot"; li.textContent = "Day Out of Time";
      grid.appendChild(li);
    } else {
      const startIdx0 = (pos.moon-1)*28;
      for (let i=0; i<28; i++) {
        const idx0 = startIdx0 + i, dWall = wallDateForRemIdx(yStart, idx0, tz);
        const cell = document.createElement("li");
        cell.className = "r-day" + ((i+1)===pos.day ? " is-today" : "");
        cell.setAttribute("role","gridcell");

        const btn = document.createElement("button");
        btn.type = "button";
        btn.dataset.r = isoDate(dWall, tz);
        btn.dataset.moon = String(pos.moon);
        btn.dataset.day = String(i+1);
        btn.title = new Intl.DateTimeFormat("en-US", { timeZone: tz, year:"numeric", month:"short", day:"2-digit" }).format(dWall) + ` (${tz})`;
        btn.textContent = String(i+1);
        btn.addEventListener("click", () => {
          const qp = new URLSearchParams(location.search);
          qp.set("date", btn.dataset.r); qp.set("pin", "1");
          history.replaceState(null, "", `${location.pathname}?${qp.toString()}`);
          paint();
        });

        cell.appendChild(btn);
        grid.appendChild(cell);
      }
    }
    host.appendChild(grid);
  }

  function buildGregorianMonth(anchor, tz) {
    const host = $("#gregCal"); if (!host) return;
    host.innerHTML = "";

    const W = wallParts(anchor, tz);
    const first = makeWallUTC(W.Y, W.M, 1, 12, 0, 0, tz);
    const nextFirst = (W.M === 12) ? makeWallUTC(W.Y+1, 1, 1, 12, 0, 0, tz) : makeWallUTC(W.Y, W.M+1, 1, 12, 0, 0, tz);
    const daysIn = Math.round((nextFirst - first) / 86400000);
    const firstDow = first.getUTCDay();

    $("#gregHdr") && ($("#gregHdr").textContent =
      `Gregorian Month — ${new Intl.DateTimeFormat("en-US", { timeZone: tz, month:"long"}).format(first)} ${W.Y}`);
    $("#gregMeta") && ($("#gregMeta").textContent = "Variable weeks");

    const grid = document.createElement("ol");
    grid.className = "g-grid"; grid.setAttribute("role", "grid");

    ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].forEach(l => {
      const th = document.createElement("li");
      th.className = "g-lbl"; th.setAttribute("role","columnheader"); th.textContent = l;
      grid.appendChild(th);
    });

    for (let i=0; i<firstDow; i++) {
      const pad = document.createElement("li");
      pad.className = "g-pad"; pad.setAttribute("aria-hidden","true");
      grid.appendChild(pad);
    }

    const todayYMD = isoDate(makeWallUTC(wallParts(new Date(), tz).Y, wallParts(new Date(), tz).M, wallParts(new Date(), tz).D, 12, 0, 0, tz), tz);

    for (let d=1; d<=daysIn; d++) {
      const dWall = makeWallUTC(W.Y, W.M, d, 12, 0, 0, tz);
      const isToday = (isoDate(dWall, tz) === todayYMD);
      const li = document.createElement("li");
      li.className = "g-day" + (isToday ? " is-today" : "");
      li.setAttribute("role","gridcell");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.g = `${W.Y}-${pad2(W.M)}-${pad2(d)}`;
      btn.textContent = String(d);
      btn.addEventListener("click", () => {
        const qp = new URLSearchParams(location.search);
        qp.set("date", btn.dataset.g); qp.set("pin","1");
        history.replaceState(null, "", `${location.pathname}?${qp.toString()}`);
        paint();
      });

      li.appendChild(btn);
      grid.appendChild(li);
    }
    host.appendChild(grid);
  }

  function buildYearMap(anchor, tz) {
    const tbody = $("#yearMap tbody"); if (!tbody) return;
    const start = remYearStart(anchor, tz);
    const rows = [];
    for (let i=0; i<13; i++) {
      const s = wallDateForRemIdx(start, i*28, tz);
      const e = addDaysUTC(s, 27);
      rows.push({ i: i+1, s, e, name: MOONS[i].name, essence: MOONS[i].essence });
    }
    const fmt = (d) => new Intl.DateTimeFormat("en-US", { timeZone: tz, year:"numeric", month:"short", day:"2-digit" }).format(d);
    tbody.innerHTML = rows.map(r => (
      `<tr><td>${r.i}</td><td>${r.name}</td><td>${r.essence}</td>` +
      `<td>${fmt(r.s)} <span class="tag mono">${tz}</span></td>` +
      `<td>${fmt(r.e)} <span class="tag mono">${tz}</span></td></tr>`
    )).join("");

    const pos = remnantPosition(anchor, tz);
    const info = $("#nextMoonInfo"); if (!info) return;
    if (!pos.doot) {
      const nextStart = wallDateForRemIdx(start, (pos.moon % 13) * 28, tz);
      const label = new Intl.DateTimeFormat("en-US", { timeZone: tz, month:"short", day:"2-digit" }).format(nextStart);
      info.textContent = `Next: ${MOONS[pos.moon % 13].name} begins ${label} (${tz})`;
    } else {
      info.textContent = "This is the Day Out of Time — the count resumes tomorrow.";
    }
  }

  /* ----------------------------- Starfield -------------------------------- */
  function starfield() {
    const cvs = $("#skyBg"); if (!cvs) return;
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const ctx = cvs.getContext("2d");
    const prefersReduced = matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

    let stars = [];
    function resize() {
      const w = cvs.clientWidth, h = cvs.clientHeight;
      cvs.width = Math.floor(w * dpr); cvs.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.floor((w*h) / 12000);
      stars = new Array(count).fill(0).map(() => ({
        x: Math.random()*w,
        y: Math.random()*h,
        r: Math.random()*1.4 + 0.4,
        s: Math.random()*0.8 + 0.2,
        p: Math.random()*Math.PI*2
      }));
    }
    function frame(t) {
      const w = cvs.clientWidth, h = cvs.clientHeight;
      ctx.clearRect(0,0,w,h);
      ctx.globalCompositeOperation = "lighter";
      for (const st of stars) {
        const twinkle = prefersReduced ? 1 : (0.7 + 0.3 * Math.sin(t*0.002 + st.p));
        ctx.globalAlpha = 0.35 * twinkle;
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r, 0, Math.PI*2);
        ctx.fillStyle = "#7af3ff";
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      if (!prefersReduced) requestAnimationFrame(frame);
    }
    resize();
    window.addEventListener("resize", resize, { passive: true });
    if (prefersReduced) { frame(0); }
    else { requestAnimationFrame(frame); }
  }

  /* --------------------------- Lunar Phase Canvas ------------------------- */
  // Simple approximation based on synodic month from known epoch.
  function drawLunarPhase(anchor, tz) {
    const cvs = $("#simMoon"); if (!cvs) return;
    const ctx = cvs.getContext("2d");
    const w = cvs.width, h = cvs.height, R = Math.min(w,h)/2 - 10;

    // Compute age since epoch (2000-01-06 18:14 UT)
    const epoch = new Date(Date.UTC(2000,0,6,18,14,0));
    const days = (anchor - epoch) / 86400000;
    const synodic = 29.530588853;
    const age = ((days % synodic) + synodic) % synodic;
    const phase = age / synodic; // 0 new → 0.5 full → 1 new

    // Clear + draw background moon
    ctx.clearRect(0,0,w,h);
    ctx.save();
    ctx.translate(w/2, h/2);

    // Moon body
    ctx.fillStyle = "#0a0e16";
    ctx.beginPath(); ctx.arc(0,0,R,0,Math.PI*2); ctx.fill();

    // Lit part (terminator as ellipse)
    // Use cosine phase for limb
    const k = Math.cos(phase * 2*Math.PI);
    ctx.fillStyle = "#e8edf7";
    ctx.beginPath();
    ctx.ellipse(0,0, Math.abs(R*k), R, 0, 0, Math.PI*2);
    ctx.fill();

    // Soft limb vignette
    const g = ctx.createRadialGradient(0,0,R*0.2, 0,0,R);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.5)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0,0,R,0,Math.PI*2); ctx.fill();

    ctx.restore();

    const names = ["New","Waxing Crescent","First Quarter","Waxing Gibbous","Full","Waning Gibbous","Last Quarter","Waning Crescent"];
    const idx = Math.round(phase*8) % 8;
    $("#phaseLine") && ($("#phaseLine").textContent = `${names[idx]} · ${Math.round(phase*100)}% cycle`);
    $("#phaseMeta") && ($("#phaseMeta").textContent =
      `Age ${age.toFixed(2)} d · Synodic ${synodic.toFixed(3)} d`);
  }

  /* ---------------------------- Astrology Demo ---------------------------- */
  // Populates chips, wheel, and a tiny aspects table if no ephemeris present.
  function paintAstrology(anchor, tz) {
    const hasEphem = (typeof window.__EPHEMERIS__ === "object" && window.__EPHEMERIS__);
    const stampEl = $("#astroStamp"), tzEl = $("#astroTZ"), srcEl = $("#astroSource");
    stampEl && (stampEl.textContent = new Intl.DateTimeFormat("en-US",{ timeZone: tz, dateStyle:"medium", timeStyle:"short"}).format(anchor));
    tzEl && (tzEl.textContent = tz);
    srcEl && (srcEl.textContent = hasEphem ? "Provided ephemeris" : "Demo (approx)");

    const wheel = $("#astroWheel"); if (!wheel) return;
    const labels = $("#signLabels"); const dots = $("#planetDots");
    if (labels && !labels.childElementCount) {
      const signs = ["♈︎","♉︎","♊︎","♋︎","♌︎","♍︎","♎︎","♏︎","♐︎","♑︎","♒︎","♓︎"];
      for (let i=0;i<12;i++){
        const ang = (i/12)*2*Math.PI - Math.PI/2;
        const x = 180 + Math.cos(ang)*132;
        const y = 180 + Math.sin(ang)*132;
        const t = document.createElementNS("http://www.w3.org/2000/svg","text");
        t.setAttribute("x", x.toFixed(1)); t.setAttribute("y", y.toFixed(1));
        t.textContent = signs[i]; labels.appendChild(t);
      }
    }

    // Positions
    const PLANETS = ["sun","moon","mercury","venus","mars","jupiter","saturn"];
    const rates = { // deg/day (very rough)
      sun: 0.9856, moon: 13.1764, mercury: 1.2, venus: 1.18, mars: 0.524, jupiter: 0.083, saturn: 0.033
    };
    const base = Date.UTC(2020,0,1,0,0,0);
    const d = (anchor - base)/86400000;

    const pos = {};
    if (hasEphem && window.__EPHEMERIS__.positions) {
      Object.assign(pos, window.__EPHEMERIS__.positions);
    } else {
      for (const p of PLANETS) pos[p] = ( (d * rates[p]) % 360 + 360 ) % 360;
    }

    // Update chips
    PLANETS.forEach(p => {
      const chipPos = $(`.mono.pos[data-pos="${p}"]`); chipPos && (chipPos.textContent = `${pos[p].toFixed(1)}°`);
      const signNames = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
      const sign = Math.floor(pos[p]/30);
      const chipSign = $(`.sign[data-sign="${p}"]`); chipSign && (chipSign.textContent = signNames[sign]);
    });

    // Move dots
    const dotG = dots;
    const R = 120;
    for (const p of PLANETS) {
      const node = dotG.querySelector(`[data-dot="${p}"]`); if (!node) continue;
      const ang = (pos[p] / 360) * 2*Math.PI - Math.PI/2;
      const r = (p === "moon") ? R : (p === "sun") ? R*0.92 : R*0.82;
      const x = 180 + Math.cos(ang)*r;
      const y = 180 + Math.sin(ang)*r;
      node.setAttribute("cx", x.toFixed(1));
      node.setAttribute("cy", y.toFixed(1));
    }

    // Aspects (very light)
    const pairs = [
      ["sun","moon"],["sun","mars"],["venus","mars"],["mercury","jupiter"],["jupiter","saturn"]
    ];
    const aspects = [];
    function norm(a){ a%=360; if (a<0) a+=360; return a; }
    function delta(a,b){
      let d = Math.abs(norm(a)-norm(b)); if (d>180) d = 360-d; return d;
    }
    const aspDefs = [
      {name:"Conj", sym:"☌",  ang:0,   orb:8 },
      {name:"Sext", sym:"✶",  ang:60,  orb:4 },
      {name:"Sq",   sym:"□",  ang:90,  orb:5 },
      {name:"Tri",  sym:"△",  ang:120, orb:5 },
      {name:"Opp",  sym:"☍",  ang:180, orb:6 },
    ];
    for (const [a,b] of pairs) {
      const d = delta(pos[a], pos[b]);
      for (const A of aspDefs) {
        const off = Math.abs(d - A.ang);
        if (off <= A.orb) { aspects.push({ pair: `${a}–${b}`, type: A.name, sym: A.sym, orb: off.toFixed(1) }); break; }
      }
    }
    const tbody = $("#aspBody");
    if (tbody) {
      tbody.innerHTML = aspects.map(x => `<tr><td>${x.pair}</td><td>${x.sym} ${x.type}</td><td>${x.orb}°</td></tr>`).join("")
        || `<tr><td colspan="3" class="meta">No tight aspects in demo window.</td></tr>`;
    }
  }

  /* ------------------------------- Wiring --------------------------------- */
  function wire() {
    $("#dlICS")?.addEventListener("click", (e) => {
      e.preventDefault();
      const tz = getTZ();
      const dw = getAnchorTZ();
      const yStart = remYearStart(dw, tz);
      const labelYear = yearLabelFor(dw, tz);
      const fmtDate = (d) =>
        d.getUTCFullYear() + pad2(d.getUTCMonth()+1) + pad2(d.getUTCDate());

      const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : ("sof-"+Math.random().toString(36).slice(2)));
      const stamp = (() => {
        const d = new Date();
        return d.getUTCFullYear() + pad2(d.getUTCMonth()+1) + pad2(d.getUTCDate()) +
               "T" + pad2(d.getUTCHours()) + pad2(d.getUTCMinutes()) + pad2(d.getUTCSeconds()) + "Z";
      })();

      let ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Scroll of Fire//13 Moon//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n";
      for (let i=0;i<13;i++){
        const s = wallDateForRemIdx(yStart, i*28, tz);
        const e = addDaysUTC(s, 28); // DTEND non-inclusive
        ics += "BEGIN:VEVENT\r\n"
          + "UID:"+uid()+"@scroll-of-fire\r\n"
          + "DTSTAMP:"+stamp+"\r\n"
          + "DTSTART;VALUE=DATE:"+fmtDate(s)+"\r\n"
          + "DTEND;VALUE=DATE:"+fmtDate(e)+"\r\n"
          + "SUMMARY:"+(i+1)+". "+MOONS[i].name+" Moon — "+labelYear+" ("+getTZ()+")\r\n"
          + "DESCRIPTION:"+MOONS[i].essence+"\r\n"
          + "END:VEVENT\r\n";
      }
      ics += "END:VCALENDAR\r\n";
      const blob = new Blob([ics], { type: "text/calendar" });
      const a = $("#dlICS"); a.href = URL.createObjectURL(blob); a.download = "13-moon-year.ics";
    });

    $("#regenICS")?.addEventListener("click", () => { const a=$("#dlICS"); if (a) a.href="#"; });

    $("#btnToday")?.addEventListener("click", () => {
      const qp = new URLSearchParams(location.search);
      qp.delete("date"); qp.delete("pin");
      history.replaceState(null, "", `${location.pathname}?${qp.toString()}`.replace(/\?$/, ""));
      paint();
    });
    $("#prevDay")?.addEventListener("click", () => {
      const tz = getTZ(); const a = getAnchorTZ(); const w = wallParts(a, tz);
      const prev = makeWallUTC(w.Y, w.M, w.D-1, 12, 0, 0, tz);
      const qp = new URLSearchParams(location.search);
      qp.set("date", isoDate(prev, tz)); qp.set("pin", "1");
      history.replaceState(null, "", `${location.pathname}?${qp.toString()}`); paint();
    });
    $("#nextDay")?.addEventListener("click", () => {
      const tz = getTZ(); const a = getAnchorTZ(); const w = wallParts(a, tz);
      const next = makeWallUTC(w.Y, w.M, w.D+1, 12, 0, 0, tz);
      const qp = new URLSearchParams(location.search);
      qp.set("date", isoDate(next, tz)); qp.set("pin", "1");
      history.replaceState(null, "", `${location.pathname}?${qp.toString()}`); paint();
    });

    $("#datePick")?.addEventListener("change", (ev) => {
      const qp = new URLSearchParams(location.search);
      qp.set("date", ev.target.value); qp.set("pin","1");
      history.replaceState(null, "", `${location.pathname}?${qp.toString()}`); paint();
    });

    $("#jumpMoon")?.addEventListener("change", (ev) => {
      const m = parseInt(ev.target.value || "0", 10); if (!m) return;
      const tz = getTZ(); const a = getAnchorTZ(); const start = remYearStart(a, tz);
      const target = wallDateForRemIdx(start, (m-1)*28, tz);
      const qp = new URLSearchParams(location.search);
      qp.set("date", isoDate(target, tz)); qp.set("pin","1");
      history.replaceState(null, "", `${location.pathname}?${qp.toString()}`); paint();
    });

    // Starfield after first paint for dimensions
    starfield();

    // First render
    paint();
  }

  // Boot when DOM ready (external file, no defer assumptions)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire, { once: true });
  } else {
    wire();
  }
})();
