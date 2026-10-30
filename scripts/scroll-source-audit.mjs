import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "Full_Scroll_Unsealed");
const archiveDir = path.join(root, "archive", "Full_Scroll_Unsealed", "1.0.0");
const archivedSourcePath = path.join(archiveDir, "Full_Scroll_Unsealed");
const manifestPath = path.join(archiveDir, "edition.json");
const mapPath = path.join(archiveDir, "paragraph-map.json");
const auditPath = path.join(archiveDir, "content-audit.json");
const repository = "ssnfts24/scroll-of-fire";
const editionVersion = "1.0.0";
const expectedParts = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII"];
const boilerplate = "Note: This Hebrew root carries layered meanings from the original text, with echoes in covenantal, poetic, and prophetic dimensions, as preserved in the Masoretic Text, Septuagint, and ancient Jewish commentary.";

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function git(...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function lineMetadata(text) {
  const endings = [...text.matchAll(/\r\n|\n|\r/g)].map(match => match[0]);
  const distinctEndings = [...new Set(endings)];
  const hasFinalNewline = /(?:\r\n|\n|\r)$/.test(text);
  const lines = text.split(/\r\n|\n|\r/);
  if (hasFinalNewline) lines.pop();
  return {
    lines,
    lineCount: lines.length,
    lineEnding: distinctEndings.length === 1 ? distinctEndings[0] : distinctEndings.length ? "mixed" : "none",
    hasFinalNewline
  };
}

function writeJson(file, value, flag = "w") {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag });
}

function freeze() {
  if (!fs.existsSync(sourcePath)) throw new Error("Full_Scroll_Unsealed is missing.");
  if (fs.existsSync(archivedSourcePath) || fs.existsSync(manifestPath)) {
    throw new Error(`The ${editionVersion} archival edition already exists; refusing to overwrite it.`);
  }
  const sourceBytes = fs.readFileSync(sourcePath);
  const sourceText = sourceBytes.toString("utf8");
  if (!Buffer.from(sourceText, "utf8").equals(sourceBytes)) {
    throw new Error("Full_Scroll_Unsealed is not valid UTF-8; refusing to freeze a lossy decode.");
  }
  const metadata = lineMetadata(sourceText);
  const sourceCommit = git("rev-parse", "HEAD");
  const manifest = {
    schemaVersion: 1,
    editionVersion,
    title: "Full Scroll Unsealed",
    originalPath: "Full_Scroll_Unsealed",
    archivedPath: "archive/Full_Scroll_Unsealed/1.0.0/Full_Scroll_Unsealed",
    sourceCommit,
    sourceCommitDate: git("show", "-s", "--format=%cI", sourceCommit),
    frozenAt: new Date().toISOString(),
    sha256: sha256(sourceBytes),
    byteLength: sourceBytes.length,
    lineCount: metadata.lineCount,
    encoding: "UTF-8",
    lineEnding: metadata.lineEnding,
    hasFinalNewline: metadata.hasFinalNewline,
    preservation: "byte-for-byte copy; the root manuscript remains unchanged"
  };

  fs.mkdirSync(archiveDir, { recursive: true });
  fs.writeFileSync(archivedSourcePath, sourceBytes, { flag: "wx" });
  writeJson(manifestPath, manifest, "wx");
  console.log(`Frozen ${manifest.originalPath} as edition ${editionVersion}`);
  console.log(`SHA-256 ${manifest.sha256}`);
}

