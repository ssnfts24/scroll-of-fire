/*
 * The Farm on the Sphere — wiring the farm layer (PR #186) into the
 * Sphere page itself.
 *
 * Aaron's direction (Nov 19, 2026), with the Sphere open on the farm
 * preview: "the farming dating and seasons and everything should be
 * on the sphere." So the Selected day panel in the Sphere's sidebar
 * gains a Farm section that answers for the SELECTED day, not just
 * today: the season for that date, and for the keeper's county, what
 * to start indoors, what to sow, what to put out, what is too early,
 * and the frost-watch lines at the season edges.
 *
 * How it stays lawful on a protected page:
 *   - This is an overlay module. It is loaded by the companion layer
 *     (sphere-companion-layer.js) and it never touches the sphere
 *     engine, geometry, camera, picking, or the day-zoom module.
 *   - The selected day arrives through the instrument's own public
 *     signals: the temporal cursor events (sof:selected-date-change
 *     and friends, whose detail carries the canonical coordinate) and
 *     the cursor's published globals. The civil date is read from
 *     the canonical coordinate itself, or computed through
 *     PatternCalendar.fromCivilDate — never a second clock.
 *   - All planting facts come from CodexSphereFarmPanel
 *     (sphere-farm-panel.js) over the sourced dataset
 *     (assets/data/farm-western-wa.json). This module holds no
 *     planting facts of its own; it only names the season and
 *     carries the day to the panel.
 *   - Moon timing is not generated here and none is passed to the
 *     panel, so no Codex layer appears in this section. If one is
 *     ever added, the panel returns it under its own separate
 *     label, apart from the extension facts — the standing rule.
 *
 * The county choice is the visitor's own: it rests in their local
 * record on this device (localStorage), defaults to Lewis County,
 * and is never sent anywhere.
 */
