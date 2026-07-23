(() => {
  "use strict";

  // SVG renderer for the Living Time Sphere.
  // Takes a sphere model and layout, produces an SVG element string or live SVGElement.
  // Does not alter coordinates — always delegates to LivingTimeSphereLayout.

  function assertDeps() {
    if (!globalThis.LivingTimeSphereLayout) throw new Error("LivingTimeSphereRendererSvg: LivingTimeSphereLayout unavailable");
  }

  function esc(str) {
    return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function polarToXY(angle, r, cx, cy) {
    return globalThis.LivingTimeSphereLayout.polarToXY({ angle, r, cx, cy });
  }

  // Build an SVG arc path string.
  function arcPath(startAngle, endAngle, r, cx, cy) {
    const arc = globalThis.LivingTimeSphereLayout.buildPassageArc({ startAngle, endAngle, r, cx, cy });
    return `M ${arc.startX} ${arc.startY} A ${r} ${r} 0 ${arc.largeArcFlag} 1 ${arc.endX} ${arc.endY}`;
  }

  function renderMoonSectors(sectors, rings, cx, cy) {
    return sectors.map(s => {
      const { x: x1, y: y1 } = polarToXY(s.startAngle, rings.moonSectors, cx, cy);
      const { x: x2, y: y2 } = polarToXY(s.endAngle,   rings.moonSectors, cx, cy);
      const { x: cx2, y: cy2 } = polarToXY((s.startAngle + s.endAngle) / 2, rings.moonDayPoints - 8, cx, cy);
      const large = (s.endAngle - s.startAngle) > 180 ? 1 : 0;
      const pathD = `M ${cx} ${cy} L ${x1} ${y1} A ${rings.moonSectors} ${rings.moonSectors} 0 ${large} 1 ${x2} ${y2} Z`;
      const fill  = s.active ? "var(--sphere-moon-active, rgba(220,160,80,0.25))" : "var(--sphere-moon-fill, rgba(255,255,255,0.04))";
      const stroke = "var(--sphere-moon-stroke, rgba(255,255,255,0.15))";
      return `<path class="sphere-moon-sector${s.active ? " sphere-moon-active" : ""}" d="${esc(pathD)}" fill="${fill}" stroke="${stroke}" stroke-width="1" role="img" aria-label="Moon ${s.moonNumber}">
        <title>Moon ${s.moonNumber}</title>
      </path>
      <text class="sphere-moon-label" x="${cx2}" y="${cy2}" text-anchor="middle" dominant-baseline="middle" font-size="9" fill="var(--sphere-label, rgba(255,255,255,0.5))" pointer-events="none">${s.moonNumber}</text>`;
    }).join("\n");
  }

  function renderPassageArc(passage, rings, cx, cy, visible) {
    if (!visible) return "";
    const d = arcPath(passage.startAngle, passage.endAngle, rings.passageArc, cx, cy);
    return `<path class="sphere-passage-arc" d="${esc(d)}" fill="none" stroke="var(--sphere-passage, rgba(251,191,36,0.8))" stroke-width="3" stroke-linecap="round" role="img" aria-label="Equinox Passage arc">
      <title>Equinox Passage: ${esc(String(passage.durationDays || 0))} days</title>
    </path>`;
  }

  function renderLunarOrbit(lunarAngle, rings, cx, cy, visible) {
    if (!visible) return "";
    const { x, y } = polarToXY(lunarAngle, rings.lunarOrbit, cx, cy);
    return `<circle class="sphere-lunar-orbit-ring" cx="${cx}" cy="${cy}" r="${rings.lunarOrbit}" fill="none" stroke="var(--sphere-lunar-ring, rgba(180,180,255,0.2))" stroke-width="1" />
    <circle class="sphere-lunar-marker" cx="${x}" cy="${y}" r="6" fill="var(--sphere-lunar, rgba(180,180,255,0.8))" stroke="var(--sphere-bg, #0a0a14)" stroke-width="1.5" role="img" aria-label="Lunar marker" tabindex="0">
      <title>Lunar cycle position</title>
    </circle>`;
  }

  function renderAnnualMarkers(spiral, rings, cx, cy, selectedYear, visible) {
    if (!visible || !spiral?.years) return "";
    return spiral.years.map(y => {
      const { x, y: yCoord } = polarToXY(y.equinoxMarkerAngle, rings.annualMarkers, cx, cy);
      const isSelected = y.year === selectedYear;
      const r = isSelected ? 6 : 4;
      const fill = isSelected ? "var(--sphere-selected, rgba(251,191,36,1))" : "var(--sphere-annual, rgba(255,255,255,0.5))";
      return `<circle class="sphere-annual-marker${isSelected ? " sphere-annual-selected" : ""}" cx="${x}" cy="${yCoord}" r="${r}" fill="${fill}" data-year="${y.year}" tabindex="0" role="button" aria-label="Year ${y.year} equinox marker" aria-pressed="${isSelected}">
        <title>${y.year}</title>
      </circle>`;
    }).join("\n");
  }

  function renderSpiralPath(spiral, rings, cx, cy, visible) {
    if (!visible || !spiral?.years?.length) return "";
    const pts = spiral.years.map(y => {
      const r = rings.spiralInner + (rings.spiralOuter - rings.spiralInner) * y.yearSpiralRadius;
      return polarToXY(y.yearSpiralAngle % 360, r, cx, cy);
    });
    const d = "M " + pts.map(p => `${p.x} ${p.y}`).join(" L ");
    return `<path class="sphere-spiral-path" d="${esc(d)}" fill="none" stroke="var(--sphere-spiral, rgba(100,200,180,0.4))" stroke-width="1.5" />`;
  }

  function renderEquinoxGate(model, rings, cx, cy) {
    const { x, y } = polarToXY(model.markers.equinoxGate.angle, rings.patternRing, cx, cy);
    return `<circle class="sphere-equinox-marker" cx="${x}" cy="${y}" r="7" fill="var(--sphere-equinox, rgba(251,191,36,0.9))" stroke="var(--sphere-bg, #0a0a14)" stroke-width="2" tabindex="0" role="button" aria-label="${esc(model.markers.equinoxGate.label)}">
      <title>${esc(model.markers.equinoxGate.label)}</title>
    </circle>`;
  }

  function renderYearGate(model, rings, cx, cy) {
    const { x, y } = polarToXY(model.markers.yearGate.angle, rings.patternRing, cx, cy);
    return `<circle class="sphere-year-gate-marker" cx="${x}" cy="${y}" r="7" fill="var(--sphere-yeargate, rgba(100,255,180,0.9))" stroke="var(--sphere-bg, #0a0a14)" stroke-width="2" tabindex="0" role="button" aria-label="${esc(model.markers.yearGate.label)}">
      <title>${esc(model.markers.yearGate.label)}</title>
    </circle>`;
  }

  function renderPatternRing(rings, cx, cy) {
    return `<circle class="sphere-pattern-ring" cx="${cx}" cy="${cy}" r="${rings.patternRing}" fill="none" stroke="var(--sphere-pattern-ring, rgba(255,255,255,0.2))" stroke-width="2" />`;
  }

  function renderSolarAxis(rings, cx, cy) {
    const { x: x1, y: y1 } = polarToXY(0,   rings.solarAxis, cx, cy);
    const { x: x2, y: y2 } = polarToXY(180, rings.solarAxis, cx, cy);
    return `<line class="sphere-solar-axis" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--sphere-solar, rgba(255,220,80,0.3))" stroke-width="1" stroke-dasharray="4 4" />`;
  }

  function renderOuterBorder(rings, cx, cy) {
    return `<circle class="sphere-outer-border" cx="${cx}" cy="${cy}" r="${rings.outerBorder}" fill="var(--sphere-bg, #0a0a14)" stroke="var(--sphere-border, rgba(255,255,255,0.15))" stroke-width="1.5" />`;
  }

  function renderCenterPoint(cx, cy) {
    return `<circle class="sphere-center" cx="${cx}" cy="${cy}" r="4" fill="var(--sphere-center, rgba(255,255,255,0.6))" aria-hidden="true" />`;
  }

  // Build the complete SVG string for the sphere.
  function buildSvgString({ model, spiral, layout, visibleLayers, selectedYear, viewMode } = {}) {
    assertDeps();

    const { w, h, cx, cy, rings } = layout;
    const vl = visibleLayers || {
      pattern: true, passage: true, lunar: true, solar: true,
      markers: true, recurrence: false, spiral: true
    };

    const parts = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" class="living-time-sphere-svg sphere-mode-${esc(viewMode || "today")}" role="img" aria-label="Living Time Sphere — ${esc(String(selectedYear || model?.year || ""))}">`,
      `<title>Living Time Sphere</title>`,
      `<desc>Interactive sphere showing 13 Moon Pattern structure and astronomical cycles.</desc>`,
      renderOuterBorder(rings, cx, cy),
      vl.pattern  ? renderPatternRing(rings, cx, cy) : "",
      vl.pattern  ? renderMoonSectors(model?.moonSectors || [], rings, cx, cy) : "",
      vl.solar    ? renderSolarAxis(rings, cx, cy) : "",
      vl.spiral   ? renderSpiralPath(spiral, rings, cx, cy, vl.spiral) : "",
      vl.passage  ? renderPassageArc(model?.passage  || {}, rings, cx, cy, vl.passage) : "",
      vl.lunar    ? renderLunarOrbit(model?.lunarAngle || 0, rings, cx, cy, vl.lunar) : "",
      vl.markers  ? renderAnnualMarkers(spiral, rings, cx, cy, selectedYear, vl.markers) : "",
      model        ? renderEquinoxGate(model, rings, cx, cy) : "",
      model        ? renderYearGate(model, rings, cx, cy) : "",
      renderCenterPoint(cx, cy),
      `</svg>`
    ];

    return parts.filter(Boolean).join("\n");
  }

  // Render into a container DOM element.
  function renderInto(container, { model, spiral, layout, visibleLayers, selectedYear, viewMode } = {}) {
    assertDeps();
    if (!container) return;
    const svg = buildSvgString({ model, spiral, layout, visibleLayers, selectedYear, viewMode });
    container.innerHTML = svg;

    // Wire marker click events.
    container.querySelectorAll("[data-year]").forEach(el => {
      el.addEventListener("click", () => {
        const y = Number(el.dataset.year);
        container.dispatchEvent(new CustomEvent("sphere:year-select", { detail: { year: y }, bubbles: true }));
      });
      el.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          el.click();
        }
      });
    });
  }

  globalThis.LivingTimeSphereRendererSvg = Object.freeze({ buildSvgString, renderInto });
})();
