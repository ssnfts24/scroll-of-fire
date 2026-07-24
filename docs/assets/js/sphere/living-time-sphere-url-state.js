(() => {
  "use strict";

  const VALID_VIEW_MODES  = new Set(["today", "passage", "years", "pattern"]);
  const VALID_LAYERS      = new Set(["pattern", "exactDays", "weekGates", "outsideDays", "passage", "lunar", "solar", "markers", "recurrence", "spiral", "environment", "connections"]);
  const VALID_YEARS       = new Set(Array.from({ length: 13 }, (_, i) => String(2014 + i)));
  const VALID_RENDERERS   = new Set(["3d", "svg", "table", "text"]);
  const VALID_QUALITIES   = new Set(["auto", "high", "balanced", "lowpower", "svgonly"]);
  const VALID_CONNECTIONS = new Set(["off", "selected", "contextual", "full", "custom"]);
  const VALID_MOTIONS     = new Set(["still", "drift", "reduced"]);
  const VALID_LABEL_DISTANCES = new Set(["tight", "standard", "wide"]);
  const VALID_DAY_LABELS  = new Set(["key", "all", "selected", "hidden"]);

  function normalizeYear(value) {
    const s = String(value || "").trim();
    return VALID_YEARS.has(s) ? Number(s) : null;
  }

  function normalizeTz(value) {
    const s = String(value || "").trim();
    return s.length > 0 && s.length <= 64 ? s : null;
  }

  function normalizeBoundary(value) {
    const s = String(value || "").trim();
    return ["midnight", "sunset", "manual"].includes(s) ? s : null;
  }

  function normalizeClock(value) {
    const s = String(value || "").trim();
    return /^\d{2}:\d{2}$/.test(s) ? s : null;
  }

  function normalizeRenderer(value) {
    const s = String(value || "").trim().toLowerCase();
    return VALID_RENDERERS.has(s) ? s : null;
  }

  function normalizeQuality(value) {
    const s = String(value || "").trim().toLowerCase();
    return VALID_QUALITIES.has(s) ? s : null;
  }

  function normalizeViewMode(value) {
    const s = String(value || "").trim();
    return VALID_VIEW_MODES.has(s) ? s : null;
  }

  function _normalizeFromSet(value, set) {
    const s = String(value || "").trim().toLowerCase();
    return set.has(s) ? s : null;
  }

  function normalizeLayers(value) {
    if (!value) return null;
    const parts = String(value).split(",").map(s => s.trim()).filter(s => VALID_LAYERS.has(s));
    return parts.length > 0 ? parts : null;
  }

  function normalizeMarker(value) {
    const s = String(value || "").trim();
    return /^[a-zA-Z0-9_-]{1,64}$/.test(s) ? s : null;
  }

  function buildSphereUrl({ baseUrl, year, viewMode, layers, marker, timeZone, boundaryMode, manualSunset, datasetVersion, renderer, quality, cameraTheta, cameraDist, connectionMode, motionMode, moonLabelDistance, dayLabelMode } = {}) {
    const base = baseUrl || (typeof location !== "undefined" ? String(location.origin + location.pathname) : "https://codexofreality.org/living-time-sphere.html");
    let url;
    try { url = new URL(base); } catch { url = new URL("https://codexofreality.org/living-time-sphere.html"); }

    if (year != null)      url.searchParams.set("year",    String(year));
    if (viewMode)          url.searchParams.set("view",    viewMode);
    if (layers?.length)    url.searchParams.set("layers",  layers.join(","));
    if (marker)            url.searchParams.set("marker",  marker);
    if (timeZone)          url.searchParams.set("tz",      timeZone);
    if (boundaryMode)      url.searchParams.set("boundary",boundaryMode);
    if (manualSunset)      url.searchParams.set("sunset",  manualSunset);
    if (datasetVersion)    url.searchParams.set("dataset", datasetVersion);
    if (renderer)          url.searchParams.set("renderer",renderer);
    if (quality)           url.searchParams.set("quality", quality);
    if (connectionMode)    url.searchParams.set("connections", connectionMode);
    if (motionMode)        url.searchParams.set("motion", motionMode);
    if (moonLabelDistance) url.searchParams.set("moon_label_distance", moonLabelDistance);
    if (dayLabelMode)      url.searchParams.set("day_labels", dayLabelMode);
    // Camera state — validate numeric range before serializing
    if (typeof cameraTheta === "number" && isFinite(cameraTheta)) {
      url.searchParams.set("cam_t", cameraTheta.toFixed(4));
    }
    if (typeof cameraDist  === "number" && isFinite(cameraDist)  &&
        cameraDist >= globalThis.LivingTimeSphereCamera?.MIN_ZOOM &&
        cameraDist <= globalThis.LivingTimeSphereCamera?.MAX_ZOOM) {
      url.searchParams.set("cam_d", cameraDist.toFixed(4));
    }

    return url.toString();
  }

  function parseSphereUrl(urlLike) {
    let url;
    try { url = new URL(urlLike, typeof location !== "undefined" ? location.href : "https://codexofreality.org/"); }
    catch { return {}; }

    return {
      year:         normalizeYear(url.searchParams.get("year")),
      viewMode:     normalizeViewMode(url.searchParams.get("view")),
      layers:       normalizeLayers(url.searchParams.get("layers")),
      marker:       normalizeMarker(url.searchParams.get("marker")),
      timeZone:     normalizeTz(url.searchParams.get("tz")),
      boundaryMode: normalizeBoundary(url.searchParams.get("boundary")),
      manualSunset: normalizeClock(url.searchParams.get("sunset")),
      datasetVersion: url.searchParams.get("dataset") || null,
      renderer:     normalizeRenderer(url.searchParams.get("renderer")),
      quality:      normalizeQuality(url.searchParams.get("quality")),
      connectionMode: _normalizeFromSet(url.searchParams.get("connections"), VALID_CONNECTIONS),
      motionMode: _normalizeFromSet(url.searchParams.get("motion"), VALID_MOTIONS),
      moonLabelDistance: _normalizeFromSet(url.searchParams.get("moon_label_distance"), VALID_LABEL_DISTANCES),
      dayLabelMode: _normalizeFromSet(url.searchParams.get("day_labels"), VALID_DAY_LABELS),
      // Camera values — validate numeric range to prevent malformed values from breaking the scene
      cameraTheta:  _normalizeFinite(url.searchParams.get("cam_t"), -Math.PI * 4, Math.PI * 4),
      cameraDist:   _normalizeFinite(url.searchParams.get("cam_d"), 1.0, 9.0),
    };
  }

  function _normalizeFinite(value, min, max) {
    const n = parseFloat(value);
    if (!isFinite(n)) return null;
    if (n < min || n > max) return null;
    return n;
  }

  globalThis.LivingTimeSphereUrlState = Object.freeze({
    buildSphereUrl,
    parseSphereUrl,
    VALID_VIEW_MODES: [...VALID_VIEW_MODES],
    VALID_LAYERS:     [...VALID_LAYERS],
    VALID_RENDERERS:  [...VALID_RENDERERS],
    VALID_QUALITIES:  [...VALID_QUALITIES],
  });
})();
