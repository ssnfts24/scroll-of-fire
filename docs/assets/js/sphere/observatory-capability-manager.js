(() => {
  "use strict";

  // Observatory Capability Manager — PR1 Reliability Foundation
  //
  // Centralises:
  //   - WebGL / device capability detection
  //   - Performance tier selection (high / balanced / lowpower / minimal)
  //   - Device pixel-ratio capping
  //   - Fallback reason taxonomy (categorised reason codes with structured metadata)
  //
  // All public API is exposed on globalThis.ObservatoryCapabilityManager.
  // This module has no runtime dependencies and must be loaded before
  // any sphere renderer or mount script.

  // ── Fallback reason taxonomy ──────────────────────────────────────
  // These codes appear in console diagnostics and are surfaced to the
  // UI "Technical Details" section via LivingTimeSphereRenderer3d.getStatus().
  // User-facing messages remain compact; codes are for developer/support use.

  const FALLBACK_REASONS = Object.freeze({
    /** WebGL is completely unavailable in this browser/environment. */
    WEBGL_UNSUPPORTED:    "WEBGL_UNSUPPORTED",
    /** Dynamic import() of the Three.js vendor bundle failed. */
    THREE_IMPORT_FAILED:  "THREE_IMPORT_FAILED",
    /** Canvas element could not be created or inserted into the DOM. */
    CANVAS_INIT_FAILED:   "CANVAS_INIT_FAILED",
    /** WebGL context was lost after successful initialisation. */
    CONTEXT_LOST:         "CONTEXT_LOST",
    /**
     * Device reported memory is so low that 3D rendering is actively refused.
     * This code is ONLY emitted when device memory is below
     * GENUINE_3D_REFUSAL_MEMORY_GIB (0.5 GiB) — i.e. a genuine hardware
     * limitation, not merely a reason to reduce quality.
     * Low-memory devices above this threshold receive LOWPOWER tier instead.
     * Do NOT use this code for "constrained but capable" devices.
     */
    DEVICE_MEMORY_GUARD:  "DEVICE_MEMORY_GUARD",
    /** 3D initialisation did not complete within the allowed timeout. */
    INIT_TIMEOUT:         "INIT_TIMEOUT",
    /** Quality preset was explicitly set to SVG-only. */
    QUALITY_SVGONLY:      "QUALITY_SVGONLY",
    /** An unexpected exception was thrown during initialisation. */
    INIT_EXCEPTION:       "INIT_EXCEPTION",
    /** A required peer module (e.g. LivingTimeSphereCamera) was not loaded. */
    MISSING_DEPENDENCY:   "MISSING_DEPENDENCY",
  });

  /**
   * Device memory threshold below which 3D rendering is actively refused.
   * Devices between this value and 2 GiB receive LOWPOWER tier (functional 3D).
   * Only devices reporting below this threshold emit DEVICE_MEMORY_GUARD.
   */
  const GENUINE_3D_REFUSAL_MEMORY_GIB = 0.5;

  // ── Performance tier definitions ──────────────────────────────────

  /**
   * Tier definitions map to quality preset names used by LivingTimeSphereM.
   * The renderer reads these to select antialias, pixelRatioMax, etc.
   */
  const PERFORMANCE_TIERS = Object.freeze({
    HIGH:      "high",
    BALANCED:  "balanced",
    LOWPOWER:  "lowpower",
    MINIMAL:   "svgonly",   // Triggers SVG fallback; no 3D rendered.
  });

  // Max device-pixel-ratio cap per tier.  Prevents GPU overload on
  // high-DPI displays when the device is already under memory/CPU pressure.
  const _PIXEL_RATIO_CAP = Object.freeze({
    [PERFORMANCE_TIERS.HIGH]:     2.5,
    [PERFORMANCE_TIERS.BALANCED]: 2.0,
    [PERFORMANCE_TIERS.LOWPOWER]: 1.5,
    [PERFORMANCE_TIERS.MINIMAL]:  1.0,
  });

  // ── Device capability detection ───────────────────────────────────

  /**
   * Probe whether WebGL (or WebGL2) is available.
   * Returns { webgl: boolean, webgl2: boolean }.
   * Safe to call before the renderer is initialised.
   */
  function probeWebGl() {
    try {
      const c = document.createElement("canvas");
      const webgl2 = !!(c.getContext("webgl2"));
      const webgl  = webgl2 || !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
      return { webgl, webgl2 };
    } catch {
      return { webgl: false, webgl2: false };
    }
  }

  /**
   * Return the device memory in GiB (from navigator.deviceMemory) or null
   * if the API is not available.
   */
  function _deviceMemoryGib() {
    const dm = typeof navigator !== "undefined" ? navigator.deviceMemory : undefined;
    return typeof dm === "number" ? dm : null;
  }

  /**
   * Return true if the device has insufficient memory to safely run the
   * full 3D sphere (threshold: < 2 GiB reported).
   */
  function isLowMemoryDevice() {
    const mem = _deviceMemoryGib();
    return mem !== null && mem < 2;
  }

  /**
   * Return true if the user has opted into reduced-data (Save-Data header
   * or connection.saveData) or is on a 2G connection.
   */
  function isReducedDataMode() {
    try {
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (conn?.saveData === true) return true;
      if (/2g$/i.test(conn?.effectiveType || "")) return true;
    } catch { /* navigator may not be available */ }
    return false;
  }

  /**
   * Return true if the user has the prefers-reduced-motion media query set.
   */
  function prefersReducedMotion() {
    try {
      return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    } catch {
      return false;
    }
  }

  // ── Tier selection ────────────────────────────────────────────────

  /**
   * Automatically select the best performance tier for this device.
   *
   * Override order (highest priority first):
   *   1. Explicit override passed by caller.
   *   2. MINIMAL  — WebGL unavailable or device memory guard triggered.
   *   3. LOWPOWER — reduced-data mode, low memory, or low CPU count.
   *   4. BALANCED — moderate hardware.
   *   5. HIGH     — default for capable devices.
   *
   * @param {object} [options]
   * @param {string} [options.override]   Force a specific tier key from PERFORMANCE_TIERS.
   * @param {boolean} [options.webglAvailable]  Pre-computed WebGL probe result (avoids duplicate canvas).
   * @returns {string}  One of the PERFORMANCE_TIERS values.
   */
  function selectTier({ override, webglAvailable } = {}) {
    // 1. Explicit override
    const tierValues = new Set(Object.values(PERFORMANCE_TIERS));
    if (override && tierValues.has(override)) return override;

    // 2. WebGL unavailable
    const webgl = webglAvailable ?? probeWebGl().webgl;
    if (!webgl) return PERFORMANCE_TIERS.MINIMAL;

    // 2b. Genuine memory refusal — device memory is so low that 3D is
    //     intentionally refused.  Callers should emit DEVICE_MEMORY_GUARD.
    //     Devices above this but below 2 GiB receive LOWPOWER (functional 3D).
    const mem = _deviceMemoryGib();
    if (mem !== null && mem < GENUINE_3D_REFUSAL_MEMORY_GIB) return PERFORMANCE_TIERS.MINIMAL;

    // 3. Low-memory → LOWPOWER (functional 3D with reduced cost)
    if (isLowMemoryDevice()) return PERFORMANCE_TIERS.LOWPOWER;

    // 4. Reduced-data / constrained network
    if (isReducedDataMode()) return PERFORMANCE_TIERS.LOWPOWER;

    // 4b. Low CPU count (≤ 2 threads)
    const cpuCount = typeof navigator !== "undefined" ? navigator.hardwareConcurrency : undefined;
    if (typeof cpuCount === "number" && cpuCount <= 2) return PERFORMANCE_TIERS.LOWPOWER;

    // 5. Balanced — moderate hardware (≤ 4 GB or ≤ 4 CPUs)
    if ((mem !== null && mem <= 4) || (typeof cpuCount === "number" && cpuCount <= 4)) {
      return PERFORMANCE_TIERS.BALANCED;
    }

    // 6. Default: high
    return PERFORMANCE_TIERS.HIGH;
  }

  // ── Pixel-ratio cap ───────────────────────────────────────────────

  /**
   * Return the effective device pixel ratio, capped to the limit for the
   * given tier to prevent GPU overload on retina displays.
   *
   * @param {string} tier  One of PERFORMANCE_TIERS values.
   * @param {number} [rawDpr]  Raw devicePixelRatio (defaults to global).
   * @returns {number}
   */
  function clampPixelRatio(tier, rawDpr) {
    const cap = _PIXEL_RATIO_CAP[tier] ?? 2.0;
    const dpr = typeof rawDpr === "number" ? rawDpr
      : (typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1);
    return Math.min(Math.max(dpr, 0.5), cap);
  }

  // ── Reason-code helpers ───────────────────────────────────────────

  /**
   * Map a legacy/internal reason string (from the renderer) to the
   * canonical FALLBACK_REASON code.  Returns the input unchanged if it is
   * already a canonical code.
   *
   * Legacy strings are produced by the renderer before it was updated to
   * use the taxonomy; this mapper provides backward compatibility.
   */
  function mapLegacyReason(legacyReason) {
    const map = {
      "webgl-unavailable":    FALLBACK_REASONS.WEBGL_UNSUPPORTED,
      "webgl-context-failed": FALLBACK_REASONS.CANVAS_INIT_FAILED,
      "three-load-failed":    FALLBACK_REASONS.THREE_IMPORT_FAILED,
      "quality-svgonly":      FALLBACK_REASONS.QUALITY_SVGONLY,
      "init-exception":       FALLBACK_REASONS.INIT_EXCEPTION,
      "init-timeout":         FALLBACK_REASONS.INIT_TIMEOUT,
    };
    return map[legacyReason] ?? legacyReason;
  }

  /**
   * Return a short human-readable description for a fallback reason code,
   * suitable for the "Technical Details" section.
   *
   * @param {string} reasonCode  A FALLBACK_REASONS value.
   * @returns {string}
   */
  function describeReason(reasonCode) {
    const descriptions = {
      [FALLBACK_REASONS.WEBGL_UNSUPPORTED]:   "WebGL is not available in this browser or device.",
      [FALLBACK_REASONS.THREE_IMPORT_FAILED]: "The 3D library (Three.js) could not be loaded.",
      [FALLBACK_REASONS.CANVAS_INIT_FAILED]:  "A WebGL rendering context could not be created.",
      [FALLBACK_REASONS.CONTEXT_LOST]:        "The WebGL context was lost after initialisation.",
      [FALLBACK_REASONS.DEVICE_MEMORY_GUARD]: "Insufficient device memory to run the 3D sphere.",
      [FALLBACK_REASONS.INIT_TIMEOUT]:        "3D initialisation timed out.",
      [FALLBACK_REASONS.QUALITY_SVGONLY]:     "Quality preset is set to SVG-only.",
      [FALLBACK_REASONS.INIT_EXCEPTION]:      "An unexpected error occurred during initialisation.",
      [FALLBACK_REASONS.MISSING_DEPENDENCY]:  "A required module was not loaded.",
      CANVAS_MISSING: "Render surface missing: WebGL canvas was not found.",
      CANVAS_NOT_CONNECTED: "Render surface invalid: canvas is detached from the document.",
      CANVAS_WRONG_PARENT: "Render surface invalid: canvas parent is not the sphere host.",
      CANVAS_ZERO_ATTRIBUTE_WIDTH: "Render surface invalid: canvas width attribute is zero.",
      CANVAS_ZERO_ATTRIBUTE_HEIGHT: "Render surface invalid: canvas height attribute is zero.",
      CANVAS_ZERO_CSS_WIDTH: "Render surface invalid: canvas CSS width is zero.",
      CANVAS_ZERO_CSS_HEIGHT: "Render surface invalid: canvas CSS height is zero.",
      CANVAS_HIDDEN_DISPLAY: "Render surface invalid: canvas display is none.",
      CANVAS_HIDDEN_VISIBILITY: "Render surface invalid: canvas visibility is hidden.",
      CANVAS_ZERO_OPACITY: "Render surface invalid: canvas opacity is zero.",
      CONTAINER_ZERO_WIDTH: "Render surface invalid: container width is zero.",
      CONTAINER_ZERO_HEIGHT: "Render surface invalid: container height is zero.",
      WEBGL_CONTEXT_MISSING: "Render surface invalid: WebGL context is missing.",
      WEBGL_CONTEXT_LOST: "Render surface invalid: WebGL context is lost.",
      FIRST_FRAME_NOT_RENDERED: "Render surface invalid: first frame never completed.",
      CANVAS_COVERED: "Render surface invalid: canvas is covered by another element.",
      DUPLICATE_RENDER_SURFACE: "Render surface invalid: duplicate render surfaces detected.",
      STALE_RENDER_GENERATION: "Render surface invalid: stale renderer generation detected.",
      RENDERER_DISPOSED: "Render surface invalid: renderer was disposed.",
      DRAWING_BUFFER_ZERO: "Render surface invalid: drawing buffer size is zero.",
      SCENE_EMPTY: "Render surface invalid: scene has no renderable objects.",
      CAMERA_INVALID: "Render surface invalid: camera parameters are invalid.",
      BROKEN_MEDIA_IN_SURFACE: "Render surface invalid: broken media node exists in the sphere host.",
    };
    return descriptions[reasonCode] ?? `Unknown reason: ${reasonCode}`;
  }

  // ── Context-loss guard factory ────────────────────────────────────

  /**
   * Attach WebGL context-loss and context-restoration listeners to a canvas
   * element.  When context is lost, onLost() is called; when restored,
   * onRestored() is called.
   *
   * Returns a dispose function that removes the listeners.
   *
   * @param {HTMLCanvasElement} canvas
   * @param {{ onLost: Function, onRestored: Function }} callbacks
   * @returns {Function}  dispose()
   */
  function attachContextLossGuard(canvas, { onLost, onRestored } = {}) {
    if (!canvas || typeof canvas.addEventListener !== "function") {
      return () => {};
    }

    function handleLost(evt) {
      evt.preventDefault();  // Required to allow restoration.
      console.warn("[Observatory] WebGL context lost.", FALLBACK_REASONS.CONTEXT_LOST);
      try { onLost?.(); } catch { /* don't let consumer throw block recovery */ }
    }

    function handleRestored() {
      console.info("[Observatory] WebGL context restored — attempting 3D reinitialisation.");
      try { onRestored?.(); } catch { /* don't let consumer throw block recovery */ }
    }

    canvas.addEventListener("webglcontextlost",    handleLost,    { passive: false });
    canvas.addEventListener("webglcontextrestored", handleRestored, { passive: true });

    return function dispose() {
      canvas.removeEventListener("webglcontextlost",    handleLost,    { passive: false });
      canvas.removeEventListener("webglcontextrestored", handleRestored, { passive: true });
    };
  }

  // ── Init-timeout helper ───────────────────────────────────────────

  /**
   * Return a Promise that rejects with a INIT_TIMEOUT reason after
   * `timeoutMs` milliseconds.  Race this against the actual init promise.
   *
   * @param {number} timeoutMs
   * @returns {Promise<never>}
   */
  function initTimeout(timeoutMs) {
    return new Promise((_, reject) => {
      setTimeout(
        () => reject({ reason: FALLBACK_REASONS.INIT_TIMEOUT, detail: `Timed out after ${timeoutMs}ms` }),
        timeoutMs
      );
    });
  }

  // ── Performance-runtime integration ──────────────────────────────
  //
  // performance-runtime.js publishes a page-level performance profile via
  // the "sof:performance-profile" custom event.  Observatory-specific
  // capability decisions are the authority of ObservatoryCapabilityManager;
  // performance-runtime handles CSS classes and media loading.
  //
  // selectTierFromProfile() lets the mount layer combine both signals into
  // a single authoritative tier decision without calling selectTier() twice.

  /**
   * Select the best performance tier given a pre-computed performance profile
   * from performance-runtime.js.
   *
   * The profile object should have at least:
   *   { constrained: bool, reducedData: bool, lowMemory: bool, lowCpu: bool }
   *
   * WebGL availability is still probed directly (it is not part of the
   * performance-runtime profile).
   *
   * @param {object} profile  Performance profile from sof:performance-profile event.
   * @param {object} [options]
   * @param {string} [options.override]  Explicit tier override.
   * @param {boolean} [options.webglAvailable]  Pre-probed WebGL result.
   * @returns {string}  One of PERFORMANCE_TIERS values.
   */
  function selectTierFromProfile(profile, { override, webglAvailable } = {}) {
    const tierValues = new Set(Object.values(PERFORMANCE_TIERS));
    if (override && tierValues.has(override)) return override;

    const webgl = webglAvailable ?? probeWebGl().webgl;
    if (!webgl) return PERFORMANCE_TIERS.MINIMAL;

    const mem = _deviceMemoryGib();
    if (mem !== null && mem < GENUINE_3D_REFUSAL_MEMORY_GIB) return PERFORMANCE_TIERS.MINIMAL;

    if (profile?.lowMemory || isLowMemoryDevice()) return PERFORMANCE_TIERS.LOWPOWER;
    if (profile?.reducedData || isReducedDataMode()) return PERFORMANCE_TIERS.LOWPOWER;
    if (profile?.lowCpu) return PERFORMANCE_TIERS.LOWPOWER;
    if (profile?.constrained) return PERFORMANCE_TIERS.BALANCED;
    return selectTier({ webglAvailable: webgl });
  }

  // ── Public API ────────────────────────────────────────────────────

  globalThis.ObservatoryCapabilityManager = Object.freeze({
    /** Canonical fallback reason codes. */
    FALLBACK_REASONS,
    /** Performance tier string constants. */
    PERFORMANCE_TIERS,
    /**
     * Device memory threshold (GiB) below which 3D is actively refused.
     * Devices above this but constrained still receive LOWPOWER tier.
     */
    GENUINE_3D_REFUSAL_MEMORY_GIB,
    /** Probe WebGL availability without initialising a renderer. */
    probeWebGl,
    /** Returns true if the device has < 2 GiB reported memory. */
    isLowMemoryDevice,
    /** Returns true if reduced-data mode is active. */
    isReducedDataMode,
    /** Returns true if prefers-reduced-motion media query is set. */
    prefersReducedMotion,
    /** Automatically select the best performance tier for this device. */
    selectTier,
    /**
     * Select the best tier given a pre-computed sof:performance-profile.
     * Use this when the performance-runtime profile is already available to
     * avoid duplicate device probes.
     */
    selectTierFromProfile,
    /** Clamp devicePixelRatio to the per-tier safe maximum. */
    clampPixelRatio,
    /** Map legacy renderer reason strings to canonical taxonomy codes. */
    mapLegacyReason,
    /** Return a short human-readable description for a reason code. */
    describeReason,
    /** Attach WebGL context-loss/restoration guards to a canvas. */
    attachContextLossGuard,
    /** Return a Promise that rejects after timeoutMs with INIT_TIMEOUT. */
    initTimeout,
  });
})();
