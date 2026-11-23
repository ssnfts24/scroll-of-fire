(() => {
  "use strict";

  // Front Door §d — the keeper's one-tap share (Nov 23, 2026).
  //
  // A small companion surface on the Observatory: one tap makes a
  // clean picture of the keeper's own day — or their year — as it
  // truly stands on the Sphere, captioned with the day's true name
  // from the temporal cursor, ready to save or send.
  //
  // The capture uses the proven route: the 3D renderer's own
  // exportPng() (a plain canvas grab reads blank —
  // preserveDrawingBuffer is off). If the 3D renderer is not the
  // live view, it falls back to the Observatory's own SVG export,
  // which carries the same caption.
  //
  // Fences: the picture is made on this device, from this keeper's
  // own view. Nothing is uploaded by the making of it; nothing is
  // posted for them. The share sheet, where the device offers one,
  // is the keeper's own act. No protected Sphere file is touched —
  // this module reads only public globals (SOFTemporalCursor,
  // PatternCalendarData, LivingTimeSphereRenderer3d,
  // LivingTimeSphereExport) and drives only its own buttons.

  const SIZE = 1080;

  function coordinate() {
    try {
      return globalThis.SOFTemporalCursor?.getCoordinate?.() || null;
    } catch {
      return null;
    }
  }

  function dayLabel() {
    const c = coordinate()?.remnant13Moons;
    if (!c) return null;
    if (c.moon && c.moonDay) {
      const names = globalThis.PatternCalendarData?.moonNames || [];
      const name = names[c.moon - 1];
      return `Moon ${c.moon}${name ? ` · ${name}` : ""} — Day ${c.moonDay} · Pattern Day ${c.patternDay}`;
    }
    if (c.patternDay) return `Pattern Day ${c.patternDay} — a day outside the moons`;
    return null;
  }

  function yearLabel() {
    const iso = coordinate()?.gregorian?.isoDate;
    const year = typeof iso === "string" ? iso.slice(0, 4) : "";
    return year ? `The year as it stands — ${year}` : "The year as it stands";
  }

  function captureDataUrl() {
    try {
      return globalThis.LivingTimeSphereRenderer3d?.exportPng?.({ format: "square" }) || null;
    } catch {
      return null;
    }
  }

  // Frame the raw capture the way the Observatory's own export
  // frames it: dark ground, the sphere centred, a title above and
  // the caption below.
  function framePicture(dataUrl, title, label) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no 2d context"));
        ctx.fillStyle = "#0a0a14";
        ctx.fillRect(0, 0, SIZE, SIZE);
        const margin = 60;
        const size = SIZE - margin * 2;
        ctx.drawImage(img, margin, margin, size, size);
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.font = "bold 32px system-ui, sans-serif";
        ctx.fillText(title, SIZE / 2, margin / 2 + 16);
        if (label) {
          ctx.font = "22px system-ui, sans-serif";
          ctx.fillStyle = "rgba(255,255,255,0.65)";
          ctx.fillText(label, SIZE / 2, SIZE - margin / 2 - 34);
        }
        ctx.font = "18px system-ui, sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.fillText("CodexOfReality.org", SIZE / 2, SIZE - margin / 2);
        canvas.toBlob(
          blob => (blob ? resolve(blob) : reject(new Error("empty picture"))),
          "image/png"
        );
      };
      img.onerror = () => reject(new Error("capture unreadable"));
      img.src = dataUrl;
    });
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function makePicture(kind, status) {
    const isDay = kind === "day";
    const label = isDay ? dayLabel() : yearLabel();
    const title = isDay ? "My day on the Sphere" : "My year on the Sphere";
    const filename = isDay ? "my-day-on-the-sphere.png" : "my-year-on-the-sphere.png";

    const dataUrl = captureDataUrl();
    if (!dataUrl) {
      // The 3D view is not the live one — hand the tap to the
      // Observatory's own export, which draws the 2D sphere with
      // the same caption. Still one tap, still the true picture.
      const exporter = globalThis.LivingTimeSphereExport;
      const container = document.getElementById("sphere-container");
      if (exporter && container && container.querySelector("svg")) {
        exporter.exportPng({ svgContainer: container, format: "square", label: label || title });
        status.textContent = "Your picture is being made by the Observatory's own export — nothing was uploaded.";
      } else {
        status.textContent = "The Sphere is still waking up — give it a moment and tap again.";
      }
      return;
    }

    status.textContent = "Making your picture…";
    let blob;
    try {
      blob = await framePicture(dataUrl, title, label);
    } catch {
      status.textContent = "The picture would not frame itself — the Sphere's own Export PNG button will still make one.";
      return;
    }

    const file = typeof File !== "undefined" ? new File([blob], filename, { type: "image/png" }) : null;
    if (file && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
      try {
        await navigator.share({ files: [file], title });
        status.textContent = "Shared by your own hand — this page uploaded nothing.";
        return;
      } catch (err) {
        if (err && err.name === "AbortError") {
          status.textContent = "Share closed — nothing was sent. Tap again whenever you like.";
          return;
        }
        // Any other share failure falls through to a plain save.
      }
    }
    download(blob, filename);
    status.textContent = "Your picture is saved on this device — send it wherever you like. Nothing was uploaded.";
  }

  function mount() {
    if (document.getElementById("front-door-share")) return true;
    const anchor = document.getElementById("sphere-export-png");
    const section = anchor?.closest(".sphere-sidebar-section");
    if (!anchor || !section || !section.parentNode) return false;

    const wrap = document.createElement("div");
    wrap.className = "sphere-sidebar-section";
    wrap.id = "front-door-share";
    wrap.innerHTML = `
      <p class="sphere-share-title" style="margin:0 0 .5rem;font-weight:600;">Share your Sphere</p>
      <div class="sphere-actions">
        <button class="sphere-btn" type="button" data-fd-share="day">A picture of my day</button>
        <button class="sphere-btn" type="button" data-fd-share="year">A picture of my year</button>
      </div>
      <p class="sphere-share-status" role="status" aria-live="polite" style="margin:.5rem 0 0;font-size:.85em;opacity:.8;">Your day as it truly stands — made here, on your device.</p>`;

    section.parentNode.insertBefore(wrap, section.nextSibling);
    const status = wrap.querySelector(".sphere-share-status");
    wrap.querySelectorAll("[data-fd-share]").forEach(btn => {
      btn.addEventListener("click", () => makePicture(btn.getAttribute("data-fd-share"), status));
    });
    return true;
  }

  // The sidebar is static markup, but the UI module may rebuild
  // around it — try at once, then a few gentle retries.
  if (!mount()) {
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (mount() || tries >= 20) clearInterval(timer);
    }, 500);
  }
})();
