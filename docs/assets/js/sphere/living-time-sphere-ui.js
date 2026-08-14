(() => {
  "use strict";

  // Living Time Sphere UI — DOM orchestration layer.
  // Wires model, renderers, interaction, accessibility, export, and URL state together.
  // Phase 03: adds 3D renderer (WebGL/Three.js), quality mode, view-renderer selector,
  // and guided introduction.

  let _state = {
    year:          2026,
    viewMode:      "today",
    requestedViewMode: "today",
    activeViewMode: "today",
    previousViewMode: "today",
    latestRequestedMode: null,
    modeTransitionState: "idle",
    modeTransitionRevision: 0,
    modeTransitionInFlight: false,
    modeTransitionFailure: null,
    lastModeTransitionDuration: 0,
    modeTransitionMetrics: [],
    timeZone:      "America/Los_Angeles",
    boundaryMode:  "sunset",
    manualSunset:  "18:00",
    selectedDayOfYear: null,
    fieldRange:    "now",
    visibleLayers: { pattern: true, exactDays: true, weekGates: true, outsideDays: true, passage: true, lunar: true, solar: true, markers: true, recurrence: true, spiral: true, environment: true, witness: false, personal: false, connections: true },
    selectedMarker: null,
    source: null,
    datasetVersion: null,
    useCanvas:     false,
    lowPower:      false,
    // Phase 03 additions
    requestedRendererMode: "auto", // user preference: "auto" | "3d" | "svg" | "canvas" | "table" | "text"
    activeRendererMode: "svg",     // runtime mode: "svg" | "3d" | "initializing-3d" | "recovering" | "table" | "text"
    quality:       "auto",   // "auto" | "high" | "balanced" | "lowpower" | "svgonly"
    moonLabelMode: "balanced", // "essential" | "balanced" | "all" | "none"
    moonLabelDistance: "standard",
    dayLabelMode: "key",
    showLabels: true,
    layerPreset: "fullObservatory",
    connectionMode: "contextual",
    connectionCategories: { calendar: true, pattern: true, solar: true, lunar: true, passage: true, historical: true },
    motionMode: "still",
    semanticZoom: null,
    semanticBand: null,
    active3d:      false,    // true when 3D renderer is active
    introShown:    false,
    _3dInitInProgress: false, // guard against concurrent 3D init calls
    _3dInitGeneration: 0,
    _pending3dPayload: null,
    _latestContainerSize: { w: 0, h: 0 },
    restoreAttempts: 0,
    rendererLifecycle: "not-started",
    environmentLifecycle: "idle",
    retryCount: 0,
    lastRenderTimestamp: 0,
    _autoRetryTimer: 0,
    _recoveryHooksBound: false,
    _resizeObserver: null,
    _spiralCacheKey: "",
    _spiralCache: null,
    selectedUpdateStatus: "idle",
    selectedUpdateRevision: 0,
    pendingSelectedDay: null,
    selectedUpdateInFlight: false,
    fullRenderCount: 0,
    selectedLightweightUpdateCount: 0,
    selectedUpdateMetrics: [],
    selectedUpdateLongTasks: [],
    selectedUpdateLastWatchdog: null,
    lastNavActionAt: 0,
    lastNavActionId: "",
    _selectedLongTaskObserver: null,
    layerStateSource: "default",
    userCustomizedLayers: false,
    actionCounters: {
      modeUpdateCount: 0,
      selectedDayUpdateCount: 0,
      layerUpdateCount: 0,
      environmentFocusCount: 0,
      environmentDataUpdateCount: 0,
    },
    actionTrace: [],
    lastEnvironmentFocusDiagnostics: null,
    initialUrl: "",
    currentUrl: "",
    urlIntegrity: "unknown",
    buildLogEmitted: false,
    coldBootDiagnostics: null,
  };
  const MOON_LABEL_MODE_KEY = "lts-moon-label-mode";
  const SELECTED_STATE_KEY = "lts-selected-pattern-state.v1";
  const LAYER_PREFERENCES_KEY = "sof.sphere.layerPreferences.v2";
  const DAY_MS = 24 * 60 * 60 * 1000;
  const SHABBAT_DAYS = new Set(
    (Array.isArray(globalThis.SOF_MOONS_CONFIG?.shabbat?.moonDays)
      ? globalThis.SOF_MOONS_CONFIG.shabbat.moonDays
      : [2, 9, 16, 23]
    ).map(Number).filter(Number.isFinite)
  );
  const MOON_LOG_KEY = "sof_moon_logs_v3";
  const LEGACY_MOON_LOG_KEY = "sof_moon_logs_v2";
  const SPHERE_STORAGE_PREFIXES = Object.freeze(["lts-", "sof.sphere.", "sof_moon_logs"]);
  const FIELD_RANGE_LABELS = Object.freeze({
    now: "Now",
    today: "Today",
    "pattern-week": "Pattern Week",
    "pattern-moon": "Pattern Moon",
    "pattern-year": "Pattern Year",
    historical: "Historical comparison",
  });
  let _brokenResourceGuardInstalled = false;
  const LAYER_PRESET_OPTIONS = Object.freeze(["fullObservatory", "cleanPattern", "livingSky", "weatherField", "passage", "witnessMap", "historicalField", "lowPower"]);

  let _urlHasExplicitLayers = false;
  let _urlHasExplicitMoonLabelDistance = false;
  let _syncingLayerControls = false;
  let _pendingLayerState = null;
  let _layerStateFlushRaf = 0;
  let _layerStateFlushContainer = null;
  let _resourceTrackerInstalled = false;
  const _resourceFailureLog = [];
  const ENV_FOCUS_PULSE_CLASS = "sphere-location-command-focus-pulse";

  // ── Dependency check ───────────────────────────────────────────────

  function safeInit() {
    const required = [
      "LivingTimeSphereModel", "LivingTimeSphereLayout",
      "LivingTimeSphereRendererSvg", "LivingTimeSphereInteraction",
      "LivingTimeSphereAccessibility", "LivingTimeSphereUrlState"
    ];
    return required.every(d => !!globalThis[d]);
  }

  function _resolveBuildIdentityLine() {
    const meta = globalThis.LivingTimeSphereVersion?.buildMetadata || {};
    const commit = meta.commitSha || "unknown-sha";
    const stamp = meta.buildTimestamp || "unknown-time";
    const context = meta.buildContext || "unknown-context";
    const renderer = meta.rendererVersion || globalThis.LivingTimeSphereVersion?.version || "unknown-renderer";
    const dataset = meta.datasetVersion || _state.datasetVersion || globalThis.LivingTimeSphereVersion?.version || "unknown-dataset";
    return `Build: ${commit} · ${stamp} · ${context} · renderer=${renderer} · dataset=${dataset}`;
  }

  function _readStorageDiagnostics() {
    const collectMatches = storage => {
      if (!storage) return [];
      try {
        const matches = [];
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (!key) continue;
          if (SPHERE_STORAGE_PREFIXES.some(prefix => key.startsWith(prefix))) {
            matches.push(key);
          }
        }
        return matches;
      } catch {
        return [];
      }
    };
    const localKeys = collectMatches(globalThis.localStorage);
    const sessionKeys = collectMatches(globalThis.sessionStorage);
    const selectedState = _readSelectedState();
    return {
      localKeys,
      sessionKeys,
      selectedStatePresent: !!selectedState,
      selectedMarker: typeof selectedState?.selectedMarker === "string" ? selectedState.selectedMarker : null,
      selectedDayOfYear: Number.isFinite(Number(selectedState?.selectedDayOfYear)) ? Number(selectedState.selectedDayOfYear) : null,
    };
  }

  async function _probeColdBootDiagnostics() {
    const probe = {
      at: new Date().toISOString(),
      locationHref: typeof location !== "undefined" ? location.href : "",
      serviceWorker: "unsupported",
      serviceWorkerScript: null,
      cacheKeyCount: 0,
      cacheKeys: [],
      sphereCacheKeys: [],
      ..._readStorageDiagnostics(),
    };
    if ("serviceWorker" in navigator) {
      try {
        const controller = navigator.serviceWorker.controller;
        const registration = await navigator.serviceWorker.getRegistration();
        probe.serviceWorker = controller ? "controlled" : (registration ? "registered-no-controller" : "unregistered");
        probe.serviceWorkerScript = registration?.active?.scriptURL || registration?.waiting?.scriptURL || registration?.installing?.scriptURL || null;
      } catch {
        probe.serviceWorker = "error";
      }
    }
    if (typeof caches !== "undefined") {
      try {
        const keys = await caches.keys();
        probe.cacheKeyCount = keys.length;
        probe.cacheKeys = keys.slice(0, 20);
        probe.sphereCacheKeys = keys.filter(key => /sphere|sof-|moon|codex/i.test(String(key))).slice(0, 12);
      } catch {
        probe.cacheKeyCount = -1;
      }
    }
    _state.coldBootDiagnostics = Object.freeze(probe);
    _updateRendererDiagnostics();
  }

  function _logBuildIdentityOnce() {
    if (_state.buildLogEmitted) return;
    const meta = globalThis.LivingTimeSphereVersion?.buildMetadata || {};
    const context = meta.buildContext || "";
    if (!["preview", "development"].includes(context)) return;
    console.info(`[LivingTimeSphere] build=${meta.commitSha || "unknown-sha"} ts=${meta.buildTimestamp || "unknown-time"} context=${context} renderer=${meta.rendererVersion || "unknown-renderer"} dataset=${meta.datasetVersion || _state.datasetVersion || "unknown-dataset"}`);
    _state.buildLogEmitted = true;
  }

  function _evaluateDeepLinkIntegrity(initialUrl, currentUrl) {
    if (!initialUrl || !currentUrl) return "unknown";
    try {
      const initial = new URL(initialUrl, location.href);
      const current = new URL(currentUrl, location.href);
      if (initial.hash !== current.hash) return "hash-changed";
      for (const [key, value] of initial.searchParams.entries()) {
        if (current.searchParams.get(key) !== value) return `param-changed:${key}`;
      }
      return "preserved";
    } catch {
      return "unknown";
    }
  }

  // ── URL state ──────────────────────────────────────────────────────

  function applyUrlState() {
    if (typeof location === "undefined") return;
    _urlHasExplicitLayers = false;
    _urlHasExplicitMoonLabelDistance = false;
    let parsedUrl = null;
    try { parsedUrl = new URL(location.href); } catch { parsedUrl = null; }
    if (parsedUrl?.searchParams?.has("moon_label_distance")) _urlHasExplicitMoonLabelDistance = true;
    const parsed = globalThis.LivingTimeSphereUrlState.parseSphereUrl(location.href);
    if (parsed.year)         _state.year         = parsed.year;
    if (parsed.viewMode)     _state.viewMode     = parsed.viewMode;
    _state.requestedViewMode = _state.viewMode;
    _state.activeViewMode = _state.viewMode;
    if (parsed.timeZone)     _state.timeZone     = parsed.timeZone;
    if (parsed.boundaryMode) _state.boundaryMode = parsed.boundaryMode;
    if (parsed.manualSunset) _state.manualSunset = parsed.manualSunset;
    if (parsed.marker)       _state.selectedMarker = parsed.marker;
    if (parsed.source)       _state.source = parsed.source;
    if (parsed.datasetVersion) _state.datasetVersion = parsed.datasetVersion;
    const markerDay = _selectedDayFromMarker(parsed.marker);
    if (markerDay != null) _state.selectedDayOfYear = markerDay;
    if (parsed.renderer)     _state.requestedRendererMode = parsed.renderer;
    if (parsed.quality)      _state.quality      = parsed.quality;
    if (parsed.connectionMode) _state.connectionMode = parsed.connectionMode;
    if (parsed.motionMode)     _state.motionMode = parsed.motionMode;
    if (parsed.moonLabelDistance) _state.moonLabelDistance = parsed.moonLabelDistance;
    if (parsed.dayLabelMode)   _state.dayLabelMode = parsed.dayLabelMode;
    if (parsed.hasExplicitLayers) {
      _urlHasExplicitLayers = true;
      _state.layerStateSource = "url-explicit";
      for (const k of Object.keys(_state.visibleLayers)) _state.visibleLayers[k] = false;
      for (const l of (parsed.layers || [])) _state.visibleLayers[l] = true;
    }
    if (parsed.moonLabelMode) _state.moonLabelMode = parsed.moonLabelMode;
    // Restore camera from URL (validated in url-state module)
    if ((parsed.cameraTheta != null || parsed.cameraDist != null) &&
        globalThis.LivingTimeSphereCamera) {
      globalThis.LivingTimeSphereCamera.setState({
        theta: parsed.cameraTheta,
        dist:  parsed.cameraDist
      });
    }

  }

  function _installBrokenResourceGuard() {
    if (_brokenResourceGuardInstalled) return;
    _brokenResourceGuardInstalled = true;
  }

  function _flushLayerStateUpdates() {
    _layerStateFlushRaf = 0;
    const container = _layerStateFlushContainer;
    const pending = _pendingLayerState;
    _layerStateFlushContainer = null;
    _pendingLayerState = null;
    if (!container || !pending) return;
    const renderer = globalThis.LivingTimeSphereRenderer3d;
    if (_state.active3d && renderer?.isInitialized?.() && typeof renderer.setLayerStates === "function") {
      const updated = renderer.setLayerStates(pending);
      if (!updated) renderSphere(container);
      _updateRendererDiagnostics();
      return;
    }
    renderSphere(container);
  }

  function _requestLayerStateUpdate(container, layer, enabled) {
    if (!container || !layer) return;
    _pendingLayerState = { ...(_pendingLayerState || {}), [layer]: !!enabled };
    _layerStateFlushContainer = container;
    if (_layerStateFlushRaf) return;
    _layerStateFlushRaf = requestAnimationFrame(_flushLayerStateUpdates);
  }

  function _resourceUrlForElement(el) {
    if (!el) return null;
    return el.currentSrc || el.src || el.data || el.href || null;
  }

  function _captureResourceFailure(el, reason = "resource-error") {
    if (!el || el.nodeType !== 1) return;
    const entry = {
      reason,
      tagName: String(el.tagName || "").toUpperCase(),
      id: el.id || null,
      className: el.className || "",
      src: _resourceUrlForElement(el),
      timestamp: Date.now(),
    };
    _resourceFailureLog.push(entry);
    if (_resourceFailureLog.length > 120) _resourceFailureLog.shift();
  }

  function _installResourceFailureTracker() {
    if (_resourceTrackerInstalled) return;
    _resourceTrackerInstalled = true;
    window.addEventListener("error", event => {
      const el = event?.target;
      if (!el || el.nodeType !== 1) return;
      const tag = String(el.tagName || "").toUpperCase();
      if (!["IMG", "PICTURE", "SOURCE", "OBJECT", "IFRAME", "EMBED", "VIDEO"].includes(tag)) return;
      _captureResourceFailure(el, "resource-load-failed");
    }, true);
  }

  function _inspectElementNode(node) {
    if (!node || node.nodeType !== 1) return null;
    const rect = node.getBoundingClientRect?.() || null;
    const style = window.getComputedStyle?.(node) || null;
    return {
      tagName: String(node.tagName || "").toLowerCase(),
      id: node.id || "",
      className: node.className || "",
      rect: rect ? {
        top: Number(rect.top || 0),
        left: Number(rect.left || 0),
        bottom: Number(rect.bottom || 0),
        right: Number(rect.right || 0),
        width: Number(rect.width || 0),
        height: Number(rect.height || 0),
      } : null,
      position: style?.position || "",
      zIndex: style?.zIndex || "",
      display: style?.display || "",
      visibility: style?.visibility || "",
      opacity: style?.opacity || "",
      overflow: style?.overflow || "",
      src: _resourceUrlForElement(node),
      complete: typeof node.complete === "boolean" ? node.complete : null,
      naturalWidth: Number(node.naturalWidth || 0) || null,
      naturalHeight: Number(node.naturalHeight || 0) || null,
      parentTagName: node.parentElement?.tagName?.toLowerCase?.() || null,
    };
  }

  function _collectBottomViewportDiagnostics(depthPx = 190) {
    const width = window.innerWidth || 0;
    const height = window.innerHeight || 0;
    if (!width || !height) return { viewport: { width, height }, bandTop: 0, matches: [], points: [] };
    const bandTop = Math.max(0, height - depthPx);
    const all = Array.from(document.querySelectorAll("*"));
    const matches = all
      .map(_inspectElementNode)
      .filter(Boolean)
      .filter(item => item.rect && item.rect.bottom >= bandTop && item.rect.top <= height && item.display !== "none" && item.visibility !== "hidden");
    const points = [0.25, 0.5, 0.75].flatMap(frac => {
      const x = Math.max(0, Math.min(width - 1, Math.round(width * frac)));
      return [20, 50].map(offset => {
        const y = Math.max(0, height - offset);
        const stack = (document.elementsFromPoint?.(x, y) || []).map(_inspectElementNode).filter(Boolean).slice(0, 10);
        return { x, y, stack };
      });
    });
    return { viewport: { width, height }, bandTop, matches: matches.slice(0, 240), points };
  }

  function _collectMediaDiagnostics(root = document) {
    const selectors = "img,picture source,object,iframe,embed,video,svg image";
    const nodes = Array.from(root.querySelectorAll?.(selectors) || []);
    return nodes.map(node => {
      const base = _inspectElementNode(node) || {};
      const failedImage = base.tagName === "img" && base.complete === true && Number(base.naturalWidth || 0) === 0;
      return { ...base, failedImage };
    });
  }

  function _collectFixedStickyDiagnostics() {
    const nodes = Array.from(document.querySelectorAll("*"));
    return nodes
      .map(node => _inspectElementNode(node))
      .filter(Boolean)
      .filter(item => item.position === "fixed" || item.position === "sticky")
      .slice(0, 240);
  }

  function _inspectSphereHostChildren() {
    const host = document.getElementById("sphere-container");
    if (!host) return [];
    return Array.from(host.children || []).map(_inspectElementNode).filter(Boolean);
  }

  function _collectRuntimeDebugSnapshot() {
    return {
      capturedAt: Date.now(),
      bottomViewport: _collectBottomViewportDiagnostics(190),
      fixedSticky: _collectFixedStickyDiagnostics(),
      media: _collectMediaDiagnostics(document),
      sphereHostChildren: _inspectSphereHostChildren(),
      failedResources: _resourceFailureLog.slice(0, 120),
    };
  }

  function _resolveEnvironmentLifecycle(state) {
    if (!state) return "idle";
    if (state.status === "loading") return "loading";
    if (state.reason === "location-not-set" || state.providerConfigured === false) return "location-needed";
    if (state.status === "cached") return "cached";
    if (state.stale) return "stale";
    if (state.status === "available") return "ready";
    if (state.status === "unavailable") return "unavailable";
    if (state.status === "error" || state.reason === "provider-error") return "error";
    return "idle";
  }

  function _incrementActionCounter(counterKey, amount = 1) {
    if (!_state.actionCounters || typeof _state.actionCounters !== "object") {
      _state.actionCounters = {};
    }
    _state.actionCounters[counterKey] = Number(_state.actionCounters[counterKey] || 0) + amount;
    return _state.actionCounters[counterKey];
  }

  function _recordActionTrace(action, statePatch, subsystemsUpdated) {
    const entry = Object.freeze({
      at: Date.now(),
      action: String(action || "unknown"),
      statePatch: statePatch && typeof statePatch === "object" ? Object.assign({}, statePatch) : null,
      subsystemsUpdated: Array.isArray(subsystemsUpdated) ? subsystemsUpdated.slice(0, 12) : [],
    });
    _state.actionTrace.push(entry);
    if (_state.actionTrace.length > 200) _state.actionTrace.shift();
    if (globalThis.__SOF_DEBUG_ACTION_TRACE__) {
      console.debug("[LivingTimeSphere][TRACE]", `${entry.action} ->`, entry.statePatch || "no state patch", "->", entry.subsystemsUpdated.join(", "));
    }
  }

  function _captureClassListSnapshot() {
    const classList = node => (node?.classList ? Array.from(node.classList).sort() : []);
    return {
      body: classList(document.body),
      html: classList(document.documentElement),
      observatory: classList(document.querySelector(".sphere-stage")),
      sphereContainer: classList(document.getElementById("sphere-container")),
      overlays: Array.from(document.querySelectorAll("[class*='overlay'],[class*='backdrop'],[class*='modal'],[class*='dim']"))
        .map(node => ({
          tagName: String(node.tagName || "").toLowerCase(),
          id: node.id || "",
          className: node.className || "",
        }))
        .slice(0, 20),
    };
  }

  function _captureComputedStyleSnapshot() {
    const pick = node => {
      if (!node || !window.getComputedStyle) return null;
      const style = window.getComputedStyle(node);
      return {
        opacity: style.opacity,
        filter: style.filter,
        backdropFilter: style.backdropFilter,
        visibility: style.visibility,
        pointerEvents: style.pointerEvents,
        zIndex: style.zIndex,
        background: style.background,
        mixBlendMode: style.mixBlendMode,
      };
    };
    return {
      body: pick(document.body),
      main: pick(document.querySelector("main")),
      observatoryWrapper: pick(document.querySelector(".sphere-stage")),
      sphereContainer: pick(document.getElementById("sphere-container")),
      rendererHost: pick(document.querySelector(".sphere-visual-shell")),
    };
  }

  function _findFirstEnvironmentFocusable(locationPanel) {
    if (!locationPanel) return null;
    return locationPanel.querySelector(
      "[data-location-use-device], [data-location-search-input], [data-location-search-submit], [data-location-lat], [data-location-lon], [data-location-continue-without], button, input, select, textarea, a[href]"
    );
  }

  function _focusEnvironmentControls() {
    const locationPanel = document.querySelector("[data-sof-location-command]");
    if (!locationPanel) return;
    const beforeClasses = _captureClassListSnapshot();
    const beforeStyles = _captureComputedStyleSnapshot();
    locationPanel.open = true;
    locationPanel.classList?.add?.(ENV_FOCUS_PULSE_CLASS);
    if (locationPanel?.scrollIntoView) {
      locationPanel.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }
    const firstControl = _findFirstEnvironmentFocusable(locationPanel);
    if (firstControl?.focus) firstControl.focus({ preventScroll: true });
    setTimeout(() => {
      locationPanel.classList?.remove?.(ENV_FOCUS_PULSE_CLASS);
    }, 900);
    _incrementActionCounter("environmentFocusCount");
    const afterClasses = _captureClassListSnapshot();
    const afterStyles = _captureComputedStyleSnapshot();
    _state.lastEnvironmentFocusDiagnostics = Object.freeze({
      at: Date.now(),
      beforeClasses,
      afterClasses,
      beforeStyles,
      afterStyles,
      focusedElement: document.activeElement ? {
        tagName: String(document.activeElement.tagName || "").toLowerCase(),
        id: document.activeElement.id || "",
        className: document.activeElement.className || "",
      } : null,
    });
    _recordActionTrace("FOCUS_ENVIRONMENT", null, ["dom-scroll", "dom-focus"]);
  }

  function _setRendererLifecycle(next) {
    _state.rendererLifecycle = next;
  }

  function _clearAutoRetry() {
    if (_state._autoRetryTimer) {
      clearTimeout(_state._autoRetryTimer);
      _state._autoRetryTimer = 0;
    }
  }

  function _scheduleRetry(container, reason) {
    if (!container || _state.retryCount >= 2 || _state._autoRetryTimer) return;
    if (_state.requestedRendererMode === "svg" || _state.requestedRendererMode === "canvas" || _state.requestedRendererMode === "table" || _state.requestedRendererMode === "text") return;
    const delay = _state.retryCount === 0 ? 180 : 900;
    _state.retryCount += 1;
    _setRendererLifecycle("recovering");
    _state.activeRendererMode = "recovering";
    _state._autoRetryTimer = setTimeout(() => {
      _state._autoRetryTimer = 0;
      _state._3dInitInProgress = false;
      renderSphere(container);
    }, delay);
    console.warn(`[LivingTimeSphere] Scheduled renderer retry #${_state.retryCount} (${reason}) in ${delay}ms.`);
  }

  function _updateLastRenderTimestamp() {
    const ts = Number(globalThis.LivingTimeSphereRenderer3d?.getDiagnostics?.()?.lastRenderTimestamp || 0);
    if (ts > 0) _state.lastRenderTimestamp = ts;
  }

  function _watchForBlankCanvas(container) {
    setTimeout(() => {
      if (!container || _state.requestedRendererMode === "svg" || _state.rendererLifecycle === "failed") return;
      const renderer = globalThis.LivingTimeSphereRenderer3d;
      if (!renderer?.isInitialized?.()) return;
      const diag = renderer.getDiagnostics?.() || {};
      const hasCanvas = Number(diag.canvasWidth || 0) > 0 && Number(diag.canvasHeight || 0) > 0;
      const firstFrame = diag.stageState?.firstFrame === "rendered";
      if (hasCanvas && !firstFrame) {
        _setRendererLifecycle("recovering");
        renderer.requestSingleRender?.();
        _scheduleRetry(container, "blank-canvas-watchdog");
      }
    }, 1200);
  }

  function _bindRecoveryHooks(container) {
    if (_state._recoveryHooksBound) return;
    _state._recoveryHooksBound = true;
    window.addEventListener("pageshow", event => {
      if (!container?.isConnected) return;
      if (event?.persisted) _setRendererLifecycle("recovering");
      renderSphere(container);
    });
    window.addEventListener("pagehide", () => {
      _clearAutoRetry();
    });
    document.addEventListener("visibilitychange", () => {
      if (!container?.isConnected || document.hidden) return;
      const renderer = globalThis.LivingTimeSphereRenderer3d;
      if (_state.active3d && renderer?.isInitialized?.()) renderer.requestSingleRender?.();
      renderSphere(container);
    });
    window.addEventListener("orientationchange", () => {
      if (!container?.isConnected) return;
      setTimeout(() => renderSphere(container), 120);
    });
  }

  // ── Quality resolution ─────────────────────────────────────────────

  function resolveQualityPreset() {
    const mat = globalThis.LivingTimeSphereM;
    if (!mat) return null;
    const q = _state.quality;
    if (q === "svgonly" || _state.requestedRendererMode === "svg" ||
        _state.requestedRendererMode === "canvas" ||
        _state.requestedRendererMode === "table" || _state.requestedRendererMode === "text") return null;
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
    if (_state.requestedRendererMode === "svg" || _state.requestedRendererMode === "canvas" || _state.requestedRendererMode === "table" || _state.requestedRendererMode === "text") return false;
    if (_state.quality === "svgonly") return false;
    if (!globalThis.LivingTimeSphereRenderer3d || !globalThis.LivingTimeSphereM || !globalThis.LivingTimeSphereEffects) return false;
    if (!globalThis.LivingTimeSphereEffects.detectWebGl()) return false;
    return _state.requestedRendererMode === "3d" || _state.requestedRendererMode === "auto";
  }

  // ── Container helpers ──────────────────────────────────────────────

  function getContainerSize(container) {
    if (typeof window === "undefined") return { w: 320, h: 320 };
    const rect = container.getBoundingClientRect();
    return { w: Math.max(rect.width  || 320, 100), h: Math.max(rect.height || 320, 100) };
  }

  async function _waitForValidContainer(container, { minWidth = 180, minHeight = 180, timeoutMs = 2500 } = {}) {
    const valid = () => {
      if (!container?.isConnected) return false;
      const style = typeof getComputedStyle === "function" ? getComputedStyle(container) : null;
      if (style && (style.display === "none" || style.visibility === "hidden")) return false;
      const rect = container?.getBoundingClientRect?.() || {};
      return Number(rect.width) >= minWidth && Number(rect.height) >= minHeight;
    };
    if (valid()) return true;
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      if (valid()) return true;
    }
    return false;
  }

  function _withTimeout(promise, timeoutMs, timeoutReason = "INIT_TIMEOUT") {
    let timer = null;
    const timeoutPromise = new Promise(resolve => {
      timer = setTimeout(() => resolve({
        success: false,
        reason: timeoutReason,
        detail: `3D initialization exceeded ${timeoutMs}ms`,
      }), timeoutMs);
    });
    return Promise.race([
      promise,
      timeoutPromise
    ]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  }

  function buildCurrentModel() {
    return _buildModelForMode(_state.viewMode);
  }

  function _buildModelForMode(mode) {
    const opts = { year: _state.year, timeZone: _state.timeZone, boundaryMode: _state.boundaryMode, manualSunset: _state.manualSunset };
    const baseModel = globalThis.LivingTimeSphereModel.buildYearModel(opts);
    const model = _decorateModel(baseModel);
    const selected = model?.selectedPatternPosition || null;
    const today = model?.todayPatternPosition || null;
    const dayOfYear = selected?.dayOfPatternYear ?? today?.dayOfPatternYear ?? null;
    if (dayOfYear != null) {
      model.currentPatternAngle = globalThis.LivingTimeSphereModel.patternAngleForDayOfYear(dayOfYear);
    }
    model.viewMode = mode || _state.viewMode;
    return model;
  }

  function _spiralCacheKey() {
    return `${_state.timeZone}|${_state.boundaryMode}|${_state.manualSunset}|${_state.year}`;
  }

  function _getCachedSpiral() {
    const key = _spiralCacheKey();
    if (!_state._spiralCache || _state._spiralCacheKey !== key) {
      _state._spiralCache = globalThis.LivingTimeSphereModel.buildSpiral({
        timeZone: _state.timeZone,
        boundaryMode: _state.boundaryMode,
        manualSunset: _state.manualSunset,
      });
      _state._spiralCacheKey = key;
    }
    return _state._spiralCache;
  }

  function _modeReadiness(mode, model, spiral) {
    const patternReady = !!(model?.moonSectors?.length >= 13);
    const spiralReady = !!(spiral?.years?.length);
    const passageReady = !!(model?.passage && Number.isFinite(Number(model.passage.startAngle)) && Number.isFinite(Number(model.passage.endAngle)));
    const cameraFitReady = !!globalThis.LivingTimeSphereCamera?.MODE_POSITIONS?.[mode || "today"];
    let ready = patternReady && cameraFitReady;
    if (mode === "years") ready = ready && spiralReady;
    if (mode === "passage") ready = ready && passageReady;
    return {
      ready: !!ready,
      patternReady,
      spiralReady,
      passageReady,
      cameraFitReady,
    };
  }

  function _recordModeTransitionMetric(metric) {
    _state.modeTransitionMetrics.push(metric);
    if (_state.modeTransitionMetrics.length > 120) _state.modeTransitionMetrics.shift();
  }

  function _flushViewModeTransitions(container) {
    if (!container || _state.modeTransitionInFlight) return;
    _state.modeTransitionInFlight = true;
    while (_state.latestRequestedMode) {
      const targetMode = _state.latestRequestedMode;
      _state.latestRequestedMode = null;
      const revision = ++_state.modeTransitionRevision;
      const startedAt = performance.now();
      const previousMode = _state.viewMode;
      _state.modeTransitionState = "preparing";
      _state.requestedViewMode = targetMode;
      _state.modeTransitionFailure = null;

      let model = null;
      let spiral = null;
      let readiness = null;
      try {
        model = _buildModelForMode(targetMode);
        spiral = _getCachedSpiral();
        readiness = _modeReadiness(targetMode, model, spiral);
      } catch (error) {
        readiness = { ready: false, patternReady: false, spiralReady: false, passageReady: false, cameraFitReady: false, error: String(error?.message || error || "mode-prepare-failed") };
      }

      if (_state.latestRequestedMode && _state.latestRequestedMode !== targetMode) {
        _recordModeTransitionMetric({
          revision,
          requestedViewMode: targetMode,
          previousViewMode: previousMode,
          activeViewMode: _state.viewMode,
          modeTransitionState: "stale-discarded",
          durationMs: Number((performance.now() - startedAt).toFixed(2)),
          readiness: readiness || null,
        });
        continue;
      }

      if (!readiness?.ready) {
        _state.modeTransitionState = "failed";
        _state.modeTransitionFailure = Object.freeze({
          revision,
          requestedViewMode: targetMode,
          activeViewMode: _state.viewMode,
          readiness: readiness || null,
          at: Date.now(),
        });
        _state.lastModeTransitionDuration = Number((performance.now() - startedAt).toFixed(2));
        _recordModeTransitionMetric({
          revision,
          requestedViewMode: targetMode,
          previousViewMode: previousMode,
          activeViewMode: _state.viewMode,
          modeTransitionState: "failed-readiness",
          durationMs: _state.lastModeTransitionDuration,
          readiness: readiness || null,
        });
        continue;
      }

      _state.modeTransitionState = "committing";
      _state.previousViewMode = previousMode;
      _state.viewMode = targetMode;
      _state.activeViewMode = targetMode;
      _setModeDefaultSelectedMarker(targetMode);
      _syncModeButtons();
      if (_state.active3d) globalThis.LivingTimeSphereRenderer3d?.setMode(targetMode);
      renderSphere(container);
      _incrementActionCounter("modeUpdateCount");
      _recordActionTrace("VIEW_MODE_CHANGE", { viewMode: targetMode }, ["mode", "camera", "render"]);
      _state.modeTransitionState = "active";
      _state.lastModeTransitionDuration = Number((performance.now() - startedAt).toFixed(2));
      _recordModeTransitionMetric({
        revision,
        requestedViewMode: targetMode,
        previousViewMode: previousMode,
        activeViewMode: _state.viewMode,
        modeTransitionState: "applied",
        durationMs: _state.lastModeTransitionDuration,
        readiness,
      });
    }
    _state.modeTransitionInFlight = false;
    if (_state.modeTransitionState !== "failed") _state.modeTransitionState = "idle";
  }

  function _requestViewModeTransition(container, mode) {
    const normalized = ["today", "pattern", "years", "passage"].includes(mode) ? mode : "today";
    _state.requestedViewMode = normalized;
    _state.latestRequestedMode = normalized;
    _flushViewModeTransitions(container);
  }

  function _readLocalSetting(key) {
    try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
  }

  function _writeLocalSetting(key, value) {
    try { globalThis.localStorage?.setItem(key, value); } catch { /* ignore */ }
  }

  function _resolveMoonLabelMode() {
    const stored = _readLocalSetting(MOON_LABEL_MODE_KEY);
    if (stored === "contextual") return "balanced";
    if (stored === "selected") return "essential";
    if (stored === "hidden") return "none";
    if (stored === "essential" || stored === "balanced" || stored === "all" || stored === "none") {
      return stored;
    }
    if (typeof window !== "undefined" && window.innerWidth < 640) return "essential";
    return _state.moonLabelMode || "balanced";
  }

  function _resolveMoonLabelDistance() {
    if (typeof window !== "undefined" && window.innerWidth < 640) return "tight";
    return _state.moonLabelDistance || "standard";
  }

  function _pad(value) {
    return String(value).padStart(2, "0");
  }

  function _toIso(date) {
    return `${date.getUTCFullYear()}-${_pad(date.getUTCMonth() + 1)}-${_pad(date.getUTCDate())}`;
  }

  function _windBearingLabel(deg) {
    if (!Number.isFinite(deg)) return "";
    const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    return dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
  }

  function _formatTemperature(value, units = "fahrenheit") {
    if (!Number.isFinite(value)) return "Location required";
    if (units === "celsius") return `${Math.round(value)}°C`;
    return `${Math.round(value * 9 / 5 + 32)}°F`;
  }

  function _formatDurationHours(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return "Location required";
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return `${h}h ${String(m).padStart(2, "0")}m`;
  }

  function _classifyActiveDate(selected, weather, nowDate = new Date()) {
    const currentIso = _toIso(nowDate);
    const selectedIso = selected?.effectiveDate || selected?.civilDate || currentIso;
    if (_state.fieldRange === "now" || _state.fieldRange === "today" || selected?.isToday || selectedIso === currentIso) {
      return { kind: "current", label: "LIVE CURRENT" };
    }
    const dailyTimes = Array.isArray(weather?.daily?.time) ? weather.daily.time : [];
    if (dailyTimes.includes(selectedIso)) {
      const cmp = selectedIso.localeCompare(currentIso);
      if (cmp > 0) return { kind: "forecast", label: "FORECAST" };
      if (cmp < 0) return { kind: "historical-forecast", label: "HISTORICAL FORECAST" };
    }
    const selectedYear = Number(String(selectedIso || "").slice(0, 4));
    if (Number.isFinite(selectedYear) && selectedYear >= 1940) {
      return { kind: "reanalysis", label: "REANALYSIS" };
    }
    return { kind: "historical-unsupported", label: "UNAVAILABLE" };
  }

  function _patternDateFromDayOfYear(year, dayOfYear) {
    const epoch = globalThis.PatternCalendar?.epochForYear?.(year);
    if (!epoch) return null;
    return new Date(epoch.getTime() + (Math.max(1, Math.min(364, dayOfYear || 1)) - 1) * DAY_MS);
  }

  function _currentSnapshot() {
    return globalThis.LivingTimeSphereLiveData?.getSnapshot?.({
      timeZone: _state.timeZone,
      boundaryMode: _state.boundaryMode,
      manualSunset: _state.manualSunset,
    }) || null;
  }

  function _resolveSelectedDayOfYear(baseModel) {
    const live = _currentSnapshot();
    const todayPatternYear = live?.pattern?.patternYear ?? baseModel?.todayPatternPosition?.patternYear ?? null;
    const todayDay = live?.pattern?.dayOfPatternYear ?? baseModel?.todayPatternPosition?.dayOfPatternYear ?? null;

    if (_state.selectedDayOfYear == null) {
      _state.selectedDayOfYear = todayDay || baseModel?.todayPatternPosition?.dayOfPatternYear || 1;
    }

    _state.selectedDayOfYear = Math.max(1, Math.min(364, Number(_state.selectedDayOfYear) || 1));
    _persistSelectedState();
    return _state.selectedDayOfYear;
  }

  function _resolveSelectedPatternPosition(baseModel) {
    const dayOfYear = _resolveSelectedDayOfYear(baseModel);
    const effectiveDate = _patternDateFromDayOfYear(_state.year, dayOfYear);
    let selected = null;
    if (effectiveDate && globalThis.PatternCalendar?.convertEffectiveDate) {
      const conversion = globalThis.PatternCalendar.convertEffectiveDate(effectiveDate);
      if (conversion?.inside) {
        selected = {
          ...conversion,
          moonName: conversion.moonName || null,
          civilDate: _toIso(effectiveDate),
          effectiveDate: _toIso(effectiveDate),
          civilDateObject: new Date(effectiveDate),
          effectiveDateObject: new Date(effectiveDate),
          boundaryMode: _state.boundaryMode,
          timeZone: _state.timeZone,
          sunsetTime: _state.manualSunset,
          afterBoundary: false,
          conversionMode: "fixed-epoch-arithmetic",
        };
      }
    } else if (effectiveDate && globalThis.PatternCalendar?.fromCivilDate) {
      selected = globalThis.PatternCalendar.fromCivilDate({
        date: effectiveDate,
        timeZone: _state.timeZone,
        boundaryMode: _state.boundaryMode,
        sunsetTime: _state.manualSunset,
      });
    }
    const dayArchetype = Array.isArray(selected?.dayArchetype) ? selected.dayArchetype : [selected?.dayArchetype || null, ""];
    const weekGate = selected?.weekOfMoon
      ? globalThis.PatternCalendarData?.weekGates?.[selected.weekOfMoon - 1] || null
      : null;
    const moonData = selected?.moon != null
      ? globalThis.PatternCalendarData?.moons?.[selected.moon - 1] || null
      : null;
    const phase = globalThis.SOFCalendar?.getMoonPhase?.(_toIso(effectiveDate)) || null;
    const lunarCyclePosition = typeof phase?.age === "number"
      ? Number((((phase.age % 29.530588853) + 29.530588853) % 29.530588853 / 29.530588853).toFixed(6))
      : null;
    const live = _currentSnapshot();
    const isToday = selected?.patternYear === live?.pattern?.patternYear
      && selected?.dayOfPatternYear != null
      && selected.dayOfPatternYear === live?.pattern?.dayOfPatternYear;
    const solar = globalThis.LivingTimeSphereLiveData?.getSnapshot?.({
      asOf: effectiveDate,
      timeZone: _state.timeZone,
      boundaryMode: _state.boundaryMode,
      manualSunset: _state.manualSunset,
    })?.solar || live?.solar || null;

    return selected ? {
      ...selected,
      effectiveDate: _toIso(effectiveDate),
      civilDate: _toIso(effectiveDate),
      dateObject: effectiveDate,
      type: "living-day",
      weekGate,
      moonData,
      daySeal: dayArchetype[0] || "Unavailable",
      daySealMeaning: dayArchetype[1] || "Unavailable",
      shabbat: selected.day != null && SHABBAT_DAYS.has(selected.day),
      dayOfWeekPosition: selected.day != null ? ((selected.day - 1) % 7) + 1 : null,
      gateStatus: selected.dayOfPatternYear == null
        ? (selected.isDayOutOfTime ? "day-out-of-time" : (selected.isDeepTimeDay ? "deep-time-day" : "outside-counted-year"))
        : (selected.day != null && SHABBAT_DAYS.has(selected.day)
          ? "shabbat-gate"
          : (((selected.day - 1) % 7) + 1 === 6 ? "preparation-gate" : ((((selected.day - 1) % 7) + 1 === 1 ? "return-gate" : "ordinary-day")))),
      lunarPhase: phase ? phase.name : (isToday ? live?.lunar?.phaseName : null),
      lunarIllumination: phase && typeof phase.illumination === "number"
        ? Number((phase.illumination * 100).toFixed(1))
        : (isToday ? live?.lunar?.illuminationPercent ?? null : null),
      lunarCyclePosition,
      solar,
      isToday,
      witnessPrompt: moonData?.practice || dayArchetype[1] || "Observe the day and record what is actually there.",
      shortMirror: moonData?.essence || "Mirror summary unavailable for this day.",
    } : null;
  }

  function _decorateModel(baseModel) {
    const live = _currentSnapshot();
    const environmentState = globalThis.SofEnvironmentState?.getEnvironmentState?.() || null;
    const selected = _resolveSelectedPatternPosition(baseModel);
    const activeMoon = selected?.moon ?? live?.pattern?.moon ?? baseModel?.todayPatternPosition?.moon ?? baseModel?.sourceRecord?.equinox?.patternPosition?.moon ?? 1;
    return {
      ...baseModel,
      selectedPatternPosition: selected,
      environmentSnapshot: environmentState,
      todayPatternPosition: live?.todayModel?.todayPatternPosition || baseModel?.todayPatternPosition || null,
      moonSectors: Array.isArray(baseModel?.moonSectors)
        ? baseModel.moonSectors.map(sector => ({ ...sector, active: sector.moonNumber === activeMoon }))
        : [],
    };
  }

  function _selectedDaySummary(selected) {
    if (!selected?.moon) return "Selected — Unavailable";
    return `${selected.isToday ? "Today" : "Selected"} — Moon ${selected.moon} · Day ${selected.day} · Day ${selected.dayOfPatternYear}/364`;
  }

  function _escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function _titleCaseWords(value) {
    return String(value || "")
      .split(/\s+/)
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  function _pluralize(count, singular, plural) {
    return `${count} ${count === 1 ? singular : plural}`;
  }

  function _formatLocalInstant(value) {
    if (!value) return "Not recorded";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "Not recorded";
    try {
      return date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return date.toISOString();
    }
  }

  function _formatFreshness(value, now) {
    if (!value) return "Not checked";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "Not checked";
    const diffMs = Math.max(0, (now instanceof Date ? now : new Date(now)).getTime() - date.getTime());
    const diffMinutes = Math.round(diffMs / 60000);
    if (diffMinutes <= 1) return "Just updated";
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 48) return `${diffHours} h ago`;
    return `${Math.round(diffHours / 24)} d ago`;
  }

  function _readLocalJson(key) {
    try {
      const raw = globalThis.localStorage?.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function _selectedDayFromMarker(marker) {
    const value = String(marker || "");
    const dayMatch = /^day-(\d+)$/.exec(value);
    if (dayMatch) return Math.max(1, Math.min(364, Number(dayMatch[1]) || 1));
    const moonMatch = /^moon-(\d+)$/.exec(value);
    if (moonMatch) {
      const moon = Math.max(1, Math.min(13, Number(moonMatch[1]) || 1));
      return (moon - 1) * 28 + 1;
    }
    return null;
  }

  function _readSelectedState() {
    return _readLocalJson(SELECTED_STATE_KEY);
  }

  function _persistSelectedState() {
    try {
      globalThis.localStorage?.setItem(SELECTED_STATE_KEY, JSON.stringify({
        selectedDayOfYear: _state.selectedDayOfYear,
        selectedMarker: _state.selectedMarker,
        year: _state.year,
      }));
    } catch {
      // ignore storage failures
    }
  }

  function _restoreSelectedStateIfNeeded() {
    if (_state.selectedDayOfYear != null) return;
    const saved = _readSelectedState();
    if (!saved || typeof saved !== "object") return;
    const day = Number(saved.selectedDayOfYear);
    if (Number.isFinite(day)) {
      _state.selectedDayOfYear = Math.max(1, Math.min(364, day));
    }
    if (!_state.selectedMarker && typeof saved.selectedMarker === "string") {
      _state.selectedMarker = saved.selectedMarker;
    }
    if (!Number.isFinite(Number(_state.year)) && Number.isFinite(Number(saved.year))) {
      _state.year = Number(saved.year);
    }
  }

  function _readMoonLogs() {
    const current = _readLocalJson(MOON_LOG_KEY);
    if (Array.isArray(current)) return current;
    const legacy = _readLocalJson(LEGACY_MOON_LOG_KEY);
    return Array.isArray(legacy) ? legacy : [];
  }

  function _buildMoonsLink(selected, hash = "") {
    const params = new URLSearchParams();
    if (selected?.effectiveDate) params.set("date", selected.effectiveDate);
    if (_state.timeZone) params.set("tz", _state.timeZone);
    if (_state.boundaryMode) params.set("boundary", _state.boundaryMode);
    if (_state.manualSunset) params.set("sunset", _state.manualSunset);
    const query = params.toString();
    return `moons.html${query ? `?${query}` : ""}${hash}`;
  }

  function _buildAlignmentLink(mode = "recurrence") {
    if (globalThis.AlignmentUrlState?.buildAlignmentShareLink) {
      return globalThis.AlignmentUrlState.buildAlignmentShareLink({
        baseUrl: typeof location !== "undefined" ? `${location.origin}${location.pathname.replace("living-time-sphere.html", "alignment-ledger.html")}` : "https://codexofreality.org/alignment-ledger.html",
        year: _state.year,
        timeZone: _state.timeZone,
        boundaryMode: _state.boundaryMode,
        manualSunset: _state.manualSunset,
        mode,
        datasetVersion: _state.datasetVersion || globalThis.LivingTimeSphereVersion?.version,
      });
    }
    return `alignment-ledger.html?year=${encodeURIComponent(_state.year)}&mode=${encodeURIComponent(mode)}`;
  }

  function _syncLayerCheckboxes() {
    _syncingLayerControls = true;
    Object.keys(_state.visibleLayers).forEach(layer => {
      const cb = document.getElementById(`sphere-layer-${layer}`);
      if (cb) cb.checked = !!_state.visibleLayers[layer];
    });
    _syncingLayerControls = false;
  }

  function _clampPatternDay(day) {
    return Math.max(1, Math.min(364, Number(day) || 1));
  }

  function _syncDaySelectorsFromModel(model) {
    const moonSel = document.getElementById("sphere-select-moon");
    const daySel = document.getElementById("sphere-select-day");
    if (!moonSel || !daySel) return;
    if (!moonSel.options.length) {
      moonSel.innerHTML = Array.from({ length: 13 }, (_, index) => `<option value="${index + 1}">Moon ${index + 1}</option>`).join("");
    }
    if (!daySel.options.length) {
      daySel.innerHTML = Array.from({ length: 28 }, (_, index) => `<option value="${index + 1}">Day ${index + 1}</option>`).join("");
    }
    const selected = model?.selectedPatternPosition || _resolveSelectedPatternPosition(model || buildCurrentModel());
    moonSel.value = String(selected?.moon || 1);
    daySel.value = String(selected?.day || 1);
  }

  function _setDayNavDisabled(disabled) {
    ["sphere-prev-day", "sphere-next-day"].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.setAttribute("aria-busy", disabled ? "true" : "false");
    });
  }

  function _updateSphereUrlFromModel(model, { replace = true } = {}) {
    if (typeof window === "undefined" || !globalThis.LivingTimeSphereUrlState?.buildSphereUrl) return;
    const selected = model?.selectedPatternPosition || null;
    const cameraState = globalThis.LivingTimeSphereCamera?.getState?.() || {};
    const marker = selected?.dayOfPatternYear ? `day-${selected.dayOfPatternYear}` : (_state.selectedMarker || null);
    const url = globalThis.LivingTimeSphereUrlState.buildSphereUrl({
      baseUrl: location.href,
      year: _state.year,
      viewMode: _state.viewMode,
      layers: Object.keys(_state.visibleLayers).filter(key => _state.visibleLayers[key]),
      marker,
      timeZone: _state.timeZone,
      boundaryMode: _state.boundaryMode,
      manualSunset: _state.manualSunset,
      datasetVersion: _state.datasetVersion || globalThis.LivingTimeSphereVersion?.version || null,
      source: _state.source || null,
      renderer: _state.requestedRendererMode === "auto" ? null : _state.requestedRendererMode,
      quality: _state.quality === "auto" ? null : _state.quality,
      cameraTheta: Number.isFinite(Number(cameraState.theta)) ? Number(cameraState.theta) : null,
      cameraDist: Number.isFinite(Number(cameraState.dist)) ? Number(cameraState.dist) : null,
      connectionMode: _state.connectionMode,
      motionMode: _state.motionMode,
      moonLabelDistance: _state.moonLabelDistance,
      dayLabelMode: _state.dayLabelMode,
      preserveUnknownParams: true,
      hash: location.hash || "",
    });
    if (replace) window.history.replaceState({ marker, day: selected?.dayOfPatternYear || null }, "", url);
    else window.history.pushState({ marker, day: selected?.dayOfPatternYear || null }, "", url);
    _state.currentUrl = String(url || location.href || "");
    _state.urlIntegrity = _evaluateDeepLinkIntegrity(_state.initialUrl, _state.currentUrl);
  }

  function _mappedLayerVisible(layerId) {
    if (!layerId) return false;
    if (Array.isArray(layerId)) return layerId.some(item => _mappedLayerVisible(item));
    return !!_state.visibleLayers[layerId];
  }

  function _setMappedLayer(layerId, enabled) {
    if (!layerId) return;
    if (Array.isArray(layerId)) {
      layerId.forEach(item => _setMappedLayer(item, enabled));
      return;
    }
    if (Object.prototype.hasOwnProperty.call(_state.visibleLayers, layerId)) {
      _state.visibleLayers[layerId] = enabled;
    }
  }

  function _applyFieldRangePreset(range) {
    const live = _currentSnapshot();
    _state.fieldRange = FIELD_RANGE_LABELS[range] ? range : "now";
    switch (_state.fieldRange) {
      case "today":
      case "now":
        if (live?.pattern?.patternYear === _state.year && live?.pattern?.dayOfPatternYear) {
          _state.selectedDayOfYear = live.pattern.dayOfPatternYear;
          _state.selectedMarker = "today";
        }
        break;
      case "pattern-week":
        _state.selectedMarker = _state.selectedMarker || "today";
        break;
      case "pattern-moon":
        _state.selectedMarker = _state.selectedMarker || "today";
        break;
      case "pattern-year":
        _state.selectedMarker = _state.selectedMarker || `year-${_state.year}`;
        break;
      case "historical":
        _state.selectedMarker = _state.selectedMarker || `year-${_state.year}`;
        break;
      default:
        break;
    }
    _recordActionTrace("SELECTED_SCOPE_CHANGE", { fieldRange: _state.fieldRange }, ["selected-scope"]);
    _state.layerStateSource = "user-customized";
    _state.userCustomizedLayers = true;
  }

  function _syncFieldRangeButtons() {
    Object.keys(FIELD_RANGE_LABELS).forEach(range => {
      const btn = document.getElementById(`sphere-field-range-${range}`);
      if (btn) btn.setAttribute("aria-pressed", range === _state.fieldRange ? "true" : "false");
    });
  }

  function _resolveSavedObservation(selected) {
    const logs = _readMoonLogs();
    if (!logs.length) return null;
    const targetDate = selected?.effectiveDate || selected?.civilDate || "";
    return logs.find(entry => (entry?.effectiveDate || entry?.date) === targetDate)
      || (selected?.isToday ? logs[0] : null);
  }

  function _buildFieldLayerSnapshot(selected, model) {
    const live = _currentSnapshot();
    const now = new Date(live?.instant || Date.now());
    const yearRecord = model?.sourceRecord || live?.yearModel?.sourceRecord || null;
    const memory = globalThis.CodexMemory?.getState?.() || null;
    const observation = _resolveSavedObservation(selected);
    const witnessCount = Number(live?.witness?.count || 0);
    const recurrence = Array.isArray(live?.history?.recurrences) ? live.history.recurrences[0] : null;
    const weather = live?.weather || null;
    const environmentState = globalThis.SofEnvironmentState?.getEnvironmentState?.() || null;
    const environmentClassification = environmentState?.classification || null;
    const providerConfigured = !!weather?.providerConfigured;
    const environmentSource = providerConfigured ? (weather?.source || "Open-Meteo") : "No provider configured";
    const weatherTimestamp = weather?.updatedAt || "";
    const weatherFreshness = weather?.freshness?.label || "Not checked";
    const dateClass = _classifyActiveDate(selected, weather, now);
    const canUseLiveWeather = providerConfigured && (dateClass.kind === "current" || dateClass.kind === "forecast" || dateClass.kind === "historical-forecast");
    const weatherDisplayState = environmentClassification
      || (canUseLiveWeather ? (weather?.freshness?.stale ? "CACHED" : "LIVE WEATHER") : "UNAVAILABLE");
    const weatherUnavailableReason = !providerConfigured
      ? "Set location"
      : (dateClass.kind === "historical-unsupported"
        ? "Unavailable for unsupported historical date"
        : dateClass.kind === "reanalysis"
          ? "Reanalysis not configured"
          : "Unavailable for this selected historical day");
    const daylightState = selected?.afterBoundary
      ? `After ${_state.boundaryMode === "midnight" ? "midnight" : "boundary"}`
      : `Before ${_state.boundaryMode === "midnight" ? "midnight" : "boundary"}`;
    const bodySignalValue = [observation?.body, observation?.emotion].filter(Boolean).join(" · ");
    const patternTagValue = memory?.dailyIntention?.value
      ? _titleCaseWords(memory.dailyIntention.value)
      : (observation?.signs || "").trim();
    const recurrenceMissing = [];
    if (!providerConfigured) recurrenceMissing.push("weather");
    if (!witnessCount) recurrenceMissing.push("witness records");
    const recurrenceCompared = [
      "Pattern position",
      "Equinox angle",
      "Passage duration",
      "lunar state",
    ];
    const basePatternRelation = selected?.moon != null
      ? `Selected Pattern Day: Moon ${selected.moon} · Day ${selected.day}`
      : "Selected Pattern Day is outside the counted year";
    const historicalAvailability = recurrence
      ? `${recurrence.year} · ${Math.round(recurrence.overallSimilarityScore * 100)}%`
      : "Not available";
    const selectedWeek = selected?.weekOfMoon || (selected?.day ? Math.floor((selected.day - 1) / 7) + 1 : null);
    const personalFieldCount = [bodySignalValue, patternTagValue].filter(Boolean).length;
    const summaryItems = ["Pattern", "Lunar", "Passage", "Local boundary"];
    if (personalFieldCount) summaryItems.push(`${personalFieldCount} personal ${personalFieldCount === 1 ? "field" : "fields"}`);
    if (providerConfigured) summaryItems.push("Environment");
    if (!providerConfigured) summaryItems.push("Set location");

    const fields = [
      {
        id: "weather",
        label: "Weather",
        value: canUseLiveWeather
          ? (weather?.current?.condition || weather?.statusLabel || "Live observation")
          : weatherDisplayState,
        status: weatherDisplayState,
        source: environmentSource,
        timestamp: weatherTimestamp,
        freshness: weatherFreshness,
        availability: providerConfigured
          ? "Live provider is available for current-day context."
          : "Location is required before weather can be checked.",
        relation: canUseLiveWeather
          ? `Weather is attached to ${dateClass.label.toLowerCase()}.`
          : "Live weather is never attached to older selected Pattern days.",
        layerId: "environment",
        sphereLabel: "Environmental shell",
        visibleOnSphere: _mappedLayerVisible("environment"),
        comparison: "Not available",
        hierarchy: "Conditional",
      },
      {
        id: "temperature",
        label: "Temperature",
        value: canUseLiveWeather && typeof weather?.current?.temperature === "number"
          ? _formatTemperature(weather.current.temperature, globalThis.OpenMeteoAdapter?.getUnits?.()?.temperature || "fahrenheit")
          : weatherUnavailableReason,
        status: canUseLiveWeather && typeof weather?.current?.temperature === "number" ? "Live" : "Unavailable",
        source: environmentSource,
        timestamp: weatherTimestamp,
        freshness: weatherFreshness,
        availability: "Temperature requires a live environment provider.",
        relation: canUseLiveWeather ? "Live temperature sampled for the selected Pattern Day now." : "No historical environment provider is configured.",
        layerId: "environment",
        sphereLabel: "Environmental intensity",
        visibleOnSphere: _mappedLayerVisible("environment"),
        comparison: "Not available",
        hierarchy: "Conditional",
      },
      {
        id: "wind",
        label: "Wind",
        value: canUseLiveWeather && typeof weather?.current?.windSpeed === "number"
          ? `${Math.round(weather.current.windSpeed)} km/h${typeof weather?.current?.windDirection === "number" ? ` ${_windBearingLabel(weather.current.windDirection)}` : ""}`
          : weatherUnavailableReason,
        status: canUseLiveWeather && typeof weather?.current?.windSpeed === "number" ? "Live" : "Unavailable",
        source: environmentSource,
        timestamp: weatherTimestamp,
        freshness: weatherFreshness,
        availability: "Wind requires a live environment provider.",
        relation: canUseLiveWeather ? "Live wind vector sampled for the selected Pattern Day now." : "No historical environment provider is configured.",
        layerId: "environment",
        sphereLabel: "Directional stream",
        visibleOnSphere: _mappedLayerVisible("environment"),
        comparison: "Not available",
        hierarchy: "Conditional",
      },
      {
        id: "cloud",
        label: "Cloud",
        value: canUseLiveWeather && typeof weather?.current?.cloudCover === "number"
          ? `${Math.round(weather.current.cloudCover)}%`
          : weatherUnavailableReason,
        status: canUseLiveWeather && typeof weather?.current?.cloudCover === "number" ? "Live" : "Unavailable",
        source: environmentSource,
        timestamp: weatherTimestamp,
        freshness: weatherFreshness,
        availability: "Cloud cover requires a live environment provider.",
        relation: canUseLiveWeather ? "Live cloud field sampled for the selected Pattern Day now." : "No historical environment provider is configured.",
        layerId: "environment",
        sphereLabel: "Atmospheric veil",
        visibleOnSphere: _mappedLayerVisible("environment"),
        comparison: "Not available",
        hierarchy: "Conditional",
      },
      {
        id: "pattern-moon",
        label: "Pattern Moon",
        value: selected?.moon != null ? `Moon ${selected.moon} · ${selected.moonName || "Unnamed"}` : "Outside counted year",
        status: "Calculated",
        source: "PatternCalendar",
        timestamp: live?.instant || "",
        freshness: "Current calculation",
        availability: "Always available from the calendar engine.",
        relation: basePatternRelation,
        layerId: "pattern",
        sphereLabel: "Pattern structure",
        visibleOnSphere: _mappedLayerVisible("pattern"),
        comparison: historicalAvailability,
        hierarchy: "Always available",
      },
      {
        id: "pattern-day",
        label: "Pattern Day",
        value: selected?.day != null ? `Day ${selected.day}${selected?.dayOfPatternYear != null ? ` · ${selected.dayOfPatternYear}/364` : ""}` : "Outside counted year",
        status: "Calculated",
        source: "PatternCalendar",
        timestamp: live?.instant || "",
        freshness: "Current calculation",
        availability: "Always available from the calendar engine.",
        relation: basePatternRelation,
        layerId: ["pattern", "exactDays"],
        sphereLabel: "Selected Pattern Day field",
        visibleOnSphere: _mappedLayerVisible(["pattern", "exactDays"]),
        comparison: historicalAvailability,
        hierarchy: "Always available",
      },
      {
        id: "week-gate",
        label: "Week Gate",
        value: selected?.weekGate?.[0] || "Unavailable",
        status: "Calculated",
        source: "PatternCalendarData",
        timestamp: live?.instant || "",
        freshness: "Current calculation",
        availability: "Always available from Pattern week mapping.",
        relation: selectedWeek ? `Week ${selectedWeek} of the selected Pattern Moon.` : basePatternRelation,
        layerId: "weekGates",
        sphereLabel: "Pattern structure",
        visibleOnSphere: _mappedLayerVisible("weekGates"),
        comparison: historicalAvailability,
        hierarchy: "Always available",
      },
      {
        id: "archetype",
        label: "Archetype",
        value: selected?.daySeal || "Unavailable",
        status: "Calculated",
        source: "PatternCalendarData",
        timestamp: live?.instant || "",
        freshness: "Current calculation",
        availability: "Always available from the canonical day archetype table.",
        relation: basePatternRelation,
        layerId: "pattern",
        sphereLabel: "Selected Pattern Day field",
        visibleOnSphere: _mappedLayerVisible("pattern"),
        comparison: historicalAvailability,
        hierarchy: "Always available",
      },
      {
        id: "tone",
        label: "Tone",
        value: selected?.daySeal || "Unavailable",
        status: "Calculated",
        source: "AlignmentLedgerData symbolic tone mapping",
        timestamp: live?.instant || "",
        freshness: "Current calculation",
        availability: "Always available as a symbolic layer tied to the selected Pattern Day.",
        relation: basePatternRelation,
        layerId: "connections",
        sphereLabel: "Selected Pattern Day field",
        visibleOnSphere: _mappedLayerVisible("connections"),
        comparison: historicalAvailability,
        hierarchy: "Always available",
      },
      {
        id: "sunset",
        label: _state.manualSunset === "18:00" ? "Sunset boundary" : "Local sunset",
        value: weather?.daily?.sunset
          ? _formatLocalInstant(weather.daily.sunset)
          : (_state.manualSunset === "18:00" ? `Manual fallback · ${_state.manualSunset}` : `${_state.manualSunset || "18:00"}`),
        status: "Calculated",
        source: weather?.daily?.sunset ? environmentSource : (_state.manualSunset === "18:00" ? "Manual fallback" : "Configured boundary"),
        timestamp: weather?.daily?.sunset ? weatherTimestamp : (live?.instant || ""),
        freshness: weather?.daily?.sunset ? weatherFreshness : "Current calculation",
        availability: "Always available from the current boundary configuration.",
        relation: selected?.afterBoundary
          ? "The selected Pattern Day has already crossed the configured boundary."
          : "The selected Pattern Day has not yet crossed the configured boundary.",
        layerId: "solar",
        sphereLabel: "Local solar marker",
        visibleOnSphere: _mappedLayerVisible("solar"),
        comparison: "Not available",
        hierarchy: "Always available",
      },
      {
        id: "moon-phase",
        label: "Moon phase",
        value: selected?.lunarPhase || live?.lunar?.phaseName || "Unavailable",
        status: "Calculated",
        source: live?.lunar?.source || "AstronomySources.lunar",
        timestamp: live?.instant || "",
        freshness: "Current calculation",
        availability: "Always available from the astronomy dataset.",
        relation: basePatternRelation,
        layerId: "lunar",
        sphereLabel: "Lunar Position",
        visibleOnSphere: _mappedLayerVisible("lunar"),
        comparison: historicalAvailability,
        hierarchy: "Always available",
      },
      {
        id: "lunar-illumination",
        label: "Lunar illumination",
        value: selected?.lunarIllumination != null ? `${selected.lunarIllumination}%` : (live?.lunar?.illuminationPercent != null ? `${live.lunar.illuminationPercent}%` : "Unavailable"),
        status: "Calculated",
        source: live?.lunar?.source || "AstronomySources.lunar",
        timestamp: live?.instant || "",
        freshness: "Current calculation",
        availability: "Always available from the astronomy dataset.",
        relation: basePatternRelation,
        layerId: "lunar",
        sphereLabel: "Lunar Position",
        visibleOnSphere: _mappedLayerVisible("lunar"),
        comparison: historicalAvailability,
        hierarchy: "Always available",
      },
      {
        id: "passage",
        label: "Equinox Passage",
        value: live?.passage?.active
          ? `Active · ${live.passage.elapsed != null ? `${Number((live.passage.elapsed * 24).toFixed(1))} h elapsed` : "in progress"}`
          : `Inactive · ${live?.passage?.durationHours != null ? `${live.passage.durationHours} h span` : "duration unavailable"}`,
        status: "Calculated",
        source: "EquinoxPassageEngine",
        timestamp: yearRecord?.equinox?.utcInstant || live?.instant || "",
        freshness: "Canonical dataset",
        availability: "Always available from canonical Passage data.",
        relation: `Selected year ${_state.year} Passage state.`,
        layerId: "passage",
        sphereLabel: "Passage arc",
        visibleOnSphere: _mappedLayerVisible("passage"),
        comparison: historicalAvailability,
        hierarchy: "Always available",
      },
      {
        id: "solar-gate",
        label: "Nearest solar gate",
        value: selected?.solar?.gate ? `${selected.solar.gate} · ${selected.solar.element || "—"}` : "Unavailable",
        status: "Calculated",
        source: "Seasonal approximation (anchor interpolation)",
        timestamp: live?.instant || "",
        freshness: "Current calculation",
        availability: "Always available from seasonal anchor interpolation.",
        relation: basePatternRelation,
        layerId: "solar",
        sphereLabel: "Local solar marker",
        visibleOnSphere: _mappedLayerVisible("solar"),
        comparison: historicalAvailability,
        hierarchy: "Always available",
      },
      {
        id: "daylight-state",
        label: "Daylight state",
        value: daylightState,
        status: "Calculated",
        source: _state.boundaryMode === "midnight" ? "Midnight boundary" : "Configured sunset boundary",
        timestamp: live?.instant || "",
        freshness: "Current calculation",
        availability: "Always available from boundary state.",
        relation: basePatternRelation,
        layerId: "solar",
        sphereLabel: "Local solar marker",
        visibleOnSphere: _mappedLayerVisible("solar"),
        comparison: "Not available",
        hierarchy: "Always available",
      },
      {
        id: "boundary",
        label: "Configured boundary",
        value: _state.boundaryMode === "midnight" ? "Midnight boundary" : `Sunset boundary · ${_state.manualSunset || "18:00"}`,
        status: "Calculated",
        source: "Living Time Sphere settings",
        timestamp: live?.instant || "",
        freshness: "Current calculation",
        availability: "Always available from current Observatory settings.",
        relation: basePatternRelation,
        layerId: "markers",
        sphereLabel: "Boundary marker",
        visibleOnSphere: _mappedLayerVisible("markers"),
        comparison: "Not available",
        hierarchy: "Always available",
      },
      {
        id: "cached-environment",
        label: "Cached environment timestamp",
        value: live?.instant ? _formatLocalInstant(live.instant) : "No cached environment snapshot",
        status: providerConfigured ? "Cached" : "Unavailable",
        source: providerConfigured ? environmentSource : "LivingTimeSphereLiveData snapshot",
        timestamp: weatherTimestamp || live?.instant || "",
        freshness: providerConfigured ? weatherFreshness : _formatFreshness(live?.instant, now),
        availability: "Always available as the current snapshot timestamp.",
        relation: "Indicates when this field layer snapshot was assembled.",
        layerId: "environment",
        sphereLabel: "Environmental shell",
        visibleOnSphere: _mappedLayerVisible("environment"),
        comparison: "Not available",
        hierarchy: "Always available",
      },
      {
        id: "kp",
        label: "Kp",
        value: "Unavailable",
        status: "Unavailable",
        source: "No geomagnetic provider configured",
        timestamp: "",
        freshness: "Not checked",
        availability: "Kp is conditional on a geomagnetic provider.",
        relation: selected?.isToday ? "Would apply to the current selected Pattern Day." : "Historical Kp is not available in this Observatory.",
        layerId: "environment",
        sphereLabel: "Geomagnetic shell",
        visibleOnSphere: _mappedLayerVisible("environment"),
        comparison: "Not available",
        hierarchy: "Conditional",
      },
      {
        id: "body-signal",
        label: "Body signal",
        value: bodySignalValue || "No body signal recorded",
        status: bodySignalValue ? "User logged" : "Unavailable",
        source: bodySignalValue ? "Local witness log" : "No body signal recorded",
        timestamp: observation?.saved || observation?.date || "",
        freshness: bodySignalValue ? _formatFreshness(observation?.saved || observation?.date, now) : "Not checked",
        availability: bodySignalValue
          ? "Saved local observation is available."
          : "No body signal has been recorded for this Pattern Day in local storage.",
        relation: selected?.effectiveDate
          ? `Matches local observation for ${selected.effectiveDate}.`
          : "No selected Pattern Day date is available.",
        layerId: "connections",
        sphereLabel: "Local personal field",
        visibleOnSphere: _mappedLayerVisible("connections"),
        comparison: witnessCount ? `${_pluralize(witnessCount, "saved record", "saved records")}` : "Not available",
        hierarchy: "Always available",
        actionHref: _buildMoonsLink(selected, "#bodyInput"),
        actionLabel: "Record Body Signal",
      },
      {
        id: "pattern-tag",
        label: "Pattern tag",
        value: patternTagValue || "No Pattern tag recorded",
        status: patternTagValue ? "User logged" : "Unavailable",
        source: memory?.dailyIntention?.value
          ? "CodexMemory intention"
          : (patternTagValue ? "Local witness log" : "No Pattern tag recorded"),
        timestamp: memory?.dailyIntention?.selectedAt || observation?.saved || "",
        freshness: patternTagValue ? _formatFreshness(memory?.dailyIntention?.selectedAt || observation?.saved, now) : "Not checked",
        availability: patternTagValue
          ? "Saved Pattern tag is available."
          : "No Pattern tag has been saved for this Pattern Day in local storage.",
        relation: basePatternRelation,
        layerId: "connections",
        sphereLabel: "Selected Pattern Day field",
        visibleOnSphere: _mappedLayerVisible("connections"),
        comparison: historicalAvailability,
        hierarchy: "Always available",
        actionHref: _buildMoonsLink(selected, "#signsInput"),
        actionLabel: "Add Pattern Tag",
      },
      {
        id: "witness",
        label: "Witness",
        value: `${_pluralize(witnessCount, "saved record", "saved records")}${live?.witness?.label && witnessCount ? ` · ${live.witness.label}` : ""}`,
        status: witnessCount ? "User logged" : "Unavailable",
        source: live?.witness?.source === "CodexMemory" ? "Local browser witness storage" : "Witness storage unavailable",
        timestamp: live?.witness?.date || "",
        freshness: live?.witness?.date ? _formatFreshness(live.witness.date, now) : "Not checked",
        availability: witnessCount
          ? "Saved witness records are available in this browser."
          : "No local witness records are saved yet in this browser.",
        relation: basePatternRelation,
        layerId: "connections",
        sphereLabel: "Witness constellation",
        visibleOnSphere: _mappedLayerVisible("connections"),
        comparison: witnessCount ? `${_pluralize(witnessCount, "local witness", "local witnesses")}` : "Not available",
        hierarchy: "Always available",
        actionHref: live?.links?.witness || "./ledger.html",
        actionLabel: "Record Observation",
      },
      {
        id: "recurrence",
        label: "Recurrence",
        value: recurrence
          ? `${recurrence.year} · ${Math.round(recurrence.overallSimilarityScore * 100)}%`
          : "No supported recurrence above threshold",
        status: recurrence ? "Calculated" : "Unavailable",
        source: "AlignmentRecurrence",
        timestamp: live?.instant || "",
        freshness: "Canonical dataset",
        availability: recurrence
          ? "Historical comparison exists in the supported study range."
          : "No recurrence currently clears the supported similarity threshold.",
        relation: `Compares selected year ${_state.year} across the 2014–2026 study range.`,
        layerId: "recurrence",
        sphereLabel: "Historical connection line",
        visibleOnSphere: _mappedLayerVisible("recurrence"),
        comparison: recurrence
          ? `Compared dimensions: ${recurrenceCompared.join(", ")}${recurrenceMissing.length ? ` · Missing: ${recurrenceMissing.join(", ")}` : ""}`
          : "Not available",
        hierarchy: "Conditional",
        comparedDimensions: recurrenceCompared,
        missingDimensions: recurrenceMissing,
        actionHref: _buildAlignmentLink("recurrence"),
        actionLabel: "Open comparison",
      },
    ];

    const activeConnectionCount = fields.filter(field => field.visibleOnSphere && field.status !== "Unavailable" && field.status !== "Not checked").length;
    const locationName = weather?.place?.name || weather?.locationState?.label || "Set location";
    const sensorMatrix = [
      {
        key: "weather",
        label: "Weather",
        value: canUseLiveWeather ? (weather?.current?.condition || weather?.statusLabel || "Live observation") : weatherDisplayState,
      },
      {
        key: "temperature",
        label: "Temperature",
        value: canUseLiveWeather && Number.isFinite(weather?.current?.temperature)
          ? _formatTemperature(weather.current.temperature, globalThis.OpenMeteoAdapter?.getUnits?.()?.temperature || "fahrenheit")
          : "Location required",
      },
      {
        key: "humidity",
        label: "Humidity",
        value: canUseLiveWeather && Number.isFinite(weather?.current?.humidity)
          ? `${Math.round(weather.current.humidity)}%`
          : "Location required",
      },
      {
        key: "wind",
        label: "Wind",
        value: canUseLiveWeather && Number.isFinite(weather?.current?.windSpeed)
          ? `${Math.round(weather.current.windSpeed)} km/h ${_windBearingLabel(weather.current.windDirection)}`
          : "Location required",
      },
      {
        key: "sunrise",
        label: "Sunrise",
        value: canUseLiveWeather && weather?.daily?.sunrise ? _formatLocalInstant(weather.daily.sunrise) : "Location required",
      },
      {
        key: "sunset",
        label: "Sunset",
        value: canUseLiveWeather && weather?.daily?.sunset ? _formatLocalInstant(weather.daily.sunset) : "Location required",
      },
      {
        key: "daylight",
        label: "Daylight",
        value: canUseLiveWeather && Number.isFinite(weather?.daily?.daylightDurationSeconds)
          ? _formatDurationHours(weather.daily.daylightDurationSeconds)
          : "Location required",
      },
      {
        key: "provider",
        label: "Provider",
        value: providerConfigured ? `${weather?.provider || "Open-Meteo"} · ${weatherFreshness}` : "Set location",
      }
    ];
    const environmentLayerReady = providerConfigured && canUseLiveWeather;

    return {
      rangeLabel: FIELD_RANGE_LABELS[_state.fieldRange] || FIELD_RANGE_LABELS.now,
      summaryItems,
      fields,
      activeConnectionCount,
      livingContext: {
        witness: `${_pluralize(witnessCount, "saved record", "saved records")}${live?.witness?.label && witnessCount ? ` · ${live.witness.label}` : ""}`,
        environment: `${live?.environment?.online === false ? "Offline" : "Online"} · ${providerConfigured ? (weather?.statusLabel || "live provider active") : "live provider unavailable"}`,
        recurrence: recurrence
          ? `Closest supported recurrence: ${recurrence.year} · ${Math.round(recurrence.overallSimilarityScore * 100)}%`
          : "Closest supported recurrence: Not available",
        selectedPatternPosition: selected?.moon != null ? `Moon ${selected.moon} · Day ${selected.day}` : "Outside counted year",
        solarContext: selected?.solar?.gate ? `${selected.solar.gate} · ${selected.solar.element || "—"}` : "Unavailable",
        lunarContext: selected?.lunarPhase || live?.lunar?.phaseName || "Unavailable",
        fieldConnections: `${activeConnectionCount} active`,
      },
      sources: {
        patternEngineVersion: globalThis.PatternCalendarVersion?.version || "pattern-calendar/1.0.0",
        astronomyDatasetVersion: globalThis.AstronomySources?.sourceMetadata?.datasetVersion || globalThis.AstronomyVersion?.version || "astronomy/1.0.0",
        environmentProvider: environmentSource,
        lastEnvironmentUpdate: weatherTimestamp || live?.instant || "",
        sunsetSource: _state.manualSunset === "18:00" ? "Manual fallback" : "Configured local boundary",
        solarCalculationSource: "seasonal-approximation (anchor-interpolation)",
        lunarCalculationSource: globalThis.AstronomySources?.sources?.lunar?.label || live?.lunar?.source || "Lunar calculation unavailable",
        witnessStorageState: live?.witness?.source === "CodexMemory" ? `Local browser storage · ${_pluralize(witnessCount, "record", "records")}` : "Local browser storage unavailable",
        recurrenceDatasetRange: (() => {
          const years = globalThis.AlignmentLedgerData?.listSupportedYears?.() || [];
          return years.length ? `${years[0]}–${years[years.length - 1]}` : "Unavailable";
        })(),
      },
      providerConfigured,
      dateClass,
      sensorMatrix,
      locationName,
      environmentLayerReady,
    };
  }

  function _fieldLayerSnapshot(selected, model) {
    return _buildFieldLayerSnapshot(selected, model);
  }

  function _resolveSemanticZoomState(container) {
    const zoom = globalThis.LivingTimeSphereSemanticZoom;
    if (!zoom?.resolveBand || !zoom?.resolveVisibility) return null;
    const cameraState = globalThis.LivingTimeSphereCamera?.getState?.() || {};
    const fallbackDist = globalThis.LivingTimeSphereCamera?.MODE_POSITIONS?.[_state.viewMode]?.distance || 2.35;
    const screenWidth = container?.clientWidth || (typeof window !== "undefined" ? window.innerWidth : 1024);
    const candidateBand = zoom.resolveBand({
      distance: Number(cameraState.dist ?? fallbackDist),
      screenWidth,
    });
    const band = globalThis.LivingTimeSphereRenderer3d?._internals?.stabilizeBand
      ? globalThis.LivingTimeSphereRenderer3d._internals.stabilizeBand({
          candidateBand,
          distance: Number(cameraState.dist ?? fallbackDist),
          screenWidth,
          previousBand: _state.semanticBand,
        })
      : candidateBand;
    _state.semanticBand = band;
    const resolved = zoom.resolveVisibility({
      baseLayers: _state.visibleLayers,
      band,
      connectionMode: _state.connectionMode,
    });
    return Object.freeze(resolved);
  }

  // ── Render dispatch ────────────────────────────────────────────────

  function renderSphere(container) {
    if (!container) return;
    _state.fullRenderCount += 1;
    if (!_state.requestedViewMode) _state.requestedViewMode = _state.viewMode;
    _state.activeViewMode = _state.viewMode;

    // Show/hide data table and text summary views
    _updateAlternateViews();
    _syncModeButtons();
    _syncFieldRangeButtons();
    _syncLayerCheckboxes();

    const model    = buildCurrentModel();
    const spiral   = _getCachedSpiral();
    const effective = _resolveEffectiveRenderState(model, spiral, container);
    const semanticZoom = effective.semanticZoom;
    const effectiveLayers = effective.effectiveLayers;
    const effectiveMoonLabelMode = effective.effectiveMoonLabelMode;
    const effectiveDayLabelMode = effective.effectiveDayLabelMode;
    const connectionRegistry = effective.connectionRegistry;

    if (_state.requestedRendererMode === "table" || _state.requestedRendererMode === "text") {
      // Hide 3D / SVG canvas; show alternate view
      _teardown3d();
      _setRendererLifecycle("ready");
      _state.activeRendererMode = _state.requestedRendererMode;
      container.style.display = "none";
      _updateRendererLabel(_state.requestedRendererMode === "table" ? "Data Table" : "Text Summary");
      updateAccessibleText(model, spiral);
      updateDetails(model);
      _updateTodayDiagnostics(model);
      _updateModeSummary(model);
      _updateWhatAmISeeing(_state.viewMode);
      _updateStateStrip(_state.viewMode, model);
      _updateEnvironmentBridge(model);
      _updateSphereUrlFromModel(model, { replace: true });
      return;
    }
    container.style.display = "";

    const { w, h } = getContainerSize(container);
    const dpr      = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
    const layout   = globalThis.LivingTimeSphereLayout.resolveLayout({ containerWidth: w, containerHeight: h, devicePixelRatio: dpr });

    _state._latestContainerSize = { w, h };
    if (shouldUse3d()) {
      if (_state.active3d && globalThis.LivingTimeSphereRenderer3d?.isInitialized?.()) {
        _render3d(container, model, spiral, effectiveLayers, connectionRegistry, semanticZoom, effectiveMoonLabelMode, effectiveDayLabelMode);
      } else {
        _state.activeRendererMode = _state._3dInitInProgress ? "initializing-3d" : "svg";
        _renderSvgFallback(container, model, spiral, layout, effectiveLayers, connectionRegistry, semanticZoom, effectiveMoonLabelMode, effectiveDayLabelMode);
        _render3d(container, model, spiral, effectiveLayers, connectionRegistry, semanticZoom, effectiveMoonLabelMode, effectiveDayLabelMode);
      }
    } else {
      _teardown3d();
      _setRendererLifecycle("fallback");
      _state.activeRendererMode = "svg";
      _renderSvgFallback(container, model, spiral, layout, effectiveLayers, connectionRegistry, semanticZoom, effectiveMoonLabelMode, effectiveDayLabelMode);
    }

    updateAccessibleText(model, spiral);
    updateDetails(model);
    _updateTodayDiagnostics(model);
    _updateModeSummary(model);
    _updateWhatAmISeeing(_state.viewMode);
    _updateStateStrip(_state.viewMode, model);
    _updateEnvironmentBridge(model);
    _updateRendererDiagnostics();
    _updateSphereUrlFromModel(model, { replace: true });
  }

  async function _render3d(container, model, spiral, effectiveLayers, connectionRegistry, semanticZoomState, effectiveMoonLabelMode, effectiveDayLabelMode) {
    const preset = resolveQualityPreset();
    if (!preset) { _setRendererLifecycle("fallback"); _teardown3d(); return; }

    const renderer = globalThis.LivingTimeSphereRenderer3d;

    if (!renderer.isInitialized()) {
      // Prevent concurrent init: if one is already in progress (either in this module
      // or inside the renderer itself), skip and leave the in-progress call to finish.
      if (_state._3dInitInProgress || renderer.isInitializing?.()) {
        _state._pending3dPayload = {
          container, model, spiral, effectiveLayers, connectionRegistry, semanticZoomState, effectiveMoonLabelMode, effectiveDayLabelMode
        };
        return;
      }
      _state._3dInitInProgress = true;
      const initGeneration = ++_state._3dInitGeneration;
      _setRendererLifecycle("initializing");
      _state.activeRendererMode = "initializing-3d";
      _updateRendererLabel("Loading 3D renderer…");

      const reducedMotion = typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

      let result;
      try {
        const hasStableSize = await _waitForValidContainer(container);
        if (!hasStableSize) {
          _setRendererLifecycle("waiting-for-size");
          result = {
            success: false,
            reason: "CONTAINER_SIZE_INVALID",
            detail: "Renderer container did not reach a valid layout size in time.",
          };
        } else {
          result = await _withTimeout(renderer.init({
          container,
          model,
          spiral,
          quality:       preset,
          tier: _state.quality === "auto"
            ? globalThis.ObservatoryCapabilityManager?.selectTier?.({
                webglAvailable: globalThis.ObservatoryCapabilityManager?.probeWebGl?.().webgl ?? true
              })
            : _state.quality,
          selectedYear:  _state.year,
          visibleLayers: effectiveLayers,
          viewMode:      _state.viewMode,
          moonLabelMode: effectiveMoonLabelMode,
          moonLabelDistance: _state.moonLabelDistance,
          dayLabelMode: effectiveDayLabelMode,
          connectionRegistry,
          motionMode: _state.motionMode,
          semanticZoomState,
          environmentState: globalThis.SofEnvironmentState?.getEnvironmentState?.() || null,
          reducedMotion,
          onYearSelect: year => {
            _state.year = year;
            _syncYearSelect(year);
            globalThis.LivingTimeSphereAccessibility?.announce?.(`Year ${year} selected. Passage view.`);
            _requestViewModeTransition(container, "passage");
          },
          onMarkerSelect: marker => {
            if (!marker) return;
            if (marker.type === "day" && marker.dayOfPatternYear) {
              globalThis.LivingTimeSphereAccessibility?.announce?.(`Selected Pattern Moon ${marker.moon}, Day ${marker.day}, Day ${marker.dayOfPatternYear} of 364.`);
              if (_state.viewMode === "years") {
                _requestViewModeTransition(container, "pattern");
              }
              _requestSelectedDayUpdate(container, marker.dayOfPatternYear);
              return;
            }
            if (marker.type === "moon" && marker.moon) {
              const day = Math.max(1, Math.min(28, marker.day || 1));
              globalThis.LivingTimeSphereAccessibility?.announce?.(`Selected Pattern Moon ${marker.moon}, Day ${day}.`);
              _requestSelectedDayUpdate(container, (marker.moon - 1) * 28 + day);
              return;
            }
            _state.selectedMarker = marker?.type === "year" ? `eq-${marker.year}` : (marker?.type || null);
            renderSphere(container);
          }
          }), 25000);
        }
      } catch (err) {
        result = { success: false, reason: "init-exception", detail: String(err) };
      } finally {
        _state._3dInitInProgress = false;
      }

      if (initGeneration !== _state._3dInitGeneration) return;

      if (!result || !result.success) {
        // Fall back to SVG.
        _state.active3d = false;
        _state.activeRendererMode = _state.requestedRendererMode === "svg" ? "svg" : "recovering";
        const reason = result?.reason || "WebGL unavailable";
        const transient = reason === "CONTAINER_SIZE_INVALID" || reason === "INIT_TIMEOUT" || reason === "init-exception";
        _setRendererLifecycle(reason === "CONTAINER_SIZE_INVALID" ? "waiting-for-size" : (transient ? "fallback" : "failed"));
        const statusText = `SVG fallback — ${reason}`;
        _updateRendererLabel(statusText);
        // Show the fallback warning row with Retry button.
        _showRendererFallbackWarning(reason, result?.detail || "");
        // Remove any stale canvas element left by a failed init.
        const staleCanvas = container.querySelector(".living-time-sphere-3d-canvas");
        if (staleCanvas) staleCanvas.remove();
        const layout = globalThis.LivingTimeSphereLayout.resolveLayout({
          containerWidth:  container.offsetWidth  || 320,
          containerHeight: container.offsetHeight || 320,
          devicePixelRatio: (typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1)
        });
        _renderSvgFallback(container, model, spiral, layout, effectiveLayers, connectionRegistry, semanticZoomState, effectiveMoonLabelMode, effectiveDayLabelMode);
        _updateInteractBar();
        _updateTodayDiagnostics(model);
        if (transient && _state.requestedRendererMode !== "svg") {
          _scheduleRetry(container, reason);
        }
        return;
      }
      container.querySelectorAll(".living-time-sphere-svg,.living-time-sphere-canvas").forEach(node => node.remove());
      _state.active3d = true;
      _state.activeRendererMode = "3d";
      _state.restoreAttempts = 0;
      _state.retryCount = 0;
      _clearAutoRetry();
      _setRendererLifecycle("rendered");
      _updateRendererLabel("WebGL 3D active");
      _hideRendererFallbackWarning();
      _updateInteractBar();
      _updateLastRenderTimestamp();
      _watchForBlankCanvas(container);
      _updateRendererDiagnostics();
      if (_state._pending3dPayload) {
        const pending = _state._pending3dPayload;
        _state._pending3dPayload = null;
        _render3d(
          pending.container,
          pending.model,
          pending.spiral,
          pending.effectiveLayers,
          pending.connectionRegistry,
          pending.semanticZoomState,
          pending.effectiveMoonLabelMode,
          pending.effectiveDayLabelMode
        );
      }
    } else {
      renderer.refresh(
        model,
        spiral,
        _state.year,
        effectiveLayers,
        _state.viewMode,
        effectiveMoonLabelMode,
        _state.moonLabelDistance,
        effectiveDayLabelMode,
        connectionRegistry,
        _state.motionMode,
        semanticZoomState
      );
      const readiness = renderer.getDiagnostics?.().sceneReadiness || { ready: true, reasons: [] };
      if (!readiness.ready) {
        _state.active3d = false;
        _state.activeRendererMode = "recovering";
        _setRendererLifecycle("recovering");
        _updateRendererLabel(`Recovering 3D scene… (${(readiness.reasons || []).slice(0, 2).join(", ") || "scene-not-ready"})`);
        const layout = globalThis.LivingTimeSphereLayout.resolveLayout({
          containerWidth:  container.offsetWidth  || 320,
          containerHeight: container.offsetHeight || 320,
          devicePixelRatio: (typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1)
        });
        _renderSvgFallback(container, model, spiral, layout, effectiveLayers, connectionRegistry, semanticZoomState, effectiveMoonLabelMode, effectiveDayLabelMode);
        _scheduleRetry(container, "scene-readiness-refresh");
        return;
      }
      renderer.updateEnvironment?.(globalThis.SofEnvironmentState?.getEnvironmentState?.() || null);
      renderer.setMode(_state.viewMode);
      _updateLastRenderTimestamp();
      _setRendererLifecycle("ready");
      _state.activeRendererMode = "3d";
    }
  }

  function _teardown3d() {
    if (_state.active3d && globalThis.LivingTimeSphereRenderer3d?.isInitialized?.()) {
      globalThis.LivingTimeSphereRenderer3d.teardown();
    }
    _state.active3d = false;
    _state._3dInitInProgress = false;
    _state._pending3dPayload = null;
    if (_state.requestedRendererMode === "svg" || _state.requestedRendererMode === "canvas" || _state.requestedRendererMode === "table" || _state.requestedRendererMode === "text") {
      _setRendererLifecycle("fallback");
    } else {
      _setRendererLifecycle("not-started");
    }
    if (_state.requestedRendererMode === "table" || _state.requestedRendererMode === "text") {
      _state.activeRendererMode = _state.requestedRendererMode;
    } else {
      _state.activeRendererMode = "svg";
    }
    _updateInteractBar();
  }

  function _renderSvgFallback(container, model, spiral, layout, effectiveLayers, connectionRegistry, semanticZoomState, effectiveMoonLabelMode, effectiveDayLabelMode) {
    // Canvas fallback
    if (_state.useCanvas && globalThis.LivingTimeSphereRendererCanvas?.isCanvasSupported?.()) {
      let canvas = container.querySelector(".living-time-sphere-canvas");
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.className = "living-time-sphere-canvas";
        container.querySelectorAll(".living-time-sphere-svg,.living-time-sphere-canvas").forEach(node => node.remove());
        container.appendChild(canvas);
      }
      const ok = globalThis.LivingTimeSphereRendererCanvas.renderCanvas({ canvas, model, spiral, layout, visibleLayers: effectiveLayers, selectedYear: _state.year });
      if (ok) { _updateRendererLabel("Canvas fallback"); }
      else _renderSvgOnly(container, model, spiral, layout, effectiveLayers, connectionRegistry, semanticZoomState, effectiveMoonLabelMode, effectiveDayLabelMode);
    } else {
      _renderSvgOnly(container, model, spiral, layout, effectiveLayers, connectionRegistry, semanticZoomState, effectiveMoonLabelMode, effectiveDayLabelMode);
    }
  }

  function _renderSvgOnly(container, model, spiral, layout, effectiveLayers, connectionRegistry, semanticZoomState, effectiveMoonLabelMode, effectiveDayLabelMode) {
    _updateRendererLabel(_state.requestedRendererMode === "svg" ? "Accessible SVG" : "SVG fallback");
    globalThis.LivingTimeSphereRendererSvg.renderInto(container, {
      model, spiral, layout,
      visibleLayers: effectiveLayers,
      selectedYear:  _state.year,
      viewMode:      _state.viewMode,
      moonLabelMode: effectiveMoonLabelMode,
      moonLabelDistance: _state.moonLabelDistance,
      dayLabelMode: effectiveDayLabelMode,
      connectionRegistry,
      semanticZoomState
    });
  }

  // Keep the mobile interact bar in sync with the 3D renderer state.
  // The bar (and its "Exit Interaction" button) should only be active when
  // a real 3D canvas is running. In SVG mode it should stay hidden.
  function _updateInteractBar() {
    const bar         = document.querySelector(".sphere-interact-bar");
    const interactBtn = document.getElementById("sphere-interact-btn");
    const endBtn      = document.getElementById("sphere-interact-end-btn");
    const hintOff     = document.getElementById("sphere-hint-off");
    const hintOn      = document.getElementById("sphere-hint-on");
    if (!bar) return;
    // Show/hide the whole bar based on whether 3D is active.
    bar.style.display = _state.active3d ? "" : "none";
    // Always reset to the "Interact" state when the bar is re-shown.
    if (interactBtn) interactBtn.style.display = "";
    if (endBtn)      endBtn.style.display      = "none";
    if (hintOff)     hintOff.style.display     = "";
    if (hintOn)      hintOn.style.display      = "none";
  }

  function _updateAlternateViews() {
    // Reveal data table section
    const tableSection = document.getElementById("sphere-data-table-section");
    if (tableSection) tableSection.style.display = _state.requestedRendererMode === "table" ? "" : "none";

    // Reveal text summary section
    const textSection  = document.getElementById("sphere-text-summary-section");
    if (textSection)  textSection.style.display  = _state.requestedRendererMode === "text"  ? "" : "none";
  }

  // ── Renderer status label ──────────────────────────────────────────

  function _updateRendererLabel(status) {
    const el = document.getElementById("sphere-renderer-label");
    if (el) el.textContent = status;
  }

  // Sync the renderer <select> to reflect the actual active renderer.
  function _syncRendererSelect(activeRenderer) {
    const sel = document.getElementById("sphere-renderer-select");
    if (sel) sel.value = activeRenderer || _state.requestedRendererMode;
  }

  // Show the fallback warning banner with Retry / Switch-to-SVG buttons.
  function _showRendererFallbackWarning(reason, detail) {
    const el = document.getElementById("sphere-renderer-fallback-warning");
    if (!el) return;
    el.classList.remove("is-minimized");
    const reasonEl = el.querySelector(".sphere-fallback-reason");
    const capMgr = globalThis.ObservatoryCapabilityManager;
    const reasonCode = capMgr?.mapLegacyReason?.(reason) || reason;
    const reasonText = capMgr?.describeReason?.(reasonCode) || reasonCode || "3D is unavailable.";
    if (reasonEl) reasonEl.textContent = reasonText;
    // Populate inline diagnostics inside the collapsible details block.
    const r3d = globalThis.LivingTimeSphereRenderer3d;
    const diag = r3d?.getDiagnostics?.() || {};
    const _set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val || "—"; };
    _set("sphere-diag-local-url-warn",      diag.localModuleUrl || r3d?.THREE_LOCAL_REL || "—");
    _set("sphere-diag-last-error-warn",     diag.lastInitError ? `${diag.lastInitError.reason}: ${diag.lastInitError.detail || ""}` : `${reason}${detail ? `: ${detail}` : ""}`);
    _set("sphere-diag-module-source-warn",  diag.moduleSource || "none");
    _set("sphere-diag-webgl-warn",          diag.webglAvailable ? "available" : "unavailable");
    _set("sphere-diag-webgl2-warn",         diag.webgl2Available ? "available" : "unavailable");
    _set("sphere-diag-three-warn",          diag.threeLoaded ? "loaded" : "failed");
    _set("sphere-diag-renderer-warn",       diag.stageState?.renderer || (diag.initialized ? "created" : "failed"));
    _set("sphere-diag-context-warn",        diag.stageState?.context || "unknown");
    _set("sphere-diag-first-frame-warn",    diag.stageState?.firstFrame || "not rendered");
    _set("sphere-diag-tier-warn",           diag.tier || _state.quality || "auto");
    _set("sphere-diag-dpr-warn",            `${diag.requestedDevicePixelRatio || "—"} / ${diag.appliedDevicePixelRatio || "—"}`);
    _set("sphere-diag-memory-warn",         diag.deviceMemoryGiB != null ? `${diag.deviceMemoryGiB} GiB` : "unknown");
    _set("sphere-diag-cpu-warn",            diag.hardwareConcurrency != null ? String(diag.hardwareConcurrency) : "unknown");
    _set("sphere-diag-reduced-warn",        `${diag.reducedMotion ? "motion:reduce" : "motion:normal"} · ${diag.reducedData ? "data:reduce" : "data:normal"}`);
    _set("sphere-diag-fallback-warn",       reasonCode || "none");
    _set("sphere-diag-init-duration-warn",  diag.initDurationMs != null ? `${diag.initDurationMs}ms` : "—");
    _set("sphere-diag-restore-attempts-warn", String(diag.restoreAttempts || 0));
    el.hidden = false;
    const pill = document.getElementById("sphere-renderer-fallback-pill");
    if (pill) pill.hidden = true;
  }

  function _hideRendererFallbackWarning() {
    const el = document.getElementById("sphere-renderer-fallback-warning");
    if (el) el.hidden = true;
    const pill = document.getElementById("sphere-renderer-fallback-pill");
    if (pill) pill.hidden = true;
    const reasonEl = el?.querySelector?.(".sphere-fallback-reason");
    if (reasonEl) reasonEl.textContent = "Accessible SVG view is active";
    [
      "sphere-diag-webgl-warn",
      "sphere-diag-webgl2-warn",
      "sphere-diag-three-warn",
      "sphere-diag-renderer-warn",
      "sphere-diag-context-warn",
      "sphere-diag-first-frame-warn",
      "sphere-diag-tier-warn",
      "sphere-diag-dpr-warn",
      "sphere-diag-memory-warn",
      "sphere-diag-cpu-warn",
      "sphere-diag-reduced-warn",
      "sphere-diag-fallback-warn",
      "sphere-diag-last-error-warn",
      "sphere-diag-init-duration-warn",
      "sphere-diag-restore-attempts-warn",
      "sphere-diag-module-source-warn",
      "sphere-diag-local-url-warn",
    ].forEach(id => {
      const row = document.getElementById(id);
      if (row) row.textContent = "—";
    });
    const fallbackRow = document.getElementById("sphere-diag-fallback-warn");
    if (fallbackRow) fallbackRow.textContent = "none";
  }

  function _minimizeRendererFallbackWarning() {
    const el = document.getElementById("sphere-renderer-fallback-warning");
    if (!el) return;
    el.hidden = false;
    el.classList.add("is-minimized");
    const pill = document.getElementById("sphere-renderer-fallback-pill");
    if (pill) pill.hidden = false;
  }

  function containerHasSvg() {
    const container = document.getElementById("sphere-container");
    return !!container?.querySelector?.(".living-time-sphere-svg");
  }

  // Update the renderer diagnostics panel (hidden by default; shown in Technical view).
  function _updateRendererDiagnostics() {
    const panel = document.getElementById("sphere-renderer-diagnostics");
    if (!panel) return;
    const r3d = globalThis.LivingTimeSphereRenderer3d;
    const diag = r3d?.getDiagnostics?.() || {};
    const semantic = diag.semanticZoom || {};
    const stageState = diag.stageState || {};
    const buildIdentity = _resolveBuildIdentityLine();
    const coldBoot = _state.coldBootDiagnostics || null;
    const swText = coldBoot
      ? `${coldBoot.serviceWorker}${coldBoot.serviceWorkerScript ? ` · ${coldBoot.serviceWorkerScript}` : ""}`
      : "pending";
    const storageText = coldBoot
      ? `cacheKeys=${coldBoot.cacheKeyCount} · sphereCaches=${(coldBoot.sphereCacheKeys || []).join(",") || "none"} · local=${(coldBoot.localKeys || []).length} · session=${(coldBoot.sessionKeys || []).length} · selectedState=${coldBoot.selectedStatePresent ? "yes" : "no"}`
      : "pending";
    const deepLinkText = `integrity=${_state.urlIntegrity || "unknown"} · initial=${_state.initialUrl || "n/a"} · current=${_state.currentUrl || (typeof location !== "undefined" ? location.href : "n/a")}`;
    const bootstrapStage = _state.active3d
      ? "rendered"
      : (diag.lastInitError?.reason || stageState.firstFrame || stageState.renderer || _state.rendererLifecycle || "not-started");
    const stageTrace = [
      `capability:${stageState.capability || "idle"}`,
      `module:${stageState.module || "idle"}`,
      `dimensions:${stageState.dimensions || "idle"}`,
      `renderer:${stageState.renderer || "idle"}`,
      `context:${stageState.context || "idle"}`,
      `camera:${stageState.camera || "idle"}`,
      `scene:${stageState.scene || "idle"}`,
      `geometry:${stageState.geometry || "idle"}`,
      `listeners:${stageState.listeners || "idle"}`,
      `semanticZoom:${stageState.semanticZoom || "idle"}`,
      `firstFrame:${stageState.firstFrame || "idle"}`,
    ].join(" · ");
    const rows = {
      "sphere-diag-requested":    _state.requestedRendererMode || "auto",
      "sphere-diag-active":       _state.activeRendererMode || (_state.active3d ? "3d" : "svg"),
      "sphere-diag-fallback":     _state.active3d ? "none" : (diag.lastInitError?.reason || _state.rendererLifecycle || "none"),
      "sphere-diag-webgl":        diag.webglAvailable ? "available" : "unavailable",
      "sphere-diag-webgl2":       diag.webgl2Available ? "available" : "unavailable",
      "sphere-diag-lib-version":  diag.threeVersion || r3d.THREE_VERSION || "—",
      "sphere-diag-module-source": diag.moduleSource || "none",
      "sphere-diag-local-url":    diag.localModuleUrl || r3d.THREE_LOCAL_REL || "—",
      "sphere-diag-canvas-size":  diag.canvasWidth && diag.canvasHeight ? `${diag.canvasWidth} × ${diag.canvasHeight}` : "—",
      "sphere-diag-dpr":          `${diag.requestedDevicePixelRatio || "—"} → ${diag.appliedDevicePixelRatio || "—"}`,
      "sphere-diag-quality":      _state.quality,
      "sphere-diag-last-error":   diag.lastInitError ? `${diag.lastInitError.reason}: ${diag.lastInitError.detail || ""}` : "none",
      "sphere-diag-init-duration-warn": diag.initDurationMs != null ? `${diag.initDurationMs}ms` : "—",
      "sphere-diag-restore-attempts-warn": String(diag.restoreAttempts || 0),
      "sphere-diag-camera-distance": semantic.distance != null ? `${Number(semantic.distance).toFixed(3)}` : "—",
      "sphere-diag-semantic-band": semantic.band || "—",
      "sphere-diag-semantic-prev-band": semantic.previousBand || "—",
      "sphere-diag-semantic-threshold": semantic.transitionThreshold != null ? String(semantic.transitionThreshold) : "—",
      "sphere-diag-label-budget": semantic.moonLabelMode || semantic.dayLabelMode
        ? `${semantic.moonLabelMode || "—"} moon · ${semantic.dayLabelMode || "—"} day`
        : "—",
      "sphere-diag-connection-budget": semantic.maxConnections != null ? String(semantic.maxConnections) : "—",
      "sphere-diag-visible-day-nodes": semantic.visibleDayNodes != null ? String(semantic.visibleDayNodes) : "—",
      "sphere-diag-visible-moon-labels": semantic.visibleMoonLabels != null ? String(semantic.visibleMoonLabels) : "—",
      "sphere-diag-visible-connections": semantic.visibleConnections != null ? String(semantic.visibleConnections) : "—",
      "sphere-diag-svg-visible":  containerHasSvg() ? "yes" : "no",
      "sphere-diag-3d-inflight":  _state._3dInitInProgress ? "yes" : "no",
      "sphere-diag-3d-attempt":   String(Number(_state._3dInitGeneration || 0)),
      "sphere-diag-3d-ready":     _state.active3d ? "yes" : "no",
      "sphere-diag-first-frame-ts": Number(diag.firstFrameTimestamp || 0) > 0 ? String(Number(diag.firstFrameTimestamp)) : "—",
      "sphere-diag-last-render-ts": Number(diag.lastRenderTimestamp || _state.lastRenderTimestamp || 0) > 0 ? String(Number(diag.lastRenderTimestamp || _state.lastRenderTimestamp || 0)) : "—",
      "sphere-diag-current-layers": Object.entries(_state.visibleLayers || {}).filter(([, enabled]) => !!enabled).map(([key]) => key).join(",") || "none",
      "sphere-diag-explicit-layers": _urlHasExplicitLayers ? "yes" : "no",
      "sphere-diag-env-state": _state.environmentLifecycle || "idle",
      "sphere-diag-container-size": `${Math.round(Number(_state._latestContainerSize?.w || 0))} × ${Math.round(Number(_state._latestContainerSize?.h || 0))}`,
      "sphere-diag-view-requested": _state.requestedViewMode || _state.viewMode || "today",
      "sphere-diag-view-active": _state.activeViewMode || _state.viewMode || "today",
      "sphere-diag-view-previous": _state.previousViewMode || "today",
      "sphere-diag-view-transition-state": _state.modeTransitionState || "idle",
      "sphere-diag-view-transition-rev": String(Number(_state.modeTransitionRevision || 0)),
      "sphere-diag-view-transition-ms": Number(_state.lastModeTransitionDuration || 0) > 0 ? `${Number(_state.lastModeTransitionDuration).toFixed(2)}ms` : "—",
      "sphere-diag-layer-state-source": _state.layerStateSource || "default",
      "sphere-diag-bootstrap-stage": bootstrapStage,
      "sphere-diag-stage-trace": stageTrace,
      "sphere-diag-build-identity": buildIdentity,
      "sphere-diag-sw": swText,
      "sphere-diag-cache-storage": storageText,
      "sphere-diag-deep-link": deepLinkText,
    };
    for (const [id, val] of Object.entries(rows)) {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    }
    const connectionDebug = document.getElementById("sphere-diag-connections-debug");
    if (connectionDebug) {
      const lines = Array.isArray(diag.connectionDiagnostics)
        ? diag.connectionDiagnostics.slice(0, 24).map(item => {
          const status = item.visible ? "visible" : `hidden:${item.hiddenReason || "unknown"}`;
          return `${item.id} · ${item.relationType}\n  ${item.sourceType}:${item.sourceId || "—"} -> ${item.targetType}:${item.targetId || "—"}\n  ${status}`;
        })
        : [];
      connectionDebug.textContent = lines.length ? lines.join("\n") : "No connection diagnostics available.";
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

  function _setModeDefaultLayers(mode) {
    if (_urlHasExplicitLayers) return;
    if (_state.userCustomizedLayers) return;
    _state.layerStateSource = "mode-default";
    if (mode === "today") {
      _state.visibleLayers.exactDays = true;
      _state.visibleLayers.weekGates = true;
      _state.visibleLayers.connections = true;
      _state.visibleLayers.spiral = false;
      _state.visibleLayers.recurrence = false;
      _state.visibleLayers.solar = false;
    } else if (mode === "pattern") {
      _state.visibleLayers.exactDays = true;
      _state.visibleLayers.weekGates = true;
      _state.visibleLayers.connections = true;
      _state.visibleLayers.spiral = false;
      _state.visibleLayers.recurrence = false;
    } else if (mode === "years") {
      _state.visibleLayers.exactDays = false;
      _state.visibleLayers.weekGates = false;
      _state.visibleLayers.connections = true;
      _state.visibleLayers.spiral = true;
    } else if (mode === "passage") {
      _state.visibleLayers.exactDays = true;
      _state.visibleLayers.weekGates = true;
      _state.visibleLayers.connections = true;
      _state.visibleLayers.spiral = false;
    }
    Object.keys(_state.visibleLayers).forEach(layer => {
      const cb = document.getElementById(`sphere-layer-${layer}`);
      if (cb) cb.checked = _state.visibleLayers[layer];
    });
  }

  function _updateModeSummary(model) {
    const el = document.getElementById("sphere-mode-summary");
    if (!el) return;
    const mode = _state.viewMode;
    if (mode === "today") {
      el.textContent = "Today view";
    } else if (mode === "passage") {
      el.textContent = `${model?.year || "—"} Equinox passage`;
    } else if (mode === "years") {
      el.textContent = `2014–2026 Alignment spiral · Year ${_state.year}`;
    } else if (mode === "pattern") {
      el.textContent = "13 Moons × 28 Days";
    }
  }

  function _updateWhatAmISeeing(mode) {
    const el = document.getElementById("sphere-what-am-i-seeing-body");
    if (!el) return;
    const selected = _resolveSelectedPatternPosition(buildCurrentModel());
    const texts = {
      today:   `This view places the active Pattern day inside the fixed 13 × 28 calendar. The bright marker highlights ${selected?.moon != null ? `Moon ${selected.moon} Day ${selected.day}` : "the selected day"}, and the lunar marker remains independent of the Pattern ring.`,
      passage: "This view shows the distance between the March Equinox and Moon 1 Day 1 for the selected year. The passage arc, Year Gate, and selected day stay aligned to the same calendar engine.",
      years:   "This view compares the Equinox position and Passage duration across 2014–2026. Tap a year marker to inspect that year, while the selected day stays readable in the detail panel.",
      pattern: "This view shows the full 13 × 28 geometry. Day dots mark all 364 counted days, Shabbat gates, the selected day, and today without leaving the current visual system."
    };
    el.textContent = texts[mode] || "";
  }

  function _updateStateStrip(viewMode, model) {
    const strips = [
      document.getElementById("sphere-state-strip"),
    ].filter(Boolean);
    if (!strips.length) return;
    const year = _state.year || 2026;
    const selected = model?.selectedPatternPosition || _resolveSelectedPatternPosition(model);
    let text = "";
    if (viewMode === "today" && model) {
      text = _selectedDaySummary(selected);
    } else if (viewMode === "passage" && model) {
      const rec = model.sourceRecord;
      const startMoon = rec?.equinox?.patternPosition?.moon ?? "";
      const startDay  = rec?.equinox?.patternPosition?.day  ?? "";
      const selectedLabel = selected?.moon != null ? `Selected Moon ${selected.moon} Day ${selected.day}` : "Selected day unavailable";
      text = `${year} Passage · Moon ${startMoon} Day ${startDay} → Moon 1 Day 1 · ${selectedLabel}`;
    } else if (viewMode === "years") {
      const selectedLabel = selected?.moon != null ? `Moon ${selected.moon} · Day ${selected.day}` : "No day selected";
      text = `Alignment Spiral · 2014–2026 · Year ${year} · ${selectedLabel}`;
    } else if (viewMode === "pattern") {
      text = selected?.moon != null
        ? `13 Moons × 28 Days · Moon ${selected.moon} · Day ${selected.day} · Day ${selected.dayOfPatternYear}/364`
        : "13 Moons × 28 Days";
    }
    strips.forEach(strip => { strip.textContent = text; });
  }

  function _updateEnvironmentBridge(model) {
    const bridge = document.getElementById("sphere-environment-bridge");
    const textEl = document.getElementById("sphere-environment-bridge-text");
    if (!bridge || !textEl) return;
    const selected = model?.selectedPatternPosition || _resolveSelectedPatternPosition(model);
    const envState = globalThis.SofEnvironmentState?.getEnvironmentState?.() || null;
    _state.environmentLifecycle = _resolveEnvironmentLifecycle(envState);
    const layerVisible = !!_state.visibleLayers.environment;
    const place = envState?.place?.name || envState?.place?.label || "Location not set";
    const providerState = _state.environmentLifecycle || "idle";
    const providerLabel = providerState === "loading"
      ? "Weather loading in background"
      : providerState === "ready"
        ? "Weather ready"
        : providerState === "cached"
          ? "Weather cached"
          : providerState === "stale"
            ? "Weather stale"
            : providerState === "error"
              ? "Environment unavailable"
              : providerState === "location-needed"
                ? "Location required"
                : "Environment idle";
    const selectedLabel = selected?.moon != null
      ? `Moon ${selected.moon} Day ${selected.day}`
      : "Selected day unavailable";
    const layerLabel = layerVisible ? "Environment layer ON" : "Environment layer OFF";
    textEl.textContent = `${layerLabel} · ${providerLabel}${providerState === "loading" || providerState === "ready" || providerState === "cached" ? ` · ${place}` : ""} · mapped around ${selectedLabel}.`;
    bridge.classList.toggle("is-off", !layerVisible);
  }

  function _setModeDefaultSelectedMarker(mode) {
    if (mode === "today") _state.selectedMarker = "today";
    else if (mode === "passage") _state.selectedMarker = `eq-${_state.year}`;
    else if (mode === "years") _state.selectedMarker = `year-${_state.year}`;
    else if (mode === "pattern") _state.selectedMarker = "today";
  }

  function _syncModeButtons() {
    document.querySelectorAll("[id^='sphere-mode-']").forEach(b => b.setAttribute("aria-pressed", "false"));
    const active = document.getElementById(`sphere-mode-${_state.activeViewMode || _state.viewMode}`);
    if (active) active.setAttribute("aria-pressed", "true");
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
    const selected = model.selectedPatternPosition || _resolveSelectedPatternPosition(model);
    const yearRecord = model.sourceRecord || {};
    const yearPos = yearRecord?.equinox?.patternPosition || {};
    const offs = yearRecord?.offsets || {};
    const field = _fieldLayerSnapshot(selected, model);
    if (!field.environmentLayerReady && _state.visibleLayers.environment) {
      _state.visibleLayers.environment = false;
      _syncLayerCheckboxes();
    }
    const selectedLabel = selected?.moon != null ? `Moon ${selected.moon} · ${selected.moonName || "Unavailable"} · Day ${selected.day}` : "Unavailable";
    const day364 = selected?.dayOfPatternYear != null ? `Day ${selected.dayOfPatternYear}/364` : "Unavailable — selected day is outside the counted year.";
    const patternAngle = selected?.dayOfPatternYear != null
      ? `${globalThis.LivingTimeSphereModel.patternAngleForDayOfYear(selected.dayOfPatternYear).toFixed(1)}°`
      : "Unavailable";
    const shabbatLabel = selected?.moon == null
      ? "Unavailable — outside counted day set."
      : selected.shabbat
        ? "Shabbat Gate · Active"
        : `Common day · next Shabbat on Moon Day ${[2, 9, 16, 23].find(day => day > selected.day) || 2}`;
    const solarLabel = selected?.solar?.gate
      ? `${selected.solar.gate} · ${selected.solar.element || "—"}`
      : "Unavailable — solar layer not loaded for this date.";
    const seasonLabel = selected?.solar?.season?.label
      ? `${selected.solar.season.label} · ${Math.round((selected.solar.season.progress || 0) * 100)}%`
      : "Unavailable — seasonal progress not loaded.";
    const yearSummary = _state.viewMode === "years"
      ? `<div class="sphere-details-section">
          <h4 class="sphere-details-subheading">Year layer</h4>
          <dl class="sphere-details-grid">
            <dt>Selected year</dt><dd>${_escapeHtml(_state.year)}</dd>
            <dt>Equinox Gate</dt><dd>Moon ${_escapeHtml(yearPos.moon || "—")} · Day ${_escapeHtml(yearPos.day || "—")}</dd>
            <dt>Year Gate</dt><dd>Moon 1 · Day 1 · April 17, 2026 anchor</dd>
            <dt>Passage span</dt><dd>${_escapeHtml(Number(((offs.equinoxToYearGateDays || 0) * 24).toFixed(1)))} hours</dd>
            <dt>Equinox angle</dt><dd>${_escapeHtml(model.passageStartAngle?.toFixed(1) || "Unavailable")}°</dd>
          </dl>
        </div>`
      : "";

    const renderFieldCard = item => {
      const comparedDimensions = Array.isArray(item.comparedDimensions) && item.comparedDimensions.length
        ? `<li>${item.comparedDimensions.map(value => _escapeHtml(value)).join("</li><li>")}</li>`
        : "";
      const missingDimensions = Array.isArray(item.missingDimensions) && item.missingDimensions.length
        ? `<li>${item.missingDimensions.map(value => _escapeHtml(value)).join("</li><li>")}</li>`
        : "";
      const actionLink = item.actionHref && item.actionLabel
        ? `<a class="sphere-field-link" href="${_escapeHtml(item.actionHref)}">${_escapeHtml(item.actionLabel)}</a>`
        : "";
      const canToggle = !!item.layerId && item.status !== "Unavailable" && item.status !== "Not checked";
      const toggleLabel = canToggle
        ? `${item.visibleOnSphere ? "Hide on Sphere" : "Show on Sphere"}`
        : "Not available on Sphere";
      const toggleDisabled = canToggle ? "" : " disabled";
      return `<article class="sphere-field-card${item.hierarchy === "Always available" ? " is-core" : " is-conditional"}">
          <div class="sphere-field-head">
            <div>
              <h5 class="sphere-field-title">${_escapeHtml(item.label)}</h5>
              <p class="sphere-field-value">${_escapeHtml(item.value)}</p>
            </div>
            <div class="sphere-field-badges">
              <span class="sphere-status-chip sphere-status-${_escapeHtml(item.status.toLowerCase().replace(/\s+/g, "-"))}">${_escapeHtml(item.status)}</span>
              <span class="sphere-availability-chip">${_escapeHtml(item.hierarchy)}</span>
            </div>
          </div>
          <div class="sphere-field-meta">
            <div><span>Status</span><strong>${_escapeHtml(item.status)}</strong></div>
            <div><span>Source</span><strong>${_escapeHtml(item.source)}</strong></div>
            <div><span>Timestamp</span><strong>${_escapeHtml(item.timestamp ? _formatLocalInstant(item.timestamp) : "Not recorded")}</strong></div>
            <div><span>Freshness</span><strong>${_escapeHtml(item.freshness)}</strong></div>
            <div><span>Availability</span><strong>${_escapeHtml(item.availability)}</strong></div>
            <div><span>Pattern relation</span><strong>${_escapeHtml(item.relation)}</strong></div>
            <div><span>Sphere layer</span><strong>${_escapeHtml(item.sphereLabel)} · ${item.visibleOnSphere ? "On" : "Off"}</strong></div>
            <div><span>Historical comparison</span><strong>${_escapeHtml(item.comparison)}</strong></div>
          </div>
          <div class="sphere-field-actions">
            <button class="sphere-btn sphere-btn-sm" type="button" data-field-layer="${_escapeHtml(item.id)}"${toggleDisabled}>${_escapeHtml(toggleLabel)}</button>
            ${actionLink}
          </div>
          ${(comparedDimensions || missingDimensions) ? `<details class="sphere-field-details">
            <summary>Comparison details</summary>
            ${comparedDimensions ? `<div><strong>Compared dimensions</strong><ul class="sphere-inline-list">${comparedDimensions}</ul></div>` : ""}
            ${missingDimensions ? `<div><strong>Missing dimensions</strong><ul class="sphere-inline-list">${missingDimensions}</ul></div>` : ""}
          </details>` : ""}
        </article>`;
    };

    const fieldCards = field.fields.map(renderFieldCard).join("");
    const matrixRows = (field.sensorMatrix || []).map(row => `
      <div class="sphere-sensor-row" data-sensor-row="${_escapeHtml(row.key)}">
        <span class="sphere-sensor-label">${_escapeHtml(row.label)}</span>
        <strong class="sphere-sensor-value">${_escapeHtml(row.value)}</strong>
      </div>
    `).join("");
    const livingContextEntries = [
      ["Witness", field.livingContext.witness],
      ["Environment", field.livingContext.environment],
      ["Recurrence", field.livingContext.recurrence],
      ["Selected Pattern position", field.livingContext.selectedPatternPosition],
      ["Solar context", field.livingContext.solarContext],
      ["Lunar context", field.livingContext.lunarContext],
      ["Field connections", field.livingContext.fieldConnections],
    ].map(([label, value]) => `<dt>${_escapeHtml(label)}</dt><dd>${_escapeHtml(value)}</dd>`).join("");
    const sourcesEntries = [
      ["Pattern engine version", field.sources.patternEngineVersion],
      ["Astronomy dataset version", field.sources.astronomyDatasetVersion],
      ["Environment provider", field.sources.environmentProvider],
      ["Last environment update", field.sources.lastEnvironmentUpdate ? _formatLocalInstant(field.sources.lastEnvironmentUpdate) : "Not recorded"],
      ["Sunset source", field.sources.sunsetSource],
      ["Solar calculation source", field.sources.solarCalculationSource],
      ["Lunar calculation source", field.sources.lunarCalculationSource],
      ["Witness storage state", field.sources.witnessStorageState],
      ["Recurrence dataset range", field.sources.recurrenceDatasetRange],
    ].map(([label, value]) => `<dt>${_escapeHtml(label)}</dt><dd>${_escapeHtml(value)}</dd>`).join("");
    const refreshDisabled = field.providerConfigured ? "" : " disabled";
    const refreshHelp = field.providerConfigured
      ? "Live provider ready."
      : "Live data becomes available after a weather or geomagnetic provider is configured.";

    el.innerHTML = `
      <h3 class="sphere-details-heading">Selected day details</h3>
      <div class="sphere-details-section">
        <h4 class="sphere-details-subheading">Selected Day</h4>
        <dl class="sphere-details-grid">
          <dt>Pattern</dt><dd>${_escapeHtml(selectedLabel)}</dd>
          <dt>Day of 364</dt><dd>${_escapeHtml(day364)}</dd>
          <dt>Pattern angle</dt><dd>${_escapeHtml(patternAngle)}</dd>
          <dt>Pattern date</dt><dd>${_escapeHtml(selected?.effectiveDate || "Unavailable — date conversion failed.")}</dd>
          <dt>Day Seal</dt><dd>${_escapeHtml(selected?.daySeal || "Unavailable")} <span class="sphere-inline-note">${_escapeHtml(selected?.daySealMeaning || "")}</span></dd>
          <dt>Week Gate</dt><dd>${_escapeHtml(selected?.weekGate?.[0] || "Unavailable — week gate missing.")}</dd>
          <dt>Shabbat Gate</dt><dd>${_escapeHtml(shabbatLabel)}</dd>
          <dt>Lunar phase</dt><dd>${_escapeHtml(selected?.lunarPhase || "Unavailable — moon phase service not loaded.")}${selected?.lunarIllumination != null ? ` · ${_escapeHtml(selected.lunarIllumination)}%` : ""}</dd>
          <dt>Solar gate</dt><dd>${_escapeHtml(solarLabel)}</dd>
          <dt>Season gate</dt><dd>${_escapeHtml(seasonLabel)}</dd>
          <dt>Mirror summary</dt><dd>${_escapeHtml(selected?.shortMirror || "Unavailable — no mirror summary stored for this day.")}</dd>
          <dt>Witness prompt</dt><dd>${_escapeHtml(selected?.witnessPrompt || "Observe the day and record what is actually there.")}</dd>
        </dl>
      </div>
      <div class="sphere-details-section">
        <h4 class="sphere-details-subheading">Field Layer</h4>
        <p class="sphere-field-range-note">Range · ${_escapeHtml(field.rangeLabel)} · ${_escapeHtml(field.dateClass?.label || "Current civil time")}</p>
        <p class="sphere-field-note"><strong>Location</strong> · ${_escapeHtml(field.locationName || "Set location")}</p>
        <div class="sphere-sensor-matrix" aria-label="Environmental sensor matrix">
          ${matrixRows}
        </div>
        <p class="sphere-field-note">${field.environmentLayerReady ? "Environmental layers are active from live values." : "Set a location to activate environmental layers."}</p>
        <div class="sphere-field-summary">
          <div>
            <p class="sphere-field-summary-label">Active Fields</p>
            <div class="sphere-field-summary-list">${field.summaryItems.map(item => `<span class="sphere-field-summary-pill">${_escapeHtml(item)}</span>`).join("")}</div>
          </div>
        </div>
        <details class="sphere-field-disclosure">
          <summary>Expanded field details</summary>
          <div class="sphere-field-cards">${fieldCards}</div>
        </details>
        <details class="sphere-field-disclosure">
          <summary>Sources and freshness</summary>
          <dl class="sphere-details-grid sphere-details-grid-tight">${sourcesEntries}</dl>
        </details>
        <div class="sphere-actions sphere-field-footer-actions">
          <button class="sphere-btn" type="button" data-sphere-action="refresh-live"${refreshDisabled}>Refresh Live Fields</button>
          <a class="sphere-btn" href="${_escapeHtml((field.fields.find(item => item.id === "witness")?.actionHref) || "./ledger.html")}">Record Observation</a>
          <button class="sphere-btn" type="button" data-sphere-action="open-field-map">Open Field Map</button>
          <button class="sphere-btn sphere-btn-primary" type="button" data-sphere-action="show-fields">Show Fields on Sphere</button>
          <a class="sphere-btn" href="${_escapeHtml(_buildAlignmentLink("recurrence"))}">Compare Historical Fields</a>
        </div>
        <p class="sphere-field-note">${_escapeHtml(refreshHelp)}</p>
      </div>
      ${yearSummary}
      <div class="sphere-details-section">
        <h4 class="sphere-details-subheading">Living context</h4>
        <dl class="sphere-details-grid">${livingContextEntries}</dl>
      </div>
      <p class="sphere-core-note"><strong>Pattern Core</strong> — the fixed center reflects the same 13 × 28 calendar engine used by Today, Passage, Years, and Pattern views.</p>`;

    el.querySelectorAll("[data-field-layer]").forEach(button => {
      button.addEventListener("click", () => {
        const id = button.getAttribute("data-field-layer");
        const item = field.fields.find(entry => entry.id === id);
        if (!item?.layerId) return;
        _state.userCustomizedLayers = true;
        _state.layerStateSource = "user-customized";
        _setMappedLayer(item.layerId, !_mappedLayerVisible(item.layerId));
        _syncLayerCheckboxes();
        renderSphere(document.getElementById("sphere-container"));
      });
    });

    el.querySelectorAll("[data-sphere-action]").forEach(button => {
      button.addEventListener("click", () => {
        const action = button.getAttribute("data-sphere-action");
        if (action === "show-fields") {
          _state.userCustomizedLayers = true;
          _state.layerStateSource = "user-customized";
          field.fields.forEach(item => {
            if (item.layerId && item.status !== "Unavailable" && item.status !== "Not checked") {
              _setMappedLayer(item.layerId, true);
            }
          });
          _syncLayerCheckboxes();
          renderSphere(document.getElementById("sphere-container"));
        } else if (action === "open-field-map") {
          const wrapper = document.getElementById("sphere-container");
          if (wrapper?.scrollIntoView) wrapper.scrollIntoView({ behavior: "smooth", block: "center" });
        } else if (action === "refresh-live" && field.providerConfigured) {
          Promise.resolve(globalThis.OpenMeteoAdapter?.requestRefresh?.({ force: true }))
            .catch(() => null)
            .finally(() => renderSphere(document.getElementById("sphere-container")));
        }
      });
    });

    const openMoons = document.getElementById("sphere-day-open-moons");
    if (openMoons && selected?.effectiveDate) {
      openMoons.href = _buildMoonsLink(selected);
    }
  }

  function _recordSelectedUpdateMetric(metric) {
    _state.selectedUpdateMetrics.push(metric);
    if (_state.selectedUpdateMetrics.length > 120) _state.selectedUpdateMetrics.shift();
  }

  function _installSelectedDayLongTaskObserver() {
    if (_state._selectedLongTaskObserver) return;
    if (typeof PerformanceObserver === "undefined") return;
    if (!PerformanceObserver.supportedEntryTypes?.includes?.("longtask")) return;
    try {
      _state._selectedLongTaskObserver = new PerformanceObserver(list => {
        list.getEntries().forEach(entry => {
          if (_state.selectedUpdateStatus !== "updating") return;
          _state.selectedUpdateLongTasks.push({
            at: Date.now(),
            duration: Number(entry.duration || 0),
            name: entry.name || "longtask",
          });
          if (_state.selectedUpdateLongTasks.length > 80) _state.selectedUpdateLongTasks.shift();
        });
      });
      _state._selectedLongTaskObserver.observe({ entryTypes: ["longtask"] });
    } catch {
      _state._selectedLongTaskObserver = null;
    }
  }

  function _resolveEffectiveRenderState(model, spiral, container) {
    const semanticZoom = _resolveSemanticZoomState(container);
    _state.semanticZoom = semanticZoom;
    const effectiveLayers = semanticZoom?.visibility ? { ..._state.visibleLayers, ...semanticZoom.visibility } : { ..._state.visibleLayers };
    const moonLabelExplicit = _state.moonLabelMode === "all" || _state.moonLabelMode === "selected" || _state.moonLabelMode === "hidden";
    const dayLabelExplicit = _state.dayLabelMode === "all" || _state.dayLabelMode === "selected" || _state.dayLabelMode === "hidden";
    const effectiveMoonLabelMode = moonLabelExplicit ? _state.moonLabelMode : (semanticZoom?.moonLabelMode || _state.moonLabelMode);
    const effectiveDayLabelMode = dayLabelExplicit ? _state.dayLabelMode : (semanticZoom?.dayLabelMode || _state.dayLabelMode);
    const effectiveConnectionMode = semanticZoom?.connectionMode || _state.connectionMode;
    const connectionRegistry = globalThis.LivingTimeSphereConnections?.buildRegistry?.({
      model,
      spiral,
      state: {
        ..._state,
        visibleLayers: effectiveLayers,
        connectionMode: effectiveConnectionMode,
        moonLabelMode: effectiveMoonLabelMode,
        dayLabelMode: effectiveDayLabelMode,
      },
    }) || [];
    return {
      semanticZoom,
      effectiveLayers,
      effectiveMoonLabelMode,
      effectiveDayLabelMode,
      connectionRegistry,
    };
  }

  async function _flushSelectedDayUpdates(container) {
    if (_state.selectedUpdateInFlight || !container) return;
    _state.selectedUpdateInFlight = true;
    while (_state.pendingSelectedDay != null) {
      const nextDay = _clampPatternDay(_state.pendingSelectedDay);
      _state.pendingSelectedDay = null;
      const revision = ++_state.selectedUpdateRevision;
      const startedAt = performance.now();
      _state.selectedUpdateStatus = "updating";
      _setDayNavDisabled(true);
      const watchdog = setTimeout(() => {
        if (_state.selectedUpdateStatus !== "updating" || _state.selectedUpdateRevision !== revision) return;
        const rendererDiag = globalThis.LivingTimeSphereRenderer3d?.getDiagnostics?.() || {};
        _state.selectedUpdateLastWatchdog = {
          revision,
          selectedDay: _state.selectedDayOfYear,
          pendingSelectedDay: _state.pendingSelectedDay,
          rendererState: _state.rendererLifecycle,
          sceneObjectCount: Number(rendererDiag.sceneObjectCount || 0),
          lastFrameTime: Number(rendererDiag.lastRenderTimestamp || 0),
          firedAt: Date.now(),
        };
      }, 1400);

      const previous = {
        selectedDayOfYear: _state.selectedDayOfYear,
        selectedMarker: _state.selectedMarker,
      };
      try {
        _state.selectedDayOfYear = nextDay;
        _state.selectedMarker = `day-${nextDay}`;
        _persistSelectedState();
        const stateAppliedAt = performance.now();

        const model = buildCurrentModel();
        _syncDaySelectorsFromModel(model);
        const selectorsSyncedAt = performance.now();
        _updateSphereUrlFromModel(model, { replace: true });
        const urlSyncedAt = performance.now();

        const spiral = _getCachedSpiral();
        const effective = _resolveEffectiveRenderState(model, spiral, container);
        let incrementalUsed = false;
        const renderer = globalThis.LivingTimeSphereRenderer3d;
        if (_state.active3d && renderer?.isInitialized?.() && typeof renderer.updateSelectedState === "function") {
          incrementalUsed = renderer.updateSelectedState({
            model,
            selectedYear: _state.year,
            visibleLayers: effective.effectiveLayers,
            viewMode: _state.viewMode,
            moonLabelMode: effective.effectiveMoonLabelMode,
            moonLabelDistance: _state.moonLabelDistance,
            dayLabelMode: effective.effectiveDayLabelMode,
            connectionRegistry: effective.connectionRegistry,
            motionMode: _state.motionMode,
            semanticZoomState: effective.semanticZoom,
            skipCameraFocus: true,
          });
        }
        const renderAppliedAt = performance.now();
        if (!incrementalUsed) {
          renderSphere(container);
        } else {
          _state.selectedLightweightUpdateCount += 1;
          updateAccessibleText(model, spiral);
          updateDetails(model);
          _updateTodayDiagnostics(model);
          _updateModeSummary(model);
          _updateWhatAmISeeing(_state.viewMode);
          _updateStateStrip(_state.viewMode, model);
          _updateEnvironmentBridge(model);
          _updateRendererDiagnostics();
        }
        _incrementActionCounter("selectedDayUpdateCount");
        _recordActionTrace("SELECTED_DAY_CHANGE", { selectedDayOfYear: nextDay }, incrementalUsed ? ["selected-state", "incremental-render"] : ["selected-state", "full-render"]);
        const completeAt = performance.now();
        _recordSelectedUpdateMetric({
          revision,
          day: nextDay,
          totalMs: Number((completeAt - startedAt).toFixed(2)),
          stateMs: Number((stateAppliedAt - startedAt).toFixed(2)),
          selectorSyncMs: Number((selectorsSyncedAt - stateAppliedAt).toFixed(2)),
          urlMs: Number((urlSyncedAt - selectorsSyncedAt).toFixed(2)),
          renderMs: Number((renderAppliedAt - urlSyncedAt).toFixed(2)),
          settleMs: Number((completeAt - renderAppliedAt).toFixed(2)),
          incrementalUsed,
        });
      } catch (error) {
        _state.selectedDayOfYear = previous.selectedDayOfYear;
        _state.selectedMarker = previous.selectedMarker;
        _persistSelectedState();
        renderSphere(container);
        console.warn("[LivingTimeSphere] Selected-day update failed; reverted to previous state.", error);
      } finally {
        clearTimeout(watchdog);
        if (_state.selectedUpdateRevision === revision) {
          _state.selectedUpdateStatus = "idle";
          _setDayNavDisabled(false);
        }
      }
    }
    _state.selectedUpdateInFlight = false;
  }

  function _requestSelectedDayUpdate(container, day) {
    _state.pendingSelectedDay = _clampPatternDay(day);
    _flushSelectedDayUpdates(container);
  }

  // ── Control wiring ─────────────────────────────────────────────────

  function wireControls(container) {
    const shiftSelectedDay = delta => {
      const baseDay = _state.selectedDayOfYear ?? _resolveSelectedDayOfYear(buildCurrentModel());
      _requestSelectedDayUpdate(container, baseDay + delta);
    };

    const shiftSelectedMoon = delta => {
      const model = buildCurrentModel();
      const selected = model.selectedPatternPosition || _resolveSelectedPatternPosition(model);
      const currentMoon = selected?.moon || 1;
      const currentDay = selected?.day || 1;
      const nextMoon = ((currentMoon - 1 + delta + 13) % 13) + 1;
      _requestSelectedDayUpdate(container, (nextMoon - 1) * 28 + currentDay);
    };

    const runGuardedNavAction = (actionId, handler) => () => {
      const now = Date.now();
      if (_state.lastNavActionId === actionId && now - Number(_state.lastNavActionAt || 0) < 24) return;
      _state.lastNavActionId = actionId;
      _state.lastNavActionAt = now;
      handler();
    };

    // View mode buttons.
    ["today", "passage", "years", "pattern"].forEach(mode => {
      const btn = document.getElementById(`sphere-mode-${mode}`);
      if (!btn) return;
      btn.addEventListener("click", () => {
        _requestViewModeTransition(container, mode);
      });
    });

    // Year select.
    const yearSelect = document.getElementById("sphere-year-select");
    if (yearSelect) {
      const years = typeof globalThis.AlignmentLedgerData?.listSupportedYears === "function"
        ? globalThis.AlignmentLedgerData.listSupportedYears()
        : Array.from({ length: 13 }, (_, i) => 2014 + i);
      yearSelect.innerHTML = years.map(y => `<option value="${y}"${y === _state.year ? " selected" : ""}>${y}</option>`).join("");
      yearSelect.addEventListener("change", () => {
        const y = Number(yearSelect.value);
        if (y) {
          _state.year = y;
          if (_state.viewMode === "today" && _currentSnapshot()?.pattern?.patternYear !== y) {
            _state.selectedDayOfYear = 1;
          }
          renderSphere(container);
        }
      });
    }

    Object.keys(FIELD_RANGE_LABELS).forEach(range => {
      const btn = document.getElementById(`sphere-field-range-${range}`);
      if (!btn) return;
      btn.addEventListener("click", () => {
        _applyFieldRangePreset(range);
        _syncFieldRangeButtons();
        _syncModeButtons();
        _syncLayerCheckboxes();
        renderSphere(container);
      });
    });
    _syncFieldRangeButtons();

    [
      ["sphere-prev-day", runGuardedNavAction("prev-day", () => shiftSelectedDay(-1))],
      ["sphere-next-day", runGuardedNavAction("next-day", () => shiftSelectedDay(1))],
      ["sphere-prev-moon", runGuardedNavAction("prev-moon", () => shiftSelectedMoon(-1))],
      ["sphere-next-moon", runGuardedNavAction("next-moon", () => shiftSelectedMoon(1))],
    ].forEach(([id, handler]) => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener("click", handler);
    });

    const moonSelect = document.getElementById("sphere-select-moon");
    const daySelect = document.getElementById("sphere-select-day");
    if (moonSelect) {
      moonSelect.addEventListener("change", () => {
        const moon = Math.max(1, Math.min(13, Number(moonSelect.value) || 1));
        const day = Math.max(1, Math.min(28, Number(daySelect?.value) || 1));
        _requestSelectedDayUpdate(container, (moon - 1) * 28 + day);
      });
    }
    if (daySelect) {
      daySelect.addEventListener("change", () => {
        const moon = Math.max(1, Math.min(13, Number(moonSelect?.value) || 1));
        const day = Math.max(1, Math.min(28, Number(daySelect.value) || 1));
        _requestSelectedDayUpdate(container, (moon - 1) * 28 + day);
      });
    }
    _syncDaySelectorsFromModel(buildCurrentModel());

    // Layer toggles.
    Object.keys(_state.visibleLayers).forEach(layer => {
      const cb = document.getElementById(`sphere-layer-${layer}`);
      if (!cb) return;
      cb.checked = _state.visibleLayers[layer];
      cb.addEventListener("change", () => {
        if (_syncingLayerControls) return;
        const next = !!cb.checked;
        _state.visibleLayers[layer] = next;
        _state.userCustomizedLayers = true;
        _state.layerStateSource = "user-customized";
        _incrementActionCounter("layerUpdateCount");
        _recordActionTrace("LAYER_VISIBILITY_CHANGE", { layer, enabled: next }, ["layers"]);
        _requestLayerStateUpdate(container, layer, next);
      });
    });
    const focusEnvironmentBtn = document.getElementById("sphere-environment-focus");
    if (focusEnvironmentBtn) {
      focusEnvironmentBtn.addEventListener("click", () => {
        _focusEnvironmentControls();
      });
    }

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
          source: _state.source || undefined,
          renderer:      _state.active3d ? "3d" : "svg",
          quality:       _state.quality,
          connectionMode:_state.connectionMode,
          motionMode:    _state.motionMode,
          moonLabelDistance: _state.moonLabelDistance,
          dayLabelMode:  _state.dayLabelMode,
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
      rendererSelect.value = _state.requestedRendererMode;
      rendererSelect.addEventListener("change", () => {
        const prev = _state.requestedRendererMode;
        _state.requestedRendererMode = rendererSelect.value || "auto";
        if (prev !== _state.requestedRendererMode && (prev === "3d" || prev === "auto") && _state.active3d) {
          _teardown3d();
        }
        if (_state.requestedRendererMode === "svg") _clearAutoRetry();
        _state.retryCount = 0;
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

    const moonLabelMode = document.getElementById("sphere-moon-label-mode");
    if (moonLabelMode) {
      moonLabelMode.value = _state.moonLabelMode;
      moonLabelMode.addEventListener("change", () => {
        _state.moonLabelMode = moonLabelMode.value || "contextual";
        _writeLocalSetting(MOON_LABEL_MODE_KEY, _state.moonLabelMode);
        renderSphere(container);
      });
    }

    const moonLabelDistance = document.getElementById("sphere-moon-label-distance");
    if (moonLabelDistance) {
      moonLabelDistance.value = _state.moonLabelDistance;
      moonLabelDistance.addEventListener("change", () => {
        _state.moonLabelDistance = moonLabelDistance.value || "standard";
        renderSphere(container);
      });
    }

    const dayLabelMode = document.getElementById("sphere-day-label-mode");
    if (dayLabelMode) {
      dayLabelMode.value = _state.dayLabelMode;
      dayLabelMode.addEventListener("change", () => {
        _state.dayLabelMode = dayLabelMode.value || "key";
        renderSphere(container);
      });
    }

    const connectionMode = document.getElementById("sphere-connection-mode");
    if (connectionMode) {
      connectionMode.value = _state.connectionMode;
      connectionMode.addEventListener("change", () => {
        _state.connectionMode = connectionMode.value || "contextual";
        renderSphere(container);
      });
    }

    const motionMode = document.getElementById("sphere-motion-mode");
    if (motionMode) {
      motionMode.value = _state.motionMode;
      motionMode.addEventListener("change", () => {
        _state.motionMode = motionMode.value || "still";
        if (_state.active3d && globalThis.LivingTimeSphereRenderer3d?.isInitialized?.()) {
          globalThis.LivingTimeSphereRenderer3d.setQuality(resolveQualityPreset());
        }
        renderSphere(container);
      });
    }

    // "Interact with Sphere" button for small screens.
    // Only active in 3D mode — _updateInteractBar() hides the bar in SVG mode.
    const interactBtn = document.getElementById("sphere-interact-btn");
    if (interactBtn) {
      const endBtn   = document.getElementById("sphere-interact-end-btn");
      const hintOff  = document.getElementById("sphere-hint-off");
      const hintOn   = document.getElementById("sphere-hint-on");

      function _setInteractOff() {
        interactBtn.style.display = "";
        if (endBtn)    endBtn.style.display    = "none";
        if (hintOff)   hintOff.style.display   = "";
        if (hintOn)    hintOn.style.display     = "none";
      }
      function _setInteractOn() {
        interactBtn.style.display = "none";
        if (endBtn)    endBtn.style.display     = "";
        if (hintOff)   hintOff.style.display    = "none";
        if (hintOn)    hintOn.style.display      = "";
      }

      // Initialise to "off" state
      if (endBtn) endBtn.style.display = "none";

      interactBtn.addEventListener("click", () => {
        if (!_state.active3d) return;
        _setInteractOn();
        container.dispatchEvent(new CustomEvent("sphere:interact-request-start", { bubbles: false }));
      });
      if (endBtn) {
        endBtn.addEventListener("click", () => {
          _setInteractOff();
          container.dispatchEvent(new CustomEvent("sphere:interact-request-end", { bubbles: false }));
        });
      }
      // Listen for interact events from 3D renderer.
      container.addEventListener("sphere:interact-start", () => {
        if (!_state.active3d) return;
        _setInteractOn();
      });
      container.addEventListener("sphere:interact-end", () => {
        _setInteractOff();
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
      _syncYearSelect(y);
      globalThis.LivingTimeSphereAccessibility.announce(`Year ${y} selected. Switching to Passage view.`);
      _requestViewModeTransition(container, "passage");
    });

    container.addEventListener("sphere:marker-select", e => {
      const marker = e.detail;
      if (!marker) return;
      if (marker.type === "day" && marker.dayOfPatternYear) {
        globalThis.LivingTimeSphereAccessibility?.announce?.(`Selected Pattern Moon ${marker.moon}, Day ${marker.day}, Day ${marker.dayOfPatternYear} of 364.`);
        _requestSelectedDayUpdate(container, marker.dayOfPatternYear);
      } else if (marker.type === "moon" && marker.moon) {
        globalThis.LivingTimeSphereAccessibility?.announce?.(`Selected Pattern Moon ${marker.moon}, Day ${Math.max(1, Math.min(28, marker.day || 1))}.`);
        _requestSelectedDayUpdate(container, (marker.moon - 1) * 28 + Math.max(1, Math.min(28, marker.day || 1)));
      }
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
        _state.requestedRendererMode = "3d";
        _state.activeRendererMode = "recovering";
        _state.retryCount = 0;
        _clearAutoRetry();
        _state._3dInitGeneration++;
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
        }
        for (const storage of [globalThis.localStorage, globalThis.sessionStorage]) {
          if (!storage) continue;
          try {
            const toDelete = [];
            for (let i = 0; i < storage.length; i++) {
              const key = storage.key(i);
              if (key && SPHERE_STORAGE_PREFIXES.some(prefix => key.startsWith(prefix))) {
                toDelete.push(key);
              }
            }
            toDelete.forEach(key => storage.removeItem(key));
          } catch { /* ignore */ }
        }
        if ("serviceWorker" in navigator) {
          try {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(reg => reg.unregister()));
          } catch { /* ignore */ }
        }
        clearCacheBtn.textContent = "Cache/state cleared — reloading…";
        setTimeout(() => location.reload(), 800);
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
        _state.requestedRendererMode = "svg";
        _state.activeRendererMode = "svg";
        _clearAutoRetry();
        const sel = document.getElementById("sphere-renderer-select");
        if (sel) sel.value = "svg";
        _minimizeRendererFallbackWarning();
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
    _state.initialUrl = typeof location !== "undefined" ? String(location.href || "") : "";
    _state.currentUrl = _state.initialUrl;
    _state.urlIntegrity = "preserved";
    _logBuildIdentityOnce();
    applyUrlState();
    _restoreSelectedStateIfNeeded();
    _state.moonLabelMode = _resolveMoonLabelMode();
    if (!_urlHasExplicitMoonLabelDistance) {
      _state.moonLabelDistance = _resolveMoonLabelDistance();
    }

    const container = document.getElementById("sphere-container");
    if (!container) return;
    _setRendererLifecycle("not-started");
    _installBrokenResourceGuard();
    _installResourceFailureTracker();
    _bindRecoveryHooks(container);
    _probeColdBootDiagnostics();
    globalThis.getSphereRuntimeDebugSnapshot = _collectRuntimeDebugSnapshot;
    _installSelectedDayLongTaskObserver();

    // Auto-open Sphere Settings panel on non-mobile viewports.
    const settingsGroup = document.querySelector(".sphere-settings-group");
    if (settingsGroup && window.innerWidth >= 600) {
      settingsGroup.open = true;
    }
    _setModeDefaultLayers(_state.viewMode);
    if (!_state.selectedMarker) _setModeDefaultSelectedMarker(_state.viewMode);
    _state.requestedViewMode = _state.viewMode;
    _state.activeViewMode = _state.viewMode;
    _state.previousViewMode = _state.viewMode;
    _syncModeButtons();

    // Hide the interact bar immediately — it will be shown only after
    // 3D init succeeds.  This prevents the "Exit Interaction" ghost state.
    _updateInteractBar();

    wireControls(container);
    wireInteraction(container);
    const environmentApi = globalThis.SofEnvironmentState;
    if (environmentApi?.getEnvironmentState && !environmentApi.getEnvironmentState()) {
      environmentApi.setEnvironmentState(environmentApi.EMPTY_STATE);
    }
    window.addEventListener("sof:location-changed", () => {
      _recordActionTrace("LOCATION_CHANGE", null, ["environment-provider-refresh"]);
      Promise.resolve(globalThis.OpenMeteoAdapter?.requestRefresh?.({ force: true }))
        .catch(() => null)
        .finally(() => renderSphere(container));
    });
    window.addEventListener(globalThis.SofEnvironmentState?.EVENT_NAME || "sof:environment-change", event => {
      const nextState = event?.detail?.state || globalThis.SofEnvironmentState?.getEnvironmentState?.() || null;
      _state.environmentLifecycle = _resolveEnvironmentLifecycle(nextState);
      _incrementActionCounter("environmentDataUpdateCount");
      const renderer = globalThis.LivingTimeSphereRenderer3d;
      if (_state.active3d && renderer?.isInitialized?.()) {
        renderer.updateEnvironment?.(nextState);
        _updateEnvironmentBridge(buildCurrentModel());
        _updateRendererDiagnostics();
        _recordActionTrace("ENVIRONMENT_DATA_CHANGE", { environmentLifecycle: _state.environmentLifecycle }, ["environment-data", "renderer-environment"]);
      } else if (_state.visibleLayers.environment) {
        renderSphere(container);
        _recordActionTrace("ENVIRONMENT_DATA_CHANGE", { environmentLifecycle: _state.environmentLifecycle }, ["environment-data", "full-render"]);
      } else {
        _updateEnvironmentBridge(buildCurrentModel());
        _updateRendererDiagnostics();
        _recordActionTrace("ENVIRONMENT_DATA_CHANGE", { environmentLifecycle: _state.environmentLifecycle }, ["environment-data", "ui-bridge-only"]);
      }
    });
    window.addEventListener("popstate", () => {
      _state.currentUrl = typeof location !== "undefined" ? String(location.href || "") : _state.currentUrl;
      _state.urlIntegrity = _evaluateDeepLinkIntegrity(_state.initialUrl, _state.currentUrl);
      const parsed = globalThis.LivingTimeSphereUrlState?.parseSphereUrl?.(location.href) || {};
      if (parsed.year) _state.year = parsed.year;
      if (parsed.viewMode) _state.requestedViewMode = parsed.viewMode;
      if (parsed.marker) _state.selectedMarker = parsed.marker;
      const markerDay = _selectedDayFromMarker(parsed.marker);
      if (markerDay != null) {
        _requestSelectedDayUpdate(container, markerDay);
      } else if (parsed.viewMode && parsed.viewMode !== _state.viewMode) {
        _requestViewModeTransition(container, parsed.viewMode);
      } else {
        renderSphere(container);
      }
    });

    // Defer first render by one animation frame so the container has a
    // stable, non-zero bounding rect before 3D dimensions are measured.
    requestAnimationFrame(() => {
      renderSphere(container);
    });

    // Re-render on resize (debounced).
    let resizeTimer;
    if (typeof ResizeObserver !== "undefined") {
      _state._resizeObserver?.disconnect?.();
      _state._resizeObserver = new ResizeObserver(() => {
        // Skip resize re-renders while 3D is still initializing — a
        // mid-init resize would start a second concurrent init call.
        if (_state._3dInitInProgress) return;
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          renderSphere(container);
        }, 150);
      });
      _state._resizeObserver.observe(container);
    }
  }

  function getSphereDiagnostics() {
    const container = document.getElementById("sphere-container");
    const rendererDiag = globalThis.LivingTimeSphereRenderer3d?.getDiagnostics?.() || {};
    const rect = container?.getBoundingClientRect?.() || { width: 0, height: 0 };
    const envState = globalThis.SofEnvironmentState?.getEnvironmentState?.() || null;
    let modelReady = false;
    try { modelReady = !!buildCurrentModel(); } catch { modelReady = false; }
    return {
      rendererState: _state.rendererLifecycle,
      requestedRendererMode: _state.requestedRendererMode,
      activeRendererMode: _state.activeRendererMode,
      modelReady,
      selectedDay: _state.selectedDayOfYear,
      requestedViewMode: _state.requestedViewMode || _state.viewMode,
      activeViewMode: _state.activeViewMode || _state.viewMode,
      previousViewMode: _state.previousViewMode || _state.viewMode,
      modeTransitionState: _state.modeTransitionState || "idle",
      modeTransitionRevision: Number(_state.modeTransitionRevision || 0),
      latestRequestedMode: _state.latestRequestedMode || null,
      lastModeTransitionDuration: Number(_state.lastModeTransitionDuration || 0),
      modeTransitionFailure: _state.modeTransitionFailure || null,
      modeTransitionMetrics: (_state.modeTransitionMetrics || []).slice(-20),
      baselineSvgVisible: !!container?.querySelector?.(".living-time-sphere-svg"),
      threeDInitInProgress: !!_state._3dInitInProgress,
      threeDInitAttempt: Number(_state._3dInitGeneration || 0),
      threeDReady: !!_state.active3d,
      canvasPresent: !!container?.querySelector?.("canvas"),
      canvasWidth: Number(rendererDiag.canvasWidth || 0),
      canvasHeight: Number(rendererDiag.canvasHeight || 0),
      containerWidth: Number(rect.width || 0),
      containerHeight: Number(rect.height || 0),
      webglAvailable: !!rendererDiag.webglAvailable,
      contextLost: rendererDiag.stageState?.context === "lost",
      lastRenderTimestamp: Number(rendererDiag.lastRenderTimestamp || _state.lastRenderTimestamp || 0),
      rafActive: !!rendererDiag.rafActive,
      first3dFrameTimestamp: Number(rendererDiag.firstFrameTimestamp || 0),
      environmentState: _resolveEnvironmentLifecycle(envState),
      currentLayerSet: Object.entries(_state.visibleLayers || {}).filter(([, enabled]) => !!enabled).map(([key]) => key),
      explicitUrlLayers: !!_urlHasExplicitLayers,
      locationState: envState?.providerConfigured ? "configured" : "location-needed",
      retryCount: Number(_state.retryCount || 0),
      fullRenderCount: Number(_state.fullRenderCount || 0),
      selectedLightweightUpdateCount: Number(_state.selectedLightweightUpdateCount || 0),
      modeUpdateCount: Number(_state.actionCounters?.modeUpdateCount || 0),
      selectedDayUpdateCount: Number(_state.actionCounters?.selectedDayUpdateCount || 0),
      layerUpdateCount: Number(_state.actionCounters?.layerUpdateCount || 0),
      environmentFocusCount: Number(_state.actionCounters?.environmentFocusCount || 0),
      environmentDataUpdateCount: Number(_state.actionCounters?.environmentDataUpdateCount || 0),
      rendererInitCount: Number(rendererDiag.rendererInitCount || 0),
      fullSceneBuildCount: Number(rendererDiag.sceneBuildCount || rendererDiag.sceneRootBuildCount || 0),
      fullModelBuildCount: Number(rendererDiag.modelBuildCount || 0),
      selectedUpdateRevision: Number(_state.selectedUpdateRevision || 0),
      selectedUpdateStatus: _state.selectedUpdateStatus,
      selectedUpdateMetrics: (_state.selectedUpdateMetrics || []).slice(-20),
      selectedUpdateLongTasks: (_state.selectedUpdateLongTasks || []).slice(-20),
      selectedUpdateLastWatchdog: _state.selectedUpdateLastWatchdog || null,
      runtimeDebug: _collectRuntimeDebugSnapshot(),
      actionTrace: (_state.actionTrace || []).slice(-60),
      environmentFocusDiagnostics: _state.lastEnvironmentFocusDiagnostics || null,
      layerStateSource: _state.layerStateSource || "default",
      userCustomizedLayers: !!_state.userCustomizedLayers,
      buildVersion: globalThis.LivingTimeSphereVersion?.buildMetadata || null,
      sphereRendererVersion: globalThis.LivingTimeSphereVersion?.version || null,
      buildIdentityLine: _resolveBuildIdentityLine(),
      deepLink: {
        initialUrl: _state.initialUrl || null,
        currentUrl: _state.currentUrl || (typeof location !== "undefined" ? location.href : null),
        integrity: _state.urlIntegrity || "unknown",
      },
      coldBootDiagnostics: _state.coldBootDiagnostics || null,
    };
  }

  globalThis.LivingTimeSphereUi = Object.freeze({
    init,
    getState: () => Object.assign({}, _state),
    renderSphere: (container) => renderSphere(container || document.getElementById("sphere-container")),
    getSphereDiagnostics,
  });
  globalThis.getSphereDiagnostics = getSphereDiagnostics;
})();
