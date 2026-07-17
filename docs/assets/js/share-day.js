(() => {
  "use strict";

  const BRAND_LINE = "CodexOfReality.org/moons";
  const BASE_HASHTAGS = "#Remnant13Moons #13Moons #LivingCalendar #CodexOfReality";
  const CANVAS_DIMS = {
    square: { width: 1080, height: 1080, label: "Square" },
    story: { width: 1080, height: 1920, label: "Story" }
  };

  const MOON_THEMES = {
    1:  { accent: "#6FE7FF", glow: "#1f4f64", symbol: "✶", atmosphere: ["#040912", "#0a1e33"] },
    2:  { accent: "#B1C7FF", glow: "#3d4f7a", symbol: "☵", atmosphere: ["#060913", "#15213f"] },
    3:  { accent: "#7AF3FF", glow: "#1d5e66", symbol: "☲", atmosphere: ["#030911", "#0b2d39"] },
    4:  { accent: "#7BF3B8", glow: "#1f6045", symbol: "◍", atmosphere: ["#040a0f", "#0e3122"] },
    5:  { accent: "#FFD27A", glow: "#6a4d1f", symbol: "☉", atmosphere: ["#0a0906", "#32220d"] },
    6:  { accent: "#A7FFCF", glow: "#275f4d", symbol: "✦", atmosphere: ["#050a0a", "#12302c"] },
    7:  { accent: "#D5B6FF", glow: "#523875", symbol: "⬡", atmosphere: ["#08070f", "#24163b"] },
    8:  { accent: "#A8FFD9", glow: "#266854", symbol: "☾", atmosphere: ["#040a0b", "#10332f"] },
    9:  { accent: "#FFBC6F", glow: "#6b401f", symbol: "◯", atmosphere: ["#0a0806", "#331d10"] },
    10: { accent: "#A2FFD1", glow: "#2d6a54", symbol: "✧", atmosphere: ["#040a09", "#12312a"] },
    11: { accent: "#A8B8FF", glow: "#35467a", symbol: "✺", atmosphere: ["#050812", "#162544"] },
    12: { accent: "#FFD7A8", glow: "#6f4a2a", symbol: "☰", atmosphere: ["#0a0906", "#372414"] },
    13: { accent: "#9DDAFF", glow: "#295174", symbol: "◌", atmosphere: ["#040913", "#10304a"] }
  };

  const MOON_ARTWORK = {
    1: "assets/img/moons/moons/moon-01-seed-flame.webp",
    2: "assets/img/moons/moons/moon-02-root-waters.webp",
    3: "assets/img/moons/moons/moon-03-breath-gate.webp",
    4: "assets/img/moons/moons/moon-04-stone-witness.webp",
    5: "assets/img/moons/moons/moon-05-living-word.webp",
    6: "assets/img/moons/moons/moon-06-fire-trial.webp",
    7: "assets/img/moons/moons/moon-07-crown-balance.webp",
    8: "assets/img/moons/moons/moon-08-deep-mirror.webp",
    9: "assets/img/moons/moons/moon-09-return-path.webp",
    10: "assets/img/moons/moons/moon-10-builders-hand.webp",
    11: "assets/img/moons/moons/moon-11-star-remembrance.webp",
    12: "assets/img/moons/moons/moon-12-river-of-signs.webp",
    13: "assets/img/moons/moons/moon-13-completion-seal.webp"
  };

  const state = {
    modal: null,
    trigger: null,
    currentFormat: "square",
    options: {
      includePhase: true,
      includeMovement: true,
      includeSunset: false
    },
    lastDetail: null,
    currentShareState: null,
    cache: new Map(),
    artworkCache: new Map(),
    objectUrls: new Set(),
    inertedNodes: []
  };

  function clampText(value, max = 180) {
    const normalized = String(value || "").replace(/\s+/g, " ").trim();
    return normalized.length > max ? normalized.slice(0, max - 1) + "…" : normalized;
  }

  function safeISO(iso) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(iso || "")) ? String(iso) : "";
  }

  function toTitleDate(iso) {
    if (!safeISO(iso)) return "";
    const [year, month, day] = iso.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC"
    }).format(date);
  }

  function getTodayISO() {
    try {
      if (window.SOFCalendar && typeof window.SOFCalendar.todayISO === "function") {
        return window.SOFCalendar.todayISO(window.SOFCalendar.getTZ?.() || Intl.DateTimeFormat().resolvedOptions().timeZone);
      }
    } catch {}
    const now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0")
    ].join("-");
  }

  function buildDeepLink(isoDate) {
    const safeDate = safeISO(isoDate);
    const url = new URL("./moons.html", window.location.href);
    if (safeDate) url.searchParams.set("date", safeDate);
    return url.toString();
  }

  function track(eventName, payload = {}) {
    if (typeof window.gtag === "function") {
      window.gtag("event", eventName, {
        event_category: "share_day",
        event_label: payload.format || "unknown",
        method: payload.method || "",
        non_interaction: false
      });
    }
  }

  function recordShareAction(type, shareState, detail = {}) {
    if (!window.CodexMemory || typeof window.CodexMemory.recordAction !== "function") return;
    window.CodexMemory.recordAction({
      type,
      label: `Share Day · ${type}`,
      path: shareState?.link || "",
      meta: {
        status: detail.status || "",
        format: detail.format || state.currentFormat,
        method: detail.method || "",
        sharedDate: shareState?.isoDate || "",
        source: shareState?.source || ""
      }
    });
  }

  function getMoonTheme(moonNumber) {
    return MOON_THEMES[Number(moonNumber)] || MOON_THEMES[1];
  }

  function fromMoonEngine() {
    const engine = window.ScrollOfFireMoons;
    if (!engine || typeof engine.effectiveContext !== "function") return null;

    const context = engine.effectiveContext();
    const detail = state.lastDetail || {};
    const info = context?.info || detail.info || {};
    const moon = info.moon || {};
    const inside = !!info.inside;
    const moonNumber = inside ? Number(moon.idx) : Number(detail.info?.moon?.idx || 0);
    const isoDate = safeISO(context?.civilISO || detail.civilISO || detail.effectiveISO || "");
    const effectiveISO = safeISO(context?.effectiveISO || detail.effectiveISO || isoDate);
    const todayISO = getTodayISO();

    let phaseName = clampText(detail.phase || window.CodexState?.phaseName || "Unknown Phase", 48);
    let illuminationPct = null;
    if (typeof detail.illumination === "number") {
      illuminationPct = Math.max(0, Math.min(100, Math.round(detail.illumination * 100)));
    } else if (typeof window.CodexState?.phaseIllumination === "number") {
      illuminationPct = Math.max(0, Math.min(100, Math.round(window.CodexState.phaseIllumination * 100)));
    }

    return {
      source: "moons",
      isoDate,
      effectiveISO,
      isSelectedDate: isoDate !== todayISO,
      shareButtonLabel: isoDate !== todayISO ? "Share This Day" : "Share Today",
      readableDate: toTitleDate(isoDate),
      moonNumber: Number.isFinite(moonNumber) && moonNumber > 0 ? moonNumber : Number(window.CodexState?.moonNumber || 1),
      moonName: clampText(moon.name || window.CodexState?.moonName || "Outside Count", 44),
      moonDay: inside ? Number(info.dayInMoon || window.CodexState?.moonDay || 0) : null,
      yearDay: inside ? Number(info.dayOfYear || window.CodexState?.yearDay || 0) : null,
      weekGate: clampText(detail.week?.[0] || window.CodexState?.weekGate || "Outside Gate", 56),
      phaseName,
      phaseIllumination: illuminationPct,
      shabbatState: clampText(context?.shabbat?.state || window.CodexState?.shabbatLabel || "Ordinary Day", 56),
      shabbatCode: clampText(context?.shabbat?.code || window.CodexState?.shabbatState || "ordinary", 24),
      movement: clampText(detail.dayArch?.[1] || window.CodexState?.dailyMovement || "Notice what is moving, then record one clear line.", 220),
      mirrorLine: clampText(detail.solar?.[2] || detail.solar?.[1] || "", 140),
      sunset: clampText(context?.sunset || window.CodexState?.sunsetTime || "", 20),
      link: buildDeepLink(isoDate || effectiveISO)
    };
  }

  function fromCodexState() {
    const codex = window.CodexState || {};
    const isoDate = safeISO(codex.isoDate || getTodayISO());
    return {
      source: "homepage",
      isoDate,
      effectiveISO: isoDate,
      isSelectedDate: false,
      shareButtonLabel: "Share Today",
      readableDate: toTitleDate(isoDate),
      moonNumber: Number(codex.moonNumber || 1),
      moonName: clampText(codex.moonName || "Today in the Codex", 44),
      moonDay: codex.moonDay || null,
      yearDay: codex.yearDay || null,
      weekGate: clampText(codex.weekGate || "Week Gate", 56),
      phaseName: clampText(codex.phaseName || "Moon phase", 48),
      phaseIllumination: typeof codex.phaseIllumination === "number"
        ? Math.max(0, Math.min(100, Math.round(codex.phaseIllumination * 100)))
        : null,
      shabbatState: clampText(codex.shabbatLabel || "Ordinary Day", 56),
      shabbatCode: clampText(codex.shabbatState || "ordinary", 24),
      movement: clampText(codex.dailyMovement || "Notice what is moving, then record one clear line.", 220),
      mirrorLine: "",
      sunset: clampText(codex.sunsetTime || "", 20),
      link: buildDeepLink(isoDate)
    };
  }

  function deriveShareState() {
    return fromMoonEngine() || fromCodexState();
  }

  function buildDailyText(shareState, opts = state.options) {
    const moonLabel = `☾ ${shareState.moonName || "Living Day"}`;
    const dayLineParts = [];
    if (shareState.moonNumber && shareState.moonDay) {
      dayLineParts.push(`Moon ${shareState.moonNumber} · Day ${shareState.moonDay}/28`);
    }
    if (shareState.yearDay) dayLineParts.push(`Day ${shareState.yearDay}/364`);
    if (opts.includePhase && shareState.phaseName) dayLineParts.push(shareState.phaseName);

    const movement = opts.includeMovement && shareState.movement
      ? `\n\nToday’s movement:\n${shareState.movement}`
      : "";

    return `${moonLabel}\n\n${dayLineParts.join(" · ")}${movement}\n\nExplore the Remnant 13 Moons:\n${shareState.link}\n\n${BASE_HASHTAGS}`;
  }

  function statusText(message) {
    const node = state.modal?.querySelector("[data-share-day-status]");
    if (node) node.textContent = message || "";
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let current = "";

    for (let i = 0; i < words.length; i += 1) {
      const next = current ? `${current} ${words[i]}` : words[i];
      if (ctx.measureText(next).width <= maxWidth) {
        current = next;
      } else {
        if (current) lines.push(current);
        current = words[i];
      }
      if (lines.length >= maxLines) break;
    }
    if (current && lines.length < maxLines) lines.push(current);

    lines.slice(0, maxLines).forEach((line, index) => {
      ctx.fillText(line, x, y + (index * lineHeight));
    });

    return lines.length;
  }

  async function loadArtwork(moonNumber) {
    const src = MOON_ARTWORK[moonNumber];
    if (!src) return null;
    if (state.artworkCache.has(src)) return state.artworkCache.get(src);

    const image = new Image();
    image.decoding = "async";
    image.loading = "eager";

    const promise = new Promise(resolve => {
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = src;
    });

    state.artworkCache.set(src, promise);
    return promise;
  }

  function drawBackground(ctx, width, height, theme) {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, theme.atmosphere[0]);
    grad.addColorStop(1, theme.atmosphere[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(243, 201, 122, 0.38)";
    ctx.lineWidth = Math.max(3, width * 0.004);
    ctx.strokeRect(width * 0.03, height * 0.03, width * 0.94, height * 0.94);

    ctx.strokeStyle = "rgba(122, 243, 255, 0.25)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 7; i += 1) {
      const y = height * (0.14 + i * 0.11);
      ctx.beginPath();
      ctx.moveTo(width * 0.08, y);
      ctx.lineTo(width * 0.92, y);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(255,255,255,0.45)";
    for (let i = 0; i < 36; i += 1) {
      const sx = (i * 97) % width;
      const sy = (i * 151) % height;
      ctx.beginPath();
      ctx.arc(sx, sy, i % 4 === 0 ? 1.8 : 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  async function renderCard(shareState, format, options) {
    const dims = CANVAS_DIMS[format] || CANVAS_DIMS.square;
    const canvas = document.createElement("canvas");
    canvas.width = dims.width;
    canvas.height = dims.height;
    const ctx = canvas.getContext("2d", { alpha: false });
    const theme = getMoonTheme(shareState.moonNumber);
    drawBackground(ctx, dims.width, dims.height, theme);

    const artwork = await loadArtwork(shareState.moonNumber);
    if (artwork) {
      const size = Math.min(dims.width, dims.height) * (format === "story" ? 0.42 : 0.34);
      const x = (dims.width - size) / 2;
      const y = format === "story" ? dims.height * 0.2 : dims.height * 0.18;
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.drawImage(artwork, x, y, size, size);
      ctx.restore();
    }

    const medallionSize = Math.min(dims.width, dims.height) * 0.26;
    const medallionY = format === "story" ? dims.height * 0.28 : dims.height * 0.27;
    ctx.save();
    const glow = ctx.createRadialGradient(dims.width / 2, medallionY, medallionSize * 0.2, dims.width / 2, medallionY, medallionSize * 0.9);
    glow.addColorStop(0, `${theme.accent}88`);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(dims.width / 2, medallionY, medallionSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f3c97a";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(dims.width / 2, medallionY, medallionSize * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = theme.accent;
    ctx.textAlign = "center";
    ctx.font = `700 ${Math.round(medallionSize * 0.45)}px Georgia, serif`;
    ctx.fillText(theme.symbol, dims.width / 2, medallionY + medallionSize * 0.17);
    ctx.restore();

    const left = dims.width * 0.1;
    const textMax = dims.width * 0.8;
    let y = format === "story" ? dims.height * 0.5 : dims.height * 0.51;

    ctx.textAlign = "center";
    ctx.fillStyle = "#f3c97a";
    ctx.font = `700 ${Math.round(dims.width * 0.045)}px system-ui, -apple-system, Segoe UI, sans-serif`;
    ctx.fillText("REMNANT 13 MOONS", dims.width / 2, y);

    y += dims.height * 0.045;
    ctx.fillStyle = theme.accent;
    ctx.font = `700 ${Math.round(dims.width * 0.038)}px system-ui, -apple-system, Segoe UI, sans-serif`;
    ctx.fillText((shareState.moonName || "Living Day").toUpperCase(), dims.width / 2, y);

    y += dims.height * 0.05;
    ctx.fillStyle = "#f4f1e8";
    ctx.font = `600 ${Math.round(dims.width * 0.031)}px system-ui, -apple-system, Segoe UI, sans-serif`;
    const dayLine = shareState.moonNumber && shareState.moonDay
      ? `Moon ${shareState.moonNumber} · Day ${shareState.moonDay}/28`
      : `Moon ${shareState.moonNumber || "—"}`;
    ctx.fillText(dayLine, dims.width / 2, y);

    y += dims.height * 0.037;
    const gateLine = shareState.yearDay
      ? `Day ${shareState.yearDay}/364 · ${shareState.weekGate || "Week Gate"}`
      : shareState.weekGate || "Day Out of Time";
    ctx.fillText(clampText(gateLine, 64), dims.width / 2, y);

    if (options.includePhase && shareState.phaseName) {
      y += dims.height * 0.055;
      ctx.fillStyle = "#7af3ff";
      ctx.font = `600 ${Math.round(dims.width * 0.028)}px system-ui, -apple-system, Segoe UI, sans-serif`;
      const phaseLine = shareState.phaseIllumination === null
        ? `${shareState.phaseName}`
        : `${shareState.phaseName} · ${shareState.phaseIllumination}% illuminated`;
      ctx.fillText(clampText(phaseLine, 64), dims.width / 2, y);
    }

    y += dims.height * 0.05;
    ctx.fillStyle = "#f3c97a";
    ctx.font = `700 ${Math.round(dims.width * 0.025)}px system-ui, -apple-system, Segoe UI, sans-serif`;
    ctx.fillText(clampText(shareState.shabbatState || "Ordinary Day", 48), dims.width / 2, y);

    if (options.includeSunset && shareState.sunset) {
      y += dims.height * 0.034;
      ctx.fillStyle = "#d6deea";
      ctx.font = `500 ${Math.round(dims.width * 0.022)}px system-ui, -apple-system, Segoe UI, sans-serif`;
      ctx.fillText(`Sunset Boundary ${shareState.sunset}`, dims.width / 2, y);
    }

    if (options.includeMovement && shareState.movement) {
      y += dims.height * 0.065;
      ctx.fillStyle = "#f4f1e8";
      ctx.font = `700 ${Math.round(dims.width * 0.025)}px system-ui, -apple-system, Segoe UI, sans-serif`;
      ctx.fillText("TODAY'S MOVEMENT", dims.width / 2, y);

      y += dims.height * 0.03;
      ctx.font = `500 ${Math.round(dims.width * 0.026)}px system-ui, -apple-system, Segoe UI, sans-serif`;
      ctx.textAlign = "left";
      const lines = wrapText(ctx, clampText(shareState.movement, 180), left, y, textMax, dims.height * 0.03, format === "story" ? 6 : 3);
      y += lines * dims.height * 0.03;
      ctx.textAlign = "center";
    }

    if (shareState.mirrorLine) {
      y += dims.height * 0.03;
      ctx.fillStyle = "#7af3ff";
      ctx.font = `500 ${Math.round(dims.width * 0.022)}px system-ui, -apple-system, Segoe UI, sans-serif`;
      ctx.fillText(clampText(shareState.mirrorLine, 84), dims.width / 2, y);
    }

    ctx.fillStyle = "#d6deea";
    ctx.font = `500 ${Math.round(dims.width * 0.022)}px system-ui, -apple-system, Segoe UI, sans-serif`;
    ctx.fillText(clampText(shareState.readableDate || "", 44), dims.width / 2, dims.height * 0.9);

    ctx.fillStyle = "#f3c97a";
    ctx.font = `700 ${Math.round(dims.width * 0.027)}px system-ui, -apple-system, Segoe UI, sans-serif`;
    ctx.fillText(BRAND_LINE, dims.width / 2, dims.height * 0.94);

    return canvas;
  }

  function cacheKey(shareState, format) {
    return [
      format,
      shareState.isoDate,
      shareState.moonNumber,
      Number(state.options.includePhase),
      Number(state.options.includeMovement),
      Number(state.options.includeSunset)
    ].join("|");
  }

  async function getRenderedCanvas(shareState, format) {
    const key = cacheKey(shareState, format);
    if (state.cache.has(key)) return state.cache.get(key);
    const canvas = await renderCard(shareState, format, state.options);
    state.cache.set(key, canvas);
    return canvas;
  }

  async function renderPreview() {
    if (!state.modal || !state.currentShareState) return;
    const previewHost = state.modal.querySelector("[data-share-day-preview]");
    if (!previewHost) return;

    previewHost.setAttribute("data-loading", "true");
    statusText("Rendering image…");

    try {
      const canvas = await getRenderedCanvas(state.currentShareState, state.currentFormat);
      previewHost.innerHTML = "";
      canvas.className = "share-day-preview-canvas";
      canvas.setAttribute("aria-label", `${CANVAS_DIMS[state.currentFormat].label} share preview`);
      previewHost.appendChild(canvas);
      statusText("Preview ready.");
    } catch {
      statusText("Could not render this share card. Try again.");
    } finally {
      previewHost.removeAttribute("data-loading");
    }
  }

  async function toBlob(canvas) {
    return new Promise(resolve => {
      canvas.toBlob(blob => resolve(blob), "image/png");
    });
  }

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    state.objectUrls.add(url);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
      state.objectUrls.delete(url);
    }, 1200);
  }

  function clearObjectUrls() {
    state.objectUrls.forEach(url => URL.revokeObjectURL(url));
    state.objectUrls.clear();
  }

  async function downloadFormat(format) {
    if (!state.currentShareState) return;
    const canvas = await getRenderedCanvas(state.currentShareState, format);
    const blob = await toBlob(canvas);
    if (!blob) return;
    const filename = `remnant-13-moons-${state.currentShareState.isoDate || "day"}-${format}.png`;
    downloadBlob(blob, filename);

    const eventName = format === "square" ? "share_day_download_square" : "share_day_download_story";
    track(eventName, { format, method: "download" });
    recordShareAction(eventName, state.currentShareState, {
      format,
      method: "download",
      status: "image downloaded"
    });
    statusText(`${CANVAS_DIMS[format].label} image downloaded.`);
  }

  async function nativeShare() {
    if (!state.currentShareState) return;
    const shareText = buildDailyText(state.currentShareState);
    const shareData = {
      title: `Remnant 13 Moons · ${state.currentShareState.moonName}`,
      text: shareText,
      url: state.currentShareState.link
    };

    if (!(navigator && typeof navigator.share === "function")) {
      statusText("Native sharing is not available here. Download the image and attach it manually.");
      return;
    }

    try {
      const canvas = await getRenderedCanvas(state.currentShareState, state.currentFormat);
      const blob = await toBlob(canvas);
      if (blob) {
        const file = new File([blob], `remnant-13-moons-${state.currentShareState.isoDate || "day"}.png`, { type: "image/png" });
        if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
          await navigator.share({ ...shareData, files: [file] });
          track("share_day_native_open", { format: state.currentFormat, method: "native-file" });
          recordShareAction("share_day_native_open", state.currentShareState, {
            format: state.currentFormat,
            method: "native-file",
            status: "share opened"
          });
          statusText("Native share opened.");
          return;
        }
      }

      await navigator.share(shareData);
      track("share_day_native_open", { format: state.currentFormat, method: "native-text-link" });
      recordShareAction("share_day_native_open", state.currentShareState, {
        format: state.currentFormat,
        method: "native-text-link",
        status: "share opened"
      });
      statusText("Native share opened. Download image to attach manually if needed.");
    } catch (error) {
      if (error && error.name === "AbortError") {
        statusText("Native share canceled.");
      } else {
        statusText("Unable to open native share. Download image and attach manually.");
      }
    }
  }

  async function copyText(value) {
    if (!value) return false;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch {}
    }

    const temp = document.createElement("textarea");
    temp.value = value;
    temp.setAttribute("readonly", "");
    temp.style.position = "fixed";
    temp.style.opacity = "0";
    document.body.appendChild(temp);
    temp.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(temp);
    return ok;
  }

  function setButtonLabels(shareState) {
    document.querySelectorAll("[data-share-day-open]").forEach(button => {
      if (!(button instanceof HTMLElement)) return;
      const source = button.getAttribute("data-share-source") || "";
      if (source === "moons" || source === "signal") {
        button.textContent = shareState.shareButtonLabel;
      } else {
        button.textContent = "Share Today";
      }
    });
  }

  function applyInert() {
    state.inertedNodes = [];
    if (!state.modal || !("inert" in HTMLElement.prototype)) return;

    Array.from(document.body.children).forEach(node => {
      if (node === state.modal) return;
      if (!(node instanceof HTMLElement)) return;
      state.inertedNodes.push({ node, inert: node.inert });
      node.inert = true;
    });
  }

  function restoreInert() {
    state.inertedNodes.forEach(entry => {
      entry.node.inert = entry.inert;
    });
    state.inertedNodes = [];
  }

  function closeModal() {
    if (!state.modal) return;
    state.modal.hidden = true;
    document.body.classList.remove("share-day-modal-open");
    restoreInert();
    clearObjectUrls();
    state.cache.clear();
    if (state.trigger && typeof state.trigger.focus === "function") state.trigger.focus();
  }

  function trapFocus(event) {
    if (event.key !== "Tab" || !state.modal || state.modal.hidden) return;
    const focusables = Array.from(state.modal.querySelectorAll("button,[href],input,textarea,[tabindex]:not([tabindex='-1'])"))
      .filter(el => !el.hasAttribute("disabled") && !el.getAttribute("aria-hidden"));
    if (!focusables.length) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function openModal(trigger) {
    state.currentShareState = deriveShareState();
    setButtonLabels(state.currentShareState);
    state.trigger = trigger || null;

    if (!state.modal) createModal();
    if (!state.modal) return;

    state.currentFormat = "square";
    state.cache.clear();
    const text = buildDailyText(state.currentShareState);
    const textArea = state.modal.querySelector("[data-share-day-text]");
    if (textArea) textArea.value = text;

    const title = state.modal.querySelector("[data-share-day-title]");
    if (title) {
      title.textContent = state.currentShareState.isSelectedDate ? "Share This Day" : "Share Today";
    }

    const dateLabel = state.modal.querySelector("[data-share-day-date]");
    if (dateLabel) {
      dateLabel.textContent = state.currentShareState.readableDate || state.currentShareState.isoDate || "";
    }

    state.modal.hidden = false;
    document.body.classList.add("share-day-modal-open");
    applyInert();
    await renderPreview();

    const firstBtn = state.modal.querySelector("[data-share-day-close], [data-share-day-native]");
    if (firstBtn) firstBtn.focus();

    track("share_day_open", { format: state.currentFormat, method: "open" });
    recordShareAction("share_day_open", state.currentShareState, {
      format: state.currentFormat,
      method: "open",
      status: "share opened"
    });
  }

  function createModal() {
    const modal = document.createElement("section");
    modal.className = "share-day-modal";
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "false");
    modal.innerHTML = `
      <div class="share-day-backdrop" data-share-day-close></div>
      <div class="share-day-dialog" role="dialog" aria-modal="true" aria-labelledby="shareDayTitle">
        <header class="share-day-head">
          <div>
            <p class="share-day-kicker">REMNANT 13 MOONS</p>
            <h2 id="shareDayTitle" data-share-day-title>Share Today</h2>
            <p class="share-day-date" data-share-day-date></p>
          </div>
          <button type="button" class="share-day-close" data-share-day-close>Close</button>
        </header>

        <div class="share-day-format" role="tablist" aria-label="Share format">
          <button type="button" data-share-day-format="square" aria-selected="true">Square 1080×1080</button>
          <button type="button" data-share-day-format="story" aria-selected="false">Story 1080×1920</button>
        </div>

        <div class="share-day-preview-wrap" data-share-day-preview data-loading="true"></div>

        <fieldset class="share-day-options">
          <legend>Include</legend>
          <label><input type="checkbox" data-share-opt="phase" checked> Visible lunar phase</label>
          <label><input type="checkbox" data-share-opt="movement" checked> Today’s movement</label>
          <label><input type="checkbox" data-share-opt="sunset"> Sunset boundary</label>
        </fieldset>

        <label class="share-day-text-label" for="shareDayText">Daily share text</label>
        <textarea id="shareDayText" class="share-day-text" data-share-day-text readonly></textarea>

        <div class="share-day-actions">
          <button type="button" data-share-day-native>Share Image</button>
          <button type="button" data-share-day-download="square">Download Square</button>
          <button type="button" data-share-day-download="story">Download Story</button>
          <button type="button" data-share-day-copy="text">Copy Daily Text</button>
          <button type="button" data-share-day-copy="link">Copy Link</button>
          <button type="button" data-share-day-close>Close</button>
        </div>

        <p class="share-day-status" role="status" aria-live="polite" data-share-day-status></p>
      </div>
    `;

    modal.addEventListener("click", event => {
      const close = event.target.closest("[data-share-day-close]");
      if (close) {
        closeModal();
        return;
      }

      const formatBtn = event.target.closest("[data-share-day-format]");
      if (formatBtn) {
        state.currentFormat = formatBtn.getAttribute("data-share-day-format") || "square";
        modal.querySelectorAll("[data-share-day-format]").forEach(btn => {
          btn.setAttribute("aria-selected", String(btn === formatBtn));
        });
        renderPreview();
        return;
      }

      const dl = event.target.closest("[data-share-day-download]");
      if (dl) {
        downloadFormat(dl.getAttribute("data-share-day-download"));
        return;
      }

      const copy = event.target.closest("[data-share-day-copy]");
      if (copy) {
        const mode = copy.getAttribute("data-share-day-copy");
        if (mode === "text") {
          const text = buildDailyText(state.currentShareState);
          copyText(text).then(ok => {
            if (ok) {
              track("share_day_copy_text", { format: state.currentFormat, method: "clipboard" });
              recordShareAction("share_day_copy_text", state.currentShareState, {
                format: state.currentFormat,
                method: "clipboard",
                status: "text copied"
              });
              statusText("Daily text copied.");
            }
          });
        } else {
          copyText(state.currentShareState?.link || "").then(ok => {
            if (ok) {
              track("share_day_copy_link", { format: state.currentFormat, method: "clipboard" });
              recordShareAction("share_day_copy_link", state.currentShareState, {
                format: state.currentFormat,
                method: "clipboard",
                status: "link copied"
              });
              statusText("Link copied.");
            }
          });
        }
        return;
      }

      if (event.target.closest("[data-share-day-native]")) {
        nativeShare();
      }
    });

    modal.addEventListener("change", event => {
      const opt = event.target.closest("[data-share-opt]");
      if (!opt) return;
      const type = opt.getAttribute("data-share-opt");
      if (type === "phase") state.options.includePhase = opt.checked;
      if (type === "movement") state.options.includeMovement = opt.checked;
      if (type === "sunset") state.options.includeSunset = opt.checked;
      state.cache.clear();
      const textArea = modal.querySelector("[data-share-day-text]");
      if (textArea && state.currentShareState) {
        textArea.value = buildDailyText(state.currentShareState);
      }
      renderPreview();
    });

    document.addEventListener("keydown", event => {
      if (!state.modal || state.modal.hidden) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
        return;
      }
      trapFocus(event);
    });

    document.body.appendChild(modal);
    state.modal = modal;
  }

  function setupButtons() {
    document.addEventListener("click", event => {
      const trigger = event.target.closest("[data-share-day-open]");
      if (!trigger) return;
      event.preventDefault();
      openModal(trigger);
    });
  }

  function setupMoonListener() {
    document.addEventListener("sof:moon-render", event => {
      state.lastDetail = event.detail || null;
      const shareState = deriveShareState();
      setButtonLabels(shareState);
    });

    document.addEventListener("codexstatechange", () => {
      const shareState = deriveShareState();
      setButtonLabels(shareState);
    });
  }

  function setup() {
    setupButtons();
    setupMoonListener();
    setButtonLabels(deriveShareState());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup, { once: true });
  } else {
    setup();
  }

  window.CodexShareDay = {
    deriveShareState,
    buildDailyText,
    buildDeepLink,
    getMoonTheme,
    _test: {
      clampText,
      toTitleDate,
      safeISO,
      MOON_THEMES,
      CANVAS_DIMS
    }
  };
})();
