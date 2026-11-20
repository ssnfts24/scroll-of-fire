"use strict";

/* Gap sweep fixes (Nov 19, 2026): the contracts this PR establishes.
   - Explainer and rap videos load only when tapped: preload="none" and a
     poster frame, on the pages and in the generators that place them.
   - The homepage links the sphere stylesheet once, not twice.
   - The Documentation Hub's two scripts share one fetch of the hub data.
   - The 13 Moons page leads with the day: its configuration note stands
     after the day's telling, and the first-screen terms are glossed. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const docs = path.join(root, "docs");
const read = (...parts) => fs.readFileSync(path.join(...parts), "utf8");

function* htmlFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(full);
    else if (entry.name.endsWith(".html")) yield full;
  }
}

test("no page preloads video metadata any more", () => {
  for (const file of htmlFiles(docs)) {
    assert.ok(!read(file).includes('preload="metadata"'), path.relative(root, file));
  }
  for (const gen of ["scripts/build-scroll-library.mjs", "scripts/r2_02_pages.py"]) {
    const source = read(root, gen);
    assert.ok(!source.includes('preload="metadata"'), gen);
    assert.ok(source.includes('preload="none"'), gen);
  }
});

test("every mp4 video waits for a tap and shows a poster frame", () => {
  const tagRe = /<video\b[^>]*>/gs;
  const srcRe = /src="([^"]+\.mp4)"/;
  let seen = 0;
  for (const file of htmlFiles(docs)) {
    const html = read(file);
    for (const match of html.matchAll(tagRe)) {
      const tag = match[0];
      const src = srcRe.exec(tag);
      if (!src) continue;
      seen++;
      assert.ok(tag.includes('preload="none"'), `${path.relative(root, file)}: ${src[1]}`);
      if (src[1].endsWith("downloads-explainer.mp4")) continue; // corrupt on main: no frame exists to take
      const poster = /poster="([^"]+)"/.exec(tag);
      assert.ok(poster, `${path.relative(root, file)}: ${src[1]} has no poster`);
      assert.equal(poster[1], src[1].replace(/\.mp4$/, "-poster.webp"));
      const posterPath = path.resolve(path.dirname(file), poster[1]);
      assert.ok(fs.existsSync(posterPath), `poster missing on disk: ${poster[1]}`);
    }
  }
  assert.equal(seen, 74, "the 72 explainer and rap videos, the Spark demo film, and the Ambient Door cartoon film are all covered");
});

test("the homepage links the sphere stylesheet exactly once", () => {
  const html = read(docs, "index.html");
  const links = html.match(/assets\/css\/living-time-sphere\.css/g) || [];
  assert.equal(links.length, 1);
});

test("the hub's two scripts share one fetch of the hub data file", () => {
  const hub = read(docs, "assets/js/documentation-hub.js");
  const patterns = read(docs, "assets/js/documentation-hub-patterns.js");
  for (const script of [hub, patterns]) {
    assert.ok(script.includes("window.__codexHubResponse"), "shared response promise");
    assert.ok(script.includes("response.clone()"), "each reader clones before reading");
  }
  assert.ok(!patterns.includes("await fetch(HUB_URL)"), "the pattern layer no longer fetches the file itself");
});

test("13 Moons: the day leads, the configuration note follows it, terms are glossed", () => {
  const html = read(docs, "moons.html");
  const tellingAt = html.indexOf('id="dayTellingPanel"');
  const noteAt = html.indexOf("Living Calendar Mode:");
  assert.ok(tellingAt > -1 && noteAt > tellingAt, "the configuration note stands after the day's telling");
  const hero = html.slice(0, html.indexOf('id="dayTellingPanel"'));
  assert.ok(!hero.includes("Living Calendar Mode:"), "the hero no longer opens with configuration");
  assert.ok(html.includes('class="hero-note"'), "the plain-words note is on the page");
  assert.ok(html.includes("Earth Hum"), "7.83 Hz is glossed in plain words");
  assert.ok(html.includes("Field number"), "the Field number is glossed in plain words");
  const css = read(docs, "assets/css/moons-interface.css");
  assert.ok(css.includes("#moons-sphere-today-preview .sphere-day-point"), "the mini-sphere day points carry a hit-area rule");
});
