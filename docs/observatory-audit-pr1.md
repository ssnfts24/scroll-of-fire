# Observatory PR1 — Reliability + Architecture Audit

> **Status:** PR1 implementation complete  
> **Scope:** Reliability hardening, fallback reason taxonomy, capability/performance tier manager, WebGL context-loss guard, shared architecture scaffolding foundations  
> **Date:** 2026-08

---

## 1. Audit Findings

### 1.1 Living Time Sphere Page (`docs/living-time-sphere.html`)

| Area | Finding |
|---|---|
| Script loading | All sphere modules loaded with `defer` in dependency order. SVG/Canvas renderers load before 3D. |
| Initialisation | Mount script (`living-time-sphere-mount.js`) calls `LivingTimeSphere.mount()` on `DOMContentLoaded`. |
| URL state | `LivingTimeSphereUrlState` handles all query params including backward-compatible `view=today&source=home`. |
| Fallback path | SVG renderer is always loaded and remains available when WebGL fails. |
| Mobile | Canvas sets `touch-action: pan-y` preserving vertical scroll; interact-mode button gates drag on small screens. |

### 1.2 Sphere Renderers

| Renderer | File | Notes |
|---|---|---|
| 3D (WebGL/Three.js) | `living-time-sphere-renderer-3d.js` | Primary renderer; lazy-imports Three.js r167 from local vendor path. |
| SVG | `living-time-sphere-renderer-svg.js` | Fallback; always available. |
| Canvas 2D | `living-time-sphere-renderer-canvas.js` | Minimal fallback for preview contexts. |

### 1.3 Three.js / WebGL Initialisation

- Three.js is loaded via a **dynamic `import()`** resolved against `document.baseURI`. This works on both GitHub Pages (`/scroll-of-fire/`) and Netlify (`/`).
- `loadThreeJs()` guards against concurrent calls using a shared promise (`_loadPromise`).
- A `requestAnimationFrame` delay is inserted before reading container dimensions to avoid a race with layout.
- **Pre-PR1:** fallback reason codes were ad-hoc strings (`"webgl-unavailable"`, `"three-load-failed"`, etc.).
- **Post-PR1:** canonical reason codes from `ObservatoryCapabilityManager.FALLBACK_REASONS` are used consistently.

### 1.4 Camera / Controls

- `LivingTimeSphereCamera` handles orbit, zoom, drift, and mode-specific camera positions.
- Pointer events are wired in `_wirePointerEvents`; touch handled with multi-pointer pinch/pan detection.
- Resize wired via `ResizeObserver` with debounce.

### 1.5 Label / Connection Renderers

- `LivingTimeSphereLabel​Manager` projects 3D moon positions to screen-space HTML overlays.
- Connection lines drawn as Three.js `LineSegments` via `LivingTimeSphereConnections`.

### 1.6 Pattern Time / Calendar Integration

- All calendar data consumed from `PatternCalendar` (13×28 + year/week gate boundaries).
- `LivingTimeSphereModel` builds the geometry data model — no recalculation in renderer.
- `LivingTimeSphereLayout` converts model to 3D coordinate positions.

### 1.7 Solar / Lunar / Astronomical Modules

- `EquinoxPassageEngine`, `LunarAtEquinox`, `AstronomySources` provide astronomical data.
- `AlignmentLedgerEngine` / `AlignmentLedgerData` provide year-record data.
- **No duplication found** between homepage sphere and observatory for core calculations — both consume `LivingTimeSphereModel`.

### 1.8 Home Sphere vs Observatory Divergence

- Homepage (`index.html`) uses `LivingTimeSphere.mount()` with `fullPage: false` — same mount code path, different container size.
- No detached mini-engine; shared architecture is already in use.

### 1.9 Render Loop Strategy

- `LivingTimeSphereAnimation` implements a **dirty-render loop**: frame is only rendered when marked dirty.
- Idle drift is capped; loop pauses on `document.hidden` (via `attachPageVisibility()`).
- `IntersectionObserver` used to pause rendering when canvas leaves viewport.

### 1.10 Mobile Touch / Scroll Conflicts

- `touch-action: pan-y` set on canvas element preserves native scroll.
- On small screens, an "interact" button gates orbit/zoom interactions to prevent accidental page-scroll capture.
- `pointer-events` on floating label set to `none`.

### 1.11 Error / Fallback Paths (Pre-PR1)

