(() => {
  "use strict";

  // Living Time Sphere — Today card module.
  // Shared between the 13 Moons page (Today tab) and the homepage.
  //
  // PURPOSE
  //   Renders a compact, always-visible "Today" state from the canonical
  //   Sphere, Alignment, and Equinox models. Does NOT perform its own
  //   calendar, Equinox, lunar, or Passage calculations.
  //
  // USAGE
  //   LivingTimeSphereTodayCard.render(containerEl, opts)
  //   LivingTimeSphereTodayCard.buildLink(opts)
  //
  // DEPENDENCIES (loaded before this module; gracefully absent = no-op)
  //   LivingTimeSphereModel, LivingTimeSphereLayout, LivingTimeSphereRendererSvg,
  //   AlignmentLedgerData, EquinoxPassageEngine, LivingTimeSphereVersion

  const MODULE = "LivingTimeSphereTodayCard";

  function _hasDeps() {
    return !!(globalThis.LivingTimeSphereModel &&
              globalThis.LivingTimeSphereLayout &&
              globalThis.LivingTimeSphereRendererSvg &&
              globalThis.AlignmentLedgerData);
  }

  // ── Canonical data fetch ──────────────────────────────────────────
  // All values come from existing engines; no independent calculation.

  function _getData(opts) {
    const { timeZone, boundaryMode, manualSunset, asOf } = opts || {};
    const now  = asOf ? new Date(asOf) : new Date();
    const tz   = timeZone     || "America/Los_Angeles";
    const bm   = boundaryMode || "sunset";
    const ss   = manualSunset || "18:00";
    const year = now.getUTCFullYear();

    const supported = globalThis.AlignmentLedgerData.listSupportedYears();
    const selectedYear = supported.includes(year) ? year : supported[supported.length - 1];

    // Sphere model — today view uses PatternCalendar.fromCivilDate internally.
    const todayModel = globalThis.LivingTimeSphereModel.buildTodayModel({
      timeZone: tz, boundaryMode: bm, manualSunset: ss, asOf: now
    });

    // TODAY position: use the canonical result stored on todayModel if available,
    // otherwise call PatternCalendar directly. Never use the Equinox year record's
    // patternPosition here — that carries the Equinox-moment position, not today's.
    let pos = {};
    if (todayModel.todayPatternPosition) {
      const tp = todayModel.todayPatternPosition;
      pos = {
        moon:            tp.moon,
        moonName:        tp.moonName,
        day:             tp.day,
        dayOfPatternYear: tp.dayOfPatternYear,
        weekGate:        tp.dayArchetype || null,
        isDayOutOfTime:  tp.isDayOutOfTime,
        isDeepTimeDay:   tp.isDeepTimeDay,
        civilDate:       tp.civilDate,
        effectiveDate:   tp.effectiveDate,
        afterBoundary:   tp.afterBoundary,
        sunsetTime:      tp.sunsetTime,
        patternYear:     tp.patternYear,
      };
    } else if (globalThis.PatternCalendar) {
      try {
        const tp = globalThis.PatternCalendar.fromCivilDate({ date: now, timeZone: tz, boundaryMode: bm, sunsetTime: ss });
        pos = {
          moon:            tp.moon,
          moonName:        tp.moonName,
          day:             tp.day,
          dayOfPatternYear: tp.dayOfPatternYear,
          weekGate:        tp.dayArchetype || null,
          isDayOutOfTime:  tp.isDayOutOfTime,
          isDeepTimeDay:   tp.isDeepTimeDay,
          civilDate:       tp.civilDate,
          effectiveDate:   tp.effectiveDate,
          afterBoundary:   tp.afterBoundary,
          sunsetTime:      tp.sunsetTime,
          patternYear:     tp.patternYear,
        };
      } catch (_) { /* leave empty */ }
    }

    // Alignment record for auxiliary fields (lunar, passage offsets).
    const record = globalThis.AlignmentLedgerData.getRecord({ year: selectedYear, timeZone: tz, boundaryMode: bm, manualSunset: ss });
    const lunar  = record?.equinox?.lunarLayer || {};
    const offs   = record?.offsets             || {};

    // Passage status from EquinoxPassageEngine if available
    let passageStatus = null;
    if (globalThis.EquinoxPassageEngine) {
      try {
        const pr = globalThis.EquinoxPassageEngine.buildRecord({
          selectedYear,
          timeZone:     tz,
          boundaryMode: bm,
          manualSunset: ss,
          asOf:         now
        });
        const norm = pr?.canonicalRecord?.normalizedValues || pr?.normalizedValues || {};
        passageStatus = {
          active:    norm.isInPassage          ?? false,
          elapsed:   norm.passageElapsedDays   ?? null,
          remaining: norm.passageRemainingDays ?? null,
          totalDays: offs.equinoxToYearGateDays ?? 0,
          progress:  norm.passageProgress      ?? null,
        };
      } catch (_) { /* leave null */ }
    }

    return {
      year:         selectedYear,
      todayModel,
      record,
      pos,
      lunar,
      offs,
      passageStatus,
      now,
      timeZone:     tz,
      boundaryMode: bm,
      sunsetTime:   ss,
    };
  }

  // ── Text summary builder ──────────────────────────────────────────

  function buildTextSummary(data) {
    const { year, pos, lunar, offs, passageStatus, timeZone, boundaryMode, sunsetTime } = data;
    const lines = [
      `Year: ${year}`,
      pos.civilDate     ? `Civil date: ${pos.civilDate}`       : null,
      pos.effectiveDate ? `Effective date: ${pos.effectiveDate}` : null,
      timeZone     ? `Timezone: ${timeZone}`                   : null,
      boundaryMode ? `Boundary: ${boundaryMode}${boundaryMode === "manual" || boundaryMode === "sunset" ? ` · ${sunsetTime || "18:00"}` : ""}` : null,
      `Pattern position: ${pos.moon != null ? `Moon ${pos.moon} · Day ${pos.day} · Day ${pos.dayOfPatternYear}/364` : "Outside count"}`,
      pos.moonName ? `Moon name: ${pos.moonName}` : null,
      pos.weekGate ? `Week Gate: ${Array.isArray(pos.weekGate) ? pos.weekGate[0] : pos.weekGate}` : null,
      `Lunar phase: ${lunar.phaseName || "—"}`,
      `Equinox Passage: ${Number(((offs.equinoxToYearGateDays || 0) * 24).toFixed(1))} h`,
      passageStatus?.active ? `Passage active — ${passageStatus.elapsed != null ? Number((passageStatus.elapsed * 24).toFixed(1)) + " h elapsed" : ""}` : null,
    ];
    return lines.filter(Boolean).join("\n");
  }

  // ── Link builder ──────────────────────────────────────────────────

  function buildLink(opts) {
    const { year, timeZone, boundaryMode, manualSunset, source } = opts || {};
    let base;
    try {
      const loc = typeof location !== "undefined" ? location : null;
      const origin = loc ? loc.origin : "https://codexofreality.org";
      const basePath = loc?.pathname?.includes("/scroll-of-fire/") ? "/scroll-of-fire/" : "/";
      base = origin + basePath + "living-time-sphere.html";
    } catch {
      base = "https://codexofreality.org/living-time-sphere.html";
    }

    let url;
    try { url = new URL(base); } catch { url = new URL("https://codexofreality.org/living-time-sphere.html"); }

    if (year)         url.searchParams.set("year",     String(year));
    if (timeZone)     url.searchParams.set("tz",       timeZone);
    if (boundaryMode) url.searchParams.set("boundary", boundaryMode);
    if (manualSunset) url.searchParams.set("sunset",   manualSunset);
    url.searchParams.set("view",   "today");
    url.searchParams.set("layers", "pattern,passage,lunar,markers");
    if (source)       url.searchParams.set("source",   source);
    if (globalThis.LivingTimeSphereVersion?.version) {
      url.searchParams.set("dataset", globalThis.LivingTimeSphereVersion.version);
    }
    return url.toString();
  }

  // ── SVG preview ───────────────────────────────────────────────────

  function renderPreview(previewEl, data) {
    if (!previewEl) return;
    try {
      const { todayModel, year } = data;
      const spiral = globalThis.LivingTimeSphereModel.buildSpiral({});
      const w = previewEl.clientWidth  || 160;
      const h = previewEl.clientHeight || 160;
      const layout = globalThis.LivingTimeSphereLayout.resolveLayout({
        containerWidth:  Math.max(w, 80),
        containerHeight: Math.max(h, 80),
        devicePixelRatio: typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1
      });
      globalThis.LivingTimeSphereRendererSvg.renderInto(previewEl, {
        model: todayModel,
        spiral,
        layout,
        visibleLayers: { pattern: true, passage: true, lunar: true, solar: false, markers: false, recurrence: false, spiral: false },
        selectedYear: year,
        viewMode: "today"
      });
    } catch (err) {
      previewEl.innerHTML = `<p class="sphere-error" style="font-size:0.75rem;padding:0.5rem">Sphere preview unavailable</p>`;
      console.warn(`${MODULE} preview error:`, err);
    }
  }

  // ── DOM population ────────────────────────────────────────────────
  // Populates named elements within `rootEl` or document.
  // All element IDs are prefixed with `idPrefix`.

  function _setText(rootEl, id, text) {
    const el = rootEl ? rootEl.querySelector(`#${id}`) : document.getElementById(id);
    if (el) el.textContent = text ?? "—";
  }

  function _setHref(rootEl, id, href) {
    const el = rootEl ? rootEl.querySelector(`#${id}`) : document.getElementById(id);
    if (el && href) el.href = href;
  }

  function populateCard(rootEl, idPrefix, data, linkOpts) {
    const p = idPrefix || "";
    const { year, pos, lunar, offs, passageStatus, record, timeZone, boundaryMode, sunsetTime } = data;

    _setText(rootEl, `${p}sphere-today-year`,        String(year));
    _setText(rootEl, `${p}sphere-today-moon`,        pos.moon  != null ? `Moon ${pos.moon}` : "—");
    _setText(rootEl, `${p}sphere-today-moon-name`,   pos.moonName || "—");
    _setText(rootEl, `${p}sphere-today-moon-day`,    pos.day   != null ? String(pos.day)    : "—");
    _setText(rootEl, `${p}sphere-today-day-of-year`, pos.dayOfPatternYear != null ? `Day ${pos.dayOfPatternYear} of 364` : "—");
    _setText(rootEl, `${p}sphere-today-week-gate`,   Array.isArray(pos.weekGate) ? pos.weekGate[0] : (pos.weekGate || "—"));
    _setText(rootEl, `${p}sphere-today-lunar`,       lunar.phaseName || "—");
    _setText(rootEl, `${p}sphere-today-boundary`,    boundaryMode || record?.boundary || "—");

    const passageHours = Number(((offs.equinoxToYearGateDays || 0) * 24).toFixed(1));
    let passageText = `${passageHours} h passage`;
    if (passageStatus?.active) {
      const elapsedH = passageStatus.elapsed != null ? Number((passageStatus.elapsed * 24).toFixed(1)) : null;
      passageText = `Active — ${elapsedH != null ? elapsedH + " h elapsed" : "in progress"}`;
    } else if (passageStatus?.active === false) {
      passageText += " — not in passage";
    }
    _setText(rootEl, `${p}sphere-today-passage`, passageText);

    // Short orientation sentence
    const orient = pos.moon != null
      ? `Moon ${pos.moon}, Day ${pos.day} · ${lunar.phaseName || "lunar cycle"}.`
      : "Pattern position outside counted year.";
    _setText(rootEl, `${p}sphere-today-orientation`, orient);

    // Accessible full text
    const acc = buildTextSummary(data);
    const accEl = rootEl ? rootEl.querySelector(`#${p}sphere-today-accessible`) : document.getElementById(`${p}sphere-today-accessible`);
    if (accEl) accEl.textContent = acc;

    // Link
    const href = buildLink({ ...linkOpts, year, timeZone, boundaryMode, manualSunset: sunsetTime });
    _setHref(rootEl, `${p}sphere-today-open-link`, href);

    // Preview SVG
    const previewEl = rootEl
      ? rootEl.querySelector(`#${p}sphere-today-preview`)
      : document.getElementById(`${p}sphere-today-preview`);
    renderPreview(previewEl, data);
  }

  // ── Main render entry point ────────────────────────────────────────

  function render(rootEl, opts) {
    if (!_hasDeps()) return false;
    try {
      const data = _getData(opts);
      populateCard(rootEl, opts?.idPrefix || "", data, opts);
      return true;
    } catch (err) {
      console.warn(`${MODULE} render error:`, err);
      return false;
    }
  }

  // ── Auto-update wiring ────────────────────────────────────────────
  // Watches for custom events dispatched by the date/timezone controls.
  // Events: 'moons:state-change', 'sphere:settings-change'

  function attachAutoUpdate(rootEl, opts) {
    if (typeof document === "undefined") return;
    const handler = (e) => {
      const detail = e?.detail || {};
      render(rootEl, Object.assign({}, opts, {
        timeZone:     detail.timeZone     || opts?.timeZone,
        boundaryMode: detail.boundaryMode || opts?.boundaryMode,
        manualSunset: detail.manualSunset || opts?.manualSunset,
        asOf:         detail.asOf         || opts?.asOf,
      }));
    };
    document.addEventListener("moons:state-change", handler);
    document.addEventListener("sphere:settings-change", handler);
    return () => {
      document.removeEventListener("moons:state-change", handler);
      document.removeEventListener("sphere:settings-change", handler);
    };
  }

  // ── Lazy initialization via IntersectionObserver ──────────────────
  // For the homepage: only initializes when the section enters the viewport.
  // Does NOT load the 3D engine; uses SVG preview only.

  function lazyInit(rootEl, opts) {
    if (!rootEl) return;
    if (!("IntersectionObserver" in window)) {
      // Fallback: init immediately
      if (document.readyState !== "loading") {
        render(rootEl, opts);
        attachAutoUpdate(rootEl, opts);
      } else {
        document.addEventListener("DOMContentLoaded", () => {
          render(rootEl, opts);
          attachAutoUpdate(rootEl, opts);
        });
      }
      return;
    }

    let initialized = false;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !initialized) {
        initialized = true;
        io.disconnect();
        // Small defer to avoid blocking the main thread during scroll
        requestAnimationFrame(() => {
          if (_hasDeps()) {
            render(rootEl, opts);
            attachAutoUpdate(rootEl, opts);
          } else {
            // Deps may still be loading (deferred scripts); wait for them
            const wait = setInterval(() => {
              if (_hasDeps()) {
                clearInterval(wait);
                render(rootEl, opts);
                attachAutoUpdate(rootEl, opts);
              }
            }, 200);
            setTimeout(() => clearInterval(wait), 5000);
          }
        });
      }
    }, { threshold: 0.1 });
    io.observe(rootEl);
  }

  globalThis.LivingTimeSphereTodayCard = Object.freeze({
    render,
    buildLink,
    buildTextSummary,
    lazyInit,
    attachAutoUpdate,
  });
})();
