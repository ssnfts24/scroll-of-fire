(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.LivingTimeSphereTemporalStrata = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const VERSION = "temporal-strata/2.1.0-reality-corridors";
  const DEFAULT_SPAN = 25;
  const ALLOWED_SPANS = Object.freeze([13, 25, 50, 100, 200]);
  const REFERENCE_RADIUS = 1.24;

  const state = {
    enabled: true,
    span: DEFAULT_SPAN,
    direction: "balanced",
    mode: "onion",
    depth: 0.22,
    evidenceOnly: false,
    chronology: true,
    trajectory: true,
    yearGate: true
  };

  let group = null;
  let shellLines = null;
  let pastShellLines = null;
  let futureShellLines = null;
  let majorShellLines = null;
  let selectedShell = null;
  let chronologyLine = null;
  let yearGateLine = null;
  let markerPoints = null;
  let trajectoryLine = null;
  let selectedDayCorridor = null;
  let moonCorridorBoundaries = null;
  let selectedDayShellPoints = null;
  let lastKey = "";
  let uiBound = false;

  function clampSpan(value) {
    const n = Number(value);
    return ALLOWED_SPANS.reduce(
      (best, item) => Math.abs(item - n) < Math.abs(best - n) ? item : best,
      DEFAULT_SPAN
    );
  }

  function normalizeDirection(value) {
    return value === "future" || value === "balanced" ? value : "history";
  }

  function yearWindow(selectedYear, span = DEFAULT_SPAN, direction = "history") {
    const reference = Math.trunc(Number(selectedYear) || new Date().getFullYear());
    const count = clampSpan(span);
    const mode = normalizeDirection(direction);
    let start;
    let end;

    if (mode === "future") {
      start = reference;
      end = reference + count - 1;
    } else if (mode === "balanced") {
      const before = Math.floor((count - 1) / 2);
      const after = count - 1 - before;
      start = reference - before;
      end = reference + after;
    } else {
      start = reference - count + 1;
      end = reference;
    }

    const years = Array.from({ length: count }, (_, i) => start + i);
    return Object.freeze({
      start,
      end,
      count,
      reference,
      referenceIndex: reference - start,
      direction: mode,
      years: Object.freeze(years)
    });
  }

  function clampDepth(value) {
    return Math.max(0.12, Math.min(0.36, Number(value) || 0.22));
  }

  // Onion rule: the 13-Moon calendar keeps its existing geometry. Time depth lives
  // in a narrow shell band around it. Older years move inward, future years outward.
  function radiusForYear(year, window, depth = state.depth) {
    const d = clampDepth(depth);
    const y = Number(year);
    const ref = window.reference;

    if (y === ref) return REFERENCE_RADIUS;

    const pastCount = Math.max(1, ref - window.start);
    const futureCount = Math.max(1, window.end - ref);

    if (y < ref) {
      const t = (ref - y) / pastCount;
      return REFERENCE_RADIUS - d * t;
    }

    const futureDepth = d * 0.82;
    const t = (y - ref) / futureCount;
    return REFERENCE_RADIUS + futureDepth * t;
  }

  function shellBounds(window, depth = state.depth) {
    const radii = [
      radiusForYear(window.start, window, depth),
      radiusForYear(window.reference, window, depth),
      radiusForYear(window.end, window, depth)
    ];
    return Object.freeze({ inner: Math.min(...radii), outer: Math.max(...radii) });
  }

  // Every year remains represented. LOD changes curve resolution and how many
  // secondary contours a shell receives, not whether the year exists.
  function radialSegments(tier = "high", span = DEFAULT_SPAN) {
    const n = clampSpan(span);
    if (tier === "low") return n >= 100 ? 20 : 28;
    if (tier === "medium") return n >= 100 ? 28 : 40;
    return n >= 100 ? 36 : 52;
  }

  function majorInterval(span = DEFAULT_SPAN, tier = "high") {
    const n = clampSpan(span);
    if (n >= 200) return tier === "low" ? 20 : 10;
    if (n >= 100) return 10;
    if (n >= 50) return 5;
    return tier === "low" ? 5 : 1;
  }

  function isMajorYear(year, window, tier = "high") {
    if (year === window.reference || year === window.start || year === window.end) return true;
    const interval = majorInterval(window.count, tier);
    return Math.abs(year - window.reference) % interval === 0;
  }

  function ringBasis(kind) {
    // Three orthogonal great circles make a shell read as a membrane without
    // drawing an opaque SphereGeometry that can swallow the calendar.
    if (kind === 1) return { a: "x", b: "y", fixed: "z" };
    if (kind === 2) return { a: "y", b: "z", fixed: "x" };
    return { a: "x", b: "z", fixed: "y" };
  }

  function ringSegments(radius, segments, kind = 0, cutaway = false) {
    const basis = ringBasis(kind);
    const positions = [];
    const gapCenter = Math.PI * 0.5;
    const gapHalf = Math.PI * 0.22;

    for (let i = 0; i < segments; i += 1) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      const mid = (a0 + a1) * 0.5;
      const delta = Math.atan2(Math.sin(mid - gapCenter), Math.cos(mid - gapCenter));
      if (cutaway && Math.abs(delta) < gapHalf) continue;

      const point = (angle) => {
        const p = { x: 0, y: 0, z: 0 };
        p[basis.a] = Math.cos(angle) * radius;
        p[basis.b] = Math.sin(angle) * radius;
        p[basis.fixed] = 0;
        return p;
      };
      const p0 = point(a0);
      const p1 = point(a1);
      positions.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
    }
    return positions;
  }

  function chronologyTurns(span = DEFAULT_SPAN) {
    return Math.max(1.15, Math.min(5.25, clampSpan(span) / 38));
  }

  function chronologyPoint(index, window, depth = state.depth) {
    const count = Math.max(2, window.count);
    const t = index / (count - 1);
    const year = window.years[index];
    const r = radiusForYear(year, window, depth) + 0.006;
    const turns = chronologyTurns(window.count);
    const angle = -Math.PI * 0.5 + t * turns * Math.PI * 2;
    const latitude = Math.sin((t - 0.5) * Math.PI * 1.7) * 0.31;
    const horizontal = Math.cos(latitude) * r;
    return {
      year,
      x: Math.cos(angle) * horizontal,
      y: Math.sin(latitude) * r,
      z: Math.sin(angle) * horizontal
    };
  }

  function angleForEquinoxRecord(record) {
    const day = Number(record?.patternPosition?.dayOfPatternYear || record?.equinox?.patternPosition?.dayOfPatternYear);
    if (!Number.isFinite(day)) return null;
    return ((day - 0.5) / 364) * Math.PI * 2;
  }

  function supportedEvidenceYears() {
    try { return root.AlignmentLedgerEngine?.listSupportedYears?.() || []; }
    catch (_) { return []; }
  }

  function getRecord(year) {
    try { return root.AlignmentLedgerData?.getRecord?.({ year }) || null; }
    catch (_) { return null; }
  }

  function evidencePoint(year, window) {
    const record = getRecord(year);
    const angle = angleForEquinoxRecord(record);
    if (angle == null) return null;
    const r = radiusForYear(year, window, state.depth) + 0.012;
    return {
      year,
      x: Math.sin(angle) * r,
      y: 0,
      z: -Math.cos(angle) * r
    };
  }

  function selectedPatternDay(context) {
    const raw = Number(
      context?.model?.selectedPatternPosition?.dayOfPatternYear
      ?? context?.model?.todayPatternPosition?.dayOfPatternYear
      ?? 1
    );
    return Math.max(1, Math.min(364, Number.isFinite(raw) ? Math.round(raw) : 1));
  }

  function patternAngleRadians(dayOfPatternYear) {
    const day = Math.max(1, Math.min(364, Number(dayOfPatternYear) || 1));
    return ((day - 0.5) / 364) * Math.PI * 2;
  }

  function pointAtPatternAngle(dayOfPatternYear, radius, y = 0) {
    const angle = patternAngleRadians(dayOfPatternYear);
    return { x: Math.sin(angle) * radius, y, z: -Math.cos(angle) * radius };
  }

  function moonBoundsForPatternDay(dayOfPatternYear) {
    const day = Math.max(1, Math.min(364, Number(dayOfPatternYear) || 1));
    const moon = Math.floor((day - 1) / 28) + 1;
    return Object.freeze({ moon, startDay: (moon - 1) * 28 + 1, endDay: moon * 28 });
  }

  function configKey(context) {
    return [
      context.selectedYear,
      state.enabled,
      state.span,
      state.direction,
      state.mode,
      state.depth,
      state.evidenceOnly,
      state.chronology,
      state.trajectory,
      state.yearGate,
      selectedPatternDay(context),
      context.tier || context.quality?.tier || "high",

      /*
       * Semantic camera depth changes which analytical years
       * are visually emphasized. It must therefore participate
       * in the geometry cache key.
       */
      context.semanticZoomState?.band || "medium"
    ].join("|");
  }

  function disposeObject(obj) {
    if (!obj) return;
    obj.geometry?.dispose?.();
    if (Array.isArray(obj.material)) obj.material.forEach(m => m?.dispose?.());
    else obj.material?.dispose?.();
  }

  function disposeObjects() {
    if (group?.parent) group.parent.remove(group);
    [shellLines, pastShellLines, futureShellLines, majorShellLines, selectedShell, chronologyLine, yearGateLine, markerPoints, trajectoryLine, selectedDayCorridor, moonCorridorBoundaries, selectedDayShellPoints].forEach(disposeObject);
    group = shellLines = pastShellLines = futureShellLines = majorShellLines = selectedShell = chronologyLine = yearGateLine = markerPoints = trajectoryLine = selectedDayCorridor = moonCorridorBoundaries = selectedDayShellPoints = null;
  }

  function makeLineSegments(THREE, positions, color, opacity, name, order) {
    if (!positions.length) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      depthTest: true
    });
    const lines = new THREE.LineSegments(geometry, material);
    lines.name = name;
    lines.renderOrder = order;
    return lines;
  }

  function makeLine(THREE, points, color, opacity, name, order) {
    if (points.length < 2) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(points.flatMap(p => [p.x, p.y, p.z]), 3));
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      depthTest: true
    });
    const line = new THREE.Line(geometry, material);
    line.name = name;
    line.renderOrder = order;
    return line;
  }

  function resolveTemporalLegibility(
    context,
    window,
    evidenceYears = []
  ) {
    const policy =
      root.LivingTimeSphereTemporalLegibility;

    const band =
      context.semanticZoomState?.band
      || "medium";

    const tier =
      context.tier
      || context.quality?.tier
      || "high";

    if (
      !policy
      || typeof policy.resolve !== "function"
    ) {
      return Object.freeze({
        band,
        tier,
        analyticalYearCount:
          window.count,
        visibleYearCount:
          window.count,
        hiddenYearCount:
          0,
        interval:
          1,
        visibleYears:
          Object.freeze(
            window.years.slice()
          )
      });
    }

    return policy.resolve({
      window,
      selectedYear:
        window.reference,
      band,
      tier,
      evidenceYears
    });
  }


  /*
   * Phase IIIC — semantic membrane picking.
   *
   * The analytical year window may contain as many as 200 years,
   * but only membranes admitted by temporal legibility are eligible
   * for direct interaction.
   *
   * Picking is mathematical rather than geometry-heavy:
   * a renderer ray is compared with the concentric year radii.
   * No duplicate invisible SphereGeometry is created.
   */
  function pickableYears(context) {
    const window =
      yearWindow(
        context?.selectedYear,
        state.span,
        state.direction
      );

    const evidence =
      supportedEvidenceYears();

    const plan =
      resolveTemporalLegibility(
        context || {},
        window,
        evidence
      );

    const visible =
      new Set(
        plan?.visibleYears
        || window.years
      );

    return window.years.filter(year => {
      if (!visible.has(year)) {
        return false;
      }

      if (
        state.evidenceOnly
        && !evidence.includes(year)
        && year !== window.reference
      ) {
        return false;
      }

      return true;
    });
  }

  function raySphereDistance(
    origin,
    direction,
    radius
  ) {
    if (
      !origin
      || !direction
      || !Number.isFinite(radius)
      || radius <= 0
    ) {
      return null;
    }

    const ox = Number(origin.x);
    const oy = Number(origin.y);
    const oz = Number(origin.z);

    const dx = Number(direction.x);
    const dy = Number(direction.y);
    const dz = Number(direction.z);

    if (
      ![
        ox, oy, oz,
        dx, dy, dz
      ].every(Number.isFinite)
    ) {
      return null;
    }

    const a =
      dx * dx
      + dy * dy
      + dz * dz;

    if (a <= 0) {
      return null;
    }

    const b =
      2 * (
        ox * dx
        + oy * dy
        + oz * dz
      );

    const c =
      ox * ox
      + oy * oy
      + oz * oz
      - radius * radius;

    const discriminant =
      b * b
      - 4 * a * c;

    if (discriminant < 0) {
      return null;
    }

    const root =
      Math.sqrt(discriminant);

    const t0 =
      (-b - root)
      / (2 * a);

    const t1 =
      (-b + root)
      / (2 * a);

    if (t0 >= 0) {
      return t0;
    }

    if (t1 >= 0) {
      return t1;
    }

    return null;
  }

  function resolveYearPick(
    context,
    ray
  ) {
    if (
      !state.enabled
      || !ray?.origin
      || !ray?.direction
    ) {
      return null;
    }

    const window =
      yearWindow(
        context?.selectedYear,
        state.span,
        state.direction
      );

    const years =
      pickableYears(context);

    if (!years.length) {
      return null;
    }

    /*
     * The shells are close together at large spans.
     * We therefore compare ray intersection depth rather than
     * allocating 200 independent raycast meshes.
     */
    const candidates =
      years
        .map(year => {
          const radius =
            radiusForYear(
              year,
              window,
              state.depth
            );

          const distance =
            raySphereDistance(
              ray.origin,
              ray.direction,
              radius
            );

          return {
            year,
            radius,
            distance
          };
        })
        .filter(item =>
          Number.isFinite(
            item.distance
          )
        )
        .sort((a, b) => {
          /*
           * Front-most shell wins.
           * Year is the deterministic tie-breaker.
           */
          const delta =
            a.distance
            - b.distance;

          if (
            Math.abs(delta)
            > 1e-7
          ) {
            return delta;
          }

          return a.year - b.year;
        });

    if (!candidates.length) {
      return null;
    }

    const winner =
      candidates[0];

    return Object.freeze({
      handled: true,
      type: "year",
      semanticRole:
        "temporal-year-membrane",
      year:
        winner.year,
      selectedYear:
        winner.year,
      patternDay:
        selectedPatternDay(context),
      radius:
        winner.radius,
      distance:
        winner.distance,
      analyticalYearCount:
        window.count,
      pickableYearCount:
        years.length
    });
  }

  function pick(context) {
    const ray =
      context?.ray
      || context?.pointerRay
      || null;

    const result =
      resolveYearPick(
        context,
        ray
      );

    return result || {
      handled: false
    };
  }

  function semanticTargets(context) {
    if (!state.enabled) return [];
    const window = yearWindow(context?.selectedYear, state.span, state.direction);
    const selectedDay = selectedPatternDay(context);
    const years = pickableYears(context);
    return years.map(year => {
      const radius = radiusForYear(year, window, state.depth) + 0.018;
      const point = pointAtPatternAngle(selectedDay, radius, 0.012);
      const selected = year === window.reference;
      return {
        id: `strata-year-${year}`,
        label: selected ? `Selected year ${year}` : `Year ${year}`,
        detail: `Pattern day ${selectedDay} · temporal membrane`,
        kind: "temporal-year",
        worldX: point.x,
        worldY: point.y,
        worldZ: point.z,
        priority: selected ? 93 : (isMajorYear(year, window, context?.tier || "high") ? 56 : 34),
        showDistance: selected ? 2.8 : 2.55,
        resetDistance: selected ? 3.25 : 3.0,
        pinned: selected,
        selected
      };
    });
  }

  function build(context) {
    disposeObjects();
    if (!state.enabled || !context.THREE || !context.scene) return;

    const THREE = context.THREE;
    const tier = context.tier || context.quality?.tier || "high";
    const window = yearWindow(context.selectedYear, state.span, state.direction);
    const evidence = new Set(supportedEvidenceYears());

    /*
     * Analytical chronology and visual chronology are deliberately
     * separate.
     *
     * window.years always remains the complete requested time range.
     * Semantic legibility only decides which membranes should be
     * emphasized at the current camera distance.
     */
    const legibilityPlan =
      resolveTemporalLegibility(
        context,
        window,
        Array.from(
          evidence
        )
      );

    const visibleYearSet =
      new Set(
        legibilityPlan.visibleYears
        || window.years
      );

    const segments = radialSegments(tier, window.count);
    const cutaway = state.mode === "cutaway";

    group = new THREE.Group();
    group.name = "temporal-strata-living-onion";
    group.renderOrder = -8;
    group.userData = {
      version: VERSION,
      semanticRole: "temporal-onion",
      window,
      shellBounds: shellBounds(window, state.depth),

      /*
       * Full chronology remains analytically present even where
       * semantic zoom suppresses intermediate membranes.
       */
      analyticalYearCount:
        window.count,

      renderedYearCount:
        legibilityPlan.visibleYearCount
        ?? window.count,

      visibleYearCount:
        legibilityPlan.visibleYearCount
        ?? window.count,

      hiddenYearCount:
        legibilityPlan.hiddenYearCount
        ?? 0,

      semanticBand:
        legibilityPlan.band
        || context.semanticZoomState?.band
        || "medium",

      legibility: {
        band:
          legibilityPlan.band
          || "medium",

        interval:
          legibilityPlan.interval
          || 1,

        analyticalYearCount:
          legibilityPlan.analyticalYearCount
          ?? window.count,

        visibleYearCount:
          legibilityPlan.visibleYearCount
          ?? window.count,

        hiddenYearCount:
          legibilityPlan.hiddenYearCount
          ?? 0
      },

      selectedYear: window.reference,
      direction: window.direction,
      selectedPatternDay: selectedPatternDay(context),
      temporalStates: { past: "record", present: "selected/live", future: "planning/possibility" },
      note: "13-Moon core remains unchanged; year shells encode temporal depth; future shells are planning space, not prediction"
    };

    const pastPositions = [];
    const futurePositions = [];
    const majorPositions = [];

    window.years.forEach((year) => {

      /*
       * Keep all years analytically available while rendering only
       * the membranes chosen by semantic temporal legibility.
       *
       * The selected/reference year, boundaries, near years, and
       * evidence years are already protected by the policy.
       */
      if (
        !visibleYearSet.has(
          year
        )
      ) {
        return;
      }

      if (
        state.evidenceOnly
        && !evidence.has(year)
        && year !== window.reference
      ) {
        return;
      }

      if (year === window.reference) return;
      const r = radiusForYear(year, window, state.depth);
      const target = year < window.reference ? pastPositions : futurePositions;
      target.push(...ringSegments(r, segments, 0, cutaway));
      if (isMajorYear(year, window, tier)) {
        majorPositions.push(...ringSegments(r, Math.max(16, Math.floor(segments * 0.78)), 1, cutaway));
        majorPositions.push(...ringSegments(r, Math.max(16, Math.floor(segments * 0.78)), 2, cutaway));
      }
    });

    const minorOpacity = window.count >= 100 ? 0.075 : window.count >= 50 ? 0.10 : 0.14;
    pastShellLines = makeLineSegments(THREE, pastPositions, 0x7191aa, minorOpacity, "temporal-onion-past-shells", -7);
    if (pastShellLines) {
      pastShellLines.userData = { semanticRole: "past-record-strata", temporalState: "past" };
      group.add(pastShellLines);
    }

    futureShellLines = makeLineSegments(THREE, futurePositions, 0x58b9ac, Math.max(0.055, minorOpacity * 0.72), "temporal-onion-future-shells", -7);
    if (futureShellLines) {
      futureShellLines.userData = { semanticRole: "future-planning-strata", temporalState: "future", predictive: false };
      group.add(futureShellLines);
    }

    // Backward-compatible alias retained for diagnostics that look for shellLines.
    shellLines = pastShellLines || futureShellLines;

    majorShellLines = makeLineSegments(THREE, majorPositions, 0x8eabc0, Math.min(0.22, minorOpacity * 1.55), "temporal-onion-major-shells", -6);
    if (majorShellLines) group.add(majorShellLines);

    // The selected/reference year is a bright membrane. It never replaces or
    // moves the 13-Moon core; it surrounds it as the active temporal layer.
    const selectedPositions = [
      ...ringSegments(REFERENCE_RADIUS, Math.max(48, segments), 0, cutaway),
      ...ringSegments(REFERENCE_RADIUS, Math.max(42, segments), 1, cutaway),
      ...ringSegments(REFERENCE_RADIUS, Math.max(42, segments), 2, cutaway)
    ];
    selectedShell = makeLineSegments(THREE, selectedPositions, 0xf2c45d, 0.52, "temporal-onion-selected-year", -3);
    if (selectedShell) {
      selectedShell.userData = {
        semanticRole:
          "present-selected-stratum",

        temporalState:
          "present",

        year:
          window.reference,

        selectedYear:
          window.reference,

        patternDay:
          selectedPatternDay(context),

        radius:
          REFERENCE_RADIUS,

        interactive:
          true
      };
      group.add(selectedShell);
    }

    // Pattern corridors turn the shell stack into a comparison instrument. The
    // selected day becomes one radial line through every visible year, while the
    // selected Moon contributes two quieter boundaries. This lets the eye compare
    // the same Pattern coordinate through history without moving the 13-Moon core.
    const selectedDay = selectedPatternDay(context);
    const moonBounds = moonBoundsForPatternDay(selectedDay);
    const bounds = shellBounds(window, state.depth);
    const corridorInner = Math.max(0.02, bounds.inner - 0.025);
    const corridorOuter = bounds.outer + 0.035;
    selectedDayCorridor = makeLine(THREE, [
      pointAtPatternAngle(selectedDay, corridorInner, 0.008),
      pointAtPatternAngle(selectedDay, corridorOuter, 0.008)
    ], 0xf3cf72, 0.9, "temporal-onion-selected-day-corridor", 5);
    if (selectedDayCorridor) {
      selectedDayCorridor.userData = { semanticRole: "selected-pattern-day-corridor", selectedDay, moon: moonBounds.moon, evidence: false };
      group.add(selectedDayCorridor);
    }

    const moonBoundaryPositions = [];
    [moonBounds.startDay, moonBounds.endDay].forEach(day => {
      const a = pointAtPatternAngle(day, corridorInner, 0.004);
      const b = pointAtPatternAngle(day, corridorOuter, 0.004);
      moonBoundaryPositions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    });
    moonCorridorBoundaries = makeLineSegments(THREE, moonBoundaryPositions, 0x69d5c0, 0.42, "temporal-onion-moon-corridor", 4);
    if (moonCorridorBoundaries) {
      moonCorridorBoundaries.userData = { semanticRole: "selected-moon-corridor", moon: moonBounds.moon, evidence: false };
      group.add(moonCorridorBoundaries);
    }

    const shellPointPositions = window.years
      .filter(year => !state.evidenceOnly || evidence.has(year) || year === window.reference)
      .map(year => pointAtPatternAngle(selectedDay, radiusForYear(year, window, state.depth) + 0.018, 0.012));
    if (shellPointPositions.length) {
      const sg = new THREE.BufferGeometry();
      sg.setAttribute("position", new THREE.Float32BufferAttribute(shellPointPositions.flatMap(p => [p.x, p.y, p.z]), 3));
      const sm = new THREE.PointsMaterial({
        color: 0xffdf8a,
        size: tier === "low" ? 0.009 : 0.012,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.82,
        depthWrite: false
      });
      selectedDayShellPoints = new THREE.Points(sg, sm);
      selectedDayShellPoints.name = "temporal-onion-selected-day-shell-points";
      selectedDayShellPoints.renderOrder = 6;
      selectedDayShellPoints.userData = { semanticRole: "same-pattern-coordinate-through-time", selectedDay, moon: moonBounds.moon, evidence: false };
      group.add(selectedDayShellPoints);
    }

    // Structural chronology filament: a visual index showing direction through
    // successive year membranes. It is intentionally distinct from evidence.
    if (state.chronology) {
      const points = window.years.map((_, i) => chronologyPoint(i, window, state.depth));
      chronologyLine = makeLine(THREE, points, 0x65d6bd, 0.48, "temporal-onion-chronology-filament", 0);
      if (chronologyLine) {
        chronologyLine.userData = { semanticRole: "structural-chronology", evidence: false };
        group.add(chronologyLine);
      }
    }

    // Year Gate remains the fixed calendar seam. It provides a stable reference
    // against which real trajectories can visibly drift across year shells.
    if (state.yearGate) {
      const bounds = shellBounds(window, state.depth);
      const gatePoints = [
        { x: 0, y: 0, z: -bounds.inner },
        { x: 0, y: 0, z: -bounds.outer }
      ];
      yearGateLine = makeLine(THREE, gatePoints, 0x71e5c5, 0.62, "temporal-onion-year-gate-spine", 1);
      if (yearGateLine) {
        yearGateLine.userData = { semanticRole: "year-gate-reference", evidence: false };
        group.add(yearGateLine);
      }
    }

    const evidenceYears = window.years.filter(y => evidence.has(y));
    const evidencePoints = evidenceYears.map(year => evidencePoint(year, window)).filter(Boolean);

    if (evidencePoints.length) {
      const pg = new THREE.BufferGeometry();
      pg.setAttribute("position", new THREE.Float32BufferAttribute(evidencePoints.flatMap(p => [p.x, p.y, p.z]), 3));
      const pm = new THREE.PointsMaterial({
        color: 0xffd477,
        size: tier === "low" ? 0.012 : 0.015,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.94,
        depthWrite: false
      });
      markerPoints = new THREE.Points(pg, pm);
      markerPoints.name = "temporal-onion-equinox-evidence";
      markerPoints.renderOrder = 3;
      markerPoints.userData = { semanticRole: "measured-or-calculated-evidence", evidence: true };
      group.add(markerPoints);
    }

    if (state.trajectory && evidencePoints.length >= 2) {
      trajectoryLine = makeLine(THREE, evidencePoints, 0xe8b759, 0.72, "temporal-onion-equinox-trajectory", 2);
      if (trajectoryLine) {
        trajectoryLine.userData = { semanticRole: "equinox-trajectory", evidence: true };
        group.add(trajectoryLine);
      }
    }

    context.scene.add(group);
  }

  function syncUi(context) {
    if (typeof document === "undefined") return;
    const status = document.getElementById("sphere-strata-status");
    const detail = document.getElementById("sphere-strata-detail");
    const window = yearWindow(context.selectedYear, state.span, state.direction);
    const tier = context.tier || context.quality?.tier || "high";
    const bounds = shellBounds(window, state.depth);

    const evidence =
      supportedEvidenceYears();

    const legibilityPlan =
      resolveTemporalLegibility(
        context,
        window,
        evidence
      );

    if (status) {
      if (!state.enabled) {
        status.textContent = "Off";
      } else {
        const analytical =
          window.count;

        const emphasized =
          legibilityPlan.visibleYearCount
          ?? analytical;

        status.textContent =
          `${window.start}–${window.end}`
          + ` · ${analytical} years`
          + (
              emphasized < analytical
                ? ` · ${emphasized} emphasized`
                : ` · full resolution`
            );
      }
    }
    if (detail) {
      const directionLabel = state.direction === "history" ? "history inward" : state.direction === "future" ? "future outward" : "history inward · future outward";
      const day = selectedPatternDay(context);
      const moon = moonBoundsForPatternDay(day).moon;
      detail.textContent = state.enabled
        ? `${state.mode === "cutaway" ? "Cutaway onion" : "Living onion"} · ${directionLabel} · Moon ${moon} / Day ${day} corridor · ${tier} tier · ${legibilityPlan.band || "medium"} semantic depth · shell band ${bounds.inner.toFixed(2)}–${bounds.outer.toFixed(2)}R`
        : "Enable Living Strata to wrap year membranes around the unchanged 13-Moon core.";
    }
  }

  function bindUi() {
    if (uiBound || typeof document === "undefined") return;
    uiBound = true;

    const enabled = document.getElementById("sphere-strata-enabled");
    const span = document.getElementById("sphere-strata-span");
    const direction = document.getElementById("sphere-strata-direction");
    const mode = document.getElementById("sphere-strata-mode");
    const depth = document.getElementById("sphere-strata-depth");
    const evidenceOnly = document.getElementById("sphere-strata-evidence-only");
    const chronology = document.getElementById("sphere-strata-chronology");
    const trajectory = document.getElementById("sphere-strata-trajectory");
    const yearGate = document.getElementById("sphere-strata-year-gate");

    // The DOM is the declarative default for first load. Read it immediately so
    // the scene mounted on frame one is identical to the scene after interaction.
    if (enabled) state.enabled = !!enabled.checked;
    if (span) state.span = clampSpan(span.value || DEFAULT_SPAN);
    if (direction) state.direction = normalizeDirection(direction.value);
    if (mode) state.mode = mode.value === "cutaway" ? "cutaway" : "onion";
    if (depth) state.depth = clampDepth(depth.value);
    if (evidenceOnly) state.evidenceOnly = !!evidenceOnly.checked;
    if (chronology) state.chronology = !!chronology.checked;
    if (trajectory) state.trajectory = !!trajectory.checked;
    if (yearGate) state.yearGate = !!yearGate.checked;

    const changed = () => {
      state.enabled = !!enabled?.checked;
      state.span = clampSpan(span?.value || DEFAULT_SPAN);
      state.direction = normalizeDirection(direction?.value);
      state.mode = mode?.value === "cutaway" ? "cutaway" : "onion";
      state.depth = clampDepth(depth?.value);
      state.evidenceOnly = !!evidenceOnly?.checked;
      state.chronology = chronology ? !!chronology.checked : true;
      state.trajectory = trajectory ? !!trajectory.checked : true;
      state.yearGate = yearGate ? !!yearGate.checked : true;
      lastKey = "";
      root.LivingTimeSphereAnimation?.markDirty?.();
      root.dispatchEvent?.(new CustomEvent("living-time:strata-change", { detail: { ...state } }));
    };

    [enabled, span, direction, mode, evidenceOnly, chronology, trajectory, yearGate].forEach(el => el?.addEventListener("change", changed));
    depth?.addEventListener("input", changed);
    depth?.addEventListener("change", changed);
  }

  const extension = {
    id: "temporal-strata",
    metadata: {
      version: VERSION,
      purpose: "nested year membranes around a stable 13-Moon core with structural and evidence trajectories"
    },
    mount(context) {
      bindUi();
      lastKey = configKey(context);
      build(context);
      syncUi(context);
    },
    update(context) {
      bindUi();
      const key = configKey(context);
      if (key !== lastKey) {
        lastKey = key;
        build(context);
      }
      syncUi(context);
    },
    pick(context) {
      return pick(context);
    },
    semanticTargets(context) {
      return semanticTargets(context);
    },
    dispose() {
      disposeObjects();
      lastKey = "";
    }
  };

  function register() {
    return root.LivingTimeSphereExtensionHost?.register?.(extension) ?? false;
  }

  if (root.LivingTimeSphereExtensionHost) register();

  return Object.freeze({
    VERSION,
    ALLOWED_SPANS,
    REFERENCE_RADIUS,
    state,
    clampSpan,
    normalizeDirection,
    yearWindow,
    clampDepth,
    radiusForYear,
    shellBounds,
    radialSegments,
    majorInterval,
    isMajorYear,
    ringSegments,
    chronologyTurns,
    chronologyPoint,
    angleForEquinoxRecord,
    selectedPatternDay,
    patternAngleRadians,
    pointAtPatternAngle,
    moonBoundsForPatternDay,
    pickableYears,
    raySphereDistance,
    resolveYearPick,
    pick,
    semanticTargets,
    register
  });
});