| Trigger | Pre-PR1 reason string | Canonical PR1 code |
|---|---|---|
| `detectWebGl()` returns false | `"webgl-unavailable"` | `WEBGL_UNSUPPORTED` |
| Three.js dynamic import fails | `"three-load-failed"` | `THREE_IMPORT_FAILED` |
| `WebGLRenderer` constructor throws | `"webgl-context-failed"` | `CANVAS_INIT_FAILED` |
| SVG-only quality preset | `"quality-svgonly"` | `QUALITY_SVGONLY` |
| Unexpected exception | `"init-exception"` | `INIT_EXCEPTION` |
| Context lost (new in PR1) | *(not handled)* | `CONTEXT_LOST` |
| Init timeout (taxonomy only) | *(not handled)* | `INIT_TIMEOUT` |
| Device memory guard (taxonomy) | *(not handled)* | `DEVICE_MEMORY_GUARD` |

### 1.12 Duplicated Calendar/Astro Calculations

- No significant duplication found. `LivingTimeSphereModel` is the single authoritative consumer of calendar/astro modules.
- `performance-runtime.js` contains device-tier detection logic; `ObservatoryCapabilityManager` now centralises this for the sphere specifically.

---

## 2. Before → After Architecture

### Before PR1

```
living-time-sphere.html
  └── Script stack (defer, dependency order)
       ├── PatternCalendar / Alignment / Astronomy modules
       ├── Sphere: version / model / state / layout / connections
       ├── SVG renderer  ← always loaded (fallback)
       ├── Canvas renderer ← always loaded (minimal preview)
       ├── Materials / Effects / Camera / Animation / LabelManager
       ├── 3D renderer  ← primary; ad-hoc fallback reason strings
       ├── Environment stack
       ├── Live-data / Interaction / Accessibility / Export
       ├── URL state / Mount / Today card / UI
       └── Inline init (DOMContentLoaded → LivingTimeSphere.mount)

Fallback path: ad-hoc reason strings, no context-loss handling
Capability detection: inline in renderer / performance-runtime
```

### After PR1

```
living-time-sphere.html
  └── Script stack (defer, dependency order)
       ├── PatternCalendar / Alignment / Astronomy modules
       ├── Sphere: version / model / state / layout / connections
       ├── SVG renderer  ← always loaded (fallback)
       ├── Canvas renderer ← always loaded (minimal preview)
       ├── [NEW] ObservatoryCapabilityManager  ← loaded before 3D
       │     ├── FALLBACK_REASONS taxonomy (canonical codes)
       │     ├── PERFORMANCE_TIERS
       │     ├── probeWebGl / selectTier / clampPixelRatio
       │     ├── attachContextLossGuard  ← new PR1 hardening
       │     └── initTimeout / mapLegacyReason / describeReason
       ├── Materials / Effects / Camera / Animation / LabelManager
       ├── 3D renderer  ← uses canonical FALLBACK_REASONS codes
       │     └── attachContextLossGuard called on canvas init
       ├── Environment stack
       ├── Live-data / Interaction / Accessibility / Export
       ├── URL state / Mount / Today card / UI
       └── Inline init (DOMContentLoaded → LivingTimeSphere.mount)

Fallback path: canonical taxonomy, context-loss events handled
Capability detection: centralised in ObservatoryCapabilityManager
```

---

## 3. Root Causes Fixed in PR1

| # | Root Cause | Fix |
|---|---|---|
| 1 | Ad-hoc fallback reason strings spread across renderer | `ObservatoryCapabilityManager.FALLBACK_REASONS` taxonomy; renderer updated to use canonical codes |
| 2 | WebGL context loss not handled — silent blank canvas after GPU context eviction | `attachContextLossGuard()` wires `webglcontextlost`/`webglcontextrestored` events; renderer stops animation loop, mount shows SVG fallback with preserved state |
| 3 | Context restoration was a placeholder hook | Mount now handles restoration: teardown stale resources, reinit via `activate3d()`, cap at 3 retries, generation guard prevents stale init from replacing active renderer |
| 4 | Capability detection duplicated between `performance-runtime.js` and inline renderer code | `ObservatoryCapabilityManager` is now the authoritative tier/DPR path; `selectTier()` called in mount, `clampPixelRatio(tier)` called in renderer |
| 5 | No init timeout guard (could hang forever if import hangs) | `activate3d()` now races `init()` against `ObservatoryCapabilityManager.initTimeout(15000)` |
| 6 | `_contextLossDispose` not cleaned up on renderer teardown | `teardown()` calls `_contextLossDispose?.()` |
| 7 | `ObservatoryCapabilityManager` not loaded on homepage | Added to `home-observatory-instrument.js` DEPENDENCIES before `living-time-sphere-mount.js` |
| 8 | `DEVICE_MEMORY_GUARD` could never occur (all low-memory paths went to LOWPOWER) | Clarified semantics: `GENUINE_3D_REFUSAL_MEMORY_GIB` (0.5 GiB) is the genuine refusal threshold; low-memory devices above it get LOWPOWER (functional 3D) |
| 9 | Quality tier selection bypassed capability manager | Mount uses `selectTier()` as single authoritative source, maps to `QUALITY_PRESETS` via helper |
| 10 | `performance-runtime.js` made independent capability decisions | Documented delegation: performance-runtime handles page CSS/media; ObservatoryCapabilityManager handles Observatory tier. Profile published on `globalThis._sofPerformanceProfile` for `selectTierFromProfile()` |

