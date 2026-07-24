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
      style: Object.freeze({ ...(STYLE_REGISTRY[patch.style] || STYLE_REGISTRY.structural) }),
    });
  }

  function _filterByMode(items, connectionMode, compact) {
    if (connectionMode === "off") return [];
    const visible = items.filter(item => item.visible !== false);
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
      }));
    }

    if (selected?.dayOfPatternYear != null) {
      items.push(_connection(`selected-core-${selected.dayOfPatternYear}`, {
        type: "pattern",
        sourceMarkerId: `day-${selected.dayOfPatternYear}`,
        targetMarkerId: "core",
        relationship: "Selected day to Pattern Core",
        direction: "outbound",
        label: `Moon ${selected.moon} Day ${selected.day} ↔ Pattern Core`,
        style: "structural",
        selected: true,
      }));
      if (selected.weekGate?.[0]) {
        items.push(_connection(`selected-weekgate-${selected.dayOfPatternYear}`, {
          type: "pattern",
          sourceMarkerId: `day-${selected.dayOfPatternYear}`,
          targetMarkerId: `weekgate-${selected.weekOfMoon || Math.ceil((selected.day || 1) / 7)}`,
          relationship: "Selected day to Week Gate",
          direction: "outbound",
          label: `${selected.weekGate[0]} ↔ Moon ${selected.moon} Day ${selected.day}`,
          style: "comparison",
          selected: true,
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
        }));
      }
    }

    return Object.freeze(_filterByMode(items, state?.connectionMode || "contextual", !!state?.compact));
  }

  globalThis.LivingTimeSphereConnections = Object.freeze({
    STYLE_REGISTRY,
    buildRegistry,
  });
})();
