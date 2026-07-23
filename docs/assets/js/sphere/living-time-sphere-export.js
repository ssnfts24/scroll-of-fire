(() => {
  "use strict";

  // Living Time Sphere Export — static image and data exports.

  const FORMATS = Object.freeze({
    square:   Object.freeze({ width: 1080, height: 1080 }),
    portrait: Object.freeze({ width: 1080, height: 1350 }),
    story:    Object.freeze({ width: 1080, height: 1920 })
  });

  function resolveFormat(name) {
    return FORMATS[name] || FORMATS.square;
  }

  // Export sphere model as JSON.
  function exportModelJSON(model) {
    const json = JSON.stringify(
      Object.assign({}, model, { sourceRecord: undefined }), // exclude large source reference
      null, 2
    );
    downloadBlob(json, `sphere-model-${model.year || "export"}.json`, "application/json");
  }

  // Export sphere and alignment together.
  function exportCombinedJSON({ model, alignmentRecord, spiral }) {
    const payload = {
      sphereVersion:    globalThis.LivingTimeSphereVersion?.version,
      alignmentVersion: globalThis.AlignmentVersion?.alignmentLedgerVersion,
      sphere:           model,
      alignment:        alignmentRecord,
      spiral
    };
    downloadBlob(JSON.stringify(payload, null, 2), `sphere-combined-${model?.year || "export"}.json`, "application/json");
  }

  // Export the SVG string as a downloadable .svg file.
  function exportSvg(svgString, filename) {
    const full = `<?xml version="1.0" encoding="UTF-8"?>\n${svgString}`;
    downloadBlob(full, filename || "sphere.svg", "image/svg+xml");
  }

  // Export the SVG (with branding) as a PNG via a Canvas.
  function exportPng({ svgContainer, format, year, viewMode, label } = {}) {
    if (typeof document === "undefined") return;
    const fmt = resolveFormat(format);
    const canvas = document.createElement("canvas");
    canvas.width  = fmt.width;
    canvas.height = fmt.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background
    ctx.fillStyle = "#0a0a14";
    ctx.fillRect(0, 0, fmt.width, fmt.height);

    // Try to draw the sphere SVG content into the canvas.
    const svgEl = svgContainer?.querySelector("svg");
    if (svgEl) {
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const img     = new Image();
      const svgBlob = new Blob([svgData], { type: "image/svg+xml" });
      const url     = URL.createObjectURL(svgBlob);
      img.onload = () => {
        // Center the sphere.
        const margin = 60;
        const size   = Math.min(fmt.width, fmt.height) - margin * 2;
        ctx.drawImage(img, (fmt.width - size) / 2, margin, size, size);

        // Branding and legend.
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.font      = "bold 32px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`Living Time Sphere${year ? ` — ${year}` : ""}`, fmt.width / 2, margin / 2 + 16);

        if (label) {
          ctx.font      = "20px system-ui, sans-serif";
          ctx.fillStyle = "rgba(255,255,255,0.6)";
          ctx.fillText(label, fmt.width / 2, fmt.height - margin / 2 - 32);
        }

        ctx.font      = "18px system-ui, sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.fillText("CodexOfReality.org", fmt.width / 2, fmt.height - margin / 2);
        ctx.fillText(`sphere/${globalThis.LivingTimeSphereVersion?.version || "1.0.0"}`, fmt.width / 2, fmt.height - 16);

        canvas.toBlob(blob => {
          if (!blob) return;
          const a = document.createElement("a");
          a.href     = URL.createObjectURL(blob);
          a.download = `sphere-${year || "export"}-${format || "square"}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }, "image/png");

        URL.revokeObjectURL(url);
      };
      img.src = url;
    }
  }

  function downloadBlob(content, filename, mimeType) {
    if (typeof document === "undefined") return;
    const blob = new Blob([content], { type: mimeType });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  globalThis.LivingTimeSphereExport = Object.freeze({
    FORMATS,
    resolveFormat,
    exportModelJSON,
    exportCombinedJSON,
    exportSvg,
    exportPng,
    downloadBlob
  });
})();
