(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const state = { selectedSystem: "living-time", selectedEvent: null };
  const esc = value => String(value ?? "").replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char]));
  function announce(message) { const node = $("mission-action-status"); if (node) node.textContent = message; }
  async function copyText(text, success) {
    try { await navigator.clipboard.writeText(text); announce(success); }
    catch (_) { announce("Copy was blocked. Select and copy the displayed data manually."); }
  }
  function downloadText(filename, text, type = "application/json") {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = filename; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function fmtPattern(pattern) {
    if (!pattern) return "Pattern position unavailable";
    if (pattern.isDayOutOfTime) return `Pattern Year ${pattern.patternYear} · Day Out of Time`;
    if (pattern.isDeepTimeDay) return `Pattern Year ${pattern.patternYear} · Deep Time Day`;
    return `PY ${pattern.patternYear} · M${pattern.moon} ${pattern.moonName || ""} · D${pattern.day} · ${pattern.dayOfPatternYear}/364`;
  }

  function renderSystemGraph() {
    const shell = $("mission-system-grid");
    if (!shell || !globalThis.CodexSystemRegistry) return;
    const status = globalThis.CodexSystemRegistry.liveStatus();
    shell.innerHTML = globalThis.CodexSystemRegistry.systems.map(system => {
      const selected = state.selectedSystem === system.id;
      return `<article class="mission-system-card${selected ? " is-selected" : ""}" data-system-id="${system.id}">
        <button type="button" class="mission-system-select" data-mission-system="${system.id}" aria-pressed="${selected}">
          <span class="mission-system-domain">${system.domain}</span>
          <strong>${system.name}</strong>
          <small>${system.role}</small>
        </button>
        <div class="mission-system-io"><span>IN ${system.inputs.length}</span><span>OUT ${system.outputs.length}</span><a href="${system.href}">OPEN ↗</a></div>
      </article>`;
    }).join("");

    $("mission-live-records").textContent = String(status.records);
    $("mission-live-quests").textContent = String(status.quests);
    $("mission-live-network").textContent = status.online ? "ONLINE" : "OFFLINE";
    $("mission-live-storage").textContent = status.storageAvailable ? "READY" : "LIMITED";
  }

  function renderSystemDetail(systemId) {
    const system = globalThis.CodexSystemRegistry?.systems.find(item => item.id === systemId);
    const target = $("mission-system-detail");
    if (!system || !target) return;
    const links = globalThis.CodexSystemRegistry.edges.filter(edge => edge.from === systemId || edge.to === systemId);
    target.innerHTML = `<header><span>${system.domain} SYSTEM</span><h3>${system.name}</h3><p>${system.role}</p></header>
      <div class="mission-detail-columns"><section><h4>Inputs</h4><ul>${system.inputs.map(x => `<li>${x}</li>`).join("")}</ul></section>
      <section><h4>Outputs</h4><ul>${system.outputs.map(x => `<li>${x}</li>`).join("")}</ul></section>
      <section><h4>Connections</h4><ul>${links.map(edge => `<li>${edge.from === systemId ? "→" : "←"} ${edge.relation}</li>`).join("") || "<li>No registered links</li>"}</ul></section></div>
      <a class="mission-open-system" href="${system.href}">Open ${system.name}</a>`;
  }

  function populateTimeControls() {
    const year = $("mission-year");
    if (!year) return;
    const current = new Date().getUTCFullYear();
    const requested = globalThis.LivingTimeSphereUrlState?.parseSphereUrl?.(location.href)?.deepTimeYear;
    year.value = String(requested || current);
    $("mission-time-range").textContent = `${globalThis.DeepTimeSeasonalLedger?.supportedRange.start || 1000}–${globalThis.DeepTimeSeasonalLedger?.supportedRange.end || 3000} CE`;
  }

  function renderSeasonalYear() {
    const target = $("mission-seasonal-events");
    if (!target || !globalThis.DeepTimeSeasonalLedger) return;
    const year = Math.max(1000, Math.min(3000, Number($("mission-year")?.value) || new Date().getUTCFullYear()));
    const selectedKey = $("mission-event")?.value || "marchEquinox";
    let built;
    try { built = globalThis.DeepTimeSeasonalLedger.buildYear(year); }
    catch (error) { target.innerHTML = `<p class="mission-error">${error.message}</p>`; return; }
    target.innerHTML = built.events.map(event => `<button type="button" class="mission-event-card${event.eventKey === selectedKey ? " is-selected" : ""}" data-mission-event="${event.eventKey}">
      <span>${event.label}</span><strong>${new Date(event.utcInstant).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC</strong>
      <small>${fmtPattern(event.pattern)}</small><em data-tier="${event.status}">${event.statusLabel} · ±${event.uncertaintyMinutes}m</em>
    </button>`).join("");
    const selected = built.events.find(event => event.eventKey === selectedKey) || built.events[0];
    state.selectedEvent = selected;
    renderEventDetail(selected);
  }

  function renderEventDetail(event) {
    const target = $("mission-event-detail");
    if (!target || !event) return;
    target.innerHTML = `<div><span class="mission-kicker">SELECTED TEMPORAL EVENT</span><h3>${esc(event.year)} ${esc(event.label)}</h3><p>${esc(fmtPattern(event.pattern))}</p></div>
      <dl><dt>UTC</dt><dd>${esc(event.utcInstant)}</dd><dt>TT JDE</dt><dd>${esc(event.julianEphemerisDateTT ?? "Stored source")}</dd><dt>ΔT</dt><dd>${esc(event.deltaTSeconds ?? "Source-defined")} ${event.deltaTSeconds != null ? "seconds" : ""}</dd><dt>Method</dt><dd>${esc(event.method)}</dd><dt>Confidence</dt><dd>${esc(event.statusLabel)}</dd><dt>Uncertainty</dt><dd>±${esc(event.uncertaintyMinutes)} minutes</dd><dt>North</dt><dd>${esc(event.seasonNorth)}</dd><dt>South</dt><dd>${esc(event.seasonSouth)}</dd></dl>
      <p class="mission-limit">${esc(event.provenance.limitations)}</p>`;
  }

  function eventSphereUrl(event = state.selectedEvent) {
    if (!event) return null;
    return globalThis.LivingTimeSphereUrlState?.buildSphereUrl?.({
      baseUrl: location.origin + location.pathname,
      deepTimeYear: event.year,
      viewMode: "years",
      marker: event.id,
      layers: ["pattern", "exactDays", "weekGates", "passage", "lunar", "solar", "markers", "spiral", "connections"]
    }) || `${location.pathname}?view=years&deep_year=${encodeURIComponent(event.year)}&marker=${encodeURIComponent(event.id)}`;
  }

  function loadSelectedEvent() {
    const event = state.selectedEvent;
    if (!event) return announce("Select a seasonal event first.");
    const url = eventSphereUrl(event);
    history.replaceState({}, "", url);
    const loaded = globalThis.LivingTimeSphereUi?.loadDeepTimeEvent?.(event);
    if (!loaded) applySphereCommand("pattern");
    announce(`${event.year} ${event.label} loaded at ${fmtPattern(event.pattern)}.`);
  }

  function copySelectedEvent() {
    if (!state.selectedEvent) return announce("Select a seasonal event first.");
    copyText(JSON.stringify(state.selectedEvent, null, 2), "Seasonal event JSON copied.");
  }

  function exportSelectedYear() {
    const year = state.selectedEvent?.year || Number($("mission-year")?.value);
    if (!year || !globalThis.DeepTimeSeasonalLedger) return announce("Choose a valid year first.");
    downloadText(`living-time-seasonal-ledger-${year}.json`, globalThis.DeepTimeSeasonalLedger.exportYear(year));
    announce(`Seasonal ledger for ${year} exported.`);
  }

  function copyShareLink() {
    const url = eventSphereUrl();
    if (!url) return announce("Select a seasonal event first.");
    copyText(url, "Deep-time Sphere link copied.");
  }

  function applySphereCommand(command) {
    const mapping = {
      today: "sphere-mode-today",
      pattern: "sphere-mode-pattern",
      passage: "sphere-mode-passage",
      years: "sphere-mode-years",
      reset: "sphere-reset"
    };
    const id = mapping[command];
    if (id) $(id)?.click();
  }

  function toggleLayer(layer, checked) {
    const control = $(`sphere-layer-${layer}`);
    if (!control) return;
    control.checked = checked;
    control.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function bind() {
    document.addEventListener("click", event => {
      const system = event.target.closest("[data-mission-system]");
      if (system) {
        state.selectedSystem = system.dataset.missionSystem;
        renderSystemGraph();
        renderSystemDetail(state.selectedSystem);
      }
      const seasonal = event.target.closest("[data-mission-event]");
      if (seasonal) {
        $("mission-event").value = seasonal.dataset.missionEvent;
        renderSeasonalYear();
      }
      const command = event.target.closest("[data-sphere-command]");
      if (command) applySphereCommand(command.dataset.sphereCommand);
    });

    $("mission-year")?.addEventListener("change", renderSeasonalYear);
    $("mission-event")?.addEventListener("change", renderSeasonalYear);
    $("mission-jump-now")?.addEventListener("click", () => { $("mission-year").value = new Date().getUTCFullYear(); renderSeasonalYear(); applySphereCommand("today"); });
    $("mission-load-event")?.addEventListener("click", loadSelectedEvent);
    $("mission-copy-event")?.addEventListener("click", copySelectedEvent);
    $("mission-export-year")?.addEventListener("click", exportSelectedYear);
    $("mission-copy-link")?.addEventListener("click", copyShareLink);
    document.querySelectorAll("[data-mission-layer]").forEach(input => input.addEventListener("change", () => toggleLayer(input.dataset.missionLayer, input.checked)));
    window.addEventListener("online", renderSystemGraph);
    window.addEventListener("offline", renderSystemGraph);
  }

  function init() {
    if (!$("observatory-mission-control")) return;
    populateTimeControls();
    renderSystemGraph();
    renderSystemDetail(state.selectedSystem);
    renderSeasonalYear();
    bind();
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init, { once: true }) : init();
  globalThis.ObservatoryMissionControl = Object.freeze({ init, renderSeasonalYear, renderSystemGraph });
})();
