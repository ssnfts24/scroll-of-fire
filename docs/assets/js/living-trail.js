/**
 * The Living Trail — the keeper's Pattern-stamped trail, on-device.
 *
 * Aaron's Year Thread (Nov 20, 2026): today's place in the year,
 * and the keeper's own trail through it — the days they actually
 * stood on, stamped by the one canonical clock (PatternCalendar),
 * kept on their own device. Three travellers read and write it:
 *
 *   - the Story layer: a chapter found is a find on the trail,
 *     stamped with the day it was found;
 *   - the Traveller's Map: it shows which chapters a keeper has
 *     found, and when;
 *   - the Year Thread strip: it draws the year as a thread of 364
 *     days, today marked, the keeper's stood-on days as knots.
 *
 * The Sphere's face reads the same trail through its own record
 * pass (the trail lights on the rail are the planner's kept days
 * and the Spark's stamped games; the story's finds join them by
 * the same pattern-day numbers).
 *
 * The store is deliberately small and separate from the Life
 * Atlas: the Atlas is the keeper's life record (keepsakes,
 * passes, witnessed days); the trail is a reading-and-walking
 * record — where you have been in the work, and when. It lives
 * in one localStorage key, is never sent anywhere, and every
 * stamp in it is a Pattern coordinate read from PatternCalendar,
 * never hand-computed.
 *
 * The pure functions (emptyTrail, recordFindIn, recordDayIn,
 * daysForYear, stampFor) carry no storage dependency and are
 * unit-tested in tests/story-layer.test.js.
 */
(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.LivingTrail = api;
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function () {
    "use strict";

    const VERSION = "living-trail/1.0.0";
    const STORAGE_KEY = "sof.living-trail.v1";

    function emptyTrail() {
      return { version: 1, finds: {}, days: {} };
    }

    function clone(trail) {
      return {
        version: 1,
        finds: { ...((trail && trail.finds) || {}) },
        days: { ...((trail && trail.days) || {}) }
      };
    }

    /* A stamp is a Pattern coordinate: { patternDay (1..364, or
     * null outside the counted year), patternYear (the anchor
     * civil year), moon, moonDay, civilDate }. */
    function recordDayIn(trail, stamp) {
      const next = clone(trail);
      if (!stamp || !stamp.patternYear || !stamp.patternDay) return next;
      const year = String(stamp.patternYear);
      const days = new Set(Array.isArray(next.days[year]) ? next.days[year] : []);
      days.add(stamp.patternDay);
      next.days[year] = [...days].sort((a, b) => a - b);
      return next;
    }

    function recordFindIn(trail, chapterId, stamp) {
      const next = recordDayIn(trail, stamp);
      if (!chapterId || !stamp) return next;
      if (!next.finds[chapterId]) {
        next.finds[chapterId] = {
          patternDay: stamp.patternDay ?? null,
          patternYear: stamp.patternYear ?? null,
          moon: stamp.moon ?? null,
          moonDay: stamp.moonDay ?? null,
          civilDate: stamp.civilDate || null
        };
      }
      return next;
    }

    function daysForYear(trail, anchorYear) {
      const days = (trail && trail.days && trail.days[String(anchorYear)]) || [];
      return [...new Set(days)].filter(d => d >= 1 && d <= 364).sort((a, b) => a - b);
    }

    function findFor(trail, chapterId) {
      return (trail && trail.finds && trail.finds[chapterId]) || null;
    }

    /* Read today's stamp from the canonical converter. */
    function stampFor(instant = new Date(), patternCalendar = null) {
      const calendar =
        patternCalendar ||
        (typeof globalThis !== "undefined" ? globalThis.PatternCalendar : null);
      if (!calendar?.fromCivilDate) return null;
      let timeZone = "UTC";
      try {
        timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      } catch { /* UTC stands */ }
      try {
        const c = calendar.fromCivilDate({
          date: instant instanceof Date ? instant : new Date(instant),
          timeZone,
          boundaryMode: "midnight",
          sunsetTime: "18:00"
        });
        const anchorYear = c.anchorDate ? c.anchorDate.getUTCFullYear() : null;
        return {
          patternDay: c.insideCountedYear ? c.dayOfPatternYear : null,
          patternYear: anchorYear,
          moon: c.moon ?? null,
          moonDay: c.day ?? null,
          civilDate: c.civilDate || null,
          outsideDay: !c.insideCountedYear
        };
      } catch {
        return null;
      }
    }

    /* ------------------------- storage ------------------------- */

    function storage() {
      try {
        return typeof localStorage !== "undefined" ? localStorage : null;
      } catch {
        return null;
      }
    }

    function load() {
      const store = storage();
      if (!store) return emptyTrail();
      try {
        const raw = store.getItem(STORAGE_KEY);
        if (!raw) return emptyTrail();
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return emptyTrail();
        return { version: 1, finds: parsed.finds || {}, days: parsed.days || {} };
      } catch {
        return emptyTrail();
      }
    }

    function save(trail) {
      const store = storage();
      if (!store) return false;
      try {
        store.setItem(STORAGE_KEY, JSON.stringify(trail));
        return true;
      } catch {
        return false;
      }
    }

    function recordDay(stamp = stampFor()) {
      if (!stamp) return null;
      const next = recordDayIn(load(), stamp);
      save(next);
      return stamp;
    }

    function recordFind(chapterId, stamp = stampFor()) {
      if (!stamp || !chapterId) return null;
      const next = recordFindIn(load(), chapterId, stamp);
      save(next);
      return findFor(next, chapterId);
    }

    return {
      VERSION,
      STORAGE_KEY,
      emptyTrail,
      recordDayIn,
      recordFindIn,
      daysForYear,
      findFor,
      stampFor,
      load,
      save,
      recordDay,
      recordFind
    };
  }
);
