(() => {
  "use strict";

  const VERSION = "living-time-calendar-workbench/1.0.0";
  const PATTERN_DAYS = 364;
  const DAYS_PER_MOON = 28;
  const MOONS = 13;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const PIN_KEY = "sof.calendar-workbench.pins.v1";
  const SCALE_KEY = "sof.calendar-workbench.scale.v1";
  const NOTE_KEY = "sof.calendar-workbench.notes.v1";
  const MAX_PINS = 4;
  const MAX_NOTES = 200;
  const VALID_SCALES = Object.freeze(["day", "week", "month", "moon", "year"]);
  const PRESET_LABELS = Object.freeze({
    fullObservatory: "All Available",
    cleanPattern: "Pattern",
    livingSky: "Living Sky",
    weatherField: "Environment",
    passage: "Passage",
    witnessMap: "Witness",
    historicalField: "Deep Time",
    lowPower: "Low Power",
  });

  let _initialized = false;
  let _root = null;
  let _scale = "moon";
  let _pins = [];
  let _notes = [];
  let _clockTimer = 0;
  let _refreshFrame = 0;

  function _finiteInteger(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number) : null;
  }

  function clampDay(value) {
    const day = _finiteInteger(value);
    return Math.max(1, Math.min(PATTERN_DAYS, day || 1));
  }

  function wrapDay(value) {
    const parsed = _finiteInteger(value);
    const day = parsed == null ? 1 : parsed;
    return ((day - 1) % PATTERN_DAYS + PATTERN_DAYS) % PATTERN_DAYS + 1;
  }

  function moonDayForPatternDay(value) {
    const shared = globalThis.LivingTimeSphereTemporal?.moonDayForPatternDay?.(value);
    if (shared) return shared;
    const dayOfPatternYear = clampDay(value);
    return Object.freeze({
      dayOfPatternYear,
      moon: Math.floor((dayOfPatternYear - 1) / DAYS_PER_MOON) + 1,
      day: ((dayOfPatternYear - 1) % DAYS_PER_MOON) + 1,
      week: Math.floor(((dayOfPatternYear - 1) % DAYS_PER_MOON) / 7) + 1,
      dayOfWeek: ((dayOfPatternYear - 1) % 7) + 1,
    });
  }

  function _isoDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
  }

  function civilDateForPatternDay(year, value) {
    const anchor = globalThis.PatternCalendar?.epochForYear?.(Number(year));
    if (!(anchor instanceof Date) || Number.isNaN(anchor.getTime())) return "";
    return _isoDate(new Date(anchor.getTime() + (clampDay(value) - 1) * DAY_MS));
  }

  function _supportedYears() {
    const years = globalThis.AlignmentLedgerData?.listSupportedYears?.();
    return [...new Set((Array.isArray(years) ? years : [])
      .map(Number)
      .filter(Number.isFinite))].sort((a, b) => a - b);
  }

  function _nearestYear(value, years) {
    const requested = Number(value);
    if (!years.length) return requested || new Date().getUTCFullYear();
    if (years.includes(requested)) return requested;
    return years.reduce((best, year) => Math.abs(year - requested) < Math.abs(best - requested) ? year : best, years[0]);
  }

  function resolveCivilDate(value, supportedYears = _supportedYears()) {
    const iso = String(value || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return Object.freeze({ valid: false, reason: "invalid-date" });
    const date = new Date(`${iso}T12:00:00Z`);
    if (Number.isNaN(date.getTime()) || _isoDate(date) !== iso) return Object.freeze({ valid: false, reason: "invalid-date" });
    const conversion = globalThis.PatternCalendar?.convertEffectiveDate?.(date);
    if (!conversion) return Object.freeze({ valid: false, reason: "calendar-unavailable" });
    const alignmentYear = Number(conversion.anchorDate?.getUTCFullYear?.() || date.getUTCFullYear());
    const selectedYear = _nearestYear(alignmentYear, supportedYears);
    return Object.freeze({
      valid: true,
      inside: !!conversion.inside,
      civilDate: iso,
      alignmentYear,
      selectedYear,
      exactYearMatch: alignmentYear === selectedYear,
      patternYear: Number(conversion.patternYear || 0) || null,
      dayOfPatternYear: Number(conversion.dayOfPatternYear || 0) || null,
      moon: Number(conversion.moon || 0) || null,
      day: Number(conversion.day || 0) || null,
      isDayOutOfTime: !!conversion.isDayOutOfTime,
      isDeepTimeDay: !!conversion.isDeepTimeDay,
      intercalaryIndex: Number(conversion.intercalaryIndex || 0),
    });
  }

  function _partsInTimeZone(date, timeZone) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timeZone || "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }).formatToParts(date);
      return Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
    } catch {
      return _partsInTimeZone(date, "UTC");
    }
  }

  function boundaryStatus(now = new Date(), timeZone = "UTC", boundaryMode = "sunset", manualSunset = "18:00") {
    const parts = _partsInTimeZone(now, timeZone);
    const currentMinutes = Number(parts.hour || 0) * 60 + Number(parts.minute || 0) + Number(parts.second || 0) / 60;
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(manualSunset || "18:00"));
    const configuredMinutes = match
      ? Math.max(0, Math.min(1439, Number(match[1]) * 60 + Number(match[2])))
      : 18 * 60;
    const boundaryMinutes = boundaryMode === "midnight" ? 0 : configuredMinutes;
    let remainingMinutes = (boundaryMinutes - currentMinutes + 1440) % 1440;
    if (remainingMinutes < 0.02) remainingMinutes = 1440;
    const roundedRemaining = Math.max(1, Math.ceil(remainingMinutes));
    const hours = Math.floor(roundedRemaining / 60);
    const minutes = roundedRemaining % 60;
    const localClock = `${parts.hour || "00"}:${parts.minute || "00"}`;
    const dateKey = `${parts.year || ""}-${parts.month || ""}-${parts.day || ""}`;
    return Object.freeze({
      timeZone,
      boundaryMode,
      boundaryLabel: boundaryMode === "midnight" ? "Midnight boundary" : `Configured sunset · ${manualSunset || "18:00"}`,
      localClock,
      dateKey,
      remainingMinutes: roundedRemaining,
      remainingLabel: `${hours ? `${hours}h ` : ""}${minutes}m`,
    });
  }

  function compareCoordinates(first, second) {
    if (!first || !second) return null;
    const aDay = clampDay(first.dayOfPatternYear);
    const bDay = clampDay(second.dayOfPatternYear);
    const forward = (bDay - aDay + PATTERN_DAYS) % PATTERN_DAYS;
    const backward = (aDay - bDay + PATTERN_DAYS) % PATTERN_DAYS;
    const signed = forward === 0 ? 0 : (forward <= backward ? forward : -backward);
    const a = moonDayForPatternDay(aDay);
    const b = moonDayForPatternDay(bDay);
    const firstDate = /^\d{4}-\d{2}-\d{2}$/.test(first.civilDate || "") ? new Date(`${first.civilDate}T12:00:00Z`) : null;
    const secondDate = /^\d{4}-\d{2}-\d{2}$/.test(second.civilDate || "") ? new Date(`${second.civilDate}T12:00:00Z`) : null;
    const civilDelta = firstDate && secondDate ? Math.round((secondDate - firstDate) / DAY_MS) : null;
    return Object.freeze({
      signedPatternDays: signed,
      absolutePatternDays: Math.abs(signed),
      civilDays: civilDelta,
      sameCoordinate: aDay === bDay,
      sameMoon: a.moon === b.moon,
      sameWeek: a.moon === b.moon && a.week === b.week,
      angleDelta: Number((signed * (360 / PATTERN_DAYS)).toFixed(2)),
    });
  }


  function _safeCivilDate(value) {
    const iso = String(value || "");

    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      return null;
    }

    const date = new Date(`${iso}T12:00:00`);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date;
  }

  function _selectedCivilDate(state, model) {
    const selected =
      model?.selectedPatternPosition || null;

    const iso =
      selected?.effectiveDate ||
      selected?.civilDate ||
      civilDateForPatternDay(
        state.year,
        clampDay(
          selected?.dayOfPatternYear ||
          state.selectedDayOfYear ||
          1
        )
      );

    return _safeCivilDate(iso);
  }

  function _gregorianMonthDays(state, model) {
    const selectedDate =
      _selectedCivilDate(state, model) ||
      new Date();

    const engine =
      globalThis.SOFTemporalCoordinate;

    const year =
      selectedDate.getFullYear();

    const monthIndex =
      selectedDate.getMonth();

    const monthNumber =
      monthIndex + 1;

    const totalDays =
      engine?.daysInMonth
        ? engine.daysInMonth(year, monthNumber)
        : new Date(year, monthNumber, 0).getDate();

    const firstDay =
      new Date(
        year,
        monthIndex,
        1,
        12,
        0,
        0,
        0
      );

    const result = [];

    for (
      let day = 1;
      day <= totalDays;
      day += 1
    ) {
      const date =
        new Date(
          year,
          monthIndex,
          day,
          12,
          0,
          0,
          0
        );

      const coordinate =
        engine?.buildTemporalCoordinate?.(
          date,
          {
            timezone:
              globalThis.SOFTemporalCursor
                ?.getState?.()
                ?.timezone ||
              Intl.DateTimeFormat()
                .resolvedOptions()
                .timeZone,

            boundary:
              globalThis.SOFTemporalCursor
                ?.getState?.()
                ?.boundary ||
              "sunset"
          }
        ) || null;

      result.push(
        Object.freeze({
          date,
          iso:
            coordinate?.gregorian?.isoDate ||
            date.toISOString().slice(0, 10),

          year,
          month:
            monthNumber,

          monthIndex,
          day,

          weekday:
            date.getDay(),

          weekdayName:
            coordinate?.gregorian
              ?.weekdayName ||
            date.toLocaleDateString(
              "en-US",
              { weekday: "long" }
            ),

          coordinate
        })
      );
    }

    return Object.freeze({
      year,
      month:
        monthNumber,

      monthIndex,

      monthName:
        engine?.constants
          ?.MONTH_NAMES
          ?.[monthIndex] ||
        selectedDate.toLocaleDateString(
          "en-US",
          { month: "long" }
        ),

      firstWeekday:
        firstDay.getDay(),

      days:
        Object.freeze(result)
    });
  }

  function _setTemporalCursorDate(
    date,
    source,
    reason = "calendar-atlas-selection"
  ) {
    const cursor =
      globalThis.SOFTemporalCursor;

    if (
      cursor?.setDate &&
      date instanceof Date &&
      !Number.isNaN(date.getTime())
    ) {
      cursor.setDate(
        date,
        {
          source:
            source ||
            "calendar-atlas",

          reason
        }
      );

      return true;
    }

    return false;
  }

  function _selectCivilAtlasDate(
    iso,
    source = "calendar-gregorian-month"
  ) {
    const date =
      _safeCivilDate(iso);

    if (!date) {
      _announce(
        "That Gregorian date could not be resolved.",
        "warning"
      );

      return false;
    }

    if (
      _setTemporalCursorDate(
        date,
        source,
        "gregorian-calendar-selection"
      )
    ) {
      _scheduleRefresh();

      return true;
    }

    const resolved =
      resolveCivilDate(iso);

    if (
      resolved?.inside &&
      resolved.dayOfPatternYear
    ) {
      _selectDay(
        resolved.dayOfPatternYear,
        source
      );

      return true;
    }

    _announce(
      "The temporal cursor is still loading. Try the date again in a moment.",
      "warning"
    );

    return false;
  }

  function _gregorianDayButton(
    item,
    state,
    model
  ) {
    const coordinate =
      item.coordinate;

    const gregorian =
      coordinate?.gregorian;

    const remnant =
      coordinate?.remnant13Moons;

    const selectedCivil =
      _selectedCivilDate(state, model);

    const selectedIso =
      selectedCivil
        ? [
            selectedCivil.getFullYear(),
            String(
              selectedCivil.getMonth() + 1
            ).padStart(2, "0"),
            String(
              selectedCivil.getDate()
            ).padStart(2, "0")
          ].join("-")
        : "";

    const today = new Date();

    const todayIso =
      [
        today.getFullYear(),
        String(
          today.getMonth() + 1
        ).padStart(2, "0"),
        String(
          today.getDate()
        ).padStart(2, "0")
      ].join("-");

    const classes = [
      "calendar-day-cell",
      "calendar-gregorian-cell"
    ];

    if (item.iso === selectedIso) {
      classes.push("is-selected");
    }

    if (item.iso === todayIso) {
      classes.push("is-today");
    }

    if (remnant?.moonDay) {
      const patternWeekday =
        ((remnant.moonDay - 1) % 7) + 1;

      if (patternWeekday === 7) {
        classes.push("is-shabbat");
      } else if (patternWeekday === 6) {
        classes.push("is-preparation");
      } else if (patternWeekday === 1) {
        classes.push("is-return");
      }
    }

    const patternPrimary =
      remnant?.isYearGate
        ? "Year Gate"
        : (
            remnant?.moon &&
            remnant?.moonDay
          )
          ? `M${remnant.moon} · D${remnant.moonDay}`
          : "Outside";

    const patternSecondary =
      remnant?.patternDay
        ? `${remnant.patternDay}/364`
        : "Outside pattern";

    const title =
      [
        gregorian?.labels?.full ||
          item.iso,

        remnant?.labels?.full ||
          "Outside counted Pattern Year"
      ].join(" · ");

    return `
      <button
        class="${classes.join(" ")}"
        type="button"
        data-calendar-civil="${_escape(item.iso)}"
        role="gridcell"
        aria-label="${_escape(title)}"
      >
        <span>
          ${_escape(
            gregorian?.weekdayShort ||
            item.weekdayName.slice(0, 3)
          )}
        </span>

        <strong>
          ${item.day}
        </strong>

        <small>
          ${_escape(patternPrimary)}
        </small>

        <em>
          ${_escape(patternSecondary)}
        </em>

        <i aria-hidden="true"></i>
      </button>
    `;
  }

  function _renderGregorianMonth(
    state,
    model
  ) {
    const month =
      _gregorianMonthDays(
        state,
        model
      );

    const blanks =
      Array.from(
        {
          length:
            month.firstWeekday
        },
        () => (
          '<span class="calendar-month-blank" aria-hidden="true"></span>'
        )
      ).join("");

    return {
      month,
      html:
        blanks +
        month.days
          .map(
            day =>
              _gregorianDayButton(
                day,
                state,
                model
              )
          )
          .join("")
    };
  }

  function scaleDays(scale, selectedDay) {
    const selected = clampDay(selectedDay);
    const position = moonDayForPatternDay(selected);
    if (scale === "day") return Object.freeze([-2, -1, 0, 1, 2].map(offset => wrapDay(selected + offset)));
    if (scale === "week") {
      const start = (position.moon - 1) * DAYS_PER_MOON + (position.week - 1) * 7 + 1;
      return Object.freeze(Array.from({ length: 7 }, (_, index) => start + index));
    }
    if (scale === "moon") {
      const start = (position.moon - 1) * DAYS_PER_MOON + 1;
      return Object.freeze(Array.from({ length: DAYS_PER_MOON }, (_, index) => start + index));
    }
    return Object.freeze(Array.from({ length: MOONS }, (_, index) => index + 1));
  }

  function _escape(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function _readJson(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "null");
      return parsed == null ? fallback : parsed;
    } catch {
      return fallback;
    }
  }

  function _writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* local-first storage may be unavailable */ }
  }

  function normalizePins(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value.map(item => {
      const year = _finiteInteger(item?.year);
      const day = _finiteInteger(item?.dayOfPatternYear);
      if (!year || day == null || day < 1 || day > PATTERN_DAYS) return null;
      const id = `${year}-${day}`;
      if (seen.has(id)) return null;
      seen.add(id);
      return Object.freeze({
        id,
        year,
        dayOfPatternYear: day,
        civilDate: /^\d{4}-\d{2}-\d{2}$/.test(item.civilDate || "") ? item.civilDate : civilDateForPatternDay(year, day),
        addedAt: Number(item.addedAt || Date.now()),
      });
    }).filter(Boolean).slice(0, MAX_PINS);
  }

  function normalizeNotes(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value.map(item => {
      const year = _finiteInteger(item?.year);
      const day = _finiteInteger(item?.dayOfPatternYear);
      if (!year || day == null || day < 1 || day > PATTERN_DAYS) return null;
      const id = `${year}-${day}`;
      if (seen.has(id)) return null;
      seen.add(id);
      const title = String(item?.title || "").trim().slice(0, 120);
      const note = String(item?.note || "").trim().slice(0, 2000);
      if (!title && !note) return null;
      return Object.freeze({
        id,
        year,
        dayOfPatternYear: day,
        civilDate: /^\d{4}-\d{2}-\d{2}$/.test(item?.civilDate || "") ? item.civilDate : civilDateForPatternDay(year, day),
        title,
        note,
        updatedAt: Number(item?.updatedAt || Date.now()),
      });
    }).filter(Boolean).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_NOTES);
  }

  function _icsEscape(value) {
    return String(value || "")
      .replace(/\\/g, "\\\\")
      .replace(/\r?\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  }

  function _icsUnescape(value) {
    return String(value || "")
      .replace(/\\n/gi, "\n")
      .replace(/\\([\\,;])/g, "$1");
  }

  function _compactDate(iso) {
    return /^\d{4}-\d{2}-\d{2}$/.test(iso || "") ? iso.replace(/-/g, "") : "";
  }

  function _nextCivilDate(iso) {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(iso || "") ? new Date(`${iso}T12:00:00Z`) : null;
    if (!date || Number.isNaN(date.getTime())) return "";
    return _isoDate(new Date(date.getTime() + DAY_MS));
  }

  function buildIcs(value, { generatedAt = new Date() } = {}) {
    const entries = normalizeNotes(value);
    const stamp = generatedAt instanceof Date && !Number.isNaN(generatedAt.getTime())
      ? generatedAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
      : new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Scroll of Fire//Living Time Calendar Atlas//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Living Time Calendar",
    ];
    entries.forEach(entry => {
      const position = moonDayForPatternDay(entry.dayOfPatternYear);
      const civilDate = entry.civilDate || civilDateForPatternDay(entry.year, entry.dayOfPatternYear);
      if (!_compactDate(civilDate)) return;
      const title = entry.title || `Moon ${position.moon} · Day ${position.day}`;
      const description = [
        `Pattern Moon ${position.moon}, Day ${position.day}, Day ${entry.dayOfPatternYear}/364`,
        entry.note,
      ].filter(Boolean).join("\n\n");
      lines.push(
        "BEGIN:VEVENT",
        `UID:living-time-${entry.year}-${entry.dayOfPatternYear}@codexofreality.org`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${_compactDate(civilDate)}`,
        `DTEND;VALUE=DATE:${_compactDate(_nextCivilDate(civilDate))}`,
        `SUMMARY:${_icsEscape(title)}`,
        `DESCRIPTION:${_icsEscape(description)}`,
        "CATEGORIES:Living Time,Pattern Calendar",
        "TRANSP:TRANSPARENT",
        "END:VEVENT",
      );
    });
    lines.push("END:VCALENDAR");
    return `${lines.join("\r\n")}\r\n`;
  }

  function parseIcs(text, supportedYears = _supportedYears()) {
    const unfolded = String(text || "").replace(/\r?\n[ \t]/g, "");
    const events = unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/gi) || [];
    const notes = events.map((block, index) => {
      const rawDate = /^DTSTART(?:;[^:]*)?:(\d{8})/mi.exec(block)?.[1] || "";
      const civilDate = rawDate ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}` : "";
      const resolved = resolveCivilDate(civilDate, supportedYears);
      if (!resolved.valid || !resolved.inside || !resolved.exactYearMatch || !resolved.dayOfPatternYear) return null;
      const title = _icsUnescape(/^SUMMARY:(.*)$/mi.exec(block)?.[1] || "Imported calendar entry");
      const note = _icsUnescape(/^DESCRIPTION:(.*)$/mi.exec(block)?.[1] || "");
      return {
        id: `${resolved.selectedYear}-${resolved.dayOfPatternYear}`,
        year: resolved.selectedYear,
        dayOfPatternYear: resolved.dayOfPatternYear,
        civilDate,
        title,
        note,
        updatedAt: Date.now() - index,
      };
    }).filter(Boolean);
    return normalizeNotes(notes);
  }

  function _moonData(moon) {
    return globalThis.PatternCalendarData?.moons?.[moon - 1] || { idx: moon, name: `Moon ${moon}`, element: "", essence: "" };
  }

  function _dayData(day) {
    return globalThis.PatternCalendarData?.dayArchetypes?.[day - 1] || ["Day", ""];
  }

  function _gateLabel(position) {
    if ([2, 9, 16, 23].includes(position.day)) return "Shabbat Gate";
    if (position.dayOfWeek === 6) return "Preparation Gate";
    if (position.dayOfWeek === 1) return "Return Gate";
    return globalThis.PatternCalendarData?.weekGates?.[position.week - 1]?.[0] || `Week ${position.week}`;
  }

  function _formatShortCivil(iso) {
    if (!iso) return "Date unavailable";
    const date = new Date(`${iso}T12:00:00Z`);
    if (Number.isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
  }

  function _currentState() {
    return globalThis.LivingTimeSphereUi?.getState?.() || {};
  }

  function _currentModel() {
    try { return globalThis.LivingTimeSphereUi?.getCurrentModel?.() || null; } catch { return null; }
  }

  function _noteFor(year, dayOfPatternYear) {
    const id = `${Number(year)}-${clampDay(dayOfPatternYear)}`;
    return _notes.find(note => note.id === id) || null;
  }

  function _announce(message, kind = "info") {
    const status = document.getElementById("calendar-workbench-status");
    if (!status) return;
    status.dataset.kind = kind;
    status.textContent = message;
  }

  function _renderClock(state) {
    const status = boundaryStatus(new Date(), state.timeZone || "America/Los_Angeles", state.boundaryMode || "sunset", state.manualSunset || "18:00");
    const environment = globalThis.SofEnvironmentState?.getEnvironmentState?.() || null;
    const forecastSunset = String(environment?.daily?.sunset || "");
    const forecastClock = /T(\d{2}:\d{2})/.exec(forecastSunset)?.[1] || "";
    const forecastNote = forecastClock
      ? ` · Forecast sunset ${forecastClock} at the weather location (reference only)`
      : "";
    const clock = document.getElementById("calendar-boundary-clock");
    if (clock) clock.innerHTML = `<strong>${_escape(status.localClock)}</strong><span>${_escape(status.timeZone)}</span><small>${_escape(status.boundaryLabel)} · ${_escape(status.remainingLabel)} until next turn${_escape(forecastNote)}</small>`;
  }

  function _renderSelectedState(state, model) {
    const selected = model?.selectedPatternPosition;
    const dayOfYear = clampDay(selected?.dayOfPatternYear || state.selectedDayOfYear || 1);
    const position = moonDayForPatternDay(dayOfYear);
    const moon = _moonData(position.moon);
    const day = _dayData(position.day);
    const civilDate = selected?.effectiveDate || selected?.civilDate || civilDateForPatternDay(state.year, dayOfYear);
    const summary = document.getElementById("calendar-selected-summary");
    if (summary) {
      summary.innerHTML = `<span>${selected?.isToday ? "LIVE TODAY" : "SELECTED"}</span><strong>Moon ${position.moon} · ${_escape(moon.name)} · Day ${position.day}</strong><small>${_escape(civilDate)} · Day ${dayOfYear}/364 · ${_escape(day[0])}</small>`;
    }
    const civilInput = document.getElementById("calendar-civil-date");
    if (civilInput && document.activeElement !== civilInput) civilInput.value = civilDate || "";
    const moonSelect = document.getElementById("calendar-pattern-moon");
    const daySelect = document.getElementById("calendar-pattern-day");
    if (moonSelect) moonSelect.value = String(position.moon);
    if (daySelect) daySelect.value = String(position.day);
  }

  function _dayButton(dayOfYear, state, model, scale) {
    const position = moonDayForPatternDay(dayOfYear);
    const dayData = _dayData(position.day);
    const civilDate = civilDateForPatternDay(state.year, dayOfYear);
    const selectedDay = clampDay(model?.selectedPatternPosition?.dayOfPatternYear || state.selectedDayOfYear || 1);
    const todayDay = Number(model?.todayPatternPosition?.dayOfPatternYear || 0);
    const localNote = _noteFor(state.year, dayOfYear);
    const classes = ["calendar-day-cell"];
    if (dayOfYear === selectedDay) classes.push("is-selected");
    if (dayOfYear === todayDay) classes.push("is-today");
    if ([2, 9, 16, 23].includes(position.day)) classes.push("is-shabbat");
    if (position.dayOfWeek === 6) classes.push("is-preparation");
    if (position.dayOfWeek === 1) classes.push("is-return");
    if (localNote) classes.push("has-note");
    const current = dayOfYear === selectedDay ? ' aria-current="date"' : "";
    const expanded = scale === "day" || scale === "week";
    return `<button class="${classes.join(" ")}" type="button" data-calendar-day="${dayOfYear}"${current} aria-label="${_escape(`Moon ${position.moon}, Day ${position.day}, ${civilDate}, ${dayData[0]}, ${_gateLabel(position)}${localNote ? `, local note: ${localNote.title || "saved"}` : ""}`)}">
      <span>M${position.moon} · ${dayOfYear}/364</span>
      <strong>${position.day}</strong>
      <small>${_escape(_formatShortCivil(civilDate))}</small>
      ${expanded ? `<em>${_escape(dayData[0])} · ${_escape(_gateLabel(position))}</em>` : `<i aria-hidden="true"></i>`}
      ${localNote ? '<b class="calendar-note-dot" aria-hidden="true"></b>' : ""}
    </button>`;
  }

  function _moonButton(moonNumber, state, model) {
    const selectedDay = clampDay(model?.selectedPatternPosition?.dayOfPatternYear || state.selectedDayOfYear || 1);
    const selectedPosition = moonDayForPatternDay(selectedDay);
    const todayPosition = moonDayForPatternDay(model?.todayPatternPosition?.dayOfPatternYear || 1);
    const moon = _moonData(moonNumber);
    const targetDay = (moonNumber - 1) * DAYS_PER_MOON + selectedPosition.day;
    const start = civilDateForPatternDay(state.year, (moonNumber - 1) * DAYS_PER_MOON + 1);
    const end = civilDateForPatternDay(state.year, moonNumber * DAYS_PER_MOON);
    const noteCount = _notes.filter(note => note.year === Number(state.year) && moonDayForPatternDay(note.dayOfPatternYear).moon === moonNumber).length;
    const classes = ["calendar-moon-cell"];
    if (moonNumber === selectedPosition.moon) classes.push("is-selected");
    if (moonNumber === todayPosition.moon) classes.push("is-today");
    const current = moonNumber === selectedPosition.moon ? ' aria-current="date"' : "";
    return `<button class="${classes.join(" ")}" type="button" data-calendar-day="${targetDay}"${current} aria-label="${_escape(`Moon ${moonNumber}, ${moon.name}, ${start} through ${end}${noteCount ? `, ${noteCount} local notes` : ""}`)}">
      <span>Moon ${moonNumber}</span><strong>${_escape(moon.name)}</strong><small>${_escape(_formatShortCivil(start))} – ${_escape(_formatShortCivil(end))}</small><em>${_escape(moon.element || "Pattern")}${noteCount ? ` · ${noteCount} notes` : ""}</em>
    </button>`;
  }

  function _renderAtlas(state, model) {
    const grid =
      document.getElementById(
        "calendar-atlas-grid"
      );

    if (!grid) return;

    const selectedDay =
      clampDay(
        model?.selectedPatternPosition
          ?.dayOfPatternYear ||
        state.selectedDayOfYear ||
        1
      );

    const position =
      moonDayForPatternDay(
        selectedDay
      );

    grid.dataset.scale =
      _scale;

    grid.classList.toggle(
      "is-gregorian-month",
      _scale === "month"
    );

    grid.setAttribute(
      "aria-label",
      `${_scale} calendar view`
    );

    let headingText = "";

    if (_scale === "month") {
      const result =
        _renderGregorianMonth(
          state,
          model
        );

      grid.innerHTML =
        result.html;

      headingText =
        `${result.month.monthName} ${result.month.year} · Gregorian Month`;
    } else if (_scale === "year") {
      grid.innerHTML =
        scaleDays(
          "year",
          selectedDay
        )
          .map(
            moon =>
              _moonButton(
                moon,
                state,
                model
              )
          )
          .join("");

      headingText =
        `Pattern Year ${state.year} · 13 Moons`;
    } else {
      grid.innerHTML =
        scaleDays(
          _scale,
          selectedDay
        )
          .map(
            day =>
              _dayButton(
                day,
                state,
                model,
                _scale
              )
          )
          .join("");

      headingText =
        _scale === "moon"
          ? `Moon ${position.moon} · ${_moonData(position.moon).name}`

          : _scale === "week"
            ? `Moon ${position.moon} · Week ${position.week}`

            : `Selected Day · Moon ${position.moon} Day ${position.day}`;
    }

    const heading =
      document.getElementById(
        "calendar-atlas-title"
      );

    if (heading) {
      heading.textContent =
        headingText;
    }

    document
      .querySelectorAll(
        "[data-calendar-scale]"
      )
      .forEach(button => {
        button.setAttribute(
          "aria-pressed",
          button.dataset.calendarScale ===
            _scale
            ? "true"
            : "false"
        );
      });
  }

  function _renderPins(state, model) {
    const tray = document.getElementById("calendar-compare-tray");
    if (!tray) return;
    const selected = model?.selectedPatternPosition;
    const current = selected?.dayOfPatternYear ? {
      year: Number(state.year),
      dayOfPatternYear: Number(selected.dayOfPatternYear),
      civilDate: selected.effectiveDate || selected.civilDate || civilDateForPatternDay(state.year, selected.dayOfPatternYear),
    } : null;
    if (!_pins.length) {
      tray.innerHTML = '<p class="calendar-empty">Pin a selected day to compare Pattern distance, civil distance, Moon, week, and angle.</p>';
      return;
    }
    const cards = _pins.map(pin => {
      const position = moonDayForPatternDay(pin.dayOfPatternYear);
      return `<article class="calendar-pin-card"><div><span>${pin.year}</span><strong>Moon ${position.moon} · Day ${position.day}</strong><small>${_escape(pin.civilDate)} · ${pin.dayOfPatternYear}/364</small></div><button type="button" data-calendar-remove-pin="${_escape(pin.id)}" aria-label="Remove pinned date ${_escape(pin.civilDate)}">×</button></article>`;
    }).join("");
    const comparisonBase = _pins.length >= 2 ? _pins[0] : _pins[0];
    const comparisonTarget = _pins.length >= 2 ? _pins[1] : current;
    const comparison = compareCoordinates(comparisonBase, comparisonTarget);
    const comparisonHtml = comparison && comparisonTarget
      ? `<div class="calendar-compare-result"><strong>${comparison.sameCoordinate ? "Same Pattern coordinate" : `${comparison.absolutePatternDays} Pattern days apart`}</strong><span>${comparison.civilDays == null ? "Civil distance unavailable" : `${Math.abs(comparison.civilDays)} civil days apart`} · ${comparison.angleDelta > 0 ? "+" : ""}${comparison.angleDelta}°</span><small>${comparison.sameMoon ? "Same Moon" : "Different Moons"} · ${comparison.sameWeek ? "Same Week Gate" : "Different Week Gates"}</small></div>`
      : "";
    tray.innerHTML = `${cards}${comparisonHtml}`;
  }

  function _renderJournal(state, model) {
    const selected = model?.selectedPatternPosition;
    const dayOfPatternYear = clampDay(selected?.dayOfPatternYear || state.selectedDayOfYear || 1);
    const note = _noteFor(state.year, dayOfPatternYear);
    const titleInput = document.getElementById("calendar-note-title");
    const noteInput = document.getElementById("calendar-note-body");
    if (titleInput && document.activeElement !== titleInput) titleInput.value = note?.title || "";
    if (noteInput && document.activeElement !== noteInput) noteInput.value = note?.note || "";
    const context = document.getElementById("calendar-note-context");
    if (context) {
      const position = moonDayForPatternDay(dayOfPatternYear);
      context.textContent = `Private note for ${state.year} · Moon ${position.moon} Day ${position.day} · ${civilDateForPatternDay(state.year, dayOfPatternYear)}`;
    }

    const agenda = document.getElementById("calendar-local-agenda");
    if (!agenda) return;
    const yearNotes = _notes
      .filter(item => item.year === Number(state.year))
      .sort((a, b) => a.dayOfPatternYear - b.dayOfPatternYear);
    if (!yearNotes.length) {
      agenda.innerHTML = '<p class="calendar-empty">No private notes in this alignment year yet.</p>';
      return;
    }
    agenda.innerHTML = yearNotes.map(item => {
      const position = moonDayForPatternDay(item.dayOfPatternYear);
      return `<article class="calendar-agenda-item${item.dayOfPatternYear === dayOfPatternYear ? " is-selected" : ""}">
        <button type="button" data-calendar-note-day="${item.dayOfPatternYear}"><span>M${position.moon} · D${position.day}</span><strong>${_escape(item.title || "Untitled note")}</strong><small>${_escape(item.civilDate)}</small></button>
        <button type="button" data-calendar-remove-note="${_escape(item.id)}" aria-label="Delete local note ${_escape(item.title || item.civilDate)}">×</button>
      </article>`;
    }).join("");
  }

  function refresh() {
    if (!_root) return;
    const state = _currentState();
    const model = _currentModel();
    _renderSelectedState(state, model);
    _renderAtlas(state, model);
    _renderPins(state, model);
    _renderJournal(state, model);
    _renderClock(state);
  }

  function _scheduleRefresh() {
    if (_refreshFrame) return;
    const schedule = typeof requestAnimationFrame === "function" ? requestAnimationFrame : callback => setTimeout(callback, 16);
    _refreshFrame = schedule(() => {
      _refreshFrame = 0;
      refresh();
    });
  }

  function _selectDay(day, source) {
    const state = _currentState();
    const selected = globalThis.LivingTimeSphereUi?.selectDay?.(clampDay(day), {
      year: Number(state.year),
      marker: `day-${clampDay(day)}`,
      source,
      action: "CALENDAR_ATLAS_SELECTION",
    });
    if (!selected) _announce("The Sphere selection engine is not ready yet. Try again after the baseline appears.", "warning");
    else _scheduleRefresh();
  }

  function _jumpCivilDate() {
    const input = document.getElementById("calendar-civil-date");
    const resolved = resolveCivilDate(input?.value);
    if (!resolved.valid) {
      _announce("Enter a valid civil date.", "warning");
      return;
    }
    if (!resolved.inside) {
      const label = resolved.isDeepTimeDay ? "Deep Time Day" : "Day Out of Time";
      _announce(`${resolved.civilDate} is ${label}, outside the counted 13 × 28 year. It remains a visible outside day and is not forced into a Moon.`, "outside");
      return;
    }
    const civilDate =
      _safeCivilDate(
        resolved.civilDate
      );

    if (
      !civilDate ||
      !_setTemporalCursorDate(
        civilDate,
        "calendar-civil-jump",
        "civil-calendar-jump"
      )
    ) {
      globalThis.LivingTimeSphereUi
        ?.selectDay?.(
          resolved.dayOfPatternYear,
          {
            year:
              resolved.selectedYear,

            marker:
              `day-${resolved.dayOfPatternYear}`,

            source:
              "calendar-civil-jump",

            action:
              "CALENDAR_CIVIL_DATE_JUMP"
          }
        );
    }
    const supportNote = resolved.exactYearMatch ? "" : ` Detailed alignment data uses nearest supported year ${resolved.selectedYear}.`;
    _announce(`${resolved.civilDate} maps to Moon ${resolved.moon}, Day ${resolved.day}, Day ${resolved.dayOfPatternYear}/364.${supportNote}`, resolved.exactYearMatch ? "success" : "warning");
    _scheduleRefresh();
  }

  function _jumpPatternDate() {
    const moon = Math.max(1, Math.min(MOONS, Number(document.getElementById("calendar-pattern-moon")?.value) || 1));
    const day = Math.max(1, Math.min(DAYS_PER_MOON, Number(document.getElementById("calendar-pattern-day")?.value) || 1));
    _selectDay((moon - 1) * DAYS_PER_MOON + day, "calendar-pattern-jump");
  }

  function _pinSelected() {
    const state = _currentState();
    const model = _currentModel();
    const selected = model?.selectedPatternPosition;
    if (!selected?.dayOfPatternYear || !state.year) {
      _announce("Select a counted Pattern day before pinning it.", "warning");
      return;
    }
    const pin = {
      id: `${state.year}-${selected.dayOfPatternYear}`,
      year: Number(state.year),
      dayOfPatternYear: Number(selected.dayOfPatternYear),
      civilDate: selected.effectiveDate || selected.civilDate || civilDateForPatternDay(state.year, selected.dayOfPatternYear),
      addedAt: Date.now(),
    };
    _pins = normalizePins([pin, ..._pins.filter(item => item.id !== pin.id)]);
    _writeJson(PIN_KEY, _pins);
    _renderPins(state, model);
    _announce(`Pinned ${pin.civilDate} for comparison.`, "success");
  }

  function _saveSelectedNote() {
    const state = _currentState();
    const model = _currentModel();
    const selected = model?.selectedPatternPosition;
    if (!selected?.dayOfPatternYear || !state.year) {
      _announce("Select a counted Pattern day before saving a note.", "warning");
      return;
    }
    const id = `${state.year}-${selected.dayOfPatternYear}`;
    const title = String(document.getElementById("calendar-note-title")?.value || "").trim().slice(0, 120);
    const note = String(document.getElementById("calendar-note-body")?.value || "").trim().slice(0, 2000);
    if (!title && !note) {
      _notes = _notes.filter(item => item.id !== id);
      _writeJson(NOTE_KEY, _notes);
      refresh();
      _announce("The empty local note was removed.");
      return;
    }
    const entry = {
      id,
      year: Number(state.year),
      dayOfPatternYear: Number(selected.dayOfPatternYear),
      civilDate: selected.effectiveDate || selected.civilDate || civilDateForPatternDay(state.year, selected.dayOfPatternYear),
      title,
      note,
      updatedAt: Date.now(),
    };
    _notes = normalizeNotes([entry, ..._notes.filter(item => item.id !== id)]);
    _writeJson(NOTE_KEY, _notes);
    refresh();
    _announce("Private day note saved on this device.", "success");
  }

  function _calendarExportEntries() {
    const state = _currentState();
    const model = _currentModel();
    const selected = model?.selectedPatternPosition;
    const extras = _pins.map(pin => {
      const position = moonDayForPatternDay(pin.dayOfPatternYear);
      return {
        ...pin,
        title: `Pinned · Moon ${position.moon} Day ${position.day}`,
        note: `Pattern Day ${pin.dayOfPatternYear}/364`,
        updatedAt: pin.addedAt,
      };
    });
    if (selected?.dayOfPatternYear && state.year) {
      const position = moonDayForPatternDay(selected.dayOfPatternYear);
      extras.push({
        year: Number(state.year),
        dayOfPatternYear: Number(selected.dayOfPatternYear),
        civilDate: selected.effectiveDate || selected.civilDate || civilDateForPatternDay(state.year, selected.dayOfPatternYear),
        title: `Selected · Moon ${position.moon} Day ${position.day}`,
        note: `Pattern Day ${selected.dayOfPatternYear}/364`,
        updatedAt: Date.now(),
      });
    }
    return normalizeNotes([..._notes, ...extras]);
  }

  function _exportCalendar() {
    const entries = _calendarExportEntries();
    if (!entries.length || typeof Blob === "undefined" || !globalThis.URL?.createObjectURL) {
      _announce("No dated entries are available to export.", "warning");
      return;
    }
    const blob = new Blob([buildIcs(entries)], { type: "text/calendar;charset=utf-8" });
    const href = globalThis.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `living-time-calendar-${new Date().toISOString().slice(0, 10)}.ics`;
    anchor.hidden = true;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => globalThis.URL.revokeObjectURL(href), 1000);
    _announce(`Exported ${entries.length} dated ${entries.length === 1 ? "entry" : "entries"} as an iCalendar file.`, "success");
  }

  async function _importCalendar(event) {
    const input = event?.currentTarget;
    const file = input?.files?.[0];
    if (!file || typeof file.text !== "function") return;
    try {
      const imported = parseIcs(await file.text());
      if (!imported.length) {
        _announce("No counted Pattern dates were found in that iCalendar file.", "warning");
        return;
      }
      const importedIds = new Set(imported.map(item => item.id));
      _notes = normalizeNotes([...imported, ..._notes.filter(item => !importedIds.has(item.id))]);
      _writeJson(NOTE_KEY, _notes);
      refresh();
      _announce(`Imported ${imported.length} private calendar ${imported.length === 1 ? "entry" : "entries"}.`, "success");
    } catch {
      _announce("That iCalendar file could not be read.", "warning");
    } finally {
      if (input) input.value = "";
    }
  }

  function _applyPreset(name) {
    const label = PRESET_LABELS[name];
    if (!label || !globalThis.LivingTimeSphereUi?.applyLayerPreset?.(name)) {
      _announce("That lens is unavailable in this build.", "warning");
      return;
    }
    document.querySelectorAll("[data-calendar-preset]").forEach(button => {
      button.setAttribute("aria-pressed", button.dataset.calendarPreset === name ? "true" : "false");
    });
    _announce(`${label} lens applied. Unsupported data remains visibly unavailable rather than being implied.`, "success");
  }

  function _wireControls() {
    _root.addEventListener("click", event => {
      const target = event.target.closest?.("button");
      if (!target) return;
      if (target.dataset.calendarCivil) {
        _selectCivilAtlasDate(
          target.dataset.calendarCivil,
          "calendar-gregorian-month"
        );
      } else if (target.dataset.calendarDay) {
        _selectDay(
          target.dataset.calendarDay,
          "calendar-atlas-grid"
        );
      } else if (target.dataset.calendarScale) {
        _scale = VALID_SCALES.includes(target.dataset.calendarScale) ? target.dataset.calendarScale : "moon";
        _writeJson(SCALE_KEY, _scale);
        _renderAtlas(_currentState(), _currentModel());
      } else if (target.dataset.calendarPreset) {
        _applyPreset(target.dataset.calendarPreset);
      } else if (target.dataset.calendarRemovePin) {
        _pins = _pins.filter(pin => pin.id !== target.dataset.calendarRemovePin);
        _writeJson(PIN_KEY, _pins);
        _renderPins(_currentState(), _currentModel());
      } else if (target.dataset.calendarNoteDay) {
        _selectDay(target.dataset.calendarNoteDay, "calendar-local-agenda");
      } else if (target.dataset.calendarRemoveNote) {
        _notes = _notes.filter(note => note.id !== target.dataset.calendarRemoveNote);
        _writeJson(NOTE_KEY, _notes);
        refresh();
        _announce("Private day note deleted.");
      }
    });
    document.getElementById("calendar-jump-civil")?.addEventListener("click", _jumpCivilDate);
    document.getElementById("calendar-civil-date")?.addEventListener("keydown", event => {
      if (event.key === "Enter") { event.preventDefault(); _jumpCivilDate(); }
    });
    document.getElementById("calendar-jump-pattern")?.addEventListener("click", _jumpPatternDate);
    document.getElementById("calendar-return-today")?.addEventListener("click", () => {
      globalThis.LivingTimeSphereUi?.returnToToday?.({ fieldRange: "now", switchViewMode: true, source: "calendar-atlas" });
      _announce("Returned every calendar view to the live boundary-aware Today.", "success");
      _scheduleRefresh();
    });
    document.getElementById("calendar-pin-selected")?.addEventListener("click", _pinSelected);
    document.getElementById("calendar-save-note")?.addEventListener("click", _saveSelectedNote);
    document.getElementById("calendar-export-ics")?.addEventListener("click", _exportCalendar);
    document.getElementById("calendar-import-ics")?.addEventListener("change", _importCalendar);
    document.getElementById("calendar-clear-pins")?.addEventListener("click", () => {
      _pins = [];
      _writeJson(PIN_KEY, _pins);
      _renderPins(_currentState(), _currentModel());
      _announce("Comparison pins cleared.");
    });
    _root.addEventListener("keydown", event => {
      if (["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(event.target?.tagName)) return;
      const state = _currentState();
      const selected = clampDay(state.selectedDayOfYear || _currentModel()?.selectedPatternPosition?.dayOfPatternYear || 1);
      let handled = true;
      if (event.key === "ArrowLeft") _selectDay(wrapDay(selected - (event.shiftKey ? 7 : 1)), "calendar-keyboard");
      else if (event.key === "ArrowRight") _selectDay(wrapDay(selected + (event.shiftKey ? 7 : 1)), "calendar-keyboard");
      else if (event.key === "PageUp") _selectDay(wrapDay(selected - 28), "calendar-keyboard");
      else if (event.key === "PageDown") _selectDay(wrapDay(selected + 28), "calendar-keyboard");
      else if (event.key.toLowerCase() === "t") globalThis.LivingTimeSphereUi?.returnToToday?.({ fieldRange: "now", switchViewMode: true, source: "calendar-keyboard" });
      else if (event.key.toLowerCase() === "p") _pinSelected();
      else if (
        ["d", "w", "g", "m", "y"]
          .includes(
            event.key.toLowerCase()
          )
      ) {
        _scale = ({
          d: "day",
          w: "week",
          g: "month",
          m: "moon",
          y: "year"
        })[
          event.key.toLowerCase()
        ];

        _writeJson(
          SCALE_KEY,
          _scale
        );

        _renderAtlas(
          state,
          _currentModel()
        );
      } else handled = false;
      if (handled) event.preventDefault();
    });
  }

  function _populateSelects() {
    const moonSelect = document.getElementById("calendar-pattern-moon");
    const daySelect = document.getElementById("calendar-pattern-day");
    if (moonSelect && !moonSelect.options.length) {
      moonSelect.innerHTML = Array.from({ length: MOONS }, (_, index) => `<option value="${index + 1}">Moon ${index + 1} · ${_escape(_moonData(index + 1).name)}</option>`).join("");
    }
    if (daySelect && !daySelect.options.length) {
      daySelect.innerHTML = Array.from({ length: DAYS_PER_MOON }, (_, index) => `<option value="${index + 1}">Day ${index + 1} · ${_escape(_dayData(index + 1)[0])}</option>`).join("");
    }
    const civilInput = document.getElementById("calendar-civil-date");
    const years = _supportedYears();
    if (civilInput && years.length) {
      civilInput.min = _isoDate(globalThis.PatternCalendar?.epochForYear?.(years[0])) || "";
      const nextAnchor = globalThis.PatternCalendar?.epochForYear?.(years[years.length - 1] + 1);
      civilInput.max = nextAnchor ? _isoDate(new Date(nextAnchor.getTime() - DAY_MS)) : "";
    }
  }

  function init() {
    if (_initialized) return true;
    _root = document.getElementById("calendar-workbench");
    if (!_root) return false;
    _initialized = true;
    const storedScale = _readJson(SCALE_KEY, "moon");
    _scale = VALID_SCALES.includes(storedScale) ? storedScale : "moon";
    _pins = normalizePins(_readJson(PIN_KEY, []));
    _notes = normalizeNotes(_readJson(NOTE_KEY, []));
    _populateSelects();
    _wireControls();
    window.addEventListener("livingtime:ready", _scheduleRefresh);
    window.addEventListener("livingtime:selectionchange", _scheduleRefresh);
    window.addEventListener("livingtime:layerschange", _scheduleRefresh);
    window.addEventListener("sof:environment-change", _scheduleRefresh);
    window.addEventListener("sof:location-changed", _scheduleRefresh);
    window.addEventListener("pagehide", () => {
      if (_clockTimer) clearInterval(_clockTimer);
      _clockTimer = 0;
    }, { once: true });
    _clockTimer = setInterval(() => _renderClock(_currentState()), 30000);
    refresh();
    return true;
  }

  globalThis.LivingTimeCalendarWorkbench = Object.freeze({
    version: VERSION,
    init,
    refresh,
    resolveCivilDate,
    civilDateForPatternDay,
    boundaryStatus,
    compareCoordinates,
    scaleDays,
    normalizePins,
    normalizeNotes,
    buildIcs,
    parseIcs,
    _internals: Object.freeze({ clampDay, wrapDay, moonDayForPatternDay }),
  });
})();
