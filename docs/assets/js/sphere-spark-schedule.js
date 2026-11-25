/**
 * sphere-spark-schedule.js — holographic schedule beacons, the
 * timeline rail, and the Spark's hands on the Sphere.
 *
 * Written Nov 24, 2026, under Aaron's rulings of the day: things
 * scheduled show VISIBLE on the Sphere; the Spark drives the
 * Sphere by word ("show me…"); one timeline serves keeper and
 * Spark alike. Research: sphere-markers-research-2026-11-24.md.
 * Design: spark-scheduling-design-2026-11-24.md.
 *
 * This module lives in the companion/projection layer, exactly
 * where the Spark inhabitant lives, and under the same law:
 * - It reads the ONE planner record (CodexLivingPlanner) and the
 *   label layer's published projection; it keeps no store of its
 *   own. Beacons are a projection of record lines — a record
 *   removed removes its beacon, because the model is rebuilt
 *   from the record on every change.
 * - It touches no protected file and reaches inside nothing: the
 *   view commands (SphereSparkControl) drive the instrument
 *   through its public surface only — the canonical cursor, the
 *   companion layer's own trips, the instrument's public buttons.
 * - Performance is the audit's law (Nov 24): label elements are
 *   cached and rebuilt only when the label container's children
 *   change; rects are read only for days carrying beacons; the
 *   wrap's rect is cached and invalidated by observers, never
 *   re-read per frame; a transform is written only when a beacon
 *   truly moved; the loop sleeps when the page is hidden, the
 *   stage is off-screen, or the Sphere stands frozen.
 */
