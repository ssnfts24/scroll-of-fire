"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const docsDir = path.join(root, "docs");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function walkHtml(dir, prefix) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? prefix + "/" + entry.name : entry.name;
    if (entry.isDirectory()) out.push(...walkHtml(path.join(dir, entry.name), rel));
    else if (entry.isFile() && entry.name.endsWith(".html")) out.push(rel);
  }
  return out;
}

const allPages = walkHtml(docsDir, "").sort();

/*
 * The page opening ships inside the shared living layer (living-ui.js +
 * living-ui.css) — the same runtime every content page already loads
 * exactly once through the three nav emission paths
 * (scripts/apply-living-nav.mjs for hand-written pages,
 * scripts/build-scroll-library.mjs for the Scroll Library,
 * scripts/r2_02_pages.py for the Scripture reader). Presence of the
 * layer on a page IS presence of the opening; the exclusions are the
 * pages that carry no living layer at all.
 */
const EXCLUDED = [
  "living-time-sphere.html",
  "404.html",
  "offline.html",
  "caravan.html",
  // Page programme (Nov 24, 2026): the Remnant Whitepaper folded into
  // the Codex White Paper as Part II; this page is a redirect stub now.
  "scroll-of-fire-codex-of-reality-remnant-whitepaper.html",
  // Page programme (Nov 24, 2026): start.html and witness-world.html
  // folded into the front door and the Witness page; redirect stubs now.
  "start.html",
  "witness-world.html",
  // Page programme (Nov 24, 2026): the theory doorway merges folded
  // these four pages into their practical homes; they are now
  // meta-refresh redirect stubs, as caravan.html is.
  "theory/ethics.html",
  "theory/glossary.html",
  "theory/witness.html",
  "theory/frequency-governance.html",
  // Gate G (G2): account.html is a utility page, as offline.html.
  "account.html"
];

const FAMILIES = {
  "hand-written top-level pages": [
    "shop.html",
    "about-aaron.html",
    "moons.html",
    "teach.html"
  ],
  "scroll library (build-scroll-library.mjs)": [
    "scroll/index.html",
    "scroll/lexicon.html",
    "scroll/reader.html"
  ],
  "scripture reader (r2_02_pages.py)": [
    "scripture/index.html",
    "scripture/about.html",
    "scripture/genesis/01.html"
  ]
};

