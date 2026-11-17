"use strict";

const assert = require("node:assert/strict");
const fs     = require("node:fs");
const path   = require("node:path");
const test   = require("node:test");
const vm     = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8");

const MATERIALS = "docs/assets/js/sphere/living-time-sphere-materials.js";
const RENDERER  = "docs/assets/js/sphere/living-time-sphere-renderer-3d.js";

function loadMaterials() {
  const sandbox = { console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read(MATERIALS), sandbox, { filename: MATERIALS });
  return sandbox.LivingTimeSphereM;
}

// The selected pair is built in the renderer from the today sizes with
// fixed multipliers; read them from source so the ratio assertions track
// the real geometry instead of a copied constant.
function rendererMultipliers() {
  const source = read(RENDERER);
  const body = source.match(/SphereGeometry\(mat\.SIZES\.todayRadius \* ([\d.]+)/);
  const halo = source.match(/TorusGeometry\(mat\.SIZES\.todayHalo \* ([\d.]+)/);
  assert.ok(body, "selected body multiplier found in renderer source");
  assert.ok(halo, "selected halo multiplier found in renderer source");
  return { body: Number(body[1]), halo: Number(halo[1]) };
}

test("B7.60 materials exports the separation helper and clearance", () => {
  const mat = loadMaterials();
  assert.equal(typeof mat.markerSeparation, "function");
  assert.equal(mat.MARKER_HALO_CLEARANCE, 0.15);
});

test("B7.60 today halo-to-body ratio is capped at 1.35", () => {
  const { SIZES } = loadMaterials();
  const ratio = SIZES.todayHalo / SIZES.todayRadius;
  assert.ok(ratio > 1, `halo still rings the body (ratio ${ratio})`);
  assert.ok(ratio <= 1.35 + 1e-9, `today halo/body ratio ${ratio} exceeds the 1.35 cap`);
});

test("B7.60 selected halo stays under the cap and shrinks from the old 0.144 diameter", () => {
  const { SIZES } = loadMaterials();
  const mult = rendererMultipliers();
  const selectedBody = SIZES.todayRadius * mult.body;
  const selectedHalo = SIZES.todayHalo * mult.halo;
  const ratio = selectedHalo / selectedBody;
  assert.ok(ratio <= 1.35 + 1e-9, `selected halo/body ratio ${ratio} exceeds the 1.35 cap`);
  assert.ok(2 * selectedHalo < 0.12, `selected halo diameter ${2 * selectedHalo} must be well under the old 0.144`);
});

test("B7.60 same Pattern Day coincides — today wins regardless of distance", () => {
  const { markerSeparation } = loadMaterials();
  const base = { todayDay: 215, todayYear: 2026, selectedDay: 215, selectedYear: 2026 };
  assert.equal(markerSeparation({ ...base, distance: 0 }), "coincide");
  assert.equal(markerSeparation({ ...base, distance: 5 }), "coincide");
  // A missing year on either side must not defeat the day identity.
  assert.equal(markerSeparation({ todayDay: 215, selectedDay: 215, distance: 0 }), "coincide");
});

test("B7.60 same day number in a different Pattern year is not a coincidence", () => {
  const { markerSeparation } = loadMaterials();
  const base = { todayDay: 215, todayYear: 2026, selectedDay: 215, selectedYear: 2020 };
  assert.equal(markerSeparation({ ...base, distance: 0.5 }), "apart");
  assert.equal(markerSeparation({ ...base, distance: 0.05 }), "near");
});

test("B7.60 near markers suppress only the selected halo decision", () => {
  const { markerSeparation, MARKER_HALO_CLEARANCE } = loadMaterials();
  const base = { todayDay: 215, todayYear: 2026, selectedDay: 216, selectedYear: 2026 };
  // One Pattern Day of arc on the ring is ~0.0121 world units.
  assert.equal(markerSeparation({ ...base, distance: 0.0121 }), "near");
  assert.equal(markerSeparation({ ...base, distance: MARKER_HALO_CLEARANCE - 0.001 }), "near");
  assert.equal(markerSeparation({ ...base, distance: MARKER_HALO_CLEARANCE }), "apart");
  assert.equal(markerSeparation({ ...base, distance: 0.5 }), "apart");
});

test("B7.60 missing data degrades to apart — suppression is never the fallback", () => {
  const { markerSeparation } = loadMaterials();
  assert.equal(markerSeparation({ todayDay: null, selectedDay: 215, distance: 0.5 }), "apart");
  assert.equal(markerSeparation({ todayDay: 215, selectedDay: 216, distance: Number.NaN }), "apart");
  assert.equal(markerSeparation({ todayDay: 215, selectedDay: 216 }), "apart");
  assert.equal(markerSeparation(), "apart");
});

test("B7.60 renderer applies the separation decision in both update paths", () => {
  const source = read(RENDERER);
  const decisions = source.match(/mat\.markerSeparation\(\{/g) || [];
  assert.equal(decisions.length, 2, "updateScene and updateSelectedState both consult markerSeparation");
  assert.equal((source.match(/separation !== "coincide"/g) || []).length, 2);
  assert.equal((source.match(/separation === "apart"/g) || []).length, 2);
  assert.ok(!source.includes("selectedDayMarker.visible = true"), "selected marker is never shown unconditionally");
  assert.ok(!source.includes("selectedDayHalo.visible = true"), "selected halo is never shown unconditionally");
});
