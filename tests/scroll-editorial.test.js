"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const archivePath = path.join(root, "archive/Full_Scroll_Unsealed/1.0.0/Full_Scroll_Unsealed");
const archive = fs.readFileSync(archivePath);
const source = archive.toString("utf8").split(/\r\n|\n|\r/);
if (/(?:\r\n|\n|\r)$/.test(archive.toString("utf8"))) source.pop();
const hash = crypto.createHash("sha256").update(archive).digest("hex");
const edition = JSON.parse(fs.readFileSync(path.join(root, "docs/scroll/data/editorial-edition.json"), "utf8"));
const register = JSON.parse(fs.readFileSync(path.join(root, "docs/scroll/evidence/claim-register.json"), "utf8"));
const builder = fs.readFileSync(path.join(root, "scripts/build-scroll-editorial.mjs"), "utf8");
const page = fs.readFileSync(path.join(root, "docs/scroll/editorial.html"), "utf8");
const reader = fs.readFileSync(path.join(root, "docs/scroll/reader.html"), "utf8");
const homepage = fs.readFileSync(path.join(root, "docs/scroll/index.html"), "utf8");
const editorialScript = fs.readFileSync(path.join(root, "docs/scroll/assets/editorial.js"), "utf8");
const editorialNavigation = require("../docs/scroll/assets/editorial-navigation.js");
const library = JSON.parse(fs.readFileSync(path.join(root, "docs/scroll/data/library.json"), "utf8"));
const readerSegments = JSON.parse(fs.readFileSync(path.join(root, "docs/scroll/data/reader-segments.json"), "utf8"));
const claimSeed = JSON.parse(fs.readFileSync(path.join(root, "scripts/scroll-editorial-claims.json"), "utf8"));
const editorialText = edition.sections.map(section =>
  `${section.heading}\n${(section.paragraphs ?? [section.text]).join("\n")}`
).join("\n");

test("the separate editorial edition is pinned to the unchanged frozen manuscript", () => {
  assert.equal(hash, "81a015fb937f1664c2383fa38fddf956d281c6309a9584382c6dbc9d8b691400");
  assert.equal(edition.sourceSha256, hash);
  assert.equal(register.sourceSha256, hash);
  assert.equal(edition.sourceCommit, register.sourceCommit);
  assert.equal(fs.readFileSync(archivePath).length, 610424);
});

test("both repeated political sequences and both evidence archive occurrences remain linked", () => {
  assert.deepEqual(edition.originalOccurrences.map(item => [item.lineStart, item.lineEnd]), [
    [596, 740], [3265, 3437], [793, 938], [3505, 3653]
  ]);
  assert.match(edition.editorialNote, /links all complete political and evidence-archive occurrences/);
  for (const occurrence of edition.originalOccurrences) {
    assert.ok(source.slice(occurrence.lineStart - 1, occurrence.lineEnd).length > 0);
  }
});

test("the reading edition removes leader-as-savior language but retains spiritual and institutional critique", () => {
  assert.doesNotMatch(editorialText, /Trump Was the First Firewall|Trump was a battering ram|first one bold enough/i);
  assert.match(editorialText, /censorship, surveillance, political influence/i);
  assert.match(editorialText, /The spiritual reading remains the author’s/);
  assert.match(editorialText, /Ephesians 6:12/);
  assert.ok(edition.sections.some(section => section.classification === "author interpretation"));
});

test("the canonical political reading is substantive and inventories archive-only topics", () => {
  const wordCount = editorialText.trim().split(/\s+/).length;
  assert.ok(wordCount >= 2800, `expected at least 2,800 editorial words, found ${wordCount}`);
  assert.ok(edition.coverageInventory.addressedTopics.length >= 10);
  assert.ok(edition.coverageInventory.archiveOnlyTopics.length >= 4);
  for (const topic of edition.coverageInventory.addressedTopics) {
    assert.ok(edition.sections.some(section => section.id === topic.sectionId), topic.topic);
    for (const line of topic.sourceLines) assert.ok(source[line - 1]?.trim(), `${topic.topic} line ${line}`);
  }
  for (const topic of edition.coverageInventory.archiveOnlyTopics) {
    assert.ok(topic.lineStart > 0 && topic.lineEnd >= topic.lineStart);
    assert.ok(source.slice(topic.lineStart - 1, topic.lineEnd).some(line => line.trim()), topic.topic);
  }
  assert.match(edition.coverageInventory.archiveOnlyNote, /remain available/i);
});

