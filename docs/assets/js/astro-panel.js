/* ==========================================================================
   Scroll of Fire — Astrology Panel
   - Consumes window.__EPHEMERIS__ if present (positions in degrees + signs)
   - Renders planet chips, zodiac wheel labels/house lines, and aspects
   - Safe to load when no ephemeris (shows placeholders)
   - Emits 'astro:render' when finished
   ========================================================================== */
(() => {
  "use strict";

  const WHEEL = document.getElementById("astroWheel");
  if(!WHEEL) return;

  const ring = {
    houseLines: WHEEL.querySelector("#houseLines"),
    signLabels: WHEEL.querySelector("#signLabels"),
    dots: WHEEL.querySelector("#planetDots")
  };

  /* ---------------------------- geometry ---------------------------------- */
  const CX = 180, CY = 180, R = 140;
  const deg2xy = (deg, r=R) => {
    const rad = (deg - 90) * Math.PI/180;
    return [CX + r*Math.cos(rad), CY + r*Math.sin(rad)];
  };

  /* ---------------------------- labels ------------------------------------ */
  function drawWheelLabels(){
    ring.signLabels.innerHTML = "";
    const names = ["Ar","Ta","Ge","Cn","Le","Vi","Li","Sc","Sg","Cp","Aq","Pi"];
    for(let i=0;i<12;i++){
      const ang = i*30 + 15; // center
      const [x,y] = deg2xy(ang, 162);
      const t = document.createElementNS("http://www.w3.org/2000/svg","text");
      t.setAttribute("x", x); t.setAttribute("y", y);
      t.textContent = names[i];
      ring.signLabels.appendChild(t);
    }
    ring.houseLines.innerHTML = "";
    for(let i=0;i<12;i++){
      const ang = i*30;
      const [x1,y1] = deg2xy(ang, 162);
      const [x2,y2] = deg2xy(ang, 30);
      const l = document.createElementNS("http://www.w3.org/2000/svg","line");
      l.setAttribute("x1", x1); l.setAttribute("y1", y1);
      l.setAttribute("x2", x2); l.setAttribute("y2", y2);
      ring.houseLines.appendChild(l);
    }
  }

  /* ---------------------------- ephemeris --------------------------------- */
  function getEph(){
    // expected shape:
    // { stamp: "ISO", tz: "America/...", source: "swiss|custom", bodies: { sun:{deg:..., sign:"Ar"}, ... } }
    return window.__EPHEMERIS__ || null;
  }

  function placeDots(eph){
    const map = eph?.bodies || {};
    const wanted = ["sun","moon","mercury","venus","mars","jupiter","saturn"];
    wanted.forEach(key=>{
      const dot = WHEEL.querySelector(`[data-dot="${key}"]`);
      const chipPos = document.querySelector(`.astro [data-pos="${key}"]`);
      const chipSig = document.querySelector(`.astro [data-sign="${key}"]`);
      if(!dot) return;
      const d = map[key];
      if(!d){ chipPos && (chipPos.textContent="—"); chipSig && (chipSig.textContent="—"); return; }
      const [x,y] = deg2xy(d.deg, 150);
      dot.setAttribute("cx", x); dot.setAttribute("cy", y);
      chipPos && (chipPos.textContent = `${d.deg.toFixed(1)}°`);
      chipSig && (chipSig.textContent = d.sign || "—");
    });

    // outer bodies section
    const outer = ["uranus","neptune","pluto","chiron","north_node"];
    outer.forEach(key=>{
      const chipPos = document.querySelector(`.astro [data-pos="${key}"]`);
      const chipSig = document.querySelector(`.astro [data-sign="${key}"]`);
      const d = map[key];
      if(!chipPos || !chipSig) return;
      chipPos.textContent = d ? `${d.deg.toFixed(1)}°` : "—";
      chipSig.textContent = d?.sign || "—";
    });

    // stamp
    const stamp = document.getElementById("astroStamp");
    const tz = document.getElementById("astroTZ");
    const src = document.getElementById("astroSource");
    stamp && (stamp.textContent = eph?.stamp || "—");
    tz && (tz.textContent = eph?.tz || document.documentElement.dataset.tz || "—");
    src && (src.textContent = eph?.source || "—");
    WHEEL.id = "astroWheel"; // keep id
    WHEEL.classList.add("sweep");
    setTimeout(()=>WHEEL.classList.remove("sweep"), 1200);
  }

  /* ---------------------------- aspects table ------------------------------ */
  function computeAspects(eph){
    const b = eph?.bodies || {};
    const order = ["sun","moon","mercury","venus","mars","jupiter","saturn","uranus","neptune","pluto"];
    const pairs = [];
    function delta(a,b){ let d = Math.abs(a-b)%360; return d>180 ? 360-d : d; }
    const kinds = [
      {k:"Conjunction", s:0,   orb:8, cls:"conj", glyph:"☌"},
      {k:"Sextile",     s:60,  orb:3, cls:"sext", glyph:"✶"},
      {k:"Square",      s:90,  orb:6, cls:"sqr",  glyph:"□"},
      {k:"Trine",       s:120, orb:5, cls:"tri",  glyph:"△"},
      {k:"Opposition",  s:180, orb:8, cls:"opp",  glyph:"☍"},
    ];
    for(let i=0;i<order.length;i++){
      for(let j=i+1;j<order.length;j++){
        const A = b[order[i]], B = b[order[j]];
        if(!A||!B) continue;
        const d = delta(A.deg, B.deg);
        for(const kind of kinds){
          const off = Math.abs(d - kind.s);
          if(off <= kind.orb){
            pairs.push({a:order[i], b:order[j], kind, orb:off});
            break;
          }
        }
      }
    }
    return pairs.sort((x,y)=>x.orb - y.orb);
  }

  function renderAspects(eph){
    const body = document.getElementById("aspBody");
    if(!body) return;
    const rows = computeAspects(eph).map(p=>{
      const tight = p.orb <= (p.kind.orb * .33);
      return `<tr>
        <td><b>${p.a}</b> — <b>${p.b}</b></td>
        <td><span class="badge asp ${p.kind.cls}">${p.kind.glyph} ${p.kind.k}</span></td>
        <td class="deg ${tight?'orb-tight':'orb-wide'}">${p.orb.toFixed(1)}°</td>
      </tr>`;
    }).join("");
    body.innerHTML = rows || `<tr><td colspan="3" class="meta">No major aspects within default orbs.</td></tr>`;
  }

  /* ---------------------------- boot -------------------------------------- */
  function boot(){
    drawWheelLabels();
    const eph = getEph();
    placeDots(eph);
    renderAspects(eph);
    window.dispatchEvent(new CustomEvent("astro:render",{detail:{ok:!!eph}}));
  }

  document.readyState !== "loading" ? boot() : document.addEventListener("DOMContentLoaded", boot);
  window.addEventListener("accent:change", boot); // re-stamp TZ on change
})();
