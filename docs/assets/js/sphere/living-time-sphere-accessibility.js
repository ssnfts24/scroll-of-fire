(() => {
  "use strict";

  // Living Time Sphere Accessibility — generates accessible text descriptions
  // and manages ARIA live region updates.

  function buildYearDescription({ model, comparisonRecord, previousYearRecord } = {}) {
    if (!model) return "No sphere model loaded.";

    const pos   = model.sourceRecord?.equinox?.patternPosition || {};
    const lunar = model.sourceRecord?.equinox?.lunarLayer       || {};
    const offs  = model.sourceRecord?.offsets                   || {};
    const lunar_pct = lunar.illuminationPercent != null ? `${lunar.illuminationPercent}%` : "unknown";

    const lines = [
      `Selected year ${model.year}.`,
      pos.moon != null
        ? `Equinox entered at Moon ${pos.moon} (${pos.moonName}), Day ${pos.day}.`
        : `Equinox fell outside the 364-day count.`,
      `The Passage lasted ${Number(((offs.equinoxToYearGateDays || 0) * 24).toFixed(2))} hours (${Number((offs.equinoxToYearGateDays || 0).toFixed(4))} days) under the selected boundary.`,
      `Lunar marker: ${lunar.phaseName || "unknown phase"} at approximately ${lunar_pct} illumination.`,
      pos.weekGate ? `Week Gate: ${pos.weekGate}.` : "",
      pos.archetype ? `Archetype: ${pos.archetype}.` : ""
    ].filter(Boolean);

    if (previousYearRecord) {
      const prevOffs = previousYearRecord.offsets || {};
      const diffMs   = (offs.equinoxToYearGateMilliseconds || 0) - (prevOffs.equinoxToYearGateMilliseconds || 0);
      const diffHrs  = Number((diffMs / 3600000).toFixed(2));
      lines.push(`Compared with ${previousYearRecord.year}, Passage duration changed by ${diffHrs > 0 ? "+" : ""}${diffHrs} hours.`);
    }

    return lines.join("\n");
  }

  function buildTodayDescription(model) {
    if (!model) return "No sphere model loaded.";
    return [
      `Living Time Sphere — Today view.`,
      buildYearDescription({ model }),
      `Current Pattern angle: ${(model.currentPatternAngle || 0).toFixed(1)}°.`
    ].join("\n");
  }

  function buildPassageDescription(model) {
    if (!model) return "No sphere model loaded.";
    const offs = model.sourceRecord?.offsets || {};
    return [
      `Living Time Sphere — Passage view for ${model.year}.`,
      `Equinox Gate angle: ${model.passageStartAngle.toFixed(1)}°.`,
      `Year Gate angle: ${model.passageEndAngle.toFixed(1)}° (top).`,
      `Passage arc spans ${model.passage?.durationHours?.toFixed(2) || "—"} hours.`,
      buildYearDescription({ model })
    ].join("\n");
  }

  function buildSpiralDescription(spiral) {
    if (!spiral?.years) return "No spiral model loaded.";
    const list = spiral.years.map(y =>
      `Year ${y.year}: spiral angle ${y.yearSpiralAngle.toFixed(1)}°, depth ${y.yearSpiralRadius.toFixed(3)}.`
    ).join("\n");
    return `13-year spiral summary:\n${list}`;
  }

  function buildMarkerDescription(markerType, data) {
    switch (markerType) {
      case "year":
        return `Year ${data.year} equinox marker selected.`;
      case "equinox":
        return `Equinox Gate: ${data.detail || ""}`;
      case "yearGate":
        return `Year Gate (Moon 1, Day 1): ${data.detail || ""}`;
      case "lunar":
        return `Lunar marker: ${data.label || ""}. ${data.detail || ""}`;
      default:
        return `Marker selected: ${data.label || ""}`;
    }
  }

  // Announce a message to screen readers via an ARIA live region.
  function announce(message, { politeness = "polite" } = {}) {
    if (typeof document === "undefined") return;
    let region = document.getElementById("sphere-live-region");
    if (!region) {
      region = document.createElement("div");
      region.id = "sphere-live-region";
      region.setAttribute("role", "status");
      region.setAttribute("aria-live", politeness);
      region.setAttribute("aria-atomic", "true");
      region.className = "visually-hidden";
      document.body.appendChild(region);
    }
    region.setAttribute("aria-live", politeness);
    // Brief delay so screen readers register the change.
    setTimeout(() => { region.textContent = message; }, 50);
  }

  // Populate the accessible text model panel.
  function populateTextModel(containerId, description) {
    if (typeof document === "undefined") return;
    const el = document.getElementById(containerId);
    if (!el) return;
    el.textContent = description;
  }

  globalThis.LivingTimeSphereAccessibility = Object.freeze({
    buildYearDescription,
    buildTodayDescription,
    buildPassageDescription,
    buildSpiralDescription,
    buildMarkerDescription,
    announce,
    populateTextModel
  });
})();