test("every editorial claim link resolves and every claim has an explicit route", () => {
  const claimIds = new Set(register.claims.map(claim => claim.id));
  const referenced = new Set();
  for (const section of edition.sections) {
    for (const id of section.claimIds ?? []) {
      assert.ok(claimIds.has(id), `${section.id} references missing ${id}`);
      referenced.add(id);
    }
  }
  for (const claim of register.claims) {
    assert.ok(referenced.has(claim.id) || claim.standaloneStatus, `${claim.id} has no editorial entry or standalone status`);
  }
  assert.equal(referenced.size, register.claims.length);
  assert.ok(!editorialText.includes("FIN-OBAMA-001"));
  assert.ok(!editorialText.includes("SURV-001"));
  assert.ok(edition.sections.find(section => section.id === "targeted-killing").claimIds.includes("SURV-OBAMA-001"));
});

test("claim anchor navigation expands evidence records on initial load and hash changes", () => {
  assert.match(editorialScript, /window\.addEventListener\("hashchange", revealClaimFromHash\)/);
  const record = {
    open: false,
    matches: selector => selector === "details.evidence-record",
    scrollIntoView: () => { record.scrolled = true; },
    querySelector: selector => selector === "summary" ? { focus: () => { record.focused = true; } } : null
  };
  const location = { hash: "#QAT-001" };
  const document = { getElementById: id => id === "QAT-001" || id === "FIN-BIDEN-001" ? record : null };
  const window = { requestAnimationFrame: callback => callback() };
  assert.equal(editorialNavigation.revealClaimFromHash(location, document, window), true);
  assert.equal(record.open, true, "direct-link load opens the claim");
  assert.equal(record.scrolled, true);
  assert.equal(record.focused, true);
  record.open = false;
  record.scrolled = false;
  record.focused = false;
  location.hash = "#FIN-BIDEN-001";
  assert.equal(editorialNavigation.revealClaimFromHash(location, document, window), true);
  assert.equal(record.open, true, "in-page hash changes open the new claim");
  assert.equal(record.scrolled, true);
  assert.equal(record.focused, true);
});

test("every editorial section links to nonblank original manuscript lines", () => {
  for (const section of edition.sections) {
    assert.ok(section.sourceLines.length, `${section.id} has original source lines`);
    for (const line of section.sourceLines) {
      assert.ok(Number.isInteger(line) && line > 0 && source[line - 1]?.trim(), `${section.id} line ${line}`);
    }
  }
});

test("each claim quotes exact original lines and points to the pinned source", () => {
  assert.equal(register.claims.length, 21);
  const ids = new Set();
  for (const claim of register.claims) {
    assert.ok(!ids.has(claim.id), `duplicate claim id ${claim.id}`);
    ids.add(claim.id);
    assert.ok(claim.originalStatements.length > 0, `${claim.id} has original text`);
    for (const statement of claim.originalStatements) {
      const expected = statement.text.split("\n");
      for (const line of expected) assert.ok(source.slice(statement.lineStart - 1, statement.lineEnd).includes(line), `${claim.id}: original quote must match source`);
      assert.match(statement.sourceUrl, new RegExp(register.sourceCommit));
      assert.match(statement.sourceUrl, new RegExp(`#L${statement.lineStart}$`));
    }
  }
});

