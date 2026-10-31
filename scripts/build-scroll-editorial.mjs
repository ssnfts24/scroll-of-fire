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
      `- [${source.title}](${source.url}) — ${source.publisher}, ${source.date}. ${source.establishes} **Limit:** ${source.limits}`
    ).join("\n")
    : "- No source is recorded; verification is pending.";
  return `### ${claim.id} — ${claim.title}\n\n**Status:** ${claim.statusLabel} · **Classification:** ${claim.classification} · **Priority:** ${claim.priority}\n\n**Exact original statements**\n${statements}\n\n**What the evidence establishes:** ${claim.establishes}\n\n**Disputed or unverified:** ${claim.unverified}\n\n**Contradictory or qualifying evidence:** ${claim.contradictoryEvidence}\n\n**Sources**\n${sources}\n\n**Editorial change:** ${claim.editorialChange}`;
});
const registerMarkdown = `# Scroll of Fire — Evidence Register\n\nThis register accompanies the separate reading edition. It is not a verdict on the manuscript or its spiritual interpretation. Entries quote exact archived wording and point to commit-pinned source lines. Sources are linked with their publisher and date; each entry states what the record supports and where it stops. An allegation is not treated as an established event, and a forecast or theological interpretation is not presented as a factual finding.\n\n**Source-access limitation:** External hosts were unreachable during preparation, so citations were not live-checked in this session. A listed source identifies a record for review; it is not a claim that the linked page was successfully fetched or that every underlying assertion has been verified. Empty source lists and pending statuses remain explicit.\n\n**Frozen source:** [Full Scroll Unsealed, edition 1.0.0](https://github.com/ssnfts24/scroll-of-fire/blob/${edition.sourceCommit}/Full_Scroll_Unsealed) · SHA-256 \`${sourceHash}\`. The original bytes, paragraph map, reader segment map, search artifacts, lexicon, atlas, service worker, and protected Observatory are outside this editorial build.\n\n**Coverage:** prioritized claims in the repeated political sequences and high-priority technology / public-health passages. This is not a verification of every factual assertion in the full manuscript. Claims not yet verified are labelled and listed rather than silently treated as fact.\n\n${rows.join("\n\n---\n\n")}\n\n## Claims requiring further investigation\n\nSee the machine-readable register for status and source detail. The current review is limited to the claims listed above; remaining claims across the historical, scientific, political, and technological archive are not verified by inclusion in this phase.\n`;
const changeLogText = `# Editorial Change Log\n\n## Reading edition 1.1.0\n\nThe frozen edition 1.0.0 is unchanged. The new political reading edition consolidates the substantially repeated political sequence into one canonical presentation and links all original political and evidence-archive occurrences. No archival occurrence is removed; the original reader and search index continue to expose the complete source.\n\nSubstantive changes are recorded by claim ID in [EVIDENCE_REGISTER.md](EVIDENCE_REGISTER.md) and in [the machine-readable register](docs/scroll/evidence/claim-register.json). In summary, the edit removes political-leader-as-savior language; applies the same evidentiary standard across administrations, parties, agencies, media, companies, and donors; corrects attribution and scope where primary records establish it; and labels unverified claims, forecasts, and theological interpretation as such.\n\nOriginal comparisons are included with each evidence record as exact quotations and commit-pinned source links. This log describes the reading-edition changes, not revisions to the manuscript or historic integrity ledgers.\n`;

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
