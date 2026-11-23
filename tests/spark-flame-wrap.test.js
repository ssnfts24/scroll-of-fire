/*
 * The flame wrap (wrap: 1) — the blend of the series' flame look
 * around the Spark that already stands.
 *
 * Aaron's direction (Nov 23, 2026) and the fences it was built
 * under: the flame wraps the Spark, it never replaces it; it is
 * drawn from the same seed by its own stream, so no existing
 * draw moves; its hue is the kind's own palette; and a keeper
 * may lift it off — with the wrap off, every born Spark renders
 * byte for byte as it did before the wrap existed. That last
 * promise is pinned here against golden hashes captured from
 * the pre-wrap renderer (main dd02f747) for five seeds — Nori's
 * pinned seed, Selor's passport vector, and a Fire, a Shadow,
 * and a Light seed — at every stage, born and grown.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const Core = require(path.join(root, "docs/assets/js/spark-companion.js"));

const sha = (s) => createHash("sha256").update(s).digest("hex");
const ALL_REVEALED = ["trail", "pattern", "ears", "cheeks", "crest"];

const GOLDEN = {
  nori: { seed: "spark1-8-217-1-3q45gs7i", kind: "water", hashes: {
    "0-born": "334c7366d1f1b8accb26d3b2fb6cce73b35cb9d068feca06715594ad44582d51",
    "0-grown": "e693e4281558fb38abbf6afe8e0bdbcde0b8e77fabf3c3bf5d617fc45cc01de4",
    "1-born": "f7b83b9fa210c0f0ecb9a3d0fa9ccc05809a19b7a52ef4004015a1cbba1c2a6e",
    "1-grown": "15f76b48218fa985b309d0a96d1afd899b14a075d92bae336327be755618d0e6",
    "2-born": "0262b56f5fa20aaaa8961f412ca7154373cc3a54102d952f2486e638e157427a",
    "2-grown": "cf8ba5dfd48a7acf7cea861bd0ef2a85bed56078d2d65883b9cb43646a77c5d4",
  } },
  selor: { seed: "spark1-8-217-1-iuebk69z", kind: "water", hashes: {
    "0-born": "fdddd6b7bc58d230f7bfb89967ffdc46a0e14184d6d29ca36ea02715c3758d87",
    "0-grown": "d5c2e36da551951511944daf668c83394bf85ea3ccde9202fda28f85bcb7d1a8",
    "1-born": "85d619b99f5aee5f9a8babd9101150e369292a36fccef0f76d0ca9b789ce9cdb",
    "1-grown": "d48740073e2b7bec8f219fa8c0c2cbfc569d1b043b4d0e82ccc9c4271911a2f8",
    "2-born": "a497a262ca671a59603d38a8a3c0d4ace8a8e38915aaaf76880f474defa1c2c4",
    "2-grown": "1ce33b0e6bb2ef6b96819062d383b07fcb95d2c48717a9a523cae9f0a1853878",
  } },
  fire: { seed: "spark1-4-92-0-fire0001", kind: "fire", hashes: {
    "0-born": "46657dc1502503de1d9888f02b03d8dcb99919cb88952f08b37354f1cc1adc31",
    "0-grown": "c35fe6acc70bfab1e5c1be37ca4295ea45973e2f373dc2c632d7267eff7572b3",
    "1-born": "0c736405484ef3d4b2a632d66bda25fc1e0cdfe7704df904149a980b852de0ec",
    "1-grown": "cd991fbbeeae761c631d1444a3d44a85e6021b454981b1dbba5dc223e414f2e0",
    "2-born": "2a5660071e1fc33d9ed83e7c2f01e52edfd767614a1523ab265559764fade0e2",
    "2-grown": "a5c0f569fda41e63f65288899ac7587de3233b56902b789d1fb416c29a454fa5",
  } },
  shadow: { seed: "spark1-11-300-2-shad0w42", kind: "shadow", hashes: {
    "0-born": "e9aad9fb8362b55f8d293353df186cbe6e4e063a29a025cf18591a8495674fee",
    "0-grown": "0daf33c039caf7fcd45e146483b1b48e078c503ab23b088d9911ea97f25eb369",
    "1-born": "1409bbdbf2b64e38e902bbf6da4aa88d820540ac6f92c538ead47039c987918e",
    "1-grown": "89cde650a41080f2f5ea1335253c7e627a5bcb9449fa04eb6e9ac120be0f8403",
    "2-born": "3baac0811fe04a3d0517c755bbb0c6b6ea7d1ad310655636721d0ab03f76154b",
    "2-grown": "f4d7ab37beda2663f761c9ee66de459da7c56cc87abc7c6e6a8080cda3fc3ebb",
  } },
  light: { seed: "spark1-1-1-5-light777", kind: "light", hashes: {
    "0-born": "83e0a2cb3c6726011c693f201faea4b31056f0f1746a95634607509b0269bdda",
    "0-grown": "367612b67072672a0a8cbbe384fe6e6f37fdd978a7b0d2f418b20948ca2b5fa4",
    "1-born": "7309ab0ec93e99759e772e805d9c7055678f21b8402995f1635f9149ab5fac3d",
    "1-grown": "b8761519d399bc58dcc41f275632dfb3d7034cd2b8b5000967d0231aebedc282",
    "2-born": "6b36e8ca1234e572e25cbb8e144f4b2dc20a73d2432b6fc4d1d32d68e0fe8693",
    "2-grown": "34b359d541a223fedd0ebe3c0b8c8992d003bcd9e8915b2a614e6a16cff4ce12",
  } },};

test("wrap off: every golden Spark renders byte for byte as before the wrap", () => {
  for (const [name, g] of Object.entries(GOLDEN)) {
    const companion = Core.generate(g.seed);
    assert.equal(companion.kind, g.kind, `${name}: kind`);
    for (const stage of [0, 1, 2]) {
      for (const [rname, revealed] of [["born", null], ["grown", ALL_REVEALED]]) {
        const svg = Core.renderSVG(companion, { stage, revealed, wrap: false });
        assert.equal(sha(svg), g.hashes[`${stage}-${rname}`], `${name} stage ${stage} ${rname}`);
        assert.ok(!svg.includes("spark-flame"), `${name}: no flame with the wrap off`);
        assert.ok(!svg.includes("data-spark-wrap"), `${name}: no wrap mark with the wrap off`);
      }
    }
  }
});

test("wrap on: the flame is added around the core, and the core is untouched", () => {
  for (const g of Object.values(GOLDEN)) {
    const companion = Core.generate(g.seed);
    for (const stage of [0, 1, 2]) {
      const off = Core.renderSVG(companion, { stage, revealed: ALL_REVEALED, wrap: false });
      const on = Core.renderSVG(companion, { stage, revealed: ALL_REVEALED });
      assert.ok(on.includes('data-spark-wrap="1"'), "the wrap is versioned on the drawing");
      assert.ok(on.includes('class="spark-flame"'), "the flame stands in the drawing");
      /* Remove the flame group and the wrap mark from the wrapped
       * drawing: what remains is the unwrapped drawing, exactly. */
      const start = on.indexOf('<g class="spark-flame"');
      const end = on.indexOf('<g class="spark-motes">');
      assert.ok(start > 0 && end > start, "the flame stands before the motes, behind the core");
      const stripped = (on.slice(0, start) + on.slice(end)).replace(' data-spark-wrap="1"', "");
      assert.equal(stripped, off, "the core under the flame is byte for byte the born Spark");
      /* The kind colour — the last carrier of identity — is never spent. */
      assert.ok(on.includes(companion.palette.body), "body colour stands");
      assert.ok(on.includes(companion.palette.glow), "glow colour stands");
      assert.ok(on.includes(companion.palette.accent), "accent colour stands");
    }
  }
});

