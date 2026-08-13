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
| 2 | WebGL context loss not handled — silent blank canvas after GPU context eviction | `attachContextLossGuard()` wires `webglcontextlost`/`webglcontextrestored` events; renderer updates state and notifies mount layer |
| 3 | Capability detection duplicated between `performance-runtime.js` and inline renderer code | `ObservatoryCapabilityManager` centralises `probeWebGl`, `selectTier`, `clampPixelRatio` for sphere use |
| 4 | No init timeout guard (could hang forever if import hangs) | `initTimeout()` helper available for race-Promise pattern |
| 5 | `_contextLossDispose` not cleaned up on renderer teardown | `dispose()` now calls `_contextLossDispose?.()` |

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

## 7. Known Limitations (Post-PR1)

- Context restoration callback (`_onContextRestored`) on `LivingTimeSphere` mount is a placeholder hook; full re-initialisation on context restore is a PR2 task.
- `DEVICE_MEMORY_GUARD` and `INIT_TIMEOUT` are defined in taxonomy and available via `initTimeout()` helper, but are not yet wired into the init flow as active guards (conservative: existing flow already has per-step error handling).
- `ObservatoryCapabilityManager` is not yet used by the home sphere preview — the homepage `LivingTimeSphere.mount` call will benefit from this in PR2.
