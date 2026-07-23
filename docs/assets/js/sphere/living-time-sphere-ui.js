(() => {
  "use strict";

  // Living Time Sphere UI — DOM orchestration layer.
  // Wires model, renderers, interaction, accessibility, export, and URL state together.

  let _state = {
    year:          2026,
    viewMode:      "today",
    timeZone:      "America/Los_Angeles",
    boundaryMode:  "sunset",
    manualSunset:  "18:00",
    visibleLayers: { pattern: true, passage: true, lunar: true, solar: true, markers: true, recurrence: false, spiral: true },
    selectedMarker: null,
    useCanvas:     false,
    lowPower:      false
  };

  function safeInit() {
    const required = [
      "LivingTimeSphereModel", "LivingTimeSphereLayout",
      "LivingTimeSphereRendererSvg", "LivingTimeSphereInteraction",
      "LivingTimeSphereAccessibility", "LivingTimeSphereUrlState",
      "AlignmentLedgerData"
    ];
    return required.every(d => !!globalThis[d]);
  }

  function applyUrlState() {
    if (typeof location === "undefined") return;
    const parsed = globalThis.LivingTimeSphereUrlState.parseSphereUrl(location.href);
    if (parsed.year)         _state.year         = parsed.year;
    if (parsed.viewMode)     _state.viewMode     = parsed.viewMode;
    if (parsed.timeZone)     _state.timeZone     = parsed.timeZone;
    if (parsed.boundaryMode) _state.boundaryMode = parsed.boundaryMode;
    if (parsed.manualSunset) _state.manualSunset = parsed.manualSunset;
    if (parsed.marker)       _state.selectedMarker = parsed.marker;
    if (parsed.layers) {
      for (const k of Object.keys(_state.visibleLayers)) _state.visibleLayers[k] = false;
      for (const l of parsed.layers) _state.visibleLayers[l] = true;
    }
  }

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

  function renderSphere(container) {
    if (!container) return;
    const { w, h } = getContainerSize(container);
    const dpr      = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
    const layout   = globalThis.LivingTimeSphereLayout.resolveLayout({ containerWidth: w, containerHeight: h, devicePixelRatio: dpr });
    const model    = buildCurrentModel();
    const spiral   = globalThis.LivingTimeSphereModel.buildSpiral({ timeZone: _state.timeZone, boundaryMode: _state.boundaryMode, manualSunset: _state.manualSunset });

    // Try Canvas first if preferred, fall back to SVG.
    if (_state.useCanvas && globalThis.LivingTimeSphereRendererCanvas?.isCanvasSupported?.()) {
      let canvas = container.querySelector(".living-time-sphere-canvas");
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.className = "living-time-sphere-canvas";
        container.innerHTML = "";
        container.appendChild(canvas);
      }
      const ok = globalThis.LivingTimeSphereRendererCanvas.renderCanvas({ canvas, model, spiral, layout, visibleLayers: _state.visibleLayers, selectedYear: _state.year });
      if (!ok) renderSvg(container, model, spiral, layout);
    } else {
      renderSvg(container, model, spiral, layout);
    }

    updateAccessibleText(model, spiral);
    updateDetails(model);
  }

  function renderSvg(container, model, spiral, layout) {
    globalThis.LivingTimeSphereRendererSvg.renderInto(container, {
      model, spiral, layout,
      visibleLayers: _state.visibleLayers,
      selectedYear:  _state.year,
      viewMode:      _state.viewMode
    });
  }

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
    const pos   = model.sourceRecord?.equinox?.patternPosition || {};
    const lunar = model.sourceRecord?.equinox?.lunarLayer       || {};
    const offs  = model.sourceRecord?.offsets || {};
    el.innerHTML = `
      <h3 class="sphere-details-heading">Year ${model.year}</h3>
      <dl class="sphere-details-grid">
        <dt>Pattern position</dt><dd>${pos.moon != null ? `Moon ${pos.moon} · Day ${pos.day}` : "Outside count"}</dd>
        <dt>Passage</dt><dd>${Number(((offs.equinoxToYearGateDays || 0) * 24).toFixed(1))} hours</dd>
        <dt>Lunar phase</dt><dd>${lunar.phaseName || "—"}</dd>
        <dt>Equinox angle</dt><dd>${model.passageStartAngle?.toFixed(1) || "—"}°</dd>
      </dl>`;
  }

  function wireControls(container) {
    // View mode buttons.
    ["today", "passage", "years", "pattern"].forEach(mode => {
      const btn = document.getElementById(`sphere-mode-${mode}`);
      if (!btn) return;
      btn.addEventListener("click", () => {
        _state.viewMode = mode;
        document.querySelectorAll("[id^='sphere-mode-']").forEach(b => b.setAttribute("aria-pressed", "false"));
        btn.setAttribute("aria-pressed", "true");
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
        globalThis.LivingTimeSphereInteraction.resetView(container);
        renderSphere(container);
      });
    }

    // Copy link.
    const copyBtn = document.getElementById("sphere-copy-link");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        const link = globalThis.LivingTimeSphereUrlState.buildSphereUrl({
          year:          _state.year,
          viewMode:      _state.viewMode,
          layers:        Object.entries(_state.visibleLayers).filter(([, v]) => v).map(([k]) => k),
          timeZone:      _state.timeZone,
          boundaryMode:  _state.boundaryMode,
          manualSunset:  _state.manualSunset,
          datasetVersion: globalThis.LivingTimeSphereVersion?.version
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
        globalThis.LivingTimeSphereExport.exportPng({ svgContainer: container, format: "square", year: _state.year, viewMode: _state.viewMode });
      });
    }

    // Sphere year-select events (from marker clicks).
    container.addEventListener("sphere:year-select", e => {
      const y = e.detail?.year;
      if (!y) return;
      _state.year = y;
      _state.viewMode = "passage";
      if (yearSelect) yearSelect.value = String(y);
      globalThis.LivingTimeSphereAccessibility.announce(`Year ${y} selected. Switching to Passage view.`);
      renderSphere(container);
    });
  }

  function wireInteraction(container) {
    globalThis.LivingTimeSphereInteraction.init(container, {
      onRotate: () => renderSphere(container),
      onZoom:   () => renderSphere(container),
      onReset:  () => renderSphere(container)
    });
  }

  function init() {
    if (!safeInit()) {
      console.warn("LivingTimeSphereUi: not all dependencies available");
      return;
    }
    applyUrlState();

    const container = document.getElementById("sphere-container");
    if (!container) return;

    wireControls(container);
    wireInteraction(container);
    renderSphere(container);

    // Re-render on resize (debounced).
    let resizeTimer;
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(() => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => renderSphere(container), 100);
      }).observe(container);
    }
  }

  globalThis.LivingTimeSphereUi = Object.freeze({ init, getState: () => Object.assign({}, _state) });
})();