---

## 4. Architecture Module Inventory (PR1 Status)

| # | Module / Boundary | Status | File |
|---|---|---|---|
| 1 | Time/calendar engine adapter | ✅ existing | `calendar/pattern-calendar.js` |
| 2 | Astronomical data adapter | ✅ existing | `astronomy/astronomy-sources.js` |
| 3 | Observatory state store/controller | ✅ existing | `sphere/living-time-sphere-state.js` |
| 4 | Geometry data generation interface | ✅ existing | `sphere/living-time-sphere-model.js` + `layout.js` |
| 5 | Layer render contract | ✅ existing | `sphere/living-time-sphere-renderer-3d.js` (environment interface) |
| 6 | Camera/navigation controller | ✅ existing | `sphere/living-time-sphere-camera.js` |
| 7 | Interaction/picking controller | ✅ existing | `sphere/living-time-sphere-interaction.js` |
| 8 | Unified inspector model contract | ✅ existing | `sphere/living-time-sphere-model.js` |
| 9 | URL serialization/deserialization helper | ✅ existing | `sphere/living-time-sphere-url-state.js` |
| 10 | Capability/performance tier manager | ✅ **new PR1** | `sphere/observatory-capability-manager.js` |

---

## 5. Testing Instructions

### WebGL Available Path
1. Open `docs/living-time-sphere.html` in a WebGL-capable browser.
2. Verify 3D sphere renders; no fallback panel shown.
3. Check console: no `[Observatory]` warning lines.

### WebGL Unavailable Fallback Path
1. Use browser DevTools → Disable hardware acceleration (or use a browser flag).
2. Reload `docs/living-time-sphere.html`.
3. Verify SVG fallback renders; fallback panel shows "3D unavailable" with a reason code.
4. Check console for `[Observatory]` warn message with `WEBGL_UNSUPPORTED`.

### Forced Init Failure (dev simulation)
```js
// In browser console before page load:
localStorage.setItem("sof_force_svg", "1");
```
Or navigate with `?renderer=svg` to force SVG.

### Context Loss Simulation
```js
// After 3D is initialised, in DevTools console:
const ext = document.querySelector("canvas").__proto__; // not standard
// Use WebGL extension to simulate:
const gl = document.querySelector(".living-time-sphere-3d-canvas").getContext("webgl2")
  || document.querySelector(".living-time-sphere-3d-canvas").getContext("webgl");
const loseCtx = gl?.getExtension("WEBGL_lose_context");
loseCtx?.loseContext();  // triggers context loss
// After 2s: loseCtx?.restoreContext();  // triggers restoration
```
Expected: console warns `[LivingTimeSphere] 3D context lost (CONTEXT_LOST)`.

### URL Navigation
- `?view=today&source=home` — loads today view (homepage handoff preserved).
- `?year=2026&view=pattern` — loads pattern view for 2026.
- Back/forward buttons restore URL state via `parseSphereUrl`.

### Homepage → Observatory Handoff
1. Click sphere on homepage.
2. Verify navigation to `living-time-sphere.html?view=today&source=home`.
3. Verify today view loads correctly.

### Mobile Interaction Sanity
1. Open on mobile or use DevTools device emulation.
2. Verify vertical page scroll works on the sphere page (not trapped).
3. Tap "Interact with Sphere" button; verify orbit/zoom now works.
4. Tap a day node; verify inspector opens.

