const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const repoRoot = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function loadSeat() {
  const context = vm.createContext({ console, module: { exports: {} }, exports: {} });
  context.globalThis = context;
  vm.runInContext(read("docs/assets/js/spark-agent-seat.js"), context, { filename: "spark-agent-seat.js" });
  return context.module.exports;
}

test("Aaron's menu rule: the arrival self-opening is gated to once per visit", () => {
  const presence = read("docs/assets/js/spark-presence.js");
  assert.ok(presence.includes('const MENU_POP_KEY = "sof.spark.menuPopped";'), "the once is kept under the companion's own key family");
  assert.ok(presence.includes("window.sessionStorage.getItem(MENU_POP_KEY)"), "the once belongs to the visit (session storage)");
  assert.ok(
    presence.includes("if ((arrival || growthLine) && !menuPopped()) {"),
    "the arrival/growth self-opening runs only when the visit has not been greeted"
  );
  const gateAt = presence.indexOf("if ((arrival || growthLine) && !menuPopped()) {");
  const markAt = presence.indexOf("markMenuPopped();", gateAt);
  const openAt = presence.indexOf("openConvo();", gateAt);
  assert.ok(markAt > gateAt && openAt > markAt, "the visit is marked greeted as the one pop opens");
});

test("Aaron's menu rule: after the once, the Spark's button says a tap opens its menu", () => {
  const presence = read("docs/assets/js/spark-presence.js");
  assert.ok(presence.includes("tap to open my menu"), "the click signal is stated on the Spark itself");
  assert.ok(!presence.includes("tap for a suggestion"), "the old, vaguer label is gone");
  assert.ok(presence.includes('document.body.classList.add("spark-menu-present")'), "the presence marks the page as carrying the Spark's menu");
});

test("Aaron's menu rule: Talk stands in the menu, first among the fixed actions, and hosts the seat in place", () => {
  const presence = read("docs/assets/js/spark-presence.js");
  const talkAt = presence.indexOf('bubbleBtn("Talk", "?", doTalk, "spark-panel-talk-btn")');
  const playAt = presence.indexOf('bubbleBtn("Play", "▶", doPlay)');
  assert.ok(talkAt > 0, "the menu holds a Talk action");
  assert.ok(playAt > talkAt, "Talk stands before Play in the menu's order");
  assert.ok(presence.includes("function doTalk()"), "the Talk state exists");
  assert.ok(presence.includes("seat.openTalkIn(mount)"), "the Talk state hosts the seat's own surface in the panel");
  assert.ok(presence.includes("My talk seat is still waking on this page"), "a not-yet-woken seat is answered honestly, never faked");
});

test("the seat's lazy-loaded layers register without a bare root reference (the talk path stays error-free)", () => {
  // spark-voice.js and spark-tips.js are invoked as factory() with no
  // argument; a bare `root.` inside either factory throws a
  // ReferenceError the moment the seat lazy-loads them — which the
  // in-menu talk path does on its first opening. Found by the
  // menu proof's rendered run, Nov 25, 2026; pre-existing on main.
  for (const file of ["docs/assets/js/spark-voice.js", "docs/assets/js/spark-tips.js"]) {
    const src = read(file);
    assert.ok(!src.includes("root.SparkAgentSeat"), file + " must not reach the seat through a bare root");
    assert.ok(src.includes("globalThis.SparkAgentSeat"), file + " reaches the seat through globalThis");
  }
});

test("the seat exposes hosting its conversation in a caller's container, and steps aside when the menu is present", () => {
  const seat = loadSeat();
  assert.equal(typeof seat.openTalkIn, "function", "SparkAgentSeat.openTalkIn is public");
  assert.equal(seat.openTalkIn(null), false, "no container, no hosting — answered honestly");
  assert.equal(seat.openTalkIn({ appendChild() {} }), false, "no seat built on the page, no hosting — answered honestly");
  const css = read("docs/assets/css/spark-agent-seat.css");
  assert.ok(css.includes("body.spark-menu-present .spark-seat"), "the corner furniture steps aside where the Spark's menu stands");
  assert.ok(css.includes(".spark-panel-talk .spark-seat-panel"), "the hosted conversation sits flush inside the menu");
});
