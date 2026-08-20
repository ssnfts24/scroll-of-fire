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
    visibleLayers: { pattern: true, exactDays: true, weekGates: true, outsideDays: true, passage: true, lunar: true, solar: true, planets: true, markers: true, recurrence: true, spiral: true, environment: true, witness: false, personal: false, connections: true },
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
    _locationChangeRaf: 0,
    _recoveryHooksBound: false,
    _resizeObserver: null,
    _spiralCacheKey: "",
    _spiralCache: null,
    _liveSnapshotCacheKey: "",
    _liveSnapshotCache: null,
    _liveSnapshotCacheAt: 0,
    selectedUpdateStatus: "idle",
    selectedUpdateRevision: 0,
    pendingSelectedDay: null,
    pendingSelectedIntent: null,
    selectedUpdateInFlight: false,
    fullRenderCount: 0,
    selectedLightweightUpdateCount: 0,
    selectedUpdateMetrics: [],
    selectedUpdateLongTasks: [],
    selectedUpdateLastWatchdog: null,
    lastNavActionAt: 0,
    lastNavActionId: "",
    temporalPlaybackActive: false,
    temporalPlaybackTimer: 0,
    temporalPlaybackSpeed: 700,
    temporalPlaybackScope: "pattern-year",
    temporalPlaybackStepCount: 0,
    temporalScrubRaf: 0,
    temporalScrubPendingDay: null,
    lastTodayResetSource: null,
    lastTodayResetAt: 0,
    _selectedLongTaskObserver: null,
    layerStateSource: "default",
    userCustomizedLayers: false,
    actionCounters: {
      modeUpdateCount: 0,
      selectedDayUpdateCount: 0,
      layerUpdateCount: 0,
      environmentFocusCount: 0,
      environmentDataUpdateCount: 0,
      todayResetCount: 0,
      temporalPlaybackStepCount: 0,
    },
    actionTrace: [],
    lastEnvironmentFocusDiagnostics: null,
    initialUrl: "",
    currentUrl: "",
    urlIntegrity: "unknown",
    buildLogEmitted: false,
    coldBootDiagnostics: null,
    lastRenderSurfaceVerification: null,
    firstRenderSurfaceFailure: null,
    initTimeline: [],
    renderSurfaceCanvasTrace: [],
    _applyingHistoryState: false,
  };
  const URL_STATE_DEFAULTS = Object.freeze({
    year: 2026,
    viewMode: "today",
    timeZone: "America/Los_Angeles",
    boundaryMode: "sunset",
    manualSunset: "18:00",
    requestedRendererMode: "auto",
    quality: "auto",
    connectionMode: "contextual",
    motionMode: "still",
    moonLabelDistance: "standard",
    dayLabelMode: "key",
    visibleLayers: Object.freeze({ ..._state.visibleLayers }),
  });
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
  let _uiInitialized = false;
  const LAYER_PRESET_OPTIONS = Object.freeze(["fullObservatory", "cleanPattern", "livingSky", "weatherField", "passage", "witnessMap", "historicalField", "lowPower"]);

  let _urlHasExplicitLayers = false;
  let _urlHasExplicitMoonLabelDistance = false;
  let _syncingLayerControls = false;
  let _pendingLayerState = null;
  let _layerStateFlushRaf = 0;
  let _layerStateFlushContainer = null;
  let _resourceTrackerInstalled = false;
  const _resourceFailureLog = [];
  const SPHERE_MEDIA_TAGS = new Set(["IMG", "PICTURE", "SOURCE", "OBJECT", "IFRAME", "EMBED", "VIDEO", "SVG", "CANVAS"]);
  const RENDER_SURFACE_REASON = Object.freeze({
    CANVAS_MISSING: "CANVAS_MISSING",
    CANVAS_NOT_CONNECTED: "CANVAS_NOT_CONNECTED",
    CANVAS_WRONG_PARENT: "CANVAS_WRONG_PARENT",
    CANVAS_ZERO_WIDTH: "CANVAS_ZERO_WIDTH",
    CANVAS_ZERO_HEIGHT: "CANVAS_ZERO_HEIGHT",
    CANVAS_DISPLAY_NONE: "CANVAS_DISPLAY_NONE",
    CANVAS_VISIBILITY_HIDDEN: "CANVAS_VISIBILITY_HIDDEN",
    CANVAS_ZERO_OPACITY: "CANVAS_ZERO_OPACITY",
    CONTAINER_ZERO_WIDTH: "CONTAINER_ZERO_WIDTH",
    CONTAINER_ZERO_HEIGHT: "CONTAINER_ZERO_HEIGHT",
    WEBGL_CONTEXT_MISSING: "WEBGL_CONTEXT_MISSING",
    WEBGL_CONTEXT_LOST: "WEBGL_CONTEXT_LOST",
    FIRST_FRAME_MISSING: "FIRST_FRAME_MISSING",
    DUPLICATE_CANVAS: "DUPLICATE_CANVAS",
    STALE_RENDER_GENERATION: "STALE_RENDER_GENERATION",
    RENDERER_DISPOSED: "RENDERER_DISPOSED",
    DRAWING_BUFFER_ZERO: "DRAWING_BUFFER_ZERO",
    SCENE_EMPTY: "SCENE_EMPTY",
    CAMERA_INVALID: "CAMERA_INVALID",
    CANVAS_COVERED: "CANVAS_COVERED",
    BROKEN_MEDIA_IN_SURFACE: "BROKEN_MEDIA_IN_SURFACE",
  });
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

  function _applyParsedUrlState(parsed = {}, { initial = false } = {}) {
    const previousBoundaryKey = `${_state.timeZone}|${_state.boundaryMode}|${_state.manualSunset}`;
    const value = (key, fallback) => parsed[key] != null ? parsed[key] : (initial ? null : fallback);
    const nextYear = value("year", URL_STATE_DEFAULTS.year);
    const nextViewMode = value("viewMode", URL_STATE_DEFAULTS.viewMode);
    if (nextYear) _state.year = nextYear;
    if (nextViewMode) {
      _state.requestedViewMode = nextViewMode;
      if (initial) {
        _state.viewMode = nextViewMode;
        _state.activeViewMode = nextViewMode;
      }
    }
    _state.timeZone = value("timeZone", URL_STATE_DEFAULTS.timeZone) || _state.timeZone;
    _state.boundaryMode = value("boundaryMode", URL_STATE_DEFAULTS.boundaryMode) || _state.boundaryMode;
    _state.manualSunset = value("manualSunset", URL_STATE_DEFAULTS.manualSunset) || _state.manualSunset;
    if (Object.prototype.hasOwnProperty.call(parsed, "marker")) _state.selectedMarker = parsed.marker || null;
    if (initial) {
      if (parsed.source) _state.source = parsed.source;
      if (parsed.datasetVersion) _state.datasetVersion = parsed.datasetVersion;
    } else {
      _state.source = parsed.source || null;
      _state.datasetVersion = parsed.datasetVersion || null;
    }
    const markerDay = _selectedDayFromMarker(parsed.marker);
    if (markerDay != null) _state.selectedDayOfYear = markerDay;
    else if (!initial) _state.selectedDayOfYear = null;
    _state.requestedRendererMode = value("renderer", URL_STATE_DEFAULTS.requestedRendererMode) || _state.requestedRendererMode;
    _state.quality = value("quality", URL_STATE_DEFAULTS.quality) || _state.quality;
    _state.connectionMode = value("connectionMode", URL_STATE_DEFAULTS.connectionMode) || _state.connectionMode;
    _state.motionMode = value("motionMode", URL_STATE_DEFAULTS.motionMode) || _state.motionMode;
    _state.moonLabelDistance = value("moonLabelDistance", URL_STATE_DEFAULTS.moonLabelDistance) || _state.moonLabelDistance;
    _state.dayLabelMode = value("dayLabelMode", URL_STATE_DEFAULTS.dayLabelMode) || _state.dayLabelMode;
    if (parsed.hasExplicitLayers) {
      _urlHasExplicitLayers = true;
      _state.layerStateSource = "url-explicit";
      for (const key of Object.keys(_state.visibleLayers)) _state.visibleLayers[key] = false;
      for (const layer of (parsed.layers || [])) _state.visibleLayers[layer] = true;
    } else if (!initial) {
      _urlHasExplicitLayers = false;
      _state.layerStateSource = "url-default";
      Object.keys(_state.visibleLayers).forEach(layer => {
        _state.visibleLayers[layer] = !!URL_STATE_DEFAULTS.visibleLayers[layer];
      });
    }
    if ((parsed.cameraTheta != null || parsed.cameraDist != null) && globalThis.LivingTimeSphereCamera) {
      globalThis.LivingTimeSphereCamera.setState({ theta: parsed.cameraTheta, dist: parsed.cameraDist });
    }
    if (`${_state.timeZone}|${_state.boundaryMode}|${_state.manualSunset}` !== previousBoundaryKey) {
      _invalidateLiveSnapshotCache();
    }
    return markerDay;
  }

  function applyUrlState() {
    if (typeof location === "undefined") return;
    _urlHasExplicitLayers = false;
    _urlHasExplicitMoonLabelDistance = false;
    let parsedUrl = null;
    try { parsedUrl = new URL(location.href); } catch { parsedUrl = null; }
    if (parsedUrl?.searchParams?.has("moon_label_distance")) _urlHasExplicitMoonLabelDistance = true;
    const parsed = globalThis.LivingTimeSphereUrlState.parseSphereUrl(location.href);
    _applyParsedUrlState(parsed, { initial: true });
    _state.requestedViewMode = _state.viewMode;
    _state.activeViewMode = _state.viewMode;

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

  function _resolveAbsoluteResourceUrl(url) {
    if (!url) return null;
    try { return new URL(url, location.href).href; } catch { return url; }
  }

  function _isInvalidResourceUrl(url) {
    const value = String(url || "").trim();
    if (!value) return true;
    const lowered = value.toLowerCase();
    return lowered === "#" || lowered === "null" || lowered === "undefined" || lowered === "[object object]";
  }

  function _isSphereScopedElement(el) {
    if (!el || el.nodeType !== 1) return false;
    return !!(el.closest?.("#sphere-container") || el.closest?.("#sphere-moon-labels"));
  }

  function _resolveElementOwner(el) {
    if (!el || el.nodeType !== 1) return "unknown";
    if (el.closest?.("#sphere-container")) return "living-time-sphere-render-surface";
    if (el.closest?.("#sphere-moon-labels")) return "living-time-sphere-moon-labels";
    if (el.closest?.("[data-home-sphere-root]")) return "home-observatory-instrument";
    if (el.closest?.("main")) return "site-main";
    return "document";
  }

  function _captureResourceFailure(el, reason = "resource-error") {
    if (!el || el.nodeType !== 1) return;
    const entry = {
      reason,
      tagName: String(el.tagName || "").toUpperCase(),
      id: el.id || null,
      className: el.className || "",
      src: _resourceUrlForElement(el),
      currentSrc: el.currentSrc || null,
      absoluteUrl: _resolveAbsoluteResourceUrl(_resourceUrlForElement(el)),
      page: typeof location !== "undefined" ? String(location.pathname || "") : "",
      owner: _resolveElementOwner(el),
      parent: el.parentElement ? {
        tagName: String(el.parentElement.tagName || "").toUpperCase(),
        id: el.parentElement.id || null,
        className: el.parentElement.className || "",
      } : null,
      timestamp: Date.now(),
    };
    _resourceFailureLog.push(entry);
    if (_resourceFailureLog.length > 120) _resourceFailureLog.shift();
  }

  function _pruneInvalidSphereMedia(container, reason = "invalid-sphere-media") {
    if (!container?.querySelectorAll) return [];
    const removed = [];
    const nodes = Array.from(container.querySelectorAll("img,object,iframe,embed,video,picture,source,svg image"));
    nodes.forEach(node => {
      if (!node || node.nodeType !== 1) return;
      const tag = String(node.tagName || "").toUpperCase();
      const src = _resourceUrlForElement(node);
      const failedImage = tag === "IMG" && node.complete === true && Number(node.naturalWidth || 0) === 0;
      if (!_isInvalidResourceUrl(src) && !failedImage) return;
      _captureResourceFailure(node, reason);
      const inspected = _inspectElementNode(node);
      if (inspected) removed.push(inspected);
      try { node.remove(); } catch { /* best effort */ }
      const shell = node.closest?.("picture,figure,[data-home-product-media],[data-home-media-card],.home-product-slide");
      if (shell) shell.remove?.();
    });
    return removed;
  }

  function _installResourceFailureTracker() {
    if (_resourceTrackerInstalled) return;
    _resourceTrackerInstalled = true;
    window.addEventListener("error", event => {
      const el = event?.target;
      if (!el || el.nodeType !== 1) return;
      const tag = String(el.tagName || "").toUpperCase();
      if (!["IMG", "PICTURE", "SOURCE", "OBJECT", "IFRAME", "EMBED", "VIDEO", "SVG", "CANVAS"].includes(tag)) return;
      if (!_isSphereScopedElement(el)) return;
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
      isConnected: !!node.isConnected,
      hidden: !!node.hidden,
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
      pointerEvents: style?.pointerEvents || "",
      display: style?.display || "",
      visibility: style?.visibility || "",
      opacity: style?.opacity || "",
      overflow: style?.overflow || "",
      src: _resourceUrlForElement(node),
      currentSrc: node.currentSrc || "",
      absoluteUrl: _resolveAbsoluteResourceUrl(_resourceUrlForElement(node)),
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

  function _collectAncestorIdentity(node, limit = 12) {
    const list = [];
    let cur = node;
    while (cur && cur.nodeType === 1 && list.length < limit) {
      list.push({
        tagName: String(cur.tagName || "").toUpperCase(),
        id: cur.id || "",
        className: cur.className || "",
      });
      if (cur.id || cur.getAttribute?.("data-home-sphere-root") || cur.getAttribute?.("data-luxury-instrument")) break;
      cur = cur.parentElement;
    }
    return list;
  }

  function _probeBottomBrokenResource() {
    const viewport = { width: Number(window.innerWidth || 0), height: Number(window.innerHeight || 0) };
    if (!viewport.width || !viewport.height) return null;
    const point = { x: Math.max(0, Math.round(viewport.width / 2)), y: Math.max(0, Math.round(viewport.height - 32)) };
    const stack = Array.from(document.elementsFromPoint?.(point.x, point.y) || []);
    const target = stack.find(node => {
      if (!node || node.nodeType !== 1) return false;
      const tag = String(node.tagName || "").toUpperCase();
      return tag === "IMG" || tag === "OBJECT" || tag === "IFRAME" || tag === "EMBED" || tag === "VIDEO" || tag === "IMAGE" || tag === "PICTURE" || tag === "SOURCE";
    }) || null;
    if (!target) return null;
    const style = window.getComputedStyle?.(target) || null;
    return {
      probePoint: point,
      element: _inspectElementNode(target),
      tagName: String(target.tagName || "").toUpperCase(),
      id: target.id || "",
      className: target.className || "",
      originalSrc: target.getAttribute?.("src") || target.getAttribute?.("data") || target.getAttribute?.("href") || null,
      absoluteUrl: _resolveAbsoluteResourceUrl(_resourceUrlForElement(target)),
      parent: target.parentElement ? _inspectElementNode(target.parentElement) : null,
      grandparent: target.parentElement?.parentElement ? _inspectElementNode(target.parentElement.parentElement) : null,
      ancestors: _collectAncestorIdentity(target),
      computed: style ? {
        display: style.display || "",
        visibility: style.visibility || "",
        opacity: style.opacity || "",
        position: style.position || "",
        zIndex: style.zIndex || "",
      } : null,
      ancestors: _collectAncestorIdentity(target),
    };
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
    if (!host) return { directChildren: [], nestedChildren: [] };
    const directChildren = Array.from(host.children || []).map(_inspectElementNode).filter(Boolean);
    const nestedChildren = Array.from(host.querySelectorAll?.("*") || []).map(_inspectElementNode).filter(Boolean);
    return { directChildren, nestedChildren };
  }

  function _collectSphereCenterStack(container) {
    if (!container?.getBoundingClientRect) return { point: null, stack: [] };
    const rect = container.getBoundingClientRect();
    const center = {
      x: Number(rect.left + (rect.width / 2) || 0),
      y: Number(rect.top + (rect.height / 2) || 0),
    };
    const stack = (document.elementsFromPoint?.(center.x, center.y) || [])
      .map(_inspectElementNode)
      .filter(Boolean)
      .slice(0, 16);
    return { point: center, stack };
  }

  function _setSphereLoaderVisibility(container, visible) {
    const loader = container?.querySelector?.(":scope > .sphere-luxury-loader");
    if (container?.setAttribute) container.setAttribute("aria-busy", visible ? "true" : "false");
    if (!loader) return;
    loader.hidden = !visible;
    loader.style.display = visible ? "" : "none";
    if (visible) {
      loader.setAttribute("data-sphere-renderer-owned", "true");
      loader.setAttribute("data-sphere-loader-state", "visible");
    } else {
      loader.setAttribute("data-sphere-loader-state", "hidden");
    }
  }

  function _verifyRenderSurface(container, { requireVisibleCenter = true, expectedGeneration = null } = {}) {
    const renderer = globalThis.LivingTimeSphereRenderer3d;
    const rendererDiag = renderer?.getDiagnostics?.() || {};
    const host = container || document.getElementById("sphere-container");
    if (!host) {
      return { healthy: false, reason: "CONTAINER_MISSING", failures: ["CONTAINER_MISSING"], checks: {}, centerStack: { point: null, stack: [] }, brokenResources: [] };
    }
    const canvases = Array.from(host.querySelectorAll(":scope > canvas.living-time-sphere-3d-canvas"));
    const rendererCanvas = renderer?.getCanvas?.() || null;
    const canvas = rendererCanvas?.parentElement === host && canvases.includes(rendererCanvas)
      ? rendererCanvas
      : (canvases[0] || null);
    const hostRect = host.getBoundingClientRect?.() || { left: 0, top: 0, width: 0, height: 0 };
    const canvasRect = canvas?.getBoundingClientRect?.() || { left: 0, top: 0, width: 0, height: 0 };
    const canvasStyle = canvas ? getComputedStyle(canvas) : null;
    const containerStyle = host ? getComputedStyle(host) : null;
    const centerStack = _collectSphereCenterStack(host);
    const viewportW = window.innerWidth || 0;
    const viewportH = window.innerHeight || 0;
    const centerInViewport = centerStack?.point
      ? centerStack.point.x >= 0 && centerStack.point.x <= viewportW && centerStack.point.y >= 0 && centerStack.point.y <= viewportH
      : false;
    const stackItems = Array.isArray(centerStack.stack) ? centerStack.stack : [];
    const top = stackItems[0] || null;
    const canvasInStack = stackItems.find(item => item.tagName === "canvas" && String(item.className || "").includes("living-time-sphere-3d-canvas")) || null;
    const coveringMedia = stackItems.find(item => {
      const tag = String(item.tagName || "").toUpperCase();
      if (!SPHERE_MEDIA_TAGS.has(tag)) return false;
      if (tag === "CANVAS" && String(item.className || "").includes("living-time-sphere-3d-canvas")) return false;
      if (tag === "SVG" && String(item.className || "").includes("living-time-sphere-svg")) return false;
      return true;
    }) || null;
    const sphereMedia = _collectMediaDiagnostics(host);
    const sphereFailureLog = _resourceFailureLog.filter(item => String(item.owner || "").startsWith("living-time-sphere"));
    const brokenResources = sphereMedia.filter(item =>
      item &&
      item.rect &&
      Number(item.rect.width || 0) > 20 &&
      Number(item.rect.height || 0) > 20 &&
      item.failedImage
    );
    const camera = rendererDiag.cameraPosition || null;
    const cameraValid = !!camera && Number.isFinite(Number(rendererDiag.cameraNear || 0)) && Number.isFinite(Number(rendererDiag.cameraFar || 0)) && Number(rendererDiag.cameraFar || 0) > Number(rendererDiag.cameraNear || 0);
    const glContext = renderer?.getRenderer?.()?.getContext?.() || null;
    const contextExists = !!(glContext || rendererDiag.webglAvailable);
    const contextLost = rendererDiag.stageState?.context === "lost" || rendererDiag.contextLost === true || !!glContext?.isContextLost?.();
    const currentGeneration = Number(_state._3dInitGeneration || 0);
    const diagnostics = {
      container: {
        clientWidth: Number(host.clientWidth || 0),
        clientHeight: Number(host.clientHeight || 0),
        rect: {
          left: Number(hostRect.left || 0),
          top: Number(hostRect.top || 0),
          width: Number(hostRect.width || 0),
          height: Number(hostRect.height || 0),
          right: Number(hostRect.right || 0),
          bottom: Number(hostRect.bottom || 0),
        },
        style: {
          display: containerStyle?.display || "",
          visibility: containerStyle?.visibility || "",
          opacity: containerStyle?.opacity || "",
          position: containerStyle?.position || "",
          zIndex: containerStyle?.zIndex || "",
          overflow: containerStyle?.overflow || "",
          transform: containerStyle?.transform || "",
          contain: containerStyle?.contain || "",
          contentVisibility: containerStyle?.contentVisibility || "",
        },
      },
      canvas: {
        width: Number(canvas?.width || 0),
        height: Number(canvas?.height || 0),
        clientWidth: Number(canvas?.clientWidth || 0),
        clientHeight: Number(canvas?.clientHeight || 0),
        rect: {
          left: Number(canvasRect.left || 0),
          top: Number(canvasRect.top || 0),
          width: Number(canvasRect.width || 0),
          height: Number(canvasRect.height || 0),
          right: Number(canvasRect.right || 0),
          bottom: Number(canvasRect.bottom || 0),
        },
        isConnected: !!canvas?.isConnected,
        parentElement: canvas?.parentElement ? {
          tagName: String(canvas.parentElement.tagName || "").toUpperCase(),
          id: canvas.parentElement.id || null,
          className: canvas.parentElement.className || "",
        } : null,
        ownerDocumentIsCurrent: canvas ? canvas.ownerDocument === document : false,
        style: {
          display: canvasStyle?.display || "",
          visibility: canvasStyle?.visibility || "",
          opacity: canvasStyle?.opacity || "",
          position: canvasStyle?.position || "",
          zIndex: canvasStyle?.zIndex || "",
          pointerEvents: canvasStyle?.pointerEvents || "",
        },
      },
      renderer: {
        reportedSize: {
          width: Math.round(Number(rendererDiag.rendererSizeWidth || rendererDiag.canvasClientWidth || 0)),
          height: Math.round(Number(rendererDiag.rendererSizeHeight || rendererDiag.canvasClientHeight || 0)),
        },
        drawingBuffer: {
          width: Math.round(Number(rendererDiag.drawingBufferWidth || 0)),
          height: Math.round(Number(rendererDiag.drawingBufferHeight || 0)),
        },
        contextExists,
        contextLost,
      },
      scene: {
        objectCount: Number(rendererDiag.sceneObjectCount || 0),
      },
      camera: {
        position: camera,
        aspect: Number(rendererDiag.cameraAspect || 0) || null,
        near: Number(rendererDiag.cameraNear || 0),
        far: Number(rendererDiag.cameraFar || 0),
      },
      devicePixelRatio: Number(window.devicePixelRatio || 1),
      firstFrameComplete: rendererDiag.stageState?.firstFrame === "rendered",
      generation: {
        expected: Number(expectedGeneration || currentGeneration),
        current: currentGeneration,
      },
      canvasCount: canvases.length,
      centerStack,
      coveringMedia,
      brokenResources,
      resourceFailureLog: sphereFailureLog.slice(0, 80),
    };
    const failures = [];
    if (!(typeof HTMLCanvasElement !== "undefined" && canvas instanceof HTMLCanvasElement)) failures.push(RENDER_SURFACE_REASON.CANVAS_MISSING);
    if (canvas && !canvas.isConnected) failures.push(RENDER_SURFACE_REASON.CANVAS_NOT_CONNECTED);
    if (canvas && canvas.parentElement !== host) failures.push(RENDER_SURFACE_REASON.CANVAS_WRONG_PARENT);
    if (Number(canvas?.width || 0) <= 0 || Number(canvasRect.width || 0) <= 0) failures.push(RENDER_SURFACE_REASON.CANVAS_ZERO_WIDTH);
    if (Number(canvas?.height || 0) <= 0 || Number(canvasRect.height || 0) <= 0) failures.push(RENDER_SURFACE_REASON.CANVAS_ZERO_HEIGHT);
    if (canvasStyle?.display === "none") failures.push(RENDER_SURFACE_REASON.CANVAS_DISPLAY_NONE);
    if (canvasStyle?.visibility === "hidden") failures.push(RENDER_SURFACE_REASON.CANVAS_VISIBILITY_HIDDEN);
    if (Number(canvasStyle?.opacity || 1) <= 0) failures.push(RENDER_SURFACE_REASON.CANVAS_ZERO_OPACITY);
    if (Number(hostRect.width || 0) <= 0) failures.push(RENDER_SURFACE_REASON.CONTAINER_ZERO_WIDTH);
    if (Number(hostRect.height || 0) <= 0) failures.push(RENDER_SURFACE_REASON.CONTAINER_ZERO_HEIGHT);
    if (!contextExists) failures.push(RENDER_SURFACE_REASON.WEBGL_CONTEXT_MISSING);
    if (contextLost) failures.push(RENDER_SURFACE_REASON.WEBGL_CONTEXT_LOST);
    if (rendererDiag.stageState?.firstFrame !== "rendered") failures.push(RENDER_SURFACE_REASON.FIRST_FRAME_MISSING);
    if (Number(canvases.length || 0) !== 1) failures.push(RENDER_SURFACE_REASON.DUPLICATE_CANVAS);
    if (expectedGeneration != null && Number(expectedGeneration) !== currentGeneration) failures.push(RENDER_SURFACE_REASON.STALE_RENDER_GENERATION);
    if (rendererDiag.initialized === false && _state._3dInitInProgress === false) failures.push(RENDER_SURFACE_REASON.RENDERER_DISPOSED);
    if (Number(rendererDiag.drawingBufferWidth || 0) <= 0 || Number(rendererDiag.drawingBufferHeight || 0) <= 0) failures.push(RENDER_SURFACE_REASON.DRAWING_BUFFER_ZERO);
    if (Number(rendererDiag.sceneObjectCount || 0) <= 0) failures.push(RENDER_SURFACE_REASON.SCENE_EMPTY);
    if (!cameraValid) failures.push(RENDER_SURFACE_REASON.CAMERA_INVALID);
    if (requireVisibleCenter && centerInViewport && (!canvasInStack || (top && !(top.tagName === "canvas" && String(top.className || "").includes("living-time-sphere-3d-canvas"))))) {
      failures.push(RENDER_SURFACE_REASON.CANVAS_COVERED);
    }
    if (coveringMedia) failures.push(RENDER_SURFACE_REASON.CANVAS_COVERED);
    if (brokenResources.length > 0) failures.push(RENDER_SURFACE_REASON.BROKEN_MEDIA_IN_SURFACE);
    const uniqueFailures = Array.from(new Set(failures));
    const healthy = uniqueFailures.length === 0;
    const checks = {
      canvasConnected: !!canvas?.isConnected,
      canvasVisible: !!(canvasStyle && canvasStyle.display !== "none" && canvasStyle.visibility !== "hidden" && Number(canvasStyle.opacity || 0) > 0 && !canvas?.hidden),
      centerInViewport,
      centerHitsCanvas: !!canvasInStack,
      canvasTopAtCenter: !!(top && top.tagName === "canvas" && String(top.className || "").includes("living-time-sphere-3d-canvas")),
      firstFrameRendered: rendererDiag.stageState?.firstFrame === "rendered",
      contextHealthy: !contextLost,
    };
    const result = {
      healthy,
      reason: uniqueFailures[0] || null,
      failures: uniqueFailures,
      checks,
      centerStack,
      coveringMedia,
      canvasCount: canvases.length,
      sphereHostChildren: _inspectSphereHostChildren(),
      brokenResources,
      resourceFailureLog: sphereFailureLog.slice(0, 80),
      rendererDiagnostics: {
        firstFrameTimestamp: Number(rendererDiag.firstFrameTimestamp || 0),
        sceneObjectCount: Number(rendererDiag.sceneObjectCount || 0),
        visibleObjectCount: Number(rendererDiag.visibleObjectCount || 0),
        drawingBufferWidth: Number(rendererDiag.drawingBufferWidth || 0),
        drawingBufferHeight: Number(rendererDiag.drawingBufferHeight || 0),
        contextLost,
      },
      diagnostics,
    };
    if (!healthy && !_state.firstRenderSurfaceFailure) {
      _state.firstRenderSurfaceFailure = Object.freeze({
        capturedAt: Date.now(),
        reason: result.reason,
        failures: result.failures.slice(0, 20),
        diagnostics: result.diagnostics,
      });
    }
    _markRenderSurfaceCanvasTrace("after-validation", canvas);
    _state.lastRenderSurfaceVerification = result;
    return result;
  }

  function _collectRuntimeDebugSnapshot() {
    return {
      capturedAt: Date.now(),
      bottomViewport: _collectBottomViewportDiagnostics(190),
      fixedSticky: _collectFixedStickyDiagnostics(),
      media: _collectMediaDiagnostics(document),
      sphereHostChildren: _inspectSphereHostChildren(),
      sphereCenterStack: _collectSphereCenterStack(document.getElementById("sphere-container")),
      renderSurfaceVerification: _verifyRenderSurface(document.getElementById("sphere-container"), { requireVisibleCenter: false }),
      bottomBrokenResourceProbe: _probeBottomBrokenResource(),
      failedResources: _resourceFailureLog.slice(0, 120),
    };
  }

  function _runRenderSurfaceVerification() {
    const container = document.getElementById("sphere-container");
    const verification = _verifyRenderSurface(container, { requireVisibleCenter: true });
    const rendererDiag = globalThis.LivingTimeSphereRenderer3d?.getDiagnostics?.() || {};
    const viewport = { width: Number(window.innerWidth || 0), height: Number(window.innerHeight || 0) };
    const probePoint = { x: Math.max(0, Math.round(viewport.width / 2)), y: Math.max(0, Math.round(viewport.height - 32)) };
    const bottomStack = (document.elementsFromPoint?.(probePoint.x, probePoint.y) || []).map(_inspectElementNode).filter(Boolean).slice(0, 10);
    const bottomProbe = _probeBottomBrokenResource();
    const lines = [
      `Requested renderer: ${_state.requestedRendererMode === "auto" ? "3D" : String(_state.requestedRendererMode || "auto").toUpperCase()}`,
      `Active renderer: ${_state.activeRendererMode || "unknown"}`,
      `Lifecycle: ${_state.rendererLifecycle || "unknown"}`,
      `Validation: ${verification.healthy ? "PASS" : `FAIL (${verification.reason || "unknown"})`}`,
      `All failures: ${(verification.failures || []).join(", ") || "none"}`,
      `Container: ${Math.round(Number(_state._latestContainerSize?.w || 0))} × ${Math.round(Number(_state._latestContainerSize?.h || 0))}`,
      `Container client: ${Math.round(Number(verification.diagnostics?.container?.clientWidth || 0))} × ${Math.round(Number(verification.diagnostics?.container?.clientHeight || 0))}`,
      `Container rect: ${JSON.stringify(verification.diagnostics?.container?.rect || {})}`,
      `Container style: ${JSON.stringify(verification.diagnostics?.container?.style || {})}`,
      `Canvas connected: ${verification.checks?.canvasConnected ? "yes" : "no"}`,
      `Canvas parent: ${verification.diagnostics?.canvas?.parentElement?.tagName || "none"}#${verification.diagnostics?.canvas?.parentElement?.id || ""}`,
      `Canvas ownerDocument === document: ${verification.diagnostics?.canvas?.ownerDocumentIsCurrent ? "yes" : "no"}`,
      `Canvas CSS size: ${Math.round(Number(rendererDiag.canvasClientWidth || 0))} × ${Math.round(Number(rendererDiag.canvasClientHeight || 0))}`,
      `Canvas attr size: ${Math.round(Number(verification.diagnostics?.canvas?.width || 0))} × ${Math.round(Number(verification.diagnostics?.canvas?.height || 0))}`,
      `Canvas rect: ${JSON.stringify(verification.diagnostics?.canvas?.rect || {})}`,
      `Canvas style: ${JSON.stringify(verification.diagnostics?.canvas?.style || {})}`,
      `Drawing buffer: ${Math.round(Number(rendererDiag.drawingBufferWidth || 0))} × ${Math.round(Number(rendererDiag.drawingBufferHeight || 0))}`,
      `WebGL context exists: ${verification.diagnostics?.renderer?.contextExists ? "yes" : "no"}`,
      `WebGL context lost: ${verification.diagnostics?.renderer?.contextLost ? "yes" : "no"}`,
      `Renderer generation: ${verification.diagnostics?.generation?.expected || 0} / current ${verification.diagnostics?.generation?.current || 0}`,
      `Canvas visible: ${verification.checks?.canvasVisible ? "yes" : "no"}`,
      `Canvas count: ${Number(verification.canvasCount || 0)}`,
      `Elements over center:`,
      ...(verification.centerStack?.stack?.slice(0, 8).map(item => `  ${String(item.tagName || "").toUpperCase()}${item.id ? `#${item.id}` : ""}${item.className ? `.${String(item.className).split(/\s+/).filter(Boolean).join(".")}` : ""}`) || ["  (none)"]),
      `First frame: ${rendererDiag.stageState?.firstFrame === "rendered" ? "yes" : "no"}`,
      `Scene objects: ${Number(rendererDiag.sceneObjectCount || 0)}`,
      `Broken resources in sphere: ${Array.isArray(verification.brokenResources) ? verification.brokenResources.length : 0}`,
      `White-bar probe point: ${probePoint.x},${probePoint.y}`,
      `White-bar stack:`,
      ...(bottomStack.map(item => `  ${String(item.tagName || "").toUpperCase()}${item.id ? `#${item.id}` : ""}${item.className ? `.${String(item.className).split(/\s+/).filter(Boolean).join(".")}` : ""} src=${item.absoluteUrl || item.src || "N/A"}`) || ["  (none)"]),
      `White-bar media element: ${bottomProbe?.element ? `${String(bottomProbe.element.tagName || "").toUpperCase()}#${bottomProbe.element.id || ""}.${String(bottomProbe.element.className || "").split(/\s+/).filter(Boolean).join(".")}` : "none"}`,
      `White-bar media source: ${bottomProbe?.absoluteUrl || bottomProbe?.originalSrc || "N/A"}`,
      `White-bar media parent: ${bottomProbe?.parent ? `${String(bottomProbe.parent.tagName || "").toUpperCase()}#${bottomProbe.parent.id || ""}.${String(bottomProbe.parent.className || "").split(/\s+/).filter(Boolean).join(".")}` : "N/A"}`,
      `White-bar media grandparent: ${bottomProbe?.grandparent ? `${String(bottomProbe.grandparent.tagName || "").toUpperCase()}#${bottomProbe.grandparent.id || ""}.${String(bottomProbe.grandparent.className || "").split(/\s+/).filter(Boolean).join(".")}` : "N/A"}`,
      `White-bar media computed: ${JSON.stringify(bottomProbe?.computed || {})}`,
      `White-bar media ancestors: ${(bottomProbe?.ancestors || []).map(item => `${item.tagName}${item.id ? `#${item.id}` : ""}${item.className ? `.${String(item.className).split(/\s+/).filter(Boolean).join(".")}` : ""}`).join(" → ") || "none"}`,
      `Canvas connectivity trace: ${(Array.isArray(_state.renderSurfaceCanvasTrace) ? _state.renderSurfaceCanvasTrace.map(item => `${item.stage}:${item.connected ? "connected" : "detached"}`).join(" | ") : "none") || "none"}`,
      `Duplicate canvases: ${Math.max(0, Number(verification.canvasCount || 0) - 1)}`,
      `Surface healthy: ${verification.healthy ? "yes" : `no (${verification.reason || "unknown"})`}`,
    ];
    const output = document.getElementById("sphere-render-surface-verify-output");
    if (output) output.textContent = lines.join("\n");
    return verification;
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

  function _markInitTimeline(stage, payload = null) {
    _state.initTimeline.push({
      at: Date.now(),
      stage: String(stage || "unknown"),
      payload: payload && typeof payload === "object" ? { ...payload } : payload,
      generation: Number(_state._3dInitGeneration || 0),
    });
    if (_state.initTimeline.length > 80) _state.initTimeline.shift();
  }

  function _markRenderSurfaceCanvasTrace(stage, canvas) {
    const node = canvas || document.querySelector?.("#sphere-container > canvas.living-time-sphere-3d-canvas");
    _state.renderSurfaceCanvasTrace.push({
      at: Date.now(),
      stage: String(stage || "unknown"),
      connected: !!node?.isConnected,
      parentTag: node?.parentElement ? String(node.parentElement.tagName || "").toUpperCase() : null,
      parentId: node?.parentElement?.id || null,
      centerStack: !node?.isConnected ? _collectSphereCenterStack(document.getElementById("sphere-container")) : null,
    });
    if (_state.renderSurfaceCanvasTrace.length > 40) _state.renderSurfaceCanvasTrace.shift();
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

  function _disposeRendererForRetry(container, reason = "renderer-retry") {
    const renderer = globalThis.LivingTimeSphereRenderer3d;
    if (renderer?.isInitializing?.()) return false;
    try { renderer?.teardown?.(); } catch (error) {
      console.warn(`[LivingTimeSphere] Renderer cleanup failed before ${reason}.`, error);
    }
    const ownedCanvases = Array.from(container?.querySelectorAll?.(":scope > canvas.living-time-sphere-3d-canvas") || []);
    ownedCanvases.forEach(canvas => {
      try { canvas.remove(); } catch { /* best-effort orphan cleanup */ }
    });
    _state.active3d = false;
    _state._pending3dPayload = null;
    _markInitTimeline("renderer-surface-reset", { reason, removedCanvases: ownedCanvases.length });
    _markRenderSurfaceCanvasTrace("after-renderer-surface-reset");
    return true;
  }

  function _scheduleRetry(container, reason) {
    if (!container || _state.retryCount >= 2 || _state._autoRetryTimer) return;
    if (_state.requestedRendererMode === "svg" || _state.requestedRendererMode === "canvas" || _state.requestedRendererMode === "table" || _state.requestedRendererMode === "text") return;
    const contextRecovery = /context/i.test(String(reason || ""));
    const delay = contextRecovery
      ? (_state.retryCount === 0 ? 750 : 1800)
      : (_state.retryCount === 0 ? 180 : 900);
    _state.retryCount += 1;
    _setRendererLifecycle("recovering");
    _state.activeRendererMode = "recovering";
    const retryStartedAt = Date.now();
    let pollCount = 0;
    const attempt = () => {
      pollCount += 1;
      if (!_disposeRendererForRetry(container, reason)) {
        if (pollCount >= 24 || Date.now() - retryStartedAt >= 6000) {
          try { globalThis.LivingTimeSphereRenderer3d?.cancelInitialization?.(`retry-cap:${reason}`); } catch { /* best-effort cancellation */ }
          _state._autoRetryTimer = 0;
          _state._3dInitInProgress = false;
          _state.active3d = false;
          _state.activeRendererMode = "svg";
          _setRendererLifecycle("fallback");
          _updateRendererLabel("SVG fallback — 3D initialization did not settle");
          _markInitTimeline("renderer-retry-cap-reached", { reason, pollCount, elapsedMs: Date.now() - retryStartedAt });
          return;
        }
        _state._autoRetryTimer = setTimeout(attempt, 250);
        return;
      }
      _state._autoRetryTimer = 0;
      _state._3dInitInProgress = false;
      renderSphere(container);
    };
    _state._autoRetryTimer = setTimeout(attempt, delay);
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
      const surface = _verifyRenderSurface(container, { requireVisibleCenter: false });
      if ((hasCanvas && !firstFrame) || !surface.healthy) {
        _state.active3d = false;
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
    const webgl2Available = !!globalThis.LivingTimeSphereEffects?.detectWebGl2?.();
    if (!webgl2Available) return null;
    const reducedMotion = typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const tier = globalThis.ObservatoryCapabilityManager?.selectTier?.({
      override: q === "auto" ? undefined : q,
      webglAvailable: webgl2Available,
    }) || (q === "auto" ? "balanced" : q);
    if (tier === "svgonly") return null;
    const preset = mat.QUALITY_PRESETS[tier] || mat.QUALITY_PRESETS.balanced;
    if (!reducedMotion) return preset;
    return Object.freeze({ ...preset, idleDrift: false, breathing: false, passageFlow: false, glow: false });
  }

  // ── Renderer mode resolution ───────────────────────────────────────

  function shouldUse3d() {
    if (_state.requestedRendererMode === "svg" || _state.requestedRendererMode === "canvas" || _state.requestedRendererMode === "table" || _state.requestedRendererMode === "text") return false;
    if (_state.quality === "svgonly") return false;
    if (!globalThis.LivingTimeSphereRenderer3d || !globalThis.LivingTimeSphereM || !globalThis.LivingTimeSphereEffects) return false;
    if (!globalThis.LivingTimeSphereEffects.detectWebGl2?.()) return false;
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
    if (typeof ResizeObserver === "undefined") return false;
    return new Promise(resolve => {
      let settled = false;
      const finish = value => {
        if (settled) return;
        settled = true;
        observer?.disconnect?.();
        clearTimeout(timer);
        resolve(!!value);
      };
      const observer = new ResizeObserver(() => {
        if (valid()) finish(true);
      });
      try { observer.observe(container); } catch { finish(false); return; }
      const timer = setTimeout(() => finish(valid()), timeoutMs);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (valid()) finish(true);
        });
      });
    });
  }

  function _withTimeout(promise, timeoutMs, timeoutReason = "INIT_TIMEOUT", onTimeout = null) {
    let timer = null;
    const timeoutPromise = new Promise(resolve => {
      timer = setTimeout(() => {
        try { onTimeout?.(); } catch { /* best-effort timeout cancellation */ }
        resolve({
          success: false,
          reason: timeoutReason,
          detail: `3D initialization exceeded ${timeoutMs}ms`,
        });
      }, timeoutMs);
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
      _setModeDefaultSelectedMarker(targetMode, model);
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

  function _invalidateLiveSnapshotCache() {
    _state._liveSnapshotCacheKey = "";
    _state._liveSnapshotCache = null;
    _state._liveSnapshotCacheAt = 0;
  }

  function _currentSnapshot({ fresh = false } = {}) {
    const key = `${_state.timeZone}|${_state.boundaryMode}|${_state.manualSunset}`;
    const now = Date.now();
    if (!fresh
        && _state._liveSnapshotCache
        && _state._liveSnapshotCacheKey === key
        && now - Number(_state._liveSnapshotCacheAt || 0) < 1000) {
      return _state._liveSnapshotCache;
    }
    const snapshot = globalThis.LivingTimeSphereLiveData?.getSnapshot?.({
      timeZone: _state.timeZone,
      boundaryMode: _state.boundaryMode,
      manualSunset: _state.manualSunset,
    }) || null;
    _state._liveSnapshotCacheKey = key;
    _state._liveSnapshotCache = snapshot;
    _state._liveSnapshotCacheAt = now;
    return snapshot;
  }

  function _supportedAlignmentYears() {
    const years = globalThis.AlignmentLedgerData?.listSupportedYears?.();
    return Array.isArray(years) ? years.map(Number).filter(Number.isFinite) : [];
  }

  function _resolveLiveTodayTarget(baseModel = null) {
    const live = _currentSnapshot({ fresh: true });
    const fallbackPosition = baseModel?.todayPatternPosition || live?.todayModel?.todayPatternPosition || null;
    const temporal = globalThis.LivingTimeSphereTemporal;
    if (temporal?.resolveTodayTarget) {
      return temporal.resolveTodayTarget({
        snapshot: live,
        fallbackPosition,
        supportedYears: _supportedAlignmentYears(),
        fallbackYear: _state.year,
      });
    }
    const day = Number(live?.pattern?.dayOfPatternYear ?? fallbackPosition?.dayOfPatternYear);
    if (!Number.isFinite(day) || day < 1 || day > 364) return null;
    const patternYear = Number(live?.pattern?.patternYear ?? fallbackPosition?.patternYear ?? live?.year ?? _state.year);
    const supported = _supportedAlignmentYears();
    const year = supported.includes(patternYear) ? patternYear : (supported.includes(Number(live?.year)) ? Number(live.year) : _state.year);
    return Object.freeze({
      dayOfPatternYear: Math.max(1, Math.min(364, Math.round(day))),
      patternYear,
      year,
      marker: "today",
      effectiveDate: live?.pattern?.effectiveDate || fallbackPosition?.effectiveDate || "",
      civilDate: live?.pattern?.civilDate || fallbackPosition?.civilDate || "",
    });
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
    const live = _currentSnapshot();
    const liveDate = _state.selectedMarker === "today"
      && Number(live?.pattern?.dayOfPatternYear) === dayOfYear
      && (live?.pattern?.effectiveDate || live?.pattern?.civilDate)
      ? new Date(`${live.pattern.effectiveDate || live.pattern.civilDate}T12:00:00Z`)
      : null;
    const effectiveDate = liveDate && !Number.isNaN(liveDate.getTime())
      ? liveDate
      : _patternDateFromDayOfYear(_state.year, dayOfYear);
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
    const isToday = selected?.patternYear === live?.pattern?.patternYear
      && selected?.dayOfPatternYear != null
      && selected.dayOfPatternYear === live?.pattern?.dayOfPatternYear;
    const solar = globalThis.LivingTimeSphereLiveData?.getSolarSnapshot?.({
      asOf: effectiveDate,
      timeZone: _state.timeZone,
      boundaryMode: _state.boundaryMode,
      manualSunset: _state.manualSunset,
    }) || live?.solar || null;

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
    const todayPosition = live?.todayModel?.todayPatternPosition || baseModel?.todayPatternPosition || live?.pattern || null;
    const temporalComparison = globalThis.LivingTimeSphereTemporal?.compareToToday?.(selected, todayPosition) || null;
    const activeMoon = selected?.moon ?? live?.pattern?.moon ?? baseModel?.todayPatternPosition?.moon ?? baseModel?.sourceRecord?.equinox?.patternPosition?.moon ?? 1;
    return {
      ...baseModel,
      selectedPatternPosition: selected,
      environmentSnapshot: environmentState,
      todayPatternPosition: todayPosition,
      temporalComparison,
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
    // An explicit semantic Today marker outranks an older locally remembered
    // exploration. The live day is resolved after dependencies initialize.
    if (_state.selectedMarker === "today") return;
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
    if (_state._applyingHistoryState) return;
    const selected = model?.selectedPatternPosition || null;
    const cameraState = globalThis.LivingTimeSphereCamera?.getState?.() || {};
    const marker = _state.selectedMarker === "today" && selected?.isToday
      ? "today"
      : (selected?.dayOfPatternYear ? `day-${selected.dayOfPatternYear}` : (_state.selectedMarker || null));
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
    if (replace) window.history.replaceState({ marker, day: selected?.dayOfPatternYear || null, sofInternalTemporal: true }, "", url);
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
        if (Number(live?.year) === Number(_state.year) && live?.pattern?.dayOfPatternYear) {
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
        id: "calendar-boundary",
        label: "Calendar day boundary",
        value: _state.boundaryMode === "midnight" ? "Configured · midnight" : `Configured · ${_state.manualSunset || "18:00"}`,
        status: "Configured",
        source: _state.boundaryMode === "midnight" ? "Calendar configuration" : "Manual wall-clock boundary",
        timestamp: live?.instant || "",
        freshness: "Current configuration",
        availability: "Always available. Forecast sunset is shown separately and does not silently change the calendar boundary.",
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

    _syncModeButtons();
    _syncFieldRangeButtons();
    _syncLayerCheckboxes();

    const model    = buildCurrentModel();
    const spiral   = _getCachedSpiral();
    // Show/hide and populate non-visual views from the same canonical model.
    _updateAlternateViews(model, spiral);
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
      _setSphereLoaderVisibility(container, false);
      _updateRendererLabel(_state.requestedRendererMode === "table" ? "Data Table" : "Text Summary");
      updateAccessibleText(model, spiral);
      updateDetails(model);
      _updateTemporalLens(model);
      _updateTodayDiagnostics(model);
      _updateModeSummary(model);
      _updateWhatAmISeeing(_state.viewMode);
      _updateStateStrip(_state.viewMode, model);
      _updateEnvironmentBridge(model);
    _updateLocationSeasonStrip(model);
      void _refreshScheduleNavigator(model);
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
        _setSphereLoaderVisibility(container, true);
        _render3d(container, model, spiral, effectiveLayers, connectionRegistry, semanticZoom, effectiveMoonLabelMode, effectiveDayLabelMode);
      }
    } else {
      _teardown3d();
      _setRendererLifecycle("fallback");
      _state.activeRendererMode = "svg";
      _renderSvgFallback(container, model, spiral, layout, effectiveLayers, connectionRegistry, semanticZoom, effectiveMoonLabelMode, effectiveDayLabelMode);
      _setSphereLoaderVisibility(container, false);
    }

    updateAccessibleText(model, spiral);
    updateDetails(model);
    _updateTemporalLens(model);
    _updateTodayDiagnostics(model);
    _updateModeSummary(model);
    _updateWhatAmISeeing(_state.viewMode);
    _updateStateStrip(_state.viewMode, model);
    _updateEnvironmentBridge(model);
    _updateLocationSeasonStrip(model);
    // B7.52 — do not race an IndexedDB planner query against the first WebGL
    // shader/geometry compile. Keep only the latest model until 3D is active.
    if (_state.active3d || !shouldUse3d()) {
      void _refreshScheduleNavigator(model);
    } else {
      _state._pendingScheduleNavigatorModel = model;
    }
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
      _markInitTimeline("3d-initialization-requested", { generation: initGeneration });
      _setRendererLifecycle("initializing");
      _state.activeRendererMode = "initializing-3d";
      _updateRendererLabel("Loading 3D renderer…");
      _setSphereLoaderVisibility(container, true);

      const reducedMotion = typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

      let result;
      try {
        const hasStableSize = await _waitForValidContainer(container);
        _markInitTimeline("container-first-measurable-size", {
          generation: initGeneration,
          width: Number(container?.clientWidth || 0),
          height: Number(container?.clientHeight || 0),
          hasStableSize,
        });
        if (!hasStableSize) {
          _setRendererLifecycle("waiting-for-size");
          result = {
            success: false,
            reason: "CONTAINER_SIZE_INVALID",
            detail: "Renderer container did not reach a valid layout size in time.",
          };
        } else {
          _markInitTimeline("3d-initialization-start", { generation: initGeneration });
          result = await _withTimeout(renderer.init({
          container,
          model,
          spiral,
          quality:       preset,
          tier: _state.quality === "auto"
            ? globalThis.ObservatoryCapabilityManager?.selectTier?.({
                webglAvailable: globalThis.ObservatoryCapabilityManager?.probeWebGl?.().webgl2 ?? false
              })
            : globalThis.ObservatoryCapabilityManager?.selectTier?.({
                override: _state.quality,
                webglAvailable: globalThis.ObservatoryCapabilityManager?.probeWebGl?.().webgl2 ?? false,
              }) || _state.quality,
          generation: initGeneration,
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
          onContextLost: () => {
            if (initGeneration !== _state._3dInitGeneration) return;
            // Invalidate the interrupted generation before rendering the SVG
            // baseline. Calling renderSphere() here would immediately start a
            // second WebGL renderer while the lost canvas is still attached.
            _state._3dInitGeneration += 1;
            _state.active3d = false;
            _state.activeRendererMode = "recovering";
            _setRendererLifecycle("recovering");
            _updateRendererLabel("3D context lost — falling back");
            _showRendererFallbackWarning("WEBGL_CONTEXT_LOST", "WebGL context was lost after initialization.");
            _disposeRendererForRetry(container, "context-lost");
            const fallbackLayout = globalThis.LivingTimeSphereLayout.resolveLayout({
              containerWidth: container.offsetWidth || 320,
              containerHeight: container.offsetHeight || 320,
              devicePixelRatio: (typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1)
            });
            _renderSvgFallback(container, model, spiral, fallbackLayout, effectiveLayers, connectionRegistry, semanticZoomState, effectiveMoonLabelMode, effectiveDayLabelMode);
            _setSphereLoaderVisibility(container, false);
            _scheduleRetry(container, "context-lost");
          },
          onContextRestored: () => {
            if (initGeneration !== _state._3dInitGeneration) return;
            _state.active3d = false;
            _state.activeRendererMode = "recovering";
            _setRendererLifecycle("recovering");
            _setSphereLoaderVisibility(container, true);
            _scheduleRetry(container, "context-restored");
          },
          onYearSelect: year => {
            _stopTemporalPlayback("sphere-year-marker");
            _state.year = year;
            _syncYearSelect(year);
            globalThis.LivingTimeSphereAccessibility?.announce?.(`Year ${year} selected. Passage view.`);
            _requestViewModeTransition(container, "passage");
          },
          onMarkerSelect: marker => {
            if (!marker) return;

            const extensionMeta =
              marker?.metadata || {};

            if (
              extensionMeta?.planner === true
              || extensionMeta?.type === "living-plan"
            ) {
              const recordId =
                extensionMeta?.recordId || null;

              const patternDay =
                Number(
                  extensionMeta?.temporal?.patternDay
                  ?? extensionMeta?.patternDay
                );

              const patternYear =
                Number(
                  extensionMeta?.temporal?.patternYear
                  ?? marker?.year
                );

              if (
                Number.isFinite(patternDay)
              ) {
                _state.selectedDayOfYear =
                  _clampPatternDay(patternDay);

                _state.selectedMarker =
                  `day-${_state.selectedDayOfYear}`;
              }

              if (
                Number.isFinite(patternYear)
              ) {
                _state.year = patternYear;
                _syncYearSelect(patternYear);
              }

              document.dispatchEvent(
                new CustomEvent(
                  "sof:living-plan-selected",
                  {
                    detail: {
                      recordId,
                      title:
                        extensionMeta?.title
                        || null,
                      category:
                        extensionMeta?.plannerCategory
                        || null,
                      temporal:
                        extensionMeta?.temporal
                        || null,
                      schedule:
                        extensionMeta?.schedule
                        || null,
                      source:
                        "sphere",
                      // B7.14: selecting a scheduled marker inspects it first.
                      // Editing requires the explicit Edit action in its halo.
                      edit: false
                    }
                  }
                )
              );

              globalThis
                .LivingTimeSphereAccessibility
                ?.announce?.(
                  extensionMeta?.title
                    ? `Plan selected: ${extensionMeta.title}.`
                    : "Living plan selected."
                );

              renderSphere(container);
              return;
            }

            if (
              marker.type ===
                "temporal-year"
              && Number.isFinite(
                Number(marker.year)
              )
            ) {
              _selectTemporalYear(
                container,
                marker.year,
                {
                  source:
                    marker.source
                    || "temporal-strata"
                }
              );

              return;
            }

            _stopTemporalPlayback("sphere-marker-select");
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
          }), 25000, "INIT_TIMEOUT", () => renderer.cancelInitialization?.("ui-init-timeout"));
          _markInitTimeline("3d-initialization-complete", { generation: initGeneration, success: !!result?.success, reason: result?.reason || null });
        }
      } catch (err) {
        result = { success: false, reason: "init-exception", detail: String(err) };
      } finally {
        _state._3dInitInProgress = false;
      }

      if (initGeneration !== _state._3dInitGeneration) {
        _disposeRendererForRetry(container, "stale-init-generation");
        return;
      }

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
        _setSphereLoaderVisibility(container, false);
        _updateInteractBar();
        _updateTodayDiagnostics(model);
        void _refreshScheduleNavigator(model);
        if (transient && _state.requestedRendererMode !== "svg") {
          _scheduleRetry(container, reason);
        }
        return;
      }
      container.querySelectorAll(".living-time-sphere-svg,.living-time-sphere-canvas").forEach(node => node.remove());
      _pruneInvalidSphereMedia(container, "svg-handoff-invalid-media");
      _markRenderSurfaceCanvasTrace("after-svg-cleanup");
      _setSphereLoaderVisibility(container, false);
      _markInitTimeline("svg-removed", { generation: initGeneration });
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      _markInitTimeline("post-layout-raf", { generation: initGeneration });
      globalThis.LivingTimeSphereRenderer3d?.requestSingleRender?.();
      _markInitTimeline("first-frame-acknowledged", { generation: initGeneration });
      const surfaceCheck = _verifyRenderSurface(container, { requireVisibleCenter: false, expectedGeneration: initGeneration });
      _markRenderSurfaceCanvasTrace("after-validation");
      _markInitTimeline("surface-validation", { generation: initGeneration, healthy: !!surfaceCheck?.healthy, reason: surfaceCheck?.reason || null });
      if (!surfaceCheck.healthy) {
        _state.active3d = false;
        _state.activeRendererMode = "recovering";
        _setRendererLifecycle("failed");
        _updateRendererLabel(`SVG fallback — render surface invalid (${surfaceCheck.reason || "unknown"})`);
        _showRendererFallbackWarning(surfaceCheck.reason || (surfaceCheck.failures || [])[0] || "CANVAS_MISSING", (surfaceCheck.failures || []).join(", ") || "render-surface-check-failed");
        const layout = globalThis.LivingTimeSphereLayout.resolveLayout({
          containerWidth:  container.offsetWidth  || 320,
          containerHeight: container.offsetHeight || 320,
          devicePixelRatio: (typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1)
        });
        _renderSvgFallback(container, model, spiral, layout, effectiveLayers, connectionRegistry, semanticZoomState, effectiveMoonLabelMode, effectiveDayLabelMode);
        _pruneInvalidSphereMedia(container, "svg-fallback-invalid-media");
        _setSphereLoaderVisibility(container, false);
        _updateInteractBar();
        _scheduleRetry(container, "render-surface-invalid");
        return;
      }
      _state.active3d = true;
      _state.activeRendererMode = "3d";
      _state.firstRenderSurfaceFailure = null;

      // B7.52 — the schedule navigator is useful, but its IndexedDB read does
      // not belong on the critical path. Hydrate it only after the first real
      // 3D surface has been accepted.
      const pendingScheduleModel = _state._pendingScheduleNavigatorModel || model;
      _state._pendingScheduleNavigatorModel = null;
      const hydrateScheduleNavigator = () => {
        if (_state.active3d) void _refreshScheduleNavigator(pendingScheduleModel);
      };
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(hydrateScheduleNavigator, { timeout: 1000 });
      } else {
        setTimeout(hydrateScheduleNavigator, 120);
      }
      _state.restoreAttempts = 0;
      _state.retryCount = 0;
      _clearAutoRetry();
      _setRendererLifecycle("rendered");
      _markInitTimeline("3d-marked-active", { generation: initGeneration });
      _markRenderSurfaceCanvasTrace("after-lifecycle-transition");
      _updateRendererLabel("WebGL 3D active");
      _hideRendererFallbackWarning();
      _setSphereLoaderVisibility(container, false);
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
      const surfaceCheck = _verifyRenderSurface(container, { requireVisibleCenter: false });
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
        _pruneInvalidSphereMedia(container, "refresh-fallback-invalid-media");
        _setSphereLoaderVisibility(container, false);
        _scheduleRetry(container, "scene-readiness-refresh");
        return;
      }
      if (!surfaceCheck.healthy) {
        _state.active3d = false;
        _state.activeRendererMode = "recovering";
        _setRendererLifecycle("recovering");
        _updateRendererLabel(`Recovering 3D surface… (${surfaceCheck.reason || "surface-unhealthy"})`);
        const layout = globalThis.LivingTimeSphereLayout.resolveLayout({
          containerWidth:  container.offsetWidth  || 320,
          containerHeight: container.offsetHeight || 320,
          devicePixelRatio: (typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1)
        });
        _renderSvgFallback(container, model, spiral, layout, effectiveLayers, connectionRegistry, semanticZoomState, effectiveMoonLabelMode, effectiveDayLabelMode);
        _pruneInvalidSphereMedia(container, "surface-refresh-invalid-media");
        _setSphereLoaderVisibility(container, false);
        _scheduleRetry(container, "surface-health-refresh");
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
    _state._3dInitGeneration += 1;
    _disposeRendererForRetry(document.getElementById("sphere-container"), "renderer-mode-teardown");
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
    _setSphereLoaderVisibility(document.getElementById("sphere-container"), false);
    _updateInteractBar();
  }

  function _renderSvgFallback(container, model, spiral, layout, effectiveLayers, connectionRegistry, semanticZoomState, effectiveMoonLabelMode, effectiveDayLabelMode) {
    _markInitTimeline("svg-fallback-mount", { generation: Number(_state._3dInitGeneration || 0) });
    _setSphereLoaderVisibility(container, false);
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
    _pruneInvalidSphereMedia(container, "svg-render-invalid-media");
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
    // B7.3: render refreshes must not silently disarm an interaction session.
    // The renderer owns the start/end events; this function only guarantees a
    // sane initial state when 3D first appears.
    if (!bar.dataset.interactionInitialized) {
      if (interactBtn) interactBtn.style.display = "";
      if (endBtn)      endBtn.style.display      = "none";
      if (hintOff)     hintOff.style.display     = "";
      if (hintOn)      hintOn.style.display      = "none";
      bar.dataset.interactionInitialized = "true";
    }
  }

  function _updateAlternateViews(model, spiral) {
    // Reveal data table / text sections only for the renderer that actually
    // needs them. B7.52 avoids rebuilding two hidden DOM projections on every
    // ordinary WebGL/SVG calendar refresh.
    const tableSection = document.getElementById("sphere-data-table-section");
    const textSection  = document.getElementById("sphere-text-summary-section");
    const tableMode = _state.requestedRendererMode === "table";
    const textMode = _state.requestedRendererMode === "text";
    if (tableSection) tableSection.style.display = tableMode ? "" : "none";
    if (textSection) textSection.style.display = textMode ? "" : "none";

    if (!model || (!tableMode && !textMode)) return;
    const selected = model.selectedPatternPosition || null;
    const today = model.todayPatternPosition || null;
    const selectedYearPoint = Array.isArray(spiral?.years)
      ? spiral.years.find(item => Number(item?.year) === Number(_state.year)) || null
      : null;
    const patternAngle = selected?.dayOfPatternYear != null
      ? globalThis.LivingTimeSphereModel?.patternAngleForDayOfYear?.(selected.dayOfPatternYear)
      : null;
    const todayAngle = today?.dayOfPatternYear != null
      ? globalThis.LivingTimeSphereModel?.patternAngleForDayOfYear?.(today.dayOfPatternYear)
      : null;
    const rows = [
      ["Selected year", _state.year, "Alignment Ledger"],
      ["Viewing mode", _state.viewMode, "Sphere state"],
      ["Selected Pattern day", selected?.dayOfPatternYear != null ? `${selected.dayOfPatternYear} / 364` : "Outside counted year", "Pattern Calendar"],
      ["Selected Moon / Day", selected?.moon != null ? `Moon ${selected.moon} · Day ${selected.day}` : "Unavailable", "Pattern Calendar"],
      ["Selected effective date", selected?.effectiveDate || "Unavailable", "Pattern Calendar boundary"],
      ["Selected Pattern angle", Number.isFinite(patternAngle) ? `${Number(patternAngle).toFixed(3)}°` : "Unavailable", "364-day coordinate engine"],
      ["Today Pattern day", today?.dayOfPatternYear != null ? `${today.dayOfPatternYear} / 364` : "Outside counted year", "Live Pattern snapshot"],
      ["Today Pattern angle", Number.isFinite(todayAngle) ? `${Number(todayAngle).toFixed(3)}°` : "Unavailable", "364-day coordinate engine"],
      ["Lunar state", selected?.lunarPhase || model?.markers?.lunarMarker?.label || "Unavailable", "Astronomy layer"],
      ["Lunar cycle position", selected?.lunarCyclePosition != null ? `${(Number(selected.lunarCyclePosition) * 360).toFixed(3)}°` : (model?.lunarAngle != null ? `${Number(model.lunarAngle).toFixed(3)}°` : "Unavailable"), "Lunar coordinate"],
      ["Solar gate", selected?.solar?.gate ? `${selected.solar.gate} · ${selected.solar.element || "—"}` : "Unavailable", "Solar context"],
      ["Seasonal progress angle", selected?.solar?.angle != null ? `${Number(selected.solar.angle).toFixed(3)}°` : "Unavailable", "Seasonal anchor interpolation"],
      ["Passage start", model?.passage?.startAngle != null ? `${Number(model.passage.startAngle).toFixed(3)}°` : "Unavailable", "Alignment record"],
      ["Passage end", model?.passage?.endAngle != null ? `${Number(model.passage.endAngle).toFixed(3)}°` : "Unavailable", "Year Gate"],
      ["Year spiral angle", selectedYearPoint?.yearSpiralAngle != null ? `${Number(selectedYearPoint.yearSpiralAngle).toFixed(3)}°` : "Unavailable", "13-year study window"],
      ["Year spiral radius", selectedYearPoint?.yearSpiralRadius != null ? Number(selectedYearPoint.yearSpiralRadius).toFixed(4) : "Unavailable", "Normalized 0–1"],
    ];

    const table = tableMode ? document.getElementById("sphere-data-table") : null;
    if (table) {
      table.innerHTML = `<caption class="visually-hidden">Canonical Living Time Sphere coordinates</caption>
        <thead><tr><th scope="col">Field</th><th scope="col">Value</th><th scope="col">Source</th></tr></thead>
        <tbody>${rows.map(([field, value, source]) => `<tr><th scope="row">${_escapeHtml(field)}</th><td>${_escapeHtml(value)}</td><td>${_escapeHtml(source)}</td></tr>`).join("")}</tbody>`;
    }

    const text = textMode ? document.getElementById("sphere-text-summary-content") : null;
    if (text) {
      const comparison = model.temporalComparison;
      text.textContent = [
        `Living Time Sphere — ${_titleCaseWords(_state.viewMode)} view`,
        `Selected: ${selected?.moon != null ? `Moon ${selected.moon}, Day ${selected.day}, Pattern day ${selected.dayOfPatternYear} of 364` : "outside the counted Pattern year"}`,
        `Effective date: ${selected?.effectiveDate || "unavailable"}`,
        `Today: ${today?.moon != null ? `Moon ${today.moon}, Day ${today.day}, Pattern day ${today.dayOfPatternYear} of 364` : "outside the counted Pattern year"}`,
        `Relationship to Today: ${comparison?.relationshipLabel || "unavailable"}`,
        `Lunar: ${selected?.lunarPhase || model?.markers?.lunarMarker?.label || "unavailable"}${selected?.lunarIllumination != null ? `, ${selected.lunarIllumination}% illuminated` : ""}`,
        `Solar: ${selected?.solar?.gate || "unavailable"}${selected?.solar?.element ? `, ${selected.solar.element}` : ""}`,
        `Passage: ${model?.passage?.startAngle != null ? `${Number(model.passage.startAngle).toFixed(1)} degrees to the Year Gate` : "unavailable"}`,
        "Coordinates use the canonical 13 by 28 Pattern engine and are measured clockwise from Moon 1 Day 1.",
      ].join("\n");
    }
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
    const surface = _state.lastRenderSurfaceVerification || _verifyRenderSurface(document.getElementById("sphere-container"), { requireVisibleCenter: false });
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
    _set("sphere-diag-surface-failure-code-warn", surface?.reason || "none");
    _set("sphere-diag-surface-failures-warn", Array.isArray(surface?.failures) && surface.failures.length ? surface.failures.join(", ") : "none");
    _set("sphere-diag-surface-container-warn", JSON.stringify({
      clientWidth: Math.round(Number(surface?.diagnostics?.container?.clientWidth || 0)),
      clientHeight: Math.round(Number(surface?.diagnostics?.container?.clientHeight || 0)),
      rect: surface?.diagnostics?.container?.rect || {},
      style: surface?.diagnostics?.container?.style || {},
    }));
    _set("sphere-diag-surface-canvas-warn", JSON.stringify({
      width: Math.round(Number(surface?.diagnostics?.canvas?.width || 0)),
      height: Math.round(Number(surface?.diagnostics?.canvas?.height || 0)),
      clientWidth: Math.round(Number(surface?.diagnostics?.canvas?.clientWidth || 0)),
      clientHeight: Math.round(Number(surface?.diagnostics?.canvas?.clientHeight || 0)),
      rect: surface?.diagnostics?.canvas?.rect || {},
      isConnected: !!surface?.diagnostics?.canvas?.isConnected,
      parent: surface?.diagnostics?.canvas?.parentElement || null,
      style: surface?.diagnostics?.canvas?.style || {},
      rendererSize: surface?.diagnostics?.renderer?.reportedSize || null,
      drawingBuffer: surface?.diagnostics?.renderer?.drawingBuffer || null,
      dpr: Number(surface?.diagnostics?.devicePixelRatio || 1),
      firstFrameComplete: !!surface?.diagnostics?.firstFrameComplete,
      sceneObjects: Number(surface?.diagnostics?.scene?.objectCount || 0),
      camera: surface?.diagnostics?.camera || null,
      canvasCount: Number(surface?.diagnostics?.canvasCount || surface?.canvasCount || 0),
    }));
    _set("sphere-diag-surface-generation-warn", `${Number(surface?.diagnostics?.generation?.expected || 0)} / current ${Number(surface?.diagnostics?.generation?.current || 0)}`);
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
      "sphere-diag-surface-failure-code-warn",
      "sphere-diag-surface-failures-warn",
      "sphere-diag-surface-container-warn",
      "sphere-diag-surface-canvas-warn",
      "sphere-diag-surface-generation-warn",
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
    const container = document.getElementById("sphere-container");
    const surface = _verifyRenderSurface(container, { requireVisibleCenter: false });
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
      "sphere-diag-surface-health": surface.healthy ? "healthy" : `unhealthy (${surface.reason || "unknown"})`,
      "sphere-diag-surface-canvas-connected": surface.checks?.canvasConnected ? "yes" : "no",
      "sphere-diag-surface-css-size": `${Math.round(Number(diag.canvasClientWidth || 0))} × ${Math.round(Number(diag.canvasClientHeight || 0))}`,
      "sphere-diag-surface-drawing-buffer": `${Math.round(Number(diag.drawingBufferWidth || 0))} × ${Math.round(Number(diag.drawingBufferHeight || 0))}`,
      "sphere-diag-surface-context-lost": diag.stageState?.context === "lost" ? "yes" : "no",
      "sphere-diag-surface-first-frame": diag.stageState?.firstFrame === "rendered" ? "yes" : "no",
      "sphere-diag-surface-scene-objects": String(Number(diag.sceneObjectCount || 0)),
      "sphere-diag-surface-broken-resources": String((Array.isArray(surface.brokenResources) ? surface.brokenResources.length : 0) + (Array.isArray(surface.resourceFailureLog) ? surface.resourceFailureLog.length : 0)),
      "sphere-diag-surface-duplicate-canvases": String(Math.max(0, Number(surface.canvasCount || 0) - 1)),
      "sphere-diag-surface-center-stack": Array.isArray(surface.centerStack?.stack) && surface.centerStack.stack.length
        ? surface.centerStack.stack.slice(0, 4).map(item => `${String(item.tagName || "").toUpperCase()}${item.className ? `.${String(item.className).split(/\s+/).filter(Boolean).join(".")}` : ""}`).join(" → ")
        : "none",
      "sphere-diag-surface-init-timeline": [
        ...((_state.initTimeline || []).slice(-8).map(item => `${item.stage}@${item.generation}`)),
        ...((diag.initTimeline || []).slice(-12).map(item => item.stage)),
        ...((_state.renderSurfaceCanvasTrace || []).slice(-8).map(item => `${item.stage}:${item.connected ? "ok" : "lost"}`)),
      ].join(" → ") || "none",
      "sphere-diag-surface-first-failure": _state.firstRenderSurfaceFailure
        ? `${_state.firstRenderSurfaceFailure.reason} · ${(Array.isArray(_state.firstRenderSurfaceFailure.failures) ? _state.firstRenderSurfaceFailure.failures.join(", ") : "none")}`
        : "none",
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

  function _seasonContextForLocation(model) {
    const envState = globalThis.SofEnvironmentState?.getEnvironmentState?.() || null;
    const place = envState?.place || null;
    const lat = Number(place?.latitude);
    const selected = model?.selectedPatternPosition || _resolveSelectedPatternPosition(model) || null;
    const angleRaw = Number(selected?.solar?.angle ?? model?.currentSolarSeasonAngle ?? model?.solarSeasonAngle ?? NaN);
    const angle = Number.isFinite(angleRaw) ? ((angleRaw % 360) + 360) % 360 : null;
    const quarter = angle == null ? null : Math.floor(angle / 90) % 4;
    const progress = angle == null ? null : (angle % 90) / 90;
    const north = ["Spring", "Summer", "Autumn", "Winter"];
    const south = ["Autumn", "Winter", "Spring", "Summer"];
    let hemisphere = "Location required";
    let label = "Seasonal field unavailable";
    if (Number.isFinite(lat)) {
      if (Math.abs(lat) < 10) {
        hemisphere = "Equatorial";
        label = quarter == null ? "Solar quarter" : `Solar quarter ${quarter + 1}`;
      } else {
        const isNorth = lat > 0;
        hemisphere = isNorth ? "Northern" : "Southern";
        label = quarter == null ? "Season unavailable" : (isNorth ? north : south)[quarter];
      }
    }
    const gateNames = ["March Equinox", "June Solstice", "September Equinox", "December Solstice"];
    const nextGateIndex = quarter == null ? null : (quarter + 1) % 4;
    const daysToGate = progress == null ? null : Math.max(0, Math.round((1 - progress) * (365.2422 / 4)));
    return {
      place,
      latitude: Number.isFinite(lat) ? lat : null,
      hemisphere,
      season: label,
      progress: progress == null ? null : Math.max(0, Math.min(1, progress)),
      angle,
      nextGate: nextGateIndex == null ? null : gateNames[nextGateIndex],
      daysToGate,
    };
  }

  function _selectedDaylightEstimate(model) {
    const envState = globalThis.SofEnvironmentState?.getEnvironmentState?.() || null;
    const lat = Number(envState?.place?.latitude);
    if (!Number.isFinite(lat)) return null;
    const selected = model?.selectedPatternPosition || _resolveSelectedPatternPosition(model) || null;
    const patternDay = Math.max(1, Math.min(364, Number(selected?.dayOfPatternYear || _state.selectedDayOfYear || 1)));
    const year = Number(_state.year || selected?.patternYear || new Date().getFullYear());
    let date = null;
    try {
      const epoch = globalThis.PatternCalendar?.epochForYear?.(year);
      if (epoch instanceof Date && !Number.isNaN(epoch.getTime())) date = new Date(epoch.getTime() + (patternDay - 1) * 86400000);
    } catch (_) {}
    if (!date) date = new Date(Date.UTC(year, 3, 17 + patternDay - 1));
    const start = Date.UTC(date.getUTCFullYear(), 0, 0);
    const doy = Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start) / 86400000);
    const phi = lat * Math.PI / 180;
    const decl = (23.44 * Math.PI / 180) * Math.sin((2 * Math.PI / 365) * (doy - 80));
    const x = -Math.tan(phi) * Math.tan(decl);
    const hours = x <= -1 ? 24 : x >= 1 ? 0 : (24 / Math.PI) * Math.acos(x);
    return Number.isFinite(hours) ? Math.max(0, Math.min(24, hours)) : null;
  }

  function _historicalClimateSummary(model) {
    const envState = globalThis.SofEnvironmentState?.getEnvironmentState?.() || null;
    const source = envState?.historicalClimate || envState?.climate || null;
    const monthly = Array.isArray(source?.monthly) ? source.monthly : null;
    if (!monthly || !monthly.length) return "";
    const selected = model?.selectedPatternPosition || _resolveSelectedPatternPosition(model) || null;
    const patternDay = Math.max(1, Math.min(364, Number(selected?.dayOfPatternYear || 1)));
    const year = Number(_state.year || new Date().getFullYear());
    let date = null;
    try {
      const epoch = globalThis.PatternCalendar?.epochForYear?.(year);
      if (epoch instanceof Date && !Number.isNaN(epoch.getTime())) date = new Date(epoch.getTime() + (patternDay - 1) * 86400000);
    } catch (_) {}
    const month = date ? date.getUTCMonth() : Math.max(0, Math.min(11, Math.floor(((patternDay - 1) / 364) * 12)));
    const entry = monthly[month] || null;
    if (!entry) return "";
    const low = Number(entry.low ?? entry.min ?? entry.temperatureMin);
    const high = Number(entry.high ?? entry.max ?? entry.temperatureMax);
    if (!Number.isFinite(low) || !Number.isFinite(high)) return "";
    const unit = String(source.unit || source.temperatureUnit || "°");
    return ` · climate ${Math.round(low)}–${Math.round(high)}${unit}`;
  }

  function _updateLocationSeasonStrip(model) {
    const root = document.getElementById("sphere-location-season-strip");
    const placeEl = document.getElementById("sphere-location-season-place");
    const seasonEl = document.getElementById("sphere-location-season-value");
    const action = document.getElementById("sphere-location-season-action");
    if (!root || !placeEl || !seasonEl || !action) return;
    const ctx = _seasonContextForLocation(model);
    const placeLabel = ctx.place?.name || ctx.place?.label || "Location not set";
    placeEl.textContent = placeLabel;
    const pct = ctx.progress == null ? "" : ` · ${Math.round(ctx.progress * 100)}% through`;
    const daylight = _selectedDaylightEstimate(model);
    const daylightLabel = daylight == null ? "" : ` · ≈${daylight.toFixed(1)}h daylight`;
    const climateLabel = _historicalClimateSummary(model);
    const nextGateLabel = ctx.nextGate
      ? ` · next ${ctx.nextGate}${Number.isFinite(ctx.daysToGate) ? ` ≈${ctx.daysToGate}d` : ""}`
      : "";
    seasonEl.textContent = ctx.latitude == null
      ? "Set location to orient seasons around the Sphere"
      : `${ctx.hemisphere} · ${ctx.season}${pct}${daylightLabel}${nextGateLabel}${climateLabel}`;
    action.textContent = ctx.latitude == null ? "Set location" : "Change";
    root.dataset.configured = ctx.latitude == null ? "false" : "true";
    root.dataset.hemisphere = ctx.hemisphere.toLowerCase();
  }

  function _setModeDefaultSelectedMarker(mode, model = null) {
    if (mode === "today") {
      const selected = model?.selectedPatternPosition || null;
      _state.selectedMarker = selected?.isToday
        ? "today"
        : (selected?.dayOfPatternYear != null ? `day-${_clampPatternDay(selected.dayOfPatternYear)}` : "today");
    }
    else if (mode === "passage") _state.selectedMarker = `eq-${_state.year}`;
    else if (mode === "years") _state.selectedMarker = `year-${_state.year}`;
    else if (mode === "pattern") {
      _state.selectedMarker = _state.selectedDayOfYear != null ? `day-${_clampPatternDay(_state.selectedDayOfYear)}` : "today";
    }
  }

  function _syncModeButtons() {
    document.querySelectorAll("[id^='sphere-mode-']").forEach(b => b.setAttribute("aria-pressed", "false"));
    const active = document.getElementById(`sphere-mode-${_state.activeViewMode || _state.viewMode}`);
    if (active) active.setAttribute("aria-pressed", "true");
  }

  function _selectTemporalYear(
    container,
    year,
    {
      source =
        "temporal-strata"
    } = {}
  ) {
    const nextYear =
      Math.trunc(
        Number(year)
      );

    if (
      !Number.isFinite(nextYear)
    ) {
      return false;
    }

    const model =
      buildCurrentModel();

    const patternDay =
      _clampPatternDay(
        _state.selectedDayOfYear
        || model
          ?.selectedPatternPosition
          ?.dayOfPatternYear
        || _resolveLiveTodayTarget()
          ?.dayOfPatternYear
        || 1
      );

    const previousYear =
      _state.year;

    /*
     * Year is one dimension of the temporal coordinate.
     * Changing it must not silently change Pattern position
     * or semantic view mode.
     */
    _stopTemporalPlayback(
      "temporal-year-select"
    );

    _state.year =
      nextYear;

    _state.selectedDayOfYear =
      patternDay;

    _state.selectedMarker =
      `year-${nextYear}`;

    _syncYearSelect(
      nextYear
    );

    globalThis
      .LivingTimeSphereAccessibility
      ?.announce?.(
        `Year ${nextYear} selected. Pattern Day ${patternDay} preserved.`
      );

    try {
      container?.dispatchEvent?.(
        new CustomEvent(
          "living-time:temporal-year-selected",
          {
            bubbles: true,
            detail: {
              previousYear,
              year:
                nextYear,
              selectedDayOfYear:
                patternDay,
              source,
              viewMode:
                _state.viewMode
            }
          }
        )
      );
    } catch (_) {
      /* optional semantic event */
    }

    render(container);

    return true;
  }

  function _syncYearSelect(year) {
    ["sphere-year-select", "sphere-year-nav-select"].forEach(id => {
      const sel = document.getElementById(id);
      if (sel) sel.value = String(year);
    });
    const liveYear = Number(_resolveLiveTodayTarget()?.year || _currentSnapshot()?.year || year);
    const liveBtn = document.getElementById("sphere-year-live");
    if (liveBtn) {
      const isLive = Number(year) === liveYear;
      liveBtn.dataset.live = isLive ? "true" : "false";
      liveBtn.textContent = isLive ? `Live ${liveYear}` : `Go to ${liveYear}`;
      liveBtn.setAttribute("aria-label", isLive ? `Viewing live year ${liveYear}` : `Go to live year ${liveYear}`);
    }
  }


  /*
   * Phase IIID — selected temporal membrane inspector.
   *
   * This is presentation only.
   *
   * It does not calculate astronomy or calendar coordinates.
   * Values come from the canonical selected-year model and its
   * Alignment Ledger source record.
   */
  function _syncTemporalYearInspector(
    model
  ) {
    if (!model) {
      return;
    }

    const title =
      document.getElementById(
        "sphere-strata-year-inspector-title"
      );

    if (!title) {
      return;
    }

    const setText = (
      id,
      value
    ) => {
      const el =
        document.getElementById(
          id
        );

      if (el) {
        el.textContent =
          value == null
            || value === ""
              ? "—"
              : String(value);
      }
    };

    const year =
      Math.trunc(
        Number(
          _state.year
          ?? model.year
        )
      );

    const selected =
      model.selectedPatternPosition
      || _resolveSelectedPatternPosition(
        model
      )
      || {};

    const record =
      model.sourceRecord
      || null;

    const equinox =
      record
        ?.equinox
        ?.patternPosition
      || {};

    const offsets =
      record
        ?.offsets
      || {};

    const day =
      selected.dayOfPatternYear;

    const moon =
      selected.moon;

    const moonDay =
      selected.day;

    const angle =
      Number(
        model.passageStartAngle
      );

    const passageDays =
      Number(
        offsets.equinoxToYearGateDays
      );

    const liveYear =
      Number(
        _resolveLiveTodayTarget()
          ?.patternYear
      );

    let relation =
      "Selected reference";

    if (
      Number.isFinite(liveYear)
      && Number.isFinite(year)
    ) {
      const delta =
        year - liveYear;

      relation =
        delta === 0
          ? "Live Pattern year"
          : delta < 0
            ? `${Math.abs(delta)} year${Math.abs(delta) === 1 ? "" : "s"} before Live Today`
            : `${delta} year${delta === 1 ? "" : "s"} after Live Today`;
    }

    title.textContent =
      Number.isFinite(year)
        ? `Year ${year}`
        : "Year —";

    setText(
      "sphere-strata-year-pattern",
      (
        moon != null
        && moonDay != null
      )
        ? `Moon ${moon} · Day ${moonDay}`
        : "Pattern coordinate unavailable"
    );

    setText(
      "sphere-strata-year-day",
      day != null
        ? `${day} / 364`
        : "Outside counted Pattern year"
    );

    setText(
      "sphere-strata-year-equinox",
      (
        equinox.moon != null
        && equinox.day != null
      )
        ? `Moon ${equinox.moon} · Day ${equinox.day}`
        : "No supported Alignment Ledger record"
    );

    setText(
      "sphere-strata-year-passage",
      Number.isFinite(
        passageDays
      )
        ? `${(
            passageDays * 24
          ).toFixed(1)} hours`
        : "Unavailable"
    );

    setText(
      "sphere-strata-year-angle",
      Number.isFinite(angle)
        ? `${angle.toFixed(1)}°`
        : "Unavailable"
    );

    setText(
      "sphere-strata-year-relation",
      relation
    );

    const evidence =
      document.getElementById(
        "sphere-strata-year-evidence"
      );

    if (evidence) {
      if (record) {
        evidence.textContent =
          "Alignment record";

        evidence.classList.remove(
          "is-unavailable"
        );
      } else {
        evidence.textContent =
          "No measured record";

        evidence.classList.add(
          "is-unavailable"
        );
      }
    }

    const note =
      document.getElementById(
        "sphere-strata-year-note"
      );

    if (note) {
      note.textContent =
        (
          Number.isFinite(year)
          && Number.isFinite(liveYear)
          && year !== liveYear
        )
          ? (
              `Pattern Day ${
                day ?? "—"
              } is preserved while the selected year changes. `
              + "Historical astronomy is shown only where canonical Alignment Ledger evidence exists."
            )
          : (
              "Tap a visible year membrane to move this same Pattern coordinate through time."
            );
    }
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

    /*
     * The membrane inspector and the large detail panel consume
     * the exact same canonical model.
     */
    _syncTemporalYearInspector(
      model
    );
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
    const strataEnabled =
      globalThis
        .LivingTimeSphereTemporalStrata
        ?.state
        ?.enabled
      === true;

    const yearSummary = (
      _state.viewMode === "years"
      || strataEnabled
    )
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

  function _updateTemporalLens(model) {
    const selected = model?.selectedPatternPosition || null;
    const today = model?.todayPatternPosition || _currentSnapshot()?.todayModel?.todayPatternPosition || null;
    const temporal = globalThis.LivingTimeSphereTemporal;
    const comparison = model?.temporalComparison || temporal?.compareToToday?.(selected, today) || null;
    const day = _clampPatternDay(selected?.dayOfPatternYear || _state.selectedDayOfYear || 1);
    const position = temporal?.moonDayForPatternDay?.(day) || {
      moon: Math.floor((day - 1) / 28) + 1,
      day: ((day - 1) % 28) + 1,
      week: Math.floor(((day - 1) % 28) / 7) + 1,
    };
    const scrubber = document.getElementById("sphere-day-scrubber");
    const output = document.getElementById("sphere-day-scrubber-output");
    const status = document.getElementById("sphere-temporal-status");
    const comparisonEl = document.getElementById("sphere-temporal-comparison");
    const realityStateEl = document.getElementById("sphere-reality-state");
    const returnButton = document.getElementById("sphere-return-today");
    const playButton = document.getElementById("sphere-temporal-play");

    if (scrubber) {
      scrubber.value = String(day);
      scrubber.setAttribute("aria-valuetext", `Moon ${position.moon}, Day ${position.day}, Pattern day ${day} of 364`);
    }
    if (output) output.textContent = `Moon ${position.moon} · Day ${position.day} · ${day}/364`;

    const isLive = !!comparison?.isLiveToday;
    const statusState = _state.temporalPlaybackActive ? "playing" : (isLive ? "live" : "exploring");
    if (status) {
      status.dataset.state = statusState;
      status.textContent = statusState === "playing" ? "Time in Motion" : (isLive ? "Live Today" : "Exploring");
    }
    if (returnButton) {
      const alreadyLiveView = isLive && _state.viewMode === "today";
      returnButton.disabled = alreadyLiveView;
      returnButton.textContent = alreadyLiveView ? "Live Today Selected" : "Return to Live Today";
    }
    if (playButton) {
      playButton.setAttribute("aria-pressed", _state.temporalPlaybackActive ? "true" : "false");
      playButton.textContent = _state.temporalPlaybackActive ? "Pause" : "Play";
    }

    if (realityStateEl) {
      const selectedYear = Number(selected?.patternYear ?? _state.year ?? 0);
      const todayYear = Number(today?.patternYear ?? _currentSnapshot()?.year ?? 0);
      const selectedOrdinal = selectedYear * 364 + day;
      const todayDay = _clampPatternDay(today?.dayOfPatternYear || day);
      const todayOrdinal = todayYear * 364 + todayDay;
      const phase = selectedOrdinal < todayOrdinal ? "past" : selectedOrdinal > todayOrdinal ? "future" : "present";
      const phaseCopy = {
        past: { title: "Past · Record", note: "Inspect what has already happened: measurements, witness records, events, media, relationships, and historical pattern positions." },
        present: { title: "Present · Being", note: "The selected coordinate is synchronized with the current Pattern position. Live fields describe what can be observed now." },
        future: { title: "Future · Possibility", note: "Use this space for schedules, intentions, tasks, scenarios, and planned events. Future geometry is not a prediction." }
      };
      realityStateEl.dataset.phase = phase;
      realityStateEl.querySelectorAll("[data-reality-phase]").forEach(node => {
        node.classList.toggle("is-active", node.getAttribute("data-reality-phase") === phase);
      });
      const head = realityStateEl.querySelector(".sphere-reality-state-head strong");
      const note = realityStateEl.querySelector(".sphere-reality-note");
      if (head) head.textContent = phaseCopy[phase].title;
      if (note) note.textContent = phaseCopy[phase].note;
    }

    if (!comparisonEl) return;
    comparisonEl.setAttribute("aria-live", _state.temporalPlaybackActive ? "off" : "polite");

    if (!comparison) {
      comparisonEl.innerHTML = '<p class="sphere-temporal-comparison-lead">Live comparison is unavailable for this outside day.</p>';
      return;
    }
    const civilDelta = comparison.civilDayDelta;
    const civilLabel = civilDelta == null
      ? "Not available"
      : civilDelta === 0
        ? "Same civil day"
        : `${civilDelta > 0 ? "+" : ""}${civilDelta} days`;
    const shortestLabel = comparison.shortestSignedDays === 0
      ? "Aligned"
      : `${comparison.shortestSignedDays > 0 ? "+" : ""}${comparison.shortestSignedDays} days`;
    const arcLabel = comparison.forwardDays === 0 ? "0 days" : `${comparison.forwardDays} days forward`;
    const relation = comparison.isLiveToday
      ? "The selected marker is synchronized with the canonical live Pattern day."
      : `${comparison.relationshipLabel}. The Sphere keeps Today visible while you inspect this position.`;
    comparisonEl.innerHTML = `
      <p class="sphere-temporal-comparison-lead">${_escapeHtml(relation)}</p>
      <div class="sphere-temporal-metrics" aria-label="Selected day compared with Today">
        <span class="sphere-temporal-metric"><span>Shortest arc</span><strong>${_escapeHtml(shortestLabel)}</strong></span>
        <span class="sphere-temporal-metric"><span>Forward cycle</span><strong>${_escapeHtml(arcLabel)}</strong></span>
        <span class="sphere-temporal-metric"><span>Civil offset</span><strong>${_escapeHtml(civilLabel)}</strong></span>
        <span class="sphere-temporal-metric"><span>Angular offset</span><strong>${_escapeHtml(`${comparison.angleDelta > 0 ? "+" : ""}${comparison.angleDelta.toFixed(1)}°`)}</strong></span>
        <span class="sphere-temporal-metric"><span>Moon relation</span><strong>${comparison.sameMoon ? "Same Moon" : `Moon ${comparison.todayMoon} → ${comparison.selectedMoon}`}</strong></span>
        <span class="sphere-temporal-metric"><span>Week relation</span><strong>${comparison.sameWeek ? "Same Week Gate" : `Week ${position.week}`}</strong></span>
      </div>`;
  }

  function _clearTemporalPlaybackTimer() {
    if (_state.temporalPlaybackTimer) clearTimeout(_state.temporalPlaybackTimer);
    _state.temporalPlaybackTimer = 0;
  }

  function _stopTemporalPlayback(reason = "manual", { announce = false } = {}) {
    const wasActive = _state.temporalPlaybackActive;
    _clearTemporalPlaybackTimer();
    _state.temporalPlaybackActive = false;
    if (wasActive) {
      _recordActionTrace("TEMPORAL_PLAYBACK_STOP", { reason }, ["temporal-lens"]);
      if (announce) globalThis.LivingTimeSphereAccessibility?.announce?.("Pattern time playback paused.");
      try { _updateTemporalLens(buildCurrentModel()); } catch { /* UI may be tearing down */ }
    }
  }

  function _temporalPlaybackDelay() {
    const requested = Math.max(180, Math.min(3000, Number(_state.temporalPlaybackSpeed) || 700));
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    return reduced ? Math.max(1400, requested) : requested;
  }

  function _scheduleTemporalPlayback(container) {
    _clearTemporalPlaybackTimer();
    if (!_state.temporalPlaybackActive || !container) return;
    _state.temporalPlaybackTimer = setTimeout(() => {
      _state.temporalPlaybackTimer = 0;
      if (typeof document !== "undefined" && document.hidden) {
        _stopTemporalPlayback("document-hidden");
        return;
      }
      const temporal = globalThis.LivingTimeSphereTemporal;
      const current = _clampPatternDay(_state.selectedDayOfYear || _resolveSelectedDayOfYear(buildCurrentModel()));
      const next = temporal?.stepWithinScope
        ? temporal.stepWithinScope(current, 1, _state.temporalPlaybackScope)
        : (current >= 364 ? 1 : current + 1);
      _state.temporalPlaybackStepCount += 1;
      _incrementActionCounter("temporalPlaybackStepCount");
      _requestSelectedDayUpdate(container, next, {
        source: "temporal-playback",
        action: "TEMPORAL_PLAYBACK_STEP",
      });
      _scheduleTemporalPlayback(container);
    }, _temporalPlaybackDelay());
  }

  function _toggleTemporalPlayback(container) {
    if (_state.temporalPlaybackActive) {
      _stopTemporalPlayback("play-button", { announce: true });
      return;
    }
    _state.temporalPlaybackActive = true;
    _recordActionTrace("TEMPORAL_PLAYBACK_START", {
      speedMs: _temporalPlaybackDelay(),
      scope: _state.temporalPlaybackScope,
    }, ["temporal-lens", "selected-state"]);
    globalThis.LivingTimeSphereAccessibility?.announce?.("Pattern time playback started.");
    _updateTemporalLens(buildCurrentModel());
    _scheduleTemporalPlayback(container);
  }

  function _buildTodaySelectionPatch(target, { fieldRange = "now", switchViewMode = true, currentViewMode = _state.viewMode } = {}) {
    if (!target || !Number.isFinite(Number(target.dayOfPatternYear))) return null;
    return Object.freeze({
      selectedDayOfYear: _clampPatternDay(target.dayOfPatternYear),
      year: Number(target.year) || _state.year,
      selectedMarker: "today",
      fieldRange: fieldRange === "today" ? "today" : "now",
      requestedViewMode: switchViewMode ? "today" : currentViewMode,
    });
  }

  function _returnToLiveToday(container, { fieldRange = "now", switchViewMode = true, source = "today-control" } = {}) {
    if (!container) return false;
    const target = _resolveLiveTodayTarget();
    if (!target) {
      globalThis.LivingTimeSphereAccessibility?.announce?.("The live Pattern day is outside the counted 364-day year.");
      return false;
    }
    _stopTemporalPlayback("return-to-today");
    const patch = _buildTodaySelectionPatch(target, { fieldRange, switchViewMode });
    if (!patch) return false;
    const resolvedRange = patch.fieldRange;
    _state.year = patch.year;
    _state.selectedDayOfYear = patch.selectedDayOfYear;
    _state.selectedMarker = patch.selectedMarker;
    _state.fieldRange = patch.fieldRange;
    _state.lastTodayResetSource = source;
    _state.lastTodayResetAt = Date.now();
    _persistSelectedState();
    _syncYearSelect(_state.year);
    _syncFieldRangeButtons();
    const preparedModel = buildCurrentModel();
    _syncDaySelectorsFromModel(preparedModel);

    if (switchViewMode && _state.viewMode !== "today") {
      _requestViewModeTransition(container, "today");
    } else {
      _requestSelectedDayUpdate(container, target.dayOfPatternYear, {
        marker: "today",
        year: target.year,
        fieldRange: resolvedRange,
        source,
        action: "RETURN_TO_LIVE_TODAY",
      });
    }
    _incrementActionCounter("todayResetCount");
    _recordActionTrace("RETURN_TO_LIVE_TODAY", {
      source,
      selectedDayOfYear: target.dayOfPatternYear,
      patternYear: target.patternYear,
      selectedYear: target.year,
      fieldRange: resolvedRange,
      viewMode: switchViewMode ? "today" : _state.viewMode,
    }, ["selected-state", "mode", "url", "details", "renderer"]);
    globalThis.LivingTimeSphereAccessibility?.announce?.(`Returned to Today: Moon ${target.moon || Math.floor((target.dayOfPatternYear - 1) / 28) + 1}, Day ${target.day || ((target.dayOfPatternYear - 1) % 28) + 1}.`);
    return true;
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
    // B7.30 — day label mode is user-authoritative. "key" means the
    // camera-aware progressive reveal, not "let semantic zoom silently change
    // me to all". This prevents unrelated layer toggles (environment, planets,
    // etc.) or a near/detail zoom refresh from exposing all 364 numerals while
    // Reveal all days is OFF.
    const effectiveMoonLabelMode = moonLabelExplicit ? _state.moonLabelMode : (semanticZoom?.moonLabelMode || _state.moonLabelMode);
    const effectiveDayLabelMode = _state.dayLabelMode || "key";
    const effectiveConnectionMode = semanticZoom?.connectionMode || _state.connectionMode;
    const connectionRegistry = globalThis.LivingTimeSphereConnections?.buildRegistry?.({
      model,
      spiral,
      state: {
        ..._state,
        mode: _state.viewMode,
        selectedYear: _state.year,
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
      const intent = _state.pendingSelectedIntent || {};
      _state.pendingSelectedDay = null;
      _state.pendingSelectedIntent = null;
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
        year: _state.year,
        fieldRange: _state.fieldRange,
      };
      try {
        if (Number.isFinite(Number(intent.year))) {
          _state.year = Number(intent.year);
        }
        if (intent.fieldRange && FIELD_RANGE_LABELS[intent.fieldRange]) {
          _state.fieldRange = intent.fieldRange;
        }
        _state.selectedDayOfYear = nextDay;
        _state.selectedMarker = typeof intent.marker === "string" && intent.marker
          ? intent.marker
          : `day-${nextDay}`;
        _persistSelectedState();
        const stateAppliedAt = performance.now();

        const model = buildCurrentModel();
        _syncYearSelect(_state.year);
        _syncFieldRangeButtons();
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
          _updateTemporalLens(model);
          _updateTodayDiagnostics(model);
          _updateModeSummary(model);
          _updateWhatAmISeeing(_state.viewMode);
          _updateStateStrip(_state.viewMode, model);
          _updateEnvironmentBridge(model);
    _updateLocationSeasonStrip(model);
          _updateRendererDiagnostics();
        }
        _incrementActionCounter("selectedDayUpdateCount");
        _recordActionTrace(intent.action || "SELECTED_DAY_CHANGE", {
          selectedDayOfYear: nextDay,
          marker: _state.selectedMarker,
          source: intent.source || "calendar-control",
        }, incrementalUsed ? ["selected-state", "incremental-render"] : ["selected-state", "full-render"]);
        _emitCalendarWorkbenchEvent("livingtime:selectionchange", model, {
          source: intent.source || "calendar-control",
        });
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
          source: intent.source || "calendar-control",
        });
      } catch (error) {
        _state.selectedDayOfYear = previous.selectedDayOfYear;
        _state.selectedMarker = previous.selectedMarker;
        _state.year = previous.year;
        _state.fieldRange = previous.fieldRange;
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

  function _requestSelectedDayUpdate(container, day, intent = {}) {
    _state.pendingSelectedDay = _clampPatternDay(day);
    _state.pendingSelectedIntent = { ...intent };
    _flushSelectedDayUpdates(container);
  }

  function _emitCalendarWorkbenchEvent(type, model = null, extra = {}) {
    if (typeof window === "undefined" || typeof CustomEvent === "undefined") return;
    const currentModel = model || (() => {
      try { return buildCurrentModel(); } catch { return null; }
    })();
    const selected = currentModel?.selectedPatternPosition || null;
    window.dispatchEvent(new CustomEvent(type, {
      detail: Object.freeze({
        year: Number(_state.year || 0) || null,
        selectedDayOfYear: Number(_state.selectedDayOfYear || selected?.dayOfPatternYear || 0) || null,
        selectedMarker: _state.selectedMarker || null,
        viewMode: _state.viewMode,
        fieldRange: _state.fieldRange,
        visibleLayers: { ..._state.visibleLayers },
        selected,
        today: currentModel?.todayPatternPosition || null,
        ...extra,
      }),
    }));
  }

  function _applyLayerPreset(container, presetName) {
    const stateApi = globalThis.LivingTimeSphereState;
    if (!container || !stateApi?.presetLayers || !stateApi?.LAYER_PRESETS?.[presetName]) return false;
    const environment = globalThis.SofEnvironmentState?.getEnvironmentState?.() || null;
    const witnessAvailable = !!globalThis.CodexWitness || !!globalThis.CodexMemory;
    const nextLayers = stateApi.presetLayers(presetName, {
      compact: false,
      environmentAvailable: !!environment?.providerConfigured,
      witnessAvailable,
    });
    Object.keys(_state.visibleLayers).forEach(layer => {
      _state.visibleLayers[layer] = !!nextLayers[layer];
    });
    _state.userCustomizedLayers = true;
    _state.layerStateSource = `calendar-preset:${presetName}`;
    _syncLayerCheckboxes();
    _incrementActionCounter("layerUpdateCount");
    _recordActionTrace("CALENDAR_LAYER_PRESET", { presetName }, ["layers", "calendar-workbench"]);
    renderSphere(container);
    _emitCalendarWorkbenchEvent("livingtime:layerschange", null, { presetName });
    return true;
  }

  // ── Canonical temporal cursor bridge ───────────────────────────────
  function _alignmentYearForCursorCoordinate(coordinate) {
    const requestedYear = Number(
      coordinate?.remnant13Moons?.patternYear
    );

    const supported =
      _supportedAlignmentYears();

    if (
      Number.isFinite(requestedYear) &&
      supported.includes(requestedYear)
    ) {
      return requestedYear;
    }

    if (
      Number.isFinite(requestedYear) &&
      supported.length
    ) {
      return supported.reduce(
        (best, year) =>
          Math.abs(year - requestedYear) <
          Math.abs(best - requestedYear)
            ? year
            : best,
        supported[0]
      );
    }

    return _state.year;
  }

  function _setCursorFromPatternDay(
    container,
    day,
    options = {}
  ) {
    const targetDay =
      _clampPatternDay(day);

    const targetYear =
      Number(options.year || _state.year);

    const targetDate =
      _patternDateFromDayOfYear(
        targetYear,
        targetDay
      );

    const cursor =
      globalThis.SOFTemporalCursor;

    if (
      cursor?.setDate &&
      targetDate instanceof Date &&
      !Number.isNaN(targetDate.getTime())
    ) {
      cursor.setDate(
        targetDate,
        {
          source:
            options.source ||
            "sphere-pattern-navigation",

          reason:
            options.reason ||
            "sphere-pattern-day"
        }
      );

      return true;
    }

    // Safe fallback if the temporal cursor is unavailable.
    _requestSelectedDayUpdate(
      container,
      targetDay,
      {
        source:
          options.source ||
          "sphere-pattern-navigation"
      }
    );

    return false;
  }

  function _applyTemporalCursorToSphere(
    container,
    event
  ) {
    const detail =
      event?.detail || {};

    const coordinate =
      detail.coordinate ||
      globalThis.SOFTemporalCursor
        ?.getCoordinate?.();

    const remnant =
      coordinate?.remnant13Moons;

    if (!remnant) {
      return;
    }

    /*
      Intercalary / Year Gate dates do not have
      a counted Pattern Day. Keep the current
      visual day until outside-day rendering gets
      its dedicated cursor treatment.
    */
    if (
      remnant.isYearGate ||
      !Number.isFinite(
        Number(remnant.patternDay)
      )
    ) {
      return;
    }

    const targetDay =
      _clampPatternDay(
        remnant.patternDay
      );

    const targetYear =
      _alignmentYearForCursorCoordinate(
        coordinate
      );

    const alreadySelected =
      Number(_state.selectedDayOfYear) ===
        targetDay &&
      Number(_state.year) ===
        Number(targetYear);

    _state.year =
      targetYear;

    _state.selectedMarker =
      detail.source === "cursor-today" ||
      detail.reason === "today" ||
      detail.source === "today-button"
        ? "today"
        : `day-${targetDay}`;

    if (alreadySelected) {
      _persistSelectedState();

      const model =
        buildCurrentModel();

      _syncDaySelectorsFromModel(
        model
      );

      _updateSphereUrlFromModel(
        model,
        { replace: true }
      );

      return;
    }

    _requestSelectedDayUpdate(
      container,
      targetDay,
      {
        source:
          detail.source ||
          "temporal-cursor",

        action:
          "TEMPORAL_CURSOR_SELECT"
      }
    );
  }

  function _wireTemporalCursorBridge(
    container
  ) {
    if (
      !container ||
      container.dataset
        .temporalCursorBridge === "ready"
    ) {
      return;
    }

    container.dataset
      .temporalCursorBridge = "ready";

    window.addEventListener(
      "sof:temporal-cursor-change",
      event =>
        _applyTemporalCursorToSphere(
          container,
          event
        )
    );

    window.addEventListener(
      "sof:temporal-cursor-ready",
      event =>
        _applyTemporalCursorToSphere(
          container,
          event
        )
    );
  }

  // ── Control wiring ─────────────────────────────────────────────────

  function wireControls(container) {
    _wireTemporalCursorBridge(container);
    const shiftSelectedDay = delta => {
      _stopTemporalPlayback("manual-day-navigation");
      const baseDay = _state.selectedDayOfYear ?? _resolveSelectedDayOfYear(buildCurrentModel());
      const nextDay = globalThis.LivingTimeSphereTemporal?.stepDay?.(baseDay, delta, { wrap: true })
        ?? _clampPatternDay(baseDay + delta);
      _setCursorFromPatternDay(
        container,
        nextDay,
        {
          source:
            delta < 0
              ? "sphere-prev-day"
              : "sphere-next-day",

          reason:
            "sphere-day-navigation"
        }
      );
    };

    const shiftSelectedMoon = delta => {
      _stopTemporalPlayback("manual-moon-navigation");
      const model = buildCurrentModel();
      const selected = model.selectedPatternPosition || _resolveSelectedPatternPosition(model);
      const currentMoon = selected?.moon || 1;
      const currentDay = selected?.day || 1;
      const nextMoon = ((currentMoon - 1 + delta + 13) % 13) + 1;
      _setCursorFromPatternDay(
        container,
        (nextMoon - 1) * 28 + currentDay,
        {
          source:
            delta < 0
              ? "sphere-prev-moon"
              : "sphere-next-moon",

          reason:
            "sphere-moon-navigation"
        }
      );
    };

    const runGuardedNavAction = (actionId, handler) => () => {
      const now = Date.now();
      if (_state.lastNavActionId === actionId && now - Number(_state.lastNavActionAt || 0) < 24) return;
      _state.lastNavActionId = actionId;
      _state.lastNavActionAt = now;
      handler();
    };

    document.getElementById("sphere-location-season-action")?.addEventListener("click", () => {
      _focusEnvironmentControls();
    });

    // View mode buttons.
    ["today", "passage", "years", "pattern"].forEach(mode => {
      const btn = document.getElementById(`sphere-mode-${mode}`);
      if (!btn) return;
      btn.addEventListener("click", () => {
        if (mode === "today") {
          _returnToLiveToday(container, { fieldRange: "now", switchViewMode: true, source: "view-mode-today" });
          return;
        }
        _stopTemporalPlayback("view-mode-change");
        _requestViewModeTransition(container, mode);
      });
    });

    // B7.25 — year navigation lives above the instrument. Keep the advanced
    // controls selector synchronized, but do not force the user into that panel.
    const years = typeof globalThis.AlignmentLedgerData?.listSupportedYears === "function"
      ? globalThis.AlignmentLedgerData.listSupportedYears()
      : Array.from({ length: 13 }, (_, i) => 2014 + i);
    const normalizedYears = years.map(Number).filter(Number.isFinite).sort((a, b) => a - b);

    const applyYear = (y, source = "year-navigator") => {
      y = Number(y);
      if (!Number.isFinite(y) || !normalizedYears.includes(y)) return;
      _stopTemporalPlayback(source);
      _state.year = y;
      const selectedDay = _clampPatternDay(_state.selectedDayOfYear || _resolveLiveTodayTarget()?.dayOfPatternYear || 1);
      _state.selectedDayOfYear = selectedDay;
      _state.selectedMarker = `day-${selectedDay}`;
      if (["now", "today"].includes(_state.fieldRange) && Number(_currentSnapshot()?.year) !== y) {
        _state.fieldRange = "historical";
      }
      _syncYearSelect(y);
      _persistSelectedState();
      renderSphere(container);
    };

    ["sphere-year-select", "sphere-year-nav-select"].forEach(id => {
      const select = document.getElementById(id);
      if (!select) return;
      select.innerHTML = normalizedYears.map(y => `<option value="${y}"${y === _state.year ? " selected" : ""}>${y}</option>`).join("");
      select.addEventListener("change", () => applyYear(select.value, id));
    });

    const stepYear = delta => {
      const index = normalizedYears.indexOf(Number(_state.year));
      const nextIndex = Math.max(0, Math.min(normalizedYears.length - 1, (index < 0 ? 0 : index) + delta));
      applyYear(normalizedYears[nextIndex], delta < 0 ? "year-prev" : "year-next");
    };
    document.getElementById("sphere-year-prev")?.addEventListener("click", () => stepYear(-1));
    document.getElementById("sphere-year-next")?.addEventListener("click", () => stepYear(1));
    document.getElementById("sphere-year-live")?.addEventListener("click", () => {
      const live = _resolveLiveTodayTarget();
      if (live?.year) {
        _returnToLiveToday(container, { fieldRange: "now", switchViewMode: false, source: "year-live" });
      }
    });
    _syncYearSelect(_state.year);

    // B7.27 — one compact quick navigator replaces hunting through multiple
    // panels. Queries resolve to the same canonical year/day state used by the
    // Sphere, then rotate the camera toward that coordinate.
    const quickInput = document.getElementById("sphere-quick-jump-input");
    const quickStatus = document.getElementById("sphere-quick-jump-status");
    const centerSelectedButton = document.getElementById("sphere-center-selected");
    const revealAllDaysButton = document.getElementById("sphere-reveal-all-days");
    const announceQuick = (message, ok = true) => {
      if (quickStatus) {
        quickStatus.textContent = message;
        quickStatus.dataset.state = ok ? "ok" : "warning";
      }
    };
    const focusDay = (day, distance = 1.82) => {
      const target = _clampPatternDay(day);
      const run = () => globalThis.LivingTimeSphereRenderer3d?.focusPatternDay?.(target, { distance, animated: true });
      // Run after the selection update and once more after its lightweight DOM
      // settle. focusPatternDay is idempotent and the second call protects
      // against a delayed renderer refresh from stealing the camera transition.
      window.setTimeout(run, 40);
      window.setTimeout(run, 180);
    };

    centerSelectedButton?.addEventListener("click", () => {
      const day = _clampPatternDay(_state.selectedDayOfYear || _resolveLiveTodayTarget()?.dayOfPatternYear || 1);
      focusDay(day, 1.78);
      announceQuick(`Centered Moon ${Math.floor((day - 1) / 28) + 1} Day ${((day - 1) % 28) + 1}.`);
    });

    const syncRevealAllDaysButton = () => {
      if (!revealAllDaysButton) return;
      const all = _state.dayLabelMode === "all";
      revealAllDaysButton.setAttribute("aria-pressed", all ? "true" : "false");
      revealAllDaysButton.textContent = all ? "Auto day reveal" : "Reveal all days";
      revealAllDaysButton.dataset.active = all ? "true" : "false";
    };
    syncRevealAllDaysButton();
    revealAllDaysButton?.addEventListener("click", () => {
      _state.dayLabelMode = _state.dayLabelMode === "all" ? "key" : "all";
      const advancedDayMode = document.getElementById("sphere-day-label-mode");
      if (advancedDayMode) advancedDayMode.value = _state.dayLabelMode;
      syncRevealAllDaysButton();
      renderSphere(container);
      announceQuick(_state.dayLabelMode === "all"
        ? "All 364 Pattern-day numerals revealed. Use Auto day reveal for the camera-aware view."
        : "Camera-aware day reveal restored.");
    });
    const runQuickJump = async () => {
      const raw = String(quickInput?.value || "").trim();
      if (!raw) return announceQuick("Enter Moon 5 Day 23, Day 135, a year, or a civil date.", false);
      const q = raw.toLowerCase().replace(/[·,]/g, " ").replace(/\s+/g, " ");
      if (/^(today|live|now)$/.test(q)) {
        _returnToLiveToday(container, { fieldRange: "now", switchViewMode: false, source: "quick-jump-today" });
        const liveDay = Number(_resolveLiveTodayTarget()?.dayOfPatternYear || 1);
        focusDay(liveDay, 1.9);
        return announceQuick("Returned to Live Today.");
      }
      const civil = /^(\d{4}-\d{2}-\d{2})$/.exec(q);
      if (civil) {
        const resolved = globalThis.LivingTimeCalendarWorkbench?.resolveCivilDate?.(civil[1]);
        if (!resolved?.valid) return announceQuick("That civil date could not be mapped.", false);
        if (!resolved.inside) return announceQuick(`${civil[1]} is outside the counted 13 × 28 days. Open Calendar Atlas for the Year Gate day.`, false);
        if (resolved.patternYear && normalizedYears.includes(Number(resolved.patternYear))) applyYear(Number(resolved.patternYear), "quick-jump-civil-year");
        _setCursorFromPatternDay(container, resolved.dayOfPatternYear, { year: Number(resolved.patternYear || _state.year), source: "quick-jump-civil" });
        focusDay(resolved.dayOfPatternYear, 1.78);
        return announceQuick(`${civil[1]} → Moon ${resolved.moon} Day ${resolved.day}.`);
      }
      const moonDay = /^(?:m|moon)\s*(\d{1,2})(?:\s*(?:d|day)\s*(\d{1,2}))?$/.exec(q);
      if (moonDay) {
        const moon = Math.max(1, Math.min(13, Number(moonDay[1])));
        const day = Math.max(1, Math.min(28, Number(moonDay[2] || 1)));
        const patternDay = (moon - 1) * 28 + day;
        _setCursorFromPatternDay(container, patternDay, { source: "quick-jump-moon-day" });
        focusDay(patternDay, moonDay[2] ? 1.72 : 2.05);
        return announceQuick(`Moon ${moon} Day ${day} selected.`);
      }
      const pattern = /^(?:p|pattern\s*day|day)\s*(\d{1,3})$/.exec(q);
      if (pattern) {
        const day = _clampPatternDay(Number(pattern[1]));
        _setCursorFromPatternDay(container, day, { source: "quick-jump-pattern-day" });
        focusDay(day, 1.74);
        return announceQuick(`Pattern Day ${day} selected.`);
      }
      const locationQuery = /^(?:location|place)\s+(.+)$/.exec(q);
      if (locationQuery) {
        const locationInput = document.querySelector("[data-location-search-input]");
        if (locationInput) locationInput.value = locationQuery[1];
        _focusEnvironmentControls();
        locationInput?.focus?.({ preventScroll: true });
        return announceQuick(`Location search ready for ${locationQuery[1]}.`);
      }
      const yearOnly = /^(?:year\s*)?(\d{4})$/.exec(q);
      if (yearOnly) {
        const year = Number(yearOnly[1]);
        if (!normalizedYears.includes(year)) return announceQuick(`Year ${year} is outside the supported alignment range.`, false);
        applyYear(year, "quick-jump-year");
        globalThis.LivingTimeSphereCamera?.moveTo?.({ dist: 3.15, animated: true, durationMs: 520, nowMs: performance.now() });
        return announceQuick(`Viewing year ${year}.`);
      }
      // Last resort: search the local planner by title/summary. This keeps the
      // quick navigator useful for human memory ("dentist", "school", project
      // name) without creating a second schedule database.
      try {
        const plans = await globalThis.CodexLivingPlanner?.allPlans?.();
        const needle = q.toLowerCase();
        const hit = (plans || []).find(plan => {
          const haystack = [plan?.title, plan?.summary, plan?.notes, plan?.type].filter(Boolean).join(" ").toLowerCase();
          return haystack.includes(needle);
        });
        const pd = Number(hit?.temporal?.patternDay || hit?.temporal?.dayOfPatternYear);
        const py = Number(hit?.temporal?.patternYear || hit?.temporal?.year);
        if (hit && Number.isFinite(pd) && pd >= 1 && pd <= 364) {
          if (Number.isFinite(py) && normalizedYears.includes(py)) applyYear(py, "quick-jump-plan-year");
          _setCursorFromPatternDay(container, pd, { year: Number.isFinite(py) ? py : _state.year, source: "quick-jump-plan" });
          focusDay(pd, 1.56);
          return announceQuick(`Found “${hit.title || raw}” on Pattern Day ${pd}.`);
        }
      } catch (_) {}
      announceQuick("No calendar coordinate or scheduled item matched that search.", false);
    };
    document.getElementById("sphere-quick-jump-submit")?.addEventListener("click", runQuickJump);
    quickInput?.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); runQuickJump(); } });

    document.querySelectorAll("[data-sphere-time-scale]").forEach(button => {
      button.addEventListener("click", () => {
        const scale = button.dataset.sphereTimeScale;
        const model = buildCurrentModel();
        const selected = model?.selectedPatternPosition || _resolveSelectedPatternPosition(model) || {};
        const day = _clampPatternDay(selected.dayOfPatternYear || _state.selectedDayOfYear || 1);
        document.querySelectorAll("[data-sphere-time-scale]").forEach(b => b.setAttribute("aria-pressed", b === button ? "true" : "false"));
        if (scale === "year") {
          globalThis.LivingTimeSphereCamera?.moveTo?.({ dist: 3.15, animated: true, durationMs: 540, nowMs: performance.now(), targetX: 0, targetY: 0, targetZ: 0 });
          announceQuick(`Year ${_state.year} overview.`);
        } else if (scale === "moon") {
          const center = (Math.max(1, Number(selected.moon || 1)) - 1) * 28 + 14;
          focusDay(center, 2.08);
          announceQuick(`Moon ${selected.moon || 1} view.`);
        } else if (scale === "week") {
          const weekStart = day - ((Math.max(1, Number(selected.day || 1)) - 1) % 7);
          focusDay(weekStart + 3, 1.58);
          announceQuick(`Week ${Math.ceil(Number(selected.day || 1) / 7)} of Moon ${selected.moon || 1}.`);
        } else if (scale === "agenda") {
          focusDay(day, 1.30);
          const plannerOpen = document.getElementById("living-planner-open");
          window.setTimeout(() => plannerOpen?.click?.(), 140);
          announceQuick(`Agenda for Moon ${selected.moon || 1} Day ${selected.day || 1}.`);
        } else {
          focusDay(day, 1.34);
          announceQuick(`Moon ${selected.moon || 1} Day ${selected.day || 1}.`);
        }
      });
    });

    Object.keys(FIELD_RANGE_LABELS).forEach(range => {
      const btn = document.getElementById(`sphere-field-range-${range}`);
      if (!btn) return;
      btn.addEventListener("click", () => {
        if (range === "now" || range === "today") {
          _returnToLiveToday(container, { fieldRange: range, switchViewMode: false, source: `field-range-${range}` });
          return;
        }
        _stopTemporalPlayback("field-range-change");
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
        _stopTemporalPlayback("moon-select");
        const moon = Math.max(1, Math.min(13, Number(moonSelect.value) || 1));
        const day = Math.max(1, Math.min(28, Number(daySelect?.value) || 1));
        _setCursorFromPatternDay(
          container,
          (moon - 1) * 28 + day,
          {
            source:
              "sphere-moon-select",

            reason:
              "sphere-coordinate-select"
          }
        );
      });
    }
    if (daySelect) {
      daySelect.addEventListener("change", () => {
        _stopTemporalPlayback("day-select");
        const moon = Math.max(1, Math.min(13, Number(moonSelect?.value) || 1));
        const day = Math.max(1, Math.min(28, Number(daySelect.value) || 1));
        _setCursorFromPatternDay(
          container,
          (moon - 1) * 28 + day,
          {
            source:
              "sphere-day-select",

            reason:
              "sphere-coordinate-select"
          }
        );
      });
    }
    _syncDaySelectorsFromModel(buildCurrentModel());

    // Temporal Lens: one canonical Today action plus scrub, step, and playback.
    const returnTodayButton = document.getElementById("sphere-return-today");
    if (returnTodayButton) {
      returnTodayButton.addEventListener("click", () => {
        _returnToLiveToday(container, { fieldRange: "now", switchViewMode: true, source: "temporal-lens" });
      });
    }

    document.querySelectorAll("[data-temporal-step]").forEach(button => {
      button.addEventListener("click", () => {
        _stopTemporalPlayback("temporal-step");
        const delta = Number(button.getAttribute("data-temporal-step")) || 0;
        const current = _clampPatternDay(_state.selectedDayOfYear || _resolveSelectedDayOfYear(buildCurrentModel()));
        const next = globalThis.LivingTimeSphereTemporal?.stepDay?.(current, delta, { wrap: true })
          ?? _clampPatternDay(current + delta);
        _setCursorFromPatternDay(
          container,
          next,
          {
            source:
              "temporal-step",

            reason:
              "temporal-lens-step"
          }
        );
      });
    });

    const scrubber = document.getElementById("sphere-day-scrubber");
    if (scrubber) {
      scrubber.addEventListener("input", () => {
        const pendingDay = _clampPatternDay(scrubber.value);
        _stopTemporalPlayback("temporal-scrub");
        _state.temporalScrubPendingDay = pendingDay;
        const position = globalThis.LivingTimeSphereTemporal?.moonDayForPatternDay?.(pendingDay);
        const output = document.getElementById("sphere-day-scrubber-output");
        if (output) output.textContent = position
          ? `Moon ${position.moon} · Day ${position.day} · ${pendingDay}/364`
          : `Day ${pendingDay} / 364`;
        if (_state.temporalScrubRaf) return;
        const schedule = typeof requestAnimationFrame === "function"
          ? requestAnimationFrame
          : callback => setTimeout(callback, 16);
        _state.temporalScrubRaf = schedule(() => {
          _state.temporalScrubRaf = 0;
          const day = _state.temporalScrubPendingDay;
          _state.temporalScrubPendingDay = null;
          if (day == null) return;
          _setCursorFromPatternDay(
            container,
            day,
            {
              source:
                "temporal-scrubber",

              reason:
                "temporal-lens-scrub"
            }
          );
        });
      });
    }

    const playButton = document.getElementById("sphere-temporal-play");
    if (playButton) playButton.addEventListener("click", () => _toggleTemporalPlayback(container));
    const speedSelect = document.getElementById("sphere-temporal-speed");
    if (speedSelect) {
      speedSelect.value = String(_state.temporalPlaybackSpeed);
      speedSelect.addEventListener("change", () => {
        _state.temporalPlaybackSpeed = Math.max(180, Math.min(3000, Number(speedSelect.value) || 700));
        if (_state.temporalPlaybackActive) _scheduleTemporalPlayback(container);
      });
    }
    const scopeSelect = document.getElementById("sphere-temporal-scope");
    if (scopeSelect) {
      scopeSelect.value = _state.temporalPlaybackScope;
      scopeSelect.addEventListener("change", () => {
        _state.temporalPlaybackScope = ["pattern-year", "pattern-moon", "pattern-week"].includes(scopeSelect.value)
          ? scopeSelect.value
          : "pattern-year";
      });
    }
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) _stopTemporalPlayback("document-hidden");
    });
    window.addEventListener("pagehide", () => _stopTemporalPlayback("page-hide"), { once: true });

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
      copyBtn.addEventListener("click", async () => {
        const camState = globalThis.LivingTimeSphereCamera?.getState?.() || {};
        const shareModel = buildCurrentModel();
        const selected = shareModel?.selectedPatternPosition || null;
        const marker = _state.selectedMarker === "today" && selected?.isToday
          ? "today"
          : (selected?.dayOfPatternYear ? `day-${selected.dayOfPatternYear}` : _state.selectedMarker);
        const link = globalThis.LivingTimeSphereUrlState.buildSphereUrl({
          year:          _state.year,
          viewMode:      _state.viewMode,
          marker,
          layers:        Object.entries(_state.visibleLayers).filter(([, v]) => v).map(([k]) => k),
          timeZone:      _state.timeZone,
          boundaryMode:  _state.boundaryMode,
          manualSunset:  _state.manualSunset,
          datasetVersion: globalThis.LivingTimeSphereVersion?.version,
          source: _state.source || undefined,
          renderer:      _state.requestedRendererMode || "auto",
          quality:       _state.quality,
          connectionMode:_state.connectionMode,
          motionMode:    _state.motionMode,
          moonLabelDistance: _state.moonLabelDistance,
          dayLabelMode:  _state.dayLabelMode,
          cameraTheta:   camState.theta,
          cameraDist:    camState.dist,
        });
        let copied = false;
        try {
          if (globalThis.ScrollOfFire?.copyText) {
            await globalThis.ScrollOfFire.copyText(link);
            copied = true;
          } else if (globalThis.RemnantShare?.copyPermanentLink) {
            copied = await globalThis.RemnantShare.copyPermanentLink(link);
          } else if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(link);
            copied = true;
          }
        } catch {
          copied = false;
        }
        copyBtn.textContent = copied ? "Link copied" : "Copy unavailable";
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
          case "pattern": globalThis.LivingTimeSphereCamera?.setMode?.("pattern", performance.now(), true); break;
          case "passage": globalThis.LivingTimeSphereCamera?.setMode?.("passage", performance.now(), true); break;
          case "years":   globalThis.LivingTimeSphereCamera?.setMode?.("years", performance.now(), true); break;
          default: break;
        }
        globalThis.LivingTimeSphereAnimation?.markDirty?.();
        _recordActionTrace("CAMERA_PRESET_CHANGE", { preset: cmd }, ["camera"]);
      });
    });

    // Sphere year-select events (from marker clicks).
    container.addEventListener("sphere:year-select", e => {
      const y = e.detail?.year;
      if (!y) return;
      _stopTemporalPlayback("sphere-year-event");
      _state.year = y;
      _syncYearSelect(y);
      globalThis.LivingTimeSphereAccessibility.announce(`Year ${y} selected. Switching to Passage view.`);
      _requestViewModeTransition(container, "passage");
    });

    container.addEventListener("sphere:marker-select", e => {
      const marker = e.detail;
      if (!marker) return;
      _stopTemporalPlayback("sphere-marker-event");
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
        _disposeRendererForRetry(container, "manual-retry");
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

    const verifySurfaceBtn = document.getElementById("sphere-verify-render-surface");
    if (verifySurfaceBtn) {
      verifySurfaceBtn.addEventListener("click", () => {
        _runRenderSurfaceVerification();
      });
    }

    const switchSvgBtn = document.getElementById("sphere-switch-svg");
    if (switchSvgBtn) {
      switchSvgBtn.addEventListener("click", () => {
        _disposeRendererForRetry(container, "manual-svg-switch");
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
    const container = document.getElementById("sphere-container");
    if (!container) return;
    if (_uiInitialized) {
      _markInitTimeline("duplicate-ui-init-suppressed", { href: typeof location !== "undefined" ? location.href : "" });
      return;
    }
    _uiInitialized = true;
    _state.initialUrl = typeof location !== "undefined" ? String(location.href || "") : "";
    _state.currentUrl = _state.initialUrl;
    _state.urlIntegrity = "preserved";
    _logBuildIdentityOnce();
    applyUrlState();

    /*
     * B3 temporal startup authority:
     *
     * - Explicit deep links retain their requested temporal target.
     * - Ordinary page entry always starts from canonical Live Today.
     * - Previously explored local state must never silently replace Today.
     */
    let explicitTemporalTarget = false;

    try {
      const startupUrl =
        new URL(
          location.href,
          document.baseURI
        );

      const marker =
        startupUrl.searchParams.get("marker");

      const view =
        startupUrl.searchParams.get("view");

      const internalTemporalUrl = Boolean(globalThis.history?.state?.sofInternalTemporal);
      const explicitMarker = Boolean(marker && marker !== "today");
      /*
       * B7.24 startup authority: URL state written by this page is navigation
       * history, not a user-requested deep link. Reloading that history must
       * return to Live Today instead of resurrecting an old explored day.
       * External/copied links still have no internal history marker and retain
       * their explicit day/view target.
       */
      explicitTemporalTarget = !internalTemporalUrl && (
        explicitMarker
        || Boolean(view && view !== "today")
      );
    } catch {
      explicitTemporalTarget = false;
    }

    if (explicitTemporalTarget) {
      _restoreSelectedStateIfNeeded();
    } else {
      const liveTarget =
        _resolveLiveTodayTarget();

      _state.viewMode = "today";
      _state.requestedViewMode = "today";
      _state.activeViewMode = "today";
      _state.fieldRange = "now";
      _state.selectedMarker = "today";

      if (
        liveTarget &&
        Number.isFinite(
          Number(liveTarget.dayOfPatternYear)
        )
      ) {
        _state.selectedDayOfYear =
          _clampPatternDay(
            liveTarget.dayOfPatternYear
          );

        if (
          Number.isFinite(
            Number(liveTarget.year)
          )
        ) {
          _state.year =
            Number(liveTarget.year);
        }
      } else {
        _state.selectedDayOfYear = null;
      }

      _persistSelectedState();
    }

    _state.moonLabelMode = _resolveMoonLabelMode();
    if (!_urlHasExplicitMoonLabelDistance) {
      _state.moonLabelDistance = _resolveMoonLabelDistance();
    }

    _markInitTimeline("DOMContentLoaded", { href: typeof location !== "undefined" ? location.href : "" });
    _markInitTimeline("sphere-component-mount", {
      width: Number(container.clientWidth || 0),
      height: Number(container.clientHeight || 0),
    });
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
      _invalidateLiveSnapshotCache();
      _recordActionTrace("LOCATION_CHANGE", null, ["location-state", "coalesced-render"]);
      if (_state._locationChangeRaf) cancelAnimationFrame(_state._locationChangeRaf);
      _state._locationChangeRaf = requestAnimationFrame(() => {
        _state._locationChangeRaf = 0;
        renderSphere(container);
      });
    });
    window.addEventListener(globalThis.SofEnvironmentState?.EVENT_NAME || "sof:environment-change", event => {
      _invalidateLiveSnapshotCache();
      const nextState = event?.detail?.state || globalThis.SofEnvironmentState?.getEnvironmentState?.() || null;
      _state.environmentLifecycle = _resolveEnvironmentLifecycle(nextState);
      _incrementActionCounter("environmentDataUpdateCount");
      const renderer = globalThis.LivingTimeSphereRenderer3d;
      if (_state.active3d && renderer?.isInitialized?.()) {
        renderer.updateEnvironment?.(nextState);
        const envModel = buildCurrentModel();
        _updateEnvironmentBridge(envModel);
        _updateLocationSeasonStrip(envModel);
        _updateRendererDiagnostics();
        _recordActionTrace("ENVIRONMENT_DATA_CHANGE", { environmentLifecycle: _state.environmentLifecycle }, ["environment-data", "renderer-environment"]);
      } else if (_state.visibleLayers.environment) {
        renderSphere(container);
        _recordActionTrace("ENVIRONMENT_DATA_CHANGE", { environmentLifecycle: _state.environmentLifecycle }, ["environment-data", "full-render"]);
      } else {
        const envModel = buildCurrentModel();
        _updateEnvironmentBridge(envModel);
        _updateLocationSeasonStrip(envModel);
        _updateRendererDiagnostics();
        _recordActionTrace("ENVIRONMENT_DATA_CHANGE", { environmentLifecycle: _state.environmentLifecycle }, ["environment-data", "ui-bridge-only"]);
      }
    });
    window.addEventListener("popstate", () => {
      _state._applyingHistoryState = true;
      try {
        _state.currentUrl = typeof location !== "undefined" ? String(location.href || "") : _state.currentUrl;
        _state.urlIntegrity = _evaluateDeepLinkIntegrity(_state.initialUrl, _state.currentUrl);
        const parsed = globalThis.LivingTimeSphereUrlState?.parseSphereUrl?.(location.href) || {};
        const markerDay = _applyParsedUrlState(parsed, { initial: false });
        const historyViewMode = parsed.viewMode || URL_STATE_DEFAULTS.viewMode;
        _syncYearSelect(_state.year);
        _syncLayerCheckboxes();
        const urlControlValues = {
          "sphere-renderer-select": _state.requestedRendererMode,
          "sphere-quality-select": _state.quality,
          "sphere-connection-mode": _state.connectionMode,
          "sphere-motion-mode": _state.motionMode,
          "sphere-moon-label-distance": _state.moonLabelDistance,
          "sphere-day-label-mode": _state.dayLabelMode,
        };
        Object.entries(urlControlValues).forEach(([id, value]) => {
          const control = document.getElementById(id);
          if (control && value != null) control.value = value;
        });
        if (parsed.marker === "today" || (!parsed.marker && historyViewMode === "today")) {
          _returnToLiveToday(container, { fieldRange: "now", switchViewMode: false, source: "browser-history" });
          if (historyViewMode !== _state.viewMode) {
            _requestViewModeTransition(container, historyViewMode);
          }
        } else if (markerDay != null) {
          _requestSelectedDayUpdate(container, markerDay);
          if (historyViewMode !== _state.viewMode) {
            _requestViewModeTransition(container, historyViewMode);
          }
        } else if (historyViewMode !== _state.viewMode) {
          _requestViewModeTransition(container, historyViewMode);
        } else {
          renderSphere(container);
        }
      } finally {
        _state._applyingHistoryState = false;
      }
    });

    // B7.52 — start immediately when layout already produced a real instrument
    // size. Only spend a RAF when CSS/layout genuinely has not measured it yet.
    const startInitialRender = () => {
      _markInitTimeline("first-render-request", {
        width: Number(container.clientWidth || 0),
        height: Number(container.clientHeight || 0),
      });
      renderSphere(container);
      _emitCalendarWorkbenchEvent("livingtime:ready");
    };
    const initialRect = container.getBoundingClientRect?.() || {};
    if (Number(initialRect.width) >= 180 && Number(initialRect.height) >= 180) {
      startInitialRender();
    } else {
      requestAnimationFrame(startInitialRender);
    }

    // Re-render on resize (debounced).
    let resizeTimer;
    let observedWidth = Math.round(Number(container.getBoundingClientRect?.().width || container.clientWidth || 0));
    let observedHeight = Math.round(Number(container.getBoundingClientRect?.().height || container.clientHeight || 0));
    if (typeof ResizeObserver !== "undefined") {
      _state._resizeObserver?.disconnect?.();
      _state._resizeObserver = new ResizeObserver(() => {
        const rect = container.getBoundingClientRect?.() || { width: container.clientWidth, height: container.clientHeight };
        const width = Math.round(Number(rect.width || 0));
        const height = Math.round(Number(rect.height || 0));
        if (width === observedWidth && height === observedHeight) return;
        observedWidth = width;
        observedHeight = height;
        _state._latestContainerSize = { w: width, h: height };
        // Skip resize re-renders while 3D is still initializing — a
        // mid-init resize would start a second concurrent init call.
        if (_state._3dInitInProgress) return;
        if (_state.active3d && globalThis.LivingTimeSphereRenderer3d?.isInitialized?.()) {
          globalThis.LivingTimeSphereRenderer3d.requestSingleRender?.();
          return;
        }
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
      selectedMarker: _state.selectedMarker || null,
      selectedYear: Number(_state.year || 0) || null,
      fieldRange: _state.fieldRange,
      todayResetCount: Number(_state.actionCounters?.todayResetCount || 0),
      lastTodayResetSource: _state.lastTodayResetSource || null,
      lastTodayResetAt: Number(_state.lastTodayResetAt || 0),
      temporalPlaybackActive: !!_state.temporalPlaybackActive,
      temporalPlaybackScope: _state.temporalPlaybackScope,
      temporalPlaybackSpeed: Number(_state.temporalPlaybackSpeed || 0),
      temporalPlaybackStepCount: Number(_state.temporalPlaybackStepCount || 0),
      temporalEngineVersion: globalThis.LivingTimeSphereTemporal?.version || null,
      liveSnapshotCacheAgeMs: _state._liveSnapshotCacheAt ? Math.max(0, Date.now() - Number(_state._liveSnapshotCacheAt)) : null,
      renderSurfaceVerification: _state.lastRenderSurfaceVerification || _verifyRenderSurface(container, { requireVisibleCenter: false }),
      firstRenderSurfaceFailure: _state.firstRenderSurfaceFailure || null,
      renderSurfaceCanvasTrace: (_state.renderSurfaceCanvasTrace || []).slice(-40),
      initTimeline: (_state.initTimeline || []).slice(-80),
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


  // B7.33 — Living Schedule navigator. This is intentionally fixed page chrome,
  // not another floating sphere label. It lets a dense imported work calendar
  // remain navigable without exposing hundreds of plan cards at once.
  let _scheduleNavigatorWired = false;
  let _scheduleNavigatorLoading = false;
  let _scheduleNavigatorLoadedAt = 0;
  let _scheduleNavigatorRecords = [];
  let _scheduleNavigatorPrev = null;
  let _scheduleNavigatorNext = null;

  function _scheduleCoordinate(record) {
    const year = Number(record?.temporal?.patternYear);
    const day = Number(record?.temporal?.patternDay);
    if (!Number.isFinite(year) || !Number.isFinite(day)) return null;
    return {
      year: Math.trunc(year),
      day: _clampPatternDay(day),
      key: Math.trunc(year) * 1000 + _clampPatternDay(day),
      record
    };
  }

  function _scheduleDateLabel(record) {
    const schedule = globalThis.CodexLifeAtlasScheduling?.getSchedule?.(record) || record?.payload?.schedule || null;
    const civil = schedule?.startDate || schedule?.start?.slice?.(0, 10) || record?.temporal?.civilDate || "";
    const moon = Number(record?.temporal?.moon);
    const moonDay = Number(record?.temporal?.moonDay);
    const pattern = Number(record?.temporal?.patternDay);
    const patternLabel = Number.isFinite(moon) && Number.isFinite(moonDay)
      ? `Moon ${moon} Day ${moonDay}`
      : (Number.isFinite(pattern) ? `Pattern Day ${pattern}` : "Scheduled day");
    return civil ? `${patternLabel} · ${civil}` : patternLabel;
  }

  function _wireScheduleNavigator() {
    if (_scheduleNavigatorWired || typeof document === "undefined") return;
    _scheduleNavigatorWired = true;

    const navigate = record => {
      const coordinate = _scheduleCoordinate(record);
      if (!coordinate) return;
      globalThis.LivingTimeSphereUi?.selectDay?.(coordinate.day, {
        year: coordinate.year,
        focus: true,
        focusDistance: 1.58,
        source: "schedule-navigator",
        action: "SCHEDULE_NAVIGATION"
      });
      globalThis.LivingTimeSphereAccessibility?.announce?.(
        `Scheduled day selected: ${record?.title || "Living plan"}. ${_scheduleDateLabel(record)}.`
      );
    };

    document.getElementById("sphere-schedule-prev")?.addEventListener("click", () => navigate(_scheduleNavigatorPrev));
    document.getElementById("sphere-schedule-next")?.addEventListener("click", () => navigate(_scheduleNavigatorNext));
    const openAgenda = () => globalThis.LivingCommandWindow?.open?.("upcoming");
    document.getElementById("sphere-schedule-summary")?.addEventListener("click", openAgenda);
    document.getElementById("sphere-schedule-agenda")?.addEventListener("click", openAgenda);

    document.addEventListener("sof:life-atlas-records-changed", () => {
      _scheduleNavigatorLoadedAt = 0;
      _scheduleNavigatorRecords = [];
      void _refreshScheduleNavigator(buildCurrentModel(), { force: true });
    });
  }

  async function _refreshScheduleNavigator(model = null, { force = false } = {}) {
    if (typeof document === "undefined") return;
    _wireScheduleNavigator();
    const prevButton = document.getElementById("sphere-schedule-prev");
    const nextButton = document.getElementById("sphere-schedule-next");
    const titleEl = document.getElementById("sphere-schedule-summary-title");
    const metaEl = document.getElementById("sphere-schedule-summary-meta");
    const countEl = document.getElementById("sphere-schedule-count");
    if (!prevButton || !nextButton || !titleEl || !metaEl || !countEl) return;

    const now = Date.now();
    const planner = globalThis.CodexLivingPlanner;
    const currentModel = model || buildCurrentModel();
    const selected = currentModel?.selectedPatternPosition || null;
    const year = Number(_state.year || selected?.patternYear || currentModel?.year || new Date().getFullYear());
    if ((!_scheduleNavigatorRecords.length || force || now - _scheduleNavigatorLoadedAt > 4000) && (planner?.plansForYears || planner?.allPlans) && !_scheduleNavigatorLoading) {
      _scheduleNavigatorLoading = true;
      try {
        const records = planner?.plansForYears
          ? await planner.plansForYears([year - 1, year, year + 1])
          : await planner.allPlans();
        const scheduling = globalThis.CodexLifeAtlasScheduling;
        _scheduleNavigatorRecords = (records || [])
          .filter(record => !scheduling?.isCompleted?.(record))
          .map(record => _scheduleCoordinate(record))
          .filter(Boolean)
          .sort((a, b) => a.key - b.key || String(a.record?.title || "").localeCompare(String(b.record?.title || "")));
        _scheduleNavigatorLoadedAt = Date.now();
      } catch (_) {
        _scheduleNavigatorRecords = [];
      } finally {
        _scheduleNavigatorLoading = false;
      }
    }

    const day = _clampPatternDay(selected?.dayOfPatternYear || _state.selectedDayOfYear || 1);
    const currentKey = Math.trunc(year) * 1000 + day;
    const records = _scheduleNavigatorRecords;
    const sameDay = records.filter(item => item.key === currentKey);
    _scheduleNavigatorPrev = (previousRecords => previousRecords.length ? previousRecords[previousRecords.length - 1].record : null)(records.filter(item => item.key < currentKey));
    _scheduleNavigatorNext = records.find(item => item.key > currentKey)?.record || null;

    prevButton.disabled = !_scheduleNavigatorPrev;
    nextButton.disabled = !_scheduleNavigatorNext;

    if (!records.length) {
      titleEl.textContent = "No scheduled work yet";
      metaEl.textContent = "Create or import calendar entries to populate the Living Schedule.";
      countEl.textContent = "0 active plans";
      return;
    }

    const primary = sameDay[0]?.record || _scheduleNavigatorNext || _scheduleNavigatorPrev || records[0].record;
    if (sameDay.length) {
      titleEl.textContent = sameDay.length === 1
        ? (primary?.title || "Scheduled plan")
        : `${sameDay.length} plans on this day`;
      metaEl.textContent = `${_scheduleDateLabel(primary)}${sameDay.length > 1 ? ` · first: ${primary?.title || "plan"}` : ""}`;
    } else if (_scheduleNavigatorNext) {
      titleEl.textContent = `Next: ${_scheduleNavigatorNext.title || "Scheduled plan"}`;
      metaEl.textContent = _scheduleDateLabel(_scheduleNavigatorNext);
    } else {
      titleEl.textContent = `Previous: ${primary?.title || "Scheduled plan"}`;
      metaEl.textContent = _scheduleDateLabel(primary);
    }
    countEl.textContent = `${records.length} active plan${records.length === 1 ? "" : "s"}${sameDay.length ? ` · ${sameDay.length} here` : ""}`;
  }

  globalThis.LivingTimeSphereUi = Object.freeze({
    init,
    getState: () => Object.assign({}, _state),
    getCurrentModel: () => buildCurrentModel(),
    renderSphere: (container) => renderSphere(container || document.getElementById("sphere-container")),
    returnToToday: options => _returnToLiveToday(document.getElementById("sphere-container"), options),
    selectDay: (day, options = {}) => {
      const container = document.getElementById("sphere-container");
      if (!container) return false;
      _stopTemporalPlayback("public-day-selection");
      const targetDay = _clampPatternDay(day);
      _requestSelectedDayUpdate(container, targetDay, {
        source: options.source || "public-api",
        action: options.action || "PUBLIC_DAY_SELECTION",
        marker: options.marker,
        year: options.year,
        fieldRange: options.fieldRange,
      });
      if (options.focus === true) {
        const distance = Number(options.focusDistance) || 1.78;
        const run = () => globalThis.LivingTimeSphereRenderer3d?.focusPatternDay?.(targetDay, { distance, animated: true });
        window.setTimeout(run, 45);
        window.setTimeout(run, 190);
      }
      return true;
    },
    applyLayerPreset: presetName => _applyLayerPreset(document.getElementById("sphere-container"), presetName),
    pauseTemporalPlayback: () => _stopTemporalPlayback("public-api", { announce: true }),
    getSphereDiagnostics,
    _internals: Object.freeze({
      resolveLiveTodayTarget: _resolveLiveTodayTarget,
      selectedDayFromMarker: _selectedDayFromMarker,
      buildTodaySelectionPatch: _buildTodaySelectionPatch,
      decorateModel: _decorateModel,
    }),
  });
  globalThis.getSphereDiagnostics = getSphereDiagnostics;
})();
