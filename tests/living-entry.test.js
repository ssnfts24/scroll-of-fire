"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const HTML = read("docs/index.html");
const CSS = read("docs/assets/css/living-entry.css");
const JS = read("docs/assets/js/living-entry.js");

function htmlFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...htmlFiles(full));
    else if (entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

test("living entry assets exist", () => {
  assert.ok(fs.existsSync(path.join(root, "docs/assets/css/living-entry.css")));
  assert.ok(fs.existsSync(path.join(root, "docs/assets/js/living-entry.js")));
});

test("living entry assets are referenced only by the homepage and Witness's page", () => {
  /* The homepage, and — by Aaron's grant of Nov 18, 2026 — Witness's
   * own page, which opens with the same living entry moment. No other
   * page may borrow the entry. */
  const referencing = htmlFiles(path.join(root, "docs"))
    .filter((file) => fs.readFileSync(file, "utf8").includes("living-entry"))
    .map((file) => path.relative(root, file))
    .sort();
  assert.deepEqual(referencing, ["docs/index.html", "docs/witness.html"]);
});

test("homepage loads the stylesheet and the script after PatternCalendar", () => {
  assert.match(HTML, /<link rel="stylesheet" href="assets\/css\/living-entry\.css\?v=[^"]+">/);
  assert.match(HTML, /<script defer src="assets\/js\/living-entry\.js\?v=[^"]+"><\/script>/);
  const calendarAt = HTML.indexOf("assets/js/calendar/pattern-calendar.js");
  const entryAt = HTML.indexOf("assets/js/living-entry.js");
  assert.ok(calendarAt > -1 && entryAt > calendarAt,
    "living-entry.js must load after pattern-calendar.js so PatternCalendar exists");
});

test("homepage base tag is unchanged and singular", () => {
  const bases = HTML.match(/<base\b/g) || [];
  assert.equal(bases.length, 1);
  assert.match(HTML, /<base href="\.\/">/);
});

test("the overlay is injected by JS, never hard-coded in the HTML", () => {
  assert.ok(!HTML.includes("le-overlay"), "index.html must not contain overlay markup");
  assert.match(JS, /createElement\("div"\)/);
  assert.match(JS, /appendChild\(overlay\)/);
});

test("entry plays on every visit — no session gate remains", () => {
  assert.ok(!JS.includes("sessionStorage"),
    "the once-per-session gate is gone: no sessionStorage reads or writes");
  assert.ok(!JS.includes("sof-living-entry-seen"),
    "the old session key must not be referenced anywhere");
  assert.ok(!JS.includes("SESSION_KEY"),
    "the session-key constant must be removed, not orphaned");
  assert.match(JS, /function showEntry\(\)/);
  assert.match(JS, /appendChild\(overlay\)/,
    "a fresh page load injects the overlay regardless of any prior visit");
});

test("entry honours reduced motion and instant dismissal", () => {
  assert.match(JS, /prefers-reduced-motion/);
  assert.match(JS, /addEventListener\("pointerdown", onPointerdown\)/);
  assert.match(JS, /addEventListener\("keydown", onKeydown, true\)/);
  assert.match(JS, /dismiss\(true\)/,
    "tap and keypress dismiss instantly, never waiting on the soft fade");
});

test("entry timing is longer and softer: ~3.9s total, slow stages, gentle fade", () => {
  const stageMs = Number(JS.match(/const STAGE_MS = (\d+);/)[1]);
  const holdMs = Number(JS.match(/const HOLD_END_MS = (\d+);/)[1]);
  const fadeMs = Number(JS.match(/const FADE_MS = (\d+);/)[1]);
  assert.ok(stageMs >= 550 && stageMs <= 600,
    `status steps breathe at 550–600ms, got ${stageMs}`);
  assert.ok(fadeMs >= 700 && fadeMs <= 800,
    `fade runs 700–800ms, got ${fadeMs}`);
  const total = holdMs + fadeMs;
  assert.ok(total >= 3800 && total <= 4000,
    `total on-screen time is ~3.8–4.0s, got ${total}`);
  const cssFade = CSS.match(/\.le-overlay \{[^}]*transition: opacity ([\d.]+)s/);
  assert.ok(cssFade, "overlay fade transition must be declared in CSS");
  assert.equal(Number(cssFade[1]) * 1000, fadeMs,
    "the CSS fade duration and the JS removal delay must agree");
  const breathe = CSS.match(/\.le-emblem-wrap::before \{[^}]*animation: le-breathe ([\d.]+)s/);
  assert.ok(breathe && Number(breathe[1]) >= 4,
    "the emblem breathing pulse is slowed to 4s or more");
});

test("entry walks the five growth stages in order", () => {
  const stages = ["Witnessing…", "Encoding…", "Resonating…", "Integrating…", "Illuminating…"];
  let last = -1;
  for (const stage of stages) {
    const at = JS.indexOf(stage);
    assert.ok(at > last, `stage ${stage} missing or out of order`);
    last = at;
  }
});

test("entry data line is computed with the site's own PatternCalendar", () => {
  assert.match(JS, /PatternCalendar/);
  assert.match(JS, /fromCivilDate/);
  assert.match(JS, /dayOfPatternYear/);
});

test("PatternCalendar verifies the overlay coordinate for 2026-11-17", () => {
  const files = [
    "pattern-calendar-version.js",
    "pattern-calendar-data.js",
    "pattern-calendar-format.js",
    "pattern-calendar-boundary.js",
    "pattern-calendar.js"
  ];
  for (const file of files) {
    (0, eval)(read("docs/assets/js/calendar/" + file));
  }
  const calendar = globalThis.PatternCalendar;
  assert.ok(calendar, "PatternCalendar must be defined");

  const today = calendar.fromCivilDate({
    date: "2026-11-17",
    timeZone: "America/Los_Angeles",
    boundaryMode: "midnight"
  });
  assert.equal(today.moon, 8);
  assert.equal(today.day, 19);
  assert.equal(today.dayOfPatternYear, 215);

  const epoch = calendar.fromCivilDate({
    date: "2026-04-17",
    timeZone: "UTC",
    boundaryMode: "midnight"
  });
  assert.equal(epoch.moon, 1);
  assert.equal(epoch.day, 1);
  assert.equal(epoch.dayOfPatternYear, 1);

  const outOfTime = calendar.fromCivilDate({
    date: "2027-04-16",
    timeZone: "UTC",
    boundaryMode: "midnight"
  });
  assert.equal(outOfTime.insideCountedYear, false);
  assert.equal(outOfTime.isDayOutOfTime, true);
});

const STEP_IDS = ["step-witness", "step-encode", "step-resonate", "step-integrate", "step-illuminate"];

test("the five step heads exist in Codex order", () => {
  let last = -1;
  for (const id of STEP_IDS) {
    const at = HTML.indexOf(`id="${id}"`);
    assert.ok(at > last, `${id} missing or out of order`);
    last = at;
  }
  for (const name of ["Witness", "Encode", "Resonate", "Integrate", "Illuminate"]) {
    assert.match(HTML, new RegExp(`<h2 id="step-[a-z]+-title">${name}</h2>`));
  }
});

test("continue leads chain step to step and end at the doors", () => {
  const leads = [...HTML.matchAll(/<a class="le-lead-link" href="([^"]+)">/g)]
    .map((m) => ({ href: m[1], at: m.index }));
  assert.deepEqual(
    leads.map((lead) => lead.href),
    ["#step-encode", "#step-resonate", "#step-integrate", "#step-illuminate", "#doors"]
  );
  const headAt = STEP_IDS.map((id) => HTML.indexOf(`id="${id}"`));
  const doorsAt = HTML.indexOf('id="doors"');
  leads.forEach((lead, i) => {
    assert.ok(lead.at > headAt[i], `lead ${i} must come after its step head`);
    const next = i + 1 < headAt.length ? headAt[i + 1] : doorsAt;
    assert.ok(lead.at < next, `lead ${i} must come before the next step`);
  });
});

test("the path rail exists with the five steps in order", () => {
  const rail = HTML.match(/<nav class="le-rail"[\s\S]*?<\/nav>/);
  assert.ok(rail, "path rail nav must exist");
  const hrefs = [...rail[0].matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(hrefs, STEP_IDS.map((id) => "#" + id));
});

test("the doors present the six site areas as chosen doors", () => {
  const doors = HTML.match(/<section class="section-shell le-doors" id="doors"[\s\S]*?<\/section>/);
  assert.ok(doors, "doors section must exist");
  const hrefs = [...doors[0].matchAll(/<a class="le-door" href="([^"]+)">/g)].map((m) => m[1]);
  assert.deepEqual(hrefs, [
    "./codex-atlas.html",
    "scroll/",
    "scroll/lexicon.html",
    "./living-time-sphere.html",
    "./shop.html",
    "./downloads.html"
  ]);
  for (const name of ["Codex Atlas", "Scroll Library", "Hebrew Lexicon", "Living Time Sphere", "Artifact Registry", "Downloads"]) {
    assert.ok(doors[0].includes(name), `door missing: ${name}`);
  }
});

test("sections are never hidden by default — the hidden state is JS-applied only", () => {
  assert.ok(!HTML.includes("le-reveal-pending"),
    "no element may carry the hidden reveal state in markup");
  assert.match(JS, /classList\.add\("le-reveal-pending"\)/);
  assert.ok(!/#main\s*>\s*section\s*\{[^}]*opacity:\s*0/.test(CSS),
    "default section CSS must not hide sections");
  assert.match(CSS, /\.le-reveal-pending\s*\{[^}]*opacity:\s*0/);
});

test("living entry stylesheet carries a reduced-motion guard", () => {
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(CSS, /@media \(prefers-reduced-motion: no-preference\)/);
});

test("existing homepage hooks survive the restructure", () => {
  for (const needle of [
    'id="front-door"',
    "<!-- site-catalog:front-door:start -->",
    "<!-- site-catalog:front-door:end -->",
    'id="front-door-recent"',
    'class="front-door-list"',
    /* The Front Door shows the four newest growth entries; the pin
     * follows the newest date in the record (2026-11-17 — the Nov 1
     * entry rotated off the door, not out of the record). */
    '<time datetime="2026-11-17">',
    'id="home-sphere-observatory"',
    'id="home-title"',
    'id="participation"',
    'id="codex-activity-content"',
    "data-codex-activity-content",
    'id="connect-title"',
    'id="main"'
  ]) {
    assert.ok(HTML.includes(needle), `homepage hook missing after restructure: ${needle}`);
  }
});

/* ------------------------------------------------------------------ */
/* Living activity panel ("The Codex Today")                           */
/* ------------------------------------------------------------------ */

test("the activity panel sits in the Witness step with its three slots", () => {
  const frontDoorEnd = HTML.indexOf("site-catalog:front-door:end");
  const panelAt = HTML.indexOf('id="living-activity"');
  const sphereAt = HTML.indexOf('id="home-sphere-observatory"');
  assert.ok(panelAt > frontDoorEnd, "panel follows the Front Door");
  assert.ok(panelAt < sphereAt, "panel precedes the sphere observatory");
  assert.match(HTML, /data-le-today/);
  assert.match(HTML, /data-le-growth/);
  assert.match(HTML, /data-le-teaching/);
  assert.match(HTML, /data-le-teaching-source/);
});

test("the panel's static growth items mirror the Front Door record verbatim", () => {
  const panel = HTML.slice(HTML.indexOf('id="living-activity"'), HTML.indexOf('id="home-sphere-observatory"'));
  const panelItems = [...panel.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1].replace(/\s+/g, " ").trim());
  assert.ok(panelItems.length >= 3, "panel carries at least three static additions");
  const frontDoor = HTML.slice(HTML.indexOf('id="front-door"'), HTML.indexOf("site-catalog:front-door:end"));
  for (const item of panelItems) {
    assert.ok(frontDoor.replace(/\s+/g, " ").includes(item),
      "panel item must appear verbatim in the Front Door growth record: " + item);
    assert.match(item, /<time datetime="\d{4}-\d{2}-\d{2}">/);
  }
});

test("the panel is fed by real data wiring in living-entry.js", () => {
  assert.match(JS, /function initActivity\(\)/);
  assert.match(JS, /front-door-recent/, "growth slot mirrors the growth record");
  assert.match(JS, /dayOfYear\(new Date\(\)\) % TEACHINGS\.length/,
    "teaching rotates by day-of-year");
  const texts = [...JS.matchAll(/\{\s*text: "([^"]+)", source: "([^"]+)" \}/g)];
  assert.ok(texts.length >= 5, "at least five verbatim teaching lines");
  for (const [, text] of texts) {
    assert.ok(HTML.includes(text), "teaching line must stand verbatim on the homepage: " + text);
  }
});

test("fixture: on 2026-11-17 the day rotation lands on the Living Technology line", () => {
  const texts = [...JS.matchAll(/\{\s*text: "([^"]+)", source: "([^"]+)" \}/g)]
    .map((m) => ({ text: m[1], source: m[2] }));
  // Day-of-year for Nov 17, 2026 (not a leap year): 304 + 17 = 321.
  const dayOfYear = 321;
  const pick = texts[dayOfYear % texts.length];
  assert.equal(pick.source, "Living Technology");
  assert.match(pick.text, /handcrafted copper/);
});
