<!-- Place at: assets/js/moons.js -->
<script>
/* ==========================================================================
   Scroll of Fire — Moons Engine (Living Clock)
   File: assets/js/moons.js
   Version: v2025.11.03
   Purpose:
     - Correct Gregorian month (remove double time-wall conversion)
     - True 13×28 mapping with DOOT (Jul 25) + leap-day skip
     - Per-moon theme + per-day “daytone” class on <body>
     - Animated starfield (canvas #skyBg) + rune shimmer (motion-safe)
     - Astrology demo: drifting planet dots + sign labels (fallback
       when window.__EPHEMERIS__ isn’t provided)
     - Query support: ?date=YYYY-MM-DD&pin=1  (primary)
                      plus aliases ?d=..., ?tz=..., ?t=hour
   Notes:
     - No frameworks. Pure DOM + Intl.
     - All animations respect prefers-reduced-motion.
   ========================================================================== */

(function () {
  "use strict";

  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const pad = n => String(n).padStart(2, "0");

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
    const qp = new URLSearchParams(location.search);
    const forced = qp.get("tz");
    if (forced) return forced;
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }
    catch { return "UTC"; }
  };

  // Build a Date whose *UTC fields* equal the local wall fields in tz.
  function atWall(y, m, d, hh = 12, mm = 0, ss = 0, tz = getTZ()) {
    try {
      const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
      });
      const parts = Object.fromEntries(
        fmt.formatToParts(new Date(Date.UTC(y, m - 1, d, hh, mm, ss))).map(p => [p.type, p.value])
      );
      const iso = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`;
      return new Date(iso);
    } catch {
      return new Date(Date.UTC(y, m - 1, d, hh, mm, ss));
    }
  }

  const isoDate = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const addDaysUTC = (d, days) => { const nd = new Date(d.getTime()); nd.setUTCDate(nd.getUTCDate() + days); return nd; };
  const diffDaysUTC = (a, b) => Math.floor((a - b) / 86400000);
  const isLeap = y => (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0));

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
    // idx0: 0..363 (13×28 - 1). Add leap-day offsets.
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
    const day = (clamped % 28) + 1;
    const week = Math.floor((day - 1) / 7) + 1;
    return { doot: false, moon, day, week, idxYear: clamped };
  }
  function yearLabel(dw) {
    const ys = remYearStart(dw).getUTCFullYear();
    return `${ys}/${ys + 1}`;
  }

  /* ----------------------------- Anchor date ----------------------------- */
  function getAnchor() {
    const qp = new URLSearchParams(location.search);
    const tz = getTZ();
    // Primary param
    let d = qp.get("date");
    // Aliases support
    if (!d) d = qp.get("d");
    let hour = qp.get("t");
    if (!hour) hour = "12"; // noon-safe default
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const [Y, M, D] = d.split("-").map(Number);
      return atWall(Y, M, D, Number(hour), 0, 0, tz);
    }
    // Default: now (noon)
    const now = new Date();
    return atWall(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate(), Number(hour), 0, 0, tz);
  }

  /* ------------------------ UI render (main paint) ----------------------- */
  function setBodyThemes(moon, day) {
    const b = document.body;
    // clear previous
    for (let i = 1; i <= 13; i++) b.classList.remove(`theme-moon-${i}`);
    for (let i = 1; i <= 28; i++) b.classList.remove(`daytone-${i}`);
    if (moon >= 1 && moon <= 13) b.classList.add(`theme-moon-${moon}`);
    if (day >= 1 && day <= 28) b.classList.add(`daytone-${day}`);
  }

  function paint() {
    const tz = getTZ();
    const anchor = getAnchor();
    const pos = remPos(anchor);
    const year = yearLabel(anchor);

    // Header badges
    $("#nowDate") && ($("#nowDate").textContent =
      new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", year: "numeric", month: "short", day: "2-digit" }).format(anchor));
    $("#nowClock") && ($("#nowClock").textContent = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date()));
    $("#nowTZ") && ($("#nowTZ").textContent = tz);
    $("#yearSpan") && ($("#yearSpan").textContent = year);

    // DOOT vs live
    if (pos.doot) {
      $("#dootWarn")?.removeAttribute("hidden");
      $("#moonName") && ($("#moonName").textContent = "Day Out of Time");
      $("#moonEssence") && ($("#moonEssence").textContent = "Pause · Reset");
      $("#moonLine") && ($("#moonLine").textContent = "DOOT — outside the 13×28 cadence");
      $("#dayInMoon") && ($("#dayInMoon").textContent = "—");
      const arc = $("#moonArc");
      if (arc) { const full = 316; arc.style.strokeDasharray = `1 ${full - 1}`; arc.style.stroke = getComputedStyle(document.documentElement).getPropertyValue('--accent') || "#7aa8ff"; }
      document.body.classList.add('theme-doot');
    } else {
      $("#dootWarn") && ($("#dootWarn").hidden = true);
      const md = MOONS[pos.moon - 1] || {};
      $("#moonName") && ($("#moonName").textContent = md.name || `Moon ${pos.moon}`);
      $("#moonEssence") && ($("#moonEssence").textContent = md.essence || "—");
      $("#moonLine") && ($("#moonLine").textContent = `Moon ${pos.moon} · Day ${pos.day} · Week ${pos.week}`);
      $("#dayInMoon") && ($("#dayInMoon").textContent = String(pos.day));
      const full = 316, cur = Math.max(1, Math.floor(((pos.day - 1) / 28) * full));
      const arc = $("#moonArc");
      if (arc) { arc.style.strokeDasharray = `${cur} ${full - cur}`; arc.style.stroke = md.color || "#7af3ff"; }
      document.body.classList.remove('theme-doot');
      setBodyThemes(pos.moon, pos.day);
      // live essence tag
      $("#essenceLive") && ($("#essenceLive").textContent = `${md.name} — ${md.essence}`);
    }

    // Week dots
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

    // Calendars & map
    buildYearMap(anchor);
    buildDualCalendars(anchor, pos);

    // Controls reflect anchor
    $("#datePick") && ($("#datePick").value = isoDate(anchor));
    $("#hourScrub") && ($("#hourScrub").value = String(anchor.getUTCHours()));
    $("#jumpMoon") && ($("#jumpMoon").value = pos.doot ? "" : String(pos.moon));

    // Debug
    $("#dbg") && ($("#dbg").textContent = JSON.stringify({ tz, anchor: isoDate(anchor), pos }, null, 2));

    // Repaint visuals
    drawLunarPhase(anchor);
    ensureSky();
    ensureAstrology(anchor, tz);
  }

  /* --------------------------- Calendars/Map ----------------------------- */
  function buildDualCalendars(anchor, pos) {
    buildRemMonth(anchor, pos);
    buildGregMonth(anchor); // FIX: use anchor directly (no double walling)
  }

  function buildRemMonth(anchor, pos) {
    const host = $("#remCal"); if (!host) return;
    host.innerHTML = "";
    const tz = getTZ();
    const yStart = remYearStart(anchor);
    const hdr = $("#remHdr");
    if (hdr) hdr.textContent = pos.doot ? "Remnant Month — DOOT" : `Remnant Month — ${MOONS[pos.moon - 1].name} (${pos.moon}/13)`;
    $("#remMeta") && ($("#remMeta").textContent = `13 × 28 fixed — ${tz}`);

    const grid = document.createElement("ol"); grid.className = "r-grid"; grid.setAttribute("role", "grid");
    ["D1", "D2", "D3", "D4", "D5", "D6", "D7"].forEach(l => {
      const th = document.createElement("li"); th.className = "r-lbl"; th.setAttribute("role", "columnheader"); th.textContent = l; grid.appendChild(th);
    });

    if (pos.doot) {
      const li = document.createElement("li"); li.className = "r-doot"; li.textContent = "Day Out of Time"; grid.appendChild(li);
    } else {
      const startIdx0 = (pos.moon - 1) * 28;
      for (let i = 0; i < 28; i++) {
        const idx0 = startIdx0 + i, dWall = wallForIndex(yStart, idx0);
        const cell = document.createElement("li"); cell.className = "r-day" + (((i + 1) === pos.day) ? " is-today" : ""); cell.setAttribute("role", "gridcell");
        const btn = document.createElement("button"); btn.type = "button"; btn.dataset.r = isoDate(dWall); btn.dataset.moon = String(pos.moon); btn.dataset.day = String(i + 1);
        btn.title = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "short", day: "2-digit" }).format(dWall) + " (" + tz + ")";
        btn.textContent = String(i + 1);
        btn.addEventListener("click", () => jumpTo(btn.dataset.r));
        cell.appendChild(btn); grid.appendChild(cell);
      }
    }
    host.appendChild(grid);
  }

  function buildGregMonth(anchor) {
    const host = $("#gregCal"); if (!host) return;
    host.innerHTML = "";

    // Use anchor directly (already wall-corrected).
    const Y = anchor.getUTCFullYear();
    const M0 = anchor.getUTCMonth();
    const tz = getTZ();

    const first = atWall(Y, M0 + 1, 1, 12, 0, 0, tz);
    const nextFirst = (M0 === 11) ? atWall(Y + 1, 1, 1, 12, 0, 0, tz) : atWall(Y, M0 + 2, 1, 12, 0, 0, tz);

    const daysIn = Math.round((nextFirst - first) / 86400000);
    const firstDow = first.getUTCDay();

    $("#gregHdr") && ($("#gregHdr").textContent =
      `Gregorian Month — ${new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "long" }).format(first)} ${Y}`);
    $("#gregMeta") && ($("#gregMeta").textContent = "Variable weeks");

    const grid = document.createElement("ol"); grid.className = "g-grid"; grid.setAttribute("role", "grid");
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach(l => {
      const th = document.createElement("li"); th.className = "g-lbl"; th.setAttribute("role", "columnheader"); th.textContent = l; grid.appendChild(th);
    });
    for (let i = 0; i < firstDow; i++) { const padc = document.createElement("li"); padc.className = "g-pad"; padc.setAttribute("aria-hidden", "true"); grid.appendChild(padc); }

    const todayYMD = isoDate(atWall(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, new Date().getUTCDate(), 12, 0, 0, tz));
    for (let d = 1; d <= daysIn; d++) {
      const dWall = atWall(Y, M0 + 1, d, 12, 0, 0, tz);
      const isToday = (isoDate(dWall) === todayYMD);
      const li = document.createElement("li"); li.className = "g-day" + (isToday ? " is-today" : ""); li.setAttribute("role", "gridcell");
      const btn = document.createElement("button"); btn.type = "button"; btn.dataset.g = `${Y}-${pad(M0 + 1)}-${pad(d)}`; btn.textContent = String(d);
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
    const fmt = d => new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "short", day: "2-digit" }).format(d);
    tbody.innerHTML = rows.map(r =>
      `<tr><td>${r.i}</td><td>${r.name}</td><td>${r.essence}</td><td>${fmt(r.s)} <span class="tag mono">${tz}</span></td><td>${fmt(r.e)} <span class="tag mono">${tz}</span></td></tr>`
    ).join("");

    const pos = remPos(anchor), info = $("#nextMoonInfo");
    if (!info) return;
    if (!pos.doot) {
      const nextStart = wallForIndex(yStart, (pos.moon % 13) * 28);
      const label = new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short", day: "2-digit" }).format(nextStart);
      info.textContent = `Next: ${MOONS[pos.moon % 13].name} begins ${label} (${tz})`;
    } else {
      info.textContent = "This is the Day Out of Time — the count resumes tomorrow.";
    }
  }

  /* ----------------------------- Lunar phase ----------------------------- */
  function drawLunarPhase(anchor) {
    const c = $("#simMoon"); if (!c) return;
    const ctx = c.getContext("2d");
    const W = c.width, H = c.height, R = Math.min(W, H) * 0.42;
    ctx.clearRect(0, 0, W, H);

    // Quick moon age approximation (synodic 29.5306d)
    const syn = 29.5306;
    const base = Date.UTC(2001, 0, 6, 18, 14, 0); // near known new moon
    const age = ((anchor - base) / 86400000) % syn;
    const phase = (age + syn) % syn; // 0..29.53
    const k = Math.abs(phase - syn / 2) / (syn / 2); // 0 new/full, 1 quarter
    const illum = 1 - k; // 0..1

    // Paint
    const cx = W / 2, cy = H / 2;
    // background orb
    ctx.fillStyle = "#090e17"; ctx.beginPath(); ctx.arc(cx, cy, R + 4, 0, Math.PI * 2); ctx.fill();

    // moon body
    ctx.shadowColor = "rgba(0,0,0,.6)"; ctx.shadowBlur = 12;
    ctx.fillStyle = "#e8edf6"; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // terminator ellipse
    const waxing = phase < (syn / 2);
    const rx = R * Math.cos((phase / syn) * Math.PI * 2);
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.ellipse(cx + (waxing ? -rx : rx), cy, Math.abs(rx), R, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    // labels
    $("#phaseLine") && ($("#phaseLine").textContent = `Phase: ${waxing ? "Waxing" : "Waning"} — ${(illum * 100).toFixed(0)}% lit`);
    $("#phaseMeta") && ($("#phaseMeta").textContent = `Age ≈ ${phase.toFixed(1)} d · Synodic ≈ 29.53 d`);
  }

  /* --------------------------- Animated sky bg --------------------------- */
  let skyOnce = false;
  function ensureSky() {
    if (skyOnce) return;
    const canvas = $("#skyBg"); if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    let W, H, stars = [];
    const prefersNoMotion = matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      W = Math.floor(rect.width * DPR); H = Math.floor(rect.height * DPR);
      canvas.width = W; canvas.height = H;
      stars = new Array(Math.floor((W * H) / (12000 * DPR))).fill(0).map(() => ({
        x: Math.random() * W, y: Math.random() * H,
        r: Math.random() * (1.4 * DPR) + 0.3 * DPR,
        s: Math.random() * 0.8 + 0.2
      }));
    }
    resize(); addEventListener("resize", resize);

    function tick(t) {
      ctx.clearRect(0, 0, W, H);
      // deep gradient
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#06080e"); g.addColorStop(1, "#0b0f16");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      // subtle rune wash
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "rgba(122,243,255,.08)";
      const R = Math.min(W, H) * 0.35;
      ctx.beginPath(); ctx.arc(W * 0.8, H * 0.15, R, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;

      // stars
      ctx.fillStyle = "#cfe6ff";
      for (const s of stars) {
        const flick = prefersNoMotion ? 1 : (0.75 + 0.25 * Math.sin((t / 1000) * (0.5 + s.s) + s.x));
        ctx.globalAlpha = 0.6 * flick;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (!prefersNoMotion) requestAnimationFrame(tick);
    }
    if (!prefersNoMotion) requestAnimationFrame(tick);
    skyOnce = true;
  }

  /* ----------------------------- Astrology demo -------------------------- */
  function ensureAstrology(anchor, tz) {
    // If a real ephemeris is present, you can hook here and plot true longitudes.
    const wheel = $("#astroWheel"); if (!wheel) return;
    const labels = $("#signLabels"); const dots = $("#planetDots");
    if (labels && !labels.hasChildNodes()) {
      const SIG = ["♈︎","♉︎","♊︎","♋︎","♌︎","♍︎","♎︎","♏︎","♐︎","♑︎","♒︎","♓︎"];
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2 - Math.PI / 2;
        const x = 180 + Math.cos(ang) * 120;
        const y = 180 + Math.sin(ang) * 120;
        const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
        t.setAttribute("x", x.toFixed(1)); t.setAttribute("y", y.toFixed(1));
        t.textContent = SIG[i]; labels.appendChild(t);
      }
    }

    const prefersNoMotion = matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersNoMotion) {
      $("#astroStamp") && ($("#astroStamp").textContent = new Date(anchor).toISOString().slice(0, 19).replace("T", " "));
      $("#astroTZ") && ($("#astroTZ").textContent = tz);
      $("#astroSource") && ($("#astroSource").textContent = "Demo");
      return;
    }

    let raf;
    function animate(t) {
      const nodes = $$("#planetDots .dot");
      nodes.forEach((n, i) => {
        // simple harmonic orbits with different speeds/radii
        const speed = 0.0002 + i * 0.00008;
        const radius = 60 + i * 10;
        const ang = (t * speed) + i * 0.7;
        const x = 180 + Math.cos(ang) * radius;
        const y = 180 + Math.sin(ang) * radius;
        n.setAttribute("cx", x.toFixed(1));
        n.setAttribute("cy", y.toFixed(1));
      });
      $("#astroStamp") && ($("#astroStamp").textContent = new Date(anchor).toISOString().slice(0, 19).replace("T", " "));
      $("#astroTZ") && ($("#astroTZ").textContent = tz);
      $("#astroSource") && ($("#astroSource").textContent = window.__EPHEMERIS__ ? "Ephemeris" : "Demo");
      raf = requestAnimationFrame(animate);
    }
    cancelAnimationFrame(raf); raf = requestAnimationFrame(animate);
  }

  /* ------------------------------- Actions -------------------------------- */
  function jumpTo(ymd) {
    const qp = new URLSearchParams(location.search);
    qp.set("date", ymd); qp.set("pin", "1");
    history.replaceState(null, "", `${location.pathname}?${qp.toString()}`); paint();
  }

  /* ------------------------------ Wiring --------------------------------- */
  function wire() {
    $("#dlICS")?.addEventListener("click", (e) => {
      e.preventDefault();
      const blob = makeICS(getAnchor());
      const a = e.currentTarget; a.href = URL.createObjectURL(blob); a.download = "13-moon-year.ics";
    });
    $("#regenICS")?.addEventListener("click", () => { const a = $("#dlICS"); if (a) a.href = "#"; });

    $("#btnToday")?.addEventListener("click", () => {
      const qp = new URLSearchParams(location.search); qp.delete("date"); qp.delete("pin");
      history.replaceState(null, "", `${location.pathname}?${qp.toString()}`.replace(/\?$/,"")); paint();
    });
    $("#prevDay")?.addEventListener("click", () => {
      const a = getAnchor(); const y = a.getUTCFullYear(), m = a.getUTCMonth() + 1, d = a.getUTCDate() - 1;
      jumpTo(`${y}-${pad(m)}-${pad(d)}`);
    });
    $("#nextDay")?.addEventListener("click", () => {
      const a = getAnchor(); const y = a.getUTCFullYear(), m = a.getUTCMonth() + 1, d = a.getUTCDate() + 1;
      jumpTo(`${y}-${pad(m)}-${pad(d)}`);
    });
    $("#datePick")?.addEventListener("change", (ev) => jumpTo(ev.target.value));
    $("#jumpMoon")?.addEventListener("change", (ev) => {
      const m = parseInt(ev.target.value || "0", 10); if (!m) return;
      const a = getAnchor(), start = remYearStart(a); const target = wallForIndex(start, (m - 1) * 28);
      jumpTo(isoDate(target));
    });

    // live clock
    setInterval(() => {
      const el = $("#nowClock"); if (!el) return;
      el.textContent = new Intl.DateTimeFormat("en-GB", { timeZone: getTZ(), hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date());
    }, 1000);

    paint();
  }

  /* ------------------------------- ICS ----------------------------------- */
  function makeICS(dw) {
    const tz = getTZ();
    const yStart = remYearStart(dw);
    const labelYear = `${yStart.getUTCFullYear()}/${yStart.getUTCFullYear() + 1}`;
    const stamp = (() => {
      const d = new Date();
      return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) +
             "T" + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + "Z";
    })();
    const fmtDate = d => d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate());
    const uid = () => (crypto && crypto.randomUUID) ? crypto.randomUUID() : ("sof-" + Math.random().toString(36).slice(2));

    let ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Scroll of Fire//13 Moon//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n";
    for (let i = 0; i < 13; i++) {
      const s = wallForIndex(yStart, i * 28);
      const e = new Date(s); e.setUTCDate(e.getUTCDate() + 28);
      ics += "BEGIN:VEVENT\r\n" +
             "UID:" + uid() + "@scroll-of-fire\r\n" +
             "DTSTAMP:" + stamp + "\r\n" +
             "DTSTART;VALUE=DATE:" + fmtDate(s) + "\r\n" +
             "DTEND;VALUE=DATE:" + fmtDate(e) + "\r\n" +
             "SUMMARY:" + (i + 1) + ". " + MOONS[i].name + " Moon — " + labelYear + " (" + tz + ")\r\n" +
             "DESCRIPTION:" + MOONS[i].essence + "\r\n" +
             "END:VEVENT\r\n";
    }
    ics += "END:VCALENDAR\r\n";
    return new Blob([ics], { type: "text/calendar" });
  }

  /* ------------------------------- Start --------------------------------- */
  window.addEventListener("DOMContentLoaded", wire, { once: true });
})();
</script>
