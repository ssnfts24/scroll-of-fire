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
  assert.match(watch, /const width = cache\.el\?\.clientWidth \|\| 0;/, "the observer re-reads the one value the cache holds, once per resize report");
  assert.match(watch, /if \(width === cache\.width\) return;/, "a resize report that leaves the width unchanged keeps the cache");
  assert.match(watch, /_semanticWidthCache = \{\s*\n\s*el: cache\.el,\s*\n\s*width,/, "a real width change is written into the cache by the observer, not refilled on the render path");
  assert.match(watch, /_semanticWidthCache = null;/, "a container measuring zero still drops the cache");
  const serve = bodyOf(renderer, /function _semanticScreenWidth\(\) \{([\s\S]*?)\n  \}/);
  assert.match(serve, /if \(cache && cache\.el === el && cache\.innerWidth === inner\) return cache\.width;/, "the render path serves the cache without reading layout");
});

/*
 * Pass 2 (same night, Aaron: "The sphere is still lagging. I
 * think it can perform way better. Go over it really good.")
 * With the diagnostics storm gone, the throttled drag profile's
 * JavaScript is the label system: the layout pass (update) at
 * 33.5 s inclusive in the attribution run, its size-cache key —
 * a full innerHTML serialization per label per pass — at
 * 14.8 s of self time, and the per-frame tracking guard's
 * fresh arrays and geometry objects feeding the collector.
 * The renderer's name-tag pass also allocated a Vector3 or two
 * per tag per frame. These tests pin the shape of the pass-2
 * fixes; the values every one of them serves are the values
 * the original code computed.
 */

const labelManager = read("docs/assets/js/sphere/living-time-sphere-label-manager.js");

test("lag-pass 5: the label size key is a digest, not a serialization", () => {
  assert.match(labelManager, /function _labelContentDigest\(el\)/, "the content digest exists");
  const key = bodyOf(labelManager, /function _labelSizeKey\(el\) \{([\s\S]*?)\n    \}/);
  assert.equal(key.includes("innerHTML"), false, "the size key never serializes the subtree");
  assert.match(key, /_labelContentDigest\(el\)/, "the size key is built from the digest");
  const digest = bodyOf(labelManager, /function _labelContentDigest\(el\) \{([\s\S]*?)\n    \}/);
  assert.match(digest, /el\.textContent/, "the digest carries the label's words");
  assert.match(digest, /querySelectorAll\("\*"\)/, "the digest walks the descendants");
  assert.match(digest, /n\.hidden \? 1 : 0/, "the digest carries each child's hidden state");
  assert.match(digest, /n\.style\?\.display/, "the digest carries each child's inline display (the detail line's shown/hidden state)");
  const size = bodyOf(labelManager, /function _measuredLabelSize\(el, fallbackW, fallbackH\) \{([\s\S]*?)\n    \}/);
  assert.match(size, /const ow = el\.offsetWidth \|\| 0;/, "a key miss still measures the live box");
  assert.match(size, /if \(!ow\) return \{ key, w: fallbackW, h: fallbackH \};/, "a hidden label's fallback is still never stored");
});

test("lag-pass 6: the semantic refresh remembers its parts and skips standing writes", () => {
  assert.match(labelManager, /el\._semanticParts = \{/, "the card's parts are remembered on the element at build");
  assert.match(labelManager, /const parts = el\._semanticParts \|\| null;/, "the refresh reads the remembered parts");
  assert.match(labelManager, /parts \? parts\.statusEl : el\.querySelector\?\.\("\.sphere-semantic-label-status"\)/, "the query fallback stands for elements without remembered parts");
  assert.match(labelManager, /if \(statusEl\.textContent !== nextStatus\) statusEl\.textContent = nextStatus;/, "the status words are written only when they change");
  assert.match(labelManager, /if \(titleEl && titleEl\.textContent !== target\.label\) titleEl\.textContent = target\.label;/, "the title is written only when it changes");
  assert.match(labelManager, /if \(detailEl\.textContent !== target\.detail\) detailEl\.textContent = target\.detail;/, "the detail line is written only when it changes");
});

test("lag-pass 7: the track frame refills scratch instead of allocating its working sets", () => {
  assert.match(labelManager, /const _scratchPlates = \[\];/, "the plate scratch stands");
  assert.match(labelManager, /const _scratchPlateGeomSlots = \[\];/, "the geometry slots stand");
  const frame = bodyOf(labelManager, /function _trackFrame\(\) \{([\s\S]*?)\n    \}/);
  assert.match(frame, /const plateEntries = _scratchPlates;/, "the frame's plate set is the scratch");
  assert.match(frame, /const pillEntries = _scratchPills;/, "the frame's pill set is the scratch");
  assert.match(frame, /const plateGeom = _scratchPlateGeom;/, "the frame's geometry table is the scratch");
  assert.equal(labelManager.includes("_tracked.filter("), false, "no code path allocates the tracked working sets with filter");
});

test("lag-pass 8: the name-tag pass reuses its vectors", () => {
  const tags = bodyOf(renderer, /function _keepArmillaryNameTagsWhole\(\) \{([\s\S]*?)\n  \}/);
  assert.equal(tags.includes("new _THREE.Vector3(anchor"), false, "no per-tag projection vector is allocated");
  assert.equal(tags.includes("new _THREE.Vector3(keptX"), false, "no per-tag unprojection vector is allocated");
  assert.match(tags, /_tagScratchProjected\.current = new _THREE\.Vector3\(\);/, "the scratch itself is created once, lazily");
  assert.match(tags, /_tagScratchProjected\.current\.set\(anchor\.x, anchor\.y, anchor\.z\)/, "the projection rides the scratch");
  assert.match(tags, /_tagScratchDrawn\.current\.set\(keptX, keptY, projected\.z\)\.unproject\(_camera\)/, "the unprojection rides the scratch");
});
