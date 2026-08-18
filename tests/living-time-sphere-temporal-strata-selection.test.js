"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const fs =
  require("node:fs");

const path =
  require("node:path");

const strata =
  require(
    "../docs/assets/js/sphere/"
    + "living-time-sphere-temporal-strata.js"
  );

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
  "Temporal Strata exposes semantic picking helpers",
  () => {
    assert.equal(
      typeof strata.pickableYears,
      "function"
    );

    assert.equal(
      typeof strata.raySphereDistance,
      "function"
    );

    assert.equal(
      typeof strata.resolveYearPick,
      "function"
    );

    assert.equal(
      typeof strata.pick,
      "function"
    );
  }
);

test(
  "raySphereDistance resolves front sphere intersection",
  () => {
    const distance =
      strata.raySphereDistance(
        {
          x: 0,
          y: 0,
          z: 3
        },
        {
          x: 0,
          y: 0,
          z: -1
        },
        1
      );

    assert.ok(
      Math.abs(
        distance - 2
      ) < 1e-9
    );
  }
);

test(
  "raySphereDistance safely rejects malformed rays",
  () => {
    assert.equal(
      strata.raySphereDistance(
        null,
        null,
        1
      ),
      null
    );

    assert.equal(
      strata.raySphereDistance(
        { x: 0, y: 0, z: 3 },
        { x: 0, y: 0, z: 0 },
        1
      ),
      null
    );
  }
);

test(
  "Temporal Strata extension participates in host picking",
  () => {
    const code =
      read(
        "docs/assets/js/sphere/"
        + "living-time-sphere-temporal-strata.js"
      );

    assert.ok(
      code.includes(
        "pick(context) {"
      )
    );

    assert.ok(
      code.includes(
        "return pick(context)"
      )
    );
  }
);

test(
  "renderer offers only completed click gestures to extension picking",
  () => {
    const code =
      read(
        "docs/assets/js/sphere/"
        + "living-time-sphere-renderer-3d.js"
      );

    assert.ok(
      code.includes(
        "_handleExtensionPick"
      )
    );

    assert.ok(
      code.includes(
        "LivingTimeSphereExtensionHost"
      )
    );

    assert.ok(
      code.includes(
        "host.pickAll"
      )
    );

    /*
     * Existing drag threshold must remain intact.
     */
    assert.match(
      code,
      /dx\s*<\s*6\s*&&\s*dy\s*<\s*6/
    );
  }
);

test(
  "canonical temporal year selection preserves Pattern coordinate and view",
  () => {
    const ui =
      read(
        "docs/assets/js/sphere/"
        + "living-time-sphere-ui.js"
      );

    const start =
      ui.indexOf(
        "function _selectTemporalYear("
      );

    assert.ok(
      start >= 0
    );

    const end =
      ui.indexOf(
        "function _syncYearSelect",
        start
      );

    assert.ok(
      end > start
    );

    const body =
      ui.slice(
        start,
        end
      );

    assert.ok(
      body.includes(
        "_state.selectedDayOfYear"
      )
    );

    assert.ok(
      body.includes(
        "_state.year ="
      )
    );

    assert.ok(
      body.includes(
        "_state.selectedMarker"
      )
    );

    assert.ok(
      body.includes(
        "render(container)"
      )
    );

    assert.equal(
      body.includes(
        "_requestViewModeTransition"
      ),
      false,
      "Strata year selection must preserve current view mode"
    );

    assert.equal(
      body.includes(
        "_returnToToday"
      ),
      false,
      "Strata year selection must not reset to Today"
    );
  }
);

test(
  "legacy year selection remains present",
  () => {
    const svg =
      read(
        "docs/assets/js/sphere/"
        + "living-time-sphere-renderer-svg.js"
      );

    assert.ok(
      svg.includes(
        'new CustomEvent("sphere:year-select"'
      )
    );

    const ui =
      read(
        "docs/assets/js/sphere/"
        + "living-time-sphere-ui.js"
      );

    assert.ok(
      ui.includes(
        'container.addEventListener("sphere:year-select"'
      )
    );
  }
);

test(
  "extension host documents and retains optional pick contract",
  () => {
    const code =
      read(
        "docs/assets/js/sphere/"
        + "living-time-sphere-extension-host.js"
      );

    assert.ok(
      code.includes(
        "pick?(context)"
      )
    );

    assert.ok(
      code.includes(
        "function pickAll("
      )
    );

    assert.ok(
      code.includes(
        "if (!extension.pick)"
      )
    );
  }
);
