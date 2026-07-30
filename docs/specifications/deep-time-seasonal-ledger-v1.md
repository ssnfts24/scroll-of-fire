# Deep-Time Seasonal Ledger v1

## Purpose

Provide a transparent seasonal-event layer for the 13 Moons Remnant Living Time Observatory from 1000 through 3000 CE without presenting calculated values as direct measurements.

## Events

Every supported year can produce:

- March equinox
- June solstice
- September equinox
- December solstice

## Record fields

Each event includes a stable ID, year, event type, UTC instant, Julian date, northern and southern seasonal meaning, 13 Moons Pattern position, method, confidence tier, uncertainty in minutes, calculation version, time standard, source type, source record when available, and limitations.

## Confidence tiers

1. `sourced`: repository-held reference preferred over computation.
2. `computed-high`: near-modern computed event with a smaller declared uncertainty.
3. `computed-medium`: historical or future estimate with a broader uncertainty.
4. `computed-deep`: deep-time estimate with the broadest declared uncertainty.

## Calculation boundary

The engine uses the Meeus JDE0 polynomial family for seasonal turning points. The result is converted into a JavaScript UTC instant for interface use. UTC precision across deep time is limited by Delta-T uncertainty and by the approximation itself. The interface must never label the computed tier as observed, measured, or authoritative.

## Pattern conversion

The seasonal instant is passed through the canonical `PatternCalendar.fromCivilDate` engine. No separate 13 Moons calculation is permitted in the seasonal ledger.

## Operational range

- Minimum year: 1000 CE
- Maximum year: 3000 CE
- Four events per year
- 8,004 possible seasonal-event records generated on demand

## Privacy

The seasonal engine contains no personal data. Location and witness information remain local-first and are attached only when a user explicitly records or exports them.
