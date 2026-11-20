(() => {
  "use strict";

  /*
   * Sphere deepening layer — an overlay on the Living Time Sphere page.
   *
   * Aaron's direction (Nov 18, 2026): the Sphere needs more detail,
   * a true fullscreen, easier navigation on the full page, and Nori
   * ON the Sphere — travelling around it and helping her keeper
   * navigate it.
   *
   * This module is an overlay only. It never touches the sphere
   * engine, geometry, camera, picking, or the day-zoom module. It
   * drives the instrument exclusively through the page's own public
   * controls (the everyday Today button, the quick-jump field, the
   * mode buttons, the app shell's dock actions) and reads the page's
   * own state strip. Selection still flows through SOFTemporalCursor
   * alone, owned by the existing modules.
   *
   * Three pieces:
   *   1. A Sphere guide bar over the stage — where am I, and one-tap
   *      trips to Today, a named Moon, the selected day, the whole
   *      year, and full screen. Works for every visitor.
   *   2. Full screen that is actually reachable — the same
   *      document-level fullscreen the app shell uses (so the
   *      sheets stay reachable), offered on the stage itself, in
   *      both the app view and the classic full page.
   *   3. Nori's orbit — for a keeper who has adopted a Spark, she
   *      travels an ellipse around the sphere on this page, and her
   *      bubble gains a Sphere guide that performs the same trips.
   *      While she orbits, her corner walker rests hidden; tapping
   *      her orbit (or her opening her bubble) brings her back.
   *      Reduced motion means no orbit — she simply stays in her
   *      corner, exactly as her own presence already behaves.
   *   4. Share this view (Nov 19, 2026) — the guide bar composes a
   *      share of the day on screen from its own readout, in the
   *      almanac frame, for the keeper to send from their own share
   *      sheet or composer. A drawn card stands in for a picture of
   *      the Sphere, labelled as drawn; nothing posts by itself.
   *   5. Clean full screen + a clear stage (Nov 19, 2026) — Aaron
   *      found the full screen as covered as the page: the guide
   *      bar and the page chrome sat on top of the Sphere. Now,
   *      while full screen is on, the chrome steps aside (the
   *      deepening stylesheet carries the rules, keyed to a class
   *      this layer keeps on the root element), the guide bar
   *      folds to one slim line — the day, Exit, and a Guide
   *      button that brings the full bar back on tap — and touch
   *      interaction is switched on so the Sphere can be turned.
   *      In the everyday view the stage column keeps a space below
   *      the instrument the height of the guide bar, measured from
   *      the bar itself, so the bar rests under the Sphere and the
   *      whole instrument stays in view.
   */

  const container = document.getElementById("sphere-container");
  const wrap = document.querySelector(".sphere-canvas-wrap");
  if (!container || !wrap) return;

  const $ = (id) => document.getElementById(id);
  const clickEl = (el) => {
    if (!el) return false;
    el.click();
    return true;
  };
  const clickId = (id) => clickEl($(id));
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── Shared trips (public controls only) ──────────────────────────

  function goToday() {
    return (
      clickId("sphere-everyday-today") ||
      clickEl(document.querySelector('[data-app-action="today"]')) ||
      clickId("calendar-return-today") ||
      clickId("sphere-year-live")
    );
  }

  function goMoon(moon) {
    const input = $("sphere-quick-jump-input");
    const submit = $("sphere-quick-jump-submit");
    if (input && submit) {
      input.value = `Moon ${moon} Day 1`;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      submit.click();
      return true;
    }
    const moonSel = $("calendar-pattern-moon");
    const daySel = $("calendar-pattern-day");
    if (moonSel && daySel && clickId("calendar-jump-pattern")) {
      moonSel.value = String(moon);
      daySel.value = "1";
      moonSel.dispatchEvent(new Event("change", { bubbles: true }));
      daySel.dispatchEvent(new Event("change", { bubbles: true }));
      $("calendar-jump-pattern").click();
      return true;
    }
    return false;
  }

  function openSelectedDay() {
    if (document.body.classList.contains("sphere-app")) {
      if (clickEl(document.querySelector('[data-app-action="open-day"]'))) return true;
    }
    clickId("sphere-center-selected");
    const bench = $("calendar-workbench");
    if (bench) {
      bench.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
      return true;
    }
    return false;
  }

  function goWholeYear() {
    return clickId("sphere-mode-pattern") || clickId("sphere-cam-reset");
  }

  // ── Full screen ──────────────────────────────────────────────────
  // Same contract as the app shell: requested on the document
  // element so the sheets (Settings, Atlas, Planner), which live
  // outside the wrapper, stay reachable while fullscreen.
  const fsRoot = document.documentElement;
  const fsRequest = fsRoot.requestFullscreen || fsRoot.webkitRequestFullscreen;
  const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  const fsSupported = !!fsRequest && document.fullscreenEnabled !== false;
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
      /* Unsupported or blocked: fullscreenchange leaves labels honest. */
    }
  }

  // ── The Sphere guide bar ─────────────────────────────────────────

  const moonNames = (() => {
    const names = globalThis.PatternCalendarData?.moonNames || globalThis.PatternCalendar?.moonNames;
    if (Array.isArray(names) && names.length === 13) return names;
    return Array.from({ length: 13 }, (_, i) => `Moon ${i + 1}`);
  })();

  const bar = document.createElement("div");
  bar.className = "sphere-guide-bar";
  bar.setAttribute("aria-label", "Sphere guide");
  bar.innerHTML = `
    <p class="sgb-readout"><span class="sgb-readout-label">You are looking at</span>
      <strong class="sgb-readout-value" id="sgb-readout-value">the Sphere aligning…</strong></p>
    <div class="sgb-actions">
      <button type="button" class="sgb-btn" data-sgb="today">Today</button>
      <label class="sgb-moon"><span class="sgb-moon-label">Moon</span>
        <select class="sgb-moon-select" aria-label="Choose a Moon to visit"></select>
      </label>
      <button type="button" class="sgb-btn" data-sgb="moon-go">Go</button>
      <button type="button" class="sgb-btn" data-sgb="day">Selected day</button>
      <button type="button" class="sgb-btn" data-sgb="year">Whole year</button>
      <button type="button" class="sgb-btn sgb-share" data-sgb="share">Share this view</button>
      <button type="button" class="sgb-btn sgb-fs" data-sgb="fs" hidden>⛶ Full screen</button>
      <button type="button" class="sgb-btn sgb-clean-toggle" data-sgb="guide" aria-expanded="false" aria-label="Show the guide bar">Guide</button>
    </div>
    <div class="sgb-share-row" hidden>
      <a class="sgb-btn sgb-share-link" data-sgb-share="facebook" target="_blank" rel="noopener">Share on Facebook</a>
      <a class="sgb-btn sgb-share-link" data-sgb-share="x" target="_blank" rel="noopener">Share on X</a>
      <a class="sgb-btn sgb-share-link" data-sgb-share="card" download>Save the drawn card</a>
      <span class="sgb-share-note"></span>
    </div>
    <p class="sgb-status" role="status" aria-live="polite"></p>`;

  const moonSelect = bar.querySelector(".sgb-moon-select");
  moonNames.forEach((name, i) => {
    const opt = document.createElement("option");
    opt.value = String(i + 1);
    opt.textContent = `${i + 1} · ${name}`;
    moonSelect.appendChild(opt);
  });

  wrap.appendChild(bar);

  const readoutValue = bar.querySelector(".sgb-readout-value");
  const statusEl = bar.querySelector(".sgb-status");
  const strip = $("sphere-state-strip");
  function mirrorReadout() {
    if (!strip) return;
    const text = (strip.textContent || "").trim().replace(/\s+/g, " ");
    if (text && !/resolving|aligning/i.test(text)) readoutValue.textContent = text;
  }
  if (strip) {
    new MutationObserver(mirrorReadout).observe(strip, { childList: true, subtree: true, characterData: true });
    mirrorReadout();
  }

  function announce(trip) {
    window.setTimeout(() => {
      mirrorReadout();
      const now = readoutValue.textContent;
      statusEl.textContent = now && !/aligning/i.test(now) ? `${trip} — now showing ${now}.` : `${trip}.`;
    }, 450);
  }

  const fsBtn = bar.querySelector('[data-sgb="fs"]');
  function syncFs() {
    if (!fsBtn) return;
    const active = !!fsElement();
    fsBtn.textContent = active ? "⛶ Exit full screen" : "⛶ Full screen";
    fsBtn.setAttribute("aria-pressed", active ? "true" : "false");
  }
  if (fsSupported && fsBtn) {
    fsBtn.hidden = false;
    document.addEventListener("fullscreenchange", syncFs);
    document.addEventListener("webkitfullscreenchange", syncFs);
    syncFs();
  }

  // ── Clean full screen + a clear stage ──────────────────────────
  // While full screen is on, the root element carries sgb-fs and
  // the deepening stylesheet steps the page chrome aside, in both
  // the app view and the classic full page. The guide bar folds
  // to one slim line; the Guide button opens the full bar, Hide
  // folds it again, and leaving full screen restores the everyday
  // view. Touch interaction is switched on for the visit through
  // the page's own Interact button, so the Sphere can be turned,
  // and switched back on the way out if this layer switched it
  // on. If interaction stays off, the Interact bar stays in view
  // (the stylesheet's sgb-fs-interact-off carve-out) — it is the
  // one control the visitor still needs.
  const rootEl = document.documentElement;
  const guideToggle = bar.querySelector('[data-sgb="guide"]');

  function interactIsOn() {
    const end = $("sphere-interact-end-btn");
    return !!end && end.style.display !== "none";
  }

  let fsAutoInteract = false;
  function syncCleanFs() {
    const active = !!fsElement();
    rootEl.classList.toggle("sgb-fs", active);
    rootEl.classList.remove("sgb-fs-interact-off");
    if (active) {
      bar.classList.add("sgb-bar-slim");
      bar.classList.remove("sgb-bar-open");
      const startBtn = $("sphere-interact-btn");
      if (startBtn && !interactIsOn()) {
        fsAutoInteract = true;
        startBtn.click();
        window.setTimeout(() => {
          if (fsElement() && !interactIsOn()) rootEl.classList.add("sgb-fs-interact-off");
        }, 120);
      }
    } else {
      bar.classList.remove("sgb-bar-slim", "sgb-bar-open");
      if (fsAutoInteract) {
        const endBtn = $("sphere-interact-end-btn");
        if (endBtn && interactIsOn()) endBtn.click();
        fsAutoInteract = false;
      }
    }
    syncGuideToggle();
    fitBarReserve();
  }

  function syncGuideToggle() {
    if (!guideToggle) return;
    const open = bar.classList.contains("sgb-bar-open");
    guideToggle.textContent = open ? "Hide" : "Guide";
    guideToggle.setAttribute("aria-expanded", open ? "true" : "false");
    guideToggle.setAttribute("aria-label", open ? "Hide the guide bar" : "Show the guide bar");
  }

  function toggleGuideBar() {
    const open = bar.classList.toggle("sgb-bar-open");
    bar.classList.toggle("sgb-bar-slim", !open);
    syncGuideToggle();
  }

  document.addEventListener("fullscreenchange", syncCleanFs);
  document.addEventListener("webkitfullscreenchange", syncCleanFs);

  // The everyday view: the stage column keeps a space below the
  // instrument the height of the guide bar, so the bar rests under
  // the Sphere and the whole instrument stays in view. The bar is
  // measured, never guessed — a trip's answer line and the share
  // row change its height, and the reserve follows.
  function fitBarReserve() {
    if (fsElement()) {
      wrap.style.paddingBottom = "";
      return;
    }
    const h = bar.offsetHeight;
    if (h > 0) wrap.style.paddingBottom = `${h + 14}px`;
  }
  if ("ResizeObserver" in window) new ResizeObserver(fitBarReserve).observe(bar);
  window.addEventListener("resize", fitBarReserve);
  fitBarReserve();

  // ── Slim by default on portrait phones ─────────────────────────
  // In the app view on a portrait phone, the full guide bar wraps to
  // three rows and the reserve it takes under the stage squeezes the
  // Sphere below the renderer's own minimum height — the page then
  // refuses 3D and settles on the 2D fallback (Aaron's A16, Nov 19,
  // 2026). So on a portrait phone the bar starts folded to its slim
  // line, the same fold full screen uses; the Guide button unfolds
  // it, Hide folds it again. The root carries sgb-slim-default so
  // the deepening stylesheet can show the Guide button and style
  // the fold outside full screen.
  const slimMq = window.matchMedia?.("(max-width: 720px) and (orientation: portrait)");
  function applySlimDefault(force = false) {
    if (fsElement()) return; // full screen runs its own fold
    const slim = !!slimMq?.matches && document.body.classList.contains("sphere-app");
    rootEl.classList.toggle("sgb-slim-default", slim);
    if (!slim) {
      if (!bar.classList.contains("sgb-bar-open")) bar.classList.remove("sgb-bar-slim");
      return;
    }
    if (force || !bar.classList.contains("sgb-bar-open")) {
      bar.classList.add("sgb-bar-slim");
      bar.classList.remove("sgb-bar-open");
    }
    syncGuideToggle();
    fitBarReserve();
  }
  applySlimDefault(true);
  window.addEventListener("load", () => applySlimDefault(true));
  slimMq?.addEventListener?.("change", () => applySlimDefault(true));
  // Leaving full screen clears the bar's fold; restore the slim
  // default afterwards (registered after syncCleanFs, so it runs
  // after the full-screen fold has been lifted).
  document.addEventListener("fullscreenchange", () => applySlimDefault(true));
  document.addEventListener("webkitfullscreenchange", () => applySlimDefault(true));
  if ("MutationObserver" in window && document.body) {
    // The app shell adds sphere-app to the body as it boots; catch
    // that moment so the fold is in place before the stage settles.
    new MutationObserver(() => applySlimDefault()).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }

  // ── Share this view ────────────────────────────────────────────
  // Aaron's direction (Nov 19, 2026): the Sphere should support
  // social media. The share is composed from the guide bar's own
  // readout — the instrument's public state strip, mirrored above —
  // in the almanac frame: coordinate first, the Moon's name, one
  // short line, the closing ritual, the site, three hashtags. The
  // keeper sends it themselves from their own share sheet or
  // composer. Nothing posts by itself; no SDKs, no trackers.
  const SPHERE_URL = "https://codexofreality.org/living-time-sphere.html";
  const shareRow = bar.querySelector(".sgb-share-row");
  const shareNote = bar.querySelector(".sgb-share-note");
  const shareCardLink = bar.querySelector('[data-sgb-share="card"]');
  let shareCardObjectUrl = null;

  function parseReadout(text) {
    const t = String(text || "");
    const full = t.match(/Moon (\d{1,2}) · Day (\d{1,2}) · Day (\d{1,3})\/364/);
    if (full) return { moon: Number(full[1]), day: Number(full[2]), patternDay: Number(full[3]) };
    const part = t.match(/Moon (\d{1,2}) · Day (\d{1,2})/);
    if (part) return { moon: Number(part[1]), day: Number(part[2]), patternDay: null };
    return null;
  }

  function buildShareText(coord) {
    const moonName = moonNames[coord.moon - 1] || `Moon ${coord.moon}`;
    const head = coord.patternDay
      ? `Moon ${coord.moon} · Day ${coord.day} · Pattern Day ${coord.patternDay}`
      : `Moon ${coord.moon} · Day ${coord.day}`;
    return [
      head,
      moonName,
      "Looking at this day on the Living Time Sphere.",
      "Observe. Breathe. Align. Return.",
      "codexofreality.org",
      "#13Moons #LivingTime #CodexOfReality"
    ].join("\n");
  }

  // A true capture of the stage, when the browser honestly gives
  // one. The sphere renders WebGL without a preserved drawing
  // buffer, so the canvas usually reads back blank; the pixels are
  // sampled and a blank capture is rejected, never shared as if it
  // were the Sphere.
  function captureStageImage() {
    const canvas = container.querySelector("canvas");
    if (!canvas || !canvas.width || !canvas.height) return null;
    try {
      const copy = document.createElement("canvas");
      copy.width = canvas.width;
      copy.height = canvas.height;
      const g = copy.getContext("2d", { willReadFrequently: true });
      if (!g) return null;
      g.drawImage(canvas, 0, 0);
      const data = g.getImageData(0, 0, copy.width, copy.height).data;
      let nonBlank = 0;
      let sampled = 0;
      for (let i = 0; i < data.length; i += 401 * 4) {
        sampled += 1;
        if (data[i + 3] > 0 && (data[i] > 12 || data[i + 1] > 12 || data[i + 2] > 12)) nonBlank += 1;
      }
      if (!sampled || nonBlank / sampled < 0.02) return null;
      return copy;
    } catch {
      return null;
    }
  }

  // The fallback picture: a card drawn from the day's coordinate,
  // in the Codex colours. It is labelled as drawn, everywhere it
  // appears, and never passed off as a screenshot of the Sphere.
  function drawShareCard(coord) {
    const card = document.createElement("canvas");
    card.width = 1200;
    card.height = 630;
    const g = card.getContext("2d");
    if (!g) return null;
    g.fillStyle = "#04060c";
    g.fillRect(0, 0, 1200, 630);
    const wash = g.createRadialGradient(600, 240, 40, 600, 240, 560);
    wash.addColorStop(0, "rgba(45, 212, 191, 0.20)");
    wash.addColorStop(1, "rgba(4, 6, 12, 0)");
    g.fillStyle = wash;
    g.fillRect(0, 0, 1200, 630);
    g.strokeStyle = "rgba(212, 175, 55, 0.85)";
    g.lineWidth = 3;
    g.strokeRect(36, 36, 1128, 558);
    // The ring: thirteen Moons around one circle, the shared Moon in gold.
    const cx = 600;
    const cy = 218;
    g.strokeStyle = "rgba(45, 212, 191, 0.55)";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, cy, 118, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(cx, cy, 84, 0, Math.PI * 2);
    g.stroke();
    for (let i = 0; i < 13; i += 1) {
      const a = (i / 13) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * 118;
      const y = cy + Math.sin(a) * 118;
      g.fillStyle = i === coord.moon - 1 ? "#d4af37" : "rgba(190, 242, 255, 0.75)";
      g.beginPath();
      g.arc(x, y, i === coord.moon - 1 ? 10 : 6, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = "#ffd97a";
    g.beginPath();
    g.arc(cx, cy, 15, 0, Math.PI * 2);
    g.fill();
    const head = coord.patternDay
      ? `Moon ${coord.moon} · Day ${coord.day} · Pattern Day ${coord.patternDay}`
      : `Moon ${coord.moon} · Day ${coord.day}`;
    const moonName = moonNames[coord.moon - 1] || `Moon ${coord.moon}`;
    g.textAlign = "center";
    g.fillStyle = "#ffd97a";
    g.font = "600 58px Georgia, 'Times New Roman', serif";
    g.fillText(head, cx, 448);
    g.fillStyle = "#e8f1f2";
    g.font = "italic 40px Georgia, 'Times New Roman', serif";
    g.fillText(moonName, cx, 508);
    g.fillStyle = "rgba(190, 220, 225, 0.85)";
    g.font = "28px Georgia, 'Times New Roman', serif";
    g.fillText("The Living Time Sphere · codexofreality.org", cx, 562);
    return card;
  }

  function renderShareRow(coord, text, imageCanvas, imageKind) {
    const fb = bar.querySelector('[data-sgb-share="facebook"]');
    const xi = bar.querySelector('[data-sgb-share="x"]');
    if (fb) fb.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SPHERE_URL)}&quote=${encodeURIComponent(text)}`;
    if (xi) xi.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(SPHERE_URL)}`;
    if (shareCardLink) {
      if (shareCardObjectUrl) URL.revokeObjectURL(shareCardObjectUrl);
      shareCardObjectUrl = null;
      if (imageCanvas) {
        shareCardLink.hidden = false;
        shareCardLink.textContent = imageKind === "capture" ? "Save the view image" : "Save the drawn card";
        shareCardLink.setAttribute("download", `living-time-sphere-moon-${coord.moon}-day-${coord.day}.png`);
        imageCanvas.toBlob((blob) => {
          if (!blob) { shareCardLink.hidden = true; return; }
          shareCardObjectUrl = URL.createObjectURL(blob);
          shareCardLink.href = shareCardObjectUrl;
        }, "image/png");
      } else {
        shareCardLink.hidden = true;
      }
    }
    if (shareNote) {
      shareNote.textContent = imageKind === "card"
        ? "The card is drawn from this day's coordinate. It is not a screenshot of the Sphere."
        : "";
    }
  }

  async function shareView() {
    mirrorReadout();
    const coord = parseReadout(readoutValue.textContent);
    if (!coord) {
      statusEl.textContent = "Share waits until the Sphere has aligned.";
      return;
    }
    const text = buildShareText(coord);
    let imageCanvas = captureStageImage();
    let imageKind = imageCanvas ? "capture" : null;
    if (!imageCanvas) {
      imageCanvas = drawShareCard(coord);
      imageKind = imageCanvas ? "card" : null;
    }
    renderShareRow(coord, text, imageCanvas, imageKind);
    if (typeof navigator.share === "function") {
      const payload = { title: "The Living Time Sphere", text, url: SPHERE_URL };
      try {
        if (imageCanvas && typeof navigator.canShare === "function") {
          const blob = await new Promise((resolve) => imageCanvas.toBlob(resolve, "image/png"));
          if (blob) {
            const file = new File([blob], `living-time-sphere-moon-${coord.moon}-day-${coord.day}.png`, { type: "image/png" });
            if (navigator.canShare({ files: [file] })) payload.files = [file];
          }
        }
        await navigator.share(payload);
        if (shareRow) shareRow.hidden = true;
        statusEl.textContent = imageKind === "card"
          ? "Shared, with a drawn card of this day. The card is drawn, not a screenshot."
          : "Shared.";
        return;
      } catch (err) {
        if (err && err.name === "AbortError") {
          statusEl.textContent = "Share closed. Nothing was sent.";
          return;
        }
        // Any other failure: the compose doors below carry it.
      }
    }
    if (shareRow) shareRow.hidden = false;
    statusEl.textContent = imageKind === "card"
      ? "Share this view: choose a door below. The card is drawn from the day's coordinate, not a screenshot."
      : "Share this view: choose a door below.";
  }

  bar.addEventListener("click", (event) => {
    const btn = event.target.closest?.("[data-sgb]");
    if (!btn) return;
    const action = btn.dataset.sgb;
    if (action === "today" && goToday()) announce("Back to today");
    else if (action === "moon-go" && goMoon(Number(moonSelect.value))) {
      announce(`To Moon ${moonSelect.value}, ${moonNames[Number(moonSelect.value) - 1]}`);
    } else if (action === "day" && openSelectedDay()) announce("Your selected day, open");
    else if (action === "year" && goWholeYear()) announce("The whole year");
    else if (action === "share") shareView();
    else if (action === "fs") toggleFullscreen();
    else if (action === "guide") toggleGuideBar();
  });

  // ── Nori on the Sphere: the orbit + her bubble guide ─────────────

  const Core = window.SparkCompanion;
  if (!Core) return;

  function readRecord() {
    try {
      const raw = window.localStorage.getItem(Core.STORAGE_KEY);
      if (!raw) return null;
      const record = JSON.parse(raw);
      if (!record || !Core.parseSeed(record.seed)) return null;
      return record;
    } catch {
      return null;
    }
  }

  let orbitStarted = false;
  function whenPresenceReady(tries) {
    const host = document.querySelector(".spark-presence");
    const bubble = host?.querySelector(".spark-presence-bubble");
    if (host && bubble) {
      buildSphereGuide(host, bubble);
      if (!reducedMotion && !orbitStarted) {
        orbitStarted = true;
        startOrbit(host, bubble);
      }
      return;
    }
    if (tries > 0) window.setTimeout(() => whenPresenceReady(tries - 1), 700);
  }

  function buildSphereGuide(host, bubble) {
    if (bubble.querySelector(".spark-sphere-guide")) return;
    const record = readRecord();
    const name = record ? Core.displayName(record, Core.generate(record.seed)) : "Your Spark";
    const box = document.createElement("div");
    box.className = "spark-sphere-guide";
    box.innerHTML = `
      <p class="spark-panel-row spark-sphere-guide-head"><strong>On the Sphere</strong>
        <span class="spark-sphere-guide-sub">— ${name} can take you</span></p>
      <p class="spark-sphere-guide-line" aria-live="polite"></p>
      <p class="spark-sphere-guide-buttons">
        <button type="button" data-ssg="today">Today</button>
        <button type="button" data-ssg="day">The selected day</button>
        <button type="button" data-ssg="year">The whole year</button>
      </p>
      <p class="spark-sphere-guide-moons"></p>`;
    const line = box.querySelector(".spark-sphere-guide-line");
    const syncLine = () => {
      const text = (strip?.textContent || "").trim().replace(/\s+/g, " ");
      if (text && !/resolving|aligning/i.test(text)) line.textContent = `We are looking at ${text}.`;
    };
    if (strip) new MutationObserver(syncLine).observe(strip, { childList: true, subtree: true, characterData: true });
    syncLine();

    const moonsRow = box.querySelector(".spark-sphere-guide-moons");
    const moonSel = document.createElement("select");
    moonSel.setAttribute("aria-label", "Choose a Moon and she will take you there");
    moonNames.forEach((moonName, i) => {
      const opt = document.createElement("option");
      opt.value = String(i + 1);
      opt.textContent = `${i + 1} · ${moonName}`;
      moonSel.appendChild(opt);
    });
    const moonGo = document.createElement("button");
    moonGo.type = "button";
    moonGo.textContent = "Take me to this Moon";
    moonGo.addEventListener("click", () => {
      if (goMoon(Number(moonSel.value))) {
        window.setTimeout(syncLine, 450);
      }
    });
    moonsRow.appendChild(moonSel);
    moonsRow.appendChild(document.createTextNode(" "));
    moonsRow.appendChild(moonGo);

    box.addEventListener("click", (event) => {
      const btn = event.target.closest?.("[data-ssg]");
      if (!btn) return;
      const action = btn.dataset.ssg;
      if (action === "today") goToday();
      else if (action === "day") openSelectedDay();
      else if (action === "year") goWholeYear();
      window.setTimeout(syncLine, 450);
    });

    const anchor = bubble.querySelector(".spark-presence-actions");
    if (anchor && anchor.parentNode === bubble) anchor.insertAdjacentElement("afterend", box);
    else bubble.appendChild(box);
  }

  function startOrbit(host, bubble) {
    const record = readRecord();
    if (!record) return; // No adopted Spark — her meeting happens first.
    const companion = Core.generate(record.seed);
    const stage = Core.stageOf ? Core.stageOf(record, companion) : { index: 0 };
    const name = Core.displayName(record, companion);

    const orbit = document.createElement("button");
    orbit.type = "button";
    orbit.className = "sphere-nori-orbit";
    orbit.setAttribute("aria-label", `${name} is travelling around the Sphere — tap to talk with her`);
    orbit.innerHTML = `<span class="sphere-nori-art">${Core.renderSVG(companion, { stage: stage.index })}</span><span class="sphere-nori-name">${name}</span>`;
    wrap.appendChild(orbit);

    const walkerButton = host.querySelector(".spark-presence-button");
    let orbiting = false;
    let rafId = null;
    let angle = Math.random() * Math.PI * 2;
    let lastTs = 0;
    const PERIOD_MS = 42000; // one unhurried circuit of the Sphere

    const bubbleOpen = () => !bubble.hasAttribute("hidden");
    let stageVisible = true;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((entries) => {
        stageVisible = entries.some((e) => e.isIntersecting);
      }, { threshold: 0.15 }).observe(container);
    }

    function setOrbiting(on) {
      if (on === orbiting) return;
      orbiting = on;
      document.documentElement.classList.toggle("sphere-nori-orbiting", on);
      orbit.hidden = !on;
      if (on) {
        lastTs = 0;
        rafId = window.requestAnimationFrame(tick);
      } else if (rafId != null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    function tick(ts) {
      if (!orbiting) return;
      rafId = window.requestAnimationFrame(tick);
      if (document.hidden || !stageVisible || bubbleOpen()) {
        if (bubbleOpen()) setOrbiting(false);
        return;
      }
      if (lastTs) angle += ((ts - lastTs) / PERIOD_MS) * Math.PI * 2;
      lastTs = ts;
      const c = container.getBoundingClientRect();
      const w = wrap.getBoundingClientRect();
      if (c.width === 0) return;
      const cx = c.left - w.left + c.width / 2;
      const cy = c.top - w.top + c.height / 2;
      const rx = c.width / 2 + 30;
      const ry = c.height / 2 + 26;
      const x = cx + Math.cos(angle) * rx;
      const y = cy + Math.sin(angle) * ry;
      const depth = (Math.sin(angle) + 1) / 2; // 0 = far side, 1 = near side
      orbit.style.transform = `translate(-50%, -50%) translate(${Math.round(x)}px, ${Math.round(y)}px) scale(${(0.78 + depth * 0.3).toFixed(3)})`;
      orbit.style.zIndex = depth > 0.5 ? "34" : "6";
      orbit.style.opacity = (0.72 + depth * 0.28).toFixed(3);
    }

    orbit.addEventListener("click", () => {
      setOrbiting(false);
      if (walkerButton) walkerButton.click();
    });
    orbit.addEventListener("mouseenter", () => { lastTs = 0; });
    new MutationObserver(() => {
      if (!bubbleOpen() && !orbiting) {
        window.setTimeout(() => { if (!bubbleOpen()) setOrbiting(true); }, 2500);
      }
    }).observe(bubble, { attributes: true, attributeFilter: ["hidden"] });

    setOrbiting(true);
  }

  whenPresenceReady(30);
})();
