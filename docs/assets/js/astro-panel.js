/* Optional ephemeris painter. If window.__EPHEMERIS__ is absent, the Moons page shows a nice fallback. */
(function(){
  "use strict";
  if (!window.__EPHEMERIS__) return;

  const $=(s,r=document)=>r.querySelector(s);
  const places = window.__EPHEMERIS__.placements || {};
  const signs  = window.__EPHEMERIS__.signs || {}; // { deg: "Aries", ... }
  const chip = (id,deg)=> {
    const pos = `${Math.round(deg*10)/10}°`;
    const sign = signs && signs[id] ? signs[id] : "—";
    const posEl = document.querySelector(`[data-pos="${id}"]`);
    const signEl= document.querySelector(`[data-sign="${id}"]`);
    if(posEl) posEl.textContent = pos;
    if(signEl) signEl.textContent= sign;
  };

  for (const [id,deg] of Object.entries(places)){ chip(id,deg); }

  const wheel = $("#astroWheel");
  if (wheel){
    const dots = wheel.querySelectorAll("[data-dot]");
    dots.forEach(d=>{
      const id = d.getAttribute("data-dot");
      const deg = places[id];
      if(typeof deg!=="number") return;
      const r = 150;
      const rad = (deg-90) * Math.PI/180;
      const cx = 180 + r * Math.cos(rad);
      const cy = 180 + r * Math.sin(rad);
      d.setAttribute("cx", cx.toFixed(2));
      d.setAttribute("cy", cy.toFixed(2));
    });
  }

  // aspects table example (very light)
  const pairs = [["sun","moon"],["sun","mars"],["venus","mars"],["jupiter","saturn"]];
  const aspectOf = (a,b)=>{
    const d = Math.abs((places[a]-places[b]+360)%360);
    const delta = Math.min(d, 360-d);
    const near = (target, orb)=> Math.abs(delta-target)<=orb;
    if(near(0,6)) return ["Conjunction","☌",delta.toFixed(1)];
    if(near(60,4)) return ["Sextile","✶", (delta-60).toFixed(1)];
    if(near(90,5)) return ["Square","□", (delta-90).toFixed(1)];
    if(near(120,5))return ["Trine","△", (delta-120).toFixed(1)];
    if(near(180,6))return ["Opposition","☍",(delta-180).toFixed(1)];
    return null;
  };
  const body = $("#aspBody");
  if(body){
    body.innerHTML="";
    for(const [a,b] of pairs){
      const asp = aspectOf(a,b);
      if(!asp) continue;
      const [name,glyph,orb] = asp;
      body.insertAdjacentHTML("beforeend", `<tr><td>${a} — ${b}</td><td>${glyph} ${name}</td><td class="mono">${orb}°</td></tr>`);
    }
    if(!body.children.length){
      body.innerHTML = `<tr><td colspan="3" class="meta">No major aspects within orbs.</td></tr>`;
    }
  }
})();