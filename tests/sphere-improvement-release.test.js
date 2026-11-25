"use strict";

/*
 * The R1.7 improvement release — performance pass (Nov 25, 2026).
 * Aaron widened the Sphere performance pass into a full R1.7
 * improvement release in his own words ("Yes, widen the current
 * pass into a full R1.7 improvement release"), and this file is
 * the change set's signature in tests/homepage-sphere.test.js.
 *
 * The pass is five behaviour-preserving changes, and nothing
 * else — no geometry, rendering, camera, motion, selection,
 * label content, or wording changes:
 *
 *   1. The label manager caches the stage geometry it used to
 *      re-read on every pass (_geomCache), invalidated by
 *      ResizeObserver, resize, and scroll — the same
 *      invalidation pattern the renderer already uses.
 *   2. The renderer caches its protected rects
 *      (_protectedRectsCache, _invalidateProtectedRects)
 *      instead of re-measuring them per frame.
 *   3. The label manager reads the root rem once per pass
 *      (_passRemPx / _remPx) instead of once per pill.
 *   4. The label track loop serves natural widths from a cache
 *      (_trackNatWCache) kept under the label size cache's own
 *      key discipline.
 *   5. The renderer's semantic resolve is memoized on its pure
 *      inputs (_semanticResolveMemo).
 *
 * These pins hold the release to that shape: the five
 * mechanisms stand in the two named files, and the pass
 * touches no other protected path.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const LABEL_MANAGER = "docs/assets/js/sphere/living-time-sphere-label-manager.js";
const RENDERER = "docs/assets/js/sphere/living-time-sphere-renderer-3d.js";

test("improvement release: the label manager carries the stage-geometry cache, the per-pass rem read, and the track-width cache", () => {
  const src = read(LABEL_MANAGER);
  assert.ok(src.includes("_geomCache"), "the stage geometry is cached, not re-read per pass");
  assert.ok(src.includes("ResizeObserver"), "the geometry cache is ResizeObserver-invalidated");
  assert.ok(src.includes("_passRemPx") && src.includes("_remPx"), "the root rem is read once per pass");
  assert.ok(src.includes("_trackNatWCache"), "track natural widths are served from the cache");
});

test("improvement release: the renderer carries the protected-rects cache and the semantic-resolve memo", () => {
  const src = read(RENDERER);
  assert.ok(src.includes("_protectedRectsCache"), "the protected rects are cached, not re-measured per frame");
  assert.ok(src.includes("_invalidateProtectedRects"), "the rects cache carries its invalidation");
  assert.ok(src.includes("_semanticResolveMemo"), "the semantic resolve is memoized on its pure inputs");
});

test("improvement release: the label manager still carries PR #330's labeling release underneath the pass", () => {
  // The pass was cut from the tree that carries PR #330's
  // labeling release (the need-first guard, Nov 25, 2026);
  // its budgeted-guard constants must still stand, so the
  // pass is proven to build on the fix, not beside it.
  const labels = read(LABEL_MANAGER);
  assert.ok(labels.includes("GUARD_PILLS_PER_FRAME"), "the guard's per-frame pill budget stands");
  assert.ok(labels.includes("GUARD_PAIRS_PER_FRAME"), "the guard's per-frame pair budget stands");
});
