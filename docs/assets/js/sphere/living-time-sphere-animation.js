(() => {
  "use strict";

  // Living Time Sphere — animation controller.
  // Manages the dirty-render loop, idle drift, breathing effects, and lifecycle events.
  // Does not hold a reference to THREE or the scene; callbacks handle rendering.

  // ── State ─────────────────────────────────────────────────────────

  let _rafId       = null;
  let _running     = false;
  let _dirty       = false;        // true = a render is needed
  let _paused      = false;        // true = page hidden or off-screen
  let _reducedMotion = false;
  let _lowPower    = false;

  // Effect enable flags (toggled per quality preset)
  let _idleDrift     = false;
  let _breathing     = false;
  let _passageFlow   = false;

  // Breathing animation (core luminosity)
  const BREATH_PERIOD_MS = 6000;   // 6 s per cycle — very slow
  let _breathPhase       = 0;      // 0–1

  // Passage flow (light traveling along the arc)
  const FLOW_PERIOD_MS   = 9000;
  let _flowPhase         = 0;      // 0–1

  // Registered effects: { id, onFrame(dt, nowMs) }
  const _effects = new Map();

  // Callbacks
  let _onRender  = null;   // () => void — triggers one WebGL render
  let _onDirty   = null;   // () => void — called when state changes requiring a render

  // Performance tracking
  let _frameCount = 0;
  let _fpsStart   = 0;
  let _lastFps    = 0;

  // IntersectionObserver handle
  let _ioDisconnect = null;

  // ── Dirty-render helpers ──────────────────────────────────────────

  function markDirty() {
    _dirty = true;
    if (_onDirty) _onDirty();
  }

  function isDirty() { return _dirty; }

  // ── Frame loop ────────────────────────────────────────────────────

  let _lastFrameMs = 0;

  function _frame(nowMs) {
    if (_paused) { _rafId = null; _running = false; return; }

    _rafId = requestAnimationFrame(_frame);

    const dt = _lastFrameMs > 0 ? Math.min(nowMs - _lastFrameMs, 100) : 16;
    _lastFrameMs = nowMs;

    // FPS tracking
    _frameCount++;
    if (_fpsStart === 0) _fpsStart = nowMs;
    if (nowMs - _fpsStart > 1000) {
      _lastFps    = Math.round(_frameCount / ((nowMs - _fpsStart) / 1000));
      _frameCount = 0;
      _fpsStart   = nowMs;
    }

    // Idle drift — delegated to camera module
    if (_idleDrift && !_reducedMotion && !_lowPower) {
      if (globalThis.LivingTimeSphereCamera?.isDragging?.() === false &&
          globalThis.LivingTimeSphereCamera?.isDrifting?.()) {
        globalThis.LivingTimeSphereCamera.tick(nowMs);
        _dirty = true;
      }
    }

    // Breathing effect
    if (_breathing && !_reducedMotion && !_lowPower) {
      _breathPhase = (nowMs % BREATH_PERIOD_MS) / BREATH_PERIOD_MS;
      _dirty = true;
    }

    // Passage flow
    if (_passageFlow && !_reducedMotion && !_lowPower) {
      _flowPhase = (nowMs % FLOW_PERIOD_MS) / FLOW_PERIOD_MS;
      _dirty = true;
    }

    // External effects
    for (const [, eff] of _effects) {
      const result = eff.onFrame(dt, nowMs);
      if (result) _dirty = true;
    }

    // Camera transitions
    if (globalThis.LivingTimeSphereCamera?.isAnimating?.()) {
      globalThis.LivingTimeSphereCamera.tick(nowMs);
      _dirty = true;
    }

    // Render if anything changed
    if (_dirty) {
      _dirty = false;
      if (_onRender) _onRender(nowMs);
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────

  function start(onRenderFn) {
    _onRender = onRenderFn;
    if (_running) return;
    _running      = true;
    _paused       = false;
    _lastFrameMs  = 0;
    _frameCount   = 0;
    _fpsStart     = 0;
    _rafId        = requestAnimationFrame(_frame);
  }

  function stop() {
    _running = false;
    if (_rafId != null) { cancelAnimationFrame(_rafId); _rafId = null; }
  }

  function pause() {
    _paused = true;
    if (_rafId != null) { cancelAnimationFrame(_rafId); _rafId = null; }
  }

  function resume() {
    if (!_running) return;
    if (_paused) {
      _paused      = false;
      _lastFrameMs = 0;
      _rafId       = requestAnimationFrame(_frame);
    }
  }

  function requestRender() {
    // Trigger a single render outside the loop (used in low-power mode).
    _dirty = true;
    if (!_running && _onRender) {
      _onRender(performance.now());
      _dirty = false;
    }
  }

  // ── Page visibility & IntersectionObserver ────────────────────────

  function attachPageVisibility() {
    if (typeof document === "undefined") return;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { pause(); } else { resume(); }
    });
  }

  function attachIntersection(canvas) {
    if (!canvas || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { resume(); } else { pause(); }
    }, { threshold: 0.05 });
    io.observe(canvas);
    _ioDisconnect = () => io.disconnect();
  }

  function detachIntersection() {
    if (_ioDisconnect) { _ioDisconnect(); _ioDisconnect = null; }
  }

  // ── Quality preset application ─────────────────────────────────────

  function applyPreset(preset) {
    if (!preset) return;
    _idleDrift   = !!(preset.idleDrift   && !_reducedMotion);
    _breathing   = !!(preset.breathing   && !_reducedMotion);
    _passageFlow = !!(preset.passageFlow && !_reducedMotion);
  }

  function setReducedMotion(val) {
    _reducedMotion = !!val;
    if (_reducedMotion) {
      _idleDrift = _breathing = _passageFlow = false;
      if (globalThis.LivingTimeSphereCamera) globalThis.LivingTimeSphereCamera.stopDrift();
    }
  }

  function setLowPower(val) {
    _lowPower = !!val;
    if (_lowPower) {
      _idleDrift = false;
      if (globalThis.LivingTimeSphereCamera) globalThis.LivingTimeSphereCamera.stopDrift();
    }
  }

  // ── Effect registration ───────────────────────────────────────────

  function addEffect(id, onFrame) {
    _effects.set(id, { id, onFrame });
  }

  function removeEffect(id) {
    _effects.delete(id);
  }

  // ── Animation values (read by renderer each frame) ────────────────

  // Breathing: smooth sine oscillation 0–1
  function breathValue() {
    return (Math.sin(_breathPhase * Math.PI * 2) * 0.5 + 0.5);
  }

  // Passage flow: triangle wave 0→1→0 for subtle pulse
  function flowValue() {
    return _flowPhase < 0.5 ? _flowPhase * 2 : (1 - _flowPhase) * 2;
  }

  // ── Performance ──────────────────────────────────────────────────

  function currentFps() { return _lastFps; }
  function isRunning()  { return _running && !_paused; }

  // ── Intro guide dismissal (local session) ─────────────────────────

  const INTRO_KEY = "lts-intro-dismissed";
  function _introStorage() {
    try { if (globalThis.localStorage) return globalThis.localStorage; } catch { /* ignore */ }
    try { if (globalThis.sessionStorage) return globalThis.sessionStorage; } catch { /* ignore */ }
    return null;
  }

  function isIntroDismissed() {
    try { return !!_introStorage()?.getItem(INTRO_KEY); } catch { return false; }
  }

  function dismissIntro() {
    try { _introStorage()?.setItem(INTRO_KEY, "1"); } catch { /* ignore */ }
  }

  function resetIntroForSession() {
    try { _introStorage()?.removeItem(INTRO_KEY); } catch { /* ignore */ }
  }

  globalThis.LivingTimeSphereAnimation = Object.freeze({
    start,
    stop,
    pause,
    resume,
    requestRender,
    markDirty,
    isDirty,
    attachPageVisibility,
    attachIntersection,
    detachIntersection,
    applyPreset,
    setReducedMotion,
    setLowPower,
    addEffect,
    removeEffect,
    breathValue,
    flowValue,
    currentFps,
    isRunning,
    isIntroDismissed,
    dismissIntro,
    resetIntroForSession,
  });
})();
