#!/usr/bin/env node
// CODEX R2-01: builds the development-only master registry, reports and the approved-public manifest.
// Usage: node scripts/build-r2-inventory.mjs [--check]
// Document statistics come from site-audit/r2/document-extracts.json (scripts/r2-extract-documents.py).
// New files must be staged before generation; untracked workspace files are never inventory inputs.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "site-audit", "r2");
const check = process.argv.includes("--check");
const FROZEN_SHA = "81a015fb937f1664c2383fa38fddf956d281c6309a9584382c6dbc9d8b691400";
const BASE_URL = "https://codexofreality.org/";

const sha256 = buf => crypto.createHash("sha256").update(buf).digest("hex");
const readJson = f => JSON.parse(fs.readFileSync(f, "utf8"));
const OWN_OUTPUT = /^site-audit\/r2\//;

function trackedFiles() {
  const out = execFileSync("git", ["ls-files", "-z", "--cached"], { cwd: root, maxBuffer: 1 << 26 }).toString("utf8");
  return out.split("\0").filter(Boolean)
    .filter(f => !OWN_OUTPUT.test(f) && !/^site-audit\/screenshots\//.test(f) && !/pr-body.*\.md$/.test(f))
    .filter(f => fs.existsSync(path.join(root, f)))
    .sort();
}

const curation = readJson(path.join(root, "scripts", "site-catalog-curation.json"));
const catalogPaths = new Map();
for (const e of curation.entries) if (e.path) catalogPaths.set("docs/" + e.path, e);
for (const [p, title] of Object.entries(curation.utilityPages || {})) catalogPaths.set("docs/" + p, { title, status: "live", id: "utility:" + p });
const extracts = readJson(path.join(outDir, "document-extracts.json")).files;

const ext = f => path.extname(f).toLowerCase().replace(".", "") || "(none)";
const imageExt = new Set(["png", "jpg", "jpeg", "webp", "svg", "gif", "ico"]);

// First matching rule wins. Each rule yields group, role, eligibility and status.
const RULES = [
  [/^archive\//, { group: "frozen-archive", role: "Frozen archival edition 1.0.0 and its machine-readable maps", eligibility: "protected-immutable", status: "archived", editorial: "not-applicable", next: "None. Immutable." }],
  [/^Full_Scroll_Unsealed$/, { group: "frozen-archive", role: "Original manuscript, never edited in place", eligibility: "protected-immutable", status: "original", editorial: "derived-edition-exists", next: "None. Immutable." }],
  [/^docs\/scroll\/archive\//, { group: "scroll-library", role: "Public byte copy of the frozen original", eligibility: "approved-public", status: "archived", editorial: "not-applicable", next: "Keep hash-locked." }],
  [/^docs\/scroll\/evidence\//, { group: "scroll-library", role: "PR4 evidence register (21 claims) and editorial edition data", eligibility: "approved-public", status: "partially-reviewed", editorial: "reviewed-pr4", evidence: "partially-reviewed", next: "Extend with dated sources in R2-05." }],
  [/^docs\/scroll\//, { group: "scroll-library", role: "Scroll Library reader, generated data, search index or lexicon", eligibility: "approved-public", status: "operational", editorial: "generated", next: "Regenerate via npm run scroll:build." }],
  [/^docs\/assets\/vendor\//, { group: "vendor", role: "Third-party library bundled for runtime use", eligibility: "approved-public", status: "operational", next: "Record licence and version in R2-03." }],
  [/^docs\/assets\/img\/.*\.md$/, { group: "deployed-dev-doc", role: "Image pipeline note stored under the publish tree", eligibility: "restricted-review", status: "unverified", next: "Decide: move out of docs/ or mark intentionally public." }],
  [/^docs\/assets\/.*\.md$/, { group: "deployed-dev-doc", role: "Asset folder README stored under the publish tree", eligibility: "restricted-review", status: "unverified", next: "Decide: move out of docs/ or mark intentionally public." }],
  [/^docs\/assets\//, { group: "site-asset", role: "Runtime stylesheet, script, data or image", eligibility: "approved-public", status: "operational", next: "Functionality audit in R2-03/R2-06." }],
  [/^docs\/codex_final_upload\//, { group: "deployed-bundle", role: "Upload parts and directive stored under the publish tree", eligibility: "restricted-review", status: "unverified", next: "Inspect archive contents; likely move out of publish tree." }],
  [/^docs\/(reports|development|specifications)\//, { group: "deployed-dev-doc", role: "Engineering report or specification under the publish tree", eligibility: "restricted-review", status: "partially-reviewed", next: "Decide public technical-record status; specs may belong in Build journey." }],
  [/^docs\/templates\//, { group: "deployed-template", role: "JSON authoring template", eligibility: "restricted-review", status: "prototype", next: "Move out of publish tree unless a public reason exists." }],
  [/^docs\/data\//, { group: "site-data", role: "Public data consumed by pages", eligibility: "approved-public", status: "operational", next: "Schema review in R2-07." }],
  [/^docs\/theory\//, { group: "theory", role: "Theory page", eligibility: "approved-public", status: "unverified", evidence: "not-started", next: "Evidence classification in R2-05." }],
  [/^docs\/.*\.md$/, { group: "deployed-dev-doc", role: "Markdown document stored under the publish tree", eligibility: "restricted-review", status: "unverified", next: "Decide: move out of docs/ or mark intentionally public." }],
  [/^docs\//, { group: "site-page", role: "Site page or support file", eligibility: "public-unreviewed", status: "operational", next: "Functionality review." }],
  [/^1_Codex_of_Reality\//, { group: "manuscript", role: "Codex of Reality source manuscript", eligibility: "pending-publication-review", status: "original", editorial: "not-started", next: "Editorial and publication review." }],
  [/^2_Witness_Scrolls\//, { group: "witness-record", role: "Witness scroll or recorded testimony", eligibility: "restricted-review", status: "original", editorial: "not-started", next: "Preserve; review for personal content before any publication." }],
  [/^3_Living_Technology\//, { group: "living-technology", role: "Technology whitepaper or blueprint", eligibility: "pending-publication-review", status: "unverified", evidence: "not-started", functionality: "not-validated", next: "Separate engineering from interpretation (R2-05)." }],
  [/^4_Formalism_and_Physics\//, { group: "formalism-physics", role: "Formalism, physics or scripture-study manuscript", eligibility: "pending-publication-review", status: "unverified", evidence: "not-started", next: "Claim classification (R2-05)." }],
  [/^5_Living_Scribe\//, { group: "living-scribe", role: "Scribe companion or directive", eligibility: "restricted-review", status: "original", editorial: "not-started", next: "Review for internal or personal material." }],
  [/^6_Images_and_Symbols\//, { group: "image-symbol", role: "Image, symbol or synchronicity record", eligibility: "restricted-review", status: "original", next: "Visual review for personal imagery." }],
  [/^7_Ledger_and_Documentation\//, { group: "ledger", role: "Historical ledger, hash record or version history", eligibility: "protected-immutable", status: "original", next: "Recompute hash status in R2-01 follow-up; never relabel placeholders as verified." }],
  [/^Site\//, { group: "legacy-site", role: "Legacy site fragment", eligibility: "pending-publication-review", status: "deprecated", next: "Decide merge or retire." }],
  [/^project-files\//, { group: "project-file", role: "Project planning bundle", eligibility: "development-only", status: "prototype", next: "Inspect archive contents." }],
  [/^assets\//, { group: "legacy-asset", role: "Root-level script outside the publish tree", eligibility: "development-only", status: "deprecated", next: "Confirm unused." }],
  [/^tests\//, { group: "tooling", role: "Automated test", eligibility: "development-only", status: "operational", next: "Keep green." }],
  [/^scripts\//, { group: "tooling", role: "Build or audit script", eligibility: "development-only", status: "operational", next: "Keep green." }],
  [/^site-audit\//, { group: "tooling", role: "Generated audit report", eligibility: "development-only", status: "operational", next: "Regenerate when sources change." }],
  [/^\.github\//, { group: "tooling", role: "CI workflow or repository template", eligibility: "development-only", status: "operational", next: "Keep green." }],
  [/^(EVIDENCE_REGISTER|EDITORIAL_CHANGELOG)\.md$/, { group: "editorial", role: "PR4 evidence register or editorial changelog", eligibility: "development-only", status: "partially-reviewed", next: "Extend in R2-05." }],
  [/^(Genesis-Restored|Exodus-Restored)\.md$/, { group: "scripture", role: "Restored Scripture manuscript (original-language and paraphrase mix)", eligibility: "pending-publication-review", status: "unverified", scripture: "not-verified", next: "Verse-level audit (R2-02)." }],
  [/^(codex-of-reality|index|The-Journey-Scroll)\.md$/, { group: "manuscript", role: "Root manuscript or index", eligibility: "pending-publication-review", status: "original", editorial: "not-started", next: "Editorial review." }],
  [/^(README|LICENSE|CITATION|CONTRIBUTION)/, { group: "project-doc", role: "Project documentation or licence", eligibility: "development-only", status: "operational", next: "Keep current." }],
  [/^(COPILOT-PR-DIRECTIVE|[A-Z0-9-]*(HANDOFF|PATCH|MANIFEST|PHASE|PLAN|ARCHITECTURE|STRATA|HOTFIX|INGESTION)[A-Z0-9-]*)\.(md|txt)$/, { group: "dev-handoff", role: "Developer handoff, patch manifest or plan", eligibility: "development-only", status: "archived", next: "Keep out of public publication." }],
  [/^CODEX-FINAL-UPLOAD/, { group: "deployed-bundle", role: "Upload bundle at repository root", eligibility: "development-only", status: "unverified", next: "Inspect archive contents." }],
  [/^(\d{8}_\d{6}|file_[0-9a-f]+).*\.(jpg|png)$/i, { group: "unlabelled-image", role: "Timestamp- or upload-named root image", eligibility: "restricted-review", status: "unverified", next: "Visual review; identify content and rights before use." }],
  [/\.docx$/, { group: "manuscript", role: "Root Word manuscript", eligibility: "restricted-review", status: "original", editorial: "not-started", next: "Review." }],
  [/^\.gitignore$|^package\.json$|^netlify\.toml$/, { group: "tooling", role: "Repository or deployment configuration", eligibility: "development-only", status: "operational", next: "Keep current." }],
];

const SIGNAL_EXAMINED = {
  "text-extracted": "text-extracted",
  "no-text-layer": "no-text-layer-needs-visual-review",
  "listed-only": "archive-listed",
  "extract-error": "extract-error",
};

const files = trackedFiles();
const recs = [];
for (const f of files) {
  const buf = fs.readFileSync(path.join(root, f));
  const rule = RULES.find(([re]) => re.test(f))?.[1];
  const deployed = f.startsWith("docs/");
  const catalog = catalogPaths.get(f);
  const x = extracts[f];
  let eligibility = rule?.eligibility || "unclassified";
  if (catalog && deployed) eligibility = "approved-public";
  const rec = {
    id: "r2:" + f.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) + "-" + sha256(Buffer.from(f)).slice(0, 6),
    path: f,
    title: catalog?.title || path.basename(f),
    format: ext(f),
    bytes: buf.length,
    sha256: sha256(buf),
    group: rule?.group || "unclassified",
    role: rule?.role || "Unclassified",
    deployed,
    publicUrl: deployed ? BASE_URL + f.slice(5).replace(/index\.html$/, "") : null,
    publicationEligibility: eligibility,
    status: catalog ? (catalog.status === "live" ? "operational" : catalog.status) : rule?.status || "unverified",
    catalogId: catalog?.id || null,
    author: "not-recorded-in-file",
    reviews: {
      editorial: rule?.editorial || "not-started",
      scripture: rule?.scripture || "not-applicable-or-not-started",
      evidence: rule?.evidence || "not-started",
      functionality: rule?.functionality || (catalog ? "structurally-audited" : "not-started"),
    },
    examination: x ? SIGNAL_EXAMINED[x.status] || x.status : (catalog ? "structurally-audited" : "inventoried-only"),
    nextAction: rule?.next || "Classify manually.",
  };
  if (x) rec.extract = { status: x.status, pages: x.pages, paragraphs: x.paragraphs, words: x.words, hebrew: x.scripts?.hebrew, greek: x.scripts?.greek, members: x.members, metadata: x.metadata };
  recs.push(rec);
}

// Protected hash proofs
const frozenPath = "archive/Full_Scroll_Unsealed/1.0.0/Full_Scroll_Unsealed";
const frozenHash = sha256(fs.readFileSync(path.join(root, frozenPath)));
const originalHash = sha256(fs.readFileSync(path.join(root, "Full_Scroll_Unsealed")));
const publicCopyHash = sha256(fs.readFileSync(path.join(root, "docs/scroll/archive/Full_Scroll_Unsealed.txt")));
const proofs = { expected: FROZEN_SHA, rootOriginal: originalHash, frozenArchive: frozenHash, publicCopy: publicCopyHash };
const proofOk = Object.values(proofs).every(v => v === FROZEN_SHA);

// Duplicates: identical content, and same-stem document pairs
const byHash = new Map();
for (const r of recs) if (r.bytes > 0) (byHash.get(r.sha256) || byHash.set(r.sha256, []).get(r.sha256)).push(r.path);
const identical = [...byHash.entries()].filter(([, v]) => v.length > 1).map(([h, v]) => ({ sha256: h, paths: v }));
const stemGroups = new Map();
for (const r of recs) {
  if (!["docx", "pdf", "md", "txt"].includes(r.format) || r.deployed) continue;
  const stem = path.basename(r.path, path.extname(r.path)).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\b(word2pdf|fixed|\d{10,})\b/g, "").replace(/\s+/g, " ").trim();
  if (stem) (stemGroups.get(stem) || stemGroups.set(stem, []).get(stem)).push(r.path);
}
const sameStem = [...stemGroups.entries()].filter(([, v]) => v.length > 1 && new Set(v.map(ext)).size > 1).map(([stem, paths]) => ({ stem, paths }));
for (const g of identical) for (const p of g.paths) recs.find(r => r.path === p).duplicates = g.paths.filter(q => q !== p);
for (const g of sameStem) for (const p of g.paths) { const r = recs.find(r => r.path === p); r.variants = g.paths.filter(q => q !== p); }

// Privacy signals inside the deployed text tree (signals only, not findings of personal data)
const textDeployed = recs.filter(r => r.deployed && ["md", "txt", "html", "json", "js"].includes(r.format) && !r.path.startsWith("docs/scroll/") && !r.path.startsWith("docs/assets/vendor/"));
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE = /(?<![\d.])(?:\+?1[ -.]?)?\(?\d{3}\)?[ -.]\d{3}[ -.]\d{4}(?![\d.])/g;
const privacy = [];
for (const r of textDeployed) {
  const text = fs.readFileSync(path.join(root, r.path), "utf8");
  const emails = [...new Set(text.match(EMAIL) || [])].filter(e => !/\.(png|webp|jpg|svg)$/i.test(e));
  const phones = [...new Set(text.match(PHONE) || [])];
  if (emails.length || phones.length) privacy.push({ path: r.path, emails, phones: phones.length });
}

// Scripture preliminary scan (observed structure only; canonical versification is an R2-02 task)
function scan(file) {
  const lines = fs.readFileSync(path.join(root, file), "utf8").split(/\r?\n/);
  const chapters = [];
  let cur = null;
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i].trim();
    const ch = L.match(/^📜\s*(?:Chapter|GENESIS)\s+(\d+)\b/);
    if (ch) { cur = { chapter: +ch[1], line: i + 1, verses: [], lastLine: "", dupMarkers: 0 }; chapters.push(cur); continue; }
    if (!cur) continue;
    const v = L.match(/^(\d+):(\d+)(?:[-–](\d+))?(?=\s|$)\s*(.*)$/);
    if (v && +v[1] === cur.chapter + 1 && +v[2] === 1) { cur = { chapter: +v[1], line: i + 1, verses: [], lastLine: "", dupMarkers: 0, implicit: true }; chapters.push(cur); }
    if (v && +v[1] === cur.chapter) {
      const n = +v[2];
      if (cur.verses.includes(n)) cur.dupMarkers++;
      cur.verses.push(n);
      if (v[3]) for (let k = n + 1; k <= +v[3]; k++) cur.verses.push(k);
      const inline = v[4].split(" | ")[0].trim();
      if (inline) cur.lastLine = inline;
    } else if (L && !/^(→|📜|שמות|בראשית|Hebrew|Root|Meaning|Note:)/.test(L)) cur.lastLine = L;
  }
  const seen = new Map();
  for (const c of chapters) seen.set(c.chapter, (seen.get(c.chapter) || 0) + 1);
  return chapters.map(c => ({
    chapter: c.chapter,
    headingLine: c.line,
    headingOccurrences: seen.get(c.chapter),
    headingKind: c.implicit ? "no-english-heading (first verse marker used)" : "heading",
    markersFound: c.verses.length,
    highestVerseMarker: Math.max(0, ...c.verses),
    duplicateMarkers: c.dupMarkers,
    gaps: (() => { const s = new Set(c.verses); const m = Math.max(0, ...c.verses); const g = []; for (let k = 1; k <= m; k++) if (!s.has(k)) g.push(k); return g; })(),
    lastProseEndsWithTerminalPunctuation: /[.!?”"’'։׃)]$/.test(c.lastLine),
  }));
}
const scripture = { note: "Preliminary observed structure only. Canonical verse counts and versification (MT vs English) are established in R2-02.", Genesis: scan("Genesis-Restored.md"), Exodus: scan("Exodus-Restored.md") };

// Dependencies
const pkg = readJson(path.join(root, "package.json"));
const workflows = fs.readdirSync(path.join(root, ".github/workflows")).map(f => {
  const t = fs.readFileSync(path.join(root, ".github/workflows", f), "utf8");
  return { file: f, runs: [...t.matchAll(/^\s*-?\s*run:\s*(.+)$/gm)].map(m => m[1].trim()), triggers: [...new Set([...t.matchAll(/^\s{2}(push|pull_request|workflow_dispatch|schedule):/gm)].map(m => m[1]))] };
});
const scriptsDir = fs.readdirSync(path.join(root, "scripts")).filter(f => /\.(mjs|js|py)$/.test(f));
const scriptRefs = scriptsDir.map(s => {
  const t = fs.readFileSync(path.join(root, "scripts", s), "utf8");
  const writes = [...new Set([...t.matchAll(/(?:docs|site-audit|archive)\/[\w./-]+\.(?:json|md|html|txt)/g)].map(m => m[0]))].slice(0, 8);
  return { script: "scripts/" + s, touches: writes };
});
const pages = recs.filter(r => r.format === "html" && r.deployed);
const include = { css: new Map(), js: new Map() };
for (const p of pages) {
  const t = fs.readFileSync(path.join(root, p.path), "utf8");
  for (const m of t.matchAll(/(?:href|src)="([^"#?]+\.(css|js))(?:\?[^"]*)?"/g)) {
    const key = path.posix.normalize(path.posix.join(path.posix.dirname(p.path), m[1].replace(/^\//, "/")));
    const clean = m[1].startsWith("/") ? "docs" + m[1] : key;
    include[m[2]].set(clean, (include[m[2]].get(clean) || 0) + 1);
  }
}
const topShared = kind => [...include[kind].entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);

// Outputs
const count = (arr, fn) => arr.reduce((m, x) => (m[fn(x)] = (m[fn(x)] || 0) + 1, m), {});
const byGroup = count(recs, r => r.group);
const byElig = count(recs, r => r.publicationEligibility);
const byExam = count(recs, r => r.examination);
const unclassified = recs.filter(r => r.group === "unclassified");

const registry = {
  schema: "codex-r2-resource-registry/1",
  purpose: "Development-only registry of every tracked or intended repository file. Not a publication list.",
  generatedFrom: "git ls-files --cached (untracked workspace files excluded; excluding this report folder and site-audit/screenshots)",
  totals: { files: recs.length, bytes: recs.reduce((s, r) => s + r.bytes, 0), byGroup, byPublicationEligibility: byElig, byExamination: byExam },
  statusVocabulary: ["original", "edited", "verified", "partially-reviewed", "unverified", "prototype", "operational", "archived", "deprecated", "restricted-review"],
  integrityProof: { ...proofs, allMatch: proofOk },
  resources: recs,
};
const approved = {
  schema: "codex-r2-approved-public-manifest/1",
  purpose: "Files approved for public presentation: catalog-listed pages plus generated reader, data and assets. 'Approved to publish' does not mean verified.",
  note: "Deployed-but-unapproved files are listed separately under needsDecision; they are not removed in R2-01.",
  approved: recs.filter(r => r.publicationEligibility === "approved-public").map(r => ({ path: r.path, sha256: r.sha256, publicUrl: r.publicUrl, status: r.status })),
  needsDecision: recs.filter(r => r.deployed && ["restricted-review", "public-unreviewed"].includes(r.publicationEligibility)).map(r => ({ path: r.path, publicUrl: r.publicUrl, eligibility: r.publicationEligibility, reason: r.role })),
};
const fmt = n => n.toLocaleString("en-US");
const table = (rows, head) => [head.join(" | "), head.map(() => "---").join(" | "), ...rows.map(r => r.join(" | "))].map(l => "| " + l + " |").join("\n");

const md = {};
md.inventory = `# CODEX R2 — Master Inventory (development only)

Generated by \`node scripts/build-r2-inventory.mjs\`. Not published. Inputs are index-listed paths only (\`git ls-files --cached\`); stage intentional new files before generating. Untracked files, temporary files and test artifacts never affect the registry.

**Files accounted for:** ${fmt(recs.length)} (${fmt(registry.totals.bytes)} bytes). **Unclassified:** ${unclassified.length}.

## Examination levels (what was actually done)

${table(Object.entries(byExam).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v]), ["Level", "Files"])}

- \`text-extracted\`: PDF/DOCX/TXT text was extracted and counted. This is a measurement, not an editorial review.
- \`archive-listed\`: ZIP members were listed; contents were not read.
- \`no-text-layer-needs-visual-review\`: no extractable text; needs a human look.
- \`structurally-audited\`: catalog page covered by the site audit (links, headings, structure).
- \`inventoried-only\`: hashed and classified from path rules; **not reviewed**.

No file is marked editorially, scripture- or evidence-verified by this report.

## By group

${table(Object.entries(byGroup).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v]), ["Group", "Files"])}

## By publication eligibility

${table(Object.entries(byElig).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v]), ["Eligibility", "Files"])}

## Protected integrity proof

${table(Object.entries(proofs).map(([k, v]) => [k, "`" + v + "`", v === FROZEN_SHA ? "matches" : "MISMATCH"]), ["Item", "SHA-256", "Result"])}

## Documents (PDF, DOCX, TXT) — extraction results

${table(recs.filter(r => r.extract).map(r => ["`" + r.path.replace(/\|/g, "\\|") + "`", r.format, r.extract.status, r.extract.pages ?? r.extract.paragraphs ?? r.extract.members ?? "", r.extract.words ?? "", r.extract.hebrew ? "yes" : ""]), ["Path", "Fmt", "Extraction", "Pages/paras/members", "Words", "Hebrew"])}

The full per-file record (hash, role, next action) is in \`CODEX_R2_RESOURCE_REGISTRY.json\`.
`;
md.duplicates = `# CODEX R2 — Duplicate Map

Nothing is deleted or merged by this report.

## Byte-identical files (${identical.length} groups)

${identical.length ? identical.map(g => `- \`${g.sha256.slice(0, 12)}…\`\n${g.paths.map(p => `  - \`${p}\``).join("\n")}`).join("\n") : "None."}

## Probable variants (same title stem, different format or copy)

These are candidates for manual comparison. A shared name does not prove identical content.

${sameStem.map(g => `- **${g.stem}**\n${g.paths.map(p => `  - \`${p}\``).join("\n")}`).join("\n") || "None."}

## Known intentional duplicates

- \`Full_Scroll_Unsealed\`, \`archive/Full_Scroll_Unsealed/1.0.0/Full_Scroll_Unsealed\` and \`docs/scroll/archive/Full_Scroll_Unsealed.txt\` are required byte copies of one original (hash proof in the master inventory).
- \`CODEX-FINAL-UPLOAD-PART-01-OF-06.zip\` exists at the root and under \`docs/codex_final_upload/\`; the table above shows whether the two copies are identical.
`;
md.publication = `# CODEX R2 — Publication Review

"Unlinked does not mean private." Everything under \`docs/\` is deployed (Netlify \`publish = "docs"\`, no build command).

## Deployed files that need an explicit decision (${approved.needsDecision.length})

${table(approved.needsDecision.map(r => ["`" + r.path + "`", r.eligibility, r.reason]), ["Path", "Eligibility", "What it is"])}

No file is removed or promoted in R2-01. Recommended action: decide per group whether each belongs in the public Build journey as a deliberate technical record, or moves out of \`docs/\`.

## Privacy signal scan of deployed text

Automated scan of deployed Markdown, TXT, HTML, JSON and JS (excluding Scroll Library data and vendored code) for e-mail addresses and phone-number patterns. A hit is a lead for review, not proof of personal data.

${privacy.length ? table(privacy.map(p => ["`" + p.path + "`", p.emails.join(", ") || "—", p.phones || "—"]), ["Path", "E-mail addresses", "Phone-pattern hits"]) : "No e-mail or phone patterns found."}

## Not deployed but present in the public repository

- Root developer handoffs, patch manifests and plans: development-only.
- Root timestamp- and upload-named images (${recs.filter(r => r.group === "unlabelled-image").length}): content not yet visually reviewed; restricted until reviewed.
- \`2_Witness_Scrolls/\`: witness records are preserved and held as restricted-review for personal content.
- Repository visibility itself (public) means these files are readable on GitHub regardless of the site's publish tree.

## Image-only or non-text documents

${recs.filter(r => r.examination === "no-text-layer-needs-visual-review").map(r => `- \`${r.path}\` — no extractable text; visual review required.`).join("\n") || "None."}
`;
md.dependencies = `# CODEX R2 — Dependency Map

## npm scripts

${table(Object.entries(pkg.scripts).map(([k, v]) => ["`" + k + "`", "`" + v + "`"]), ["Script", "Command"])}

## Workflows

${workflows.map(w => `- **${w.file}** (${w.triggers.join(", ") || "n/a"})\n${w.runs.map(r => `  - \`${r}\``).join("\n")}`).join("\n")}

## Scripts and the generated paths they reference

${table(scriptRefs.map(s => ["`" + s.script + "`", s.touches.map(t => "`" + t + "`").join(", ") || "—"]), ["Script", "Referenced output paths (first 8)"])}

## Most widely shared runtime assets across deployed pages

${table(topShared("css").map(([k, v]) => ["`" + k + "`", v]), ["Stylesheet", "Pages"])}

${table(topShared("js").map(([k, v]) => ["`" + k + "`", v]), ["Script", "Pages"])}

## Protected systems (do not modify)

- Frozen archive and hash manifests: \`archive/\`, \`Full_Scroll_Unsealed\`, \`7_Ledger_and_Documentation/\`.
- Scroll Library generated data: \`docs/scroll/data/\`, \`docs/scroll/search/\`, \`docs/scroll/evidence/\`.
- \`docs/service-worker.js\` and the Living Time Sphere calendar, temporal cursor and renderer (R1.7), documented in \`docs/development/TEMPORAL-AUTHORITY-CONTRACT.md\`.

## Deployment

- Netlify: \`publish = "docs"\`, no build step, so every generated artifact must be committed.
- GitHub Pages mirror/redirect status: **undetermined**; to be decided and documented in the deployment audit (R2-08). Pages use a \`<base href>\` switch for \`ssnfts24.github.io/scroll-of-fire/\`.

## Reproducible generation order

Stage any intentional new files before generation. Then run:

\`\`\`sh
npm run site:catalog
python3 scripts/r2-extract-documents.py  # requires pypdf
npm run r2:inventory
npm run site:catalog:check
npm run r2:inventory:check
npm run validate
\`\`\`

The two \`--check\` commands are read-only. Catalog scanning uses an OS temporary directory, and both inventories use only index-listed paths. Run checks after the full test suite: the Scroll reader reproducibility test rebuilds tracked \`docs/scroll/\` outputs, which the R2 registry hashes.
`;
const exodusFlag = scripture.Exodus.filter(c => c.headingOccurrences > 1 || c.gaps.length || c.duplicateMarkers || !c.lastProseEndsWithTerminalPunctuation);
const genesisFlag = scripture.Genesis.filter(c => c.headingOccurrences > 1 || c.gaps.length || c.duplicateMarkers || !c.lastProseEndsWithTerminalPunctuation);
const scriptureRow = (book, c) => ["`" + book + " " + c.chapter + "`", c.markersFound, c.highestVerseMarker + (c.headingOccurrences > 1 ? " (heading ×" + c.headingOccurrences + ")" : ""), c.gaps.join(", ") || "—", c.duplicateMarkers || "—", c.lastProseEndsWithTerminalPunctuation ? "yes" : "**no**"];
md.defects = `# CODEX R2 — Known Defects (as of R2-01)

Evidence-based list. "Observed" means measured in this repository; unresolved items are marked as such.

## Scripture (preliminary scan — not a verse audit)

Chapter headings found: Genesis ${scripture.Genesis.length}/50, Exodus ${scripture.Exodus.length}/40. Chapters with a gap in observed verse markers, a repeated marker, or a last prose line without terminal punctuation are listed below. These are leads: the verse-level audit against a named edition is R2-02.

${table([...genesisFlag.map(c => scriptureRow("Genesis", c)), ...exodusFlag.map(c => scriptureRow("Exodus", c))], ["Chapter", "Markers", "Highest", "Missing in-range markers", "Repeated markers", "Last prose ends cleanly"])}

Genesis distinct chapters: ${new Set(scripture.Genesis.map(c => c.chapter)).size}/50 (${scripture.Genesis.length} headings). Exodus distinct chapters: ${new Set(scripture.Exodus.map(c => c.chapter)).size}/40 (${scripture.Exodus.length} headings).

### Chapters named in the project directive, as observed

${table([7, 8, 32].map(n => { const c = scripture.Exodus.find(x => x.chapter === n); return ["`Exodus " + n + "`", c.markersFound, c.highestVerseMarker, c.lastProseEndsWithTerminalPunctuation ? "yes" : "**no**"]; }), ["Chapter", "Markers", "Highest marker", "Last prose ends cleanly"])}

Whether these stop short of the full chapter is confirmed only in R2-02 against a named edition. Exodus 7 visibly ends mid-sentence. Exodus headings without an English heading line: ${scripture.Exodus.filter(c => c.headingKind !== "heading").map(c => c.chapter).join(", ") || "none"}.

Full per-chapter data: \`scripture-preliminary-scan.json\`.

## Publication

- ${approved.needsDecision.length} deployed files need a publish/withdraw decision (see Publication Review).
- Deployed bundle archives under \`docs/codex_final_upload/\` have not had their contents inspected.
- Root images with upload-style names have not been visually reviewed.

## Integrity

- \`7_Ledger_and_Documentation/SHA256_Placeholders_2025.md\` contains placeholder values; they must never be labelled cryptographically verified.
- The historical integrity ledger has not yet been recomputed in this release.

## Documents

- ${recs.filter(r => r.examination === "no-text-layer-needs-visual-review").length} document(s) have no text layer and need visual review.
- ${recs.filter(r => r.format === "zip").length} ZIP archives were listed but not unpacked into review.
- No manuscript outside the Scroll Library has had a completed editorial, scripture or evidence review.

## Deployment

- GitHub Pages versus Netlify role is undecided and undocumented.
- External source links cannot be live-checked from the development environment; all external inspection is **pending**.

## Navigation / experience (carried from PR 5A report)

- Fixed in R2-01: the Atlas filter form (\`hidden\` attribute) was displayed with JavaScript off because author CSS overrode \`hidden\`, leaving inert controls. Now \`.atlas-filters[hidden]\` is hidden and the full 63-entry catalog remains readable (screenshot: \`screenshots/atlas-no-javascript-390.png\`).
- Some nav labels differ from page titles; some pages are not directly linked from the homepage; \`404\`, \`offline\` and the caravan redirect are intentionally unreachable from navigation.
`;

const outputs = {
  "CODEX_R2_RESOURCE_REGISTRY.json": JSON.stringify(registry, null, 2) + "\n",
  "CODEX_R2_APPROVED_PUBLIC_MANIFEST.json": JSON.stringify(approved, null, 2) + "\n",
  "scripture-preliminary-scan.json": JSON.stringify(scripture, null, 2) + "\n",
  "CODEX_R2_MASTER_INVENTORY.md": md.inventory,
  "CODEX_R2_DUPLICATE_MAP.md": md.duplicates,
  "CODEX_R2_PUBLICATION_REVIEW.md": md.publication,
  "CODEX_R2_DEPENDENCY_MAP.md": md.dependencies,
  "CODEX_R2_KNOWN_DEFECTS.md": md.defects,
};

if (!proofOk) { console.error("Frozen source hash mismatch", proofs); process.exit(1); }
if (unclassified.length) { console.error("Unclassified files:\n" + unclassified.map(r => r.path).join("\n")); process.exit(1); }

let stale = [];
for (const [name, body] of Object.entries(outputs)) {
  const file = path.join(outDir, name);
  if (check) { if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== body) stale.push(name); }
  else fs.writeFileSync(file, body);
}
if (check && stale.length) { console.error("Stale R2 reports: " + stale.join(", ") + "\nRun: node scripts/build-r2-inventory.mjs"); process.exit(1); }
console.log(`${check ? "Checked" : "Wrote"} ${Object.keys(outputs).length} R2 outputs for ${recs.length} files; hash proof ${proofOk ? "OK" : "FAILED"}.`);
