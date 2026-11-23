"use strict";

/*
 * Phase B — Living Sphere Day World adapter.
 *
 * Unit coverage for the adapter's pure logic (stage machine, bloom,
 * ring anchor, arc, world items, clutter cap), plus source guards:
 * the adapter presents only — it registers with the extension host,
 * reads through the day-zoom day view and the one planner, writes
 * through the planner only, and lives outside the protected set.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const adapter = require(path.join(root, "docs/assets/js/sphere-day-world-adapter.js"));
const source = fs.readFileSync(path.join(root, "docs/assets/js/sphere-day-world-adapter.js"), "utf8");

function entry(overrides = {}) {
  return {
    id: "rec-1",
    title: "Thing",
    type: "task",
    practice: false,
    summary: "",
    allDay: true,
    start: null,
    end: null,
    timeLabel: "All day",
    status: "planned",
    completed: false,
    ...overrides,
  };
}

function recordsById(records) {
  return new Map(records.map((record) => [record.id, record]));
}

function schedulingFor(schedules = {}) {
  return {
    getSchedule(record) {
      return schedules[record.id] || { priority: "normal" };
    },
  };
}

test("stage machine follows the semantic bands", () => {
  assert.equal(adapter.stageForDistance(3.6, "living"), "year");
  assert.equal(adapter.stageForDistance(3.25, "moon"), "year");
  assert.equal(adapter.stageForDistance(2.8, "year"), "moon");
  assert.equal(adapter.stageForDistance(2.0, "moon"), "approach");
  assert.equal(adapter.stageForDistance(1.62, "approach"), "approach");
  assert.equal(adapter.stageForDistance(1.5, "approach"), "living");
  assert.equal(adapter.stageForDistance(1.2, "approach"), "immersive");
});

test("stage machine holds the Living/Immersive split with hysteresis", () => {
  assert.equal(adapter.stageForDistance(1.38, "living"), "living");
  assert.equal(adapter.stageForDistance(1.32, "immersive"), "immersive");
  assert.equal(adapter.stageForDistance(1.29, "living"), "immersive");
  assert.equal(adapter.stageForDistance(1.41, "immersive"), "living");
});

test("bloom is zero at Moon distance, grows through Approach, full in the Living band", () => {
  assert.equal(adapter.bloomForDistance(3.4), 0);
  assert.equal(adapter.bloomForDistance(2.35), 0);
  const approach = adapter.bloomForDistance(2.0);
  assert.ok(approach > 0.12 && approach < 0.45, `approach bloom ${approach}`);
  assert.equal(adapter.bloomForDistance(1.62), 0.45);
  assert.equal(adapter.bloomForDistance(1.05), 1);
  assert.equal(adapter.bloomForDistance(0.8), 1);
  // Monotonic as the keeper comes closer.
  let previous = -1;
  for (let d = 2.35; d >= 0.7; d -= 0.05) {
    const bloom = adapter.bloomForDistance(d);
    assert.ok(bloom >= previous, `bloom monotonic at ${d}`);
    previous = bloom;
  }
});

test("anchor reads the day's true ring position from its cell", () => {
  const atZero = adapter.anchorForCell({ angle: 0, radialFactor: 1.298 }, 0.70);
  assert.ok(Math.abs(atZero.position.x) < 1e-9);
  assert.ok(Math.abs(atZero.position.z + 0.7 * 1.298) < 1e-9);
  const atNinety = adapter.anchorForCell({ angle: 90, radialFactor: 1.298 }, 0.70);
  assert.ok(Math.abs(atNinety.position.x - 0.7 * 1.298) < 1e-9);
  assert.ok(Math.abs(atNinety.position.z) < 1e-9);
  assert.equal(adapter.anchorForCell(null), null);
  assert.equal(adapter.anchorForCell({}), null);
});

test("the day-clock arc runs left foot, crown, right foot", () => {
  const start = adapter.arcPoint(0);
  const noon = adapter.arcPoint(12);
  const end = adapter.arcPoint(24);
  assert.ok(Math.abs(start.x + 0.78) < 1e-9 && Math.abs(start.y - 0.06) < 1e-9);
  assert.ok(Math.abs(noon.x) < 1e-9 && Math.abs(noon.y - 0.84) < 1e-9);
  assert.ok(Math.abs(end.x - 0.78) < 1e-9 && Math.abs(end.y - 0.06) < 1e-9);
  assert.equal(start.z, -0.18);
});

test("civil dates shift across months, years, and leap day", () => {
  assert.equal(adapter.shiftCivilDate("2026-11-22", 1), "2026-11-23");
  assert.equal(adapter.shiftCivilDate("2026-11-30", 1), "2026-12-01");
  assert.equal(adapter.shiftCivilDate("2026-12-31", 1), "2027-01-01");
  assert.equal(adapter.shiftCivilDate("2028-02-28", 1), "2028-02-29");
  assert.equal(adapter.shiftCivilDate("not-a-date", 1), null);
});

test("planner categories fold into the Phase A object vocabulary", () => {
  assert.equal(adapter.kindForCategory("task"), "work");
  assert.equal(adapter.kindForCategory("family"), "family");
  assert.equal(adapter.kindForCategory("planting"), "farm");
  assert.equal(adapter.kindForCategory("watering"), "farm");
  assert.equal(adapter.kindForCategory("travel"), "travel");
  assert.equal(adapter.kindForCategory("research"), "study");
  assert.equal(adapter.kindForCategory("creative"), "creative");
  assert.equal(adapter.kindForCategory("writing"), "notes");
  assert.equal(adapter.kindForCategory("reminder"), "reminder");
  assert.equal(adapter.kindForCategory("event"), "marker");
  assert.equal(adapter.kindForCategory("something-new"), "marker");
});

test("world items come from the day view's entries — timed, untimed, standing", () => {
  const records = [
    { id: "a", subtype: "task", temporal: { civilDate: "2026-11-22" } },
    { id: "b", subtype: "family", temporal: { civilDate: "2026-11-22" } },
    { id: "c", subtype: "planting", temporal: { civilDate: "2026-11-22" } },
  ];
  const entries = [
    entry({ id: "b", title: "Supper with family", type: "family" }),
    entry({
      id: "a", title: "Fix the gate", type: "task",
      allDay: false, start: "2026-11-22T09:30:00", end: "2026-11-22T10:30:00",
      timeLabel: "9:30 AM",
    }),
    entry({ id: "c", title: "Plant garlic", type: "planting", completed: true }),
    entry({ id: "p", title: "A practice session", practice: true }),
  ];
  const scheduling = schedulingFor({ a: { priority: "critical" } });
  const items = adapter.buildWorldItems(entries, recordsById(records), scheduling, {
    patternDay: 220, dayRelation: 0, nowHour: 8,
  });
  // Practice records are not the planner's — never in the slice.
  assert.equal(items.length, 3);
  // Timed first, by hour.
  assert.equal(items[0].id, "a");
  assert.equal(items[0].timed, true);
  assert.equal(items[0].hour, 9.5);
  assert.equal(items[0].kind, "work");
  assert.equal(items[0].important, true, "critical priority takes the ivory edge");
  assert.equal(items[0].civilDate, "2026-11-22");
  const family = items.find((item) => item.id === "b");
  assert.equal(family.timed, false);
  assert.equal(family.kind, "family");
  const garlic = items.find((item) => item.id === "c");
  assert.equal(garlic.completed, true);
  assert.equal(garlic.overdue, false, "completed work is never overdue");
});

test("overdue is derived honestly: past days, and today's passed hours", () => {
  const records = [{ id: "a", subtype: "task", temporal: { civilDate: "2026-11-20" } }];
  const entries = [entry({
    id: "a", allDay: false,
    start: "2026-11-20T09:00:00", end: "2026-11-20T10:00:00", timeLabel: "9:00 AM",
  })];
  const past = adapter.buildWorldItems(entries, recordsById(records), schedulingFor(), {
    patternDay: 218, dayRelation: -1, nowHour: 12,
  });
  assert.equal(past[0].overdue, true, "a standing record on a past day is overdue");
  const laterToday = adapter.buildWorldItems(entries, recordsById(records), schedulingFor(), {
    patternDay: 220, dayRelation: 0, nowHour: 8,
  });
  assert.equal(laterToday[0].overdue, false, "before its hour, today's record stands");
  const passedToday = adapter.buildWorldItems(entries, recordsById(records), schedulingFor(), {
    patternDay: 220, dayRelation: 0, nowHour: 11,
  });
  assert.equal(passedToday[0].overdue, true, "past its end hour, today's record is overdue");
  const future = adapter.buildWorldItems(entries, recordsById(records), schedulingFor(), {
    patternDay: 221, dayRelation: 1, nowHour: 12,
  });
  assert.equal(future[0].overdue, false);
});

test("an empty day builds no items — the world stays honestly empty", () => {
  const items = adapter.buildWorldItems([], recordsById([]), schedulingFor(), {
    patternDay: 220, dayRelation: 0, nowHour: 9,
  });
  assert.deepEqual(items, []);
  const grouped = adapter.groupItems(items);
  assert.deepEqual(grouped, { singles: [], timedCluster: [], untimedCluster: [] });
});

test("the clutter cap gathers overflow into timed and untimed clusters", () => {
  const items = [];
  for (let i = 0; i < 18; i += 1) {
    items.push({
      id: `t${i}`, timed: i < 16, hour: i < 16 ? 6 + i * 0.5 : null, title: `T${i}`,
    });
  }
  const grouped = adapter.groupItems(items);
  assert.equal(grouped.singles.length, adapter.MAX_SINGLES);
  assert.equal(grouped.timedCluster.length, 2);
  assert.equal(grouped.untimedCluster.length, 2);
});

test("standing lines speak plainly per stage", () => {
  assert.match(adapter.standingLineFor("approach", { isOutsideCount: false }, 3), /3 things stand/);
  assert.match(adapter.standingLineFor("approach", { isOutsideCount: false }, 0), /Nothing stands/);
  assert.match(adapter.standingLineFor("immersive", { isOutsideCount: false }, 2), /year is behind you/);
  assert.match(adapter.standingLineFor("living", { isOutsideCount: true }, 0), /outside the count/);
});

test("the adapter lives outside the protected set and registers with the host", () => {
  const relative = path.relative(root, path.join(root, "docs/assets/js/sphere-day-world-adapter.js"));
  assert.equal(relative, path.join("docs", "assets", "js", "sphere-day-world-adapter.js"));
  assert.match(source, /LivingTimeSphereExtensionHost\.register\(extension\)/);
  assert.match(source, /LivingTimeSphereDayZoom/);
  assert.match(source, /buildDayView/);
});

test("writes go through the one planner — and nowhere else", () => {
  assert.match(source, /planner\.completePlan\(/);
  assert.match(source, /planner\.updatePlan\(/);
  assert.match(source, /planner\.removePlan\(/);
  assert.doesNotMatch(source, /indexedDB/);
  assert.doesNotMatch(source, /\.addRecord\(|\.updateRecord\(|\.deleteRecord\(/);
  assert.doesNotMatch(source, /localStorage\.setItem/);
});

test("gold is today's colour only in the adapter's palette use", () => {
  // The today gold appears exactly for: today's state light and the
  // now bead. Harvest keeps its own paler gold, never today's.
  assert.equal(adapter.COLOURS.todayGold, 0xe8b64c);
  assert.equal(adapter.COLOURS.harvestGold, 0xc9a227);
  const goldUses = source.match(/COLOURS\.todayGold/g) || [];
  assert.equal(goldUses.length, 4, "state light colour + emissive, now bead colour + emissive");
});

test("the companion layer loads the adapter in the farm loader's pattern", () => {
  const companion = fs.readFileSync(path.join(root, "docs/assets/js/sphere-companion-layer.js"), "utf8");
  assert.match(companion, /sphere-day-world-adapter\.js\?v=20261122-3/);
  assert.match(companion, /sphere-day-world-adapter\.css\?v=20261122-3/);
  assert.match(companion, /data-sphere-day-world/);
});

test("route decision: the cursor already there is a no-op", () => {
  const current = { patternYear: 2026, patternDay: 220, isOutsideCount: false };
  assert.deepEqual(adapter.routeDecision({ patternYear: 2026, patternDay: 220 }, current), { action: "none" });
  assert.deepEqual(adapter.routeDecision({ patternYear: null, patternDay: 220 }, current), { action: "none" });
});

test("route decision: a new day in the same year rides setPatternDay", () => {
  const current = { patternYear: 2026, patternDay: 220, isOutsideCount: false };
  assert.deepEqual(adapter.routeDecision({ patternYear: 2026, patternDay: 262 }, current),
    { action: "pattern-day", day: 262 });
  assert.deepEqual(adapter.routeDecision({ patternYear: null, patternDay: 262 }, current),
    { action: "pattern-day", day: 262 });
});

test("route decision: another year — or a cursor outside the count — goes by civil date", () => {
  const current = { patternYear: 2026, patternDay: 220, isOutsideCount: false };
  assert.deepEqual(adapter.routeDecision({ patternYear: 2027, patternDay: 40 }, current),
    { action: "civil-date", year: 2027, day: 40 });
  const outside = { patternYear: 2026, patternDay: null, isOutsideCount: true };
  assert.deepEqual(adapter.routeDecision({ patternYear: 2026, patternDay: 15 }, outside),
    { action: "civil-date", year: 2026, day: 15 });
  assert.deepEqual(adapter.routeDecision({ patternYear: 2026, patternDay: 15 }, null),
    { action: "civil-date", year: 2026, day: 15 });
});

test("route decision: invalid targets never move the cursor", () => {
  const current = { patternYear: 2026, patternDay: 220, isOutsideCount: false };
  for (const bad of [0, 365, -1, 2.5, NaN, "x", null, undefined]) {
    assert.deepEqual(adapter.routeDecision({ patternYear: 2026, patternDay: bad }, current), { action: "none" });
  }
  assert.deepEqual(adapter.routeDecision(null, current), { action: "none" });
  // No year and no readable cursor: nothing safe to do.
  assert.deepEqual(adapter.routeDecision({ patternYear: null, patternDay: 100 }, null), { action: "none" });
});

test("civil date for a Pattern day: epoch plus day minus one, verified", () => {
  const epochForYear = (year) => new Date(Date.UTC(year, 3, 17, 12, 0, 0));
  // A decomposition in the calendar's own UTC terms.
  const remnantUtc = (date) => {
    const year = date.getUTCFullYear();
    const start = Date.UTC(year, 3, 17);
    const diff = Math.round((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start) / 86400000);
    if (diff >= 0 && diff < 364) return { patternYear: year, patternDay: diff + 1 };
    if (diff < 0) {
      const prevStart = Date.UTC(year - 1, 3, 17);
      const prevDiff = Math.round((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - prevStart) / 86400000);
      if (prevDiff >= 0 && prevDiff < 364) return { patternYear: year - 1, patternDay: prevDiff + 1 };
    }
    return { patternYear: year, patternDay: null };
  };
  const dayOne = adapter.civilDateForPatternDay(2026, 1, { epochForYear, remnantFromDate: remnantUtc });
  assert.equal(dayOne.toISOString(), "2026-04-17T12:00:00.000Z");
  const day262 = adapter.civilDateForPatternDay(2026, 262, { epochForYear, remnantFromDate: remnantUtc });
  assert.equal(day262.toISOString(), "2027-01-03T12:00:00.000Z");
});

test("civil date verification corrects a timezone-shifted landing, then verifies", () => {
  const epochForYear = (year) => new Date(Date.UTC(year, 3, 17, 12, 0, 0));
  // A decomposition reading the LOCAL civil date at UTC+13: the
  // UTC-noon epoch lands on the next local day, one Pattern day
  // late — the bridge must step back one day and verify again.
  const remnantPlus13 = (date) => {
    const local = new Date(date.getTime() + 13 * 3600000);
    const y = local.getUTCFullYear();
    const m = local.getUTCMonth();
    const d = local.getUTCDate();
    const start = Date.UTC(y, 3, 17);
    const diff = Math.round((Date.UTC(y, m, d) - start) / 86400000);
    if (diff >= 0 && diff < 364) return { patternYear: y, patternDay: diff + 1 };
    const prevStart = Date.UTC(y - 1, 3, 17);
    const prevDiff = Math.round((Date.UTC(y, m, d) - prevStart) / 86400000);
    if (prevDiff >= 0 && prevDiff < 364) return { patternYear: y - 1, patternDay: prevDiff + 1 };
    return { patternYear: y, patternDay: null };
  };
  const corrected = adapter.civilDateForPatternDay(2026, 1, { epochForYear, remnantFromDate: remnantPlus13 });
  assert.equal(corrected.toISOString(), "2026-04-16T12:00:00.000Z");
  assert.equal(remnantPlus13(corrected).patternDay, 1);
});

test("civil date verification fails closed outside the target window", () => {
  const epochForYear = (year) => new Date(Date.UTC(year, 3, 17, 12, 0, 0));
  const foreign = () => ({ patternYear: 1999, patternDay: 100 });
  assert.equal(adapter.civilDateForPatternDay(2026, 100, { epochForYear, remnantFromDate: foreign }), null);
  const outside = () => ({ patternYear: 2026, patternDay: null });
  assert.equal(adapter.civilDateForPatternDay(2026, 100, { epochForYear, remnantFromDate: outside }), null);
  assert.equal(adapter.civilDateForPatternDay(2026, 100, {}), null);
});

test("the selection bridge routes announcements into the cursor — and only the cursor", () => {
  assert.match(source, /livingtime:selectionchange/);
  assert.match(source, /routeAnnouncedSelection/);
  assert.match(source, /cursor\.setPatternDay/);
  assert.match(source, /cursor\.setDate/);
  assert.match(source, /temporal-playback/);
  // The chip's words still come from the cursor-fed state alone.
  assert.match(source, /dom\.chipTitle\.textContent = dayTitle\(state\.view, state\.selection\)/);
});
