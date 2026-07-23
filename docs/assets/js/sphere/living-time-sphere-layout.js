(() => {
  "use strict";

  // Living Time Sphere Layout — resolves viewport/container dimensions and safe margins.
  // Renderer-neutral: returns numbers only, no DOM operations.

  const MIN_RADIUS  = 80;
  const MAX_RADIUS  = 400;
  const MARGIN_RATIO = 0.05; // 5% padding around the sphere

  function resolveLayout({ containerWidth, containerHeight, devicePixelRatio } = {}) {
    const w   = Math.max(containerWidth  || 320, 100);
    const h   = Math.max(containerHeight || 320, 100);
    const dpr = Math.max(devicePixelRatio || 1, 0.5);

    const shortSide = Math.min(w, h);
    const margin    = Math.round(shortSide * MARGIN_RATIO);
    const rawRadius = (shortSide / 2) - margin;
    const radius    = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, rawRadius));

    const cx = w / 2;
    const cy = h / 2;

    // Ring radii as fractions of the sphere radius.
    const rings = Object.freeze({
      outerBorder:     radius,
      annualMarkers:   Number((radius * 0.95).toFixed(2)),
      solarAxis:       Number((radius * 0.90).toFixed(2)),
      passageArc:      Number((radius * 0.85).toFixed(2)),
      lunarOrbit:      Number((radius * 0.78).toFixed(2)),
      patternRing:     Number((radius * 0.70).toFixed(2)),
      moonSectors:     Number((radius * 0.68).toFixed(2)),
      moonDayPoints:   Number((radius * 0.60).toFixed(2)),
      spiralOuter:     Number((radius * 0.50).toFixed(2)),
      spiralInner:     Number((radius * 0.10).toFixed(2)),
      centerPoint:     6
    });

    return Object.freeze({ w, h, cx, cy, radius, dpr, margin, rings });
  }

  // Convert a polar coordinate (angle in degrees, clockwise from top) to SVG/Canvas x,y.
  function polarToXY({ angle, r, cx, cy }) {
    const radians = ((angle - 90) * Math.PI) / 180; // -90 rotates so 0° is at top
    return {
      x: Number((cx + r * Math.cos(radians)).toFixed(4)),
      y: Number((cy + r * Math.sin(radians)).toFixed(4))
    };
  }

  // Build the arc path description (SVG or Canvas compatible numbers) for a passage arc.
  function buildPassageArc({ startAngle, endAngle, r, cx, cy }) {
    // Handle wrap-around (passage typically crosses 0°).
    let sweep = endAngle - startAngle;
    if (sweep <= 0) sweep += 360;
    if (sweep > 360) sweep = 360;

    const start  = polarToXY({ angle: startAngle, r, cx, cy });
    const end    = polarToXY({ angle: startAngle + sweep, r, cx, cy });
    const large  = sweep > 180 ? 1 : 0;

    return Object.freeze({ startX: start.x, startY: start.y, endX: end.x, endY: end.y, sweepDegrees: sweep, largeArcFlag: large, r });
  }

  globalThis.LivingTimeSphereLayout = Object.freeze({
    resolveLayout,
    polarToXY,
    buildPassageArc,
    MIN_RADIUS,
    MAX_RADIUS
  });
})();
