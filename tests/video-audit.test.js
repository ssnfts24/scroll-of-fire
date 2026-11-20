const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const mediaDir = path.join(repoRoot, "docs/assets/media");

function probe(file) {
  const out = execFileSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "stream=codec_type", "-of", "csv=p=0", file],
    { encoding: "utf8", timeout: 20000 }
  );
  return out.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
}

test("every site video is a playable file — the downloads corruption can never sit silent again", t => {
  let ffprobeAvailable = true;
  try {
    execFileSync("ffprobe", ["-version"], { stdio: "ignore" });
  } catch {
    ffprobeAvailable = false;
  }
  if (!ffprobeAvailable) {
    t.skip("ffprobe is not available in this environment; the audit runs where the tooling lives");
    return;
  }
  const files = fs.readdirSync(mediaDir).filter(f => f.endsWith(".mp4")).sort();
  assert.ok(files.length >= 70, `the video estate is inventoried (${files.length} files)`);
  for (const file of files) {
    const streams = probe(path.join(mediaDir, file));
    assert.ok(streams.includes("video"), `${file} has a picture stream (a missing moov atom fails here, as downloads-explainer did until its Nov 20 rebuild)`);
  }
  const downloads = probe(path.join(mediaDir, "downloads-explainer.mp4"));
  assert.ok(downloads.includes("audio"), "the rebuilt downloads explainer carries its narration");
});

test("the rebuilt downloads film stands in the approved language: poster, lazy load, its own page", () => {
  const html = fs.readFileSync(path.join(repoRoot, "docs/downloads.html"), "utf8");
  assert.ok(html.includes('poster="assets/media/downloads-explainer-poster.webp"'), "the film carries a poster");
  assert.ok(html.includes('preload="none"'), "the film lazy-loads");
  assert.ok(
    fs.existsSync(path.join(mediaDir, "downloads-explainer-poster.webp")),
    "the poster file stands in the media folder"
  );
});
