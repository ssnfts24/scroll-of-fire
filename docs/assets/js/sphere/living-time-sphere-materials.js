(() => {
  "use strict";

  // Living Time Sphere — material and color definitions for the 3D scene.
  // All values are pure data: no THREE references here.
  // The renderer imports these and applies them to THREE material instances.

  // ── Color palette ─────────────────────────────────────────────────

  const COLORS = Object.freeze({
    bg:            0x0a0a14,
    patternRing:   0x334466,
    moonFill:      0x1a1f30,
    moonActive:    0x4a3010,
    moonHighlight: 0x6a4820,
    moonStroke:    0x2a3050,
    today:         0xffd700,
    todayGlow:     0xffe060,
    todayHalo:     0xffd700,
    todayLine:     0xffd700,
    equinox:       0xfbbf24,
    yearGate:      0x64ffb4,
    passage:       0xfbbf24,
    passageGlow:   0xffd060,
    lunar:         0xb4b4ff,
    lunarRing:     0x282850,
    solar:         0xffdc50,
    annual:        0x88aacc,
    annualSelected:0xfbbf24,
    spiral:        0x64c8b4,
    center:        0xffffff,
    centerGlow:    0xffe0a0,
    star:          0xffffff,
    recurrence:    0x80c0ff,
    weekGate:      0x6699aa,
    atmosphere:    0x0d1020,
    haze:          0x050818,
  });

  // ── Opacity levels ────────────────────────────────────────────────

  const OPACITY = Object.freeze({
    patternRing:   0.42,
    moonFill:      0.06,
    moonActive:    0.25,
    moonHighlight: 0.38,
    moonStroke:    0.24,
    today:         1.00,
    todayHalo:     1.00,
    todayLine:     0.70,
    passage:       0.95,
    passageGlow:   0.40,
    lunar:         0.85,
    lunarRing:     0.25,
    solar:         0.35,
    annual:        0.60,
    annualSelected:1.00,
    spiral:        0.45,
    center:        0.70,
    centerGlow:    0.25,
    star:          0.55,
    recurrence:    0.40,
    haze:          0.12,
  });

  // ── Emissive intensities ──────────────────────────────────────────

  const EMISSIVE = Object.freeze({
    center:        0.8,
    today:         1.2,
    todayHalo:     0.9,
    equinox:       0.8,
    yearGate:      0.8,
    passage:       0.6,
    annualSelected:0.5,
    lunar:         0.3,
  });

  // ── Size constants (Three.js scene units, sphere radius = 1.0) ────

  const SIZES = Object.freeze({
    sphereRadius:  1.00,   // outer boundary of the whole scene sphere
    annularMarker: 0.95,   // annual-marker orbit radius
    solarAxis:     0.92,
    passageArc:    0.85,
    lunarOrbit:    0.78,
    patternRing:   0.70,
    moonSectors:   0.68,
    spiralOuter:   0.50,
    spiralInner:   0.10,
    coreRadius:    0.06,   // center core sphere
    coreGlowRadius:0.12,
    markerDot:     0.025,
    markerDotSelected: 0.038,
    todayRadius:   0.038,
    todayHalo:     0.068,
    todayHaloTube: 0.005,
    todayLine:     0.003,
    lunarMarker:   0.035,
    starFieldRadius: 5.0,
    tubeRadius:    0.005,  // passage arc tube cross-section
    ringTube:      0.006,  // pattern ring tube
    solarTube:     0.003,
  });

  // ── Bloom / glow parameters ────────────────────────────────────────

  const GLOW = Object.freeze({
    enabled:      true,    // toggled at runtime
    strength:     0.5,
    radius:       0.4,
    threshold:    0.2,
  });

  // ── Star-field seed (deterministic, non-personal) ─────────────────
  // 200 pre-computed unit-sphere offsets using a simple LCG with fixed seed.
  // The renderer scales these by SIZES.starFieldRadius.

  function generateStarPositions(count, seed) {
    const positions = new Float32Array(count * 3);
    let s = seed >>> 0;
    for (let i = 0; i < count; i++) {
      // LCG: next float in [0,1)
      function rng() { s = ((s * 1664525 + 1013904223) >>> 0); return s / 4294967296; }
      const theta = rng() * Math.PI * 2;
      const phi   = Math.acos(2 * rng() - 1);
      positions[i * 3]     = Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = Math.cos(phi);
    }
    return positions;
  }

  const STAR_POSITIONS = generateStarPositions(300, 0xc0debabe);

  // ── Quality presets ───────────────────────────────────────────────

  const QUALITY_PRESETS = Object.freeze({
    auto: Object.freeze({
      antialias:      true,
      pixelRatioMax:  2,
      starCount:      300,
      glow:           true,
      idleDrift:      true,
      breathing:      true,
      passageFlow:    true,
      recurrenceLinks:true,
      shadowMap:      false,
    }),
    high: Object.freeze({
      antialias:      true,
      pixelRatioMax:  2,
      starCount:      300,
      glow:           true,
      idleDrift:      true,
      breathing:      true,
      passageFlow:    true,
      recurrenceLinks:true,
      shadowMap:      false,
    }),
    balanced: Object.freeze({
      antialias:      false,
      pixelRatioMax:  1.5,
      starCount:      150,
      glow:           false,
      idleDrift:      true,
      breathing:      true,
      passageFlow:    true,
      recurrenceLinks:false,
      shadowMap:      false,
    }),
    lowpower: Object.freeze({
      antialias:      false,
      pixelRatioMax:  1,
      starCount:      0,
      glow:           false,
      idleDrift:      false,
      breathing:      false,
      passageFlow:    false,
      recurrenceLinks:false,
      shadowMap:      false,
    }),
    svgonly: null,  // sentinel — renderer should not be initialized
  });

  // Resolve the auto preset based on device capabilities.
  function resolveAutoPreset({ reducedMotion, deviceMemoryGb, screenWidth, webglAvailable } = {}) {
    if (!webglAvailable) return QUALITY_PRESETS.balanced;
    const mem = deviceMemoryGb || 4;
    const w   = screenWidth   || 1024;
    let base;
    if (mem <= 1 || w < 380) base = QUALITY_PRESETS.lowpower;
    else if (mem <= 2 || w < 600) base = QUALITY_PRESETS.balanced;
    else base = QUALITY_PRESETS.high;

    // Under reduced motion: keep quality level but disable all animations
    if (reducedMotion) {
      return Object.freeze(Object.assign({}, base, {
        idleDrift:    false,
        breathing:    false,
        passageFlow:  false,
        glow:         false,
      }));
    }
    return base;
  }

  globalThis.LivingTimeSphereM = Object.freeze({
    COLORS,
    OPACITY,
    EMISSIVE,
    SIZES,
    GLOW,
    STAR_POSITIONS,
    QUALITY_PRESETS,
    resolveAutoPreset,
  });
})();
