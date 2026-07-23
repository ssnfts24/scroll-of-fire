(() => {
  "use strict";

  // Living Time Sphere — camera management for the 3D scene.
  // Works with THREE.PerspectiveCamera.
  // Does not import THREE directly; receives camera + renderer from renderer-3d.

  const MIN_ZOOM = 1.2;   // closest allowed distance from origin
  const MAX_ZOOM = 8.0;   // furthest allowed
  const FOV      = 55;    // field-of-view degrees

  // Mode-specific camera targets: { distance, phi, theta }
  // phi:   vertical angle from XZ plane (0 = horizontal, π/2 = top-down)
  // theta: horizontal rotation from +Z axis
  const MODE_POSITIONS = Object.freeze({
    today:   Object.freeze({ distance: 2.8, phi: 0.55, theta: 0.0 }),
    passage: Object.freeze({ distance: 2.4, phi: 0.55, theta: 0.15 }),
    years:   Object.freeze({ distance: 4.5, phi: 0.60, theta: 0.0 }),
    pattern: Object.freeze({ distance: 2.6, phi: 1.45, theta: 0.0 }), // nearly top-down
    default: Object.freeze({ distance: 3.2, phi: 0.55, theta: 0.0 }),
  });

  // ── Internal state ─────────────────────────────────────────────────

  let _cam     = null;   // THREE.PerspectiveCamera
  let _target  = { x: 0, y: 0, z: 0 };  // look-at point (always origin)

  // Current spherical coords (the camera orbits the origin)
  let _phi     = MODE_POSITIONS.default.phi;
  let _theta   = MODE_POSITIONS.default.theta;
  let _dist    = MODE_POSITIONS.default.distance;

  // Drag state
  let _dragging    = false;
  let _dragStartX  = 0;
  let _dragStartY  = 0;
  let _dragPhi0    = 0;
  let _dragTheta0  = 0;

  // Idle drift
  let _driftEnabled  = false;
  let _driftRate     = 0.00008;   // radians per millisecond
  let _lastDriftTime = 0;

  // Transition state for smooth mode changes
  let _transition    = null;      // { fromDist, fromPhi, fromTheta, toDist, toPhi, toTheta, startMs, durationMs }

  // Notification callbacks
  let _onChange      = null;      // () => void — called when camera position changes

  // ── Lifecycle ──────────────────────────────────────────────────────

  function create(THREE, containerWidth, containerHeight) {
    _cam = new THREE.PerspectiveCamera(FOV, containerWidth / containerHeight, 0.1, 50);
    _apply();
    return _cam;
  }

  function resize(width, height) {
    if (!_cam) return;
    _cam.aspect = width / height;
    _cam.updateProjectionMatrix();
  }

  // ── Position helpers ──────────────────────────────────────────────

  function _apply() {
    if (!_cam) return;
    // Spherical → Cartesian
    const x = _dist * Math.cos(_phi) * Math.sin(_theta);
    const y = _dist * Math.sin(_phi);
    const z = _dist * Math.cos(_phi) * Math.cos(_theta);
    _cam.position.set(x, y, z);
    _cam.lookAt(_target.x, _target.y, _target.z);
    _cam.updateProjectionMatrix();
    if (_onChange) _onChange();
  }

  // ── Smooth transition ────────────────────────────────────────────

  function _lerpAngle(a, b, t) {
    // Lerp angles correctly (no over-the-top wrapping needed for phi/theta)
    return a + (b - a) * t;
  }

  function _easeInOut(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  // Called from the animation loop.
  function tick(nowMs) {
    let dirty = false;

    // Animate transition
    if (_transition) {
      const elapsed = nowMs - _transition.startMs;
      const t = Math.min(elapsed / _transition.durationMs, 1);
      const e = _easeInOut(t);
      _dist  = _lerpAngle(_transition.fromDist,  _transition.toDist,  e);
      _phi   = _lerpAngle(_transition.fromPhi,   _transition.toPhi,   e);
      _theta = _lerpAngle(_transition.fromTheta, _transition.toTheta, e);
      _apply();
      dirty = true;
      if (t >= 1) _transition = null;
    }

    // Idle drift (only when no transition and not dragging)
    if (_driftEnabled && !_transition && !_dragging) {
      const dt = nowMs - _lastDriftTime;
      _lastDriftTime = nowMs;
      if (dt > 0 && dt < 500) { // guard against tab wake-up jumps
        _theta = (_theta + _driftRate * dt) % (Math.PI * 2);
        _apply();
        dirty = true;
      }
    }

    return dirty;
  }

  function startDrift(nowMs) {
    _driftEnabled  = true;
    _lastDriftTime = nowMs;
  }

  function stopDrift() {
    _driftEnabled = false;
  }

  function isDrifting() { return _driftEnabled; }

  // ── Orbit drag ───────────────────────────────────────────────────

  function onPointerDown(x, y) {
    _dragging    = true;
    _dragStartX  = x;
    _dragStartY  = y;
    _dragPhi0    = _phi;
    _dragTheta0  = _theta;
    _transition  = null;  // cancel any in-flight transition
    stopDrift();
  }

  function onPointerMove(x, y) {
    if (!_dragging) return false;
    const dx = x - _dragStartX;
    const dy = y - _dragStartY;
    _theta = _dragTheta0 - dx * 0.007;
    _phi   = Math.max(-1.5, Math.min(1.5, _dragPhi0 + dy * 0.005));
    _apply();
    return true;
  }

  function onPointerUp() {
    _dragging = false;
  }

  function isDragging() { return _dragging; }

  // ── Zoom ─────────────────────────────────────────────────────────

  function zoom(delta) {
    _dist = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, _dist + delta));
    _transition = null;
    _apply();
  }

  function onWheel(e) {
    const delta = e.deltaY * 0.005;
    zoom(delta);
  }

  // Pinch-to-zoom: call onPinchStart with initial distance, then onPinchMove.
  let _pinchStart = null;
  let _pinchDist0 = 0;

  function onPinchStart(pixelDist) {
    _pinchStart = _dist;
    _pinchDist0 = pixelDist;
  }

  function onPinchMove(pixelDist) {
    if (_pinchStart == null) return;
    const scale = _pinchDist0 / Math.max(pixelDist, 1);
    _dist = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, _pinchStart * scale));
    _apply();
  }

  function onPinchEnd() {
    _pinchStart = null;
  }

  // ── Named positions ───────────────────────────────────────────────

  function setMode(mode, nowMs, animated) {
    const pos = MODE_POSITIONS[mode] || MODE_POSITIONS.default;
    moveTo({ dist: pos.distance, phi: pos.phi, theta: _theta, nowMs, animated });
  }

  function moveTo({ dist, phi, theta, nowMs, animated, durationMs } = {}) {
    if (!animated) {
      _dist  = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, dist ?? _dist));
      _phi   = phi   ?? _phi;
      _theta = theta ?? _theta;
      _apply();
      return;
    }
    _transition = {
      fromDist:  _dist,
      fromPhi:   _phi,
      fromTheta: _theta,
      toDist:    Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, dist ?? _dist)),
      toPhi:     phi   ?? _phi,
      toTheta:   theta ?? _theta,
      startMs:   nowMs || performance.now(),
      durationMs: durationMs || 700,
    };
  }

  function resetView(nowMs) {
    moveTo({
      dist:  MODE_POSITIONS.default.distance,
      phi:   MODE_POSITIONS.default.phi,
      theta: 0,
      nowMs,
      animated: true,
    });
  }

  function focusMarker(theta, nowMs) {
    moveTo({ theta, nowMs, animated: true });
  }

  // ── State accessors ───────────────────────────────────────────────

  function onChangeCallback(fn) { _onChange = fn; }

  function getState() {
    return Object.freeze({ dist: _dist, phi: _phi, theta: _theta, driftEnabled: _driftEnabled });
  }

  function setState(s) {
    if (s.dist  != null) _dist  = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, s.dist));
    if (s.phi   != null) _phi   = s.phi;
    if (s.theta != null) _theta = s.theta;
    _apply();
  }

  function isAnimating() {
    return !!_transition || _dragging;
  }

  globalThis.LivingTimeSphereCamera = Object.freeze({
    create,
    resize,
    tick,
    startDrift,
    stopDrift,
    isDrifting,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    isDragging,
    zoom,
    onWheel,
    onPinchStart,
    onPinchMove,
    onPinchEnd,
    setMode,
    moveTo,
    resetView,
    focusMarker,
    onChangeCallback,
    getState,
    setState,
    isAnimating,
    MODE_POSITIONS,
    MIN_ZOOM,
    MAX_ZOOM,
  });
})();
