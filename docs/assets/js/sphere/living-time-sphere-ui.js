(() => {
  "use strict";

  // Living Time Sphere UI — DOM orchestration layer.
  // Wires model, renderers, interaction, accessibility, export, and URL state together.
  // Phase 03: adds 3D renderer (WebGL/Three.js), quality mode, view-renderer selector,
  // and guided introduction.

  let _state = {
    year:          2026,
    viewMode:      "today",
    timeZone:      "America/Los_Angeles",
    boundaryMode:  "sunset",
    manualSunset:  "18:00",
    visibleLayers: { pattern: true, passage: true, lunar: true, solar: true, markers: true, recurrence: false, spiral: true },
    selectedMarker: null,
    useCanvas:     false,
    lowPower:      false,
    // Phase 03 additions
    rendererMode:  "auto",   // "auto" | "3d" | "svg" | "table" | "text"
    quality:       "auto",   // "auto" | "high" | "balanced" | "lowpower" | "svgonly"
    active3d:      false,    // true when 3D renderer is active
    introShown:    false,
    _3dInitInProgress: false, // guard against concurrent 3D init calls
  };

  // ── Dependency check ───────────────────────────────────────────────

  function safeInit() {
    const required = [
      "LivingTimeSphereModel", "LivingTimeSphereLayout",
      "LivingTimeSphereRendererSvg", "LivingTimeSphereInteraction",
      "LivingTimeSphereAccessibility", "LivingTimeSphereUrlState",
      "AlignmentLedgerData"
    ];
    return required.every(d => !!globalThis[d]);
  }

  // ── URL state ──────────────────────────────────────────────────────

  function applyUrlState() {
    if (typeof location === "undefined") return;
    const parsed = globalThis.LivingTimeSphereUrlState.parseSphereUrl(location.href);
    if (parsed.year)         _state.year         = parsed.year;
    if (parsed.viewMode)     _state.viewMode     = parsed.viewMode;
    if (parsed.timeZone)     _state.timeZone     = parsed.timeZone;
    if (parsed.boundaryMode) _state.boundaryMode = parsed.boundaryMode;
    if (parsed.manualSunset) _state.manualSunset = parsed.manualSunset;
    if (parsed.marker)       _state.selectedMarker = parsed.marker;
    if (parsed.renderer)     _state.rendererMode = parsed.renderer;
    if (parsed.quality)      _state.quality      = parsed.quality;
    if (parsed.layers) {
      for (const k of Object.keys(_state.visibleLayers)) _state.visibleLayers[k] = false;
      for (const l of parsed.layers) _state.visibleLayers[l] = true;
    }
    // Restore camera from URL (validated in url-state module)
    if ((parsed.cameraTheta != null || parsed.cameraDist != null) &&
        globalThis.LivingTimeSphereCamera) {
      globalThis.LivingTimeSphereCamera.setState({
        theta: parsed.cameraTheta,
        dist:  parsed.cameraDist
      });
    }
  }

  // ── Quality resolution ─────────────────────────────────────────────

  function resolveQualityPreset() {
    const mat = globalThis.LivingTimeSphereM;
    if (!mat) return null;
    const q = _state.quality;
    if (q === "svgonly" || _state.rendererMode === "svg" ||
        _state.rendererMode === "table" || _state.rendererMode === "text") return null;
    if (q !== "auto" && mat.QUALITY_PRESETS[q]) return mat.QUALITY_PRESETS[q];
    // Auto: detect capabilities
    const reducedMotion = typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const webglAvailable = !!(globalThis.LivingTimeSphereEffects?.detectWebGl?.());
    const mem  = (typeof navigator !== "undefined" && navigator.deviceMemory) || 4;
    const sw   = typeof window !== "undefined" ? window.innerWidth : 1024;
    return mat.resolveAutoPreset({ reducedMotion, deviceMemoryGb: mem, screenWidth: sw, webglAvailable });
  }

  // ── Renderer mode resolution ───────────────────────────────────────

  function shouldUse3d() {
    if (_state.rendererMode === "svg" || _state.rendererMode === "table" || _state.rendererMode === "text") return false;
    if (_state.quality === "svgonly") return false;
    if (!globalThis.LivingTimeSphereRenderer3d || !globalThis.LivingTimeSphereM || !globalThis.LivingTimeSphereEffects) return false;
    if (!globalThis.LivingTimeSphereEffects.detectWebGl()) return false;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches && _state.quality !== "high") return false;
    return _state.rendererMode === "3d" || _state.rendererMode === "auto";
  }

  // ── Container helpers ──────────────────────────────────────────────

  function getContainerSize(container) {
    if (typeof window === "undefined") return { w: 320, h: 320 };
    const rect = container.getBoundingClientRect();
    return { w: Math.max(rect.width  || 320, 100), h: Math.max(rect.height || 320, 100) };
  }

  function buildCurrentModel() {
    const opts = { year: _state.year, timeZone: _state.timeZone, boundaryMode: _state.boundaryMode, manualSunset: _state.manualSunset };
    if (_state.viewMode === "today") return globalThis.LivingTimeSphereModel.buildTodayModel(opts);
    return globalThis.LivingTimeSphereModel.buildYearModel(opts);
  }

  // ── Render dispatch ────────────────────────────────────────────────

  function renderSphere(container) {
    if (!container) return;

    // Show/hide data table and text summary views
    _updateAlternateViews();

    if (_state.rendererMode === "table" || _state.rendererMode === "text") {
      // Hide 3D / SVG canvas; show alternate view
      _teardown3d();
      container.style.display = "none";
      _updateRendererLabel(_state.rendererMode === "table" ? "Data Table" : "Text Summary");
      return;
    }
    container.style.display = "";

    const { w, h } = getContainerSize(container);
    const dpr      = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
    const layout   = globalThis.LivingTimeSphereLayout.resolveLayout({ containerWidth: w, containerHeight: h, devicePixelRatio: dpr });
    const model    = buildCurrentModel();
    const spiral   = globalThis.LivingTimeSphereModel.buildSpiral({ timeZone: _state.timeZone, boundaryMode: _state.boundaryMode, manualSunset: _state.manualSunset });

    if (shouldUse3d()) {
      _render3d(container, model, spiral);
    } else {
      _teardown3d();
      _renderSvgFallback(container, model, spiral, layout);
    }

    updateAccessibleText(model, spiral);
    updateDetails(model);
    _updateTodayDiagnostics(model);
  }

  async function _render3d(container, model, spiral) {
    const preset = resolveQualityPreset();
    if (!preset) { _teardown3d(); return; }

    const renderer = globalThis.LivingTimeSphereRenderer3d;

    if (!renderer.isInitialized()) {
      // Prevent concurrent init: if one is already in progress (either in this module
      // or inside the renderer itself), skip and leave the in-progress call to finish.
      if (_state._3dInitInProgress || renderer.isInitializing?.()) return;
      _state._3dInitInProgress = true;

      // Remove any existing SVG / canvas content before inserting 3D canvas.
      container.innerHTML = "";
      _updateRendererLabel("Loading 3D renderer…");

      const reducedMotion = typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

      let result;
      try {
        result = await renderer.init({
          container,
          model,
          spiral,
          quality:       preset,
          selectedYear:  _state.year,
          visibleLayers: _state.visibleLayers,
          viewMode:      _state.viewMode,
          reducedMotion,
          onYearSelect: year => {
            _state.year = year;
            _state.viewMode = "passage";
            _syncYearSelect(year);
            globalThis.LivingTimeSphereAccessibility?.announce?.(`Year ${year} selected. Passage view.`);
            renderSphere(container);
          },
          onMarkerSelect: marker => {
            _state.selectedMarker = marker?.type === "year" ? `eq-${marker.year}` : null;
          }
        });
      } catch (err) {
        result = { success: false, reason: "init-exception", detail: String(err) };
      } finally {
        _state._3dInitInProgress = false;
      }

      if (!result || !result.success) {
        // Fall back to SVG.
        _state.active3d = false;
        const reason = result?.reason || "WebGL unavailable";
        const detail = result?.detail ? ` (${result.detail})` : "";
        const statusText = `SVG fallback — ${reason}${detail}`;
        _updateRendererLabel(statusText);
        // Sync the renderer selector so it accurately reflects the active renderer.
        _syncRendererSelect("svg");
        // Show the fallback warning row with Retry button.
        _showRendererFallbackWarning(reason, detail);
        // Remove any stale canvas element left by a failed init.
        const staleCanvas = container.querySelector(".living-time-sphere-3d-canvas");
        if (staleCanvas) staleCanvas.remove();
        const layout = globalThis.LivingTimeSphereLayout.resolveLayout({
          containerWidth:  container.offsetWidth  || 320,
          containerHeight: container.offsetHeight || 320,
          devicePixelRatio: (typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1)
        });
        _renderSvgFallback(container, model, spiral, layout);
        _updateInteractBar();
        _updateTodayDiagnostics(model);
        return;
      }
      _state.active3d = true;
      _updateRendererLabel("WebGL 3D active");
      _hideRendererFallbackWarning();
      _updateInteractBar();
      _updateRendererDiagnostics();
    } else {
      renderer.refresh(model, spiral, _state.year, _state.visibleLayers, _state.viewMode);
      renderer.setMode(_state.viewMode);
    }
  }

  function _teardown3d() {
    if (_state.active3d && globalThis.LivingTimeSphereRenderer3d?.isInitialized?.()) {
      globalThis.LivingTimeSphereRenderer3d.teardown();
    }
    _state.active3d = false;
    _state._3dInitInProgress = false;
    _updateInteractBar();
  }

  function _renderSvgFallback(container, model, spiral, layout) {
    // Canvas fallback
    if (_state.useCanvas && globalThis.LivingTimeSphereRendererCanvas?.isCanvasSupported?.()) {
      let canvas = container.querySelector(".living-time-sphere-canvas");
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.className = "living-time-sphere-canvas";
        container.innerHTML = "";
        container.appendChild(canvas);
      }
      const ok = globalThis.LivingTimeSphereRendererCanvas.renderCanvas({ canvas, model, spiral, layout, visibleLayers: _state.visibleLayers, selectedYear: _state.year });
      if (ok) { _updateRendererLabel("Canvas fallback"); }
      else _renderSvgOnly(container, model, spiral, layout);
    } else {
      _renderSvgOnly(container, model, spiral, layout);
    }
  }

  function _renderSvgOnly(container, model, spiral, layout) {
    _updateRendererLabel(_state.rendererMode === "svg" ? "Accessible SVG" : "SVG fallback");
    globalThis.LivingTimeSphereRendererSvg.renderInto(container, {
      model, spiral, layout,
      visibleLayers: _state.visibleLayers,
      selectedYear:  _state.year,
      viewMode:      _state.viewMode
    });
  }

  // Keep the mobile interact bar in sync with the 3D renderer state.
  // The bar (and its "Exit Interaction" button) should only be active when
  // a real 3D canvas is running. In SVG mode it should stay hidden.
  function _updateInteractBar() {
    const bar        = document.querySelector(".sphere-interact-bar");
    const interactBtn = document.getElementById("sphere-interact-btn");
    const endBtn     = document.getElementById("sphere-interact-end-btn");
    if (!bar) return;
    // Show/hide the whole bar based on whether 3D is active.
    bar.style.display = _state.active3d ? "" : "none";
    // Always reset to the "Interact" state when the bar is re-shown.
    if (interactBtn) interactBtn.style.display = "";
    if (endBtn)      endBtn.style.display      = "none";
  }

  function _updateAlternateViews() {
    // Reveal data table section
    const tableSection = document.getElementById("sphere-data-table-section");
    if (tableSection) tableSection.style.display = _state.rendererMode === "table" ? "" : "none";

    // Reveal text summary section
    const textSection  = document.getElementById("sphere-text-summary-section");
    if (textSection)  textSection.style.display  = _state.rendererMode === "text"  ? "" : "none";
  }

  // ── Renderer status label ──────────────────────────────────────────

  function _updateRendererLabel(status) {
    const el = document.getElementById("sphere-renderer-label");
    if (el) el.textContent = status;
  }

  // Sync the renderer <select> to reflect the actual active renderer.
  function _syncRendererSelect(activeRenderer) {
    const sel = document.getElementById("sphere-renderer-select");
    if (sel) sel.value = activeRenderer;
    _state.rendererMode = activeRenderer;
  }

  // Show the fallback warning banner with Retry / Switch-to-SVG buttons.
  function _showRendererFallbackWarning(reason, detail) {
    const el = document.getElementById("sphere-renderer-fallback-warning");
    if (!el) return;
    const reasonEl = el.querySelector(".sphere-fallback-reason");
    if (reasonEl) reasonEl.textContent = `3D unavailable — using SVG (${reason}${detail})`;
    // Populate inline diagnostics inside the collapsible details block.
    const r3d = globalThis.LivingTimeSphereRenderer3d;
    const diag = r3d?.getDiagnostics?.() || {};
    const _set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val || "—"; };
    _set("sphere-diag-local-url-warn",      diag.localModuleUrl || r3d?.THREE_LOCAL_REL || "—");
    _set("sphere-diag-last-error-warn",     diag.lastInitError ? `${diag.lastInitError.reason}: ${diag.lastInitError.detail || ""}` : (detail || "—"));
    _set("sphere-diag-module-source-warn",  diag.moduleSource || "none");
    _set("sphere-diag-webgl-warn",          diag.webglAvailable ? "available" : "unavailable");
    _set("sphere-diag-webgl2-warn",         diag.webgl2Available ? "available" : "unavailable");
    el.hidden = false;
  }

  function _hideRendererFallbackWarning() {
    const el = document.getElementById("sphere-renderer-fallback-warning");
    if (el) el.hidden = true;
  }

  // Update the renderer diagnostics panel (hidden by default; shown in Technical view).
  function _updateRendererDiagnostics() {
    const panel = document.getElementById("sphere-renderer-diagnostics");
    if (!panel) return;
    const r3d = globalThis.LivingTimeSphereRenderer3d;
    if (!r3d) return;
    const diag = r3d.getDiagnostics?.() || {};
    const rows = {
      "sphere-diag-requested":    "3d",
      "sphere-diag-active":       _state.active3d ? "WebGL 3D active" : (_state.rendererMode === "svg" ? "Accessible SVG" : "SVG fallback"),
      "sphere-diag-fallback":     _state.active3d ? "none" : (diag.lastInitError?.reason || "none"),
      "sphere-diag-webgl":        diag.webglAvailable ? "available" : "unavailable",
      "sphere-diag-webgl2":       diag.webgl2Available ? "available" : "unavailable",
      "sphere-diag-lib-version":  diag.threeVersion || r3d.THREE_VERSION || "—",
      "sphere-diag-module-source": diag.moduleSource || "none",
      "sphere-diag-local-url":    diag.localModuleUrl || r3d.THREE_LOCAL_REL || "—",
      "sphere-diag-canvas-size":  diag.canvasWidth && diag.canvasHeight ? `${diag.canvasWidth} × ${diag.canvasHeight}` : "—",
      "sphere-diag-dpr":          String(diag.devicePixelRatio || "—"),
      "sphere-diag-quality":      _state.quality,
      "sphere-diag-last-error":   diag.lastInitError ? `${diag.lastInitError.reason}: ${diag.lastInitError.detail || ""}` : "none",
    };
    for (const [id, val] of Object.entries(rows)) {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    }
  }

  // Update the Today diagnostics panel with the current model's today position.
  function _updateTodayDiagnostics(model) {
    const panel = document.getElementById("sphere-today-diagnostics");
    if (!panel) return;
    const tp = model?.todayPatternPosition;
    const rows = {
      "sphere-diag-today-civil":    tp?.civilDate     || "—",
      "sphere-diag-today-effective": tp?.effectiveDate || "—",
      "sphere-diag-today-tz":       _state.timeZone   || "—",
      "sphere-diag-today-boundary": _state.boundaryMode || "—",
      "sphere-diag-today-sunset":   _state.manualSunset || "—",
      "sphere-diag-today-position": tp?.moon != null
        ? `Moon ${tp.moon} · Day ${tp.day} · Day ${tp.dayOfPatternYear}/364`
        : (tp?.isDayOutOfTime ? "Day Out of Time" : (tp?.isDeepTimeDay ? "Deep Time Day" : "—")),
      "sphere-diag-today-angle":    model?.currentPatternAngle != null ? `${model.currentPatternAngle.toFixed(2)}°` : "—",
      "sphere-diag-today-source":   "PatternCalendar.fromCivilDate",
    };
    for (const [id, val] of Object.entries(rows)) {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    }
  }

  function _syncYearSelect(year) {
    const sel = document.getElementById("sphere-year-select");
    if (sel) sel.value = String(year);
  }

  // ── Accessible text ────────────────────────────────────────────────

  function updateAccessibleText(model, spiral) {
    const acc = globalThis.LivingTimeSphereAccessibility;
    let desc = "";
    if (_state.viewMode === "today")   desc = acc.buildTodayDescription(model);
    else if (_state.viewMode === "passage") desc = acc.buildPassageDescription(model);
    else if (_state.viewMode === "years")   desc = acc.buildSpiralDescription(spiral);
    else                                    desc = acc.buildYearDescription({ model });
    acc.populateTextModel("sphere-text-model", desc);
  }

  function updateDetails(model) {
    const el = document.getElementById("sphere-details");
    if (!el || !model) return;

    // In today mode, show today's actual Pattern position (from PatternCalendar),
    // not the Equinox-moment position from the year record.
    const isToday = _state.viewMode === "today";
    const todayPos = isToday ? (model.todayPatternPosition || null) : null;
    const pos   = todayPos ? {
      moon:            todayPos.moon,
      day:             todayPos.day,
      dayOfPatternYear: todayPos.dayOfPatternYear,
      moonName:        todayPos.moonName,
      isDayOutOfTime:  todayPos.isDayOutOfTime,
    } : (model.sourceRecord?.equinox?.patternPosition || {});
    const lunar = model.sourceRecord?.equinox?.lunarLayer       || {};
    const offs  = model.sourceRecord?.offsets || {};

    const posLabel = pos.moon != null ? `Moon ${pos.moon} · Day ${pos.day}` : "Outside count";
    const dayLabel = pos.dayOfPatternYear != null ? `Day ${pos.dayOfPatternYear}/364` : "—";
    const heading  = isToday && todayPos
      ? `Today — ${posLabel} · ${dayLabel}`
      : `Year ${model.year}`;

    el.innerHTML = `
      <h3 class="sphere-details-heading">${heading}</h3>
      <dl class="sphere-details-grid">
        ${isToday && todayPos ? `<dt>Civil date</dt><dd>${todayPos.civilDate || "—"}</dd>` : ""}
        ${isToday && todayPos ? `<dt>Effective date</dt><dd>${todayPos.effectiveDate || "—"}</dd>` : ""}
        <dt>Pattern position</dt><dd>${posLabel}</dd>
        ${isToday && todayPos && pos.dayOfPatternYear ? `<dt>Day of year</dt><dd>${dayLabel}</dd>` : ""}
        <dt>Passage</dt><dd>${Number(((offs.equinoxToYearGateDays || 0) * 24).toFixed(1))} hours</dd>
        <dt>Lunar phase</dt><dd>${lunar.phaseName || "—"}</dd>
        <dt>Equinox angle</dt><dd>${model.passageStartAngle?.toFixed(1) || "—"}°</dd>
      </dl>`;
  }

  // ── Control wiring ─────────────────────────────────────────────────

  function wireControls(container) {
    // View mode buttons.
    ["today", "passage", "years", "pattern"].forEach(mode => {
      const btn = document.getElementById(`sphere-mode-${mode}`);
      if (!btn) return;
      btn.addEventListener("click", () => {
        _state.viewMode = mode;
        document.querySelectorAll("[id^='sphere-mode-']").forEach(b => b.setAttribute("aria-pressed", "false"));
        btn.setAttribute("aria-pressed", "true");
        if (_state.active3d) globalThis.LivingTimeSphereRenderer3d?.setMode(mode);
        renderSphere(container);
      });
    });

    // Year select.
    const yearSelect = document.getElementById("sphere-year-select");
    if (yearSelect) {
      const years = globalThis.AlignmentLedgerData.listSupportedYears();
      yearSelect.innerHTML = years.map(y => `<option value="${y}"${y === _state.year ? " selected" : ""}>${y}</option>`).join("");
      yearSelect.addEventListener("change", () => {
        const y = Number(yearSelect.value);
        if (y) { _state.year = y; renderSphere(container); }
      });
    }

    // Layer toggles.
    Object.keys(_state.visibleLayers).forEach(layer => {
      const cb = document.getElementById(`sphere-layer-${layer}`);
      if (!cb) return;
      cb.checked = _state.visibleLayers[layer];
      cb.addEventListener("change", () => {
        _state.visibleLayers[layer] = cb.checked;
        renderSphere(container);
      });
    });

    // Reset view.
    const resetBtn = document.getElementById("sphere-reset");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        if (_state.active3d) {
          globalThis.LivingTimeSphereRenderer3d?.resetView();
          globalThis.LivingTimeSphereAnimation?.markDirty?.();
        } else {
          globalThis.LivingTimeSphereInteraction.resetView(container);
          renderSphere(container);
        }
      });
    }

    // Copy link.
    const copyBtn = document.getElementById("sphere-copy-link");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        const camState = globalThis.LivingTimeSphereCamera?.getState?.() || {};
        const link = globalThis.LivingTimeSphereUrlState.buildSphereUrl({
          year:          _state.year,
          viewMode:      _state.viewMode,
          layers:        Object.entries(_state.visibleLayers).filter(([, v]) => v).map(([k]) => k),
          timeZone:      _state.timeZone,
          boundaryMode:  _state.boundaryMode,
          manualSunset:  _state.manualSunset,
          datasetVersion: globalThis.LivingTimeSphereVersion?.version,
          renderer:      _state.active3d ? "3d" : "svg",
          quality:       _state.quality,
          cameraTheta:   camState.theta,
          cameraDist:    camState.dist,
        });
        navigator.clipboard?.writeText(link).catch(() => {});
        copyBtn.textContent = "Link copied";
        setTimeout(() => { copyBtn.textContent = "Copy Link"; }, 2000);
      });
    }

    // Export PNG.
    const pngBtn = document.getElementById("sphere-export-png");
    if (pngBtn && globalThis.LivingTimeSphereExport) {
      pngBtn.addEventListener("click", () => {
        if (_state.active3d && globalThis.LivingTimeSphereRenderer3d?.exportPng) {
          const dataUrl = globalThis.LivingTimeSphereRenderer3d.exportPng({ format: "square" });
          if (dataUrl) {
            const a = document.createElement("a");
            a.href = dataUrl;
            a.download = `living-time-sphere-${_state.year}-3d.png`;
            a.click();
            return;
          }
        }
        globalThis.LivingTimeSphereExport.exportPng({ svgContainer: container, format: "square", year: _state.year, viewMode: _state.viewMode });
      });
    }

    // Renderer selector (3D / SVG / Table / Text)
    const rendererSelect = document.getElementById("sphere-renderer-select");
    if (rendererSelect) {
      rendererSelect.value = _state.rendererMode;
      rendererSelect.addEventListener("change", () => {
        const prev = _state.rendererMode;
        _state.rendererMode = rendererSelect.value || "auto";
        if (prev !== _state.rendererMode && (prev === "3d" || prev === "auto") && _state.active3d) {
          _teardown3d();
        }
        renderSphere(container);
      });
    }

    // Quality selector.
    const qualitySelect = document.getElementById("sphere-quality-select");
    if (qualitySelect) {
      qualitySelect.value = _state.quality;
      qualitySelect.addEventListener("change", () => {
        _state.quality = qualitySelect.value || "auto";
        if (_state.quality === "svgonly" && _state.active3d) {
          _teardown3d();
          renderSphere(container);
          return;
        }
        if (_state.active3d && globalThis.LivingTimeSphereRenderer3d?.isInitialized?.()) {
          const preset = resolveQualityPreset();
          if (preset) {
            globalThis.LivingTimeSphereRenderer3d.setQuality(preset);
          } else {
            _teardown3d();
            renderSphere(container);
          }
        } else {
          renderSphere(container);
        }
      });
    }

    // "Interact with Sphere" button for small screens.
    // Only active in 3D mode — _updateInteractBar() hides the bar in SVG mode.
    const interactBtn = document.getElementById("sphere-interact-btn");
    if (interactBtn) {
      interactBtn.addEventListener("click", () => {
        // Only enter interact mode if the 3D renderer is actually running.
        if (!_state.active3d) return;
        interactBtn.style.display = "none";
        const endBtn = document.getElementById("sphere-interact-end-btn");
        if (endBtn) endBtn.style.display = "";
      });
      const endBtn = document.getElementById("sphere-interact-end-btn");
      if (endBtn) {
        endBtn.style.display = "none";
        endBtn.addEventListener("click", () => {
          endBtn.style.display = "none";
          interactBtn.style.display = "";
          // Dispatch exit event so 3D renderer can re-enable page scroll.
          container.dispatchEvent(new CustomEvent("sphere:interact-end", { bubbles: false }));
        });
      }
      // Listen for interact events from 3D renderer.
      container.addEventListener("sphere:interact-start", () => {
        if (!_state.active3d) return;
        interactBtn.style.display = "none";
        const b = document.getElementById("sphere-interact-end-btn");
        if (b) b.style.display = "";
      });
      container.addEventListener("sphere:interact-end", () => {
        const b = document.getElementById("sphere-interact-end-btn");
        if (b) b.style.display = "none";
        interactBtn.style.display = "";
      });
    }

    // Guided introduction.
    _wireIntro(container);

    // Camera preset buttons.
    ["reset", "focus", "pattern", "passage", "years"].forEach(cmd => {
      const btn = document.getElementById(`sphere-cam-${cmd}`);
      if (!btn) return;
      btn.addEventListener("click", () => {
        if (!_state.active3d) return;
        switch (cmd) {
          case "reset":   globalThis.LivingTimeSphereRenderer3d?.resetView(); break;
          case "pattern": globalThis.LivingTimeSphereRenderer3d?.setMode("pattern"); break;
          case "passage": globalThis.LivingTimeSphereRenderer3d?.setMode("passage"); break;
          case "years":   globalThis.LivingTimeSphereRenderer3d?.setMode("years"); break;
          default: break;
        }
        globalThis.LivingTimeSphereAnimation?.markDirty?.();
      });
    });

    // Sphere year-select events (from marker clicks).
    container.addEventListener("sphere:year-select", e => {
      const y = e.detail?.year;
      if (!y) return;
      _state.year = y;
      _state.viewMode = "passage";
      _syncYearSelect(y);
      globalThis.LivingTimeSphereAccessibility.announce(`Year ${y} selected. Switching to Passage view.`);
      renderSphere(container);
    });

    // ── Retry 3D / Clear cache / Switch to SVG ──────────────────────

    const retry3dBtn = document.getElementById("sphere-retry-3d");
    if (retry3dBtn) {
      retry3dBtn.addEventListener("click", async () => {
        // Dispose any partial state, reset renderer mode, attempt fresh init.
        if (globalThis.LivingTimeSphereRenderer3d?.isInitialized?.()) {
          globalThis.LivingTimeSphereRenderer3d.teardown();
        }
        _state.active3d = false;
        _state._3dInitInProgress = false;
        _state.rendererMode = "3d";
        const sel = document.getElementById("sphere-renderer-select");
        if (sel) sel.value = "3d";
        _updateRendererLabel("Retrying 3D renderer…");
        _hideRendererFallbackWarning();
        renderSphere(container);
      });
    }

    const clearCacheBtn = document.getElementById("sphere-clear-renderer-cache");
    if (clearCacheBtn) {
      clearCacheBtn.addEventListener("click", async () => {
        if (typeof caches !== "undefined") {
          const keys = await caches.keys();
          for (const k of keys) await caches.delete(k);
          clearCacheBtn.textContent = "Cache cleared — reloading…";
          setTimeout(() => location.reload(), 800);
        } else {
          clearCacheBtn.textContent = "No cache API";
        }
      });
    }

    const switchSvgBtn = document.getElementById("sphere-switch-svg");
    if (switchSvgBtn) {
      switchSvgBtn.addEventListener("click", () => {
        if (globalThis.LivingTimeSphereRenderer3d?.isInitialized?.()) {
          globalThis.LivingTimeSphereRenderer3d.teardown();
        }
        _state.active3d = false;
        _state._3dInitInProgress = false;
        _state.rendererMode = "svg";
        const sel = document.getElementById("sphere-renderer-select");
        if (sel) sel.value = "svg";
        _hideRendererFallbackWarning();
        renderSphere(container);
      });
    }
  }

  // ── Guided introduction ───────────────────────────────────────────

  const INTRO_STEPS = [
    { title: "Pattern Time — fixed center",  body: "The 13 Moon Pattern structure remains fixed at the center. It does not move." },
    { title: "The Equinox moves",            body: "The March Equinox occurs at a different Pattern position each year. Astronomical cycles travel around fixed Pattern Time." },
    { title: "The Equinox Passage",          body: "The Passage arc connects the Equinox Gate to Moon 1 Day 1. Its length is the Equinox offset — measured in hours." },
    { title: "The lunar orbit",              body: "The lunar cycle moves independently around the Pattern ring. At the Equinox moment, the Moon occupies a distinct phase." },
    { title: "13 years of records",          body: "Annual markers from 2014–2026 form a 13-year spiral. Each year shares a different Passage length and lunar relationship." },
    { title: "The Alignment Ledger",         body: "The Ledger measures recurrence — when years share pattern alignments — without claiming causation." },
  ];

  let _introStep = 0;

  function _wireIntro(container) {
    const introEl    = document.getElementById("sphere-intro");
    if (!introEl) return;

    const replayBtn  = document.getElementById("sphere-intro-replay");
    const skipBtn    = document.getElementById("sphere-intro-skip");
    const nextBtn    = document.getElementById("sphere-intro-next");
    const titleEl    = document.getElementById("sphere-intro-title");
    const bodyEl     = document.getElementById("sphere-intro-body");
    const stepEl     = document.getElementById("sphere-intro-step");

    // Show intro only if not dismissed this session and 3D is active
    function maybeShowIntro() {
      const dismissed = globalThis.LivingTimeSphereAnimation?.isIntroDismissed?.() ?? true;
      if (!dismissed && _state.active3d && !_state.introShown) {
        _state.introShown = true;
        _introStep = 0;
        _showIntroStep(titleEl, bodyEl, stepEl);
        introEl.hidden = false;
      }
    }

    function _showIntroStep(titleEl, bodyEl, stepEl) {
      const step = INTRO_STEPS[_introStep];
      if (!step) return;
      if (titleEl) titleEl.textContent = step.title;
      if (bodyEl)  bodyEl.textContent  = step.body;
      if (stepEl)  stepEl.textContent  = `${_introStep + 1} / ${INTRO_STEPS.length}`;
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        _introStep++;
        if (_introStep >= INTRO_STEPS.length) {
          introEl.hidden = true;
          globalThis.LivingTimeSphereAnimation?.dismissIntro?.();
        } else {
          _showIntroStep(titleEl, bodyEl, stepEl);
          if (nextBtn && _introStep === INTRO_STEPS.length - 1) nextBtn.textContent = "Finish";
        }
      });
    }

    if (skipBtn) {
      skipBtn.addEventListener("click", () => {
        introEl.hidden = true;
        globalThis.LivingTimeSphereAnimation?.dismissIntro?.();
      });
    }

    if (replayBtn) {
      replayBtn.addEventListener("click", () => {
        _state.introShown = false;
        globalThis.LivingTimeSphereAnimation?.resetIntroForSession?.();
        _introStep = 0;
        _showIntroStep(titleEl, bodyEl, stepEl);
        if (nextBtn) nextBtn.textContent = "Next";
        introEl.hidden = false;
      });
    }

    // Show after 3D init (delayed slightly)
    setTimeout(maybeShowIntro, 800);
  }

  // ── Interaction wiring (SVG fallback) ─────────────────────────────

  function wireInteraction(container) {
    globalThis.LivingTimeSphereInteraction.init(container, {
      onRotate: () => { if (!_state.active3d) renderSphere(container); },
      onZoom:   () => { if (!_state.active3d) renderSphere(container); },
      onReset:  () => { if (!_state.active3d) renderSphere(container); }
    });
  }

  // ── Init ──────────────────────────────────────────────────────────

  function init() {
    if (!safeInit()) {
      console.warn("LivingTimeSphereUi: not all dependencies available");
      return;
    }
    applyUrlState();

    const container = document.getElementById("sphere-container");
    if (!container) return;

    // Auto-open Sphere Settings panel on non-mobile viewports.
    const settingsGroup = document.querySelector(".sphere-settings-group");
    if (settingsGroup && window.innerWidth >= 600) {
      settingsGroup.open = true;
    }

    // Hide the interact bar immediately — it will be shown only after
    // 3D init succeeds.  This prevents the "Exit Interaction" ghost state.
    _updateInteractBar();

    wireControls(container);
    wireInteraction(container);

    // Defer first render by one animation frame so the container has a
    // stable, non-zero bounding rect before 3D dimensions are measured.
    requestAnimationFrame(() => {
      renderSphere(container);
    });

    // Re-render on resize (debounced).
    let resizeTimer;
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(() => {
        // Skip resize re-renders while 3D is still initializing — a
        // mid-init resize would start a second concurrent init call.
        if (_state._3dInitInProgress) return;
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          if (!_state.active3d) renderSphere(container);
        }, 150);
      }).observe(container);
    }
  }

  globalThis.LivingTimeSphereUi = Object.freeze({
    init,
    getState: () => Object.assign({}, _state),
    renderSphere: (container) => renderSphere(container || document.getElementById("sphere-container")),
  });
})();
