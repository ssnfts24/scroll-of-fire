(function (global, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('./moons-data.js'));
  else global.RemnantCalendar = factory(global.RemnantCalendarData);
})(typeof window !== 'undefined' ? window : globalThis, function (data) {
  'use strict';

  const DAY_MS = 86400000;
  const SYNODIC_MONTH = 29.530588853;
  const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14, 0);
  const DEFAULTS = {
    dayBoundary: data.calendarAnchor.dayBoundary,
    fallbackSunset: data.calendarAnchor.fallbackSunset,
    anchorOverrides: data.calendarAnchor.anchorOverrides,
    shabbat: data.shabbat
  };

  const getConfig = overrides => ({
    ...DEFAULTS,
    ...(overrides || {}),
    anchorOverrides: { ...DEFAULTS.anchorOverrides, ...((overrides || {}).anchorOverrides || {}) },
    shabbat: { ...DEFAULTS.shabbat, ...((overrides || {}).shabbat || {}) }
  });

  const pad = value => String(value).padStart(2, '0');

  function normalizeLocalDate(input) {
    if (input instanceof Date) return new Date(input.getFullYear(), input.getMonth(), input.getDate(), 12, 0, 0, 0);
    if (typeof input === 'string') {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
      if (!match) throw new Error('Expected YYYY-MM-DD local date.');
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
    }
    if (typeof input === 'number') return normalizeLocalDate(new Date(input));
    if (input == null) return normalizeLocalDate(new Date());
    throw new Error('Unsupported date input.');
  }

  const formatISODate = date => {
    const value = normalizeLocalDate(date);
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  };

  const addDays = (date, amount) => {
    const value = normalizeLocalDate(date);
    value.setDate(value.getDate() + amount);
    return normalizeLocalDate(value);
  };

  const dayDiff = (a, b) => Math.round((Date.UTC(normalizeLocalDate(a).getFullYear(), normalizeLocalDate(a).getMonth(), normalizeLocalDate(a).getDate()) - Date.UTC(normalizeLocalDate(b).getFullYear(), normalizeLocalDate(b).getMonth(), normalizeLocalDate(b).getDate())) / DAY_MS);

  function parseClock(value, fallback = DEFAULTS.fallbackSunset) {
    const match = /^(\d{2}):(\d{2})$/.exec(String(value || fallback));
    if (!match) return parseClock(fallback, '18:00');
    const hour = Math.max(0, Math.min(23, Number(match[1])));
    const minute = Math.max(0, Math.min(59, Number(match[2])));
    return { hour, minute, minutes: hour * 60 + minute, value: `${pad(hour)}:${pad(minute)}` };
  }

  function moonAge(date) {
    const value = normalizeLocalDate(date);
    const time = Date.UTC(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0, 0);
    const days = (time - KNOWN_NEW_MOON) / DAY_MS;
    return ((days % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH;
  }

  function nearestNewMoonAfter(date) {
    let cursor = normalizeLocalDate(date);
    for (let index = 0; index < 40; index += 1) {
      const age = moonAge(cursor);
      const nextAge = moonAge(addDays(cursor, 1));
      if (age > 28.5 || nextAge < age) return addDays(cursor, 1);
      cursor = addDays(cursor, 1);
    }
    return cursor;
  }

  const anchorForYear = (year, config = DEFAULTS) => {
    if (config.anchorOverrides?.[year]) return normalizeLocalDate(config.anchorOverrides[year]);
    const overrideYears = Object.keys(config.anchorOverrides || {}).map(Number).filter(Number.isFinite);
    const earliestOverride = overrideYears.length ? Math.min(...overrideYears) : null;
    if (earliestOverride !== null && year > earliestOverride) {
      return addDays(anchorForYear(year - 1, config), 365);
    }
    return nearestNewMoonAfter(new Date(year, 2, 20, 12, 0, 0, 0));
  };
  const yearAnchorFor = (date, config = DEFAULTS) => { const value = normalizeLocalDate(date); const candidate = anchorForYear(value.getFullYear(), config); return value < candidate ? anchorForYear(value.getFullYear() - 1, config) : candidate; };

  const calculateMoonNumber = remnantDate => remnantDate.insideYear ? Math.floor(remnantDate.dayIndex / 28) + 1 : null;
  const calculateDayInMoon = remnantDate => remnantDate.insideYear ? (remnantDate.dayIndex % 28) + 1 : null;
  const calculateYearDay = remnantDate => remnantDate.insideYear ? remnantDate.dayIndex + 1 : 365;

  function calculateWeekGate(remnantDate) {
    if (!remnantDate.insideYear) return { index: 0, title: data.yearGate.title, guidance: data.yearGate.guidance };
    const index = Math.floor((remnantDate.dayInMoon - 1) / 7);
    const gate = data.weekGates[index] || data.weekGates[0];
    return { index: index + 1, title: gate.title, guidance: gate.guidance };
  }

  const calculateVisibleMoonPhase = date => { const age = moonAge(date); return age < 1.2 || age > 28.3 ? 'New Moon' : age < 6.4 ? 'Waxing Crescent' : age < 8.4 ? 'First Quarter' : age < 13.8 ? 'Waxing Gibbous' : age < 16.2 ? 'Full Moon' : age < 21.6 ? 'Waning Gibbous' : age < 23.6 ? 'Last Quarter' : 'Waning Crescent'; };
  const calculateIllumination = date => { const age = typeof date === 'number' ? date : moonAge(date); return Math.round((Math.max(0, Math.min(1, (1 - Math.cos((age / SYNODIC_MONTH) * Math.PI * 2)) / 2))) * 1000) / 10; };

  function calculateSunsetBoundary(civilDate, sunsetValue, options = {}) {
    const selectedDate = normalizeLocalDate(civilDate);
    const referenceDate = normalizeLocalDate(options.referenceDate || new Date());
    const sunset = parseClock(sunsetValue, options.fallbackSunset || DEFAULTS.fallbackSunset);
    const isSelectedToday = formatISODate(selectedDate) === formatISODate(referenceDate);
    const currentMinutes = typeof options.currentMinutes === 'number' ? options.currentMinutes : new Date().getHours() * 60 + new Date().getMinutes();
    const afterBoundary = Boolean(options.forceAfterBoundary || (isSelectedToday && currentMinutes >= sunset.minutes));
    const effectiveDate = afterBoundary ? addDays(selectedDate, 1) : selectedDate;
    return { civilDate:selectedDate, civilISO:formatISODate(selectedDate), effectiveDate, effectiveISO:formatISODate(effectiveDate), isSelectedToday, afterBoundary, sunset:sunset.value, sunsetMinutes:sunset.minutes, currentMinutes };
  }

  function calculateShabbatState(remnantDate, options = {}) {
    const config = getConfig(options.config);
    const civilDate = normalizeLocalDate(options.civilDate || remnantDate.selectedDate || remnantDate.effectiveDate || remnantDate.anchor);
    const effectiveDate = normalizeLocalDate(options.effectiveDate || remnantDate.effectiveDate || civilDate);
    const sunset = parseClock(options.sunset || config.fallbackSunset, config.fallbackSunset);
    const currentMinutes = typeof options.currentMinutes === 'number' ? options.currentMinutes : sunset.minutes - 1;
    const afterBoundary = Boolean(options.afterBoundary);
    const weekday = civilDate.getDay();
    const alignedMoonDay = Boolean(remnantDate.insideYear && config.shabbat.moonDays.includes(remnantDate.dayInMoon));
    let label = 'Ordinary day';
    let detail = 'Work with measure. Prepare for the next appointed stop.';
    let code = 'ordinary';
    if (weekday === 5 && !afterBoundary && currentMinutes < sunset.minutes) {
      label = 'Preparation';
      detail = 'Shabbat begins at sunset. Finish what is necessary and clear the field.';
      code = 'preparation';
    } else if ((weekday === 5 && afterBoundary) || effectiveDate.getDay() === 6) {
      label = 'Shabbat active';
      detail = 'Friday sunset through Saturday nightfall. Stop forcing, rest, pray, review, and restore.';
      code = 'active';
    } else if (effectiveDate.getDay() === 0) {
      label = 'Return';
      detail = 'Carry the lesson forward with one deliberate next step.';
      code = 'return';
    }
    return { code, label, detail, alignedMoonDay, moonDays:config.shabbat.moonDays.slice(), window:`${config.shabbat.begins} → ${config.shabbat.ends}`, sunset:sunset.value };
  }

  function calculateRemnantDate(input, options = {}) {
    const config = getConfig(options.config);
    const boundary = calculateSunsetBoundary(input, options.sunset || config.fallbackSunset, { referenceDate:options.referenceDate, currentMinutes:options.currentMinutes, fallbackSunset:config.fallbackSunset, forceAfterBoundary:options.forceAfterBoundary });
    const anchor = yearAnchorFor(boundary.effectiveDate, config);
    const dayIndex = dayDiff(boundary.effectiveDate, anchor);
    const insideYear = dayIndex >= 0 && dayIndex < 364;
    const nextAnchor = anchorForYear(anchor.getFullYear() + 1, config);
    const base = { anchor, anchorISO:formatISODate(anchor), nextAnchor, nextAnchorISO:formatISODate(nextAnchor), selectedDate:boundary.civilDate, selectedISO:boundary.civilISO, effectiveDate:boundary.effectiveDate, effectiveISO:boundary.effectiveISO, dayIndex, insideYear, isYearGate:!insideYear, afterBoundary:boundary.afterBoundary, sunset:boundary.sunset, currentMinutes:boundary.currentMinutes, selectedIsToday:boundary.isSelectedToday, yearLabel:`${anchor.getFullYear()}/${anchor.getFullYear() + 1}`, continuousWeekIndex:Math.floor(dayIndex / 7) + 1 };
    if (!insideYear) {
      return { ...base, moonNumber:null, moonName:data.yearGate.title, moonArchetype:null, dayInMoon:null, yearDay:365, daySeal:null, weekGate:calculateWeekGate({ insideYear:false }), shabbat:calculateShabbatState({ insideYear:false, dayInMoon:null, effectiveDate:boundary.effectiveDate }, { civilDate:boundary.civilDate, effectiveDate:boundary.effectiveDate, sunset:boundary.sunset, currentMinutes:boundary.currentMinutes, afterBoundary:boundary.afterBoundary, config }), phase:calculateVisibleMoonPhase(boundary.effectiveDate), illumination:calculateIllumination(boundary.effectiveDate), yearGate:data.yearGate };
    }
    const moonNumber = calculateMoonNumber(base);
    const dayInMoon = calculateDayInMoon(base);
    const yearDay = calculateYearDay(base);
    const moonArchetype = data.moonArchetypes[moonNumber - 1];
    const daySeal = data.daySeals[dayInMoon - 1];
    const weekGate = calculateWeekGate({ insideYear, dayIndex, dayInMoon });
    const shabbat = calculateShabbatState({ insideYear, dayInMoon, effectiveDate:boundary.effectiveDate }, { civilDate:boundary.civilDate, effectiveDate:boundary.effectiveDate, sunset:boundary.sunset, currentMinutes:boundary.currentMinutes, afterBoundary:boundary.afterBoundary, config });
    return { ...base, moonNumber, moonName:data.moonNames[moonNumber - 1], moonArchetype, dayInMoon, yearDay, daySeal, weekGate, shabbat, phase:calculateVisibleMoonPhase(boundary.effectiveDate), illumination:calculateIllumination(boundary.effectiveDate), yearGate:data.yearGate };
  }

  function buildYearMap(input, options = {}) {
    const config = getConfig(options.config);
    const state = calculateRemnantDate(input, options);
    const anchor = yearAnchorFor(state.effectiveDate, config);
    const todayISO = formatISODate(options.today || new Date());
    const selectedISO = state.effectiveISO;
    const moons = data.moonArchetypes.map((moonArchetype, moonIndex) => ({
      moonNumber: moonIndex + 1,
      moonName: data.moonNames[moonIndex],
      moonArchetype,
      days: Array.from({ length: 28 }, (_, index) => {
        const date = addDays(anchor, moonIndex * 28 + index);
        return {
          iso: formatISODate(date),
          dayInMoon: index + 1,
          yearDay: moonIndex * 28 + index + 1,
          selected: formatISODate(date) === selectedISO,
          today: formatISODate(date) === todayISO,
          shabbatAligned: config.shabbat.moonDays.includes(index + 1),
          seal: data.daySeals[index].title,
          label: `${moonIndex + 1}. ${data.moonNames[moonIndex]} · Day ${index + 1}`,
          state: calculateRemnantDate(date, { config, sunset:config.fallbackSunset, referenceDate:date, currentMinutes:720 })
        };
      })
    }));
    const yearGateDate = addDays(anchor, 364);
    return { anchorISO:formatISODate(anchor), yearLabel:`${anchor.getFullYear()}/${anchor.getFullYear() + 1}`, moons, yearGate:{ iso:formatISODate(yearGateDate), today:formatISODate(yearGateDate) === todayISO, selected:formatISODate(yearGateDate) === selectedISO, title:data.yearGate.title, guidance:data.yearGate.guidance } };
  }

  function buildMirrorReading(state, focus = 'general') {
    const copy = data.mirrorFocus[focus] || data.mirrorFocus.general;
    const moonLine = state.insideYear ? `${state.moonName} · Day ${state.dayInMoon} · ${state.weekGate.title}` : data.yearGate.title;
    return {
      title: `${state.moonName} · ${state.daySeal?.title || 'Threshold'} Reading`,
      signal: copy.signal,
      crossing: copy.crossing,
      action: copy.action,
      text: [copy.title, moonLine, `Visible sign: ${state.phase} · ${state.illumination.toFixed(1)}% illumination`, `Shabbat: ${state.shabbat.label}`, `Seal: ${state.daySeal?.title || data.yearGate.title} — ${state.daySeal?.guidance || data.yearGate.guidance}`, `Action: ${copy.action}`].join('\n')
    };
  }

  function calculateLocalizedSunset(date, latitude, longitude, timeZone) {
    const selectedDate = normalizeLocalDate(date);
    const start = new Date(Date.UTC(selectedDate.getFullYear(), 0, 1));
    const dayOfYear = Math.floor((Date.UTC(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()) - start.getTime()) / DAY_MS) + 1;
    const zenith = 90.8333;
    const lngHour = longitude / 15;
    const t = dayOfYear + ((18 - lngHour) / 24);
    const meanAnomaly = (0.9856 * t) - 3.289;
    let trueLongitude = meanAnomaly + (1.916 * Math.sin((Math.PI / 180) * meanAnomaly)) + (0.02 * Math.sin((2 * Math.PI / 180) * meanAnomaly)) + 282.634;
    trueLongitude = ((trueLongitude % 360) + 360) % 360;
    let rightAscension = (180 / Math.PI) * Math.atan(0.91764 * Math.tan((Math.PI / 180) * trueLongitude));
    rightAscension = ((rightAscension % 360) + 360) % 360;
    const lQuadrant = Math.floor(trueLongitude / 90) * 90;
    const raQuadrant = Math.floor(rightAscension / 90) * 90;
    rightAscension = (rightAscension + (lQuadrant - raQuadrant)) / 15;
    const sinDeclination = 0.39782 * Math.sin((Math.PI / 180) * trueLongitude);
    const cosDeclination = Math.cos(Math.asin(sinDeclination));
    const cosHour = (Math.cos((Math.PI / 180) * zenith) - (sinDeclination * Math.sin((Math.PI / 180) * latitude))) / (cosDeclination * Math.cos((Math.PI / 180) * latitude));
    if (cosHour < -1 || cosHour > 1) return null;
    const hour = Math.acos(cosHour) * (180 / Math.PI) / 15;
    const localMeanTime = hour + rightAscension - (0.06571 * t) - 6.622;
    const utcHour = ((localMeanTime - lngHour) % 24 + 24) % 24;
    const wholeHours = Math.floor(utcHour);
    const minutes = Math.round((utcHour - wholeHours) * 60);
    const utcDate = new Date(Date.UTC(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), wholeHours, minutes, 0));
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).formatToParts(utcDate).reduce((acc, part) => { if (part.type !== 'literal') acc[part.type] = part.value; return acc; }, {});
    return { time:`${parts.hour}:${parts.minute}`, latitude, longitude, timeZone, iso:formatISODate(selectedDate) };
  }

  function getDaypart(date) {
    const hour = (date instanceof Date ? date : new Date()).getHours();
    if (hour >= 5 && hour < 10) return 'dawn';
    if (hour >= 10 && hour < 17) return 'day';
    if (hour >= 17 && hour < 21) return 'dusk';
    return 'night';
  }

  const MONTH_GATES = [
    ['Capricorn', 'Aquarius', 20],
    ['Aquarius', 'Pisces', 19],
    ['Pisces', 'Aries', 21],
    ['Aries', 'Taurus', 20],
    ['Taurus', 'Gemini', 21],
    ['Gemini', 'Cancer', 21],
    ['Cancer', 'Leo', 23],
    ['Leo', 'Virgo', 23],
    ['Virgo', 'Libra', 23],
    ['Libra', 'Scorpio', 23],
    ['Scorpio', 'Sagittarius', 22],
    ['Sagittarius', 'Capricorn', 22]
  ];
  const GATE_BY_SIGN = (data.solarGates || []).reduce((acc, gate) => { acc[gate.sign] = gate; return acc; }, {});

  function calculateSolarGate(date) {
    const value = normalizeLocalDate(date);
    const month = value.getMonth() + 1;
    const day = value.getDate();
    const entry = MONTH_GATES[month - 1];
    const sign = day < entry[2] ? entry[0] : entry[1];
    return GATE_BY_SIGN[sign] || { sign, element:'Threshold', meaning:'' };
  }

  function buildAstrologyMirror(state) {
    const effective = state.effectiveDate || normalizeLocalDate(state.effectiveISO || new Date());
    const solar = calculateSolarGate(effective);
    const phase = state.phase || calculateVisibleMoonPhase(effective);
    const illumination = typeof state.illumination === 'number' ? state.illumination : calculateIllumination(effective);
    const carrier = state.moonArchetype?.frequency || '—';
    const element = state.moonArchetype?.element || solar.element;
    const bodyHouseByElement = {
      Fire: 'Heart / blood / endocrine heat',
      Earth: 'Bones / gut / structure / repair',
      Air: 'Lungs / nerves / communication pathways',
      Water: 'Kidneys / lymph / emotional tides',
      Aether: 'Crown / integration / coherence'
    };
    const aspectMirror = [
      'Sun ⨯ Moon: intention vs felt reality',
      'Mercury ⨯ Saturn: disciplined language',
      'Venus ⨯ Mars: value and action alignment',
      'Jupiter ⨯ Moon: mercy under pressure'
    ];
    const dayIndex = Number.isFinite(state.dayInMoon) ? state.dayInMoon : 1;
    const weekIndex = Number.isFinite(state.continuousWeekIndex) ? state.continuousWeekIndex : 1;
    const placements = data.planetWheel.map((planet, index) => {
      const house = ((dayIndex + index - 1) % 12) + 1;
      const gate = data.solarGates[(weekIndex + index - 1) % data.solarGates.length];
      return { ...planet, house, gate:gate.sign, placement:`House ${house} · ${gate.sign}` };
    });
    const dailyCounsel = `Solar Gate ${solar.sign} with ${phase.toLowerCase()} asks for ${element.toLowerCase()} discipline through ${carrier}.`;
    const elementMirror = `${element} mirror: balance body demand, relational signal, and witness pacing before interpretation.`;
    return {
      note: data.astrologyNote,
      solar: { sign:solar.sign, element:solar.element, meaning:solar.meaning, label:`${solar.sign} · ${solar.element}` },
      moonMirror: { phase, illumination, label:`${phase} · ${illumination.toFixed(1)}% illuminated`, essence:state.moonArchetype?.essence || data.yearGate.guidance },
      planets: placements,
      integration: { element, carrier, counsel:`Ground ${element.toLowerCase()} through ${carrier}. Witness before you interpret.` },
      bodyHouse: bodyHouseByElement[element] || bodyHouseByElement[solar.element] || 'Whole-body coherence',
      aspectMirror,
      dailyCounsel,
      elementMirror
    };
  }

  function buildCodexSeal(state) {
    const title = state.insideYear
      ? `Moon ${state.moonNumber} · Day ${state.dayInMoon} — ${state.moonName}`
      : `${data.yearGate.title}`;
    const solar = calculateSolarGate(state.effectiveDate || state.effectiveISO || new Date());
    const lines = [
      '☲ REMNANT DAILY SEAL ☲',
      '',
      `${state.selectedISO}${state.selectedISO === state.effectiveISO ? '' : ` · after ${state.sunset}, effective ${state.effectiveISO}`}`,
      title,
      '',
      `Day boundary: ${state.afterBoundary ? 'sunset passed' : 'before sunset'} · ${state.sunset}`,
      `Shabbat gate: ${state.shabbat.label} — ${state.shabbat.detail}`,
      `Moon essence: ${state.moonArchetype?.essence || data.yearGate.guidance}`,
      `Practice: ${state.moonArchetype?.practice || data.yearGate.guidance}`,
      `Day seal: ${state.daySeal?.title || data.yearGate.title} — ${state.daySeal?.guidance || data.yearGate.guidance}`,
      `Week gate: ${state.weekGate.title} — ${state.weekGate.guidance}`,
      `Visible moon: ${state.phase} · ${state.illumination.toFixed(1)}% illuminated`,
      `Solar gate: ${solar.sign} · ${solar.element} — ${solar.meaning}`,
      `Carrier tone: ${state.moonArchetype?.frequency || '—'} · ${state.moonArchetype?.element || 'Threshold'}`,
      '',
      'Seal: Observe first. Record clearly. Interpret slowly. Repair one thing. Carry the witness forward.'
    ];
    return {
      title,
      prompts:data.sealPrompts.slice(),
      witnessPrompt:data.sealPrompts[0],
      closingLine:'Seal: Observe first. Record clearly. Interpret slowly. Repair one thing. Carry the witness forward.',
      details:{
        date:state.selectedISO,
        effectiveDate:state.effectiveISO,
        moon:state.moonName,
        moonDay:state.dayInMoon,
        yearDay:state.yearDay,
        phase:state.phase,
        daySeal:state.daySeal?.title || data.yearGate.title,
        weekGate:state.weekGate.title,
        archetype:state.daySeal?.title || data.yearGate.title,
        element:state.moonArchetype?.element || solar.element,
        frequency:state.moonArchetype?.frequency || 'Unavailable from selected moon',
        solarGate:`${solar.sign} · ${solar.element}`,
        field:`${state.moonArchetype?.element || 'Threshold'} · ${state.shabbat.label}`,
        shabbat:state.shabbat.label
      },
      text:lines.join('\n')
    };
  }

  function buildWitnessTemplate(state, fields = {}) {
    const value = key => String(fields[key] || '').trim() || '—';
    const solar = calculateSolarGate(state.effectiveDate || state.effectiveISO || new Date());
    const lines = [
      `Civil date: ${state.selectedISO}`,
      `Effective Remnant date: ${state.effectiveISO}`,
      `Day boundary: ${state.afterBoundary ? 'sunset passed' : 'before sunset'} · ${state.sunset}`,
      `Shabbat state: ${state.shabbat.label}`,
      `Remnant moon: ${state.moonName}`,
      `Moon day: ${state.insideYear ? `${state.dayInMoon}/28` : 'Year Gate'}`,
      `Year day: ${state.insideYear ? `${state.yearDay}/364` : 'Year Gate'}`,
      `Visible moon phase: ${state.phase} · ${state.illumination.toFixed(1)}%`,
      `Solar gate: ${solar.sign} · ${solar.element}`,
      `Day seal: ${state.daySeal?.title || data.yearGate.title}`,
      `Carrier tone: ${state.moonArchetype?.frequency || '—'} · ${state.moonArchetype?.element || 'Threshold'}`,
      ''
    ];
    data.witnessFields.forEach(field => { lines.push(`${field.label}: ${value(field.key)}`); });
    lines.push('', 'Witness: Record first. Interpret later. Compare across 3, 7, 14, and 28 days.');
    return lines.join('\n');
  }

  const PATTERN_SKIP = new Set(['unknown','checked','field','moon','body','dreams','sleep','weather','signal','with','from','this','that','have','would','there','their','about','because','through','ordinary','witness','remnant']);

  function detectPatterns(logs) {
    const list = Array.isArray(logs) ? logs : [];
    const windows = [3, 7, 14, 28];
    const result = { count:0, top:[], windows:{}, categories:{ words:[], body:[], emotion:[], field:[], action:[], lesson:[] } };
    const summarize = values => {
      const counts = {};
      (values || []).forEach(value => {
        String(value || '').toLowerCase().split(/[,\n]/).map(item => item.trim()).filter(Boolean).forEach(item => { counts[item] = (counts[item] || 0) + 1; });
      });
      return Object.entries(counts).filter(([, count]) => count >= 2).sort((a, b) => b[1] - a[1]).slice(0, 5);
    };
    windows.forEach(windowSize => {
      const joined = list.slice(0, windowSize).map(entry => {
        const notes = entry.notes && typeof entry.notes === 'object' ? entry.notes : {};
        return [entry.text, entry.tags && entry.tags.join ? entry.tags.join(' ') : '', notes.signs, notes.body, notes.dreams, notes.emotion, notes.action, notes.lesson, notes.witness, entry.shabbat].filter(Boolean).join(' ');
      }).join(' ').toLowerCase();
      const terms = joined.match(/\b[0-9]{2,4}\b|\b[a-z]{4,}\b/g) || [];
      const counts = {};
      terms.forEach(term => { if (PATTERN_SKIP.has(term)) return; counts[term] = (counts[term] || 0) + 1; });
      const top = Object.entries(counts).filter(([, count]) => count >= 2).sort((a, b) => b[1] - a[1]).slice(0, 5);
      result.windows[windowSize] = top;
      if (windowSize === 28) {
        result.count = top.length;
        result.top = top;
        const sample = list.slice(0, 28);
        result.categories.words = top;
        result.categories.body = summarize(sample.map(entry => entry.notes?.body));
        result.categories.emotion = summarize(sample.map(entry => entry.notes?.emotion));
        result.categories.field = summarize(sample.map(entry => [entry.notes?.field, entry.notes?.weather, entry.notes?.animals, entry.notes?.technology, entry.shabbat].filter(Boolean).join(', ')));
        result.categories.action = summarize(sample.map(entry => entry.notes?.action));
        result.categories.lesson = summarize(sample.map(entry => entry.notes?.lesson));
      }
    });
    return result;
  }

  return { data, defaults:DEFAULTS, normalizeLocalDate, formatISODate, addDays, dayDiff, parseClock, calculateRemnantDate, calculateMoonNumber, calculateDayInMoon, calculateYearDay, calculateWeekGate, calculateShabbatState, calculateVisibleMoonPhase, calculateIllumination, calculateSunsetBoundary, buildYearMap, buildMirrorReading, calculateLocalizedSunset, anchorForYear, yearAnchorFor, getDaypart, calculateSolarGate, buildAstrologyMirror, buildCodexSeal, buildWitnessTemplate, detectPatterns };
});
