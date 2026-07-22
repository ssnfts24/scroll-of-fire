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

  globalThis.RemnantShareUrl = Object.freeze({
    buildPermanentLink,
    parsePermanentLink,
    buildOracleShareLink
  });
})();
