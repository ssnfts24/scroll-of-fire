/**
 * Shroom Search — the Garden (garden.html, a corner of the Training Grounds)
 *
 * Aaron's spoken design, built on the site's own record pattern:
 *
 *   1. The garden is three mushroom beds. Each bed grows through four
 *      tiers — Spore → Thread → Cap → Bloom — and a bed in Bloom can be
 *      harvested for a pass.
 *   2. Everything the garden knows is a canonical Life Atlas record in
 *      the same repository the Sphere, planner, and calendar read
 *      (CodexLifeAtlasRepository). No garden store, no silo: tends are
 *      type "event" / subtype "garden-tend", tier turns are "event" /
 *      "garden-tier", and a pass is type "artifact" / subtype
 *      "garden-pass" — the schema's type + subtype extension path, the
 *      same one manifest-practice.js uses. Garden records ride the
 *      existing Atlas export/backup unchanged.
 *   3. Growth is folded from records, never from timers:
 *        growth = tends this cycle + practice-rain days
 *      A tend is one real act: at most one per bed per Pattern Day.
 *      Practice rain is the days between a cycle's first and last tend
 *      on which the keeper sealed a Manifest practice session at Teach
 *      (a manifest-practice Atlas record) — real engagement on the
 *      bench watering the garden. Nothing grows while nothing is done,
 *      and nothing ever decays: leave for a moon and the garden is
 *      exactly as it was left.
 *   4. Every record's temporal coordinate is read from PatternCalendar
 *      (the canonical converter), never hand-computed, and persisted
 *      with the Life Atlas convention: temporal.patternYear is the
 *      anchor (alignment) civil year.
 *   5. A pass is a record the keeper holds on this device. The page
 *      says plainly what is true today: passes open nothing yet; the
 *      first door they are planned to open is the Sphere's Day World
 *      (a later build). Nothing about the garden leaves the device,
 *      and this module makes no network calls.
 *
 * The pure functions (foldGarden, tierForGrowth, buildTendRecord,
 * buildTierRecord, buildPassRecord, temporalFromConversion) carry no
 * DOM or storage dependency and are unit-tested in
 * tests/shroom-garden.test.js.
 */
