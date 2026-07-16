(() => {
  'use strict';
  if (window.__REMNANT_MOONS_APP_INITIALIZED__) return;
  window.__REMNANT_MOONS_APP_INITIALIZED__ = true;

  function init() {
    const data = window.RemnantCalendarData;
    const engine = window.RemnantCalendar;
    const storage = window.RemnantCalendarStorage;
    const uiFactory = window.RemnantCalendarUI;
    if (!data || !engine || !storage || !uiFactory) {
      console.error('[13 Moons] initialization failed: missing shared modules');
      document.querySelector('[data-page-status]')?.setAttribute('data-status-visible', 'true');
      const msg = document.querySelector('[data-page-status-message]');
      if (msg) msg.textContent = 'Calendar initialization failed. Refresh the page or reset locally cached site data.';
      return;
    }

    const ui = uiFactory.create();
    try { ui.validate(); } catch (error) { console.error('[13 Moons] initialization failed', error); ui.showStatus('Calendar initialization failed. Refresh the page or reset locally cached site data.'); return; }

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const params = new URLSearchParams(location.search);
    const now = new Date();
    let selectedDate = params.get('date') || engine.formatISODate(now);
    let selectedFocus = params.get('focus') || 'general';
    let currentSunset = params.get('sunset') || data.fallbackSunset;
    let boundaryMode = params.get('boundary') || 'auto';
    const migrated = storage.migrateLegacy();
    let savedLogs = migrated.logs || storage.readLogs();
    const storageAvailable = storage.available();

    const boundaryOptions = () => {
      if (boundaryMode === 'after') return { forceAfterBoundary:true };
      if (boundaryMode === 'before') return { currentMinutes:0 };
      return {};
    };

    function gregorianFor(iso) {
      try {
        const date = engine.normalizeLocalDate(iso);
        return {
          long: new Intl.DateTimeFormat('en-US', { month:'long', day:'numeric', year:'numeric' }).format(date),
          weekday: new Intl.DateTimeFormat('en-US', { weekday:'long' }).format(date)
        };
      } catch { return { long:iso, weekday:'' }; }
    }

    const updateUrl = date => {
      const url = new URL(location.href);
      url.searchParams.set('date', date);
      if (selectedFocus && selectedFocus !== 'general') url.searchParams.set('focus', selectedFocus); else url.searchParams.delete('focus');
      if (boundaryMode && boundaryMode !== 'auto') url.searchParams.set('boundary', boundaryMode); else url.searchParams.delete('boundary');
      history.replaceState({}, '', url);
    };

    function buildState() {
      const state = engine.calculateRemnantDate(selectedDate, { sunset:currentSunset, referenceDate:now, ...boundaryOptions() });
      state.logs = savedLogs;
      state.timeZone = timeZone;
      state.boundaryMode = boundaryMode;
      state.daypart = engine.getDaypart(now);
      state.breathSequence = data.breathSequence;
      state.solarGate = engine.calculateSolarGate(state.effectiveDate);
      state.gregorian = gregorianFor(state.selectedISO);
      state.fieldLayers = data.fieldLayers;
      state.mirror = engine.buildMirrorReading(state, selectedFocus);
      state.astrology = engine.buildAstrologyMirror(state);
      state.seal = engine.buildCodexSeal(state);
      state.patterns = engine.detectPatterns(savedLogs);
      state.witnessTemplate = engine.buildWitnessTemplate(state, ui.readWitnessFields());
      state.yearMap = engine.buildYearMap(selectedDate, { sunset:currentSunset, today:now });
      state.cycle = {
        regularDays: 364,
        finalRegularDayISO: engine.formatISODate(engine.addDays(state.anchor, 363)),
        yearGateISO: state.yearMap.yearGate.iso,
        nextAnchorISO: state.nextAnchorISO,
        elapsedCivilDays: engine.dayDiff(state.nextAnchor, state.anchor)
      };
      return state;
    }

    let lastState = null;
    function render() {
      const state = buildState();
      lastState = state;
      window.CodexState = {
        selectedDate: state.selectedISO,
        effectiveDate: state.effectiveISO,
        moon: state.moonNumber,
        moonDay: state.dayInMoon,
        yearDay: state.yearDay,
        yearGate: state.isYearGate,
        shabbat: state.shabbat.label,
        week: state.weekGate.title,
        phase: state.phase,
        illumination: state.illumination,
        sunset: state.sunset,
        archetype: state.daySeal?.title || state.yearGate.title,
        element: state.moonArchetype?.element || state.solarGate?.element || 'Threshold',
        frequency: state.moonArchetype?.frequency || '—',
        solarGate: `${state.solarGate?.sign || '—'} · ${state.solarGate?.element || ''}`.trim(),
        field: `${state.moonArchetype?.element || 'Threshold'} · ${state.shabbat.label}`
      };
      ui.renderCalendarState(state);
      ui.renderLogs(savedLogs, storageAvailable);
      updateUrl(state.selectedISO);
      if ([state.moonName, state.dayInMoon || state.isYearGate, state.yearDay, state.phase, state.shabbat.label].every(Boolean)) {
        console.info('[13 Moons] initialized successfully');
      }
    }

    const stepDate = amount => { selectedDate = engine.formatISODate(engine.addDays(selectedDate, amount)); render(); };

    function copyToClipboard(text, okMessage) {
      const done = () => ui.showStatus(okMessage, true);
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
      } else { fallbackCopy(text, done); }
    }

    function fallbackCopy(text, done) {
      try {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'absolute';
        area.style.left = '-9999px';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        document.body.removeChild(area);
        done();
      } catch { ui.showStatus('Copy is unavailable in this browser. Select the text manually instead.', true); }
    }

    function saveLog(payload) {
      const state = lastState || buildState();
      const note = String(payload.text || '').trim();
      if (!note) return ui.showStatus('Write a witness note before saving.');
      const result = storage.saveLog({
        date:state.selectedISO,
        effectiveISO:state.effectiveISO,
        moonName:state.moonName,
        moonDay:state.dayInMoon,
        yearDay:state.yearDay,
        shabbat:state.shabbat.label,
        sunset:state.sunset,
        timeZone,
        mirrorTitle:state.mirror.title,
        solarGate:`${state.solarGate?.sign || ''} · ${state.solarGate?.element || ''}`.trim(),
        phase:`${state.phase} · ${state.illumination.toFixed(1)}%`,
        text:note,
        tags:payload.tags,
        notes:payload.notes
      });
      savedLogs = result.logs || savedLogs;
      if (!result.ok) return ui.showStatus('Local storage is unavailable, so the witness log could not be saved.');
      ui.dom.logForm?.reset();
      ui.showStatus('Witness log saved on this device.', true);
      render();
    }

    function enhanceSunset() {
      if (!navigator.geolocation || !window.isSecureContext) return ui.showStatus('Geolocation is unavailable here. The calendar is using the fallback sunset instead.', false);
      navigator.geolocation.getCurrentPosition(position => {
        const sunset = engine.calculateLocalizedSunset(selectedDate, position.coords.latitude, position.coords.longitude, timeZone);
        if (sunset?.time) { currentSunset = sunset.time; render(); return; }
        ui.showStatus('Location was read, but sunset could not be calculated. The fallback sunset remains active.', false);
      }, error => {
        console.warn('[13 Moons] geolocation unavailable', error);
        ui.showStatus('Location permission was denied. The calendar is using the fallback sunset instead.', false);
      }, { enableHighAccuracy:false, timeout:6000, maximumAge:600000 });
    }

    ui.bindEvents({
      onTab: panelId => { ui.activateTab(panelId); if (history.replaceState) { const url = new URL(location.href); url.hash = panelId; history.replaceState({}, '', url); } },
      onStep: amount => stepDate(amount),
      onToday: () => { selectedDate = engine.formatISODate(now); boundaryMode = 'auto'; render(); },
      onDate: value => { selectedDate = value || engine.formatISODate(now); render(); },
      onSunset: value => { currentSunset = value || data.fallbackSunset; render(); },
      onBoundary: value => { boundaryMode = value || 'auto'; render(); },
      onLocate: () => enhanceSunset(),
      onRetry: () => render(),
      onFocus: value => { selectedFocus = value || 'general'; render(); },
      onCopyLink: () => copyToClipboard(location.href, 'Shareable link copied to the clipboard.'),
      onCopyMirror: () => { const state = lastState || buildState(); copyToClipboard(state.mirror.text, 'Mirror reading copied to the clipboard.'); },
      onCopySeal: () => { const state = lastState || buildState(); copyToClipboard(state.seal.text, 'Codex seal copied to the clipboard.'); },
      onWitnessInput: fields => { const state = lastState || buildState(); ui.renderWitnessPreview(engine.buildWitnessTemplate(state, fields)); },
      onCopyWitness: fields => { const state = lastState || buildState(); copyToClipboard(engine.buildWitnessTemplate(state, fields), 'Witness template copied to the clipboard.'); },
      onSaveLog: payload => saveLog(payload),
      onDeleteLog: id => { const result = storage.deleteLog(id); savedLogs = result.logs || []; render(); },
      onCopyLog: id => { const record = savedLogs.find(log => log.id === id); if (record) copyToClipboard(storage.formatRecord(record), 'Witness log copied to the clipboard.'); },
      onCopyAll: () => { const text = storage.formatAll(); if (!text) return ui.showStatus('There are no witness logs to copy yet.', true); copyToClipboard(text, 'All witness logs copied to the clipboard.'); },
      onClearLogs: () => { if (!savedLogs.length) return ui.showStatus('There are no witness logs to clear.', true); if (typeof window.confirm === 'function' && !window.confirm('Delete all witness logs saved on this device? This cannot be undone.')) return; const result = storage.clearAll(); savedLogs = result.logs || []; ui.showStatus('All witness logs cleared from this device.', true); render(); },
      onImport: text => {
        const value = String(text || '').trim();
        if (!value) return ui.showStatus('Paste exported witness JSON before importing.', true);
        const result = storage.importLogs(value);
        if (!result.ok) return ui.showStatus(result.reason === 'invalid-json' ? 'That import could not be parsed as witness JSON.' : 'No importable witness logs were found in that text.', true);
        savedLogs = result.logs || savedLogs;
        if (ui.dom.importInput) ui.dom.importInput.value = '';
        ui.showStatus(`Imported ${result.added} witness log${result.added === 1 ? '' : 's'} into this device.`, true);
        render();
      },
      onExport: () => { const blob = new Blob([storage.exportLogs()], { type:'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `scroll-of-fire-witness-${selectedDate}.json`; anchor.click(); URL.revokeObjectURL(url); }
    });

    document.querySelector('[data-year-map]')?.addEventListener('click', event => {
      const button = event.target.closest('[data-year-map-date]');
      if (!button) return;
      selectedDate = button.getAttribute('data-year-map-date');
      render();
    });

    window.addEventListener('hashchange', () => { const panelId = location.hash.replace('#', ''); if (panelId && document.getElementById(panelId)) ui.activateTab(panelId); });

    const initialPanel = location.hash.replace('#', '');
    ui.activateTab(initialPanel && document.getElementById(initialPanel) ? initialPanel : 'today-panel');
    render();
    window.ScrollOfFireNavigation?.init();
    window.ScrollOfFirePWA?.init();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
