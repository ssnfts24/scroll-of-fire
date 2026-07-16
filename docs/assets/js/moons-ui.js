(() => {
  'use strict';
  if (window.RemnantCalendarUI) return;

  const REQUIRED_OUTPUTS = ['moon-name','moon-day','year-day','visible-phase','illumination','week-gate','shabbat-state','sunset','mirror-title'];

  function create() {
    const outputs = Object.fromEntries(REQUIRED_OUTPUTS.map(name => [name, document.querySelector(`[data-moon-output="${name}"]`)]));
    const dom = {
      outputs,
      tabs: Array.from(document.querySelectorAll('[role="tab"]')),
      panels: Array.from(document.querySelectorAll('[role="tabpanel"]')),
      dateInput: document.querySelector('[data-date-input]'),
      previousButton: document.querySelector('[data-date-step="previous"]'),
      nextButton: document.querySelector('[data-date-step="next"]'),
      todayButton: document.querySelector('[data-date-step="today"]'),
      locateButton: document.querySelector('[data-date-step="locate"]'),
      sunsetInput: document.querySelector('[data-sunset-input]'),
      retryButton: document.querySelector('[data-retry-init]'),
      statusPanel: document.querySelector('[data-page-status]'),
      statusMessage: document.querySelector('[data-page-status-message]'),
      ringProgress: document.querySelector('[data-moons-ring-progress]'),
      ringValue: document.querySelector('[data-moons-ring-value]'),
      ringMeta: document.querySelector('[data-moons-ring-meta]'),
      dayStrip: document.querySelector('[data-moons-day-strip]'),
      moonEssence: document.querySelector('[data-moons-essence]'),
      moonPractice: document.querySelector('[data-moons-practice]'),
      moonElement: document.querySelector('[data-moons-element]'),
      moonFrequency: document.querySelector('[data-moons-frequency]'),
      moonArtwork: document.querySelector('[data-moon-art]'),
      selectedDateLabel: document.querySelector('[data-selected-date]'),
      selectedModeLabel: document.querySelector('[data-boundary-state]'),
      shabbatDetail: document.querySelector('[data-shabbat-detail]'),
      flowPrimary: document.querySelector('[data-flow-primary]'),
      flowSecondary: document.querySelector('[data-flow-secondary]'),
      flowTertiary: document.querySelector('[data-flow-tertiary]'),
      mirrorText: document.querySelector('[data-mirror-text]'),
      mirrorSignal: document.querySelector('[data-mirror-signal]'),
      mirrorCrossing: document.querySelector('[data-mirror-crossing]'),
      mirrorAction: document.querySelector('[data-mirror-action]'),
      mirrorFocus: document.querySelector('[data-mirror-focus]'),
      yearMap: document.querySelector('[data-year-map]'),
      yearMapMeta: document.querySelector('[data-year-map-meta]'),
      logsLists: Array.from(document.querySelectorAll('[data-saved-logs-list], [data-saved-logs-list-secondary]')),
      logForm: document.querySelector('[data-log-form]'),
      logNote: document.querySelector('[data-log-note]'),
      logTags: document.querySelector('[data-log-tags]'),
      exportButton: document.querySelector('[data-export-logs]'),
      storageNote: document.querySelector('[data-storage-note]'),
      astrologyText: document.querySelector('[data-astrology-text]'),
      calendarsText: document.querySelector('[data-calendars-text]'),
      codexText: document.querySelector('[data-codex-text]'),
      timelineText: document.querySelector('[data-timeline-text]'),
      fieldText: document.querySelector('[data-field-text]')
    };

    const setText = (node, value) => { if (node) node.textContent = value; };
    const showStatus = (message, visible = true) => { if (dom.statusPanel) dom.statusPanel.dataset.statusVisible = visible ? 'true' : 'false'; setText(dom.statusMessage, message); };

    function validate() {
      const missing = REQUIRED_OUTPUTS.filter(name => !outputs[name]);
      if (dom.tabs.length !== dom.panels.length) missing.push('tab/panel mismatch');
      if (missing.length) throw new Error(`Missing required calendar outputs: ${missing.join(', ')}`);
    }

    function activateTab(panelId) {
      dom.tabs.forEach(tab => {
        const active = tab.getAttribute('aria-controls') === panelId;
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
        tab.setAttribute('tabindex', active ? '0' : '-1');
      });
      dom.panels.forEach(panel => { panel.hidden = panel.id !== panelId; });
    }

    function bindEvents(handlers) {
      dom.tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => handlers.onTab(tab.getAttribute('aria-controls')));
        tab.addEventListener('keydown', event => {
          if (!['ArrowRight','ArrowLeft','Home','End'].includes(event.key)) return;
          event.preventDefault();
          if (event.key === 'Home') return handlers.onTab(dom.tabs[0].getAttribute('aria-controls'));
          if (event.key === 'End') return handlers.onTab(dom.tabs[dom.tabs.length - 1].getAttribute('aria-controls'));
          const direction = event.key === 'ArrowRight' ? 1 : -1;
          handlers.onTab(dom.tabs[(index + direction + dom.tabs.length) % dom.tabs.length].getAttribute('aria-controls'));
        });
      });
      dom.previousButton?.addEventListener('click', () => handlers.onStep(-1));
      dom.nextButton?.addEventListener('click', () => handlers.onStep(1));
      dom.todayButton?.addEventListener('click', () => handlers.onToday());
      dom.locateButton?.addEventListener('click', () => handlers.onLocate());
      dom.dateInput?.addEventListener('change', event => handlers.onDate(event.target.value));
      dom.sunsetInput?.addEventListener('change', event => handlers.onSunset(event.target.value));
      dom.retryButton?.addEventListener('click', () => handlers.onRetry());
      dom.mirrorFocus?.addEventListener('change', event => handlers.onFocus(event.target.value));
      dom.logForm?.addEventListener('submit', event => { event.preventDefault(); handlers.onSaveLog({ text:dom.logNote?.value || '', tags:dom.logTags?.value || '' }); });
      dom.exportButton?.addEventListener('click', () => handlers.onExport());
      dom.logsLists.forEach(list => list.addEventListener('click', event => { const button = event.target.closest('[data-delete-log]'); if (button) handlers.onDeleteLog(button.getAttribute('data-delete-log')); }));
    }

    function renderMoonArtwork(state) {
      if (!dom.moonArtwork) return;
      dom.moonArtwork.innerHTML = '';
      if (state.moonArchetype?.artwork) {
        const image = document.createElement('img');
        image.src = state.moonArchetype.artwork;
        image.alt = `${state.moonName} artwork`;
        image.loading = 'lazy';
        image.decoding = 'async';
        dom.moonArtwork.appendChild(image);
      }
    }

    function renderDayStrip(state) {
      if (!dom.dayStrip) return;
      dom.dayStrip.innerHTML = '';
      const shabbatDays = new Set(state.shabbat.moonDays || []);
      for (let day = 1; day <= 28; day += 1) {
        const dot = document.createElement('div');
        dot.className = 'moons-day-dot';
        dot.dataset.active = String(state.dayInMoon === day);
        dot.dataset.shabbat = String(shabbatDays.has(day));
        dot.textContent = String(day);
        dom.dayStrip.appendChild(dot);
      }
    }

    function renderYearMap(map) {
      if (!dom.yearMap || !map) return;
      dom.yearMap.innerHTML = '';
      setText(dom.yearMapMeta, `${map.yearLabel} · Anchor ${map.anchorISO}`);
      map.moons.forEach(moon => {
        const section = document.createElement('section');
        section.className = 'moons-year-moon';
        const heading = document.createElement('h3');
        heading.textContent = `${moon.moonNumber}. ${moon.moonName}`;
        const days = document.createElement('div');
        days.className = 'moons-year-moon-days';
        moon.days.forEach(day => {
          const cell = document.createElement('button');
          cell.type = 'button';
          cell.className = 'moons-year-cell';
          cell.dataset.selected = String(day.selected);
          cell.dataset.today = String(day.today);
          cell.setAttribute('aria-label', day.label);
          cell.setAttribute('data-year-map-date', day.iso);
          cell.innerHTML = `<strong>${day.dayInMoon}</strong><small>${day.seal}</small>`;
          days.appendChild(cell);
        });
        section.appendChild(heading);
        section.appendChild(days);
        dom.yearMap.appendChild(section);
      });
      const gate = document.createElement('div');
      gate.className = 'moons-year-gate';
      gate.innerHTML = `<strong>${map.yearGate.title}</strong><small>${map.yearGate.iso}</small>`;
      dom.yearMap.appendChild(gate);
    }

    function renderLogs(logs, storageAvailable) {
      dom.logsLists.forEach(list => {
        list.innerHTML = '';
        if (!logs.length) {
          list.innerHTML = '<p class="moons-inline-note">No witness logs saved on this device yet.</p>';
          return;
        }
        logs.forEach(log => {
          const entry = document.createElement('article');
          entry.className = 'moons-log-entry';
          entry.innerHTML = `<div><strong>${log.moonName || 'Witness log'} · Day ${log.moonDay || '—'}</strong><p>${log.date} · ${log.shabbat || 'Ordinary day'}</p></div><p>${log.text}</p><p>${log.tags.length ? `Tags: ${log.tags.join(', ')}` : 'No tags saved.'}</p><div class="moons-log-entry-actions"><button class="btn" type="button" data-delete-log="${log.id}">Delete</button></div>`;
          list.appendChild(entry);
        });
      });
      if (dom.storageNote) dom.storageNote.textContent = storageAvailable ? 'Saved witness logs stay on this device unless you export them.' : 'Local storage is unavailable in this browser, so witness logs cannot be saved here.';
    }

    function renderCalendarState(state) {
      setText(outputs['moon-name'], state.moonName || state.yearGate.title);
      setText(outputs['moon-day'], state.dayInMoon ? String(state.dayInMoon) : 'Year Gate');
      setText(outputs['year-day'], state.isYearGate ? 'Year Gate' : String(state.yearDay));
      setText(outputs['visible-phase'], state.phase);
      setText(outputs['illumination'], `${state.illumination.toFixed(1)}%`);
      setText(outputs['week-gate'], state.weekGate.title);
      setText(outputs['shabbat-state'], state.shabbat.label);
      setText(outputs['sunset'], state.sunset);
      setText(outputs['mirror-title'], `${state.moonName} · ${state.daySeal?.title || state.yearGate.title}`);
      setText(dom.selectedDateLabel, `${state.selectedISO} → ${state.effectiveISO}`);
      setText(dom.selectedModeLabel, state.afterBoundary ? `Sunset boundary passed at ${state.sunset}` : `Sunset boundary set for ${state.sunset}`);
      setText(dom.moonEssence, state.moonArchetype?.essence || state.yearGate.guidance);
      setText(dom.moonPractice, state.moonArchetype?.practice || state.yearGate.guidance);
      setText(dom.moonElement, state.moonArchetype?.element || 'Threshold');
      setText(dom.moonFrequency, state.moonArchetype?.frequency || '—');
      setText(dom.shabbatDetail, state.shabbat.detail);
      setText(dom.flowPrimary, state.daySeal?.guidance || state.yearGate.guidance);
      setText(dom.flowSecondary, state.weekGate.guidance);
      setText(dom.flowTertiary, state.moonArchetype?.practice || state.yearGate.guidance);
      setText(dom.mirrorSignal, state.mirror.signal);
      setText(dom.mirrorCrossing, state.mirror.crossing);
      setText(dom.mirrorAction, state.mirror.action);
      setText(dom.mirrorText, state.mirror.text);
      setText(dom.astrologyText, `${state.phase} · ${state.illumination.toFixed(1)}% illumination. Astronomical phase remains distinct from the Remnant moon count.`);
      setText(dom.calendarsText, `${state.yearLabel} · Anchor ${state.anchorISO} · Next anchor ${state.nextAnchorISO}`);
      setText(dom.codexText, `${state.daySeal?.title || state.yearGate.title} seals ${state.moonName}. ${state.moonArchetype?.essence || state.yearGate.guidance}`);
      setText(dom.timelineText, `Selected civil date ${state.selectedISO}. Effective Remnant date ${state.effectiveISO}. Continuous week ${state.continuousWeekIndex}.`);
      setText(dom.fieldText, `${state.moonArchetype?.element || 'Threshold'} · ${state.moonArchetype?.frequency || state.sunset} · ${state.shabbat.label}`);
      if (dom.ringValue) dom.ringValue.textContent = state.dayInMoon ? String(state.dayInMoon) : 'YG';
      if (dom.ringMeta) dom.ringMeta.textContent = state.dayInMoon ? '/ 28' : 'Year Gate';
      if (dom.ringProgress) {
        const length = 2 * Math.PI * 50;
        const progress = state.dayInMoon ? state.dayInMoon / 28 : 1;
        dom.ringProgress.style.strokeDasharray = `${length}`;
        dom.ringProgress.style.strokeDashoffset = `${length - length * progress}`;
      }
      if (dom.dateInput) dom.dateInput.value = state.selectedISO;
      if (dom.sunsetInput) dom.sunsetInput.value = state.sunset;
      renderMoonArtwork(state);
      renderDayStrip(state);
      renderYearMap(state.yearMap);
      showStatus('', false);
    }

    return { dom, validate, bindEvents, activateTab, renderCalendarState, renderLogs, showStatus };
  }

  window.RemnantCalendarUI = { create };
})();
