/**
 * Codex Life Atlas — Temporal Scene Graph
 *
 * Renderer-independent graph of nested temporal worlds.
 *
 * Supports:
 * - parent / child temporal worlds
 * - arbitrary cross-world edges
 * - traversal
 * - ancestry
 * - descendants
 * - visibility windows
 * - relation paths across years / moons / days / events
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(
      require("./life-atlas-world-model.js")
    );
    return;
  }

  root.CodexLifeAtlasSceneGraph = factory(
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

    function clone(value) {
      if (
        value === null ||
        value === undefined
      ) {
        return value;
      }

      return JSON.parse(
        JSON.stringify(value)
      );
    }

    function createSceneGraph() {
      const nodes = new Map();
      const children = new Map();
      const edges = new Map();

      function ensureChildSet(id) {
        const key = String(id);

        if (!children.has(key)) {
          children.set(
            key,
            new Set()
          );
        }

        return children.get(key);
      }

      function hasNode(id) {
        return nodes.has(
          String(id)
        );
      }

      function getNode(id) {
        const node =
          nodes.get(
            String(id)
          );

        return node
          ? clone(node)
          : null;
      }

      function addNode(input) {
        const node =
          WorldModel.createWorldNode(
            input
          );

        if (
          node.parentId &&
          node.parentId === node.id
        ) {
          throw new Error(
            "Scene node cannot parent itself."
          );
        }

        const previous =
          nodes.get(node.id);

        if (
          previous?.parentId &&
          previous.parentId !==
            node.parentId
        ) {
          children
            .get(previous.parentId)
            ?.delete(node.id);
        }

        nodes.set(
          node.id,
          clone(node)
        );

        ensureChildSet(
          node.id
        );

        if (node.parentId) {
          ensureChildSet(
            node.parentId
          ).add(
            node.id
          );
        }

        return getNode(
          node.id
        );
      }

      function addNodes(input = []) {
        return input.map(
          addNode
        );
      }

      function removeNode(
        id,
        options = {}
      ) {
        const key =
          String(id);

        const node =
          nodes.get(key);

        if (!node) {
          return false;
        }

        const childIds =
          [
            ...(
              children.get(key) ||
              []
            )
          ];

        if (
          childIds.length &&
          options.cascade !== true
        ) {
          throw new Error(
            "Cannot remove scene node with children without cascade."
          );
        }

        if (
          options.cascade === true
        ) {
          childIds.forEach(
            childId =>
              removeNode(
                childId,
                {
                  cascade: true
                }
              )
          );
        }

        if (node.parentId) {
          children
            .get(node.parentId)
            ?.delete(key);
        }

        children.delete(key);
        nodes.delete(key);

        for (
          const [
            edgeId,
            edge
          ] of edges
        ) {
          if (
            edge.sourceId === key ||
            edge.targetId === key
          ) {
            edges.delete(
              edgeId
            );
          }
        }

        return true;
      }

      function getChildren(id) {
        return [
          ...(
            children.get(
              String(id)
            ) ||
            []
          )
        ]
          .map(
            childId =>
              getNode(childId)
          )
          .filter(Boolean);
      }

      function getParent(id) {
        const node =
          nodes.get(
            String(id)
          );

        if (
          !node ||
          !node.parentId
        ) {
          return null;
        }

        return getNode(
          node.parentId
        );
      }

      function ancestors(id) {
        const result = [];
        const visited =
          new Set();

        let current =
          nodes.get(
            String(id)
          );

        while (
          current?.parentId
        ) {
          if (
            visited.has(
              current.parentId
            )
          ) {
            break;
          }

          visited.add(
            current.parentId
          );

          const parent =
            nodes.get(
              current.parentId
            );

          if (!parent) {
            break;
          }

          result.push(
            clone(parent)
          );

          current =
            parent;
        }

        return result;
      }

      function descendants(
        id,
        options = {}
      ) {
        const result = [];
        const start =
          String(id);

        const maximumDepth =
          Number.isFinite(
            Number(
              options.depth
            )
          )
            ? Math.max(
                0,
                Number(
                  options.depth
                )
              )
            : Infinity;

        const queue = [
          {
            id: start,
            depth: 0
          }
        ];

        const visited =
          new Set([
            start
          ]);

        while (
          queue.length
        ) {
          const current =
            queue.shift();

          if (
            current.depth >=
            maximumDepth
          ) {
            continue;
          }

          for (
            const childId of
            children.get(
              current.id
            ) ||
            []
          ) {
            if (
              visited.has(
                childId
              )
            ) {
              continue;
            }

            visited.add(
              childId
            );

            const child =
              nodes.get(
                childId
              );

            if (!child) {
              continue;
            }

            result.push(
              clone(child)
            );

            queue.push({
              id: childId,
              depth:
                current.depth +
                1
            });
          }
        }

        return result;
      }

      function edgeKey(
        sourceId,
        targetId,
        type
      ) {
        return [
          String(sourceId),
          String(type || "related"),
          String(targetId)
        ].join("::");
      }

      function addEdge({
        id = null,
        sourceId,
        targetId,
        type = "related",
        directed = true,
        weight = 1,
        metadata = {}
      } = {}) {
        if (
          !sourceId ||
          !targetId
        ) {
          throw new Error(
            "Scene edge requires sourceId and targetId."
          );
        }

        const source =
          String(sourceId);

        const target =
          String(targetId);

        if (source === target) {
          throw new Error(
            "Scene edge cannot connect a node to itself."
          );
        }

        const key =
          id
            ? String(id)
            : edgeKey(
                source,
                target,
                type
              );

        const edge = {
          id: key,
          sourceId: source,
          targetId: target,
          type:
            String(
              type ||
                "related"
            ),
          directed:
            directed !== false,
          weight:
            Number.isFinite(
              Number(weight)
            )
              ? Number(weight)
              : 1,
          metadata: {
            ...metadata
          }
        };

        edges.set(
          key,
          edge
        );

        return clone(edge);
      }

      function removeEdge(id) {
        return edges.delete(
          String(id)
        );
      }

      function getEdgesFor(id) {
        const key =
          String(id);

        return [
          ...edges.values()
        ]
          .filter(
            edge =>
              edge.sourceId === key ||
              edge.targetId === key
          )
          .map(clone);
      }

      function allNodes() {
        return [
          ...nodes.values()
        ].map(clone);
      }

      function allEdges() {
        return [
          ...edges.values()
        ].map(clone);
      }

      function nodesAtLevel(level) {
        return [
          ...nodes.values()
        ]
          .filter(
            node =>
              node.level === level
          )
          .map(clone);
      }

      function visibleFrom(
        focusId,
        options = {}
      ) {
        const focus =
          nodes.get(
            String(focusId)
          );

        if (!focus) {
          return [];
        }

        const visibility =
          WorldModel
            .visibilityForLevel(
              focus.level
            );

        const allowedLevels =
          new Set(
            options.levels ||
              visibility.visibleLevels
          );

        const result =
          new Map();

        result.set(
          focus.id,
          clone(focus)
        );

        ancestors(
          focus.id
        ).forEach(
          node => {
            if (
              allowedLevels.has(
                node.level
              )
            ) {
              result.set(
                node.id,
                node
              );
            }
          }
        );

        descendants(
          focus.id,
          {
            depth:
              options.depth ?? 2
          }
        ).forEach(
          node => {
            if (
              allowedLevels.has(
                node.level
              )
            ) {
              result.set(
                node.id,
                node
              );
            }
          }
        );

        return [
          ...result.values()
        ];
      }

      function relatedNeighborhood(
        id,
        options = {}
      ) {
        const start =
          String(id);

        const depth =
          Math.max(
            0,
            Number(
              options.depth ?? 1
            )
          );

        const visited =
          new Set([
            start
          ]);

        let frontier =
          [start];

        for (
          let step = 0;
          step < depth;
          step += 1
        ) {
          const next = [];

          frontier.forEach(
            currentId => {
              getEdgesFor(
                currentId
              ).forEach(
                edge => {
                  const other =
                    edge.sourceId ===
                    currentId
                      ? edge.targetId
                      : edge.sourceId;

                  if (
                    !visited.has(
                      other
                    )
                  ) {
                    visited.add(
                      other
                    );

                    next.push(
                      other
                    );
                  }
                }
              );
            }
          );

          frontier = next;
        }

        return [
          ...visited
        ]
          .map(
            nodeId =>
              getNode(nodeId)
          )
          .filter(Boolean);
      }

      function shortestRelationPath(
        sourceId,
        targetId
      ) {
        const source =
          String(sourceId);

        const target =
          String(targetId);

        if (
          source === target
        ) {
          return hasNode(source)
            ? [source]
            : [];
        }

        if (
          !hasNode(source) ||
          !hasNode(target)
        ) {
          return [];
        }

        const queue = [
          [source]
        ];

        const visited =
          new Set([
            source
          ]);

        while (
          queue.length
        ) {
          const path =
            queue.shift();

          const current =
            path[
              path.length - 1
            ];

          for (
            const edge of
            getEdgesFor(current)
          ) {
            const next =
              edge.sourceId ===
              current
                ? edge.targetId
                : edge.sourceId;

            if (
              visited.has(next)
            ) {
              continue;
            }

            const nextPath = [
              ...path,
              next
            ];

            if (
              next === target
            ) {
              return nextPath;
            }

            visited.add(next);

            queue.push(
              nextPath
            );
          }
        }

        return [];
      }

      function stats() {
        const levels = {};

        WorldModel.LEVELS
          .forEach(level => {
            levels[level] = 0;
          });

        nodes.forEach(
          node => {
            if (
              Object.prototype
                .hasOwnProperty
                .call(
                  levels,
                  node.level
                )
            ) {
              levels[
                node.level
              ] += 1;
            }
          }
        );

        return {
          nodes:
            nodes.size,

          edges:
            edges.size,

          levels
        };
      }

      function clear() {
        nodes.clear();
        children.clear();
        edges.clear();
      }

      return Object.freeze({
        version: VERSION,

        addNode,
        addNodes,
        removeNode,

        hasNode,
        getNode,
        getParent,
        getChildren,

        ancestors,
        descendants,

        addEdge,
        removeEdge,
        getEdgesFor,

        allNodes,
        allEdges,
        nodesAtLevel,

        visibleFrom,
        relatedNeighborhood,
        shortestRelationPath,

        stats,
        clear
      });
    }

    return Object.freeze({
      VERSION,
      createSceneGraph
    });
  }
);
