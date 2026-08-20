(() => {
  "use strict";

  // Living Time Sphere — 3D WebGL renderer (Three.js).
  // Dependency: Three.js r167  (vendored local ES module — no CDN dependency)
  // License:    MIT  https://github.com/mrdoob/three.js/blob/dev/LICENSE
  // Attribution: three.js by mrdoob and contributors — https://threejs.org
  //
  // ARCHITECTURE
  //   - Reads coordinates exclusively from LivingTimeSphereModel (no recalculation).
  //   - Uses LivingTimeSphereCamera for orbit / zoom / mode-specific views.
  //   - Uses LivingTimeSphereAnimation for the dirty-render loop.
  //   - Uses LivingTimeSphereEffects for star field, haze, glow, etc.
  //   - Uses LivingTimeSphereM for color/size constants.
  //   - Falls back to SVG if WebGL is unavailable or if quality = svgonly.
  //
  // FRAME LOOP DISCIPLINE
  //   Renders only when:
  //     - the user is dragging / zooming;
  //     - a transition is active;
  //     - a state-driven animation is active;
  //     - the scene data changes;
  //     - resize occurs.
  //   Idle drift is capped and stopped when:
  //     - document.hidden;
  //     - prefers-reduced-motion;
  //     - low-power mode;
  //     - the canvas leaves the viewport.
  //
  // THREE.JS DEPENDENCY
  //   Version pinned: 0.167.1 (r167)
  //   Local:  assets/vendor/three/three.module.min.js  (ES module, same-origin)
  //   Integrity: sha384-fPAi39ufYYhieBm2Yj7mAE8pE2HIIJm4iFT2zQEY4g4/OMR9m8GMM5+jen6ptHcu
  //   Loaded via dynamic import() — no <script> tag, no CDN, works offline.
  //   The local path resolves relative to document.baseURI so it works on both:
  //     https://codexofreality.org/            (base href = /)
  //     https://ssnfts24.github.io/scroll-of-fire/  (base href = /scroll-of-fire/)

  const THREE_VERSION    = "0.167.1";
  const THREE_LOCAL_REL  = "assets/vendor/three/three.module.min.js";
  // THREE_CDN is intentionally not used in production; retained only for comments.
  // const THREE_CDN = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.min.js`;

  // Resolve the local module URL against the document base so GitHub Pages
  // (/scroll-of-fire/) and Netlify root (/) both work.
  function _localThreeUrl() {
    try {
      return new URL(THREE_LOCAL_REL, document.baseURI).href;
    } catch {
      return THREE_LOCAL_REL;
    }
  }

  // ── Dependencies check ────────────────────────────────────────────

  function assertDeps() {
    const needed = ["LivingTimeSphereM", "LivingTimeSphereCamera",
                    "LivingTimeSphereAnimation", "LivingTimeSphereEffects",
                    "LivingTimeSphereModel", "LivingTimeSphereLayout"];
    for (const n of needed) {
      if (!globalThis[n]) throw new Error(`LivingTimeSphereRenderer3d: ${n} unavailable`);
    }
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function _disposeObjectTree(root, shared = null) {
    if (!root) return;
    const seen = shared || { geometries: new Set(), materials: new Set(), textures: new Set() };
    const disposeMaterial = material => {
      if (!material || seen.materials.has(material)) return;
      seen.materials.add(material);
      Object.values(material).forEach(value => {
        if (!value?.isTexture || seen.textures.has(value)) return;
        seen.textures.add(value);
        try { value.dispose?.(); } catch { /* best-effort GPU cleanup */ }
      });
      try { material.dispose?.(); } catch { /* best-effort GPU cleanup */ }
    };
    const disposeNode = node => {
      if (node?.geometry && !seen.geometries.has(node.geometry)) {
        seen.geometries.add(node.geometry);
        try { node.geometry.dispose?.(); } catch { /* best-effort GPU cleanup */ }
      }
      if (Array.isArray(node?.material)) node.material.forEach(disposeMaterial);
      else disposeMaterial(node?.material);
    };
    if (typeof root.traverse === "function") root.traverse(disposeNode);
    else disposeNode(root);
  }

  function _disposeGroupChildren(group) {
    if (!group?.children) return;
    const seen = { geometries: new Set(), materials: new Set(), textures: new Set() };
    Array.from(group.children).forEach(child => {
      _disposeObjectTree(child, seen);
      try { group.remove(child); } catch { /* best-effort scene cleanup */ }
    });
  }

  // ── Scene state ───────────────────────────────────────────────────

  let _THREE        = null;   // Three.js namespace (set after lazy import)
  let _threeSource  = null;   // "local" after successful local import
  let _renderer     = null;   // WebGLRenderer
  let _scene        = null;
  let _camera       = null;
  let _canvas       = null;
  let _container    = null;
  let _initialized  = false;
  let _initializing = false;  // Guard against concurrent init calls
  let _pendingRefresh = null; // Latest UI state received while async 3D init is still settling.
  let _renderGeneration = 0;  // Identifies the single authoritative canvas
  let _initEpoch = 0;         // Invalidates late async work after timeout/teardown
  let _activeWebGlContext = null;
  let _pointerEventDisposers = [];
  let _lastResizeWidth = 0;
  let _lastResizeHeight = 0;
  let _quality      = null;   // current resolved preset object
  let _model        = null;   // current year model
  let _spiral       = null;   // 13-year spiral model
  let _selectedYear = null;
  let _viewMode     = "today";
  let _visibleLayers = {};
  let _lastInitError = null;  // last failure reason for diagnostics
  let _contextLossDispose = null; // cleanup fn for WebGL context-loss guard
  let _initStartedAt = null;
  let _initEndedAt = null;
  let _requestedDpr = null;
  let _appliedDpr = null;
  let _activeTier = null;
  let _restoreAttempts = 0;
  let _lastRenderTimestamp = 0;
  let _firstFrameTimestamp = 0;
  let _firstFramePixelProbe = null;
  let _lastSceneBuildTimestamp = 0;
  let _geometryBuildRevision = 0;
  let _lastSceneReadiness = null;
  let _contextLostAt = 0;
  let _contextRestoredAt = 0;
  let _contextLossCount = 0;
  let _contextRestoreCount = 0;
  const _initTimeline = [];
  const _stageState = {
    capability: "idle",
    module: "idle",
    dimensions: "idle",
    renderer: "idle",
    context: "idle",
    camera: "idle",
    scene: "idle",
    geometry: "idle",
    listeners: "idle",
    semanticZoom: "idle",
    firstFrame: "idle",
  };
  const _lifecycleCounters = {
    rendererInitCount: 0,
    sceneRootBuildCount: 0,
    modelBuildCount: 0,
    selectedStateUpdateCount: 0,
    layerVisibilityUpdateCount: 0,
    cameraCreateCount: 0,
    canvasCreateCount: 0,
    orphanCanvasPruneCount: 0,
    rafLoopStartCount: 0,
    resizeObserverCreateCount: 0,
  };
  const _geometryBuildCountByLayer = {};
  const _layerBuildMetrics = {};
  const _layerToggleMetrics = {};
  const _hostContractIssues = [];
  let _lastLayerUpdateType = "data-update";
  let _lastLayerUpdateMs = 0;
  let _hostContractCheckedAt = 0;
  let _sceneRepairQueued = false;
  let _sceneRepairRaf = 0;

  function _countLifecycle(key, amount = 1) {
    if (!Object.prototype.hasOwnProperty.call(_lifecycleCounters, key)) return;
    _lifecycleCounters[key] += amount;
  }

  function _pushInitTimeline(stage, payload = null) {
    _initTimeline.push({
      at: Date.now(),
      stage: String(stage || "unknown"),
      payload: payload && typeof payload === "object" ? { ...payload } : payload,
      canvasConnected: !!_canvas?.isConnected,
    });
    if (_initTimeline.length > 120) _initTimeline.shift();
  }

  function _recordCanvasConnection(stage) {
    _pushInitTimeline(`canvas-${stage}`, {
      connected: !!_canvas?.isConnected,
      parentTag: _canvas?.parentElement ? String(_canvas.parentElement.tagName || "").toUpperCase() : null,
      parentId: _canvas?.parentElement?.id || null,
      ownerDocumentIsCurrent: _canvas ? _canvas.ownerDocument === document : false,
    });
  }

  function _markLayerBuild(layer, durationMs) {
    if (!layer) return;
    _geometryBuildCountByLayer[layer] = Number(_geometryBuildCountByLayer[layer] || 0) + 1;
    _layerBuildMetrics[layer] = Number(durationMs || 0);
  }


  // B7.45 — unified camera calendar disclosure authority.
  //
  // Both canonical day numerals and scheduled-plan symbols consume this
  // exact same camera-facing Moon window.
  //
  // B7.51 — mobile calendar disclosure is adaptive instead of permanently
  // materializing five Moons. While the finger is moving we expose only the
  // camera-front Moon; after settle, phones expose the front Moon plus one
  // neighbor on either side. Desktop retains the wider five-Moon context.
  // Dates and schedule symbols still consume this exact same authority.
  const CAMERA_CALENDAR_HALF_WINDOW_DESKTOP = 2;
  function _calendarDisclosureHalfWindow() {
    if (!_isMobileWidth()) return CAMERA_CALENDAR_HALF_WINDOW_DESKTOP;
    return _cameraGestureActive ? 0 : 1;
  }
  let _calendarDisclosureDirty = true;
  let _calendarDisclosureCache = Object.freeze({ centerMoon: null, moons: [], halfWindow: CAMERA_CALENDAR_HALF_WINDOW_DESKTOP, key: "" });

  function _wrapCalendarMoon(value) {
    return (
      (
        (
          Number(value || 1)
          - 1
        )
        % 13
        + 13
      )
      % 13
    ) + 1;
  }

  function _cameraCalendarDisclosure() {
    if (!_calendarDisclosureDirty && _calendarDisclosureCache) return _calendarDisclosureCache;
    const THREE = _THREE;
    const camera = _camera;

    if (
      !THREE
      || !camera
    ) {
      _calendarDisclosureCache = Object.freeze({
        centerMoon: null, moons: [], halfWindow: _calendarDisclosureHalfWindow(), key: ""
      });
      _calendarDisclosureDirty = false;
      return _calendarDisclosureCache;
    }

    camera.updateMatrixWorld?.(
      true
    );

    const calendar =
      globalThis
        .LivingTimeSphereCalendarGeometry;

    const patternRingRadius =
      Number(
        globalThis
          .LivingTimeSphereM
          ?.SIZES
          ?.patternRing
        || 1
      );

    const center =
      new THREE.Vector3(
        0,
        0,
        0
      ).applyMatrix4(
        camera.matrixWorldInverse
      );

    const point =
      new THREE.Vector3();

    let bestMoon = null;
    let bestDepth = -Infinity;

    /*
     * Same physical rule the working schedule-symbol framework used:
     * project each Moon midpoint into camera space and choose the
     * strongest camera-facing Moon.
     */
    for (
      let moon = 1;
      moon <= 13;
      moon += 1
    ) {
      const midDay =
        ((moon - 1) * 28)
        + 14.5;

      const cell =
        calendar?.calendarCell?.(
          Math.max(
            1,
            Math.min(
              364,
              Math.round(midDay)
            )
          )
        );

      if (!cell) continue;

      const angle =
        Number(cell.angle)
        * Math.PI
        / 180;

      const radius =
        patternRingRadius
        * Number(
          cell.radialFactor
          || 1
        );

      point
        .set(
          Math.sin(angle) * radius,
          0.02,
          -Math.cos(angle) * radius
        )
        .applyMatrix4(
          camera.matrixWorldInverse
        );

      const depth =
        point.z
        - center.z;

      if (depth > bestDepth) {
        bestDepth = depth;
        bestMoon = moon;
      }
    }

    if (!bestMoon) {
      _calendarDisclosureCache = Object.freeze({
        centerMoon: null, moons: [], halfWindow: _calendarDisclosureHalfWindow(), key: ""
      });
      _calendarDisclosureDirty = false;
      return _calendarDisclosureCache;
    }

    const moons = [];
    const halfWindow = _calendarDisclosureHalfWindow();

    for (
      let offset = -halfWindow;
      offset <= halfWindow;
      offset += 1
    ) {
      moons.push(
        _wrapCalendarMoon(
          bestMoon + offset
        )
      );
    }

    _calendarDisclosureCache = Object.freeze({
      centerMoon: bestMoon,
      moons: Object.freeze(moons.slice()),
      halfWindow,
      key: `${bestMoon}:${halfWindow}:${moons.join(",")}`
    });
    _syncMoonNumberDisclosure(_calendarDisclosureCache);
    _calendarDisclosureDirty = false;
    return _calendarDisclosureCache;
  }

  function _extensionContext(extra = {}) {
    return {
      THREE: _THREE,
      renderer: _renderer,
      scene: _scene,
      camera: _camera,
      canvas: _canvas,
      container: _container,

      model: _model,
      spiral: _spiral,
      selectedYear: _selectedYear,
      viewMode: _viewMode,

      visibleLayers: {
        ...(_visibleLayers || {})
      },

      semanticZoomState:
        _semanticZoomState || null,

      calendarDisclosure:
        extra?.calendarDisclosure || _cameraCalendarDisclosure(),

      // B7.39: extensions use the same explicit day disclosure preference as
      // the calendar labels. In Auto mode schedule symbols follow camera focus;
      // Reveal All intentionally exposes the complete schedule surface.
      dayLabelMode:
        _dayLabelMode || "key",

      motionMode:
        _motionMode || "still",

      interactionActive:
        !!_cameraGestureActive,

      quality:
        _quality || null,

      generation:
        _renderGeneration,

      cameraState:
        globalThis.LivingTimeSphereCamera?.getState?.() || null,

      requestRender() {
        globalThis.LivingTimeSphereAnimation?.markDirty?.();
      },

      ...extra
    };
  }

  function _markLayerToggle(layer, durationMs) {
    if (!layer) return;
    _layerToggleMetrics[layer] = Number(durationMs || 0);
  }

  function _isUnexpectedHostMedia(node) {
    if (!node || node.nodeType !== 1) return false;
    const tag = String(node.tagName || "").toUpperCase();
    if (tag === "CANVAS") return false;
    if (tag === "SVG") return false;
    if (tag === "DIV" && node.classList?.contains("sphere-luxury-loader")) return false;
    return tag === "IMG" || tag === "PICTURE" || tag === "SOURCE" || tag === "OBJECT" || tag === "IFRAME" || tag === "EMBED" || tag === "VIDEO";
  }

  function _collapseFailedHostResource(node, reason = "foreign-media-node") {
    if (!node || node.nodeType !== 1) return false;
    const entry = {
      tagName: String(node.tagName || "").toUpperCase(),
      id: node.id || null,
      className: node.className || "",
      reason,
      src: node.currentSrc || node.src || node.data || null,
      parentTag: node.parentElement ? String(node.parentElement.tagName || "").toUpperCase() : null,
      parentId: node.parentElement?.id || null,
      timestamp: Date.now(),
    };
    _hostContractIssues.push(entry);
    if (_hostContractIssues.length > 80) _hostContractIssues.shift();
    try {
      node.hidden = true;
      node.setAttribute?.("aria-hidden", "true");
      node.style.display = "none";
      node.style.width = "0";
      node.style.height = "0";
      node.style.minHeight = "0";
      node.style.minWidth = "0";
      node.style.overflow = "hidden";
      node.remove?.();
    } catch { /* best-effort collapse */ }
    return true;
  }

  function _pruneRendererOwnedCanvases(container = _container, keep = _canvas, reason = "duplicate-render-surface") {
    if (!container?.querySelectorAll) return 0;
    let removed = 0;
    const canvases = Array.from(container.querySelectorAll(":scope > canvas.living-time-sphere-3d-canvas"));
    canvases.forEach(node => {
      if (!node || node === keep) return;
      _hostContractIssues.push({
        tagName: "CANVAS",
        id: node.id || null,
        className: node.className || "",
        reason,
        generation: node.dataset?.sphereRenderGeneration || null,
        parentTag: node.parentElement ? String(node.parentElement.tagName || "").toUpperCase() : null,
        parentId: node.parentElement?.id || null,
        timestamp: Date.now(),
      });
      if (node.dataset?.sphereContextActive === "true") {
        try { node.getContext?.("webgl2")?.getExtension?.("WEBGL_lose_context")?.loseContext?.(); } catch { /* best-effort orphan GPU cleanup */ }
        try { node.dataset.sphereContextActive = "false"; } catch { /* ignore */ }
      }
      try { node.remove(); } catch { /* best-effort lifecycle cleanup */ }
      removed += 1;
    });
    if (removed > 0) {
      _countLifecycle("orphanCanvasPruneCount", removed);
      if (_hostContractIssues.length > 80) _hostContractIssues.splice(0, _hostContractIssues.length - 80);
    }
    return removed;
  }

  function _enforceRendererHostContract(container = _container) {
    if (!container?.querySelectorAll) return;
    _hostContractCheckedAt = Date.now();
    _pruneRendererOwnedCanvases(container, _canvas, "renderer-host-contract");
    const direct = Array.from(container.children || []);
    const nested = Array.from(container.querySelectorAll("img,picture,source,object,iframe,embed,video"));
    const seen = new Set();
    [...direct, ...nested].forEach(child => {
      if (!child || seen.has(child)) return;
      seen.add(child);
      if (_isUnexpectedHostMedia(child)) _collapseFailedHostResource(child, "unexpected-host-media");
    });
  }

  function _countUnexpectedHostChildren(container = _container) {
    if (!container?.querySelectorAll) return 0;
    let count = 0;
    const direct = Array.from(container.children || []);
    const nested = Array.from(container.querySelectorAll("img,picture,source,object,iframe,embed,video"));
    const seen = new Set();
    [...direct, ...nested].forEach(child => {
      if (!child || seen.has(child)) return;
      seen.add(child);
      if (_isUnexpectedHostMedia(child)) count += 1;
    });
    return count;
  }

  function _probeFirstFramePixelHealth() {
    if (!_renderer || !_canvas) return null;
    const result = {
      checkedAt: Date.now(),
      ok: false,
      centerPixel: null,
      reason: null,
    };
    try {
      const gl = _renderer.getContext?.();
      if (!gl || typeof gl.readPixels !== "function") {
        result.reason = "gl-context-unavailable";
        _firstFramePixelProbe = result;
        return result;
      }
      const width = Number(_canvas.width || 0);
      const height = Number(_canvas.height || 0);
      if (width <= 0 || height <= 0) {
        result.reason = "canvas-size-invalid";
        _firstFramePixelProbe = result;
        return result;
      }
      const px = new Uint8Array(4);
      const x = Math.max(0, Math.min(width - 1, Math.floor(width / 2)));
      const y = Math.max(0, Math.min(height - 1, Math.floor(height / 2)));
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      result.centerPixel = [Number(px[0]), Number(px[1]), Number(px[2]), Number(px[3])];
      const nearWhite = px[0] >= 248 && px[1] >= 248 && px[2] >= 248 && px[3] >= 248;
      result.ok = !nearWhite;
      result.reason = nearWhite ? "center-pixel-near-white" : null;
    } catch (err) {
      result.reason = `pixel-probe-failed:${String(err)}`;
    }
    _firstFramePixelProbe = result;
    return result;
  }

  function _markStage(stage, state) {
    if (!stage || !_stageState[stage]) return;
    _stageState[stage] = state;
  }

  function _resetStages() {
    for (const key of Object.keys(_stageState)) _stageState[key] = "idle";
  }

  // Scene object refs
  const _objects = {};
  let _floatingLabelEl = null;
  let _floatingTimeout = null;
  // Moon label overlay elements (sphere-anchored HTML projected from 3D)
  let _moonLabelEls = null;   // Array of 13 DOM span elements
  let _moonLabelContainer = null;  // The #sphere-moon-labels container
  let _moonLabelConnectorEl = null;
  let _moonLabelManager = null;
  let _moonLabelMode = "contextual";
  let _moonLabelDistance = "standard";
  let _dayLabelMode = "key";
  let _connectionRegistry = [];
  let _semanticZoomState = null;
  let _activeSemanticBand = null;
  let _previousSemanticBand = null;
  let _lastSemanticTransitionThreshold = null;
  let _motionMode = "still";
  let _dayNodeMetadata = [];
  let _dayNodeBasePositions = null;
  let _dayNodeVisibleKey = "";
  let _dayNodeVisibleCount = 0;
  let _connectionDiagnostics = [];
  let _connectionVisibleCount = 0;
  let _lastSemanticDistance = null;
  let _lastSemanticSourceType = "unknown";
  let _resizeObserver = null;

  // B7.23 — label projection governor. The WebGL instrument may animate at a
  // higher cadence for subtle breathing/flow effects, but DOM label projection
  // should update only when the camera/selection actually changes (plus a slow
  // safety refresh for extension data). This removes hundreds of unnecessary
  // getBoundingClientRect/projection/DOM passes during an otherwise static view.
  let _lastLabelProjectionKey = "";
  let _lastLabelProjectionAt = 0;
  let _cameraGestureActive = false;
  let _gestureRestoreDpr = null;
  let _labelSettleTimer = null;

  // B7.52 — mobile fast-path constants. These caps are intentionally applied
  // at renderer authority level so a later quality preset cannot silently
  // inflate the phone back to desktop-like fill-rate.
  const MOBILE_SETTLED_DPR_CAP = 1.10;
  const MOBILE_GESTURE_DPR_CAP = 0.70;
  const MOBILE_GESTURE_DPR_LOWPOWER = 0.60;
  const MOBILE_INTERACTION_FPS = 30;
  const MOBILE_INTERACTION_FPS_LOWPOWER = 24;

  // B7.52 — progressive visual hydration. Core Pattern/Lunar/Solar/Passage
  // geometry owns first paint. Historical spiral/connections join on an idle
  // slice after the instrument is already usable.
  let _progressiveVisualsReady = false;
  let _progressiveVisualsScheduled = false;
  let _progressiveVisualsHandle = null;

  // Geometry signatures for objects that previously rebuilt on every state
  // update even when their coordinates had not changed.
  let _lastSolarProgressGeometryKey = "";
  let _lastTodayLineGeometryKey = "";
  let _lastActiveMoonGeometryKey = "";

  // B7.50 — first paint is now independent from Life Atlas / temporal extension
  // hydration. The core calendar can become interactive immediately while the
  // richer extensions join on the first idle slice.
  let _extensionsHydrated = false;
  let _extensionsHydrationScheduled = false;
  let _extensionsHydrationHandle = null;
  const _moonAnchors = [];    // { moon, angle, radius, worldVec } for each of 13 moons
  let _lastCameraFocusKey = null;
  let _lastSpiralGeometryKey = "";
  let _lastPassageGeometryKey = "";
  let _spiralMarkerAnchors = [];
  const _environmentLayerEnabled = {
    atmosphere: true,
    clouds: true,
    wind: true,
    precipitation: true,
    temperature: true,
    pressure: true,
    radiation: true,
    airQuality: true,
    spaceWeather: true,
  };
  let _environmentLayerVisible = true;
  let _environmentDiagnostics = [];
  const EMPTY_ENVIRONMENT_STATE = Object.freeze({
    status: "unavailable",
    reason: "location-not-set",
    place: null,
    current: null,
    hourly: [],
    daily: [],
    airQuality: null,
    spaceWeather: null,
    fetchedAt: null,
    stale: false,
  });
  let _environmentState = EMPTY_ENVIRONMENT_STATE;
  let _selectedSeasonAngle = 0;
  let _scheduleDensityKey = "";
  let _scheduleDensityBuiltAt = 0;
  let _daylightCurveKey = "";
  let _planetaryKey = "";

  // ── Three.js lazy loader ──────────────────────────────────────────

  let _loadPromise = null;

  function loadThreeJs() {
    if (_THREE) return Promise.resolve(_THREE);
    if (_loadPromise) return _loadPromise;
    const localUrl = _localThreeUrl();
    const pending = import(localUrl).then(module => {
      // ES module namespace — contains all named Three.js exports.
      // Verify it is a real Three.js module by checking a core class.
      if (!module || typeof module.WebGLRenderer !== "function") {
        if (_loadPromise === pending) _loadPromise = null;
        throw new Error(`Local Three.js module at ${localUrl} did not export expected Three.js classes.`);
      }
      _THREE = module;
      _threeSource = "local";
      return module;
    }).catch(err => {
      if (_loadPromise === pending) _loadPromise = null; // allow retry without clobbering a newer import
      throw new Error(`3D module failed to load from this installation. URL: ${localUrl} — ${err?.message || err}`);
    });
    _loadPromise = pending;
    return _loadPromise;
  }

  // ── Coordinate helpers ────────────────────────────────────────────

  // Convert angle (degrees, CW from top) + radius to XZ plane position (y=0).
  function angleToXZ(angleDeg, radius) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: radius * Math.cos(rad), z: radius * Math.sin(rad) };
  }

  // B7.6 — one geometry authority for the counted calendar rail.
  // Every visual attached to a Pattern day derives from the same canonical
  // angle. Radius multipliers only control radial hierarchy; label layout must
  // never change the day angle or collision-shift a rail numeral.
  const CALENDAR_RAIL = Object.freeze({
    plannerMarker: 1.105,
    connectorStart: 1.072,
    dayTickEnd: 1.215,
    weekTickEnd: 1.235,
    moonTickEnd: 1.255,
    weekArc: 1.247,
    weekLabel: 1.272,
    moonLabel: 1.322,
    plannerLaneStep: 0.027,
    yearGateLane: 1.385,
    // B7.10: the label rail uses deterministic radial lanes at Moon seams.
    // Day 28 sits slightly inward and Day 1 slightly outward so neighboring
    // Moon boundary numerals never print on top of one another. The angle is
    // still canonical; only radial hierarchy changes.
    dayNumber: 1.295,
    dayNumberMoonEnd: 1.285,
    dayNumberMoonStart: 1.345,
    calendarMatrixWeek1: 1.32,
    calendarMatrixWeekStep: 0.092,
    calendarMatrixMoonLabel: 1.565,
    intercalaryTickStart: 1.185,
    intercalaryTickEnd: 1.255
  });

  function _calendarRailGeometry() {
    return CALENDAR_RAIL;
  }

  // B7.14 — selected-Moon emphasis stays on the canonical annual rail.
  // Earlier revisions projected 1..28 into an interior 4x7 face; under a
  // tilted camera that collapsed into a block beside one Moon. The calendar
  // now remains one continuous 364-day circumference. Selection only adds a
  // quiet sector bracket and week arcs; it never relocates a day.
  function _decorateActiveMoonCalendarGrid(group, moonIndex, ringRadius, mat) {
    if (!group || !_THREE || !Number.isFinite(Number(moonIndex))) return;
    const sectorSweep = 360 / 13;
    const sectorStart = moonIndex * sectorSweep;
    const sectorEnd = sectorStart + sectorSweep;
    const innerR = ringRadius * 1.205;
    const outerR = ringRadius * 1.365;
    const pts = [];

    // Moon boundaries.
    for (const angle of [sectorStart, sectorEnd]) {
      const p0 = angleToXZ(angle, innerR);
      const p1 = angleToXZ(angle, outerR);
      pts.push(new _THREE.Vector3(p0.x, 0.020, p0.z));
      pts.push(new _THREE.Vector3(p1.x, 0.020, p1.z));
    }

    // Four week arcs at their true angular spans.
    const calendar = globalThis.LivingTimeSphereCalendarGeometry;
    const weeks = calendar?.moonAddress?.(moonIndex + 1)?.weeks || [];
    for (let w = 0; w < 4; w += 1) {
      const startA = weeks[w]?.startAngle ?? (sectorStart + w * sectorSweep / 4);
      let endA = weeks[w]?.endAngle ?? (sectorStart + (w + 1) * sectorSweep / 4);
      if (endA <= startA) endA += 360;
      const radius = ringRadius * (1.235 + w * 0.018);
      const steps = 12;
      for (let i = 0; i < steps; i += 1) {
        const a0 = startA + (i / steps) * (endA - startA);
        const a1 = startA + ((i + 1) / steps) * (endA - startA);
        const p0 = angleToXZ(a0, radius);
        const p1 = angleToXZ(a1, radius);
        pts.push(new _THREE.Vector3(p0.x, 0.019, p0.z));
        pts.push(new _THREE.Vector3(p1.x, 0.019, p1.z));
      }
    }

    // B7.27 — the selected week is an explicit sub-territory inside the Moon.
    // This makes the four-week rhythm readable without adding another label.
    const selectedWeek = Number(_model?.selectedPatternPosition?.moon) === moonIndex + 1
      ? Math.max(1, Math.min(4, Math.ceil(Number(_model?.selectedPatternPosition?.day || 1) / 7)))
      : null;
    if (selectedWeek) {
      const meta = weeks[selectedWeek - 1] || {};
      const startA = Number(meta.startAngle ?? (sectorStart + (selectedWeek - 1) * sectorSweep / 4));
      let endA = Number(meta.endAngle ?? (sectorStart + selectedWeek * sectorSweep / 4));
      if (endA <= startA) endA += 360;
      const radius = ringRadius * (1.235 + (selectedWeek - 1) * 0.018);
      const focusPts = [];
      for (let i = 0; i < 18; i += 1) {
        const p0 = angleToXZ(startA + (i / 18) * (endA - startA), radius);
        const p1 = angleToXZ(startA + ((i + 1) / 18) * (endA - startA), radius);
        focusPts.push(new _THREE.Vector3(p0.x, 0.025, p0.z), new _THREE.Vector3(p1.x, 0.025, p1.z));
      }
      const focusLine = new _THREE.LineSegments(
        new _THREE.BufferGeometry().setFromPoints(focusPts),
        new _THREE.LineBasicMaterial({ color: mat.COLORS.todayHalo || mat.COLORS.moonStroke, transparent: true, opacity: 0.92, depthWrite: false })
      );
      focusLine.name = "activeCalendarWeek";
      focusLine.userData = { type: "active-calendar-week", week: selectedWeek };
      group.add(focusLine);
    }

    // B7.24 — a restrained active-Moon membrane makes the current calendar
    // territory legible without hiding astronomy beneath it. It uses the same
    // sector boundaries as the 13 × 28 calendar and adds no new temporal math.
    const wedgeVertices = [];
    const wedgeSegments = 24;
    for (let i = 0; i < wedgeSegments; i += 1) {
      const a0 = sectorStart + (i / wedgeSegments) * sectorSweep;
      const a1 = sectorStart + ((i + 1) / wedgeSegments) * sectorSweep;
      const i0 = angleToXZ(a0, innerR);
      const i1 = angleToXZ(a1, innerR);
      const o0 = angleToXZ(a0, outerR);
      const o1 = angleToXZ(a1, outerR);
      wedgeVertices.push(
        i0.x, 0.010, i0.z, o0.x, 0.010, o0.z, o1.x, 0.010, o1.z,
        i0.x, 0.010, i0.z, o1.x, 0.010, o1.z, i1.x, 0.010, i1.z
      );
    }
    const wedgeGeometry = new _THREE.BufferGeometry();
    wedgeGeometry.setAttribute("position", new _THREE.Float32BufferAttribute(wedgeVertices, 3));
    const wedgeMaterial = new _THREE.MeshBasicMaterial({
      color: mat.COLORS.moonStroke,
      transparent: true,
      opacity: _viewMode === "today" ? 0.055 : 0.04,
      side: _THREE.DoubleSide,
      depthWrite: false
    });
    const wedge = new _THREE.Mesh(wedgeGeometry, wedgeMaterial);
    wedge.name = "activeMoonCalendarMembrane";
    wedge.userData.type = "active-moon-calendar-membrane";
    group.add(wedge);

    const material = new _THREE.LineBasicMaterial({
      color: mat.COLORS.moonStroke,
      transparent: true,
      opacity: _viewMode === "today" ? 0.76 : 0.60,
      depthWrite: false
    });
    const lines = new _THREE.LineSegments(new _THREE.BufferGeometry().setFromPoints(pts), material);
    lines.name = "activeMoonCanonicalCalendarSector";
    lines.userData.type = "moon-calendar-canonical-sector";
    group.add(lines);
  }

  // Build canonical world-space anchor for Moon m (1-based) on the pattern ring.
  // Angle = center of the moon's sector (each sector = 360/13 degrees, Moon 1 starts at 0°).
  const MOON_IDENTITIES = Object.freeze([
    Object.freeze({ moon: 1,  name: "Seed Flame" }),
    Object.freeze({ moon: 2,  name: "Root Waters" }),
    Object.freeze({ moon: 3,  name: "Breath Gate" }),
    Object.freeze({ moon: 4,  name: "Stone Witness" }),
    Object.freeze({ moon: 5,  name: "Living Word" }),
    Object.freeze({ moon: 6,  name: "Fire Trial" }),
    Object.freeze({ moon: 7,  name: "Crown Balance" }),
    Object.freeze({ moon: 8,  name: "Deep Mirror" }),
    Object.freeze({ moon: 9,  name: "Return Path" }),
    Object.freeze({ moon: 10, name: "Builder’s Hand" }),
    Object.freeze({ moon: 11, name: "Star Remembrance" }),
    Object.freeze({ moon: 12, name: "River of Signs" }),
    Object.freeze({ moon: 13, name: "Completion Seal" })
  ]);

  function _moonSectorCenterAngle(moonIndex) {
    // moonIndex is 0-based (0 = Moon 1, 12 = Moon 13)
    return ((moonIndex + 0.5) / 13) * 360;
  }

  function _moonLabelRadiusMultiplier(viewMode, distanceMode = _moonLabelDistance) {
    const compact = _isMobileWidth();
    if (distanceMode === "tight") return compact ? 1.032 : 1.045;
    if (distanceMode === "wide") return compact ? 1.085 : 1.105;
    if (viewMode === "today") return compact ? 1.038 : 1.052;
    if (viewMode === "pattern") return compact ? 1.04 : 1.06;
    if (viewMode === "years") return compact ? 1.05 : 1.08;
    return compact ? 1.04 : 1.055;
  }

  function _semanticScreenWidth() {
    if (_container?.clientWidth) return _container.clientWidth;
    if (typeof window !== "undefined") return window.innerWidth || 1024;
    return 1024;
  }

  function _semanticThresholds(width) {
    const w = Number(width) || 1024;
    const offset = w < 480 ? 0.24 : (w < 760 ? 0.12 : 0);
    const base = globalThis.LivingTimeSphereSemanticZoom?.BASE_THRESHOLDS || {};
    return {
      farMin: (base.farMin ?? 3.25) - offset,
      mediumMin: (base.mediumMin ?? 2.35) - offset,
      nearMin: (base.nearMin ?? 1.62) - offset,
    };
  }

  function _stabilizeBandWithMeta({ candidateBand, distance, screenWidth, previousBand }) {
    if (!previousBand || candidateBand === previousBand) {
      return { band: candidateBand, transitionThreshold: null };
    }
    const d = Number(distance);
    if (!Number.isFinite(d)) return { band: candidateBand, transitionThreshold: null };
    const { farMin, mediumMin, nearMin } = _semanticThresholds(screenWidth);
    const margin = 0.12;
    if (previousBand === "far" && candidateBand === "medium" && d >= farMin - margin) return { band: "far", transitionThreshold: Number((farMin - margin).toFixed(3)) };
    if (previousBand === "medium" && candidateBand === "far" && d < farMin + margin) return { band: "medium", transitionThreshold: Number((farMin + margin).toFixed(3)) };
    if (previousBand === "medium" && candidateBand === "near" && d >= mediumMin - margin) return { band: "medium", transitionThreshold: Number((mediumMin - margin).toFixed(3)) };
    if (previousBand === "near" && candidateBand === "medium" && d < mediumMin + margin) return { band: "near", transitionThreshold: Number((mediumMin + margin).toFixed(3)) };
    if (previousBand === "near" && candidateBand === "detail" && d >= nearMin - margin) return { band: "near", transitionThreshold: Number((nearMin - margin).toFixed(3)) };
    if (previousBand === "detail" && candidateBand === "near" && d < nearMin + margin) return { band: "detail", transitionThreshold: Number((nearMin + margin).toFixed(3)) };
    return { band: candidateBand, transitionThreshold: null };
  }

  function _stabilizeBand({ candidateBand, distance, screenWidth, previousBand }) {
    return _stabilizeBandWithMeta({ candidateBand, distance, screenWidth, previousBand }).band;
  }

  function _resolveSemanticZoomFromCamera() {
    const zoom = globalThis.LivingTimeSphereSemanticZoom;
    if (!zoom?.resolveBand || !zoom?.resolveVisibility) return _semanticZoomState;
    const screenWidth = _semanticScreenWidth();
    const cameraState = globalThis.LivingTimeSphereCamera?.getState?.() || {};
    const fallbackDist = globalThis.LivingTimeSphereCamera?.MODE_POSITIONS?.[_viewMode]?.distance || 2.35;
    const rawDistance = Number(cameraState.dist);
    const distance = Number.isFinite(rawDistance) ? rawDistance : fallbackDist;
    const candidateBand = zoom.resolveBand({ distance, screenWidth });
    const stabilization = _stabilizeBandWithMeta({ candidateBand, distance, screenWidth, previousBand: _activeSemanticBand });
    const band = stabilization.band;
    const resolved = zoom.resolveVisibility({
      baseLayers: _visibleLayers || {},
      band,
      connectionMode: _semanticZoomState?.connectionMode || "contextual",
    });
    return Object.freeze({
      ...resolved,
      sourceType: Number.isFinite(rawDistance) ? "camera-distance-live" : "camera-distance-fallback",
      distance,
      previousBand: _activeSemanticBand || null,
      transitionThreshold: stabilization.transitionThreshold,
    });
  }

  // B7.51 — distinct numbered Pattern Moons. The Pattern-Moon identity lane is
  // deliberately inside the 28-day rail so the selected/today day marker can
  // never sit inside a Moon body and create the accidental "ringed planet"
  // appearance. Bodies remain one InstancedMesh draw call; the 1..13 faces are
  // a second single GPU point field backed by one tiny atlas texture.
  const MOON_IDENTITY_COLORS = Object.freeze([
    0x35e0c4, 0x58c8ff, 0xa678ff, 0xe7d36f, 0xffc13d,
    0xff755f, 0x65df7a, 0x48d9e7, 0x8d7aff, 0xf0a34f,
    0x72b9ff, 0x35c9a3, 0xffa65c
  ]);
  const MOON_IDENTITY_SHAPES = Object.freeze([
    [1.00, 1.00, 1.00], [1.12, .91, 1.00], [.92, 1.12, 1.00], [1.06, 1.04, .92],
    [1.15, .90, .96], [.91, 1.13, .98], [1.08, .96, 1.08], [.95, 1.07, 1.12],
    [1.13, .94, .93], [.94, 1.12, 1.03], [1.05, .93, 1.14], [1.11, 1.03, .91],
    [1.00, 1.14, .92]
  ]);
  // B7.52.3 — moon-only detail/contrast tuning. Keep the same identity lane
  // and bounded GPU architecture, but make every Pattern Moon unmistakable on
  // phone screens: brighter body colour, stronger silhouette, unique rotation,
  // a numbered medallion, and one shared 13-Moon signature/halo line field.
  const MOON_IDENTITY_LANE_FACTOR = 0.80;
  const MOON_IDENTITY_BODY_FACTOR = 0.105;
  const MOON_IDENTITY_BODY_MIN = 0.058;
  const MOON_IDENTITY_HALO_FACTOR = 1.27;

  function _moonIdentityAtlasTexture() {
    if (!_THREE || typeof document === "undefined") return null;
    if (_objects.moonIdentityNumberTexture) return _objects.moonIdentityNumberTexture;
    const grid = 4;
    const tile = 128;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = grid * tile;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < 13; i += 1) {
      const col = i % grid;
      const row = Math.floor(i / grid);
      const cx = col * tile + tile / 2;
      const cy = row * tile + tile / 2;
      const n = i + 1;
      const css = `#${Number(MOON_IDENTITY_COLORS[i] || 0x8fd8d0).toString(16).padStart(6, "0")}`;

      // A dark medallion with the Moon's own colour keeps 1..13 readable
      // against bright geometry, dark space, labels, and day rails alike.
      ctx.beginPath();
      ctx.arc(cx, cy, 43, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(2,8,13,.82)";
      ctx.fill();
      ctx.lineWidth = 7;
      ctx.strokeStyle = css;
      ctx.stroke();

      const notch = -Math.PI / 2 + (i / 13) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 49, notch - .27, notch + .27);
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(255,246,210,.94)";
      ctx.stroke();

      ctx.font = `900 ${n >= 10 ? 48 : 57}px system-ui, sans-serif`;
      ctx.lineWidth = 10;
      ctx.strokeStyle = "rgba(0,0,0,.98)";
      ctx.strokeText(String(n), cx, cy + 1);
      ctx.fillStyle = "#fff8dc";
      ctx.fillText(String(n), cx, cy + 1);
    }
    const texture = new _THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.minFilter = _THREE.LinearFilter;
    texture.magFilter = _THREE.LinearFilter;
    texture.generateMipmaps = false;
    if ("colorSpace" in texture && _THREE.SRGBColorSpace) texture.colorSpace = _THREE.SRGBColorSpace;
    _objects.moonIdentityNumberTexture = texture;
    return texture;
  }

  function _syncMoonNumberPositions() {
    const points = _objects.moonIdentityNumbers;
    if (!points || _moonAnchors.length !== 13) return;
    const attr = points.geometry?.getAttribute?.("position");
    if (!attr) return;
    for (let i = 0; i < 13; i += 1) {
      const a = _moonAnchors[i];
      attr.setXYZ(i, Number(a?.worldX || 0), Number(a?.worldY || 0) + 0.008, Number(a?.worldZ || 0));
    }
    attr.needsUpdate = true;
  }

  function _syncMoonNumberDisclosure(disclosure = null) {
    const points = _objects.moonIdentityNumbers;
    if (!points) return;
    const visible = points.geometry?.getAttribute?.("aVisible");
    const scale = points.geometry?.getAttribute?.("aScale");
    if (!visible || !scale) return;
    const moons = new Set((disclosure?.moons || []).map(Number));
    const center = Number(disclosure?.centerMoon || 0);
    const selected = Number(_model?.selectedPatternPosition?.moon || 0);
    const today = Number(_model?.todayPatternPosition?.moon || 0);
    for (let i = 0; i < 13; i += 1) {
      const moon = i + 1;
      // Every Pattern Moon owns its number permanently. Calendar disclosure
      // may change emphasis, but it must never make the Moon identity vanish.
      visible.setX(i, 1);
      scale.setX(i, moon === center ? 1.40 : moon === selected ? 1.34 : moon === today ? 1.26 : 1.10);
    }
    visible.needsUpdate = true;
    scale.needsUpdate = true;
  }

  function _buildMoonNumberField() {
    if (!_THREE || !_scene || _objects.moonIdentityNumbers) return;
    const texture = _moonIdentityAtlasTexture();
    if (!texture) return;
    const geometry = new _THREE.BufferGeometry();
    geometry.setAttribute("position", new _THREE.BufferAttribute(new Float32Array(13 * 3), 3));
    geometry.setAttribute("aTile", new _THREE.BufferAttribute(new Float32Array(Array.from({ length: 13 }, (_, i) => i)), 1));
    geometry.setAttribute("aVisible", new _THREE.BufferAttribute(new Float32Array(13), 1));
    geometry.setAttribute("aScale", new _THREE.BufferAttribute(new Float32Array(13).fill(1), 1));
    const material = new _THREE.ShaderMaterial({
      uniforms: {
        uAtlas: { value: texture },
        uPointSize: { value: _isMobileWidth() ? 44 : 50 }
      },
      vertexShader: `
        attribute float aTile;
        attribute float aVisible;
        attribute float aScale;
        varying float vTile;
        varying float vVisible;
        void main() {
          vTile = aTile;
          vVisible = aVisible;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = uPointSize * aScale * aVisible;
        }
      `,
      fragmentShader: `
        uniform sampler2D uAtlas;
        varying float vTile;
        varying float vVisible;
        void main() {
          if (vVisible < 0.5) discard;
          float grid = 4.0;
          float col = mod(vTile, grid);
          float row = floor(vTile / grid);
          // Correct CanvasTexture atlas addressing for gl_PointCoord. The old
          // row reversal could sample transparent tiles on Android.
          vec2 localUv = vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y);
          vec2 uv = (localUv + vec2(col, row)) / grid;
          vec4 texel = texture2D(uAtlas, uv);
          if (texel.a < 0.08) discard;
          gl_FragColor = vec4(texel.rgb, texel.a * vVisible);
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      toneMapped: false
    });
    const points = new _THREE.Points(geometry, material);
    points.name = "moonIdentityNumbers";
    points.userData.type = "moon-identity-numbers";
    points.renderOrder = 20;
    points.frustumCulled = false;
    _scene.add(points);
    _objects.moonIdentityNumbers = points;
    _syncMoonNumberPositions();
    _syncMoonNumberDisclosure(_calendarDisclosureCache);
  }

  function _moonIdentityBodyRadius() {
    const mat = globalThis.LivingTimeSphereM;
    return Math.max(
      MOON_IDENTITY_BODY_MIN,
      Number(mat?.SIZES?.patternRing || 0.7) * MOON_IDENTITY_BODY_FACTOR
    );
  }

  function _syncMoonIdentityDetails() {
    const detail = _objects.moonIdentityDetails;
    if (!detail || !_THREE || _moonAnchors.length !== 13) return;
    const pos = detail.geometry?.getAttribute?.("position");
    const color = detail.geometry?.getAttribute?.("color");
    const segments = Number(detail.userData?.segments || 28);
    if (!pos || !color || !segments) return;

    const selectedMoon = Number(_model?.selectedPatternPosition?.moon || 0);
    const todayMoon = Number(_model?.todayPatternPosition?.moon || 0);
    const bodyRadius = _moonIdentityBodyRadius();
    const white = new _THREE.Color(0xffffff);
    let cursor = 0;

    for (let i = 0; i < 13; i += 1) {
      const anchor = _moonAnchors[i];
      if (!anchor) continue;
      const moon = i + 1;
      const emphasis = moon === selectedMoon ? 1.22 : moon === todayMoon ? 1.13 : 1;
      const ringRadius = bodyRadius * MOON_IDENTITY_HALO_FACTOR * emphasis;
      const radialLen = Math.hypot(anchor.worldX, anchor.worldZ) || 1;
      const rx = anchor.worldX / radialLen;
      const rz = anchor.worldZ / radialLen;
      const tx = -rz;
      const tz = rx;
      const baseColor = new _THREE.Color(MOON_IDENTITY_COLORS[i] || 0x8fd8d0).lerp(white, .16);

      // Full halo: the body stays separated from the day rail even when dark
      // scene geometry crosses behind it.
      for (let seg = 0; seg < segments; seg += 1) {
        const a0 = (seg / segments) * Math.PI * 2;
        const a1 = ((seg + 1) / segments) * Math.PI * 2;
        for (const angle of [a0, a1]) {
          const lateral = Math.cos(angle) * ringRadius;
          const vertical = Math.sin(angle) * ringRadius;
          pos.setXYZ(cursor, anchor.worldX + tx * lateral, anchor.worldY + vertical, anchor.worldZ + tz * lateral);
          color.setXYZ(cursor, baseColor.r, baseColor.g, baseColor.b);
          cursor += 1;
        }
      }

      // Unique signature arc for each Moon. Its angular position is tied to
      // Moon number, so the 13 bodies remain distinguishable beyond colour.
      const signatureRadius = bodyRadius * 1.08 * emphasis;
      const signatureStart = -Math.PI * .72 + (i / 13) * Math.PI * 1.44;
      const signatureSpan = .44 + (i % 4) * .09;
      const signatureColor = baseColor.clone().lerp(white, .36);
      for (let seg = 0; seg < segments; seg += 1) {
        const t0 = seg / segments;
        const t1 = (seg + 1) / segments;
        const a0 = signatureStart + t0 * signatureSpan;
        const a1 = signatureStart + t1 * signatureSpan;
        for (const angle of [a0, a1]) {
          const lateral = Math.cos(angle) * signatureRadius;
          const vertical = Math.sin(angle) * signatureRadius;
          pos.setXYZ(cursor, anchor.worldX + tx * lateral, anchor.worldY + vertical, anchor.worldZ + tz * lateral);
          color.setXYZ(cursor, signatureColor.r, signatureColor.g, signatureColor.b);
          cursor += 1;
        }
      }
    }
    pos.needsUpdate = true;
    color.needsUpdate = true;
  }

  function _buildMoonIdentityDetails() {
    if (!_THREE || !_scene || _objects.moonIdentityDetails) return;
    const segments = _isMobileWidth() ? 24 : 32;
    // Two ring sets per Moon: full halo + unique signature arc.
    const vertices = 13 * segments * 2 * 2;
    const geometry = new _THREE.BufferGeometry();
    geometry.setAttribute("position", new _THREE.BufferAttribute(new Float32Array(vertices * 3), 3));
    geometry.setAttribute("color", new _THREE.BufferAttribute(new Float32Array(vertices * 3), 3));
    const material = new _THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
      depthTest: true,
      toneMapped: false
    });
    const detail = new _THREE.LineSegments(geometry, material);
    detail.name = "moonIdentityDetails";
    detail.userData.type = "moon-identity-details";
    detail.userData.segments = segments;
    detail.renderOrder = 7;
    detail.frustumCulled = false;
    _scene.add(detail);
    _objects.moonIdentityDetails = detail;
    _syncMoonIdentityDetails();
  }

  function _syncMoonIdentityMarkers() {
    const mesh = _objects.moonIdentityMarkers;
    if (!mesh || !_THREE || _moonAnchors.length !== 13) return;
    const dummy = new _THREE.Object3D();
    const selectedMoon = Number(_model?.selectedPatternPosition?.moon || 0);
    const todayMoon = Number(_model?.todayPatternPosition?.moon || 0);
    for (let i = 0; i < 13; i += 1) {
      const anchor = _moonAnchors[i];
      if (!anchor) continue;
      const moon = i + 1;
      const emphasis = moon === selectedMoon ? 1.28 : moon === todayMoon ? 1.18 : 1;
      const shape = MOON_IDENTITY_SHAPES[i] || [1, 1, 1];
      dummy.position.set(anchor.worldX, anchor.worldY, anchor.worldZ);
      dummy.scale.set(shape[0] * emphasis, shape[1] * emphasis, shape[2] * emphasis);
      // A small deterministic rotation makes each non-spherical identity
      // silhouette visibly distinct as the user orbits the instrument.
      dummy.rotation.set((i % 3) * .16, (i / 13) * Math.PI * 1.7, ((i % 5) - 2) * .11);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    _syncMoonIdentityDetails();
    _syncMoonNumberPositions();
    _syncMoonNumberDisclosure(_calendarDisclosureCache);
  }

  function _buildMoonIdentityMarkers() {
    if (!_THREE || !_scene || _objects.moonIdentityMarkers) return;
    const mat = globalThis.LivingTimeSphereM;
    const radius = Math.max(
      MOON_IDENTITY_BODY_MIN,
      Number(mat?.SIZES?.patternRing || 0.7) * MOON_IDENTITY_BODY_FACTOR
    );
    const geometry = new _THREE.SphereGeometry(radius, _isMobileWidth() ? 14 : 18, _isMobileWidth() ? 10 : 13);
    // Three.js multiplies instanceColor by vertex colour. Supplying an explicit
    // white vertex-colour attribute avoids the nearly-black InstancedMesh seen
    // on the user's Android/WebGL path while retaining one body draw call.
    const vertexCount = geometry.getAttribute("position")?.count || 0;
    geometry.setAttribute("color", new _THREE.BufferAttribute(new Float32Array(vertexCount * 3).fill(1), 3));
    const material = new _THREE.MeshBasicMaterial({
      color: 0xffffff,
      vertexColors: true,
      transparent: false,
      opacity: 1.0,
      depthWrite: true,
      depthTest: true,
      toneMapped: false
    });
    const mesh = new _THREE.InstancedMesh(geometry, material, 13);
    mesh.name = "moonIdentityMarkers";
    mesh.userData.type = "moon-identity-markers";
    mesh.renderOrder = 5;
    mesh.frustumCulled = false;
    for (let i = 0; i < 13; i += 1) {
      mesh.setColorAt(i, new _THREE.Color(MOON_IDENTITY_COLORS[i] || 0x8fd8d0));
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    _scene.add(mesh);
    _objects.moonIdentityMarkers = mesh;
    _buildMoonIdentityDetails();
    _syncMoonIdentityMarkers();
    _buildMoonNumberField();
  }

  function _buildMoonAnchors(viewMode = _viewMode) {
    const mat = globalThis.LivingTimeSphereM;
    // B7.51: Pattern-Moon bodies/names live on their own inner identity lane.
    // The day/calendar rail remains at patternRing, so Today/Selected markers
    // cannot geometrically intersect the Moon bodies.
    const r = mat.SIZES.patternRing * MOON_IDENTITY_LANE_FACTOR;
    _moonAnchors.length = 0;
    _activeSemanticBand = null;
    _previousSemanticBand = null;
    _lastSemanticTransitionThreshold = null;
    for (let i = 0; i < 13; i++) {
      const angle = _moonSectorCenterAngle(i);
      const { x, z } = angleToXZ(angle, r);
      _moonAnchors.push({
        moon:  i + 1,
        name: MOON_IDENTITIES[i]?.name || `Moon ${i + 1}`,
        angle,
        radius: r,
        worldX: x,
        worldY: mat.SIZES.ringTube * 1.5,
        worldZ: z,
      });
    }
    _syncMoonIdentityMarkers();
  }

  function _setupMoonLabelEls(container) {
    _moonLabelContainer = container.parentElement?.querySelector("#sphere-moon-labels") ||
                          document.getElementById("sphere-moon-labels");
    if (!_moonLabelContainer) return;
    // Remove old fixed-position inline styles
    const spans = _moonLabelContainer.querySelectorAll(".sphere-moon-label");
    spans.forEach(s => {
      s.style.cssText = "";   // clear the fixed inline styles
      s.style.display = "none";
      s.classList.remove("is-selected", "is-front", "is-quiet");
    });
    _moonLabelConnectorEl = _moonLabelContainer.querySelector(".sphere-moon-label-connector");
    if (!_moonLabelConnectorEl) {
      _moonLabelConnectorEl = document.createElement("div");
      _moonLabelConnectorEl.className = "sphere-moon-label-connector";
      _moonLabelConnectorEl.style.display = "none";
      _moonLabelContainer.appendChild(_moonLabelConnectorEl);
    }
    // Build an array indexed by moon (0 = Moon1)
    _moonLabelEls = Array.from({ length: 13 }, (_, i) => {
      const moon = i + 1;
      let el = _moonLabelContainer.querySelector(`[data-moon="${moon}"]`);
      if (!el) {
        el = document.createElement("span");
        el.className = "sphere-moon-label";
        el.dataset.moon = String(moon);
        el.textContent = `Moon ${moon}`;
        _moonLabelContainer.appendChild(el);
      }
      el.style.cssText = "";
      el.style.display = "none";
      el.style.position = "absolute";
      el.classList.remove("is-selected", "is-front", "is-quiet");
      return el;
    });
    if (globalThis.LivingTimeSphereLabelManager?.createManager) {
      _moonLabelManager = globalThis.LivingTimeSphereLabelManager.createManager();
      _moonLabelManager.init({
        stageEl: container,
        labelContainer: _moonLabelContainer,
        labelEls: _moonLabelEls,
        connectorEl: _moonLabelConnectorEl
      });
      _moonLabelManager.markDirty?.();
    }
  }

  function _moonLabelProtectedRects() {
    const shell = _container?.closest?.(".sphere-instrument-shell") || null;
    if (!shell) return [];
    const protectedEls = [
      shell.querySelector(".sphere-instrument-topline"),
      shell.querySelector(".sphere-instrument-footer")
    ].filter(Boolean);
    const rects = [];
    for (const el of protectedEls) {
      const rect = el.getBoundingClientRect?.();
      if (rect && Number.isFinite(rect.width) && Number.isFinite(rect.height) && rect.width > 0 && rect.height > 0) {
        rects.push(rect);
      }
    }
    return rects;
  }

  function _adjacentMoons(moon) {
    if (!moon) return [];
    return [moon - 1 < 1 ? 13 : moon - 1, moon + 1 > 13 ? 1 : moon + 1];
  }

  function _moonLabelSet(viewMode, labelMode, selectedMoon, todayMoon, equinoxMoon) {
    if (labelMode === "hidden") return new Set();
    if (labelMode === "selected") return new Set(selectedMoon ? [selectedMoon] : []);
    if (labelMode === "all") return new Set(Array.from({ length: 13 }, (_, i) => i + 1));

    if (viewMode === "today") {
      return new Set([selectedMoon, ..._adjacentMoons(selectedMoon), 1, 13].filter(Boolean));
    }
    if (viewMode === "passage") {
      return new Set([selectedMoon, equinoxMoon, ..._adjacentMoons(selectedMoon), 1, todayMoon].filter(Boolean));
    }
    if (viewMode === "pattern") {
      if (_isMobileWidth()) {
        return new Set([selectedMoon, ..._adjacentMoons(selectedMoon), 1, todayMoon].filter(Boolean));
      }
      return new Set(Array.from({ length: 13 }, (_, i) => i + 1));
    }
    return new Set([1, 4, 7, 10, selectedMoon].filter(Boolean));
  }

  function _moonLabelPriority(moon, { selectedMoon, todayMoon, equinoxMoon, viewMode }) {
    let priority = 10;
    if (moon === selectedMoon) priority = 100;
    else if (moon === todayMoon) priority = 90;
    else if (moon === equinoxMoon) priority = 80;
    else if (moon === 1) priority = 70;
    else if (moon === 13 && viewMode === "today") priority = 65;
    else if (_adjacentMoons(selectedMoon).includes(moon)) priority = 60;
    return priority;
  }

  function _hideMoonLabel(el) {
    if (!el) return;
    el.style.display = "none";
    el.classList.remove("is-selected", "is-front", "is-quiet");
  }

  function _hideMoonConnector() {
    if (!_moonLabelConnectorEl) return;
    _moonLabelConnectorEl.style.display = "none";
    _moonLabelConnectorEl.style.opacity = "0";
  }

  function _semanticTargetFromObject(id, label, object, options = {}) {
    if (!object?.position || object.visible === false) return null;
    return {
      id, label,
      detail: options.detail || "",
      kind: options.kind || "object",
      worldX: Number(object.position.x),
      worldY: Number(object.position.y),
      worldZ: Number(object.position.z),
      priority: options.priority ?? 40,
      showDistance: options.showDistance ?? 2.2,
      resetDistance: options.resetDistance ?? ((options.showDistance ?? 2.2) + 0.42),
      pinned: !!options.pinned,
      selected: !!options.selected,
      moon: options.moon || null,
      // Preserve optional placement hints used by the semantic overlay.
      haloOffset: Number.isFinite(Number(options.haloOffset)) ? Number(options.haloOffset) : null,
      haloLane: options.haloLane || null
    };
  }

  function _buildSemanticTargets(options = {}) {
    const targets = [];
    const calendarDisclosure = options?.calendarDisclosure || null;
    const interactionLite = !!options?.interactionLite;
    const dayAperture = String(_dayLabelMode || "key") !== "all"
      && Array.isArray(calendarDisclosure?.moons)
      && calendarDisclosure.moons.length
      ? new Set(calendarDisclosure.moons.map(Number))
      : null;
    const selected = _model?.selectedPatternPosition || _model?.todayPatternPosition || null;
    const today = _model?.todayPatternPosition || null;
    const selectedMoon = Number(selected?.moon || 0);
    for (const anchor of _moonAnchors) {
      targets.push({
        id: `moon-${anchor.moon}`,
        label: `Moon ${anchor.moon}`,
        detail: anchor.moon === selectedMoon && selected?.day ? `Selected · Day ${selected.day}/28` : "13-Moon pattern sector",
        kind: "moon",
        moon: anchor.moon,
        worldX: anchor.worldX, worldY: anchor.worldY, worldZ: anchor.worldZ,
        priority: anchor.moon === selectedMoon ? 88 : 46,
        showDistance: 1.8, resetDistance: 2.18,
        selected: anchor.moon === selectedMoon
      });
    }
    const todayDetail = today ? `Moon ${today.moon} · Day ${today.day} · ${today.dayOfPatternYear}/364` : "Current Pattern position";
    const selectedDetail = selected ? `Moon ${selected.moon} · Day ${selected.day} · ${selected.dayOfPatternYear}/364` : "Selected Pattern position";
    const selectedMatchesToday = !!(selected && today
      && Number(selected.dayOfPatternYear) === Number(today.dayOfPatternYear)
      && Number(selected.moon) === Number(today.moon)
      && Number(selected.day) === Number(today.day));
    // B7.29 — keep the sphere readable. Selection/year/lunar/solar state is
    // already available in the fixed instrument UI and should not become a
    // swarm of floating cards. Only landmarks whose position itself matters
    // remain semantic labels here.
    const simple = [
      _semanticTargetFromObject("live-today", "Today", _objects.todayMarker, { kind: "pattern-day", priority: 97, showDistance: 1.50, resetDistance: 1.82, detail: todayDetail }),
      _semanticTargetFromObject("year-gate", "Year Gate", _objects.yearGate, { kind: "gate", priority: 86, showDistance: 1.58, resetDistance: 1.90, detail: "Moon 1 · Day 1 · fixed Pattern seam" }),
      _semanticTargetFromObject("march-equinox", "March Equinox", _objects.equinoxGate, { kind: "astronomy", priority: 87, showDistance: 1.58, resetDistance: 1.92, detail: "Astronomical alignment marker" })
    ].filter(Boolean);
    targets.push(...simple);

    // Planet labels are proximity-only. The markers stay in the geometry; text
    // appears only when that part of the ecliptic rail is actually approached.
    for (const marker of (_objects.planetMarkers || [])) {
      const data = marker?.userData || {};
      if (!marker?.visible || !data.planetId) continue;
      targets.push(_semanticTargetFromObject(
        `planet-${data.planetId}`,
        `${data.glyph || ""} ${data.name || data.planetId}`.trim(),
        marker,
        {
          kind: "planet",
          priority: 72,
          showDistance: 1.82,
          resetDistance: 2.16,
          detail: `${Number(data.longitude || 0).toFixed(1)}° ecliptic longitude · approximate`
        }
      ));
    }

    // Passage midpoint is derived from the canonical passage angles already in
    // the model; no independent astronomy is calculated here.
    const passageStart = Number(_model?.passageStartAngle ?? _model?.passage?.startAngle);
    const passageEnd = Number(_model?.passageEndAngle ?? _model?.passage?.endAngle);
    if (Number.isFinite(passageStart) && Number.isFinite(passageEnd)) {
      const sweep = ((passageEnd - passageStart + 360) % 360);
      const mid = (passageStart + sweep * 0.5) % 360;
      const pp = angleToXZ(mid, globalThis.LivingTimeSphereM.SIZES.passageArc);
      targets.push({
        id: "passage-midpoint", label: "Equinox Passage", detail: "Passage midpoint", kind: "passage",
        worldX: pp.x, worldY: 0.018, worldZ: pp.z, priority: 82, showDistance: 1.62, resetDistance: 1.94
      });
    }

    // B7.11 — canonical 13 × 28 calendar faces. Every Pattern day still owns
    // its exact annual angle on the physical ring/ticks. The numeral is placed
    // into its Moon's deterministic 4-week × 7-day reading grid so each Moon
    // is visibly and unambiguously Days 1..28 instead of a compressed string.
    {
      const selectedPatternDay = Number(selected?.dayOfPatternYear || 0);
      const todayPatternDay = Number(today?.dayOfPatternYear || 0);
      const ring = globalThis.LivingTimeSphereM.SIZES.patternRing;
      for (let dayOfYear = 1; dayOfYear <= 364; dayOfYear += 1) {
        const calendar = globalThis.LivingTimeSphereCalendarGeometry;
        const address = calendar?.dayAddress?.(dayOfYear);
        const moon = address?.moon || Math.floor((dayOfYear - 1) / 28) + 1;
        const moonDay = address?.moonDay || ((dayOfYear - 1) % 28) + 1;
        if (dayAperture && !dayAperture.has(Number(moon))
          && dayOfYear !== selectedPatternDay && dayOfYear !== todayPatternDay) continue;
        const canonicalAngle = address?.angle ?? globalThis.LivingTimeSphereModel.patternAngleForDayOfYear(dayOfYear);
        // B7.19: chronology and readable calendar are separate coordinate
        // layers. canonicalAngle remains authoritative for astronomy/history;
        // the visible/selectable number uses the 13 × 4 × 7 Moon matrix.
        const calendarCell = calendar?.calendarCell?.(dayOfYear) || null;
        const readingAngle = calendarCell?.angle ?? canonicalAngle;
        const readingRadius = ring * (calendarCell?.radialFactor
          ?? (CALENDAR_RAIL.calendarMatrixWeek1 + (Math.floor((moonDay - 1) / 7)) * CALENDAR_RAIL.calendarMatrixWeekStep));
        const canonicalPoint = angleToXZ(readingAngle, readingRadius);
        const isSelectedDay = dayOfYear === selectedPatternDay;
        const isTodayDay = dayOfYear === todayPatternDay;
        const weekStart = moonDay === 1 || ((moonDay - 1) % 7 === 0);
        const weekEnd = moonDay % 7 === 0;
        const gateDay = weekStart || weekEnd;
        const selectedPatternYear = Number(_selectedYear || _model?.sourceRecord?.year || _model?.year || new Date().getFullYear());
        const plannerSummary = globalThis.LifeAtlasRecordSphereExtension?.plannerDaySummary?.(selectedPatternYear, dayOfYear)
          || { count: 0, recordIds: [], categories: [] };
        targets.push({
          id: `pattern-day-number-${dayOfYear}`,
          label: String(moonDay),
          detail: `Moon ${moon} · Day ${moonDay} · Pattern ${dayOfYear}/364${plannerSummary.count ? ` · ${plannerSummary.primarySymbol || "●"} ${plannerSummary.count} scheduled` : ""}`,
          kind: "pattern-day-number",
          moon,
          moonDay,
          dayOfPatternYear: dayOfYear,
          canonicalAngle,
          readingAngle,
          calendarFace: true,
          calendarWeek: Math.floor((moonDay - 1) / 7) + 1,
          calendarColumn: ((moonDay - 1) % 7) + 1,
          worldX: canonicalPoint.x,
          worldY: 0.022,
          worldZ: canonicalPoint.z,
          priority: isSelectedDay ? 100 : isTodayDay ? 98 : gateDay ? 72 : 44,
          showDistance: 99,
          resetDistance: 99,
          detailDistance: 0,
          haloOffset: 0,
          haloLane: "day",
          railLocked: true,
          quietRail: true,
          interactive: true,
          // B7.48 — keep schedule metadata on the canonical day for inspection
          // and accessibility. The visible glyph is rendered once in the GPU atlas.
          dayScheduleCount: Number(plannerSummary.count) || 0,
          scheduleCount: Number(plannerSummary.count) || 0,
          symbol: plannerSummary.primarySymbol || null,
          recordId: plannerSummary.primaryRecordId || null,
          category: plannerSummary.categories?.[0] || null,
          workflow: plannerSummary.primaryWorkflow || null,
          scheduledRecordIds: plannerSummary.recordIds || [],
          gateDay,
          pinned: isSelectedDay,
          selected: isSelectedDay
        });
      }
    }

    // B7.13 — explicit Year Gate bridge. Intercalary days are named nodes,
    // not ordinary day 365/366 numerals. They live outside Moon/week counting
    // and never alter the 13 × 28 Pattern geometry.
    {
      const selectedYear = Number(_selectedYear || _model?.sourceRecord?.year || new Date().getUTCFullYear());
      const calendar = globalThis.LivingTimeSphereCalendarGeometry;
      const gate = calendar?.yearGate?.(selectedYear);
      const specialRadius = globalThis.LivingTimeSphereM.SIZES.patternRing * CALENDAR_RAIL.yearGateLane;
      const slots = gate?.intercalary || [{ id: "day-out-of-time", shortLabel: "OOT", label: "Day Out of Time", angle: 359.35, leap: false }];
      slots.forEach((slot) => {
        const point = angleToXZ(slot.angle, specialRadius);
        targets.push({
          id: `${slot.id}-rail`,
          label: slot.shortLabel || slot.label,
          detail: `${slot.label} · Year Gate · outside the 364-day week count`,
          kind: "intercalary-day-number",
          worldX: point.x, worldY: 0.018, worldZ: point.z,
          priority: slot.leap ? 97 : 98,
          showDistance: 99, resetDistance: 99, detailDistance: 0,
          haloOffset: 0, haloLane: "day", railLocked: true, quietRail: true,
          intercalary: true, leapIntercalary: !!slot.leap,
          pinned: false, selected: false
        });
      });
    }

    // Only the four gates in the selected Moon are promoted to proximity
    // labels. This preserves the full 52-gate geometry without creating 52 DOM
    // candidates on a phone.
    if (selectedMoon >= 1 && selectedMoon <= 13) {
      for (let week = 1; week <= 4; week += 1) {
        const dayOfYear = (selectedMoon - 1) * 28 + week * 7;
        const angle = globalThis.LivingTimeSphereModel.patternAngleForDayOfYear(dayOfYear);
        const point = angleToXZ(angle, globalThis.LivingTimeSphereM.SIZES.patternRing * 1.04);
        targets.push({
          id: `week-gate-${selectedMoon}-${week}`, label: `Moon ${selectedMoon} · Week Gate ${week}`,
          detail: `Pattern day ${dayOfYear}`, kind: "week-gate",
          worldX: point.x, worldY: 0.004, worldZ: point.z, priority: 58, showDistance: 1.72, resetDistance: 2.08
        });
      }
    }

    if (_objects.seasonMarkers?.visible !== false) {
      const seasonLabels = ["March Equinox anchor", "June Solstice anchor", "September Equinox anchor", "December Solstice anchor"];
      [0, 90, 180, 270].forEach((angle, index) => {
        const point = _positionOnSolarAxis(angle, globalThis.LivingTimeSphereM.SIZES.solarAxis);
        targets.push({
          id: `solar-anchor-${angle}`, label: seasonLabels[index], detail: "Seasonal reference anchor", kind: "solar-anchor",
          worldX: point.x, worldY: point.y, worldZ: point.z, priority: 52, showDistance: 1.85, resetDistance: 2.22
        });
      });
    }

    // B7.30 — historical year geometry may remain visible for comparison, but
    // year identity/navigation belongs to the fixed year navigator above the
    // sphere. Do not create floating year bubbles for any spiral year.
    const extensionTargets = globalThis.LivingTimeSphereExtensionHost?.semanticTargetsAll?.(
      _extensionContext({
        lifecycle: "semantic-labels",
        calendarDisclosure,
        interactionLite
      })
    ) || [];
    targets.push(...extensionTargets);
    const seen = new Set();
    // B7.9 — never truncate the canonical 364-day rail here. The label
    // manager owns the semantic-card budget and calendar LOD separately.
    // A renderer-level slice cut the rail off around Moon 3/4 on phones,
    // making the surviving 1/7/14/21/28 numerals look randomly clustered.
    return targets.filter(target => {
      const id = String(target?.id || "");
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  function _labelProjectionKey(viewMode) {
    const p = _camera?.position;
    const q = _camera?.quaternion;
    const selected = _model?.selectedPatternPosition || _model?.todayPatternPosition || {};
    const round = value => Math.round(Number(value || 0) * 1000) / 1000;
    return [
      round(p?.x), round(p?.y), round(p?.z),
      round(q?.x), round(q?.y), round(q?.z), round(q?.w),
      selected?.moon || 0, selected?.day || 0,
      _moonLabelMode, _dayLabelMode, viewMode,
      _semanticZoomState?.band || _activeSemanticBand || "medium",
      JSON.stringify(_visibleLayers || {})
    ].join("|");
  }

  // B7.23 — project DOM labels on semantic/camera change, not on every subtle
  // WebGL animation frame. A 500ms safety refresh keeps extension-driven labels
  // current without making the mobile browser continuously lay out 364 labels.
  function _updateMoonLabels(viewMode, nowMs = 0, force = false) {
    if (!_moonLabelManager || !_camera || !_canvas || !_THREE) return;
    // B7.37 — do not freeze the calendar while rotating. That made the old Moon's
    // day numerals look "sticky" until pointer-up. During a gesture we perform a
    // lightweight, throttled projection pass so the camera-facing Moon follows the
    // user's finger; full card/collision work resumes after the gesture settles.
    const stamp = Number(nowMs || globalThis.performance?.now?.() || Date.now());
    const interactionLite = _cameraGestureActive && !force;
    const minInterval = interactionLite ? 96 : 500;
    const key = _labelProjectionKey(viewMode);
    if (!force && stamp - _lastLabelProjectionAt < minInterval) return;
    if (!interactionLite && !force && key === _lastLabelProjectionKey && stamp - _lastLabelProjectionAt < 500) return;
    _lastLabelProjectionKey = key;
    _lastLabelProjectionAt = stamp;
    const calendarDisclosure = _cameraCalendarDisclosure();
    const semanticTargets = _buildSemanticTargets({ calendarDisclosure, interactionLite });
    _moonLabelManager.update({
      camera: _camera,
      three: _THREE,
      anchors: _moonAnchors,
      model: _model,
      labelMode: _moonLabelMode,
      selectedPatternPosition: _model?.selectedPatternPosition || _model?.todayPatternPosition || null,
      showAllMobileLabels: _moonLabelMode === "all",
      dayLabelMode: _dayLabelMode,
      calendarDisclosure,
      selectedMarkerPosition: _objects.selectedDayMarker?.position
        ? { x: _objects.selectedDayMarker.position.x, y: _objects.selectedDayMarker.position.y, z: _objects.selectedDayMarker.position.z }
        : null,
      todayMarkerPosition: _objects.todayMarker?.position
        ? { x: _objects.todayMarker.position.x, y: _objects.todayMarker.position.y, z: _objects.todayMarker.position.z }
        : null,
      viewMode,
      stageEl: _container,
      visibleLayersKey: JSON.stringify(_visibleLayers || {}),
      protectedRects: _moonLabelProtectedRects(),
      semanticTargets: interactionLite
        ? semanticTargets.filter(target =>
            target?.kind === "pattern-day-number"
            || target?.kind === "intercalary-day-number"
          )
        : semanticTargets,
      interactionLite,
      semanticBand:
        _semanticZoomState?.band
        || _activeSemanticBand
        || "medium"
    });
  }

  // ── Scene construction ────────────────────────────────────────────

  function buildScene() {
    const THREE = _THREE;
    const mat   = globalThis.LivingTimeSphereM;
    _countLifecycle("sceneRootBuildCount");
    _scene = new THREE.Scene();
    _scene.background = new THREE.Color(mat.COLORS.bg);

    // ── Pattern Core (geometric, not planet-like) ─────────────────
    {
      // Use icosahedron for a geometric, non-spherical look
      const geo = new THREE.IcosahedronGeometry(mat.SIZES.coreRadius, 0);
      const m   = new THREE.MeshStandardMaterial({
        color:     0xd8e8ff,
        emissive:  mat.COLORS.centerGlow,
        emissiveIntensity: mat.EMISSIVE.center,
        roughness: 0.1,
        metalness: 0.6,
        transparent: true,
        opacity:   mat.OPACITY.center,
        wireframe: false,
      });
      const mesh = new THREE.Mesh(geo, m);
      mesh.name = "core";
      _scene.add(mesh);
      _objects.core = mesh;

      // Two thin accent rings at 90° to each other — NOT equatorial, so not Saturn-like
      const accentMat = new THREE.MeshBasicMaterial({
        color: 0x8ab4ff,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      });
      const r1 = mat.SIZES.coreRadius * 2.2;
      const ring1 = new THREE.Mesh(new THREE.TorusGeometry(r1, 0.003, 6, 32), accentMat.clone());
      ring1.rotation.x = Math.PI / 2;  // XZ plane
      ring1.name = "coreRing1";
      _scene.add(ring1);
      _objects.coreRing1 = ring1;

      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(r1, 0.003, 6, 32), accentMat.clone());
      ring2.rotation.z = Math.PI / 2;  // YZ plane (perpendicular to ring1)
      ring2.name = "coreRing2";
      _scene.add(ring2);
      _objects.coreRing2 = ring2;

      // Core glow
      const glowMesh = globalThis.LivingTimeSphereEffects.buildCoreGlow(THREE);
      _scene.add(glowMesh);
      _objects.coreGlow = glowMesh;
    }

    // ── Pattern ring (XZ plane, radius = SIZES.patternRing) ─────────
    {
      const r   = mat.SIZES.patternRing;
      const geo = new THREE.TorusGeometry(r, mat.SIZES.ringTube, 8, _isMobileWidth() ? 128 : 224);
      const m   = new THREE.MeshStandardMaterial({
        color:       mat.COLORS.patternRing,
        transparent: true,
        opacity:     mat.OPACITY.patternRing,
        roughness:   0.8,
      });
      const mesh = new THREE.Mesh(geo, m);
      mesh.rotation.x = Math.PI / 2;  // lay flat in XZ plane
      mesh.name = "patternRing";
      _scene.add(mesh);
      _objects.patternRing = mesh;
    }

    // ── B7.7 definitive Moon sectors ─────────────────────────────────
    // The old dividers ran from the center to an inner radius, so dense orbital
    // geometry visually swallowed the 13-Moon structure. Boundaries now cross
    // the calendar rail itself, and a segmented outer sector rail makes every
    // Moon's 1..28 territory readable as a distinct arc.
    {
      const ring = mat.SIZES.patternRing;
      const innerR = ring * 0.80;
      const outerR = ring * 1.285;
      const calendarOuterR = Math.max(outerR, ring * 1.355);
      const pts = [];
      for (let i = 0; i < 13; i++) {
        const angle = (i / 13) * 360;
        const a = angleToXZ(angle, innerR);
        const b = angleToXZ(angle, calendarOuterR);
        pts.push(new _THREE.Vector3(a.x, 0.0032, a.z));
        pts.push(new _THREE.Vector3(b.x, 0.0032, b.z));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const m   = new THREE.LineBasicMaterial({
        color:       mat.COLORS.moonStroke,
        transparent: true,
        opacity:     Math.max(mat.OPACITY.moonStroke || 0.4, 0.86),
        depthWrite:  false,
      });
      const lines = new THREE.LineSegments(geo, m);
      lines.name = "moonDividers";
      lines.userData.type = "moon-sector-boundaries";
      _scene.add(lines);
      _objects.moonDividers = lines;

      const arcPts = [];
      const sectorRadius = ring * 1.105;
      const sectorSweep = 360 / 13;
      const gap = sectorSweep * 0.055;
      const subdivisions = 10;
      for (let moon = 0; moon < 13; moon += 1) {
        const start = moon * sectorSweep + gap;
        const end = (moon + 1) * sectorSweep - gap;
        for (let step = 0; step < subdivisions; step += 1) {
          const t0 = step / subdivisions;
          const t1 = (step + 1) / subdivisions;
          const p0 = angleToXZ(start + (end - start) * t0, sectorRadius);
          const p1 = angleToXZ(start + (end - start) * t1, sectorRadius);
          arcPts.push(new _THREE.Vector3(p0.x, 0.0028, p0.z));
          arcPts.push(new _THREE.Vector3(p1.x, 0.0028, p1.z));
        }
      }
      const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPts);
      const arcMat = new THREE.LineBasicMaterial({
        color: mat.COLORS.moonStroke,
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
      });
      const sectorRails = new THREE.LineSegments(arcGeo, arcMat);
      sectorRails.name = "moonSectorRails";
      sectorRails.userData.type = "moon-sector-rails";
      _scene.add(sectorRails);
      _objects.moonSectorRails = sectorRails;

      // B7.10 — a second segmented rail sits directly beneath the number
      // labels. This visually brackets each Moon's 28-day territory without
      // moving any canonical day angle.
      const outerArcPts = [];
      const outerSectorRadius = ring * 1.255;
      for (let moon = 0; moon < 13; moon += 1) {
        const start = moon * sectorSweep + gap;
        const end = (moon + 1) * sectorSweep - gap;
        for (let step = 0; step < subdivisions; step += 1) {
          const t0 = step / subdivisions;
          const t1 = (step + 1) / subdivisions;
          const p0 = angleToXZ(start + (end - start) * t0, outerSectorRadius);
          const p1 = angleToXZ(start + (end - start) * t1, outerSectorRadius);
          outerArcPts.push(new _THREE.Vector3(p0.x, 0.003, p0.z));
          outerArcPts.push(new _THREE.Vector3(p1.x, 0.003, p1.z));
        }
      }
      const outerArcGeo = new THREE.BufferGeometry().setFromPoints(outerArcPts);
      const outerArcMat = new THREE.LineBasicMaterial({
        color: mat.COLORS.moonStroke,
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
      });
      const outerSectorRails = new THREE.LineSegments(outerArcGeo, outerArcMat);
      outerSectorRails.name = "moonOuterSectorRails";
      outerSectorRails.userData.type = "moon-calendar-sector-rails";
      _scene.add(outerSectorRails);
      _objects.moonOuterSectorRails = outerSectorRails;
    }

    // B7.50 — one cheap physical body for each calendar Moon, exactly under
    // its projected label anchor.
    _buildMoonIdentityMarkers();

    // ── B7.19 authoritative readable 13 × 4 × 7 Moon matrix ───────
    // Four week rails and seven weekday columns are the human calendar surface.
    // The canonical 364-day chronology remains underneath for astronomy and
    // historical comparisons; readable numbers/picking use these Moon cells.
    {
      const calendar = globalThis.LivingTimeSphereCalendarGeometry;
      const pts = [];
      const subdivisions = 12;
      for (let moon = 1; moon <= 13; moon += 1) {
        const meta = calendar?.moonAddress?.(moon);
        if (!meta) continue;
        const sectorSweep = 360 / 13;
        const margin = sectorSweep * 0.075;
        const startA = meta.sectorStart + margin;
        const endA = meta.sectorEnd - margin;
        for (let week = 1; week <= 4; week += 1) {
          const sample = calendar?.calendarMatrixCell?.((moon - 1) * 28 + (week - 1) * 7 + 1);
          const r = mat.SIZES.patternRing * Number(sample?.radialFactor || (CALENDAR_RAIL.calendarMatrixWeek1 + (week - 1) * CALENDAR_RAIL.calendarMatrixWeekStep));
          for (let i = 0; i < subdivisions; i += 1) {
            const a0 = startA + (i / subdivisions) * (endA - startA);
            const a1 = startA + ((i + 1) / subdivisions) * (endA - startA);
            const p0 = angleToXZ(a0, r);
            const p1 = angleToXZ(a1, r);
            pts.push(new THREE.Vector3(p0.x, 0.004, p0.z));
            pts.push(new THREE.Vector3(p1.x, 0.004, p1.z));
          }
        }
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const m = new THREE.LineBasicMaterial({
        color: 0x92c7d0,
        transparent: true,
        opacity: _isMobileWidth() ? 0.50 : 0.46,
        depthWrite: false,
      });
      const lines = new THREE.LineSegments(geo, m);
      lines.name = "calendarWeekArcs";
      lines.userData.type = "calendar-polar-week-rails";
      _scene.add(lines);
      _objects.calendarWeekArcs = lines;
    }

    // Seven weekday columns per Moon, shared across all four week lanes.
    {
      const calendar = globalThis.LivingTimeSphereCalendarGeometry;
      const pts = [];
      for (let moon = 1; moon <= 13; moon += 1) {
        const meta = calendar?.moonAddress?.(moon);
        if (!meta) continue;
        const sectorSweep = 360 / 13;
        const margin = sectorSweep * 0.075;
        const usable = sectorSweep - margin * 2;
        const innerR = mat.SIZES.patternRing * (CALENDAR_RAIL.calendarMatrixWeek1 - 0.035);
        const outerR = mat.SIZES.patternRing * (CALENDAR_RAIL.calendarMatrixWeek1 + 3 * CALENDAR_RAIL.calendarMatrixWeekStep + 0.035);
        for (let column = 0; column <= 7; column += 1) {
          const angle = meta.sectorStart + margin + usable * (column / 7);
          const a = angleToXZ(angle, innerR);
          const b = angleToXZ(angle, outerR);
          pts.push(new THREE.Vector3(a.x, 0.003, a.z));
          pts.push(new THREE.Vector3(b.x, 0.003, b.z));
        }
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const m = new THREE.LineBasicMaterial({
        color: 0x78aeb9,
        transparent: true,
        opacity: _isMobileWidth() ? 0.28 : 0.24,
        depthWrite: false,
      });
      const lines = new THREE.LineSegments(geo, m);
      lines.name = "weekDividers";
      lines.userData.type = "calendar-polar-weekday-columns";
      _scene.add(lines);
      _objects.weekDividers = lines;
    }

    // ── Day ticks (364 readable temporal divisions) ──────────────────
    {
      const pts = [];
      const ring = mat.SIZES.patternRing;
      for (let day = 1; day <= 364; day += 1) {
        const angle = globalThis.LivingTimeSphereModel.patternAngleForDayOfYear(day);
        const moonDay = ((day - 1) % 28) + 1;
        const moonBoundary = moonDay === 1;
        const weekBoundary = moonBoundary || moonDay % 7 === 0;
        const innerR = ring * (moonBoundary ? 0.93 : weekBoundary ? 0.952 : 0.97);
        const outerR = ring * (moonBoundary ? CALENDAR_RAIL.moonTickEnd : weekBoundary ? CALENDAR_RAIL.weekTickEnd : CALENDAR_RAIL.dayTickEnd);
        const a = angleToXZ(angle, innerR);
        const b = angleToXZ(angle, outerR);
        pts.push(new THREE.Vector3(a.x, 0.0015, a.z));
        pts.push(new THREE.Vector3(b.x, 0.0015, b.z));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const material = new THREE.LineBasicMaterial({
        color: 0x78aebb,
        transparent: true,
        opacity: _isMobileWidth() ? 0.34 : 0.28,
        depthWrite: false
      });
      const ticks = new THREE.LineSegments(geo, material);
      ticks.name = "dayTicks";
      ticks.userData.type = "living-day-ticks";
      _scene.add(ticks);
      _objects.dayTicks = ticks;
    }

    // ── Day nodes on pattern ring (364 small points) ─────────────────
    {
      const r = mat.SIZES.patternRing;
      const positions = new Float32Array(364 * 3);
      _dayNodeMetadata = [];
      for (let d = 0; d < 364; d++) {
        const dayOfPatternYear = d + 1;
        const angle = globalThis.LivingTimeSphereModel.patternAngleForDayOfYear(dayOfPatternYear);
        const { x, z } = angleToXZ(angle, r);
        positions[d * 3]     = x;
        positions[d * 3 + 1] = 0.001;  // slight Y offset so nodes sit on ring
        positions[d * 3 + 2] = z;
        const meta = globalThis.LivingTimeSphereModel.dayMetadataForDayOfYear(dayOfPatternYear);
        _dayNodeMetadata.push(meta);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      _dayNodeBasePositions = new Float32Array(positions);
      _dayNodeVisibleCount = 364;
      _dayNodeVisibleKey = "";
      const m = new THREE.PointsMaterial({
        color:       mat.COLORS.patternRing,
        size:        _isMobileWidth() ? 0.02 : 0.016,
        transparent: true,
        opacity:     0.7,
        sizeAttenuation: true,
      });
      const pts = new THREE.Points(geo, m);
      pts.name = "dayNodes";
      pts.userData.type = "living-day-cloud";
      _scene.add(pts);
      _objects.dayNodes = pts;
    }

    // ── Shabbat day markers (Moon days 2, 9, 16, 23) ─────────────────
    {
      const r = mat.SIZES.patternRing * 1.01;
      const pts = [];
      for (let moon = 0; moon < 13; moon++) {
        for (let day = 1; day <= 28; day += 1) {
          const dayOfYear = moon * 28 + day;
          const meta = globalThis.LivingTimeSphereModel.dayMetadataForDayOfYear(dayOfYear);
          if (!meta?.shabbatGate) continue;
          const angle = globalThis.LivingTimeSphereModel.dayAngleWithinMoon(moon, day - 1);
          const { x, z } = angleToXZ(angle, r);
          pts.push(new _THREE.Vector3(x, 0.003, z));
        }
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const m = new THREE.PointsMaterial({
        color: 0x7de2d1,
        size: _isMobileWidth() ? 0.03 : 0.024,
        transparent: true,
        opacity: 0.82,
      });
      const markers = new THREE.Points(geo, m);
      markers.name = "shabbatNodes";
      _scene.add(markers);
      _objects.shabbatNodes = markers;
    }

    // ── Equinox Gate marker ─── TETRAHEDRON shape ──────────────────
    {
      const geo = new THREE.TetrahedronGeometry(mat.SIZES.markerDot * 1.4, 0);
      const m   = new THREE.MeshStandardMaterial({
        color:    mat.COLORS.equinox,
        emissive: mat.COLORS.equinox,
        emissiveIntensity: mat.EMISSIVE.equinox,
        roughness: 0.3,
      });
      const mesh = new THREE.Mesh(geo, m);
      mesh.name = "equinoxGate";
      mesh.userData = {
        type: "solar-gate",
        gate: "march-equinox",
      };
      _scene.add(mesh);
      _objects.equinoxGate = mesh;
    }

    // ── Year Gate marker (Moon 1 Day 1 at 0°) ── DIAMOND shape ─────
    {
      const geo = new THREE.OctahedronGeometry(mat.SIZES.markerDot * 1.5, 0);
      const m   = new THREE.MeshStandardMaterial({
        color:    mat.COLORS.yearGate,
        emissive: mat.COLORS.yearGate,
        emissiveIntensity: mat.EMISSIVE.yearGate,
        roughness: 0.3,
      });
      const mesh = new THREE.Mesh(geo, m);
      mesh.name = "yearGate";
      mesh.userData = {
        type: "year-gate",
        gate: "year-gate",
      };
      const { x, z } = angleToXZ(0, mat.SIZES.patternRing);
      mesh.position.set(x, 0, z);
      _scene.add(mesh);
      _objects.yearGate = mesh;
    }

    // ── Today marker (gold, halo, center line) ──────────────────────
    {
      const geo = new THREE.SphereGeometry(mat.SIZES.todayRadius, 12, 12);
      const m   = new THREE.MeshStandardMaterial({
        color:    mat.COLORS.today,
        emissive: mat.COLORS.todayGlow,
        emissiveIntensity: mat.EMISSIVE.today,
        roughness: 0.2,
        metalness: 0.4,
        transparent: true,
        opacity: mat.OPACITY.today,
      });
      const mesh = new THREE.Mesh(geo, m);
      mesh.name = "todayMarker";
      mesh.userData = { type: "living-day", role: "today" };
      mesh.visible = false;
      _scene.add(mesh);
      _objects.todayMarker = mesh;

      const haloGeo = new THREE.TorusGeometry(mat.SIZES.todayHalo, mat.SIZES.todayHaloTube, 8, 64);
      const haloMat = new THREE.MeshStandardMaterial({
        color:    mat.COLORS.todayHalo,
        emissive: mat.COLORS.todayHalo,
        emissiveIntensity: mat.EMISSIVE.todayHalo,
        transparent: true,
        opacity: mat.OPACITY.todayHalo,
        roughness: 0.3,
      });
      const haloMesh = new THREE.Mesh(haloGeo, haloMat);
      haloMesh.rotation.x = Math.PI / 2;
      haloMesh.name = "todayHalo";
      haloMesh.visible = false;
      _scene.add(haloMesh);
      _objects.todayHalo = haloMesh;
    }

    // ── Selected-day marker (separate from today) ────────────────────
    {
      const geo = new THREE.SphereGeometry(mat.SIZES.todayRadius * 1.18, 14, 14);
      const m = new THREE.MeshStandardMaterial({
        color: 0xfff1c2,
        emissive: 0xffe6a3,
        emissiveIntensity: 1.1,
        roughness: 0.28,
        metalness: 0.35,
        transparent: true,
        opacity: 1,
      });
      const mesh = new THREE.Mesh(geo, m);
      mesh.name = "selectedDayMarker";
      mesh.visible = false;
      mesh.userData = { type: "living-day", role: "selected" };
      _scene.add(mesh);
      _objects.selectedDayMarker = mesh;

      const haloGeo = new THREE.TorusGeometry(mat.SIZES.todayHalo * 1.06, mat.SIZES.todayHaloTube * 1.2, 10, 72);
      const haloMat = new THREE.MeshStandardMaterial({
        color: 0xfff4c7,
        emissive: 0xffdc8a,
        emissiveIntensity: 0.9,
        transparent: true,
        opacity: 0.95,
        roughness: 0.3,
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.rotation.x = Math.PI / 2;
      halo.name = "selectedDayHalo";
      halo.visible = false;
      _scene.add(halo);
      _objects.selectedDayHalo = halo;
    }

    // ── Today → center connection line ──────────────────────────────
    _objects.todayLine = null;
    _objects.todayLineGroup = new THREE.Group();
    _objects.todayLineGroup.name = "todayLineGroup";
    _scene.add(_objects.todayLineGroup);

    // ── Passage arc (tube geometry, rebuilt on model change) ─────────
    // Initialized as empty; rebuilt in updateScene()
    _objects.passageArc   = null;
    _objects.passageGroup = new THREE.Group();
    _objects.passageGroup.name = "passageGroup";
    _scene.add(_objects.passageGroup);

    // ── Week Gate markers (4 per moon × 13 = 52) ─────────────────────
    {
      const r = mat.SIZES.patternRing;
      const pts = [];
      for (let m = 0; m < 13; m++) {
        for (let w = 1; w <= 4; w++) {
          const dayOfYear = m * 28 + w * 7;
          const angle = globalThis.LivingTimeSphereModel.patternAngleForDayOfYear(dayOfYear);
          const { x, z } = angleToXZ(angle, r * 1.04);  // slightly outside ring
          pts.push(new _THREE.Vector3(x, 0, z));
        }
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const m   = new THREE.PointsMaterial({
        color:       mat.COLORS.weekGate,
        size:        0.018,
        transparent: true,
        opacity:     0.5,
      });
      const wgPts = new THREE.Points(geo, m);
      wgPts.name = "weekGates";
      _scene.add(wgPts);
      _objects.weekGates = wgPts;
    }

    // ── B7.13 Year Gate bridge ───────────────────────────────────────
    {
      const calendar = globalThis.LivingTimeSphereCalendarGeometry;
      const selectedYear = Number(_selectedYear || _model?.sourceRecord?.year || new Date().getUTCFullYear());
      const gate = calendar?.yearGate?.(selectedYear);
      const innerR = mat.SIZES.patternRing * 1.255;
      const outerR = mat.SIZES.patternRing * CALENDAR_RAIL.yearGateLane;
      const pts = [];
      (gate?.intercalary || [{ angle: 359.35 }]).forEach((slot) => {
        const a = angleToXZ(slot.angle, innerR);
        const b = angleToXZ(slot.angle, outerR);
        pts.push(new THREE.Vector3(a.x, 0.012, a.z));
        pts.push(new THREE.Vector3(b.x, 0.012, b.z));
      });
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const matGate = new THREE.LineBasicMaterial({ color: 0xf0c45a, transparent: true, opacity: 0.88, depthWrite: false });
      const bridge = new THREE.LineSegments(geo, matGate);
      bridge.name = "yearGateIntercalaryBridge";
      bridge.userData.type = "year-gate-intercalary-bridge";
      _scene.add(bridge);
      _objects.yearGateIntercalaryBridge = bridge;
    }

    // ── Intercalary seam markers (outside the 364-day week count) ─────
    {
      const pts = [];
      const innerR = mat.SIZES.patternRing * CALENDAR_RAIL.intercalaryTickStart;
      const outerR = mat.SIZES.patternRing * CALENDAR_RAIL.intercalaryTickEnd;
      [359.72, 0.28].forEach((angle) => {
        const a = angleToXZ(angle, innerR);
        const b = angleToXZ(angle, outerR);
        pts.push(new THREE.Vector3(a.x, 0.004, a.z));
        pts.push(new THREE.Vector3(b.x, 0.004, b.z));
      });
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const m = new THREE.LineBasicMaterial({ color: 0xffd080, transparent: true, opacity: 0.7, depthWrite: false });
      const lines = new THREE.LineSegments(geo, m);
      lines.name = "intercalarySeamTicks";
      lines.userData.type = "intercalary-seam";
      _scene.add(lines);
      _objects.dayOutOfTime = lines;
    }

    // ── Lunar orbit (tilted ring) ────────────────────────────────────
    {
      const r   = mat.SIZES.lunarOrbit;
      const geo = new THREE.TorusGeometry(r, mat.SIZES.ringTube * 0.6, 6, 128);
      const m   = new THREE.MeshBasicMaterial({
        color:       mat.COLORS.lunarRing,
        transparent: true,
        opacity:     mat.OPACITY.lunarRing,
        depthWrite:  false,
      });
      const mesh = new THREE.Mesh(geo, m);
      mesh.rotation.x = Math.PI / 2 + 0.09;  // slight tilt ~5°
      mesh.rotation.z = 0.05;
      mesh.name = "lunarOrbit";
      _scene.add(mesh);
      _objects.lunarOrbit = mesh;
    }

    // ── Lunar marker ─────────────────────────────────────────────────
    {
      const geo = new THREE.SphereGeometry(mat.SIZES.lunarMarker, 12, 12);
      const m   = new THREE.MeshStandardMaterial({
        color:    mat.COLORS.lunar,
        emissive: mat.COLORS.lunar,
        emissiveIntensity: mat.EMISSIVE.lunar,
        roughness: 0.6,
      });
      const mesh = new THREE.Mesh(geo, m);
      mesh.name = "lunarMarker";
      mesh.userData = { type: "lunar-position", role: "today" };
      _scene.add(mesh);
      _objects.lunarMarker = mesh;

      const selectedGeo = new THREE.SphereGeometry(mat.SIZES.lunarMarker * 0.8, 10, 10);
      const selectedMat = new THREE.MeshStandardMaterial({
        color: 0xe1d8ff,
        emissive: 0xc9a9ff,
        emissiveIntensity: 0.58,
        roughness: 0.5,
      });
      const selectedMarker = new THREE.Mesh(selectedGeo, selectedMat);
      selectedMarker.name = "lunarSelectedMarker";
      selectedMarker.visible = false;
      selectedMarker.userData = { type: "lunar-position", role: "selected" };
      _scene.add(selectedMarker);
      _objects.lunarSelectedMarker = selectedMarker;
    }

    // ── Solar axis ───────────────────────────────────────────────────
    {
      const r  = mat.SIZES.solarAxis;
      // Axis line (tilted ~23.5° in XY plane)
      const tilt = 23.5 * Math.PI / 180;
      const pts  = [
        new _THREE.Vector3( r * Math.sin(tilt),  r * Math.cos(tilt), 0),
        new _THREE.Vector3(-r * Math.sin(tilt), -r * Math.cos(tilt), 0),
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const m   = new THREE.LineDashedMaterial({
        color:       mat.COLORS.solar,
        transparent: true,
        opacity:     mat.OPACITY.solar,
        dashSize:    0.05,
        gapSize:     0.03,
        depthWrite:  false,
      });
      const line = new THREE.Line(geo, m);
      line.computeLineDistances();
      line.name = "solarAxis";
      _scene.add(line);
      _objects.solarAxis = line;

      // Conceptual season markers (small points)
      const seasonAngles = [0, 90, 180, 270];   // March Eq, Jun Sol, Sep Eq, Dec Sol
      const labels = ["ME", "JS", "SE", "DS"];
      const sPoints = [];
      for (const a of seasonAngles) {
        const rad = (a * Math.PI) / 180;
        sPoints.push(new _THREE.Vector3(
          r * Math.sin(tilt) * Math.cos(rad) - r * Math.cos(tilt) * Math.sin(rad) * 0,
          r * Math.cos(tilt) * Math.cos(rad),
          r * Math.sin(rad)
        ));
      }
      const sGeo = new THREE.BufferGeometry().setFromPoints(sPoints);
      const sMat = new THREE.PointsMaterial({ color: mat.COLORS.solar, size: 0.035, transparent: true, opacity: 0.55 });
      const seasonPts = new THREE.Points(sGeo, sMat);
      seasonPts.name = "seasonMarkers";
      seasonPts.userData = { type: "solar-anchors", anchors: labels };
      _scene.add(seasonPts);
      _objects.seasonMarkers = seasonPts;

      const selectedGeo = new THREE.SphereGeometry(0.024, 8, 8);
      const selectedMat = new THREE.MeshStandardMaterial({
        color: 0xfff1c2,
        emissive: 0xffd76a,
        emissiveIntensity: 0.7,
        roughness: 0.3,
      });
      const selectedMarker = new THREE.Mesh(selectedGeo, selectedMat);
      selectedMarker.name = "solarSelectedMarker";
      selectedMarker.visible = false;
      selectedMarker.userData = { type: "solar-position", role: "selected" };
      _scene.add(selectedMarker);
      _objects.solarSelectedMarker = selectedMarker;

      const todayGeo = new THREE.SphereGeometry(0.022, 8, 8);
      const todayMat = new THREE.MeshStandardMaterial({
        color: 0xfff59b,
        emissive: 0xffd76a,
        emissiveIntensity: 0.55,
        roughness: 0.36,
      });
      const todayMarker = new THREE.Mesh(todayGeo, todayMat);
      todayMarker.name = "solarTodayMarker";
      todayMarker.visible = false;
      todayMarker.userData = { type: "solar-position", role: "today" };
      _scene.add(todayMarker);
      _objects.solarTodayMarker = todayMarker;

      _objects.solarProgressGroup = new THREE.Group();
      _objects.solarProgressGroup.name = "solarProgressGroup";
      _scene.add(_objects.solarProgressGroup);
    }

    // ── 13-year spiral annual markers ────────────────────────────────
    {
      const group = new THREE.Group();
      group.name = "spiralGroup";
      _objects.spiralGroup  = group;
      _objects.spiralMarkers = [];
      // Markers are created in updateScene() once spiral data is available
      _scene.add(group);
    }

    // ── Spiral path (line through annual markers) ─────────────────────
    _objects.spiralPath = null;  // created in updateScene()

    // ── Recurrence links (disabled on mobile, off by default) ────────
    _objects.recurrenceGroup = new THREE.Group();
    _objects.recurrenceGroup.name = "recurrenceGroup";
    _objects.recurrenceGroup.visible = false;
    _scene.add(_objects.recurrenceGroup);

    _objects.connectionGroup = new THREE.Group();
    _objects.connectionGroup.name = "connectionGroup";
    _scene.add(_objects.connectionGroup);

    // ── Active Moon sector highlight ─────────────────────────────────
    _objects.activeMoonGroup = new THREE.Group();
    _objects.activeMoonGroup.name = "activeMoonGroup";
    _scene.add(_objects.activeMoonGroup);

    // ── Active day node highlight ────────────────────────────────────
    {
      const geo = new THREE.SphereGeometry(0.022, 10, 10);
      const m   = new THREE.MeshStandardMaterial({
        color:    mat.COLORS.today,
        emissive: mat.COLORS.todayGlow,
        emissiveIntensity: 0.8,
        roughness: 0.2,
      });
      const mesh = new THREE.Mesh(geo, m);
      mesh.name = "activeDayNode";
      mesh.visible = false;
      _scene.add(mesh);
      _objects.activeDayNode = mesh;
    }

    // ── Witness constellation (disabled stub) ─────────────────────────
    {
      const wField = globalThis.LivingTimeSphereEffects.buildWitnessField(THREE);
      _scene.add(wField);
      _objects.witnessField = wField;
    }

    // ── Selection ring ───────────────────────────────────────────────
    {
      const ring = globalThis.LivingTimeSphereEffects.buildSelectionRing(THREE);
      _scene.add(ring);
      _objects.selectionRing = ring;
    }

    // ── Atmospheric effects ──────────────────────────────────────────
    {
      const haze  = globalThis.LivingTimeSphereEffects.buildHazeShell(THREE);
      _scene.add(haze);
      _objects.hazeShell = haze;

      const starBudget = _isMobileWidth()
        ? Math.min(Number(_quality?.starCount ?? 150), 56)
        : Number(_quality?.starCount ?? 150);
      const stars = globalThis.LivingTimeSphereEffects.buildStarField(THREE, starBudget);
      _scene.add(stars);
      _objects.starField = stars;
    }

    // ── Lighting ─────────────────────────────────────────────────────
    {
      const ambient = new THREE.AmbientLight(0x1a2030, 1.5);
      _scene.add(ambient);
      _objects.ambientLight = ambient;

      const point = new THREE.PointLight(0xffd080, 1.2, 8, 2);
      point.position.set(0.5, 1.5, 0.5);
      _scene.add(point);
      _objects.pointLight = point;
    }
  }

  // ── Update scene from model data ──────────────────────────────────

  function _temperatureColorHex(valueC) {
    if (!Number.isFinite(valueC)) return 0x95c7ff;
    if (valueC <= 0) return 0x86b7ff;
    if (valueC <= 15) return 0x8fd3ff;
    if (valueC <= 25) return 0xf5cd72;
    if (valueC <= 35) return 0xf1984d;
    return 0xe76448;
  }

  function _num(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function _clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function _normalizedEnvironmentState(input) {
    const normalizer = globalThis.SofEnvironmentState?.normalizeEnvironmentState;
    if (typeof normalizer === "function") return normalizer(input || EMPTY_ENVIRONMENT_STATE);
    const source = input || EMPTY_ENVIRONMENT_STATE;
    return {
      ...EMPTY_ENVIRONMENT_STATE,
      ...source,
      hourly: Array.isArray(source.hourly) ? source.hourly : [],
      daily: source.daily && typeof source.daily === "object" ? source.daily : {},
    };
  }

  function _recordEnvironmentDiagnostic(layer, error) {
    _environmentDiagnostics = [{
      layer,
      message: String(error?.message || error || "unknown-error"),
      at: new Date().toISOString(),
    }, ..._environmentDiagnostics].slice(0, 20);
  }

  function _setEnvironmentObjectVisible(layer, visible) {
    if (layer === "atmosphere") {
      if (_objects.environmentShell) _objects.environmentShell.visible = visible;
      return;
    }
    if (layer === "clouds") {
      if (_objects.environmentCloudBands) _objects.environmentCloudBands.visible = visible;
      return;
    }
    if (layer === "wind") {
      if (_objects.environmentWindVectors) _objects.environmentWindVectors.visible = visible;
      return;
    }
    if (layer === "precipitation") {
      if (_objects.environmentPrecip) _objects.environmentPrecip.visible = visible;
      return;
    }
    if (layer === "temperature") {
      if (_objects.environmentTemperatureArc) _objects.environmentTemperatureArc.visible = visible;
      return;
    }
    if (layer === "pressure") {
      if (_objects.environmentPressureRing) _objects.environmentPressureRing.visible = visible;
      return;
    }
    if (layer === "radiation") {
      if (_objects.environmentTerminator) _objects.environmentTerminator.visible = visible;
      return;
    }
  }

  function _seasonNamesForLatitude(latitude) {
    if (!Number.isFinite(latitude)) return ["Spring", "Summer", "Autumn", "Winter"];
    if (Math.abs(latitude) < 10) return ["Solar Q1", "Solar Q2", "Solar Q3", "Solar Q4"];
    return latitude >= 0
      ? ["Spring", "Summer", "Autumn", "Winter"]
      : ["Autumn", "Winter", "Spring", "Summer"];
  }

  function _seasonColorHex(label) {
    if (/spring/i.test(label)) return 0x79d7a8;
    if (/summer/i.test(label)) return 0xf0cd72;
    if (/autumn|fall/i.test(label)) return 0xd69b62;
    if (/winter/i.test(label)) return 0x8eb8d8;
    return 0x81cbb8;
  }

  function _buildLocationSeasonRing() {
    if (!_THREE || _objects.locationSeasonGroup) return;
    const THREE = _THREE;
    const group = new THREE.Group();
    group.name = "location-season-ring";
    group.visible = false;
    const radius = 1.315;
    const gap = 0.035;
    const sweep = Math.PI / 2 - gap;
    const arcs = [];
    for (let quarter = 0; quarter < 4; quarter += 1) {
      const mesh = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.008, 6, 42, sweep),
        new THREE.MeshBasicMaterial({
          color: 0x81cbb8,
          transparent: true,
          opacity: 0.14,
          depthWrite: false,
        })
      );
      mesh.rotation.x = Math.PI / 2;
      mesh.rotation.z = quarter * Math.PI / 2 + gap / 2;
      mesh.name = `location-season-quarter-${quarter + 1}`;
      mesh.userData = { type: "location-season-quarter", quarter };
      group.add(mesh);
      arcs.push(mesh);
    }
    // B7.31 — four permanent seasonal gates. These are geometry-first
    // equinox/solstice anchors, not floating labels, so they remain readable
    // without competing with day or Moon text.
    const gateLabels = ["March Equinox", "June Solstice", "September Equinox", "December Solstice"];
    const gates = [];
    gateLabels.forEach((label, quarter) => {
      const gate = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.018, 0),
        new THREE.MeshBasicMaterial({ color: 0xc8e8dc, transparent: true, opacity: 0.72, depthWrite: false })
      );
      const gatePos = angleToXZ(quarter * 90, radius);
      gate.position.set(gatePos.x, 0.016, gatePos.z);
      gate.rotation.y = Math.PI / 4;
      gate.name = `location-season-gate-${quarter + 1}`;
      gate.userData = { type: "season-gate", quarter, label };
      group.add(gate);
      gates.push(gate);
    });

    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xf4dc8a, transparent: true, opacity: 0.82, depthWrite: false })
    );
    marker.name = "location-season-selected";
    marker.position.y = 0.015;
    group.add(marker);
    _scene.add(group);
    _objects.locationSeasonGroup = group;
    _objects.locationSeasonArcs = arcs;
    _objects.locationSeasonGates = gates;
    _objects.locationSeasonSelected = marker;
  }

  function _updateLocationSeasonRing(selectedAngle = _selectedSeasonAngle) {
    const snapshot = _normalizedEnvironmentState(_environmentState);
    const latitude = Number(snapshot?.place?.latitude);
    const hasLocation = Number.isFinite(latitude);

    // B7.52 — no location means no seasonal geometry allocation. Previously
    // the full ring was built during startup even when the UI explicitly said
    // “Location required”.
    if (!hasLocation) {
      if (_objects.locationSeasonGroup) _objects.locationSeasonGroup.visible = false;
      return;
    }

    _buildLocationSeasonRing();
    const group = _objects.locationSeasonGroup;
    if (!group) return;
    group.visible = true;
    const names = _seasonNamesForLatitude(latitude);
    const angle = Number.isFinite(Number(selectedAngle)) ? ((Number(selectedAngle) % 360) + 360) % 360 : 0;
    const activeQuarter = Math.floor(angle / 90) % 4;
    (_objects.locationSeasonArcs || []).forEach((arc, quarter) => {
      const name = names[quarter] || `Quarter ${quarter + 1}`;
      arc.material.color.setHex(_seasonColorHex(name));
      arc.material.opacity = quarter === activeQuarter ? 0.42 : 0.13;
      arc.scale.setScalar(quarter === activeQuarter ? 1.008 : 1);
      arc.userData = {
        ...(arc.userData || {}),
        label: name,
        latitude,
        hemisphere: Math.abs(latitude) < 10 ? "equatorial" : latitude > 0 ? "northern" : "southern",
        active: quarter === activeQuarter,
      };
    });
    const astronomicalGates = ["March Equinox", "June Solstice", "September Equinox", "December Solstice"];
    (_objects.locationSeasonGates || []).forEach((gate, quarter) => {
      gate.material.opacity = quarter === ((activeQuarter + 1) % 4) ? 0.95 : 0.5;
      gate.scale.setScalar(quarter === ((activeQuarter + 1) % 4) ? 1.32 : 1);
      gate.userData = {
        ...(gate.userData || {}),
        type: "season-gate",
        label: astronomicalGates[quarter],
        seasonAfterGate: names[quarter],
        latitude,
        next: quarter === ((activeQuarter + 1) % 4),
      };
    });
    if (_objects.locationSeasonSelected) {
      const pos = angleToXZ(angle, 1.315);
      _objects.locationSeasonSelected.position.set(pos.x, 0.018, pos.z);
      _objects.locationSeasonSelected.userData = {
        type: "location-season-selected",
        season: names[activeQuarter],
        latitude,
        angle,
      };
    }
  }

  // B7.27 — instrument context rails. These are geometry-first overlays:
  // they never create floating labels and therefore cannot compete with the
  // 13×28 calendar text surface.
  function _patternDateForDay(year, patternDay) {
    try {
      const epoch = globalThis.PatternCalendar?.epochForYear?.(Number(year));
      if (epoch instanceof Date && !Number.isNaN(epoch.getTime())) {
        return new Date(epoch.getTime() + (Math.max(1, Math.min(364, Number(patternDay) || 1)) - 1) * 86400000);
      }
    } catch (_) {}
    const d = new Date(Date.UTC(Number(year) || new Date().getUTCFullYear(), 3, 17));
    d.setUTCDate(d.getUTCDate() + Math.max(0, (Number(patternDay) || 1) - 1));
    return d;
  }

  function _daylightHours(latitude, date) {
    const lat = Number(latitude);
    if (!Number.isFinite(lat) || !(date instanceof Date)) return null;
    const start = Date.UTC(date.getUTCFullYear(), 0, 0);
    const doy = Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start) / 86400000);
    const phi = lat * Math.PI / 180;
    const decl = (23.44 * Math.PI / 180) * Math.sin((2 * Math.PI / 365) * (doy - 80));
    const x = -Math.tan(phi) * Math.tan(decl);
    if (x <= -1) return 24;
    if (x >= 1) return 0;
    return (24 / Math.PI) * Math.acos(x);
  }

  function _buildTodayCompass() {
    if (!_THREE || !_scene || _objects.todayCompassGroup) return;
    const THREE = _THREE;
    const group = new THREE.Group();
    group.name = "today-compass";
    const material = new THREE.LineBasicMaterial({ color: 0xf0d46d, transparent: true, opacity: 0.64, depthWrite: false });
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const line = new THREE.Line(geo, material);
    line.name = "today-compass-ray";
    group.add(line);
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.017, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xf5dd7f, transparent: true, opacity: 0.9, depthWrite: false })
    );
    cap.name = "today-compass-cap";
    group.add(cap);
    _scene.add(group);
    _objects.todayCompassGroup = group;
    _objects.todayCompassLine = line;
    _objects.todayCompassCap = cap;
  }

  function _updateTodayCompass() {
    _buildTodayCompass();
    const day = Number(_model?.todayPatternPosition?.dayOfPatternYear);
    if (!_objects.todayCompassGroup || !Number.isFinite(day)) return;
    const ring = globalThis.LivingTimeSphereM?.SIZES?.patternRing || 1;
    const angle = globalThis.LivingTimeSphereModel?.patternAngleForDayOfYear?.(day) ?? ((day - 1) / 364) * 360;
    const a = angleToXZ(angle, ring * 0.18);
    const b = angleToXZ(angle, ring * 1.72);
    const attr = _objects.todayCompassLine.geometry.getAttribute("position");
    attr.setXYZ(0, a.x, 0.012, a.z);
    attr.setXYZ(1, b.x, 0.012, b.z);
    attr.needsUpdate = true;
    _objects.todayCompassCap.position.set(b.x, 0.015, b.z);
    _objects.todayCompassGroup.visible = !!_visibleLayers?.pattern;
  }

  function _buildScheduleDensityRail() {
    if (!_THREE || !_scene) return;
    const summaryFn = globalThis.LifeAtlasRecordSphereExtension?.plannerDaySummary;
    if (typeof summaryFn !== "function") return;
    const THREE = _THREE;
    const year = Number(_selectedYear || _model?.year || new Date().getFullYear());
    const now = Date.now();
    const nextKey = String(year);
    if (_objects.scheduleDensityRail && _scheduleDensityKey === nextKey && now - _scheduleDensityBuiltAt < 1600) return;
    if (_objects.scheduleDensityRail) {
      _objects.scheduleDensityRail.geometry?.dispose?.();
      _scene.remove(_objects.scheduleDensityRail);
      _objects.scheduleDensityRail = null;
    }
    _scheduleDensityKey = nextKey;
    _scheduleDensityBuiltAt = now;
    const ring = globalThis.LivingTimeSphereM?.SIZES?.patternRing || 1;
    const calendar = globalThis.LivingTimeSphereCalendarGeometry;
    const pts = [];
    let occupied = 0;
    for (let day = 1; day <= 364; day += 1) {
      const count = Math.max(0, Number(summaryFn(year, day)?.count) || 0);
      if (!count) continue;
      occupied += 1;
      const cell = calendar?.calendarCell?.(day);
      const angle = Number(cell?.angle ?? globalThis.LivingTimeSphereModel?.patternAngleForDayOfYear?.(day));
      if (!Number.isFinite(angle)) continue;
      // B7.34: occupancy is drawn immediately beside the readable day cell,
      // not on one detached annual ring. This makes the activity mark read as
      // part of that exact day across all four week lanes.
      const radialFactor = Number(cell?.radialFactor || 1.32);
      const endR = ring * (radialFactor - 0.050);
      const baseR = endR - ring * Math.min(0.052, 0.015 + Math.log2(count + 1) * 0.010);
      const a = angleToXZ(angle, baseR);
      const b = angleToXZ(angle, endR);
      pts.push(new THREE.Vector3(a.x, 0.008, a.z), new THREE.Vector3(b.x, 0.008, b.z));
    }
    if (!pts.length) return;
    const rail = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0xe7c56b, transparent: true, opacity: 0.72, depthWrite: false })
    );
    rail.name = "schedule-density-rail";
    rail.userData = { type: "schedule-density-rail", year, occupiedDays: occupied };
    _scene.add(rail);
    _objects.scheduleDensityRail = rail;
  }

  function _buildDaylightCurve() {
    if (!_THREE || !_scene) return;
    const snapshot = _normalizedEnvironmentState(_environmentState);
    const latitude = Number(snapshot?.place?.latitude);
    if (!Number.isFinite(latitude)) return;
    const THREE = _THREE;
    const year = Number(_selectedYear || _model?.year || new Date().getFullYear());
    const nextKey = `${year}:${latitude.toFixed(4)}`;
    if (_objects.daylightCurve && _daylightCurveKey === nextKey) return;
    if (_objects.daylightCurve) {
      _objects.daylightCurve.geometry?.dispose?.();
      _scene.remove(_objects.daylightCurve);
      _objects.daylightCurve = null;
    }
    _daylightCurveKey = nextKey;
    const ring = globalThis.LivingTimeSphereM?.SIZES?.patternRing || 1;
    const pts = [];
    const samples = 104;
    for (let i = 0; i <= samples; i += 1) {
      const day = Math.max(1, Math.min(364, Math.round(1 + (i / samples) * 363)));
      const date = _patternDateForDay(year, day);
      const hours = _daylightHours(latitude, date);
      const angle = globalThis.LivingTimeSphereModel?.patternAngleForDayOfYear?.(day) ?? ((day - 1) / 364) * 360;
      const radius = ring * (1.745 + ((Number(hours) || 12) - 12) * 0.0085);
      const p = angleToXZ(angle, radius);
      pts.push(new THREE.Vector3(p.x, 0.006, p.z));
    }
    const curve = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0x8fcad0, transparent: true, opacity: 0.38, depthWrite: false })
    );
    curve.name = "location-daylight-annual-curve";
    curve.userData = { type: "daylight-annual-curve", latitude, year, approximation: true };
    _scene.add(curve);
    _objects.daylightCurve = curve;
  }

  const PLANETARY_RAIL_FACTOR = 1.66;

  function _makePlanetGlyphSprite(planet) {
    if (!_THREE || typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 96;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.clearRect(0, 0, 96, 96);
    ctx.beginPath();
    ctx.arc(48, 48, 38, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(5, 15, 28, 0.88)";
    ctx.fill();
    ctx.strokeStyle = "rgba(200, 222, 255, 0.92)";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = "rgba(242, 248, 255, 0.98)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "600 50px serif";
    ctx.fillText(String(planet?.glyph || "•"), 48, 49);
    const texture = new _THREE.CanvasTexture(canvas);
    texture.minFilter = _THREE.LinearFilter;
    texture.magFilter = _THREE.LinearFilter;
    const sprite = new _THREE.Sprite(new _THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      opacity: 0.96,
    }));
    sprite.scale.set(0.078, 0.078, 0.078);
    sprite.position.set(0, 0.060, 0);
    sprite.renderOrder = 40;
    sprite.userData = { type: "planet-glyph", planetId: planet?.id, texture };
    return sprite;
  }

  function _buildPlanetaryRail() {
    if (!_THREE || !_scene || _objects.planetaryGroup) return;
    const THREE = _THREE;
    const group = new THREE.Group();
    group.name = "planetary-ecliptic-layer";

    const ring = globalThis.LivingTimeSphereM?.SIZES?.patternRing || 1;
    const radius = ring * PLANETARY_RAIL_FACTOR;
    const rail = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.0065, 6, 220),
      new THREE.MeshBasicMaterial({ color: 0xaec7ea, transparent: true, opacity: 0.30, depthWrite: false })
    );
    rail.rotation.x = Math.PI / 2;
    rail.name = "planetary-ecliptic-rail";
    rail.userData = { type: "planetary-ecliptic-rail", approximate: true };
    group.add(rail);

    const markerDefs = globalThis.LivingTimePlanetaryPositions?.planets || [];
    const markers = [];
    markerDefs.forEach((planet, index) => {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(Math.min(Math.max(Number(planet.size) || 0.016, 0.017), 0.022), 9, 9),
        new THREE.MeshStandardMaterial({
          color: 0xe2ecff,
          emissive: 0x9bbcff,
          emissiveIntensity: 0.88,
          roughness: 0.28,
          metalness: 0.12,
          transparent: true,
          opacity: 0.98,
          depthWrite: false,
        })
      );
      marker.name = `planet-${planet.id}`;
      marker.userData = { type: "planet", planetId: planet.id, name: planet.name, glyph: planet.glyph, index };

      // A quiet always-visible symbol distinguishes the seven planets without
      // requiring seven full text cards. Text remains proximity-driven.
      const glyph = _makePlanetGlyphSprite(planet);
      if (glyph) marker.add(glyph);

      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.030, 0.0020, 4, 18),
        new THREE.MeshBasicMaterial({ color: 0xb9d4ff, transparent: true, opacity: 0.56, depthWrite: false })
      );
      halo.rotation.x = Math.PI / 2;
      halo.userData = { type: "planet-halo", planetId: planet.id };
      marker.add(halo);

      group.add(marker);
      markers.push(marker);
    });

    _scene.add(group);
    _objects.planetaryGroup = group;
    _objects.planetaryRail = rail;
    _objects.planetMarkers = markers;
  }

  function _updatePlanetaryRail() {
    const enabled = _visibleLayers?.planets !== false;
    if (!enabled) {
      if (_objects.planetaryGroup) _objects.planetaryGroup.visible = false;
      return;
    }
    _buildPlanetaryRail();
    const group = _objects.planetaryGroup;
    if (!group) return;
    group.visible = true;

    const selected = _model?.selectedPatternPosition || _model?.todayPatternPosition || null;
    const year = Number(_selectedYear || _model?.year || new Date().getUTCFullYear());
    const day = Number(selected?.dayOfPatternYear || 1);
    const date = _patternDateForDay(year, day);
    const key = `${date.toISOString().slice(0, 10)}:${globalThis.__EPHEMERIS__ ? "override" : "approx"}`;
    if (_planetaryKey === key) return;
    _planetaryKey = key;

    const placements = globalThis.LivingTimePlanetaryPositions?.calculate?.(date) || [];
    const byId = new Map(placements.map(item => [item.id, item]));
    const ring = globalThis.LivingTimeSphereM?.SIZES?.patternRing || 1;
    const radius = ring * PLANETARY_RAIL_FACTOR;
    (_objects.planetMarkers || []).forEach((marker, index) => {
      const placement = byId.get(marker.userData?.planetId);
      marker.visible = !!placement;
      if (!placement) return;
      const p = angleToXZ(Number(placement.longitude) || 0, radius);
      const latitude = Math.max(-12, Math.min(12, Number(placement.latitude) || 0));
      // Ecliptic latitude is expressed as a small vertical displacement while
      // longitude remains exact on the shared outer rail.
      marker.position.set(p.x, Math.sin(latitude * Math.PI / 180) * ring * 0.22 + 0.012, p.z);
      marker.userData = {
        ...marker.userData,
        longitude: placement.longitude,
        latitude: placement.latitude,
        distanceAu: placement.distance,
        source: placement.source,
        date: placement.date,
        approximate: placement.source !== "ephemeris-override",
      };
    });
  }


  // B7.42 — staged instrument boot.
  // Calendar/Today geometry wins the first-paint race. Dense contextual
  // rails hydrate once the browser has breathing room.
  let _contextRailsReady = false;
  let _contextRailsScheduled = false;

  function _hydrateDeferredContextRails() {
    if (_contextRailsReady || _contextRailsScheduled) return;

    _contextRailsScheduled = true;

    const hydrate = () => {
      _contextRailsScheduled = false;

      if (!_scene || !_initialized) {
        return;
      }

      _contextRailsReady = true;

      _buildScheduleDensityRail();
      _buildDaylightCurve();
      _updatePlanetaryRail();

      globalThis.LivingTimeSphereAnimation?.markDirty?.();
    };

    if (typeof globalThis.requestIdleCallback === "function") {
      globalThis.requestIdleCallback(
        hydrate,
        { timeout: 420 }
      );
    } else {
      setTimeout(hydrate, 140);
    }
  }

  function _updateInstrumentContextRails() {
    _updateTodayCompass();

    if (!_contextRailsReady) {
      _hydrateDeferredContextRails();
      return;
    }

    _buildScheduleDensityRail();
    _buildDaylightCurve();
    _updatePlanetaryRail();
  }


  function _buildEnvironmentLayerObjects() {
    if (!_THREE || _objects.environmentGroup) return;
    const THREE = _THREE;
    const group = new THREE.Group();
    group.name = "environmentGroup";
    group.visible = false;

    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(1.18, 44, 44),
      new THREE.MeshBasicMaterial({
        color: 0x8fd3ff,
        transparent: true,
        opacity: 0.04,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    shell.name = "environment-shell";
    group.add(shell);

    const cloudBands = new THREE.Group();
    [-0.18, 0, 0.18].forEach((y, index) => {
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(1.14 + index * 0.015, 0.014, 10, 96),
        new THREE.MeshBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.04, depthWrite: false })
      );
      band.rotation.x = Math.PI / 2;
      band.position.y = y;
      cloudBands.add(band);
    });
    cloudBands.name = "environment-cloud-bands";
    group.add(cloudBands);

    const windGroup = new THREE.Group();
    for (let i = 0; i < 8; i += 1) {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0.86, -0.12 + i * 0.035, 0),
        new THREE.Vector3(1.1, -0.12 + i * 0.035, 0)
      ]);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xa7f3d0, transparent: true, opacity: 0.56 }));
      windGroup.add(line);
    }
    windGroup.name = "environment-wind-vectors";
    group.add(windGroup);

    const tempArc = new THREE.Mesh(
      new THREE.TorusGeometry(1.08, 0.018, 12, 120, Math.PI * 1.15),
      new THREE.MeshBasicMaterial({ color: 0xf5cd72, transparent: true, opacity: 0.44, depthWrite: false })
    );
    tempArc.name = "environment-temperature-arc";
    tempArc.rotation.x = Math.PI / 2;
    tempArc.rotation.z = Math.PI * 0.25;
    group.add(tempArc);

    const pressureRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.03, 0.008, 10, 96),
      new THREE.MeshBasicMaterial({ color: 0x9dc1ff, transparent: true, opacity: 0.34, depthWrite: false })
    );
    pressureRing.rotation.x = Math.PI / 2;
    pressureRing.name = "environment-pressure-ring";
    group.add(pressureRing);

    const precip = new THREE.Mesh(
      new THREE.SphereGeometry(1.16, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0x84d8ff, transparent: true, opacity: 0.025, wireframe: true, depthWrite: false })
    );
    precip.name = "environment-precip-particles";
    group.add(precip);

    const terminator = new THREE.Mesh(
      new THREE.TorusGeometry(1.0, 0.004, 8, 120),
      new THREE.MeshBasicMaterial({ color: 0xffd47a, transparent: true, opacity: 0.36, depthWrite: false })
    );
    terminator.rotation.x = Math.PI / 2;
    terminator.name = "environment-day-night-terminator";
    group.add(terminator);

    _scene.add(group);
    _objects.environmentGroup = group;
    _objects.environmentShell = shell;
    _objects.environmentCloudBands = cloudBands;
    _objects.environmentWindVectors = windGroup;
    _objects.environmentTemperatureArc = tempArc;
    _objects.environmentPressureRing = pressureRing;
    _objects.environmentPrecip = precip;
    _objects.environmentTerminator = terminator;
  }

  function _runEnvironmentLayer(layer, fn) {
    if (_environmentLayerEnabled[layer] === false) return;
    try {
      fn();
      _setEnvironmentObjectVisible(layer, true);
    } catch (error) {
      _environmentLayerEnabled[layer] = false;
      _setEnvironmentObjectVisible(layer, false);
      _recordEnvironmentDiagnostic(layer, error);
    }
  }

  function _applyEnvironmentState() {
    const snapshot = _normalizedEnvironmentState(_environmentState);
    const current = snapshot?.current || null;
    const hourly = snapshot?.hourly || [];
    const daily = snapshot?.daily || {};
    const hasData = !!(_environmentLayerVisible && snapshot && current);

    // B7.52 — environment is truly demand-built. The old path allocated a
    // 44×44 shell, three 96-segment cloud tori, wind vectors and multiple
    // additional meshes even when no weather/location data existed.
    if (!hasData) {
      if (_objects.environmentGroup) _objects.environmentGroup.visible = false;
      return;
    }

    _buildEnvironmentLayerObjects();
    if (!_objects.environmentGroup) return;
    _objects.environmentGroup.visible = true;

    const cloud = _clamp(_num(current.cloudCover ?? current.cloud_cover, 0), 0, 100);
    const humidity = _clamp(_num(current.humidity ?? current.relative_humidity_2m, 0), 0, 100);
    const windSpeed = Math.max(0, _num(current.windSpeed ?? current.wind_speed_10m, 0));
    const windDirection = _num(current.windDirection ?? current.wind_direction_10m, 0);
    const gusts = Math.max(0, _num(current.windGust ?? current.wind_gusts_10m, windSpeed));
    const precipitation = Math.max(0, _num(current.precipitation, 0));
    const pressure = _num(current.pressure ?? current.pressure_msl, 1013);
    const shortwave = Math.max(0, _num(current.solarRadiation ?? current.shortwave_radiation, 0));
    const tempC = _num(current.temperature ?? current.temperature_2m, 0);

    _runEnvironmentLayer("atmosphere", () => {
      _objects.environmentShell.material.opacity = 0.06 + (cloud / 100) * 0.24 + (humidity / 100) * 0.16;
    });

    _runEnvironmentLayer("clouds", () => {
      const low = _num(hourly?.cloud_cover_low?.[0], cloud);
      const mid = _num(hourly?.cloud_cover_mid?.[0], cloud);
      const high = _num(hourly?.cloud_cover_high?.[0], cloud);
      const bands = _objects.environmentCloudBands?.children || [];
      [low, mid, high].forEach((value, index) => {
        const band = bands[index];
        if (!band) return;
        band.material.opacity = 0.04 + _clamp(value, 0, 100) / 100 * 0.42;
      });
    });

    _runEnvironmentLayer("wind", () => {
      _objects.environmentWindVectors.rotation.y = (windDirection * Math.PI) / 180;
      const windScale = 0.8 + Math.min(2.2, windSpeed / 12);
      _objects.environmentWindVectors.scale.set(windScale, 1, 1 + Math.min(1.8, gusts / 22));
    });

    _runEnvironmentLayer("temperature", () => {
      _objects.environmentTemperatureArc.material.color.setHex(_temperatureColorHex(tempC));
      _objects.environmentTemperatureArc.material.opacity = 0.36 + Math.min(0.46, Math.abs(tempC - 16) / 40);
    });

    _runEnvironmentLayer("pressure", () => {
      _objects.environmentPressureRing.scale.setScalar(1 + _clamp((pressure - 1013) / 500, -0.05, 0.05));
      _objects.environmentPressureRing.material.opacity = 0.42 + Math.min(0.32, Math.abs(pressure - 1013) / 45);
    });

    _runEnvironmentLayer("precipitation", () => {
      _objects.environmentPrecip.material.opacity = 0.02 + Math.min(0.32, precipitation / 6);
    });

    _runEnvironmentLayer("radiation", () => {
      const dayStart = daily?.sunrise ? new Date(daily.sunrise).getTime() : NaN;
      const dayEnd = daily?.sunset ? new Date(daily.sunset).getTime() : NaN;
      let dayAngle = 0;
      if (Number.isFinite(dayStart) && Number.isFinite(dayEnd) && dayEnd > dayStart) {
        const progress = _clamp((Date.now() - dayStart) / (dayEnd - dayStart), 0, 1);
        dayAngle = progress * Math.PI * 2;
      }
      _objects.environmentTerminator.rotation.z = dayAngle;
      if (_objects.pointLight) _objects.pointLight.intensity = 0.85 + Math.min(1.35, shortwave / 360);
      if (_objects.hazeShell) _objects.hazeShell.material.opacity = Math.max(_objects.hazeShell.material.opacity, 0.08 + Math.min(0.28, shortwave / 1200));
    });

    _runEnvironmentLayer("airQuality", () => {});
    _runEnvironmentLayer("spaceWeather", () => {});
  }

  const _environmentController = {
    initialize(environmentState) {
      Object.keys(_environmentLayerEnabled).forEach(layer => {
        _environmentLayerEnabled[layer] = true;
      });
      _environmentState = _normalizedEnvironmentState(environmentState || EMPTY_ENVIRONMENT_STATE);
      _environmentDiagnostics = [];
      _applyEnvironmentState();
      _updateLocationSeasonRing(_selectedSeasonAngle);
    },
    update(environmentState) {
      _environmentState = _normalizedEnvironmentState(environmentState || EMPTY_ENVIRONMENT_STATE);
      _applyEnvironmentState();
      _updateLocationSeasonRing(_selectedSeasonAngle);
    },
    setLayerVisibility(layerName, visible) {
      if (layerName === "environment") {
        _environmentLayerVisible = !!visible;
      } else if (Object.prototype.hasOwnProperty.call(_environmentLayerEnabled, layerName)) {
        _environmentLayerEnabled[layerName] = !!visible;
      }
      _applyEnvironmentState();
    },
    dispose() {
      _environmentState = EMPTY_ENVIRONMENT_STATE;
      _environmentLayerVisible = true;
      _environmentDiagnostics = [];
      Object.keys(_environmentLayerEnabled).forEach(layer => {
        _environmentLayerEnabled[layer] = true;
      });
      if (_objects.environmentGroup) _objects.environmentGroup.visible = false;
    },
    diagnostics() {
      return {
        layerEnabled: { ..._environmentLayerEnabled },
        issues: _environmentDiagnostics.slice(0),
      };
    },
  };

  function buildPassageTube(startAngle, endAngle) {
    if (!_THREE) return null;
    const THREE = _THREE;
    const mat   = globalThis.LivingTimeSphereM;
    const r     = mat.SIZES.passageArc;

    let sweep = endAngle - startAngle;
    if (sweep <= 0) sweep += 360;
    if (sweep > 360) sweep = 360;

    const steps = Math.max(Math.round(sweep * 1.5), 12);
    const pts   = [];
    for (let i = 0; i <= steps; i++) {
      const angle = startAngle + (i / steps) * sweep;
      const { x, z } = angleToXZ(angle, r);
      pts.push(new THREE.Vector3(x, 0, z));
    }

    // Close gap cleanly
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    const geo   = new THREE.TubeGeometry(curve, steps * 2, mat.SIZES.tubeRadius * 1.5, 6, false);
    const m     = new THREE.MeshStandardMaterial({
      color:     mat.COLORS.passage,
      emissive:  mat.COLORS.passageGlow,
      emissiveIntensity: mat.EMISSIVE.passage,
      transparent: true,
      opacity:   mat.OPACITY.passage,
      roughness: 0.5,
    });
    return new THREE.Mesh(geo, m);
  }

  function buildSolarProgressArc(startAngle, endAngle) {
    if (!_THREE) return null;
    const THREE = _THREE;
    const mat = globalThis.LivingTimeSphereM;
    const r = mat.SIZES.solarAxis;
    let sweep = endAngle - startAngle;
    if (sweep < 0) sweep += 360;
    const steps = Math.max(16, Math.round(Math.abs(sweep)));
    const tilt = 23.5 * Math.PI / 180;
    const pts = [];
    for (let i = 0; i <= steps; i += 1) {
      const angle = startAngle + (i / steps) * sweep;
      const rad = (angle * Math.PI) / 180;
      pts.push(new THREE.Vector3(
        r * Math.sin(tilt) * Math.cos(rad),
        r * Math.cos(tilt) * Math.cos(rad),
        r * Math.sin(rad)
      ));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    return new THREE.Line(geo, new THREE.LineDashedMaterial({
      color: 0xffe7a8,
      transparent: true,
      opacity: 0.7,
      dashSize: 0.03,
      gapSize: 0.02,
      depthWrite: false,
    }));
  }

  function buildSpiralPath(spiralYears) {
    if (!_THREE || !spiralYears?.length) return null;
    const THREE = _THREE;
    const mat   = globalThis.LivingTimeSphereM;

    const pts = spiralYears.map(y => {
      const r = mat.SIZES.spiralInner + (mat.SIZES.spiralOuter - mat.SIZES.spiralInner) * y.yearSpiralRadius;
      const { x, z } = angleToXZ(y.yearSpiralAngle % 360, r);
      // Lift each year slightly in Y to create a true 3D spiral
      const yOff = (y.yearSpiralRadius - 0.5) * 0.25;
      return new THREE.Vector3(x, yOff, z);
    });
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const m   = new THREE.LineBasicMaterial({
      color:       mat.COLORS.spiral,
      transparent: true,
      opacity:     mat.OPACITY.spiral,
      depthWrite:  false,
    });
    return new THREE.Line(geo, m);
  }

  function _focusFromAngle(angleDeg, radius, mode) {
    const { x, z } = angleToXZ(angleDeg, radius);
    const theta = Math.atan2(x, z);
    const targetScale = mode === "today" ? 0.32 : mode === "pattern" ? 0.18 : 0.12;
    return {
      theta,
      target: {
        x: x * targetScale,
        y: mode === "years" ? 0.04 : 0,
        z: z * targetScale,
      },
    };
  }

  function _resolveCameraFocus(model, spiral, viewMode, selectedYear) {
    const mat = globalThis.LivingTimeSphereM;
    const selected = model?.selectedPatternPosition || model?.todayPatternPosition || null;
    if (viewMode === "years") {
      const match = spiral?.years?.find(year => year.year === selectedYear);
      if (match) {
        const r = mat.SIZES.spiralInner + (mat.SIZES.spiralOuter - mat.SIZES.spiralInner) * match.yearSpiralRadius;
        const focus = _focusFromAngle(match.yearSpiralAngle % 360, r, "years");
        focus.target.y = (match.yearSpiralRadius - 0.5) * 0.18;
        return focus;
      }
      return null;
    }

    if (viewMode === "passage" && model?.passage) {
      let sweep = model.passage.endAngle - model.passage.startAngle;
      if (sweep <= 0) sweep += 360;
      const midAngle = (model.passage.startAngle + sweep / 2) % 360;
      return _focusFromAngle(midAngle, mat.SIZES.passageArc, "passage");
    }

    const dayAngle = selected?.dayOfPatternYear != null
      ? globalThis.LivingTimeSphereModel.patternAngleForDayOfYear(selected.dayOfPatternYear)
      : (model?.currentPatternAngle ?? model?.patternAngle ?? 0);
    return _focusFromAngle(dayAngle, mat.SIZES.patternRing, viewMode);
  }

  function _syncCameraFocus(model, spiral, selectedYear, animated) {
    const focus = _resolveCameraFocus(model, spiral, _viewMode, selectedYear);
    const focusKey = JSON.stringify({
      mode: _viewMode,
      year: selectedYear,
      theta: focus?.theta != null ? Number(focus.theta.toFixed(4)) : null,
      x: focus?.target?.x != null ? Number(focus.target.x.toFixed(4)) : null,
      y: focus?.target?.y != null ? Number(focus.target.y.toFixed(4)) : null,
      z: focus?.target?.z != null ? Number(focus.target.z.toFixed(4)) : null,
    });
    if (focusKey === _lastCameraFocusKey) return;
    _lastCameraFocusKey = focusKey;
    globalThis.LivingTimeSphereCamera.setMode(_viewMode, performance.now(), animated !== false, focus || undefined);
  }

  function _applySemanticVisibility(vl, semanticState) {
    const band = semanticState?.band || "medium";
    const semanticVisibility = semanticState?.visibility || {};
    if (_objects.dayNodes) _objects.dayNodes.visible = !!vl.pattern && vl.exactDays !== false && semanticVisibility.exactDays !== false;
    if (_objects.dayTicks) {
      _objects.dayTicks.visible = !!vl.pattern && vl.exactDays !== false;
      if (_objects.dayTicks.material) {
        _objects.dayTicks.material.opacity = band === "far" ? 0.30 : band === "medium" ? 0.52 : band === "near" ? 0.68 : 0.82;
      }
    }
    if (_objects.shabbatNodes) _objects.shabbatNodes.visible = !!vl.pattern && band !== "far";
    if (_objects.weekGates) _objects.weekGates.visible = !!vl.pattern && vl.weekGates !== false && semanticVisibility.weekGates !== false;
    if (_objects.weekDividers) _objects.weekDividers.visible = !!vl.pattern && vl.weekGates !== false && semanticVisibility.weekGates !== false;
    if (_objects.calendarWeekArcs) _objects.calendarWeekArcs.visible = !!vl.pattern;
    if (_objects.yearGateIntercalaryBridge) _objects.yearGateIntercalaryBridge.visible = !!vl.pattern;
    if (_objects.dayNodes?.material && semanticState?.dayNodeOpacity != null) {
      _objects.dayNodes.material.opacity = semanticState.dayNodeOpacity;
    }
    if (_objects.solarTodayMarker && band === "far") _objects.solarTodayMarker.visible = false;
    if (_objects.solarSelectedMarker && band === "far") _objects.solarSelectedMarker.visible = false;
    if (_objects.lunarSelectedMarker && band === "far") _objects.lunarSelectedMarker.visible = false;
  }

  function _syncSemanticZoomFromCamera(force = false) {
    const next = _resolveSemanticZoomFromCamera();
    if (!next) return false;
    _lastSemanticDistance = next.distance ?? null;
    _lastSemanticSourceType = next.sourceType || "unknown";
    const changed = force
      || !_semanticZoomState
      || next.band !== _semanticZoomState.band
      || next.dayLabelMode !== _semanticZoomState.dayLabelMode
      || next.moonLabelMode !== _semanticZoomState.moonLabelMode
      || next.maxConnections !== _semanticZoomState.maxConnections
      || next.dayNodeOpacity !== _semanticZoomState.dayNodeOpacity
      || !!next.visibility?.exactDays !== !!_semanticZoomState.visibility?.exactDays
      || !!next.visibility?.weekGates !== !!_semanticZoomState.visibility?.weekGates;
    if (!changed) return false;
    _previousSemanticBand = _activeSemanticBand || _semanticZoomState?.band || null;
    _semanticZoomState = next;
    _activeSemanticBand = next.band;
    _lastSemanticTransitionThreshold = next.transitionThreshold ?? null;
    const explicitMoonLabelMode = _moonLabelMode === "all" || _moonLabelMode === "selected";
    const explicitDayLabelMode = _dayLabelMode === "all" || _dayLabelMode === "selected";
    if (!explicitMoonLabelMode) _moonLabelMode = next.moonLabelMode || _moonLabelMode;
    if (!explicitDayLabelMode) _dayLabelMode = next.dayLabelMode || _dayLabelMode;
    _applySemanticVisibility(_visibleLayers || {}, next);
    _buildConnections();
    _moonLabelManager?.markDirty();
    globalThis.LivingTimeSphereAnimation.markDirty();
    return true;
  }

  function _connectionPoint(id) {
    if (!id) return null;
    if (id === "core" || id === "passageMidpoint") return new _THREE.Vector3(0, 0, 0);
    if (id === "today") return _objects.todayMarker?.position?.clone?.() || null;
    if (id === "lunar") return _objects.lunarMarker?.position?.clone?.() || null;
    if (id === "lunar-selected") return _objects.lunarSelectedMarker?.position?.clone?.() || _objects.lunarMarker?.position?.clone?.() || null;
    if (id === "equinox") return _objects.equinoxGate?.position?.clone?.() || null;
    if (id === "yearGate") return _objects.yearGate?.position?.clone?.() || null;
    if (id === "solar-selected") return _objects.solarSelectedMarker?.position?.clone?.() || _objects.solarTodayMarker?.position?.clone?.() || null;
    const weekGateMatch = /^weekgate-(\d+)$/.exec(id);
    if (weekGateMatch) {
      const dayOfYear = clamp(Number(weekGateMatch[1]), 1, 364);
      const boundaryAngle = (dayOfYear / 364) * 360;
      const point = angleToXZ(boundaryAngle, globalThis.LivingTimeSphereM.SIZES.patternRing * 1.04);
      return new _THREE.Vector3(point.x, 0.004, point.z);
    }
    const yearMatch = /^year-(\d+)$/.exec(id);
    if (yearMatch) {
      const marker = (_objects.spiralMarkers || []).find(item => item?.name === `year-${yearMatch[1]}`);
      return marker?.position?.clone?.() || null;
    }
    const dayMatch = /^day-(\d+)$/.exec(id);
    if (dayMatch) {
      const angle = globalThis.LivingTimeSphereModel.patternAngleForDayOfYear(Number(dayMatch[1]));
      const point = angleToXZ(angle, globalThis.LivingTimeSphereM.SIZES.patternRing);
      return new _THREE.Vector3(point.x, 0.006, point.z);
    }
    return null;
  }

  function _resolveLunarAngleForSelected(selected, fallbackAngle = 0) {
    if (selected?.lunarCyclePosition != null) {
      const p = Number(selected.lunarCyclePosition);
      if (Number.isFinite(p)) return ((((p % 1) + 1) % 1) * 360);
    }
    const selectedPhase = String(selected?.lunarPhase || "").toLowerCase();
    if (selectedPhase.includes("new")) return 0;
    if (selectedPhase.includes("first quarter")) return 90;
    if (selectedPhase.includes("full")) return 180;
    if (selectedPhase.includes("last quarter")) return 270;
    return Number.isFinite(Number(fallbackAngle)) ? Number(fallbackAngle) : 0;
  }

  function _positionOnSolarAxis(angleDeg, radius) {
    const tilt = 23.5 * Math.PI / 180;
    const rad = (Number(angleDeg || 0) * Math.PI) / 180;
    return {
      x: radius * Math.sin(tilt) * Math.cos(rad),
      y: radius * Math.cos(tilt) * Math.cos(rad),
      z: radius * Math.sin(rad),
    };
  }

  function _positionOnLunarOrbit(angleDeg, radius) {
    const tiltAngle = 0.09;
    const { x, z } = angleToXZ(angleDeg, radius);
    const y = z * Math.sin(tiltAngle);
    return { x, y, z: z * Math.cos(tiltAngle) };
  }

  function _dayNodeVisibilitySet(band, selectedDayOfYear, todayDayOfYear) {
    const set = new Set();
    const add = value => {
      const n = Number(value);
      if (!Number.isFinite(n)) return;
      set.add(_clamp(Math.round(n), 1, 364));
    };
    const addWindow = (center, radius) => {
      const c = Number(center);
      if (!Number.isFinite(c)) return;
      for (let d = Math.round(c) - radius; d <= Math.round(c) + radius; d += 1) {
        if (d >= 1 && d <= 364) set.add(d);
      }
    };
    const addMoonDays = moon => {
      const m = Number(moon);
      if (!Number.isFinite(m) || m < 1 || m > 13) return;
      const start = (m - 1) * 28 + 1;
      for (let d = start; d < start + 28; d += 1) set.add(d);
    };
    const selectedDay = Number.isFinite(Number(selectedDayOfYear)) ? Number(selectedDayOfYear) : null;
    const todayDay = Number.isFinite(Number(todayDayOfYear)) ? Number(todayDayOfYear) : null;
    add(selectedDay);
    add(todayDay);
    if (band === "far") {
      for (let moon = 1; moon <= 13; moon += 1) add(((moon - 1) * 28) + 1);
      return set;
    }
    const focusDay = selectedDay ?? todayDay ?? 1;
    const focusMoon = Math.floor((focusDay - 1) / 28) + 1;
    if (band === "medium") {
      addMoonDays(focusMoon);
      for (let moon = 1; moon <= 13; moon += 1) {
        [1, 7, 14, 21, 28].forEach(day => add(((moon - 1) * 28) + day));
      }
      addWindow(focusDay, 6);
      return set;
    }
    if (band === "near") {
      addMoonDays(focusMoon);
      addMoonDays(focusMoon - 1 < 1 ? 13 : focusMoon - 1);
      addMoonDays(focusMoon + 1 > 13 ? 1 : focusMoon + 1);
      addWindow(focusDay, 14);
      return set;
    }
    addWindow(focusDay, 7);
    const weekStart = Math.floor(((focusDay - 1) % 28) / 7) * 7 + ((focusMoon - 1) * 28) + 1;
    for (let d = weekStart; d < weekStart + 7; d += 1) add(d);
    return set;
  }

  function _applyDayNodeVisibility(band, selectedDayOfYear, todayDayOfYear) {
    if (!_objects.dayNodes?.geometry || !_dayNodeBasePositions) {
      _dayNodeVisibleCount = 0;
      return;
    }
    const visibleDays = _dayNodeVisibilitySet(band, selectedDayOfYear, todayDayOfYear);
    const key = `${band}|${selectedDayOfYear || "x"}|${todayDayOfYear || "x"}`;
    if (key === _dayNodeVisibleKey && _dayNodeVisibleCount > 0) return;
    const attr = _objects.dayNodes.geometry.getAttribute("position");
    if (!attr?.array) return;
    const arr = attr.array;
    let writeIndex = 0;
    for (let day = 1; day <= 364; day += 1) {
      if (!visibleDays.has(day)) continue;
      const src = (day - 1) * 3;
      const dst = writeIndex * 3;
      arr[dst] = _dayNodeBasePositions[src];
      arr[dst + 1] = _dayNodeBasePositions[src + 1];
      arr[dst + 2] = _dayNodeBasePositions[src + 2];
      writeIndex += 1;
    }
    attr.needsUpdate = true;
    _objects.dayNodes.geometry.setDrawRange(0, writeIndex);
    _dayNodeVisibleCount = writeIndex;
    _dayNodeVisibleKey = key;
  }

  function _connectionTypeForId(id) {
    if (!id) return "unknown";
    if (id === "core") return "core";
    if (id === "today") return "today";
    if (id === "lunar" || id === "lunar-selected") return "lunar";
    if (id === "solar-selected") return "solar";
    if (id === "yearGate") return "year-gate";
    if (id === "equinox") return "equinox";
    if (/^day-/.test(id)) return "day";
    if (/^weekgate-/.test(id)) return "week-gate";
    if (/^year-/.test(id)) return "year";
    return "unknown";
  }

  function _temporalComparisonArcPoints(connection, from, to) {
    if (!/^selected-today-/.test(String(connection?.id || ""))) return [from, to];
    const selectedDay = Number(/^day-(\d+)$/.exec(String(connection.sourceMarkerId || ""))?.[1]);
    const todayDay = Number(_model?.todayPatternPosition?.dayOfPatternYear);
    if (!Number.isFinite(selectedDay) || !Number.isFinite(todayDay)) return [from, to];
    const temporalArc = globalThis.LivingTimeSphereTemporal?.comparisonArcSamples?.(selectedDay, todayDay);
    const startDeg = globalThis.LivingTimeSphereModel.patternAngleForDayOfYear(selectedDay);
    const endDeg = globalThis.LivingTimeSphereModel.patternAngleForDayOfYear(todayDay);
    const deltaDeg = ((endDeg - startDeg + 540) % 360) - 180;
    const baseRadius = globalThis.LivingTimeSphereM.SIZES.patternRing;
    const fallbackSegments = Math.max(18, Math.min(64, Math.ceil(Math.abs(deltaDeg) / 4)));
    const samples = temporalArc?.samples || Array.from({ length: fallbackSegments + 1 }, (_, index) => {
      const progress = index / fallbackSegments;
      const lift = Math.sin(progress * Math.PI);
      return { angle: startDeg + deltaDeg * progress, radiusScale: 1.012 + lift * 0.045, lift };
    });
    return samples.map(sample => {
      const point = angleToXZ(sample.angle, baseRadius * sample.radiusScale);
      return new _THREE.Vector3(point.x, 0.012 + sample.lift * 0.11, point.z);
    });
  }

  function _buildConnections() {
    if (!_objects.connectionGroup) return;
    _connectionDiagnostics = [];
    _connectionVisibleCount = 0;
    _lastSpiralGeometryKey = "";
    _lastPassageGeometryKey = "";
    _spiralMarkerAnchors = [];
    _disposeGroupChildren(_objects.connectionGroup);
    if (!Array.isArray(_connectionRegistry) || !_connectionRegistry.length) return;
    if (!_visibleLayers.connections) {
      _connectionDiagnostics = _connectionRegistry.map(connection => ({
        id: connection.id,
        sourceId: connection.sourceMarkerId || null,
        sourceType: _connectionTypeForId(connection.sourceMarkerId),
        targetId: connection.targetMarkerId || null,
        targetType: _connectionTypeForId(connection.targetMarkerId),
        relationType: connection.relationship || connection.type || "unspecified",
        visible: false,
        hiddenReason: "connections-layer-off",
      }));
      return;
    }
    const mat = globalThis.LivingTimeSphereM;
    const band = _semanticZoomState?.band || "medium";
    const budget = Number(_semanticZoomState?.maxConnections || 0);
    const visibleCandidates = _connectionRegistry
      .filter(connection => connection.visible !== false)
      .filter(connection => !connection.semanticBands || connection.semanticBands.includes(band))
      .sort((a, b) => (Number(b.priority || 0) - Number(a.priority || 0)) || String(a.id).localeCompare(String(b.id)));
    const limited = budget > 0 ? visibleCandidates.slice(0, budget) : visibleCandidates;
    const visibleIds = new Set(limited.map(connection => connection.id));
    _connectionRegistry.forEach(connection => {
      if (connection.visible === false) {
        _connectionDiagnostics.push({
          id: connection.id,
          sourceId: connection.sourceMarkerId || null,
          sourceType: _connectionTypeForId(connection.sourceMarkerId),
          targetId: connection.targetMarkerId || null,
          targetType: _connectionTypeForId(connection.targetMarkerId),
          relationType: connection.relationship || connection.type || "unspecified",
          visible: false,
          hiddenReason: "connection-hidden-by-registry",
        });
        return;
      }
      if (connection.semanticBands && !connection.semanticBands.includes(band)) {
        _connectionDiagnostics.push({
          id: connection.id,
          sourceId: connection.sourceMarkerId || null,
          sourceType: _connectionTypeForId(connection.sourceMarkerId),
          targetId: connection.targetMarkerId || null,
          targetType: _connectionTypeForId(connection.targetMarkerId),
          relationType: connection.relationship || connection.type || "unspecified",
          visible: false,
          hiddenReason: `semantic-band-${band}`,
        });
        return;
      }
      if (!visibleIds.has(connection.id)) {
        _connectionDiagnostics.push({
          id: connection.id,
          sourceId: connection.sourceMarkerId || null,
          sourceType: _connectionTypeForId(connection.sourceMarkerId),
          targetId: connection.targetMarkerId || null,
          targetType: _connectionTypeForId(connection.targetMarkerId),
          relationType: connection.relationship || connection.type || "unspecified",
          visible: false,
          hiddenReason: "connection-budget",
        });
      }
    });
    limited.forEach(connection => {
      const from = _connectionPoint(connection.sourceMarkerId);
      const to = _connectionPoint(connection.targetMarkerId);
      if (!from || !to) {
        _connectionDiagnostics.push({
          id: connection.id,
          sourceId: connection.sourceMarkerId || null,
          sourceType: _connectionTypeForId(connection.sourceMarkerId),
          targetId: connection.targetMarkerId || null,
          targetType: _connectionTypeForId(connection.targetMarkerId),
          relationType: connection.relationship || connection.type || "unspecified",
          visible: false,
          hiddenReason: !from ? "missing-source-anchor" : "missing-target-anchor",
        });
        return;
      }
      const points = _temporalComparisonArcPoints(connection, from, to);
      const geometry = new _THREE.BufferGeometry().setFromPoints(points);
      const material = new _THREE.LineDashedMaterial({
        color: connection.selected ? mat.COLORS.todayHalo : 0xe7e1c8,
        transparent: true,
        opacity: connection.selected ? 0.88 : Math.max(0.22, connection.style?.opacity || 0.48),
        dashSize: connection.style?.strokeDasharray ? 0.04 : 0.12,
        gapSize: connection.style?.strokeDasharray ? 0.03 : 0.001,
        depthWrite: false,
      });
      const line = new _THREE.Line(geometry, material);
      line.computeLineDistances();
      line.name = `connection-${connection.id}`;
      _objects.connectionGroup.add(line);
      _connectionVisibleCount += 1;
      _connectionDiagnostics.push({
        id: connection.id,
        sourceId: connection.sourceMarkerId || null,
        sourceType: _connectionTypeForId(connection.sourceMarkerId),
        targetId: connection.targetMarkerId || null,
        targetType: _connectionTypeForId(connection.targetMarkerId),
        relationType: connection.relationship || connection.type || "unspecified",
        visible: true,
        hiddenReason: "rendered",
      });
    });
  }

  function _applyLayerVisibility(vl, semanticState = _semanticZoomState) {
    if (!_objects || !vl) return;
    if (_objects.patternRing)  _objects.patternRing.visible  = !!vl.pattern;
    if (_objects.moonDividers) _objects.moonDividers.visible = !!vl.pattern;
    if (_objects.moonSectorRails) _objects.moonSectorRails.visible = !!vl.pattern;
    if (_objects.moonIdentityMarkers) _objects.moonIdentityMarkers.visible = !!vl.pattern;
    if (_objects.moonIdentityDetails) _objects.moonIdentityDetails.visible = !!vl.pattern;
    if (_objects.moonIdentityNumbers) _objects.moonIdentityNumbers.visible = !!vl.pattern;
    _applySemanticVisibility(vl, semanticState || { band: "medium", visibility: {} });
    if (_objects.yearGate)     _objects.yearGate.visible     = !!vl.pattern;
    if (_objects.todayLineGroup) _objects.todayLineGroup.visible = true;
    if (_objects.lunarOrbit)   _objects.lunarOrbit.visible   = !!vl.lunar;
    if (_objects.lunarMarker)  _objects.lunarMarker.visible  = !!vl.lunar;
    if (_objects.planetaryGroup) _objects.planetaryGroup.visible = vl.planets !== false;
    if (_objects.solarAxis)    _objects.solarAxis.visible    = !!vl.solar;
    if (_objects.seasonMarkers)_objects.seasonMarkers.visible = !!vl.solar;
    if (_objects.solarProgressGroup) _objects.solarProgressGroup.visible = !!vl.solar;
    if (_objects.spiralGroup)  _objects.spiralGroup.visible  = !!(vl.spiral || vl.markers);
    if (_objects.passageGroup) _objects.passageGroup.visible = !!vl.passage;
    if (_objects.equinoxGate)  _objects.equinoxGate.visible  = !!vl.passage || !!vl.markers;
    if (_objects.activeMoonGroup) _objects.activeMoonGroup.visible = !!vl.pattern;
    if (_objects.connectionGroup) _objects.connectionGroup.visible = !!vl.connections;
    _environmentController.setLayerVisibility("environment", !!vl.environment);
    _environmentController.update(_environmentState);
  }

  function _queueSceneRepair(reason = "scene-repair-requested") {
    if (_sceneRepairQueued) return;
    if (!_initialized || !_scene || !_model) return;
    _sceneRepairQueued = true;
    _sceneRepairRaf = requestAnimationFrame(() => {
      _sceneRepairRaf = 0;
      _sceneRepairQueued = false;
      if (!_initialized || !_scene || !_model) return;
      const readiness = _validateSceneReadiness({ requireFirstFrame: true });
      if (readiness?.ready) return;
      try {
        updateScene(_model, _spiral, _selectedYear, _visibleLayers, _viewMode, _moonLabelMode, _moonLabelDistance, _dayLabelMode, _connectionRegistry, _motionMode, _semanticZoomState);
        globalThis.LivingTimeSphereAnimation.markDirty();
      } catch (error) {
        console.warn(`[LivingTimeSphere] Deferred scene repair failed (${reason}).`, error);
      }
    });
  }

  function _applyModeVisibilityOverrides(vl = _visibleLayers) {
    if (_viewMode === "today") {
      if (_objects.spiralPath) _objects.spiralPath.visible = false;
      if (_objects.recurrenceGroup) _objects.recurrenceGroup.visible = false;
    } else if (_viewMode === "passage") {
      if (_objects.spiralPath) _objects.spiralPath.visible = false;
    } else if (_viewMode === "pattern") {
      if (_objects.lunarMarker) _objects.lunarMarker.visible = false;
      if (_objects.lunarSelectedMarker) _objects.lunarSelectedMarker.visible = false;
      if (_objects.solarAxis) _objects.solarAxis.visible = false;
      if (_objects.solarSelectedMarker) _objects.solarSelectedMarker.visible = false;
      if (_objects.solarTodayMarker) _objects.solarTodayMarker.visible = false;
      if (_objects.solarProgressGroup) _objects.solarProgressGroup.visible = false;
      if (_objects.seasonMarkers) _objects.seasonMarkers.visible = false;
      if (_objects.spiralPath) _objects.spiralPath.visible = false;
    }

  }

  function setLayerVisibility(layerName, visible) {
    if (!_initialized || !_scene || !_model) return false;
    if (!layerName || !Object.prototype.hasOwnProperty.call(_visibleLayers, layerName)) return false;
    const t0 = performance.now();
    const nextVisible = !!visible;
    if (_visibleLayers[layerName] === nextVisible) return true;
    _visibleLayers = { ..._visibleLayers, [layerName]: nextVisible };
    _countLifecycle("layerVisibilityUpdateCount");
    _lastLayerUpdateType = "layer-visibility-update";
    _applyLayerVisibility(_visibleLayers, _semanticZoomState);
    _applyModeVisibilityOverrides(_visibleLayers);
    const readiness = _validateSceneReadiness({ requireFirstFrame: true });
    if (!readiness?.ready) {
      _queueSceneRepair("layer-visibility");
    }
    _lastLayerUpdateMs = Math.max(0, performance.now() - t0);
    _markLayerToggle(layerName, _lastLayerUpdateMs);
    globalThis.LivingTimeSphereAnimation.markDirty();
    return true;
  }

  function setLayerStates(nextLayerState) {
    if (!_initialized || !_scene || !_model || !nextLayerState || typeof nextLayerState !== "object") return false;
    const t0 = performance.now();
    const merged = { ..._visibleLayers };
    let changed = false;
    Object.keys(nextLayerState).forEach(layerName => {
      if (!Object.prototype.hasOwnProperty.call(merged, layerName)) return;
      const value = !!nextLayerState[layerName];
      if (merged[layerName] !== value) {
        merged[layerName] = value;
        changed = true;
      }
    });
    if (!changed) return true;
    _visibleLayers = merged;
    _countLifecycle("layerVisibilityUpdateCount");
    _lastLayerUpdateType = "layer-visibility-batch-update";
    _applyLayerVisibility(_visibleLayers, _semanticZoomState);
    _applyModeVisibilityOverrides(_visibleLayers);
    const readiness = _validateSceneReadiness({ requireFirstFrame: true });
    if (!readiness?.ready) {
      _queueSceneRepair("layer-batch-visibility");
    }
    _lastLayerUpdateMs = Math.max(0, performance.now() - t0);
    _markLayerToggle("batch", _lastLayerUpdateMs);
    globalThis.LivingTimeSphereAnimation.markDirty();
    return true;
  }

  function _spiralGeometrySignature(spiral) {
    const years = Array.isArray(spiral?.years) ? spiral.years : [];
    if (!years.length) return "";
    return years.map(item => `${item.year}:${Number(item.yearSpiralAngle || 0).toFixed(4)}:${Number(item.yearSpiralRadius || 0).toFixed(4)}`).join("|");
  }

  function _passageGeometrySignature(model) {
    if (!model?.passage) return "";
    return `${Number(model.passage.startAngle || 0).toFixed(6)}:${Number(model.passage.endAngle || 0).toFixed(6)}`;
  }

  function _positionSelectionRingForYear(selectedYear) {
    if (!_objects.selectionRing || !Array.isArray(_spiralMarkerAnchors) || !_spiralMarkerAnchors.length) return;
    const hit = _spiralMarkerAnchors.find(entry => Number(entry.year) === Number(selectedYear));
    if (!hit) return;
    _objects.selectionRing.position.set(hit.x, hit.y, hit.z);
    _objects.selectionRing.visible = true;
    _objects.selectionRing.rotation.x = Math.PI / 2;
  }

  function updateScene(model, spiral, selectedYear, visibleLayers, viewMode, moonLabelMode = _moonLabelMode, moonLabelDistance = _moonLabelDistance, dayLabelMode = _dayLabelMode, connectionRegistry = _connectionRegistry, motionMode = _motionMode, semanticZoomState = _semanticZoomState) {
    if (!_THREE || !_scene || !model) return;
    const mat = globalThis.LivingTimeSphereM;
    const updateStartedAt = performance.now();
    const previousViewMode = _viewMode;
    const previousSelectedYear = _selectedYear;
    _lastSceneBuildTimestamp = Date.now();
    _geometryBuildRevision += 1;
    _countLifecycle("modelBuildCount");
    _lastLayerUpdateType = "data-update";

    _model        = model;
    _spiral       = spiral;
    _selectedYear = selectedYear;
    _visibleLayers = visibleLayers || {};
    _viewMode     = viewMode || "today";
    _moonLabelMode = moonLabelMode || "contextual";
    _moonLabelDistance = moonLabelDistance || "standard";
    _dayLabelMode = dayLabelMode || "key";
    _connectionRegistry = Array.isArray(connectionRegistry) ? connectionRegistry : [];
    _motionMode = motionMode || "still";
    globalThis.LivingTimeSphereAnimation?.setLowPower?.(
      _motionMode === "still" || _activeTier === "lowpower" || Number(_quality?.starCount) === 0
    );
    if (_motionMode === "drift" && _quality?.idleDrift && !_prefersReducedMotion()) {
      if (!globalThis.LivingTimeSphereCamera?.isDrifting?.()) {
        globalThis.LivingTimeSphereCamera?.startDrift?.(performance.now());
      }
    } else {
      globalThis.LivingTimeSphereCamera?.stopDrift?.();
    }
    _semanticZoomState = semanticZoomState || _semanticZoomState || null;
    _buildMoonAnchors(_viewMode);
    _moonLabelManager?.markDirty();

    // ── Layer visibility ────────────────────────────────────────────
    const vl = _visibleLayers;
    _applyLayerVisibility(vl, _semanticZoomState || { band: "medium", visibility: {} });

    // ── Equinox gate position ───────────────────────────────────────
    if (_objects.equinoxGate && model.passageStartAngle != null) {
      const { x, z } = angleToXZ(model.passageStartAngle, mat.SIZES.patternRing);
      _objects.equinoxGate.position.set(x, 0, z);
    }

    // ── Passage arc ─────────────────────────────────────────────────
    if (_objects.passageGroup) {
      const layerStart = performance.now();
      const passageSig = _passageGeometrySignature(model);
      if (_lastPassageGeometryKey !== passageSig) {
        _disposeGroupChildren(_objects.passageGroup);
        _objects.passageArc = null;
        if (model.passage) {
          const tube = buildPassageTube(model.passage.startAngle, model.passage.endAngle);
          if (tube) {
            tube.name = "passageArc";
            _objects.passageGroup.add(tube);
            _objects.passageArc = tube;
          }
        }
        _lastPassageGeometryKey = passageSig;
      }
      _objects.passageGroup.visible = !!vl.passage;
      _markLayerBuild("passage", performance.now() - layerStart);
    }

    const band = _semanticZoomState?.band || "medium";

    // ── Lunar + Solar marker positions ──────────────────────────────
    const selected = model.selectedPatternPosition || model.todayPatternPosition || null;
    const todayLunarAngle = Number(model.lunarAngle ?? 0);
    const selectedLunarAngle = _resolveLunarAngleForSelected(selected, todayLunarAngle);
    if (_objects.lunarMarker && Number.isFinite(todayLunarAngle)) {
      const p = _positionOnLunarOrbit(todayLunarAngle, mat.SIZES.lunarOrbit);
      _objects.lunarMarker.position.set(p.x, p.y, p.z);
      _objects.lunarMarker.userData = {
        type: "lunar-position",
        role: "today",
        phase: model.todayPatternPosition?.lunarPhase || null,
        illumination: model.todayPatternPosition?.lunarIllumination ?? null,
      };
    }
    if (_objects.lunarSelectedMarker && Number.isFinite(selectedLunarAngle)) {
      const p = _positionOnLunarOrbit(selectedLunarAngle, mat.SIZES.lunarOrbit);
      _objects.lunarSelectedMarker.position.set(p.x, p.y, p.z);
      _objects.lunarSelectedMarker.userData = {
        type: "lunar-position",
        role: "selected",
        phase: selected?.lunarPhase || null,
        illumination: selected?.lunarIllumination ?? null,
      };
      _objects.lunarSelectedMarker.visible = !!vl.lunar && band !== "far" && !!selected;
    }

    const todaySolarAngle = Number(model.currentSolarSeasonAngle ?? model.solarSeasonAngle ?? 0);
    const selectedSolarAngle = Number(selected?.solar?.angle ?? todaySolarAngle);
    _selectedSeasonAngle = Number.isFinite(selectedSolarAngle) ? selectedSolarAngle : 0;
    _updateLocationSeasonRing(_selectedSeasonAngle);
    _updateInstrumentContextRails();
    if (_objects.solarTodayMarker && Number.isFinite(todaySolarAngle)) {
      const p = _positionOnSolarAxis(todaySolarAngle, mat.SIZES.solarAxis);
      _objects.solarTodayMarker.position.set(p.x, p.y, p.z);
      _objects.solarTodayMarker.visible = !!vl.solar && band !== "far";
      _objects.solarTodayMarker.userData = {
        type: "solar-position",
        role: "today",
        angle: todaySolarAngle,
        sourceType: "seasonal-approximation",
        precision: "anchor-interpolation",
      };
    }
    if (_objects.solarSelectedMarker && Number.isFinite(selectedSolarAngle)) {
      const p = _positionOnSolarAxis(selectedSolarAngle, mat.SIZES.solarAxis);
      _objects.solarSelectedMarker.position.set(p.x, p.y, p.z);
      _objects.solarSelectedMarker.visible = !!vl.solar && band !== "far" && !!selected;
      _objects.solarSelectedMarker.userData = {
        type: "solar-position",
        role: "selected",
        gate: selected?.solar?.gate || null,
        angle: selectedSolarAngle,
        sourceType: "seasonal-approximation",
        precision: "anchor-interpolation",
      };
    }
    if (_objects.solarProgressGroup) {
      const layerStart = performance.now();
      const solarProgressKey = `${Number(todaySolarAngle).toFixed(3)}:${Number(selectedSolarAngle).toFixed(3)}`;
      if (_lastSolarProgressGeometryKey !== solarProgressKey) {
        _disposeGroupChildren(_objects.solarProgressGroup);
        const arc = buildSolarProgressArc(todaySolarAngle, selectedSolarAngle);
        if (arc) {
          arc.name = "solarProgressArc";
          arc.computeLineDistances?.();
          _objects.solarProgressGroup.add(arc);
        }
        _lastSolarProgressGeometryKey = solarProgressKey;
      }
      _objects.solarProgressGroup.children.forEach(child => {
        child.visible = !!vl.solar && band !== "far";
      });
      _markLayerBuild("solar", performance.now() - layerStart);
    }

    // ── Historical spiral markers ──────────────────────────────────
    // B7.52 — historical geometry is not part of the first interactive paint.
    // It joins on the deferred visual-hydration slice unless Years mode was
    // explicitly requested.
    if (_objects.spiralGroup && spiral?.years && (_progressiveVisualsReady || _viewMode === "years")) {
      const layerStart = performance.now();
      const spiralSig = _spiralGeometrySignature(spiral);
      if (_lastSpiralGeometryKey !== spiralSig) {
        _disposeGroupChildren(_objects.spiralGroup);
        _objects.spiralMarkers = [];
        _spiralMarkerAnchors = [];

        for (const y of spiral.years) {
          const r  = mat.SIZES.spiralInner + (mat.SIZES.spiralOuter - mat.SIZES.spiralInner) * y.yearSpiralRadius;
          const { x, z } = angleToXZ(y.yearSpiralAngle % 360, r);
          const yOff = (y.yearSpiralRadius - 0.5) * 0.25;
          const geo = new _THREE.SphereGeometry(mat.SIZES.markerDot, 8, 8);
          const m   = new _THREE.MeshStandardMaterial({
            color: mat.COLORS.annual,
            emissive: 0x000000,
            emissiveIntensity: 0,
            roughness: 0.5,
          });
          const mesh = new _THREE.Mesh(geo, m);
          mesh.position.set(x, yOff, z);
          mesh.name = `year-${y.year}`;
          mesh.userData.year = y.year;
          mesh.visible = !!vl.markers;
          _objects.spiralGroup.add(mesh);
          _objects.spiralMarkers.push(mesh);
          _spiralMarkerAnchors.push({ year: y.year, x, y: yOff, z });
        }

        _objects.spiralPath = buildSpiralPath(spiral.years);
        if (_objects.spiralPath) {
          _objects.spiralPath.visible = !!vl.spiral;
          _objects.spiralGroup.add(_objects.spiralPath);
        }
        _lastSpiralGeometryKey = spiralSig;
      }
      if (_objects.spiralPath) _objects.spiralPath.visible = !!vl.spiral;
      _objects.spiralMarkers?.forEach(marker => {
        if (marker) marker.visible = !!vl.markers;
      });
      _positionSelectionRingForYear(selectedYear);
      _markLayerBuild("spiral", performance.now() - layerStart);
    }

    // ── Recurrence links ────────────────────────────────────────────
    if (_objects.recurrenceGroup) {
      const layerStart = performance.now();
      const recurrenceReady = _progressiveVisualsReady || _viewMode === "years";
      _objects.recurrenceGroup.visible = !!(recurrenceReady && vl.recurrence && !_isMobileWidth());
      if (recurrenceReady && vl.recurrence && !_isMobileWidth()) {
        _buildRecurrenceLinks(spiral);
      }
      _markLayerBuild("recurrence", performance.now() - layerStart);
    }

    // ── Today marker positioning ────────────────────────────────────
    const showToday = true;
    if (_objects.todayMarker) {
      const angle = model.currentPatternAngle != null ? model.currentPatternAngle : model.patternAngle;
      const { x, z } = angleToXZ(angle, mat.SIZES.patternRing);
      _objects.todayMarker.position.set(x, 0.005, z);
      _objects.todayMarker.visible = showToday;
      _objects.todayMarker.userData = {
        ...(model.todayPatternPosition || {}),
        type: "living-day",
        role: "today",
      };

      if (_objects.todayHalo) {
        _objects.todayHalo.position.set(x, 0.002, z);
        _objects.todayHalo.visible = showToday;
      }

      if (_objects.todayLineGroup) {
        const todayLineKey = showToday ? `${Number(x).toFixed(4)}:${Number(z).toFixed(4)}` : "hidden";
        if (_lastTodayLineGeometryKey !== todayLineKey) {
          _disposeGroupChildren(_objects.todayLineGroup);
          if (showToday) {
            const pts = [new _THREE.Vector3(0, 0, 0), new _THREE.Vector3(x, 0.005, z)];
            const geo = new _THREE.BufferGeometry().setFromPoints(pts);
            const lineMat = new _THREE.LineDashedMaterial({
              color:       mat.COLORS.todayLine,
              transparent: true,
              opacity:     mat.OPACITY.todayLine,
              dashSize:    0.04,
              gapSize:     0.025,
              depthWrite:  false,
            });
            const line = new _THREE.Line(geo, lineMat);
            line.computeLineDistances();
            line.name = "todayCenterLine";
            _objects.todayLineGroup.add(line);
          }
          _lastTodayLineGeometryKey = todayLineKey;
        }
      }
    }

    if (_objects.todayHalo?.material) {
      _objects.todayHalo.material.emissiveIntensity = mat.EMISSIVE.todayHalo;
      _objects.todayHalo.material.opacity = mat.OPACITY.todayHalo;
    }

    if (_objects.selectedDayMarker) {
      const selected = model.selectedPatternPosition || null;
      const showSelected = !!(selected?.dayOfPatternYear != null);
      if (showSelected) {
        const selectedAngle = globalThis.LivingTimeSphereModel.patternAngleForDayOfYear(selected.dayOfPatternYear);
        const { x, z } = angleToXZ(selectedAngle, mat.SIZES.patternRing);
        _objects.selectedDayMarker.position.set(x, 0.01, z);
        _objects.selectedDayMarker.visible = true;
        if (_objects.selectedDayHalo) {
          _objects.selectedDayHalo.position.set(x, 0.004, z);
          _objects.selectedDayHalo.visible = true;
        }
        _objects.selectedDayMarker.userData = {
          ...selected,
          type: "living-day",
          role: "selected",
        };
      } else {
        _objects.selectedDayMarker.visible = false;
        if (_objects.selectedDayHalo) _objects.selectedDayHalo.visible = false;
      }
    }
    if (_objects.todayMarker?.material) {
      _objects.todayMarker.material.emissiveIntensity = Math.max(0.45, mat.EMISSIVE.today * 0.72);
    }
    if (_objects.todayLineGroup) {
      _objects.todayLineGroup.children.forEach(c => {
        if (c.material) {
          c.material.opacity = mat.OPACITY.todayLine;
          c.material.dashSize = 0.04;
          c.material.gapSize = 0.025;
        }
      });
    }

    _applyDayNodeVisibility(
      band,
      selected?.dayOfPatternYear ?? model.selectedPatternPosition?.dayOfPatternYear ?? null,
      model.todayPatternPosition?.dayOfPatternYear ?? null
    );

    // ── Mode-specific layer overrides ───────────────────────────────
    _applyModeVisibilityOverrides(vl);
    if (_viewMode === "today") {
      // Boost Today halo and marker for emphasis
      if (_objects.todayHalo?.material) {
        _objects.todayHalo.material.emissiveIntensity = 0.8;
        _objects.todayHalo.material.opacity = 0.72;
      }

      if (_objects.todayMarker?.material) _objects.todayMarker.material.emissiveIntensity = 0.9;
      // Today line: make solid for emphasis in Today mode
      if (_objects.todayLineGroup) {
        _objects.todayLineGroup.children.forEach(c => {
          if (c.material) { c.material.opacity = 0.85; c.material.dashSize = 0.06; }
        });
      }
    }

    // ── Active Moon sector highlight ────────────────────────────────
    if (_objects.activeMoonGroup) {
      const layerStart = performance.now();
      const tp = model.selectedPatternPosition || model.todayPatternPosition;
      const activeMoon = tp ? (tp.moon || 1) - 1 : (model.sourceRecord?.equinox?.patternPosition?.moon || 1) - 1;
      const r = mat.SIZES.patternRing;
      const activeCalendarBand = String(_semanticZoomState?.band || "medium").toLowerCase();
      const activeMoonGeometryKey = `${activeMoon}:${activeCalendarBand}:${_viewMode}`;

      if (_lastActiveMoonGeometryKey !== activeMoonGeometryKey) {
        _disposeGroupChildren(_objects.activeMoonGroup);
        const sectorStart = (activeMoon / 13) * 360;
        const sectorEnd   = ((activeMoon + 1) / 13) * 360;
        const steps = 32;
        const innerR = r * ((activeCalendarBand === "near" || activeCalendarBand === "detail") ? 0.64 : 0.82);
        const outerR = r * 0.98;
        const shape = new _THREE.Shape();
      for (let i = 0; i <= steps; i++) {
        const a = sectorStart + (i / steps) * (sectorEnd - sectorStart);
        const { x, z } = angleToXZ(a, outerR);
        if (i === 0) shape.moveTo(x, z);
        else shape.lineTo(x, z);
      }
      for (let i = steps; i >= 0; i--) {
        const a = sectorStart + (i / steps) * (sectorEnd - sectorStart);
        const { x, z } = angleToXZ(a, innerR);
        shape.lineTo(x, z);
      }
      shape.closePath();
      const geo = new _THREE.ShapeGeometry(shape);
      geo.rotateX(Math.PI / 2);
      const sectorMat = new _THREE.MeshBasicMaterial({
        color:       mat.COLORS.moonHighlight,
        transparent: true,
        opacity:     _viewMode === "today" ? 0.42 : mat.OPACITY.moonHighlight,
        depthWrite:  false,
        side:        _THREE.DoubleSide,
      });
      const sector = new _THREE.Mesh(geo, sectorMat);
      sector.name = "activeMoonSector";
      _objects.activeMoonGroup.add(sector);
      _decorateActiveMoonCalendarGrid(_objects.activeMoonGroup, activeMoon, r, mat);

      const linePts = [];
      for (let i = 0; i <= steps; i++) {
        const a = sectorStart + (i / steps) * (sectorEnd - sectorStart);
        const { x, z } = angleToXZ(a, outerR * 1.005);
        linePts.push(new _THREE.Vector3(x, 0.012, z));
      }
      const boundaryGeo = new _THREE.BufferGeometry().setFromPoints(linePts);
      const boundary = new _THREE.Line(boundaryGeo, new _THREE.LineBasicMaterial({
        color: mat.COLORS.todayGlow,
        transparent: true,
        opacity: _viewMode === "today" ? 0.95 : 0.72,
        depthWrite: false,
      }));
        boundary.name = "activeMoonBoundary";
        _objects.activeMoonGroup.add(boundary);
        _lastActiveMoonGeometryKey = activeMoonGeometryKey;
      }
      _markLayerBuild("pattern", performance.now() - layerStart);
    }

    // ── Active day node highlight ───────────────────────────────────
    if (_objects.activeDayNode) {
      const tp = model.selectedPatternPosition || model.todayPatternPosition;
      if (vl.pattern && tp && tp.moon != null && tp.day != null) {
        const moonIdx = tp.moon - 1;
        const dayIdx  = tp.day  - 1;
        const angle = globalThis.LivingTimeSphereModel.dayAngleWithinMoon(moonIdx, dayIdx);
        const { x, z } = angleToXZ(angle, mat.SIZES.patternRing);
        _objects.activeDayNode.position.set(x, 0.008, z);
        _objects.activeDayNode.visible = true;
        if (_objects.selectionRing && _viewMode !== "years") {
          _objects.selectionRing.position.set(x, 0.01, z);
          _objects.selectionRing.visible = true;
          _objects.selectionRing.rotation.x = Math.PI / 2;
        }
      } else {
        _objects.activeDayNode.visible = false;
      }
    }

    if (_viewMode === "years" && _objects.selectionRing && !_objects.selectionRing.visible) {
      _objects.selectionRing.visible = true;
      _objects.selectionRing.rotation.x = Math.PI / 2;
    }

    _syncSemanticZoomFromCamera(true);
    if (_progressiveVisualsReady && !_connectionDiagnostics.length && _connectionRegistry.length) {
      const layerStart = performance.now();
      _buildConnections();
      _markLayerBuild("connections", performance.now() - layerStart);
    }
    const shouldRefocus = previousViewMode !== _viewMode
      || (_viewMode === "years" && Number(previousSelectedYear) !== Number(_selectedYear));
    if (shouldRefocus) _syncCameraFocus(model, spiral, selectedYear, true);
    _enforceRendererHostContract();
    _validateSceneReadiness({ requireFirstFrame: false });
    _lastLayerUpdateMs = Math.max(0, performance.now() - updateStartedAt);

    globalThis.LivingTimeSphereAnimation.markDirty();
  }

  function _isMobileWidth() {
    return typeof window !== "undefined" && window.innerWidth < 480;
  }

  function _buildRecurrenceLinks(spiral) {
    if (!spiral?.years || !_objects.recurrenceGroup) return;
    const THREE = _THREE;
    const mat   = globalThis.LivingTimeSphereM;

    // Clear old links
    _disposeGroupChildren(_objects.recurrenceGroup);

    // Inspect recurrence values from source records
    for (let i = 0; i < spiral.years.length; i++) {
      for (let j = i + 1; j < spiral.years.length; j++) {
        const a = spiral.years[i];
        const b = spiral.years[j];
        // Only link if passage duration is within 3 hours
        const diff = Math.abs(a.passageDurationDays - b.passageDurationDays);
        if (diff > 0.125) continue;

        const rA  = mat.SIZES.spiralInner + (mat.SIZES.spiralOuter - mat.SIZES.spiralInner) * a.yearSpiralRadius;
        const rB  = mat.SIZES.spiralInner + (mat.SIZES.spiralOuter - mat.SIZES.spiralInner) * b.yearSpiralRadius;
        const pA  = angleToXZ(a.yearSpiralAngle % 360, rA);
        const pB  = angleToXZ(b.yearSpiralAngle % 360, rB);
        const yA  = (a.yearSpiralRadius - 0.5) * 0.25;
        const yB  = (b.yearSpiralRadius - 0.5) * 0.25;

        const pts = [new THREE.Vector3(pA.x, yA, pA.z), new THREE.Vector3(pB.x, yB, pB.z)];
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const strength = Math.max(0.1, 1 - diff / 0.125);
        const m   = new THREE.LineBasicMaterial({
          color:       mat.COLORS.recurrence,
          transparent: true,
          opacity:     mat.OPACITY.recurrence * strength,
          depthWrite:  false,
        });
        _objects.recurrenceGroup.add(new THREE.Line(geo, m));
      }
    }
  }

  // ── Frame render ──────────────────────────────────────────────────

  function render(nowMs) {
    if (!_renderer || !_scene || !_camera) return;

    const breathVal = globalThis.LivingTimeSphereAnimation.breathValue();
    const flowVal   = globalThis.LivingTimeSphereAnimation.flowValue();

    // Breathing core
    if (_objects.coreGlow && _quality?.breathing) {
      globalThis.LivingTimeSphereEffects.updateCoreGlow(_objects.coreGlow, breathVal);
    }

    // Passage flow: subtle emissive pulse on the arc
    if (_objects.passageArc && _objects.passageArc.material && _quality?.passageFlow) {
      const mat = globalThis.LivingTimeSphereM;
      _objects.passageArc.material.emissiveIntensity = mat.EMISSIVE.passage + flowVal * 0.3;
    }

    // Selection ring gentle scale pulse
    if (_objects.selectionRing?.visible) {
      _objects.selectionRing.scale.setScalar(1.0 + breathVal * 0.08);
    }

    // Update sphere-anchored Moon labels
    _syncSemanticZoomFromCamera(false);
    _updateMoonLabels(_viewMode, nowMs);

    globalThis.LivingTimeSphereExtensionHost?.renderAll?.(
      _extensionContext({
        lifecycle: "render",
        nowMs,
        breathValue: breathVal,
        flowValue: flowVal
      })
    );

    _renderer.render(_scene, _camera);
    _lastRenderTimestamp = Date.now();
  }

  function _isFiniteVec3(vec) {
    if (!vec) return false;
    return Number.isFinite(Number(vec.x)) && Number.isFinite(Number(vec.y)) && Number.isFinite(Number(vec.z));
  }

  function _materialHasVisibleOpacity(material) {
    if (!material) return false;
    if (Array.isArray(material)) return material.some(_materialHasVisibleOpacity);
    const transparent = material.transparent === true;
    const opacity = Number(material.opacity);
    if (!Number.isFinite(opacity)) return true;
    if (!transparent) return opacity > 0;
    return opacity > 0.01;
  }

  function _countObjectPresence(entry) {
    if (!entry) return 0;
    const count = Number(entry.children?.length || 0);
    return count > 0 ? count : 1;
  }

  function _collectSceneStats() {
    const stats = {
      sceneObjectCount: 0,
      visibleObjectCount: 0,
      meshCount: 0,
      lineCount: 0,
      patternGroupChildren: 0,
      lunarGroupChildren: 0,
      solarGroupChildren: 0,
      passageGroupChildren: 0,
      markerGroupChildren: 0,
      connectionGroupChildren: 0,
      spiralGroupChildren: 0,
      environmentGroupChildren: 0,
      astronomyGroupChildren: 0,
      selectedGroupChildren: 0,
      patternGroupVisible: false,
      activeLayerSet: Object.entries(_visibleLayers || {}).filter(([, enabled]) => !!enabled).map(([key]) => key),
      sceneBounds: null,
      sceneBoundsFinite: false,
      cameraPosition: _camera?.position ? {
        x: Number(_camera.position.x || 0),
        y: Number(_camera.position.y || 0),
        z: Number(_camera.position.z || 0),
      } : null,
      cameraTarget: (() => {
        const st = globalThis.LivingTimeSphereCamera?.getState?.() || null;
        const t = st?.target || null;
        return t ? { x: Number(t.x || 0), y: Number(t.y || 0), z: Number(t.z || 0) } : null;
      })(),
      cameraNear: Number(_camera?.near || 0),
      cameraFar: Number(_camera?.far || 0),
      canvasWidth: Number(_canvas?.width || 0),
      canvasHeight: Number(_canvas?.height || 0),
      sceneIntersectsFrustum: false,
    };

    if (_scene) {
      _scene.traverse?.(obj => {
        if (!obj) return;
        stats.sceneObjectCount += 1;
        if (obj.visible !== false) stats.visibleObjectCount += 1;
        const kind = String(obj.type || "").toLowerCase();
        if (kind.includes("mesh")) stats.meshCount += 1;
        if (kind.includes("line")) stats.lineCount += 1;
      });
    }

    const patternEntries = [
      _objects.patternRing,
      _objects.moonDividers,
      _objects.dayNodes,
      _objects.weekGates,
      _objects.weekDividers,
      _objects.activeMoonGroup,
      _objects.activeDayNode,
      _objects.todayMarker,
      _objects.selectedDayMarker,
    ];
    const astronomyEntries = [
      _objects.lunarOrbit,
      _objects.lunarMarker,
      _objects.lunarSelectedMarker,
      _objects.solarAxis,
      _objects.seasonMarkers,
      _objects.solarProgressGroup,
      _objects.passageGroup,
      _objects.equinoxGate,
    ];
    const selectedEntries = [
      _objects.selectedDayMarker,
      _objects.selectedDayHalo,
      _objects.selectionRing,
      _objects.activeDayNode,
    ];
    stats.patternGroupChildren = patternEntries.reduce((sum, entry) => sum + _countObjectPresence(entry), 0);
    stats.astronomyGroupChildren = astronomyEntries.reduce((sum, entry) => sum + _countObjectPresence(entry), 0);
    stats.selectedGroupChildren = selectedEntries.reduce((sum, entry) => sum + _countObjectPresence(entry), 0);
    stats.lunarGroupChildren = [_objects.lunarOrbit, _objects.lunarMarker, _objects.lunarSelectedMarker].reduce((sum, entry) => sum + _countObjectPresence(entry), 0);
    stats.solarGroupChildren = [_objects.solarAxis, _objects.seasonMarkers, _objects.solarProgressGroup, _objects.solarTodayMarker, _objects.solarSelectedMarker].reduce((sum, entry) => sum + _countObjectPresence(entry), 0);
    stats.planetaryGroupChildren = [_objects.planetaryGroup, ...(_objects.planetMarkers || [])].reduce((sum, entry) => sum + _countObjectPresence(entry), 0);
    stats.passageGroupChildren = [_objects.passageGroup, _objects.equinoxGate].reduce((sum, entry) => sum + _countObjectPresence(entry), 0);
    stats.markerGroupChildren = [_objects.todayMarker, _objects.selectedDayMarker, _objects.activeDayNode, _objects.activeMoonGroup].reduce((sum, entry) => sum + _countObjectPresence(entry), 0);
    stats.connectionGroupChildren = _countObjectPresence(_objects.connectionGroup);
    stats.spiralGroupChildren = _countObjectPresence(_objects.spiralGroup);
    stats.environmentGroupChildren = _countObjectPresence(_objects.environmentGroup);
    stats.patternGroupVisible = patternEntries.some(entry => entry?.visible !== false);

    if (_THREE && _scene && _camera) {
      const box = new _THREE.Box3().setFromObject(_scene);
      const min = box?.min;
      const max = box?.max;
      const finite = _isFiniteVec3(min) && _isFiniteVec3(max);
      if (finite) {
        stats.sceneBoundsFinite = true;
        stats.sceneBounds = {
          min: { x: Number(min.x), y: Number(min.y), z: Number(min.z) },
          max: { x: Number(max.x), y: Number(max.y), z: Number(max.z) },
        };
        const proj = new _THREE.Matrix4().multiplyMatrices(_camera.projectionMatrix, _camera.matrixWorldInverse);
        const frustum = new _THREE.Frustum();
        frustum.setFromProjectionMatrix(proj);
        stats.sceneIntersectsFrustum = frustum.intersectsBox(box);
      }
    }

    return stats;
  }

  function _validateSceneReadiness({ requireFirstFrame = false } = {}) {
    _enforceRendererHostContract();
    const stats = _collectSceneStats();
    const reasons = [];
    const expectedPattern = _visibleLayers?.pattern !== false;
    const expectedLunar = !!_visibleLayers?.lunar;
    const cameraValid = _camera
      && Number.isFinite(Number(_camera.near))
      && Number.isFinite(Number(_camera.far))
      && Number(_camera.near) > 0
      && Number(_camera.far) > Number(_camera.near)
      && _isFiniteVec3(_camera.position);

    if (!cameraValid) reasons.push("camera-invalid");
    if (stats.canvasWidth <= 0 || stats.canvasHeight <= 0) reasons.push("canvas-size-invalid");
    if (stats.sceneObjectCount <= 0) reasons.push("scene-empty");
    if (stats.visibleObjectCount < 6) reasons.push("visible-object-count-low");
    if ((stats.meshCount + stats.lineCount) < 6) reasons.push("renderable-count-low");
    if (expectedPattern && !_materialHasVisibleOpacity([_objects.patternRing?.material, _objects.dayNodes?.material])) reasons.push("pattern-material-opacity-invalid");
    if (expectedPattern && stats.patternGroupChildren < 3) reasons.push("pattern-geometry-missing");
    if (expectedLunar && stats.astronomyGroupChildren < 2) reasons.push("astronomy-geometry-missing");
    if (!stats.sceneBoundsFinite) reasons.push("scene-bounds-invalid");
    if (stats.sceneBoundsFinite && !stats.sceneIntersectsFrustum) reasons.push("scene-outside-frustum");
    if (requireFirstFrame && !_firstFrameTimestamp) reasons.push("first-frame-missing");
    if (_countUnexpectedHostChildren() > 0) reasons.push("renderer-host-contains-foreign-media");

    _lastSceneReadiness = {
      ready: reasons.length === 0,
      reasons: reasons.slice(0, 12),
      timestamp: Date.now(),
      stats,
    };
    return _lastSceneReadiness;
  }

  // B7.52 — stage historical/connection geometry after first paint. This keeps
  // the initial WebGL compile/build set small while preserving every layer once
  // the browser reaches an idle slice.
  function _scheduleDeferredVisualHydration() {
    if (_progressiveVisualsReady || _progressiveVisualsScheduled) return;
    _progressiveVisualsScheduled = true;
    const epoch = _initEpoch;

    const hydrate = () => {
      _progressiveVisualsScheduled = false;
      _progressiveVisualsHandle = null;
      if (!_initialized || epoch !== _initEpoch || !_scene) return;
      // Never land a historical geometry build in the middle of a finger drag.
      if (_cameraGestureActive) {
        setTimeout(() => _scheduleDeferredVisualHydration(), 180);
        return;
      }

      _progressiveVisualsReady = true;
      _lastSpiralGeometryKey = "";
      _connectionDiagnostics = [];
      try {
        updateScene(
          _model, _spiral, _selectedYear, _visibleLayers, _viewMode,
          _moonLabelMode, _moonLabelDistance, _dayLabelMode,
          _connectionRegistry, _motionMode, _semanticZoomState
        );
        render(performance.now());
        _pushInitTimeline("progressive-visuals-ready");
      } catch (error) {
        console.warn("[LivingTimeSphere] Progressive visual hydration failed.", error);
      }
      globalThis.LivingTimeSphereAnimation?.markDirty?.();
    };

    if (typeof globalThis.requestIdleCallback === "function") {
      _progressiveVisualsHandle = globalThis.requestIdleCallback(hydrate, { timeout: 700 });
    } else {
      _progressiveVisualsHandle = setTimeout(hydrate, 180);
    }
  }

  // B7.50 — progressive extension hydration. Life Atlas, historical strata and
  // other extension work may involve IndexedDB and geometry construction. None
  // of that is required to draw the core calendar, so it must never block the
  // first interactive frame.
  function _scheduleDeferredExtensionHydration() {
    if (_extensionsHydrated || _extensionsHydrationScheduled) return;
    const host = globalThis.LivingTimeSphereExtensionHost;
    if (!host?.mountAll) {
      _extensionsHydrated = true;
      return;
    }
    _extensionsHydrationScheduled = true;
    const epoch = _initEpoch;
    const hydrate = async () => {
      _extensionsHydrationScheduled = false;
      _extensionsHydrationHandle = null;
      if (!_initialized || epoch !== _initEpoch || !_scene) return;
      // Let the core + deferred visual field settle first, and never start an
      // IndexedDB/extension mount while the user is actively rotating.
      if (_cameraGestureActive || !_progressiveVisualsReady) {
        setTimeout(() => _scheduleDeferredExtensionHydration(), 220);
        return;
      }
      try {
        await host.mountAll(_extensionContext({ lifecycle: "deferred-mount" }));
        if (!_initialized || epoch !== _initEpoch) return;
        if (host.updateAll) {
          await host.updateAll(_extensionContext({ lifecycle: "deferred-initial-sync" }));
        }
        if (!_initialized || epoch !== _initEpoch) return;
        _extensionsHydrated = true;
        _pushInitTimeline("extensions-deferred-ready");
        render(performance.now());
        globalThis.LivingTimeSphereAnimation?.markDirty?.();
      } catch (error) {
        console.warn("[LivingTimeSphere] Deferred extension hydration failed.", error);
      }
    };
    if (typeof globalThis.requestIdleCallback === "function") {
      _extensionsHydrationHandle = globalThis.requestIdleCallback(
        () => { void hydrate(); },
        { timeout: _isTouchOptimizedSurface() ? 1400 : 650 }
      );
    } else {
      _extensionsHydrationHandle = setTimeout(() => { void hydrate(); }, 64);
    }
  }

  // ── Init / teardown ────────────────────────────────────────────────

  async function init({ container, model, spiral, quality, tier, generation, selectedYear, visibleLayers, viewMode, moonLabelMode, moonLabelDistance, dayLabelMode, connectionRegistry, motionMode, semanticZoomState, environmentState, reducedMotion, onYearSelect, onMarkerSelect, onContextLost: _onContextLostCb, onContextRestored: _onContextRestoredCb }) {
    // Guard against concurrent or duplicate init calls.
    if (_initializing || _initialized) {
      return { success: false, reason: "already-running" };
    }
    // A context-loss callback intentionally marks the renderer uninitialised,
    // but its prior canvas and GPU objects may still exist. Dispose that stale
    // generation before allocating another context, then remove any orphaned
    // renderer-owned canvases that are no longer reachable through `_canvas`.
    if (_canvas || _renderer || _scene || _camera) {
      try { teardown(); } catch { /* best-effort pre-init cleanup */ }
    }
    _pruneRendererOwnedCanvases(container, null, "pre-init-orphan-cleanup");
    _renderGeneration = Number.isFinite(Number(generation))
      ? Number(generation)
      : _renderGeneration + 1;
    const initEpoch = ++_initEpoch;
    const initGeneration = _renderGeneration;
    const initWasCancelled = () => initEpoch !== _initEpoch;
    const cancelledResult = () => ({
      success: false,
      reason: "INIT_CANCELLED",
      detail: `3D initialization generation ${initGeneration} was superseded.`,
    });
    _initializing = true;
    _countLifecycle("rendererInitCount");
    _resetStages();
    _initStartedAt = performance.now();
    _initEndedAt = null;
    _requestedDpr = typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1;
    _appliedDpr = null;
    _activeTier = tier || null;
    _restoreAttempts = 0;
    _firstFrameTimestamp = 0;
    _firstFramePixelProbe = null;
    _progressiveVisualsReady = false;
    _progressiveVisualsScheduled = false;
    if (_progressiveVisualsHandle != null) {
      try { globalThis.cancelIdleCallback?.(_progressiveVisualsHandle); } catch {}
      try { clearTimeout(_progressiveVisualsHandle); } catch {}
      _progressiveVisualsHandle = null;
    }
    _lastSolarProgressGeometryKey = "";
    _lastTodayLineGeometryKey = "";
    _lastActiveMoonGeometryKey = "";
    _contextLostAt = 0;
    _contextRestoredAt = 0;
    _contextLossCount = 0;
    _contextRestoreCount = 0;
    _initTimeline.length = 0;
    _pushInitTimeline("renderer-init-requested", { containerConnected: !!container?.isConnected });

    try {
      assertDeps();
      _markStage("capability", "running");

      if (!globalThis.LivingTimeSphereEffects.detectWebGl2?.()) {
        const capability = globalThis.ObservatoryCapabilityManager?.probeWebGl?.() || { webgl: false, webgl2: false };
        const reason = capability.webgl
          ? (globalThis.ObservatoryCapabilityManager?.FALLBACK_REASONS.WEBGL2_REQUIRED ?? "webgl2-required")
          : (globalThis.ObservatoryCapabilityManager?.FALLBACK_REASONS.WEBGL_UNSUPPORTED ?? "webgl-unavailable");
        _lastInitError = { reason, detail: capability.webgl ? "Three.js r167 requires WebGL2; only WebGL1 is available." : "WebGL context creation failed in this environment." };
        _markStage("capability", "failed");
        _initEndedAt = performance.now();
        return { success: false, reason, detail: _lastInitError.detail };
      }
      _markStage("capability", "ok");
      if (!quality) {
        const reason = globalThis.ObservatoryCapabilityManager?.FALLBACK_REASONS.QUALITY_SVGONLY ?? "quality-svgonly";
        _lastInitError = { reason, detail: "Quality preset resolved to SVG-only." };
        _markStage("renderer", "failed");
        _initEndedAt = performance.now();
        return { success: false, reason };
      }

      try {
        _markStage("module", "running");
        await loadThreeJs();
        if (initWasCancelled()) return cancelledResult();
        _markStage("module", "ok");
      } catch (err) {
        const reason = globalThis.ObservatoryCapabilityManager?.FALLBACK_REASONS.THREE_IMPORT_FAILED ?? "three-load-failed";
        _lastInitError = { reason, detail: String(err) };
        _markStage("module", "failed");
        _initEndedAt = performance.now();
        return { success: false, reason, detail: String(err) };
      }

      const THREE = _THREE;
      _container = container;
      _enforceRendererHostContract(container);

      // ── Canvas ────────────────────────────────────────────────────
      _canvas = document.createElement("canvas");
      _countLifecycle("canvasCreateCount");
      _canvas.className = "living-time-sphere-3d-canvas";
      _canvas.dataset.sphereRenderSurface = "webgl3d";
      _canvas.dataset.sphereRendererOwned = "true";
      _canvas.dataset.sphereRenderGeneration = String(_renderGeneration);
      _canvas.setAttribute("role", "img");
      _canvas.setAttribute("aria-label", "Living Time Sphere 3D view");
      _canvas.setAttribute("aria-describedby", "sphere-text-model");
      // touch-action: pan-y by default — vertical page scroll preserved.
      _canvas.style.touchAction = "pan-y";
      container.appendChild(_canvas);
      _pruneRendererOwnedCanvases(container, _canvas, "post-append-orphan-cleanup");
      _recordCanvasConnection("after-append");
      _enforceRendererHostContract(container);
      _ensureFloatingLabel(container);
      _pushInitTimeline("canvas-appended");

      // B7.52 — do not burn a guaranteed frame merely to measure a container
      // that is already laid out. Only yield when the first synchronous measure
      // is genuinely zero-sized.
      let rect = container.getBoundingClientRect();
      if (!(Number(rect.width) > 0 && Number(rect.height) > 0)) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        if (initWasCancelled()) return cancelledResult();
        rect = container.getBoundingClientRect();
      }
      const rawW = Number(rect.width || 0);
      const rawH = Number(rect.height || 0);
      _pushInitTimeline("container-first-measurable-size", { width: rawW, height: rawH });
      if (rawW <= 0 || rawH <= 0) {
        const reason = rawW <= 0 ? "CONTAINER_ZERO_WIDTH" : "CONTAINER_ZERO_HEIGHT";
        _lastInitError = { reason, detail: `Container measured as ${rawW}x${rawH} before renderer creation.` };
        if (_canvas && _canvas.parentNode) _canvas.parentNode.removeChild(_canvas);
        _canvas = null;
        _markStage("dimensions", "invalid");
        _initEndedAt = performance.now();
        return { success: false, reason, detail: _lastInitError.detail };
      }
      const w = Math.max(1, Math.round(rawW));
      const h = Math.max(1, Math.round(rawH));
      _markStage("dimensions", `${w}x${h}`);

      // ── Renderer ──────────────────────────────────────────────────
      // Use ObservatoryCapabilityManager.clampPixelRatio if a tier is known;
      // otherwise fall back to the quality-preset cap.  This ensures DPR is
      // always gated through the authoritative capability-manager path.
      const _dprTier = tier ?? (() => {
        const presets = globalThis.LivingTimeSphereM?.QUALITY_PRESETS;
        if (presets && quality === presets.high)      return "high";
        if (presets && quality === presets.lowpower)  return "lowpower";
        return "balanced";
      })();
      const rawDpr = typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1;
      const tierCappedDpr = globalThis.ObservatoryCapabilityManager
        ? globalThis.ObservatoryCapabilityManager.clampPixelRatio(
            _dprTier,
            rawDpr
          )
        : rawDpr;
      // B7.50 — a 600px phone instrument at DPR 2 renders ~1.4M pixels per
      // frame before post-processing. Cap settled mobile DPR as well as gesture
      // DPR; 1.25 remains crisp at this physical size and cuts fragment work by
      // more than half versus DPR 2.
      const mobileFastPath = _isTouchOptimizedSurface();
      const mobileSettledDprCap = mobileFastPath ? MOBILE_SETTLED_DPR_CAP : Infinity;
      const pixelRatio = Math.min(tierCappedDpr, Number(quality.pixelRatioMax ?? tierCappedDpr), rawDpr, mobileSettledDprCap);
      try {
        _markStage("renderer", "running");
        _pushInitTimeline("three-webgl-renderer-create-requested");
        const lowPowerRenderer = quality === globalThis.LivingTimeSphereM?.QUALITY_PRESETS?.lowpower;
        const powerPreference = lowPowerRenderer ? "low-power" : "high-performance";
        // MSAA is disproportionately expensive on dense phone canvases and the
        // instrument already uses line/point geometry that remains readable at
        // the adaptive DPR. Desktop keeps the authored quality preset.
        const antialias = mobileFastPath ? false : quality.antialias !== false;
        _activeWebGlContext = _canvas.getContext("webgl2", {
          alpha: false,
          antialias,
          depth: true,
          stencil: false,
          powerPreference,
          preserveDrawingBuffer: false,
        });
        if (!_activeWebGlContext) {
          const error = new Error("Authoritative WebGL2 context creation failed.");
          error.code = "WEBGL2_REQUIRED";
          throw error;
        }
        _canvas.dataset.sphereContextActive = "true";
        _renderer = new THREE.WebGLRenderer({
          canvas:    _canvas,
          context:   _activeWebGlContext,
          antialias,
          alpha:     false,
          powerPreference,
        });
      } catch (err) {
        // WebGLRenderer constructor can throw if context creation fails.
        const reason = err?.code === "WEBGL2_REQUIRED"
          ? (globalThis.ObservatoryCapabilityManager?.FALLBACK_REASONS.WEBGL2_REQUIRED ?? "webgl2-required")
          : (globalThis.ObservatoryCapabilityManager?.FALLBACK_REASONS.CANVAS_INIT_FAILED ?? "webgl-context-failed");
        _lastInitError = { reason, detail: String(err) };
        try { _activeWebGlContext?.getExtension?.("WEBGL_lose_context")?.loseContext?.(); } catch { /* best-effort cleanup */ }
        _activeWebGlContext = null;
        if (_canvas?.dataset) _canvas.dataset.sphereContextActive = "false";
        if (_canvas && _canvas.parentNode) _canvas.parentNode.removeChild(_canvas);
        _canvas = null;
        _markStage("renderer", "failed");
        _initEndedAt = performance.now();
        return { success: false, reason, detail: String(err) };
      }
      _markStage("renderer", "created");
      _pushInitTimeline("three-webgl-renderer-created");

      // Attach WebGL context-loss guard via ObservatoryCapabilityManager.
      // On context loss: stop the animation loop, mark renderer as not
      // initialized, and invoke the mount-layer callback so SVG fallback
      // activates immediately.
      // On restoration: invoke the mount-layer callback so it can
      // teardown stale resources and attempt a clean reinit.
      _contextLossDispose = globalThis.ObservatoryCapabilityManager?.attachContextLossGuard(_canvas, {
        onLost() {
          const reason = globalThis.ObservatoryCapabilityManager?.FALLBACK_REASONS.CONTEXT_LOST ?? "CONTEXT_LOST";
          _lastInitError = { reason, detail: "WebGL context was lost." };
          _markStage("context", "lost");
          _contextLostAt = Date.now();
          _contextLossCount += 1;
          _initialized = false;
          // Stop the animation loop so we don't render with a lost context.
          try { globalThis.LivingTimeSphereAnimation?.stop?.(); } catch { /* best-effort */ }
          console.warn(`[LivingTimeSphere] 3D context lost (${reason}). Activating SVG fallback.`);
          // Notify mount layer — mount will show SVG fallback.
          try { _onContextLostCb?.(); } catch { /* mount notification is best-effort */ }
        },
        onRestored() {
          _restoreAttempts += 1;
          _markStage("context", "restored");
          _contextRestoredAt = Date.now();
          _contextRestoreCount += 1;
          console.info("[LivingTimeSphere] WebGL context restored — notifying mount for reinit.");
          // Notify mount layer — mount will teardown stale resources and reinit.
          try { _onContextRestoredCb?.(); } catch { /* mount notification is best-effort */ }
        },
      }) ?? (() => {});
      _markStage("context", "active");
      _renderer.setPixelRatio(pixelRatio);
      _appliedDpr = pixelRatio;
      _quality = quality;

      _renderer.setSize(w, h);
      _recordCanvasConnection("after-setsize");
      _pushInitTimeline("renderer-set-size", { width: w, height: h });

      // ── Camera ────────────────────────────────────────────────────
      _markStage("camera", "running");
      _calendarDisclosureDirty = true;
      _camera = globalThis.LivingTimeSphereCamera.create(THREE, w, h);
      _countLifecycle("cameraCreateCount");
      _markStage("camera", "created");
      _pushInitTimeline("camera-aspect-updated", { aspect: Number(_camera?.aspect || 0) });
      globalThis.LivingTimeSphereCamera.onChangeCallback(() => {
        _calendarDisclosureDirty = true;
        _syncSemanticZoomFromCamera(false);
        _moonLabelManager?.markDirty();
        globalThis.LivingTimeSphereAnimation.markDirty();
      });

      // ── Build scene ───────────────────────────────────────────────
      _markStage("scene", "running");
      buildScene();
      _markStage("scene", "created");

      // ── Load initial data ─────────────────────────────────────────
      _environmentController.initialize(environmentState || globalThis.SofEnvironmentState?.getEnvironmentState?.() || EMPTY_ENVIRONMENT_STATE);
      _markStage("geometry", "running");
      updateScene(model, spiral, selectedYear, visibleLayers, viewMode, moonLabelMode, moonLabelDistance, dayLabelMode, connectionRegistry, motionMode, semanticZoomState);
      _markStage("geometry", "created");
      _syncCameraFocus(model, spiral, selectedYear, false);

      // B7.50: extension hydration no longer blocks first paint. The scheduler is
      // armed only after the core scene has passed readiness and become interactive.

      // ── Animation ─────────────────────────────────────────────────
      globalThis.LivingTimeSphereAnimation.applyPreset(quality);
      globalThis.LivingTimeSphereAnimation.setReducedMotion(reducedMotion || _prefersReducedMotion());
      globalThis.LivingTimeSphereAnimation.setLowPower(_motionMode === "still" || _dprTier === "lowpower");
      globalThis.LivingTimeSphereAnimation.attachPageVisibility();
      globalThis.LivingTimeSphereAnimation.attachIntersection(_canvas);

      // Start idle drift if quality allows
      if (motionMode === "drift" && quality.idleDrift && !_prefersReducedMotion()) {
        globalThis.LivingTimeSphereCamera.startDrift(performance.now());
      }

      globalThis.LivingTimeSphereAnimation.start(render, error => {
        _lastInitError = {
          reason: globalThis.ObservatoryCapabilityManager?.FALLBACK_REASONS.INIT_EXCEPTION ?? "init-exception",
          detail: `Animation frame failed: ${String(error)}`,
        };
        _initialized = false;
        try { _onContextLostCb?.(); } catch { /* mount notification is best-effort */ }
      });
      _countLifecycle("rafLoopStartCount");
      globalThis.LivingTimeSphereAnimation.markDirty();

      // ── Pointer interaction ────────────────────────────────────────
      _wirePointerEvents(container, onYearSelect, onMarkerSelect);
      _markStage("listeners", "attached");

      // Build Moon label anchors and set up DOM elements
      _buildMoonAnchors(viewMode);
      _setupMoonLabelEls(container);
      _moonLabelManager?.markDirty();
      _markStage("semanticZoom", "initialized");

      // ── Resize ────────────────────────────────────────────────────
      _wireResize(container);

      _markStage("firstFrame", "requested");
      try {
        await new Promise((resolve, reject) => {
          requestAnimationFrame(() => {
            if (initWasCancelled()) { resolve(); return; }
            _pushInitTimeline("first-request-animation-frame");
            try {
              _pushInitTimeline("first-render-call");
              render(performance.now());
              resolve();
            } catch (e) {
              reject(e);
            }
          });
        });
        if (initWasCancelled()) return cancelledResult();
        _markStage("firstFrame", "rendered");
        _firstFrameTimestamp = Date.now();
        _recordCanvasConnection("after-first-frame");
        _pushInitTimeline("first-frame-completed");
        // B7.51 — non-critical UI/import tooling begins only after the core
        // WebGL calendar is already visible and interactive.
        container.dispatchEvent?.(new CustomEvent("sof:sphere-first-frame", {
          bubbles: true,
          detail: { timestamp: _firstFrameTimestamp }
        }));
        _probeFirstFramePixelHealth();
      } catch (err) {
        _markStage("firstFrame", "failed");
        _lastInitError = {
          reason: globalThis.ObservatoryCapabilityManager?.FALLBACK_REASONS.INIT_EXCEPTION ?? "init-exception",
          detail: `First-frame render failed: ${String(err)}`,
        };
        teardown();
        _initEndedAt = performance.now();
        return { success: false, reason: _lastInitError.reason, detail: _lastInitError.detail };
      }

      let readiness = _validateSceneReadiness({ requireFirstFrame: true });
      if (!readiness?.ready) {
        try {
          updateScene(model, spiral, selectedYear, visibleLayers, viewMode, moonLabelMode, moonLabelDistance, dayLabelMode, connectionRegistry, motionMode, semanticZoomState);
          render(performance.now());
        } catch { /* best-effort recovery pass */ }
        readiness = _validateSceneReadiness({ requireFirstFrame: true });
      }
      if (!readiness?.ready) {
        _markStage("geometry", "failed");
        _lastInitError = {
          reason: "SCENE_CONTENT_INCOMPLETE",
          detail: `3D scene readiness gate failed: ${(readiness?.reasons || []).join(", ") || "unknown"}`,
        };
        teardown();
        _initEndedAt = performance.now();
        return { success: false, reason: _lastInitError.reason, detail: _lastInitError.detail };
      }

      _initialized = true;
      _lastInitError = null;
      _scheduleDeferredVisualHydration();
      _scheduleDeferredExtensionHydration();

      // Apply the newest state that arrived while Three.js was loading. Without
      // this handoff a fast first temporal sync can be dropped and only become
      // visible after Play or another later interaction forces a refresh.
      const pendingRefresh = _pendingRefresh;
      _pendingRefresh = null;
      if (pendingRefresh?.model) {
        _pushInitTimeline("pending-refresh-commit", {
          selectedYear: Number(pendingRefresh.selectedYear || 0),
          viewMode: pendingRefresh.viewMode || "today"
        });
        refresh(
          pendingRefresh.model,
          pendingRefresh.spiral,
          pendingRefresh.selectedYear,
          pendingRefresh.visibleLayers,
          pendingRefresh.viewMode,
          pendingRefresh.moonLabelMode,
          pendingRefresh.moonLabelDistance,
          pendingRefresh.dayLabelMode,
          pendingRefresh.connectionRegistry,
          pendingRefresh.motionMode,
          pendingRefresh.semanticZoomState
        );
        render(performance.now());
      }

      _recordCanvasConnection("lifecycle-transition-ready");
      _initEndedAt = performance.now();
      return { success: true };

    } catch (err) {
      if (initWasCancelled()) return cancelledResult();
      const failure = { reason: globalThis.ObservatoryCapabilityManager?.FALLBACK_REASONS.INIT_EXCEPTION ?? "init-exception", detail: String(err) };
      _lastInitError = failure;
      _markStage("renderer", "failed");
      _initEndedAt = performance.now();
      teardown();
      _lastInitError = failure;
      return { success: false, reason: failure.reason, detail: failure.detail };
    } finally {
      if (initEpoch === _initEpoch) _initializing = false;
    }
  }

  // B7.52.1 — shared mobile/touch capability helper. B7.52 accidentally
  // scoped this inside _wirePointerEvents even though init, deferred hydration,
  // DPR governance and quality paths all call it. Keep one module-level
  // authority so first-frame initialization cannot fail before a canvas exists.
  function _isTouchOptimizedSurface() {
    try {
      return window.innerWidth < 900 || window.matchMedia?.("(pointer: coarse)")?.matches;
    } catch {
      return typeof window !== "undefined" ? window.innerWidth < 900 : false;
    }
  }

  function _prefersReducedMotion() {
    try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
  }

  function _detachPointerEvents() {
    _pointerEventDisposers.splice(0).forEach(dispose => {
      try { dispose(); } catch { /* best-effort listener cleanup */ }
    });
  }

  function _wirePointerEvents(container, onYearSelect, onMarkerSelect) {
    _detachPointerEvents();
    const listen = (target, type, handler, options) => {
      if (!target?.addEventListener) return;
      target.addEventListener(type, handler, options);
      _pointerEventDisposers.push(() => target.removeEventListener(type, handler, options));
    };
    let pinchActive   = false;
    let pinchDist0    = 0;
    let pinchAngle0   = 0;
    let twistTheta0   = 0;
    let twistActive   = false;
    let pointerCache  = new Map();
    let panCentroid0  = null;
    let interactMode  = false;    // on small screens, require explicit engage
    const TWIST_DEADZONE = 0.09;

    // B7.35 — pointer events can arrive much faster than the display refresh
    // rate. Coalesce camera mutations to one transaction per animation frame so
    // a two-finger gesture does one projection update instead of twist+pinch+pan
    // each independently forcing layout/render work.
    let gestureRaf = null;
    let pendingSinglePointer = null;

    function _flushGestureFrame() {
      if (gestureRaf != null) {
        cancelAnimationFrame(gestureRaf);
        gestureRaf = null;
      }
      const Camera = globalThis.LivingTimeSphereCamera;
      if (!Camera) return;

      if (pointerCache.size === 2) {
        const pts = [...pointerCache.values()];
        const d = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
        const dx = pts[1].clientX - pts[0].clientX;
        const dy = pts[1].clientY - pts[0].clientY;
        const angle = Math.atan2(dy, dx);
        const twistDelta = _angleDelta(angle, pinchAngle0);
        const cx = (pts[0].clientX + pts[1].clientX) / 2;
        const cy = (pts[0].clientY + pts[1].clientY) / 2;
        Camera.batch?.(() => {
          if (Math.abs(twistDelta) > TWIST_DEADZONE || twistActive) {
            twistActive = true;
            Camera.setState?.({ theta: twistTheta0 - twistDelta });
          }
          Camera.onPinchMove(d);
          Camera.onPanMove?.(cx, cy);
        });
        panCentroid0 = { x: cx, y: cy };
        globalThis.LivingTimeSphereAnimation.markDirty();
        return;
      }

      if (pendingSinglePointer && interactMode) {
        const { x, y } = pendingSinglePointer;
        pendingSinglePointer = null;
        const moved = Camera.onPointerMove(x, y);
        if (moved) globalThis.LivingTimeSphereAnimation.markDirty();
      }
    }

    function _scheduleGestureFrame() {
      if (gestureRaf != null) return;
      gestureRaf = requestAnimationFrame(() => {
        gestureRaf = null;
        _flushGestureFrame();
      });
    }

    function _angleDelta(now, start) {
      let delta = now - start;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      return delta;
    }

    function _applyGestureVisualBudget(active) {
      if (!_objects) return;
      if (active) {
        // B7.48: while the finger is moving, keep the calendar, Today, lunar/solar
        // reference and schedule atlas; suspend decorative/high-overdraw layers.
        for (const object of [
          _objects.starField, _objects.hazeShell, _objects.planetaryGroup,
          _objects.environmentGroup, _objects.connectionGroup, _objects.recurrenceGroup,
          _objects.spiralGroup
        ]) {
          if (object) object.visible = false;
        }
      } else {
        _applyLayerVisibility(_visibleLayers, _semanticZoomState || { band: "medium", visibility: {} });
        _applyModeVisibilityOverrides(_visibleLayers);
        if (_objects.starField) _objects.starField.visible = Number(_quality?.starCount || 0) > 0;
        if (_objects.hazeShell) _objects.hazeShell.visible = _quality?.glow !== false;
      }
    }

    function setCameraGestureActive(active) {
      _cameraGestureActive = !!active;
      // B7.51: interaction changes the mobile disclosure aperture (1 Moon while
      // moving, 3 after settle), so dates + symbols + Moon numbers update once.
      _calendarDisclosureDirty = true;
      if (_labelSettleTimer) { clearTimeout(_labelSettleTimer); _labelSettleTimer = null; }
      container.classList?.toggle?.("is-camera-gesture-active", _cameraGestureActive);
      _applyGestureVisualBudget(_cameraGestureActive);

      // B7.48 — interaction resolution scaling. On touch devices, rendering at a
      // high device DPR while the camera is moving wastes fill-rate on pixels the
      // eye cannot inspect. Temporarily render near 1× during the gesture, then
      // restore full quality once motion settles. This changes no geometry/state.
      if (_renderer && _isTouchOptimizedSurface()) {
        if (_cameraGestureActive) {
          if (_gestureRestoreDpr == null) _gestureRestoreDpr = Number(_appliedDpr || 1);
          const gestureDpr = Math.min(
            Number(_gestureRestoreDpr || 1),
            _activeTier === "lowpower" ? MOBILE_GESTURE_DPR_LOWPOWER : MOBILE_GESTURE_DPR_CAP
          );
          if (Math.abs(Number(_appliedDpr || 1) - gestureDpr) > 0.01) {
            _renderer.setPixelRatio(gestureDpr);
            _appliedDpr = gestureDpr;
          }
        } else if (_gestureRestoreDpr != null) {
          const restoreDpr = _gestureRestoreDpr;
          _gestureRestoreDpr = null;
          _renderer.setPixelRatio(restoreDpr);
          _appliedDpr = restoreDpr;
        }
      }

      if (!_cameraGestureActive) {
        _labelSettleTimer = setTimeout(() => {
          _lastLabelProjectionKey = "";
          _updateMoonLabels(_viewMode, performance.now(), true);
          globalThis.LivingTimeSphereAnimation?.markDirty?.();
        }, 90);
      }
    }

    function enterInteractMode() {
      interactMode = true;
      if (_canvas) _canvas.style.touchAction = "none";
      if (_isTouchOptimizedSurface()) {
        const interactionFps = _activeTier === "lowpower"
          ? MOBILE_INTERACTION_FPS_LOWPOWER
          : MOBILE_INTERACTION_FPS;
        globalThis.LivingTimeSphereAnimation?.setInteractionActive?.(true, interactionFps);
      }
      container.dispatchEvent(new CustomEvent("sphere:interact-start", { bubbles: true }));
    }
    function exitInteractMode() {
      interactMode = false;
      if (_canvas) _canvas.style.touchAction = "pan-y";
      globalThis.LivingTimeSphereCamera.onPointerUp();
      globalThis.LivingTimeSphereCamera.onPanEnd?.();
      globalThis.LivingTimeSphereAnimation?.setInteractionActive?.(false);
      if (_motionMode === "drift" && _quality?.idleDrift && !_prefersReducedMotion()) {
        globalThis.LivingTimeSphereCamera.startDrift(performance.now());
      }
      container.dispatchEvent(new CustomEvent("sphere:interact-end", { bubbles: true }));
    }

    listen(container, "sphere:interact-request-start", () => {
      enterInteractMode();
    });
    listen(container, "sphere:interact-request-end", () => {
      exitInteractMode();
    });

    listen(_canvas, "pointerdown", e => {
      _hideFloatingLabel();
      pointerCache.set(e.pointerId, e);
      setCameraGestureActive(true);

      if (pointerCache.size === 2) {
        // Pinch start
        const pts = [...pointerCache.values()];
        const dx = pts[1].clientX - pts[0].clientX;
        const dy = pts[1].clientY - pts[0].clientY;
        const d = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
        pinchDist0 = d;
        pinchAngle0 = Math.atan2(dy, dx);
        twistTheta0 = Number(globalThis.LivingTimeSphereCamera?.getState?.().theta) || 0;
        twistActive = false;
        globalThis.LivingTimeSphereCamera.onPinchStart(d);
        panCentroid0 = { x: (pts[0].clientX + pts[1].clientX) / 2, y: (pts[0].clientY + pts[1].clientY) / 2 };
        globalThis.LivingTimeSphereCamera.onPanStart?.(panCentroid0.x, panCentroid0.y);
        pinchActive = true;
        enterInteractMode();
        e.preventDefault();
        return;
      }

      // On narrow screens (< 480 px), require deliberate interact mode
      if (window.innerWidth < 480 && !interactMode) return;

      enterInteractMode();
      globalThis.LivingTimeSphereCamera.onPointerDown(e.clientX, e.clientY);
      _canvas.setPointerCapture(e.pointerId);
      globalThis.LivingTimeSphereAnimation.markDirty();
      e.preventDefault();
    });

    listen(_canvas, "pointermove", e => {
      pointerCache.set(e.pointerId, e);

      if (pointerCache.size === 2) {
        _scheduleGestureFrame();
        e.preventDefault();
        return;
      }

      if (!interactMode) return;
      pendingSinglePointer = { x: e.clientX, y: e.clientY };
      _scheduleGestureFrame();
      e.preventDefault();
    }, { passive: false });

    listen(_canvas, "pointerup", e => {
      _flushGestureFrame();
      pointerCache.delete(e.pointerId);
      if (pinchActive && pointerCache.size < 2) {
        globalThis.LivingTimeSphereCamera.onPinchEnd();
        globalThis.LivingTimeSphereCamera.onPanEnd?.();
        panCentroid0 = null;
        pinchActive = false;
        pinchDist0 = 0;
        pinchAngle0 = 0;
        twistActive = false;
        if (pointerCache.size === 1) {
          const [remaining] = pointerCache.values();
          if (remaining) globalThis.LivingTimeSphereCamera.onPointerDown(remaining.clientX, remaining.clientY);
        }
      }
      if (pointerCache.size === 0 && interactMode) {
        setCameraGestureActive(false);
        // B7.3: releasing the finger ends camera motion, not interaction mode.
        // The explicit Exit button returns page scrolling. This keeps the
        // sphere controllable across repeated gestures without re-arming it.
        globalThis.LivingTimeSphereCamera.onPointerUp();
        globalThis.LivingTimeSphereCamera.onPanEnd?.();
        globalThis.LivingTimeSphereCamera.stopDrift?.();
        globalThis.LivingTimeSphereAnimation?.setInteractionActive?.(false);
      }
      // While interaction mode is armed the camera must stop when the user
      // stops. Idle drift may resume only after explicit Exit Interaction.
      if (!interactMode && _motionMode === "drift" && _quality?.idleDrift && !_prefersReducedMotion()) {
        globalThis.LivingTimeSphereCamera.startDrift(performance.now());
      }
    });

    listen(_canvas, "pointercancel", e => {
      pointerCache.delete(e.pointerId);
      if (pointerCache.size === 0) setCameraGestureActive(false);
      globalThis.LivingTimeSphereCamera.onPointerUp();
      globalThis.LivingTimeSphereCamera.onPanEnd?.();
      globalThis.LivingTimeSphereCamera.onPinchEnd();
      globalThis.LivingTimeSphereAnimation?.setInteractionActive?.(false);
      pinchActive = false;
      pinchDist0 = 0;
      pinchAngle0 = 0;
      twistActive = false;
      // Cancellation stops movement but preserves the explicitly armed mode.
      // Only the Exit Interaction control leaves interaction mode.
      globalThis.LivingTimeSphereCamera.stopDrift?.();
    });

    // Wheel zoom (desktop)
    listen(_canvas, "wheel", e => {
      globalThis.LivingTimeSphereCamera.onWheel(e);
      globalThis.LivingTimeSphereAnimation.markDirty();
      e.preventDefault();
    }, { passive: false });

    // Raycasting for marker selection on click
    let _clickStart = { x: 0, y: 0 };
    listen(_canvas, "pointerdown", e => {
      if (pointerCache.size === 1) { _clickStart = { x: e.clientX, y: e.clientY }; }
    });
    listen(_canvas, "pointerup", e => {
      const dx = Math.abs(e.clientX - _clickStart.x);
      const dy = Math.abs(e.clientY - _clickStart.y);
      if (dx < 6 && dy < 6) _handleClick(e, onYearSelect, onMarkerSelect);
    });
  }

  function _getMarkerLabel(type) {
    if (!_model) return "";
    const tp = _model.todayPatternPosition;
    if (type === "today") {
      if (tp && tp.moon != null) {
        return `Today\nMoon ${tp.moon} · Day ${tp.day}\nDay ${tp.dayOfPatternYear}/364`;
      }
      return "Today";
    }
    if (type === "equinox") {
      return `Equinox Gate\n${_model.year} March Equinox\nAngle ${_model.passageStartAngle?.toFixed(1)}°`;
    }
    if (type === "yearGate") {
      return "Year Gate\nMoon 1 · Day 1\nAngle 0°";
    }
    if (type === "lunar") {
      return `Lunar Position\n${_model.markers?.lunarMarker?.label || "Lunar marker"}\n${_model.markers?.lunarMarker?.detail || ""}`;
    }
    if (type === "selected-day") {
      const selected = _model?.selectedPatternPosition;
      if (selected?.moon != null) {
        return `Selected Day\nMoon ${selected.moon} · Day ${selected.day}\nDay ${selected.dayOfPatternYear}/364`;
      }
      return "Selected Day";
    }
    if (type === "solar-selected") {
      const selected = _model?.selectedPatternPosition;
      return `Selected\nSeasonal position (approx.)\n${selected?.solar?.gate || "Solar position"} ${selected?.solar?.element ? `· ${selected.solar.element}` : ""}`;
    }
    if (type === "lunar-selected") {
      const selected = _model?.selectedPatternPosition;
      return `Selected Lunar\n${selected?.lunarPhase || "Lunar state"}\n${selected?.lunarIllumination != null ? `${selected.lunarIllumination}%` : ""}`;
    }
    return type;
  }

  function _ensureFloatingLabel(container) {
    if (!_floatingLabelEl) {
      _floatingLabelEl = document.createElement("div");
      _floatingLabelEl.className = "sphere-floating-label";
      _floatingLabelEl.style.cssText = "position:absolute;pointer-events:none;display:none;z-index:40;background:rgba(4,8,13,.985);border:1px solid rgba(163,211,211,.30);border-radius:.72rem;box-shadow:0 10px 30px rgba(0,0,0,.72);padding:.42rem .58rem;color:#edf9f6;isolation:isolate;";
      container.style.position = "relative";
      container.appendChild(_floatingLabelEl);
    }
  }

  function _showFloatingLabel(worldPos, text, clientX, clientY) {
    if (!_floatingLabelEl || !_camera || !_canvas) return;
    const rect = _canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    _floatingLabelEl.innerHTML = text.replace(/\n/g, "<br>");
    _floatingLabelEl.style.display = "block";
    const width = _floatingLabelEl.offsetWidth || 170;
    const height = _floatingLabelEl.offsetHeight || 62;
    const left = Math.max(8, Math.min(rect.width - width - 8, x + 12));
    const top = Math.max(8, Math.min(rect.height - height - 8, y - 12));
    _floatingLabelEl.style.left = `${left}px`;
    _floatingLabelEl.style.top  = `${top}px`;
    if (_floatingTimeout) clearTimeout(_floatingTimeout);
    _floatingTimeout = setTimeout(() => {
      if (_floatingLabelEl) _floatingLabelEl.style.display = "none";
    }, 4000);
  }

  function _hideFloatingLabel() {
    if (_floatingLabelEl) _floatingLabelEl.style.display = "none";
    if (_floatingTimeout) clearTimeout(_floatingTimeout);
  }

  function _extensionPickContext(
    event
  ) {
    if (
      !_camera
      || !_renderer
      || !_canvas
    ) {
      return null;
    }

    const THREE =
      globalThis.THREE;

    if (
      !THREE?.Raycaster
      || !THREE?.Vector2
    ) {
      return null;
    }

    const rect =
      _canvas.getBoundingClientRect();

    if (
      !rect.width
      || !rect.height
    ) {
      return null;
    }

    const pointer =
      new THREE.Vector2(
        (
          (
            event.clientX
            - rect.left
          )
          / rect.width
        ) * 2 - 1,

        -(
          (
            event.clientY
            - rect.top
          )
          / rect.height
        ) * 2 + 1
      );

    const raycaster =
      new THREE.Raycaster();

    raycaster.setFromCamera(
      pointer,
      _camera
    );

    return {
      THREE,
      scene:
        _scene,
      camera:
        _camera,
      renderer:
        _renderer,
      container:
        _container,
      model:
        _model,
      spiral:
        _spiral,
      selectedYear:
        _selectedYear,
      viewMode:
        _viewMode,
      visibleLayers:
        _visibleLayers,
      semanticZoomState:
        _semanticZoomState,
      tier:
        _activeTier,
      raycaster,
      ray:
        raycaster.ray,
      pointer: {
        x:
          pointer.x,
        y:
          pointer.y,
        clientX:
          event.clientX,
        clientY:
          event.clientY,
        pointerType:
          event.pointerType
          || "mouse"
      },
      requestRender() {
        globalThis
          .LivingTimeSphereAnimation
          ?.markDirty?.();
      }
    };
  }

  function _handleExtensionPick(
    event,
    onMarkerSelect
  ) {
    const host =
      globalThis
        .LivingTimeSphereExtensionHost;

    if (
      !host?.pickAll
    ) {
      return false;
    }

    const context =
      _extensionPickContext(
        event
      );

    if (!context) {
      return false;
    }

    const result =
      host.pickAll(
        context
      );

    if (
      !result
      || result.handled === false
    ) {
      return false;
    }

    if (
      result.type === "year"
      && Number.isFinite(
        Number(result.year)
      )
    ) {
      onMarkerSelect?.({
        type:
          "temporal-year",
        year:
          Number(result.year),
        patternDay:
          Number(
            result.patternDay
          )
          || null,
        source:
          result.extensionId
          || "extension",
        semanticRole:
          result.semanticRole
          || null,
        metadata:
          result
      });

      return true;
    }

    onMarkerSelect?.({
      type:
        result.type
        || "extension",
      source:
        result.extensionId
        || "extension",
      metadata:
        result
    });

    return true;
  }

  function _handleClick(e, onYearSelect, onMarkerSelect) {
    /* B7.14: base calendar picking owns empty sphere taps. Scheduled/Life
     * Atlas extensions are consulted only after explicit marker raycasts, so
     * transparent schedule hit targets can never hijack an arbitrary day tap. */
    if (!_renderer || !_scene || !_camera || !_THREE) return;
    const THREE = _THREE;
    const rect  = _canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width)  * 2 - 1,
      -((e.clientY - rect.top)  / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, _camera);

    const namedMarkers = [
      _objects.todayMarker,
      _objects.selectedDayMarker,
      _objects.equinoxGate,
      _objects.yearGate,
      _objects.lunarMarker,
      _objects.solarSelectedMarker,
      _objects.lunarSelectedMarker,
      ...(_objects.planetMarkers || []),
      ...(_objects.locationSeasonGates || [])
    ].filter(Boolean).filter(m => m.visible);
    const namedHits = raycaster.intersectObjects(namedMarkers);
    if (namedHits.length > 0) {
      const obj = namedHits[0].object;
      const type = obj.name === "todayMarker" ? "today"
                 : obj.name === "selectedDayMarker" ? "selected-day"
                 : obj.name === "equinoxGate" ? "equinox"
                 : obj.name === "yearGate"    ? "yearGate"
                 : obj.name === "lunarMarker" ? "lunar"
                 : obj.name === "solarSelectedMarker" ? "solar-selected"
                 : obj.name === "lunarSelectedMarker" ? "lunar-selected"
                 : obj.userData?.type === "planet" ? "planet"
                 : obj.userData?.type === "season-gate" ? "season-gate"
                 : "unknown";
      const markerText = type === "planet"
        ? `${obj.userData?.glyph || ""} ${obj.userData?.name || "Planet"}\n${Number(obj.userData?.longitude || 0).toFixed(1)}° ecliptic longitude${Number.isFinite(Number(obj.userData?.latitude)) ? ` · ${Number(obj.userData.latitude).toFixed(1)}° latitude` : ""}\n${obj.userData?.approximate ? "Approximate low-precision position" : "Ephemeris position"}`
        : type === "season-gate"
          ? `${obj.userData?.label || "Seasonal gate"}\n${obj.userData?.seasonAfterGate ? `Begins ${obj.userData.seasonAfterGate} for this location` : "Seasonal boundary"}`
          : _getMarkerLabel(type);
      _showFloatingLabel(obj.position, markerText, e.clientX, e.clientY);
      if (onMarkerSelect) onMarkerSelect({ type, year: _model?.year, metadata: obj.userData || null });
      return;
    }

    const markers = (_objects.spiralMarkers || []).filter(m => m.visible);
    const hits    = raycaster.intersectObjects(markers);
    if (hits.length > 0) {
      const year = hits[0].object.userData.year;
      if (year && onYearSelect) onYearSelect(year);
      if (year && onMarkerSelect) onMarkerSelect({ type: "year", year });
      // B7.30 — selecting historical geometry is allowed, but no floating
      // year bubble is drawn over the calendar. The navigator above the sphere
      // is the authoritative year readout/control.
      return;
    }

    const extensionHit =
      globalThis
        .LivingTimeSphereExtensionHost
        ?.pickAll?.(
          _extensionContext({
            lifecycle:
              "pointer-select",

            raycaster,

            pointer: {
              clientX:
                e.clientX,
              clientY:
                e.clientY
            }
          })
        );

    if (
      extensionHit?.handled
    ) {
      const worldPosition =
        extensionHit.position || {
          x: 0,
          y: 0,
          z: 0
        };

      _showFloatingLabel(
        new THREE.Vector3(
          Number(worldPosition.x) || 0,
          Number(worldPosition.y) || 0,
          Number(worldPosition.z) || 0
        ),
        extensionHit.label ||
          "Life Atlas",
        e.clientX,
        e.clientY
      );

      onMarkerSelect?.({
        type:
          extensionHit.type ||
          "life-atlas-world",

        year:
          extensionHit.temporal
            ?.patternYear ??
          extensionHit.temporal
            ?.year ??
          _model?.year,

        metadata:
          extensionHit
      });

      globalThis
        .LivingTimeSphereAnimation
        ?.markDirty?.();

      return;
    }

    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const point = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, point)) {
      return;
    }

    const radius = Math.hypot(point.x, point.z);
    const patternRadius = globalThis.LivingTimeSphereM?.SIZES?.patternRing || 1;
    const angle = ((Math.atan2(point.z, point.x) * 180) / Math.PI + 90 + 360) % 360;

    // B7.19: the readable 13 × 4 × 7 matrix is a first-class pick surface. A
    // tap near any calendar cell resolves to that exact Pattern day even when
    // the numeral is hidden by LOD. Scheduled markers are raycast first.
    const calendarGeometry = globalThis.LivingTimeSphereCalendarGeometry;
    const matrixHit = calendarGeometry?.nearestCalendarCell?.(
      angle,
      radius / patternRadius,
      { maxDistance: 0.12 }
    );
    if (matrixHit) {
      const dayOfPatternYear = Number(matrixHit.dayOfPatternYear);
      const moon = Number(matrixHit.moon);
      const day = Number(matrixHit.moonDay);
      const summary = globalThis.LifeAtlasRecordSphereExtension?.plannerDaySummary?.(
        Number(_selectedYear || _model?.year || new Date().getFullYear()),
        dayOfPatternYear
      ) || { count: 0 };
      globalThis.LivingTimeSphereUi?.selectDay?.(dayOfPatternYear, {
        source: "sphere-calendar-matrix",
        marker: `day-${dayOfPatternYear}`
      });
      if (onMarkerSelect) onMarkerSelect({
        type: "day", moon, day, dayOfPatternYear,
        metadata: { ...matrixHit, scheduleCount: Number(summary.count) || 0 }
      });
      const scheduleLine = summary.count
        ? `\n${summary.count} scheduled${summary.primaryTitle ? ` · ${summary.primaryTitle}` : ""}`
        : "";
      _showFloatingLabel(
        point,
        `Selected Day\nMoon ${moon} · Day ${day}\nDay ${dayOfPatternYear}/364${scheduleLine}`,
        e.clientX, e.clientY
      );
      return;
    }

    if (radius >= patternRadius * 0.82 && radius <= patternRadius * 1.12) {
      const dayOfPatternYear = globalThis.LivingTimeSphereModel?.dayOfYearForPatternAngle
        ? globalThis.LivingTimeSphereModel.dayOfYearForPatternAngle(angle)
        : Math.max(1, Math.min(364, Math.floor((angle / 360) * 364) + 1));
      const moon = Math.max(1, Math.min(13, Math.floor((dayOfPatternYear - 1) / 28) + 1));
      const day = ((dayOfPatternYear - 1) % 28) + 1;
      const metadataBase = globalThis.LivingTimeSphereModel?.dayMetadataForDayOfYear
        ? globalThis.LivingTimeSphereModel.dayMetadataForDayOfYear(dayOfPatternYear)
        : { type: "living-day", moon, day, dayOfPatternYear };
      const metadata = { ...metadataBase };
      if (globalThis.PatternCalendar?.epochForYear && _model?.year) {
        const epoch = globalThis.PatternCalendar.epochForYear(_model.year);
        if (epoch instanceof Date && !Number.isNaN(epoch.getTime())) {
          const date = new Date(epoch.getTime() + (dayOfPatternYear - 1) * 86400000);
          metadata.civilDate = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
        }
      }
      if (onMarkerSelect) onMarkerSelect({ type: "day", moon, day, dayOfPatternYear, metadata });
      _showFloatingLabel(point, `Selected Day\nMoon ${moon} · Day ${day}\nDay ${dayOfPatternYear}/364`, e.clientX, e.clientY);
      return;
    }

    if (radius >= patternRadius * 0.35 && radius < patternRadius * 0.82) {
      const moon = Math.max(1, Math.min(13, Math.floor((angle / 360) * 13) + 1));
      if (onMarkerSelect) onMarkerSelect({ type: "moon", moon, day: 1 });
      _showFloatingLabel(point, `Moon ${moon}\nTap outer ring for a day`, e.clientX, e.clientY);
    }
  }

  function _wireResize(container) {
    if (typeof ResizeObserver === "undefined") return;
    _resizeObserver?.disconnect?.();
    _lastResizeWidth = 0;
    _lastResizeHeight = 0;
    _countLifecycle("resizeObserverCreateCount");
    _resizeObserver = new ResizeObserver(() => {
      if (!_renderer || !_canvas || !_camera) return;
      const rect = container.getBoundingClientRect();
      const w    = Math.round(Math.max(rect.width  || 320, 100));
      const h    = Math.round(Math.max(rect.height || 320, 100));
      if (w === _lastResizeWidth && h === _lastResizeHeight) return;
      _lastResizeWidth = w;
      _lastResizeHeight = h;
      _renderer.setSize(w, h);
      globalThis.LivingTimeSphereCamera.resize(w, h);
      _moonLabelManager?.markDirty();
      globalThis.LivingTimeSphereAnimation.markDirty();
    });
    _resizeObserver.observe(container);
  }

  // ── Public API ────────────────────────────────────────────────────

  function refresh(model, spiral, selectedYear, visibleLayers, viewMode, moonLabelMode, moonLabelDistance, dayLabelMode, connectionRegistry, motionMode, semanticZoomState) {
    if (!_initialized) {
      if (_initializing) {
        _pendingRefresh = {
          model, spiral, selectedYear, visibleLayers, viewMode,
          moonLabelMode, moonLabelDistance, dayLabelMode,
          connectionRegistry, motionMode, semanticZoomState
        };
        _pushInitTimeline("refresh-queued-during-init", {
          selectedYear: Number(selectedYear || 0),
          viewMode: viewMode || "today"
        });
      }
      return;
    }
    updateScene(model, spiral, selectedYear, visibleLayers, viewMode, moonLabelMode, moonLabelDistance, dayLabelMode, connectionRegistry, motionMode, semanticZoomState);

    // A general model refresh must also synchronize selection-dependent
    // geometry. The canonical model may have a new selectedPatternPosition
    // even when the scene topology itself has not changed.
    //
    // Keep Today and Selected Day independent:
    // - updateScene() maintains the general/live scene
    // - updateSelectedState() moves selection-specific markers/highlights
    updateSelectedState({
      model,
      selectedYear,
      visibleLayers,
      viewMode,
      moonLabelMode,
      moonLabelDistance,
      dayLabelMode,
      connectionRegistry,
      motionMode,
      semanticZoomState,
      skipCameraFocus: true,
    });

    if (
      globalThis.LivingTimeSphereExtensionHost?.updateAll
    ) {
      void globalThis.LivingTimeSphereExtensionHost.updateAll(
        _extensionContext({
          lifecycle: "refresh"
        })
      );
    }

    const readiness = _validateSceneReadiness({ requireFirstFrame: true });
    if (!readiness?.ready) {
      _lastInitError = {
        reason: "SCENE_CONTENT_INCOMPLETE",
        detail: `Refresh readiness failed: ${(readiness.reasons || []).join(", ") || "unknown"}`,
      };
    }
    globalThis.LivingTimeSphereAnimation.markDirty();
  }

  function updateSelectedState({
    model,
    selectedYear = _selectedYear,
    visibleLayers = _visibleLayers,
    viewMode = _viewMode,
    moonLabelMode = _moonLabelMode,
    moonLabelDistance = _moonLabelDistance,
    dayLabelMode = _dayLabelMode,
    connectionRegistry = _connectionRegistry,
    motionMode = _motionMode,
    semanticZoomState = _semanticZoomState,
    skipCameraFocus = true,
  } = {}) {
    if (!_initialized || !_scene || !model) return false;
    const mat = globalThis.LivingTimeSphereM;
    const updateStartedAt = performance.now();
    _countLifecycle("selectedStateUpdateCount");
    _lastLayerUpdateType = "selected-state-update";
    _lastSceneBuildTimestamp = Date.now();

    _model = model;
    _selectedYear = selectedYear;
    _visibleLayers = visibleLayers || _visibleLayers || {};
    _viewMode = viewMode || _viewMode || "today";
    _moonLabelMode = moonLabelMode || _moonLabelMode || "contextual";
    _moonLabelDistance = moonLabelDistance || _moonLabelDistance || "standard";
    _dayLabelMode = dayLabelMode || _dayLabelMode || "key";
    _connectionRegistry = Array.isArray(connectionRegistry) ? connectionRegistry : (_connectionRegistry || []);
    _motionMode = motionMode || _motionMode || "still";
    _semanticZoomState = semanticZoomState || _semanticZoomState || null;
    _buildMoonAnchors(_viewMode);
    _moonLabelManager?.markDirty();

    const vl = _visibleLayers;
    _applyLayerVisibility(vl, _semanticZoomState || { band: "medium", visibility: {} });
    const band = _semanticZoomState?.band || "medium";

    const selected = model.selectedPatternPosition || model.todayPatternPosition || null;
    const todayLunarAngle = Number(model.lunarAngle ?? 0);
    const selectedLunarAngle = _resolveLunarAngleForSelected(selected, todayLunarAngle);
    if (_objects.lunarMarker && Number.isFinite(todayLunarAngle)) {
      const p = _positionOnLunarOrbit(todayLunarAngle, mat.SIZES.lunarOrbit);
      _objects.lunarMarker.position.set(p.x, p.y, p.z);
      _objects.lunarMarker.userData = {
        type: "lunar-position",
        role: "today",
        phase: model.todayPatternPosition?.lunarPhase || null,
        illumination: model.todayPatternPosition?.lunarIllumination ?? null,
      };
    }
    if (_objects.lunarSelectedMarker && Number.isFinite(selectedLunarAngle)) {
      const p = _positionOnLunarOrbit(selectedLunarAngle, mat.SIZES.lunarOrbit);
      _objects.lunarSelectedMarker.position.set(p.x, p.y, p.z);
      _objects.lunarSelectedMarker.userData = {
        type: "lunar-position",
        role: "selected",
        phase: selected?.lunarPhase || null,
        illumination: selected?.lunarIllumination ?? null,
      };
      _objects.lunarSelectedMarker.visible = !!vl.lunar && band !== "far" && !!selected;
    }

    const todaySolarAngle = Number(model.currentSolarSeasonAngle ?? model.solarSeasonAngle ?? 0);
    const selectedSolarAngle = Number(selected?.solar?.angle ?? todaySolarAngle);
    _selectedSeasonAngle = Number.isFinite(selectedSolarAngle) ? selectedSolarAngle : 0;
    _updateLocationSeasonRing(_selectedSeasonAngle);
    if (_objects.solarTodayMarker && Number.isFinite(todaySolarAngle)) {
      const p = _positionOnSolarAxis(todaySolarAngle, mat.SIZES.solarAxis);
      _objects.solarTodayMarker.position.set(p.x, p.y, p.z);
      _objects.solarTodayMarker.visible = !!vl.solar && band !== "far";
    }
    if (_objects.solarSelectedMarker && Number.isFinite(selectedSolarAngle)) {
      const p = _positionOnSolarAxis(selectedSolarAngle, mat.SIZES.solarAxis);
      _objects.solarSelectedMarker.position.set(p.x, p.y, p.z);
      _objects.solarSelectedMarker.visible = !!vl.solar && band !== "far" && !!selected;
      _objects.solarSelectedMarker.userData = {
        type: "solar-position",
        role: "selected",
        gate: selected?.solar?.gate || null,
        angle: selectedSolarAngle,
      };
    }
    if (_objects.solarProgressGroup) {
      _disposeGroupChildren(_objects.solarProgressGroup);
      const arc = buildSolarProgressArc(todaySolarAngle, selectedSolarAngle);
      if (arc) {
        arc.name = "solarProgressArc";
        arc.computeLineDistances?.();
        arc.visible = !!vl.solar && band !== "far";
        _objects.solarProgressGroup.add(arc);
      }
    }

    if (_objects.selectedDayMarker) {
      const showSelected = !!(selected?.dayOfPatternYear != null);
      if (showSelected) {
        const selectedAngle = globalThis.LivingTimeSphereModel.patternAngleForDayOfYear(selected.dayOfPatternYear);
        const { x, z } = angleToXZ(selectedAngle, mat.SIZES.patternRing);
        _objects.selectedDayMarker.position.set(x, 0.01, z);
        _objects.selectedDayMarker.visible = true;
        if (_objects.selectedDayHalo) {
          _objects.selectedDayHalo.position.set(x, 0.004, z);
          _objects.selectedDayHalo.visible = true;
        }
        _objects.selectedDayMarker.userData = {
          ...selected,
          type: "living-day",
          role: "selected",
        };
      } else {
        _objects.selectedDayMarker.visible = false;
        if (_objects.selectedDayHalo) _objects.selectedDayHalo.visible = false;
      }
    }

    _applyDayNodeVisibility(
      band,
      selected?.dayOfPatternYear ?? model.selectedPatternPosition?.dayOfPatternYear ?? null,
      model.todayPatternPosition?.dayOfPatternYear ?? null
    );

    if (_objects.activeMoonGroup) {
      _disposeGroupChildren(_objects.activeMoonGroup);
      const tp = model.selectedPatternPosition || model.todayPatternPosition;
      const activeMoon = tp ? (tp.moon || 1) - 1 : (model.sourceRecord?.equinox?.patternPosition?.moon || 1) - 1;
      const r = mat.SIZES.patternRing;
      const sectorStart = (activeMoon / 13) * 360;
      const sectorEnd   = ((activeMoon + 1) / 13) * 360;
      const steps = 32;
      const activeCalendarBand = String(_semanticZoomState?.band || "medium").toLowerCase();
      const innerR = r * ((activeCalendarBand === "near" || activeCalendarBand === "detail") ? 0.64 : 0.82);
      const outerR = r * 0.98;
      const shape = new _THREE.Shape();
      for (let i = 0; i <= steps; i++) {
        const a = sectorStart + (i / steps) * (sectorEnd - sectorStart);
        const { x, z } = angleToXZ(a, outerR);
        if (i === 0) shape.moveTo(x, z);
        else shape.lineTo(x, z);
      }
      for (let i = steps; i >= 0; i--) {
        const a = sectorStart + (i / steps) * (sectorEnd - sectorStart);
        const { x, z } = angleToXZ(a, innerR);
        shape.lineTo(x, z);
      }
      shape.closePath();
      const geo = new _THREE.ShapeGeometry(shape);
      geo.rotateX(Math.PI / 2);
      const sector = new _THREE.Mesh(geo, new _THREE.MeshBasicMaterial({
        color: mat.COLORS.moonHighlight,
        transparent: true,
        opacity: _viewMode === "today" ? 0.42 : mat.OPACITY.moonHighlight,
        depthWrite: false,
        side: _THREE.DoubleSide,
      }));
      sector.name = "activeMoonSector";
      _objects.activeMoonGroup.add(sector);
      _decorateActiveMoonCalendarGrid(_objects.activeMoonGroup, activeMoon, r, mat);
    }

    if (_objects.activeDayNode) {
      const tp = model.selectedPatternPosition || model.todayPatternPosition;
      if (vl.pattern && tp && tp.moon != null && tp.day != null) {
        const moonIdx = tp.moon - 1;
        const dayIdx  = tp.day  - 1;
        const angle = globalThis.LivingTimeSphereModel.dayAngleWithinMoon(moonIdx, dayIdx);
        const { x, z } = angleToXZ(angle, mat.SIZES.patternRing);
        _objects.activeDayNode.position.set(x, 0.008, z);
        _objects.activeDayNode.visible = true;
        if (_objects.selectionRing && _viewMode !== "years") {
          _objects.selectionRing.position.set(x, 0.01, z);
          _objects.selectionRing.visible = true;
          _objects.selectionRing.rotation.x = Math.PI / 2;
        }
      } else {
        _objects.activeDayNode.visible = false;
      }
    }

    if (_objects.connectionGroup && Array.isArray(_connectionRegistry)) {
      _disposeGroupChildren(_objects.connectionGroup);
      _connectionDiagnostics = [];
      _connectionVisibleCount = 0;
      if (vl.connections && _connectionRegistry.length) _buildConnections();
    }

    _applyModeVisibilityOverrides(vl);
    _syncSemanticZoomFromCamera(true);
    if (!skipCameraFocus) _syncCameraFocus(_model, _spiral, _selectedYear, false);
    _enforceRendererHostContract();
    _validateSceneReadiness({ requireFirstFrame: false });
    _lastLayerUpdateMs = Math.max(0, performance.now() - updateStartedAt);

    if (
      globalThis.LivingTimeSphereExtensionHost?.updateAll
    ) {
      void globalThis.LivingTimeSphereExtensionHost.updateAll(
        _extensionContext({
          lifecycle: "selected-state-update",
          selected:
            model.selectedPatternPosition ||
            model.todayPatternPosition ||
            null
        })
      );
    }

    globalThis.LivingTimeSphereAnimation.markDirty();
    return true;
  }

  function updateEnvironment(environmentState) {
    _environmentController.update(environmentState || EMPTY_ENVIRONMENT_STATE);
    if (_initialized) globalThis.LivingTimeSphereAnimation.markDirty();
  }

  function setQuality(preset) {
    if (!_initialized || !preset) return;
    _quality = preset;
    globalThis.LivingTimeSphereAnimation.applyPreset(preset);
    globalThis.LivingTimeSphereAnimation.setLowPower(
      _motionMode === "still" || _activeTier === "lowpower" || Number(preset.starCount) === 0
    );
    if (_renderer) {
      const rawDpr = typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1;
      const tierCap = globalThis.ObservatoryCapabilityManager?.clampPixelRatio?.(_activeTier || "balanced", rawDpr) ?? rawDpr;
      const mobileCap = _isTouchOptimizedSurface() ? MOBILE_SETTLED_DPR_CAP : Infinity;
      const nextDpr = Math.min(rawDpr, tierCap, Number(preset.pixelRatioMax ?? tierCap), mobileCap);
      _renderer.setPixelRatio(nextDpr);
      _appliedDpr = nextDpr;
    }
    if (_motionMode === "drift" && preset.idleDrift && !_prefersReducedMotion()) {
      globalThis.LivingTimeSphereCamera.startDrift(performance.now());
    } else {
      globalThis.LivingTimeSphereCamera.stopDrift();
    }
    if (_objects.starField) _objects.starField.visible = preset.starCount > 0;
    if (_objects.hazeShell) _objects.hazeShell.visible = preset.glow !== false;
    globalThis.LivingTimeSphereAnimation.markDirty();
  }

  function requestSingleRender() {
    globalThis.LivingTimeSphereAnimation.requestRender();
  }

  function resetView() {
    _lastCameraFocusKey = null;
    _syncCameraFocus(_model, _spiral, _selectedYear, true);
    globalThis.LivingTimeSphereAnimation.markDirty();
  }

  function setMode(mode) {
    if (!mode || mode === _viewMode) return;
    _viewMode = mode;
    _lastCameraFocusKey = null;
    _syncCameraFocus(_model, _spiral, _selectedYear, true);
    globalThis.LivingTimeSphereAnimation.markDirty();
  }

  function teardown() {
    _initEpoch += 1;
    if (_progressiveVisualsHandle != null) {
      try { globalThis.cancelIdleCallback?.(_progressiveVisualsHandle); } catch {}
      try { clearTimeout(_progressiveVisualsHandle); } catch {}
      _progressiveVisualsHandle = null;
    }
    _progressiveVisualsScheduled = false;
    _progressiveVisualsReady = false;

    if (_extensionsHydrationHandle != null) {
      try {
        if (typeof globalThis.cancelIdleCallback === "function") globalThis.cancelIdleCallback(_extensionsHydrationHandle);
        else clearTimeout(_extensionsHydrationHandle);
      } catch { /* best-effort deferred-hydration cleanup */ }
    }
    _extensionsHydrationHandle = null;
    _extensionsHydrationScheduled = false;
    _extensionsHydrated = false;
    const teardownContainer = _container;
    if (_sceneRepairRaf) cancelAnimationFrame(_sceneRepairRaf);
    _sceneRepairRaf = 0;
    _sceneRepairQueued = false;
    globalThis.LivingTimeSphereAnimation.stop();
    globalThis.LivingTimeSphereAnimation.detachIntersection();
    globalThis.LivingTimeSphereAnimation.detachPageVisibility?.();
    _detachPointerEvents();
    _resizeObserver?.disconnect?.();
    _resizeObserver = null;
    _lastResizeWidth = 0;
    _lastResizeHeight = 0;
    _contextLossDispose?.();
    _contextLossDispose = null;

    if (
      globalThis.LivingTimeSphereExtensionHost?.disposeAll
    ) {
      void globalThis.LivingTimeSphereExtensionHost.disposeAll(
        _extensionContext({
          lifecycle: "dispose"
        })
      );
    }

    _environmentController.dispose();
    _disposeObjectTree(_scene);
    if (_renderer) {
      const renderer = _renderer;
      try { renderer.dispose(); } catch { /* best-effort GPU cleanup */ }
      try {
        const contextAlreadyLost = renderer.getContext?.().isContextLost?.() === true;
        if (!contextAlreadyLost) renderer.forceContextLoss?.();
      } catch { /* best-effort GPU context release */ }
      _renderer = null;
    } else {
      try { _activeWebGlContext?.getExtension?.("WEBGL_lose_context")?.loseContext?.(); } catch { /* best-effort GPU context release */ }
    }
    _activeWebGlContext = null;
    if (_canvas?.dataset) _canvas.dataset.sphereContextActive = "false";
    if (_canvas && _canvas.parentNode) _canvas.parentNode.removeChild(_canvas);
    _canvas = null;
    _pruneRendererOwnedCanvases(teardownContainer, null, "renderer-teardown");
    _hideFloatingLabel();
    if (_floatingLabelEl && _floatingLabelEl.parentNode) _floatingLabelEl.parentNode.removeChild(_floatingLabelEl);
    _floatingLabelEl = null;
    _moonLabelManager?.dispose?.();
    if (_moonLabelEls) _moonLabelEls.forEach(el => { if (el) el.style.display = "none"; });
    _moonLabelEls = null;
    _moonLabelContainer = null;
    _moonLabelConnectorEl = null;
    _moonLabelManager = null;
    if (_objects.moonIdentityNumberTexture?.dispose) {
      _objects.moonIdentityNumberTexture.dispose();
      _objects.moonIdentityNumberTexture = null;
    }
    _moonAnchors.length = 0;
    _dayNodeBasePositions = null;
    _dayNodeVisibleKey = "";
    _dayNodeVisibleCount = 0;
    _connectionDiagnostics = [];
    _connectionVisibleCount = 0;
    _lastSemanticDistance = null;
    _lastSemanticSourceType = "unknown";
    _previousSemanticBand = null;
    _lastSemanticTransitionThreshold = null;
    _scene = null;
    _camera = null;
    _initialized  = false;
    _initializing = false;
    _pendingRefresh = null;
    _lastRenderTimestamp = 0;
    _firstFrameTimestamp = 0;
    _firstFramePixelProbe = null;
    _lastSceneBuildTimestamp = 0;
    _geometryBuildRevision = 0;
    _lastSceneReadiness = null;
    _contextLostAt = 0;
    _contextRestoredAt = 0;
    _contextLossCount = 0;
    _contextRestoreCount = 0;
    _loadPromise  = null; // allow Three.js reload after teardown
    _THREE        = null;
    _threeSource  = null;
    _container    = null;
    _initTimeline.length = 0;
    for (const key of Object.keys(_objects)) delete _objects[key];
  }

  function cancelInitialization(reason = "initialization-cancelled") {
    if (!_initializing) return false;
    _lastInitError = {
      reason: "INIT_CANCELLED",
      detail: `3D initialization cancelled (${reason}).`,
    };
    teardown();
    return true;
  }

  function isInitialized() { return _initialized; }
  function isInitializing() { return _initializing; }
  function getCanvas() { return _canvas; }
  function getRenderer() { return _renderer; }

  function getLastInitError() { return _lastInitError; }

  function getDiagnostics() {
    // Diagnostics must never create probe contexts. Repeated diagnostics are
    // common during initialization and can otherwise evict the active WebGL
    // context on Android. Reuse the capability manager's cached result and the
    // renderer's existing context instead.
    let activeContext = null;
    try { activeContext = _renderer?.getContext?.() || null; } catch { /* ignore */ }
    const cachedCapability = globalThis.ObservatoryCapabilityManager?.probeWebGl?.() || null;
    const webglAvail = !!activeContext || !!cachedCapability?.webgl;
    const webgl2Avail = !!cachedCapability?.webgl2 || (
      !!activeContext &&
      typeof WebGL2RenderingContext !== "undefined" &&
      activeContext instanceof WebGL2RenderingContext
    );
    const canvasW = _canvas ? (_canvas.width  || 0) : 0;
    const canvasH = _canvas ? (_canvas.height || 0) : 0;
    const canvasRect = _canvas?.getBoundingClientRect?.() || null;
    const drawingBufferSize = (() => {
      if (!_renderer?.getDrawingBufferSize || !_THREE?.Vector2) return { width: 0, height: 0 };
      const size = _renderer.getDrawingBufferSize(new _THREE.Vector2());
      return { width: Number(size?.x || 0), height: Number(size?.y || 0) };
    })();
    const rendererSize = (() => {
      if (!_renderer?.getSize || !_THREE?.Vector2) return { width: 0, height: 0 };
      const size = _renderer.getSize(new _THREE.Vector2());
      return { width: Number(size?.x || 0), height: Number(size?.y || 0) };
    })();
    const conn = typeof navigator !== "undefined"
      ? (navigator.connection || navigator.mozConnection || navigator.webkitConnection || null)
      : null;
    const reducedData = !!(conn?.saveData || /2g$/i.test(conn?.effectiveType || ""));
    const initDurationMs = _initStartedAt != null && _initEndedAt != null
      ? Math.max(0, Math.round(_initEndedAt - _initStartedAt))
      : null;
    const visibleMoonLabels = Array.isArray(_moonLabelEls)
      ? _moonLabelEls.filter(el => el && el.style.display !== "none").length
      : 0;
    const rendererState = !_initialized
      ? (_initializing ? "initializing" : (_stageState?.renderer === "failed" ? "failed" : "not-started"))
      : (_stageState?.firstFrame === "rendered" ? "rendered" : "ready");
    const readiness = _lastSceneReadiness || _validateSceneReadiness({ requireFirstFrame: false });
    return {
      requestedRenderer: "3d",
      activeRenderer:    _initialized ? "webgl" : "none",
      initialized:       _initialized,
      initializing:      _initializing,
      webglAvailable:    webglAvail,
      webgl2Available:   webgl2Avail,
      threeVersion:      THREE_VERSION,
      threeLoaded:       !!_THREE,
      moduleSource:      _threeSource || "none",
      localModuleUrl:    _localThreeUrl(),
      canvasWidth:       canvasW,
      canvasHeight:      canvasH,
      canvasClientWidth: Number(_canvas?.clientWidth || 0),
      canvasClientHeight: Number(_canvas?.clientHeight || 0),
      canvasConnected: !!_canvas?.isConnected,
      renderGeneration: Number(_renderGeneration || 0),
      canvasRect: canvasRect ? {
        left: Number(canvasRect.left || 0),
        top: Number(canvasRect.top || 0),
        width: Number(canvasRect.width || 0),
        height: Number(canvasRect.height || 0),
      } : null,
      drawingBufferWidth: drawingBufferSize.width,
      drawingBufferHeight: drawingBufferSize.height,
      rendererSizeWidth: rendererSize.width,
      rendererSizeHeight: rendererSize.height,
      devicePixelRatio:  typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1,
      requestedDevicePixelRatio: _requestedDpr,
      appliedDevicePixelRatio: _appliedDpr,
      stageState:        { ..._stageState },
      initDurationMs,
      tier:              _activeTier,
      deviceMemoryGiB:   typeof navigator !== "undefined" && typeof navigator.deviceMemory === "number" ? navigator.deviceMemory : null,
      hardwareConcurrency: typeof navigator !== "undefined" && typeof navigator.hardwareConcurrency === "number" ? navigator.hardwareConcurrency : null,
      reducedMotion:     (() => { try { return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true; } catch { return false; } })(),
      reducedData,
      restoreAttempts:   _restoreAttempts,
      rendererState,
      lastRenderTimestamp: _lastRenderTimestamp,
      firstFrameTimestamp: _firstFrameTimestamp,
      sceneObjectCount: Number(readiness?.stats?.sceneObjectCount || 0),
      visibleObjectCount: Number(readiness?.stats?.visibleObjectCount || 0),
      meshCount: Number(readiness?.stats?.meshCount || 0),
      lineCount: Number(readiness?.stats?.lineCount || 0),
      patternGroupChildren: Number(readiness?.stats?.patternGroupChildren || 0),
      lunarGroupChildren: Number(readiness?.stats?.lunarGroupChildren || 0),
      solarGroupChildren: Number(readiness?.stats?.solarGroupChildren || 0),
      passageGroupChildren: Number(readiness?.stats?.passageGroupChildren || 0),
      markerGroupChildren: Number(readiness?.stats?.markerGroupChildren || 0),
      connectionGroupChildren: Number(readiness?.stats?.connectionGroupChildren || 0),
      spiralGroupChildren: Number(readiness?.stats?.spiralGroupChildren || 0),
      environmentGroupChildren: Number(readiness?.stats?.environmentGroupChildren || 0),
      astronomyGroupChildren: Number(readiness?.stats?.astronomyGroupChildren || 0),
      selectedGroupChildren: Number(readiness?.stats?.selectedGroupChildren || 0),
      patternGroupVisible: !!readiness?.stats?.patternGroupVisible,
      activeLayerSet: Array.isArray(readiness?.stats?.activeLayerSet) ? readiness.stats.activeLayerSet.slice(0, 24) : [],
      sceneBounds: readiness?.stats?.sceneBounds || null,
      sceneReadiness: {
        ready: !!readiness?.ready,
        reasons: Array.isArray(readiness?.reasons) ? readiness.reasons.slice(0, 12) : [],
      },
      cameraPosition: readiness?.stats?.cameraPosition || null,
      cameraTarget: readiness?.stats?.cameraTarget || null,
      cameraNear: Number(readiness?.stats?.cameraNear || 0),
      cameraFar: Number(readiness?.stats?.cameraFar || 0),
      cameraAspect: Number(_camera?.aspect || 0),
      lastSceneBuildTimestamp: _lastSceneBuildTimestamp,
      geometryBuildRevision: _geometryBuildRevision,
      geometryBuildCountByLayer: { ..._geometryBuildCountByLayer },
      layerBuildMsByLayer: { ..._layerBuildMetrics },
      cachedToggleMsByLayer: { ..._layerToggleMetrics },
      lastLayerUpdateType: _lastLayerUpdateType,
      lastLayerUpdateMs: Number(_lastLayerUpdateMs || 0),
      lifecycleCounters: { ..._lifecycleCounters },
      rendererInitCount: Number(_lifecycleCounters.rendererInitCount || 0),
      sceneRootBuildCount: Number(_lifecycleCounters.sceneRootBuildCount || 0),
      sceneBuildCount: Number(_lifecycleCounters.sceneRootBuildCount || 0),
      modelBuildCount: Number(_lifecycleCounters.modelBuildCount || 0),
      spiralReady: !!_lastSpiralGeometryKey,
      passageReady: !!_lastPassageGeometryKey,
      patternReady: Number(readiness?.stats?.patternGroupChildren || 0) > 0,
      cameraFitReady: Number(readiness?.stats?.cameraNear || 0) > 0 && Number(readiness?.stats?.cameraFar || 0) > Number(readiness?.stats?.cameraNear || 0),
      selectedStateUpdateCount: Number(_lifecycleCounters.selectedStateUpdateCount || 0),
      layerVisibilityUpdateCount: Number(_lifecycleCounters.layerVisibilityUpdateCount || 0),
      cameraCreateCount: Number(_lifecycleCounters.cameraCreateCount || 0),
      canvasCreateCount: Number(_lifecycleCounters.canvasCreateCount || 0),
      rafLoopStartCount: Number(_lifecycleCounters.rafLoopStartCount || 0),
      resizeObserverCreateCount: Number(_lifecycleCounters.resizeObserverCreateCount || 0),
      hostContract: {
        checkedAt: Number(_hostContractCheckedAt || 0),
        issueCount: Number(_hostContractIssues.length || 0),
        issues: _hostContractIssues.slice(0, 40),
      },
      rafActive: !!globalThis.LivingTimeSphereAnimation?.isRunning?.(),
      contextLost: _stageState.context === "lost",
      contextLostAt: Number(_contextLostAt || 0),
      contextRestoredAt: Number(_contextRestoredAt || 0),
      contextLossCount: Number(_contextLossCount || 0),
      contextRestoreCount: Number(_contextRestoreCount || 0),
      initTimeline: _initTimeline.slice(0, 120),
      firstFramePixelProbe: _firstFramePixelProbe ? { ..._firstFramePixelProbe } : null,
      lastInitError:     _lastInitError,
      semanticZoom: {
        band: _semanticZoomState?.band || "medium",
        previousBand: _previousSemanticBand,
        distance: _lastSemanticDistance,
        transitionThreshold: _lastSemanticTransitionThreshold,
        sourceType: _lastSemanticSourceType,
        dayLabelMode: _semanticZoomState?.dayLabelMode || _dayLabelMode,
        moonLabelMode: _semanticZoomState?.moonLabelMode || _moonLabelMode,
        maxConnections: Number(_semanticZoomState?.maxConnections || 0),
        visibleDayNodes: Number(_dayNodeVisibleCount || 0),
        visibleMoonLabels,
        visibleConnections: Number(_connectionVisibleCount || 0),
      },
      semanticLabels: {
        targetCount: _initialized ? _buildSemanticTargets().length : 0,
        dismissed: _moonLabelManager?.semanticDismissals?.() || []
      },
      connectionDiagnostics: _connectionDiagnostics.slice(0, 80),

      extensions:
        globalThis.LivingTimeSphereExtensionHost?.diagnostics?.() ||
        null,

      environment:
        _environmentController.diagnostics(),
    };
  }

  function focusPatternDay(dayOfPatternYear, { distance = 1.82, animated = true } = {}) {
    const day = Math.max(1, Math.min(364, Math.round(Number(dayOfPatternYear) || 1)));
    const calendar = globalThis.LivingTimeSphereCalendarGeometry;
    const cell = calendar?.calendarCell?.(day);
    const angle = Number(cell?.angle ?? globalThis.LivingTimeSphereModel?.patternAngleForDayOfYear?.(day));
    if (!Number.isFinite(angle)) return false;

    /*
     * B7.28 — camera/day coordinate agreement.
     *
     * angleToXZ() maps a calendar angle A to the XZ direction
     *   (sin A, -cos A).
     * LivingTimeSphereCamera maps theta T to the camera XZ direction
     *   (sin T,  cos T).
     * Therefore the camera that physically faces the selected calendar cell is
     *   T = PI - A,
     * not -A. The earlier sign-only mapping put the camera on the opposite side
     * of the transparent wheel, which made Go To select the correct date but
     * visually rotate toward the wrong Moon.
     */
    const rawTheta = Math.PI - (angle * Math.PI / 180);
    const cameraState = globalThis.LivingTimeSphereCamera?.getState?.() || {};
    const currentTheta = Number(cameraState.theta);
    let theta = rawTheta;
    if (Number.isFinite(currentTheta)) {
      // Choose the equivalent turn nearest the current camera so a jump never
      // spins almost a full revolution when a short rotation is available.
      const tau = Math.PI * 2;
      theta = rawTheta + Math.round((currentTheta - rawTheta) / tau) * tau;
    }

    globalThis.LivingTimeSphereCamera?.moveTo?.({
      theta,
      dist: Number(distance) || 1.82,
      targetX: 0, targetY: 0, targetZ: 0,
      animated: animated !== false,
      durationMs: 620,
      nowMs: performance.now(),
    });
    globalThis.LivingTimeSphereCamera?.stopDrift?.();
    _moonLabelManager?.markDirty?.();
    globalThis.LivingTimeSphereAnimation?.markDirty?.();
    return true;
  }

  function exportPng({ format } = {}) {
    if (!_renderer) return null;
    // Force a render first
    render(performance.now());
    return _canvas?.toDataURL("image/png") || null;
  }

  globalThis.LivingTimeSphereRenderer3d = Object.freeze({
    init,
    refresh,
    updateSelectedState,
    setLayerVisibility,
    setLayerStates,
    updateEnvironment,
    setQuality,
    requestSingleRender,
    markDirty: requestSingleRender,
    resetView,
    focusPatternDay,
    setMode,
    cancelInitialization,
    teardown,
    isInitialized,
    isInitializing,
    getCanvas,
    getRenderer,
    getLastInitError,
    getDiagnostics,
    exportPng,
    getCalendarRailGeometry: _calendarRailGeometry,
    THREE_VERSION,
    THREE_LOCAL_REL,
    environment: Object.freeze({
      initialize: _environmentController.initialize.bind(_environmentController),
      update: _environmentController.update.bind(_environmentController),
      setLayerVisibility: _environmentController.setLayerVisibility.bind(_environmentController),
      dispose: _environmentController.dispose.bind(_environmentController),
    }),
    _internals: Object.freeze({
      semanticThresholds: _semanticThresholds,
      stabilizeBand: _stabilizeBand,
      buildSemanticTargets: _buildSemanticTargets,
      buildSolarProgressArc,
      smokeBuildSolarProgressArcForTests(startAngle, endAngle, threeOverride) {
        const previous = _THREE;
        if (threeOverride) _THREE = threeOverride;
        try {
          return buildSolarProgressArc(startAngle, endAngle);
        } finally {
          if (threeOverride) _THREE = previous;
        }
      },
    }),
  });
})();
