(() => {
  "use strict";

  const BANDS = Object.freeze({
    FAR: "far",
    MEDIUM: "medium",
    NEAR: "near",
    DETAIL: "detail",
  });

  const BAND_ORDER = Object.freeze([BANDS.FAR, BANDS.MEDIUM, BANDS.NEAR, BANDS.DETAIL]);

  const BASE_THRESHOLDS = Object.freeze({
    farMin: 3.25,
    mediumMin: 2.35,
    nearMin: 1.62,
  });

  const BAND_VISIBILITY = Object.freeze({
    [BANDS.FAR]: Object.freeze({
      exactDays: false,
      weekGates: false,
      outsideDays: false,
      recurrence: false,
      dayLabelMode: "hidden",
      moonLabelMode: "essential",
      connectionMode: "selected",
      maxConnections: 3,
      dayNodeOpacity: 0.22,
    }),
    [BANDS.MEDIUM]: Object.freeze({
      exactDays: true,
      weekGates: true,
      outsideDays: false,
      recurrence: false,
      dayLabelMode: "key",
      moonLabelMode: "balanced",
      connectionMode: "contextual",
      maxConnections: 6,
      dayNodeOpacity: 0.5,
    }),
    [BANDS.NEAR]: Object.freeze({
      exactDays: true,
      weekGates: true,
      outsideDays: true,
      recurrence: true,
      dayLabelMode: "selected",
      moonLabelMode: "balanced",
      connectionMode: "contextual",
      maxConnections: 10,
      dayNodeOpacity: 0.72,
    }),
    [BANDS.DETAIL]: Object.freeze({
      exactDays: true,
      weekGates: true,
      outsideDays: true,
      recurrence: true,
      dayLabelMode: "all",
      moonLabelMode: "all",
      connectionMode: "full",
      maxConnections: 16,
      dayNodeOpacity: 0.9,
    }),
  });

  function _mobileOffset(screenWidth) {
    const w = Number(screenWidth) || 1024;
    if (w < 480) return 0.24;
    if (w < 760) return 0.12;
    return 0;
  }

  function resolveBand({ distance, screenWidth } = {}) {
    const d = Number(distance);
    if (!Number.isFinite(d)) return BANDS.MEDIUM;
    const offset = _mobileOffset(screenWidth);
    const farMin = BASE_THRESHOLDS.farMin - offset;
    const mediumMin = BASE_THRESHOLDS.mediumMin - offset;
    const nearMin = BASE_THRESHOLDS.nearMin - offset;
    if (d >= farMin) return BANDS.FAR;
    if (d >= mediumMin) return BANDS.MEDIUM;
    if (d >= nearMin) return BANDS.NEAR;
    return BANDS.DETAIL;
  }

  function resolveVisibility({ baseLayers = {}, band, connectionMode } = {}) {
    const zoom = BAND_VISIBILITY[band] || BAND_VISIBILITY[BANDS.MEDIUM];
    const layers = { ...baseLayers };
    layers.exactDays = !!baseLayers.exactDays && zoom.exactDays;
    layers.weekGates = !!baseLayers.weekGates && zoom.weekGates;
    layers.outsideDays = !!baseLayers.outsideDays && zoom.outsideDays;
    layers.recurrence = !!baseLayers.recurrence && zoom.recurrence;
    return {
      band,
      visibility: layers,
      moonLabelMode: zoom.moonLabelMode,
      dayLabelMode: zoom.dayLabelMode,
      connectionMode: connectionMode === "off" ? "off" : zoom.connectionMode,
      maxConnections: zoom.maxConnections,
      dayNodeOpacity: zoom.dayNodeOpacity,
    };
  }

  globalThis.LivingTimeSphereSemanticZoom = Object.freeze({
    BANDS,
    BAND_ORDER,
    BASE_THRESHOLDS,
    BAND_VISIBILITY,
    resolveBand,
    resolveVisibility,
  });
})();
