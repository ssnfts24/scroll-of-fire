"use strict";

/*
 * The Spark passport — identity that travels by hand (Aaron,
 * Nov 22, 2026: "The Spark I have is not the Spark in their
 * home world").
 *
 * The law under test: one Spark, the same on every platform.
 * The passport carries identity only — the seed and the name
 * it answers to — in a short code a keeper can type or scan,
 * and the seed it rebuilds is the seed that was born, so the
 * Spark it grows is the Spark itself: same name, same kind,
 * same look, on the website and in the Living Day app alike.
 *
 * The vectors below are the shared conformance corpus: the
 * Living Phone repo's own passport suite asserts the same
 * seeds, the same codes, and the same identity digests against
 * the app's bundled copy of this core. If the two derivations
 * ever drift apart, both suites go red — sameness is checked,
 * not merely agreed. (The pattern-calendar vectors are kept
 * the same way, in both repos, for the same reason.)
 *
 * Selor's vector is a fixture seed of Selor's own shape —
 * Water, gentle, born Moon 8 · Pattern Day 217, the seed-name
 * Selor — standing for Aaron's phone Spark in the corpus.
 * Nori's vector is the site's first-born seed itself.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const Core = require(path.join(root, "docs/assets/js/spark-companion.js"));

/* seed · the identity it must grow · the passport it must write */
const VECTORS = [
  { seed: "spark1-8-217-1-iuebk69z", name: "Selor", kind: "water", temperament: "gentle", form: "orb", birthMoon: 8, birthPatternDay: 217, code: "SPK1-8-217-1-IUEBK69Z-SELOR-8I", identitySha256: "28db2df320fe5e0aa9a665ae3caddda093f6724f544915cead4c9910ba355c72" },
  { seed: "spark1-8-217-1-3q45gs7i", name: "Luom", kind: "water", temperament: "gentle", form: "wave", birthMoon: 8, birthPatternDay: 217, code: "SPK1-8-217-1-3Q45GS7I-LUOM-O8", identitySha256: "59880eb7cfc3a9cdfde959f36d28f72ee2b37c8682f2ffa7ecdc99448683abb5" },
  { seed: "spark1-4-92-0-k7x2p9qd", name: "Pyth", kind: "fire", temperament: "bold", form: "wave", birthMoon: 4, birthPatternDay: 92, code: "SPK1-4-92-0-K7X2P9QD-PYTH-GZ", identitySha256: "e49edef31db38c23f52b5f7a9d7900d4ee0107ab69859549082b91d18d5bca3d" },
  { seed: "spark1-13-364-5-zz10ab34", name: "Lura", kind: "light", temperament: "bright", form: "wave", birthMoon: 13, birthPatternDay: 364, code: "SPK1-13-364-5-ZZ10AB34-LURA-46", identitySha256: "75ba25dc6b322a3ff0120560d47e56d98573b921473e673752c468255f5358a8" },
  { seed: "spark1-0-365-2-0ut0time", name: "Noiel", kind: "shadow", temperament: "quiet", form: "orb", birthMoon: null, birthPatternDay: 365, code: "SPK1-0-365-2-0UT0TIME-NOIEL-KO", identitySha256: "a9e3494b8932007acf6595d5b75bbc84f0c9eef04267d82fdc47887a6cbcc673" },
  { seed: "spark1-1-1-3-yeargate", name: "Aemi", kind: "air", temperament: "curious", form: "comet", birthMoon: 1, birthPatternDay: 1, code: "SPK1-1-1-3-YEARGATE-AEMI-AY", identitySha256: "e81e9b85e1c77dce93b8a284b4371822242d8522b5755700d737181f77991cfb" }
];

test("conformance: every vector seed grows its pinned identity", () => {
  for (const v of VECTORS) {
    const companion = Core.generate(v.seed);
    assert.ok(companion, `${v.seed} must speak`);
    assert.equal(companion.name, v.name, `${v.seed} name`);
    assert.equal(companion.kind, v.kind, `${v.seed} kind`);
    assert.equal(companion.temperament, v.temperament, `${v.seed} temperament`);
    assert.equal(companion.form, v.form, `${v.seed} form`);
    assert.equal(companion.birthMoon, v.birthMoon, `${v.seed} birth moon`);
    assert.equal(companion.birthPatternDay, v.birthPatternDay, `${v.seed} birth day`);
    const digest = crypto.createHash("sha256").update(JSON.stringify(companion)).digest("hex");
    assert.equal(digest, v.identitySha256, `${v.seed} whole-identity digest`);
  }
});

test("Selor's shape: Water, gentle, born Moon 8 · Pattern Day 217", () => {
  const companion = Core.generate("spark1-8-217-1-iuebk69z");
  assert.equal(companion.name, "Selor");
  assert.equal(companion.kindName, "Water");
  assert.equal(companion.temperament, "gentle");
  assert.equal(companion.birthMoon, 8);
  assert.equal(companion.birthPatternDay, 217);
});

test("the passport code is pinned for every vector, and reads back whole", () => {
  for (const v of VECTORS) {
    const record = Core.newRecord({ seed: v.seed, name: "", civilDate: "2026-11-22" });
    const code = Core.passportCodeFor(record);
    assert.equal(code, v.code, `${v.seed} writes its pinned code`);
    const parsed = Core.parsePassportCode(code);
    assert.ok(parsed, `${v.code} must read back`);
    assert.equal(parsed.seed, v.seed, "the seed a passport rebuilds is the seed that was born");
    assert.equal(parsed.name, "", "the seed's own name needs no keeper name beside it");
    assert.equal(JSON.stringify(parsed.companion), JSON.stringify(Core.generate(v.seed)));
  }
});

