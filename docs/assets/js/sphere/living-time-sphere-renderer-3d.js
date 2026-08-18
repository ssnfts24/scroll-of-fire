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

      motionMode:
        _motionMode || "still",

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
  const _moonAnchors = [];    // { moon, angle, radius, worldVec } for each of 13 moons
  const _semanticTargetRegistry = new Map();
  const _semanticBandRank = Object.freeze({ far: 0, medium: 1, near: 2, detail: 3 });
  const _semanticTargetLimit = 96;
  let _selectedSemanticMarker = null;
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

  function _cloneWorldPosition(position) {
    if (!position) return null;
    const x = Number(position.x);
    const y = Number(position.y);
    const z = Number(position.z);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
    return { x, y, z };
  }

  function _semanticBandAllows(currentBand, minBand = "detail") {
    const current = _semanticBandRank[String(currentBand || "medium").toLowerCase()] ?? _semanticBandRank.medium;
    const minimum = _semanticBandRank[String(minBand || "detail").toLowerCase()] ?? _semanticBandRank.detail;
    return current >= minimum;
  }

  function _clearSemanticTargetsByPrefix(prefix) {
    if (!prefix) return 0;
    let removed = 0;
    Array.from(_semanticTargetRegistry.keys()).forEach(id => {
      if (!String(id).startsWith(prefix)) return;
      _semanticTargetRegistry.delete(id);
      removed += 1;
    });
    if (removed > 0) _moonLabelManager?.markDirty?.();
    return removed;
  }

  function _registerSemanticTarget(object, descriptor = {}) {
    const id = String(descriptor.id || object?.name || "").trim();
    if (!id) return null;
    if (!_semanticTargetRegistry.has(id) && _semanticTargetRegistry.size >= _semanticTargetLimit) {
      const oldestId = _semanticTargetRegistry.keys().next().value;
      if (oldestId) _semanticTargetRegistry.delete(oldestId);
    }
    const current = _semanticTargetRegistry.get(id) || {};
    const next = {
      ...current,
      ...descriptor,
      id,
      sourceObject: object || descriptor.sourceObject || current.sourceObject || null,
      metadata: descriptor.metadata && typeof descriptor.metadata === "object"
        ? { ...(current.metadata || {}), ...descriptor.metadata }
        : (current.metadata || {}),
      worldPosition: descriptor.worldPosition || current.worldPosition || null,
    };
    _semanticTargetRegistry.set(id, next);
    _moonLabelManager?.markDirty?.();
    return next;
  }

  function _unregisterSemanticTarget(id) {
    const removed = _semanticTargetRegistry.delete(String(id || ""));
    if (removed) _moonLabelManager?.markDirty?.();
    return removed;
  }

  function _clearSemanticTargets() {
    if (_semanticTargetRegistry.size < 1) return 0;
    const count = _semanticTargetRegistry.size;
    _semanticTargetRegistry.clear();
    _moonLabelManager?.markDirty?.();
    return count;
  }

  function _selectedSemanticTargetIds({
    selectedMarker = _selectedSemanticMarker,
    model = _model,
    selectedYear = _selectedYear,
  } = {}) {
    const ids = new Set();
    const year = Number(model?.year || selectedYear || 0);
    const selected = model?.selectedPatternPosition || null;
    const today = model?.todayPatternPosition || null;
    if (Number.isFinite(year) && year > 0 && selected?.dayOfPatternYear != null) {
      ids.add(`pattern-day:${year}:${Number(selected.dayOfPatternYear)}`);
    }
    if (Number.isFinite(selectedYear)) ids.add(`year:${Number(selectedYear)}`);
    const marker = String(selectedMarker || "");
    let match = /^day-(\d+)$/.exec(marker);
    if (match && Number.isFinite(year) && year > 0) ids.add(`pattern-day:${year}:${Number(match[1])}`);
    match = /^year-(\d+)$/.exec(marker);
    if (match) ids.add(`year:${Number(match[1])}`);
    match = /^eq-(\d+)$/.exec(marker);
    if (match) ids.add(`equinox:${Number(match[1])}`);
    if (marker === "today" && Number.isFinite(year) && year > 0 && today?.dayOfPatternYear != null) {
      ids.add(`pattern-day:${year}:${Number(today.dayOfPatternYear)}`);
    }
    if (marker === "equinox" && Number.isFinite(year) && year > 0) ids.add(`equinox:${year}`);
    if (marker === "yearGate" && Number.isFinite(year) && year > 0) ids.add(`year-gate:${year}`);
    return ids;
  }

  function _resolveSemanticTargetWorldPosition(target) {
    if (!target) return null;
    if (typeof target.worldPosition === "function") {
      try {
        return _cloneWorldPosition(target.worldPosition());
      } catch {
        return null;
      }
    }
    const direct = _cloneWorldPosition(target.worldPosition);
    if (direct) return direct;
    const object = target.sourceObject || null;
    if (object?.position) return _cloneWorldPosition(object.position);
    return null;
  }

  function _deriveSemanticTargetState(target, {
    selectedIds = new Set(),
    semanticZoomState = _semanticZoomState,
    camera = _camera,
    worldPosition = null,
  } = {}) {
    if (!target) return null;
    if (target.enableSemanticLabel === false) return null;
    if (Array.isArray(target.layers) && target.layers.length > 0) {
      const layerVisible = target.layers.some(layer => !!_visibleLayers?.[layer]);
      if (!layerVisible) return null;
    }
    const currentBand = semanticZoomState?.band || "medium";
    const explicitPinned = !!target.pinned || selectedIds.has(target.id);
    if (explicitPinned) return "pinned";
    if (_semanticBandAllows(currentBand, target.proximityBand || "near")) {
      const threshold = Number(target.proximityDistance);
      const cameraPos = camera?.position || null;
      if (worldPosition && cameraPos && Number.isFinite(threshold)) {
        const dx = Number(worldPosition.x) - Number(cameraPos.x || 0);
        const dy = Number(worldPosition.y) - Number(cameraPos.y || 0);
        const dz = Number(worldPosition.z) - Number(cameraPos.z || 0);
        if (Math.hypot(dx, dy, dz) <= threshold) return "proximity";
      } else if (!Number.isFinite(threshold) && _semanticBandAllows(currentBand, "detail")) {
        return "proximity";
      }
    }
    if (_semanticBandAllows(currentBand, target.ambientBand || "detail")) return "ambient";
    return null;
  }

  function _collectProximityCandidates() {
    const candidates = [];
    const selectedIds = _selectedSemanticTargetIds();
    const band = _semanticZoomState?.band || "medium";
    for (const target of _semanticTargetRegistry.values()) {
      const worldPosition = _resolveSemanticTargetWorldPosition(target);
      if (!worldPosition) continue;
      const state = _deriveSemanticTargetState(target, {
        selectedIds,
        semanticZoomState: _semanticZoomState,
        camera: _camera,
        worldPosition,
      });
      if (!state) continue;
      const priority = Number(target.priority || 0);
      const year = Number(target.metadata?.year || _model?.year || _selectedYear || 0);
      const title = String(target.title || target.label || target.id || "").trim();
      if (!title) continue;
      candidates.push({
        id: target.id,
        type: target.type || "semantic",
        semanticRole: target.semanticRole || target.type || "semantic",
        title,
        subtitle: target.subtitle == null ? "" : String(target.subtitle),
        detail: target.detail == null ? "" : String(target.detail),
        worldPosition,
        priority,
        state,
        pinned: !!target.pinned || selectedIds.has(target.id),
        selected: selectedIds.has(target.id),
        dismissible: !!target.dismissible,
        sourceObject: target.sourceObject || null,
        metadata: {
          ...target.metadata,
          year: Number.isFinite(year) && year > 0 ? year : target.metadata?.year,
          semanticBand: band,
        },
      });
    }
    candidates.sort((a, b) =>
      (a.state === "pinned" ? 3 : a.state === "proximity" ? 2 : 1) !== (b.state === "pinned" ? 3 : b.state === "proximity" ? 2 : 1)
        ? (b.state === "pinned" ? 3 : b.state === "proximity" ? 2 : 1) - (a.state === "pinned" ? 3 : a.state === "proximity" ? 2 : 1)
        : b.priority - a.priority
    );
    return candidates.slice(0, 18);
  }
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

  // Build canonical world-space anchor for Moon m (1-based) on the pattern ring.
  // Angle = center of the moon's sector (each sector = 360/13 degrees, Moon 1 starts at 0°).
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

  function _buildMoonAnchors(viewMode = _viewMode) {
    const mat = globalThis.LivingTimeSphereM;
    const r   = mat.SIZES.patternRing * _moonLabelRadiusMultiplier(viewMode, _moonLabelDistance);
    _moonAnchors.length = 0;
    _clearSemanticTargetsByPrefix("moon:");
    _activeSemanticBand = null;
    _previousSemanticBand = null;
    _lastSemanticTransitionThreshold = null;
    for (let i = 0; i < 13; i++) {
      const angle = _moonSectorCenterAngle(i);
      const { x, z } = angleToXZ(angle, r);
      const moon = i + 1;
      const anchor = {
        moon:  i + 1,
        angle,
        radius: r,
        worldX: x,
        worldY: mat.SIZES.ringTube * 1.5,
        worldZ: z,
      };
      _moonAnchors.push(anchor);
      _registerSemanticTarget(null, {
        id: `moon:${moon}`,
        type: "moon",
        semanticRole: "moon",
        title: `Moon ${moon}`,
        subtitle: viewMode === "today" ? "Pattern ring" : "",
        priority: 10,
        worldPosition: { x, y: mat.SIZES.ringTube * 1.5, z },
        ambientBand: "detail",
        proximityBand: "near",
        proximityDistance: 1.8,
        enableSemanticLabel: false,
        metadata: { moon, viewMode },
      });
    }
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

  // Called every frame to project 3D moon anchors to screen space and update labels.
  function _updateMoonLabels(viewMode) {
    if (!_moonLabelManager || !_camera || !_canvas || !_THREE) return;
    _moonLabelManager.update({
      camera: _camera,
      three: _THREE,
      anchors: _moonAnchors,
      model: _model,
      labelMode: _moonLabelMode,
      selectedPatternPosition: _model?.selectedPatternPosition || _model?.todayPatternPosition || null,
      showAllMobileLabels: _moonLabelMode === "all",
      selectedMarkerPosition: _objects.selectedDayMarker?.position
        ? { x: _objects.selectedDayMarker.position.x, y: _objects.selectedDayMarker.position.y, z: _objects.selectedDayMarker.position.z }
        : null,
      todayMarkerPosition: _objects.todayMarker?.position
        ? { x: _objects.todayMarker.position.x, y: _objects.todayMarker.position.y, z: _objects.todayMarker.position.z }
        : null,
      viewMode,
      stageEl: _container,
      visibleLayersKey: JSON.stringify(_visibleLayers || {}),
      protectedRects: _moonLabelProtectedRects()
    });
  }

  function _updateSemanticLabels() {
    if (!_moonLabelManager || !_camera || !_canvas || !_THREE) return;
    _moonLabelManager.updateSemantic?.({
      camera: _camera,
      three: _THREE,
      candidates: _collectProximityCandidates(),
      stageEl: _container,
      protectedRects: _moonLabelProtectedRects(),
    });
  }

  function _syncGateSemanticTargets(model) {
    _clearSemanticTargetsByPrefix("equinox:");
    _clearSemanticTargetsByPrefix("year-gate:");
    const year = Number(model?.year || _selectedYear || 0);
    if (!Number.isFinite(year) || year <= 0) return;
    if (_objects.equinoxGate) {
      _registerSemanticTarget(_objects.equinoxGate, {
        id: `equinox:${year}`,
        type: "gate",
        semanticRole: "equinox",
        title: `${year} Equinox Gate`,
        subtitle: "March equinox",
        detail: model?.sourceRecord?.equinox?.utcInstant || "",
        priority: 92,
        proximityBand: "near",
        proximityDistance: 2.25,
        ambientBand: "detail",
        layers: ["passage", "markers"],
        metadata: { year, marker: "equinox" },
      });
    }
    if (_objects.yearGate) {
      _registerSemanticTarget(_objects.yearGate, {
        id: `year-gate:${year}`,
        type: "gate",
        semanticRole: "year-gate",
        title: `${year} Year Gate`,
        subtitle: "Moon 1 · Day 1",
        detail: model?.sourceRecord?.yearGate?.instant || "",
        priority: 88,
        proximityBand: "near",
        proximityDistance: 2.2,
        ambientBand: "detail",
        layers: ["pattern", "markers"],
        metadata: { year, marker: "yearGate" },
      });
    }
  }

  function _syncPatternDaySemanticTargets(model) {
    _clearSemanticTargetsByPrefix("pattern-day:");
    const year = Number(model?.year || _selectedYear || 0);
    if (!Number.isFinite(year) || year <= 0) return;
    const today = model?.todayPatternPosition || null;
    if (_objects.todayMarker && _objects.todayMarker.visible && today?.dayOfPatternYear != null) {
      _registerSemanticTarget(_objects.todayMarker, {
        id: `pattern-day:${year}:${Number(today.dayOfPatternYear)}`,
        type: "pattern-day",
        semanticRole: "today",
        title: `Moon ${today.moon} · Day ${today.day}`,
        subtitle: "Today",
        detail: `Day ${today.dayOfPatternYear}/364`,
        priority: 96,
        proximityBand: "near",
        proximityDistance: 2.1,
        ambientBand: "detail",
        layers: ["pattern", "markers"],
        pinned: String(_selectedSemanticMarker || "") === "today",
        metadata: { year, dayOfPatternYear: Number(today.dayOfPatternYear), moon: Number(today.moon), day: Number(today.day), marker: "today" },
      });
    }
    const selected = model?.selectedPatternPosition || null;
    if (_objects.selectedDayMarker && _objects.selectedDayMarker.visible && selected?.dayOfPatternYear != null) {
      _registerSemanticTarget(_objects.selectedDayMarker, {
        id: `pattern-day:${year}:${Number(selected.dayOfPatternYear)}`,
        type: "pattern-day",
        semanticRole: "selected-day",
        title: `Moon ${selected.moon} · Day ${selected.day}`,
        subtitle: "Selected day",
        detail: `Day ${selected.dayOfPatternYear}/364`,
        priority: 100,
        proximityBand: "near",
        proximityDistance: 2.3,
        ambientBand: "detail",
        layers: ["pattern", "markers"],
        pinned: true,
        metadata: { year, dayOfPatternYear: Number(selected.dayOfPatternYear), moon: Number(selected.moon), day: Number(selected.day), marker: "selected-day" },
      });
    }
  }

  function _syncYearSemanticTargets(spiral, vl = _visibleLayers) {
    _clearSemanticTargetsByPrefix("year:");
    if (!spiral?.years?.length) return;
    spiral.years.forEach((entry, index) => {
      const marker = _objects.spiralMarkers?.[index] || null;
      _registerSemanticTarget(marker, {
        id: `year:${Number(entry.year)}`,
        type: "year",
        semanticRole: "year",
        title: `${entry.year}`,
        subtitle: "13-year spiral",
        detail: "Annual marker",
        priority: Number(entry.year) === Number(_selectedYear) ? 94 : 54,
        proximityBand: "near",
        proximityDistance: 2.65,
        ambientBand: "detail",
        layers: ["spiral", "markers"],
        pinned: Number(entry.year) === Number(_selectedYear) && !!vl?.markers,
        metadata: { year: Number(entry.year) },
      });
    });
  }

  // ── Scene construction ────────────────────────────────────────────

  function buildScene() {
    const THREE = _THREE;
    const mat   = globalThis.LivingTimeSphereM;
    _countLifecycle("sceneRootBuildCount");
    _clearSemanticTargets();
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
      const geo = new THREE.TorusGeometry(r, mat.SIZES.ringTube, 8, 256);
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

    // ── Moon sector dividers (13 lines from center to ring) ─────────
    {
      const r  = mat.SIZES.moonSectors;
      const pts = [];
      for (let i = 0; i < 13; i++) {
        const angle = (i / 13) * 360;
        const { x, z } = angleToXZ(angle, r);
        pts.push(new _THREE.Vector3(0, 0, 0));
        pts.push(new _THREE.Vector3(x, 0, z));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const m   = new THREE.LineBasicMaterial({
        color:       mat.COLORS.moonStroke,
        transparent: true,
        opacity:     Math.max(mat.OPACITY.moonStroke || 0.4, 0.72),
        depthWrite:  false,
      });
      const lines = new THREE.LineSegments(geo, m);
      lines.name = "moonDividers";
      _scene.add(lines);
      _objects.moonDividers = lines;
    }

    // ── Week dividers (3 interior week boundaries per moon) ───────────
    {
      const pts = [];
      const innerR = mat.SIZES.patternRing * 0.86;
      const outerR = mat.SIZES.patternRing * 1.02;
      for (let moon = 0; moon < 13; moon += 1) {
        [7, 14, 21].forEach(dayBoundary => {
          const dayOfYear = moon * 28 + dayBoundary;
          const boundaryAngle = (dayOfYear / 364) * 360;
          const start = angleToXZ(boundaryAngle, innerR);
          const end = angleToXZ(boundaryAngle, outerR);
          pts.push(new _THREE.Vector3(start.x, 0.002, start.z));
          pts.push(new _THREE.Vector3(end.x, 0.002, end.z));
        });
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const m = new THREE.LineBasicMaterial({
        color: 0x8dc0cf,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      });
      const lines = new THREE.LineSegments(geo, m);
      lines.name = "weekDividers";
      _scene.add(lines);
      _objects.weekDividers = lines;
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

    // ── Day Out of Time marker (position 365 equivalent) ─────────────
    {
      const angle = (364.5 / 364) * 360;  // just past Moon 13 Day 28
      const { x, z } = angleToXZ(angle, mat.SIZES.patternRing);
      const geo = new THREE.SphereGeometry(0.018, 8, 8);
      const m   = new THREE.MeshBasicMaterial({ color: 0xffd080, transparent: true, opacity: 0.6 });
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, 0, z);
      mesh.name = "dayOutOfTime";
      mesh.visible = false;  // shown only when relevant
      _scene.add(mesh);
      _objects.dayOutOfTime = mesh;
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

      const stars = globalThis.LivingTimeSphereEffects.buildStarField(THREE, _quality?.starCount ?? 150);
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
    _buildEnvironmentLayerObjects();
    if (!_objects.environmentGroup) return;
    const snapshot = _normalizedEnvironmentState(_environmentState);
    const current = snapshot?.current || null;
    const hourly = snapshot?.hourly || [];
    const daily = snapshot?.daily || {};
    const hasData = !!(_environmentLayerVisible && snapshot && current);
    _objects.environmentGroup.visible = hasData;
    if (!hasData) return;

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
    },
    update(environmentState) {
      _environmentState = _normalizedEnvironmentState(environmentState || EMPTY_ENVIRONMENT_STATE);
      _applyEnvironmentState();
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
    if (_objects.shabbatNodes) _objects.shabbatNodes.visible = !!vl.pattern && band !== "far";
    if (_objects.weekGates) _objects.weekGates.visible = !!vl.pattern && vl.weekGates !== false && semanticVisibility.weekGates !== false;
    if (_objects.weekDividers) _objects.weekDividers.visible = !!vl.pattern && vl.weekGates !== false && semanticVisibility.weekGates !== false;
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
    _applySemanticVisibility(vl, semanticState || { band: "medium", visibility: {} });
    if (_objects.yearGate)     _objects.yearGate.visible     = !!vl.pattern;
    if (_objects.todayLineGroup) _objects.todayLineGroup.visible = true;
    if (_objects.lunarOrbit)   _objects.lunarOrbit.visible   = !!vl.lunar;
    if (_objects.lunarMarker)  _objects.lunarMarker.visible  = !!vl.lunar;
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
      _disposeGroupChildren(_objects.solarProgressGroup);
      const arc = buildSolarProgressArc(todaySolarAngle, selectedSolarAngle);
      if (arc) {
        arc.name = "solarProgressArc";
        arc.computeLineDistances?.();
        arc.visible = !!vl.solar && band !== "far";
        _objects.solarProgressGroup.add(arc);
      }
      _markLayerBuild("solar", performance.now() - layerStart);
    }

    // ── 13-year spiral markers ──────────────────────────────────────
    if (_objects.spiralGroup && spiral?.years) {
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
      _syncYearSemanticTargets(spiral, vl);
      _positionSelectionRingForYear(selectedYear);
      _markLayerBuild("spiral", performance.now() - layerStart);
    }

    // ── Recurrence links ────────────────────────────────────────────
    if (_objects.recurrenceGroup) {
      const layerStart = performance.now();
      _objects.recurrenceGroup.visible = !!(vl.recurrence && !_isMobileWidth());
      if (vl.recurrence && !_isMobileWidth()) {
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
    _syncGateSemanticTargets(model);
    _syncPatternDaySemanticTargets(model);
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
      _disposeGroupChildren(_objects.activeMoonGroup);
      const tp = model.selectedPatternPosition || model.todayPatternPosition;
      const activeMoon = tp ? (tp.moon || 1) - 1 : (model.sourceRecord?.equinox?.patternPosition?.moon || 1) - 1;
      const r = mat.SIZES.patternRing;
      const sectorStart = (activeMoon / 13) * 360;
      const sectorEnd   = ((activeMoon + 1) / 13) * 360;
      const steps = 32;
      const innerR = r * 0.82;
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
    if (!_connectionDiagnostics.length && _connectionRegistry.length) {
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
    _updateMoonLabels(_viewMode);
    _updateSemanticLabels();

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

  // ── Init / teardown ────────────────────────────────────────────────

  async function init({ container, model, spiral, quality, tier, generation, selectedYear, visibleLayers, viewMode, moonLabelMode, moonLabelDistance, dayLabelMode, connectionRegistry, motionMode, semanticZoomState, selectedMarker = null, environmentState, reducedMotion, onYearSelect, onMarkerSelect, onContextLost: _onContextLostCb, onContextRestored: _onContextRestoredCb }) {
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
    _contextLostAt = 0;
    _contextRestoredAt = 0;
    _contextLossCount = 0;
    _contextRestoreCount = 0;
    _initTimeline.length = 0;
    _selectedSemanticMarker = selectedMarker || null;
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

      await new Promise(resolve => requestAnimationFrame(resolve));
      if (initWasCancelled()) return cancelledResult();
      const rect = container.getBoundingClientRect();
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
      const pixelRatio = Math.min(tierCappedDpr, Number(quality.pixelRatioMax ?? tierCappedDpr), rawDpr);
      try {
        _markStage("renderer", "running");
        _pushInitTimeline("three-webgl-renderer-create-requested");
        const powerPreference = quality === globalThis.LivingTimeSphereM?.QUALITY_PRESETS?.lowpower ? "low-power" : "default";
        _activeWebGlContext = _canvas.getContext("webgl2", {
          alpha: false,
          antialias: quality.antialias !== false,
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
          antialias: quality.antialias !== false,
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
      _camera = globalThis.LivingTimeSphereCamera.create(THREE, w, h);
      _countLifecycle("cameraCreateCount");
      _markStage("camera", "created");
      _pushInitTimeline("camera-aspect-updated", { aspect: Number(_camera?.aspect || 0) });
      globalThis.LivingTimeSphereCamera.onChangeCallback(() => {
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

      if (
        globalThis.LivingTimeSphereExtensionHost?.mountAll
      ) {
        await globalThis.LivingTimeSphereExtensionHost.mountAll(
          _extensionContext({
            lifecycle: "mount"
          })
        );

        if (initWasCancelled()) {
          return cancelledResult();
        }
      }

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

    function _angleDelta(now, start) {
      let delta = now - start;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      return delta;
    }

    function enterInteractMode() {
      interactMode = true;
      if (_canvas) _canvas.style.touchAction = "none";
      container.dispatchEvent(new CustomEvent("sphere:interact-start", { bubbles: true }));
    }
    function exitInteractMode() {
      interactMode = false;
      if (_canvas) _canvas.style.touchAction = "pan-y";
      globalThis.LivingTimeSphereCamera.onPointerUp();
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
        const pts = [...pointerCache.values()];
        const d = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
        const dx = pts[1].clientX - pts[0].clientX;
        const dy = pts[1].clientY - pts[0].clientY;
        const angle = Math.atan2(dy, dx);
        const twistDelta = _angleDelta(angle, pinchAngle0);
        if (Math.abs(twistDelta) > TWIST_DEADZONE || twistActive) {
          twistActive = true;
          globalThis.LivingTimeSphereCamera.setState?.({ theta: twistTheta0 - twistDelta });
        }
        globalThis.LivingTimeSphereCamera.onPinchMove(d);
        const cx = (pts[0].clientX + pts[1].clientX) / 2;
        const cy = (pts[0].clientY + pts[1].clientY) / 2;
        globalThis.LivingTimeSphereCamera.onPanMove?.(cx, cy);
        panCentroid0 = { x: cx, y: cy };
        globalThis.LivingTimeSphereAnimation.markDirty();
        e.preventDefault();
        return;
      }

      if (!interactMode) return;
      const moved = globalThis.LivingTimeSphereCamera.onPointerMove(e.clientX, e.clientY);
      if (moved) {
        globalThis.LivingTimeSphereAnimation.markDirty();
        e.preventDefault();
      }
    }, { passive: false });

    listen(_canvas, "pointerup", e => {
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
        globalThis.LivingTimeSphereCamera.onPointerUp();
        // On narrow screens, exit interact mode on finger up (re-enables page scroll)
        if (window.innerWidth < 480) exitInteractMode();
      }
      // Restart drift after interaction ends
      if (_quality?.idleDrift && !_prefersReducedMotion()) {
        globalThis.LivingTimeSphereCamera.startDrift(performance.now());
      }
    });

    listen(_canvas, "pointercancel", e => {
      pointerCache.delete(e.pointerId);
      globalThis.LivingTimeSphereCamera.onPointerUp();
      globalThis.LivingTimeSphereCamera.onPanEnd?.();
      globalThis.LivingTimeSphereCamera.onPinchEnd();
      pinchActive = false;
      pinchDist0 = 0;
      pinchAngle0 = 0;
      twistActive = false;
      if (window.innerWidth < 480) exitInteractMode();
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
      _floatingLabelEl.style.cssText = "position:absolute;pointer-events:none;display:none;z-index:10;";
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

  function _handleClick(e, onYearSelect, onMarkerSelect) {
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
      _objects.lunarSelectedMarker
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
                 : "unknown";
      _showFloatingLabel(obj.position, _getMarkerLabel(type), e.clientX, e.clientY);
      if (onMarkerSelect) onMarkerSelect({ type, year: _model?.year, metadata: obj.userData || null });
      return;
    }

    const markers = (_objects.spiralMarkers || []).filter(m => m.visible);
    const hits    = raycaster.intersectObjects(markers);
    if (hits.length > 0) {
      const year = hits[0].object.userData.year;
      if (year && onYearSelect) onYearSelect(year);
      if (year && onMarkerSelect) onMarkerSelect({ type: "year", year });
      _showFloatingLabel(hits[0].object.position, `${year}`, e.clientX, e.clientY);
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

  function refresh(model, spiral, selectedYear, visibleLayers, viewMode, moonLabelMode, moonLabelDistance, dayLabelMode, connectionRegistry, motionMode, semanticZoomState, selectedMarker = _selectedSemanticMarker) {
    if (!_initialized) return;
    _selectedSemanticMarker = selectedMarker || null;
    updateScene(model, spiral, selectedYear, visibleLayers, viewMode, moonLabelMode, moonLabelDistance, dayLabelMode, connectionRegistry, motionMode, semanticZoomState);

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
    selectedMarker = _selectedSemanticMarker,
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
    _selectedSemanticMarker = selectedMarker || null;
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
    _syncYearSemanticTargets(_spiral, vl);
    _syncGateSemanticTargets(model);
    _syncPatternDaySemanticTargets(model);

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
      const innerR = r * 0.82;
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
      const nextDpr = Math.min(rawDpr, tierCap, Number(preset.pixelRatioMax ?? tierCap));
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
    if (_moonLabelEls) _moonLabelEls.forEach(el => { if (el) el.style.display = "none"; });
    _moonLabelEls = null;
    _moonLabelContainer = null;
    _moonLabelConnectorEl = null;
    _moonLabelManager = null;
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
    _selectedSemanticMarker = null;
    _clearSemanticTargets();
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
        selectedMarker: _selectedSemanticMarker || null,
        registrySize: _semanticTargetRegistry.size,
        visibleCandidateCount: _collectProximityCandidates().length,
      },
      connectionDiagnostics: _connectionDiagnostics.slice(0, 80),

      extensions:
        globalThis.LivingTimeSphereExtensionHost?.diagnostics?.() ||
        null,

      environment:
        _environmentController.diagnostics(),
    };
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
    _registerSemanticTarget,
    _unregisterSemanticTarget,
    _clearSemanticTargets,
    _collectProximityCandidates,
    registerSemanticTarget: _registerSemanticTarget,
    unregisterSemanticTarget: _unregisterSemanticTarget,
    clearSemanticTargets: _clearSemanticTargets,
    collectProximityCandidates: _collectProximityCandidates,
    requestSingleRender,
    markDirty: requestSingleRender,
    resetView,
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
      semanticBandAllows: _semanticBandAllows,
      selectedSemanticTargetIds: _selectedSemanticTargetIds,
      deriveSemanticTargetState: _deriveSemanticTargetState,
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
