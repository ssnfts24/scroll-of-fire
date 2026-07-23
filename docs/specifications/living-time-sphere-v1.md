# Living Time Sphere — Specification v1

## Version

`living-time-sphere/1.0.0`

## Purpose

The Living Time Sphere is an interactive visual interface for the 13 Moons Remnant Living Time Observatory. It integrates the fixed Pattern Calendar with moving astronomical cycles. It is a data interface, not a decorative animation.

## Coordinate conventions

All angles are in **degrees**, measured **clockwise** from the **top (12 o'clock = 0°)**.

| Coordinate | Zero position | Range | Direction |
|---|---|---|---|
| `patternAngle` | Moon 1 Day 1 (Year Gate) | [0, 360) | Clockwise |
| `moonSectorAngle` | Center of Moon 1 sector | [0, 360) | Clockwise |
| `dayAngleWithinMoon` | First day of Moon 1 sector | [0, 360) | Clockwise |
| `lunarAngle` | New moon | [0, 360) | Clockwise |
| `solarSeasonAngle` | March equinox | [0, 360) | Clockwise |
| `passageStartAngle` | Equinox position on pattern ring | [0, 360) | Clockwise |
| `passageEndAngle` | Year Gate = 0° | [0, 360) | Clockwise |
| `yearSpiralAngle` | First study year (2014) | Accumulates per revolution | Clockwise |
| `yearSpiralRadius` | 0 = center | [0, 1] | Outward |
| `layerDepth` | 0 = front | [0, 10] | Backward |

No renderer may redefine these coordinates.

## Viewing modes

### Today

Shows the current Pattern position, active Moon and day, current lunar cycle position, most recent Equinox Gate, and current Passage status.

### Passage

Shows the Equinox Gate, Passage arc, Year Gate, elapsed and remaining Passage values, and Pattern movement across the Passage for the selected year.

### Years

Shows 2014–2026 annual markers, selected year, 13-year spiral, recurrence connections, and comparison details.

### Pattern

Shows the fixed 13 × 28 structure without moving astronomical layers.

## Sphere layers

| Layer | Contents | Toggleable |
|---|---|---|
| Pattern structure | 13 Moon sectors, 28 day positions, pattern ring | Yes |
| Equinox Passage | Passage arc, equinox marker, year gate marker | Yes |
| Lunar orbit | Lunar orbit ring, lunar phase marker | Yes |
| Solar axis | March equinox axis line | Yes |
| Annual markers | 2014–2026 equinox positions | Yes |
| Recurrence links | Visual links between similar years | Yes (off by default) |
| 13-year spiral | Spiral path through all study years | Yes |

## Renderer strategy

1. **Semantic HTML** — textual model (always present, primary accessible output)
2. **SVG** — interactive primary renderer (default)
3. **Canvas** — optional enhancement for smoother mobile interaction
4. **WebGL/Three.js** — not implemented in v1

The sphere remains functional if Canvas or WebGL is unavailable. SVG is the primary renderer. The same renderer-neutral model drives both SVG and Canvas.

## Ring layout (normalized fractions of sphere radius)

| Ring | Fraction |
|---|---|
| Outer border | 1.00 |
| Annual markers | 0.95 |
| Solar axis | 0.90 |
| Passage arc | 0.85 |
| Lunar orbit | 0.78 |
| Pattern ring | 0.70 |
| Moon sectors | 0.68 |
| Moon day points | 0.60 |
| Spiral outer | 0.50 |
| Spiral inner | 0.10 |
| Center point | 6 px fixed |

## 13-year spiral

- Year index: position in study window (0 = 2014, 12 = 2026)
- Angle: accumulates per revolution around the 13-year cycle
- Radius: normalized [0, 1] from center outward
- All positions derived from `AlignmentLedgerData`, not manually placed

## Interaction

| Action | Method |
|---|---|
| Rotate | Drag/swipe on sphere, or arrow keys |
| Select marker | Click/tap or Enter/Space on focused marker |
| Zoom | Wheel scroll, + / − keys |
| Reset view | Reset button or `r` / `0` key |
| Layer visibility | Checkboxes in layer panel |
| Year selection | Year select control |
| Viewing mode | Mode buttons |

## Accessibility

- Semantic heading hierarchy
- Textual summary of selected state (pre element)
- ARIA live region announcements on selection change
- Keyboard-accessible markers (tabindex, Enter/Space)
- Meaningful marker aria-labels
- No color-only distinctions
- High-contrast mode via CSS forced-colors
- Reduced-motion mode via prefers-reduced-motion
- Touch targets ≥ 44px recommended
- Accessible table equivalent of 13-year spiral

## Mobile behavior

- Mobile-first: fits within viewport, no horizontal overflow
- Touch: drag-on-sphere distinguished from page scroll via pointer capture
- Bottom safe-area preserved
- Layer controls compact on narrow viewports
- Reset View always accessible

## Performance goals

- SVG renderer: avoid hundreds of simultaneous DOM nodes
- Canvas renderer: lazy-load, optional
- Stop animation when page hidden
- Avoid continuous animation when nothing changes
- Support low-power mode (stop animations)
- Historical data compact (13 records in memory)

## Privacy

- No Oracle birth data in sphere model or exports
- No witness aggregation in v1
- Witness interface placeholder: `{ witnessPoints: [], enabled: false, source: "local-only" }`
- Personal Seal Layer: placeholder only, requires explicit activation, excluded from share links

## Files

| File | Responsibility |
|---|---|
| `living-time-sphere-version.js` | Version, coordinate conventions |
| `living-time-sphere-model.js` | Renderer-neutral data model |
| `living-time-sphere-layout.js` | Viewport/container geometry |
| `living-time-sphere-renderer-svg.js` | SVG renderer |
| `living-time-sphere-renderer-canvas.js` | Canvas renderer (optional) |
| `living-time-sphere-interaction.js` | Drag, keyboard, zoom |
| `living-time-sphere-accessibility.js` | Descriptions, ARIA live |
| `living-time-sphere-export.js` | PNG, SVG, JSON exports |
| `living-time-sphere-url-state.js` | URL parameter round-trip |
| `living-time-sphere-ui.js` | DOM orchestration |
