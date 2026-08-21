/** Life Atlas record projection for the Living Time Sphere. */
(function (root) {
  "use strict";
  const ID = "life-atlas-records";
  const state = {
    group: null,
    records: [],
    key: "",
    loading: false,
    context: null,
    recordById: new Map(),
    plannerByDay: new Map(),
    plannerSummaryByDay: new Map(),
    changeHandler: null,
    renderedRecordIds: new Set(),
    revision: 0,
    semanticTargetCacheKey: "",
    semanticTargetCache: [],
    idleLoadHandle: null,
    runtimeLoaded: false,
    lastFrontMoon: null,
    lastRevealAll: null,
    lastRevealBand: null,
    lastSymbolRevealKey: ""
  };
  function dispose(group) {
    if (!group) return;
    while (group.children.length) {
      const c = group.children.pop();
      const atlas = c?.material?.uniforms?.uAtlas?.value || c?.userData?.symbolAtlasTexture || null;
      atlas?.dispose?.();
      c.geometry?.dispose?.();
      if (Array.isArray(c.material)) c.material.forEach(material => material?.dispose?.());
      else c.material?.dispose?.();
    }
    group.parent?.remove?.(group);
  }
  function isPlannerRecord(record) {
    return Boolean(
      record?.tags?.includes?.("living-planner")
      || record?.provenance?.source === "living-planner"
      || record?.payload?.planner
    );
  }

  function plannerCategory(record) {
    return String(
      record?.payload?.planner?.category
      || record?.subtype
      || "event"
    ).toLowerCase();
  }

  function plannerWorkflow(record) {
    return String(record?.payload?.planner?.workflow || "").toLowerCase();
  }

  const SYMBOL_BY_CATEGORY = Object.freeze({
    task: "✓", event: "●", reminder: "⚑", project: "◆", travel: "✈",
    milestone: "★", practice: "✦", growing: "🌱", farming: "🌾", planting: "🌱",
    harvest: "🌾", watering: "💧", livestock: "🐄", maintenance: "🔧", seasonal: "☀",
    meeting: "👥", school: "🎓", health: "❤", finance: "💰", observation: "◉",
    home: "⌂", family: "♡", pets: "🐾", food: "🍽", shopping: "🛒",
    vehicle: "🚗", construction: "🏗", coding: "💻", writing: "✎", research: "🔬",
    creative: "🎨", cleaning: "🧹", appointment: "✚", community: "◎",
    camping: "⛺", fieldwork: "🥾"
  });

  function plannerSymbol(record) {
    const explicit = String(record?.payload?.planner?.symbol || "").trim();
    if (explicit && explicit !== "auto") return explicit.slice(0, 4);
    const workflow = plannerWorkflow(record);
    if (workflow === "codex-of-reality") return "✎";
    if (workflow === "living-phone") return "☎";
    return SYMBOL_BY_CATEGORY[plannerCategory(record)] || "●";
  }

  const symbolTextureCache = new Map();

  function symbolTexture(THREE, symbol) {
    if (!THREE || typeof document === "undefined") return null;
    const key = String(symbol || "●").slice(0, 4);
    if (symbolTextureCache.has(key)) return symbolTextureCache.get(key);
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.clearRect(0, 0, 64, 64);
    ctx.font = 'bold 42px system-ui, "Noto Sans Symbols 2", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(key, 32, 34);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    symbolTextureCache.set(key, texture);
    return texture;
  }

  function plannerStatusLabel(record) {
    const workflow = plannerWorkflow(record);
    if (workflow === "codex-of-reality") return "CODEX WORK DAY";
    if (workflow === "living-phone") return "LIVING PHONE WORK DAY";
    const category = plannerCategory(record);
    const labels = {
      task: "SCHEDULED TASK",
      reminder: "REMINDER",
      project: "PLANNED PROJECT",
      travel: "SCHEDULED TRAVEL",
      milestone: "MILESTONE",
      practice: "SCHEDULED PRACTICE",
      growing: "GROWING PLAN",
      farming: "FARM WORK",
      planting: "PLANTING",
      harvest: "HARVEST",
      watering: "WATERING",
      livestock: "LIVESTOCK",
      maintenance: "MAINTENANCE",
      seasonal: "SEASONAL PLAN",
      meeting: "MEETING",
      school: "SCHOOL / LEARNING",
      health: "HEALTH",
      finance: "FINANCE",
      home: "HOME",
      family: "FAMILY",
      pets: "ANIMAL CARE",
      food: "FOOD / MEAL",
      shopping: "SHOPPING / ERRAND",
      vehicle: "VEHICLE",
      construction: "BUILD / CONSTRUCTION",
      coding: "CODING",
      writing: "WRITING",
      research: "RESEARCH",
      creative: "CREATIVE WORK",
      cleaning: "CLEANING",
      appointment: "APPOINTMENT",
      community: "COMMUNITY",
      camping: "CAMPING",
      fieldwork: "FIELD WORK",
      event: "SCHEDULED EVENT"
    };
    return labels[category] || "SCHEDULED";
  }

  // B7.35 — indexed calendar-day schedule authority. This is intentionally O(1)
  // per day: the renderer asks for up to 364 day summaries while building the
  // density rail, so filtering hundreds of planner records for every day caused
  // a large mobile main-thread spike after calendar imports.
  function _plannerDayKey(patternYear, patternDay) {
    const year = Number(patternYear);
    const day = Number(patternDay);
    return Number.isFinite(year) && Number.isFinite(day) ? `${year}:${day}` : null;
  }

  function _rebuildIndexes() {
    state.recordById = new Map();
    state.plannerByDay = new Map();
    state.plannerSummaryByDay = new Map();
    state.revision += 1;
    state.semanticTargetCacheKey = "";
    state.semanticTargetCache = [];
    state.lastSymbolRevealKey = "";
    for (const record of state.records) {
      if (record?.id) state.recordById.set(record.id, record);
      if (!isPlannerRecord(record)) continue;
      const key = _plannerDayKey(record?.temporal?.patternYear, record?.temporal?.patternDay);
      if (!key) continue;
      const bucket = state.plannerByDay.get(key) || [];
      bucket.push(record);
      state.plannerByDay.set(key, bucket);
    }
    for (const [key, records] of state.plannerByDay) {
      const workflows = Array.from(new Set(records.map(plannerWorkflow).filter(Boolean)));
      const categories = Array.from(new Set(records.map(plannerCategory).filter(Boolean)));
      const titles = records.map(record => String(record?.title || "Living Plan")).filter(Boolean);
      const symbols = Array.from(new Set(records.map(plannerSymbol).filter(Boolean)));
      state.plannerSummaryByDay.set(key, Object.freeze({
        count: records.length,
        recordIds: records.map(record => record.id).filter(Boolean),
        workflows,
        categories,
        titles,
        symbols,
        primarySymbol: symbols[0] || "●",
        primaryRecordId: records[0]?.id || null,
        primaryTitle: titles[0] || null,
        primaryWorkflow: workflows[0] || null
      }));
    }
  }

  function plannerDayRecords(patternYear, patternDay) {
    const key = _plannerDayKey(patternYear, patternDay);
    return key ? (state.plannerByDay.get(key) || []).slice() : [];
  }

  function plannerDaySummary(patternYear, patternDay) {
    const key = _plannerDayKey(patternYear, patternDay);
    return key ? (state.plannerSummaryByDay.get(key) || EMPTY_DAY_SUMMARY) : EMPTY_DAY_SUMMARY;
  }

  const EMPTY_DAY_SUMMARY = Object.freeze({
    count: 0,
    recordIds: Object.freeze([]),
    workflows: Object.freeze([]),
    categories: Object.freeze([]),
    titles: Object.freeze([]),
    symbols: Object.freeze([]),
    primarySymbol: null,
    primaryRecordId: null,
    primaryTitle: null,
    primaryWorkflow: null
  });

  function _moonForPatternDay(day) {
    const value = Math.max(1, Math.min(364, Number(day) || 1));
    return Math.floor((value - 1) / 28) + 1;
  }

  function _circularPatternDistance(a, b) {
    const aa = Math.max(1, Math.min(364, Number(a) || 1));
    const bb = Math.max(1, Math.min(364, Number(b) || 1));
    const raw = Math.abs(aa - bb);
    return Math.min(raw, 364 - raw);
  }

  // Planner LOD: the year view uses the lightweight density rail. Individual
  // records progressively materialize only when they can be meaningfully read.
  // This prevents a 261-day work schedule from becoming 700+ Three.js objects.
  function _plannerRecordVisible(record, refYear, selectedDay, semanticBand) {
    if (!isPlannerRecord(record) || Number(record?.temporal?.patternYear) !== refYear) return true;
    const day = Number(record?.temporal?.patternDay);
    if (!Number.isFinite(day)) return false;
    if (day === selectedDay) return true;
    if (semanticBand === "far") return false;
    if (semanticBand === "medium") return _circularPatternDistance(day, selectedDay) <= 3;
    const selectedMoon = _moonForPatternDay(selectedDay);
    const recordMoon = Number(record?.temporal?.moon) || _moonForPatternDay(day);
    if (semanticBand === "near") return recordMoon === selectedMoon;
    if (semanticBand === "detail") return recordMoon === selectedMoon || _circularPatternDistance(day, selectedDay) <= 7;
    return false;
  }



  // B7.48 — one GPU schedule field, regardless of symbol variety.
  // The atlas is built only when schedule data changes; camera movement updates
  // uniforms, not geometry, DOM nodes, textures or per-symbol draw ranges.
  const SYMBOL_ATLAS_TILE = 96;
  const SYMBOL_ATLAS_COLUMNS = 8;

  function _buildSymbolAtlas(THREE, symbols) {
    if (!THREE || typeof document === "undefined") return null;
    const unique = Array.from(new Set((symbols || []).map(value => String(value || "●").slice(0, 4)).filter(Boolean)));
    if (!unique.length) unique.push("●");
    const columns = Math.min(SYMBOL_ATLAS_COLUMNS, Math.max(1, unique.length));
    const rows = Math.max(1, Math.ceil(unique.length / columns));
    const canvas = document.createElement("canvas");
    canvas.width = columns * SYMBOL_ATLAS_TILE;
    canvas.height = rows * SYMBOL_ATLAS_TILE;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const indexBySymbol = new Map();
    unique.forEach((symbol, index) => {
      indexBySymbol.set(symbol, index);
      const column = index % columns;
      const row = Math.floor(index / columns);
      const cx = column * SYMBOL_ATLAS_TILE + SYMBOL_ATLAS_TILE / 2;
      const cy = row * SYMBOL_ATLAS_TILE + SYMBOL_ATLAS_TILE / 2;
      let fontSize = 64;
      ctx.font = `800 ${fontSize}px "Noto Sans Symbols 2", "Segoe UI Symbol", "Noto Color Emoji", system-ui, sans-serif`;
      while (fontSize > 34 && ctx.measureText(symbol).width > SYMBOL_ATLAS_TILE * 0.78) {
        fontSize -= 4;
        ctx.font = `800 ${fontSize}px "Noto Sans Symbols 2", "Segoe UI Symbol", "Noto Color Emoji", system-ui, sans-serif`;
      }
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(255,255,255,.42)";
      ctx.shadowBlur = 5;
      ctx.fillText(symbol, cx, cy + 2);
      ctx.restore();
    });
    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return { texture, indexBySymbol, columns, rows, count: unique.length };
  }

  function _plannerPointSizeForBand(band, tier) {
    const key = String(band || "medium").toLowerCase();
    // B7.59.2D — schedule is a calendar annotation, not a foreground object.
    const base =
      key === "detail" ? 24
      : key === "near" ? 22
      : key === "far" ? 18
      : 20;
    return tier === "lowpower" || tier === "low"
      ? Math.max(16, base - 2)
      : base;
  }

  function _buildPlannerSummaryPoints(context, group, refYear) {
    const THREE = context.THREE;
    if (!THREE || !group) return;
    const patternRingRadius = Number(root.LivingTimeSphereM?.SIZES?.patternRing || 1);
    const presentationRail =
      root.LivingTimeSphereRenderer3d?.getCalendarRailGeometry?.()
      || {
        dayNumberPresentationWeek1: 1.320,
        dayNumberPresentationWeekStep: 0.092,
        scheduleSymbolPresentationOffset: 0.000,
        scheduleSymbolInset: 0.046,
        scheduleStackStep: 0.018
      };
    const entries = [];
    const symbols = [];
    const connectorPositions = [];
    const connectorColors = [];

    for (const [key, summary] of state.plannerSummaryByDay) {
      const [yearText, dayText] = String(key).split(":");
      const year = Number(yearText);
      const patternDay = Number(dayText);
      if (year !== refYear || !summary?.count || !Number.isFinite(patternDay)) continue;
      const cell = root.LivingTimeSphereCalendarGeometry?.calendarCell?.(patternDay);
      if (!cell) continue;
      const displayCell =
        root.LivingTimeSphereCalendarGeometry?.calendarDisplayCell?.(patternDay, {
          dayNumberWeek1: presentationRail.dayNumberPresentationWeek1,
          dayNumberWeekStep: presentationRail.dayNumberPresentationWeekStep,
          scheduleInset: presentationRail.scheduleSymbolInset
        }) || null;
      const angle = Number(displayCell?.angle ?? cell.angle) * Math.PI / 180;
      const cellRadius = patternRingRadius * Number(cell.radialFactor || 1);
      // B7.59.2D — numeral + glyph are one visual packet. Keep the legacy
      // presentation-offset term for compatibility, then derive the rest from
      // calendarDisplayCell instead of inventing a second coordinate authority.
      const markerRadius =
        cellRadius
        + patternRingRadius
          * Number(
            presentationRail.scheduleSymbolPresentationOffset
            ?? 0
          )
        + patternRingRadius
          * Number(
              (displayCell?.scheduleRadialFactor ?? cell.radialFactor)
              - Number(cell.radialFactor || 1)
            );
      const record = state.recordById.get(summary.primaryRecordId) || null;
      const color = colorFor(record?.type, "present", THREE, record);
      const symbol = String(summary.primarySymbol || plannerSymbol(record) || "●").slice(0, 4);
      const countLabel =
        summary.count > 9
          ? "9+"
          : (summary.count > 1 ? String(summary.count) : "");
      const glyph = `${symbol}${countLabel}`.slice(0, 4);
      symbols.push(glyph);
      const entry = {
        patternDay,
        moon: Number(cell.moon),
        moonDay: Number(cell.moonDay),
        recordId: summary.primaryRecordId,
        count: summary.count,
        symbol,
        glyph,
        x: Math.sin(angle) * markerRadius,
        y: 0.031,
        z: -Math.cos(angle) * markerRadius,
        color
      };
      entries.push(entry);

      const presentationWeek =
        Math.max(
          1,
          Math.min(
            4,
            Number(cell?.week || 1)
          )
        );
      const endRadius =
        patternRingRadius
        * Number(
            displayCell?.dayNumberRadialFactor
            ?? (
              Number(
                presentationRail.dayNumberPresentationWeek1
                ?? 1.320
              )
              + (presentationWeek - 1)
                * Number(
                    presentationRail.dayNumberPresentationWeekStep
                    ?? 0.092
                  )
            )
          );
      connectorPositions.push(
        entry.x, 0.010, entry.z,
        Math.sin(angle) * endRadius, 0.010, -Math.cos(angle) * endRadius
      );
      connectorColors.push(color.r, color.g, color.b, color.r, color.g, color.b);
    }

    if (entries.length) {
      entries.sort((a, b) => a.patternDay - b.patternDay);
      const atlas = _buildSymbolAtlas(THREE, symbols);
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(entries.length * 3);
      const colors = new Float32Array(entries.length * 3);
      const symbolIndices = new Float32Array(entries.length);
      const moons = new Float32Array(entries.length);
      const patternDays = new Float32Array(entries.length);
      entries.forEach((entry, index) => {
        positions[index * 3] = entry.x;
        positions[index * 3 + 1] = entry.y;
        positions[index * 3 + 2] = entry.z;
        colors[index * 3] = entry.color.r;
        colors[index * 3 + 1] = entry.color.g;
        colors[index * 3 + 2] = entry.color.b;
        symbolIndices[index] = Number(atlas?.indexBySymbol?.get(entry.glyph || entry.symbol) || 0);
        moons[index] = entry.moon;
        patternDays[index] = entry.patternDay;
      });
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
      geometry.setAttribute("aSymbolIndex", new THREE.BufferAttribute(symbolIndices, 1));
      geometry.setAttribute("aMoon", new THREE.BufferAttribute(moons, 1));
      geometry.setAttribute("aPatternDay", new THREE.BufferAttribute(patternDays, 1));

      const material = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: false,
        uniforms: {
          uAtlas: { value: atlas?.texture || null },
          uAtlasColumns: { value: Number(atlas?.columns || 1) },
          uAtlasRows: { value: Number(atlas?.rows || 1) },
          uCenterMoon: { value: 1 },
          uHalfWindow: { value: 2 },
          uRevealAll: { value: 0 },
          uVisible: { value: 1 },
          uSelectedDay: { value: Number(context.model?.selectedPatternPosition?.dayOfPatternYear || 0) },
          uPointSize: { value: _plannerPointSizeForBand(context.semanticZoomState?.band, context.tier) },
          uPixelRatio: { value: Number(context.renderer?.getPixelRatio?.() || 1) },
          uGestureScale: { value: 1 }
        },
        vertexShader: `
          attribute vec3 aColor;
          attribute float aSymbolIndex;
          attribute float aMoon;
          attribute float aPatternDay;
          uniform float uCenterMoon;
          uniform float uHalfWindow;
          uniform float uRevealAll;
          uniform float uVisible;
          uniform float uSelectedDay;
          uniform float uPointSize;
          uniform float uPixelRatio;
          uniform float uGestureScale;
          varying vec3 vColor;
          varying float vSymbolIndex;
          varying float vOpacity;
          void main() {
            float rawMoonDistance = abs(aMoon - uCenterMoon);
            float moonDistance = min(rawMoonDistance, 13.0 - rawMoonDistance);
            float disclosed = uRevealAll > 0.5 ? 1.0 : step(moonDistance, uHalfWindow + 0.01);
            disclosed *= uVisible;
            float selected = step(abs(aPatternDay - uSelectedDay), 0.1);
            float emphasis = uRevealAll > 0.5
              ? 0.82
              : (moonDistance < 0.5 ? 1.28 : (moonDistance < 1.5 ? 0.98 : 0.82));
            emphasis = mix(emphasis, 1.52, selected);

            vec4 mvPosition =
              modelViewMatrix
              * vec4(
                  position,
                  1.0
                );

            vec4 clipPosition =
              projectionMatrix
              * mvPosition;

            gl_Position =
              clipPosition;

            /*
             * B7.55 — same visual aperture as day numerals.
             * NDC +/-0.54 is fully visible; +/-0.78 is the dissipating edge.
             */
            float ndcX =
              clipPosition.x
              / max(
                  0.0001,
                  abs(
                    clipPosition.w
                  )
                );

            float aperture =
              1.0
              - smoothstep(
                  0.54,
                  0.78,
                  abs(
                    ndcX
                  )
                );

            disclosed *=
              aperture;

            float apertureScale =
              mix(
                0.76,
                1.0,
                aperture
              );

            gl_PointSize =
              disclosed > 0.025
                ? max(
                    1.0,
                    uPointSize
                      * uPixelRatio
                      * emphasis
                      * uGestureScale
                      * apertureScale
                      // B7.58.2 schedule symbol scale
                      * 0.90
                  )
                : 0.0;

            vColor = aColor;
            vSymbolIndex = aSymbolIndex;
            vOpacity =
              disclosed
              * (
                  selected > 0.5
                    ? 1.0
                    : (
                        moonDistance < 0.5
                          ? 0.98
                          : 0.84
                      )
                );
          }
        `,
        fragmentShader: `
          uniform sampler2D uAtlas;
          uniform float uAtlasColumns;
          uniform float uAtlasRows;
          varying vec3 vColor;
          varying float vSymbolIndex;
          varying float vOpacity;
          void main() {
            if (vOpacity < 0.01) discard;
            float column = mod(vSymbolIndex, uAtlasColumns);
            float row = floor(vSymbolIndex / uAtlasColumns);
            vec2 tileUv = vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y);
            vec2 uv = vec2(
              (column + tileUv.x) / uAtlasColumns,
              (row + tileUv.y) / uAtlasRows
            );
            float alpha = texture2D(uAtlas, uv).a;
            if (alpha < 0.055) discard;
            gl_FragColor = vec4(vColor, alpha * vOpacity);
          }
        `
      });
      const points = new THREE.Points(geometry, material);
      points.name = "living-plan-day-symbol-atlas";
      points.renderOrder = 18;
      points.frustumCulled = false;
      points.userData = {
        extension: ID,
        type: "living-plan-day-points",
        planner: true,
        patternYear: refYear,
        totalCount: entries.length,
        symbolAtlasTexture: atlas?.texture || null,
        symbolAtlasSlots: Number(atlas?.count || 0),
        entries: entries.map(entry => ({
          patternDay: entry.patternDay, moon: entry.moon, moonDay: entry.moonDay,
          recordId: entry.recordId, count: entry.count, symbol: entry.symbol
        }))
      };
      group.add(points);
    }

    if (connectorPositions.length) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(connectorPositions, 3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(connectorColors, 3));
      const material = new THREE.LineBasicMaterial({
        vertexColors: true, transparent: true, opacity: 0.28, depthWrite: false
      });
      const connectors = new THREE.LineSegments(geometry, material);
      connectors.name = "living-plan-day-connectors";
      connectors.userData = { extension: ID, type: "living-plan-day-connectors" };
      group.add(connectors);
    }
  }

  function _cameraFacingMoon(context) {
    const THREE = context?.THREE;
    const camera = context?.camera;
    if (!THREE || !camera) return null;
    const patternRingRadius = Number(root.LivingTimeSphereM?.SIZES?.patternRing || 1);
    const center = new THREE.Vector3(0, 0, 0).applyMatrix4(camera.matrixWorldInverse);
    let bestMoon = null;
    let bestDepth = -Infinity;
    for (let moon = 1; moon <= 13; moon += 1) {
      const midDay = ((moon - 1) * 28) + 14.5;
      const cell = root.LivingTimeSphereCalendarGeometry?.calendarCell?.(Math.max(1, Math.min(364, Math.round(midDay))));
      if (!cell) continue;
      const angle = Number(cell.angle) * Math.PI / 180;
      const radius = patternRingRadius * Number(cell.radialFactor || 1);
      const point = new THREE.Vector3(
        Math.sin(angle) * radius,
        0.02,
        -Math.cos(angle) * radius
      ).applyMatrix4(camera.matrixWorldInverse);
      const depth = point.z - center.z;
      if (depth > bestDepth) { bestDepth = depth; bestMoon = moon; }
    }
    return bestMoon;
  }

  function _syncPlannerSummaryReveal(context) {
    const group = state.group;
    if (!group) return;
    const revealAll = String(context?.dayLabelMode || "key") === "all";
    const band = String(context?.semanticZoomState?.band || "medium").toLowerCase();
    const disclosedCenter = Number(context?.calendarDisclosure?.centerMoon || 0);
    const frontMoon = revealAll ? null : (disclosedCenter || _cameraFacingMoon(context));
    const selectedDay = Number(context?.model?.selectedPatternPosition?.dayOfPatternYear || context?.model?.todayPatternPosition?.dayOfPatternYear || 0);
    const pixelRatio = Number(context?.renderer?.getPixelRatio?.() || 1);
    const gesture = !!context?.interactionActive;
    const revealKey = [frontMoon || 0, revealAll ? 1 : 0, band, selectedDay, pixelRatio.toFixed(2), gesture ? 1 : 0].join("|");
    if (state.lastSymbolRevealKey === revealKey) return;
    state.lastSymbolRevealKey = revealKey;
    state.lastFrontMoon = frontMoon;
    state.lastRevealAll = revealAll;
    state.lastRevealBand = band;

    for (const object of group.children || []) {
      const data = object?.userData || {};
      if (data.type !== "living-plan-day-points") continue;
      const uniforms = object?.material?.uniforms;
      if (!uniforms) continue;
      const visible = revealAll || !!frontMoon;
      object.visible = visible;
      uniforms.uCenterMoon.value = Number(frontMoon || 1);
      uniforms.uHalfWindow.value = Math.max(0, Number(context?.calendarDisclosure?.halfWindow ?? 2));
      uniforms.uRevealAll.value = revealAll ? 1 : 0;
      uniforms.uVisible.value = visible ? 1 : 0;
      uniforms.uSelectedDay.value = selectedDay;
      uniforms.uPointSize.value = _plannerPointSizeForBand(band, context?.tier);
      uniforms.uPixelRatio.value = pixelRatio;
      uniforms.uGestureScale.value = gesture ? 0.90 : 1;
    }

    const connectors = group.children?.find?.(object => object?.userData?.type === "living-plan-day-connectors");
    if (connectors) connectors.visible = revealAll && band !== "far" && !gesture;
  }

  function _plannerEntryVisible(entry, context) {
    if (!entry) return false;
    const band = String(context?.semanticZoomState?.band || "medium").toLowerCase();
    // B7.59.2D — a schedule glyph that survives semantic zoom stays pickable.
    void band;
    if (String(context?.dayLabelMode || "key") === "all") return true;
    const moons = Array.isArray(context?.calendarDisclosure?.moons) ? context.calendarDisclosure.moons : [];
    if (moons.length) return moons.includes(Number(entry.moon));
    const frontMoon = _cameraFacingMoon(context);
    return Number(entry.moon) === Number(frontMoon);
  }

  function colorFor(type, phase, THREE, record = null) {
    if (isPlannerRecord(record)) {
      const workflow = plannerWorkflow(record);
      if (workflow === "codex-of-reality") return new THREE.Color(0xf6d56a);
      if (workflow === "living-phone") return new THREE.Color(0x65d7c5);
      const palette = {
        task:        0x7fd7ff,
        event:       0xf6d56a,
        reminder:    0xff9f80,
        growing:     0x78e08f,
        farming:     0x8ccf72,
        planting:    0x6edb8b,
        harvest:     0xe6bd63,
        watering:    0x70b7e8,
        livestock:   0xc8a77c,
        maintenance: 0xb7c2cc,
        seasonal:    0xb9df72,
        practice:    0xc4a7ff,
        project:     0x65d7c5,
        meeting:     0xb6a5ff,
        school:      0x86b7ff,
        health:      0xff8f9d,
        finance:     0xe4c46b,
        travel:      0x80b8ff,
        milestone:   0xffcf6e,
        observation: 0xd6d6d6,
        home:        0xf0c878,
        family:      0xffa9bb,
        pets:        0xcaa67f,
        food:        0xf0b76e,
        shopping:    0xc9b4ff,
        vehicle:     0x8ebde8,
        construction:0xe0b56d,
        coding:      0x79d7eb,
        writing:     0xe7d293,
        research:    0xa9c6ff,
        creative:    0xd7a6ff,
        cleaning:    0x9fded8,
        appointment: 0xff9ca8,
        community:   0x9ac8ff,
        camping:     0x93cf8d,
        fieldwork:   0x9fd4ad
      };

      return new THREE.Color(
        palette[plannerCategory(record)]
        || 0xf6d56a
      );
    }

    const hex =
      phase === "future"
        ? 0x64d8c7
        : phase === "present"
          ? 0xf6d56a
          : type === "media"
            ? 0xb69cff
            : type === "journey"
              || type === "place"
                ? 0x7fc6e8
                : 0x91a9bd;

    return new THREE.Color(hex);
  }
  function yearWindow(context) {
    const T = root.LivingTimeSphereTemporalStrata; const selected = Number(context.selectedYear || context.model?.year || new Date().getFullYear());
    return T?.yearWindow ? T.yearWindow(selected, T.state.span, T.state.direction) : { start: selected - 12, end: selected + 12, reference: selected, count: 25, years: [] };
  }
  function patternAngle(record) {
    const day = Number(record.temporal?.patternDay);
    if (!Number.isFinite(day)) return null;
    const canonicalDeg = root.LivingTimeSphereModel?.patternAngleForDayOfYear?.(day);
    return Number.isFinite(Number(canonicalDeg))
      ? Number(canonicalDeg) * Math.PI / 180
      : ((day - .5) / 364) * Math.PI * 2;
  }
  function build(context) {
    dispose(state.group); const THREE = context.THREE; if (!THREE || !context.scene) return;
    const group = new THREE.Group(); group.name = "life-atlas-records"; state.group = group;
    state.lastSymbolRevealKey = "";
    const window = yearWindow(context); const T = root.LivingTimeSphereTemporalStrata; const refYear = Number(window.reference);
    _buildPlannerSummaryPoints(context, group, refYear);
    const selectedDay = Number(context.model?.selectedPatternPosition?.dayOfPatternYear || context.model?.todayPatternPosition?.dayOfPatternYear);

    /*
     * Share the same semantic temporal resolution as the
     * Living Onion.
     *
     * Records should never appear to float against a year
     * membrane that semantic zoom has intentionally suppressed.
     */
    const legibility =
      root.LivingTimeSphereTemporalLegibility;

    const semanticBand =
      context.semanticZoomState?.band
      || "medium";

    const legibilityPlan =
      legibility?.resolve
        ? legibility.resolve({
            window,
            selectedYear:
              refYear,
            band:
              semanticBand,
            tier:
              context.tier
              || "high"
          })
        : null;

    const visibleYears =
      legibilityPlan
        ? new Set(
            legibilityPlan.visibleYears
          )
        : null;

    const visible = state.records.filter(r => {
      const y =
        Number(
          r.temporal?.patternYear
        );

      const day =
        Number(
          r.temporal?.patternDay
        );

      const planner = isPlannerRecord(r);
      return (
        Number.isFinite(y)
        && y >= window.start
        && y <= window.end
        && Number.isFinite(day)
        && (
          (!planner && (!visibleYears || visibleYears.has(y)))
        )
      );
    });

    const limit =
      legibility?.recordBudget
        ? legibility.recordBudget({
            tier:
              context.tier
              || "high",
            band:
              semanticBand
          })
        : (
            context.tier === "low"
              ? 220
              : context.tier === "medium"
                ? 500
                : 900
          );
    // B7.34: same-day planner records share one calendar cell but receive tiny
    // deterministic inward lanes so several plans never render as one blob.
    const plannerStackByDay = new Map();
    state.renderedRecordIds = new Set();
    visible.slice(-limit).forEach(record => {
      if (record?.id) state.renderedRecordIds.add(record.id);
      const angle = patternAngle(record); const year = Number(record.temporal.patternYear); if (angle == null) return;
      const strataRadius = T?.radiusForYear ? T.radiusForYear(year, window, T.state.depth) : 1.24;
      // B7.1: current selected-year planner records belong to the calendar band,
      // immediately outside the day-number lane and still inside the sphere.
      // Historical/non-planner records continue to use temporal-strata radii.
      const patternRingRadius = Number(root.LivingTimeSphereM?.SIZES?.patternRing || 1);
      const rail = root.LivingTimeSphereRenderer3d?.getCalendarRailGeometry?.() || {
        plannerMarker: 1.105, connectorStart: 1.072, dayNumber: 1.295
      };
      const calendarBandRadius = patternRingRadius * rail.plannerMarker;
      const dayNumberRadius = patternRingRadius * rail.dayNumber;
      const planner = isPlannerRecord(record);
      const patternDay = Number(record.temporal?.patternDay);
      if (planner && year === refYear) {
        // B7.59.2D — current-year plans are represented once by the batched
        // occupied-day summary field built above, not by duplicate giant sprites.
        return;
      }
      const calendarCell = planner && year === refYear
        ? root.LivingTimeSphereCalendarGeometry?.calendarCell?.(patternDay) || null
        : null;
      // B7.34: current-year planner marks follow the same readable 13×4×7 cell
      // geometry as their day numeral. Astronomy/history retain canonical angles.
      const displayAngle = calendarCell && Number.isFinite(Number(calendarCell.angle))
        ? Number(calendarCell.angle) * Math.PI / 180
        : angle;
      const cellRadius = calendarCell && Number.isFinite(Number(calendarCell.radialFactor))
        ? patternRingRadius * Number(calendarCell.radialFactor)
        : calendarBandRadius;
      const stackKey = planner && year === refYear ? `${year}:${patternDay}` : null;
      const stackIndex = stackKey ? (plannerStackByDay.get(stackKey) || 0) : 0;
      if (stackKey) plannerStackByDay.set(stackKey, stackIndex + 1);
      // B7.59.2B — primary schedule marker takes the former numeral lane.
      // Additional same-day records stack gently inward without changing the
      // calendar angle or the canonical calendarCell used for selection.
      const scheduleMarkerRadius =
        cellRadius
        + patternRingRadius * Number(rail.scheduleSymbolPresentationOffset ?? 0)
        - patternRingRadius
          * Math.min(3, stackIndex)
          * Number(rail.scheduleStackStep ?? 0.018);
      const radius = planner && year === refYear ? scheduleMarkerRadius : strataRadius;
      const phase = year < refYear ? "past" : year > refYear ? "future" : "present";
      const sameDay = patternDay === selectedDay;
      const category = plannerCategory(record);

      // B7.2: planner geometry is a calendar annotation, not a celestial body.
      // Keep it clearly visible but deliberately smaller than Today/Moon markers.
      const size =
        planner
          ? (sameDay ? .024 : (semanticBand === "near" || semanticBand === "detail" ? .016 : .0105))
          : (sameDay ? .026 : .014);

      let geometry;

      if (planner && category === "milestone") {
        geometry = new THREE.OctahedronGeometry(size, 0);
      } else if (
        planner &&
        (category === "event" || category === "seasonal")
      ) {
        geometry = new THREE.TorusGeometry(
          size,
          Math.max(.0035, size * .24),
          context.tier === "low" ? 5 : 7,
          context.tier === "low" ? 10 : 16
        );
      } else if (
        planner &&
        category === "task"
      ) {
        geometry = new THREE.BoxGeometry(
          size * 1.45,
          size * 1.45,
          size * 1.45
        );
      } else {
        geometry = new THREE.SphereGeometry(
          size,
          context.tier === "low" ? 5 : 7,
          context.tier === "low" ? 4 : 6
        );
      }

      const material =
        new THREE.MeshBasicMaterial({
          color:
            colorFor(
              record.type,
              phase,
              THREE,
              record
            ),
          transparent: true,
          opacity:
            planner
              ? (sameDay ? .96 : (semanticBand === "near" || semanticBand === "detail" ? .78 : .48))
              : (sameDay ? .95 : .56),
          depthWrite: false
        });

      const mesh =
        new THREE.Mesh(
          geometry,
          material
        );

      mesh.position.set(
        Math.sin(displayAngle) * radius,
        planner ? (sameDay ? .036 : .022) : (sameDay ? .035 : 0),
        -Math.cos(displayAngle) * radius
      );

      mesh.userData = {
        extension: ID,
        type:
          planner
            ? "living-plan"
            : "life-atlas-record",
        recordId: record.id,
        recordType: record.type,
        planner,
        category,
        title: record.title,
        year,
        patternDay:
          record.temporal.patternDay,
        calendarCell: calendarCell ? {
          moon: calendarCell.moon,
          moonDay: calendarCell.moonDay,
          week: calendarCell.week,
          column: calendarCell.column,
          angle: calendarCell.angle,
          radialFactor: calendarCell.radialFactor
        } : null,
        workflow: planner ? plannerWorkflow(record) : null,
        symbol: planner ? plannerSymbol(record) : null,
        scheduleStackIndex: planner ? stackIndex : 0,
        interactionTarget:
          record.id
      };

      group.add(mesh);

      // B7.37 — every planner marker that survives schedule LOD receives its chosen
      // symbol. Far-away records still remain density-only, so a 260-entry import
      // never creates 260 simultaneous sprites. Textures remain cached by symbol.
      if (planner && year === refYear) {
        const texture = symbolTexture(THREE, plannerSymbol(record));
        if (texture) {
          const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: texture,
            color: colorFor(record.type, phase, THREE, record),
            transparent: true,
            opacity: sameDay ? .96 : .82,
            depthWrite: false,
            depthTest: false
          }));
          const scale = sameDay ? .050 : .037;
          sprite.scale.set(scale, scale, 1);
          sprite.position.copy(mesh.position);
          sprite.position.y += sameDay ? .044 : .030;
          sprite.name = `living-plan-symbol-${record.id}`;
          sprite.userData = { ...mesh.userData, type: "living-plan-symbol" };
          group.add(sprite);
        }
      }

      // B7.4: the glyph stays visually small, but its transparent touch target
      // is finger-sized so scheduled items are reliably selectable on phones.
      if (planner && year === refYear) {
        const hitGeometry = new THREE.SphereGeometry(.036, 6, 5);
        const hitMaterial = new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: .001,
          depthWrite: false,
          depthTest: false
        });
        const hitTarget = new THREE.Mesh(hitGeometry, hitMaterial);
        hitTarget.position.copy(mesh.position);
        hitTarget.name = `living-plan-hit-${record.id}`;
        hitTarget.userData = { ...mesh.userData, type: "living-plan-hit-target" };
        group.add(hitTarget);
      }

      // B7.59.2B: a short local stem now connects the schedule-symbol lane
      // to the numeral presentation lane. The canonical cell itself does not move.
      if (planner && year === refYear) {
        const presentationWeek =
          Math.max(
            1,
            Math.min(
              4,
              Number(calendarCell?.week || 1)
            )
          );
        const dayPresentationRadius =
          patternRingRadius
          * (
              Number(
                rail.dayNumberPresentationWeek1
                ?? 1.320
              )
              + (presentationWeek - 1)
                * Number(
                    rail.dayNumberPresentationWeekStep
                    ?? 0.092
                  )
            );
        const startRadius = radius;
        const endRadius = dayPresentationRadius;
        const start = new THREE.Vector3(
          Math.sin(displayAngle) * startRadius,
          .008,
          -Math.cos(displayAngle) * startRadius
        );
        const end = new THREE.Vector3(
          Math.sin(displayAngle) * endRadius,
          .008,
          -Math.cos(displayAngle) * endRadius
        );
        const connectorGeometry = new THREE.BufferGeometry().setFromPoints([start, end]);
        const connectorMaterial = new THREE.LineBasicMaterial({
          color: colorFor(record.type, phase, THREE, record),
          transparent: true,
          opacity: sameDay ? .82 : (semanticBand === "near" || semanticBand === "detail" ? .52 : .30),
          depthWrite: false
        });
        const connector = new THREE.Line(connectorGeometry, connectorMaterial);
        connector.name = `living-plan-day-link-${record.id}`;
        connector.userData = {
          extension: ID,
          type: "living-plan-day-link",
          recordId: record.id,
          patternDay: record.temporal.patternDay
        };
        group.add(connector);
      }
    });
    context.scene.add(group);
  }
  function formatPlanSchedule(record) {
    const schedule = root.CodexLifeAtlasScheduling?.getSchedule?.(record) || null;
    if (!schedule) return { schedule: null, summary: "Unscheduled", signature: "" };

    const parts = [];
    const date = schedule.startDate || schedule.start?.slice?.(0, 10) || record.temporal?.civilDate || null;
    if (date) parts.push(date);

    if (!schedule.allDay && schedule.start) {
      try {
        parts.push(new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(schedule.start)));
      } catch (_) {}
    } else if (schedule.allDay) {
      parts.push("all day");
    }

    const recurrence = schedule.recurrence || null;
    if (recurrence?.frequency && recurrence.frequency !== "none") {
      const interval = Math.max(1, Number(recurrence.interval) || 1);
      parts.push(interval > 1 ? `every ${interval} ${recurrence.frequency}` : recurrence.frequency);
    }

    const signature = recurrence?.frequency && recurrence.frequency !== "none"
      ? `${recurrence.frequency}:${Math.max(1, Number(recurrence.interval) || 1)}`
      : `day:${record.temporal?.patternDay || "x"}`;

    return { schedule, summary: parts.join(" · "), signature };
  }

  function semanticTargets(context = {}) {
    if (context?.interactionLite) return [];
    const selectedYear = Number(context.selectedYear || context.model?.year || new Date().getFullYear());
    const selectedDay = Number(context.model?.selectedPatternPosition?.dayOfPatternYear || context.model?.todayPatternPosition?.dayOfPatternYear || 1);
    const disclosureKey = String(context?.calendarDisclosure?.key || "");
    const dayMode = String(context?.dayLabelMode || "key");
    const band = String(context?.semanticZoomState?.band || "medium").toLowerCase();
    const cacheKey =
      `${state.revision}|${selectedYear}|${selectedDay}|${dayMode}|${band}|${disclosureKey}`;
    if (cacheKey === state.semanticTargetCacheKey) return state.semanticTargetCache.slice();

    const targets = [];
    const patternRingRadius = Number(root.LivingTimeSphereM?.SIZES?.patternRing || 1);
    const presentationRail =
      root.LivingTimeSphereRenderer3d?.getCalendarRailGeometry?.()
      || {
        dayNumberPresentationWeek1: 1.320,
        dayNumberPresentationWeekStep: 0.092,
        scheduleSymbolPresentationOffset: 0.000,
        scheduleSymbolInset: 0.046,
        scheduleStackStep: 0.018
      };

    // B7.38 — schedule disclosure is day-scoped and camera-driven, just like the
    // day numerals. One summary target per occupied day replaces hundreds of
    // record cards. The label manager decides which front-facing summaries pop.
    for (const [key, summary] of state.plannerSummaryByDay) {
      const [yearText, dayText] = String(key).split(":");
      const year = Number(yearText);
      const patternDay = Number(dayText);
      if (year !== selectedYear || !summary?.count || !Number.isFinite(patternDay)) continue;
      const record = state.recordById.get(summary.primaryRecordId) || null;
      const cell = root.LivingTimeSphereCalendarGeometry?.calendarCell?.(patternDay);
      if (!cell) continue;
      const displayCell =
        root.LivingTimeSphereCalendarGeometry?.calendarDisplayCell?.(patternDay, {
          dayNumberWeek1: presentationRail.dayNumberPresentationWeek1,
          dayNumberWeekStep: presentationRail.dayNumberPresentationWeekStep,
          scheduleInset: presentationRail.scheduleSymbolInset
        }) || null;
      const revealAll = dayMode === "all";
      const disclosedMoons = Array.isArray(context?.calendarDisclosure?.moons)
        ? context.calendarDisclosure.moons
        : [];
      if (!revealAll && patternDay !== selectedDay && disclosedMoons.length && !disclosedMoons.includes(Number(cell.moon))) continue;
      const summarySelected = patternDay === selectedDay;
      if (!summarySelected && band !== "detail") continue;
      const angle = Number(displayCell?.angle ?? cell.angle) * Math.PI / 180;
      const cellRadius = patternRingRadius * Number(cell.radialFactor || 1);
      // B7.59.2D — inspection card shares the same derived schedule/day packet.
      const markerRadius =
        cellRadius
        + patternRingRadius
          * Number(
            presentationRail.scheduleSymbolPresentationOffset
            ?? 0
          )
        + patternRingRadius
          * Number(
              (displayCell?.scheduleRadialFactor ?? cell.radialFactor)
              - Number(cell.radialFactor || 1)
            );
      const scheduleInfo = record ? formatPlanSchedule(record) : null;
      const selected = patternDay === selectedDay;
      const title = summary.primaryTitle || (summary.count > 1 ? `${summary.count} scheduled` : "Living Plan");
      targets.push({
        id: `living-plan-day-${year}-${patternDay}`,
        label: title,
        detail: `Moon ${cell.moon} · Day ${cell.moonDay} · ${summary.count} scheduled${scheduleInfo?.summary ? ` · ${scheduleInfo.summary}` : ""}`,
        statusLabel: summary.count > 1 ? `${summary.count} PLANS` : (record ? plannerStatusLabel(record).replace(/^SCHEDULED\s+/, "") : "SCHEDULED"),
        workflow: summary.primaryWorkflow || (record ? plannerWorkflow(record) : null),
        symbol: summary.primarySymbol || (record ? plannerSymbol(record) : "●"),
        dayScheduleCount: summary.count,
        haloOffset: selected ? 18 : 10,
        haloLane: "agenda-summary",
        kind: "living-plan-summary",
        worldX: Math.sin(angle) * markerRadius,
        worldY: 0.026,
        worldZ: -Math.cos(angle) * markerRadius,
        priority: selected ? 98 : 74,
        showDistance: selected ? 2.15 : 1.30,
        resetDistance: selected ? 2.38 : 1.52,
        detailDistance: selected ? 1.25 : 0.88,
        leader: true,
        interactive: !!summary.primaryRecordId,
        recordId: summary.primaryRecordId,
        patternYear: year,
        patternDay,
        moon: Number(cell.moon),
        moonDay: Number(cell.moonDay),
        category: record ? plannerCategory(record) : null,
        schedule: record ? (root.CodexLifeAtlasScheduling?.getSchedule?.(record) || null) : null,
        patternSignature: scheduleInfo?.signature || null,
        pinned: selected,
        selected
      });
    }

    // Historical/private non-planner context remains available, but with a small
    // semantic budget. It no longer competes with the everyday schedule surface.
    const nonPlannerChildren = (state.group?.children || []).filter(object => {
      const data = object?.userData || {};
      return data.recordId && !data.planner && data.type !== "living-plan-day-points";
    }).slice(-24);
    for (const object of nonPlannerChildren) {
      const data = object?.userData || {};
      const record = state.recordById.get(data.recordId);
      if (!record || !object?.position) continue;
      const privacy = String(record.privacy?.visibility || record.privacy?.scope || "private").toLowerCase();
      const privateRecord = privacy !== "public" && privacy !== "shared";
      targets.push({
        id: `life-atlas-${record.id}`,
        label: privateRecord ? "Private Life Atlas record" : (record.title || `${record.type} record`),
        detail: `${record.type || "record"} · ${record.temporal?.patternYear || "year unavailable"}`,
        kind: "life-atlas-record",
        worldX: object.position.x,
        worldY: object.position.y,
        worldZ: object.position.z,
        priority: 58,
        showDistance: 1.75,
        resetDistance: 2.05,
        detailDistance: 1.28,
        recordId: record.id,
        patternYear: Number(record.temporal?.patternYear) || null,
        patternDay: Number(record.temporal?.patternDay) || null
      });
    }

    state.semanticTargetCacheKey = cacheKey;
    state.semanticTargetCache = targets;
    return targets.slice();
  }

  function _scheduleRuntimeHydration(context) {
    if (state.runtimeLoaded || state.idleLoadHandle != null) return;
    const runtime = root.CodexLifeAtlasRuntime;
    if (!runtime?.recordsForYear && !runtime?.records) return;
    const selectedYear = Number(context?.selectedYear || context?.model?.year || new Date().getFullYear());
    const mobile = (() => { try { return window.innerWidth < 900 || matchMedia?.("(pointer: coarse)")?.matches; } catch { return false; } })();
    const run = async () => {
      state.idleLoadHandle = null;
      try {
        // B7.49: a phone only hydrates non-planner history for the selected year.
        // Desktop may hydrate the semantically visible temporal window. The full
        // repository is never fetched merely because the Sphere mounted.
        let runtimeRecords = [];
        if (runtime.recordsForYears && !mobile) {
          const windowState = yearWindow(context);
          const years = Array.isArray(windowState?.years) ? windowState.years : [selectedYear];
          runtimeRecords = await runtime.recordsForYears(years).catch(() => []);
        } else if (runtime.recordsForYear) {
          runtimeRecords = await runtime.recordsForYear(selectedYear).catch(() => []);
        } else if (!mobile) {
          runtimeRecords = await runtime.records().catch(() => []);
        }
        const merged = new Map(state.records.map(record => [record?.id, record]).filter(([id]) => id));
        for (const record of runtimeRecords || []) if (record?.id) merged.set(record.id, record);
        state.records = Array.from(merged.values());
        state.runtimeLoaded = true;
        _rebuildIndexes();
        state.key = "";
        build(context);
        _syncPlannerSummaryReveal(context);
        context.requestRender?.();
      } catch (_) {}
    };
    // Let the calendar and schedule become interactive first. The timeout is a
    // fallback only; requestIdleCallback can run earlier when the phone is idle.
    if (typeof root.requestIdleCallback === "function") {
      state.idleLoadHandle = root.requestIdleCallback(() => void run(), { timeout: mobile ? 6500 : 3200 });
    } else {
      state.idleLoadHandle = root.setTimeout?.(() => void run(), mobile ? 2400 : 900) ?? 1;
    }
  }

  async function load(context) {
    if (state.loading) return;
    const runtime = root.CodexLifeAtlasRuntime;
    const planner = root.CodexLivingPlanner;
    if (!runtime?.records && !planner?.allPlans && !planner?.plansForYear) return;

    state.loading = true;
    try {
      // B7.49 — first paint reads only the selected Pattern year through the
      // IndexedDB patternYear index. Planner UI/workbench can share the same
      // promise, so a populated calendar no longer triggers repeated getAll().
      const selectedYear = Number(context?.selectedYear || context?.model?.year || new Date().getFullYear());
      const plannerRecords = planner?.plansForYear
        ? await planner.plansForYear(selectedYear).catch(() => [])
        : (planner?.allPlans ? await planner.allPlans().catch(() => []) : []);
      const retainedNonPlanner = state.records.filter(record => !isPlannerRecord(record));
      const merged = new Map();
      for (const record of retainedNonPlanner) if (record?.id) merged.set(record.id, record);
      for (const record of plannerRecords || []) if (record?.id) merged.set(record.id, record);
      state.records = Array.from(merged.values());
      _rebuildIndexes();
      state.key = "";
      build(context);
      _syncPlannerSummaryReveal(context);
      context.requestRender?.();
      _scheduleRuntimeHydration(context);
    } catch (_) {
      // Rendering the base sphere must never fail because Life Atlas is unavailable.
    } finally {
      state.loading = false;
    }
  }
  const extension = {
    id: ID,
    metadata: { version: "1.0.0", purpose: "project private Life Atlas records into temporal year membranes" },
    mount(context) {
      state.context = context;
      void load(context);
      if (!state.changeHandler) {
        state.changeHandler = () => state.context && load(state.context);
        root.addEventListener?.("sof:life-atlas-records-changed", state.changeHandler);
      }
    },
    update(context) {
      const previousYear = Number(state.context?.selectedYear || state.context?.model?.year || 0);
      const nextYear = Number(context?.selectedYear || context?.model?.year || 0);
      state.context = context;
      if (previousYear && nextYear && previousYear !== nextYear) {
        state.runtimeLoaded = false;
        void load(context);
      }
      const T = root.LivingTimeSphereTemporalStrata;
      const key = [context.selectedYear, T?.state?.span, T?.state?.direction, T?.state?.depth, state.revision, context.tier].join("|");
      if (key !== state.key) { state.key = key; build(context); }
      _syncPlannerSummaryReveal(context);
    },
    render(context) {
      // B7.48: camera motion changes only a few shader uniforms. Geometry and
      // the symbol atlas remain stable, so symbol variety no longer adds draw calls.
      _syncPlannerSummaryReveal(context);
    },
    semanticTargets() { return semanticTargets(arguments[0]); },
    pick(context) {
      if (!state.group || !context.raycaster) return null;
      const previousPointThreshold = context.raycaster.params?.Points?.threshold;
      if (context.raycaster.params?.Points) context.raycaster.params.Points.threshold = 0.045;
      const hits = context.raycaster.intersectObjects(state.group.children || [], false);
      if (context.raycaster.params?.Points && previousPointThreshold != null) {
        context.raycaster.params.Points.threshold = previousPointThreshold;
      }
      if (!hits.length) return null;
      for (const hit of hits) {
        const object = hit.object;
        const data = object?.userData || {};
        if (data.type !== "living-plan-day-points") continue;
        const entry = Array.isArray(data.entries) ? data.entries[Number(hit.index)] : null;
        if (!_plannerEntryVisible(entry, context)) continue;
        const record = entry?.recordId ? state.recordById.get(entry.recordId) : null;
        if (!entry || !record) continue;
        return {
          handled: true,
          type: "living-plan",
          label: record.title || "Living Plan",
          position: hit.point ? { x: hit.point.x, y: hit.point.y, z: hit.point.z } : null,
          recordId: record.id,
          recordType: record.type,
          title: record.title,
          summary: record.summary,
          temporal: record.temporal,
          spatial: record.spatial,
          provenance: record.provenance,
          privacy: record.privacy,
          planner: true,
          plannerCategory: plannerCategory(record),
          schedule: root.CodexLifeAtlasScheduling?.getSchedule?.(record) || null,
          dayScheduleCount: Number(entry.count || 1),
          patternDay: Number(entry.patternDay || 0) || null
        };
      }
      const hit = hits.find(candidate => candidate?.object?.userData?.type !== "living-plan-day-points") || null;
      if (!hit) return null;
      const object = hit.object;
      const data = object?.userData || {};
      const record = state.recordById.get(data.recordId);
      if (!record) return null;
      return {
        handled: true,
        type: isPlannerRecord(record) ? "living-plan" : "life-atlas-record",
        label: record.title || `${record.type} record`,
        position: { x: object.position.x, y: object.position.y, z: object.position.z },
        recordId: record.id,
        recordType: record.type,
        title: record.title,
        summary: record.summary,
        temporal: record.temporal,
        spatial: record.spatial,
        provenance: record.provenance,
        privacy: record.privacy,
        planner:
          isPlannerRecord(record),
        plannerCategory:
          isPlannerRecord(record)
            ? plannerCategory(record)
            : null,
        schedule:
          root.CodexLifeAtlasScheduling
            ?.getSchedule?.(record)
            || null
      };
    },
    dispose() {
      dispose(state.group);
      state.group = null;
      state.records = [];
      state.recordById.clear();
      state.plannerByDay.clear();
      state.plannerSummaryByDay.clear();
      state.renderedRecordIds.clear();
      state.semanticTargetCacheKey = "";
      state.semanticTargetCache = [];
      state.lastSymbolRevealKey = "";
      if (state.changeHandler) {
        root.removeEventListener?.("sof:life-atlas-records-changed", state.changeHandler);
        state.changeHandler = null;
      }
    }
  };
  root.LivingTimeSphereExtensionHost?.register?.(extension);
  root.LifeAtlasRecordSphereExtension = Object.freeze({
    id: ID,
    extension,
    plannerDayRecords,
    plannerDaySummary,
    plannerSymbol,
    diagnostics() {
      return Object.freeze({
        records: state.records.length,
        indexedPlannerDays: state.plannerByDay.size,
        renderedRecords: state.renderedRecordIds.size
      });
    }
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
