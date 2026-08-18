"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const fs =
  require("node:fs");

const MOUNT =
  fs.readFileSync(
    "docs/assets/js/sphere/living-time-sphere-mount.js",
    "utf8"
  );

const HOME =
  fs.readFileSync(
    "docs/assets/js/home-observatory-instrument.js",
    "utf8"
  );

const MOONS =
  fs.readFileSync(
    "docs/moons.html",
    "utf8"
  );

test(
  "shared Sphere lifecycle uses callback-driven renderer-agnostic ownership",
  () => {
    assert.match(
      MOUNT,
      /function _createSurfaceLifecycle\s*\(/
    );

    assert.match(
      MOUNT,
      /onActivate/
    );

    assert.match(
      MOUNT,
      /onDeactivate/
    );

    assert.match(
      MOUNT,
      /onTeardown/
    );
  }
);

test(
  "mount controller exposes activate deactivate suspend and lifecycle state",
  () => {
    assert.match(
      MOUNT,
      /activate\(\)/
    );

    assert.match(
      MOUNT,
      /deactivate\(\)/
    );

    assert.match(
      MOUNT,
      /suspend\(\)/
    );

    assert.match(
      MOUNT,
      /getLifecycleState\(\)/
    );

    assert.match(
      MOUNT,
      /isActive\(\)/
    );
  }
);

test(
  "surface lifecycle publishes active suspended and destroyed state",
  () => {
    assert.match(
      MOUNT,
      /ltsSurfaceActive/
    );

    assert.match(
      MOUNT,
      /ltsSurfaceLifecycle/
    );

    assert.match(
      MOUNT,
      /"suspended"/
    );

    assert.match(
      MOUNT,
      /"destroyed"/
    );
  }
);

test(
  "ambient surfaces never request the 3D activation path",
  () => {
    assert.match(
      MOUNT,
      /runtimeProfile\.id !== "ambient"/
    );
  }
);

test(
  "homepage IntersectionObserver suspends and reactivates shared mount",
  () => {
    assert.match(
      HOME,
      /activeMount\?\.suspend\?\.\(\)/
    );

    assert.match(
      HOME,
      /activeMount\?\.activate\?\.\(\)/
    );
  }
);

test(
  "homepage remains instrument profile",
  () => {
    assert.match(
      HOME,
      /runtimeProfile:\s*"instrument"/
    );
  }
);

test(
  "13 Moons remains one ambient Sphere",
  () => {
    const matches =
      MOONS.match(
        /runtimeProfile:\s*"ambient"/g
      )
      || [];

    assert.equal(
      matches.length,
      1
    );
  }
);

test(
  "full page path exposes same high-level lifecycle vocabulary",
  () => {
    assert.match(
      MOUNT,
      /fullPageActive/
    );

    assert.match(
      MOUNT,
      /fullPageDestroyed/
    );

    assert.match(
      MOUNT,
      /renderer:\s*"ui-managed"/
    );
  }
);

test(
  "shared lifecycle does not invent animation pause or resume APIs",
  () => {
    assert.doesNotMatch(
      MOUNT,
      /LivingTimeSphereAnimation\?\.pause/
    );

    assert.doesNotMatch(
      MOUNT,
      /LivingTimeSphereAnimation\?\.resume/
    );
  }
);
