(() => {
  "use strict";

  const VALID_YEARS = new Set(
    Array.from({ length: 13 }, (_, i) => String(2014 + i))
  );
  // Alignment page modes
  const VALID_ALIGNMENT_MODES = new Set(["ledger", "comparison", "recurrence", "spiral"]);
  // Sphere viewing modes
  const VALID_SPHERE_MODES = new Set(["today", "passage", "years", "pattern"]);
  const VALID_MODES  = new Set([...VALID_ALIGNMENT_MODES, ...VALID_SPHERE_MODES]);
  const VALID_LAYERS = new Set(["pattern", "passage", "lunar", "solar", "markers", "recurrence", "spiral"]);

  function normalizeYear(value) {
    const s = String(value || "").trim();
    return VALID_YEARS.has(s) ? Number(s) : null;
  }

  function normalizeTz(value) {
    const s = String(value || "").trim();
    if (!s || s.length > 64) return null;
    return s;
  }

  function normalizeBoundary(value) {
    const s = String(value || "").trim();
    return ["midnight", "sunset", "manual"].includes(s) ? s : null;
  }

  function normalizeClock(value) {
    const s = String(value || "").trim();
    const match = /^\d{2}:\d{2}$/.exec(s);
    if (!match) return null;
    const hour = Number(s.slice(0, 2));
    const min  = Number(s.slice(3, 5));
    if (hour < 0 || hour > 23 || min < 0 || min > 59) return null;
    return s;
  }

  function normalizeMode(value) {
    const s = String(value || "").trim();
    return VALID_MODES.has(s) ? s : null;
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

  function buildAlignmentShareLink({ baseUrl, year, compareYear, timeZone, boundaryMode, manualSunset, mode, layers, marker, datasetVersion } = {}) {
    const base = baseUrl || (typeof location !== "undefined" ? String(location.origin + location.pathname) : "https://codexofreality.org/alignment-ledger.html");
    let url;
    try { url = new URL(base); } catch { url = new URL("https://codexofreality.org/alignment-ledger.html"); }

    if (year != null)          url.searchParams.set("year",    String(year));
    if (compareYear != null)   url.searchParams.set("cmpYear", String(compareYear));
    if (timeZone)              url.searchParams.set("tz",       timeZone);
    if (boundaryMode)          url.searchParams.set("boundary", boundaryMode);
    if (manualSunset)          url.searchParams.set("sunset",   manualSunset);
    if (mode)                  url.searchParams.set("mode",     mode);
    if (layers?.length)        url.searchParams.set("layers",   layers.join(","));
    if (marker)                url.searchParams.set("marker",   marker);
    if (datasetVersion)        url.searchParams.set("dataset",  datasetVersion);

    return url.toString();
  }

  function parseAlignmentShareLink(urlLike) {
    let url;
    try { url = new URL(urlLike, typeof location !== "undefined" ? location.href : "https://codexofreality.org/"); }
    catch { return {}; }

    return {
      year:          normalizeYear(url.searchParams.get("year")),
      compareYear:   normalizeYear(url.searchParams.get("cmpYear")),
      timeZone:      normalizeTz(url.searchParams.get("tz")),
      boundaryMode:  normalizeBoundary(url.searchParams.get("boundary")),
      manualSunset:  normalizeClock(url.searchParams.get("sunset")),
      mode:          normalizeMode(url.searchParams.get("mode")),
      layers:        normalizeLayers(url.searchParams.get("layers")),
      marker:        normalizeMarker(url.searchParams.get("marker")),
      datasetVersion: url.searchParams.get("dataset") || null
    };
  }

  function buildSphereShareLink({ baseUrl, year, viewMode, layers, marker, timeZone, boundaryMode, manualSunset, datasetVersion } = {}) {
    const base = baseUrl || (typeof location !== "undefined" ? String(location.origin + location.pathname) : "https://codexofreality.org/living-time-sphere.html");
    let url;
    try { url = new URL(base); } catch { url = new URL("https://codexofreality.org/living-time-sphere.html"); }

    if (year != null)     url.searchParams.set("year",    String(year));
    if (viewMode)         url.searchParams.set("view",    viewMode);
    if (layers?.length)   url.searchParams.set("layers",  layers.join(","));
    if (marker)           url.searchParams.set("marker",  marker);
    if (timeZone)         url.searchParams.set("tz",      timeZone);
    if (boundaryMode)     url.searchParams.set("boundary",boundaryMode);
    if (manualSunset)     url.searchParams.set("sunset",  manualSunset);
    if (datasetVersion)   url.searchParams.set("dataset", datasetVersion);

    return url.toString();
  }

  function parseSphereShareLink(urlLike) {
    let url;
    try { url = new URL(urlLike, typeof location !== "undefined" ? location.href : "https://codexofreality.org/"); }
    catch { return {}; }

    return {
      year:          normalizeYear(url.searchParams.get("year")),
      viewMode:      normalizeMode(url.searchParams.get("view")),
      layers:        normalizeLayers(url.searchParams.get("layers")),
      marker:        normalizeMarker(url.searchParams.get("marker")),
      timeZone:      normalizeTz(url.searchParams.get("tz")),
      boundaryMode:  normalizeBoundary(url.searchParams.get("boundary")),
      manualSunset:  normalizeClock(url.searchParams.get("sunset")),
      datasetVersion: url.searchParams.get("dataset") || null
    };
  }

  globalThis.AlignmentUrlState = Object.freeze({
    buildAlignmentShareLink,
    parseAlignmentShareLink,
    buildSphereShareLink,
    parseSphereShareLink
  });
})();
