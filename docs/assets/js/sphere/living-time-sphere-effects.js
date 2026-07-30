(() => {
  "use strict";

  // Living Time Sphere — atmospheric effects layer.
  // Provides Three.js object builders for:
  //   - star / witness field (deterministic positions, no personal data)
  //   - depth haze (fog)
  //   - radial glow shell
  //   - bloom / selection highlight helpers
  //
  // All effects are independently disableable.
  // Future witness constellation layer is prepared (disabled by default).

  // ── WebGL support detection ───────────────────────────────────────

  function detectWebGl() {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (!gl) return false;
      // Basic sanity — check for key extensions used in the renderer
      const ok = typeof gl.drawArrays === "function";
      const ctx = gl;
      if (ctx && typeof ctx.getExtension === "function") {
        // OK if we can at least create the context
      }
      return ok;
    } catch { return false; }
  }

  // ── Star field ────────────────────────────────────────────────────
  // Uses pre-computed positions from LivingTimeSphereM.STAR_POSITIONS

  function buildStarField(THREE, count) {
    if (!globalThis.LivingTimeSphereM) throw new Error("LivingTimeSphereEffects: LivingTimeSphereM unavailable");
    const mat = globalThis.LivingTimeSphereM;
    const starPositions = mat.STAR_POSITIONS;
    const actualCount = Math.min(count || mat.QUALITY_PRESETS.high.starCount, Math.floor(starPositions.length / 3));

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(actualCount * 3);
    const r = mat.SIZES.starFieldRadius;
    for (let i = 0; i < actualCount; i++) {
      positions[i * 3]     = starPositions[i * 3]     * r;
      positions[i * 3 + 1] = starPositions[i * 3 + 1] * r;
      positions[i * 3 + 2] = starPositions[i * 3 + 2] * r;
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color:       mat.COLORS.star,
      size:        0.018,
      transparent: true,
      opacity:     mat.OPACITY.star,
      sizeAttenuation: true,
      depthWrite:  false,
    });

    const stars = new THREE.Points(geometry, material);
    stars.name = "starField";
    stars.userData.effect = "starField";
    return stars;
  }

  // ── Depth haze (radial gradient shell) ───────────────────────────
  // A large, slightly opaque sphere to add depth haze.

  function buildHazeShell(THREE) {
    const mat  = globalThis.LivingTimeSphereM;
    const geo  = new THREE.SphereGeometry(mat.SIZES.sphereRadius * 1.05, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color:       mat.COLORS.haze,
      transparent: true,
      opacity:     mat.OPACITY.haze,
      side:        THREE.BackSide,
      depthWrite:  false,
    });
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = "hazeShell";
    mesh.userData.effect = "haze";
    return mesh;
  }

  // ── Radial glow (center ambient glow) ─────────────────────────────
  // A transparent additive sphere around the core to fake bloom.

  function buildCoreGlow(THREE) {
    const mat  = globalThis.LivingTimeSphereM;
    const geo  = new THREE.SphereGeometry(mat.SIZES.coreGlowRadius, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color:       mat.COLORS.centerGlow,
      transparent: true,
      opacity:     mat.OPACITY.centerGlow,
      blending:    THREE.AdditiveBlending,
      depthWrite:  false,
    });
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = "coreGlow";
    mesh.userData.effect = "coreGlow";
    return mesh;
  }

  // ── Selection highlight ring ──────────────────────────────────────
  // Placed around a selected marker; scaled and repositioned by the renderer.

  function buildSelectionRing(THREE) {
    const geo  = new THREE.TorusGeometry(0.06, 0.004, 8, 32);
    const mat  = new THREE.MeshBasicMaterial({
      color:       0xfbbf24,
      transparent: true,
      opacity:     0.85,
      blending:    THREE.AdditiveBlending,
      depthWrite:  false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = "selectionRing";
    mesh.visible = false;
    return mesh;
  }

  // ── Apply scene fog ───────────────────────────────────────────────

  function applyFog(scene, THREE, enabled) {
    if (!scene) return;
    const mat = globalThis.LivingTimeSphereM;
    scene.fog = enabled
      ? new THREE.FogExp2(mat.COLORS.atmosphere, 0.08)
      : null;
  }

  // ── Update glow brightness for breathing effect ───────────────────

  function updateCoreGlow(mesh, breathValue) {
    if (!mesh || !mesh.material) return;
    const mat = globalThis.LivingTimeSphereM;
    const baseOpacity = mat.OPACITY.centerGlow;
    mesh.material.opacity = baseOpacity + breathValue * 0.15;
    const scale = 1.0 + breathValue * 0.12;
    mesh.scale.setScalar(scale);
  }

  // ── Local witness constellation ──────────────────────────────────
  // Uses only records already stored in this browser. No network request is made,
  // and no witness text is placed into the Three.js scene.

  const WITNESS_STORAGE_KEY = "sof.observatory.records.v1";
  const CLAIM_COLORS = Object.freeze({
    observed: [0.45, 0.86, 1.0], measured: [0.45, 1.0, 0.68], reported: [0.92, 0.82, 0.45],
    inferred: [0.95, 0.62, 0.35], symbolic: [0.78, 0.55, 1.0], experimental: [1.0, 0.45, 0.55],
    theoretical: [0.52, 0.68, 1.0], disputed: [1.0, 0.34, 0.34], corrected: [0.55, 0.95, 0.9],
    unresolved: [0.72, 0.75, 0.82]
  });

  function loadLocalWitnessRecords(limit = 1200) {
    try {
      const parsed = JSON.parse(globalThis.localStorage?.getItem(WITNESS_STORAGE_KEY) || "null");
      return Array.isArray(parsed?.records) ? parsed.records.slice(-Math.max(0, limit)) : [];
    } catch { return []; }
  }

  function witnessPosition(record, index, count) {
    const day = Math.max(1, Math.min(364, Number(record?.pattern?.dayOf364 || record?.pattern?.dayOfPatternYear || 1)));
    const angle = ((day - 0.5) / 364) * Math.PI * 2 - Math.PI / 2;
    const year = Number(record?.pattern?.patternYear || new Date(record?.instant || Date.now()).getUTCFullYear());
    const currentYear = new Date().getUTCFullYear();
    const yearOffset = Math.max(-0.58, Math.min(0.58, (year - currentYear) / 36));
    const sequenceOffset = count > 1 ? ((index / (count - 1)) - 0.5) * 0.12 : 0;
    const radius = 1.34 + Math.max(-0.08, Math.min(0.16, yearOffset * 0.15));
    return [Math.cos(angle) * radius, yearOffset + sequenceOffset, Math.sin(angle) * radius];
  }

  function buildWitnessField(THREE, records = loadLocalWitnessRecords()) {
    const limited = Array.isArray(records) ? records.slice(-1200) : [];
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(limited.length * 3);
    const colors = new Float32Array(limited.length * 3);
    limited.forEach((record, index) => {
      const pos = witnessPosition(record, index, limited.length);
      positions.set(pos, index * 3);
      const color = CLAIM_COLORS[record?.claim?.type] || CLAIM_COLORS.observed;
      colors.set(color, index * 3);
    });
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      size: 0.032, transparent: true, opacity: 0.82, vertexColors: true,
      sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    const points = new THREE.Points(geometry, material);
    points.name = "witnessField";
    points.userData.effect = "witness";
    points.userData.source = "local-only";
    points.userData.recordCount = limited.length;
    points.visible = false;
    return points;
  }

  const witnessLayer = Object.freeze({
    storageKey: WITNESS_STORAGE_KEY,
    source: "local-only",
    maximumRenderedRecords: 1200,
    claimColors: CLAIM_COLORS
  });

  // ── Export ───────────────────────────────────────────────────────

  globalThis.LivingTimeSphereEffects = Object.freeze({
    detectWebGl,
    buildStarField,
    buildHazeShell,
    buildCoreGlow,
    buildSelectionRing,
    applyFog,
    updateCoreGlow,
    witnessLayer,
    buildWitnessField,
  });
})();
