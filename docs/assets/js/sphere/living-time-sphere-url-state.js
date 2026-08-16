(() => {
  "use strict";

  const VALID_VIEW_MODES  = new Set(["today", "passage", "years", "pattern"]);
  const VALID_LAYERS      = new Set(["pattern", "exactDays", "weekGates", "outsideDays", "passage", "lunar", "solar", "markers", "recurrence", "spiral", "environment", "connections"]);
  const VALID_YEARS       = new Set(Array.from({ length: 13 }, (_, i) => String(2014 + i)));
  const VALID_RENDERERS   = new Set(["auto", "3d", "svg", "canvas", "table", "text"]);
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
    if (!s || s.length > 64) return null;
    try {
      return new Intl.DateTimeFormat("en-US", { timeZone: s }).resolvedOptions().timeZone || null;
    } catch {
      return null;
    }
  }

  function normalizeBoundary(value) {
    const s = String(value || "").trim();
    return ["midnight", "sunset", "manual"].includes(s) ? s : null;
  }

  function normalizeClock(value) {
    const s = String(value || "").trim();
    const match = /^(\d{2}):(\d{2})$/.exec(s);
    if (!match) return null;
    return Number(match[1]) <= 23 && Number(match[2]) <= 59 ? s : null;
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

  function normalizeLayers(value, { allowEmpty = false } = {}) {
    if (value == null) return null;
    const parts = String(value).split(",").map(s => s.trim()).filter(s => VALID_LAYERS.has(s));
    if (parts.length > 0) return parts;
    return allowEmpty ? [] : null;
  }

  function normalizeMarker(value) {
    const s = String(value || "").trim();
    return /^[a-zA-Z0-9_-]{1,64}$/.test(s) ? s : null;
  }

  function normalizeSource(value) {
    const s = String(value || "").trim().toLowerCase();
    return /^[a-z0-9_/-]{1,64}$/.test(s) ? s : null;
  }

  function buildSphereUrl({ baseUrl, year, viewMode, layers, marker, timeZone, boundaryMode, manualSunset, datasetVersion, source, renderer, quality, cameraTheta, cameraDist, connectionMode, motionMode, moonLabelDistance, dayLabelMode, preserveUnknownParams = false, hash = null } = {}) {
    const base = baseUrl || (typeof location !== "undefined" ? String(location.origin + location.pathname) : "https://codexofreality.org/living-time-sphere.html");
    let url;
    try { url = new URL(base); } catch { url = new URL("https://codexofreality.org/living-time-sphere.html"); }
    if (!preserveUnknownParams) {
      url.search = "";
    } else {
      [
        "year",
        "view",
        "layers",
        "marker",
        "tz",
        "boundary",
        "sunset",
        "dataset",
        "source",
        "renderer",
        "quality",
        "cam_t",
        "cam_d",
        "connections",
        "motion",
        "moon_label_distance",
        "day_labels",
      ].forEach(key => url.searchParams.delete(key));
    }

    if (year != null)      url.searchParams.set("year",    String(year));
    if (viewMode)          url.searchParams.set("view",    viewMode);
    if (layers?.length)    url.searchParams.set("layers",  layers.join(","));
    if (marker)            url.searchParams.set("marker",  marker);
    if (timeZone)          url.searchParams.set("tz",      timeZone);
    if (boundaryMode)      url.searchParams.set("boundary",boundaryMode);
    if (manualSunset)      url.searchParams.set("sunset",  manualSunset);
    if (datasetVersion)    url.searchParams.set("dataset", datasetVersion);
    if (source)            url.searchParams.set("source", source);
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
    if (typeof hash === "string") {
      url.hash = hash;
    }

    return url.toString();
  }

  function parseSphereUrl(urlLike) {
    let url;
    try { url = new URL(urlLike, typeof location !== "undefined" ? location.href : "https://codexofreality.org/"); }
    catch { return {}; }

    const hasExplicitLayers = url.searchParams.has("layers");
    const rawLayers = url.searchParams.get("layers");
    return {
      year:         normalizeYear(url.searchParams.get("year")),
      viewMode:     normalizeViewMode(url.searchParams.get("view")),
      layers:       normalizeLayers(rawLayers, { allowEmpty: hasExplicitLayers }),
      hasExplicitLayers,
      marker:       normalizeMarker(url.searchParams.get("marker")),
      timeZone:     normalizeTz(url.searchParams.get("tz")),
      boundaryMode: normalizeBoundary(url.searchParams.get("boundary")),
      manualSunset: normalizeClock(url.searchParams.get("sunset")),
      datasetVersion: url.searchParams.get("dataset") || null,
      source: normalizeSource(url.searchParams.get("source")),
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
