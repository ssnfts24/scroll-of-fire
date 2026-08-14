(() => {
  "use strict";

  const SPHERE_VERSION = "living-time-sphere/1.0.0";
  const DATASET_VERSION = globalThis.SOF_13_MOONS?.APP_VERSION || null;

  function _resolveBuildContext() {
    if (typeof globalThis.__SOF_BUILD_CONTEXT__ === "string" && globalThis.__SOF_BUILD_CONTEXT__.trim()) {
      return globalThis.__SOF_BUILD_CONTEXT__.trim().toLowerCase();
    }
    const hostname = typeof location !== "undefined" ? String(location.hostname || "").toLowerCase() : "";
    if (!hostname) return "unknown";
    if (hostname === "localhost" || hostname === "127.0.0.1") return "development";
    if (hostname.includes("deploy-preview-") && hostname.includes(".netlify.app")) return "preview";
    if (hostname.includes(".netlify.app")) return "netlify";
    return "production";
  }

  const BUILD_METADATA = Object.freeze({
    commitSha: globalThis.__SOF_COMMIT_SHA__ || null,
    buildTimestamp: globalThis.__SOF_BUILD_TIMESTAMP__ || (typeof document !== "undefined" && document ? document.lastModified || null : null),
    rendererVersion: "living-time-sphere-renderer-3d/rc9",
    datasetVersion: DATASET_VERSION,
    buildContext: _resolveBuildContext(),
  });

  // Coordinate conventions:
  //   - All angles are in degrees, measured clockwise from the top (12 o'clock = 0°).
  //   - patternAngle: position on the 364-day ring, 0° = Moon 1 Day 1 (Year Gate).
  //   - lunarAngle: position on the lunar-cycle orbit, 0° = new moon.
  //   - solarSeasonAngle: 0° = March equinox.
  //   - passageStartAngle: equinox marker position on the pattern ring.
  //   - passageEndAngle: year gate position on the pattern ring.
  //   - yearSpiralAngle: position in the 13-year spiral, 0° = start of study window.
  //   - yearSpiralRadius: normalized depth (0 = center, 1 = outer edge).
  //   - layerDepth: 0 = front, higher = further back.

  const COORDINATE_CONVENTIONS = Object.freeze({
    zeroPosition:  "Moon 1, Day 1 (Year Gate) at top (12 o'clock = 0°)",
    direction:     "clockwise",
    angleUnit:     "degrees",
    rangePatternAngle:     [0, 360],
    rangeLunarAngle:       [0, 360],
    rangeSolarSeasonAngle: [0, 360],
    rangePassageAngles:    [0, 360],
    rangeSpiralRadius:     [0, 1],
    rangeLayerDepth:       [0, 10],
    normalizationBase:     "All positions derived from AlignmentLedgerData or EquinoxPassageEngine; no renderer may redefine coordinates."
  });

  globalThis.LivingTimeSphereVersion = Object.freeze({
    version: SPHERE_VERSION,
    coordinateConventions: COORDINATE_CONVENTIONS,
    buildMetadata: BUILD_METADATA,
  });
})();
