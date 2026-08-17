/**
 * Codex Life Atlas — Temporal World Model
 *
 * Spatial hierarchy for the flyable Living Time World.
 *
 * YEAR is the scale represented by the existing Living Time Sphere.
 *
 * Inward:
 * year -> moon -> week -> day -> hour -> event -> record
 *
 * Outward:
 * year -> multi-year -> lifetime -> collective -> global
 *
 * This module:
 * - does NOT render
 * - does NOT own calendar math
 * - does NOT replace SOFTemporalCursor
 * - describes canonical temporal objects in spatial coordinates
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  root.CodexLifeAtlasWorldModel = factory();
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function () {
    "use strict";

    const VERSION = "1.0.0";

    const LEVELS = Object.freeze([
      "global",
      "collective",
      "lifetime",
      "multi-year",
      "year",
      "moon",
      "week",
      "day",
      "hour",
      "event",
      "record"
    ]);

    const LEVEL_INDEX = Object.freeze(
      LEVELS.reduce((result, level, index) => {
        result[level] = index;
        return result;
      }, {})
    );

    const DEFAULTS = Object.freeze({
      yearRadius: 1,
      yearHelixRadius: 4.25,
      yearHelixRise: 1.2,
      yearAngularStep: Math.PI / 3.1,

      moonOrbitRadius: 2.5,
      moonRadius: 0.72,

      weekOrbitRadius: 1.38,
      weekRadius: 0.34,

      dayOrbitRadius: 1.72,
      dayRadius: 0.18,

      hourOrbitRadius: 1.12,
      hourRadius: 0.07,

      eventOrbitRadius: 1.22,
      eventRadius: 0.09,

      recordOrbitRadius: 0.52,
      recordRadius: 0.035
    });

    function finite(value, fallback = 0) {
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    }

    function clamp(value, minimum, maximum) {
      return Math.min(
        maximum,
        Math.max(minimum, finite(value))
      );
    }

    function addVectors(a = {}, b = {}) {
      return {
        x: finite(a.x) + finite(b.x),
        y: finite(a.y) + finite(b.y),
        z: finite(a.z) + finite(b.z)
      };
    }

    function distanceBetween(a = {}, b = {}) {
      return Math.hypot(
        finite(a.x) - finite(b.x),
        finite(a.y) - finite(b.y),
        finite(a.z) - finite(b.z)
      );
    }

    function angleForIndex(index, count, offset = 0) {
      if (!Number.isFinite(Number(count)) || Number(count) <= 0) {
        return offset;
      }

      return (
        offset +
        (
          Math.PI *
          2 *
          finite(index)
        ) /
          Number(count)
      );
    }

    function pointOnRing(radius, angle, y = 0) {
      return {
        x: Math.cos(angle) * finite(radius),
        y: finite(y),
        z: Math.sin(angle) * finite(radius)
      };
    }

    function pointOnSphere(radius, theta, phi) {
      const r = finite(radius);

      return {
        x:
          r *
          Math.sin(phi) *
          Math.cos(theta),

        y:
          r *
          Math.cos(phi),

        z:
          r *
          Math.sin(phi) *
          Math.sin(theta)
      };
    }

    function parentLevel(level) {
      const index = LEVEL_INDEX[level];

      if (
        index === undefined ||
        index <= 0
      ) {
        return null;
      }

      return LEVELS[index - 1];
    }

    function childLevel(level) {
      const index = LEVEL_INDEX[level];

      if (
        index === undefined ||
        index >= LEVELS.length - 1
      ) {
        return null;
      }

      return LEVELS[index + 1];
    }

    function yearWorldPosition(
      year,
      anchorYear,
      options = {}
    ) {
      const config = {
        ...DEFAULTS,
        ...options
      };

      const delta =
        finite(year) -
        finite(anchorYear);

      const angle =
        delta *
        config.yearAngularStep;

      return {
        ...pointOnRing(
          config.yearHelixRadius,
          angle,
          delta *
            config.yearHelixRise
        ),

        year: finite(year),
        anchorYear: finite(anchorYear),
        delta
      };
    }

    function moonWorldPosition(
      moon,
      parentPosition = {},
      options = {}
    ) {
      const config = {
        ...DEFAULTS,
        ...options
      };

      const value =
        clamp(
          Math.round(
            finite(moon, 1)
          ),
          1,
          13
        );

      const angle =
        angleForIndex(
          value - 1,
          13,
          -Math.PI / 2
        );

      return addVectors(
        parentPosition,
        pointOnRing(
          config.moonOrbitRadius,
          angle
        )
      );
    }

    function weekWorldPosition(
      week,
      parentPosition = {},
      options = {}
    ) {
      const config = {
        ...DEFAULTS,
        ...options
      };

      const value =
        clamp(
          Math.round(
            finite(week, 1)
          ),
          1,
          4
        );

      const angle =
        angleForIndex(
          value - 1,
          4,
          -Math.PI / 2
        );

      return addVectors(
        parentPosition,
        pointOnRing(
          config.weekOrbitRadius,
          angle
        )
      );
    }

    function dayWorldPosition(
      day,
      parentPosition = {},
      options = {}
    ) {
      const config = {
        ...DEFAULTS,
        ...options
      };

      const value =
        clamp(
          Math.round(
            finite(day, 1)
          ),
          1,
          28
        );

      const angle =
        angleForIndex(
          value - 1,
          28,
          -Math.PI / 2
        );

      return addVectors(
        parentPosition,
        pointOnRing(
          config.dayOrbitRadius,
          angle
        )
      );
    }

    function hourWorldPosition(
      hour,
      parentPosition = {},
      options = {}
    ) {
      const config = {
        ...DEFAULTS,
        ...options
      };

      const value =
        clamp(
          Math.floor(
            finite(hour)
          ),
          0,
          23
        );

      const angle =
        angleForIndex(
          value,
          24,
          -Math.PI / 2
        );

      return addVectors(
        parentPosition,
        pointOnRing(
          config.hourOrbitRadius,
          angle
        )
      );
    }

    function eventWorldPosition(
      index,
      count,
      parentPosition = {},
      options = {}
    ) {
      const config = {
        ...DEFAULTS,
        ...options
      };

      const safeCount =
        Math.max(
          1,
          Math.round(
            finite(count, 1)
          )
        );

      const angle =
        angleForIndex(
          finite(index),
          safeCount,
          -Math.PI / 2
        );

      return addVectors(
        parentPosition,
        pointOnRing(
          config.eventOrbitRadius,
          angle,
          Math.sin(angle * 2) * 0.12
        )
      );
    }

    function recordWorldPosition(
      index,
      count,
      parentPosition = {},
      options = {}
    ) {
      const config = {
        ...DEFAULTS,
        ...options
      };

      const safeCount =
        Math.max(
          1,
          Math.round(
            finite(count, 1)
          )
        );

      const normalizedIndex =
        clamp(
          Math.floor(
            finite(index)
          ),
          0,
          safeCount - 1
        );

      const theta =
        angleForIndex(
          normalizedIndex,
          safeCount
        );

      const phi =
        Math.acos(
          1 -
          (
            2 *
            (
              normalizedIndex +
              0.5
            )
          ) /
            safeCount
        );

      return addVectors(
        parentPosition,
        pointOnSphere(
          config.recordOrbitRadius,
          theta,
          phi
        )
      );
    }

    function semanticBand(cameraDistance) {
      const distance =
        finite(
          cameraDistance,
          10
        );

      if (distance >= 24) return "global";
      if (distance >= 18) return "collective";
      if (distance >= 13.5) return "lifetime";
      if (distance >= 9.5) return "multi-year";
      if (distance >= 6.2) return "year";
      if (distance >= 4.15) return "moon";
      if (distance >= 3.05) return "week";
      if (distance >= 2.05) return "day";
      if (distance >= 1.4) return "hour";
      if (distance >= 0.78) return "event";

      return "record";
    }

    function visibilityForLevel(level) {
      const index =
        LEVEL_INDEX[level];

      if (index === undefined) {
        return {
          level: null,
          visibleLevels: []
        };
      }

      const visible = [];

      for (
        let i =
          Math.max(
            0,
            index - 1
          );
        i <=
        Math.min(
          LEVELS.length - 1,
          index + 1
        );
        i += 1
      ) {
        visible.push(
          LEVELS[i]
        );
      }

      return {
        level,
        visibleLevels:
          visible
      };
    }

    function createWorldNode({
      id,
      level,
      type = null,
      parentId = null,
      position = {},
      radius = 1,
      temporal = {},
      metadata = {}
    } = {}) {
      if (!id) {
        throw new Error(
          "World node id is required."
        );
      }

      if (!LEVELS.includes(level)) {
        throw new Error(
          `Unknown world level: ${level}`
        );
      }

      return {
        id: String(id),

        level,

        type:
          type ||
          `${level}-field`,

        parentId:
          parentId
            ? String(parentId)
            : null,

        position: {
          x: finite(position.x),
          y: finite(position.y),
          z: finite(position.z)
        },

        radius:
          Math.max(
            0.001,
            finite(radius, 1)
          ),

        temporal: {
          ...temporal
        },

        metadata: {
          ...metadata
        }
      };
    }

    function buildYearField({
      years = [],
      anchorYear,
      options = {}
    } = {}) {
      const uniqueYears =
        [
          ...new Set(
            years
              .map(Number)
              .filter(
                Number.isFinite
              )
          )
        ].sort(
          (a, b) => a - b
        );

      return uniqueYears.map(
        year =>
          createWorldNode({
            id:
              `year:${year}`,

            level: "year",

            type:
              "year-field",

            position:
              yearWorldPosition(
                year,
                anchorYear,
                options
              ),

            radius:
              options.yearRadius ||
              DEFAULTS.yearRadius,

            temporal: {
              patternYear:
                year
            },

            metadata: {
              isAnchor:
                year ===
                Number(
                  anchorYear
                )
            }
          })
      );
    }

    function buildMoonField({
      year,
      yearPosition = {},
      options = {}
    } = {}) {
      const nodes = [];

      for (
        let moon = 1;
        moon <= 13;
        moon += 1
      ) {
        nodes.push(
          createWorldNode({
            id:
              `year:${year}:moon:${moon}`,

            level: "moon",

            type:
              "moon-field",

            parentId:
              `year:${year}`,

            position:
              moonWorldPosition(
                moon,
                yearPosition,
                options
              ),

            radius:
              options.moonRadius ||
              DEFAULTS.moonRadius,

            temporal: {
              patternYear:
                Number(year),

              moon
            }
          })
        );
      }

      return nodes;
    }

    function buildWeekField({
      year,
      moon,
      moonPosition = {},
      options = {}
    } = {}) {
      const nodes = [];

      for (
        let week = 1;
        week <= 4;
        week += 1
      ) {
        nodes.push(
          createWorldNode({
            id:
              `year:${year}:moon:${moon}:week:${week}`,

            level: "week",

            type:
              "week-field",

            parentId:
              `year:${year}:moon:${moon}`,

            position:
              weekWorldPosition(
                week,
                moonPosition,
                options
              ),

            radius:
              options.weekRadius ||
              DEFAULTS.weekRadius,

            temporal: {
              patternYear:
                Number(year),

              moon:
                Number(moon),

              week
            }
          })
        );
      }

      return nodes;
    }

    function buildDayField({
      year,
      moon,
      moonPosition = {},
      options = {}
    } = {}) {
      const nodes = [];

      for (
        let day = 1;
        day <= 28;
        day += 1
      ) {
        const patternDay =
          (
            Number(moon) - 1
          ) *
            28 +
          day;

        nodes.push(
          createWorldNode({
            id:
              `year:${year}:moon:${moon}:day:${day}`,

            level: "day",

            type:
              "day-field",

            parentId:
              `year:${year}:moon:${moon}`,

            position:
              dayWorldPosition(
                day,
                moonPosition,
                options
              ),

            radius:
              options.dayRadius ||
              DEFAULTS.dayRadius,

            temporal: {
              patternYear:
                Number(year),

              moon:
                Number(moon),

              moonDay: day,

              patternDay,

              week:
                Math.ceil(
                  day / 7
                )
            }
          })
        );
      }

      return nodes;
    }

    function buildHourField({
      year,
      moon,
      day,
      dayPosition = {},
      options = {}
    } = {}) {
      const nodes = [];

      for (
        let hour = 0;
        hour < 24;
        hour += 1
      ) {
        nodes.push(
          createWorldNode({
            id:
              `year:${year}:moon:${moon}:day:${day}:hour:${hour}`,

            level: "hour",

            type:
              "hour-field",

            parentId:
              `year:${year}:moon:${moon}:day:${day}`,

            position:
              hourWorldPosition(
                hour,
                dayPosition,
                options
              ),

            radius:
              options.hourRadius ||
              DEFAULTS.hourRadius,

            temporal: {
              patternYear:
                Number(year),

              moon:
                Number(moon),

              moonDay:
                Number(day),

              hour
            }
          })
        );
      }

      return nodes;
    }

    return Object.freeze({
      VERSION,

      LEVELS,
      LEVEL_INDEX,
      DEFAULTS,

      finite,
      clamp,

      addVectors,
      distanceBetween,

      angleForIndex,
      pointOnRing,
      pointOnSphere,

      parentLevel,
      childLevel,

      yearWorldPosition,
      moonWorldPosition,
      weekWorldPosition,
      dayWorldPosition,
      hourWorldPosition,
      eventWorldPosition,
      recordWorldPosition,

      semanticBand,
      visibilityForLevel,

      createWorldNode,

      buildYearField,
      buildMoonField,
      buildWeekField,
      buildDayField,
      buildHourField
    });
  }
);
