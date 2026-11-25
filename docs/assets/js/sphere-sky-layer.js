/*
 * The Sky on the Sphere — the dome (Phase C, Gap 1).
 *
 * Aaron's order (Nov 23, 2026): "Get the stars and astronomy on
 * there." This module stands the computed sky on the Sphere's
 * face — in the caption deck, beside the sky line, where the
 * face's other readings stand. It is an overlay module in the
 * farm layer's pattern: loaded by the companion layer, it never
 * touches the sphere engine, geometry, camera, or any protected
 * file.
 *
 * What stands here, all of it computed on this device by
 * CodexSkyEngine from the keeper's kept place and the cursor's
 * selected day — nothing is fetched:
 *   - the day's sun arc and moon arc, drawn from computed
 *     altitudes across the day;
 *   - the Sun and Moon standing at the chosen standing (the Sun
 *     at its highest for Day; nightfall for Night), the Moon
 *     drawn with its computed phase;
 *   - at the Night standing, the bright stars of the real
 *     catalog (Yale Bright Star Catalogue via the Astronomical
 *     Almanac list, epoch 2016.5, magnitude 4 and brighter) and
 *     the planets, each placed by the math for that place and
 *     moment. A star below the horizon is not drawn standing up:
 *     the dome is a horizon chart (centre = overhead, rim = the
 *     horizon, drawn as you see it looking up), and what falls
 *     outside the rim is clipped away.
 *
 * The dome rides with the Sky ring: it stands when the face's
 * own sky line stands (the season line is its signal) and is
 * absent when the ring is off. No place kept on this device
 * means no sky is drawn — one honest sentence stands instead.
 * The 3D scene itself keeps its own horizon-free geometry; a
 * star shell inside the scene is a separate, held proposal (see
 * the Phase C sky build note).
 *
 * The place control stands in this panel (Nov 24, 2026): the
 * honest sentence names Set location, so the control it names
 * stands where the sentence is read — the page's one location
 * command (SofLocationCommand over OpenMeteoAdapter's kept
 * place: the same state the sidebar's panel writes, no second
 * store), seated in the dome for setting, changing, and
 * clearing the place. A keeper who does not want the sentence
 * every visit can quiet it with Not now; the quiet lasts the
 * session, and a plain Set location button stays in the panel
 * to bring the control back.
 */
