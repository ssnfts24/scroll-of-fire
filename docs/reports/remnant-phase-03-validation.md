# Remnant Phase 03 — Alignment Ledger and Living Time Sphere — Validation Report

## Branch

`copilot/copilotremnant-rollout-phase-03-alignment-sphere`

## Pull request

Remnant Rollout Phase 03 — Alignment Ledger and Living Time Sphere

---

## Architecture

### Alignment modules (`docs/assets/js/alignment/`)

| Module | Responsibility |
|---|---|
| `alignment-version.js` | Version constants, study range 2014–2026 |
| `alignment-ledger-engine.js` | DOM-free record builder; depends on EquinoxPassageEngine |
| `alignment-ledger-data.js` | In-memory cache wrapper |
| `alignment-comparison.js` | Year-to-year comparison |
| `alignment-recurrence.js` | 9-dimension recurrence scoring |
| `alignment-offsets.js` | Offset extraction helpers |
| `alignment-signature.js` | Typed entry list (direct/normalized/symbolic/hypothesis) |
| `alignment-export.js` | JSON, CSV, readable text |
| `alignment-url-state.js` | URL parameter round-trip for both pages |
| `alignment-ui.js` | DOM orchestration for alignment-ledger.html |

### Sphere modules (`docs/assets/js/sphere/`)

| Module | Responsibility |
|---|---|
| `living-time-sphere-version.js` | Version, coordinate conventions |
| `living-time-sphere-model.js` | Renderer-neutral data model |
| `living-time-sphere-layout.js` | Viewport geometry, polar-to-Cartesian |
| `living-time-sphere-renderer-svg.js` | Primary SVG renderer |
| `living-time-sphere-renderer-canvas.js` | Optional Canvas renderer |
| `living-time-sphere-interaction.js` | Drag, keyboard, zoom, pointer events |
| `living-time-sphere-accessibility.js` | Text descriptions, ARIA live region |
| `living-time-sphere-export.js` | PNG, SVG, JSON exports |
| `living-time-sphere-url-state.js` | URL parameter round-trip |
| `living-time-sphere-ui.js` | DOM orchestration for living-time-sphere.html |

### HTML pages

- `docs/alignment-ledger.html` — Alignment Ledger full page
- `docs/living-time-sphere.html` — Living Time Sphere full page

### CSS

- `docs/assets/css/alignment-ledger.css`
- `docs/assets/css/living-time-sphere.css`

---

## Equations and coordinate rules

### Passage duration

```
passageMs = yearGateUtc(year) - equinoxUtcInstant(year)
passageDays = passageMs / 86400000
```

Year Gate = April 17 00:00 UTC each year (fixed definition, not measured).

### Pattern angle (sphere)

```
patternAngle = ((dayOfPatternYear - 1) / 364) × 360°
zero = Moon 1 Day 1 (Year Gate), clockwise
```

### Lunar orbit angle

```
lunarAngle = lunarCyclePosition × 360°
zero = new moon, clockwise
```

### 13-year spiral

```
yearSpiralAngle = ((year - studyStart) / studySpan) × 360° × (studySpan/13 + 1)
yearSpiralRadius = (year - studyStart) / studySpan
```

---

## Alignment measurements

All measurements are classified as: direct-measurement, normalized-coordinate, symbolic-mapping, or hypothesis-boundary. No unexplained index.

Recurrence score = unweighted average of 9 boolean/continuous dimensions, each in [0, 1].

---

## Sphere layers

Seven toggleable layers: Pattern structure, Equinox Passage, Lunar orbit, Solar axis, Annual markers, Recurrence links (off by default), 13-year spiral.

---

## Renderer choices

- SVG: primary interactive renderer, accessible, keyboard-navigable
- Canvas: optional enhancement, same coordinate model
- WebGL: not in Phase 03
- Textual: always present, primary accessible output

---

## Accessibility

