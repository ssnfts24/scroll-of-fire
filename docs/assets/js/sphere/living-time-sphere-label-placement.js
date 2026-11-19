(function (root, factory) {
  const api = factory();

  if (
    typeof module === "object"
    && module.exports
  ) {
    module.exports = api;
  }

  root.LivingTimeSphereLabelPlacement = api;

})(
  typeof globalThis !== "undefined"
    ? globalThis
    : this,

  function () {
    "use strict";

    const VERSION =
      "living-time-sphere-label-placement/1.0.0";

    /*
     * Label placement governance for the Living Time Sphere (R2 rework).
     *
     * Research basis (2026-11-17 advanced-coding report, §1.2): greedy
     * priority placement backed by a spatial collision index and a hard
     * screen-space budget is the production-proven pattern for governing
     * dense labels (MapLibre's CollisionIndex is the reference design).
     *
     * This module is the post-placement pass for the Moon-name labels.
     * The label manager keeps its existing placement loop; this engine
     * then walks the placed labels in priority order with a spatial hash
     * and resolves overlaps according to the visitor's chosen mode:
     *
     *   "always" — the B7.55/B7.57 persistent-identity doctrine: every
     *              Moon name stays on screen, even where names overlap.
     *              The engine only measures and reports the overlaps.
     *   "fit"    — show what fits: a colliding lower-priority name is
     *              first shifted through a small spiral of alternate
     *              spots; if none is free it is hidden for this frame.
     *              The selected Moon is never hidden.
     *
     * Pure: no DOM, no THREE. Rects are plain {x, y, w, h} objects and
     * are mutated in place when a label is shifted, so any other holder
     * of the same rect object (the manager's placedRects list) sees the
     * move.
     */

    function rectsOverlap(a, b, pad = 0) {
      if (!a || !b) return false;
      return (
        a.x - pad < b.x + b.w
        && a.x + a.w + pad > b.x
        && a.y - pad < b.y + b.h
        && a.y + a.h + pad > b.y
      );
    }

    function overlapArea(a, b) {
      if (!a || !b) return 0;
      const ox =
        Math.min(a.x + a.w, b.x + b.w)
        - Math.max(a.x, b.x);
      const oy =
        Math.min(a.y + a.h, b.y + b.h)
        - Math.max(a.y, b.y);
      return ox > 0 && oy > 0 ? ox * oy : 0;
    }

    /*
     * Spatial hash collision index. Rects are bucketed by every grid
     * cell they touch; a test only compares against rects sharing a
     * cell, so placement stays O(n log n)-ish instead of O(n^2).
     */
    function createCollisionIndex(cellSize = 48) {
      const size =
        Number.isFinite(cellSize) && cellSize > 0
          ? cellSize
          : 48;
      const cells = new Map();
      let count = 0;

      function cellRange(rect) {
        return {
          x0: Math.floor(rect.x / size),
          y0: Math.floor(rect.y / size),
          x1: Math.floor((rect.x + rect.w) / size),
          y1: Math.floor((rect.y + rect.h) / size)
        };
      }

      function test(rect, pad = 0) {
        const { x0, y0, x1, y1 } = cellRange(rect);
        for (let cx = x0; cx <= x1; cx += 1) {
          for (let cy = y0; cy <= y1; cy += 1) {
            const bucket = cells.get(`${cx}:${cy}`);
            if (!bucket) continue;
            for (const other of bucket) {
              if (other !== rect && rectsOverlap(rect, other, pad)) {
                return true;
              }
            }
          }
        }
        return false;
      }

      function insert(rect) {
        const { x0, y0, x1, y1 } = cellRange(rect);
        for (let cx = x0; cx <= x1; cx += 1) {
          for (let cy = y0; cy <= y1; cy += 1) {
            const key = `${cx}:${cy}`;
            let bucket = cells.get(key);
            if (!bucket) {
              bucket = [];
              cells.set(key, bucket);
            }
            bucket.push(rect);
          }
        }
        count += 1;
      }

      function clear() {
        cells.clear();
        count = 0;
      }

      return Object.freeze({
        test,
        insert,
        clear,
        size: () => count
      });
    }

    /*
     * Alternate spots tried in "fit" mode before a label is hidden,
     * as [dx, dy] shifts from its placed position, nearest first.
     */
    const FIT_OFFSETS = Object.freeze([
      [0, -20], [0, 20],
      [-26, 0], [26, 0],
      [-26, -18], [26, -18], [-26, 18], [26, 18],
      [0, -34], [0, 34],
      [-44, 0], [44, 0],
      [-44, -26], [44, -26], [-44, 26], [44, 26]
    ]);

    function clampRect(rect, bounds) {
      if (!bounds) return rect;
      rect.x = Math.max(
        bounds.minX,
        Math.min(rect.x, Math.max(bounds.minX, bounds.maxX - rect.w))
      );
      rect.y = Math.max(
        bounds.minY,
        Math.min(rect.y, Math.max(bounds.minY, bounds.maxY - rect.h))
      );
      return rect;
    }

    /*
     * Resolve overlaps among placed Moon labels.
     *
     * items: [{ id, priority, selected, rect }] — rect is the label's
     *   current placed {x, y, w, h}; mutated in place when shifted.
     * options:
     *   mode: "always" | "fit"
     *   blocked: [rect] — screen furniture labels must not cover.
     *   bounds: {minX, minY, maxX, maxY} — clamp box for shifted labels.
     *   pad: extra breathing room required between labels (px).
     *
     * Returns {
     *   results: [{ id, visible, moved, forced, rect }],
     *   stats: { visible, hidden, moved, forced, overlapPairs }
     * }
     */
    function resolveMoonLabelOverlaps(items, options = {}) {
      const mode = options.mode === "fit" ? "fit" : "always";
      const blocked = Array.isArray(options.blocked)
        ? options.blocked
        : [];
      const bounds = options.bounds || null;
      const pad = Number.isFinite(options.pad) ? options.pad : 2;

      const ordered = [...(Array.isArray(items) ? items : [])]
        .filter(item => item && item.rect)
        .sort((a, b) => {
          if (!!b.selected !== !!a.selected) {
            return b.selected ? 1 : -1;
          }
          return (b.priority || 0) - (a.priority || 0);
        });

      const index = createCollisionIndex(48);
      blocked.forEach(rect => index.insert(rect));

      const results = [];
      const visibleRects = [];
      let hidden = 0;
      let moved = 0;
      let forced = 0;

      for (const item of ordered) {
        const rect = item.rect;
        // Start from inside the stage bounds (a no-op for the
        // in-bounds rects the label manager produces).
        clampRect(rect, bounds);
        const hit = index.test(rect, pad);

        if (!hit) {
          index.insert(rect);
          visibleRects.push(rect);
          results.push({
            id: item.id, visible: true, moved: false, forced: false, rect
          });
          continue;
        }

        if (mode === "always") {
          // Persistent-identity doctrine: the name stays, overlap and
          // all. The collision is recorded, never resolved by hiding.
          index.insert(rect);
          visibleRects.push(rect);
          forced += 1;
          results.push({
            id: item.id, visible: true, moved: false, forced: true, rect
          });
          continue;
        }

        // "fit" mode: try the spiral of alternate spots.
        const originX = rect.x;
        const originY = rect.y;
        let placed = false;
        for (const [dx, dy] of FIT_OFFSETS) {
          rect.x = originX + dx;
          rect.y = originY + dy;
          clampRect(rect, bounds);
          if (!index.test(rect, pad)) {
            placed = true;
            break;
          }
        }

        if (placed) {
          index.insert(rect);
          visibleRects.push(rect);
          moved += 1;
          results.push({
            id: item.id, visible: true, moved: true, forced: false, rect
          });
          continue;
        }

        rect.x = originX;
        rect.y = originY;

        if (item.selected) {
          // The selected Moon always keeps its name on screen.
          index.insert(rect);
          visibleRects.push(rect);
          forced += 1;
          results.push({
            id: item.id, visible: true, moved: false, forced: true, rect
          });
          continue;
        }

        hidden += 1;
        results.push({
          id: item.id, visible: false, moved: false, forced: false, rect
        });
      }

      let overlapPairs = 0;
      for (let i = 0; i < visibleRects.length; i += 1) {
        for (let j = i + 1; j < visibleRects.length; j += 1) {
          if (overlapArea(visibleRects[i], visibleRects[j]) >= 4) {
            overlapPairs += 1;
          }
        }
      }

      return {
        results,
        stats: {
          visible: visibleRects.length,
          hidden,
          moved,
          forced,
          overlapPairs
        }
      };
    }

    return Object.freeze({
      VERSION,
      createCollisionIndex,
      rectsOverlap,
      overlapArea,
      resolveMoonLabelOverlaps,
      FIT_OFFSETS
    });
  }
);
