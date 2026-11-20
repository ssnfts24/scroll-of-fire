(() => {
  "use strict";

  // Living Time Sphere — material and color definitions for the 3D scene.
  // All values are pure data: no THREE references here.
  // The renderer imports these and applies them to THREE material instances.
  //
  // Sphere page rebuild (Nov 20, 2026 — Aaron lifted the appearance
  // fence: "The sphere needs to actually physically change... make
  // it awesome looking like everything else"): the palette takes
  // the films' language — warm wood, brass, glass, held light —
  // in place of the cold blue steel it opened with. Every change
  // here is a colour or an opacity; no size, geometry, or calendar
  // value moves. The cool notes that stay (lunar light, the spiral's
  // teal) are the house's glyph-light accents, kept on purpose.

  // ── Color palette ─────────────────────────────────────────────────

  const COLORS = Object.freeze({
    bg:            0x0c0805,
    patternRing:   0x8f6b32,
    moonFill:      0x2b1d0f,
    moonActive:    0x4a3010,
    moonHighlight: 0x6a4820,
    moonStroke:    0x74582a,
    today:         0xffd700,
    todayGlow:     0xffe060,
    todayHalo:     0xffd700,
    todayLine:     0xffd700,
    equinox:       0xfbbf24,
    yearGate:      0x64ffb4,
    passage:       0xfbbf24,
    passageGlow:   0xffd060,
    lunar:         0xb4b4ff,
    lunarRing:     0x2e2438,
    solar:         0xffdc50,
    annual:        0xb3a284,
    annualSelected:0xfbbf24,
    spiral:        0x64c8b4,
    center:        0xffffff,
    centerGlow:    0xffe0a0,
    star:          0xffffff,
    recurrence:    0x80c0ff,
    weekGate:      0x6699aa,
    atmosphere:    0x150e07,
    haze:          0x0a0603,
    // Armillary face (Nov 20, 2026 — the Sphere redesign: the
    // instrument takes the cartoon armillary's materials). Brass
    // and wood are the frame's metals and timber; parchment is the
    // centre globe's etched skin; scriptGlow is the lit ink of the
    // day band.
    brass:         0xc9973f,
    brassDark:     0x8a6428,
    wood:          0x9a6a30,
    woodDark:      0x54340f,
    parchment:     0xd9b77c,
    scriptGlow:    0xffca7a,
  });

  // The five elements' colours for the Moon faces, matching the
  // house hues the Spark's moon-temper uses (Fire 14, Water 208,
  // Air 255, Earth 96, Aether 288), stated here as hex so the
  // renderer needs no companion-layer dependency.
  const ELEMENT_COLORS = Object.freeze({
    Fire:   0xe8762c,
    Water:  0x3f8fd2,
    Air:    0x9fb4ff,
    Earth:  0x7fae4c,
    Aether: 0xb07fe8,
  });

  // Armillary dimensions (scene units, sphere radius = 1.0). Every
  // radius is chosen against the calendar's own rails: the wooden
  // band carries the Pattern ring (0.70), the script band stands at
  // the rim inside the outer boundary (1.00), and the armillary
  // cage rings circle just outside it.
  const ARMILLARY = Object.freeze({
    bandInner:      0.615,
    bandOuter:      0.785,
    scriptRadius:   0.99,
    scriptHeight:   0.085,
    cageRadius:     1.07,
    cageTube:       0.008,
    gearRadius:     0.05,
    gearTeeth:      12,
    gearLargeRadius: 0.088,
    gearLargeTeeth: 16,
    gearDepth:      0.012,
    medallionRadius: 0.074,
    medallionRimTube: 0.009,
    globeRadius:    0.08,
    globeHeight:    0.115,
  });

  // ── Opacity levels ────────────────────────────────────────────────

  const OPACITY = Object.freeze({
    patternRing:   0.58,
    moonFill:      0.10,
    moonActive:    0.25,
    moonHighlight: 0.38,
    moonStroke:    0.36,
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
    todayHalo:     0.0513,  // capped at 1.35 × todayRadius — wider reads as a ringed planet
    todayHaloTube: 0.005,
    todayLine:     0.003,
    lunarMarker:   0.035,
    starFieldRadius: 5.0,
    tubeRadius:    0.005,  // passage arc tube cross-section
    ringTube:      0.006,  // pattern ring tube
    solarTube:     0.003,
  });

  // ── Day-marker separation ────────────────────────────────────────
  // Today and the selected day both ride the Pattern ring as a sphere
  // with an equatorial halo. When the two markers coincide, or sit
  // close enough for their halos to overlap, the pair reads as one
  // ringed planet (see the B7.51 note in the renderer). This pure
  // decision is what the renderer applies in updateScene:
  //   "coincide" — same Pattern Day: suppress the selected pair (today wins)
  //   "near"     — ring positions closer than MARKER_HALO_CLEARANCE:
  //                suppress the selected halo only; its sphere stays
  //   "apart"    — render both pairs in full
  const MARKER_HALO_CLEARANCE = 0.15;

  function markerSeparation({ todayDay, todayYear, selectedDay, selectedYear, distance } = {}) {
    const sameDay =
      todayDay != null &&
      selectedDay != null &&
      Number(todayDay) === Number(selectedDay) &&
      (todayYear == null || selectedYear == null || Number(todayYear) === Number(selectedYear));
    if (sameDay) return "coincide";
    if (Number.isFinite(distance) && distance < MARKER_HALO_CLEARANCE) return "near";
    return "apart";
  }

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
    ELEMENT_COLORS,
    ARMILLARY,
    SIZES,
    MARKER_HALO_CLEARANCE,
    markerSeparation,
    GLOW,
    STAR_POSITIONS,
    QUALITY_PRESETS,
    resolveAutoPreset,
  });
})();