---

## 6. Migration Notes for PR2 / PR3 / PR4

- **PR2** (Solar/Lunar Shells): `ObservatoryCapabilityManager.selectTier()` and `clampPixelRatio()` should be used to gate new shell rendering at high/balanced tiers only.
- **PR2** (Full Layer Manager): `PERFORMANCE_TIERS` + `FALLBACK_REASONS` provide the vocabulary for layer-preset selection and graceful degradation.
- **PR3** (Historical Depth Visual): No breaking changes from PR1; all existing URL params preserved.
- **PR4** (A/B / Comparison UI): `ObservatoryCapabilityManager.initTimeout()` can be used to race parallel renderer initialisations.
- `mapLegacyReason()` provides backward compatibility if any external code still produces the old string codes.

---

---

## 7. PR1 Completion — Reliability Systems Wired (August 2026)

The following items were identified as incomplete in the initial PR1 audit and have now been fully wired to runtime behavior.

### 7.1 Context-Loss Recovery (was: placeholder)

`living-time-sphere-mount.js` now wires real context-loss recovery:

- On `webglcontextlost`: animation loop stopped, `active3d` cleared, SVG fallback rendered with preserved observatory state, `notify()` called.
- On `webglcontextrestored`: stale renderer torn down, `activate3d()` rescheduled, capped at 3 retries to prevent infinite loops.
- `mounted` flag prevents callbacks from firing after teardown.
- Observatory state (calendar model, selected day, selected year, view mode, layers) is **never rebuilt** due to a renderer transition — it survives as authoritative across 3D ↔ SVG switches.

`living-time-sphere-renderer-3d.js`:
- Accepts `onContextLost` / `onContextRestored` as init parameters (not `globalThis.LivingTimeSphere._onContextLost` which was a frozen non-existent property).
- Stops the animation loop (`LivingTimeSphereAnimation.stop()`) on context loss.
- `CONTEXT_LOST` fallback reason is properly surfaced through `_lastInitError`.

### 7.2 Init Timeout Wired (was: helper only)

`activate3d()` in mount now races `LivingTimeSphereRenderer3d.init()` against `ObservatoryCapabilityManager.initTimeout(15000)`.

- On timeout: `INIT_TIMEOUT` logged, SVG fallback remains active, no `Promise` rejection propagates.
- A **generation counter** (`initGen` / `thisGen`) ensures that if a stale init later completes after the timeout has already caused fallback, the stale result is discarded and the stale renderer torn down.

### 7.3 Capability Manager is Authoritative for Tier/DPR (was: helper only)

`activate3d()` now calls:
- `ObservatoryCapabilityManager.selectTier({ webglAvailable, override })` — single authoritative tier decision.
- Maps tier to `LivingTimeSphereM.QUALITY_PRESETS` via `_tierToQualityPreset()`.
- Passes `tier` to `LivingTimeSphereRenderer3d.init()`.

`LivingTimeSphereRenderer3d.init()` now uses:
- `ObservatoryCapabilityManager.clampPixelRatio(tier, devicePixelRatio)` for authoritative DPR capping.
- Falls back to `quality.pixelRatioMax` only if capability manager is unavailable.

**Tier → 3D behavior mapping:**
- `HIGH` / `BALANCED` → full functional 3D (different antialias / DPR caps)
- `LOWPOWER` → functional 3D with reduced cost (DPR capped at 1.5, lowpower WebGL power preference)
- `MINIMAL` → SVG fallback (no 3D attempt)

### 7.4 Duplicate Capability Decisions Eliminated

**Ownership document:**
- `performance-runtime.js` — page-level decisions: CSS classes (`sof-reduced-motion`, `sof-constrained-device`), image/iframe lazy loading, decorative media pausing. Publishes profile on `globalThis._sofPerformanceProfile` and via `sof:performance-profile` event.
- `ObservatoryCapabilityManager` — Observatory-specific decisions: WebGL tier, quality preset, DPR cap, init timeout, context-loss handling. Exposes `selectTierFromProfile(profile)` to consume the runtime profile without re-probing the device.

Neither system independently decides the other's domain.

### 7.5 Homepage Uses Same Capability Path (was: not wired)

