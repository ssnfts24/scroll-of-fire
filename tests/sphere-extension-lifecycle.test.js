const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(
    path.join(root, relativePath),
    "utf8"
  );
}

const renderer = read(
  "docs/assets/js/sphere/living-time-sphere-renderer-3d.js"
);

const spherePage = read(
  "docs/living-time-sphere.html"
);

test(
  "Sphere extension host loads before Three renderer",
  () => {
    const host =
      spherePage.search(
        /<script[^>]+src="assets\/js\/sphere\/living-time-sphere-extension-host\.js[^"]*"[^>]*><\/script>/
      );

    const rendererScript =
      spherePage.search(
        /<script[^>]+src="assets\/js\/sphere\/living-time-sphere-renderer-3d\.js[^"]*"[^>]*><\/script>/
      );

    assert.ok(host >= 0);
    assert.ok(rendererScript >= 0);
    assert.ok(host < rendererScript);
  }
);

test(
  "renderer creates canonical extension context",
  () => {
    assert.match(
      renderer,
      /function _extensionContext\(extra = \{\}\)/
    );

    assert.match(renderer, /scene: _scene/);
    assert.match(renderer, /camera: _camera/);
    assert.match(renderer, /renderer: _renderer/);
    assert.match(renderer, /model: _model/);
  }
);

test(
  "renderer defers extension hydration until after core scene readiness",
  () => {
    assert.match(
      renderer,
      /function _scheduleDeferredExtensionHydration\(\)/
    );

    assert.match(
      renderer,
      /host\.mountAll\(_extensionContext\(\{ lifecycle: "deferred-mount" \}\)\)/
    );

    assert.match(
      renderer,
      /host\.updateAll\(_extensionContext\(\{ lifecycle: "deferred-initial-sync" \}\)\)/
    );

    assert.match(
      renderer,
      /_scheduleDeferredExtensionHydration\(\)/
    );
  }
);

test(
  "renderer updates extensions during refresh",
  () => {
    assert.match(
      renderer,
      /LivingTimeSphereExtensionHost\?\.updateAll/
    );

    assert.match(
      renderer,
      /lifecycle: "refresh"/
    );
  }
);

test(
  "renderer updates extensions during selected state changes",
  () => {
    assert.match(
      renderer,
      /lifecycle: "selected-state-update"/
    );
  }
);

test(
  "renderer gives extensions frame lifecycle",
  () => {
    assert.match(
      renderer,
      /LivingTimeSphereExtensionHost\?\.renderAll/
    );

    assert.match(
      renderer,
      /lifecycle: "render"/
    );
  }
);

test(
  "renderer disposes extensions before scene destruction",
  () => {
    const dispose =
      renderer.indexOf(
        "LivingTimeSphereExtensionHost?.disposeAll"
      );

    const sceneDispose =
      renderer.indexOf(
        "_disposeObjectTree(_scene)",
        dispose
      );

    assert.ok(dispose >= 0);
    assert.ok(sceneDispose > dispose);
  }
);

test(
  "renderer diagnostics expose extension host state",
  () => {
    assert.match(
      renderer,
      /LivingTimeSphereExtensionHost\?\.diagnostics/
    );
  }
);
