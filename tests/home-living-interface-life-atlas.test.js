"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const fs =
  require("node:fs");

const HTML =
  fs.readFileSync(
    "docs/index.html",
    "utf8"
  );

const JS =
  fs.readFileSync(
    "docs/assets/js/home-living-interface.js",
    "utf8"
  );

const CSS =
  fs.readFileSync(
    "docs/assets/css/home-living-interface.css",
    "utf8"
  );

test(
  "homepage Life Atlas context remains deferred",
  () => {
    assert.match(
      JS,
      /IntersectionObserver/
    );

    assert.match(
      JS,
      /LIFE_ATLAS_MODULES/
    );

    assert.match(
      JS,
      /CodexLifeAtlasRuntime/
    );

    assert.doesNotMatch(
      HTML,
      /<script[^>]+life-atlas-runtime\.js/
    );
  }
);

test(
  "homepage loads only minimum Life Atlas persistence chain",
  () => {
    assert.match(
      JS,
      /life-atlas-schema\.js/
    );

    assert.match(
      JS,
      /life-atlas-repository\.js/
    );

    assert.match(
      JS,
      /life-atlas-indexeddb\.js/
    );

    assert.match(
      JS,
      /life-atlas-runtime\.js/
    );

    assert.doesNotMatch(
      JS,
      /life-atlas-world-builder\.js/
    );

    assert.doesNotMatch(
      JS,
      /life-atlas-render-projection\.js/
    );
  }
);

test(
  "Life Atlas records use canonical runtime records API",
  () => {
    assert.match(
      JS,
      /runtime\.records\(\)/
    );

    assert.match(
      JS,
      /runtime\.ready/
    );
  }
);

test(
  "homepage temporal record classification uses Pattern coordinate",
  () => {
    assert.match(
      JS,
      /absolutePatternCoordinate/
    );

    assert.match(
      JS,
      /record\?\.temporal/
    );

    assert.match(
      JS,
      /patternDay/
    );

    assert.match(
      JS,
      /patternYear/
    );
  }
);

test(
  "future records are described as temporal future not prediction",
  () => {
    assert.match(
      HTML,
      /Future/
    );

    assert.doesNotMatch(
      JS,
      /predict|prediction|will happen/i
    );
  }
);

test(
  "Life Atlas context keeps private state local and does not upload",
  () => {
    assert.doesNotMatch(
      JS,
      /fetch\s*\(/
    );

    assert.doesNotMatch(
      JS,
      /XMLHttpRequest/
    );

    assert.doesNotMatch(
      JS,
      /navigator\.sendBeacon/
    );
  }
);

test(
  "homepage displays past selected and future record states",
  () => {
    assert.match(
      HTML,
      /data-home-atlas-state="past"/
    );

    assert.match(
      HTML,
      /data-home-atlas-state="selected"/
    );

    assert.match(
      HTML,
      /data-home-atlas-state="future"/
    );

    assert.match(
      CSS,
      /data-temporal-state="selected"/
    );
  }
);
