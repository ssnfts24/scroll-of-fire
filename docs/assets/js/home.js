(() => {
  'use strict';

  const MOON_NAMES = ['Seed Flame', 'Root Waters', 'Breath Gate', 'Stone Witness', 'Living Word', 'Fire Trial', 'Crown Balance', 'Deep Mirror', 'Return Path', 'Builder\'s Hand', 'Star Remembrance', 'River of Signs', 'Completion Seal'];
  const WEEK_GATES = ['Week 1 · Ignition', 'Week 2 · Formation', 'Week 3 · Testing', 'Week 4 · Sealing'];
  const ANCHOR_OVERRIDE = { 2026: '2026-04-17' };
  const DAY_MS = 86400000;
  const SYNODIC_MONTH = 29.530588853;
  const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14, 0);

  const normalize = date => typeof date === 'string'
    ? new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), 12, 0, 0, 0)
    : new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
  const addDays = (date, amount) => { const value = normalize(date); value.setDate(value.getDate() + amount); return normalize(value); };
  const dayDiff = (a, b) => Math.round((Date.UTC(normalize(a).getFullYear(), normalize(a).getMonth(), normalize(a).getDate()) - Date.UTC(normalize(b).getFullYear(), normalize(b).getMonth(), normalize(b).getDate())) / DAY_MS);
  const moonAge = date => { const value = normalize(date); const time = Date.UTC(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0, 0); const days = (time - KNOWN_NEW_MOON) / DAY_MS; return ((days % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH; };
  const phaseName = age => age < 1.2 || age > 28.3 ? 'New Moon' : age < 6.4 ? 'Waxing Crescent' : age < 8.4 ? 'First Quarter' : age < 13.8 ? 'Waxing Gibbous' : age < 16.2 ? 'Full Moon' : age < 21.6 ? 'Waning Gibbous' : age < 23.6 ? 'Last Quarter' : 'Waning Crescent';

  function nearestNewMoonAfter(date) {
    let cursor = normalize(date);
    for (let index = 0; index < 40; index += 1) {
      const age = moonAge(cursor);
      const nextAge = moonAge(addDays(cursor, 1));
      if (age > 28.5 || nextAge < age) return addDays(cursor, 1);
      cursor = addDays(cursor, 1);
    }
    return cursor;
  }

  const anchorForYear = year => ANCHOR_OVERRIDE[year] ? normalize(ANCHOR_OVERRIDE[year]) : nearestNewMoonAfter(new Date(year, 2, 20, 12, 0, 0, 0));
  const yearAnchorFor = date => { const value = normalize(date); const candidate = anchorForYear(value.getFullYear()); return value < candidate ? anchorForYear(value.getFullYear() - 1) : candidate; };

  function calculateTodayPreview() {
    const today = normalize(new Date());
    const effective = new Date().getHours() * 60 + new Date().getMinutes() >= 18 * 60 ? addDays(today, 1) : today;
    const anchor = yearAnchorFor(effective);
    const diff = dayDiff(effective, anchor);
    if (diff < 0 || diff >= 364) return { title: 'Year Gate / Day Out of Time', day: 'Year Gate', phase: phaseName(moonAge(effective)), weekGate: 'Threshold pause', summary: 'The counted year is resting at the threshold before the next anchor.' };
    const moonNumber = Math.floor(diff / 28) + 1;
    const dayInMoon = (diff % 28) + 1;
    return { title: MOON_NAMES[moonNumber - 1], day: `Moon Day ${dayInMoon}`, phase: phaseName(moonAge(effective)), weekGate: WEEK_GATES[Math.floor((dayInMoon - 1) / 7)], summary: `${MOON_NAMES[moonNumber - 1]} is carrying today through ${WEEK_GATES[Math.floor((dayInMoon - 1) / 7)]}. Sunset boundary 18:00.` };
  }

  async function renderActivity() {
    const list = document.querySelector('[data-home-activity-list]');
    if (!list) return;
    try {
      const response = await fetch(new URL('assets/data/codex-updates.json', document.baseURI));
      if (!response.ok) throw new Error('feed unavailable');
      const entries = await response.json();
      list.innerHTML = '';
      entries.slice(0, 3).forEach(entry => {
        const item = document.createElement('li');
        item.textContent = `${entry.date || 'Recently'} · ${entry.title || entry.name || 'Codex update'}`;
        list.appendChild(item);
      });
    } catch {
      list.innerHTML = '<li>Recent Codex activity loads when the local update feed is available.</li>';
    }
  }

  function init() {
    const preview = calculateTodayPreview();
    document.querySelector('[data-home-today-title]')?.replaceChildren(document.createTextNode(preview.title));
    document.querySelector('[data-home-today-day]')?.replaceChildren(document.createTextNode(preview.day));
    document.querySelector('[data-home-today-phase]')?.replaceChildren(document.createTextNode(preview.phase));
    document.querySelector('[data-home-today-gate]')?.replaceChildren(document.createTextNode(preview.weekGate));
    document.querySelector('[data-home-today-summary]')?.replaceChildren(document.createTextNode(preview.summary));
    document.getElementById('year')?.replaceChildren(document.createTextNode(String(new Date().getFullYear())));
    window.ScrollOfFireNavigation?.init();
    window.ScrollOfFirePWA?.init();
    renderActivity();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
