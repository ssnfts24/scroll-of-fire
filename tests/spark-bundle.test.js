/*
 * Spark companion — the record bundle, spoken by the website.
 *
 * The Living Phone app has carried a Spark's whole record in one
 * file since its v2 — seed, growth, garden, pins, sealed with a
 * SHA-256 over the canonical payload. This suite pins the website
 * speaking the same format, byte for byte:
 *
 *  - the fixture in tests/fixtures/spark-bundle-app-format.json
 *    was built by the APP's own reference code (its senses-core),
 *    over a record grown by this site's Spark core — if the site's
 *    verify accepts it and its hash recomputes, the two sides
 *    truly speak one format;
 *  - a bundle the site builds round-trips whole;
 *  - a damaged bundle is refused whole, with the reason named,
 *    and a different Spark is never overwritten without the
 *    keeper's confirm — the persistence fence;
 *  - the pinned seed is Nori's: the first born, whose film seed
 *    must regenerate the same Spark forever.
 *
 * Nothing here may reach for a network, an account, or a
 * protected R1.7 file.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const Core = require(path.join(root, "docs/assets/js/spark-companion.js"));
const Bundle = require(path.join(root, "docs/assets/js/spark-bundle.js"));

const NORI_SEED = "spark1-8-217-1-3q45gs7i";
const fixture = JSON.parse(read("tests/fixtures/spark-bundle-app-format.json"));

test("the digest is plain SHA-256, whoever computes it", () => {
  assert.equal(
    Bundle.sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
  );
  const text = Bundle.canonical({ b: [1, 2], a: { d: "x", c: null } });
  assert.equal(
    Bundle.sha256Hex(text),
    crypto.createHash("sha256").update(text, "utf8").digest("hex")
  );
});

test("canonical JSON does not care who ordered the keys", () => {
  assert.equal(
    Bundle.canonical({ b: 1, a: { d: 2, c: [3, { f: 4, e: 5 }] } }),
    Bundle.canonical({ a: { c: [3, { e: 5, f: 4 }], d: 2 }, b: 1 })
  );
  assert.equal(Bundle.canonical({ a: 1 }), "{\"a\":1}");
});

test("the app's own bundle verifies here, hash and all", () => {
  assert.equal(fixture.format, "living-phone-spark-bundle");
  assert.equal(fixture.version, 1);
  const check = Bundle.verifyBundle(fixture);
  assert.equal(check.ok, true, check.reason);
  assert.equal(check.payload.spark.record.seed, NORI_SEED);
  assert.equal(check.payload.spark.record.name, "Nori");
  assert.equal(check.payload.garden.length, 2);
  assert.equal(check.payload.pins.length, 1);
});

test("the fixture's Spark is Nori — the same seed, the same Spark", () => {
  const parsed = Core.parseSeed(NORI_SEED);
  assert.deepEqual(
    { moon: parsed.moon, patternDay: parsed.patternDay, kindIndex: parsed.kindIndex, nonce: parsed.nonce },
    { moon: 8, patternDay: 217, kindIndex: 1, nonce: "3q45gs7i" }
  );
  const companion = Core.generate(NORI_SEED);
  assert.equal(companion.name, "Luom");
  assert.equal(companion.kind, "water");
  assert.equal(companion.kindName, "Water");
  const record = fixture.payload.spark.record;
  assert.equal(Core.displayName(record, companion), "Nori");
  const rarity = Core.rarityFor({ record, companion });
  assert.ok(rarity && typeof rarity.line === "string" && rarity.line.length > 0);
  assert.deepEqual(Core.rarityFor({ record, companion }), rarity);
});

test("a bundle the site builds round-trips whole", () => {
  const seed = Core.makeSeed({ moon: 4, patternDay: 92, kindIndex: 0, nonce: "c0ffee42" });
  let record = Core.newRecord({ seed, name: "Ember", civilDate: "2026-07-17" });
  record = Core.recordVisit(record, { patternDay: 92, page: "companions.html" });
  record = Core.recordPractice(record, { patternDay: 92 });
  const payload = {
    spark: { record, pendingSeed: null, sound: "off", voice: "on" },
    garden: fixture.payload.garden,
    pins: fixture.payload.pins,
  };
  const bundle = Bundle.buildBundle(payload, "2026-11-19T22:00:00.000Z");
  assert.equal(bundle.format, Bundle.BUNDLE_FORMAT);
  assert.equal(bundle.version, 1);
  assert.equal(bundle.app, "org.codexofreality.livingphone");
  const carried = JSON.parse(JSON.stringify(bundle));
  const check = Bundle.verifyBundle(carried);
  assert.equal(check.ok, true, check.reason);
  assert.deepEqual(check.payload, payload);
  /* and the restored record regenerates the identical Spark */
  const restored = check.payload.spark.record;
  assert.deepEqual(Core.generate(restored.seed), Core.generate(seed));
  assert.deepEqual(restored, record);
});

