(() => {
  "use strict";

  // Sphere interaction — drag rotation, tap/click, keyboard navigation, zoom, reset.
  // Tracks interaction state and dispatches semantic events on the sphere container.

  let _state = {
    rotationDeg: 0,
    zoom:        1.0,
    isDragging:  false,
    dragStartX:  0,
    dragStartY:  0,
    dragStartRot: 0,
    reducedMotion: false,
    lowPower:    false
  };

  const MIN_ZOOM  = 0.5;
  const MAX_ZOOM  = 3.0;
  const ZOOM_STEP = 0.25;

  function prefersReducedMotion() {
    try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
  }

  function init(container, { onYearSelect, onMarkerSelect, onRotate, onZoom, onReset } = {}) {
    if (!container) return;

    _state.reducedMotion = prefersReducedMotion();

    // Pointer events — prefer pointermove for unified mouse/touch.
    container.addEventListener("pointerdown", e => {
      // Only start drag on the SVG/Canvas sphere area, not on text or controls.
      if (!e.target.closest(".living-time-sphere-svg, .living-time-sphere-canvas")) return;
      _state.isDragging    = true;
      _state.dragStartX    = e.clientX;
      _state.dragStartY    = e.clientY;
      _state.dragStartRot  = _state.rotationDeg;
      container.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    container.addEventListener("pointermove", e => {
      if (!_state.isDragging) return;
      const dx = e.clientX - _state.dragStartX;
      _state.rotationDeg = (_state.dragStartRot + dx * 0.5 + 360) % 360;
      if (onRotate) onRotate(_state.rotationDeg);
      e.preventDefault();
    });

    container.addEventListener("pointerup", () => { _state.isDragging = false; });
    container.addEventListener("pointercancel", () => { _state.isDragging = false; });

    // Wheel zoom.
    container.addEventListener("wheel", e => {
      if (!e.target.closest(".living-time-sphere-svg, .living-time-sphere-canvas")) return;
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      _state.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, _state.zoom + delta));
      if (onZoom) onZoom(_state.zoom);
      e.preventDefault();
    }, { passive: false });

    // Marker selection.
    container.addEventListener("sphere:year-select", e => {
      if (onYearSelect) onYearSelect(e.detail.year);
    });

    container.addEventListener("click", e => {
      const markerEl = e.target.closest("[data-year]");
      if (markerEl && onMarkerSelect) {
        onMarkerSelect({ type: "year", year: Number(markerEl.dataset.year) });
      }
    });

    // Keyboard navigation.
    container.addEventListener("keydown", e => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        _state.rotationDeg = (_state.rotationDeg + 10) % 360;
        if (onRotate) onRotate(_state.rotationDeg);
        e.preventDefault();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        _state.rotationDeg = (_state.rotationDeg - 10 + 360) % 360;
        if (onRotate) onRotate(_state.rotationDeg);
        e.preventDefault();
      } else if (e.key === "+") {
        _state.zoom = Math.min(MAX_ZOOM, _state.zoom + ZOOM_STEP);
        if (onZoom) onZoom(_state.zoom);
      } else if (e.key === "-") {
        _state.zoom = Math.max(MIN_ZOOM, _state.zoom - ZOOM_STEP);
        if (onZoom) onZoom(_state.zoom);
      } else if (e.key === "0" || e.key === "r") {
        resetView(container, onReset);
      }
    });
  }

  function resetView(container, onReset) {
    _state.rotationDeg = 0;
    _state.zoom        = 1.0;
    _state.isDragging  = false;
    if (onReset) onReset();
  }

  function getState() {
    return Object.assign({}, _state);
  }

  function setLowPower(enabled) {
    _state.lowPower = !!enabled;
  }

  globalThis.LivingTimeSphereInteraction = Object.freeze({ init, resetView, getState, setLowPower });
})();
