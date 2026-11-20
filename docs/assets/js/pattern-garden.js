/**
 * The Pattern Garden — the Garden (garden.html)
 *
 * Aaron's design (Nov 20, 2026): Shroom Search is remade entirely —
 * mushrooms out — for a game that goes with the site. The Pattern
 * Garden is keyed to the two real systems it stands between:
 *
 *   1. Thirteen beds, one per Moon. The Pattern Calendar keys WHEN
 *      a bed is open: Moon 1's bed opens at the Year Gate (April 17)
 *      and each Moon's bed is the open one for that Moon's 28 days.
 *      Every coordinate is read from PatternCalendar, the canonical
 *      converter — never hand-computed.
 *   2. The farm data keys WHAT goes in a bed. Planting choices come
 *      from the site's Western Washington farm datasets
 *      (farm-western-wa.json, farm-homestead-western-wa.json):
 *      a crop is offered for a Moon when one of its real planting
 *      windows — counted from the county's last spring frost, or
 *      the fall chart's own month-days — overlaps that Moon's real
 *      dates, and the offer names its window and its sources. Moon
 *      lines are never passed off as farm facts: the calendar says
 *      when the bed is open; the farm record says what belongs in
 *      the ground. The ground is the keeper's own county: the farm
 *      dataset carries all thirty-nine Washington counties, each
 *      anchored on its real frost record and labeled published or
 *      computed in its provenance, never one dressed as the other.
 *      The keeper's county is remembered on their device, and every
 *      planting record carries the county it was planted under, so
 *      changing ground never rewrites a planting already in the
 *      ground.
 *   3. Tending is witnessing. A planting grows on the days its
 *      keeper keeps — days the keeper's own Life Atlas record
 *      holds, counted inside the planting's Moon — and the bed's
 *      own Witness act is one of those kept days. Growth follows
 *      the Moon's real 28 days; there are no timers divorced from
 *      the calendar and nothing grows while nothing is kept.
 *   4. Harvest at the Moon's turn. When the Moon turns, a planting
 *      witnessed on at least seven of its days is harvested into a
 *      keepsake in the Life Atlas. A planting witnessed less goes
 *      honestly to seed — the season ended; nothing is faked.
 *   5. A planting returns. When the same Moon comes round the next
 *      year, a keepsake from that Moon's bed returns to its keeper:
 *      a return record joins the keepsake in the Atlas.
 *   6. The keeper's Spark helps: it can find a seed of the season —
 *      a crop the farm data plants in the open Moon — as part of
 *      the hidden-finds layer. Early finds come readily; later
 *      ones are rarer, by a rule computed from the keeper's own
 *      record and the day, on this device only.
 *
 * RECORD SAFETY (standing law): what keepers earned in Shroom
 * Search stays in their Atlas exactly as it is. This module reads
 * the old garden's records only to count the passes a keeper holds;
 * it never writes, edits, or deletes a record of the old subtypes
 * ("garden-tend", "garden-tier", "garden-pass"), and its own
 * records ride the schema's type + subtype extension path under
 * their own names: "garden-planting", "garden-witness",
 * "garden-seed", "garden-return", and the keepsake, type
 * "artifact" / subtype "garden-keepsake".
 *
 * The pure functions (moonSpan, cropWindows, plantableForSpan,
 * foldGarden, seedFindFor, the record builders) carry no DOM or
 * storage dependency and are unit-tested in
 * tests/pattern-garden.test.js.
 */
