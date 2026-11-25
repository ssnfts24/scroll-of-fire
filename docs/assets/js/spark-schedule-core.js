/**
 * spark-schedule-core.js — the Spark's scheduling competence, pure.
 *
 * Written Nov 24, 2026, under Aaron's rulings of the same day: the
 * Spark schedules by word and by voice, proposes before it writes,
 * generates schedules from the keeper's own record under the
 * generative clause, reads one timeline with the keeper, and drives
 * the Sphere by word through its public controls. Design:
 * spark-scheduling-design-2026-11-24.md; research:
 * sphere-markers-research-2026-11-24.md.
 *
 * This module is PURE: no DOM, no storage, no clock of its own.
 * Callers pass the record (planner lines) and today's coordinate,
 * both read the one canonical way by the panels. Everything here is
 * a function of its inputs, so the tests can pin the discipline:
 * proposal-before-write, the generative clause, the density cap,
 * the timeline's states.
 *
 * Dates are PatternCalendar's, asked at call time: the epoch rule
 * lives in the temporal authority alone (docs/assets/js/calendar/),
 * and this core only maps its answers into the scheduling stamp.
 * Until Nov 25, 2026 the core carried a private copy of the rule;
 * the copy was removed (ULS register D-01) once pins proved the two
 * agreed on every day — the proof stands in
 * tests/spark-schedule-authority-equivalence.test.js.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.SparkScheduleCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const VERSION = "spark-schedule-core/1.0.0";
  const DAY_MS = 86400000;
  const MARKER_CAP = 24; // the Day World density budget (charter)

  /* ── Civil date arithmetic (UTC, string-typed) ─────────────── */

  function parseIso(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
    if (!m) return null;
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  function toIso(ms) { return new Date(ms).toISOString().slice(0, 10); }
  function addDays(iso, n) {
    const ms = parseIso(iso);
    return ms == null ? null : toIso(ms + n * DAY_MS);
  }
  function diffDays(fromIso, toIsoDate) {
    const a = parseIso(fromIso), b = parseIso(toIsoDate);
    return a == null || b == null ? null : Math.round((b - a) / DAY_MS);
  }
  const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function weekdayOf(iso) {
    const ms = parseIso(iso);
    return ms == null ? null : new Date(ms).getUTCDay();
  }
  function civilWords(iso) {
    const ms = parseIso(iso);
    if (ms == null) return String(iso || "");
    const d = new Date(ms);
    return `${WEEKDAY_NAMES[d.getUTCDay()]}, ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}`;
  }

  /* ── Civil ⇄ Pattern, by the authority ─────────────────────── */

  // The one calendar authority, resolved at call time. On the
  // Sphere page the calendar stack loads before this core and the
  // global is simply there. Under Node the core loads the stack
  // itself, in the page's script order — the files only ever set
  // their globals, exactly as they do in the browser.
  let resolvedAuthority = null;
  function authority() {
    if (resolvedAuthority) return resolvedAuthority;
    const pc = (root && root.PatternCalendar) || globalThis.PatternCalendar;
    if (pc) { resolvedAuthority = pc; return pc; }
    if (typeof require === "function") {
      try {
        require("./calendar/pattern-calendar-version.js");
        require("./calendar/pattern-calendar-data.js");
        require("./calendar/pattern-calendar-format.js");
        require("./calendar/pattern-calendar-boundary.js");
        require("./calendar/pattern-calendar.js");
      } catch (_) { /* the authority stays absent; conversions answer null */ }
      resolvedAuthority = globalThis.PatternCalendar || null;
      return resolvedAuthority;
    }
    return null;
  }

  function civilDateForPatternDay(anchorYear, patternDay) {
    const y = Number(anchorYear), pd = Number(patternDay);
    if (!Number.isFinite(y) || !Number.isFinite(pd) || pd < 1 || pd > 366) return null;
    const pc = authority();
    if (!pc) return null;
    return toIso(pc.epochForYear(y).getTime() + (pd - 1) * DAY_MS);
  }
  // The full stamp for a civil date, from the authority's own
  // conversion (midnight boundary, UTC — the core's dates are pure
  // calendar days), mapped into the scheduling stamp shape. The
  // stamp's patternYear is the anchor's civil year, as the panels
  // and the record have always carried it.
  function stampForCivil(iso) {
    const ms = parseIso(iso);
    if (ms == null) return null;
    const pc = authority();
    if (!pc) return null;
    const s = pc.fromCivilDate({ date: new Date(ms), timeZone: "UTC", boundaryMode: "midnight" });
    if (!s || !s.anchorDate) return null;
    const anchorYear = s.anchorDate.getUTCFullYear();
    const outside = !s.insideCountedYear;
    const pd = outside ? pc.constants.countedDaysPerYear + s.intercalaryIndex : s.dayOfPatternYear;
    if (pd < 1 || pd > 366) return null;
    return {
      civilDate: iso,
      anchorYear,
      patternYear: anchorYear,
      patternDay: pd,
      moon: outside ? null : s.moon,
      day: outside ? null : s.day,
      outsideDay: outside,
    };
  }
  function anchorYearForCivil(civilDate) {
    const stamp = stampForCivil(civilDate);
    return stamp ? stamp.anchorYear : null;
  }
  function dayWords(stamp) {
    if (!stamp) return "that day";
    if (stamp.outsideDay) return "the Day Out of Time";
    return `Moon ${stamp.moon} · Day ${stamp.day}`;
  }
  // "Thursday, November 27 · Moon 9 · Day 1" — the restated day,
  // named in both calendars so a misreading is one glance away.
  function restateDay(stamp) {
    if (!stamp) return "that day";
    return `${civilWords(stamp.civilDate)} · ${dayWords(stamp)}`;
  }

  /* ── Day phrases ────────────────────────────────────────────── */

  // ctx: { todayCivil, todayPatternDay, todayAnchorYear }
  // Returns { stamp, phrase } | { invalid, phrase } | null.
  function parseDayPhrase(text, ctx) {
    const t = String(text || "");
    const today = ctx && ctx.todayCivil;
    if (!today) return null;
    const hit = (stamp, phrase) => (stamp ? { stamp, phrase } : null);

    let m = /\bpattern\s+day\s+(\d{1,3})\b/i.exec(t) || /\bpd\s*(\d{1,3})\b/i.exec(t);
    if (m) {
      const pd = Number(m[1]);
      if (pd < 1 || pd > 366) return { invalid: "That day is outside the pattern year — the count runs from Pattern Day 1 to the Day Out of Time.", phrase: m[0] };
      return hit(nextStanding(ctx, pd), m[0]);
    }
    m = /\bmoon\s+(\d{1,2})\s*(?:,|·|and)?\s*day\s+(\d{1,2})\b/i.exec(t)
      || /\bday\s+(\d{1,2})\s+of\s+moon\s+(\d{1,2})\b/i.exec(t);
    if (m) {
      const moonFirst = /^moon/i.test(m[0]);
      const moon = Number(moonFirst ? m[1] : m[2]);
      const day = Number(moonFirst ? m[2] : m[1]);
      if (moon < 1 || moon > 13 || day < 1 || day > 28) {
        return { invalid: "That Moon and day are outside the thirteen Moons of twenty-eight days.", phrase: m[0] };
      }
      return hit(nextStanding(ctx, (moon - 1) * 28 + day), m[0]);
    }
    if (/\bday out of time\b/i.test(t)) {
      const phrase = /\bday out of time\b/i.exec(t)[0];
      return hit(nextStanding(ctx, 365), phrase);
    }
    m = /\bday after tomorrow\b/i.exec(t);
    if (m) return hit(stampForCivil(addDays(today, 2)), m[0]);
    // Quick phrases (the ease pass, Nov 24, 2026): a part of day
    // riding on its day word resolves with the day, and its whole
    // phrase lifts out of the title — "tomorrow morning",
    // "this evening", "tonight", "next week".
    m = /\btomorrow\s+(?:morning|afternoon|evening)\b/i.exec(t);
    if (m) return hit(stampForCivil(addDays(today, 1)), m[0]);
    m = /\bthis\s+(?:morning|afternoon|evening)\b/i.exec(t);
    if (m) return hit(stampForCivil(today), m[0]);
    m = /\btonight\b/i.exec(t);
    if (m) return hit(stampForCivil(today), m[0]);
    m = /\btomorrow\b/i.exec(t);
    if (m) return hit(stampForCivil(addDays(today, 1)), m[0]);
    m = /\btoday\b/i.exec(t);
    if (m) return hit(stampForCivil(today), m[0]);
    m = /\bin\s+(\d{1,3})\s+days?\b/i.exec(t);
    if (m) return hit(stampForCivil(addDays(today, Number(m[1]))), m[0]);
    m = /\bnext week\b/i.exec(t);
    if (m) return hit(stampForCivil(addDays(today, 7)), m[0]);
    m = /\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.exec(t);
    if (m) {
      const target = WEEKDAY_NAMES.findIndex((w) => w.toLowerCase() === m[2].toLowerCase());
      let delta = (target - weekdayOf(today) + 7) % 7;
      if (m[1]) delta += 7; // "next Thursday" = the standing after the coming one
      return hit(stampForCivil(addDays(today, delta)), m[0]);
    }
    m = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(t);
    if (m) return hit(stampForCivil(m[0]), m[0]);
    m = new RegExp(`\\b(${MONTH_NAMES.join("|")}|${MONTH_ABBR.join("|")}|Sept)\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, "i").exec(t);
    if (m) {
      const named = m[1].toLowerCase();
      let monthIdx = MONTH_NAMES.findIndex((n) => n.toLowerCase() === named);
      if (monthIdx < 0) monthIdx = MONTH_ABBR.findIndex((n) => n.toLowerCase() === named);
      if (monthIdx < 0 && named === "sept") monthIdx = 8;
      let year = m[3] ? Number(m[3]) : Number(today.slice(0, 4));
      let iso = toIso(Date.UTC(year, monthIdx, Number(m[2])));
      if (!m[3] && iso < today) iso = toIso(Date.UTC(year + 1, monthIdx, Number(m[2])));
      return hit(stampForCivil(iso), m[0]);
    }
    m = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(t);
    if (m) {
      let year = m[3] ? Number(m[3]) : Number(today.slice(0, 4));
      if (year < 100) year += 2000;
      let iso = toIso(Date.UTC(year, Number(m[1]) - 1, Number(m[2])));
      if (!m[3] && iso < today) iso = toIso(Date.UTC(year + 1, Number(m[1]) - 1, Number(m[2])));
      return hit(stampForCivil(iso), m[0]);
    }
    return null;
  }
  // A Pattern day's next standing: this anchor year's, unless it
  // has already passed, in which case next year's (the v1 rule).
  function nextStanding(ctx, patternDay) {
    let anchor = Number(ctx.todayAnchorYear);
    let civil = civilDateForPatternDay(anchor, patternDay);
    if (civil && ctx.todayCivil && civil < ctx.todayCivil) {
      anchor += 1;
      civil = civilDateForPatternDay(anchor, patternDay);
    }
    return stampForCivil(civil);
  }

  /* ── Time phrases ───────────────────────────────────────────── */

  // { time: "HH:MM", phrase } | { partOfDay, phrase } | null.
  // A part of day is carried as a note, never silently converted
  // to a clock time (the design's honesty rule).
  function parseTimePhrase(text) {
    const t = String(text || "");
    let m = /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i.exec(t);
    if (m) {
      let h = Number(m[1]) % 12;
      if (/pm/i.test(m[3])) h += 12;
      return { time: `${String(h).padStart(2, "0")}:${m[2] || "00"}`, phrase: m[0] };
    }
    m = /\bat\s+(\d{1,2}):(\d{2})\b/.exec(t);
    if (m) return { time: `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`, phrase: m[0] };
    m = /\bat\s+noon\b/i.exec(t);
    if (m) return { time: "12:00", phrase: m[0] };
    m = /\bat\s+midnight\b/i.exec(t);
    if (m) return { time: "00:00", phrase: m[0] };
    m = /\bin\s+the\s+(morning|afternoon|evening)\b/i.exec(t);
    if (m) return { partOfDay: m[1].toLowerCase(), phrase: m[0] };
    m = /\btonight\b/i.exec(t);
    if (m) return { partOfDay: "evening", phrase: m[0] };
    // A bare part of day counts only at the very end of the
    // words — "…on Friday morning" — so a title that merely
    // holds the word ("Morning pages") is never eaten.
    m = /\b(morning|afternoon|evening)\s*$/i.exec(t);
    if (m) return { partOfDay: m[1].toLowerCase(), phrase: m[1] };
    return null;
  }
  function timeWords(time) {
    const m = /^(\d{2}):(\d{2})$/.exec(String(time || ""));
    if (!m) return "";
    let h = Number(m[1]);
    const suffix = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${m[2]} ${suffix}`;
  }

  /* ── The request parser ─────────────────────────────────────── */

  const KIND_WORDS = {
    task: "task", reminder: "reminder", event: "event", practice: "practice",
    project: "project", meeting: "meeting", milestone: "milestone",
    travel: "travel", note: "observation", quest: "task",
  };
  const KEYWORDS = ["deep work", "garden", "family", "quiet", "rest"];

  function cleanTitle(raw, lifts) {
    let title = String(raw || "");
    for (const phrase of lifts || []) {
      if (phrase) title = title.replace(phrase, " ");
    }
    title = title
      .replace(/\s+(on|at|for)\s*$/i, "")
      .replace(/^\s*(a|an|the)\s+/i, "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[.\s]+$/, "");
    // The keeper's words stand as spoken, with the first letter
    // lifted so the proposal reads as a title, not a fragment.
    return title.replace(/^([a-z])/, (c) => c.toUpperCase());
  }
  function kindFromTitle(title) {
    const hit = new RegExp(`^(${Object.keys(KIND_WORDS).join("|")})\\s*[:\\-]\\s*(.+)$`, "i").exec(title);
    if (!hit) return { category: "task", title };
    return { category: KIND_WORDS[hit[1].toLowerCase()], title: hit[2].trim() };
  }

  /**
   * Parse one keeper utterance into a scheduling intent.
   * ctx: { todayCivil, todayPatternDay, todayAnchorYear }.
   * Returns an intent object or null (ordinary talk is not an
   * intent — it falls through to the mind and the door, as before).
   */
  function parseScheduleRequest(text, ctx) {
    const raw = String(text || "").trim().replace(/^please\s+/i, "");
    if (!raw || !ctx || !ctx.todayCivil) return null;
    const lower = raw.toLowerCase();

    // Generative: "make me a schedule", "plan my day", "a quiet day".
    if (/\b(make|build|create|give|plan)\b[^.]*\b(schedule|day|week)\b/i.test(raw)
      || /\brandom\s+schedule\b/i.test(raw)
      || /\bschedule\s+my\s+(day|week)\b/i.test(raw)) {
      const keyword = KEYWORDS.find((k) => lower.includes(k)) || null;
      const dayHit = parseDayPhrase(raw, ctx);
      if (dayHit && dayHit.invalid) return { kind: "invalid", message: dayHit.invalid };
      return {
        kind: "generate",
        mode: keyword ? "keyword" : "random",
        keyword,
        stamp: dayHit ? dayHit.stamp : stampForCivil(addDays(ctx.todayCivil, 1)),
      };
    }

    // Asking: "what's on Thursday", "what do I have tomorrow",
    // "what's next", "what's overdue".
    if (/^what'?s\s+(next|coming up)\b/i.test(raw)) return { kind: "ask", ask: "next" };
    if (/^what'?s\s+overdue\b/i.test(raw) || /^what\s+is\s+overdue\b/i.test(raw)) return { kind: "ask", ask: "overdue" };
    if (/^(what'?s|what\s+is|what\s+do\s+i\s+have|show\s+(me\s+)?my|list)\b/i.test(raw)
      && /\b(on|for|scheduled|this week)\b/i.test(raw) || /^what\s+do\s+i\s+have\b/i.test(raw)) {
      const dayHit = parseDayPhrase(raw, ctx);
      if (dayHit && dayHit.invalid) return { kind: "invalid", message: dayHit.invalid };
      if (dayHit) return { kind: "ask", ask: "day", stamp: dayHit.stamp };
      if (/\bthis week\b/i.test(raw)) return { kind: "ask", ask: "week" };
      if (/^(what\s+do\s+i\s+have)\b/i.test(raw)) return { kind: "ask", ask: "week" };
    }

    // Completion: "mark X done", "I finished X", "X is done".
    let m = /^(mark|set)\s+(.+?)\s+(as\s+)?done\.?$/i.exec(raw)
      || /^i\s+(did|finished|completed)\s+(.+?)\.?$/i.exec(raw)
      || /^(.+?)\s+is\s+done\.?$/i.exec(raw)
      || /^finished\s+(.+?)\.?$/i.exec(raw);
    if (m) {
      const title = (m[2] || m[1] || "").trim();
      if (title) return { kind: "complete", title };
    }

    // Moving: "move X to Friday".
    m = /^(move|shift|reschedule)\s+(.+?)\s+to\s+(.+)$/i.exec(raw);
    if (m) {
      const dayHit = parseDayPhrase(m[3], ctx);
      if (dayHit && dayHit.invalid) return { kind: "invalid", message: dayHit.invalid };
      if (dayHit) return { kind: "move", title: m[2].trim(), stamp: dayHit.stamp };
      return { kind: "invalid", message: "I could not read the day to move it to — name it as a Moon and day, a weekday, or a date." };
    }

    // Unschedule.
    m = /^(unschedule|cancel|remove|delete)\b[:,]?\s+(.+)$/i.exec(raw);
    if (m) {
      const dayHit = parseDayPhrase(m[2], ctx);
      if (dayHit && dayHit.invalid) return { kind: "invalid", message: dayHit.invalid };
      const title = cleanTitle(m[2], dayHit ? [dayHit.phrase] : []);
      if (!title) return null;
      return { kind: "unschedule", title, stamp: dayHit ? dayHit.stamp : null };
    }

    // Schedule.
    m = /^(schedule|plan|add|put|book|set)\b[:,]?\s+(.+)$/i.exec(raw)
      || /^remind\s+me\s+to\s+(.+)$/i.exec(raw);
    if (m) {
      const rest = m[2] || m[1];
      const dayHit = parseDayPhrase(rest, ctx);
      if (dayHit && dayHit.invalid) return { kind: "invalid", message: dayHit.invalid };
      const timeHit = parseTimePhrase(rest);
      let title = cleanTitle(rest, [dayHit && dayHit.phrase, timeHit && timeHit.phrase]);
      title = title.replace(/^to\s+/i, "");
      const kinded = kindFromTitle(title);
      if (!kinded.title) return null;
      if (!dayHit) return { kind: "schedule", needsDay: true, title: kinded.title, category: kinded.category };
      return {
        kind: "schedule",
        title: kinded.title,
        category: kinded.category,
        stamp: dayHit.stamp,
        time: timeHit && timeHit.time ? timeHit.time : null,
        partOfDay: timeHit && timeHit.partOfDay ? timeHit.partOfDay : null,
      };
    }
    return null;
  }

  /* ── The timeline — one computation, two projections ───────── */

  // A planner record, read the one way: title, its day, its time,
  // its schedule status. Records without a schedule still stand.
  function planLine(record) {
    const schedule = record && record.payload && record.payload.schedule
      ? record.payload.schedule : null;
    const temporal = (record && record.temporal) || {};
    const civilDate = temporal.civilDate
      || (schedule && (schedule.startDate || (schedule.start || "").slice(0, 10)))
      || null;
    if (!civilDate) return null;
    return {
      id: record.id || null,
      title: String(record.title || "Untitled"),
      category: record.subtype || "event",
      civilDate,
      time: schedule && !schedule.allDay && schedule.start
        ? String(schedule.start).slice(11, 16) : null,
      allDay: !schedule || schedule.allDay !== false,
      status: schedule ? String(schedule.status || "planned") : "planned",
      patternDay: temporal.patternDay != null ? Number(temporal.patternDay) : null,
      patternYear: temporal.patternYear != null ? Number(temporal.patternYear) : null,
      outsideDay: Boolean(temporal.outsideDay),
    };
  }
  function planState(line, todayCivil) {
    if (line.status === "completed") return "done";
    if (line.civilDate < todayCivil) return "overdue";
    if (line.civilDate === todayCivil) return "today";
    return "upcoming";
  }
  function buildTimeline(plans, todayCivil) {
    const entries = [];
    for (const record of plans || []) {
      const line = planLine(record);
      if (!line || line.status === "cancelled") continue;
      entries.push({ ...line, state: planState(line, todayCivil), stamp: stampForCivil(line.civilDate) });
    }
    entries.sort((a, b) => (a.civilDate < b.civilDate ? -1 : a.civilDate > b.civilDate ? 1
      : String(a.time || "") < String(b.time || "") ? -1 : String(a.time || "") > String(b.time || "") ? 1
      : a.title < b.title ? -1 : 1));
    return entries;
  }

  /* ── The marker model — beacons by Pattern day ─────────────── */

  const STATE_PRIORITY = { overdue: 0, today: 1, upcoming: 2, done: 3 };
  function markerModel(plans, facePatternYear, todayCivil, cap) {
    const limit = Math.max(1, Math.min(Number(cap) || MARKER_CAP, MARKER_CAP));
    const byDay = new Map();
    for (const entry of buildTimeline(plans, todayCivil)) {
      if (entry.patternYear !== Number(facePatternYear)) continue;
      if (entry.patternDay == null || entry.patternDay < 1 || entry.patternDay > 364) continue;
      const day = byDay.get(entry.patternDay) || {
        patternDay: entry.patternDay, count: 0, state: entry.state,
        leadCategory: entry.category, titles: [],
      };
      day.count += 1;
      day.titles.push(entry.title);
      if (STATE_PRIORITY[entry.state] < STATE_PRIORITY[day.state]) {
        day.state = entry.state;
        day.leadCategory = entry.category;
      }
      byDay.set(entry.patternDay, day);
    }
    const all = [...byDay.values()].sort((a, b) =>
      STATE_PRIORITY[a.state] - STATE_PRIORITY[b.state] || a.patternDay - b.patternDay);
    return { beacons: all.slice(0, limit), foldedDays: Math.max(0, all.length - limit), totalDays: all.length };
  }

  /* ── Generative scheduling — traceable, always ─────────────── */

  // The Codex's own practices, by keyword. Every item carries its
  // why — one plain teaching line, in the Spark's voice — because a
  // keeper who knows nothing is taught while the plan is proposed
  // (Aaron's cross-note, Nov 24, 2026, 16:38 PST).
  const KEYWORD_POOLS = {
    quiet: [
      { title: "Witness the sunrise", slot: "morning", why: "The day opens whether we watch or not; watching it once, on purpose, sets the day's key." },
      { title: "Read a page of the Scroll, slowly", slot: "midday", why: "One page read slowly teaches more than ten skimmed — the words are the programming." },
      { title: "Sit with the Spark in quiet company", slot: "afternoon", why: "Not every hour must produce something; a kept hour of stillness is a practice, not a gap." },
      { title: "Close the day early and gently", slot: "evening", why: "Closing the day while it is still light in you keeps tomorrow from starting in debt." },
    ],
    garden: [
      { title: "Walk the garden and witness what stands", slot: "morning", why: "Look before you touch: most garden mistakes are made by hands that arrived before eyes." },
      { title: "Water what the soil asks for", slot: "morning", why: "Check the soil with a finger first — dry an inch down means water; damp means wait." },
      { title: "Tend the beds: weed one bed fully", slot: "midday", why: "One bed finished beats five beds started; weeds pulled before they seed are next year's hours saved." },
      { title: "Check the Moon's planting window", slot: "afternoon", why: "The Moon's phase is the garden's oldest calendar — sow leaf and fruit by its light, rest the soil at its dark." },
      { title: "Harvest what stands ready", slot: "evening", why: "A harvest taken at its moment is food; left a week, it is compost that skipped the table." },
    ],
    "deep work": [
      { title: "One long making session, door closed", slot: "morning", why: "Deep work is mostly the first twenty unbroken minutes; after them, the work starts pulling you." },
      { title: "Write the thing that has been waiting", slot: "midday", why: "The unwritten page taxes every other hour; an ugly first draft costs nothing and frees all of them." },
      { title: "Study one word fully", slot: "afternoon", why: "A word taken down to its root — spelling, root, range, examples — stays learned for years, not days." },
      { title: "Review the day's work and witness it", slot: "evening", why: "Work unwitnessed fades; ten honest minutes of review is what turns effort into a record." },
    ],
    family: [
      { title: "A meal together, phones elsewhere", slot: "evening", why: "The table is the family's oldest instrument; it only plays when everyone is actually at it." },
      { title: "Watch a story episode together", slot: "evening", why: "A story shared is a road walked together — and the Spark keeps what the watching earns." },
      { title: "Walk together, no destination", slot: "afternoon", why: "Side-by-side talk comes easier than face-to-face; the road does half the work." },
      { title: "Close the day together", slot: "evening", why: "A day closed in company ends twice as well as a day that just stops." },
    ],
    rest: [
      { title: "Lie fallow for one hour", slot: "midday", why: "Fallow ground is not empty ground — it is ground being readied. The same law holds for keepers." },
      { title: "An hour with no screens", slot: "afternoon", why: "Attention is the field everything else grows in; one unharvested hour restores it." },
      { title: "An early night, lights low", slot: "evening", why: "Sleep is the one appointment every other appointment depends on." },
    ],
  };
  // The general pool, drawn by lot when randomness fills a gap.
  const ACTIVITY_POOL = [
    { title: "Tend the garden for a spell", slot: "morning", why: "The garden pays attention back at the rate it is given." },
    { title: "Take the pattern quest on today's day", slot: "midday", why: "A quest turns an ordinary day into a witnessed one — the day-line remembers it." },
    { title: "Make something small with your hands", slot: "afternoon", why: "A finished small thing teaches the hands what a planned large thing cannot." },
    { title: "Read in the Scroll of Fire", slot: "midday", why: "The Scroll grows by being read, the same way the record grows by being kept." },
    { title: "Walk and witness the place you live", slot: "afternoon", why: "A place walked slowly becomes a place known; a place known becomes a home." },
    { title: "Tidy one corner completely", slot: "morning", why: "One corner at peace argues with the chaos of every other corner — and wins, slowly." },
    { title: "Close the day with the Spark", slot: "evening", why: "A day closed on purpose is a day witnessed; witnessed days are the ones that compound." },
  ];
  const SLOT_TIMES = { morning: "08:00", midday: "12:00", afternoon: "15:00", evening: "19:00" };
  const SLOT_ORDER = ["morning", "midday", "afternoon", "evening"];

  // A small seeded RNG, so generation is reproducible in tests and
  // the randomness in a keeper's schedule is honest — declared,
  // seeded by the day, never dressed as knowledge.
  function rngFrom(seed) {
    let a = 2166136261;
    const s = String(seed || "spark");
    for (let i = 0; i < s.length; i += 1) { a ^= s.charCodeAt(i); a = Math.imul(a, 16777619); }
    return function next() {
      a = Math.imul(a ^ (a >>> 15), 2246822507);
      a = Math.imul(a ^ (a >>> 13), 3266489909);
      return ((a ^ (a >>> 16)) >>> 0) / 4294967296;
    };
  }
  function pickByLot(rng, pool, usedTitles) {
    const open = pool.filter((item) => !usedTitles.has(item.title));
    if (!open.length) return null;
    return open[Math.floor(rng() * open.length) % open.length];
  }

  /**
   * Compose a schedule. The generative clause: every item returns
   * its source — "record" (the keeper's own standing patterns),
   * "keyword" (the Codex's practices for the asked word), or "lot"
   * (declared randomness from the general pool). No item states a
   * fact about the keeper's life the record does not hold.
   *
   * facts: { titles: [..], planCount, practiceDays, usualDaypart,
   *          keywordKnown: bool }
   * opts:  { mode: "random"|"keyword", keyword, stamp, rng }
   */
  function generateSchedule(facts, opts) {
    const f = facts || {};
    const o = opts || {};
    const rng = typeof o.rng === "function" ? o.rng : rngFrom(o.stamp ? o.stamp.civilDate : "spark");
    const titles = Array.isArray(f.titles) ? f.titles.filter(Boolean) : [];
    const thinRecord = (Number(f.planCount) || 0) < 3 && (Number(f.practiceDays) || 0) < 3;
    const thinKnowledge = o.mode === "keyword" && o.keyword && f.keywordKnown === false;
    const starter = thinRecord || thinKnowledge;

    const items = [];
    const used = new Set();
    const usedSlots = new Set();
    const push = (poolItem, source, sourceLine) => {
      if (!poolItem || used.has(poolItem.title)) return;
      used.add(poolItem.title);
      // Two pieces may share a part of day, never a clock time:
      // the second settles an hour later in the same light.
      let time = SLOT_TIMES[poolItem.slot] || "12:00";
      if (usedSlots.has(poolItem.slot)) {
        const bumped = Number(time.slice(0, 2)) + 1;
        time = `${String(Math.min(bumped, 23)).padStart(2, "0")}:${time.slice(3)}`;
      }
      usedSlots.add(poolItem.slot);
      items.push({
        title: poolItem.title,
        slot: poolItem.slot,
        time,
        source,
        sourceLine,
        why: poolItem.why || "",
      });
    };

    // The keeper's own pattern first: one of their standing titles,
    // offered back at the daypart they usually keep.
    if (titles.length) {
      const title = titles[Math.floor(rng() * titles.length) % titles.length];
      const slot = SLOT_ORDER.includes(f.usualDaypart) ? f.usualDaypart
        : f.usualDaypart === "dawn" ? "morning" : f.usualDaypart === "dusk" ? "evening" : "morning";
      push({ title, slot, why: "It stands in your record already — your own pattern, offered back to you." },
        "record", "from your record");
    }
    // The keyword's practices.
    if (o.mode === "keyword" && o.keyword && KEYWORD_POOLS[o.keyword]) {
      const pool = KEYWORD_POOLS[o.keyword].slice();
      while (pool.length && items.length < 3) {
        const item = pool.splice(Math.floor(rng() * pool.length) % pool.length, 1)[0];
        if (!usedSlots.has(item.slot) || items.length < 2) push(item, "keyword", `from the ${o.keyword} practices`);
      }
    }
    // Honest randomness fills the remaining slots.
    while (items.length < 4) {
      const item = pickByLot(rng, ACTIVITY_POOL, used);
      if (!item) break;
      push(item, "lot", "by lot — honest randomness, declared");
    }
    items.sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));
    return { items, starter, mode: o.mode || "random", keyword: o.keyword || null, stamp: o.stamp || null };
  }

  /* ── View commands — the Spark's hands on the Sphere ───────── */

  const LAYER_WORDS = {
    sky: "sky", farm: "farm", story: "story", stories: "story",
    pattern: "pattern", passage: "passage", moon: "lunar", lunar: "lunar",
    sun: "solar", solar: "solar", planets: "planets", marks: "markers",
    markers: "markers", "schedule marks": "markers", recurrence: "recurrence",
    spiral: "spiral", environment: "environment", connections: "connections",
  };

  /**
   * Parse a pure VIEW command: it changes nothing stored, so it
   * executes at once on the keeper's word. Returns null when the
   * words are not a view command.
   */
  function parseShowCommand(text, ctx) {
    const raw = String(text || "").trim().replace(/^please\s+/i, "");
    if (!raw || !ctx || !ctx.todayCivil) return null;
    const lower = raw.toLowerCase();

    const layerMatch = /\bturn\s+(on|off)\s+(?:the\s+)?([a-z ]+?)(?:\s+layer)?\.?$/i.exec(raw)
      || /\b(show|hide)\s+(?:the\s+)?([a-z ]+?)\s+layer\.?$/i.exec(raw);
    if (layerMatch) {
      const on = layerMatch[1].toLowerCase() === "on" || layerMatch[1].toLowerCase() === "show";
      const slot = LAYER_WORDS[layerMatch[2].trim().toLowerCase()];
      if (slot) return { action: "layer", slot, on };
    }
    if (/^(freeze|hold still|be still)\b/i.test(raw)) return { action: "freeze" };
    if (/^(wake|move again|unfreeze)\b/i.test(raw)) return { action: "wake" };
    if (/\bday-?line\b/i.test(raw) || /\bsame day (last|next) year\b/i.test(raw)) {
      const back = /\bback\b|\blast\b/i.test(raw);
      const numMatch = /\b(\d{1,2})\s+years?\b/i.exec(raw);
      const years = (numMatch ? Number(numMatch[1]) : 1) * (back ? -1 : 1);
      return { action: "dayLine", years };
    }
    if (!/^(show|take|bring|go|open|jump)\b/i.test(raw)) return null;
    if (/\bnext\s+(scheduled|marked)\b/i.test(raw)) return { action: "nextScheduled" };
    if (/\boverdue\b/i.test(raw)) return { action: "overdueFirst" };
    if (/\bwhole year\b|\byear view\b|\bthe year\b/i.test(raw)) return { action: "year" };
    if (/\bfarm\b/i.test(raw)) return { action: "openFarm" };
    if (/\bdeep time\b/i.test(raw)) return { action: "openDeepTime" };
    if (/\btoday\b/i.test(raw) && !/\bschedule\b/i.test(raw)) return { action: "today" };
    const moonMatch = /\bmoon\s+(\d{1,2})\b/i.exec(raw);
    if (moonMatch && !/\bday\s+\d/i.test(raw)) {
      const moon = Number(moonMatch[1]);
      if (moon >= 1 && moon <= 13) return { action: "moon", moon };
      return { action: "invalid", message: "The year holds thirteen Moons — name one of those and I will take you there." };
    }
    const dayHit = parseDayPhrase(raw, ctx);
    if (dayHit && dayHit.invalid) return { action: "invalid", message: dayHit.invalid };
    if (dayHit) {
      if (/\bopen\b/i.test(raw) && /\bday\b/i.test(raw) && !moonMatch) {
        return { action: "day", stamp: dayHit.stamp, open: true };
      }
      return { action: "day", stamp: dayHit.stamp };
    }
    if (/^open\b/i.test(raw) && /\bday\b/i.test(raw)) return { action: "openDay" };
    return null;
  }

  return {
    VERSION, MARKER_CAP, SLOT_TIMES,
    addDays, diffDays, weekdayOf, civilWords,
    civilDateForPatternDay, anchorYearForCivil, stampForCivil,
    dayWords, restateDay, parseDayPhrase, parseTimePhrase, timeWords,
    parseScheduleRequest, planLine, planState, buildTimeline,
    markerModel, STATE_PRIORITY,
    KEYWORD_POOLS, ACTIVITY_POOL, rngFrom, generateSchedule,
    parseShowCommand, LAYER_WORDS,
  };
});
