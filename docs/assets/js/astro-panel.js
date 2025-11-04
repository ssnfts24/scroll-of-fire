/* ==========================================================================
   Optional Ephemeris Painter
   Uses window.__EPHEMERIS__ if present; otherwise the Moons page shows the
   built-in animated demo. Safe to include on any page.
   Version: v2025.11.03-eph2 (tz stamp + safety + normalization)
   ========================================================================== */
(function () {
  "use strict";
  if (!window.__EPHEMERIS__) return;

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const pad = n => String(n).padStart(2, "0");

  /* ---------- helpers ---------- */
  const getTZ = () => {
    try {
      const qp = new URLSearchParams(location.search);
      return qp.get("tz") || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch { return "UTC"; }
  };
  const normDeg = v => {
    if (!Number.isFinite(v)) return null;
    let d = v % 360;
    if (d < 0) d += 360;
    return d;
  };
  const stampWall = (d, tz) => {
    try {
      const p = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz, year:"numeric", month:"2-digit", day:"2-digit",
        hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false
      }).formatToParts(d).reduce((a,p)=>(a[p.type]=p.value,a),{});
      return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
    } catch {
      return new Date(d).toISOString().slice(0,19).replace("T"," ");
    }
  };

  /* ---------- data ---------- */
  const eph = window.__EPHEMERIS__;
  const places = (eph && eph.placements) || {};   // { sun: deg, moon: deg, ... }
  const signs  = (eph && eph.signs) || {};        // { sun: "Aries", ... } optional
  const when   = eph.time ? new Date(eph.time) : new Date(); // optional ISO/ms
  const tz     = getTZ();

  /* ---------- UI chips (deg + sign names if provided) ---------- */
  function paintChips() {
    for (const [id, rawDeg] of Object.entries(places)) {
      const deg = normDeg(rawDeg);
      const posEl  = document.querySelector(`[data-pos="${id}"]`);
      const signEl = document.querySelector(`[data-sign="${id}"]`);
      if (posEl)  posEl.textContent  = (deg === null) ? "—" : `${Math.round(deg * 10) / 10}°`;
      if (signEl) signEl.textContent = signs && signs[id] ? signs[id] : "—";
    }
    const src = $("#astroSource"); if (src) src.textContent = "Ephemeris";
    const ts  = $("#astroStamp");  if (ts)  ts.textContent  = stampWall(when, tz);
    const tzl = $("#astroTZ");     if (tzl) tzl.textContent = tz;
  }

  /* ---------- wheel dots (SVG) ---------- */
  function paintWheel() {
    const wheel = $("#astroWheel"); if (!wheel) return;
    const dots  = $$("#planetDots [data-dot]", wheel);
    if (!dots.length) return;

    const R = 150;     // same radius the demo uses
    const CX = 180;    // svg center x
    const CY = 180;    // svg center y

    dots.forEach((node) => {
      const id  = node.getAttribute("data-dot");
      const deg = normDeg(places[id]);
      if (deg === null) return;
      // 0° at right, rotate so 0° points up (−90°)
      const rad = (deg - 90) * Math.PI / 180;
      const x = CX + R * Math.cos(rad);
      const y = CY + R * Math.sin(rad);
      node.setAttribute("cx", x.toFixed(2));
      node.setAttribute("cy", y.toFixed(2));
      node.setAttribute("data-deg", deg.toFixed(2));
      node.setAttribute("aria-label", `${id} ${deg.toFixed(1)}°${signs[id] ? " · "+signs[id] : ""}`);
    });
  }

  /* ---------- simple aspects table (optional) ---------- */
  function paintAspects() {
    const body = $("#aspBody"); if (!body) return;
    const pairs = eph.pairs || [["sun","moon"],["sun","mars"],["venus","mars"],["jupiter","saturn"]];
    const orbs  = Object.assign({ cj:6, sx:4, sq:5, tr:5, op:6 }, eph.orbs || {});

    function aspectOf(a, b) {
      const A = normDeg(places[a]), B = normDeg(places[b]);
      if (A === null || B === null) return null;
      const d = Math.abs((A - B + 360) % 360);
      const delta = Math.min(d, 360 - d);
      const near = (t, orb) => Math.abs(delta - t) <= orb;
      if (near(0,   orbs.cj)) return ["Conjunction","☌", (delta-0).toFixed(1)];
      if (near(60,  orbs.sx)) return ["Sextile","✶",  (delta-60).toFixed(1)];
      if (near(90,  orbs.sq)) return ["Square","□",   (delta-90).toFixed(1)];
      if (near(120, orbs.tr)) return ["Trine","△",    (delta-120).toFixed(1)];
      if (near(180, orbs.op)) return ["Opposition","☍",(delta-180).toFixed(1)];
      return null;
    }

    body.innerHTML = "";
    let rows = 0;
    for (const [a, b] of pairs) {
      const asp = aspectOf(a, b);
      if (!asp) continue;
      const [name, glyph, orb] = asp;
      body.insertAdjacentHTML(
        "beforeend",
        `<tr>
           <td class="mono">${a} — ${b}</td>
           <td>${glyph} ${name}</td>
           <td class="mono">${orb}°</td>
         </tr>`
      );
      rows++;
    }
    if (!rows) {
      body.innerHTML = `<tr><td colspan="3" class="meta">No major aspects within orbs.</td></tr>`;
    }
  }

  /* ---------- paint all ---------- */
  try {
    paintChips();
    paintWheel();
    paintAspects();
  } catch (e) {
    // Silent fail — the main page still works without ephemeris.
    console.warn("[Ephemeris painter] non-fatal error:", e);
  }
})();
