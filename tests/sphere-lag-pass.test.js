"use strict";

/*
 * The Sphere lag pass (Nov 26, 2026 — R1.7 improvement release).
 * Aaron's report, after every earlier smoothness pass: "On the
 * web and the app. The sphere is still really laggy."
 *
 * Profiling the Sphere page on the throttled A16-class profile
 * (390x844, DSF 2.625, 6x CPU, SwiftShader) attributed the lag
 * to the diagnostics path, not the renderer:
 *
 *   - sphere-armillary's autoInteract polls
 *     getSphereDiagnostics() every 500 ms for up to 90 tries;
 *     its success condition can never fire once the rebuild
 *     layer arms interact first, so it polled its whole life.
 *   - Each diagnostics call embeds a runtime-debug snapshot:
 *     whole-document censuses inspecting ~9,000 nodes (a
 *     getBoundingClientRect + a getComputedStyle each). The
 *     Nov 25 cadence (2 s TTL) never held under load: the TTL
 *     was anchored at snapshot start, snapshots outlast it, and
 *     scroll/resize flushed the cache mid-interaction.
 *   - The censuses re-inspected the same nodes back to back:
 *     the 200 ms per-node cache expires mid-snapshot on a
 *     loaded phone.
 *   - The 3D renderer's semantic-width cache died on ANY
 *     container size change, though it caches a width: the
 *     stage's height churns during interaction, so drags paid
 *     a forced layout flush per pointer move (1,279 ms of
 *     self time in the drag profile).
 *
 * Measured before: idle 29,592 getBoundingClientRect per 10 s;
 * a drag window with 209,157; one snapshot at 181.8 s
 * inclusive in the drag profile; getSphereDiagnostics at
 * 195.6 s inclusive of a ~190 s drag profile (96%).
 *
 * These tests pin the shape of the three fixes and, just as
 * hard, the things that must not move: the original inspection
 * body still computes the values, the 200 ms per-node cache
 * and its scroll reset stand, the standalone fresh snapshot
 * still inspects on demand, and the semantic width served is
 * still the element's own clientWidth.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = rel => fs.readFileSync(path.join(ROOT, rel), "utf8");

const sphereUi = read("docs/assets/js/sphere/living-time-sphere-ui.js");
const renderer = read("docs/assets/js/sphere/living-time-sphere-renderer-3d.js");
const armillary = read("docs/assets/js/sphere-armillary.js");

function bodyOf(source, headerRegex) {
  const m = headerRegex.exec(source);
  assert.ok(m, `function present: ${headerRegex}`);
  return m[1];
}

test("lag-pass 1: inspections inside one collection are computed at most once per node", () => {
  assert.match(sphereUi, /let _inspectEpochMemo = null;/, "the per-collection memo exists");
  assert.match(sphereUi, /function _beginInspectEpoch\(\)/, "collections open explicitly");
  assert.match(sphereUi, /function _endInspectEpoch\(\)/, "collections close explicitly");
  assert.match(
    sphereUi,
    /if \(_inspectEpochMemo && _inspectEpochMemo\.has\(node\)\) return _inspectEpochMemo\.get\(node\);/,
    "_inspectElementNode serves the collection memo first"
  );
  const verify = bodyOf(sphereUi, /function _verifyRenderSurface\(container, options = \{\}\) \{([\s\S]*?)\n  \}/);
  assert.match(verify, /_beginInspectEpoch\(\);/, "render-surface verification runs as one collection");
  assert.match(verify, /_endInspectEpoch\(\);/, "the collection is released in a finally");
  assert.match(verify, /_verifyRenderSurfaceImpl\(container, options\)/, "the original verification body computes the values");
  const snapshot = bodyOf(sphereUi, /function _collectRuntimeDebugSnapshot\(\) \{([\s\S]*?)\n  \}/);
  assert.match(snapshot, /_beginInspectEpoch\(\);/, "the runtime-debug snapshot runs as one collection");
  assert.match(snapshot, /_collectRuntimeDebugSnapshotImpl\(\)/, "the original snapshot body computes the values");
});

test("lag-pass 1b: the values themselves did not move", () => {
  assert.match(sphereUi, /function _inspectElementNodeUncached/, "the original inspection body still computes the values");
  assert.match(sphereUi, /const INSPECT_CACHE_TTL_MS = 200;/, "the 200 ms per-node cache stands");
  const install = bodyOf(sphereUi, /function _installInspectCache\(\) \{([\s\S]*?)\n  \}/);
  assert.match(install, /document\.addEventListener\("scroll", reset, true\)/, "the per-node cache still resets on scroll (rects are viewport-relative)");
  assert.equal(sphereUi.includes("new MutationObserver"), false, "the PR3 guard stands: no whole-document mutation observer in this UI");
});

test("lag-pass 2: the embedded snapshot's cadence holds under load", () => {
  assert.match(sphereUi, /const RUNTIME_DEBUG_TTL_MS = 30000;/, "the embedded snapshot's cadence is 30 s");
  const memo = bodyOf(sphereUi, /function _collectRuntimeDebugSnapshotMemoized\(\) \{([\s\S]*?)\n  \}/);
  assert.ok(
    memo.indexOf("const value = _collectRuntimeDebugSnapshot();") < memo.indexOf("_runtimeDebugCache = { at: Date.now(), value };"),
    "the TTL is anchored at completion, not at start"
  );
  const install = bodyOf(sphereUi, /function _installRuntimeDebugCache\(\) \{([\s\S]*?)\n  \}/);
  assert.equal(install.includes('addEventListener("scroll"'), false, "interaction scrolling no longer flushes the embedded snapshot");
  assert.equal(install.includes('addEventListener("resize"'), false, "resize no longer flushes the embedded snapshot");
  assert.match(install, /sof:life-atlas-records-changed/, "a records change — real content — still flushes it");
  assert.match(sphereUi, /globalThis\.getSphereRuntimeDebugSnapshot = _refreshRuntimeDebugCache;/, "the standalone fresh snapshot still inspects on demand");
});

test("lag-pass 3: the armillary's arming poll stands down once interact is on", () => {
  const auto = bodyOf(armillary, /function autoInteract\(\) \{([\s\S]*?)\n  \}/);
  const standDown = auto.indexOf('endBtn.style.display !== "none" && btn.style.display === "none"');
  const diagCall = auto.indexOf("window.LivingTimeSphereUi.getSphereDiagnostics ?");
  assert.ok(standDown >= 0, "the poll reads the UI's own armed posture (end shown, start hidden)");
  assert.ok(diagCall >= 0 && standDown < diagCall, "the stand-down is checked before any diagnostics call is paid");
  assert.match(auto, /window\.clearInterval\(wait\);\s*\n\s*return;/, "standing down stops the poll");
  assert.match(auto, /btn\.click\(\);/, "the poll still arms interact itself when it wins the race");
});

test("lag-pass 4: the semantic-width cache dies only when the width moves", () => {
  assert.match(renderer, /cache\.el === el && cache\.innerWidth === inner/, "the width cache key stands (container + viewport)");
  const watch = bodyOf(renderer, /function _watchSemanticWidth\(el\) \{([\s\S]*?)\n  \}/);
  assert.match(watch, /if \(\(cache\.el\?\.clientWidth \|\| 0\) === cache\.width\) return;/, "a resize report that leaves the width unchanged keeps the cache");
  assert.match(watch, /_semanticWidthCache = null;/, "a real width change still drops the cache");
});
