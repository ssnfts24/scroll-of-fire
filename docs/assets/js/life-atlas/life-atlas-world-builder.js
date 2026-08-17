/**
 * Codex Life Atlas — World Builder / Level of Detail
 *
 * Builds only the temporal worlds needed near the current focus.
 *
 * Goals:
 * - preserve mobile performance
 * - expand detail as the user flies inward
 * - collapse distant worlds into lighter representations
 * - keep renderer independent
 * - never duplicate canonical temporal truth
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(
      require("./life-atlas-world-model.js"),
      require("./life-atlas-scene-graph.js")
    );
    return;
  }

  root.CodexLifeAtlasWorldBuilder = factory(
    root.CodexLifeAtlasWorldModel,
    root.CodexLifeAtlasSceneGraph
  );
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function (WorldModel, SceneGraph) {
    "use strict";

    if (!WorldModel) {
      throw new Error(
        "CodexLifeAtlasWorldModel is required."
      );
    }

    if (!SceneGraph) {
      throw new Error(
        "CodexLifeAtlasSceneGraph is required."
      );
    }

    const VERSION = "1.0.0";

    const DETAIL = Object.freeze({
      SHELL: "shell",
      CLUSTER: "cluster",
      STRUCTURE: "structure",
      FULL: "full"
    });

    const LEVEL_DETAIL = Object.freeze({
      global: DETAIL.SHELL,
      collective: DETAIL.CLUSTER,
      lifetime: DETAIL.CLUSTER,
      "multi-year": DETAIL.STRUCTURE,
      year: DETAIL.STRUCTURE,
      moon: DETAIL.FULL,
      week: DETAIL.FULL,
      day: DETAIL.FULL,
      hour: DETAIL.FULL,
      event: DETAIL.FULL,
      record: DETAIL.FULL
    });

    function normalizeYears(
      years = [],
      anchorYear
    ) {
      const list = [
        ...new Set(
          years
            .map(Number)
            .filter(Number.isFinite)
        )
      ];

      if (
        Number.isFinite(
          Number(anchorYear)
        ) &&
        !list.includes(
          Number(anchorYear)
        )
      ) {
        list.push(
          Number(anchorYear)
        );
      }

      return list.sort(
        (a, b) => a - b
      );
    }

    function resolveDetail(
      level,
      options = {}
    ) {
      if (
        options.detail &&
        Object.values(DETAIL)
          .includes(
            options.detail
          )
      ) {
        return options.detail;
      }

      return (
        LEVEL_DETAIL[level] ||
        DETAIL.SHELL
      );
    }

    function createBuilder(options = {}) {
      const graph =
        options.graph ||
        SceneGraph.createSceneGraph();

      let buildRevision = 0;

      function ensureNode(
        node
      ) {
        if (!node?.id) {
          return null;
        }

        return graph.addNode(node);
      }

      function ensureNodes(
        nodes = []
      ) {
        return nodes.map(
          ensureNode
        );
      }

      function ensureYearField({
        years = [],
        anchorYear,
        options = {}
      } = {}) {
        const normalizedYears =
          normalizeYears(
            years,
            anchorYear
          );

        const nodes =
          WorldModel.buildYearField({
            years:
              normalizedYears,

            anchorYear,

            options
          });

        ensureNodes(nodes);

        buildRevision += 1;

        return nodes;
      }

      function ensureMoonField({
        year,
        yearPosition = {},
        options = {}
      } = {}) {
        const nodes =
          WorldModel.buildMoonField({
            year,
            yearPosition,
            options
          });

        ensureNodes(nodes);

        buildRevision += 1;

        return nodes;
      }

      function ensureWeekField({
        year,
        moon,
        moonPosition = {},
        options = {}
      } = {}) {
        const nodes =
          WorldModel.buildWeekField({
            year,
            moon,
            moonPosition,
            options
          });

        ensureNodes(nodes);

        buildRevision += 1;

        return nodes;
      }

      function ensureDayField({
        year,
        moon,
        moonPosition = {},
        options = {}
      } = {}) {
        const nodes =
          WorldModel.buildDayField({
            year,
            moon,
            moonPosition,
            options
          });

        ensureNodes(nodes);

        buildRevision += 1;

        return nodes;
      }

      function ensureHourField({
        year,
        moon,
        day,
        dayPosition = {},
        options = {}
      } = {}) {
        const nodes =
          WorldModel.buildHourField({
            year,
            moon,
            day,
            dayPosition,
            options
          });

        ensureNodes(nodes);

        buildRevision += 1;

        return nodes;
      }

      function buildForFocus({
        level,
        focusNode = null,
        years = [],
        anchorYear = null,
        options = {}
      } = {}) {
        const targetLevel =
          WorldModel.LEVELS.includes(
            level
          )
            ? level
            : "year";

        const detail =
          resolveDetail(
            targetLevel,
            options
          );

        const result = {
          level: targetLevel,
          detail,
          created: [],
          visible: [],
          graphStats: null,
          revision: null
        };

        if (
          targetLevel ===
          "global" ||
          targetLevel ===
          "collective" ||
          targetLevel ===
          "lifetime"
        ) {
          result.created =
            ensureYearField({
              years,
              anchorYear,
              options:
                options.worldOptions ||
                {}
            });

          result.visible =
            result.created;

          result.graphStats =
            graph.stats();

          result.revision =
            buildRevision;

          return result;
        }

        if (
          targetLevel ===
          "multi-year"
        ) {
          result.created =
            ensureYearField({
              years,
              anchorYear,
              options:
                options.worldOptions ||
                {}
            });

          result.visible =
            result.created;

          result.graphStats =
            graph.stats();

          result.revision =
            buildRevision;

          return result;
        }

        if (
          targetLevel ===
          "year"
        ) {
          if (
            Number.isFinite(
              Number(
                focusNode?.temporal
                  ?.patternYear
              )
            )
          ) {
            const year =
              Number(
                focusNode.temporal
                  .patternYear
              );

            result.created =
              ensureMoonField({
                year,
                yearPosition:
                  focusNode.position ||
                  {},
                options:
                  options.worldOptions ||
                  {}
              });

            result.visible =
              [
                focusNode,
                ...result.created
              ].filter(Boolean);
          } else {
            result.created =
              ensureYearField({
                years,
                anchorYear,
                options:
                  options.worldOptions ||
                  {}
              });

            result.visible =
              result.created;
          }

          result.graphStats =
            graph.stats();

          result.revision =
            buildRevision;

          return result;
        }

        if (
          targetLevel ===
          "moon"
        ) {
          const year =
            Number(
              focusNode?.temporal
                ?.patternYear
            );

          const moon =
            Number(
              focusNode?.temporal
                ?.moon
            );

          if (
            Number.isFinite(year) &&
            Number.isFinite(moon)
          ) {
            const weekNodes =
              ensureWeekField({
                year,
                moon,
                moonPosition:
                  focusNode.position ||
                  {},
                options:
                  options.worldOptions ||
                  {}
              });

            const dayNodes =
              ensureDayField({
                year,
                moon,
                moonPosition:
                  focusNode.position ||
                  {},
                options:
                  options.worldOptions ||
                  {}
              });

            result.created = [
              ...weekNodes,
              ...dayNodes
            ];

            result.visible = [
              focusNode,
              ...result.created
            ].filter(Boolean);
          }

          result.graphStats =
            graph.stats();

          result.revision =
            buildRevision;

          return result;
        }

        if (
          targetLevel ===
          "day"
        ) {
          const year =
            Number(
              focusNode?.temporal
                ?.patternYear
            );

          const moon =
            Number(
              focusNode?.temporal
                ?.moon
            );

          const day =
            Number(
              focusNode?.temporal
                ?.moonDay
            );

          if (
            Number.isFinite(year) &&
            Number.isFinite(moon) &&
            Number.isFinite(day)
          ) {
            result.created =
              ensureHourField({
                year,
                moon,
                day,
                dayPosition:
                  focusNode.position ||
                  {},
                options:
                  options.worldOptions ||
                  {}
              });

            result.visible = [
              focusNode,
              ...result.created
            ];
          }

          result.graphStats =
            graph.stats();

          result.revision =
            buildRevision;

          return result;
        }

        result.visible =
          focusNode
            ? [focusNode]
            : [];

        result.graphStats =
          graph.stats();

        result.revision =
          buildRevision;

        return result;
      }

      function visibleWindow(
        focusId,
        options = {}
      ) {
        if (!focusId) {
          return [];
        }

        return graph.visibleFrom(
          focusId,
          options
        );
      }

      function pruneExcept(
        ids = []
      ) {
        const keep =
          new Set(
            ids.map(String)
          );

        const all =
          graph.allNodes();

        const candidates =
          all.filter(
            node =>
              !keep.has(
                node.id
              )
          );

        const removable =
          candidates
            .sort(
              (a, b) =>
                WorldModel.LEVEL_INDEX[
                  b.level
                ] -
                WorldModel.LEVEL_INDEX[
                  a.level
                ]
            );

        let removed = 0;

        removable.forEach(
          node => {
            if (
              graph.hasNode(
                node.id
              )
            ) {
              try {
                if (
                  graph.removeNode(
                    node.id,
                    {
                      cascade: false
                    }
                  )
                ) {
                  removed += 1;
                }
              } catch (_) {
                // Parent still owns descendants.
                // It will remain until children
                // are eligible for removal.
              }
            }
          }
        );

        buildRevision += 1;

        return removed;
      }

      function stats() {
        return {
          revision:
            buildRevision,
          graph:
            graph.stats()
        };
      }

      return Object.freeze({
        version: VERSION,

        getGraph() {
          return graph;
        },

        ensureYearField,
        ensureMoonField,
        ensureWeekField,
        ensureDayField,
        ensureHourField,

        buildForFocus,
        visibleWindow,
        pruneExcept,
        stats
      });
    }

    return Object.freeze({
      VERSION,
      DETAIL,
      LEVEL_DETAIL,
      normalizeYears,
      resolveDetail,
      createBuilder
    });
  }
);