(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.CodexPatternGarden = api;
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function () {
    "use strict";

    const VERSION = "pattern-garden/1.0.0";

    const RECORD_TAG = "pattern-garden";
    const PLANT_SUBTYPE = "garden-planting";
    const WITNESS_SUBTYPE = "garden-witness";
    const SEED_SUBTYPE = "garden-seed";
    const RETURN_SUBTYPE = "garden-return";
    const KEEPSAKE_SUBTYPE = "garden-keepsake";
    const KEEPSAKE_TYPE = "artifact";
    const EVENT_TYPE = "event";

    /* The old garden's pass subtype — read-only here, forever.
     * Counted so the page can say plainly that earned passes are
     * untouched; never written by this module. */
    const OLD_PASS_SUBTYPE = "garden-pass";
    const OLD_RECORD_TAG = "shroom-garden";

    /* Growth stages by witnessed (kept) days inside the Moon. */
    const STAGES = Object.freeze([
      Object.freeze({ name: "Seed", glyph: "·", at: 0 }),
      Object.freeze({ name: "Sprout", glyph: "⌒", at: 1 }),
      Object.freeze({ name: "Leafing", glyph: "❧", at: 3 }),
      Object.freeze({ name: "Flowering", glyph: "✿", at: 5 }),
      Object.freeze({ name: "Ready", glyph: "❦", at: 7 })
    ]);
    const HARVEST_WITNESS_MIN = 7;

    /* The one record layer: record cleaning, the temporal shape,
     * repository resolution, and change notices live in
     * life-atlas/record-helpers.js (CodexRecordHelpers) — one shared
     * module for every door. Do not re-define them here. */
    const RecordHelpers =
      (typeof globalThis !== "undefined" ? globalThis.CodexRecordHelpers : null) ||
      (typeof module === "object" && module.exports
        ? (() => {
            try {
              return require("./life-atlas/record-helpers.js");
            } catch {
              return null;
            }
          })()
        : null);

    if (!RecordHelpers) {
      throw new Error(
        "CodexRecordHelpers is required — load life-atlas/record-helpers.js first."
      );
    }

    const cleanText = RecordHelpers.cleanText;
    const finiteOrNull = RecordHelpers.finiteOrNull;
    const temporalFromConversion = RecordHelpers.temporalFromConversion;
    const notifyRecordsChanged = RecordHelpers.notifyRecordsChanged;
    const resolveRepository = RecordHelpers.createRepositoryResolver();

    /* --------------------------- dates --------------------------- */

    const DAY_MS = 86400000;

    function isoOf(date) {
      return date.toISOString().slice(0, 10);
    }

    function addDaysISO(iso, days) {
      const d = new Date(`${iso}T12:00:00Z`);
      if (Number.isNaN(d.getTime())) return null;
      return isoOf(new Date(d.getTime() + days * DAY_MS));
    }

    function monthDayInYear(monthDay, year) {
      const m = /^(\d{2})-(\d{2})$/.exec(String(monthDay || ""));
      if (!m) return null;
      return isoOf(new Date(Date.UTC(year, Number(m[1]) - 1, Number(m[2]), 12)));
    }

    /* --------------------- the calendar's key -------------------- */

    /* One Moon's real dates in one Pattern year. The anchor is
     * April 17 of the anchor civil year (PatternCalendar's epoch);
     * Moon m runs 28 days from anchor + (m-1)*28. This is the same
     * fixed-epoch arithmetic PatternCalendar itself converts with —
     * stated here once so the garden's spans and the calendar's
     * coordinates can be tested against each other. */
    function moonSpan(anchorYear, moon) {
      const m = Math.floor(Number(moon) || 0);
      if (!anchorYear || m < 1 || m > 13) return null;
      const anchor = isoOf(new Date(Date.UTC(anchorYear, 3, 17, 12)));
      const start = addDaysISO(anchor, (m - 1) * 28);
      const end = addDaysISO(start, 27);
      return { anchorYear, moon: m, start, end };
    }

    function bedIdFor(moon) {
      return `moon-${moon}`;
    }

    /* Is `today` (a temporal summary: { patternYear (anchor civil
     * year), moon, outsideDay }) past the given Moon of the given
     * anchor year? The Moon's turn is the boundary: the Day Out of
     * Time stands past Moon 13. */
    function isPastMoon(today, anchorYear, moon) {
      if (!today) return false;
      if (today.patternYear > anchorYear) return true;
      if (today.patternYear < anchorYear) return false;
      if (today.outsideDay) return true;
      return (today.moon || 0) > moon;
    }

    function isCurrentMoon(today, anchorYear, moon) {
      return Boolean(
        today &&
        today.patternYear === anchorYear &&
        !today.outsideDay &&
        today.moon === moon
      );
    }

    /* ----------------------- the farm's key ---------------------- */

    /* A crop's real planting windows in one civil year, from the
     * farm dataset's own fields — the same reading the Sphere's
     * farm layer gives them: spring windows counted in weeks from
     * the county's average last spring frost; fall windows in the
     * extension chart's own month-days. A window with no sourced
     * value is left out, never guessed. */
    function cropWindows(crop, location, year) {
      if (!crop || !location || !year) return [];
      const out = [];
      const lsf = monthDayInYear(location.lastSpringFrost, year);
      const push = (kind, start, end, sources) => {
        if (start && end && start <= end) {
          out.push({ kind, start, end, sources: Array.isArray(sources) ? sources : [] });
        }
      };
      if (crop.indoorStart && Array.isArray(crop.indoorStart.weeksBeforeLastFrost) && lsf) {
        const [lo, hi] = crop.indoorStart.weeksBeforeLastFrost;
        push("indoor", addDaysISO(lsf, -hi * 7), addDaysISO(lsf, -lo * 7), crop.indoorStart.sources);
      }
      if (crop.transplant && lsf) {
        if (Array.isArray(crop.transplant.weeksFromLastFrost)) {
          const [lo, hi] = crop.transplant.weeksFromLastFrost;
          push("transplant", addDaysISO(lsf, lo * 7), addDaysISO(lsf, hi * 7), crop.transplant.sources);
        } else if (crop.transplant.fixed) {
          push(
            "transplant",
            monthDayInYear(crop.transplant.fixed.start, year),
            monthDayInYear(crop.transplant.fixed.end, year),
            crop.transplant.sources
          );
        }
      }
      if (crop.directSow && Array.isArray(crop.directSow.weeksFromLastFrost) && lsf) {
        const [lo, hi] = crop.directSow.weeksFromLastFrost;
        push("sow", addDaysISO(lsf, lo * 7), addDaysISO(lsf, hi * 7), crop.directSow.sources);
      }
      if (crop.fall && crop.fall.startMonthDay && crop.fall.endMonthDay) {
        push(
          "fall",
          monthDayInYear(crop.fall.startMonthDay, year),
          monthDayInYear(crop.fall.endMonthDay, year),
          crop.fall.sources
        );
      }
      return out;
    }

    const METHOD_LABELS = Object.freeze({
      indoor: "Start indoors",
      transplant: "Transplant out",
      sow: "Direct sow",
      fall: "Sow for fall"
    });

    /* What belongs in the ground during one Moon's span: every
     * crop with a real window overlapping the span, in either of
     * the civil years the span touches. Each offer carries its
     * window and its sources — the farm record speaks, the Moon
     * only says the bed is open. */
    function plantableForSpan(crops, location, span) {
      if (!Array.isArray(crops) || !location || !span) return [];
      const years = [...new Set([Number(span.start.slice(0, 4)), Number(span.end.slice(0, 4))])];
      const out = [];
      for (const crop of crops) {
        for (const year of years) {
          for (const w of cropWindows(crop, location, year)) {
            if (w.start <= span.end && w.end >= span.start) {
              out.push({
                cropId: crop.id,
                name: crop.name,
                method: w.kind,
                methodLabel: METHOD_LABELS[w.kind] || w.kind,
                windowStart: w.start,
                windowEnd: w.end,
                sources: w.sources,
                frostClass: crop.frostClass || null
              });
            }
          }
        }
      }
      return out.sort((a, b) => a.name.localeCompare(b.name) || a.method.localeCompare(b.method));
    }

    /* The keeper's ground. The county is a choice, remembered on
     * the keeper's device, and stamped on every planting; the
     * default is Lewis County, the garden's home ground, so an
     * existing keeper's garden reads exactly as it always did. */
    const DEFAULT_COUNTY_ID = "lewis";
    const COUNTY_STORAGE_KEY = "sof.pattern-garden.county.v1";

    function resolveCountyId(locations, requested) {
      const list = Array.isArray(locations) ? locations : [];
      if (!list.length) return null;
      if (requested && list.some(l => l && l.id === requested)) return requested;
      if (list.some(l => l && l.id === DEFAULT_COUNTY_ID)) return DEFAULT_COUNTY_ID;
      return list[0].id || null;
    }

    /* --------------------------- records -------------------------- */

    function gardenPayload(record) {
      return record?.payload?.patternGarden || null;
    }

    function isPatternRecord(record, subtype = null) {
      if (!record || typeof record !== "object") return false;
      if (subtype && record.subtype !== subtype) return false;
      return Boolean(
        gardenPayload(record) ||
        (Array.isArray(record.tags) && record.tags.includes(RECORD_TAG))
      );
    }

    function countOldPasses(records) {
      return (Array.isArray(records) ? records : []).filter(
        record => record && record.subtype === OLD_PASS_SUBTYPE
      ).length;
    }

    function recordInstant(record) {
      return record?.temporal?.instant || record?.createdAt || record?.temporal?.civilDate || "";
    }

    function byInstant(a, b) {
      const left = String(recordInstant(a));
      const right = String(recordInstant(b));
      if (left < right) return -1;
      if (left > right) return 1;
      return String(a?.id || "").localeCompare(String(b?.id || ""));
    }

    /* ---------------------------- fold ---------------------------- */

    function stageFor(witnessedDays) {
      const value = Math.max(0, Math.floor(Number(witnessedDays) || 0));
      let stage = STAGES[0];
      for (const s of STAGES) if (value >= s.at) stage = s;
      return stage;
    }

    /**
     * Fold the garden from records alone.
     *
     * input: {
     *   records,    — every Life Atlas record on the device
     *   keptDates,  — the civil dates the keeper's record holds
     *                 (the page builds this from all records; the
     *                 garden's own witness days are unioned in here
     *                 regardless, so the fold is true even from a
     *                 partial date list)
     *   today,      — today's temporal summary { civilDate,
     *                 patternYear (anchor civil year), moon,
     *                 outsideDay }
     *   moonNames,  — the record's Moon names, index 0 = Moon 1
     * }
     *
     * The garden shown is the current Pattern year's thirteen
     * beds. A planting's witnessed days are the distinct kept
     * dates inside its Moon's span, on or after its planting day.
     */
    function foldGarden(input = {}) {
      const records = Array.isArray(input.records) ? input.records : [];
      const today = input.today || null;
      const moonNames = Array.isArray(input.moonNames) ? input.moonNames : [];
      const anchorYear = today ? today.patternYear : null;

      const mine = records.filter(record => isPatternRecord(record));
      const plantings = mine.filter(r => r.subtype === PLANT_SUBTYPE).sort(byInstant);
      const witnesses = mine.filter(r => r.subtype === WITNESS_SUBTYPE);
      const keepsakes = mine
        .filter(r => r.subtype === KEEPSAKE_SUBTYPE)
        .sort(byInstant)
        .reverse()
        .map(record => {
          const p = gardenPayload(record) || {};
          return {
            recordId: record.id || null,
            cropId: p.cropId || null,
            cropName: p.cropName || p.cropId || "A planting",
            moon: finiteOrNull(p.moon),
            anchorYear: finiteOrNull(p.anchorYear),
            witnessedDays: finiteOrNull(p.witnessedDays),
            foundSeed: Boolean(p.foundSeed),
            civilDate: record.temporal?.civilDate || null
          };
        });
      const seeds = mine
        .filter(r => r.subtype === SEED_SUBTYPE)
        .sort(byInstant)
        .map(record => {
          const p = gardenPayload(record) || {};
          return {
            recordId: record.id || null,
            cropId: p.cropId || null,
            cropName: p.cropName || p.cropId || "A seed",
            moon: finiteOrNull(p.moon),
            anchorYear: finiteOrNull(p.anchorYear),
            civilDate: record.temporal?.civilDate || null,
            /* A seed is used when a planting names it — records
             * are never edited to mark the fact. */
            used: mine.some(
              r =>
                r.subtype === PLANT_SUBTYPE &&
                (gardenPayload(r) || {}).seedId === record.id
            )
          };
        });
      const returns = mine.filter(r => r.subtype === RETURN_SUBTYPE);

      const kept = new Set(Array.isArray(input.keptDates) ? input.keptDates : []);
      for (const w of witnesses) {
        const day = w.temporal?.civilDate;
        if (day) kept.add(day);
      }

      const beds = [];
      for (let moon = 1; moon <= 13; moon += 1) {
        const span = anchorYear ? moonSpan(anchorYear, moon) : null;
        const bedPlantings = plantings
          .filter(r => {
            const p = gardenPayload(r) || {};
            return finiteOrNull(p.anchorYear) === anchorYear && finiteOrNull(p.moon) === moon;
          })
          .map(record => {
            const p = gardenPayload(record) || {};
            const plantedDate = p.plantedCivilDate || record.temporal?.civilDate || null;
            const witnessed = new Set();
            if (span) {
              for (const day of kept) {
                if (day >= span.start && day <= span.end && (!plantedDate || day >= plantedDate)) {
                  witnessed.add(day);
                }
              }
            }
            const witnessedDays = witnessed.size;
            const harvested = mine.some(
              r =>
                r.subtype === KEEPSAKE_SUBTYPE &&
                (gardenPayload(r) || {}).plantingId === record.id
            );
            const past = isPastMoon(today, anchorYear, moon);
            const stage = stageFor(witnessedDays);
            return {
              recordId: record.id || null,
              cropId: p.cropId || null,
              cropName: p.cropName || p.cropId || "A planting",
              method: p.method || null,
              plantedDate,
              witnessedDays,
              stageName: stage.name,
              stageGlyph: stage.glyph,
              foundSeed: Boolean(p.foundSeed),
              countyId: p.countyId || null,
              countyName: p.countyName || null,
              harvested,
              canHarvest: Boolean(past && !harvested && witnessedDays >= HARVEST_WITNESS_MIN),
              goneToSeed: Boolean(past && !harvested && witnessedDays < HARVEST_WITNESS_MIN)
            };
          });

        /* A keepsake from last year's same Moon returns while
         * this Moon is the open one and no return record names
         * it yet. */
        const returnable = keepsakes.filter(k => {
          if (k.anchorYear !== (anchorYear || 0) - 1 || k.moon !== moon) return false;
          if (!isCurrentMoon(today, anchorYear, moon)) return false;
          return !returns.some(r => (gardenPayload(r) || {}).keepsakeId === k.recordId);
        });

        beds.push({
          moon,
          bedId: bedIdFor(moon),
          name: moonNames[moon - 1] ? `Moon ${moon} — ${moonNames[moon - 1]}` : `Moon ${moon}`,
          span,
          state: !today || !anchorYear
            ? "unknown"
            : isCurrentMoon(today, anchorYear, moon)
              ? "open"
              : isPastMoon(today, anchorYear, moon)
                ? "past"
                : "coming",
          plantings: bedPlantings,
          returnable
        });
      }

      return {
        anchorYear,
        beds,
        keepsakes,
        seeds,
        oldPasses: countOldPasses(records),
        openBed: beds.find(b => b.state === "open") || null
      };
    }

    /* ------------------------- the Spark's finds ------------------ */

    function hashText(text) {
      let h = 2166136261;
      const s = String(text || "");
      for (let i = 0; i < s.length; i += 1) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return Math.abs(h);
    }

    /* The hidden-finds rule for the garden, computed from the
     * keeper's own record and the day: a keeper who holds fewer
     * than two found seeds is offered one readily (the layer's
     * early spawns); after that, a find rests on the day itself —
     * roughly one day in three — and never twice in a day. */
    function seedFindFor({ civilDate, seedsHeld = 0, lastSeedCivilDate = null } = {}) {
      if (!civilDate) return false;
      if (lastSeedCivilDate === civilDate) return false;
      if (seedsHeld < 2) {
        if (!lastSeedCivilDate) return true;
        return civilDate >= addDaysISO(lastSeedCivilDate, 3);
      }
      return hashText(`pattern-garden-seed:${civilDate}`) % 3 === 0;
    }

    /* ------------------------- record builders -------------------- */

    function baseRecord({ type, subtype, title, summary, temporal, extraTags, payload }) {
      return {
        type,
        subtype,
        title,
        summary: summary || "",
        temporal: temporal || {},
        tags: [RECORD_TAG, ...(extraTags || [])],
        provenance: {
          sourceType: "pattern-garden",
          sourceId: "garden.html",
          calculationAuthority: "PatternCalendar"
        },
        privacy: {
          visibility: "private",
          containsPersonalData: true,
          shareAllowed: false
        },
        payload: {
          patternGarden: payload
        }
      };
    }

    function buildPlantRecord(input = {}, temporal = null) {
      const moon = Math.floor(Number(input.moon) || 0);
      return baseRecord({
        type: EVENT_TYPE,
        subtype: PLANT_SUBTYPE,
        title: `Planted ${cleanText(input.cropName, 60) || "a crop"} in Moon ${moon}'s bed`,
        summary:
          "A planting in the Pattern Garden. The Moon keyed when its bed was open; the farm record keyed what went in. It grows on the days its keeper keeps.",
        temporal,
        extraTags: ["garden-planting"],
        payload: {
          version: 1,
          action: "plant",
          moon,
          anchorYear: Math.floor(Number(input.anchorYear) || 0) || null,
          cropId: cleanText(input.cropId, 60) || null,
          cropName: cleanText(input.cropName, 60) || null,
          method: cleanText(input.method, 20) || null,
          plantedCivilDate: cleanText(input.plantedCivilDate, 20) || null,
          foundSeed: Boolean(input.foundSeed),
          countyId: cleanText(input.countyId, 40) || null,
          countyName: cleanText(input.countyName, 60) || null,
          seedId: cleanText(input.seedId, 80) || null
        }
      });
    }

    function buildWitnessRecord(input = {}, temporal = null) {
      const moon = Math.floor(Number(input.moon) || 0);
      return baseRecord({
        type: EVENT_TYPE,
        subtype: WITNESS_SUBTYPE,
        title: `Witnessed Moon ${moon}'s bed`,
        summary:
          "One kept day in the Pattern Garden: the keeper stood at the bed and witnessed it. Kept days are what plantings grow on.",
        temporal,
        extraTags: ["garden-witness"],
        payload: {
          version: 1,
          action: "witness",
          moon,
          anchorYear: Math.floor(Number(input.anchorYear) || 0) || null,
          plantingId: cleanText(input.plantingId, 80) || null
        }
      });
    }

    function buildKeepsakeRecord(input = {}, temporal = null) {
      const moon = Math.floor(Number(input.moon) || 0);
      return baseRecord({
        type: KEEPSAKE_TYPE,
        subtype: KEEPSAKE_SUBTYPE,
        title: `Pattern Garden keepsake — ${cleanText(input.cropName, 60) || "a crop"}, Moon ${moon}`,
        summary:
          "A harvest kept in the keeper's Life Atlas: this planting was witnessed through its Moon and harvested at the Moon's turn. When the same Moon comes round next year, it returns to its keeper.",
        temporal,
        extraTags: ["garden-keepsake"],
        payload: {
          version: 1,
          action: "harvest",
          moon,
          anchorYear: Math.floor(Number(input.anchorYear) || 0) || null,
          cropId: cleanText(input.cropId, 60) || null,
          cropName: cleanText(input.cropName, 60) || null,
          plantingId: cleanText(input.plantingId, 80) || null,
          witnessedDays: Math.max(0, Math.floor(Number(input.witnessedDays) || 0)),
          foundSeed: Boolean(input.foundSeed),
          status: "kept"
        }
      });
    }

    function buildSeedRecord(input = {}, temporal = null) {
      const moon = Math.floor(Number(input.moon) || 0);
      return baseRecord({
        type: EVENT_TYPE,
        subtype: SEED_SUBTYPE,
        title: `The Spark found a seed — ${cleanText(input.cropName, 60) || "a crop"}, Moon ${moon}`,
        summary:
          "A seed of the season, found by the keeper's Spark in the Pattern Garden as part of the hidden-finds layer. Plant it in the open bed and its keepsake, if earned, remembers where it came from.",
        temporal,
        extraTags: ["garden-seed"],
        payload: {
          version: 1,
          action: "seed-found",
          moon,
          anchorYear: Math.floor(Number(input.anchorYear) || 0) || null,
          cropId: cleanText(input.cropId, 60) || null,
          cropName: cleanText(input.cropName, 60) || null,
          usedPlantingId: null
        }
      });
    }

    function buildReturnRecord(input = {}, temporal = null) {
      const moon = Math.floor(Number(input.moon) || 0);
      return baseRecord({
        type: EVENT_TYPE,
        subtype: RETURN_SUBTYPE,
        title: `Returned with Moon ${moon} — ${cleanText(input.cropName, 60) || "a keepsake"}`,
        summary:
          "A Pattern Garden keepsake returned to its keeper as its Moon came round again, a full year on. The keepsake itself is untouched; this record marks its return.",
        temporal,
        extraTags: ["garden-return"],
        payload: {
          version: 1,
          action: "return",
          moon,
          anchorYear: Math.floor(Number(input.anchorYear) || 0) || null,
          keepsakeId: cleanText(input.keepsakeId, 80) || null,
          cropId: cleanText(input.cropId, 60) || null,
          cropName: cleanText(input.cropName, 60) || null
        }
      });
    }

    /* ------------------------- temporal (canonical) ---------------- */

    function coordinateForInstant(instant = new Date(), options = {}, patternCalendar = null) {
      const calendar =
        patternCalendar ||
        (typeof globalThis !== "undefined" ? globalThis.PatternCalendar : null);
      if (!calendar?.fromCivilDate) return null;
      const timeZone =
        options.timeZone ||
        (() => {
          try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone;
          } catch {
            return "UTC";
          }
        })();
      try {
        const conversion = calendar.fromCivilDate({
          date: instant instanceof Date ? instant : new Date(instant),
          timeZone,
          boundaryMode: options.boundaryMode || "midnight",
          sunsetTime: options.sunsetTime || "18:00"
        });
        return temporalFromConversion(conversion, instant);
      } catch {
        return null;
      }
    }

    function coordinateLabel(temporal) {
      if (!temporal) return "coordinate unavailable";
      if (temporal.outsideDay || temporal.patternDay === null) {
        return temporal.civilDate
          ? `${temporal.civilDate} · Day Out of Time · outside the 364-day count`
          : "Day Out of Time · outside the 364-day count";
      }
      const moon = temporal.moon != null ? `Moon ${temporal.moon}` : "Moon —";
      const day = temporal.moonDay != null ? `Day ${temporal.moonDay}` : "Day —";
      return `${moon} · ${day} · Pattern Day ${temporal.patternDay}`;
    }

    /* ------------------------- page wiring ------------------------ */

    let allRecords = [];
    let farmData = null;
    let state = null;
    let todayTemporal = null;
    let countyId = DEFAULT_COUNTY_ID;

    function readStoredCountyId() {
      try {
        return globalThis.localStorage?.getItem(COUNTY_STORAGE_KEY) || null;
      } catch { return null; }
    }

    function storeCountyId(id) {
      try {
        globalThis.localStorage?.setItem(COUNTY_STORAGE_KEY, id);
      } catch { /* the choice still holds for the session */ }
    }

    function moonNames() {
      try {
        const data = typeof globalThis !== "undefined" ? globalThis.PatternCalendarData : null;
        if (data && Array.isArray(data.moons)) return data.moons.map(m => m?.name || null);
      } catch { /* names are a courtesy */ }
      return [];
    }

    async function loadFarm() {
      if (farmData) return farmData;
      try {
        const [west, home] = await Promise.all([
          fetch("assets/data/farm-western-wa.json").then(r => (r.ok ? r.json() : null)),
          fetch("assets/data/farm-homestead-western-wa.json").then(r => (r.ok ? r.json() : null))
        ]);
        const crops = [...((west && west.crops) || [])];
        /* Cover crops are real bed plantings too; the homestead
         * file's entries carry month-day sowing windows in their
         * own shape, read as fall-style windows. */
        for (const cc of (home && home.coverCrops) || []) {
          if (cc && cc.id && cc.name && cc.sowWindow) {
            crops.push({
              id: cc.id,
              name: cc.name,
              frostClass: "cover",
              fall: { startMonthDay: cc.sowWindow.start, endMonthDay: cc.sowWindow.end, sources: cc.sources || [] }
            });
          }
        }
        const sourceNames = {};
        for (const file of [west, home]) {
          for (const s of (file && file.sources) || []) {
            if (s && s.id) sourceNames[s.id] = s.name || s.id;
          }
        }
        farmData = {
          crops,
          locations: (west && west.locations) || [],
          sourceNames
        };
      } catch {
        farmData = { crops: [], locations: [], sourceNames: {} };
      }
      return farmData;
    }

    function location() {
      if (!farmData) return null;
      return farmData.locations.find(l => l.id === countyId) || farmData.locations[0] || null;
    }

    async function loadRecords() {
      const repository = await resolveRepository();
      if (!repository) return false;
      try {
        allRecords = await repository.query({});
        todayTemporal = coordinateForInstant(new Date());
        const keptDates = [
          ...new Set(
            allRecords.map(r => r?.temporal?.civilDate).filter(Boolean)
          )
        ];
        state = foldGarden({
          records: allRecords,
          keptDates,
          today: todayTemporal,
          moonNames: moonNames()
        });
        return true;
      } catch {
        return false;
      }
    }

    async function put(record) {
      const repository = await resolveRepository();
      if (!repository) return false;
      try {
        await repository.put(record);
        return true;
      } catch {
        return false;
      }
    }

    function setStatus(message) {
      if (typeof document === "undefined") return;
      const el = document.getElementById("garden-status");
      if (el) el.textContent = message;
    }

    function sourceLabel(ids) {
      if (!farmData) return "";
      const names = (ids || []).map(id => farmData.sourceNames[id] || id);
      return names.length ? `Sources: ${names.join("; ")}` : "";
    }

    function plantableNow() {
      const bed = state?.openBed;
      const loc = location();
      if (!bed || !bed.span || !loc || !farmData) return [];
      return plantableForSpan(farmData.crops, loc, bed.span);
    }

    function render() {
      if (typeof document === "undefined" || !state) return;
      const coords = document.getElementById("garden-today-coords");
      if (coords) {
        coords.textContent = todayTemporal
          ? `${todayTemporal.civilDate || ""} · ${coordinateLabel(todayTemporal)}`
          : "Today's coordinate is unavailable";
      }
      const count = document.getElementById("garden-today-count");
      if (count) {
        count.textContent = state.openBed
          ? `Moon ${state.openBed.moon}'s bed is the open one — ${state.openBed.span.start} to ${state.openBed.span.end}.`
          : "No bed is open today — the Day Out of Time stands outside the Moons, and the garden rests with it.";
      }

      /* The Spark's seed find. */
      const findHost = document.getElementById("garden-seed-find");
      if (findHost) {
        findHost.replaceChildren();
        const offers = plantableNow();
        const lastSeed = state.seeds.length ? state.seeds[state.seeds.length - 1] : null;
        const found =
          todayTemporal &&
          offers.length &&
          seedFindFor({
            civilDate: todayTemporal.civilDate,
            seedsHeld: state.seeds.length,
            lastSeedCivilDate: lastSeed ? lastSeed.civilDate : null
          });
        if (found) {
          const pick = offers[Math.abs(hashText(todayTemporal.civilDate)) % offers.length];
          const p = document.createElement("p");
          p.textContent = `Your Spark has found a seed of the season: ${pick.name}. It belongs in Moon ${state.openBed.moon}'s bed.`;
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "garden-btn";
          btn.textContent = "Keep the seed";
          btn.addEventListener("click", () => {
            void (async () => {
              const ok = await put(
                buildSeedRecord(
                  { moon: state.openBed.moon, anchorYear: state.anchorYear, cropId: pick.cropId, cropName: pick.name },
                  todayTemporal
                )
              );
              if (ok) {
                notifyRecordsChanged({ source: "pattern-garden", kind: "seed" });
                await loadRecords();
                render();
                setStatus(`The ${pick.name} seed is kept in your record. Plant it from the open bed's list.`);
              } else setStatus("The seed could not be kept — the record is unavailable.");
            })();
          });
          findHost.append(p, btn);
        }
      }

      /* The beds. */
      const host = document.getElementById("garden-beds");
      if (host) {
        host.replaceChildren();
        const loc = location();
        for (const bed of state.beds) {
          const card = document.createElement("article");
          card.className = "garden-bed" + (bed.state === "open" ? " garden-bed-open" : "");
          card.dataset.bedId = bed.bedId;

          const name = document.createElement("h3");
          name.textContent = bed.name;
          card.appendChild(name);

          const spanLine = document.createElement("p");
          spanLine.className = "garden-bed-tier";
          spanLine.textContent = bed.span
            ? `${bed.span.start} → ${bed.span.end} · ${bed.state === "open" ? "open now" : bed.state}`
            : bed.state;
          card.appendChild(spanLine);

          for (const planting of bed.plantings) {
            const line = document.createElement("p");
            line.className = "garden-bed-growth";
            line.textContent =
              `${planting.stageGlyph} ${planting.cropName} — ${planting.stageName} · witnessed ${planting.witnessedDays} day${planting.witnessedDays === 1 ? "" : "s"}` +
              (planting.foundSeed ? " · from a found seed" : "") +
              (planting.countyName ? ` · ground: ${planting.countyName}` : "") +
              (planting.harvested
                ? " · harvested — its keepsake is in your Atlas"
                : planting.goneToSeed
                  ? " · went to seed at the Moon's turn"
                  : "");
            card.appendChild(line);
            if (planting.canHarvest) {
              const btn = document.createElement("button");
              btn.type = "button";
              btn.className = "garden-btn garden-btn-harvest";
              btn.textContent = `Harvest the ${planting.cropName} — keep its keepsake`;
              btn.addEventListener("click", () => {
                void (async () => {
                  const ok = await put(
                    buildKeepsakeRecord(
                      {
                        moon: bed.moon,
                        anchorYear: state.anchorYear,
                        cropId: planting.cropId,
                        cropName: planting.cropName,
                        plantingId: planting.recordId,
                        witnessedDays: planting.witnessedDays,
                        foundSeed: planting.foundSeed
                      },
                      coordinateForInstant(new Date())
                    )
                  );
                  if (ok) {
                    notifyRecordsChanged({ source: "pattern-garden", kind: "keepsake" });
                    await loadRecords();
                    render();
                    setStatus(`The ${planting.cropName} keepsake is in your Life Atlas. It returns when Moon ${bed.moon} comes round next year.`);
                  } else setStatus("The harvest could not be written — the record is unavailable.");
                })();
              });
              card.appendChild(btn);
            }
          }

          for (const k of bed.returnable) {
            const note = document.createElement("p");
            note.className = "garden-bed-note";
            note.textContent = `Your ${k.cropName} keepsake from last year returns with this Moon.`;
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "garden-btn";
            btn.textContent = "Welcome it back";
            btn.addEventListener("click", () => {
              void (async () => {
                const ok = await put(
                  buildReturnRecord(
                    { moon: bed.moon, anchorYear: state.anchorYear, keepsakeId: k.recordId, cropId: k.cropId, cropName: k.cropName },
                    coordinateForInstant(new Date())
                  )
                );
                if (ok) {
                  notifyRecordsChanged({ source: "pattern-garden", kind: "return" });
                  await loadRecords();
                  render();
                  setStatus(`The ${k.cropName} keepsake's return is written beside it in your Atlas.`);
                } else setStatus("The return could not be written — the record is unavailable.");
              })();
            });
            card.append(note, btn);
          }

          if (bed.state === "open") {
            const witnessedToday = allRecords.some(
              r =>
                r.subtype === WITNESS_SUBTYPE &&
                (gardenPayload(r) || {}).moon === bed.moon &&
                (gardenPayload(r) || {}).anchorYear === state.anchorYear &&
                r.temporal?.civilDate === (todayTemporal && todayTemporal.civilDate)
            );
            const witnessBtn = document.createElement("button");
            witnessBtn.type = "button";
            witnessBtn.className = "garden-btn";
            witnessBtn.disabled = witnessedToday;
            witnessBtn.textContent = witnessedToday ? "Witnessed today ✓" : "Witness this bed today";
            witnessBtn.addEventListener("click", () => {
              void (async () => {
                const ok = await put(
                  buildWitnessRecord(
                    { moon: bed.moon, anchorYear: state.anchorYear, plantingId: bed.plantings[0]?.recordId || null },
                    coordinateForInstant(new Date())
                  )
                );
                if (ok) {
                  notifyRecordsChanged({ source: "pattern-garden", kind: "witness" });
                  await loadRecords();
                  render();
                  setStatus("Today is kept. What grows here grows on kept days.");
                } else setStatus("The witness could not be written — the record is unavailable.");
              })();
            });
            card.appendChild(witnessBtn);

            const choices = plantableNow();
            const unusedSeeds = state.seeds.filter(s => !s.used && s.moon === bed.moon);
            if (bed.plantings.length === 0 && choices.length) {
              const list = document.createElement("div");
              list.className = "garden-plant-choices";
              const head = document.createElement("p");
              head.textContent = loc
                ? `What belongs in this bed, from the farm record for ${loc.county} (${loc.anchor}):`
                : "What belongs in this bed, from the farm record:";
              list.appendChild(head);
              for (const choice of choices.slice(0, 12)) {
                const row = document.createElement("p");
                row.className = "garden-plant-choice";
                const seed = unusedSeeds.find(s => s.cropId === choice.cropId);
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "garden-btn";
                btn.textContent = `Plant ${choice.name} — ${choice.methodLabel.toLowerCase()}`;
                btn.addEventListener("click", () => {
                  void (async () => {
                    const ok = await put(
                      buildPlantRecord(
                        {
                          moon: bed.moon,
                          anchorYear: state.anchorYear,
                          cropId: choice.cropId,
                          cropName: choice.name,
                          method: choice.method,
                          plantedCivilDate: todayTemporal?.civilDate || null,
                          countyId: loc?.id || countyId,
                          countyName: loc?.county || null,
                          foundSeed: Boolean(seed),
                          seedId: seed ? seed.recordId : null
                        },
                        coordinateForInstant(new Date())
                      )
                    );
                    if (ok) {
                      notifyRecordsChanged({ source: "pattern-garden", kind: "plant" });
                      await loadRecords();
                      render();
                      setStatus(`${choice.name} is planted in Moon ${bed.moon}'s bed. Witness the bed on the days you keep, and it grows.`);
                    } else setStatus("The planting could not be written — the record is unavailable.");
                  })();
                });
                const why = document.createElement("span");
                why.textContent =
                  ` ${choice.methodLabel} window ${choice.windowStart} → ${choice.windowEnd}. ${sourceLabel(choice.sources)}` +
                  (seed ? " Your Spark's found seed is of this crop." : "");
                row.append(btn, why);
                list.appendChild(row);
              }
              card.appendChild(list);
            } else if (bed.plantings.length === 0) {
              const none = document.createElement("p");
              none.className = "garden-bed-note";
              none.textContent = "The farm record names nothing to plant in this Moon's span for this county — the bed rests, honestly fallow.";
              card.appendChild(none);
            }
          }

          host.appendChild(card);
        }
      }

      /* Keepsakes. */
      const keepHost = document.getElementById("garden-keepsakes");
      const keepEmpty = document.getElementById("garden-keepsakes-empty");
      if (keepHost) {
        keepHost.replaceChildren();
        for (const k of state.keepsakes) {
          const item = document.createElement("li");
          item.className = "garden-pass";
          const main = document.createElement("span");
          main.className = "garden-pass-main";
          main.textContent =
            `Keepsake — ${k.cropName}, from Moon ${k.moon}'s bed · harvested ${k.civilDate || "on an unstamped day"} · witnessed ${k.witnessedDays ?? "—"} days` +
            (k.foundSeed ? " · grown from a found seed" : "");
          const held = document.createElement("span");
          held.className = "garden-pass-held";
          held.textContent = "Kept on this device";
          item.append(main, held);
          keepHost.appendChild(item);
        }
        if (keepEmpty) keepEmpty.hidden = state.keepsakes.length > 0;
      }

      /* The old garden's passes: counted, named, untouched. */
      const oldHost = document.getElementById("garden-old-passes");
      if (oldHost) {
        oldHost.textContent = state.oldPasses
          ? `You hold ${state.oldPasses} pass${state.oldPasses === 1 ? "" : "es"} earned in Shroom Search. They stay in your Life Atlas exactly as they are — this garden reads them only to say so, and never writes to them.`
          : "No Shroom Search passes are held on this device. Any earned elsewhere stay exactly as they are — this garden never writes to the old garden's records.";
      }
    }

    async function init() {
      if (typeof document === "undefined") return;
      const host = document.getElementById("garden-beds");
      if (!host) return;
      const countySelect = document.getElementById("garden-county");
      await loadFarm();
      if (farmData) countyId = resolveCountyId(farmData.locations, readStoredCountyId()) || DEFAULT_COUNTY_ID;
      if (countySelect && farmData) {
        countySelect.replaceChildren();
        for (const loc of farmData.locations) {
          const opt = document.createElement("option");
          opt.value = loc.id;
          opt.textContent = `${loc.county} — ${loc.anchor}`;
          if (loc.id === countyId) opt.selected = true;
          countySelect.appendChild(opt);
        }
        countySelect.addEventListener("change", () => {
          countyId = resolveCountyId(farmData.locations, countySelect.value) || DEFAULT_COUNTY_ID;
          storeCountyId(countyId);
          render();
        });
      }
      const ok = await loadRecords();
      if (!ok) {
        host.innerHTML = "<p>The garden could not read your Life Atlas on this device. Your records are untouched; the beds return when the Atlas does.</p>";
        return;
      }
      render();
    }

    if (typeof document !== "undefined") {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => { void init(); });
      } else {
        void init();
      }
    }

    return {
      VERSION,
      STAGES,
      HARVEST_WITNESS_MIN,
      SUBTYPES: Object.freeze({
        PLANT: PLANT_SUBTYPE,
        WITNESS: WITNESS_SUBTYPE,
        SEED: SEED_SUBTYPE,
        RETURN: RETURN_SUBTYPE,
        KEEPSAKE: KEEPSAKE_SUBTYPE,
        OLD_PASS: OLD_PASS_SUBTYPE
      }),
      moonSpan,
      bedIdFor,
      isPastMoon,
      isCurrentMoon,
      cropWindows,
      plantableForSpan,
      DEFAULT_COUNTY_ID,
      COUNTY_STORAGE_KEY,
      resolveCountyId,
      METHOD_LABELS,
      stageFor,
      foldGarden,
      countOldPasses,
      seedFindFor,
      buildPlantRecord,
      buildWitnessRecord,
      buildKeepsakeRecord,
      buildSeedRecord,
      buildReturnRecord,
      coordinateForInstant,
      coordinateLabel,
      isPatternRecord,
      gardenPayload
    };
  }
);
