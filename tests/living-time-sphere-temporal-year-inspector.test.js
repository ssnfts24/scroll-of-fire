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
  "Temporal Strata rebuild key follows semantic zoom band",
  () => {
    const code =
      read(
        "docs/assets/js/sphere/"
        + "living-time-sphere-temporal-strata.js"
      );

    const start =
      code.indexOf(
        "function configKey("
      );

    const end =
      code.indexOf(
        "function disposeObject",
        start
      );

    assert.ok(
      start >= 0
      && end > start
    );

    const body =
      code.slice(
        start,
        end
      );

    assert.ok(
      body.includes(
        "semanticZoomState?.band"
      )
    );
  }
);

test(
  "selected membrane carries canonical year identity",
  () => {
    const code =
      read(
        "docs/assets/js/sphere/"
        + "living-time-sphere-temporal-strata.js"
      );

    assert.match(
      code,
      /selectedShell\.userData/
    );

    assert.match(
      code,
      /selectedYear:\s*window\.reference/
    );

    assert.match(
      code,
      /patternDay:\s*selectedPatternDay\(context\)/
    );
  }
);

test(
  "Temporal Onion exposes accessible selected-year inspector",
  () => {
    const html =
      read(
        "docs/living-time-sphere.html"
      );

    assert.ok(
      html.includes(
        'id="sphere-strata-year-inspector"'
      )
    );

    assert.ok(
      html.includes(
        'aria-live="polite"'
      )
    );

    [
      "sphere-strata-year-pattern",
      "sphere-strata-year-day",
      "sphere-strata-year-equinox",
      "sphere-strata-year-passage",
      "sphere-strata-year-angle",
      "sphere-strata-year-relation"
    ].forEach(id => {
      assert.ok(
        html.includes(
          `id="${id}"`
        ),
        id
      );
    });
  }
);

test(
  "year inspector consumes canonical model instead of recalculating astronomy",
  () => {
    const code =
      read(
        "docs/assets/js/sphere/"
        + "living-time-sphere-ui.js"
      );

    const start =
      code.indexOf(
        "function _syncTemporalYearInspector("
      );

    const end =
      code.indexOf(
        "// ── Accessible text",
        start
      );

    assert.ok(
      start >= 0
      && end > start
    );

    const body =
      code.slice(
        start,
        end
      );

    assert.ok(
      body.includes(
        "model.sourceRecord"
      )
    );

    assert.ok(
      body.includes(
        "model.passageStartAngle"
      )
    );

    assert.ok(
      body.includes(
        "model.selectedPatternPosition"
      )
    );

    assert.equal(
      body.includes(
        "EquinoxPassageEngine.buildRecord"
      ),
      false
    );

    assert.equal(
      body.includes(
        "AlignmentLedgerData.getRecord"
      ),
      false
    );
  }
);

test(
  "large detail panel keeps canonical year layer visible with Living Strata",
  () => {
    const code =
      read(
        "docs/assets/js/sphere/"
        + "living-time-sphere-ui.js"
      );

    assert.ok(
      code.includes(
        "strataEnabled"
      )
    );

    assert.ok(
      code.includes(
        "_state.viewMode === \"years\""
      )
    );
  }
);

test(
  "selected-year inspector has compact phone layout",
  () => {
    const css =
      read(
        "docs/assets/css/"
        + "living-time-sphere.css"
      );

    assert.ok(
      css.includes(
        ".sphere-strata-year-inspector"
      )
    );

    assert.match(
      css,
      /@media\s*\(max-width:\s*560px\)/
    );

    assert.ok(
      css.includes(
        ".sphere-strata-year-grid"
      )
    );
  }
);
