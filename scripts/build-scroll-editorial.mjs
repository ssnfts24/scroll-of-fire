import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const editionPath = path.join(root, "docs/scroll/data/editorial-edition.json");
const seedPath = path.join(root, "scripts/scroll-editorial-claims.json");
const archivePath = path.join(root, "archive/Full_Scroll_Unsealed/1.0.0/Full_Scroll_Unsealed");
const edition = JSON.parse(fs.readFileSync(editionPath, "utf8"));
const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
const claimIds = new Set(seed.claims.map(claim => claim.id));
const referencedClaimIds = new Set();
for (const section of edition.sections) {
  for (const id of section.claimIds ?? []) {
    if (!claimIds.has(id)) throw new Error(`${section.id}: unknown editorial claim ID ${id}.`);
    referencedClaimIds.add(id);
  }
}
for (const claim of seed.claims) {
  if (!referencedClaimIds.has(claim.id) && !claim.standaloneStatus) {
    throw new Error(`${claim.id}: claim is not linked from an editorial section or marked standalone.`);
  }
}
const statusCategories = new Set(Object.keys(seed.evidenceStatusGuide));
const sourceReviewCategories = new Set(Object.keys(seed.sourceReviewStatusGuide));
for (const claim of seed.claims) {
  if (!statusCategories.has(seed.evidenceStatuses[claim.id])) {
    throw new Error(`${claim.id}: missing or invalid evidence status.`);
  }
  if (!sourceReviewCategories.has(seed.sourceReviewStatuses[claim.id])) {
    throw new Error(`${claim.id}: missing or invalid source review status.`);
  }
}
for (const id of Object.keys(seed.evidenceStatuses)) {
  if (!claimIds.has(id)) throw new Error(`Evidence status refers to unknown claim ${id}.`);
}
for (const id of Object.keys(seed.sourceReviewStatuses)) {
  if (!claimIds.has(id)) throw new Error(`Source review status refers to unknown claim ${id}.`);
}
if (Object.keys(seed.evidenceStatuses).length !== claimIds.size ||
    Object.keys(seed.sourceReviewStatuses).length !== claimIds.size) {
  throw new Error("Every claim must have exactly one evidence status and source review status.");
}
const bytes = fs.readFileSync(archivePath);
const sourceHash = crypto.createHash("sha256").update(bytes).digest("hex");
if (sourceHash !== edition.sourceSha256 || sourceHash !== seed.sourceSha256) {
  throw new Error("Editorial build refused: the frozen manuscript hash does not match.");
}
const source = bytes.toString("utf8").split(/\r\n|\n|\r/);
if (/(?:\r\n|\n|\r)$/.test(bytes.toString("utf8"))) source.pop();
const sourceUrl = line =>
  `https://github.com/ssnfts24/scroll-of-fire/blob/${edition.sourceCommit}/Full_Scroll_Unsealed#L${line}`;
const generated = path.join(root, "docs/scroll/evidence/claim-register.json");
const publishedMarkdown = path.join(root, "docs/scroll/evidence/register.md");
const markdown = path.join(root, "EVIDENCE_REGISTER.md");
const changeLog = path.join(root, "EDITORIAL_CHANGELOG.md");

const claims = seed.claims.map(claim => ({
  ...claim,
  evidenceStatus: seed.evidenceStatuses[claim.id],
  evidenceStatusDescription: seed.evidenceStatusGuide[seed.evidenceStatuses[claim.id]],
  sourceReviewStatus: seed.sourceReviewStatuses[claim.id],
  sourceReviewStatusDescription: seed.sourceReviewStatusGuide[seed.sourceReviewStatuses[claim.id]],
  sources: claim.sources.map(source => ({
    ...source,
    inspectionStatus: "not-independently-inspected-in-this-session"
  })),
  originalStatements: claim.originalStatements.map(statement => {
    const lines = statement.lines;
    if (!lines.length || lines.some(line => !Number.isInteger(line) || line < 1 || line > source.length)) {
      throw new Error(`${claim.id}: original statement has an invalid source line.`);
    }
    return {
      occurrence: statement.occurrence,
      lineStart: Math.min(...lines),
      lineEnd: Math.max(...lines),
      text: lines.map(line => source[line - 1]).join("\n"),
      sourceUrl: sourceUrl(Math.min(...lines))
    };
  })
}));