test("the flame is the seed's: same seed, same flame; its version rides along", () => {
  const a = Core.generate(GOLDEN.selor.seed);
  assert.deepEqual(Core.flameWrapFor(a, 1), Core.flameWrapFor(a, 1));
  assert.equal(Core.flameWrapFor(a, 1).version, 1);
  assert.equal(Core.WRAP_VERSION, 1);
  const b = Core.generate(GOLDEN.fire.seed);
  assert.notDeepEqual(Core.flameWrapFor(a, 1).licks, Core.flameWrapFor(b, 1).licks);
});

test("each kind bends the flame its own way", () => {
  const avg = (seed, stage, pick) => {
    const w = Core.flameWrapFor(Core.generate(seed), stage);
    return w.licks.reduce((s, l) => s + pick(l), 0) / w.licks.length;
  };
  const fireH = avg(GOLDEN.fire.seed, 1, (l) => l.height);
  const shadowH = avg(GOLDEN.shadow.seed, 1, (l) => l.height);
  assert.ok(shadowH < fireH, "Shadow's flame hugs lower than Fire's");
  const waterCurl = avg(GOLDEN.selor.seed, 1, (l) => Math.abs(l.curl));
  const fireCurl = avg(GOLDEN.fire.seed, 1, (l) => Math.abs(l.curl));
  assert.ok(waterCurl > fireCurl, "Water's licks curl further than Fire's");
  const counts = [0, 1, 2].map((s) => Core.flameWrapFor(Core.generate(GOLDEN.fire.seed), s).count);
  assert.ok(counts[0] < counts[1] && counts[1] < counts[2], "the flame's measure grows with the stage");
});

