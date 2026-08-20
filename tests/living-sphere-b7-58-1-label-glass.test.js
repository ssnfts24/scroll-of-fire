const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const css = fs.readFileSync(
  'docs/assets/css/living-time-sphere.css',
  'utf8'
);

const sphere = fs.readFileSync(
  'docs/living-time-sphere.html',
  'utf8'
);

const moons = fs.readFileSync(
  'docs/moons.html',
  'utf8'
);

const home = fs.readFileSync(
  'docs/index.html',
  'utf8'
);

const sw = fs.readFileSync(
  'docs/service-worker.js',
  'utf8'
);


test(
  'B7.58.1 keeps Moon labels below semantic inspection cards',
  () => {
    assert.match(
      css,
      /B7\.58\.1 LABEL GLASS \+ OCCLUSION START/
    );

    assert.match(
      css,
      /\.living-time-sphere-page \.sphere-moon-labels\s*\{[\s\S]*?z-index:\s*12 !important/
    );

    assert.match(
      css,
      /\.living-time-sphere-page \.sphere-semantic-label-layer\s*\{[\s\S]*?z-index:\s*20 !important/
    );
  }
);


test(
  'B7.58.1 makes Moon identity glass only barely transparent',
  () => {
    assert.match(
      css,
      /\.living-time-sphere-page \.sphere-moon-label\s*\{[\s\S]*?rgba\(3,\s*12,\s*16,\s*\.965\)/
    );

    assert.match(
      css,
      /\.sphere-moon-label\.is-quiet\s*\{[\s\S]*?rgba\(3,\s*12,\s*16,\s*\.955\)/
    );

    assert.match(
      css,
      /\.sphere-moon-label\.is-selected\s*\{[\s\S]*?rgba\(25,\s*19,\s*6,\s*\.982\)/
    );
  }
);


test(
  'B7.58.1 foreground semantic cards occlude labels behind them',
  () => {
    assert.match(
      css,
      /sphere-semantic-label:not\([\s\S]*?background:\s*rgba\(7,\s*10,\s*15,\s*\.985\) !important/
    );

    assert.match(
      css,
      /sphere-semantic-label\.is-selected:not\([\s\S]*?background:\s*rgba\(24,\s*19,\s*7,\s*\.993\) !important/
    );

    assert.match(
      css,
      /sphere-semantic-label-schedule\s*\{[\s\S]*?rgba\(38,\s*28,\s*7,\s*\.975\)/
    );
  }
);


test(
  'B7.58.1 does not override camera/proximity element opacity',
  () => {
    const block =
      css.slice(
        css.indexOf(
          'B7.58.1 LABEL GLASS + OCCLUSION START'
        ),
        css.indexOf(
          'B7.58.1 LABEL GLASS + OCCLUSION END'
        )
      );

    assert.doesNotMatch(
      block,
      /\bopacity\s*:\s*(?:\.9|0\.9|1)\s*!important/
    );
  }
);


test(
  'B7.58.1 cache-busts the shared Sphere CSS on all three surfaces',
  () => {
    for (const html of [sphere, moons, home]) {
      assert.match(
        html,
        /living-time-sphere\.css\?[^"' ]+&p=20260820-b7581-labelglass/
      );
    }

    assert.match(
      sw,
      /B7\.58\.1 label-glass hotfix/
    );
  }
);
