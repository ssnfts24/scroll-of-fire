"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const fs =
  require("node:fs");

const path =
  require("node:path");

const vm =
  require("node:vm");

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

function loadManager({
  innerWidth = 390,
  coarse = true
} = {}) {
  const context = {
    globalThis: null,

    window: {
      innerWidth,

      matchMedia(query) {
        return {
          matches:
            coarse
            && (
              query.includes(
                "pointer: coarse"
              )
              || query.includes(
                "hover: none"
              )
            )
        };
      }
    },

    console,
    Set,
    Map,
    Object,
    Array,
    Number,
    String,
    Math
  };

  context.globalThis =
    context;

  vm.createContext(
    context
  );

  vm.runInContext(
    read(
      "docs/assets/js/sphere/living-time-sphere-label-manager.js"
    ),
    context
  );

  return context
    .LivingTimeSphereLabelManager;
}

test(
  "semantic budgets are profile-aware",
  () => {
    const api =
      loadManager();

    const resolve =
      api._internals
        .resolveSemanticBudget;

    assert.equal(
      resolve({
        runtimeProfile:
          "ambient",
        mobile:
          true,
        semanticBand:
          "detail"
      }),
      0
    );

    assert.equal(
      resolve({
        runtimeProfile:
          "instrument",
        mobile:
          true,
        semanticBand:
          "medium"
      }),
      2
    );

    assert.equal(
      resolve({
        runtimeProfile:
          "observatory",
        mobile:
          true,
        semanticBand:
          "near"
      }),
      3
    );

    assert.equal(
      resolve({
        runtimeProfile:
          "observatory",
        mobile:
          false,
        semanticBand:
          "detail"
      }),
      8
    );
  }
);

test(
  "semantic detail increases monotonically in Observatory",
  () => {
    const api =
      loadManager();

    const resolve =
      api._internals
        .resolveSemanticBudget;

    const budgets =
      [
        "far",
        "medium",
        "near",
        "detail"
      ].map(
        semanticBand =>
          resolve({
            runtimeProfile:
              "observatory",
            mobile:
              false,
            semanticBand
          })
      );

    assert.deepEqual(
      budgets,
      [
        2,
        4,
        6,
        8
      ]
    );
  }
);

test(
  "physical coarse-pointer phone remains compact in Desktop site mode",
  () => {
    const api =
      loadManager({
        innerWidth:
          980,
        coarse:
          true
      });

    assert.equal(
      api._internals
        .isCompactSurface(),
      true
    );
  }
);

test(
  "instrument phone Moon labels only expose selected temporal context",
  () => {
    const api =
      loadManager();

    const set =
      api._internals
        .buildLabelSet({
          labelMode:
            "essential",
          selectedMoon:
            5,
          todayMoon:
            5,
          equinoxMoon:
            13,
          mobile:
            true,
          showAllMobileLabels:
            false,
          runtimeProfile:
            "instrument"
        });

    assert.deepEqual(
      Array.from(
        set
      ),
      [
        5
      ]
    );
  }
);

test(
  "semantic compositor prefers information diversity",
  () => {
    const api =
      loadManager();

    const candidate =
      (
        id,
        kind,
        priority,
        extra = {}
      ) => ({
        target: {
          id,
          kind,
          priority,
          ...extra
        },
        distance:
          1
      });

    const input = [
      candidate(
        "selected-day",
        "pattern-day",
        100,
        {
          pinned:
            true,
          selected:
            true
        }
      ),

      candidate(
        "moon-5",
        "moon",
        88,
        {
          selected:
            true
        }
      ),

      candidate(
        "moon-6",
        "moon",
        87
      ),

      candidate(
        "march-equinox",
        "astronomy",
        86
      )
    ];

    const result =
      api._internals
        .composeSemanticCandidates(
          input,
          {
            budget:
              3
          }
        );

    assert.equal(
      result.length,
      3
    );

    const ids =
      result.map(
        entry =>
          entry.target.id
      );

    assert.ok(
      ids.includes(
        "selected-day"
      )
    );

    assert.ok(
      ids.includes(
        "march-equinox"
      )
    );

    assert.equal(
      ids.filter(
        id =>
          id.startsWith(
            "moon-"
          )
      ).length,
      1
    );
  }
);

test(
  "legacy emergency ceilings remain intact",
  () => {
    const api =
      loadManager();

    assert.equal(
      api.constants
        .SEMANTIC_MOBILE_LABEL_CAP,
      5
    );

    assert.equal(
      api.constants
        .SEMANTIC_DESKTOP_LABEL_CAP,
      10
    );
  }
);

test(
  "label manager source protects central inspection region",
  () => {
    const code =
      read(
        "docs/assets/js/sphere/living-time-sphere-label-manager.js"
      );

    assert.match(
      code,
      /semanticBlockedRects/
    );

    assert.match(
      code,
      /semanticOutward/
    );
  }
);
