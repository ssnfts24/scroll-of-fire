# Living Time Sphere — Phase IIIE Proximity Labels Patch

Built directly from `scroll-of-fire-handoff-20260817.zip`.

## Implements

- camera-distance semantic proximity labels without hover dependence;
- X dismissal that hides only the label presentation;
- dismissal remains while the object stays inside its zone;
- dismissal resets only after the camera exits a larger reset radius;
- label reappears on later re-approach;
- hard semantic target cap: 96;
- hard visible label budget: 6 phone / 12 desktop;
- selected/pinned priority over ordinary proximity labels;
- screen-space collision avoidance shared with existing Moon labels;
- teardown removes generated semantic DOM and clears dismissal state;
- no new permanent requestAnimationFrame loop;
- extension-host semantic-target contract for Temporal Strata and Life Atlas;
- proximity targets for Moons, Live Today, selected day, Year Gate, Equinox, Passage midpoint, selected-Moon week gates, solar/lunar markers, seasonal anchors, spiral years, temporal year membranes, and Life Atlas records;
- privacy-safe Life Atlas labels (private records are not titled with private content);
- service-worker caching for temporal-legibility runtime dependency.

## Validation

Final suite on this patch: 805 tests passed, 0 failed.
Site audit: PASS — 69 HTML pages, 36 stylesheets, 4119 local references.

## Important

This patch intentionally does not commit. Apply it over the same handoff/branch state, preview on the phone, then decide whether to commit the complete Phase III stack.
