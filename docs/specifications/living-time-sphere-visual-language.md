# Living Time Sphere — Visual Language Specification

Version: Phase 03 · July 2026

## Coordinate conventions

Zero position (0°) = Moon 1 Day 1 (Year Gate), top (12 o'clock position), clockwise.

## Semantic object registry

| id | type | label | shape | color | orbit |
|---|---|---|---|---|---|
| todayMarker | today | Today | Gold sphere + halo ring + dashed center line | #ffd700 | Pattern ring |
| equinoxGate | equinox | Equinox Gate | Tetrahedron (▲) | #fbbf24 amber | Pattern ring |
| yearGate | yearGate | Year Gate | Octahedron (◆) | #64ffb4 teal | Pattern ring at 0° |
| lunarMarker | lunar | Lunar position | Sphere | #b4b4ff cool blue | Lunar orbit (tilted) |
| passageArc | passage | Equinox Passage | Gold tube arc | #ffd060 | Passage arc radius |
| patternRing | structure | Pattern ring | Torus | #334466 teal/neutral | Fixed |
| moonDividers | structure | Moon sectors | Radial lines | #2a3050 | Fixed |
| spiralMarkers | annual | 2014–2026 annual | Sphere (selected=gold) | #88aacc / #fbbf24 | Spiral |
| core | patternCore | Pattern Core | Glowing sphere | #ffffff | Center |

## Center core definition

The center core (`core`) represents **the active Pattern state or selected point of observation**.

- It does NOT represent the physical Sun.
- It does NOT represent Today.
- When Today mode is active: Pattern Core reflects Today's underlying 13×28 structure.
- When a year is selected: Pattern Core reflects the selected record.
- When Pattern mode is active: Pattern Core represents the fixed 13×28 calendar structure.

**Label in details panel**: "Pattern Core"

## Today marker definition

- Object: `todayMarker` (gold sphere) + `todayHalo` (ring) + `todayLine` (dashed center line)
- Source: `model.currentPatternAngle` derived from `PatternCalendar.fromCivilDate` (never from Equinox year record)
- It must be the strongest, most visually distinct element in Today mode.
- It must always connect visually to the center via `todayLine`.

## Mode compositions

### Today mode
- **Subject**: Today marker
- **Visible by default**: Pattern Core, Today marker, Today halo, Today line, active Moon sector, active day node, lunar position, equinox gate, passage arc, year gate
- **Hidden by default**: 13-year spiral, recurrence links, solar axis
- **Default selected marker**: Today

### Passage mode
- **Subject**: Equinox Gate → Year Gate arc
- **Visible**: Equinox gate, passage arc, year gate, annual marker for selected year, lunar marker
- **Hidden**: 13-year spiral, recurrence links
- **Default selected marker**: Equinox Gate for selected year

### Years mode
- **Subject**: 13-year spiral
- **Visible**: Spiral path, annual markers, selected year, comparison year, equinox gates
- **Optional**: recurrence links
- **Default selected marker**: Selected year

### Pattern mode
- **Subject**: Fixed 13×28 geometry
- **Visible**: Pattern ring, moon sectors, 28-day nodes, week gates, active Moon sector, active day node, today marker
- **Hidden**: Solar axis, 13-year spiral, recurrence links, lunar/solar moving layers
- **Default selected marker**: Current Pattern Day

## Camera presets

| Mode | distance | phi | theta | Notes |
|---|---|---|---|---|
| today | 2.8 | 0.40 | 0.0 | Slight tilt, Today visible |
| passage | 2.4 | 0.30 | 0.15 | Equinox + Year Gate both visible |
| years | 4.5 | 0.55 | 0.0 | Spiral visible in depth |
| pattern | 2.6 | 1.45 | 0.0 | Near top-down, all 13 sectors |

## Shape vocabulary

- **Today**: Gold sphere (0.040r) + gold ring halo + dashed gold line to center
- **Equinox Gate**: Amber tetrahedron (▲) — solar, angular
- **Year Gate**: Teal octahedron (◆) at 0° — gate, structural
- **Lunar position**: Cool blue sphere on tilted orbit
- **Annual markers**: Small grey-blue spheres; selected = gold
- **Pattern ring**: Neutral teal torus
- **Passage arc**: Gold tube from Equinox to Year Gate

## Color roles

| Color | Role |
|---|---|
| #ffd700 gold | Today only |
| #fbbf24 amber | Equinox Gate, Passage arc |
| #64ffb4 teal | Year Gate |
| #b4b4ff blue | Lunar |
| #334466 | Pattern ring structure |
| #64c8b4 | 13-year spiral |
| #88aacc | Annual markers |
| #ffdc50 | Solar axis |

## Legend symbols

- ● gold = Today
- ▲ amber = Equinox Gate
- ◆ teal = Year Gate
- ● blue = Lunar position
- ─── gold = Passage arc
- ● grey = Selected year
