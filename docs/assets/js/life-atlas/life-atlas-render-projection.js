/**
 * Codex Life Atlas — Temporal Render Projection Adapter
 *
 * Converts semantic Life Atlas / Temporal World nodes into
 * renderer-friendly primitives.
 *
 * This module:
 * - does NOT render
 * - does NOT own Three.js objects
 * - does NOT own temporal truth
 * - does NOT own camera/navigation state
 *
 * It describes:
 * - position
 * - scale
 * - opacity
 * - primitive role
 * - label priority
 * - interaction target
 * - connection geometry
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(
      require("./life-atlas-world-model.js")
    );
    return;
  }

  root.CodexLifeAtlasRenderProjection = factory(
    root.CodexLifeAtlasWorldModel
  );
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function (WorldModel) {
    "use strict";

    if (!WorldModel) {
      throw new Error(
        "CodexLifeAtlasWorldModel is required."
      );
    }

    const VERSION = "1.0.0";

    const PRIMITIVE = Object.freeze({
      SHELL: "shell",
      ORBIT: "orbit",
      NODE: "node",
      CLUSTER: "cluster",
      CONNECTION: "connection",
      LABEL: "label"
    });

    const ROLE = Object.freeze({
      GLOBAL: "global-field",
      COLLECTIVE: "collective-field",
      LIFETIME: "lifetime-field",
      YEAR: "year-world",
      MOON: "moon-world",
      WEEK: "week-world",
      DAY: "day-world",
      HOUR: "hour-node",
      EVENT: "event-node",
      RECORD: "record-node"
    });

    const LEVEL_SCALE = Object.freeze({
      global: 4.5,
      collective: 3.6,
      lifetime: 3,
      "multi-year": 2.1,
      year: 1,
      moon: 0.72,
      week: 0.34,
      day: 0.18,
      hour: 0.07,
      event: 0.09,
      record: 0.035
    });

    const LEVEL_LABEL_PRIORITY = Object.freeze({
      global: 100,
      collective: 95,
      lifetime: 90,
      "multi-year": 85,
      year: 80,
      moon: 70,
      week: 60,
      day: 50,
      hour: 35,
      event: 75,
      record: 40
    });

    function finite(
      value,
      fallback = 0
    ) {
      const number =
        Number(value);

      return Number.isFinite(
        number
      )
        ? number
        : fallback;
    }

    function clamp01(value) {
      return Math.min(
        1,
        Math.max(
          0,
          finite(value)
        )
      );
    }

    function vector(input = {}) {
      return {
        x: finite(input.x),
        y: finite(input.y),
        z: finite(input.z)
      };
    }

    function roleForLevel(level) {
      switch (level) {
        case "global":
          return ROLE.GLOBAL;

        case "collective":
          return ROLE.COLLECTIVE;

        case "lifetime":
          return ROLE.LIFETIME;

        case "multi-year":
        case "year":
          return ROLE.YEAR;

        case "moon":
          return ROLE.MOON;

        case "week":
          return ROLE.WEEK;

        case "day":
          return ROLE.DAY;

        case "hour":
          return ROLE.HOUR;

        case "event":
          return ROLE.EVENT;

        case "record":
          return ROLE.RECORD;

        default:
          return "unknown";
      }
    }

    function primitiveForLevel(
      level,
      detail = "full"
    ) {
      if (
        detail === "shell"
      ) {
        return PRIMITIVE.SHELL;
      }

      if (
        detail === "cluster"
      ) {
        return PRIMITIVE.CLUSTER;
      }

      if (
        level === "global" ||
        level === "collective" ||
        level === "lifetime" ||
        level === "multi-year" ||
        level === "year" ||
        level === "moon"
      ) {
        return PRIMITIVE.SHELL;
      }

      if (
        level === "week"
      ) {
        return PRIMITIVE.ORBIT;
      }

      return PRIMITIVE.NODE;
    }

    function scaleForNode(
      node,
      options = {}
    ) {
      const base =
        finite(
          node?.radius,
          LEVEL_SCALE[
            node?.level
          ] || 1
        );

      const emphasis =
        options.selected === true
          ? 1.2
          : options.related === true
            ? 1.08
            : 1;

      return Math.max(
        0.001,
        base * emphasis
      );
    }

    function opacityForNode(
      node,
      options = {}
    ) {
      if (
        options.hidden === true
      ) {
        return 0;
      }

      if (
        options.selected === true
      ) {
        return 1;
      }

      if (
        options.related === true
      ) {
        return 0.92;
      }

      if (
        options.context === true
      ) {
        return 0.42;
      }

      const level =
        node?.level;

      if (
        level === "global" ||
        level === "collective"
      ) {
        return 0.55;
      }

      if (
        level === "lifetime" ||
        level === "multi-year"
      ) {
        return 0.65;
      }

      return 0.82;
    }

    function labelPriorityForNode(
      node,
      options = {}
    ) {
      const base =
        LEVEL_LABEL_PRIORITY[
          node?.level
        ] || 10;

      if (
        options.selected === true
      ) {
        return base + 1000;
      }

      if (
        options.related === true
      ) {
        return base + 100;
      }

      return base;
    }

    function interactionTarget(
      node
    ) {
      return {
        id:
          String(
            node?.id || ""
          ),

        level:
          node?.level || null,

        temporal: {
          ...(
            node?.temporal ||
            {}
          )
        },

        metadata: {
          ...(
            node?.metadata ||
            {}
          )
        }
      };
    }

    function projectNode(
      node,
      options = {}
    ) {
      if (
        !node ||
        !node.id ||
        !node.level
      ) {
        return null;
      }

      const detail =
        options.detail ||
        "full";

      return {
        id:
          String(node.id),

        sourceId:
          String(node.id),

        level:
          node.level,

        role:
          roleForLevel(
            node.level
          ),

        primitive:
          primitiveForLevel(
            node.level,
            detail
          ),

        position:
          vector(
            node.position
          ),

        scale:
          scaleForNode(
            node,
            options
          ),

        opacity:
          opacityForNode(
            node,
            options
          ),

        labelPriority:
          labelPriorityForNode(
            node,
            options
          ),

        selected:
          options.selected === true,

        related:
          options.related === true,

        context:
          options.context === true,

        interactive:
          options.interactive !== false,

        interaction:
          interactionTarget(
            node
          ),

        temporal: {
          ...(
            node.temporal ||
            {}
          )
        },

        metadata: {
          ...(
            node.metadata ||
            {}
          )
        }
      };
    }

    function projectNodes(
      nodes = [],
      options = {}
    ) {
      const selectedId =
        options.selectedId
          ? String(
              options.selectedId
            )
          : null;

      const relatedIds =
        new Set(
          (
            options.relatedIds ||
            []
          ).map(String)
        );

      const contextIds =
        new Set(
          (
            options.contextIds ||
            []
          ).map(String)
        );

      return nodes
        .map(node =>
          projectNode(
            node,
            {
              ...options,

              selected:
                selectedId !== null &&
                String(node.id) ===
                  selectedId,

              related:
                relatedIds.has(
                  String(
                    node.id
                  )
                ),

              context:
                contextIds.has(
                  String(
                    node.id
                  )
                )
            }
          )
        )
        .filter(Boolean);
    }

    function projectConnection(
      edge,
      sourceNode,
      targetNode,
      options = {}
    ) {
      if (
        !edge ||
        !sourceNode ||
        !targetNode
      ) {
        return null;
      }

      const weight =
        Math.max(
          0,
          finite(
            edge.weight,
            1
          )
        );

      return {
        id:
          String(
            edge.id ||
            `${sourceNode.id}->${targetNode.id}`
          ),

        primitive:
          PRIMITIVE.CONNECTION,

        type:
          edge.type ||
          "related",

        sourceId:
          String(
            sourceNode.id
          ),

        targetId:
          String(
            targetNode.id
          ),

        start:
          vector(
            sourceNode.position
          ),

        end:
          vector(
            targetNode.position
          ),

        dashed:
          options.dashed === true ||
          edge.metadata
            ?.dashed === true,

        opacity:
          clamp01(
            options.opacity ??
              (
                0.35 +
                Math.min(
                  0.55,
                  weight * 0.35
                )
              )
          ),

        weight,

        directed:
          edge.directed !== false,

        metadata: {
          ...(
            edge.metadata ||
            {}
          )
        }
      };
    }

    function projectScene({
      nodes = [],
      edges = [],
      selectedId = null,
      relatedIds = [],
      contextIds = [],
      detail = "full"
    } = {}) {
      const nodeMap =
        new Map(
          nodes.map(
            node => [
              String(node.id),
              node
            ]
          )
        );

      const projectedNodes =
        projectNodes(
          nodes,
          {
            selectedId,
            relatedIds,
            contextIds,
            detail
          }
        );

      const projectedEdges =
        edges
          .map(edge => {
            const source =
              nodeMap.get(
                String(
                  edge.sourceId
                )
              );

            const target =
              nodeMap.get(
                String(
                  edge.targetId
                )
              );

            if (
              !source ||
              !target
            ) {
              return null;
            }

            return projectConnection(
              edge,
              source,
              target,
              {
                dashed:
                  edge.type ===
                    "pattern-recurrence" ||
                  edge.type ===
                    "scheduled-link"
              }
            );
          })
          .filter(Boolean);

      return {
        nodes:
          projectedNodes,

        connections:
          projectedEdges,

        stats: {
          nodes:
            projectedNodes.length,

          connections:
            projectedEdges.length
        }
      };
    }

    return Object.freeze({
      VERSION,

      PRIMITIVE,
      ROLE,
      LEVEL_SCALE,
      LEVEL_LABEL_PRIORITY,

      finite,
      clamp01,
      vector,

      roleForLevel,
      primitiveForLevel,

      scaleForNode,
      opacityForNode,
      labelPriorityForNode,

      interactionTarget,

      projectNode,
      projectNodes,
      projectConnection,
      projectScene
    });
  }
);
