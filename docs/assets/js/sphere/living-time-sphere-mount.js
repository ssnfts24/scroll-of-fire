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
          boundaryMode: state.boundaryMode,
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

  function _resolveSemanticState(state, container) {
    const zoom = globalThis.LivingTimeSphereSemanticZoom;
    if (!zoom?.resolveBand || !zoom?.resolveVisibility) return null;
    const cameraState = globalThis.LivingTimeSphereCamera?.getState?.() || {};
    const fallbackDist = globalThis.LivingTimeSphereCamera?.MODE_POSITIONS?.[state.mode]?.distance || 2.35;
    const width = container?.clientWidth || (typeof window !== "undefined" ? window.innerWidth : 1024);
    const band = zoom.resolveBand({
      distance: Number.isFinite(Number(cameraState.dist)) ? Number(cameraState.dist) : fallbackDist,
      screenWidth: width
    });
    return zoom.resolveVisibility({
      baseLayers: state.visibleLayers || {},
      band,
      connectionMode: state.connectionMode,
    });
  }

  // ── Tier ↔ quality-preset helpers ────────────────────────────────
  //
  // ObservatoryCapabilityManager is the authoritative source for capability
  // and tier decisions.  performance-runtime.js handles page-level CSS classes
  // and image loading; it delegates Observatory-specific tier decisions to
  // ObservatoryCapabilityManager via the sof:performance-profile event (which
  // ObservatoryCapabilityManager may optionally consume in future).
  //
  // The helpers below map between the two vocabularies so that the mount and
  // renderer modules stay consistent.

  /**
   * Map a state.quality string to the corresponding PERFORMANCE_TIERS value
   * for use as a selectTier() override.  Returns undefined for "auto".
   */
  function _qualityStateToTierOverride(qualityState, capMgr) {
    if (!qualityState || qualityState === "auto" || !capMgr) return undefined;
    const map = {
      "high":     capMgr.PERFORMANCE_TIERS.HIGH,
      "balanced": capMgr.PERFORMANCE_TIERS.BALANCED,
      "lowpower": capMgr.PERFORMANCE_TIERS.LOWPOWER,
      "svgonly":  capMgr.PERFORMANCE_TIERS.MINIMAL,
    };
    return map[qualityState] || undefined;
  }

  /**
   * Map an ObservatoryCapabilityManager tier string to the corresponding
   * LivingTimeSphereM quality preset object.  Returns null for MINIMAL tier
   * (SVG-only path — caller should not attempt 3D init).
   */
  function _tierToQualityPreset(tier, capMgr) {
    const LTS = globalThis.LivingTimeSphereM;
    if (!LTS?.QUALITY_PRESETS) return null;
    const T = capMgr?.PERFORMANCE_TIERS;
    if (tier === (T?.HIGH     ?? "high"))     return LTS.QUALITY_PRESETS.high     || LTS.QUALITY_PRESETS.balanced;
    if (tier === (T?.BALANCED ?? "balanced")) return LTS.QUALITY_PRESETS.balanced;
    if (tier === (T?.LOWPOWER ?? "lowpower")) return LTS.QUALITY_PRESETS.lowpower;
    if (tier === (T?.MINIMAL  ?? "svgonly"))  return null;
    return LTS.QUALITY_PRESETS.balanced;
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
    let initGen = 0;          // incremented on each activate3d() call; guards stale inits
    let mounted = true;       // set false on teardown to suppress callbacks
    let restoreAttempts = 0;  // counts context-restoration retries (capped to prevent looping)
    let pendingSizeObserver = null;
    let activating3d = false;
    let rendererState = Object.freeze({
      phase: "baseline",
      requestedRenderer: state.renderer,
      activeRenderer: "svg",
      reason: null,
      detail: "Accessible SVG baseline is active.",
      tier: null,
    });

    function emitRenderer(patch = {}) {
      rendererState = Object.freeze({ ...rendererState, ...patch });
      container.dataset.activeRenderer = rendererState.activeRenderer || "svg";
      container.dataset.rendererPhase = rendererState.phase || "baseline";
      if (typeof options.onRendererChange === "function") {
        try { options.onRendererChange(rendererState); }
        catch (error) { console.warn("[LivingTimeSphere] Renderer observer failed.", error); }
      }
      return rendererState;
    }

    function _containerHasUsableSize() {
      if (!container) return false;
      const rect = typeof container.getBoundingClientRect === "function"
        ? container.getBoundingClientRect()
        : null;
      const width = Number(rect?.width ?? container.clientWidth ?? 0);
      const height = Number(rect?.height ?? container.clientHeight ?? 0);
      return width > 0 && height > 0;
    }

    function _awaitUsableContainerSize() {
      if (_containerHasUsableSize()) return false;
      if (pendingSizeObserver || typeof ResizeObserver === "undefined") return true;
      pendingSizeObserver = new ResizeObserver(() => {
        if (!mounted || !_containerHasUsableSize()) return;
        pendingSizeObserver.disconnect();
        pendingSizeObserver = null;
        Promise.resolve().then(() => {
          if (mounted && !active3d) activate3d();
        });
      });
      pendingSizeObserver.observe(container);
      return true;
    }

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
      const semanticZoomState = _resolveSemanticState(state, container);
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
        semanticZoomState,
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
      if (active3d || activating3d) return rendererState;
      if (state.renderer === "svg") {
        return emitRenderer({ phase: "ready", activeRenderer: "svg", reason: "SVG_REQUESTED", detail: "SVG renderer was requested." });
      }
      if (!globalThis.LivingTimeSphereRenderer3d || !globalThis.LivingTimeSphereM) {
        return emitRenderer({ phase: "fallback", activeRenderer: "svg", reason: "THREE_STACK_UNAVAILABLE", detail: "The 3D renderer stack is unavailable." });
      }
      if (_awaitUsableContainerSize()) return;

      const capMgr = globalThis.ObservatoryCapabilityManager;

      // ── Authoritative tier selection via ObservatoryCapabilityManager ──
      const webglAvailable = capMgr
        ? capMgr.probeWebGl().webgl2
        : !!globalThis.LivingTimeSphereEffects?.detectWebGl2?.();

      const tierOverride = _qualityStateToTierOverride(state.quality, capMgr);
      const tier = capMgr
        ? capMgr.selectTier({ webglAvailable, override: tierOverride })
        : (webglAvailable ? "balanced" : "svgonly");

      // MINIMAL → capability manager decided 3D is inappropriate; stay on SVG
      const minimalTier = capMgr?.PERFORMANCE_TIERS?.MINIMAL ?? "svgonly";
      if (tier === minimalTier) {
        return emitRenderer({ phase: "fallback", activeRenderer: "svg", reason: webglAvailable ? "MINIMAL_TIER" : "WEBGL2_REQUIRED", detail: webglAvailable ? "Device-safe SVG tier selected." : "WebGL2 is unavailable; accessible SVG remains active.", tier });
      }

      const preset = _tierToQualityPreset(tier, capMgr);
      if (!preset) {
        return emitRenderer({ phase: "fallback", activeRenderer: "svg", reason: "NO_QUALITY_PRESET", detail: "No safe 3D quality preset was available.", tier });
      }

      activating3d = true;
      emitRenderer({ phase: "upgrading", activeRenderer: "svg", reason: null, detail: "Accessible SVG is active while 3D initializes.", tier });

      // Generation token — prevents a stale init from replacing an active renderer
      const thisGen = ++initGen;

      // ── Context-loss/restore callbacks ────────────────────────────────
      // These are live closures that update mount-level state and orchestrate
      // the renderer lifecycle.  Observatory state (state, sceneData) is
      // authoritative across renderer transitions — the calendar/time model
      // is never rebuilt just because WebGL failed.
      const onContextLost = () => {
        if (!mounted) return;
        active3d = false;
        activating3d = false;
        // Re-render SVG with the preserved observatory state.
        buildScene();
        renderSvg();
        emitRenderer({ phase: "fallback", activeRenderer: "svg", reason: "WEBGL_CONTEXT_LOST", detail: "The WebGL context was lost; SVG restored the Sphere." });
        notify();
      };

      const MAX_RESTORE_ATTEMPTS = 3;
      const onContextRestored = () => {
        if (!mounted || active3d) return;
        restoreAttempts++;
        if (restoreAttempts > MAX_RESTORE_ATTEMPTS) {
          console.warn("[LivingTimeSphere] Max context-restore attempts reached; staying on SVG fallback.");
          return;
        }
        // Teardown stale renderer resources, then attempt a clean 3D reinit.
        try { globalThis.LivingTimeSphereRenderer3d?.teardown?.(); } catch { /* best-effort */ }
        Promise.resolve().then(() => {
          if (mounted && !active3d) activate3d();
        });
      };

      // ── Race init against timeout ─────────────────────────────────────
      // Prevents indefinite hang on slow/frozen Three.js import or renderer
      // creation.  On timeout, SVG fallback remains active.
      const timeoutMs = Math.max(3000, Math.min(30000, Number(options.initTimeoutMs) || 15000));
      const timeoutPromise = capMgr
        ? capMgr.initTimeout(timeoutMs)
        : new Promise((_, reject) =>
            setTimeout(() => reject({ reason: "INIT_TIMEOUT", detail: `Timed out after ${timeoutMs}ms` }), timeoutMs)
          );

      let result;
      try {
        result = await Promise.race([
          globalThis.LivingTimeSphereRenderer3d.init({
            container,
            model:              sceneData.model,
            spiral:             sceneData.spiral,
            quality:            preset,
            tier,
            selectedYear:       sceneData.selectedYear,
            visibleLayers:      sceneData.visibleLayers,
            viewMode:           state.mode,
            moonLabelMode:      state.moonLabelMode,
            moonLabelDistance:  state.moonLabelDistance,
            dayLabelMode:       state.dayLabelMode,
            connectionRegistry: sceneData.connectionRegistry,
            motionMode:         state.motionMode,
            selectedMarker:     state.selectedMarker,
            environmentState:   globalThis.SofEnvironmentState?.getEnvironmentState?.() || null,
            reducedMotion:      state.motionMode === "reduced",
            onContextLost,
            onContextRestored,
            onYearSelect(year) {
              state = globalThis.LivingTimeSphereState.mergeState(state, { selectedYear: year, mode: "passage", selectedMarker: `year-${year}` });
              buildScene();
              if (active3d) {
                globalThis.LivingTimeSphereRenderer3d.refresh(sceneData.model, sceneData.spiral, sceneData.selectedYear, sceneData.visibleLayers, state.mode, state.moonLabelMode, state.moonLabelDistance, state.dayLabelMode, sceneData.connectionRegistry, state.motionMode, undefined, state.selectedMarker);
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
                globalThis.LivingTimeSphereRenderer3d.refresh(sceneData.model, sceneData.spiral, sceneData.selectedYear, sceneData.visibleLayers, state.mode, state.moonLabelMode, state.moonLabelDistance, state.dayLabelMode, sceneData.connectionRegistry, state.motionMode, undefined, state.selectedMarker);
              }
              notify();
            },
          }),
          timeoutPromise,
        ]);
      } catch (err) {
        // Timeout rejects with { reason, detail }; unexpected errors may also arrive here.
        // In all cases, SVG fallback is already visible — no additional action needed.
        if (initGen !== thisGen) return rendererState; // stale init — discard silently
        activating3d = false;
        const reason = err?.reason ?? "INIT_EXCEPTION";
        if (reason === "INIT_TIMEOUT") {
          console.warn(`[LivingTimeSphere] 3D init timed out after ${timeoutMs}ms (INIT_TIMEOUT). SVG fallback remains active.`);
        } else {
          console.warn(`[LivingTimeSphere] 3D init failed (${reason}). SVG fallback remains active.`);
        }
        return emitRenderer({ phase: "fallback", activeRenderer: "svg", reason, detail: err?.detail || "3D initialization failed; SVG remains active.", tier });
      }

      // Guard: if a newer generation started while we were awaiting init, discard this result.
      if (initGen !== thisGen) {
        if (result?.success) {
          try { globalThis.LivingTimeSphereRenderer3d?.teardown?.(); } catch { /* best-effort */ }
        }
        activating3d = false;
        return rendererState;
      }

      active3d = !!result?.success;
      activating3d = false;
      if (active3d) {
        return emitRenderer({ phase: "ready", activeRenderer: "3d", reason: null, detail: "The 3D Sphere rendered its first verified frame.", tier });
      }
      return emitRenderer({ phase: "fallback", activeRenderer: "svg", reason: result?.reason || "INIT_FAILED", detail: result?.detail || "The 3D renderer did not pass readiness checks; SVG remains active.", tier });
    }

    function refresh(patch = {}) {
      state = globalThis.LivingTimeSphereState.mergeState(state, patch);
      buildScene();
      if (active3d && globalThis.LivingTimeSphereRenderer3d?.isInitialized?.()) {
        globalThis.LivingTimeSphereRenderer3d.refresh(sceneData.model, sceneData.spiral, sceneData.selectedYear, sceneData.visibleLayers, state.mode, state.moonLabelMode, state.moonLabelDistance, state.dayLabelMode, sceneData.connectionRegistry, state.motionMode, undefined, state.selectedMarker);
        globalThis.LivingTimeSphereRenderer3d.updateEnvironment?.(globalThis.SofEnvironmentState?.getEnvironmentState?.() || null);
      } else {
        renderSvg();
      }
      notify();
    }

    buildScene();
    renderSvg();
    emitRenderer();
    notify();
    _observeOnce(container, () => { activate3d(); });

    return {
      activate: activate3d,
      refresh,
      teardown() {
        mounted = false;
        activating3d = false;
        initGen += 1;
        if (pendingSizeObserver) {
          pendingSizeObserver.disconnect();
          pendingSizeObserver = null;
        }
        if (active3d && globalThis.LivingTimeSphereRenderer3d?.isInitialized?.()) {
          globalThis.LivingTimeSphereRenderer3d.teardown();
        }
        active3d = false;
        emitRenderer({ phase: "stopped", activeRenderer: "svg", reason: "TEARDOWN", detail: "Sphere mount stopped." });
      },
      getState() { return state; },
      getRendererState() { return rendererState; },
    };
  }

  globalThis.LivingTimeSphere = Object.freeze({ mount });
})();
