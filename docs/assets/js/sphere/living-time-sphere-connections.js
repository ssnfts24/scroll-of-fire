(() => {
  "use strict";

  const STYLE_REGISTRY = Object.freeze({
    structural: Object.freeze({ strokeDasharray: "", lineType: "solid", thickness: 1.6, opacity: 0.66 }),
    progression: Object.freeze({ strokeDasharray: "6 5", lineType: "directional", thickness: 1.8, opacity: 0.72 }),
    comparison: Object.freeze({ strokeDasharray: "7 6", lineType: "dashed", thickness: 1.4, opacity: 0.58 }),
    recurrence: Object.freeze({ strokeDasharray: "2 6", lineType: "curved", thickness: 1.1, opacity: 0.4 }),
    witness: Object.freeze({ strokeDasharray: "1 5", lineType: "dotted", thickness: 1.2, opacity: 0.48 }),
  });

  function _connection(id, patch) {
    return Object.freeze({
      id,
      type: patch.type || "pattern",
      sourceMarkerId: patch.sourceMarkerId || null,
      targetMarkerId: patch.targetMarkerId || null,
      relationship: patch.relationship || "",
      strength: typeof patch.strength === "number" ? patch.strength : 1,
      direction: patch.direction || "bidirectional",
      label: patch.label || "",
      source: patch.source || "LivingTimeSphereModel",
      visible: patch.visible !== false,
      selected: !!patch.selected,
      priority: typeof patch.priority === "number" ? patch.priority : 0,
      semanticBands: Array.isArray(patch.semanticBands) && patch.semanticBands.length
        ? Object.freeze(patch.semanticBands.slice())
        : Object.freeze(["far", "medium", "near", "detail"]),
      style: Object.freeze({ ...(STYLE_REGISTRY[patch.style] || STYLE_REGISTRY.structural) }),
    });
  }

  function _filterByMode(items, connectionMode, compact, semanticBand = "medium") {
    if (connectionMode === "off") return [];
    const visible = items
      .filter(item => item.visible !== false)
      .filter(item => !item.semanticBands || item.semanticBands.includes(semanticBand))
      .sort((a, b) => b.priority - a.priority || String(a.id).localeCompare(String(b.id)));
    if (connectionMode === "full") {
      return compact ? visible.slice(0, 12) : visible;
    }
    if (connectionMode === "selected") {
      return visible.filter(item => item.selected);
    }
    if (connectionMode === "custom") {
      return visible;
    }
    return visible.filter(item => item.type !== "witness").slice(0, compact ? 8 : 12);
  }

  function _filterByCategory(items, categories) {
    if (!categories || typeof categories !== "object") return items;
    return items.filter(item => categories[item.type] !== false);
  }

  function buildRegistry({ model, spiral, state } = {}) {
    if (!model) return Object.freeze([]);
    const selected = model.selectedPatternPosition || model.todayPatternPosition || null;
    const today = model.todayPatternPosition || null;
    const items = [];

    if (today?.dayOfPatternYear != null) {
      items.push(_connection("today-core", {
        type: "today",
        sourceMarkerId: "today",
        targetMarkerId: "core",
        relationship: "Today to Pattern Core",
        direction: "outbound",
        label: "Today ↔ Pattern Core",
        style: "structural",
        selected: state?.selectedMarker === "today" || selected?.isToday,
        priority: 35,
        semanticBands: ["medium", "near", "detail"],
      }));
    }

    if (today?.dayOfPatternYear != null
        && selected?.dayOfPatternYear != null
        && Number(today.dayOfPatternYear) !== Number(selected.dayOfPatternYear)) {
      const comparison = model.temporalComparison || globalThis.LivingTimeSphereTemporal?.compareToToday?.(selected, today) || null;
      items.push(_connection(`selected-today-${selected.dayOfPatternYear}`, {
        type: "pattern",
        sourceMarkerId: `day-${selected.dayOfPatternYear}`,
        targetMarkerId: "today",
        relationship: "Selected day compared with Today",
        direction: "bidirectional",
        label: comparison
          ? `Selected ↔ Today · ${comparison.relationshipLabel} · ${Math.abs(comparison.angleDelta).toFixed(1)}°`
          : "Selected day ↔ Today",
        style: "progression",
        selected: true,
        priority: 120,
        semanticBands: ["far", "medium", "near", "detail"],
      }));
    }

    if (selected?.dayOfPatternYear != null) {
      const selectedWeekBoundaryDay = (selected.weekOfMoon || Math.ceil((selected.day || 1) / 7)) * 7;
      const selectedWeekBoundaryDayOfYear = ((selected.moon - 1) * 28) + selectedWeekBoundaryDay;
      items.push(_connection(`selected-core-${selected.dayOfPatternYear}`, {
        type: "pattern",
        sourceMarkerId: `day-${selected.dayOfPatternYear}`,
        targetMarkerId: "core",
        relationship: "Selected day to Pattern Core",
        direction: "outbound",
        label: `Moon ${selected.moon} Day ${selected.day} ↔ Pattern Core`,
        style: "structural",
        selected: true,
        priority: 30,
        semanticBands: ["detail"],
      }));
      if (selected.weekGate?.[0]) {
        items.push(_connection(`selected-weekgate-${selected.dayOfPatternYear}`, {
          type: "calendar",
          sourceMarkerId: `day-${selected.dayOfPatternYear}`,
          targetMarkerId: `weekgate-${selectedWeekBoundaryDayOfYear}`,
          relationship: "Selected day to Week Gate",
          direction: "outbound",
          label: `${selected.weekGate[0]} · Week ${selected.weekOfMoon || Math.ceil((selected.day || 1) / 7)}`,
          style: "comparison",
          selected: true,
          priority: 80,
          semanticBands: ["near", "detail"],
        }));
      }
      if (selected.solar?.angle != null) {
        items.push(_connection(`selected-solar-${selected.dayOfPatternYear}`, {
          type: "solar",
          sourceMarkerId: `day-${selected.dayOfPatternYear}`,
          targetMarkerId: "solar-selected",
          relationship: "Selected day to solar position",
          direction: "outbound",
          label: `Selected day ↔ ${selected.solar.gate || "Solar position"}`,
          style: "progression",
          selected: true,
          priority: 100,
          semanticBands: ["far", "medium", "near", "detail"],
        }));
      }
      if (selected.lunarPhase || selected.lunarIllumination != null) {
        items.push(_connection(`selected-lunar-${selected.dayOfPatternYear}`, {
          type: "lunar",
          sourceMarkerId: `day-${selected.dayOfPatternYear}`,
          targetMarkerId: "lunar-selected",
          relationship: "Selected day to astronomical Moon",
          direction: "outbound",
          label: `Selected day ↔ ${selected.lunarPhase || "Lunar state"}`,
          style: "comparison",
          selected: true,
          priority: 90,
          semanticBands: ["medium", "near", "detail"],
        }));
      }
      if (selected.dayOfPatternYear != null) {
        items.push(_connection(`selected-week-context-${selected.dayOfPatternYear}`, {
          type: "calendar",
          sourceMarkerId: `day-${selected.dayOfPatternYear}`,
          targetMarkerId: `weekgate-${selectedWeekBoundaryDayOfYear}`,
          relationship: "Selected day to active week boundary",
          direction: "bidirectional",
          label: `Selected day ↔ Week ${selected.weekOfMoon || Math.ceil((selected.day || 1) / 7)} boundary`,
          style: "structural",
          selected: true,
          priority: 70,
          semanticBands: ["near", "detail"],
        }));
      }
    }

    if (today?.dayOfPatternYear != null && model.lunarAngle != null) {
      items.push(_connection("today-lunar", {
        type: "lunar",
        sourceMarkerId: "today",
        targetMarkerId: "lunar",
        relationship: "Today to Lunar Position",
        direction: "bidirectional",
        label: "Today ↔ Lunar Position",
        style: "comparison",
        selected: state?.mode === "today",
        priority: 55,
        semanticBands: ["medium", "near", "detail"],
      }));
    }

    if (model.passage?.startAngle != null) {
      items.push(_connection(`passage-${model.year || state?.selectedYear || "active"}`, {
        type: "passage",
        sourceMarkerId: "equinox",
        targetMarkerId: "yearGate",
        relationship: "Equinox Gate to Year Gate",
        direction: "outbound",
        label: "Equinox Gate → Year Gate",
        style: "progression",
        selected: state?.mode === "passage",
        priority: 48,
        semanticBands: ["medium", "near", "detail"],
      }));
      items.push(_connection(`passage-core-${model.year || state?.selectedYear || "active"}`, {
        type: "passage",
        sourceMarkerId: "passageMidpoint",
        targetMarkerId: "core",
        relationship: "Passage midpoint to Pattern Core",
        direction: "bidirectional",
        label: "Passage ↔ Pattern Core",
        style: "structural",
        selected: state?.mode === "passage",
        priority: 28,
        semanticBands: ["detail"],
      }));
    }

    if (state?.mode === "years" && spiral?.years?.length) {
      const currentIndex = spiral.years.findIndex(year => year.year === (state.selectedYear || model.year));
      if (currentIndex > 0) {
        const previous = spiral.years[currentIndex - 1];
        items.push(_connection(`year-prev-${state.selectedYear}`, {
          type: "historical",
          sourceMarkerId: `year-${state.selectedYear}`,
          targetMarkerId: `year-${previous.year}`,
          relationship: "Selected year to previous year",
          direction: "bidirectional",
          label: `${state.selectedYear} ↔ ${previous.year}`,
          style: "comparison",
          selected: true,
          priority: 45,
          semanticBands: ["near", "detail"],
        }));
      }
      if (state?.comparisonYear) {
        items.push(_connection(`year-compare-${state.selectedYear}-${state.comparisonYear}`, {
          type: "historical",
          sourceMarkerId: `year-${state.selectedYear}`,
          targetMarkerId: `year-${state.comparisonYear}`,
          relationship: "Selected year to comparison year",
          direction: "bidirectional",
          label: `${state.selectedYear} ↔ ${state.comparisonYear}`,
          style: "comparison",
          selected: true,
          priority: 40,
          semanticBands: ["detail"],
        }));
      }
    }

    const byMode = _filterByMode(items, state?.connectionMode || "contextual", !!state?.compact, state?.semanticZoom?.band || "medium");
    const byCategory = _filterByCategory(byMode, state?.connectionCategories);
    const maxConnections = Number(state?.semanticZoom?.maxConnections || 0);
    return Object.freeze(maxConnections > 0 ? byCategory.slice(0, maxConnections) : byCategory);
  }

  globalThis.LivingTimeSphereConnections = Object.freeze({
    STYLE_REGISTRY,
    buildRegistry,
  });
})();