function normalizeTitle(title) {
  return title
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[’‘]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function heading(line) {
  const text = line.trim();
  if (!text) return null;

  let match = text.match(/^#{1,6}\s+(.+?)\s*#*$/);
  if (match) return { type: "markdown-heading", title: match[1].trim() };

  match = text.match(/^PART\s+([IVXLCDM]+)\s*[:—–-]?\s*(.*)$/i);
  if (match) return { type: "part", label: match[1].toUpperCase(), title: text };

  match = text.match(/^APPENDIX\s+([A-Z]+|[IVXLCDM]+)(?:\s+CONTINUED)?\s*[:.—–-]?\s*(.*)$/i);
  if (match) return { type: "appendix", label: match[1].toUpperCase(), title: text };

  match = text.match(/^(?:📜\s*)?GENESIS\s+(\d{1,2})\s*[—–-]\s*(?!\d)(.+)$/i);
  if (match) return { type: "genesis-chapter", label: Number(match[1]), title: text };

  match = text.match(/^(?:CHAPTER|CH)\.?\s+(\d{1,3})(?:\s*[:.—–-]\s*|\s+)(.+)$/i);
  if (match) return { type: "chapter", label: Number(match[1]), title: text };

  match = text.match(/^([IVXLCDM]{1,6})[.)]\s+(.+)$/);
  if (match) return { type: "roman-section", label: match[1], title: text };

  const letters = [...text].filter(character => /\p{L}/u.test(character));
  if (letters.length > 2 && text.length <= 180 && text === text.toLocaleUpperCase("en") &&
      !/[.!?]$/.test(text)) {
    return { type: "uppercase-heading", title: text };
  }

  return null;
}

function sourceUrl(sourceCommit, line) {
  return `https://github.com/${repository}/blob/${sourceCommit}/Full_Scroll_Unsealed#L${line}`;
}

function parseSource(sourceText, sourceCommit) {
  const { lines, lineCount, lineEnding, hasFinalNewline } = lineMetadata(sourceText);
  const sections = [];
  const lineSectionIds = new Array(lineCount);

  for (let index = 0; index < lineCount; index += 1) {
    const detected = heading(lines[index]);
    if (!detected) {
      lineSectionIds[index] = sections.at(-1)?.id ?? null;
      continue;
    }
    const lineNumber = index + 1;
    const section = {
      id: `section-line-${String(lineNumber).padStart(6, "0")}`,
      type: detected.type,
      label: detected.label ?? null,
      title: detected.title,
      normalizedTitle: normalizeTitle(detected.title),
      line: lineNumber,
      sourceUrl: sourceUrl(sourceCommit, lineNumber)
    };
    sections.push(section);
    lineSectionIds[index] = section.id;
  }

  const paragraphs = [];
  let start = -1;
  function finishParagraph(end) {
    if (start < 0) return;
    const paragraphLines = lines.slice(start, end);
    const firstLine = start + 1;
    const lastLine = end;
    const detectedHeading = paragraphLines.length === 1 ? heading(paragraphLines[0]) : null;
    paragraphs.push({
      id: `paragraph-line-${String(firstLine).padStart(6, "0")}`,
      lineStart: firstLine,
      lineEnd: lastLine,
      lineCount: paragraphLines.length,
      sectionId: lineSectionIds[start] ?? null,
      kind: detectedHeading ? "heading" : "text",
      text: paragraphLines.join("\n"),
      normalizedTextSha256: sha256(Buffer.from(paragraphLines.join("\n"), "utf8")),
      sourceUrl: sourceUrl(sourceCommit, firstLine)
    });
    start = -1;
  }

  for (let index = 0; index < lineCount; index += 1) {
    if (lines[index].trim() === "") {
      finishParagraph(index);
    } else if (start < 0) {
      start = index;
    }
  }
  finishParagraph(lineCount);

  const paragraphByLine = new Array(lineCount);
  for (const paragraph of paragraphs) {
    for (let line = paragraph.lineStart; line <= paragraph.lineEnd; line += 1) {
      paragraphByLine[line - 1] = paragraph.id;
    }
  }

  const parts = expectedParts.map(label => {
    const occurrences = sections
      .filter(section => section.type === "part" && section.label === label)
      .map(section => ({ sectionId: section.id, title: section.title, line: section.line, sourceUrl: section.sourceUrl }));
    return { label, occurrences };
  });
  const partRuns = [];
  let currentRun = [];
  for (const section of sections.filter(item => item.type === "part")) {
    if (section.label === "I" && currentRun.length) {
      partRuns.push(currentRun);
      currentRun = [];
    }
    currentRun.push(section.label);
  }
  if (currentRun.length) partRuns.push(currentRun);

  const appendices = new Map();
  for (const section of sections.filter(item => item.type === "appendix")) {
    const entry = appendices.get(section.label) ?? { label: section.label, occurrences: [] };
    entry.occurrences.push({ sectionId: section.id, title: section.title, line: section.line, sourceUrl: section.sourceUrl });
    appendices.set(section.label, entry);
  }

  const genesis = Array.from({ length: 50 }, (_, index) => {
    const chapter = index + 1;
    const occurrences = sections
      .filter(section => section.type === "genesis-chapter" && section.label === chapter)
      .map(section => ({ sectionId: section.id, title: section.title, line: section.line, sourceUrl: section.sourceUrl }));
    return { chapter, occurrences };
  });

  const hebrew = new Map();
  const hebrewPattern = /[\p{Script=Hebrew}\p{M}׳״'"-]+/gu;
  lines.forEach((line, index) => {
    for (const match of line.matchAll(hebrewPattern)) {
      const form = match[0].replace(/^[-'"׳״]+|[-'"׳״]+$/g, "");
      if (!form || !/\p{Script=Hebrew}/u.test(form)) continue;
      const canonical = form.normalize("NFKC").replace(/[\u0591-\u05C7]/g, "").replace(/[׳״'"-]/g, "");
      if (!canonical) continue;
      const term = hebrew.get(canonical) ?? { canonical, forms: {}, occurrences: 0, lines: [], paragraphIds: [] };
      term.forms[form] = (term.forms[form] ?? 0) + 1;
      term.occurrences += 1;
      const lineNumber = index + 1;
      if (term.lines.at(-1) !== lineNumber) term.lines.push(lineNumber);
      const paragraphId = paragraphByLine[index];
      if (paragraphId && term.paragraphIds.at(-1) !== paragraphId) term.paragraphIds.push(paragraphId);
      hebrew.set(canonical, term);
    }
  });

  const boilerplateLines = [];
  const boilerplateParagraphIds = [];
  lines.forEach((line, index) => {
    if (line.includes(boilerplate)) {
      boilerplateLines.push(index + 1);
      const paragraphId = paragraphByLine[index];
      if (paragraphId && boilerplateParagraphIds.at(-1) !== paragraphId) boilerplateParagraphIds.push(paragraphId);
    }
  });

  const headingGroups = new Map();
  for (const section of sections) {
    const key = `${section.type}:${normalizeTitle(section.title)}`;
    const group = headingGroups.get(key) ?? [];
    group.push(section);
    headingGroups.set(key, group);
  }
  const duplicateHeadings = [...headingGroups.values()]
    .filter(group => group.length > 1)
    .map(group => ({ title: group[0].title, type: group[0].type, lines: group.map(item => item.line), sectionIds: group.map(item => item.id) }));

  const missingGenesis = genesis.filter(chapter => chapter.occurrences.length === 0).map(chapter => chapter.chapter);
  const duplicateGenesis = genesis
    .filter(chapter => chapter.occurrences.length > 1)
    .map(chapter => ({ chapter: chapter.chapter, lines: chapter.occurrences.map(item => item.line) }));
  const missingParts = parts.filter(part => part.occurrences.length === 0).map(part => part.label);
  const duplicateParts = parts
    .filter(part => part.occurrences.length > 1)
    .map(part => ({ part: part.label, lines: part.occurrences.map(item => item.line) }));
  const incompletePartRuns = partRuns
    .map((run, index) => ({ index: index + 1, parts: run, missing: expectedParts.filter(label => !run.includes(label)) }))
    .filter(run => run.missing.length > 0);

  const map = {
    schemaVersion: 1,
    editionVersion,
    sourceCommit,
    sourceSha256: sha256(Buffer.from(sourceText, "utf8")),
    sourcePath: "archive/Full_Scroll_Unsealed/1.0.0/Full_Scroll_Unsealed",
    lineEnding,
    hasFinalNewline,
    lineCount,
    paragraphCount: paragraphs.length,
    sections,
    paragraphs
  };
  const audit = {
    schemaVersion: 1,
    editionVersion,
    sourceCommit,
    sourceSha256: map.sourceSha256,
    sourceUrl: `https://github.com/${repository}/blob/${sourceCommit}/Full_Scroll_Unsealed`,
    summary: {
      physicalLines: lineCount,
      paragraphs: paragraphs.length,
      sections: sections.length,
      partsIThroughXVIII: parts.map(part => ({ part: part.label, occurrences: part.occurrences.length })),
      partSequenceRuns: partRuns.length,
      appendices: [...appendices.values()].length,
      genesisChaptersPresent: genesis.filter(chapter => chapter.occurrences.length).length,
      uniqueHebrewTerms: hebrew.size,
      repeatedHebrewBoilerplateOccurrences: boilerplateLines.length,
      claimReviewCandidates: paragraphs.filter(paragraph => paragraph.kind === "text").length
    },
    parts,
    partSequenceRuns: partRuns.map((run, index) => ({
      sequence: index + 1,
      parts: run,
      complete: expectedParts.every(label => run.includes(label)),
      firstPart: run[0] ?? null,
      lastPart: run.at(-1) ?? null
    })),
    appendices: [...appendices.values()],
    genesisChapters: genesis,
    hebrewTerms: [...hebrew.values()].sort((left, right) => left.canonical.localeCompare(right.canonical)),
    duplicateHeadings,
    claimReview: {
      status: "inventory only; factual claim verification is outside PR 1",
      candidateParagraphIds: paragraphs.filter(paragraph => paragraph.kind === "text").map(paragraph => paragraph.id)
    },
    repeatedBoilerplate: {
      text: boilerplate,
      occurrenceCount: boilerplateLines.length,
      lines: boilerplateLines,
      paragraphIds: boilerplateParagraphIds
    },
    diagnostics: {
      missingGenesisChapters: missingGenesis,
      duplicateGenesisChapters: duplicateGenesis,
      missingParts,
      duplicateParts,
      incompletePartRuns,
      duplicateHeadingGroups: duplicateHeadings.length,
      sourceAndArchiveByteIdentical: true
    }
  };
  return { map, audit };
}

function audit(write) {
  for (const file of [archivedSourcePath, manifestPath]) {
    if (!fs.existsSync(file)) throw new Error(`Missing frozen source artifact: ${path.relative(root, file)}. Run npm run scroll:freeze once.`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const sourceBytes = fs.readFileSync(archivedSourcePath);
  const workingBytes = fs.readFileSync(sourcePath);
  if (!sourceBytes.equals(workingBytes)) {
    throw new Error("The working manuscript differs from the frozen archival edition; no audit files were written.");
  }
  if (sha256(sourceBytes) !== manifest.sha256) {
    throw new Error("Frozen source SHA-256 does not match edition.json.");
  }
  if (sourceBytes.length !== manifest.byteLength) {
    throw new Error("Frozen source byte length does not match edition.json.");
  }
  const sourceText = sourceBytes.toString("utf8");
  if (!Buffer.from(sourceText, "utf8").equals(sourceBytes)) {
    throw new Error("Frozen source is not valid UTF-8; refusing to create a lossy map.");
  }
  const frozenCommitBytes = execFileSync("git", ["show", `${manifest.sourceCommit}:Full_Scroll_Unsealed`], { cwd: root });
  if (!sourceBytes.equals(frozenCommitBytes)) {
    throw new Error("Frozen source does not match Full_Scroll_Unsealed at the recorded source commit.");
  }

  const { map, audit: contentAudit } = parseSource(sourceText, manifest.sourceCommit);
  contentAudit.sourceSha256 = manifest.sha256;
  contentAudit.diagnostics.sourceAndArchiveByteIdentical = sourceBytes.equals(workingBytes);
  const generated = [
    [mapPath, map],
    [auditPath, contentAudit]
  ];
  if (write) {
    for (const [file, value] of generated) writeJson(file, value);
    console.log(`Wrote ${path.relative(root, mapPath)} (${map.paragraphCount} paragraphs)`);
    console.log(`Wrote ${path.relative(root, auditPath)} (${map.sections.length} sections)`);
    return;
  }
  for (const [file, value] of generated) {
    if (!fs.existsSync(file)) throw new Error(`Missing generated audit artifact: ${path.relative(root, file)}. Run npm run scroll:audit.`);
    const current = fs.readFileSync(file, "utf8");
    const expected = `${JSON.stringify(value, null, 2)}\n`;
    if (current !== expected) throw new Error(`${path.relative(root, file)} is out of date; run npm run scroll:audit.`);
  }
  console.log(`Verified frozen edition, ${map.paragraphCount} paragraph mappings, and ${map.sections.length} provenance-linked sections.`);
}

const [command, ...args] = process.argv.slice(2);
try {
  if (command === "freeze" && args.length === 0) freeze();
  else if (command === "audit" && (args.length === 0 || (args.length === 1 && args[0] === "--write"))) audit(args[0] === "--write");
  else throw new Error("Usage: node scripts/scroll-source-audit.mjs freeze | audit [--write]");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
