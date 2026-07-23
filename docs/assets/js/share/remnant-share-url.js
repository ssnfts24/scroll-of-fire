(() => {
  "use strict";

  function normalizeDate(value) {
    const text = String(value || "");
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
  }

  function normalizeSlug(value) {
    const text = String(value || "").trim();
    return /^[a-zA-Z0-9_.-]{1,64}$/.test(text) ? text : "";
  }

  function normalizeYear(value) {
    const text = String(value || "").trim();
    return /^\d{4}$/.test(text) ? text : "";
  }

  function normalizeVersion(value) {
    const text = String(value || "").trim();
    return /^[a-zA-Z0-9_.\/-]{1,128}$/.test(text) ? text : "";
  }

  function normalizeClock(value) {
    const text = String(value || "").trim();
    const match = /^(\d{2}):(\d{2})$/.exec(text);
    if (!match) return "";
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return "";
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  function safeUrl(urlLike, fallback) {
    try {
      return new URL(urlLike, globalThis.location?.href || fallback);
    } catch {
      return new URL(fallback);
    }
  }

  function buildPermanentLink({
    baseUrl,
    date,
    timeZone,
    boundaryMode,
    manualSunset,
    selectedTab,
    readingVersion,
    displayMode,
    source
  } = {}) {
    const url = safeUrl(baseUrl || "./moons.html", "https://codexofreality.org/moons.html");
    const safeDate = normalizeDate(date);
    if (safeDate) url.searchParams.set("date", safeDate);
    if (timeZone) url.searchParams.set("tz", String(timeZone));
    if (boundaryMode) url.searchParams.set("boundary", String(boundaryMode));
    const safeSunset = normalizeClock(manualSunset);
    if (safeSunset) url.searchParams.set("sunset", safeSunset);
    const safeTab = normalizeSlug(selectedTab);
    if (safeTab) url.searchParams.set("tab", safeTab);
    if (readingVersion) url.searchParams.set("readingVersion", String(readingVersion));
    const safeDisplay = normalizeSlug(displayMode);
    if (safeDisplay) url.searchParams.set("display", safeDisplay);
    const safeSource = normalizeSlug(source);
    if (safeSource) url.searchParams.set("source", safeSource);
    return url.toString();
  }

  function parsePermanentLink(urlLike) {
    const url = safeUrl(urlLike, "https://codexofreality.org/moons.html");
    return {
      date: normalizeDate(url.searchParams.get("date")),
      timeZone: url.searchParams.get("tz") || "",
      boundaryMode: url.searchParams.get("boundary") || "",
      manualSunset: normalizeClock(url.searchParams.get("sunset")),
      selectedTab: normalizeSlug(url.searchParams.get("tab")),
      readingVersion: url.searchParams.get("readingVersion") || "",
      displayMode: normalizeSlug(url.searchParams.get("display")),
      source: normalizeSlug(url.searchParams.get("source"))
    };
  }

  function buildOracleShareLink({ baseUrl, timeZone, boundaryMode, sunsetTime, view, oracleVersion, source } = {}) {
    const url = safeUrl(baseUrl || globalThis.location?.pathname || "./genesis-oracle.html", "https://codexofreality.org/genesis-oracle.html");
    if (timeZone) url.searchParams.set("tz", String(timeZone));
    if (boundaryMode) url.searchParams.set("boundary", String(boundaryMode));
    const safeSunset = normalizeClock(sunsetTime);
    if (safeSunset) url.searchParams.set("sunset", safeSunset);
    url.searchParams.set("view", normalizeSlug(view) || "quick");
    url.searchParams.set("oracleVersion", oracleVersion || "genesis-oracle/2.0.0");
    const safeSource = normalizeSlug(source);
    if (safeSource) url.searchParams.set("source", safeSource);
    return url.toString();
  }

  function buildEquinoxShareLink({
    baseUrl,
    selectedYear,
    timeZone,
    boundaryMode,
    manualSunset,
    displayMode,
    datasetVersion,
    compareYearA,
    compareYearB,
    source
  } = {}) {
    const url = safeUrl(baseUrl || "./equinox-passage.html", "https://codexofreality.org/equinox-passage.html");
    const safeYear = normalizeYear(selectedYear);
    if (safeYear) url.searchParams.set("year", safeYear);
    if (timeZone) url.searchParams.set("tz", String(timeZone));
    if (boundaryMode) url.searchParams.set("boundary", String(boundaryMode));
    const safeSunset = normalizeClock(manualSunset);
    if (safeSunset) url.searchParams.set("sunset", safeSunset);
    const safeDisplay = normalizeSlug(displayMode);
    if (safeDisplay) url.searchParams.set("display", safeDisplay);
    const safeDataset = normalizeVersion(datasetVersion);
    if (safeDataset) url.searchParams.set("dataset", safeDataset);
    const safeCompareA = normalizeYear(compareYearA);
    if (safeCompareA) url.searchParams.set("compareA", safeCompareA);
    const safeCompareB = normalizeYear(compareYearB);
    if (safeCompareB) url.searchParams.set("compareB", safeCompareB);
    const safeSource = normalizeSlug(source);
    if (safeSource) url.searchParams.set("source", safeSource);
    return url.toString();
  }

  function parseEquinoxShareLink(urlLike) {
    const url = safeUrl(urlLike, "https://codexofreality.org/equinox-passage.html");
    return {
      selectedYear: normalizeYear(url.searchParams.get("year")),
      timeZone: url.searchParams.get("tz") || "",
      boundaryMode: url.searchParams.get("boundary") || "",
      manualSunset: normalizeClock(url.searchParams.get("sunset")),
      displayMode: normalizeSlug(url.searchParams.get("display")),
      datasetVersion: normalizeVersion(url.searchParams.get("dataset")),
      compareYearA: normalizeYear(url.searchParams.get("compareA")),
      compareYearB: normalizeYear(url.searchParams.get("compareB")),
      source: normalizeSlug(url.searchParams.get("source"))
    };
  }

  // ── Alignment Ledger share links ───────────────────────────────────

  function buildAlignmentShareLink({
    baseUrl,
    selectedYear,
    compareYear,
    timeZone,
    boundaryMode,
    manualSunset,
    mode,
    layers,
    marker,
    datasetVersion,
    source
  } = {}) {
    const url = safeUrl(baseUrl || "./alignment-ledger.html", "https://codexofreality.org/alignment-ledger.html");
    const safeYear = normalizeYear(selectedYear);
    if (safeYear)             url.searchParams.set("year",    safeYear);
    const safeCmp = normalizeYear(compareYear);
    if (safeCmp)              url.searchParams.set("cmpYear", safeCmp);
    if (timeZone)             url.searchParams.set("tz",      String(timeZone));
    if (boundaryMode)         url.searchParams.set("boundary",String(boundaryMode));
    const safeSunsetVal = normalizeClock(manualSunset);
    if (safeSunsetVal)        url.searchParams.set("sunset",  safeSunsetVal);
    const safeMode = normalizeSlug(mode);
    if (safeMode)             url.searchParams.set("mode",    safeMode);
    if (Array.isArray(layers) && layers.length) url.searchParams.set("layers", layers.join(","));
    const safeMarker = normalizeSlug(marker);
    if (safeMarker)           url.searchParams.set("marker",  safeMarker);
    const safeDataset = normalizeVersion(datasetVersion);
    if (safeDataset)          url.searchParams.set("dataset", safeDataset);
    const safeSrc = normalizeSlug(source);
    if (safeSrc)              url.searchParams.set("source",  safeSrc);
    return url.toString();
  }

  function parseAlignmentShareLink(urlLike) {
    const url = safeUrl(urlLike, "https://codexofreality.org/alignment-ledger.html");
    return {
      selectedYear:   normalizeYear(url.searchParams.get("year")),
      compareYear:    normalizeYear(url.searchParams.get("cmpYear")),
      timeZone:       url.searchParams.get("tz")        || null,
      boundaryMode:   url.searchParams.get("boundary")  || null,
      manualSunset:   normalizeClock(url.searchParams.get("sunset")),
      mode:           normalizeSlug(url.searchParams.get("mode")),
      layers:         url.searchParams.get("layers")?.split(",").filter(Boolean) || null,
      marker:         normalizeSlug(url.searchParams.get("marker")),
      datasetVersion: normalizeVersion(url.searchParams.get("dataset"))
    };
  }

  // ── Living Time Sphere share links ─────────────────────────────────

  function buildSphereShareLink({
    baseUrl,
    selectedYear,
    viewMode,
    layers,
    marker,
    timeZone,
    boundaryMode,
    manualSunset,
    datasetVersion,
    source
  } = {}) {
    const url = safeUrl(baseUrl || "./living-time-sphere.html", "https://codexofreality.org/living-time-sphere.html");
    const safeYear = normalizeYear(selectedYear);
    if (safeYear)            url.searchParams.set("year",    safeYear);
    const safeView = normalizeSlug(viewMode);
    if (safeView)            url.searchParams.set("view",    safeView);
    if (Array.isArray(layers) && layers.length) url.searchParams.set("layers", layers.join(","));
    const safeMarker = normalizeSlug(marker);
    if (safeMarker)          url.searchParams.set("marker",  safeMarker);
    if (timeZone)            url.searchParams.set("tz",      String(timeZone));
    if (boundaryMode)        url.searchParams.set("boundary",String(boundaryMode));
    const safeSunsetVal = normalizeClock(manualSunset);
    if (safeSunsetVal)       url.searchParams.set("sunset",  safeSunsetVal);
    const safeDataset = normalizeVersion(datasetVersion);
    if (safeDataset)         url.searchParams.set("dataset", safeDataset);
    const safeSrc = normalizeSlug(source);
    if (safeSrc)             url.searchParams.set("source",  safeSrc);
    return url.toString();
  }

  function parseSphereShareLink(urlLike) {
    const url = safeUrl(urlLike, "https://codexofreality.org/living-time-sphere.html");
    return {
      selectedYear:   normalizeYear(url.searchParams.get("year")),
      viewMode:       normalizeSlug(url.searchParams.get("view")),
      layers:         url.searchParams.get("layers")?.split(",").filter(Boolean) || null,
      marker:         normalizeSlug(url.searchParams.get("marker")),
      timeZone:       url.searchParams.get("tz")       || null,
      boundaryMode:   url.searchParams.get("boundary") || null,
      manualSunset:   normalizeClock(url.searchParams.get("sunset")),
      datasetVersion: normalizeVersion(url.searchParams.get("dataset"))
    };
  }

  globalThis.RemnantShareUrl = Object.freeze({
    buildPermanentLink,
    parsePermanentLink,
    buildOracleShareLink,
    buildEquinoxShareLink,
    parseEquinoxShareLink,
    buildAlignmentShareLink,
    parseAlignmentShareLink,
    buildSphereShareLink,
    parseSphereShareLink
  });
})();
