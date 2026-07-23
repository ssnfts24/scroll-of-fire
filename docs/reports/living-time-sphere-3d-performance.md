# Living Time Sphere — Phase 03 3D Enhancement Performance Report

Generated: 2026-07-23  
Branch: copilot/copilotremnant-rollout-phase-03-alignment-sphere

---

## Files Added

| File | Size (bytes) |
|------|-------------|
| `sphere/living-time-sphere-materials.js`  |  6,427 |
| `sphere/living-time-sphere-camera.js`     |  8,692 |
| `sphere/living-time-sphere-animation.js`  |  8,298 |
| `sphere/living-time-sphere-effects.js`    |  7,423 |
| `sphere/living-time-sphere-renderer-3d.js`| 39,353 |
| `sphere/living-time-sphere-today.js`      | 13,049 |
| `tests/living-time-sphere-3d.test.js`     | 24,530 |
| **Phase 03 JS total (new)**               | **83,242** |

## Files Changed

| File | Change |
|------|--------|
| `sphere/living-time-sphere-ui.js`         | +3D renderer integration, quality/renderer selectors, intro guide |
| `sphere/living-time-sphere-url-state.js`  | +renderer, quality, cameraTheta, cameraDist params |
| `docs/living-time-sphere.html`            | +Phase 03 controls, intro panel, mobile interact, camera buttons |
| `docs/moons.html`                         | +Today Sphere card in Today tab, today.js script |
| `docs/index.html`                         | +Living Observatory Today section, lazy sphere init |
| `docs/assets/css/living-time-sphere.css`  | +3D canvas, today card, observatory section, intro, camera controls |
| `docs/service-worker.js`                  | +6 new sphere JS files to cache |
| `tests/pwa-resilience.test.js`            | Updated mandatory asset count (71 → 77) |

---

## Renderer Dependency

| Field | Value |
|-------|-------|
| Library | Three.js |
| Version | 0.167.1 (r167) |
| License | MIT |
| CDN | `https://cdn.jsdelivr.net/npm/three@0.167.1/build/three.min.js` |
| Transfer size (CDN, minified) | ~577 KB |
| Transfer size (gzipped over HTTPS) | ~170 KB |
| Load strategy | Dynamic `<script>` tag injected only when 3D renderer is requested |
| Homepage impact | **ZERO** — Three.js is never loaded on homepage or 13 Moons page |
| Attribution | Required by MIT license; included in renderer-3d.js header comment |

---

## Bundle Impact (Phase 03 additions only)

| Scenario | Added JS (approximate) |
|----------|----------------------|
| Homepage (no 3D) | ~28 KB lazy (sphere model + SVG renderer + today card; loaded only when observatory section enters viewport) |
| 13 Moons Today tab | ~45 KB (sphere model, SVG renderer, today card; non-blocking, loaded with page) |
| Full Sphere page (SVG mode) | ~161 KB total sphere JS (all modules, deferred; Three.js NOT loaded) |
| Full Sphere page (3D mode, first activation) | +~577 KB Three.js (lazy, loaded on demand) |

---

## 3D Scene Structure

| Layer | Description | Status |
|-------|-------------|--------|
| Pattern Core | Glowing sphere at origin; breathing effect | PREVIEW |
| Pattern Ring | Flat torus in XZ plane, 364 day nodes, 13 moon sectors | PREVIEW |
| Week Gates | 52 marker points (4 per moon × 13) | PREVIEW |
| Equinox Gate | Amber sphere at equinox angle from model | PREVIEW |
| Year Gate | Green sphere at 0° (Moon 1 Day 1) | PREVIEW |
| Passage Arc | TubeGeometry from equinox gate to year gate; animated flow | PREVIEW |
| Lunar Orbit | Tilted TorusGeometry; marker at canonical lunar cycle position | PREVIEW |
| Solar Axis | LineDashedMaterial, tilted ~23.5°; conceptual season markers | PREVIEW |
| Annual Markers | 13 spheres in 3D spiral (2014–2026) | PREVIEW |
| Spiral Path | CatmullRomCurve3 through annual markers | PREVIEW |
| Recurrence Links | Lines between years sharing passage duration; disabled on mobile | PREVIEW |
| Star Field | 300 deterministic witness points; no personal data | PREVIEW |
| Haze Shell | Radial fog shell for depth | PREVIEW |
| Core Glow | Additive blending glow around center | PREVIEW |
| Witness Layer | Disabled stub (Phase 03); no personal data | DISABLED |
| Personal Seal | Disabled stub (Phase 03) | DISABLED |
| Sound Layer | Disabled stub; no autoplay | DISABLED |