`home-observatory-instrument.js` now includes `sphere/observatory-capability-manager.js` in its `DEPENDENCIES` array, loaded **before** `living-time-sphere-mount.js`. This ensures:
- The same `selectTier()` / `clampPixelRatio()` / `initTimeout()` path is available when `LivingTimeSphere.mount()` is called from the homepage.
- There is no separate reliability implementation for the homepage preview.
- The homepage may use `renderer: "svg"` for its compact preview, but this is a legitimate lighter preset choice, not a missing capability-manager integration.

### 7.6 DEVICE_MEMORY_GUARD Semantics Clarified

`DEVICE_MEMORY_GUARD` now has precise semantics:
- Reserved for devices where `navigator.deviceMemory < GENUINE_3D_REFUSAL_MEMORY_GIB` (0.5 GiB) — genuine hardware refusal.
- Devices with 0.5–2 GiB receive `LOWPOWER` tier (functional 3D with reduced cost).
- `GENUINE_3D_REFUSAL_MEMORY_GIB` constant exported on capability manager.
- Low-memory ≠ automatic failure.

### 7.7 Fallback Transitions are Stateful

Observatory state (`state`, `sceneData`) lives in the `mount()` closure and is independent of the active renderer. A switch from 3D → SVG or SVG → 3D does not rebuild the calendar/time model. This architecture is correct for the coming layered PR2.

### 7.8 End-to-End Reliability Tests Added

New test file: `tests/observatory-reliability.test.js` — 42 integration/regression tests covering:
- WebGL unsupported → SVG fallback
- Capability manager presence and API
- `GENUINE_3D_REFUSAL_MEMORY_GIB` threshold behavior
- `selectTierFromProfile` integration
- `clampPixelRatio` DPR caps per tier
- `initTimeout` rejection mechanics
- `attachContextLossGuard` — onLost, onRestored, dispose
- Stateful fallback: observatory state preserved across renderer switch
- Teardown lifecycle
- Dispose/remount pattern
- Homepage dependency ordering
- Observatory full-page capability-manager ordering
- Mount module structural assertions (selectTier, initTimeout, Promise.race, generation guard, onContextLost/Restored, teardown sets mounted=false)
- Renderer 3D structural assertions (tier param, clampPixelRatio, onContextLost/Restored params, stops animation on context loss)
- DEVICE_MEMORY_GUARD semantics
- performance-runtime profile delegation
- Canvas touch-action: pan-y (mobile vertical scroll preservation)
- DPR cap for all tiers
- 13 Moons / calendar module integrity

All 21 test files (253+ tests) pass.

### 7.9 Mobile Reliability

The following mobile-specific reliability properties are verified or preserved:
- **Vertical scroll**: `touch-action: pan-y` on canvas element (verified in structural test).
- **DPR cap**: `clampPixelRatio(tier, dpr)` caps DPR to ≤ 2.5 (HIGH), ≤ 2.0 (BALANCED), ≤ 1.5 (LOWPOWER). Prevents GPU overload on retina/high-DPI displays.
- **Background/foreground lifecycle**: `LivingTimeSphereAnimation.attachPageVisibility()` pauses the render loop on `document.hidden`. Context restoration capped at 3 attempts.
- **Orientation / resize**: `ResizeObserver` + debounce in renderer handles orientation changes.
- **Context recovery**: Multiple canvases prevented by `mounted` flag + generation guard — stale init results are torn down before they can append a second canvas.
- **Interact mode**: Pointer event gating preserved; not changed in this PR.
- **Pinch zoom**: Not changed in this PR; handled by `LivingTimeSphereCamera` multi-pointer detection.

---

## 8. Known Limitations (Post-PR1 Completion)

The following limitations remain. All core reliability systems are now active.

| # | Limitation | Status |
|---|---|---|
| 1 | Context restoration tests require a real GPU to fully exercise the restore path | Manual testing required; automated tests cover the callback wiring and structural guard |
| 2 | `initTimeout` races against a 15s wall clock; very slow Three.js imports on cellular/proxy networks may still trigger fallback | Acceptable — SVG fallback remains functional |
| 3 | PR2 PR-level visualization work (semantic zoom, solar/lunar shells, radial labels) is not in this PR | Intentional scope boundary |
| 4 | The `selectTierFromProfile()` / `_sofPerformanceProfile` integration is wired but not yet consumed by mount (`selectTier()` is sufficient for current needs) | Available for PR2 if dual-signal probing is needed |
| 5 | Homepage sphere preview uses SVG-only (`renderer: "svg"` option); capability manager is loaded and available but not deciding quality since 3D is not attempted | Intentional — homepage uses lighter preset as designed |