(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.CodexSphereSkyLayer = api;

  if (typeof document !== "undefined" && typeof window !== "undefined") {
    api.boot();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "sphere-sky-layer/1.0.0";

  /* ── Pure helpers (tested) ──────────────────────────────────── */

  function parseISODate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
    if (!m) return null;
    return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  }

  function civilISOFromCursorDetail(detail) {
    if (!detail || typeof detail !== "object") return null;
    const candidates = [
      detail.coordinate?.gregorian?.isoDate,
      detail.gregorian?.isoDate,
      detail.coordinate?.civilDate,
      detail.civilDate
    ];
    for (const c of candidates) {
      if (parseISODate(c)) return c;
    }
    return null;
  }

  /* Minutes EAST of UTC for a civil date on this device. */
  function tzOffsetForCivil(civil) {
    return -new Date(civil.year, civil.month - 1, civil.day, 12).getTimezoneOffset();
  }

  /* Horizon-chart projection: centre = zenith, rim = horizon.
   * Drawn as you see it looking up — north at the top, east to
   * the left. Returns points outside the rim for below-horizon
   * altitudes; the SVG clips them away. */
  function project(altitude, azimuth, radius) {
    const r = (radius * (90 - altitude)) / 90;
    const az = (azimuth * Math.PI) / 180;
    return { x: -r * Math.sin(az), y: -r * Math.cos(az) };
  }

  function escapeText(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function shortDesignation(designation) {
    return String(designation || "").replace(/^\d+\s+/, "");
  }

  function formatTime(date) {
    if (!date) return null;
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  function formatDaylight(minutes) {
    if (!Number.isFinite(minutes)) return null;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes - h * 60);
    return `${h} hr ${m} min of daylight`;
  }

  /* The Moon's lit face as an SVG path: computed illumination in,
   * terminator out. Waxing moons are lit on the right (the side
   * toward the evening Sun); waning on the left. */
  function moonLitPath(cx, cy, r, illumination, waxing) {
    const k = Math.min(0.99, Math.max(0.01, illumination));
    const rx = Math.max(0.1, r * Math.abs(2 * k - 1));
    const limbSweep = waxing ? 1 : 0;
    const termSweep = waxing ? (k < 0.5 ? 1 : 0) : (k < 0.5 ? 0 : 1);
    return (
      `M ${cx} ${cy - r} ` +
      `A ${r} ${r} 0 0 ${limbSweep} ${cx} ${cy + r} ` +
      `A ${rx.toFixed(2)} ${r} 0 0 ${termSweep} ${cx} ${cy - r} Z`
    );
  }

  /* ── Browser wiring ─────────────────────────────────────────── */

  const R = 140;
  const C = 160;

  function boot() {
    const caption = document.querySelector(".sphere-rebuild-caption");
    if (!caption) return;
    if (caption.querySelector("[data-sphere-sky-dome]")) return;

    const section = document.createElement("section");
    section.className = "sphere-sky-dome";
    section.setAttribute("data-sphere-sky-dome", "");
    section.setAttribute("aria-label", "The sky over your place, computed on this device");
    section.hidden = true;
    section.innerHTML = `
      <div class="sphere-sky-dome-head">
        <p class="sphere-sky-dome-title" data-sky-title>The sky over your place</p>
        <div class="sphere-sky-dome-standings" role="group" aria-label="Which standing to draw">
          <button type="button" class="sphere-sky-standing-btn" data-sky-standing="day" aria-pressed="true">Day</button>
          <button type="button" class="sphere-sky-standing-btn" data-sky-standing="night" aria-pressed="false">Night</button>
        </div>
      </div>
      <div class="sphere-sky-dome-stage" data-sky-stage></div>
      <p class="sphere-sky-dome-line" data-sky-standing-line></p>
      <div data-sky-place-host></div>
      <p class="sphere-sky-dome-line" data-sky-sun-line></p>
      <p class="sphere-sky-dome-line" data-sky-moon-line></p>
      <p class="sphere-sky-dome-note">Computed on this device for the place kept on it — nothing is fetched. Stars: the Yale Bright Star Catalogue (Astronomical Almanac list, epoch 2016.5), magnitude 4 and brighter, placed by sidereal time.</p>`;

    const seasonLine = caption.querySelector("[data-sky-readout]");
    if (seasonLine) seasonLine.after(section);
    else caption.appendChild(section);

    const stageEl = section.querySelector("[data-sky-stage]");
    const titleEl = section.querySelector("[data-sky-title]");
    const standingLineEl = section.querySelector("[data-sky-standing-line]");
    const sunLineEl = section.querySelector("[data-sky-sun-line]");
    const moonLineEl = section.querySelector("[data-sky-moon-line]");
    const dayBtn = section.querySelector('[data-sky-standing="day"]');
    const nightBtn = section.querySelector('[data-sky-standing="night"]');
    const placeHost = section.querySelector("[data-sky-place-host]");

    let currentISO = null;
    let standingChoice = null; // keeper's hand; null = the layer chooses
    let place = null;
    let renderMemo = { key: null, sky: null };

    /* ── The place control, seated in the panel ───────────────
     * The one location command, attached to a root of its own
     * inside the dome. The block is rebuilt whenever the
     * place's presence flips, so the command's own state line
     * and Change button always speak for the place that stands
     * (or its absence); between flips the command manages
     * itself, exactly as it does in the sidebar. */
    const DISMISS_KEY = "sof.skyPlaceNotice.dismissed";
    let noticeDismissed = false;
    try { noticeDismissed = window.sessionStorage?.getItem(DISMISS_KEY) === "1"; } catch { /* in-memory only */ }
    let placeBlock = null;
    let placeBlockAttached = false;
    let placePresence = null;

    function setNoticeDismissed(next) {
      noticeDismissed = next;
      try {
        if (next) window.sessionStorage?.setItem(DISMISS_KEY, "1");
        else window.sessionStorage?.removeItem(DISMISS_KEY);
      } catch { /* the flag above still holds for this page */ }
    }

    function buildPlaceBlock() {
      const block = document.createElement("div");
      block.className = "sphere-sky-place sphere-location-command";
      block.setAttribute("data-sky-place", "");
      block.innerHTML = `
      <p class="sphere-sky-place-state" data-location-state>${place ? escapeText(place.label || "Place set") : "LOCATION NOT SET"}</p>
      <div class="sphere-location-actions">
        <button type="button" class="sphere-sky-place-btn" data-location-use-device>Use My Location</button>
        <button type="button" class="sphere-sky-place-btn" data-location-search-submit>Search Place</button>
        <button type="button" class="sphere-sky-place-btn" data-location-coords-submit>Enter Coordinates</button>
        <button type="button" class="sphere-sky-place-btn" data-location-continue-without>Continue Without Weather</button>
      </div>
      <div class="sphere-location-inputs">
        <label class="visually-hidden">Search place</label>
        <input data-location-search-input class="sphere-sky-place-input" type="text" placeholder="Search place">
        <div class="sphere-location-coords">
          <label class="visually-hidden">Latitude</label>
          <input data-location-lat class="sphere-sky-place-input" type="number" step="0.0001" min="-90" max="90" placeholder="Latitude -90 to 90">
          <label class="visually-hidden">Longitude</label>
          <input data-location-lon class="sphere-sky-place-input" type="number" step="0.0001" min="-180" max="180" placeholder="Longitude -180 to 180">
          <label class="visually-hidden">Place name</label>
          <input data-location-name class="sphere-sky-place-input" type="text" placeholder="Optional place name">
        </div>
      </div>
      <div class="sphere-location-results" data-location-results aria-live="polite"></div>
      <p class="sphere-field-note" data-location-status></p>
      <div class="sphere-sky-place-quiet">
        <button type="button" class="sphere-sky-place-btn sphere-sky-place-notnow" data-sky-not-now>Not now</button>
        <button type="button" class="sphere-sky-place-btn sphere-sky-place-open" data-sky-set-open hidden>Set location</button>
      </div>`;
      block.querySelector("[data-sky-not-now]")?.addEventListener("click", () => {
        setNoticeDismissed(true);
        render();
      });
      block.querySelector("[data-sky-set-open]")?.addEventListener("click", () => {
        setNoticeDismissed(false);
        render();
      });
      placeBlockAttached = tryAttachPlaceBlock(block);
      return block;
    }

    /* The location command rides the page's third load phase,
     * on idle slices — it can land after this layer has already
     * seated its block. A failed attempt does not burn the root
     * (the command marks a root only once it truly attaches),
     * so the seat is retried on later renders until it holds. */
    function tryAttachPlaceBlock(block) {
      if (!window.SofLocationCommand?.attach || !window.OpenMeteoAdapter) return false;
      try {
        window.SofLocationCommand.attach(block);
        return true;
      } catch {
        return false;
      }
    }

    function applyPlaceQuiet() {
      if (!placeBlock) return;
      const quiet = noticeDismissed && !place;
      placeBlock.classList.toggle("sky-place-quiet", quiet);
      const notNow = placeBlock.querySelector("[data-sky-not-now]");
      const open = placeBlock.querySelector("[data-sky-set-open]");
      if (notNow) notNow.hidden = !!place || quiet;
      if (open) open.hidden = !quiet;
    }

    function syncPlaceBlock() {
      const have = !!place;
      if (have && noticeDismissed) setNoticeDismissed(false);
      if (placePresence === have && placeBlock) {
        if (!placeBlockAttached) placeBlockAttached = tryAttachPlaceBlock(placeBlock);
        applyPlaceQuiet();
        return;
      }
      placePresence = have;
      if (placeBlock) placeBlock.remove();
      placeBlock = buildPlaceBlock();
      placeHost.appendChild(placeBlock);
      applyPlaceQuiet();
    }

    function readPlace() {
      try {
        const state = window.SofEnvironmentState?.getEnvironmentState?.();
        const p = state?.place;
        // Strict reading (Gate G sky rule, Nov 24, 2026): a
        // coordinate counts only when it is present — Number(null)
        // is 0, and a place object with absent coordinates must
        // never become 0°, 0° by arithmetic. A place the keeper
        // truly set at 0°, 0° still counts; its values are present.
        const rawLat = p?.latitude;
        const rawLon = p?.longitude;
        const lat = rawLat === null || rawLat === undefined || rawLat === "" ? NaN : Number(rawLat);
        const lon = rawLon === null || rawLon === undefined || rawLon === "" ? NaN : Number(rawLon);
        place = Number.isFinite(lat) && Number.isFinite(lon)
          ? { lat, lon, label: p?.name || p?.label || null }
          : null;
      } catch {
        place = null;
      }
    }

    function skyRingOn() {
      const line = caption.querySelector("[data-sky-readout]");
      if (line) return !line.hidden;
      const input = document.getElementById("sphere-ring-sky");
      return !input || input.checked;
    }

    function todayISO() {
      const now = new Date();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      return `${now.getFullYear()}-${mm}-${dd}`;
    }

    function arcPoints(engine, kind, civil, tz) {
      const dayStartUTC = Date.UTC(civil.year, civil.month - 1, civil.day, 0, 0, 0) - tz * 60000;
      const pts = [];
      for (let step = 0; step <= 72; step += 1) {
        const at = new Date(dayStartUTC + step * 20 * 60000);
        const pos = kind === "sun"
          ? engine.sunAltAz(at, place.lat, place.lon)
          : engine.moonAltAz(at, place.lat, place.lon);
        if (pos.altitude < -4) continue;
        const p = project(pos.altitude, pos.azimuth, R);
        pts.push(`${(C + p.x).toFixed(1)},${(C + p.y).toFixed(1)}`);
      }
      return pts.join(" ");
    }

    /* Performance (pass 2): a render rebuilds the dome's whole
     * SVG (~500 star circles at night) and is asked for on every
     * selected-day change — every frame of a drag — although at
     * phone width the dome sits in the lowered guide sheet,
     * unseen. Off screen, a render defers until the panel comes
     * into view; unchanged inputs skip. Nothing drawn changes. */
    let domeVisible = true; // until an observer says otherwise
    let renderPending = false;
    let lastRenderKey = null;
    if (typeof IntersectionObserver === "function") {
      new IntersectionObserver((entries) => {
        domeVisible = entries[0]?.isIntersecting !== false;
        if (domeVisible && renderPending) render();
      }, { threshold: 0.01 }).observe(section);
    }

    function render() {
      const engine = window.CodexSkyEngine;
      section.hidden = !skyRingOn() || !engine;
      if (section.hidden) { renderPending = false; lastRenderKey = null; return; }
      if (!domeVisible) { renderPending = true; return; }
      renderPending = false;
      readPlace();
      titleEl.textContent = place?.label ? `The sky over ${place.label}` : "The sky over your place";
      if (!place) {
        lastRenderKey = null; // the stage is cleared below; a returning place must redraw
        stageEl.innerHTML = "";
        standingLineEl.textContent = noticeDismissed
          ? "No place is kept on this device — set one and the sky will draw for where you stand."
          : "No place is kept on this device, so the sky can't be drawn for where you stand. The season and Moon line above needs no place, and stands as computed. Set a place with Set location on this page and the sky will draw.";
        sunLineEl.textContent = "";
        moonLineEl.textContent = "";
        syncPlaceBlock();
        return;
      }
      syncPlaceBlock();
      const civil = parseISODate(currentISO) || parseISODate(todayISO());
      if (!civil) return;
      const tz = tzOffsetForCivil(civil);
      // One-entry memo: scrubbing back and forth between days is
      // the known gesture, and a full day-sky costs ~a tenth of a
      // second of honest math. The memo holds only the last day
      // for this exact place; anything else recomputes.
      const memoKey = `${civil.year}-${civil.month}-${civil.day}|${place.lat}|${place.lon}|${tz}`;
      if (memoKey !== renderMemo.key) {
        renderMemo = { key: memoKey, sky: engine.skyForCivilDate(civil, place.lat, place.lon, tz) };
      }
      const sky = renderMemo.sky;
      const isToday = (currentISO || todayISO()) === todayISO();

      // The standing: the keeper's hand wins; otherwise Day,
      // unless this is today and the Sun is already down — then
      // the night is what stands over the keeper right now.
      let standing = standingChoice;
      if (!standing) {
        standing = "day";
        if (isToday) {
          const nowAlt = engine.sunAltAz(new Date(), place.lat, place.lon).altitude;
          if (nowAlt < 0) standing = "night";
        }
      }
      dayBtn.setAttribute("aria-pressed", String(standing === "day"));
      nightBtn.setAttribute("aria-pressed", String(standing === "night"));

      /* The dedupe (pass 2, above): unchanged inputs — the dome
       * already shows exactly this. */
      const renderKey = `${currentISO}|${todayISO()}|${standing}|${place.lat}|${place.lon}|${place.label || ""}|${tz}|${noticeDismissed ? 1 : 0}`;
      if (renderKey === lastRenderKey) return;
      lastRenderKey = renderKey;

      const localNoonUTC = Date.UTC(civil.year, civil.month - 1, civil.day, 12, 0, 0) - tz * 60000;
      let moment;
      let momentLabel;
      if (standing === "day") {
        moment = sky.sun.solarNoon || new Date(localNoonUTC);
        momentLabel = `Day standing — the Sun at its highest, ${formatTime(moment)}. The arcs are the whole day's road for the Sun and the Moon, drawn looking up.`;
      } else if (sky.nauticalDusk) {
        moment = sky.nauticalDusk;
        momentLabel = `Night standing — nightfall, ${formatTime(moment)}, when the Sun is 12° below the horizon. Stars and planets as they stand then, drawn looking up.`;
      } else {
        moment = sky.sun.solarNoon
          ? new Date(sky.sun.solarNoon.getTime() + 12 * 3600000)
          : new Date(localNoonUTC + 12 * 3600000);
        momentLabel = "Night standing — the middle of the night (the Sun never reaches 12° down on this day here). Stars and planets as they stand then, drawn looking up.";
      }
      standingLineEl.textContent = momentLabel;

      // Sun line.
      if (sky.sun.polar === "day") sunLineEl.textContent = "The Sun does not set on this day here — computed on this device.";
      else if (sky.sun.polar === "night") sunLineEl.textContent = "The Sun does not rise on this day here — computed on this device.";
      else {
        sunLineEl.textContent =
          `Sunrise ${formatTime(sky.sun.sunrise)} · solar noon ${formatTime(sky.sun.solarNoon)} · sunset ${formatTime(sky.sun.sunset)} · ${formatDaylight(sky.sun.daylightMinutes)} — computed on this device.`;
      }

      // Moon line.
      const phase = sky.phase;
      const riseEv = sky.moon.events.find((e) => e.kind === "moonrise");
      const setEv = sky.moon.events.find((e) => e.kind === "moonset");
      let moonText = `Moon: ${phase.name}, ${Math.round(phase.illumination * 100)}% lit`;
      if (riseEv) moonText += ` · rises ${formatTime(riseEv.at)}`;
      if (setEv) moonText += ` · sets ${formatTime(setEv.at)}`;
      moonLineEl.textContent = moonText + " — computed on this device.";

      /* The dome itself. */
      const parts = [];
      parts.push(`<svg viewBox="0 0 320 320" class="sphere-sky-dome-svg" role="img" aria-label="Horizon chart of the computed sky">`);
      parts.push(`<defs><clipPath id="sphere-sky-clip"><circle cx="${C}" cy="${C}" r="${R}"/></clipPath>
        <radialGradient id="sphere-sky-bg" cx="50%" cy="42%" r="75%">
          <stop offset="0%" stop-color="#1a2748"/><stop offset="70%" stop-color="#101a33"/><stop offset="100%" stop-color="#0a0f1e"/>
        </radialGradient></defs>`);
      parts.push(`<circle cx="${C}" cy="${C}" r="${R}" fill="url(#sphere-sky-bg)" stroke="#ffd98f" stroke-opacity="0.35"/>`);
      for (const altRing of [30, 60]) {
        const rr = (R * (90 - altRing)) / 90;
        parts.push(`<circle cx="${C}" cy="${C}" r="${rr.toFixed(1)}" fill="none" stroke="#e8e2d0" stroke-opacity="0.14"/>`);
      }
      parts.push(`<line x1="${C}" y1="${C - R}" x2="${C}" y2="${C + R}" stroke="#e8e2d0" stroke-opacity="0.10"/>`);
      parts.push(`<line x1="${C - R}" y1="${C}" x2="${C + R}" y2="${C}" stroke="#e8e2d0" stroke-opacity="0.10"/>`);
      parts.push(`<g clip-path="url(#sphere-sky-clip)">`);

      // Stars and planets stand only at the Night standing.
      if (standing === "night") {
        const starField = engine.starsAboveHorizon(moment, place.lat, place.lon);
        if (starField.available) {
          for (const star of starField.stars) {
            const p = project(star.altitude, star.azimuth, R);
            const r = Math.max(0.7, Math.min(2.8, 2.6 - 0.55 * star.magnitude));
            parts.push(`<circle cx="${(C + p.x).toFixed(1)}" cy="${(C + p.y).toFixed(1)}" r="${r.toFixed(1)}" fill="#f4f1e4"><title>${escapeText(star.name)} · magnitude ${star.magnitude} · ${Math.round(star.altitude)}° up</title></circle>`);
            if (star.magnitude <= 0.7) {
              parts.push(`<text x="${(C + p.x).toFixed(1)}" y="${(C + p.y - 5).toFixed(1)}" class="sphere-sky-star-label">${escapeText(shortDesignation(star.designation))}</text>`);
            }
          }
        }
        for (const planet of engine.planetsAltAz(moment, place.lat, place.lon)) {
          if (planet.altitude <= 0) continue;
          if (planet.telescope && planet.magnitude > 6) continue;
          const p = project(planet.altitude, planet.azimuth, R);
          parts.push(`<circle cx="${(C + p.x).toFixed(1)}" cy="${(C + p.y).toFixed(1)}" r="3" fill="#ffd98f"><title>${escapeText(planet.name)} · magnitude ${planet.magnitude} · ${Math.round(planet.altitude)}° up</title></circle>`);
          parts.push(`<text x="${(C + p.x).toFixed(1)}" y="${(C + p.y - 6).toFixed(1)}" class="sphere-sky-planet-label">${escapeText(planet.name)}</text>`);
        }
      }

      // The day's roads.
      const sunArc = arcPoints(engine, "sun", civil, tz);
      if (sunArc) parts.push(`<polyline points="${sunArc}" fill="none" stroke="#ffb84d" stroke-opacity="0.55" stroke-width="1.6"/>`);
      const moonArc = arcPoints(engine, "moon", civil, tz);
      if (moonArc) parts.push(`<polyline points="${moonArc}" fill="none" stroke="#b9c8e8" stroke-opacity="0.45" stroke-width="1.2" stroke-dasharray="4 3"/>`);

      // The Sun standing at the moment.
      const sunNow = engine.sunAltAz(moment, place.lat, place.lon);
      if (sunNow.altitude > -2) {
        const p = project(Math.max(sunNow.altitude, -2), sunNow.azimuth, R);
        parts.push(`<circle cx="${(C + p.x).toFixed(1)}" cy="${(C + p.y).toFixed(1)}" r="7" fill="#ffd34d" stroke="#ffb84d" stroke-width="2"><title>The Sun · ${Math.round(sunNow.altitude)}° up</title></circle>`);
      }
      // The Moon standing at the moment, with its phase.
      const moonNow = engine.moonAltAz(moment, place.lat, place.lon);
      if (moonNow.altitude > -2) {
        const p = project(Math.max(moonNow.altitude, -2), moonNow.azimuth, R);
        const cxp = (C + p.x).toFixed(1), cyp = (C + p.y).toFixed(1);
        const phaseNow = engine.moonPhase(moment);
        parts.push(`<circle cx="${cxp}" cy="${cyp}" r="8" fill="#232c44" stroke="#8fa3c8" stroke-width="1"/>`);
        if (phaseNow.illumination > 0.01) {
          parts.push(`<path d="${moonLitPath(C + p.x, C + p.y, 8, phaseNow.illumination, phaseNow.waxing)}" fill="#e9edf6"><title>The Moon · ${phaseNow.name} · ${Math.round(phaseNow.illumination * 100)}% lit</title></path>`);
        }
      }
      parts.push(`</g>`);
      parts.push(`<text x="${C}" y="${C - R + 14}" class="sphere-sky-cardinal">N</text>`);
      parts.push(`<text x="${C - R + 10}" y="${C + 3}" class="sphere-sky-cardinal">E</text>`);
      parts.push(`<text x="${C}" y="${C + R - 6}" class="sphere-sky-cardinal">S</text>`);
      parts.push(`<text x="${C + R - 10}" y="${C + 3}" class="sphere-sky-cardinal">W</text>`);
      parts.push(`</svg>`);
      stageEl.innerHTML = parts.join("");
    }

    let renderQueued = false;
    function scheduleRender() {
      if (renderQueued) return;
      renderQueued = true;
      window.requestAnimationFrame(() => { renderQueued = false; render(); });
    }

    function applyDetail(detail) {
      const iso = civilISOFromCursorDetail(detail);
      if (!iso) return false;
      if (iso !== currentISO) {
        currentISO = iso;
        standingChoice = null;
      }
      scheduleRender();
      return true;
    }

    function applyGlobals() {
      const coord = window.SOFCurrentTemporalCoordinate;
      if (coord && applyDetail({ coordinate: coord })) return;
      const selected = window.SOF_SELECTED_DATE;
      const PC = window.PatternCalendar;
      if (selected && PC && typeof PC.fromCivilDate === "function") {
        try {
          const summary = PC.fromCivilDate({ date: selected });
          if (summary?.civilDate && summary.civilDate !== currentISO) {
            currentISO = summary.civilDate;
            standingChoice = null;
          }
          scheduleRender();
        } catch {
          /* The cursor's events remain the primary signal. */
        }
      }
    }

    for (const name of ["sof:selected-date-change", "sof:temporal-cursor-change", "sof:temporal-cursor-ready"]) {
      window.addEventListener(name, (e) => { if (!applyDetail(e.detail)) applyGlobals(); });
    }
    for (const name of ["sof:environment-change", "sof:location-changed"]) {
      window.addEventListener(name, () => { readPlace(); scheduleRender(); });
    }
    try {
      window.SofEnvironmentState?.subscribe?.(() => scheduleRender());
    } catch { /* the events above carry it */ }

    dayBtn.addEventListener("click", () => { standingChoice = "day"; render(); });
    nightBtn.addEventListener("click", () => { standingChoice = "night"; render(); });

    // The season line is the dome's ring signal: follow its
    // hidden state, and re-check on a slow tick (the ring state
    // can change without a mutation on the line itself).
    const line = caption.querySelector("[data-sky-readout]");
    if (line) new MutationObserver(scheduleRender).observe(line, { attributes: true, attributeFilter: ["hidden"] });
    window.setInterval(render, 60000);

    // The armillary's sky line gains its computed words the
    // moment the engine is awake; say so, and say it again on
    // the page's own patient schedule in case its ear opened
    // after the first call.
    try { window.dispatchEvent(new CustomEvent("sof:sky-engine-ready")); } catch { /* no listener yet */ }
    window.setTimeout(() => { try { window.dispatchEvent(new CustomEvent("sof:sky-engine-ready")); } catch { /* stands down */ } }, 2000);
    window.setTimeout(() => { try { window.dispatchEvent(new CustomEvent("sof:sky-engine-ready")); } catch { /* stands down */ } }, 5000);

    readPlace();
    applyGlobals();
    render();
  }

  return {
    VERSION,
    parseISODate,
    civilISOFromCursorDetail,
    tzOffsetForCivil,
    project,
    moonLitPath,
    boot
  };
});