const register = {
  schemaVersion: 1,
  edition: edition.edition,
  sourceCommit: edition.sourceCommit,
  sourceSha256: sourceHash,
  sourceLiveVerification: "External hosts were unreachable during preparation; citation URLs are recorded but were not live-checked in this session.",
  evidenceStatusGuide: seed.evidenceStatusGuide,
  sourceReviewStatusGuide: seed.sourceReviewStatusGuide,
  generatedBy: "scripts/build-scroll-editorial.mjs",
  claims
};
const jsonText = `${JSON.stringify(register, null, 2)}\n`;
const rows = claims.map(claim => {
  const statements = claim.originalStatements.map(statement =>
    `- **${statement.occurrence}, lines ${statement.lineStart}–${statement.lineEnd}:** ${statement.text.replace(/\n/g, " ")} ([original](${statement.sourceUrl}))`
  ).join("\n");
  const sources = claim.sources.length
    ? claim.sources.map(source =>
      `- [${source.title}](${source.url}) — ${source.publisher}, ${source.date}. ${source.sourceType ? `${source.sourceType}. ` : ""}${source.establishes} **Limit:** ${source.limits} **Inspection:** ${source.inspectionStatus}.`
    ).join("\n")
    : `- ${claim.sourceReviewStatusDescription}`;
  const summaryHeading = claim.sources.length
    ? "What the cited records are listed to support"
    : "Current record status (no source citation attached)";
  return `### ${claim.id} — ${claim.title}\n\n**Evidence status:** ${claim.evidenceStatus} — ${claim.evidenceStatusDescription}\n\n**Source review:** ${claim.sourceReviewStatus} — ${claim.sourceReviewStatusDescription}\n\n**Status:** ${claim.statusLabel} · **Classification:** ${claim.classification} · **Priority:** ${claim.priority}\n\n**Exact original statements**\n${statements}\n\n**${summaryHeading}:** ${claim.establishes}\n\n**Disputed or unverified:** ${claim.unverified}\n\n**Contradictory or qualifying evidence:** ${claim.contradictoryEvidence}\n\n**Sources**\n${sources}\n\n**Editorial change:** ${claim.editorialChange}`;
});
const inventoryRows = [
  ...edition.coverageInventory.addressedTopics.map(item => `- **Addressed:** ${item.topic} — [reading chapter](https://codexofreality.org/scroll/editorial.html#${item.sectionId}); original source lines ${item.sourceLines.map(line => `[${line}](${sourceUrl(line)})`).join(", ")}.`),
  ...edition.coverageInventory.archiveOnlyTopics.map(item => `- **Archive-only in this pass:** ${item.topic} — [original lines ${item.lineStart}–${item.lineEnd}](${sourceUrl(item.lineStart)}).`)
].join("\n");
const comparisons = [
  { line: 603, after: "The reading corrects this categorical denial: contemporaneous reports say the Pentagon confirmed acceptance, while actual operations, personal use, final disposition, and legal questions remain separate." },
  { line: 620, after: "The reading distinguishes the Trump-era voluntary Part D model from the $35 statutory Medicare cap enacted in 2022." },
  { line: 673, after: "The reading removes the unique-firewall endorsement while retaining criticism of censorship, surveillance, political influence, and institutional secrecy." },
  { line: 800, after: "The reading presents the DOJ Inspector General's documented FISA application errors and the separate limits on what those findings establish." }
].map(item => `- **Before, original line ${item.line}:** “${source[item.line - 1]}” ([source](${sourceUrl(item.line)})). **After:** ${item.after}`).join("\n");
const registerMarkdown = `# Scroll of Fire — Evidence Register\n\nThis register accompanies the separate reading edition. It is not a verdict on the manuscript or its spiritual interpretation. Entries quote exact archived wording and point to commit-pinned source lines. Each claim separates evidence status from source-access status; a recorded allegation is not thereby proven, and a forecast or theological interpretation is not a factual finding.\n\n**Source-access limitation:** External hosts were unreachable during preparation, so citation pages were not independently inspected in this session. Citations identify records for reviewer inspection; they do not claim independent verification. Source review status is explicit for every entry.\n\n**Frozen source:** [Full Scroll Unsealed, edition 1.0.0](https://github.com/ssnfts24/scroll-of-fire/blob/${edition.sourceCommit}/Full_Scroll_Unsealed) · SHA-256 \`${sourceHash}\`. The original bytes, paragraph map, reader segment map, search artifacts, lexicon, atlas, service worker, and protected Observatory are outside this editorial build.\n\n## Editorial coverage inventory\n\n${inventoryRows}\n\n${edition.coverageInventory.archiveOnlyNote}\n\n${rows.join("\n\n---\n\n")}\n\n## Claims requiring further investigation\n\nSee evidence and source-review statuses above. The archive-only inventory is not a verification of those claims.\n`;
const changeLogText = `# Editorial Change Log\n\n## Reading edition 1.2.0\n\nThe frozen edition 1.0.0 is unchanged. The canonical political reading is expanded to more than 3,000 words and links both repeated political sequences and both evidence-archive occurrences. It develops the original investigations into foreign gifts, financial conflicts, FISA, speech moderation, election administration, pandemic policy, and digital systems while retaining the author’s spiritual voice and applying scrutiny across parties. A coverage inventory distinguishes topics treated in the reading edition from claims left accessible only in the archive.\n\nThe Qatar aircraft entry now records federal acceptance as reported by Pentagon spokesman Sean Parnell on May 21, 2025, citing the two supplied PBS NewsHour and Defense News reports. Acceptance is separated from aircraft operation, Donald Trump’s personal use, final disposition, and unresolved legal, ethics, security, and cost questions. Those pages could not be retrieved from this environment and are explicitly marked not independently inspected.\n\nEvery claim now has an evidence category and a separate source-review status. Citation-backed summaries do not claim independent verification where sources were unavailable; uncited claims use a different section heading rather than implying evidence is attached. Invalid claim IDs were corrected, every claim links to an editorial section, and claim anchors expand, focus, and reveal their record on initial page load and in-page navigation.\n\n### Before and after\n\n${comparisons}\n\nClaim-by-claim quotations and comparisons are also recorded in [EVIDENCE_REGISTER.md](EVIDENCE_REGISTER.md) and [the machine-readable register](docs/scroll/evidence/claim-register.json). The original bytes, reader and search data, Hebrew lexicon, atlas, service worker, and protected Observatory remain unchanged.\n`;

const outputs = [[generated, jsonText], [publishedMarkdown, registerMarkdown], [markdown, registerMarkdown], [changeLog, changeLogText]];
if (process.argv.includes("--check")) {
  const drift = outputs.filter(([file, text]) => !fs.existsSync(file) || fs.readFileSync(file, "utf8") !== text);
  if (drift.length) throw new Error(`Editorial artifacts are stale: ${drift.map(([file]) => path.relative(root, file)).join(", ")}`);
  console.log("Editorial register and documentation reproduce byte-for-byte.");
} else {
  fs.mkdirSync(path.dirname(generated), { recursive: true });
  for (const [file, text] of outputs) fs.writeFileSync(file, text);
  console.log(`Built editorial register: ${claims.length} claims; source SHA-256 ${sourceHash}.`);
}
