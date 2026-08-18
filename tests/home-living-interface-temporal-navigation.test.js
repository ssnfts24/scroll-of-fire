"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const fs =
  require("node:fs");

function read(path) {
  return fs.readFileSync(
    path,
    "utf8"
  );
}

const HTML =
  read(
    "docs/index.html"
  );

const HOME =
  read(
    "docs/assets/js/home-observatory-instrument.js"
  );

const UI =
  read(
    "docs/assets/js/home-living-interface.js"
  );

const CSS =
  read(
    "docs/assets/css/home-living-interface.css"
  );

test(
  "Living Home exposes previous Today next and bounded Pattern scrubber",
  () => {
    assert.match(
      HTML,
      /data-home-time-shift="-1"/
    );

    assert.match(
      HTML,
      /data-home-time-today/
    );

    assert.match(
      HTML,
      /data-home-time-shift="1"/
    );

    assert.match(
      HTML,
      /data-home-pattern-scrubber/
    );

    assert.match(
      HTML,
      /max="364"/
    );
  }
);

test(
  "homepage Sphere controller exposes temporal navigation without owning calendar math",
  () => {
    assert.match(
      HOME,
      /selectPatternDay/
    );

    assert.match(
      HOME,
      /shiftPatternDay/
    );

    assert.match(
      HOME,
      /returnToday/
    );

    assert.match(
      HOME,
      /activeMount\.refresh/
    );

    assert.doesNotMatch(
      HOME,
      /new Date\([^)]*\)\.setDate/
    );
  }
);

test(
  "Pattern day navigation wraps inside canonical 364-day counted field",
  () => {
    assert.match(
      HOME,
      /%\s*364/
    );

    assert.match(
      HOME,
      /Math\.min\(\s*364/
    );
  }
);

test(
  "Living Home projection links inherit selected temporal coordinate",
  () => {
    for (
      const projection
      of [
        "calendar",
        "sphere",
        "timeline",
        "atlas",
        "ledger",
        "network"
      ]
    ) {
      assert.match(
        HTML,
        new RegExp(
          `data-home-projection="${projection}"`
        )
      );
    }

    assert.match(
      UI,
      /updateProjectionLinks/
    );

    assert.match(
      UI,
      /day-\$\{selected\.selectedDay\}/
    );
  }
);

test(
  "page depth reads renderer diagnostics rather than calculating camera geometry",
  () => {
    assert.match(
      HOME,
      /getRendererDiagnostics/
    );

    assert.match(
      UI,
      /semanticBand/
    );

    assert.match(
      UI,
      /data-home-semantic-depth/
    );

    assert.doesNotMatch(
      UI,
      /camera\.position/
    );

    assert.doesNotMatch(
      UI,
      /Math\.hypot\([^)]*camera/
    );
  }
);

test(
  "context surface distinguishes coordinate depth and Life Atlas context",
  () => {
    assert.match(
      HTML,
      /home-context-coordinate/
    );

    assert.match(
      HTML,
      /home-context-depth/
    );

    assert.match(
      HTML,
      /home-context-records/
    );
  }
);

test(
  "physical touch devices stack temporal navigation and context",
  () => {
    assert.match(
      CSS,
      /@media \(pointer: coarse\), \(hover: none\)[\s\S]*\.home-time-navigation/
    );

    assert.match(
      CSS,
      /@media \(pointer: coarse\), \(hover: none\)[\s\S]*\.home-context-surface/
    );
  }
);

test(
  "semantic page depth is display-only and supports reduced motion",
  () => {
    assert.match(
      CSS,
      /data-home-semantic-depth="detail"/
    );

    assert.match(
      CSS,
      /prefers-reduced-motion:\s*reduce/
    );
  }
);
