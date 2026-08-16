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

  let _webGlSupport = null;
  let _webGl2Support = null;

  function detectWebGl() {
    if (typeof _webGlSupport === "boolean") return _webGlSupport;
    const managedProbe = globalThis.ObservatoryCapabilityManager?.probeWebGl?.();
    if (managedProbe && typeof managedProbe.webgl === "boolean") {
      _webGlSupport = managedProbe.webgl;
      return _webGlSupport;
    }
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (!gl) {
        _webGlSupport = false;
        return _webGlSupport;
      }
      // Basic sanity — check for key extensions used in the renderer
      const ok = typeof gl.drawArrays === "function";
      try { gl.getExtension?.("WEBGL_lose_context")?.loseContext?.(); } catch { /* best-effort probe cleanup */ }
      _webGlSupport = ok;
      return _webGlSupport;
    } catch {
      _webGlSupport = false;
      return _webGlSupport;
    }
  }

  function detectWebGl2() {
    if (typeof _webGl2Support === "boolean") return _webGl2Support;
    const managedProbe = globalThis.ObservatoryCapabilityManager?.probeWebGl?.();
    if (managedProbe && typeof managedProbe.webgl2 === "boolean") {
      _webGl2Support = managedProbe.webgl2;
      return _webGl2Support;
    }
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2");
      _webGl2Support = !!gl && typeof gl.drawArrays === "function";
      try { gl?.getExtension?.("WEBGL_lose_context")?.loseContext?.(); } catch { /* best-effort probe cleanup */ }
      return _webGl2Support;
    } catch {
      _webGl2Support = false;
      return _webGl2Support;
    }
  }

  // ── Star field ────────────────────────────────────────────────────
  // Uses pre-computed positions from LivingTimeSphereM.STAR_POSITIONS

  function buildStarField(THREE, count) {
    if (!globalThis.LivingTimeSphereM) throw new Error("LivingTimeSphereEffects: LivingTimeSphereM unavailable");
    const mat = globalThis.LivingTimeSphereM;
    const starPositions = mat.STAR_POSITIONS;
    const actualCount = Math.max(0, Math.min(count ?? mat.QUALITY_PRESETS.high.starCount, Math.floor(starPositions.length / 3)));

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

  // ── Witness constellation layer (disabled stub) ───────────────────
  // Future: witness records appear as constellation points.
  // During Phase 03, this layer is prepared but never populated.

  const witnessLayer = Object.freeze({
    witnessPoints: [],
    enabled:       false,
    source:        "local-only",
  });

  function buildWitnessField(THREE) {
    // Returns an empty Points object; to be populated by a future local-only feature.
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(0), 3));
    const mat = new THREE.PointsMaterial({ color: 0x80c0ff, size: 0.02, transparent: true, opacity: 0.6 });
    const pts = new THREE.Points(geo, mat);
    pts.name = "witnessField";
    pts.userData.effect = "witness";
    pts.visible = false;   // always off in Phase 03
    return pts;
  }

  // ── Personal Seal marker (disabled stub) ─────────────────────────

  const personalSealStub = Object.freeze({
    personalSealMarker: null,
    enabled:            false,
    privacy:            "local-only",
  });

  // ── Sound layer stub (optional, always off by default) ───────────

  const soundLayer = Object.freeze({
    enabled:       false,
    volume:        0.5,
    muted:         true,
    // Never autoplay; requires explicit user activation.
  });

  // ── Export ───────────────────────────────────────────────────────

  globalThis.LivingTimeSphereEffects = Object.freeze({
    detectWebGl,
    detectWebGl2,
    buildStarField,
    buildHazeShell,
    buildCoreGlow,
    buildSelectionRing,
    applyFog,
    updateCoreGlow,
    witnessLayer,
    buildWitnessField,
    personalSealStub,
    soundLayer,
  });
})();
