(() => {
  'use strict';

  const fallback = {
    title: 'Today in the Codex',
    moon: 'Open 13 Moons to calculate today.',
    phase: 'Visible moon is available in the calendar.',
    gate: 'The calendar keeps the current week gate.',
    summary: 'The full living calendar remains available even if this preview cannot initialize.'
  };

  const text = (selector, value) => {
    const node = document.querySelector(selector);
    if (node) node.textContent = value;
  };

  const active = (selector, value) => {
    const node = document.querySelector(selector);
    if (node) node.dataset.active = value ? 'true' : 'false';
  };

  const daypartCopy = {
    dawn: { label: 'Dawn Signal', guidance: 'Opening field. Observe first movement and set one clear intention.' },
    day: { label: 'Day Signal', guidance: 'Active field. Build, steward, and record one clean action.' },
    dusk: { label: 'Dusk Signal', guidance: 'Witness field. Review, log, and close loops before night.' },
    night: { label: 'Night Signal', guidance: 'Quiet field. Return, breathe, and preserve the lesson.' }
  };

  const fallbackValue = (value, message) => {
    const raw = typeof value === 'string' ? value.trim() : value;
    if (raw === null || raw === undefined || raw === '' || raw === '—') return message;
    return String(raw);
  };

  function stateFromEngine() {
    const engine = window.RemnantCalendar;
    if (!engine) return null;
    const now = new Date();
    const state = engine.calculateRemnantDate(now);
    const logs = window.RemnantCalendarStorage?.readLogs?.() || [];
    const patterns = engine.detectPatterns(logs);
    const solar = engine.calculateSolarGate(state.effectiveDate);
    const daypart = engine.getDaypart(now);
    return {
      selectedDate: state.selectedISO,
      effectiveDate: state.effectiveISO,
      moon: state.moonNumber,
      moonName: state.moonName,
      moonDay: state.dayInMoon,
      yearDay: state.yearDay,
      yearGate: state.isYearGate,
      shabbat: state.shabbat.label,
      week: state.weekGate.title,
      phase: state.phase,
      illumination: state.illumination,
      sunset: state.sunset,
      archetype: state.daySeal?.title || state.yearGate.title,
      element: state.moonArchetype?.element || solar.element,
      frequency: state.moonArchetype?.frequency || 'Unavailable from selected moon',
      solarGate: `${solar.sign} · ${solar.element}`,
      field: `${state.moonArchetype?.element || 'Threshold'} · ${state.shabbat.label}`,
      logsCount: logs.length,
      patternCount: patterns.count,
      afterBoundary: state.afterBoundary,
      daypart
    };
  }

  function renderTodayFallback() {
    text('[data-home-today-title]', fallback.title);
    text('[data-home-today-moon]', fallback.moon);
    text('[data-home-today-phase]', fallback.phase);
    text('[data-home-today-gate]', fallback.gate);
    text('[data-home-today-summary]', fallback.summary);
    text('[data-home-today-archetype]', 'Archetype unavailable. Open 13 Moons to calculate.');
    text('[data-home-today-solar]', 'Solar Gate unavailable. Open 13 Moons to calculate.');
    text('[data-home-today-field]', 'Field unavailable. Open 13 Moons to calculate.');
    text('[data-home-today-element]', 'Element unavailable. Open 13 Moons to calculate.');
    text('[data-home-today-frequency]', 'Frequency unavailable. Open 13 Moons to calculate.');
    text('[data-home-your-codex-logs]', '0');
    text('[data-home-your-codex-patterns]', '0');
    text('[data-home-your-codex-solar]', 'Unavailable');
    text('[data-home-your-codex-field]', 'Unavailable');
    text('[data-home-your-codex-archetype]', 'Unavailable');
    text('[data-home-your-codex-element]', 'Unavailable');
    text('[data-home-your-codex-frequency]', 'Unavailable');
  }

  function renderLiveSignal(state) {
    const copy = daypartCopy[state.daypart] || daypartCopy.day;
    text('[data-home-signal-daypart]', copy.label);
    text('[data-home-signal-guidance]', copy.guidance);
    text('[data-home-signal-state]', state.afterBoundary ? 'Boundary crossed' : 'Before boundary');
    text('[data-home-signal-shabbat]', state.shabbat);
    text('[data-home-signal-phase]', `${state.phase} · ${state.illumination.toFixed(1)}%`);
  }

  function renderContinuity(state) {
    text('[data-home-continue-date]', `${state.selectedDate} → ${state.effectiveDate}`);
    text('[data-home-continue-moon]', state.yearGate ? 'Year Gate / Day Out of Time' : `${state.moonName} · Moon Day ${state.moonDay}`);
    text('[data-home-continue-route]', `${state.week} · ${state.shabbat}`);
    text('[data-home-your-codex-logs]', String(state.logsCount));
    text('[data-home-your-codex-patterns]', String(state.patternCount));
    text('[data-home-your-codex-solar]', fallbackValue(state.solarGate, 'Solar Gate unavailable'));
    text('[data-home-your-codex-field]', fallbackValue(state.field, 'Field unavailable'));
    text('[data-home-your-codex-archetype]', fallbackValue(state.archetype, 'Archetype unavailable'));
    text('[data-home-your-codex-element]', fallbackValue(state.element, 'Element unavailable'));
    text('[data-home-your-codex-frequency]', fallbackValue(state.frequency, 'Frequency unavailable'));
    active('[data-home-your-codex-panel]', state.logsCount > 0);
  }

  function renderToday() {
    const state = stateFromEngine();
    if (!state) return renderTodayFallback();
    try {
      text('[data-home-today-title]', state.moonName);
      text('[data-home-today-moon]', state.yearGate ? 'Year Gate / Day Out of Time' : `Moon ${state.moon} · Day ${state.moonDay} · Year Day ${state.yearDay}`);
      text('[data-home-today-phase]', `${state.phase} · ${state.illumination.toFixed(1)}% illumination`);
      text('[data-home-today-gate]', `${state.week} · ${state.shabbat}`);
      text('[data-home-today-summary]', `${state.afterBoundary ? `Sunset boundary crossed; effective date ${state.effectiveDate}.` : `Sunset boundary ${state.sunset}.`} Solar Gate ${state.solarGate}. Field ${state.field}.`);
      text('[data-home-today-date]', `${state.selectedDate} selected · ${state.effectiveDate} effective`);
      text('[data-home-today-sunset]', state.sunset);
      text('[data-home-today-shabbat]', state.shabbat);
      text('[data-home-today-solar]', fallbackValue(state.solarGate, 'Solar Gate unavailable'));
      text('[data-home-today-field]', fallbackValue(state.field, 'Field unavailable'));
      text('[data-home-today-archetype]', fallbackValue(state.archetype, 'Archetype unavailable'));
      text('[data-home-today-element]', fallbackValue(state.element, 'Element unavailable'));
      text('[data-home-today-frequency]', fallbackValue(state.frequency, 'Frequency unavailable'));
      window.CodexState = { ...(window.CodexState || {}), ...state };
      renderLiveSignal(state);
      renderContinuity(state);
    } catch {
      renderTodayFallback();
    }
  }

  async function renderActivity() {
    const list = document.querySelector('[data-home-activity-list]');
    if (!list) return;
    try {
      const response = await fetch(new URL('assets/data/codex-updates.json', document.baseURI));
      if (!response.ok) throw new Error('feed unavailable');
      const entries = await response.json();
      list.replaceChildren(...entries.slice(0, 3).map(entry => {
        const item = document.createElement('li');
        item.textContent = `${entry.date || 'Recently'} · ${entry.title || entry.name || 'Codex update'}`;
        return item;
      }));
    } catch {
      list.innerHTML = '<li>Recent Codex activity is unavailable locally. The systems remain available through their gateways.</li>';
    }
  }

  function init() {
    renderToday();
    text('#year', String(new Date().getFullYear()));
    window.ScrollOfFireNavigation?.init();
    window.ScrollOfFirePWA?.init();
    renderActivity();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
