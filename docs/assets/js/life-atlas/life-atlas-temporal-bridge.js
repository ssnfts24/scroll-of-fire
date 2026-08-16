/**
 * Codex Life Atlas
 * Temporal Cursor Bridge
 *
 * Connects the existing SOFTemporalCursor to the Life Atlas without
 * introducing another source of temporal truth.
 */
(function (root, factory) {
  let Query = root.CodexLifeAtlasQuery;
  let Projections = root.CodexLifeAtlasProjections;

  if (typeof module === "object" && module.exports) {
    Query = require("./life-atlas-query.js");
    Projections = require("./life-atlas-projections.js");
    module.exports = factory(Query, Projections);
    return;
  }

  root.CodexLifeAtlasTemporalBridge =
    factory(Query, Projections);
})(
  typeof globalThis !== "undefined"
    ? globalThis
    : this,
  function (Query, Projections) {
    "use strict";

    const VERSION = "1.0.0";

    function clone(value) {
      if (
        value === undefined ||
        value === null
      ) {
        return value;
      }

      return JSON.parse(
        JSON.stringify(value)
      );
    }

    function finite(value) {
      const number = Number(value);

      return Number.isFinite(number)
        ? number
        : null;
    }

    function cleanString(value) {
      if (
        value === undefined ||
        value === null
      ) {
        return null;
      }

      const text =
        String(value).trim();

      return text || null;
    }

    function coordinateSelection(
      coordinate = {},
      date = null
    ) {
      const remnant =
        coordinate.remnant13Moons ||
        coordinate.remnant ||
        coordinate.pattern ||
        {};

      let civilDate =
        cleanString(
          coordinate.civilDate ||
          remnant.civilDate ||
          remnant.effectiveDate
        );

      if (
        !civilDate &&
        date instanceof Date &&
        !Number.isNaN(date.getTime())
      ) {
        civilDate =
          date.toISOString().slice(0, 10);
      }

      return Query.normalizeTemporalSelection({
        civilDate,

        patternYear:
          remnant.patternYear ??
          coordinate.patternYear,

        patternDay:
          remnant.patternDay ??
          remnant.dayOfPatternYear ??
          coordinate.patternDay ??
          coordinate.dayOfPatternYear,

        moon:
          remnant.moon ??
          coordinate.moon,

        moonDay:
          remnant.moonDay ??
          remnant.day ??
          coordinate.moonDay,

        week:
          remnant.week ??
          coordinate.week
      });
    }

    function cursorSnapshot(cursor) {
      if (!cursor) {
        return null;
      }

      const state =
        typeof cursor.getState === "function"
          ? cursor.getState()
          : null;

      const date =
        typeof cursor.getDate === "function"
          ? cursor.getDate()
          : null;

      const coordinate =
        typeof cursor.getCoordinate === "function"
          ? cursor.getCoordinate()
          : state?.coordinate || null;

      return {
        state: clone(state),
        date:
          date instanceof Date &&
          !Number.isNaN(date.getTime())
            ? new Date(date.getTime())
            : null,
        coordinate:
          clone(coordinate),
        selection:
          coordinateSelection(
            coordinate || {},
            date
          )
      };
    }

    function createTemporalBridge({
      repository,
      relations,
      cursor = null,
      eventTarget = null
    } = {}) {
      if (!Query) {
        throw new Error(
          "CodexLifeAtlasQuery is required."
        );
      }

      if (!Projections) {
        throw new Error(
          "CodexLifeAtlasProjections is required."
        );
      }

      const engine =
        Query.createQueryEngine({
          repository,
          relations
        });

      let activeCursor = cursor;
      let activeTarget = eventTarget;
      let listening = false;
      let revision = 0;
      let lastContext = null;
      const listeners = new Set();

      function resolveCursor() {
        return (
          activeCursor ||
          (
            typeof globalThis !== "undefined"
              ? globalThis.SOFTemporalCursor
              : null
          )
        );
      }

      function resolveEventTarget() {
        if (activeTarget) {
          return activeTarget;
        }

        if (
          typeof window !== "undefined" &&
          typeof window.addEventListener === "function"
        ) {
          return window;
        }

        return null;
      }

      async function context() {
        const currentCursor =
          resolveCursor();

        const snapshot =
          cursorSnapshot(currentCursor);

        if (!snapshot) {
          return {
            revision,
            cursor: null,
            selection: {},
            records: []
          };
        }

        const records =
          await engine.forTemporalSelection(
            snapshot.selection
          );

        lastContext = {
          revision,
          cursor: snapshot,
          selection:
            clone(snapshot.selection),
          records:
            clone(records)
        };

        return clone(lastContext);
      }

      async function projection(
        name,
        options = {}
      ) {
        const current =
          await context();

        let relationEdges =
          options.relations || [];

        if (
          name === "network" &&
          !options.relations &&
          relations &&
          typeof relations.all === "function"
        ) {
          relationEdges =
            await relations.all();
        }

        return {
          revision:
            current.revision,
          selection:
            clone(current.selection),
          records:
            clone(current.records),
          projection:
            Projections.project(
              name,
              current.records,
              {
                ...options,
                relations:
                  relationEdges
              }
            )
        };
      }

      async function refresh(reason = "manual") {
        revision += 1;

        const current =
          await context();

        const detail = {
          reason,
          revision,
          context:
            clone(current)
        };

        for (const listener of listeners) {
          try {
            listener(detail);
          } catch (error) {
            if (
              typeof console !== "undefined" &&
              console.error
            ) {
              console.error(
                "Life Atlas temporal listener failed",
                error
              );
            }
          }
        }

        const target =
          resolveEventTarget();

        if (
          target &&
          typeof target.dispatchEvent === "function" &&
          typeof CustomEvent === "function"
        ) {
          target.dispatchEvent(
            new CustomEvent(
              "sof:life-atlas-temporal-change",
              {
                detail
              }
            )
          );
        }

        return detail;
      }

      function subscribe(listener) {
        if (typeof listener !== "function") {
          throw new TypeError(
            "Life Atlas temporal subscriber must be a function."
          );
        }

        listeners.add(listener);

        return function unsubscribe() {
          listeners.delete(listener);
        };
      }

      function onCursorChange(event) {
        const reason =
          event?.detail?.reason ||
          "temporal-cursor-change";

        void refresh(reason);
      }

      function start() {
        if (listening) {
          return true;
        }

        const target =
          resolveEventTarget();

        if (
          !target ||
          typeof target.addEventListener !== "function"
        ) {
          return false;
        }

        target.addEventListener(
          "sof:temporal-cursor-change",
          onCursorChange
        );

        target.addEventListener(
          "sof:temporal-cursor-ready",
          onCursorChange
        );

        listening = true;

        return true;
      }

      function stop() {
        if (!listening) {
          return false;
        }

        const target =
          resolveEventTarget();

        if (
          target &&
          typeof target.removeEventListener === "function"
        ) {
          target.removeEventListener(
            "sof:temporal-cursor-change",
            onCursorChange
          );

          target.removeEventListener(
            "sof:temporal-cursor-ready",
            onCursorChange
          );
        }

        listening = false;

        return true;
      }

      function setCursor(nextCursor) {
        const wasListening =
          listening;

        if (wasListening) {
          stop();
        }

        activeCursor =
          nextCursor || null;

        if (wasListening) {
          start();
        }

        return cursorSnapshot(
          resolveCursor()
        );
      }

      function getLastContext() {
        return clone(lastContext);
      }

      function getRevision() {
        return revision;
      }

      function isListening() {
        return listening;
      }

      return Object.freeze({
        version: VERSION,

        engine,

        context,
        projection,
        refresh,
        subscribe,

        start,
        stop,
        setCursor,

        getLastContext,
        getRevision,
        isListening,

        getSelection() {
          const snapshot =
            cursorSnapshot(
              resolveCursor()
            );

          return snapshot
            ? clone(snapshot.selection)
            : {};
        }
      });
    }

    return Object.freeze({
      VERSION,
      coordinateSelection,
      cursorSnapshot,
      createTemporalBridge
    });
  }
);
