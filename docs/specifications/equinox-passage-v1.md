# Equinox Passage v1

- Official system name: The 13 Moons Remnant Living Time Observatory.
- Fixed Pattern anchor: April 17, 2026 = Moon 1 · Day 1 · Day 1/364.
- Passage start: exact astronomical March equinox instant.
- Passage end: beginning of Moon 1 Day 1 under the selected boundary model.
- Shared versions:
  - `astronomy/1.0.0`
  - `equinox-passage/1.0.0`
  - `pattern-calendar/1.0.0`
- Bundled reference years: 2014–2026.
- Bundled study timezone: America/Los_Angeles.
- Bundled boundary model: sunset with `18:00` fallback unless the user supplies another sunset value.
- Astronomical source policy:
  - exact UTC instants are sourced from the bundled validated reference table;
  - Pattern calculations are deterministic and separate from astronomy;
  - lunar values are approximate and labeled as such.
- Renderer-neutral visualization data must expose normalized values for future Living Time Sphere work.
- Symbolic interpretation must remain visibly separate from astronomical fact, Pattern calculation, and personal observation.
