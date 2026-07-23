(() => {
  "use strict";

  const VALID_VIEW_MODES = new Set(["today", "passage", "years", "pattern"]);
  const VALID_LAYERS = new Set(["pattern", "passage", "lunar", "solar", "markers", "recurrence", "spiral"]);
  const VALID_YEARS  = new Set(Array.from({ length: 13 }, (_, i) => String(2014 + i)));

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

  function normalizeViewMode(value) {
    const s = String(value || "").trim();
    return VALID_VIEW_MODES.has(s) ? s : null;
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

  function buildSphereUrl({ baseUrl, year, viewMode, layers, marker, timeZone, boundaryMode, manualSunset, datasetVersion } = {}) {
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
      datasetVersion: url.searchParams.get("dataset") || null
    };
  }

  globalThis.LivingTimeSphereUrlState = Object.freeze({
    buildSphereUrl,
    parseSphereUrl,
    VALID_VIEW_MODES: [...VALID_VIEW_MODES],
    VALID_LAYERS: [...VALID_LAYERS]
  });
})();