(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.CodexSphereFarmSphere = api;

  if (typeof document !== "undefined" && typeof window !== "undefined") {
    api.boot();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "sphere-farm-sphere/1.0.0";
  const COUNTY_STORAGE_KEY = "sof.sphere.farm.county.v1";
  const DEFAULT_COUNTY = "lewis";
  const DATA_URL = "assets/data/farm-western-wa.json";

  /* ── Pure helpers (tested) ───────────────────────────────────── */

  function parseISODate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
    if (!m) return null;
    return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  }

  /* The season for a civil date, northern hemisphere, named plainly.
   * The boundaries are the conventional season turns (the equinox
   * and solstice dates the almanacs print); the farm data itself is
   * western Washington, so the seasons are Washington's. */
  function seasonForCivilDate(iso) {
    const p = parseISODate(iso);
    if (!p) return null;
    const md = p.month * 100 + p.day;
    let name;
    if (md >= 320 && md < 621) name = "Spring";
    else if (md >= 621 && md < 923) name = "Summer";
    else if (md >= 923 && md < 1221) name = "Autumn";
    else name = "Winter";
    return { name, line: `Season: ${name} in western Washington.` };
  }

  function formatCivilLong(iso) {
    const p = parseISODate(iso);
    if (!p) return null;
    const date = new Date(Date.UTC(p.year, p.month - 1, p.day));
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC"
    });
  }

  /* The civil date of the selected day, read from the canonical
   * coordinate the cursor publishes. No date is ever derived here
   * from a Pattern Day by local arithmetic. */
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

  function coordinateFromCursorDetail(detail) {
    if (!detail || typeof detail !== "object") return null;
    const r = detail.coordinate?.remnant13Moons || detail.remnant13Moons || null;
    if (r && r.moon != null && r.moonDay != null) {
      return {
        moon: r.moon,
        day: r.moonDay,
        patternDay: r.patternDay ?? null,
        moonName: r.moonName || null
      };
    }
    const s = detail.coordinate || detail;
    if (s && s.moon != null && s.day != null && (s.dayOfPatternYear != null || s.patternDay != null)) {
      return {
        moon: s.moon,
        day: s.day,
        patternDay: s.dayOfPatternYear ?? s.patternDay ?? null,
        moonName: s.moonName || null
      };
    }
    return null;
  }

  function coordinateLine(coord) {
    if (!coord) return null;
    let line = `Moon ${coord.moon} · Day ${coord.day}`;
    if (coord.patternDay != null) line += ` · Pattern Day ${coord.patternDay}`;
    return line;
  }

  /* ── Browser wiring ──────────────────────────────────────────── */

  function readStoredCounty() {
    try {
      const v = window.localStorage.getItem(COUNTY_STORAGE_KEY);
      return v && /^[a-z-]+$/.test(v) ? v : DEFAULT_COUNTY;
    } catch {
      return DEFAULT_COUNTY;
    }
  }

  function storeCounty(id) {
    try {
      window.localStorage.setItem(COUNTY_STORAGE_KEY, id);
    } catch {
      /* The choice simply does not persist on this device. */
    }
  }

  function boot() {
    const sidebar = document.querySelector(".sphere-sidebar");
    if (!sidebar) return;
    if (sidebar.querySelector("[data-sphere-farm-section]")) return;

    const section = document.createElement("div");
    section.className = "sphere-sidebar-section sphere-farm-section";
    section.setAttribute("data-sphere-farm-section", "");
    section.innerHTML = `
      <h2 class="sphere-sidebar-heading">Farm — the ground under this day</h2>
      <p class="sphere-farm-day-line" data-farm-day-line>Choose a day on the Sphere, and the farm notes for that day will stand here.</p>
      <p class="sphere-farm-season-line" data-farm-season-line hidden></p>
      <p class="sphere-farm-county-row">
        <label class="sphere-farm-county-label" for="sphere-farm-county">County</label>
        <select id="sphere-farm-county" class="sphere-control-select" data-farm-county></select>
      </p>
      <div class="sphere-farm-body" data-farm-body aria-live="polite">
        <p class="sphere-farm-line">The planting calendar is being fetched…</p>
      </div>`;

    const sections = sidebar.querySelectorAll(".sphere-sidebar-section");
    let placed = false;
    for (const s of sections) {
      const heading = s.querySelector(".sphere-sidebar-heading");
      if (heading && /^selected day/i.test((heading.textContent || "").trim())) {
        s.insertAdjacentElement("afterend", section);
        placed = true;
        break;
      }
    }
    if (!placed) sidebar.appendChild(section);

    const dayLineEl = section.querySelector("[data-farm-day-line]");
    const seasonLineEl = section.querySelector("[data-farm-season-line]");
    const countySelect = section.querySelector("[data-farm-county]");
    const bodyEl = section.querySelector("[data-farm-body]");

    let farmData = null;
    let dataFailed = false;
    let county = readStoredCounty();
    let currentISO = null;
    let currentCoord = null;

    function renderBody() {
      bodyEl.textContent = "";
      const addLine = (text, cls) => {
        const p = document.createElement("p");
        p.className = cls || "sphere-farm-line";
        p.textContent = text;
        bodyEl.appendChild(p);
      };
      if (!currentISO) {
        addLine("Choose a day on the Sphere, and the farm notes for that day will stand here.");
        return;
      }
      if (dataFailed) {
        addLine("The planting calendar could not be loaded on this visit, so no farm notes are shown rather than guessed ones.");
        return;
      }
      if (!farmData) {
        addLine("The planting calendar is being fetched…");
        return;
      }
      const Panel = window.CodexSphereFarmPanel;
      if (!Panel || typeof Panel.adviceForDate !== "function") {
        addLine("The farm panel is not awake on this page yet, so no farm notes are shown rather than guessed ones.");
        return;
      }
      const advice = Panel.adviceForDate(farmData, county, currentISO);
      if (!advice.ok) {
        addLine(advice.reason);
        return;
      }
      for (const line of Panel.renderLines(advice)) {
        let cls = "sphere-farm-line";
        if (/:$/.test(line)) cls = "sphere-farm-line sphere-farm-group";
        else if (/^Frost is still in play|^The fall edge is near/.test(line)) cls = "sphere-farm-line sphere-farm-frost";
        else if (/^Sources:/.test(line)) cls = "sphere-farm-line sphere-farm-sources";
        addLine(line, cls);
      }
    }

    function render() {
      if (currentISO) {
        const coordText = coordinateLine(currentCoord);
        const civilText = formatCivilLong(currentISO);
        dayLineEl.textContent = coordText ? `${coordText} — ${civilText}` : civilText;
        const season = seasonForCivilDate(currentISO);
        seasonLineEl.textContent = season ? season.line : "";
        seasonLineEl.hidden = !season;
      } else {
        dayLineEl.textContent = "Choose a day on the Sphere, and the farm notes for that day will stand here.";
        seasonLineEl.hidden = true;
      }
      renderBody();
    }

    function applyDetail(detail) {
      const iso = civilISOFromCursorDetail(detail);
      const coord = coordinateFromCursorDetail(detail);
      if (!iso && !coord) return false;
      if (iso) currentISO = iso;
      if (coord) currentCoord = coord;
      render();
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
          if (summary && summary.civilDate) {
            currentISO = summary.civilDate;
            currentCoord = summary.moon != null
              ? { moon: summary.moon, day: summary.day, patternDay: summary.dayOfPatternYear ?? null, moonName: summary.moonName || null }
              : null;
            render();
          }
        } catch {
          /* The cursor's events remain the primary signal. */
        }
      }
    }

    for (const name of ["sof:selected-date-change", "sof:temporal-cursor-change", "sof:temporal-cursor-ready"]) {
      window.addEventListener(name, (e) => { if (!applyDetail(e.detail)) applyGlobals(); });
    }

    // Fallback: the state strip is the instrument's own readout; if
    // it changes and our day is stale, re-read the cursor's globals.
    const strip = document.getElementById("sphere-state-strip");
    if (strip) {
      let lastStrip = "";
      new MutationObserver(() => {
        const text = (strip.textContent || "").trim();
        if (text && text !== lastStrip) {
          lastStrip = text;
          applyGlobals();
        }
      }).observe(strip, { childList: true, subtree: true, characterData: true });
    }

    countySelect.addEventListener("change", () => {
      county = countySelect.value || DEFAULT_COUNTY;
      storeCounty(county);
      render();
    });

    fetch(DATA_URL)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => {
        farmData = data;
        const locations = Array.isArray(data.locations) ? data.locations : [];
        countySelect.textContent = "";
        for (const loc of locations) {
          const opt = document.createElement("option");
          opt.value = loc.id;
          opt.textContent = loc.county;
          countySelect.appendChild(opt);
        }
        if (!locations.some((l) => l.id === county)) county = DEFAULT_COUNTY;
        countySelect.value = county;
        render();
      })
      .catch(() => {
        dataFailed = true;
        render();
      });

    applyGlobals();
    render();
  }

  return {
    VERSION,
    COUNTY_STORAGE_KEY,
    DEFAULT_COUNTY,
    seasonForCivilDate,
    formatCivilLong,
    civilISOFromCursorDetail,
    coordinateFromCursorDetail,
    coordinateLine,
    boot
  };
});
