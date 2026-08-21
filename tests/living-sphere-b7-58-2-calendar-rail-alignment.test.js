const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const renderer = fs.readFileSync(
  'docs/assets/js/sphere/living-time-sphere-renderer-3d.js',
  'utf8'
);
const labels = fs.readFileSync(
  'docs/assets/js/sphere/living-time-sphere-label-manager.js',
  'utf8'
);
const extension = fs.readFileSync(
  'docs/assets/js/sphere/life-atlas-record-sphere-extension.js',
  'utf8'
);
const css = fs.readFileSync(
  'docs/assets/css/living-time-sphere.css',
  'utf8'
);
const sphere = fs.readFileSync(
  'docs/living-time-sphere.html',
  'utf8'
);

test('B7.59.2B moves day numerals onto a presentation lane while preserving canonical day identity', () => {
  assert.match(
    renderer,
    /kind: "pattern-day-number"[\s\S]*?worldX: presentationPoint\.x,[\s\S]*?worldY: 0\.010,[\s\S]*?worldZ: presentationPoint\.z/
  );
  assert.match(
    renderer,
    /kind: "intercalary-day-number"[\s\S]*?worldX: point\.x, worldY: 0\.008, worldZ: point\.z/
  );
  /*
   * B7.54 intentionally half-pixel-snaps the projected day rail while the
   * camera is moving. B7.58.2 must preserve that stabilization rather than
   * reverting to the older direct candidate.anchorX / anchorY assignment.
   */
  assert.match(
    labels,
    /const railX =[\s\S]*?candidate\.anchorX \* 2[\s\S]*?: candidate\.anchorX/
  );

  assert.match(
    labels,
    /const railY =[\s\S]*?candidate\.anchorY \* 2[\s\S]*?: candidate\.anchorY/
  );

  assert.match(
    labels,
    /el\.style\.left =[\s\S]*?`\$\{railX\}px`;[\s\S]*?el\.style\.top =[\s\S]*?`\$\{railY\}px`;/
  );
});

test('B7.59.2A far zoom keeps a sparse structural day skeleton', () => {
  const start = labels.indexOf('const railZoomOpacity =');
  const far = labels.indexOf('if (band === "far")', start);
  const skeleton = labels.indexOf('B7.59.2A — keep a readable four-week skeleton', start);

  assert.ok(start >= 0 && far > start && skeleton > far);
  assert.match(
    labels,
    /if \(band === "far"\) \{[\s\S]*?return scheduled[\s\S]*?\? 0\.84[\s\S]*?: 0\.58;/
  );
  assert.match(
    labels,
    /const farFrontAnchor =[\s\S]*?moonDay === 1[\s\S]*?moonDay === 7[\s\S]*?moonDay === 14[\s\S]*?moonDay === 21[\s\S]*?moonDay === 28/
  );
  assert.match(
    labels,
    /const farNeighborAnchor =[\s\S]*?moonDay === 1[\s\S]*?moonDay === 14[\s\S]*?moonDay === 28/
  );
});

test('B7.58.2 selected Moon card stays closer to its physical anchor', () => {
  assert.match(
    labels,
    /const selectedMoonCard =[\s\S]*?target\.kind === "moon"[\s\S]*?target\.selected/
  );
  assert.match(
    labels,
    /selectedMoonCard[\s\S]*?mobile[\s\S]*?\? 34[\s\S]*?: 46/
  );
  assert.match(
    labels,
    /const outwardX =[\s\S]*?candidate\.anchorX[\s\S]*?radialUnitX[\s\S]*?semanticOutward/
  );
});

test('B7.58.2 schedule glyphs are 10 percent smaller without extra meshes', () => {
  assert.match(
    extension,
    /B7\.58\.2 schedule symbol scale[\s\S]*?\* 0\.90/
  );
  assert.match(extension, /living-plan-day-points/);
  assert.match(extension, /new THREE\.Points\(geometry, material\)/);
});

test('B7.58.2 schedule summaries are slightly more compact', () => {
  assert.match(css, /B7\.58\.2 SCHEDULE COMPACTNESS START/);
  assert.match(
    css,
    /living-plan-summary[\s\S]*?max-width: min\(9rem, 36vw\)/
  );
  assert.match(
    css,
    /living-plan-summary[\s\S]*?font-size: \.59rem/
  );
});

test('B7.58.2 cache-busts the changed presentation assets', () => {
  assert.match(
    sphere,
    /living-time-sphere-renderer-3d\.js\?[^"' ]+&u=20260820-b7582-railalign/
  );
  assert.match(
    sphere,
    /living-time-sphere-label-manager\.js\?[^"' ]+&u=20260820-b7582-railalign/
  );
  assert.match(
    sphere,
    /life-atlas-record-sphere-extension\.js\?[^"' ]+&u=20260820-b7582-railalign/
  );
  assert.match(
    sphere,
    /living-time-sphere\.css\?[^"' ]+&u=20260820-b7582-railalign/
  );
});
