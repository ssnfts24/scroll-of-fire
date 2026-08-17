/**
 * Codex Life Atlas — World Navigation / Flight Controller
 *
 * Renderer-independent navigation state for the Living Temporal World.
 *
 * Responsibilities:
 * - semantic depth
 * - focused world
 * - parent/child traversal
 * - camera targets
 * - flight state
 * - breadcrumb path
 * - renderer subscriptions
 *
 * It does NOT:
 * - render Three.js objects
 * - own canonical records
 * - replace SOFTemporalCursor
 * - replace calendar mathematics
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(
      require("./life-atlas-world-model.js")
    );
    return;
  }

  root.CodexLifeAtlasWorldNavigation = factory(
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

    const DEFAULT_CAMERA_DISTANCE =
      Object.freeze({
        global: 30,
        collective: 20,
        lifetime: 15,
        "multi-year": 10,
        year: 7.5,
        moon: 5,
        week: 3.5,
        day: 2.5,
        hour: 1.6,
        event: 1,
        record: 0.45
      });

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

    function vector(input = {}) {
      return {
        x: Number.isFinite(Number(input.x))
          ? Number(input.x)
          : 0,

        y: Number.isFinite(Number(input.y))
          ? Number(input.y)
          : 0,

        z: Number.isFinite(Number(input.z))
          ? Number(input.z)
          : 0
      };
    }

    function lerp(a, b, t) {
      return (
        Number(a || 0) +
        (
          Number(b || 0) -
          Number(a || 0)
        ) *
          t
      );
    }

    function lerpVector(a, b, t) {
      return {
        x: lerp(a.x, b.x, t),
        y: lerp(a.y, b.y, t),
        z: lerp(a.z, b.z, t)
      };
    }

    function easeInOutCubic(t) {
      const value =
        Math.min(
          1,
          Math.max(
            0,
            Number(t) || 0
          )
        );

      return value < 0.5
        ? 4 * value * value * value
        : 1 -
            Math.pow(
              -2 * value + 2,
              3
            ) /
              2;
    }

    function createNavigation(options = {}) {
      const subscribers =
        new Set();

      const now =
        typeof options.now === "function"
          ? options.now
          : () => Date.now();

      let state = {
        level:
          WorldModel.LEVELS.includes(
            options.level
          )
            ? options.level
            : "year",

        focusId:
          options.focusId ||
          null,

        focusNode:
          options.focusNode
            ? clone(options.focusNode)
            : null,

        path:
          Array.isArray(options.path)
            ? clone(options.path)
            : [],

        camera: {
          position: vector(
            options.camera?.position ||
              {
                x: 0,
                y: 0,
                z:
                  DEFAULT_CAMERA_DISTANCE.year
              }
          ),

          target: vector(
            options.camera?.target
          ),

          distance:
            Number.isFinite(
              Number(
                options.camera?.distance
              )
            )
              ? Number(
                  options.camera.distance
                )
              : DEFAULT_CAMERA_DISTANCE.year
        },

        flight: {
          active: false,
          startedAt: null,
          duration: 0,
          progress: 1,
          from: null,
          to: null,
          reason: null
        },

        revision: 0
      };

      function snapshot() {
        return clone(state);
      }

      function notify(reason) {
        const detail = {
          reason:
            reason ||
            "navigation-change",

          state:
            snapshot()
        };

        subscribers.forEach(
          subscriber => {
            try {
              subscriber(detail);
            } catch (_) {
              // One observer must never break navigation.
            }
          }
        );

        return detail;
      }

      function setLevel(
        level,
        options = {}
      ) {
        if (
          !WorldModel.LEVELS.includes(
            level
          )
        ) {
          return snapshot();
        }

        state.level = level;

        if (
          options.distance !== false
        ) {
          state.camera.distance =
            DEFAULT_CAMERA_DISTANCE[
              level
            ] ||
            state.camera.distance;
        }

        state.revision += 1;

        if (!options.silent) {
          notify(
            options.reason ||
              "set-level"
          );
        }

        return snapshot();
      }

      function setFocus(
        node,
        options = {}
      ) {
        if (!node || !node.id) {
          return snapshot();
        }

        state.focusId =
          String(node.id);

        state.focusNode =
          clone(node);

        if (
          WorldModel.LEVELS.includes(
            node.level
          )
        ) {
          state.level =
            node.level;
        }

        state.camera.target =
          vector(
            node.position
          );

        state.revision += 1;

        if (!options.silent) {
          notify(
            options.reason ||
              "focus"
          );
        }

        return snapshot();
      }

      function pushPath(node) {
        if (!node || !node.id) {
          return snapshot();
        }

        const existingIndex =
          state.path.findIndex(
            item =>
              item.id === node.id
          );

        if (
          existingIndex >= 0
        ) {
          state.path =
            state.path.slice(
              0,
              existingIndex + 1
            );
        } else {
          state.path.push({
            id: String(node.id),
            level: node.level,
            temporal:
              clone(
                node.temporal || {}
              )
          });
        }

        state.revision += 1;

        return snapshot();
      }

      function popPath() {
        if (
          state.path.length > 0
        ) {
          state.path.pop();
          state.revision += 1;
        }

        return snapshot();
      }

      function breadcrumb() {
        return clone(
          state.path
        );
      }

      function beginFlight(
        destination = {},
        options = {}
      ) {
        const duration =
          Math.max(
            0,
            Number(
              options.duration ??
                destination.duration ??
                900
            ) || 0
          );

        const from = {
          position:
            vector(
              state.camera.position
            ),

          target:
            vector(
              state.camera.target
            ),

          distance:
            Number(
              state.camera.distance
            )
        };

        const destinationLevel =
          WorldModel.LEVELS.includes(
            destination.level
          )
            ? destination.level
            : state.level;

        const to = {
          position:
            vector(
              destination.position ||
                state.camera.position
            ),

          target:
            vector(
              destination.target ||
                destination.node
                  ?.position ||
                state.camera.target
            ),

          distance:
            Number.isFinite(
              Number(
                destination.distance
              )
            )
              ? Number(
                  destination.distance
                )
              : DEFAULT_CAMERA_DISTANCE[
                  destinationLevel
                ] ||
                state.camera.distance
        };

        state.flight = {
          active:
            duration > 0,

          startedAt:
            now(),

          duration,

          progress:
            duration > 0
              ? 0
              : 1,

          from,
          to,

          reason:
            options.reason ||
            "flight"
        };

        if (
          destination.node
        ) {
          setFocus(
            destination.node,
            {
              silent: true
            }
          );
        } else {
          state.level =
            destinationLevel;
        }

        if (duration === 0) {
          state.camera = {
            position:
              vector(
                to.position
              ),

            target:
              vector(
                to.target
              ),

            distance:
              to.distance
          };
        }

        state.revision += 1;

        notify(
          options.reason ||
            "flight-start"
        );

        return snapshot();
      }

      function updateFlight(
        timestamp = now()
      ) {
        if (
          !state.flight.active
        ) {
          return snapshot();
        }

        const elapsed =
          Math.max(
            0,
            Number(timestamp) -
              Number(
                state.flight.startedAt
              )
          );

        const rawProgress =
          state.flight.duration <= 0
            ? 1
            : Math.min(
                1,
                elapsed /
                  state.flight.duration
              );

        const progress =
          easeInOutCubic(
            rawProgress
          );

        state.camera.position =
          lerpVector(
            state.flight.from.position,
            state.flight.to.position,
            progress
          );

        state.camera.target =
          lerpVector(
            state.flight.from.target,
            state.flight.to.target,
            progress
          );

        state.camera.distance =
          lerp(
            state.flight.from.distance,
            state.flight.to.distance,
            progress
          );

        state.flight.progress =
          rawProgress;

        if (
          rawProgress >= 1
        ) {
          state.flight.active =
            false;

          state.flight.progress =
            1;

          state.camera.position =
            vector(
              state.flight.to.position
            );

          state.camera.target =
            vector(
              state.flight.to.target
            );

          state.camera.distance =
            state.flight.to.distance;

          state.revision += 1;

          notify(
            "flight-complete"
          );
        }

        return snapshot();
      }

      function cancelFlight(
        reason =
          "flight-cancelled"
      ) {
        if (
          !state.flight.active
        ) {
          return snapshot();
        }

        state.flight.active =
          false;

        state.revision += 1;

        notify(reason);

        return snapshot();
      }

      function enter(
        node,
        options = {}
      ) {
        if (!node || !node.id) {
          return snapshot();
        }

        pushPath(node);

        return beginFlight(
          {
            node,

            level:
              node.level,

            target:
              node.position,

            distance:
              options.distance ??
              DEFAULT_CAMERA_DISTANCE[
                node.level
              ]
          },
          {
            duration:
              options.duration ??
              900,

            reason:
              options.reason ||
              "enter-world"
          }
        );
      }

      function exit(
        parentNode = null,
        options = {}
      ) {
        const parent =
          parentNode ||
          (
            state.path.length >= 2
              ? state.path[
                  state.path.length -
                    2
                ]
              : null
          );

        popPath();

        const targetLevel =
          parent?.level ||
          WorldModel.parentLevel(
            state.level
          ) ||
          state.level;

        return beginFlight(
          {
            node:
              parentNode ||
              undefined,

            level:
              targetLevel,

            target:
              parentNode?.position ||
              {
                x: 0,
                y: 0,
                z: 0
              },

            distance:
              options.distance ??
              DEFAULT_CAMERA_DISTANCE[
                targetLevel
              ]
          },
          {
            duration:
              options.duration ??
              900,

            reason:
              options.reason ||
              "exit-world"
          }
        );
      }

      function zoom(
        delta,
        options = {}
      ) {
        const minimum =
          Number(
            options.minimum ??
              0.25
          );

        const maximum =
          Number(
            options.maximum ??
              40
          );

        const multiplier =
          Number(
            options.multiplier ??
              0.0025
          );

        const next =
          Math.min(
            maximum,
            Math.max(
              minimum,
              state.camera.distance *
                Math.exp(
                  Number(delta || 0) *
                    multiplier
                )
            )
          );

        state.camera.distance =
          next;

        const semanticLevel =
          WorldModel.semanticBand(
            next
          );

        if (
          options.semantic !== false &&
          semanticLevel !==
            state.level
        ) {
          state.level =
            semanticLevel;
        }

        state.revision += 1;

        if (!options.silent) {
          notify(
            options.reason ||
              "zoom"
          );
        }

        return snapshot();
      }

      function setCamera(
        camera = {},
        options = {}
      ) {
        if (camera.position) {
          state.camera.position =
            vector(
              camera.position
            );
        }

        if (camera.target) {
          state.camera.target =
            vector(
              camera.target
            );
        }

        if (
          Number.isFinite(
            Number(
              camera.distance
            )
          )
        ) {
          state.camera.distance =
            Number(
              camera.distance
            );
        }

        state.revision += 1;

        if (!options.silent) {
          notify(
            options.reason ||
              "camera"
          );
        }

        return snapshot();
      }

      function subscribe(
        subscriber
      ) {
        if (
          typeof subscriber !==
          "function"
        ) {
          return () => {};
        }

        subscribers.add(
          subscriber
        );

        return () => {
          subscribers.delete(
            subscriber
          );
        };
      }

      function reset(
        options = {}
      ) {
        state = {
          level: "year",

          focusId: null,
          focusNode: null,
          path: [],

          camera: {
            position: {
              x: 0,
              y: 0,
              z:
                DEFAULT_CAMERA_DISTANCE.year
            },

            target: {
              x: 0,
              y: 0,
              z: 0
            },

            distance:
              DEFAULT_CAMERA_DISTANCE.year
          },

          flight: {
            active: false,
            startedAt: null,
            duration: 0,
            progress: 1,
            from: null,
            to: null,
            reason: null
          },

          revision:
            state.revision + 1
        };

        if (!options.silent) {
          notify(
            options.reason ||
              "reset"
          );
        }

        return snapshot();
      }

      return Object.freeze({
        version: VERSION,

        getState:
          snapshot,

        getLevel() {
          return state.level;
        },

        getFocus() {
          return clone(
            state.focusNode
          );
        },

        getCamera() {
          return clone(
            state.camera
          );
        },

        getFlight() {
          return clone(
            state.flight
          );
        },

        breadcrumb,

        setLevel,
        setFocus,
        setCamera,

        pushPath,
        popPath,

        beginFlight,
        updateFlight,
        cancelFlight,

        enter,
        exit,
        zoom,

        subscribe,
        reset
      });
    }

    return Object.freeze({
      VERSION,
      DEFAULT_CAMERA_DISTANCE,

      vector,
      lerp,
      lerpVector,
      easeInOutCubic,

      createNavigation
    });
  }
);
