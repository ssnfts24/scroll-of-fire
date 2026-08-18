(function (root, factory) {
  const api = factory();

  if (
    typeof module === "object"
    && module.exports
  ) {
    module.exports = api;
  }

  root.LivingTimeSphereTemporalLegibility = api;

})(
  typeof globalThis !== "undefined"
    ? globalThis
    : this,

  function () {
    "use strict";

    const VERSION =
      "temporal-legibility/1.0.0";

    const BANDS = Object.freeze({
      FAR: "far",
      MEDIUM: "medium",
      NEAR: "near",
      DETAIL: "detail"
    });

    const BAND_RULES = Object.freeze({
      far: Object.freeze({
        nearYears: 0,
        minInterval: 10,
        showAllEvidenceYears: true,
        showWindowEdges: true,
        recordBudgetMultiplier: 0.18
      }),

      medium: Object.freeze({
        nearYears: 1,
        minInterval: 5,
        showAllEvidenceYears: true,
        showWindowEdges: true,
        recordBudgetMultiplier: 0.38
      }),

      near: Object.freeze({
        nearYears: 3,
        minInterval: 2,
        showAllEvidenceYears: true,
        showWindowEdges: true,
        recordBudgetMultiplier: 0.7
      }),

      detail: Object.freeze({
        nearYears: 8,
        minInterval: 1,
        showAllEvidenceYears: true,
        showWindowEdges: true,
        recordBudgetMultiplier: 1
      })
    });

    function normalizeBand(value) {
      const band = String(
        value || ""
      ).toLowerCase();

      return BAND_RULES[band]
        ? band
        : BANDS.MEDIUM;
    }

    function normalizeTier(value) {
      const tier = String(
        value || ""
      ).toLowerCase();

      if (
        tier === "low"
        || tier === "medium"
        || tier === "high"
      ) {
        return tier;
      }

      return "high";
    }

    function normalizeYear(value) {
      const year = Math.trunc(
        Number(value)
      );

      return Number.isFinite(year)
        ? year
        : null;
    }

    function clampIntervalForSpan(
      interval,
      span,
      tier
    ) {
      let result = Math.max(
        1,
        Math.trunc(
          Number(interval) || 1
        )
      );

      const count = Math.max(
        1,
        Math.trunc(
          Number(span) || 1
        )
      );

      if (count >= 200) {
        result = Math.max(
          result,
          tier === "low"
            ? 20
            : 10
        );
      } else if (count >= 100) {
        result = Math.max(
          result,
          tier === "low"
            ? 10
            : 5
        );
      } else if (
        count >= 50
        && tier === "low"
      ) {
        result = Math.max(
          result,
          5
        );
      }

      return result;
    }

    function recordBudget({
      tier = "high",
      band = "medium",
      baseBudget
    } = {}) {
      const resolvedTier =
        normalizeTier(tier);

      const resolvedBand =
        normalizeBand(band);

      const tierBase =
        Number.isFinite(
          Number(baseBudget)
        )
          ? Math.max(
              0,
              Math.trunc(
                Number(baseBudget)
              )
            )
          : (
              resolvedTier === "low"
                ? 220
                : resolvedTier === "medium"
                  ? 500
                  : 900
            );

      const multiplier =
        BAND_RULES[
          resolvedBand
        ].recordBudgetMultiplier;

      return Math.max(
        24,
        Math.round(
          tierBase
          * multiplier
        )
      );
    }

    function resolve({
      window,
      selectedYear,
      band = "medium",
      tier = "high",
      evidenceYears = []
    } = {}) {
      if (
        !window
        || !Array.isArray(
          window.years
        )
        || !window.years.length
      ) {
        return Object.freeze({
          version: VERSION,
          band:
            normalizeBand(
              band
            ),
          tier:
            normalizeTier(
              tier
            ),
          selectedYear:
            normalizeYear(
              selectedYear
            ),
          interval: 1,
          analyticalYears:
            Object.freeze([]),
          visibleYears:
            Object.freeze([]),
          visibleYearSet:
            Object.freeze([]),
          hiddenYearCount: 0,
          recordBudget:
            recordBudget({
              tier,
              band
            })
        });
      }

      const resolvedBand =
        normalizeBand(band);

      const resolvedTier =
        normalizeTier(tier);

      const rule =
        BAND_RULES[
          resolvedBand
        ];

      const years =
        window.years
          .map(
            normalizeYear
          )
          .filter(
            Number.isFinite
          );

      const reference =
        normalizeYear(
          selectedYear
        )
        ?? normalizeYear(
          window.reference
        )
        ?? years[
          years.length - 1
        ];

      const evidence =
        new Set(
          evidenceYears
            .map(
              normalizeYear
            )
            .filter(
              Number.isFinite
            )
        );

      const interval =
        clampIntervalForSpan(
          rule.minInterval,
          years.length,
          resolvedTier
        );

      const visible =
        new Set();

      const addIfPresent = (
        year
      ) => {
        if (
          years.includes(
            year
          )
        ) {
          visible.add(
            year
          );
        }
      };

      addIfPresent(
        reference
      );

      if (
        rule.showWindowEdges
      ) {
        addIfPresent(
          years[0]
        );

        addIfPresent(
          years[
            years.length - 1
          ]
        );
      }

      for (
        let delta =
          -rule.nearYears;
        delta <=
          rule.nearYears;
        delta += 1
      ) {
        addIfPresent(
          reference
          + delta
        );
      }

      for (
        const year of years
      ) {
        if (
          Math.abs(
            year
            - reference
          )
          % interval
          === 0
        ) {
          visible.add(
            year
          );
        }
      }

      if (
        rule.showAllEvidenceYears
      ) {
        for (
          const year of evidence
        ) {
          addIfPresent(
            year
          );
        }
      }

      const visibleYears =
        years.filter(
          year =>
            visible.has(
              year
            )
        );

      return Object.freeze({
        version:
          VERSION,

        band:
          resolvedBand,

        tier:
          resolvedTier,

        selectedYear:
          reference,

        interval,

        analyticalYears:
          Object.freeze(
            years.slice()
          ),

        visibleYears:
          Object.freeze(
            visibleYears
          ),

        visibleYearSet:
          Object.freeze(
            visibleYears.slice()
          ),

        analyticalYearCount:
          years.length,

        visibleYearCount:
          visibleYears.length,

        hiddenYearCount:
          Math.max(
            0,
            years.length
            - visibleYears.length
          ),

        nearYears:
          rule.nearYears,

        evidenceYearCount:
          Array.from(
            evidence
          ).filter(
            year =>
              years.includes(
                year
              )
          ).length,

        recordBudget:
          recordBudget({
            tier:
              resolvedTier,
            band:
              resolvedBand
          })
      });
    }

    function isYearVisible(
      year,
      result
    ) {
      const normalized =
        normalizeYear(
          year
        );

      if (
        normalized == null
        || !result
      ) {
        return false;
      }

      return (
        result.visibleYears
        || []
      ).includes(
        normalized
      );
    }

    return Object.freeze({
      VERSION,
      BANDS,
      BAND_RULES,
      normalizeBand,
      normalizeTier,
      clampIntervalForSpan,
      recordBudget,
      resolve,
      isYearVisible
    });
  }
);
