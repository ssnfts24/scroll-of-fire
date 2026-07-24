(() => {
  "use strict";

  function assertDeps() {
    const required = [
      "LivingTimeSphereModel",
      "LivingTimeSphereLayout",
      "LivingTimeSphereRendererSvg",
      "LivingTimeSphereLiveData",
      "LivingTimeSphereState"
    ];
    return required.every(name => !!globalThis[name]);
  }

  function _observeOnce(target, callback) {
    if (!target || typeof IntersectionObserver === "undefined") {
      callback();
      return { disconnect() {} };
    }
    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting) {
        observer.disconnect();
        callback();
      }
    }, { rootMargin: "180px" });
    observer.observe(target);
    return observer;
  }

  function _ensureOverlay(container) {
    const parent = container.parentElement || container;
    let overlay = parent.querySelector("#sphere-moon-labels");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "sphere-moon-labels";
      overlay.className = "sphere-moon-labels";
      overlay.setAttribute("aria-hidden", "true");
      parent.appendChild(overlay);
    }
    return overlay;
  }

  function _buildModel(state) {
    const snapshot = globalThis.LivingTimeSphereLiveData?.getSnapshot?.({
      asOf: state.instant || undefined,
      timeZone: state.timeZone,
      boundaryMode: state.boundaryMode,
      manualSunset: state.manualSunset,
    }) || null;
    const selectedYear = state.selectedYear || snapshot?.yearModel?.year || snapshot?.year || new Date().getUTCFullYear();
    const baseModel = (state.mode === "today" || state.mode === "pattern")
      ? globalThis.LivingTimeSphereModel.buildTodayModel({
          asOf: state.instant || undefined,
          timeZone: state.timeZone,
          boundaryMode: state.boundaryMode,
          manualSunset: state.manualSunset,
        })
      : globalThis.LivingTimeSphereModel.buildYearModel({
          year: selectedYear,
          timeZone: state.timeZone,
          boundaryMode: state.boundaryMode,
          manualSunset: state.manualSunset,
        });
    const spiral = globalThis.LivingTimeSphereModel.buildSpiral({
      timeZone: state.timeZone,
      boundaryMode: state.boundaryMode,
      manualSunset: state.manualSunset,
    });
    return { snapshot, baseModel, spiral, selectedYear };
  }

  function _decorateModel(baseModel, state, snapshot) {
    const selectedDay = Number(state.selectedDay || 0) || snapshot?.pattern?.dayOfPatternYear || baseModel?.todayPatternPosition?.dayOfPatternYear || 1;
    const clamped = Math.max(1, Math.min(364, selectedDay));
    const civilDate = globalThis.PatternCalendar?.epochForYear?.(state.selectedYear)
      ? new Date(globalThis.PatternCalendar.epochForYear(state.selectedYear).getTime() + (clamped - 1) * 86400000)
      : null;
    const selected = civilDate && globalThis.PatternCalendar?.fromCivilDate
      ? globalThis.PatternCalendar.fromCivilDate({
          date: civilDate,
          timeZone: state.timeZone,
          boundaryMode: "midnight",
          sunsetTime: state.manualSunset,
        })
      : null;
    const weekGate = selected?.weekOfMoon
      ? globalThis.PatternCalendarData?.weekGates?.[selected.weekOfMoon - 1] || null
      : null;
    const decorated = {
      ...baseModel,
      selectedPatternPosition: selected ? {
        ...selected,
        day: selected.day ?? selected.moonDay,
        moonDay: selected.day ?? selected.moonDay,
        weekGate,
        isToday: selected.dayOfPatternYear === snapshot?.pattern?.dayOfPatternYear && selected.patternYear === snapshot?.pattern?.patternYear,
      } : baseModel.selectedPatternPosition || baseModel.todayPatternPosition || null,
    };
    return decorated;
  }

  function mount(options = {}) {
    if (!assertDeps()) return null;
    if (options.fullPage && globalThis.LivingTimeSphereUi) {
      globalThis.LivingTimeSphereUi.init();
      return {
        getState() { return globalThis.LivingTimeSphereUi.getState(); },
        refresh() { return globalThis.LivingTimeSphereUi.renderSphere(options.container || document.getElementById("sphere-container")); },
        teardown() {},
      };
    }

    const container = options.container;
    if (!container) return null;
    _ensureOverlay(container);
    container.dataset.ltsManagedMount = "true";

    let state = globalThis.LivingTimeSphereState.createState({
      ...options.state,
      compact: !!options.compact,
      mode: options.mode || options.state?.mode,
      renderer: options.renderer || options.state?.renderer,
      quality: options.quality || options.state?.quality,
      visibleLayers: options.visibleLayers || options.state?.visibleLayers,
    });

    let sceneData = null;
    let active3d = false;

    function notify() {
      if (typeof options.onStateChange === "function") {
        options.onStateChange({
          state,
          model: sceneData?.model || null,
          spiral: sceneData?.spiral || null,
          snapshot: sceneData?.snapshot || null,
          selectedYear: sceneData?.selectedYear || state.selectedYear,
        });
      }
    }

    function renderSvg() {
      const width = container.clientWidth || (state.compact ? 260 : 320);
      const height = container.clientHeight || (state.compact ? 260 : 320);
      const layout = globalThis.LivingTimeSphereLayout.resolveLayout({
        containerWidth: width,
        containerHeight: height,
        devicePixelRatio: typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1,
      });
      globalThis.LivingTimeSphereRendererSvg.renderInto(container, {
        model: sceneData.model,
        spiral: sceneData.spiral,
        layout,
        visibleLayers: sceneData.visibleLayers,
        selectedYear: sceneData.selectedYear,
        viewMode: state.mode,
        moonLabelMode: state.moonLabelMode,
        moonLabelDistance: state.moonLabelDistance,
        dayLabelMode: state.dayLabelMode,
        connectionRegistry: sceneData.connectionRegistry,
      });
    }

    function buildScene() {
      const base = _buildModel(state);
      const model = _decorateModel(base.baseModel, state, base.snapshot);
      const visibleLayers = { ...state.visibleLayers };
      visibleLayers.pattern = !!visibleLayers.pattern;
      visibleLayers.lunar = !!visibleLayers.lunar;
      visibleLayers.solar = !!visibleLayers.solar;
      visibleLayers.passage = !!visibleLayers.passage;
      visibleLayers.spiral = !!visibleLayers.spiral;
      visibleLayers.recurrence = !!visibleLayers.recurrence;
      visibleLayers.markers = !!visibleLayers.markers;
      const connectionRegistry = globalThis.LivingTimeSphereConnections?.buildRegistry?.({
        model,
        spiral: base.spiral,
        state,
      }) || [];
      sceneData = {
        ...base,
        model,
        visibleLayers,
        connectionRegistry,
      };
    }

    async function activate3d() {
      if (active3d || state.renderer === "svg" || !globalThis.LivingTimeSphereRenderer3d || !globalThis.LivingTimeSphereM) return;
      const preset = state.quality === "auto"
        ? globalThis.LivingTimeSphereM.resolveAutoPreset({
            reducedMotion: state.motionMode === "reduced",
            deviceMemoryGb: (typeof navigator !== "undefined" && navigator.deviceMemory) || 4,
            screenWidth: typeof window !== "undefined" ? window.innerWidth : 1024,
            webglAvailable: !!globalThis.LivingTimeSphereEffects?.detectWebGl?.(),
          })
        : globalThis.LivingTimeSphereM.QUALITY_PRESETS[state.quality] || globalThis.LivingTimeSphereM.QUALITY_PRESETS.balanced;
      const result = await globalThis.LivingTimeSphereRenderer3d.init({
        container,
        model: sceneData.model,
        spiral: sceneData.spiral,
        quality: preset,
        selectedYear: sceneData.selectedYear,
        visibleLayers: sceneData.visibleLayers,
        viewMode: state.mode,
        moonLabelMode: state.moonLabelMode,
        moonLabelDistance: state.moonLabelDistance,
        dayLabelMode: state.dayLabelMode,
        connectionRegistry: sceneData.connectionRegistry,
        motionMode: state.motionMode,
        reducedMotion: state.motionMode === "reduced",
        onYearSelect(year) {
          state = globalThis.LivingTimeSphereState.mergeState(state, { selectedYear: year, mode: "passage", selectedMarker: `year-${year}` });
          buildScene();
          if (active3d) {
            globalThis.LivingTimeSphereRenderer3d.refresh(sceneData.model, sceneData.spiral, sceneData.selectedYear, sceneData.visibleLayers, state.mode, state.moonLabelMode, state.moonLabelDistance, state.dayLabelMode, sceneData.connectionRegistry, state.motionMode);
          }
          notify();
        },
        onMarkerSelect(marker) {
          if (!marker) return;
          if (marker.type === "day" && marker.dayOfPatternYear) {
            state = globalThis.LivingTimeSphereState.mergeState(state, { selectedDay: marker.dayOfPatternYear, selectedMarker: `day-${marker.dayOfPatternYear}`, selectedMoon: marker.moon || null });
          } else if (marker.type === "moon" && marker.moon) {
            state = globalThis.LivingTimeSphereState.mergeState(state, { selectedMoon: marker.moon, selectedDay: (marker.moon - 1) * 28 + Math.max(1, Math.min(28, marker.day || 1)), selectedMarker: `moon-${marker.moon}` });
          } else {
            state = globalThis.LivingTimeSphereState.mergeState(state, { selectedMarker: marker.type || null });
          }
          buildScene();
          if (active3d) {
            globalThis.LivingTimeSphereRenderer3d.refresh(sceneData.model, sceneData.spiral, sceneData.selectedYear, sceneData.visibleLayers, state.mode, state.moonLabelMode, state.moonLabelDistance, state.dayLabelMode, sceneData.connectionRegistry, state.motionMode);
          }
          notify();
        },
      });
      active3d = !!result?.success;
    }

    function refresh(patch = {}) {
      state = globalThis.LivingTimeSphereState.mergeState(state, patch);
      buildScene();
      if (active3d && globalThis.LivingTimeSphereRenderer3d?.isInitialized?.()) {
        globalThis.LivingTimeSphereRenderer3d.refresh(sceneData.model, sceneData.spiral, sceneData.selectedYear, sceneData.visibleLayers, state.mode, state.moonLabelMode, state.moonLabelDistance, state.dayLabelMode, sceneData.connectionRegistry, state.motionMode);
      } else {
        renderSvg();
      }
      notify();
    }

    buildScene();
    renderSvg();
    notify();
    _observeOnce(container, () => { activate3d(); });

    return {
      activate: activate3d,
      refresh,
      teardown() {
        if (active3d && globalThis.LivingTimeSphereRenderer3d?.isInitialized?.()) {
          globalThis.LivingTimeSphereRenderer3d.teardown();
        }
        active3d = false;
      },
      getState() { return state; },
    };
  }

  globalThis.LivingTimeSphere = Object.freeze({ mount });
})();