test("a damaged bundle is refused whole, with the reason named", () => {
  const tampered = JSON.parse(JSON.stringify(fixture));
  tampered.payload.spark.record.name = "Someone Else";
  assert.deepEqual(Bundle.verifyBundle(tampered), { ok: false, reason: "integrity-mismatch" });

  const wrongFormat = { ...fixture, format: "some-other-file" };
  assert.deepEqual(Bundle.verifyBundle(wrongFormat), { ok: false, reason: "wrong-format" });

  const wrongVersion = { ...fixture, version: 2 };
  assert.deepEqual(Bundle.verifyBundle(wrongVersion), { ok: false, reason: "unsupported-version" });

  const noRecord = JSON.parse(JSON.stringify(fixture));
  delete noRecord.payload.spark.record;
  assert.deepEqual(Bundle.verifyBundle(noRecord), { ok: false, reason: "missing-spark-record" });

  const noIntegrity = JSON.parse(JSON.stringify(fixture));
  delete noIntegrity.integrity;
  assert.deepEqual(Bundle.verifyBundle(noIntegrity), { ok: false, reason: "missing-integrity" });

  assert.deepEqual(Bundle.verifyBundle(null), { ok: false, reason: "not-an-object" });
  assert.deepEqual(Bundle.verifyBundle("a string"), { ok: false, reason: "not-an-object" });
});

test("a seed that does not speak is refused at the seed step", () => {
  /* verifyBundle checks the seed's shape, as the format's
   * reference does; the page then asks the Spark core itself —
   * a seed with the right prefix and no meaning stops there. */
  const shaped = Bundle.buildBundle({
    spark: { record: { seed: "spark9-99-999-9-nope" }, pendingSeed: null, sound: null, voice: null },
    garden: [],
    pins: [],
  });
  assert.equal(Bundle.verifyBundle(shaped).ok, true);
  assert.equal(Core.parseSeed(shaped.payload.spark.record.seed), null);
});

test("the persistence fence: a different Spark takes the keeper's word", () => {
  const payload = fixture.payload;
  assert.equal(Bundle.importDecision(null, payload), "restore");
  assert.equal(Bundle.importDecision({}, payload), "restore");
  assert.equal(Bundle.importDecision({ seed: NORI_SEED }, payload), "restore");
  const other = Core.makeSeed({ moon: 1, patternDay: 1, kindIndex: 2, nonce: "0badf00d" });
  assert.equal(Bundle.importDecision({ seed: other }, payload), "confirm-overwrite");
});

test("the garden returns by id, only where not already held", () => {
  const payload = fixture.payload;
  const [tend, pass] = payload.garden;
  assert.deepEqual(Bundle.gardenRestorePlan(payload, new Set()), [tend, pass]);
  assert.deepEqual(Bundle.gardenRestorePlan(payload, new Set([tend.id])), [pass]);
  assert.deepEqual(Bundle.gardenRestorePlan(payload, new Set([tend.id, pass.id])), []);
  assert.deepEqual(Bundle.gardenRestorePlan({ garden: [] }, new Set()), []);
  assert.deepEqual(Bundle.gardenRestorePlan({}, new Set()), []);
});

test("pins merge by kind and ref — restoring never unpins", () => {
  const existing = [
    { kind: "photo-day", ref: "2026-11-19", label: "Kept here", pinnedAt: "2026-11-19T10:00:00.000Z" },
    { kind: "calendar-event", ref: "evt-1", label: "Mine", pinnedAt: "2026-11-19T10:05:00.000Z" },
  ];
  const incoming = [
    { kind: "photo-day", ref: "2026-11-19", label: "From the file", pinnedAt: "2026-11-19T20:00:00.000Z" },
    { kind: "photo-day", ref: "2026-11-18", label: "New", pinnedAt: "2026-11-19T20:01:00.000Z" },
    { kind: "", ref: "broken" },
    null,
  ];
  const merged = Bundle.mergePins(existing, incoming);
  assert.equal(merged.length, 3);
  assert.equal(merged[0], existing[0], "a held pin is kept exactly as it was");
  assert.equal(merged[1], existing[1]);
  assert.equal(merged[2].ref, "2026-11-18");
  assert.deepEqual(Bundle.mergePins([], []), []);
});

test("the travel door sends nothing anywhere", () => {
  for (const rel of [
    "docs/assets/js/spark-bundle.js",
    "docs/assets/js/spark-companions-travel.js",
  ]) {
    const source = read(rel);
    assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|WebSocket/.test(source), `${rel} reaches for a network`);
    assert.ok(!/https?:\/\//.test(source), `${rel} names an address`);
  }
});

test("the companions page carries the travel door, wired to the bundle", () => {
  const page = read("docs/companions.html");
  for (const id of [
    "spark-travel-export",
    "spark-travel-import",
    "spark-travel-file",
    "spark-travel-note",
    "spark-travel-confirm",
    "spark-travel-confirm-text",
    "spark-travel-confirm-button",
  ]) {
    assert.ok(page.includes(`id="${id}"`), `companions.html is missing #${id}`);
  }
  assert.match(page, /assets\/js\/spark-bundle\.js/);
  assert.match(page, /assets\/js\/spark-companions-travel\.js/);
  const travel = read("docs/assets/js/spark-companions-travel.js");
  assert.match(travel, /Bundle\.buildBundle/);
  assert.match(travel, /Bundle\.verifyBundle/);
  assert.match(travel, /Bundle\.importDecision/);
  assert.match(travel, /Core\.parseSeed/);
  /* the page's own words stay honest: carrying her by hand is
   * here, accounts are not */
  assert.match(page, /Keeping a Spark across devices is here/);
});
