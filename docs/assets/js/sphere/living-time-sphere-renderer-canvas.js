(() => {
  "use strict";

  // Canvas renderer — optional enhancement, same coordinate system as SVG renderer.
  // Falls back gracefully if Canvas is unavailable.

  function assertDeps() {
    if (!globalThis.LivingTimeSphereLayout) throw new Error("LivingTimeSphereRendererCanvas: LivingTimeSphereLayout unavailable");
  }

  function isCanvasSupported() {
    try {
      const c = document.createElement("canvas");
      return !!(c.getContext && c.getContext("2d"));
    } catch { return false; }
  }

  function polarToXY(angle, r, cx, cy) {
    return globalThis.LivingTimeSphereLayout.polarToXY({ angle, r, cx, cy });
  }

  function drawCircle(ctx, cx, cy, r, fill, stroke, strokeWidth) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    if (fill)        { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke)      { ctx.strokeStyle = stroke; ctx.lineWidth = strokeWidth || 1; ctx.stroke(); }
  }

  function drawArc(ctx, startAngle, endAngle, r, cx, cy, stroke, strokeWidth) {
    const arc = globalThis.LivingTimeSphereLayout.buildPassageArc({ startAngle, endAngle, r, cx, cy });
    const startRad = ((arc.startAngle || startAngle) - 90) * Math.PI / 180;
    const endRad   = ((arc.startAngle || startAngle) + arc.sweepDegrees - 90) * Math.PI / 180;
    ctx.beginPath();
    ctx.arc(cx, cy, r, startRad, endRad);
    ctx.strokeStyle = stroke || "rgba(251,191,36,0.8)";
    ctx.lineWidth   = strokeWidth || 3;
    ctx.lineCap     = "round";
    ctx.stroke();
  }

  function renderCanvas({ canvas, model, spiral, layout, visibleLayers, selectedYear } = {}) {
    assertDeps();
    if (!canvas || !isCanvasSupported()) return false;

    const { w, h, cx, cy, rings, dpr } = layout;
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width  = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    const vl = visibleLayers || { pattern: true, passage: true, lunar: true, solar: true, markers: true, spiral: true };

    // Background
    ctx.fillStyle = getComputedStyle(canvas).getPropertyValue("--sphere-bg") || "#0a0a14";
    drawCircle(ctx, cx, cy, rings.outerBorder, ctx.fillStyle, "rgba(255,255,255,0.15)", 1.5);

    // Pattern ring
    if (vl.pattern) {
      drawCircle(ctx, cx, cy, rings.patternRing, null, "rgba(255,255,255,0.2)", 2);

      // Moon sectors
      if (model?.moonSectors) {
        for (const s of model.moonSectors) {
          const startRad = (s.startAngle - 90) * Math.PI / 180;
          const endRad   = (s.endAngle   - 90) * Math.PI / 180;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, rings.moonSectors, startRad, endRad);
          ctx.closePath();
          ctx.fillStyle   = s.active ? "rgba(220,160,80,0.25)" : "rgba(255,255,255,0.04)";
          ctx.strokeStyle = "rgba(255,255,255,0.15)";
          ctx.lineWidth   = 1;
          ctx.fill();
          ctx.stroke();
        }
      }
    }

    // Solar axis
    if (vl.solar) {
      const p1 = polarToXY(0,   rings.solarAxis, cx, cy);
      const p2 = polarToXY(180, rings.solarAxis, cx, cy);
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = "rgba(255,220,80,0.3)";
      ctx.lineWidth   = 1;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Spiral path
    if (vl.spiral && spiral?.years?.length) {
      ctx.beginPath();
      spiral.years.forEach((y, i) => {
        const r = rings.spiralInner + (rings.spiralOuter - rings.spiralInner) * y.yearSpiralRadius;
        const p = polarToXY(y.yearSpiralAngle % 360, r, cx, cy);
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      });
      ctx.strokeStyle = "rgba(100,200,180,0.4)";
      ctx.lineWidth   = 1.5;
      ctx.stroke();
    }

    // Passage arc
    if (vl.passage && model?.passage) {
      drawArc(ctx, model.passage.startAngle, model.passage.endAngle, rings.passageArc, cx, cy, "rgba(251,191,36,0.8)", 3);
    }

    // Lunar orbit ring and marker
    if (vl.lunar && model) {
      drawCircle(ctx, cx, cy, rings.lunarOrbit, null, "rgba(180,180,255,0.2)", 1);
      const lp = polarToXY(model.lunarAngle, rings.lunarOrbit, cx, cy);
      drawCircle(ctx, lp.x, lp.y, 6, "rgba(180,180,255,0.8)", "#0a0a14", 1.5);
    }

    // Annual markers
    if (vl.markers && spiral?.years) {
      for (const y of spiral.years) {
        const p = polarToXY(y.equinoxMarkerAngle, rings.annualMarkers, cx, cy);
        const r = y.year === selectedYear ? 6 : 4;
        const fill = y.year === selectedYear ? "rgba(251,191,36,1)" : "rgba(255,255,255,0.5)";
        drawCircle(ctx, p.x, p.y, r, fill, null);
      }
    }

    // Equinox gate and year gate markers
    if (model) {
      const eqp = polarToXY(model.markers.equinoxGate.angle, rings.patternRing, cx, cy);
      drawCircle(ctx, eqp.x, eqp.y, 7, "rgba(251,191,36,0.9)", "#0a0a14", 2);
      const ygp = polarToXY(model.markers.yearGate.angle, rings.patternRing, cx, cy);
      drawCircle(ctx, ygp.x, ygp.y, 7, "rgba(100,255,180,0.9)", "#0a0a14", 2);
    }

    // Center
    drawCircle(ctx, cx, cy, 4, "rgba(255,255,255,0.6)", null);

    return true;
  }

  globalThis.LivingTimeSphereRendererCanvas = Object.freeze({ renderCanvas, isCanvasSupported });
})();