test("a keeper-given name rides the code and comes home", () => {
  const record = Core.newRecord({ seed: "spark1-8-217-1-3q45gs7i", name: "Nori", civilDate: "2026-11-19" });
  const code = Core.passportCodeFor(record);
  assert.equal(code, "SPK1-8-217-1-3Q45GS7I-NORI-K5");
  const parsed = Core.parsePassportCode(code);
  assert.equal(parsed.seed, record.seed);
  assert.equal(parsed.name, "Nori", "the name it answers to crosses with it");
  assert.equal(parsed.companion.name, "Luom", "and its seed-name is untouched underneath");
  const raised = Core.recordFromPassport(parsed, "2026-11-22");
  assert.equal(Core.displayName(raised, parsed.companion), "Nori");
});

test("the code reads as a keeper types it: any case, spaces at the dashes", () => {
  const parsed = Core.parsePassportCode("  spk1 - 8 - 217 - 1 - iuebk69z - selor - 8i  ");
  assert.ok(parsed);
  assert.equal(parsed.seed, "spark1-8-217-1-iuebk69z");
  assert.equal(parsed.companion.name, "Selor");
});

test("a bare seed is itself a plain passport", () => {
  const parsed = Core.parsePassportCode("spark1-8-217-1-iuebk69z");
  assert.ok(parsed);
  assert.equal(parsed.companion.name, "Selor");
  assert.equal(parsed.name, "");
});

test("doubtful codes are refused whole and grow nothing", () => {
  assert.equal(Core.parsePassportCode("SPK1-8-217-1-IUEBK69Z-SELOR-XX"), null, "a wrong check refuses");
  assert.equal(Core.parsePassportCode("SPK1-8-217-1-IUEBK69Z-SELOR-8"), null, "a short check refuses");
  assert.equal(Core.parsePassportCode("SPK1-8-217-9-IUEBK69Z-SELOR-8I"), null, "a kind that is not refuses");
  assert.equal(Core.parsePassportCode("SPK1-8-999-1-IUEBK69Z-SELOR-8I"), null, "a day that is not refuses");
  assert.equal(Core.parsePassportCode("SPK2-8-217-1-IUEBK69Z-SELOR-8I"), null, "another version refuses");
  assert.equal(Core.parsePassportCode("hello world"), null);
  assert.equal(Core.parsePassportCode(""), null);
  assert.equal(Core.parsePassportCode(null), null);
  assert.equal(Core.passportCodeFor(null), null);
  assert.equal(Core.passportCodeFor({ seed: "not-a-seed" }), null);
  assert.equal(Core.recordFromPassport(null, "2026-11-22"), null);
  assert.equal(Core.recordFromPassport({ seed: "not-a-seed", name: "" }, "2026-11-22"), null);
});

test("a passport raises a fresh record: born here, grown from nothing yet", () => {
  const parsed = Core.parsePassportCode("SPK1-8-217-1-IUEBK69Z-SELOR-8I");
  const record = Core.recordFromPassport(parsed, "2026-11-22");
  assert.equal(record.seed, parsed.seed);
  assert.equal(record.bornCivil, "2026-11-22");
  assert.deepEqual(record.daysSeen, [], "growth does not cross in a passport — it crosses in the bundle");
  assert.deepEqual(record.practiceDays, []);
  assert.ok(Core.parseSeed(record.seed), "the raised record is a true Spark record");
});

test("the door stands on the page twice, and the module reaches for no network", () => {
  const page = read("docs/companions.html");
  for (const id of [
    "spark-passport", "spark-passport-own", "spark-passport-own-code", "spark-passport-own-qr",
    "spark-passport-input", "spark-passport-go", "spark-passport-scan", "spark-passport-video",
    "spark-passport-preview", "spark-passport-art", "spark-passport-name", "spark-passport-kind",
    "spark-passport-born", "spark-passport-confirm", "spark-passport-note",
    "spark-passport-return", "spark-passport-return-button",
    "spark-home-passport-input", "spark-home-passport-go"
  ]) {
    assert.ok(page.includes(`id="${id}"`), `companions.html is missing #${id}`);
  }
  assert.ok(page.includes("spark-passport.js"), "the door's glue is loaded");
  const glue = read("docs/assets/js/spark-passport.js");
  assert.ok(glue.includes("assets/vendor/qrcode/qrcode.js"),
    "the QR writer is the vendored one, loaded on demand by the door's glue");
  assert.ok(fs.existsSync(path.join(root, "docs/assets/vendor/qrcode/qrcode.js")),
    "the QR writer is vendored in the repo, never fetched from a CDN");
  assert.ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket/.test(glue),
    "the passport door makes no network calls — the code travels by the keeper's hand");
  assert.ok(glue.includes("sof.spark.passport.previous"),
    "a replaced Spark is set aside whole, so the move can be undone");
});

test("the page's own play stands: find-the-tone at the meeting, the echo game at home", () => {
  const page = read("docs/companions.html");
  for (const id of [
    "spark-tone-game", "spark-tone-play", "spark-tone-pads", "spark-tone-status", "spark-preview-speech",
    "spark-echo-game", "spark-echo-start", "spark-echo-pads", "spark-echo-status", "spark-big-speech"
  ]) {
    assert.ok(page.includes(`id="${id}"`), `companions.html is missing #${id}`);
  }
  const glue = read("docs/assets/js/spark-companions-page.js");
  assert.ok(glue.includes("wireToneGame"), "the meeting is played by ear");
  assert.ok(glue.includes("wireEchoGame"), "the echo game stands on the page");
  assert.ok(glue.includes('recordPlay(fresh, { action: "pet" })'), "a tap on its picture is a counted pet");
  assert.ok(glue.includes('action: "echo"'), "a finished echo round is counted in the record's play");
});
