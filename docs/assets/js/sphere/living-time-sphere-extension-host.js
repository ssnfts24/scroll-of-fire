/**
 * Living Time Sphere — Renderer Extension Host
 *
 * Allows optional 3D systems to attach to the authoritative renderer
 * without owning or replacing the Sphere scene.
 *
 * Extensions receive controlled renderer context:
 *   THREE
 *   scene
 *   camera
 *   renderer
 *   container
 *   model
 *   spiral
 *   selectedYear
 *   viewMode
 *   visibleLayers
 *   semanticZoomState
 *   quality
 *   tier
 *   reducedMotion
 *   requestRender()
 *
 * Extension contract:
 *
 * {
 *   id,
 *   enabled?(context),
 *   mount?(context),
 *   update?(context),
 *   render?(context, nowMs),
 *   dispose?(context)
 * }
 */
(function (root, factory) {
  const api = factory();

  if (
    typeof module === "object" &&
    module.exports
  ) {
    module.exports = api;
  }

  root.LivingTimeSphereExtensionHost =
    api;
})(
  typeof globalThis !== "undefined"
    ? globalThis
    : this,

  function () {
    "use strict";

    const VERSION = "1.0.0";

    const extensions =
      new Map();

    const mounted =
      new Set();

    const errors = [];

    let lifecycleRevision = 0;

    function cleanId(value) {
      return String(
        value || ""
      ).trim();
    }

    function recordError(
      extensionId,
      phase,
      error
    ) {
      const entry = {
        extensionId:
          cleanId(extensionId),

        phase:
          cleanId(phase),

        message:
          String(
            error?.message ||
            error ||
            "Unknown extension error"
          ),

        at:
          Date.now()
      };

      errors.push(entry);

      if (
        errors.length > 50
      ) {
        errors.shift();
      }

      try {
        console.warn(
          `[Living Time Sphere extension:${entry.extensionId}] ${entry.phase} failed.`,
          error
        );
      } catch (_) {
        // Diagnostics must never break rendering.
      }

      return entry;
    }

    function normalizeExtension(
      extension
    ) {
      if (
        !extension ||
        typeof extension !==
          "object"
      ) {
        throw new TypeError(
          "Renderer extension must be an object."
        );
      }

      const id =
        cleanId(
          extension.id
        );

      if (!id) {
        throw new TypeError(
          "Renderer extension requires an id."
        );
      }

      return {
        id,

        enabled:
          typeof extension.enabled ===
          "function"
            ? extension.enabled
            : null,

        mount:
          typeof extension.mount ===
          "function"
            ? extension.mount
            : null,

        update:
          typeof extension.update ===
          "function"
            ? extension.update
            : null,

        render:
          typeof extension.render ===
          "function"
            ? extension.render
            : null,

        pick:
          typeof extension.pick ===
          "function"
            ? extension.pick
            : null,

        dispose:
          typeof extension.dispose ===
          "function"
            ? extension.dispose
            : null,

        metadata:
          extension.metadata &&
          typeof extension.metadata ===
            "object"
            ? {
                ...extension.metadata
              }
            : {}
      };
    }

    function register(
      extension
    ) {
      const normalized =
        normalizeExtension(
          extension
        );

      if (
        extensions.has(
          normalized.id
        )
      ) {
        return false;
      }

      extensions.set(
        normalized.id,
        normalized
      );

      lifecycleRevision += 1;

      return true;
    }

    function unregister(
      id
    ) {
      const key =
        cleanId(id);

      if (!key) {
        return false;
      }

      mounted.delete(key);

      const removed =
        extensions.delete(key);

      if (removed) {
        lifecycleRevision += 1;
      }

      return removed;
    }

    function isEnabled(
      extension,
      context
    ) {
      if (
        !extension?.enabled
      ) {
        return true;
      }

      try {
        return (
          extension.enabled(
            context
          ) !== false
        );
      } catch (error) {
        recordError(
          extension.id,
          "enabled",
          error
        );

        return false;
      }
    }

    async function mountAll(
      context = {}
    ) {
      const results = [];

      for (
        const extension
        of extensions.values()
      ) {
        if (
          mounted.has(
            extension.id
          )
        ) {
          continue;
        }

        if (
          !isEnabled(
            extension,
            context
          )
        ) {
          results.push({
            id:
              extension.id,

            mounted:
              false,

            reason:
              "disabled"
          });

          continue;
        }

        try {
          if (
            extension.mount
          ) {
            await extension.mount(
              context
            );
          }

          mounted.add(
            extension.id
          );

          results.push({
            id:
              extension.id,

            mounted:
              true
          });
        } catch (error) {
          recordError(
            extension.id,
            "mount",
            error
          );

          results.push({
            id:
              extension.id,

            mounted:
              false,

            reason:
              "error"
          });
        }
      }

      lifecycleRevision += 1;

      return results;
    }

    async function updateAll(
      context = {}
    ) {
      const results = [];

      for (
        const extension
        of extensions.values()
      ) {
        if (
          !mounted.has(
            extension.id
          )
        ) {
          continue;
        }

        if (
          !isEnabled(
            extension,
            context
          )
        ) {
          continue;
        }

        try {
          if (
            extension.update
          ) {
            await extension.update(
              context
            );
          }

          results.push({
            id:
              extension.id,

            updated:
              true
          });
        } catch (error) {
          recordError(
            extension.id,
            "update",
            error
          );

          results.push({
            id:
              extension.id,

            updated:
              false
          });
        }
      }

      lifecycleRevision += 1;

      return results;
    }

    function renderAll(
      context = {},
      nowMs = 0
    ) {
      for (
        const extension
        of extensions.values()
      ) {
        if (
          !mounted.has(
            extension.id
          )
        ) {
          continue;
        }

        if (
          !isEnabled(
            extension,
            context
          )
        ) {
          continue;
        }

        try {
          extension.render?.(
            context,
            nowMs
          );
        } catch (error) {
          recordError(
            extension.id,
            "render",
            error
          );
        }
      }
    }

    function pickAll(
      context = {}
    ) {
      for (
        const extension
        of extensions.values()
      ) {
        if (
          !mounted.has(
            extension.id
          )
        ) {
          continue;
        }

        if (
          !isEnabled(
            extension,
            context
          )
        ) {
          continue;
        }

        if (!extension.pick) {
          continue;
        }

        try {
          const result =
            extension.pick(
              context
            );

          if (
            result &&
            result.handled !== false
          ) {
            lifecycleRevision += 1;

            return {
              extensionId:
                extension.id,

              ...result,

              handled: true
            };
          }
        } catch (error) {
          recordError(
            extension.id,
            "pick",
            error
          );
        }
      }

      return null;
    }

    async function disposeAll(
      context = {}
    ) {
      const activeIds =
        Array.from(
          mounted
        );

      /*
       * Dispose in reverse registration order.
       * This mirrors stack-like resource ownership.
       */
      activeIds.reverse();

      for (
        const id
        of activeIds
      ) {
        const extension =
          extensions.get(id);

        if (!extension) {
          mounted.delete(
            id
          );

          continue;
        }

        try {
          await extension.dispose?.(
            context
          );
        } catch (error) {
          recordError(
            extension.id,
            "dispose",
            error
          );
        }

        mounted.delete(
          id
        );
      }

      lifecycleRevision += 1;
    }

    function clearRegistry() {
      mounted.clear();
      extensions.clear();
      lifecycleRevision += 1;
    }

    function has(
      id
    ) {
      return extensions.has(
        cleanId(id)
      );
    }

    function isMounted(
      id
    ) {
      return mounted.has(
        cleanId(id)
      );
    }

    function list() {
      return Array.from(
        extensions.values()
      ).map(
        extension => ({
          id:
            extension.id,

          mounted:
            mounted.has(
              extension.id
            ),

          metadata: {
            ...extension.metadata
          }
        })
      );
    }

    function diagnostics() {
      return {
        version:
          VERSION,

        revision:
          lifecycleRevision,

        registered:
          extensions.size,

        mounted:
          mounted.size,

        extensions:
          list(),

        errors:
          errors.map(
            entry => ({
              ...entry
            })
          )
      };
    }

    return Object.freeze({
      VERSION,

      register,
      unregister,

      has,
      isMounted,
      list,

      mountAll,
      updateAll,
      renderAll,
      pickAll,
      disposeAll,

      diagnostics,

      _internals:
        Object.freeze({
          normalizeExtension,
          clearRegistry
        })
    });
  }
);
