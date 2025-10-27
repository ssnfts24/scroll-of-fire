/* ==========================================================================
   Scroll of Fire — Accents + Theme micro-engine
   - Syncs --moon-accent variables with current phase/selection
   - Provides theme toggle + persists to localStorage("theme")
   - Exposes small API: window.SOF_ACCENTS.set(hex1, hex2)
   ========================================================================== */
(function(){
  "use strict";

  const root = document.documentElement;
  const THEME_KEY = "theme";

  function setVar(name, value){ root.style.setProperty(name, value); }
  function mixHex(a,b,t){
    const pa=parseInt(a.slice(1),16), pb=parseInt(b.slice(1),16);
    const ar=(pa>>16)&255, ag=(pa>>8)&255, ab=pa&255;
    const br=(pb>>16)&255, bg=(pb>>8)&255, bb=pb&255;
    const rr=Math.round(ar+(br-ar)*t), gg=Math.round(ag+(bg-ag)*t), bb2=Math.round(ab+(bb-ab)*t);
    return `#${((1<<24)+(rr<<16)+(gg<<8)+bb2).toString(16).slice(1)}`;
  }

  function applyToGrad(id, c1, c2){
    const g = document.getElementById(id);
    if (!g) return;
    const stops = g.querySelectorAll("stop");
    if (stops[0]) stops[0].setAttribute("stop-color", c1);
    if (stops[1]) stops[1].setAttribute("stop-color", c2);
  }

  function setAccents(c1, c2){
    setVar("--moon-accent", c1);
    setVar("--moon-accent-2", c2);
    applyToGrad("mbGrad", c1, c2);
    applyToGrad("rg", c1, c2);
    document.dispatchEvent(new Event("sof:accent-change"));
  }

  // Theme toggle (optional button with [data-theme-toggle])
  function getTheme(){
    try{
      return localStorage.getItem(THEME_KEY) ||
        ((window.matchMedia && matchMedia("(prefers-color-scheme: light)").matches) ? "light" : "dark");
    }catch{ return "dark"; }
  }
  function setTheme(t){
    root.setAttribute("data-theme", t);
    try{ localStorage.setItem(THEME_KEY, t); }catch{}
    document.dispatchEvent(new CustomEvent("sof:theme", {detail:{theme:t}}));
  }

  document.addEventListener("click", (e)=>{
    const btn = e.target.closest("[data-theme-toggle]");
    if (!btn) return;
    const cur = getTheme();
    setTheme(cur === "dark" ? "light" : "dark");
  }, {passive:true});

  // Hook: moons.js can dispatch sof:phase to tint accents
  document.addEventListener("sof:phase", (e)=>{
    const illum = Math.max(0, Math.min(1, Number(e.detail?.illum ?? 0)));
    const cold = "#7af3ff", warm = "#f3c97a";
    const c1 = mixHex(cold, warm, illum*0.7);
    const c2 = mixHex(warm, cold, (1-illum)*0.7);
    setAccents(c1, c2);
  });

  // Public
  window.SOF_ACCENTS = {
    set: setAccents,
    theme: { get:getTheme, set:setTheme }
  };

  // Initialize now
  setTheme(getTheme());
})();
