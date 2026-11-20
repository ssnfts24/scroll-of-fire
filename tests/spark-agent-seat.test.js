const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const repoRoot = path.resolve(__dirname, "..");
const docsRoot = path.join(repoRoot, "docs");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function loadSeat() {
  const context = vm.createContext({ console, module: { exports: {} }, exports: {} });
  context.globalThis = context;
  vm.runInContext(read("docs/assets/js/spark-agent-seat.js"), context, { filename: "spark-agent-seat.js" });
  return context.module.exports;
}

const CTX = {
  spark: { name: "Selor", kindName: "Water", stageName: "Kindled" },
  daysTogether: 12,
  today: { moon: 8, moonDay: 22, patternDay: 218, moonName: "Deep Mirror", civilDate: "2026-11-20" },
  page: {
    title: "The Pattern Garden",
    subject: "Thirteen beds, one for every Moon.",
    chapterTitle: "The Garden of Thirteen Beds",
    path: "/garden.html"
  },
  chaptersFound: 3,
  chaptersTotal: null
};

test("the local brain answers place-aware questions from the page the keeper stands on", () => {
  const seat = loadSeat();
  const where = seat.answerLocally("Where am I?", CTX);
  assert.ok(where.includes("The Pattern Garden"), "the answer names the page");
  assert.ok(where.includes("The Garden of Thirteen Beds"), "the answer knows the page's story chapter");
  const today = seat.answerLocally("What day is it?", CTX);
  assert.ok(today.includes("Pattern Day 218") && today.includes("Moon 8"), "today is answered from the canonical stamp");
  const who = seat.answerLocally("Who are you?", CTX);
  assert.ok(who.includes("Selor") && who.includes("Water"), "the Spark answers for itself, by name and kind");
  assert.ok(!/\bshe\b|\bher\b/.test(who), "a Spark is never 'she'");
  const days = seat.answerLocally("How long have we been together?", CTX);
  assert.ok(days.includes("12 distinct days"), "days together come from the record");
  const story = seat.answerLocally("How is the story going?", CTX);
  assert.ok(story.includes("found 3 chapters"), "story progress comes from the trail");
});

test("the local brain declines what it cannot know — the door's work, never a guess", () => {
  const seat = loadSeat();
  assert.equal(seat.answerLocally("What does the Frequency Governance entry say about tone?", CTX), null);
  assert.equal(seat.answerLocally("", CTX), null);
  const noToday = seat.answerLocally("What day is it?", { ...CTX, today: null });
  assert.equal(noToday, null, "without the calendar there is no invented date");
});

test("the seat is stamped site-wide by the presence script, and the Sphere keeps its own seat", () => {
  const script = read("scripts/apply-spark-presence.mjs");
  assert.ok(script.includes("spark-agent-seat.js") && script.includes("spark-agent-seat.css"),
    "the apply script stamps the seat with the presence");

  const seat = read("docs/assets/js/spark-agent-seat.js");
  assert.ok(seat.includes("/.netlify/functions/spark-agent"), "the seat uses the same door as the Sphere's seat");
  assert.ok(seat.includes("sparkUsd") && seat.includes("guideUsd"), "the meter line is the seat's own, under the shared ceiling");
  assert.ok(seat.includes("The talking door is not reachable"), "fail-closed: the door's absence is said plainly");
  assert.ok(!seat.includes("codex-guide"), "the Guide's seat is a different seat, untouched");

  let stamped = 0;
  (function walk(dir, prefix) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!prefix && ["scroll", "scripture", "assets"].includes(entry.name)) continue;
        walk(path.join(dir, entry.name), rel);
      } else if (entry.name.endsWith(".html")) {
        const html = fs.readFileSync(path.join(dir, entry.name), "utf8");
        if (html.includes("spark-agent-seat.js")) stamped++;
      }
    }
  })(docsRoot, "");
  assert.ok(stamped >= 70, `the seat is stamped across the site (found ${stamped})`);

  const sphere = fs.readFileSync(path.join(docsRoot, "living-time-sphere.html"), "utf8");
  assert.ok(!sphere.includes("spark-agent-seat.js"), "the Sphere page keeps its own seat (sphere-spark.js), not the site-wide one");
});
