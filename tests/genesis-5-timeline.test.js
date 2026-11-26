/*
 * Walking the Long Line — Genesis 5 timeline.
 *
 * The proof that matters for a page built out of numbers: every name
 * and figure on the page equals the chapter's own figures, read out
 * of the site's Genesis 5 chapter data (WEB English, Masoretic
 * numbers) by parsing the number-words in the verse text itself —
 * not by trusting a second hand-typed table. The page's JS data and
 * its printed table are both checked against that extraction.
 * Also pinned: the count sums, Enoch's 365, the finding questions'
 * targets, and the three readings standing under separate labels
 * with the page taking no side.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/scripture/data/chapters/Gen-05.json"), "utf8"));
const pageJs = fs.readFileSync(path.join(ROOT, "docs/assets/js/genesis-5-timeline.js"), "utf8");
const pageHtml = fs.readFileSync(path.join(ROOT, "docs/genesis-5-timeline.html"), "utf8");

/* ---------- number-words -> integers ---------- */
const ONES = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
function parseNumberWords(text) {
  let total = 0, current = 0;
  for (const w of text.toLowerCase().split(/[\s-]+/).filter(Boolean)) {
    if (ONES[w] !== undefined) current += ONES[w];
    else if (TENS[w] !== undefined) current += TENS[w];
    else if (w === "hundred") { current = (current || 1) * 100; }
    else if (w === "thousand") { total += (current || 1) * 1000; current = 0; }
    else if (w === "and") continue;
    else return NaN;
  }
  return total + current;
}
const NUM = "([a-z]+(?:[ -][a-z]+)*?)";
function grab(verseText, regex) {
  const m = verseText.match(regex);
  assert.ok(m, `pattern ${regex} found in: ${verseText}`);
  const n = parseNumberWords(m[1]);
  assert.ok(Number.isFinite(n), `number-words parsed from "${m[1]}"`);
  return n;
}

/* ---------- the chapter's figures, extracted from its own text ---------- */
const verse = (n) => chapter.verses.find((v) => v.n === n).en;
/* name, begetting verse, after verse, total verse */
const CHAPTER_PLAN = [
  ["Adam", 3, 4, 5], ["Seth", 6, 7, 8], ["Enosh", 9, 10, 11],
  ["Kenan", 12, 13, 14], ["Mahalalel", 15, 16, 17], ["Jared", 18, 19, 20],
  ["Enoch", 21, 22, 23], ["Methuselah", 25, 26, 27], ["Lamech", 28, 30, 31],
  ["Noah", 32, null, null]
];
function chapterFigures() {
  return CHAPTER_PLAN.map(([name, bv, av, tv]) => {
    const at = name === "Noah"
      ? grab(verse(bv), new RegExp(`was ${NUM} years old`))
      : grab(verse(bv), new RegExp(`lived ${NUM} years`));
    let after = null, total = null;
    if (av !== null) {
      after = name === "Enoch"
        ? grab(verse(av), new RegExp(`walked with God for ${NUM} years`))
        : grab(verse(av), new RegExp(`after he became the father of \\w+ (?:were )?${NUM} years`));
    }
    if (tv !== null) total = grab(verse(tv), new RegExp(`were ${NUM} years`));
    return { name, at, after, total };
  });
}

/* ---------- the page's data, read out of its own script ---------- */
function pageLine() {
  const m = pageJs.match(/const LINE = (\[[\s\S]*?\n  \]);/);
  assert.ok(m, "LINE data block found in the page script");
  return new Function(`return ${m[1]};`)();
}

test("every figure on the page equals the chapter's figures", () => {
  const chapterData = chapterFigures();
  const line = pageLine();
  assert.equal(line.length, 10, "ten stations on the line");
  chapterData.forEach((c, i) => {
    const s = line[i];
    assert.equal(s.name, c.name, `station ${i} is ${c.name}`);
    assert.equal(s.at, c.at, `${c.name}: age at the child's birth`);
    assert.equal(s.after, c.after, `${c.name}: years after`);
    assert.equal(s.total, c.total, `${c.name}: total years`);
    if (c.total !== null) assert.equal(s.at + s.after, s.total, `${c.name}: at + after = total`);
  });
});

