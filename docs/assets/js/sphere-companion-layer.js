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
    const names = globalThis.PatternCalendar?.moonNames;
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
      <button type="button" class="sgb-btn sgb-fs" data-sgb="fs" hidden>⛶ Full screen</button>
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

  bar.addEventListener("click", (event) => {
    const btn = event.target.closest?.("[data-sgb]");
    if (!btn) return;
    const action = btn.dataset.sgb;
    if (action === "today" && goToday()) announce("Back to today");
    else if (action === "moon-go" && goMoon(Number(moonSelect.value))) {
      announce(`To Moon ${moonSelect.value}, ${moonNames[Number(moonSelect.value) - 1]}`);
    } else if (action === "day" && openSelectedDay()) announce("Your selected day, open");
    else if (action === "year" && goWholeYear()) announce("The whole year");
    else if (action === "fs") toggleFullscreen();
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