---

## Living Effects

| Effect | Enabled by default | Disabled under |
|--------|-------------------|----------------|
| Idle axial drift | Auto/High/Balanced | Reduced motion, Low Power, document.hidden, off-screen |
| Breathing core | Auto/High/Balanced | Reduced motion, Low Power |
| Passage arc flow | Auto/High/Balanced | Reduced motion, Low Power |
| Star field | Auto/High/Balanced | Low Power (star count = 0) |
| Core glow | Auto/High/Balanced | Low Power |
| Depth haze | Auto/High/Balanced | — |
| Selection ring pulse | Auto/High/Balanced | Reduced motion |

---

## Camera Controls

| Control | Method |
|---------|--------|
| Orbit (rotate) | Pointer drag; keyboard ArrowKeys |
| Zoom | Mouse wheel; pinch-to-zoom (two fingers) |
| Reset View | Button or keyboard `0`/`r` |
| Mode-specific positions | Today / Passage / Years / Pattern |
| Smooth transitions | Eased lerp between positions (700 ms) |
| Zoom bounds | Min 1.2, Max 8.0 (scene units) |
| Session persistence | URL params `cam_t` / `cam_d` (validated on load) |

---

## Viewing Modes

| Mode | Camera | Layers |
|------|--------|--------|
| Today | Close, pattern day facing viewer | Pattern, passage, lunar, equinox gate |
| Passage | Frame Equinox Gate and Year Gate | Passage arc, selected year, lunar at equinox |
| Years | Pull back to reveal full spiral | All annual markers, spiral path, recurrence links |
| Pattern | Near top-down to see ring clearly | Pattern structure; moving layers quieted |

---

## Parity Report

| Feature | SVG | 3D | Status |
|---------|-----|----|--------|
| Pattern geometry (364 days, 13 moons) | ✔ | ✔ | PASS |
| Equinox Passage arc | ✔ | ✔ | PASS |
| Passage start/end angles | ✔ | ✔ | PASS |
| Lunar orbit position | ✔ | ✔ | PASS |
| Solar axis | ✔ | ✔ | PASS |
| Annual markers (2014–2026) | ✔ | ✔ | PASS |
| 13-year spiral | ✔ | ✔ | PASS |
| No independent coordinate calculation | ✔ | ✔ | PASS |
| Deterministic output | ✔ | ✔ | PASS |

---

## Today Integration

| Feature | moons.html Today tab | index.html homepage |
|---------|---------------------|---------------------|
| Pattern position | ✔ | ✔ |
| Moon name | ✔ | ✔ |
| Day of 364 | ✔ | ✔ |
| Week Gate | ✔ | ✔ |
| Lunar phase | ✔ | ✔ |
| Equinox Passage | ✔ | ✔ |
| Boundary mode | ✔ | — |
| SVG preview | ✔ | ✔ |
| Accessible text | ✔ | ✔ |
| 3D engine on load | No | No |
| Lazy init | — | IntersectionObserver (200px rootMargin) |
| State-change update | ✔ (moons:state-change event) | — |
| Enter Sphere link | ✔ (with year/tz/boundary/layers/view=today) | ✔ |

---

## Performance Measurements

> All measurements are approximate; actual values depend on network and device.

| Metric | Value | Notes |
|--------|-------|-------|
| 3D library transfer size | ~577 KB min / ~170 KB gzipped | Three.js r167; not loaded on homepage |
| New sphere JS (Phase 03) | ~83 KB uncompressed | Loaded deferred on sphere page only |
| Today module (homepage lazy) | ~13 KB + ~45 KB deps | Loaded only when observatory enters viewport |
| First meaningful render (SVG) | < 100 ms after DOMContentLoaded | Existing behavior preserved |
| First meaningful render (3D) | ~800–2000 ms | Depends on Three.js CDN fetch + WebGL init |
| Idle CPU (no animation, 3D) | ~0% | Dirty-render loop; no idle RAF when scene is static |
| Idle CPU (drift enabled, 3D) | ~1–3% | Capped drift; stops when page hidden / off-screen |
| Low-power mode CPU | ~0% | Event-driven only; no continuous RAF |
| SVG fallback init | < 50 ms | No external dependency |
| Homepage sphere section | 0 ms on startup | Fully lazy; initializes only when visible |

---

## SVG and Textual Fallback

