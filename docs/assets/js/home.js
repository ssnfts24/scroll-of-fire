(() => {
  'use strict';

  const fallback = {
    title: 'Today in the Codex',
    day: 'Open 13 Moons to calculate today.',
    phase: 'Visible moon is available in the calendar.',
    gate: 'The calendar keeps the current week gate.',
    summary: 'The full living calendar remains available even if this preview cannot initialize.'
  };

  const text = (selector, value) => {
    const node = document.querySelector(selector);
    if (node) node.textContent = value;
  };

  function renderToday() {
    const engine = window.RemnantCalendar;
    if (!engine) {
      text('[data-home-today-title]', fallback.title);
      text('[data-home-today-day]', fallback.day);
      text('[data-home-today-phase]', fallback.phase);
      text('[data-home-today-gate]', fallback.gate);
      text('[data-home-today-summary]', fallback.summary);
      return;
    }
    try {
      const state = engine.calculateRemnantDate(new Date());
      const moon = state.isYearGate ? state.yearGate.title : `${state.moonName} · Moon Day ${state.dayInMoon}`;
      const boundary = state.afterBoundary ? `The sunset boundary has passed; effective date ${state.effectiveISO}.` : `Sunset boundary ${state.sunset}.`;
      text('[data-home-today-title]', moon);
      text('[data-home-today-day]', state.isYearGate ? 'Year Gate / Day Out of Time' : `Year Day ${state.yearDay} · Week ${state.weekGate.index}`);
      text('[data-home-today-phase]', `${state.phase} · ${state.illumination.toFixed(1)}% illumination`);
      text('[data-home-today-gate]', `${state.shabbat.label} · ${state.weekGate.title}`);
      text('[data-home-today-summary]', `${boundary} ${state.shabbat.detail}`);
    } catch {
      renderTodayFallback();
    }
  }

  function renderTodayFallback() {
    text('[data-home-today-title]', fallback.title);
    text('[data-home-today-day]', fallback.day);
    text('[data-home-today-phase]', fallback.phase);
    text('[data-home-today-gate]', fallback.gate);
    text('[data-home-today-summary]', fallback.summary);
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