(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.CodexShroomGarden = api;
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function () {
    "use strict";

    const VERSION = "shroom-garden/1.0.0";

    const RECORD_TAG = "shroom-garden";
    const TEND_SUBTYPE = "garden-tend";
    const TIER_SUBTYPE = "garden-tier";
    const PASS_SUBTYPE = "garden-pass";
    const PASS_TYPE = "artifact";
    const EVENT_TYPE = "event";

    /* The Manifest practice loop's subtype — its sealed sessions are
       the garden's rain. Read-only here; the garden never writes one. */
    const PRACTICE_SUBTYPE = "practice-session";

    const BEDS = Object.freeze([
      Object.freeze({ id: "shaded", name: "The Shaded Bed" }),
      Object.freeze({ id: "open", name: "The Open Bed" }),
      Object.freeze({ id: "deep", name: "The Deep Bed" })
    ]);

    const TIERS = Object.freeze([
      Object.freeze({ name: "Spore", glyph: "·" }),
      Object.freeze({ name: "Thread", glyph: "≋" }),
      Object.freeze({ name: "Cap", glyph: "◍" }),
      Object.freeze({ name: "Bloom", glyph: "🍄" })
    ]);

    /* Cumulative growth at which each tier is reached. Tier 0 (Spore)
       is where every cycle begins. */
    const TIER_THRESHOLDS = Object.freeze([0, 2, 5, 9]);

    const TOP_TIER = TIERS.length - 1;

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
    const cleanNullable = RecordHelpers.cleanNullable;
    const finiteOrNull = RecordHelpers.finiteOrNull;
    const temporalFromConversion = RecordHelpers.temporalFromConversion;
    const notifyRecordsChanged = RecordHelpers.notifyRecordsChanged;
    const resolveRepository = RecordHelpers.createRepositoryResolver();

    /* ------------------------- pure helpers ------------------------- */


    

    function bedById(bedId) {
      return BEDS.find(bed => bed.id === bedId) || null;
    }

    function tierForGrowth(growth) {
      const value = Math.max(0, Math.floor(Number(growth) || 0));
      let tier = 0;

      for (let index = 0; index < TIER_THRESHOLDS.length; index += 1) {
        if (value >= TIER_THRESHOLDS[index]) tier = index;
      }

      return tier;
    }

    function nextTierAt(tierIndex) {
      return tierIndex >= TOP_TIER
        ? null
        : TIER_THRESHOLDS[tierIndex + 1];
    }

    function gardenPayload(record) {
      return record?.payload?.shroomGarden || null;
    }

    function isGardenRecord(record, subtype = null) {
      if (!record || typeof record !== "object") return false;
      if (subtype && record.subtype !== subtype) return false;

      return Boolean(
        gardenPayload(record) ||
        (Array.isArray(record.tags) && record.tags.includes(RECORD_TAG))
      );
    }

    function recordInstant(record) {
      return (
        record?.temporal?.instant ||
        record?.createdAt ||
        record?.temporal?.civilDate ||
        ""
      );
    }

    function byInstant(a, b) {
      const left = String(recordInstant(a));
      const right = String(recordInstant(b));

      if (left < right) return -1;
      if (left > right) return 1;
      return String(a?.id || "").localeCompare(String(b?.id || ""));
    }

    /**
     * Fold one bed's state from records alone.
     *
     * Cycle: passes are counted per bed; the current cycle is
     * passes + 1, and tend/tier records carry the cycle they belong
     * to, so the fold never has to guess where a cycle turns.
     *
     * Rain: the distinct civil dates, from the cycle's first tend day
     * through its last tend day inclusive, on which a practice session
     * was sealed. Practice after the last tend is not lost — it rains
     * when the keeper next tends and the window extends to meet it.
     */
    function foldBed(gardenRecords, practiceRecords, bedId) {
      const bed = bedById(bedId);
      const records = (Array.isArray(gardenRecords) ? gardenRecords : [])
        .filter(record => gardenPayload(record)?.bedId === bedId)
        .sort(byInstant);

      const passes = records.filter(
        record => record.subtype === PASS_SUBTYPE
      );

      const cycle = passes.length + 1;

      const tends = records.filter(
        record =>
          record.subtype === TEND_SUBTYPE &&
          gardenPayload(record)?.cycle === cycle
      );

      const tierRecords = records.filter(
        record =>
          record.subtype === TIER_SUBTYPE &&
          gardenPayload(record)?.cycle === cycle
      );

      const recordedTier = tierRecords.reduce((max, record) => {
        const tier = finiteOrNull(gardenPayload(record)?.tierIndex);
        return tier === null ? max : Math.max(max, tier);
      }, 0);

      const tendDays = tends
        .map(record => record.temporal?.civilDate)
        .filter(Boolean)
        .sort();

      const firstTendDay = tendDays.length ? tendDays[0] : null;
      const lastTendDay = tendDays.length
        ? tendDays[tendDays.length - 1]
        : null;

      let rainDays = 0;

      if (firstTendDay && lastTendDay) {
        const rain = new Set();

        for (const record of Array.isArray(practiceRecords)
          ? practiceRecords
          : []) {
          const day = record?.temporal?.civilDate;
          if (day && day >= firstTendDay && day <= lastTendDay) {
            rain.add(day);
          }
        }

        rainDays = rain.size;
      }

      const growth = tends.length + rainDays;
      const tierIndex = tierForGrowth(growth);

      const pendingTiers = [];
      for (let tier = recordedTier + 1; tier <= tierIndex; tier += 1) {
        pendingTiers.push(tier);
      }

      return {
        bedId,
        name: bed ? bed.name : bedId,
        cycle,
        tends: tends.length,
        rainDays,
        growth,
        tierIndex,
        tierName: TIERS[tierIndex].name,
        recordedTier,
        pendingTiers,
        nextTierAt: nextTierAt(tierIndex),
        canHarvest: tierIndex >= TOP_TIER,
        completedCycles: passes.length
      };
    }

    function foldGarden(gardenRecords = [], practiceRecords = []) {
      const records = (
        Array.isArray(gardenRecords) ? gardenRecords : []
      ).filter(record => isGardenRecord(record));

      const beds = BEDS.map(bed =>
        foldBed(records, practiceRecords, bed.id)
      );

      const passes = records
        .filter(record => record.subtype === PASS_SUBTYPE)
        .sort(byInstant)
        .reverse()
        .map(record => {
          const payload = gardenPayload(record) || {};
          const bed = bedById(payload.bedId);

          return {
            recordId: record.id || null,
            bedId: payload.bedId || null,
            bedName: bed ? bed.name : payload.bedId || "A bed",
            cycle: finiteOrNull(payload.cycle),
            status: cleanText(payload.status, 40) || "held",
            civilDate: record.temporal?.civilDate || null,
            coordinate: coordinateLabel(record.temporal || null)
          };
        });

      return { beds, passes };
    }

    function tendedOn(gardenRecords = [], bedId, civilDate) {
      if (!civilDate) return false;

      return (Array.isArray(gardenRecords) ? gardenRecords : []).some(
        record =>
          record.subtype === TEND_SUBTYPE &&
          gardenPayload(record)?.bedId === bedId &&
          record.temporal?.civilDate === civilDate
      );
    }

    /* --------------------- temporal (canonical) --------------------- */


    function coordinateForInstant(
      instant = new Date(),
      options = {},
      patternCalendar = null
    ) {
      const calendar =
        patternCalendar ||
        (typeof globalThis !== "undefined"
          ? globalThis.PatternCalendar
          : null);

      if (!calendar?.fromCivilDate) {
        return null;
      }

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

      const moon =
        temporal.moon !== null && temporal.moon !== undefined
          ? `Moon ${temporal.moon}`
          : "Moon —";

      const day =
        temporal.moonDay !== null && temporal.moonDay !== undefined
          ? `Day ${temporal.moonDay}`
          : "Day —";

      return `${moon} · ${day} · Pattern Day ${temporal.patternDay}`;
    }

    /* ------------------------- record builders ---------------------- */

    function baseRecord({ type, subtype, title, summary, temporal, extraTags, payload }) {
      return {
        type,
        subtype,

        title,
        summary: summary || "",

        temporal: temporal || {},

        tags: [RECORD_TAG, ...(extraTags || [])],

        provenance: {
          sourceType: "shroom-garden",
          sourceId: "garden.html",
          calculationAuthority: "PatternCalendar"
        },

        privacy: {
          visibility: "private",
          containsPersonalData: true,
          shareAllowed: false
        },

        payload: {
          shroomGarden: payload
        }
      };
    }

    function buildTendRecord(input = {}, temporal = null) {
      const bed = bedById(input.bedId);
      const cycle = Math.max(1, Math.floor(Number(input.cycle) || 1));

      return baseRecord({
        type: EVENT_TYPE,
        subtype: TEND_SUBTYPE,
        title: `Tended ${bed ? bed.name : "a bed"} — garden cycle ${cycle}`,
        summary:
          "One tend in the Shroom Search garden. Growth is counted from tends and practice-rain days, never from timers.",
        temporal,
        extraTags: ["garden-tend"],
        payload: {
          version: 1,
          action: "tend",
          bedId: bed ? bed.id : cleanText(input.bedId, 40),
          cycle
        }
      });
    }

    function buildTierRecord(input = {}, temporal = null) {
      const bed = bedById(input.bedId);
      const cycle = Math.max(1, Math.floor(Number(input.cycle) || 1));
      const tierIndex = Math.max(
        0,
        Math.min(TOP_TIER, Math.floor(Number(input.tierIndex) || 0))
      );

      return baseRecord({
        type: EVENT_TYPE,
        subtype: TIER_SUBTYPE,
        title: `${bed ? bed.name : "A bed"} turned ${TIERS[tierIndex].name} — garden cycle ${cycle}`,
        summary: `The bed reached the ${TIERS[tierIndex].name} tier, counted from its tends and practice-rain days.`,
        temporal,
        extraTags: ["garden-tier"],
        payload: {
          version: 1,
          action: "tier",
          bedId: bed ? bed.id : cleanText(input.bedId, 40),
          cycle,
          tierIndex,
          tierName: TIERS[tierIndex].name
        }
      });
    }

    function buildPassRecord(input = {}, temporal = null) {
      const bed = bedById(input.bedId);
      const cycle = Math.max(1, Math.floor(Number(input.cycle) || 1));

      return baseRecord({
        type: PASS_TYPE,
        subtype: PASS_SUBTYPE,
        title: `Garden pass — harvested from ${bed ? bed.name : "a bed"}, cycle ${cycle}`,
        summary:
          "A pass earned in the Shroom Search garden, held in the keeper's Life Atlas on this device. Passes are planned to open the Sphere's Day World first; until that door is built, a pass is held, and nothing about it leaves this device.",
        temporal,
        extraTags: ["garden-pass"],
        payload: {
          version: 1,
          action: "harvest",
          bedId: bed ? bed.id : cleanText(input.bedId, 40),
          cycle,
          status: "held",
          earnedBy: "bloom-harvest"
        }
      });
    }


    
    let gardenRecords = [];
    let practiceRecords = [];
    let state = null;
    let todayTemporal = null;

    async function loadRecords() {
      const repository = await resolveRepository();
      if (!repository) return false;

      try {
        const [tends, tiers, passes, practice] = await Promise.all([
          repository.query({ subtype: TEND_SUBTYPE }),
          repository.query({ subtype: TIER_SUBTYPE }),
          repository.query({ subtype: PASS_SUBTYPE }),
          repository.query({ subtype: PRACTICE_SUBTYPE })
        ]);

        gardenRecords = [...tends, ...tiers, ...passes];
        practiceRecords = practice;
        state = foldGarden(gardenRecords, practiceRecords);
        return true;
      } catch {
        return false;
      }
    }

    /**
     * A tier turn is an event the records prove. When the fold shows a
     * bed past a tier no tier record names yet (its last tend, or rain
     * counted since), the turn is written, stamped with today — the
     * garden witnessing its own growth, in the open.
     */
    async function reconcileTierRecords() {
      const repository = await resolveRepository();
      if (!repository || !state) return;

      const temporal = coordinateForInstant(new Date());
      let wrote = false;

      for (const bed of state.beds) {
        for (const tierIndex of bed.pendingTiers) {
          try {
            await repository.put(
              buildTierRecord(
                { bedId: bed.bedId, cycle: bed.cycle, tierIndex },
                temporal
              )
            );
            wrote = true;
          } catch {
            /* A missed marker never blocks the garden. */
          }
        }
      }

      if (wrote) {
        notifyRecordsChanged({ source: "shroom-garden", kind: "tier" });
        await loadRecords();
      }
    }

    function setStatus(message) {
      if (typeof document === "undefined") return;

      const el = document.getElementById("garden-status");
      if (el) el.textContent = message;
    }

    function render() {
      if (typeof document === "undefined" || !state) return;

      todayTemporal = coordinateForInstant(new Date());
      const todayCivil = todayTemporal?.civilDate || null;

      const coords = document.getElementById("garden-today-coords");
      if (coords) {
        coords.textContent = todayTemporal
          ? `${todayTemporal.civilDate || ""} · ${coordinateLabel(todayTemporal)}`
          : "Today's coordinate is unavailable";
      }

      const tendedCount = state.beds.filter(bed =>
        tendedOn(gardenRecords, bed.bedId, todayCivil)
      ).length;

      const todayCount = document.getElementById("garden-today-count");
      if (todayCount) {
        todayCount.textContent =
          tendedCount === 0
            ? "No beds tended yet today"
            : `${tendedCount} of ${state.beds.length} beds tended today`;
      }

      const host = document.getElementById("garden-beds");
      if (host) {
        host.replaceChildren();

        for (const bed of state.beds) {
          const tier = TIERS[bed.tierIndex];
          const tendedToday = tendedOn(
            gardenRecords,
            bed.bedId,
            todayCivil
          );

          const card = document.createElement("article");
          card.className = "garden-bed";
          card.dataset.bedId = bed.bedId;

          const glyph = document.createElement("p");
          glyph.className =
            "garden-bed-glyph" +
            (bed.tierIndex >= TOP_TIER ? " garden-bed-glyph-bloom" : "");
          glyph.setAttribute("aria-hidden", "true");
          glyph.textContent = tier.glyph;
          card.appendChild(glyph);

          const name = document.createElement("h3");
          name.textContent = bed.name;
          card.appendChild(name);

          const tierLine = document.createElement("p");
          tierLine.className = "garden-bed-tier";
          tierLine.textContent =
            `Tier: ${bed.tierName} · Cycle ${bed.cycle}` +
            (bed.completedCycles
              ? ` · ${bed.completedCycles} harvest${bed.completedCycles === 1 ? "" : "s"} before`
              : "");
          card.appendChild(tierLine);

          const growthLine = document.createElement("p");
          growthLine.className = "garden-bed-growth";
          growthLine.textContent =
            `Growth ${bed.growth} — ${bed.tends} tend${bed.tends === 1 ? "" : "s"} · ${bed.rainDays} practice-rain day${bed.rainDays === 1 ? "" : "s"}` +
            (bed.nextTierAt === null
              ? " · in full Bloom"
              : ` · next tier at ${bed.nextTierAt}`);
          card.appendChild(growthLine);

          const tendButton = document.createElement("button");
          tendButton.type = "button";
          tendButton.className = "garden-btn";
          tendButton.dataset.gardenTend = bed.bedId;
          tendButton.disabled = tendedToday;
          tendButton.textContent = tendedToday
            ? "Tended today ✓"
            : "Tend this bed";
          tendButton.addEventListener("click", () => {
            void tend(bed.bedId);
          });
          card.appendChild(tendButton);

          if (tendedToday) {
            const rest = document.createElement("p");
            rest.className = "garden-bed-note";
            rest.textContent =
              "This bed rests until the next Pattern Day.";
            card.appendChild(rest);
          }

          if (bed.canHarvest) {
            const harvestButton = document.createElement("button");
            harvestButton.type = "button";
            harvestButton.className = "garden-btn garden-btn-harvest";
            harvestButton.dataset.gardenHarvest = bed.bedId;
            harvestButton.textContent = "Harvest — earn a pass";
            harvestButton.addEventListener("click", () => {
              void harvest(bed.bedId);
            });
            card.appendChild(harvestButton);
          }

          host.appendChild(card);
        }
      }

      const passHost = document.getElementById("garden-passes");
      const passEmpty = document.getElementById("garden-passes-empty");

      if (passHost) {
        passHost.replaceChildren();

        for (const pass of state.passes) {
          const item = document.createElement("li");
          item.className = "garden-pass";

          const main = document.createElement("span");
          main.className = "garden-pass-main";
          main.textContent =
            `Pass — from ${pass.bedName}, cycle ${pass.cycle ?? "—"} · earned ${pass.civilDate || "on an unstamped day"} · ${pass.coordinate}`;
          item.appendChild(main);

          const held = document.createElement("span");
          held.className = "garden-pass-held";
          held.textContent = "Held on this device";
          item.appendChild(held);

          passHost.appendChild(item);
        }

        if (passEmpty) {
          passEmpty.hidden = state.passes.length > 0;
        }
      }
    }

    async function refresh() {
      const ok = await loadRecords();

      if (!ok) {
        setStatus(
          "The Life Atlas was unavailable, so the garden could not be read. Your records are untouched."
        );
        return;
      }

      await reconcileTierRecords();
      render();
    }

    async function tend(bedId) {
      const repository = await resolveRepository();

      if (!repository) {
        setStatus(
          "The Life Atlas was unavailable, so this tend was not recorded."
        );
        return;
      }

      const temporal = coordinateForInstant(new Date());

      if (tendedOn(gardenRecords, bedId, temporal?.civilDate)) {
        setStatus(
          "This bed is already tended today. It rests until the next Pattern Day."
        );
        return;
      }

      const bed = state?.beds.find(entry => entry.bedId === bedId);
      const cycle = bed ? bed.cycle : 1;

      const saved = await repository.put(
        buildTendRecord({ bedId, cycle }, temporal)
      );

      notifyRecordsChanged({
        source: "shroom-garden",
        kind: "tend",
        recordId: saved.id
      });

      await loadRecords();
      await reconcileTierRecords();
      render();

      const after = state?.beds.find(entry => entry.bedId === bedId);
      const turned =
        after && bed && after.tierIndex > bed.tierIndex
          ? ` The bed turned ${after.tierName}.`
          : "";

      setStatus(
        `Tended — ${coordinateLabel(temporal)}.` +
          turned +
          (after
            ? ` The bed stands at ${after.tierName}, growth ${after.growth}.`
            : "")
      );
    }

    async function harvest(bedId) {
      const repository = await resolveRepository();

      if (!repository) {
        setStatus(
          "The Life Atlas was unavailable, so this harvest was not recorded."
        );
        return;
      }

      const bed = state?.beds.find(entry => entry.bedId === bedId);

      if (!bed || !bed.canHarvest) {
        setStatus("This bed is not in Bloom yet, so there is nothing to harvest.");
        return;
      }

      const temporal = coordinateForInstant(new Date());

      const saved = await repository.put(
        buildPassRecord({ bedId, cycle: bed.cycle }, temporal)
      );

      notifyRecordsChanged({
        source: "shroom-garden",
        kind: "pass",
        recordId: saved.id
      });

      await loadRecords();
      render();

      setStatus(
        `Harvested — ${coordinateLabel(temporal)}. A pass was added to your Life Atlas record, held on this device. The bed begins again at Spore.`
      );
    }

    function init() {
      if (typeof document === "undefined") return;

      void refresh();

      document.addEventListener(
        "sof:life-atlas-records-changed",
        event => {
          if (event?.detail?.source === "shroom-garden") return;
          void refresh();
        }
      );
    }

    if (typeof document !== "undefined") {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
      } else {
        init();
      }
    }

    return Object.freeze({
      VERSION,

      RECORD_TAG,
      TEND_SUBTYPE,
      TIER_SUBTYPE,
      PASS_SUBTYPE,
      PASS_TYPE,
      PRACTICE_SUBTYPE,
      BEDS,
      TIERS,
      TIER_THRESHOLDS,
      TOP_TIER,

      tierForGrowth,
      nextTierAt,
      isGardenRecord,
      foldBed,
      foldGarden,
      tendedOn,

      buildTendRecord,
      buildTierRecord,
      buildPassRecord,

      temporalFromConversion,
      coordinateForInstant,
      coordinateLabel,

      tend,
      harvest,
      refresh
    });
  }
);