test("claim records distinguish source scope, contradiction, and editorial change", () => {
  const required = ["establishes", "unverified", "contradictoryEvidence", "editorialChange"];
  for (const claim of register.claims) {
    for (const key of required) assert.ok(claim[key].trim().length > 10, `${claim.id}.${key}`);
    for (const source of claim.sources) {
      assert.match(source.date, /^\d{4}-\d{2}(-\d{2})?$/);
      assert.match(source.url, /^https:\/\//);
      assert.ok(source.title && source.publisher && source.establishes && source.limits, claim.id);
    }
  }
  assert.ok(register.claims.some(claim => claim.status === "needs-verification" && claim.sources.length === 0));
  assert.ok(register.claims.some(claim => claim.sources.length > 0));
});

test("all claims have explicit evidence and source-access statuses", () => {
  const evidenceStatuses = new Set(Object.keys(claimSeed.evidenceStatusGuide));
  const sourceStatuses = new Set(Object.keys(claimSeed.sourceReviewStatusGuide));
  for (const claim of register.claims) {
    assert.ok(evidenceStatuses.has(claim.evidenceStatus), `${claim.id} evidence status`);
    assert.ok(sourceStatuses.has(claim.sourceReviewStatus), `${claim.id} source status`);
    assert.ok(claim.evidenceStatusDescription.length > 20);
    assert.ok(claim.sourceReviewStatusDescription.length > 20);
    if (claim.sources.length) {
      assert.equal(claim.sourceReviewStatus, "cited-not-independently-inspected", claim.id);
      for (const source of claim.sources) {
        assert.equal(source.inspectionStatus, "not-independently-inspected-in-this-session");
      }
    } else {
      assert.notEqual(claim.sourceReviewStatus, "cited-not-independently-inspected", claim.id);
    }
  }
  assert.ok(register.claims.some(claim => claim.evidenceStatus === "documented-event-with-cited-record"));
  assert.ok(register.claims.some(claim => claim.evidenceStatus === "documented-allegation-or-testimony"));
  assert.ok(register.claims.some(claim => claim.evidenceStatus === "disputed-interpretation"));
  assert.ok(register.claims.some(claim => claim.evidenceStatus === "author-hypothesis-or-prophetic-interpretation"));
  assert.ok(register.claims.some(claim => claim.evidenceStatus === "unverified-claim-requiring-additional-evidence"));
  assert.ok(register.claims.some(claim => claim.sourceReviewStatus === "unavailable-awaiting-inspection"));
  assert.match(editorialScript, /claim\.sources\.length\s*\?\s*"What the cited records are listed to support"\s*:\s*"Current record status \(no source citation attached\)"/);
});

test("Qatar acceptance is documented and separated from use and disposition", () => {
  const qat = register.claims.find(claim => claim.id === "QAT-001");
  assert.equal(qat.evidenceStatus, "documented-event-with-cited-record");
  assert.doesNotMatch(qat.statusLabel, /unverified|pending/i);
  assert.equal(qat.sources.length, 2);
  assert.deepEqual(qat.sources.map(source => [source.publisher, source.date]), [
    ["PBS NewsHour", "2025-05-21"],
    ["Defense News", "2025-05-21"]
  ]);
  assert.match(qat.establishes, /Sean Parnell confirmed.*accepted/i);
  assert.match(qat.unverified, /personally flew.*disposition.*legal/i);
  assert.match(qat.editorialChange, /Corrected the false categorical denial/i);
});

test("all 50 Genesis chapter sections remain content-bearing in the reader data", () => {
  const chapters = library.sections.filter(section => section.type === "genesis-chapter");
  const chapterNumbers = [...new Set(chapters.map(section => section.genesisChapter))].sort((a, b) => a - b);
  assert.equal(chapterNumbers.length, 50);
  assert.deepEqual(chapterNumbers,
    Array.from({ length: 50 }, (_, index) => index + 1));
  for (const chapter of chapters) {
    const body = readerSegments.segments.filter(segment =>
      segment.genesisChapter === chapter.genesisChapter && segment.kind === "text" && segment.text.trim());
    assert.ok(body.length, `Genesis ${chapter.genesisChapter} has readable body text`);
    assert.ok(chapter.readerTargetId, `Genesis ${chapter.genesisChapter} has a resolved reader target`);
    assert.ok(chapter.originalUrl.includes(`#L${chapter.lineStart}`));
  }
});

test("source statements include both copies where the source claim appears in both political sequences", () => {
  for (const id of ["QAT-001", "FSA-001", "INS-001", "LAPTOP-001", "CHAR-001", "DISINFECTANT-001"]) {
    const claim = register.claims.find(item => item.id === id);
    assert.ok(claim, id);
    const occurrences = new Set(claim.originalStatements.map(statement => statement.occurrence));
    assert.ok(occurrences.has("Political sequence 1"), `${id} first political occurrence`);
    assert.ok(occurrences.has("Political sequence 2"), `${id} second political occurrence`);
  }
  const fisa = register.claims.find(item => item.id === "FISA-001");
  assert.ok(fisa.originalStatements.some(statement => statement.occurrence === "Evidence archive 1"));
  assert.ok(fisa.originalStatements.some(statement => statement.occurrence === "Evidence archive 2"));
});

test("editorial route, evidence register, and change log are discoverable", () => {
  const changelog = fs.readFileSync(path.join(root, "EDITORIAL_CHANGELOG.md"), "utf8");
  assert.match(page, /editorial\.js/);
  assert.match(page, /EVIDENCE_REGISTER\.md/);
  assert.match(homepage, /editorial\.html/);
  assert.match(reader, /editorial\.html/);
  assert.ok(fs.existsSync(path.join(root, "EVIDENCE_REGISTER.md")));
  assert.ok(fs.existsSync(path.join(root, "EDITORIAL_CHANGELOG.md")));
  assert.ok(fs.readFileSync(path.join(root, "docs/sitemap.xml"), "utf8").includes("/scroll/editorial.html"));
  assert.match(changelog, /### Before and after/);
  assert.match(changelog, /Pentagon spokesman Sean Parnell on May 21, 2025/);
});

test("editorial artifacts are reproducible and source parser does not modify the archive", () => {
  const output = execFileSync(process.execPath, [path.join(root, "scripts/build-scroll-editorial.mjs"), "--check"], {
    cwd: root,
    encoding: "utf8"
  });
  assert.match(output, /reproduce byte-for-byte/);
  assert.equal(crypto.createHash("sha256").update(fs.readFileSync(archivePath)).digest("hex"), hash);
});
