(() => {
  'use strict';
  if (window.RemnantCalendarUI) return;

  const REQUIRED_OUTPUTS = ['moon-name','moon-day','year-day','visible-phase','illumination','week-gate','shabbat-state','sunset','mirror-title'];
  const WITNESS_FIELDS = ['body','emotion','dreams','signs','sleep','action','lesson','field','context'];

  function create() {
    const outputs = Object.fromEntries(REQUIRED_OUTPUTS.map(name => [name, document.querySelector(`[data-moon-output="${name}"]`)]));
    const q = selector => document.querySelector(selector);
    const dom = {
      outputs,
      tabs: Array.from(document.querySelectorAll('[role="tab"]')),
      panels: Array.from(document.querySelectorAll('[role="tabpanel"]')),
      dateInput: q('[data-date-input]'),
      previousButton: q('[data-date-step="previous"]'),
      nextButton: q('[data-date-step="next"]'),
      todayButton: q('[data-date-step="today"]'),
      locateButton: q('[data-date-step="locate"]'),
      copyLinkButton: q('[data-copy-link]'),
      boundarySelect: q('[data-boundary-mode]'),
      timezoneLabel: q('[data-timezone-label]'),
      sunsetInput: q('[data-sunset-input]'),
      retryButton: q('[data-retry-init]'),
      statusPanel: q('[data-page-status]'),
      statusMessage: q('[data-page-status-message]'),
      ringProgress: q('[data-moons-ring-progress]'),
      ringValue: q('[data-moons-ring-value]'),
      ringMeta: q('[data-moons-ring-meta]'),
      dayStrip: q('[data-moons-day-strip]'),
      moonEssence: q('[data-moons-essence]'),
      moonPractice: q('[data-moons-practice]'),
      moonElement: q('[data-moons-element]'),
      moonFrequency: q('[data-moons-frequency]'),
      moonArtwork: q('[data-moon-art]'),
      selectedDateLabel: q('[data-selected-date]'),
      selectedModeLabel: q('[data-boundary-state]'),
      shabbatDetail: q('[data-shabbat-detail]'),
      shabbatWindow: q('[data-shabbat-window]'),
      flowPrimary: q('[data-flow-primary]'),
      flowSecondary: q('[data-flow-secondary]'),
      flowTertiary: q('[data-flow-tertiary]'),
      flowSequence: q('[data-flow-sequence]'),
      mirrorText: q('[data-mirror-text]'),
      mirrorSignal: q('[data-mirror-signal]'),
      mirrorCrossing: q('[data-mirror-crossing]'),
      mirrorAction: q('[data-mirror-action]'),
      mirrorFocus: q('[data-mirror-focus]'),
      mirrorCopy: q('[data-copy-mirror]'),
      yearMap: q('[data-year-map]'),
      yearMapMeta: q('[data-year-map-meta]'),
      logsLists: Array.from(document.querySelectorAll('[data-saved-logs-list], [data-saved-logs-list-secondary]')),
      logForm: q('[data-log-form]'),
      logNote: q('[data-log-note]'),
      logTags: q('[data-log-tags]'),
      witnessFields: Object.fromEntries(WITNESS_FIELDS.map(key => [key, q(`[data-log-${key}]`)])),
      witnessPreview: q('[data-witness-preview]'),
      witnessCopy: q('[data-copy-witness]'),
      witnessBuild: q('[data-build-witness]'),
      witnessClear: q('[data-clear-witness]'),
      mirrorBuild: q('[data-build-mirror]'),
      exportButton: q('[data-export-logs]'),
      copyAllButton: q('[data-copy-all]'),
      clearButton: q('[data-clear-logs]'),
      importInput: q('[data-import-logs]'),
      importApply: q('[data-apply-import]'),
      storageNote: q('[data-storage-note]'),
      astrologyText: q('[data-astrology-text]'),
      astrologyNote: q('[data-astrology-note]'),
      astrologySolar: q('[data-astrology-solar]'),
      astrologyMoon: q('[data-astrology-moon]'),
      astrologyIntegration: q('[data-astrology-integration]'),
      astrologyPlanets: q('[data-astrology-planets]'),
      calendarsText: q('[data-calendars-text]'),
      calendarCycleText: q('[data-calendar-cycle]'),
      calendarsGregorian: q('[data-calendars-gregorian]'),
      codexText: q('[data-codex-text]'),
      codexTitle: q('[data-codex-title]'),
      codexPrompts: q('[data-codex-prompts]'),
      codexSeal: q('[data-codex-seal]'),
      codexCopy: q('[data-copy-seal]'),
      timelineText: q('[data-timeline-text]'),
      timelineWindows: q('[data-timeline-windows]'),
      timelineSummary: q('[data-timeline-summary]'),
      fieldText: q('[data-field-text]'),
      fieldLayers: q('[data-field-layers]'),
      fieldSummary: q('[data-field-summary]')
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

    function readWitnessFields() {
      const fields = { witness: dom.logNote?.value || '' };
      WITNESS_FIELDS.forEach(key => { fields[key] = dom.witnessFields[key]?.value || ''; });
      return fields;
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
      dom.copyLinkButton?.addEventListener('click', () => handlers.onCopyLink());
      dom.boundarySelect?.addEventListener('change', event => handlers.onBoundary(event.target.value));
      dom.dateInput?.addEventListener('change', event => handlers.onDate(event.target.value));
      dom.sunsetInput?.addEventListener('change', event => handlers.onSunset(event.target.value));
      dom.retryButton?.addEventListener('click', () => handlers.onRetry());
      dom.mirrorFocus?.addEventListener('change', event => handlers.onFocus(event.target.value));
      dom.mirrorCopy?.addEventListener('click', () => handlers.onCopyMirror());
      dom.mirrorBuild?.addEventListener('click', () => handlers.onFocus(dom.mirrorFocus?.value || 'general'));
      dom.codexCopy?.addEventListener('click', () => handlers.onCopySeal());
      dom.witnessBuild?.addEventListener('click', () => handlers.onWitnessInput(readWitnessFields()));
      dom.witnessClear?.addEventListener('click', () => {
        dom.logForm?.reset();
        handlers.onWitnessInput(readWitnessFields());
      });
      dom.witnessCopy?.addEventListener('click', () => handlers.onCopyWitness(readWitnessFields()));
      Object.values(dom.witnessFields).forEach(node => node?.addEventListener('input', () => handlers.onWitnessInput(readWitnessFields())));
      dom.logNote?.addEventListener('input', () => handlers.onWitnessInput(readWitnessFields()));
      dom.logForm?.addEventListener('submit', event => { event.preventDefault(); handlers.onSaveLog({ text:dom.logNote?.value || '', tags:dom.logTags?.value || '', notes:readWitnessFields() }); });
      dom.exportButton?.addEventListener('click', () => handlers.onExport());
      dom.copyAllButton?.addEventListener('click', () => handlers.onCopyAll());
      dom.clearButton?.addEventListener('click', () => handlers.onClearLogs());
      dom.importApply?.addEventListener('click', () => handlers.onImport(dom.importInput?.value || ''));
      dom.logsLists.forEach(list => list.addEventListener('click', event => {
        const del = event.target.closest('[data-delete-log]');
        if (del) return handlers.onDeleteLog(del.getAttribute('data-delete-log'));
        const copy = event.target.closest('[data-copy-log]');
        if (copy) return handlers.onCopyLog(copy.getAttribute('data-copy-log'));
      }));
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

    function renderAstrology(state) {
      const astro = state.astrology;
      if (!astro) return;
      setText(dom.astrologyNote, astro.note);
      setText(dom.astrologySolar, `${astro.solar.label} — ${astro.solar.meaning}`);
      setText(dom.astrologyMoon, astro.moonMirror.label);
      setText(dom.astrologyIntegration, astro.integration.counsel);
      if (dom.astrologyPlanets) {
        dom.astrologyPlanets.innerHTML = '';
        astro.planets.forEach(planet => {
          const cell = document.createElement('div');
          cell.className = 'moons-planet-cell';
          cell.innerHTML = `<strong>${planet.glyph || ''} ${planet.name}</strong><span>${planet.theme}</span>`;
          dom.astrologyPlanets.appendChild(cell);
        });
      }
    }

    function renderCodex(state) {
      const seal = state.seal;
      if (!seal) return;
      setText(dom.codexTitle, seal.title);
      setText(dom.codexSeal, seal.text);
      if (dom.codexPrompts) {
        dom.codexPrompts.innerHTML = '';
        seal.prompts.forEach(prompt => {
          const item = document.createElement('li');
          item.textContent = prompt;
          dom.codexPrompts.appendChild(item);
        });
      }
    }

    function renderTimeline(state) {
      const patterns = state.patterns;
      if (!patterns) return;
      setText(dom.timelineSummary, patterns.count ? `${patterns.count} recurring signal${patterns.count === 1 ? '' : 's'} across the last 28 witness logs.` : 'Not enough witness logs yet to surface repeating signals. Record across 3, 7, 14, and 28 days.');
      if (dom.timelineWindows) {
        dom.timelineWindows.innerHTML = '';
        [3, 7, 14, 28].forEach(windowSize => {
          const top = patterns.windows[windowSize] || [];
          const cell = document.createElement('div');
          cell.className = 'moons-timeline-window';
          const chips = top.length ? top.map(([term, count]) => `<span class="moons-chip">${term} ·${count}</span>`).join('') : '<span class="moons-inline-note">No repeats yet.</span>';
          cell.innerHTML = `<strong>${windowSize}-day window</strong><div class="moons-chip-row">${chips}</div>`;
          dom.timelineWindows.appendChild(cell);
        });
      }
    }

    function renderField(state) {
      const layers = state.fieldLayers;
      if (dom.fieldSummary) setText(dom.fieldSummary, `${state.moonArchetype?.element || 'Threshold'} · ${state.moonArchetype?.frequency || state.sunset} · ${state.shabbat.label}`);
      if (dom.fieldLayers && Array.isArray(layers)) {
        dom.fieldLayers.innerHTML = '';
        layers.forEach(layer => {
          const cell = document.createElement('article');
          cell.className = 'moons-field-layer';
          cell.innerHTML = `<p class="eyebrow">${layer.title}</p><p>${layer.guidance}</p>`;
          dom.fieldLayers.appendChild(cell);
        });
      }
    }

    function renderWitnessPreview(text) {
      setText(dom.witnessPreview, text);
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
          const tagLine = log.tags.length ? `Tags: ${log.tags.join(', ')}` : 'No tags saved.';
          entry.innerHTML = `<div><strong>${log.moonName || 'Witness log'} · Day ${log.moonDay || '—'}</strong><p>${log.date} · ${log.shabbat || 'Ordinary day'}</p></div><p>${log.text}</p><p>${tagLine}</p><div class="moons-log-entry-actions"><button class="btn" type="button" data-copy-log="${log.id}">Copy</button><button class="btn" type="button" data-delete-log="${log.id}">Delete</button></div>`;
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
      setText(dom.timezoneLabel, state.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone);
      setText(dom.moonEssence, state.moonArchetype?.essence || state.yearGate.guidance);
      setText(dom.moonPractice, state.moonArchetype?.practice || state.yearGate.guidance);
      setText(dom.moonElement, state.moonArchetype?.element || 'Threshold');
      setText(dom.moonFrequency, state.moonArchetype?.frequency || '—');
      setText(dom.shabbatDetail, state.shabbat.detail);
      setText(dom.shabbatWindow, state.shabbat.moonDays && state.shabbat.moonDays.length ? `Shabbat moon days: ${state.shabbat.moonDays.join(', ')} of 28` : 'Shabbat aligns with the weekly sunset boundary.');
      setText(dom.flowPrimary, state.daySeal?.guidance || state.yearGate.guidance);
      setText(dom.flowSecondary, state.weekGate.guidance);
      setText(dom.flowTertiary, state.moonArchetype?.practice || state.yearGate.guidance);
      setText(dom.flowSequence, state.daypart ? `Day-part: ${state.daypart}. ${Array.isArray(state.breathSequence) ? state.breathSequence.map(step => step.step || step).join(' · ') : ''}` : '');
      setText(dom.mirrorSignal, state.mirror.signal);
      setText(dom.mirrorCrossing, state.mirror.crossing);
      setText(dom.mirrorAction, state.mirror.action);
      setText(dom.mirrorText, state.mirror.text);
      setText(dom.astrologyText, `${state.phase} · ${state.illumination.toFixed(1)}% illumination. Astronomical phase remains distinct from the Remnant moon count.`);
      setText(dom.calendarsText, `${state.yearLabel} · Anchor ${state.anchorISO} · Final regular day ${state.cycle.finalRegularDayISO} · Year Gate ${state.cycle.yearGateISO} · Next cycle ${state.cycle.nextAnchorISO}`);
      setText(dom.calendarCycleText, `13 Moons × 28 days = ${state.cycle.regularDays} regular Remnant days. ${state.cycle.yearGateISO} is the separate Year Gate / Day Out of Time with no regular Moon number or Moon day, and ${state.cycle.nextAnchorISO} begins Moon 1 Day 1 of the next cycle. Each cycle spans ${state.cycle.elapsedCivilDays} elapsed civil days, and Gregorian leap day remains an ordinary elapsed day rather than creating an extra Year Gate.`);
      if (state.gregorian) setText(dom.calendarsGregorian, `Gregorian ${state.gregorian.long} (${state.gregorian.weekday}) maps to ${state.insideYear ? `Moon ${state.moonNumber} · Day ${state.dayInMoon} of 28` : state.yearGate.title}. Solar gate ${state.solarGate?.sign || '—'} · ${state.solarGate?.element || ''}.`);
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
      if (dom.boundarySelect && dom.boundarySelect.value !== state.boundaryMode) dom.boundarySelect.value = state.boundaryMode || 'auto';
      renderMoonArtwork(state);
      renderDayStrip(state);
      renderYearMap(state.yearMap);
      renderAstrology(state);
      renderCodex(state);
      renderTimeline(state);
      renderField(state);
      if (state.witnessTemplate) renderWitnessPreview(state.witnessTemplate);
      showStatus('', false);
    }

    return { dom, validate, bindEvents, activateTab, renderCalendarState, renderLogs, renderWitnessPreview, showStatus, readWitnessFields };
  }

  window.RemnantCalendarUI = { create };
})();
