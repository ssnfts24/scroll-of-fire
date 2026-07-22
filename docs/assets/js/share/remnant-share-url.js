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
    const url = new URL(baseUrl || "./moons.html", globalThis.location?.href || "https://codexofreality.org/moons.html");
    const safeDate = normalizeDate(date);
    if (safeDate) url.searchParams.set("date", safeDate);
    if (timeZone) url.searchParams.set("tz", String(timeZone));
    if (boundaryMode) url.searchParams.set("boundary", String(boundaryMode));
    if (manualSunset) url.searchParams.set("sunset", String(manualSunset));
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
    const url = new URL(urlLike, globalThis.location?.href || "https://codexofreality.org/moons.html");
    return {
      date: normalizeDate(url.searchParams.get("date")),
      timeZone: url.searchParams.get("tz") || "",
      boundaryMode: url.searchParams.get("boundary") || "",
      manualSunset: url.searchParams.get("sunset") || "",
      selectedTab: normalizeSlug(url.searchParams.get("tab")),
      readingVersion: url.searchParams.get("readingVersion") || "",
      displayMode: normalizeSlug(url.searchParams.get("display")),
      source: normalizeSlug(url.searchParams.get("source"))
    };
  }

  function buildOracleShareLink({ baseUrl, timeZone, boundaryMode, sunsetTime, view, oracleVersion, source } = {}) {
    const url = new URL(baseUrl || globalThis.location?.pathname || "./genesis-oracle.html", globalThis.location?.origin || "https://codexofreality.org");
    if (timeZone) url.searchParams.set("tz", String(timeZone));
    if (boundaryMode) url.searchParams.set("boundary", String(boundaryMode));
    if (sunsetTime) url.searchParams.set("sunset", String(sunsetTime));
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
    source
  } = {}) {
    const url = new URL(baseUrl || "./equinox-passage.html", globalThis.location?.href || "https://codexofreality.org/equinox-passage.html");
    const safeYear = normalizeYear(selectedYear);
    if (safeYear) url.searchParams.set("year", safeYear);
    if (timeZone) url.searchParams.set("tz", String(timeZone));
    if (boundaryMode) url.searchParams.set("boundary", String(boundaryMode));
    if (manualSunset) url.searchParams.set("sunset", String(manualSunset));
    const safeDisplay = normalizeSlug(displayMode);
    if (safeDisplay) url.searchParams.set("display", safeDisplay);
    const safeDataset = normalizeVersion(datasetVersion);
    if (safeDataset) url.searchParams.set("dataset", safeDataset);
    const safeSource = normalizeSlug(source);
    if (safeSource) url.searchParams.set("source", safeSource);
    return url.toString();
  }

  function parseEquinoxShareLink(urlLike) {
    const url = new URL(urlLike, globalThis.location?.href || "https://codexofreality.org/equinox-passage.html");
    return {
      selectedYear: normalizeYear(url.searchParams.get("year")),
      timeZone: url.searchParams.get("tz") || "",
      boundaryMode: url.searchParams.get("boundary") || "",
      manualSunset: url.searchParams.get("sunset") || "",
      displayMode: normalizeSlug(url.searchParams.get("display")),
      datasetVersion: normalizeVersion(url.searchParams.get("dataset")),
      source: normalizeSlug(url.searchParams.get("source"))
    };
  }

  globalThis.RemnantShareUrl = Object.freeze({
    buildPermanentLink,
    parsePermanentLink,
    buildOracleShareLink,
    buildEquinoxShareLink,
    parseEquinoxShareLink
  });
})();