test("the opening lives in the shared living runtime", () => {
  const js = read("docs/assets/js/living-ui.js");
  const css = read("docs/assets/css/living-ui.css");
  assert.match(js, /lpo-overlay/, "runtime must build the opening overlay");
  assert.match(js, /createElement\("div"\)/);
  assert.match(css, /\.lpo-overlay\s*\{/);
  assert.match(css, /\.lpo-emblem/);
  assert.match(css, /\.lpo-name/);
  assert.match(css, /\.lpo-line/);
});

test("the page name is read the way a reader sees it (line breaks honored)", () => {
  const js = read("docs/assets/js/living-ui.js");
  // Headings like "A scroll kept<br><em>whole.</em>" must not fuse into
  // "keptwhole." — the name extraction prefers innerText (which honors
  // <br>) and falls back to textContent.
  assert.match(js, /innerText \|\| heading\.textContent/);
});

test("every page family carries the opening by construction", () => {
  for (const [family, pages] of Object.entries(FAMILIES)) {
    for (const rel of pages) {
      const html = read("docs/" + rel);
      const jsRefs = html.match(/assets\/js\/living-ui\.js/g) || [];
      const cssRefs = html.match(/assets\/css\/living-ui\.css/g) || [];
      assert.equal(jsRefs.length, 1, `${family}: ${rel} must load living-ui.js exactly once`);
      assert.equal(cssRefs.length, 1, `${family}: ${rel} must load living-ui.css exactly once`);
    }
  }
});

test("every non-excluded page on the site carries the opening vehicle", () => {
  const carried = allPages.filter((rel) => !EXCLUDED.includes(rel));
  assert.ok(carried.length >= 160, `expected 160+ content pages, got ${carried.length}`);
  for (const rel of carried) {
    const html = read("docs/" + rel);
    assert.ok(html.includes("assets/js/living-ui.js"),
      `${rel}: must load the shared living runtime that injects the opening`);
  }
});

test("the exclusion list is honored — no opening, no living layer", () => {
  for (const rel of EXCLUDED) {
    const html = read("docs/" + rel);
    assert.ok(!html.includes("living-ui"), `${rel} is excluded and must not reference the living layer`);
    assert.ok(!html.includes("lpo-"), `${rel} is excluded and must not reference the opening`);
  }
});

test("the homepage keeps its own full entry, untouched", () => {
  const html = read("docs/index.html");
  assert.ok(html.includes("assets/js/living-entry.js"),
    "homepage must keep loading its full living entry");
  const js = read("docs/assets/js/living-ui.js");
  assert.match(js, /living-entry/,
    "living-ui.js must opt out where living-entry.js runs, so the homepage never gets both");
});

test("reduced motion: the opening never appears and never animates", () => {
  const js = read("docs/assets/js/living-ui.js");
  const css = read("docs/assets/css/living-ui.css");
  assert.match(js, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(js, /if \(reducedMotion\) return;\s*\n\s*if \(lpoSeenThisSession\(\)\) return;\s*\n\s*const overlay = document\.createElement/s,
    "the opening builder must be gated on the reduced-motion check (and the once-per-session memory) before anything is built");
  const reduceBlock = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(reduceBlock, /\.lpo-overlay\s*\{\s*display:\s*none/);
  assert.match(reduceBlock, /body\.lpo-opening main\s*\{\s*animation:\s*none/);
});

test("no-JS safety: the opening state never appears in markup", () => {
  for (const rel of allPages) {
    const html = read("docs/" + rel);
    assert.ok(!html.includes("lpo-overlay"), `${rel}: overlay must be JS-injected only`);
    assert.ok(!html.includes("lpo-opening"), `${rel}: opening class must be JS-applied only`);
  }
  const css = read("docs/assets/css/living-ui.css");
  assert.ok(!/body\.living-ui main\s*\{[^}]*opacity:\s*0/.test(css),
    "main must not be hidden by default; the rise is an animation under a JS-only class");
  assert.match(css, /body\.lpo-opening main\s*\{\s*animation:\s*lpo-rise/);
});

test("while it plays, the opening stands apart from the page", () => {
  const css = read("docs/assets/css/living-ui.css");
  const overlayRule = css.match(/\.lpo-overlay\s*\{[^}]*\}/);
  assert.ok(overlayRule, "overlay rule must exist");
  // Opaque deep-stone ground — the homepage entry's own recipe
  // (.le-overlay in living-entry.css): faint glows over a solid dark
  // gradient, never a translucent veil the page can bleed through.
  assert.match(overlayRule[0], /background:/,
    "the overlay must carry its own opaque ground");
  assert.match(overlayRule[0], /linear-gradient\(170deg, #0a0e18 0%, #05070d 70%\)/,
    "the ground must be the entry's opaque deep-stone gradient");
  assert.match(overlayRule[0], /position:\s*fixed/);
  assert.match(overlayRule[0], /inset:\s*0/,
    "the overlay must cover the full viewport");
  assert.match(overlayRule[0], /pointer-events:\s*auto/,
    "while it plays, the overlay takes the taps — nothing reaches the page beneath");
  // The exit fade releases the page again, exactly like the entry's.
  const leavingRule = css.match(/\.lpo-overlay\.lpo-leaving\s*\{[^}]*\}/);
  assert.ok(leavingRule, "leaving rule must exist");
  assert.match(leavingRule[0], /opacity:\s*0/);
  assert.match(leavingRule[0], /pointer-events:\s*none/);
  // And the page is scroll-locked beneath it, like the entry's le-lock.
  assert.match(css, /body\.lpo-opening\s*\{\s*overflow:\s*hidden/,
    "the page must be scroll-locked while the opening plays");
  const js = read("docs/assets/js/living-ui.js");
  // Dismissal is the homepage entry's model — tap or key, instantly.
  // Scroll must NOT dismiss: the page is locked still beneath the
  // opening, and pages that scroll themselves on arrival (the 13
  // Moons page does) must not kill their own opening.
  assert.match(js, /LPO_DISMISS_EVENTS = \["pointerdown", "keydown"\]/,
    "the opening must dismiss on tap or key only, like the homepage entry");
  assert.match(js, /dismiss\(true\)/,
    "a visitor's gesture must take the instant-dismissal path, never the fade");
  assert.match(js, /overlay\.remove\(\)/, "the overlay must remove itself, leaving nothing behind");
});

test("the opening's pacing is at least the homepage entry's, and CSS agrees with JS", () => {
  const js = read("docs/assets/js/living-ui.js");
  const entryJs = read("docs/assets/js/living-entry.js");
  const fadeAt = Number(js.match(/LPO_FADE_AT_MS = (\d+)/)[1]);
  const fadeMs = Number(js.match(/LPO_FADE_MS = (\d+)/)[1]);
  const entryHold = Number(entryJs.match(/HOLD_END_MS = (\d+)/)[1]);
  const entryFade = Number(entryJs.match(/FADE_MS = (\d+)/)[1]);
  assert.ok(fadeAt >= entryHold,
    `the opening must hold at least the entry's ${entryHold}ms, got ${fadeAt}ms`);
  assert.equal(fadeMs, entryFade,
    "the opening's fade must match the entry's fade");
  assert.ok(fadeAt + fadeMs >= entryHold + entryFade,
    "total on-screen time must be at least the entry's");
  const css = read("docs/assets/css/living-ui.css");
  const overlayRule = css.match(/\.lpo-overlay\s*\{[^}]*\}/)[0];
  const transition = overlayRule.match(/transition:\s*opacity\s+([\d.]+)s/);
  assert.ok(transition, "the overlay's fade must be a CSS opacity transition");
  assert.equal(Number(transition[1]) * 1000, fadeMs,
    "the CSS fade duration must equal LPO_FADE_MS in living-ui.js");
});

test("the opening plays once per session, never on every page", () => {
  const js = read("docs/assets/js/living-ui.js");
  // Remembered in sessionStorage: read before building, written when shown.
  assert.match(js, /sessionStorage\.getItem\(LPO_SEEN_KEY\)/,
    "the opening must check the session memory before playing");
  assert.match(js, /sessionStorage\.setItem\(LPO_SEEN_KEY, "1"\)/,
    "the opening must record that it has played this session");
  assert.match(js, /if \(lpoSeenThisSession\(\)\) return;/,
    "a page load later in the same session must skip the opening entirely");
  assert.match(js, /lpoMarkSeen\(\);/,
    "showing the opening is what marks the session");
  // Storage refusal fails open (the catch returns false = not seen),
  // so private-mode visitors simply get the opening as before.
  assert.match(js, /catch \(error\) \{\s*return false;/,
    "a storage refusal must fail open, never break the page");
  // The homepage entry is a separate, deliberate behaviour — Aaron
  // chose every-visit there (PR #98) — and this memory must not leak
  // into it.
  const entryJs = read("docs/assets/js/living-entry.js");
  assert.ok(!/sessionStorage|LPO_SEEN_KEY/.test(entryJs),
    "the homepage entry must keep its every-visit behaviour, untouched by the page opening's memory");
});

test("late in the hold, one quiet line shows the way forward", () => {
  const js = read("docs/assets/js/living-ui.js");
  const css = read("docs/assets/css/living-ui.css");
  assert.match(js, /hintEl\.className = "lpo-hint"/,
    "the opening must build its way-forward line");
  assert.match(js, /hintEl\.textContent = "Tap anywhere to continue"/,
    "the way forward is stated in plain words");
  const hintRule = css.match(/\.lpo-hint\s*\{[^}]*\}/);
  assert.ok(hintRule, "the way-forward line must be styled");
  // It settles in late (1.8s), like a cue near the end of the hold —
  // never competing with the mark's own settle at the start.
  assert.match(hintRule[0], /animation:\s*lpo-settle 0\.8s[^;]*1\.8s both/,
    "the way-forward line must settle in late in the hold (1.8s delay)");
});

test("the opening adds no controls and asks for no decisions", () => {
  const js = read("docs/assets/js/living-ui.js");
  const opening = js.slice(js.indexOf("The page opening"));
  assert.ok(!/createElement\("button"\)|createElement\("a"\)|createElement\("input"\)/.test(opening),
    "the opening must not add buttons, links, or inputs");
  assert.match(opening, /setAttribute\("aria-hidden", "true"\)/,
    "the opening is decoration: hidden from assistive tech, no focus changes");
});

test("the living line never invents a coordinate", () => {
  const js = read("docs/assets/js/living-ui.js");
  assert.match(js, /globalThis\.PatternCalendar/,
    "the coordinate may only come from the site's own PatternCalendar");
  assert.match(js, /calendar\.fromCivilDate/);
  assert.match(js, /toLocaleDateString\("en-US"/,
    "the civil date line is always available as the fallback");
  // Every main-house page that carries the living opening also carries the
  // calendar, so the coordinate an opening speaks is always the computed
  // one. (The Scroll and Scripture houses keep their own page furniture and
  // are outside this sweep.) The civil-only fallback in living-ui.js stays
  // for any page where the calendar is absent — it is never a guess.
  const offenders = walkHtml(docsDir, "")
    .filter(rel => !rel.startsWith("scroll/") && !rel.startsWith("scripture/"))
    .filter(rel => {
      const html = read("docs/" + rel);
      return html.includes("living-ui.js") && !html.includes("pattern-calendar");
    });
  assert.deepEqual(offenders, [],
    "every main-house page with the living opening must carry the PatternCalendar");
  // Pages without temporal code load no calendar: the line stays civil-only.
  // (The main house, shop included, gained the calendar with the Living Moon
  // Theme so every room can change with the moon. Interactivity wave 1 gave
  // 404.html the calendar too — deliberately: its day line speaks only the
  // coordinate PatternCalendar computes, and its static fallback names no
  // coordinate at all, so the never-invent rule holds there as well.)
  const gate = read("docs/404.html");
  assert.ok(gate.includes("pattern-calendar"),
    "404.html carries the PatternCalendar, so its day line may show the coordinate");
  assert.ok(gate.includes("PatternCalendar.fromCivilDate"),
    "the 404 day line is computed by the canonical engine, never written by hand");
  // A page that does carry the calendar gets the full coordinate.
  const moons = read("docs/moons.html");
  assert.ok(moons.includes("pattern-calendar"),
    "moons.html carries the PatternCalendar, so its opening may show the coordinate");
});
