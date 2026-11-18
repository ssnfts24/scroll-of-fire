/* =====================================================================
 * Day Telling — the day speaks, in plain language.
 *
 * A pure module: it takes a Pattern coordinate produced by the canonical
 * PatternCalendar.fromCivilDate (the single temporal authority — this
 * module keeps no clock of its own) plus the canonical PatternCalendarData
 * record, and returns the day's telling as structured plain language.
 *
 * The telling is generated from data and position rules only. Nothing is
 * hand-written per day. Two layers are kept apart, and the return value
 * keeps them apart:
 *
 *   - position / arc: arithmetic facts — where the day sits in its moon,
 *     its week, and the counted year, and what comes next.
 *   - reading: the Codex's own interpretive layer (moon essence, element
 *     and tone, the day's archetype, the week's gate, the moon's
 *     practice), drawn verbatim from PatternCalendarData and labeled
 *     as the Codex's reading so the two never blur.
 *
 * No DOM, no storage, no network. Same input → same output.
 * ===================================================================== */
(() => {
  "use strict";

  const VERSION = "day-telling/1.0.0";

  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const ORDINALS = [
    "first", "second", "third", "fourth", "fifth", "sixth", "seventh",
    "eighth", "ninth", "tenth", "eleventh", "twelfth", "thirteenth",
    "fourteenth", "fifteenth", "sixteenth", "seventeenth", "eighteenth",
    "nineteenth", "twentieth", "twenty-first", "twenty-second",
    "twenty-third", "twenty-fourth", "twenty-fifth", "twenty-sixth",
    "twenty-seventh", "twenty-eighth"
  ];

  function daysPhrase(count) {
    return count === 1 ? "1 day" : `${count} days`;
  }

  function formatCivilKey(isoKey, weekday) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoKey || ""));
    if (!match) return weekday ? String(weekday) : "";
    const month = MONTH_NAMES[Number(match[2]) - 1] || "";
    const day = Number(match[3]);
    const year = match[1];
    const dateLine = `${month} ${day}, ${year}`;
    return weekday ? `${weekday}, ${dateLine}` : dateLine;
  }

  function formatAnchorDate(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return `${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
  }

  function gateName(gateEntry) {
    const raw = Array.isArray(gateEntry) ? String(gateEntry[0] || "") : "";
    const parts = raw.split("·");
    return (parts.length > 1 ? parts[parts.length - 1] : raw).trim();
  }

  function countedTelling(summary, data) {
    const moon = Number(summary.moon);
    const day = Number(summary.day);
    const patternDay = Number(summary.dayOfPatternYear);
    const weekOfMoon = Number(summary.weekOfMoon);
    const weekOfYear = Number(summary.weekOfYear);
    const moons = Array.isArray(data?.moons) ? data.moons : [];
    const moonRecord = moons[moon - 1] || {};
    const moonName = summary.moonName || moonRecord.name || `Moon ${moon}`;
    const archetype = Array.isArray(summary.dayArchetype) ? summary.dayArchetype : null;
    const gateEntry = Array.isArray(data?.weekGates) ? data.weekGates[weekOfMoon - 1] : null;

    const civilLine = formatCivilKey(summary.civilDate, summary.civilWeekday);
    const daysLeftInMoon = 28 - day;
    const daysLeftInYear = 364 - patternDay;

    /* ---- position: where the day sits (arithmetic only) ---- */
    const position = [];
    position.push(
      `${civilLine} — day ${day} of Moon ${moon}, the ${moonName} moon.`
    );
    position.push(
      `Pattern Day ${patternDay} of 364. A Pattern Day is the day's number in the counted year: ` +
      (daysLeftInYear === 0
        ? "this is the last counted day of the year."
        : `${daysLeftInYear === 1 ? "1 counted day remains" : `${daysLeftInYear} counted days remain`} after today.`)
    );
    position.push(
      `Week ${weekOfMoon} of this moon — week ${weekOfYear} of the year's 52 weeks. ` +
      `It is year ${summary.patternYear} of the count` +
      (formatAnchorDate(summary.anchorDate)
        ? `, which began on ${formatAnchorDate(summary.anchorDate)}.`
        : ".")
    );

    /* ---- arc: the day's place in the moon's movement (position rules) ---- */
    const arc = [];
    const weekStartDay = (weekOfMoon - 1) * 7 + 1;
    const weekEndDay = weekOfMoon * 7;
    if (day === 1) {
      arc.push(`A new moon begins today — the ${moonName} moon opens.`);
    } else if (day === 28) {
      arc.push(`This moon closes today.`);
    } else {
      arc.push(
        `Day ${day} of the moon's 28 — ${daysPhrase(daysLeftInMoon)} of this moon remain after today.`
      );
    }
    if (day === weekStartDay) {
      arc.push(`A new week of the moon${day === 1 ? " also" : ""} begins today: week ${weekOfMoon}, running to day ${weekEndDay}.`);
    } else {
      arc.push(
        `Week ${weekOfMoon} runs from day ${weekStartDay} to day ${weekEndDay} of the moon; today is its ${ORDINALS[day - weekStartDay] || ""} day.`
      );
    }
    if (moon < 13) {
      const nextMoon = moons[moon] || {};
      arc.push(
        day === 28
          ? `Tomorrow the next moon opens: Moon ${moon + 1}, the ${nextMoon.name || ""} moon.`
          : `When this moon closes, Moon ${moon + 1} — the ${nextMoon.name || ""} moon — begins.`
      );
    } else if (patternDay === 364) {
      arc.push(
        `The counted year ends with today. Tomorrow the count pauses for the Day Out of Time, and then a new year begins.`
      );
    } else {
      arc.push(
        `This is the last moon of the year. When it closes, the counted year ends; the Day Out of Time follows, and then a new year begins.`
      );
    }
    if (summary.countedYearLength === 366) {
      arc.push(
        `This window between year-anchors runs 366 days, so this year the pause outside the count is two days long — the Day Out of Time and the Deep Time Day, the calendar's leap arrangement.`
      );
    }

    /* ---- reading: the Codex's own layer, from the data record ---- */
    const reading = [];
    if (moonRecord.essence) {
      reading.push(`The Codex gives this moon the work of ${moonRecord.essence.charAt(0).toLowerCase()}${moonRecord.essence.slice(1)}.`);
    }
    if (moonRecord.element || moonRecord.freq) {
      const parts = [];
      if (moonRecord.element) parts.push(`its element is ${moonRecord.element}`);
      if (moonRecord.freq) parts.push(`its tone is ${moonRecord.freq}`);
      reading.push(`In the Codex's scheme, ${parts.join(", and ")}.`);
    }
    if (archetype && archetype[0]) {
      reading.push(
        `The Codex names each day of the moon. Day ${day} is ${archetype[0]}${archetype[1] ? ` — ${archetype[1]}` : ""}`
      );
    }
    if (gateEntry) {
      reading.push(
        `Week ${weekOfMoon} is the ${gateName(gateEntry)} week. The Codex calls each week a gate — a place where the moon's work turns${gateEntry[1] ? `: ${gateEntry[1]}` : "."}`
      );
    }
    if (moonRecord.practice) {
      reading.push(`The practice for this moon: ${moonRecord.practice}`);
    }

    return {
      version: VERSION,
      kind: "counted",
      coordinate: {
        patternYear: summary.patternYear,
        moon,
        moonName,
        day,
        patternDay,
        weekOfMoon,
        weekOfYear
      },
      headline: `Day ${day} of the ${moonName} moon`,
      position,
      arc,
      readingLabel: "The Codex's reading",
      reading
    };
  }

  function intercalaryTelling(summary, data) {
    const isDeepTime = Boolean(summary.isDeepTimeDay);
    const moons = Array.isArray(data?.moons) ? data.moons : [];
    const firstMoonName = moons[0]?.name || "Seed Flame";
    const civilLine = formatCivilKey(summary.civilDate, summary.civilWeekday);
    const nextAnchor = formatAnchorDate(summary.nextAnchorDate);
    const name = isDeepTime ? "Deep Time Day" : "Day Out of Time";

    const position = [
      `${civilLine} — this day stands outside the 364-day count. It belongs to no moon and carries no Pattern Day.`
    ];
    if (isDeepTime) {
      position.push(
        `It is the Deep Time Day — a second day outside the count. It appears because this window between year-anchors runs 366 days instead of 365: the calendar's leap arrangement, keeping the count true to the year.`
      );
    } else {
      position.push(
        `It is the Day Out of Time — the pause at the end of year ${summary.patternYear} of the count. The counted year closed yesterday, at Pattern Day 364.`
      );
    }

    const arc = [
      nextAnchor
        ? `The new counted year — year ${Number(summary.patternYear) + 1} — begins on ${nextAnchor}, opening with Moon 1, the ${firstMoonName} moon, at day 1.`
        : `When the new counted year opens, it begins with Moon 1, the ${firstMoonName} moon, at day 1.`
    ];

    const reading = [
      `The Codex calls it a threshold day beyond the 364-counted cycle — a day for standing between the year that closed and the year that opens.`
    ];

    return {
      version: VERSION,
      kind: isDeepTime ? "deep-time" : "day-out-of-time",
      coordinate: {
        patternYear: summary.patternYear,
        moon: null,
        moonName: name,
        day: null,
        patternDay: null,
        weekOfMoon: null,
        weekOfYear: null
      },
      headline: `The ${name}`,
      position,
      arc,
      readingLabel: "The Codex's reading",
      reading
    };
  }

  function tell(summary, data) {
    if (!summary || typeof summary !== "object") return null;
    const record = data || globalThis.PatternCalendarData;
    if (!record) return null;
    return summary.insideCountedYear
      ? countedTelling(summary, record)
      : intercalaryTelling(summary, record);
  }

  function tellForDate(date, options = {}, calendar, data) {
    const engine = calendar || globalThis.PatternCalendar;
    if (!engine || typeof engine.fromCivilDate !== "function") return null;
    const summary = engine.fromCivilDate({
      date,
      timeZone: options.timeZone || "UTC",
      boundaryMode: options.boundaryMode || "midnight",
      sunsetTime: options.sunsetTime
    });
    return tell(summary, data);
  }

  globalThis.DayTelling = Object.freeze({
    tell,
    tellForDate,
    version: VERSION
  });
})();
