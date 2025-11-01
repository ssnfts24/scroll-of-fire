/* ==========================================================================
   Scroll of Fire — Accent & Theme Helpers
   - Stores/reads TZ + theme
   - Sets phase/season accent vars on <html>
   - Emits 'accent:change' when major values change
   ========================================================================== */
(() => {
  "use strict";
  const doc = document.documentElement;
  const store = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  const load  = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d } };

  /* ---------- Theme (persist + toggle API) ---------- */
  const THEME_KEY = "sofc.theme";
  function setTheme(next){
    doc.setAttribute("data-theme", next);
    store(THEME_KEY, next);
    window.dispatchEvent(new CustomEvent("accent:change", {detail:{theme:next}}));
  }
  const startingTheme = load(THEME_KEY,
    (matchMedia && matchMedia("(prefers-color-scheme: light)").matches) ? "light" : "dark");
  setTheme(startingTheme);
  window.SOFTheme = { get: () => doc.getAttribute("data-theme"), set: setTheme, toggle(){
    setTheme(this.get()==="dark" ? "light":"dark");
  }};

  /* ---------- Time Zone (single source of truth) ---------- */
  const TZ_KEY = "sofc.tz";
  const url = new URL(location.href);
  const paramTZ = url.searchParams.get("tz");
  const tz = paramTZ || load(TZ_KEY, Intl.DateTimeFormat().resolvedOptions().timeZone);
  store(TZ_KEY, tz);
  doc.dataset.tz = tz;
  window.SOFTZ = { get: () => doc.dataset.tz, set: (z) => { doc.dataset.tz = z; store(TZ_KEY, z); window.dispatchEvent(new CustomEvent("accent:change",{detail:{tz:z}})); } };

  /* ---------- Accent variables (season + lunar tint) ---------- */
  function setAccents(seed = Date.now()){
    // gentle daily hue drift + lunar weighting (if exposed by moons.js)
    const day = Math.floor(seed / 86400000);
    const base = (day % 360);
    const lunar = (window.__LUNAR_ACCENT__ || 0); // 0-1
    const hueA = (base + 182) % 360;
    const hueB = (base + 32)  % 360;

    // lerp to aqua/gold by lunar intensity
    const aqua = `oklch(0.86 0.12 ${200 + lunar*10})`;
    const gold = `oklch(0.86 0.14 ${95  + lunar*10})`;

    doc.style.setProperty("--accent", aqua);
    doc.style.setProperty("--accent-2", gold);
    doc.style.setProperty("--moon-accent", aqua);
    doc.style.setProperty("--moon-accent-2", gold);
    doc.style.setProperty("--season-a", `oklch(0.25 0.06 ${hueA})`);
    doc.style.setProperty("--season-b", `oklch(0.18 0.04 ${hueB})`);
  }
  setAccents();
  window.addEventListener("accent:lunar", (e)=>{ window.__LUNAR_ACCENT__ = e.detail.intensity||0; setAccents(); });

  /* ---------- helpers on window (opt) ---------- */
  window.SOFAccents = { refresh: setAccents };
})();
