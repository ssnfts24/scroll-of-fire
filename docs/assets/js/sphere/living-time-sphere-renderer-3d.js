(() => {
  "use strict";

  // Living Time Sphere — 3D WebGL renderer (Three.js).
  // Dependency: Three.js r167  (loaded lazily; UMD build from CDN)
  // License:    MIT  https://github.com/mrdoob/three.js/blob/dev/LICENSE
  // Attribution: three.js by mrdoob and contributors — https://threejs.org
  //
  // ARCHITECTURE
  //   - Reads coordinates exclusively from LivingTimeSphereModel (no recalculation).
  //   - Uses LivingTimeSphereCamera for orbit / zoom / mode-specific views.
  //   - Uses LivingTimeSphereAnimation for the dirty-render loop.
  //   - Uses LivingTimeSphereEffects for star field, haze, glow, etc.
  //   - Uses LivingTimeSphereM for color/size constants.
  //   - Falls back to SVG if WebGL is unavailable or if quality = svgonly.
  //
  // FRAME LOOP DISCIPLINE
  //   Renders only when:
  //     - the user is dragging / zooming;
  //     - a transition is active;
  //     - a state-driven animation is active;
  //     - the scene data changes;
  //     - resize occurs.
  //   Idle drift is capped and stopped when:
  //     - document.hidden;
  //     - prefers-reduced-motion;
  //     - low-power mode;
  //     - the canvas leaves the viewport.
  //
  // THREE.JS DEPENDENCY
  //   Version pinned: 0.167.1 (r167)
  //   CDN: https://cdn.jsdelivr.net/npm/three@0.167.1/build/three.min.js
  //   SRI: verify with: `cat three.min.js | openssl dgst -sha384 -binary | base64`
  //   Transfer size: ~577 KB minified (~170 KB gzipped over HTTPS).
  //   Loaded only on this page; only after DOMContentLoaded.

  const THREE_VERSION = "0.167.1";
  const THREE_CDN     = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.min.js`;

  // ── Dependencies check ────────────────────────────────────────────

  function assertDeps() {
    const needed = ["LivingTimeSphereM", "LivingTimeSphereCamera",
                    "LivingTimeSphereAnimation", "LivingTimeSphereEffects",
                    "LivingTimeSphereModel", "LivingTimeSphereLayout"];
    for (const n of needed) {
      if (!globalThis[n]) throw new Error(`LivingTimeSphereRenderer3d: ${n} unavailable`);
    }
  }

  // ── Scene state ───────────────────────────────────────────────────

  let _THREE        = null;   // Three.js namespace (set after lazy load)
  let _renderer     = null;   // WebGLRenderer
  let _scene        = null;
  let _camera       = null;
  let _canvas       = null;
  let _container    = null;
  let _initialized  = false;
  let _initializing = false;  // Guard against concurrent init calls
  let _quality      = null;   // current resolved preset object
  let _model        = null;   // current year model
  let _spiral       = null;   // 13-year spiral model
  let _selectedYear = null;
  let _viewMode     = "today";
  let _visibleLayers = {};
  let _lastInitError = null;  // last failure reason for diagnostics

  // Scene object refs
  const _objects = {};

  // ── Three.js lazy loader ──────────────────────────────────────────

  let _loadPromise = null;

  function loadThreeJs() {
    if (_THREE) return Promise.resolve(_THREE);
    if (_loadPromise) return _loadPromise;
    _loadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src           = THREE_CDN;
      script.crossOrigin   = "anonymous";
      script.async         = true;
      script.onload = () => {
        if (!globalThis.THREE) {
          _loadPromise = null; // allow retry
          reject(new Error("Three.js did not expose globalThis.THREE"));
          return;
        }
        _THREE = globalThis.THREE;
        resolve(_THREE);
      };
      script.onerror = () => {
        _loadPromise = null; // allow retry after failure
        reject(new Error(`Failed to load Three.js from CDN: ${THREE_CDN}`));
      };
      document.head.appendChild(script);
    });
    return _loadPromise;
  }

  // ── Coordinate helpers ────────────────────────────────────────────

  // Convert angle (degrees, CW from top) + radius to XZ plane position (y=0).
  function angleToXZ(angleDeg, radius) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: radius * Math.cos(rad), z: radius * Math.sin(rad) };
  }

  // ── Scene construction ────────────────────────────────────────────

  function buildScene() {
    const THREE = _THREE;
    const mat   = globalThis.LivingTimeSphereM;
    _scene = new THREE.Scene();
    _scene.background = new THREE.Color(mat.COLORS.bg);

    // ── Center core ─────────────────────────────────────────────────
    {
      const geo = new THREE.SphereGeometry(mat.SIZES.coreRadius, 16, 16);
      const m   = new THREE.MeshStandardMaterial({
        color:     mat.COLORS.center,
        emissive:  mat.COLORS.centerGlow,
        emissiveIntensity: mat.EMISSIVE.center,
        roughness: 0.4,
        metalness: 0.1,
        transparent: true,
        opacity:   mat.OPACITY.center,
      });
      const mesh = new THREE.Mesh(geo, m);
      mesh.name = "core";
      _scene.add(mesh);
      _objects.core = mesh;

      // Core glow
      const glowMesh = globalThis.LivingTimeSphereEffects.buildCoreGlow(THREE);
      _scene.add(glowMesh);
      _objects.coreGlow = glowMesh;
    }

    // ── Pattern ring (XZ plane, radius = SIZES.patternRing) ─────────
    {
      const r   = mat.SIZES.patternRing;
      const geo = new THREE.TorusGeometry(r, mat.SIZES.ringTube, 8, 256);
      const m   = new THREE.MeshStandardMaterial({
        color:       mat.COLORS.patternRing,
        transparent: true,
        opacity:     mat.OPACITY.patternRing,
        roughness:   0.8,
      });
      const mesh = new THREE.Mesh(geo, m);
      mesh.rotation.x = Math.PI / 2;  // lay flat in XZ plane
      mesh.name = "patternRing";
      _scene.add(mesh);
      _objects.patternRing = mesh;
    }

    // ── Moon sector dividers (13 lines from center to ring) ─────────
    {
      const r  = mat.SIZES.moonSectors;
      const pts = [];
      for (let i = 0; i < 13; i++) {
        const angle = (i / 13) * 360;
        const { x, z } = angleToXZ(angle, r);
        pts.push(new _THREE.Vector3(0, 0, 0));
        pts.push(new _THREE.Vector3(x, 0, z));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const m   = new THREE.LineBasicMaterial({
        color:       mat.COLORS.moonStroke,
        transparent: true,
        opacity:     mat.OPACITY.moonStroke,
        depthWrite:  false,
      });
      const lines = new THREE.LineSegments(geo, m);
      lines.name = "moonDividers";
      _scene.add(lines);
      _objects.moonDividers = lines;
    }

    // ── Day nodes on pattern ring (364 small points) ─────────────────
    {
      const r = mat.SIZES.patternRing;
      const positions = new Float32Array(364 * 3);
      for (let d = 0; d < 364; d++) {
        const angle = (d / 364) * 360;
        const { x, z } = angleToXZ(angle, r);
        positions[d * 3]     = x;
        positions[d * 3 + 1] = 0.001;  // slight Y offset so nodes sit on ring
        positions[d * 3 + 2] = z;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const m = new THREE.PointsMaterial({
        color:       mat.COLORS.patternRing,
        size:        0.012,
        transparent: true,
        opacity:     0.45,
        sizeAttenuation: true,
      });
      const pts = new THREE.Points(geo, m);
      pts.name = "dayNodes";
      _scene.add(pts);
      _objects.dayNodes = pts;
    }

    // ── Equinox Gate marker ─────────────────────────────────────────
    {
      const geo = new THREE.SphereGeometry(mat.SIZES.markerDot, 8, 8);
      const m   = new THREE.MeshStandardMaterial({
        color:    mat.COLORS.equinox,
        emissive: mat.COLORS.equinox,
        emissiveIntensity: mat.EMISSIVE.equinox,
        roughness: 0.3,
      });
      const mesh = new THREE.Mesh(geo, m);
      mesh.name = "equinoxGate";
      _scene.add(mesh);
      _objects.equinoxGate = mesh;
    }

    // ── Year Gate marker (Moon 1 Day 1 at 0°) ───────────────────────
    {
      const geo = new THREE.SphereGeometry(mat.SIZES.markerDot, 8, 8);
      const m   = new THREE.MeshStandardMaterial({
        color:    mat.COLORS.yearGate,
        emissive: mat.COLORS.yearGate,
        emissiveIntensity: mat.EMISSIVE.yearGate,
        roughness: 0.3,
      });
      const mesh = new THREE.Mesh(geo, m);
      mesh.name = "yearGate";
      const { x, z } = angleToXZ(0, mat.SIZES.patternRing);
      mesh.position.set(x, 0, z);
      _scene.add(mesh);
      _objects.yearGate = mesh;
    }

    // ── Passage arc (tube geometry, rebuilt on model change) ─────────
    // Initialized as empty; rebuilt in updateScene()
    _objects.passageArc   = null;
    _objects.passageGroup = new THREE.Group();
    _objects.passageGroup.name = "passageGroup";
    _scene.add(_objects.passageGroup);

    // ── Week Gate markers (4 per moon × 13 = 52) ─────────────────────
    {
      const r = mat.SIZES.patternRing;
      const pts = [];
      for (let m = 0; m < 13; m++) {
        for (let w = 1; w <= 4; w++) {
          const dayOfYear = m * 28 + w * 7;
          const angle = (dayOfYear / 364) * 360;
          const { x, z } = angleToXZ(angle, r * 1.04);  // slightly outside ring
          pts.push(new _THREE.Vector3(x, 0, z));
        }
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const m   = new THREE.PointsMaterial({
        color:       mat.COLORS.weekGate,
        size:        0.018,
        transparent: true,
        opacity:     0.5,
      });
      const wgPts = new THREE.Points(geo, m);
      wgPts.name = "weekGates";
      _scene.add(wgPts);
      _objects.weekGates = wgPts;
    }

    // ── Day Out of Time marker (position 365 equivalent) ─────────────
    {
      const angle = (364.5 / 364) * 360;  // just past Moon 13 Day 28
      const { x, z } = angleToXZ(angle, mat.SIZES.patternRing);
      const geo = new THREE.SphereGeometry(0.018, 8, 8);
      const m   = new THREE.MeshBasicMaterial({ color: 0xffd080, transparent: true, opacity: 0.6 });
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, 0, z);
      mesh.name = "dayOutOfTime";
      mesh.visible = false;  // shown only when relevant
      _scene.add(mesh);
      _objects.dayOutOfTime = mesh;
    }

    // ── Lunar orbit (tilted ring) ────────────────────────────────────
    {
      const r   = mat.SIZES.lunarOrbit;
      const geo = new THREE.TorusGeometry(r, mat.SIZES.ringTube * 0.6, 6, 128);
      const m   = new THREE.MeshBasicMaterial({
        color:       mat.COLORS.lunarRing,
        transparent: true,
        opacity:     mat.OPACITY.lunarRing,
        depthWrite:  false,
      });
      const mesh = new THREE.Mesh(geo, m);
      mesh.rotation.x = Math.PI / 2 + 0.09;  // slight tilt ~5°
      mesh.rotation.z = 0.05;
      mesh.name = "lunarOrbit";
      _scene.add(mesh);
      _objects.lunarOrbit = mesh;
    }

    // ── Lunar marker ─────────────────────────────────────────────────
    {
      const geo = new THREE.SphereGeometry(mat.SIZES.lunarMarker, 12, 12);
      const m   = new THREE.MeshStandardMaterial({
        color:    mat.COLORS.lunar,
        emissive: mat.COLORS.lunar,
        emissiveIntensity: mat.EMISSIVE.lunar,
        roughness: 0.6,
      });
      const mesh = new THREE.Mesh(geo, m);
      mesh.name = "lunarMarker";
      _scene.add(mesh);
      _objects.lunarMarker = mesh;
    }

    // ── Solar axis ───────────────────────────────────────────────────
    {
      const r  = mat.SIZES.solarAxis;
      // Axis line (tilted ~23.5° in XY plane)
      const tilt = 23.5 * Math.PI / 180;
      const pts  = [
        new _THREE.Vector3( r * Math.sin(tilt),  r * Math.cos(tilt), 0),
        new _THREE.Vector3(-r * Math.sin(tilt), -r * Math.cos(tilt), 0),
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const m   = new THREE.LineDashedMaterial({
        color:       mat.COLORS.solar,
        transparent: true,
        opacity:     mat.OPACITY.solar,
        dashSize:    0.05,
        gapSize:     0.03,
        depthWrite:  false,
      });
      const line = new THREE.Line(geo, m);
      line.computeLineDistances();
      line.name = "solarAxis";
      _scene.add(line);
      _objects.solarAxis = line;

      // Conceptual season markers (small points)
      const seasonAngles = [0, 90, 180, 270];   // March Eq, Jun Sol, Sep Eq, Dec Sol
      const labels = ["ME", "JS", "SE", "DS"];
      const sPoints = [];
      for (const a of seasonAngles) {
        const rad = (a * Math.PI) / 180;
        sPoints.push(new _THREE.Vector3(
          r * Math.sin(tilt) * Math.cos(rad) - r * Math.cos(tilt) * Math.sin(rad) * 0,
          r * Math.cos(tilt) * Math.cos(rad),
          r * Math.sin(rad)
        ));
      }
      const sGeo = new THREE.BufferGeometry().setFromPoints(sPoints);
      const sMat = new THREE.PointsMaterial({ color: mat.COLORS.solar, size: 0.035, transparent: true, opacity: 0.55 });
      const seasonPts = new THREE.Points(sGeo, sMat);
      seasonPts.name = "seasonMarkers";
      _scene.add(seasonPts);
      _objects.seasonMarkers = seasonPts;
    }

    // ── 13-year spiral annual markers ────────────────────────────────
    {
      const group = new THREE.Group();
      group.name = "spiralGroup";
      _objects.spiralGroup  = group;
      _objects.spiralMarkers = [];
      // Markers are created in updateScene() once spiral data is available
      _scene.add(group);
    }

    // ── Spiral path (line through annual markers) ─────────────────────
    _objects.spiralPath = null;  // created in updateScene()

    // ── Recurrence links (disabled on mobile, off by default) ────────
    _objects.recurrenceGroup = new THREE.Group();
    _objects.recurrenceGroup.name = "recurrenceGroup";
    _objects.recurrenceGroup.visible = false;
    _scene.add(_objects.recurrenceGroup);

    // ── Witness constellation (disabled stub) ─────────────────────────
    {
      const wField = globalThis.LivingTimeSphereEffects.buildWitnessField(THREE);
      _scene.add(wField);
      _objects.witnessField = wField;
    }

    // ── Selection ring ───────────────────────────────────────────────
    {
      const ring = globalThis.LivingTimeSphereEffects.buildSelectionRing(THREE);
      _scene.add(ring);
      _objects.selectionRing = ring;
    }

    // ── Atmospheric effects ──────────────────────────────────────────
    {
      const haze  = globalThis.LivingTimeSphereEffects.buildHazeShell(THREE);
      _scene.add(haze);
      _objects.hazeShell = haze;

      const stars = globalThis.LivingTimeSphereEffects.buildStarField(THREE, _quality?.starCount || 150);
      _scene.add(stars);
      _objects.starField = stars;
    }

    // ── Lighting ─────────────────────────────────────────────────────
    {
      const ambient = new THREE.AmbientLight(0x1a2030, 1.5);
      _scene.add(ambient);
      _objects.ambientLight = ambient;

      const point = new THREE.PointLight(0xffd080, 1.2, 8, 2);
      point.position.set(0.5, 1.5, 0.5);
      _scene.add(point);
      _objects.pointLight = point;
    }
  }

  // ── Update scene from model data ──────────────────────────────────

  function buildPassageTube(startAngle, endAngle) {
    if (!_THREE) return null;
    const THREE = _THREE;
    const mat   = globalThis.LivingTimeSphereM;
    const r     = mat.SIZES.passageArc;

    let sweep = endAngle - startAngle;
    if (sweep <= 0) sweep += 360;
    if (sweep > 360) sweep = 360;

    const steps = Math.max(Math.round(sweep * 1.5), 12);
    const pts   = [];
    for (let i = 0; i <= steps; i++) {
      const angle = startAngle + (i / steps) * sweep;
      const { x, z } = angleToXZ(angle, r);
      pts.push(new THREE.Vector3(x, 0, z));
    }

    // Close gap cleanly
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    const geo   = new THREE.TubeGeometry(curve, steps * 2, mat.SIZES.tubeRadius * 1.5, 6, false);
    const m     = new THREE.MeshStandardMaterial({
      color:     mat.COLORS.passage,
      emissive:  mat.COLORS.passageGlow,
      emissiveIntensity: mat.EMISSIVE.passage,
      transparent: true,
      opacity:   mat.OPACITY.passage,
      roughness: 0.5,
    });
    return new THREE.Mesh(geo, m);
  }

  function buildSpiralPath(spiralYears) {
    if (!_THREE || !spiralYears?.length) return null;
    const THREE = _THREE;
    const mat   = globalThis.LivingTimeSphereM;

    const pts = spiralYears.map(y => {
      const r = mat.SIZES.spiralInner + (mat.SIZES.spiralOuter - mat.SIZES.spiralInner) * y.yearSpiralRadius;
      const { x, z } = angleToXZ(y.yearSpiralAngle % 360, r);
      // Lift each year slightly in Y to create a true 3D spiral
      const yOff = (y.yearSpiralRadius - 0.5) * 0.25;
      return new THREE.Vector3(x, yOff, z);
    });
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const m   = new THREE.LineBasicMaterial({
      color:       mat.COLORS.spiral,
      transparent: true,
      opacity:     mat.OPACITY.spiral,
      depthWrite:  false,
    });
    return new THREE.Line(geo, m);
  }

  function updateScene(model, spiral, selectedYear, visibleLayers, viewMode) {
    if (!_THREE || !_scene || !model) return;
    const mat = globalThis.LivingTimeSphereM;

    _model        = model;
    _spiral       = spiral;
    _selectedYear = selectedYear;
    _visibleLayers = visibleLayers || {};
    _viewMode     = viewMode || "today";

    // ── Layer visibility ────────────────────────────────────────────
    const vl = _visibleLayers;

    if (_objects.patternRing)  _objects.patternRing.visible  = !!vl.pattern;
    if (_objects.moonDividers) _objects.moonDividers.visible = !!vl.pattern;
    if (_objects.dayNodes)     _objects.dayNodes.visible     = !!vl.pattern;
    if (_objects.weekGates)    _objects.weekGates.visible    = !!vl.pattern;
    if (_objects.yearGate)     _objects.yearGate.visible     = !!vl.pattern;
    if (_objects.lunarOrbit)   _objects.lunarOrbit.visible   = !!vl.lunar;
    if (_objects.lunarMarker)  _objects.lunarMarker.visible  = !!vl.lunar;
    if (_objects.solarAxis)    _objects.solarAxis.visible    = !!vl.solar;
    if (_objects.seasonMarkers)_objects.seasonMarkers.visible = !!vl.solar;
    if (_objects.spiralGroup)  _objects.spiralGroup.visible  = !!(vl.spiral || vl.markers);
    if (_objects.passageGroup) _objects.passageGroup.visible = !!vl.passage;
    if (_objects.equinoxGate)  _objects.equinoxGate.visible  = !!vl.passage || !!vl.markers;

    // ── Equinox gate position ───────────────────────────────────────
    if (_objects.equinoxGate && model.passageStartAngle != null) {
      const { x, z } = angleToXZ(model.passageStartAngle, mat.SIZES.patternRing);
      _objects.equinoxGate.position.set(x, 0, z);
    }

    // ── Passage arc ─────────────────────────────────────────────────
    if (_objects.passageGroup) {
      // Remove old passage arc
      while (_objects.passageGroup.children.length) {
        _objects.passageGroup.remove(_objects.passageGroup.children[0]);
      }
      if (vl.passage && model.passage) {
        const tube = buildPassageTube(model.passage.startAngle, model.passage.endAngle);
        if (tube) {
          tube.name = "passageArc";
          _objects.passageGroup.add(tube);
          _objects.passageArc = tube;
        }
      }
    }

    // ── Lunar marker ────────────────────────────────────────────────
    if (_objects.lunarMarker && model.lunarAngle != null) {
      const r = mat.SIZES.lunarOrbit;
      // Slight tilt to match the orbit ring (same tilt as lunarOrbit mesh)
      const tiltAngle = 0.09;
      const { x, z } = angleToXZ(model.lunarAngle, r);
      const yOff = z * Math.sin(tiltAngle);
      _objects.lunarMarker.position.set(x, yOff, z * Math.cos(tiltAngle));
    }

    // ── 13-year spiral markers ──────────────────────────────────────
    if (_objects.spiralGroup && spiral?.years) {
      // Clear existing markers
      while (_objects.spiralGroup.children.length) {
        _objects.spiralGroup.remove(_objects.spiralGroup.children[0]);
      }
      _objects.spiralMarkers = [];

      for (const y of spiral.years) {
        const isSelected = y.year === selectedYear;
        const r  = mat.SIZES.spiralInner + (mat.SIZES.spiralOuter - mat.SIZES.spiralInner) * y.yearSpiralRadius;
        const { x, z } = angleToXZ(y.yearSpiralAngle % 360, r);
        const yOff = (y.yearSpiralRadius - 0.5) * 0.25;

        const geo = new _THREE.SphereGeometry(
          isSelected ? mat.SIZES.markerDotSelected : mat.SIZES.markerDot, 8, 8);
        const m   = new _THREE.MeshStandardMaterial({
          color:    isSelected ? mat.COLORS.annualSelected : mat.COLORS.annual,
          emissive: isSelected ? mat.COLORS.annualSelected : 0x000000,
          emissiveIntensity: isSelected ? mat.EMISSIVE.annualSelected : 0,
          roughness: 0.5,
        });
        const mesh = new _THREE.Mesh(geo, m);
        mesh.position.set(x, yOff, z);
        mesh.name = `year-${y.year}`;
        mesh.userData.year = y.year;
        _objects.spiralGroup.add(mesh);
        _objects.spiralMarkers.push(mesh);

        // Move selection ring to selected marker
        if (isSelected && _objects.selectionRing) {
          _objects.selectionRing.position.set(x, yOff, z);
          _objects.selectionRing.visible = true;
          _objects.selectionRing.rotation.x = Math.PI / 2;
        }
      }

      // Rebuild spiral path
      if (_objects.spiralPath) {
        _objects.spiralGroup.remove(_objects.spiralPath);
      }
      if (vl.spiral) {
        _objects.spiralPath = buildSpiralPath(spiral.years);
        if (_objects.spiralPath) _objects.spiralGroup.add(_objects.spiralPath);
      }
    }

    // ── Recurrence links ────────────────────────────────────────────
    if (_objects.recurrenceGroup) {
      _objects.recurrenceGroup.visible = !!(vl.recurrence && !_isMobileWidth());
      if (vl.recurrence && !_isMobileWidth()) {
        _buildRecurrenceLinks(spiral);
      }
    }

    // ── Mode-specific layer tweaks ──────────────────────────────────
    if (_viewMode === "pattern") {
      // Quiet moving layers in pattern mode
      if (_objects.lunarMarker) _objects.lunarMarker.visible = false;
      if (_objects.solarAxis)   _objects.solarAxis.visible   = false;
    }

    globalThis.LivingTimeSphereAnimation.markDirty();
  }

  function _isMobileWidth() {
    return typeof window !== "undefined" && window.innerWidth < 480;
  }

  function _buildRecurrenceLinks(spiral) {
    if (!spiral?.years || !_objects.recurrenceGroup) return;
    const THREE = _THREE;
    const mat   = globalThis.LivingTimeSphereM;

    // Clear old links
    while (_objects.recurrenceGroup.children.length) {
      _objects.recurrenceGroup.remove(_objects.recurrenceGroup.children[0]);
    }

    // Inspect recurrence values from source records
    for (let i = 0; i < spiral.years.length; i++) {
      for (let j = i + 1; j < spiral.years.length; j++) {
        const a = spiral.years[i];
        const b = spiral.years[j];
        // Only link if passage duration is within 3 hours
        const diff = Math.abs(a.passageDurationDays - b.passageDurationDays);
        if (diff > 0.125) continue;

        const rA  = mat.SIZES.spiralInner + (mat.SIZES.spiralOuter - mat.SIZES.spiralInner) * a.yearSpiralRadius;
        const rB  = mat.SIZES.spiralInner + (mat.SIZES.spiralOuter - mat.SIZES.spiralInner) * b.yearSpiralRadius;
        const pA  = angleToXZ(a.yearSpiralAngle % 360, rA);
        const pB  = angleToXZ(b.yearSpiralAngle % 360, rB);
        const yA  = (a.yearSpiralRadius - 0.5) * 0.25;
        const yB  = (b.yearSpiralRadius - 0.5) * 0.25;

        const pts = [new THREE.Vector3(pA.x, yA, pA.z), new THREE.Vector3(pB.x, yB, pB.z)];
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const strength = Math.max(0.1, 1 - diff / 0.125);
        const m   = new THREE.LineBasicMaterial({
          color:       mat.COLORS.recurrence,
          transparent: true,
          opacity:     mat.OPACITY.recurrence * strength,
          depthWrite:  false,
        });
        _objects.recurrenceGroup.add(new THREE.Line(geo, m));
      }
    }
  }

  // ── Frame render ──────────────────────────────────────────────────

  function render(nowMs) {
    if (!_renderer || !_scene || !_camera) return;

    const breathVal = globalThis.LivingTimeSphereAnimation.breathValue();
    const flowVal   = globalThis.LivingTimeSphereAnimation.flowValue();

    // Breathing core
    if (_objects.coreGlow && _quality?.breathing) {
      globalThis.LivingTimeSphereEffects.updateCoreGlow(_objects.coreGlow, breathVal);
    }

    // Passage flow: subtle emissive pulse on the arc
    if (_objects.passageArc && _objects.passageArc.material && _quality?.passageFlow) {
      const mat = globalThis.LivingTimeSphereM;
      _objects.passageArc.material.emissiveIntensity = mat.EMISSIVE.passage + flowVal * 0.3;
    }

    // Selection ring gentle scale pulse
    if (_objects.selectionRing?.visible) {
      _objects.selectionRing.scale.setScalar(1.0 + breathVal * 0.08);
    }

    _renderer.render(_scene, _camera);
  }

  // ── Init / teardown ────────────────────────────────────────────────

  async function init({ container, model, spiral, quality, selectedYear, visibleLayers, viewMode, reducedMotion, onYearSelect, onMarkerSelect }) {
    // Guard against concurrent or duplicate init calls.
    if (_initializing || _initialized) {
      return { success: false, reason: "already-running" };
    }
    _initializing = true;

    try {
      assertDeps();

      if (!globalThis.LivingTimeSphereEffects.detectWebGl()) {
        _lastInitError = { reason: "webgl-unavailable", detail: "WebGL context creation failed in this environment." };
        return { success: false, reason: "webgl-unavailable", detail: _lastInitError.detail };
      }
      if (!quality) {
        _lastInitError = { reason: "quality-svgonly", detail: "Quality preset resolved to SVG-only." };
        return { success: false, reason: "quality-svgonly" };
      }

      try {
        await loadThreeJs();
      } catch (err) {
        _lastInitError = { reason: "three-load-failed", detail: String(err) };
        return { success: false, reason: "three-load-failed", detail: String(err) };
      }

      const THREE = _THREE;
      _container = container;

      // ── Canvas ────────────────────────────────────────────────────
      _canvas = document.createElement("canvas");
      _canvas.className = "living-time-sphere-3d-canvas";
      _canvas.setAttribute("role", "img");
      _canvas.setAttribute("aria-label", "Living Time Sphere 3D view");
      _canvas.setAttribute("aria-describedby", "sphere-text-model");
      // touch-action: pan-y by default — vertical page scroll preserved.
      _canvas.style.touchAction = "pan-y";
      container.appendChild(_canvas);

      // ── Renderer ──────────────────────────────────────────────────
      const pixelRatio = Math.min(
        quality.pixelRatioMax || 2,
        typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1
      );
      try {
        _renderer = new THREE.WebGLRenderer({
          canvas:    _canvas,
          antialias: quality.antialias !== false,
          alpha:     false,
          powerPreference: quality === globalThis.LivingTimeSphereM?.QUALITY_PRESETS?.lowpower ? "low-power" : "default",
        });
      } catch (err) {
        // WebGLRenderer constructor can throw if context creation fails.
        _lastInitError = { reason: "webgl-context-failed", detail: String(err) };
        return { success: false, reason: "webgl-context-failed", detail: String(err) };
      }
      _renderer.setPixelRatio(pixelRatio);
      _quality = quality;

      // ── Camera ────────────────────────────────────────────────────
      // Wait one rAF to ensure the container has stable layout dimensions.
      await new Promise(resolve => requestAnimationFrame(resolve));
      const rect = container.getBoundingClientRect();
      const w    = Math.max(rect.width  || 320, 100);
      const h    = Math.max(rect.height || 320, 100);
      _renderer.setSize(w, h);

      _camera = globalThis.LivingTimeSphereCamera.create(THREE, w, h);
      globalThis.LivingTimeSphereCamera.setMode(viewMode || "today", performance.now(), false);

      // ── Build scene ───────────────────────────────────────────────
      buildScene();

      // ── Load initial data ─────────────────────────────────────────
      updateScene(model, spiral, selectedYear, visibleLayers, viewMode);

      // ── Animation ─────────────────────────────────────────────────
      globalThis.LivingTimeSphereAnimation.applyPreset(quality);
      globalThis.LivingTimeSphereAnimation.setReducedMotion(reducedMotion || _prefersReducedMotion());
      globalThis.LivingTimeSphereAnimation.attachPageVisibility();
      globalThis.LivingTimeSphereAnimation.attachIntersection(_canvas);

      // Start idle drift if quality allows
      if (quality.idleDrift && !_prefersReducedMotion()) {
        globalThis.LivingTimeSphereCamera.startDrift(performance.now());
      }

      globalThis.LivingTimeSphereAnimation.start(render);
      globalThis.LivingTimeSphereAnimation.markDirty();

      // ── Pointer interaction ────────────────────────────────────────
      _wirePointerEvents(container, onYearSelect, onMarkerSelect);

      // ── Resize ────────────────────────────────────────────────────
      _wireResize(container);

      _initialized = true;
      _lastInitError = null;
      return { success: true };

    } catch (err) {
      // Unexpected error: clean up any partially-created canvas so it does
      // not appear as a broken/blank element in the DOM.
      if (_canvas && _canvas.parentNode) {
        _canvas.parentNode.removeChild(_canvas);
      }
      _canvas    = null;
      _renderer  = null;
      _scene     = null;
      _camera    = null;
      _initialized = false;
      _lastInitError = { reason: "init-exception", detail: String(err) };
      return { success: false, reason: "init-exception", detail: String(err) };
    } finally {
      _initializing = false;
    }
  }

  function _prefersReducedMotion() {
    try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
  }

  function _wirePointerEvents(container, onYearSelect, onMarkerSelect) {
    let pinchActive   = false;
    let pinchDist0    = 0;
    let pointerCache  = new Map();
    let interactMode  = false;    // on small screens, require explicit engage

    function enterInteractMode() {
      interactMode = true;
      if (_canvas) _canvas.style.touchAction = "none";
      container.dispatchEvent(new CustomEvent("sphere:interact-start", { bubbles: true }));
    }
    function exitInteractMode() {
      interactMode = false;
      if (_canvas) _canvas.style.touchAction = "pan-y";
      globalThis.LivingTimeSphereCamera.onPointerUp();
      container.dispatchEvent(new CustomEvent("sphere:interact-end", { bubbles: true }));
    }

    _canvas.addEventListener("pointerdown", e => {
      pointerCache.set(e.pointerId, e);

      if (pointerCache.size === 2) {
        // Pinch start
        const pts = [...pointerCache.values()];
        const d = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
        globalThis.LivingTimeSphereCamera.onPinchStart(d);
        pinchActive = true;
        return;
      }

      // On narrow screens (< 480 px), require deliberate interact mode
      if (window.innerWidth < 480 && !interactMode) return;

      enterInteractMode();
      globalThis.LivingTimeSphereCamera.onPointerDown(e.clientX, e.clientY);
      _canvas.setPointerCapture(e.pointerId);
      globalThis.LivingTimeSphereAnimation.markDirty();
      e.preventDefault();
    });

    _canvas.addEventListener("pointermove", e => {
      pointerCache.set(e.pointerId, e);

      if (pointerCache.size === 2) {
        const pts = [...pointerCache.values()];
        const d = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
        globalThis.LivingTimeSphereCamera.onPinchMove(d);
        globalThis.LivingTimeSphereAnimation.markDirty();
        return;
      }

      if (!interactMode) return;
      const moved = globalThis.LivingTimeSphereCamera.onPointerMove(e.clientX, e.clientY);
      if (moved) {
        globalThis.LivingTimeSphereAnimation.markDirty();
        e.preventDefault();
      }
    }, { passive: false });

    _canvas.addEventListener("pointerup", e => {
      pointerCache.delete(e.pointerId);
      if (pinchActive && pointerCache.size < 2) {
        globalThis.LivingTimeSphereCamera.onPinchEnd();
        pinchActive = false;
      }
      if (pointerCache.size === 0 && interactMode) {
        globalThis.LivingTimeSphereCamera.onPointerUp();
        // On narrow screens, exit interact mode on finger up (re-enables page scroll)
        if (window.innerWidth < 480) exitInteractMode();
      }
      // Restart drift after interaction ends
      if (_quality?.idleDrift && !_prefersReducedMotion()) {
        globalThis.LivingTimeSphereCamera.startDrift(performance.now());
      }
    });

    _canvas.addEventListener("pointercancel", e => {
      pointerCache.delete(e.pointerId);
      globalThis.LivingTimeSphereCamera.onPointerUp();
      if (window.innerWidth < 480) exitInteractMode();
    });

    // Wheel zoom (desktop)
    _canvas.addEventListener("wheel", e => {
      globalThis.LivingTimeSphereCamera.onWheel(e);
      globalThis.LivingTimeSphereAnimation.markDirty();
      e.preventDefault();
    }, { passive: false });

    // Raycasting for marker selection on click
    let _clickStart = { x: 0, y: 0 };
    _canvas.addEventListener("pointerdown", e => {
      if (pointerCache.size === 1) { _clickStart = { x: e.clientX, y: e.clientY }; }
    });
    _canvas.addEventListener("pointerup", e => {
      const dx = Math.abs(e.clientX - _clickStart.x);
      const dy = Math.abs(e.clientY - _clickStart.y);
      if (dx < 6 && dy < 6) _handleClick(e, onYearSelect, onMarkerSelect);
    });
  }

  function _handleClick(e, onYearSelect, onMarkerSelect) {
    if (!_renderer || !_scene || !_camera || !_THREE) return;
    const THREE = _THREE;
    const rect  = _canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width)  * 2 - 1,
      -((e.clientY - rect.top)  / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, _camera);

    // Only test annual markers
    const markers = (_objects.spiralMarkers || []).filter(m => m.visible);
    const hits    = raycaster.intersectObjects(markers);
    if (hits.length > 0) {
      const year = hits[0].object.userData.year;
      if (year && onYearSelect) onYearSelect(year);
      if (year && onMarkerSelect) onMarkerSelect({ type: "year", year });
    }
  }

  function _wireResize(container) {
    if (typeof ResizeObserver === "undefined") return;
    new ResizeObserver(() => {
      if (!_renderer || !_canvas || !_camera) return;
      const rect = container.getBoundingClientRect();
      const w    = Math.max(rect.width  || 320, 100);
      const h    = Math.max(rect.height || 320, 100);
      _renderer.setSize(w, h);
      globalThis.LivingTimeSphereCamera.resize(w, h);
      globalThis.LivingTimeSphereAnimation.markDirty();
    }).observe(container);
  }

  // ── Public API ────────────────────────────────────────────────────

  function refresh(model, spiral, selectedYear, visibleLayers, viewMode) {
    if (!_initialized) return;
    updateScene(model, spiral, selectedYear, visibleLayers, viewMode);
    globalThis.LivingTimeSphereAnimation.markDirty();
  }

  function setQuality(preset) {
    if (!_initialized || !preset) return;
    _quality = preset;
    globalThis.LivingTimeSphereAnimation.applyPreset(preset);
    if (_renderer) _renderer.setPixelRatio(Math.min(preset.pixelRatioMax || 2, devicePixelRatio || 1));
    if (preset.idleDrift && !_prefersReducedMotion()) {
      globalThis.LivingTimeSphereCamera.startDrift(performance.now());
    } else {
      globalThis.LivingTimeSphereCamera.stopDrift();
    }
    if (_objects.starField) _objects.starField.visible = preset.starCount > 0;
    if (_objects.hazeShell) _objects.hazeShell.visible = preset.glow !== false;
    globalThis.LivingTimeSphereAnimation.markDirty();
  }

  function requestSingleRender() {
    globalThis.LivingTimeSphereAnimation.requestRender();
  }

  function resetView() {
    globalThis.LivingTimeSphereCamera.resetView(performance.now());
    globalThis.LivingTimeSphereAnimation.markDirty();
  }

  function setMode(mode) {
    globalThis.LivingTimeSphereCamera.setMode(mode, performance.now(), true);
    globalThis.LivingTimeSphereAnimation.markDirty();
  }

  function teardown() {
    globalThis.LivingTimeSphereAnimation.stop();
    globalThis.LivingTimeSphereAnimation.detachIntersection();
    if (_renderer) { _renderer.dispose(); _renderer = null; }
    if (_canvas && _canvas.parentNode) _canvas.parentNode.removeChild(_canvas);
    _canvas = null;
    _scene  = null;
    _camera = null;
    _initialized  = false;
    _initializing = false;
    _loadPromise  = null; // allow Three.js reload after teardown
    for (const key of Object.keys(_objects)) delete _objects[key];
  }

  function isInitialized() { return _initialized; }
  function isInitializing() { return _initializing; }

  function getLastInitError() { return _lastInitError; }

  function getDiagnostics() {
    let webglAvail = false;
    let webgl2Avail = false;
    try {
      const c = document.createElement("canvas");
      webglAvail  = !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
      webgl2Avail = !!(c.getContext("webgl2"));
    } catch { /* ignore */ }
    const canvasW = _canvas ? (_canvas.width  || 0) : 0;
    const canvasH = _canvas ? (_canvas.height || 0) : 0;
    return {
      requestedRenderer: "3d",
      activeRenderer:    _initialized ? "webgl" : "none",
      initialized:       _initialized,
      initializing:      _initializing,
      webglAvailable:    webglAvail,
      webgl2Available:   webgl2Avail,
      threeVersion:      THREE_VERSION,
      threeLoaded:       !!_THREE,
      canvasWidth:       canvasW,
      canvasHeight:      canvasH,
      devicePixelRatio:  typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1,
      lastInitError:     _lastInitError,
    };
  }

  function exportPng({ format } = {}) {
    if (!_renderer) return null;
    // Force a render first
    render(performance.now());
    return _canvas?.toDataURL("image/png") || null;
  }

  globalThis.LivingTimeSphereRenderer3d = Object.freeze({
    init,
    refresh,
    setQuality,
    requestSingleRender,
    resetView,
    setMode,
    teardown,
    isInitialized,
    isInitializing,
    getLastInitError,
    getDiagnostics,
    exportPng,
    THREE_VERSION,
    THREE_CDN,
  });
})();
