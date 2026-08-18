"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const fs =
  require("node:fs");

const path =
  require("node:path");

const root =
  path.resolve(
    __dirname,
    ".."
  );

function read(rel) {
  return fs.readFileSync(
    path.join(
      root,
      rel
    ),
    "utf8"
  );
}

const HTML =
  read(
    "docs/index.html"
  );

const CSS =
  read(
    "docs/assets/css/home-living-interface.css"
  );

const JS =
  read(
    "docs/assets/js/home-living-interface.js"
  );

const HOME_SPHERE =
  read(
    "docs/assets/js/home-observatory-instrument.js"
  );

const SW =
  read(
    "docs/service-worker.js"
  );

test(
  "homepage exposes one unified Living Home root around canonical Sphere",
  () => {
    assert.match(
      HTML,
      /data-home-sphere-root[^>]*data-home-live-root|data-home-live-root[^>]*data-home-sphere-root/
    );

    assert.equal(
      (
        HTML.match(
          /data-home-live-root/g
        )
        || []
      ).length,
      1
    );
  }
);

test(
  "Living Home exposes current temporal command surface",
  () => {
    assert.match(
      HTML,
      /class="home-temporal-console"/
    );

    assert.match(
      HTML,
      /id="home-live-clock"/
    );

    assert.match(
      HTML,
      /id="home-live-pattern"/
    );

    assert.match(
      HTML,
      /id="home-live-gate"/
    );

    assert.match(
      HTML,
      /id="home-live-lunar"/
    );

    assert.match(
      HTML,
      /id="home-live-boundary"/
    );
  }
);

test(
  "homepage exposes projection dock without duplicating temporal authority",
  () => {
    assert.match(
      HTML,
      /class="home-projection-dock"/
    );

    for (
      const label
      of [
        "Calendar",
        "Sphere",
        "Timeline",
        "Atlas",
        "Ledger",
        "Network"
      ]
    ) {
      assert.match(
        HTML,
        new RegExp(
          `>${label}<`
        )
      );
    }

    assert.match(
      JS,
      /LivingTimeSphereLiveData/
    );

    assert.doesNotMatch(
      JS,
      /dayOfPatternYear\s*=\s*/
    );
  }
);

test(
  "homepage continuity reads existing CodexMemory rather than creating storage",
  () => {
    assert.match(
      JS,
      /CodexMemory/
    );

    assert.match(
      JS,
      /getSevenDaySummary/
    );

    assert.match(
      JS,
      /getChangesSinceLastVisit/
    );

    assert.doesNotMatch(
      JS,
      /localStorage\.setItem/
    );

    assert.doesNotMatch(
      JS,
      /indexedDB\.open/
    );
  }
);

test(
  "homepage preserves instrument runtime and progressive renderer",
  () => {
    assert.match(
      HOME_SPHERE,
      /runtimeProfile:\s*"instrument"/
    );

    assert.match(
      HOME_SPHERE,
      /renderer:\s*"auto"/
    );

    assert.match(
      HOME_SPHERE,
      /IntersectionObserver/
    );

    assert.match(
      HOME_SPHERE,
      /\.suspend\?\.\(\)/
    );
  }
);

test(
  "physical touch devices receive deliberate homepage composition",
  () => {
    assert.match(
      CSS,
      /@media \(pointer: coarse\), \(hover: none\)/
    );

    assert.match(
      CSS,
      /\.home-temporal-console/
    );

    assert.match(
      CSS,
      /\.home-projection-dock/
    );
  }
);

test(
  "Living Home assets load after core homepage styles and sphere controller",
  () => {
    assert.ok(
      HTML.indexOf(
        "assets/css/home.css"
      )
      <
      HTML.indexOf(
        "assets/css/home-living-interface.css"
      )
    );

    assert.ok(
      HTML.indexOf(
        "assets/js/home-observatory-instrument.js"
      )
      <
      HTML.indexOf(
        "assets/js/home-living-interface.js"
      )
    );
  }
);

test(
  "Living Home assets are cached by service worker",
  () => {
    assert.match(
      SW,
      /home-living-interface\.css/
    );

    assert.match(
      SW,
      /home-living-interface\.js/
    );
  }
);

test(
  "homepage interface retains reduced motion support",
  () => {
    assert.match(
      CSS,
      /prefers-reduced-motion:\s*reduce/
    );
  }
);
