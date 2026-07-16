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

    const params = new URLSearchParams(location.search);
    const now = new Date();
    let selectedDate = params.get('date') || engine.formatISODate(now);
    let selectedFocus = 'general';
    let currentSunset = params.get('sunset') || data.fallbackSunset;
    const migrated = storage.migrateLegacy();
    let savedLogs = migrated.logs || storage.readLogs();
    const storageAvailable = storage.available();

    const updateUrl = date => { const url = new URL(location.href); url.searchParams.set('date', date); history.replaceState({}, '', url); };

    function buildState() {
      const state = engine.calculateRemnantDate(selectedDate, { sunset:currentSunset, referenceDate:now });
      state.logs = savedLogs;
      state.mirror = engine.buildMirrorReading(state, selectedFocus);
      state.yearMap = engine.buildYearMap(selectedDate, { sunset:currentSunset, today:now });
      return state;
    }

    function render() {
      const state = buildState();
      ui.renderCalendarState(state);
      ui.renderLogs(savedLogs, storageAvailable);
      updateUrl(state.selectedISO);
      if ([state.moonName, state.dayInMoon || state.isYearGate, state.yearDay, state.phase, state.shabbat.label].every(Boolean)) {
        console.info('[13 Moons] initialized successfully');
      }
    }

    const stepDate = amount => { selectedDate = engine.formatISODate(engine.addDays(selectedDate, amount)); render(); };

    function saveLog(payload) {
      const state = buildState();
      const note = String(payload.text || '').trim();
      if (!note) return ui.showStatus('Write a witness note before saving.');
      const result = storage.saveLog({ date:state.selectedISO, effectiveISO:state.effectiveISO, moonName:state.moonName, moonDay:state.dayInMoon, yearDay:state.yearDay, shabbat:state.shabbat.label, sunset:state.sunset, timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone, mirrorTitle:state.mirror.title, text:note, tags:payload.tags });
      savedLogs = result.logs || savedLogs;
      if (!result.ok) return ui.showStatus('Local storage is unavailable, so the witness log could not be saved.');
      ui.dom.logForm?.reset();
      render();
    }

    function enhanceSunset() {
      if (!navigator.geolocation || !window.isSecureContext) return ui.showStatus('Geolocation is unavailable here. The calendar is using the fallback sunset instead.', false);
      navigator.geolocation.getCurrentPosition(position => {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const sunset = engine.calculateLocalizedSunset(selectedDate, position.coords.latitude, position.coords.longitude, timeZone);
        if (sunset?.time) { currentSunset = sunset.time; render(); return; }
        ui.showStatus('Location was read, but sunset could not be calculated. The fallback sunset remains active.', false);
      }, error => {
        console.warn('[13 Moons] geolocation unavailable', error);
        ui.showStatus('Location permission was denied. The calendar is using the fallback sunset instead.', false);
      }, { enableHighAccuracy:false, timeout:6000, maximumAge:600000 });
    }

    ui.bindEvents({
      onTab: panelId => ui.activateTab(panelId),
      onStep: amount => stepDate(amount),
      onToday: () => { selectedDate = engine.formatISODate(now); render(); },
      onDate: value => { selectedDate = value || engine.formatISODate(now); render(); },
      onSunset: value => { currentSunset = value || data.fallbackSunset; render(); },
      onLocate: () => enhanceSunset(),
      onRetry: () => render(),
      onFocus: value => { selectedFocus = value || 'general'; render(); },
      onSaveLog: payload => saveLog(payload),
      onDeleteLog: id => { const result = storage.deleteLog(id); savedLogs = result.logs || []; render(); },
      onExport: () => { const blob = new Blob([storage.exportLogs()], { type:'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `scroll-of-fire-witness-${selectedDate}.json`; anchor.click(); URL.revokeObjectURL(url); }
    });

    document.querySelector('[data-year-map]')?.addEventListener('click', event => {
      const button = event.target.closest('[data-year-map-date]');
      if (!button) return;
      selectedDate = button.getAttribute('data-year-map-date');
      render();
    });

    ui.activateTab(location.hash.replace('#', '') || 'today-panel');
    render();
    window.ScrollOfFireNavigation?.init();
    window.ScrollOfFirePWA?.init();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