(function () {
  "use strict";
  if (window.__sphereSparkSchedule) return;
  window.__sphereSparkSchedule = true;

  const GLYPH_FALLBACK = {
    task: "✓", reminder: "⚑", event: "●", practice: "✦", project: "◆",
    meeting: "👥", milestone: "★", travel: "✈", planting: "🌱", growing: "🌱",
    harvest: "🌾", watering: "💧", farming: "🌾", health: "❤", family: "♡",
    home: "⌂", cleaning: "🧹", writing: "✎", creative: "🎨", school: "🎓",
    observation: "◉",
  };
  const glyphFor = (category) =>
    (window.SphereSparkCore && window.SphereSparkCore.SCHEDULE_SYMBOLS || GLYPH_FALLBACK)[category]
    || GLYPH_FALLBACK[category] || "●";
  const core = () => window.SparkScheduleCore || null;
  const planner = () => {
    const p = window.CodexLivingPlanner;
    return p && p.plansForYears ? p : null;
  };

  function todayCivil() {
    try {
      const s = window.PatternCalendar?.fromCivilDate?.({ date: new Date() });
      if (s && s.civilDate) return s.civilDate;
    } catch { /* fall through */ }
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function facePatternYear() {
    const c = core();
    const coord = window.SOFCurrentTemporalCoordinate || null;
    if (coord && coord.patternYear != null) return Number(coord.patternYear);
    if (coord && coord.civilDate && c) return c.anchorYearForCivil(coord.civilDate);
    if (c) {
      const stamp = c.stampForCivil(todayCivil());
      return stamp ? stamp.patternYear : null;
    }
    return null;
  }

  /* ── The beacon layer ─────────────────────────────────────── */

  let wrap = null;
  let layer = null;
  let model = { beacons: [], foldedDays: 0, totalDays: 0 };
  let modelYear = null;
  const beaconEls = new Map(); // patternDay -> { el, x, y, scale }
  let labelEls = new Map(); // patternDay -> element
  let wrapRect = null;
  let wrapVisible = true;
  let labelObserver = null;

  function ensureLayer() {
    wrap = document.querySelector(".sphere-canvas-wrap");
    if (!wrap) return false;
    if (!layer || !layer.isConnected) {
      layer = document.createElement("div");
      layer.className = "sphere-spark-beacons";
      layer.setAttribute("aria-hidden", "false");
      wrap.appendChild(layer);
    }
    return true;
  }

  function rebuildLabels() {
    const next = new Map();
    for (const el of document.querySelectorAll('[data-semantic-id^="pattern-day-number-"]')) {
      const m = /pattern-day-number-(\d+)$/.exec(el.getAttribute("data-semantic-id") || "");
      if (m) next.set(Number(m[1]), el);
    }
    labelEls = next;
    // Watch the labels' parent for projection changes — the one
    // honest signal that the projected set moved (the perf pass
    // adopted the same childList discipline for the orbit).
    const any = next.values().next().value;
    if (any && any.parentElement && labelObserver) {
      labelObserver.disconnect();
      labelObserver.observe(any.parentElement, { childList: true });
    }
  }

  function beaconEl(beacon) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `spark-beacon is-${beacon.state}`;
    btn.dataset.patternDay = String(beacon.patternDay);
    const beam = document.createElement("span");
    beam.className = "spark-beacon-beam";
    const diamond = document.createElement("span");
    diamond.className = "spark-beacon-diamond";
    const glyph = document.createElement("span");
    glyph.className = "spark-beacon-glyph";
    glyph.textContent = glyphFor(beacon.leadCategory);
    diamond.appendChild(glyph);
    btn.append(beam, diamond);
    if (beacon.state === "today") {
      const ring = document.createElement("span");
      ring.className = "spark-beacon-ring";
      btn.appendChild(ring);
    }
    if (beacon.count > 1) {
      const badge = document.createElement("span");
      badge.className = "spark-beacon-count";
      badge.textContent = String(beacon.count);
      btn.appendChild(badge);
    }
    const c = core();
    const stamp = c && modelYear != null
      ? c.stampForCivil(c.civilDateForPatternDay(modelYear, beacon.patternDay)) : null;
    btn.setAttribute("aria-label",
      `${beacon.count} thing${beacon.count === 1 ? "" : "s"} scheduled${stamp ? ` on ${c.dayWords(stamp)}` : ""} (${beacon.state}) — select the day`);
    btn.addEventListener("click", () => {
      const cc = core();
      if (!cc || modelYear == null) return;
      const civil = cc.civilDateForPatternDay(modelYear, beacon.patternDay);
      if (civil && window.SphereSparkControl) window.SphereSparkControl.goCivil(civil);
    });
    return btn;
  }

  function renderBeacons() {
    if (!ensureLayer()) return;
    const wanted = new Set(model.beacons.map((b) => b.patternDay));
    for (const [pd, rec] of [...beaconEls.entries()]) {
      if (!wanted.has(pd)) { rec.el.remove(); beaconEls.delete(pd); }
    }
    for (const beacon of model.beacons) {
      const existing = beaconEls.get(beacon.patternDay);
      if (existing) {
        // State or count may have turned since the last model.
        const fresh = beaconEl(beacon);
        if (fresh.className !== existing.el.className
          || fresh.getAttribute("aria-label") !== existing.el.getAttribute("aria-label")) {
          fresh.style.transform = existing.el.style.transform;
          existing.el.replaceWith(fresh);
          beaconEls.set(beacon.patternDay, { el: fresh, x: existing.x, y: existing.y, scale: existing.scale });
        }
      } else {
        const el = beaconEl(beacon);
        layer.appendChild(el);
        beaconEls.set(beacon.patternDay, { el, x: null, y: null, scale: null });
      }
    }
    updateFoldNote();
  }

  let foldNote = null;
  function updateFoldNote() {
    const host = document.querySelector(".sphere-schedule-navigator");
    if (!host) return;
    if (!foldNote || !foldNote.isConnected) {
      foldNote = document.createElement("small");
      foldNote.className = "sphere-spark-beacons-note";
      host.appendChild(foldNote);
    }
    foldNote.textContent = model.foldedDays > 0
      ? `…and ${model.foldedDays} more marked day${model.foldedDays === 1 ? "" : "s"} beyond this view — the timeline holds them all.`
      : "";
    foldNote.hidden = model.foldedDays <= 0;
  }

  function measureWrap() {
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    wrapRect = r && r.width ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
  }

  function positionBeacons() {
    if (!wrapRect) measureWrap();
    if (!wrapRect) return;
    for (const [pd, rec] of beaconEls) {
      const label = labelEls.get(pd);
      if (!label || !label.isConnected) {
        if (rec.x !== null) { rec.el.style.display = "none"; rec.x = null; }
        continue;
      }
      const r = label.getBoundingClientRect();
      if (!r.width) { if (rec.x !== null) { rec.el.style.display = "none"; rec.x = null; } continue; }
      const x = Math.round(r.left + r.width / 2 - wrapRect.left);
      const y = Math.round(r.top - wrapRect.top);
      const scale = Math.round(Math.min(1.25, Math.max(0.8, r.width / 64)) * 100) / 100;
      if (rec.x !== null && Math.abs(x - rec.x) < 1 && Math.abs(y - rec.y) < 1 && scale === rec.scale) continue;
      rec.x = x; rec.y = y; rec.scale = scale;
      rec.el.style.display = "";
      rec.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%) scale(${scale})`;
    }
  }

  let raf = 0;
  function loop() {
    raf = requestAnimationFrame(loop);
    if (document.hidden || !wrapVisible) return;
    if (window.SphereRebuild?.isFrozen?.()) return;
    positionBeacons();
  }

  /* ── The timeline rail ────────────────────────────────────── */

  let rail = null;
  let railOpen = false;
  function ensureRail() {
    const host = document.querySelector(".sphere-schedule-navigator");
    if (!host) return false;
    if (rail && rail.isConnected) return true;
    const actions = host.querySelector(".sphere-schedule-nav-actions");
    if (actions && !actions.querySelector(".sphere-spark-timeline-toggle")) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "sphere-spark-timeline-toggle";
      toggle.textContent = "Timeline";
      toggle.setAttribute("aria-expanded", "false");
      toggle.addEventListener("click", () => {
        railOpen = !railOpen;
        toggle.setAttribute("aria-expanded", String(railOpen));
        if (rail) rail.hidden = !railOpen;
        if (railOpen) renderTimeline();
      });
      actions.appendChild(toggle);
    }
    rail = document.createElement("div");
    rail.className = "sphere-spark-timeline";
    rail.hidden = true;
    rail.setAttribute("aria-label", "Your timeline — the next fourteen days");
    host.appendChild(rail);
    return true;
  }

  let railTimeline = [];
  async function refreshTimelineData() {
    const c = core();
    const p = planner();
    if (!c || !p) return;
    try {
      const plans = p.allPlans ? await p.allPlans()
        : await p.plansForYears([c.anchorYearForCivil(todayCivil()) - 1, c.anchorYearForCivil(todayCivil()), c.anchorYearForCivil(todayCivil()) + 1]);
      railTimeline = c.buildTimeline(plans || [], todayCivil());
    } catch { /* the rail keeps its last honest read */ }
  }

  function renderTimeline() {
    if (!ensureRail() || !rail) return;
    const c = core();
    if (!c) return;
    const today = todayCivil();
    rail.replaceChildren();
    const overdue = railTimeline.filter((e) => e.state === "overdue");
    if (overdue.length) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "sphere-spark-tick is-overdue-chip";
      chip.innerHTML = `<strong>${overdue.length} overdue</strong><small>oldest first</small>`;
      chip.addEventListener("click", () => {
        if (window.SphereSparkControl) window.SphereSparkControl.goCivil(overdue[0].civilDate);
      });
      rail.appendChild(chip);
    }
    for (let i = 0; i < 14; i += 1) {
      const date = c.addDays(today, i);
      const entries = railTimeline.filter((e) => e.civilDate === date);
      const tick = document.createElement("button");
      tick.type = "button";
      const worst = entries.length
        ? entries.reduce((acc, e) => (c.STATE_PRIORITY[e.state] < c.STATE_PRIORITY[acc] ? e.state : acc), entries[0].state)
        : null;
      tick.className = `sphere-spark-tick${i === 0 ? " is-today" : ""}`;
      const stamp = c.stampForCivil(date);
      tick.innerHTML = `<small>${c.civilWords(date).split(",")[0].slice(0, 3)} ${date.slice(8)}</small>`
        + `<span class="sphere-spark-tick-dot${worst ? ` is-${worst}` : ""}"></span>`
        + `<small>${stamp ? `M${stamp.moon} · D${stamp.day}` : "Out of Time"}</small>`
        + (entries.length ? `<strong>${entries.length}</strong>` : `<small>open</small>`);
      tick.setAttribute("aria-label",
        `${c.restateDay(stamp)}: ${entries.length ? entries.map((e) => e.title).join("; ") : "nothing scheduled"} — select the day`);
      tick.addEventListener("click", () => {
        if (window.SphereSparkControl) window.SphereSparkControl.goCivil(date);
      });
      rail.appendChild(tick);
    }
  }

  /* ── The model: rebuilt from the record, never kept ───────── */

  let refreshing = false;
  async function refresh() {
    const c = core();
    const p = planner();
    if (!c || !p || refreshing) return;
    refreshing = true;
    try {
      const year = facePatternYear();
      if (year != null) {
        const plans = await p.plansForYears([year]);
        model = c.markerModel(plans || [], year, todayCivil());
        modelYear = year;
        renderBeacons();
      }
      await refreshTimelineData();
      if (railOpen) renderTimeline();
    } catch { /* the last honest model stands */ }
    refreshing = false;
  }

  /* ── SphereSparkControl: the public surface, driven ───────── */

  const clickEl = (el) => { if (el) { el.click(); return true; } return false; };
  const clickId = (id) => clickEl(document.getElementById(id));

  window.SphereSparkControl = {
    goCivil(iso) {
      try {
        if (window.SOFTemporalCursor?.setDate) { window.SOFTemporalCursor.setDate(iso); return true; }
      } catch { /* fall through to the rebuild's own road */ }
      const c = core();
      const stamp = c ? c.stampForCivil(iso) : null;
      if (stamp && window.SphereRebuild?.showDay) {
        window.SphereRebuild.showDay({ moon: stamp.moon, day: stamp.day, patternDay: stamp.patternDay, civilDate: iso });
        return true;
      }
      return false;
    },
    goToday() {
      return clickId("sphere-everyday-today")
        || clickEl(document.querySelector('[data-app-action="today"]'))
        || clickId("calendar-return-today")
        || this.goCivil(todayCivil());
    },
    goMoon(moon) {
      const monthSel = document.getElementById("calendar-jump-month");
      const daySel = document.getElementById("calendar-jump-day");
      if (monthSel && daySel) {
        monthSel.value = String(moon);
        daySel.value = "1";
        if (clickId("calendar-jump-pattern")) return true;
      }
      const c = core();
      if (!c) return false;
      const year = facePatternYear();
      const civil = c.civilDateForPatternDay(year, (moon - 1) * 28 + 1);
      return civil ? this.goCivil(civil) : false;
    },
    goYear() {
      return clickId("sphere-mode-pattern") || clickId("sphere-cam-reset");
    },
    setLayer(slot, on) {
      if (slot === "farm") {
        if (on && window.SphereRebuild?.openFarm) { window.SphereRebuild.openFarm(); return true; }
        return false;
      }
      const el = document.getElementById(`sphere-layer-${slot}`);
      if (!el) return false;
      const isOn = el.type === "checkbox" ? el.checked
        : el.getAttribute("aria-pressed") === "true" || el.classList.contains("is-on") || el.classList.contains("active");
      if (isOn === Boolean(on)) return true; // already as asked — the word is honoured
      el.click();
      return true;
    },
  };

  /* ── Boot ─────────────────────────────────────────────────── */

  function boot() {
    if (!ensureLayer()) return;
    ensureRail();
    rebuildLabels();
    measureWrap();
    if ("ResizeObserver" in window) new ResizeObserver(() => { measureWrap(); }).observe(wrap);
    window.addEventListener("resize", measureWrap);
    window.addEventListener("scroll", measureWrap, { passive: true, capture: true });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((entries) => { wrapVisible = entries[0]?.isIntersecting !== false; }, { threshold: 0.02 }).observe(wrap);
    }
    if ("MutationObserver" in window) {
      labelObserver = new MutationObserver(() => rebuildLabels());
      const any = labelEls.values().next().value;
      if (any && any.parentElement) labelObserver.observe(any.parentElement, { childList: true });
    }
    refresh();
    loop();
  }

  let tries = 0;
  const bootTimer = window.setInterval(() => {
    tries += 1;
    if (core() && planner() && document.querySelector(".sphere-canvas-wrap")) {
      window.clearInterval(bootTimer);
      boot();
    } else if (tries > 50) {
      window.clearInterval(bootTimer);
      boot(); // stand the layer anyway; refresh() stays honest about what it lacks
    }
  }, 200);

  for (const evt of ["sof:life-atlas-records-changed", "sof:selected-date-change", "sof:sphere-deferred-tools-ready"]) {
    window.addEventListener(evt, () => { rebuildLabels(); refresh(); });
    document.addEventListener(evt, () => { rebuildLabels(); refresh(); });
  }
})();
