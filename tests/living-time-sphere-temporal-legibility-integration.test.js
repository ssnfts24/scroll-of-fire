"use strict";

const test =
  require("node:test");

const assert =
  require(
    "node:assert/strict"
  );

const fs =
  require("node:fs");

const path =
  require("node:path");

const root =
  path.resolve(
    __dirname,
    ".."
  );

function read(relative) {
  return fs.readFileSync(
    path.join(
      root,
      relative
    ),
    "utf8"
  );
}

test(
  "temporal legibility loads before Temporal Strata and Life Atlas projections",
  () => {
    const html =
      read(
        "docs/living-time-sphere.html"
      );

    const policy =
      html.indexOf(
        "living-time-sphere-temporal-legibility.js"
      );

    const strata =
      html.indexOf(
        "living-time-sphere-temporal-strata.js"
      );

    const records =
      html.indexOf(
        "life-atlas-record-sphere-extension.js"
      );

    assert.ok(
      policy >= 0,
      "legibility policy script present"
    );

    assert.ok(
      strata > policy,
      "Temporal Strata loads after policy"
    );

    assert.ok(
      records > policy,
      "Life Atlas projection loads after policy"
    );
  }
);

test(
  "Temporal Strata consumes semantic zoom without changing analytical year window",
  () => {
    const code =
      read(
        "docs/assets/js/sphere/"
        + "living-time-sphere-temporal-strata.js"
      );

    assert.ok(
      code.includes(
        "LivingTimeSphereTemporalLegibility"
      )
    );

    assert.ok(
      code.includes(
        "context.semanticZoomState?.band"
      )
    );

    assert.ok(
      code.includes(
        "visibleYearSet"
      )
    );

    assert.ok(
      code.includes(
        "analyticalYearCount"
      )
    );

    assert.ok(
      code.includes(
        "window.years.forEach"
      ),
      "analytical year window remains source of truth"
    );
  }
);

test(
  "Life Atlas record projection uses the shared semantic record budget",
  () => {
    const code =
      read(
        "docs/assets/js/sphere/"
        + "life-atlas-record-sphere-extension.js"
      );

    assert.ok(
      code.includes(
        "LivingTimeSphereTemporalLegibility"
      )
    );

    assert.ok(
      code.includes(
        "legibility.recordBudget"
      )
    );

    assert.ok(
      code.includes(
        "context.semanticZoomState?.band"
      )
    );

    assert.ok(
      code.includes(
        "visibleYears.has(y)"
      )
    );
  }
);

test(
  "Life Atlas cache key includes semantic band transitions",
  () => {
    const code =
      read(
        "docs/assets/js/sphere/"
        + "life-atlas-record-sphere-extension.js"
      );

    assert.match(
      code,
      /semanticZoomState\?\.band/
    );
  }
);
