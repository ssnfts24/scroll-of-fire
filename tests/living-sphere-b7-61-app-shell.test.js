const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const page = fs.readFileSync(path.join(ROOT, "docs/living-time-sphere.html"), "utf8");
const shellJs = fs.readFileSync(path.join(ROOT, "docs/assets/js/sphere/living-time-sphere-app-shell.js"), "utf8");
const shellCss = fs.readFileSync(path.join(ROOT, "docs/assets/css/living-time-sphere-app.css"), "utf8");

test("B7.61 the sphere page carries an installed-app identity", () => {
  assert.match(page, /<link rel="manifest" href="manifest-sphere\.webmanifest">/);
  assert.match(page, /name="theme-color" content="#05070d"/);
  assert.match(page, /apple-mobile-web-app-capable/);
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/manifest-sphere.webmanifest"), "utf8"));
  assert.equal(manifest.display, "standalone");
  assert.match(manifest.start_url, /living-time-sphere\.html/);
});

test("B7.61 the app shell assets load with the page", () => {
  assert.match(page, /living-time-sphere-app\.css\?v=20261117-b761-rework/);
  assert.match(page, /living-time-sphere-app-shell\.js\?v=20261117-b761-rework/);
  assert.match(page, /living-time-sphere-sky\.js\?v=20261117-b761-rework/);
});

test("B7.61 the stage is a full-viewport app surface with sheets and a dock", () => {
  assert.match(shellCss, /body\.sphere-app \.sphere-wrapper\s*\{[^}]*position:\s*fixed/);
  assert.match(shellCss, /body\.sphere-app \.sphere-sheet/);
  assert.match(shellCss, /translateY\(105%\)/);
  assert.match(shellCss, /translateX\(105%\)/);
  assert.match(shellCss, /prefers-reduced-motion:\s*reduce/);
  assert.match(shellCss, /env\(safe-area-inset-bottom/);
});

test("B7.61 the shell proxies the real controls and the canonical cursor events", () => {
  for (const id of ["sphere-cam-pattern", "sphere-cam-passage", "sphere-cam-years", "sphere-everyday-today", "sphere-day-prev", "sphere-day-next", "sphere-motion-mode"]) {
    assert.ok(shellJs.includes(id), `app shell must proxy #${id}`);
  }
  assert.match(shellJs, /sof:temporal-cursor-change/);
  assert.match(shellJs, /sphere-state-strip/);
  // Panels are presented as sheets, never removed.
  for (const target of [".sphere-controls-bar", "calendar-workbench", "living-planner", ".sphere-sidebar"]) {
    assert.ok(shellJs.includes(target), `sheet target ${target} registered`);
  }
});

test("B7.61 every layer row carries a stable slot key for future layers", () => {
  const expected = ["pattern", "exactDays", "weekGates", "outsideDays", "passage", "lunar", "solar", "planets", "markers", "recurrence", "spiral", "environment", "connections"];
  for (const key of expected) {
    assert.ok(page.includes(`data-layer-slot="${key}"`), `missing layer slot ${key}`);
  }
  assert.match(page, /data-layer-slots/);
  // No fake Earth toggle ships before the Earth layer exists.
  assert.ok(!page.includes('data-layer-slot="earth"'));
  assert.ok(!/sphere-layer-earth/.test(page));
});
