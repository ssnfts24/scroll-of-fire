"use strict";

const test =
  require("node:test");

const assert =
  require(
    "node:assert/strict"
  );

const path =
  require("node:path");

const api =
  require(
    path.resolve(
      __dirname,
      "../docs/assets/js/sphere/living-time-sphere-temporal-legibility.js"
    )
  );

function windowFor(
  start,
  end,
  reference
) {
  const years =
    Array.from(
      {
        length:
          end
          - start
          + 1
      },
      (_, i) =>
        start + i
    );

  return {
    start,
    end,
    count:
      years.length,
    reference,
    years
  };
}

test(
  "temporal legibility exposes deterministic semantic bands",
  () => {
    assert.match(
      api.VERSION,
      /1\.0\.0/
    );

    assert.equal(
      api.normalizeBand(
        "detail"
      ),
      "detail"
    );

    assert.equal(
      api.normalizeBand(
        "garbage"
      ),
      "medium"
    );
  }
);

test(
  "far view preserves analytical years but strongly reduces visible shells",
  () => {
    const window =
      windowFor(
        1827,
        2026,
        2026
      );

    const result =
      api.resolve({
        window,
        selectedYear:
          2026,
        band:
          "far",
        tier:
          "high"
      });

    assert.equal(
      result.analyticalYearCount,
      200
    );

    assert.ok(
      result.visibleYearCount
      < 35
    );

    assert.ok(
      result.hiddenYearCount
      > 150
    );

    assert.ok(
      result.visibleYears.includes(
        2026
      )
    );

    assert.ok(
      result.visibleYears.includes(
        1827
      )
    );
  }
);

test(
  "selected year is always visible",
  () => {
    const window =
      windowFor(
        1927,
        2026,
        1988
      );

    const result =
      api.resolve({
        window,
        selectedYear:
          1988,
        band:
          "far"
      });

    assert.equal(
      api.isYearVisible(
        1988,
        result
      ),
      true
    );
  }
);

test(
  "evidence years remain visible even between far-view intervals",
  () => {
    const window =
      windowFor(
        1927,
        2026,
        2026
      );

    const result =
      api.resolve({
        window,
        selectedYear:
          2026,
        band:
          "far",
        evidenceYears:
          [
            1993,
            2007
          ]
      });

    assert.ok(
      result.visibleYears.includes(
        1993
      )
    );

    assert.ok(
      result.visibleYears.includes(
        2007
      )
    );
  }
);

test(
  "detail view resolves every year for ordinary 13-year windows",
  () => {
    const window =
      windowFor(
        2020,
        2032,
        2026
      );

    const result =
      api.resolve({
        window,
        selectedYear:
          2026,
        band:
          "detail"
      });

    assert.equal(
      result.visibleYearCount,
      13
    );

    assert.equal(
      result.hiddenYearCount,
      0
    );
  }
);

test(
  "200-year low tier never expands to one contour per year in far view",
  () => {
    const window =
      windowFor(
        1827,
        2026,
        2026
      );

    const result =
      api.resolve({
        window,
        selectedYear:
          2026,
        band:
          "far",
        tier:
          "low"
      });

    assert.ok(
      result.interval
      >= 20
    );

    assert.ok(
      result.visibleYearCount
      <= 15
    );
  }
);

test(
  "zooming closer monotonically increases temporal resolution",
  () => {
    const window =
      windowFor(
        1927,
        2026,
        2026
      );

    const far =
      api.resolve({
        window,
        band:
          "far",
        selectedYear:
          2026
      });

    const medium =
      api.resolve({
        window,
        band:
          "medium",
        selectedYear:
          2026
      });

    const near =
      api.resolve({
        window,
        band:
          "near",
        selectedYear:
          2026
      });

    const detail =
      api.resolve({
        window,
        band:
          "detail",
        selectedYear:
          2026
      });

    assert.ok(
      far.visibleYearCount
      <= medium.visibleYearCount
    );

    assert.ok(
      medium.visibleYearCount
      <= near.visibleYearCount
    );

    assert.ok(
      near.visibleYearCount
      <= detail.visibleYearCount
    );
  }
);

test(
  "Life Atlas record budget increases as semantic detail increases",
  () => {
    const far =
      api.recordBudget({
        tier:
          "high",
        band:
          "far"
      });

    const medium =
      api.recordBudget({
        tier:
          "high",
        band:
          "medium"
      });

    const detail =
      api.recordBudget({
        tier:
          "high",
        band:
          "detail"
      });

    assert.ok(
      far
      < medium
    );

    assert.ok(
      medium
      < detail
    );

    assert.equal(
      detail,
      900
    );
  }
);