test("the printed table on the page carries the same figures", () => {
  const line = pageLine();
  const rows = [...pageHtml.matchAll(/<tr><th scope="row">(\w+)<\/th><td>([\d,]+)<\/td><td>(\d+)<\/td><td>([\d—]+)<\/td><td>([\d,]+|the chapter leaves his count open)<\/td><\/tr>/g)];
  assert.equal(rows.length, 10, "ten rows in the printed table");
  rows.forEach((r, i) => {
    const s = line[i];
    const num = (x) => parseInt(x.replace(/,/g, ""), 10);
    assert.equal(r[1], s.name);
    /* born recomputed from the count, not copied */
    const born = line.slice(0, i).reduce((t, p) => t + p.at, 0);
    assert.equal(num(r[2]), born, `${s.name}: born year in the table`);
    assert.equal(num(r[3]), s.at, `${s.name}: begetting age in the table`);
    if (s.total === null) {
      assert.equal(r[4], "—");
      assert.match(r[5], /leaves his count open/);
    } else {
      assert.equal(num(r[4]), s.after, `${s.name}: years after in the table`);
      assert.equal(num(r[5]), s.total, `${s.name}: total in the table`);
    }
  });
});

test("the running count sums correctly and lands where the walk says", () => {
  const line = pageLine();
  const expectedBorn = [0, 130, 235, 325, 395, 460, 622, 687, 874, 1056];
  let t = 0;
  line.forEach((s, i) => {
    assert.equal(t, expectedBorn[i], `${s.name} is born at year ${expectedBorn[i]} of the count`);
    t += s.at;
  });
  assert.equal(t, 1556, "the full count of the chapter: 1,556 years from Adam to Noah's sons");
});

test("Enoch's 365 lands on Enoch, and the findings aim where the data points", () => {
  const line = pageLine();
  const enoch = line.find((s) => s.name === "Enoch");
  assert.equal(enoch.total, 365, "Enoch's days are 365 — the count of a year");
  const longest = line.reduce((a, b) => (b.total !== null && (a === null || b.total > a.total) ? b : a), null);
  assert.equal(longest.name, "Methuselah", "the longest life is Methuselah's 969");
  /* the shrinking: the first station after the peak whose total steps
   * below every non-Enoch total that came before the peak */
  const peakIdx = line.indexOf(longest);
  const floorBefore = Math.min(...line.slice(0, peakIdx).filter((s) => s.total !== null && s.name !== "Enoch").map((s) => s.total));
  const shrink = line.slice(peakIdx + 1).find((s) => s.total !== null && s.total < floorBefore);
  assert.equal(shrink.name, "Lamech", "the first wide step down after the peak is Lamech's 777");

  const qm = pageJs.match(/const QUESTIONS = (\[[\s\S]*?\n  \]);/);
  assert.ok(qm, "QUESTIONS block found");
  const questions = new Function(`return ${qm[1]};`)();
  const byId = Object.fromEntries(questions.map((q) => [q.id, q.target]));
  assert.equal(byId.longest, "Methuselah");
  assert.equal(byId.yearmatch, "Enoch");
  assert.equal(byId.shrinking, "Lamech");
});

test("the three readings stand under separate labels and the page takes no side", () => {
  for (const label of ["Coincidence", "Literary symbolism", "Calendrical practice"]) {
    assert.ok(pageHtml.includes(label), `reading present: ${label}`);
  }
  assert.match(pageHtml, /This page takes no side/);
  assert.match(pageHtml, /Septuagint/, "the other witnesses are noted, labelled");
  assert.match(pageHtml, /does not blend them/);
  for (const side of ["the true reading is", "proves the calendar", "the answer is coincidence"]) {
    assert.ok(!pageHtml.toLowerCase().includes(side), `the page does not take a side: "${side}"`);
  }
});
