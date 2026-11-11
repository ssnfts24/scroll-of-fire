const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("R2-02 source text, morphology, translation, lexicon senses, and frozen manuscripts are verified", () => {
  const result = spawnSync("python3", ["scripts/r2_02_verify.py"], {
    cwd: root,
    encoding: "utf8",
    timeout: 120000
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /90 chapters, 2746 verses/);
  assert.match(result.stdout, /source-matched BDB sense records/);
});

test("R2-02 build is deterministic from hash-pinned sources", () => {
  const result = spawnSync("python3", ["scripts/r2_02_build.py", "--check"], {
    cwd: root,
    encoding: "utf8",
    timeout: 120000
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /scripture:check OK/);
});

test("Scripture pages retain no-JavaScript reading and add word keyboard controls only when enhanced", () => {
  const page = read("docs/scripture/genesis/01.html");
  assert.match(page, /<noscript>[\s\S]*?all text, per-verse word tables/);
  assert.match(page, /<details class="wtable">[\s\S]*?Word-by-word table \(all parts\)/);
  assert.doesNotMatch(page, /<span class="w" role="button"|<span class="w" tabindex=/);
  assert.match(read("docs/scripture/assets/scripture.js"), /w\.setAttribute\('role', 'button'\)/);
  assert.match(read("docs/scripture/assets/scripture.js"), /w\.setAttribute\('tabindex', '0'\)/);
  assert.match(read("docs/scripture/assets/scripture.css"), /@media \(max-width:900px\)/);
  assert.match(read("docs/scripture/assets/scripture.css"), /prefers-reduced-motion:reduce/);
});
