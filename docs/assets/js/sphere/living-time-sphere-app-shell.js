(() => {
  "use strict";

  /*
   * B7.61 — APP SHELL for the Living Time Sphere.
   *
   * Aaron's direction (Nov 17, 2026): the sphere should feel like an app,
   * not a document. This module is progressive enhancement only — it runs
   * after the page's deferred scripts, before the sphere mounts, and:
   *
   *   - turns .sphere-wrapper into a full-viewport stage (top bar, sphere,
   *     selected-day bar, control dock) that does not scroll;
   *   - presents the existing panels as sliding sheets over the sphere:
   *     Settings (.sphere-controls-bar), Calendar Atlas
   *     (#calendar-workbench), Day & Layers (aside.sphere-sidebar) and the
   *     Living Planner (#living-planner). Nothing is deleted or cloned;
   *     the small tool blocks that used to stack under the sphere
   *     (view tools, everyday toolbar, schedule navigator, data safety,
   *     legend) are MOVED into the Day sheet and restored verbatim when
   *     the visitor exits to the full page;
   *   - proxies dock/top-bar taps to the real controls by id, so every
   *     behaviour stays owned by the existing modules (selection still
   *     flows through SOFTemporalCursor only);
   *   - mirrors the app's own state strip into the selected-day bar, so
   *     the bar can never disagree with the instrument;
   *   - keeps a plain "← Codex" door in the top bar — an ordinary link
   *     home, because the app hides the site header and Aaron found no
   *     way back (Nov 18, 2026). The shell never touches history: Back
   *     belongs to the visitor;
   *   - offers a fullscreen toggle in the dock where the browser allows
   *     it (requested on the document element so the sheets, which live
   *     outside the wrapper, stay reachable in fullscreen).
   *
   * Without this script (or without JS) the page is exactly the classic
   * document it was before.
   */

  const wrapper = document.querySelector(".sphere-wrapper");
  const container = document.getElementById("sphere-container");
  if (!wrapper || !container) return;

  const $ = (id) => document.getElementById(id);
  const click = (id) => {
    const el = $(id);
    if (!el) return false;
    el.click();
    return true;
  };

  const moved = [];
  function relocate(node, target) {
    if (!node || !target) return;
    moved.push({ node, parent: node.parentNode, next: node.nextSibling });
    target.appendChild(node);
  }
  function restoreMoved() {
    for (let i = moved.length - 1; i >= 0; i -= 1) {
      const { node, parent, next } = moved[i];
      if (parent && node.parentNode !== parent) {
        if (next && next.parentNode === parent) parent.insertBefore(node, next);
        else parent.appendChild(node);
      }
    }
    moved.length = 0;
  }

  // ── Chrome construction ──────────────────────────────────────────────

  const topbar = document.createElement("div");
  topbar.className = "sphere-app-topbar";
  topbar.innerHTML = `
    <a class="sphere-app-home" href="./" aria-label="Back to the Codex home page">← Codex</a>
    <div class="sphere-app-identity">
      <span class="sphere-app-sigil" aria-hidden="true">13×28</span>
      <span class="sphere-app-name">Living Time Sphere</span>
    </div>
    <p class="sphere-app-coordinate" id="sphere-app-coordinate" aria-live="polite">Aligning Living Time…</p>
    <div class="sphere-app-top-actions">
      <button type="button" class="sphere-app-top-btn" data-app-action="today">Today</button>
      <button type="button" class="sphere-app-top-btn" data-app-action="fullpage">Full page</button>
    </div>`;

  const daybar = document.createElement("div");
  daybar.className = "sphere-app-daybar";
  daybar.setAttribute("aria-label", "Selected day");
  daybar.innerHTML = `
    <button type="button" class="sphere-app-day-nav" data-app-action="prev-day" aria-label="Previous day">‹</button>
    <button type="button" class="sphere-app-day-main" data-app-action="open-day">
      <span class="sphere-app-day-label" id="sphere-app-day-label">Select a day on the sphere</span>
      <span class="sphere-app-day-sub">Day detail · Layers · Plan</span>
    </button>
    <button type="button" class="sphere-app-day-nav" data-app-action="next-day" aria-label="Next day">›</button>`;

  const dock = document.createElement("nav");
  dock.className = "sphere-app-dock";
  dock.setAttribute("aria-label", "Sphere controls");
  dock.innerHTML = `
    <button type="button" class="sphere-dock-btn" data-app-action="cam-top"><span aria-hidden="true">◎</span>Top</button>
    <button type="button" class="sphere-dock-btn" data-app-action="cam-tilt"><span aria-hidden="true">◐</span>Tilted</button>
    <button type="button" class="sphere-dock-btn" data-app-action="cam-edge"><span aria-hidden="true">◑</span>Edge</button>
    <button type="button" class="sphere-dock-btn" data-app-action="rotate" aria-pressed="false"><span aria-hidden="true">▶</span>Rotate</button>
    <button type="button" class="sphere-dock-btn" data-app-action="open-day"><span aria-hidden="true">▤</span>Day</button>
    <button type="button" class="sphere-dock-btn" data-app-action="open-atlas"><span aria-hidden="true">▦</span>Atlas</button>
    <button type="button" class="sphere-dock-btn" data-app-action="open-planner"><span aria-hidden="true">✎</span>Plan</button>
    <button type="button" class="sphere-dock-btn" data-app-action="open-settings"><span aria-hidden="true">⚙</span>Settings</button>
    <button type="button" class="sphere-dock-btn" data-app-action="fullscreen" aria-pressed="false" hidden><span aria-hidden="true">⛶</span>Full</button>`;

  const scrim = document.createElement("div");
  scrim.className = "sphere-app-scrim";
  scrim.setAttribute("aria-hidden", "true");

  const enterBtn = document.createElement("button");
  enterBtn.type = "button";
  enterBtn.className = "sphere-app-enter";
  enterBtn.textContent = "◎ Open the Sphere as an app";
  enterBtn.addEventListener("click", () => enterApp());

  wrapper.insertBefore(topbar, wrapper.firstChild);
  wrapper.appendChild(daybar);
  wrapper.appendChild(dock);
  wrapper.parentNode.insertBefore(enterBtn, wrapper);
  document.body.appendChild(scrim);

  // ── Sheets ───────────────────────────────────────────────────────────

  const sheets = new Map();
  function registerSheet(name, el) {
    if (!el) return;
    el.classList.add("sphere-sheet", `sphere-sheet--${name}`);
    el.setAttribute("data-app-sheet", name);
    const close = document.createElement("button");
    close.type = "button";
    close.className = "sphere-sheet-close";
    close.textContent = "✕ Close";
    close.addEventListener("click", () => closeSheets());
    el.insertBefore(close, el.firstChild);
    sheets.set(name, el);
  }

  registerSheet("settings", document.querySelector(".sphere-controls-bar"));
  registerSheet("atlas", $("calendar-workbench"));
  registerSheet("planner", $("living-planner"));
  registerSheet("day", document.querySelector(".sphere-sidebar"));

  // The Day sheet also carries the small tool blocks that used to stack
  // beneath the sphere, grouped at its head.
  const daySheet = sheets.get("day");
  let toolsBox = null;
  if (daySheet) {
    toolsBox = document.createElement("div");
    toolsBox.className = "sphere-sheet-tools";
    const heading = document.createElement("h2");
    heading.className = "sphere-sidebar-heading";
    heading.textContent = "Sphere Tools";
    toolsBox.appendChild(heading);
    daySheet.insertBefore(toolsBox, daySheet.children[1] || null);
  }

  let relocatedNow = false;
  function doRelocate() {
    if (relocatedNow || !toolsBox) return;
    // Instrument chrome that used to stack above the sphere: year
    // navigation, the location/season strip and the quick-jump/time-scale
    // nav live in the Day sheet inside the app (the top bar and the Day
    // sheet's own Location section cover their everyday roles).
    relocate(document.querySelector(".sphere-canvas-wrap .sphere-year-navigator"), toolsBox);
    relocate(document.querySelector(".sphere-canvas-wrap .sphere-location-season-strip"), toolsBox);
    relocate(document.querySelector(".sphere-canvas-wrap .sphere-quick-nav"), toolsBox);
    relocate(document.querySelector(".sphere-canvas-wrap .sphere-view-tools"), toolsBox);
    relocate(document.querySelector(".sphere-canvas-wrap .sphere-everyday-toolbar"), toolsBox);
    relocate(document.querySelector(".sphere-canvas-wrap .sphere-schedule-navigator"), toolsBox);
    relocate(document.querySelector(".sphere-canvas-wrap .sphere-data-safety"), toolsBox);
    relocate(document.querySelector(".sphere-wrapper > .sphere-legend"), toolsBox);
    relocatedNow = true;
  }

  let openSheetName = null;
  function openSheet(name) {
    const el = sheets.get(name);
    if (!el) return;
    closeSheets();
    openSheetName = name;
    el.classList.add("is-open");
    scrim.classList.add("is-visible");
    document.querySelectorAll(`[data-app-action="open-${name}"]`)
      .forEach(btn => btn.setAttribute("aria-pressed", "true"));
  }
  function closeSheets() {
    if (openSheetName) {
      sheets.get(openSheetName)?.classList.remove("is-open");
      document.querySelectorAll(`[data-app-action="open-${openSheetName}"]`)
        .forEach(btn => btn.setAttribute("aria-pressed", "false"));
      openSheetName = null;
    }
    scrim.classList.remove("is-visible");
  }
  scrim.addEventListener("click", closeSheets);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && openSheetName) closeSheets();
  });

  // ── App / full-page modes ────────────────────────────────────────────

  function enterApp() {
    document.body.classList.add("sphere-app");
    doRelocate();
    window.scrollTo(0, 0);
  }
  function exitApp() {
    closeSheets();
    document.body.classList.remove("sphere-app");
    restoreMoved();
    relocatedNow = false;
  }

  // ── Actions (all proxied to the real controls) ───────────────────────

  const rotateBtn = dock.querySelector('[data-app-action="rotate"]');
  function syncRotate() {
    const select = $("sphere-motion-mode");
    const drifting = select && select.value === "drift";
    if (rotateBtn) {
      rotateBtn.setAttribute("aria-pressed", drifting ? "true" : "false");
      rotateBtn.lastChild.textContent = drifting ? "Pause" : "Rotate";
    }
  }
  function toggleRotate() {
    const select = $("sphere-motion-mode");
    if (!select) return;
    select.value = select.value === "drift" ? "still" : "drift";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    syncRotate();
  }

  // ── Fullscreen ───────────────────────────────────────────────────────
  // Requested on the document element, not the wrapper alone: the
  // sheets (Settings, Atlas, Planner) and the scrim live outside the
  // wrapper in the DOM, and a wrapper-only fullscreen would leave their
  // dock buttons opening panels nobody can see. The stage is already
  // fixed inset-0, so the whole app goes full-bleed identically — and
  // the sphere refits itself through its own container ResizeObservers
  // (renderer + UI), which is why picking stays true after a toggle.
  // Where the API does not exist (iPhone Safari) the button never
  // appears; exiting is the same button, the browser's own Esc, or the
  // platform back gesture — fullscreenchange keeps the label honest.
  const fsBtn = dock.querySelector('[data-app-action="fullscreen"]');
  const fsRoot = document.documentElement;
  const fsRequest = fsRoot.requestFullscreen || fsRoot.webkitRequestFullscreen;
  const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  function syncFullscreen() {
    if (!fsBtn) return;
    const active = !!fsElement();
    fsBtn.setAttribute("aria-pressed", active ? "true" : "false");
    fsBtn.lastChild.textContent = active ? "Exit" : "Full";
    // Nudge window-resize listeners once the transition has settled;
    // the ResizeObservers do the real refit work.
    requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
  }
  function toggleFullscreen() {
    try {
      if (fsElement()) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) exit.call(document);
      } else if (fsRequest) {
        const result = fsRequest.call(fsRoot);
        if (result && typeof result.catch === "function") result.catch(() => {});
      }
    } catch {
      // Unsupported or blocked by the browser: fullscreenchange (or its
      // absence) leaves the button state exactly as it was.
    }
    syncFullscreen();
  }
  if (fsBtn && fsRequest && document.fullscreenEnabled !== false) fsBtn.hidden = false;
  document.addEventListener("fullscreenchange", syncFullscreen);
  document.addEventListener("webkitfullscreenchange", syncFullscreen);

  const actions = {
    "today": () => click("sphere-everyday-today") || click("calendar-return-today"),
    "fullpage": () => exitApp(),
    "prev-day": () => click("sphere-day-prev"),
    "next-day": () => click("sphere-day-next"),
    "cam-top": () => click("sphere-cam-pattern"),
    "cam-tilt": () => click("sphere-cam-passage"),
    "cam-edge": () => click("sphere-cam-years"),
    "rotate": () => toggleRotate(),
    "open-day": () => openSheet("day"),
    "open-atlas": () => openSheet("atlas"),
    "open-planner": () => openSheet("planner"),
    "open-settings": () => openSheet("settings"),
    "fullscreen": () => toggleFullscreen(),
  };

  document.addEventListener("click", (event) => {
    const btn = event.target.closest?.("[data-app-action]");
    if (!btn) return;
    const action = actions[btn.dataset.appAction];
    if (action) action();
  });

  // ── Live readouts (mirror the instrument, never invent) ─────────────

  const coordinateEl = $("sphere-app-coordinate");
  const dayLabelEl = $("sphere-app-day-label");

  function formatCoordinate(detail) {
    const c = detail?.coordinate || detail || {};
    const moon = c.moon ?? c.patternMoon;
    const day = c.day ?? c.moonDay ?? c.patternDayOfMoon;
    const patternDay = c.dayOfPatternYear ?? c.patternDay;
    if (moon != null && day != null) {
      return `Moon ${moon} · Day ${day}${patternDay != null ? ` · Pattern Day ${patternDay}` : ""}`;
    }
    return null;
  }

  function onCursor(detail) {
    const text = formatCoordinate(detail);
    if (text && coordinateEl) coordinateEl.textContent = text;
    if (text && dayLabelEl) dayLabelEl.textContent = text;
  }
  window.addEventListener("sof:temporal-cursor-ready", (e) => onCursor(e.detail));
  window.addEventListener("sof:temporal-cursor-change", (e) => onCursor(e.detail));
  window.addEventListener("sof:selected-date-change", (e) => onCursor(e.detail));

  // Fallback + day bar mirror: the state strip is the instrument's own
  // readout; whatever it says, the day bar says.
  const strip = $("sphere-state-strip");
  if (strip && dayLabelEl) {
    const mirror = () => {
      const text = (strip.textContent || "").trim().replace(/\s+/g, " ");
      if (text && !/resolving|aligning/i.test(text)) {
        dayLabelEl.textContent = text.length > 90 ? `${text.slice(0, 90)}…` : text;
      }
    };
    new MutationObserver(mirror).observe(strip, { childList: true, subtree: true, characterData: true });
    mirror();
  }

  $("sphere-motion-mode")?.addEventListener("change", syncRotate);
  syncRotate();

  // The app is the primary view: on load, you are IN the app.
  enterApp();
})();
