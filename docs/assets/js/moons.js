/* Remnant 13 Moons — engine
   Path: docs/assets/js/moons.js
   Provides: window.paint() and all wiring
*/
(function () {
  "use strict";

  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const pad = (n) => String(n).padStart(2, "0");
  const MOONS = (window.__MOONS__ && window.__MOONS__.length === 13) ? window.__MOONS__ : null;

  /* ---------- TZ helpers ---------- */
  const getTZ = () => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }
    catch { return "UTC"; }
  };
  const wallParts = (d, tz) => {
    try {
      tz = tz || getTZ();
      const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
      });
      const parts = Object.fromEntries(fmt.formatToParts(d).map(p => [p.type, p.value]));
      const iso = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
      return new Date(iso + "Z"); // carry wall fields in UTC-wrapper
    } catch { return new Date(d); }
  };
  const isoDateWall = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;
  const nowWall = () => wallParts(new Date(), getTZ());
  const atWall = (y,m,d,hh=12,mm=0,ss=0) => wallParts(new Date(Date.UTC(y,m-1,d,hh,mm,ss)), getTZ());
  const addDaysUTC = (d, n) => { const x=new Date(d.getTime()); x.setUTCDate(x.getUTCDate()+n); return x; };
  const diffDaysUTC = (a, b) => Math.floor((a - b) / 86400000);
  const isLeap = (y) => (y%4===0 && (y%100!==0 || y%400===0));

  /* ---------- Remnant math ---------- */
  function remYearStart(dw) {
    const y = dw.getUTCFullYear();
    const jul26 = atWall(y, 7, 26, 12, 0, 0);
    return (dw < jul26) ? atWall(y-1, 7, 26, 12, 0, 0) : jul26;
  }
  function isDOOT(dw) { // July 25 in wall TZ
    const start = remYearStart(dw);
    const y = start.getUTCFullYear();
    const doot = atWall(y, 7, 25, 12, 0, 0);
    return isoDateWall(dw) === isoDateWall(doot);
  }
  function leapDaysBetween(start, end) { // Feb 29 is skipped
    const y0 = start.getUTCFullYear(); let hits = 0;
    for (let y of [y0, y0+1]) {
      if (!isLeap(y)) continue;
      const feb29 = atWall(y, 2, 29, 12, 0, 0);
      if (feb29 >= start && feb29 <= end) hits++;
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
    const day  = (clamped % 28) + 1;
    const week = Math.floor((day - 1) / 7) + 1;
    return { doot:false, moon, day, week, idxYear: clamped };
  }
  const wallDateForRemIdx = (start, idx0) => {
    let d = addDaysUTC(start, idx0);
    const leaps = leapDaysBetween(start, d);
    if (leaps > 0) d = addDaysUTC(d, leaps);
    return d;
  };
  const yearLabelFor = (dw) => {
    const yStart = remYearStart(dw).getUTCFullYear();
    return `${yStart}/${yStart+1}`;
  };

  /* ---------- URL anchor ---------- */
  function getWallAnchor() {
    const qp = new URLSearchParams(location.search);
    const pinned = qp.get("pin") === "1";
    const d = qp.get("date");
    if (pinned && d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const [Y,M,D] = d.split("-").map(Number);
      return atWall(Y, M, D, 12, 0, 0);
    }
    // Cleanup stray params
    if (qp.has("date") || qp.has("pin")) {
      qp.delete("date"); qp.delete("pin");
      history.replaceState(null, "", `${location.pathname}?${qp.toString()}`.replace(/\?$/,""));
    }
    const n = nowWall();
    return atWall(n.getUTCFullYear(), n.getUTCMonth()+1, n.getUTCDate(), 12, 0, 0);
  }

  /* ---------- UI paint ---------- */
  function paintRing(pos, anchor) {
    const arc = $("#moonArc");
    const dayEl = $("#dayInMoon");
    if (!arc || !dayEl) return;
    if (pos.doot) {
      arc.style.strokeDasharray = `1 ${316-1}`; dayEl.textContent = "—"; return;
    }
    const full = 316;
    const cur = Math.max(1, Math.floor(((pos.day-1)/28)*full));
    arc.style.strokeDasharray = `${cur} ${full-cur}`;
    dayEl.textContent = String(pos.day);
  }

  function paintHeader(pos, anchor) {
    const tz = getTZ();
    $("#nowDate") && ($("#nowDate").textContent =
      new Intl.DateTimeFormat("en-US",{timeZone:tz,weekday:"short",year:"numeric",month:"short",day:"2-digit"}).format(anchor));
    $("#nowClock") && ($("#nowClock").textContent = wallParts(new Date(), tz).toTimeString().slice(0,8));
    $("#nowTZ") && ($("#nowTZ").textContent = tz);
    $("#yearSpan") && ($("#yearSpan").textContent = yearLabelFor(anchor));

    if (pos.doot) {
      $("#dootWarn")?.removeAttribute("hidden");
      $("#moonName") && ($("#moonName").textContent = "Day Out of Time");
      $("#moonEssence") && ($("#moonEssence").textContent = "Pause · Reset");
      $("#moonLine") && ($("#moonLine").textContent = "DOOT — outside the 13×28 cadence");
      document.body.classList.add("theme-doot");
    } else {
      $("#dootWarn") && ($("#dootWarn").hidden = true);
      const md = (MOONS && MOONS[pos.moon-1]) || { name:`Moon ${pos.moon}`, essence:"—", color:"var(--accent)" };
      $("#moonName") && ($("#moonName").textContent = md.name);
      $("#moonEssence") && ($("#moonEssence").textContent = md.essence);
      $("#moonLine") && ($("#moonLine").textContent = `Moon ${pos.moon} · Day ${pos.day} · Week ${pos.week}`);
      const arc = $("#moonArc"); if (arc) arc.style.stroke = md.color;
      for (let i=1;i<=13;i++) document.body.classList.remove(`theme-moon-${i}`);
      document.body.classList.add(`theme-moon-${pos.moon}`);
    }

    // Week dots
    const dotsWrap = $("#weekDots");
    if (dotsWrap) {
      dotsWrap.innerHTML = "";
      for (let wk=1; wk<=4; wk++) {
        const g = document.createElement("div"); g.className = "wdots";
        for (let d=1; d<=7; d++) {
          const i = (wk-1)*7+d;
          const dot = document.createElement("i"); dot.className = "wdot";
          if (!pos.doot && i === pos.day) dot.classList.add("is-today");
          g.appendChild(dot);
        }
        dotsWrap.appendChild(g);
      }
    }
  }

  function buildYearMap(dw) {
    const tbody = $("#yearMap tbody"); if (!tbody || !MOONS) return;
    const tz = getTZ();
    const start = remYearStart(dw);
    const fmt = d => new Intl.DateTimeFormat("en-US",{timeZone:tz,year:"numeric",month:"short",day:"2-digit"}).format(d);
    const rows = [];
    for (let i=0;i<13;i++) {
      const s = wallDateForRemIdx(start, i*28);
      const e = addDaysUTC(s, 27);
      rows.push(`<tr><td>${i+1}</td><td>${MOONS[i].name}</td><td>${MOONS[i].essence}</td>
        <td>${fmt(s)} <span class="tag mono">${tz}</span></td>
        <td>${fmt(e)} <span class="tag mono">${tz}</span></td></tr>`);
    }
    tbody.innerHTML = rows.join("");

    const pos = remnantPosition(dw);
    const info = $("#nextMoonInfo");
    if (info) {
      if (pos.doot) info.textContent = "This is the Day Out of Time — the count resumes tomorrow.";
      else {
        const nextStart = wallDateForRemIdx(start, (pos.moon % 13) * 28);
        const label = new Intl.DateTimeFormat("en-US",{timeZone:tz,month:"short",day:"2-digit"}).format(nextStart);
        info.textContent = `Next: ${MOONS[pos.moon%13].name} begins ${label} (${tz})`;
      }
    }
  }

  function buildRemnantMonth(anchor, pos) {
    const host = $("#remCal"); if (!host) return; host.innerHTML = "";
    const tz = getTZ(); const yStart = remYearStart(anchor);
    const hdr = $("#remHdr"); if (hdr) hdr.textContent = pos.doot ? "Remnant Month — DOOT" : `Remnant Month — ${MOONS[pos.moon-1].name} (${pos.moon}/13)`;
    $("#remMeta") && ($("#remMeta").textContent = `13 × 28 fixed — ${tz}`);

    const grid = document.createElement("ol"); grid.className = "r-grid"; grid.setAttribute("role", "grid");
    ["D1","D2","D3","D4","D5","D6","D7"].forEach(l => {
      const th = document.createElement("li"); th.className = "r-lbl"; th.setAttribute("role","columnheader"); th.textContent = l; grid.appendChild(th);
    });

    if (pos.doot) {
      const li = document.createElement("li"); li.className = "r-doot"; li.textContent = "Day Out of Time"; grid.appendChild(li);
    } else {
      const startIdx0 = (pos.moon-1) * 28;
      for (let i=0; i<28; i++) {
        const idx0 = startIdx0 + i;
        const dWall = wallDateForRemIdx(yStart, idx0);
        const cell = document.createElement("li"); cell.className = "r-day" + (((i+1)===pos.day) ? " is-today" : ""); cell.setAttribute("role","gridcell");
        const btn = document.createElement("button"); btn.type = "button";
        btn.dataset.r = isoDateWall(dWall); btn.textContent = String(i+1);
        btn.title = new Intl.DateTimeFormat("en-US",{timeZone:tz,year:"numeric",month:"short",day:"2-digit"}).format(dWall) + " (" + tz + ")";
        btn.addEventListener("click", () => {
          const qp = new URLSearchParams(location.search);
          qp.set("date", btn.dataset.r); qp.set("pin", "1");
          history.replaceState(null, "", `${location.pathname}?${qp.toString()}`);
          paint();
        });
        cell.appendChild(btn); grid.appendChild(cell);
      }
    }
    host.appendChild(grid);
  }

  function buildGregorianMonth(anchor) {
    const host = $("#gregCal"); if (!host) return; host.innerHTML = "";
    const tz = getTZ(); const a = wallParts(anchor, tz);
    const Y = a.getUTCFullYear(); const M0 = a.getUTCMonth();
    const first = atWall(Y, M0+1, 1, 12, 0, 0);
    const nextFirst = (M0===11) ? atWall(Y+1, 1, 1, 12, 0, 0) : atWall(Y, M0+2, 1, 12, 0, 0);
    const daysIn = Math.round((nextFirst-first)/86400000), firstDow = first.getUTCDay();

    $("#gregHdr") && ($("#gregHdr").textContent = `Gregorian Month — ${new Intl.DateTimeFormat("en-US",{timeZone:tz,month:"long"}).format(first)} ${Y}`);
    $("#gregMeta") && ($("#gregMeta").textContent = "Variable weeks");

    const grid = document.createElement("ol"); grid.className = "g-grid"; grid.setAttribute("role","grid");
    ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].forEach(l => {
      const th = document.createElement("li"); th.className = "g-lbl"; th.setAttribute("role","columnheader"); th.textContent = l; grid.appendChild(th);
    });
    for (let i=0; i<firstDow; i++) { const padCell = document.createElement("li"); padCell.className = "g-pad"; padCell.setAttribute("aria-hidden","true"); grid.appendChild(padCell); }

    const todayYMD = isoDateWall(atWall(nowWall().getUTCFullYear(), nowWall().getUTCMonth()+1, nowWall().getUTCDate(), 12,0,0));
    for (let d=1; d<=daysIn; d++) {
      const dWall = atWall(Y, M0+1, d, 12, 0, 0);
      const isToday = (isoDateWall(dWall) === todayYMD);
      const li = document.createElement("li"); li.className = "g-day" + (isToday ? " is-today" : ""); li.setAttribute("role","gridcell");
      const btn = document.createElement("button"); btn.type="button"; btn.dataset.g=`${Y}-${pad(M0+1)}-${pad(d)}`; btn.textContent = String(d);
      btn.addEventListener("click", () => {
        const qp = new URLSearchParams(location.search);
        qp.set("date", btn.dataset.g); qp.set("pin", "1");
        history.replaceState(null, "", `${location.pathname}?${qp.toString()}`);
        paint();
      });
      li.appendChild(btn); grid.appendChild(li);
    }
    host.appendChild(grid);
  }

  /* ---------- Lunar phase (simple, stable) ---------- */
  function drawLunarPhase(anchor) {
    const cv = $("#simMoon"); if (!cv) return;
    const ctx = cv.getContext("2d");
    const w = cv.width, h = cv.height, r = Math.min(w,h)*0.45, cx = w/2, cy = h/2;

    // Meeus-like simple synodic algorithm (not astronomical-grade but stable offline)
    const d = (Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate()) - Date.UTC(2001,0,1)) / 86400000;
    const syn = 29.53058867;
    const phase = ((d % syn) + syn) % syn;       // 0..syn
    const k = (phase / syn) * 2 - 1;            // -1 .. 1
    const waxing = k < 0;                        // negative -> waxing
    const lit = 1 - Math.abs(k);                 // 0..1 approximate illumination

    // paint
    ctx.clearRect(0,0,w,h);
    ctx.save();
    ctx.translate(cx, cy);

    // backdrop
    ctx.beginPath();
    ctx.fillStyle = "#0a0f16";
    ctx.arc(0,0,r+6,0,Math.PI*2); ctx.fill();

    // dark disk
    ctx.beginPath();
    ctx.fillStyle = "#0d1118";
    ctx.arc(0,0,r,0,Math.PI*2); ctx.fill();

    // lit ellipse mask
    ctx.globalCompositeOperation = "source-atop";
    ctx.beginPath();
    ctx.fillStyle = "#e8f6ff";
    const rx = r * Math.max(0.02, lit);  // avoid fully flat
    ctx.ellipse(waxing ? -k*r : k*r, 0, rx, r, 0, 0, Math.PI*2);
    ctx.fill();

    ctx.globalCompositeOperation = "source-over";
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(122,243,255,.35)";
    ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.stroke();

    ctx.restore();

    // labels
    const pct = Math.round(lit*100);
    const names = [
      "New", "Waxing Crescent", "First Quarter", "Waxing Gibbous",
      "Full", "Waning Gibbous", "Last Quarter", "Waning Crescent"
    ];
    const idx = Math.round((phase / syn) * 8) % 8;
    $("#phaseLine") && ($("#phaseLine").textContent = `${names[idx]} — ${pct}%`);
    $("#phaseMeta") && ($("#phaseMeta").textContent = `Synodic age ≈ ${phase.toFixed(2)} days`);
  }

  /* ---------- Numerology / verse ---------- */
  function paintNumAndVerse(pos) {
    const num = pos.doot ? 0 : (pos.moon*100 + pos.day);
    $("#numLine")  && ($("#numLine").textContent  = pos.doot ? "—" : `M${pos.moon} · D${pos.day} → ${num}`);
    $("#numMeta")  && ($("#numMeta").textContent  = pos.doot ? "Outside count." : "Tone = (moon mod 7), Path = (day mod 9).");
    const bank = window.__VERSES__ || [];
    if (bank.length) {
      const i = pos.doot ? 0 : (pos.day-1) % bank.length;
      $("#vHeb") && ($("#vHeb").textContent = bank[i].he);
      $("#vEn")  && ($("#vEn").textContent  = bank[i].en);
      $("#vRef") && ($("#vRef").textContent = bank[i].ref);
    }
  }

  /* ---------- Practice list + note store ---------- */
  function paintPractices(pos, anchor) {
    const host = $("#practiceList"); if (!host) return;
    const list = window.__PRACTICES__ || [];
    const picks = [];
    for (let i=0;i<Math.min(3, list.length);i++) picks.push(list[(pos.day-1+i) % list.length]);
    host.innerHTML = picks.map((t, i) => `<li role="listitem"><span class="num">${i+1}.</span> ${t}</li>`).join("");

    const note = $("#noteText");
    if (note) {
      const key = `sof.note.${isoDateWall(anchor)}`;
      note.value = localStorage.getItem(key) || "";
      $("#btnSaveNote")?.addEventListener("click", () => { localStorage.setItem(key, note.value || ""); note.blur(); });
      $("#btnClearNote")?.addEventListener("click", () => { localStorage.removeItem(key); note.value = ""; note.blur(); });
    }
  }

  /* ---------- ICS ---------- */
  function buildICSBlob(dw) {
    const tz = getTZ(); const yStart = remYearStart(dw);
    const labelYear = `${yStart.getUTCFullYear()}/${yStart.getUTCFullYear()+1}`;
    const stamp = (() => { const d=new Date(); return d.getUTCFullYear()+pad(d.getUTCMonth()+1)+pad(d.getUTCDate())+'T'+pad(d.getUTCHours())+pad(d.getUTCMinutes())+pad(d.getUTCSeconds())+'Z'; })();
    const fmt = d => d.getUTCFullYear()+pad(d.getUTCMonth()+1)+pad(d.getUTCDate());
    const uid = () => (crypto&&crypto.randomUUID) ? crypto.randomUUID() : ('sof-'+Math.random().toString(36).slice(2));

    let ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Scroll of Fire//13 Moon//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n";
    for (let i=0;i<13;i++) {
      const s = wallDateForRemIdx(yStart, i*28), e = new Date(s); e.setUTCDate(e.getUTCDate()+28);
      ics += "BEGIN:VEVENT\r\nUID:"+uid()+"@scroll-of-fire\r\nDTSTAMP:"+stamp+"\r\nDTSTART;VALUE=DATE:"+fmt(s)+"\r\nDTEND;VALUE=DATE:"+fmt(e)+"\r\nSUMMARY:"+(i+1)+". "+MOONS[i].name+" Moon — "+labelYear+" ("+tz+")\r\nDESCRIPTION:"+MOONS[i].essence+"\r\nEND:VEVENT\r\n";
    }
    ics += "END:VCALENDAR\r\n";
    return new Blob([ics], { type: "text/calendar" });
  }

  /* ---------- Sky background ---------- */
  function paintSky() {
    const cv = $("#skyBg"); if (!cv) return;
    const ctx = cv.getContext("2d");
    const { width:w, height:h } = cv;
    ctx.clearRect(0,0,w,h);
    for (let i=0;i<160;i++){
      const x = Math.random()*w, y = Math.random()*h, r = Math.random()*1.6+0.2, a = Math.random()*0.6+0.2;
      ctx.fillStyle = `rgba(122,243,255,${a})`;
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    }
  }

  /* ---------- Wire controls ---------- */
  function wireControls() {
    const dl = $("#dlICS");
    if (dl) dl.addEventListener("click", (e)=>{ e.preventDefault(); const blob = buildICSBlob(getWallAnchor()); dl.href = URL.createObjectURL(blob); dl.download = "13-moon-year.ics"; });

    $("#regenICS")?.addEventListener("click",()=>{ if (dl) dl.href = "#"; });
    $("#btnToday")?.addEventListener("click",()=>{ const qp=new URLSearchParams(location.search); qp.delete("date"); qp.delete("pin"); history.replaceState(null,"",`${location.pathname}?${qp.toString()}`.replace(/\?$/,"")); paint(); });
    $("#prevDay")?.addEventListener("click",()=>{ const a=getWallAnchor(); const qp=new URLSearchParams(location.search); qp.set("date", isoDateWall(addDaysUTC(a,-1))); qp.set("pin","1"); history.replaceState(null,"",`${location.pathname}?${qp.toString()}`); paint(); });
    $("#nextDay")?.addEventListener("click",()=>{ const a=getWallAnchor(); const qp=new URLSearchParams(location.search); qp.set("date", isoDateWall(addDaysUTC(a,+1))); qp.set("pin","1"); history.replaceState(null,"",`${location.pathname}?${qp.toString()}`); paint(); });
    $("#datePick")?.addEventListener("change",(ev)=>{ const qp=new URLSearchParams(location.search); qp.set("date", ev.target.value); qp.set("pin","1"); history.replaceState(null,"",`${location.pathname}?${qp.toString()}`); paint(); });
    $("#jumpMoon")?.addEventListener("change",(ev)=>{ const a=getWallAnchor(), start=remYearStart(a); const m=parseInt(ev.target.value||"0",10); if(!m)return; const target=wallDateForRemIdx(start,(m-1)*28); const qp=new URLSearchParams(location.search); qp.set("date", isoDateWall(target)); qp.set("pin","1"); history.replaceState(null,"",`${location.pathname}?${qp.toString()}`); paint(); });

    $("#shareLink")?.addEventListener("click", async () => {
      const a=getWallAnchor(); const url = new URL(location.href);
      url.searchParams.set("date", isoDateWall(a)); url.searchParams.set("pin","1");
      try { await navigator.clipboard.writeText(url.toString()); $("#shareLink").textContent = "Copied"; setTimeout(()=>$("#shareLink").textContent="Copy Link", 1200); }
      catch { location.assign(url.toString()); }
    });

    $("#resetTZ")?.addEventListener("click",()=>{ try { Intl.DateTimeFormat().resolvedOptions = () => ({ timeZone: "America/Los_Angeles" }); } catch {} paint(); });

    // Live clock
    setInterval(() => {
      const tz = getTZ(); const el = $("#nowClock"); if (el) el.textContent = wallParts(new Date(), tz).toTimeString().slice(0,8);
    }, 1000);
  }

  /* ---------- Master paint ---------- */
  function paint() {
    const anchor = getWallAnchor();
    const pos = remnantPosition(anchor);

    paintHeader(pos, anchor);
    paintRing(pos, anchor);
    buildYearMap(anchor);
    buildRemnantMonth(anchor, pos);
    buildGregorianMonth(anchor);
    drawLunarPhase(anchor);
    paintNumAndVerse(pos);
    paintPractices(pos, anchor);
  }

  // Expose + boot
  window.paint = paint;
  window.addEventListener("load", () => { paintSky(); setTimeout(paint, 10); });
  wireControls();
})();