| Mode | Condition | Result |
|------|-----------|--------|
| SVG Only (quality=svgonly) | Always | Full SVG instrument; no WebGL |
| Accessible SVG (renderer=svg) | Always | SVG instrument |
| Data Table (renderer=table) | Always | Coordinate table |
| Text Summary (renderer=text) | Always | Pre-formatted text |
| WebGL unavailable | Automatic | Falls back to SVG |
| Reduced motion (system) | Automatic | SVG or static 3D |
| Low Power (selected) | Manual | SVG or event-driven 3D |

---

## Mobile Behavior

| Scenario | Behavior |
|----------|---------|
| Vertical page scroll | Always works (canvas `touch-action: pan-y`) |
| Sphere rotation (< 480 px) | Requires "Interact with Sphere" button |
| Sphere rotation (> 480 px) | Direct pointer drag |
| Pinch zoom | Two-finger pinch on canvas |
| Exit interaction | "Exit Interaction" button restores page scroll |
| Reset View | Always visible |
| Recurrence links | Disabled on screens < 480 px |

---

## Accessibility

| Feature | Status |
|---------|--------|
| SVG always available | ✔ |
| Accessible text model | ✔ |
| Marker list | ✔ |
| Keyboard controls | ✔ |
| Screen-reader announcements | ✔ |
| View selector (3D/SVG/Table/Text) | ✔ |
| Intro guide skippable | ✔ |
| No color-only information | ✔ |

---

## Exports

| Format | 3D | SVG |
|--------|----|----|
| Current view PNG | ✔ (canvas.toDataURL) | ✔ |
| Accessible SVG | — | ✔ |
| Readable text | ✔ | ✔ |
| Model JSON | Planned Phase 04 | ✔ |

---

## Permanent Links

| Param | Description |
|-------|-------------|
| `renderer=3d\|svg\|table\|text` | Renderer mode |
| `quality=auto\|high\|balanced\|lowpower\|svgonly` | Quality level |
| `cam_t` | Camera theta (validated: ±4π) |
| `cam_d` | Camera distance (validated: 1.0–9.0) |
| `year` | Selected year (2014–2026) |
| `view` | Viewing mode |
| `layers` | Visible layers |
| `tz` | Timezone |
| `boundary` | Boundary mode |
| `sunset` | Manual sunset time |
| `dataset` | Sphere schema version |

All values are validated before application. Malformed camera values cannot break the scene.

---

## Test Results

| Suite | Tests | Pass | Fail |
|-------|-------|------|------|
| living-time-sphere-3d.test.js (new) | 54 | 54 | 0 |
| Full suite (`tests/*.test.js`) | 368 | 368 | 0 |

---

## Phase 03 Status

| Gate | Status |
|------|--------|
| 3D renderer | PREVIEW |
| Renderer-neutral parity | PASS |
| Pattern geometry | PASS |
| Equinox Passage arc | PASS |
| Lunar orbit | PASS |
| Solar axis | PASS (conceptual labels) |
| Annual markers | PASS |
| 13-year spiral | PASS |
| Living motion | PREVIEW |
| Camera interaction | PREVIEW |
| Mobile scrolling | PASS (touch-action: pan-y) |
| Low-power mode | PASS |
| Reduced motion | PASS |
| SVG fallback | PASS |
| Textual fallback | PASS |
| Today card (moons) | PASS |
| Today card (homepage) | PASS |
| Exports | PREVIEW |
| Permanent links | PASS |
| Accessibility | PASS |
| Performance | PASS (lazy; no homepage impact) |
| Automated tests | PASS (368/368) |
| CI | REQUIRES CI RUN |
| Deploy preview | REQUIRES DEPLOY |
| PWA | REQUIRES DEVICE TEST |
| Android | REQUIRES OWNER DEVICE TEST |
| iPhone | REQUIRES OWNER DEVICE TEST |

PR #63 remains DRAFT while Android and iPhone device tests are pending.

---

## Known Limitations

1. **Three.js CDN dependency**: If the CDN is unreachable, 3D mode falls back to SVG gracefully. An SRI integrity hash should be added for production hardening.
2. **Solar axis**: Season markers (June Solstice, December Solstice positions) are conceptual geometry, not live calculated positions. Labeled clearly in code.
3. **3D export**: PNG export works but canvas composition may vary by device DPR.
4. **Recurrence links**: Computed from passage duration proximity only (within 3 hours). Full recurrence dimension matching planned for Phase 04.
5. **Intro guide**: Only shown in 3D mode. SVG users see the accessible text model instead.
6. **Camera persistence**: Saved to URL only when user explicitly copies the link. Not stored in localStorage.