test("the size ladder: the flame simplifies first", () => {
  const companion = Core.generate(GOLDEN.selor.seed);
  const licks = (svg) => (svg.match(/spark-flame-lick/g) || []).length;
  const full = licks(Core.renderSVG(companion, { stage: 2 }));
  const simple = licks(Core.renderSVG(companion, { stage: 2, flameTier: "simple" }));
  const glyph = licks(Core.renderSVG(companion, { stage: 2, flameTier: "glyph" }));
  assert.ok(simple < full, "simple sheds licks");
  assert.ok(glyph <= 5 && glyph < simple, "the glyph keeps only the crown");
  assert.ok(glyph >= 1, "the glyph still carries the flame's silhouette");
});

test("at work, the flame gathers; at rest, it does not pretend to", () => {
  const companion = Core.generate(GOLDEN.fire.seed);
  const rest = Core.renderSVG(companion, { stage: 1 });
  const working = Core.renderSVG(companion, { stage: 1, flameState: "working" });
  assert.ok(!rest.includes("is-working"), "rest carries no working mark");
  assert.ok(working.includes('class="spark-flame is-working"'), "work lights the gather");
});

test("the keeper's hand: the record carries the wrap, and lifting it is reversible", () => {
  const born = Core.newRecord({ seed: GOLDEN.selor.seed, name: "Selor", civilDate: "2026-11-17" });
  assert.equal(born.wrap, 1, "a new record wears the wrap, versioned");
  assert.equal(Core.wrapFor(born), 1);
  assert.equal(Core.wrapFor({ seed: GOLDEN.selor.seed }), 1, "a record that says nothing wears it (the rollout)");
  assert.equal(Core.wrapFor(null), 1);
  const lifted = Core.withWrap(born, 0);
  assert.equal(lifted.wrap, 0);
  assert.equal(born.wrap, 1, "lifting never edits the record it was given");
  assert.equal(Core.wrapFor(lifted), 0);
  assert.equal(Core.withWrap(lifted, 1).wrap, 1, "and it wraps on again");
});

test("the wrap reaches the other renderer and the keeper's panel", () => {
  const three = read("docs/assets/js/spark-3d.js");
  assert.ok(three.includes('":flamewrap"'), "the 3D body reads the same flame stream");
  assert.ok(three.includes("options.wrap"), "the 3D mount takes the keeper's wrap choice");
  assert.ok(three.includes("wrap !== false"), "with the wrap off, the 3D body builds no flame");
  const presence = read("docs/assets/js/spark-presence.js");
  assert.ok(presence.includes("doWrapToggle"), "the panel carries the keeper's wrap control");
  assert.ok(presence.includes("Core.wrapFor(getRecord())"), "the seat honours the record's choice");
  const sphere = read("docs/assets/js/sphere-spark.js");
  assert.ok(sphere.includes("Core.wrapFor(record)"), "the Sphere's Spark honours the record's choice");
});