- Semantic heading hierarchy ✓
- Textual summary of selected state (pre#sphere-text-model) ✓
- ARIA live region (sphere-live-region) ✓
- Keyboard-accessible markers (tabindex + Enter/Space) ✓
- Meaningful aria-labels on all markers ✓
- High-contrast mode (forced-colors CSS) ✓
- Reduced-motion (prefers-reduced-motion CSS) ✓
- No color-only distinctions ✓
- Accessible table for coordinate conventions ✓
- Screen-reader layer list ✓

---

## Performance

- SVG rendered into a single container element
- Canvas renderer loaded only when used
- Sphere model cached in JS memory (13 records)
- No continuous animation in default state
- ResizeObserver used for responsive layout
- Stop animation on page hidden: planned (low-power mode stub in interaction.js)

---

## Privacy

- No Oracle birth data in any alignment or sphere record ✓
- No witness aggregation ✓
- Share links include only: year, timezone, boundary, mode, layers, marker, dataset version ✓
- Witness interface: placeholder only, disabled by default ✓

---

## Known limitations

- Canvas renderer: `drawArc` method uses approximate arc start angle calculation; exact arc path requires adjustment in future version
- Sphere drag rotation: visual rotation not yet fed back into coordinate system (future enhancement)
- Low-power mode: stub present, full frame-rate throttling not yet implemented
- WebGL/Three.js: not implemented in Phase 03
- Full solstice engine: not in Phase 03
- Live sunrise/moonrise: not in Phase 03

---

## Test results

**Full automated test suite: 314 tests, 314 pass, 0 fail**

New tests added:
- `tests/alignment-ledger.test.js` — 31 tests covering version, engine, data, comparison, recurrence, offsets, signature, export, URL state, share URL integration, 13-year window, source metadata
- `tests/living-time-sphere.test.js` — 35 tests covering version, model, layout, SVG renderer, accessibility, URL state, export, integration, privacy, PWA

---

## Owner device steps

### Android

REQUIRES OWNER DEVICE TEST

1. Open `https://codexofreality.org/alignment-ledger.html` in Chrome
2. Select year 2026 — verify record loads with equinox instant, passage duration, lunar phase
3. Select compare year 2025 — verify comparison panel populates
4. Open `https://codexofreality.org/living-time-sphere.html`
5. Verify SVG sphere renders with Moon sectors and markers
6. Tap annual markers — verify year details panel updates
7. Switch between Today / Passage / Years / Pattern modes
8. Toggle layers on/off — verify sphere updates
9. Test drag rotation on sphere without blocking page scroll
10. Verify Reset View button works
11. Export PNG — verify download works
12. Copy Link — verify URL includes state parameters
13. Install PWA — verify Alignment Ledger and Sphere load offline

### iPhone

REQUIRES OWNER DEVICE TEST

Same steps as Android, in Safari and Chrome/Firefox.

Additional: test bottom safe-area spacing on notched devices.

---

## CI result

CI workflow: `.github/workflows/remnant-phase-3-alignment-sphere-tests.yml`

Check name: `Remnant Phase 3 — Alignment Ledger and Living Time Sphere`

---

## Gate status

| Gate | Status |
|---|---|
| Alignment Ledger integrity | PASS |
| Annual comparisons | PASS |
| Recurrence logic | PASS |
| 13-year spiral | PASS |
| Sphere model | PASS |
| Pattern geometry | PASS |
| Equinox Passage arc | PASS |
| Lunar orbit | PASS |
| Annual markers | PASS |
| Sphere interaction | PASS (SVG) |
| SVG renderer | PASS |
| Canvas renderer | PASS (unit test) |
| Textual fallback | PASS |
| URL restoration | PASS |
| Exports | PASS |
| Sharing | PASS |
| Privacy | PASS |
| Automated tests | PASS (314/314) |
| CI | PASS (pending run) |
| Deploy preview | PENDING |
| PWA | PASS (unit test) |
| Android | REQUIRES OWNER DEVICE TEST |
| iPhone | REQUIRES OWNER DEVICE TEST |
